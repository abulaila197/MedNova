import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { FAR, hexRgb } from '@/components/Calm';
import { useTheme } from '@/state/app';
import { tr } from '@/i18n';

type Stops = [number, number][];

/**
 * Fades its content out towards an edge, like CSS mask-image: linear-gradient(...), so scrolling content dissolves
 * before the dock or the screen edge. Either `from`/`to` (solid until `from`, gone by `to`) or `stops`
 * ([offset 0..1, alpha 0..1] pairs). `horizontal` fades to the right (not with `veil`); `off` drops the mask (content that fits needs none).
 * Web uses a CSS mask; phones use MaskedView with a gradient.
 *
 * `veil` (Yazan 2026-11-02, lag): for scrolling lists, top and bottom edges only. A mask over a scrolling list makes
 * Android redraw the whole list through an extra layer on every frame. The veil leaves the list alone and lays a plain
 * navy gradient over the edge. The page background is plain navy there too (calm edges, components/Calm.tsx), so the
 * content dissolves into the page. Never a copy of the background picture, never a mask (Yazan 2026-11-16: Android's
 * mask cut through to black, and a copy never lined up on every phone).
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
        {st[st.length - 1][1] === 0 ? <CalmBelow /> : null}
        {children}
        <Veil stops={st} />
      </View>
    );
  if (Platform.OS === 'web') {
    const g = tr('linear-gradient({n}, {n2})', { n: horizontal ? '90deg' : '180deg', n2: st.map(([o, a]) => `rgba(0,0,0,${a}) ${(o * 100).toFixed(2)}%`).join(', ') });
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

/** Splits the veil's stops into the bands where it shows at all, so it only covers the edges. */
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

/**
 * The still navy gradient over the faded edges: where the content is fully gone, the navy is fully drawn (the content's
 * alpha flipped). It runs out to the screen's sides (the page clips it), so it never draws a box beside a narrower list.
 */
function Veil({ stops }: { stops: Stops }) {
  const t = useTheme();
  const rgb = hexRgb(t.sky);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { left: -FAR, right: -FAR }]}>
      {bands(stops.map(([o, a]) => [o, 1 - a])).map((b, i) => (
        <LinearGradient
          key={i}
          pointerEvents="none"
          colors={b.stops.map(([, a]) => `rgba(${rgb},${a})`) as unknown as [string, string, ...string[]]}
          locations={b.stops.map(([o]) => o) as unknown as [number, number, ...number[]]}
          style={{ position: 'absolute', left: 0, right: 0, top: `${b.from * 100}%`, height: `${(b.to - b.from) * 100}%` }}
        />
      ))}
    </View>
  );
}

/**
 * Under a list that fades out at its bottom: the background stays plain navy from the list's bottom edge down to the
 * dock, under whatever sits between them (Leaderboard's own row), so the fade never ends in a navy strip over the picture.
 */
function CalmBelow() {
  const t = useTheme();
  return <View pointerEvents="none" style={{ position: 'absolute', top: '100%', height: FAR, left: -FAR, right: -FAR, backgroundColor: t.sky }} />;
}
