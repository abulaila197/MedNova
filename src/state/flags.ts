import { create } from 'zustand';

import { engine } from '@/games/engine';
import { supabase } from '@/lib/supabase';

/**
 * Switches Admin can flip for every phone without a new build (Yazan 2026-11-16). Stored on the server
 * (app_flags), kept on the phone for offline starts. `show_razan`: the Razan character is hidden everywhere
 * (pickers, collection, rivals' faces, stickers) until Admin turns it on; it starts hidden.
 */
export type Flags = { show_razan: boolean };
const DEFAULTS: Flags = { show_razan: false };
const KEY = 'flags:v1';

export const useFlags = create<Flags>(() => DEFAULTS);

/** Characters hidden right now (by their slug / team key). */
export const hiddenCharacters = (f: Flags = useFlags.getState()) => (f.show_razan ? [] : ['razan']);
export const useHiddenCharacters = () => useFlags((f) => (f.show_razan ? NONE : RAZAN));
const NONE: string[] = [];
const RAZAN = ['razan'];

let loaded = false;
export async function loadFlags() {
  if (!loaded) {
    loaded = true;
    const saved = await engine.kv.get<Partial<Flags>>(KEY).catch(() => null);
    if (saved) useFlags.setState({ ...DEFAULTS, ...saved });
  }
  const { data, error } = await supabase.from('app_flags').select('key,value');
  if (error || !data) return;
  const next = { ...DEFAULTS };
  for (const r of data as { key: string; value: unknown }[]) if (r.key in next) (next as Record<string, unknown>)[r.key] = r.value;
  useFlags.setState(next);
  void engine.kv.set(KEY, next).catch(() => {});
}

/** Admin only (the server checks): sets one switch for everyone. */
export async function setFlag<K extends keyof Flags>(key: K, value: Flags[K]) {
  const { error } = await supabase.rpc('set_app_flag', { flag: key, val: value });
  if (error) throw error;
  useFlags.setState({ [key]: value } as Partial<Flags>);
  void engine.kv.set(KEY, useFlags.getState()).catch(() => {});
}
