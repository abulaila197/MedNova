import Svg, { Path } from 'react-native-svg';

/** The Sparks gold: the bar fill runs from the first to the second. */
export const SPARK = ['#ffe07a', '#ffb547'] as const;

/** The Sparks bolt. */
export function Bolt({ size, color = SPARK[0] }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13.5 2 5 13.4h5.6L9.8 22 19 10.3h-5.7L13.5 2Z" fill={color} />
    </Svg>
  );
}
