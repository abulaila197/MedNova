// The battle page's motion, "March and clash" (Yazan 2026-10-14): every order lands at once, the way the engine
// resolves it. For each march an arrow in the marcher's colour inks itself from the land (or from above, for the reserve), three small
// pawns in the marcher's colour hop along it, and at the gate the castle shakes under a burst of ink strokes.
// Won: the old castle tips over, the winner's colour spreads from the gate and their piece rises. Held: the pawns
// fall over. Reinforce: the pawns walk into the castle and it bounces. A rival's failed attack is only a clash at
// the land (Keep secret, view.ts). It plays once, about 4 s: one clock on the UI thread drives transforms,
// opacity, circle radius and dash offsets of a few small pieces, with no blur and no loop; Reduce Motion skips it.
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { MAX_FONT_SCALE } from '@/components/AppText';

import { AT, Capital, KINGDOMS, Piece, PAWN, shade } from './atlas';
import { MapChart, type LandView } from './AtlasMap';
import { MAP_H, MAP_W, type AtlasMap } from './map';
import type { MarchView } from './view';

const END = 4.4;
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const INK = AT.ink;
const ADD = '#b0503f';

const prog = (t: number, at: number, len: number) => {
  'worklet';
  return Math.max(0, Math.min(1, (t - at) / len));
};
const ease = (x: number) => {
  'worklet';
  return 1 - (1 - x) * (1 - x) * (1 - x);
};
const back = (x: number) => {
  'worklet';
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

/** The arrow's curve in map units, the same one AtlasMap draws for an order. */
type Curve = { s: [number, number]; c: [number, number]; e: [number, number]; len: number; mid: [number, number] };
function curveOf(map: AtlasMap, from: string | null, to: string): Curve {
  const spot = (id: string) => map.lands.find((l) => l.id === id)!.spot;
  const b = spot(to);
  const a = from ? spot(from) : ([b[0], b[1] - 62] as [number, number]);
  const s: [number, number] = [a[0], a[1] - (from ? 12 : 0)];
  const c: [number, number] = [from ? (a[0] + b[0]) / 2 : b[0] + 26, from ? Math.min(a[1], b[1]) - 30 : b[1] - 40];
  const e: [number, number] = [b[0], b[1] - 18];
  let len = 0;
  let prev = s;
  for (let i = 1; i <= 24; i++) {
    const p = at({ s, c, e, len: 0, mid: s }, i / 24);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return { s, c, e, len, mid: [(s[0] + 2 * c[0] + e[0]) / 4, (s[1] + 2 * c[1] + e[1]) / 4 + 4] };
}
function at(q: Curve, u: number): [number, number] {
  'worklet';
  const v = 1 - u;
  return [v * v * q.s[0] + 2 * v * u * q.c[0] + u * u * q.e[0], v * v * q.s[1] + 2 * v * u * q.c[1] + u * u * q.e[1]];
}

type Props = {
  map: AtlasMap;
  /** The map as it stands after the battle. */
  lands: Record<string, LandView>;
  width: number;
  marches: MarchView[];
  seatOf: (id: string | null) => number | null;
};

function BattleMapView({ map, lands, width, marches, seatOf }: Props) {
  const reduce = useReducedMotion();
  const [done, setDone] = useState(reduce || !marches.length);
  const t = useSharedValue(0);
  useEffect(() => {
    if (done) return;
    t.value = withTiming(END, { duration: END * 1000, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(setDone, true);
    });
  }, [done, t]);

  const k = width / MAP_W;
  const plan = useMemo(() => {
    const targets = [...new Set(marches.map((x) => x.to))];
    return targets.map((to) => {
      const here = marches.filter((x) => x.to === to);
      const won = here.find((x) => x.kind === 'won');
      const kind: 'won' | 'held' | 'add' = won ? 'won' : here.every((x) => x.kind === 'add') ? 'add' : 'held';
      const land = map.lands.find((l) => l.id === to)!;
      return { to, kind, land, was: won ? seatOf(won.was) : lands[to]?.seat ?? null, winner: won ? seatOf(won.by) : null, marches: here };
    });
  }, [marches, map, lands, seatOf]);

  const hide = useMemo(() => (done ? [] : plan.map((p) => p.to)), [done, plan]);

  return (
    <View style={{ width, height: (width * MAP_H) / MAP_W }}>
      <MapChart map={map} lands={lands} width={width} hide={hide} />
      {done ? null : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {plan.filter((p) => p.kind === 'won').map((p) => (
            <Flood key={`f${p.to}`} t={t} d={p.land.d} spot={p.land.spot} was={p.was} winner={p.winner!} />
          ))}
          <Arrows t={t} k={k} map={map} marches={marches} seatOf={seatOf} />
          {plan.map((p) => (
            <Gate key={`g${p.to}`} t={t} k={k} kind={p.kind} spot={p.land.spot} capital={!!lands[p.to]?.capital} was={p.was} winner={p.winner} label={lands[p.to]?.troops ?? undefined} />
          ))}
          {marches.filter((x) => x.by != null).flatMap((x, i) =>
            [0, 1, 2].map((n) => <Pawn key={`p${i}.${n}`} t={t} k={k} n={n} curve={curveOf(map, x.from, x.to)} seat={seatOf(x.by) ?? 0} kind={x.kind} />),
          )}
        </View>
      )}
    </View>
  );
}

export const BattleMap = memo(BattleMapView);

/** The captured land keeps its old colour, then the winner's colour spreads from the gate and the cover lifts. */
function Flood({ t, d, spot, was, winner }: { t: SharedValue<number>; d: string; spot: [number, number]; was: number | null; winner: number }) {
  const id = `fl${spot[0].toFixed(0)}x${spot[1].toFixed(0)}`;
  const r = useAnimatedProps(() => ({ r: 1 + 110 * ease(prog(t.value, 3.05, 0.9)) }));
  const st = useAnimatedStyle(() => ({ opacity: 1 - prog(t.value, 3.95, 0.35) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
        <Defs>
          <ClipPath id={id}>
            <Path d={d} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${id})`}>
          <Rect width={MAP_W} height={MAP_H} fill={AT.land} />
          {was != null ? <Path d={d} fill={KINGDOMS[was % KINGDOMS.length]} fillOpacity={0.42} /> : null}
          <SvgImage href={require('@/assets/conqueror/wash.png')} x={0} y={0} width={MAP_W} height={MAP_H} preserveAspectRatio="none" />
          <ACircle cx={spot[0]} cy={spot[1] - 4} fill={KINGDOMS[winner % KINGDOMS.length]} fillOpacity={0.42} animatedProps={r} />
        </G>
      </Svg>
    </Animated.View>
  );
}

/** Each march's arrow inks itself along the curve, then fades once the pawns have arrived. */
function Arrows({ t, k, map, marches, seatOf }: { t: SharedValue<number>; k: number; map: AtlasMap; marches: MarchView[]; seatOf: (id: string | null) => number | null }) {
  const shown = marches.filter((x) => x.by != null);
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
        {shown.map((x, i) => (
          <Arrow key={i} t={t} curve={curveOf(map, x.from, x.to)} color={x.kind === 'add' ? ADD : KINGDOMS[(seatOf(x.by) ?? 0) % KINGDOMS.length]} />
        ))}
      </Svg>
      {shown.map((x, i) =>
        x.troops != null ? <Bubble key={`b${i}`} t={t} k={k} at={curveOf(map, x.from, x.to).mid} color={x.kind === 'add' ? ADD : KINGDOMS[(seatOf(x.by) ?? 0) % KINGDOMS.length]} label={x.troops >= 1000 ? `${Math.round(x.troops / 1000)}k` : String(x.troops)} /> : null,
      )}
    </>
  );
}

function Arrow({ t, curve, color }: { t: SharedValue<number>; curve: Curve; color: string }) {
  const { s, c, e, len } = curve;
  // Dashes along the whole length, then a gap as long again: sliding the offset reveals the line from its start.
  const dash = useMemo(() => {
    const out: number[] = [];
    for (let x = 0; x < len; x += 8.5) out.push(5, 3.5);
    out.push(len + 20);
    return out;
  }, [len]);
  const total = dash.slice(0, -1).reduce((a, b) => a + b, 0);
  const line = useAnimatedProps(() => ({ strokeDashoffset: total - total * ease(prog(t.value, 0, 0.8)), strokeOpacity: 1 - prog(t.value, 3.6, 0.6) }));
  const ang = Math.atan2(e[1] - c[1], e[0] - c[0]);
  const head = (d: number) => `${e[0] + 6 * Math.cos(ang + d)} ${e[1] + 6 * Math.sin(ang + d)}`;
  const tip = useAnimatedProps(() => ({ fillOpacity: t.value < 0.8 ? 0 : 1 - prog(t.value, 3.6, 0.6) }));
  return (
    <G>
      <APath d={`M${s[0]} ${s[1]} Q${c[0]} ${c[1]} ${e[0]} ${e[1]}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dash} animatedProps={line} />
      <APath d={`M${e[0]} ${e[1]}L${head(Math.PI - 0.45)}L${head(Math.PI + 0.45)}Z`} fill={color} animatedProps={tip} />
    </G>
  );
}

/** My own order's troop count on its arrow (rivals' numbers stay secret). */
function Bubble({ t, k, at: p, color, label }: { t: SharedValue<number>; k: number; at: [number, number]; color: string; label: string }) {
  const st = useAnimatedStyle(() => {
    const a = prog(t.value, 0.6, 0.3) * (1 - prog(t.value, 3.3, 0.4));
    return { opacity: a, transform: [{ scale: 0.6 + 0.4 * ease(prog(t.value, 0.6, 0.3)) }] };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: (p[0] - 11) * k, top: (p[1] - 11) * k, width: 22 * k, height: 22 * k }, st]}>
      <Svg width="100%" height="100%" viewBox="-11 -11 22 22">
        <Circle r={10} fill={color} />
        <Circle r={10} fill="none" stroke={AT.cream} strokeOpacity={0.5} strokeWidth={0.8} strokeDasharray="1.5 1.5" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color: AT.cream, fontFamily: 'Cinzel_700Bold', fontSize: 7.5 * k }}>{label}</Animated.Text>
      </View>
    </Animated.View>
  );
}

