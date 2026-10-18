import { engine } from '@/games/engine';
import { newId } from '@/games/engine/ids';

const KEY = 'device:id';
const OK = /^[A-Za-z0-9_-]{8,64}$/;
let cached: string | null = null;

/**
 * A random id for this install, made once and kept on the phone (never cleared on sign-out). The server uses it
 * only to cap guest Contact and Report messages at 3 a day per device (Yazan 2026-10-18).
 */
export async function deviceId() {
  if (cached) return cached;
  const saved = await engine.kv.get<string>(KEY).catch(() => null);
  if (saved && OK.test(saved)) return (cached = saved);
  const id = newId('d');
  await engine.kv.set(KEY, id).catch(() => {});
  return (cached = id);
}
