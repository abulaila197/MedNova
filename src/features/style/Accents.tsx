import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import type { FrameKey } from './Frame';

// List #38 (Yazan 2026-10-25): every frame gets an emblem on its top line and art in the lower middle, never over the
// face (radius 38 in the 100 box). The 4 metal frames share one design (star + winged medallion); every other frame has
// its own artwork, bigger and richer the higher its price. Drawn in a box that spills PAD past the frame on each side.
export const PAD = 14;

const STAR = (cx: number, cy: number, r: number, w = 0.32) => {
  const i = r * w;
  return `M${cx},${cy - r} L${cx + i},${cy - i} L${cx + r},${cy} L${cx + i},${cy + i} L${cx},${cy + r} L${cx - i},${cy + i} L${cx - r},${cy} L${cx - i},${cy - i} Z`;
};

function Grad({ id, c }: { id: string; c: [string, string, string] }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={c[0]} />
      <Stop offset="0.55" stopColor={c[1]} />
      <Stop offset="1" stopColor={c[2]} />
    </LinearGradient>
  );
}

const METALS: Partial<Record<FrameKey, [string, string, string]>> = {
  bronze: ['#f0b98a', '#c98a56', '#6b3a1d'],
  silver: ['#eef1f5', '#a9afba', '#555b66'],
  gold: ['#fff2b8', '#e8b64a', '#8a5d12'],
  platinum: ['#ffffff', '#dfe8f3', '#8e9db2'],
};

/** Bronze, silver, gold, platinum: our four-point star on a tab, a medallion between two small wings. */
function Metal({ id, c }: { id: string; c: [string, string, string] }) {
  const g = `url(#${id})`;
  const dk = c[2];
  return (
    <G>
      <Defs><Grad id={id} c={c} /></Defs>
      <Path d="M44,6.8 Q50,3.6 56,6.8 L54.5,10.5 Q50,8.8 45.5,10.5 Z" fill={dk} />
      <Path d={STAR(50, 4.6, 6.4)} fill={g} stroke={dk} strokeWidth={0.6} />
      <Circle cx={50} cy={4.6} r={1.3} fill="#fff" fillOpacity={0.8} />
      <Path d="M43,93 Q35,93.5 29.5,89 Q34,96.5 43,96.4 Z M43,95 Q36,97.5 31.5,95.5 Q36.5,99.8 43.5,97.6 Z" fill={g} stroke={dk} strokeWidth={0.5} />
      <Path d="M57,93 Q65,93.5 70.5,89 Q66,96.5 57,96.4 Z M57,95 Q64,97.5 68.5,95.5 Q63.5,99.8 56.5,97.6 Z" fill={g} stroke={dk} strokeWidth={0.5} />
      <Circle cx={50} cy={94.2} r={6} fill={g} stroke={dk} strokeWidth={0.8} />
      <Circle cx={50} cy={94.2} r={3.9} fill="none" stroke={dk} strokeOpacity={0.5} strokeWidth={0.5} />
      <Path d={STAR(50, 94.2, 3)} fill="#fff" fillOpacity={0.85} />
    </G>
  );
}

/** Stethoscope (500): a small heart chest piece below. */
function Stethoscope({ id }: { id: string }) {
  return (
    <G>
      <Defs><Grad id={id} c={['#f2f5fa', '#a9b2c2', '#4a5266']} /></Defs>
      <Path d="M50,101 C42,95 41,89.5 45,88 C47.5,87 49.3,88.5 50,90 C50.7,88.5 52.5,87 55,88 C59,89.5 58,95 50,101 Z" fill={`url(#${id})`} stroke="#4a5266" strokeWidth={0.8} />
      <Path d="M47,90.5 Q45.5,92 46.5,94" stroke="#fff" strokeOpacity={0.7} strokeWidth={0.8} fill="none" strokeLinecap="round" />
    </G>
  );
}

/** Helix (800): two DNA strands twisting into a bow below and a small twist on top. */
function Helix({ id }: { id: string }) {
  const rungs = (x0: number, x1: number, y: number, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
      const h = Math.sin(((i + 0.5) / n) * Math.PI * 2) * 3.2;
      return <Path key={i} d={`M${x},${y - h} L${x},${y + h}`} stroke="#c9f7ff" strokeOpacity={0.7} strokeWidth={0.6} />;
    });
  return (
    <G>
      <Defs><Grad id={id} c={['#c9f7ff', '#5fd0e8', '#1d5f7a']} /></Defs>
      {/* top twist */}
      <Path d="M40,6 C43,1 47,11 50,6 C53,1 57,11 60,6" stroke={`url(#${id})`} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M40,6 C43,11 47,1 50,6 C53,11 57,1 60,6" stroke="#ff7ad9" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Circle cx={50} cy={6} r={1.6} fill="#fff" />
      {/* bottom strands */}
      {rungs(30, 70, 94, 10)}
      <Path d="M28,94 C33,88 37,100 42,94 C47,88 53,100 58,94 C63,88 67,100 72,94" stroke={`url(#${id})`} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d="M28,94 C33,100 37,88 42,94 C47,100 53,88 58,94 C63,100 67,88 72,94" stroke="#ff7ad9" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Circle cx={28} cy={94} r={1.8} fill="#c9f7ff" />
      <Circle cx={72} cy={94} r={1.8} fill="#ff7ad9" />
    </G>
  );
}

