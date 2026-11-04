import { Redirect, useLocalSearchParams } from 'expo-router';

import { useBack } from '@/lib/useBack';
import { LiveOverlay } from '@/online/LiveOverlay';
import { useInRoom } from '@/online/roomGuard';

import { gameDef } from '@/games/shell/registry';
import { useSession } from '@/games/shell/session';

/** Hosts a game's live online match (ON17). */
export default function LivePage() {
  const { game, room, match } = useLocalSearchParams<{ game: string; room: string; match: string }>();
  const def = gameDef(game);
  const me = useSession((s) => s.userId);
  // Any way out but Pause > Leave asks first (Yazan 2026-11-04, points 5 and 8).
  useInRoom(room, game);
  // Android back mid-match opens the game's own pause menu (useBackPause in each OnlinePlay); leaving is a choice there.
  // This catches a press before the game screen has mounted, so the page under the match isn't popped.
  useBack(!!room && !!me, () => {});
  if (!def?.Online || !room || !match) return <Redirect href="/games" />;
  if (!me) return <Redirect href="/auth" />;
  const O = def.Online;
  // LiveOverlay keeps my seat (check-in every 5 s), and adds Stop watching, the 30 s wait and watch requests.
  return (
    <>
      <O def={def} roomId={room} matchId={match} me={me} />
      <LiveOverlay room={room} game={game} />
    </>
  );
}
