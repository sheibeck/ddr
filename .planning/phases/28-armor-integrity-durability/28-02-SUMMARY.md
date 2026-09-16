---
phase: 28-armor-integrity-durability
plan: 02
subsystem: presentation
tags: [armor, viewmodel, toasts, narration, cloak, formatter]

# Dependency graph
requires: ["28-01"]
provides:
  - "armorDisplay(c) — the ONE render-ready effective-armor description (label/ar/current/max/worn/destroyed/magic/sub/wornSub/under/line), reading engine/derived.js#armorSoak(c) so the UI can never disagree with the combat soak site"
  - "bagArmorText(it) — a bag armor row formatter reading the item's own left/wp durability"
  - "characterSheetViewModel's ARMOR stat now renders through armorDisplay (durability + cloak-effective-armor visible on the tile)"
  - "armorSoaked toast + Oracle narration branch on magic/underMin flags — all four soak outcomes (wear, under-min no-wear, magic-plate never-wears, destroyed) render distinct text"
  - "itemUnequipped Oracle narration distinguishes a destroyed piece (left behind) from a normal unequip (back in the bag)"
  - "Cloak of Armor's txt states the AR 15/never-wears/any-class rule plainly"
affects: [28-03-shell-wiring]

tech-stack:
  added: []
  patterns:
    - "Single-source presentation formatter (armorDisplay) reading an engine derived.js function — mirrors the pre-existing damageBracket <-> weaponDamage pattern"
    - "Three-way additive-flag branch (magic / underMin / else) in both toasts.js and eventNarration.js for the same event, matching the existing halved-flag precedent"
    - "stripCloakArmorTxt — a new cosmetic-content-divergence carve-out mirroring stripNameField, for a deliberate content rewrite that a chargen roll can surface against the frozen prototype"

key-files:
  created:
    - test/unit/armorDisplay.test.js
  modified:
    - src/browser/viewModels.js
    - test/unit/characterSheetViewModel.test.js
    - src/browser/toasts.js
    - src/browser/eventNarration.js
    - content/treasure-tables.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js

key-decisions:
  - "armorDisplay's current/max always reflect the WORN piece's pool (never the cloak's) per the plan's locked formatter contract — the cloak's magic plate never wears, so there is no separate durability pool to show for it"
  - "Cloak of Armor's txt rewrite is a genuine but purely cosmetic content divergence from the frozen prototype (txt is never read by engine mechanics); carved out via a new stripCloakArmorTxt helper rather than editing prototype-master.js.txt or any fixture"

requirements-completed: [ARMOR-02, ARMOR-04, ARMOR-05]

coverage:
  - id: D1
    description: "ARMOR-02 reproduction: the armorSoaked toast's wear equals the durability delta on the displayed armor — a worn Plate ar 15 armorMin 2 at 45/45 hit for 39 shows wear 39 in the toast AND drops the formatter's current from 45 to 6"
    requirement: "ARMOR-02"
    verification:
      - kind: unit
        ref: "test/unit/armorDisplay.test.js#ARMOR-02: toast/panel agreement -- the armorSoaked toast's wear equals the durability delta on the displayed armor"
        status: pass
    human_judgment: false
  - id: D2
    description: "armorDisplay(c) formatter contract holds for every documented case: bare, destroyed, cloak-over-damaged-worn, cloak-over-better-worn, cloak-over-nothing, cloak-over-destroyed; no formatter string uses the old two-letter durability unit token"
    requirement: "ARMOR-02"
    verification:
      - kind: unit
        ref: "test/unit/armorDisplay.test.js (7 armorDisplay/bagArmorText cases + the unit-token audit)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cloak of Armor legibility: the item's txt states the AR 15/never-wears/any-class rule plainly; the effective-armor readout is derived from armorSoak(c) (never re-derived in the UI layer)"
    requirement: "ARMOR-04"
    verification:
      - kind: unit
        ref: "test/unit/armorDisplay.test.js#CLOAKS: the Cloak of Armor's txt states the rule plainly"
        status: pass
      - kind: unit
        ref: "test/unit/armorDisplay.test.js#armorDisplay(c): the Cloak of Armor carried over a BETTER worn piece (ar 17, take-the-better)"
        status: pass
    human_judgment: false
  - id: D4
    description: "All four armorSoaked outcomes (wear, under-min no-wear, magic never-wears, destroyed) render pairwise-distinct text in both TOAST_FOR and EVENT_NARRATION; itemUnequipped narrates a destroyed piece honestly"
    requirement: "ARMOR-05"
    verification:
      - kind: unit
        ref: "test/unit/armorDisplay.test.js#TOAST_FOR.armorSoaked: the four outcomes render distinct text"
        status: pass
      - kind: unit
        ref: "test/unit/armorDisplay.test.js#EVENT_NARRATION.armorSoaked: the four outcomes narrate distinctly"
        status: pass
      - kind: unit
        ref: "test/unit/armorDisplay.test.js#EVENT_NARRATION.itemUnequipped: a destroyed piece is narrated honestly"
        status: pass
      - kind: integration
        ref: "npm test (full suite) — 1478/1478 passing"
        status: pass

