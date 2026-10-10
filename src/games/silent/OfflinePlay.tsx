import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { u } from '@/theme/scale';

import { engine, rank } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { Curtain } from '../shell/Curtain';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import { teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { Board, type BoardHandle, type Stroke } from './Board';
import { hintView, type Kind } from './core';
import { RECENT_KEY, WORDS, wordById, wordName } from './data';
import {
  buildPlan, currentTurn, elapsed, offlineRecap, offlineRows, snapshotOffline, startOffline, stealTeamOf, stepOffline, timeLeft,
  type OfflineEvent, type OfflineRun, type TurnRecord,
} from './offline';
import { ChalkBtn, ChalkChip, ChalkTimer, ChalkTitle, Frame, HintCard, Kicker, Ledge, Note, Panel, PauseBtn, Peek, SL, Scores, SlateScreen, TopRow, clock, useRoom, useSlateFonts } from './slate';
import { ActingCard, FitBoard } from './Stage';

/** Offline (SA3-SA6, TMG-SA): pass the phone, secret pick, draw or act, "Who got it?", steal, reveal. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const fonts = useSlateFonts();
  const R = useRoom();
  const turnMs = (Number(play.settings.turn) || 90) * 1000;
  const performs = Number(play.settings.performs) || 1;
  const [run, setRun] = useState<OfflineRun | null>(null);
  const ref = useRef<OfflineRun | null>(null);
  const [now, setNow] = useState(Date.now());
  const board = useRef<BoardHandle>(null);
  const drawing = useRef<Stroke[]>([]);
  const shape = useRef(1);
  const [ink, setInk] = useState(0);
  const [size, setSize] = useState(0);
  const [erase, setErase] = useState(false);
  const teams = useMemo(() => teamsOf(play), [play]);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);
  const teamOf = useCallback((seat: number) => seatOf.get(seat)?.team, [seatOf]);
  const team = useCallback((id: number | null | undefined) => teams?.find((t) => t.id === id), [teams]);
  const teamName = useCallback((id: number) => team(id)?.name ?? `Team ${id + 1}`, [team]);
  const nameOf = useCallback((seat: number) => names[seat] ?? `Player ${seat + 1}`, [names]);

  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (!r) {
        const seats = play.seats.filter((x) => !x.removed);
        const recent = (await engine.kv.get<string[]>(RECENT_KEY)) ?? [];
        r = startOffline({ plan: buildPlan(seats, teams ? teams.map((t) => t.id) : null, performs), teams: teams ? teams.map((t) => t.id) : null, turnMs, seed: play.id, recent });
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
  }, [play, teams, performs, turnMs]);

  const dispatch = useCallback(
    (e: OfflineEvent) => {
      const prev = ref.current;
      if (!prev) return;
      // Keep the drawing for the reveal before the board goes away.
      if (board.current && (prev.phase === 'performing' || prev.phase === 'stealing' || prev.phase === 'whoGot')) drawing.current = board.current.strokes();
      const next = stepOffline(prev, e, WORDS);
      if (next === prev) return;
      ref.current = next;
      setRun(next);
      const rows = offlineRows(next, names, teamOf);
      const owner = rows.find((x) => x.seat === 0)?.score ?? 0;
      engine.recorder.bookmark(play.id, snapshotOffline(next, Date.now(), WORDS), owner);
      if (next.turns.length > prev.turns.length) {
        const t = next.turns[next.turns.length - 1];
        if (t.wordId) {
          const w = wordById.get(t.wordId);
          // One item per turn, on the performer. Nothing goes to Learn (SA1); the dossier link shows on results (RS1).
          recordItem(play, {
            seat: t.seat,
            itemId: t.wordId,
            answerKey: w?.dossier ?? null,
            outcome: t.outcome === 'guessed' || t.outcome === 'stolen' ? 'right' : 'timed_out',
            answersGiven: [],
            timeMs: t.atMs,
            hintsUsed: 0,
            revealsUsed: 0,
            points: t.team != null ? (t.outcome === 'guessed' ? t.points : 0) : t.performerPoints,
            feedsLearn: false,
            gameData: { kind: t.kind, outcome: t.outcome, guesser: t.guesser, guesserPoints: t.guesser != null ? t.points : 0, stealTeam: t.stealTeam, team: t.team },
          });
          engine.kv.set(RECENT_KEY, next.recent);
        }
      }
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(owner, rank(rows));
    },
    [play, onFinish, names, teamOf],
  );

  const timed = run?.phase === 'picking' || run?.phase === 'performing' || run?.phase === 'stealing';
  useEffect(() => {
    if (!timed) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      dispatch({ type: 'TICK', now: n });
    }, 200);
    return () => clearInterval(id);
  }, [timed, dispatch]);

  // A new turn starts with white chalk on a clean board.
  useEffect(() => {
    setInk(0);
    setSize(0);
    setErase(false);
  }, [run?.index]);

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!fonts || !run || run.phase === 'done') return <SlateScreen>{null}</SlateScreen>;

  const turn = currentTurn(run);
  const who = seatOf.get(turn.seat);
  const color = team(turn.team)?.color ?? who?.color ?? R.ink;
  const paused = run.phase === 'paused';
  const phase = paused ? run.before! : run.phase;
  const live = run.plan.filter((p, i) => i <= run.index && !run.removed.includes(p.seat)).length;
  const total = run.plan.filter((p) => !run.removed.includes(p.seat)).length;
  const kick = `Turn ${live} of ${total}${turn.team != null ? ` · ${teamName(turn.team)}` : ''}`;
  const left = timeLeft(run, now);
  const pause = () => dispatch({ type: 'PAUSE', now: Date.now() });
  const rows = offlineRows(run, names, teamOf);
  const scoreRows = teams
    ? teams.filter((t) => rows.some((r) => teamOf(r.seat) === t.id)).map((t) => ({ key: `t${t.id}`, name: t.name, score: run.teamScores[t.id] ?? 0, color: t.color })).sort((a, b) => b.score - a.score)
    : rows.map((r) => ({ key: r.seat, name: r.name, score: r.score, color: seatOf.get(r.seat)?.color })).sort((a, b) => b.score - a.score);
  const menu = (
    <PauseMenu
      open={paused}
      mode="offline"
      seats={play.seats.map((x) => ({ ...x, removed: x.removed || run.removed.includes(x.seat) }))}
      keep={[0]}
      onResume={() => dispatch({ type: 'RESUME', now: Date.now() })}
      onQuit={onQuit}
      onRemove={(x) => {
        engine.recorder.removeSeat(play.id, x);
        dispatch({ type: 'REMOVE', seat: x });
      }}
    />
  );

  if (phase === 'handoff')
    return (
      <SlateScreen>
        <Curtain
          name={nameOf(turn.seat)}
          color={color}
          sub={`${kick} · ${run.turnMs / 1000} s`}
          board={scoreRows.map((r, i) => ({ seat: i, name: r.name, score: r.score, color: r.color }))}
          recap={offlineRecap(run, turn.seat, play, teamName, clock)}
          onReady={() => dispatch({ type: 'READY', now: Date.now() })}
        />
        {menu}
      </SlateScreen>
    );

  if (phase === 'picking')
    return (
      <SlateScreen scroll>
        <TopRow kicker={kick} title={`${nameOf(turn.seat)}, pick one`} color={color} right={<><ChalkTimer leftMs={left} totalMs={10_000} /><PauseBtn onPress={pause} /></>} />
        <Pick run={run} paused={paused} onKind={(kind) => dispatch({ type: 'KIND', kind })} onPick={(wordId) => dispatch({ type: 'PICK', wordId, now: Date.now() })} />
        {menu}
      </SlateScreen>
    );

  if (phase === 'reveal') {
    const t = run.turns[run.turns.length - 1];
    const w = wordById.get(t.wordId);
    const last = run.index + 1 >= run.plan.length || run.plan.slice(run.index + 1).every((p) => run.removed.includes(p.seat));
    return (
      <SlateScreen scroll>
        <Kicker>{kick}</Kicker>
        <ChalkTitle size={18} color={R.soft}>It was</ChalkTitle>
        <ChalkTitle size={27} color={R.mark}>{w ? wordName(w) : ''}</ChalkTitle>
        <Note style={{ marginTop: -u(6) }}>{w?.field}</Note>
        {t.kind === 'drawing' && drawing.current.length ? (
          <Frame style={{ width: '62%', alignSelf: 'center' }}>
            <Board color={SL.chalk} width={SL.sizes[0]} erase={false} bg={R.board} enabled={false} initial={drawing.current} ratio={shape.current} />
          </Frame>
        ) : null}
        <Panel>
          <Text style={[s.result, { color: R.ink }]}>{outcomeLine(t, nameOf, teamName)}</Text>
        </Panel>
        <Panel style={{ paddingVertical: u(10) }}>
          <Kicker>Scores</Kicker>
          <Scores rows={scoreRows} />
        </Panel>
        <ChalkBtn label={last ? 'See results' : 'Next turn'} onPress={() => dispatch({ type: 'NEXT' })} />
        {menu}
      </SlateScreen>
    );
  }

  // Performing, who got it, and steal share one stage, so the drawing stays put for the room.
  const w = wordById.get(run.wordId ?? '')!;
  const hint = run.hints ? hintView(w, run.hints, phase === 'performing' ? elapsed(run, now) : phase === 'whoGot' ? (run.gotAt ?? 0) : run.turnMs) : null;
  const steal = stealTeamOf(run, turn.team);
  const acting = run.kind === 'acting';
  const title = phase === 'whoGot' ? 'Who got it?' : phase === 'stealing' ? `${steal != null ? teamName(steal) : 'Next team'} can steal` : `${nameOf(turn.seat)} is ${acting ? 'acting' : 'drawing'}`;
  const titleColor = phase === 'stealing' ? (team(steal)?.color ?? R.ink) : phase === 'whoGot' ? R.ink : color;
  const timer = phase === 'performing' ? <ChalkTimer leftMs={left} totalMs={run.turnMs} /> : phase === 'stealing' ? <ChalkTimer leftMs={left} totalMs={15_000} /> : null;

  return (
    <SlateScreen>
      <TopRow kicker={phase === 'whoGot' ? `Guessed in ${clock(run.gotAt ?? 0)}` : phase === 'stealing' ? 'Time up · one guess, 15 s' : kick} title={title} color={titleColor} right={<>{timer}<PauseBtn onPress={pause} /></>} />
      {hint ? <HintCard hint={paused ? { words: hint.words, field: null, mask: null } : hint} /> : null}
      {acting ? (
        <ActingCard paused={paused} />
      ) : (
        <FitBoard boardKey={run.index} boardRef={board} shapeRef={shape} ink={ink} size={size} erase={erase} enabled={phase === 'performing'} paused={paused} />
      )}
      {phase === 'performing' ? (
        <>
          {acting ? null : <Ledge ink={ink} size={size} erase={erase} onInk={(i) => (setInk(i), setErase(false))} onSize={() => setSize(size ? 0 : 1)} onErase={() => setErase(!erase)} onUndo={() => board.current?.undo()} onClear={() => board.current?.clear()} />}
          <View style={s.row}>
            <Peek word={paused ? '' : w.name} />
            <ChalkBtn ghost label="Give up" onPress={() => dispatch({ type: 'GIVE_UP', now: Date.now() })} style={s.act} />
            <ChalkBtn label="Got it!" onPress={() => dispatch({ type: 'GOT_IT', now: Date.now() })} style={s.act} />
          </View>
        </>
      ) : phase === 'whoGot' ? (
        <Panel style={{ gap: u(8), paddingVertical: u(10) }}>
          <Note>Tap who said it first. They score by speed, and {nameOf(turn.seat)} gets half.</Note>
          <View style={s.wrap}>
            {rows.filter((r) => r.seat !== turn.seat).map((r) => (
              <ChalkChip key={r.seat} big label={r.name} dot={seatOf.get(r.seat)?.color} onPress={() => dispatch({ type: 'CREDIT', seat: r.seat })} />
            ))}
          </View>
          <ChalkBtn ghost label="Not yet, keep going" onPress={() => dispatch({ type: 'UNDO_GOT', now: Date.now() })} />
        </Panel>
      ) : (
        <Panel style={{ gap: u(8), paddingVertical: u(10) }}>
          <Note>{`${steal != null ? teamName(steal) : 'The next team'} talks it over and gives one answer. Right is worth 10.`}</Note>
          <View style={s.row}>
            <ChalkBtn ghost label="Missed" onPress={() => dispatch({ type: 'STEAL', success: false })} style={{ flex: 1 }} />
            <ChalkBtn label="They got it" onPress={() => dispatch({ type: 'STEAL', success: true })} style={{ flex: 1.4 }} />
          </View>
        </Panel>
      )}
      {menu}
    </SlateScreen>
  );
}

/** The secret pick (SA4, SA5): choose draw or act, hold to see the 3 diseases, tap one. */
function Pick({ run, paused, onKind, onPick }: { run: OfflineRun; paused: boolean; onKind: (k: Kind) => void; onPick: (id: string) => void }) {
  const R = useRoom();
  const [show, setShow] = useState(false);
  const open = show && !paused;
  return (
    <>
      <Note>Only you should see this. If time runs out, number 1 is picked for you.</Note>
      <View style={s.row}>
        <ChalkChip big label="Draw it" on={run.kind === 'drawing'} onPress={() => onKind('drawing')} />
        <ChalkChip big label="Act it out" on={run.kind === 'acting'} onPress={() => onKind('acting')} />
      </View>
      <View style={{ gap: u(8) }}>
        {run.options.map((id, i) => {
          const w = wordById.get(id)!;
          return (
            <Pressable key={id} onPress={() => onPick(id)} style={({ pressed }) => [s.option, { backgroundColor: R.board }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={open ? `Pick ${w.name}` : `Pick number ${i + 1}`}>
              <Text style={s.optNo}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.optT, !open && { color: R.boardDim, letterSpacing: u(4) }]} numberOfLines={2}>
                  {open ? w.name : '· · · · ·'}
                </Text>
                {open ? <Text style={[s.optF, { color: R.boardSoft }]} numberOfLines={1}>{[...w.aliases, w.field].join(' · ')}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPressIn={() => setShow(true)} onPressOut={() => setShow(false)} style={[s.hold, { borderColor: open ? R.mark : R.line }]} accessibilityRole="button" accessibilityLabel="Hold to see your diseases">
        <Text style={[s.holdT, { color: open ? R.mark : R.ink }]}>{open ? 'Tap one while holding' : 'Hold here to see them'}</Text>
      </Pressable>
    </>
  );
}

function outcomeLine(t: TurnRecord, nameOf: (s: number) => string, teamName: (id: number) => string) {
  if (t.outcome === 'guessed' && t.guesser != null) return `${nameOf(t.guesser)} got it in ${clock(t.atMs)}: +${t.points}. ${nameOf(t.seat)} +${t.performerPoints}.`;
  if (t.outcome === 'guessed') return `${t.team != null ? teamName(t.team) : 'The room'} got it in ${clock(t.atMs)}: +${t.points}.`;
  if (t.outcome === 'stolen') return `${t.stealTeam != null ? teamName(t.stealTeam) : 'The next team'} stole it: +${t.points}.`;
  return 'Nobody got it this time.';
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: u(8), alignItems: 'stretch' },
  act: { flex: 1, paddingHorizontal: u(8) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  result: { fontFamily: SL.body, fontSize: u(16), lineHeight: u(21) },
  option: { flexDirection: 'row', alignItems: 'center', gap: u(12), borderWidth: SL.frameW * 0.6, borderColor: SL.frame, borderRadius: u(4), paddingVertical: u(12), paddingHorizontal: u(14), minHeight: u(62) },
  optNo: { fontFamily: SL.head, fontSize: u(24), color: SL.yellow, width: u(18) },
  optT: { fontFamily: SL.head, fontSize: u(18), lineHeight: u(21), color: SL.chalk },
  optF: { fontFamily: SL.body, fontSize: u(12.5) },
  hold: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: u(14), paddingVertical: u(16), alignItems: 'center' },
  holdT: { fontFamily: SL.head, fontSize: u(17) },
});
