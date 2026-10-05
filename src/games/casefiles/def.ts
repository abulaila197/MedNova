import type { GameDef } from '../shell/types';
import { CF } from './core';
import { CASES, caseById } from './data';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

/** Case Files on the shared shell (CF1-CF10, TMG-CF): Solo library and Offline; Online waits for the shared online layer. */
export const caseFiles: GameDef = {
  key: 'case-files-unsolved',
  modes: [
    {
      mode: 'solo',
      title: 'Open a case',
      blurb: `Pick any of ${CASES.length} cases and work it from history to discharge.`,
      howTo: [
        'Pick a case from the library. Every case is open.',
        'Read the personal file and the history, then write a differential of up to 5.',
        'Request the examination, read at least one page, then narrow your list. Only the narrowed list scores.',
        'Read every investigation, then name the diagnosis: right is +20. Wrong? Read the treatment and make one last call for +10.',
        `Each right differential is +${CF.points.ddRight}, each wrong one -${CF.points.ddWrong}, and solving fast adds up to +${CF.points.timeMax}.`,
        'Replaying a case is free but earns no EXP. A wrong first diagnosis goes to Learn.',
      ],
    },
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'Everyone works the same case alone, in turn. Sealed until the last one closes it.',
      howTo: [
        'Add 2 to 6 players, or split them into teams.',
        'Each player plays the whole case alone, then passes the phone on.',
        'Nobody sees a stamp, a score or the discharge until everyone has finished.',
        'Most points wins; a tie goes to the faster finish. With teams, the team score is its players’ average.',
      ],
    },
    {
      mode: 'online',
      title: 'Race the case',
      blurb: 'The same case at the same time, with live progress.',
      howTo: ['Everyone works the same case at once.', 'You see who has reached which stage, never their answers.'],
      soon: true,
    },
  ],
  setup: { solo: [], offline: [] },
  players: { offline: { min: 2, max: 6 } },
  teams: { offline: true },
  teamScore: 'average',
  playersNote: () => 'Player 1 is you, the phone owner: a wrong first diagnosis of yours goes to Learn. Pass the phone earns no EXP.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // CF6: a Solo case pays its points the first time only; Offline pays nothing.
  exp: (_score, items) => items.reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (_settings, mode) => (mode === 'offline' ? 0 : 3 * CF.points.ddRight + CF.points.provisional + CF.points.timeMax),
  itemLabel: (item) => {
    const c = caseById.get(item.itemId);
    return c ? `${c.title}: ${c.final}` : item.itemId;
  },
  itemNoun: 'case',
  itemsTitle: 'Cases',
};
