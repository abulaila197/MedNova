import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { spendTokens, whySay } from '@/features/style/useStyle';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { useSession } from '../shell/session';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen } from '../shell/ui';
import {
  ADD_MS, HELPER_PRICE, helperUsable, mixQueue, snapshotRound, startRound, stepRound, timeLeft,
  type HelperKind, type Round, type RoundEvent, type Style,
} from './core';
import { answerOf, idsOf, poolFor, questionById } from './data';
import { HeatBoard } from './HeatBoard';
import { useTickerClock } from '../engine/useTicker';

/** Solo bookmark: the round plus what the screen needs to resume (rules 7, 10). */
type SoloSave = { round: Round; style: Style; lengthSec: number; kept?: number };
/** Best scores per style and length, in one map so they can sync to the account ('streak:best'). */
const BEST_KEY = 'streak:best';
const oldBestKey = (style: Style, len: number) => `streak:best:${style}:${len}`;

/** Saves a new best and returns the old one. Bests saved before the shared map are folded in once. */
async function recordBest(style: Style, len: number, score: number) {
  const map = (await engine.kv.get<Record<string, number>>(BEST_KEY)) ?? {};
  const slot = `${style}:${len}`;
  const legacy = await engine.kv.get<number>(oldBestKey(style, len));
  if (legacy != null) await engine.kv.remove(oldBestKey(style, len));
  const old = Math.max(map[slot] ?? 0, legacy ?? 0);
  const isNew = score > old;
  if (isNew || legacy != null) await engine.kv.set(BEST_KEY, { ...map, [slot]: Math.max(old, score) });
  return { old, isNew };
}

const SECOND_PRICE = [5, 10, 20];

