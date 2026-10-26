// Sparks (#4, #82): one bar per account that replaces the free plays. Full = 100, +1 every few minutes (the worn
// character's stars set how many, #88), a play costs Sparks at its first answer (#52, TR2). The server holds the real
// bar; the phone keeps the last bar the server sent plus its own spends since, so play works offline and the server
// replays those spends when it is back (#60). Ads and admin gifts add Sparks on the server only; a refill with tokens
// made offline is kept on the phone and checked by the server when it is back (Yazan 2026-10-26).
import { serial, type KV } from './storage';
import { newId } from './ids';

export const SPARKS_MAX = 100;
/** Sparks a watched ad gives (#4). */
export const SPARK_AD = 5;
/** Tokens per Spark when refilling (#4). */
export const SPARK_TOKEN = 1;

/** The bar at one moment: `at` is when the next Spark started filling (or when it was last full). */
export type SparkBase = { value: number; at: number };
export type SparkSpend = { id: string; unit: string; cost: number; game: string; at: number };
type Store = { uid: string | null; base: SparkBase | null; spends: SparkSpend[]; units: string[] };

const KEY = 'sparks';
const KEEP_UNITS = 400;
const FULL: SparkBase = { value: SPARKS_MAX, at: 0 };

/** The bar at time `t`, refilling one Spark every `minutes`; above full (gifts, ads) it does not refill. */
export function refill(s: SparkBase, t: number, minutes: number): SparkBase {
  if (t <= s.at) return s;
  if (s.value >= SPARKS_MAX) return { value: s.value, at: t };
  const r = minutes * 60000;
  const n = Math.floor((t - s.at) / r);
  const value = Math.min(SPARKS_MAX, s.value + n);
  return { value, at: value >= SPARKS_MAX ? t : s.at + n * r };
}

/** Takes `cost` at time `t`; the bar never goes below 0 (two phones spending offline at once). */
export function spendAt(s: SparkBase, t: number, cost: number, minutes: number): SparkBase {
  const r = refill(s, t, minutes);
  return { value: Math.max(0, r.value - cost), at: r.at };
}

export type SparkState = { value: number; max: number; nextIn: number };

export function createSparks(kv: KV, now: () => number = Date.now) {
  const read = async (): Promise<Store> => (await kv.get<Store>(KEY)) ?? { uid: null, base: null, spends: [], units: [] };
  const bar = (st: Store, minutes: number, t: number) => {
    let b = st.base ?? FULL;
    for (const sp of [...st.spends].sort((x, y) => x.at - y.at)) b = spendAt(b, Math.max(sp.at, b.at), sp.cost, minutes);
    return refill(b, t, minutes);
  };
  const run = serial();
  return {
    /** The bar now, and how long until the next Spark (0 when full). */
    state(minutes: number) {
      return run(async () => {
        const t = now();
        const b = bar(await read(), minutes, t);
        return { value: b.value, max: SPARKS_MAX, nextIn: b.value >= SPARKS_MAX ? 0 : Math.max(0, b.at + minutes * 60000 - t) } satisfies SparkState;
      });
    },
    /** Takes `cost` Sparks once per `unit` (a play, or one level of a play); false when that unit was already paid. */
    charge(unit: string, cost: number, game: string) {
      return run(async () => {
        const st = await read();
        if (cost <= 0 || st.units.includes(unit)) return false;
        st.spends.push({ id: newId('k'), unit, cost, game, at: now() });
        st.units = [...st.units, unit].slice(-KEEP_UNITS);
        await kv.set(KEY, st);
        return true;
      });
    },
    /**
     * Sparks refilled with tokens while offline: kept with the spends as a negative cost under `id` (the wallet row's
     * reason is 'sparks:<id>'); the server adds them once it has taken the tokens (sparks_sync).
     */
    add(id: string, n: number) {
      return run(async () => {
        const st = await read();
        if (n <= 0 || st.spends.some((x) => x.id === id)) return;
        st.spends.push({ id, unit: `buy:${id}`, cost: -n, game: 'buy', at: now() });
        await kv.set(KEY, st);
      });
    },
    /** True when `unit` was already paid (so a resumed play is never charged twice). */
    paid(unit: string) {
      return run(async () => (await read()).units.includes(unit));
    },
    /** Spends the server has not seen yet. */
    pending() {
      return run(async () => (await read()).spends);
    },
    /** The server's bar after it replayed `sent` (accepted or refused, they are done). A new account starts clean. */
    settle(uid: string, base: SparkBase, sent: string[]) {
      return run(async () => {
        const st = await read();
        const done = new Set(sent);
        const same = st.uid === uid || st.uid === null; // spends from before the first sync are this account's
        await kv.set(KEY, { uid, base, spends: same ? st.spends.filter((x) => !done.has(x.id)) : [], units: same ? st.units : [] } satisfies Store);
      });
    },
    /** The account this bar belongs to (null before the first sync). */
    owner() {
      return run(async () => (await read()).uid);
    },
    /** Sign-out: the bar belongs to the account, so the phone forgets it (unsent spends are held by the caller). */
    clear() {
      return run(() => kv.set(KEY, null));
    },
  };
}

export type Sparks = ReturnType<typeof createSparks>;
