// The Conqueror's map (CQ21 "One continent"): an invented continent with bays, peninsulas and a few islands,
// drawn fresh for every match from the match's seed, so every phone draws the same map without sending it.
// Each player holds 3 lands side by side: their capital and 2 outposts. The map is for looks only (CQ3).
// Ported from the approved preview generator (noise terrain, warped Voronoi lands), on a coarse grid that a
// phone builds in a few milliseconds, then traced into smooth SVG paths.

export const MAP_W = 360;
export const MAP_H = 300;
const GW = 150;
const GH = 125;
const CELL = MAP_W / GW;

type Rng = () => number;

function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from any text, such as the match id. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Smooth value noise at `cells` lattice cells across the map height. */
function valueNoise(rng: Rng, cells: number): Float32Array {
  const cw = Math.ceil((cells * GW) / GH) + 2;
  const ch = cells + 2;
  const g = Float32Array.from({ length: cw * ch }, () => rng());
  const out = new Float32Array(GW * GH);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < GH; y++) {
    const fy = (y / GH) * cells;
    const y0 = Math.floor(fy), ty = s(fy - y0);
    for (let x = 0; x < GW; x++) {
      const fx = (x / GH) * cells;
      const x0 = Math.floor(fx), tx = s(fx - x0);
      const a = g[y0 * cw + x0], b = g[y0 * cw + x0 + 1], c = g[(y0 + 1) * cw + x0], d = g[(y0 + 1) * cw + x0 + 1];
      out[y * GW + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

function fbm(rng: Rng, base: number, octaves: number, gain: number): Float32Array {
  const out = new Float32Array(GW * GH);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(rng, base * 2 ** o);
    for (let i = 0; i < out.length; i++) out[i] += amp * n[i];
    tot += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Connected parts of a cell set; returns a label per cell (0 = not in the set) and each part's size. */
function label(on: Uint8Array): { lab: Int32Array; sizes: number[] } {
  const lab = new Int32Array(GW * GH);
  const sizes = [0];
  const stack: number[] = [];
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || lab[i]) continue;
    const id = sizes.length;
    let n = 0;
    lab[i] = id;
    stack.push(i);
    while (stack.length) {
      const c = stack.pop()!;
      n++;
      const x = c % GW, y = (c - x) / GW;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx;
        if (on[j] && !lab[j]) {
          lab[j] = id;
          stack.push(j);
        }
      }
    }
    sizes.push(n);
  }
  return { lab, sizes };
}

/** Distance (in cells, 8-way chamfer) from each cell to the nearest cell outside `inside`. */
function depth(inside: (i: number) => boolean): Float32Array {
  const d = new Float32Array(GW * GH);
  for (let i = 0; i < d.length; i++) d[i] = inside(i) ? 1e6 : 0;
  const pass = (fw: boolean) => {
    for (let k = 0; k < d.length; k++) {
      const i = fw ? k : d.length - 1 - k;
      if (!d[i]) continue;
      const x = i % GW, y = (i - x) / GW;
      const s = fw ? -1 : 1;
      const look = (nx: number, ny: number, w: number) => {
        const v = nx < 0 || ny < 0 || nx >= GW || ny >= GH ? 0 : d[ny * GW + nx];
        if (v + w < d[i]) d[i] = v + w;
      };
      look(x + s, y, 1);
      look(x, y + s, 1);
      look(x + s, y + s, 1.414);
      look(x - s, y + s, 1.414);
    }
  };
  pass(true);
  pass(false);
  return d;
}

export type MapLand = {
  /** The engine's land id: land_1 is the first player's capital, then their 2 outposts, and so on. */
  id: string;
  /** Seat (place in the match order) that starts with this land. */
  seat: number;
  capital: boolean;
  /** Smooth SVG path in map units. */
  d: string;
  /** Where the piece stands: the deepest point of the land. */
  spot: [number, number];
};

export type AtlasMap = {
  seed: number;
  players: number;
  lands: MapLand[];
  /** The whole coastline, for the sea ripples and the ink coast. */
  coast: string;
  /** Inner borders between lands: [land a, land b, path]. */
  borders: { a: string; b: string; d: string }[];
  mountains: [number, number][];
};

type Pt = [number, number];

/** Traces the outline loops of a cell set as polylines through cell corners, corners only. */
function outline(inSet: (x: number, y: number) => boolean): Pt[][] {
  // Directed edges with the set on the left, keyed by start corner.
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (GW + 1) + x;
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const k = key(x1, y1);
    const l = next.get(k);
    if (l) l.push(key(x2, y2));
    else next.set(k, [key(x2, y2)]);
  };
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      if (!inSet(x, y)) continue;
      if (!inSet(x, y - 1)) add(x + 1, y, x, y);
      if (!inSet(x, y + 1)) add(x, y + 1, x + 1, y + 1);
      if (!inSet(x - 1, y)) add(x, y, x, y + 1);
      if (!inSet(x + 1, y)) add(x + 1, y + 1, x + 1, y);
    }
  const loops: Pt[][] = [];
  for (const [start] of next) {
    while ((next.get(start)?.length ?? 0) > 0) {
      const loop: Pt[] = [];
      let k = start;
      do {
        const l = next.get(k)!;
        const n = l.pop()!;
        if (!l.length) next.delete(k);
        loop.push([k % (GW + 1), Math.floor(k / (GW + 1))]);
        k = n;
      } while (k !== start && next.has(k));
      loops.push(loop);
    }
  }
  // Keep corners only.
  return loops.map((lp) => lp.filter((p, i) => {
    const a = lp[(i - 1 + lp.length) % lp.length], b = lp[(i + 1) % lp.length];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  }));
}

