import { memo, useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
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

/**
 * `color`/`width`/`erase` are the current tool; `bg` is the board colour (the eraser paints with it).
 * `enabled` false makes the board read-only (e.g. while paused). `ratio` is height / width.
 */
export function Board({ ref, color, width, erase, bg, enabled = true, ratio = 4 / 3, initial, onChange, children, style }: { ref?: Ref<BoardHandle>; color: string; width: number; erase: boolean; bg: string; enabled?: boolean; ratio?: number; initial?: Stroke[]; onChange?: (n: number) => void; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial ?? []);
  const [live, setLive] = useState<Stroke | null>(null);
  const size = useRef(1);
  const cur = useRef<Stroke | null>(null);
  const all = useRef<Stroke[]>(initial ?? []);

  const commit = useCallback(
    (next: Stroke[]) => {
      all.current = next;
      setStrokes(next);
      onChange?.(next.length);
    },
    [onChange],
  );

  useImperativeHandle(ref, () => ({ undo: () => commit(all.current.slice(0, -1)), clear: () => commit([]), strokes: () => all.current }), [commit]);

  const at = (x: number, y: number) => [Math.round((x / size.current) * UNITS * 10) / 10, Math.round((y / size.current) * UNITS * 10) / 10];

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(enabled)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      cur.current = { color, width, erase, pts: at(e.x, e.y) };
      setLive({ ...cur.current });
    })
    .onUpdate((e) => {
      const s = cur.current;
      if (!s) return;
      const [x, y] = at(e.x, e.y);
      const lx = s.pts[s.pts.length - 2];
      const ly = s.pts[s.pts.length - 1];
      if (Math.abs(x - lx) + Math.abs(y - ly) < 2) return;
      s.pts.push(x, y);
      setLive({ ...s, pts: s.pts.slice() });
    })
    .onFinalize(() => {
      const s = cur.current;
      cur.current = null;
      setLive(null);
      if (s) commit([...all.current, s]);
    });

  const onLayout = (e: LayoutChangeEvent) => (size.current = e.nativeEvent.layout.width || 1);

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={onLayout} style={[s.board, { aspectRatio: 1 / ratio, backgroundColor: bg }, style]} collapsable={false}>
        {children}
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${UNITS} ${UNITS * ratio}`} preserveAspectRatio="none">
          <Done strokes={strokes} bg={bg} />
          {live ? <Path d={strokePath(live.pts)} stroke={live.erase ? bg : live.color} strokeWidth={live.width} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        </Svg>
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  board: { width: '100%', overflow: 'hidden' },
});
