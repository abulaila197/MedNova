import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { YOU, type Rules } from '@/bots/race/engine';
import { useBotRace } from '@/bots/race/useBotRace';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown } from '@/match/live';
import type { RacePlayer, RaceState } from '@/match/race';
import { RoomTalk } from '@/match/TalkBar';
import { u } from '@/theme/scale';

import { engine } from '../engine';
import { playerColour } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import { gameDef } from '../shell/registry';
import { presetTeam } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { CaseBoard } from './CaseBoard';
import { scoreRun, stageOf, startRun, stepRun, type Run, type RunEvent } from './core';
import { CASES, DIAGNOSES, caseLabel, dossierOf } from './data';
import { Card, CaseTitle, Kicker, NR, NoirScreen, Stamp, T, caseClock } from './noir';
import { casePlan, parseWork, stageAt, type CaseWork } from './rivals';
import { tr, TA_END } from '@/i18n';

const caseOf = (n: number) => CASES[n - 1];
const indexOfCase = new Map(CASES.map((c, i) => [c.id, i + 1]));
const POOL = DIAGNOSES.map((d) => d.label);
/** The seal breaks: long enough to read everyone's answers before the next case. */
const REVEAL_MS = 12_000;

/** The rules for one match: each rival works the case at its pace; points as Solo scores a case, yours from your own board. */
function rulesFor(limitMs: number, runs: Map<number, Run>): Rules {
  return {
    limitMs,
    revealMs: REVEAL_MS,
    lockMs: 0,
    maxPoints: 90,
    plan: (_bot, x) => casePlan(x.mind, caseOf(x.item), { seed: x.seed, limitMs, gap: x.gap, progress: x.progress, pool: POOL }),
    points: () => 0,
    scoreAll: (item, rows) => {
      const c = caseOf(item);
      const out: Record<string, number> = {};
      for (const x of rows) {
        if (x.id === YOU) {
          const run = runs.get(item);
          out[YOU] = run ? scoreRun(c, run).total : 0;
        } else out[x.id] = parseWork(x.answer)?.points ?? 0;
      }
      return out;
    },
    answerOf: (item) => caseOf(item)?.final ?? null,
  };
}

/** Each case is one item; its points are your EXP ("Solo rule each"). A wrong first diagnosis, or none in time, goes to Learn. */
function itemsOf(runs: Map<number, Run>, limitMs: number) {
  return (st: RaceState) =>
    (st.my_items ?? [])
      .filter((m) => !!caseOf(m.item))
      .map((m) => {
        const c = caseOf(m.item);
        const run = runs.get(m.item) ?? null;
        const sc = run ? scoreRun(c, run) : null;
        const solved = !!sc?.solved;
        return {
          seat: 0,
          itemId: c.id,
          answerKey: dossierOf(c.final),
          outcome: solved ? ('right' as const) : run?.provisional || run?.redemption ? ('wrong' as const) : ('timed_out' as const),
          answersGiven: [run?.provisional?.id, run?.redemption?.id].filter((x): x is string => !!x),
          timeMs: run?.finalMs ?? limitMs,
          hintsUsed: 0,
          revealsUsed: 0,
          points: m.points ?? 0,
          feedsLearn: run?.provisional?.correct !== true,
          gameData: { exp: m.points ?? 0, stamp: solved ? 'SOLVED' : 'CLOSED', dd: run?.dd ?? null, filtered: run?.filtered ?? null, ddRight: sc?.ddRight ?? 0, ddWrong: sc?.ddWrong ?? 0, final: c.final, rank: m.rank },
        };
      });
}

type Cf = NonNullable<RacePlayer['cf']>;
const cfOfRun = (r: Run | null | undefined): Cf | null => (r ? { first: r.dd, dd: r.filtered ?? r.dd, prov: r.provisional?.id ?? null, redeem: r.redemption?.id ?? null } : null);
const cfOfWork = (w: CaseWork | null): Cf | null => (w ? { first: w.first, dd: w.dd, prov: w.prov, redeem: w.redeem } : null);

