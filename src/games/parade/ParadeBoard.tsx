import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { MAX_FONT_SCALE, Text, TextInput } from '@/components/AppText';
import { clock } from '@/games/engine/clock';
import { useClock, type Clock } from '@/games/engine/useTicker';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { Face } from '../shell/Face';
import { Btn, GameScreen, RoundBtn } from '../shell/ui';
import { answerText, HELPER_PRICE, TYPE_NAME, type HelperKind, type Question, type Response, type Round } from './core';

// The Quiz Parade board (QP8): the app look, like The Streak Master, dark only. A question counter, the type and
// field, the question's own clock and fuse, then the answer area for its type. Long answer areas scroll, and the
// Submit button stays in view under them.

export const PC = { good: '#3fc58a', bad: '#ff5c6c', hot: '#a48bff', pair: ['#6fd6ff', '#f0b54a', '#a48bff', '#ff7aa8', '#3fc58a', '#ff9a5a'] };

export type BoardProps = {
  q: Question;
  round: Round;
  ticks: Clock;
  leftAt: (now: number) => number;
  /** A line above the question, e.g. the player's name in Pass the phone. */
  who?: { name: string; color?: string };
  onAnswer: (r: Response) => void;
  onPause: () => void;
  helpers?: { onHelper: (kind: HelperKind) => void; usable: (kind: HelperKind) => boolean };
  hidden?: boolean;
  notice?: string | null;
  dock?: ReactNode;
  /** Online: your answer is in; waiting for the others (no right or wrong yet). */
  locked?: boolean;
  /** Online, once the question ends: who picked each choice (character slugs by choice index). */
  faces?: Record<number, string[]>;
  /** Shown instead of the points line once the question ends (e.g. "Nearest: Omar, 206"). */
  verdict?: string | null;
  children?: ReactNode;
};

export function ParadeBoard(p: BoardProps) {
  const t = useTheme();
  const fb = p.round.feedback;
  const showing = p.round.phase === 'feedback' || (p.round.phase === 'paused' && p.round.before === 'feedback');
  const over = p.round.phase === 'over';
  const mine = showing ? p.round.answers[p.round.answers.length - 1] : null;
  const live = p.round.phase === 'playing' && !p.locked;

  return (
    <GameScreen scroll={false}>
      <View style={s.main}>
        {p.who ? <Text style={[s.who, { color: p.who.color ?? t.accent }]} numberOfLines={1}>{p.who.name}</Text> : null}
        <View style={s.top}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.count, { color: t.white }]}>
              {`${Math.min(p.round.index + 1, p.round.queue.length)}`}
              <Text style={{ color: t.dim }}>{` / ${p.round.queue.length}`}</Text>
              <Text style={{ color: t.dim }}>{`   ${p.round.score} ${p.round.score === 1 ? 'pt' : 'pts'}`}</Text>
            </Text>
            <Text style={[s.type, { color: t.accent }]} numberOfLines={1}>{p.hidden ? '' : `${TYPE_NAME[p.q.style].toUpperCase()} · ${p.q.field.toUpperCase()}`}</Text>
          </View>
          <View style={s.right}>
            <ClockText ticks={p.ticks} leftAt={p.leftAt} over={over || showing} white={t.white} />
            <RoundBtn label="Pause" glyph="❚❚" onPress={p.onPause} />
          </View>
        </View>
        <LiveFuse ticks={p.ticks} leftAt={p.leftAt} totalMs={p.round.limitMs} cool={t.accent} track={t.line} />

        {p.hidden ? (
          <View style={[s.hide, { borderColor: t.panelLine, backgroundColor: t.panel }]}>
            <Text style={[s.hideT, { color: t.mute }]}>Paused. The clock is stopped.</Text>
          </View>
        ) : p.dock ? null : (
          <Animated.View key={`${p.q.id}:${p.round.index}`} entering={FadeIn.duration(180)} style={{ flex: 1, minHeight: 0 }}>
            <Answer
              q={p.q}
              layout={p.round.layout}
              removed={p.round.removed}
              live={live}
              locked={!!p.locked}
              shown={showing ? mine?.response ?? null : undefined}
              faces={p.faces}
              onAnswer={p.onAnswer}
              held={!!mine?.held}
              after={
                showing && fb ? (
                  <Animated.View entering={FadeIn.delay(250)} style={s.after}>
                    <Text style={[s.pts, { color: mine?.held ? t.accent : fb.right ? PC.good : fb.points ? t.accent : PC.bad }]}>
                      {p.verdict ?? (mine?.held ? 'Locked in. The nearest guess wins at the end.' : mine?.outcome === 'skipped' ? 'Skipped' : fb.right ? `Right · +${fb.points}` : fb.points ? `Part right · +${fb.points}` : mine?.response ? 'Wrong' : "Time's up")}
                    </Text>
                    {!fb.right && !mine?.held && p.q.explain ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[s.expl, { color: t.mute }]}>{p.q.explain}</Text> : null}
                  </Animated.View>
                ) : null
              }
            />
          </Animated.View>
        )}

        {p.notice ? <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} entering={FadeIn} style={[s.notice, { color: t.soft }]}>{p.notice}</Animated.Text> : null}
        {p.dock ? (
          <>
            <View style={{ flex: 1 }} />
            <Animated.View entering={FadeInDown.duration(260)}>{p.dock}</Animated.View>
            <View style={{ flex: 1.15 }} />
          </>
        ) : p.helpers ? (
          <Helpers {...p.helpers} disabled={p.round.phase !== 'playing'} />
        ) : null}
      </View>
      {p.children}
    </GameScreen>
  );
}

