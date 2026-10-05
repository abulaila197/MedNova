import { memo } from 'react';
import { Platform } from 'react-native';
import { Defs, FeColorMatrix, Filter, G, Image, LinearGradient, Mask, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';

import { GAME_PHOTOS } from '@/data/games';
import { u } from '@/theme/scale';
import type { Mode } from '@/theme/tokens';

import { ART_B, ART_END, BODY_TOP, fitArt, maskStops, W } from './fit';

// CSS saturate(.78), and for The Streak Master saturate(.78) brightness(.72) contrast(1.06) (light only).
function satMatrix(s: number, k = 1, o = 0) {
  const m = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ].map((v) => v * k);
  return [m[0], m[1], m[2], 0, o, m[3], m[4], m[5], 0, o, m[6], m[7], m[8], 0, o, 0, 0, 0, 1, 0].map((v) => +v.toFixed(5)).join(' ');
}

/**
 * The game drawing, lower right, fading in along the big curve (prototype `.np.arc`):
 * radial fade from a circle beyond the top-left corner x vertical band x 40px feather on the drawing's own edges.
 * Drawn in body coordinates (the content area starts at screen y=72).
 */
export const GameArt = memo(function GameArt({ k, mode }: { k: string; mode: Mode }) {
  const f = fitArt(k, mode);
  const st = maskStops(f);
  const id = `${mode}-${k}`;
  const H = ART_END - BODY_TOP;
  const src = GAME_PHOTOS[mode][k as keyof (typeof GAME_PHOTOS)['dark']];
  const streak = k === 'the-streak-master';
  // Native: SVG colour matrix. Web: the exact CSS filter (SVG filters there run in linearRGB).
  const web = Platform.OS === 'web';
  const filt = mode === 'light' && !web ? (streak ? satMatrix(0.78, 0.72 * 1.06, 0.5 * (1 - 1.06)) : satMatrix(0.78)) : null;
  const css = mode === 'light' && web ? (streak ? 'saturate(0.78) brightness(0.72) contrast(1.06)' : 'saturate(0.78)') : undefined;
  return (
    <Svg width={u(W)} height={u(H)} viewBox={`0 ${BODY_TOP} ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, filter: css }} pointerEvents="none">
      <Defs>
        {/* radial-gradient(ellipse 140% 92% at -10% -4%, transparent 52%, #000 74%) */}
        <RadialGradient id={`rg-${id}`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${-0.1 * W} ${-0.04 * ART_B}) scale(${1.4 * W} ${0.92 * ART_B})`}>
          <Stop offset="0.52" stopColor="#fff" stopOpacity={0} />
          <Stop offset="0.74" stopColor="#fff" stopOpacity={1} />
        </RadialGradient>
        <LinearGradient id={`lv-${id}`} x1="0" y1="0" x2="0" y2={ART_END} gradientUnits="userSpaceOnUse">
          {st.v.map(([o, a], i) => <Stop key={i} offset={o} stopColor="#fff" stopOpacity={a} />)}
        </LinearGradient>
        <LinearGradient id={`lh-${id}`} x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
          {st.h.map(([o, a], i) => <Stop key={i} offset={o} stopColor="#fff" stopOpacity={a} />)}
        </LinearGradient>
        <Mask id={`m1-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={ART_END}>
          <Rect x="0" y="0" width={W} height={ART_END} fill={`url(#rg-${id})`} />
        </Mask>
        <Mask id={`m2-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={ART_END}>
          <Rect x="0" y="0" width={W} height={ART_END} fill={`url(#lv-${id})`} />
        </Mask>
        <Mask id={`m3-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={ART_END}>
          <Rect x="0" y="0" width={W} height={ART_END} fill={`url(#lh-${id})`} />
        </Mask>
        {filt ? (
          <Filter id={`f-${id}`} x="0" y="0" width="100%" height="100%">
            <FeColorMatrix type="matrix" values={filt} />
          </Filter>
        ) : null}
      </Defs>
      <G mask={`url(#m1-${id})`}>
        <G mask={`url(#m2-${id})`}>
          <G mask={`url(#m3-${id})`}>
            <Image href={src} x={f.x} y={f.y} width={f.w} height={f.h} preserveAspectRatio="none" filter={filt ? `url(#f-${id})` : undefined} />
          </G>
        </G>
      </G>
    </Svg>
  );
});
