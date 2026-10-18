import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useBack } from '@/lib/useBack';
import { call, leaveRoom } from '@/online/api';

import { gameDef } from '@/games/shell/registry';
import { useSession } from '@/games/shell/session';

/** Hosts a game's live online match (ON17). */
export default function LivePage() {
  const { game, room, match } = useLocalSearchParams<{ game: string; room: string; match: string }>();
  const def = gameDef(game);
  const me = useSession((s) => s.userId);
  // Keeps my seat (the server drops a player it hasn't heard from in 60 s).
  useEffect(() => {
    if (!room) return;
    const ping = () => call('room_ping', { r: room }).catch(() => {});
    ping();
    const id = setInterval(ping, 15_000);
    return () => clearInterval(id);
  }, [room]);
  // Android back mid-match asks first, then gives the seat up properly instead of holding it for 60 s (PB3).
  // A sheet open in the game (Pause, Report) closes first: its listener is newer.
  useBack(!!room && !!me, () =>
    Alert.alert('Leave the match?', 'You will leave this room.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveRoom(room).catch(() => {});
          router.replace(`/play/${game}`);
        },
      },
    ]),
  );
  if (!def?.Online || !room || !match) return <Redirect href="/games" />;
  if (!me) return <Redirect href="/auth" />;
  const O = def.Online;
  return <O def={def} roomId={room} matchId={match} me={me} />;
}
