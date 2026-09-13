---
phase: 3
slug: endless-descent-difficulty-balance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-08
---

# Phase 3 — Validation Strategy

> Zero-dependency `node:test` (Node 22 built-ins), consistent with Phase 1. Difficulty "feels right / 5–10 min" is a human playtest UAT item deferred to milestone end; everything below is what CAN be asserted automatically, plus a headless simulation proxy to guide tuning.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node 22 built-ins; established in Phase 1) |
| **Quick run command** | `node --test test/unit/` |
| **Full suite command** | `node --test` (all prior 285 + new endless/difficulty tests) |
| **Tuning harness (not a test)** | `node tools/tune-difficulty.mjs` — auto-plays N seeded runs, reports death-depth/action-count distributions |
| **Estimated runtime** | ~6–15 seconds (harness runs separately, on demand) |

---

## Sampling Rate

- **After every task commit:** `node --test test/unit/`
- **After every plan wave:** `node --test` (full suite — all Phase 1 parity/determinism guards must stay green)
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** ~15s

---

## Per-Requirement Verification Map

| Requirement | Criterion | Test Type | Automated Command | Wave 0 | Status |
|-------------|-----------|-----------|-------------------|--------|--------|
| RUN-01 | Run starts a 100%-dice-rolled character, revealed pre-descent | unit (reuse Phase 1 chargen) | `node --test test/unit/newrun.test.js` | ❌ W0 | ⬜ |
| RUN-02 | Endless descent — no floor cap, no Gate ending | unit + parity | `node --test test/unit/endless-descent.test.js` | ❌ W0 | ⬜ |
| RUN-03 | Difficulty scales along a bounded soft-cap curve with breather cadence; no unwinnable spikes | property tests | `node --test test/difficulty/` | ❌ W0 | ⬜ |
| RUN-04 | Permadeath is the sole terminator (no revive/undo/continue) | unit (reuse death) | `node --test test/unit/permadeath.test.js` | ❌ W0 | ⬜ |
| RUN-05 | One action from death state starts a fresh dice-rolled run | unit + adapter | `node --test test/unit/new-run-loop.test.js` | ❌ W0 | ⬜ |
| (determinism) | Endless generation stays seeded/deterministic; Phase 1 parity/round-trip green | regression | `node --test test/parity/ test/roundtrip/ test/determinism/` | exists | ⬜ |

---

## Wave 0 Requirements

- [ ] `test/difficulty/` — property tests for `difficultyCurve(depth)`: monotonic-but-bounded encounter-dot count, dark-blob count, and dark-blob radius (asymptotic caps never exceeded across depth 1..1000); breather floors (every `BREATHER_EVERY`) zero darkness and floor the dot count.
- [ ] `test/difficulty/fairness.test.js` — across a large seed sample at deep floors, generated floors stay within sane hostile-density/darkness bounds (no statistically unwinnable floor at max player power).
- [ ] `test/unit/endless-descent.test.js` — descending past floor 5 continues generating floors; no `winGame`/Gate terminates a run.
- [ ] `test/unit/new-run-loop.test.js` — from a dead GameState, the new-run action yields a fresh valid run (new seed, level I character), and best-depth/score persists in serializable state.
- [ ] `tools/tune-difficulty.mjs` — headless auto-play harness (Node built-ins only): plays many seeded runs with a documented heuristic policy, prints death-depth & action-count distributions. NOT a pass/fail test — a tuning aid; document its output as the proxy signal for the deferred playtest.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Difficulty "feels right" — runs resolve ~5–10 min, never trivial or unfairly unwinnable, played to floor 30–50+ | RUN-03 | Subjective pacing/fun; can only be judged by human play | Play many runs to deep floors; confirm the curve feels fair and sessions land ~5–10 min. Tune the `difficultyCurve` constants (documented knobs) and re-run the harness as needed. |

*Deferred to milestone-end UAT per the autonomous run. The headless harness approximates but does not replace it.*

---

## Validation Sign-Off

- [ ] All RUN reqs map to an `<automated>` verify or a documented manual item
- [ ] Difficulty curve has property tests bounding all unbounded knobs
- [ ] Phase 1 parity/determinism/round-trip suites remain green
- [ ] Tuning harness present and documented
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
