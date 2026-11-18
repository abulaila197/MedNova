import { COIN } from '@/components/CoinLabel';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  type AnimatedRef,
  type SharedValue,
  measure,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useScrollViewOffset,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/AppText';
import { tr } from '@/i18n';
import { useTheme } from '@/state/app';
import { BEIGE as B } from '@/theme/beige';
import { TABLET, u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { clock } from '../engine/clock';
import { Btn, GameScreen, HelperButton, Kick, RoundBtn } from '../shell/ui';
import { ORDER, cardOf, full, poolOf, type QRun, type Question, type Target } from './core';

const BEIGE = B ?? { bg: '#efe4cb', line: '#cdb88c', ink: '#3b2f1c', paper: '#f1e6cc' };

// The Put it in order play screen (Yazan 2026-11-18, option A): the steps sit in a pool at the top; numbered slots sit
// on a glowing cyan line below. A step moves only by drag and drop, in one press, slide and release: it can be dragged
// anywhere on the screen, dropping on a filled slot swaps the two, and dropping on the pool or anywhere else sends it
// home. Steps are beige cards, like Medical Riddles and Wheels of Chaos.
//
// The drag runs on the UI thread (gesture handler + reanimated): nothing re-renders while a step is moving; the board
// changes only after the step lands. One drag at a time: a second press while a step is moving or landing does nothing.
// The steps scroll (and scroll by themselves when a step is held near the top or bottom edge); helpers and Submit stay
// pinned at the bottom.

/** The bank's longest question has 7 steps; one slot ref each (hooks need a fixed count). */
const MAX_SLOTS = 7;
const CYAN = '#22d3ee';
const VIOLET = '#7c3aed';
const PINK = '#f472b6';
const AMBER = '#f59e0b';
const GREEN = '#34d399';
/** Hover codes: a slot index, or one of these. */
const NONE = -1;
const POOL = -2;
/** Pixels from the scroll area's top or bottom edge where a held step scrolls the steps. */
const EDGE = u(34);

type Drag = {
  /** The card being dragged (-1 = none). One at a time. */
  active: SharedValue<number>;
  /** 0 idle, 1 dragging, 2 landing. */
  phase: SharedValue<number>;
  hover: SharedValue<number>;
  gx: SharedValue<number>;
  gy: SharedValue<number>;
  gw: SharedValue<number>;
  shown: SharedValue<number>;
  px: SharedValue<number>;
  py: SharedValue<number>;
  grabX: SharedValue<number>;
  grabY: SharedValue<number>;
  rootX: SharedValue<number>;
  rootY: SharedValue<number>;
  /** Slots a step can't be dropped on (fixed by Place a step). */
  fixed: SharedValue<number[]>;
};

/** Which slot (or the pool) is under the finger: a slot index, POOL or NONE (a fixed slot takes nothing). */
function hitAt(slotRefs: AnimatedRef<View>[], poolRef: AnimatedRef<View>, fixed: number[], x: number, y: number): number {
  'worklet';
  for (let i = 0; i < slotRefs.length; i++) {
    const m = measure(slotRefs[i]);
    if (m && x >= m.pageX - 30 && x <= m.pageX + m.width + 30 && y >= m.pageY - 4 && y <= m.pageY + m.height + 4) return fixed.includes(i) ? NONE : i;
  }
  const pm = measure(poolRef);
  if (pm && x >= pm.pageX && x <= pm.pageX + pm.width && y >= pm.pageY && y <= pm.pageY + pm.height) return POOL;
  return NONE;
}

/** The drag's shared values (UI thread), made once. */
function useDrag(): Drag {
  const active = useSharedValue(-1);
  const phase = useSharedValue(0);
  const hover = useSharedValue(NONE);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const gw = useSharedValue(0);
  const shown = useSharedValue(0);
  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  const rootX = useSharedValue(0);
  const rootY = useSharedValue(0);
  const fixed = useSharedValue<number[]>([]);
  return useMemo(
    () => ({ active, phase, hover, gx, gy, gw, shown, px, py, grabX, grabY, rootX, rootY, fixed }),
    [active, phase, hover, gx, gy, gw, shown, px, py, grabX, grabY, rootX, rootY, fixed],
  );
}

export type HelpProps = { place: { label: string; onPress: () => void; disabled: boolean }; decoy: { label: string; onPress: () => void; disabled: boolean } };

export type OrderBoardProps = {
  q: Question;
  run: QRun;
  title: string;
  sub?: string;
  clock: { label: string; ms: number; down?: boolean; warn?: boolean };
  worth: number;
  /** No dragging or Submit (paused, waiting, a curtain over the board). */
  locked?: boolean;
  /** Paused: the steps are hidden. */
  hidden?: boolean;
  onPause: () => void;
  onMove: (card: number, to: Target) => void;
  onSubmit: () => void;
  help?: HelpProps;
  /** A line over Submit (wrong try, a helper's message). */
  note?: { text: string; tone?: 'bad' | 'good' } | null;
  /** A row under the stats (vs rivals: who is filling their slots). */
  live?: ReactNode;
  /** Layers over the screen (pause menu, curtain, pop-ups). */
  children?: ReactNode;
};

export function OrderBoard(p: OrderBoardProps) {
  const t = useTheme();
  const { q, run } = p;
  const n = q.steps.length;
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollViewOffset(scrollRef);
  const contentH = useSharedValue(0);
  const rootRef = useAnimatedRef<View>();
  const poolRef = useAnimatedRef<View>();
  const r0 = useAnimatedRef<View>();
  const r1 = useAnimatedRef<View>();
  const r2 = useAnimatedRef<View>();
  const r3 = useAnimatedRef<View>();
  const r4 = useAnimatedRef<View>();
  const r5 = useAnimatedRef<View>();
  const r6 = useAnimatedRef<View>();
  const slotRefs = useMemo(() => [r0, r1, r2, r3, r4, r5, r6].slice(0, Math.min(n, MAX_SLOTS)), [n, r0, r1, r2, r3, r4, r5, r6]);

  const drag = useDrag();
  useEffect(() => {
    drag.fixed.set(run.fixed);
  }, [drag, run.fixed]);

  // The scroll view is a native gesture the step drags block, so a held step never scrolls the page.
  const native = useMemo(() => Gesture.Native(), []);



  // Scrolls the steps while a step is held near the top or bottom edge.
  const auto = useFrameCallback(() => {
    if (drag.phase.get() !== 1) return;
    const sv = measure(scrollRef);
    if (!sv) return;
    const y = drag.py.get();
    let dy = 0;
    if (y < sv.pageY + EDGE) dy = -Math.ceil((sv.pageY + EDGE - y) / 6);
    else if (y > sv.pageY + sv.height - EDGE) dy = Math.ceil((y - (sv.pageY + sv.height - EDGE)) / 6);
    if (!dy) return;
    const max = Math.max(0, contentH.get() - sv.height);
    const to = Math.min(max, Math.max(0, offset.get() + dy));
    if (to === offset.get()) return;
    scrollTo(scrollRef, 0, to, false);
    drag.hover.set(hitAt(slotRefs, poolRef, drag.fixed.get(), drag.px.get(), drag.py.get()));
  }, false);

  // The ghost's text lives in its own small component, so starting a drag re-renders only the ghost.
  const ghostSet = useRef<(card: number | null) => void>(() => {});
  // The latest onMove, kept in a ref so the drag callbacks (and the cards) don't change on every clock tick.
  const onMove = useRef(p.onMove);
  useEffect(() => {
    onMove.current = p.onMove;
  });
  const begin = useCallback(
    (card: number) => {
      ghostSet.current(card);
      auto.setActive(true);
    },
    [auto],
  );
  const land = useCallback(
    (card: number, to: number) => {
      auto.setActive(false);
      if (to >= 0 || to === POOL) onMove.current(card, to === POOL ? 'pool' : to);
      // Let the board draw the step in its new place before the ghost goes and the next drag may start.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          drag.shown.set(0);
          drag.hover.set(NONE);
          drag.phase.set(0);
          drag.active.set(-1);
          ghostSet.current(null);
        }),
      );
    },
    [auto, drag],
  );

  const enabled = !p.locked && !run.done;
  const ctx = useMemo<CardCtx>(() => ({ drag, rootRef, slotRefs, poolRef, native, begin, land, enabled }), [drag, rootRef, slotRefs, poolRef, native, begin, land, enabled]);

  // A wrong try: the line of slots gives one short shake.
  const shake = useSharedValue(0);
  const missRef = useRef(run.miss);
  useEffect(() => {
    if (run.miss > missRef.current) shake.set(withSequence(withTiming(-u(7), { duration: 60 }), withTiming(u(6), { duration: 70 }), withTiming(-u(4), { duration: 70 }), withTiming(0, { duration: 60 })));
    missRef.current = run.miss;
  }, [run.miss, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const poolHot = useAnimatedStyle(() => ({ borderColor: drag.hover.get() === POOL && drag.phase.get() === 1 ? CYAN : 'transparent', backgroundColor: drag.hover.get() === POOL && drag.phase.get() === 1 ? 'rgba(34,211,238,0.06)' : 'transparent' }));

  const pool = poolOf(run);
  const triesLeft = ORDER.tries - run.wrong;
  const bottom = (
    <View style={[s.bottom, TABLET && s.tBottom]}>
      {p.help ? (
        <View style={s.helpers}>
          <HelperButton tone="purple" compact label={p.help.place.label} onPress={p.help.place.onPress} disabled={p.help.place.disabled || !!p.locked} style={s.helper} />
          <HelperButton tone="cyan" compact label={p.help.decoy.label} onPress={p.help.decoy.onPress} disabled={p.help.decoy.disabled || !!p.locked} style={s.helper} />
        </View>
      ) : null}
      <Text style={[s.note, { color: p.note?.tone === 'bad' ? t.rose : p.note?.tone === 'good' ? GREEN : t.mute }]} numberOfLines={2}>
        {p.note?.text ?? (full(run) ? tr('All slots full. Submit when you are sure.') : tr('Drag every step into its slot.'))}
      </Text>
      <Btn label={tr('Submit order')} onPress={p.onSubmit} disabled={!full(run) || !!p.locked || run.done} />
    </View>
  );

  return (
    <GameScreen scroll={false}>
      <View ref={rootRef} style={s.fill} collapsable={false}>
        <View style={s.top}>
          <View style={s.titleRow}>
            <Text style={[s.ttl, { color: t.white }]} numberOfLines={1}>
              {p.title} {p.sub ? <Text style={[s.of, { color: t.mute }]}>{p.sub}</Text> : null}
            </Text>
            <Text style={[s.pill, { color: PINK, borderColor: 'rgba(244,114,182,0.55)', backgroundColor: 'rgba(244,114,182,0.12)' }]} numberOfLines={1}>
              {tr(q.cat)}
            </Text>
            <RoundBtn label={tr('Pause')} glyph="❚❚" onPress={p.onPause} />
          </View>
          <View style={[s.stats, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
            <Stat label={p.clock.label} value={clock(p.clock.ms, { pad: true, down: p.clock.down })} color={p.clock.warn ? t.rose : AMBER} />
            <Stat label={tr('Worth now')} value={String(p.worth)} />
            <View style={s.st}>
              <Text style={[s.sl, { color: t.mute }]}>{tr('Tries')}</Text>
              <View style={s.dots}>
                {Array.from({ length: ORDER.tries }, (_, i) => (
                  <View key={i} style={[s.dot, { backgroundColor: i < triesLeft ? AMBER : '#2b3866' }]} />
                ))}
              </View>
            </View>
          </View>
        </View>
        {p.live}

        {p.hidden ? (
          <View style={[s.hidden, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
            <Kick>{tr('Question hidden')}</Kick>
            <Text style={[s.hiddenT, { color: t.mute }]}>{tr('The steps come back when you resume.')}</Text>
          </View>
        ) : (
          <GestureDetector gesture={native}>
            <Animated.ScrollView
              ref={scrollRef}
              style={s.fill}
              contentContainerStyle={s.scroll}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onContentSizeChange={(_w, h) => {
                contentH.set(h);
              }}>
              <Text style={[s.q, { color: t.white }]}>{q.q}</Text>
              <Kick>{tr('Steps · drag them down')}</Kick>
              <Animated.View ref={poolRef} collapsable={false} style={[s.pool, poolHot]}>
                {pool.length ? pool.map((c) => <DragCard key={c} card={c} text={cardOf(q, c).t} from={null} ctx={ctx} half />) : <Text style={[s.poolEmpty, { color: t.dim }]}>{tr('Every step is in a slot.')}</Text>}
              </Animated.View>
              <Kick>{tr('Your order')}</Kick>
              <Animated.View style={[s.line, shakeStyle]}>
                <View style={s.rail} pointerEvents="none">
                  <View style={[s.railTop, { backgroundColor: CYAN }]} />
                  <View style={[s.railBottom, { backgroundColor: VIOLET }]} />
                </View>
                {run.slots.map((c, i) => (
                  <Slot key={i} i={i} sref={slotRefs[i]} drag={drag} fixed={run.fixed.includes(i)}>
                    {c != null ? <DragCard key={c} card={c} text={cardOf(q, c).t} from={i} ctx={ctx} fixed={run.fixed.includes(i)} /> : null}
                  </Slot>
                ))}
              </Animated.View>
            </Animated.ScrollView>
          </GestureDetector>
        )}

        {bottom}
        <Ghost drag={drag} q={q} setRef={ghostSet} />
      </View>
      {p.children}
    </GameScreen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={s.st}>
      <Text style={[s.sl, { color: t.mute }]}>{label}</Text>
      <Text style={[s.sv, { color: color ?? t.accent }]}>{value}</Text>
    </View>
  );
}

function Slot({ i, sref, drag, fixed, children }: { i: number; sref: AnimatedRef<View> | undefined; drag: Drag; fixed: boolean; children: ReactNode }) {
  const filled = !!children;
  const hot = useAnimatedStyle(() => {
    const on = drag.phase.get() === 1 && drag.hover.get() === i;
    return { borderColor: on ? CYAN : filled ? 'transparent' : '#34467e', backgroundColor: on ? 'rgba(34,211,238,0.08)' : 'transparent' };
  });
  return (
    <View style={s.slotRow}>
      <View style={[s.num, { borderColor: fixed ? GREEN : CYAN }]}>
        <Text style={[s.numT, { color: fixed ? GREEN : CYAN }]}>{i + 1}</Text>
      </View>
      <Animated.View ref={sref} collapsable={false} style={[s.slot, !filled && s.slotEmpty, hot]}>
        {children ?? <Text style={s.drop}>{tr('Drop a step here')}</Text>}
      </Animated.View>
    </View>
  );
}

type CardCtx = {
  drag: Drag;
  rootRef: AnimatedRef<View>;
  slotRefs: AnimatedRef<View>[];
  native: GestureType;
  poolRef: AnimatedRef<View>;
  begin: (card: number) => void;
  land: (card: number, to: number) => void;
  enabled: boolean;
};

/** A beige step card that can be dragged (a fixed one, placed by the helper, can't). */
const DragCard = memo(function DragCard({ card, text, from, ctx, half, fixed }: { card: number; text: string; from: number | null; ctx: CardCtx; half?: boolean; fixed?: boolean }) {
  const self = useAnimatedRef<View>();
  const { drag, rootRef, slotRefs, poolRef, native, begin, land } = ctx;
  const enabled = ctx.enabled && !fixed;
  /* eslint-disable react-hooks/refs -- gesture callbacks run on the UI thread, never during render */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .minDistance(3)
        .shouldCancelWhenOutside(false)
        .blocksExternalGesture(native)
        .onStart((e) => {
          // One drag at a time: a press while another step is moving or landing does nothing.
          if (drag.active.get() !== -1 || drag.phase.get() !== 0) return;
          const me = measure(self);
          const root = measure(rootRef);
          if (!me || !root) return;
          drag.active.set(card);
          drag.phase.set(1);
          drag.rootX.set(root.pageX);
          drag.rootY.set(root.pageY);
          drag.grabX.set(e.absoluteX - me.pageX);
          drag.grabY.set(e.absoluteY - me.pageY);
          drag.gx.set(me.pageX - root.pageX);
          drag.gy.set(me.pageY - root.pageY);
          drag.gw.set(me.width);
          drag.px.set(e.absoluteX);
          drag.py.set(e.absoluteY);
          drag.hover.set(from ?? POOL);
          drag.shown.set(1);
          scheduleOnRN(begin, card);
        })
        .onUpdate((e) => {
          if (drag.active.get() !== card || drag.phase.get() !== 1) return;
          drag.px.set(e.absoluteX);
          drag.py.set(e.absoluteY);
          drag.gx.set(e.absoluteX - drag.rootX.get() - drag.grabX.get());
          drag.gy.set(e.absoluteY - drag.rootY.get() - drag.grabY.get());
          drag.hover.set(hitAt(slotRefs, poolRef, drag.fixed.get(), e.absoluteX, e.absoluteY));
        })
        .onFinalize(() => {
          if (drag.active.get() !== card || drag.phase.get() !== 1) return;
          drag.phase.set(2);
          const h = drag.hover.get();
          const fly = { duration: 150 };
          const done = (to: number) => {
            'worklet';
            scheduleOnRN(land, card, to);
          };
          // On a slot: the step flies into it. Home (its own slot, or the pool it came from): it flies back.
          // From a slot to the pool: it fades out where it is, and shows up in the pool.
          const target = h >= 0 && h !== from ? measure(slotRefs[h]) : null;
          if (target) {
            drag.gw.set(withTiming(target.width, fly));
            drag.gy.set(withTiming(target.pageY - drag.rootY.get(), fly));
            drag.gx.set(withTiming(target.pageX - drag.rootX.get(), fly, () => done(h)));
            return;
          }
          if (h === POOL && from != null) {
            drag.shown.set(withTiming(0, { duration: 120 }, () => done(POOL)));
            return;
          }
          const home = measure(self);
          if (!home) return done(NONE);
          drag.gy.set(withTiming(home.pageY - drag.rootY.get(), fly));
          drag.gx.set(withTiming(home.pageX - drag.rootX.get(), fly, () => done(NONE)));
        }),
    [enabled, native, drag, self, rootRef, card, from, begin, poolRef, slotRefs, land],
  );
  const dim = useAnimatedStyle(() => ({ opacity: drag.active.get() === card ? 0.25 : 1 }));
  /* eslint-enable react-hooks/refs */
  return (
    <GestureDetector gesture={pan}>
      <Animated.View ref={self} collapsable={false} style={[half ? s.half : s.wide, dim]}>
        <StepCard text={text} edge={from != null} fixed={fixed} />
      </Animated.View>
    </GestureDetector>
  );
});

/** The beige card itself, with a small grip of dots on its start side. */
function StepCard({ text, edge, fixed, lifted }: { text: string; edge?: boolean; fixed?: boolean; lifted?: boolean }) {
  return (
    <View style={[s.card, edge && { borderStartWidth: u(4), borderStartColor: fixed ? GREEN : CYAN }, lifted && s.lifted]}>
      <View style={s.grip}>
        {[0, 1, 2].map((r) => (
          <View key={r} style={s.gripRow}>
            <View style={s.gripDot} />
            <View style={s.gripDot} />
          </View>
        ))}
      </View>
      <Text style={s.cardT}>{text}</Text>
    </View>
  );
}

/** The step under the finger. Drawn left to right in both languages, so its place matches the finger. */
function Ghost({ drag, q, setRef }: { drag: Drag; q: Question; setRef: { current: (card: number | null) => void } }) {
  const [card, setCard] = useState<number | null>(null);
  useEffect(() => {
    setRef.current = setCard;
  }, [setRef]);
  const pos = useAnimatedStyle(() => ({ opacity: drag.shown.get(), width: drag.gw.get(), transform: [{ translateX: drag.gx.get() }, { translateY: drag.gy.get() }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]} pointerEvents="none">
      <Animated.View style={[s.ghost, pos]}>{card != null && card < q.steps.length + q.decoys.length ? <StepCard text={cardOf(q, card).t} lifted /> : null}</Animated.View>
    </View>
  );
}

/** "Place a step · 2🪙" and "Remove a decoy · 1🪙", or their used labels. */
export const helpLabels = (run: QRun) => ({
  place: run.placeUsed ? tr('Step placed') : tr('Place a step · {n}{COIN}', { n: ORDER.placeCost, COIN }),
  decoy: run.decoyUsed ? tr('Decoy removed') : tr('Remove a decoy · {n}{COIN}', { n: ORDER.decoyCost, COIN }),
});

/** The note over Submit after a wrong try. */
export const missNote = (run: QRun) =>
  run.wrong && !run.done ? { text: ORDER.tries - run.wrong === 1 ? tr('Not right yet. 1 try left.') : tr('Not right yet. {n} tries left.', { n: ORDER.tries - run.wrong }), tone: 'bad' as const } : null;

const s = StyleSheet.create({
  fill: { flex: 1 },
  top: { gap: u(9), marginBottom: u(9) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  ttl: { flexShrink: 1, fontFamily: F.display, fontSize: u(17), lineHeight: u(21) },
  of: { fontFamily: F.bodyMedium, fontSize: u(11) },
  pill: { flexShrink: 0, marginStart: 'auto', fontFamily: F.bodyBold, fontSize: u(8.5), letterSpacing: u(0.8), textTransform: 'uppercase', borderWidth: 1, borderRadius: u(6), paddingVertical: u(4), paddingHorizontal: u(7), overflow: 'hidden' },
  stats: { flexDirection: 'row', borderWidth: 1, borderRadius: u(12), paddingVertical: u(9), paddingHorizontal: u(11), gap: u(8) },
  st: { flex: 1, gap: u(2) },
  sl: { fontFamily: F.bodyBold, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(0.6), textTransform: 'uppercase' },
  sv: { fontFamily: F.bodyBold, fontSize: u(15), lineHeight: u(18), fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', gap: u(5), height: u(18), alignItems: 'center' },
  dot: { width: u(9), height: u(9), borderRadius: u(5) },
  hidden: { flex: 1, borderWidth: 1, borderRadius: u(14), alignItems: 'center', justifyContent: 'center', gap: u(6), padding: u(20) },
  hiddenT: { fontFamily: F.body, fontSize: u(12), textAlign: 'center' },
  scroll: { gap: u(8), paddingBottom: u(12) },
  q: { fontFamily: F.bodyBold, fontSize: u(14), lineHeight: u(19) },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6), minHeight: u(40), padding: u(4), marginHorizontal: -u(4), borderRadius: u(10), borderWidth: 1, borderStyle: 'dashed' },
  poolEmpty: { fontFamily: F.body, fontSize: u(11), paddingVertical: u(8), paddingHorizontal: u(4) },
  half: { width: '48.5%' },
  wide: { flex: 1 },
  card: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: u(7), backgroundColor: BEIGE.bg, borderColor: BEIGE.line, borderWidth: 1, borderRadius: u(9), paddingVertical: u(7), paddingStart: u(7), paddingEnd: u(9), shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  lifted: { borderColor: CYAN, borderWidth: 2, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  cardT: { flex: 1, fontFamily: F.bodyMedium, fontSize: u(11.5), lineHeight: u(15), color: BEIGE.ink },
  grip: { gap: u(2) },
  gripRow: { flexDirection: 'row', gap: u(2) },
  gripDot: { width: u(2.4), height: u(2.4), borderRadius: u(2), backgroundColor: '#9c8458' },
  line: { gap: u(6), paddingStart: u(30) },
  rail: { position: 'absolute', start: u(11), top: u(14), bottom: u(14), width: u(2), borderRadius: u(1), overflow: 'hidden', shadowColor: CYAN, shadowOpacity: 0.8, shadowRadius: 6 },
  railTop: { flex: 1 },
  railBottom: { flex: 1, opacity: 0.9 },
  slotRow: { justifyContent: 'center' },
  num: { position: 'absolute', start: -u(30), width: u(24), height: u(24), borderRadius: u(12), borderWidth: 2, backgroundColor: '#0d1738', alignItems: 'center', justifyContent: 'center' },
  numT: { fontFamily: F.bodyBold, fontSize: u(11) },
  slot: { minHeight: u(36), borderRadius: u(9), borderWidth: 1.5, flexDirection: 'row' },
  slotEmpty: { borderStyle: 'dashed', alignItems: 'center' },
  drop: { fontFamily: F.body, fontSize: u(10.5), color: '#5f6f9c', paddingHorizontal: u(10) },
  ghost: { position: 'absolute', left: 0, top: 0 },
  bottom: { gap: u(7), paddingTop: u(8) },
  tBottom: { width: '100%', maxWidth: u(300), alignSelf: 'center' },
  helpers: { flexDirection: 'row', gap: u(6) },
  // Narrower side padding than the shared helper, so 'Remove a decoy · 1' fits a phone's half width.
  helper: { flex: 1, paddingHorizontal: u(5) },
  note: { fontFamily: F.bodyMedium, fontSize: u(11), lineHeight: u(14), textAlign: 'center', minHeight: u(14) },
});
