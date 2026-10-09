// The Wheels of Chaos Online (WC20-WC23): the Pass the phone game run by the server (ON17), one phone per player.
// Players take turns while the room watches (WC20). Every wait has a deadline so an idle phone never stalls the
// show: an attack lands after 15 s without an answer (WC21), and the other waits use the times below. The Boss
// Round is played by everyone at once, each on their own phone (WC23). The same code runs on the server, so it
// draws from the answer keys (keys.ts) and never needs the full bank.
import type { Play, Reaction } from './cards';
import { type Answer, type Mix, type Rng, type Target } from './core';
import { actor, closeBoss, startOffline, stepOffline, BOSS_MS, type FullBank, type OfflineEvent, type OfflineGame } from './offline';

export const ONLINE_MS = {
  /** A seat's card window. */
  init: 15_000,
  /** WC21: time to answer a card attack before it lands. */
  react: 15_000,
  /** The World's Redemption offer. */
  offer: 10_000,
  /** The wheels spin on every phone; the player's phone moves on when they stop, this is the fallback. */
  reveal: 5_000,
  /** The Redemption rules card before the calls start. */
  redReveal: 8_000,
  turnOver: 4_500,
  /** Everyone reads the Boss category, then the swiping starts on every phone at once. */
  bossReady: 6_000,
  bossOver: 8_000,
};
/** An answer this late after its timer still counts: the network takes a moment. */
export const GRACE_MS = 700;

export type OnlineWheels = {
  /** The bank version the game was started with (keys.ts). */
  v: string;
  g: OfflineGame;
  /** When the current wait runs out, in server time. */
  deadline: number | null;
  /** What the deadline belongs to; a change starts a new wait. */
  key: string;
};

/** What a phone may send. The server stamps the time. */
export type Move =
  | { type: 'PLAY'; play: Play }
  | { type: 'PASS' }
  | { type: 'REACT'; choice: Reaction | null; to?: number }
  | { type: 'REDEEM'; use: boolean }
  | { type: 'GO' }
  | { type: 'STAR' }
  | { type: 'KEEP' }
  | { type: 'ANSWER'; answer: Answer }
  | { type: 'CALL'; value: boolean }
  | { type: 'TICK' };

/** Seats that left, and each seat's Boss swipes so far (sent one by one to the server). */
export type Outside = { dropped: number[]; swipes: Record<number, boolean[]> };

function waitKey(g: OfflineGame): string {
  const t = g.turn;
  return [
    g.phase, actor(g), g.cycle, g.round, g.init.at, g.init.plays, g.attacks.length,
    g.chain ? `${g.chain.attack.by}>${g.chain.attack.target}.${g.chain.steps.length}.${g.chain.holder}.${g.chain.cleanup}` : '',
    t ? `${g.turnAt}.${t.k}.${t.phase}.${t.star}` : '', g.redemption?.phase ?? '', g.boss?.phase ?? '',
  ].join('|');
}

function waitFor(g: OfflineGame): number | null {
  switch (g.phase) {
    case 'initiation': return ONLINE_MS.init;
    case 'reaction': return ONLINE_MS.react;
    case 'redemptionOffer': return ONLINE_MS.offer;
    case 'turn': return g.turn?.phase === 'reveal' ? ONLINE_MS.reveal : null;
    case 'redemption': return g.redemption?.phase === 'reveal' ? ONLINE_MS.redReveal : null;
    case 'boss': return g.boss?.phase === 'ready' ? ONLINE_MS.bossReady : null;
    case 'turnOver': return ONLINE_MS.turnOver;
    case 'bossOver': return ONLINE_MS.bossOver;
    default: return null;
  }
}

/** Starts a new wait when the game moved on. Online, nobody holds the Boss Round: everyone swipes at once. */
function settle(o: OnlineWheels, now: number): OnlineWheels {
  let g = o.g;
  if (g.phase === 'boss' && g.boss && g.boss.at < g.boss.order.length) g = { ...g, boss: { ...g.boss, at: g.boss.order.length } };
  const key = waitKey(g);
  if (key === o.key) return g === o.g ? o : { ...o, g };
  const w = waitFor(g);
  return { ...o, g, key, deadline: w == null ? null : now + w };
}

/** The next moment the server must step in, or null when it waits for nothing. */
export function dueOf(o: OnlineWheels): number | null {
  const g = o.g;
  switch (g.phase) {
    case 'turn': return g.turn?.phase === 'reveal' ? o.deadline : (g.turn?.until ?? null);
    case 'redemption': return g.redemption?.phase === 'reveal' ? o.deadline : (g.redemption?.until ?? null);
    case 'boss': return g.boss?.phase === 'ready' ? o.deadline : (g.boss?.until ?? null);
    case 'done': return null;
    default: return o.deadline;
  }
}

const bossDone = (g: OfflineGame, swipes: Outside['swipes']) =>
  !!g.boss && g.active.every((s) => (swipes[s]?.length ?? 0) >= g.boss!.items.length);

