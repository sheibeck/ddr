---
phase: 40-spell-rework
plan: 04
subsystem: engine
tags: [spell-system, timers, save-state, parity-carve-out, map-reveal]

# Dependency graph
requires:
  - phase: 40-spell-rework plan 01
    provides: "content/spells.js row 5 renamed to Map the Floor; the niche/flag contract Plan 04's squares field extends"
  - phase: 40-spell-rework plan 02
    provides: "engine/magic.js's data-flag-driven kind branches; the spell:weaken timer precedent (engine/effects.js's shared c.timers shape) Plan 04's spell:reveal record reuses directly"
  - phase: 40-spell-rework plan 03
    provides: "engine/derived.js#conditionsOf's mirror/senses/regen/foresight chip block, extended in place for the reveal chip"
provides:
  - "engine/maze.js: reveal() graduates every touched cell (deletes cell.spellSeen — a no-op on cells that never carried it); refogSpellSeen(floor), the ONE sweep at expiry"
  - "engine/magic.js: the reveal kind branch marks only not-yet-seen non-wall cells seen+spellSeen, starts c.timers['spell:reveal'] via startEffect, narrates floorMapped{squares,cells}"
  - "engine/movement.js: the per-step tick site reacts to the spell:reveal effect->null transition (never a per-step poll) to run the sweep and narrate revealFaded{cells}; descend() deletes a live record silently; teleport() only graduates cells it touches, never ticks the record"
  - "engine/derived.js#conditionsOf: the reveal chip {key:'reveal', polarity:'good', remaining, cadence:'squares'} after foresight, before flight"
  - "test/parity/harness/comparables.js#stripSpellSeen(floor) — a structural tripwire wired into all three exported comparables + the three local duplicates"
  - "engine/saveState.js: clearStaleSpellSeen(floor, c) and migrateSpellNames(c), wired into BOTH validateSave and rehydrate"
  - "src/browser/{eventNarration,toasts,rail}.js: floorMapped/revealFaded fully narrated; the retired detectMagic entries deleted outright (including every comment referencing the literal string)"
  - "test/unit/map-reveal.test.js (new, 18 tests); test/unit/save-validation.test.js (+8 tests)"
affects: [40-05-shell-close]

tech-stack:
  added: []
  patterns:
    - "A per-cell provenance flag (spellSeen), lazily set only by a live cast, graduated by the SAME reveal() function every move/teleport/descend/newRun call site already routes through — the graduation logic lives in exactly one place, not duplicated per caller"
    - "The sweep reacts to the ONE {id, from:'effect', to:null} transition tickSquares already returns (Phase 36/39's established pattern) rather than polling the record every step — research Pitfall 4, explicitly avoided"
    - "A structural (not measured) parity carve-out: spellSeen has no fixture-reachable path at all (no fixture ever casts the reveal spell), so stripSpellSeen is a permanent tripwire like stripTimersField/stripWornField/stripAbilitiesField before it, not a declared content divergence"
    - "Tolerant-load helpers (clearStaleSpellSeen, migrateSpellNames) are wired into BOTH validateSave and rehydrate, mirroring every other additive-with-default helper in that shared chain, even though the plan's own action text only named validateSave explicitly — rehydrate is exercised standalone in tests and by the same idempotent-chain discipline every prior tolerant-load field follows"

key-files:
  created:
    - test/unit/map-reveal.test.js
  modified:
    - content/spells.js
    - engine/maze.js
    - engine/magic.js
    - engine/movement.js
    - engine/derived.js
    - engine/saveState.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js
    - test/unit/spell-table.test.js
    - test/unit/conditions.test.js
    - test/unit/magic.test.js
    - test/unit/save-validation.test.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - docs/SPELLS.md
    - test/parity/FIXTURE-INVENTORY.md

