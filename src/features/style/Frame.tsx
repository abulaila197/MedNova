import { Image, type ImageSource } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { useSvgId } from '@/components/svgId';
import { AuroraBase, AuroraMoving, AuroraSparkles, HelixBase, LaurelGlow, NovaBase, NovaMoving, PulseBase, PulseMoving } from '@/features/style/Ornate';
import { Accents, PAD } from '@/features/style/Accents';
import { useLook, wantLooks } from '@/features/style/useStyle';
import { Face } from '@/games/shell/Face';
import { useTheme } from '@/state/app';

export type FrameKey =
  | 'normal' | 'bronze' | 'silver' | 'gold' | 'platinum'
  | 'pulse' | 'nova' | 'helix' | 'stethoscope' | 'laurel' | 'aurora' | 'neuron' | 'rounds'
  | 'inviter' | 'sovereign' | 'admin';

// Everything is drawn in a 100 x 100 box; the face fills the middle (radius 38), the frame sits around it.
const V = 100;
const C = 50;
const FACE = 0.76;

const METAL: Record<'bronze' | 'silver' | 'gold' | 'platinum', string[]> = {
  bronze: ['#f0b98a', '#a8673a', '#7a4524', '#c98a56', '#6b3a1d'],
  silver: ['#c9ced6', '#9097a3', '#5f6672', '#a9afba', '#555b66'],
  gold: ['#fff2b8', '#e8b64a', '#a8761c', '#f5d376', '#8a5d12'],
  platinum: ['#ffffff', '#dfe8f3', '#a9b7c9', '#f4f8fc', '#8e9db2'],
};

// Yazan's Flow art for the premium frames (2026-10-25). Each image is square with the ring's hole in the centre;
// `ext` is the image side over the hole's diameter, `w` the share of the image's width the art covers. Every frame is
// drawn as wide as the metal rings (Yazan: same side-to-side size), so the face shrinks to fit a thicker frame.
const ART: Partial<Record<FrameKey, { src: ImageSource; ext: number; w: number }>> = {
  helix: { src: require('../../../assets/frames/helix.webp'), ext: 1.658, w: 0.828 },
  neuron: { src: require('../../../assets/frames/neuron.webp'), ext: 1.854, w: 0.855 },
  pulse: { src: require('../../../assets/frames/pulse.webp'), ext: 1.535, w: 0.918 },
  laurel: { src: require('../../../assets/frames/laurel.webp'), ext: 1.913, w: 0.816 },
  aurora: { src: require('../../../assets/frames/aurora.webp'), ext: 1.7, w: 0.957 },
  nova: { src: require('../../../assets/frames/nova.webp'), ext: 1.75, w: 0.84 },
  rounds: { src: require('../../../assets/frames/rounds.webp'), ext: 2.085, w: 0.75 },
  inviter: { src: require('../../../assets/frames/inviter.webp'), ext: 1.32, w: 0.945 },
  sovereign: { src: require('../../../assets/frames/sovereign.webp'), ext: 1.95, w: 0.688 },
  admin: { src: require('../../../assets/frames/admin.webp'), ext: 1.734, w: 0.93 },
};
// The hole sits a touch inside the face's edge so the ring covers it cleanly.
const HOLE = 0.74;
// Outer width of the metal rings, as a share of the box.
const RING_W = 0.965;

const pt = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;

// Each loop runs only for the frame that shows it, and stops when switched off (X7).
function useSpin(ms: number, on = true) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (on) r.value = withRepeat(withTiming(360, { duration: ms, easing: Easing.linear }), -1, false);
    else {
      cancelAnimation(r);
      r.value = 0;
    }
  }, [ms, on, r]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
}

function useBreath(ms: number, on = true) {
  const o = useSharedValue(0.35);
  useEffect(() => {
    if (on) o.value = withRepeat(withSequence(withTiming(1, { duration: ms }), withTiming(0.35, { duration: ms })), -1, false);
    else {
      cancelAnimation(o);
      o.value = 0.35;
    }
  }, [ms, on, o]);
  return useAnimatedStyle(() => ({ opacity: o.value }));
}

function Metal({ kind, id }: { kind: keyof typeof METAL; id: string }) {
  const m = METAL[kind];
  return (
    <>
      <Defs>
        <LinearGradient id={id} x1="12" y1="8" x2="88" y2="92" gradientUnits="userSpaceOnUse">
          {m.map((c, i) => <Stop key={i} offset={i / (m.length - 1)} stopColor={c} />)}
        </LinearGradient>
      </Defs>
      <Circle cx={C} cy={C} r={44.5} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={7.5} />
      <Circle cx={C} cy={C} r={44.5} fill="none" stroke={`url(#${id})`} strokeWidth={6} />
      <Circle cx={C} cy={C} r={41.3} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} />
      <Circle cx={C} cy={C} r={47.6} fill="none" stroke={kind === 'silver' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)'} strokeWidth={0.5} />
      {/* lit top-left edge */}
      <Path d={`M${pt(46.4, Math.PI * 1.08).join(',')} A46.4,46.4 0 0 1 ${pt(46.4, Math.PI * 1.55).join(',')}`} stroke={kind === 'silver' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)'} strokeWidth={1} fill="none" strokeLinecap="round" />
    </>
  );
}

