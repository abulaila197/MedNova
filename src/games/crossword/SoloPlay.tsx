import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen, Ghost, Kick } from '../shell/ui';
import { AppGrid, AppLevelMap, AppPopup, AppTopBar } from './AppLook';
import {
  CW, buildSlots, composeAnswer, indexOf, isFilled, isUnlocked, judge, levelExp, lockedCells, pickHintCells, placeLetter, removeSlot, soloStars, startSolo, stepSolo,
  type CellPos, type PuzzleDef, type SoloEvent, type SoloRun, type Typed,
} from './core';
import { PUZZLES, clueText, puzzleById, puzzleByLevel } from './data';

/** One finished puzzle attempt in this session. */
type Done = { level: number; stars: number; exp: number; solved: number; total: number; left: boolean };
/** Solo bookmark (rules 7, 10): the open puzzle and the session so far. */
type SoloSave = { run: SoloRun | null; session: Done[] };

const BEST_KEY = 'crossword:best';

/** Solo (CW1-CW4, CW8, CW9): the level map, one puzzle at a time with tap to zoom, a result card, then session results. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const saved = play.resume as SoloSave | null;
  // An open puzzle that has left the levels since goes back to the map.
  const savedRun = saved?.run && puzzleById.has(saved.run.puzzleId) ? saved.run : null;
  const [run, setRun] = useState<SoloRun | null>(savedRun);
  const ref = useRef<SoloRun | null>(savedRun);
  const [session, setSession] = useState<Done[]>(saved?.session ?? []);
  const sessionRef = useRef<Done[]>(saved?.session ?? []);
  const [stored, setStored] = useState<Record<number, number>>({});
  const [paused, setPaused] = useState(false);
  // Each open puzzle (including a replay) gets a fresh screen: zoomed out, nothing open.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    engine.kv.get<Record<number, number>>(BEST_KEY).then((b) => setStored(b ?? {}));
  }, []);

  /** Best stars per level: saved bests plus this session's results (CW9). */
  const bestMap = useCallback(
    (list: Done[] = sessionRef.current) => {
      const b: Record<number, number> = { ...stored };
      for (const d of list) b[d.level] = Math.max(b[d.level] ?? 0, d.stars);
      return b;
    },
    [stored],
  );

  const save = useCallback(
    (r: SoloRun | null, list: Done[]) => engine.recorder.bookmark(play.id, { run: r, session: list } satisfies SoloSave, list.reduce((a, d) => a + d.stars, 0)),
    [play.id],
  );

  const open = useCallback(
    (level: number) => {
      const p = puzzleByLevel.get(level);
      if (!p) return;
      const r = startSolo(p.id);
      ref.current = r;
      setRun(r);
      setAttempt((x) => x + 1);
      setPaused(false);
      save(r, sessionRef.current);
    },
    [save],
  );

  const dispatch = useCallback(
    (e: SoloEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const p = puzzleById.get(prev.puzzleId)!;
      const next = stepSolo(p, prev, e);
      if (next === prev) return;
      ref.current = next;
      setRun(next);
      let list = sessionRef.current;
      if (next.phase === 'done' && prev.phase !== 'done') {
        const stars = soloStars(p, next);
        const exp = levelExp(stars, bestMap()[p.level] ?? 0);
        list = [...list, { level: p.level, stars, exp, solved: next.solved.length, total: p.words.length, left: next.left }];
        sessionRef.current = list;
        setSession(list);
        recordWords(play, p, next, exp);
      }
      save(next, list);
    },
    [play, save, bestMap],
  );

  const toMap = () => {
    ref.current = null;
    setRun(null);
    save(null, sessionRef.current);
  };

  /** Leaving shows the session's results; the bests are saved first so replays stay fair (CW9). */
  const finish = async () => {
    const list = sessionRef.current;
    if (!list.length) {
      await engine.recorder.discard(play.id);
      return onQuit();
    }
    await engine.kv.set(BEST_KEY, bestMap(list));
    onFinish(list.reduce((a, d) => a + d.exp, 0));
  };

  /** Pause-menu Quit: with puzzles finished this session, leave through the session results so the bests and EXP are
   * saved and a later "New game" can't wipe them; with none, keep the bookmark to resume the open puzzle. */
  const quit = () => (sessionRef.current.length ? finish() : onQuit());

  if (!run) {
    return (
      <GameScreen bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), gap: u(10) }}>
        <AppLevelMap best={bestMap(session)} count={PUZZLES.length} onOpen={open} action={<Ghost label={session.length ? 'See results' : 'Leave'} onPress={finish} />} />
      </GameScreen>
    );
  }

  const p = puzzleById.get(run.puzzleId)!;
  const best = bestMap(session);
  const last = session[session.length - 1];
  const nextLevel = p.level + 1;
  const canNext = puzzleByLevel.has(nextLevel) && isUnlocked(nextLevel, best);

  return (
    <Puzzle
      key={attempt}
      puzzle={p}
      run={run}
      playId={play.id}
      paused={paused}
      onEvent={dispatch}
      onPause={() => setPaused(true)}
      dock={
        run.phase === 'out' ? (
          <OutCard playId={play.id} onRevive={() => dispatch({ type: 'REVIVE' })} onReplay={() => open(p.level)} onEnd={() => dispatch({ type: 'LEAVE' })} />
        ) : run.phase === 'done' && last ? (
          <ResultCard done={last} canNext={canNext} onNext={() => open(nextLevel)} onRetry={() => open(p.level)} onMap={toMap} />
        ) : null
      }>
      <PauseMenu open={paused} mode="solo" onResume={() => setPaused(false)} onQuit={quit} />
    </Puzzle>
  );
}

