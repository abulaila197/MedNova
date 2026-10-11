// Final Reveal (§11): ranking, awards, epilogue lines and EXP. Pure reads of a finished game.

import * as R from './rules';
import type { Game, Player, PlayerId } from './types';

export type AwardId = 'most-trusted' | 'most-distrusted' | 'best-betrayer' | 'best-reader-of-the-room' | 'best-doctor' | 'loudest-ghost';

/** Survivors rank by health % + 3 per jewel; ties go to the faster total answer time. */
export function ranking(g: Game): { id: PlayerId; score: number }[] {
  return g.players
    .filter((p) => p.alive)
    .map((p) => ({ id: p.id, score: p.health + R.SCORE_PER_JEWEL * p.jewels, ms: p.totalMs }))
    .sort((a, b) => b.score - a.score || a.ms - b.ms)
    .map(({ id, score }) => ({ id, score }));
}

/** Average stars a player received (ghosts rate at full weight). */
export function starsFor(g: Game, id: PlayerId): number | null {
  const given = g.players.filter((p) => p.id !== id && p.stars[id] !== undefined).map((p) => p.stars[id]);
  return given.length ? given.reduce((s, x) => s + x, 0) / given.length : null;
}

const betrayals = (g: Game, id: PlayerId) => g.missions.filter((m) => m.holder === id && R.MISSIONS[m.id].betrayal);
const accusedRightly = (g: Game, id: PlayerId) => g.log.some((l) => l.kind === 'inquisition' && l.to === id && l.text === 'right');
const accuracy = (p: Player) => (p.answered ? p.correct.reduce((s, x) => s + x, 0) / p.answered : 0);

/** The player with the best score; ties go to the faster total answer time (§11, rule 13), never the seat. */
function best(players: Player[], score: (p: Player) => number | null, lowest = false): Player | null {
  let out: Player | null = null, top = 0;
  for (const p of players) {
    const s = score(p);
    if (s === null) continue;
    if (out === null || (lowest ? s < top : s > top) || (s === top && p.totalMs < out.totalMs)) {
      out = p;
      top = s;
    }
  }
  return out;
}

export function awards(g: Game): Partial<Record<AwardId, PlayerId>> {
  const ps = g.players;
  const out: Partial<Record<AwardId, PlayerId>> = {};
  const trusted = best(ps, (p) => starsFor(g, p.id));
  const distrusted = best(ps, (p) => starsFor(g, p.id), true);
  if (trusted) out['most-trusted'] = trusted.id;
  if (distrusted && distrusted.id !== trusted?.id) out['most-distrusted'] = distrusted.id;
  const betrayer = best(ps, (p) => {
    const n = betrayals(g, p.id).filter((m) => m.status === 'done').length;
    return n && !accusedRightly(g, p.id) ? n : null;
  });
  if (betrayer) out['best-betrayer'] = betrayer.id;
  // Reader of the Room: whose stars best separated the real betrayers from everyone else.
  const betrayers = new Set(g.missions.filter((m) => R.MISSIONS[m.id].betrayal).map((m) => m.holder));
  const reader = best(ps, (p) => {
    const rated = Object.entries(p.stars);
    const bad = rated.filter(([id]) => betrayers.has(id)).map(([, s]) => s);
    const good = rated.filter(([id]) => !betrayers.has(id)).map(([, s]) => s);
    if (!bad.length || !good.length) return null;
    const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    return avg(good) - avg(bad);
  });
  if (reader) out['best-reader-of-the-room'] = reader.id;
  // Best Doctor needs at least half as many answers as the most anyone gave, so an early death at 5/5 can't win it.
  const most = Math.max(0, ...ps.map((p) => p.answered));
  const doctor = best(ps, (p) => (p.answered && p.answered * 2 >= most ? accuracy(p) : null));
  if (doctor) out['best-doctor'] = doctor.id;
  const ghost = best(ps, (p) => {
    const n = p.whispers.filter((w) => w.believed).length;
    return n || null;
  });
  if (ghost) out['loudest-ghost'] = ghost.id;
  return out;
}

/** EXP: correct answers in solo rounds + a survival bonus + a bonus per award. */
export function exp(g: Game, id: PlayerId): number {
  const p = g.players.find((x) => x.id === id)!;
  const won = Object.values(awards(g)).filter((x) => x === id).length;
  return p.solo.right * R.EXP.perSoloRight + (p.alive ? R.EXP.survival : 0) + won * R.EXP.perAward;
}

/** Misses for the Learn feed: solo rounds only (§7.3). */
export const learnFeed = (g: Game, id: PlayerId) => g.players.find((p) => p.id === id)?.solo.missed ?? [];

