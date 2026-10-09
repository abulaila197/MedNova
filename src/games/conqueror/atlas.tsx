// The Conqueror's own design language: look A "Ink Atlas" on a mid-dark warm sepia screen (CQ20, Yazan
// 2026-10-08). A parchment chart with watercolour kingdoms and chess pieces, red wax seals, Cinzel for titles and
// labels, Cormorant Garamond for running text. Nothing here comes from the app's look or another game's; only the
// game header is shared.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, G, LinearGradient as SvgGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { loadFonts } from '@/features/loading/fonts';
import { ModePin } from '@/state/app';
import { u } from '@/theme/scale';

/** Sizes here are in the approved preview's pixels (a 360px phone); the app's design width is 282px. */
export const v = (n: number) => u((n * 282) / 360);

import { GameScreen } from '../shell/ui';
import { CARDS, type CardType } from './core';

export const AT = {
  bg: '#3a2b1e',
  cream: '#f3e6c6',
  soft: '#c2ab84',
  dim: '#8f7a5a',
  gold: '#f0c27a',
  ink: '#3b2412',
  inkSoft: '#6b4a2a',
  paper: '#f1e3c2',
  paperDeep: '#e6d1a0',
  red: '#8e1c1c',
  redHi: '#b23a30',
  redLo: '#7a1414',
  line: 'rgba(243,230,198,0.18)',
  chip: 'rgba(243,230,198,0.07)',
  sea: '#aa9e80',
  seaLine: '#7d7258',
  land: '#ecdcb4',
  right: '#9fd39a',
  wrong: '#e58b7f',
};
/** Kingdom colours (watercolour inks), one per seat. */
export const KINGDOMS = ['#9b2420', '#2b56a0', '#3f7a3a', '#c58a1f', '#6a3d8c', '#2a8484'];

export const CZ = 'Cinzel_700Bold';
export const CZM = 'Cinzel_500Medium';
export const CG = 'CormorantGaramond_600SemiBold';
export const CGI = 'CormorantGaramond_600SemiBold_Italic';
export const CGB = 'CormorantGaramond_700Bold';
const FONTS = [CZ, CZM, CG, CGI, CGB];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

let fontsReady = false;
export function useAtlasFonts() {
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

/** The mid-dark sepia room: warm light from the top, darker corners, a fine paper grain. */
export function Room() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#4a3524', '#3a2b1e', '#2e2218']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,220,160,0.10)', 'rgba(255,220,160,0)']} style={[StyleSheet.absoluteFill, { bottom: '55%' }]} />
      <Image source={require('@/assets/textures/grain.png')} style={[StyleSheet.absoluteFill, { opacity: 0.08 }]} contentFit="cover" />
    </View>
  );
}

/** A Conqueror page: the game header over the sepia room, always in the dark header. */
export function AtlasScreen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const ins = useSafeAreaInsets();
  const ok = useAtlasFonts();
  return (
    <ModePin.Provider value="dark">
      <GameScreen scroll={scroll} under={<Room />} bodyStyle={{ paddingTop: v(12), paddingHorizontal: v(14), paddingBottom: v(14) + ins.bottom, gap: v(11) }}>
        {ok ? children : null}
      </GameScreen>
    </ModePin.Provider>
  );
}

export const T = ({ children, f = CG, size = 15, color = AT.cream, style, lines }: { children: ReactNode; f?: string; size?: number; color?: string; style?: StyleProp<TextStyle>; lines?: number }) => (
  <Text numberOfLines={lines} style={[{ fontFamily: f, fontSize: v(size), lineHeight: v(size * 1.25), color }, style]}>{children}</Text>
);

export const Kicker = ({ children, color = AT.soft }: { children: string; color?: string }) => (
  <T f={CZM} size={10} color={color} style={{ letterSpacing: v(1.6), opacity: 0.85 }}>{children.toUpperCase()}</T>
);

/** The page top: stage kicker, a gold Cinzel title, an italic line, and the wax clock on the right. */
export function Top({ kicker, title, line, seconds, right }: { kicker: string; title: string; line?: string; seconds?: number | null; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: v(10), paddingHorizontal: v(4) }}>
      <View style={{ flex: 1, gap: v(2) }}>
        <Kicker>{kicker}</Kicker>
        <T f={CZ} size={23} color={AT.gold} style={{ lineHeight: v(27) }}>{title}</T>
        {line ? <T f={CGI} size={15} style={{ lineHeight: v(18) }}>{line}</T> : null}
      </View>
      {right}
      {seconds != null ? <Seal text={clock(seconds)} hot={seconds <= 5} /> : null}
    </View>
  );
}

