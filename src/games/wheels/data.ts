import type { Question } from './core';
import bankJson from './data/bank.json';
import type { FullBank } from './offline';

/** Yazan's Wheels bank (WC10): 10 fields, 9 styles (Closest number and Put in order joined from Quick Fire Quiz, 2026-11-12), 100 Redemption true/false and 8+ Boss sets per field. */
export const BANK = bankJson as unknown as FullBank;

export const questionById = new Map<string, Question>([...BANK.questions, ...BANK.redemption].map((q) => [q.id, q]));

/** The answer as one line, for results. */
export function answerLabel(q: Question): string {
  switch (q.style) {
    case 'mcq': case 'riddle': case 'reverse': return q.choices[q.answer];
    case 'tf': return `${q.prompt} ${q.answer ? 'True' : 'False'}`;
    case 'lie': return `Lie: ${q.statements[q.lie]}`;
    case 'r2o': return `Out: ${q.items[q.out[0]]}, ${q.items[q.out[1]]}`;
    case 'match': return q.prompt;
    case 'closest': return `${q.answer}${q.unit ? ` ${q.unit}` : ''}`;
    case 'order': return q.items.join(' → ');
  }
}
