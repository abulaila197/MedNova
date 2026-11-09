import type { GameDef } from '../shell/types';
import { CF } from './core';
import { CASES, caseById } from './data';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

/** Online cases in a row (1-3; an older room has none and plays one). */
const cases = (settings: Record<string, unknown>) => Math.min(3, Math.max(1, Number(settings.count) || 1));
/** The most right differential names one case can pay (#67: the longest doctor's list). */
const MOST_RIGHT = Math.max(...CASES.map((c) => c.answers.length));

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
        'Request the examination, read at least one page, then narrow your list. Both lists score against the doctor\'s list, each name once.',
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
      mode: 'bots',
      title: 'Case showdown',
      blurb: 'The same case as the rivals, with live progress.',
      howTo: [
        'Pick Easy, Medium or Hard and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.',
        'Everyone gets the same random case at the same time and works it alone, against the time limit.',
        'Pick 1, 2 or 3 cases. They come one after another, each with the full time limit, and your points add up.',
        'You see when a rival closes the case. Everything stays sealed until the end, then you see every rival\'s diagnosis.',
        'Scoring is the same as Solo, and every case\'s points are your EXP. A tie goes to the faster finish.',
      ],
    },
  ],
  setup: {
    solo: [],
    offline: [],
    // CF12: the host's time limit, per case; 1 to 3 cases back to back, points add up (Yazan, 2026-10-25).
    bots: [
      {
        key: 'count',
        label: 'Cases',
        choices: [
          { value: 1, label: '1 case' },
          { value: 2, label: '2 cases' },
          { value: 3, label: '3 cases' },
        ],
        initial: 1,
      },
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
  bots: { min: 1, max: 3 },
  teams: { offline: true, bots: true },
  teamScore: 'average',
  playersNote: () => 'Player 1 is you, the phone owner: a wrong first diagnosis of yours goes to Learn. Pass the phone earns no EXP.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // CF6: a Solo case pays its points the first time only; Offline pays nothing.
  exp: (_score, items) => items.reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : (mode === 'bots' ? cases(settings) : 1) * (MOST_RIGHT * CF.points.ddRight + CF.points.provisional + CF.points.timeMax)),
  itemLabel: (item) => {
    const c = caseById.get(item.itemId);
    return c ? `${c.title}: ${c.final}` : item.itemId;
  },
  itemNoun: 'case',
  itemsTitle: 'Cases',
};
