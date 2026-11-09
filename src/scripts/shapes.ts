// Point-cloud targets for the background figure. Every shape is schematic: positions come from a
// seeded generator, never from project data, and the page labels them as such.
// Palette and the helix/orbit motifs are inherited from the original pitch (pitchdeck0).

type RGB = readonly [number, number, number];

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

const EMERALD = hex('#2ec98f');
const BLUE = hex('#3f6df6');
const VIOLET = hex('#b846ff');
const AMBER = hex('#f28a22');
const PALE = hex('#cfe9dd');

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One point: x, y, z, travelling-wave phase, r, g, b.
type Point = [number, number, number, number, RGB];
type Gen = (r: () => number, i: number, n: number) => Point;

export interface Shape {
  data: Float32Array;
  spin: number; // rotation about the vertical axis
  roll: number; // rotation in the picture plane
}

export const STRIDE = 7;

function build(n: number, seed: number, spin: number, roll: number, gen: Gen): Shape {
  const r = rng(seed);
  const data = new Float32Array(n * STRIDE);
  for (let i = 0; i < n; i++) {
    const [x, y, z, ph, c] = gen(r, i, n);
    data.set([x, y, z, ph, c[0], c[1], c[2]], i * STRIDE);
  }
  return { data, spin, roll };
}

const gauss = (r: () => number) => {
  const u = Math.max(r(), 1e-6);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};

function helix(n: number): Shape {
  const R = 0.46, TURNS = 2.6, H = 2.5, RUNGS = 34;
  return build(n, 11, 1, 0, (r) => {
    const u = r();
    if (u < 0.66) {
      const t = r();
      const second = r() < 0.5;
      const a = t * TURNS * 2 * Math.PI + (second ? Math.PI : 0);
      const j = 0.018;
      return [
        R * Math.cos(a) + gauss(r) * j,
        (t - 0.5) * H + gauss(r) * j,
        R * Math.sin(a) + gauss(r) * j,
        t * 3,
        second ? VIOLET : EMERALD,
      ];
    }
    const k = Math.floor(r() * RUNGS);
    const t = (k + 0.5) / RUNGS;
    const a = t * TURNS * 2 * Math.PI;
    const s = r() * 2 - 1;
    return [R * Math.cos(a) * s, (t - 0.5) * H, R * Math.sin(a) * s, t * 3, mix(BLUE, PALE, 0.25)];
  });
}

// Relative GRCh38 chromosome lengths.
const CHR = [248, 242, 198, 190, 181, 171, 159, 145, 138, 133, 135, 133, 114, 107, 102, 90, 83, 80, 58, 64, 46, 50];

function manhattan(n: number): Shape {
  const total = CHR.reduce((a, b) => a + b, 0);
  const gap = 0.012;
  const span = 2 - gap * (CHR.length - 1);
  let cursor = -1;
  const chr = CHR.map((len) => {
    const w = (len / total) * span;
    const c = { x0: cursor, w };
    cursor += w + gap;
    return c;
  });
  const pr = rng(77);
  const peaks = Array.from({ length: 30 }, () => {
    const c = Math.floor(pr() * CHR.length);
    return { c, at: chr[c].x0 + pr() * chr[c].w, h: 0.5 + pr() * 1.35 };
  });
  const THRESHOLD = -0.32;
  return build(n, 23, 0, 0, (r) => {
    const u = r();
    if (u < 0.05) {
      const x = r() * 2 - 1;
      return [x, THRESHOLD, 0, (x + 1) / 2, AMBER];
    }
    if (u < 0.42) {
      const p = peaks[Math.floor(r() * peaks.length)];
      const y = -1 + p.h * Math.pow(r(), 1.5) * 1.05;
      const spread = 0.012 * (1.25 - (y + 1) / p.h);
      const x = p.at + gauss(r) * spread;
      const col = p.c % 2 ? BLUE : EMERALD;
      return [x, y, 0, (x + 1) / 2, y > THRESHOLD ? mix(col, PALE, 0.35) : col];
    }
    const c = Math.floor(r() * CHR.length);
    const x = chr[c].x0 + r() * chr[c].w;
    const y = -1 + 0.62 * Math.pow(r(), 2.6);
    return [x, y, 0, (x + 1) / 2, mix(c % 2 ? BLUE : EMERALD, hex('#0a1420'), 0.25)];
  });
}

