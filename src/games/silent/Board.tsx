import { memo, useImperativeHandle, useLayoutEffect, useMemo, useState, useSyncExternalStore, type Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

// The drawing board, built on the app's own drawing kit (react-native-svg + gesture handler), so it runs
// in Expo Go, on device builds and in the web preview alike. Strokes are kept in board units (0-1000 wide)
// so a drawing looks the same at any size.

export type Stroke = { color: string; width: number; erase: boolean; pts: number[] };
export type BoardHandle = { undo: () => void; clear: () => void; strokes: () => Stroke[] };

const UNITS = 1000;

/** Smooth path through the points: straight to the first midpoint, then quadratic curves between midpoints. */
export function strokePath(pts: number[]) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0]} ${pts[1]} l0.1 0`;
  let d = `M${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i] + pts[i + 2]) / 2;
    const my = (pts[i + 1] + pts[i + 3]) / 2;
    d += ` Q${pts[i]} ${pts[i + 1]} ${mx} ${my}`;
  }
  d += ` L${pts[pts.length - 2]} ${pts[pts.length - 1]}`;
  return d;
}

const Done = memo(function Done({ strokes, bg }: { strokes: Stroke[]; bg: string }) {
  return (
    <>
      {strokes.map((s, i) => (
        <Path key={i} d={strokePath(s.pts)} stroke={s.erase ? bg : s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </>
  );
});

/** The stroke being drawn right now, kept outside React state so a finger move redraws only the one live line. */
export type LiveStroke = { get: () => Stroke | null; set: (s: Stroke | null) => void; subscribe: (fn: () => void) => () => void };

export function liveStroke(): LiveStroke {
  let cur: Stroke | null = null;
  const subs = new Set<() => void>();
  return {
    get: () => cur,
    set(s) {
      cur = s;
      subs.forEach((f) => f());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

/** The live line alone: it follows its store, so the board and the screen around it don't redraw per move. */
function LiveLine({ live, bg, min = 1 }: { live: LiveStroke; bg: string; min?: number }) {
  const x = useSyncExternalStore(live.subscribe, live.get, live.get);
  return x && x.pts.length >= min ? <Path d={strokePath(x.pts)} stroke={x.erase ? bg : x.color} strokeWidth={x.width} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null;
}

type Tool = { color: string; width: number; erase: boolean };
type Handlers = { onChange?: (n: number) => void; onStrokes?: (all: Stroke[]) => void; onLive?: (s: Stroke | null) => void };

/**
 * The board's drawing state, made once per board. The pan gesture talks to it directly (no React state per move);
 * only a finished line, Undo and Clear change the strokes React draws.
 */
function makePad(initial: Stroke[], setStrokes: (all: Stroke[]) => void) {
  let size = 1;
  let tool: Tool = { color: '', width: 1, erase: false };
  let on: Handlers = {};
  let cur: Stroke | null = null;
  let all = initial;
  const live = liveStroke();
  const at = (x: number, y: number) => [Math.round((x / size) * UNITS * 10) / 10, Math.round((y / size) * UNITS * 10) / 10];
  const commit = (next: Stroke[]) => {
    all = next;
    setStrokes(next);
    on.onChange?.(next.length);
    on.onStrokes?.(next);
  };
  return {
    live,
    setSize: (w: number) => void (size = w || 1),
    setTool: (t: Tool) => void (tool = t),
    setHandlers: (h: Handlers) => void (on = h),
    strokes: () => all,
    undo: () => commit(all.slice(0, -1)),
    clear: () => commit([]),
    begin(x: number, y: number) {
      cur = { ...tool, pts: at(x, y) };
      live.set({ ...cur });
      on.onLive?.(cur);
    },
    move(x: number, y: number) {
      const s = cur;
      if (!s) return;
      const [px, py] = at(x, y);
      const lx = s.pts[s.pts.length - 2];
      const ly = s.pts[s.pts.length - 1];
      if (Math.abs(px - lx) + Math.abs(py - ly) < 2) return;
      s.pts.push(px, py);
      live.set({ ...s });
      on.onLive?.(s);
    },
    end() {
      const s = cur;
      cur = null;
      live.set(null);
      on.onLive?.(null);
      if (s) commit([...all, s]);
    },
  };
}

/**
 * `color`/`width`/`erase` are the current tool; `bg` is the board colour (the eraser paints with it).
 * `enabled` false makes the board read-only (e.g. while paused). `ratio` is height / width. `initial` is only read
 * when the board mounts (key it to start a clean board). `onStrokes` hears every change to the finished lines.
 */
export function Board({ ref, color, width, erase, bg, enabled = true, ratio = 4 / 3, initial, onChange, onStrokes, onLive, children, style }: { ref?: Ref<BoardHandle>; color: string; width: number; erase: boolean; bg: string; enabled?: boolean; ratio?: number; initial?: Stroke[]; onChange?: (n: number) => void; onStrokes?: (all: Stroke[]) => void; onLive?: (s: Stroke | null) => void; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial ?? []);
  const [pad] = useState(() => makePad(initial ?? [], setStrokes));

  // The latest tool and callbacks, for the gesture (which is built once).
  useLayoutEffect(() => {
    pad.setTool({ color, width, erase });
    pad.setHandlers({ onChange, onStrokes, onLive });
  });

  useImperativeHandle(ref, () => ({ undo: pad.undo, clear: pad.clear, strokes: pad.strokes }), [pad]);

  // Runs on the JS thread: each move goes to the pad, and only the small live line redraws.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(enabled)
        .minDistance(0)
        .maxPointers(1)
        .onBegin((e) => pad.begin(e.x, e.y))
        .onUpdate((e) => pad.move(e.x, e.y))
        .onFinalize(() => pad.end()),
    [pad, enabled],
  );

  const onLayout = (e: LayoutChangeEvent) => pad.setSize(e.nativeEvent.layout.width);

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={onLayout} style={[s.board, { aspectRatio: 1 / ratio, backgroundColor: bg }, style]} collapsable={false}>
        {children}
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${UNITS} ${UNITS * ratio}`} preserveAspectRatio="none">
          <Done strokes={strokes} bg={bg} />
          <LiveLine live={pad.live} bg={bg} />
        </Svg>
      </View>
    </GestureDetector>
  );
}

/** A read-only board for watchers (online): the drawer's finished strokes plus the stroke being drawn right now. */
export function Sketch({ strokes, live, bg, ratio, children, style }: { strokes: Stroke[]; live?: LiveStroke; bg: string; ratio: number; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.board, { aspectRatio: 1 / ratio, backgroundColor: bg }, style]}>
      {children}
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${UNITS} ${UNITS * ratio}`} preserveAspectRatio="none">
        <Done strokes={strokes} bg={bg} />
        {live ? <LiveLine live={live} bg={bg} min={2} /> : null}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  board: { width: '100%', overflow: 'hidden' },
});
