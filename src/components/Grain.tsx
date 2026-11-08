import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/state/app';

/** Fine film grain over the page, like the previews. */
export function Grain({ opacity }: { opacity?: number }) {
  const t = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: opacity ?? t.grainOpacity }]}>
      <Image source={require('@/assets/textures/grain.png')} resizeMode="repeat" style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
