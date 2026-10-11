// Shared EXP wallet (rules 6, 18, LV1, LV5): EXP raises the player's level and each level up gives
// 1 token (every 5th level 3 more), earned on the phone at once, synced later, with a per-play sanity cap.
// Token refunds when a paid hint could not be shown. The server checks every row (EC1) and adds admin
// grants; tokens can dip below 0 when two phones spent the same tokens offline, paid back by later levels (OW1).
import { levelOf, levelTokens } from './levels';
import { serial, type KV } from './storage';
import { newId } from './ids';

export type LedgerEntry = {
  id: string;
  kind: 'exp' | 'spend' | 'refund' | 'grant' | 'convert'; // 'grant' = admin tokens (AD1); 'convert' = old 200-EXP tokens, not counted
  exp: number;
  tokens: number;
  reason: string;
  playId?: string;
  note?: string;
  at: number;
  synced: boolean;
};

const KEY = 'wallet';

export function createWallet(kv: KV) {
  const ledger = async () => (await kv.get<LedgerEntry[]>(KEY)) ?? [];
  const add = async (e: Omit<LedgerEntry, 'id' | 'at' | 'synced'>) => {
    const all = await ledger();
    const row = { ...e, id: newId('w'), at: Date.now(), synced: false };
    all.push(row);
    await kv.set(KEY, all);
    return row;
  };
  /**
   * Total EXP ever earned (spending never lowers it), the level it gives, and tokens on hand.
   * Level tokens are worked out from the level (LV1, LV5), not stored, so two phones merging
   * their ledgers can never pay the same level twice.
   */
  const balance = async () => {
    const all = await ledger();
    const exp = all.reduce((s, e) => s + (e.kind === 'exp' ? e.exp : 0), 0);
    const lv = levelOf(exp);
    const used = all.reduce((s, e) => s + (e.kind === 'spend' || e.kind === 'refund' || e.kind === 'grant' ? e.tokens : 0), 0);
    return { exp, tokens: levelTokens(lv.level) + used, ...lv };
  };

  const run = serial();
  return {
    balance,
    ledger,

    /** Adds EXP for a finished play, clamped to the game's per-play cap; the new levels pay their tokens (LV1, LV5). */
    earn(playId: string, exp: number, cap: number) {
      return run(async () => {
        const all = await ledger();
        const from = (await balance()).level;
        if (all.some((e) => e.kind === 'exp' && e.playId === playId)) return { amount: 0, level: from, levelsGained: 0, tokensGained: 0 }; // once per play
        const amount = Math.max(0, Math.min(Math.round(exp), cap));
        if (amount > 0) await add({ kind: 'exp', exp: amount, tokens: 0, reason: 'play', playId });
        const { level } = await balance();
        return { amount, level, levelsGained: level - from, tokensGained: levelTokens(level) - levelTokens(from) };
      });
    },

    /** Spends tokens; returns a receipt id to refund if the hint never shows. */
    spend(tokens: number, reason: string, playId?: string) {
      return run(async () => {
        const b = await balance();
        if (b.tokens < tokens) return null;
        return (await add({ kind: 'spend', exp: 0, tokens: -tokens, reason, playId })).id;
      });
    },

    unsynced() {
      return run(async () => (await ledger()).filter((e) => !e.synced));
    },

    markSynced(ids: string[]) {
      return run(async () => {
        const set = new Set(ids);
        await kv.set(KEY, (await ledger()).map((e) => (set.has(e.id) ? { ...e, synced: true } : e)));
      });
    },

    /** Removes rows the server refused (EC1), so they stop counting on this phone. */
    drop(ids: string[]) {
      return run(async () => {
        if (!ids.length) return;
        const set = new Set(ids);
        await kv.set(KEY, (await ledger()).filter((e) => !set.has(e.id)));
      });
    },

    /** Adds the account's entries this phone does not have yet, so the balance matches on every phone. */
    mergeRemote(remote: LedgerEntry[]) {
      return run(async () => {
        const all = await ledger();
        const have = new Set(all.map((e) => e.id));
        const add = remote.filter((e) => !have.has(e.id)).map((e) => ({ ...e, synced: true }));
        if (add.length) await kv.set(KEY, [...all, ...add].sort((a, b) => a.at - b.at));
        return add.length;
      });
    },

    refund(receiptId: string) {
      return run(async () => {
        const all = await ledger();
        const r = all.find((e) => e.id === receiptId && e.kind === 'spend');
        if (!r || all.some((e) => e.kind === 'refund' && e.reason === receiptId)) return false;
        await add({ kind: 'refund', exp: 0, tokens: -r.tokens, reason: receiptId, playId: r.playId });
        return true;
      });
    },
  };
}

export type Wallet = ReturnType<typeof createWallet>;
