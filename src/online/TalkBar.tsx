import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, MAX_FONT_SCALE } from '@/components/AppText';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, ZoomIn, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { usePathname } from 'expo-router';

import { Face } from '@/games/shell/Face';
import { PlayerFace } from '@/features/style/Frame';
import { useStyle } from '@/features/style/useStyle';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { G } from './grey';
import { guardedNav } from './roomGuard';
import { RoomLookProvider, useRoomLook, type RoomLook } from './look';
import { stickerById, STICKERS } from './stickers';
import { TEXT_PACKS } from './textStickers';
import { sendTalk, toggleMute, useTalk, useTalkFeed, type TalkMsg } from './talk';
import { VOICE, voiceById } from './voice';

export type Me = { id: string; name: string; face: string };

/** Ticks while you wait out the 3 s between sends, so the tray greys out and comes back. */
function useCooling() {
  const nextAt = useTalk((s) => s.nextAt);
  const cooling = useTalk((s) => Date.now() < s.nextAt);
  // Redraw when the cooldown runs out.
  const [, set] = useState(0);
  useEffect(() => {
    const left = nextAt - Date.now();
    if (left <= 0) return;
    const id = setTimeout(() => set((n) => n + 1), left + 30);
    return () => clearTimeout(id);
  }, [nextAt]);
  return cooling;
}

type Tab = 'sticker' | 'special' | 'voice';
/** #6 (Yazan 2026-11-02): the tray remembers its tab, pack and scroll spot while you stay in the same room. */
const memo: { room: string; tab: Tab; pk: string | null; y: Record<Tab, number> } = { room: '', tab: 'sticker', pk: null, y: { sticker: 0, special: 0, voice: 0 } };
const remember = (room: string) => {
  if (memo.room !== room) Object.assign(memo, { room, tab: 'sticker', pk: null, y: { sticker: 0, special: 0, voice: 0 } });
  return memo;
};

