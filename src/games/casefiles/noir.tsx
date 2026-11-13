import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';

import { tapped } from '@/lib/sound';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { GameScreen } from '../shell/ui';
import { clock } from '@/games/engine/clock';
import { tr } from '@/i18n';

// Case Files pieces, in the app's look since Yazan 2026-11-02 (#19: "the old design look shouldn't be present
// anywhere"): app sky, navy panels, cyan accent, Inter Tight; the index cards are the app's soft beige (like Streak
// Master's boxes). The names stay so the play screens keep working.

export const NR = {
  card: '#efe4cb',
  cardInk: '#3b2f1c',
  cardSoft: '#6b5a3e',
  white: '#eef0ff',
  soft: '#c3c7e4',
  dim: '#8a90b8',
  line: 'rgba(255,255,255,0.13)',
  /** The accent (was the red thread): the app's cyan. */
  red: '#6fd6ff',
  redSoft: 'rgba(111,214,255,0.14)',
  green: '#3fc58a',
  wrong: '#ff7a88',
  panel: '#26376f',
  type: F.bodyMedium,
};
export const NOIR_FONTS: string[] = [];

/** App fonts are loaded at start; kept so the pages' gate stays the same. */
export function useNoirFonts() {
  return true;
}

/** A Case Files page: the game header over the app sky. */
export function NoirScreen({ children, scroll = false, top }: { children: ReactNode; scroll?: boolean; top?: ReactNode }) {
  const fonts = useNoirFonts();
  return (
    <GameScreen scroll={scroll} top={fonts ? top : null} bodyStyle={[s.body, { paddingBottom: u(14) }]}>
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
  return <T size={10} color={color} style={{ fontFamily: F.mono, letterSpacing: 1.6 }}>{children.toUpperCase()}</T>;
}

/** "The Migrating Pain": the last word in the accent colour, like the app titles. */
export function CaseTitle({ title, size = 23 }: { title: string; size?: number }) {
  const i = title.lastIndexOf(' ');
  return (
    <T size={size} style={{ fontFamily: F.display, lineHeight: u(size * 1.2) }}>
      {i > 0 ? title.slice(0, i + 1) : ''}
      <Text style={{ color: NR.red }}>{i > 0 ? title.slice(i + 1) : title}</Text>
    </T>
  );
}

export function Btn({ label, onPress, ghost, disabled, style }: { label: string; onPress?: () => void; ghost?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={tapped(onPress)} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}>
      {ghost ? (
        <View style={[s.btn, s.ghost]}>
          <T size={12.5} color={NR.white} style={{ fontFamily: F.bodySemi, textAlign: 'center' }}>{label}</T>
        </View>
      ) : (
        <LinearGradient colors={['#a48bff', '#6fd6ff']} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
          <T size={13} color="#0b0b26" style={{ fontFamily: F.bodyBold, textAlign: 'center' }}>{label}</T>
        </LinearGradient>
      )}
    </Pressable>
  );
}

/** The square pause button in the corner (rule 4). */
export function PauseBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={tapped(onPress)} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel={tr('Pause')} style={s.pause}>
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
  const c = word === 'SOLVED' ? NR.green : NR.wrong;
  return (
    <View style={[s.stamp, { borderColor: c }]}>
      <T size={size} color={c} style={{ fontFamily: F.display, letterSpacing: 4, lineHeight: u(size * 1.1) }}>{word}</T>
    </View>
  );
}

/** The Evidence board's typed clock: 00:42. */
export const caseClock = (ms: number, down = false) => clock(ms, { pad: true, down });

export const s = StyleSheet.create({
  body: { paddingTop: u(14), paddingHorizontal: u(16), gap: u(12) },
  btn: { borderRadius: u(14), alignItems: 'center', justifyContent: 'center', paddingVertical: u(12), paddingHorizontal: u(14) },
  ghost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: u(11) },
  pause: { width: u(30), height: u(30), borderRadius: u(10), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', gap: u(4), alignItems: 'center', justifyContent: 'center' },
  bar: { width: u(3), height: u(11), borderRadius: u(1), backgroundColor: NR.white },
  card: { backgroundColor: NR.card, borderWidth: 1, borderColor: '#cdb88c', paddingHorizontal: u(14), paddingVertical: u(12), borderRadius: u(14) },
  stamp: { alignSelf: 'center', borderWidth: 3, paddingHorizontal: u(12), paddingVertical: u(2), transform: [{ rotate: '-8deg' }] },
});
