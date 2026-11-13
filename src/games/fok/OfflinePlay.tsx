import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { u } from '@/theme/scale';

import { engine, rank } from '../engine';
import { Curtain } from '../shell/Curtain';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import { teamLap, teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { BoardView } from './BoardView';
import { dealBoards } from './deal';
import { boardItems } from './items';
import { currentSeat, judgeTurn, offlineRecap, offlineStandings, startOffline, stepOffline, type OfflineEvent, type OfflineRun } from './offline';
import { BoardEnd } from './SoloPlay';
import { FokSky, TopLine } from './Table';
import { tr } from '@/i18n';

/** How long "One away" or the found group shows before the phone passes on. */
const FLASH_MS = 1300;

/** Pass the phone: one shared board, one group a turn; right scores, wrong passes. No hints, no EXP, no Learn. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const [run, setRun] = useState<OfflineRun | null>(null);
  const ref = useRef<OfflineRun | null>(null);
  const [paused, setPaused] = useState(false);
  const [flash, setFlash] = useState(false);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);
  const nameOf = (seat: number) => names[seat] ?? tr('Player {n}', { n: seat + 1 });

  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (!r?.boards?.length) {
        const seats = play.seats.filter((x) => !x.removed);
        const teams = teamsOf(play);
        r = startOffline(await dealBoards(play), seats.map((x) => x.seat), Math.random, teams ? teamLap(seats, teams) : null);
        engine.recorder.bookmark(play.id, r, 0);
      }
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
      engine.recorder.bookmark(play.id, next, next.players[0]?.score ?? 0);
      // A board ended: its groups go to whoever found them (the rest to the phone owner). Nothing goes to Learn.
      if (next.phase === 'boardEnd' && prev.phase !== 'boardEnd') {
        for (const it of boardItems(next.boards[next.index], next.run, { index: next.index, learn: false, ms: 0, foundBy: next.foundBy })) void recordItem(play, it, true);
      }
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(next.players[0]?.score ?? 0, rank(offlineStandings(next, names)));
    },
    [play, onFinish, names],
  );

  if (!run || run.phase === 'done') return <GameScreen scroll={false} under={<FokSky />}>{null}</GameScreen>;
  const seat = currentSeat(run);
  const who = seatOf.get(seat);
  const board = run.boards[run.index];
  const total = run.boards.length;
  const foundNames = Object.fromEntries(Object.entries(run.foundBy).map(([slot, x]) => [Number(slot), nameOf(x)]));
  const table = run.seats
    .filter((x) => !run.removed.includes(x))
    .map((x) => ({ seat: x, name: nameOf(x), score: run.players[x].score, color: seatOf.get(x)?.color }))
    .sort((a, b) => b.score - a.score);
  const boardLine = total > 1 ? tr('Board {n} of {total}', { n: run.index + 1, total }) : tr('Four of a Kind');

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

  if (run.phase === 'boardEnd') {
    return (
      <GameScreen scroll={false} under={<FokSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16) }}>
        <BoardEnd
          board={board}
          run={run.run}
          who={foundNames}
          hearts={false}
          kicker={tr('Board solved')}
          title={boardLine}
          line={table.map((x) => `${x.name} ${x.score}`).join(' · ')}
          next={run.index + 1 < total ? tr('Next board') : tr('See results')}
          onNext={() => dispatch({ type: 'NEXT' })}
        />
        {menu}
      </GameScreen>
    );
  }

  return (
    <GameScreen scroll={false} under={<FokSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14) }}>
      <BoardView
        key={`${run.index}:${run.turns.length}`}
        board={board}
        run={run.run}
        who={foundNames}
        locked={flash || paused || run.phase !== 'playing'}
        tip={tr('Find one group, then the phone passes on')}
        rightStamp={tr('Found it!')}
        top={<TopLine kicker={nameOf(seat) === 'You' ? tr('Your turn') : tr('{nameOf}’s turn', { nameOf: nameOf(seat) })} title={tr('Four of a Kind')} sub={tr('{boardLine} · {score} points', { boardLine, score: run.players[seat].score })} />}
        onSubmit={(tiles) => {
          const v = judgeTurn(run, tiles);
          if (v === 'ignored' || v === 'repeat') return v;
          setFlash(true);
          setTimeout(() => {
            setFlash(false);
            dispatch({ type: 'SUBMIT', tiles });
          }, FLASH_MS);
          return v;
        }}
        onShuffle={() => dispatch({ type: 'SHUFFLE', rand: Math.random })}
      />
      {run.phase === 'handoff' ? (
        <Curtain name={nameOf(seat)} color={who?.color} sub={tr('{score} points · one group this turn', { score: run.players[seat].score })} board={table} recap={offlineRecap(run, seat, play)} onReady={() => dispatch({ type: 'READY' })} onPause={() => setPaused(true)} />
      ) : null}
      {menu}
    </GameScreen>
  );
}
