import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fade } from './Fade';

type Edges = { left?: number; right?: number; top?: number; bottom?: number };

/**
 * A picture whose edges dissolve into whatever sits behind it (Yazan's feathered-art rule).
 *
 * The edges are real transparency (masks), never a gradient painted in a background colour: a painted fade only
 * hides the edge when the page behind is exactly that colour, and over a glow, grain or texture it leaves a hard
 * line where the box ends. `edges` gives how far in (0..1 of the box) each side takes to fade fully in.
 */
export function FeatherArt({
  source,
  style,
  opacity = 1,
  edges = {},
  position = 'center',
}: {
  source: ImageSource | number;
  style?: StyleProp<ViewStyle>;
  opacity?: number;
  edges?: Edges;
  position?: string;
}) {
  const { left = 0, right = 0, top = 0, bottom = 0 } = edges;
  const across: [number, number][] = [
    [0, left ? 0 : 1],
    [Math.max(left, 0.001), 1],
    [Math.min(1 - right, 0.999), 1],
    [1, right ? 0 : 1],
  ];
  const down: [number, number][] = [
    [0, top ? 0 : 1],
    [Math.max(top, 0.001), 1],
    [Math.min(1 - bottom, 0.999), 1],
    [1, bottom ? 0 : 1],
  ];
  return (
    <View style={style} pointerEvents="none">
      <Fade stops={down} style={StyleSheet.absoluteFill}>
        <Fade stops={across} horizontal style={StyleSheet.absoluteFill}>
          <Image source={source} style={[StyleSheet.absoluteFill, { opacity }]} contentFit="cover" contentPosition={position as never} />
        </Fade>
      </Fade>
    </View>
  );
}
