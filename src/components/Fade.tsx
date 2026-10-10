import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

type Stops = [number, number][];

/**
 * Fades its content out towards an edge, like CSS mask-image: linear-gradient(...), so scrolling content dissolves
 * before the dock or the screen edge. Either `from`/`to` (solid until `from`, gone by `to`) or `stops`
 * ([offset 0..1, alpha 0..1] pairs). `horizontal` fades to the right; `off` drops the mask (content that fits needs none).
 * Web uses a CSS mask; phones use MaskedView with a gradient.
 */
export function Fade({
  from = 1,
  to = 1,
  stops,
  horizontal = false,
  off,
  style,
  onLayout,
  children,
}: {
  from?: number;
  to?: number;
  stops?: Stops;
  horizontal?: boolean;
  off?: boolean;
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
