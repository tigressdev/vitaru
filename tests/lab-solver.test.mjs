// Holds the browser solver to engine/ancestry_solver.py on synthetic fixtures. Run with: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { emStep, fit, identifiability, kkt, makeProblem, objective, squaremStep } from '../src/scripts/lab-solver.ts';

const { cases } = JSON.parse(readFileSync(new URL('./lab-fixtures.json', import.meta.url), 'utf8'));
const stats = { q: 0, gap: 0, curvature: 0, finalQ: 0, finalLl: 0, steps: 0, skipped: 0, emRuns: 0, squaremRuns: 0 };

// Once EM barely moves, SQUAREM's acceptance test compares two likelihoods that differ by rounding error, so a different
// summation order may legitimately take the other branch. That covers a true optimum (small gap) and a boundary stall
// (large gap, but the EM step is already about zero). Only behaviour that does not depend on rounding is compared.
const inRoundingRegion = (e) => e.gap_before < 1e-5 || e.residual_before < 1e-6;

const close = (actual, expected, tol, label) => {
  if (actual === expected) return 0;
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol * Math.max(1, Math.abs(expected)), `${label}: ${actual} vs ${expected}`);
  return diff;
};
const closeVec = (a, b, tol, label) => {
  assert.equal(a.length, b.length, label);
  return Math.max(...a.map((x, i) => close(x, b[i], tol, `${label}[${i}]`)));
};

for (const c of cases) {
  const prob = makeProblem(c.F, c.g, c.w);

  test(`${c.name}: objective and step-by-step trajectories`, () => {
    close(objective(prob, c.q0), c.objective, 1e-12, 'objective');
    for (const [label, step] of [
      ['em', (q) => emStep(prob, q)],
      ['squarem_clip', (q) => squaremStep(prob, q, false)],
      ['squarem_keep', (q) => squaremStep(prob, q, true)],
    ]) {
      let q = c.q0;
      for (const [i, expected] of c.traces[label].entries()) {
        if (label !== 'em' && inRoundingRegion(expected)) { stats.skipped += c.traces[label].length - i; break; }
        const s = step(q);
        stats.q = Math.max(stats.q, closeVec(s.q, expected.q, 1e-9, `${label} step ${i}`));
        // Restart from the reference point, so one step's rounding cannot compound into the next comparison.
        q = expected.q;
        stats.steps += 1;
        assert.equal(s.mapEvals, expected.maps, `${label} step ${i} maps`);
        assert.equal(s.objEvals, expected.objs, `${label} step ${i} objective evaluations (gap ${expected.gap_before}, residual ${expected.residual_before})`);
        if (label !== 'em') assert.equal(s.note, expected.note, `${label} step ${i} note`);
      }
    }
  });

  test(`${c.name}: duality gap`, () => {
    const got = kkt(prob, c.probe);
    assert.equal(got.feasible, c.kkt_probe.feasible);
    for (const key of ['duality_gap', 'scaled_gap', 'multiplier', 'fixed_point_residual_l1', 'absorbed_ascent']) {
      const d = close(got[key], c.kkt_probe[key], 1e-7, key);
      if (key === 'scaled_gap') stats.gap = Math.max(stats.gap, d);
    }
    assert.equal(got.absorbed_components, c.kkt_probe.absorbed_components);
    assert.equal(got.zero_components, c.kkt_probe.zero_components);
  });

  test(`${c.name}: identifiability`, () => {
    const bare = identifiability(prob);
    assert.equal(bare.affine_rank, c.identifiability_bare.affine_rank);
    assert.equal(bare.structurally_identifiable, c.identifiability_bare.structurally_identifiable);
    const got = identifiability(prob, c.final);
    const want = c.identifiability;
    assert.deepEqual(got.weakly_active, want.weakly_active);
    assert.equal(got.weakly_active_affine_rank, want.weakly_active_affine_rank);
    assert.equal(got.unique_maximizer_certified, want.unique_maximizer_certified);
    if (want.curvature_min_per_weight !== undefined) {
      stats.curvature = Math.max(stats.curvature, close(got.curvature_min_per_weight, want.curvature_min_per_weight, 1e-9, 'curvature min'));
      close(got.curvature_max_per_weight, want.curvature_max_per_weight, 1e-9, 'curvature max');
    }
  });

  test(`${c.name}: full runs end in the same place`, () => {
    for (const [label, method, keep] of [['em', 'em', true], ['squarem_clip', 'squarem', false], ['squarem_keep', 'squarem', true]]) {
      const got = fit(prob, method, c.q0, keep);
      const want = c.fits[label];
      assert.equal(got.status, want.status, `${label} status`);
      if (method === 'em') {
        // EM has no branches, so even the number of maps must agree.
        assert.equal(got.maps, want.maps, `${label} maps`);
        stats.finalQ = Math.max(stats.finalQ, closeVec(got.q, want.q, 1e-8, `${label} q`));
        stats.emRuns += 1;
      } else {
        // The last extrapolations happen inside the rounding region, so cost may differ slightly. The objective may not.
        const ll = objective(prob, want.q);
        stats.finalLl = Math.max(stats.finalLl, close(got.ll, ll, 1e-7, `${label} log-likelihood`));
        stats.squaremRuns += 1;
      }
    }
  });
}

test('summary', () => {
  console.log(`SUMMARY cases=${cases.length} steps=${stats.steps} skippedInRoundingRegion=${stats.skipped} stepQ=${stats.q.toExponential(2)} scaledGap=${stats.gap.toExponential(2)} curvature=${stats.curvature.toExponential(2)} emFinalQ=${stats.finalQ.toExponential(2)} squaremFinalLl=${stats.finalLl.toExponential(2)} emRuns=${stats.emRuns} squaremRuns=${stats.squaremRuns}`);
});