key-decisions:
  - "Ratified Key Decision (40-CONTEXT.md Area 1, user-chosen): re-fog ONLY what the spell alone showed — a per-cell spellSeen provenance flag, normal walking graduates a cell to permanent memory the instant reveal() touches it, one sweep at expiry, a recast refreshes without double-marking. Recorded verbatim in docs/SPELLS.md's new Key Decision section, ready for PROJECT.md at phase close."
  - "clearStaleSpellSeen/migrateSpellNames are wired into rehydrate() as well as validateSave, even though the plan's action text named only validateSave's c:/floor: lines — rehydrate is exercised standalone against a raw serialized state in tests (test/unit/effects.test.js's own pattern) and every other tolerant-load helper in that chain (clearStaleTimers, sanitizeWorn, ensureCharacterAbilities, foldLegacyCounters) already mirrors both entry points; leaving rehydrate out would have made the two load paths silently inconsistent."
  - "REQUIREMENTS.md's SPELL-05 checkbox is NOT marked complete by this plan, following 40-01/40-02/40-03's own established precedent within this phase — 40-05-PLAN.md (phase close) sweeps every SPELL requirement's checkbox in one pass."
  - "spellSeen's harness carve-out is declared structural, not measured — no fixture ever casts the reveal spell, so reveal()'s graduation delete is a provable no-op on every fixture floor; documented as such in FIXTURE-INVENTORY.md rather than a before/after divergence table (there is nothing to measure)."

requirements-completed: []

coverage:
  - id: D1
    description: "Casting Map the Floor marks every not-yet-seen non-wall cell seen+spellSeen (already-seen cells and walls left alone), starts a 40-square c.timers['spell:reveal'] record, and narrates floorMapped{squares,cells} with cells counting only the newly-marked cells; zero rng draws"
    requirement: "SPELL-05"
    verification:
      - kind: unit
        ref: "test/unit/map-reveal.test.js (cast/recast marking tests); test/unit/spell-table.test.js (SPELLS[5].squares === 40 pin)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Normal walking during the window graduates every cell reveal() touches (move/teleport/descend/newRun) — the spellSeen flag is removed, seen stays true forever, the flagged count never increases"
    requirement: "SPELL-05"
    verification:
      - kind: unit
        ref: "test/unit/map-reveal.test.js (walking-graduates test; reveal()/refogSpellSeen pure-function tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "At expiry exactly ONE sweep runs, reacting to the spell:reveal effect->null transition (never a per-step poll, research Pitfall 4): every still-flagged cell re-fogs (seen=false, flag cleared) and narrates revealFaded{cells}; a 41st step never re-sweeps; a recast at any point resets the window to 40 without double-marking; descend() deletes a live record silently with no sweep; teleport() graduates cells but never ticks the record"
    requirement: "SPELL-05"
    verification:
      - kind: unit
        ref: "test/unit/map-reveal.test.js (the 40-step sweep-timing test, the recast-refresh test, the descend/teleport tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "spellSeen is carved out of all three exported *Comparable() functions and the three local per-domain duplicates as a structural tripwire (no fixture ever casts the spell); a fresh newRun floor carries no spellSeen key on any cell across all 20 chargen pin seeds; the prototype master hash is unchanged"
    requirement: "SPELL-05"
    verification:
      - kind: unit
        ref: "test/unit/map-reveal.test.js (newRun pin-seed proof; the three-comparable leak-proof test); full parity glob green; git status --porcelain test/parity/fixtures empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "Old saves load tolerantly through BOTH validateSave and rehydrate: a floor with stale spellSeen flags and no live spell:reveal record has every flag cleared (seen left as saved); a live record is left untouched; a grimoire holding the retired name 'Detect Magic' is renamed to 'Map the Floor' in place, deduped, with no card/narration/rng"
    requirement: "SPELL-05"
    verification:
      - kind: unit
        ref: "test/unit/save-validation.test.js (8 new tests: clearStaleSpellSeen live/not-live/never-injects, migrateSpellNames rename/dedupe/untouched, both entry points); test/unit/map-reveal.test.js (two serializeRun -> validateSave round-trip proofs)"
        status: pass
    human_judgment: false
  - id: D6
    description: "conditionsOf emits a reveal chip with the squares remaining while the window is open, in the fixed order after foresight, before flight; the detectMagic event and its narration/toast/rail entries are retired with zero dead entries anywhere (including comments, per the acceptance grep)"
    requirement: "SPELL-05"
    verification:
      - kind: unit
        ref: "test/unit/conditions.test.js (three order-pin tests extended); test/unit/map-reveal.test.js (conditionsOf integration test, narration-coverage test); test/unit/toastsCoverage.test.js, test/unit/formatEventsCoverage.test.js, test/voice/safety-scan.test.js all green"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-09-18
