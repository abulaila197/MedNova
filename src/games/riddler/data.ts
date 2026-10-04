import { fullName } from '../shell/names';
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
  ...RIDDLES.map((r) => ({ id: r.id, label: r.answer, aliases: r.aliases })),
  ...(extraJson as { label: string; aliases: string[] }[]).map((x, i) => ({ id: `x-${i + 1}`, ...x })),
];
const answerById = new Map(ANSWERS.map((a) => [a.id, a]));
/** An answer as shown everywhere: "Main name (other 1, other 2)" (NL1). */
export const answerLabel = (id: string) => {
  const a = answerById.get(id);
  return a ? fullName(a) : id;
};
/** A riddle's answer as shown on result and reveal cards. */
export const riddleName = (r: Riddle) => fullName({ label: r.answer, aliases: r.aliases });

/** RD1: only condition riddles feed Learn; signs and symptoms are not saved. */
export const feedsLearn = (r: Riddle) => r.kind === 'condition';
