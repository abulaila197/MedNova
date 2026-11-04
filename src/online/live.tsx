import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';

import { PlayerFace } from '@/features/style/Frame';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { leaveRoom } from './api';
import { G } from './grey';

/** #13 (Yazan: 5 s): how long after the countdown ends the match may take to start before the phone says so. */
const STUCK_MS = 5000;

/** ON8 / DPN7: a pill slides in under the header for a big moment ("Sara solved it, 2nd"), then fades after 2 s. */
export function useAlerts() {
  const [alert, setAlert] = useState<{ id: number; text: string; color: string } | null>(null);
  const n = useRef(0);
  useEffect(() => {
    if (!alert) return;
    const id = setTimeout(() => setAlert((a) => (a?.id === alert.id ? null : a)), 2000);
    return () => clearTimeout(id);
  }, [alert]);
  return { alert, push: (text: string, color: string) => setAlert({ id: ++n.current, text, color }) };
}

export function AlertPill({ alert }: { alert: { id: number; text: string; color: string } | null }) {
  const t = useTheme();
  if (!alert) return null;
  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.View key={alert.id} entering={SlideInUp.duration(260)} exiting={FadeOut.duration(300)} style={[s.pill, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
        <View style={[s.dot, { backgroundColor: alert.color }]} />
        <Text style={[s.pillT, { color: t.fg }]}>{alert.text}</Text>
      </Animated.View>
    </View>
  );
}

/** ON16: the 3-2-1 before the first case, with everyone's faces, in the online grey. */
// #13: if the match still hasn't started 5 s after the count ends (the game keeps checking the server every
// second meanwhile), it says so with a Leave button instead of standing on "1" for ever.
// #12 (Yazan 2026-11-04): a game whose first round comes from a referee that may need waking (Wheels) passes
// `dealing` ("Dealing the cards…" shows at 0) and a longer wait before the Leave screen.
export function Countdown({ ms, faces, ids, line, dealing, stuckMs = STUCK_MS }: { ms: number; faces: string[]; ids?: string[]; line: string; dealing?: string; stuckMs?: number }) {
  const { game, room } = useLocalSearchParams<{ game?: string; room?: string }>();
  const done = ms <= 0;
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setStuck(true), stuckMs);
    return () => {
      clearTimeout(id);
      setStuck(false);
    };
  }, [done, stuckMs]);
  const leave = async () => {
    if (room) await leaveRoom(room).catch(() => {});
    router.replace(game ? `/play/${game}` : '/games');
  };
  if (stuck) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.cd]}>
        <Text style={[s.cdK, { color: G.mute }]}>MATCH DIDN’T START</Text>
        <Text style={[s.stuckT, { color: G.fg }]}>Couldn’t start the match.</Text>
        <Text style={[s.cdL, { color: G.mute, textAlign: 'center', maxWidth: u(240) }]}>The server didn’t deal the first round. Check your connection, then try again from the room.</Text>
        <Pressable onPress={leave} style={[s.leave, { borderColor: 'rgba(255,255,255,0.3)' }]} accessibilityRole="button">
          <Text style={[s.leaveT, { color: G.fg }]}>Leave</Text>
        </Pressable>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.cd]}>
      <Text style={[s.cdK, { color: G.mute }]}>MATCH STARTING</Text>
      {done && dealing ? <Text style={[s.stuckT, { color: G.fg, marginVertical: u(30) }]}>{dealing}</Text> : <Text style={[s.cdN, { color: G.fg }]}>{Math.max(1, Math.ceil(ms / 1000))}</Text>}
      <View style={s.cdF}>
        {faces.map((f, i) => (
          <PlayerFace key={i} slug={f} size={u(28)} userId={ids?.[i]} still />
        ))}
      </View>
      <Text style={[s.cdL, { color: G.mute }]}>{line}</Text>
    </Animated.View>
  );
}

/** "1st", "2nd", "3rd", "4th"… */
export const nth = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: u(4), left: 0, right: 0, alignItems: 'center', zIndex: 15 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: u(7), borderWidth: 1, borderRadius: 999, paddingVertical: u(6), paddingHorizontal: u(12), boxShadow: '0px 8px 18px rgba(0,0,0,0.3)' },
  dot: { width: u(7), height: u(7), borderRadius: u(4) },
  pillT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  cd: { backgroundColor: 'rgba(30,32,36,0.92)', alignItems: 'center', justifyContent: 'center', gap: u(10), zIndex: 30 },
  cdK: { fontFamily: F.bodySemi, fontSize: u(9), letterSpacing: u(1.4) },
  cdN: { fontFamily: F.display, fontSize: u(90), lineHeight: u(100) },
  cdF: { flexDirection: 'row', gap: u(6) },
  cdL: { fontFamily: F.body, fontSize: u(10.5) },
  stuckT: { fontFamily: F.display, fontSize: u(20) },
  leave: { marginTop: u(8), borderWidth: 1, borderRadius: 999, paddingVertical: u(8), paddingHorizontal: u(26) },
  leaveT: { fontFamily: F.bodySemi, fontSize: u(11.5) },
});
