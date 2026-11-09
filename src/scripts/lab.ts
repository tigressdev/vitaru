import { labDicts } from '../content/lab';
import { applySeparation, fit, identifiability, makePanel, makeProblem, objective, sampleGenotype, type Fit, type Identifiability, type Problem, type TracePoint } from './lab-solver';

const lang = (document.body.dataset.lang === 'en' ? 'en' : 'ru') as 'ru' | 'en';
const T = labDicts[lang];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.querySelector<HTMLElement>('[data-lab]')!;
const $ = <E extends Element = HTMLElement>(s: string) => root.querySelector<E>(s)!;
const $$ = <E extends Element = HTMLElement>(s: string) => [...root.querySelectorAll<E>(s)];

const MARKERS = 24;
const Q0 = [1 / 3, 1 / 3, 1 / 3];
const STARTS = [Q0, [0.9, 0.05, 0.05], [0.05, 0.9, 0.05], [0.05, 0.05, 0.9], [0.45, 0.45, 0.1], [0.1, 0.45, 0.45]];
const DRAWS = 30;
const EM_COLOR = '#1D9E75', SQ_COLOR = '#a970ff'; // validated pair on the chart surface

interface Preset { seed: number; q: number[]; sep: number; keep: boolean }
// Seeds were searched so that each scenario shows its behaviour with the real solver; nothing is scripted.
const PRESETS: Record<string, Preset> = {
  separated: { seed: 7, q: [0.6, 0.3, 0.1], sep: 1, keep: true },
  similar: { seed: 7, q: [0.45, 0.45, 0.1], sep: 0.2, keep: true },
  identical: { seed: 7, q: [0.45, 0.45, 0.1], sep: 0, keep: true },
  stall: { seed: 1, q: [0.72, 0.28, 0], sep: 1, keep: false },
};

interface State { preset: string; base: number[][]; q: number[]; sep: number; keep: boolean; genoSeed: number; g: number[]; playhead: number }
interface Result { prob: Problem; em: Fit; sq: Fit; starts: Fit[]; draws: number[][]; id: Identifiability; sd: number[] }

let S: State;
let R: Result;
let anim = 0;

// ─── formatting ──────────────────────────────────────────────────────────────
const dec = (s: string) => (lang === 'ru' ? s.replace('.', ',') : s).replace('-', '−');
const num = (x: number, d = 3) => dec(x.toFixed(d));
const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function sci(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  if (x === 0) return '0';
  if (x >= 0.01 && x < 1000) return num(x, x < 1 ? 3 : 1);
  const [m, e] = x.toExponential(1).split('e');
  return `${dec(m)}×10${String(Number(e)).replace(/[-\d]/g, (c) => SUP[c])}`;
}
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
const esc = (v: unknown) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// ─── solving ─────────────────────────────────────────────────────────────────
const currentF = () => applySeparation(S.base, S.sep);
function resample() { S.g = sampleGenotype(currentF(), S.q, S.genoSeed); }

function solve() {
  const F = currentF();
  const prob = makeProblem(F, S.g);
  const em = fit(prob, 'em', Q0, true);
  const sq = fit(prob, 'squarem', Q0, S.keep);
  const starts = STARTS.map((q) => fit(prob, 'squarem', q, S.keep, 5000, 1e-9, 2));
  // Sampling spread: the same true mixture, new genotypes. This is how practical identifiability is meant to be read.
  const draws = Array.from({ length: DRAWS }, (_, i) => fit(makeProblem(F, sampleGenotype(F, S.q, S.genoSeed + 1 + i)), 'squarem', Q0, true, 5000, 1e-9, 2).q);
  const sd = [0, 1, 2].map((k) => {
    const mean = draws.reduce((a, d) => a + d[k], 0) / DRAWS;
    return Math.sqrt(draws.reduce((a, d) => a + (d[k] - mean) ** 2, 0) / (DRAWS - 1));
  });
  R = { prob, em, sq, starts, draws, id: identifiability(prob, sq.q), sd };
}

const maxMaps = () => Math.max(R.em.maps, R.sq.maps, 1);
const mapsAt = (ph: number) => (ph >= 1 ? Infinity : 10 ** (ph * Math.log10(maxMaps() + 1)) - 1);
function pointAt(f: Fit, maps: number): TracePoint {
  let best = f.trace[0];
  for (const p of f.trace) { if (p.maps <= maps) best = p; else break; }
  return best;
}

