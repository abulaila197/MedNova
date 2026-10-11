import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { GAMES } from '@/data/games';
import { engine, PLAY_PRICE } from '@/games/engine';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { ADS_LIVE, cancelPaywall, payWithAd, payWithTokens, SUBSCRIPTION_LIVE, usePaywall } from './paywall';

type Choice = { key: string; label: string; sub: string; on?: () => void; off?: boolean };

/** Shown over any page when a signed-in player is out of today's free plays for a game (look B "Empty vials", picked 2026-10-11). */
export function PaywallSheet() {
  const t = useTheme();
  const ask = usePaywall((s) => s.ask);
  const [tokens, setTokens] = useState<number | null>(null);
  const [short, setShort] = useState(false);
  useEffect(() => {
    setShort(false);
    if (ask) engine.wallet.balance().then((b) => setTokens(b.tokens));
  }, [ask]);
  if (!ask) return null;
  const g = GAMES.find((x) => x.key === ask.game);
  const title = g ? `${g.lead} ${g.em}`.trim() : 'this game';
  const choices: Choice[] = [
    { key: 'ad', label: 'Watch an ad', sub: ADS_LIVE ? 'One short ad, one more play' : 'Free for now, while ads are off', on: () => void payWithAd() },
    {
      key: 'tokens',
      label: `Pay ${PLAY_PRICE} tokens`,
      sub: tokens == null ? '' : short ? `Not enough: you have ${tokens}` : `You have ${tokens}`,
      on: async () => setShort(!(await payWithTokens())),
    },
    { key: 'sub', label: 'Subscribe for $0.99', sub: SUBSCRIPTION_LIVE ? 'Unlimited plays, no ads, no tokens' : 'Unlimited, no ads, no tokens · coming soon', off: !SUBSCRIPTION_LIVE },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.mode === 'light' ? 'rgba(40,34,24,0.35)' : 'rgba(5,6,16,0.6)' }]} onPress={cancelPaywall} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(360)} style={s.dock}>
        <Vials t={t} title={title} choices={choices} />
      </Animated.View>
    </View>
  );
}

/** Empty vials: today's three free plays as three empty vials, then the choices as buttons. */
function Vials({ t, title, choices }: { t: Theme; title: string; choices: Choice[] }) {
  const lt = t.mode === 'light';
  return (
    <View style={[s.panel, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={[s.grab, { backgroundColor: lt ? 'rgba(40,36,28,0.15)' : 'rgba(255,255,255,0.2)' }]} />
      <Text style={[s.mono, { color: t.kick, alignSelf: 'center' }]}>{title.toUpperCase()}</Text>
      <Text style={[s.vT, { color: t.fg }]}>
        {"Today's doses are "}
        <Text style={[s.vT, { color: t.accent, fontFamily: F.displayItalic }]}>empty</Text>
      </Text>
      <View style={s.vials}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={s.vial}>
            <View style={[s.cap, { backgroundColor: lt ? '#c9c2b4' : '#3a4170' }]} />
            <View style={[s.tube, { borderColor: lt ? 'rgba(40,36,28,0.3)' : 'rgba(255,255,255,0.25)', backgroundColor: lt ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.03)' }]}>
              <View style={[s.residue, { backgroundColor: t.accent }]} />
              <View style={[s.gloss, { backgroundColor: lt ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.12)' }]} />
            </View>
          </View>
        ))}
      </View>
      <Text style={[s.refill, { color: t.mute }]}>Refills at midnight with 3 free plays</Text>
      <View style={{ gap: u(8), marginTop: u(6) }}>
        {choices.map((c, i) =>
          i === 0 ? (
            <Pressable key={c.key} onPress={c.on} accessibilityRole="button">
              <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
                <Text style={[s.btnT, { color: t.onGrad }]}>{c.label}</Text>
                <Text style={[s.btnS, { color: t.onGrad }]}>{c.sub}</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable key={c.key} onPress={c.off ? undefined : c.on} accessibilityRole="button" accessibilityState={{ disabled: !!c.off }} style={[s.btn, s.btnLine, { borderColor: t.panelLine }, c.off && { opacity: 0.5 }]}>
              <Text style={[s.btnT, { color: t.fg }]}>{c.label}</Text>
              {c.sub ? <Text style={[s.btnS, { color: t.mute }]}>{c.sub}</Text> : null}
            </Pressable>
          ),
        )}
      </View>
      <Pressable onPress={cancelPaywall} style={s.notNow} accessibilityRole="button">
        <Text style={[s.notNowT, { color: t.mute }]}>Not now</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  dock: { position: 'absolute', left: u(12), right: u(12), bottom: u(24) },
  mono: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  notNow: { alignSelf: 'center', marginTop: u(12), padding: u(4) },
  notNowT: { fontFamily: F.bodyMedium, fontSize: u(11) },
  panel: { borderRadius: u(26), borderWidth: 1, padding: u(18), paddingTop: u(10) },
  grab: { alignSelf: 'center', width: u(36), height: u(4), borderRadius: u(4), marginBottom: u(12) },
  vT: { fontFamily: F.display, fontSize: u(24), lineHeight: u(27), textAlign: 'center', marginTop: u(6) },
  vials: { flexDirection: 'row', justifyContent: 'center', gap: u(22), marginTop: u(18) },
  vial: { alignItems: 'center' },
  cap: { width: u(22), height: u(8), borderRadius: u(2) },
  tube: { width: u(30), height: u(62), borderWidth: 1.5, borderTopWidth: 0, borderBottomLeftRadius: u(15), borderBottomRightRadius: u(15), overflow: 'hidden', justifyContent: 'flex-end' },
  residue: { height: u(4), opacity: 0.5 },
  gloss: { position: 'absolute', left: u(5), top: u(6), bottom: u(12), width: u(4), borderRadius: u(2) },
  refill: { fontFamily: F.body, fontSize: u(10), textAlign: 'center', marginTop: u(12) },
  btn: { minHeight: u(46), borderRadius: u(16), alignItems: 'center', justifyContent: 'center', paddingVertical: u(6) },
  btnLine: { borderWidth: 1 },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  btnS: { fontFamily: F.body, fontSize: u(9), marginTop: u(1), opacity: 0.85 },
});
