// The Wheels of Chaos pieces, in the app's look since Yazan 2026-11-02 (#19: "the old design look shouldn't be present
// anywhere"): navy cards, the app's cyan/violet, Gabarito titles and Inter Tight labels. The velvet stage, brass and
// playbill paper are gone; the names stay so the play screens keep working. Questions and answers keep Alegreya Sans (#32).
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';

import { loadFonts } from '@/features/loading/fonts';
import { tapped } from '@/lib/sound';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { SEAT_COLOURS } from '../shell/characters';
import { GameScreen } from '../shell/ui';

/** App colours under the old names: brass = accent, paper = the app's soft beige (Yazan 2026-11-02), redInk = violet. */
export const VV = {
  brass: '#6fd6ff',
  cream: '#eef0ff',
  paper: '#efe4cb',
  ink: '#eef0ff',
  soft: '#c3c7e4',
  dim: '#8a90b8',
  red: '#a48bff',
  redInk: '#5b45c4',
  paperInk: '#3b2f1c',
  paperSoft: '#6b5a3e',
  panel: '#26376f',
  gold: '#ffd166',
  right: '#3fc58a',
  wrong: '#ff7a88',
  line: 'rgba(255,255,255,0.13)',
};
/** The soft beige boxes of Streak Master / Quiz Parade (src/theme/beige.ts): answers, board cards. paper = picked. */
export const BOX = { bg: '#efe4cb', line: '#cdb88c', ink: '#3b2f1c', paper: '#e3d4b2' };
/** Player colours: the app's seat colours. */
export const GEMS = SEAT_COLOURS.map((c) => c.color);
export const CD = F.display;
export const CM = F.bodySemi;
export const CB = F.bodyBold;
export const BODY = F.bodyMedium;
export const BODY_B = F.bodySemi;
/** #32 (Yazan 2026-11-01): questions and answers are set in Alegreya Sans. */
export const QF = 'AlegreyaSans_500Medium';
export const QF_B = 'AlegreyaSans_700Bold';
const FONTS = [QF, QF_B];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

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

/** A Wheels page: the game header over the app sky. */
export function VelvetScreen({ children, scroll = false, top }: { children: ReactNode; scroll?: boolean; dark?: number; top?: ReactNode }) {
  const ok = useVelvetFonts();
  return (
    <GameScreen scroll={scroll} top={ok ? top : null} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(16), gap: u(12) }}>
      {ok ? children : null}
    </GameScreen>
  );
}

/** A card with the app's hairline edge (was the brass rim). */
export const Brass = ({ children, r = 12, style, inner }: { children: ReactNode; r?: number; style?: StyleProp<ViewStyle>; inner?: StyleProp<ViewStyle> }) => (
  <View style={[{ borderRadius: u(r), borderWidth: 1, borderColor: VV.line, overflow: 'hidden' }, style]}>
    <View style={[{ borderRadius: u(r - 1), overflow: 'hidden' }, inner]}>{children}</View>
  </View>
);

/** A navy panel. */
export const Panel = ({ children, style, inner }: { children: ReactNode; style?: StyleProp<ViewStyle>; inner?: StyleProp<ViewStyle> }) => (
  <Brass r={18} style={style} inner={[{ backgroundColor: VV.panel, padding: u(14), gap: u(9) }, inner]}>{children}</Brass>
);

/** A beige card (was the cream playbill). */
export const Bill = ({ children, style, tight }: { children: ReactNode; style?: StyleProp<ViewStyle>; tight?: boolean }) => (
  <Brass r={18} style={[{ borderColor: BOX.line }, style]} inner={{ backgroundColor: VV.paper }}>
    <View style={tight ? { paddingHorizontal: u(15), paddingVertical: u(11), gap: u(6) } : { paddingHorizontal: u(16), paddingVertical: u(14), gap: u(10) }}>{children}</View>
  </Brass>
);

export const T = ({ children, f = BODY, size = 13, color = VV.ink, style, lines }: { children: ReactNode; f?: string; size?: number; color?: string; style?: StyleProp<TextStyle>; lines?: number }) => (
  <Text numberOfLines={lines} style={[{ fontFamily: f, fontSize: u(size), lineHeight: u(size * 1.32), color }, style]}>{children}</Text>
);

export const Kicker = ({ children, color = VV.brass }: { children: string; color?: string }) => (
  <Text style={{ fontFamily: F.mono, fontSize: u(10), lineHeight: u(14), letterSpacing: u(1.6), color }}>{children.toUpperCase()}</Text>
);

