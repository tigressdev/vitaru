// Browser port of engine/ancestry_solver.py (candidate v3): objective, EM map, safeguarded SQUAREM, the KKT duality gap
// and identifiability diagnostics. tests/lab-solver.test.mjs holds it to the Python implementation on shared fixtures.
// Pure functions only, so the same file runs in the page and under Node.

export const EPS = 1e-3; // reference frequencies are clipped to [EPS, 1-EPS], as in the Python solver
export const KKT_TOL = 1e-9; // provisional acceptance tolerance on gap / W (reports/ancestry/ACCEPTANCE_CONTRACT.md)
export const MAX_MAPS = 5000;

type Vec = number[];
type Mat = number[][];

export interface Problem {
  F: Mat; // L rows, K columns, clipped
  g: Vec;
  w: Vec;
  wg: Vec;
  w2g: Vec;
  W: number;
  L: number;
  K: number;
}

export interface Step {
  q: Vec;
  mapEvals: number;
  objEvals: number;
  note: 'em' | 'extrapolated' | 'em_fallback_degenerate' | 'em_fallback_no_ascent';
}

export interface Kkt {
  feasible: boolean;
  duality_gap: number;
  scaled_gap: number;
  multiplier: number;
  fixed_point_residual_l1: number;
  absorbed_ascent: number;
  absorbed_components: number;
  zero_components: number;
}

export interface Identifiability {
  K: number;
  affine_rank: number;
  structurally_identifiable: boolean;
  weakly_active?: number[];
  weakly_active_affine_rank?: number;
  unique_maximizer_certified?: boolean;
  curvature_min_per_weight?: number;
  curvature_max_per_weight?: number;
}

const sum = (v: Vec) => v.reduce((a, b) => a + b, 0);
const norm2 = (v: Vec) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));

export function makeProblem(F: Mat, g: Vec, w?: Vec): Problem {
  const clipped = F.map((row) => row.map((x) => {
    if (!Number.isFinite(x) || x < 0 || x > 1) throw new Error('reference frequencies must lie inside [0, 1]');
    return Math.min(1 - EPS, Math.max(EPS, x));
  }));
  const weights = w ?? g.map(() => 1);
  if (g.length !== clipped.length || weights.length !== clipped.length) throw new Error('shape mismatch');
  if (!weights.every((x) => Number.isFinite(x) && x >= 0) || sum(weights) <= 0) throw new Error('invalid weights');
  if (!g.every((x) => Number.isFinite(x) && x >= 0 && x <= 2)) throw new Error('genotype dosages must lie inside [0, 2]');
  return {
    F: clipped, g, w: weights,
    wg: weights.map((x, i) => x * g[i]),
    w2g: weights.map((x, i) => x * (2 - g[i])),
    W: sum(weights), L: clipped.length, K: clipped[0].length,
  };
}

const fitted = (prob: Problem, q: Vec): Vec => prob.F.map((row) => row.reduce((a, f, k) => a + f * q[k], 0));

export function objective(prob: Problem, q: Vec): number {
  const p = fitted(prob, q);
  let total = 0;
  for (let l = 0; l < prob.L; l++) total += prob.wg[l] * Math.log(p[l]) + prob.w2g[l] * Math.log1p(-p[l]);
  return total;
}

function gradient(prob: Problem, p: Vec): Vec {
  const grad = new Array<number>(prob.K).fill(0);
  for (let l = 0; l < prob.L; l++) {
    const r = prob.wg[l] / p[l] - prob.w2g[l] / (1 - p[l]);
    for (let k = 0; k < prob.K; k++) grad[k] += prob.F[l][k] * r;
  }
  return grad;
}

export function emStep(prob: Problem, q: Vec): Step {
  const p = fitted(prob, q);
  const score = new Array<number>(prob.K).fill(0);
  let refTotal = 0;
  for (let l = 0; l < prob.L; l++) {
    const rAlt = prob.wg[l] / p[l];
    const rRef = prob.w2g[l] / (1 - p[l]);
    refTotal += rRef;
    for (let k = 0; k < prob.K; k++) score[k] += prob.F[l][k] * (rAlt - rRef);
  }
  let next = q.map((x, k) => (x * (score[k] + refTotal)) / (2 * prob.W));
  const s = sum(next);
  if (s > 0) next = next.map((x) => x / s);
  return { q: next, mapEvals: 1, objEvals: 0, note: 'em' };
}

export function projectSimplex(q: Vec): Vec {
  const clipped = q.map((x) => (Number.isFinite(x) ? Math.max(x, 0) : 0));
  const s = sum(clipped);
  if (!Number.isFinite(s) || s <= 0) return q.map(() => 1 / q.length);
  return clipped.map((x) => x / s);
}

