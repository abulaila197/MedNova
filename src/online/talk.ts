import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import { awake, track, untrack } from '@/lib/sound';
import { supabase } from '@/lib/supabase';

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
  if (!v || !awake()) return; // no voice lines while the app is in the background
  try {
    if (!modeSet) {
      modeSet = true;
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    let p = players.get(id);
    if (!p) {
      p = track(createAudioPlayer(v.src));
      players.set(id, p);
    }
    await p.seekTo(0);
    // On the web the browser can refuse sound until the page was tapped; that's fine.
    (p.play() as unknown as Promise<void> | undefined)?.catch?.(() => {});
  } catch {
    // no sound is fine; the bubble still shows
  }
}

/** Frees the voice-line players when a room's talk feed closes, so up to 15 native players don't stay alive (PB13d). */
function releaseVoices() {
  for (const p of players.values()) {
    untrack(p);
    try {
      p.pause();
      p.remove();
    } catch {}
  }
  players.clear();
}

// Chat lag (#10, 2026-10-26): a sent line also goes out at once over a live channel per room; the 1.5 s server
// check stays as the backup for anyone who missed it. Each line shown from one path cancels its copy from the other.
const channels = new Map<string, RealtimeChannel>();
const SEEN_MS = 8000;
const seenLive = new Map<string, number[]>();
const seenPoll = new Map<string, number[]>();
const seenKey = (m: Pick<TalkMsg, 'user_id' | 'kind' | 'item'>) => `${m.user_id}|${m.kind}|${m.item}`;
/** True (and used up) when the other path already showed this line; else remembers it for the other path. */
function shownBefore(m: TalkMsg, other: Map<string, number[]>, mine: Map<string, number[]>) {
  const k = seenKey(m);
  const now = Date.now();
  const left = (other.get(k) ?? []).filter((at) => now - at < SEEN_MS);
  if (left.length) {
    other.set(k, left.slice(1));
    return true;
  }
  mine.set(k, [...(mine.get(k) ?? []).filter((at) => now - at < SEEN_MS), now]);
  return false;
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
    const m: TalkMsg = { id: -now, user_id: me.id, name: me.name, face: me.face, kind, item, at: now };
    pop(m);
    if (kind === 'voice') playVoice(item);
    void channels.get(room)?.send({ type: 'broadcast', event: 'talk', payload: m });
  }
  return r;
}

/** Fetches new talk for a room every 1.5 s while the page is open; skips what was said before you arrived. */
export function useTalkFeed(room: string | undefined, me: string | null) {
  const last = useRef<number | null>(null);
  const loading = useRef(false);
  const load = useCallback(async () => {
    // One fetch at a time: two overlapping calls with the same `after` would pop and voice a line twice (AP10d).
    if (!room || loading.current || AppState.currentState !== 'active') return;
    loading.current = true;
    try {
      const rows = await call<TalkMsg[]>('room_talk', { r: room, after: last.current ?? 0 });
      const first = last.current == null;
      if (rows?.length) last.current = rows[rows.length - 1].id;
      else if (first) last.current = 0;
      if (first) return;
      for (const m of rows ?? []) {
        if (m.user_id === me || isMuted(room, m.user_id) || shownBefore(m, seenLive, seenPoll)) continue;
        pop(m);
        if (m.kind === 'voice') playVoice(m.item);
      }
    } catch {
      // try again next tick
    } finally {
      loading.current = false;
    }
  }, [room, me]);
  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 1500);
      return () => clearInterval(id);
    }, [load]),
  );
  // The live channel: only lines the server already accepted are sent on it (sendTalk), so its checks still hold.
  useEffect(() => {
    if (!room) return;
    const ch = supabase.channel(`talk-${room}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'talk' }, ({ payload }) => {
      const m = payload as TalkMsg;
      if (!m?.user_id || m.user_id === me || isMuted(room, m.user_id) || shownBefore(m, seenPoll, seenLive)) return;
      pop(m);
      if (m.kind === 'voice') playVoice(m.item);
    }).subscribe();
    channels.set(room, ch);
    return () => {
      if (channels.get(room) === ch) channels.delete(room);
      supabase.removeChannel(ch);
    };
  }, [room, me]);
  useEffect(
    () => () => {
      useTalk.setState({ pops: [] });
      seenLive.clear();
      seenPoll.clear();
      releaseVoices();
    },
    [room],
  );
}
