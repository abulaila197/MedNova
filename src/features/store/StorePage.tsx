import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Congrats } from '@/components/Congrats';
import { useBalance } from '@/components/LevelBadge';
import { TokenCoin } from '@/components/PulseStar';
import { Screen } from '@/components/Screen';
import { OfflineLine } from '@/components/OfflineLine';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { useSession } from '@/games/shell/session';
import { Framed } from '@/features/style/Frame';
import { loadStyle, useStyle } from '@/features/style/useStyle';
import { SOVEREIGN_PACK } from '@/features/shop/robots';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { StyleBanner } from './StyleBanner';
import { FreeSheets, FreeTokens, useFree } from './FreeTokens';
import { buy, isSubscribed, loadPrices, restore, useIsSubscribed, usePrice, useSubscription, type BuyResult } from './billing';
import { PACKS, SUBSCRIPTION, type Pack } from './catalog';
import { tr } from '@/i18n';

// What a finished payment, restore or failure says, as a pop-up the player can't miss (Yazan 2026-11-08: the old line at
// the top of the shop went unseen, so Restore looked like it did nothing).
type Pop = { kick: string; title: string; big: string; line: string; coin: boolean; button: string; confirm?: boolean };
const FAILED: Pop = { kick: tr('NOT BOUGHT'), title: tr('Something went wrong'), big: '', line: tr('Nothing was charged. Check your connection and try again.'), coin: false, button: 'OK' };
// Restore asks first (Yazan 2026-11-08).
const ASK_RESTORE: Pop = { kick: tr('RESTORE'), title: tr('Restore purchases?'), big: '', line: tr('We\'ll check your {n} account for MedNova Unlimited and the Sovereign package and add them to this MedNova account.', { n: Platform.OS === 'ios' ? 'Apple' : 'Google' }), coin: false, button: tr('Restore'), confirm: true };
// Each phone names only its own store (Apple 2.3.10, Yazan 2026-11-08).
const STORE = Platform.OS === 'ios' ? tr('the App Store') : tr('Google Play');
const SOON: Pop = { kick: tr('IN THE APP'), title: tr('Buy in the app'), big: '', line: tr('Buying works in the MedNova app from {STORE}.', { STORE }), coin: false, button: 'OK' };

function boughtPop(id: string): Pop {
  const pack = PACKS.find((p) => p.id === id);
  const base = { kick: tr('CONGRATULATIONS'), title: tr('Your payment was successful'), coin: true, button: tr('Great') };
  if (pack) return { ...base, big: tr('+{tokens} tokens', { tokens: pack.tokens }), line: tr('Your tokens are in your wallet.') };
  if (id === SUBSCRIPTION.id) return { ...base, big: tr('MedNova Unlimited'), line: tr('{n}. It\'s on for your account now.', { n: SUBSCRIPTION.perks.map((x) => tr(x)).join(' · ') }) };
  return { ...base, big: tr('Sovereign package'), line: tr('Sovereign, its frame and {tokens} tokens are yours.', { tokens: SOVEREIGN_PACK.tokens }) };
}

async function restoredPop(): Promise<Pop> {
  await loadStyle(true).catch(() => {});
  const found = [isSubscribed() && tr('MedNova Unlimited'), useStyle.getState().owned.includes('robot:sovereign') && tr('the Sovereign package')].filter(Boolean);
  return found.length
    ? { kick: tr('RESTORE'), title: tr('Restore checked'), big: '', line: tr('Your account has: {n}.', { n: found.join(tr(' and ')) }), coin: false, button: tr('OK') }
    : { kick: tr('RESTORE'), title: tr('Nothing to restore'), big: '', line: tr('No subscription or package was found for this store account. Token packs are added once, when you buy them.'), coin: false, button: tr('OK') };
}

