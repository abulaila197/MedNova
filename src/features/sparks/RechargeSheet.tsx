import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { engine } from '@/games/engine';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { useBack } from '@/lib/useBack';
import { SUBSCRIPTION } from '@/features/store/catalog';
import { Bolt, SPARK } from './Bolt';
import { AD_CAP, ADS_LIVE, cancelRecharge, rechargeWithAd, rechargeWithTokens, subscribeFromRecharge, useRecharge, useSparks } from './sparks';

type Choice = { key: string; label: string; sub: string; on?: () => void; off?: boolean };

const WHY: Record<string, string> = {
  offline: 'No connection. Refills need the internet.',
  cap: `No ads left today (${AD_CAP} a day)`,
  full: 'Your bar is already full',
};

/**
 * Shown over any page when a play costs more Sparks than the bar holds (replaces the free-plays sheet, #70), and from
 * the header's Sparks with no play waiting.
 */
export function RechargeSheet() {
  const t = useTheme();
  const ask = useRecharge((s) => s.ask);
  const busy = useRecharge((s) => s.busy);
  const why = useRecharge((s) => s.why);
  const bar = useSparks();
  const [tokens, setTokens] = useState<number | null>(null);
  useEffect(() => {
    if (ask) engine.wallet.balance().then((b) => setTokens(b.tokens));
  }, [ask, busy]);
  // Android back = Not now (PB3).
  useBack(!!ask, cancelRecharge);
  if (!ask) return null;
  // From the header (cost 0) the tokens fill the bar; before a play they buy just what it needs.
  const need = Math.max(1, (ask.cost || bar.max) - bar.value);
  const full = ask.cost === 0 && bar.value >= bar.max;
  const short = why === 'tokens';
  const choices: Choice[] = [
    {
      key: 'ad',
      label: 'Watch an ad · +5 Sparks',
      sub: why === 'cap' || bar.adsLeft === 0 ? WHY.cap : `${ADS_LIVE ? 'One short ad' : 'Free for now, while ads are off'}${bar.adsLeft == null ? '' : ` · ${bar.adsLeft} of ${AD_CAP} left today`}`,
      off: bar.adsLeft === 0 || busy,
      on: rechargeWithAd,
    },
    {
      key: 'tokens',
      label: full ? 'Your bar is full' : `${ask.cost ? 'Get' : 'Fill up:'} ${need} Sparks for ${need} token${need === 1 ? '' : 's'}`,
      sub: tokens == null ? '' : short ? `Not enough: you have ${tokens}` : `You have ${tokens}`,
      off: busy || full,
      on: rechargeWithTokens,
    },
    { key: 'sub', label: `Subscribe for ${SUBSCRIPTION.price} a month`, sub: 'Unlimited Sparks, no ads', on: subscribeFromRecharge },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,16,0.6)' }]} onPress={cancelRecharge} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(360)} style={s.dock}>
        <Panel t={t} cost={ask.cost} value={bar.value} max={bar.max} refill={bar.refillMin} note={why && why !== 'tokens' ? (WHY[why] ?? 'Something went wrong. Try again.') : null} choices={choices} />
      </Animated.View>
    </View>
  );
}

/** The bar with the play's cost marked on it, then the ways to refill. */
function Panel({ t, cost, value, max, refill, note, choices }: { t: Theme; cost: number; value: number; max: number; refill: number; note: string | null; choices: Choice[] }) {
  return (
    <View style={[s.panel, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={[s.grab, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
      <Text style={[s.mono, { color: t.kick, alignSelf: 'center' }]}>RECHARGE</Text>
      <Text style={[s.vT, { color: t.fg }]}>
        {cost ? 'Not enough ' : 'Your '}
        <Text style={[s.vT, { color: t.accent, fontFamily: F.displayItalic }]}>Sparks</Text>
      </Text>
      <Text style={[s.refill, { color: t.soft, marginTop: u(8) }]}>{cost ? `This play costs ${cost}. You have ${value}.` : `You have ${value} of ${max}.`}</Text>
      <View style={[s.track, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
        <LinearGradient colors={[...SPARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', borderRadius: 99 }} />
        {cost ? <View style={[s.mark, { left: `${Math.min(100, (cost / max) * 100)}%`, backgroundColor: t.fg }]} /> : null}
      </View>
      <View style={s.row}>
        <Bolt size={u(11)} />
        <Text style={[s.refillS, { color: t.mute }]}>{`+1 Spark every ${refill} min`}</Text>
      </View>
      {note ? <Text style={[s.refillS, { color: t.error, textAlign: 'center', marginTop: u(6) }]}>{note}</Text> : null}
      <View style={{ gap: u(8), marginTop: u(12) }}>
        {choices.map((c, i) =>
          i === 0 ? (
            <Pressable key={c.key} onPress={c.off ? undefined : c.on} accessibilityRole="button" accessibilityState={{ disabled: !!c.off }} style={c.off && { opacity: 0.5 }}>
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
      <Pressable onPress={cancelRecharge} style={s.notNow} accessibilityRole="button">
        <Text style={[s.notNowT, { color: t.mute }]}>{cost ? 'Not now' : 'Close'}</Text>
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
  track: { height: u(10), borderRadius: 99, marginTop: u(12), overflow: 'visible' },
  mark: { position: 'absolute', top: -u(3), width: 2, height: u(16), borderRadius: 1, marginLeft: -1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(4), marginTop: u(8) },
  refillS: { fontFamily: F.body, fontSize: u(10) },
  refill: { fontFamily: F.body, fontSize: u(10), textAlign: 'center', marginTop: u(12) },
  btn: { minHeight: u(46), borderRadius: u(16), alignItems: 'center', justifyContent: 'center', paddingVertical: u(6) },
  btnLine: { borderWidth: 1 },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  btnS: { fontFamily: F.body, fontSize: u(9), marginTop: u(1), opacity: 0.85 },
});
