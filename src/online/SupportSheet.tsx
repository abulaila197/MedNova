import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Text } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { Btn, Ghost } from '@/games/shell/ui';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/**
 * #27 (Yazan 2026-11-02): no separate donations. Where online is locked (the Online card's Locked button, and the
 * resting page) we say plainly that our servers are small and that the Nova shop and MedNova Unlimited pay for bigger
 * ones. Still art only (one gradient, one drawn icon): nothing animates, so it costs the phone nothing extra.
 */
export function SupportBlock({ why, onShop }: { why?: string; onShop?: () => void }) {
  const t = useTheme();
  return (
    <View style={s.wrap}>
      <LinearGradient colors={['#a48bff', '#6fd6ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ring}>
        <View style={[s.inner, { backgroundColor: t.panel }]}>
          <View style={s.top}>
            <LinearGradient colors={['#a48bff', '#6fd6ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.badge}>
              <ServerHeart />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.k, { color: t.accent }]}>HELP US POWER UP</Text>
              <Text style={[s.h, { color: t.white }]}>Our servers are still small</Text>
            </View>
          </View>
          {why ? (
            <View style={[s.why, { borderColor: 'rgba(255,122,136,0.45)', backgroundColor: 'rgba(255,122,136,0.08)' }]}>
              <Text style={[s.whyK, { color: '#ff7a88' }]}>WHY IT'S LOCKED</Text>
              <Text style={[s.p, { color: t.fg }]}>{why}</Text>
            </View>
          ) : null}
          <Text style={[s.p, { color: t.fg }]}>
            MedNova is built by a tiny team, and online play runs on a free starter server that can only carry a few
            players at a time.
          </Text>
          <Text style={s.help}>You can help</Text>
          <Text style={[s.p, s.strong, { color: t.white, marginTop: u(-6) }]}>
            Every token pack and every MedNova Unlimited subscription from the Nova shop goes into bigger,
            stronger servers, so online stays open longer, for more players.
          </Text>
          <Btn
            label="Support us in the Nova shop"
            onPress={() => {
              onShop?.();
              router.navigate('/store' as never);
            }}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

/** The pop-up from a locked Online card. */
export function SupportSheet({ open, onClose, why }: { open: boolean; onClose: () => void; why: string }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <SupportBlock why={why} onShop={onClose} />
      <Ghost label="Not now" onPress={onClose} />
    </Sheet>
  );
}

/** A server rack with a heart: "help our servers". */
function ServerHeart() {
  return (
    <Svg width={u(26)} height={u(26)} viewBox="0 0 26 26">
      <Rect x={3} y={3} width={16} height={6} rx={1.6} fill="#0b0b26" />
      <Rect x={3} y={11} width={16} height={6} rx={1.6} fill="#0b0b26" />
      <Circle cx={6.5} cy={6} r={1.1} fill="#6fd6ff" />
      <Circle cx={6.5} cy={14} r={1.1} fill="#6fd6ff" />
      <Path d="M18.5 15.2c1.3-1.5 3.9-.9 3.9 1.2 0 2-2.4 3.5-3.9 4.9-1.5-1.4-3.9-2.9-3.9-4.9 0-2.1 2.6-2.7 3.9-1.2z" fill="#ff5c7a" stroke="#0b0b26" strokeWidth={1.2} />
    </Svg>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: u(4) },
  ring: { borderRadius: u(20), padding: 1.5 },
  inner: { borderRadius: u(19), padding: u(14), gap: u(10) },
  top: { flexDirection: 'row', alignItems: 'center', gap: u(11) },
  badge: { width: u(44), height: u(44), borderRadius: u(14), alignItems: 'center', justifyContent: 'center' },
  k: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.6) },
  h: { fontFamily: F.display, fontSize: u(19), lineHeight: u(22), marginTop: u(2) },
  why: { borderWidth: 1, borderRadius: u(12), padding: u(10), gap: u(3) },
  whyK: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.4) },
  p: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17.5) },
  strong: { fontFamily: F.bodySemi },
  // Yazan 2026-11-02: "You can help" in its own colour and font (warm gold, display italic) so it stands out.
  help: { fontFamily: F.displayItalic, fontSize: u(20), lineHeight: u(24), color: '#ffc85c' },
});
