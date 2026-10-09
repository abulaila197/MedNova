import type { GameDef } from '../shell/types';
import { CF } from './core';
import { CASES, caseById } from './data';
import { OfflinePlay } from './OfflinePlay';
import { OnlinePlay } from './OnlinePlay';
import { caseFilesScreens, INK, INK_TEAMS } from './screens';
import { SoloPlay } from './SoloPlay';

/** Case Files on the shared shell (CF1-CF12, TMG-CF): Solo library, Offline and Online Multiplayer. */
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
      title: 'Same case, sealed',
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
      howTo: [
        'Everyone gets the same random case at the same time and works it alone, against the host\'s time limit.',
        'You see when someone reaches a new stage or solves it, never their answers or points.',
        'Scoring is the same as Solo, and the case\'s points are your EXP. A tie goes to the faster finish.',
        'Everything stays sealed until everyone closes the case or time runs out. With teams, the team score is its players’ average.',
      ],
    },
  ],
  setup: {
    solo: [],
    offline: [],
    // CF12: the host's time limit.
    online: [
      {
        key: 'timelimit',
        label: 'Time limit',
        choices: [
          { value: 5, label: '5 min', note: 'quick' },
          { value: 10, label: '10 min' },
          { value: 15, label: '15 min', note: 'long' },
        ],
        initial: 10,
      },
    ],
  },
  players: { offline: { min: 2, max: 6 } },
  teams: { offline: true, online: true },
  teamScore: 'average',
  playersNote: () => 'Player 1 is you, the phone owner: a wrong first diagnosis of yours goes to Learn. Pass the phone earns no EXP.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  Online: OnlinePlay,
  // RS3: one look of its own, so its shell screens are drawn in the Evidence board look too.
  palette: { seats: INK, teams: INK_TEAMS },
  screens: caseFilesScreens,
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
