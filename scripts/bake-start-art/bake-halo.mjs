// Renders the wordmark's 'halo' layer (fill + stroke, Gaussian Blur 40 = sigma 12 as lottie-web/lottie-android use)
// into a transparent PNG with 40 px padding (SC=1 by default) in Chromium. See finish.py.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const [json, out] = process.argv.slice(2);
const J = JSON.parse(readFileSync(json, 'utf8'));
const L = J.layers.find((l) => l.nm === 'halo');
const g = L.shapes[0].it;
const d = g.filter((i) => i.ty === 'sh').map((it) => {
  const { v, i, o, c } = it.ks.k;
  const seg = (a, b) => `C${v[a][0] + o[a][0]},${v[a][1] + o[a][1]} ${v[b][0] + i[b][0]},${v[b][1] + i[b][1]} ${v[b][0]},${v[b][1]}`;
  let s = `M${v[0][0]},${v[0][1]}`;
  for (let j = 1; j < v.length; j++) s += seg(j - 1, j);
  if (c) s += `${seg(v.length - 1, 0)}Z`;
  return s;
}).join(' ');
const st = g.find((i) => i.ty === 'st'), fl = g.find((i) => i.ty === 'fl');
const col = (c) => `rgb(${c.k.slice(0, 3).map((x) => Math.round(x * 255)).join(',')})`;
const sigma = L.ef[0].ef[0].v.k * 0.3;
const PAD = 40, SC = Number(process.env.SC || 1), W = J.w + 2 * PAD, H = J.h + 2 * PAD;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SC}" height="${H * SC}" viewBox="${-PAD} ${-PAD} ${W} ${H}">
<defs><filter id="b" filterUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000"><feGaussianBlur stdDeviation="${sigma}"/></filter></defs>
<g filter="url(#b)"><path d="${d}" fill="${col(fl.c)}" fill-rule="nonzero"/><path d="${d}" fill="none" stroke="${col(st.c)}" stroke-width="${st.w.k}" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="${st.ml}"/></g></svg>`;
const b = await chromium.launch({ executablePath: process.env.CHROME });
const p = await b.newPage({ viewport: { width: W * SC, height: H * SC } });
await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await p.locator('svg').screenshot({ path: out, omitBackground: true });
await b.close();
console.log(JSON.stringify({ W, H, PAD, sigma }));
