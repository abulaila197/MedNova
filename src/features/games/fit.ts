// Geometry of the locked Games page, in design px (282 x 615 screen).
// Port of fitArc (prototype fit.js) with the dots moved 20px lower (decision 63).
import type { Mode } from '@/theme/tokens';

// The design width again (theme/scale's DESIGN_W): scripts/bake-game-art.py runs this file in plain Node, so it can't import the app.
export const W = 282;
export const BODY_TOP = 72; // the shell's content area starts here
export const SHIFT = 20; // decision 63: ring, planets, dots and art anchor sit 20px lower
export const DOTS_TOP = 398 + SHIFT; // screen y of the swipe dots
export const ART_B = DOTS_TOP + 66; // bottom of the art box (fitArc: dots top + 66)
// 2026-10-05: the ring's fill is gone, so each drawing moves down and fades just above the nav bar.
export const ART_END = 540;
const DROP = ART_END - ART_B;
const ART_T = 150;
export const RING_R = 520;
export const RING_CY = 908 + SHIFT; // circle centre, body coords
export const RING_CX = W / 2;

type Box = [number, number, number, number];
const BB: Record<Mode, Record<string, Box>> = {
  dark: {
    'trust-me-not': [0.48, 1, 0.64, 1], 'the-conqueror': [0.36, 1, 0.6, 1],
    'case-files-unsolved': [0.3, 1, 0.4, 1], 'nova-crossword': [0.4, 1, 0.58, 0.97], 'nova-medicordle': [0.2, 1, 0.52, 0.97], 'the-diagnostic-pursuit': [0.25, 1, 0.64, 1],
    'the-riddler': [0.3, 1, 0.55, 1], 'the-silent-artist': [0.35, 1, 0.58, 1], 'the-streak-master': [0.45, 1, 0.58, 0.98], 'the-wheels-of-chaos': [0.3, 1, 0.58, 0.97],
  },
  light: {
    'trust-me-not': [0.48, 1, 0.64, 1], 'the-conqueror': [0.36, 1, 0.6, 1],
    'case-files-unsolved': [0, 1, 0.35, 1], 'nova-crossword': [0.15, 1, 0.58, 0.98], 'nova-medicordle': [0.1, 1, 0.48, 0.97], 'the-diagnostic-pursuit': [0.25, 1, 0.65, 1],
    'the-riddler': [0.25, 1, 0.55, 0.98], 'the-silent-artist': [0.2, 1, 0.58, 1], 'the-streak-master': [0.5, 0.95, 0.6, 1], 'the-wheels-of-chaos': [0.25, 1, 0.52, 0.98],
  },
};
const ZM: Record<string, number> = { 'nova-crossword': 0.86, 'the-silent-artist': 0.86, 'trust-me-not': 0.8, 'the-conqueror': 0.8 };
// Matching anchors: [dark drawing box, light drawing box] so each light drawing lands where the dark one is.
const ANC: Record<string, [Box, Box]> = {
  'trust-me-not': [[0.55, 0.97, 0.69, 0.99], [0.54, 0.97, 0.69, 0.99]],
  'the-conqueror': [[0.4, 0.99, 0.62, 0.99], [0.39, 0.99, 0.62, 0.99]],
  'case-files-unsolved': [[0.71, 0.97, 0.75, 0.845], [0.68, 0.95, 0.75, 0.845]],
  'nova-crossword': [[0.53, 0.99, 0.6, 0.82], [0.44, 0.98, 0.6, 0.845]],
  'nova-medicordle': [[0.5, 1, 0.54, 0.8], [0.5, 0.96, 0.53, 0.83]],
  'the-diagnostic-pursuit': [[0.5, 0.98, 0.67, 0.96], [0.5, 0.98, 0.69, 0.95]],
  'the-riddler': [[0.67, 0.99, 0.645, 0.8], [0.64, 0.99, 0.66, 0.82]],
  'the-silent-artist': [[0.51, 1, 0.69, 0.92], [0.46, 1, 0.7, 0.95]],
  'the-streak-master': [[0.56, 0.89, 0.69, 0.93], [0.575, 0.95, 0.7, 0.94]],
  'the-wheels-of-chaos': [[0.63, 0.98, 0.6, 0.81], [0.6, 0.92, 0.6, 0.8]],
};
const AR_D = 0.5625; // 900 x 1600
const AR_L = 0.5581; // 768 x 1376

export type ArtFit = { x: number; y: number; w: number; h: number };

/** Where the drawing sits (screen coords): exactly fitArc's background-size / background-position. */
export function fitArt(key: string, mode: Mode): ArtFit {
  const B = ART_B;
  const z = ZM[key] ?? 1;
  const d = BB.dark[key];
  const sd = Math.min(W / (d[1] - d[0]), ((B - ART_T) * AR_D) / (d[3] - d[2])) * 0.98 * z;
  const ILd = W + 4 - d[1] * sd;
  const ITd = B - (d[3] * sd) / AR_D;
  if (mode === 'dark') return { x: ILd, y: ITd + DROP, w: sd, h: sd / AR_D };
  const [a, l] = ANC[key];
  const cx = ILd + ((a[0] + a[1]) / 2) * sd;
  const cy = ITd + (((a[2] + a[3]) / 2) * sd) / AR_D;
  const aw = (a[1] - a[0]) * sd;
  const ah = ((a[3] - a[2]) * sd) / AR_D;
  const s = Math.sqrt((aw / (l[1] - l[0])) * ((ah * AR_L) / (l[3] - l[2])));
  return { x: cx - ((l[0] + l[1]) / 2) * s, y: cy - (((l[2] + l[3]) / 2) * s) / AR_L + DROP, w: s, h: s / AR_L };
}

/** Ring slots by offset from the selected game: angle (deg) and diameter, as in the prototype. */
// Offsets -5..5 so 10 games wrap; only -3..3 are visible, exactly as with 8.
export const SLOT_OFF = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
export const SLOT_ANGLE = [-44, -35, -26, -17, -8, 0, 8, 17, 26, 35, 44];
export const SLOT_SIZE = [22, 22, 22, 29, 35, 48, 35, 29, 22, 22, 22];
export const SLOT_OPACITY = [0, 0, 0.75, 1, 1, 1, 1, 1, 0.75, 0, 0];
