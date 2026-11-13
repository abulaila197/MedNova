import type { GameDef, SetupOption } from '../shell/types';
import { TTT } from './core';
import { caseById, fieldLabel, fieldMenu } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

const casesOf = (settings: Record<string, unknown>) => Number(settings.cases) || 3;
/** The most a case can give (a hard case). */
const CASE_MAX = TTT.points[3];

// Setup (Yazan 2026-11-12): 1, 3 or 5 cases (fields behind the arrow), and an optional clock a case in Solo and vs rivals.
const CASES: SetupOption = {
  key: 'cases',
  label: tr('Cases'),
  choices: TTT.cases.map((n) => ({ value: n, label: n === 1 ? tr('1 case') : tr('{n} cases', { n }), note: n === 1 ? 'quick' : n === 5 ? 'long' : undefined })),
  initial: 3,
  fields: () => fieldMenu(),
};
const CLOCK: SetupOption = {
  key: 'clock',
  label: tr('Clock'),
  choices: TTT.clocks.map((n) => ({ value: n, label: n ? tr('{n} min clock', { n }) : tr('No clock'), note: n ? tr('each case') : undefined })),
  initial: 0,
};

const POINTS = tr('Points: a right answer scores {n} on an easy case, {n2} on a medium one and {n3} on a hard one. A wrong answer scores 0.', { n: TTT.points[1], n2: TTT.points[2], n3: TTT.points[3] });

/** Trace the Treatment: Follow the Clues (Yazan's cards 2026-11-12). One story, one treatment. Solo, Pass the phone, vs rivals. */
export const traceTheTreatment: GameDef = {
  key: 'trace-the-treatment',
  modes: [
    {
      mode: 'solo',
      title: tr('Case by case'),
      blurb: tr('Read the story, follow the clues, name the treatment.'),
      howTo: [
        tr('Each case is a short patient story. Something was done for the patient: a drug, an operation, a device, a diet, a vaccine or first aid.'),
        tr('Follow the clues and pick the treatment from 4 choices. One try a case.'),
        POINTS,
        tr('Help, once a case: 50/50 for {fiftyCost} tokens.', { fiftyCost: TTT.fiftyCost }),
        tr('After every case the card shows the treatment, the key clue, and why the other choices don\'t fit. Points are your EXP (up to {expDay} a day). Missed cases go to Learn.', { expDay: TTT.expDay }),
      ],
    },
    {
      mode: 'offline',
      title: tr('Same case, secret answers'),
      blurb: tr('Pass the phone. Everyone answers, then all reveal.'),
      howTo: [
        tr('Add 2 to 6 players. Everyone gets the same case.'),
        tr('In turn, each player answers in secret, then passes the phone.'),
        tr('When everyone has answered, all the answers show together with the explanation.'),
        tr('{POINTS} No help or clock here. No EXP in this mode.', { POINTS }),
        tr('You can split players into teams. Teams take turns, and a team scores its players\' total.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Race the rivals'),
      blurb: tr('The same case as the rivals, answers hidden till the end.'),
      howTo: [
        tr('Pick Freshmen, Scholars or Geniuses and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Everyone reads the same case. You see who has locked in, never what they picked.'),
        tr('{POINTS} 50/50 at Solo\'s price, once a case.', { POINTS }),
        tr('Ties go to the faster player.'),
        tr('Your points are your EXP (up to {expDay} a day). Missed cases go to Learn.', { expDay: TTT.expDay }),
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
  playersNote: () => tr('Player 1 is you, the phone owner. Pass the phone earns no EXP.'),
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
  itemsTitle: tr('Cases'),
  summary: (play, items) => {
    const mine = items.filter((i) => i.seat === 0);
    const pts = mine.reduce((a, i) => a + i.points, 0);
    return [
      { value: `${mine.filter((i) => i.gameData.right).length}/${mine.length}`, label: tr('Treatments traced') },
      { value: String(pts), label: play.mode === 'offline' ? tr('Your points') : tr('Points') },
    ];
  },
};