/** CW1: every word becomes an item when the puzzle ends; unsolved ones go to Learn (diseases link their dossier). */
function recordWords(play: PlayProps['play'], p: PuzzleDef, r: SoloRun, exp: number) {
  const solved = new Set(r.solved);
  p.words.forEach((w, i) => {
    const ok = solved.has(w.id);
    recordItem(play, {
      seat: 0,
      itemId: w.id,
      answerKey: w.dossier ?? null,
      outcome: ok ? 'right' : 'wrong',
      answersGiven: r.tried[w.id] ?? [],
      timeMs: 0,
      hintsUsed: 0,
      revealsUsed: 0,
      points: ok ? 1 : 0,
      feedsLearn: !ok,
      // The puzzle's EXP rides on its first word so the shell can add it up once.
      gameData: { level: p.level, answer: w.answer, clue: clueText(w), category: w.category, exp: i === 0 ? exp : 0, stars: i === 0 ? soloStars(p, r) : 0 },
    });
  });
}

/**
 * One puzzle on screen: top bar, the zoomable grid, the answer popup. Shared by Solo; `dock` shows the out of
 * hearts or result card over the grid.
 */
function Puzzle({ puzzle, run, playId, paused, onEvent, onPause, dock, children }: {
  puzzle: PuzzleDef; run: SoloRun; playId: string; paused: boolean; onEvent: (e: SoloEvent) => void; onPause: () => void; dock: React.ReactNode; children?: React.ReactNode;
}) {
  const t = useTheme();
  const { width } = useScreen();
  const W = Math.min(width, 430);
  const idx = indexOf(puzzle);
  const [zoom, setZoom] = useState<CellPos | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [typed, setTyped] = useState<Typed>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [tokens, setTokens] = useState(0);
  const paying = useRef(false);
  const playing = run.phase === 'playing';
  // The newest run and open word, read after an await (the render's own values are stale by then).
  const live = useRef({ run, word });
  useEffect(() => {
    live.current = { run, word };
  });

  useEffect(() => {
    engine.wallet.balance().then((b) => setTokens(b.tokens));
  }, [run.hints, run.revives]);

  useEffect(() => {
    if (!playing) setWord(null);
  }, [playing]);

  const locked = lockedCells(idx, run.solved, run.revealed);
  const slots = word ? buildSlots(idx, word, locked) : [];

  const openWord = (id: string) => {
    setWord(id);
    setTyped(buildSlots(idx, id, locked).map(() => null));
    setNotice(null);
  };

  /** Tap to zoom: the first tap zooms; once zoomed, a tap opens that square's word (tap again to switch across/down). */
  const tapCell = (cell: CellPos) => {
    if (!playing) return;
    if (!zoom) return setZoom(cell);
    const ids = (idx.wordsAt.get(`${cell.r},${cell.c}`) ?? []).filter((id) => !run.solved.includes(id));
    if (!ids.length) return;
    const i = word ? ids.indexOf(word) : -1;
    openWord(ids[(i + 1) % ids.length]);
  };

  const submit = (next: Typed) => {
    if (!word) return;
    const answer = composeAnswer(slots, next);
    const out = judge(puzzle, run.solved, run.tried, word, answer);
    if (out === 'repeat') {
      setNotice('You already tried that one.');
      setTyped(slots.map(() => null));
      return setShake((x) => x + 1);
    }
    onEvent({ type: 'SUBMIT', wordId: word, answer });
    if (out === 'right') return setWord(null);
    if (out === 'wrong') {
      setNotice('Not this one. One heart lost.');
      setTyped(slots.map(() => null));
      setShake((x) => x + 1);
    }
  };

  const key = (k: string) => {
    const next = placeLetter(slots, typed, k);
    if (!next) return;
    setTyped(next);
    if (isFilled(slots, next)) submit(next);
  };

  /** CW4: pay first, then reveal; refund if the word was closed or solved while paying (rule 18). */
  const hint = async () => {
    if (!word || paying.current) return;
    const cells = pickHintCells(idx, word, locked);
    if (!cells.length) return setNotice('Only one letter left. Have a go.');
    paying.current = true;
    const receipt = await engine.wallet.spend(CW.hintPrice, 'crossword_hint', playId);
    paying.current = false;
    if (!receipt) return setNotice('You need 1 token. Each level up gives 1 token.');
    const now = live.current;
    if (now.word !== word || now.run.phase !== 'playing' || now.run.solved.includes(word)) {
      await engine.wallet.refund(receipt);
      return setNotice('Hint refunded.');
    }
    onEvent({ type: 'HINT', cells });
    setTyped(slots.map(() => null));
    setNotice(null);
  };

  const sel = word ? idx.wordById.get(word)! : null;
  const left = puzzle.words.length - run.solved.length;

  return (
    <GameScreen scroll={false} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), gap: u(10) }}>
      <AppTopBar kicker="Nova Crossword" title={`Puzzle ${puzzle.level}`} sub={`${puzzle.words.length} words · ${left} to go`} hearts={run.hearts} stars={soloStars(puzzle, run)} onPause={onPause} />
      <AppGrid puzzle={puzzle} solved={run.solved} revealed={run.revealed} selected={word} width={W - u(32)} zoom={zoom} onCell={tapCell} onBlank={(c) => playing && !zoom && setZoom(c)} />
      <View style={s.under}>
        <Text style={[s.tip, { color: t.mute }]}>{zoom ? 'Tap a square to open its word.' : 'Tap part of the grid to zoom in.'}</Text>
        {zoom ? <Ghost label="Zoom out" onPress={() => setZoom(null)} /> : null}
      </View>
      {playing ? (
        <View style={s.endRow}>
          <Ghost label="End puzzle" onPress={() => onEvent({ type: 'LEAVE' })} />
        </View>
      ) : null}
      {sel && playing && !paused ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[StyleSheet.absoluteFill, s.sheetWrap]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,8,25,0.45)' }]} onPress={() => setWord(null)} accessibilityLabel="Close the word" />
          <AppPopup word={sel} slots={slots} typed={typed} tokens={tokens} width={W} notice={notice} shake={shake} onKey={key} onSlot={(i) => setTyped(removeSlot(slots, typed, i))} onHint={hint} onClose={() => setWord(null)} />
        </Animated.View>
      ) : null}
      {dock ? (
        <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.dockWrap]}>
          {dock}
        </Animated.View>
      ) : null}
      {children}
    </GameScreen>
  );
}

