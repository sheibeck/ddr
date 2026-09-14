---
phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
fixed_at: 2026-09-14T04:27:09Z
review_path: .planning/phases/19-foe-abilities-spellcasting-symmetric-int-resistance/19-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 2
status: partial
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-09-14T04:27:09Z
**Source review:** .planning/phases/19-foe-abilities-spellcasting-symmetric-int-resistance/19-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (per fix_scope `critical+warning`: WR-01, WR-02, WR-03): 3
- Fixed: 3
- Skipped: 2 (IN-01, IN-02 — explicitly out of scope per the fix_scope directive, listed here for completeness per the orchestrator's instruction)

## Fixed Issues

### WR-01: `vampireSummon` reinforcements inherit the summoner's level for combat math, not the roster tier they were drawn from

**Files modified:** `engine/foeAbilities.js`, `test/unit/foe-abilities.test.js`, `test/determinism/foe-abilities.test.js`
**Commit:** f4b6c6a
**Applied fix:** In `engine/foeAbilities.js`'s `summon` branch of `resolveFoeAbility`, changed `lvl: Math.max(1, f.lvl - 1)` to `lvl: a.effect.tier`, so the summoned reinforcement's `.lvl` (which drives its to-hit die, melee damage, and XP payout everywhere else in the engine) now matches the weak roster tier (`tier: 2`) its stats were actually drawn from, instead of the Vampire's own tier-5 level. This closes the ~2.6x melee-damage / better-accuracy / doubled-XP overshoot the review identified.

Updated `test/unit/foe-abilities.test.js`'s "summon (D-12)" test to pin `lvl: 2` (was `lvl: 4`) and replaced the old "a lvl-1 summoner floors at lvl 1" assertion — which tested the now-removed `Math.max(1, f.lvl - 1)` code path — with a regression guard proving the summoned foe's `lvl` (2) is fully decoupled from the summoner's own `lvl` (tested at summoner `lvl: 1`), satisfying the requested "asserting the summoned foe's lvl equals the tier-2 roster level" coverage.

**Determinism re-pin (expected, not a regression):** Fixing the reinforcement's `lvl` legitimately changes its own to-hit die (`STRIKE_DICE[lvl-1]`: d8 at the old buggy lvl 4, d12 at the correct lvl 2). Since `rng.d(sides)` consumes exactly one draw regardless of `sides`, the die-size change doesn't alter the *draw count* of that single roll — but it does change which side of the hit/miss threshold the *same* underlying random float lands on, which cascades into a different subsequent damage-roll draw (or not) later in the same fight. This surfaced as a mismatch in `test/determinism/foe-abilities.test.js`'s `walking-dead-t5` per-visit D-15 pin, starting at visit 7 (the first visit where a joined reinforcement takes its own swing). Re-ran the test against the fixed engine and re-measured the literal: `PER_VISIT_PINS["walking-dead-t5"]` changed from `[4, 6, 4, 6, 7, 5, 11, 10, 10, 9, 9, 8]` to `[4, 6, 4, 6, 7, 5, 10, 10, 8, 8, 7, 10]` (draws 1-6, before any reinforcement acts, are unchanged). The commit includes a comment documenting the old pin and the mechanism. The `walking-dead-t5` full-fight pin (`FULL_FIGHT_PINS`, driven by `playerStrike` rather than `runVisits`) was unaffected — that replay kills both Vampires before their reinforcements ever get a turn.

**Dice-budget test (content-tables.test.js) — deliberately left unchanged:** Per the task's explicit "if it can't cheaply, leave it and note why" allowance, I did not extend `test/unit/content-tables.test.js`'s "FOE_ABILITIES Phase 19 / D-03 cap" test to cover the summon path's derived melee output. Doing so correctly would require re-deriving `engine/combat.js#foeTurn`'s full melee-swing formula (lvl² + dice-or-d6, times `sp.atk` swings, times `frenzied`) inside a content-level test — duplicating engine logic that could silently drift out of sync with the real formula and give false confidence for a future summon kit shaped differently (e.g. a roster row with `sp.atk: 2`). The WR-01 fix itself (tier-matched `lvl`) already resolves the actual balance defect, and the new `foe-abilities.test.js` unit test pins the corrected `lvl` going forward as a more direct, non-duplicative guard.

### WR-02: two independent copies of the `DEATH_PANIC_THRESHOLD` constant can drift out of sync

**Files modified:** `engine/derived.js`, `engine/combat.js`
**Commit:** 3cf1766
**Applied fix:** Exported `DEATH_PANIC_THRESHOLD = 0.25` as a module-level constant from `engine/derived.js` (the leaf module — it does not import `engine/combat.js`, so no import cycle is introduced) and imported it into `engine/combat.js`, removing both hardcoded local copies. `startCombat`'s phobia-freeze check and `conditionsOf`'s phobia chip now both read the single shared constant.

### WR-03: `content/foe-abilities.js`'s "unbounded fallback" invariant does not hold for the Djinni kit

**Files modified:** `content/foe-abilities.js`
**Commit:** 2e41e08
**Applied fix:** Comment-only change (no data touched). Tightened the module header's kit-order comment to scope the "every kit ends in a truly unbounded ability" invariant to `never_melee` casters (Drudge/Vampire/Stalka Beast/Krupke) — where it does genuinely hold — and added an explicit note that the Djinni's kit (all four abilities `uses: 4`) is the one exception, harmless today only because the Djinni is not `never_melee`, with a warning that a future `never_melee` caster modeled on the Djinni's shape would go permanently silent once its uses are exhausted.

## Skipped Issues

Per `fix_scope: critical+warning`, IN-01 and IN-02 were explicitly excluded from this fix pass and left unfixed, as directed.

### IN-01: `foe.sp` is a shared reference to the frozen `BESTIARY` row object across every foe instance, including summoned foes

**File:** `engine/combat.js:152`, `engine/foeAbilities.js:170`
**Reason:** Out of scope for this fix pass (`fix_scope: critical+warning` excludes Info-tier findings). Pre-existing pattern, not introduced by Phase 19; no engine code currently writes through `foe.sp`, so it is not presently exploitable.
**Original issue:** Every foe object stores `sp` as the same object reference as its `content/bestiary.js` row rather than a copy, so two simultaneous foes of the same creature type share one `sp` object — a future careless write into `foe.sp.*` would silently corrupt shared bestiary data for the rest of the process lifetime.

### IN-02: `pickFoeTarget`/`heroResist` ordering makes party-member bolts/drains fully unresisted

**File:** `engine/foeAbilities.js:190-209`
**Reason:** Out of scope for this fix pass (`fix_scope: critical+warning` excludes Info-tier findings). Explicitly documented as intentional (mirrors the pre-existing Phase 17 member-damage asymmetry) and already covered by `test/unit/foe-abilities.test.js`'s "member path (D-13)" test.
**Original issue:** For `bolt`/`drain` abilities, a live party-member target takes damage unconditionally (no resist/ward/armor/Hardiness), even though the same ability targeting the hero is fully resistible — flagged only as worth a design-notes callout so it isn't mistaken for a bug later.

## Verification

- `npm test` (full suite, `node --test`): 882/882 passing after all three fixes.
- `node --test "test/parity/**/*.test.js"`: 30/30 passing, byte-identical to the frozen prototype master.
- No engine rng-draw order or count changed for any ability-less foe; the one legitimate downstream draw-count shift (walking-dead-t5 per-visit D-15 pins, caused by WR-01's corrected `lvl`) was re-measured and re-pinned with a documenting comment, per the task's explicit allowance for this exact scenario.
- `test/parity/prototype-master.js.txt` and the parity fixtures were not touched.

---

_Fixed: 2026-09-14T04:27:09Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
