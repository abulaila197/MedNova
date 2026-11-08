// Trust Me Not: The Year of Hunger. Every number from the rule book v2
// (/mnt/project-files/mednova/new-games/trust-me-not-rulebook.md). Section numbers are in the comments.

import type { EffectId, ItemId, MealId, MissionId, RoundId, WildId } from './types';

export const MONTHS = 12;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

/** §1 Seasons: months 1-3 Autumn, 4-6 Winter, 7-9 Spring, 10-12 Summer. */
export const seasonOf = (month: number) => Math.min(3, Math.floor((month - 1) / 3)) as 0 | 1 | 2 | 3;
export const SEASON_NAMES = ['Autumn', 'Winter', 'Spring', 'Summer'] as const;
/** Question difficulty used in each season (bank difficulty 1-4). */
export const SEASON_DIFFICULTY = [1, 2, 3, 4] as const;
/** Gap timers in seconds: step 1 (trade) and step 2 (votes). */
export const GAP_SECONDS: [number, number][] = [[120, 60], [100, 50], [80, 40], [60, 30]];

// §2 Resources
export const START_HEALTH = 100;
export const WALLET_PER_PLAYER = 25;
export const START_JEWELS = 6;
export const JEWEL_COINS = 10;
export const MERCY_AT = 15;
export const MERCY_HEAL = 15;
export const ANEMIC_CAP = 70;

/** §2 Food: Basic meal price and hunger drain by season; Skip drains x1.5 (rounded as in the table). */
export const MEAL_PRICE = [5, 7, 11, 15];
export const DRAIN = [5, 8, 10, 13];
export const SKIP_DRAIN = [8, 12, 15, 20];
export const MEALS: Record<MealId, { priceX: number; heal: number }> = {
  scraps: { priceX: 0.5, heal: 5 },
  basic: { priceX: 1, heal: 15 },
  feast: { priceX: 2, heal: 30 },
  skip: { priceX: 0, heal: 0 },
};

export const POISON_GIFT_EXTRA = 2;
export const DEBT_CALL_FROM_MONTH = 10;
export const DEBT_DAMAGE_PER_JEWEL = 5;
export const DEBT_DAMAGE_MAX = 30;

