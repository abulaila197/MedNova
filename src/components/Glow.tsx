import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/state/app';
import { THEMES, type Mode } from '@/theme/tokens';
import { u } from '@/theme/scale';

// The glow drifts around the screen edges on its own (56s loop) and never
// comes near the centre. Each page starts at a different point of the loop.
const LOOP = 56000;
const T = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
const X = [0.98, 1, 0.98, 0.5, 0.02, 0, 0.02, 0.5, 0.98];
const Y = [0.02, 0.45, 0.98, 1, 0.98, 0.55, 0.02, 0, 0.02];
const R = [-40, 90, 40, 0, -40, 90, 40, 0, -40];
// blurred ellipses: centre x/y, radius x/y (design px, relative to the anchor)
const E = [
  { cx: 0, cy: 0, rx: 135, ry: 48 },
  { cx: 15, cy: 9, rx: 95, ry: 29 },
  { cx: 20, cy: -8, rx: 60, ry: 14 },
];
const BLUR = 34;
const BOX = 520;

/** `mode` pins the glow to one theme (a game whose room stays dark in light mode). */
export function Glow({ delay = 0, w, h, mode }: { delay?: number; w: number; h: number; mode?: Mode }) {
  const app = useTheme();
  const t = mode ? THEMES[mode] : app;
  // Own gradient ids when pinned, so the page's own glow (also on screen, under) never lends its colours on web.
  const gid = mode ? `gl-${mode}-` : 'gl';
  const p = useSharedValue((((-delay * 1000) % LOOP) + LOOP) % LOOP / LOOP);
  useEffect(() => {
    const start = p.value;
    p.value = withTiming(1, { duration: (1 - start) * LOOP, easing: Easing.linear }, () => {
      p.value = 0;
      p.value = withRepeat(withTiming(1, { duration: LOOP, easing: Easing.linear }), -1, false);
    });
  }, [p]);
  const st = useAnimatedStyle(() => {
    // ease-in-out between keyframes, like the CSS original
    const i = Math.min(7, Math.floor(p.value * 8));
    const f = p.value * 8 - i;
    const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    const q = (T[i] + e * 0.125);
    return {
      transform: [
        { translateX: interpolate(q, T, X) * w - u(BOX) / 2 },
        { translateY: interpolate(q, T, Y) * h - u(BOX) / 2 },
        { rotate: `${interpolate(q, T, R)}deg` },
      ],
    };
  });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {/* cached as a GPU picture: it only moves, so the gradients are never redrawn */}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: u(BOX), height: u(BOX) }, st]} renderToHardwareTextureAndroid shouldRasterizeIOS>
        <Svg width={u(BOX)} height={u(BOX)} viewBox={`${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}`}>
          <Defs>
            {t.glow.map((c, j) => (
              <RadialGradient key={j} id={`${gid}${j}`} cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={c} stopOpacity={0.95} />
                <Stop offset="0.45" stopColor={c} stopOpacity={0.7} />
                <Stop offset="0.75" stopColor={c} stopOpacity={0.25} />
                <Stop offset="1" stopColor={c} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {E.map((e, j) => (
            <Ellipse key={j} cx={e.cx} cy={e.cy} rx={e.rx + BLUR * 1.6} ry={e.ry + BLUR * 1.6} fill={`url(#${gid}${j})`} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}
