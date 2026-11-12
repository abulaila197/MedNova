import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect } from 'react';
import { create } from 'zustand';

import { awake, track, untrack } from '@/lib/sound';

import { voiceGender } from '@/games/shell/characters';
import { loadVoicePick, useVoicePick } from '@/state/voicePick';

import { voiceSrc } from './voice';

/**
 * Stickers and voice lines in a Vs bots room and match (ON12, ON28; bots 2026-11-09). Everything stays on the phone:
 * yours shows and plays at once, and the bots' lines wait their turn (sayAsBot), never two at the same time.
 */
/**
 * Rivals also send two kinds of short text (item = the text): 'line', a few words (a Genius pointing you to the dossier),
 * and 'guess', a wrong diagnosis in Diagnostic Pursuit, shown crossed out (Yazan 2026-11-09).
 */
export type TalkMsg = { id: number; user_id: string; name: string; face: string; kind: 'sticker' | 'voice' | 'line' | 'guess'; item: string; at: number };

type State = {
  /** Messages popping right now (they fade after 3 s). */
  pops: TalkMsg[];
  /** Players (bots) you muted, per room. */
  muted: Record<string, string[]>;
  /** When you can send again (3 s between sends, ON12). */
  nextAt: number;
};
export const useTalk = create<State>(() => ({ pops: [], muted: {}, nextAt: 0 }));

export const COOLDOWN_MS = 3000;
const POP_MS = 3000;
/** A text line stays a little longer, to read it. */
const LINE_MS = 4000;
/** Yazan 2026-11-09: two bots never talk at once; the next waits until this long after the one before. */
const BOT_GAP_MS = 2200;

export const isMuted = (room: string, user: string) => (useTalk.getState().muted[room] ?? []).includes(user);
export function toggleMute(room: string, user: string) {
  useTalk.setState((s) => {
    const list = s.muted[room] ?? [];
    return { muted: { ...s.muted, [room]: list.includes(user) ? list.filter((x) => x !== user) : [...list, user] } };
  });
}

/** Which voice a speaker uses: their character's, or for you the one picked in Settings. */
export function genderFor(face: string, mine: boolean): 'female' | 'male' {
  const pick = useVoicePick.getState().pick;
  return mine && pick !== 'character' ? pick : voiceGender(face);
}

// One player per voice line and voice, made on first use; short effects mix with other sounds.
const players = new Map<string, AudioPlayer>();
let modeSet = false;
export async function playVoice(id: string, gender: 'female' | 'male' = 'male') {
  const src = voiceSrc(id, gender);
  if (!src || !awake()) return; // no voice lines while the app is in the background
  try {
    if (!modeSet) {
      modeSet = true;
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    const key = `${gender}:${id}`;
    let p = players.get(key);
    if (!p) {
      p = track(createAudioPlayer(src));
      players.set(key, p);
    }
    await p.seekTo(0);
    // On the web the browser can refuse sound until the page was tapped; that's fine.
    (p.play() as unknown as Promise<void> | undefined)?.catch?.(() => {});
  } catch {
    // no sound is fine; the bubble still shows
  }
}

/** Frees the voice-line players when a room closes, so up to 19 native players don't stay alive (PB13d). */
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

let nextId = 1;
const pop = (m: TalkMsg) => {
  useTalk.setState((s) => ({ pops: [...s.pops.filter((x) => x.user_id !== m.user_id), m] }));
  setTimeout(() => useTalk.setState((s) => ({ pops: s.pops.filter((x) => x.id !== m.id) })), m.kind === 'line' ? LINE_MS : POP_MS);
};

/** Who hears what the player sends: the bots of the room (they react, group 3). */
type Listener = (m: TalkMsg) => void;
const listeners = new Map<string, Set<Listener>>();
export function onTalk(room: string, fn: Listener) {
  const set = listeners.get(room) ?? new Set();
  set.add(fn);
  listeners.set(room, set);
  return () => void set.delete(fn);
}

/** Send a sticker (your character's) or a voice line. It shows and plays at once. */
export async function sendTalk(room: string, me: { id: string; name: string; face: string }, kind: TalkMsg['kind'], item: string) {
  const now = Date.now();
  if (now < useTalk.getState().nextAt) return 'cooldown';
  useTalk.setState({ nextAt: now + COOLDOWN_MS });
  const m: TalkMsg = { id: nextId++, user_id: me.id, name: me.name, face: me.face, kind, item, at: now };
  pop(m);
  if (kind === 'voice') playVoice(item, genderFor(me.face, true));
  listeners.get(room)?.forEach((fn) => fn(m));
  return 'sent';
}

// The bots' line: one message at a time, in the order they were said.
const queue: { room: string; m: Omit<TalkMsg, 'id' | 'at'>; until: number }[] = [];
let busyUntil = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
/** Pages showing each room right now (the room page and its match can overlap while one replaces the other). */
const open = new Map<string, number>();
function drain() {
  timer = null;
  const wait = busyUntil - Date.now();
  if (wait > 0) {
    timer = setTimeout(drain, wait);
    return;
  }
  const next = queue.shift();
  if (!next) return;
  // A line whose moment has passed is dropped (G3: old lines never play late).
  if ((open.get(next.room) ?? 0) > 0 && !isMuted(next.room, next.m.user_id) && Date.now() <= next.until) {
    const m = { ...next.m, id: nextId++, at: Date.now() };
    pop(m);
    if (m.kind === 'voice') playVoice(m.item, genderFor(m.face, false));
    busyUntil = Date.now() + (m.kind === 'line' ? LINE_MS : BOT_GAP_MS);
  }
  if (queue.length) timer = setTimeout(drain, Math.max(0, busyUntil - Date.now()));
}

/** A rival says something. It waits behind any rival already talking (never two at once), for up to `fresh` ms. */
export function sayAsBot(room: string, m: Omit<TalkMsg, 'id' | 'at'>, fresh = 8000) {
  // A rival never queues a second line behind its own unsaid one.
  if (queue.some((q) => q.room === room && q.m.user_id === m.user_id)) return false;
  queue.push({ room, m, until: Date.now() + fresh });
  if (!timer) drain();
  return true;
}

/**
 * A rival's wrong guess pops at once, outside the queue: it can show beside another rival's chat (Yazan 2026-11-09),
 * then goes like any message.
 */
export function popAsBot(room: string, m: Omit<TalkMsg, 'id' | 'at'>) {
  if ((open.get(room) ?? 0) <= 0 || isMuted(room, m.user_id)) return false;
  pop({ ...m, id: nextId++, at: Date.now() });
  return true;
}

/** How many bot lines are waiting (bots skip chatter while the line is long). */
export const botQueueLength = () => queue.length;

/** Opens a room's talk while its page is shown; closing it drops the waiting bot lines and frees the sounds. */
export function useTalkRoom(room: string | undefined) {
  useEffect(() => {
    if (!room) return;
    void loadVoicePick();
    open.set(room, (open.get(room) ?? 0) + 1);
    return () => {
      const n = (open.get(room) ?? 1) - 1;
      if (n > 0) return void open.set(room, n);
      open.delete(room);
      queue.length = 0;
      if (timer) clearTimeout(timer);
      timer = null;
      busyUntil = 0;
      useTalk.setState({ pops: [] });
      releaseVoices();
    };
  }, [room]);
}
