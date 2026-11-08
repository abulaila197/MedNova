import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

// Ornate frames (Yazan 2026-10-13: "مزخرفة", fancy). Same 100 x 100 box as Frame.tsx; the face fills radius 38.
const C = 50;
const pt = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
const deg = (a: number) => (a * 180) / Math.PI;
const TOP = -Math.PI / 2;

/** Closed polar outline r(θ). */
function polar(bump: (a: number) => number, steps = 360) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 + TOP;
    const [x, y] = pt(bump(a), a);
    d += `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return d + 'Z';
}

/** A small four-point star centred on (x, y). */
const star = (x: number, y: number, r: number, w = 0.22) =>
  `M${x},${y - r} L${x + r * w},${y - r * w} L${x + r},${y} L${x + r * w},${y + r * w} L${x},${y + r} L${x - r * w},${y + r * w} L${x - r},${y} L${x - r * w},${y - r * w} Z`;

/** One filigree curl: an S-scroll laid along the ring at angle a, mirrored by `dir`. */
function curl(a: number, r: number, dir: 1 | -1, size = 1) {
  const s = size;
  return `M0,0 c${2.2 * s * dir},${-2.6 * s} ${5.6 * s * dir},${-2.4 * s} ${6.4 * s * dir},${0.2 * s} c${0.5 * s * dir},${1.6 * s} ${-1.1 * s * dir},${2.6 * s} ${-2.4 * s * dir},${1.8 * s} c${-1 * s * dir},${-0.6 * s} ${-0.5 * s * dir},${-1.9 * s} ${0.5 * s * dir},${-1.8 * s}`;
}
function Curl({ a, r, dir, color, size = 1, w = 0.7 }: { a: number; r: number; dir: 1 | -1; color: string; size?: number; w?: number }) {
  const [x, y] = pt(r, a);
  return <Path d={curl(a, r, dir, size)} transform={`translate(${x},${y}) rotate(${deg(a) + 90})`} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" />;
}

function Beads({ r, n, color, size = 0.8, skip = [] as number[] }: { r: number; n: number; color: string; size?: number; skip?: number[] }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        if (skip.includes(i)) return null;
        const [x, y] = pt(r, TOP + (i / n) * Math.PI * 2);
        return <Circle key={i} cx={x} cy={y} r={size} fill={color} />;
      })}
    </>
  );
}

/** A faceted gem (diamond) pointing out from the ring. */
function Gem({ a, r, len, wid, id, edge }: { a: number; r: number; len: number; wid: number; id: string; edge: string }) {
  const [x, y] = pt(r, a);
  return (
    <G transform={`translate(${x},${y}) rotate(${deg(a) + 90})`}>
      <Path d={`M0,${-len} L${wid},0 L0,${len * 0.55} L${-wid},0 Z`} fill={`url(#${id})`} stroke={edge} strokeWidth={0.5} />
      <Path d={`M0,${-len} L0,${len * 0.55} M${-wid},0 L${wid},0`} stroke="#fff" strokeOpacity={0.45} strokeWidth={0.35} />
    </G>
  );
}

// ——— Nova: a violet and silver star-crown ———
export function NovaBase({ id }: { id: string }) {
  const g = `${id}b`;
  const gem = `${id}g`;
  return (
    <>
      <Defs>
        <LinearGradient id={g} x1="8" y1="8" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#f3eeff" />
          <Stop offset="0.35" stopColor="#a48bff" />
          <Stop offset="0.65" stopColor="#4a3a9e" />
          <Stop offset="1" stopColor="#4fc8ff" />
        </LinearGradient>
        <LinearGradient id={gem} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.5" stopColor="#9fe6ff" />
          <Stop offset="1" stopColor="#6a4fe0" />
        </LinearGradient>
      </Defs>
      <Circle cx={C} cy={C} r={44} fill="none" stroke="#120d33" strokeWidth={6.4} />
      <Circle cx={C} cy={C} r={44} fill="none" stroke={`url(#${g})`} strokeWidth={4.6} />
      <Circle cx={C} cy={C} r={41.6} fill="none" stroke="#e9e2ff" strokeOpacity={0.7} strokeWidth={0.45} />
      <Circle cx={C} cy={C} r={46.4} fill="none" stroke="#e9e2ff" strokeOpacity={0.7} strokeWidth={0.45} />
      {/* scrolls in each quarter */}
      {[0, 1, 2, 3].map((q) => {
        const m = TOP + Math.PI / 4 + (q * Math.PI) / 2;
        return (
          <G key={q}>
            <Curl a={m - 0.2} r={47.6} dir={1} color="#d9ccff" size={0.55} />
            <Curl a={m + 0.2} r={47.6} dir={-1} color="#d9ccff" size={0.55} />
            <Circle cx={pt(47.8, m)[0]} cy={pt(47.8, m)[1]} r={1} fill="#9fe6ff" />
          </G>
        );
      })}
      {/* compass of star gems: big at the top, then the sides */}
      {[0, 1, 2, 3].map((q) => (
        <Gem key={q} a={TOP + (q * Math.PI) / 2} r={46} len={q ? 3.6 : 5.2} wid={q ? 1.6 : 2.1} id={gem} edge="#3a2b8a" />
      ))}
      <Path d={star(...pt(44, TOP), 3.4)} fill="#ffffff" />
    </>
  );
}
export function NovaMoving({ id }: { id: string }) {
  const glow = `${id}r`;
  const [x, y] = pt(44, TOP);
  const [x2, y2] = pt(44, TOP + Math.PI);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={glow} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#e6f9ff" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#a48bff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={x} cy={y} r={6.5} fill={`url(#${glow})`} />
      <Path d={star(x, y, 3.2)} fill="#fff" />
      <Circle cx={x2} cy={y2} r={4.5} fill={`url(#${glow})`} />
      <Path d={star(x2, y2, 2)} fill="#fff" />
    </Svg>
  );
}

