import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { FrameKey } from './Frame';

// A styled name box for each frame (Yazan 2026-10-25): a normal rounded box coloured inside. The 4 metal frames get
// one plain colour; the higher frames get richer colours and small end artwork that grows with the price.
type Box = { fill: string[]; ink: string; line?: string; art?: 'ecg' | 'dna' | 'dots' | 'heart' | 'leaves' | 'stars' | 'nova' | 'link' | 'gem' | 'circuit' };

const BOX: Partial<Record<FrameKey, Box>> = {
  bronze: { fill: ['#a8673a'], ink: '#fff4ea' },
  silver: { fill: ['#8a919d'], ink: '#ffffff' },
  gold: { fill: ['#e8b64a'], ink: '#3a2606' },
  platinum: { fill: ['#dfe8f3'], ink: '#1d2a44' },
  stethoscope: { fill: ['#3a4152', '#5f6880'], ink: '#ffffff', line: '#9aa3b2', art: 'ecg' },
  helix: { fill: ['#0f5b73', '#2aa5c2', '#c0469a'], ink: '#ffffff', line: '#c9f7ff', art: 'dna' },
  neuron: { fill: ['#0b2a4a', '#1c6f9a'], ink: '#e9fbff', line: '#7fe0ff', art: 'dots' },
  pulse: { fill: ['#0b1f4a', '#1b6fb0', '#0b1f4a'], ink: '#ffffff', line: '#6fd6ff', art: 'heart' },
  laurel: { fill: ['#8a5d12', '#e8b64a', '#8a5d12'], ink: '#2a1a02', line: '#fff2b8', art: 'leaves' },
  aurora: { fill: ['#3a1f7a', '#2f8fb5', '#b0469a'], ink: '#ffffff', line: '#ffe1ff', art: 'stars' },
  nova: { fill: ['#1a0f45', '#4b2a9a', '#1a0f45'], ink: '#ffffff', line: '#e9ddff', art: 'nova' },
  rounds: { fill: ['#1d2244', '#2c356e'], ink: '#ffe9a8', line: '#e8b64a' },
  inviter: { fill: ['#ff7a5c', '#f2a07e', '#3cc8e0'], ink: '#ffffff', line: '#ffe1d6', art: 'link' },
  sovereign: { fill: ['#0b0b10', '#2b2416', '#0b0b10'], ink: '#ffd36a', line: '#e8b64a', art: 'gem' },
  admin: { fill: ['#0a1838', '#123a6a', '#0a1838'], ink: '#e6fbff', line: '#5fe3ff', art: 'circuit' },
};

// Laurel sprig leaves along the stem: [x, y, angle], alternating above and below.
const LEAVES: [number, number, number][] = [
  [17, 12.6, -150],
  [16, 13.2, 150],
  [11, 11, -140],
  [10, 12, 165],
  [6, 8.4, -125],
];