// §4 Market
export const MARKET_SIZE = 10;
export const MARKET_STOCK = 2;
export const PRICE_X = [1, 1.5, 2.2, 3];
export const ITEMS: Record<ItemId, { price: number; cures?: EffectId }> = {
  ors: { price: 6, cures: 'dehydrated' },
  'protein-ration': { price: 8, cures: 'weak' },
  'honey-lozenges': { price: 4, cures: 'hoarse' },
  blanket: { price: 8, cures: 'frostbitten' },
  paracetamol: { price: 5, cures: 'feverish' },
  iron: { price: 5, cures: 'anemic' },
  'map-and-compass': { price: 6, cures: 'lost' },
  'snake-antivenom': { price: 15, cures: 'snakebite' },
  'rabies-vaccine': { price: 14, cures: 'dog-bite' },
  'activated-charcoal': { price: 7, cures: 'poisoned' },
  doxycycline: { price: 14, cures: 'rat-bite' },
  'first-aid': { price: 10 },
  'lock-box': { price: 10 },
  lantern: { price: 8 },
  'hooded-cloak': { price: 12 },
  'pocket-guide': { price: 6 },
  stethoscope: { price: 8 },
  snare: { price: 10 },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const FIRST_AID_BLOCK = 10;
export const LOCK_BOX_JEWELS = 2;
export const STETHOSCOPE_MS = 10_000;
/** §7.4 Snare: Summer only, 10 coins flat (no season multiplier), takes 2 jewels. */
export const SNARE_PRICE = 10;
export const SNARE_TAKES = 2;

// §5 Rounds
export type RoundMode = 'team-vote' | 'solo' | 'solo-competitive' | 'pairs' | 'team-target' | 'linked';
export const ROUNDS: Record<RoundId, { mode: RoundMode; questions: number; seconds: number }> = {
  granary: { mode: 'team-vote', questions: 8, seconds: 15 },
  forager: { mode: 'solo', questions: 5, seconds: 10 },
  mine: { mode: 'team-vote', questions: 5, seconds: 15 },
  prospector: { mode: 'solo', questions: 5, seconds: 10 },
  jar: { mode: 'team-vote', questions: 5, seconds: 10 },
  purse: { mode: 'solo', questions: 5, seconds: 10 },
  cavein: { mode: 'team-vote', questions: 5, seconds: 10 },
  pickpocket: { mode: 'solo', questions: 5, seconds: 10 },
  lean: { mode: 'solo-competitive', questions: 8, seconds: 10 },
  offering: { mode: 'solo-competitive', questions: 5, seconds: 10 },
  hands: { mode: 'pairs', questions: 5, seconds: 15 },
  gate: { mode: 'team-target', questions: 5, seconds: 15 },
  buried: { mode: 'team-target', questions: 5, seconds: 10 },
  hero: { mode: 'solo', questions: 3, seconds: 15 },
  signal: { mode: 'team-target', questions: 5, seconds: 15 },
  supplier: { mode: 'solo', questions: 5, seconds: 10 },
  whisperer: { mode: 'pairs', questions: 5, seconds: 15 },
  wager: { mode: 'team-target', questions: 5, seconds: 15 },
  chain: { mode: 'linked', questions: 1, seconds: 10 },
};
/** §7.3: EXP counts solo rounds only; Chain of Trust is a solo round (linked), so a right answer there still pays. */
export const countsAsSolo = (mode: RoundMode) => mode === 'solo' || mode === 'solo-competitive' || mode === 'linked';
/** The Learn feed takes solo misses, but not Chain of Trust ('linked'): there a wrong answer is the goal, not a miss. */
export const feedsLearn = (mode: RoundMode) => mode === 'solo' || mode === 'solo-competitive';
export const OPENING_COIN: RoundId[] = ['granary', 'forager'];
export const OPENING_JEWEL: RoundId[] = ['mine', 'prospector'];
export const DAMAGE_CONTROL: RoundId[] = ['jar', 'purse', 'cavein', 'pickpocket'];
/** Middle pool (months 4-9); a linked pair (Buried Alive + Hero, Signal Fire + Supplier) fills one month. */
export const MIDDLE_POOL: RoundId[] = [...DAMAGE_CONTROL, 'lean', 'offering', 'hands', 'gate', 'buried', 'signal'];
export const FINALE: Record<number, RoundId> = { 10: 'whisperer', 11: 'wager', 12: 'chain' };
export const TEAM_TARGET = 0.6;
/** Most a month can need: Signal Fire 5 + The Supplier 5. */
export const QUESTIONS_PER_MONTH = 10;

export const GRANARY_COINS = 12;
export const FORAGER_COINS = 5;
export const JAR_RISK = 0.3;
export const PURSE_RISK = 0.2;
export const CAVEIN_LOSS = 0.1;
export const PICKPOCKET_LOSS = 0.1;
export const LEAN_LOSS = 0.25;
export const OFFERING_LOSS = 20;
export const PAIR_LOSS = 6;
export const GATE_MISS = { health: 5, wallet: 0.1 };
export const BURIED_MISS = 25;
export const HERO = { hold: 25, needed: 2, win: 2, failHealth: 10 };
export const SIGNAL_MISS_WALLET = 0.1;
export const SUPPLIER_COINS_PER_PLAYER = 5;
export const SUPPLIER_SKIM_MAX = 0.2;
export const WAGER_MISS_WALLET = 0.2;
export const CHAIN_STAKE = 0.2;
export const CHAIN_ALL_WRONG_HEAL = 10;

// §6 Obstacles
export const EFFECT_IDS: EffectId[] = [
  'dehydrated', 'weak', 'hoarse', 'frostbitten', 'feverish', 'anemic', 'lost', 'snakebite', 'dog-bite', 'poisoned', 'rat-bite',
];
export const MAX_EFFECTS = 3;
/** Health lost when the effect lands. */
export const EFFECT_HIT: Partial<Record<EffectId, number>> = { snakebite: 10, 'dog-bite': 5 };
export const SNAKEBITE_MONTHLY = 5;
export const POISON_MONTHLY = 5;
export const POISON_MONTHS = 2;
export const RABIES_AFTER = 2;
export const RABIES_MONTHLY = 15;
export const DEHYDRATED_TIMER = 0.7;
export const MIN_TIMER_MS = 4000;
/** Hits per month for 4 players; scaled by players / 4 and rounded. */
export const HITS_FOR_4 = [1, 2, 3, 3];
/** Chance (per hit) that targeting picks the Star Player or Weak Link instead of a random player, months 1-12. */
export const TARGETING_CHANCE = [0, 0, 0, 0.05, 0.07, 0.1, 0.14, 0.19, 0.27, 0.37, 0.5, 0.5];

// §7 Missions
export const MISSIONS: Record<MissionId, { betrayal: boolean; reward: number }> = {
  skim: { betrayal: true, reward: 0 },
  steal: { betrayal: true, reward: 2 },
  sabotage: { betrayal: true, reward: 2 },
  poisoner: { betrayal: true, reward: 2 },
  'cold-shoulder': { betrayal: true, reward: 0 },
  guardian: { betrayal: false, reward: 3 },
  'false-whisper': { betrayal: true, reward: 2 },
  'bad-hands': { betrayal: true, reward: 2 },
  'chain-breaker': { betrayal: true, reward: 1 },
  loyal: { betrayal: false, reward: 2 },
  'fallen-hero': { betrayal: true, reward: 3 },
  'free-rider': { betrayal: true, reward: 0 },
  'clock-thief': { betrayal: true, reward: 1 },
  fog: { betrayal: true, reward: 2 },
  'ghost-vote': { betrayal: true, reward: 0 },
};
export const SKIM_MAX = 0.1;
export const FREE_RIDER_SHARE = 0.25;
export const CLOCK_THIEF_MS = 5000;
export const GUARDIAN_ABOVE = 50;
/** Mission holders per season (§7.1): Autumn 1 small mission in month 3, Winter 1, Spring 2 (clashing), Summer everyone. */
export const HOLDERS = [1, 1, 2, Infinity];

// §7.6 Suspicion Heat
export const HEAT_INQUISITION = 5;
export const INQUISITION_RIGHT_PAYS = 2;
export const INQUISITION_WRONG_PAYS = 1;

// §9 Chaos
export const SQUEEZE: Record<number, number> = { 10: 0.8, 11: 0.88, 12: 0.95 };
export const SQUEEZE_SPLIT = { food: 0.5, treatments: 0.25, obstacles: 0.25 };
export const WILD_FROM_MONTH = 4;
export const WILD_CHANCE = 0.2;
export const WILD_MAX = 3;
export const WILD_IDS: WildId[] = ['storm', 'caravan', 'wolves', 'donor', 'cold-snap', 'heat-wave', 'clean-spring', 'doctor'];
export const CARAVAN = { extra: 4, discount: 0.25 };
export const WOLVES_HEALTH = 5;
export const DONOR_COINS_PER_PLAYER = 10;
export const DRAIN_WEATHER = 5;
export const DOCTOR_JEWELS = 6;
export const RUMOR_FROM_MONTH = 4;
export const RUMOR_COUNT = 8;
/** Rumor cards that name a player (§9, writing file). */
export const RUMORS_NAMING = [2, 4, 6, 8];
export const LIFELINE_HEAL = 50;
export const LIFELINE_DANGER_AT = 30;

// §11 Scoring and EXP
export const SCORE_PER_JEWEL = 3;
export const EXP = { perSoloRight: 2, survival: 20, perAward: 10 };
