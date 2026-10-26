import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { call, leaveRoom } from '@/online/api';
import { finishOnline, useShowResults } from '@/online/finish';
import { AlertPill, Countdown, nth, useAlerts } from '@/online/live';
import { RoomTalk } from '@/online/TalkBar';
import { playerColour } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import { presetTeam } from '../shell/teams';
import type { OnlineProps } from '../shell/types';
import { Btn, GameScreen, Kick } from '../shell/ui';
import { settingsLine } from '@/online/format';
import { CaseBoard } from './CaseBoard';
import { second } from '../engine/timeStore';
import { DP, type Attempt } from './core';
import { caseById, guessName } from './data';
import { useMatchState } from '@/online/useMatchState';
import { useRevealSound } from '@/lib/sound';
import { useBackPause } from '@/online/backPause';

type P = {
  user_id: string;
  name: string;
  character: string;
  team: number | null;
  score: number;
  solve_ms: number;
  dropped: boolean;
  rank: number | null;
  solved: boolean;
  case_rank: number | null;
  case_points: number;
};
type MyCase = { case_index: number; case_number: number; solved_ms: number | null; clues: number | null; rank: number | null; points: number; wrong: string[] };
type DPState = {
  now: number;
  room_id: string;
  phase: 'countdown' | 'case' | 'reveal' | 'done';
  phase_started_at: number;
  phase_ends_at: number;
  case_index: number;
  total: number;
  case_number: number | null;
  answer_id: string | null;
  /** Clues showing now (#18: a right answer brings the next one early); null on old servers and outside a case. */
  clues?: number | null;
  settings: Record<string, unknown>;
  players: P[];
  me: { locked_until: number | null; wrong: string[]; solved_ms: number | null; rank: number | null; points: number; clues: number | null } | null;
  my_cases: MyCase[] | null;
};

const CASE_MS = 60_000;