function EndArt({ art, color, flip }: { art: NonNullable<Box['art']>; color: string; flip?: boolean }) {
  const t = flip ? 'translate(24,0) scale(-1,1)' : undefined;
  return (
    <Svg width={u(20)} height={u(18)} viewBox="0 0 24 20" style={flip ? s.artR : s.artL}>
      <Path transform={t} d="" />
      {art === 'ecg' ? <Path transform={t} d="M1,11 L7,11 L9,6 L12,16 L14,9 L16,11 L23,11" stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {art === 'dna' ? (
        <>
          <Path transform={t} d="M2,4 C8,4 10,16 16,16 C19,16 21,13 22,10" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <Path transform={t} d="M2,16 C8,16 10,4 16,4 C19,4 21,7 22,10" stroke="#ff9be0" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </>
      ) : null}
      {art === 'dots' ? (
        <>
          <Path transform={t} d="M3,10 L20,10 M10,10 L14,4 M10,10 L14,16" stroke={color} strokeWidth={1.1} strokeLinecap="round" />
          <Circle transform={t} cx={4} cy={10} r={2.6} fill="#ffffff" />
          <Circle transform={t} cx={14} cy={4} r={1.3} fill={color} />
          <Circle transform={t} cx={14} cy={16} r={1.3} fill={color} />
        </>
      ) : null}
      {art === 'heart' ? (
        <>
          <Path transform={t} d="M10,10 L13,10 L15,5 L17,15 L19,10 L23,10" stroke={color} strokeWidth={1.3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Path transform={t} d="M5.5,15.5 C1,12.5 1,8 3.4,7.3 C4.6,7 5.3,7.8 5.5,8.6 C5.7,7.8 6.4,7 7.6,7.3 C10,8 10,12.5 5.5,15.5 Z" fill="#ff4d6d" />
        </>
      ) : null}
      {art === 'leaves' ? (
        <>
          <Path transform={t} d="M22,13 C15,13 8,11 3,6" stroke="#5d3d06" strokeWidth={1.2} fill="none" strokeLinecap="round" />
          {LEAVES.map(([x, y, a], i) => (
            <Path key={i} transform={`${t ?? ''} translate(${x},${y}) rotate(${a})`} d="M0,0 Q3.2,-2.3 7,0 Q3.2,2.3 0,0 Z" fill="#5d3d06" />
          ))}
        </>
      ) : null}
      {art === 'stars' ? (
        <>
          <Path transform={t} d="M7,3 L8.2,8.8 L14,10 L8.2,11.2 L7,17 L5.8,11.2 L0,10 L5.8,8.8 Z" fill="#ffffff" />
          <Circle transform={t} cx={16} cy={5} r={1.2} fill={color} />
          <Circle transform={t} cx={19} cy={14} r={1} fill={color} />
        </>
      ) : null}
      {art === 'link' ? (
        <>
          <Path transform={t} d="M3,7 h7 a3,3 0 0 1 0,6 h-7 a3,3 0 0 1 0,-6 Z" stroke="#ffffff" strokeWidth={1.6} fill="none" />
          <Path transform={t} d="M10,7 h7 a3,3 0 0 1 0,6 h-7 a3,3 0 0 1 0,-6 Z" stroke="#3cc8e0" strokeWidth={1.6} fill="none" />
        </>
      ) : null}
      {art === 'gem' ? (
        <>
          <Path transform={t} d="M6,10 L10,5.5 L14,10 L10,14.5 Z" fill="#e0204a" stroke="#ffd36a" strokeWidth={0.9} />
          <Path transform={t} d="M8.2,9.2 L10,7.2" stroke="#ffffff" strokeOpacity={0.8} strokeWidth={0.8} strokeLinecap="round" />
          <Circle transform={t} cx={18} cy={10} r={1.4} fill="#ffd36a" />
          <Circle transform={t} cx={2.5} cy={10} r={1} fill="#ffd36a" />
        </>
      ) : null}
      {art === 'circuit' ? (
        <>
          <Path transform={t} d="M2,6 L8,6 L11,10 L22,10 M5,14 L9,14 L11,10" stroke={color} strokeWidth={1.1} fill="none" strokeLinejoin="round" />
          <Path transform={t} d="M2,10 L3.6,8.4 L5.2,10 L3.6,11.6 Z" fill="#ffffff" />
          <Circle transform={t} cx={2} cy={6} r={1.1} fill={color} />
          <Circle transform={t} cx={5} cy={14} r={1.1} fill={color} />
        </>
      ) : null}
      {art === 'nova' ? (
        <>
          <Circle transform={t} cx={7} cy={10} r={6.5} fill={color} fillOpacity={0.25} />
          <Path transform={t} d="M7,1 L8.5,8.5 L16,10 L8.5,11.5 L7,19 L5.5,11.5 L-2,10 L5.5,8.5 Z" fill="#ffffff" />
          <Path transform={t} d="M17,4 L17.6,6.4 L20,7 L17.6,7.6 L17,10 L16.4,7.6 L14,7 L16.4,6.4 Z" fill="#6fd6ff" />
          <Circle transform={t} cx={20} cy={15} r={1} fill="#ffffff" />
        </>
      ) : null}
    </Svg>
  );
}

// Rough glyph widths (share of the font size) for the display font, to size the text before it is drawn.
const glyph = (ch: string) => (/[WM]/.test(ch) ? 0.95 : /[iIljtf.,' ]/.test(ch) ? 0.32 : /[A-Z]/.test(ch) ? 0.7 : /[mw]/.test(ch) ? 0.85 : 0.58);

/**
 * "Dr. Name" in the box that matches the frame. Frames without a box (Normal) show plain text. `maxWidth` is the
 * widest the box may get: long names shrink so the box stays inside it and the text never reaches the end art.
 */
export function NameBox({ name, frame, size = 14, maxWidth = u(200) }: { name: string; frame: FrameKey; size?: number; maxWidth?: number }) {
  const b = BOX[frame];
  const label = `Dr. ${name}`;
  const pad = b?.art ? u(26) : b ? u(12) : 0;
  const em = [...label].reduce((w, ch) => w + glyph(ch), 0) * 1.06;
  const fs = Math.min(u(size), (maxWidth - pad * 2 - 2) / em);
  if (!b) return <Text style={[s.plain, { fontSize: fs }]} numberOfLines={1}>{label}</Text>;
  const fill = b.fill.length > 1 ? b.fill : [b.fill[0], b.fill[0]];
  return (
    <LinearGradient
      colors={fill as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.4 }}
      style={[s.box, { maxWidth }, b.line ? { borderColor: b.line, borderWidth: 1 } : null, b.art ? { paddingHorizontal: u(26) } : null]}>
      {b.art ? <EndArt art={b.art} color={b.line ?? b.ink} /> : null}
      <Text style={[s.name, { fontSize: fs, color: b.ink }]} numberOfLines={1}>
        {label}
      </Text>
      {b.art ? <EndArt art={b.art} color={b.line ?? b.ink} flip /> : null}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  plain: { fontFamily: F.display, color: '#f0f2ff' },
  box: { alignSelf: 'center', borderRadius: u(9), paddingHorizontal: u(12), paddingVertical: u(4), justifyContent: 'center' },
  name: { fontFamily: F.display, textAlign: 'center' },
  artL: { position: 'absolute', left: u(4), top: '50%', marginTop: -u(9) },
  artR: { position: 'absolute', right: u(4), top: '50%', marginTop: -u(9) },
});
