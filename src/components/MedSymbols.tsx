import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

// Still medical symbols behind a page (Yazan 2026-11-12 list, item 5). Drawn here as plain line art on a 24 box.
type Sym = (c: string, sw: number) => React.ReactNode;
const SYMS: Record<string, Sym> = {
  stetho: (c, sw) => (
    <G stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 2v6a5 5 0 0 0 10 0V2M3.5 2h3M13.5 2h3M10 13v2.5a5.5 5.5 0 0 0 11 0V13" />
      <Circle cx={21} cy={10.8} r={2.2} />
    </G>
  ),
  ecg: (c, sw) => <Path d="M1 12h5l2-6 3.5 12 2.5-8 1.5 2h7.5" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  heart: (c, sw) => (
    <Path d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.2C21 15 12 20.5 12 20.5z" stroke={c} strokeWidth={sw} fill="none" strokeLinejoin="round" />
  ),
  capsule: (c, sw) => (
    <G stroke={c} strokeWidth={sw} fill="none" transform="rotate(-45 12 12)">
      <Rect x={3} y={8.5} width={18} height={7} rx={3.5} />
      <Path d="M12 8.5v7" />
    </G>
  ),
  cross: (c, sw) => <Path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" stroke={c} strokeWidth={sw} fill="none" strokeLinejoin="round" />,
  dna: (c, sw) => (
    <G stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round">
      <Path d="M7 2c0 5 10 5 10 10s-10 5-10 10M17 2c0 5-10 5-10 10s10 5 10 10M9 4.5h6M9 19.5h6M8.2 8.5h7.6M8.2 15.5h7.6" />
    </G>
  ),
  syringe: (c, sw) => (
    <G stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 3l6 6M18 6l-9.5 9.5L5 16l.5-3.5L15 3M9.5 9.5l2 2M12 7l2 2M5.3 18.7 3 21" />
    </G>
  ),
  pill: (c, sw) => (
    <G stroke={c} strokeWidth={sw} fill="none">
      <Circle cx={12} cy={12} r={7} />
      <Path d="M7 17 17 7" />
    </G>
  ),
};
const ORDER = ['stetho', 'ecg', 'capsule', 'heart', 'dna', 'cross', 'syringe', 'pill'];

// A small fixed random so every phone draws the same pattern.
function rand(seed: number) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}

export type SymLook = 'scatter' | 'corner';

function MedSymbolsInner({ w, h, look, color }: { w: number; h: number; look: SymLook; color: string }) {
  const items: { k: string; x: number; y: number; s: number; r: number; o: number }[] = [];
  if (look === 'scatter') {
    const cols = 3;
    const cell = w / cols;
    const rowH = cell * 1.45;
    const rows = Math.ceil(h / rowH);
    const r = rand(7);
    let n = 0;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const s = cell * (0.28 + r() * 0.1);
        items.push({
          k: ORDER[(n++ * 3 + row) % ORDER.length],
          x: col * cell + (row % 2 ? cell * 0.5 : 0) - (row % 2 ? cell * 0.25 : 0) + (r() - 0.5) * cell * 0.3 - s / 2 + cell * 0.25,
          y: row * rowH + (r() - 0.5) * cell * 0.3 + rowH * 0.5 - s / 2,
          s,
          r: (r() - 0.5) * 50,
          o: 0.1,
        });
      }
  } else {
    items.push({ k: 'stetho', x: w * 0.5, y: h * 0.1, s: w * 0.62, r: -18, o: 0.11 });
    items.push({ k: 'ecg', x: -w * 0.12, y: h * 0.44, s: w * 0.6, r: 0, o: 0.1 });
    items.push({ k: 'dna', x: w * 0.68, y: h * 0.62, s: w * 0.42, r: 22, o: 0.1 });
    items.push({ k: 'capsule', x: -w * 0.06, y: h * 0.8, s: w * 0.36, r: 10, o: 0.1 });
  }
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((it, i) => {
        const k = it.s / 24;
        return (
          <G key={i} opacity={it.o} transform={`translate(${it.x} ${it.y}) rotate(${it.r} ${it.s / 2} ${it.s / 2}) scale(${k})`}>
            {SYMS[it.k](color, look === 'scatter' ? 1.3 : 0.9)}
          </G>
        );
      })}
    </Svg>
  );
}

export const MedSymbols = memo(MedSymbolsInner);
