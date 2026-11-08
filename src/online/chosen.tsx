import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Text } from '@/components/AppText';

import { u } from '@/theme/scale';

/**
 * Your chosen answer while it waits for the question to end (Yazan 2026-11-02): one look in every online answer
 * game, so something clearly changes when you tap. A thick glowing ring here, a tick on its corner (ChosenTick),
 * and the other answers dim.
 */
const RING = '#6fd6ff';
export const CHOSEN: ViewStyle = {
  borderColor: RING,
  borderWidth: 3,
  shadowColor: RING,
  shadowOpacity: 0.75,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
};

/** The tick on the chosen answer's top-left corner (the right corner holds the faces at the reveal). */
export function ChosenTick() {
  return (
    <Animated.View entering={ZoomIn.duration(200)} pointerEvents="none" style={s.tick}>
      <Text style={s.t}>✓</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  tick: { position: 'absolute', top: -u(7), left: -u(5), width: u(20), height: u(20), borderRadius: u(10), backgroundColor: RING, borderWidth: 2, borderColor: '#0d1738', alignItems: 'center', justifyContent: 'center' },
  t: { color: '#0b0b26', fontSize: u(11), lineHeight: u(13), fontWeight: '900' },
});