function chaikin(p: Pt[], rounds: number, closed = true): Pt[] {
  let pts = p;
  for (let r = 0; r < rounds; r++) {
    const out: Pt[] = [];
    const n = pts.length;
    if (!closed) out.push(pts[0]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) out.push(pts[n - 1]);
    pts = out;
  }
  return pts;
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
function toPath(loops: Pt[][], closed = true): string {
  return loops
    .filter((l) => l.length > 2)
    .map((l) => 'M' + chaikin(l, 3, closed).map((p) => `${f1(p[0] * CELL)} ${f1(p[1] * CELL)}`).join('L') + (closed ? 'Z' : ''))
    .join('');
}

/** Builds the map for `players` players from `seed`. Always succeeds (it tries the next seed if a draw is unusable). */
export function makeMap(seed: number, players: number, tries = 0): AtlasMap {
  const n = players;
  const rng = mulberry(seed + tries * 7919);
  const wx = fbm(rng, 3, 3, 0.5), wy = fbm(rng, 3, 3, 0.5);
  const terr = fbm(rng, 3, 6, 0.6);
  const T = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      // Warp the continent's outline so it never looks like an ellipse.
      const X = x / GW + (wx[i] - 0.5) * 0.35, Y = y / GH + (wy[i] - 0.5) * 0.35;
      const r = Math.min(2, ((X - 0.5) / 0.44) ** 2 + ((Y - 0.5) / 0.46) ** 2);
      // Keep a sea margin so no coast is cut flat by the frame.
      const e = Math.min(x, GW - 1 - x, y, GH - 1 - y);
      T[i] = terr[i] * 1.25 + (1 - r ** 1.4 * 0.55) * 0.7 - (e < 14 ? (1 - e / 14) ** 2 * 0.9 : 0);
    }
  const sorted = Float32Array.from(T).sort();
  const level = sorted[Math.floor(sorted.length * (1 - (0.44 + 0.015 * n)))];
  let on = new Uint8Array(GW * GH);
  for (let y = 3; y < GH - 3; y++) for (let x = 3; x < GW - 3; x++) on[y * GW + x] = T[y * GW + x] > level ? 1 : 0;
  // Drop specks and lakes.
  let { lab, sizes } = label(on);
  for (let i = 0; i < on.length; i++) if (on[i] && sizes[lab[i]] < 45) on[i] = 0;
  const sea = new Uint8Array(GW * GH);
  for (let i = 0; i < on.length; i++) sea[i] = on[i] ? 0 : 1;
  const sl = label(sea);
  const ocean = sl.lab[0];
  for (let i = 0; i < on.length; i++) if (!on[i] && sl.lab[i] !== ocean && sl.sizes[sl.lab[i]] < 40) on[i] = 1;
  ({ lab, sizes } = label(on));
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < GW && y < GH && on[y * GW + x] === 1;

  // Seeds for 3 lands per player, spread out and away from the coast.
  const nl = 3 * n;
  const coastD = depth((i) => on[i] === 1);
  const landCells: number[] = [];
  for (let i = 0; i < on.length; i++) if (on[i]) landCells.push(i);
  const cand = Array.from({ length: 1500 }, () => landCells[Math.floor(rng() * landCells.length)]);
  const xy = (i: number): Pt => [i % GW, Math.floor(i / GW)];
  const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let seeds: Pt[] = [];
  // At least one land on every big landmass, so islands get a ruler.
  sizes.forEach((s, id) => {
    if (id && s > 520) {
      const c = cand.filter((i) => lab[i] === id);
      if (c.length) seeds.push(xy(c.reduce((a, b) => (coastD[b] > coastD[a] ? b : a))));
    }
  });
  while (seeds.length < nl) {
    let best = cand[0], bv = -1;
    for (const c of cand) {
      const p = xy(c);
      const v = (seeds.length ? Math.min(...seeds.map((s) => dist(s, p))) : 1) * (0.4 + Math.min(coastD[c], 6) / 6);
      if (v > bv) { bv = v; best = c; }
    }
    seeds.push(xy(best));
  }
  seeds = seeds.slice(0, nl);

  // Warped Voronoi inside the land, relaxed a few times, for natural wiggly borders.
  const bx = fbm(rng, 4, 4, 0.5), by = fbm(rng, 4, 4, 0.5);
  const reg = new Int32Array(GW * GH).fill(-1);
  for (let it = 0; it < 4; it++) {
    for (const i of landCells) {
      const x = i % GW, y = (i - x) / GW;
      const X = x + (bx[i] - 0.5) * 29, Y = y + (by[i] - 0.5) * 29;
      let best = -1, bd = Infinity;
      seeds.forEach(([sx, sy], k) => {
        let d = (X - sx) ** 2 + (Y - sy) ** 2;
        if (lab[i] !== lab[sy * GW + sx]) d += 37 ** 2;
        if (d < bd) { bd = d; best = k; }
      });
      reg[i] = best;
    }
    if (it < 3)
      seeds = seeds.map((s, k) => {
        let sx = 0, sy = 0, c = 0;
        for (const i of landCells) if (reg[i] === k) { sx += i % GW; sy += Math.floor(i / GW); c++; }
        if (!c) return s;
        const m: Pt = [sx / c, sy / c];
        let best = s, bd = Infinity;
        for (const i of landCells) if (reg[i] === k) {
          const p = xy(i), d = dist(p, m);
          if (d < bd) { bd = d; best = p; }
        }
        return best;
      });
  }
  const area = Array(nl).fill(0);
  for (const i of landCells) area[reg[i]]++;
  if (area.some((a) => a < 25)) return tries < 20 ? makeMap(seed, players, tries + 1) : fallback(seed, players);

  // Who borders whom (a shared edge, or a short strait).
  const border = Array.from({ length: nl }, () => new Set<number>());
  for (const i of landCells) {
    const x = i % GW;
    for (const j of [x + 1 < GW ? i + 1 : -1, i + GW < GW * GH ? i + GW : -1]) {
      if (j >= 0 && reg[j] >= 0 && reg[j] !== reg[i]) { border[reg[i]].add(reg[j]); border[reg[j]].add(reg[i]); }
    }
  }
  const cent: Pt[] = Array.from({ length: nl }, () => [0, 0]);
  for (const i of landCells) { cent[reg[i]][0] += (i % GW) / area[reg[i]]; cent[reg[i]][1] += Math.floor(i / GW) / area[reg[i]]; }
  const strait = Array.from({ length: nl }, () => new Set<number>());
  const edgeCells = Array.from({ length: nl }, () => [] as Pt[]);
  for (const i of landCells) {
    const [x, y] = xy(i);
    if (N4.some(([dx, dy]) => !isLand(x + dx, y + dy))) edgeCells[reg[i]].push([x, y]);
  }
  for (let a = 0; a < nl; a++)
    for (let b = a + 1; b < nl; b++)
      if (!border[a].has(b) && edgeCells[a].some((p) => edgeCells[b].some((q) => dist(p, q) < 16))) { strait[a].add(b); strait[b].add(a); }
  const cd = (a: number, b: number) => dist(cent[a], cent[b]);

  // Capitals far apart, then each player grows 2 outposts next to their capital.
  const deal = (allowStrait: boolean) => {
    const caps = [Math.floor(rng() * nl)];
    while (caps.length < n) {
      let best = -1, bv = -1;
      for (let i = 0; i < nl; i++) {
        if (caps.includes(i)) continue;
        const v = Math.min(...caps.map((c) => cd(i, c))) * (0.8 + 0.4 * rng());
        if (v > bv) { bv = v; best = i; }
      }
      caps.push(best);
    }
    const owner = Array(nl).fill(-1);
    caps.forEach((c, p) => (owner[c] = p));
    for (let r = 0; r < 2; r++) {
      const order = Array.from({ length: n }, (_, p) => p).sort(() => rng() - 0.5);
      for (const p of order) {
        const mine = owner.flatMap((o, i) => (o === p ? [i] : []));
        let opts = mine.flatMap((i) => [...border[i]]).filter((j) => owner[j] === -1);
        if (!opts.length && allowStrait) opts = mine.flatMap((i) => [...strait[i]]).filter((j) => owner[j] === -1);
        if (!opts.length) return null;
        owner[opts.reduce((a, b) => (cd(b, caps[p]) < cd(a, caps[p]) ? b : a))] = p;
      }
    }
    return { caps, owner };
  };
  let got: { caps: number[]; owner: number[] } | null = null;
  for (const allow of [false, true]) {
    for (let k = 0; k < 300 && !got; k++) got = deal(allow);
    if (got) break;
  }
  if (!got) return tries < 20 ? makeMap(seed, players, tries + 1) : fallback(seed, players);
  const { caps, owner } = got;

  // Region k becomes land_{3p+1} (capital) or one of the player's 2 outposts, matching startMatch's order.
  const idOf: string[] = Array(nl);
  for (let p = 0; p < n; p++) {
    const mine = owner.flatMap((o, i) => (o === p && i !== caps[p] ? [i] : []));
    idOf[caps[p]] = `land_${3 * p + 1}`;
    mine.forEach((k, j) => (idOf[k] = `land_${3 * p + 2 + j}`));
  }
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < GW && y < GH ? reg[y * GW + x] : -1);
  const lands: MapLand[] = [];
  for (let k = 0; k < nl; k++) {
    const dep = depth((i) => reg[i] === k);
    let bi = 0;
    for (let i = 0; i < dep.length; i++) if (dep[i] > dep[bi]) bi = i;
    const [sx, sy] = xy(bi);
    lands.push({ id: idOf[k], seat: owner[k], capital: caps.includes(k), d: toPath(outline((x, y) => at(x, y) === k)), spot: [(sx + 0.5) * CELL, (sy + 0.5) * CELL] });
  }
  lands.sort((a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5)));

  // Inner borders: the edges between two lands, traced as open lines.
  const borders: AtlasMap['borders'] = [];
  for (let a = 0; a < nl; a++)
    for (const b of border[a]) {
      if (b < a) continue;
      const segs: Pt[][] = [];
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const r = at(x, y);
          if (r !== a && r !== b) continue;
          const o = r === a ? b : a;
          if (at(x + 1, y) === o) segs.push([[x + 1, y], [x + 1, y + 1]]);
          if (at(x, y + 1) === o) segs.push([[x, y + 1], [x + 1, y + 1]]);
        }
      borders.push({ a: idOf[a], b: idOf[b], d: toPath(chain(segs), false) });
    }

  // Small mountain marks on the highest ground, clear of the pieces.
  const mountains: Pt[] = [];
  const high = landCells.slice().sort((p, q) => T[q] - T[p]);
  for (const i of high) {
    const p: Pt = [((i % GW) + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL];
    if (mountains.every((q) => dist(p, q) > 26) && lands.every((l) => dist(p, l.spot) > 24) && coastD[i] > 3) mountains.push(p);
    if (mountains.length >= 12) break;
  }

  return { seed, players, lands, coast: toPath(outline(isLand)), borders, mountains };
}

