import { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';

import type { Mode } from '@/theme/tokens';

// The raised game symbols on the ring planets (24-unit icons, gradient stroke, three drop shadows).
type Prim = { p?: string; c?: [number, number, number]; r?: [number, number, number, number, number]; fill?: boolean; noStroke?: boolean };
const GLY: Record<string, Prim[]> = {
  'the-diagnostic-pursuit': [{ p: 'M4 15a8 8 0 1 1 16 0' }, { p: 'M12 15l4-5' }, { c: [12, 15, 1.2] }],
  'the-wheels-of-chaos': [{ c: [12, 12, 8] }, { p: 'M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7' }, { c: [12, 12, 2] }],
  'nova-crossword': [{ r: [4, 4, 16, 16, 1.5] }, { p: 'M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16' }, { p: 'M4.5 4.5h4.5v4.5H4.5zM15 15h4.5v4.5H15z', fill: true, noStroke: true }],
  'nova-medicordle': [{ r: [2.5, 9, 5, 6, 1] }, { r: [9.5, 9, 5, 6, 1] }, { r: [16.5, 9, 5, 6, 1] }, { p: 'M12 4v3M10.5 5.5h3' }],
  'the-silent-artist': [{ p: 'M4 20l3-1 11-11-2-2L5 17z' }, { p: 'M14 6l2 2' }, { p: 'M15 20h5' }],
  'the-riddler': [{ p: 'M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.2-1.5 2.4' }, { c: [12, 17.5, 0.9], fill: true }, { c: [12, 12, 9] }],
  'the-streak-master': [{ c: [11, 13, 7] }, { c: [11, 13, 3.5] }, { c: [11, 13, 0.8], fill: true }, { p: 'M11 13l9-9M16.5 4H20v3.5' }],
  'case-files-unsolved': [{ c: [10, 10, 5.5] }, { p: 'M14 14l6 6' }],
};

function Shapes({ k, paint }: { k: string; paint: string }) {
  return (
    <>
      {GLY[k].map((g, i) => {
        const fill = g.fill ? paint : 'none';
        const stroke = g.noStroke ? 'none' : paint;
        if (g.p) return <Path key={i} d={g.p} fill={fill} stroke={stroke} />;
        if (g.c) return <Circle key={i} cx={g.c[0]} cy={g.c[1]} r={g.c[2]} fill={fill} stroke={stroke} />;
        const r = g.r!;
        return <Rect key={i} x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={r[4]} fill={fill} stroke={stroke} />;
      })}
    </>
  );
}

const SH = {
  dark: { top: '#ffffff', bot: '#7f8fe8', s1: 'rgba(0,0,0,0.65)', s1y: 1.2, s2: 'rgba(255,255,255,0.35)', s3: 'rgba(0,0,0,0.5)' },
  light: { top: '#fff3c8', bot: '#b06a14', s1: 'rgba(120,80,20,0.45)', s1y: 1, s2: '#ffffff', s3: 'rgba(120,80,20,0.3)' },
};

/** `px` = rendered glyph size in device px; shadows are given in px like the CSS drop-shadows. */
export function Glyph({ k, mode, px, id }: { k: string; mode: Mode; px: number; id: string }) {
  const c = SH[mode];
  const unit = 24 / Math.max(px, 1); // icon units per device px
  const gid = `gg-${id}`;
  const line = { strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.top} />
          <Stop offset="1" stopColor={c.bot} />
        </LinearGradient>
      </Defs>
      {/* drop-shadow(0 2px 3px) approximated by a soft offset copy */}
      <G {...line} transform={`translate(0 ${2 * unit})`} opacity={0.45} strokeWidth={1.9 + 2 * unit}>
        <Shapes k={k} paint={c.s3} />
      </G>
      <G {...line} transform={`translate(0 ${-0.6 * unit})`}>
        <Shapes k={k} paint={c.s2} />
      </G>
      <G {...line} transform={`translate(0 ${c.s1y * unit})`}>
        <Shapes k={k} paint={c.s1} />
      </G>
      <G {...line}>
        <Shapes k={k} paint={`url(#${gid})`} />
      </G>
    </Svg>
  );
}
