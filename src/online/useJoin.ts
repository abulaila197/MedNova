import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { GameDef } from '@/games/shell/types';
import { useAccount } from '@/state/account';

import { JOIN_SAY, listPublicRooms, type JoinResult, type PublicRoom } from './api';

/** Into a room's lobby. */
export const lobbyOf = (def: GameDef, id: string) => router.replace(`/play/${def.key}/lobby?room=${id}`);

/** A join attempt (by code or from the open list): on success go to the lobby, otherwise say why (JOIN_SAY). */
export function useJoin(def: GameDef) {
  const avatar = useAccount((a) => a.profile?.avatar);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (fn: (avatar?: string) => Promise<JoinResult>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn(avatar);
      if ((r.result === 'joined' || r.result === 'spectating') && r.room_id) lobbyOf(def, r.room_id);
      else setMsg(JOIN_SAY[r.result] ?? JOIN_SAY.error);
    } catch {
      setMsg(JOIN_SAY.error);
    }
    setBusy(false);
  };
  return { msg, setMsg, busy, go };
}

/** The game's open public rooms, refreshed every 8 s while the page is open. */
export function useOpenRooms(def: GameDef) {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const refresh = useCallback(() => {
    listPublicRooms(def.key).then(setRooms).catch(() => setRooms([]));
  }, [def.key]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(refresh, 8000);
      return () => clearInterval(id);
    }, [refresh]),
  );
  return { rooms, refresh };
}
