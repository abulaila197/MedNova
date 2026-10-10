import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, FeGaussianBlur, Filter, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

export const STAR = 'M512 138 L619 405 L865 503 L865 520 L619 620 L512 885 L405 620 L160 520 L160 503 L405 405Z';
export const ECG =
  'M150 511 H388 Q398 511 404 499 L410 482 Q414 470 420 482 L432 506 Q436 514 446 514 H457 Q462 514 465 522 L476 548 L497 357 Q500 345 503 357 L526 640 L548 520 Q550 513 558 513 H586 Q594 513 598 504 L613 478 Q622 462 632 478 L648 506 Q652 513 660 513 H875';

// Ids come from useId, so they stay the same across re-renders and the SVG isn't rebuilt each time.
const useKey = (prefix: string) => prefix + useId().replace(/[^a-zA-Z0-9]/g, '');

/** The Pulse star, still version (header, menu). */
export function PulseStar({ width, height, light = false, glow = 0.5 }: { width: number; height: number; light?: boolean; glow?: number }) {
  const k = useKey('ps');
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

/** The Pulse star outline scaled to half-size `r` around (cx, cy), for cut-outs like the token coin's hole. */
export function starAt(cx: number, cy: number, r: number) {
  const n = STAR.match(/[\d.]+/g)!.map(Number);
  const k = r / 373.5;
  let d = '';
  for (let i = 0; i < n.length; i += 2) d += `${i ? 'L' : 'M'}${(cx + (n[i] - 512) * k).toFixed(2)} ${(cy + (n[i + 1] - 511.5) * k).toFixed(2)} `;
  return d + 'Z';
}

let coinSeq = 0;
const C = 2 * Math.PI * 10.6;

/**
 * Token coin for the game header (GH3, "Minted"): an accent-gradient coin with the Pulse star punched through,
 * inside a thin ring that fills toward the next token. `size` is the whole coin + ring diameter.
 */
export function TokenCoin({ size, progress, light = false, track }: { size: number; progress: number; light?: boolean; track: string }) {
  const k = `tc${++coinSeq}`;
  const c = light ? ['#fff1d6', '#f0a24a', '#c9692a', '#e5833a'] : ['#e9fbff', '#6fd6ff', '#2f8fc4', '#6fd6ff'];
  const disc = 'M12 4.2a7.8 7.8 0 1 1 0 15.6a7.8 7.8 0 1 1 0-15.6Z';
  const p = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size} viewBox="0.5 0.5 23 23">
      <Defs>
        <LinearGradient id={`g${k}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c[0]} />
          <Stop offset="0.5" stopColor={c[1]} />
          <Stop offset="1" stopColor={c[2]} />
        </LinearGradient>
      </Defs>
      <Circle cx={12} cy={12} r={10.6} fill="none" stroke={track} strokeWidth={1.3} />
      {p > 0 ? (
        <Circle cx={12} cy={12} r={10.6} fill="none" stroke={c[3]} strokeWidth={1.3} strokeLinecap="round" strokeDasharray={`${C * p} ${C}`} transform="rotate(-90 12 12)" />
      ) : null}
      <Path d={`${disc} ${starAt(12, 12, 5.6)}`} fill={`url(#g${k})`} fillRule="evenodd" />
      <Path d="M6.6 8.4a7 7 0 0 1 8.6-3.5" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={0.6} />
    </Svg>
  );
}
