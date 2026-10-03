// Tiny key-value port. Everything is saved on the phone first (offline-first);
// syncing to Supabase comes after the pilot works.

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    async get<T>(k: string) {
      const v = m.get(k);
      return v == null ? null : (JSON.parse(v) as T);
    },
    async set(k, v) {
      m.set(k, JSON.stringify(v));
    },
    async remove(k) {
      m.delete(k);
    },
  };
}

/** Uses localStorage when it exists (web preview), else memory. A native SQLite adapter plugs in here at the data step. */
export function defaultKV(): KV {
  const ls = (globalThis as { localStorage?: Storage }).localStorage;
  if (!ls) return memoryKV();
  const p = 'mednova:';
  return {
    async get<T>(k: string) {
      try {
        const v = ls.getItem(p + k);
        return v == null ? null : (JSON.parse(v) as T);
      } catch {
        return null;
      }
    },
    async set(k, v) {
      try {
        ls.setItem(p + k, JSON.stringify(v));
      } catch {}
    },
    async remove(k) {
      try {
        ls.removeItem(p + k);
      } catch {}
    },
  };
}

/** Runs async jobs one at a time, so read-modify-write steps on the same KV never overwrite each other. */
export function serial() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const next = tail.then(job, job);
    tail = next.catch(() => {});
    return next;
  };
}