/** Joins unit segments into polylines. */
function chain(segs: Pt[][]): Pt[][] {
  const k = (p: Pt) => `${p[0]},${p[1]}`;
  const ends = new Map<string, number[]>();
  segs.forEach((s, i) => s.forEach((p) => ends.set(k(p), [...(ends.get(k(p)) ?? []), i])));
  const used = new Set<number>();
  const lines: Pt[][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const line: Pt[] = [...segs[i]];
    for (const dir of [1, -1]) {
      for (;;) {
        const tip = dir === 1 ? line[line.length - 1] : line[0];
        const nx = (ends.get(k(tip)) ?? []).find((j) => !used.has(j));
        if (nx == null) break;
        used.add(nx);
        const [p, q] = segs[nx];
        const other = k(p) === k(tip) ? q : p;
        if (dir === 1) line.push(other);
        else line.unshift(other);
      }
    }
    // Corners only.
    lines.push(line.filter((p, j) => j === 0 || j === line.length - 1 || (p[0] - line[j - 1][0]) * (line[j + 1][1] - p[1]) - (p[1] - line[j - 1][1]) * (line[j + 1][0] - p[0]) !== 0));
  }
  return lines;
}

/** Never reached in practice: a plain grid of lands so the game can still be played. */
function fallback(seed: number, players: number): AtlasMap {
  const nl = 3 * players;
  const cols = 3, rows = players;
  const cw = (MAP_W - 40) / cols, rh = (MAP_H - 40) / rows;
  const lands: MapLand[] = Array.from({ length: nl }, (_, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const x = 20 + c * cw, y = 20 + r * rh;
    return { id: `land_${i + 1}`, seat: r, capital: c === 0, d: `M${x} ${y}h${cw}v${rh}h${-cw}Z`, spot: [x + cw / 2, y + rh / 2] };
  });
  return { seed, players, lands, coast: `M20 20H${MAP_W - 20}V${MAP_H - 20}H20Z`, borders: [], mountains: [] };
}
