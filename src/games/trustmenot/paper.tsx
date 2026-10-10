// Trust Me Not's own design language: the all-paper "Camp Ledger" look (locked 2026-10-07). Torn cream paper over
// each month's photo of the village, IM Fell English for titles and numbers, Crimson Pro for running text, ink
// brown with one dried-blood red. Nothing here comes from the app's look or another game's; only the game header is
// shared.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';
import Svg, { Circle, ClipPath, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { loadFonts } from '@/features/loading/fonts';
import { ModePin } from '@/state/app';
import { DESIGN_W, u } from '@/theme/scale';

import { GameScreen } from '../shell/ui';

/** Sizes here are in the locked preview's pixels (a 300px phone); the app's design width is 282px. */
export const p = (n: number) => u((n * DESIGN_W) / 300);

export const TM = {
  ink: '#2a1f16',
  paper: '#ece0c4',
  red: '#9b2f22',
  redSoft: '#c0614a',
  line: 'rgba(42,31,22,0.28)',
  cream: '#fff4dc',
  amber: '#d9a441',
};

export const FELL = 'IMFellEnglish_400Regular';
export const FELLI = 'IMFellEnglish_400Regular_Italic';
export const CRIM = 'CrimsonPro_400Regular';
export const CRIMI = 'CrimsonPro_400Regular_Italic';
export const CRIMB = 'CrimsonPro_600SemiBold';
const FONTS = [FELL, FELLI, CRIM, CRIMI, CRIMB];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const MONTHS = [
  require('@/assets/trustmenot/months/month-01.jpg'),
  require('@/assets/trustmenot/months/month-02.jpg'),
  require('@/assets/trustmenot/months/month-03.jpg'),
  require('@/assets/trustmenot/months/month-04.jpg'),
  require('@/assets/trustmenot/months/month-05.jpg'),
  require('@/assets/trustmenot/months/month-06.jpg'),
  require('@/assets/trustmenot/months/month-07.jpg'),
  require('@/assets/trustmenot/months/month-08.jpg'),
  require('@/assets/trustmenot/months/month-09.jpg'),
  require('@/assets/trustmenot/months/month-10.jpg'),
  require('@/assets/trustmenot/months/month-11.jpg'),
  require('@/assets/trustmenot/months/month-12.jpg'),
];

let fontsReady = false;
export function usePaperFonts() {
  const [ok, setOk] = useState(fontsReady);
  useEffect(() => {
    if (!fontsReady)
      loadFonts(FONTS).finally(() => {
        fontsReady = true;
        setOk(true);
      });
  }, []);
  return ok;
}

export const T = ({ children, f = CRIM, size = 15, color = TM.ink, style, lines }: { children: ReactNode; f?: string; size?: number; color?: string; style?: StyleProp<TextStyle>; lines?: number }) => (
  <Text numberOfLines={lines} style={[{ fontFamily: f, fontSize: p(size), lineHeight: p(size * 1.3), color }, style]}>{children}</Text>
);

/** The month's photo of the village under a soft brown wash, darker at the top and bottom. */
function Village({ month }: { month: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a120a' }]} />
      <Image source={MONTHS[Math.min(11, Math.max(0, month - 1))]} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      <LinearGradient colors={['rgba(25,16,8,0.25)', 'rgba(25,16,8,0.05)', 'rgba(25,16,8,0.35)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** A Trust Me Not page: the game header over the month's village, always with the dark header. */
export function PaperScreen({ month, children, scroll = false, onPause }: { month: number; children: ReactNode; scroll?: boolean; onPause?: () => void }) {
  const ok = usePaperFonts();
  return (
    <ModePin.Provider value="dark">
      <GameScreen scroll={scroll} under={<Village month={month} />} bodyStyle={{ padding: 0, gap: 0 }}>
        {ok ? children : null}
        {ok && onPause ? (
          <Pressable onPress={onPause} accessibilityRole="button" accessibilityLabel="Pause" hitSlop={10} style={ps.pause}>
            <View style={ps.bar} />
            <View style={ps.bar} />
          </Pressable>
        ) : null}
      </GameScreen>
    </ModePin.Provider>
  );
}

const ps = StyleSheet.create({
  // A small paper tab high on the right edge, above the sheets so it never covers a button.
  pause: {
    position: 'absolute', right: 0, top: p(2), width: p(18), height: p(24), borderTopLeftRadius: p(4), borderBottomLeftRadius: p(4),
    backgroundColor: TM.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: p(3),
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: -1, height: 1 },
  },
  bar: { width: p(2.5), height: p(10), backgroundColor: TM.ink },
});

// ---------------------------------------------------------------- torn paper

/** A small steady random from a text, so a sheet keeps the same torn edge on every render. */
function rngOf(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The outline of a sheet with lightly torn edges (up to about 2px in, 26 nicks a side). */
function tornPath(w: number, h: number, seed: string) {
  const r = rngOf(seed);
  const d = () => r() * p(2.2);
  const n = 26;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(`${(w * i) / n},${d()}`);
  for (let i = 0; i <= n; i++) pts.push(`${w - d()},${(h * i) / n}`);
  for (let i = n; i >= 0; i--) pts.push(`${(w * i) / n},${h - d()}`);
  for (let i = n; i >= 0; i--) pts.push(`${d()},${(h * i) / n}`);
  return `M${pts.join(' L')} Z`;
}

/** Cream paper with a torn edge, two soft age stains and a drop shadow. */
export function Paper({ children, seed = 'paper', style, pad = [12, 13, 11] }: { children: ReactNode; seed?: string; style?: StyleProp<ViewStyle>; pad?: [number, number, number] }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - w) > 0.5 || Math.abs(size.h - h) > 0.5) setSize({ w, h });
  };
  const d = useMemo(() => (size ? tornPath(size.w, size.h, seed) : ''), [size, seed]);
  const id = `pp${seed.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <View onLayout={onLayout} style={[s.sheet, style]}>
      {size ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id={`${id}a`} cx="80%" cy="10%" rx="120%" ry="80%">
              <Stop offset="0" stopColor="#a06e32" stopOpacity={0.18} />
              <Stop offset="0.6" stopColor="#a06e32" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`${id}b`} cx="10%" cy="90%" rx="60%" ry="40%">
              <Stop offset="0" stopColor="#78501e" stopOpacity={0.16} />
              <Stop offset="0.7" stopColor="#78501e" stopOpacity={0} />
            </RadialGradient>
            <ClipPath id={`${id}c`}>
              <Path d={d} />
            </ClipPath>
          </Defs>
          <Path d={d} fill="rgba(0,0,0,0.22)" transform={`translate(0 ${p(4)})`} />
          <Path d={d} fill={TM.paper} />
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${id}a)`} clipPath={`url(#${id}c)`} />
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${id}b)`} clipPath={`url(#${id}c)`} />
        </Svg>
      ) : null}
      <View style={{ paddingTop: p(pad[0]), paddingHorizontal: p(pad[1]), paddingBottom: p(pad[2]) }}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------- portraits and gauges

