import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { orderPoints, YOU, type Rules } from '@/bots/race/engine';
import { cluePlan } from '@/bots/race/plans';
import { useBotRace } from '@/bots/race/useBotRace';
import { rng } from '@/bots/rng';
import { AnsweredRow } from '@/match/AnsweredRow';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown, nth } from '@/match/live';
import type { RaceState } from '@/match/race';
import { RoomTalk } from '@/match/TalkBar';

import { engine } from '../engine';
import { pickFor } from '../shell/deal';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { GameScreen, Kick } from '../shell/ui';
import { CaseBoard } from './CaseBoard';
import type { Attempt } from './core';
import { useKit, type ClueKit } from './kit';
import { gameDef } from '../shell/registry';
import { tr } from '@/i18n';

/** The clue showing at `ms` into a case: one more every clueMs. */
const clueAtOf = (k: ClueKit) => (ms: number) => Math.min(k.rules.clueCount, Math.floor(ms / k.race.clueMs) + 1);

/** A kit's race rules. Points: solving order + fewer clues (up to 50) + time left (up to 20). */
function raceRules(k: ClueKit): Rules {
  const { itemMs, clueMs, lockMs, revealMs, clueBonus } = k.race;
  const clueAt = clueAtOf(k);
  return {
    limitMs: itemMs,
    revealMs,
    lockMs,
    maxPoints: 170,
    plan: (bot, x) => {
      const p = cluePlan(x.mind, { seed: x.seed, gap: x.gap, progress: x.progress, limitMs: itemMs, clueMs, lockMs, clues: k.rules.clueCount });
      const c = k.byId.get(String(x.item));
      const r = rng(`${x.seed}:${bot.id}:dx`);
      return { ...p, wrongs: c ? k.nearMisses(c, (n) => Math.floor(r() * n), p.wrongAt.length) : [] };
    },
    points: ({ rank, solved, doneAt }) => (solved && rank && doneAt != null ? orderPoints(rank) + clueBonus[clueAt(doneAt) - 1] + Math.round((20 * (itemMs - doneAt)) / itemMs) : 0),
    answerOf: (item) => k.byId.get(String(item))?.answer_id ?? null,
  };
}

function itemsOf(k: ClueKit, st: RaceState) {
  const clueAt = clueAtOf(k);
  return (st.my_items ?? [])
    .filter((m) => k.byId.has(String(m.item)))
    .map((m) => {
      const c = k.byId.get(String(m.item))!;
      const right = m.solved_ms != null;
      return {
        seat: 0,
        itemId: String(m.item),
        answerKey: c.canonical_id ?? null,
        outcome: right ? ('right' as const) : ('timed_out' as const),
        answersGiven: m.wrong.map((id) => k.guessName(id)),
        timeMs: m.solved_ms ?? k.race.itemMs,
        hintsUsed: 0,
        revealsUsed: 0,
        points: m.points,
        feedsLearn: !right, // your unsolved cases go to Learn
        gameData: { cluesShown: right ? clueAt(m.solved_ms!) : k.rules.clueCount, caseRank: m.rank, ...k.gameData(c) },
      };
    });
}

/**
 * Diagnosis showdown (DP vs rivals, G4): everyone gets the same case, a clue every 10 s, 60 s per case. Guess as often
 * as you like; a wrong guess locks you for 5 s. Rivals guess too, wrong ones in sight, and solve on their type's clue.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const kit = useKit();
  const rules = useMemo(() => raceRules(kit), [kit]);
  const clueAt = clueAtOf(kit);
  const { words } = kit;
  const g = useBotRace({
    play,
    onFinish,
    onQuit,
    rules,
    pick: async () => (await pickFor(play, kit.pool(play.settings), Number(play.settings.cases) || 5)).map(Number),
    toItems: (st) => itemsOf(kit, st),
    // The short name only, so the bubble stays small.
    guessName: (id) => kit.guessById.get(id)?.label ?? kit.guessName(id),
  });
  const [wrongSeq, setWrongSeq] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const { st, race, t } = g;
  // Hint vs rivals (Yazan 2026-11-12): the medical field for 1 token, as Solo. Kept per case.
  const [hinted, setHinted] = useState(-1);

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
          <Kick>{tr('Adding up the scores…')}</Kick>
        </View>
      </GameScreen>
    );
  }

  const c = kit.byId.get(String(st.item))!;
  const N = kit.rules.clueCount;
  const elapsed = Math.max(0, t - st.phase_started_at);
  const reveal = st.phase === 'reveal';
  const solved = st.me?.solved_ms != null;
  const clues = reveal ? N : solved ? clueAt(st.me!.solved_ms!) : clueAt(elapsed);
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
        line: reveal ? tr('{nth} to solve · {points} points with {clueAt} {n}', { nth: nth(st.me!.rank ?? 1), points: st.me!.points, clueAt: clueAt(st.me!.solved_ms!), n: clueAt(st.me!.solved_ms!) === 1 ? tr('clue') : tr('clues') }) : tr('Solved, {nth}. Waiting for the rest…', { nth: nth(me?.item_rank ?? 1) }),
        nextLabel: reveal ? tr('{n} in {nextIn} s', { n: last ? tr('Results') : tr(words.next), nextIn }) : waiting ? '' : tr('Everyone is done'),
        wait: !reveal && waiting ? <AnsweredRow seats={st.players.map((p) => ({ user_id: p.user_id, character: p.character, done: p.done }))} /> : undefined,
      }
    : reveal
      ? { outcome: 'timed_out' as const, points: 0, line: tr(words.missLearn), nextLabel: tr('{n} in {nextIn} s', { n: last ? tr('Results') : tr(words.next), nextIn }) }
      : null;

  return (
    <CaseBoard
      turnKey={`${st.index}`}
      c={reveal || solved ? { ...c, answer_id: st.answer ?? c.answer_id } : c}
      attempt={attempt}
      phase={g.paused ? 'paused' : !solved && !reveal ? 'playing' : 'over'}
      title={tr(words.item, { n: st.index + 1 })}
      sub={tr('of {total}', { total: st.total })}
      slim={tr(words.itemOf, { n: st.index + 1, n2: st.total })}
      clock={{ label: tr('Time left'), down: true, ms: left, warn: !reveal && left <= 15_000 }}
      wrongSeq={wrongSeq}
      clueSeq={clues}
      actions="hint"
      hint={{ granted: hinted === st.index, onHint: () => (hinted === st.index || solved || reveal ? undefined : void g.buy(kit.rules.hintTokenCost, kit.hint.reason, () => setHinted(st.index))) }}
      result={result}
      notice={notice ?? (lockLeft > 0 ? tr('Wrong. Locked for {n} s.', { n: Math.ceil(lockLeft / 1000) }) : null)}
      pausedNote={tr(words.pausedBots)}
      worth={{ label: tr('Your points'), value: String(me?.score ?? 0) }}
      onPause={g.openMenu}
      onGuess={(guess) => {
        if (lockLeft > 0) return;
        setNotice(null);
        if (guess.id === c.answer_id) g.solve();
        else if (g.wrong(guess.id) === 'wrong') setWrongSeq((x) => x + 1);
        else if ((st.me?.wrong ?? []).includes(guess.id)) setNotice(tr('You already tried that one.'));
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
