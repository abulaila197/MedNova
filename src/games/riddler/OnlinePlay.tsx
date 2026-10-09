import { useEffect, useRef, useState } from 'react';

import { call } from '@/online/api';
import { AlertPill, Countdown, nth, useAlerts } from '@/online/live';
import { settingsLine } from '@/online/format';
import { useRace, type RaceState } from '@/online/race';
import { RaceReveal } from '@/online/RaceReveal';
import { RoomTalk } from '@/online/Talk';
import { characterOf } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import type { OnlineProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { RD, starsFor } from './core';
import { RIDDLES, answerLabel, feedsLearn, riddleName } from './data';
import { RiddleBoard } from './RiddleBoard';

const PHOTO_MS = 90_000;
const riddleOf = (n: number) => RIDDLES[n - 1];

/** RD18: Solo's star rule per picture, 4 EXP a star; unsolved = 0. */
const expFor = (solvedMs: number | null, wrong: number) => (solvedMs == null ? 0 : RD.expPerStar * starsFor(solvedMs, wrong, false));

function itemsOf(st: RaceState) {
  return (st.my_items ?? []).map((m) => {
    const r = riddleOf(m.item);
    const right = m.solved_ms != null;
    return {
      seat: 0,
      itemId: r.id,
      answerKey: r.dossier,
      outcome: right ? ('right' as const) : ('timed_out' as const),
      answersGiven: (m.wrong ?? []).map(answerLabel),
      timeMs: m.solved_ms ?? PHOTO_MS,
      hintsUsed: 0,
      revealsUsed: 0,
      points: m.points,
      feedsLearn: !right && feedsLearn(r), // RD1 + ON4
      gameData: { exp: expFor(m.solved_ms, (m.wrong ?? []).length), stars: right ? starsFor(m.solved_ms!, (m.wrong ?? []).length, false) : 0, kind: r.kind, rank: m.rank, room: st.room_id },
    };
  });
}

/**
 * The Riddler Online (RD7, RD8): the same picture for everyone at once, 90 s, unlimited guesses with a 5 s lock after
 * a wrong one. 100, 80, 65... by solve order plus up to 50 for time left. The server referees every guess.
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const { st, load, server, playing, notice, setNotice, leave } = useRace(def, roomId, matchId, me, itemsOf);
  const [menu, setMenu] = useState(false);
  const [wrongSeq, setWrongSeq] = useState(0);
  const { alert, push } = useAlerts();
  const seen = useRef<{ key: string; solved: Set<string>; alone: boolean }>({ key: '', solved: new Set(), alone: false });

  // RD8 alerts, like DP: each solve, and "Only you left".
  useEffect(() => {
    if (!st || st.phase !== 'case') return;
    const key = `${st.index}`;
    if (seen.current.key !== key) seen.current = { key, solved: new Set(st.players.filter((p) => p.solved).map((p) => p.user_id)), alone: false };
    for (const p of st.players) {
      if (p.solved && !seen.current.solved.has(p.user_id)) {
        seen.current.solved.add(p.user_id);
        if (p.user_id !== me) push(`${p.name} solved it, ${nth(p.item_rank ?? 1)}`, characterOf(p.character)?.ring ?? '#6fd6ff');
      }
    }
    const left = st.players.filter((p) => !p.dropped && !p.solved);
    if (playing && !seen.current.alone && left.length === 1 && left[0].user_id === me && st.players.length > 1) {
      seen.current.alone = true;
      push('Only you left', '#f5b041');
    }
  }, [st, me, playing, push]);

  if (!st) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <GameScreen scroll={false}>
        <Countdown ms={st.phase_ends_at - server} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />
      </GameScreen>
    );
  }

  const r = riddleOf(st.item);
  const mine = st.players.find((p) => p.user_id === me);
  const talker = { id: me, name: mine?.name ?? 'You', face: mine?.character ?? 'yara' };
  const reveal = st.phase !== 'case';
  const solved = st.me?.solved_ms != null;
  const lockLeft = st.me?.locked_until ? Math.max(0, st.me.locked_until - server) : 0;
  const left = reveal ? 0 : Math.max(0, st.phase_ends_at - server);
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - server) / 1000));
  const waiting = st.players.filter((p) => p.user_id !== me && !p.dropped && !p.solved).length;

  const dock = reveal ? (
    <RaceReveal
      label="The answer"
      answer={riddleName(r)}
      players={st.players}
      me={me}
      how={(p) => (p.solved ? nth(p.item_rank ?? 1) : 'time up')}
      next={st.phase === 'done' ? 'Adding up the scores…' : `${last ? 'Results' : 'Next picture'} in ${nextIn} s`}
    />
  ) : solved || !playing ? (
    <RaceReveal
      label={playing ? `Solved, ${nth(st.me!.rank ?? 1)}` : 'You’re watching'}
      answer={playing ? riddleName(r) : 'You get a seat at the rematch.'}
      players={st.players.filter((p) => p.solved)}
      me={me}
      how={(p) => nth(p.item_rank ?? 1)}
      next={waiting ? `Waiting for ${waiting} more` : 'Everyone solved it'}
    />
  ) : undefined;

  return (
    <RiddleBoard
      riddle={r}
      turnKey={`${st.index}`}
      kicker={`Picture ${st.index + 1} of ${st.total}`}
      title={{ text: 'Race the picture' }}
      clockMs={left}
      countdown
      lives={null}
      lockMs={lockLeft}
      wrong={st.me?.wrong ?? []}
      wrongSeq={wrongSeq}
      onGuess={async (id) => {
        if (lockLeft > 0) return;
        try {
          const res = await call<{ outcome: string }>('rd_guess', { m: matchId, answer: id });
          if (res.outcome === 'wrong') setWrongSeq((x) => x + 1);
          await load();
        } catch {
          setNotice('Couldn’t send that. Try again.');
        }
      }}
      onPause={() => setMenu(true)}
      notice={notice}
      dock={dock}>
      <AlertPill alert={alert} />
      <RoomTalk room={roomId} me={talker} />
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </RiddleBoard>
  );
}