/** Neuron (850): a glowing cell body with dendrites on top, a burst of synapse sparks below. */
function Neuron({ id }: { id: string }) {
  const dendrite = (a: number, len: number) => {
    const x = 50 + Math.cos(a) * len;
    const y = 3 + Math.sin(a) * len;
    return `M50,3 Q${50 + Math.cos(a) * len * 0.5 + 1},${3 + Math.sin(a) * len * 0.5 - 1} ${x},${y}`;
  };
  return (
    <G>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.5" stopColor="#7fe0ff" />
          <Stop offset="1" stopColor="#7fe0ff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {[-2.6, -2.1, -1.0, -0.5, 0.2, 2.9, 3.4].map((a, i) => (
        <Path key={i} d={dendrite(a, 9 + (i % 3) * 2)} stroke="#7fe0ff" strokeWidth={0.9} fill="none" strokeLinecap="round" />
      ))}
      <Circle cx={50} cy={3} r={7} fill={`url(#${id})`} />
      <Circle cx={50} cy={3} r={3.2} fill="#d9f7ff" stroke="#1b4f6e" strokeWidth={0.5} />
      {/* synapse burst below */}
      <Circle cx={50} cy={96} r={9} fill={`url(#${id})`} />
      {Array.from({ length: 10 }, (_, i) => {
        const a = Math.PI * (0.05 + (i / 9) * 0.9);
        const r0 = 5;
        const r1 = 9 + (i % 2) * 4;
        return <Path key={i} d={`M${50 + Math.cos(a) * r0},${96 + Math.sin(a) * r0 * 0.6} L${50 + Math.cos(a) * r1},${96 + Math.sin(a) * r1 * 0.6}`} stroke="#c9f4ff" strokeWidth={0.8} strokeLinecap="round" />;
      })}
      <Path d={STAR(50, 96, 4.2)} fill="#ffffff" />
      <Circle cx={36} cy={93} r={1.2} fill="#c9f4ff" />
      <Circle cx={64} cy={93} r={1.2} fill="#c9f4ff" />
    </G>
  );
}