function layers(n: number): Shape {
  const L = 5, GRID = 26;
  const stops = [BLUE, mix(BLUE, EMERALD, 0.4), EMERALD, mix(EMERALD, PALE, 0.4), PALE];
  const level = (k: number) => 0.98 - (k / (L - 1)) * 1.96;
  const width = (k: number) => 1 - (k / (L - 1)) * 0.58;
  return build(n, 37, 0, 0, (r) => {
    const k = Math.floor(r() * L);
    const w = width(k);
    if (r() < 0.14 && k < L - 1) {
      const t = r();
      const side = r() < 0.5 ? -1 : 1;
      const x = side * 0.5 * (w + (width(k + 1) - w) * t);
      return [x, level(k) + (level(k + 1) - level(k)) * t - 0.1, 0, k + t, mix(stops[k], stops[k + 1], t)];
    }
    const a = Math.round((r() * 2 - 1) * GRID) / GRID;
    const b = Math.round((r() * 2 - 1) * GRID) / GRID;
    const x = (a - b) * 0.6 * w;
    const y = level(k) + (a + b) * 0.13 * w;
    return [x, y, (a + b) * 0.28 * w, k + r() * 0.08, stops[k]];
  });
}

function admixture(n: number): Shape {
  const bands = [EMERALD, BLUE, VIOLET, AMBER];
  const GROUPS = 6, PER = 13, ROWS = 64;
  const pr = rng(91);
  const base = [
    [0.86, 0.08, 0.04, 0.02],
    [0.56, 0.3, 0.1, 0.04],
    [0.14, 0.72, 0.1, 0.04],
    [0.06, 0.3, 0.58, 0.06],
    [0.04, 0.08, 0.7, 0.18],
    [0.02, 0.04, 0.12, 0.82],
  ];
  const columns: number[][] = [];
  for (let g = 0; g < GROUPS; g++) {
    for (let p = 0; p < PER; p++) {
      const v = base[g].map((b) => Math.max(0.005, b + (pr() - 0.5) * 0.2));
      const sum = v.reduce((a, b) => a + b, 0);
      columns.push(v.map((x) => x / sum));
    }
  }
  const M = columns.length;
  const groupGap = 0.03;
  const barW = (2 - groupGap * (GROUPS - 1)) / M;
  return build(n, 53, 0, 0, (r) => {
    const j = Math.floor(r() * M);
    const g = Math.floor(j / PER);
    const left = -1 + j * barW + g * groupGap;
    // Points snap to a lattice so each person reads as a crisp stacked column of dots.
    const x = left + 0.5 * barW;
    const v = Math.round(r() * ROWS) / ROWS;
    let acc = 0, band = 0;
    for (let k = 0; k < 4; k++) {
      acc += columns[j][k];
      if (v <= acc || k === 3) { band = k; break; }
    }
    return [x, -0.82 + v * 1.64, 0, (x + 1) / 2, bands[band]];
  });
}

