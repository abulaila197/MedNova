// One player's turn on the Velvet stage: the three slot reels, the Star window (WC5), then each question in its
// own style with the bulb timer, and the right/wrong moment. Used by Solo and Pass the phone.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/AppText';

import { u } from '@/theme/scale';

import type { Card } from './cards';
import { FIELDS, STAR_WINDOW_MS, STYLE_KEYS, STYLES, fieldName, judge, timeLeft, type Answer, type Question, type Turn, type TurnEvent } from './core';
import { Brass, Btn, BODY, BODY_B, Bulbs, CardArt, CB, CD, CM, Gem, Kicker, PauseBtn, T, VV } from './velvet';

export type Strip = { seat: number; name: string; color?: string; score: number; me?: boolean }[];

const SPIN_MS = 70;
const STOP = { count: 700, style: 1100, field: 1500, go: 2300 };
const LETTERS = 'ABCD';
const PAIR_INK = ['#79c9b6', '#b98ad8', '#e8c46a', '#e0828f', '#8fb4e8', '#d9a07a'];
/** A paired Matching box: the pair's colour on the edge, with a soft glow in the same colour. */
const glow = (c: string) => ({ borderColor: c, shadowColor: c, shadowOpacity: 0.75, shadowRadius: u(7), shadowOffset: { width: 0, height: 0 } });
const qWord = (n: number) => `${n} Question${n > 1 ? 's' : ''}`;

/** Spins the reels that change for this question, stops them one by one, then tells the turn to go on. */
function useReels(turn: Turn, onGo: () => void, paused?: boolean) {
  const key = `${turn.k}:${turn.question.id}:${turn.star}`;
  const prev = useRef<{ k: number; style: string } | null>(null);
  // A Star re-spin keeps the count and style; a later question keeps the count.
  const spinCount = turn.k === 0 && !(turn.star === 'used' && prev.current?.k === 0);
  const spinStyle = !(turn.star === 'used' && turn.k === 0 && prev.current?.k === 0 && prev.current.style === turn.combo.style);
  const [t, setT] = useState(0);
  const go = useRef(onGo);
  go.current = onGo;
  useEffect(() => {
    if (turn.phase !== 'reveal' || paused) return;
    const start = Date.now();
    setT(0);
    const id = setInterval(() => {
      const e = Date.now() - start;
      setT(e);
      if (e >= STOP.go) {
        clearInterval(id);
        go.current();
      }
    }, SPIN_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, turn.phase, paused]);
  useEffect(() => {
    prev.current = { k: turn.k, style: turn.combo.style };
  }, [turn.k, turn.combo.style]);
  const spinning = turn.phase === 'reveal';
  const tick = Math.floor(t / SPIN_MS);
  return {
    count: spinning && spinCount && t < STOP.count ? String(1 + (tick % 3)) : String(turn.count),
    style: spinning && spinStyle && t < STOP.style ? STYLES[STYLE_KEYS[tick % STYLE_KEYS.length]].name : STYLES[turn.combo.style].name,
    field: spinning && t < STOP.field ? FIELDS[(tick * 3) % FIELDS.length].name : fieldName(turn.combo.field),
    settled: !spinning || t >= STOP.field,
  };
}

/** One slot reel: the landed value in crimson between two faded neighbours. */
function Reel({ label, value, spinning }: { label: string; value: string; spinning: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(10) }}>
      <T f={CM} size={11.5} color={VV.brass} style={{ width: u(52), letterSpacing: u(1) }}>{label}</T>
      <Brass style={{ flex: 1 }} r={10}>
        <LinearGradient colors={['#b9a57f', VV.paper, '#fff8e6', VV.paper, '#b9a57f']} locations={[0, 0.22, 0.5, 0.78, 1]} style={s.reel}>
          <T f={CB} size={value.length > 18 ? 12.5 : value.length > 12 ? 15 : 18} color={VV.redInk} style={{ textAlign: 'center', opacity: spinning ? 0.55 : 1 }} lines={1}>{value}</T>
          <Text style={[s.pip, { left: u(6) }]}>▶</Text>
          <Text style={[s.pip, { right: u(6) }]}>◀</Text>
        </LinearGradient>
      </Brass>
    </View>
  );
}

function Banner({ parts }: { parts: string[] }) {
  return (
    <Brass r={14}>
      <LinearGradient colors={['#8e1a2c', '#5c0c18']} style={{ paddingVertical: u(12), paddingHorizontal: u(14), alignItems: 'center', gap: u(4) }}>
        <T f={CM} size={10.5} color={VV.cream} style={{ letterSpacing: u(2.4) }}>THE WHEELS HAVE SPOKEN</T>
        <T f={CD} size={15} color={VV.gold} style={{ textAlign: 'center' }}>{parts.join('  ★  ')}</T>
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

function Tray({ cards }: { cards: Card[] }) {
  if (!cards.length) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: u(10) }}>
      <T f={CM} size={12} color={VV.soft} style={{ flex: 1, alignSelf: 'center' }}>Your cards</T>
      {cards.map((c) => <CardArt key={c} card={c} w={u(30)} />)}
    </View>
  );
}

