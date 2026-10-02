import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Fades its content out towards the bottom (or right) edge, like CSS
 * mask-image: linear-gradient(#000 from, transparent to). Web uses a CSS mask; native uses MaskedView.
 */
export function Fade({ from, to = 1, horizontal = false, style, children }: { from: number; to?: number; horizontal?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (Platform.OS === 'web') {
    const g = `linear-gradient(${horizontal ? '90deg' : '180deg'}, #000 ${from * 100}%, transparent ${to * 100}%)`;
    return <View style={[style, { maskImage: g, WebkitMaskImage: g } as unknown as ViewStyle]}>{children}</View>;
  }
  return (
    <MaskedView
      style={style}
      maskElement={
        <LinearGradient
          colors={['#000', '#000', 'transparent']}
          locations={[0, from, to]}
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
