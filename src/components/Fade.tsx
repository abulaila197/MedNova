import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { Backdrop } from '@/components/Backdrop';

type Stops = [number, number][];

/**
 * Fades its content out towards an edge, like CSS mask-image: linear-gradient(...), so scrolling content dissolves
 * before the dock or the screen edge. Either `from`/`to` (solid until `from`, gone by `to`) or `stops`
 * ([offset 0..1, alpha 0..1] pairs). `horizontal` fades to the right; `off` drops the mask (content that fits needs none).
 * Web uses a CSS mask; phones use MaskedView with a gradient.
 *
 * `veil` (Yazan 2026-11-02, lag): for scrolling pages. A mask over a scrolling list makes Android redraw the whole
 * list through an extra layer on every frame. The veil leaves the list alone and lays a still copy of the page
 * backdrop over the edge instead, faded in by a gradient, so the content seems to dissolve into the same backdrop.
 */
export function Fade({
  from = 1,
  to = 1,
  stops,
  horizontal = false,
  off,
  veil,
  style,
  onLayout,
  children,
}: {
  from?: number;
  to?: number;
  stops?: Stops;
  horizontal?: boolean;
  off?: boolean;
  veil?: boolean;
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  if (off)
    return (
      <View onLayout={onLayout} style={style}>
        {children}
      </View>
    );
  const st: Stops = stops ?? [
    [0, 1],
    [from, 1],
    [to, 0],
  ];
  if (veil)
    return (
      <View onLayout={onLayout} style={style}>
        {children}
        <Veil stops={st} horizontal={horizontal} />
      </View>
    );
  if (Platform.OS === 'web') {
    const g = `linear-gradient(${horizontal ? '90deg' : '180deg'}, ${st.map(([o, a]) => `rgba(0,0,0,${a}) ${(o * 100).toFixed(2)}%`).join(', ')})`;
    return (
      <View onLayout={onLayout} style={[style, { maskImage: g, WebkitMaskImage: g } as unknown as ViewStyle]}>
        {children}
      </View>
    );
  }
  return (
    <MaskedView
      style={style}
      // #1 (Yazan 2026-10-31): the default software mode drew black while a page faded out (leaving a Learn book).
      androidRenderingMode="hardware"
      onLayout={onLayout}
      maskElement={
        <LinearGradient
          colors={st.map(([, a]) => `rgba(0,0,0,${a})`) as unknown as [string, string, ...string[]]}
          locations={st.map(([o]) => o) as unknown as [number, number, ...number[]]}
          start={{ x: 0, y: 0 }}
          end={horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      {children}
    </MaskedView>
  );
}

/** Splits flipped stops into the bands where the backdrop shows at all, so the veil only covers the edges. */
function bands(inv: Stops): { from: number; to: number; stops: Stops }[] {
  const out: { from: number; to: number; stops: Stops }[] = [];
  let cur: Stops = [];
  inv.forEach(([o, a], i) => {
    const prev = inv[i - 1];
    const next = inv[i + 1];
    const on = a > 0 || (next && next[1] > 0) || (prev && prev[1] > 0);
    if (on) cur.push([o, a]);
    if ((!on || i === inv.length - 1) && cur.length > 1) {
      const from = cur[0][0], to = cur[cur.length - 1][0];
      if (to > from) out.push({ from, to, stops: cur.map(([x, y]) => [(x - from) / (to - from), y]) });
    }
    if (!on) cur = [];
  });
  return out;
}

/** The still backdrop copy over the faded edges: see `veil` above. Nothing in it moves while the list scrolls. */
function Veil({ stops, horizontal }: { stops: Stops; horizontal: boolean }) {
  const ref = useRef<View>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Where the content is fully gone the backdrop is fully drawn: the veil's alpha is the content's alpha flipped.
  const inv: Stops = stops.map(([o, a]) => [o, 1 - a]);
  return (
    <View
      ref={ref}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={() => ref.current?.measureInWindow((x, y, w, h) => setBox((o) => (o && o.x === x && o.y === y && o.w === w && o.h === h ? o : { x, y, w, h })))}>
      {box
        ? bands(inv).map((b, i) => {
            const pos: ViewStyle = horizontal
              ? { position: 'absolute', top: 0, bottom: 0, left: b.from * box.w, width: (b.to - b.from) * box.w }
              : { position: 'absolute', left: 0, right: 0, top: b.from * box.h, height: (b.to - b.from) * box.h };
            const art = (
              <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
                <View style={{ position: 'absolute', left: -(box.x + (horizontal ? b.from * box.w : 0)), top: -(box.y + (horizontal ? 0 : b.from * box.h)) }}>
                  <Backdrop />
                </View>
              </View>
            );
            if (Platform.OS === 'web') {
              const g = `linear-gradient(${horizontal ? '90deg' : '180deg'}, ${b.stops.map(([o, a]) => `rgba(0,0,0,${a}) ${(o * 100).toFixed(2)}%`).join(', ')})`;
              return <View key={i} style={[pos, { maskImage: g, WebkitMaskImage: g } as unknown as ViewStyle]}>{art}</View>;
            }
            return (
              <MaskedView
                key={i}
                style={pos}
                androidRenderingMode="hardware"
                maskElement={
                  <LinearGradient
                    colors={b.stops.map(([, a]) => `rgba(0,0,0,${a})`) as unknown as [string, string, ...string[]]}
                    locations={b.stops.map(([o]) => o) as unknown as [number, number, ...number[]]}
                    start={{ x: 0, y: 0 }}
                    end={horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                }>
                {art}
              </MaskedView>
            );
          })
        : null}
    </View>
  );
}
