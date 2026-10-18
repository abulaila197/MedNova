import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

/** Web has no Lottie player (see Wordmark.web.tsx), so the web preview pops in a still cup instead. */
export function Trophy({ size }: { size: number }) {
  const sc = useSharedValue(0);
  useEffect(() => {
    sc.value = withSequence(withTiming(1.12, { duration: 380 }), withTiming(1, { duration: 200 }));
  }, [sc]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, st]}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M12,8 L28,8 L27,19 Q20,27 13,19 Z" fill="#f5a524" />
        <Path d="M12,10 Q5,10 7,16 Q9,20 13,19 M28,10 Q35,10 33,16 Q31,20 27,19" fill="none" stroke="#f5a524" strokeWidth={2} />
        <Rect x={18} y={23} width={4} height={6} fill="#f5a524" />
        <Rect x={12} y={29} width={16} height={5} rx={1.5} fill="#3a4466" />
      </Svg>
    </Animated.View>
  );
}
