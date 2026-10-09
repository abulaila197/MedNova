// Phone <-> account sync (rule 19). The phone stays the first copy; this uploads what is new
// and brings down what another phone saved, so EXP, tokens and misses follow the player.
import { engine } from '@/games/engine';
import type { LedgerEntry, Play, PlayItem } from '@/games/engine';

import { supabase } from './supabase';

const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
const ms = (s: string | null) => (s == null ? null : Date.parse(s));

let running: Promise<void> | null = null;

/** Claims guest plays, uploads unsynced rows, then merges the account's rows into the phone. Safe to call often. */
export function syncAccount(userId: string) {
  running ??= run(userId).finally(() => (running = null));
  return running;
}

async function run(userId: string) {
  await engine.recorder.claimGuestPlays(userId);

  const { plays, items } = await engine.recorder.unsynced(userId);
  if (plays.length) {
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
    if (items.length) {
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
    await engine.recorder.markSynced(plays.map((p) => p.id));
  }

  const ledger = await engine.wallet.unsynced();
  if (ledger.length) {
    const { error } = await supabase.from('wallet_ledger').upsert(
      ledger.map((e) => ({ id: e.id, user_id: userId, kind: e.kind, exp: e.exp, tokens: e.tokens, reason: e.reason, play_id: e.playId ?? null, at: iso(e.at) })),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw error;
    await engine.wallet.markSynced(ledger.map((e) => e.id));
  }

  // Bring down what other phones saved.
  const [w, p, it] = await Promise.all([
    supabase.from('wallet_ledger').select('id,kind,exp,tokens,reason,play_id,at').order('at').limit(5000),
    supabase.from('plays').select('*').eq('status', 'finished').order('started_at', { ascending: false }).limit(1000),
    supabase.from('play_items').select('*').order('at', { ascending: false }).limit(5000),
  ]);
  if (w.data)
    await engine.wallet.mergeRemote(
      w.data.map((e): LedgerEntry => ({ id: e.id, kind: e.kind, exp: e.exp, tokens: e.tokens, reason: e.reason, playId: e.play_id ?? undefined, at: ms(e.at)!, synced: true })),
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
