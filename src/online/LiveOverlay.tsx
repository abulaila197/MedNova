import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { PlayerFace } from '@/features/style/Frame';
import { useBack } from '@/lib/useBack';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { answerWatch, leaveRoom, roomLive, type LiveInfo } from './api';
import { G } from './grey';

/** How long a 2-player match waits for a player who left (Yazan's pick #24). Matches settle_room on the server. */
const WAIT_S = 30;
/** Live phones check in this often (the server counts a phone quiet for 16 s as gone). */
const BEAT_MS = 5000;

/**
 * Over every live online match (the live page), the same for all games:
 * - #14: "Stop watching" while you only watch (Android back does the same).
 * - #24: "Waiting for … to come back · 30" in a 2-player match when the other player left or went quiet.
 * - #16: "… wants to watch your match" with Allow, Always allow and Decline.
 * It also keeps my seat: the check-in replaces the old 15 s room_ping.
 */
export function LiveOverlay({ room, game }: { room: string; game: string }) {
  const ins = useSafeAreaInsets();
  const [info, setInfo] = useState<LiveInfo | null>(null);
  const [at, setAt] = useState(0); // when `info` arrived, for the local countdown
  const [clock, setClock] = useState(0);
  const beat = useCallback(async () => {
    try {
      const r = await roomLive(room);
      const t = Date.now();
      setInfo(r);
      setAt(t);
      setClock(t);
    } catch {
      // a missed check-in; the next one tries again
    }
  }, [room]);
  useEffect(() => {
    const first = setTimeout(beat, 0);
    const id = setInterval(beat, BEAT_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [beat]);

  const waiting = info?.waiting?.[0] ?? null;
  const asks = info?.asks ?? [];
  // A one-second redraw while a countdown shows.
  useEffect(() => {
    if (!waiting && !asks.length) return;
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting, asks.length]);
  const left = waiting ? Math.max(0, Math.ceil(WAIT_S - (waiting.gone_ms + Math.max(0, clock - at)) / 1000)) : null;
  // At 0 the server settles the seat on the next check-in; ask for it right away.
  const asked = useRef(false);
  useEffect(() => {
    if (left === 0 && !asked.current) {
      asked.current = true;
      setTimeout(beat, 800);
    }
    if (left !== 0) asked.current = false;
  }, [left, beat]);

  const watching = info?.me === 'spectator';
  const stop = useCallback(async () => {
    await leaveRoom(room).catch(() => {});
    router.replace(`/play/${game}`);
  }, [room, game]);
  useBack(watching, stop);

  const [answered, setAnswered] = useState<string[]>([]);
  const ask = asks.find((a) => !answered.includes(a.id));
  const answer = async (id: string, a: 'allow' | 'always' | 'decline') => {
    setAnswered((x) => [...x, id]);
    await answerWatch(id, a).catch(() => {});
  };

  const top = (Platform.OS === 'web' ? u(30) : ins.top) + u(48);
  return (
    <>
      {watching ? (
        <Pressable onPress={stop} style={[s.stop, { top: top - u(2) }]} accessibilityRole="button" accessibilityLabel="Stop watching">
          <View style={s.eye} />
          <Text style={s.stopT}>Stop watching</Text>
        </Pressable>
      ) : null}
      {waiting && left != null ? (
        <Animated.View entering={SlideInUp.duration(300)} exiting={SlideOutUp.duration(220)} style={[s.card, { top }]} pointerEvents="none">
          <View style={s.t}>
            <Text style={s.n} numberOfLines={1}>{`Waiting for ${waiting.name} to come back…`}</Text>
            <Text style={s.d} numberOfLines={1}>{left > 0 ? `If they don’t, you win in ${left} s` : 'You win'}</Text>
          </View>
          <Text style={s.big}>{left}</Text>
        </Animated.View>
      ) : null}
      {ask ? (
        <Animated.View key={ask.id} entering={SlideInUp.duration(300)} exiting={SlideOutUp.duration(220)} style={[s.card, { top: top + (waiting ? u(64) : 0) }]}>
          <PlayerFace slug={ask.avatar} size={u(30)} still />
          <View style={s.t}>
            <Text style={s.n} numberOfLines={2}>{`${ask.name} wants to watch your match`}</Text>
            <View style={s.row}>
              <Pressable onPress={() => answer(ask.id, 'allow')} accessibilityRole="button">
                <LinearGradient colors={['#a48bff', '#6fd6ff']} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
                  <Text style={s.btnT}>Allow</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => answer(ask.id, 'always')} style={[s.btn, s.ghost]} accessibilityRole="button">
                <Text style={s.ghostT}>Always allow</Text>
              </Pressable>
              <Pressable onPress={() => answer(ask.id, 'decline')} style={[s.btn, s.ghost]} accessibilityRole="button">
                <Text style={s.ghostT}>Decline</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  stop: { position: 'absolute', left: u(12), zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: u(6), backgroundColor: 'rgba(12,14,24,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingVertical: u(6), paddingHorizontal: u(12) },
  eye: { width: u(7), height: u(7), borderRadius: u(4), backgroundColor: '#ff6b6b' },
  stopT: { fontFamily: F.bodySemi, fontSize: u(10.5), color: '#fff' },
  card: { position: 'absolute', left: u(10), right: u(10), zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: u(9), backgroundColor: G.panel, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: u(15), padding: u(10), boxShadow: '0px 14px 28px rgba(0,0,0,0.5)' },
  t: { flex: 1, minWidth: 0, gap: u(4) },
  n: { fontFamily: F.bodySemi, fontSize: u(11.5), color: G.fg },
  d: { fontFamily: F.body, fontSize: u(9.5), color: G.mute },
  big: { fontFamily: F.display, fontSize: u(26), color: G.fg, minWidth: u(34), textAlign: 'center' },
  row: { flexDirection: 'row', gap: u(6), flexWrap: 'wrap' },
  btn: { borderRadius: u(9), paddingVertical: u(5), paddingHorizontal: u(10) },
  btnT: { fontFamily: F.bodyBold, fontSize: u(10), color: '#0b0b26' },
  ghost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  ghostT: { fontFamily: F.bodySemi, fontSize: u(10), color: G.fg },
});
