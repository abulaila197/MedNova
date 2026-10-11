import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { engine } from '@/games/engine';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { PACKS, SUBSCRIPTION, type Pack } from './catalog';

/** The Store (MN3-MN8): token packs and the monthly subscription. Two looks while Yazan picks: A Pharmacy shelf, B Price board. */
export function StorePage({ look }: { look: 'a' | 'b' | 'c' | 'd' }) {
  const c = useInfo();
  const [tokens, setTokens] = useState<number | null>(null);
  useEffect(() => {
    engine.wallet.balance().then((b) => setTokens(b.tokens), () => {});
  }, []);
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Store</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Top up your '}
          <Text style={[ui.H, { color: c.t.accent, fontFamily: F.displayItalic }]}>tokens</Text>
        </Text>
        <View style={s.bal}>
          <TokenCoin size={u(18)} progress={0} light={c.lt} track="transparent" />
          <Text style={[s.balT, { color: c.mute }]}>
            {'You have '}
            <Text style={[s.balT, { color: c.fg, fontFamily: F.bodyBold }]}>{tokens ?? '–'}</Text>
            {' tokens'}
          </Text>
        </View>
        {look === 'a' ? <Shelf t={c.t} /> : look === 'b' ? <Board t={c.t} /> : <Rows t={c.t} big={look === 'd'} />}
        <Text style={[s.foot, { color: c.mute }]}>Paid through the App Store or Google Play. Tokens and the subscription stay on your account.</Text>
      </InfoScroll>
    </Screen>
  );
}

/* ---------- Looks C and D: app-store rows (subscription banner, packs swipe sideways) ---------- */

function Rows({ t, big }: { t: Theme; big: boolean }) {
  const [page, setPage] = useState(0);
  const cardW = big ? u(250) : u(124);
  const gap = u(10);
  return (
    <>
      <Pressable accessibilityRole="button" style={{ marginTop: u(16) }}>
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={s.sub}>
          <View style={{ flex: 1 }}>
            <Text style={[s.mono, { color: t.onGrad, opacity: 0.7 }]}>MONTHLY</Text>
            <Text style={[s.subH, { color: t.onGrad }]}>MedNova Unlimited</Text>
            <Text style={[s.subP, { color: t.onGrad }]}>{SUBSCRIPTION.perks.join(' · ')}</Text>
          </View>
          <View style={[s.subBtn, { backgroundColor: t.onGrad }]}>
            <Text style={[s.subBtnT, { color: t.gradB }]}>{SUBSCRIPTION.price}</Text>
            <Text style={[s.subBtnS, { color: t.gradB }]}>a month</Text>
          </View>
        </LinearGradient>
      </Pressable>
      <View style={{ height: u(14) }} />
      <Kicker inSec>Token packs</Kicker>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.rowScroll}
        contentContainerStyle={{ paddingHorizontal: u(18), gap, paddingTop: u(6), paddingBottom: u(4) }}
        snapToInterval={cardW + gap}
        decelerationRate="fast"
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (cardW + gap)))}
        scrollEventThrottle={32}
      >
        {PACKS.map((p, i) => (
          <PackCard key={p.id} t={t} p={p} i={i} w={cardW} big={big} />
        ))}
      </ScrollView>
      {big ? (
        <View style={s.dots}>
          {PACKS.map((p, i) => (
            <View key={p.id} style={[s.dot, { backgroundColor: i === page ? t.accent : t.panelLine }, i === page && s.dotOn]} />
          ))}
        </View>
      ) : null}
    </>
  );
}

