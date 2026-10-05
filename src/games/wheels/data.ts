import type { Question } from './core';
import { SAMPLE_BANK } from './data/samples';
import type { FullBank } from './offline';

/** The Wheels bank. Sample questions until Yazan's own bank arrives (WC10). */
export const BANK: FullBank = SAMPLE_BANK;

export const questionById = new Map<string, Question>([...BANK.questions, ...BANK.redemption].map((q) => [q.id, q]));

/** The answer as one line, for results. */
export function answerLabel(q: Question): string {
  switch (q.style) {
    case 'mcq': case 'riddle': case 'reverse': return q.choices[q.answer];
    case 'tf': return `${q.prompt} ${q.answer ? 'True' : 'False'}`;
    case 'lie': return `Lie: ${q.statements[q.lie]}`;
    case 'r2o': return `Out: ${q.items[q.out[0]]}, ${q.items[q.out[1]]}`;
    case 'match': return q.prompt;
  }
}
