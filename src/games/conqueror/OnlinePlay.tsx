// The Conqueror Online (CQ1): the whole match on everyone's own phone. The server referees (the conqueror edge
// function) and this screen polls the match every second, draws the page for the current phase, and sends only my
// own actions. The map is drawn on each phone from the match id, so every player sees the same continent (CQ21).
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { call, leaveRoom } from '@/online/api';
import { finishOnline, playForMatch } from '@/online/finish';
import { settingsLine } from '@/online/format';
import { AlertPill, Countdown, useAlerts } from '@/online/live';
import { RoomTalk } from '@/online/Talk';
import { u } from '@/theme/scale';

import type { OnlineProps } from '../shell/types';
import { AT, AtlasPause, AtlasScreen, CGI, KINGDOMS, PauseCtx, T } from './atlas';
import { standings } from './core';
import { makeMap, seedOf } from './map';
import { BoardPage, MovesPage, type Act } from './pages';
import { CardsPage, DuelPage, HoldPage, OutBanner, SoloPage, VersusPage, type Hold } from './play';
import type { MatchView } from './view';
import { keepSame, oneAtATime } from '@/online/poll';

type CPlayer = { user_id: string; name: string; character: string; dropped: boolean; rank: number | null };
type CState = {
  now: number;
  room_id: string;
  phase: 'countdown' | 'case' | 'done';
  phase_ends_at: number;
  settings: Record<string, unknown>;
  players: CPlayer[];
  version: number;
  /** The match as this player may see it (view.ts): rivals' secrets and right answers stay on the server. */
  state: { m: MatchView; deadline: number | null; started: number; holds: Hold[] } | null;
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
      setSt((prev) => keepSame(prev, s));
    } catch {
      setNotice('Reconnecting…');
    }
  }, [matchId]);

  useEffect(() => {
    load();
    const poll = setInterval(oneAtATime(load), 1000);
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
  /** A nudge when a clock has run out, so the referee moves the war on (the countdown's end deals the first board). */
  const lastTick = useRef(0);
  const tick = useCallback(async () => {
    if (Date.now() - lastTick.current < 1200) return;
    lastTick.current = Date.now();
    try {
      await supabase.functions.invoke('conqueror', { body: { m: matchId, action: { type: 'tick' } } });
    } catch {
      // The next poll tries again.
    } finally {
      load();
    }
  }, [matchId, load]);

  const m = st?.state?.m ?? null;
  const players = m?.order.length ?? 0;
  const map = useMemo(() => (players ? makeMap(seedOf(matchId), players) : null), [matchId, players]);
  const server = now + offset.current;
  const deadline = st?.state?.deadline ?? null;
  const seconds = deadline ? Math.max(0, (deadline - server) / 1000) : null;
  const meTalk = st?.players.find((p) => p.user_id === me);
  // The talk button steps aside while I answer, so it never covers a choice (as in Wheels and Crossword).
  const mm = st?.state?.m;
  const answering = !!mm && !mm.players[me]?.out && (mm.phase === 'solo_play' || mm.phase === 'versus' || (mm.phase === 'duel' && [mm.duels[mm.duelIndex]?.p1, mm.duels[mm.duelIndex]?.p2].includes(me)));
  const hold = st?.state?.holds.find((h) => h.until > server) ?? null;

  // The first phone in the seating nudges as soon as a clock runs out, the others a moment later in case it went quiet.
  const seat = Math.max(0, st?.players.findIndex((p) => p.user_id === me) ?? 0);
  useEffect(() => {
    if (!st || st.phase === 'done') return;
    const due = st.state ? st.state.deadline : st.phase_ends_at;
    if (due != null && server >= due + seat * 1500) tick();
  }, [server, st, seat, tick]);
  const elapsed = st?.state ? Math.max(0, server - st.state.started) : 0;

  // The end: the final places become an ordinary play on this phone (ON21), paying EXP for my right answers.
  const finishing = useRef(false);
  useEffect(() => {
    if (!st || st.phase !== 'done' || !m || finishing.current || !m.players[me]) return;
    finishing.current = true;
    (async () => {
      const order = standings(m).map((p) => p.id);
      const local = [me, ...m.order.filter((id) => id !== me)];
      const seats = local.map((id, i) => ({ seat: i, name: id === me ? 'You' : m.players[id].name, character: st.players.find((x) => x.user_id === id)?.character, color: KINGDOMS[m.order.indexOf(id) % KINGDOMS.length] }));
      const stand = local.map((id, i) => ({ seat: i, name: seats[i].name, score: m.landOrder.filter((l) => m.lands[l].owner === id).length, timeMs: 0, rank: order.indexOf(id) + 1 })).sort((a, b) => a.rank - b.rank);
      const id = await finishOnline(def, matchId, { settings: { ...st.settings, room: roomId, match: matchId, right: m.players[me].stats.right ?? 0 }, seats, standings: stand, score: stand.find((x) => x.seat === 0)?.score ?? 0, items: [] });
      router.replace(`/play/${def.key}/results?play=${id}`);
    })();
  }, [st, m, me, def, roomId, matchId]);
  useEffect(() => {
    playForMatch(matchId).then((id) => id && st?.phase === 'done' && router.replace(`/play/${def.key}/results?play=${id}`));
  }, [matchId, st?.phase, def.key]);
  const [menu, setMenu] = useState(false);
  const pause = useCallback(() => setMenu(true), []);
  const leave = useCallback(async () => {
    await leaveRoom(roomId).catch(() => {});
    router.replace(`/play/${def.key}`);
  }, [roomId, def.key]);

  const extras = (
    <>
      <AlertPill alert={alert} />
      {answering ? null : <RoomTalk room={roomId} me={{ id: me, name: meTalk?.name ?? 'You', face: meTalk?.character ?? 'yara' }} />}
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

  const props = { m, me, map, seconds, act, elapsed };
  const out = m.players[me]?.out;
  let body: React.ReactNode;
  if (hold) body = <HoldPage m={m} me={me} map={map} hold={hold} seconds={Math.max(0, (hold.until - server) / 1000)} />;
  else if (m.phase === 'over') body = <T f={CGI} size={18} color={AT.gold} style={{ textAlign: 'center', marginTop: u(140) }}>The war is over…</T>;
  else if (m.phase === 'duel') body = <DuelPage {...props} />;
  else if (out) body = <><OutBanner m={m} me={me} /><MovesWatch {...props} /></>;
  else if (m.phase === 'solo_pick') body = <BoardPage {...props} />;
  else if (m.phase === 'solo_play') body = <SoloPage {...props} />;
  else if (m.phase === 'versus') body = <VersusPage {...props} />;
  else if (m.phase === 'gap_cards') body = <CardsPage {...props} />;
  else body = <MovesPage {...props} />;

  return (
    <PauseCtx.Provider value={pause}>
      <AtlasScreen scroll={!hold && (m.phase === 'solo_play' || m.phase === 'gap_cards')}>
        {body}
        {extras}
      </AtlasScreen>
      <AtlasPause open={menu} onResume={() => setMenu(false)} onLeave={leave} />
    </PauseCtx.Provider>
  );
}

/** A fallen player watches the map. */
function MovesWatch({ m, me, map }: { m: MatchView; me: string; map: ReturnType<typeof makeMap> }) {
  return <HoldPage m={m} me={me} map={map} hold={{ kind: 'battle', until: 0, log: [] }} seconds={0} />;
}
