import type { GameDef } from '../shell/types';
import type { Difficulty } from './core';
import { MAX_CASE_POINTS } from './core';
import { caseById, fieldMenu, guessById, guessName, LEVELS, levelCount } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

/** The Diagnostic Pursuit on the shared shell: Solo, Pass the phone and Vs bots. */
// Field ticks: enough cases must stay ticked for the whole game (Pass the phone: every player's rounds).
const DP_FIELDS = (v: string | number, vals: Record<string, string | number>, seats: number) => fieldMenu(v as Difficulty, (Number(vals.cases) || 5) * Math.max(1, seats));

export const diagnosticPursuit: GameDef = {
  key: 'the-diagnostic-pursuit',
  modes: [
    {
      mode: 'solo',
      title: tr('Just you and the cases'),
      blurb: tr('Clues arrive one by one. Name the disease with as few as you can.'),
      howTo: [
        tr('Each case starts with one clue. Type a diagnosis and submit it.'),
        tr('A wrong guess shows the next clue. A wrong guess when all six clues are showing ends the case.'),
        tr('Reveal shows a clue for fewer points. Hint shows the medical field for 1 token.'),
        tr('Fewer clues and a faster answer score more.'),
      ],
    },
    {
      mode: 'offline',
      title: tr('Pass the phone'),
      blurb: tr('Take turns on one phone. Everyone gets their own case.'),
      howTo: [
        tr('Add 2 to 6 players. Player 1 is you, the phone owner.'),
        tr('Each round, every player gets their own case and 90 seconds.'),
        tr('A wrong guess shows the next clue. Reveal shows one for fewer points. There is no hint.'),
        tr('Pass the phone when the curtain shows the next name. Most points after the last round wins.'),
        tr('You can split players into teams. Teams take turns one after another, and a team scores its players\' average.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Diagnosis showdown'),
      blurb: tr('A new clue every 10 seconds. Beat the rivals to the diagnosis.'),
      howTo: [
        tr('Pick Freshmen, Scholars or Geniuses and 1 to 5 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Everyone gets the same case. A new clue appears every 10 seconds, and a case lasts 60 seconds.'),
        tr('Guess as often as you like. A wrong guess locks you out for 5 seconds. There is no Skip or Reveal.'),
        tr('Hint shows the medical field for 1 token, like Solo.'),
        tr('Points: solving order (100, 80, 65, 50, 40, 30) + fewer clues (up to 50) + time left (up to 20).'),
        tr('Most points after the last case wins. Your unsolved cases go to your Learn review.'),
      ],
    },
  ],
  setup: {
    solo: [
      {
        key: 'difficulty',
        label: tr('Difficulty'),
        choices: LEVELS.map((d) => ({ value: d, label: tr(d), note: tr('{n} cases', { n: levelCount(d) }) })),
        initial: 'Medium',
        fields: DP_FIELDS,
      },
      {
        key: 'cases',
        label: tr('Cases'),
        choices: [
          { value: 3, label: '3', note: tr('about 3 min') },
          { value: 5, label: '5', note: tr('about 5 min') },
          { value: 10, label: '10', note: tr('about 10 min') },
        ],
        initial: 5,
      },
    ],
    offline: [
      {
        key: 'difficulty',
        label: tr('Difficulty'),
        choices: LEVELS.map((d) => ({ value: d, label: tr(d), note: tr('{n} cases', { n: levelCount(d) }) })),
        initial: 'Medium',
        fields: DP_FIELDS,
      },
      {
        key: 'cases',
        label: tr('Rounds'),
        choices: [
          { value: 3, label: '3', note: 'quick' },
          { value: 5, label: '5' },
          { value: 10, label: '10', note: 'long' },
        ],
        initial: 3,
      },
    ],
    bots: [
      {
        key: 'difficulty',
        label: tr('Difficulty'),
        choices: LEVELS.map((d) => ({ value: d, label: tr(d) })),
        initial: 'Medium',
        fields: DP_FIELDS,
      },
      {
        key: 'cases',
        label: tr('Cases'),
        choices: [
          { value: 3, label: '3' },
          { value: 5, label: '5' },
          { value: 10, label: '10' },
        ],
        initial: 5,
      },
    ],
  },
  bots: { min: 1, max: 5 },
  teams: { offline: true, bots: true },
  players: { offline: { min: 2, max: 6 } },
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // DP4: EXP = points ÷ 10, each case counted up to the Solo most (120 points = 12 EXP), online too (DPN3: race bonuses
  // still rank players, they don't add EXP).
  // Playing your own case is practice: no EXP (Yazan 2026-10-12).
  exp: (_score, items, settings) => (settings?.custom ? 0 : Math.floor(items.reduce((a, i) => a + Math.min(Number(i.points) || 0, MAX_CASE_POINTS), 0) / 10)),
  // DPO6 (revised): Offline earns no EXP, like Medicordle; the owner's misses still feed Learn.
  expCap: (settings, mode) => (mode === 'offline' ? 0 : Math.floor((Number(settings.cases) || 5) * MAX_CASE_POINTS / 10)),
  itemLabel: (item) => {
    const c = caseById.get(item.itemId);
    return (c && guessById.has(c.answer_id) ? guessName(c.answer_id) : c?.disease) ?? item.itemId;
  },
};