// ─── ternary ─────────────────────────────────────────────────────────────────
const ternaryBox = $('[data-ternary]');
const heat = $<HTMLCanvasElement>('[data-heat]');
const overlay = $<SVGSVGElement>('[data-overlay]');
const ternTip = $('[data-tip]');
let geom = { w: 400, h: 370, A: [200, 28], B: [36, 330], C: [364, 330] };

function measureTernary() {
  const w = ternaryBox.clientWidth;
  const side = Math.min(w - 64, 520);
  const h = side * 0.866 + 60;
  const cx = w / 2;
  geom = { w, h, A: [cx, 28], B: [cx - side / 2, 28 + side * 0.866], C: [cx + side / 2, 28 + side * 0.866] };
  ternaryBox.style.height = `${h}px`;
  overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
  overlay.setAttribute('width', String(w));
  overlay.setAttribute('height', String(h));
}

const xy = (q: number[]) => [
  q[0] * geom.A[0] + q[1] * geom.B[0] + q[2] * geom.C[0],
  q[0] * geom.A[1] + q[1] * geom.B[1] + q[2] * geom.C[1],
];

function bary(x: number, y: number): number[] {
  const { A, B, C } = geom;
  const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
  const a = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d;
  const b = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d;
  return [a, b, 1 - a - b];
}

// One neutral sequential ramp, so the coloured solver paths stay legible on top of it.
const RAMP: [number, [number, number, number]][] = [
  [-0.5, [150, 176, 170]], [-1, [128, 154, 149]], [-2, [106, 131, 127]], [-4, [85, 108, 105]],
  [-8, [65, 86, 84]], [-16, [47, 65, 64]], [-32, [31, 46, 46]],
];
const FLOOR: [number, number, number] = [18, 29, 29];

