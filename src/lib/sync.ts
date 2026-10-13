// Phone <-> account sync (rule 19). The phone stays the first copy; this uploads what is new
// and brings down what another phone saved, so EXP, tokens and misses follow the player.
import { engine } from '@/games/engine';
import type { LedgerEntry, Play, PlayItem } from '@/games/engine';

import { emptyProgress, PROGRESS_KEYS, mergeProgress, sameProgress } from './progress';
import { supabase } from './supabase';

const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
const ms = (s: string | null) => (s == null ? null : Date.parse(s));

let running: Promise<void> | null = null;

/** Claims guest plays, uploads unsynced rows, then merges the account's rows into the phone. Safe to call often. */
export function syncAccount(userId: string) {
  running ??= run(userId).finally(() => (running = null));
  return running;
}

/** What an offline sign-out holds back for the account (SO2): rows not yet uploaded, plus stars and bests. */
type Held = { plays: Play[]; items: PlayItem[]; ledger: LedgerEntry[]; progress: Record<string, unknown> };
const heldKey = (userId: string) => `held:${userId}`;

async function uploadPlays(userId: string, plays: Play[], items: PlayItem[]) {
  if (!plays.length) return;
  const { error } = await supabase.from('plays').upsert(
    plays.map((p) => ({
      id: p.id,
      user_id: userId,
      game: p.game,
      mode: p.mode,
      submode: p.submode ?? null,
      settings: p.settings,
      started_at: iso(p.startedAt),
      ended_at: iso(p.endedAt),
      status: p.status,
      score: p.score,
      seats: p.seats,
      standings: p.standings,
      exp_earned: p.expEarned,
    })),
  );
  if (error) throw error;
  if (!items.length) return;
  const r = await supabase.from('play_items').upsert(
    items.map((i) => ({
      id: i.id,
      play_id: i.playId,
      user_id: userId,
      seat: i.seat,
      item_id: i.itemId,
      answer_key: i.answerKey,
      outcome: i.outcome,
      answers_given: i.answersGiven,
      time_ms: i.timeMs,
      hints_used: i.hintsUsed,
      reveals_used: i.revealsUsed,
      points: i.points,
      feeds_learn: i.feedsLearn,
      game_data: i.gameData,
      at: iso(i.at),
    })),
  );
  if (r.error) throw r.error;
}

/** The server checks each wallet row (EC1) and returns the ids it refused. */
async function uploadLedger(ledger: LedgerEntry[]): Promise<string[]> {
  if (!ledger.length) return [];
  const { data, error } = await supabase.rpc('wallet_sync', {
    entries: ledger.map((e) => ({ id: e.id, kind: e.kind, exp: e.exp, tokens: e.tokens, reason: e.reason, play_id: e.playId ?? null, at: iso(e.at) })),
  });
  if (error) throw error;
  return (data as { refused?: string[] } | null)?.refused ?? [];
}

/**
 * SO2 (Yazan 2026-10-13): signing out offline still leaves a fresh guest phone. What the account had not uploaded
 * is kept apart under its own key, out of the guest's reach, and goes up the next time that account signs in here.
 */
export async function holdUnsynced(userId: string) {
  const { plays, items } = await engine.recorder.unsynced(userId);
  const ledger = await engine.wallet.unsynced();
  const progress: Record<string, unknown> = {};
  for (const key of PROGRESS_KEYS) {
    const v = await engine.kv.get<unknown>(key);
    if (!emptyProgress(v)) progress[key] = v;
  }
  const before = await engine.kv.get<Held>(heldKey(userId));
  // A second offline sign-out before the first upload adds to the pile.
  await engine.kv.set(heldKey(userId), {
    plays: [...(before?.plays ?? []), ...plays],
    items: [...(before?.items ?? []), ...items],
    ledger: [...(before?.ledger ?? []), ...ledger],
    progress: Object.fromEntries(PROGRESS_KEYS.map((k) => [k, mergeProgress(k, before?.progress[k], progress[k])]).filter(([, v]) => !emptyProgress(v))),
  } satisfies Held);
}

