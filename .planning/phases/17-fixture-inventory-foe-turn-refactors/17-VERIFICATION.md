---
phase: 17-fixture-inventory-foe-turn-refactors
verified: 2026-09-13T20:46:16Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 17: Fixture Inventory & Foe-Turn Refactors Verification Report

**Phase Goal:** Establish the parity-safety foundation — know exactly which bestiary creatures each parity fixture rolls, and extract shared foe-turn helpers — before any bestiary or ability behavior changes land.
**Verified:** 2026-09-13T20:46:16Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A written fixture inventory document lists exactly which `content/bestiary.js` creatures each parity fixture seed (combat/magic/full-suite) rolls | ✓ VERIFIED | `test/parity/FIXTURE-INVENTORY.md` (157 lines) contains a replay-generated table (16 rows, all six fixture domains) plus a "Parity-exposed bestiary surface" section naming the exact 4 creatures (Bat/Rat, Shriek, Viper, Dante) at level 1. `node tools/fixture-inventory.mjs` reproduces the table byte-for-byte; `test/parity/fixture-inventory.test.js` (5/5 passing) pins the roster, the none-rows, seed precision, and doc/replay byte-equality |
| 2 | `pickFoeTarget` and `applyFoeDamageToPlayer` exist as shared, tested helper functions used by the existing foe-turn melee path, with behavior-preserving tests proving zero output change | ✓ VERIFIED | Both are `export function` in `engine/combat.js:832` and `:875`; `foeTurn` calls `pickFoeTarget(state, rng)` at line 1003 and `applyFoeDamageToPlayer(state, f, rng, events, {...})` at line 1043, with `if (hit.died) return events;` immediately after (matches the pinned death early-return contract). 6 new `pickFoeTarget` tests in `test/unit/party-combat.test.js` + 13 new direct + 4 new control-flow `applyFoeDamageToPlayer`/`foeTurn` tests in `test/unit/combat.test.js`, all passing; `npm test` 724/724 |
| 3 | A draw-count regression test proves a foe without the new `abilities` field draws exactly zero additional RNG in any fight | ✓ VERIFIED | `test/unit/foe-turn-draw-count.test.js` (12/12 passing): 6 per-foeTurn micro pins (0/1/2/2/3/6 draws) + 5 full fixture-seeded fight pins (12/101/111/66/32 draws for seeds 3/14/17/303/8), each cross-checked against mulberry32's cursor via `(start + Math.imul(draws, 0x6d2b79f5)) | 0 === rng.getState() | 0`. Every case asserts `Object.hasOwn(foe, "abilities") === false`. Baseline appended to `FIXTURE-INVENTORY.md`'s "Draw-count baseline (FID-02)" section with the Phase 19 contract |
| 4 | The full parity suite remains byte-identical to the frozen prototype master | ✓ VERIFIED | `node --test "test/parity/**/*.test.js"` → 30/30 passing. `git log --oneline c5fc219..HEAD -- test/parity/prototype-master.js.txt test/parity/fixtures test/parity/harness/comparables.js package.json` → empty (no commit in this phase touched any frozen artifact). `git status --porcelain` clean |

**Score:** 4/4 roadmap success criteria verified (0 present, behavior-unverified)

### Requirement-Level Must-Haves (from PLAN frontmatter, cross-checked against roadmap)