type AnswerProps = {
  q: Question;
  layout: number[];
  removed: number[];
  live: boolean;
  locked: boolean;
  /** Once the question ends: the answer given (null = none); undefined while it runs. */
  shown: Response | null | undefined;
  faces?: Record<number, string[]>;
  onAnswer: (r: Response) => void;
  /** The result line, shown under the answer area once the question ends. */
  after?: ReactNode;
  /** Pass the phone: a Closest number guess waits for the others, so the answer stays hidden (QP6). */
  held?: boolean;
};

/** The answer area for one question type. */
function Answer(p: AnswerProps) {
  const t = useTheme();
  const done = p.shown !== undefined;
  const head = <Text style={[s.q, { color: t.fg }]}>{p.q.style === 'reverse' ? `${p.q.prompt}\n` : p.q.prompt}</Text>;
  switch (p.q.style) {
    case 'mcq':
    case 'reverse': {
      const q = p.q;
      const picked = p.shown && (p.shown.style === 'mcq' || p.shown.style === 'reverse') ? p.shown.pick : null;
      return (
        <Scroll after={p.after} head={q.style === 'reverse' ? <><Text style={[s.rk, { color: t.dim }]}>WHICH QUESTION IS THIS THE ANSWER TO?</Text><Text style={[s.big, { color: t.white }]}>{q.prompt}</Text></> : head}>
          {p.layout.map((ci) => (
            <Tile
              key={ci}
              label={q.choices[ci]}
              state={done ? (ci === q.answer ? 'good' : ci === picked ? 'bad' : 'idle') : 'idle'}
              gone={p.removed.includes(ci)}
              live={p.live && !p.removed.includes(ci)}
              faces={p.faces?.[ci]}
              onPress={() => p.onAnswer({ style: q.style, pick: ci })}
            />
          ))}
          {p.locked ? <Waiting /> : null}
        </Scroll>
      );
    }
    case 'tf': {
      const q = p.q;
      const picked = p.shown && p.shown.style === 'tf' ? p.shown.value : null;
      return (
        <Scroll after={p.after} head={head}>
          <View style={s.tfRow}>
            {[true, false].map((v) => (
              <View key={String(v)} style={{ flex: 1 }}>
                <Tile tall label={v ? 'True' : 'False'} state={done ? (v === q.answer ? 'good' : v === picked ? 'bad' : 'idle') : 'idle'} live={p.live} faces={p.faces?.[v ? 1 : 0]} onPress={() => p.onAnswer({ style: 'tf', value: v })} />
              </View>
            ))}
          </View>
          {p.locked ? <Waiting /> : null}
        </Scroll>
      );
    }
    case 'r2o':
      return <RuleOut {...p} q={p.q} head={head} />;
    case 'match':
      return <Match {...p} q={p.q} head={head} />;
    case 'order':
      return <Order {...p} q={p.q} head={head} />;
    case 'closest':
      return <Closest {...p} q={p.q} head={head} />;
  }
}

