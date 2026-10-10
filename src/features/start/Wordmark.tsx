import LottieView from 'lottie-react-native';
import { memo, useEffect, useRef } from 'react';

/** The MedNova wordmark write-in (Lottie). Native: lottie-react-native. Web: see Wordmark.web.tsx. */
export const Wordmark = memo(function Wordmark({ width, height, play, speed = 1 }: { width: number; height: number; play: boolean; speed?: number }) {
  const ref = useRef<LottieView>(null);
  useEffect(() => {
    if (play) ref.current?.play();
  }, [play]);
  return (
    <LottieView
      ref={ref}
      source={require('@/assets/motion/mednova-wordmark.json')}
      autoPlay={false}
      loop={false}
      speed={speed}
      resizeMode="contain"
      style={{ width, height }}
    />
  );
});