function drawHeat() {
  const cols = Math.min(240, Math.round(geom.w));
  const rows = Math.round((cols * geom.h) / geom.w);
  heat.width = cols; heat.height = rows;
  heat.style.width = `${geom.w}px`; heat.style.height = `${geom.h}px`;
  const ctx = heat.getContext('2d')!;
  const img = ctx.createImageData(cols, rows);
  const scale = geom.w / cols;
  const top = R.sq.status === 'converged' ? R.sq.ll : Math.max(R.sq.ll, R.em.ll);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const q = bary((c + 0.5) * scale, (r + 0.5) * scale);
      if (q.some((x) => x < -0.004)) continue;
      const rel = objective(R.prob, q.map((x) => Math.max(x, 0))) - top;
      const color = RAMP.find(([t]) => rel >= t)?.[1] ?? FLOOR;
      const i = (r * cols + c) * 4;
      img.data[i] = color[0]; img.data[i + 1] = color[1]; img.data[i + 2] = color[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const path = (pts: number[][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

function drawOverlay() {
  const { A, B, C } = geom;
  const maps = mapsAt(S.playhead);
  const visible = (f: Fit) => f.trace.filter((p) => p.maps <= maps).map((p) => xy(p.q));
  const emPts = visible(R.em), sqPts = visible(R.sq);
  const grid = [0.25, 0.5, 0.75].flatMap((t) => [
    [[t, 1 - t, 0], [t, 0, 1 - t]], [[1 - t, t, 0], [0, t, 1 - t]], [[1 - t, 0, t], [0, 1 - t, t]],
  ]).map(([a, b]) => `<line x1="${xy(a)[0]}" y1="${xy(a)[1]}" x2="${xy(b)[0]}" y2="${xy(b)[1]}" stroke="rgba(5,14,8,.35)"/>`).join('');
  const [tx, ty] = xy(S.q);
  const emEnd = emPts[emPts.length - 1], sqEnd = sqPts[sqPts.length - 1];
  overlay.innerHTML = `
    ${grid}
    <path d="${path([A, B, C])}Z" fill="none" stroke="rgba(238,244,240,.4)"/>
    <text x="${A[0]}" y="${A[1] - 10}" class="v" text-anchor="middle">${T.ternary.populations[0]}</text>
    <text x="${B[0] - 12}" y="${B[1] + 18}" class="v" text-anchor="middle">${T.ternary.populations[1]}</text>
    <text x="${C[0] + 12}" y="${C[1] + 18}" class="v" text-anchor="middle">${T.ternary.populations[2]}</text>
    ${R.draws.map((d) => { const [x, y] = xy(d); return `<circle cx="${x}" cy="${y}" r="2.6" fill="#eef4f0" fill-opacity=".62" stroke="#07110d" stroke-width=".6"/>`; }).join('')}
    ${R.starts.map((f) => { const [x, y] = xy(f.q); return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#fff" stroke-width="1.4"/>`; }).join('')}
    <path d="${path(emPts)}" fill="none" stroke="#07110d" stroke-width="5" stroke-linejoin="round"/>
    <path d="${path(emPts)}" fill="none" stroke="${EM_COLOR}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="${path(sqPts)}" fill="none" stroke="#07110d" stroke-width="5" stroke-linejoin="round"/>
    <path d="${path(sqPts)}" fill="none" stroke="${SQ_COLOR}" stroke-width="2.4" stroke-linejoin="round"/>
    ${sqPts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${SQ_COLOR}" stroke="#07110d"/>`).join('')}
    ${emEnd ? `<circle cx="${emEnd[0]}" cy="${emEnd[1]}" r="6.5" fill="${EM_COLOR}" stroke="#07110d" stroke-width="2"/>` : ''}
    ${sqEnd ? `<rect x="${sqEnd[0] - 5.5}" y="${sqEnd[1] - 5.5}" width="11" height="11" fill="${SQ_COLOR}" stroke="#07110d" stroke-width="2" transform="rotate(45 ${sqEnd[0]} ${sqEnd[1]})"/>` : ''}
    <path d="M${tx - 9} ${ty}H${tx + 9}M${tx} ${ty - 9}V${ty + 9}" stroke="#07110d" stroke-width="4"/>
    <path d="M${tx - 9} ${ty}H${tx + 9}M${tx} ${ty - 9}V${ty + 9}" stroke="#fff" stroke-width="1.8"/>`;
}

function pointerQ(e: PointerEvent) {
  const r = overlay.getBoundingClientRect();
  return bary(e.clientX - r.left, e.clientY - r.top);
}
overlay.addEventListener('pointermove', (e) => {
  const q = pointerQ(e);
  if (q.some((x) => x < 0)) { ternTip.hidden = true; return; }
  const top = Math.max(R.sq.ll, R.em.ll);
  ternTip.textContent = `A ${num(q[0], 2)} · B ${num(q[1], 2)} · C ${num(q[2], 2)}\n${num(top - objective(R.prob, q), 2)} ${T.ternary.tip}`;
  ternTip.hidden = false;
  const r = ternaryBox.getBoundingClientRect();
  ternTip.style.left = `${Math.min(r.width - 190, Math.max(4, e.clientX - r.left + 14))}px`;
  ternTip.style.top = `${Math.max(4, e.clientY - r.top - 48)}px`;
});
overlay.addEventListener('pointerleave', () => { ternTip.hidden = true; });
overlay.addEventListener('click', (e) => {
  const q = pointerQ(e);
  if (q.some((x) => x < -0.02)) return;
  const clean = q.map((x) => Math.round(Math.max(x, 0) * 100) / 100);
  clean[2] = Math.max(0, Math.round((1 - clean[0] - clean[1]) * 100) / 100);
  S.q = clean;
  markCustom();
  resample();
  runAll(false);
});

// ─── convergence chart ───────────────────────────────────────────────────────
const plot = $('[data-plot]');
const plotTip = $('[data-plot-tip]');
const M = { l: 48, r: 18, t: 12, b: 26 };
const Y_MIN = -14, Y_MAX = 1;
const xOf = (maps: number, W: number) => M.l + (Math.log10(maps + 1) / Math.log10(5001)) * (W - M.l - M.r);
const yOf = (gap: number, H: number) => {
  const v = Math.max(Y_MIN, Math.min(Y_MAX, gap > 0 ? Math.log10(gap) : Y_MIN));
  return M.t + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - M.t - M.b);
};
const superscript = (n: number) => String(n).replace(/[-\d]/g, (c) => SUP[c]);

function drawPlot() {
  const W = plot.clientWidth, H = 280;
  const maps = mapsAt(S.playhead);
  const line = (f: Fit) => f.trace.filter((p) => p.maps <= maps).map((p) => [xOf(p.maps, W), yOf(p.gap, H)]);
  const yTicks = [0, -3, -6, -9, -12].map((v) => {
    const y = yOf(10 ** v, H);
    return `<line x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}" stroke="rgba(238,244,240,.1)"/><text x="${M.l - 8}" y="${y + 4}" text-anchor="end" class="t">10${superscript(v)}</text>`;
  }).join('');
  const xTicks = [0, 10, 100, 1000, 5000].map((m) => `<text x="${xOf(m, W)}" y="${H - 6}" text-anchor="middle" class="t">${m}</text>`).join('');
  const tol = yOf(1e-9, H);
  const emL = line(R.em), sqL = line(R.sq);
  const end = (pts: number[][], f: Fit, color: string, name: string, shift: number) => {
    if (!pts.length) return '';
    const [x, y] = pts[pts.length - 1];
    const left = x > W - 110;
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="#07110d" stroke-width="2"/><text x="${x + (left ? -9 : 9)}" y="${y + shift}" text-anchor="${left ? 'end' : 'start'}" class="d">${name}</text>`;
  };
  const closeEnds = emL.length && sqL.length && Math.abs(emL[emL.length - 1][1] - sqL[sqL.length - 1][1]) < 16 && Math.abs(emL[emL.length - 1][0] - sqL[sqL.length - 1][0]) < 90;
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-plot-svg role="img" aria-label="${esc(T.chart.title)}">
    ${yTicks}${xTicks}
    <line x1="${M.l}" x2="${W - M.r}" y1="${tol}" y2="${tol}" stroke="rgba(245,165,90,.75)" stroke-dasharray="5 5"/>
    <text x="${W - M.r}" y="${tol - 6}" text-anchor="end" class="a">${esc(T.chart.tolerance)}</text>
    <path d="${path(emL)}" fill="none" stroke="${EM_COLOR}" stroke-width="2" stroke-linejoin="round"/>
    <path d="${path(sqL)}" fill="none" stroke="${SQ_COLOR}" stroke-width="2" stroke-linejoin="round"/>
    ${end(emL, R.em, EM_COLOR, `EM ${R.em.maps}`, closeEnds ? 15 : 4)}
    ${end(sqL, R.sq, SQ_COLOR, `SQUAREM ${R.sq.maps}`, closeEnds ? -7 : 4)}
    <line data-cross x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" stroke="rgba(238,244,240,.35)" visibility="hidden"/>
  </svg>`;
  plot.querySelector('svg')?.remove();
  plot.insertAdjacentHTML('afterbegin', svg);
}

