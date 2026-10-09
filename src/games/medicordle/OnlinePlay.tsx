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
import { MAX_ROWS, lengthCheck, soloExp, type Style } from './core';
import { WORDS, isWord } from './data';
import { SlideTable, TurnClock } from './Slides';

const STYLE_NAME: Record<Style, string> = { classic: 'Classic', custom: 'Custom' };
const wordOf = (n: number) => WORDS[n - 1];
/** NM11: "close" once a player has two-thirds of the letters green in one row (4 of 6 in Classic). */
const closeAt = (len: number) => Math.ceil((2 * len) / 3);

function itemsOf(st: RaceState) {
  const style = (st.settings.style as Style) ?? 'classic';
  return (st.my_items ?? []).map((m) => {
    const w = wordOf(m.item);
    const right = m.solved_ms != null;
    const used = (m.guesses ?? []).length;
    return {
      seat: 0,
      itemId: w.id,
      answerKey: w.dossier, // results link only (RS1); Medicordle never feeds Learn (NM1)
      outcome: right ? ('right' as const) : used >= MAX_ROWS ? ('wrong' as const) : ('timed_out' as const),
      answersGiven: (m.guesses ?? []).filter((g) => g !== w.word),
      timeMs: m.solved_ms ?? (Number(st.settings.wordtime) || 90) * 1000,
      hintsUsed: 0,
      revealsUsed: 0,
      points: m.points,
      feedsLearn: false,
      // NM29: Solo's EXP rule per word (12 for guess 1 down to 2 for guess 6), no daily double.
      gameData: { style, guesses: used, exp: right ? soloExp(used, false) : 0, rank: m.rank, room: st.room_id },
    };
  });
}

/**
 * Nova Medicordle Online (NM10, NM11, NM15-NM18, NM26-NM29): the same word for everyone, each on their own board,
 * six guesses, no letter hints. 100, 80, 65... by solve order plus 10 for each guess left. The server checks every guess.
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const { st, load, server, playing, notice, setNotice, leave } = useRace(def, roomId, matchId, me, itemsOf);
  const [menu, setMenu] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const { alert, push } = useAlerts();
  const seen = useRef<{ key: string; solved: Set<string>; close: Set<string> }>({ key: '', solved: new Set(), close: new Set() });

  // NM11 alerts: each solve ("Lina solved it in 3") and "close" ("Omar has 4 green").
  useEffect(() => {
    if (!st || st.phase !== 'case' || st.item == null) return;
    const key = `${st.index}`;
    if (seen.current.key !== key) seen.current = { key, solved: new Set(st.players.filter((p) => p.solved).map((p) => p.user_id)), close: new Set() };
    const need = closeAt(wordOf(st.item).word.length);
    for (const p of st.players) {
      if (p.user_id === me) continue;
      const color = characterOf(p.character)?.ring ?? '#6fd6ff';
      if (p.solved && !seen.current.solved.has(p.user_id)) {
        seen.current.solved.add(p.user_id);
        seen.current.close.add(p.user_id);
        push(`${p.name} solved it in ${p.tries}`, color);
      } else if (!p.solved && (p.greens ?? 0) >= need && !seen.current.close.has(p.user_id)) {
        seen.current.close.add(p.user_id);
        push(`${p.name} has ${p.greens} green`, color);
      }
    }
  }, [st, me, push]);

  // The guess shows at once; it leaves the pending slot when the server's board has it.
  const sent = st?.me?.guesses.length ?? 0;
  useEffect(() => setPending(null), [sent, st?.index]);

  if (!st) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <GameScreen scroll={false}>
        <Countdown ms={st.phase_ends_at - server} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />
      </GameScreen>
    );
  }

  const style = (st.settings.style as Style) ?? 'classic';
  const w = wordOf(st.item);
  const mine = st.players.find((p) => p.user_id === me);
  const talker = { id: me, name: mine?.name ?? 'You', face: mine?.character ?? 'yara' };
  const reveal = st.phase !== 'case';
  const guesses = [...(st.me?.guesses ?? []), ...(pending ? [pending] : [])];
  const solved = st.me?.solved_ms != null;
  const out = !solved && guesses.length >= MAX_ROWS;
  const left = reveal ? 0 : Math.max(0, st.phase_ends_at - server);
  const last = st.index + 1 >= st.total;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - server) / 1000));
  const waiting = st.players.filter((p) => p.user_id !== me && !p.dropped && !p.done).length;
  // NM28: the definition shows on your last guess (after the 5th miss), and to everyone when the word ends.
  const definition = reveal || (!solved && guesses.length >= MAX_ROWS - 1) ? w.definition : null;

  const submit = (g: string) => {
    if (pending) return 'Sending…';
    const bad = lengthCheck(g, style, w.word.length);
    if (bad === 'short') return style === 'custom' ? 'At least 7 letters' : 'Not enough letters';
    if (bad === 'long') return 'Too many letters';
    if (!isWord(g)) return 'Not in word list';
    setPending(g);
    call<{ outcome: string }>('nm_guess', { m: matchId, word: g })
      .then(() => load())
      .catch(() => {
        setPending(null);
        setNotice('Couldn’t send that. Try again.');
      });
    return null;
  };

  const dock = reveal ? (
    <RaceReveal
      label="The word"
      answer={w.word}
      players={st.players}
      me={me}
      how={(p) => (p.solved ? `${nth(p.item_rank ?? 1)} · ${p.tries} ${p.tries === 1 ? 'try' : 'tries'}` : 'missed')}
      next={st.phase === 'done' ? 'Adding up the scores…' : `${last ? 'Results' : 'Next word'} in ${nextIn} s`}
    />
  ) : !playing ? (
    <RaceReveal label="You’re watching" answer="You get a seat at the rematch." players={st.players.filter((p) => p.solved)} me={me} how={(p) => `${p.tries} tries`} next="" />
  ) : solved || out ? (
    <RaceReveal
      label={solved ? `Solved, ${nth(st.me!.rank ?? 1)} · +${st.me!.points}` : 'Out of guesses'}
      answer={solved ? w.word : 'The word shows when time runs out.'}
      players={st.players.filter((p) => p.solved)}
      me={me}
      how={(p) => `${p.tries} ${p.tries === 1 ? 'try' : 'tries'}`}
      next={waiting ? `Waiting for ${waiting} more` : 'Everyone has finished'}
    />
  ) : undefined;

  return (
    <SlideTable
      label={{
        no: `WORD ${st.index + 1} OF ${st.total}`,
        title: 'Medicordle',
        sub: `Online · ${STYLE_NAME[style]} · ${w.word.length} letters`,
        right: reveal ? undefined : <TurnClock ms={left} warn={left <= 10_000} />,
      }}
      answer={w.word}
      played={guesses.map((g) => ({ word: g }))}
      rows={MAX_ROWS}
      rowSeq={guesses.length}
      definition={definition}
      live={playing && !reveal && !solved && !out}
      onSubmit={submit}
      maxLen={w.word.length}
      minLen={style === 'custom' ? 7 : 6}
      onPause={() => setMenu(true)}
      notice={notice}
      dock={dock}>
      <AlertPill alert={alert} />
      <RoomTalk room={roomId} me={talker} />
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </SlideTable>
  );
}