// ---------------------------------------------------------------- answers, one per style

type Mark = 'right' | 'wrong' | 'none';
const markColor = (m: Mark) => (m === 'right' ? VV.right : m === 'wrong' ? VV.wrong : null);

function Option({ letter, text, mark = 'none', on, onPress, disabled, cross, fill }: { letter?: string; text: string; mark?: Mark; on?: boolean; onPress?: () => void; disabled?: boolean; cross?: boolean; fill?: boolean }) {
  const c = markColor(mark);
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={text} style={fill ? { flex: 1 } : null}>
      <Brass r={12} style={fill ? { flex: 1 } : null} inner={[{ backgroundColor: on ? '#5c0c18' : VV.panel, borderWidth: c ? 2 : 0, borderColor: c ?? 'transparent' }, fill ? { flex: 1, justifyContent: 'center' } : null]}>
        {cross ? <T f={CB} size={11} color={VV.ink} style={s.cross}>✕</T> : null}
        <View style={s.opt}>
          {letter ? (
            <View style={[s.letter, c ? { backgroundColor: c } : null]}>
              <T f={CB} size={13} color={c ? VV.paperInk : VV.redInk}>{mark === 'right' ? '✓' : mark === 'wrong' ? '✕' : letter}</T>
            </View>
          ) : null}
          <T f={BODY} size={14} color={VV.ink} style={{ flex: 1 }}>{text}</T>
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
      return (
        <View style={{ gap: u(8) }}>
          {/* D: one row per left item, so each A box and the B box beside it share a height. */}
          <View style={{ gap: u(5) }}>
            {q.pairs.map(([l], i) => {
              const set = got[i] != null && got[i] !== -1;
              const mark: Mark = done ? (got[i] === i ? 'right' : 'wrong') : 'none';
              const ri = order[i];
              const owner = got.findIndex((x) => x === ri);
              return (
                <View key={i} style={{ flexDirection: 'row', gap: u(8) }}>
                  <Pressable disabled={done} onPress={() => setLeft(left === i ? null : i)} accessibilityRole="button" accessibilityState={{ selected: left === i }} accessibilityLabel={l} style={[s.cell, { flex: 1 }, set ? glow(ink(i)) : null, left === i ? { borderColor: VV.gold, backgroundColor: '#5c0c18' } : null, markColor(mark) ? { borderColor: markColor(mark)! } : null]}>
                    {set ? <Gem c={ink(i)} size={7} /> : null}
                    <T f={BODY_B} size={10.5} color={VV.ink} style={{ flex: 1 }}>{l}</T>
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
                    style={[s.cell, { flex: 1 }, owner >= 0 ? glow(ink(owner)) : null]}>
                    {owner >= 0 ? <Gem c={ink(owner)} size={7} /> : null}
                    <T f={BODY} size={10.5} color={VV.ink} style={{ flex: 1 }}>{q.pairs[ri][1]}</T>
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

export function TurnBoard({ turn, now, kicker, title, strip, tray = [], footer, onEvent, onPause, hidden, watch }: {
  turn: Turn;
  now: number;
  kicker: string;
  title: string;
  strip?: Strip;
  tray?: Card[];
  footer?: ReactNode;
  onEvent: (e: TurnEvent) => void;
  onPause: () => void;
  hidden?: boolean;
  /** Online: someone else's turn, shown live but nothing can be tapped. */
  watch?: boolean;
}) {
  const reels = useReels(turn, () => !watch && onEvent({ type: 'GO', now: Date.now() }), hidden);
  const q = turn.question;
  const st = STYLES[q.style];
  const asking = turn.phase === 'question' || turn.phase === 'feedback';
  const result = turn.phase === 'feedback' ? turn.results[turn.k] : undefined;

  if (hidden) return null;

  if (!asking) {
    const starLeft = turn.phase === 'star' ? timeLeft(turn, now) : 0;
    return (
      <View style={{ flex: 1, gap: u(11) }}>
        <View style={s.top}>
          <View style={{ gap: u(2), flex: 1 }}>
            <Kicker>{kicker}</Kicker>
            <T f={CD} size={24} color={VV.ink}>{title}</T>
          </View>
          <PauseBtn onPress={onPause} />
        </View>
        <Reel label="COUNT" value={reels.count} spinning={turn.phase === 'reveal' && !reels.settled} />
        <Reel label="STYLE" value={reels.style} spinning={turn.phase === 'reveal' && !reels.settled} />
        <Reel label="FIELD" value={reels.field} spinning={turn.phase === 'reveal' && !reels.settled} />
        <View style={{ height: u(2) }} />
        {reels.settled ? <Banner parts={[turn.k ? `Question ${turn.k + 1} of ${turn.count}` : qWord(turn.count), st.name, fieldName(turn.combo.field)]} /> : null}
        {turn.phase === 'star' ? (
          <Brass r={14} inner={{ backgroundColor: VV.panel, padding: u(12), gap: u(9) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(12) }}>
              <CardArt card="star" w={u(34)} />
              <View style={{ flex: 1, gap: u(2) }}>
                <T f={CB} size={13} color={VV.gold}>The Star</T>
                <T size={12} color={VV.soft}>Re-spin the field wheel? The card is spent either way.</T>
              </View>
            </View>
            <Bulbs frac={starLeft / STAR_WINDOW_MS} />
            {watch ? (
              <T size={12} color={VV.dim} style={{ textAlign: 'center' }}>Deciding…</T>
            ) : (
              <View style={{ flexDirection: 'row', gap: u(10) }}>
                <Btn label="Keep it" ghost onPress={() => onEvent({ type: 'KEEP', now: Date.now() })} style={{ flex: 1 }} />
                <Btn label="Re-spin" onPress={() => onEvent({ type: 'STAR', now: Date.now() })} style={{ flex: 1 }} />
              </View>
            )}
          </Brass>
        ) : null}
        <View style={{ flex: 1 }} />
        {turn.sun ? <T f={CM} size={11.5} color={VV.gold} style={{ textAlign: 'center' }}>The Sun doubles this turn’s points.</T> : null}
        <Tray cards={tray} />
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
        <T f={CM} size={12} color={VV.soft}>{`${st.name} · ${st.points} pt${st.points > 1 ? 's' : ''}${turn.sun ? ' ×2' : ''}`}</T>
      </View>
      {strip ? <ScoreStrip strip={strip} /> : null}
      <Brass r={14} inner={{ backgroundColor: VV.panel, paddingHorizontal: u(13), paddingVertical: u(10), gap: u(4) }}>
        <View style={s.spread}>
          <T f={CM} size={11} color={VV.right} style={{ letterSpacing: u(1.4) }}>{fieldName(q.field).toUpperCase()}</T>
          {promptLead[q.style] ? <T f={CM} size={10.5} color={VV.dim}>{promptLead[q.style]}</T> : null}
        </View>
        <T f={BODY_B} size={q.prompt.length > 110 ? 14.5 : 15.5} color={VV.ink} style={{ lineHeight: u(20.5) }}>{q.prompt}</T>
      </Brass>
      <View pointerEvents={watch ? 'none' : 'auto'}>
        <Answers key={`${turn.k}:${q.id}`} q={q} given={result ? result.answer : undefined} onAnswer={(a) => onEvent({ type: 'ANSWER', answer: a, now: Date.now() })} />
      </View>
      {result ? (
        <View style={{ alignItems: 'center', gap: u(2) }}>
          <T f={CD} size={20} color={result.right ? VV.right : VV.wrong}>{result.right ? `Bravo! +${result.points * (turn.sun ? 2 : 1)}` : result.answer == null ? 'Time is up' : 'Not this time'}</T>
          {!result.right && q.style === 'match' ? <T size={11.5} color={VV.soft} style={{ textAlign: 'center' }}>{q.pairs.map(([a, b]) => `${a}: ${b}`).join(' · ')}</T> : null}
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {footer}
      <Tray cards={tray} />
    </View>
  );
}

/** For tests and recaps: was a stored answer right? */
export const isRight = (q: Question, a: Answer) => judge(q, a);

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', columnGap: u(10) },
  reel: { height: u(54), paddingHorizontal: u(24), alignItems: 'center', justifyContent: 'center' },
  pip: { position: 'absolute', top: '50%', marginTop: -u(9), fontSize: u(13), color: VV.redInk },
  opt: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(6.5), paddingHorizontal: u(12) },
  cross: { position: 'absolute', top: u(3), right: u(7), zIndex: 1 },
  letter: { width: u(24), height: u(24), borderRadius: u(12), backgroundColor: VV.cream, alignItems: 'center', justifyContent: 'center' },
  cell: { flexDirection: 'row', alignItems: 'center', gap: u(7), minHeight: u(40), paddingHorizontal: u(10), paddingVertical: u(6), borderRadius: u(10), borderWidth: 1.5, borderColor: 'rgba(216,178,106,0.45)', backgroundColor: VV.panel },
});