plot.addEventListener('pointermove', (e) => {
  const r = plot.getBoundingClientRect();
  const W = r.width;
  const frac = (e.clientX - r.left - M.l) / (W - M.l - M.r);
  if (frac < 0 || frac > 1) return;
  const m = 10 ** (frac * Math.log10(5001)) - 1;
  const a = pointAt(R.em, m), b = pointAt(R.sq, m);
  const cross = plot.querySelector<SVGLineElement>('[data-cross]')!;
  cross.setAttribute('x1', String(xOf(m, W))); cross.setAttribute('x2', String(xOf(m, W))); cross.setAttribute('visibility', 'visible');
  plotTip.textContent = `${Math.round(m)} ${T.chart.maps}\nEM: ${sci(a.gap)}\nSQUAREM: ${sci(b.gap)}`;
  plotTip.hidden = false;
  plotTip.style.left = `${Math.min(W - 170, Math.max(4, e.clientX - r.left + 12))}px`;
  plotTip.style.top = '14px';
});
plot.addEventListener('pointerleave', () => {
  plotTip.hidden = true;
  plot.querySelector('[data-cross]')?.setAttribute('visibility', 'hidden');
});

// ─── text panels ─────────────────────────────────────────────────────────────
function renderVerdict() {
  const v = T.verdict, { sq, starts, id, sd } = R;
  const stalled = sq.status === 'stalled';
  const unique = !!id.unique_maximizer_certified;
  $('[data-headline]').textContent = stalled ? v.headlines.stall : unique ? v.headlines.unique : v.headlines.nonUnique;
  const ok = starts.filter((f) => f.status === 'converged').length;
  const lls = starts.map((f) => f.ll);
  const spread = Math.max(...[0, 1, 2].map((k) => Math.max(...starts.map((f) => f.q[k])) - Math.min(...starts.map((f) => f.q[k]))));
  const opt = sq.status === 'converged' ? ['ok', fill(v.optimalityYes, { gap: sci(sq.check.scaled_gap) })]
    : stalled ? ['bad', fill(v.optimalityStall, { gap: sci(sq.check.scaled_gap), n: sq.check.absorbed_components })]
    : ['warn', fill(v.optimalityCap, { gap: sci(sq.check.scaled_gap) })];
  const rows: [string, string, string][] = [
    [v.optimality, opt[0], opt[1]],
    [v.starts, ok === 6 && spread < 1e-3 ? 'ok' : 'warn', fill(v.startsBody, { ok, ll: sci(Math.max(...lls) - Math.min(...lls)), spread: num(spread) })],
    [v.structural, id.structurally_identifiable ? 'ok' : 'bad', fill(id.structurally_identifiable ? v.structuralYes : v.structuralNo, { r: id.affine_rank })],
    [v.unique, unique ? 'ok' : 'bad', unique ? v.uniqueYes : v.uniqueNo],
    [v.practical, 'info', fill(v.practicalBody, { c: id.curvature_min_per_weight === undefined ? '—' : sci(id.curvature_min_per_weight), a: num(sd[0], 2), b: num(sd[1], 2), cc: num(sd[2], 2) })],
  ];
  const glyph: Record<string, string> = { ok: '●', warn: '△', bad: '✕', info: '○' };
  $('[data-verdict]').innerHTML = rows.map(([q, cls, body]) => `<div><dt><i class="${cls}" aria-hidden="true">${glyph[cls]}</i>${esc(q)}</dt><dd>${esc(body)}</dd></div>`).join('');
}