/**
 * Case showdown (Case Files vs rivals, G5): everyone works the same random case alone, against the time limit. The
 * rivals' stages and solves show live; points stay sealed until the case closes for everyone, then every answer shows.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const limitMs = (Number(play.settings.timelimit) || 10) * 60_000;
  // Your board on each case of the match, by case number (the rules score it when the case closes).
  const [runs] = useState(() => new Map<number, Run>());
  const [rules] = useState(() => rulesFor(limitMs, runs));
  const [toItems] = useState(() => itemsOf(runs, limitMs));
  const g = useBotRace({
    play,
    onFinish,
    onQuit,
    rules,
    pick: async () => {
      const n = Math.min(3, Math.max(1, Number(play.settings.count) || 1));
      return (await engine.picker.pick(play.game, CASES.map((x) => x.id), n)).map((id) => indexOfCase.get(id)!).filter(Boolean);
    },
    toItems,
    solvedText: (name) => tr('{name} solved it', { name }),
  });
  const { st, race, t, push } = g;
  const seen = useRef<{ index: number; stages: Map<string, string> } | null>(null);

  const teams = Number(play.settings.teams) || 0;
  const colorOf = (p: RacePlayer | undefined) => (!p ? NR.red : teams >= 2 && p.team != null ? presetTeam(p.team).color : playerColour(st?.players ?? [], p.user_id));

  /** Where each rival is on the case now (from its plan), and its answers once the seal breaks. */
  const workOf = (id: string, index: number): CaseWork | null => parseWork(race?.plansAt(index)?.[id]?.answer);
  const stageFor = (p: RacePlayer): string => {
    if (!st) return tr('History');
    if (p.user_id === YOU) {
      const run = runs.get(st.item ?? 0);
      return run ? stageOf(run) : tr('History');
    }
    return stageAt(workOf(p.user_id, st.index), t - st.phase_started_at, p.done);
  };

  // CF9 alerts: "Sara reached Investigations", "Omar closed the case" (a solve says so through the race's own alert).
  useEffect(() => {
    if (!st || st.phase !== 'case') return;
    const now = new Map(st.players.map((p) => [p.user_id, stageFor(p)]));
    if (!seen.current || seen.current.index !== st.index) {
      seen.current = { index: st.index, stages: now };
      return;
    }
    for (const p of st.players) {
      const was = seen.current.stages.get(p.user_id);
      const is = now.get(p.user_id)!;
      if (p.user_id === YOU || !was || is === was) continue;
      if (is === 'Finished') {
        if (!p.solved) push(tr('{name} closed the case', { name: p.name }), colorOf(p));
      } else push(tr('{name} reached {stage}', { name: p.name, stage: tr(is) }), colorOf(p));
    }
    seen.current.stages = now;
  }, [st, t, push]); // eslint-disable-line react-hooks/exhaustive-deps

  const menu = <PauseMenu open={g.menu} mode="bots" onResume={g.closeMenu} onQuit={g.quit} />;
  if (!st || !race) return <NoirScreen>{null}</NoirScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <NoirScreen>
        <Countdown ms={st.phase_ends_at - t} faces={st.players.map((p) => p.character)} line={settingsLine(gameDef(play.game), play.settings)} />
        <RoomTalk room={g.room} me={g.talker} />
        {menu}
      </NoirScreen>
    );
  }

  const c = caseOf(st.item);
  const index = st.index;
  const total = st.total;
  const left = Math.max(0, st.phase_ends_at - t);
  const row = total > 1 ? tr('Case {n} of {total} · ', { n: index + 1, total }) : '';
  const myRun = runs.get(st.item) ?? null;
  const extras = (
    <>
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </>
  );

  // The seal breaks: the diagnosis, then everyone's stamp, points and answers.
  if (st.phase !== 'case') {
    const rows = [...st.players].sort((a, b) => b.score - a.score || (a.item_rank ?? 9) - (b.item_rank ?? 9));
    const doneMs = (p: RacePlayer) => (p.user_id === YOU ? (myRun?.finalMs ?? null) : (race.plansAt(index)?.[p.user_id]?.doneAt ?? null));
    return (
      <NoirScreen scroll>
        <View style={{ gap: u(2) }}>
          <Kicker>{tr('{row}{n} · seal broken', { row, n: caseLabel(c.id) })}</Kicker>
          <CaseTitle title={c.title} />
        </View>
        <Card style={{ gap: u(4) }}>
          <T size={11} color={NR.red} style={{ letterSpacing: 2 }}>{tr('THE DIAGNOSIS')}</T>
          <T size={17} color={NR.cardInk}>{c.final}</T>
          <T size={11} color={NR.cardSoft} style={{ letterSpacing: 2, marginTop: u(6) }}>{tr('THE DOCTOR’S LIST')}</T>
          <T size={12.5} color={NR.cardInk}>{c.answers.join('  /  ')}</T>
        </Card>
        <View style={{ gap: u(8) }}>
          {rows.map((p, i) => {
            const cf = p.user_id === YOU ? cfOfRun(myRun) : cfOfWork(workOf(p.user_id, index));
            const ms = doneMs(p);
            const how = p.done ? (total > 1 ? 'finished' : tr('finished in {n}', { n: caseClock(ms ?? limitMs) })) : myRun && p.user_id === YOU && (myRun.provisional || myRun.redemption) ? tr('answered, didn’t end the case') : tr('ran out of time');
            return (
              <Animated.View key={p.user_id} entering={FadeIn.delay(200 + i * 180).duration(260)} style={[s.rank, cf ? { alignItems: 'flex-start' } : null]}>
                <T size={18} color={NR.dim} style={{ width: u(24) }}>{String(i + 1)}</T>
                <View style={[s.dot, { backgroundColor: colorOf(p) }]} />
                <View style={{ flex: 1, gap: u(4) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(10) }}>
                    <T size={14} lines={1} style={{ flexShrink: 1 }}>{p.user_id === YOU ? tr('You') : p.name}</T>
                    <Stamp word={p.solved ? 'SOLVED' : 'CLOSED'} size={8} />
                  </View>
                  <T size={11} color={NR.soft}>{tr('{n}{how}', { n: total > 1 ? tr('+{v} this case · ', { v: p.item_points ?? 0 }) : '', how })}</T>
                  {cf ? <Answers cf={cf} answers={c.answers} final={c.final} /> : null}
                </View>
                <T size={18} color={NR.red} style={{ minWidth: u(30), textAlign: TA_END }}>{String(p.score)}</T>
              </Animated.View>
            );
          })}
        </View>
        <T size={12} color={NR.soft} style={{ textAlign: 'center' }}>{st.phase === 'done' ? tr('Adding up the scores…') : tr('{n} in {max} s', { n: index + 1 < total ? tr('Next case') : tr('Results'), max: Math.max(0, Math.ceil(left / 1000)) })}</T>
        {extras}
      </NoirScreen>
    );
  }

  // Your case is closed: sealed until everyone finishes or time runs out.
  if (myRun?.phase === 'done') {
    const others = st.players.filter((p) => p.user_id !== YOU);
    return (
      <NoirScreen>
        <View style={{ flex: 1, justifyContent: 'center', gap: u(16) }}>
          <View style={{ gap: u(4) }}>
            <Kicker>{tr('{row}{n} · {n2} left', { row, n: caseLabel(c.id), n2: caseClock(left, true) })}</Kicker>
            <CaseTitle title={tr('Case closed. Sealed.')} />
            <T size={12.5} color={NR.soft}>{tr('Your stamp and points stay sealed until every rival closes the case or time runs out.')}</T>
          </View>
          <View style={s.recap}>
            {others.map((p) => (
              <T key={p.user_id} size={12.5} color={NR.soft}>{tr('— {name}: {n}', { name: p.name, n: p.done ? (total > 1 ? tr('finished') : tr('finished in {v}', { v: caseClock(race.plansAt(index)?.[p.user_id]?.doneAt ?? 0) })) : tr('at {v}', { v: tr(stageFor(p)) }) })}</T>
            ))}
          </View>
        </View>
        {extras}
      </NoirScreen>
    );
  }

  return (
    <>
      <CaseRun
        key={index}
        c={c}
        item={st.item}
        start={st.phase_started_at}
        runs={runs}
        now={() => g.at((at) => at) ?? t}
        paused={g.paused}
        kicker={`${row}${caseLabel(c.id)}`}
        countdown={tr('{n} left', { n: caseClock(left, true) })}
        onPause={g.openMenu}
        onDone={(solved) => (solved ? g.solve({ guess: 'solved' }) : g.miss({ guess: 'closed' }))}
      />
      {extras}
    </>
  );
}

