import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/AppText';

import { BrandName } from '@/components/BrandName';
import { MenuIcon } from '@/components/Icons';
import { useBalance } from '@/components/LevelBadge';
import { PulseStar, TokenCoin } from '@/components/PulseStar';
import { Bolt, SPARK } from '@/features/sparks/Bolt';
import { openSparks, useSparks } from '@/features/sparks/sparks';
import { Face } from '@/games/shell/Face';
import { useSession } from '@/games/shell/session';
import { useAccount } from '@/state/account';
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
        {/* Signed in, the logo makes way for you: photo, level and Sparks (look A, Yazan 2026-10-25). */}
        {signedIn ? (
          <Me g={g} />
        ) : (
          <View style={z.lk}>
            <PulseStar width={h(g ? 16 : 20)} height={h(g ? 17 : 21)} />
            <BrandName height={h(g ? 10.5 : 13)} color={t.white} accent={t.accent} />
          </View>
        )}
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

/** Token count + coin; tapping it opens the Store (MN7). The level ring moved to the photo (look A). */
function Coin({ g }: { g: boolean }) {
  const t = useTheme();
  const { tokens } = useBalance();
  return (
    <Pressable onPress={tapped(() => router.navigate('/store'))} style={(g ? gs : s).coin} accessibilityRole="button" accessibilityLabel={`${tokens} tokens. Open the Nova Shop`}>
      <Text style={[(g ? gs : s).coinT, { color: t.fg }]}>{tokens}</Text>
      <TokenCoin size={h(g ? 17 : 20)} progress={0} track="transparent" />
    </Pressable>
  );
}

/** m:ss until the next Spark, ticking each second ('' when full). */
function useNextIn(nextAt: number | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (nextAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [nextAt]);
  if (nextAt == null) return '';
  const left = Math.max(0, Math.ceil((nextAt - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/**
 * Look A "Ring and bar": your character in a ring that fills toward the next level, the level in a chip, then the
 * Sparks count, the next refill and a slim gold bar. The photo opens your Profile; the Sparks open Recharge.
 */
function Me({ g }: { g: boolean }) {
  const t = useTheme();
  const z = g ? gs : s;
  const avatar = useAccount((a) => a.profile?.avatar) ?? 'yara';
  const { level, into, need } = useBalance();
  const { value, max, nextAt, unlimited } = useSparks();
  const next = useNextIn(unlimited ? null : nextAt);
  const size = h(g ? 24 : 30);
  const sw = Math.max(2, size * 0.1);
  const r = (size - sw) / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, into / need));
  const w = h(g ? 70 : 84);
  return (
    <View style={z.me}>
      <Pressable onPress={tapped(() => router.navigate('/profile'))} hitSlop={h(6)} accessibilityRole="button" accessibilityLabel={`Level ${level}, ${into} of ${need} EXP to level ${level + 1}. Open your profile`}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle cx={size / 2} cy={size / 2} r={r} fill="#141a3f" stroke="rgba(255,255,255,0.16)" strokeWidth={sw} />
            {p > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.accent} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /> : null}
          </Svg>
          <View style={[StyleSheet.absoluteFill, s.center]}>
            <Face slug={avatar} size={size - sw * 2 - 2} />
          </View>
          <View style={[s.chip, { backgroundColor: t.accent, right: -size * 0.12, bottom: -size * 0.1, minWidth: size * 0.5, height: size * 0.42 }]}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: size * 0.27, lineHeight: size * 0.34, color: t.onGrad }}>{level}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable onPress={tapped(openSparks)} hitSlop={h(6)} style={{ gap: h(3) }} accessibilityRole="button" accessibilityLabel={unlimited ? 'Unlimited Sparks' : `${value} of ${max} Sparks${next ? `, one more in ${next}` : ''}. Recharge`}>
        <View style={s.line}>
          <Bolt size={h(g ? 10 : 12)} />
          <Text style={[z.spT, { color: t.fg }]}>
            {unlimited ? '∞' : value}
            {unlimited ? null : <Text style={{ color: t.mute, fontFamily: F.bodySemi }}>{`/${max}`}</Text>}
          </Text>
          {next ? <Text style={[z.spN, { color: t.mute }]}>{`+1 in ${next}`}</Text> : null}
        </View>
        <View style={{ width: w, height: h(g ? 4.5 : 5.5), borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <LinearGradient colors={[...SPARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: unlimited ? w : (w * Math.min(value, max)) / max, height: '100%', borderRadius: 99 }} />
        </View>
      </Pressable>
    </View>
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
  me: { flexDirection: 'row', alignItems: 'center', gap: h(11) },
  center: { alignItems: 'center', justifyContent: 'center' },
  chip: { position: 'absolute', borderRadius: 99, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#0d1738' },
  line: { flexDirection: 'row', alignItems: 'center', gap: h(2) },
  spT: { fontFamily: F.bodyBold, fontSize: h(11), fontVariant: ['tabular-nums'] },
  spN: { fontFamily: F.bodySemi, fontSize: h(8.5), marginLeft: h(4), fontVariant: ['tabular-nums'] },
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
  me: { ...s.me, gap: h(9) },
  spT: { ...s.spT, fontSize: h(9.5) },
  spN: { ...s.spN, fontSize: h(7.5) },
});
