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

// Values already read or written stay parsed in memory (shared by every defaultKV), so the saved
// plays and the wallet, which grow with use, aren't re-read and re-parsed on every answer and every
// coin refresh. Writes still go straight to storage.
const parsed = new Map<string, unknown>();

/** Uses localStorage when it exists (web preview, and phones via expo-sqlite), else memory. */
export function defaultKV(): KV {
  const ls = (globalThis as { localStorage?: Storage }).localStorage;
  if (!ls) return memoryKV();
  const p = 'mednova:';
  return {
    async get<T>(k: string) {
      if (parsed.has(p + k)) return parsed.get(p + k) as T;
      try {
        const v = ls.getItem(p + k);
        const val = v == null ? null : (JSON.parse(v) as T);
        parsed.set(p + k, val);
        return val;
      } catch {
        return null;
      }
    },
    async set(k, v) {
      parsed.set(p + k, v);
      try {
        ls.setItem(p + k, JSON.stringify(v));
      } catch {}
    },
    async remove(k) {
      parsed.delete(p + k);
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
