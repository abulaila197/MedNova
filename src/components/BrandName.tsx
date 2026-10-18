import { memo } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/*
 * The MedNova name in the header (Yazan 2026-10-18, "Bold"): hand-drawn geometric letters in the style of the NOVA
 * lettering reference (/mnt/project-files/mednova/brand/nova-lettering-ref.png). Each letter is a thick stroke on a
 * centre line, clipped flat at the cap or x-height line and the baseline; cap height = 100 units.
 * Made by /mnt/project-files/mednova/brand/lettering.py (stroke 19, letter gap 9); regenerate there, don't hand-edit.
 */
const STROKE = 19;
const W = 618.0;
const LETTERS = [
  { x: 0, top: 0, w: 112, nova: false, d: ['M9.5 100 L9.5 0 L56.0 66 L102.5 0 L102.5 100'] }, // M
  { x: 121, top: 28, w: 72, nova: false, d: ['M9.5 64.0 L62.5 64.0 A26.5 26.5 0 1 0 56.88 80.32'] }, // e
  { x: 202, top: 0, w: 72.0, nova: false, d: ['M62.5 64.0 A26.5 26.5 0 1 0 9.5 64.0 A26.5 26.5 0 1 0 62.5 64.0', 'M62.5 0 L62.5 100'] }, // d
  { x: 283.0, top: 0, w: 92, nova: true, d: ['M9.5 100 L9.5 0 L82.5 100 L82.5 0'] }, // N
  { x: 384.0, top: 28, w: 72, nova: true, d: ['M62.5 64.0 A26.5 26.5 0 1 0 9.5 64.0 A26.5 26.5 0 1 0 62.5 64.0'] }, // o
  { x: 465.0, top: 28, w: 72, nova: true, d: ['M8.55 28 L36.0 100 L63.45 28'] }, // v
  { x: 546.0, top: 28, w: 72.0, nova: true, d: ['M62.5 64.0 A26.5 26.5 0 1 0 9.5 64.0 A26.5 26.5 0 1 0 62.5 64.0', 'M62.5 28 L62.5 100'] }, // a
];

/** `height` is the cap height in px; the name's width follows (about 6.18x the height). */
export const BrandName = memo(function BrandName({ height, color, accent }: { height: number; color: string; accent: string }) {
  return (
    <Svg width={(height * (W + 8)) / 108} height={height * 1.08} viewBox={`-4 -4 ${W + 8} 108`} accessibilityLabel="MedNova">
      <Defs>
        {LETTERS.map((l, i) => (
          <ClipPath key={i} id={`bn${i}`}>
            <Rect x={-20} y={l.top} width={l.w + 40} height={100 - l.top} />
          </ClipPath>
        ))}
      </Defs>
      {LETTERS.map((l, i) => (
        <G key={i} x={l.x} clipPath={`url(#bn${i})`}>
          {l.d.map((d, j) => (
            <Path key={j} d={d} fill="none" stroke={l.nova ? accent : color} strokeWidth={STROKE} strokeLinejoin="miter" strokeMiterlimit={20} />
          ))}
        </G>
      ))}
    </Svg>
  );
});
