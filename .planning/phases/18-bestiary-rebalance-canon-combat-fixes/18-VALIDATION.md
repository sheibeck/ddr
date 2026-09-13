---
phase: 18
slug: bestiary-rebalance-canon-combat-fixes
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-13
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node >= 22 built-in; zero dependencies) |
| **Config file** | none — `package.json` `"test": "node --test"` discovers every `*.test.js` under `test/` |
| **Quick run command** | per plan (see map): `node --test test/unit/foe-damage.test.js test/unit/combat.test.js test/unit/foe-turn-draw-count.test.js test/unit/content-tables.test.js test/unit/bestiary-yardstick.test.js` |
| **Full suite command** | `npm test` (724 baseline at e01ac46, incl. `test/parity` which must stay byte-identical); parity alone: `node --test "test/parity/**/*.test.js"` (30) — on this Windows/Git-Bash box never use a bare `node --test <dir>` |
| **Estimated runtime** | ~12 seconds for `npm test`; ~2 seconds per targeted file set. `tools/tune-difficulty.mjs --seeds=200` (D-16, run twice in the phase) is NOT a test and takes ~5-6 minutes each |

---

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` command (each runs `node --test` on the touched unit files; parity-touching tasks add `node --test "test/parity/**/*.test.js"`)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green AND `git diff --quiet e01ac46 -- test/parity/fixtures test/parity/harness/comparables.js test/parity/prototype-master.js.txt engine/difficulty.js package.json package-lock.json` exits 0 (zero regeneration / zero carve-outs / no difficulty.js change / no installs)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | BEST-01, BEST-02 | T-18-04 / T-18-SC | Script imports only content + node builtins (no engine, no Math.random); strict `> 2.0` flag threshold | unit (synthetic pins + live smoke) + CLI smoke | `node --test test/unit/bestiary-yardstick.test.js && node tools/bestiary-yardstick.mjs --json` | ❌ W0 (created by the task) | ⬜ pending |
| 18-01-02 | 01 | 1 | BEST-01, FID-05 | T-18-01 / T-18-05 | BEFORE block byte-equal to live prototype-mode output; `git diff --quiet e01ac46 -- content/bestiary.js engine/ test/parity` | doc consistency (diff) + unit | `node --test test/unit/bestiary-yardstick.test.js` + the awk/diff acceptance check | ❌ W0 (doc created by the task) | ⬜ pending |
| 18-02-01 | 02 | 1 | CANON-04 | T-18-04 | Content file has no function/import code line (purity guard); table pinned verbatim | unit (content pin) + determinism | `node --test test/unit/content-tables.test.js test/determinism/content-is-pure-data.test.js` | ✅ (pin appended) / ❌ W0 (content file) | ⬜ pending |
| 18-02-02 | 02 | 1 | CANON-01, CANON-03, CANON-04 | T-18-02 / T-18-03 / T-18-06 | Exactly one `rng.d(` code line, gated on physical && !crit && sp.ar > 0; never calls killFoe; one event type; safe narration | unit (fakeRng, 18 tests) + coverage + safety + purity | `node --test test/unit/foe-damage.test.js test/unit/formatEventsCoverage.test.js test/unit/engine-purity.test.js test/voice/safety-scan.test.js test/unit/content-tables.test.js` | ❌ W0 (foe-damage.test.js created by the task) | ⬜ pending |
| 18-03-01 | 03 | 2 | CANON-01, CANON-03, CANON-04, CANON-05 | T-18-02 / T-18-03 | No foe-side direct wp decrement on a combat.js code line; slow re-roll gated on `t.sp.slow`; kill checks unmoved; member branch diff vs e01ac46 empty | unit (12 behavioral) + parity | `node --test test/unit/combat.test.js test/unit/party-combat.test.js test/unit/foe-damage.test.js test/unit/engine-purity.test.js test/unit/formatEventsCoverage.test.js && node --test "test/parity/**/*.test.js"` | ✅ (combat.test.js extended) | ⬜ pending |
| 18-03-02 | 03 | 2 | FID-05 (+ D-13) | T-18-02 / T-18-01 | +1 draw only with sp.ar / sp.slow; 0 for halfDmg / multipliers; FID-02 pins unchanged; frozen files unchanged | unit (countingRng, 8 pins) + parity + full suite | `node --test test/unit/foe-turn-draw-count.test.js && node --test "test/parity/**/*.test.js" && npm test` | ✅ (draw-count file extended) | ⬜ pending |
| 18-04-01 | 04 | 2 | CANON-01, CANON-03, CANON-04 | T-18-02 / T-18-03 / T-18-04 | No foe-side direct wp decrement on magic.js / items.js code lines; wp SETS untouched; seam still imports only content (no cycle) | unit (existing) + purity + parity | `node --test test/unit/magic.test.js test/unit/items.test.js test/unit/item-wiring.test.js test/unit/engine-purity.test.js test/unit/formatEventsCoverage.test.js && node --test "test/parity/**/*.test.js"` | ✅ (existing files) | ⬜ pending |
| 18-04-02 | 04 | 2 | CANON-04, CANON-03, CANON-01, FID-05 | T-18-02 / T-18-01 | Spell vs sp.ar draws no d20 (test 4); insane foe-on-foe and item fire soak only with sp.ar | unit (8 behavioral) + parity + full suite | `node --test test/unit/magic.test.js test/unit/item-wiring.test.js test/unit/items.test.js && node --test "test/parity/**/*.test.js" && npm test` | ✅ (magic.test.js / item-wiring.test.js extended) | ⬜ pending |
| 18-05-01 | 05 | 2 | BEST-01, BEST-02 | T-18-01 / T-18-05 | Only the ten named entries change; fixture-exposed rows / Sterling / Cave Bear / Herman untouched (git diff grep = 0); inline rationale comments | node one-liners + unit + parity roster + determinism | `node --test test/unit/content-tables.test.js test/parity/fixture-inventory.test.js test/unit/foe-turn-draw-count.test.js test/determinism/content-is-pure-data.test.js` | ✅ (existing files) | ⬜ pending |
| 18-05-02 | 05 | 2 | BEST-01, BEST-02, BEST-03, FID-05 | T-18-01 / T-18-03 / T-18-SC | Fixture-exposed rows snapshotted verbatim; tier shape pinned; frozen files + difficulty.js + manifests unchanged | unit (10 pins) + parity + full suite | `node --test test/unit/content-tables.test.js test/parity/fixture-inventory.test.js && node --test "test/parity/**/*.test.js" && npm test` | ✅ (pins appended) | ⬜ pending |
| 18-06-01 | 06 | 3 | CANON-01 (D-09 invariant) | T-18-02 | 0 foe-side wp decrements on code lines of combat.js / magic.js / items.js, exactly 1 in foeDamage.js; hero + member decrements still present | unit (source assertion, 4 tests) | `node --test test/unit/foe-damage.test.js test/unit/combat.test.js test/unit/magic.test.js test/unit/item-wiring.test.js` | ✅ (foe-damage.test.js extended) | ⬜ pending |
| 18-06-02 | 06 | 3 | BEST-01, BEST-03, FID-05 | T-18-01 / T-18-05 / T-18-SC | AFTER block === live canon-mode output (consistency test); zero regenerated fixtures (measured); `npm test` >= 796 pass | doc consistency (unit) + parity + phase gate | `node --test test/unit/bestiary-yardstick.test.js test/unit/foe-damage.test.js test/parity/fixture-inventory.test.js && node --test "test/parity/**/*.test.js" && git diff --quiet e01ac46 -- test/parity/fixtures test/parity/harness/comparables.js test/parity/prototype-master.js.txt engine/difficulty.js package.json package-lock.json && npm test` | ✅ (yardstick test extended; doc completed) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 plan: `node:test` is already wired (`npm test`), and every MISSING test file is created by the task that needs it, inside the same plan and before its verify runs:

- [ ] `tools/bestiary-yardstick.mjs` + `test/unit/bestiary-yardstick.test.js` — BEST-01/BEST-02 yardstick + its pins (18-01 Task 1)
- [ ] `content/BESTIARY-REBALANCE.md` — D-04 stat table, BEFORE half (18-01 Task 2), AFTER half + consistency test (18-06 Task 2)
- [ ] `content/damage-multipliers.js` — CANON-04 table + its `content-tables.test.js` pin (18-02 Task 1)
- [ ] `engine/foeDamage.js` + `test/unit/foe-damage.test.js` — CANON-01/03/04 seam + dedicated fakeRng tests (18-02 Task 2); invariant test appended (18-06 Task 1)
- [x] `test/unit/combat.test.js`, `test/unit/foe-turn-draw-count.test.js`, `test/unit/magic.test.js`, `test/unit/item-wiring.test.js`, `test/unit/content-tables.test.js` — exist; Phase 18 cases are appended (18-03, 18-04, 18-05)
- [x] framework install — none needed (zero new dependencies; `package.json` / lockfile must remain unchanged)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

All phase behaviors have automated verification (pure engine/content/tooling; `human_verify_mode=end-of-phase` applies). The `foeArmorSoaked` Oracle line's tone is covered by the automated safety scan; its on-device feel (toast length) is a Phase 21 / DR-round concern, not a Phase 18 gate. The D-16 tune-difficulty readouts are informational by decision and are recorded, not verified.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
