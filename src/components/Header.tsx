import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { BrandName } from '@/components/BrandName';
import { MenuIcon } from '@/components/Icons';
import { useBalance } from '@/components/LevelBadge';
import { PulseStar, TokenCoin } from '@/components/PulseStar';
import { useSession } from '@/games/shell/session';
import { useApp, useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';

/**
 * Header (decisions 59-60; redesign 2026-10-17): no bar of its own, it shows the page's navy backdrop (drawn by
 * Screen) and runs up to the top edge, with a hairline bottom edge.
 * `game` is the game-page version (GH1-GH3): the same parts made smaller, plus the token coin at the far right.
 */
export function Header({ variant = 'app' }: { variant?: 'app' | 'game' }) {
  const t = useTheme();
  const g = variant === 'game';
  const z = g ? gs : s;
  const setMenu = useApp((s) => s.setMenu);
  const setReport = useApp((s) => s.setReport);
  const signedIn = !!useSession((st) => st.userId);
  return (
    <View style={z.bar}>
      <View style={[z.edge, { backgroundColor: t.headerEdge }]} />
      <View style={z.row}>
        <Pressable onPress={tapped(() => setMenu(true))} style={[z.mb, { backgroundColor: t.chip, borderColor: t.chipLine }]} accessibilityLabel="Open menu">
          <MenuIcon size={u(g ? 12 : 14)} color={t.menuBtn} />
        </Pressable>
        <View style={z.lk}>
          <PulseStar width={u(g ? 16 : 20)} height={u(g ? 17 : 21)} />
          <BrandName height={u(g ? 10.5 : 13)} color={t.white} accent={t.accent} />
        </View>
      </View>
      <View style={z.row}>
        <Pressable onPress={tapped(() => setReport(true))} style={[z.rp, { backgroundColor: t.red }]} accessibilityLabel="Report a problem">
          <Text style={z.rpT}>!</Text>
        </Pressable>
        {signedIn ? null : (
          <Pressable onPress={tapped(() => router.push('/auth'))} accessibilityLabel="Sign in">
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={z.si}>
              <Text style={[z.siT, { color: t.onGrad }]}>Sign in</Text>
            </LinearGradient>
          </Pressable>
        )}
        {g ? <Coin /> : null}
      </View>
    </View>
  );
}

/** Token count + coin; tapping it opens the Store (MN7). */
function Coin() {
  const t = useTheme();
  const { tokens, level, into, need } = useBalance();
  return (
    <Pressable onPress={tapped(() => router.navigate('/store'))} style={gs.coin} accessibilityRole="button" accessibilityLabel={`${tokens} tokens. Level ${level}, ${into} of ${need} EXP to level ${level + 1}. Open the Store`}>
      <Text style={[gs.coinT, { color: t.fg }]}>{tokens}</Text>
      <TokenCoin size={u(17)} progress={into / need} track="rgba(255,255,255,0.12)" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    height: u(42),
    paddingHorizontal: u(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  mb: { width: u(26), height: u(26), borderRadius: u(9), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  lk: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  rp: { width: u(20), height: u(20), borderRadius: u(10), alignItems: 'center', justifyContent: 'center' },
  rpT: { color: '#fff', fontFamily: F.bodyBold, fontSize: u(11), lineHeight: u(13) },
  si: { paddingVertical: u(5), paddingHorizontal: u(10), borderRadius: 999 },
  siT: { fontFamily: F.bodySemi, fontSize: u(10) },
});

/** Game header: everything about a fifth smaller; the coin with its ring is no wider than the report button. */
const gs = StyleSheet.create({
  ...s,
  bar: { ...s.bar, height: u(36), paddingHorizontal: u(12) },
  row: { ...s.row, gap: u(7) },
  mb: { ...s.mb, width: u(22), height: u(22), borderRadius: u(8) },
  rp: { ...s.rp, width: u(17), height: u(17), borderRadius: u(8.5) },
  rpT: { ...s.rpT, fontSize: u(9.5), lineHeight: u(11) },
  si: { ...s.si, paddingVertical: u(4), paddingHorizontal: u(9) },
  siT: { ...s.siT, fontSize: u(9) },
  coin: { flexDirection: 'row', alignItems: 'center', gap: u(3) },
  coinT: { fontFamily: F.bodyBold, fontSize: u(11), lineHeight: u(13), fontVariant: ['tabular-nums'] },
});