// ——— Pulse: crimson enamel and gold, a heart crest, an engraved heartbeat ———
const ECG_GOLD = polar((a) => {
  const t = (((a - TOP) * 4) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const k = t / 0.16;
  if (k < -3 || k > 4) return 44;
  if (k < -1) return 44;
  if (k < -0.5) return 43;
  if (k < 0.4) return 46.6;
  if (k < 1) return 42.2;
  if (k < 2.5) return 44;
  return 44 + 0.9 * Math.sin((k - 2.5) * (Math.PI / 1.5));
}, 720);
export function PulseBase({ id }: { id: string }) {
  const en = `${id}e`;
  const au = `${id}a`;
  const ht = `${id}h`;
  const [hx, hy] = pt(46.5, TOP);
  return (
    <>
      <Defs>
        <LinearGradient id={en} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#e2475a" />
          <Stop offset="0.5" stopColor="#8e1426" />
          <Stop offset="1" stopColor="#c73646" />
        </LinearGradient>
        <LinearGradient id={au} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#fff2b8" />
          <Stop offset="0.5" stopColor="#d9a43a" />
          <Stop offset="1" stopColor="#f5d376" />
        </LinearGradient>
        <LinearGradient id={ht} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ff8a96" />
          <Stop offset="1" stopColor="#a3122a" />
        </LinearGradient>
      </Defs>
      <Circle cx={C} cy={C} r={44} fill="none" stroke={`url(#${en})`} strokeWidth={5.6} />
      <Circle cx={C} cy={C} r={41.1} fill="none" stroke={`url(#${au})`} strokeWidth={0.9} />
      <Circle cx={C} cy={C} r={46.9} fill="none" stroke={`url(#${au})`} strokeWidth={0.9} />
      <Path d={ECG_GOLD} stroke={`url(#${au})`} strokeWidth={0.7} fill="none" strokeLinejoin="round" />
      <Beads r={48.6} n={36} color="#e8b64a" size={0.6} skip={[0, 1, 35]} />
      {/* gold wings either side of the heart */}
      {[1, -1].map((d) => (
        <G key={d}>
          <Curl a={TOP + d * 0.2} r={47.4} dir={d as 1 | -1} color="#f2cc68" size={0.75} w={0.9} />
          <Curl a={TOP + d * 0.42} r={47.6} dir={d as 1 | -1} color="#f2cc68" size={0.5} w={0.8} />
        </G>
      ))}
      <Path
        d={`M${hx},${hy + 3.6} C${hx - 6},${hy - 0.4} ${hx - 3.4},${hy - 5.6} ${hx},${hy - 2.4} C${hx + 3.4},${hy - 5.6} ${hx + 6},${hy - 0.4} ${hx},${hy + 3.6} Z`}
        fill={`url(#${ht})`}
        stroke="#f5d376"
        strokeWidth={0.7}
      />
      <Ellipse cx={hx - 1.5} cy={hy - 2.2} rx={1} ry={0.6} fill="#fff" fillOpacity={0.8} />
      <Path d={star(...pt(46, TOP + Math.PI), 2.4)} fill="#f5d376" />
    </>
  );
}
export function PulseMoving({ id }: { id: string }) {
  const g = `${id}s`;
  const [x, y] = pt(44, TOP + 0.9);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={g} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fff6d6" stopOpacity={1} />
          <Stop offset="1" stopColor="#ffb36b" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={x} cy={y} r={4} fill={`url(#${g})`} />
      <Circle cx={x} cy={y} r={0.9} fill="#fff" />
    </Svg>
  );
}

