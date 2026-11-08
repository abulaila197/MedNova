import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useShallow } from 'zustand/react/shallow';

import { OfflineLine } from '@/components/OfflineLine';
import { Text } from '@/components/AppText';
import { Congrats } from '@/components/Congrats';
import { Screen } from '@/components/Screen';
import { useSession } from '@/games/shell/session';
import { MECHS, MECHS_PRIZE } from '@/features/chests/data';
import { ROBOTS, robotOf } from '@/features/shop/robots';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { loadStyle, useStyle } from '@/features/style/useStyle';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { DECK, HUNT_PRIZE, type HuntCard } from './deck';
import { loadHunt, redeemHuntPrize, useHunt } from './hunt';
import { CardBack, RATIO, Sleeve } from './Sleeve';

/** My card collection: every card in a glass saver; found ones open (front, then flip for the clue), locked ones are dimmed. */
export function CollectionPage() {
  const c = useInfo();
  const t = c.t;
  const signedIn = !!useSession((x) => x.userId);
  const status = useHunt((h) => h.status);
  const savedAt = useHunt((h) => h.savedAt);
  const found = status?.found ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const [mech, setMech] = useState<number | null>(null);
  const mechs = useStyle(useShallow((x) => x.owned.filter((k) => k.startsWith('mech:')).map((k) => k.slice(5))));
  const robots = useStyle(useShallow((x) => x.owned.filter((k) => k.startsWith('robot:')).map((k) => k.slice(6))));
  const [robot, setRobot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState(false);
  const [err, setErr] = useState('');
  useFocusEffect(
    useCallback(() => {
      void loadStyle();
      // Offline with a saved copy, the cards stay open with the offline line instead of an error (#59).
      loadHunt().catch(() => !useHunt.getState().status && setErr('Could not load your cards. Check your connection.'));
      // eslint-disable-next-line react-hooks/exhaustive-deps -- signedIn only re-runs the load when the account changes while the page is open
    }, [signedIn]),
  );
  const redeem = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const r = await redeemHuntPrize();
      if (r.ok) setWon(true);
      else if (r.why !== 'done') setErr('Not redeemed yet. Try again in a moment.');
    } catch {
      setErr('Not redeemed. Check your connection and try again.');
    }
    setBusy(false);
  };
  const canRedeem = found.length === 9 && status?.prize === false;
  return (
    <Screen tab={null} glow={13}>
      <InfoScroll>
        <View>
          <Kicker>Treasure hunt</Kicker>
          <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
            {'My card '}
            <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>collection</Text>
          </Text>
          <OfflineLine at={savedAt} />
          <View style={s.count}>
            <Text style={[s.countT, { color: c.fg }]}>{`${found.length} of 9 found`}</Text>
            <View style={s.pips}>
              {DECK.map((k) => (
                <View key={k.key} style={[s.pip, { backgroundColor: found.includes(k.key) ? t.accent : c.line }]} />
              ))}
            </View>
          </View>
          <Text style={[s.hint, { color: c.mute }]}>Tap a card to read it, then flip it for the clue.</Text>
          {!signedIn ? (
            <Pressable onPress={() => router.navigate('/auth')} style={[s.note, { borderColor: c.line, backgroundColor: c.surf }]} accessibilityRole="button">
              <Text style={[s.noteT, { color: c.fg }]}>Sign in to find your first card and start the hunt.</Text>
              <Text style={[s.noteA, { color: t.accent }]}>Sign in</Text>
            </Pressable>
          ) : null}
          {canRedeem ? (
            <Pressable onPress={redeem} accessibilityRole="button" style={[{ marginTop: u(12) }, busy && { opacity: 0.6 }]}>
              <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.prize}>
                <Text style={[s.prizeT, { color: t.onGrad }]}>{`All nine found. Redeem ${HUNT_PRIZE} tokens`}</Text>
              </LinearGradient>
            </Pressable>
          ) : status?.prize ? (
            <Text style={[s.hint, { color: t.accent, marginTop: u(8) }]}>{`Hunt complete. ${HUNT_PRIZE} tokens collected.`}</Text>
          ) : null}
          {err ? <Text style={[s.hint, { color: t.error, marginTop: u(8) }]}>{err}</Text> : null}
        </View>
        <Binder t={t} found={found} onOpen={setOpen} />
        <Mechs t={t} owned={mechs} onOpen={setMech} />
        <RobotPack t={t} owned={robots} group="shop" onOpen={setRobot} />
        <RobotPack t={t} owned={robots} group="special" onOpen={setRobot} />
      </InfoScroll>
      <MechViewer i={mech} onClose={() => setMech(null)} />
      <CardViewer card={robotOf(robot ?? undefined)} onClose={() => setRobot(null)} />
      <Viewer t={t} i={open} onClose={() => setOpen(null)} />
      <Congrats open={won} tokens={HUNT_PRIZE} title="The hunt is complete" line="Nine cards, nine missions, one weary medic. Your tokens are in your wallet." onClose={() => setWon(false)} />
    </Screen>
  );
}

