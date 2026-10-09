// Trust Me Not engine types. The whole game is one plain JSON object so the server can store it,
// send each phone its own view, and replay it from the seed.

/** The question mix the host picked (QS1). */
export type Field = 'mixed' | 'basic' | 'clinical';
export type PlayerId = string;

export type EffectId =
  | 'dehydrated' | 'weak' | 'hoarse' | 'frostbitten' | 'feverish' | 'anemic' | 'lost'
  | 'snakebite' | 'dog-bite' | 'poisoned' | 'rat-bite';

export type ItemId =
  | 'ors' | 'protein-ration' | 'honey-lozenges' | 'blanket' | 'paracetamol' | 'iron' | 'map-and-compass'
  | 'snake-antivenom' | 'rabies-vaccine' | 'activated-charcoal' | 'doxycycline' | 'first-aid' | 'lock-box'
  | 'lantern' | 'hooded-cloak' | 'pocket-guide' | 'stethoscope' | 'snare';

export type MealId = 'scraps' | 'basic' | 'feast' | 'skip';

export type RoundId =
  | 'granary' | 'forager' | 'mine' | 'prospector'
  | 'jar' | 'purse' | 'cavein' | 'pickpocket'
  | 'lean' | 'offering' | 'hands' | 'gate' | 'buried' | 'hero' | 'signal' | 'supplier'
  | 'whisperer' | 'wager' | 'chain';

export type MissionId =
  | 'skim' | 'steal' | 'sabotage' | 'poisoner' | 'cold-shoulder' | 'guardian' | 'false-whisper' | 'bad-hands'
  | 'chain-breaker' | 'loyal' | 'fallen-hero' | 'free-rider' | 'clock-thief' | 'fog' | 'ghost-vote';

export type WildId = 'storm' | 'caravan' | 'wolves' | 'donor' | 'cold-snap' | 'heat-wave' | 'clean-spring' | 'doctor';

export type Phase = 'opening' | 'gap1' | 'gap2' | 'round' | 'ledger' | 'over';

/** A question as the engine needs it: the bank id and the index of the right choice (0-2). */
export type Q = { id: string; answer: number };
export type QuestionPools = Record<1 | 2 | 3 | 4, Q[]>;

export type Effect = {
  id: EffectId;
  /** Dog bite turned to rabies (incurable). */
  rabies?: boolean;
  /** Month the effect landed (its countdown restarts when it lands again). */
  since: number;
  /** Set when the player chose to ignore it in the Gap. */
  ignored?: boolean;
};

export type Player = {
  id: PlayerId;
  name: string;
  color: string;
  health: number;
  jewels: number;
  alive: boolean;
  diedMonth: number | null;
  /** Fled the camp after a long disconnect (§10); watches as a Ghost if they return. */
  fled: boolean;
  disconnectedSince: number | null;
  mercyUsed: boolean;
  effects: Effect[];
  /** Bought items not yet used (cures wait here until their effect arrives, §4). */
  bag: ItemId[];
  lockBox: boolean;
  cloakMonth: number | null;
  meal: MealId | null;
  /** Correct answers per month (index 0 = month 1), for Star Player and Best Doctor. */
  correct: number[];
  answered: number;
  totalMs: number;
  solo: { right: number; wrong: number; missed: string[] };
  stars: Record<PlayerId, number>;
  whispers: { month: number; to: PlayerId; text: string; believed?: boolean }[];
  ghostTieBreaks: number;
  history: { month: number; jewels: number; health: number }[];
};

export type Request = {
  id: string;
  month: number;
  kind: 'supply' | 'help';
  by: PlayerId;
  meal?: MealId;
  item?: ItemId;
  effect?: EffectId;
  cost: number;
  votes: Record<PlayerId, { approve: boolean; donate: number }>;
  status: 'open' | 'approved' | 'refused' | 'failed';
  /** Cold Shoulder holder that forced the refusal. */
  forcedBy?: PlayerId;
};

export type Gift = {
  id: string;
  month: number;
  from: PlayerId;
  to: PlayerId;
  jewels: number;
  item?: ItemId;
  poisoned: boolean;
  shown: boolean;
  status: 'pending' | 'accepted' | 'refused' | 'vanished';
};

export type Debt = {
  id: string;
  month: number;
  lender: PlayerId;
  borrower: PlayerId;
  jewels: number;
  status: 'open' | 'repaid' | 'defaulted' | 'cancelled';
};

export type Snare = {
  id: string;
  month: number;
  by: PlayerId;
  target: PlayerId;
  trigger: 'help' | 'gift' | 'buy';
  status: 'set' | 'sprung' | 'revealed' | 'blocked' | 'expired';
};

export type Mission = {
  id: MissionId;
  holder: PlayerId;
  month: number;
  target?: PlayerId;
  status: 'active' | 'done' | 'failed';
  /** Jewels (or coins for Skim, the pot for Chain Breaker) actually paid. */
  paid: number;
  /** Mission-specific counters (e.g. Skim coins taken). */
  data: Record<string, number | string | boolean>;
};

export type Answer = { choice: number | null; ms: number };

