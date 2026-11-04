import type { Kind, Question, Style } from './core';

import bankJson from './data/bank.json';

export const QUESTIONS = bankJson as unknown as Question[];
export const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
export const bank = (id: string) => questionById.get(id);
/** Every question in the bank is live (publish task 1, 2026-11-02: the retired TB question was deleted and the
 *  places after it moved down by one, here and in pq_keys). */
const LIVE = QUESTIONS;
export const idsOf = (kind: Kind) => LIVE.filter((q) => q.kind === kind).map((q) => q.id);
export const poolFor = (style: Style) => (style === 'mixed' ? LIVE.map((q) => q.id) : idsOf(style));
/** A question's type (mcq, tf, r2o, match, reverse, order, closest), for the type rounds (#15). */
export const typeOf = (id: string) => questionById.get(id)?.style;
