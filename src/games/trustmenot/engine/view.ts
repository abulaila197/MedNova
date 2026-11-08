// What one phone is allowed to see. The server keeps the full game and sends each player this view,
// so hidden things (jewel counts, missions, votes, poisoned gifts) never reach other phones.
// Ghosts watch everything about living players (§8), mission cards included.

import { ghosts, itemPrice, mealPrice, timeLimitMs } from './game';
import type { Game, PlayerId, RoundRun } from './types';

export type PublicPlayer = {
  id: PlayerId;
  name: string;
  color: string;
  health: number;
  alive: boolean;
  diedMonth: number | null;
  fled: boolean;
  effects: Game['players'][number]['effects'];
  /** Only for yourself (or anyone, for a ghost). */
  jewels?: number;
  bag?: string[];
  lockBox?: boolean;
};

export function viewFor(g: Game, me: PlayerId) {
  const self = g.players.find((p) => p.id === me);
  if (!self) throw new Error(`unknown player ${me}`);
  const ghost = !self.alive;
  const sees = (id: PlayerId) => id === me || ghost;
  const roundOpen = g.round && !g.round.done;
  const soldThisMonth = g.log.filter((l) => l.kind === 'sold' && l.month === g.month).reduce((s, l) => s + (l.n ?? 0), 0);

  const players: PublicPlayer[] = g.players.map((p) => ({
    id: p.id, name: p.name, color: p.color, health: p.health, alive: p.alive, diedMonth: p.diedMonth, fled: p.fled,
    effects: p.effects,
    ...(sees(p.id) ? { jewels: p.jewels, bag: p.bag, lockBox: p.lockBox } : {}),
  }));

  const requests = g.requests
    .filter((r) => r.month === g.month)
    .map((r) => ({
      id: r.id, kind: r.kind, by: r.by, meal: r.meal, item: r.item, effect: r.effect, cost: r.cost, status: r.status,
      myVote: r.votes[me] ?? null,
    }));

  return {
    month: g.month,
    phase: g.phase,
    wallet: g.wallet,
    heat: g.heat,
    inquisitionOpen: g.inquisitionOpen,
    players,
    me: self.id,
    ghost,
    market: g.market.map((m) => ({ ...m, price: itemPrice(g, m.item) })),
    meals: (['scraps', 'basic', 'feast', 'skip'] as const).map((meal) => ({ meal, price: mealPrice(g, meal) })),
    requests,
    soldThisMonth,
    gifts: g.gifts.filter((x) => x.month === g.month && (x.from === me || x.to === me || x.shown || ghost)).map((x) => ({
      ...x,
      // The receiver never learns a gift is poisoned until it lands.
      poisoned: x.from === me || ghost ? x.poisoned : false,
    })),
    debts: g.debts.filter((d) => d.lender === me || d.borrower === me || ghost),
    snares: g.snares.filter((s) => s.by === me || (s.target === me && s.status === 'revealed')),
    missions: g.missions.filter((m) => sees(m.holder) || (m.holder !== me && ghost)),
    dealt: g.dealt.filter((d) => sees(d.player)),
    wild: g.wild.current,
    rumor: {
      shown: g.rumor.shownMonth === g.month ? { card: g.rumor.card, names: g.rumor.names } : null,
      myPen: g.rumor.pen === me,
    },
    lifeline: g.lifeline && g.lifeline.holder === me ? g.lifeline : null,
    squeeze: g.squeeze,
    round: g.round ? roundView(g, g.round, me, ghost, !!roundOpen) : null,
    whispersToMe: ghosts(g).flatMap((p) => p.whispers.filter((w) => w.to === me).map((w) => ({ month: w.month, text: w.text }))),
    log: g.log.filter((l) => !l.secret || l.by === me || l.to === me || ghost),
  };
}

function roundView(g: Game, r: RoundRun, me: PlayerId, ghost: boolean, open: boolean) {
  const mine = Object.entries(r.answers).filter(([k]) => k === me || k.startsWith(`${me}>`));
  const signalsForMe: Record<number, number | null> = {};
  for (const pr of r.pairs) if (pr.a === me && r.signals[pr.b]) r.signals[pr.b].forEach((c, i) => (signalsForMe[i] = c));
  return {
    id: r.id,
    stage: r.stage,
    // Questions carry the bank id only; the phone looks up the text. The right answer is sent once the round is done.
    questions: r.questions.map((q, i) => ({ id: q.id, answer: open && !ghost ? undefined : q.answer, limitMs: timeLimitMs(g, me, i) })),
    myAnswers: Object.fromEntries(mine),
    answers: open && !ghost ? undefined : r.answers,
    pairs: r.pairs,
    signals: signalsForMe,
    fog: r.fog,
    chosen: r.chosen,
    pot: Object.values(r.bids).reduce((s, x) => s + x, 0),
    myBid: r.bids[me] ?? 0,
    chainOrder: r.chainOrder,
    outcome: open ? {} : r.outcome,
  };
}
