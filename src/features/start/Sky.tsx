import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { u } from '@/theme/scale';

// Nebula sky of the start flow: three soft radial washes over deep navy (prototype `.screen`).
export const NAVY = '#070a1c';

type Wash = { at: [number, number]; r: [number, number]; color: string; alpha: number; end: number };

const DARK: Wash[] = [
  { at: [0.85, 0], r: [1.2, 0.55], color: '#3b2b8f', alpha: 1, end: 0.55 },
  { at: [0, 0.5], r: [0.9, 0.5], color: '#0f4a7a', alpha: 1, end: 0.6 },
  { at: [1, 1], r: [0.8, 0.4], color: '#5a1f6e', alpha: 1, end: 0.6 },
];
const LIGHT: Wash[] = [
  { at: [0.9, 0], r: [0.9, 0.45], color: '#e9bf4f', alpha: 0.32, end: 0.6 },
  { at: [0, 1], r: [0.8, 0.4], color: '#e5833a', alpha: 0.18, end: 0.6 },
];

let seq = 0;

/** CSS radial-gradient(rx% ry% at x% y%, color, transparent end%) layers over a base colour. */
export function Sky({ w, h, light = false }: { w: number; h: number; light?: boolean }) {
  const id = useMemo(() => `sky${++seq}`, []);
  const washes = light ? LIGHT : DARK;
  // CSS paints the first layer on top, so draw them in reverse.
  const order = [...washes].reverse();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: light ? '#e7e2d8' : NAVY }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          {order.map((g, i) => (
            <RadialGradient
              key={i}
              id={`${id}_${i}`}
              gradientUnits="userSpaceOnUse"
              cx={0}
              cy={0}
              r={1}
              gradientTransform={`translate(${g.at[0] * w} ${g.at[1] * h}) scale(${g.r[0] * w} ${g.r[1] * h})`}>
              <Stop offset={0} stopColor={g.color} stopOpacity={g.alpha} />
              <Stop offset={g.end} stopColor={g.color} stopOpacity={0} />
              <Stop offset={1} stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {order.map((_, i) => (
          <Rect key={i} x={0} y={0} width={w} height={h} fill={`url(#${id}_${i})`} />
        ))}
      </Svg>
    </View>
  );
}

/**
 * The prototype's twinkling star canvas: 70 stars from the same seeded generator
 * (seed 11 + 17 x screen index), each pulsing between 25% and 80% opacity.
 * Stars are grouped by speed and phase so a single looping clock drives them.
 */
export function Stars({ si, hd }: { si: number; hd: number }) {
  const clock = useRef(new Animated.Value(0)).current;
  const groups = useMemo(() => {
    let s = 11 + si * 17;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const out: { key: string; c: number; ph: number; stars: { x: number; y: number; r: number }[] }[] = [];
    for (let k = 0; k < 70; k++) {
      const x = rnd() * 282;
      const y = rnd() * hd;
      const r = rnd() * 1.1 + 0.2;
      const p = rnd() * 6.28;
      const v = 0.4 + rnd();
      // canvas: alpha = .25 + .55 * (.5 + .5 sin(p + t * .0012 v)), period 5.24s / v. Loop is 12s long.
      const c = Math.min(3, Math.max(1, Math.round((12 * 0.0012 * v * 1000) / (2 * Math.PI))));
      const ph = Math.round(p / (Math.PI / 2)) % 4;
      const key = `${c}_${ph}`;
      let g = out.find((o) => o.key === key);
      if (!g) out.push((g = { key, c, ph, stars: [] }));
      g.stars.push({ x, y, r });
    }
    return out;
  }, [si, hd]);
  useEffect(() => {
    const a = Animated.loop(Animated.timing(clock, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [clock]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {groups.map((g) => {
        const inputRange: number[] = [];
        const outputRange: number[] = [];
        for (let i = 0; i <= 36; i++) {
          const x = i / 36;
          inputRange.push(x);
          outputRange.push(0.25 + 0.55 * (0.5 + 0.5 * Math.sin((g.ph * Math.PI) / 2 + 2 * Math.PI * g.c * x)));
        }
        return (
          <Animated.View key={g.key} style={[StyleSheet.absoluteFill, { opacity: clock.interpolate({ inputRange, outputRange }) }]}>
            {g.stars.map((p, i) => (
              <View
                key={i}
                style={{ position: 'absolute', left: u(p.x - p.r), top: u(p.y - p.r), width: u(p.r * 2), height: u(p.r * 2), borderRadius: u(p.r), backgroundColor: '#fff' }}
              />
            ))}
          </Animated.View>
        );
      })}
    </View>
  );
}
