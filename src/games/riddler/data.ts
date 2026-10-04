import type { Answer, Riddle } from './core';
import riddlesJson from './data/riddles.json';
import extraJson from './data/extra-answers.json';
import { IMAGES } from './data/images';

/** The 86 riddles in level order (RD13: Yazan's pictures, numbered as in the case doc). */
export const RIDDLES = riddlesJson as Riddle[];
export const riddleById = new Map(RIDDLES.map((r) => [r.id, r]));
export const imageOf = (id: string) => IMAGES[id];

/**
 * The answer box list: the 86 real answers (id = the riddle's id) plus the look-alike list (RD2) when it exists.
 * Look-alikes never match a riddle, so they are always wrong picks.
 */
export const ANSWERS: Answer[] = [
  ...RIDDLES.map((r) => ({ id: r.id, label: r.answer })),
  ...(extraJson as string[]).map((label, i) => ({ id: `x-${i + 1}`, label })),
];
export const answerLabel = (id: string) => ANSWERS.find((a) => a.id === id)?.label ?? id;

/** RD1: only condition riddles feed Learn; signs and symptoms are not saved. */
export const feedsLearn = (r: Riddle) => r.kind === 'condition';
