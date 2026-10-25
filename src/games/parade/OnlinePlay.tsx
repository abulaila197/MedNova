import { useState } from 'react';

import { call } from '@/online/api';
import { Countdown, nth } from '@/online/live';
import { settingsLine } from '@/online/format';
import { useRace, type RaceState } from '@/online/race';
import { RoomTalk } from '@/online/TalkBar';
import { useRaceRevealSound } from '@/online/raceSound';
import { useBackPause } from '@/online/backPause';
import { PauseMenu } from '../shell/PauseMenu';
import type { OnlineProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { layoutFor, TIME_S, type Answer, type Response, type Round } from './core';
import { QUESTIONS } from './data';
import { ParadeBoard } from './ParadeBoard';

const questionOf = (n: number) => QUESTIONS[n - 1];

const parse = (g: string | undefined): Response | null => {
  if (!g) return null;
  try {
    return JSON.parse(g) as Response;
  } catch {
    return null;
  }
};

/** The same layout on every phone for one question of one match, so faces sit on the same tiles. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function itemsOf(st: RaceState) {
  // An item this app build doesn't have (the server's list is newer) is left out instead of failing the finish (X2).
  return (st.my_items ?? []).filter((m) => !!questionOf(m.item)).map((m) => {
    const q = questionOf(m.item);
    const right = m.solved_ms != null;
    const answered = (m.guesses ?? []).length > 0;
    return {
      seat: 0,
      itemId: q.id,
      answerKey: null,
      outcome: right ? ('right' as const) : answered ? ('wrong' as const) : ('timed_out' as const),
      answersGiven: [],
      timeMs: m.solved_ms ?? TIME_S[q.style] * 1000,
      hintsUsed: 0,
      revealsUsed: 0,
      points: m.points,
      feedsLearn: !right, // QP5 + ON4: every missed question goes to Today's review
      gameData: { style: st.settings.style, field: q.field, kind: q.kind, type: q.style, rank: m.rank, room: st.room_id },
    };
  });
}

/**
 * The Quiz Parade Online (QP1-QP12): everyone gets the same question at once, on its type's clock. The next question
 * starts once everyone has answered. Points by type, the nearest guess takes Closest number, and the first fully
 * right answer gets +1. The server checks every answer.
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const { st, load, server, clock, playing, watchLine, doneLine, notice, setNotice, leave } = useRace(def, roomId, matchId, me, itemsOf);
  const [menu, setMenu] = useState(false);
  useBackPause(menu, setMenu);
  const [sent, setSent] = useState<{ index: number; response: Response } | null>(null);

  useRaceRevealSound(st, me);
  if (!st) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null || !questionOf(st.item)) {
    return (
      <GameScreen scroll={false}>
        <Countdown ms={st.phase_ends_at - server} faces={st.players.map((p) => p.character)} ids={st.players.map((p) => p.user_id)} line={settingsLine(def, st.settings)} />
      </GameScreen>
    );
  }

  const q = questionOf(st.item);
  const me_ = st.players.find((p) => p.user_id === me);
  const talker = { id: me, name: me_?.name ?? 'You', face: me_?.character ?? 'yara' };
  const reveal = st.phase !== 'case';
  const limitMs = TIME_S[q.style] * 1000;
  const ends = st.phase_ends_at;
  const mine = parse(st.me?.guesses?.[0]) ?? (sent?.index === st.index ? sent.response : null);
  const solved = st.me?.solved_ms != null;
  const points = st.me?.points ?? 0;
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - server) / 1000));
  const waiting = st.players.filter((p) => p.user_id !== me && !p.dropped && !p.done).length;

  // ParadeBoard reads a Solo round; online fills one from the server's state. Your answer stays "locked in" until
  // the question ends, then right and wrong show for everyone at once, with faces on Multiple choice, Reverse and True or false.
  const faces: Record<number, string[]> = {};
  if (reveal) for (const p of st.players) if (p.pick != null) (faces[p.pick] ??= []).push(p.character);
  const answer: Answer = { qId: q.id, response: mine, outcome: solved ? 'right' : 'wrong', points, timeMs: 0 };
  const round: Round = {
    queue: Array.from({ length: st.total }, () => q.id),
    index: st.index,
    layout: layoutFor(q, seeded(`${matchId}:${st.index}`)),
    removed: [],
    remainingMs: reveal ? 0 : Math.max(0, ends - server),
    runningSince: null,
    limitMs,
    phase: reveal ? 'feedback' : 'playing',
    before: null,
    score: me_?.score ?? 0,
    feedback: reveal ? { points, right: solved, untilMs: 0 } : null,
    answers: reveal ? [answer] : [],
    helpers: { remove: 0, skip: 0, time: 0 },
  };
  const nearest = q.style === 'closest' ? st.players.filter((p) => p.solved).map((p) => (p.user_id === me ? 'You' : p.name)) : [];
  const verdict = !reveal
    ? null
    : q.style === 'closest' && nearest.length
      ? `Nearest: ${nearest.join(', ')}${solved ? ` · +${points}` : ''}`
      : solved
        ? `${nth(st.me?.rank ?? 1)} right · +${points}`
        : points
          ? `Part right · +${points}`
          : mine
            ? 'Wrong'
            : 'No answer';
  const result = !reveal ? null : st.phase === 'done' ? doneLine : `${last ? 'Results' : 'Next question'} in ${nextIn} s`;

  return (
    <ParadeBoard
      q={q}
      round={round}
      ticks={clock}
      leftAt={(sv) => (reveal ? 0 : Math.max(0, ends - sv))}
      who={{ name: `Question ${st.index + 1} of ${st.total}` }}
      onAnswer={async (response) => {
        if (!playing || mine != null) return;
        setSent({ index: st.index, response });
        try {
          const r = await call<{ outcome?: string }>('pq_answer', { m: matchId, response });
          // Not stored (the question ended, or I was dropped for being away): don't show "Locked in".
          if (r?.outcome === 'ignored_finished' || r?.outcome === 'rejected') {
            setSent(null);
            setNotice('That answer came too late.');
          }
          await load();
        } catch {
          setSent(null);
          setNotice('Couldn’t send that. Try again.');
        }
      }}
      onPause={() => setMenu(true)}
      locked={!reveal && (mine != null || !playing)}
      faces={reveal ? faces : undefined}
      verdict={verdict}
      notice={notice ?? result ?? (!playing ? watchLine : mine != null ? (waiting ? `Locked in. Waiting for ${waiting} more` : 'Locked in') : null)}>
      <RoomTalk room={roomId} me={talker} />
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </ParadeBoard>
  );
}
