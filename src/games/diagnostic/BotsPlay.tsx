import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { orderPoints, YOU, type Rules } from '@/bots/race/engine';
import { cluePlan } from '@/bots/race/plans';
import { RivalStrip } from '@/bots/race/RivalStrip';
import { useBotRace } from '@/bots/race/useBotRace';
import { rng } from '@/bots/rng';
import { AnsweredRow } from '@/match/AnsweredRow';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown, nth } from '@/match/live';
import type { RaceState } from '@/match/race';
import { RoomTalk } from '@/match/TalkBar';

import { engine } from '../engine';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { GameScreen, Kick } from '../shell/ui';
import { CaseBoard } from './CaseBoard';
import { DP, type Attempt, type Difficulty } from './core';
import { CASES, caseById, guessById, guessName, poolFor } from './data';
import { gameDef } from '../shell/registry';

const CASE_MS = 60_000;
const CLUE_MS = 10_000;
const LOCK_MS = 5_000;
const REVEAL_MS = 6_000;
/** Fewer clues (up to 50): 50 on clue 1 down to 0 on clue 6. Time left adds up to 20. */
const CLUE_BONUS = [50, 40, 30, 20, 10, 0];
const clueAt = (ms: number) => Math.min(DP.clueCount, Math.floor(ms / CLUE_MS) + 1);

