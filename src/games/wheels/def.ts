import type { GameDef } from '../shell/types';
import { MIXES, soloExp, STYLES } from './core';
import { answerLabel, questionById } from './data';
import { BOSS_BONUS } from './offline';
import { OfflinePlay } from './OfflinePlay';
import { OnlinePlay } from './OnlinePlay';
import { wheelsScreens } from './screens';
import { SoloPlay } from './SoloPlay';
import { GEMS } from './velvet';

const TARGET = {
  key: 'target',
  label: 'First to',
  choices: [
    { value: 50, label: '50', note: 'POINTS' },
    { value: 100, label: '100', note: 'POINTS' },
  ],
  initial: 50,
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
      blurb: 'Spin the three wheels and answer what they pick, turn after turn, until you reach the target.',
      howTo: [
        'Pick a target of 50 or 100 points, and mixed, clinical or basic science questions.',
        'Each turn the wheels pick how many questions (1 to 3), their style and their field.',
        'Seven styles, each with its own points and timer: from True or False (1 point) to Matching (3 points).',
        'Rule 2 Out and Matching are all or nothing.',
        'You earn half your points as EXP. Solo has no cards, Boss Round or Redemption.',
      ],
    },
    {
      mode: 'offline',
      title: 'The full show',
      blurb: 'Tarot cards, Boss Rounds and Redemption for 2 to 4 players on one phone.',
      howTo: [
        'Add 2 to 4 players. Everyone is dealt 2 tarot cards and keeps them secret.',
        'The show has three acts of 3, 2 and 2 rounds. Each round opens with a card window, then everyone spins.',
        'Each act ends with a Boss Round: swipe the items that fit. The best swiper wins +20.',
        'Last place holding The World can swap a turn for a Redemption round.',
        'First to the target wins at once. Otherwise the best score after Act III wins. No EXP in this mode.',
      ],
    },
    {
      mode: 'online',
      title: 'Live on stage',
      blurb: 'The full show for 2 to 4 players, each on their own phone.',
      howTo: [
        'The host picks a target of 50 or 100 points and the question type. 2 to 4 players, no teams.',
        'Players take turns while the whole room watches. Your cards stay secret on your own phone.',
        'A card aimed at you gives you 15 seconds to answer it, or it lands.',
        'The Boss Round is played by everyone at once, each on their own phone.',
        'Card plays and Boss Round winners show up as alerts. You earn half your points as EXP.',
      ],
    },
  ],
  setup: { solo: [TARGET, MIX], offline: [TARGET, MIX], online: [TARGET, MIX] },
  players: { offline: { min: 2, max: 4 }, online: { min: 2, max: 4 } },
  playersNote: () => '2 to 4 players, each with a character. Player I is you, the phone owner. Pass the phone earns no EXP.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  Online: OnlinePlay,
  // WC11: Solo and Online EXP is half the points; Offline earns none. Online can add a Sun-doubled turn and a Boss bonus.
  exp: (score) => soloExp(score),
  expCap: (settings, mode) =>
    mode === 'offline' ? 0 : soloExp((Number(settings.target) || 50) + (mode === 'online' ? 2 * BEST_TURN + BOSS_BONUS : BEST_TURN)),
  itemLabel: (item) => {
    const q = questionById.get(item.itemId);
    return q ? answerLabel(q) : item.itemId;
  },
  itemNoun: 'turn',
  itemsTitle: 'Questions',
  // RS3: one look of its own (Velvet stage), so its shell screens are drawn in that look too.
  palette: { seats: GEMS, teams: [] },
  screens: wheelsScreens,
};
