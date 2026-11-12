import type { GameDef, SetupOption } from '../shell/types';
import { TTT } from './core';
import { caseById, fieldLabel, fieldMenu } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

const casesOf = (settings: Record<string, unknown>) => Number(settings.cases) || 3;
/** The most a case can give (a hard case). */
const CASE_MAX = TTT.points[3];

// Setup (Yazan 2026-11-12): 1, 3 or 5 cases (fields behind the arrow), and an optional clock a case in Solo and vs rivals.
const CASES: SetupOption = {
  key: 'cases',
  label: 'Cases',
  choices: TTT.cases.map((n) => ({ value: n, label: n === 1 ? '1 case' : `${n} cases`, note: n === 1 ? 'quick' : n === 5 ? 'long' : undefined })),
  initial: 3,
  fields: () => fieldMenu(),
};
const CLOCK: SetupOption = {
  key: 'clock',
  label: 'Clock',
  choices: TTT.clocks.map((n) => ({ value: n, label: n ? `${n} min clock` : 'No clock', note: n ? 'each case' : undefined })),
  initial: 0,
};

const POINTS = `Points: a right answer scores ${TTT.points[1]} on an easy case, ${TTT.points[2]} on a medium one and ${TTT.points[3]} on a hard one. A wrong answer scores 0.`;

/** Trace the Treatment: Follow the Clues (Yazan's cards 2026-11-12). One story, one treatment. Solo, Pass the phone, vs rivals. */
export const traceTheTreatment: GameDef = {
  key: 'trace-the-treatment',
  modes: [
    {
      mode: 'solo',
      title: 'Case by case',
      blurb: 'Read the story, follow the clues, name the treatment.',
      howTo: [
        'Each case is a short patient story. Something was done for the patient: a drug, an operation, a device, a diet, a vaccine or first aid.',
        'Follow the clues and pick the treatment from 4 choices. One try a case.',
        POINTS,
        `Help, once a case: 50/50 for ${TTT.fiftyCost} tokens.`,
        `After every case the card shows the treatment, the key clue, and why the other choices don't fit. Points are your EXP (up to ${TTT.expDay} a day). Missed cases go to Learn.`,
      ],
    },
    {
      mode: 'offline',
      title: 'Same case, secret answers',
      blurb: 'Pass the phone. Everyone answers, then all reveal.',
      howTo: [
        'Add 2 to 6 players. Everyone gets the same case.',
        'In turn, each player answers in secret, then passes the phone.',
        'When everyone has answered, all the answers show together with the explanation.',
        `${POINTS} No help or clock here. No EXP in this mode.`,
        'You can split players into teams. Teams take turns, and a team scores its players\' total.',
      ],
    },
    {
      mode: 'bots',
      title: 'Race the rivals',
      blurb: 'The same case as the rivals, answers hidden till the end.',
      howTo: [
        'Pick Freshmen, Scholars or Geniuses and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.',
        'Everyone reads the same case. You see who has locked in, never what they picked.',
        `${POINTS} 50/50 at Solo's price, once a case.`,
        'Ties go to the faster player.',
        `Your points are your EXP (up to ${TTT.expDay} a day). Missed cases go to Learn.`,
      ],
    },
  ],
  setup: {
    solo: [CASES, CLOCK],
    offline: [CASES],
    bots: [CASES, CLOCK],
  },
  players: { offline: { min: 2, max: 6 } },
  bots: { min: 1, max: 3 },
  teams: { offline: true, bots: true },
  teamScore: { offline: 'sum', bots: 'average' },
  playersNote: () => 'Player 1 is you, the phone owner. Pass the phone earns no EXP.',
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // A case's EXP is its points (0 to 4). Pass the phone earns none (cap 0).
  exp: (_score, items) => items.filter((i) => i.seat === 0).reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : casesOf(settings) * CASE_MAX),
  expDay: TTT.expDay,
  itemLabel: (item) => {
    const c = caseById.get(item.itemId);
    return c ? `${c.t} · ${fieldLabel(c.f)}` : item.itemId;
  },
  itemNoun: 'case',
  itemsTitle: 'Cases',
  summary: (play, items) => {
    const mine = items.filter((i) => i.seat === 0);
    const pts = mine.reduce((a, i) => a + i.points, 0);
    return [
      { value: `${mine.filter((i) => i.gameData.right).length}/${mine.length}`, label: 'Treatments traced' },
      { value: String(pts), label: play.mode === 'offline' ? 'Your points' : 'Points' },
    ];
  },
};
