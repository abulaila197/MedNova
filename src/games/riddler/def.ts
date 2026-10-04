import type { GameDef } from '../shell/types';
import { RD } from './core';
import { RIDDLES, riddleById, riddleName } from './data';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

const PHOTOS = {
  key: 'photos',
  label: 'Pictures',
  choices: [
    { value: 3, label: '3', note: 'quick' },
    { value: 5, label: '5' },
    { value: 10, label: '10', note: 'long' },
  ],
  initial: 5,
};

const TURN = {
  key: 'turn',
  label: 'Time per turn',
  choices: [
    { value: 30, label: '30 s' },
    { value: 60, label: '60 s' },
    { value: 90, label: '90 s' },
    { value: 120, label: '120 s' },
  ],
  initial: 90,
};

/** The Riddler on the shared shell (RD1-RD17): Solo and Offline; Online comes with the shared online layer. */
export const riddler: GameDef = {
  key: 'the-riddler',
  modes: [
    {
      mode: 'solo',
      title: 'Solve the board',
      blurb: `${RIDDLES.length} picture riddles. Read the rebus, name the condition or sign.`,
      howTo: [
        'Pick any level. Each one is a picture puzzle that spells out a medical condition, sign or symptom.',
        'Type 2 letters or more, then tap your answer. You have 3 lives per level.',
        '3 stars: solved in 30 s with no wrong guess. 2 stars: 60 s and at most 1 wrong. Any other solve: 1 star.',
        'Stuck? Show the definition for 1 token. It caps that level at 2 stars.',
        'Each star is worth 4 EXP. Replays only pay for stars above your best. Missed conditions go to Today\'s review.',
      ],
    },
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'Same picture for everyone, one after another. Fastest solver wins it.',
      howTo: [
        'Add 2 to 6 players, or split them into teams. Pick 3, 5 or 10 pictures and the time per turn.',
        'Everyone plays the same picture in turn. Guess as often as you like, but a wrong guess locks you for 5 s.',
        'Fastest solver scores 100, then 80, 65 and so on, plus up to 50 for time left. Time up scores 0.',
        'Teams take turns one after another, and a team scores its players\' average. No hints and no EXP in this mode.',
      ],
    },
    {
      mode: 'online',
      title: 'Race the same picture',
      blurb: 'Everyone sees the picture at once. Solve it first.',
      howTo: ['Everyone gets the same picture at the same time, 90 s to solve.', 'Faster solves score more.'],
      soon: true,
    },
  ],
  setup: { solo: [], offline: [PHOTOS, TURN] },
  players: { offline: { min: 2, max: 6 } },
  teams: { offline: true },
  playersNote: () => 'Player 1 is you, the phone owner. Offline earns no EXP; only your unsolved condition pictures go to Learn.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // RD9, RD10: Solo pays the EXP each level earned this session; RD12: Offline earns none.
  exp: (_score, items) => items.reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (_settings, mode) => (mode === 'offline' ? 0 : RIDDLES.length * 3 * RD.expPerStar),
  itemLabel: (item) => { const r = riddleById.get(item.itemId); return r ? riddleName(r) : item.itemId; },
  itemNoun: 'level',
  itemsTitle: 'Pictures',
  summary: (play, items) => {
    if (play.mode === 'offline') {
      const mine = items.filter((i) => i.seat === 0);
      return [
        { value: String(mine.reduce((a, i) => a + i.points, 0)), label: 'Your points' },
        { value: `${mine.filter((i) => i.outcome === 'right').length}/${mine.length}`, label: 'You solved' },
      ];
    }
    return [
      { value: `${items.filter((i) => i.outcome === 'right').length}/${items.length}`, label: 'Solved' },
      { value: String(items.reduce((a, i) => a + i.points, 0)), label: 'Stars' },
    ];
  },
};
