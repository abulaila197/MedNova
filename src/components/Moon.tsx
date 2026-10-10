import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/state/app';

/** Yazan's moon photo with a phase shadow sliding across (f = 0 full shadow, 1 full moon). */
export function Moon({ size, f, glow = true }: { size: number; f: number; glow?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', shadowColor: 'rgba(220,225,255,0.35)', shadowRadius: glow ? 9 : 0, shadowOpacity: glow ? 1 : 0 }}>
      <Image source={require('@/assets/art/moon.jpg')} style={{ width: size, height: size }} />
      <View style={{ position: 'absolute', left: -1, top: -1, width: size + 2, height: size + 2, borderRadius: size, backgroundColor: t.moonShade, transform: [{ translateX: -f * (size + 2) }] }} />
    </View>
  );
}
