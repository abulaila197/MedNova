import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen, Ghost, Kick } from '../shell/ui';
import { RD, levelExp, levelTime, livesLeft, snapshotLevel, startLevel, stepLevel, type Level, type LevelEvent } from './core';
import { RIDDLES, answerLabel, feedsLearn, riddleById, riddleName } from './data';
import { RiddleBoard } from './RiddleBoard';

/** One finished level attempt in this session. */
type Done = { riddleId: string; solved: boolean; stars: number; exp: number };
/** Solo bookmark (rules 7, 10): the open level at its exact clock, and the session so far. */
type SoloSave = { level: Level | null; session: Done[]; index?: number };

const BEST_KEY = 'riddler:best';

/** Solo (RD3, RD4, RD9-RD11, RD15, RD16): the level grid, one level at a time, a result card, then session results. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const saved = play.resume as SoloSave | null;
  const [level, setLevel] = useState<Level | null>(saved?.level ?? null);
  const ref = useRef<Level | null>(saved?.level ?? null);
  const [session, setSession] = useState<Done[]>(saved?.session ?? []);
  const sessionRef = useRef<Done[]>(saved?.session ?? []);
  const [stored, setStored] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [wrongSeq, setWrongSeq] = useState(0);
  const paying = useRef(false);

  useEffect(() => {
    engine.kv.get<Record<string, number>>(BEST_KEY).then((b) => setStored(b ?? {}));
  }, []);

  /** Best stars per level: saved bests plus this session's solves (RD10). */
  const bestOf = useCallback(
    (id: string, list: Done[] = sessionRef.current) => Math.max(stored[id] ?? 0, ...list.filter((d) => d.riddleId === id).map((d) => d.stars)),
    [stored],
  );

  const save = useCallback(
    (l: Level | null, list: Done[]) => {
      const idx = l ? RIDDLES.findIndex((r) => r.id === l.riddleId) : undefined;
      engine.recorder.bookmark(play.id, { level: l ? snapshotLevel(l, Date.now()) : null, session: list, index: idx } satisfies SoloSave, list.reduce((a, d) => a + d.stars, 0));
    },
    [play.id],
  );

  const open = useCallback(
    (id: string) => {
      const l = startLevel(id, Date.now());
      ref.current = l;
      setLevel(l);
      setNotice(null);
      save(l, sessionRef.current);
    },
    [save],
  );

  const dispatch = useCallback(
    (e: LevelEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepLevel(prev, e);
      if (next === prev) return;
      ref.current = next;
      setLevel(next);
      if (next.wrong.length > prev.wrong.length) setWrongSeq((x) => x + 1);
      let list = sessionRef.current;
      if ((next.phase === 'solved' || next.phase === 'failed') && prev.phase === 'playing') {
        const r = riddleById.get(next.riddleId)!;
        const solved = next.phase === 'solved';
        const exp = solved ? levelExp(next.stars, bestOf(r.id)) : 0;
        list = [...list, { riddleId: r.id, solved, stars: next.stars, exp }];
        sessionRef.current = list;
        setSession(list);
        engine.picker.markSeen(play.game, r.id);
        recordItem(play, {
          seat: 0,
          itemId: r.id,
          answerKey: r.dossier,
          outcome: solved ? 'right' : 'wrong',
          answersGiven: next.wrong.map(answerLabel),
          timeMs: next.timeMs,
          hintsUsed: next.hintUsed ? 1 : 0,
          revealsUsed: 0,
          points: next.stars,
          // RD1: only a failed condition riddle goes to Learn; signs and symptoms are not saved.
          feedsLearn: !solved && feedsLearn(r),
          gameData: { stars: next.stars, exp, wrong: next.wrong.length, kind: r.kind },
        });
      }
      save(next, list);
    },
    [play, save, bestOf],
  );

  // The stopwatch display.
  useEffect(() => {
    if (level?.phase !== 'playing') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [level?.phase]);

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(id);
  }, [notice]);

  /** Pay first, then show the definition; refund when the level ended while paying (rule 18). */
  const hint = useCallback(async () => {
    const l = ref.current;
    if (!l || paying.current || l.phase !== 'playing' || l.hintUsed) return;
    paying.current = true;
    const receipt = await engine.wallet.spend(RD.hintPrice, 'riddler_hint', play.id);
    paying.current = false;
    if (!receipt) return setNotice('You need 1 token. 200 EXP makes 1 token.');
    const cur = ref.current;
    if (!cur || cur.riddleId !== l.riddleId || cur.phase !== 'playing') {
      await engine.wallet.refund(receipt);
      return setNotice('Hint refunded.');
    }
    dispatch({ type: 'HINT' });
  }, [dispatch, play.id]);

  const toGrid = () => {
    ref.current = null;
    setLevel(null);
    save(null, sessionRef.current);
  };

  /** RD16: leaving shows the session's results; the bests are saved first so replays stay fair (RD10). */
  const finish = async () => {
    const list = sessionRef.current;
    if (!list.length) {
      await engine.recorder.discard(play.id);
      return onQuit();
    }
    const best = { ...stored };
    for (const d of list) best[d.riddleId] = Math.max(best[d.riddleId] ?? 0, d.stars);
    await engine.kv.set(BEST_KEY, best);
    onFinish(list.reduce((a, d) => a + d.exp, 0));
  };

  if (!level) return <LevelGrid best={(id) => bestOf(id, session)} session={session} onOpen={open} onFinish={finish} />;

  const r = riddleById.get(level.riddleId)!;
  const idx = RIDDLES.findIndex((x) => x.id === r.id);
  const over = level.phase === 'solved' || level.phase === 'failed';
  const last = session[session.length - 1];
  const nextId = RIDDLES[(idx + 1) % RIDDLES.length].id;

  return (
    <RiddleBoard
      riddle={r}
      kicker={`Level ${idx + 1} of ${RIDDLES.length}`}
      title={{ text: 'The Riddler' }}
      clockMs={levelTime(level, now)}
      lives={livesLeft(level)}
      wrong={level.wrong}
      wrongSeq={wrongSeq}
      onGuess={(answerId) => !paying.current && dispatch({ type: 'GUESS', answerId, now: Date.now() })}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      hint={{ used: level.hintUsed, onHint: hint }}
      hidden={level.phase === 'paused'}
      notice={notice}
      dock={
        over && last ? (
          <ResultCard
            done={last}
            level={level}
            onNext={() => open(nextId)}
            onRetry={() => open(r.id)}
            onGrid={toGrid}
          />
        ) : undefined
      }>
      <PauseMenu open={level.phase === 'paused'} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </RiddleBoard>
  );
}