export const clock = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, '0')}`;

/** A red wax seal (the clock, or a badge). */
export function Seal({ text, hot, size = 54 }: { text: string; hot?: boolean; size?: number }) {
  return (
    <View style={{ width: v(size), height: v(size), borderRadius: v(size / 2), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: v(4), shadowOffset: { width: 0, height: v(2) }, elevation: 3 }}>
      <LinearGradient colors={hot ? ['#d0453a', '#8a1616'] : [AT.redHi, AT.redLo]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: v(size / 2), borderWidth: v(3), borderColor: 'rgba(243,230,198,0.25)' }}>
        <T f={CZ} size={size * 0.28} color={AT.cream}>{text}</T>
      </LinearGradient>
    </View>
  );
}

/** A player chip: kingdom dot, name, and a small count (lands). */
export function Chip({ color, name, count, dim, mark }: { color: string; name: string; count?: number | string; dim?: boolean; mark?: string }) {
  return (
    <View style={[s.chip, dim ? { opacity: 0.45 } : null]}>
      <View style={{ width: v(11), height: v(11), borderRadius: v(6), backgroundColor: color }} />
      <T f={CGB} size={13} style={{ lineHeight: v(16) }}>{name}</T>
      {count != null ? <T f={CZ} size={9.5} color={AT.soft}>{String(count)}</T> : null}
      {mark ? <T f={CZ} size={10} color={AT.gold}>{mark}</T> : null}
    </View>
  );
}

/** Red ink button, or an outlined one. */
export function Btn({ label, onPress, ghost, disabled, style }: { label: string; onPress?: () => void; ghost?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [{ flex: 1, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}>
      <View style={ghost ? s.ghost : s.go}>
        <T f={CZ} size={13.5} color={AT.cream} style={{ letterSpacing: v(1), textAlign: 'center' }}>{label}</T>
      </View>
    </Pressable>
  );
}

export const Rule = () => <View style={{ height: 1, backgroundColor: AT.line }} />;

/** An action card on cream paper with a red inner rule. */
export function CardTile({ card, w = 62, on, onPress, dim }: { card: CardType; w?: number; on?: boolean; onPress?: () => void; dim?: boolean }) {
  const info = CARDS[card];
  // Text grows with the tile (the big card on a card tile's reveal).
  const k = w / 62;
  // Long single-word names (Reinforcements, Earthquake) shrink to fit on one line.
  const longest = Math.max(...info.name.split(' ').map((x) => x.length));
  const nameSize = Math.min(10.5 * k, (w - 16) / (longest * 0.74));
  const body = (
    <View style={[s.card, { width: v(w), height: v(w * 1.04), opacity: dim ? 0.45 : 1 }, on ? { transform: [{ translateY: -v(6) }], borderColor: AT.red, borderWidth: 1.5 } : null]}>
      <View style={s.cardRule} pointerEvents="none" />
      <T f={CZ} size={nameSize} color={AT.red} style={{ lineHeight: v(nameSize * 1.15), textAlign: 'center' }} lines={info.name.includes(' ') ? 2 : 1}>{info.name}</T>
      <T f={CGI} size={k * 10.5} color={AT.ink} style={{ lineHeight: v(k * 11.5), textAlign: 'center' }} lines={3}>{SHORT[card]}</T>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={info.name} accessibilityState={{ selected: on }}>{body}</Pressable> : body;
}

/** Card lines short enough for the small paper tile; the full text shows when a card is picked. */
export const SHORT: Record<CardType, string> = {
  double_attack: 'One extra move',
  shield: 'Bounce attacks',
  spy: 'See reserves',
  trap: 'Hurt attackers',
  reinforcements: '+50% on a move',
  ambush: 'A rival loses a move',
  earthquake: 'Rivals’ outposts -20%',
  revolution: '+5,000 if behind',
  betrayal: 'Take an ally’s land',
  joker: 'Switch a tile’s style',
  hide_troops: 'Hide your numbers',
};

// ---------------------------------------------------------------- chess pieces

export const PAWN =
  'M10 1.6a4.6 4.6 0 0 1 3.1 8a1.3 1.3 0 0 1 1.5 1.6c0 .9-.6 1.4-1.4 1.6C13.6 17 15 20.4 16.6 22.6H17.8a1.6 1.6 0 0 1 1.6 1.6v1.4a1.6 1.6 0 0 1-1.6 1.6H2.2A1.6 1.6 0 0 1 .6 25.6v-1.4a1.6 1.6 0 0 1 1.6-1.6H3.4C5 20.4 6.4 17 6.8 12.8c-.8-.2-1.4-.7-1.4-1.6a1.3 1.3 0 0 1 1.5-1.6a4.6 4.6 0 0 1 3.1-8Z';
export const ROOK =
  'M3.2 1.2h2.6v2.6h2.4V1.2h3.6v2.6h2.4V1.2h2.6v6.4l-1.8 1.6c.2 4.6.8 9.4 2.2 13.4H17.8a1.6 1.6 0 0 1 1.6 1.6v1.4a1.6 1.6 0 0 1-1.6 1.6H2.2A1.6 1.6 0 0 1 .6 25.6v-1.4a1.6 1.6 0 0 1 1.6-1.6H2.6C4 18.6 4.6 13.8 4.8 9.2L3.2 7.6Z';

export function shade(hex: string, f: number) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const o = c.map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return `#${o.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A chess piece standing with its base centre at (x, y), inside an SVG in map units. */
export function Piece({ kind, color, x, y, s: sc = 0.84, label, id }: { kind: 'rook' | 'pawn'; color: string; x: number; y: number; s?: number; label?: string; id: string }) {
  const w = 20 * sc, h = 28 * sc;
  const lw = label ? 6 + 5.2 * label.length : 0;
  return (
    <G>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={shade(color, 0.45)} />
          <Stop offset="0.45" stopColor={color} />
          <Stop offset="1" stopColor={shade(color, -0.45)} />
        </SvgGradient>
      </Defs>
      <Ellipse cx={x} cy={y + 1} rx={10.5 * sc} ry={3 * sc} fill="#1a0e05" opacity={0.35} />
      <G transform={`translate(${x - w / 2} ${y - h + 1.5 * sc}) scale(${sc})`}>
        <Path d={kind === 'rook' ? ROOK : PAWN} fill={`url(#${id})`} stroke={shade(color, -0.6)} strokeWidth={0.7} strokeLinejoin="round" />
        {kind === 'rook' ? (
          <Path d="M5.6 10c-.2 4.4-.8 8.6-2 12.4" fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={0.9} strokeLinecap="round" />
        ) : (
          <>
            <Path d="M6 4.2a4 4 0 0 1 4-2.2" fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={1.1} strokeLinecap="round" />
            <Path d="M7.4 14c-.3 3.4-1.4 6.2-2.6 8.4" fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={0.9} strokeLinecap="round" />
          </>
        )}
        <Path d="M12.6 14.5c.4 3 1.4 5.6 2.6 7.6M9.6 15v7" fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={0.6} />
      </G>
      {label ? (
        <G transform={`translate(${x} ${y + 5})`}>
          <Path d={`M${-lw / 2} 0h${lw}l-2 4.5 2 4.5h${-lw}l2-4.5Z`} fill={AT.paper} stroke="#5a3a1e" strokeWidth={0.7} />
          <SvgText y={7} textAnchor="middle" fontFamily={CZ} fontSize={7.2} fill={AT.ink}>{label}</SvgText>
        </G>
      ) : null}
    </G>
  );
}

