import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';

import type { LoadCfg } from './configs';
import { q } from './geo';

const APath = Animated.createAnimatedComponent(Path);

/** Each game's own progress bar (preview v4). `p` runs 0 to 1 over the loading time. */
export function Bar({ g, p, w }: { g: LoadCfg; p: SharedValue<number>; w: number }) {
  const b = g.bar;
  if (b.t === 'line' || b.t === 'flame' || b.t === 'diamond') return <LineBar g={g} p={p} />;
  if (b.t === 'chalk') return <Chalk c={b.c!} p={p} w={w} />;
  if (b.t === 'march') return <March c={b.c!} flag={b.flag!} p={p} w={w} />;
  if (b.t === 'thread') return <Thread c={b.c!} p={p} />;
  if (b.t === 'tiles') return <Steps n={6} p={p} kind="tiles" />;
  if (b.t === 'squares') return <Steps n={12} p={p} kind="squares" />;
  return <Steps n={10} p={p} kind="bulbs" />;
}

/** Bar box height: the step bars are taller or shorter than the 18px line box. */
export const barHeight = (g: LoadCfg) => q(g.bar.t === 'tiles' ? 26 : g.bar.t === 'squares' ? 16 : g.bar.t === 'march' ? 22 : 18);

function LineBar({ g, p }: { g: LoadCfg; p: SharedValue<number> }) {
  const b = g.bar;
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  const tip = useAnimatedStyle(() => ({ left: `${p.value * 100}%` }));
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[s.track, { backgroundColor: b.track }]} />
      <Animated.View style={[s.track, { right: undefined, backgroundColor: b.c, boxShadow: b.glow }, fill]} />
      {b.t === 'flame' ? (
        <Animated.View style={[s.tip, { top: q(3), width: q(12), height: q(12), marginLeft: -q(6) }, tip]}>
          <Svg width="100%" height="100%" viewBox="0 0 12 12">
            <Defs>
              <RadialGradient id="flametip" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#fff3c8" />
                <Stop offset="0.57" stopColor="#ffb54a" />
                <Stop offset="1" stopColor="#ff8c28" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="6" cy="6" r="6" fill="url(#flametip)" />
          </Svg>
        </Animated.View>
      ) : null}
      {b.t === 'diamond' ? <Animated.View style={[s.tip, { top: q(4), width: q(9), height: q(9), marginLeft: -q(4.5), backgroundColor: b.c, transform: [{ rotate: '45deg' }], boxShadow: `0 0 10px ${b.c}` }, tip]} /> : null}
    </View>
  );
}

const CHALK = 'M2 10 C 50 7, 90 12, 130 9 S 210 8, 250 10';
function Chalk({ c, p, w }: { c: string; p: SharedValue<number>; w: number }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: 252 * (1 - p.value) }));
  return (
    <Svg width={w} height={q(18)} viewBox="0 0 252 18" preserveAspectRatio="none" style={s.over}>
      <Path d={CHALK} stroke="rgba(244,241,230,0.18)" strokeWidth={3} fill="none" strokeLinecap="round" />
      <APath d={CHALK} stroke={c} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeDasharray="252" animatedProps={props} />
    </Svg>
  );
}

// The Conqueror's marching route: the same curve as the preview, sampled once so the flag can ride it.
const MARCH = 'M4 14 C 60 4, 110 20, 160 10 S 230 8, 248 12';
const ROUTE = (() => {
  const cub = (a: number[], t: number) => {
    const m = 1 - t;
    return [0, 1].map((i) => m * m * m * a[i] + 3 * m * m * t * a[2 + i] + 3 * m * t * t * a[4 + i] + t * t * t * a[6 + i]);
  };
  const segs = [
    [4, 14, 60, 4, 110, 20, 160, 10],
    [160, 10, 210, 0, 230, 8, 248, 12],
  ];
  const pts: number[][] = [];
  segs.forEach((sg, k) => {
    for (let i = k ? 1 : 0; i <= 40; i++) pts.push(cub(sg, i / 40));
  });
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[len.length - 1];
  // 41 points evenly spaced along the route.
  return Array.from({ length: 41 }, (_, i) => {
    const d = (total * i) / 40;
    let j = 1;
    while (j < len.length - 1 && len[j] < d) j++;
    const f = (d - len[j - 1]) / (len[j] - len[j - 1] || 1);
    return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f];
  });
})();
const RX = ROUTE.map((r) => r[0]);
const RY = ROUTE.map((r) => r[1]);

