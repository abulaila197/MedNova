// What one player's phone may see of a Conqueror match. The server keeps the whole match and saves one view per
// player after every change; phones only ever read their own view. Right answers stay on the server until they
// are judged, rivals' cards, reserves, orders and hidden troop counts stay secret (Spy, CQ14, opens reserves and
// played cards), and the numbers on the board don't say what hides behind them.
import type { MatchQ, OrderQ, SoloQ } from './bank';
import { shuffle } from '../engine/random';
import { spyView, type March, type Match, type Player, type SoloTurn, type VersusStyle } from './core';

/** A short screen between phases (online.ts): intro, solo tally, versus intro and results, battle report. */
export type Hold = {
  kind: 'start' | 'soloResult' | 'versusIntro' | 'versusResult' | 'battle';
  until: number;
  /** What happened, for the battle report. */
  log?: string[];
  /** The marches the battle motion plays (all of them on the server; each phone gets marchesFor its player). */
  marches?: MarchView[];
  /** My judged tile, for the solo result (filled in per player by the view). */
  solo?: SoloTurn | null;
  /** The versus style coming up. */
  style?: VersusStyle;
};

/** A march as one phone sees it: `by` null is a rival's failed attack, shown only as a clash at the land. */
export type MarchView = Omit<March, 'by' | 'troops'> & { by: string | null; troops?: number };

/**
 * Keep secret (Yazan 2026-10-14): my own marches play in full, every capture and duel plays, a rival's failed
 * attack shows only a clash at the land (no attacker, no arrow), and rivals' reinforcements stay hidden. Troop
 * numbers only travel with my own marches.
 */
export function marchesFor(list: March[], me: string): MarchView[] {
  const out: MarchView[] = [];
  for (const x of list) {
    if (x.by === me) out.push(x);
    else if (x.kind === 'won' || x.kind === 'duel') out.push({ by: x.by, from: x.from, to: x.to, kind: x.kind, was: x.was });
  }
  for (const x of list)
    if (x.by !== me && x.kind === 'held' && !out.some((y) => y.to === x.to && y.kind !== 'add'))
      out.push({ by: null, from: null, to: x.to, kind: 'held', was: x.was });
  return out;
}

/** Shown in place of a secret number. */
export const SECRET = -1;

/** A solo question as the phone gets it: no right answer until the tile is judged; Order and Match come shuffled. */
export type SoloView = SoloQ & { shown?: string[] };

export type MatchView = Match & {
  /** Set for the viewer's own player id. */
  me: string;
  /** Rivals' reserves and the cards they played this Gap, when the viewer played Spy. */
  spy: { reserves: Record<string, number>; cards: Match['gap']['cards'] } | null;
  /** Rush: how many answers the list holds. */
  rushTotal?: number;
};

const seeded = (text: string) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function soloQuestion(q: SoloQ, judged: boolean, salt: string): SoloView {
  if (judged) {
    if (q.style === 'order') return { ...q, shown: shuffle((q as OrderQ).items, seeded(salt)) };
    if (q.style === 'match') return { ...q, shown: shuffle((q as MatchQ).pairs.map((p) => p[1]), seeded(salt)) };
    return q;
  }
  switch (q.style) {
    case 'mcq':
      return { ...q, answer: SECRET };
    case 'tf':
      return { ...q, answer: false, explanation: undefined };
    case 'order':
      return { ...q, items: [], shown: shuffle(q.items, seeded(salt)) };
    case 'match':
      return { ...q, pairs: q.pairs.map(([l]) => [l, ''] as [string, string]), shown: shuffle(q.pairs.map((p) => p[1]), seeded(salt)) };
  }
}

function soloTurn(t: SoloTurn, mine: boolean, salt: string): SoloTurn {
  if (!mine) return { tile: t.tile, questions: [], result: t.result };
  return { ...t, questions: t.questions.map((q, i) => soloQuestion(q, !!t.result, `${salt}.${i}`)) };
}

export function viewFor(m: Match, me: string): MatchView {
  const spy = spyView(m, me);
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(m.players)) {
    players[id] = id === me ? p : { ...p, reserve: spy?.reserves[id] ?? SECRET, cards: p.cards.map(() => 'spy' as const) };
  }
  const lands = Object.fromEntries(
    Object.entries(m.lands).map(([id, l]) => [
      id,
      l.owner === me ? l : { ...l, troops: l.hidden ? SECRET : l.troops, shielded: false, trapped: false },
    ]),
  );
  const v = m.versus;
  let versus = v;
  let rushTotal: number | undefined;
  if (v?.style === 'closest') versus = { ...v, items: v.items.map((q) => ({ ...q, answer: SECRET })), guesses: { [me]: v.guesses[me] ?? [] } };
  else if (v?.style === 'rush') {
    rushTotal = v.q.answers.length;
    versus = { ...v, q: { ...v.q, answers: [] }, found: Object.fromEntries(Object.entries(v.found).map(([id, f]) => [id, id === me ? f : f.map((x) => ({ label: '', ms: x.ms }))])) };
  } else if (v?.style === 'standing')
    versus = {
      ...v,
      qs: v.qs.map((q, i) => (i < v.index ? q : i === v.index ? { ...q, answers: [] } : { ...q, prompt: '', options: [], answers: [] })),
      answers: Object.fromEntries(Object.entries(v.answers).map(([id, a]) => [id, id === me ? a : { picks: [], ms: 0 }])),
    };
  else if (v?.style === 'clue') versus = { ...v, qs: v.qs.map((q) => ({ ...q, answer: { label: '' } })) };
  return {
    ...m,
    me,
    spy,
    marches: undefined,
    rushTotal,
    players,
    lands,
    board: m.board.map((t) => (t.by ? t : { n: t.n, kind: 'question' as const, by: null })),
    solo: Object.fromEntries(Object.entries(m.solo).map(([id, t]) => [id, soloTurn(t, id === me, `${m.stage}.${m.round}.${id}`)])),
    versus,
    gap: {
      cards: m.gap.cards.filter((c) => c.by === me || c.player === me || (spy && c.card !== 'spy')),
      proposals: m.gap.proposals.filter((x) => x.from === me || x.to === me),
      moves: Object.fromEntries(Object.entries(m.gap.moves).filter(([id]) => id === me)),
      ready: m.gap.ready,
    },
    duels: m.duels.map((d, i) => (i < m.duelIndex ? d : { ...d, questions: d.questions.map((q) => ({ ...q, answer: false })) })),
    lastSolo: m.lastSolo?.[me] ? { [me]: soloTurn(m.lastSolo[me], true, 'last') } : {},
    used: [],
  };
}

/** One player's copy of the online match: their view, the clock, and the screens between phases. */
export function envelopeFor<O extends { m: Match; deadline: number | null; started: number; holds: Hold[] }>(o: O, me: string) {
  const m = viewFor(o.m, me);
  return {
    m,
    deadline: o.deadline,
    started: o.started,
    holds: o.holds.map((h) => (h.kind === 'soloResult' ? { ...h, solo: m.lastSolo?.[me] ?? null } : h.marches ? { ...h, marches: marchesFor(h.marches as March[], me) } : h)),
  };
}
