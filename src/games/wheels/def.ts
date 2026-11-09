import type { GameDef } from '../shell/types';
import { MIXES, soloExp, STYLES } from './core';
import { answerLabel, questionById } from './data';
import { BOSS_BONUS } from './offline';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

const TARGET = {
  key: 'target',
  label: 'First to',
  choices: [
    { value: 25, label: '25', note: 'POINTS' },
    { value: 50, label: '50', note: 'POINTS' },
  ],
  // #25/#26 (Yazan 2026-11-01): only 25 and 50, 25 first.
  initial: 25,
};

// QS1: Mixed, Clinical or Basic science, Mixed first and picked by default.
const MIX = { key: 'mix', label: 'Questions', choices: MIXES, initial: 'mixed' };

/** The biggest single turn: three Matching questions (3 points each). Solo has no Sun. */
const BEST_TURN = 3 * Math.max(...Object.values(STYLES).map((s) => s.points));

/** The Wheels of Chaos on the shared shell (WC1-WC23): Solo, Pass the phone and Online. */
export const wheelsOfChaos: GameDef = {
  key: 'the-wheels-of-chaos',
  modes: [
    {
      mode: 'solo',
      title: 'Spin to the target',
      blurb: 'Spin the wheel\'s three rings and answer what they pick, turn after turn, until you reach the target.',
      howTo: [
        'Pick a target of 25 or 50 points, and mixed, clinical or basic science questions.',
        'Each turn one spin of the wheel\'s three rings picks how many questions (1 to 3), their style and their field.',
        'Seven styles, each with its own points and timer: from True or False (1 point) to Matching (3 points).',
        'Rule 2 Out and Matching are all or nothing.',
        'You earn half your points as EXP. Solo has no Boss Round or Redemption.',
      ],
    },
    {
      mode: 'offline',
      title: 'The full show',
      blurb: 'Boss Rounds and Redemption for 2 to 4 players on one phone.',
      howTo: [
        'Add 2 to 4 players. Each round the turn order is shuffled, then everyone spins in turn.',
        'The show has three acts of 3, 2 and 2 rounds. If nobody has reached the target by then, extra acts of 2 rounds follow until someone does.',
        'Each act ends with a Boss Round: swipe the items that fit in 40 seconds. The best swiper wins a fifth of the target: +5 in a 25-point game, +10 in a 50.',
        'In the final round, whoever is last first can swap a turn for a Redemption round. Once a game, for everyone.',
        'First to the target wins at once. No EXP in this mode.',
      ],
    },
    {
      mode: 'bots',
      title: 'Live on stage',
      blurb: 'The full show against 1 to 3 rivals.',
      howTo: [
        'Pick Easy, Medium or Hard and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.',
        'Pick a target of 25 or 50 points and the question type. No teams.',
        'You and the rivals take turns. After Act III, extra acts follow until someone reaches the target.',
        'In the final round, whoever is last first can swap a turn for a Redemption round. Once a game, for everyone.',
        'The Boss Round is played by everyone at once. You earn half your points as EXP.',
      ],
    },
  ],
  setup: { solo: [TARGET, MIX], offline: [TARGET, MIX], bots: [TARGET, MIX] },
  players: { offline: { min: 2, max: 4 } },
  playersNote: () => '2 to 4 players, each with a character. Player I is you, the phone owner. Pass the phone earns no EXP.',
  bots: { min: 1, max: 3 },
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // WC11: Solo and Online EXP is half the points; Offline earns none. Online can add a Boss bonus.
  exp: (score) => soloExp(score),
  expCap: (settings, mode) =>
    mode === 'offline' ? 0 : soloExp((Number(settings.target) || 50) + (mode === 'bots' ? BEST_TURN + BOSS_BONUS : BEST_TURN)),
  itemLabel: (item) => {
    const q = questionById.get(item.itemId);
    return q ? answerLabel(q) : item.itemId;
  },
  itemNoun: 'turn',
  itemsTitle: 'Questions',
};
