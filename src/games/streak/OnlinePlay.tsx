import { useEffect, useRef, useState } from 'react';

import { call } from '@/online/api';
import { AlertPill, Countdown, nth, useAlerts } from '@/online/live';
import { settingsLine } from '@/online/format';
import { seededOrder, useRace, type RaceState } from '@/online/race';
import { RoomTalk } from '@/online/Talk';
import { characterOf } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import type { OnlineProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import type { Round } from './core';
import { QUESTIONS } from './data';
import { HeatBoard } from './HeatBoard';

const questionOf = (n: number) => QUESTIONS[n - 1];
/** SM8: streak milestones that alert everyone. */
const MILESTONES = [5, 10, 15];

function itemsOf(st: RaceState) {
  let run = 0;
  return (st.my_items ?? []).map((m) => {
    const q = questionOf(m.item);
    const right = m.solved_ms != null;
    run = right ? run + 1 : 0;
    return {
      seat: 0,
      itemId: q.id,
      answerKey: q.dossier,
      outcome: right ? ('right' as const) : m.pick == null ? ('timed_out' as const) : ('wrong' as const),
      answersGiven: !right && m.pick != null ? [q.choices[m.pick]] : [],
      timeMs: m.solved_ms ?? (Number(st.settings.qtime) || 15) * 1000,
      hintsUsed: 0,
      revealsUsed: 0,
      points: m.points,
      feedsLearn: !right, // SM1 + ON4: your own misses go to Today's review
      gameData: { style: st.settings.style, field: q.field, kind: q.kind, streak: run, rank: m.rank, room: st.room_id },
    };
  });
}

/**
 * The Streak Master Online (SM6-SM8, SM14, SM16): everyone gets the same question with the same shuffled choices,
 * one pick each, no helpers. Right answers score 100, 80, 65... by arrival plus a streak bonus up to 50.
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const { st, load, server, playing, notice, setNotice, leave } = useRace(def, roomId, matchId, me, itemsOf);
  const [menu, setMenu] = useState(false);
  const [picked, setPicked] = useState<{ index: number; choice: number } | null>(null);
  const { alert, push } = useAlerts();
  const streaks = useRef(new Map<string, number>());

  // SM8 alerts: "Sara is on a 5 streak" at 5, 10, 15, and "Omar's 7 streak broke" when a streak of 3 or more ends.
  useEffect(() => {
    if (!st || st.phase === 'countdown') return;
    for (const p of st.players) {
      const before = streaks.current.get(p.user_id) ?? 0;
      streaks.current.set(p.user_id, p.streak);
      if (p.user_id === me || p.streak === before) continue;
      const color = characterOf(p.character)?.ring ?? '#6fd6ff';
      if (p.streak > before && MILESTONES.includes(p.streak)) push(`${p.name} is on a ${p.streak} streak`, color);
      else if (p.streak === 0 && before >= 3) push(`${p.name}'s ${before} streak broke`, '#f5b041');
    }
  }, [st, me, push]);

  if (!st) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <GameScreen scroll={false}>
        <Countdown ms={st.phase_ends_at - server} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />
      </GameScreen>
    );
  }

  const q = questionOf(st.item);
  const me_ = st.players.find((p) => p.user_id === me);
  const talker = { id: me, name: me_?.name ?? 'You', face: me_?.character ?? 'yara' };
  const reveal = st.phase !== 'case';
  const qMs = (Number(st.settings.qtime) || 15) * 1000;
  const left = reveal ? 0 : Math.max(0, st.phase_ends_at - server);
  const mine = st.me?.pick ?? (picked?.index === st.index ? picked.choice : null);
  const right = mine != null && mine === q.answer;
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - server) / 1000));
  const waiting = st.players.filter((p) => p.user_id !== me && !p.dropped && !p.done).length;

  // HeatBoard reads a Solo round; online fills one from the server's state. Your pick stays "locked in" until the
  // question ends, then right and wrong show for everyone at once with each player's face on their answer (Yazan).
  const faces: Record<number, string[]> = {};
  if (reveal) for (const p of st.players) if (p.pick != null) (faces[p.pick] ??= []).push(p.character);
  const round = {
    order: seededOrder(`${matchId}:${st.index}`, q.choices.length),
    removed: [],
    phase: reveal ? 'feedback' : 'playing',
    before: null,
    streak: me_?.streak ?? 0,
    maxStreak: me_?.best_streak ?? 0,
    score: me_?.score ?? 0,
    feedback: reveal ? { picked: mine ?? -1, right, points: st.me?.points ?? 0, untilMs: 0 } : null,
  } as unknown as Round;
  const result = !reveal ? null : st.phase === 'done' ? 'Adding up the scores…' : `${right ? `${nth(st.me?.rank ?? 1)} right · +${st.me?.points ?? 0}` : mine == null ? 'No answer' : 'Wrong'} · ${last ? 'Results' : 'next question'} in ${nextIn} s`;

  return (
    <HeatBoard
      q={q}
      round={round}
      leftMs={left}
      totalMs={qMs}
      who={{ name: `Question ${st.index + 1} of ${st.total}` }}
      onAnswer={async (choice) => {
        if (!playing || mine != null) return;
        setPicked({ index: st.index, choice });
        try {
          await call('sm_pick', { m: matchId, choice });
          await load();
        } catch {
          setPicked(null);
          setNotice('Couldn’t send that. Try again.');
        }
      }}
      onPause={() => setMenu(true)}
      locked={reveal ? null : mine}
      faces={reveal ? faces : undefined}
      notice={notice ?? result ?? (!playing ? 'You’re watching. You get a seat at the rematch.' : mine != null ? (waiting ? `Locked in. Waiting for ${waiting} more` : 'Locked in') : null)}>
      <AlertPill alert={alert} />
      <RoomTalk room={roomId} me={talker} />
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </HeatBoard>
  );
}