function network(n: number): Shape {
  const C = 11;
  const cols = [EMERALD, BLUE, VIOLET];
  const pr = rng(131);
  const nodes = Array.from({ length: C }, (_, i) => {
    const a = i * 2.39996;
    const d = 0.95 * Math.sqrt((i + 0.6) / C);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, z: (pr() - 0.5) * 0.5, c: cols[i % 3] };
  });
  const edges: [number, number][] = [];
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((e) => e.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 3)
      .forEach((e) => edges.push([i, e.j]));
  });
  return build(n, 67, 0.3, 0, (r) => {
    if (r() < 0.34) {
      const [a, b] = edges[Math.floor(r() * edges.length)];
      const t = r();
      const A = nodes[a], B = nodes[b];
      return [
        A.x + (B.x - A.x) * t + gauss(r) * 0.004,
        A.y + (B.y - A.y) * t + gauss(r) * 0.004,
        A.z + (B.z - A.z) * t,
        t,
        mix(mix(A.c, B.c, t), hex('#0a1420'), 0.45),
      ];
    }
    const k = Math.floor(r() * C);
    const N = nodes[k];
    const s = 0.05 + (k % 4) * 0.018;
    return [N.x + gauss(r) * s, N.y + gauss(r) * s, N.z + gauss(r) * s, k / C, N.c];
  });
}

function gates(n: number): Shape {
  const G = 5;
  const gx = (k: number) => -0.86 + (k / (G - 1)) * 1.72;
  const gr = (k: number) => 0.84 - (k / (G - 1)) * 0.62;
  const envelope = (x: number) => {
    const u = Math.min(G - 1, Math.max(0, ((x + 0.86) / 1.72) * (G - 1)));
    const k = Math.min(G - 2, Math.floor(u));
    return gr(k) + (gr(k + 1) - gr(k)) * (u - k);
  };
  return build(n, 83, 0, 0, (r) => {
    const u = r();
    if (u < 0.42) {
      const k = Math.floor(r() * G);
      const a = r() * 2 * Math.PI;
      const R = gr(k);
      return [gx(k), Math.cos(a) * R, Math.sin(a) * R, a / (2 * Math.PI), mix(BLUE, EMERALD, k / (G - 1))];
    }
    if (u < 0.82) {
      const x = -0.86 + Math.pow(r(), 1.5) * 1.72;
      const e = envelope(x) * Math.sqrt(r());
      const a = r() * 2 * Math.PI;
      const t = (x + 0.86) / 1.72;
      return [x, Math.cos(a) * e, Math.sin(a) * e, t * 2, mix(mix(BLUE, EMERALD, t), PALE, 0.1)];
    }
    // Points that leave the stream at a gate: abstention is an outcome, not a failure.
    const k = Math.floor(r() * (G - 1));
    const d = r();
    return [gx(k) + 0.04 + d * 0.1 + (r() - 0.5) * 0.04, -gr(k) - 0.02 - d * 0.5, (r() - 0.5) * 0.3, d, mix(AMBER, hex('#0a1420'), d * 0.5)];
  });
}

function ring(n: number): Shape {
  const R = 0.86;
  const nodes = [-90, 30, 150].map((d, i) => {
    const a = (d * Math.PI) / 180;
    return { x: R * Math.cos(a), y: R * Math.sin(a), c: [EMERALD, BLUE, VIOLET][i] };
  });
  return build(n, 97, 0, 1, (r) => {
    const u = r();
    if (u < 0.64) {
      let a = r() * 2 * Math.PI;
      a = Math.round(a / 0.05) * 0.05;
      const j = gauss(r) * 0.006;
      return [(R + j) * Math.cos(a), (R + j) * Math.sin(a), 0, a / (2 * Math.PI), mix(EMERALD, PALE, 0.15)];
    }
    if (u < 0.9) {
      const N = nodes[Math.floor(r() * 3)];
      const s = gauss(r) * 0.07, t = gauss(r) * 0.07;
      return [N.x + s, N.y + t, 0, 0.5, N.c];
    }
    const a = r() * 2 * Math.PI;
    const d = 0.22 + gauss(r) * 0.012;
    return [d * Math.cos(a), d * Math.sin(a), 0, a / (2 * Math.PI), mix(EMERALD, hex('#0a1420'), 0.3)];
  });
}

export function buildShapes(n: number): Record<string, Shape> {
  return {
    helix: helix(n),
    manhattan: manhattan(n),
    layers: layers(n),
    admixture: admixture(n),
    network: network(n),
    gates: gates(n),
    ring: ring(n),
  };
}
