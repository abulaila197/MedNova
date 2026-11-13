import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { sfxVerdict } from '@/lib/sound';
import { u } from '@/theme/scale';

import { engine, rank } from '../engine';
import { playerColour } from '../shell/characters';
import { Curtain } from '../shell/Curtain';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import { teamLap, teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { CaseView } from './CaseView';
import { casePoints } from './core';
import { caseById } from './data';
import { dealCases } from './deal';
import { caseItem } from './items';
import { currentSeat, offlineStandings, scoreOf, startOffline, stepOffline, type OfflineEvent, type OfflineRun } from './offline';
import { Btn, Explain, PadSky, Pill, TopLine, type RevealRow } from './Pad';
import { tr } from '@/i18n';

/** Pass the phone: the same case for everyone, answered in secret in turn, then all answers together. */
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
      if (!r?.cases?.length || !r.cases.every((id) => caseById.has(id))) {
        const seats = play.seats.filter((x) => !x.removed);
        const teams = teamsOf(play);
        r = startOffline(await dealCases(play), seats.map((x) => x.seat), Math.random, teams ? teamLap(seats, teams) : null);
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
      engine.recorder.bookmark(play.id, next, scoreOf(next, 0));
      // Everyone answered: each player's case is recorded on their seat. Nothing goes to Learn.
      if (next.phase === 'reveal' && prev.phase !== 'reveal') {
        const id = next.cases[next.index];
        void sfxVerdict(true);
        for (const seat of next.seats.filter((x) => !next.removed.includes(x))) void recordItem(play, caseItem(id, next.runs[seat], { index: next.index, seat, learn: false, ms: 0 }), true);
      }
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(scoreOf(next, 0), rank(offlineStandings(next, names)));
    },
    [play, onFinish, names],
  );

  if (!run || run.phase === 'done') return <GameScreen scroll={false} under={<PadSky />}>{null}</GameScreen>;
  const seat = currentSeat(run);
  const c = caseById.get(run.cases[run.index])!;
  const total = run.cases.length;
  const kicker = total > 1 ? tr('Case {n} of {total}', { n: run.index + 1, total }) : tr('One case');
  const live = run.seats.filter((x) => !run.removed.includes(x));
  const colorOf = (x: number) => seatOf.get(x)?.color ?? playerColour([], String(x));
  const table = live.map((x) => ({ seat: x, name: nameOf(x), score: scoreOf(run, x), color: seatOf.get(x)?.color })).sort((a, b) => b.score - a.score);

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

  if (run.phase === 'reveal') {
    const rows: RevealRow[] = live
      .map((x) => ({ id: String(x), name: nameOf(x), character: seatOf.get(x)?.character ?? 'yara', color: colorOf(x), run: run.runs[x], points: casePoints(c.lv, run.runs[x]) }))
      .sort((a, b) => b.points - a.points);
    return (
      <GameScreen scroll={false} under={<PadSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14), gap: u(10) }}>
        <TopLine kicker={tr('{kicker} · Everyone’s answers', { kicker })} sub={table.map((x) => `${x.name} ${x.score}`).join(' · ')} />
        <Explain c={c} rows={rows} foot={<Btn label={run.index + 1 < total ? tr('Next case') : tr('See results')} onPress={() => dispatch({ type: 'NEXT' })} />} />
        {menu}
      </GameScreen>
    );
  }

  const mine = run.runs[seat];
  return (
    <GameScreen scroll={false} under={<PadSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14) }}>
      <CaseView
        key={`${run.index}:${seat}`}
        c={c}
        run={mine}
        locked={paused || run.phase !== 'playing'}
        note={tr('Answers stay secret until everyone has played')}
        top={<TopLine kicker={tr('{kicker} · {n}', { kicker, n: nameOf(seat) === 'You' ? tr('Your turn') : tr('{v}’s turn', { v: nameOf(seat) }) })} right={<Pill text={tr('{n} pts', { n: scoreOf(run, seat) })} />} />}
        onLock={(pick) => dispatch({ type: 'LOCK', pick })}
      />
      {run.phase === 'handoff' ? (
        <Curtain name={nameOf(seat)} color={seatOf.get(seat)?.color} sub={tr('{scoreOf} points · answer in secret', { scoreOf: scoreOf(run, seat) })} board={table} onReady={() => dispatch({ type: 'READY' })} onPause={() => setPaused(true)} />
      ) : null}
      {menu}
    </GameScreen>
  );
}
