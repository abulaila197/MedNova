import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { tr } from '@/i18n';
import { sfxVerdict } from '@/lib/sound';

import { engine, rank } from '../engine';
import { Curtain } from '../shell/Curtain';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import { teamLap, teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen } from '../shell/ui';
import { missNote, OrderBoard } from './Board';
import { ORDER, worthNow } from './core';
import { questionById } from './data';
import { countOf, dealQuestions } from './deal';
import { questionItem } from './items';
import { currentSeat, offlineStandings, scoreOf, startOffline, stepOffline, type OfflineEvent, type OfflineRun } from './offline';
import { OrderResult } from './Result';

/** Pass the phone: each player gets their own question and 90 seconds a turn, then sees the right order and passes on. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const [run, setRun] = useState<OfflineRun | null>(null);
  const ref = useRef<OfflineRun | null>(null);
  const [paused, setPaused] = useState(false);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);
  const nameOf = (seat: number) => names[seat] ?? tr('Player {n}', { n: seat + 1 });

  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (!r?.ids?.length || !r.ids.every((id) => questionById.has(id))) {
        const seats = play.seats.filter((x) => !x.removed);
        const teams = teamsOf(play);
        const rounds = countOf(play.settings);
        r = startOffline(await dealQuestions(play, rounds * seats.length), seats.map((x) => x.seat), rounds, Math.random, teams ? teamLap(seats, teams) : null);
        engine.recorder.bookmark(play.id, r, 0);
      }
      // A turn cut off by leaving the game starts again at the curtain with a new question.
      if (r.phase === 'playing') r = { ...r, phase: 'handoff', turn: null };
      if (live) {
        ref.current = r;
        setRun(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [play]);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const dispatch = useCallback(
    (e: OfflineEvent) => {
      const prev = ref.current;
      if (!prev || !alive.current) return;
      const next = stepOffline(prev, e);
      if (next === prev) return;
      ref.current = next;
      setRun(next);
      engine.recorder.bookmark(play.id, next, scoreOf(next, 0));
      // A turn ended: it is recorded on that player's seat. Nothing goes to Learn.
      if (next.phase === 'result' && prev.phase === 'playing' && next.turn) {
        const t = next.turn;
        void sfxVerdict(t.run.timeUp ? 'timeup' : t.run.solved);
        void recordItem(play, questionItem(t.id, t.run, { index: next.next - 1, seat: t.seat, learn: false, ms: t.ms }), true);
      } else if (next.phase === 'playing' && prev.turn && next.turn && next.turn.run.miss > prev.turn.run.miss) void sfxVerdict(false);
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(scoreOf(next, 0), rank(offlineStandings(next, names)));
    },
    [play, onFinish, names],
  );

  // The turn clock: 90 seconds, counting while the turn is open and the game isn't paused.
  const [tick, setTick] = useState({ key: -1, ms: 0 });
  const base = useRef(0);
  const baseKey = useRef(-1);
  const since = useRef<number | null>(null);
  const turnKey = run?.next ?? 0;
  const spent = tick.key === turnKey ? tick.ms : 0;
  const ticking = run?.phase === 'playing' && !paused;
  useEffect(() => {
    if (!ticking) return;
    // A new turn starts its clock from 0.
    if (baseKey.current !== turnKey) {
      baseKey.current = turnKey;
      base.current = 0;
    }
    since.current = Date.now();
    const id = setInterval(() => {
      const ms = base.current + Date.now() - (since.current ?? Date.now());
      setTick({ key: turnKey, ms });
      if (ms >= ORDER.turnMs) dispatch({ type: 'TIMEUP' });
    }, 250);
    return () => {
      clearInterval(id);
      if (since.current != null) base.current += Date.now() - since.current;
      since.current = null;
    };
  }, [ticking, turnKey, dispatch]);
  const msNow = () => base.current + (since.current != null ? Date.now() - since.current : 0);

  if (!run || run.phase === 'done') return <GameScreen scroll={false}>{null}</GameScreen>;
  const seat = currentSeat(run);
  const liveSeats = run.seats.filter((x) => !run.removed.includes(x));
  const table = liveSeats.map((x) => ({ seat: x, name: nameOf(x), score: scoreOf(run, x), color: seatOf.get(x)?.color })).sort((a, b) => b.score - a.score);
  const roundLine = tr('Round {n} of {total}', { n: run.round + 1, total: run.rounds });

  const menu = (
    <PauseMenu
      open={paused}
      mode="offline"
      seats={play.seats.map((x) => ({ ...x, removed: x.removed || run.removed.includes(x.seat) }))}
      keep={[0]}
      onResume={() => setPaused(false)}
      onQuit={onQuit}
      onFinish={() => {
        setPaused(false);
        dispatch({ type: 'FINISH' });
      }}
      onRemove={(x) => {
        engine.recorder.removeSeat(play.id, x);
        dispatch({ type: 'REMOVE', seat: x });
      }}
    />
  );

  if (run.phase === 'result' && run.turn) {
    const t = run.turn;
    const lastTurn = run.round + 1 >= run.rounds && run.lap.slice(1).filter((x) => liveSeats.includes(x)).length === 0;
    const who = nameOf(t.seat) === 'You' ? tr('You') : nameOf(t.seat);
    return (
      <OrderResult
        q={questionById.get(t.id)!}
        run={t.run}
        ms={t.ms}
        learn={false}
        title={`${roundLine} · ${who}`}
        foot={<Btn label={lastTurn ? tr('See results') : tr('Pass the phone')} onPress={() => dispatch({ type: 'NEXT' })} />}>
        {menu}
      </OrderResult>
    );
  }

  const turn = run.turn;
  const q = turn ? questionById.get(turn.id)! : null;
  const left = Math.max(0, ORDER.turnMs - spent);
  const whose = nameOf(seat) === 'You' ? tr('Your turn') : tr('{v}’s turn', { v: nameOf(seat) });
  return (
    <>
      {turn && q ? (
        <OrderBoard
          key={run.next}
          q={q}
          run={turn.run}
          title={whose}
          clock={{ label: tr('Time left'), ms: left, down: true, warn: left < 15_000 }}
          worth={worthNow(turn.run, spent)}
          locked={paused}
          hidden={paused}
          onPause={() => setPaused(true)}
          onMove={(card, to) => dispatch({ type: 'MOVE', card, to })}
          onSubmit={() => dispatch({ type: 'SUBMIT', ms: msNow() })}
          note={missNote(turn.run)}>
          {menu}
        </OrderBoard>
      ) : (
        <GameScreen scroll={false}>
          <Curtain
            name={nameOf(seat)}
            color={seatOf.get(seat)?.color}
            sub={`${roundLine} · ${tr('{n} points · your own question, 90 seconds', { n: scoreOf(run, seat) })}`}
            board={table}
            onReady={() => dispatch({ type: 'READY' })}
            onPause={() => setPaused(true)}
          />
          {menu}
        </GameScreen>
      )}
    </>
  );
}