| # | Must-have | Status | Evidence |
|---|-----------|--------|----------|
| 5 | FID-01 edge probes (boundary/adjacency/empty/ordering/precision) all asserted | ✓ VERIFIED | `fixture-inventory.test.js` has 5 tests covering exactly these: pinned fight rows in order, the 2-type×4-name exposed set with all-lvl-1 assertion, explicit none-rows for every non-fight scenario + zero-wandering assertion + FIXTURE_ORDER ordering check, verbatim-seed precision check, and doc/replay byte-equality |
| 6 | `pickFoeTarget` zero-draw gate (no allies key / empty array / all-downed) returns null without touching rng | ✓ VERIFIED | `engine/combat.js:832-839`; tests at `party-combat.test.js:255-306` pin all three zero-draw cases plus the `d(N+1)` mapping and downed-member exclusion |
| 7 | `applyFoeDamageToPlayer` `died:true` fires only on `c.wp<=0`; ward-reflect kill of the foe returns `died:false` | ✓ VERIFIED | `engine/combat.js:898-904` (reflect-kill branch, `return { died: false, onArmour: false }`) and `:951-954` (`c.wp<=0` branch, `return { died: true, ... }` after `die()`); pinned by `combat.test.js:602` (reflect kill) and `:664` (lethal) |
| 8 | Hero-death mid-loop returns events immediately; ward/mirror tick skipped | ✓ VERIFIED | `engine/combat.js:1043-1044`: `if (hit.died) return events;` precedes the ward/mirror decrement block (`:1047-1051`), so a death exits before that code runs — matches pre-extraction control flow, confirmed by unmodified pre-existing tests plus new foeTurn-level control-flow tests |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `test/parity/harness/fixtureRoster.js` | `enumerateFixtureRoster()`, `rosterToMarkdown()`, `FIXTURE_ORDER` exports | ✓ VERIFIED | All three exported; imports `applyStartCombat`/`runEconomyAction`/`loadPrototypeSandbox`; used by both the CLI and the pinned test |
| `tools/fixture-inventory.mjs` | Dev CLI printing table/JSON | ✓ VERIFIED | Runs, prints table matching the committed doc exactly; `--json` produces 16 rows, 5 non-empty foes, 4 distinct type:name pairs, all lvl 1, 0 "wandering" |
| `test/parity/FIXTURE-INVENTORY.md` | Committed inventory doc, ≥40 lines | ✓ VERIFIED | 157 lines; generated block + exposed-surface analysis + Phase 18 constraints + Phase 19 draw-count baseline, all present |
| `test/parity/fixture-inventory.test.js` | Pinned roster/doc test | ✓ VERIFIED | 5/5 tests passing |
| `pickFoeTarget` / `applyFoeDamageToPlayer` (engine/combat.js) | Exported helpers used by foeTurn | ✓ VERIFIED | Exported, wired into `foeTurn`'s swing loop (lines 1003, 1043) |
| `test/unit/foe-turn-draw-count.test.js` | ≥80 lines, `countingRng` helper | ✓ VERIFIED | 291 lines; 12/12 tests passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `fixtureRoster.js` | `comparables.js` | imports `applyStartCombat`/`runEconomyAction` | ✓ WIRED | `grep` confirms imports and calls |
| `fixture-inventory.test.js` | `fixtureRoster.js` | imports enumerate/render, pins output | ✓ WIRED | Confirmed by passing test |
| `fixture-inventory.test.js` | `FIXTURE-INVENTORY.md` | marker-delimited byte comparison | ✓ WIRED | Test passes; markers present exactly once each |
| `tools/fixture-inventory.mjs` | `fixtureRoster.js` | imports same enumerate/render fns | ✓ WIRED | CLI output matches test's replay |
| `foeTurn` | `pickFoeTarget` / `applyFoeDamageToPlayer` | direct calls in swing loop | ✓ WIRED | Confirmed at `engine/combat.js:1003,1043` |
| `foe-turn-draw-count.test.js` | `engine/combat.js`, `engine/rng.js`, `engine/engine.js` | imports `startCombat`/`playerStrike`/`foeTurn`, `makeRng`, `newRun` | ✓ WIRED | Confirmed by passing tests + cursor cross-check |
| `FIXTURE-INVENTORY.md` | `foe-turn-draw-count.test.js` | baseline section names the test file | ✓ WIRED | `grep -c 'foe-turn-draw-count.test.js'` in doc ≥ 1 |

