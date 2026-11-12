import type { GameDef } from '../shell/types';
import { catMenu, catLabel, wordById } from './data';
import { Play } from './Play';

/** Tilt & Tell: Read My Mind (Yazan's cards 2026-11-12, TT1-TT17). Pass the phone only, teams only, no EXP. */
export const tiltAndTell: GameDef = {
  key: 'tilt-and-tell',
  modes: [
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'The word is on your forehead. Your team gives the clues.',
      howTo: [
        'Make 2 to 4 teams with at least 2 players each. Pick the words, Describe it or Act it out, the turn time and the rounds.',
        'The phone turns sideways. Hold it on your forehead, screen facing your team, and the clock starts after 3-2-1.',
        'Your team describes the word without saying it (or acts it out, no talking). Tilt the phone down when you get it, up to pass. 3 passes a turn.',
        'When time is up, check the list and tap any word the tilt got wrong. Teams take turns: A, B, A, B.',
        'Most words wins. Teams tied at the top get one 30 s sudden-death turn each. No EXP in this game.',
      ],
    },
  ],
  setup: {
    offline: [
      { key: 'words', label: 'Words', choices: [{ value: 'mixed', label: 'All mixed' }], initial: 'mixed', fields: () => catMenu() },
      { key: 'clue', label: 'Clues', choices: [{ value: 'describe', label: 'Describe it' }, { value: 'act', label: 'Act it out' }], initial: 'describe' },
      { key: 'time', label: 'Turn', choices: [30, 60, 90].map((n) => ({ value: n, label: `${n} s` })), initial: 60 },
      { key: 'rounds', label: 'Rounds', choices: [1, 2, 3].map((n) => ({ value: n, label: String(n) })), initial: 1 },
    ],
  },
  players: { offline: { min: 4, max: 12 } },
  playersNote: () => 'Player 1 is you, the phone owner. Every team needs at least 2 players. No EXP in this game.',
  teams: { offline: true },
  teamsOnly: { offline: { max: 4, minEach: 2 } },
  teamScore: 'sum',
  Play: { offline: Play },
  exp: () => 0,
  expCap: () => 0,
  itemLabel: (item) => {
    const w = wordById.get(item.itemId);
    return w ? `${w.w} · ${catLabel(w.c)}${item.outcome === 'right' ? '' : ' · passed'}` : item.itemId;
  },
  itemNoun: 'word',
  itemsTitle: 'Words',
};
