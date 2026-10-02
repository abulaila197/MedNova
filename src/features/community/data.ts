import { GAME_PHOTOS } from '@/data/games';
import type { Mode } from '@/theme/tokens';

// The locked previews used the old game art; the app uses the closest game photo:
//   i-ct (brain hologram)        -> the-riddler
//   i-md (Medicordle board)      -> nova-medicordle
//   i-sd (target and arrow)      -> the-streak-master
//   i-sa (speaker and audience)  -> the-silent-artist
//   i-sr (race car and timer)    -> the-diagnostic-pursuit
//   i-cs (clinic screens)        -> case-files-unsolved
//   i-ci (clinic desk screen)    -> nova-crossword
export type PhotoKey = keyof typeof GAME_PHOTOS.dark;
export const OLD_ART: Record<string, PhotoKey> = {
  ct: 'the-riddler',
  md: 'nova-medicordle',
  sd: 'the-streak-master',
  sa: 'the-silent-artist',
  sr: 'the-diagnostic-pursuit',
  cs: 'case-files-unsolved',
  ci: 'nova-crossword',
};

export const photo = (mode: Mode, key: PhotoKey) => GAME_PHOTOS[mode][key];

// Game photos are 900 x 1600 portraits.
export const PH_W = 900;
export const PH_H = 1600;

/**
 * Crops that bring each photo's subject into frame (design px). `w` = drawn image width,
 * `fx`/`fy` = point of the photo (0..1) placed at `ax`/`ay` of the box (0..1).
 */
export type Focus = { w: number; fx: number; fy: number; ax: number; ay: number };
export const FOCUS: Record<PhotoKey, Focus> = {
  'the-riddler': { w: 300, fx: 0.71, fy: 0.74, ax: 0.88, ay: 0.4 },
  'nova-medicordle': { w: 290, fx: 0.71, fy: 0.71, ax: 0.75, ay: 0.5 },
  'the-streak-master': { w: 300, fx: 0.71, fy: 0.81, ax: 0.75, ay: 0.5 },
  'the-silent-artist': { w: 290, fx: 0.7, fy: 0.78, ax: 0.6, ay: 0.45 },
  'the-diagnostic-pursuit': { w: 290, fx: 0.5, fy: 0.8, ax: 0.5, ay: 0.5 },
  'case-files-unsolved': { w: 290, fx: 0.75, fy: 0.8, ax: 0.6, ay: 0.5 },
  'nova-crossword': { w: 290, fx: 0.72, fy: 0.72, ax: 0.6, ay: 0.5 },
  'the-wheels-of-chaos': { w: 290, fx: 0.85, fy: 0.8, ax: 0.7, ay: 0.5 },
};

/** Place a photo in a bw x bh box so its focus point lands on the anchor, never leaving a gap. */
export function focusPlace(key: PhotoKey, bw: number, bh: number, scale = 1) {
  const f = FOCUS[key];
  const w = Math.max(f.w * scale, bw, (bh * PH_W) / PH_H);
  const h = (w * PH_H) / PH_W;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const x = clamp(f.ax * bw - f.fx * w, bw - w, 0);
  const y = clamp(f.ay * bh - f.fy * h, bh - h, 0);
  return { x, y, w, h };
}