// ——— Helix: twin serpents of emerald and gold with pearls, winged at the top ———
export function HelixBase({ id }: { id: string }) {
  const g = `${id}g`;
  const e = `${id}e`;
  const turns = 7;
  const s1 = polar((a) => 44 + 3 * Math.sin((a - TOP) * turns));
  const s2 = polar((a) => 44 - 3 * Math.sin((a - TOP) * turns));
  const [wx, wy] = pt(47, TOP);
  const wing = (d: 1 | -1) =>
    [0, 1, 2, 3].map((i) => (
      <Path
        key={i}
        d={`M${wx + d * 1.8},${wy} q${d * (3.5 + i * 1.8)},${-1.6 + i * 0.3} ${d * (6.5 + i * 2.4)},${1.2 + i * 1.9}`}
        stroke={i % 2 ? '#e8b64a' : '#fff2b8'}
        strokeWidth={1.1 - i * 0.12}
        fill="none"
        strokeLinecap="round"
      />
    ));
  return (
    <>
      <Defs>
        <LinearGradient id={g} x1="8" y1="8" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#fff2b8" />
          <Stop offset="0.5" stopColor="#c8962e" />
          <Stop offset="1" stopColor="#f5d376" />
        </LinearGradient>
        <LinearGradient id={e} x1="8" y1="8" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#7af0c4" />
          <Stop offset="0.5" stopColor="#127a5c" />
          <Stop offset="1" stopColor="#3fd3a0" />
        </LinearGradient>
      </Defs>
      <Circle cx={C} cy={C} r={44} fill="none" stroke="#0f1a24" strokeWidth={8} strokeOpacity={0.55} />
      <Path d={s1} stroke={`url(#${e})`} strokeWidth={2.2} fill="none" />
      <Path d={s2} stroke={`url(#${g})`} strokeWidth={2.2} fill="none" />
      {/* pearls where the strands cross */}
      {Array.from({ length: turns * 2 }, (_, i) => {
        const [x, y] = pt(44, TOP + (i / (turns * 2)) * Math.PI * 2);
        return <Circle key={i} cx={x} cy={y} r={1.25} fill="#fbf6ea" stroke="#c8962e" strokeWidth={0.3} />;
      })}
      {wing(1)}
      {wing(-1)}
      <Circle cx={wx} cy={wy - 0.6} r={2.6} fill={`url(#${g})`} stroke="#8a5d12" strokeWidth={0.4} />
      <Circle cx={wx - 0.8} cy={wy - 1.4} r={0.8} fill="#fff" fillOpacity={0.85} />
    </>
  );
}

// ——— Aurora: a crown of glass petals in shifting colours ———
const HUES = ['#4fc8ff', '#7d8bff', '#b38bff', '#ff8fd0', '#ffb36b', '#ffe27a', '#6fffd0'];
export function AuroraBase() {
  return (
    <>
      <Circle cx={C} cy={C} r={43} fill="none" stroke="#0b1026" strokeWidth={5} />
      <Circle cx={C} cy={C} r={40.9} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.45} />
      <Beads r={41.9} n={44} color="#ffe9a8" size={0.45} />
    </>
  );
}
export function AuroraMoving() {
  const n = 22;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {Array.from({ length: n }, (_, i) => {
        const a = TOP + (i / n) * Math.PI * 2;
        const c = HUES[i % HUES.length];
        const [x, y] = pt(44.5, a);
        return (
          <G key={i} transform={`translate(${x},${y}) rotate(${deg(a) + 90}) scale(1.25)`}>
            {/* a glass petal with a lit edge */}
            <Path d="M0,-6.2 C3.6,-3.6 3.6,1.6 0,3.2 C-3.6,1.6 -3.6,-3.6 0,-6.2 Z" fill={c} fillOpacity={0.78} stroke="#fff" strokeOpacity={0.7} strokeWidth={0.35} />
            <Path d="M0,-5 C1.6,-3 1.4,0 0,1.6" stroke="#fff" strokeOpacity={0.75} strokeWidth={0.45} fill="none" />
          </G>
        );
      })}
    </Svg>
  );
}
export function AuroraSparkles() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {Array.from({ length: 8 }, (_, i) => {
        const [x, y] = pt(48.4, TOP + ((i + 0.5) / 8) * Math.PI * 2);
        return <Path key={i} d={star(x, y, 1.7)} fill="#ffffff" />;
      })}
    </Svg>
  );
}

// ——— Laurel's moving glow: a warm light that walks round the leaves ———
export function LaurelGlow({ id }: { id: string }) {
  const [x, y] = pt(45, TOP + Math.PI * 0.75);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fff6c8" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#ffd56b" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#ffd56b" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={x} cy={y} r={7} fill={`url(#${id})`} />
      <Path d={star(x, y, 2.2)} fill="#fffbe8" />
    </Svg>
  );
}
