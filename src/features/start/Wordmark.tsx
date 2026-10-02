import LottieView from 'lottie-react-native';
import { memo, useEffect, useRef } from 'react';

/** The MedNova wordmark write-in (Lottie). Native: lottie-react-native. Web: see Wordmark.web.tsx. */
export const Wordmark = memo(function Wordmark({ width, height, play }: { width: number; height: number; play: boolean }) {
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
      resizeMode="contain"
      style={{ width, height }}
    />
  );
});