/** The question and its answer area scroll together; the Submit button (when there is one) stays in view. */
function Scroll({ head, children, foot, after }: { head: ReactNode; children: ReactNode; foot?: ReactNode; after?: ReactNode }) {
  return (
    <View style={{ flex: 1, minHeight: 0, gap: u(8) }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: u(7), paddingBottom: u(6) }} showsVerticalScrollIndicator={false}>
        {head}
        {children}
        {after}
      </ScrollView>
      {foot}
    </View>
  );
}

function Waiting() {
  const t = useTheme();
  return <Text style={[s.wait, { color: t.mute }]}>Locked in. Waiting for the others…</Text>;
}

type Q<S> = Extract<Question, { style: S }>;

function RuleOut(p: AnswerProps & { q: Q<'r2o'>; head: ReactNode }) {
  const [sel, setSel] = useState<number[]>([]);
  const done = p.shown !== undefined;
  const given = p.shown && p.shown.style === 'r2o' ? p.shown.picks : sel;
  const toggle = (i: number) => setSel((x) => (x.includes(i) ? x.filter((v) => v !== i) : x.length >= 2 ? [x[1], i] : [...x, i]));
  return (
    <Scroll
      after={p.after}
      head={p.head}
      foot={done || p.locked ? (p.locked ? <Waiting /> : null) : <Btn label={sel.length === 2 ? 'Rule these out' : `Pick ${2 - sel.length} more`} disabled={!p.live || sel.length !== 2} onPress={() => p.onAnswer({ style: 'r2o', picks: sel })} />}>
      {p.layout.map((i) => {
        const out = p.q.out.includes(i);
        const mine = given.includes(i);
        return (
          <Tile key={i} label={p.q.items[i]} mark={mine ? '✕' : undefined} struck={mine} state={done ? (out ? 'good' : mine ? 'bad' : 'idle') : mine ? 'picked' : 'idle'} live={p.live} onPress={() => toggle(i)} />
        );
      })}
    </Scroll>
  );
}

/** Match: tap a left item, then its partner on the right. Joined pairs share a colour; tap a joined item to undo. */
function Match(p: AnswerProps & { q: Q<'match'>; head: ReactNode }) {
  const t = useTheme();
  const n = p.q.pairs.length;
  const [map, setMap] = useState<number[]>(() => Array(n).fill(-1));
  const [left, setLeft] = useState<number | null>(null);
  const done = p.shown !== undefined;
  const given = p.shown && p.shown.style === 'match' ? p.shown.map : map;
  const colorOf = (li: number) => PC.pair[li % PC.pair.length];
  const ownerOf = (ri: number) => given.indexOf(ri);
  const tapLeft = (li: number) => {
    if (map[li] >= 0) return setMap((m) => m.map((v, i) => (i === li ? -1 : v)));
    setLeft(li === left ? null : li);
  };
  const tapRight = (ri: number) => {
    const owner = map.indexOf(ri);
    if (owner >= 0) return setMap((m) => m.map((v, i) => (i === owner ? -1 : v)));
    if (left == null) return;
    setMap((m) => m.map((v, i) => (i === left ? ri : v)));
    setLeft(null);
  };
  const full = map.every((v) => v >= 0);
  return (
    <Scroll
      after={p.after}
      head={<>{p.head}<Text style={[s.hint, { color: t.dim }]}>{done ? 'Right pairs in green' : 'Tap an item on the left, then its match on the right.'}</Text></>}
      foot={done || p.locked ? (p.locked ? <Waiting /> : null) : <Btn label={full ? 'Submit' : `${map.filter((v) => v < 0).length} left to match`} disabled={!p.live || !full} onPress={() => p.onAnswer({ style: 'match', map })} />}>
      <View style={s.cols}>
        <View style={s.col}>
          {p.q.pairs.map(([a], li) => {
            const joined = given[li] >= 0;
            const ok = given[li] === li;
            return (
              <Tile key={li} small label={a} dot={joined ? colorOf(li) : undefined} state={done ? (ok ? 'good' : 'bad') : left === li ? 'picked' : 'idle'} live={p.live} onPress={() => tapLeft(li)} />
            );
          })}
        </View>
        <View style={s.col}>
          {p.layout.map((ri) => {
            const owner = ownerOf(ri);
            return (
              <Tile key={ri} small label={p.q.pairs[ri][1]} dot={owner >= 0 ? colorOf(owner) : undefined} state={done ? (owner === ri ? 'good' : 'idle') : 'idle'} live={p.live} onPress={() => tapRight(ri)} />
            );
          })}
        </View>
      </View>
      {done && !p.q.pairs.every((_, i) => given[i] === i) ? <Text style={[s.expl, { color: t.mute }]}>{answerText(p.q)}</Text> : null}
    </Scroll>
  );
}

