import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isBusy, onlineStatus, onlineTurn, startMatch } from './api';

/**
 * Busy line (Yazan 2026-11-01), shared by the grey lobby and the own-look lobbies.
 * The host's Start asks for a turn: if too many players are online, the room joins the line and the host's phone asks
 * again every 5 s, starting the match by itself when its turn comes. The other players see the same place in line.
 * Without the server part (SQL not pasted yet) Start works as before.
 */
export function useBusyLine({ roomId, host, inLobby, readyAll, reload, onFail }: {
  roomId: string | undefined;
  host: boolean;
  inLobby: boolean;
  readyAll: boolean;
  reload: () => Promise<unknown> | void;
  onFail: () => void;
}) {
  const [line, setLine] = useState(false);
  const [place, setPlace] = useState(0);

  const tryStart = async () => {
    if (!roomId) return;
    let go = true;
    try {
      const t = await onlineTurn(roomId);
      go = !!t.go;
      if (!go) {
        setLine(true);
        setPlace(t.place);
      }
    } catch {
      // No busy line on the server yet, or a missed call: just try to start.
    }
    if (!go) return;
    setLine(false);
    setPlace(0);
    await startMatch(roomId).catch((e) => {
      if (isBusy(e)) {
        setLine(true);
        setPlace((n) => n || 1);
      } else onFail();
    });
    await reload();
  };
  const tryRef = useRef(tryStart);
  useEffect(() => {
    tryRef.current = tryStart;
  });

  // Host: ask again every 5 s while waiting. If someone leaves or un-readies, asking pauses (the room drops out of the
  // line after 20 s) until everyone is ready again.
  useEffect(() => {
    if (!host || !line || !inLobby || !readyAll) return;
    const id = setInterval(() => void tryRef.current(), 5000);
    return () => clearInterval(id);
  }, [host, line, inLobby, readyAll]);

  // Everyone else: see the room's place while everyone is ready.
  useEffect(() => {
    if (host || !inLobby || !readyAll || !roomId) return;
    const ask = () => onlineTurn(roomId).then((t) => setPlace(t.place)).catch(() => {});
    ask();
    const id = setInterval(ask, 5000);
    return () => clearInterval(id);
  }, [host, inLobby, readyAll, roomId]);

  const show = place > 0 && inLobby && readyAll && (line || !host);
  const stop = () => {
    setLine(false);
    setPlace(0);
  };
  return { tryStart, place, show, stop };
}

/** Weekly online share: null while online is open, otherwise the day it opens again ('' if unknown). */
export function useResting() {
  const [resting, setResting] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      onlineStatus()
        .then((r) => setResting(r.open ? null : (r.day ?? '')))
        .catch(() => {});
    }, []),
  );
  return resting;
}