/** A lone piece as a small icon (board tiles, chips). */
export function PieceIcon({ kind = 'pawn', color, size = 18 }: { kind?: 'rook' | 'pawn'; color: string; size?: number }) {
  return (
    <Svg width={v(size * 0.72)} height={v(size)} viewBox="-1 -1 22 30">
      <Piece kind={kind} color={color} x={10} y={27} s={0.95} id={`pi${kind}${color.slice(1)}`} />
    </Svg>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: v(5), paddingLeft: v(5), paddingRight: v(9), paddingVertical: v(2), borderRadius: v(20), backgroundColor: AT.chip, borderWidth: 1, borderColor: 'rgba(243,230,198,0.16)' },
  go: { paddingVertical: v(13), borderRadius: v(6), backgroundColor: AT.red, alignItems: 'center', shadowColor: '#4a0a0a', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: v(3) }, elevation: 2 },
  ghost: { paddingVertical: v(12), borderRadius: v(6), borderWidth: 1.5, borderColor: 'rgba(243,230,198,0.5)', alignItems: 'center' },
  card: { borderRadius: v(5), backgroundColor: AT.paper, borderWidth: 1, borderColor: '#5a3a1e', paddingHorizontal: v(5), paddingVertical: v(6), justifyContent: 'center', alignItems: 'center', gap: v(2) },
  cardRule: { position: 'absolute', left: v(3), right: v(3), top: v(3), bottom: v(3), borderWidth: 1, borderColor: 'rgba(142,28,28,0.45)', borderRadius: v(3) },
});
