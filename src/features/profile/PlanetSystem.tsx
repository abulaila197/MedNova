import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { Feather, useSvgId } from '@/features/community/fx';
import { Glyph } from '@/features/games/Glyph';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import type { Mode } from '@/theme/tokens';

const PLANET = {
  dark: require('@/assets/art/planet-dark.jpg'),
  light: require('@/assets/art/planet-light.jpg'),
};

// Page colours from the locked preview (d-/l-profile, .sys / .mn / .me).
const C = {
  dark: {
    orbit: 'rgba(201,184,255,0.3)',
    bg: ['#3b4180', '#171b3a', '#0a0c1e'],
    mid: 0.58,
    edge: 'rgba(255,255,255,0.14)',
    shadow: (k: number) => `inset ${-3 * k}px ${-4 * k}px ${8 * k}px 0px rgba(0,0,0,0.5), 0px ${6 * k}px ${14 * k}px ${-6 * k}px rgba(0,0,0,0.9)`,
    blend: 'screen' as const,
  },
  light: {
    orbit: 'rgba(184,116,31,0.3)',
    bg: ['#ffffff', '#f2ece0', '#d9cfbb'],
    mid: 0.55,
    edge: 'rgba(40,36,28,0.12)',
    shadow: (k: number) => `0px 0px ${22 * k}px ${-4 * k}px rgba(229,131,58,0.6)`,
    blend: 'multiply' as const,
  },
};

// The 8 game moons: box in the 282 x 190 system (left/top of the box), diameter, and whether it sits behind the planet.
const SYS_TOP = 98;
const MOONS: { k: string; x: number; y: number; d: number; back?: boolean }[] = [
  { k: 'case-files-unsolved', x: 27, y: 191, d: 23, back: true },
  { k: 'the-silent-artist', x: 79, y: 159, d: 22, back: true },
  { k: 'the-wheels-of-chaos', x: 161, y: 145, d: 20, back: true },
  { k: 'nova-crossword', x: 225, y: 155, d: 19, back: true },
  { k: 'the-diagnostic-pursuit', x: 224, y: 175, d: 38 },
  { k: 'nova-medicordle', x: 176, y: 210, d: 33 },
  { k: 'the-streak-master', x: 97, y: 227, d: 29 },
  { k: 'the-riddler', x: 35, y: 219, d: 26 },
];

function GameMoon({ k, x, y, d, back, mode }: { k: string; x: number; y: number; d: number; back?: boolean; mode: Mode }) {
  const p = C[mode];
  const id = useSvgId('pm');
  return (
    <View
      style={[
        s.moon,
        { left: u(x), top: u(y - SYS_TOP), width: u(d), height: u(d), borderRadius: u(d / 2), boxShadow: p.shadow(u(1)) },
      ]}
    >
      <Svg width={u(d)} height={u(d)} viewBox={`0 0 ${d} ${d}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx={0.34 * d} cy={0.28 * d} r={0.9767 * d} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={p.bg[0]} />
            <Stop offset={p.mid} stopColor={p.bg[1]} />
            <Stop offset="1" stopColor={p.bg[2]} />
          </RadialGradient>
        </Defs>
        <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#${id})`} />
        <Circle cx={d / 2} cy={d / 2} r={d / 2 - 0.5} fill="none" stroke={p.edge} strokeWidth={1} />
      </Svg>
      <View style={s.center} pointerEvents="none">
        <Glyph k={k} mode={mode} px={u(0.58 * (d - 2))} id={`${id}-${k}`} />
      </View>
      {/* .back { filter: brightness(.6) }: a 40% black veil over the moon */}
      {back ? <View style={[s.center, { borderRadius: u(d / 2), backgroundColor: 'rgba(0,0,0,0.4)' }]} pointerEvents="none" /> : null}
    </View>
  );
}

/** Your planet with the 8 games orbiting as glyph moons (behind ones dimmed), 282 x 190 design px. */
export function PlanetSystem() {
  const t = useTheme();
  const p = C[t.mode];
  const back = MOONS.filter((m) => m.back);
  const front = MOONS.filter((m) => !m.back);
  return (
    <View style={s.sys}>
      {/* the orbit: drawn in a 282 x 200 viewBox fitted (meet) into the 190 tall box, as in the preview */}
      <Svg width={u(282)} height={u(190)} viewBox="0 0 282 200" style={StyleSheet.absoluteFill}>
        <Ellipse cx={141} cy={100} rx={108} ry={40} fill="none" stroke={p.orbit} strokeWidth={1} transform="rotate(-10 141 100)" />
      </Svg>
      {back.map((m) => (
        <GameMoon key={m.k} {...m} mode={t.mode} />
      ))}
      {/* .me: 104 px planet, feathered radial mask (circle, #000 56% -> transparent 72%, farthest corner) */}
      <View style={[s.me, { mixBlendMode: p.blend }]} pointerEvents="none">
        <Feather
          source={PLANET[t.mode]}
          box={{ w: 104, h: 104 }}
          place={{ x: -26, y: -26, w: 156, h: 156 }}
          ellipse={{ cx: 52, cy: 52, rx: 52 * Math.SQRT2, ry: 52 * Math.SQRT2 }}
          stops={[[0, 1], [0.56, 1], [0.72, 0]]}
        />
      </View>
      {front.map((m) => (
        <GameMoon key={m.k} {...m} mode={t.mode} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  sys: { height: u(190), marginHorizontal: u(-16) },
  moon: { position: 'absolute' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  me: { position: 'absolute', left: u(89), top: u(141 - SYS_TOP), width: u(104), height: u(104) },
});
