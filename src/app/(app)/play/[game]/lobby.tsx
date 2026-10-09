import { Redirect, useLocalSearchParams } from 'expo-router';

import { gameDef } from '@/games/shell/registry';
import { Lobby } from '@/online/Lobby';

export default function LobbyPage() {
  const { game, room } = useLocalSearchParams<{ game: string; room: string }>();
  const def = gameDef(game);
  if (!def || !room) return <Redirect href="/games" />;
  return <Lobby def={def} roomId={room} />;
}
