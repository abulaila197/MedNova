import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { Fade } from '@/components/Fade';
import { KeyboardLift } from '@/games/shell/KeyboardLift';

/** Colours of the info pages (info.css). */
export function useInfo() {
  const t = useTheme();
  return {
    t,
    fg: t.fg,
    kick: t.kick,
    mute: t.mute,
    surf: t.panel,
    surf2: t.panel2,
    line: t.panelLine,
    // selected chip (contact) and FAQ area/card borders: lilac
    chipOnLine: 'rgba(164,139,255,0.7)',
    chipOnFill: 'rgba(143,117,255,0.12)',
    areaOnLine: 'rgba(164,139,255,0.6)',
    openLine: 'rgba(164,139,255,0.45)',
    // open "−" sign: reference is lilac #c9b8ff on dark, so the accent is used there (standing rule)
    openSign: t.accent,
    pillOnText: '#070a1c',
  };
}

/** Mono kicker (.k). In a section (.xsec) it sits on a 20px line, 7px down. */
export function Kicker({ children, inSec = false, style }: { children: ReactNode; inSec?: boolean; style?: StyleProp<TextStyle> }) {
  const c = useInfo();
  const k = <Text style={[s.k, { color: c.kick }, style]}>{children}</Text>;
  return inSec ? <View style={s.kLine}>{k}</View> : k;
}

/** Text with one accent part: "lead *accent* tail" (accent is italic, cyan). */
export function Rich({ text, style, italic = true }: { text: string; style?: StyleProp<TextStyle>; italic?: boolean }) {
  const t = useTheme();
  const parts = text.split('*');
  return (
    <Text style={[{ fontFamily: F.display, color: t.fg }, style]}>
      {parts.map((p, i) =>
        i % 2 ? (
          <Text key={i} style={{ color: t.accent, fontFamily: italic ? F.displayItalic : F.display }}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

// The page (.pg) starts 16 design px under the header (y=88..545, 457 tall) and fades
// from 78% of its height (y=444.5) to the dock, exactly like `.fade`.
export const FADE_FROM = 0.78;

const Lift = ({ children }: { children: ReactNode }) => (Platform.OS === 'android' ? <KeyboardLift>{children}</KeyboardLift> : <>{children}</>);

/** Scrolling page body that dissolves before the dock. `over` is drawn inside the fade but does not scroll. */
export function InfoScroll({ children, scrollY, over, scrollRef, contentStyle }: { children: ReactNode; scrollY?: SharedValue<number>; over?: ReactNode; scrollRef?: React.RefObject<Animated.ScrollView | null>; contentStyle?: StyleProp<ViewStyle> }) {
  const onScroll = useAnimatedScrollHandler((e) => {
    if (scrollY) scrollY.set(e.contentOffset.y / Math.max(1, e.contentSize.height - e.layoutMeasurement.height));
  });
  return (
    <Fade from={FADE_FROM} style={s.pg}>
      {/* Keyboard (PB10): iOS insets the scroll view; Android (edge-to-edge, no window resize) shrinks it with
          KeyboardLift, and Android's ScrollView then keeps the focused text box in view. */}
      <Lift>
      <Animated.ScrollView
        ref={scrollRef}
        style={s.fill}
        contentContainerStyle={[s.content, contentStyle]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </Animated.ScrollView>
      </Lift>
      {over}
    </Fade>
  );
}

/** Gradient pill button (.btn). */
export function GradBtn({ label, onPress, style }: { label: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[{ alignSelf: 'flex-start' }, style]} accessibilityRole="button">
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
        <Text style={[s.btnT, { color: t.onGrad }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  fill: { flex: 1 },
  pg: { flex: 1, marginTop: u(16) },
  content: { paddingTop: u(2), paddingHorizontal: u(18), paddingBottom: u(120) },
  k: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.7), textTransform: 'uppercase' },
  kLine: { height: u(20), paddingTop: u(7) },
  btn: { height: u(32), paddingHorizontal: u(18), borderRadius: 999, justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(11) },
  // .H display heading
  H: { marginTop: u(4), fontSize: u(32), lineHeight: u(30.4), letterSpacing: u(-0.32) },
  // .p lead paragraph
  p: { fontFamily: F.body, fontSize: u(11), lineHeight: u(17.05), marginTop: u(8) },
  xsec: { marginTop: u(16) },
  h4: { marginTop: u(3), fontSize: u(19), lineHeight: u(21) },
});
