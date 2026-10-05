import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type Ref, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedStyle, useFrameCallback, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { GAMES } from '@/data/games';
import { F } from '@/theme/tokens';

import { Bar, barHeight } from './Bar';
import type { LoadCfg } from './configs';
import { q } from './geo';
import { Particles } from './Particles';

/**
 * One mode loading page: "MedNova Original:", the title and sub name, the game's own bar and a game tip,
 * over Yazan's photo brought to life (slow push-in, glows, particles). `live` false holds the art still
 * (during the doors). `p` is the bar's progress, 0 to 1.
 */
export function LoadingPage({ g, w, h, live, p, tip, barRef }: { g: LoadCfg; w: number; h: number; live: boolean; p: SharedValue<number>; tip: string; barRef?: Ref<View> }) {
  const ins = useSafeAreaInsets();
  const artH = h;
  const artW = (artH * 9) / 16;
  const clock = useSharedValue(0);
  const push = useSharedValue(1);
  const frame = useFrameCallback((f) => {
    clock.value += (f.timeSincePreviousFrame ?? 16) / 1000;
  }, false);

  useEffect(() => {
    frame.setActive(live);
    if (live) push.value = withRepeat(withTiming(1.075, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
    else cancelAnimation(push);
  }, [live, frame, push]);

  const pushSt = useAnimatedStyle(() => ({ transform: [{ scale: push.value }] }));
  const center = g.txt.align === 'center';
  const stepBar = ['tiles', 'squares', 'bulbs'].includes(g.bar.t);
  const textW = w - q(48);
  const barW = textW - (center && !stepBar ? q(36) : 0) - (g.bar.t === 'thread' ? q(8) : 0);
  const ls = (em: number | undefined, size: number) => (em ? em * q(size) : 0);

  return (
    <View style={[StyleSheet.absoluteFill, s.root, { backgroundColor: g.bg ?? '#000' }]}>
      <View style={[s.art, { width: artW, height: artH, left: (w - artW) / 2, top: g.artY ? q(g.artY) : 0 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: g.fo }, pushSt]}>
          <Image source={g.photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          {g.glows.map((o, i) => (
            <Glow key={i} o={o} id={`${g.key}${i}`} artW={artW} artH={artH} live={live} />
          ))}
          {g.chase ? g.chase.xs.map((x, i) => <Chase key={i} x={x * artW} y={g.chase!.y * artH} i={i} n={g.chase!.xs.length} p={p} />) : null}
          {g.sweep ? <Sweep live={live} /> : null}
          {g.parts.length ? <Particles types={g.parts} t={clock} w={artW} h={artH} /> : null}
        </Animated.View>
      </View>
      <LinearGradient colors={g.veil.c as [string, string, ...string[]]} locations={g.veil.at as [number, number, ...number[]]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[s.txt, { top: q(g.txt.top) + Math.max(0, ins.top - q(24)), alignItems: center ? 'center' : 'flex-start', transform: g.txt.rot ? [{ rotate: `${g.txt.rot}deg` }] : undefined }]}>
        <Text style={[s.orig, { fontFamily: g.orig.f, color: g.orig.c, textAlign: g.txt.align }]}>MedNova Original:</Text>
        <Text
          style={{
            marginTop: q(6),
            fontFamily: g.title.f,
            fontSize: q(g.title.s),
            lineHeight: q(g.title.s * 1.02),
            color: g.title.c,
            letterSpacing: ls(g.title.ls, g.title.s),
            textAlign: g.txt.align,
            textShadowColor: g.title.sh ?? 'rgba(0,0,0,0.25)',
            textShadowOffset: { width: 0, height: g.title.sh ? 0 : 2 },
            textShadowRadius: q(g.title.sh ? 16 : 12),
          }}
        >
          {`${LEAD[g.key]} `}
          <Text style={{ color: g.title.em, fontFamily: g.title.emF ?? g.title.f }}>{EM[g.key]}</Text>
        </Text>
        <Text style={{ marginTop: q(8), fontFamily: g.sub.f, fontSize: q(g.sub.s), lineHeight: q(g.sub.s * 1.25), color: g.sub.c, letterSpacing: ls(g.sub.ls, g.sub.s), textAlign: g.txt.align }}>{SUB[g.key]}</Text>
        <View ref={barRef} collapsable={false} style={{ marginTop: q(20), height: barHeight(g), width: barW, alignSelf: center ? 'center' : 'flex-start' }}>
          <Bar g={g} p={p} w={barW} />
        </View>
        <View style={[s.tip, { backgroundColor: g.tip.bg, borderColor: g.tip.b, alignSelf: center ? 'center' : 'flex-start' }]}>
          <Text style={{ fontFamily: g.tip.f, fontSize: q(g.tip.s), lineHeight: q(g.tip.s * 1.35), color: g.tip.c, textAlign: g.txt.align }}>
            <Text style={{ opacity: 0.7 }}>Tip: </Text>
            {tip}
          </Text>
        </View>
      </View>

      <View style={[s.tag, { [g.tag.side]: q(20), bottom: q(22) + ins.bottom, backgroundColor: g.tag.bg, borderColor: g.tag.b }]}>
        <Text style={[s.tagT, { color: g.tag.c }]}>{g.tag.t.toUpperCase()}</Text>
      </View>
    </View>
  );
}

// Title words come from the Games list so the names never drift apart.
const LEAD = Object.fromEntries(GAMES.map((x) => [x.key, x.lead]));
const EM = Object.fromEntries(GAMES.map((x) => [x.key, x.em]));
const SUB = Object.fromEntries(GAMES.map((x) => [x.key, x.sub]));

/** Parses "rgba(r,g,b,a)" for SVG stops (colour and opacity apart). */
function rgba(c: string) {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return { c, a: 1 };
  const [r, gg, b, a = '1'] = m[1].split(',').map((x) => x.trim());
  return { c: `rgb(${r},${gg},${b})`, a: Number(a) };
}

function Glow({ o, id, artW, artH, live }: { o: LoadCfg['glows'][number]; id: string; artW: number; artH: number; live: boolean }) {
  const op = useSharedValue(0.85);
  const sc = useSharedValue(1);
  const dy = useSharedValue(0);
  useEffect(() => {
    if (!live) return;
    const ms = (n: number) => ({ duration: n, easing: Easing.inOut(Easing.ease) });
    if (o.a === 'pulse') {
      op.value = withRepeat(withSequence(withTiming(1, ms(1300)), withTiming(0.55, ms(1300))), -1);
      sc.value = withRepeat(withSequence(withTiming(1.08, ms(1300)), withTiming(0.92, ms(1300))), -1);
    } else {
      // The preview's candle flicker keyframes over 2.2 s.
      const k = [0.6, 1, 0.75, 0.95, 0.7, 1, 0.85];
      const at = [264, 176, 396, 308, 396, 308, 352];
      op.value = withRepeat(withSequence(...k.map((v, i) => withTiming(v, ms(at[i])))), -1);
      sc.value = withRepeat(withSequence(withTiming(1.06, ms(440)), withTiming(0.97, ms(704)), withTiming(1, ms(1056))), -1);
      dy.value = withRepeat(withSequence(withTiming(-0.02, ms(440)), withTiming(0, ms(704)), withTiming(0, ms(1056))), -1);
    }
    return () => [op, sc, dy].forEach(cancelAnimation);
  }, [live, o.a, op, sc, dy]);
  const d = q(o.r * 2);
  const st = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: dy.value * d }, { scale: sc.value }] }));
  const col = rgba(o.c);
  return (
    <Animated.View pointerEvents="none" style={[s.glow, { left: o.x * artW - d / 2, top: o.y * artH - d / 2, width: d, height: d }, st]}>
      <Svg width={d} height={d}>
        <Defs>
          <RadialGradient id={`glow${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={col.c} stopOpacity={col.a} />
            <Stop offset="0.7" stopColor={col.c} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#glow${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** Streak Master marquee bulbs: 9 lit from the start, the rest light up with the bar. */
function Chase({ x, y, i, n, p }: { x: number; y: number; i: number; n: number; p: SharedValue<number> }) {
  const st = useAnimatedStyle(() => ({ opacity: i < Math.max(9, Math.round(p.value * n)) ? 1 : 0 }));
  const d = q(26);
  return (
    <Animated.View pointerEvents="none" style={[s.glow, { left: x - d / 2, top: y - d / 2, width: d, height: d }, st]}>
      <Svg width={d} height={d}>
        <Defs>
          <RadialGradient id={`chase${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="rgb(255,240,200)" stopOpacity={0.95} />
            <Stop offset="0.35" stopColor="rgb(255,200,110)" stopOpacity={0.45} />
            <Stop offset="0.7" stopColor="rgb(255,200,110)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#chase${i})`} />
      </Svg>
    </Animated.View>
  );
}

/** Medicordle and Crossword: a soft daylight band moving over the paper. */
function Sweep({ live }: { live: boolean }) {
  const x = useSharedValue(-0.6);
  useEffect(() => {
    if (!live) return;
    x.value = withRepeat(withSequence(withTiming(0.6, { duration: 3300, easing: Easing.inOut(Easing.ease) }), withTiming(0.6, { duration: 2200 }), withTiming(-0.6, { duration: 0 })), -1);
    return () => cancelAnimation(x);
  }, [live, x]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: `${x.value * 100}%` }] }));
  return (
    <Animated.View pointerEvents="none" style={[s.sweep, st]}>
      <LinearGradient
        colors={['rgba(255,252,240,0)', 'rgba(255,252,240,0.30)', 'rgba(255,252,240,0)']}
        locations={[0.4, 0.5, 0.6]}
        start={{ x: 0, y: 0.37 }}
        end={{ x: 1, y: 0.63 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { overflow: 'hidden' },
  art: { position: 'absolute', overflow: 'hidden' },
  glow: { position: 'absolute', mixBlendMode: 'screen' },
  sweep: { position: 'absolute', top: '-20%', bottom: '-20%', left: '-20%', right: '-20%', mixBlendMode: 'soft-light' },
  txt: { position: 'absolute', left: q(24), right: q(24) },
  orig: { fontSize: q(11), letterSpacing: q(11 * 0.16), textTransform: 'uppercase', opacity: 0.9 },
  tip: { marginTop: q(12), paddingVertical: q(8), paddingHorizontal: q(12), borderRadius: q(8), borderWidth: 1, maxWidth: '100%' },
  tag: { position: 'absolute', paddingVertical: q(5), paddingHorizontal: q(8), borderRadius: q(5), borderWidth: 1 },
  tagT: { fontFamily: F.bodySemi, fontSize: q(8.5), letterSpacing: q(8.5 * 0.14) },
});
