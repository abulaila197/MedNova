import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { tr } from '@/i18n';
import { useTheme } from '@/state/app';
import { BEIGE as B } from '@/theme/beige';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { clock } from '../engine/clock';
import { GameScreen, Kick } from '../shell/ui';
import { ORDER, speedOf, type QRun, type Question } from './core';

const BEIGE = B ?? { bg: '#efe4cb', line: '#cdb88c', ink: '#3b2f1c', paper: '#f1e6cc' };

const GREEN = '#34d399';
const CYAN = '#22d3ee';

/** Other players at the reveal: their result on this question. */
export type ResultRow = { id: string; name: string; color: string; run: QRun; points: number; ms: number };

/** "Solved on try 2 · 85 points" / "Missed" / "Time up". */
export function outcomeLine(run: QRun, points: number) {
  if (run.solved) return run.wrong === 0 ? tr('Right on try 1 · {n} pts', { n: points }) : tr('Right on try {t} · {n} pts', { t: run.wrong + 1, n: points });
  return run.timeUp ? tr('Time up · 0 pts') : tr('Missed · 0 pts');
}

/**
 * A closed question: how you did, the right order with one note a step (green when your slot had it right), the
 * decoys and why each one doesn't belong, other players' results, then the next step pinned at the bottom.
 */
export function OrderResult({ q, run, ms, title, rows, foot, learn = true, children }: { q: Question; run: QRun; ms: number; title: string; rows?: ResultRow[]; foot: ReactNode; learn?: boolean; children?: ReactNode }) {
  const t = useTheme();
  const points = run.solved ? ORDER.tryPoints[run.wrong] + speedOf(ms) : 0;
  const tone = run.solved ? GREEN : t.rose;
  const word = run.solved ? tr('Right order') : run.timeUp ? tr('Time up') : tr('Out of tries');
  const line = run.solved
    ? tr('{points} points: {base} for try {t} + {speed} speed, in {time}', { points, base: ORDER.tryPoints[run.wrong], t: run.wrong + 1, speed: speedOf(ms), time: clock(ms, { pad: true }) })
    : learn ? tr('No points this time. This question goes to Learn.') : tr('No points this time.');
  return (
    <GameScreen bottom={foot}>
      <Kick>{title}</Kick>
      <Animated.View entering={FadeInDown.duration(260)} style={[s.head, { backgroundColor: t.panel, borderColor: tone + '99' }]}>
        <Kick color={tone}>{word}</Kick>
        <Text style={[s.q, { color: t.white }]}>{q.q}</Text>
        <Text style={[s.line, { color: t.soft }]}>{line}</Text>
      </Animated.View>

      <Kick color={CYAN}>{tr('The right order')}</Kick>
      <View style={s.list}>
        {q.steps.map((st, i) => {
          const ok = run.slots[i] === i;
          return (
            <View key={i} style={[s.step, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
              <View style={[s.num, { borderColor: ok ? GREEN : t.rose }]}>
                <Text style={[s.numT, { color: ok ? GREEN : t.rose }]}>{i + 1}</Text>
              </View>
              <View style={s.stepBody}>
                <Text style={s.chip}>{st.t}</Text>
                <Text style={[s.note, { color: t.mute }]}>{st.n}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={[s.key, { color: t.dim }]}>{tr('Green: you had it in the right slot. Red: you did not.')}</Text>

      <Kick color={t.rose}>{tr('Did not belong')}</Kick>
      <View style={s.list}>
        {q.decoys.map((st, i) => (
          <View key={i} style={[s.step, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
            <Text style={[s.x, { color: t.rose }]}>✕</Text>
            <View style={s.stepBody}>
              <Text style={[s.chip, s.decoy]}>{st.t}</Text>
              <Text style={[s.note, { color: t.mute }]}>{st.n}</Text>
            </View>
          </View>
        ))}
      </View>

      {rows?.length ? (
        <>
          <Kick>{tr('Everyone')}</Kick>
          <View style={[s.rows, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
            {rows.map((r) => (
              <View key={r.id} style={s.row}>
                <View style={[s.face, { backgroundColor: r.color }]} />
                <Text style={[s.name, { color: t.fg }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={[s.res, { color: r.run.solved ? GREEN : t.mute }]} numberOfLines={1}>
                  {outcomeLine(r.run, r.points)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {children}
    </GameScreen>
  );
}

const s = StyleSheet.create({
  head: { borderWidth: 1, borderRadius: u(14), padding: u(13), gap: u(5) },
  q: { fontFamily: F.bodyBold, fontSize: u(14), lineHeight: u(19) },
  line: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16) },
  list: { gap: u(6) },
  step: { flexDirection: 'row', gap: u(9), alignItems: 'flex-start', borderWidth: 1, borderRadius: u(11), padding: u(9) },
  num: { width: u(22), height: u(22), borderRadius: u(11), borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: u(2) },
  numT: { fontFamily: F.bodyBold, fontSize: u(10) },
  x: { width: u(22), textAlign: 'center', fontFamily: F.bodyBold, fontSize: u(13), marginTop: u(3) },
  stepBody: { flex: 1, gap: u(4) },
  chip: { alignSelf: 'flex-start', fontFamily: F.bodyMedium, fontSize: u(11.5), lineHeight: u(15), color: BEIGE.ink, backgroundColor: BEIGE.bg, borderColor: BEIGE.line, borderWidth: 1, borderRadius: u(7), paddingVertical: u(4), paddingHorizontal: u(8), overflow: 'hidden' },
  decoy: { textDecorationLine: 'line-through', opacity: 0.85 },
  note: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  key: { fontFamily: F.body, fontSize: u(10), lineHeight: u(13) },
  rows: { borderWidth: 1, borderRadius: u(12), paddingVertical: u(6), paddingHorizontal: u(10), gap: u(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8), paddingVertical: u(5) },
  face: { width: u(10), height: u(10), borderRadius: u(5) },
  name: { flex: 1, fontFamily: F.bodySemi, fontSize: u(12) },
  res: { fontFamily: F.bodyMedium, fontSize: u(11) },
});