/** A title with the last word in the accent colour, like the app's titles. */
export function Title({ text, size = 26 }: { text: string; size?: number }) {
  const i = text.lastIndexOf(' ');
  return (
    <T f={CD} size={size} style={{ lineHeight: u(size * 1.1) }}>
      {i > 0 ? text.slice(0, i + 1) : ''}
      <Text style={{ color: VV.brass }}>{i > 0 ? text.slice(i + 1) : text}</Text>
    </T>
  );
}

/** The app's gradient button, or its outline button (ghost / paper). */
export function Btn({ label, onPress, ghost, paper, disabled, style }: { label: string; onPress?: () => void; ghost?: boolean; paper?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={tapped(onPress)} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}>
      {ghost || paper ? (
        <View style={s.ghost}>
          <T f={F.bodySemi} size={12.5} color={VV.ink} style={{ textAlign: 'center' }}>{label}</T>
        </View>
      ) : (
        <LinearGradient colors={['#a48bff', '#6fd6ff']} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
          <T f={F.bodyBold} size={13} color="#0b0b26" style={{ textAlign: 'center' }}>{label}</T>
        </LinearGradient>
      )}
    </Pressable>
  );
}

/** A player's colour dot. */
export const Gem = ({ c, size = 11 }: { c?: string; size?: number }) => (
  <View style={{ width: u(size), height: u(size), borderRadius: u(size), backgroundColor: c ?? VV.brass }} />
);

export const Rule = ({ c = VV.line }: { c?: string }) => <View style={{ height: 1, backgroundColor: c }} />;

/** A choice chip (target, question type): accent when picked. */
export function Token({ label, sub, on, onPress, small }: { label: string; sub?: string; on?: boolean; onPress: () => void; dark?: boolean; small?: boolean }) {
  return (
    <Pressable onPress={tapped(onPress)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} style={[s.token, small ? { minWidth: u(52), paddingVertical: u(3), paddingHorizontal: u(9) } : null, on ? { borderColor: VV.brass, backgroundColor: 'rgba(111,214,255,0.14)' } : null]}>
      <T f={CB} size={sub ? (small ? 13.5 : 15) : small ? 12 : 12.5} color={on ? VV.brass : VV.ink} style={{ textAlign: 'center' }}>{label}</T>
      {sub ? <T f={F.mono} size={8} color={on ? VV.brass : VV.dim} style={{ letterSpacing: u(1) }}>{sub}</T> : null}
    </Pressable>
  );
}

/** The timer: 20 segments that go out as time runs down. */
const BULBS = 20;

/** How many segments are lit at `frac` of the time left: the only thing the timer shows of the clock. */
export const bulbsLit = (frac: number) => Array.from({ length: BULBS }, (_, i) => i / BULBS < frac).filter(Boolean).length;

export function Bulbs({ frac }: { frac: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: u(3) }}>
      {Array.from({ length: BULBS }, (_, i) => {
        const lit = i / BULBS < frac;
        return <View key={i} style={{ flex: 1, height: u(6), borderRadius: u(3), backgroundColor: lit ? (frac < 0.25 ? '#ff7a88' : VV.brass) : 'rgba(255,255,255,0.1)' }} />;
      })}
    </View>
  );
}

/** A player chip for picking a target. */
export function Chip({ label, color, on, onPress }: { label: string; color?: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={tapped(onPress)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} style={[s.chip, on ? { backgroundColor: 'rgba(111,214,255,0.14)', borderColor: VV.brass } : null]}>
      {color ? <Gem c={color} size={8} /> : null}
      <T f={CB} size={13} color={on ? VV.brass : VV.ink}>{label}</T>
    </Pressable>
  );
}

/** The pause button, as the app's round icon button. */
export function PauseBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={tapped(onPress)} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel="Pause" style={s.pause}>
      <View style={s.bar} />
      <View style={s.bar} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { borderRadius: u(14), paddingVertical: u(12), paddingHorizontal: u(18), alignItems: 'center' },
  ghost: { borderRadius: u(14), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: u(11), paddingHorizontal: u(16), alignItems: 'center' },
  token: { minWidth: u(58), paddingHorizontal: u(10), paddingVertical: u(5), borderRadius: u(10), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(8), paddingVertical: u(8), paddingHorizontal: u(14), borderRadius: u(12), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.05)' },
  pause: { width: u(30), height: u(30), borderRadius: u(10), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(4), backgroundColor: 'rgba(255,255,255,0.05)' },
  bar: { width: u(3), height: u(11), borderRadius: u(1), backgroundColor: '#eef0ff' },
});
