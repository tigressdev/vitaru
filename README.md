# VitaCodex website and patient demo (prototype)

Bilingual static site, separate from the original pitch. Russian is the default; English is one click away.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

## Structure

| Route | Content |
|---|---|
| `/`, `/ru`, `/en` | Two tabs: **Business** (cycle hero, raw-to-decision slider, problem, buyers) and **Proof** (data moat, quality criteria, ancestry chart, corrections, status) |
| `/ru/demo`, `/en/demo` | Working demo with the fictional patient Alexey Ivanov: file, results, labs, doctor, API, plus a guided tour |

`/` shows Russian on a first visit and redirects to `/en` only if the visitor previously clicked EN. `navigator.language` is
never read. Text lives in `src/content/`; the build fails if the RU and EN structures differ, including array lengths.

## What came from the pitch

`_refs/pitchdeck0` is the repository behind pitchapp.vitacodex.life, according to `RETOMADA.md`.

| Reused | Where |
|---|---|
| `TriadCycle`: orbit geometry, 3 s step advance, 9 s dot, arc drawing, panel swap, tabs | `components/Cycle.astro`, `scripts/cycle.ts` |
| `TransformDemo`: slider, reveal thresholds, typing, auto-play rate, terminal, pipeline | `components/Transform.astro`, `scripts/transform.ts` |
| Colours, grid, easing, wordmark, JetBrains Mono | `styles/` |

Deliberate changes to match the current model: Outfit, Syne and DM Sans have no Cyrillic, so Geologica and Onest replace them.
Confidence percentages became counts of catalog rows, "model reinforced" became "new results reopen the cycle", and labs
"observe" rather than "confirm". The "Clinical Sync" label, which the pitch clips at the SVG edge, is no longer cut off.

The Carolina demo lives at demoapp.vitacodex.life (`_refs/vitacodex`), with an evolution in `app/`. Both are left untouched.

## The Alexey Ivanov demo: what is real

| Real | Fictional or simulated |
|---|---|
| Variant IDs, publication and row counts, directions, allele frequencies, study ancestry: read from `data/consolidated` and `data/staged/gwas` | The patient, his genotypes and his lab values |
| The eight-state vocabulary and `ClinicalGateResult` shape from `docs/architecture/CLINICAL_CONFIDENCE_GATE.md` | State assignment: done by hand, because no grading thresholds exist yet |
| Sensitive findings hidden by default; no percentage from an odds ratio | Doctor decisions and the API response, generated in the browser |

The clinical gate itself is design only. The demo shows target behaviour, and the page says so.

## Where the numbers come from

| Topic | Source |
|---|---|
| GWAS Catalog profile | `reports/profile_gwas.md` |
| Russian recruitment, 197 of 232,261 studies | `data/staged/gwas/ancestries.parquet` |
| Sources and layer sizes | `docs/MEMORIAL_DESCRITIVO.md` §4–5 |
| rs7903146, variant registry | `reports/consolidated/CONSOLIDATED_CHECKS.md` |
| Ancestry v2 | `reports/ancestry/AADR_VALIDATION.md` (copied into `src/content/ancestry-loo.ts`) |
| Withdrawn results | `reports/models/INVESTIGATION.md`, `reports/models/C_NEGATIVE_SAMPLING_CORRECTION.md` |
| Revenue scenarios, buyers, interview quotes | `_refs/pitchdeck0/src/data.ts`; FIAP 2026 hypotheses for Brazil, no contracts |

The pitch's market sizes ($35B, $12B, $80M) are not used, because the repository gives no source for them.

## Deploying

Production runs from the `main` branch of `tigressdev/vitaru`, served at demoru.vitacodex.life. `vercel.json` declares the
build, the clean URLs and the redirect from the old `/demoapp/*` routes. The source of truth is the `site/` folder of the
private research repository, and `vitaru` holds a copy of its contents at the repository root.