/** Your board on one case: the Solo rules, on match time (a pause stops the clock for you and the rivals alike). */
function CaseRun({ c, item, start, runs, now, paused, kicker, countdown, onPause, onDone }: {
  c: (typeof CASES)[number]; item: number; start: number; runs: Map<number, Run>; now: () => number; paused: boolean; kicker: string; countdown: string; onPause: () => void; onDone: (solved: boolean) => void;
}) {
  const [run, setRun] = useState<Run>(() => {
    const r = runs.get(item) ?? startRun(c.id, start);
    runs.set(item, r);
    return r;
  });
  const ref = useRef(run);
  const dispatch = useCallback(
    (e: RunEvent) => {
      if (paused) return;
      const prev = ref.current;
      const ev = 'now' in e ? { ...e, now: now() } : e;
      // #10 (Yazan 2026-11-04): the discharge opens to each player (not sealed), then End the case.
      const next = stepRun(c, prev, ev, false);
      if (next === prev) return;
      ref.current = next;
      runs.set(item, next);
      setRun(next);
      if (next.phase === 'done' && prev.phase !== 'done') onDone(scoreRun(c, next).solved);
    },
    [c, item, runs, now, paused, onDone],
  );
  return <CaseBoard def={c} run={run} sealed online countdown={countdown} kicker={kicker} onEvent={dispatch} onPause={onPause} />;
}

