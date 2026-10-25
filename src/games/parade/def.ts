import type { GameDef } from '../shell/types';
import { POINTS } from './core';
import { QUESTIONS } from './data';
import { OfflinePlay } from './OfflinePlay';
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

/** The Quiz Parade (QP1-QP11): 7 question types, scored one by one, no streak. Solo and Pass the phone. */
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
        'Helpers cost tokens: Skip (3) and +10 seconds (1). Missed questions wait for you in Today\'s review.',
      ],
    },
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'Everyone answers the same questions. Most points wins.',
      howTo: [
        'Add 2 to 6 players, or split them into teams. Pick the questions and how many, as in Solo.',
        'Each player answers the whole set in one turn, in their own order, then passes the phone.',
        'Same points and clocks as Solo, with no helpers. Closest number goes to the nearest guess once everyone has played.',
        'Ties go to the most fully right answers. Teams score their players\' average. No EXP in this mode.',
      ],
    },
  ],
  setup: { solo: [STYLE, QUESTIONS_N], offline: [STYLE, QUESTIONS_N] },
  players: { offline: { min: 2, max: 6 } },
  teams: { offline: true },
  playersNote: () => 'Player 1 is you, the phone owner. Pass the phone earns no EXP; only your missed questions go to Learn.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // QP11: EXP = points, at most 60. Pass the phone earns none, like every Pass the phone mode.
  exp: (score) => Math.min(60, Math.max(0, score)),
  expCap: (_settings, mode) => (mode === 'offline' ? 0 : 60),
  itemLabel: (item) => itemLine(item.itemId),
  itemNoun: 'question',
  itemsTitle: 'Questions',
};