export function squaremStep(prob: Problem, q: Vec, keepSupport: boolean, backtracks = 8): Step {
  const q1 = emStep(prob, q).q;
  const q2 = emStep(prob, q1).q;
  let objEvals = 0;
  const r = q1.map((x, k) => x - q[k]);
  const v = q2.map((x, k) => x - q1[k] - r[k]);
  const nv = norm2(v);
  const nr = norm2(r);
  if (nv <= 1e-300 || nr <= 1e-300) return { q: q2, mapEvals: 2, objEvals, note: 'em_fallback_degenerate' };
  let alpha = -nr / nv;
  if (alpha > -1) alpha = -1; // SqS3 stability: never shorter than a doubled EM step
  const base = objective(prob, q2);
  objEvals += 1;
  for (let b = 0; b < backtracks; b++) {
    const raw = q.map((x, k) => x - 2 * alpha * r[k] + alpha * alpha * v[k]);
    if (!(keepSupport && raw.some((x, k) => q[k] > 0 && x <= 0))) {
      const cand = projectSimplex(raw);
      const val = objective(prob, cand);
      objEvals += 1;
      if (Number.isFinite(val) && val >= base) return { q: cand, mapEvals: 2, objEvals, note: 'extrapolated' };
    }
    alpha = (alpha - 1) / 2; // halve the distance back toward a plain doubled EM step
    if (alpha >= -1) break;
  }
  return { q: q2, mapEvals: 2, objEvals, note: 'em_fallback_no_ascent' };
}

export function kkt(prob: Problem, q: Vec, activeEps = 1e-10): Kkt {
  const p = fitted(prob, q);
  const usable = p.every((x) => x > 0 && x < 1);
  if (!(usable && q.every((x) => x >= 0) && Math.abs(sum(q) - 1) <= 1e-9)) {
    return { feasible: false, duality_gap: Infinity, scaled_gap: Infinity, multiplier: NaN, fixed_point_residual_l1: Infinity, absorbed_ascent: Infinity, absorbed_components: 0, zero_components: q.length };
  }
  const grad = gradient(prob, p);
  const lam = grad.reduce((a, x, k) => a + x * q[k], 0);
  const reduced = grad.map((x) => x - lam);
  const gap = Math.max(0, Math.max(...reduced));
  const absorbed = reduced.filter((_, k) => q[k] === 0);
  return {
    feasible: true,
    duality_gap: gap,
    scaled_gap: gap / prob.W,
    multiplier: lam,
    fixed_point_residual_l1: q.reduce((a, x, k) => a + Math.abs(x * reduced[k]), 0) / (2 * prob.W),
    absorbed_ascent: absorbed.length ? Math.max(0, Math.max(...absorbed)) : 0,
    absorbed_components: absorbed.filter((x) => x > 0).length,
    zero_components: q.filter((x) => !(x > activeEps)).length,
  };
}

/** Orthonormal basis of the directions that stay on the simplex (Helmert). Rank and curvature do not depend on the basis. */
function tangentBasis(k: number): Mat {
  const columns: Mat = [];
  for (let j = 1; j < k; j++) {
    const scale = Math.sqrt(j * (j + 1));
    columns.push(Array.from({ length: k }, (_, i) => (i < j ? 1 / scale : i === j ? -j / scale : 0)));
  }
  return columns; // columns[j][i]
}

/** Singular values by one-sided Jacobi, which keeps the relative accuracy needed to detect exact dependence. */
function singularValues(columnsIn: Mat): Vec {
  const U = columnsIn.map((c) => c.slice());
  const n = U.length;
  for (let sweep = 0; sweep < 60; sweep++) {
    let rotated = false;
    for (let a = 0; a < n - 1; a++) {
      for (let b = a + 1; b < n; b++) {
        let alpha = 0, beta = 0, gamma = 0;
        for (let i = 0; i < U[a].length; i++) {
          alpha += U[a][i] * U[a][i];
          beta += U[b][i] * U[b][i];
          gamma += U[a][i] * U[b][i];
        }
        if (gamma === 0 || Math.abs(gamma) <= 1e-16 * Math.sqrt(alpha * beta)) continue;
        rotated = true;
        const zeta = (beta - alpha) / (2 * gamma);
        const t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        for (let i = 0; i < U[a].length; i++) {
          const x = U[a][i];
          U[a][i] = c * x - s * U[b][i];
          U[b][i] = s * x + c * U[b][i];
        }
      }
    }
    if (!rotated) break;
  }
  return U.map(norm2).sort((x, y) => y - x);
}

/** F restricted to chosen components, projected on the tangent directions: one column per tangent direction. */
function tangentColumns(rows: Mat, components: number[], scale?: Vec): Mat {
  return tangentBasis(components.length).map((dir) =>
    rows.map((row, l) => components.reduce((a, c, i) => a + row[c] * dir[i], 0) * (scale ? scale[l] : 1)));
}

