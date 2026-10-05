import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import type { PartType } from './configs';
import { q } from './geo';

// The living-art particles from the preview canvas. Each particle's place is a pure function of the
// clock `t` (seconds), so nothing is stored per frame and a paused clock holds the picture still.
// Speeds are the preview's pixels per frame at 60 fps, on the photo box.

const COUNT: Record<PartType, number> = { rain: 70, rainwin: 26, chalk: 40, motes: 34, sparkle: 22, embers: 26, smoke: 9 };

/** Same random numbers every run for particle i, field k (and respawn cycle c). */
function hash(i: number, k: number, c: number) {
  'worklet';
  let h = (i * 374761393 + k * 668265263 + c * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const wrap = (v: number, m: number) => {
  'worklet';
  return ((v % m) + m) % m;
};

export function Particles({ types, t, w, h }: { types: PartType[]; t: SharedValue<number>; w: number; h: number }) {
  const list = useMemo(() => types.flatMap((ty, n) => Array.from({ length: COUNT[ty] }, (_, i) => ({ ty, i: i + n * 100 }))), [types]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {list.map(({ ty, i }) => (
        <Particle key={`${ty}${i}`} ty={ty} i={i} t={t} w={w} h={h} />
      ))}
    </View>
  );
}

function Particle({ ty, i, t, w, h }: { ty: PartType; i: number; t: SharedValue<number>; w: number; h: number }) {
  const r = (k: number) => hash(i, k, 0);
  const sc = q(1);

  const st = useAnimatedStyle(() => {
    const f = t.value * 60;
    if (ty === 'rain') {
      const v = (9 + hash(i, 2, 0) * 6) * sc;
      const tr = v * f;
      return { transform: [{ translateX: wrap(hash(i, 0, 0) * w - 0.12 * tr, w) }, { translateY: wrap(hash(i, 1, 0) * h + tr, h + 20) - 20 }, { rotate: '6.8deg' }] };
    }
    if (ty === 'rainwin') {
      const v = (0.4 + hash(i, 2, 0) * 1.4) * sc;
      return { transform: [{ translateX: hash(i, 0, 0) * w * 0.46 }, { translateY: h * 0.33 + wrap(hash(i, 1, 0) * h * 0.33 + v * f, h * 0.33) }] };
    }
    if (ty === 'chalk') {
      const P = 167;
      const ff = f + hash(i, 9, 0) * P;
      const c = Math.floor(ff / P);
      const k = ff - c * P;
      const x = w * (0.5 + (hash(i, 0, c) - 0.5) * 0.3) + (hash(i, 2, c) - 0.3) * 0.35 * sc * k;
      const y = h * (0.53 + (hash(i, 1, c) - 0.5) * 0.12) + (0.15 + hash(i, 3, c) * 0.35) * sc * k;
      return { opacity: (0.5 + hash(i, 4, c) * 0.4) * (1 - k / P), transform: [{ translateX: x }, { translateY: y }] };
    }
    if (ty === 'motes') {
      const ph0 = hash(i, 5, 0) * 6.28;
      const ph = ph0 + 0.03 * f;
      const x = hash(i, 0, 0) * w + (hash(i, 2, 0) - 0.5) * 0.15 * sc * f - 3.33 * sc * (Math.cos(ph) - Math.cos(ph0));
      const y = hash(i, 1, 0) * h - (0.05 + hash(i, 3, 0) * 0.12) * sc * f;
      return { opacity: (0.25 + hash(i, 4, 0) * 0.45) * (0.6 + 0.4 * Math.sin(ph)), transform: [{ translateX: wrap(x, w) }, { translateY: wrap(y + 5, h + 10) - 5 }] };
    }
    if (ty === 'sparkle') {
      const sp = 0.03 + hash(i, 2, 0) * 0.05;
      const ph = hash(i, 5, 0) * 6.28 + sp * f;
      const c = Math.floor(ph / (6.28 * 3));
      const a = Math.max(0, Math.sin(ph));
      return { opacity: a * 0.9, transform: [{ translateX: w * (0.1 + hash(i, 0, c) * 0.8) }, { translateY: h * (0.3 + hash(i, 1, c) * 0.6) }, { scale: (0.5 + a) / 1.5 }] };
    }
    if (ty === 'embers') {
      const d = 0.008 + hash(i, 6, 0) * 0.012;
      const P = 1 / d;
      const ff = f + hash(i, 9, 0) * P;
      const c = Math.floor(ff / P);
      const k = ff - c * P;
      const x = w * 0.17 + (hash(i, 0, c) - 0.5) * 14 * sc + (-0.3 + hash(i, 2, c) * 0.9) * sc * k;
      const y = h * 0.735 + (-0.6 - hash(i, 3, c) * 1.1) * sc * k + 0.002 * sc * k * k;
      return { opacity: 1 - k / P, transform: [{ translateX: x }, { translateY: y }] };
    }
    // smoke
    const d = 0.0035 + hash(i, 6, 0) * 0.003;
    const P = 1 / d;
    const ff = f + hash(i, 9, 0) * P;
    const c = Math.floor(ff / P);
    const k = ff - c * P;
    const r0 = 14 + hash(i, 4, c) * 16;
    const rad = r0 + 0.12 * k;
    const x = w * 0.38 + (hash(i, 0, c) - 0.5) * 20 * sc + (hash(i, 2, c) - 0.4) * 0.25 * sc * k;
    const y = h * 0.33 + (-0.25 - hash(i, 3, c) * 0.2) * sc * k;
    return { opacity: 1 - k / P, transform: [{ translateX: x }, { translateY: y }, { scale: rad / 60 }] };
  });

  if (ty === 'rain') {
    const l = (9 + r(3) * 12) * sc;
    return <Animated.View style={[s.p, { width: 1, height: l, backgroundColor: `rgba(220,225,235,${0.12 + r(4) * 0.2})` }, st]} />;
  }
  if (ty === 'rainwin') {
    const l = (4 + r(3) * 8) * sc;
    return <Animated.View style={[s.p, { width: 1.1, height: l, backgroundColor: `rgba(230,230,235,${0.1 + r(4) * 0.18})` }, st]} />;
  }
  if (ty === 'chalk' || ty === 'motes') {
    const d = (ty === 'chalk' ? 0.6 + r(7) * 1.4 : 0.5 + r(7) * 1.3) * 2 * sc;
    return <Animated.View style={[s.p, s.dot, { width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, backgroundColor: ty === 'chalk' ? 'rgb(245,243,232)' : 'rgb(255,220,150)' }, st]} />;
  }
  if (ty === 'sparkle') {
    const z = (1 + r(7) * 2) * 1.5 * 4 * sc;
    return (
      <Animated.View style={[s.p, { width: z, height: z, marginLeft: -z / 2, marginTop: -z / 2 }, st]}>
        <View style={[s.bar, { left: 0, right: 0, top: z / 2 - 0.5, height: 1 }]} />
        <View style={[s.bar, { top: 0, bottom: 0, left: z / 2 - 0.5, width: 1 }]} />
      </Animated.View>
    );
  }
  if (ty === 'embers') {
    const d = (0.8 + r(7) * 1.6) * 2 * sc;
    return <Animated.View style={[s.p, s.dot, { width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, backgroundColor: 'rgb(255,200,60)', boxShadow: '0 0 6px rgba(255,140,40,0.9)' }, st]} />;
  }
  // smoke: a 120px soft puff, scaled to its radius
  return (
    <Animated.View style={[s.p, { width: 120, height: 120, marginLeft: -60, marginTop: -60 }, st]}>
      <Svg width={120} height={120}>
        <Defs>
          <RadialGradient id={`smoke${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="rgb(220,220,220)" stopOpacity={0.09} />
            <Stop offset="1" stopColor="rgb(220,220,220)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={60} cy={60} r={60} fill={`url(#smoke${i})`} />
      </Svg>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  p: { position: 'absolute', left: 0, top: 0 },
  dot: { borderRadius: 999 },
  bar: { position: 'absolute', backgroundColor: 'rgb(255,240,200)' },
});
