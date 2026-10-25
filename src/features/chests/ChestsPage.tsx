import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming, Easing } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { MechViewer } from '@/features/cards/CollectionPage';

import { CHEST_ORDER, CHESTS, chestItems, ITEMS, MECHS, MECHS_PRIZE, RARITY, RARITY_ORDER, type ChestKind, type Item } from './data';
import type { OpenResult } from './useChests';
import { ItemTile } from './Tiles';

export type ChestsView = {
  owned: Record<ChestKind, number>;
  /** Item keys the player already has (robots, stickers, effects). */
  have: string[];
  /** Today's challenge line for the link card. */
  today: { step: 1 | 2 | 3 | 4; line: string; streak: number };
  /** Opens one chest on the server. */
  open: (k: ChestKind) => Promise<OpenResult>;
};

type Won = { item: Item; dupe: boolean; tokens: number }[];

const TILE = u(38);

/**
 * Chests (Yazan 2026-10-18): chest types on the left with how many you own above each,
 * the chosen chest in the centre, and everything it can hold on the right.
 */
export function ChestsPage({ v }: { v: ChestsView }) {
  const c = useInfo();
  const t = c.t;
  const first = CHEST_ORDER.find((k) => v.owned[k] > 0) ?? 'wooden';
  const [sel, setSel] = useState<ChestKind>(first);
  const chest = CHESTS[sel];
  const items = chestItems(sel);
  const n = v.owned[sel];
  const [won, setWon] = useState<Won | null>(null);
  const [prize, setPrize] = useState(0);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const opening = useRef(false);

  // The Light opening (Yazan 2026-10-18): the chest shakes, the lid pops with a glow, then the items slide in.
  const shake = useSharedValue(0);
  const pop = useSharedValue(0);
  const chestSt = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shake.value}deg` }, { translateY: -pop.value * u(8) }, { scale: 1 + pop.value * 0.12 }],
  }));
  const glowSt = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.6 + pop.value * 0.6 }] }));

  const openIt = async () => {
    // A ref holds from the first tap; state alone lets a same-frame second tap open a second chest (AP10a).
    if (busy || opening.current || !n) return;
    opening.current = true;
    setBusy(true);
    setFailed(false);
    shake.set(withSequence(...[-7, 7, -6, 6, -4, 4, 0].map((d) => withTiming(d, { duration: 70 }))));
    const [r] = await Promise.all([v.open(sel), new Promise((res) => setTimeout(res, 500))]);
    if (!r.ok) {
      opening.current = false;
      setBusy(false);
      setFailed(true);
      return;
    }
    pop.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) }));
    setTimeout(() => {
      setWon(r.items.map((w) => ({ item: ITEMS.find((i) => i.key === w.key) ?? ITEMS[0], dupe: w.dupe, tokens: w.tokens })));
      setPrize(r.prize);
      opening.current = false;
      setBusy(false);
    }, 420);
  };
  const collect = () => {
    setWon(null);
    setPrize(0);
    pop.set(0);
    if (!v.owned[sel]) setSel(CHEST_ORDER.find((k) => v.owned[k] > 0) ?? sel);
  };

  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Daily rewards</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'My '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>chests</Text>
        </Text>

        <View style={s.row}>
          <View style={s.left}>
            {CHEST_ORDER.map((k) => {
              const on = k === sel;
              return (
                <Pressable key={k} onPress={() => !won && !busy && setSel(k)} style={s.kind} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${CHESTS[k].name}, ${v.owned[k]} owned`}>
                  <Text style={[s.own, { color: v.owned[k] ? t.fg : c.mute }]}>{`×${v.owned[k]}`}</Text>
                  <View style={[s.kTile, { backgroundColor: on ? c.surf : c.surf2, borderColor: on ? t.accent : c.line }]}>
                    <Image source={CHESTS[k].art} style={[s.kArt, !v.owned[k] && { opacity: 0.45 }]} contentFit="contain" />
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={s.mid}>
            {won ? (
              <View style={s.won}>
                <Text style={[s.wonK, { color: c.kick }]}>YOU GOT</Text>
                {won.map(({ item, dupe, tokens }, i) => (
                  <Animated.View key={`${item.key}${i}`} entering={FadeInDown.delay(i * 140).duration(320)} style={s.wonRow}>
                    {item.kind === 'mech' ? (
                      <Pressable onPress={() => setCard(MECHS.findIndex((m) => `mech:${m.key}` === item.key))} accessibilityRole="button" accessibilityLabel={`See ${item.name}'s card`}>
                        <ItemTile item={item} size={u(46)} />
                      </Pressable>
                    ) : (
                      <ItemTile item={item} size={u(46)} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[s.wonN, { color: c.fg }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[s.wonR, { color: RARITY[item.rarity].color }]}>{RARITY[item.rarity].name}</Text>
                      {dupe ? <Text style={[s.wonD, { color: c.mute }]}>{`Already yours: +${tokens} tokens`}</Text> : null}
                    </View>
                  </Animated.View>
                ))}
                {prize ? <Text style={[s.prize, { color: t.accent }]}>{`All 8 Nova Mechs! +${MECHS_PRIZE} tokens`}</Text> : null}
                <GradPill label="Collect" onPress={collect} />
              </View>
            ) : (
              <>
                <View style={s.stage}>
                  <View style={[s.floor, { backgroundColor: 'rgba(111,214,255,0.10)' }]} />
                  <Animated.View style={[s.glow, glowSt]} pointerEvents="none" />
                  <Animated.View style={chestSt}>
                    <Image source={chest.art} style={[s.big, !n && { opacity: 0.4 }]} contentFit="contain" />
                  </Animated.View>
                </View>
                <Text style={[s.name, { color: c.fg }]}>{chest.name}</Text>
                <Text style={[s.sub, { color: c.mute }]}>{`${chest.items} item${chest.items > 1 ? 's' : ''} · ${chest.from}`}</Text>
                {n ? <GradPill label={busy ? 'Opening…' : 'Open'} onPress={openIt} /> : <Text style={[s.none, { color: c.mute }]}>None yet</Text>}
                {failed ? <Text style={[s.none, { color: c.mute }]}>{'Couldn\u2019t open it. Check your connection.'}</Text> : null}
              </>
            )}
          </View>

          <View style={s.right}>
            <Text style={[s.inK, { color: c.kick }]}>INSIDE</Text>
            <View style={s.grid}>
              {items.map((i) =>
                i.kind === 'mech' ? (
                  <Pressable key={i.key} onPress={() => setCard(MECHS.findIndex((m) => `mech:${m.key}` === i.key))} accessibilityRole="button" accessibilityLabel={`See ${i.name}'s card`}>
                    <ItemTile item={i} size={TILE} owned={v.have.includes(i.key)} />
                  </Pressable>
                ) : (
                  <ItemTile key={i.key} item={i} size={TILE} owned={v.have.includes(i.key)} />
                ),
              )}
            </View>
          </View>
        </View>

        <View style={[s.odds, { borderColor: c.line, backgroundColor: c.surf2 }]}>
          {RARITY_ORDER.filter((r) => chest.odds[r]).map((r) => (
            <View key={r} style={s.odd}>
              <View style={[s.dot, { backgroundColor: RARITY[r].color }]} />
              <Text style={[s.oddN, { color: c.fg }]}>{RARITY[r].name}</Text>
              <Text style={[s.oddP, { color: c.mute }]}>{`${chest.odds[r]}%`}</Text>
            </View>
          ))}
        </View>
        {sel === 'epic' ? <Text style={[s.note, { color: c.mute }]}>At least one Rare or better, with the best odds for 5-star robots.</Text> : null}

        <Pressable onPress={() => router.navigate('/challenges' as never)} style={[s.link, { backgroundColor: c.surf, borderColor: c.line }]} accessibilityRole="link" accessibilityLabel="Open daily challenges">
          <View style={{ flex: 1 }}>
            <Text style={[s.linkK, { color: c.kick }]}>{v.today.step > 3 ? 'ALL DONE TODAY' : `CHALLENGE ${v.today.step} OF 3`}</Text>
            <Text style={[s.linkT, { color: c.fg }]}>{v.today.line}</Text>
          </View>
          <View style={s.streak}>
            {[0, 1, 2, 3, 4].map((d) => (
              <View key={d} style={[s.sDot, { backgroundColor: d < v.today.streak ? '#b07cff' : c.line }]} />
            ))}
          </View>
        </Pressable>
      </InfoScroll>
      <MechViewer i={card} onClose={() => setCard(null)} />
    </Screen>
  );
}