status: complete
---

# Phase 40 Plan 04: Map the Floor Re-Fog Summary

**A per-cell `spellSeen` provenance flag turns the renamed Map the Floor into a real 40-square timed reveal: walking graduates what it sees into permanent memory, one sweep at expiry re-fogs only what the spell alone showed, and both `validateSave`/`rehydrate` tolerantly migrate old saves (stale flags cleared, "Detect Magic" renamed) with zero parity fixture moves.**

## Performance

- **Duration:** ~27 min
- **Tasks:** 3
- **Files modified:** 19 (1 new, 18 modified)

## Accomplishments

- `engine/maze.js#reveal()` now graduates every cell it touches — `if (cell.spellSeen) delete cell.spellSeen` right after marking it `seen = true` — a no-op on any cell that never carried the flag, so every fixture floor stays byte-identical. `refogSpellSeen(floor)` is the new, pure ONE-sweep function that re-fogs whatever a window never graduated.
- `engine/magic.js`'s `reveal` kind branch now marks only not-yet-seen non-wall cells `seen + spellSeen` (recast-safe, never double-marks), starts a `c.timers["spell:reveal"]` squares record via `startEffect` (`SPELLS[5].squares === 40`, the txt already stated the number), and narrates `floorMapped { squares, cells }` in place of the old permanent `detectMagic` sweep.
- `engine/movement.js`'s per-step tick site reacts to the `spell:reveal` `effect -> null` transition `tickSquares` returns — never a per-step poll (research Pitfall 4) — to run the ONE sweep and narrate `revealFaded { cells }`. `descend()` deletes a live record silently before generating the new floor (no sweep, the chip simply disappears); `teleport()` graduates whatever cells its own `reveal()` call touches but never ticks or clears the record.
- `engine/derived.js#conditionsOf` gains the `reveal` chip (`{ key: "reveal", polarity: "good", remaining, cadence: "squares" }`) in the fixed order after `foresight`, before `flight`.
- `test/parity/harness/comparables.js#stripSpellSeen(floor)` is a structural tripwire (a same-object no-op when nothing is flagged) wired into all three exported comparables and mirrored into the three per-domain local `comparable()` duplicates.
- `engine/saveState.js` gains `clearStaleSpellSeen(floor, c)` (strips stale flags when no LIVE record exists, T-40-07) and `migrateSpellNames(c)` (renames a retired "Detect Magic" grimoire entry to "Map the Floor" in place, first-occurrence dedupe) — both wired into BOTH `validateSave` and `rehydrate`, mirroring the established tolerant-load chain discipline.
- `src/browser/{eventNarration,toasts,rail}.js`: `floorMapped`/`revealFaded` fully narrated (magic/beat tones); the retired `detectMagic` entries — and every comment that used to reference the literal string — are gone outright (`grep -rc "detectMagic"` prints 0 in both narration files).
- `test/unit/map-reveal.test.js` (new, 18 tests) and `test/unit/save-validation.test.js` (+8 tests) cover the full mechanic: cast/recast marking, `reveal()`/`refogSpellSeen` as pure functions, walking graduation, the 40-step sweep-timing proof (steps 1-39 silent, exactly one sweep on the 40th, never a second), the recast-refresh window math, `descend()`/`teleport()`, the `conditionsOf` chip, the `newRun` zero-flag proof across all 20 chargen pin seeds, the harness carve-out (including a direct proof all three exported comparables scrub the flag), the narration-table coverage check, and two `serializeRun -> validateSave` round-trip proofs (a live window survives, a stale one clears).
- `docs/SPELLS.md`'s "Map the Floor — Key Decision" section replaces the Plan 04 placeholder with the ratified decision verbatim, the two research options and why Option A won, the full mechanism, the chip, tolerant load, the harness carve-out, and a Phase 41 orthogonality note. `test/parity/FIXTURE-INVENTORY.md` gains its matching "### Plan 04" structural-carve-out section.

