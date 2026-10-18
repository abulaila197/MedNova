import LottieView from 'lottie-react-native';

/** Yazan's trophy Lottie (115 KB, all vector, 2.4 s), played once. Web: see Trophy.web.tsx. */
export function Trophy({ size }: { size: number }) {
  return <LottieView source={require('@/assets/motion/trophy.json')} autoPlay loop={false} style={{ width: size, height: size }} />;
}
