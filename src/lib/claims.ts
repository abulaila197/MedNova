// Offline collecting (Yazan 2026-11-16): Inbox gifts, the daily reward and achievements can be collected without
// internet. The tokens show at once as a stand-in wallet row that is never uploaded; the collect itself waits here
// and goes to the server (the same calls as online, so the server checks everything) as soon as the internet is
// back. Then the stand-in is swapped for the server's own row, or taken back with a pop-up if the server said no.
// Sparks and chests from a gift arrive only once the server has it.
import { engine } from '@/games/engine';
import type { LedgerEntry } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { notice } from '@/components/Notice';
import { isOnline } from '@/lib/net';
import { supabase } from '@/lib/supabase';
import { refreshWallet } from '@/lib/sync';
import { tr } from '@/i18n';

export type Claim =
  | { id: string; kind: 'daily'; date: string; tokens: number }
  | { id: string; kind: 'inbox'; msg: string; tokens: number }
  | { id: string; kind: 'ach'; key: string; tier: number; steps: string[] | null; tokens: number };

type Saved = { list: Claim[]; tries: Record<string, number> };
const keyOf = (uid: string) => `claims:${uid}`;
const standIn = (c: Claim) => `pend:${c.id}`;
/** "Not yet" from the server (an achievement whose plays haven't gone up) is tried again this many times. */
const MAX_TRIES = 5;

async function read(uid: string): Promise<Saved> {
  return (await engine.kv.get<Saved>(keyOf(uid))) ?? { list: [], tries: {} };
}

/** What's waiting for the server, so the pages can show it as collected. */
export async function waitingClaims(uid: string) {
  return (await read(uid)).list;
}

/** Saves an offline collect and shows its tokens in the wallet right away. */
export async function queueClaim(uid: string, c: Claim) {
  const s = await read(uid);
  if (s.list.some((x) => x.id === c.id)) return;
  s.list.push(c);
  await engine.kv.set(keyOf(uid), s);
  if (c.tokens > 0) {
    const row: LedgerEntry = {
      id: standIn(c),
      kind: c.kind === 'daily' ? 'daily' : c.kind === 'ach' ? 'achievement' : 'grant',
      exp: 0,
      tokens: c.tokens,
      // The same reason the server writes, so the calendar and the achievement tiers count it as done.
      reason: c.kind === 'daily' ? `day:${c.date}` : c.kind === 'ach' ? `ach:${c.key}:${c.tier}` : `inbox:${c.msg}`,
      note: 'waiting for the server',
      at: Date.now(),
      synced: true, // never uploaded: the server writes its own row
    };
    await engine.wallet.mergeRemote([row]);
  }
}

async function send(c: Claim): Promise<'ok' | 'no' | 'later' | 'net'> {
  const { data, error } =
    c.kind === 'daily'
      ? await supabase.rpc('daily_claim', { local_date: c.date })
      : c.kind === 'inbox'
        ? await supabase.rpc('inbox_collect', { msg: c.msg })
        : await supabase.rpc('achievement_collect', { key: c.key, tier: c.tier, steps: c.steps });
  if (error || !data) return 'net';
  const r = data as { ok?: boolean; why?: string };
  if (r.ok || r.why === 'done') return 'ok';
  if (c.kind === 'ach' && (r.why === 'not yet' || r.why === 'order')) return 'later';
  return 'no';
}

let flushing: Promise<void> | null = null;
/** Sends what was collected offline, oldest first. Safe to call often. */
export function flushClaims(uid: string) {
  flushing ??= (async () => {
    const s = await read(uid);
    if (!s.list.length || !isOnline()) return;
    const done: Claim[] = [];
    const refused: Claim[] = [];
    for (const c of s.list) {
      const r = await send(c).catch(() => 'net' as const);
      if (r === 'net') break;
      if (r === 'ok') done.push(c);
      else if (r === 'no') refused.push(c);
      else {
        s.tries[c.id] = (s.tries[c.id] ?? 0) + 1;
        if (s.tries[c.id] >= MAX_TRIES) refused.push(c);
      }
    }
    const gone = new Set([...done, ...refused].map((c) => c.id));
    if (!gone.size) return void (await engine.kv.set(keyOf(uid), s));
    const rest = s.list.filter((c) => !gone.has(c.id));
    for (const id of gone) delete s.tries[id];
    await engine.kv.set(keyOf(uid), { list: rest, tries: s.tries });
    // The server's rows come down first, then the stand-ins go, so the balance never dips in between.
    await refreshWallet(uid).catch(() => {});
    await engine.wallet.drop([...done, ...refused].map(standIn));
    if (useSession.getState().userId !== uid) return;
    const back = refused.reduce((n, c) => n + c.tokens, 0);
    if (refused.length)
      notice({
        kick: tr('NOT ADDED'),
        title: tr('Some rewards weren’t added'),
        line: back
          ? tr('The server didn’t accept {n} of what you collected offline, so {t} tokens were taken back. It was already collected, or the phone’s date was off.', { n: refused.length, t: back })
          : tr('The server didn’t accept {n} of what you collected offline. It was already collected, or the phone’s date was off.', { n: refused.length }),
      });
  })().finally(() => (flushing = null));
  return flushing;
}

/** Deleting the account drops what it had waiting. */
export async function dropClaims(uid: string) {
  await engine.kv.remove(keyOf(uid));
}