duration: ~35min
completed: 2026-09-15
status: complete
---

# Phase 28 Plan 02: Presentation Formatter & Four-Outcome Copy Summary

**One shared `armorDisplay(c)` formatter (reading `armorSoak(c)`) now backs the sheet ARMOR stat, closing the ARMOR-02 "toast says wear, panel shows no damage" bug at its root; all four armor-soak outcomes render distinct toast/Oracle text; and the Cloak of Armor's item text states its AR 15/never-wears/any-class rule plainly — full 1478/1478 suite green with the frozen prototype master untouched.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-15
- **Tasks:** 3 (Tasks 1-2 `tdd="true"`, Task 3 `type="auto"`)
- **Files modified:** 7 (1 new test file, 6 modified)

## Accomplishments

- Wrote `test/unit/armorDisplay.test.js` FIRST (RED), led by the ARMOR-02 reproduction test: drives `applyFoeDamageToPlayer` with scripted rng (a Plate-wearer, ar 15, armorMin 2, 45/45, hit for 39) and asserts the `armorSoaked` event's `wear` (39) equals the delta the new formatter shows (45 -> 6), plus 14 more pins for the formatter contract, `bagArmorText`, the sheet stat, and the four-outcome toast/Oracle/cloak-text copy.
- Added `armorDisplay(c)` and `bagArmorText(it)` to `src/browser/viewModels.js` — `armorDisplay` reads `armorSoak(c)` (engine/derived.js) as its single source of effective armor (never re-deriving cloak-vs-worn in the UI layer), returning `{ label, ar, current, max, worn, destroyed, magic, sub, wornSub, under, line }` exactly per the plan's locked formatter contract. Wired `characterSheetViewModel`'s ARMOR stat through it (`STUDDED · AR 10 · 18/18 hp` for seed 42, `NOTHING · AR 0` for a bare Fridgian), updating the one existing sheet-test pin that changed shape.
- Extended `armorSoaked` in both `src/browser/toasts.js` and `src/browser/eventNarration.js` with a three-way branch (magic / underMin / the pre-existing wear-or-halved template) reading the `underMin`/`magic` flags Plan 01 added — all four outcomes (`Armour takes N · wear N`, `Armour shrugs off N · under its min, no wear`, `The cloak's plate takes N · never wears`, `Your armour gives out.`) are now pairwise distinct in both the toast table and the Oracle log.
- Added a `destroyed` branch to `eventNarration.js#itemUnequipped` — a destroyed piece is narrated as left behind ("The bag declines the honor") instead of the normal "back in the bag" line, which stays byte-identical for every other unequip.
- Rewrote the Cloak of Armor's `txt` in `content/treasure-tables.js` from vague flavor ("a full suit of plate that weighs nothing") to state the rule plainly: `"soaks as plate (AR 15) over whatever you wear — any class, never wears out, light as a rumor"` (ARMOR-04's any-class addition, no Fighter gate).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the ARMOR-02 reproduction test FIRST (RED)** - `2b7f324` (test)
2. **Task 2: armorDisplay + bagArmorText in viewModels.js; ARMOR stat through the formatter (GREEN)** - `fec0fd0` (feat)
3. **Task 3: Four-outcome toast/Oracle copy, destroyed-unequip narration, Cloak of Armor text + full-suite gate** - `eaf24c9` (feat)

_Tasks 1 and 2 form the RED/GREEN TDD gate; no REFACTOR commit was needed. Task 3 is `type="auto"` (not tdd) per the plan._

## Files Created/Modified

- `test/unit/armorDisplay.test.js` (new) - 15 tests: the ARMOR-02 reproduction pin, 7 `armorDisplay`/`bagArmorText` formatter-contract cases, the old-unit-token audit, 2 sheet-stat pins, the four-outcome toast pin, the four-outcome Oracle pin, the destroyed-unequip pin, and the Cloak of Armor `txt` pin
- `src/browser/viewModels.js` - adds `armorSoak` to the `derived.js` import; new exported `armorDisplay(c)`/`bagArmorText(it)`; `characterSheetViewModel`'s ARMOR stat now reads `armorDisplay(c).sub`/`.under` instead of the old `AR n`-only string
- `test/unit/characterSheetViewModel.test.js` - updated the one ARMOR-stat pin to the new durability-inclusive shape (`STUDDED · AR 10 · 18/18 hp`); the bare-Fridgian `NOTHING · AR 0` pin stayed byte-identical, as the formatter contract guarantees
- `src/browser/toasts.js` - `armorSoaked` now branches on `e?.magic`/`e?.underMin` before falling through to the existing wear/halved template
- `src/browser/eventNarration.js` - `armorSoaked` gains the same three-way branch; `itemUnequipped` gains a `destroyed` branch
- `content/treasure-tables.js` - Cloak of Armor's `txt` rewritten to state the AR 15/never-wears/any-class rule
- `test/parity/harness/comparables.js` - new `stripCloakArmorTxt(c)` helper (Rule 1 deviation, see below), wired into `movementComparable`/`combatComparable`/`economyComparable`
- `test/parity/combat-parity.test.js` - applies the same `stripCloakArmorTxt` strip in its own local `comparable()` (this file predates the shared harness extraction and keeps its own copy)

