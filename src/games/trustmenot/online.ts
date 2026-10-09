// Trust Me Not online: the year run by the server (rule book §10). The engine is one pure reducer; this file adds
// the clocks (opening, the two Gap steps, each round stage, the ledger), the careful bot that stands in for a
// disconnected player, and each phone's own envelope. The same code runs in the 'trust-me-not' edge function.
import {
  allSkipped, awards, botActions, createGame, epilogue, exp, gapSeconds, learnFeed, living, ranking, rules as R, starsFor,
  step, timeLimitMs, viewFor, type Action, type Field, type Game, type PlayerId, type QuestionPools,
} from './engine';
import { extrasFor } from './extras';

/** Server bank rows: [id, right choice, season 1-4, 0 basic / 1 clinical]. */
export type BankRow = [string, number, number, number];

export const OPENING_MS = 7000;
export const LEDGER_MS = 15000;
/** Ledgers that end a season ask everyone for trust stars. */
export const STARS_LEDGER_MS = 40000;
export const PICK_MS = 20000;
export const BID_MS = 20000;
/** Phones answer one question after another; this covers the network between them. */
export const GRACE_MS = 1500;
/** The stand-in for a disconnected player (§10): careful, never betrays. */
export const CAREFUL_BOT = { skill: 0.6, betrays: false };

export type OnlineTmn = {
  g: Game;
  /** When the current phase or stage ends on its own. */
  deadline: number | null;
  started: number;
  key: string;
  /** Players who pressed Continue on the opening or the ledger. */
  ready: PlayerId[];
};

export function poolsFor(bank: BankRow[], field: Field): QuestionPools {
  const pools: QuestionPools = { 1: [], 2: [], 3: [], 4: [] };
  for (const [id, answer, d, f] of bank) {
    if (field === 'basic' && f !== 0) continue;
    if (field === 'clinical' && f !== 1) continue;
    pools[d as 1 | 2 | 3 | 4].push({ id, answer });
  }
  return pools;
}

const keyOf = (g: Game) => [g.phase, g.month, g.round?.id ?? '', g.round?.stage ?? ''].join('|');

/** Longest a round's answering can take: every question at the slowest player's clock, one after another. */
function playMs(g: Game): number {
  const r = g.round!;
  const lv = living(g);
  let ms = 0;
  for (let q = 0; q < r.questions.length; q++) ms += Math.max(R.MIN_TIMER_MS, ...lv.map((p) => timeLimitMs(g, p.id, q)));
  return ms + GRACE_MS;
}

export function phaseMs(g: Game): number | null {
  switch (g.phase) {
    case 'opening': return OPENING_MS;
    case 'gap1': return gapSeconds(g)[0] * 1000;
    case 'gap2': return gapSeconds(g)[1] * 1000;
    case 'round': return g.round?.stage === 'pick' ? PICK_MS : g.round?.stage === 'bid' ? BID_MS : playMs(g);
    case 'ledger': return g.month % 3 === 0 ? STARS_LEDGER_MS : LEDGER_MS;
    default: return null;
  }
}

/** Everyone who must answer this round has answered every question they hold. */
export function roundAnswered(g: Game): boolean {
  const r = g.round;
  if (!r || r.stage !== 'play') return false;
  const n = r.questions.length;
  const full = (k: string) => (r.answers[k] ?? []).filter(Boolean).length >= n;
  const alive = (id: PlayerId) => g.players.find((p) => p.id === id)?.alive;
  if (r.id === 'hero' || r.id === 'supplier') return !r.chosen || !alive(r.chosen) || full(r.chosen);
  if (r.id === 'chain') return r.chainOrder.every((id, q) => !alive(id) || !!r.answers[id]?.[q]);
  if (r.id === 'hands') return r.pairs.every((pr) => !alive(pr.b) || full(`${pr.b}>${pr.a}`));
  if (r.id === 'whisperer') return r.pairs.every((pr) => !alive(pr.a) || full(pr.a));
  return living(g).every((p) => full(p.id));
}

const away = (g: Game, id: PlayerId) => g.players.find((p) => p.id === id)?.disconnectedSince != null;
const seedOf = (id: string) => [...id].reduce((s, c) => (Math.imul(s, 31) + c.charCodeAt(0)) | 0, 7);

