import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { u } from '@/theme/scale';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { CaseBoard } from './CaseBoard';
import { CasePause } from './screens';
import { scoreRun, type RunEvent } from './core';
import { CASES, PLAYED_KEY, caseById, caseLabel, dossierOf, type Played } from './data';
import { Btn, Card, CaseTitle, Kicker, NR, NoirScreen, Stamp, T, caseClock } from './noir';
import { currentSeat, finishedLines, rankOffline, ready, removeSeat, snapshotOffline, startOffline, stepOffline, type OfflineRun } from './offline';

/** A case none of this phone's Solo plays has opened if there is one, else any (as coded, phone owner only). */
function pickCase(played: Played, seed: string) {
  const fresh = CASES.filter((c) => !played[c.id]);
  const pool = fresh.length ? fresh : CASES;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length].id;
}

/** Offline (CF8, CF10, TMG-CF): the same case for everyone, played alone in turn, sealed until all finish. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  // A bookmark whose case has left the library since starts fresh.
  const [o, setO] = useState<OfflineRun | null>(() => {
    const saved = play.resume as OfflineRun | null;
    return saved && caseById.has(saved.caseId) ? saved : null;
  });
  const ref = useRef(o);
  const [discharge, setDischarge] = useState(false);
  const teams = useMemo(() => teamsOf(play), [play]);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const nameOf = useCallback((seat: number) => seatOf.get(seat)?.name ?? `Player ${seat + 1}`, [seatOf]);
  const colorOf = (seat: number) => {
    const team = teams?.find((t) => t.id === seatOf.get(seat)?.team);
    return team?.color ?? seatOf.get(seat)?.color ?? NR.red;
  };

  const save = useCallback(
    (next: OfflineRun) => {
      ref.current = next;
      setO(next);
      engine.recorder.bookmark(play.id, snapshotOffline(caseById.get(next.caseId)!, next, Date.now()), 0);
    },
    [play.id],
  );

  useEffect(() => {
    if (ref.current) return;
    engine.kv.get<Played>(PLAYED_KEY).then((p) => {
      if (ref.current) return;
      save(startOffline(pickCase(p ?? {}, play.id), play.seats.filter((x) => !x.removed).map((x) => x.seat)));
    });
  }, [play, save]);

  const dispatch = useCallback(
    (e: RunEvent) => {
      const cur = ref.current;
      if (!cur) return;
      const def = caseById.get(cur.caseId)!;
      const next = stepOffline(def, cur, e);
      if (next === cur) return;
      save(next);
      if (next.done.length > cur.done.length) {
        const d = next.done[next.done.length - 1];
        const sc = scoreRun(def, d.run);
        recordItem(play, {
          seat: d.seat,
          itemId: def.id,
          answerKey: dossierOf(def.final),
          outcome: sc.solved ? 'right' : 'wrong',
          answersGiven: [d.run.provisional?.id, d.run.redemption?.id].filter((x): x is string => !!x),
          timeMs: d.run.finalMs ?? d.run.elapsedMs,
          hintsUsed: 0,
          revealsUsed: 0,
          points: sc.total,
          // CF5 for the phone owner only; Offline pays no EXP.
          feedsLearn: d.seat === 0 && d.run.provisional?.correct === false,
          gameData: { exp: 0, stamp: sc.stamp, dd: d.run.dd, filtered: d.run.filtered, ddRight: sc.ddRight, ddWrong: sc.ddWrong, final: def.final },
        });
      }
    },
    [play, save],
  );

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!o) return <NoirScreen>{null}</NoirScreen>;
  const def = caseById.get(o.caseId)!;
  const menu = (
    <CasePause
      open={o.run?.phase === 'paused'}
      mode="offline"
      seats={play.seats.map((x) => ({ ...x, removed: x.removed || !o.order.includes(x.seat) }))}
      keep={[0]}
      onResume={() => dispatch({ type: 'RESUME', now: Date.now() })}
      onQuit={onQuit}
      onRemove={(x) => {
        engine.recorder.removeSeat(play.id, x);
        save(removeSeat(o, x));
      }}
    />
  );

  if (o.phase === 'done') {
    const ranked = rankOffline(def, o);
    const standings = ranked.map((r) => ({ seat: r.seat, name: nameOf(r.seat), score: r.score.total, timeMs: r.timeMs, rank: r.rank }));
    if (discharge)
      return (
        <NoirScreen scroll>
          <Kicker>{`${caseLabel(def.id)} · follow-up and discharge`}</Kicker>
          <CaseTitle title={def.title} />
          <Card style={{ gap: u(10) }}>
            <T size={11} color={NR.red} style={{ letterSpacing: 2 }}>{`THE DIAGNOSIS: ${def.final.toUpperCase()}`}</T>
            {def.discharge.split(/\n+/).map((p, i) => (
              <T key={i} size={14} color={NR.cardInk} style={{ lineHeight: u(21) }}>{p}</T>
            ))}
          </Card>
          <Btn ghost label="Back" onPress={() => setDischarge(false)} />
        </NoirScreen>
      );
    return (
      <NoirScreen scroll>
        <View style={{ gap: u(2) }}>
          <Kicker>Everyone has finished · seal broken</Kicker>
          <CaseTitle title={def.title} />
        </View>
        <Card style={{ gap: u(4) }}>
          <T size={11} color={NR.red} style={{ letterSpacing: 2 }}>THE DIAGNOSIS</T>
          <T size={17} color={NR.cardInk}>{def.final}</T>
        </Card>
        <View style={{ gap: u(8) }}>
          {ranked.map((r, i) => (
            <Animated.View key={r.seat} entering={FadeIn.delay(200 + i * 180).duration(260)} style={s.rank}>
              <T size={18} color={NR.dim} style={{ width: u(24) }}>{r.rank}</T>
              <View style={[s.dot, { backgroundColor: colorOf(r.seat) }]} />
              <View style={{ flex: 1, gap: u(4) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(10) }}>
                  <T size={14} lines={1} style={{ flexShrink: 1 }}>{nameOf(r.seat)}</T>
                  <Stamp word={r.score.stamp} size={8} />
                </View>
                <T size={11} color={NR.soft}>{`${caseClock(r.timeMs)} · differential +${r.score.dd} · time +${r.score.time}`}</T>
              </View>
              <T size={18} color={NR.red} style={{ minWidth: u(30), textAlign: 'right' }}>{r.score.total}</T>
            </Animated.View>
          ))}
        </View>
        <Btn ghost label="Read the discharge" onPress={() => setDischarge(true)} />
        <Btn label="See results" onPress={() => onFinish(standings.find((x) => x.seat === 0)?.score ?? 0, standings)} />
      </NoirScreen>
    );
  }

  if (o.phase === 'handoff' || !o.run) {
    const seat = currentSeat(o);
    const lines = finishedLines(o, nameOf);
    return (
      <NoirScreen>
        <View style={{ flex: 1, justifyContent: 'center', gap: u(16) }}>
          <View style={{ gap: u(4) }}>
            <Kicker>{`Player ${o.turn + 1} of ${o.order.length}`}</Kicker>
            <T size={14} color={NR.soft}>Pass the phone to</T>
            <T size={34} color={colorOf(seat)}>{nameOf(seat)}</T>
          </View>
          <Card style={{ gap: u(4) }}>
            <T size={10} color={NR.cardSoft} style={{ letterSpacing: 1.5 }}>{caseLabel(def.id)}</T>
            <T size={18} color={NR.cardInk}>{def.title}</T>
            <T size={12} color={NR.cardSoft}>The same case for everyone. Results stay sealed until the last player closes it.</T>
          </Card>
          {lines.length ? (
            <View style={s.recap}>
              {lines.map((l) => (
                <T key={l} size={12.5} color={NR.soft}>{`— ${l}`}</T>
              ))}
            </View>
          ) : null}
        </View>
        <Btn label="Start my case" onPress={() => save(ready(o, Date.now()))} />
        {menu}
      </NoirScreen>
    );
  }

  return (
    <>
      <CaseBoard
        key={`${o.turn}:${currentSeat(o)}`}
        def={def}
        run={o.run}
        sealed
        kicker={`${nameOf(currentSeat(o))} · ${caseLabel(def.id)}`}
        onEvent={dispatch}
        onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      />
      {menu}
    </>
  );
}

const s = StyleSheet.create({
  rank: { flexDirection: 'row', alignItems: 'center', gap: u(8), borderBottomWidth: 1, borderColor: NR.line, paddingBottom: u(8) },
  dot: { width: u(10), height: u(10), borderRadius: u(5) },
  recap: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: NR.line, paddingVertical: u(8), gap: u(3) },
});
