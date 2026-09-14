---
phase: 20
slug: parley-balance-language-system
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-14
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` (`node --test`), no external runner |
| **Config file** | none — `package.json` scripts drive glob discovery (already installed) |
| **Quick run command** | `npm run test:quick` (unit + determinism + roundtrip) |
| **Full suite command** | `npm test` (adds parity + voice; baseline 882/882 at 04eb229) |
| **Estimated runtime** | ~11 seconds (full), ~5 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:quick` (plus the task's own `<automated>` command)
- **After every plan wave:** Run `npm test` (parity is touched every time parley code moves — the 20-01 carve-out is what keeps seed 303 green)
- **Before `/gsd-verify-work`:** Full suite must be green (expected ~911 tests after 20-03; exact count recorded in 20-03-SUMMARY.md)
- **Max feedback latency:** ~12 seconds (the ~5-6 minute `tune-difficulty --seeds=200` readouts in 20-01 T3 / 20-03 T3 are informational background runs, not verification gates)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | PARLEY-01 (D-13/D-18) | T-20-01 / T-20-02 | carve-out is scenario-scoped; shared comparables still expose sp/gold; frozen files untouched | unit + parity | `node --test test/unit/parley-carveout.test.js test/unit/foe-ability-carveouts.test.js && node --test "test/parity/**/*.test.js"` | ❌ W0 (parley-carveout.test.js created in this task) | ⬜ pending |
| 20-01-02 | 01 | 1 | PARLEY-01..03 (D-15) | T-20-04 | seeded, no Math.random/Date; bot policy unchanged | smoke (JSON shape) | `node tools/tune-difficulty.mjs --seeds=3 --json` piped into a node -e parley-key check | ✅ tool exists | ⬜ pending |
| 20-01-03 | 01 | 1 | PARLEY-01..03 (D-15 BEFORE) | T-20-03 | engine provably pre-Phase-20 during the run | doc gates | `test -f docs/PARLEY-REBALANCE.md` + grep gates + `git diff --quiet 04eb229 -- engine content src mazeworld.html` | ❌ W0 (doc created) | ⬜ pending |
| 20-02-01 | 02 | 2 | PARLEY-01, LANG-01 (D-01/D-09) | T-20-06 | killFoe draw/result byte-identical; helpers pure | unit + parity | `node --test test/unit/fluency.test.js test/unit/combat.test.js test/unit/resist-roll.test.js test/unit/engine-purity.test.js && node --test "test/parity/**/*.test.js"` | ❌ W0 (fluency.test.js created in this task) | ⬜ pending |
| 20-02-02 | 02 | 2 | PARLEY-02/03/04, LANG-02 (D-03..D-08, D-10..D-12, D-20) | T-20-05 / T-20-07 / T-20-08 | exhausted retry draws 0 and mutates nothing; startCombat/pursuitStrike hash-identical | unit + parity | `node --test test/unit/combat.test.js test/unit/fluency.test.js test/unit/item-wiring.test.js test/unit/foe-turn-draw-count.test.js test/unit/party-combat.test.js test/unit/engine-purity.test.js && node --test "test/parity/**/*.test.js"` | ✅ (combat.test.js extended) | ⬜ pending |
| 20-02-03 | 02 | 2 | PARLEY-02, LANG-02 (D-14/D-17) | T-20-10 / T-20-11 | narration family-friendly; UI gate mirrors engine | coverage + voice + full | `node --test test/unit/formatEventsCoverage.test.js test/voice/safety-scan.test.js test/unit/foe-effect-chip.test.js && npm test` | ✅ | ⬜ pending |
| 20-03-01 | 03 | 3 | PARLEY-01..04, LANG-01/02 (D-02, D-04..D-08, D-10..D-12, D-19, D-21) | T-20-13 / T-20-14 | oracle independent of engine; zero-draw paths pinned via countingRng + rngState | unit | `node --test test/unit/parley.test.js test/unit/combat.test.js test/unit/fluency.test.js test/unit/foe-turn-draw-count.test.js` | ❌ W0 (parley.test.js created in this task) | ⬜ pending |
| 20-03-02 | 03 | 3 | LANG-02, PARLEY-02 (D-17) | T-20-12 | classic button gate agrees with engine on 576 cases | unit (source extraction) | `node --test test/unit/parley-button-mirror.test.js test/unit/foe-effect-chip.test.js` | ❌ W0 (created in this task) | ⬜ pending |
| 20-03-03 | 03 | 3 | PARLEY-01..03 (D-13/D-15/D-21) | T-20-15 / T-20-16 | append-only doc edits; frozen files untouched; phase gate | doc-consistency + full | `node --test test/parity/fixture-inventory.test.js` + grep gates + `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/parley-carveout.test.js` — D-13 exact-field / scoping proofs (created and run inside 20-01 T1)
- [ ] `test/unit/fluency.test.js` — LANG-01 fluency tiers + D-01 killSpFor equivalence (created and run inside 20-02 T1)
- [ ] `test/unit/parley.test.js` — the behavioural suite (created and run inside 20-03 T1)
- [ ] `test/unit/parley-button-mirror.test.js` — D-17 mirror (created and run inside 20-03 T2)
- Framework install: none needed (`node --test` is the project's only runner). Every new test file is created and run inside the task that needs it, so no task carries an `<automated>MISSING</automated>` reference.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The three new Oracle lines (insulted / exhausted / fluency annotation) read in voice on a phone toast | PARLEY-02 (D-14) | tone is a human judgement (the safety scan only proves family-friendly) | Browser or device: parley with a Con Artist vs Humans, fail once (see "You have made it personal."), press 5 again (button gone; a scripted resend shows "You already said your piece."), parley with a Language-skill character (see "(+2 for the tongue)") |
| The "5 · Parley" button disappears after the encounter's one attempt and appears for a Language+Helm character facing Magical | LANG-02 / PARLEY-02 (D-17) | the mirror test proves the gate function; the render wiring is a visual check | Browser: start a fight, parley once, confirm the button is gone; give the character Language + Helm of Knowledge and force a Magical encounter, confirm the button shows |

*Everything else has automated verification (see the map above).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s per task command (the two 5-6 minute readout runs are informational, not gates)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
