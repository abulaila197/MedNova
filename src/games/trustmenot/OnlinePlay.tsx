// Trust Me Not online: the whole year on everyone's own phone. The server referees (the trust-me-not edge function,
// built next) and this screen polls the year every second and draws the page for the current phase. For now it
// draws the first two locked pages: the month opening and the question round.
import { useCallback, useEffect, useRef, useState } from 'react';

import { call } from '@/online/api';
import { supabase } from '@/lib/supabase';

import type { OnlineProps } from '../shell/types';
import type { RoundId } from './engine';
import { OpeningPage, RoundPage, type StripPlayer } from './pages';
import { PaperScreen } from './paper';

type TState = {
  now: number;
  phase: 'countdown' | 'case' | 'done';
  state: {
    deadline: number | null;
    view: {
      month: number;
      phase: 'opening' | 'gap1' | 'gap2' | 'round' | 'ledger' | 'over';
      me: string;
      players: (StripPlayer & { jewels?: number })[];
      round: { id: RoundId; index: number; total: number; limitMs: number; picked: number | null; camp?: { done: number; target: number; max: number } | null; text: { q: string; choices: string[] } } | null;
    };
  } | null;
};

export function OnlinePlay({ matchId }: OnlineProps) {
  const [st, setSt] = useState<TState | null>(null);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);

  const load = useCallback(async () => {
    try {
      const s = await call<TState>('tmn_state', { m: matchId });
      offset.current = s.now - Date.now();
      setSt(s);
    } catch {
      // The next poll tries again.
    }
  }, [matchId]);
  useEffect(() => {
    load();
    const poll = setInterval(load, 1000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => (clearInterval(poll), clearInterval(tick));
  }, [load]);

  const act = useCallback(
    async (action: Record<string, unknown>) => {
      await supabase.functions.invoke('trust-me-not', { body: { m: matchId, action } }).catch(() => {});
      load();
    },
    [matchId, load],
  );

  const v = st?.state?.view;
  if (!v) return <PaperScreen month={1}>{null}</PaperScreen>;
  const server = now + offset.current;
  const seconds = st?.state?.deadline ? Math.max(0, (st.state.deadline - server) / 1000) : 0;
  const mine = v.players.find((x) => x.id === v.me);
  const r = v.round;
  return (
    <PaperScreen month={v.month}>
      {v.phase === 'round' && r ? (
        <RoundPage
          players={v.players} me={v.me} round={r.id} index={r.index} total={r.total} seconds={seconds} limit={r.limitMs / 1000}
          question={r.text} picked={r.picked} onPick={(choice) => act({ type: 'answer', q: r.index, choice })}
          camp={r.camp} health={mine?.health ?? 0} jewels={mine?.jewels ?? 0}
        />
      ) : (
        <OpeningPage month={v.month} />
      )}
    </PaperScreen>
  );
}
