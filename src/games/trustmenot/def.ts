import type { GameDef } from '../shell/types';
import { OnlinePlay } from './OnlinePlay';
import { TMN_SCREENS } from './screens';
import { TMN_SEATS } from './seats';

// QS1: the host picks Mixed (default), Clinical science or Basic science.
const FIELD = {
  key: 'mix',
  label: 'Questions',
  choices: [
    { value: 'mixed', label: 'Mixed' },
    { value: 'clinical', label: 'Clinical' },
    { value: 'basic', label: 'Basic' },
  ],
  initial: 'mixed',
};

/** Trust Me Not: The Year of Hunger. Online only, 3 to 6 players, each on their own phone. */
export const trustMeNot: GameDef = {
  key: 'trust-me-not',
  modes: [
    {
      mode: 'online',
      title: 'The Year of Hunger',
      blurb: 'Survive twelve months of famine as one camp, if you can trust each other. 3 to 6 players.',
      howTo: [
        'Each month starts with a question round: answer well and the camp eats.',
        'In the Gap you buy food and cures, give, lend, sell jewels and ask for help.',
        'Some players get secret missions. Not everyone wants the camp to live.',
        'Fall to zero health and you become a ghost who can still whisper.',
        'After month 12 the final reveal shows who helped and who betrayed.',
      ],
    },
  ],
  setup: { online: [FIELD] },
  players: { online: { min: 3, max: 6 } },
  Play: {},
  Online: OnlinePlay,
  palette: { seats: TMN_SEATS, teams: [] },
  screens: TMN_SCREENS,
  // EXP comes from the engine's reveal (rule book §11: 2 per right solo answer, 20 for surviving, 10 per award); the
  // results page passes it in the finish settings as `exp`.
  exp: (_s, _i, settings) => Math.max(0, Math.round(Number(settings?.exp ?? 0))),
  expCap: () => 250,
};