/** Solo (SM3, SM4, SM11, SM16): one timed round, helpers for tokens, EXP = 2 per right answer up to 60 (SM16), misses go to Learn. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const style = (play.settings.style as Style) ?? 'mixed';
  const lengthSec = Number(play.settings.length) || 60;
  const [round, setRound] = useState<Round | null>(null);
  const ref = useRef<Round | null>(null);
  const paying = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [best, setBest] = useState<{ old: number; isNew: boolean } | null>(null);
  // Second chances bought this run: the server prices each one by how many came before (5, 10, 20), so the count is
  // bookmarked with the run and corrected from what the server charged (GA2).
  const [kept, setKept] = useState(() => (play.resume as SoloSave | null)?.kept ?? 0);
  const keptRef = useRef(kept);
  const signedIn = useSession((x) => !!x.userId);

  // Start: resume the bookmark, or a fresh queue, unseen first (rule 15). Mixed is about half and half.
  useEffect(() => {
    let live = true;
    (async () => {
      let r = (play.resume as SoloSave | null)?.round ?? null;
      if (r && !r.queue.every((id) => questionById.has(id))) r = null; // a question left the bank since: start fresh
      if (!r) {
        const pick = (ids: string[]) => engine.picker.pick(play.game, ids, ids.length);
        const queue = style === 'mixed' ? mixQueue(await pick(idsOf('clinical')), await pick(idsOf('basic'))) : await pick(poolFor(style));
        r = startRound(queue, lengthSec, Date.now());
        engine.recorder.bookmark(play.id, { round: snapshotRound(r, Date.now()), style, lengthSec } satisfies SoloSave, 0);
      }
      if (live) {
        ref.current = r;
        setRound(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [play, style, lengthSec]);

  const dispatch = useCallback(
    (e: RoundEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepRound(prev, e, answerOf);
      if (next === prev) return;
      ref.current = next;
      setRound(next);
      engine.recorder.bookmark(play.id, { round: snapshotRound(next, Date.now()), style, lengthSec, kept: keptRef.current } satisfies SoloSave, next.score);
      // Each answered or skipped question is one item. Wrong answers go to Learn (SM1); skips are not misses.
      for (const a of next.answers.slice(prev.answers.length)) {
        const q = questionById.get(a.qId)!;
        engine.picker.markSeen(play.game, a.qId);
        recordItem(play, {
          seat: 0,
          itemId: a.qId,
          answerKey: q.dossier,
          outcome: a.outcome,
          answersGiven: a.outcome === 'wrong' && a.picked != null ? [q.choices[a.picked]] : [],
          timeMs: a.timeMs,
          hintsUsed: 0,
          revealsUsed: 0,
          points: a.points,
          feedsLearn: a.outcome === 'wrong',
          gameData: { style, field: q.field, kind: q.kind, streak: a.streak },
        });
      }
      if (next.phase === 'over' && prev.phase !== 'over') {
        recordBest(style, lengthSec, next.score).then(setBest);
      }
    },
    [play, style, lengthSec],
  );

  // The clock: ticks while a question runs or a result shows.
  // Only the clock text and the fuse follow every tick; the board itself shows no time.
  const [, ticks] = useTickerClock(round?.phase === 'playing' || round?.phase === 'feedback', 150, (n) => dispatch({ type: 'TICK', now: n }), { shown: () => 0 });

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(id);
  }, [notice]);

  /** SM4, SM11: pay first, then apply; refund when the moment passed while paying (rule 18). */
  const helper = useCallback(
    async (kind: HelperKind) => {
      const r = ref.current;
      if (!r || paying.current || !helperUsable(r, kind)) return;
      paying.current = true;
      const price = HELPER_PRICE[kind];
      const at = r.index;
      const receipt = await engine.wallet.spend(price, `streak_${kind}`, play.id);
      paying.current = false;
      if (!receipt) return setNotice(`You need ${price} token${price > 1 ? 's' : ''}. Each level up gives 1 token.`);
      const cur = ref.current;
      if (!cur || cur.index !== at || !helperUsable(cur, kind)) {
        await engine.wallet.refund(receipt);
        return setNotice('Helper refunded.');
      }
      dispatch({ type: 'HELPER', kind, now: Date.now() });
    },
    [dispatch, play.id],
  );

  /** Second chance (Yazan 2026-10-13): a broken streak of 3 or more comes back for 5, then 10, then 20 tokens, up to 3 times a run. */
  const keep = useCallback(async () => {
    if (paying.current || kept >= 3) return;
    paying.current = true;
    const res = await spendTokens('second', play.id);
    paying.current = false;
    if (!res.ok) {
      if (res.why === 'max') {
        keptRef.current = 3;
        setKept(3);
      }
      return setNotice(whySay(res));
    }
    const used = res.cost != null && SECOND_PRICE.includes(res.cost) ? SECOND_PRICE.indexOf(res.cost) + 1 : kept + 1;
    keptRef.current = used;
    setKept(used);
    dispatch({ type: 'KEEP' });
  }, [dispatch, kept, play.id]);

  if (!round) return <GameScreen scroll={false}>{null}</GameScreen>;
  const q = questionById.get(round.queue[Math.min(round.index, round.queue.length - 1)])!;
  const paused = round.phase === 'paused';
  const over = round.phase === 'over';

  return (
    <HeatBoard
      q={q}
      round={round}
      ticks={ticks}
      leftAt={(n) => timeLeft(round, n)}
      totalMs={round.lengthMs + round.helpers.time * ADD_MS}
      onAnswer={(choice) => !paying.current && dispatch({ type: 'ANSWER', choice, now: Date.now() })}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      helpers={{ onHelper: helper, usable: (k) => helperUsable(round, k) }}
      hidden={paused}
      notice={notice}
      offer={signedIn && !over && !paused && kept < 3 && (round.lost ?? 0) >= 3 ? { label: `Keep your streak of ${round.lost} · ${SECOND_PRICE[kept]} tokens`, onPress: () => void keep() } : null}
      dock={over ? <OverCard round={round} best={best} onNext={() => onFinish(round.score)} /> : undefined}>
      <PauseMenu open={paused} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </HeatBoard>
  );
}

/** Time up: score, best streak, high score for this style and length, then results. */
export function OverCard({ round, best, title, onNext, next = 'See results' }: { round: Round; best?: { old: number; isNew: boolean } | null; title?: string; onNext: () => void; next?: string }) {
  const t = useTheme();
  const right = round.answers.filter((a) => a.outcome === 'right').length;
  return (
    <View style={s.card}>
      <Text style={[s.k, { color: t.dim }]}>{round.endReason === 'questions' ? 'NO QUESTIONS LEFT' : "TIME'S UP"}</Text>
      <Text style={[s.line, { color: t.white }]}>{title ?? `${round.score} points`}</Text>
      <Text style={[s.sub, { color: t.mute }]}>
        {`Best streak ${round.maxStreak} · ${right} right of ${round.answers.filter((a) => a.outcome !== 'skipped').length}`}
        {best ? (best.isNew ? ' · New high score' : ` · High score ${best.old}`) : ''}
      </Text>
      <Btn label={next} onPress={onNext} style={{ alignSelf: 'stretch', marginTop: u(6) }} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { alignItems: 'center', gap: u(3), paddingTop: u(2) },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4) },
  line: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26), textAlign: 'center' },
  sub: { fontFamily: F.body, fontSize: u(10.5), textAlign: 'center' },
});
