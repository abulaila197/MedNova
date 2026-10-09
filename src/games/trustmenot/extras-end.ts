// Extra envelope fields for the end pages, computed on the server from the full game (owned by the end pages builder).
// Only this player's own facts, or what everyone in the camp may see. Never another player's secret. Once the year
// is over everything is public (rule book §11), so the reveal parts get the whole story.
import { epilogue, rules, starsFor, type Game, type PlayerId } from './engine';

/** Coins each player brought to the wallet in this month's round (public: the round's scores are shown to all). */
function roundCoins(g: Game): Record<PlayerId, number> {
  const r = g.round;
  const out: Record<PlayerId, number> = {};
  if (!r || !r.done) return out;
  const right = (id: PlayerId) => g.players.find((p) => p.id === id)?.correct[g.month - 1] ?? 0;
  if (r.id === 'forager') for (const p of g.players) out[p.id] = right(p.id) * rules.FORAGER_COINS;
  if (r.id === 'granary') {
    // The camp's coins split by each player's share of the right votes.
    const total = Number(r.outcome.coins ?? 0);
    const sum = g.players.reduce((s, p) => s + right(p.id), 0);
    for (const p of g.players) out[p.id] = sum ? Math.round((total * right(p.id)) / sum) : 0;
  }
  if (r.id === 'supplier' && r.chosen) out[r.chosen] = Number(r.outcome.coins ?? 0);
  return out;
}

/** Why the suspicion heat rose this month, in the camp's words (what happened is public; who did it is not). */
function heatWhy(g: Game): string[] {
  const now = g.log.filter((l) => l.month === g.month);
  const out: string[] = [];
  for (const l of now) {
    if (l.kind === 'heat') out.push(l.text === 'refused help' ? 'a refused help request' : 'a refused supply request');
    if (l.kind === 'mass-poisoning') out.push('the camp was poisoned');
    if (l.kind === 'skim') out.push('coins went missing from the jar');
    if (l.kind === 'snare-sprung') out.push('a snare was sprung');
  }
  const r = g.round;
  if (r?.done && (r.id === 'gate' || r.id === 'buried' || r.id === 'signal' || r.id === 'wager') && r.outcome.hit === false) out.push('the camp missed its target');
  return out;
}

/** The whole year, for the final reveal: stashes by season, work for the wallet, every vote, every epilogue. */
function yearStory(g: Game) {
  const sold: Record<PlayerId, number> = {};
  for (const l of g.log) if (l.kind === 'sold' && l.by) sold[l.by] = (sold[l.by] ?? 0) + (l.n ?? 0);
  return {
    players: g.players.map((p) => {
      const at = (m: number) => (p.diedMonth != null && p.diedMonth < m ? 0 : (p.history.find((h) => h.month === m)?.jewels ?? 0));
      // Coins to the wallet: Lone Forager answers in full, Granary answers as one share of the camp's coins per right
      // vote, and every jewel sold to the jar.
      let coins = (sold[p.id] ?? 0) * rules.JEWEL_COINS;
      g.plan.forEach((id, i) => {
        const right = p.correct[i] ?? 0;
        const alive = g.players.filter((x) => x.diedMonth == null || x.diedMonth >= i + 1).length || 1;
        if (id === 'forager') coins += right * rules.FORAGER_COINS;
        if (id === 'granary') coins += Math.round((right * rules.GRANARY_COINS) / alive);
      });
      return {
        id: p.id,
        stash: [3, 6, 9, 12].map(at),
        jewels: p.jewels,
        accuracy: p.answered ? p.correct.reduce((s, x) => s + x, 0) / p.answered : null,
        toWallet: coins,
        skimmed: g.log.filter((l) => l.kind === 'skim' && l.by === p.id).map((l) => ({ month: l.month, n: l.n ?? 0 })),
        stolen: g.log.filter((l) => l.kind === 'steal' && l.by === p.id).map((l) => ({ month: l.month, n: l.n ?? 0 })),
        epilogue: epilogue(g, p.id),
      };
    }),
    requests: g.requests
      .filter((r) => Object.keys(r.votes).length)
      .map((r) => ({ id: r.id, month: r.month, kind: r.kind, by: r.by, meal: r.meal, item: r.item, effect: r.effect, status: r.status, votes: Object.entries(r.votes).map(([id, v]) => ({ id, approve: v.approve })) })),
  };
}

export function endExtras(g: Game, me: PlayerId) {
  const self = g.players.find((p) => p.id === me);
  const coins = roundCoins(g);
  return {
    /** The ledger's rows: right answers and coins brought this month, per player. */
    ledger: g.players.map((p) => ({ id: p.id, right: p.correct[g.month - 1] ?? 0, coins: coins[p.id] ?? 0 })),
    heatWhy: g.phase === 'ledger' ? heatWhy(g) : [],
    /** My average trust stars from the camp so far, and the stars I last gave. */
    myStars: starsFor(g, me),
    myRatings: self?.stars ?? {},
    /** A ghost's whisper this month (one a month). */
    whispered: self?.whispers.find((w) => w.month === g.month) ?? null,
    /** Right answers in solo rounds, for the EXP lines on the results. */
    soloRight: self?.solo.right ?? 0,
    year: g.phase === 'over' ? yearStory(g) : null,
  };
}