### Behavioral Spot-Checks / Probe Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Parity suite byte-identical | `node --test "test/parity/**/*.test.js"` | 30/30 pass | ✓ PASS |
| Full project suite green | `npm test` | 724/724 pass, 0 fail | ✓ PASS |
| Draw-count regression | `node --test test/unit/foe-turn-draw-count.test.js` | 12/12 pass | ✓ PASS |
| Fixture inventory regression | `node --test test/parity/fixture-inventory.test.js` | 5/5 pass | ✓ PASS |
| CLI replay matches committed doc | `node tools/fixture-inventory.mjs` | Output byte-matches doc's generated block | ✓ PASS |
| No frozen-artifact edits in this phase | `git log --oneline c5fc219..HEAD -- test/parity/prototype-master.js.txt test/parity/fixtures test/parity/harness/comparables.js package.json` | empty | ✓ PASS |
| Working tree clean | `git status --porcelain` | empty | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FID-01 | 17-01 | Written fixture inventory of bestiary creatures rolled per fixture seed | ✓ SATISFIED | `FIXTURE-INVENTORY.md` + `fixtureRoster.js` + `fixture-inventory.test.js`; REQUIREMENTS.md marks FID-01 complete, mapped to Phase 17 |
| FID-02 | 17-03 | Foe without `abilities` field draws exactly zero additional RNG | ✓ SATISFIED | `foe-turn-draw-count.test.js` pins baseline draw counts with cursor cross-check; REQUIREMENTS.md marks FID-02 complete, mapped to Phase 17 |
| FID-03 | 17-02 | `pickFoeTarget`/`applyFoeDamageToPlayer` extracted as shared, tested helpers | ✓ SATISFIED | `engine/combat.js` exports + wiring; 23 new unit tests; REQUIREMENTS.md marks FID-03 complete, mapped to Phase 17 |

No orphaned requirements found — REQUIREMENTS.md's phase-mapping table (lines 105-108, 146) lists exactly FID-01/02/03 for Phase 17, matching all three plans' `requirements:` frontmatter.

### Anti-Patterns Found

None. Scanned all phase-modified files (`engine/combat.js`, `test/parity/harness/fixtureRoster.js`, `tools/fixture-inventory.mjs`, `test/parity/fixture-inventory.test.js`, `test/parity/FIXTURE-INVENTORY.md`, `test/unit/foe-turn-draw-count.test.js`, `test/unit/combat.test.js`, `test/unit/party-combat.test.js`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|placeholder|coming soon|not yet implemented|not available` — zero matches.

Code review (`17-REVIEW.md`, iteration 2) found 0 critical, 0 warning findings after the fix loop (`17-REVIEW-FIX.md` closed WR-01 and WR-02 in commits `080cf89`/`91a9b36`). Three remaining info-level items (IN-01 duplicated transition-detection logic, IN-02 latent multi-encounter trigger-labeling gap, IN-03 missing dedicated regression tests for the two fixes) are all explicitly scoped as non-blocking by the reviewer — none affect current fixture behavior (verified: no current fixture triggers more than one combat start per scenario) and none are must-haves for this phase's goal.

### Notes

`17-VALIDATION.md` frontmatter still shows `status: draft` / `nyquist_compliant: false` with unchecked sign-off boxes — this is a stale validation-artifact status field, not a functional gap: every per-task verification command listed in that file's table was independently re-run in this verification pass and passed (parity 30/30, full suite 724/724, foe-turn-draw-count 12/12, fixture-inventory 5/5). Not treated as a gap since it doesn't affect goal achievement, but noting it for hygiene.

## Human Verification Required

None. This is an engine/test-only infrastructure phase with no user-facing behavior; every must-have and success criterion was verified by automated commands re-run directly in this session (not merely SUMMARY.md claims).

## Gaps Summary

No gaps. All 4 ROADMAP success criteria, all 3 requirement IDs (FID-01, FID-02, FID-03), all declared PLAN must-haves (truths, artifacts, key links), and the phase's own threat-model mitigations (frozen-artifact tamper guard, doc-drift guard, pinned-draw-count tamper guard) are verified present, substantive, and wired in the actual codebase — not just claimed in SUMMARY.md.

---

_Verified: 2026-09-13T20:46:16Z_
_Verifier: Claude (gsd-verifier)_
