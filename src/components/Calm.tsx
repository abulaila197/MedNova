import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/state/app';

/** How far a calm edge or a veil reaches past its box to the sides (and a calm edge below a list): past any screen's
 *  edge, where the page clips it. Nothing is measured. */
export const FAR = 3000;

/** [offset 0..1 from the box's top to its bottom, navy strength 0..1] */
export type CalmStops = [number, number][];

/**
 * Calm edges (Yazan 2026-11-16, option A): the page background turns plain navy where a list fades out, so the list's
 * fade (a plain navy gradient, see Fade `veil`) meets plain navy and there is nothing to line up: no copy of the
 * background picture, no mask, nothing measured. Lies on the background, under the page's content, and reaches out to
 * the screen's sides, so it never draws a box.
 */
export function Calm({ stops, style }: { stops: CalmStops; style: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const rgb = hexRgb(t.sky);
  return (
    <LinearGradient
      pointerEvents="none"
      colors={stops.map(([, a]) => `rgba(${rgb},${a})`) as unknown as [string, string, ...string[]]}
      locations={stops.map(([o]) => o) as unknown as [number, number, ...number[]]}
      style={[{ position: 'absolute', left: -FAR, right: -FAR }, style]}
    />
  );
}

/** "#0d1738" -> "13,23,56" (a colour that isn't 6-digit hex falls back to the app navy). */
export function hexRgb(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [m[1], m[2], m[3]].map((x) => parseInt(x, 16)).join(',') : '13,23,56';
}
