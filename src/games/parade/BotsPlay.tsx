import { useEffect, useRef, useState } from 'react';

import { YOU, type Rules } from '@/bots/race/engine';
import { useBotRace } from '@/bots/race/useBotRace';
import { rng } from '@/bots/rng';
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
import { ADD_MS, HELPER_PRICE, grade, layoutFor, mixQueue, TIME_S, typeCycle, type Answer, type HelperKind, type Response, type Round, type Style } from './core';
import { tickedFields } from '../shell/fields';
import { QUESTIONS, idsOf, poolFor, typeOf } from './data';
import { ParadeBoard } from './ParadeBoard';
import { paradePlan, parseResponse, scoreParade } from './rivals';

const questionOf = (n: number) => QUESTIONS[n - 1];
const indexOf = new Map(QUESTIONS.map((q, i) => [q.id, i + 1]));
const REVEAL_MS = 5_000;

/** The rules for one match, plus what each question's scoring found (who was first, who was nearest). */
function rulesFor() {
  const found = new Map<number, { first: string | null; nearest: string[] }>();
  const rules: Rules = {
    limitMs: (item) => TIME_S[questionOf(item).style] * 1000,
    revealMs: REVEAL_MS,
    lockMs: 0,
    maxPoints: 5,
    plan: (_bot, x) => paradePlan(x.mind, questionOf(x.item), { seed: x.seed, limitMs: x.limitMs, gap: x.gap, progress: x.progress }),
    points: () => 0,
    scoreAll: (item, rows) => {
      const r = scoreParade(questionOf(item), rows);
      found.set(item, { first: r.first, nearest: r.nearest });
      return r.points;
    },
    answerOf: (item) => String(item),
  };
  return { rules, found };
}

function itemsOf(st: RaceState) {
  return (st.my_items ?? [])
    .filter((m) => !!questionOf(m.item))
    .map((m) => {
      const q = questionOf(m.item);
      const resp = parseResponse(m.guesses[0]);
      const right = q.style === 'closest' ? m.points > 0 : grade(q, resp).right;
      return {
        seat: 0,
        itemId: q.id,
        answerKey: null,
        outcome: right ? ('right' as const) : resp ? ('wrong' as const) : m.skipped ? ('skipped' as const) : ('timed_out' as const),
        answersGiven: [],
        timeMs: m.solved_ms ?? TIME_S[q.style] * 1000,
        hintsUsed: 0,
        revealsUsed: 0,
        points: m.points,
        feedsLearn: !right && !m.skipped, // every missed question goes to Today's review; a paid skip is not a miss
        gameData: { style: st.settings.style, field: q.field, kind: q.kind, type: q.style, rank: m.rank },
      };
    });
}

