import type { GameDef, SetupOption } from '../shell/types';
import { STF } from './core';
import { caseById, fieldLabel, fieldMenu } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

const casesOf = (settings: Record<string, unknown>) => Number(settings.cases) || 3;

// Setup (Yazan 2026-11-12): 1, 3 or 5 cases (fields behind the arrow), and a clock per case in Solo and vs rivals.
const CASES: SetupOption = {
  key: 'cases',
  label: tr('Cases'),
  choices: STF.cases.map((n) => ({ value: n, label: n === 1 ? tr('1 case') : tr('{n} cases', { n }), note: n === 1 ? 'quick' : n === 5 ? 'long' : undefined })),
  initial: 3,
  fields: () => fieldMenu(),
};
const CLOCK: SetupOption = {
  key: 'clock',
  label: tr('Clock'),
  choices: STF.clocks.map((n) => ({ value: n, label: n ? tr('{n} min clock', { n }) : tr('No clock'), note: n ? tr('each case') : undefined })),
  initial: 0,
};

const POINTS = tr('Points: a right stage +{right}, both wrong {bothWrong}, a hard case with both right +{hardBonus} more.', { right: STF.right, bothWrong: STF.bothWrong, hardBonus: STF.hardBonus });

/** Spot the Flaw (Yazan's cards 2026-11-12): one hospital story, one hidden mistake. Solo, Pass the phone, vs rivals. */
export const spotTheFlaw: GameDef = {
  key: 'spot-the-flaw',
  modes: [
    {
      mode: 'solo',
      title: tr('Case by case'),
      blurb: tr('Read the story, catch the mistake, then fix it.'),
      howTo: [
        tr('Each case is a short hospital story with one real mistake. Many details look wrong; only one is.'),
        tr('Stage 1: what went wrong? Lock in one of 4 choices. Stage 2: what should have happened? It comes even if stage 1 was wrong.'),
        POINTS,
        tr('Help, once each a case: 50/50 for {fiftyCost} tokens, or Highlight the part of the story for {highlightCost} tokens.', { fiftyCost: STF.fiftyCost, highlightCost: STF.highlightCost }),
        tr('After every case the card explains the mistake and why the rest were fine. Points are your EXP (up to {expCase} a case, {expDay} a day). Missed cases go to Learn.', { expCase: STF.expCase, expDay: STF.expDay }),
      ],
    },
    {
      mode: 'offline',
      title: tr('Same case, secret answers'),
      blurb: tr('Pass the phone. Everyone answers, then all reveal.'),
      howTo: [
        tr('Add 2 to 6 players. Everyone gets the same case.'),
        tr('In turn, each player answers both stages in secret, then passes the phone.'),
        tr('When everyone has answered, all the answers show together with the explanation.'),
        tr('{POINTS} No help or clock here. Ties go to fewer double-wrongs. No EXP in this mode.', { POINTS }),
        tr('You can split players into teams. Teams take turns, and a team scores its players\' total.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Race the rivals'),
      blurb: tr('The same case as the rivals, answers hidden till the end.'),
      howTo: [
        tr('Pick Freshmen, Scholars or Geniuses and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Everyone reads the same case. You see who has locked in each stage, never what they picked.'),
        tr('{POINTS} No speed bonus. 50/50 and Highlight at Solo\'s prices, once each a case.', { POINTS }),
        tr('Ties go to fewer double-wrongs, then the faster player.'),
        tr('Your points are your EXP (up to {expCase} a case, {expDay} a day). Missed cases go to Learn.', { expCase: STF.expCase, expDay: STF.expDay }),
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
  // A case's EXP is its points without the hard bonus (0 to 6). Pass the phone earns none (cap 0).
  exp: (_score, items) => items.filter((i) => i.seat === 0).reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : casesOf(settings) * STF.expCase),
  expDay: STF.expDay,
  itemLabel: (item) => {
    const c = caseById.get(item.itemId);
    return c ? `${c.t} · ${fieldLabel(c.f)}` : item.itemId;
  },
  itemNoun: 'case',
  itemsTitle: tr('Cases'),
  summary: (play, items) => {
    const mine = items.filter((i) => i.seat === 0);
    const pts = Math.max(0, mine.reduce((a, i) => a + i.points, 0));
    return [
      { value: `${mine.filter((i) => i.gameData.stage1).length}/${mine.length}`, label: tr('Flaws spotted') },
      { value: `${mine.filter((i) => i.gameData.stage2).length}/${mine.length}`, label: tr('Right fixes') },
      { value: String(pts), label: play.mode === 'offline' ? tr('Your points') : tr('Points') },
    ];
  },
};
