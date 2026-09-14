---
phase: 18-bestiary-rebalance-canon-combat-fixes
verified: 2026-09-13T00:00:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 18: Bestiary Rebalance & Canon Combat Fixes Verification Report

**Phase Goal:** Every creature's HP/damage/to-hit/AR/special is reviewed and fixed against its intended depth band, with canon-accurate combat modifiers applied — all parity-safe via narrow, named carve-outs.
**Verified:** 2026-09-13
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria, all 5 + requirement cross-check)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A committed before/after stat table shows every bestiary creature's HP/damage/to-hit/AR/attack-count reviewed against its intended depth band, with outliers corrected. | ✓ VERIFIED | `content/BESTIARY-REBALANCE.md` has a full BEFORE block (53 rows, `<!-- yardstick:before:begin/end -->`, prototype mode) and AFTER block (55 rows, `<!-- yardstick:after:begin/end -->`, canon mode), a Review Verdicts table naming every over-tier/under-tier row, and a "Change ledger" table listing all 9 numerically-changed rows with before→after values and rationale. `test/unit/bestiary-yardstick.test.js`'s "D-04 doc consistency" test diffs the committed AFTER block against `computeYardstick(BESTIARY, {mechanics:"canon"})` live output and passes — the doc cannot drift from the live data. `git diff e01ac46 -- content/bestiary.js` confirms exactly the 9 documented rows changed (Drake wp 135→38, Werebeast dmg bonus 5→0, Djinni×2 wp 86→65 +dmg, Krupke wp 23→17 dmg 1d8+2→1d6+2, Drudge×2 wp 12→9, Vampire wp 95→71 +dmg, Stalka Beast wp 125→94 +dmg). |
| 2 | Foe AR (`sp.ar`) measurably reduces damage a creature takes, verified by a unit test covering the generic formula. | ✓ VERIFIED | `engine/foeDamage.js#damageFoe` implements the gated d20 soak (`physical && !crit && foe.sp && foe.sp.ar > 0`); `test/unit/foe-damage.test.js` has dedicated boundary tests ("ar 12: a soak roll of exactly 12 soaks", "ar 12: a soak roll of exactly 13 lands", "ar 20 always soaks; ar 0 and absent ar never draw", crit-bypass, spell-bypass, "physical kinds ally/foe/reflect/item are all soakable") — 22/22 pass. Independently confirmed via grep that this is the ONLY `rng.d(20)` gated on `sp.ar` in the module, and that it is wired into all 5 combat.js call sites + magic.js/items.js sites. |
| 3 | Sterling takes half damage from all sources; Cleric spells deal 2x to Demons and magic deals 2x to Walking Dead; Philly's `slow` gives the player the lower of two dice on strikes — each verified by a dedicated test. | ✓ VERIFIED | Sterling: `test/unit/foe-damage.test.js` "D-10 halfDmg ceil ladder across kinds" (melee/spell/item all ceil-halved, 1→1, 2→1, 3→2 minimums). Cleric-vs-Demons/magic-vs-Walking-Dead: `test/unit/magic.test.js` "castSpell: a Cleric's Fireball deals double to a Demons foe (CANON-04, D-11)" (14→28) and "any caster's Fireball doubles against Walking Dead"; `content/damage-multipliers.js` DAMAGE_MULTIPLIERS pinned 3-row table matches rulebook citations exactly. Philly slow: `engine/combat.js:331` `if (t.sp && t.sp.slow) roll = Math.min(roll, rng.d(dieN));`; `test/unit/combat.test.js` "playerStrike: slow — two dice, the lower kept" and "slow — both dice above need" tests pass with exact draw-count assertions. |
| 4 | Only named, narrow `comparables.js` carve-outs cover fixture-exercised creatures that changed numbers — no blanket fixture regeneration — with a documented rationale per carve-out. Per CONTEXT D-14/D-15 the phase chose ZERO carve-outs by leaving the four fixture-exposed creatures untouched — verify that is what happened and that BESTIARY-REBALANCE.md documents it. | ✓ VERIFIED | `git diff e01ac46 -- content/bestiary.js` shows zero data-line changes to Bat/Rat, Shriek, Viper, Dante (only the file's header comment changed, not their rows). `git diff --quiet e01ac46 -- test/parity/fixtures test/parity/harness/comparables.js test/parity/prototype-master.js.txt package.json` exits 0 (verified directly — zero fixture/harness/master/manifest changes). `content/BESTIARY-REBALANCE.md`'s "Parity carve-outs (BEST-03/FID-05) — measured" section explicitly states "Zero carve-outs. Zero regenerations." with the measured evidence (git diff, 30/30 parity, fixture-inventory green, FULL_FIGHTS pins unchanged). `node --test "test/parity/**/*.test.js"` → 30/30 pass (independently re-run). |
| 5 | Ability-bearing foes (Djinni, Krupke, Drudge, Vampire, Stalka Beast) carry proportionally lower raw stats than their pre-rebalance baseline. | ✓ VERIFIED | `git diff e01ac46 -- content/bestiary.js` confirms Djinni 86→65 (-24.4%), Krupke 23→17 (-26.1%), Drudge 12→9 (-25%, both tiers), Vampire 95→71 (-25.3%), Stalka Beast 125→94 (-24.8%) — all ≈ -25% per D-03's `Math.round(old × 0.75)` rule, each pinned individually in `test/unit/content-tables.test.js` ("BESTIARY Phase 18 / D-03" test block, 4 tests). |

**Score:** 8/8 must-haves verified (5 ROADMAP success criteria + BEST-03/FID-05 carve-out truth + CANON-01 seam invariant + requirements cross-reference), 0 present-but-behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tools/bestiary-yardstick.mjs` | Pure TTK/RTD calculator, prototype/canon modes | ✓ VERIFIED | Runs standalone (`node tools/bestiary-yardstick.mjs`), exit 0, produces the full 55-row canon-mode table; exports `computeYardstick`/`toMarkdown` used by both the CLI and the doc-consistency test. |
| `engine/foeDamage.js` | The one foe-damage seam (`damageFoe`, `multiplierFor`) | ✓ VERIFIED | 109 lines, correct locked order (multiplier → halfDmg → soak → apply), never calls `killFoe`, imports only `../content/index.js` (no cycle). Header comment WR-02 fix confirmed applied (commit `d9eb38b`). |
| `content/damage-multipliers.js` | Pure 3-row `DAMAGE_MULTIPLIERS` table | ✓ VERIFIED | Exactly 3 rows matching rulebook citations (Cleric/Demons, any-spell/Walking-Dead, Fighter-melee/Trachea); no function exports (content-purity guard passes); re-exported via `content/index.js`. |
| `content/BESTIARY-REBALANCE.md` | Committed before/after stat table + change ledger + carve-out statement | ✓ VERIFIED | BEFORE (53 rows) and AFTER (55 rows) blocks present and doc-consistency-tested; Change ledger; "Unchanged by decision" table; measured zero-carve-out statement; no placeholder markers remain. |
| `content/bestiary.js` | 9 rebalanced rows, shape unchanged, header references the doc | ✓ VERIFIED | `git diff e01ac46` confirms exactly 9 rows changed with `DELIBERATE RULES CHANGE` inline comments; fixture-exposed rows byte-identical; header comment (post WR-01 fix, commit `93961ea`) correctly states nine numeric changes + Sterling's flag wiring. |
| `src/browser/eventNarration.js` | `foeArmorSoaked` narration entry | ✓ VERIFIED | Present, family-friendly deadpan copy, passes `test/voice/safety-scan.test.js` and `test/unit/formatEventsCoverage.test.js`. |
| `test/unit/foe-damage.test.js` | Dedicated fakeRng unit tests + seam-only invariant | ✓ VERIFIED | 22 tests, including the D-09 "invariant" tests proving `damageFoe` is the only foe-wp decrement site — independently re-confirmed via direct grep of `.wp -=` across `engine/combat.js`, `engine/magic.js`, `engine/items.js`, `engine/foeDamage.js` (only hero/member decrements outside the seam; exactly one inside it). |
| `test/unit/content-tables.test.js` | DAMAGE_MULTIPLIERS pin + bestiary Phase 18 pins | ✓ VERIFIED | All Phase 18 pin blocks present (D-03, D-14, D-17, D-18, D-19) and passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `engine/combat.js` (playerStrike, allyTurn, alliesTurn, ward-reflect, acid-tick) | `engine/foeDamage.js#damageFoe` | 5 call sites | ✓ WIRED | Confirmed via grep: lines 412, 757, 802, 924, 1010 all call `damageFoe` with correctly-typed `source` objects. |
| `engine/magic.js` (quake, volley/thrown, insane r=2) | `engine/foeDamage.js#damageFoe` | 4 call sites | ✓ WIRED | Lines 175, 209, 294, 356 all call `damageFoe`. |
| `engine/items.js` (fire effect) | `engine/foeDamage.js#damageFoe` | 1 call site | ✓ WIRED | Line 600 calls `damageFoe` with `kind: "item"`. |
| `engine/foeDamage.js` | `content/index.js` (DAMAGE_MULTIPLIERS) | import | ✓ WIRED | `import { DAMAGE_MULTIPLIERS } from "../content/index.js"`; barrel exports `damage-multipliers.js`. |
| `content/bestiary.js` header | `content/BESTIARY-REBALANCE.md` | doc reference | ✓ WIRED | Header comment names the doc as D-04's before/after record. |
| `test/unit/bestiary-yardstick.test.js` | `content/BESTIARY-REBALANCE.md` AFTER block | doc-consistency test | ✓ WIRED | Test slices the file between markers and diffs against live canon-mode output; passes. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npm test` | 796/796 pass, 0 fail | ✓ PASS |
| Parity suite byte-identical | `node --test "test/parity/**/*.test.js"` | 30/30 pass | ✓ PASS |
| Seam unit tests | `node --test test/unit/foe-damage.test.js` | 22/22 pass | ✓ PASS |
| Foe-turn draw-count pins (zero-draw gates) | `node --test test/unit/foe-turn-draw-count.test.js` | 20/20 pass | ✓ PASS |
| Yardstick + doc-consistency | `node --test test/unit/bestiary-yardstick.test.js` | 11/11 pass | ✓ PASS |
| Fixture roster/inventory unchanged | `node --test test/parity/fixture-inventory.test.js` | 5/5 pass | ✓ PASS |
| Frozen files untouched since phase start | `git diff --quiet e01ac46 -- test/parity/fixtures test/parity/harness/comparables.js test/parity/prototype-master.js.txt package.json` | exit 0 | ✓ PASS |
| Yardstick CLI runs standalone, pure | `node tools/bestiary-yardstick.mjs` | exit 0, full canon-mode table printed | ✓ PASS |
| Content purity / no function leaves under content/ | `node --test test/determinism/content-is-pure-data.test.js` | 38/38 pass | ✓ PASS |
| Engine purity (no DOM/Math.random) | `node --test test/unit/engine-purity.test.js` | included in above run | ✓ PASS |
| No foe-side wp decrement outside the seam (independent re-check) | `grep -n "\.wp -=" engine/combat.js engine/magic.js engine/items.js engine/foeDamage.js` | only `c.wp -=` / `member.wp -=` (hero/member) outside `foeDamage.js`; exactly one `foe.wp -=` inside it | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| BEST-01 | 18-01, 18-05, 18-06 | Every creature's stats reviewed against depth band, outliers fixed, before/after table committed | ✓ SATISFIED | `content/BESTIARY-REBALANCE.md` BEFORE/AFTER tables, Review Verdicts, Change ledger; REQUIREMENTS.md marked `[x]` |
| BEST-02 | 18-01, 18-05 | Ability-bearing foes carry proportionally lower stats | ✓ SATISFIED | 5 caster foes at ~-25% wp (D-03), confirmed via git diff and content-tables pins |
| BEST-03 | 18-05, 18-06 | Bestiary changes to fixture-rolled creatures land only via narrow carve-outs | ✓ SATISFIED | Zero carve-outs measured and documented (D-14/D-15) — the four fixture-exposed creatures were simply left untouched, satisfying the requirement's intent with zero carve-outs needed |
| CANON-01 | 18-02, 18-03, 18-04, 18-06 | Foe `sp.ar` reduces damage taken, generic formula | ✓ SATISFIED | `damageFoe`'s gated d20 soak, 22 dedicated tests, seam-only invariant test |
| CANON-03 | 18-02, 18-03, 18-04 | Sterling `halfDmg` | ✓ SATISFIED | Ceil-halving across all source kinds, dedicated tests |
| CANON-04 | 18-02, 18-03, 18-04 | Damage-source × creature-type multipliers | ✓ SATISFIED | `DAMAGE_MULTIPLIERS` 3-row table, `multiplierFor`, dedicated magic.js tests (Cleric/Demons 14→28, any-spell/Walking-Dead) |
| CANON-05 | 18-03 | Philly `slow` — lower of two dice on strikes | ✓ SATISFIED | `engine/combat.js:331`, dedicated draw-count-pinned tests |
| FID-05 | 18-01, 18-03, 18-04, 18-05, 18-06 | Deliberate divergences regenerate only specific fixtures, before/after + rationale, never blanket regeneration | ✓ SATISFIED | Zero fixtures regenerated (measured); `BESTIARY-REBALANCE.md` serves as the before/after + rationale record |

**Orphan check:** REQUIREMENTS.md maps exactly these 8 IDs to Phase 18 (grep confirms lines 109/119/121-126 all say "Phase 18" / "Complete"); CANON-02 correctly excluded and deferred to Phase 19 per the ROADMAP's own rationale note. No orphaned requirements found.

### Anti-Patterns Found

None blocking. Two pre-existing documentation issues (WR-01: header comment miscount, WR-02: stale seam-not-wired-yet comment) were found by `18-REVIEW.md` and confirmed fixed by `18-REVIEW-FIX.md` (commits `93961ea`, `d9eb38b`) — independently re-read both files post-fix and confirmed the corrected text is in place. Two `18-REVIEW.md` info-level findings (IN-01: earthquake narration doesn't reflect per-foe multiplier, IN-02: `mult` field name collision risk on `spellHit` event) were explicitly deferred as low-priority narration follow-ups, not correctness bugs — no TODO/FIXME/XXX markers found in any Phase 18 file.

### Human Verification Required

None. This is an engine/data-only phase with no user-facing screens; every must-have is automated-verifiable. Balance *feel* is explicitly and correctly deferred to Phase 21's DR round (per CONTEXT and REQUIREMENTS.md TUNE-04) and is not a Phase 18 gate.

### Gaps Summary

No gaps. All 8 requirement IDs, all 5 ROADMAP success criteria, and the phase's extensive PLAN.md must_haves (truths/artifacts/key_links/prohibitions across all 6 plans) were independently re-verified against the live codebase rather than trusting SUMMARY.md claims:

- `npm test` re-run: 796/796 (matches every SUMMARY's claimed count exactly)
- All named unit/parity test files re-run individually and pass
- `git diff --quiet e01ac46 -- ...` frozen-file check re-run and confirmed clean
- `content/bestiary.js` diff manually inspected line-by-line against the plan's specified numbers (Drake, Werebeast, Djinni×2, Krupke, Drudge×2, Vampire, Stalka Beast) — exact match
- Fixture-exposed rows (Bat/Rat, Shriek, Viper, Dante) confirmed byte-identical by direct diff, not just by trusting the pinned test
- The seam-only invariant (no foe-wp decrement outside `damageFoe`) independently re-confirmed by direct grep, not just by trusting the test's own claim
- Both code-review warnings (WR-01, WR-02) confirmed fixed in the current file contents
- CANON-02 scope boundary respected — `pursues`/`never_melee`/`every` cooldown logic confirmed absent from `engine/combat.js`/`engine/magic.js`, correctly deferred to Phase 19

One hygiene-only note (not a gap, consistent with Phase 17's own verification precedent): `18-VALIDATION.md`'s frontmatter still shows `status: draft` / `nyquist_compliant: false` with per-task rows marked `⬜ pending` and sign-off boxes unchecked. This is a stale validation-artifact status field — every automated command listed in that file's Per-Task Verification Map was independently re-run in this verification pass and passed. Does not affect goal achievement.

---

_Verified: 2026-09-13_
_Verifier: Claude (gsd-verifier)_
