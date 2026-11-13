import { useEffect, useRef, useState } from 'react';

import { decide } from '@/bots/brain';
import { orderPoints, YOU, type Rules } from '@/bots/race/engine';
import { useBotRace } from '@/bots/race/useBotRace';
import { rng } from '@/bots/rng';
import { playerColour } from '@/games/shell/characters';
import { AnsweredRow } from '@/match/AnsweredRow';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown, nth } from '@/match/live';
import type { RaceState } from '@/match/race';
import { RoomTalk } from '@/match/TalkBar';

import { engine } from '../engine';
import { PauseMenu } from '../shell/PauseMenu';
import { gameDef } from '../shell/registry';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { ADD_MS, HELPER_PRICE, REMOVE_COUNT, mixQueue, type HelperKind, type Round, type Style } from './core';
import { tickedFields } from '../shell/fields';
import { QUESTIONS, idsOf, poolFor } from './data';
import { HeatBoard } from './HeatBoard';
import { HeatColumns } from './HeatColumns';
import { tr } from '@/i18n';

const questionOf = (n: number) => QUESTIONS[n - 1];
const indexOf = new Map(QUESTIONS.map((q, i) => [q.id, i + 1]));
const REVEAL_MS = 4_500;
/** Streak milestones that alert everyone. */
const MILESTONES = [5, 10, 15];