## Task Commits

1. **Task 1: The provenance model — cast marks + timer, reveal() graduation, the one expiry sweep, recast refresh, descend clears, the reveal chip** - `9a5f543` (feat)
2. **Task 2: Harness carve-out (three comparables + three local duplicates), tolerant load (stale flags + old spell name), narration** - `63f46b6` (feat)
3. **Task 3: Ledger Key Decision section, FIXTURE-INVENTORY carve-out note, plan gate** - `5ada92a` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `content/spells.js` — `SPELLS[5].squares = 40`
- `engine/maze.js` — `reveal()`'s graduation delete; new `refogSpellSeen(floor)`
- `engine/magic.js` — the provenance-marking reveal branch + `floorMapped`
- `engine/movement.js` — the per-step `spell:reveal` transition handling + `revealFaded`; `descend()`'s silent record delete
- `engine/derived.js` — `conditionsOf`'s `reveal` chip
- `engine/saveState.js` — `clearStaleSpellSeen`/`migrateSpellNames`, wired into `validateSave` and `rehydrate`
- `test/parity/harness/comparables.js` — `stripSpellSeen`, wired into all three exported comparables
- `test/parity/{combat,magic,movement}-parity.test.js` — `stripSpellSeen` mirrored into each local `comparable()`
- `test/unit/map-reveal.test.js` (new, 18 tests) — the full Task 1 + Task 2 TDD suite
- `test/unit/spell-table.test.js`, `conditions.test.js`, `magic.test.js`, `save-validation.test.js` — pins/order-pins/smoke test extended
- `src/browser/{eventNarration,toasts,rail}.js` — `floorMapped`/`revealFaded` narrated; `detectMagic` retired outright
- `docs/SPELLS.md`, `test/parity/FIXTURE-INVENTORY.md` — the ledger sections

## Decisions Made

