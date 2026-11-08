// App sounds (Yazan, 2026-10-13: "Taps and moments"; since 2026-10-26 Kenney CC0 sounds he picked by ear, #15). One mute switch in
// the menu silences every sound in the app, Trust Me Not included. Right and wrong never play online before the
// answer is shown to everyone: callers play them at the reveal, not at the guess.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';

const FX = {
  tap: require('@/assets/sound/tap.mp3'),
  right: require('@/assets/sound/right.mp3'),
  wrong: require('@/assets/sound/wrong.mp3'),
  win: require('@/assets/sound/win.mp3'),
  timeup: require('@/assets/sound/timeup.mp3'),
  token: require('@/assets/sound/token.mp3'),
};
export type Sound = keyof typeof FX;

const VOLUME: Record<Sound, number> = { tap: 0.35, right: 0.7, wrong: 0.6, win: 0.8, timeup: 0.7, token: 0.6 };

const kv = defaultKV();
const MUTE_KEY = 'sound:muted';

export const useSound = create<{ muted: boolean; setMuted: (m: boolean) => void }>((set) => ({
  muted: false,
  setMuted: (muted) => {
    set({ muted });
    void kv.set(MUTE_KEY, muted).catch(() => {});
  },
}));
void kv
  .get<boolean>(MUTE_KEY)
  .then((m) => {
    if (m === true) useSound.setState({ muted: true });
  })
  .catch(() => {});

let ready: Promise<void> | null = null;
/** Sound plays even with the ring switch off, and mixes with the person's own music. */
export const audioMode = () => (ready ??= setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {}));

const players: Partial<Record<Sound, AudioPlayer>> = {};
let lastTap = 0;

// Every player in the app (these sounds, Trust Me Not, voice lines) is tracked, so leaving a game or the app
// silences whatever is still ringing (Yazan, 2026-10-13: nothing keeps playing after you exit).
const live = new Set<AudioPlayer>();
export const track = (p: AudioPlayer) => (live.add(p), p);
export const untrack = (p: AudioPlayer) => void live.delete(p);
/** Stops every sound now. Loops that belong to a page still open start again on their own (useSeasonLoop). */
export function stopAll() {
  for (const p of live) {
    try {
      p.pause();
    } catch {
      // Already gone.
    }
  }
}
/** Sound plays only while the app is on screen; going to the background stops what is playing. */
export const awake = () => AppState.currentState === 'active' || AppState.currentState == null;
AppState.addEventListener('change', (st) => {
  if (st !== 'active') stopAll();
});

/** Plays one sound from the start. Never throws: a phone without sound just stays quiet. */
export async function sfx(name: Sound) {
  if (useSound.getState().muted || !awake()) return;
  if (name === 'tap') {
    // A burst of taps (double tap, a tap that also opens a page) plays once.
    const now = Date.now();
    if (now - lastTap < 60) return;
    lastTap = now;
  }
  try {
    await audioMode();
    const p = (players[name] ??= track(createAudioPlayer(FX[name])));
    p.volume = VOLUME[name];
    await p.seekTo(0);
    (p.play() as unknown as Promise<void> | undefined)?.catch?.(() => {});
  } catch {
    // Sound is a nicety.
  }
}

/** A judged answer: right, wrong, or the clock ran out first. */
export type Verdict = boolean | 'timeup';
export const sfxVerdict = (v: Verdict) => sfx(v === 'timeup' ? 'timeup' : v ? 'right' : 'wrong');

/** Wraps a button's press so it gives the soft tap first. */
export const tapped =
  <A extends unknown[]>(fn?: (...a: A) => void) =>
  (...a: A) => {
    void sfx('tap');
    fn?.(...a);
  };

/**
 * Online right or wrong, once per reveal (Yazan, 2026-10-13: never before the answer shows for everyone). `key`
 * names the reveal on screen (null when none is); `right` is null when this player had nothing to judge.
 */
export function useRevealSound(key: string | null, right: Verdict | null) {
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (key == null || right == null || played.current === key) return;
    played.current = key;
    if (gameOnScreen()) void sfxVerdict(right);
  }, [key, right]);
}

/** Leaving a game (any page outside /play) stops whatever it was still playing. Mounted once, in the app layout. */
export function useStopSoundsOnLeave() {
  const path = usePathname();
  const inGame = path.startsWith('/play/');
  useEffect(() => {
    gameShown = inGame;
    if (!inGame) stopAll();
  }, [inGame]);
}

let gameShown = false;
/** A game is the page on screen. A game waiting under the Store or the menu's pages makes no sound. */
export const gameOnScreen = () => gameShown;
