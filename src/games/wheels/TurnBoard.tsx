// One player's turn (app look since 2026-11-02, beige answer boxes like Streak Master and Quiz Parade): the three slot reels, the Star window (WC5), then each question in its
// own style with the bulb timer, and the right/wrong moment. Used by Solo and Pass the phone.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { u } from '@/theme/scale';

import { STYLES, fieldName, timeLeft, type Answer, type Question, type Turn, type TurnEvent } from './core';
import { WheelSpin, STOP_MS } from './WheelSpin';
import { BOX, Brass, Btn, BODY_B, Bulbs, CB, CD, CM, Gem, Kicker, PauseBtn, QF, QF_B, T, VV } from './velvet';

export type Strip = { seat: number; name: string; color?: string; score: number; me?: boolean }[];

const TICK_MS = 100;
/** #56: the wheel's result holds HOLD_MS before the question. */
const HOLD_MS = 3000;
const LETTERS = 'ABCD';
const PAIR_INK = ['#1f9e86', '#7b4fd0', '#c48a12', '#d0455a', '#3c7be0', '#c06a2a'];
/** A paired Matching box: the pair's colour on the edge, with a soft glow in the same colour. */
const glow = (c: string) => ({ borderColor: c, shadowColor: c, shadowOpacity: 0.75, shadowRadius: u(7), shadowOffset: { width: 0, height: 0 } });
const qWord = (n: number) => `${n} Question${n > 1 ? 's' : ''}`;

/**
 * The wheel (#27, look A) and the banner. The three rings stop one after another, then the result holds for 3 s
 * (#56) before the turn goes on. Mounted again for each spin (`key`) and after a pause (the board is hidden), so the
 * spin starts from 0 as before. Only a turn's first question spins: the rest keep its count, style and field (#39b).
 */
