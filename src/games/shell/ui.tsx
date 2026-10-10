import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';

import { Screen } from '@/components/Screen';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/**
 * A game page: the app sky and the game header (GH1), no dock, content scrolls with a gap under the header.
 * A game with its own design language passes its own (opaque) background as `under` and body spacing; the app's
 * glow and grain are then not drawn at all, rather than drifting unseen underneath.
 */
export function GameScreen({ children, scroll = true, top, under, bodyStyle }: { children: ReactNode; scroll?: boolean; top?: ReactNode; under?: ReactNode; bodyStyle?: StyleProp<ViewStyle> }) {
  return (
    <Screen dock={false} glow={under ? false : 1} game under={under}>
      {top}
      {scroll ? (
        <ScrollView contentContainerStyle={[s.body, bodyStyle]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[s.body, bodyStyle, { flex: 1 }]}>{children}</View>
      )}
    </Screen>
  );
}

export function Kick({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={[s.kick, { color: color ?? t.soft }]}>{children}</Text>;
}

/** Title with the last word in the accent colour (cyan dark, orange light). */
export function Title({ lead, em, size = 30 }: { lead: string; em: string; size?: number }) {
  const t = useTheme();
  return (
    <Text style={[s.ttl, { color: t.white, fontSize: u(size), lineHeight: u(size * 0.95) }]}>
      {lead} <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{em}</Text>
    </Text>
  );
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<any> }) {
  const t = useTheme();
  return <Text style={[s.body2, { color: t.mute }, style]}>{children}</Text>;
}

export function Btn({ label, onPress, disabled, style }: { label: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[{ opacity: disabled ? 0.45 : 1 }, style]} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
        <Text style={[s.btnT, { color: t.onGrad }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function Ghost({ label, onPress, style, danger }: { label: string; onPress?: () => void; style?: StyleProp<ViewStyle>; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[s.ghost, { borderColor: t.chipLine, backgroundColor: t.chip }, style]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[s.ghostT, { color: danger ? t.rose : t.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }, style]}>{children}</View>;
}

/** Tappable choice chips (setup options). */
export function Chips<V extends string | number>({ choices, value, onChange }: { choices: { value: V; label: string; note?: string }[]; value: V; onChange: (v: V) => void }) {
  const t = useTheme();
  return (
    <View style={s.chips}>
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <Pressable
            key={String(c.value)}
            onPress={() => onChange(c.value)}
            style={[s.chip, { borderColor: on ? t.accent : t.chipLine, backgroundColor: on ? t.tabOn : t.chip }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}>
            <Text style={[s.chipT, { color: on ? t.accent : t.fg }]}>{c.label}</Text>
            {c.note ? <Text style={[s.chipN, { color: t.dim }]}>{c.note}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small round icon button (pause, close). */
export function RoundBtn({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={u(8)} style={[s.round, { backgroundColor: t.chip, borderColor: t.chipLine }]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[s.roundT, { color: t.fg }]}>{glyph}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  body: { paddingHorizontal: u(16), paddingTop: u(16), paddingBottom: u(28), gap: u(12) },
  kick: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.7), textTransform: 'uppercase' },
  ttl: { fontFamily: F.display, letterSpacing: u(-0.5) },
  body2: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(17) },
  btn: { borderRadius: u(14), paddingVertical: u(11), paddingHorizontal: u(18), alignItems: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12.5), lineHeight: u(15) },
  ghost: { borderRadius: u(14), borderWidth: 1, paddingVertical: u(10), paddingHorizontal: u(16), alignItems: 'center' },
  ghostT: { fontFamily: F.bodySemi, fontSize: u(12), lineHeight: u(15) },
  card: { borderRadius: u(18), borderWidth: 1, padding: u(14), gap: u(8) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5) },
  chip: { borderRadius: u(10), borderWidth: 1, paddingVertical: u(5), paddingHorizontal: u(10), minWidth: u(44), alignItems: 'center' },
  chipT: { fontFamily: F.bodySemi, fontSize: u(10.5), lineHeight: u(13) },
  chipN: { fontFamily: F.body, fontSize: u(8), lineHeight: u(10) },
  round: { width: u(28), height: u(28), borderRadius: u(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  roundT: { fontFamily: F.bodyBold, fontSize: u(11), lineHeight: u(13) },
});
