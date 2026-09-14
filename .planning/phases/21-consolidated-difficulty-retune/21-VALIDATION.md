---
phase: 21
slug: consolidated-difficulty-retune
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-14
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` (`node --test`), no external runner |
| **Config file** | none — `package.json` scripts drive glob discovery (already installed; no new dependency this phase) |
| **Quick run command** | `npm run test:quick` (unit + determinism + roundtrip) |
| **Full suite command** | `npm test` (adds parity + voice; baseline **912/912 at bd0ba7c**, ~26 s measured 2026-09-14) |
| **Estimated runtime** | ~26 seconds (full), ~10 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:quick` (plus the task's own `<automated>` command)
- **After every plan wave:** Run `npm test` (every wave touches parity-adjacent, save-adjacent or curve code — 21-02 and 21-04 must keep the D-15 / FID-02 files byte-unchanged; 21-03 adds the phase's only carve-out, `dev`)
- **Before `/gsd-verify-work`:** Full suite must be green (expected ≈ 951 after 21-04; exact count recorded in each SUMMARY)
- **Max feedback latency:** ~30 seconds — the six 200-seed tuning readouts (21-01 T3: 3 BEFORE; 21-04 T1/T2: 3–6 AFTER) and the debug APK build (21-05 T2) are informational **background** runs with an `EXIT=` sentinel and bounded ≤ 120 s polling, never verification gates

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | TUNE-02 (D-05/D-06/D-07/D-20/D-23) | T-21-02 / T-21-03 | bot decisions deterministic (policyRng only, no Math.random/Date); forceParty never touches a non-`--party` run | unit (synthetic states) | `node --test test/unit/tuning-bot.test.js && node --test test/unit/engine-purity.test.js test/determinism/rng-no-math-random.test.js` | ❌ W0 (tuning-bot.test.js created in this task) | ⬜ pending |
| 21-01-02 | 01 | 1 | TUNE-02 (D-07/D-08/D-12) | T-21-04 / T-21-05 | tools stay proxies; flags parsed defensively | smoke (JSON shape) | `node tools/tune-difficulty.mjs --seeds=3 --json` / `--seeds=2 --party --json` / `node tools/tune-economy.mjs --seeds=3 --json` piped into node -e key checks | ✅ tools exist | ⬜ pending |
| 21-01-03 | 01 | 1 | TUNE-02 (D-08/D-09/D-11 BEFORE) | T-21-01 | engine provably untouched (bd0ba7c) before and after the runs | doc gates + full | `test -f docs/DIFFICULTY-RETUNE.md` + grep gates + `git diff --quiet bd0ba7c -- engine content src mazeworld.html && npm test` | ❌ W0 (ledger created) | ⬜ pending |
| 21-02-01 | 02 | 2 | TUNE-01 (D-01/D-04/D-17/D-19) | T-21-06 / T-21-10 | identity ≤ 5 is structural (`over = max(0, d − 5)`, exact `exp(0)`); NaN/∞ depth stays finite | unit | `node --test test/unit/combat-scaling.test.js test/difficulty/difficulty.test.js test/difficulty/fairness.test.js test/unit/maze.test.js test/unit/engine-purity.test.js` | ❌ W0 (combat-scaling.test.js created in this task) | ⬜ pending |
| 21-02-02 | 02 | 2 | TUNE-01 (D-02/D-03/D-17/D-18) | T-21-07 / T-21-08 / T-21-09 | zero new draws; `dmgBonus` key absent ≤ 5; damageFoe still the one seam | unit + determinism + parity + full | `node --test test/unit/combat-scaling.test.js test/unit/combat.test.js test/unit/foe-abilities.test.js test/unit/foe-damage.test.js test/unit/foe-turn-draw-count.test.js test/unit/party-combat.test.js test/unit/bestiary-yardstick.test.js test/determinism/foe-abilities.test.js && node --test "test/parity/**/*.test.js" && npm test` | ✅ (extends the new file; D-15/FID-02 files byte-unchanged) | ⬜ pending |
| 21-03-01 | 03 | 3 | TUNE-04 (D-13/D-14/D-23) | T-21-11 / T-21-12 / T-21-15 | startDepth sanitised; `dev` strict boolean; default path byte-identical | unit + roundtrip + parity | `node --test test/unit/newrun.test.js test/unit/save-validation.test.js test/unit/engine-purity.test.js test/unit/new-run-loop.test.js test/unit/parley-carveout.test.js test/unit/foe-ability-carveouts.test.js test/determinism/same-seed-same-result.test.js test/roundtrip/serialize-rehydrate.test.js && node --test "test/parity/**/*.test.js"` | ✅ (extends existing files) | ⬜ pending |
| 21-03-02 | 03 | 3 | TUNE-04 (D-13) | T-21-13 | dev death writes no grave/total/recent keys; dev depth never a best | unit (fake storage) | `node --test test/unit/engineAdapter.test.js test/unit/new-run-loop.test.js test/unit/permadeath.test.js test/unit/death.test.js` | ✅ (extends engineAdapter.test.js) | ⬜ pending |
| 21-03-03 | 03 | 3 | TUNE-04 (D-13/D-22) | T-21-14 / T-21-16 | dev row hidden + long-press only; build throws on a missing placeholder; CRLF intact | source gates + build + full | CRLF `node -e` check + grep gates + `npm run build:www` + `grep -c 'id="mw-app-version">1.0.1 (2)</span>' www/index.html` + `node --test test/unit/settings.test.js test/unit/formatEventsCoverage.test.js test/voice/safety-scan.test.js && npm test` | ✅ | ⬜ pending |
| 21-04-01 | 04 | 4 | TUNE-03 (D-01/D-02/D-03/D-09/D-11) | T-21-17 / T-21-18 | dials identity ≤ 5; tools untouched between BEFORE and AFTER | unit + determinism + parity | `node --test test/unit/combat-scaling.test.js test/determinism/foe-abilities.test.js test/unit/foe-turn-draw-count.test.js && node --test "test/parity/**/*.test.js"` + constant greps + ledger greps | ✅ (extends combat-scaling.test.js) | ⬜ pending |
| 21-04-02 | 04 | 4 | TUNE-03 (D-10/D-12/D-20/D-21) | T-21-19 / T-21-20 | ≤ 2 iterations; counterweights post-draw + identity ≤ 5 | full + parity + frozen-file | `npm test && node --test "test/parity/**/*.test.js" && git diff --quiet 04eb229 -- <frozen files>` + ledger section greps | ✅ | ⬜ pending |
| 21-05-01 | 05 | 5 | TUNE-04 (D-15/D-16) | T-21-22 | verdict left to the tester; no code change | doc gates | grep gates on the DR checklist headings/rows + `git diff --quiet HEAD -- engine content src mazeworld.html tools test` | ✅ (ledger exists) | ⬜ pending |
| 21-05-02 | 05 | 5 | TUNE-04 (phase gate) | T-21-23 / T-21-25 / T-21-26 | tree frozen at 21-04; no Play push | full + parity + build + smoke | `npm test && node --test "test/parity/**/*.test.js" && git diff --quiet 04eb229 -- <frozen files> && npm run build:www && <tool JSON smoke> && node tools/bestiary-yardstick.mjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/tuning-bot.test.js` — synthetic-state probes for every D-05/D-06 branch, exit/hazard BFS, forceParty determinism, tally arithmetic (created and run inside 21-01 T1)
- [ ] `test/unit/combat-scaling.test.js` — identity pins 1..5, bounds/monotone, synthetic-curve helper pins, wiring + draw-shape equality (created inside 21-02 T1, extended in 21-02 T2 and 21-04)
- [ ] `docs/DIFFICULTY-RETUNE.md` — the ledger (created inside 21-01 T3; doc-consistency is by grep gates, not a machine-checked table — D-11 permits manual review)
- Existing infrastructure covers everything else: `node:test` runner, parity harness + 30 fixtures, determinism/FID-02 pins, fake-storage adapter tests, voice safety scan, coverage guard.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The DR round: three dev runs at depths 20 / 35 / 50 on the Pixel 7 against the retuned engine — session-length feel, one caster fight (bolt / drain / debuff legible, resist fair), one parley attempt + one failure, party affordability, "ended for a reason I understood" — with a pass / tune-again verdict | TUNE-04 (D-15) | Subjective feel; the phase's deliberate exit criterion — the VERIFICATION must end `human_needed` on exactly this item (D-15/D-16) | Follow `docs/DIFFICULTY-RETUNE.md` → "DR checklist — TUNE-04 sign-off" (21-05): install the debug APK, start a normal run, Settings → hold the "Version …" line ≈ 1.2 s → Start at depth → play, fill the three tables, record the verdict |
| The hidden toggle's feel: a tap on the version line does nothing, a ≈ 1.2 s hold reveals the row, the DEV chip is visible but unobtrusive, a dev death leaves the graveyard untouched | TUNE-04 (D-13/D-22) | Pointer-timing and on-device rendering; covered by the same DR round | Part of the DR checklist's "Starting a run at depth N" step (21-03 T3 `<human-check>`) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (background readouts/builds excluded by design)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
