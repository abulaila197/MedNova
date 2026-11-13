import type { GameDef, SetupOption } from '../shell/types';
import { expForRight, SM_EXP, type Style } from './core';
import { fieldMenu, questionById } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

// Field ticks: at least 60 questions (the longest streak goal) must stay ticked.
const STYLE: SetupOption = {
  key: 'style',
  label: tr('Questions'),
  choices: [
    { value: 'clinical', label: tr('Clinical'), note: tr('644 cases') },
    { value: 'basic', label: tr('Basic science'), note: tr('400 questions') },
    { value: 'mixed', label: tr('Mixed'), note: tr('about half each') },
  ],
  initial: 'mixed',
  fields: (v) => fieldMenu(v as Style, 60),
};

// SM7: online rooms pick 5, 10 or 15 questions (Yazan 2026-10-25, was 10/15/20) and 15, 20 or 25 s per question (#76: +5 s, Online only, Yazan 2026-10-26).
const QUESTIONS_N = {
  key: 'questions',
  label: tr('How many'),
  choices: [
    { value: 5, label: '5', note: 'quick' },
    { value: 10, label: '10' },
    { value: 15, label: '15', note: 'long' },
  ],
  initial: 10,
};
const QTIME = {
  key: 'qtime',
  label: tr('Time per question'),
  choices: [
    { value: 15, label: '15 s' },
    { value: 20, label: '20 s' },
    { value: 25, label: '25 s' },
  ],
  initial: 20,
};

const LENGTH = {
  key: 'length',
  label: tr('Round length'),
  choices: [
    { value: 60, label: '60 s', note: 'sprint' },
    { value: 90, label: '90 s' },
    { value: 120, label: '120 s', note: 'long' },
  ],
  initial: 60,
};

/**
 * Solo: 1, 2 or 3 minutes, or No clock (Yazan 2026-11-12): nothing timed, the round ends on your first wrong answer.
 * Pass the phone keeps 60 / 90 / 120 s.
 */
const SOLO_LENGTH = {
  ...LENGTH,
  choices: [
    { value: 60, label: tr('1 min'), note: 'sprint' },
    { value: 120, label: tr('2 min') },
    { value: 180, label: tr('3 min'), note: 'long' },
    { value: 0, label: tr('No clock'), note: tr('ends on 1st mistake') },
  ],
};

/** The Streak Master on the shared shell (SM1-SM13): Solo, Offline and Online. */
export const streakMaster: GameDef = {
  key: 'the-streak-master',
  modes: [
    {
      mode: 'solo',
      title: tr('Beat the clock'),
      blurb: tr('Answer as many as you can. Every right answer in a row is worth more.'),
      howTo: [
        tr('Pick clinical, basic science or mixed questions, and a round of 1, 2 or 3 minutes.'),
        tr('Or pick No clock: take your time, but the round ends on your first wrong answer. It counts toward the same high score.'),
        tr('Each question has six choices. The 1st right answer in a row scores 1, the 2nd scores 2, and so on.'),
        tr('A wrong answer turns red, shows the right one in green, and drops your streak to 0.'),
        tr('Helpers cost tokens: Remove 2 wrong (1), Skip and keep your streak (3), +10 seconds (1).'),
        tr('You earn 2 EXP per right answer, up to 60 a round. Missed questions wait for you in Today\'s review.'),
      ],
    },
    {
      mode: 'offline',
      title: tr('Pass the phone'),
      blurb: tr('Everyone plays their own round. Highest score wins.'),
      howTo: [
        tr('Add 2 to 6 players, or split them into teams. Everyone plays the same round length.'),
        tr('Each player gets their own shuffle of the questions, so watching doesn\'t help.'),
        tr('Same scoring as Solo, with no helpers. Ties go to the longest streak, then most right answers.'),
        tr('Teams take turns one after another, and a team scores its players\' average. No EXP in this mode.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Streak showdown'),
      blurb: tr('Answer first and keep your streak. The rivals\' heat columns rise and crash beside yours.'),
      howTo: [
        tr('Pick Freshmen, Scholars or Geniuses and 1 to 5 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Everyone gets the same question with the same choices at once. One pick each.'),
        tr('Helpers cost tokens, like Solo: Remove 2 wrong (1), Skip and keep your streak (3), +10 seconds (1).'),
        tr('Right answers score by order: 100, 80, 65 and so on, plus 10 for each answer in your streak after the first (up to 50).'),
        tr('A wrong pick or no answer drops your streak to 0. Ties go to the longest streak, then most right answers.'),
        tr('You earn 2 EXP per right answer, up to 60, like Solo. Missed questions wait for you in Today\'s review.'),
      ],
    },
  ],
  setup: { solo: [STYLE, SOLO_LENGTH], offline: [STYLE, LENGTH], bots: [STYLE, QUESTIONS_N, QTIME] },
  players: { offline: { min: 2, max: 6 } },
  bots: { min: 1, max: 5 },
  teams: { offline: true, bots: true },
  playersNote: () => tr('Player 1 is you, the phone owner. Pass the phone earns no EXP; only your missed questions go to Learn.'),
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // SM16: Solo and Online EXP is 2 per right answer, at most 60 (the streak score itself is unchanged); SM13: Offline earns none.
  exp: (_score, items, settings) => (settings?.custom ? 0 : expForRight(items.filter((i) => i.seat === 0 && i.outcome === 'right').length)),
  expCap: (_settings, mode) => (mode === 'offline' ? 0 : SM_EXP.cap),
  itemLabel: (item) => {
    const q = questionById.get(item.itemId);
    return q ? q.choices[q.answer] : item.itemId;
  },
  itemNoun: 'question',
  itemsTitle: tr('Questions'),
  summary: (play, items) => {
    const mine = play.mode === 'offline' ? items.filter((i) => i.seat === 0) : items;
    const streak = Math.max(0, ...mine.map((i) => Number(i.gameData.streak) || 0));
    return [
      { value: String(mine.reduce((a, i) => a + i.points, 0)), label: play.mode === 'offline' ? tr('Your points') : tr('Points') },
      { value: String(streak), label: tr('Best streak') },
    ];
  },
};
