import type { Kind, Question, Style } from './core';

import questionsJson from './data/questions.json';

export const QUESTIONS = questionsJson as Question[];
export const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
export const answerOf = (id: string) => questionById.get(id)?.answer ?? -1;
export const idsOf = (kind: Kind) => QUESTIONS.filter((q) => q.kind === kind).map((q) => q.id);
export const poolFor = (style: Style) => (style === 'mixed' ? QUESTIONS.map((q) => q.id) : idsOf(style));