/** CW3, CW8: out of hearts. A token buys 1 heart (as often as you like), or replay, or end with the stars you have. */
function OutCard({ playId, onRevive, onReplay, onEnd }: { playId: string; onRevive: () => void; onReplay: () => void; onEnd: () => void }) {
  const t = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  const revive = async () => {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      const receipt = await engine.wallet.spend(CW.revivePrice, 'crossword_revive', playId);
      if (!receipt) return setNote('You need 1 token. Each level up gives 1 token.');
      onRevive();
    } finally {
      busy.current = false;
      setSending(false);
    }
  };
  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <Kick color={t.mode === 'light' ? '#d4504c' : '#ff6b7d'}>Out of hearts</Kick>
      <Text style={[s.big, { color: t.white }]}>Keep going?</Text>
      <Text style={[s.line, { color: t.mute }]}>{note ?? `${CW.revivePrice} token gives you ${CW.reviveHearts} heart. Words you solved stay solved.`}</Text>
      <Btn label={`Revive · ${CW.revivePrice} token`} onPress={revive} disabled={sending} style={{ marginTop: u(4) }} />
      <View style={s.row}>
        <Ghost label="Replay" onPress={onReplay} style={{ flex: 1 }} />
        <Ghost label="End puzzle" onPress={onEnd} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