/** Pulse (900): our Pulse star with an ECG line through it on top, a glowing heart on a heartbeat line below. */
function Pulse({ id }: { id: string }) {
  return (
    <G>
      <Defs><Grad id={id} c={['#e9fbff', '#6fd6ff', '#164a7a']} /></Defs>
      <Path d={STAR(50, 2.5, 9, 0.26)} fill={`url(#${id})`} stroke="#164a7a" strokeWidth={0.6} />
      <Path d="M33,3 L44,3 L46,0 L48.5,7.5 L51.5,-3 L54,3 L67,3" stroke="#0b1026" strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M33,3 L44,3 L46,0 L48.5,7.5 L51.5,-3 L54,3 L67,3" stroke="#c9f4ff" strokeWidth={0.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {/* below */}
      <Path d="M22,95 L38,95 L41,90 L44,99 L47,95 L53,95 L56,91 L59,98 L62,95 L78,95" stroke="#6fd6ff" strokeWidth={1.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M50,104 C40,97 39.5,90 44.5,88.2 C47.5,87.2 49.2,89 50,90.6 C50.8,89 52.5,87.2 55.5,88.2 C60.5,90 60,97 50,104 Z" fill="#ff4d6d" stroke="#8a1830" strokeWidth={0.8} />
      <Path d="M46,90.6 Q44.4,92.4 45.6,94.6" stroke="#fff" strokeOpacity={0.75} strokeWidth={0.9} fill="none" strokeLinecap="round" />
    </G>
  );
}

/** Laurel (1000): a gold crown with ruby set on top (the laurel ring keeps its red ribbon below, now with tails). */
function Laurel({ id }: { id: string }) {
  return (
    <G>
      <Defs><Grad id={id} c={['#fff2b8', '#f2cc68', '#8a5d12']} /></Defs>
      <Path d="M36,10 L34,-4 L42,3 L50,-8 L58,3 L66,-4 L64,10 Z" fill={`url(#${id})`} stroke="#8a5d12" strokeWidth={0.8} strokeLinejoin="round" />
      <Path d="M36,10 L64,10 L64,13 L36,13 Z" fill="#c8962e" stroke="#8a5d12" strokeWidth={0.6} />
      <Circle cx={34} cy={-4} r={1.6} fill="#fff6d6" />
      <Circle cx={66} cy={-4} r={1.6} fill="#fff6d6" />
      <Circle cx={50} cy={-8} r={2} fill="#fff6d6" />
      <Path d="M50,0.5 L53,4.5 L50,8.5 L47,4.5 Z" fill="#c73646" stroke="#6b1622" strokeWidth={0.5} />
      <Circle cx={42} cy={8.6} r={1.2} fill="#3fa7ff" />
      <Circle cx={58} cy={8.6} r={1.2} fill="#3fa7ff" />
      {/* ribbon tails under the existing bow */}
      <Path d="M46,96 L40,107 L44,106 L46,110 L50,97 Z" fill="#a02a38" />
      <Path d="M54,96 L60,107 L56,106 L54,110 L50,97 Z" fill="#a02a38" />
    </G>
  );
}

/** Aurora (1100): a crescent moon in a light flare on top, flowing aurora waves below. */
function Aurora({ id }: { id: string }) {
  const g = `${id}w`;
  return (
    <G>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffe1ff" />
          <Stop offset="0.45" stopColor="#c49bff" stopOpacity={0.8} />
          <Stop offset="1" stopColor="#c49bff" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={g} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#9ff6ff" stopOpacity={0} />
          <Stop offset="0.3" stopColor="#9ff6ff" />
          <Stop offset="0.6" stopColor="#c49bff" />
          <Stop offset="1" stopColor="#ff8ad8" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={50} cy={1} rx={16} ry={11} fill={`url(#${id})`} />
      <Path d="M54.5,-5.5 A8,8 0 1 0 54.5,8.5 A6.4,6.4 0 1 1 54.5,-5.5 Z" fill="#fff6ff" stroke="#c49bff" strokeWidth={0.6} />
      <Path d={STAR(38, -2, 2.2)} fill="#fff" />
      <Path d={STAR(63, 5, 1.6)} fill="#fff" />
      {/* aurora waves */}
      <Path d="M12,90 C25,80 35,104 50,94 C65,84 75,104 88,90" stroke={`url(#${g})`} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <Path d="M16,97 C28,88 38,108 50,100 C62,92 72,108 84,97" stroke={`url(#${g})`} strokeWidth={2} fill="none" strokeLinecap="round" strokeOpacity={0.75} />
      <Path d="M20,103 C31,96 40,111 50,105 C60,99 69,111 80,103" stroke={`url(#${g})`} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeOpacity={0.5} />
      <Path d={STAR(50, 96, 3.2)} fill="#fff" />
    </G>
  );
}

/** Nova (1200): a big supernova burst on top, a comet sweeping a planet ring below. The biggest art. */
function Nova({ id }: { id: string }) {
  const tail = `${id}t`;
  return (
    <G>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.35" stopColor="#e9ddff" />
          <Stop offset="0.7" stopColor="#a48bff" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#a48bff" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={tail} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6fd6ff" stopOpacity={0} />
          <Stop offset="1" stopColor="#e9ddff" />
        </LinearGradient>
      </Defs>
      <Circle cx={50} cy={0} r={14} fill={`url(#${id})`} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r1 = i % 2 ? 9 : 14;
        return <Path key={i} d={`M${50 + Math.cos(a) * 3},${Math.sin(a) * 3} L${50 + Math.cos(a) * r1},${Math.sin(a) * r1}`} stroke="#e9ddff" strokeWidth={i % 2 ? 0.6 : 1} strokeLinecap="round" />;
      })}
      <Path d={STAR(50, 0, 9, 0.2)} fill="#ffffff" />
      <Path d={STAR(50, 0, 5, 0.2)} fill="#6fd6ff" transform="rotate(45 50 0)" />
      <Path d={STAR(34, 5, 2)} fill="#e9ddff" />
      <Path d={STAR(67, -3, 2.4)} fill="#e9ddff" />
      {/* planet ring and comet below */}
      <Ellipse cx={50} cy={97} rx={26} ry={5.5} fill="none" stroke="#a48bff" strokeWidth={1.4} />
      <Ellipse cx={50} cy={97} rx={20} ry={4} fill="none" stroke="#6fd6ff" strokeOpacity={0.7} strokeWidth={0.7} />
      <Circle cx={50} cy={97} r={6.5} fill="#33206e" stroke="#a48bff" strokeWidth={1} />
      <Path d="M44,96 Q50,93.5 56,96" stroke="#e9ddff" strokeOpacity={0.6} strokeWidth={0.8} fill="none" />
      <Path d="M8,104 Q40,94 70,101.5" stroke={`url(#${tail})`} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Circle cx={71} cy={101.6} r={2.4} fill="#ffffff" />
      <Path d={STAR(80, 92, 1.8)} fill="#fff" />
      <Path d={STAR(20, 92, 1.4)} fill="#fff" />
    </G>
  );
}

export function Accents({ k, id }: { k: FrameKey; id: string }) {
  const m = METALS[k];
  if (m) return <Metal id={id} c={m} />;
  switch (k) {
    case 'stethoscope':
      return <Stethoscope id={id} />;
    case 'helix':
      return <Helix id={id} />;
    case 'neuron':
      return <Neuron id={id} />;
    case 'pulse':
      return <Pulse id={id} />;
    case 'laurel':
      return <Laurel id={id} />;
    case 'aurora':
      return <Aurora id={id} />;
    case 'nova':
      return <Nova id={id} />;
    default:
      // Normal has no art; Grand Rounds keeps its stamp medal.
      return null;
  }
}
