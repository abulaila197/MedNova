import { LinearGradient } from 'expo-linear-gradient';
import { safeEnter } from '@/lib/enter';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/**
 * Congratulations pop-up after a redeem (hunt prize, invite code): the coin, the tokens and one line. The shop also uses it
 * for a finished payment or restore (Yazan 2026-11-08): `big` replaces the "+N tokens" line (empty hides it), `kick` the
 * kicker, `coin={false}` hides the coin and `button` names the button.
 */
export function Congrats({
  open,
  tokens = 0,
  title,
  line,
  onClose,
  big,
  kick = 'CONGRATULATIONS',
  coin = true,
  button = 'Collect',
  onButton,
  alt,
}: {
  open: boolean;
  tokens?: number;
  title: string;
  line: string;
  onClose: () => void;
  big?: string;
  kick?: string;
  coin?: boolean;
  button?: string;
  /** What the main button does, when it isn't just closing (a confirm). */
  onButton?: () => void;
  /** A quieter second button under the main one, such as Cancel. */
  alt?: string;
}) {
  const t = useTheme();
  if (!open) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,4,12,0.78)' }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.mid} pointerEvents="box-none">
        <Animated.View entering={safeEnter(ZoomIn.springify().damping(14))} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
          {coin ? (
            <View style={[s.halo, { backgroundColor: 'rgba(111,214,255,0.16)' }]}>
              <TokenCoin size={u(58)} progress={0} track="transparent" />
            </View>
          ) : null}
          <Text style={[s.kick, { color: t.kick }]}>{kick}</Text>
          <Text style={[s.h, { color: t.fg }]}>{title}</Text>
          {big === '' ? null : <Text style={[s.big, { color: t.accent }]}>{big ?? `+${tokens} tokens`}</Text>}
          <Text style={[s.p, { color: t.mute }]}>{line}</Text>
          <Pressable onPress={onButton ?? onClose} accessibilityRole="button" style={{ alignSelf: 'stretch' }}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
              <Text style={[s.btnT, { color: t.onGrad }]}>{button}</Text>
            </LinearGradient>
          </Pressable>
          {alt ? (
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={u(6)} style={s.alt}>
              <Text style={[s.altT, { color: t.mute }]}>{alt}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: u(24) },
  card: { width: u(236), borderWidth: 1, borderRadius: u(24), padding: u(20), alignItems: 'center' },
  halo: { width: u(92), height: u(92), borderRadius: u(46), alignItems: 'center', justifyContent: 'center', marginBottom: u(12) },
  kick: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(2) },
  h: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24), textAlign: 'center', marginTop: u(4) },
  big: { fontFamily: F.display, fontSize: u(28), lineHeight: u(34), marginTop: u(6), textAlign: 'center' },
  p: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(15), textAlign: 'center', marginTop: u(4), marginBottom: u(14) },
  btn: { height: u(36), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  alt: { marginTop: u(10), paddingVertical: u(4), paddingHorizontal: u(12) },
  altT: { fontFamily: F.bodySemi, fontSize: u(11.5) },
});