/** The puzzle's stars and EXP, with Next puzzle, Retry and the level map. */
function ResultCard({ done, canNext, onNext, onRetry, onMap }: { done: Done; canNext: boolean; onNext: () => void; onRetry: () => void; onMap: () => void }) {
  const t = useTheme();
  const expLine = !done.stars
    ? 'No stars this time. Solve all but two words for a star.'
    : done.exp
      ? `+${done.exp} EXP${done.exp < done.stars * CW.expPerStar ? ' for your new star' + (done.exp > CW.expPerStar ? 's' : '') : ''}`
      : 'No new stars, so no EXP. Beat your best to earn more.';
  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={s.cardTop}>
        <Kick color={done.stars ? t.accent : t.mute}>{`Puzzle ${done.level} · ${done.solved} of ${done.total} words`}</Kick>
        <Text style={{ fontSize: u(15), letterSpacing: u(1) }} accessibilityLabel={`${done.stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <Text key={i} style={{ color: i < done.stars ? t.accent : t.mode === 'light' ? '#d3ccbf' : '#2a3050' }}>★</Text>
          ))}
        </Text>
      </View>
      <Text style={[s.big, { color: t.white }]}>{done.stars === 3 ? 'Grid complete' : done.stars ? 'Puzzle done' : done.left ? 'Puzzle ended' : 'Puzzle done'}</Text>
      <Text style={[s.line, { color: t.soft }]}>{expLine}</Text>
      <View style={s.row}>
        <Ghost label="Retry" onPress={onRetry} style={{ flex: 1 }} />
        {canNext ? <Btn label="Next puzzle" onPress={onNext} style={{ flex: 1.4 }} /> : <Btn label="All puzzles" onPress={onMap} style={{ flex: 1.4 }} />}
      </View>
      {canNext ? (
        <Pressable onPress={onMap} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel="All puzzles" style={{ alignSelf: 'flex-start' }}>
          <Text style={[s.link, { color: t.mute }]}>All puzzles</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  under: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: u(10), minHeight: u(36) },
  tip: { fontFamily: F.body, fontSize: u(12), flex: 1 },
  endRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  sheetWrap: { justifyContent: 'flex-end', zIndex: 5 },
  dockWrap: { justifyContent: 'flex-end', padding: u(16), zIndex: 6 },
  card: { borderWidth: 1, borderRadius: u(16), padding: u(14), gap: u(6) },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  big: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26) },
  line: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17) },
  row: { flexDirection: 'row', gap: u(8), marginTop: u(4) },
  link: { fontFamily: F.bodySemi, fontSize: u(11) },
});
