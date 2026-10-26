import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useBalance } from '@/components/LevelBadge';
import { TokenCoin } from '@/components/PulseStar';
import { Screen } from '@/components/Screen';
import { OfflineLine } from '@/components/OfflineLine';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { useSession } from '@/games/shell/session';
import { DEAL_OFF, FRAMES, TITLES } from '@/features/style/catalog';
import { Framed, type FrameKey } from '@/features/style/Frame';
import { loadStyle, useStyle } from '@/features/style/useStyle';
import { SOVEREIGN_PACK } from '@/features/shop/robots';
import { useAccount } from '@/state/account';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { FreeSheets, FreeTokens, useFree } from './FreeTokens';
import { BILLING_LIVE, buy, restore, useIsSubscribed, useSubscription, type BuyResult } from './billing';
import { PACKS, SUBSCRIPTION, type Pack } from './catalog';

const SAY: Record<BuyResult, string> = {
  done: 'Added to your account.',
  cancelled: '',
  soon: 'Buying opens when MedNova is in the App Store and Google Play.',
  signin: '',
  failed: 'Not bought. Check your connection and try again.',
};

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
  const [said, setSaid] = useState('');

  const run = async (id: string, act: () => Promise<BuyResult>) => {
    if (!signedIn) return router.navigate('/auth'); // MN8: guests sign in first
    if (busy) return;
    setBusy(id);
    setSaid('');
    const r = await act();
    setBusy(null);
    setSaid(SAY[r]);
  };

  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Nova Shop</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {/* Not just buying: the shop is where tokens are earned, bought and spent (Yazan 2026-10-25, #32). */}
          {'Earn, buy and spend '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>tokens</Text>
        </Text>
        {/* Offline: what you own, from the saved copy; buying needs internet (#57). */}
        <OfflineLine at={styleSavedAt} />
        {signedIn ? (
          <View style={s.bal}>
            <TokenCoin size={u(18)} progress={0} track="transparent" />
            <Text style={[s.balT, { color: c.mute }]}>
              {'You have '}
              <Text style={[s.balT, { color: c.fg, fontFamily: F.bodyBold }]}>{tokens}</Text>
              {' tokens'}
            </Text>
          </View>
        ) : (
          <Pressable onPress={() => router.navigate('/auth')} style={s.bal} accessibilityRole="button">
            <Text style={[s.balT, { color: c.mute }]}>
              {'Sign in to earn, buy and spend. '}
              <Text style={[s.balT, { color: t.accent, fontFamily: F.bodyBold }]}>Sign in</Text>
            </Text>
          </Pressable>
        )}

        {said ? <Text style={[s.said, { color: c.fg, borderColor: t.panelLine, backgroundColor: t.panel }]}>{said}</Text> : null}
        <Pressable
          onPress={subscribed ? undefined : () => run(SUBSCRIPTION.id, () => buy(SUBSCRIPTION.id))}
          accessibilityRole="button"
          accessibilityLabel={subscribed ? 'MedNova Unlimited is active' : `Subscribe to MedNova Unlimited for ${SUBSCRIPTION.price} a month`}
          style={[{ marginTop: u(16) }, busy === SUBSCRIPTION.id && s.busy]}
        >
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={s.sub}>
            <View style={{ flex: 1 }}>
              <Text style={[s.mono, { color: t.onGrad, opacity: 0.7 }]}>MONTHLY</Text>
              <Text style={[s.subH, { color: t.onGrad }]}>MedNova Unlimited</Text>
              <Text style={[s.subP, { color: t.onGrad }]}>{SUBSCRIPTION.perks.join(' · ')}</Text>
              <Text style={[s.subP, { color: t.onGrad, fontFamily: F.bodyBold }]}>{`+${SUBSCRIPTION.bonus} tokens on your first month, once`}</Text>
            </View>
            <View style={[s.subBtn, { backgroundColor: t.onGrad }]}>
              {subscribed ? (
                <>
                  <Text style={[s.subBtnT, { color: t.gradB }]}>Active</Text>
                  <Text style={[s.subBtnS, { color: t.gradB }]}>{`until ${dateOf(until!)}`}</Text>
                </>
              ) : (
                <>
                  <Text style={[s.subBtnT, { color: t.gradB }]}>{SUBSCRIPTION.price}</Text>
                  <Text style={[s.subBtnS, { color: t.gradB }]}>{`a ${SUBSCRIPTION.period}`}</Text>
                </>
              )}
            </View>
          </LinearGradient>
        </Pressable>

        <FreeTokens t={t} />

        {/* Style shop (Yazan 2026-10-13): frames, titles, win effects and stickers, bought with tokens. */}
        <View style={{ height: u(14) }} />
        <Kicker inSec>Style</Kicker>
        <StyleRow t={t} />

        <View style={{ height: u(14) }} />
        <Kicker inSec>Token packs</Kicker>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rowScroll} contentContainerStyle={s.row} snapToInterval={CARD + GAP} decelerationRate="fast">
          {PACKS.map((p, i) => (
            <PackCard key={p.id} t={t} p={p} i={i} busy={busy === p.id} onBuy={() => run(p.id, () => buy(p.id))} />
          ))}
        </ScrollView>

        {/* The Sovereign package (Yazan 2026-10-25): $10 for Sovereign, its frame and 500 tokens. */}
        <View style={{ height: u(14) }} />
        <Kicker inSec>Packages</Kicker>
        <SovereignCard t={t} busy={busy === SOVEREIGN_PACK.id} onBuy={() => run(SOVEREIGN_PACK.id, () => buy(SOVEREIGN_PACK.id))} />

        <Pressable onPress={() => run('restore', restore)} hitSlop={u(10)} style={s.restore} accessibilityRole="button">
          <Text style={[s.restoreT, { color: t.accent }]}>Restore purchases</Text>
        </Pressable>
        <Text style={[s.foot, { color: c.mute }]}>Paid through the App Store or Google Play. Tokens and the subscription stay on your account.</Text>
      </InfoScroll>
      <FreeSheets t={t} />
    </Screen>
  );
}

