import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine, rank } from '../engine';
import { Curtain } from '../shell/Curtain';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import { teamLap, teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen, Ghost, Kick } from '../shell/ui';
import { AppGrid, AppPopup, AppTopBar } from './AppLook';
import { CW, autoSolved, buildSlots, composeAnswer, indexOf, isFilled, judge, lockedCells, placeLetter, removeSlot, type CellPos, type PuzzleDef, type Typed } from './core';
import { PUZZLES, clueText, puzzleById } from './data';
import { currentSeat, offlineRecap, offlineStandings, startOffline, stepOffline, type OfflineEvent, type OfflineRun } from './offline';

/** How long the right / wrong line shows in the popup before the phone passes on. */
const FLASH_MS = 1100;

/** Offline (CW5, OF1, TMG-CW): one shared grid, one word per turn, pass the phone. No hints, no EXP. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const { width } = useScreen();
  const W = Math.min(width, 430);
  const [run, setRun] = useState<OfflineRun | null>(null);
  const ref = useRef<OfflineRun | null>(null);
  const [paused, setPaused] = useState(false);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);
  const nameOf = (seat: number) => names[seat] ?? `Player ${seat + 1}`;

  // Start: an unseen puzzle (rule 15); random laps, or teams alternate (TM5).
  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (r && !puzzleById.has(r.puzzleId)) r = null; // the puzzle left the levels since: start fresh
      if (!r) {
        const seats = play.seats.filter((x) => !x.removed);
        const teams = teamsOf(play);
        const [id] = await engine.picker.pick(play.game, PUZZLES.map((x) => x.id), 1);
        r = startOffline(id ?? PUZZLES[0].id, seats.map((x) => x.seat), Math.random, teams ? teamLap(seats, teams) : null);
        engine.recorder.bookmark(play.id, r, 0);
      }
      if (live) {
        ref.current = r;
        setRun(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [play]);

  const dispatch = useCallback(
    (e: OfflineEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const p = puzzleById.get(prev.puzzleId)!;
      const next = stepOffline(p, prev, e);
      if (next === prev) return;
      ref.current = next;
      setRun(next);
      engine.recorder.bookmark(play.id, next, next.players[0]?.score ?? 0);
      if (next.phase === 'done' && prev.phase !== 'done') {
        engine.picker.markSeen(play.game, p.id);
        recordWords(play, p, next);
        onFinish(next.players[0]?.score ?? 0, rank(offlineStandings(next, names)));
      }
    },
    [play, onFinish, names],
  );

  if (!run || run.phase === 'done') return <GameScreen scroll={false}>{null}</GameScreen>;

  const p = puzzleById.get(run.puzzleId)!;
  const seat = currentSeat(run);
  const who = seatOf.get(seat);
  const me = run.players[seat];
  const board = run.seats
    .filter((x) => !run.removed.includes(x))
    .map((x) => ({ seat: x, name: nameOf(x), score: run.players[x].score, color: seatOf.get(x)?.color }))
    .sort((a, b) => b.score - a.score);
  const claims = Object.fromEntries(Object.entries(run.solvedBy).map(([id, s]) => [id, seatOf.get(s)?.color ?? t.accent]));
  const left = p.words.length - Object.keys(run.solvedBy).length;

  return (
    <GameScreen scroll={false} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), gap: u(10) }}>
      <AppTopBar kicker={`${left} ${left === 1 ? 'word' : 'words'} left`} title={nameOf(seat)} titleColor={who?.color} sub={me.revived ? 'Revive used' : 'One word this turn'} hearts={me.hearts} score={me.score} onPause={() => setPaused(true)} />
      {run.phase === 'playing' && !paused ? (
        <Turn key={run.turns.length} puzzle={p} run={run} claims={claims} width={W} onEvent={dispatch} />
      ) : (
        <AppGrid puzzle={p} solved={Object.keys(run.solvedBy)} claims={claims} width={W - u(32)} />
      )}
      {run.phase === 'revive' ? (
        <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.dockWrap]}>
          <ReviveCard playId={play.id} name={nameOf(seat)} onRevive={() => dispatch({ type: 'REVIVE' })} onDecline={() => dispatch({ type: 'DECLINE' })} />
        </Animated.View>
      ) : null}
      {run.phase === 'handoff' ? (
        <Curtain
          name={nameOf(seat)}
          color={who?.color}
          sub={`${me.hearts} ${me.hearts === 1 ? 'heart' : 'hearts'} left · one word this turn`}
          board={board}
          recap={offlineRecap(p, run, seat, play)}
          onReady={() => dispatch({ type: 'READY' })}
        />
      ) : null}
      <PauseMenu
        open={paused}
        mode="offline"
        seats={play.seats.map((x) => ({ ...x, removed: x.removed || run.removed.includes(x.seat) }))}
        keep={[0]}
        onResume={() => setPaused(false)}
        onQuit={onQuit}
        onRemove={(x) => {
          engine.recorder.removeSeat(play.id, x);
          dispatch({ type: 'REMOVE', seat: x });
        }}
      />
    </GameScreen>
  );
}

/** Each word is one item: claimed words go to whoever claimed them; words nobody got go to the phone owner. No Learn in Offline. */
function recordWords(play: PlayProps['play'], p: PuzzleDef, r: OfflineRun) {
  for (const w of p.words) {
    const by = r.solvedBy[w.id];
    recordItem(play, {
      seat: by ?? 0,
      itemId: w.id,
      answerKey: w.dossier ?? null,
      outcome: by != null ? 'right' : 'wrong',
      answersGiven: [],
      timeMs: 0,
      hintsUsed: 0,
      revealsUsed: 0,
      points: by != null ? w.answer.length : 0,
      feedsLearn: false,
      gameData: { level: p.level, answer: w.answer, clue: clueText(w), category: w.category },
    });
  }
}