/**
 * DP Online (DPN1-DPN7): everyone gets the same case, one clue every 10 s, 60 s per case; a right answer by anyone
 * brings the next clue at once and the 10 s restart from it (#18). The server referees (ON17):
 * this screen asks it for the state every second, sends guesses, and shows the result. No Skip, Reveal or Hint online.
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const { st, load, server, notice, setNotice } = useMatchState<DPState>('dp_state', matchId, { shown: (sv, s) => s && `${second(s.phase_ends_at - sv)}:${second(sv - s.phase_started_at)}:${second((s.me?.locked_until ?? 0) - sv)}` });
  const [wrongSeq, setWrongSeq] = useState(0);
  const [menu, setMenu] = useState(false);
  useBackPause(menu, setMenu);
  const seen = useRef<{ key: string; solved: Set<string>; alone: boolean }>({ key: '', solved: new Set(), alone: false });
  const showResults = useShowResults(def.key, matchId, st?.phase === 'done');
  const finishing = useRef(false);
  const { alert, push } = useAlerts();

  // Seated = has a seat (the play is saved at the end); playing = seated and not dropped for being away (GA1).
  const seated = useMemo(() => st?.players.some((p) => p.user_id === me) ?? false, [st, me]);
  const dropped = useMemo(() => st?.players.some((p) => p.user_id === me && p.dropped) ?? false, [st, me]);
  const playing = seated && !dropped;

  // DPN7 alerts: someone else solved ("Sara solved it, 2nd"), and "Only you left".
  useEffect(() => {
    if (!st || st.phase !== 'case') return;
    const key = `${st.case_index}`;
    if (seen.current.key !== key) seen.current = { key, solved: new Set(st.players.filter((p) => p.solved).map((p) => p.user_id)), alone: false };
    for (const p of st.players) {
      if (p.solved && !seen.current.solved.has(p.user_id)) {
        seen.current.solved.add(p.user_id);
        if (p.user_id !== me) push(`${p.name} solved it, ${nth(p.case_rank ?? 1)}`, playerColour(st.players, p.user_id));
      }
    }
    const left = st.players.filter((p) => !p.dropped && !p.solved);
    if (playing && !seen.current.alone && left.length === 1 && left[0].user_id === me && st.players.length > 1) {
      seen.current.alone = true;
      push('Only you left', '#f5b041');
    }
  }, [st, me, playing, push]);

  // The match ended: it becomes an ordinary play on this phone, then the results page (ON21).
  useEffect(() => {
    if (!st || st.phase !== 'done' || !seated || finishing.current) return;
    finishing.current = true;
    (async () => {
      try {
        const order = [...st.players.filter((p) => p.user_id === me), ...st.players.filter((p) => p.user_id !== me)];
        const seatOf = new Map(order.map((p, i) => [p.user_id, i]));
        const teams = Number(st.settings.teams) || 0;
        const seats = order.map((p, i) => {
          const tm = teams >= 2 && p.team != null ? presetTeam(p.team) : null;
          return { seat: i, name: p.user_id === me ? 'You' : p.name, userId: p.user_id, character: p.character, color: tm?.color ?? playerColour(st.players, p.user_id), ...(tm ? { team: tm.id } : null) };
        });
        const standings = st.players
          .map((p) => ({ seat: seatOf.get(p.user_id)!, name: p.user_id === me ? 'You' : p.name, score: p.score, timeMs: p.solve_ms, rank: p.rank ?? st.players.length }))
          .sort((a, b) => a.rank - b.rank);
        const mine = st.players.find((p) => p.user_id === me)!;
        const items = (st.my_cases ?? []).map((m) => {
          const c = caseById.get(String(m.case_number))!;
          const right = m.solved_ms != null;
          return {
            seat: 0,
            itemId: String(m.case_number),
            answerKey: c?.canonical_id ?? null,
            outcome: right ? ('right' as const) : ('timed_out' as const),
            answersGiven: (m.wrong ?? []).map((id) => guessName(id)),
            timeMs: m.solved_ms ?? CASE_MS,
            hintsUsed: 0,
            revealsUsed: 0,
            points: m.points,
            feedsLearn: !right, // DPN5: your own unsolved online cases go to Learn
            gameData: { cluesShown: m.clues, caseRank: m.rank, difficulty: c?.difficulty, room: roomId, match: matchId },
          };
        });
        const settings = { ...st.settings, room: roomId, match: matchId, teams: teams >= 2 ? Array.from({ length: teams }, (_, i) => presetTeam(i)) : undefined };
        const id = await finishOnline(def, matchId, { settings, seats, standings, score: mine.score, items });
        showResults(id);
      } catch {
        finishing.current = false; // the next poll tries again
      }
    })();
  }, [st, seated, me, def, roomId, matchId, showResults]);

  // Already finished on this phone (reopened): go straight to the results.

  const leave = async () => {
    await leaveRoom(roomId).catch(() => {});
    router.replace(`/play/${def.key}`);
  };

  const myRow = st?.players.find((p) => p.user_id === me && !p.dropped);
  // Right or wrong only once the case's answer shows for everyone.
  useRevealSound(st && myRow && st.case_number != null && (st.phase === 'reveal' || st.phase === 'done') ? `${st.case_index}` : null, myRow ? myRow.solved : null);
  if (!st) return <GameScreen scroll={false}>{null}</GameScreen>;

  if (st.phase === 'countdown' || st.case_number == null) {
    return (
      <GameScreen scroll={false}>
        <Countdown ms={st.phase_ends_at - server} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />
      </GameScreen>
    );
  }

  if (st.phase === 'done') {
    return (
      <GameScreen>
        <View style={s.done}>
          <Kick>{seated ? 'Adding up the scores…' : 'Match over'}</Kick>
          {seated ? null : <Btn label="Back to the room" onPress={() => router.replace(`/play/${def.key}/lobby?room=${roomId}`)} />}
        </View>
      </GameScreen>
    );
  }

  const c = caseById.get(String(st.case_number))!;
  const mine = st.players.find((p) => p.user_id === me);
  // Spectators talk too (ON12); their face comes from their seat in the room.
  const talker = { id: me, name: mine?.name ?? 'You', face: mine?.character ?? 'yara' };
  const elapsed = Math.max(0, server - st.phase_started_at);
  const reveal = st.phase === 'reveal';
  const solved = st.me?.solved_ms != null;
  const live = st.clues ?? Math.min(DP.clueCount, Math.floor(elapsed / 10_000) + 1);
  const clues = reveal || solved ? (solved && !reveal ? st.me!.clues ?? DP.clueCount : DP.clueCount) : Math.min(DP.clueCount, Math.max(1, live));
  const attempt: Attempt = { cluesShown: clues, wrong: st.me?.wrong ?? [], reveals: 0, status: solved ? 'solved' : 'active' };
  const left = reveal ? 0 : Math.max(0, st.phase_ends_at - server);
  const lockLeft = st.me?.locked_until ? st.me.locked_until - server : 0;
  const last = st.case_index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - server) / 1000));
  const others = st.players.filter((p) => p.user_id !== me && !p.dropped);
  const waiting = others.filter((p) => !p.solved).length;

  const result = !playing
    ? null
    : solved
      ? {
          outcome: 'right' as const,
          points: st.me!.points,
          line: `${nth(st.me!.rank ?? 1)} to solve · ${st.me!.points} points with ${st.me!.clues} ${st.me!.clues === 1 ? 'clue' : 'clues'}`,
          nextLabel: reveal ? `${last ? 'Results' : 'Next case'} in ${nextIn} s` : waiting ? `Waiting for ${waiting} more` : 'Everyone solved it',
        }
      : reveal
        ? { outcome: 'timed_out' as const, points: 0, line: 'Time ran out. No points this case.', nextLabel: `${last ? 'Results' : 'Next case'} in ${nextIn} s` }
        : null;

  return (
    <CaseBoard
      turnKey={`${st.case_index}`}
      c={reveal || solved ? { ...c, answer_id: st.answer_id ?? c.answer_id } : c}
      attempt={attempt}
      phase={playing && !solved && !reveal ? 'playing' : 'over'}
      title={`Case ${st.case_index + 1}`}
      sub={`of ${st.total}`}
      slim={`Case ${st.case_index + 1} of ${st.total}`}
      clock={{ label: 'Time left', down: true, ms: left, warn: !reveal && left <= 15_000 }}
      wrongSeq={wrongSeq}
      clueSeq={clues}
      actions={false}
      result={result}
      notice={notice ?? (!playing ? (dropped ? 'You were away for over a minute, so you’re watching now.' : 'You’re watching. You get a seat at the rematch.') : lockLeft > 0 ? `Wrong. Locked for ${Math.ceil(lockLeft / 1000)} s.` : null)}
      pausedNote=""
      onPause={() => setMenu(true)}
      onGuess={async (g) => {
        if (lockLeft > 0) return;
        try {
          const r = await call<{ outcome: string }>('dp_guess', { m: matchId, answer: g.id });
          if (r.outcome === 'wrong') setWrongSeq((x) => x + 1);
          else if (r.outcome === 'ignored_finished') setNotice('That guess came too late.');
          await load();
        } catch {
          setNotice('Couldn’t send that. Try again.');
        }
      }}
      onSkip={() => {}}
      onReveal={() => {}}>
      <AlertPill alert={alert} />
      {talker ? <RoomTalk room={roomId} me={talker} /> : null}
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </CaseBoard>
  );
}

const s = StyleSheet.create({
  done: { marginTop: 40, alignItems: 'center', gap: 16 },
});