/** The way into the Style shop, with this week's deal on it. */
function StyleRow({ t }: { t: Theme }) {
  const deal = useStyle((x) => x.deal);
  const avatar = useAccount((a) => a.profile?.avatar ?? 'yara');
  useEffect(() => {
    void loadStyle();
  }, []);
  const names = [FRAMES.find((x) => x.id === deal[0])?.name, TITLES.find((x) => x.id === deal[1])?.name].filter(Boolean);
  return (
    <Pressable onPress={() => router.navigate('/style' as never)} style={[s.style, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="link">
      <Framed slug={avatar} size={u(46)} frame={(FRAMES.find((x) => x.id === deal[0])?.key ?? 'gold') as FrameKey} still />
      <View style={{ flex: 1 }}>
        <Text style={[s.styleH, { color: t.fg }]}>Frames, titles and effects</Text>
        <Text style={[s.styleS, { color: names.length ? t.accent : t.mute }]}>{names.length ? `${DEAL_OFF}% off this week: ${names.join(' and ')}` : 'Dress your name for every room'}</Text>
      </View>
      <Text style={[s.styleS, { color: t.accent }]}>Open ›</Text>
    </Pressable>
  );
}

/** Sovereign, wearing its frame, with what the package holds. "Coming soon" until the stores sell it. */
function SovereignCard({ t, busy, onBuy }: { t: Theme; busy: boolean; onBuy: () => void }) {
  const owned = useStyle((x) => x.owned.includes('robot:sovereign'));
  return (
    <Pressable onPress={owned ? undefined : onBuy} accessibilityRole="button" accessibilityLabel={`Sovereign package for ${SOVEREIGN_PACK.price}`} style={[s.style, { backgroundColor: t.panel, borderColor: t.panelLine }, busy && s.busy]}>
      <Framed slug="sovereign" size={u(64)} frame="sovereign" still />
      <View style={{ flex: 1 }}>
        <Text style={[s.mono, { color: '#f5c542' }]}>{'\u2605'.repeat(6)}</Text>
        <Text style={[s.styleH, { color: t.fg }]}>Sovereign package</Text>
        <Text style={[s.styleS, { color: t.mute }]}>{`Sovereign, its frame and ${SOVEREIGN_PACK.tokens} tokens`}</Text>
        <Text style={[s.styleS, { color: t.accent }]}>+30% EXP · refill 5 min</Text>
      </View>
      {owned ? (
        <Text style={[s.styleS, { color: t.mute }]}>Owned</Text>
      ) : (
        <View style={{ alignItems: 'center', gap: u(3) }}>
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={[s.cBtn, s.sovBtn]}>
            <Text style={[s.cBtnT, { color: t.onGrad }]}>{SOVEREIGN_PACK.price}</Text>
          </LinearGradient>
          {!BILLING_LIVE ? <Text style={[s.mono, { color: t.mute }]}>COMING SOON</Text> : null}
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
  return (
    <Pressable onPress={onBuy} accessibilityRole="button" accessibilityLabel={`${p.tokens} tokens for ${p.price}`} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }, busy && s.busy]}>
      <View style={[s.pile, { height: coin, width: coin + step * i }]}>
        {Array.from({ length: i + 1 }, (_, k) => (
          <View key={k} style={{ position: 'absolute', left: step * k, top: 0 }}>
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
      <Text style={[s.cU, { color: t.mute }]}>tokens</Text>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.cBtn}>
        <Text style={[s.cBtnT, { color: t.onGrad }]}>{p.price}</Text>
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
  wasLine: { position: 'absolute', left: -u(2), right: -u(2), height: u(1.6), borderRadius: 1, transform: [{ rotate: '-12deg' }] },
  cU: { fontFamily: F.body, fontSize: u(10) },
  cBtn: { alignSelf: 'stretch', height: u(30), borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: u(10) },
  sovBtn: { alignSelf: 'auto', marginTop: 0, paddingHorizontal: u(16) },
  cBtnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  said: { fontFamily: F.bodyMedium, fontSize: u(11), lineHeight: u(15), marginTop: u(12), borderWidth: 1, borderRadius: u(12), paddingVertical: u(8), paddingHorizontal: u(12), overflow: 'hidden' },
  restore: { alignSelf: 'center', marginTop: u(14), padding: u(4) },
  style: { flexDirection: 'row', alignItems: 'center', gap: u(12), borderWidth: 1, borderRadius: u(18), padding: u(12), marginTop: u(6) },
  styleH: { fontFamily: F.display, fontSize: u(15) },
  styleS: { fontFamily: F.bodyMedium, fontSize: u(10), marginTop: u(2) },
  restoreT: { fontFamily: F.bodyMedium, fontSize: u(11) },
  foot: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(14), marginTop: u(8), textAlign: 'center', paddingHorizontal: u(10) },
});
