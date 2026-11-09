// Medicordle vs rivals (G4): how a rival plays one word. Pure, so it can be tested.
import { decide, moodOf, type Mind } from '../../bots/brain';
import { between, rng, type Rand } from '../../bots/rng';
import type { BotType } from '../../bots/types';
import type { Plan } from '../../bots/race/engine';
import { MAX_ROWS, score } from './core';

/** The row each type usually solves on (Yazan 2026-11-09: rivals play real words, so their colours follow the rules). */
const SOLVE_ROW: Record<BotType, [number, number][]> = {
  genius: [[2, 0.05], [3, 0.4], [4, 0.4], [5, 0.15]],
  scholar: [[3, 0.15], [4, 0.4], [5, 0.3], [6, 0.15]],
  freshman: [[4, 0.15], [5, 0.35], [6, 0.5]],
};
/** Seconds between a type's rows. */
const ROW_SECONDS: Record<BotType, [number, number]> = { genius: [7, 13], scholar: [9, 17], freshman: [11, 20] };

/** Colours of a row as letters: g green, y yellow, x grey. */
export const coloursOf = (guess: string, answer: string) =>
  score(guess, answer)
    .map((m) => (m === 'ok' ? 'g' : m === 'near' ? 'y' : 'x'))
    .join('');

/** Does a word fit what earlier rows showed (greens stay, greys never come back)? Only sharper rivals keep to it. */
function fits(word: string, rows: string[], answer: string) {
  for (const r of rows) {
    const c = coloursOf(r, answer);
    for (let i = 0; i < r.length && i < word.length; i++) {
      if (c[i] === 'g' && word[i] !== r[i]) return false;
      if (c[i] === 'x' && !answer.includes(r[i]) && word.includes(r[i])) return false;
    }
  }
  return true;
}

const weighted = (r: Rand, t: [number, number][]) => {
  let x = r();
  for (const [v, w] of t) if ((x -= w) <= 0) return v;
  return t[t.length - 1][0];
};

/**
 * A rival's rows for one word: real words from the guess list, getting warmer row by row, then the word itself on the
 * row its type and form say. A Freshman sometimes runs out of rows. `wordsOf(len)` is the packed list for that length.
 */
export function wordPlan(mind: Mind, a: { seed: string; answer: string; limitMs: number; gap: number; progress: number; wordsOf: (len: number) => string | undefined }): Plan {
  const r = rng(`${a.seed}:${mind.bot.id}:word`);
  const type = mind.bot.type;
  // The brain's answer for this word decides whether it gets there at all; its form moves the row.
  const right = decide(mind, { seed: a.seed, limitMs: a.limitMs, gap: a.gap, progress: a.progress }).right || type === 'genius';
  let at: number | null = weighted(r, SOLVE_ROW[type]);
  const mood = moodOf(mind);
  if (mood === 'fire') at = Math.max(2, at - 1);
  if (mood === 'tilt') at += 1;
  if (a.gap > 0.25) at += 1;
  if (!right || at > MAX_ROWS) at = null;

  const len = a.answer.length;
  const packed = a.wordsOf(len) ?? '';
  const n = Math.floor(packed.length / len);
  const sharp = type !== 'freshman';
  const words: string[] = [];
  const last = at ?? MAX_ROWS;
  for (let k = 1; k < last + (at == null ? 1 : 0); k++) {
    // Aim for more greens each row, never the whole word.
    const want = Math.min(len - 1, Math.round(((k / last) * len * (type === 'genius' ? 0.85 : 0.7)) + between(r, -0.5, 0.5)));
    let best: string | null = null;
    let bestD = Infinity;
    for (let i = 0; i < 80 && n; i++) {
      const idx = Math.floor(r() * n);
      const word = packed.slice(idx * len, idx * len + len);
      if (word.length !== len || word === a.answer || words.includes(word)) continue;
      const greens = [...coloursOf(word, a.answer)].filter((c) => c === 'g').length;
      const d = Math.abs(greens - want) + (sharp && !fits(word, words, a.answer) ? 2 : 0);
      if (d < bestD) {
        best = word;
        bestD = d;
        if (d === 0) break;
      }
    }
    if (!best) break;
    words.push(best);
  }
  if (at != null) words.push(a.answer);

  // When each row goes in.
  const [lo, hi] = ROW_SECONDS[type];
  let t = 0;
  const rows: { at: number; colours: string }[] = [];
  for (const w of words) {
    t += Math.round(between(r, lo, hi) * 1000);
    if (t >= a.limitMs - 300) break;
    rows.push({ at: t, colours: coloursOf(w, a.answer) });
  }
  const solved = at != null && rows.length === words.length;
  const outOfRows = !solved && rows.length >= MAX_ROWS;
  return { doneAt: solved || outOfRows ? rows[rows.length - 1].at : null, solved, wrongAt: [], rows };
}
