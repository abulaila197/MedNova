// Trust Me Not online: the whole year on everyone's own phone. The 'trust-me-not' edge function referees; this
// screen polls the player's own envelope every second, nudges the server when a clock runs out, and picks the
// page for the current phase. Every page is in the all-paper look (locked 2026-10-07).
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { call, leaveRoom } from '@/online/api';
import { supabase } from '@/lib/supabase';

import type { OnlineProps } from '../shell/types';
import type { TmnEnvelope } from './online';
import { GapPage, VotesPage } from './pages-gap';
import { GhostPage, InquisitionPage, LastSupperPage, LedgerFlow, RevealFlow, TmnPause } from './pages-end';
import { LifelineNote, RoundFlow } from './pages-round';
import { OpeningPage } from './pages';
import { PaperScreen } from './paper';
import type { PageProps } from './props';

type TState = { now: number; phase: 'countdown' | 'case' | 'done'; due: number | null; state: TmnEnvelope | null };

/** Month 12's Gap opens with 30 silent seconds for the Last Supper. */
const SUPPER_MS = 30000;

export function OnlinePlay({ matchId, roomId, me }: OnlineProps) {
  const [st, setSt] = useState<TState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [lifelineSeen, setLifelineSeen] = useState<number | null>(null);
  const offset = useRef(0);
  const lastTick = useRef(0);

  const load = useCallback(async () => {
    try {
      const s = await call<TState>('tmn_state', { m: matchId });
      offset.current = s.now - Date.now();
      setSt(s);
    } catch {
      // The next poll tries again.
    }
  }, [matchId]);

  const send = useCallback(
    async (action: { type: string; [k: string]: unknown } | null) => {
      await supabase.functions.invoke('trust-me-not', { body: { m: matchId, action } }).catch(() => {});
      load();
    },
    [matchId, load],
  );

  useEffect(() => {
    load();
    const poll = setInterval(load, 1000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => (clearInterval(poll), clearInterval(tick));
  }, [load]);

  // Nudge the referee when the clock has run out (or the year has not started); seats take turns so phones don't pile up.
  const server = now + offset.current;
  useEffect(() => {
    if (!st || st.phase === 'done') return;
    const due = st.state ? st.due : null;
    const seat = Math.max(0, (st.state?.view.players.findIndex((x) => x.id === me) ?? 0));
    const ready = st.state ? due != null && server >= due + seat * 1500 : st.phase === 'case' || st.phase === 'countdown';
    if (ready && server - lastTick.current > 1200) {
      lastTick.current = server;
      send({ type: 'tick' });
    }
  }, [st, server, me, send]);

  const env = st?.state;
  if (!env) return <PaperScreen month={1}>{null}</PaperScreen>;
  const v = env.view;
  const props: PageProps = {
    env,
    now: server,
    seconds: env.deadline ? Math.max(0, (env.deadline - server) / 1000) : 0,
    act: (a) => send(a),
    roomId,
  };
  if (paused)
    return (
      <PaperScreen month={v.month}>
        <TmnPause
          onBack={() => setPaused(false)}
          onLeave={async () => {
            await send({ type: 'QUIT' });
            await leaveRoom(roomId).catch(() => {});
            router.replace('/');
          }}
        />
      </PaperScreen>
    );

  let page;
  if (v.phase === 'opening') page = <OpeningPage month={v.month} />;
  else if (v.phase === 'gap1') {
    if (v.ghost) page = <GhostPage {...props} />;
    else if (v.lifeline && lifelineSeen !== v.month) page = <LifelineNote {...props} onDone={() => setLifelineSeen(v.month)} />;
    else if (v.month === 12 && env.extras.lastSupper === undefined && server < env.started + SUPPER_MS) page = <LastSupperPage {...props} />;
    else page = <GapPage {...props} />;
  } else if (v.phase === 'gap2') page = v.inquisitionOpen && !v.ghost && !env.extras.accused ? <InquisitionPage {...props} /> : <VotesPage {...props} />;
  else if (v.phase === 'round') page = <RoundFlow {...props} />;
  else if (v.phase === 'ledger') page = <LedgerFlow {...props} />;
  else page = <RevealFlow {...props} />;
  return (
    <PaperScreen month={v.month} onPause={() => setPaused(true)}>
      {page}
    </PaperScreen>
  );
}
