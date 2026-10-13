// Trust Me Not sound (rule book §12): short effects, a season ambience loop, and a heartbeat that speeds up as
// health drops. Silence at betrayals: nothing plays for a mission or a Snare. Sounds made with new-games/tmn-sound.
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect } from 'react';

import { audioMode, useSound } from '@/lib/sound';

const FX = {
  tap: require('@/assets/trustmenot/sound/tap.mp3'),
  tick: require('@/assets/trustmenot/sound/tick.mp3'),
  coin: require('@/assets/trustmenot/sound/coin.mp3'),
  stamp: require('@/assets/trustmenot/sound/stamp.mp3'),
  correct: require('@/assets/trustmenot/sound/correct.mp3'),
  wrong: require('@/assets/trustmenot/sound/wrong.mp3'),
  'status-hit': require('@/assets/trustmenot/sound/status-hit.mp3'),
  death: require('@/assets/trustmenot/sound/death.mp3'),
  'calendar-tear': require('@/assets/trustmenot/sound/calendar-tear.mp3'),
  heartbeat: require('@/assets/trustmenot/sound/heartbeat.mp3'),
};
const SEASONS = [
  require('@/assets/trustmenot/sound/season-autumn.mp3'),
  require('@/assets/trustmenot/sound/season-winter.mp3'),
  require('@/assets/trustmenot/sound/season-spring.mp3'),
  require('@/assets/trustmenot/sound/season-summer.mp3'),
];
export type Fx = keyof typeof FX;

const players: Partial<Record<Fx, AudioPlayer>> = {};

/** Plays one effect from the start. Never throws: a phone without sound just stays quiet. */
export async function play(fx: Fx, volume = 1) {
  if (useSound.getState().muted) return; // the menu's sound switch
  try {
    await audioMode();
    const p = (players[fx] ??= createAudioPlayer(FX[fx]));
    p.volume = volume;
    await p.seekTo(0);
    (p.play() as unknown as Promise<void> | undefined)?.catch?.(() => {});
  } catch {
    // Sound is a nicety.
  }
}

/** The season's ambience, quietly looping while the game is open. */
export function useSeasonLoop(season: number) {
  const muted = useSound((m) => m.muted);
  useEffect(() => {
    if (muted) return;
    let p: AudioPlayer | null = null;
    let gone = false; // left the page (or the season changed) before the sound was ready
    audioMode().then(() => {
      if (gone) return;
      try {
        p = createAudioPlayer(SEASONS[season]);
        p.loop = true;
        p.volume = 0.25;
        // Browsers refuse sound until the first tap; the loop then simply stays quiet.
        (p.play() as unknown as Promise<void> | undefined)?.catch?.(() => {});
      } catch {
        p = null;
      }
    });
    return () => {
      gone = true;
      try {
        p?.pause();
        p?.remove();
      } catch {
        // Already gone.
      }
    };
  }, [season, muted]);
}

/** Below half health the heartbeat starts, and beats faster the closer to zero. Ghosts hear nothing. */
export function useHeartbeat(health: number, alive: boolean) {
  const band = !alive || health >= 50 ? 0 : health >= 30 ? 1 : health >= 15 ? 2 : 3;
  useEffect(() => {
    if (!band) return;
    const every = [0, 2400, 1600, 1000][band];
    play('heartbeat', 0.5);
    const t = setInterval(() => play('heartbeat', 0.5), every);
    return () => clearInterval(t);
  }, [band]);
}
