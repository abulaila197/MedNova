// Bakes the still medical symbols (src/components/MedSymbols.tsx, look 'scatter') INTO the page background
// (Yazan 2026-11-15, lag): menu pages then draw one plain picture instead of ~40 live vector symbols, twice.
// Two shapes so the symbols never stretch: phone (282 x 615 design shape) and tablet (3:4).
// Re-run after changing MedSymbols, the backdrop or the navy:
//   node scripts/bake-backdrop/bake-symbols.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
// Hi-res bases from bake-hd.py base (no grain yet); the symbols are drawn on them in place.
const TMP = process.env.BAKE_TMP ?? '/tmp/mednova-bake';
const C = '#a9c8ff';
const SYMS = {
  stetho: (sw) => `<g stroke="${C}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2v6a5 5 0 0 0 10 0V2M3.5 2h3M13.5 2h3M10 13v2.5a5.5 5.5 0 0 0 11 0V13"/><circle cx="21" cy="10.8" r="2.2"/></g>`,
  ecg: (sw) => `<path d="M1 12h5l2-6 3.5 12 2.5-8 1.5 2h7.5" stroke="${C}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  heart: (sw) => `<path d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.2C21 15 12 20.5 12 20.5z" stroke="${C}" stroke-width="${sw}" fill="none" stroke-linejoin="round"/>`,
  capsule: (sw) => `<g stroke="${C}" stroke-width="${sw}" fill="none" transform="rotate(-45 12 12)"><rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.5v7"/></g>`,
  cross: (sw) => `<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" stroke="${C}" stroke-width="${sw}" fill="none" stroke-linejoin="round"/>`,
  dna: (sw) => `<g stroke="${C}" stroke-width="${sw}" fill="none" stroke-linecap="round"><path d="M7 2c0 5 10 5 10 10s-10 5-10 10M17 2c0 5-10 5-10 10s10 5 10 10M9 4.5h6M9 19.5h6M8.2 8.5h7.6M8.2 15.5h7.6"/></g>`,
  syringe: (sw) => `<g stroke="${C}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3l6 6M18 6l-9.5 9.5L5 16l.5-3.5L15 3M9.5 9.5l2 2M12 7l2 2M5.3 18.7 3 21"/></g>`,
  pill: (sw) => `<g stroke="${C}" stroke-width="${sw}" fill="none"><circle cx="12" cy="12" r="7"/><path d="M7 17 17 7"/></g>`,
};
const ORDER = ['stetho', 'ecg', 'capsule', 'heart', 'dna', 'cross', 'syringe', 'pill'];
function rand(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}
// Same maths as MedSymbols 'scatter'.
function symbols(w, h) {
  const cols = 3, cell = w / cols, rowH = cell * 1.45, rows = Math.ceil(h / rowH), r = rand(7);
  let n = 0, out = '';
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const s = cell * (0.28 + r() * 0.1);
      const k = ORDER[(n++ * 3 + row) % ORDER.length];
      const x = col * cell + (row % 2 ? cell * 0.5 : 0) - (row % 2 ? cell * 0.25 : 0) + (r() - 0.5) * cell * 0.3 - s / 2 + cell * 0.25;
      const y = row * rowH + (r() - 0.5) * cell * 0.3 + rowH * 0.5 - s / 2;
      const rot = (r() - 0.5) * 50;
      out += `<g opacity="0.1" transform="translate(${x} ${y}) rotate(${rot} ${s / 2} ${s / 2}) scale(${s / 24})">${SYMS[k](1.3)}</g>`;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="position:absolute;left:0;top:0">${out}</svg>`;
}
const SHAPES = [
  ['page-symbols-phone', 1080, 2355],
  ['page-symbols-tablet', 1920, 2560],
];
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, w, h] of SHAPES) {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;position:relative;overflow:hidden;background:url(data:image/png;base64,${fs.readFileSync(path.join(TMP, name + '.png')).toString('base64')}) 0 0/100% 100% no-repeat">${symbols(w, h)}</body></html>`);
  await p.screenshot({ path: path.join(TMP, `${name}.png`) });
  console.log('baked', name, w, h);
}
await b.close();
