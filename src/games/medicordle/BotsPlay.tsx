import { useState } from 'react';

import { orderPoints, YOU, type Rules } from '@/bots/race/engine';
import { useBotRace } from '@/bots/race/useBotRace';
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
import { MAX_ROWS, lengthCheck, minLen, score, soloExp, type Style } from './core';
import { WORDS, isWord, packedOf, poolFor } from './data';
import { wordPlan } from './rivals';
import { RivalBoards } from './RivalBoards';
import { HURRY_MS, SlideTable, TurnClock } from './Slides';
import { tr } from '@/i18n';

const STYLE_NAME: Record<Style, string> = { classic: tr('Classic'), five: tr('Classic 5'), custom: tr('Custom') };
const wordOf = (n: number) => WORDS[n - 1];
const indexOf = new Map(WORDS.map((w, i) => [w.id, i + 1]));
/** The definition opens in the last 20 s of each word (#9, Yazan 2026-11-04). */
const NOTE_AT_MS = 20_000;
const REVEAL_MS = 6_000;

const rulesFor = (limitMs: number): Rules => ({
  limitMs,
  revealMs: REVEAL_MS,
  lockMs: 0,
  maxPoints: 150,
  plan: (_bot, x) => wordPlan(x.mind, { seed: x.seed, answer: wordOf(x.item).word, limitMs, gap: x.gap, progress: x.progress, wordsOf: packedOf }),
  // 100, 80, 65... by solve order, plus 10 for each guess left.
  points: ({ rank, solved, tries }) => (solved && rank ? orderPoints(rank) + 10 * Math.max(0, MAX_ROWS - tries) : 0),
  answerOf: (item) => wordOf(item)?.word ?? null,
});

function itemsOf(st: RaceState) {
  const style = (st.settings.style as Style) ?? 'classic';
  return (st.my_items ?? [])
    .filter((m) => !!wordOf(m.item))
    .map((m) => {
      const w = wordOf(m.item);
      const right = m.solved_ms != null;
      const used = m.guesses.length;
      return {
        seat: 0,
        itemId: w.id,
        answerKey: w.dossier, // results link only; Medicordle never feeds Learn (NM1)
        outcome: right ? ('right' as const) : used >= MAX_ROWS ? ('wrong' as const) : ('timed_out' as const),
        answersGiven: m.guesses.filter((g) => g !== w.word),
        timeMs: m.solved_ms ?? (Number(st.settings.wordtime) || 90) * 1000,
        hintsUsed: 0,
        revealsUsed: 0,
        points: m.points,
        feedsLearn: false,
        // Solo's EXP per word (12 for guess 1 down to 2 for guess 6), no daily double.
        gameData: { style, guesses: used, exp: right ? soloExp(used, false) : 0, rank: m.rank },
      };
    });
}

/**
 * Word duel (Medicordle vs rivals, G4): the same word for everyone, each on their own board, six tries, no hints.
 * The rivals' mini boards fill with colours as they play real words.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const style = (play.settings.style as Style) ?? 'classic';
  const limitMs = (Number(play.settings.wordtime) || 90) * 1000;
  const [rules] = useState(() => rulesFor(limitMs));
  const g = useBotRace({
    play,
    onFinish,
    onQuit,
    rules,
    pick: async () => (await engine.picker.pick(play.game, poolFor(style).map((w) => w.id), Number(play.settings.words) || 5)).map((id) => indexOf.get(id)!).filter(Boolean),
    toItems: itemsOf,
  });
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

  const w = wordOf(st.item);
  const reveal = st.phase !== 'case';
  const guesses = st.me?.guesses ?? [];
  const solved = st.me?.solved_ms != null;
  const out = !solved && guesses.length >= MAX_ROWS;
  const left = reveal ? 0 : Math.max(0, st.phase_ends_at - t);
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - t) / 1000));
  const waiting = st.players.filter((p) => !p.done).length;
  const hurry = !reveal && left <= NOTE_AT_MS;
  const definition = reveal || hurry ? w.definition : null;

  const submit = (word: string) => {
    if (g.paused) return tr('Paused');
    const bad = lengthCheck(word, style, w.word.length);
    if (bad === 'short') return style === 'custom' ? tr('At least 7 letters') : tr('Not enough letters');
    if (bad === 'long') return tr('Too many letters');
    if (word !== w.word && !isWord(word)) return tr('Not in word list');
    const greens = score(word, w.word).filter((m) => m === 'ok').length;
    if (word === w.word) g.solve({ guess: word, greens });
    else if (guesses.length + 1 >= MAX_ROWS) g.miss({ guess: word, greens });
    else g.row(word, greens);
    return null;
  };

  const dock = reveal ? (
    <RaceReveal
      label={tr('The word')}
      answer={w.word}
      players={st.players}
      me={YOU}
      how={(p) => (p.solved ? `${nth(p.item_rank ?? 1)} · ${p.tries} ${p.tries === 1 ? 'try' : 'tries'}` : 'missed')}
      next={st.phase === 'done' ? tr('Adding up the scores…') : tr('{n} in {nextIn} s', { n: last ? tr('Results') : tr('Next word'), nextIn })}
    />
  ) : solved || out ? (
    <RaceReveal
      label={solved ? tr('Solved, {nth}', { nth: nth(st.me!.rank ?? 1) }) : tr('Out of guesses')}
      answer={solved ? w.word : tr('The word shows when time runs out.')}
      players={st.players.filter((p) => p.solved)}
      me={YOU}
      how={(p) => `${p.tries} ${p.tries === 1 ? 'try' : 'tries'}`}
      next={waiting ? <AnsweredRow seats={st.players.map((p) => ({ user_id: p.user_id, character: p.character, done: p.done }))} /> : tr('Everyone has finished')}
    />
  ) : undefined;

  return (
    <SlideTable
      label={{
        no: tr('WORD {n} OF {total}', { n: st.index + 1, total: st.total }),
        title: tr('Six Word Tries'),
        sub: tr('Vs rivals · {n} · {n2} letters', { n: STYLE_NAME[style], n2: w.word.length }),
        right: reveal ? undefined : <TurnClock ms={left} warn={left <= HURRY_MS} />,
      }}
      answer={w.word}
      played={guesses.map((x) => ({ word: x }))}
      rows={MAX_ROWS}
      rowSeq={guesses.length}
      definition={definition}
      noteHot={hurry}
      noteWait={tr('The definition appears in the last 20 seconds.')}
      live={!g.paused && !reveal && !solved && !out}
      hidden={g.paused}
      onSubmit={submit}
      maxLen={w.word.length}
      minLen={minLen(style)}
      onPause={g.openMenu}
      extra={<RivalBoards st={st} race={race} t={t} len={w.word.length} />}
      dock={dock}>
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </SlideTable>
  );
}