function renderRun() {
  const maps = mapsAt(S.playhead);
  const row = (name: string, f: Fit, color: string) => {
    const p = pointAt(f, maps);
    const done = p.maps >= f.maps;
    const status = done ? T.table.status[f.status] : T.table.running;
    return `<tr><th scope="row"><i class="dotk" style="background:${color}"></i>${name}</th><td>${esc(status)}</td><td class="num">${p.maps}</td><td class="num">${num(p.ll, 4)}</td><td class="num">${sci(p.gap)}</td>${p.q.map((x) => `<td class="num">${num(x)}</td>`).join('')}</tr>`;
  };
  const h = T.table.head;
  $('[data-run]').innerHTML = `<thead><tr>${h.map((x, i) => `<th${i > 1 ? ' class="num"' : ''}>${esc(x)}</th>`).join('')}</tr></thead><tbody>${row('EM', R.em, EM_COLOR)}${row('SQUAREM', R.sq, SQ_COLOR)}</tbody>`;
  const current = Math.min(maps, maxMaps());
  $('[data-out=maps]').textContent = String(Math.round(current));
}

// ─── matrix ──────────────────────────────────────────────────────────────────
function buildMatrix() {
  const m = T.matrix, pops = T.ternary.populations;
  const body = S.base.map((row, l) => `<tr><th scope="row">${l + 1}</th>${row.map((_, k) => `<td><input type="number" min="0" max="1" step="0.01" data-cell="${l}:${k}" aria-label="${esc(fill(m.aria, { m: l + 1, p: pops[k] }))}"/></td>`).join('')}<td><button type="button" class="d-mini gbtn" data-geno="${l}"></button></td></tr>`).join('');
  $('[data-matrix]').innerHTML = `<thead><tr><th>${esc(m.marker)}</th>${pops.map((p) => `<th>${p}</th>`).join('')}<th>${esc(m.genotype)}</th></tr></thead><tbody>${body}</tbody>`;
}

function syncMatrix() {
  const F = currentF();
  for (const input of $$<HTMLInputElement>('[data-cell]')) {
    const [l, k] = input.dataset.cell!.split(':').map(Number);
    input.disabled = k === 1 && S.sep < 1; // B is derived from A while the separation slider is in use
    if (document.activeElement !== input) input.value = String(F[l][k]);
  }
  for (const b of $$<HTMLButtonElement>('[data-geno]')) {
    const l = Number(b.dataset.geno);
    b.textContent = String(S.g[l]);
    b.setAttribute('aria-label', fill(T.matrix.ariaG, { m: l + 1, v: S.g[l] }));
  }
}

