import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { Display } from '@/components/Txt';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { leaveRoom, roomState } from './api';
import { hideRoomTalk } from './TalkBar';

/**
 * Leaving a room (Yazan 2026-11-04, points 5, 8, 17): while you sit in an online lobby or a live match, any way out
 * except the game's own Pause > Leave and the lobby's Leave room button asks "Leave the room?" first. Yes tells the
 * server you left (the host passes on, an empty room closes), takes the room pages off the stack and opens what you
 * tapped. A pop-up over the room (report, a player's card, the chat tray) is not a way out and never asks.
 */
type In = { key: number; room: string; game: string };
type Ask = { go: () => void; note: string | null };
const useGuard = create<{ on: In | null; ask: Ask | null }>(() => ({ on: null, ask: null }));
let nextKey = 1;

/** A room page (lobby, live match) says you are in the room while it is mounted. */
export function useInRoom(room: string | undefined, game: string) {
  const [key] = useState(() => nextKey++);
  useEffect(() => {
    if (!room) return;
    useGuard.setState({ on: { key, room, game } });
    return () => useGuard.setState((x) => (x.on?.key === key ? { on: null, ask: null } : x));
  }, [key, room, game]);
}

/** The room pages of a game: its lobby and live match (results come after the match and are free to leave). */
const roomPath = (path: string, game: string) => path.startsWith(`/play/${game}/lobby`) || path.startsWith(`/play/${game}/live`);

/** What leaving does to the room, for the host: who takes over, or that it closes. */
async function hostNote(room: string): Promise<string | null> {
  try {
    const st = await roomState(room);
    if (st.result !== 'ok' || st.room.host !== st.me) return null;
    const others = st.players.filter((p) => p.user_id !== st.me);
    // Same order as the server's drop_player: first player still in, then first spectator.
    const next = others.find((p) => p.state === 'in') ?? others.find((p) => p.state === 'spectator');
    return next ? `You’re the host. ${next.name} becomes the host.` : 'You’re the host. The room will close.';
  } catch {
    return null;
  }
}

/** The host line under the Leave room button: refreshes with the room's seats. */
export function hostLeaveNote(host: boolean, others: { name: string; state: string }[]) {
  if (!host) return null;
  const next = others.find((p) => p.state === 'in') ?? others.find((p) => p.state === 'spectator');
  return next ? `If you leave, ${next.name} becomes the host` : 'If you leave, the room closes';
}

/** Runs `go` straight away outside a room; inside one, asks first. */
export function guarded(go: () => void) {
  const on = useGuard.getState().on;
  if (!on) return go();
  useGuard.setState({ ask: { go, note: null } });
  void hostNote(on.room).then((note) => useGuard.setState((x) => (x.ask && x.on?.room === on.room ? { ask: { ...x.ask, note } } : x)));
}

/** `router.navigate` that asks first while you are in a room. */
export const guardedNav = (to: string) => guarded(() => router.navigate(to as never));

/** True while a room page is open (for buttons that should only ask, not act, in a room). */
export const inRoom = () => !!useGuard.getState().on;

async function leaveAndGo(ask: Ask) {
  const on = useGuard.getState().on;
  useGuard.setState({ on: null, ask: null });
  hideRoomTalk();
  if (on) {
    await leaveRoom(on.room).catch(() => {});
    // Take the room pages off the stack (they would keep the seat alive underneath), then open what was tapped.
    router.dismissTo(`/play/${on.game}` as never);
  }
  setTimeout(ask.go, 60);
}

/** Mounted once in the app layout: the "Leave the room?" sheet, and the safety net for any way out that didn't ask. */
export function RoomGuardHost() {
  const t = useTheme();
  const on = useGuard((x) => x.on);
  const ask = useGuard((x) => x.ask);
  const path = usePathname();
  // Safety net: a page opened over the room without asking still leaves it, so the seat, the public listing and the
  // chat button don't stay behind (17).
  const last = useRef(path);
  useEffect(() => {
    if (last.current === path) return;
    last.current = path;
    const cur = useGuard.getState().on;
    if (cur && !roomPath(path, cur.game)) {
      useGuard.setState({ on: null, ask: null });
      hideRoomTalk();
      void leaveRoom(cur.room).catch(() => {});
    }
  }, [path]);
  const stay = () => useGuard.setState({ ask: null });
  return (
    <Sheet open={!!ask && !!on} onClose={stay}>
      <Text style={[s.k, { color: t.accent }]}>ONLINE ROOM</Text>
      <Display style={[s.h, { color: t.white }]}>Leave the room?</Display>
      <Text style={[s.p, { color: t.mute }]}>{ask?.note ?? 'You’ll leave the room and lose your seat.'}</Text>
      <View style={s.row}>
        <Pressable onPress={stay} style={[s.btn, s.ghost, { borderColor: t.panelLine }]} accessibilityRole="button">
          <Text style={[s.btnT, { color: t.fg }]}>Stay</Text>
        </Pressable>
        <Pressable onPress={() => ask && void leaveAndGo(ask)} style={s.grow} accessibilityRole="button">
          <LinearGradient colors={['#a48bff', '#6fd6ff']} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
            <Text style={[s.btnT, { color: '#0b0b26' }]}>Leave</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  k: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7), marginTop: u(6) },
  h: { fontSize: u(24), lineHeight: u(28), letterSpacing: u(-0.24) },
  p: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  row: { flexDirection: 'row', gap: u(8), marginTop: u(6) },
  grow: { flex: 1 },
  btn: { borderRadius: 999, paddingVertical: u(10), alignItems: 'center', justifyContent: 'center' },
  ghost: { flex: 1, borderWidth: 1 },
  btnT: { fontFamily: F.bodyBold, fontSize: u(11.5) },
});