/** The careful bot plays this phase for a disconnected player; in the Gap it also presses Skip. */
function playBot(g: Game, id: PlayerId): Game {
  const p = g.players.find((x) => x.id === id);
  if (!p || p.fled || g.phase === 'opening' || g.phase === 'over') return g;
  let s = g;
  for (const a of botActions(s, id, CAREFUL_BOT, seedOf(id))) s = step(s, a);
  if (p.alive && (s.phase === 'gap1' || s.phase === 'gap2')) s = step(s, { type: 'SKIP', player: id });
  return s;
}

/** Ready to move on before the clock: everyone skipped, answered, or pressed Continue. */
function finishedEarly(o: OnlineTmn): boolean {
  const g = o.g;
  if (g.phase === 'gap1' || g.phase === 'gap2') return allSkipped(g);
  if (g.phase === 'round') return roundAnswered(g);
  if (g.phase === 'opening' || g.phase === 'ledger') {
    const waiting = living(g).filter((p) => !away(g, p.id));
    return waiting.length > 0 && waiting.every((p) => o.ready.includes(p.id));
  }
  return false;
}

/** New clock when the game moved on; the bot plays the new phase for anyone disconnected. */
function settle(o: OnlineTmn, now: number): OnlineTmn {
  let s = o;
  for (let i = 0; i < 20; i++) {
    const key = keyOf(s.g);
    if (key !== s.key) {
      let g = s.g;
      for (const p of g.players) if (p.disconnectedSince != null) g = playBot(g, p.id);
      const ms = phaseMs(g);
      s = { g, key, ready: [], started: now, deadline: ms == null ? null : now + ms };
      continue;
    }
    if (s.g.phase === 'over' || !finishedEarly(s)) break;
    s = { ...s, g: step(s.g, { type: 'ADVANCE' }) };
  }
  return s;
}

export function startOnline(players: { id: string; name: string; color: string }[], field: Field, bank: BankRow[], seed: number, now: number): OnlineTmn {
  const g = createGame({ seed, field, players, pools: poolsFor(bank, field) });
  return { g, key: keyOf(g), ready: [], started: now, deadline: now + OPENING_MS };
}

/** Plays every clock that has run out by `now`, each at the moment it ran out. */
function catchUp(o: OnlineTmn, now: number): OnlineTmn {
  let s = o;
  for (let i = 0; i < 60 && s.g.phase !== 'over' && s.deadline != null && s.deadline <= now; i++) {
    const at = s.deadline;
    const next = step(s.g, { type: 'ADVANCE' });
    if (next === s.g) break;
    s = settle({ ...s, g: next }, at);
  }
  return s;
}

/** What a phone may send: an engine action without the player (the server fills in who sent it), or Continue. */
export type PhoneAction = { type: string; [k: string]: unknown };

const PHONE_TYPES = new Set([
  'SKIP', 'BUY_FOOD', 'BUY_ITEM', 'SELL', 'GIFT', 'GIFT_REPLY', 'LEND', 'CALL_DEBT', 'REPAY', 'TREAT', 'MERCY', 'LANTERN',
  'SKIM', 'STEAL', 'WHISPER', 'RUMOR', 'LAST_SUPPER', 'DOCTOR_CHIP', 'PAY_WOLVES', 'VOTE', 'ACCUSE', 'COLD_SHOULDER',
  'ANSWER', 'SIGNAL', 'PICK', 'BID', 'SUPPLIER_SKIM', 'FOG', 'USE_ITEM', 'STARS', 'BELIEVED', 'QUIT',
]);
const NUMBERS = ['jewels', 'coins', 'q', 'choice', 'share', 'card', 'whisperMonth', 'ms'];

/** The phone's action with its sender; numbers made numbers, text kept short, answer times kept inside the clock. */
function stamp(g: Game, a: PhoneAction, me: PlayerId): Action | null {
  if (!PHONE_TYPES.has(a.type)) return null;
  const out: Record<string, unknown> = { ...a, player: me };
  for (const k of NUMBERS) if (k in out && out[k] !== null) out[k] = Number(out[k]) || 0;
  if (typeof out.text === 'string') out.text = out.text.slice(0, 140);
  if (a.type === 'ANSWER' && g.round) out.ms = Math.min(timeLimitMs(g, me, Number(out.q)), Math.max(0, Number(out.ms) || 0));
  if (a.type === 'STARS' && (typeof out.ratings !== 'object' || !out.ratings)) return null;
  return out as Action;
}

