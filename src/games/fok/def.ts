import type { GameDef, SetupOption } from '../shell/types';
import { FOK } from './core';
import { GROUPS, fieldLabel, fieldMenu, groupById } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

const boardsOf = (settings: Record<string, unknown>) => Number(settings.boards) || 3;

// FK setup (Yazan 2026-11-12): 1, 3 or 5 boards (fields behind the arrow), and a clock per board in Solo and vs rivals.
const BOARDS: SetupOption = {
  key: 'boards',
  label: tr('Boards'),
  choices: FOK.boards.map((n) => ({ value: n, label: n === 1 ? tr('1 board') : tr('{n} boards', { n }), note: n === 1 ? 'quick' : n === 5 ? 'long' : undefined })),
  initial: 3,
  fields: () => fieldMenu(),
};
const CLOCK: SetupOption = {
  key: 'clock',
  label: tr('Clock'),
  choices: FOK.clocks.map((n) => ({ value: n, label: n ? tr('{n} min clock', { n }) : tr('No clock'), note: n ? tr('each board') : undefined })),
  initial: 0,
};

/** Four of a Kind (Yazan's cards 2026-11-12): sort 16 boxes into 4 hidden groups of 4. Solo, Pass the phone, vs rivals. */
export const fourOfAKind: GameDef = {
  key: 'four-of-a-kind',
  modes: [
    {
      mode: 'solo',
      title: tr('Board by board'),
      blurb: tr('{n} medical groups. Find the four links on each board.', { n: GROUPS.length }),
      howTo: [
        tr('Each board has 16 boxes hiding 4 groups of 4. Tap 4 boxes that share a link, then Submit.'),
        tr('A right group lifts to the top. Three right and the last one falls into place.'),
        tr('You have {hearts} hearts a board. A wrong pick costs one; "One away" means 3 of your 4 belong together. The same four twice costs nothing.', { hearts: FOK.hearts }),
        tr('The hint shows one group\'s link for {revealCost} tokens, once a board. Out of hearts, {tokenPrice} token buys a heart once a board.', { revealCost: FOK.revealCost, tokenPrice: FOK.tokenPrice }),
        tr('Points: easy 1, medium 2, hard 3, minus 1 a mistake, up to {maxPoints} a board. Points are your EXP. Groups you miss go to Learn.', { maxPoints: FOK.maxPoints }),
      ],
    },
    {
      mode: 'offline',
      title: tr('One board, take turns'),
      blurb: tr('Pass the phone. One group a turn.'),
      howTo: [
        tr('Add 2 to 6 players. Everyone shares one board and finds one group a turn, in a random order each lap.'),
        tr('A right group scores its level: easy 1, medium 2, hard 3. A wrong pick scores nothing and passes the phone.'),
        tr('When three groups are found, the last one falls into place for nobody. Then the next board.'),
        tr('No hearts, hints or tokens here. Ties go to fewer mistakes. No EXP in this mode.'),
        tr('You can split players into teams. Teams take turns, and a team scores its players\' total.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Race the rivals'),
      blurb: tr('The same board as the rivals, each on your own copy.'),
      howTo: [
        tr('Pick Freshmen, Scholars or Geniuses and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Everyone plays the same board at the same time. You see how many groups each rival has found, never which.'),
        tr('{hearts} hearts a board and one token heart. The hint at Solo\'s price, once a board.', { hearts: FOK.hearts }),
        tr('A board ends when you finish it or its clock runs out. Points, then fewer mistakes, then the faster player.'),
        tr('Your points are your EXP. Groups you miss go to Learn.'),
      ],
    },
  ],
  setup: {
    solo: [BOARDS, CLOCK],
    offline: [BOARDS],
    bots: [BOARDS, CLOCK],
  },
  players: { offline: { min: 2, max: 6 } },
  bots: { min: 1, max: 3 },
  teams: { offline: true, bots: true },
  teamScore: { offline: 'sum', bots: 'average' },
  playersNote: () => tr('Player 1 is you, the phone owner. Pass the phone earns no EXP.'),
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // A board's points (after mistakes and the hint) ride on its first item; they are the EXP. Pass the phone earns none (cap 0).
  exp: (_score, items) => items.filter((i) => i.seat === 0).reduce((a, i) => a + (Number(i.gameData.boardPoints) || 0), 0),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : boardsOf(settings) * FOK.maxPoints),
  itemLabel: (item) => {
    const g = groupById.get(item.itemId);
    return g ? `${g.n} · ${fieldLabel(g.f)}` : item.itemId;
  },
  itemNoun: 'board',
  itemsTitle: tr('Groups'),
  summary: (play, items) => {
    if (play.mode === 'offline') {
      const mine = items.filter((i) => i.seat === 0 && i.outcome === 'right');
      return [
        { value: String(mine.reduce((a, i) => a + i.points, 0)), label: tr('Your points') },
        { value: String(mine.length), label: tr('Groups you found') },
      ];
    }
    const firsts = items.filter((i) => i.gameData.slot === 0);
    return [
      { value: `${items.filter((i) => i.outcome === 'right').length}/${items.length}`, label: tr('Groups found') },
      { value: String(firsts.reduce((a, i) => a + (Number(i.gameData.boardPoints) || 0), 0)), label: tr('Points') },
    ];
  },
};
