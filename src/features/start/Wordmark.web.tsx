import { memo, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { bezier } from './ease';

/*
 * Web build of the MedNova wordmark write-in.
 *
 * lottie-react-native renders on web only through @lottiefiles/dotlottie-react, which is not
 * installed (and lottie-web is not either). This file is a small Lottie player for the subset
 * the wordmark uses: shape layers (path / rect / ellipse), fill, stroke, linear gradient fill,
 * trim paths, layer and group transforms, keyframes with bezier easing and alpha track mattes.
 * It reads the same assets/motion/mednova-wordmark.json, so web and native play the same file.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any;
const DATA: J = require('@/assets/motion/mednova-wordmark.json');

const arr = (v: J): number[] => (Array.isArray(v) ? v : [v]);
const n0 = (v: J): number => (Array.isArray(v) ? v[0] : v);
const easeCache = new Map<string, (t: number) => number>();

function val(p: J, f: number): number[] {
  if (!p) return [];
  if (!p.a) return arr(p.k);
  const k = p.k;
  if (f <= k[0].t) return arr(k[0].s);
  for (let j = 0; j < k.length - 1; j++) {
    const a = k[j];
    const b = k[j + 1];
    if (f < b.t) {
      const s = arr(a.s);
      if (a.h) return s;
      const e = arr(b.s ?? a.e);
      const key = `${n0(a.o.x)},${n0(a.o.y)},${n0(a.i.x)},${n0(a.i.y)}`;
      let ez = easeCache.get(key);
      if (!ez) easeCache.set(key, (ez = bezier(n0(a.o.x), n0(a.o.y), n0(a.i.x), n0(a.i.y))));
      const q = ez((f - a.t) / (b.t - a.t));
      return s.map((v, i) => v + (e[i] - v) * q);
    }
  }
  return arr(k[k.length - 1].s);
}

function shapeD(it: J): string {
  if (it.ty === 'sh') {
    const k = it.ks.a ? it.ks.k[0].s[0] : it.ks.k;
    const { v, i, o, c } = k;
    if (!v.length) return '';
    const seg = (a: number, b: number) =>
      `C${v[a][0] + o[a][0]},${v[a][1] + o[a][1]} ${v[b][0] + i[b][0]},${v[b][1] + i[b][1]} ${v[b][0]},${v[b][1]}`;
    let d = `M${v[0][0]},${v[0][1]}`;
    for (let j = 1; j < v.length; j++) d += seg(j - 1, j);
    if (c) d += `${seg(v.length - 1, 0)}Z`;
    return d;
  }
  if (it.ty === 'rc') {
    const [w, h] = arr(it.s.k);
    const [x, y] = arr(it.p.k);
    return `M${x + w / 2},${y - h / 2}H${x - w / 2}V${y + h / 2}H${x + w / 2}Z`;
  }
  if (it.ty === 'el') {
    const [w, h] = arr(it.s.k);
    const [x, y] = arr(it.p.k);
    const rx = w / 2;
    const ry = h / 2;
    return `M${x - rx},${y}A${rx},${ry} 0 1,0 ${x + rx},${y}A${rx},${ry} 0 1,0 ${x - rx},${y}Z`;
  }
  return '';
}

function xform(t: J, f: number) {
  const p = val(t.p, f);
  const a = val(t.a, f);
  const s = val(t.s, f);
  const r = n0(val(t.r, f)) || 0;
  const o = t.o ? n0(val(t.o, f)) / 100 : 1;
  const tr = `translate(${p[0] || 0} ${p[1] || 0}) rotate(${r}) scale(${(s[0] ?? 100) / 100} ${(s[1] ?? 100) / 100}) translate(${-(a[0] || 0)} ${-(a[1] || 0)})`;
  return { tr, o };
}

const rgb = (c: number[]) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;

function group(items: J[], f: number, key: string, defs: ReactNode[]): ReactNode {
  const shapes = items.filter((x) => x.ty === 'sh' || x.ty === 'rc' || x.ty === 'el').map(shapeD);
  const subs = items.filter((x) => x.ty === 'gr');
  const tm = items.find((x) => x.ty === 'tm');
  const styles = items.filter((x) => x.ty === 'fl' || x.ty === 'st' || x.ty === 'gf');
  const t = items.find((x) => x.ty === 'tr');
  const all = shapes.join('');
  const out: ReactNode[] = [];
  subs.forEach((g, i) => out.push(group(g.it, f, `${key}g${i}`, defs)));
  // Earlier items in a Lottie group paint on top, so draw styles last-to-first.
  [...styles].reverse().forEach((st, si) => {
    const k = `${key}s${si}`;
    const op = n0(val(st.o, f)) / 100;
    if (st.ty === 'fl') {
      out.push(<path key={k} d={all} fill={rgb(val(st.c, f))} fillOpacity={op} fillRule={st.r === 2 ? 'evenodd' : 'nonzero'} />);
    } else if (st.ty === 'gf') {
      const n = st.g.p;
      const raw = val(st.g.k, f);
      const cs: [number, number[]][] = [];
      for (let i = 0; i < n; i++) cs.push([raw[i * 4], raw.slice(i * 4 + 1, i * 4 + 4)]);
      const as: [number, number][] = [];
      for (let i = n * 4; i + 1 < raw.length; i += 2) as.push([raw[i], raw[i + 1]]);
      const at = (list: [number, J][], x: number, pick: (v: J) => number[]) => {
        if (x <= list[0][0]) return pick(list[0][1]);
        for (let i = 0; i < list.length - 1; i++) {
          if (x <= list[i + 1][0]) {
            const q = (x - list[i][0]) / (list[i + 1][0] - list[i][0] || 1);
            const A = pick(list[i][1]);
            const B = pick(list[i + 1][1]);
            return A.map((v, j) => v + (B[j] - v) * q);
          }
        }
        return pick(list[list.length - 1][1]);
      };
      const offs = Array.from(new Set([...cs.map((c) => c[0]), ...as.map((c) => c[0])])).sort((a, b) => a - b);
      const s = val(st.s, f);
      const e = val(st.e, f);
      const gid = `${key}gf${si}`;
      defs.push(
        <linearGradient key={gid} id={gid} gradientUnits="userSpaceOnUse" x1={s[0]} y1={s[1]} x2={e[0]} y2={e[1]}>
          {offs.map((o, i) => (
            <stop key={i} offset={o} stopColor={rgb(at(cs, o, (v) => v))} stopOpacity={as.length ? at(as, o, (v) => [v])[0] : 1} />
          ))}
        </linearGradient>,
      );
      out.push(<path key={k} d={all} fill={`url(#${gid})`} fillOpacity={op} />);
    } else {
      const common = {
        fill: 'none',
        stroke: rgb(val(st.c, f)),
        strokeOpacity: op,
        strokeWidth: n0(val(st.w, f)),
        strokeLinecap: (['butt', 'butt', 'round', 'square'] as const)[st.lc ?? 2],
        strokeLinejoin: (['miter', 'miter', 'round', 'bevel'] as const)[st.lj ?? 2],
      };
      if (tm) {
        const s = n0(val(tm.s, f));
        const e = n0(val(tm.e, f));
        const o = (n0(val(tm.o, f)) / 360) * 100;
        if (e - s <= 0.001) return;
        shapes.forEach((d, i) =>
          out.push(<path key={`${k}_${i}`} d={d} {...common} pathLength={100} strokeDasharray={`${e - s} ${200}`} strokeDashoffset={-(s + o)} />),
        );
      } else {
        out.push(<path key={k} d={all} {...common} />);
      }
    }
  });
  if (!t) return <g key={key}>{out}</g>;
  const x = xform(t, f);
  return (
    <g key={key} transform={x.tr} opacity={x.o}>
      {out}
    </g>
  );
}

function layer(L: J, f: number, key: string, defs: ReactNode[]): ReactNode {
  if (f < L.ip || f >= L.op) return null;
  const x = xform(L.ks, f);
  // Gaussian Blur effect (ty 29); lottie-web uses sigma = blurriness * 0.3.
  const blur = (L.ef || []).find((e: J) => e.ty === 29 && e.en !== 0);
  let filter: string | undefined;
  if (blur) {
    const fid = `${key}bl`;
    defs.push(
      <filter key={fid} id={fid} filterUnits="userSpaceOnUse" x={-5000} y={-5000} width={10000} height={10000}>
        <feGaussianBlur stdDeviation={n0(val(blur.ef[0].v, f)) * 0.3} />
      </filter>,
    );
    filter = `url(#${fid})`;
  }
  const inner = (L.shapes || []).map((g: J, i: number) => (g.ty === 'gr' ? group(g.it, f, `${key}_${i}`, defs) : null));
  return (
    <g key={key} transform={x.tr} opacity={x.o}>
      {filter ? <g filter={filter}>{inner}</g> : inner}
    </g>
  );
}

function frame(f: number, uid: string) {
  const defs: ReactNode[] = [];
  const body: ReactNode[] = [];
  const Ls: J[] = DATA.layers;
  // Layers listed first paint on top: draw from the end of the list.
  for (let i = Ls.length - 1; i >= 0; i--) {
    const L = Ls[i];
    if (L.td) continue; // a matte, drawn inside the next layer's mask
    const key = `${uid}L${i}`;
    if (L.tt && i > 0 && Ls[i - 1].td) {
      const mid = `${key}m`;
      defs.push(
        <mask key={mid} id={mid} maskUnits="userSpaceOnUse" x={-5000} y={-5000} width={10000} height={10000} style={{ maskType: 'alpha' }}>
          {layer(Ls[i - 1], f, `${key}mt`, defs)}
        </mask>,
      );
      body.push(
        <g key={key} mask={`url(#${mid})`}>
          {layer(L, f, key, defs)}
        </g>,
      );
    } else body.push(layer(L, f, key, defs));
  }
  return (
    <>
      <defs>{defs}</defs>
      {body}
    </>
  );
}

export const Wordmark = memo(function Wordmark({ width, height, play, speed = 1 }: { width: number; height: number; play: boolean; speed?: number }) {
  const uid = `wm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [f, setF] = useState(0);
  const last = DATA.op - 1;
  useEffect(() => {
    if (!play) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const nf = Math.min(last, ((now - t0) / 1000) * DATA.fr * speed);
      setF(nf);
      if (nf < last) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [play, last, speed]);
  const content = useMemo(() => frame(f, uid), [f, uid]);
  return (
    <View style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${DATA.w} ${DATA.h}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        {content}
      </svg>
    </View>
  );
});
