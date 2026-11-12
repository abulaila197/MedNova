import type { GameDef, SetupOption } from '../shell/types';
import { FOK } from './core';
import { GROUPS, fieldLabel, fieldMenu, groupById } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

const boardsOf = (settings: Record<string, unknown>) => Number(settings.boards) || 3;

// FK setup (Yazan 2026-11-12): 1, 3 or 5 boards (fields behind the arrow), and a clock per board in Solo and vs rivals.
const BOARDS: SetupOption = {
  key: 'boards',
  label: 'Boards',
  choices: FOK.boards.map((n) => ({ value: n, label: n === 1 ? '1 board' : `${n} boards`, note: n === 1 ? 'quick' : n === 5 ? 'long' : undefined })),
  initial: 3,
  fields: () => fieldMenu(),
};
const CLOCK: SetupOption = {
  key: 'clock',
  label: 'Clock',
  choices: FOK.clocks.map((n) => ({ value: n, label: n ? `${n} min clock` : 'No clock', note: n ? 'each board' : undefined })),
  initial: 0,
};

/** Four of a Kind (Yazan's cards 2026-11-12): sort 16 boxes into 4 hidden groups of 4. Solo, Pass the phone, vs rivals. */
export const fourOfAKind: GameDef = {
  key: 'four-of-a-kind',
  modes: [
    {
      mode: 'solo',
      title: 'Board by board',
      blurb: `${GROUPS.length} medical groups. Find the four links on each board.`,
      howTo: [
        'Each board has 16 boxes hiding 4 groups of 4. Tap 4 boxes that share a link, then Submit.',
        'A right group lifts to the top. Three right and the last one falls into place.',
        `You have ${FOK.hearts} hearts a board. A wrong pick costs one; "One away" means 3 of your 4 belong together. The same four twice costs nothing.`,
        `The hint shows one group's link for ${FOK.revealCost} tokens, once a board. Out of hearts, ${FOK.tokenPrice} token buys a heart once a board.`,
        `Points: easy 1, medium 2, hard 3, minus 1 a mistake, up to ${FOK.maxPoints} a board. Points are your EXP. Groups you miss go to Learn.`,
      ],
    },
    {
      mode: 'offline',
      title: 'One board, take turns',
      blurb: 'Pass the phone. One group a turn.',
      howTo: [
        'Add 2 to 6 players. Everyone shares one board and finds one group a turn, in a random order each lap.',
        'A right group scores its level: easy 1, medium 2, hard 3. A wrong pick scores nothing and passes the phone.',
        'When three groups are found, the last one falls into place for nobody. Then the next board.',
        'No hearts, hints or tokens here. Ties go to fewer mistakes. No EXP in this mode.',
        'You can split players into teams. Teams take turns, and a team scores its players\' total.',
      ],
    },
    {
      mode: 'bots',
      title: 'Race the rivals',
      blurb: 'The same board as the rivals, each on your own copy.',
      howTo: [
        'Pick Freshmen, Scholars or Geniuses and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.',
        'Everyone plays the same board at the same time. You see how many groups each rival has found, never which.',
        `${FOK.hearts} hearts a board and one token heart. The hint at Solo's price, once a board.`,
        'A board ends when you finish it or its clock runs out. Points, then fewer mistakes, then the faster player.',
        'Your points are your EXP. Groups you miss go to Learn.',
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
  playersNote: () => 'Player 1 is you, the phone owner. Pass the phone earns no EXP.',
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // A board's points (after mistakes and the hint) ride on its first item; they are the EXP. Pass the phone earns none (cap 0).
  exp: (_score, items) => items.filter((i) => i.seat === 0).reduce((a, i) => a + (Number(i.gameData.boardPoints) || 0), 0),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : boardsOf(settings) * FOK.maxPoints),
  itemLabel: (item) => {
    const g = groupById.get(item.itemId);
    return g ? `${g.n} · ${fieldLabel(g.f)}` : item.itemId;
  },
  itemNoun: 'board',
  itemsTitle: 'Groups',
  summary: (play, items) => {
    if (play.mode === 'offline') {
      const mine = items.filter((i) => i.seat === 0 && i.outcome === 'right');
      return [
        { value: String(mine.reduce((a, i) => a + i.points, 0)), label: 'Your points' },
        { value: String(mine.length), label: 'Groups you found' },
      ];
    }
    const firsts = items.filter((i) => i.gameData.slot === 0);
    return [
      { value: `${items.filter((i) => i.outcome === 'right').length}/${items.length}`, label: 'Groups found' },
      { value: String(firsts.reduce((a, i) => a + (Number(i.gameData.boardPoints) || 0), 0)), label: 'Points' },
    ];
  },
};