function Shine({ id }: { id: string }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${V} ${V}`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fff" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#fff" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={`M${pt(44.5, -2.1).join(',')} A44.5,44.5 0 0 1 ${pt(44.5, -1.0).join(',')}`} stroke={`url(#${id})`} strokeWidth={5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** The ring drawn under the animated layer (static part of each frame). */
function Base({ k, id, line }: { k: FrameKey; id: string; line: string }) {
  switch (k) {
    case 'normal':
      return <Circle cx={C} cy={C} r={42.5} fill="none" stroke={line} strokeWidth={1.4} />;
    case 'bronze':
    case 'silver':
    case 'gold':
    case 'platinum':
      return <Metal kind={k} id={id} />;
    case 'pulse':
      return <PulseBase id={id} />;
    case 'nova':
      return <NovaBase id={id} />;
    case 'helix':
      return <HelixBase id={id} />;
    case 'stethoscope': {
      // Tube round the face, chest piece bottom right, ear tips at the top.
      const a0 = -Math.PI / 2 + 0.32;
      const a1 = -Math.PI / 2 - 0.32 + Math.PI * 2;
      const [cx, cy] = pt(44, Math.PI * 0.25);
      return (
        <>
          <Path d={`M${pt(44, a0).join(',')} A44,44 0 1 1 ${pt(44, a1).join(',')}`} stroke="#1b1f2a" strokeWidth={5.5} fill="none" strokeLinecap="round" />
          <Path d={`M${pt(44, a0).join(',')} A44,44 0 1 1 ${pt(44, a1).join(',')}`} stroke="#4a5266" strokeWidth={1.2} fill="none" strokeLinecap="round" transform="translate(-0.6,-0.8)" />
          {[a0, a1].map((a, i) => {
            const [x, y] = pt(44, a);
            const dx = i ? -1 : 1;
            return (
              <G key={i}>
                <Path d={`M${x},${y} q${3 * dx},-5 ${7 * dx},-6`} stroke="#c9ced8" strokeWidth={2.2} fill="none" strokeLinecap="round" />
                <Circle cx={x + 7 * dx} cy={y - 6} r={2.4} fill="#2a2f3c" />
              </G>
            );
          })}
          <Circle cx={cx} cy={cy} r={9.5} fill="#cfd5df" stroke="#7d8594" strokeWidth={1.2} />
          <Circle cx={cx} cy={cy} r={6.2} fill="#9aa3b2" />
          <Circle cx={cx - 1.6} cy={cy - 1.8} r={2.2} fill="#fff" fillOpacity={0.8} />
        </>
      );
    }
    case 'laurel': {
      const leaves = [];
      for (let side = -1; side <= 1; side += 2)
        for (let i = 0; i < 9; i++) {
          const a = Math.PI / 2 + side * (0.35 + i * 0.27);
          const [x, y] = pt(45, a);
          const deg = (a * 180) / Math.PI + (side > 0 ? 60 : -60);
          leaves.push(<Ellipse key={`${side}${i}`} cx={x} cy={y} rx={5.4 - i * 0.25} ry={2.2} fill={i % 2 ? '#d7a73a' : '#f2cc68'} stroke="#8a5d12" strokeWidth={0.4} transform={`rotate(${deg} ${x} ${y})`} />);
        }
      return (
        <>
          <Circle cx={C} cy={C} r={42} fill="none" stroke="#c8962e" strokeWidth={1} />
          {leaves}
          <Path d="M43,92 L50,88 L57,92 L54,97 L50,94 L46,97 Z" fill="#c73646" />
        </>
      );
    }
    case 'aurora':
      return <AuroraBase />;
    case 'neuron':
      return (
        <>
          <Circle cx={C} cy={C} r={43} fill="none" stroke="#7fe0ff" strokeOpacity={0.7} strokeWidth={1.4} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + 0.2;
            const [x0, y0] = pt(43, a);
            const [x1, y1] = pt(49, a);
            const [xa, ya] = pt(52, a - 0.12);
            const [xb, yb] = pt(52, a + 0.12);
            return <Path key={i} d={`M${x0},${y0} L${x1},${y1} M${x1},${y1} L${xa},${ya} M${x1},${y1} L${xb},${yb}`} stroke="#7fe0ff" strokeOpacity={0.6} strokeWidth={0.9} strokeLinecap="round" fill="none" />;
          })}
        </>
      );
    case 'rounds':
      return (
        <>
          <Circle cx={C} cy={C} r={44.5} fill="none" stroke="#1d2244" strokeWidth={6} />
          {Array.from({ length: 13 }, (_, i) => {
            const a = -Math.PI / 2 + ((i + 0.5) / 13) * Math.PI * 2;
            const [x, y] = pt(44.5, a);
            return <Circle key={i} cx={x} cy={y} r={1.5} fill="#e8b64a" />;
          })}
          <Circle cx={C} cy={93} r={6.5} fill="#e8b64a" stroke="#8a5d12" strokeWidth={0.8} />
          <Path d="M50,88.6 L51.3,92.4 L55,92.4 L52,94.7 L53.1,98.4 L50,96.1 L46.9,98.4 L48,94.7 L45,92.4 L48.7,92.4 Z" fill="#fff6d6" />
        </>
      );
  }
}