/** RD11: the answer, stars and EXP, with Next level, Retry and a dossier link where the answer has one. */
function ResultCard({ done, level, onNext, onRetry, onGrid }: { done: Done; level: Level; onNext: () => void; onRetry: () => void; onGrid: () => void }) {
  const t = useTheme();
  const lt = t.mode === 'light';
  const r = riddleById.get(done.riddleId)!;
  const tone = done.solved ? (lt ? '#2f9e6c' : '#3fc58a') : lt ? '#d4504c' : '#ff5c6c';
  const expLine = !done.solved
    ? 'Out of lives. No EXP this time.'
    : done.exp
      ? `+${done.exp} EXP${done.exp < done.stars * RD.expPerStar ? ' for your new star' + (done.exp > RD.expPerStar ? 's' : '') : ''}`
      : 'No new stars, so no EXP. Beat your best to earn more.';
  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={s.cardTop}>
        <Kick color={tone}>{done.solved ? `Solved in ${Math.ceil(level.timeMs / 1000)} s` : 'Missed'}</Kick>
        {done.solved ? <Stars n={done.stars} size={14} /> : null}
      </View>
      <Text style={[s.ans, { color: t.white }]}>{riddleName(r)}</Text>
      <Text style={[s.def, { color: t.mute }]} numberOfLines={3}>{r.definition}</Text>
      <Text style={[s.exp, { color: t.soft }]}>{expLine}</Text>
      <View style={s.row}>
        <Ghost label="Retry" onPress={onRetry} style={{ flex: 1 }} />
        <Btn label="Next level" onPress={onNext} style={{ flex: 1.4 }} />
      </View>
      <View style={s.links}>
        <Pressable onPress={onGrid} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel="All levels">
          <Text style={[s.link, { color: t.mute }]}>All levels</Text>
        </Pressable>
        {r.dossier ? (
          <Pressable onPress={() => router.push(`/learn/dossier?id=${r.dossier}`)} hitSlop={u(6)} accessibilityRole="link" accessibilityLabel={`Open the dossier for ${r.answer}`}>
            <Text style={[s.link, { color: t.accent }]}>Open the dossier ›</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Stars printed on the paper tiles of the level board: gold when earned, a clear outline when not. */
const PAPER_STAR = { on: '#e09a12', off: '#c9c1b2' };

function PaperStars({ n }: { n: number }) {
  return (
    <View style={s.pStars} accessibilityLabel={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Text key={i} style={[s.pStar, { color: i < n ? PAPER_STAR.on : PAPER_STAR.off }]}>{i < n ? '★' : '☆'}</Text>
      ))}
    </View>
  );
}

function Stars({ n, size }: { n: number; size: number }) {
  const t = useTheme();
  return (
    <Text style={{ fontSize: u(size), letterSpacing: u(1) }} accessibilityLabel={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Text key={i} style={{ color: i < n ? t.accent : t.mode === 'light' ? '#d3ccbf' : '#2a3050' }}>★</Text>
      ))}
    </Text>
  );
}

