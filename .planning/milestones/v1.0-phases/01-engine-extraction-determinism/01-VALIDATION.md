---
phase: 1
slug: engine-extraction-determinism
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Zero runtime dependencies (matches prototype ethos); all test tooling is Node 22 built-ins per `01-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node 22 built-ins; v22.23.2 confirmed installed) — no jest/vitest/jsdom dependency |
| **Config file** | none — package.json `"type": "module"` + a `test` script; Wave 0 establishes it |
| **Quick run command** | `node --test test/unit/` |
| **Full suite command** | `node --test` (unit + determinism + round-trip + prototype-parity) |
| **Estimated runtime** | ~5–15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/unit/`
- **After every plan wave:** Run `node --test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green, including the prototype-parity harness
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Seed mapping of the 5 phase requirements to concrete automated test types. The planner refines per-task rows (Task IDs) during planning; every ENG requirement below must land on at least one `<automated>` verify.

| Requirement | Success Criterion | Test Type | Automated Command | File (Wave 0 stub) | Status |
|-------------|-------------------|-----------|-------------------|--------------------|--------|
| ENG-01 | Rules only via `applyAction`; no DOM/render/storage in engine | static + unit | `node --test test/unit/engine-purity.test.js` | ❌ W0 | ⬜ pending |
| ENG-02 | Same seed + actions → byte-identical state; no `Math.random()` in rules | determinism | `node --test test/determinism/` | ❌ W0 | ⬜ pending |
| ENG-03 | All content in pure data tables, no content hardcoded in logic | unit | `node --test test/unit/content-tables.test.js` | ❌ W0 | ⬜ pending |
| ENG-04 | Serialize/rehydrate round-trip lossless at multiple run points | round-trip | `node --test test/roundtrip/` | ❌ W0 | ⬜ pending |
| ENG-05 | Full playthrough via engine matches prototype (no regressions) | parity (golden-master) | `node --test test/parity/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — `"type": "module"`, `"test": "node --test"` (no runtime deps)
- [ ] `test/unit/` — stubs for ENG-01 (engine purity), ENG-03 (content tables)
- [ ] `test/determinism/` — seeded-run byte-identical harness for ENG-02 (strip the 4 `Date.now()` sites: `S.deathAt`, graveyard `when`, `AGAIN_LOCK`)
- [ ] `test/roundtrip/` — `structuredClone`/JSON full-state round-trip guardrail for ENG-04 (kept green through Phases 2–5)
- [ ] `test/parity/` — `node:vm` sandbox that loads the unmodified prototype `<script>` and diffs an action-trace against the extracted engine, for ENG-05
- [ ] `test/fixtures/` — recorded action scripts (seeds + action sequences) driving determinism/parity

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser prototype remains playable while rules route through the extracted engine | ENG-01/05 | End-to-end feel is observed, not asserted | Open the refactored prototype in a browser, play a full run (create character → descend all 5 floors or die), confirm behavior matches the original |

*Most behaviors have automated verification; the single manual check is the playable-in-browser confirmation, deferred to end-of-milestone UAT per the autonomous run's UAT-deferral.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test/ tree does not exist yet)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
