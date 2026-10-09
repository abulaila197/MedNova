import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { call } from './api';
import { voiceById } from './voice';

/** One sticker or voice line someone sent (ON12, ON28). */
export type TalkMsg = { id: number; user_id: string; name: string; face: string; kind: 'sticker' | 'voice'; item: string; at: number };

type State = {
  /** Messages popping right now (they fade after 3 s). */
  pops: TalkMsg[];
  /** Players you muted, per room. Only on this phone (ON12). */
  muted: Record<string, string[]>;
  /** When you can send again (3 s between sends, ON12). */
  nextAt: number;
};
export const useTalk = create<State>(() => ({ pops: [], muted: {}, nextAt: 0 }));

export const COOLDOWN_MS = 3000;
const POP_MS = 3000;

export const isMuted = (room: string, user: string) => (useTalk.getState().muted[room] ?? []).includes(user);
export function toggleMute(room: string, user: string) {
  useTalk.setState((s) => {
    const list = s.muted[room] ?? [];
    return { muted: { ...s.muted, [room]: list.includes(user) ? list.filter((x) => x !== user) : [...list, user] } };
  });
}

// One player per voice line, made on first use; short effects mix with other sounds.
const players = new Map<string, AudioPlayer>();
let modeSet = false;
export async function playVoice(id: string) {
  const v = voiceById.get(id);
  if (!v) return;
  try {
    if (!modeSet) {
      modeSet = true;
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    let p = players.get(id);
    if (!p) {
      p = createAudioPlayer(v.src);
      players.set(id, p);
    }
    await p.seekTo(0);
    // On the web the browser can refuse sound until the page was tapped; that's fine.
    (p.play() as unknown as Promise<void> | undefined)?.catch?.(() => {});
  } catch {
    // no sound is fine; the bubble still shows
  }
}

const pop = (m: TalkMsg) => {
  useTalk.setState((s) => ({ pops: [...s.pops.filter((x) => x.user_id !== m.user_id), m] }));
  setTimeout(() => useTalk.setState((s) => ({ pops: s.pops.filter((x) => x.id !== m.id) })), POP_MS);
};

/** Send a sticker (your character's) or a voice line. Your own shows and plays at once. */
export async function sendTalk(room: string, me: { id: string; name: string; face: string }, kind: TalkMsg['kind'], item: string) {
  const now = Date.now();
  if (now < useTalk.getState().nextAt) return 'cooldown';
  useTalk.setState({ nextAt: now + COOLDOWN_MS });
  const r = await call<string>('send_talk', { r: room, kind, item }).catch(() => 'error');
  if (r === 'sent') {
    pop({ id: -now, user_id: me.id, name: me.name, face: me.face, kind, item, at: now });
    if (kind === 'voice') playVoice(item);
  }
  return r;
}

/** Fetches new talk for a room every 1.5 s while the page is open; skips what was said before you arrived. */
export function useTalkFeed(room: string | undefined, me: string | null) {
  const last = useRef<number | null>(null);
  const load = useCallback(async () => {
    if (!room || AppState.currentState !== 'active') return;
    try {
      const rows = await call<TalkMsg[]>('room_talk', { r: room, after: last.current ?? 0 });
      const first = last.current == null;
      if (rows?.length) last.current = rows[rows.length - 1].id;
      else if (first) last.current = 0;
      if (first) return;
      for (const m of rows ?? []) {
        if (m.user_id === me || isMuted(room, m.user_id)) continue;
        pop(m);
        if (m.kind === 'voice') playVoice(m.item);
      }
    } catch {
      // try again next tick
    }
  }, [room, me]);
  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 1500);
      return () => clearInterval(id);
    }, [load]),
  );
  useEffect(() => () => useTalk.setState({ pops: [] }), [room]);
}
