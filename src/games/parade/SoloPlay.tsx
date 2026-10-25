import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { useTickerClock } from '../engine/useTicker';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Btn } from '../shell/ui';
import { answerText, HELPER_PRICE, helperUsable, mixQueue, snapshotRound, startRound, stepRound, timeLeft, type HelperKind, type Round, type RoundEvent, type Style } from './core';
import { bank, idsOf, poolFor, questionById } from './data';
import { ParadeBoard } from './ParadeBoard';

type SoloSave = { round: Round; style: Style; count: number };

/** Solo (QP1-QP6): 5, 10 or 15 questions, each on its own clock; helpers for tokens; misses go to Today's review (QP5). */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const style = (play.settings.style as Style) ?? 'mixed';
  const count = Number(play.settings.questions) || 10;
  const [round, setRound] = useState<Round | null>(null);
  const ref = useRef<Round | null>(null);
  const paying = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Start: resume the bookmark, or a fresh queue, unseen first. Mixed is about half and half.
  useEffect(() => {
    let live = true;
    (async () => {
      let r = (play.resume as SoloSave | null)?.round ?? null;
      if (r && !r.queue.every((id) => questionById.has(id))) r = null;
      if (!r) {
        const pick = (ids: string[]) => engine.picker.pick(play.game, ids, ids.length);
        const queue = style === 'mixed' ? mixQueue(await pick(idsOf('clinical')), await pick(idsOf('basic')), count) : (await pick(poolFor(style))).slice(0, count);
        r = startRound(queue, Date.now(), bank);
        engine.recorder.bookmark(play.id, { round: snapshotRound(r, Date.now(), bank), style, count } satisfies SoloSave, 0);
      }
      if (live) {
        ref.current = r;
        setRound(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [play, style, count]);

  const dispatch = useCallback(
    (e: RoundEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepRound(prev, e, bank);
      if (next === prev) return;
      ref.current = next;
      setRound(next);
      engine.recorder.bookmark(play.id, { round: snapshotRound(next, Date.now(), bank), style, count } satisfies SoloSave, next.score);
      for (const a of next.answers.slice(prev.answers.length)) {
        const q = questionById.get(a.qId)!;
        engine.picker.markSeen(play.game, a.qId);
        recordItem(play, {
          seat: 0,
          itemId: a.qId,
          answerKey: null,
          outcome: a.outcome,
          answersGiven: [],
          timeMs: a.timeMs,
          hintsUsed: 0,
          revealsUsed: 0,
          points: a.points,
          // QP5: every missed question goes to Today's review (a part-right Match or Order is a miss too); skips are not misses.
          feedsLearn: a.outcome === 'wrong',
          gameData: { style, field: q.field, kind: q.kind, type: q.style },
        });
      }
    },
    [play, style, count],
  );

  const [, ticks] = useTickerClock(round?.phase === 'playing' || round?.phase === 'feedback', 150, (n) => dispatch({ type: 'TICK', now: n }), { shown: () => 0 });
  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(id);
  }, [notice]);

  /** Pay first, then apply; refund when the moment passed while paying (rule 18). */
  const helper = useCallback(
    async (kind: HelperKind) => {
      const r = ref.current;
      if (!r || paying.current || !helperUsable(r, kind, bank)) return;
      paying.current = true;
      const price = HELPER_PRICE[kind];
      const at = r.index;
      const receipt = await engine.wallet.spend(price, `parade_${kind}`, play.id);
      paying.current = false;
      if (!receipt) return setNotice(`You need ${price} token${price > 1 ? 's' : ''}.`);
      const cur = ref.current;
      if (!cur || cur.index !== at || !helperUsable(cur, kind, bank)) {
        await engine.wallet.refund(receipt);
        return setNotice('Helper refunded.');
      }
      dispatch({ type: 'HELPER', kind, now: Date.now() });
    },
    [dispatch, play.id],
  );

  if (!round) return null;
  const q = questionById.get(round.queue[Math.min(round.index, round.queue.length - 1)])!;
  const paused = round.phase === 'paused';
  const over = round.phase === 'over';

  return (
    <ParadeBoard
      q={q}
      round={round}
      ticks={ticks}
      leftAt={(n) => timeLeft(round, n)}
      onAnswer={(response) => !paying.current && dispatch({ type: 'ANSWER', response, now: Date.now() })}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      helpers={{ onHelper: helper, usable: (k) => helperUsable(round, k, bank) }}
      hidden={paused}
      notice={notice}
      dock={over ? <OverCard round={round} onNext={() => onFinish(round.score)} /> : undefined}>
      <PauseMenu open={paused} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </ParadeBoard>
  );
}

/** The parade is over: points and how many were fully right, then results. */
export function OverCard({ round, title, onNext, next = 'See results' }: { round: Round; title?: string; onNext: () => void; next?: string }) {
  const t = useTheme();
  const right = round.answers.filter((a) => a.outcome === 'right').length;
  return (
    <View style={s.card}>
      <Text style={[s.k, { color: t.dim }]}>PARADE OVER</Text>
      <Text style={[s.line, { color: t.white }]}>{title ?? `${round.score} points`}</Text>
      <Text style={[s.sub, { color: t.mute }]}>{`${right} fully right of ${round.queue.length}`}</Text>
      <Btn label={next} onPress={onNext} style={{ alignSelf: 'stretch', marginTop: u(6) }} />
    </View>
  );
}

/** One line per question on results and in Today's review. */
export const itemLine = (id: string) => {
  const q = questionById.get(id);
  return q ? answerText(q) : id;
};

const s = StyleSheet.create({
  card: { alignItems: 'center', gap: u(3), paddingTop: u(2) },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4) },
  line: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26), textAlign: 'center' },
  sub: { fontFamily: F.body, fontSize: u(10.5), textAlign: 'center' },
});