/** One of a march's three pawns hopping along the arrow. */
function Pawn({ t, k, n, curve, seat, kind }: { t: SharedValue<number>; k: number; n: number; curve: Curve; seat: number; kind: MarchView['kind'] }) {
  const color = KINGDOMS[seat % KINGDOMS.length];
  const W = 12, H = 16;
  const st = useAnimatedStyle(() => {
    const v = t.value;
    const u = prog(v, 0.7 + n * 0.18, 1.5);
    const p = at(curve, u);
    const hop = Math.abs(Math.sin(u * Math.PI * 5)) * 5;
    const spread = (n - 1) * 7 * prog(u, 0.85, 0.15);
    let op = u > 0 ? 1 : 0;
    let scale = 1;
    let rot = 0;
    if (kind === 'add' && u >= 1) op = 1 - prog(v, 2.4 + n * 0.18, 0.3);
    if (kind === 'won' && v > 2.5) {
      scale = 1 - prog(v, 2.5, 0.4);
      op = scale;
    }
    if ((kind === 'held' || kind === 'duel') && v > 2.7) {
      rot = (n === 1 ? 1 : n - 1) * 80 * ease(prog(v, 2.7, 0.5));
      op = 1 - prog(v, 3.1, 0.6);
    }
    return {
      opacity: op,
      transform: [{ translateX: (p[0] + spread - W / 2) * k }, { translateY: (p[1] + 18 - hop - H) * k }, { rotate: `${rot}deg` }, { scale }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W * k, height: H * k, transformOrigin: '50% 100%' }, st]}>
      <Svg width="100%" height="100%" viewBox="0 0 20 28">
        <Path d={PAWN} fill={color} stroke={shade(color, -0.6)} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M6 4.2a4 4 0 0 1 4-2.2" fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/**
 * What happens at the land itself: the ink burst and the shaking castle, then the old piece tipping over and the
 * winner's rising (won), the castle standing (held), or the castle bouncing as the pawns walk in (reinforce).
 */
function Gate({ t, k, kind, spot, capital, was, winner, label }: { t: SharedValue<number>; k: number; kind: 'won' | 'held' | 'add'; spot: [number, number]; capital: boolean; was: number | null; winner: number | null; label?: string }) {
  const x = spot[0], y = spot[1] + 6;
  const box = { position: 'absolute' as const, left: (x - 24) * k, top: (y - 44) * k, width: 48 * k, height: 60 * k, transformOrigin: '50% 73.3%' };
  const old = useAnimatedStyle(() => {
    const v = t.value;
    const shake = kind !== 'add' && v > 2.4 && v < 2.95 ? Math.sin(v * 70) * 1.6 * k : 0;
    const bounce = kind === 'add' && v > 2.4 && v < 3.0 ? 1 + 0.16 * Math.sin(((v - 2.4) / 0.6) * Math.PI) : 1;
    const fall = kind === 'won' ? prog(v, 2.95, 0.45) : 0;
    return { opacity: 1 - fall, transform: [{ translateX: shake }, { rotate: `${78 * ease(fall)}deg` }, { scale: bounce }] };
  });
  const rise = useAnimatedStyle(() => {
    const q = prog(t.value, 3.5, 0.55);
    return { opacity: q > 0 ? 1 : 0, transform: [{ scale: back(q) }] };
  });
  const burst = useAnimatedStyle(() => {
    const q = prog(t.value, 2.4, 0.5);
    return { opacity: q > 0 && q < 1 ? 1 - q : 0, transform: [{ scale: 0.6 + 1.2 * q }] };
  });
  const rays = useMemo(() => Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2 + 0.3), []);
  return (
    <>
      <Animated.View style={[box, old]}>
        <PieceAt seat={was} capital={capital} label={kind === 'won' ? undefined : label} />
      </Animated.View>
      {kind === 'won' && winner != null ? (
        <Animated.View style={[box, rise]}>
          <PieceAt seat={winner} capital={capital} label={label} />
        </Animated.View>
      ) : null}
      {kind !== 'add' ? (
        <Animated.View style={[{ position: 'absolute', left: (x - 16) * k, top: (y - 26) * k, width: 32 * k, height: 32 * k }, burst]}>
          <Svg width="100%" height="100%" viewBox="-16 -16 32 32">
            <Path d={rays.map((a) => `M${Math.cos(a) * 7} ${Math.sin(a) * 7}L${Math.cos(a) * 13} ${Math.sin(a) * 13}`).join('')} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ) : null}
    </>
  );
}

/** A land's piece drawn on its own, base at (0, 0) of a 48 x 60 map-unit box. */
function PieceAt({ seat, capital, label }: { seat: number | null; capital: boolean; label?: string }) {
  const color = seat == null ? '#8a8172' : KINGDOMS[seat % KINGDOMS.length];
  return (
    <Svg width="100%" height="100%" viewBox="-24 -44 48 60">
      {capital && seat != null ? <Capital seat={seat} x={0} y={0} label={label} /> : <Piece kind="rook" color={color} x={0} y={0} label={label} id={`bm${color.slice(1)}${label ?? ''}`} />}
    </Svg>
  );
}
