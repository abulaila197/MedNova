import Svg, { ClipPath, Defs, FeGaussianBlur, Filter, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

export const STAR = 'M512 138 L619 405 L865 503 L865 520 L619 620 L512 885 L405 620 L160 520 L160 503 L405 405Z';
export const ECG =
  'M150 511 H388 Q398 511 404 499 L410 482 Q414 470 420 482 L432 506 Q436 514 446 514 H457 Q462 514 465 522 L476 548 L497 357 Q500 345 503 357 L526 640 L548 520 Q550 513 558 513 H586 Q594 513 598 504 L613 478 Q622 462 632 478 L648 506 Q652 513 660 513 H875';

let seq = 0;

/** The Pulse star, still version (header, menu). */
export function PulseStar({ width, height, light = false, glow = 0.5 }: { width: number; height: number; light?: boolean; glow?: number }) {
  const k = `ps${++seq}`;
  const c = light ? ['#fff1d6', '#f0a24a', '#d9772c', '#e5833a'] : ['#d8f6ff', '#6fd6ff', '#3aa6dc', '#6fd6ff'];
  return (
    <Svg width={width} height={height} viewBox="120 100 784 824" style={{ overflow: 'visible' }}>
      <Defs>
        <LinearGradient id={`f${k}`} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <Stop offset="0" stopColor={c[0]} />
          <Stop offset="0.42" stopColor={c[1]} />
          <Stop offset="1" stopColor={c[2]} />
        </LinearGradient>
        <RadialGradient id={`h${k}`} cx="0.3" cy="0.25" r="0.55">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
        <Filter id={`g${k}`} x="-60%" y="-60%" width="220%" height="220%">
          <FeGaussianBlur stdDeviation="38" />
        </Filter>
        <ClipPath id={`c${k}`}>
          <Path d={STAR} />
        </ClipPath>
      </Defs>
      <Path d={STAR} fill={c[3]} opacity={glow} filter={`url(#g${k})`} />
      <Path d={STAR} fill={`url(#f${k})`} />
      <Path d={STAR} fill={`url(#h${k})`} />
      <Path d="M160 503 L405 405 L512 138 L619 405" fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={5} strokeLinejoin="round" clipPath={`url(#c${k})`} />
      <G clipPath={`url(#c${k})`}>
        <Path d={ECG} fill="none" stroke="#070a1c" strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}