/** RD3, RD15: all levels open, as small pinned cards with the number and stars; pictures stay hidden. */
function LevelGrid({ best, session, onOpen, onFinish }: { best: (id: string) => number; session: Done[]; onOpen: (id: string) => void; onFinish: () => void }) {
  const t = useTheme();
  const solved = RIDDLES.filter((r) => best(r.id) > 0).length;
  const stars = RIDDLES.reduce((a, r) => a + best(r.id), 0);
  const firstOpen = RIDDLES.find((r) => best(r.id) === 0)?.id;
  return (
    <GameScreen>
      <View style={s.gTop}>
        <View style={{ flex: 1 }}>
          <Kick>{`${solved} of ${RIDDLES.length} solved · ${stars} ★`}</Kick>
          <Text style={[s.gTitle, { color: t.white }]} numberOfLines={1}>
            The <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>Riddler</Text>
          </Text>
        </View>
        <Ghost label={session.length ? 'See results' : 'Leave'} onPress={onFinish} />
      </View>
      <Animated.View entering={FadeIn.duration(240)} style={[s.board, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
        {RIDDLES.map((r, i) => {
          const b = best(r.id);
          const next = r.id === firstOpen;
          return (
            <Pressable
              key={r.id}
              onPress={() => onOpen(r.id)}
              style={[s.tile, { transform: [{ rotate: `${((i * 37) % 7) - 3}deg` }] }, next && { borderColor: t.accent, borderWidth: 1.5 }]}
              accessibilityRole="button"
              accessibilityLabel={`Level ${i + 1}, ${b ? `${b} of 3 stars` : 'not solved'}`}>
              <View style={[s.pin, { backgroundColor: b ? t.accent : '#b9b2a4' }]} />
              <Text style={s.tileN}>{i + 1}</Text>
              <PaperStars n={b} />
            </Pressable>
          );
        })}
      </Animated.View>
    </GameScreen>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(16), padding: u(13), gap: u(6) },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ans: { fontFamily: F.display, fontSize: u(21), lineHeight: u(25) },
  def: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15.5) },
  exp: { fontFamily: F.bodySemi, fontSize: u(11.5) },
  row: { flexDirection: 'row', gap: u(8), marginTop: u(4) },
  links: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: u(2) },
  link: { fontFamily: F.bodySemi, fontSize: u(11) },
  gTop: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  gTitle: { fontFamily: F.display, fontSize: u(24), lineHeight: u(28) },
  board: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: u(8), borderWidth: 1, borderRadius: u(16), paddingVertical: u(14), paddingHorizontal: u(4) },
  tile: {
    width: u(52), height: u(60), backgroundColor: '#fbfaf6', borderRadius: u(3), alignItems: 'center', justifyContent: 'center', gap: u(2), borderWidth: 1, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: u(5), shadowOffset: { width: 0, height: u(3) }, elevation: 3,
  },
  pin: { position: 'absolute', top: u(4), width: u(6), height: u(6), borderRadius: u(3) },
  tileN: { fontFamily: F.display, fontSize: u(17), lineHeight: u(20), color: '#2b2f45', marginTop: u(6) },
  pStars: { flexDirection: 'row', gap: u(1) },
  pStar: { fontSize: u(13.5), lineHeight: u(16), textShadowColor: 'rgba(0,0,0,0.12)', textShadowRadius: u(1), textShadowOffset: { width: 0, height: u(0.5) } },
});
