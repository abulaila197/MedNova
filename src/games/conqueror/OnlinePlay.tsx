// The Conqueror Online (CQ1): the whole match on everyone's own phone. The server referees (the conqueror edge
// function) and this screen polls the match every second, draws the page for the current phase, and sends only my
// own actions. The map is drawn on each phone from the match id, so every player sees the same continent (CQ21).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { call } from '@/online/api';
import { settingsLine } from '@/online/format';
import { AlertPill, Countdown, useAlerts } from '@/online/live';
import { RoomTalk } from '@/online/Talk';
import { u } from '@/theme/scale';

import type { OnlineProps } from '../shell/types';
import { AT, AtlasScreen, CGI, T } from './atlas';
import type { Match } from './core';
import { makeMap, seedOf } from './map';
import { BoardPage, MovesPage, type Act } from './pages';

type CPlayer = { user_id: string; name: string; character: string; dropped: boolean; rank: number | null };
type CState = {
  now: number;
  room_id: string;
  phase: 'countdown' | 'case' | 'done';
  phase_ends_at: number;
  settings: Record<string, unknown>;
  players: CPlayer[];
  version: number;
  /** The match as this player may see it (rivals' hidden numbers, tiles and answers are masked). */
  state: { m: Match; deadline: number | null } | null;
};

export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const [st, setSt] = useState<CState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const offset = useRef(0);
  const busy = useRef(false);
  const { alert } = useAlerts();

  const load = useCallback(async () => {
    try {
      const s = await call<CState>('cq_state', { m: matchId });
      offset.current = s.now - Date.now();
      setSt(s);
    } catch {
      setNotice('Reconnecting…');
    }
  }, [matchId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 1000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => (clearInterval(poll), clearInterval(tick));
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(id);
  }, [notice]);

  const act: Act = useCallback(
    async (action) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const { error } = await supabase.functions.invoke('conqueror', { body: { m: matchId, action } });
        if (error) throw error;
      } catch {
        setNotice('Couldn’t send that. Check your connection.');
      } finally {
        busy.current = false;
        load();
      }
    },
    [matchId, load],
  );

  const m = st?.state?.m ?? null;
  const players = m?.order.length ?? 0;
  const map = useMemo(() => (players ? makeMap(seedOf(matchId), players) : null), [matchId, players]);
  const server = now + offset.current;
  const deadline = st?.state?.deadline ?? null;
  const seconds = deadline ? Math.max(0, (deadline - server) / 1000) : null;
  const meTalk = st?.players.find((p) => p.user_id === me);

  const extras = (
    <>
      <AlertPill alert={alert} />
      <RoomTalk room={roomId} me={{ id: me, name: meTalk?.name ?? 'You', face: meTalk?.character ?? 'yara' }} />
      {notice ? (
        <View style={{ position: 'absolute', bottom: u(90), left: u(16), right: u(16), alignItems: 'center' }} pointerEvents="none">
          <View style={{ backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: u(10), padding: u(8) }}>
            <T size={13} color={AT.cream}>{notice}</T>
          </View>
        </View>
      ) : null}
    </>
  );

  if (!st) return <AtlasScreen>{null}</AtlasScreen>;
  if (!m || !map) {
    return (
      <AtlasScreen>
        {st.phase === 'done' ? null : <Countdown ms={Math.max(0, st.phase_ends_at - server)} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />}
        {extras}
      </AtlasScreen>
    );
  }

  const props = { m, me, map, seconds, act };
  let body: React.ReactNode;
  if (m.phase === 'solo_pick') body = <BoardPage {...props} />;
  else if (m.phase === 'gap_moves') body = <MovesPage {...props} />;
  else body = <T f={CGI} size={17} color={AT.soft} style={{ textAlign: 'center', marginTop: u(140) }}>This page comes next.</T>;

  return (
    <AtlasScreen>
      {body}
      {extras}
    </AtlasScreen>
  );
}