/** The same shuffle of a question's choices for the whole match. */
function seededOrder(seed: string, n: number) {
  const r = rng(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const rulesFor = (qMs: number): Rules => ({
  limitMs: qMs,
  revealMs: REVEAL_MS,
  lockMs: 0,
  maxPoints: 150,
  streaks: true,
  // One pick each: right or wrong and when from the brain; a wrong pick is a fixed wrong choice.
  plan: (_bot, x) => {
    const q = questionOf(x.item);
    const mv = decide(x.mind, { seed: x.seed, limitMs: qMs, gap: x.gap, progress: x.progress });
    if (mv.ms == null) return { doneAt: null, solved: false, wrongAt: [], pick: null };
    const wrongs = seededOrder(`${x.seed}:wrongs`, q.choices.length).filter((i) => i !== q.answer);
    return { doneAt: mv.ms, solved: mv.right, wrongAt: [], pick: mv.right ? q.answer : wrongs[Math.min(mv.wrongPick, wrongs.length - 1)] };
  },
  // 100, 80, 65... by order, plus 10 for each answer in the streak after the first (up to 50).
  points: ({ rank, solved, streak }) => (solved && rank ? orderPoints(rank) + Math.min(50, 10 * Math.max(0, streak - 1)) : 0),
  answerOf: (item) => (questionOf(item) ? String(questionOf(item).answer) : null),
});

function itemsOf(st: RaceState) {
  let run = 0;
  return (st.my_items ?? [])
    .filter((m) => !!questionOf(m.item))
    .map((m) => {
      const q = questionOf(m.item);
      const right = m.solved_ms != null;
      run = right ? run + 1 : 0;
      return {
        seat: 0,
        itemId: q.id,
        answerKey: q.dossier,
        outcome: right ? ('right' as const) : m.skipped ? ('skipped' as const) : m.pick == null ? ('timed_out' as const) : ('wrong' as const),
        answersGiven: !right && m.pick != null ? [q.choices[m.pick]] : [],
        timeMs: m.solved_ms ?? (Number(st.settings.qtime) || 20) * 1000,
        hintsUsed: 0,
        revealsUsed: 0,
        points: m.points,
        feedsLearn: !right && !m.skipped, // your misses go to Today's review; a paid skip is not a miss
        gameData: { style: st.settings.style, field: q.field, kind: q.kind, streak: run, rank: m.rank },
      };
    });
}

/**
 * Streak showdown (Streak Master vs rivals, G4): the same question with the same choices for everyone, one pick each.
 * Picks stay secret until the question ends; then the rivals' heat columns rise or crash.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const style = (play.settings.style as Style) ?? 'mixed';
  const ticked = tickedFields(play.settings);
  const qMs = (Number(play.settings.qtime) || 20) * 1000;
  const [rules] = useState(() => rulesFor(qMs));
  const g = useBotRace({
    play,
    onFinish,
    onQuit,
    rules,
    blind: true,
    fine: true,
    pick: async () => {
      const n = Number(play.settings.questions) || 10;
      const ids =
        style === 'mixed' && !ticked
          ? mixQueue(await engine.picker.pick(play.game, idsOf('clinical'), Math.ceil(n / 2)), await engine.picker.pick(play.game, idsOf('basic'), Math.floor(n / 2)))
          : await engine.picker.pick(play.game, poolFor(style, ticked), n);
      return ids.map((id) => indexOf.get(id)!).filter(Boolean);
    },
    toItems: itemsOf,
  });
  const { st, race, t, push } = g;
  // Helpers vs rivals (Yazan 2026-11-12): Remove 2, Skip and keep your streak, +10 s, at the Solo prices.
  const [help, setHelp] = useState<{ index: number; removed: number[]; added: number; skipped: boolean }>({ index: -1, removed: [], added: 0, skipped: false });

  // "Sara is on a 5 streak" at 5, 10 and 15, and "Omar's 7 streak broke" when a streak of 3 or more ends.
  const streaks = useRef(new Map<string, number>());
  useEffect(() => {
    if (!st || st.phase === 'countdown') return;
    for (const p of st.players) {
      const before = streaks.current.get(p.user_id) ?? 0;
      streaks.current.set(p.user_id, p.streak);
      if (p.user_id === YOU || p.streak === before) continue;
      if (p.streak > before && MILESTONES.includes(p.streak)) push(`${p.name} is on a ${p.streak} streak`, playerColour(st.players, p.user_id));
      else if (p.streak === 0 && before >= 3) push(`${p.name}'s ${before} streak broke`, '#f5b041');
    }
  });

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

  const q = questionOf(st.item);
  const me = st.players.find((p) => p.user_id === YOU);
  const reveal = st.phase !== 'case';
  const mine = st.me?.pick ?? null;
  const right = mine != null && mine === q.answer;
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - t) / 1000));
  const ends = st.phase_ends_at;
  const faces: Record<number, string[]> = {};
  if (reveal) for (const p of st.players) if (p.pick != null) (faces[p.pick] ??= []).push(p.character);
  const mineHelp = help.index === st.index ? help : { index: st.index, removed: [] as number[], added: 0, skipped: false };
  const skipped = mineHelp.skipped;
  const usable = (k: HelperKind) => !g.paused && !reveal && mine == null && !skipped && (k !== 'remove' || mineHelp.removed.length === 0);
  const onHelper = (k: HelperKind) => {
    if (!usable(k)) return;
    void g.buy(HELPER_PRICE[k], `streak_${k}`, () => {
      if (k === 'skip') {
        g.skip();
        return setHelp({ ...mineHelp, skipped: true });
      }
      if (k === 'time') {
        g.extend(ADD_MS);
        return setHelp({ ...mineHelp, added: mineHelp.added + ADD_MS });
      }
      const wrongs = seededOrder(`${play.id}:${st.index}:remove`, q.choices.length).filter((i) => i !== q.answer);
      setHelp({ ...mineHelp, removed: wrongs.slice(0, REMOVE_COUNT) });
    });
  };
  const round = {
    order: seededOrder(`${play.id}:${st.index}`, q.choices.length),
    removed: mineHelp.removed,
    phase: g.paused ? 'paused' : reveal ? 'feedback' : 'playing',
    before: reveal ? 'feedback' : 'playing',
    streak: me?.streak ?? 0,
    maxStreak: me?.best_streak ?? 0,
    score: me?.score ?? 0,
    feedback: reveal ? { picked: mine ?? -1, right, points: st.me?.points ?? 0, untilMs: 0 } : null,
  } as unknown as Round;
  const result = !reveal ? null : st.phase === 'done' ? tr('Adding up the scores…') : tr('{n} · {n2} in {nextIn} s', { n: right ? tr('{v} right · +{v2}', { v: nth(st.me?.rank ?? 1), v2: st.me?.points ?? 0 }) : mine == null ? (skipped ? tr('Skipped · streak kept') : tr('No answer')) : tr('Wrong'), n2: last ? tr('Results') : tr('next question'), nextIn });

  return (
    <HeatBoard
      q={q}
      round={round}
      ticks={g.clock}
      leftAt={(sv) => (reveal ? 0 : Math.max(0, ends - sv))}
      totalMs={qMs + mineHelp.added}
      helpers={{ onHelper, usable }}
      who={{ name: tr('Question {n} of {total}', { n: st.index + 1, total: st.total }) }}
      live={<HeatColumns players={st.players} reveal={reveal} />}
      hidden={g.paused}
      onAnswer={(choice) => {
        if (g.paused || reveal || mine != null) return;
        if (choice === q.answer) g.solve({ pick: choice });
        else g.miss({ pick: choice });
      }}
      onPause={g.openMenu}
      locked={reveal ? null : mine}
      faces={reveal ? faces : undefined}
      notice={result ?? (mine != null || skipped ? <AnsweredRow seats={st.players.map((p) => ({ user_id: p.user_id, character: p.character, done: p.done }))} /> : null)}>
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </HeatBoard>
  );
}
