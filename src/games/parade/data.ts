import type { Kind, Question, Style } from './core';

import bankJson from './data/bank.json';

export const QUESTIONS = bankJson as unknown as Question[];
export const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
export const bank = (id: string) => questionById.get(id);
/**
 * Questions taken out of play (#32, Yazan 2026-11-01: they give their answer away). They stay in bank.json so the
 * server's answer keys (pq_keys, by place in the bank) keep their numbers; the server drops them from pq_keys.
 */
const RETIRED = new Set(['wc:microbiology-mcq-22']);
const LIVE = QUESTIONS.filter((q) => !RETIRED.has(q.id));
export const idsOf = (kind: Kind) => LIVE.filter((q) => q.kind === kind).map((q) => q.id);
export const poolFor = (style: Style) => (style === 'mixed' ? LIVE.map((q) => q.id) : idsOf(style));