/** The Talk tray (ON12, locked lobby preview): your character's stickers, picture only, and the shared voice lines. */
export function TalkPanel({ room, me, onSent, maxH }: { room: string; me: Me; onSent?: () => void; maxH?: number }) {
  const L = useRoomLook();
  const m = remember(room);
  const [tab, setTabState] = useState<Tab>(m.tab);
  const setTab = (k: Tab) => ((m.tab = k), setTabState(k));
  const cooling = useCooling();
  // Bought text packs (Yazan 2026-10-13) sit in their own "Special" tab; your character's stickers stay free.
  const owned = useStyle((x) => x.owned);
  // Only your profile character's stickers in the first tab; Special holds the non-character packs you own.
  const packs = TEXT_PACKS.filter((p) => owned.includes(`pack:${p.key}`));
  const [pk, setPkState] = useState<string | null>(m.pk);
  const setPk = (k: string) => ((m.pk = k), (m.y.special = 0), setPkState(k));
  // The tray's list scrolls inside the room it has (the button can sit high or low), from where you left it.
  const bodyMax = maxH != null ? Math.max(u(110), maxH - u(48)) : undefined;
  // A plain function, not a component, so a redraw (the 3 s cooldown) keeps the same list and its scroll spot.
  const body = (k: Tab, children: React.ReactNode, style?: object) => (
    <ScrollView
      key={k}
      style={[{ maxHeight: bodyMax ?? (k === 'voice' ? u(176) : undefined) }, style]}
      contentContainerStyle={k === 'voice' ? s.vg : undefined}
      contentOffset={{ x: 0, y: m.y[k] }}
      onScroll={(e) => (m.y[k] = e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={64}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
  const pack = packs.find((p) => p.key === pk) ?? packs[0];
  const send = async (kind: TalkMsg['kind'], item: string) => {
    const r = await sendTalk(room, me, kind, item);
    if (r === 'sent') onSent?.();
  };
  return (
    <View style={s.panel}>
      <View style={s.tabs}>
        {(['sticker', 'special', 'voice'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, { borderColor: L.line }, tab === k && { backgroundColor: L.btn, borderColor: 'transparent' }]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[s.tabT, { color: tab === k ? L.onBtn : L.mute, fontFamily: L.semi }]}>{k === 'sticker' ? 'Stickers' : k === 'special' ? 'Special' : 'Voice'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'sticker' ? (
        body('sticker', (
          <View style={s.sg}>
            {(STICKERS[me.face] ?? []).map((x) => (
              <Pressable key={x.id} disabled={cooling} onPress={() => send('sticker', x.id)} style={s.sItem} accessibilityRole="button" accessibilityLabel={`Send sticker: ${x.label}`}>
                <Image source={x.src} style={s.sImg} contentFit="contain" />
              </Pressable>
            ))}
          </View>
        ), cooling ? s.cool : undefined)
      ) : tab === 'special' ? (
        pack ? (
          body('special', <View style={s.sg}>
            {packs.length > 1 ? (
              <View style={s.sets}>
                {packs.map((p) => (
                  <Pressable key={p.key} onPress={() => setPk(p.key)} style={[s.pk, { borderColor: p.key === pack.key ? L.acc : L.line }]} accessibilityRole="tab" accessibilityState={{ selected: p.key === pack.key }}>
                    <Text style={[s.pkT, { color: p.key === pack.key ? L.fg : L.mute, fontFamily: L.semi }]}>{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {pack.stickers.map((x) => (
              <Pressable key={x.id} disabled={cooling} onPress={() => send('sticker', x.id)} style={s.wItem} accessibilityRole="button" accessibilityLabel={`Send sticker: ${x.label}`}>
                <Image source={x.src} style={s.sImg} contentFit="contain" />
              </Pressable>
            ))}
          </View>, cooling ? s.cool : undefined)
        ) : (
          <Pressable onPress={() => guardedNav('/style?tab=stickers')} style={s.empty} accessibilityRole="link">
            <Text style={[s.emptyT, { color: L.mute, fontFamily: L.semi }]}>No special stickers yet.</Text>
            <Text style={[s.emptyT, { color: L.acc, fontFamily: L.semi }]}>Get packs in the Style shop or daily chests ›</Text>
          </Pressable>
        )
      ) : (
        // 19 lines since the taunts (2026-10-26): the list scrolls instead of growing the tray.
        body('voice', <>
          {VOICE.map((v) => (
            <Pressable key={v.id} disabled={cooling} onPress={() => send('voice', v.id)} style={[s.vl, { borderColor: L.line, backgroundColor: L.panel }]} accessibilityRole="button" accessibilityLabel={`Say: ${v.line}`}>
              <Text style={[s.vlI, { color: L.mute }]}>▶</Text>
              <Text style={[s.vlT, { color: L.fg, fontFamily: L.semi }]} numberOfLines={1}>{v.line}</Text>
            </Pressable>
          ))}
        </>, cooling ? s.cool : undefined)
      )}
      <Text style={[s.small, { color: L.dim, fontFamily: L.body }]}>{cooling ? 'One message every 3 seconds.' : tab === 'voice' ? 'Everyone hears the same voice.' : 'Tap a sticker to send it.'}</Text>
    </View>
  );
}

/** What a player sent: their sticker, or their voice line as a bubble. With `face`, their face rides on the corner. */
export function TalkBubble({ m, face, size = 60 }: { m: TalkMsg; face?: boolean; size?: number }) {
  const st = m.kind === 'sticker' ? stickerById.get(m.item) : null;
  const v = m.kind === 'voice' ? voiceById.get(m.item) : null;
  const L = useRoomLook();
  return (
    <Animated.View entering={ZoomIn.springify().damping(14)} exiting={FadeOut.duration(250)} style={s.bub} pointerEvents="none">
      {st ? (
        <Image source={st.src} style={{ width: u(st.wide ? size * 1.7 : size), height: u(size) }} contentFit="contain" accessibilityLabel={`${m.name}: ${st.label}`} />
      ) : v ? (
        <View style={[s.vb, { backgroundColor: L.raised }]}>
          <Text style={s.vbI}>🔊</Text>
          <Text style={[s.vbT, { color: L.fg, fontFamily: L.semi }]} numberOfLines={1}>{v.line}</Text>
        </View>
      ) : null}
      {face ? (
        <View style={[s.bf, { borderColor: L.page }]}>
          <Face slug={m.face} size={u(18)} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const BTN = 46;
/** How far under the top of its area the button starts. */
const START_DROP = 58;

/**
 * ON22: the floating chat button for in-game and results. Your character in a round button you can drag anywhere;
 * it snaps to the nearest side. Tap opens Stickers and Voice. Others' stickers and voice lines pop out beside it (ON23);
 * tap one to mute that player on your phone.
 */
export function FloatingTalk({ room, me }: { room: string; me: Me }) {
  const { width, height } = useScreen();
  const L = useRoomLook();
  const size = u(BTN);
  const edge = u(10);
  // The overlay starts under the game header, so its own height (not the window's) bounds the drag: the button
  // can no longer be dragged below the bottom edge and lost (DEF-081).
  const ins = useSafeAreaInsets();
  const boxH = useSharedValue(height);
  // #11 (Yazan 2026-11-02): from just under the game's header row down to just above the bottom edge.
  const topGap = (Platform.OS === 'web' ? u(30) : ins.top) + u(54);
  const bottomGap = Math.max(u(8), ins.bottom + u(4));
  const x = useSharedValue(width - size - edge);
  // Inspection fix A (Yazan 2026-11-02): it starts in the top corner, under the pause button, where the games keep
  // no buttons (in the middle of the side it sat on vote buttons, cards and answers).
  const y = useSharedValue(topGap + u(START_DROP));
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  // #6: the tray opens above or below the button, whichever has more room, and never runs off the screen.
  const [fan, setFan] = useState<{ up: boolean; room: number }>({ up: true, room: u(300) });
  const toggle = (yy: number, hh: number) => {
    if (!open) {
      const above = yy - topGap + u(40);
      const below = hh - yy - size - bottomGap;
      setFan(above >= below ? { up: true, room: above - u(BTN + 8) } : { up: false, room: below - u(8) });
    }
    setOpen(!open);
  };
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const pops = useTalk((st) => st.pops);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 1800);
    return () => clearTimeout(id);
  }, [note]);

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      sx.value = x.value;
      sy.value = y.value;
    })
    .onUpdate((e) => {
      x.value = sx.value + e.translationX;
      y.value = Math.min(boxH.value - size - bottomGap, Math.max(topGap, sy.value + e.translationY));
    })
    .onEnd(() => {
      const right = x.value + size / 2 > width / 2;
      x.value = withSpring(right ? width - size - edge : edge, { damping: 16 });
      runOnJS(setSide)(right ? 'right' : 'left');
    });
  const tap = Gesture.Tap().onEnd(() => runOnJS(toggle)(y.value, boxH.value));
  const btn = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));

  const mute = (m: TalkMsg) => {
    if (m.user_id === me.id) return;
    toggleMute(room, m.user_id);
    setNote(`Muted ${m.name}. Tap their face in the lobby to unmute.`);
  };
  const toSide = side === 'right' ? { right: size + u(8) } : { left: size + u(8) };

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 25 }]}
      pointerEvents="box-none"
      onLayout={(e) => {
        const hh = e.nativeEvent.layout.height;
        boxH.set(hh);
        if (y.get() > hh - size - bottomGap) y.set(Math.max(topGap, hh - size - bottomGap));
      }}>
      {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close talk" /> : null}
      <Animated.View style={[s.anchor, { width: size, height: size }, btn]} pointerEvents="box-none">
        {/* Pops and the fan open toward the middle of the screen. */}
        <View style={[s.pops, toSide, { alignItems: side === 'right' ? 'flex-end' : 'flex-start' }]} pointerEvents="box-none">
          {pops.map((m) => (
            <Pressable key={m.id} onPress={() => mute(m)} accessibilityRole="button" accessibilityLabel={`${m.name} sent this. Tap to mute`}>
              <TalkBubble m={m} face size={52} />
            </Pressable>
          ))}
        </View>
        {open ? (
          <Animated.View entering={FadeIn.duration(160)} style={[s.fan, { backgroundColor: L.raised, borderColor: L.line, maxHeight: fan.room }, fan.up ? { bottom: u(BTN + 8) } : { top: size + u(8) }, side === 'right' ? { right: 0 } : { left: 0 }]}>
            <TalkPanel room={room} me={me} onSent={() => setOpen(false)} maxH={fan.room - u(20)} />
          </Animated.View>
        ) : null}
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
          <View style={[s.fbtn, { backgroundColor: L.raised, width: size, height: size, borderRadius: size / 2 }]} accessibilityRole="button" accessibilityLabel="Talk: stickers and voice">
            <PlayerFace slug={me.face} size={size - u(8)} userId={me.id} still />
          </View>
        </GestureDetector>
      </Animated.View>
      {note ? (
        <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} entering={FadeIn} exiting={FadeOut} style={[s.note, { color: L.fg, backgroundColor: L.raised, fontFamily: L.semi }]}>
          {note}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: u(9) },
  tabs: { flexDirection: 'row', gap: u(6) },
  tab: { flex: 1, alignItems: 'center', paddingVertical: u(6), borderRadius: u(9), borderWidth: 1, borderColor: 'transparent' },
  tabT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  sg: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: u(6) },
  sItem: { width: '23%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  sets: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: u(6), marginBottom: u(2) },
  wItem: { width: '48.5%', aspectRatio: 1.7, alignItems: 'center', justifyContent: 'center' },
  pk: { borderRadius: 999, borderWidth: 1, borderColor: G.line, paddingHorizontal: u(8), paddingVertical: u(3) },
  pkT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
  empty: { alignItems: 'center', gap: u(3), paddingVertical: u(16) },
  emptyT: { fontFamily: F.bodySemi, fontSize: u(10.5), color: G.mute },
  sImg: { width: '100%', height: '100%' },
  vScroll: { maxHeight: u(176) },
  vg: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: u(6) },
  vl: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1, borderColor: G.line, backgroundColor: G.panel, borderRadius: u(10), paddingVertical: u(7), paddingHorizontal: u(9) },
  vlI: { fontSize: u(7.5), color: G.mute },
  vlT: { fontFamily: F.bodySemi, fontSize: u(10.5), color: G.fg, flexShrink: 1 },
  cool: { opacity: 0.4 },
  small: { fontFamily: F.body, fontSize: u(9), color: G.dim },
  bub: { alignItems: 'center', justifyContent: 'center' },
  vb: { flexDirection: 'row', alignItems: 'center', gap: u(5), backgroundColor: G.raised, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: u(14), paddingVertical: u(6), paddingHorizontal: u(10), boxShadow: '0px 8px 16px rgba(0,0,0,0.35)' },
  vbI: { fontSize: u(9) },
  vbT: { fontFamily: F.bodySemi, fontSize: u(11), color: G.fg },
  bf: { position: 'absolute', right: u(-4), bottom: u(-4), borderRadius: u(10), borderWidth: 1.5, borderColor: G.page },
  anchor: { position: 'absolute', left: 0, top: 0, zIndex: 25 },
  pops: { position: 'absolute', bottom: 0, width: u(180), gap: u(4) },
  fan: { position: 'absolute', width: u(250), backgroundColor: G.raised, borderWidth: 1, borderColor: G.line, borderRadius: u(16), padding: u(10), boxShadow: '0px 14px 30px rgba(0,0,0,0.45)' },
  fbtn: { backgroundColor: G.raised, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 18px rgba(0,0,0,0.45)' },
  note: { position: 'absolute', left: u(20), right: u(20), bottom: u(30), textAlign: 'center', fontFamily: F.bodySemi, fontSize: u(10), color: G.fg, backgroundColor: G.raised, borderRadius: u(10), paddingVertical: u(7), paddingHorizontal: u(10), overflow: 'hidden', zIndex: 26 },
});

type Shown = { key: number; room: string; me: Me; look: RoomLook } | null;
const useShown = create<{ on: Shown }>(() => ({ on: null }));
let nextKey = 1;

/**
 * The in-game and results talk (ON22): listens to the room and shows the floating button. #11 (Yazan 2026-11-02):
 * the button is drawn by TalkHost over the whole app window, not inside the game's own box, so in every game it can
 * go anywhere from under the header to the bottom edge (in some games it was boxed in by the scrolling body).
 */
export function RoomTalk({ room, me }: { room: string; me: Me }) {
  useTalkFeed(room, me.id);
  const look = useRoomLook();
  const [key] = useState(() => nextKey++);
  useEffect(() => {
    useShown.setState({ on: { key, room, me, look } });
  }, [key, room, me.id, me.name, me.face, look]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => useShown.setState((x) => (x.on?.key === key ? { on: null } : x)), [key]);
  return null;
}

/** Leaving a room takes its chat button away at once (17), even while the room page is still on the stack. */
export const hideRoomTalk = () => useShown.setState({ on: null });

/** The pages a room's chat button belongs to: the lobby, the live match and the online results. */
const TALK_PAGE = /^\/play\/[^/]+\/(lobby|live|results)/;

/** Mounted once in the app layout: the floating chat button of the room you are in, if any. */
export function TalkHost() {
  const on = useShown((x) => x.on);
  // 17 (Yazan 2026-11-04): a page opened over the room (menu, profile…) doesn't show the room's chat button.
  const path = usePathname();
  if (!on || !TALK_PAGE.test(path)) return null;
  return (
    <RoomLookProvider value={on.look}>
      <FloatingTalk key={on.room} room={on.room} me={on.me} />
    </RoomLookProvider>
  );
}
