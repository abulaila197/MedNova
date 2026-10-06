// The Wheels of Chaos' own design language: look B "Velvet stage" (Yazan, 2026-10-05). Crimson velvet from the
// loading photo, brass frames, cream playbill paper, with look A's type: Cinzel Decorative for titles and Cinzel
// for labels. Nothing here comes from the app's look or another game's; only the game header is shared.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadFonts } from '@/features/loading/fonts';
import { u } from '@/theme/scale';

import { GameScreen } from '../shell/ui';
import type { Card } from './cards';

export const VV = {
  brass: '#d8b26a',
  cream: '#f4e6c6',
  paper: '#f1e2bf',
  ink: '#f6ead0',
  soft: '#d2bf98',
  dim: '#9a8766',
  red: '#7a1424',
  redInk: '#8e1a2c',
  paperInk: '#2a1a12',
  paperSoft: '#6b5640',
  panel: 'rgba(28,6,10,0.78)',
  gold: '#ffe3a3',
  right: '#79c9b6',
  wrong: '#e0828f',
  line: 'rgba(216,178,106,0.25)',
};
/** Player gems: picked to sit on crimson and cream (the app's cyan/violet would clash). */
export const GEMS = ['#79c9b6', '#b98ad8', '#e8c46a', '#e0828f'];
export const CD = 'CinzelDecorative_700Bold';
export const CM = 'Cinzel_500Medium';
export const CB = 'Cinzel_700Bold';
export const BODY = 'InterTight_500Medium';
export const BODY_B = 'InterTight_600SemiBold';
const FONTS = [CD, CM, CB, 'InterTight_500Medium', 'InterTight_600SemiBold'];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export const CARD_ART: Record<Card, number> = {
  star: require('@/assets/wheels/star.jpg'),
  sun: require('@/assets/wheels/sun.jpg'),
  tower: require('@/assets/wheels/tower.jpg'),
  magician: require('@/assets/wheels/magician.jpg'),
  moon: require('@/assets/wheels/moon.jpg'),
  hermit: require('@/assets/wheels/hermit.jpg'),
  mirror: require('@/assets/wheels/mirror.jpg'),
  world: require('@/assets/wheels/world.jpg'),
};

