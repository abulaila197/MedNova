import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { useBack } from '@/lib/useBack';
import { leaveRoom } from '@/online/api';

import { gameDef } from '@/games/shell/registry';
import { Lobby } from '@/online/Lobby';

export default function LobbyPage() {
  const { game, room } = useLocalSearchParams<{ game: string; room: string }>();
  const def = gameDef(game);
  // Android back in a lobby leaves the room, like its Leave button (PB3), so the others aren't left waiting.
  useBack(!!room, () => {
    void leaveRoom(room).catch(() => {});
    router.replace(`/play/${game}`);
  });
  if (!def || !room) return <Redirect href="/games" />;
  const L = def.screens?.Lobby ?? Lobby;
  return <L def={def} roomId={room} />;
}
