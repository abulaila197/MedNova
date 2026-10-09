// Extra envelope fields for the round pages, computed on the server from the full game (owned by the round pages builder).
// Only this player's own facts, or what everyone in the camp may see. Never another player's secret.
import type { EffectId, Game, ItemId, PlayerId, RoundRun } from './engine';
import { itemPrice, living, rules as R, starPlayer, timeLimitMs, weakLink } from './engine';

/** Team-vote: the most-picked choice wins, ties to the fastest voter (the engine's rule, §5). Null until everyone voted. */
function teamRight(g: Game, r: RoundRun, q: number): boolean | null {
  const lv = living(g);
  if (lv.some((p) => !r.answers[p.id]?.[q])) return null;
  const tally: Record<number, { n: number; fastest: number }> = {};
  for (const p of lv) {
    const a = r.answers[p.id][q]!;
    if (a.choice === null || a.ms > timeLimitMs(g, p.id, q)) continue;
    const ghostVote = g.missions.some((m) => m.holder === p.id && m.id === 'ghost-vote' && m.month === g.month && m.status === 'active');
    const t = (tally[a.choice] ??= { n: 0, fastest: Infinity });
    t.n += ghostVote ? 2 : 1;
    t.fastest = Math.min(t.fastest, a.ms);
  }
  const top = Object.entries(tally).sort((x, y) => y[1].n - x[1].n || x[1].fastest - y[1].fastest)[0];
  return !!top && Number(top[0]) === r.questions[q].answer;
}

/** My own answer to q: right, wrong, or null while I have not answered. */
function myRight(g: Game, r: RoundRun, me: PlayerId, q: number): boolean | null {
  const a = r.answers[me]?.[q];
  if (!a) return null;
  return a.choice === r.questions[q].answer && a.ms <= timeLimitMs(g, me, q);
}

/** Jewels lost after `times` cuts of a fraction, with the engine's rounding and the Lock box. */
function jewelCuts(jewels: number, lockBox: boolean, frac: number, times: number) {
  let j = jewels;
  for (let i = 0; i < times && j >= 1; i++) {
    let k = Math.max(1, Math.round(j * frac));
    k = Math.min(k, Math.max(1, Math.floor(j / 2)), Math.max(0, j - (lockBox ? R.LOCK_BOX_JEWELS : 0)));
    j -= k;
  }
  return jewels - j;
}

/** Damage-control rounds: what is at risk for me and the slices lost so far (decided questions only). */
function riskOf(g: Game, r: RoundRun, me: PlayerId) {
  const p = g.players.find((x) => x.id === me)!;
  const n = r.questions.length;
  const team = r.id === 'jar' || r.id === 'cavein';
  const marks = r.questions.map((_, q) => (team ? teamRight(g, r, q) : myRight(g, r, me, q)));
  const lostSlices = marks.filter((m) => m === false).length;
  if (r.id === 'jar' || r.id === 'purse') {
    const pot = Math.floor(g.wallet * (r.id === 'jar' ? R.JAR_RISK : R.PURSE_RISK));
    const risk = r.id === 'jar' ? pot : Math.floor(pot / Math.max(1, living(g).length));
    const share = r.id === 'jar' ? pot : pot / Math.max(1, living(g).length);
    return { unit: 'coins' as const, risk, of: g.wallet, slices: n, lostSlices, lost: Math.floor((share * lostSlices) / n) };
  }
  const frac = r.id === 'cavein' ? R.CAVEIN_LOSS : R.PICKPOCKET_LOSS;
  return { unit: 'jewels' as const, risk: p.jewels, of: p.jewels, slices: n, lostSlices, lost: jewelCuts(p.jewels, p.lockBox, frac, lostSlices) };
}

export function roundExtras(g: Game, me: PlayerId) {
  const targeting = R.TARGETING_CHANCE[g.month - 1] > 0;
  const star = targeting ? starPlayer(g) : null;
  const weak = targeting ? weakLink(g, star?.id) : null;
  // The cure and its price for each obstacle dealt to me this month.
  const cures: Partial<Record<EffectId, { item: ItemId; price: number }>> = {};
  for (const d of g.dealt.filter((x) => x.player === me)) {
    const item = R.ITEM_IDS.find((i) => R.ITEMS[i].cures === d.effect);
    if (item) cures[d.effect] = { item, price: itemPrice(g, item) };
  }
  const base = {
    /** Public targeting marks (crown and red pulse), from the month targeting starts. */
    star: star?.id ?? null,
    weak: weak?.id ?? null,
    cures,
  };
  return { ...base, ...roundFacts(g, g.round, me) };
}

/** Facts about the running round for my phone (all empty between rounds). */
function roundFacts(g: Game, r: RoundRun | null, me: PlayerId) {
  if (!r)
    return { helpers: {}, guideHide: null, whisper: null, fogWrong: null, myPick: null, skim: null, risk: null, chain: null };
  const helpers = r.helpers[me] ?? {};
  const whisperer = r.id === 'whisperer' && r.pairs.some((x) => x.b === me);
  const fogHolder = g.missions.some((m) => m.holder === me && m.id === 'fog' && m.month === g.month && m.status === 'active');
  // One wrong choice for a question, the same on every poll.
  const wrongOf = (q: number) => {
    const ans = r.questions[q].answer;
    const id = r.questions[q].id;
    const k = [...id].reduce((s, c) => s + c.charCodeAt(0), 0) % 2;
    return (ans + 1 + k) % 3;
  };
  const pot = Object.values(r.chainStakes).reduce((s, x) => s + x, 0);

  return {
    /** My pocket guide and stethoscope this round (question index used). */
    helpers,
    /** The one wrong choice my pocket guide greys out, only after I used it. */
    guideHide: helpers.guide !== undefined ? { q: helpers.guide, choice: wrongOf(helpers.guide) } : null,
    /** The Whisperer knows the answers and what they lit. */
    whisper: whisperer ? { answers: r.questions.map((q) => q.answer), signals: r.signals[me] ?? r.questions.map(() => null) } : null,
    /** Fog holder: a wrong choice per question they may blur. */
    fogWrong: fogHolder ? r.questions.map((_, q) => wrongOf(q)) : null,
    /** Hero / Supplier: my vote, and my skim if I was chosen as Supplier. */
    myPick: r.picks[me] ?? null,
    skim: r.id === 'supplier' && r.chosen === me ? Number(r.outcome.skim ?? 0) : null,
    risk: R.DAMAGE_CONTROL.includes(r.id) ? riskOf(g, r, me) : null,
    /** Chain of Trust: the pot, my stake and how each link went (public as it happens). */
    chain: r.id === 'chain'
      ? {
          pot,
          stake: r.chainStakes[me] ?? 0,
          links: r.chainOrder.map((id, q) => {
            const a = r.answers[id]?.[q];
            if (!a) return null;
            if (a.choice === null) return 'timeout' as const;
            return a.choice === r.questions[q].answer ? ('right' as const) : ('wrong' as const);
          }),
        }
      : null,
  };
}