/**
 * One request to the referee: marks who has left or come back, plays out the clocks that ran out, then the
 * player's action. Returns the same object when nothing changed.
 */
export function stepOnline(o: OnlineTmn, a: PhoneAction | null, me: PlayerId | null, gone: PlayerId[], now: number): OnlineTmn {
  let s = o;
  for (const p of s.g.players) {
    if (p.fled) continue;
    const off = gone.includes(p.id);
    if (off && p.disconnectedSince == null) {
      const g = playBot(step(s.g, { type: 'DISCONNECT', player: p.id }), p.id);
      s = settle({ ...s, g }, now);
    } else if (!off && p.disconnectedSince != null) s = { ...s, g: step(s.g, { type: 'RECONNECT', player: p.id }) };
  }
  if (a && me && a.type !== 'tick') {
    s = catchUp(s, now - GRACE_MS);
    if (a.type === 'ready') {
      if ((s.g.phase === 'opening' || s.g.phase === 'ledger') && !s.ready.includes(me)) s = settle({ ...s, ready: [...s.ready, me] }, now);
    } else {
      const act = stamp(s.g, a, me);
      const next = act ? step(s.g, act) : s.g;
      if (next !== s.g) {
        // A stethoscope adds 10 seconds to one question, so the round clock waits for it.
        const extra = act?.type === 'USE_ITEM' && act.item === 'stethoscope' && s.deadline != null ? R.STETHOSCOPE_MS : 0;
        s = settle({ ...s, g: next, deadline: s.deadline == null ? null : s.deadline + extra }, now);
      }
    }
  }
  return catchUp(s, now);
}

/** Places for the room's results: survivors by score, then ghosts, the last to fall first. */
export function finalOrder(g: Game): { id: PlayerId; score: number }[] {
  const dead = g.players.filter((p) => !p.alive).sort((a, b) => (b.diedMonth ?? 0) - (a.diedMonth ?? 0));
  return [...ranking(g), ...dead.map((p) => ({ id: p.id, score: 0 }))];
}

/** The next moment the server must step in. */
export const dueOf = (o: OnlineTmn) => (o.g.phase === 'over' ? null : o.deadline);

/** Right answers so far in a team-target round, against the camp's target (shown live on the round page). */
export function campTally(g: Game) {
  const r = g.round;
  if (!r || R.ROUNDS[r.id].mode !== 'team-target') return null;
  const lv = living(g);
  let done = 0;
  for (const p of lv) (r.answers[p.id] ?? []).forEach((x, q) => (done += x && x.choice === r.questions[q].answer ? 1 : 0));
  const max = lv.length * r.questions.length;
  return { done, target: Math.ceil(R.TEAM_TARGET * max), max };
}

/** One phone's envelope: its own view plus the clock, the camp tally and, at the end, the reveal. */
export function envelopeFor(o: OnlineTmn, me: PlayerId) {
  const g = o.g;
  const over = g.phase === 'over';
  return {
    deadline: o.deadline,
    started: o.started,
    ready: o.ready,
    view: viewFor(g, me),
    plan: g.plan,
    camp: campTally(g),
    extras: extrasFor(g, me),
    reveal: over
      ? {
          ranking: ranking(g),
          awards: awards(g),
          epilogue: epilogue(g, me),
          exp: exp(g, me),
          missed: learnFeed(g, me),
          stars: Object.fromEntries(g.players.map((p) => [p.id, starsFor(g, p.id)])),
          missions: g.missions,
          log: g.log,
        }
      : null,
  };
}

/** Spectators see only what everyone in the camp sees. */
export function watcherEnvelope(o: OnlineTmn) {
  const g = o.g;
  return {
    deadline: o.deadline,
    started: o.started,
    watcher: true,
    view: {
      month: g.month,
      phase: g.phase,
      players: g.players.map((p) => ({ id: p.id, name: p.name, color: p.color, health: p.health, alive: p.alive, diedMonth: p.diedMonth, fled: p.fled })),
      round: g.round ? { id: g.round.id, stage: g.round.stage } : null,
    },
  };
}

export type TmnEnvelope = ReturnType<typeof envelopeFor>;
export type TmnView = TmnEnvelope['view'];
