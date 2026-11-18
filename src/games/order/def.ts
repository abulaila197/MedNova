import type { GameDef, SetupOption } from '../shell/types';
import { BotsPlay } from './BotsPlay';
import { ORDER, runExp } from './core';
import { categoryMenu, questionById } from './data';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

/** 3, 5 or 10 questions (or rounds), on their own row like Who am I?. */
const count = (label: string, initial: number, notes: (string | undefined)[]): SetupOption => ({
  key: 'cases',
  label,
  choices: ORDER.counts.map((n, i) => ({ value: n, label: String(n), note: notes[i] })),
  initial,
});

/** Category: one "All" chip with the 8 categories behind its arrow (enough must stay ticked for every player's turns). */
const category: SetupOption = {
  key: 'category',
  label: tr('Category'),
  choices: [{ value: 'all', label: tr('All') }],
  initial: 'all',
  fields: (_v, vals, seats) => categoryMenu((Number(vals.cases) || 5) * Math.max(1, seats)),
};

const POINTS = tr('Points: 100 on try 1, 70 on try 2, 40 on try 3, plus up to 20 for speed.');

/**
 * Put it in order (رتّبها صح, Yazan 2026-11-18, Group 7): drag the steps of one process into numbered slots. 2 or 3
 * decoys hide among them. Submit is all or nothing, 3 tries.
 */
export const putInOrder: GameDef = {
  key: 'put-in-order',
  modes: [
    {
      mode: 'solo',
      title: tr('Step by step'),
      blurb: tr('Drag the steps into the right order. Watch for decoys.'),
      howTo: [
        tr('Each question is one process from the basic sciences: a pathway, a sequence, a cycle and more.'),
        tr('Press a step, slide it down into a numbered slot and let go. Dropping on a filled slot swaps the two.'),
        tr('2 or 3 of the steps are decoys that belong to no slot. Leave them out.'),
        tr('Submit checks the whole order. A wrong try does not say which steps are wrong. You have 3 tries.'),
        POINTS,
        tr('Help, once each a question: Place a step for {placeCost} tokens, or Remove a decoy for {decoyCost} token.', { placeCost: ORDER.placeCost, decoyCost: ORDER.decoyCost }),
        tr('After each question you see the right order with a note for every step. Missed questions go to Learn.'),
      ],
    },
    {
      mode: 'offline',
      title: tr('Pass the phone'),
      blurb: tr('Take turns on one phone. Everyone gets their own question.'),
      howTo: [
        tr('Add 2 to 6 players. Player 1 is you, the phone owner.'),
        tr('Each round, every player gets their own question and 90 seconds.'),
        tr('3 tries, same points as Solo. There are no helpers.'),
        tr('After your turn you see the right order. Then pass the phone. Most points after the last round wins.'),
        tr('You can split players into teams. Teams take turns one after another, and a team scores its players\' average.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Race the rivals'),
      blurb: tr('Same question, 90 seconds. Watch their slots fill.'),
      howTo: [
        tr('Pick Freshmen, Scholars, Geniuses or Random and 1 to 5 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Everyone gets the same question and 90 seconds. You see each rival\'s slots fill, never their order.'),
        tr('{POINTS} Ties go to the faster player.', { POINTS }),
        tr('Place a step and Remove a decoy at Solo\'s prices, once each a question.'),
        tr('Most points after the last question wins. Your missed questions go to Learn.'),
      ],
    },
  ],
  setup: {
    solo: [count(tr('Questions'), 5, [tr('about 3 min'), tr('about 5 min'), tr('about 10 min')]), category],
    offline: [count(tr('Rounds'), 3, ['quick', undefined, 'long']), category],
    bots: [count(tr('Questions'), 5, [undefined, undefined, undefined]), category],
  },
  bots: { min: 1, max: 5 },
  teams: { offline: true, bots: true },
  players: { offline: { min: 2, max: 6 } },
  playersNote: () => tr('Player 1 is you, the phone owner. Pass the phone earns no EXP.'),
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // EXP = points ÷ 10, each question up to 12. Pass the phone earns none.
  exp: (_score, items) => items.filter((i) => i.seat === 0).reduce((a, i) => a + runExp(Number(i.points) || 0), 0),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : (Number(settings.cases) || 5) * runExp(ORDER.maxPoints)),
  itemLabel: (item) => questionById.get(item.itemId)?.q ?? item.itemId,
  itemNoun: 'question',
  itemsTitle: tr('Questions'),
};
