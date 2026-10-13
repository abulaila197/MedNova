import { defaultKV, type KV } from './storage';
import { createRecorder } from './recorder';
import { createWallet } from './wallet';
import { createGate } from './gate';
import { createPicker } from './picker';

export * from './types';
export * from './storage';
export * from './recorder';
export * from './wallet';
export * from './levels';
export * from './gate';
export * from './picker';
export * from './standings';

/** A KV that tells listeners when a key is written or removed (e.g. the header's balance when the wallet changes). */
function watchable(base: KV) {
  const subs = new Map<string, Set<() => void>>();
  const notify = (k: string) => subs.get(k)?.forEach((f) => f());
  return {
    get: base.get.bind(base),
    async set<T>(k: string, v: T) {
      await base.set(k, v);
      notify(k);
    },
    async remove(k: string) {
      await base.remove(k);
      notify(k);
    },
    /** Calls `fn` after every write or removal of `key`; returns the unsubscribe. */
    watch(key: string, fn: () => void) {
      const set = subs.get(key) ?? new Set();
      subs.set(key, set);
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
  } satisfies KV & { watch: unknown };
}

/** One shared engine instance for the app. */
const kv = watchable(defaultKV());
export const engine = {
  kv,
  recorder: createRecorder(kv),
  wallet: createWallet(kv),
  gate: createGate(kv),
  picker: createPicker(kv),
};
