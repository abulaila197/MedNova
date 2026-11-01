import type { Mode } from '@/theme/tokens';

/** Specimen slides colours (NM21): the classic green / yellow / grey on tiles and keys; glass and lightbox from the app theme. */
const dark = {
  ok: '#3fc58a',
  near: '#e9b44c',
  off: '#3a3d4a',
  offText: '#9a9daa',
  onTile: '#07101f',
  glass: 'rgba(160,220,255,0.08)',
  glassTop: 'rgba(255,255,255,0.07)',
  /** Soft top sheen on every slide and key: fades out with no edge. */
  fadeTop: 'rgba(255,255,255,0.12)',
  sheen: 'rgba(255,255,255,0.22)',
  line: 'rgba(255,255,255,0.09)',
  boxA: '#0f1433',
  boxB: '#141a3e',
  /** #G8 (Yazan 2026-11-01): beige lightbox behind the board, and the crossword's beige tiles. */
  beigeA: '#f1e6cc',
  beigeB: '#e3d1a8',
  beigeLine: '#c4ab78',
  beigeTile: '#efe2c4',
  beigeInk: '#3b2f1c',
  /** Board tiles stay navy glass on the beige box (opaque, the look they had on the navy box). */
  tileSolid: '#1c2350',
  key: 'rgba(160,220,255,0.08)',
  keyText: '#eef0ff',
  ghost: 'rgba(238,240,255,0.32)',
};
const SLIDES: Record<Mode, typeof dark> = { dark };
export const slideColors = (m: Mode) => SLIDES[m];
export type SlideColors = typeof dark;