// ─── controls and flow ───────────────────────────────────────────────────────
function syncControls() {
  const set = (name: string, value: number) => { $<HTMLInputElement>(`[data-input=${name}]`).value = String(value); };
  set('sep', Math.round(S.sep * 100));
  set('a', Math.round(S.q[0] * 100));
  set('b', Math.round(S.q[1] * 100));
  $<HTMLInputElement>('[data-input=keep]').checked = S.keep;
  $('[data-out=sep]').textContent = `${Math.round(S.sep * 100)}%`;
  $('[data-out=a]').textContent = num(S.q[0], 2);
  $('[data-out=b]').textContent = num(S.q[1], 2);
  for (const b of $$('[data-preset]')) b.setAttribute('aria-pressed', String(b.dataset.preset === S.preset));
}

function markCustom() { S.preset = 'custom'; }

function paintPlayhead() {
  drawOverlay();
  drawPlot();
  renderRun();
  $<HTMLInputElement>('[data-input=scrub]').value = String(Math.round(S.playhead * 1000));
}

function stopAnim() {
  cancelAnimationFrame(anim);
  anim = 0;
  $('[data-act=play]').textContent = T.controls.play;
}

function play() {
  if (anim) { stopAnim(); return; }
  if (reducedMotion) { S.playhead = 1; paintPlayhead(); return; }
  $('[data-act=play]').textContent = T.controls.pause;
  const start = performance.now();
  const from = S.playhead >= 1 ? 0 : S.playhead;
  const tick = (t: number) => {
    S.playhead = Math.min(1, from + (t - start) / 3600);
    paintPlayhead();
    if (S.playhead < 1) anim = requestAnimationFrame(tick);
    else stopAnim();
  };
  anim = requestAnimationFrame(tick);
}

function runAll(animate: boolean) {
  stopAnim();
  solve();
  S.playhead = 1;
  syncControls();
  syncMatrix();
  drawHeat();
  renderVerdict();
  paintPlayhead();
  if (animate) play();
}

let pending = 0;
const scheduleRun = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => runAll(false)); };

function loadPreset(name: string, animate: boolean) {
  const p = PRESETS[name];
  S = { preset: name, base: makePanel(p.seed, MARKERS), q: p.q.slice(), sep: p.sep, keep: p.keep, genoSeed: p.seed + 1000, g: [], playhead: 1 };
  resample();
  buildMatrix();
  runAll(animate);
}

for (const b of $$('[data-preset]')) b.addEventListener('click', () => loadPreset(b.dataset.preset!, true));

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const name = el.dataset.input;
  if (name === 'scrub') { stopAnim(); S.playhead = Number(el.value) / 1000; paintPlayhead(); return; }
  if (name === 'sep') { S.sep = Number(el.value) / 100; markCustom(); resample(); scheduleRun(); return; }
  if (name === 'a' || name === 'b') {
    const v = Number(el.value) / 100;
    const other = name === 'a' ? S.q[1] : S.q[0];
    const clamped = Math.min(other, 1 - v);
    S.q = name === 'a' ? [v, clamped, 0] : [clamped, v, 0];
    S.q[2] = Math.max(0, Math.round((1 - S.q[0] - S.q[1]) * 100) / 100);
    markCustom(); resample(); scheduleRun(); return;
  }
  if (name === 'keep') { S.keep = el.checked; markCustom(); scheduleRun(); return; }
  if (el.dataset.cell) {
    const [l, k] = el.dataset.cell.split(':').map(Number);
    const v = Number(el.value);
    if (el.value === '' || !Number.isFinite(v) || v < 0 || v > 1) return;
    S.base[l][k] = v;
    markCustom(); resample(); scheduleRun();
  }
});

root.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-geno]');
  if (!el) return;
  if (el.dataset.act === 'play') play();
  if (el.dataset.act === 'sample') { S.genoSeed += 101; markCustom(); resample(); runAll(true); }
  if (el.dataset.geno) { const l = Number(el.dataset.geno); S.g[l] = (S.g[l] + 1) % 3; markCustom(); runAll(false); }
});

for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]')) {
  a.addEventListener('click', () => {
    try { localStorage.setItem('vc-lang', a.dataset.langLink!); } catch { /* storage unavailable */ }
  });
}

new ResizeObserver(() => { if (R) { measureTernary(); drawHeat(); paintPlayhead(); } }).observe(root);

measureTernary();
loadPreset('identical', false);