function Reels({ turn, onGo }: { turn: Turn; onGo: () => void }) {
  const spinning = turn.phase === 'reveal';
  const [t, setT] = useState(0);
  const go = useEffectEvent(onGo);
  useEffect(() => {
    if (!spinning) return;
    const start = Date.now();
    const id = setInterval(() => {
      const e = Date.now() - start;
      setT(e);
      if (e >= STOP_MS.field + HOLD_MS) {
        clearInterval(id);
        go();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [spinning]);
  const done = (ring: keyof typeof STOP_MS) => !spinning || t >= STOP_MS[ring];
  const st = STYLES[turn.question.style];
  return (
    <>
      <WheelSpin turn={turn} settled={{ count: done('count'), style: done('style'), field: done('field') }} />
      <T f={CM} size={9.5} color={VV.soft} style={{ textAlign: 'center', letterSpacing: u(0.6) }} lines={1}>CENTRE COUNT · MIDDLE STYLE · OUTER FIELD</T>
      {done('field') ? <Banner parts={[turn.k ? `Question ${turn.k + 1} of ${turn.count}` : qWord(turn.count), st.name, fieldName(turn.combo.field)]} /> : <View style={{ height: u(66) }} />}
    </>
  );
}

function Banner({ parts }: { parts: string[] }) {
  return (
    <Brass r={14}>
      <LinearGradient colors={['#a48bff', '#6fd6ff']} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={{ paddingVertical: u(12), paddingHorizontal: u(14), alignItems: 'center', gap: u(4) }}>
        <T f={CM} size={10.5} color="#0b0b26" style={{ letterSpacing: u(2.4) }}>THE WHEELS HAVE SPOKEN</T>
        <T f={CD} size={15} color="#0b0b26" style={{ textAlign: 'center' }}>{parts.join('  ★  ')}</T>
      </LinearGradient>
    </Brass>
  );
}

/** The players' points during a question (WC6: a small strip). */
function ScoreStrip({ strip }: { strip: Strip }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: u(14), rowGap: u(4) }}>
      {strip.map((p) => (
        <View key={p.seat} style={{ flexDirection: 'row', alignItems: 'center', gap: u(6) }}>
          <Gem c={p.color} size={7} />
          <T f={BODY_B} size={12.5} color={p.me ? VV.ink : VV.dim}>{`${p.name} ${p.score}`}</T>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- answers, one per style

type Mark = 'right' | 'wrong' | 'none';
const markColor = (m: Mark) => (m === 'right' ? VV.right : m === 'wrong' ? VV.wrong : null);

function Option({ letter, text, mark = 'none', on, onPress, disabled, cross, fill }: { letter?: string; text: string; mark?: Mark; on?: boolean; onPress?: () => void; disabled?: boolean; cross?: boolean; fill?: boolean }) {
  const c = markColor(mark);
  return (
    // fill grows to the tallest box (flexGrow, not flex: 1, whose 0 basis collapsed Rule 2 Out boxes and hid their text, #63).
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={text} style={fill ? { flexGrow: 1 } : null}>
      <Brass r={12} style={[{ borderWidth: 0 }, fill ? { flexGrow: 1 } : null]} inner={[{ backgroundColor: on ? BOX.paper : BOX.bg, borderWidth: c || on ? 2 : 1, borderColor: c ?? (on ? VV.brass : BOX.line) }, fill ? { flexGrow: 1, justifyContent: 'center' } : null]}>
        {cross ? <T f={CB} size={11} color={BOX.ink} style={s.cross}>✕</T> : null}
        <View style={s.opt}>
          {letter ? (
            <View style={[s.letter, c ? { backgroundColor: c } : null]}>
              <T f={CB} size={13} color="#ffffff">{mark === 'right' ? '✓' : mark === 'wrong' ? '✕' : letter}</T>
            </View>
          ) : null}
          <T f={on ? QF_B : QF} size={15.5} color={BOX.ink} style={{ flex: 1 }}>{text}</T>
        </View>
      </Brass>
    </Pressable>
  );
}

/** Every box in a grid takes the tallest box's height (E), so sizes never shift before or after a pick. */
function useTallest() {
  const [h, setH] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const v = e.nativeEvent.layout.height;
    if (v > h + 0.5) setH(v);
  };
  return { minHeight: h || undefined, onLayout };
}

/** A tiny stable shuffle so the matching column is mixed the same way every render. */
function mixed(n: number, seed: string): number[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Answers({ q, given, onAnswer }: { q: Question; given: Answer | undefined; onAnswer: (a: Answer) => void }) {
  const done = given !== undefined;
  const [picks, setPicks] = useState<number[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [pairs, setPairs] = useState<(number | null)[]>(() => (q.style === 'match' ? q.pairs.map(() => null) : []));
  const order = useMemo(() => (q.style === 'match' ? mixed(q.pairs.length, q.id) : []), [q]);
  const tall = useTallest();

  switch (q.style) {
    case 'mcq':
    case 'riddle':
    case 'reverse':
      return (
        <View style={{ gap: u(6) }}>
          {q.choices.map((c, i) => (
            <Option key={i} letter={LETTERS[i]} text={c} disabled={done} onPress={() => onAnswer(i)} mark={done ? (i === q.answer ? 'right' : i === given ? 'wrong' : 'none') : 'none'} />
          ))}
        </View>
      );
    case 'lie':
      return (
        <View style={{ gap: u(6) }}>
          {q.statements.map((c, i) => (
            <Option key={i} letter={LETTERS[i]} text={c} disabled={done} onPress={() => onAnswer(i)} mark={done ? (i === q.lie ? 'right' : i === given ? 'wrong' : 'none') : 'none'} />
          ))}
        </View>
      );
    case 'tf':
      return (
        <View style={{ flexDirection: 'row', gap: u(10) }}>
          {[true, false].map((v) => (
            <View key={String(v)} style={{ flex: 1 }}>
              <Option text={v ? 'True' : 'False'} disabled={done} onPress={() => onAnswer(v)} mark={done ? (v === q.answer ? 'right' : v === given ? 'wrong' : 'none') : 'none'} />
            </View>
          ))}
        </View>
      );
    case 'r2o': {
      const chosen = done ? ((given as number[] | null) ?? []) : picks;
      return (
        <View style={{ gap: u(8) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: u(6) }}>
            {q.items.map((c, i) => {
              const on = chosen.includes(i);
              const mark: Mark = done ? (q.out.includes(i as 0) ? 'right' : on ? 'wrong' : 'none') : 'none';
              return (
                <View key={i} onLayout={tall.onLayout} style={{ width: '48%', flexGrow: 1, minHeight: tall.minHeight }}>
                  <Option fill cross={on && !done} text={c} on={on && !done} mark={mark} disabled={done} onPress={() => setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < 2 ? [...p, i] : p))} />
                </View>
              );
            })}
          </View>
          {done ? null : <Btn label={picks.length === 2 ? 'Rule these 2 out' : `Pick ${2 - picks.length} more`} disabled={picks.length !== 2} onPress={() => onAnswer(picks)} />}
        </View>
      );
    }
    case 'match': {
      const got = done ? ((given as number[] | null) ?? q.pairs.map(() => -1)) : pairs;
      const allSet = pairs.every((x) => x != null);
      const ink = (li: number) => PAIR_INK[li % PAIR_INK.length];
      // Long pairs shrink the text and give the answers more width, so six long rows still fit the stage.
      const chars = q.pairs.reduce((n, [a, b]) => n + a.length + b.length, 0);
      const fs = chars > 420 ? 9.5 : chars > 300 ? 10.5 : 11.5;
      const cell = chars > 300 ? s.cellTight : null;
      return (
        <View style={{ gap: u(8) }}>
          {/* D: one row per left item, so each A box and the B box beside it share a height. */}
          <View style={{ gap: u(cell ? 4 : 5) }}>
            {q.pairs.map(([l], i) => {
              const set = got[i] != null && got[i] !== -1;
              const mark: Mark = done ? (got[i] === i ? 'right' : 'wrong') : 'none';
              // Once answered, each row shows its true partner; the left box says if the pick was right.
              const ri = done ? i : order[i];
              const owner = done ? -1 : got.findIndex((x) => x === ri);
              return (
                <View key={i} style={{ flexDirection: 'row', gap: u(8) }}>
                  <Pressable disabled={done} onPress={() => setLeft(left === i ? null : i)} accessibilityRole="button" accessibilityState={{ selected: left === i }} accessibilityLabel={l} style={[s.cell, cell, { flex: chars > 300 ? 0.8 : 1 }, set ? glow(ink(i)) : null, left === i ? { borderColor: VV.brass, borderWidth: 2.5, backgroundColor: BOX.paper } : null, markColor(mark) ? { borderColor: markColor(mark)! } : null]}>
                    {set ? <Gem c={ink(i)} size={7} /> : null}
                    <T f={QF_B} size={fs} color={BOX.ink} style={{ flex: 1 }}>{l}</T>
                  </Pressable>
                  <Pressable
                    disabled={done || left == null}
                    onPress={() => {
                      if (left == null) return;
                      setPairs((p) => p.map((x, j) => (j === left ? ri : x === ri ? null : x)));
                      setLeft(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={q.pairs[ri][1]}
                    style={[s.cell, cell, { flex: chars > 300 ? 1.2 : 1 }, owner >= 0 ? glow(ink(owner)) : null]}>
                    {owner >= 0 ? <Gem c={ink(owner)} size={7} /> : null}
                    <T f={QF} size={fs} color={BOX.ink} style={{ flex: 1 }}>{q.pairs[ri][1]}</T>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {done ? null : (
            <>
              <T size={11} color={VV.dim} style={{ textAlign: 'center' }}>Tap a name on the left, then its match on the right.</T>
              <Btn label={allSet ? 'Lock in the pairs' : `${pairs.filter((x) => x == null).length} left to pair`} disabled={!allSet} onPress={() => onAnswer(pairs as number[])} />
            </>
          )}
        </View>
      );
    }
  }
}

const promptLead: Partial<Record<Question['style'], string>> = { reverse: 'Here is the answer. Pick its question.', tf: 'True or false?' };

// ---------------------------------------------------------------- the board

export function TurnBoard({ turn, now, kicker, title, strip, footer, onEvent, onPause, hidden, watch }: {
  turn: Turn;
  now: number;
  kicker: string;
  title: string;
  strip?: Strip;
  footer?: ReactNode;
  onEvent: (e: TurnEvent) => void;
  onPause: () => void;
  hidden?: boolean;
  /** Online: someone else's turn, shown live but nothing can be tapped. */
  watch?: boolean;
}) {
  const q = turn.question;
  const st = STYLES[q.style];
  const asking = turn.phase === 'question' || turn.phase === 'feedback';
  const result = turn.phase === 'feedback' ? turn.results[turn.k] : undefined;

  if (hidden) return null;

  if (!asking) {
    return (
      <View style={{ flex: 1, gap: u(11) }}>
        <View style={s.top}>
          <View style={{ gap: u(2), flex: 1 }}>
            <Kicker>{kicker}</Kicker>
            <T f={CD} size={24} color={VV.ink}>{title}</T>
          </View>
          <PauseBtn onPress={onPause} />
        </View>
        {/* #81: the reels sit in the middle of the screen. */}
        <View style={{ flex: 1, justifyContent: 'center', gap: u(11) }}>
        <Reels key={`${turn.k}:${q.id}`} turn={turn} onGo={() => !watch && onEvent({ type: 'GO', now: Date.now() })} />
        </View>
      </View>
    );
  }

  const left = turn.phase === 'question' ? timeLeft(turn, now) : 0;
  return (
    <View style={{ flex: 1, gap: u(8) }}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Bulbs frac={turn.phase === 'question' ? left / (st.seconds * 1000) : 0} />
        </View>
        <PauseBtn onPress={onPause} />
      </View>
      <View style={s.spread}>
        <T f={CM} size={12} color={VV.brass} style={{ letterSpacing: u(1) }}>{`QUESTION ${turn.k + 1} OF ${turn.count}`}</T>
        <T f={CM} size={12} color={VV.soft}>{`${st.name} · ${st.points} pt${st.points > 1 ? 's' : ''}`}</T>
      </View>
      {strip ? <ScoreStrip strip={strip} /> : null}
      {/* #52 (2026-10-31): online, the answers belong to the player whose turn it is; the others see whose turn and watch. */}
      {watch ? (
        <View style={[s.whose, { borderColor: VV.brass }]}>
          <T f={CD} size={16} color={VV.ink} lines={1} style={{ textAlign: 'center' }}>{title}</T>
          <T f={CM} size={11} color={VV.soft} lines={1}>Watch their answer</T>
        </View>
      ) : null}
      {/* #63: a long Matching (or any long question) scrolls instead of running off small screens. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: u(8), paddingBottom: u(4) }} showsVerticalScrollIndicator={false}>
      <Brass r={14} inner={{ backgroundColor: VV.panel, paddingHorizontal: u(13), paddingVertical: u(10), gap: u(4) }}>
        <View style={s.spread}>
          <T f={CM} size={11} color={VV.right} style={{ letterSpacing: u(1.4) }}>{fieldName(q.field).toUpperCase()}</T>
          {promptLead[q.style] ? <T f={CM} size={10.5} color={VV.dim}>{promptLead[q.style]}</T> : null}
        </View>
        <T f={QF_B} size={q.prompt.length > 110 ? 16 : 17} color={VV.ink} style={{ lineHeight: u(21.5) }}>{q.prompt}</T>
      </Brass>
      <View pointerEvents={watch ? 'none' : 'auto'} style={watch && !result ? { opacity: 0.55 } : null}>
        <Answers key={`${turn.k}:${q.id}`} q={q} given={result ? result.answer : undefined} onAnswer={(a) => onEvent({ type: 'ANSWER', answer: a, now: Date.now() })} />
      </View>
      {result ? (
        <View style={{ alignItems: 'center', gap: u(2) }}>
          <T f={CD} size={20} color={result.right ? VV.right : VV.wrong}>{result.right ? `Bravo! +${result.points}` : result.answer == null ? 'Time is up' : 'Not this time'}</T>
        </View>
      ) : null}
      </ScrollView>
      {footer}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  // #19 (2026-11-02): name on top, the small line under it, so a long name never pushes it out of the box.
  whose: { alignItems: 'center', gap: u(1), borderWidth: 1, borderRadius: u(14), paddingVertical: u(6), paddingHorizontal: u(12), backgroundColor: VV.panel },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', columnGap: u(10) },
  opt: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(6.5), paddingHorizontal: u(12) },
  cross: { position: 'absolute', top: u(3), right: u(7), zIndex: 1 },
  letter: { width: u(24), height: u(24), borderRadius: u(12), backgroundColor: '#24346c', alignItems: 'center', justifyContent: 'center' },
  cellTight: { minHeight: u(28), paddingHorizontal: u(8), paddingVertical: u(3), gap: u(5) },
  cell: { flexDirection: 'row', alignItems: 'center', gap: u(7), minHeight: u(40), paddingHorizontal: u(10), paddingVertical: u(6), borderRadius: u(10), borderWidth: 1.5, borderColor: BOX.line, backgroundColor: BOX.bg },
});
