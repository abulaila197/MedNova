import type { Kind, Question, Style } from './core';

import bankJson from './data/bank.json';

export const QUESTIONS = bankJson as unknown as Question[];
export const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
export const bank = (id: string) => questionById.get(id);
export const idsOf = (kind: Kind) => QUESTIONS.filter((q) => q.kind === kind).map((q) => q.id);
export const poolFor = (style: Style) => (style === 'mixed' ? QUESTIONS.map((q) => q.id) : idsOf(style));
