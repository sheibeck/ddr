---
phase: 17
slug: fixture-inventory-foe-turn-refactors
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-13
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node >= 22 built-in; zero dependencies) |
| **Config file** | none — `package.json` `"test": "node --test"` discovers every `*.test.js` under `test/` |
| **Quick run command** | `npm run test:quick` (unit + determinism + roundtrip); per plan: `node --test test/unit/combat.test.js test/unit/party-combat.test.js test/unit/foe-turn-draw-count.test.js` |
| **Full suite command** | `npm test` (683 baseline tests incl. `test/parity`, which must stay byte-identical to the frozen prototype) |
| **Estimated runtime** | ~15 seconds (the full-suite parity gate alone budgets < 15s) |

---

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` command (each task runs `node --test` on the touched unit/parity files, plus `node --test test/parity`)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green AND `git log --oneline c5fc219..HEAD -- test/parity/prototype-master.js.txt test/parity/fixtures test/parity/harness/comparables.js package.json` prints nothing
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | FID-01 | T-17-01 / T-17-SC | No fixture/harness/master/package file changed (`git status --porcelain` empty on those paths) | tooling + CLI smoke | `node tools/fixture-inventory.mjs --json` piped through the roster check in the task verify | ❌ W0 (created by the task) | ⬜ pending |
| 17-01-02 | 01 | 1 | FID-01 | T-17-02 | Document block byte-equal to the live replay | parity (pinned enumeration) | `node --test test/parity/fixture-inventory.test.js && node --test test/parity` | ❌ W0 (created by the task) | ⬜ pending |
| 17-02-01 | 02 | 1 | FID-03 | T-17-04 / T-17-05 | Exactly one gated draw in pickFoeTarget; member branch diff vs c5fc219 empty; parity byte-identical | unit + parity | `node --test test/unit/party-combat.test.js test/unit/combat.test.js && node --test test/parity` | ✅ (existing files extended) | ⬜ pending |
| 17-02-02 | 02 | 1 | FID-03 | T-17-04 / T-17-06 / T-17-07 | `if (hit.died) return events;` is the first statement after the helper; engine purity guard green; no new event type | unit + purity + parity | `node --test test/unit/combat.test.js test/unit/party-combat.test.js test/unit/engine-purity.test.js test/unit/formatEventsCoverage.test.js && node --test test/parity` | ✅ (existing files extended) | ⬜ pending |
| 17-03-01 | 03 | 2 | FID-02 | T-17-08 / T-17-10 | Counter agrees with the mulberry32 cursor on every seeded fight; 200-attack cap never hit | unit (draw-count regression) | `node --test test/unit/foe-turn-draw-count.test.js && npm run test:quick` | ❌ W0 (created by the task) | ⬜ pending |
| 17-03-02 | 03 | 2 | FID-02 (+ phase gate for FID-01/03) | T-17-09 / T-17-SC | `git log c5fc219..HEAD` on master/fixtures/comparables/package is empty; `npm test` >= 723 pass, 0 fail | full suite | `node --test test/parity/fixture-inventory.test.js test/unit/foe-turn-draw-count.test.js && npm test` | ✅ (doc exists from 17-01) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 plan: `node:test` is already wired (`npm test`), and every MISSING test file is created by the task that needs it, inside the same plan and before its verify runs:

- [ ] `test/parity/harness/fixtureRoster.js` + `tools/fixture-inventory.mjs` — FID-01 enumeration (17-01 Task 1)
- [ ] `test/parity/fixture-inventory.test.js` + `test/parity/FIXTURE-INVENTORY.md` — FID-01 pinned roster + document (17-01 Task 2)
- [ ] `test/unit/foe-turn-draw-count.test.js` — FID-02 draw-count baseline (17-03 Task 1)
- [x] `test/unit/combat.test.js`, `test/unit/party-combat.test.js` — exist; FID-03 cases are appended (17-02)
- [x] framework install — none needed (zero new dependencies; `package.json` must remain unchanged)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

All phase behaviors have automated verification (pure engine refactor + tooling; no user-facing behavior; `human_verify_mode=end-of-phase` applies, and there is nothing to check on-device).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
