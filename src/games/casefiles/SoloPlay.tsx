import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { u } from '@/theme/scale';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import type { PlayProps } from '../shell/types';
import { CaseBoard } from './CaseBoard';
import { CasePause } from './screens';
import { scoreRun, snapshot, startRun, stepRun, type CaseDef, type Run, type RunEvent } from './core';
import { CASES, PLAYED_KEY, caseById, caseLabel, dossierOf, type Played } from './data';
import { Btn, Kicker, NR, NoirScreen, Stamp, T } from './noir';
import { Review } from './Review';

type SoloState = { caseId: string; run: Run; replay: boolean };

/** Solo (CF6): pick any case from the library, play it through; replays are free but earn no EXP. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const [state, setState] = useState<SoloState | null>((play.resume as SoloState | null) ?? null);
  const ref = useRef(state);
  const [played, setPlayed] = useState<Played>({});
  const [review, setReview] = useState(false);

  useEffect(() => {
    engine.kv.get<Played>(PLAYED_KEY).then((p) => setPlayed(p ?? {}));
  }, []);

  const save = useCallback(
    (next: SoloState) => {
      ref.current = next;
      setState(next);
      const def = caseById.get(next.caseId)!;
      engine.recorder.bookmark(play.id, { ...next, run: snapshot(def, next.run, Date.now()) }, 0);
    },
    [play.id],
  );

  const dispatch = useCallback(
    (e: RunEvent) => {
      const cur = ref.current;
      if (!cur) return;
      const def = caseById.get(cur.caseId)!;
      const run = stepRun(def, cur.run, e);
      if (run === cur.run) return;
      save({ ...cur, run });
      if (run.phase === 'done' && cur.run.phase !== 'done') finishCase(def, run, cur.replay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save],
  );

  const finishCase = (def: CaseDef, run: Run, replay: boolean) => {
    const sc = scoreRun(def, run);
    recordItem(play, {
      seat: 0,
      itemId: def.id,
      answerKey: dossierOf(def.final),
      outcome: sc.solved ? 'right' : 'wrong',
      answersGiven: [run.provisional?.id, run.redemption?.id].filter((x): x is string => !!x),
      timeMs: run.finalMs ?? run.elapsedMs,
      hintsUsed: 0,
      revealsUsed: 0,
      points: sc.total,
      feedsLearn: run.provisional?.correct === false, // CF5: a wrong first diagnosis, even if redeemed
      gameData: { exp: replay ? 0 : sc.total, replay, stamp: sc.stamp, dd: run.dd, filtered: run.filtered, ddRight: sc.ddRight, ddWrong: sc.ddWrong, final: def.final },
    });
    const next = { ...played, [def.id]: played[def.id] === 'SOLVED' ? 'SOLVED' : sc.stamp } as Played;
    setPlayed(next);
    engine.kv.set(PLAYED_KEY, next);
    setReview(true);
  };

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!state)
    return (
      <Library
        played={played}
        onPick={(id) => {
          const s0 = { caseId: id, run: startRun(id, Date.now()), replay: played[id] != null };
          save(s0);
        }}
      />
    );

  const def = caseById.get(state.caseId)!;
  if (review || state.run.phase === 'done')
    return <Review def={def} run={state.run} replay={state.replay} onDone={() => onFinish(scoreRun(def, state.run).total)} />;

  return (
    <>
      <CaseBoard
        def={def}
        run={state.run}
        sealed={false}
        kicker={caseLabel(def.id)}
        onEvent={dispatch}
        onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      />
      <CasePause open={state.run.phase === 'paused'} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </>
  );
}

/** The case library: every case open, in order, with the stamp it got on this phone. */
function Library({ played, onPick }: { played: Played; onPick: (id: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const done = Object.keys(played).length;
  return (
    <NoirScreen scroll>
      <View style={{ gap: u(4) }}>
        <Kicker>{`Case library · ${done} of ${CASES.length} closed`}</Kicker>
        <T size={23}>Pick a case</T>
        <T size={12} color={NR.soft}>Every case is open. A case you have played again earns no EXP the second time.</T>
      </View>
      <View style={{ gap: u(6) }}>
        {CASES.map((c) => {
          const stamp = played[c.id];
          const on = pick === c.id;
          return (
            <View key={c.id} style={{ gap: u(6) }}>
            <Pressable onPress={() => setPick(c.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${c.title}${stamp ? `, ${stamp.toLowerCase()}` : ''}`} style={[s.row, on ? s.on : null]}>
              <View style={{ flex: 1 }}>
                <T size={10} color={NR.cardSoft} style={{ letterSpacing: 1.5 }}>{caseLabel(c.id)}</T>
                <T size={14} color={NR.cardInk}>{c.title}</T>
              </View>
              {stamp ? <Stamp word={stamp} size={10} /> : null}
            </Pressable>
            {on ? <Btn label={stamp ? 'Replay this case' : 'Open this case'} onPress={() => onPick(c.id)} /> : null}
            </View>
          );
        })}
      </View>
    </NoirScreen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8), backgroundColor: NR.card, paddingHorizontal: u(12), paddingVertical: u(7), borderRadius: u(10), borderLeftWidth: 4, borderLeftColor: 'transparent' },
  on: { borderLeftColor: NR.red, backgroundColor: '#ffffff' },
});