/** Tempting wrong diagnoses for a case: diseases from the same field, in a fixed order per rival. */
function nearMisses(item: number, seed: string, n: number) {
  const c = caseById.get(String(item));
  if (!c || !n) return [];
  // Closest first: the most fields in common, the main field counting double; then the nearest dozen.
  const near = (x: (typeof CASES)[number]) => x.fields.filter((f) => c.fields.includes(f)).length + (x.fields[0] === c.fields[0] ? 1 : 0);
  const ranked = CASES.filter((x) => x.answer_id !== c.answer_id && guessById.has(x.answer_id) && near(x) > 0).sort((a, b) => near(b) - near(a));
  const pool = [...new Set(ranked.map((x) => x.answer_id))].slice(0, 12);
  const r = rng(seed);
  const out: string[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

const RULES: Rules = {
  limitMs: CASE_MS,
  revealMs: REVEAL_MS,
  lockMs: LOCK_MS,
  maxPoints: 170,
  plan: (bot, x) => {
    const p = cluePlan(x.mind, { seed: x.seed, gap: x.gap, progress: x.progress, limitMs: CASE_MS, clueMs: CLUE_MS, lockMs: LOCK_MS, clues: DP.clueCount });
    return { ...p, wrongs: nearMisses(x.item, `${x.seed}:${bot.id}:dx`, p.wrongAt.length) };
  },
  points: ({ rank, solved, doneAt }) => (solved && rank && doneAt != null ? orderPoints(rank) + CLUE_BONUS[clueAt(doneAt) - 1] + Math.round((20 * (CASE_MS - doneAt)) / CASE_MS) : 0),
  answerOf: (item) => caseById.get(String(item))?.answer_id ?? null,
};

function itemsOf(st: RaceState) {
  return (st.my_items ?? [])
    .filter((m) => caseById.has(String(m.item)))
    .map((m) => {
      const c = caseById.get(String(m.item))!;
      const right = m.solved_ms != null;
      return {
        seat: 0,
        itemId: String(m.item),
        answerKey: c.canonical_id ?? null,
        outcome: right ? ('right' as const) : ('timed_out' as const),
        answersGiven: m.wrong.map((id) => guessName(id)),
        timeMs: m.solved_ms ?? CASE_MS,
        hintsUsed: 0,
        revealsUsed: 0,
        points: m.points,
        feedsLearn: !right, // your unsolved cases go to Learn
        gameData: { cluesShown: right ? clueAt(m.solved_ms!) : DP.clueCount, caseRank: m.rank, difficulty: c.difficulty },
      };
    });
}

/**
 * Diagnosis showdown (DP vs rivals, G4): everyone gets the same case, a clue every 10 s, 60 s per case. Guess as often
 * as you like; a wrong guess locks you for 5 s. Rivals guess too, wrong ones in sight, and solve on their type's clue.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const g = useBotRace({
    play,
    onFinish,
    onQuit,
    rules: RULES,
    pick: async () => (await engine.picker.pick(play.game, poolFor(play.settings.difficulty as Difficulty), Number(play.settings.cases) || 5)).map(Number),
    toItems: itemsOf,
    factOf: (item) => caseById.get(String(item))?.canonical_id ?? caseById.get(String(item))?.disease ?? null,
  });
  const [wrongSeq, setWrongSeq] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
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
  if (st.phase === 'done') {
    return (
      <GameScreen>
        <View style={s.done}>
          <Kick>Adding up the scores…</Kick>
        </View>
      </GameScreen>
    );
  }

  const c = caseById.get(String(st.item))!;
  const elapsed = Math.max(0, t - st.phase_started_at);
  const reveal = st.phase === 'reveal';
  const solved = st.me?.solved_ms != null;
  const clues = reveal ? DP.clueCount : solved ? clueAt(st.me!.solved_ms!) : Math.min(DP.clueCount, Math.floor(elapsed / CLUE_MS) + 1);
  const attempt: Attempt = { cluesShown: clues, wrong: st.me?.wrong ?? [], reveals: 0, status: solved ? 'solved' : 'active' };
  const left = reveal ? 0 : Math.max(0, st.phase_ends_at - t);
  const lockLeft = st.me?.locked_until ? st.me.locked_until - t : 0;
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - t) / 1000));
  const me = st.players.find((p) => p.user_id === YOU);
  const waiting = st.players.filter((p) => !p.done).length;

  const result = solved
    ? {
        outcome: 'right' as const,
        points: reveal ? (st.me!.points ?? 0) : 0,
        line: reveal ? `${nth(st.me!.rank ?? 1)} to solve · ${st.me!.points} points with ${clueAt(st.me!.solved_ms!)} ${clueAt(st.me!.solved_ms!) === 1 ? 'clue' : 'clues'}` : `Solved, ${nth(me?.item_rank ?? 1)}. Waiting for the rest…`,
        nextLabel: reveal ? `${last ? 'Results' : 'Next case'} in ${nextIn} s` : waiting ? '' : 'Everyone is done',
        wait: !reveal && waiting ? <AnsweredRow seats={st.players.map((p) => ({ user_id: p.user_id, character: p.character, done: p.done }))} /> : undefined,
      }
    : reveal
      ? { outcome: 'timed_out' as const, points: 0, line: 'Not solved. No points this case. It goes to your Learn review.', nextLabel: `${last ? 'Results' : 'Next case'} in ${nextIn} s` }
      : null;

  return (
    <CaseBoard
      turnKey={`${st.index}`}
      c={reveal || solved ? { ...c, answer_id: st.answer ?? c.answer_id } : c}
      attempt={attempt}
      phase={g.paused ? 'paused' : !solved && !reveal ? 'playing' : 'over'}
      title={`Case ${st.index + 1}`}
      sub={`of ${st.total}`}
      slim={`Case ${st.index + 1} of ${st.total}`}
      clock={{ label: 'Time left', down: true, ms: left, warn: !reveal && left <= 15_000 }}
      wrongSeq={wrongSeq}
      clueSeq={clues}
      actions={false}
      result={result}
      notice={notice ?? (lockLeft > 0 ? `Wrong. Locked for ${Math.ceil(lockLeft / 1000)} s.` : null)}
      pausedNote="The match is paused, rivals too. Resume to see the case again."
      worth={{ label: 'Your points', value: String(me?.score ?? 0) }}
      live={<RivalStrip st={st} race={race} t={t} wrongName={guessName} />}
      onPause={g.openMenu}
      onGuess={(guess) => {
        if (lockLeft > 0) return;
        setNotice(null);
        if (guess.id === c.answer_id) g.solve();
        else if (g.wrong(guess.id) === 'wrong') setWrongSeq((x) => x + 1);
        else if ((st.me?.wrong ?? []).includes(guess.id)) setNotice('You already tried that one.');
      }}
      onSkip={() => {}}
      onReveal={() => {}}>
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </CaseBoard>
  );
}

const s = StyleSheet.create({
  done: { marginTop: 40, alignItems: 'center', gap: 16 },
});
