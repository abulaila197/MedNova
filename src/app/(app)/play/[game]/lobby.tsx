import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { useBack } from '@/lib/useBack';
import { guarded, useInRoom } from '@/online/roomGuard';

import { gameDef } from '@/games/shell/registry';
import { Lobby } from '@/online/Lobby';

export default function LobbyPage() {
  const { game, room } = useLocalSearchParams<{ game: string; room: string }>();
  const def = gameDef(game);
  useInRoom(room, game);
  // Android back in a lobby asks "Leave the room?" first (Yazan 2026-11-04, point 8); Leave tells the server.
  useBack(!!room, () => guarded(() => router.replace(`/play/${game}`)));
  if (!def || !room) return <Redirect href="/games" />;
  const L = def.screens?.Lobby ?? Lobby;
  return <L def={def} roomId={room} />;
}
