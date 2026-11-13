import { groupsOf, inFields } from '../shell/fields';
import type { GameDef, SetupOption } from '../shell/types';
import { FIELDS, type Mix, MIXES, soloExp, STYLES } from './core';
import { answerLabel, BANK, questionById } from './data';
import { BOSS_BONUS } from './offline';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { clockOption } from '../shell/clockOption';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

const TARGET = {
  key: 'target',
  label: tr('First to'),
  choices: [
    { value: 25, label: '25', note: 'POINTS' },
    { value: 50, label: '50', note: 'POINTS' },
  ],
  // #25/#26 (Yazan 2026-11-01): only 25 and 50, 25 first.
  initial: 25,
};

// QS1: Mixed, Clinical or Basic science, Mixed first and picked by default.
// Field ticks (Yazan 2026-11-11): every field has about 210 questions, so one field alone is enough (50 kept ticked).
const GROUP_TITLE = { clinical: tr('Clinical'), basic: tr('Basic science') } as const;
const groupOfField = new Map(FIELDS.map((f) => [f.key as string, f.group]));
const MIX: SetupOption = {
  key: 'mix',
  label: tr('Questions'),
  choices: MIXES,
  initial: 'mixed',
  fields: (v) => {
    const mix = v as Mix;
    const items = BANK.questions.filter((q) => mix === 'mixed' || groupOfField.get(q.field) === mix);
    return {
      groups: groupsOf(items, (q) => q.field, (q) => (mix === 'mixed' ? GROUP_TITLE[groupOfField.get(q.field) ?? 'basic'] : undefined), (f) => FIELDS.find((x) => x.key === f)?.name ?? f, [tr('Clinical'), tr('Basic science')]),
      total: (t) => inFields(items, (q) => q.field, t).length,
      min: 50,
      unit: 'questions',
    };
  },
};

/** The biggest single turn: three Matching questions (3 points each). Solo has no Sun. */
const BEST_TURN = 3 * Math.max(...Object.values(STYLES).map((s) => s.points));

/** The Wheels of Chaos on the shared shell (WC1-WC23): Solo, Pass the phone and Online. */
export const wheelsOfChaos: GameDef = {
  key: 'the-wheels-of-chaos',
  modes: [
    {
      mode: 'solo',
      title: tr('Spin to the target'),
      blurb: tr('Spin the wheel\'s three rings and answer what they pick, turn after turn, until you reach the target.'),
      howTo: [
        tr('Pick a target of 25 or 50 points, and mixed, clinical or basic science questions.'),
        tr('Each turn one spin of the wheel\'s rings picks how many questions (1 to 3), their style and their field. Pick one field and only the count and style rings spin.'),
        tr('Nine styles, each with its own points and timer: from True or False (1 point) to Matching and Put in Order (3 points). Closest Number counts within 10% of the answer.'),
        tr('Acts of 3, 2 and 2 turns, then 2 each. Every act ends with a Boss Round: swipe what fits in 40 seconds. Every 4 Boss points is +1, up to a fifth of the target.'),
        tr('Once a game, after a turn with a miss, play a Redemption round: each right True or False call wins back 1 of the points you missed.'),
        tr('Pick No clock to take your time on every question. Points stay the same. Rule 2 Out, Matching and Put in Order are all or nothing.'),
        tr('You earn half your points as EXP. Every miss goes to Today\'s review on Learn.'),
      ],
    },
    {
      mode: 'offline',
      title: tr('The full show'),
      blurb: tr('Boss Rounds and Redemption for 2 to 4 players on one phone.'),
      howTo: [
        tr('Add 2 to 4 players. Each round the turn order is shuffled, then everyone spins in turn.'),
        tr('The show has three acts of 3, 2 and 2 rounds. If nobody has reached the target by then, extra acts of 2 rounds follow until someone does.'),
        tr('Each act ends with a Boss Round: swipe the items that fit in 40 seconds. The best swiper wins a fifth of the target: +5 in a 25-point game, +10 in a 50.'),
        tr('In the final round, whoever is last first can swap a turn for a Redemption round. Once a game, for everyone.'),
        tr('First to the target wins at once. No EXP in this mode.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Live on stage'),
      blurb: tr('The full show against 1 to 3 rivals.'),
      howTo: [
        tr('Pick Freshmen, Scholars or Geniuses and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Pick a target of 25 or 50 points and the question type. No teams.'),
        tr('You and the rivals take turns. After Act III, extra acts follow until someone reaches the target.'),
        tr('In the final round, whoever is last first can swap a turn for a Redemption round. Once a game, for everyone.'),
        tr('The Boss Round is played by everyone at once. You earn half your points as EXP.'),
      ],
    },
  ],
  setup: { solo: [TARGET, MIX, clockOption(tr('each question timed'))], offline: [TARGET, MIX], bots: [TARGET, MIX] },
  players: { offline: { min: 2, max: 4 } },
  playersNote: () => tr('2 to 4 players, each with a character. Player I is you, the phone owner. Pass the phone earns no EXP.'),
  bots: { min: 1, max: 3 },
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // WC11: Solo and Online EXP is half the points; Offline earns none. Online can add a Boss bonus.
  exp: (score) => soloExp(score),
  expCap: (settings, mode) =>
    mode === 'offline' ? 0 : soloExp((Number(settings.target) || 50) + (mode === 'bots' ? BEST_TURN + BOSS_BONUS : BEST_TURN)),
  itemLabel: (item) => {
    const q = questionById.get(item.itemId);
    return q ? answerLabel(q) : item.itemId;
  },
  itemNoun: 'turn',
  itemsTitle: tr('Questions'),
};
