"""Writes tests/lab-fixtures.json: what engine/ancestry_solver.py returns on synthetic problems.

Run from the research repository, where the engine lives:  python site/tests/generate_lab_fixtures.py
Synthetic data only. The browser port in src/scripts/lab-solver.ts is held to these numbers.
"""
import json
import os
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
from engine.ancestry_solver import Problem, em_map, identifiability, kkt, objective, squarem_map  # noqa: E402

STEPS = 25
KKT_KEYS = ["feasible", "duality_gap", "scaled_gap", "multiplier", "fixed_point_residual_l1", "absorbed_ascent",
            "absorbed_components", "zero_components"]


def drive(prob, method, q0, keep, max_maps=5000, tol=1e-9):
    """The Lab's stopping rule, written out independently of the TypeScript."""
    step = em_map(prob) if method == "em" else squarem_map(prob, keep_support=keep)
    check, q, maps = kkt(prob), np.array(q0, dtype=float), 0
    while True:
        c = check(q)
        if c["scaled_gap"] <= tol:
            status = "converged"
        elif c["absorbed_components"] > 0 and c["fixed_point_residual_l1"] <= 1e-13:
            status = "stalled"
        elif maps >= max_maps:
            status = "cap"
        else:
            s = step(q)
            q, maps = s.q, maps + s.map_evals
            continue
        return {"status": status, "q": q.tolist(), "maps": maps, "gap": c["scaled_gap"]}


def case(name, F, g, w, q0):
    prob = Problem(np.array(F, dtype=float), np.array(g, dtype=float), np.array(w, dtype=float))
    q0 = np.array(q0, dtype=float)
    em, sq_clip, sq_keep = em_map(prob), squarem_map(prob, keep_support=False), squarem_map(prob, keep_support=True)
    traces = {}
    for label, stepper in (("em", em), ("squarem_clip", sq_clip), ("squarem_keep", sq_keep)):
        q, trace = q0.copy(), []
        for _ in range(STEPS):
            before = kkt(prob)(q)
            s = stepper(q)
            q = s.q
            trace.append({"q": q.tolist(), "note": s.note.split(" ")[0], "maps": s.map_evals, "objs": s.obj_evals,
                          "gap_before": before["scaled_gap"], "residual_before": before["fixed_point_residual_l1"]})
        traces[label] = trace
    probe = np.array(traces["squarem_keep"][-1]["q"])
    fits = {
        "em": drive(prob, "em", q0, True),
        "squarem_clip": drive(prob, "squarem", q0, False),
        "squarem_keep": drive(prob, "squarem", q0, True),
    }
    final = np.array(fits["squarem_keep"]["q"])
    return {
        "name": name, "F": np.asarray(F, dtype=float).tolist(), "g": list(map(float, g)), "w": list(map(float, w)), "q0": q0.tolist(),
        "objective": objective(prob)(q0), "traces": traces,
        "kkt_probe": {k: v for k, v in kkt(prob)(probe).items() if k in KKT_KEYS}, "probe": probe.tolist(),
        "identifiability_bare": identifiability(prob), "identifiability": identifiability(prob, final), "final": final.tolist(),
        "fits": fits,
    }


def simulate(rng, L, K, q=None):
    F = rng.beta(0.8, 0.8, size=(L, K))
    q = rng.dirichlet(np.ones(K)) if q is None else np.array(q, dtype=float)
    g = rng.binomial(2, np.clip(F @ q, 0.001, 0.999), size=L).astype(float)
    return F, g, q


def build():
    cases = []
    rng = np.random.default_rng(20261109)
    for L, K in [(8, 2), (24, 3), (24, 3), (60, 3), (60, 5), (120, 5)]:
        F, g, _ = simulate(rng, L, K)
        cases.append(case(f"random_L{L}_K{K}_{len(cases)}", F, g, np.ones(L), np.full(K, 1 / K)))
    F, g, _ = simulate(rng, 40, 3)
    cases.append(case("fractional_weights", F, g, rng.uniform(0.1, 2.0, size=40), np.full(3, 1 / 3)))
    w = np.ones(40); w[::4] = 0.0
    cases.append(case("zero_weights", F, g, w, [0.5, 0.3, 0.2]))
    F, g, _ = simulate(rng, 24, 3, q=[0.5, 0.4, 0.1])
    F[:, 1] = F[:, 0]
    cases.append(case("identical_references", F, g, np.ones(24), [0.6, 0.1, 0.3]))
    F2 = F.copy(); F2[:, 1] = np.clip(F[:, 0] + rng.normal(0, 0.02, size=24), 0, 1)
    cases.append(case("near_identical_references", F2, g, np.ones(24), [0.6, 0.1, 0.3]))
    F, g, _ = simulate(rng, 30, 3, q=[0.7, 0.3, 0.0])
    cases.append(case("boundary_optimum", F, g, np.ones(30), np.full(3, 1 / 3)))
    F, g, _ = simulate(rng, 24, 3)
    F[:4] = 0.0; F[4:8] = 1.0
    cases.append(case("clipped_extremes", F, g, np.ones(24), np.full(3, 1 / 3)))
    F, g, _ = simulate(rng, 30, 4)
    cases.append(case("start_with_exact_zero", F, g, np.ones(30), [0.0, 0.5, 0.3, 0.2]))
    # Linearly dependent but not duplicated: the third reference is the average of the first two.
    F, g, _ = simulate(rng, 24, 3)
    F[:, 2] = (F[:, 0] + F[:, 1]) / 2
    cases.append(case("affine_dependence", F, g, np.ones(24), [0.5, 0.25, 0.25]))
    return cases


if __name__ == "__main__":
    target = os.path.join(os.path.dirname(__file__), "lab-fixtures.json")
    with open(target, "w", encoding="ascii") as fh:
        json.dump({"source": "engine/ancestry_solver.py", "steps": STEPS, "cases": build()}, fh, separators=(",", ":"))
    print("wrote", target, os.path.getsize(target) // 1024, "KB")
