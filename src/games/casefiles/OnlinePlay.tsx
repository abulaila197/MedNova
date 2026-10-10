import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { call } from '@/online/api';
import { AlertPill, Countdown, useAlerts } from '@/online/live';
import { settingsLine } from '@/online/format';
import { useRace, type RacePlayer, type RaceState } from '@/online/race';
import { RoomTalk } from '@/online/Talk';
import { u } from '@/theme/scale';

import { characterOf } from '../shell/characters';
import { presetTeam } from '../shell/teams';
import type { OnlineProps } from '../shell/types';
import { CaseBoard } from './CaseBoard';
import { scoreRun, stageOf, startRun, stepRun, type Run, type RunEvent } from './core';
import { CASES, caseLabel, dossierOf } from './data';
import { Card, CaseTitle, Kicker, NR, NoirScreen, Stamp, T, caseClock } from './noir';
import { CasePause } from './screens';

const caseOf = (n: number) => CASES[n - 1];

/**
 * Case Files Online (CF9, CF11, CF12, TMG-CF): everyone works the same random case alone, against the host's time
 * limit. Others' stages and solves show live; points stay sealed until the case closes for everyone. The phone reports
 * each stage and answer, and the server scores them (CF7).
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const runRef = useRef<Run | null>(null);
  const toItems = useCallback((st: RaceState) => {
    const c = caseOf(st.item ?? 1);
    const m = st.my_items?.[0];
    const run = runRef.current;
    const sc = run ? scoreRun(c, run) : null;
    const solved = m?.solved_ms != null;
    return [
      {
        seat: 0,
        itemId: c.id,
        answerKey: dossierOf(c.final),
        outcome: solved ? ('right' as const) : run?.provisional || run?.redemption ? ('wrong' as const) : ('timed_out' as const),
        answersGiven: [run?.provisional?.id, run?.redemption?.id].filter((x): x is string => !!x),
        timeMs: m?.solved_ms ?? (Number(st.settings.timelimit) || 10) * 60_000,
        hintsUsed: 0,
        revealsUsed: 0,
        points: m?.points ?? 0,
        // CF5 + ON4: a wrong first diagnosis (even if redeemed) or no diagnosis in time sends the case to Learn.
        feedsLearn: run?.provisional?.correct !== true,
        // "Solo rule each": Solo pays the case's points as EXP.
        gameData: { exp: m?.points ?? 0, stamp: solved ? 'SOLVED' : 'CLOSED', dd: run?.dd ?? null, filtered: run?.filtered ?? null, ddRight: sc?.ddRight ?? 0, ddWrong: sc?.ddWrong ?? 0, final: c.final, room: st.room_id },
      },
    ];
  }, []);
  const { st, load, server, playing, notice, setNotice, leave } = useRace(def, roomId, matchId, me, toItems);
  const [run, setRun] = useState<Run | null>(null);
  const [menu, setMenu] = useState(false);
  const { alert, push } = useAlerts();
  const seen = useRef<Map<string, { stage: string; solved: boolean }> | null>(null);
  // Reports not yet acknowledged by the server, sent in order; a failed one is retried (timer and each poll).
  const pending = useRef<{ report: Record<string, unknown>; tries: number }[]>([]);
  const sending = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
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
        retry.current = setTimeout(() => void flush(), 2000);
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
  const colorOf = (p: RacePlayer | undefined) => (!p ? NR.red : teams >= 2 && p.team != null ? presetTeam(p.team).color : (characterOf(p.character)?.ring ?? NR.red));

  // The case opens for everyone at once.
  useEffect(() => {
    if (!st || st.phase !== 'case' || st.item == null || runRef.current) return;
    const r = startRun(caseOf(st.item).id, Date.now());
    runRef.current = r;
    setRun(r);
  }, [st]);

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

  const dispatch = useCallback(
    (e: RunEvent) => {
      const prev = runRef.current;
      if (!prev || !st?.item) return;
      const c = caseOf(st.item);
      const next = stepRun(c, prev, e, true);
      if (next === prev) return;
      runRef.current = next;
      setRun(next);
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
    [st?.item, flush],
  );

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
  const extras = (
    <>
      <AlertPill alert={alert} />
      <RoomTalk room={roomId} me={talker} />
    </>
  );

  // The seal breaks: the diagnosis, then everyone's stamp and points.
  if (st.phase !== 'case') {
    const rows = [...st.players].filter((p) => !p.dropped).sort((a, b) => b.score - a.score || a.solve_ms - b.solve_ms);
    return (
      <NoirScreen scroll>
        <View style={{ gap: u(2) }}>
          <Kicker>{`${caseLabel(c.id)} · seal broken`}</Kicker>
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
                <T size={11} color={NR.soft}>{p.done ? `finished in ${caseClock(p.solve_ms)}` : 'ran out of time'}</T>
              </View>
              <T size={18} color={NR.red} style={{ minWidth: u(30), textAlign: 'right' }}>{String(p.score)}</T>
            </Animated.View>
          ))}
        </View>
        <T size={12} color={NR.soft} style={{ textAlign: 'center' }}>{st.phase === 'done' ? 'Adding up the scores…' : `Results in ${Math.max(0, Math.ceil(left / 1000))} s`}</T>
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
            <Kicker>{`${caseLabel(c.id)} · ${caseClock(left, true)} left`}</Kicker>
            <CaseTitle title={playing ? 'Case closed. Sealed.' : 'You’re watching'} />
            <T size={12.5} color={NR.soft}>{playing ? 'Your stamp and points stay sealed until everyone closes the case or time runs out.' : 'You get a seat at the rematch.'}</T>
          </View>
          <View style={s.recap}>
            {others.map((p) => (
              <T key={p.user_id} size={12.5} color={NR.soft}>{`— ${p.name}: ${p.done ? `finished in ${caseClock(p.solve_ms)}` : `at ${p.stage ?? 'History'}`}`}</T>
            ))}
          </View>
        </View>
        {extras}
      </NoirScreen>
    );
  }

  return (
    <>
      <CaseBoard def={c} run={run} sealed kicker={`${caseClock(left, true)} left · ${caseLabel(c.id)}`} onEvent={dispatch} onPause={() => setMenu(true)} />
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
