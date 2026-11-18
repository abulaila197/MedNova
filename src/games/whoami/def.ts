import type { GameDef, SetupOption } from '../shell/types';
import { BotsPlay } from '../diagnostic/BotsPlay';
import { maxCasePoints } from '../diagnostic/core';
import { withKit } from '../diagnostic/kit';
import { OfflinePlay } from '../diagnostic/OfflinePlay';
import { SoloPlay } from '../diagnostic/SoloPlay';
import { categoryMenu, guessName, puzzleById, slug } from './data';
import { WAI_KIT } from './kit';
import { WAI } from './rules';
import { tr } from '@/i18n';

const MAX = maxCasePoints(WAI);

/** 3, 5 or 10 questions (Yazan 2026-11-18: the count on its own row, the categories on another). */
const count = (label: string, initial: number, notes: (string | undefined)[]): SetupOption => ({
  key: 'cases',
  label,
  choices: [3, 5, 10].map((n, i) => ({ value: n, label: String(n), note: notes[i] })),
  initial,
});

/** Category: one "All" chip with the 8 categories behind its arrow (enough must stay ticked for every player's rounds). */
const category: SetupOption = {
  key: 'category',
  label: tr('Category'),
  choices: [{ value: 'all', label: tr('All') }],
  initial: 'all',
  fields: (_v, vals, seats) => categoryMenu((Number(vals.cases) || 5) * Math.max(1, seats)),
};

/**
 * Who am I? (مين أنا؟, Yazan 2026-11-17): five clues about one basic science thing (a nerve, an enzyme, a germ, a drug…),
 * from very vague to the giveaway. Race to Diagnosis's screens and rules with its own kit: no difficulty, 8 categories.
 */
export const whoAmI: GameDef = {
  key: 'who-am-i',
  modes: [
    {
      mode: 'solo',
      title: tr('Just you and the clues'),
      blurb: tr('Five clues, one answer. Name it with as few as you can.'),
      howTo: [
        tr('Each question is one thing from the basic sciences: a bone, a nerve, a hormone, an enzyme, a germ, a drug and more.'),
        tr('It starts with one vague clue. Type your answer and submit it.'),
        tr('A wrong guess shows the next clue. A wrong guess when all five clues are showing ends the question.'),
        tr('Reveal shows a clue for fewer points. Hint shows the first letter and the length for 1 token.'),
        tr('Fewer clues and a faster answer score more.'),
      ],
    },
    {
      mode: 'offline',
      title: tr('Pass the phone'),
      blurb: tr('Take turns on one phone. Everyone gets their own question.'),
      howTo: [
        tr('Add 2 to 6 players. Player 1 is you, the phone owner.'),
        tr('Each round, every player gets their own question and 90 seconds.'),
        tr('A wrong guess shows the next clue. Reveal shows one for fewer points. There is no hint.'),
        tr('Pass the phone when the curtain shows the next name. Most points after the last round wins.'),
        tr('You can split players into teams. Teams take turns one after another, and a team scores its players\' average.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Race the rivals'),
      blurb: tr('A new clue every 10 seconds. Name it before the rivals do.'),
      howTo: [
        tr('Pick Freshmen, Scholars, Geniuses or Random and 1 to 5 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Everyone gets the same question. A new clue appears every 10 seconds, and a question lasts 50 seconds.'),
        tr('Guess as often as you like. A wrong guess locks you out for 5 seconds. There is no Skip or Reveal.'),
        tr('Hint shows the first letter and the length for 1 token, like Solo.'),
        tr('Points: solving order (100, 80, 65, 50, 40, 30) + fewer clues (up to 50) + time left (up to 20).'),
        tr('Most points after the last question wins. Your unsolved questions go to your Learn review.'),
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
  Play: { solo: withKit(WAI_KIT, SoloPlay), offline: withKit(WAI_KIT, OfflinePlay), bots: withKit(WAI_KIT, BotsPlay) },
  // As Race to Diagnosis: EXP = points ÷ 10, each question counted up to the Solo most (120 = 12 EXP). Pass the phone: none.
  exp: (_score, items) => Math.floor(items.reduce((a, i) => a + Math.min(Number(i.points) || 0, MAX), 0) / 10),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : Math.floor(((Number(settings.cases) || 5) * MAX) / 10)),
  itemLabel: (item) => {
    const p = puzzleById.get(item.itemId);
    return p ? guessName(slug(p.answer)) : item.itemId;
  },
  itemNoun: 'question',
  itemsTitle: tr('Questions'),
};