/**
 * Quiz face-off (The Quiz Parade vs rivals, G5): the same question for everyone on its type's clock, one answer each,
 * answers secret until the reveal, then each rival's face on the tile it picked. Points as Solo, Closest number to
 * the nearest guess, and +1 to the first fully right answer.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const style = (play.settings.style as Style) ?? 'mixed';
  const ticked = tickedFields(play.settings);
  const [{ rules, found }] = useState(rulesFor);
  const g = useBotRace({
    play,
    onFinish,
    onQuit,
    rules,
    blind: true,
    fine: true,
    pick: async () => {
      const n = Number(play.settings.questions) || 10;
      const pick = (ids: string[]) => engine.picker.pick(play.game, ids, ids.length);
      const pool = style === 'mixed' && !ticked ? mixQueue(await pick(idsOf('clinical')), await pick(idsOf('basic')), Infinity) : await pick(poolFor(style, ticked));
      return typeCycle(pool, n, typeOf).map((id) => indexOf.get(id)!).filter(Boolean);
    },
    toItems: itemsOf,
  });
  const { st, race, t, push } = g;
  // Helpers vs rivals (Yazan 2026-11-12): Skip (3) and +10 s (1), as Solo.
  const [help, setHelp] = useState<{ index: number; added: number; skipped: boolean }>({ index: -1, added: 0, skipped: false });

  // At the reveal: who was first ("Omar was first, +1") or nearest.
  const told = useRef(-1);
  useEffect(() => {
    if (!st || st.phase !== 'reveal' || st.item == null || told.current === st.index) return;
    told.current = st.index;
    const f = found.get(st.item);
    const q = questionOf(st.item);
    const name = (id: string) => (id === YOU ? 'You' : (st.players.find((p) => p.user_id === id)?.name ?? ''));
    if (q.style === 'closest' && f?.nearest.length) push(`Nearest: ${f.nearest.map(name).join(', ')}`, '#f5b041');
    else if (f?.first) push(f.first === YOU ? 'You were first, +1' : `${name(f.first)} was first, +1`, '#f5b041');
  }, [st, found, push]);

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
  const mineHelp = help.index === st.index ? help : { index: st.index, added: 0, skipped: false };
  const limitMs = TIME_S[q.style] * 1000 + mineHelp.added;
  const ends = st.phase_ends_at;
  const mine = parseResponse(st.me?.guesses[0]);
  const points = reveal ? (st.me?.points ?? 0) : 0;
  const right = reveal && (q.style === 'closest' ? points > 0 : grade(q, mine).right);
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - t) / 1000));

  const faces: Record<number, string[]> = {};
  if (reveal) for (const p of st.players) if (p.pick != null) (faces[p.pick] ??= []).push(p.character);
  const answer: Answer = { qId: q.id, response: mine, outcome: right ? 'right' : 'wrong', points, timeMs: 0 };
  const round: Round = {
    queue: Array.from({ length: st.total }, () => q.id),
    index: st.index,
    layout: layoutFor(q, rng(`${play.id}:${st.index}:layout`)),
    removed: [],
    remainingMs: reveal ? 0 : Math.max(0, ends - t),
    runningSince: null,
    limitMs,
    phase: g.paused ? 'paused' : reveal ? 'feedback' : 'playing',
    before: reveal ? 'feedback' : 'playing',
    score: me?.score ?? 0,
    feedback: reveal ? { points, right, untilMs: 0 } : null,
    answers: reveal ? [answer] : [],
    helpers: { remove: 0, skip: 0, time: 0 },
  };
  const usable = (k: HelperKind) => k !== 'remove' && !g.paused && !reveal && mine == null && !mineHelp.skipped;
  const onHelper = (k: HelperKind) => {
    if (!usable(k)) return;
    void g.buy(HELPER_PRICE[k], `parade_${k}`, () => {
      if (k === 'skip') {
        g.skip();
        return setHelp({ ...mineHelp, skipped: true });
      }
      g.extend(ADD_MS);
      setHelp({ ...mineHelp, added: mineHelp.added + ADD_MS });
    });
  };
  const f = reveal ? found.get(st.item) : undefined;
  const verdict = !reveal
    ? null
    : q.style === 'closest'
      ? f?.nearest.includes(YOU)
        ? `Nearest · +${points}`
        : mine
          ? 'Not the nearest'
          : mineHelp.skipped
            ? 'Skipped'
            : 'No answer'
      : right
        ? `${nth(st.me?.rank ?? 1)} right · +${points}`
        : points
          ? `Part right · +${points}`
          : mine
            ? 'Wrong'
            : mineHelp.skipped
              ? 'Skipped'
              : 'No answer';
  const result = !reveal ? null : st.phase === 'done' ? 'Adding up the scores…' : `${last ? 'Results' : 'Next question'} in ${nextIn} s`;

  return (
    <ParadeBoard
      q={q}
      round={round}
      ticks={g.clock}
      leftAt={(sv) => (reveal ? 0 : Math.max(0, ends - sv))}
      who={{ name: `Question ${st.index + 1} of ${st.total}` }}
      hidden={g.paused}
      helpers={{ onHelper, usable }}
      onAnswer={(response: Response) => {
        if (g.paused || reveal || mine != null) return;
        const guess = JSON.stringify(response);
        // Closest number is judged against the table at the close; every answer counts as in.
        if (q.style === 'closest' || grade(q, response).right) g.solve({ guess });
        else g.miss({ guess });
      }}
      onPause={g.openMenu}
      locked={!reveal && mine != null}
      faces={reveal ? faces : undefined}
      verdict={verdict}
      sent={mine}
      notice={result ?? (mine != null || mineHelp.skipped ? <AnsweredRow seats={st.players.map((p) => ({ user_id: p.user_id, character: p.character, done: p.done }))} /> : null)}>
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </ParadeBoard>
  );
}