function affineRank(rows: Mat, components: number[], rcond: number): number {
  const k = components.length;
  if (k < 2) return k;
  const s = singularValues(tangentColumns(rows, components));
  const cut = rcond * Math.max(s[0], 1e-300);
  return 1 + s.filter((x) => x > cut).length;
}

export function identifiability(prob: Problem, q?: Vec, kktTol = 1e-8, rcond = 1e-10): Identifiability {
  const keep = prob.w.map((x) => x > 0);
  const rows = prob.F.filter((_, l) => keep[l]);
  const all = Array.from({ length: prob.K }, (_, k) => k);
  const rank = affineRank(rows, all, rcond);
  const out: Identifiability = { K: prob.K, affine_rank: rank, structurally_identifiable: rank === prob.K };
  if (!q) return out;
  const p = fitted(prob, q);
  const grad = gradient(prob, p);
  const lam = grad.reduce((a, x, k) => a + x * q[k], 0);
  const A = all.filter((k) => grad[k] - lam >= -kktTol * prob.W);
  const aRank = affineRank(rows, A, rcond);
  out.weakly_active = A;
  out.weakly_active_affine_rank = aRank;
  out.unique_maximizer_certified = aRank === A.length;
  if (A.length >= 2) {
    const scale = prob.w.flatMap((_, l) => {
      if (!keep[l]) return [];
      return [Math.sqrt((prob.wg[l] / p[l] ** 2 + prob.w2g[l] / (1 - p[l]) ** 2) / prob.W)];
    });
    const ev = singularValues(tangentColumns(rows, A, scale)).map((x) => x * x);
    out.curvature_min_per_weight = ev[ev.length - 1];
    out.curvature_max_per_weight = ev[0];
  }
  return out;
}

export type FitStatus = 'converged' | 'stalled' | 'cap';

export interface TracePoint { maps: number; q: Vec; ll: number; gap: number; note: Step['note'] | 'start' }

export interface Fit {
  status: FitStatus;
  q: Vec;
  ll: number;
  maps: number;
  objEvals: number;
  steps: number;
  check: Kkt;
  trace: TracePoint[];
}

/**
 * Runs a solver until the duality gap certifies the optimum. A stall is the failure the gap exists to catch: an exact
 * fixed point (residual 0) that a likelihood or residual criterion would call converged, with mass stuck at zero.
 */
export function fit(prob: Problem, method: 'em' | 'squarem', q0: Vec, keepSupport: boolean, maxMaps = MAX_MAPS, kktTol = KKT_TOL, traceLimit = 500): Fit {
  let q = q0.slice();
  let maps = 0, objEvals = 0, steps = 0;
  const trace: TracePoint[] = [];
  let note: TracePoint['note'] = 'start';
  let check = kkt(prob, q);
  let status: FitStatus;
  // Every early step is kept; later ones geometrically, so a 5,000-map EM run stays a light polyline.
  let nextKeep = 0;
  for (;;) {
    check = kkt(prob, q);
    const stop = check.scaled_gap <= kktTol ? 'converged'
      : check.absorbed_components > 0 && check.fixed_point_residual_l1 <= 1e-13 ? 'stalled'
      : maps >= maxMaps ? 'cap' : null;
    if (steps >= nextKeep || stop) {
      if (trace.length < traceLimit || stop) trace.push({ maps, q, ll: objective(prob, q), gap: check.scaled_gap, note });
      nextKeep = steps < 80 ? steps + 1 : Math.ceil(steps * 1.04);
    }
    if (stop) { status = stop; break; }
    const s = method === 'em' ? emStep(prob, q) : squaremStep(prob, q, keepSupport);
    q = s.q; note = s.note; maps += s.mapEvals; objEvals += s.objEvals; steps += 1;
  }
  return { status, q, ll: objective(prob, q), maps, objEvals, steps, check, trace };
}

// ─── synthetic panels ────────────────────────────────────────────────────────────────────────────────────────────────

export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random allele frequencies for three invented populations. Rounded so the table stays readable and editable. */
export function makePanel(seed: number, markers: number): Mat {
  const r = rng(seed);
  const round = (x: number) => Math.round(x * 100) / 100;
  return Array.from({ length: markers }, () => [round(0.05 + r() * 0.9), round(0.05 + r() * 0.9), round(0.05 + r() * 0.9)]);
}

/** Moves population B toward A: 1 keeps the panel as drawn, 0 makes the two references identical. */
export function applySeparation(F: Mat, separation: number): Mat {
  return F.map(([a, b, c]) => [a, Math.round((a + (b - a) * separation) * 1000) / 1000, c]);
}

/** Two independent alleles per marker, each drawn from the frequency implied by the true composition. */
export function sampleGenotype(F: Mat, qTrue: Vec, seed: number): Vec {
  const r = rng(seed);
  return F.map((row) => {
    const p = row.reduce((a, f, k) => a + f * qTrue[k], 0);
    return (r() < p ? 1 : 0) + (r() < p ? 1 : 0);
  });
}