let fontsReady = false;
export function useVelvetFonts() {
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

/** The stage: the loading page's velvet photo under a dark veil. `dark` adds to the veil (pause, curtains). */
export function Velvet({ dark = 0 }: { dark?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={require('@/assets/loading/the-wheels-of-chaos.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: '0%', left: '50%' }} />
      <LinearGradient colors={[`rgba(10,0,3,${0.55 + dark})`, `rgba(10,0,3,${0.72 + dark})`, 'rgba(8,0,2,0.92)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** A Wheels page: the game header over the velvet stage. */
export function VelvetScreen({ children, scroll = false, dark = 0 }: { children: ReactNode; scroll?: boolean; dark?: number }) {
  const ins = useSafeAreaInsets();
  const ok = useVelvetFonts();
  return (
    <GameScreen scroll={scroll} under={<Velvet dark={dark} />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(16) + ins.bottom, gap: u(12) }}>
      {ok ? children : null}
    </GameScreen>
  );
}

/** A brass-rimmed piece: a light rim over a darker one. */
export const Brass = ({ children, r = 12, style, inner }: { children: ReactNode; r?: number; style?: StyleProp<ViewStyle>; inner?: StyleProp<ViewStyle> }) => (
  <LinearGradient colors={['#f1d79a', '#b8893f', '#7d5a26']} style={[{ borderRadius: u(r), padding: u(2.5) }, style]}>
    <View style={[{ borderRadius: u(r - 2), overflow: 'hidden' }, inner]}>{children}</View>
  </LinearGradient>
);

/** A dark brass panel. */
export const Panel = ({ children, style, inner }: { children: ReactNode; style?: StyleProp<ViewStyle>; inner?: StyleProp<ViewStyle> }) => (
  <Brass r={14} style={style} inner={[{ backgroundColor: VV.panel, padding: u(14), gap: u(9) }, inner]}>{children}</Brass>
);

/** Cream playbill paper in a brass frame. */
export const Bill = ({ children, style, tight }: { children: ReactNode; style?: StyleProp<ViewStyle>; tight?: boolean }) => (
  <Brass r={8} style={style} inner={{ backgroundColor: VV.paper }}>
    <View style={tight ? { paddingHorizontal: u(15), paddingVertical: u(11), gap: u(6) } : { paddingHorizontal: u(16), paddingVertical: u(14), gap: u(10) }}>{children}</View>
  </Brass>
);

export const T = ({ children, f = BODY, size = 13, color = VV.ink, style, lines }: { children: ReactNode; f?: string; size?: number; color?: string; style?: StyleProp<TextStyle>; lines?: number }) => (
  <Text numberOfLines={lines} style={[{ fontFamily: f, fontSize: u(size), lineHeight: u(size * 1.32), color }, style]}>{children}</Text>
);

export const Kicker = ({ children, color = VV.brass }: { children: string; color?: string }) => (
  <T f={CM} size={11.5} color={color} style={{ letterSpacing: u(1.8) }}>{children.toUpperCase()}</T>
);

/** "Tonight's Bill": the last word in brass. */
export function Title({ text, size = 26 }: { text: string; size?: number }) {
  const i = text.lastIndexOf(' ');
  return (
    <T f={CD} size={size} style={{ lineHeight: u(size * 1.2) }}>
      {i > 0 ? text.slice(0, i + 1) : ''}
      <Text style={{ color: VV.brass }}>{i > 0 ? text.slice(i + 1) : text}</Text>
    </T>
  );
}

/** Crimson button in brass, or a brass outline (ghost). `paper` is the ink outline used on the playbill. */
export function Btn({ label, onPress, ghost, paper, disabled, style }: { label: string; onPress?: () => void; ghost?: boolean; paper?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}>
      {ghost || paper ? (
        <View style={{ paddingVertical: u(12), borderRadius: u(30), borderWidth: 1.5, borderColor: paper ? VV.paperInk : VV.brass, alignItems: 'center' }}>
          <T f={CB} size={12} color={paper ? VV.paperInk : VV.brass} style={{ letterSpacing: u(0.6), textAlign: 'center' }}>{label.toUpperCase()}</T>
        </View>
      ) : (
        <Brass r={30}>
          <LinearGradient colors={['#a8203a', '#6a0f1e']} style={{ paddingVertical: u(12), paddingHorizontal: u(10), alignItems: 'center' }}>
            <T f={CB} size={14} color={VV.gold} style={{ letterSpacing: u(1), textAlign: 'center' }}>{label.toUpperCase()}</T>
          </LinearGradient>
        </Brass>
      )}
    </Pressable>
  );
}

/** A player's gem: a small tilted square. */
export const Gem = ({ c, size = 11 }: { c?: string; size?: number }) => (
  <View style={{ width: u(size), height: u(size), transform: [{ rotate: '45deg' }], backgroundColor: c ?? VV.brass, borderWidth: 1, borderColor: 'rgba(255,240,200,0.7)' }} />
);

export const Rule = ({ c = VV.line }: { c?: string }) => <View style={{ height: 1, backgroundColor: c }} />;

/** A round token (target, question type): crimson when picked. On paper by default. */
export function Token({ label, sub, on, onPress, dark, small }: { label: string; sub?: string; on?: boolean; onPress: () => void; dark?: boolean; small?: boolean }) {
  const base = dark ? VV.ink : VV.paperInk;
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} style={[s.token, small ? { minWidth: u(52), paddingVertical: u(3), paddingHorizontal: u(9) } : null, { borderColor: on ? VV.redInk : dark ? VV.line : 'rgba(42,26,18,0.4)' }, on ? { backgroundColor: VV.redInk } : null]}>
      <T f={CB} size={sub ? (small ? 13.5 : 15) : small ? 12 : 12.5} color={on ? VV.gold : base} style={{ textAlign: 'center' }}>{label}</T>
      {sub ? <T f={CM} size={8} color={on ? VV.gold : dark ? VV.dim : VV.paperSoft} style={{ letterSpacing: u(1) }}>{sub}</T> : null}
    </Pressable>
  );
}

/** The bulb timer: 20 lights that go out as time runs down. */
export function Bulbs({ frac }: { frac: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: u(3) }}>
      {Array.from({ length: 20 }, (_, i) => {
        const lit = i / 20 < frac;
        return <View key={i} style={{ flex: 1, height: u(7), borderRadius: u(4), backgroundColor: lit ? '#ffd27a' : 'rgba(216,178,106,0.2)', shadowColor: '#ffbf4a', shadowOpacity: lit ? 0.8 : 0, shadowRadius: u(4) }} />;
      })}
    </View>
  );
}

/** A tarot card in a brass frame; lifted and lit when picked. */
export function CardArt({ card, w, on, onPress, dim }: { card: Card; w: number; on?: boolean; onPress?: () => void; dim?: boolean }) {
  const body = (
    <Brass r={10} style={{ width: w, opacity: dim ? 0.45 : 1, transform: [{ translateY: on ? -u(10) : 0 }], shadowColor: '#ffcf70', shadowOpacity: on ? 0.6 : 0, shadowRadius: u(12) }}>
      <Image source={CARD_ART[card]} style={{ width: '100%', aspectRatio: 0.667 }} contentFit="cover" />
    </Brass>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** A player chip for picking a target. */
export function Chip({ label, color, on, onPress }: { label: string; color?: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} style={[s.chip, on ? { backgroundColor: VV.cream, borderColor: VV.cream } : null]}>
      {color ? <Gem c={color} size={8} /> : null}
      <T f={CB} size={13} color={on ? VV.redInk : VV.ink}>{label}</T>
    </Pressable>
  );
}

/** The square pause button (rule 4), in brass. */
export function PauseBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel="Pause" style={s.pause}>
      <View style={s.bar} />
      <View style={s.bar} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  token: { minWidth: u(58), paddingHorizontal: u(10), paddingVertical: u(5), borderRadius: u(29), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(8), paddingVertical: u(8), paddingHorizontal: u(14), borderRadius: u(20), borderWidth: 1, borderColor: 'rgba(216,178,106,0.55)', backgroundColor: 'rgba(28,6,10,0.7)' },
  pause: { width: u(30), height: u(30), borderRadius: u(8), borderWidth: 1.5, borderColor: VV.brass, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(4), backgroundColor: 'rgba(28,6,10,0.6)' },
  bar: { width: u(3), height: u(11), borderRadius: u(1), backgroundColor: VV.brass },
});