export type RoundRun = {
  id: RoundId;
  questions: Q[];
  /** answers[player][questionIndex] */
  answers: Record<PlayerId, (Answer | null)[]>;
  /** Pair rounds: answerer (B) -> owners (A) they answer for. Whisperer: whisperer -> guessers. */
  pairs: { a: PlayerId; b: PlayerId }[];
  /** Whisperer signals: signals[whisperer][q] = lit choice. */
  signals: Record<PlayerId, (number | null)[]>;
  /** Hero / Supplier votes and the chosen player. */
  picks: Record<PlayerId, PlayerId>;
  chosen: PlayerId | null;
  bids: Record<PlayerId, number>;
  chainOrder: PlayerId[];
  chainStakes: Record<PlayerId, number>;
  fog: Record<number, number>;
  /** Seconds removed per player by Clock Thief. */
  clockThief: Record<PlayerId, number>;
  /** Players who used a pocket guide (50/50) or stethoscope this round. */
  helpers: Record<PlayerId, { guide?: number; stethoscope?: number }>;
  stage: 'pick' | 'bid' | 'play';
  done: boolean;
  outcome: Record<string, number | string | boolean>;
};

export type LogEntry = { month: number; kind: string; by?: PlayerId; to?: PlayerId; n?: number; text?: string; secret?: boolean };

export type Game = {
  version: 1;
  rng: number;
  field: Field;
  month: number;
  phase: Phase;
  wallet: number;
  heat: number;
  inquisitionSeason: number | null;
  inquisitionOpen: boolean;
  inquisitionVotes: Record<PlayerId, PlayerId>;
  players: Player[];
  requests: Request[];
  gifts: Gift[];
  debts: Debt[];
  snares: Snare[];
  missions: Mission[];
  market: { item: ItemId; left: number; price: number }[];
  /** Items stocked each month, to stop one being missing 3 months in a row. */
  marketHistory: ItemId[][];
  plan: RoundId[];
  round: RoundRun | null;
  /** Obstacles dealt for this month (land at resolution). */
  dealt: { player: PlayerId; effect: EffectId }[];
  wild: { used: WildId[]; current: WildId | null };
  rumor: { pen: PlayerId | null; card: number | null; names: PlayerId | null; shownMonth: number | null };
  lastSupper: Record<PlayerId, PlayerId | null>;
  lifeline: { holder: PlayerId; target: PlayerId; month: number } | null;
  squeeze: { demand: number; mealPrice: number; cureX: number; extraHit: number } | null;
  skipped: PlayerId[];
  wolvesPaid: PlayerId[];
  doctorChips: Record<PlayerId, { jewels: number; patient: PlayerId }>;
  usedQuestions: string[];
  /** Questions drawn for each month (index 0 = month 1) and how many this month has used. */
  deck: Q[][];
  deckUsed: number;
  log: LogEntry[];
  nextId: number;
};

export type Action =
  // system (server timers)
  | { type: 'ADVANCE' }
  | { type: 'DISCONNECT'; player: PlayerId }
  | { type: 'RECONNECT'; player: PlayerId }
  | { type: 'QUIT'; player: PlayerId }
  // Gap step 1
  | { type: 'SKIP'; player: PlayerId }
  | { type: 'BUY_FOOD'; player: PlayerId; meal: MealId; pay: 'wallet' | 'jewels' }
  | { type: 'BUY_ITEM'; player: PlayerId; item: ItemId; pay: 'wallet' | 'jewels'; target?: PlayerId; trigger?: Snare['trigger'] }
  | { type: 'SELL'; player: PlayerId; jewels: number }
  | { type: 'GIFT'; player: PlayerId; to: PlayerId; jewels: number; item?: ItemId; poisoned?: boolean; shown?: boolean }
  | { type: 'GIFT_REPLY'; player: PlayerId; gift: string; accept: boolean }
  | { type: 'LEND'; player: PlayerId; to: PlayerId; jewels: number }
  | { type: 'CALL_DEBT'; player: PlayerId; debt: string }
  | { type: 'REPAY'; player: PlayerId; debt: string }
  | { type: 'TREAT'; player: PlayerId; effect: EffectId; how: 'pay' | 'help' | 'ignore' }
  | { type: 'MERCY'; player: PlayerId }
  | { type: 'LANTERN'; player: PlayerId }
  | { type: 'SKIM'; player: PlayerId; coins: number }
  | { type: 'STEAL'; player: PlayerId }
  | { type: 'WHISPER'; player: PlayerId; to: PlayerId; text: string }
  | { type: 'RUMOR'; player: PlayerId; card: number | null; names?: PlayerId }
  | { type: 'LAST_SUPPER'; player: PlayerId; to: PlayerId | null }
  | { type: 'DOCTOR_CHIP'; player: PlayerId; jewels: number; patient: PlayerId }
  | { type: 'PAY_WOLVES'; player: PlayerId }
  // Gap step 2
  | { type: 'VOTE'; player: PlayerId; request: string; approve: boolean; donate?: number }
  | { type: 'ACCUSE'; player: PlayerId; target: PlayerId }
  | { type: 'COLD_SHOULDER'; player: PlayerId; request: string }
  // Round
  | { type: 'ANSWER'; player: PlayerId; q: number; choice: number | null; ms: number }
  | { type: 'SIGNAL'; player: PlayerId; q: number; choice: number }
  | { type: 'PICK'; player: PlayerId; pick: PlayerId }
  | { type: 'BID'; player: PlayerId; jewels: number }
  | { type: 'SUPPLIER_SKIM'; player: PlayerId; share: number }
  | { type: 'FOG'; player: PlayerId; q: number; choice: number }
  | { type: 'USE_ITEM'; player: PlayerId; item: 'pocket-guide' | 'stethoscope'; q: number }
  // Ledger
  | { type: 'STARS'; player: PlayerId; ratings: Record<PlayerId, number> }
  | { type: 'BELIEVED'; player: PlayerId; whisperMonth: number; believed: boolean };

export type Setup = {
  seed: number;
  field: Field;
  players: { id: PlayerId; name: string; color: string }[];
  pools: QuestionPools;
};
