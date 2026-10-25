import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { call } from '@/online/api';
import { AlertPill, Countdown, useAlerts } from '@/online/live';
import { settingsLine } from '@/online/format';
import { useRace, type RacePlayer, type RaceState } from '@/online/race';
import { RoomLookProvider } from '@/online/look';
import { RoomTalk } from '@/online/TalkBar';
import { u } from '@/theme/scale';
import { useRaceRevealSound } from '@/online/raceSound';
import { useBackPause } from '@/online/backPause';

import { engine } from '../engine';
import { playerColour } from '../shell/characters';
import { presetTeam } from '../shell/teams';
import type { OnlineProps } from '../shell/types';
import { CaseBoard } from './CaseBoard';
import { scoreRun, stageOf, startRun, stepRun, type Run, type RunEvent } from './core';
import { CASES, caseLabel, dossierOf } from './data';
import { Card, CaseTitle, Kicker, NR, NoirScreen, Stamp, T, caseClock } from './noir';
import { CasePause, NOIR_KIT } from './screens';

const caseOf = (n: number) => CASES[n - 1];

/**
 * Case Files Online (CF9, CF11, CF12, TMG-CF): everyone works the same random case alone, against the host's time
 * limit. Others' stages and solves show live; points stay sealed until the case closes for everyone. The phone reports
 * each stage and answer, and the server scores them (CF7).
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const runRef = useRef<Run | null>(null);
  // Every case of this match by its place in the row (1 to 3 back to back, points add up).
  const runs = useRef(new Map<number, Run>());
  const toItems = useCallback((st: RaceState) => {
    const list = st.my_items?.length ? st.my_items : [{ index: 0, item: st.item ?? 1, solved_ms: null, points: 0 }];
    return list.map((m) => {
      const c = caseOf(m.item);
      const run = runs.current.get(m.index) ?? null;
      const sc = run ? scoreRun(c, run) : null;
      const solved = m.solved_ms != null;
      return {
        seat: 0,
        itemId: c.id,
        answerKey: dossierOf(c.final),
        outcome: solved ? ('right' as const) : run?.provisional || run?.redemption ? ('wrong' as const) : ('timed_out' as const),
        answersGiven: [run?.provisional?.id, run?.redemption?.id].filter((x): x is string => !!x),
        timeMs: m.solved_ms ?? (Number(st.settings.timelimit) || 10) * 60_000,
        hintsUsed: 0,
        revealsUsed: 0,
        points: m.points ?? 0,
        // CF5 + ON4: a wrong first diagnosis (even if redeemed) or no diagnosis in time sends the case to Learn.
        feedsLearn: run?.provisional?.correct !== true,
        // "Solo rule each": Solo pays the case's points as EXP.
        gameData: { exp: m.points ?? 0, stamp: solved ? 'SOLVED' : 'CLOSED', dd: run?.dd ?? null, filtered: run?.filtered ?? null, ddRight: sc?.ddRight ?? 0, ddWrong: sc?.ddWrong ?? 0, final: c.final, room: st.room_id },
      };
    });
  }, []);
  const { st, load, server, playing, watchSub, doneLine, notice, setNotice, leave } = useRace(def, roomId, matchId, me, toItems);
  const [run, setRun] = useState<Run | null>(null);
  const [menu, setMenu] = useState(false);
  useBackPause(menu, setMenu);
  const { alert, push } = useAlerts();
  const seen = useRef<Map<string, { stage: string; solved: boolean }> | null>(null);
  // Reports not yet acknowledged by the server, sent in order; a failed one is retried (timer and each poll).
  const pending = useRef<{ report: Record<string, unknown>; tries: number }[]>([]);
  const sending = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async function flushReports(): Promise<void> {
    if (sending.current) return;
    sending.current = true;
    let sent = false;
    while (pending.current.length) {
      const head = pending.current[0];
      try {
        await call('cf_step', { m: matchId, ...head.report });
        pending.current.shift();
        sent = true;
      } catch {
        head.tries += 1;
        if (head.tries === 1) setNotice('Couldn’t send that. Trying again…');
        if (head.tries >= 10) {
          pending.current.shift(); // the server keeps refusing it: give up on this one
          setNotice('Couldn’t send that. Check your connection.');
          continue;
        }
        if (retry.current) clearTimeout(retry.current);
        retry.current = setTimeout(() => void flushReports(), 2000);
        break;
      }
    }
    sending.current = false;
    if (sent) load();
  }, [matchId, load, setNotice]);

  // Retry on each poll while the case is open; once it closes nothing more can be scored.
  useEffect(() => {
    if (st && st.phase !== 'case' && st.phase !== 'countdown') pending.current = [];
    else if (pending.current.length) void flush();
  }, [st, flush]);
  useEffect(() => () => {
    if (retry.current) clearTimeout(retry.current);
  }, []);

  const teams = Number(st?.settings.teams) || 0;
  const colorOf = (p: RacePlayer | undefined) => (!p ? NR.red : teams >= 2 && p.team != null ? presetTeam(p.team).color : playerColour(st?.players ?? [], p.user_id));

  // Each case opens for everyone at once. GB4: the run is bookmarked per case of the match, so a killed app or a
  // remount picks up the same board (the stopwatch kept running, as the server's clock did) and re-sends its answers;
  // the server keeps only the first of each, so a repeat changes nothing.
  const index = st?.index ?? 0;
  const total = st?.total ?? 1;
  const runKey = `cf-online:${matchId}:${index}`;
  const opening = useRef(-1);
  useEffect(() => {
    if (!st || st.phase !== 'case' || st.item == null || opening.current === st.index) return;
    opening.current = st.index;
    const at = st.index;
    const id = caseOf(st.item).id;
    runRef.current = null;
    setRun(null);
    void (async () => {
      let saved: Run | null = null;
      try {
        saved = await engine.kv.get<Run>(runKey);
      } catch {
        saved = null;
      }
      if (runRef.current || opening.current !== at) return;
      const r = saved && saved.caseId === id ? saved : startRun(id, Date.now());
      runRef.current = r;
      runs.current.set(at, r);
      setRun(r);
      if (r === saved) {
        pending.current.push({
          report: { stage: stageOf(r), filtered: r.filtered, provisional: r.provisional?.id ?? null, redemption: r.redemption?.id ?? null },
          tries: 0,
        });
        void flush();
      } else void engine.kv.set(runKey, r).catch(() => {});
    })();
  }, [st, runKey, flush]);
  useEffect(() => {
    if (st && st.phase !== 'case' && st.phase !== 'countdown') void engine.kv.remove(runKey).catch(() => {});
  }, [st?.phase, runKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // A new case: its alerts start from scratch (everyone is back at History).
  useEffect(() => {
    seen.current = null;
  }, [index]);

  // CF9 alerts: "Sara reached Investigations", "Omar solved it".
  useEffect(() => {
    if (!st || st.phase !== 'case') return;
    const now = new Map(st.players.map((p) => [p.user_id, { stage: p.stage ?? 'History', solved: p.solved }]));
    if (!seen.current) {
      seen.current = now;
      return;
    }
    for (const p of st.players) {
      const was = seen.current.get(p.user_id);
      const is = now.get(p.user_id)!;
      if (p.user_id === me || !was) continue;
      if (is.solved && !was.solved) push(`${p.name} solved it`, colorOf(p));
      else if (is.stage !== was.stage && is.stage !== 'Finished') push(`${p.name} reached ${is.stage}`, colorOf(p));
    }
    seen.current = now;
  }, [st, me, push]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = st?.item;
  const dispatch = useCallback(
    (e: RunEvent) => {
      const prev = runRef.current;
      if (!prev || !item) return;
      const c = caseOf(item);
      const next = stepRun(c, prev, e, true);
      if (next === prev) return;
      runRef.current = next;
      runs.current.set(index, next);
      setRun(next);
      void engine.kv.set(runKey, next).catch(() => {});
      // Report what changed: the stage, the narrowed list (scored once), the provisional, the last call.
      const report = {
        stage: stageOf(next),
        filtered: !prev.filtered && next.filtered ? next.filtered : null,
        provisional: !prev.provisional && next.provisional ? next.provisional.id : null,
        redemption: !prev.redemption && next.redemption ? next.redemption.id : null,
      };
      if (report.stage !== stageOf(prev) || report.filtered || report.provisional || report.redemption) {
        pending.current.push({ report, tries: 0 });
        void flush();
      }
    },
    [item, index, flush, runKey],
  );

  useRaceRevealSound(st, me);
  if (!st) return <NoirScreen>{null}</NoirScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <NoirScreen>
        <Countdown ms={st.phase_ends_at - server} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />
      </NoirScreen>
    );
  }

  const c = caseOf(st.item);
  const mine = st.players.find((p) => p.user_id === me);
  const talker = { id: me, name: mine?.name ?? 'You', face: mine?.character ?? 'yara' };
  const left = Math.max(0, st.phase_ends_at - server);
  // With 2 or 3 cases: "Case 1 of 3 · ".
  const row = total > 1 ? `Case ${index + 1} of ${total} · ` : '';
  const extras = (
    <>
      <AlertPill alert={alert} />
      <RoomLookProvider value={NOIR_KIT.look}><RoomTalk room={roomId} me={talker} /></RoomLookProvider>
    </>
  );

  // The seal breaks: the diagnosis, then everyone's stamp and points.
  if (st.phase !== 'case') {
    const rows = [...st.players].filter((p) => !p.dropped).sort((a, b) => b.score - a.score || a.solve_ms - b.solve_ms);
    return (
      <NoirScreen scroll>
        <View style={{ gap: u(2) }}>
          <Kicker>{`${row}${caseLabel(c.id)} · seal broken`}</Kicker>
          <CaseTitle title={c.title} />
        </View>
        <Card style={{ gap: u(4) }}>
          <T size={11} color={NR.red} style={{ letterSpacing: 2 }}>THE DIAGNOSIS</T>
          <T size={17} color={NR.cardInk}>{c.final}</T>
        </Card>
        <View style={{ gap: u(8) }}>
          {rows.map((p, i) => (
            <Animated.View key={p.user_id} entering={FadeIn.delay(200 + i * 180).duration(260)} style={s.rank}>
              <T size={18} color={NR.dim} style={{ width: u(24) }}>{String(i + 1)}</T>
              <View style={[s.dot, { backgroundColor: colorOf(p) }]} />
              <View style={{ flex: 1, gap: u(4) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(10) }}>
                  <T size={14} lines={1} style={{ flexShrink: 1 }}>{p.user_id === me ? 'You' : p.name}</T>
                  <Stamp word={p.solved ? 'SOLVED' : 'CLOSED'} size={8} />
                </View>
                <T size={11} color={NR.soft}>{`${total > 1 ? `+${p.item_points ?? 0} this case · ` : ''}${p.done ? (total > 1 ? 'finished' : `finished in ${caseClock(p.solve_ms)}`) : 'ran out of time'}`}</T>
              </View>
              <T size={18} color={NR.red} style={{ minWidth: u(30), textAlign: 'right' }}>{String(p.score)}</T>
            </Animated.View>
          ))}
        </View>
        <T size={12} color={NR.soft} style={{ textAlign: 'center' }}>{st.phase === 'done' ? doneLine : `${index + 1 < total ? 'Next case' : 'Results'} in ${Math.max(0, Math.ceil(left / 1000))} s`}</T>
        {extras}
      </NoirScreen>
    );
  }

  // Watching, or your case is closed: sealed until everyone finishes or time runs out.
  if (!playing || !run || run.phase === 'done') {
    const others = st.players.filter((p) => p.user_id !== me && !p.dropped);
    return (
      <NoirScreen>
        <View style={{ flex: 1, justifyContent: 'center', gap: u(16) }}>
          <View style={{ gap: u(4) }}>
            <Kicker>{`${row}${caseLabel(c.id)} · ${caseClock(left, true)} left`}</Kicker>
            <CaseTitle title={playing ? 'Case closed. Sealed.' : 'You’re watching'} />
            <T size={12.5} color={NR.soft}>{playing ? 'Your stamp and points stay sealed until everyone closes the case or time runs out.' : watchSub}</T>
          </View>
          <View style={s.recap}>
            {others.map((p) => (
              <T key={p.user_id} size={12.5} color={NR.soft}>{`— ${p.name}: ${p.done ? (total > 1 ? 'finished' : `finished in ${caseClock(p.solve_ms)}`) : `at ${p.stage ?? 'History'}`}`}</T>
            ))}
          </View>
        </View>
        {extras}
      </NoirScreen>
    );
  }

  return (
    <>
      <CaseBoard def={c} run={run} sealed kicker={`${caseClock(left, true)} left · ${row}${caseLabel(c.id)}`} onEvent={dispatch} onPause={() => setMenu(true)} />
      {notice ? (
        <View style={s.notice} pointerEvents="none">
          <T size={12} color={NR.white}>{notice}</T>
        </View>
      ) : null}
      {extras}
      <CasePause open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </>
  );
}

const s = StyleSheet.create({
  rank: { flexDirection: 'row', alignItems: 'center', gap: u(8), borderBottomWidth: 1, borderColor: NR.line, paddingBottom: u(8) },
  dot: { width: u(10), height: u(10), borderRadius: u(5) },
  recap: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: NR.line, paddingVertical: u(8), gap: u(3) },
  notice: { position: 'absolute', bottom: u(90), left: u(16), right: u(16), alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: u(10), padding: u(8) },
});
