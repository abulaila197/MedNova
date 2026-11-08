// What The Conqueror's online screen shows of the clock, so it redraws only when that changes (not 4 times a second).
import { BALANCE } from './core';

/** The clue ladder's clue on show `elapsedMs` into the stage (the server works it out the same way, online.ts). */
export const cluesShown = (elapsedMs: number) => Math.min(4, 1 + Math.floor(elapsedMs / (BALANCE.CLUE_INTERVAL_SECONDS * 1000)));

type Shape = {
  phase: string;
  phase_ends_at: number;
  state: { m: { phase: string; versus?: { style: string } | null }; deadline: number | null; started: number; holds: { until: number }[] } | null;
};

/**
 * Everything on screen that moves with the clock at server time `sv`: the wax seal's whole seconds (and its hot
 * state, which flips with them), the hold page and its seconds, the match countdown and the clue on show. Once a
 * clock has run out every tick counts again, so the phones keep nudging the referee until it moves on.
 */
export function conquerorShown(sv: number, st: Shape | null) {
  if (!st) return null;
  const o = st.state;
  const due = o ? o.deadline : st.phase_ends_at;
  if (st.phase !== 'done' && due != null && sv >= due) return sv;
  if (!o) return `c${Math.ceil((st.phase_ends_at - sv) / 1000)}`;
  const hold = o.holds.findIndex((h) => h.until > sv);
  const seal = o.deadline ? Math.ceil(Math.max(0, o.deadline - sv) / 1000) : '';
  const holdSec = hold >= 0 ? Math.ceil(Math.max(0, o.holds[hold].until - sv) / 1000) : '';
  const clue = o.m.phase === 'versus' && o.m.versus?.style === 'clue' ? cluesShown(Math.max(0, sv - o.started)) : '';
  return `${seal}|${hold}:${holdSec}|${clue}`;
}
