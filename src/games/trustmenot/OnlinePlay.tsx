// Trust Me Not online: the whole year on everyone's own phone. The 'trust-me-not' edge function referees; this
// screen polls the player's own envelope every second, nudges the server when a clock runs out, and picks the
// page for the current phase. Every page is in the all-paper look (locked 2026-10-07).
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { invoke, leaveRoom } from '@/online/api';

import type { OnlineProps } from '../shell/types';
import { GapPage, VotesPage } from './pages-gap';
import { GhostPage, InquisitionPage, LastSupperPage, LedgerFlow, RevealFlow, TmnPause } from './pages-end';
import { LifelineNote, RoundFlow } from './pages-round';
import { OpeningPage } from './pages';
import { CRIMI, FELL, p as pp, PaperScreen, T, TM } from './paper';
import type { PageProps } from './props';
import { rules } from './engine';
import { play, useFxPlayers, useHeartbeat, useSeasonLoop } from './sound';
import { useMatchState } from '@/online/useMatchState';
import { useBackPause } from '@/online/backPause';
import { nudgeDue, SUPPER_MS, tmnShown, type TState } from './shown';


const COIN = new Set(['SELL', 'BUY_FOOD', 'BUY_ITEM', 'GIFT', 'LEND', 'REPAY', 'BID', 'PAY_WOLVES', 'DOCTOR_CHIP', 'LAST_SUPPER']);
const STAMP = new Set(['VOTE', 'ACCUSE', 'STARS', 'PICK', 'RUMOR']);
/** Betrayals make no sound (rule book §12). */
const SILENT = new Set(['SKIM', 'STEAL', 'FOG', 'SUPPLIER_SKIM', 'COLD_SHOULDER', 'tick']);
const fxFor = (t: string) => (SILENT.has(t) ? null : COIN.has(t) ? 'coin' : STAMP.has(t) ? 'stamp' : 'tap');


export function OnlinePlay({ matchId, roomId, me }: OnlineProps) {
  const { st, load, server, clock, notice, setNotice } = useMatchState<TState>('tmn_state', matchId, { quiet: true, shown: (sv, s) => tmnShown(sv, s, me) });
  const [paused, setPaused] = useState(false);
  useBackPause(paused, setPaused);
  const [lifelineSeen, setLifelineSeen] = useState<number | null>(null);
  const lastTick = useRef(0);

  /**
   * One action to the referee. A 409 means the server's 4 tries all clashed with other phones and nothing was saved,
   * so it is sent again (twice at most); any other failure is shown, never dropped in silence (DEF-042, GB10).
   */
  const send = useCallback(
    async (action: { type: string; [k: string]: unknown } | null) => {
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          await invoke('trust-me-not', { m: matchId, action });
          ok = true;
        } catch (e) {
          const status = (e as { context?: { status?: number } })?.context?.status;
          if (status !== 409 || attempt === 2) break;
          await new Promise((r) => setTimeout(r, 250 + Math.random() * 500));
        }
      }
      if (!ok && action && action.type !== 'tick') setNotice('Couldn’t send that. Check your connection and try again.');
      load();
      return ok;
    },
    [matchId, load, setNotice],
  );

  // Nudge the referee when the clock has run out (or the year has not started); seats take turns so phones don't pile up.
  useEffect(() => {
    if (!st || st.phase === 'done') return;
    if (nudgeDue(st, server, me) && server - lastTick.current > 1200) {
      lastTick.current = server;
      send({ type: 'tick' });
    }
  }, [st, server, me, send]);

  const env = st?.state;
  // Sound: the season's ambience, the heartbeat at low health, a calendar page torn at each month, a toll at a death.
  const v0 = env?.view;
  const mine = v0?.players.find((x) => x.id === me);
  useSeasonLoop(rules.seasonOf(v0?.month ?? 1));
  useFxPlayers();
  useHeartbeat(mine?.health ?? 100, mine?.alive ?? false);
  const monthKey = v0 ? `${v0.month}|${v0.phase}` : '';
  const alive = v0?.players.filter((x) => x.alive).length ?? 0;
  const seen = useRef({ monthKey: '', alive: 0 });
  useEffect(() => {
    if (!monthKey) return;
    if (monthKey !== seen.current.monthKey && monthKey.endsWith('|opening')) play('calendar-tear');
    if (seen.current.alive && alive < seen.current.alive) play('death');
    seen.current = { monthKey, alive };
  }, [monthKey, alive]);

  if (!env) return <PaperScreen month={1}>{null}</PaperScreen>;
  const v = env.view;
  const props: PageProps = {
    env,
    clock,
    act: (a) => {
      // The sound plays once the referee took the action, so a lost one never sounds accepted.
      const fx = fxFor(a.type);
      send(a).then((ok) => {
        if (ok && fx) play(fx);
      });
    },
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
  // A watcher (or a removed player) has no seat: the pages below all read "my" seat, so they get the calendar page.
  if (!v.players.some((x) => x.id === v.me)) page = st?.phase === 'done' ? <WatcherEnd onBack={() => router.replace(`/play/trust-me-not/lobby?room=${roomId}`)} /> : <OpeningPage month={v.month} />;
  else if (v.phase === 'opening') page = <OpeningPage month={v.month} />;
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
      {notice ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: pp(16), right: pp(16), bottom: pp(70), alignItems: 'center' }}>
          <View style={{ backgroundColor: TM.paper, borderColor: TM.red, borderWidth: 1, paddingHorizontal: pp(10), paddingVertical: pp(6) }}>
            <T f={CRIMI} size={13} color={TM.red}>{notice}</T>
          </View>
        </View>
      ) : null}
    </PaperScreen>
  );
}

/** A watcher at the end of the year: the camp is over, and the way back to the room for the rematch (DEF-007). */
function WatcherEnd({ onBack }: { onBack: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: pp(14) }}>
      <T f={FELL} size={22}>The year is over.</T>
      <Pressable onPress={onBack} accessibilityRole="button" style={{ borderColor: TM.ink, borderWidth: 1, paddingHorizontal: pp(16), paddingVertical: pp(8) }}>
        <T f={FELL} size={15}>Back to the room</T>
      </Pressable>
    </View>
  );
}
