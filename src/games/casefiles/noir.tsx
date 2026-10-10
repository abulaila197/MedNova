import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { loadFonts } from '@/features/loading/fonts';
import { u } from '@/theme/scale';

import { GameScreen } from '../shell/ui';

// Case Files' own design language: "Evidence board". Creamy police folders pinned to a felt board, joined by
// red strings, in a grey room lit from the top-left, typewriter type throughout. It carries on from the game's loading page (rain,
// dark room, red thread). Nothing here comes from the app's look or another game's; only the game header is
// shared. One look in both app themes, like the loading page.

export const NR = {
  page: ['#3a3a39', '#232322'] as [string, string],
  card: '#ececea',
  cardInk: '#161616',
  cardSoft: '#5f5f5c',
  white: '#f2f2f2',
  soft: '#a3a3a0',
  dim: '#6f6f6c',
  line: '#2f2f2f',
  red: '#c8232f',
  redSoft: 'rgba(200,35,47,0.18)',
  green: '#7fb48a',
  panel: 'rgba(255,255,255,0.04)',
  type: 'SpecialElite_400Regular',
};
export const NOIR_FONTS = ['SpecialElite_400Regular'];

let fontsReady = false;
/** Loads the typewriter face once; pages render after it. */
export function useNoirFonts() {
  const [ok, setOk] = useState(fontsReady);
  useEffect(() => {
    if (!fontsReady)
      loadFonts(NOIR_FONTS).finally(() => {
        fontsReady = true;
        setOk(true);
      });
  }, []);
  return ok;
}

/** The room: plain grey with a soft light from the top-left corner (Yazan, 2026-10-05). */
function Room() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={NR.page} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="cfLamp" cx="0%" cy="0%" r="75%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.16} />
            <Stop offset="0.5" stopColor="#fff" stopOpacity={0.04} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#cfLamp)" />
      </Svg>
    </View>
  );
}

/** A Case Files page: the game header over the dark office. */
export function NoirScreen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const fonts = useNoirFonts();
  return (
    <GameScreen scroll={scroll} under={<Room />} bodyStyle={[s.body, { paddingBottom: u(14) }]}>
      {fonts ? children : null}
    </GameScreen>
  );
}

export function T({ children, size = 14, color = NR.white, style, lines }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; lines?: number }) {
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: NR.type, fontSize: u(size), lineHeight: u(size * 1.38), color }, style]}>
      {children}
    </Text>
  );
}

export function Kicker({ children, color = NR.dim }: { children: string; color?: string }) {
  return <T size={10.5} color={color} style={{ letterSpacing: 2.4 }}>{children.toUpperCase()}</T>;
}

/** "The Migrating Pain": the last word in red, like the loading page title. */
export function CaseTitle({ title, size = 23 }: { title: string; size?: number }) {
  const i = title.lastIndexOf(' ');
  return (
    <T size={size} style={{ lineHeight: u(size * 1.2) }}>
      {i > 0 ? title.slice(0, i + 1) : ''}
      <Text style={{ color: NR.red }}>{i > 0 ? title.slice(i + 1) : title}</Text>
    </T>
  );
}

export function Btn({ label, onPress, ghost, disabled, style }: { label: string; onPress?: () => void; ghost?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.btn, ghost ? s.ghost : null, { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style]}>
      <T size={ghost ? 13 : 14.5} color={ghost ? NR.soft : NR.white} style={{ letterSpacing: 1, textAlign: 'center', textTransform: ghost ? 'none' : 'uppercase' }}>{label}</T>
    </Pressable>
  );
}

/** The square pause button in the corner (rule 4). */
export function PauseBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel="Pause" style={s.pause}>
      <View style={s.bar} />
      <View style={s.bar} />
    </Pressable>
  );
}

/** The white index card: files, pages and report sheets. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** The end stamp, slightly tilted, in red for CLOSED and green-grey for SOLVED. */
export function Stamp({ word, size = 30 }: { word: 'SOLVED' | 'CLOSED'; size?: number }) {
  const c = word === 'SOLVED' ? NR.green : NR.red;
  return (
    <View style={[s.stamp, { borderColor: c }]}>
      <T size={size} color={c} style={{ letterSpacing: 4, lineHeight: u(size * 1.1) }}>{word}</T>
    </View>
  );
}

export const clock = (ms: number) => {
  const sec = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

export const s = StyleSheet.create({
  body: { paddingTop: u(14), paddingHorizontal: u(16), gap: u(12) },
  btn: { borderRadius: u(12), borderWidth: 1.5, borderColor: NR.red, backgroundColor: NR.redSoft, alignItems: 'center', justifyContent: 'center', paddingVertical: u(12), paddingHorizontal: u(10) },
  ghost: { borderColor: NR.line, backgroundColor: 'transparent', paddingVertical: u(10) },
  pause: { width: u(32), height: u(32), borderRadius: u(10), borderWidth: 1, borderColor: NR.line, flexDirection: 'row', gap: u(4), alignItems: 'center', justifyContent: 'center' },
  bar: { width: u(3), height: u(12), backgroundColor: NR.soft },
  card: { backgroundColor: NR.card, paddingHorizontal: u(14), paddingVertical: u(12), borderRadius: u(10) },
  stamp: { alignSelf: 'center', borderWidth: 3, paddingHorizontal: u(12), paddingVertical: u(2), transform: [{ rotate: '-8deg' }] },
});