/** One player's turn: zoom, open a word, answer it. Closing the word ends the turn with no penalty (as coded). */
function Turn({ puzzle, run, claims, width, onEvent }: { puzzle: PuzzleDef; run: OfflineRun; claims: Record<string, string>; width: number; onEvent: (e: OfflineEvent) => void }) {
  const t = useTheme();
  const idx = indexOf(puzzle);
  const seat = currentSeat(run);
  const me = run.players[seat];
  const solved = Object.keys(run.solvedBy);
  const [zoom, setZoom] = useState<CellPos | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [typed, setTyped] = useState<Typed>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null);
  const locked = lockedCells(idx, solved);
  const slots = word ? buildSlots(idx, word, locked) : [];

  const openWord = (id: string) => {
    setWord(id);
    setTyped(buildSlots(idx, id, locked).map(() => null));
    setNotice(null);
  };

  const tapCell = (cell: CellPos) => {
    if (flash) return;
    if (!zoom) return setZoom(cell);
    const ids = (idx.wordsAt.get(`${cell.r},${cell.c}`) ?? []).filter((id) => !solved.includes(id));
    if (!ids.length) return;
    const i = word ? ids.indexOf(word) : -1;
    openWord(ids[(i + 1) % ids.length]);
  };

  const submit = (next: Typed) => {
    if (!word) return;
    const answer = composeAnswer(slots, next);
    const out = judge(puzzle, solved, me.tried, word, answer);
    if (out === 'repeat') {
      setNotice('You already tried that one.');
      setTyped(slots.map(() => null));
      return setShake((x) => x + 1);
    }
    if (out === 'ignored') return;
    // Show the result for a moment, then the phone passes on.
    const w = word;
    setFlash(out);
    if (out === 'wrong') {
      setShake((x) => x + 1);
      setNotice(me.hearts <= 1 ? 'Not this one. That was your last heart.' : 'Not this one. One heart lost.');
    } else {
      const got = [w, ...autoSolved(idx, [...solved, w])];
      setNotice(`Right! +${got.reduce((a, id) => a + idx.wordById.get(id)!.answer.length, 0)}`);
    }
    setTimeout(() => onEvent({ type: 'SUBMIT', wordId: w, answer }), FLASH_MS);
  };

  const key = (k: string) => {
    if (flash) return;
    const next = placeLetter(slots, typed, k);
    if (!next) return;
    setTyped(next);
    if (isFilled(slots, next)) submit(next);
  };

  const sel = word ? idx.wordById.get(word)! : null;
  return (
    <>
      <AppGrid puzzle={puzzle} solved={solved} claims={claims} selected={word} width={width - u(32)} zoom={zoom} onCell={tapCell} onBlank={(c) => !zoom && setZoom(c)} />
      <View style={s.under}>
        <Text style={[s.tip, { color: t.mute }]}>{zoom ? 'Tap a square to open its word.' : 'Tap part of the grid to zoom in.'}</Text>
        {zoom ? <Ghost label="Zoom out" onPress={() => setZoom(null)} /> : null}
      </View>
      {sel ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[StyleSheet.absoluteFill, s.sheetWrap]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,8,25,0.45)' }]} />
          <AppPopup
            word={sel}
            slots={slots}
            typed={typed}
            width={width}
            notice={notice}
            shake={shake}
            onKey={key}
            onSlot={(i) => !flash && setTyped(removeSlot(slots, typed, i))}
            onClose={() => !flash && onEvent({ type: 'CLOSE' })}
            foot={
              <View style={[s.foot, { borderColor: t.panelLine }]}>
                <Text style={[s.footT, { color: t.mute }]}>{flash ? ' ' : 'No hints in this mode. Closing the word ends your turn.'}</Text>
                {!flash ? (
                  <Pressable onPress={() => setWord(null)} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel="Pick another word">
                    <Text style={[s.footT, { color: t.accent, fontFamily: F.bodySemi }]}>Other word</Text>
                  </Pressable>
                ) : null}
              </View>
            }
          />
        </Animated.View>
      ) : null}
    </>
  );
}

