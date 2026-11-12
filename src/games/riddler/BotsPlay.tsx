import { useEffect, useRef, useState } from 'react';

import { decide, moodOf } from '@/bots/brain';
import { orderPoints, YOU, type Rules } from '@/bots/race/engine';
import { rangePlan } from '@/bots/race/plans';
import { RivalStrip } from '@/bots/race/RivalStrip';
import { useBotRace } from '@/bots/race/useBotRace';
import { clock } from '@/games/engine/clock';
import { AnsweredRow } from '@/match/AnsweredRow';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown, nth } from '@/match/live';
import type { RaceState } from '@/match/race';
import { RaceReveal } from '@/match/RaceReveal';
import { RoomTalk } from '@/match/TalkBar';

import { engine } from '../engine';
import { PauseMenu } from '../shell/PauseMenu';
import { gameDef } from '../shell/registry';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { RD, starsFor } from './core';
import { RIDDLES, answerLabel, feedsLearn, riddleName } from './data';
import { RiddleBoard } from './RiddleBoard';

const PHOTO_MS = 90_000;
const LOCK_MS = 5_000;
const REVEAL_MS = 6_000;
const riddleOf = (n: number) => RIDDLES[n - 1];
const indexOf = new Map(RIDDLES.map((r, i) => [r.id, i + 1]));

/** Solo's star rule per picture, 4 EXP a star; unsolved = 0. */
const expFor = (solvedMs: number | null, wrong: number, hint: boolean) => (solvedMs == null ? 0 : RD.expPerStar * starsFor(solvedMs, wrong, hint));

const RULES: Rules = {
  limitMs: PHOTO_MS,
  revealMs: REVEAL_MS,
  lockMs: LOCK_MS,
  maxPoints: 150,
  // Each type solves at a random moment inside its own range (Yazan 2026-11-09), or not at all.
  plan: (_bot, x) => {
    const right = decide(x.mind, { seed: x.seed, limitMs: PHOTO_MS, gap: x.gap, progress: x.progress }).right;
    const mood = moodOf(x.mind);
    return rangePlan(x.mind, { seed: x.seed, limitMs: PHOTO_MS, right, pace: mood === 'fire' ? 0.85 : mood === 'tilt' ? 1.15 : 1 });
  },
  // 100, 80, 65... by solve order, plus up to 50 for time left.
  points: ({ rank, solved, doneAt }) => (solved && rank && doneAt != null ? orderPoints(rank) + Math.round((50 * (PHOTO_MS - doneAt)) / PHOTO_MS) : 0),
  answerOf: (item) => riddleOf(item)?.id ?? null,
};

/** `hinted`: the pictures where you paid for the definition (caps them at 2 stars, like Solo). */
function itemsOf(st: RaceState, hinted: Set<number>) {
  return (st.my_items ?? [])
    .filter((m) => !!riddleOf(m.item))
    .map((m) => {
      const r = riddleOf(m.item);
      const right = m.solved_ms != null;
      return {
        seat: 0,
        itemId: r.id,
        answerKey: r.dossier,
        outcome: right ? ('right' as const) : ('timed_out' as const),
        answersGiven: m.wrong.map(answerLabel),
        timeMs: m.solved_ms ?? PHOTO_MS,
        hintsUsed: hinted.has(m.index) ? 1 : 0,
        revealsUsed: 0,
        points: m.points,
        feedsLearn: !right && feedsLearn(r),
        gameData: { exp: expFor(m.solved_ms, m.wrong.length, hinted.has(m.index)), stars: right ? starsFor(m.solved_ms!, m.wrong.length, hinted.has(m.index)) : 0, kind: r.kind, rank: m.rank },
      };
    });
}

/**
 * Riddle duel (The Riddler vs rivals, G4): the same picture for everyone, 90 s, unlimited guesses with a 5 s lock after
 * a wrong one. Rivals solve at timed moments ("Jun solved it in 0:14"); their wrong answers never show.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  // Definition vs rivals (Yazan 2026-11-12): 1 token, as Solo, caps that picture at 2 stars.
  const [hinted, setHinted] = useState<number[]>([]);
  const hintedNow = useRef(hinted);
  useEffect(() => {
    hintedNow.current = hinted;
  }, [hinted]);
  const g = useBotRace({
    play,
    onFinish,
    onQuit,
    rules: RULES,
    pick: async () => (await engine.picker.pick(play.game, RIDDLES.map((x) => x.id), Number(play.settings.photos) || 5)).map((id) => indexOf.get(id)!).filter(Boolean),
    toItems: (st) => itemsOf(st, new Set(hintedNow.current)),
    solvedText: (name, _rank, ms) => `${name} solved it in ${clock(ms)}`,
  });
  const [wrongSeq, setWrongSeq] = useState(0);
  const { st, race, t } = g;
  const menu = <PauseMenu open={g.menu} mode="bots" onResume={g.closeMenu} onQuit={g.quit} />;
  if (!st || !race) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <GameScreen scroll={false}>
        <Countdown ms={st.phase_ends_at - t} faces={st.players.map((p) => p.character)} line={settingsLine(gameDef(play.game), play.settings)} />
        <RoomTalk room={g.room} me={g.talker} />
        {menu}
      </GameScreen>
    );
  }

  const r = riddleOf(st.item);
  const reveal = st.phase !== 'case';
  const solved = st.me?.solved_ms != null;
  const lockLeft = st.me?.locked_until ? Math.max(0, st.me.locked_until - t) : 0;
  const left = reveal ? 0 : Math.max(0, st.phase_ends_at - t);
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - t) / 1000));
  const waiting = st.players.filter((p) => !p.done).length;

  const dock = reveal ? (
    <RaceReveal
      label="The answer"
      answer={riddleName(r)}
      players={st.players}
      me={YOU}
      how={(p) => (p.solved ? nth(p.item_rank ?? 1) : 'time up')}
      next={st.phase === 'done' ? 'Adding up the scores…' : `${last ? 'Results' : 'Next picture'} in ${nextIn} s`}
    />
  ) : solved ? (
    <RaceReveal
      label={`Solved, ${nth(st.me!.rank ?? 1)}`}
      answer={riddleName(r)}
      players={st.players.filter((p) => p.solved)}
      me={YOU}
      how={(p) => nth(p.item_rank ?? 1)}
      next={waiting ? <AnsweredRow seats={st.players.map((p) => ({ user_id: p.user_id, character: p.character, done: p.solved }))} /> : 'Everyone solved it'}
    />
  ) : undefined;

  return (
    <RiddleBoard
      riddle={r}
      turnKey={`${st.index}`}
      kicker={`Picture ${st.index + 1} of ${st.total}`}
      title={{ text: 'Riddle duel' }}
      clockMs={left}
      countdown
      lives={null}
      lockMs={lockLeft}
      wrong={st.me?.wrong ?? []}
      wrongSeq={wrongSeq}
      hidden={g.paused}
      live={<RivalStrip st={st} race={race} />}
      onGuess={(id) => {
        if (lockLeft > 0 || g.paused) return;
        if (id === r.id) g.solve();
        else if (g.wrong(id) === 'wrong') setWrongSeq((x) => x + 1);
      }}
      onPause={g.openMenu}
      hint={{
        used: hinted.includes(st.index),
        onHint: () => {
          if (hinted.includes(st.index) || solved || reveal) return;
          const at = st.index;
          void g.buy(RD.hintPrice, 'riddler_hint', () => setHinted((h) => [...h, at]));
        },
      }}
      dock={dock}>
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </RiddleBoard>
  );
}
