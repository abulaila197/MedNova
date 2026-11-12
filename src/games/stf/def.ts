import type { GameDef, SetupOption } from '../shell/types';
import { STF } from './core';
import { caseById, fieldLabel, fieldMenu } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

const casesOf = (settings: Record<string, unknown>) => Number(settings.cases) || 3;

// Setup (Yazan 2026-11-12): 1, 3 or 5 cases (fields behind the arrow), and a clock per case in Solo and vs rivals.
const CASES: SetupOption = {
  key: 'cases',
  label: 'Cases',
  choices: STF.cases.map((n) => ({ value: n, label: n === 1 ? '1 case' : `${n} cases`, note: n === 1 ? 'quick' : n === 5 ? 'long' : undefined })),
  initial: 3,
  fields: () => fieldMenu(),
};
const CLOCK: SetupOption = {
  key: 'clock',
  label: 'Clock',
  choices: STF.clocks.map((n) => ({ value: n, label: n ? `${n} min clock` : 'No clock', note: n ? 'each case' : undefined })),
  initial: 0,
};

const POINTS = `Points: a right stage +${STF.right}, both wrong ${STF.bothWrong}, a hard case with both right +${STF.hardBonus} more.`;

/** Spot the Flaw (Yazan's cards 2026-11-12): one hospital story, one hidden mistake. Solo, Pass the phone, vs rivals. */
export const spotTheFlaw: GameDef = {
  key: 'spot-the-flaw',
  modes: [
    {
      mode: 'solo',
      title: 'Case by case',
      blurb: 'Read the story, catch the mistake, then fix it.',
      howTo: [
        'Each case is a short hospital story with one real mistake. Many details look wrong; only one is.',
        'Stage 1: what went wrong? Lock in one of 4 choices. Stage 2: what should have happened? It comes even if stage 1 was wrong.',
        POINTS,
        `Help, once each a case: 50/50 for ${STF.fiftyCost} tokens, or Highlight the part of the story for ${STF.highlightCost} tokens.`,
        `After every case the card explains the mistake and why the rest were fine. Points are your EXP (up to ${STF.expCase} a case, ${STF.expDay} a day). Missed cases go to Learn.`,
      ],
    },
    {
      mode: 'offline',
      title: 'Same case, secret answers',
      blurb: 'Pass the phone. Everyone answers, then all reveal.',
      howTo: [
        'Add 2 to 6 players. Everyone gets the same case.',
        'In turn, each player answers both stages in secret, then passes the phone.',
        'When everyone has answered, all the answers show together with the explanation.',
        `${POINTS} No help or clock here. Ties go to fewer double-wrongs. No EXP in this mode.`,
        'You can split players into teams. Teams take turns, and a team scores its players\' total.',
      ],
    },
    {
      mode: 'bots',
      title: 'Race the rivals',
      blurb: 'The same case as the rivals, answers hidden till the end.',
      howTo: [
        'Pick Freshmen, Scholars or Geniuses and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.',
        'Everyone reads the same case. You see who has locked in each stage, never what they picked.',
        `${POINTS} No speed bonus. 50/50 and Highlight at Solo's prices, once each a case.`,
        'Ties go to fewer double-wrongs, then the faster player.',
        `Your points are your EXP (up to ${STF.expCase} a case, ${STF.expDay} a day). Missed cases go to Learn.`,
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
  // A case's EXP is its points without the hard bonus (0 to 6). Pass the phone earns none (cap 0).
  exp: (_score, items) => items.filter((i) => i.seat === 0).reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : casesOf(settings) * STF.expCase),
  expDay: STF.expDay,
  itemLabel: (item) => {
    const c = caseById.get(item.itemId);
    return c ? `${c.t} · ${fieldLabel(c.f)}` : item.itemId;
  },
  itemNoun: 'case',
  itemsTitle: 'Cases',
  summary: (play, items) => {
    const mine = items.filter((i) => i.seat === 0);
    const pts = Math.max(0, mine.reduce((a, i) => a + i.points, 0));
    return [
      { value: `${mine.filter((i) => i.gameData.stage1).length}/${mine.length}`, label: 'Flaws spotted' },
      { value: `${mine.filter((i) => i.gameData.stage2).length}/${mine.length}`, label: 'Right fixes' },
      { value: String(pts), label: play.mode === 'offline' ? 'Your points' : 'Points' },
    ];
  },
};
