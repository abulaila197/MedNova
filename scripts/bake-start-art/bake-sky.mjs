// Renders the start-flow Sky (3 radial washes over #070a1c, Sky.tsx) and the 3 slide veils (Slides.tsx) in Chromium.
// Every size in both is a fraction of the screen's width/height, so one picture stretched to any screen is the same.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const [outDir, W = '720', H = '1560'] = process.argv.slice(2);
const w = +W, h = +H;
const NAVY = '#070a1c';
const DARK = [
  { at: [0.85, 0], r: [1.2, 0.55], color: '#3b2b8f', alpha: 1, end: 0.55 },
  { at: [0, 0.5], r: [0.9, 0.5], color: '#0f4a7a', alpha: 1, end: 0.6 },
  { at: [1, 1], r: [0.8, 0.4], color: '#5a1f6e', alpha: 1, end: 0.6 },
];
const order = [...DARK].reverse();
const sky = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${NAVY}"/><defs>${order.map((g, i) => `<radialGradient id="s${i}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${g.at[0] * w} ${g.at[1] * h}) scale(${g.r[0] * w} ${g.r[1] * h})"><stop offset="0" stop-color="${g.color}" stop-opacity="${g.alpha}"/><stop offset="${g.end}" stop-color="${g.color}" stop-opacity="0"/><stop offset="1" stop-color="${g.color}" stop-opacity="0"/></radialGradient>`).join('')}</defs>${order.map((_, i) => `<rect width="${w}" height="${h}" fill="url(#s${i})"/>`).join('')}</svg>`;
const VEILS = [
  [[0, 1], [0.3, 1], [0.46, 0], [0.8, 0], [0.96, 1]],
  [[0, 0.6], [0.12, 0], [0.54, 0], [0.7, 1]],
  [[0, 1], [0.08, 1], [0.3, 0], [0.7, 0], [1, 0.75]],
];
const VW = 4, VH = 1024;
const veil = (v) => `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}"><defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1">${v.map(([o, a]) => `<stop offset="${o}" stop-color="${NAVY}" stop-opacity="${a}"/>`).join('')}</linearGradient></defs><rect width="${VW}" height="${VH}" fill="url(#v)"/></svg>`;
const b = await chromium.launch({ executablePath: process.env.CHROME });
async function shot(svg, ww, hh, path, transparent) {
  const p = await b.newPage({ viewport: { width: ww, height: hh } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await p.locator('svg').screenshot({ path, omitBackground: transparent });
  await p.close();
}
await shot(sky, w, h, `${outDir}/sky.png`, false);
for (let i = 0; i < 3; i++) await shot(veil(VEILS[i]), VW, VH, `${outDir}/veil-${i + 1}.png`, true);
await b.close();