function PackCard({ t, p, i, w, big }: { t: Theme; p: Pack; i: number; w: number; big: boolean }) {
  const coin = big ? u(28) : u(22);
  const step = coin * 0.45;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${p.tokens} tokens for ${p.price}`} style={[s.card, big && s.cardBig, { width: w, backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={[s.pile, { height: coin, width: coin + step * i }]}>
        {Array.from({ length: i + 1 }, (_, k) => (
          <View key={k} style={{ position: 'absolute', left: step * k, top: 0 }}>
            <TokenCoin size={coin} progress={0} light={t.mode === 'light'} track="transparent" />
          </View>
        ))}
      </View>
      <Text style={[big ? s.cNBig : s.cN, { color: t.fg }]}>{p.tokens}</Text>
      <Text style={[s.cU, { color: t.mute }]}>tokens</Text>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={[s.cBtn, big && s.cBtnBig]}>
        <Text style={[s.cBtnT, { color: t.onGrad }]}>{p.price}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/* ---------- Look A: Pharmacy shelf ---------- */

const FILL = [0.32, 0.52, 0.72, 0.92];
const TALL = [62, 76, 90, 104];

function Shelf({ t }: { t: Theme }) {
  const lt = t.mode === 'light';
  return (
    <>
      <View style={s.slipWrap}>
        <View style={[s.slip, { backgroundColor: lt ? '#fffdf7' : '#171c44', borderColor: t.panelLine }]}>
          <View style={s.slipTop}>
            <Text style={[s.rx, { color: t.accent }]}>℞</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.mono, { color: t.kick }]}>PRESCRIPTION · MONTHLY</Text>
              <Text style={[s.slipH, { color: t.fg }]}>MedNova Unlimited</Text>
            </View>
          </View>
          {SUBSCRIPTION.perks.map((p) => (
            <View key={p} style={[s.rule, { borderBottomColor: t.panelLine }]}>
              <Text style={[s.ruleT, { color: t.soft }]}>{p}</Text>
            </View>
          ))}
          <View style={s.slipEnd}>
            <View>
              <Text style={[s.price, { color: t.fg }]}>
                {SUBSCRIPTION.price}
                <Text style={[s.per, { color: t.mute }]}>{` / ${SUBSCRIPTION.period}`}</Text>
              </Text>
              <Text style={[s.sign, { color: t.mute }]}>Dr. MedNova</Text>
            </View>
            <Pressable accessibilityRole="button">
              <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.cta}>
                <Text style={[s.ctaT, { color: t.onGrad }]}>Subscribe</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
        <View style={[s.pin, { backgroundColor: t.red }]}>
          <View style={s.pinLit} />
        </View>
      </View>

      <Kicker inSec style={{ marginTop: u(18) }}>Token packs</Kicker>
      <View style={s.vials}>
        {PACKS.map((p, i) => (
          <Pressable key={p.id} style={s.vCol} accessibilityRole="button" accessibilityLabel={`${p.tokens} tokens for ${p.price}`}>
            <View style={[s.cap, { backgroundColor: lt ? '#c9c2b4' : '#3a4170' }]} />
            <View style={[s.tube, { height: u(TALL[i]), borderColor: lt ? 'rgba(40,36,28,0.3)' : 'rgba(255,255,255,0.25)', backgroundColor: lt ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.03)' }]}>
              <LinearGradient colors={[t.gradB, t.gradA]} style={{ height: `${FILL[i] * 100}%`, opacity: 0.85 }}>
                <View style={[s.meniscus, { backgroundColor: lt ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)' }]} />
              </LinearGradient>
              <View style={[s.gloss, { backgroundColor: lt ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.14)' }]} />
            </View>
          </Pressable>
        ))}
      </View>
      <View style={[s.glass, { backgroundColor: lt ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.1)', borderTopColor: lt ? '#ffffff' : 'rgba(255,255,255,0.35)' }]} />
      <LinearGradient colors={[lt ? 'rgba(229,131,58,0.16)' : 'rgba(111,214,255,0.14)', 'transparent']} style={s.shelfGlow} />
      <View style={s.labels}>
        {PACKS.map((p) => (
          <View key={p.id} style={s.vCol}>
            <Text style={[s.vN, { color: t.fg }]}>{p.tokens}</Text>
            <Text style={[s.vU, { color: t.mute }]}>tokens</Text>
            <View style={[s.tag, { borderColor: t.panelLine, backgroundColor: t.panel }]}>
              <Text style={[s.tagT, { color: t.fg }]}>{p.price}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

/* ---------- Look B: Price board ---------- */

function Board({ t }: { t: Theme }) {
  return (
    <View style={{ gap: u(10), marginTop: u(16) }}>
      <Ticket t={t} gold>
        <View style={s.tMain}>
          <Text style={[s.mono, { color: t.onGrad, opacity: 0.7 }]}>MONTHLY PASS</Text>
          <Text style={[s.goldH, { color: t.onGrad }]}>Unlimited</Text>
          <Text style={[s.goldP, { color: t.onGrad }]}>{SUBSCRIPTION.perks.join(' · ')}</Text>
        </View>
        <Stub t={t} gold top={SUBSCRIPTION.price} bottom={`a ${SUBSCRIPTION.period}`} />
      </Ticket>
      <Kicker inSec>Token packs</Kicker>
      {PACKS.map((p) => (
        <PackTicket key={p.id} t={t} p={p} />
      ))}
    </View>
  );
}

function PackTicket({ t, p }: { t: Theme; p: Pack }) {
  return (
    <Ticket t={t}>
      <View style={[s.tMain, s.tRow]}>
        <View style={{ flexShrink: 0 }}>
          <TokenCoin size={u(24)} progress={0} light={t.mode === 'light'} track="transparent" />
        </View>
        <Text style={[s.tN, { color: t.fg }]}>{p.tokens}</Text>
        <View>
          <Text style={[s.tU, { color: t.mute }]}>tokens</Text>
          <Text style={[s.mono, { color: t.kick }]}>{`NO. ${String(p.tokens).padStart(3, '0')}`}</Text>
        </View>
      </View>
      <Stub t={t} top={p.price} bottom="Buy" />
    </Ticket>
  );
}

/** A tear-off ticket: main part, perforation with side notches, stub. */
function Ticket({ t, gold = false, children }: { t: Theme; gold?: boolean; children: React.ReactNode }) {
  const body = (
    <View style={s.tInner}>
      {children}
      <View style={[s.notch, s.notchTop, { backgroundColor: t.sky, borderColor: gold ? 'transparent' : t.panelLine }]} />
      <View style={[s.notch, s.notchBot, { backgroundColor: t.sky, borderColor: gold ? 'transparent' : t.panelLine }]} />
    </View>
  );
  return (
    <Pressable accessibilityRole="button" style={[s.ticket, !gold && { backgroundColor: t.panel, borderColor: t.panelLine, borderWidth: 1 }]}>
      {gold ? (
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={s.goldFill}>
          {body}
        </LinearGradient>
      ) : (
        body
      )}
    </Pressable>
  );
}

function Stub({ t, gold = false, top, bottom }: { t: Theme; gold?: boolean; top: string; bottom: string }) {
  return (
    <View style={[s.stub, { borderLeftColor: gold ? 'rgba(0,0,0,0.25)' : t.panelLine }]}>
      <Text style={[s.stubP, { color: gold ? t.onGrad : t.fg }]}>{top}</Text>
      <Text style={[s.stubB, { color: gold ? t.onGrad : t.accent }]}>{bottom.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bal: { flexDirection: 'row', alignItems: 'center', gap: u(6), marginTop: u(10) },
  balT: { fontFamily: F.body, fontSize: u(11.5) },
  foot: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(14), marginTop: u(22), textAlign: 'center', paddingHorizontal: u(10) },
  mono: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },

  // C/D: app-store rows
  sub: { flexDirection: 'row', alignItems: 'center', gap: u(10), borderRadius: u(18), paddingVertical: u(12), paddingHorizontal: u(14) },
  subH: { fontFamily: F.display, fontSize: u(17), lineHeight: u(21), marginTop: u(1) },
  subP: { fontFamily: F.bodyMedium, fontSize: u(10), marginTop: u(3), opacity: 0.85 },
  subBtn: { borderRadius: u(14), paddingHorizontal: u(12), paddingVertical: u(8), alignItems: 'center' },
  subBtnT: { fontFamily: F.bodyBold, fontSize: u(14) },
  subBtnS: { fontFamily: F.body, fontSize: u(8.5) },
  rowScroll: { marginHorizontal: -u(18) },
  card: { borderWidth: 1, borderRadius: u(18), padding: u(12), alignItems: 'center' },
  cardBig: { paddingVertical: u(14), paddingHorizontal: u(16) },
  pile: { marginBottom: u(6) },
  cN: { fontFamily: F.display, fontSize: u(24), lineHeight: u(28) },
  cNBig: { fontFamily: F.display, fontSize: u(32), lineHeight: u(36) },
  cU: { fontFamily: F.body, fontSize: u(10) },
  cBtn: { alignSelf: 'stretch', height: u(30), borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: u(10) },
  cBtnBig: { height: u(36), marginTop: u(12) },
  cBtnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: u(6), marginTop: u(12) },
  dot: { width: u(6), height: u(6), borderRadius: u(3) },
  dotOn: { width: u(16) },

  // A: prescription slip
  slipWrap: { marginTop: u(22), transform: [{ rotate: '-1.2deg' }] },
  slip: { borderRadius: u(6), borderWidth: 1, padding: u(16), paddingTop: u(18) },
  slipTop: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  rx: { fontFamily: F.displayItalic, fontSize: u(40), lineHeight: u(44) },
  slipH: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24), marginTop: u(2) },
  rule: { borderBottomWidth: 1, paddingVertical: u(6), marginLeft: u(4) },
  ruleT: { fontFamily: F.displayItalic, fontSize: u(13) },
  slipEnd: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: u(14) },
  price: { fontFamily: F.display, fontSize: u(24) },
  per: { fontFamily: F.body, fontSize: u(11) },
  sign: { fontFamily: F.displayItalic, fontSize: u(10), marginTop: u(2) },
  cta: { height: u(36), paddingHorizontal: u(22), borderRadius: 999, justifyContent: 'center' },
  ctaT: { fontFamily: F.bodyBold, fontSize: u(12) },
  pin: { position: 'absolute', top: -u(6), alignSelf: 'center', width: u(14), height: u(14), borderRadius: u(7) },
  pinLit: { position: 'absolute', left: u(3), top: u(2.5), width: u(5), height: u(4), borderRadius: u(3), backgroundColor: 'rgba(255,255,255,0.6)' },

  // A: vials on the shelf
  vials: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: u(14), paddingHorizontal: u(6) },
  vCol: { width: u(64), alignItems: 'center' },
  cap: { width: u(30), height: u(9), borderRadius: u(2) },
  tube: { width: u(40), borderWidth: 1.5, borderTopWidth: 0, borderBottomLeftRadius: u(20), borderBottomRightRadius: u(20), overflow: 'hidden', justifyContent: 'flex-end' },
  meniscus: { height: u(2) },
  gloss: { position: 'absolute', left: u(6), top: u(8), bottom: u(14), width: u(4), borderRadius: u(2) },
  glass: { height: u(7), borderRadius: u(2), borderTopWidth: 1, marginHorizontal: -u(4) },
  shelfGlow: { height: u(26), marginHorizontal: u(10) },
  labels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: -u(20), paddingHorizontal: u(6) },
  vN: { fontFamily: F.display, fontSize: u(20), lineHeight: u(23) },
  vU: { fontFamily: F.body, fontSize: u(9) },
  tag: { marginTop: u(7), borderWidth: 1, borderRadius: 999, paddingHorizontal: u(10), paddingVertical: u(4) },
  tagT: { fontFamily: F.bodyBold, fontSize: u(11) },

  // B: tickets
  ticket: { borderRadius: u(12), overflow: 'hidden' },
  goldFill: { borderRadius: u(12) },
  tInner: { flexDirection: 'row', minHeight: u(64) },
  tMain: { flex: 1, padding: u(14), justifyContent: 'center' },
  tRow: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  tN: { fontFamily: F.display, fontSize: u(28), lineHeight: u(32) },
  tU: { fontFamily: F.body, fontSize: u(10.5) },
  goldH: { fontFamily: F.display, fontSize: u(26), lineHeight: u(30), marginTop: u(2) },
  goldP: { fontFamily: F.bodyMedium, fontSize: u(10.5), marginTop: u(2), opacity: 0.85 },
  stub: { width: u(88), borderLeftWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingVertical: u(10) },
  stubP: { fontFamily: F.bodyBold, fontSize: u(16) },
  stubB: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4), marginTop: u(3) },
  notch: { position: 'absolute', right: u(88) - u(7), width: u(14), height: u(14), borderRadius: u(7), borderWidth: 1 },
  notchTop: { top: -u(8) },
  notchBot: { bottom: -u(8) },
});
