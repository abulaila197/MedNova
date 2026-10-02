import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Fades its content out towards the bottom edge (CSS mask-image: linear-gradient(#000 from, transparent to)),
 * so scrolling content dissolves before the dock. `off` drops the mask (content that fits needs none). Web uses a CSS mask; native uses MaskedView.
 */
export function Fade({
  from,
  to,
  off,
  style,
  onLayout,
  children,
}: {
  from: number;
  to: number;
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
  if (Platform.OS === 'web') {
    const g = `linear-gradient(#000 ${from * 100}%, transparent ${to * 100}%)`;
    return (
      <View onLayout={onLayout} style={[style, { maskImage: g, WebkitMaskImage: g } as unknown as ViewStyle]}>
        {children}
      </View>
    );
  }
  return (
    <MaskedView style={style} onLayout={onLayout} maskElement={<LinearGradient colors={['#000', '#000', 'transparent']} locations={[0, from, to]} style={StyleSheet.absoluteFill} />}>
      {children}
    </MaskedView>
  );
}
