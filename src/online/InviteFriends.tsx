import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { LevelBadge } from '@/components/LevelBadge';
import { PlayerFace } from '@/features/style/Frame';
import { useAccount } from '@/state/account';
import { loadFriends, seenLabel, useFriends } from '@/state/friends';
import { u } from '@/theme/scale';

import { challengeFriend, type RoomState } from './api';
import { useRoomLook } from './look';

/**
 * #50 (Yazan 2026-10-26): an empty seat's Invite lists your friends in the app, online ones first. Inviting sends the
 * same challenge as the Friends page, into this room (challenge_friend reuses your open lobby of this game).
 */
export function InviteFriends({ state }: { state: RoomState }) {
  const L = useRoomLook();
  const avatar = useAccount((a) => a.profile?.avatar);
  const list = useFriends((x) => x.list);
  const [sent, setSent] = useState<Record<string, 'busy' | 'sent' | 'error'>>({});
  useEffect(() => {
    loadFriends().catch(() => {});
  }, []);
  const inRoom = new Set(state.players.map((p) => p.user_id));
  const friends = list
    .filter((f) => f.kind === 'friend' && !inRoom.has(f.id))
    .map((f) => ({ f, on: seenLabel(f.last_seen) === 'ONLINE' }))
    .sort((a, b) => Number(b.on) - Number(a.on));
  const invite = async (id: string) => {
    setSent((x) => ({ ...x, [id]: 'busy' }));
    try {
      const r = await challengeFriend(id, state.room.game, state.room.settings, avatar);
      setSent((x) => ({ ...x, [id]: r.result === 'sent' ? 'sent' : 'error' }));
    } catch {
      setSent((x) => ({ ...x, [id]: 'error' }));
    }
  };
  return (
    <>
      <Text style={[s.k, { fontFamily: L.semi, color: L.mute }]}>INVITE A FRIEND</Text>
      {!friends.length ? <Text style={[s.note, { fontFamily: L.body, color: L.mute }]}>No friends to invite yet. Use Share to send the room code instead.</Text> : null}
      {friends.map(({ f, on }) => {
        const st = sent[f.id];
        return (
          <View key={f.id} style={[s.row, { borderColor: L.line }]}>
            <PlayerFace slug={f.avatar} size={u(26)} userId={f.id} still />
            <View style={s.mid}>
              <View style={s.nm}>
                <Text style={[s.name, { fontFamily: L.semi, color: L.fg }]} numberOfLines={1}>{f.display_name}</Text>
                <LevelBadge level={f.level} size={u(12)} />
              </View>
              <Text style={[s.seen, { fontFamily: L.mono, color: on ? L.ok : L.dim }]}>{seenLabel(f.last_seen)}</Text>
            </View>
            <Pressable
              disabled={st === 'busy' || st === 'sent'}
              onPress={() => invite(f.id)}
              style={[s.btn, { backgroundColor: st === 'sent' ? 'transparent' : L.btn, borderColor: st === 'sent' ? L.line : 'transparent' }]}
              accessibilityRole="button"
              accessibilityLabel={`Invite ${f.display_name}`}>
              <Text style={[s.btnT, { fontFamily: L.semi, color: st === 'sent' ? L.mute : L.onBtn }]}>{st === 'sent' ? 'Invited' : st === 'busy' ? '…' : st === 'error' ? 'Retry' : 'Invite'}</Text>
            </Pressable>
          </View>
        );
      })}
      <Text style={[s.note, { fontFamily: L.body, color: L.dim }]}>They get a pop-up with Join, and it waits on their Friends page for 10 minutes.</Text>
    </>
  );
}

const s = StyleSheet.create({
  k: { fontSize: u(9), letterSpacing: u(1.4) },
  note: { fontSize: u(10), lineHeight: u(14) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(8), borderBottomWidth: 1 },
  mid: { flex: 1, minWidth: 0 },
  nm: { flexDirection: 'row', alignItems: 'center', gap: u(5) },
  name: { fontSize: u(12.5), flexShrink: 1 },
  seen: { marginTop: u(2), fontSize: u(7.5), letterSpacing: u(1) },
  btn: { borderWidth: 1, borderRadius: u(10), paddingVertical: u(6), paddingHorizontal: u(12) },
  btnT: { fontSize: u(10.5) },
});