/** The moving layer: spun, breathing or shining (null for still frames). */
function Moving({ k, id }: { k: FrameKey; id: string }) {
  const spinFast = useSpin(3600, k === 'pulse');
  const spinMid = useSpin(9000, k === 'nova' || k === 'platinum');
  const spinSlow = useSpin(24000, k === 'aurora');
  const breath = useBreath(1100, k === 'aurora' || k === 'neuron');
  const spinGlow = useSpin(6000, k === 'laurel' || k === 'helix');
  const layer = (style: object, svg: React.ReactNode) => <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>{svg}</Animated.View>;
  switch (k) {
    case 'platinum':
      return layer(spinMid, <Shine id={id} />);
    case 'pulse':
      return layer(spinFast, <PulseMoving id={id} />);
    case 'nova':
      return layer(spinMid, <NovaMoving id={id} />);
    case 'helix':
      return layer(spinGlow, <LaurelGlow id={id} />);
    case 'aurora':
      return (
        <>
          {layer(spinSlow, <AuroraMoving />)}
          {layer(breath, <AuroraSparkles />)}
        </>
      );
    case 'laurel':
      return layer(spinGlow, <LaurelGlow id={id} />);
    case 'neuron':
      return layer(
        breath,
        <Svg width="100%" height="100%" viewBox={`0 0 ${V} ${V}`}>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + 0.2;
            const [x, y] = pt(49, a);
            return <Circle key={i} cx={x} cy={y} r={1.9} fill="#c9f4ff" />;
          })}
        </Svg>,
      );
    default:
      return null;
  }
}

/**
 * A character face inside a profile frame. `size` is the whole framed box. Frames move only on big faces
 * (Profile, results, lobby seats, player card): `still` keeps them still in lists, and Reduce Motion always does.
 */
export function Framed({ slug, size, frame, still = false, accent }: { slug: string; size: number; frame: FrameKey; still?: boolean; accent?: boolean }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const id = useSvgId('fr');
  const id2 = useSvgId('fm');
  const id3 = useSvgId('fa');
  const f = size * FACE;
  const art = ART[frame];
  if (art) {
    const w = (size * RING_W) / art.w;
    const fq = (w / art.ext / HOLE) * FACE;
    return (
      <View style={{ width: size, height: size }}>
        <View style={[s.face, { top: (size - fq) / 2, left: (size - fq) / 2 }]}>
          <Face slug={slug} size={fq} />
        </View>
        <Image source={art.src} style={{ position: 'absolute', width: w, height: w, left: (size - w) / 2, top: (size - w) / 2 }} transition={0} pointerEvents="none" />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <View style={[s.face, { top: (size - f) / 2, left: (size - f) / 2 }]}>
        <Face slug={slug} size={f} />
      </View>
      <Svg width={size} height={size} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Base k={frame} id={id} line={t.panelLine} />
      </Svg>
      {still || reduce ? null : <Moving k={frame} id={id2} />}
      {accent ? (
        <Svg
          width={size * (1 + (2 * PAD) / V)}
          height={size * (1 + (2 * PAD) / V)}
          viewBox={`${-PAD} ${-PAD} ${V + 2 * PAD} ${V + 2 * PAD}`}
          style={{ position: 'absolute', left: (-size * PAD) / V, top: (-size * PAD) / V }}
          pointerEvents="none">
          <Accents k={frame} id={id3} />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * A player's face with the frame they wear. The Normal frame keeps the plain face at full size (so lists don't
 * change); any other frame draws round it inside the same box. Faces under 18 px stay plain: a frame would be a smudge.
 */
export function PlayerFace({ slug, size, userId, still = false }: { slug: string; size: number; userId?: string | null; still?: boolean }) {
  useEffect(() => {
    if (userId) wantLooks([userId]);
  }, [userId]);
  const look = useLook(userId);
  if (look.frame === 'normal' || size < 18) return <Face slug={slug} size={size} />;
  return <Framed slug={slug} size={size} frame={look.frame} still={still} />;
}

const s = StyleSheet.create({ face: { position: 'absolute' } });