function GradPill({ label, onPress }: { label: string; onPress?: () => void }) {
  const c = useInfo();
  return (
    <Pressable onPress={onPress} style={{ alignSelf: 'stretch', marginTop: u(10) }} accessibilityRole="button">
      <LinearGradient colors={[c.t.gradA, c.t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.pill}>
        <Text style={[s.pillT, { color: c.t.onGrad }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: u(18), gap: u(8) },
  left: { width: u(42), gap: u(6) },
  kind: { alignItems: 'center' },
  own: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(0.6), marginBottom: u(2) },
  kTile: { width: u(42), height: u(42), borderRadius: u(9), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kArt: { width: u(34), height: u(34) },
  mid: { flex: 1, alignItems: 'center' },
  stage: { width: '100%', height: u(118), alignItems: 'center', justifyContent: 'center', marginTop: u(8) },
  floor: { position: 'absolute', bottom: u(-2), width: '70%', height: u(10), borderRadius: 999 },
  big: { width: u(112), height: u(112) },
  glow: { position: 'absolute', width: u(120), height: u(120), borderRadius: u(60), backgroundColor: 'rgba(255,224,150,0.22)', shadowColor: '#ffd98a', shadowOpacity: 0.9, shadowRadius: u(30) },
  prize: { fontFamily: F.bodyBold, fontSize: u(10), textAlign: 'center' },
  name: { fontFamily: F.display, fontSize: u(15), marginTop: u(6) },
  sub: { fontFamily: F.body, fontSize: u(8.5), marginTop: u(2), textAlign: 'center' },
  none: { fontFamily: F.bodySemi, fontSize: u(9.5), marginTop: u(12) },
  pill: { height: u(30), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pillT: { fontFamily: F.bodyBold, fontSize: u(11) },
  right: { width: u(38) * 2 + u(5) },
  inK: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3), marginBottom: u(4) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5) },
  won: { alignSelf: 'stretch', gap: u(8), marginTop: u(6) },
  wonK: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3), textAlign: 'center' },
  wonRow: { flexDirection: 'row', alignItems: 'center', gap: u(7) },
  wonN: { fontFamily: F.bodyBold, fontSize: u(10) },
  wonR: { fontFamily: F.mono, fontSize: u(7), letterSpacing: u(0.8), marginTop: u(1) },
  wonD: { fontFamily: F.body, fontSize: u(7.5), marginTop: u(1) },
  odds: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: u(12), paddingHorizontal: u(10), paddingVertical: u(8), marginTop: u(16), columnGap: u(12), rowGap: u(5) },
  odd: { flexDirection: 'row', alignItems: 'center', gap: u(4) },
  dot: { width: u(6), height: u(6), borderRadius: u(3) },
  oddN: { fontFamily: F.bodySemi, fontSize: u(8.5) },
  oddP: { fontFamily: F.mono, fontSize: u(8) },
  note: { fontFamily: F.body, fontSize: u(8.5), marginTop: u(6) },
  link: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), paddingVertical: u(10), marginTop: u(14), gap: u(10) },
  linkK: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  linkT: { fontFamily: F.bodySemi, fontSize: u(10.5), marginTop: u(3) },
  streak: { flexDirection: 'row', gap: u(3) },
  sDot: { width: u(7), height: u(7), borderRadius: u(4) },
});
