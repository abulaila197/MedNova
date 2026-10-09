import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, ZoomIn, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Face } from '@/games/shell/Face';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { G } from './grey';
import { stickerById, STICKERS } from './stickers';
import { sendTalk, toggleMute, useTalk, useTalkFeed, type TalkMsg } from './talk';
import { VOICE, voiceById } from './voice';

export type Me = { id: string; name: string; face: string };

/** Ticks while you wait out the 3 s between sends, so the tray greys out and comes back. */
function useCooling() {
  const nextAt = useTalk((s) => s.nextAt);
  const [, set] = useState(0);
  useEffect(() => {
    const left = nextAt - Date.now();
    if (left <= 0) return;
    const id = setTimeout(() => set((n) => n + 1), left + 30);
    return () => clearTimeout(id);
  }, [nextAt]);
  return Date.now() < nextAt;
}

/** The Talk tray (ON12, locked lobby preview): your character's stickers, picture only, and the shared voice lines. */
export function TalkPanel({ room, me, onSent }: { room: string; me: Me; onSent?: () => void }) {
  const [tab, setTab] = useState<'sticker' | 'voice'>('sticker');
  const cooling = useCooling();
  const send = async (kind: TalkMsg['kind'], item: string) => {
    const r = await sendTalk(room, me, kind, item);
    if (r === 'sent') onSent?.();
  };
  return (
    <View style={s.panel}>
      <View style={s.tabs}>
        {(['sticker', 'voice'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[s.tabT, { color: tab === k ? G.onBtn : G.mute }]}>{k === 'sticker' ? 'Stickers' : 'Voice'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'sticker' ? (
        <View style={[s.sg, cooling && s.cool]}>
          {(STICKERS[me.face] ?? []).map((x) => (
            <Pressable key={x.id} disabled={cooling} onPress={() => send('sticker', x.id)} style={s.sItem} accessibilityRole="button" accessibilityLabel={`Send sticker: ${x.label}`}>
              <Image source={x.src} style={s.sImg} contentFit="contain" />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[s.vg, cooling && s.cool]}>
          {VOICE.map((v) => (
            <Pressable key={v.id} disabled={cooling} onPress={() => send('voice', v.id)} style={s.vl} accessibilityRole="button" accessibilityLabel={`Say: ${v.line}`}>
              <Text style={s.vlI}>▶</Text>
              <Text style={s.vlT} numberOfLines={1}>{v.line}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={s.small}>{cooling ? 'One message every 3 seconds.' : tab === 'voice' ? 'Everyone hears the same voice.' : 'Tap a sticker to send it.'}</Text>
    </View>
  );
}

/** What a player sent: their sticker, or their voice line as a bubble. With `face`, their face rides on the corner. */
export function TalkBubble({ m, face, size = 60 }: { m: TalkMsg; face?: boolean; size?: number }) {
  const st = m.kind === 'sticker' ? stickerById.get(m.item) : null;
  const v = m.kind === 'voice' ? voiceById.get(m.item) : null;
  return (
    <Animated.View entering={ZoomIn.springify().damping(14)} exiting={FadeOut.duration(250)} style={s.bub} pointerEvents="none">
      {st ? (
        <Image source={st.src} style={{ width: u(size), height: u(size) }} contentFit="contain" accessibilityLabel={`${m.name}: ${st.label}`} />
      ) : v ? (
        <View style={s.vb}>
          <Text style={s.vbI}>🔊</Text>
          <Text style={s.vbT} numberOfLines={1}>{v.line}</Text>
        </View>
      ) : null}
      {face ? (
        <View style={s.bf}>
          <Face slug={m.face} size={u(18)} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const BTN = 46;

/**
 * ON22: the floating chat button for in-game and results. Your character in a round button you can drag anywhere;
 * it snaps to the nearest side. Tap opens Stickers and Voice. Others' stickers and voice lines pop out beside it (ON23);
 * tap one to mute that player on your phone.
 */
export function FloatingTalk({ room, me }: { room: string; me: Me }) {
  const { width, height } = useWindowDimensions();
  const size = u(BTN);
  const edge = u(10);
  const x = useSharedValue(width - size - edge);
  const y = useSharedValue(height * 0.6);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
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
      y.value = Math.min(height - size - u(20), Math.max(u(70), sy.value + e.translationY));
    })
    .onEnd(() => {
      const right = x.value + size / 2 > width / 2;
      x.value = withSpring(right ? width - size - edge : edge, { damping: 16 });
      runOnJS(setSide)(right ? 'right' : 'left');
    });
  const tap = Gesture.Tap().onEnd(() => runOnJS(setOpen)(!open));
  const btn = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));

  const mute = (m: TalkMsg) => {
    if (m.user_id === me.id) return;
    toggleMute(room, m.user_id);
    setNote(`Muted ${m.name}. Tap their face in the lobby to unmute.`);
  };
  const toSide = side === 'right' ? { right: size + u(8) } : { left: size + u(8) };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 25 }]} pointerEvents="box-none">
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
          <Animated.View entering={FadeIn.duration(160)} style={[s.fan, side === 'right' ? { right: 0 } : { left: 0 }]}>
            <TalkPanel room={room} me={me} onSent={() => setOpen(false)} />
          </Animated.View>
        ) : null}
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
          <View style={[s.fbtn, { width: size, height: size, borderRadius: size / 2 }]} accessibilityRole="button" accessibilityLabel="Talk: stickers and voice">
            <Face slug={me.face} size={size - u(8)} />
          </View>
        </GestureDetector>
      </Animated.View>
      {note ? (
        <Animated.Text entering={FadeIn} exiting={FadeOut} style={s.note}>
          {note}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: u(9) },
  tabs: { flexDirection: 'row', gap: u(6) },
  tab: { flex: 1, alignItems: 'center', paddingVertical: u(6), borderRadius: u(9), borderWidth: 1, borderColor: G.line },
  tabOn: { backgroundColor: G.btn, borderColor: 'transparent' },
  tabT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  sg: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: u(6) },
  sItem: { width: '23%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  sImg: { width: '100%', height: '100%' },
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
  fan: { position: 'absolute', bottom: u(BTN + 8), width: u(250), backgroundColor: G.raised, borderWidth: 1, borderColor: G.line, borderRadius: u(16), padding: u(10), boxShadow: '0px 14px 30px rgba(0,0,0,0.45)' },
  fbtn: { backgroundColor: G.raised, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 18px rgba(0,0,0,0.45)' },
  note: { position: 'absolute', left: u(20), right: u(20), bottom: u(30), textAlign: 'center', fontFamily: F.bodySemi, fontSize: u(10), color: G.fg, backgroundColor: G.raised, borderRadius: u(10), paddingVertical: u(7), paddingHorizontal: u(10), overflow: 'hidden', zIndex: 26 },
});

/** The in-game and results talk (ON22): listens to the room and shows the floating button. */
export function RoomTalk({ room, me }: { room: string; me: Me }) {
  useTalkFeed(room, me.id);
  return <FloatingTalk room={room} me={me} />;
}