async function uploadHeld(userId: string) {
  const held = await engine.kv.get<Held>(heldKey(userId));
  if (!held) return;
  await uploadPlays(userId, held.plays, held.items);
  await uploadLedger(held.ledger);
  const keys = PROGRESS_KEYS.filter((k) => k in held.progress);
  if (keys.length) {
    const { data, error } = await supabase.from('player_progress').select('key,value').in('key', keys);
    if (error) throw error;
    const remote = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
    const up = keys.map((key) => ({ user_id: userId, key, value: mergeProgress(key, held.progress[key], remote.get(key)), updated_at: new Date().toISOString() }));
    const r = await supabase.from('player_progress').upsert(up);
    if (r.error) throw r.error;
  }
  await engine.kv.remove(heldKey(userId));
}

async function run(userId: string) {
  await uploadHeld(userId);
  await engine.recorder.claimGuestPlays(userId);

  const { plays, items } = await engine.recorder.unsynced(userId);
  if (plays.length) {
    await uploadPlays(userId, plays, items);
    await engine.recorder.markSynced(plays.map((p) => p.id));
  }

  // Refused wallet rows leave the phone.
  const ledger = await engine.wallet.unsynced();
  if (ledger.length) {
    const refused = await uploadLedger(ledger);
    await engine.wallet.drop(refused);
    await engine.wallet.markSynced(ledger.map((e) => e.id).filter((id) => !refused.includes(id)));
  }

  await syncProgress(userId);

  // Bring down what other phones saved.
  const [w, p, it] = await Promise.all([
    supabase.from('wallet_ledger').select('id,kind,exp,tokens,reason,play_id,note,at').order('at').limit(5000),
    supabase.from('plays').select('*').eq('status', 'finished').order('started_at', { ascending: false }).limit(1000),
    supabase.from('play_items').select('*').order('at', { ascending: false }).limit(5000),
  ]);
  if (w.data)
    await engine.wallet.mergeRemote(
      w.data.map((e): LedgerEntry => ({ id: e.id, kind: e.kind, exp: e.exp, tokens: e.tokens, reason: e.reason, playId: e.play_id ?? undefined, note: e.note ?? undefined, at: ms(e.at)!, synced: true })),
    );
  if (p.data && it.data)
    await engine.recorder.mergeRemote({
      plays: p.data.map(
        (r): Play => ({
          id: r.id,
          userId,
          game: r.game,
          mode: r.mode,
          submode: r.submode ?? undefined,
          settings: r.settings,
          startedAt: ms(r.started_at)!,
          endedAt: ms(r.ended_at),
          status: r.status,
          score: r.score,
          seats: r.seats,
          standings: r.standings,
          pauses: 0,
          expEarned: r.exp_earned,
          resume: null,
          synced: true,
        }),
      ),
      items: it.data.map(
        (r): PlayItem => ({
          id: r.id,
          playId: r.play_id,
          seat: r.seat,
          itemId: r.item_id,
          answerKey: r.answer_key,
          outcome: r.outcome,
          answersGiven: r.answers_given,
          timeMs: r.time_ms,
          hintsUsed: r.hints_used,
          revealsUsed: r.reveals_used,
          points: r.points,
          feedsLearn: r.feeds_learn,
          gameData: r.game_data,
          at: ms(r.at)!,
        }),
      ),
    });
}

/** Stars, bests and stamps: merge this phone with the account (best wins), then save the result on both. */
async function syncProgress(userId: string) {
  const { data, error } = await supabase.from('player_progress').select('key,value');
  if (error) throw error;
  const remote = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const up: { user_id: string; key: string; value: unknown; updated_at: string }[] = [];
  for (const key of PROGRESS_KEYS) {
    const local = await engine.kv.get<unknown>(key);
    const merged = mergeProgress(key, local, remote.get(key));
    if (emptyProgress(merged)) continue;
    if (!sameProgress(merged, local)) await engine.kv.set(key, merged);
    if (!sameProgress(merged, remote.get(key))) up.push({ user_id: userId, key, value: merged, updated_at: new Date().toISOString() });
  }
  if (up.length) {
    const r = await supabase.from('player_progress').upsert(up);
    if (r.error) throw r.error;
  }
}