/** CW5 / CW6: at 0 hearts, one token revive per player per match (Offline: paid by the phone owner); otherwise out. */
export function ReviveCard({ playId, name, text, payer = 'The phone owner', decline = 'No revive, leave the game', onRevive, onDecline }: {
  playId: string; name: string; text?: string; payer?: string; decline?: string; onRevive: () => void | Promise<void>; onDecline: () => void;
}) {
  const t = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  /** The button stays off until the revive lands; a failed revive refunds the token (rule 18). */
  const revive = async () => {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      const receipt = await engine.wallet.spend(CW.revivePrice, 'crossword_revive', playId);
      if (!receipt) return setNote(`${payer} needs 1 token. Each level up gives 1 token.`);
      try {
        await onRevive();
      } catch {
        await engine.wallet.refund(receipt);
        setNote('Couldn’t revive. Your token was refunded. Try again.');
      }
    } finally {
      busy.current = false;
      setSending(false);
    }
  };
  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <Kick color={t.mode === 'light' ? '#d4504c' : '#ff6b7d'}>Out of hearts</Kick>
      <Text style={[s.big, { color: t.white }]}>{name}</Text>
      <Text style={[s.line, { color: t.mute }]}>{note ?? text ?? `No hearts left. One revive per player: ${CW.revivePrice} token from the phone owner gives ${CW.reviveHearts} heart. Words claimed so far stay claimed.`}</Text>
      <Btn label={`Revive · ${CW.revivePrice} token`} onPress={revive} disabled={sending} style={{ marginTop: u(4) }} />
      <Ghost label={decline} onPress={onDecline} />
    </View>
  );
}

const s = StyleSheet.create({
  under: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: u(10), minHeight: u(36) },
  tip: { fontFamily: F.body, fontSize: u(12), flex: 1 },
  sheetWrap: { justifyContent: 'flex-end', zIndex: 5 },
  dockWrap: { justifyContent: 'flex-end', padding: u(16), zIndex: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: u(9), marginTop: u(2), gap: u(10) },
  footT: { fontFamily: F.body, fontSize: u(11.5), flexShrink: 1 },
  card: { borderWidth: 1, borderRadius: u(16), padding: u(14), gap: u(6) },
  big: { fontFamily: F.display, fontSize: u(21), lineHeight: u(25) },
  line: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17) },
});
