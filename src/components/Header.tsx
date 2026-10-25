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

/** The header and everything in it at 80% of the approved size (Yazan, 2026-10-19). */
const h = (n: number) => u(n * 0.8);
/** Header bar height (app version), for pages that place things under it. */
export const HEADER_H = h(42);

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
        <Pressable onPress={tapped(() => setMenu(true))} hitSlop={h(10)} style={[z.mb, { backgroundColor: t.chip, borderColor: t.chipLine }]} accessibilityLabel="Open menu">
          <MenuIcon size={h(g ? 12 : 14)} color={t.menuBtn} />
        </Pressable>
        <View style={z.lk}>
          <PulseStar width={h(g ? 16 : 20)} height={h(g ? 17 : 21)} />
          <BrandName height={h(g ? 10.5 : 13)} color={t.white} accent={t.accent} />
        </View>
      </View>
      <View style={z.row}>
        <Pressable onPress={tapped(() => setReport(true))} hitSlop={h(10)} style={[z.rp, { backgroundColor: t.red }]} accessibilityLabel="Report a problem">
          <Text style={z.rpT}>!</Text>
        </Pressable>
        {signedIn ? null : (
          <Pressable onPress={tapped(() => router.push('/auth'))} hitSlop={h(8)} accessibilityLabel="Sign in">
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={z.si}>
              <Text style={[z.siT, { color: t.onGrad }]}>Sign in</Text>
            </LinearGradient>
          </Pressable>
        )}
        {/* every header shows the tokens next to the report button (Yazan 2026-10-21); guests keep Sign in there */}
        {g || signedIn ? <Coin g={g} /> : null}
      </View>
    </View>
  );
}

/** Token count + coin; tapping it opens the Store (MN7). */
function Coin({ g }: { g: boolean }) {
  const t = useTheme();
  const { tokens, level, into, need } = useBalance();
  return (
    <Pressable onPress={tapped(() => router.navigate('/store'))} style={(g ? gs : s).coin} accessibilityRole="button" accessibilityLabel={`${tokens} tokens. Level ${level}, ${into} of ${need} EXP to level ${level + 1}. Open the Nova Shop`}>
      <Text style={[(g ? gs : s).coinT, { color: t.fg }]}>{tokens}</Text>
      <TokenCoin size={h(g ? 17 : 20)} progress={into / need} track="rgba(255,255,255,0.12)" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    height: h(42),
    paddingHorizontal: h(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: h(8) },
  mb: { width: h(26), height: h(26), borderRadius: h(9), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  lk: { flexDirection: 'row', alignItems: 'center', gap: h(6) },
  rp: { width: h(20), height: h(20), borderRadius: h(10), alignItems: 'center', justifyContent: 'center' },
  rpT: { color: '#fff', fontFamily: F.bodyBold, fontSize: h(11), lineHeight: h(13) },
  si: { paddingVertical: h(5), paddingHorizontal: h(10), borderRadius: 999 },
  siT: { fontFamily: F.bodySemi, fontSize: h(10) },
  coin: { flexDirection: 'row', alignItems: 'center', gap: h(4) },
  coinT: { fontFamily: F.bodyBold, fontSize: h(12.5), lineHeight: h(15), fontVariant: ['tabular-nums'] },
});

/** Game header: everything about a fifth smaller; the coin with its ring is no wider than the report button. */
const gs = StyleSheet.create({
  ...s,
  bar: { ...s.bar, height: h(36), paddingHorizontal: h(12) },
  row: { ...s.row, gap: h(7) },
  mb: { ...s.mb, width: h(22), height: h(22), borderRadius: h(8) },
  rp: { ...s.rp, width: h(17), height: h(17), borderRadius: h(8.5) },
  rpT: { ...s.rpT, fontSize: h(9.5), lineHeight: h(11) },
  si: { ...s.si, paddingVertical: h(4), paddingHorizontal: h(9) },
  siT: { ...s.siT, fontSize: h(9) },
  coin: { flexDirection: 'row', alignItems: 'center', gap: h(3) },
  coinT: { fontFamily: F.bodyBold, fontSize: h(11), lineHeight: h(13), fontVariant: ['tabular-nums'] },
});
