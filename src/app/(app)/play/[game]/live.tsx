import { Redirect, useLocalSearchParams } from 'expo-router';

import { gameDef } from '@/games/shell/registry';
import { useSession } from '@/games/shell/session';

/** Hosts a game's live online match (ON17). */
export default function LivePage() {
  const { game, room, match } = useLocalSearchParams<{ game: string; room: string; match: string }>();
  const def = gameDef(game);
  const me = useSession((s) => s.userId);
  if (!def?.Online || !room || !match) return <Redirect href="/games" />;
  if (!me) return <Redirect href="/auth" />;
  const O = def.Online;
  return <O def={def} roomId={room} matchId={match} me={me} />;
}