const dateOf = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The Store (MN3-MN8, look C "Small cards"): the monthly subscription as a banner, the free tokens row, then the token packs. */
export function StorePage() {
  const styleSavedAt = useStyle((x) => x.savedAt);
  const c = useInfo();
  const t = c.t;
  const signedIn = !!useSession((x) => x.userId);
  const { tokens } = useBalance();
  const until = useSubscription((x) => x.until);
  // A writing sheet never stays open over another page (the Store stays mounted under the stack).
  useFocusEffect(useCallback(() => () => useFree.setState({ sheet: null }), []));
  const subscribed = useIsSubscribed();
  const [busy, setBusy] = useState<string | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const subPrice = usePrice(SUBSCRIPTION.id, SUBSCRIPTION.price);
  useEffect(() => loadPrices([...PACKS.map((p) => p.id), SUBSCRIPTION.id, SOVEREIGN_PACK.id]), []);

  const run = async (id: string, act: () => Promise<BuyResult>) => {
    if (!signedIn) return router.navigate('/auth'); // MN8: guests sign in first
    if (busy) return;
    setBusy(id);
    const r = await act();
    setBusy(null);
    // The Sovereign card reads what you own, so a purchase or restore reloads it.
    if (r === 'done' && id !== 'restore') void loadStyle(true).catch(() => {});
    if (r === 'done') setPop(id === 'restore' ? await restoredPop() : boughtPop(id));
    else if (r === 'failed') setPop(FAILED);
    else if (r === 'soon') setPop(SOON);
  };

  return (
    <Screen tab={null} glow={21} wide={480}>
      <InfoScroll>
        <Kicker>{tr('Nova Shop')}</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {/* Not just buying: the shop is where tokens are earned, bought and spent (Yazan 2026-10-25, #32). */}
          {tr('Earn, buy and spend ')}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>{tr('tokens')}</Text>
        </Text>
        {/* Offline: what you own, from the saved copy; buying needs internet (#57). */}
        <OfflineLine at={styleSavedAt} />
        {signedIn ? (
          <View style={s.bal}>
            <TokenCoin size={u(18)} progress={0} track="transparent" />
            <Text style={[s.balT, { color: c.mute }]}>
              {tr('You have ')}
              <Text style={[s.balT, { color: c.fg, fontFamily: F.bodyBold }]}>{tokens}</Text>
              {tr(' tokens')}
            </Text>
          </View>
        ) : (
          <Pressable onPress={() => router.navigate('/auth')} style={s.bal} accessibilityRole="button">
            <Text style={[s.balT, { color: c.mute }]}>
              {tr('Sign in to earn, buy and spend. ')}
              <Text style={[s.balT, { color: t.accent, fontFamily: F.bodyBold }]}>{tr('Sign in')}</Text>
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={subscribed ? undefined : () => run(SUBSCRIPTION.id, () => buy(SUBSCRIPTION.id))}
          accessibilityRole="button"
          accessibilityLabel={subscribed ? tr('MedNova Unlimited is active') : tr('Subscribe to MedNova Unlimited for {subPrice} a month', { subPrice })}
          style={[{ marginTop: u(16) }, busy === SUBSCRIPTION.id && s.busy]}
        >
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={s.sub}>
            <View style={{ flex: 1 }}>
              <Text style={[s.mono, { color: t.onGrad, opacity: 0.7 }]}>{tr('MONTHLY')}</Text>
              <Text style={[s.subH, { color: t.onGrad }]}>{tr('MedNova Unlimited')}</Text>
              <Text style={[s.subP, { color: t.onGrad }]}>{SUBSCRIPTION.perks.map((x) => tr(x)).join(' · ')}</Text>
              <Text style={[s.subP, { color: t.onGrad, fontFamily: F.bodyBold }]}>{tr('+{bonus} tokens on your first month, once', { bonus: SUBSCRIPTION.bonus })}</Text>
            </View>
            <View style={[s.subBtn, { backgroundColor: t.onGrad }]}>
              {subscribed ? (
                <>
                  <Text style={[s.subBtnT, { color: t.gradB }]}>{tr('Active')}</Text>
                  <Text style={[s.subBtnS, { color: t.gradB }]}>{tr('until {n}', { n: dateOf(until!) })}</Text>
                </>
              ) : (
                <>
                  <Text style={[s.subBtnT, { color: t.gradB }]}>{subPrice}</Text>
                  <Text style={[s.subBtnS, { color: t.gradB }]}>{tr('a month')}</Text>
                </>
              )}
            </View>
          </LinearGradient>
        </Pressable>

        <FreeTokens t={t} />

        {/* Style shop (Yazan 2026-10-13): frames, titles, win effects and stickers, bought with tokens. */}
        <View style={{ height: u(14) }} />
        <Kicker inSec>{tr('Style')}</Kicker>
        <StyleBanner t={t} />

        <View style={{ height: u(14) }} />
        <Kicker inSec>{tr('Token packs')}</Kicker>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rowScroll} contentContainerStyle={s.row} snapToInterval={CARD + GAP} decelerationRate="fast">
          {PACKS.map((p, i) => (
            <PackCard key={p.id} t={t} p={p} i={i} busy={busy === p.id} onBuy={() => run(p.id, () => buy(p.id))} />
          ))}
        </ScrollView>

        {/* The Sovereign package (Yazan 2026-10-25): $10 for Sovereign, its frame and 500 tokens. */}
        <View style={{ height: u(14) }} />
        <Kicker inSec>{tr('Packages')}</Kicker>
        <SovereignCard t={t} busy={busy === SOVEREIGN_PACK.id} onBuy={() => run(SOVEREIGN_PACK.id, () => buy(SOVEREIGN_PACK.id))} />

        <Pressable onPress={() => (signedIn ? setPop(ASK_RESTORE) : router.navigate('/auth'))} hitSlop={u(10)} style={s.restore} accessibilityRole="button">
          <Text style={[s.restoreT, { color: t.accent }]}>{tr('Restore purchases')}</Text>
        </Pressable>
        <Text style={[s.foot, { color: c.mute }]}>
          {tr('Paid through {STORE}. Tokens and the subscription stay on your account. MedNova Unlimited is {subPrice} a month and renews every month until you cancel it in your {STORE} subscriptions, at least a day before it renews. See our ', { STORE, subPrice })}
          <Text style={{ color: t.accent }} onPress={() => router.push({ pathname: '/privacy', params: { doc: 'terms' } })} accessibilityRole="link">
            {tr('Terms')}
          </Text>
          {' and '}
          <Text style={{ color: t.accent }} onPress={() => router.push('/privacy')} accessibilityRole="link">
            {tr('Privacy Policy')}
          </Text>
          .
        </Text>
      </InfoScroll>
      <FreeSheets t={t} />
      <Congrats open={!!pop} title={pop?.title ?? ''} big={pop?.big} kick={pop?.kick} line={pop?.line ?? ''} coin={pop?.coin} button={pop?.button} alt={pop?.confirm ? tr('Cancel') : undefined} onButton={pop?.confirm ? () => { setPop(null); void run('restore', restore); } : undefined} onClose={() => setPop(null)} />
    </Screen>
  );
}

/** Sovereign, wearing its frame, with what the package holds. "Coming soon" until the stores sell it. */
function SovereignCard({ t, busy, onBuy }: { t: Theme; busy: boolean; onBuy: () => void }) {
  const owned = useStyle((x) => x.owned.includes('robot:sovereign'));
  const price = usePrice(SOVEREIGN_PACK.id, SOVEREIGN_PACK.price);
  return (
    // Yazan 2026-11-12: a long local price (EGP) squeezed the words into broken lines, so the price sits under them.
    <Pressable onPress={owned ? undefined : onBuy} accessibilityRole="button" accessibilityLabel={tr('Sovereign package for {price}', { price })} style={[s.style, s.sovCol, { backgroundColor: t.panel, borderColor: t.panelLine }, busy && s.busy]}>
      <View style={s.sovTop}>
        <Framed slug="sovereign" size={u(64)} frame="sovereign" still />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.mono, { color: '#f5c542' }]} numberOfLines={1}>{'\u2605'.repeat(6)}</Text>
          <Text style={[s.styleH, { color: t.fg }]} numberOfLines={1} adjustsFontSizeToFit>{tr('Sovereign package')}</Text>
          <Text style={[s.styleS, { color: t.mute }]}>{tr('Sovereign, its frame and {tokens} tokens', { tokens: SOVEREIGN_PACK.tokens })}</Text>
          <Text style={[s.styleS, { color: t.accent }]}>{tr('+30% EXP · refill 5 min')}</Text>
        </View>
      </View>
      {owned ? (
        <Text style={[s.styleS, { color: t.mute, textAlign: 'center' }]}>{tr('Owned')}</Text>
      ) : (
        <View style={{ alignItems: 'stretch', gap: u(3) }}>
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={[s.cBtn, s.sovBtn, s.sovWide]}>
            <Text style={[s.cBtnT, { color: t.onGrad }]} numberOfLines={1}>{price}</Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

const CARD = u(124);
const GAP = u(10);
const WAS = '#e5534b'; // the old amount, struck through in red

/** One pack: a small pile of coins (more coins, bigger pack), the count and the price. */
function PackCard({ t, p, i, busy, onBuy }: { t: Theme; p: Pack; i: number; busy: boolean; onBuy: () => void }) {
  const coin = u(22);
  const step = coin * 0.45;
  const price = usePrice(p.id, p.price);
  return (
    <Pressable onPress={onBuy} accessibilityRole="button" accessibilityLabel={tr('{tokens} tokens for {price}', { tokens: p.tokens, price })} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }, busy && s.busy]}>
      <View style={[s.pile, { height: coin, width: coin + step * i }]}>
        {Array.from({ length: i + 1 }, (_, k) => (
          <View key={k} style={{ position: 'absolute', start: step * k, top: 0 }}>
            <TokenCoin size={coin} progress={0} track="transparent" />
          </View>
        ))}
      </View>
      <View style={s.wasBox}>
        <Text style={[s.was, { color: WAS }]}>{p.was}</Text>
        {/* drawn, not textDecoration: that line's colour doesn't follow on Android or web */}
        <View style={[s.wasLine, { backgroundColor: WAS }]} />
      </View>
      <Text style={[s.cN, { color: t.fg }]}>{p.tokens}</Text>
      <Text style={[s.cU, { color: t.mute }]}>{tr('tokens')}</Text>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.cBtn}>
        <Text style={[s.cBtnT, { color: t.onGrad }]}>{price}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bal: { flexDirection: 'row', alignItems: 'center', gap: u(6), marginTop: u(10), alignSelf: 'flex-start' },
  balT: { fontFamily: F.body, fontSize: u(11.5) },
  mono: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  busy: { opacity: 0.6 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: u(10), borderRadius: u(18), paddingVertical: u(12), paddingHorizontal: u(14) },
  subH: { fontFamily: F.display, fontSize: u(17), lineHeight: u(21), marginTop: u(1) },
  subP: { fontFamily: F.bodyMedium, fontSize: u(10), marginTop: u(3), opacity: 0.85 },
  subBtn: { borderRadius: u(14), paddingHorizontal: u(12), paddingVertical: u(8), alignItems: 'center' },
  subBtnT: { fontFamily: F.bodyBold, fontSize: u(14) },
  subBtnS: { fontFamily: F.body, fontSize: u(8.5) },
  rowScroll: { marginHorizontal: -u(18) },
  row: { paddingHorizontal: u(18), gap: GAP, paddingTop: u(6), paddingBottom: u(4) },
  card: { width: CARD, borderWidth: 1, borderRadius: u(18), padding: u(12), alignItems: 'center' },
  pile: { marginBottom: u(6) },
  cN: { fontFamily: F.display, fontSize: u(24), lineHeight: u(28) },
  was: { fontFamily: F.bodyBold, fontSize: u(12), lineHeight: u(14) },
  wasBox: { justifyContent: 'center' },
  wasLine: { position: 'absolute', start: -u(2), end: -u(2), height: u(1.6), borderRadius: 1, transform: [{ rotate: '-12deg' }] },
  cU: { fontFamily: F.body, fontSize: u(10) },
  cBtn: { alignSelf: 'stretch', height: u(30), borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: u(10) },
  sovBtn: { alignSelf: 'auto', marginTop: 0, paddingHorizontal: u(16) },
  cBtnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  restore: { alignSelf: 'center', marginTop: u(14), padding: u(4) },
  style: { flexDirection: 'row', alignItems: 'center', gap: u(12), borderWidth: 1, borderRadius: u(18), padding: u(12), marginTop: u(6) },
  styleH: { fontFamily: F.display, fontSize: u(15) },
  sovCol: { flexDirection: 'column', alignItems: 'stretch' },
  sovTop: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  sovWide: { alignSelf: 'stretch', width: undefined },
  styleS: { fontFamily: F.bodyMedium, fontSize: u(10), marginTop: u(2) },
  restoreT: { fontFamily: F.bodyMedium, fontSize: u(11) },
  foot: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(14), marginTop: u(8), textAlign: 'center', paddingHorizontal: u(10) },
});
