// Shared EXP wallet (rules 3, 6, 18): 200 EXP = 1 token, earned on the phone at once,
// synced later, with a per-play sanity cap. Token refunds when a paid hint could not be shown.
import { serial, type KV } from './storage';
import { newId } from './ids';

export const EXP_PER_TOKEN = 200;

export type LedgerEntry = {
  id: string;
  kind: 'exp' | 'spend' | 'refund' | 'convert';
  exp: number;
  tokens: number;
  reason: string;
  playId?: string;
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
  const balance = async () => {
    const all = await ledger();
    return {
      exp: all.reduce((s, e) => s + e.exp, 0),
      tokens: all.reduce((s, e) => s + e.tokens, 0),
    };
  };

  const run = serial();
  return {
    balance,
    ledger,

    /** Adds EXP for a finished play, clamped to the game's per-play cap, then converts every full 200 EXP into a token. */
    earn(playId: string, exp: number, cap: number) {
      return run(async () => {
        const all = await ledger();
        if (all.some((e) => e.kind === 'exp' && e.playId === playId)) return 0; // once per play
        const amount = Math.max(0, Math.min(Math.round(exp), cap));
        if (amount > 0) await add({ kind: 'exp', exp: amount, tokens: 0, reason: 'play', playId });
        const b = await balance();
        const tokens = Math.floor(b.exp / EXP_PER_TOKEN);
        if (tokens > 0) await add({ kind: 'convert', exp: -tokens * EXP_PER_TOKEN, tokens, reason: 'convert' });
        return amount;
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