## Decisions Made

- `armorDisplay`'s `current`/`max` always reflect the WORN piece's own pool, never the cloak's — the cloak's magic plate has no separate durability pool to show, matching the plan's locked formatter contract table verbatim.
- Kept `it.txt` on armor bag items (not removed) even though `bagArmorText` supersedes it for display — no structural consumer of the field was found, and removing it is out of this plan's minimal-diff scope (Plan 03 owns wiring `renderCarriedList` off of it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cloak of Armor `txt` rewrite created a cosmetic parity divergence; added a carve-out**
- **Found during:** Task 3's full `npm test` gate
- **Issue:** Rewriting `content/treasure-tables.js`'s Cloak of Armor `txt` (required by ARMOR-04) is compared against the frozen `test/parity/prototype-master.js.txt`'s classic-script `CLOAKS` table, which still carries the original flavor line. The combat-parity fixture's `flee` scenario (seed 17) happens to roll this cloak into the starting bag at chargen, so its initial-boot-state comparison — and `full-suite.test.js`'s reuse of the shared `combatComparable` — both failed on `c.items[0].txt` diverging (3 failing assertions total across two test files).
- **Fix:** Added `stripCloakArmorTxt(c)` to `test/parity/harness/comparables.js` (mirrors the existing `stripNameField` cosmetic-divergence precedent: `txt` is display-only flavor text, never read by any engine mechanic), wired into `movementComparable`/`combatComparable`/`economyComparable`. `test/parity/combat-parity.test.js` keeps its own local `comparable()` (predates the shared harness extraction per the project's Decision log) so the same strip was applied there directly.
- **Files modified:** `test/parity/harness/comparables.js`, `test/parity/combat-parity.test.js` (same commit as Task 3's copy changes — `eaf24c9`)
- **Verification:** `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`, matching Plan 01's recorded value); no fixture JSON file was edited (`git status --porcelain test/parity/` clean after commit); full `npm test` now 1478/1478 passing.

---

**Total deviations:** 1 auto-fixed (a genuine cosmetic content divergence surfaced by the required ARMOR-04 copy change, carved out per the Engine Gate's own established precedent — no fixture regenerated, no engine behavior touched)
**Impact on plan:** Zero functional impact — a test-harness-only addition proving the divergence is exactly what it claims to be (cosmetic `txt` only).

## Issues Encountered

None beyond the parity carve-out documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (shell wiring + Key Decision) can now bridge `armorDisplay`/`bagArmorText` onto the classic script's global namespace (`window.__mzArmorDisplay`) and wire `mazeworld.html`'s `#s-arm`, `#s-kit`, the gear worn row, `renderCarriedList`, the find card, the drop shelf, and the store repair row through them — this plan's formatter and copy are the presentation-model half Plan 03 depends on.
- The Key Decision row for ARMOR-01 (soak-vs-wear canon kept; cloak = never-wearing plate for any carrier) is still Plan 03's documentation job, unaffected by anything here.
- Full `npm test`: **1478/1478 passing, 0 failures**. Parity: `git status --porcelain test/parity/` clean; `git hash-object test/parity/prototype-master.js.txt` unchanged at `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

## Self-Check: PASSED

- FOUND: test/unit/armorDisplay.test.js
- FOUND: src/browser/viewModels.js (armorDisplay/bagArmorText exports)
- FOUND: src/browser/toasts.js
- FOUND: src/browser/eventNarration.js
- FOUND: content/treasure-tables.js
- FOUND: test/parity/harness/comparables.js
- FOUND: test/parity/combat-parity.test.js
- FOUND commit: 2b7f324
- FOUND commit: fec0fd0
- FOUND commit: eaf24c9
- npm test: 1478/1478 passing, 0 failures
- Parity master hash unchanged: a1f4d0dc29782218d8e5aab65bc5989c33f917f0

---
*Phase: 28-armor-integrity-durability*
*Completed: 2026-09-15*
