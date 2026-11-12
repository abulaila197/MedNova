import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';

/**
 * Your voice in rooms (Yazan 2026-11-12): by default it follows the character you wear (a female character speaks
 * in the female voice); Settings can fix it to Female or Male. Rivals always follow their character.
 */
export type VoicePick = 'character' | 'female' | 'male';
const KEY = 'voice:pick';
const kv = defaultKV();
export const useVoicePick = create<{ pick: VoicePick; loaded: boolean }>(() => ({ pick: 'character', loaded: false }));

export async function loadVoicePick() {
  if (useVoicePick.getState().loaded) return;
  const v = await kv.get<VoicePick>(KEY).catch(() => null);
  useVoicePick.setState({ pick: v === 'female' || v === 'male' ? v : 'character', loaded: true });
}

export function setVoicePick(pick: VoicePick) {
  useVoicePick.setState({ pick, loaded: true });
  void kv.set(KEY, pick).catch(() => {});
}
