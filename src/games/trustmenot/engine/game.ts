// Trust Me Not engine: one pure reducer, step(game, action) => game. The server owns the game object,
// runs the timers and sends ADVANCE when a timer ends (or everyone pressed Skip). Phones only send
// player actions and get their own filtered view (view.ts). Randomness comes from the seeded state,
// so a game can be replayed exactly from its seed and action list.

import * as R from './rules';
import type {
  Action, Answer, EffectId, Game, ItemId, MealId, Mission, MissionId, Player, PlayerId, Q, Request,
  RoundId, RoundRun, Setup, Snare, WildId,
} from './types';

// ---------------------------------------------------------------------------------------------
// Seeded random (mulberry32), stored in the game so every step is reproducible.

export function rand(g: Game): number {
  let t = (g.rng = (g.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(g: Game, a: readonly T[]): T => a[Math.floor(rand(g) * a.length)];
function shuffle<T>(g: Game, a: readonly T[]): T[] {
  const o = [...a];
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(rand(g) * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}
const newId = (g: Game, p: string) => `${p}${++g.nextId}`;

// ---------------------------------------------------------------------------------------------
// Lookups

export const season = (g: Game) => R.seasonOf(g.month);
export const living = (g: Game) => g.players.filter((p) => p.alive);
/** Dead players watch as Ghosts; so do players who fled and came back. */
export const ghosts = (g: Game) => g.players.filter((p) => !p.alive);
export const player = (g: Game, id: PlayerId) => {
  const p = g.players.find((x) => x.id === id);
  if (!p) throw new Error(`unknown player ${id}`);
  return p;
};
const has = (p: Player, e: EffectId) => p.effects.some((x) => x.id === e);
const log = (g: Game, kind: string, x: Omit<Game['log'][number], 'month' | 'kind'> = {}) => g.log.push({ month: g.month, kind, ...x });
const roundSec = (id: RoundId) => R.ROUNDS[id].seconds;

export function itemPrice(g: Game, item: ItemId): number {
  if (item === 'snare') return R.SNARE_PRICE;
  let price = R.ITEMS[item].price * R.PRICE_X[season(g)];
  if (g.squeeze && R.ITEMS[item].cures) price *= g.squeeze.cureX;
  const stock = g.market.find((m) => m.item === item);
  if (stock) price = stock.price; // Caravan items keep their own discounted price
  return Math.max(1, Math.round(price));
}

export function mealPrice(g: Game, meal: MealId): number {
  const basic = g.squeeze ? g.squeeze.mealPrice : R.MEAL_PRICE[season(g)];
  return Math.round(basic * R.MEALS[meal].priceX);
}

/** Gap timers for this month (Storm halves them). */
export function gapSeconds(g: Game): [number, number] {
  const [a, b] = R.GAP_SECONDS[season(g)];
  return g.wild.current === 'storm' ? [a / 2, b / 2] : [a, b];
}

/** Jewels a player can lose: a Lock box keeps 2 safe from rounds, Snares, Steal and debt calls. */
const losable = (p: Player) => Math.max(0, p.jewels - (p.lockBox ? R.LOCK_BOX_JEWELS : 0));

/** §2 rounding: nearest whole jewel, at least 1 if you own any, never more than half your stash. */
export function jewelLoss(p: Player, frac: number, protectable = true): number {
  if (p.jewels < 1) return 0;
  let k = Math.max(1, Math.round(p.jewels * frac));
  k = Math.min(k, Math.max(1, Math.floor(p.jewels / 2)));
  if (protectable) k = Math.min(k, losable(p));
  p.jewels -= k;
  return k;
}
const walletLoss = (g: Game, frac: number) => {
  const k = Math.floor(g.wallet * frac);
  g.wallet -= k;
  return k;
};
function healthCap(p: Player) {
  return has(p, 'anemic') ? R.ANEMIC_CAP : R.START_HEALTH;
}
function heal(p: Player, n: number) {
  if (!p.alive || n <= 0) return;
  p.health = Math.max(p.health, Math.min(healthCap(p), p.health + n));
}
/** Personal damage can be softened by First aid in the bag (-10, used up). */
function hurt(g: Game, p: Player, n: number, personal = false) {
  if (!p.alive || n <= 0) return;
  if (personal) {
    const i = p.bag.indexOf('first-aid');
    if (i >= 0) {
      p.bag.splice(i, 1);
      n = Math.max(0, n - R.FIRST_AID_BLOCK);
      log(g, 'first-aid', { by: p.id, secret: true });
    }
  }
  p.health = Math.max(0, p.health - n);
}
/** Paying coins with jewels: whole jewels only, the change drops into the wallet (§2). */
function payWithJewels(g: Game, p: Player, coins: number): boolean {
  const j = Math.ceil(coins / R.JEWEL_COINS);
  if (p.jewels < j) return false;
  p.jewels -= j;
  g.wallet += j * R.JEWEL_COINS - coins;
  return true;
}
const coinsToJewels = (coins: number) => Math.floor(coins / R.JEWEL_COINS);

// ---------------------------------------------------------------------------------------------
// Effects (§6)

function cureFor(e: EffectId): ItemId {
  return R.ITEM_IDS.find((i) => R.ITEMS[i].cures === e)!;
}
export function curable(p: Player, e: EffectId) {
  const fx = p.effects.find((x) => x.id === e);
  return !!fx && !fx.rabies;
}
function removeEffect(p: Player, e: EffectId) {
  p.effects = p.effects.filter((x) => x.id !== e);
}
function addEffect(g: Game, p: Player, e: EffectId, extraHit = 0) {
  if (!p.alive) return;
  const cure = p.bag.indexOf(cureFor(e));
  if (cure >= 0) {
    // A cure bought earlier waits in the bag and works when the effect arrives (§4).
    p.bag.splice(cure, 1);
    log(g, 'cured-on-arrival', { by: p.id, text: e, secret: true });
    hurt(g, p, extraHit, true);
    return;
  }
  const old = p.effects.find((x) => x.id === e);
  if (old) {
    old.since = g.month; // the same effect again restarts its countdown, no stacking
    old.ignored = false;
  } else {
    p.effects.push({ id: e, since: g.month });
    if (p.effects.length > R.MAX_EFFECTS) p.effects.shift();
  }
  if (e === 'anemic') p.health = Math.min(p.health, R.ANEMIC_CAP);
  hurt(g, p, (R.EFFECT_HIT[e] ?? 0) + extraHit, true);
  log(g, 'effect', { to: p.id, text: e, secret: true });
}

// ---------------------------------------------------------------------------------------------
// Setup

function planRounds(g: Game): RoundId[] {
  const plan: RoundId[] = [pick(g, R.OPENING_COIN), pick(g, R.OPENING_JEWEL), pick(g, R.DAMAGE_CONTROL)];
  const middle = shuffle(g, R.MIDDLE_POOL.filter((r) => r !== plan[2])).slice(0, 6);
  return [...plan, ...middle, R.FINALE[10], R.FINALE[11], R.FINALE[12]];
}

export function createGame(setup: Setup): Game {
  const n = setup.players.length;
  if (n < R.MIN_PLAYERS || n > R.MAX_PLAYERS) throw new Error('Trust Me Not needs 3 to 6 players');
  const g: Game = {
    version: 1,
    rng: setup.seed | 0,
    field: setup.field,
    month: 1,
    phase: 'opening',
    wallet: R.WALLET_PER_PLAYER * n,
    heat: 0,
    inquisitionSeason: null,
    inquisitionOpen: false,
    inquisitionVotes: {},
    players: setup.players.map((p) => ({
      ...p,
      health: R.START_HEALTH,
      jewels: R.START_JEWELS,
      alive: true,
      diedMonth: null,
      fled: false,
      disconnectedSince: null,
      mercyUsed: false,
      effects: [],
      bag: [],
      lockBox: false,
      cloakMonth: null,
      meal: null,
      correct: Array(R.MONTHS).fill(0),
      answered: 0,
      totalMs: 0,
      solo: { right: 0, wrong: 0, missed: [] },
      stars: {},
      whispers: [],
      ghostTieBreaks: 0,
      history: [],
    })),
    requests: [],
    gifts: [],
    debts: [],
    snares: [],
    missions: [],
    market: [],
    marketHistory: [],
    plan: [],
    round: null,
    dealt: [],
    wild: { used: [], current: null },
    rumor: { pen: null, card: null, names: null, shownMonth: null },
    lastSupper: {},
    lifeline: null,
    squeeze: null,
    skipped: [],
    wolvesPaid: [],
    doctorChips: {},
    usedQuestions: [],
    deck: [],
    deckUsed: 0,
    log: [],
    nextId: 0,
  };
  g.plan = planRounds(g);
  // Each month's questions are drawn up front from that season's difficulty, so the game object stays
  // small (the whole bank never travels with it) and nobody repeats a question in one game.
  for (let m = 1; m <= R.MONTHS; m++) {
    const pool = setup.pools[R.SEASON_DIFFICULTY[R.seasonOf(m)]];
    const fresh = pool.filter((q) => !g.usedQuestions.includes(q.id));
    const pickFrom = fresh.length >= R.QUESTIONS_PER_MONTH ? fresh : pool;
    const drawn = shuffle(g, pickFrom).slice(0, R.QUESTIONS_PER_MONTH);
    g.deck.push(drawn);
    g.usedQuestions.push(...drawn.map((q) => q.id));
  }
  return g;
}

/** Next unused questions from this month's deck. */
function drawQuestions(g: Game, count: number): Q[] {
  const deck = g.deck[g.month - 1];
  const used = g.deckUsed;
  const out = deck.slice(used, used + count);
  g.deckUsed += out.length;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Month flow

export function step(g0: Game, a: Action): Game {
  const g: Game = JSON.parse(JSON.stringify(g0));
  if (g.phase === 'over' && a.type !== 'STARS' && a.type !== 'BELIEVED') return g0;
  switch (a.type) {
    case 'ADVANCE':
      advance(g);
      break;
    case 'DISCONNECT':
      player(g, a.player).disconnectedSince = g.month;
      break;
    case 'RECONNECT':
      player(g, a.player).disconnectedSince = null;
      break;
    case 'QUIT':
      flee(g, player(g, a.player));
      break;
    default:
      if (!act(g, a)) return g0; // illegal actions leave the game untouched
  }
  return g;
}

function advance(g: Game) {
  switch (g.phase) {
    case 'opening':
      return enterGap1(g);
    case 'gap1':
      closeGap1(g);
      g.phase = 'gap2';
      g.skipped = [];
      return;
    case 'gap2':
      closeGap2(g);
      dealMissions(g);
      dealObstacles(g);
      startRound(g, g.plan[g.month - 1]);
      g.phase = 'round';
      return;
    case 'round':
      return advanceRound(g);
    case 'ledger':
      return nextMonth(g);
  }
}

function enterGap1(g: Game) {
  g.phase = 'gap1';
  g.skipped = [];
  g.wolvesPaid = [];
  g.doctorChips = {};
  g.lastSupper = {};
  for (const p of g.players) p.meal = null;
  if (g.month === 1 || g.month % 3 === 1) g.heat = g.heat; // heat carries across seasons
  rollWild(g);
  stockMarket(g);
  setSqueeze(g);
  g.inquisitionOpen = g.heat >= R.HEAT_INQUISITION && g.inquisitionSeason !== season(g);
  g.inquisitionVotes = {};
  // Rumor pen (§9): from Winter, one random living player each Gap.
  if (g.month >= R.RUMOR_FROM_MONTH) {
    if (g.rumor.card) g.rumor.shownMonth = g.month;
    else g.rumor.shownMonth = null;
    const lv = living(g);
    g.rumor = { ...g.rumor, pen: lv.length ? pick(g, lv).id : null };
    if (!g.rumor.shownMonth) g.rumor.card = null;
  }
  offerLifeline(g);
  // Disconnected for 2 months: they flee the camp (§10).
  for (const p of living(g)) if (p.disconnectedSince !== null && g.month - p.disconnectedSince >= 2) flee(g, p);
}

function rollWild(g: Game) {
  g.wild.current = null;
  if (g.month < R.WILD_FROM_MONTH || g.wild.used.length >= R.WILD_MAX || rand(g) >= R.WILD_CHANCE) return;
  const choices = R.WILD_IDS.filter((w) => !g.wild.used.includes(w));
  const w: WildId = pick(g, choices);
  g.wild.used.push(w);
  g.wild.current = w;
  log(g, 'wild', { text: w });
  if (w === 'donor') g.wallet += R.DONOR_COINS_PER_PLAYER * living(g).length;
  if (w === 'clean-spring') for (const p of living(g)) removeEffect(p, 'dehydrated');
}

function stockMarket(g: Game) {
  const s = season(g);
  const all: ItemId[] = R.ITEM_IDS.filter((i) => i !== 'snare');
  // No item may be missing 3 months in a row: anything absent the last 2 months is stocked first.
  const lastTwo = g.marketHistory.slice(-2);
  const overdue = lastTwo.length === 2 ? all.filter((i) => lastTwo.every((m) => !m.includes(i))) : [];
  const rest = shuffle(g, all.filter((i) => !overdue.includes(i)));
  const items = [...overdue, ...rest].slice(0, R.MARKET_SIZE);
  if (s === 3) items.push('snare');
  g.market = items.map((item) => ({ item, left: R.MARKET_STOCK, price: 0 }));
  for (const m of g.market) m.price = basePrice(g, m.item);
  if (g.wild.current === 'caravan') {
    const extra = shuffle(g, all.filter((i) => !items.includes(i))).slice(0, R.CARAVAN.extra);
    for (const item of extra) g.market.push({ item, left: R.MARKET_STOCK, price: Math.max(1, Math.round(basePrice(g, item) * (1 - R.CARAVAN.discount))) });
  }
  g.marketHistory.push(g.market.map((m) => m.item));
}
function basePrice(g: Game, item: ItemId) {
  if (item === 'snare') return R.SNARE_PRICE;
  let price = R.ITEMS[item].price * R.PRICE_X[season(g)];
  if (g.squeeze && R.ITEMS[item].cures) price *= g.squeeze.cureX;
  return Math.max(1, Math.round(price));
}

/**
 * §9 Squeeze, months 10-12. The camp's total worth times 0.80 / 0.88 / 0.95 is the month's demand,
 * split 50% food, 25% treatments, 25% obstacles; last month's accuracy lowers it by up to half.
 * Mercy floor: never more than what the 2 richest players could cover.
 */
function setSqueeze(g: Game) {
  g.squeeze = null;
  const f = R.SQUEEZE[g.month];
  if (!f) return;
  const lv = living(g);
  if (!lv.length) return;
  const worth = g.wallet + R.JEWEL_COINS * lv.reduce((s, p) => s + p.jewels, 0);
  const prev = g.month - 2;
  const acc = lv.reduce((s, p) => s + p.correct[prev], 0) / Math.max(1, lv.length * 5);
  let demand = worth * f * (1 - 0.5 * Math.min(1, acc));
  const richest = [...lv].sort((x, y) => y.jewels - x.jewels).slice(0, 2);
  const floor = g.wallet + R.JEWEL_COINS * richest.reduce((s, p) => s + p.jewels, 0);
  demand = Math.min(demand, floor);
  const base = R.MEAL_PRICE[3];
  const mealPrice = Math.max(base, Math.min(base * 3, (demand * R.SQUEEZE_SPLIT.food) / lv.length));
  const cureBase = R.ITEM_IDS.filter((i) => R.ITEMS[i].cures).reduce((s, i) => s + R.ITEMS[i].price * R.PRICE_X[3], 0) / 11;
  const cureX = Math.max(1, Math.min(2, (demand * R.SQUEEZE_SPLIT.treatments) / lv.length / cureBase));
  const extraHit = Math.min(15, Math.round((demand * R.SQUEEZE_SPLIT.obstacles) / R.JEWEL_COINS / Math.max(1, lv.length)));
  g.squeeze = { demand: Math.round(demand), mealPrice, cureX, extraHit };
}

/** §7.5 Lifeline Contract (Summer): one player in danger may be secretly offered another's death. */
function offerLifeline(g: Game) {
  g.lifeline = null;
  if (season(g) !== 3) return;
  const lv = living(g);
  const danger = lv.filter((p) => p.health <= R.LIFELINE_DANGER_AT);
  if (!danger.length || lv.length < 3 || rand(g) < 0.5) return;
  const holder = pick(g, danger);
  const target = pick(g, lv.filter((p) => p.id !== holder.id));
  g.lifeline = { holder: holder.id, target: target.id, month: g.month };
  log(g, 'lifeline', { by: holder.id, to: target.id, secret: true });
}

function closeGap1(g: Game) {
  // Unanswered gifts count as refused: the gift goes back, a poison's extra 2 jewels are lost.
  for (const gf of g.gifts.filter((x) => x.month === g.month && x.status === 'pending')) refuseGift(g, gf);
  // Last Supper (month 12): every choice shows at once.
  for (const [from, to] of Object.entries(g.lastSupper)) {
    if (!to) continue;
    const a = player(g, from), b = player(g, to);
    if (a.alive && b.alive && a.jewels > 0) {
      a.jewels--;
      b.jewels++;
    }
    log(g, 'last-supper', { by: from, to });
  }
  // Wolves: everyone -5% unless they paid 1 jewel.
  if (g.wild.current === 'wolves') for (const p of living(g)) if (!g.wolvesPaid.includes(p.id)) hurt(g, p, R.WOLVES_HEALTH);
  // Traveling Doctor: volunteers chip in jewels; the wallet covers the rest only if everyone agrees (gap 2 vote).
  if (g.wild.current === 'doctor') doctorRequest(g);
  // Called debts not repaid this Gap default (§2).
  for (const d of g.debts.filter((x) => x.status === 'open' && (x as { called?: number }).called === g.month)) {
    const b = player(g, d.borrower);
    hurt(g, b, Math.min(R.DEBT_DAMAGE_MAX, d.jewels * R.DEBT_DAMAGE_PER_JEWEL));
    d.status = 'defaulted';
    log(g, 'debt-default', { by: d.borrower, to: d.lender, n: d.jewels });
  }
  // Lost lasts one Gap.
  for (const p of living(g)) removeEffect(p, 'lost');
  // Gap missions from last month end with this Gap.
  for (const m of g.missions.filter((x) => x.status === 'active' && ['skim', 'steal'].includes(x.id) && x.month < g.month)) {
    finishGapMission(g, m);
  }
}

function doctorRequest(g: Game) {
  const chips = Object.entries(g.doctorChips);
  if (!chips.length) return;
  const byPatient: Record<string, number> = {};
  for (const [, c] of chips) byPatient[c.patient] = (byPatient[c.patient] ?? 0) + c.jewels;
  const patient = Object.entries(byPatient).sort((x, y) => y[1] - x[1])[0][0];
  const paid = byPatient[patient];
  for (const [from, c] of chips) if (c.patient !== patient) player(g, from).jewels += c.jewels; // other patients' chips go back
  const p = player(g, patient);
  if (paid >= R.DOCTOR_JEWELS) {
    p.health = healthCap(p);
    log(g, 'doctor', { to: patient });
  } else {
    g.requests.push({
      id: newId(g, 'r'), month: g.month, kind: 'help', by: patient, cost: (R.DOCTOR_JEWELS - paid) * R.JEWEL_COINS,
      votes: {}, status: 'open', effect: undefined,
    });
    (g.requests[g.requests.length - 1] as Request & { doctor?: boolean }).doctor = true;
  }
}

function finishGapMission(g: Game, m: Mission) {
  const holder = player(g, m.holder);
  if (!holder.alive) m.status = 'failed';
  else if (m.id === 'skim') m.status = (m.data.coins as number) > 0 ? 'done' : 'failed';
  else if (m.id === 'steal') m.status = m.data.taken ? 'done' : 'failed';
}

function closeGap2(g: Game) {
  for (const r of g.requests.filter((x) => x.month === g.month && x.status === 'open')) resolveRequest(g, r);
  if (g.inquisitionOpen) resolveInquisition(g);
  // Cold Shoulder ends when its Gap ends.
  for (const m of g.missions.filter((x) => x.status === 'active' && x.id === 'cold-shoulder' && x.month < g.month)) m.status = m.data.used ? 'done' : 'failed';
}

function voters(g: Game, r: Request) {
  return living(g).filter((p) => p.id !== r.by);
}

function resolveRequest(g: Game, r: Request) {
  const requester = player(g, r.by);
  if (r.forcedBy) {
    refuse(g, r);
    return;
  }
  if (r.kind === 'supply') {
    const vs = voters(g, r).map((p) => r.votes[p.id]).filter(Boolean);
    const yes = vs.filter((v) => v.approve).length;
    const no = vs.length - yes;
    let ok = yes > no || (vs.length === 0); // nobody else voted: majority of nobody, it passes
    if (yes === no && vs.length > 0) {
      const gv = ghosts(g).map((p) => r.votes[p.id]).filter(Boolean);
      const gy = gv.filter((v) => v.approve).length;
      ok = gv.length > 0 && gy * 2 > gv.length;
      if (gv.length > 0 && gy * 2 !== gv.length) for (const gp of ghosts(g)) if (r.votes[gp.id]) gp.ghostTieBreaks++;
    }
    if (!ok || g.wallet < r.cost || !requester.alive) return refuse(g, r, ok && requester.alive ? 'failed' : 'refused');
    g.wallet -= r.cost;
    r.status = 'approved';
    grant(g, requester, r);
    return;
  }
  // Help: everyone must approve; a missing vote counts as Refuse.
  const vs = voters(g, r);
  const allYes = vs.every((p) => r.votes[p.id]?.approve);
  if (!allYes || !requester.alive) return refuse(g, r);
  const donated = vs.reduce((s, p) => s + (r.votes[p.id]?.donate ?? 0), 0);
  const fromWallet = Math.max(0, r.cost - donated * R.JEWEL_COINS);
  if (fromWallet > g.wallet) {
    r.status = 'failed';
    return; // donations were never taken
  }
  for (const p of vs) {
    const d = r.votes[p.id]?.donate ?? 0;
    p.jewels -= d;
  }
  g.wallet -= fromWallet;
  g.wallet += Math.max(0, donated * R.JEWEL_COINS - r.cost); // change from donated jewels
  r.status = 'approved';
  if ((r as Request & { doctor?: boolean }).doctor) requester.health = healthCap(requester);
  else if (r.effect) removeEffect(requester, r.effect);
}

function refuse(g: Game, r: Request, status: Request['status'] = 'refused') {
  r.status = status;
  if (r.item) {
    const s = g.market.find((m) => m.item === r.item);
    if (s) s.left++;
  }
  if (status === 'refused') {
    g.heat++;
    log(g, 'heat', { text: `refused ${r.kind}` });
  }
}

function grant(g: Game, p: Player, r: Request) {
  if (r.meal) p.meal = r.meal;
  if (r.item) giveItem(g, p, r.item);
}

function giveItem(g: Game, p: Player, item: ItemId) {
  if (item === 'lock-box') p.lockBox = true;
  else if (item === 'hooded-cloak') p.cloakMonth = g.month;
  else {
    const cures = R.ITEMS[item].cures;
    if (cures && has(p, cures) && curable(p, cures)) removeEffect(p, cures);
    else p.bag.push(item);
  }
}

function resolveInquisition(g: Game) {
  g.inquisitionOpen = false;
  g.inquisitionSeason = season(g);
  g.heat = 0;
  const counts: Record<string, number> = {};
  for (const t of Object.values(g.inquisitionVotes)) counts[t] = (counts[t] ?? 0) + 1;
  const total = Object.values(g.inquisitionVotes).length;
  const top = Object.entries(counts).sort((x, y) => y[1] - x[1]);
  if (!top.length || (top[1] && top[1][1] === top[0][1]) || top[0][1] * 2 <= total) {
    log(g, 'inquisition', { text: 'nobody' });
    return;
  }
  const accused = player(g, top[0][0]);
  const guilty = g.missions.some((m) => m.holder === accused.id && R.MISSIONS[m.id].betrayal && R.seasonOf(m.month) === season(g));
  if (guilty) {
    const k = Math.min(R.INQUISITION_RIGHT_PAYS, accused.jewels);
    accused.jewels -= k;
    g.wallet += k * R.JEWEL_COINS;
    log(g, 'inquisition', { to: accused.id, text: 'right' });
  } else {
    for (const [v, t] of Object.entries(g.inquisitionVotes)) {
      if (t !== accused.id) continue;
      const p = player(g, v);
      const k = Math.min(R.INQUISITION_WRONG_PAYS, p.jewels);
      p.jewels -= k;
      g.wallet += k * R.JEWEL_COINS;
    }
    log(g, 'inquisition', { to: accused.id, text: 'wrong' });
  }
  (accused as Player & { accused?: number[] }).accused = [...((accused as Player & { accused?: number[] }).accused ?? []), g.month];
}

// ---------------------------------------------------------------------------------------------
// Missions (§7) and obstacles (§6), dealt after the Gap closes.

const ROUND_MISSIONS: Partial<Record<MissionId, (r: RoundId) => boolean>> = {
  sabotage: (r) => ['team-vote', 'team-target'].includes(R.ROUNDS[r].mode),
  'false-whisper': (r) => r === 'whisperer',
  'bad-hands': (r) => r === 'hands',
  'chain-breaker': (r) => r === 'chain',
  'fallen-hero': (r) => r === 'buried',
  'free-rider': (r) => r === 'wager',
  'clock-thief': (r) => ['solo', 'solo-competitive'].includes(R.ROUNDS[r].mode),
  fog: (r) => R.ROUNDS[r].mode === 'team-vote',
  'ghost-vote': (r) => R.ROUNDS[r].mode === 'team-vote',
};
const NEEDS_TARGET: MissionId[] = ['steal', 'cold-shoulder', 'guardian', 'clock-thief'];

function missionFits(id: MissionId, r: RoundId, month: number) {
  const fit = ROUND_MISSIONS[id];
  if (fit) return fit(r);
  if (id === 'loyal') return month % 3 === 1; // a season-long mission starts with the season
  return true; // Gap missions, Poisoner, Guardian
}

function holdersThisMonth(g: Game): number {
  const s = season(g);
  if (s === 0) return g.month === 3 ? 1 : 0;
  return Math.min(living(g).length, R.HOLDERS[s]);
}

function dealMissions(g: Game) {
  const count = holdersThisMonth(g);
  if (!count) return;
  const r = g.plan[g.month - 1];
  const lv = living(g);
  const holders = shuffle(g, lv).slice(0, count);
  let pool = (Object.keys(R.MISSIONS) as MissionId[]).filter((id) => missionFits(id, r, g.month));
  if (season(g) === 0) pool = pool.filter((id) => R.MISSIONS[id].reward > 0 && R.MISSIONS[id].reward <= 2 && id !== 'poisoner');
  let first: Mission | null = null;
  for (const h of holders) {
    let id: MissionId = pick(g, pool);
    let target: PlayerId | undefined;
    // Spring: the second holder gets a clashing mission over the same player.
    if (first && season(g) === 2 && first.target) {
      const clash: Partial<Record<MissionId, MissionId>> = { guardian: 'steal', steal: 'guardian', 'cold-shoulder': 'guardian', 'clock-thief': 'guardian' };
      const c = clash[first.id];
      if (c && first.target !== h.id) {
        id = c;
        target = first.target;
      }
    }
    if (!target && NEEDS_TARGET.includes(id)) {
      const others = lv.filter((p) => p.id !== h.id);
      if (!others.length) continue;
      target = pick(g, others).id;
    }
    const m: Mission = { id, holder: h.id, month: g.month, target, status: 'active', paid: 0, data: {} };
    g.missions.push(m);
    first = first ?? m;
    log(g, 'mission', { by: h.id, to: target, text: id, secret: true });
  }
}

export function starPlayer(g: Game): Player | null {
  const lv = living(g);
  if (!lv.length) return null;
  const from = Math.max(0, g.month - 4), to = g.month - 1;
  const score = (p: Player) => p.correct.slice(from, to).reduce((s, x) => s + x, 0);
  return [...lv].sort((a, b) => score(b) - score(a) || b.totalMs - a.totalMs)[0];
}
export function weakLink(g: Game, skip?: PlayerId): Player | null {
  const lv = living(g).filter((p) => p.id !== skip);
  if (!lv.length) return null;
  return [...lv].sort((a, b) => a.health - b.health || b.totalMs - a.totalMs)[0];
}

function safeFromTargeting(g: Game, p: Player) {
  if (p.cloakMonth === g.month) return true;
  return g.missions.some((m) => m.holder === p.id && m.id === 'cold-shoulder' && m.data.safeMonth === g.month);
}

function dealObstacles(g: Game) {
  g.dealt = [];
  const lv = living(g);
  if (!lv.length) return;
  const s = season(g);
  let hits = Math.max(1, Math.round((R.HITS_FOR_4[s] * lv.length) / 4));
  const twiceAllowed = g.month >= 10;
  const targetable = lv.filter((p) => !safeFromTargeting(g, p));
  const pool = targetable.length ? targetable : lv;
  const victims: PlayerId[] = [];
  if (hits >= lv.length && !twiceAllowed) victims.push(...lv.map((p) => p.id));
  else {
    let doubled = false;
    for (let i = 0; i < hits; i++) {
      let v: Player | null = null;
      if (rand(g) < R.TARGETING_CHANCE[g.month - 1]) {
        const star = starPlayer(g);
        v = i % 2 === 0 ? star : weakLink(g, star?.id);
        if (v && safeFromTargeting(g, v)) v = null;
      }
      const free = pool.filter((p) => !victims.includes(p.id));
      if (!v || (victims.includes(v.id) && (doubled || !twiceAllowed))) {
        if (!free.length) {
          if (!twiceAllowed || doubled) break;
          v = pick(g, pool);
        } else v = pick(g, free);
      }
      if (victims.includes(v.id)) {
        if (doubled || !twiceAllowed) continue;
        doubled = true;
      }
      victims.push(v.id);
    }
    hits = victims.length;
  }
  for (const id of victims) g.dealt.push({ player: id, effect: pick(g, R.EFFECT_IDS) });
}

// ---------------------------------------------------------------------------------------------
// Rounds (§5)

function blankRound(id: RoundId, questions: Q[]): RoundRun {
  return {
    id, questions, answers: {}, pairs: [], signals: {}, picks: {}, chosen: null, bids: {}, chainOrder: [], chainStakes: {},
    fog: {}, clockThief: {}, helpers: {}, stage: 'play', done: false, outcome: {},
  };
}

function startRound(g: Game, id: RoundId) {
  const lv = living(g);
  const def = R.ROUNDS[id];
  const count = id === 'chain' ? lv.length : def.questions;
  const r = blankRound(id, drawQuestions(g, count));
  if (def.mode === 'pairs') {
    const order = shuffle(g, lv.map((p) => p.id));
    if (order.length === 2) r.pairs.push({ a: order[0], b: order[1] });
    else {
      // A is at risk, B answers for A. With an odd count one B answers for two.
      for (let i = 0; i + 1 < order.length; i += 2) r.pairs.push({ a: order[i], b: order[i + 1] });
      if (order.length % 2) r.pairs.push({ a: order[order.length - 1], b: order[1] });
    }
  }
  if (id === 'wager') r.stage = 'bid';
  if (id === 'hero' || id === 'supplier') r.stage = 'pick';
  if (id === 'chain') {
    r.chainOrder = shuffle(g, lv.map((p) => p.id));
    for (const p of lv) {
      const k = jewelLoss(p, R.CHAIN_STAKE);
      r.chainStakes[p.id] = k;
    }
  }
  for (const m of g.missions.filter((x) => x.status === 'active' && x.id === 'clock-thief' && x.month === g.month && x.target)) {
    r.clockThief[m.target!] = R.CLOCK_THIEF_MS;
  }
  g.round = r;
}

/** Time a player gets for question q of the current round, after effects and items. */
export function timeLimitMs(g: Game, id: PlayerId, q: number): number {
  const r = g.round;
  if (!r) return 0;
  let ms = roundSec(r.id) * 1000;
  const p = player(g, id);
  if (has(p, 'dehydrated')) ms = Math.max(R.MIN_TIMER_MS, Math.round(ms * R.DEHYDRATED_TIMER));
  ms -= r.clockThief[id] ?? 0;
  if (r.helpers[id]?.stethoscope === q) ms += R.STETHOSCOPE_MS;
  return Math.max(R.MIN_TIMER_MS, ms);
}

function advanceRound(g: Game) {
  const r = g.round!;
  if (r.stage === 'pick') {
    choosePicked(g, r);
    r.stage = 'play';
    return;
  }
  if (r.stage === 'bid') {
    r.stage = 'play';
    return;
  }
  resolveRound(g, r);
  if (r.id === 'buried' && r.outcome.hit && living(g).length > 1) return startRound(g, 'hero');
  if (r.id === 'signal' && r.outcome.hit && living(g).length > 1) return startRound(g, 'supplier');
  resolution(g);
  g.phase = 'ledger';
}

function choosePicked(g: Game, r: RoundRun) {
  const counts: Record<string, number> = {};
  for (const [v, t] of Object.entries(r.picks)) if (player(g, v).alive && player(g, t).alive) counts[t] = (counts[t] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const tied = Object.keys(counts).filter((k) => counts[k] === top);
  if (tied.length === 1) r.chosen = tied[0];
  else {
    // Tie: top scorer of the round before (Buried Alive / Signal Fire).
    const prev = g.month - 1;
    const cands = (tied.length ? tied : living(g).map((p) => p.id)).map((id) => player(g, id));
    r.chosen = [...cands].sort((a, b) => b.correct[prev] - a.correct[prev] || a.totalMs - b.totalMs)[0].id;
  }
}

/** Was a player's answer right and in time? */
function right(g: Game, r: RoundRun, id: PlayerId, q: number): boolean {
  const a = r.answers[id]?.[q];
  return !!a && a.choice === r.questions[q].answer && a.ms <= timeLimitMs(g, id, q);
}
function answerOf(r: RoundRun, id: PlayerId, q: number): Answer | null {
  return r.answers[id]?.[q] ?? null;
}

/** Team-vote: the most-picked choice wins; ties go to the fastest voter; nobody voting is wrong. */
function teamAnswer(g: Game, r: RoundRun, q: number): boolean {
  const tally: Record<number, { n: number; fastest: number }> = {};
  for (const p of living(g)) {
    const a = answerOf(r, p.id, q);
    if (!a || a.choice === null || a.ms > timeLimitMs(g, p.id, q)) continue;
    const weight = g.missions.some((m) => m.holder === p.id && m.id === 'ghost-vote' && m.month === g.month && m.status === 'active') ? 2 : 1;
    const t = (tally[a.choice] ??= { n: 0, fastest: Infinity });
    t.n += weight;
    t.fastest = Math.min(t.fastest, a.ms);
  }
  const entries = Object.entries(tally).sort((x, y) => y[1].n - x[1].n || x[1].fastest - y[1].fastest);
  if (!entries.length) return false;
  return Number(entries[0][0]) === r.questions[q].answer;
}

function recordAnswers(g: Game, r: RoundRun, solo: boolean) {
  for (const p of living(g)) {
    const own = r.answers[p.id] ?? [];
    own.forEach((a, q) => {
      if (!a || q >= r.questions.length) return;
      p.answered++;
      p.totalMs += a.ms;
      const ok = right(g, r, p.id, q);
      if (ok) p.correct[g.month - 1]++;
      if (solo) {
        if (ok) p.solo.right++;
        else {
          p.solo.wrong++;
          p.solo.missed.push(r.questions[q].id);
        }
      }
    });
  }
}

const weakCap = (p: Player, n: number) => (has(p, 'weak') ? Math.min(1, n) : n);
const teamCorrect = (g: Game, r: RoundRun) => r.questions.reduce((s, _, q) => s + (teamAnswer(g, r, q) ? 1 : 0), 0);
function targetHit(g: Game, r: RoundRun) {
  const lv = living(g);
  const total = lv.reduce((s, p) => s + r.questions.reduce((t, _, q) => t + (right(g, r, p.id, q) ? 1 : 0), 0), 0);
  return total >= Math.ceil(R.TEAM_TARGET * lv.length * r.questions.length);
}
const scoreOf = (g: Game, r: RoundRun, id: PlayerId) => r.questions.reduce((s, _, q) => s + (right(g, r, id, q) ? 1 : 0), 0);
const timeOf = (r: RoundRun, id: PlayerId) => (r.answers[id] ?? []).reduce((s, a) => s + (a?.ms ?? 0), 0);

function resolveRound(g: Game, r: RoundRun) {
  const lv = living(g);
  const mode = R.ROUNDS[r.id].mode;
  const solo = mode === 'solo' || mode === 'solo-competitive' || mode === 'linked';
  if (mode !== 'pairs') recordAnswers(g, r, solo);
  const o = r.outcome;
  switch (r.id) {
    case 'granary': {
      const c = teamCorrect(g, r);
      g.wallet += c * R.GRANARY_COINS;
      Object.assign(o, { team: c, coins: c * R.GRANARY_COINS });
      break;
    }
    case 'forager': {
      let coins = 0;
      for (const p of lv) coins += scoreOf(g, r, p.id) * R.FORAGER_COINS;
      g.wallet += coins;
      o.coins = coins;
      break;
    }
    case 'mine': {
      const c = teamCorrect(g, r);
      const each = c >= 5 ? 2 : c >= 3 ? 1 : 0;
      for (const p of lv) p.jewels += weakCap(p, each);
      Object.assign(o, { team: c, each });
      break;
    }
    case 'prospector':
      for (const p of lv) {
        const c = scoreOf(g, r, p.id);
        p.jewels += weakCap(p, Math.floor(c / 2) + (c === r.questions.length ? 2 : 0));
      }
      break;
    case 'jar': {
      const risk = Math.floor(g.wallet * R.JAR_RISK);
      const wrong = r.questions.length - teamCorrect(g, r);
      const lost = Math.floor((risk * wrong) / r.questions.length);
      g.wallet -= lost;
      o.lost = lost;
      break;
    }
    case 'purse': {
      const risk = Math.floor(g.wallet * R.PURSE_RISK);
      const share = risk / lv.length;
      let lost = 0;
      for (const p of lv) {
        const mine = Math.floor((share * (r.questions.length - scoreOf(g, r, p.id))) / r.questions.length);
        lost += mine;
        o[`lost:${p.id}`] = mine;
      }
      g.wallet -= Math.min(g.wallet, lost);
      o.lost = lost;
      break;
    }
    case 'cavein': {
      const wrong = r.questions.length - teamCorrect(g, r);
      for (let i = 0; i < wrong; i++) for (const p of lv) jewelLoss(p, R.CAVEIN_LOSS);
      o.wrong = wrong;
      break;
    }
    case 'pickpocket':
      for (const p of lv) {
        const wrong = r.questions.length - scoreOf(g, r, p.id);
        for (let i = 0; i < wrong; i++) jewelLoss(p, R.PICKPOCKET_LOSS);
      }
      break;
    case 'lean':
    case 'offering': {
      const last = [...lv].sort((a, b) => scoreOf(g, r, a.id) - scoreOf(g, r, b.id) || timeOf(r, b.id) - timeOf(r, a.id))[0];
      if (r.id === 'lean') jewelLoss(last, R.LEAN_LOSS);
      else hurt(g, last, R.OFFERING_LOSS);
      o.loser = last.id;
      break;
    }
    case 'hands':
    case 'whisperer': {
      // B (or the Whisperer's guesser) answers; A (or the guesser) pays 6% health per wrong answer.
      for (const pr of r.pairs) {
        const answerer = r.id === 'hands' ? pr.b : pr.a;
        const atRisk = pr.a;
        const key = r.id === 'hands' ? `${pr.b}>${pr.a}` : pr.a;
        let wrong = 0;
        r.questions.forEach((q, i) => {
          const a = (r.answers[key] ?? r.answers[answerer])?.[i];
          if (!(a && a.choice === q.answer && a.ms <= timeLimitMs(g, answerer, i))) wrong++;
        });
        hurt(g, player(g, atRisk), wrong * R.PAIR_LOSS);
        o[`wrong:${atRisk}`] = wrong;
        const pa = player(g, answerer);
        pa.answered += r.questions.length;
        pa.correct[g.month - 1] += r.questions.length - wrong;
      }
      break;
    }
    case 'gate': {
      const hit = targetHit(g, r);
      if (!hit) {
        for (const p of lv) hurt(g, p, R.GATE_MISS.health);
        walletLoss(g, R.GATE_MISS.wallet);
        g.heat++;
      }
      o.hit = hit;
      break;
    }
    case 'buried': {
      const hit = targetHit(g, r);
      if (!hit) {
        for (const p of lv) hurt(g, p, R.BURIED_MISS);
        g.heat++;
      }
      o.hit = hit;
      break;
    }
    case 'hero': {
      const hero = player(g, r.chosen!);
      const won = scoreOf(g, r, hero.id) >= R.HERO.needed;
      if (won) hero.jewels += weakCap(hero, R.HERO.win);
      else {
        hurt(g, hero, R.HERO.failHealth);
        for (const p of lv) if (p.id !== hero.id) hurt(g, p, R.HERO.hold);
      }
      Object.assign(o, { hero: hero.id, won });
      break;
    }
    case 'signal': {
      const hit = targetHit(g, r);
      if (!hit) {
        walletLoss(g, R.SIGNAL_MISS_WALLET);
        g.heat++;
      }
      o.hit = hit;
      break;
    }
    case 'supplier': {
      const sup = player(g, r.chosen!);
      const coins = scoreOf(g, r, sup.id) * R.SUPPLIER_COINS_PER_PLAYER * lv.length;
      const share = Math.min(R.SUPPLIER_SKIM_MAX, Math.max(0, Number(o.skim ?? 0)));
      const skim = Math.floor(coins * share);
      const jewels = coinsToJewels(skim);
      sup.jewels += jewels;
      g.wallet += coins - jewels * R.JEWEL_COINS;
      Object.assign(o, { supplier: sup.id, coins, skimJewels: jewels });
      if (jewels) log(g, 'supplier-skim', { by: sup.id, n: jewels, secret: true });
      break;
    }
    case 'wager': {
      const hit = targetHit(g, r);
      const pot = Object.values(r.bids).reduce((s, x) => s + x, 0);
      if (hit) {
        const rider = g.missions.find((m) => m.id === 'free-rider' && m.month === g.month && m.status === 'active' && (r.bids[m.holder] ?? 0) === 0);
        if (rider) {
          const cut = Math.floor(pot * R.FREE_RIDER_SHARE);
          player(g, rider.holder).jewels += cut;
          rider.status = 'done';
          rider.paid = cut;
        }
        for (const [id, b] of Object.entries(r.bids)) player(g, id).jewels += b * 2;
      } else {
        walletLoss(g, R.WAGER_MISS_WALLET);
        g.heat++;
      }
      Object.assign(o, { hit, pot });
      break;
    }
    case 'chain': {
      const pot = Object.values(r.chainStakes).reduce((s, x) => s + x, 0);
      let taker: PlayerId | null = null;
      for (let i = 0; i < r.chainOrder.length; i++) {
        const id = r.chainOrder[i];
        const a = answerOf(r, id, i);
        if (!a || a.choice === null || a.ms > timeLimitMs(g, id, i)) {
          // Timeout: your stake goes to the others and the chain goes on.
          const stake = r.chainStakes[id];
          r.chainStakes[id] = 0;
          const others = r.chainOrder.filter((x) => x !== id);
          others.forEach((x, k) => (r.chainStakes[x] += Math.floor(stake / others.length) + (k < stake % others.length ? 1 : 0)));
          continue;
        }
        if (a.choice === r.questions[i].answer) {
          taker = id;
          break;
        }
      }
      if (taker) {
        player(g, taker).jewels += pot;
        const cb = g.missions.find((m) => m.id === 'chain-breaker' && m.holder === taker && m.month === g.month && m.status === 'active');
        if (cb) {
          player(g, taker).jewels += R.MISSIONS['chain-breaker'].reward;
          cb.status = 'done';
          cb.paid = pot + 1;
        }
      } else {
        for (const [id, s] of Object.entries(r.chainStakes)) player(g, id).jewels += s;
        if (Object.values(r.answers).length) for (const p of lv) heal(p, R.CHAIN_ALL_WRONG_HEAL);
      }
      Object.assign(o, { pot, taker: taker ?? '' });
      break;
    }
  }
  roundMissions(g, r);
  r.done = true;
}

function roundMissions(g: Game, r: RoundRun) {
  const mode = R.ROUNDS[r.id].mode;
  for (const m of g.missions.filter((x) => x.status === 'active' && x.month === g.month)) {
    const holder = player(g, m.holder);
    if (!holder.alive) continue;
    let done: boolean | null = null;
    switch (m.id) {
      case 'sabotage':
        if (mode === 'team-target') done = !targetHit(g, r);
        else if (mode === 'team-vote') done = teamCorrect(g, r) < Math.ceil(R.TEAM_TARGET * r.questions.length);
        break;
      case 'fog':
        if (mode === 'team-vote') done = Object.keys(r.fog).some((q) => !teamAnswer(g, r, Number(q)));
        break;
      case 'ghost-vote':
        if (mode === 'team-vote') done = true;
        break;
      case 'clock-thief':
        if (m.target && r.id !== 'hero' && r.id !== 'supplier') done = scoreOf(g, r, m.target) * 2 < r.questions.length;
        break;
      case 'bad-hands':
      case 'false-whisper': {
        const pr = r.pairs.find((p) => p.b === m.holder); // the answerer (Hands) or the Whisperer
        if (pr) done = Number(r.outcome[`wrong:${pr.a}`] ?? 0) >= 2;
        else if (r.pairs.length) done = false;
        break;
      }
      case 'fallen-hero':
        if (r.id === 'hero') done = r.chosen === m.holder && r.outcome.won === false;
        else if (r.id === 'buried' && !r.outcome.hit) done = false;
        break;
    }
    if (done === null) continue;
    if (done) pay(g, m, R.MISSIONS[m.id].reward);
    else m.status = 'failed';
  }
}

function pay(g: Game, m: Mission, jewels: number) {
  m.status = 'done';
  m.paid = jewels;
  player(g, m.holder).jewels += jewels;
}

// ---------------------------------------------------------------------------------------------
// Resolution, ledger and the next month

function resolution(g: Game) {
  const s = season(g);
  const before = new Set(living(g).map((p) => p.id));
  // Obstacles land.
  for (const d of g.dealt) addEffect(g, player(g, d.player), d.effect, g.squeeze?.extraHit ?? 0);
  // Poisoner: everyone else is poisoned; the holder only shows the icon.
  const poisoner = g.missions.find((m) => m.id === 'poisoner' && m.month === g.month && m.status === 'active');
  if (poisoner && player(g, poisoner.holder).alive) {
    for (const p of living(g)) if (p.id !== poisoner.holder) addEffect(g, p, 'poisoned');
    poisoner.data.struck = true;
    g.heat++;
    log(g, 'mass-poisoning');
  }
  for (const p of living(g)) {
    // Monthly effect damage (effects that landed before this month).
    for (const fx of [...p.effects]) {
      const age = g.month - fx.since;
      if (fx.id === 'snakebite' && age >= 1) hurt(g, p, R.SNAKEBITE_MONTHLY);
      if (fx.id === 'poisoned') {
        hurt(g, p, R.POISON_MONTHLY);
        if (age + 1 >= R.POISON_MONTHS) removeEffect(p, 'poisoned');
      }
      if (fx.id === 'dog-bite') {
        if (!fx.rabies && age >= R.RABIES_AFTER) fx.rabies = true;
        if (fx.rabies) hurt(g, p, R.RABIES_MONTHLY);
      }
    }
    // Food and hunger.
    const meal = p.meal ?? 'skip';
    if (!has(p, 'poisoned')) heal(p, R.MEALS[meal].heal);
    let drain = meal === 'skip' ? R.SKIP_DRAIN[s] : R.DRAIN[s];
    if (g.wild.current === 'cold-snap' || g.wild.current === 'heat-wave') drain += R.DRAIN_WEATHER;
    if (g.wild.current === 'clean-spring') drain -= R.DRAIN_WEATHER;
    hurt(g, p, Math.max(0, drain));
  }
  // Month 12 mercy floor: if deaths would leave fewer than 2, the 2 healthiest are protected.
  if (g.month === R.MONTHS) {
    const wouldLive = living(g).filter((p) => p.health > 0);
    if (wouldLive.length < 2 && living(g).length >= 2) {
      const keep = [...living(g)].sort((a, b) => b.health - a.health || a.totalMs - b.totalMs).slice(0, 2);
      for (const p of keep) if (p.health <= 0) p.health = 1;
    }
  }
  for (const p of living(g)) if (p.health <= 0) die(g, p);
  // Guardian: the named player is above 50% at month end.
  for (const m of g.missions.filter((x) => x.status === 'active' && x.id === 'guardian' && x.month === g.month)) {
    const t = player(g, m.target!);
    if (!player(g, m.holder).alive || !t.alive) m.status = 'failed';
    else if (t.health > R.GUARDIAN_ABOVE) pay(g, m, R.MISSIONS.guardian.reward);
    else m.status = 'failed';
  }
  // Lifeline: if the target died this month, the holder is restored 50% and inherits their jewels.
  if (g.lifeline && g.lifeline.month === g.month) {
    const t = player(g, g.lifeline.target), h = player(g, g.lifeline.holder);
    if (before.has(t.id) && !t.alive && h.alive) {
      heal(h, R.LIFELINE_HEAL);
      h.jewels += t.jewels;
      t.jewels = 0;
      log(g, 'lifeline-paid', { by: h.id, to: t.id, secret: true });
    }
  }
  // Snares last one month.
  for (const sn of g.snares) if (sn.status === 'set' && sn.month === g.month) sn.status = 'expired';
  // Round missions that never got their round, and holders who died.
  for (const m of g.missions.filter((x) => x.status === 'active')) {
    if (!player(g, m.holder).alive) m.status = 'failed';
    else if (ROUND_MISSIONS[m.id] && m.month === g.month) m.status = 'failed';
  }
  // Season end: Loyal and Poisoner pay now.
  if (g.month % 3 === 0) seasonEnd(g);
  for (const p of g.players) p.history.push({ month: g.month, jewels: p.jewels, health: p.health });
  if (living(g).length <= 1 || g.month === R.MONTHS) {
    // Game ends after this ledger (the final ledger still takes trust stars).
    (g as Game & { ending?: boolean }).ending = true;
  }
}

function seasonEnd(g: Game) {
  const s = season(g);
  for (const m of g.missions.filter((x) => x.status === 'active' && x.id === 'loyal' && R.seasonOf(x.month) === s)) {
    const p = player(g, m.holder);
    const asked = g.requests.filter((r) => R.seasonOf(r.month) === s && r.month >= m.month && r.by !== m.holder);
    const loyal = asked.every((r) => r.votes[m.holder]?.approve);
    if (p.alive && loyal) {
      pay(g, m, R.MISSIONS.loyal.reward);
      m.data.snareBlock = 1;
    } else m.status = 'failed';
  }
  for (const m of g.missions.filter((x) => x.id === 'poisoner' && x.status === 'active' && R.seasonOf(x.month) === s)) {
    const accused = ((player(g, m.holder) as Player & { accused?: number[] }).accused ?? []).some((mo) => R.seasonOf(mo) === s);
    if (m.data.struck && !accused && player(g, m.holder).alive) pay(g, m, R.MISSIONS.poisoner.reward);
    else m.status = 'failed';
  }
}

function die(g: Game, p: Player) {
  p.alive = false;
  p.health = 0;
  p.diedMonth = g.month;
  log(g, 'death', { by: p.id });
  for (const gf of g.gifts) if (gf.status === 'pending' && gf.to === p.id) gf.status = 'vanished';
  for (const d of g.debts) if (d.status === 'open' && (d.lender === p.id || d.borrower === p.id)) d.status = 'cancelled';
}

function flee(g: Game, p: Player) {
  if (!p.alive) return;
  p.fled = true;
  die(g, p);
  log(g, 'fled', { by: p.id });
}

function nextMonth(g: Game) {
  g.round = null;
  g.dealt = [];
  if ((g as Game & { ending?: boolean }).ending) {
    g.phase = 'over';
    return;
  }
  g.month++;
  g.deckUsed = 0;
  g.phase = 'opening';
}

// ---------------------------------------------------------------------------------------------
// Player actions. Return false when the action isn't allowed right now.

function act(g: Game, a: Exclude<Action, { type: 'ADVANCE' | 'DISCONNECT' | 'RECONNECT' | 'QUIT' }>): boolean {
  const p = g.players.find((x) => x.id === a.player);
  if (!p) return false;
  const inGap1 = g.phase === 'gap1';
  const alive = p.alive;
  switch (a.type) {
    case 'SKIP':
      if ((g.phase !== 'gap1' && g.phase !== 'gap2') || g.skipped.includes(p.id)) return false;
      g.skipped.push(p.id);
      return true;
    case 'BUY_FOOD': {
      if (!inGap1 || !alive || p.meal || has(p, 'lost')) return false;
      if (g.requests.some((r) => r.month === g.month && r.by === p.id && r.meal)) return false;
      const cost = mealPrice(g, a.meal);
      if (a.meal === 'skip' || cost === 0) {
        p.meal = 'skip';
        return true;
      }
      springSnare(g, p, 'buy');
      if (a.pay === 'jewels') {
        if (!payWithJewels(g, p, cost)) return false;
        p.meal = a.meal;
      } else g.requests.push({ id: newId(g, 'r'), month: g.month, kind: 'supply', by: p.id, meal: a.meal, cost, votes: {}, status: 'open' });
      return true;
    }
    case 'BUY_ITEM': {
      if (!inGap1 || !alive || has(p, 'lost')) return false;
      const stock = g.market.find((m) => m.item === a.item);
      if (!stock || stock.left < 1) return false;
      const cost = itemPrice(g, a.item);
      if (a.item === 'snare') {
        // Snares are bought with your own jewels, in secret.
        if (!a.target || !a.trigger || a.target === p.id || !player(g, a.target).alive) return false;
        if (!payWithJewels(g, p, cost)) return false;
        stock.left--;
        g.snares.push({ id: newId(g, 's'), month: g.month, by: p.id, target: a.target, trigger: a.trigger, status: 'set' });
        log(g, 'snare-set', { by: p.id, to: a.target, text: a.trigger, secret: true });
        return true;
      }
      springSnare(g, p, 'buy');
      if (a.pay === 'jewels') {
        if (!payWithJewels(g, p, cost)) return false;
        stock.left--;
        giveItem(g, p, a.item);
      } else {
        stock.left--;
        g.requests.push({ id: newId(g, 'r'), month: g.month, kind: 'supply', by: p.id, item: a.item, cost, votes: {}, status: 'open' });
      }
      return true;
    }
    case 'TREAT': {
      if (!inGap1 || !alive || !has(p, a.effect)) return false;
      if (a.how === 'ignore') {
        p.effects.find((x) => x.id === a.effect)!.ignored = true;
        return true;
      }
      if (!curable(p, a.effect)) return false;
      const item = cureFor(a.effect);
      const cost = itemPrice(g, item);
      if (a.how === 'pay') {
        if (has(p, 'lost') || !payWithJewels(g, p, cost)) return false;
        removeEffect(p, a.effect);
        return true;
      }
      if (g.requests.some((r) => r.month === g.month && r.by === p.id && r.effect === a.effect)) return false;
      springSnare(g, p, 'help');
      g.requests.push({ id: newId(g, 'r'), month: g.month, kind: 'help', by: p.id, effect: a.effect, cost, votes: {}, status: 'open' });
      return true;
    }
    case 'SELL': {
      if (!inGap1 || !alive || a.jewels < 1 || a.jewels > p.jewels) return false;
      p.jewels -= a.jewels;
      g.wallet += a.jewels * R.JEWEL_COINS;
      log(g, 'sold', { by: p.id, n: a.jewels, secret: true });
      return true;
    }
    case 'GIFT': {
      if (!inGap1 || !alive || a.to === p.id) return false;
      const to = player(g, a.to);
      const extra = a.poisoned ? R.POISON_GIFT_EXTRA : 0;
      if (!to.alive || a.jewels < 0 || a.jewels + extra > p.jewels) return false;
      if (a.item && !p.bag.includes(a.item)) return false;
      if (a.jewels === 0 && !a.item) return false;
      springSnare(g, p, 'gift');
      p.jewels -= a.jewels + extra;
      if (a.item) p.bag.splice(p.bag.indexOf(a.item), 1);
      g.gifts.push({ id: newId(g, 'g'), month: g.month, from: p.id, to: a.to, jewels: a.jewels, item: a.item, poisoned: !!a.poisoned, shown: !!a.shown, status: 'pending' });
      return true;
    }
    case 'GIFT_REPLY': {
      const gf = g.gifts.find((x) => x.id === a.gift);
      if (!inGap1 || !gf || gf.to === undefined || gf.to !== p.id || gf.status !== 'pending') return false;
      if (a.accept) {
        gf.status = 'accepted';
        p.jewels += gf.jewels;
        if (gf.item) giveItem(g, p, gf.item);
        if (gf.poisoned) addEffect(g, p, 'poisoned');
        if (has(player(g, gf.from), 'rat-bite')) addEffect(g, p, 'rat-bite');
      } else refuseGift(g, gf);
      return true;
    }
    case 'LEND': {
      if (!inGap1 || !alive || a.to === p.id || a.jewels < 1 || a.jewels > p.jewels || !player(g, a.to).alive) return false;
      p.jewels -= a.jewels;
      player(g, a.to).jewels += a.jewels;
      g.debts.push({ id: newId(g, 'd'), month: g.month, lender: p.id, borrower: a.to, jewels: a.jewels, status: 'open' });
      return true;
    }
    case 'CALL_DEBT': {
      const d = g.debts.find((x) => x.id === a.debt);
      if (!inGap1 || !d || d.lender !== p.id || d.status !== 'open' || g.month < R.DEBT_CALL_FROM_MONTH) return false;
      (d as typeof d & { called?: number }).called = g.month;
      return true;
    }
    case 'REPAY': {
      const d = g.debts.find((x) => x.id === a.debt);
      if (!inGap1 || !d || d.borrower !== p.id || d.status !== 'open' || p.jewels < d.jewels) return false;
      p.jewels -= d.jewels;
      player(g, d.lender).jewels += d.jewels;
      d.status = 'repaid';
      return true;
    }
    case 'MERCY':
      if (!inGap1 || !alive || p.mercyUsed || p.health > R.MERCY_AT) return false;
      p.mercyUsed = true;
      heal(p, R.MERCY_HEAL);
      return true;
    case 'LANTERN': {
      const i = p.bag.indexOf('lantern');
      if (!inGap1 || !alive || i < 0) return false;
      p.bag.splice(i, 1);
      for (const sn of g.snares) if (sn.target === p.id && sn.status === 'set') sn.status = 'revealed';
      return true;
    }
    case 'PAY_WOLVES':
      if (!inGap1 || !alive || g.wild.current !== 'wolves' || g.wolvesPaid.includes(p.id) || p.jewels < 1) return false;
      p.jewels--;
      g.wallet += R.JEWEL_COINS;
      g.wolvesPaid.push(p.id);
      return true;
    case 'DOCTOR_CHIP':
      if (!inGap1 || !alive || g.wild.current !== 'doctor' || a.jewels < 0 || a.jewels > p.jewels || !player(g, a.patient).alive) return false;
      if (g.doctorChips[p.id]) p.jewels += g.doctorChips[p.id].jewels;
      p.jewels -= a.jewels;
      g.doctorChips[p.id] = { jewels: a.jewels, patient: a.patient };
      return true;
    case 'SKIM': {
      const m = activeGapMission(g, p.id, 'skim');
      if (!inGap1 || !alive || !m) return false;
      const taken = Number(m.data.coins ?? 0);
      const cap = Math.floor((g.wallet + taken) * R.SKIM_MAX);
      const coins = Math.min(a.coins, cap - taken, g.wallet);
      if (coins < R.JEWEL_COINS) return false;
      const jewels = coinsToJewels(coins);
      g.wallet -= jewels * R.JEWEL_COINS;
      p.jewels += jewels;
      m.data.coins = taken + jewels * R.JEWEL_COINS;
      m.paid += jewels;
      g.heat++; // an unaccounted wallet loss
      log(g, 'skim', { by: p.id, n: jewels * R.JEWEL_COINS, secret: true });
      return true;
    }
    case 'STEAL': {
      const m = activeGapMission(g, p.id, 'steal');
      if (!inGap1 || !alive || !m || m.data.taken || !m.target) return false;
      const t = player(g, m.target);
      const k = Math.min(R.MISSIONS.steal.reward, losable(t));
      t.jewels -= k;
      p.jewels += k;
      m.data.taken = true;
      m.paid = k;
      log(g, 'steal', { by: p.id, to: t.id, n: k, secret: true });
      return true;
    }
    case 'COLD_SHOULDER': {
      const m = activeGapMission(g, p.id, 'cold-shoulder');
      const r = g.requests.find((x) => x.id === a.request);
      if (g.phase !== 'gap2' || !alive || !m || !r || r.by !== m.target || r.status !== 'open' || m.data.used) return false;
      r.forcedBy = p.id;
      m.data.used = true;
      m.data.safeMonth = g.month + 1;
      return true;
    }
    case 'WHISPER': {
      if (!inGap1 || alive || p.whispers.some((w) => w.month === g.month)) return false;
      if (!player(g, a.to).alive) return false;
      p.whispers.push({ month: g.month, to: a.to, text: a.text.slice(0, 140) });
      return true;
    }
    case 'BELIEVED': {
      // The receiver marks whether they acted on a whisper (used for Loudest Ghost).
      const w = g.players.flatMap((x) => x.whispers).find((x) => x.to === p.id && x.month === a.whisperMonth);
      if (!w) return false;
      w.believed = a.believed;
      return true;
    }
    case 'RUMOR':
      if (!inGap1 || g.rumor.pen !== p.id) return false;
      if (a.card !== null && (a.card < 1 || a.card > R.RUMOR_COUNT)) return false;
      if (a.card !== null && R.RUMORS_NAMING.includes(a.card) && !a.names) return false;
      g.rumor = { ...g.rumor, card: a.card, names: a.names ?? null, pen: null };
      log(g, 'rumor', { by: p.id, n: a.card ?? 0, to: a.names, secret: true });
      return true;
    case 'LAST_SUPPER':
      if (!inGap1 || !alive || g.month !== R.MONTHS || p.id in g.lastSupper || a.to === p.id) return false;
      g.lastSupper[p.id] = a.to;
      return true;
    case 'VOTE': {
      const r = g.requests.find((x) => x.id === a.request);
      if (g.phase !== 'gap2' || !r || r.status !== 'open' || r.by === p.id) return false;
      if (!alive && r.kind === 'help') return false; // ghosts only break supply ties
      const donate = alive && r.kind === 'help' && a.approve ? Math.max(0, Math.min(p.jewels, a.donate ?? 0)) : 0;
      r.votes[p.id] = { approve: a.approve, donate };
      return true;
    }
    case 'ACCUSE':
      if (g.phase !== 'gap2' || !alive || !g.inquisitionOpen || a.target === p.id || !player(g, a.target).alive) return false;
      g.inquisitionVotes[p.id] = a.target;
      return true;
    case 'ANSWER':
      return answer(g, p, a.q, a.choice, a.ms);
    case 'SIGNAL': {
      const r = g.round;
      if (g.phase !== 'round' || !r || r.id !== 'whisperer' || !r.pairs.some((x) => x.b === p.id) || a.q >= r.questions.length) return false;
      (r.signals[p.id] ??= Array(r.questions.length).fill(null))[a.q] = a.choice;
      return true;
    }
    case 'PICK': {
      const r = g.round;
      if (g.phase !== 'round' || !r || r.stage !== 'pick' || !alive || !player(g, a.pick).alive) return false;
      r.picks[p.id] = a.pick;
      return true;
    }
    case 'BID': {
      const r = g.round;
      if (g.phase !== 'round' || !r || r.id !== 'wager' || r.stage !== 'bid' || !alive || a.jewels < 0) return false;
      const prev = r.bids[p.id] ?? 0;
      if (a.jewels > p.jewels + prev) return false;
      p.jewels += prev - a.jewels;
      r.bids[p.id] = a.jewels;
      return true;
    }
    case 'SUPPLIER_SKIM': {
      const r = g.round;
      if (g.phase !== 'round' || !r || r.id !== 'supplier' || r.chosen !== p.id) return false;
      r.outcome.skim = Math.max(0, Math.min(R.SUPPLIER_SKIM_MAX, a.share));
      return true;
    }
    case 'FOG': {
      const r = g.round;
      const m = g.missions.find((x) => x.holder === p.id && x.id === 'fog' && x.month === g.month && x.status === 'active');
      if (g.phase !== 'round' || !r || !m || a.q >= r.questions.length || a.choice === r.questions[a.q].answer) return false;
      if (Object.keys(r.fog).length) return false; // one blur per round
      r.fog[a.q] = a.choice;
      return true;
    }
    case 'USE_ITEM': {
      const r = g.round;
      const i = p.bag.indexOf(a.item);
      if (g.phase !== 'round' || !r || !alive || i < 0) return false;
      const h = (r.helpers[p.id] ??= {});
      if (a.item === 'pocket-guide') {
        if (h.guide !== undefined) return false;
        h.guide = a.q;
      } else {
        if (h.stethoscope !== undefined) return false;
        h.stethoscope = a.q;
      }
      p.bag.splice(i, 1);
      return true;
    }
    case 'STARS': {
      if (g.phase !== 'ledger' && g.phase !== 'over') return false;
      if (g.month % 3 !== 0) return false;
      for (const [id, n] of Object.entries(a.ratings)) {
        if (id === p.id || !g.players.some((x) => x.id === id)) continue;
        p.stars[id] = Math.max(0, Math.min(5, Math.round(n)));
      }
      return true;
    }
  }
  return false;
}

function activeGapMission(g: Game, id: PlayerId, mission: MissionId) {
  // Gap missions dealt last month are carried out in this month's Gap.
  return g.missions.find((m) => m.holder === id && m.id === mission && m.status === 'active' && m.month === g.month - 1);
}

function refuseGift(g: Game, gf: Game['gifts'][number]) {
  gf.status = 'refused';
  const from = player(g, gf.from);
  from.jewels += gf.jewels;
  if (gf.item) from.bag.push(gf.item);
}

/** §7.4 A Snare springs when its target does the trigger this month, unless a Lantern revealed it or Loyal blocks it. */
function springSnare(g: Game, p: Player, trigger: Snare['trigger']) {
  for (const sn of g.snares) {
    if (sn.status !== 'set' || sn.target !== p.id || sn.trigger !== trigger || sn.month !== g.month) continue;
    const loyal = g.missions.find((m) => m.holder === p.id && m.id === 'loyal' && m.status === 'done' && Number(m.data.snareBlock) > 0);
    if (loyal) {
      loyal.data.snareBlock = 0;
      sn.status = 'blocked';
      continue;
    }
    const k = Math.min(R.SNARE_TAKES, losable(p));
    p.jewels -= k;
    player(g, sn.by).jewels += k;
    sn.status = 'sprung';
    g.heat++;
    log(g, 'snare-sprung', { by: sn.by, to: p.id, n: k });
  }
}

function answer(g: Game, p: Player, q: number, choice: number | null, ms: number): boolean {
  const r = g.round;
  if (g.phase !== 'round' || !r || r.stage !== 'play' || q < 0 || q >= r.questions.length || ms < 0) return false;
  if (choice !== null && (choice < 0 || choice > 2)) return false;
  const mode = R.ROUNDS[r.id].mode;
  if (!p.alive) return false;
  if (r.id === 'hero' || r.id === 'supplier') {
    if (r.chosen !== p.id) return false;
  }
  if (r.id === 'chain' && r.chainOrder[q] !== p.id) return false;
  let key = p.id;
  if (mode === 'pairs') {
    // Hands: B answers for A (key "B>A"); Whisperer: the guesser (A) answers.
    if (r.id === 'hands') {
      const prs = r.pairs.filter((x) => x.b === p.id);
      if (!prs.length) return false;
      for (const pr of prs) {
        const k = `${pr.b}>${pr.a}`;
        const arr = (r.answers[k] ??= Array(r.questions.length).fill(null));
        if (arr[q]) return false;
        arr[q] = { choice, ms };
      }
      return true;
    }
    if (!r.pairs.some((x) => x.a === p.id)) return false;
  }
  const arr = (r.answers[key] ??= Array(r.questions.length).fill(null));
  if (arr[q]) return false; // one answer per question
  arr[q] = { choice, ms };
  return true;
}

export function allSkipped(g: Game): boolean {
  return living(g).every((p) => g.skipped.includes(p.id));
}