See frontmatter `key-decisions` — the ratified re-fog Key Decision text, wiring the tolerant-load helpers into `rehydrate()` as well as `validateSave` (beyond the plan's own literal action text, for chain consistency), the structural (not measured) framing of the harness carve-out, and REQUIREMENTS.md's SPELL-05 checkbox staying unmarked (Plan 05's job) are all recorded there with rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired `clearStaleSpellSeen`/`migrateSpellNames` into `rehydrate()`, not just `validateSave`**
- **Found during:** Task 2 (reading `engine/saveState.js`'s existing chain to place the two new helpers)
- **Issue:** The plan's own action text names only `validateSave`'s `c:`/`floor:` lines. But every other tolerant-load helper in that chain (`clearStaleTimers`, `sanitizeWorn`, `ensureCharacterAbilities`, `foldLegacyCounters`) is already mirrored into `rehydrate()` too, and `rehydrate()` is exercised standalone against a raw serialized state in existing tests (`test/unit/effects.test.js`'s `viaRehydrate` pattern) — leaving the two Plan 04 helpers out of `rehydrate()` would have made the two load entry points silently inconsistent (a save rehydrated directly, bypassing `validateSave`, would keep stale flags and the old spell name forever).
- **Fix:** Added the identical `migratedC`/`clearStaleSpellSeen` wiring to `rehydrate()`, mirroring `validateSave`'s own local exactly.
- **Files modified:** `engine/saveState.js`
- **Verification:** `test/unit/save-validation.test.js`'s new tests exercise both entry points explicitly; `node --test test/unit/save-validation.test.js test/unit/effects.test.js` green.
- **Committed in:** `63f46b6` (Task 2 commit)

**2. [Rule 1 - Bug] Two narration comments accidentally contained the literal string "detectMagic"**
- **Found during:** Task 2 (verifying the acceptance criteria's own `grep -rc "detectMagic" src/browser/eventNarration.js src/browser/toasts.js` prints 0 for both)
- **Issue:** My first pass at the `floorMapped`/`revealFaded` doc comments explained what they replaced by naming the retired event, which kept the literal string alive in the corpus and would have failed the acceptance grep (which checks the whole file, not just the narration table's keys).
- **Fix:** Reworded both comments to describe the change without repeating the retired event's name.
- **Files modified:** `src/browser/eventNarration.js`, `src/browser/toasts.js`
- **Verification:** `grep -rc "detectMagic" src/browser/eventNarration.js src/browser/toasts.js` now prints 0 for both.
- **Committed in:** `63f46b6` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 2 — missing critical consistency between the two load entry points; 1 Rule 1 — a self-authored doc-comment bug caught by the plan's own acceptance grep).
**Impact on plan:** No scope creep, no architectural changes. Both fixes are narrow and were caught and corrected before their respective task commits.

## Issues Encountered

None beyond the two items above (both fixed inline, verified, part of the green suite before commit).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan. A Pixel 7 tester should check, at the end of the run (batched with the other Phase 40 plans):

1. **Cast Map the Floor** — the whole floor appears at once, the rail says "The floor lays itself out in your head — every corridor on this level, for 40 squares," and a MAPPED chip shows 40 squares counting down (this plan wires the chip data; Plan 05 paints spell-only cells in their own distinct map tint — until Plan 05 lands, the map itself will look identical for walked-vs-spell-lit cells, which is expected).
2. **Walk 40 squares after casting** — the corridors actually walked stay lit; everything else fogs back with the rail line "The map forgets what it was told," and the MAPPED chip disappears.
3. **Recast at, say, 20 squares into the window** — the chip resets to counting down from 40 and nothing on the map flickers or re-fogs early.
4. **Descend mid-window** — the MAPPED chip vanishes immediately, and the new floor behaves completely normally (no leftover reveal state).
5. **Resume a pre-Phase-40 save that had Detect Magic in the grimoire** — the Hero-tab grimoire row now reads "Map the Floor," with no card or popup announcing the rename.

## Next Phase Readiness

- Every engine-side piece SPELL-05 needs is in place and fully tested: the provenance flag, the timer, the one sweep, the chip, the harness carve-out, and tolerant load. Plan 05 (shell close) can build directly on this — painting spell-only (`spellSeen: true`) cells in a distinct map tint, rendering the MAPPED/THE MAP FORGETS rail cards, and showing the `reveal` chip's countdown — without touching any engine mechanics again.
- `docs/SPELLS.md`'s Key Decision section documents everything Plan 05 (and PROJECT.md at phase close) will need, verbatim.
- No blockers. `npm test`: 2800/2800, `# fail 0`. Master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). Full parity glob green; `git status --porcelain test/parity/fixtures` empty.

---
*Phase: 40-spell-rework*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `content/spells.js`, `engine/maze.js`, `engine/magic.js`, `engine/movement.js`, `engine/derived.js`, `engine/saveState.js`, `test/parity/harness/comparables.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/parity/movement-parity.test.js`, `test/unit/map-reveal.test.js`, `test/unit/spell-table.test.js`, `test/unit/conditions.test.js`, `test/unit/magic.test.js`, `test/unit/save-validation.test.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `docs/SPELLS.md` ("## Map the Floor — Key Decision: re-fog provenance (Plan 04)" present, placeholder gone), `test/parity/FIXTURE-INVENTORY.md` ("### Plan 04" present) all exist with the expected content.
Verified in git log: `9a5f543`, `63f46b6`, `5ada92a` all present on `master`.
