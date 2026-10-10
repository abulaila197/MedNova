import type { GameDef } from '../shell/types';
import { expForRight, SM_EXP } from './core';
import { questionById } from './data';
import { OfflinePlay } from './OfflinePlay';
import { OnlinePlay } from './OnlinePlay';
import { SoloPlay } from './SoloPlay';

const STYLE = {
  key: 'style',
  label: 'Questions',
  choices: [
    { value: 'clinical', label: 'Clinical', note: '644 cases' },
    { value: 'basic', label: 'Basic science', note: '400 questions' },
    { value: 'mixed', label: 'Mixed', note: 'about half each' },
  ],
  initial: 'mixed',
};

// SM7: online rooms pick 10, 15 or 20 questions and 10, 15 or 20 s per question.
const QUESTIONS_N = {
  key: 'questions',
  label: 'How many',
  choices: [
    { value: 10, label: '10', note: 'quick' },
    { value: 15, label: '15' },
    { value: 20, label: '20', note: 'long' },
  ],
  initial: 15,
};
const QTIME = {
  key: 'qtime',
  label: 'Time per question',
  choices: [
    { value: 10, label: '10 s' },
    { value: 15, label: '15 s' },
    { value: 20, label: '20 s' },
  ],
  initial: 15,
};

const LENGTH = {
  key: 'length',
  label: 'Round length',
  choices: [
    { value: 60, label: '60 s', note: 'sprint' },
    { value: 90, label: '90 s' },
    { value: 120, label: '120 s', note: 'long' },
  ],
  initial: 60,
};

/** The Streak Master on the shared shell (SM1-SM13): Solo, Offline and Online. */
export const streakMaster: GameDef = {
  key: 'the-streak-master',
  modes: [
    {
      mode: 'solo',
      title: 'Beat the clock',
      blurb: 'Answer as many as you can. Every right answer in a row is worth more.',
      howTo: [
        'Pick clinical, basic science or mixed questions, and a round of 60, 90 or 120 seconds.',
        'Each question has six choices. The 1st right answer in a row scores 1, the 2nd scores 2, and so on.',
        'A wrong answer turns red, shows the right one in green, and drops your streak to 0.',
        'Helpers cost tokens: Remove 2 wrong (1), Skip and keep your streak (3), +10 seconds (1).',
        'You earn 2 EXP per right answer, up to 60 a round. Missed questions wait for you in Today\'s review.',
      ],
    },
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'Everyone plays their own round. Highest score wins.',
      howTo: [
        'Add 2 to 6 players, or split them into teams. Everyone plays the same round length.',
        'Each player gets their own shuffle of the questions, so watching doesn\'t help.',
        'Same scoring as Solo, with no helpers. Ties go to the longest streak, then most right answers.',
        'Teams take turns one after another, and a team scores its players\' average. No EXP in this mode.',
      ],
    },
    {
      mode: 'online',
      title: 'Same questions, race live',
      blurb: 'Answer first and keep your streak for bonus points.',
      howTo: [
        'Everyone gets the same question with the same choices at once. One pick each, no helpers.',
        'Right answers score by order: 100, 80, 65 and so on, plus 10 for each answer in your streak after the first (up to 50).',
        'A wrong pick or no answer drops your streak to 0. Ties go to the longest streak, then most right answers.',
        'You earn 2 EXP per right answer, up to 60, like Solo. Missed questions wait for you in Today\'s review.',
      ],
    },
  ],
  setup: { solo: [STYLE, LENGTH], offline: [STYLE, LENGTH], online: [STYLE, QUESTIONS_N, QTIME] },
  players: { offline: { min: 2, max: 6 } },
  teams: { offline: true, online: true },
  playersNote: () => 'Player 1 is you, the phone owner. Offline earns no EXP; only your missed questions go to Learn.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  Online: OnlinePlay,
  // SM16: Solo and Online EXP is 2 per right answer, at most 60 (the streak score itself is unchanged); SM13: Offline earns none.
  exp: (_score, items) => expForRight(items.filter((i) => i.seat === 0 && i.outcome === 'right').length),
  expCap: (_settings, mode) => (mode === 'offline' ? 0 : SM_EXP.cap),
  itemLabel: (item) => {
    const q = questionById.get(item.itemId);
    return q ? q.choices[q.answer] : item.itemId;
  },
  itemNoun: 'question',
  itemsTitle: 'Questions',
  summary: (play, items) => {
    const mine = play.mode === 'offline' ? items.filter((i) => i.seat === 0) : items;
    const streak = Math.max(0, ...mine.map((i) => Number(i.gameData.streak) || 0));
    return [
      { value: String(mine.reduce((a, i) => a + i.points, 0)), label: play.mode === 'offline' ? 'Your points' : 'Points' },
      { value: String(streak), label: 'Best streak' },
    ];
  },
};