/** Binder page (locked look A): all nine savers on one page, three by three. */
function Binder({ t, found, onOpen }: { t: Theme; found: string[]; onOpen: (i: number) => void }) {
  const w = Math.floor((u(246) - u(10) * 2 - u(16) - 4) / 3);
  return (
    <View style={[s.binder, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: t.panelLine }]}>
      {DECK.map((k, i) => {
        const has = found.includes(k.key);
        return (
          <Pressable key={k.key} disabled={!has} onPress={() => onOpen(i)} style={{ width: w, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={has ? `Open ${k.name}` : 'Locked card'}>
            <Sleeve t={t} card={k} w={w} locked={!has} />
            <Text style={[s.bName, { color: has ? t.fg : t.mute }]}>{has ? k.name : '★'.repeat(k.stars)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Nova Mechs (Yazan 2026-10-18): front-only cards won from daily chests; all 8 pay a one-off prize. */
function Mechs({ t, owned, onOpen }: { t: Theme; owned: string[]; onOpen: (i: number) => void }) {
  const w = Math.floor((u(246) - u(10) * 2 - u(16) - 4) / 3);
  const n = MECHS.filter((m) => owned.includes(m.key)).length;
  return (
    <View style={{ marginTop: u(22) }}>
      <Kicker>Daily chests</Kicker>
      <Text style={[ui.H, { color: t.fg, fontFamily: F.display }]}>
        {'Nova '}
        <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>Mechs</Text>
      </Text>
      <View style={s.count}>
        <Text style={[s.countT, { color: t.fg }]}>{`${n} of ${MECHS.length} won`}</Text>
        <View style={s.pips}>
          {MECHS.map((m) => (
            <View key={m.key} style={[s.pip, { backgroundColor: owned.includes(m.key) ? t.accent : t.panelLine }]} />
          ))}
        </View>
      </View>
      <Text style={[s.hint, { color: t.mute }]}>{n === MECHS.length ? `All eight won. ${MECHS_PRIZE} tokens collected.` : `Robots drop from daily chests. Win all eight for ${MECHS_PRIZE} tokens.`}</Text>
      <View style={[s.binder, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: t.panelLine }]}>
        {MECHS.map((m, i) => {
          const has = owned.includes(m.key);
          return (
            <Pressable key={m.key} disabled={!has} onPress={() => onOpen(i)} style={{ width: w, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={has ? `Open ${m.name}` : 'Locked robot'}>
              <View style={[s.mSleeve, { width: w, borderRadius: w * 0.07 }]}>
                <Image source={m.card} style={[{ width: w - 6, height: (w - 6) * MECH_RATIO, borderRadius: w * 0.05 }, !has && { opacity: 0.12 }]} contentFit="cover" />
                {!has ? (
                  <View style={[StyleSheet.absoluteFill, s.lock]}>
                    <Svg width={u(12)} height={u(12)} viewBox="0 0 24 24">
                      <Rect x={5} y={10.5} width={14} height={10} rx={2} fill={t.fg} />
                      <Path d="M8 10.5 V8 a4 4 0 0 1 8 0 V10.5" stroke={t.fg} strokeWidth={2.2} fill="none" />
                    </Svg>
                  </View>
                ) : null}
              </View>
              <Text style={[s.bName, { color: has ? t.fg : t.mute }]}>{has ? m.name : '★'.repeat(m.stars)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const MECH_RATIO = 860 / 480;

/** Style shop characters (Yazan 2026-10-25): the five sold in the shop as one pack, Linky, Sovereign and Admin as a special one. */
function RobotPack({ t, owned, group, onOpen }: { t: Theme; owned: string[]; group: 'shop' | 'special'; onOpen: (key: string) => void }) {
  const w = Math.floor((u(246) - u(10) * 2 - u(16) - 4) / 3);
  const list = ROBOTS.filter((r) => r.group === group);
  const n = list.filter((r) => owned.includes(r.key)).length;
  return (
    <View style={{ marginTop: u(22) }}>
      <Kicker>{group === 'shop' ? 'Style shop' : 'Rare finds'}</Kicker>
      <Text style={[ui.H, { color: t.fg, fontFamily: F.display }]}>
        {group === 'shop' ? 'Shop ' : 'Special '}
        <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>pack</Text>
      </Text>
      <View style={s.count}>
        <Text style={[s.countT, { color: t.fg }]}>{`${n} of ${list.length} owned`}</Text>
        <View style={s.pips}>
          {list.map((r) => (
            <View key={r.key} style={[s.pip, { backgroundColor: owned.includes(r.key) ? t.accent : t.panelLine }]} />
          ))}
        </View>
      </View>
      <Text style={[s.hint, { color: t.mute }]}>{group === 'shop' ? 'Bought with tokens in the Style shop.' : 'Never sold for tokens: earned, in a package, or one of a kind.'}</Text>
      <View style={[s.binder, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: t.panelLine }]}>
        {list.map((r) => {
          const has = owned.includes(r.key);
          return (
            <Pressable key={r.key} disabled={!has} onPress={() => onOpen(r.key)} style={{ width: w, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={has ? `Open ${r.name}` : 'Locked character'}>
              <View style={[s.mSleeve, { width: w, borderRadius: w * 0.07 }]}>
                <Image source={r.card} style={[{ width: w - 6, height: (w - 6) * MECH_RATIO, borderRadius: w * 0.05 }, !has && { opacity: 0.12 }]} contentFit="cover" />
                {!has ? (
                  <View style={[StyleSheet.absoluteFill, s.lock]}>
                    <Svg width={u(12)} height={u(12)} viewBox="0 0 24 24">
                      <Rect x={5} y={10.5} width={14} height={10} rx={2} fill={t.fg} />
                      <Path d="M8 10.5 V8 a4 4 0 0 1 8 0 V10.5" stroke={t.fg} strokeWidth={2.2} fill="none" />
                    </Svg>
                  </View>
                ) : null}
              </View>
              <Text style={[s.bName, { color: has ? t.fg : t.mute }]}>{has ? r.name : '★'.repeat(r.stars)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One robot's card, big (also opened from the chest page's items, list #87). */
export function MechViewer({ i, onClose }: { i: number | null; onClose: () => void }) {
  return <CardViewer card={i === null ? null : MECHS[i]} onClose={onClose} />;
}

/** Any front-only card (Nova Mechs, Style shop characters), big in its saver. */
export function CardViewer({ card: m, onClose }: { card: { card: ImageSource; name: string; title: string } | null | undefined; onClose: () => void }) {
  if (!m) return null;
  const w = u(196);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,4,12,0.86)' }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.view} pointerEvents="box-none">
        <View style={[s.mSleeve, { width: w, borderRadius: w * 0.07 }]}>
          <Image source={m.card} style={{ width: w - 6, height: (w - 6) * MECH_RATIO, borderRadius: w * 0.05 }} contentFit="cover" />
        </View>
        <Text style={[s.flipT, { color: 'rgba(240,242,255,0.75)' }]}>{`${m.name}, ${m.title}`}</Text>
        <Pressable onPress={onClose} style={s.close} accessibilityRole="button">
          <Text style={s.closeT}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** The opened card: big, in its saver; tap flips it to the clue on the back. */
function Viewer({ t, i, onClose }: { t: Theme; i: number | null; onClose: () => void }) {
  const [back, setBack] = useState(false);
  const sx = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }] }));
  const w = u(196);
  if (i === null) return null;
  const card = DECK[i] as HuntCard;
  const flip = () => {
    sx.set(withTiming(0, { duration: 160 }, (ok) => {
      if (!ok) return;
      runOnJS(setBack)(!back);
      sx.value = withTiming(1, { duration: 160 });
    }));
  };
  const close = () => {
    setBack(false);
    onClose();
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,4,12,0.86)' }]} onPress={close} accessibilityLabel="Close" />
      <View style={s.view} pointerEvents="box-none">
        <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={back ? 'Show the front' : 'Flip for the clue'}>
          <Animated.View style={anim}>{back ? <BackInSleeve t={t} card={card} i={i} w={w} /> : <Sleeve t={t} card={card} w={w} locked={false} />}</Animated.View>
        </Pressable>
        <Text style={[s.flipT, { color: 'rgba(240,242,255,0.75)' }]}>{back ? 'Tap to see the front' : 'Tap the card to flip it'}</Text>
        <Pressable onPress={close} style={s.close} accessibilityRole="button">
          <Text style={s.closeT}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function BackInSleeve({ t, card, i, w }: { t: Theme; card: HuntCard; i: number; w: number }) {
  const pad = Math.max(3, w * 0.045);
  return (
    <View style={{ width: w, borderRadius: w * 0.07, padding: pad, backgroundColor: 'rgba(190,205,255,0.07)', borderWidth: 1, borderColor: 'rgba(200,215,255,0.22)' }}>
      <View style={{ height: (w - pad * 2) * RATIO }}>
        <CardBack card={card} w={w - pad * 2} i={i} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  count: { flexDirection: 'row', alignItems: 'center', gap: u(10), marginTop: u(10) },
  countT: { fontFamily: F.bodySemi, fontSize: u(11.5) },
  pips: { flexDirection: 'row', gap: u(4) },
  pip: { width: u(10), height: u(4), borderRadius: u(2) },
  hint: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(15), marginTop: u(4) },
  note: { marginTop: u(12), borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(4) },
  noteT: { fontFamily: F.bodyMedium, fontSize: u(11), lineHeight: u(15) },
  noteA: { fontFamily: F.bodyBold, fontSize: u(11) },
  prize: { height: u(38), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  prizeT: { fontFamily: F.bodyBold, fontSize: u(11.5) },
  binder: { marginTop: u(14), borderWidth: 1, borderRadius: u(20), padding: u(10), flexDirection: 'row', flexWrap: 'wrap', columnGap: u(8), rowGap: u(10) },
  bName: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1), marginTop: u(5), textTransform: 'uppercase' },
  lock: { alignItems: 'center', justifyContent: 'center' },
  mSleeve: { padding: 3, backgroundColor: 'rgba(190,205,255,0.07)', borderWidth: 1, borderColor: 'rgba(200,215,255,0.22)' },
  view: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flipT: { fontFamily: F.bodyMedium, fontSize: u(11), marginTop: u(16) },
  close: { marginTop: u(10), paddingHorizontal: u(18), paddingVertical: u(8), borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  closeT: { fontFamily: F.bodySemi, fontSize: u(11), color: '#f0f2ff' },
});
