import type { ImageSourcePropType } from 'react-native';

/** One collectable card of the hunt: art (stars are drawn on it), its mission, and the clue printed on its back. */
export type HuntCard = { key: string; name: string; stars: number; art: ImageSourcePropType; mission: string; clue: string };

// Missions are Yazan's (2026-10-11). Clue wording is a DRAFT for him to rewrite; each back hints at another card.
export const DECK: HuntCard[] = [
  { key: 'bolt', name: 'Bolt', stars: 1, art: require('../../../assets/cards/bolt.jpg'), mission: 'Sign in', clue: 'Thirteen doors, thirteen rooms, one key: you. Knock on every one of them.' },
  { key: 'iris', name: 'Iris', stars: 1, art: require('../../../assets/cards/iris.jpg'), mission: 'Play all 13 games (any mode)', clue: 'Show up like the morning ward round. Seven days in a row, no excuses.' },
  { key: 'atlas', name: 'Atlas', stars: 2, art: require('../../../assets/cards/atlas.jpg'), mission: 'Log in 7 days in a row', clue: 'Some things in the Nova Shop cost nothing at all. Taste every free sample.' },
  { key: 'nova', name: 'Nova', stars: 2, art: require('../../../assets/cards/nova.jpg'), mission: 'Collect every free token way', clue: 'Real rivals breathe on the other side. Face them fifty times.' },
  { key: 'pip', name: 'Pip', stars: 3, art: require('../../../assets/cards/pip.jpg'), mission: 'Play 50 online matches', clue: 'Be a student again. Clear a hundred cards from your review pile.' },
  { key: 'yara', name: 'Yara', stars: 3, art: require('../../../assets/cards/yara.jpg'), mission: 'Clear 100 review cards', clue: 'Nobody survives medicine alone. Gather ten friends around you.' },
  { key: 'yazan', name: 'Yazan', stars: 3, art: require('../../../assets/cards/yazan.jpg'), mission: 'Have 10 friends', clue: 'Grand rounds: win every game, in every mode, solo and side by side.' },
  { key: 'layla', name: 'Layla', stars: 4, art: require('../../../assets/cards/layla.jpg'), mission: 'Win every mode and sub mode', clue: 'Try to play a lot. I mean, like, a lot.' },
  {
    key: 'omar',
    name: 'Omar',
    stars: 5,
    art: require('../../../assets/cards/omar.jpg'),
    mission: 'Finish 300 games',
    clue: 'Three hundred cases closed and the coffee has gone cold. The shift is over, doctor. Open My card collection and claim what you have earned.',
  },
];

/** Prize for the last card (Omar), redeemed on the collection page. */
export const HUNT_PRIZE = 500;