const HEAD = 'M20 6 a8 9 0 1 1 0 18 a8 9 0 1 1 0-18Z';
const BODY = 'M6 40 C6 30 12 26 20 25 C28 26 34 30 34 40 Z';
/** Cracks drawn as health falls (rule book §12: colour silhouettes that crack with health, no art). */
const CRACKS: { below: number; d: string[] }[] = [
  { below: 70, d: ['M23 9 L21.6 12.4 L22.4 15.2', 'M21.6 12.4 L19.6 13.4'] },
  { below: 45, d: ['M26 27 L24.2 30.6 L25 34.5 L23.8 38.5', 'M24.2 30.6 L27.4 32.2'] },
  { below: 25, d: ['M15 8 L16.4 11.2 L15.2 14', 'M13 30 L15 33 L13.6 37'] },
];

/** A player's colour silhouette in a cream ring; it cracks as health drops, and a ghost is a dashed outline. */
export function Portrait({ color, health, ghost, size = 34 }: { color: string; health: number; ghost?: boolean; size?: number }) {
  return (
    <View style={[s.face, { width: p(size), height: p(size), borderRadius: p(size / 2), padding: p(3) }, ghost ? { opacity: 0.6 } : null]}>
      <Svg viewBox="0 0 40 40" width="100%" height="100%">
        {ghost ? (
          <>
            <Path d={HEAD} fill="none" stroke={TM.redSoft} strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />
            <Path d={BODY} fill="none" stroke={TM.redSoft} strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />
          </>
        ) : (
          <>
            <Path d={HEAD} fill={color} />
            <Path d={BODY} fill={color} />
            {CRACKS.filter((c) => health < c.below).flatMap((c) => c.d).map((d) => (
              <Path key={d} d={d} fill="none" stroke="rgba(255,248,232,0.9)" strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </>
        )}
      </Svg>
    </View>
  );
}

/** The question clock: a thin red ring that empties, with the seconds inside. */
export function RingClock({ seconds, total }: { seconds: number; total: number }) {
  const c = 2 * Math.PI * 17;
  const left = Math.max(0, Math.min(1, seconds / Math.max(1, total)));
  return (
    <View style={{ width: p(40), height: p(40) }}>
      <Svg viewBox="0 0 40 40" width="100%" height="100%" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={20} cy={20} r={17} fill="none" stroke="rgba(42,31,22,0.2)" strokeWidth={2.4} />
        <Circle cx={20} cy={20} r={17} fill="none" stroke={TM.red} strokeWidth={2.4} strokeDasharray={`${c * left} ${c}`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <T f={FELL} size={15}>{String(Math.ceil(seconds))}</T>
      </View>
    </View>
  );
}

/** Health as a drip bag, filled to the level. */
export function IvBag({ health }: { health: number }) {
  const top = 10 + (28 * (100 - Math.max(0, Math.min(100, health)))) / 100;
  return (
    <Svg viewBox="0 0 30 46" width={p(20)} height={p(31)}>
      <Defs>
        <ClipPath id="ivbag">
          <Path d="M6 10h18v24a4 4 0 0 1-4 4h-10a4 4 0 0 1-4-4z" />
        </ClipPath>
      </Defs>
      <Path d="M9 4h12v4h3a2 2 0 0 1 2 2v24a6 6 0 0 1-6 6h-10a6 6 0 0 1-6-6V10a2 2 0 0 1 2-2h3z" fill="none" stroke={TM.ink} strokeWidth={1.4} />
      <Rect x={0} y={top} width={30} height={40} fill={TM.red} opacity={0.75} clipPath="url(#ivbag)" />
    </Svg>
  );
}

/** Private jewels as a small cracked clay jar. */
export function Jar() {
  return (
    <Svg viewBox="0 0 30 40" width={p(22)} height={p(29)}>
      <Path d="M9.6 2.6h10.8v2.4h-1.4v3.2c4.8 1.8 8.2 6.6 8.2 12.8 0 8.6-5.4 16-12.2 16S2.8 29.6 2.8 21c0-6.2 3.4-11 8.2-12.8V5H9.6z" fill="none" stroke={TM.ink} strokeWidth={1.4} />
      <Path d="M11 8.4h8" fill="none" stroke={TM.ink} strokeWidth={1.4} />
      <Path d="M17.6 11.4 L16.6 14.6 L17.4 17.2 M16.6 14.6 L14.8 15.6" fill="none" stroke={TM.ink} strokeWidth={1} />
    </Svg>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'relative' },
  face: { backgroundColor: TM.paper, borderWidth: 1.5, borderColor: TM.ink, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
});
