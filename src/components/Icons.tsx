import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size: number; color: string };

export const MenuIcon = ({ size, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
    <Path d="M3 6h14M3 10h14M3 14h14" />
  </Svg>
);
export const LearnIcon = ({ size, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
    <Path d="M4 5.5C7 4 10 4 12 6c2-2 5-2 8-.5V19c-3-1.5-6-1.5-8 .5-2-2-5-2-8-.5z" />
    <Path d="M12 6v13.5" />
  </Svg>
);
export const GamesIcon = ({ size, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
    <Rect x="3" y="7" width="18" height="11" rx="5" />
    <Path d="M8 10.5v4M6 12.5h4" />
    <Circle cx="15.5" cy="11.5" r="1" fill={color} />
    <Circle cx="17.5" cy="13.5" r="1" fill={color} />
  </Svg>
);
export const CommunityIcon = ({ size, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
    <Circle cx="9" cy="12" r="5.5" />
    <Circle cx="15" cy="12" r="5.5" />
  </Svg>
);