/**
 * Epilogue line (writing file §1): the first rule that fits picks the line number (1-40), with the
 * values its placeholders need. The app holds the 40 texts.
 */
export function epilogue(g: Game, id: PlayerId): { line: number; n?: number; month?: number; other?: PlayerId } {
  const p = g.players.find((x) => x.id === id)!;
  const ms = g.missions.filter((m) => m.holder === id);
  const done = (k: string) => ms.some((m) => m.id === k && m.status === 'done');
  const giftsGiven = g.gifts.filter((x) => x.from === id && x.status === 'accepted').length;
  const firstDeath = Math.min(...g.players.filter((x) => x.diedMonth !== null).map((x) => x.diedMonth!));
  const aw = awards(g);
  const award = (a: AwardId) => aw[a] === id;
  const month = p.diedMonth ?? undefined;
  const effectLog = (e: string) => g.log.some((l) => l.kind === 'effect' && l.to === id && l.text === e);
  if (!p.alive) {
    if (award('loudest-ghost')) return { line: 13, n: p.whispers.filter((w) => w.believed).length };
    if (p.ghostTieBreaks >= 2) return { line: 16, n: p.ghostTieBreaks };
    if (giftsGiven >= 3) return { line: 1, month };
    const debt = g.debts.find((d) => d.borrower === id && d.status === 'cancelled');
    if (debt) return { line: 2, month, n: debt.jewels };
    if (effectLog('snakebite') && g.requests.some((r) => r.by === id && r.effect === 'snakebite' && r.status === 'refused')) return { line: 3, month };
    const held = p.history.find((h) => h.month === (p.diedMonth ?? 0) - 1)?.jewels ?? 0;
    if (held >= 4) return { line: 4, month, n: held };
    if (g.gifts.some((x) => x.to === id && x.poisoned && x.status === 'accepted')) return { line: 5, month };
    if (p.effects.some((e) => e.rabies)) return { line: 6, month };
    if (p.effects.some((e) => e.id === 'rat-bite')) return { line: 7, month };
    if (p.diedMonth === firstDeath) return { line: 8 };
    if (p.diedMonth === R.MONTHS) return { line: 9, month };
    if (p.effects.some((e) => e.id === 'frostbitten') && R.seasonOf(p.diedMonth ?? 1) === 1) return { line: 10 };
    if (!p.whispers.length && p.diedMonth !== null && p.diedMonth < 9) return { line: 15 };
    return { line: 12, month };
  }
  const notAccused = !accusedRightly(g, id);
  const betrayalsDone = ms.filter((m) => R.MISSIONS[m.id].betrayal && m.status === 'done').length;
  if (betrayalsDone >= 2 && notAccused) return { line: 17 };
  if (done('skim')) return { line: 18, n: Number(ms.find((m) => m.id === 'skim')?.data.coins ?? 0) };
  if (!notAccused) return { line: 19, month: g.log.find((l) => l.kind === 'inquisition' && l.to === id)?.month };
  if (award('best-betrayer')) return { line: 20, n: ms.reduce((s, m) => s + (R.MISSIONS[m.id].betrayal ? m.paid : 0), 0) };
  if (done('fallen-hero') || done('sabotage')) return { line: 21 };
  if (done('free-rider')) return { line: 22 };
  if (done('chain-breaker')) return { line: 23 };
  if (done('poisoner')) return { line: 24, month: ms.find((m) => m.id === 'poisoner')?.month };
  const guardian = ms.find((m) => m.id === 'guardian' && m.status === 'done');
  if (guardian) return { line: 25, other: guardian.target };
  if (done('loyal')) return { line: 26 };
  if (giftsGiven >= 4) return { line: 27 };
  const donations = g.requests.filter((r) => r.by !== id && (r.votes[id]?.donate ?? 0) > 0 && r.status === 'approved').length;
  if (donations >= 3) return { line: 28, n: donations };
  if (award('best-doctor')) return { line: 29 };
  if (award('most-trusted') && betrayalsDone === 0) return { line: 30 };
  if (p.effects.length >= 2) return { line: 32, n: p.jewels };
  if (p.health < 15) return { line: 33, n: p.health };
  if (g.log.some((l) => l.kind === 'inquisition' && l.to === id && l.text === 'wrong')) return { line: 34 };
  if (award('best-reader-of-the-room')) return { line: 35 };
  if (award('most-distrusted')) return { line: 36 };
  if (g.debts.some((d) => d.lender === id && d.status === 'repaid')) return { line: 37 };
  if (g.lastSupper[id]) return { line: 38 };
  if (p.health >= 50) return { line: 39 };
  return { line: 40 };
}