function March({ c, flag, p, w }: { c: string; flag: string; p: SharedValue<number>; w: number }) {
  const clip = useAnimatedStyle(() => ({ width: w * p.value }));
  const sx = w / 252;
  const sy = q(22) / 22;
  const fp = useAnimatedStyle(() => {
    const k = Math.min(39.999, p.value * 40);
    const i = Math.floor(k);
    const f = k - i;
    return { left: (RX[i] + (RX[i + 1] - RX[i]) * f) * sx, top: (RY[i] + (RY[i + 1] - RY[i]) * f) * sy };
  });
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={w} height={q(22)} viewBox="0 0 252 22" preserveAspectRatio="none" style={s.over}>
        <Path d={MARCH} stroke="rgba(90,58,30,0.25)" strokeWidth={1.6} fill="none" strokeDasharray="3 4" />
      </Svg>
      <Animated.View style={[s.clip, clip]}>
        <Svg width={w} height={q(22)} viewBox="0 0 252 22" preserveAspectRatio="none" style={s.over}>
          <Path d={MARCH} stroke={c} strokeWidth={2} fill="none" strokeDasharray="3 4" />
        </Svg>
      </Animated.View>
      <Animated.View style={[s.flag, fp]}>
        <Svg width={q(12)} height={q(16)} viewBox={`0 ${-q(14)} ${q(12)} ${q(16)}`} style={s.over}>
          <Line x1={0} y1={0} x2={0} y2={-q(13)} stroke="#3b2412" strokeWidth={1.4} />
          <Path d={`M0 ${-q(13)} L${q(10)} ${-q(10)} L0 ${-q(7)}Z`} fill={flag} />
          <Circle r={q(2.4)} fill={flag} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const PINS = [0, 0.33, 0.66, 1];
function Thread({ c, p }: { c: string; p: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={[StyleSheet.absoluteFill, { marginHorizontal: q(4) }]}>
      <View style={[s.thread, { top: q(9), height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      <Animated.View style={[s.thread, { right: undefined, top: q(8.5), height: q(2), backgroundColor: c, boxShadow: '0 0 6px rgba(200,35,47,0.6)' }, fill]} />
      {PINS.map((x) => (
        <Pin key={x} x={x} p={p} />
      ))}
    </View>
  );
}

function Pin({ x, p }: { x: number; p: SharedValue<number> }) {
  const st = useAnimatedStyle(() => ({ opacity: p.value >= x - 0.001 ? 1 : 0.25 }));
  return (
    <Animated.View style={[s.pin, { left: `${x * 100}%`, top: q(5), width: q(9), height: q(9), marginLeft: -q(4.5) }, st]}>
      <Svg width="100%" height="100%" viewBox="0 0 10 10">
        <Defs>
          <RadialGradient id="pinhead" cx="35%" cy="35%" r="65%">
            <Stop offset="0" stopColor="#ff6b74" />
            <Stop offset="1" stopColor="#9e1622" />
          </RadialGradient>
        </Defs>
        <Circle cx="5" cy="5" r="5" fill="url(#pinhead)" />
      </Svg>
    </Animated.View>
  );
}

const TILE = ['#6aaa64', '#c9b458', '#787c7e', '#6aaa64', '#c9b458', '#6aaa64'];
function Steps({ n, p, kind }: { n: number; p: SharedValue<number>; kind: 'tiles' | 'squares' | 'bulbs' }) {
  return (
    <View style={[s.row, { gap: q(kind === 'tiles' ? 6 : kind === 'squares' ? 3 : 7), justifyContent: kind === 'tiles' ? 'flex-start' : 'center' }]}>
      {Array.from({ length: n }, (_, i) => (
        <Step key={i} i={i} n={n} p={p} kind={kind} />
      ))}
    </View>
  );
}

function Step({ i, n, p, kind }: { i: number; n: number; p: SharedValue<number>; kind: 'tiles' | 'squares' | 'bulbs' }) {
  const on = useAnimatedStyle(() => ({ opacity: Math.floor(p.value * n + 0.0001) > i ? 1 : 0 }));
  if (kind === 'tiles')
    return (
      <View style={{ width: q(26), height: q(26) }}>
        <View style={[s.tile, { backgroundColor: 'rgba(255,255,255,0.55)', borderColor: 'rgba(60,74,92,0.25)' }]} />
        <Animated.View style={[s.tile, { backgroundColor: TILE[i], borderColor: 'transparent' }, on]} />
      </View>
    );
  if (kind === 'squares')
    return (
      <View style={{ width: q(16), height: q(16) }}>
        <View style={[s.sq, { backgroundColor: '#fbf8f1' }]} />
        <Animated.View style={[s.sq, { backgroundColor: i === n - 1 ? '#8e1b2a' : '#1c1a18' }, on]} />
      </View>
    );
  return (
    <View style={{ width: q(11), height: q(11) }}>
      <View style={[s.bulb, { backgroundColor: '#5a3d22', boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.5)' }]} />
      <Animated.View style={[s.bulb, { backgroundColor: '#ffd88a', boxShadow: '0 0 8px #ffcf70, 0 0 16px rgba(255,190,90,0.6), inset -2px -2px 3px #e79b3c' }, on]} />
    </View>
  );
}

const s = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, top: q(8), height: q(2), borderRadius: q(2) },
  tip: { position: 'absolute', borderRadius: 999, overflow: 'visible' },
  over: { overflow: 'visible' },
  flag: { position: 'absolute', width: q(12), height: q(16), marginTop: -q(14) },
  clip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  thread: { position: 'absolute', left: 0, right: 0 },
  pin: { position: 'absolute', borderRadius: 999, boxShadow: '0 1px 2px rgba(0,0,0,0.6)' },
  row: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tile: { ...StyleSheet.absoluteFill, borderRadius: q(3), borderWidth: 1.5, boxShadow: '0 2px 3px rgba(60,50,30,0.18)' },
  sq: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: 'rgba(28,26,24,0.35)', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' },
  bulb: { ...StyleSheet.absoluteFill, borderRadius: 999 },
});
