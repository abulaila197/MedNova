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
  key: 'rgba(160,220,255,0.08)',
  keyText: '#eef0ff',
  ghost: 'rgba(238,240,255,0.32)',
};
const light: typeof dark = {
  ok: '#2f9e6c',
  near: '#d39a2c',
  off: '#c4beb3',
  offText: '#6f695f',
  onTile: '#ffffff',
  glass: 'rgba(255,255,255,0.55)',
  glassTop: 'rgba(255,255,255,0.6)',
  fadeTop: 'rgba(255,255,255,0.38)',
  sheen: 'rgba(255,255,255,0.7)',
  line: 'rgba(29,34,48,0.12)',
  boxA: '#f6f2ea',
  boxB: '#efe9de',
  key: 'rgba(255,255,255,0.6)',
  keyText: '#1d2230',
  ghost: 'rgba(29,34,48,0.3)',
};
export const slideColors = (m: Mode) => (m === 'dark' ? dark : light);
export type SlideColors = typeof dark;
