// Bot players: the careful stand-in for a disconnected player (§10: never betrays, its missions fail)
// and the test bots that play thousands of games to check the rules and the economy.

import * as R from './rules';
import { curable, itemPrice, living, mealPrice, player, season } from './game';
import type { Action, EffectId, Game, PlayerId } from './types';

export type BotStyle = {
  /** Chance of a right answer in Autumn; later seasons are a little harder. */
  skill: number;
  /** Carries out betrayal missions (false = the careful disconnect bot). */
  betrays: boolean;
};

const SEASON_DROP = [0, 0.03, 0.07, 0.1];
const DAMAGING: EffectId[] = ['snakebite', 'dog-bite', 'poisoned', 'anemic', 'rat-bite'];

/** Bots draw from their own stream so they never disturb the game's seeded random. */
function botRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
    t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
}

export function botActions(g: Game, id: PlayerId, style: BotStyle, seed: number): Action[] {
  const r = botRng(seed ^ (g.month * 7919) ^ g.nextId);
  const p = player(g, id);
  const out: Action[] = [];
  const s = season(g);
  const myMission = (k: string) => g.missions.find((m) => m.holder === id && m.id === k && m.status === 'active');

  if (g.phase === 'gap1') {
    if (!p.alive) {
      const lv = living(g);
      if (lv.length && r() < 0.6) out.push({ type: 'WHISPER', player: id, to: lv[Math.floor(r() * lv.length)].id, text: 'Trust no one.' });
      return out;
    }
    if (p.health <= R.MERCY_AT && !p.mercyUsed) out.push({ type: 'MERCY', player: id });
    for (const fx of p.effects) {
      if (!curable(p, fx.id)) continue;
      const cost = itemPrice(g, cureFor(fx.id));
      const serious = DAMAGING.includes(fx.id);
      if (serious && p.jewels * R.JEWEL_COINS >= cost + 10) out.push({ type: 'TREAT', player: id, effect: fx.id, how: 'pay' });
      else if (serious) out.push({ type: 'TREAT', player: id, effect: fx.id, how: 'help' });
      else if (p.jewels >= 5 && cost <= 12) out.push({ type: 'TREAT', player: id, effect: fx.id, how: 'pay' });
      else out.push({ type: 'TREAT', player: id, effect: fx.id, how: 'ignore' });
    }
    // Food: ask the wallet while it can feed everyone, else pay with jewels, else scraps or skip.
    const basic = mealPrice(g, 'basic');
    const meal = p.health < 45 && p.jewels >= 4 ? 'feast' : p.jewels <= 1 && g.wallet < basic * living(g).length ? 'scraps' : 'basic';
    const cost = mealPrice(g, meal);
    if (g.wallet >= basic * living(g).length) out.push({ type: 'BUY_FOOD', player: id, meal, pay: 'wallet' });
    else if (p.jewels * R.JEWEL_COINS >= cost) out.push({ type: 'BUY_FOOD', player: id, meal, pay: 'jewels' });
    else out.push({ type: 'BUY_FOOD', player: id, meal: 'skip', pay: 'wallet' });
    if (g.wallet < basic * living(g).length && p.jewels > 4 && r() < 0.5) out.push({ type: 'SELL', player: id, jewels: 1 });
    if (g.wild.current === 'wolves' && p.jewels > 2) out.push({ type: 'PAY_WOLVES', player: id });
    if (g.wild.current === 'doctor' && p.jewels > 5 && r() < 0.4) {
      const worst = [...living(g)].sort((a, b) => a.health - b.health)[0];
      out.push({ type: 'DOCTOR_CHIP', player: id, jewels: 2, patient: worst.id });
    }
    if (style.betrays) {
      if (g.missions.some((m) => m.holder === id && m.id === 'skim' && m.status === 'active' && m.month === g.month - 1)) out.push({ type: 'SKIM', player: id, coins: g.wallet });
      if (g.missions.some((m) => m.holder === id && m.id === 'steal' && m.status === 'active' && m.month === g.month - 1)) out.push({ type: 'STEAL', player: id });
      if (s === 3 && p.jewels > 4 && r() < 0.25) {
        const others = living(g).filter((x) => x.id !== id);
        if (others.length) out.push({ type: 'BUY_ITEM', player: id, item: 'snare', pay: 'jewels', target: others[Math.floor(r() * others.length)].id, trigger: 'help' });
      }
    }
    if (r() < 0.15 && p.jewels > 3) {
      const others = living(g).filter((x) => x.id !== id);
      if (others.length) out.push({ type: 'GIFT', player: id, to: others[Math.floor(r() * others.length)].id, jewels: 1, poisoned: style.betrays && r() < 0.2 && p.jewels > 5 });
    }
    for (const gf of g.gifts.filter((x) => x.to === id && x.status === 'pending')) out.push({ type: 'GIFT_REPLY', player: id, gift: gf.id, accept: r() < 0.8 });
    for (const d of g.debts.filter((x) => x.borrower === id && x.status === 'open' && (x as { called?: number }).called === g.month)) out.push({ type: 'REPAY', player: id, debt: d.id });
    if (g.rumor.pen === id) out.push({ type: 'RUMOR', player: id, card: r() < 0.5 ? null : 1 + Math.floor(r() * 4) * 2 + 1 });
    if (g.month === R.MONTHS) {
      const others = living(g).filter((x) => x.id !== id);
      out.push({ type: 'LAST_SUPPER', player: id, to: others.length && r() < 0.6 ? others[Math.floor(r() * others.length)].id : null });
    }
    out.push({ type: 'SKIP', player: id });
  }

  if (g.phase === 'gap2') {
    const approveSupply = [0.95, 0.88, 0.8, 0.7][s];
    const approveHelp = [0.95, 0.9, 0.8, 0.7][s];
    for (const req of g.requests.filter((x) => x.month === g.month && x.status === 'open' && x.by !== id)) {
      if (!p.alive && req.kind === 'help') continue;
      const cs = myMission('cold-shoulder');
      if (cs && style.betrays && cs.target === req.by && cs.month === g.month - 1) {
        out.push({ type: 'COLD_SHOULDER', player: id, request: req.id });
        continue;
      }
      const loyal = !!myMission('loyal');
      const yes = loyal || r() < (req.kind === 'help' ? approveHelp : approveSupply);
      const donate = yes && req.kind === 'help' && p.jewels > 4 && r() < 0.3 ? 1 : 0;
      out.push({ type: 'VOTE', player: id, request: req.id, approve: yes, donate });
    }
    if (g.inquisitionOpen && p.alive) {
      const others = living(g).filter((x) => x.id !== id);
      if (others.length) out.push({ type: 'ACCUSE', player: id, target: others[Math.floor(r() * others.length)].id });
    }
    out.push({ type: 'SKIP', player: id });
  }

  if (g.phase === 'round' && g.round && p.alive) {
    const rd = g.round;
    const acc = Math.max(0.34, Math.min(0.97, style.skill - SEASON_DROP[s]));
    const sabotage = style.betrays && !!g.missions.find((m) => m.holder === id && ['sabotage', 'bad-hands', 'false-whisper', 'fallen-hero'].includes(m.id) && m.month === g.month && m.status === 'active');
    const wrongOf = (a: number) => (a + 1 + Math.floor(r() * 2)) % 3;
    if (rd.stage === 'pick') {
      const lv = living(g);
      const best = [...lv].sort((a, b) => b.correct[g.month - 2] - a.correct[g.month - 2])[0];
      out.push({ type: 'PICK', player: id, pick: sabotage && myMission('fallen-hero') ? id : best.id });
    } else if (rd.stage === 'bid') {
      const rider = style.betrays && !!myMission('free-rider');
      out.push({ type: 'BID', player: id, jewels: rider ? 0 : Math.min(p.jewels, Math.floor(r() * 3)) });
    } else {
      if (rd.id === 'supplier' && rd.chosen === id && style.betrays) out.push({ type: 'SUPPLIER_SKIM', player: id, share: 0.2 });
      if (rd.id === 'whisperer') {
        for (const pr of rd.pairs.filter((x) => x.b === id))
          rd.questions.forEach((q, i) => out.push({ type: 'SIGNAL', player: id, q: i, choice: sabotage ? wrongOf(q.answer) : q.answer }));
      }
      rd.questions.forEach((q, i) => {
        if (rd.id === 'chain' && rd.chainOrder[i] !== id) return;
        if ((rd.id === 'hero' || rd.id === 'supplier') && rd.chosen !== id) return;
        let choice: number;
        if (rd.id === 'chain') choice = myMission('chain-breaker') && style.betrays ? q.answer : r() < acc ? wrongOf(q.answer) : q.answer;
        else if (rd.id === 'whisperer') {
          const pr = rd.pairs.find((x) => x.a === id);
          if (!pr) return;
          const signal = rd.signals[pr.b]?.[i];
          choice = signal !== null && signal !== undefined && r() < 0.7 ? signal : r() < acc ? q.answer : wrongOf(q.answer);
        } else choice = sabotage || r() >= acc ? wrongOf(q.answer) : q.answer;
        out.push({ type: 'ANSWER', player: id, q: i, choice, ms: 2000 + Math.floor(r() * 6000) });
      });
    }
  }

  if (g.phase === 'ledger' && g.month % 3 === 0) {
    const ratings: Record<string, number> = {};
    for (const o of g.players) if (o.id !== id) ratings[o.id] = Math.floor(r() * 6);
    out.push({ type: 'STARS', player: id, ratings });
  }
  return out;
}

function cureFor(e: EffectId) {
  return R.ITEM_IDS.find((i) => R.ITEMS[i].cures === e)!;
}