function closeOnline(g: OfflineGame, swipes: Outside['swipes']): OfflineGame {
  const b = g.boss!;
  const mine: Record<number, boolean[]> = {};
  for (const s of b.order) mine[s] = (swipes[s] ?? []).slice(0, b.items.length);
  return closeBoss({ ...g, boss: { ...b, swipes: mine, until: null } });
}

/** What happens when a wait runs out at time t. */
function timeout(g: OfflineGame, t: number, bank: FullBank, rng: Rng, swipes: Outside['swipes']): OfflineGame {
  const step = (e: OfflineEvent) => stepOffline(g, e, bank, rng);
  switch (g.phase) {
    case 'initiation': return step({ type: 'PASS' });
    case 'reaction': return step({ type: 'REACT', choice: null });
    case 'redemptionOffer': return step({ type: 'REDEEM', use: false });
    case 'turn': return step({ type: 'TURN', e: { type: g.turn?.phase === 'reveal' ? 'GO' : 'TICK', now: t } });
    case 'redemption': return step({ type: 'RED', e: { type: g.redemption?.phase === 'reveal' ? 'GO' : 'TICK', now: t } });
    case 'turnOver': case 'bossOver': return step({ type: 'NEXT' });
    case 'boss':
      if (g.boss!.phase === 'ready') return { ...g, boss: { ...g.boss!, phase: 'playing', until: t + BOSS_MS } };
      return closeOnline(g, swipes);
    default: return g;
  }
}

/** Plays every wait that has run out by `now`, each at the moment it ran out. */
function catchUp(o: OnlineWheels, now: number, bank: FullBank, rng: Rng, swipes: Outside['swipes']): OnlineWheels {
  let s = o;
  for (let i = 0; i < 200 && s.g.phase !== 'done'; i++) {
    if (s.g.phase === 'boss' && s.g.boss?.phase === 'playing' && bossDone(s.g, swipes)) {
      s = settle({ ...s, g: closeOnline(s.g, swipes) }, now);
      continue;
    }
    const due = dueOf(s);
    if (due == null || due > now) break;
    const g = timeout(s.g, due, bank, rng, swipes);
    if (g === s.g) break;
    s = settle({ ...s, g }, due);
  }
  return s;
}

export function startOnline(seats: number, target: Target, mix: Mix, v: string, bank: FullBank, rng: Rng, now: number): OnlineWheels {
  return settle({ v, g: startOffline(seats, target, bank, rng, mix), deadline: null, key: '' }, now);
}

function toEvent(m: Move, g: OfflineGame, now: number): OfflineEvent | null {
  switch (m.type) {
    case 'PLAY': return { type: 'PLAY', play: m.play };
    case 'PASS': return { type: 'PASS' };
    case 'REACT': return { type: 'REACT', choice: m.choice, to: m.to };
    case 'REDEEM': return { type: 'REDEEM', use: m.use };
    case 'GO': return g.phase === 'redemption' ? { type: 'RED', e: { type: 'GO', now } } : { type: 'TURN', e: { type: 'GO', now } };
    case 'STAR': return { type: 'TURN', e: { type: 'STAR', now } };
    case 'KEEP': return { type: 'TURN', e: { type: 'KEEP', now } };
    case 'ANSWER': return { type: 'TURN', e: { type: 'ANSWER', answer: m.answer, now } };
    case 'CALL': return { type: 'RED', e: { type: 'ANSWER', value: m.value, now } };
    default: return null;
  }
}

/**
 * One request to the referee: drops seats that left, plays out the waits that ran out, then the seat's move if it
 * is theirs to make. Returns the same object when nothing changed.
 */
export function stepOnline(o: OnlineWheels, m: Move, seat: number | null, out: Outside, bank: FullBank, rng: Rng, now: number): OnlineWheels {
  let s = o;
  for (const d of out.dropped) if (s.g.active.includes(d) && s.g.phase !== 'done') s = settle({ ...s, g: stepOffline(s.g, { type: 'REMOVE', seat: d }, bank, rng) }, now);
  if (m.type !== 'TICK' && seat != null) {
    s = catchUp(s, now - GRACE_MS, bank, rng, out.swipes);
    const e = s.g.phase === 'done' || actor(s.g) !== seat ? null : toEvent(m, s.g, now);
    if (e) {
      const g = stepOffline(s.g, e, bank, rng);
      if (g !== s.g) s = settle({ ...s, g }, now);
    }
  }
  return catchUp(s, now, bank, rng, out.swipes);
}

/** Final places: winners first, then by score; seats that left come last. */
export function onlineRanks(g: OfflineGame): number[] {
  const winners = g.result?.winners ?? [];
  const key = (s: number) => (g.active.includes(s) ? 0 : 2e9) - (winners.includes(s) ? 1e9 : 0) - g.scores[s];
  return Array.from({ length: g.seats }, (_, s) => 1 + Array.from({ length: g.seats }, (_, x) => x).filter((x) => key(x) < key(s)).length);
}