/** Order: tap the items in order; each gets its number. Tap a numbered item to take it (and the ones after) back. */
function Order(p: AnswerProps & { q: Q<'order'>; head: ReactNode }) {
  const t = useTheme();
  const [seq, setSeq] = useState<number[]>([]);
  const done = p.shown !== undefined;
  const given = p.shown && p.shown.style === 'order' ? p.shown.seq : seq;
  const tap = (i: number) => setSeq((x) => (x.includes(i) ? x.slice(0, x.indexOf(i)) : [...x, i]));
  const full = seq.length === p.q.items.length;
  return (
    <Scroll
      after={p.after}
      head={<>{p.head}<Text style={[s.hint, { color: t.dim }]}>{done ? 'The right place is under each item' : 'Tap the items from first to last.'}</Text></>}
      foot={done || p.locked ? (p.locked ? <Waiting /> : null) : <Btn label={full ? 'Submit' : `${p.q.items.length - seq.length} left`} disabled={!p.live || !full} onPress={() => p.onAnswer({ style: 'order', seq })} />}>
      {p.layout.map((i) => {
        const at = given.indexOf(i);
        return (
          <Tile
            key={i}
            label={p.q.items[i]}
            mark={at >= 0 ? String(at + 1) : undefined}
            note={done && at !== i ? `Goes ${ordinal(i + 1)}` : undefined}
            state={done ? (at === i ? 'good' : 'bad') : at >= 0 ? 'picked' : 'idle'}
            live={p.live}
            onPress={() => tap(i)}
          />
        );
      })}
    </Scroll>
  );
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

function Closest(p: AnswerProps & { q: Q<'closest'>; head: ReactNode }) {
  const t = useTheme();
  const [v, setV] = useState('');
  const done = p.shown !== undefined;
  const num = Number(v.replace(',', '.'));
  const ok = v.trim() !== '' && Number.isFinite(num);
  return (
    <Scroll
      after={p.after}
      head={p.head}
      foot={done || p.locked ? (p.locked ? <Waiting /> : null) : <Btn label="Submit" disabled={!p.live || !ok} onPress={() => p.onAnswer({ style: 'closest', value: num })} />}>
      <View style={[s.numBox, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
        <TextInput
          value={done ? (p.shown && p.shown.style === 'closest' ? String(p.shown.value) : '–') : v}
          onChangeText={(x) => setV(x.replace(/[^0-9.,-]/g, '').slice(0, 10))}
          editable={p.live && !done}
          keyboardType="decimal-pad"
          placeholder="Your guess"
          placeholderTextColor={t.dim}
          style={[s.num, { color: t.white }]}
          accessibilityLabel="Your guess"
        />
        {p.q.unit ? <Text style={[s.unit, { color: t.mute }]}>{p.q.unit}</Text> : null}
      </View>
      {done && !p.held ? <Text style={[s.big, { color: PC.good, textAlign: 'center' }]}>{`Answer: ${answerText(p.q)}`}</Text> : null}
    </Scroll>
  );
}

type TileState = 'idle' | 'good' | 'bad' | 'picked';

function Tile({ label, state, live, onPress, gone, faces, tall, small, mark, struck, dot, note }: { label: string; state: TileState; live: boolean; onPress: () => void; gone?: boolean; faces?: string[]; tall?: boolean; small?: boolean; mark?: string; struck?: boolean; dot?: string; note?: string }) {
  const t = useTheme();
  const x = useSharedValue(0);
  useEffect(() => {
    if (state === 'bad') x.value = withSequence(withTiming(-5, { duration: 50 }), withTiming(5, { duration: 70 }), withTiming(-3, { duration: 60 }), withTiming(0, { duration: 50 }));
  }, [state, x]);
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const tint = state === 'good' ? PC.good : state === 'bad' ? PC.bad : state === 'picked' ? t.accent : null;
  return (
    <Animated.View style={move}>
      <Pressable
        onPress={onPress}
        disabled={!live || gone}
        style={[
          s.tile,
          tall && s.tall,
          small && s.small,
          { backgroundColor: t.panel, borderColor: t.panelLine, opacity: gone ? 0.28 : 1 },
          tint ? { borderColor: tint, borderWidth: 1.5 } : null,
          dot ? { borderLeftColor: dot, borderLeftWidth: u(4) } : null,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !live || gone, selected: state === 'picked' }}
        accessibilityLabel={gone ? `${label}, removed` : label}>
        {mark ? (
          <View style={[s.mark, { backgroundColor: tint ?? t.accent }]}>
            <Text style={s.markT}>{mark}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[small ? s.tileS : s.tileT, tall && s.tallT, { color: t.fg, fontFamily: tint ? F.bodyBold : F.body, textDecorationLine: gone || struck ? 'line-through' : 'none' }]}>{label}</Text>
          {note ? <Text style={[s.note, { color: PC.good }]}>{note}</Text> : null}
        </View>
      </Pressable>
      {faces?.length ? (
        <Animated.View entering={FadeIn.duration(220)} style={s.faces} pointerEvents="none">
          {faces.slice(0, 6).map((f, i) => (
            <View key={i} style={[s.faceRing, { borderColor: t.panel, marginLeft: i ? -u(5) : 0 }]}>
              <Face slug={f} size={u(17)} />
            </View>
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function ClockText({ ticks, leftAt, over, white }: { ticks: Clock; leftAt: (now: number) => number; over: boolean; white: string }) {
  const leftMs = leftAt(useClock(ticks));
  const warn = leftMs <= 5_000 && !over;
  return (
    <Text style={[s.clock, { color: warn ? PC.bad : white }]} accessibilityLabel={`${Math.ceil(leftMs / 1000)} seconds left`}>
      {clock(leftMs, { down: true })}
    </Text>
  );
}

function LiveFuse({ ticks, leftAt, totalMs, cool, track }: { ticks: Clock; leftAt: (now: number) => number; totalMs: number; cool: string; track: string }) {
  const leftMs = leftAt(useClock(ticks));
  const pct = `${Math.max(0, Math.min(1, totalMs ? leftMs / totalMs : 0)) * 100}%` as const;
  return (
    <View style={[s.fuse, { backgroundColor: track }]}>
      <LinearGradient colors={[cool, PC.hot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fuseFill, { width: pct }]} />
    </View>
  );
}

function HelperBtn({ kind, label, bg, line, fg, off, onPress }: { kind: HelperKind; label: string; bg: string; line: string; fg: string; off: boolean; onPress: () => void }) {
  const price = HELPER_PRICE[kind];
  return (
    <Pressable onPress={onPress} disabled={off} style={[s.hb, { backgroundColor: bg, borderColor: line }]} accessibilityRole="button" accessibilityLabel={`${label}, ${price} token${price > 1 ? 's' : ''}`}>
      <Text style={[s.hbT, { color: fg, opacity: off ? 0.45 : 1 }]} numberOfLines={1}>{label}</Text>
      <Text style={[s.hbP, { color: fg, opacity: off ? 0.34 : 0.75 }]}>{`${price} token${price > 1 ? 's' : ''}`}</Text>
    </Pressable>
  );
}

/** Solo helpers (QP9): Skip and +10 s only, on every type. */
function Helpers({ onHelper, usable, disabled }: { onHelper: (k: HelperKind) => void; usable: (k: HelperKind) => boolean; disabled: boolean }) {
  return (
    <View style={s.hrow}>
      <HelperBtn kind="skip" off={disabled || !usable('skip')} onPress={() => onHelper('skip')} label="⏭ Skip" bg="#2e1a2e" line="#833f4a" fg="#fda4af" />
      <HelperBtn kind="time" off={disabled || !usable('time')} onPress={() => onHelper('time')} label="⏱ +10 s" bg="#231b4e" line="#504188" fg="#d8b4fe" />
    </View>
  );
}

const s = StyleSheet.create({
  main: { flex: 1, minWidth: 0, gap: u(9) },
  who: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: u(8) },
  count: { fontFamily: F.display, fontSize: u(17), lineHeight: u(20) },
  type: { fontFamily: F.bodyBold, fontSize: u(7.5), letterSpacing: u(1.3), marginTop: u(2) },
  right: { flexDirection: 'row', alignItems: 'center', gap: u(7) },
  clock: { fontFamily: F.mono, fontSize: u(13), letterSpacing: u(0.4) },
  fuse: { height: u(3.5), borderRadius: u(2), overflow: 'hidden' },
  fuseFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: u(2) },
  q: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17) },
  rk: { fontFamily: F.bodyBold, fontSize: u(7.5), letterSpacing: u(1.2) },
  big: { fontFamily: F.display, fontSize: u(17), lineHeight: u(21) },
  hint: { fontFamily: F.body, fontSize: u(9.5) },
  tile: { minHeight: u(38), borderRadius: u(11), borderWidth: 1, paddingHorizontal: u(10), paddingVertical: u(8), flexDirection: 'row', alignItems: 'center', gap: u(8) },
  tall: { minHeight: u(74), justifyContent: 'center' },
  small: { minHeight: u(34), paddingHorizontal: u(7), paddingVertical: u(6) },
  tileT: { fontSize: u(10.5), lineHeight: u(13.5) },
  tallT: { fontSize: u(14), textAlign: 'center' },
  tileS: { fontSize: u(9.5), lineHeight: u(12) },
  note: { fontFamily: F.bodySemi, fontSize: u(8.5), marginTop: u(2) },
  mark: { width: u(18), height: u(18), borderRadius: u(9), alignItems: 'center', justifyContent: 'center' },
  markT: { color: '#0b1020', fontFamily: F.bodyBold, fontSize: u(9.5) },
  tfRow: { flexDirection: 'row', gap: u(7) },
  cols: { flexDirection: 'row', gap: u(6) },
  col: { flex: 1, gap: u(6) },
  numBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: u(12), paddingHorizontal: u(12), gap: u(8) },
  num: { flex: 1, fontFamily: F.display, fontSize: u(22), paddingVertical: u(10) },
  unit: { fontFamily: F.bodySemi, fontSize: u(11) },
  after: { gap: u(4), paddingTop: u(6) },
  pts: { fontFamily: F.bodyBold, fontSize: u(12), textAlign: 'center' },
  expl: { fontFamily: F.body, fontSize: u(10), lineHeight: u(14) },
  wait: { fontFamily: F.bodySemi, fontSize: u(10.5), textAlign: 'center', paddingVertical: u(6) },
  faces: { position: 'absolute', top: -u(8), right: u(4), flexDirection: 'row' },
  faceRing: { borderWidth: 1.5, borderRadius: u(10) },
  hide: { borderRadius: u(14), borderWidth: 1, padding: u(18), alignItems: 'center' },
  hideT: { fontFamily: F.body, fontSize: u(11) },
  notice: { fontFamily: F.bodySemi, fontSize: u(10.5), textAlign: 'center' },
  hrow: { flexDirection: 'row', gap: u(5) },
  hb: { flex: 1, borderWidth: 1, borderRadius: u(10), paddingVertical: u(10), paddingHorizontal: u(3), alignItems: 'center', gap: u(1) },
  hbT: { fontFamily: F.bodyBold, fontSize: u(10.5), lineHeight: u(13) },
  hbP: { fontFamily: F.bodySemi, fontSize: u(8), lineHeight: u(10), opacity: 0.75 },
});
