import type { GameDef } from '../shell/types';
import { maxScore, soloExp } from './core';
import { questionById } from './data';
import { OfflinePlay } from './OfflinePlay';
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

/** The Streak Master on the shared shell (SM1-SM13): Solo and Offline; Online comes with the shared online layer. */
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
        'You earn half your score as EXP. Missed questions wait for you in Today\'s review.',
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
      howTo: ['Everyone gets the same question at once.', 'Faster right answers score more, plus a streak bonus.'],
      soon: true,
    },
  ],
  setup: { solo: [STYLE, LENGTH], offline: [STYLE, LENGTH] },
  players: { offline: { min: 2, max: 6 } },
  teams: { offline: true },
  playersNote: () => 'Player 1 is you, the phone owner. Offline earns no EXP; only your missed questions go to Learn.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // SM12: Solo EXP is half the score; SM13: Offline earns none.
  exp: (score) => soloExp(score),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : soloExp(maxScore(Number(settings.length) || 60))),
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
