import type { GameDef } from '../shell/types';
import { POINTS } from './core';
import { QUESTIONS } from './data';
import { itemLine, SoloPlay } from './SoloPlay';

const count = (kind: string) => QUESTIONS.filter((q) => q.kind === kind).length.toLocaleString('en-US');

const STYLE = {
  key: 'style',
  label: 'Questions',
  choices: [
    { value: 'mixed', label: 'Mixed', note: 'about half each' },
    { value: 'clinical', label: 'Clinical', note: `${count('clinical')} questions` },
    { value: 'basic', label: 'Basic science', note: `${count('basic')} questions` },
  ],
  initial: 'mixed',
};

// QP4: 5, 10 or 15 questions.
const QUESTIONS_N = {
  key: 'questions',
  label: 'How many',
  choices: [
    { value: 5, label: '5', note: 'quick' },
    { value: 10, label: '10' },
    { value: 15, label: '15', note: 'long' },
  ],
  initial: 10,
};

/** The Quiz Parade (QP1-QP8): 7 question types, scored one by one, no streak. */
export const quizParade: GameDef = {
  key: 'the-quiz-parade',
  modes: [
    {
      mode: 'solo',
      title: 'March through the questions',
      blurb: 'A different kind of question every time. Harder types are worth more.',
      howTo: [
        'Pick clinical, basic science or mixed questions, and 5, 10 or 15 of them.',
        'Seven kinds of question: multiple choice, true or false, rule out 2, match the pairs, reverse, put in order and closest number.',
        `Each has its own clock. Points: true or false ${POINTS.tf}, multiple choice, reverse and closest number ${POINTS.mcq}, rule out 2 ${POINTS.r2o}, match and order ${POINTS.match}.`,
        'Match and order give part points for each right item. Closest number counts within 10% of the answer.',
        'Helpers cost tokens: Remove 2 wrong (1), Skip (3), +10 seconds (1). Missed questions wait for you in Today\'s review.',
      ],
    },
  ],
  setup: { solo: [STYLE, QUESTIONS_N] },
  Play: { solo: SoloPlay },
  // QP EXP is still to be decided with Yazan; points for now, at most 60.
  exp: (score) => Math.min(60, Math.max(0, score)),
  expCap: () => 60,
  itemLabel: (item) => itemLine(item.itemId),
  itemNoun: 'question',
  itemsTitle: 'Questions',
};