/** #11 (Yazan 2026-11-04): one player's answers on the results, right names ticked. */
function Answers({ cf, answers, final }: { cf: Cf; answers: string[]; final: string }) {
  const list = (l: string[] | null) => (l?.length ? l.map((x) => `${answers.includes(x) ? '✓' : '✗'} ${x}`).join('\n') : '—');
  const call = (x: string | null) => (x ? `${x === final ? '✓' : '✗'} ${x}` : '—');
  const rows: [string, string][] = [
    [tr('First list'), list(cf.first ?? cf.dd)],
    [tr('Narrowed list'), list(cf.dd)],
    [tr('Diagnosis'), call(cf.prov)],
    ...(cf.redeem ? ([[tr('Last call'), call(cf.redeem)]] as [string, string][]) : []),
  ];
  return (
    <View style={s.answers}>
      {rows.map(([k, v]) => (
        <View key={k} style={{ gap: u(1) }}>
          <T size={9.5} color={NR.dim} style={{ letterSpacing: 1.4 }}>{k.toUpperCase()}</T>
          <T size={11.5} color={NR.soft}>{v}</T>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  answers: { gap: u(5), marginTop: u(4), paddingTop: u(6), borderTopWidth: 1, borderColor: NR.line },
  rank: { flexDirection: 'row', alignItems: 'center', gap: u(8), borderBottomWidth: 1, borderColor: NR.line, paddingBottom: u(8) },
  dot: { width: u(10), height: u(10), borderRadius: u(5) },
  recap: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: NR.line, paddingVertical: u(8), gap: u(3) },
});

