import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size: number; color: string };

export const MenuIcon = ({ size, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
    <Path d="M3 6h14M3 10h14M3 14h14" />
  </Svg>
);
/** The Nova four-point star the nav icons carry (Yazan 2026-10-26, #72 "Nova duotone"). */
const star = (cx: number, cy: number, r: number) => {
  const k = r * 0.18;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}z`;
};
// Duotone: a soft fill under a 1.7 outline, in the tab's own colour.
const SOFT = 0.22;

export const LearnIcon = ({ size, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 3.8h11.2a1.3 1.3 0 0 1 1.3 1.3v14.6H7.2A2.2 2.2 0 0 1 5 17.5V4.8a1 1 0 0 1 1-1z" fill={color} fillOpacity={SOFT} stroke="none" />
    <Path d="M5 17.5a2.2 2.2 0 0 0 2.2 2.2h11.3M5 17.5V4.8a1 1 0 0 1 1-1h11.2a1.3 1.3 0 0 1 1.3 1.3v10.4H7.2A2.2 2.2 0 0 0 5 17.5z" />
    <Path d={star(11.8, 9.8, 3.4)} fill={color} stroke="none" />
  </Svg>
);
export const GamesIcon = ({ size, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2.8" y="6.8" width="18.4" height="11" rx="5.5" fill={color} fillOpacity={SOFT} />
    <Path d="M8 10.2v4.8M5.6 12.6h4.8" strokeWidth={2} />
    <Path d={star(16.3, 12.3, 2.6)} fill={color} stroke="none" />
  </Svg>
);
export const CommunityIcon = ({ size, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="9" cy="8.6" r="3.2" fill={color} fillOpacity={SOFT} />
    <Path d="M3.2 19.2c.4-3.3 2.8-5.3 5.8-5.3s5.4 2 5.8 5.3z" fill={color} fillOpacity={SOFT} />
    <Path d="M15.4 5.7a3 3 0 1 1 0 5.9M17 14.1c2.2.5 3.6 2.3 3.9 5.1h-3.2" />
  </Svg>
);
