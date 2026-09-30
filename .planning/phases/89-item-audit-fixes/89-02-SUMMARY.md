---
phase: 89-item-audit-fixes
plan: 02
subsystem: items
tags: [enlarge, potion, size, narration, fixtures]
requires:
  - phase: 75.2
    provides: the size-step rules (SIZE_DAMAGE_PER_STEP, SIZE_FACES_PER_STEP, sizeAxisStep, foeToHitVs)
provides:
  - "Enlarge potion: +11 damage for 50 squares (size step +2, plus +9 bulk as eff.dmg), foes +1 to hit the drinker, price 150"
  - "dmgTotal on the itemEffectStarted event and the size-item condition chip"
  - "Enlarge's own Oracle line, rail line and Enlarged-chip sentence, TEXT-01 wording"
affects: [phase-92-store-economy-and-bot-pass, 89-09-gauntlet-reword]
tech-stack:
  added: []
  patterns: ["a bulk damage bonus rides act.eff.dmg, the same eff(c, 'dmg') term the Ring of Power uses"]
key-files:
  created:
    - test/unit/enlarge-potion.test.js
    - docs/narrative-pass/why/89-02.json
  modified:
    - content/potions.js
    - engine/items.js
    - engine/derived.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - mazeworld.html
    - test/unit/authored-ranges.test.js
    - test/unit/size-items.test.js
    - test/unit/size-voice.test.js
    - test/unit/conditions.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/fixtures/shell-snapshots/thief-store.store.txt
    - test/parity/FIXTURE-INVENTORY.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "Bulk carried as activation data (eff.dmg: 9), not a size-damage multiplier: every read (Hero sheet range, a strike, a Joiner's member view, expectedStrike) sees it through the existing eff(c, 'dmg') term with no new code path"
  - "The to-hit cost stays the size step alone (SIZE_FACES_PER_STEP x step), read by foeToHitVs; the +9 bulk adds no extra cost"
  - "The text says 'foes +1 to hit you' (a signed to-hit number), not a face count"
patterns-established:
  - "A size item's whole damage bonus is dmgTotal = SIZE_DAMAGE_PER_STEP x step + eff.dmg, stamped on the started event and the chip; narration reads it, never a restated formula"
requirements-completed: [ITEM-05, ITEM-01]
status: complete
duration: ~45 min
completed: 2026-09-30
---

# Phase 89 Plan 02: The Enlarge potion is Troll-sized Summary

**Enlarge is +11 damage for 50 squares at the cost of foes +1 to hit you, priced 150, with the started event, chip and every line reading the engine's own dmgTotal.**

## What changed

- `content/potions.js`: Enlarge row is `price: 150`, `act: { kind: "enlarge", effect: 50, eff: { size: 1, dmg: 9 } }`, text "one size larger for fifty squares: +11 damage, and foes +1 to hit you". Strength is untouched (+8, 25 squares, 100).
- `engine/items.js#applyActivation`: a size item's started event carries `dmgTotal` (SIZE_DAMAGE_PER_STEP x step + the item's own `eff.dmg`): 11 for Enlarge, 2 for the Gauntlet of the Giant.
- `engine/derived.js#conditionsOf`: the size-item chip carries the same `dmgTotal`; comments and the descriptor doc updated. No change to `weaponDamageTerms` or `foeToHitVs`: the +9 arrives through the existing `eff(c, "dmg")` term and the step through `sizeDamage` / `foeToHitVs`.
- `src/browser/eventNarration.js`, `src/browser/narrationLines.js`, `mazeworld.html`: Enlarge has its own Oracle line, rail line and chip sentence stating "+11 damage" and "foes +1 to hit you"; the Gauntlet's are byte-identical.
- No new rng draw: using Enlarge draws nothing, exactly as before.

A Troll drinking it stacks: its damage terms rise by exactly 11 (+11 to +22) and its size steps Large to Huge; a Human's rise by 11 and it reads Large. The Gauntlet plus Enlarge on a Human is +13.

## Tasks and commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Make Enlarge Troll-sized | `c01f9581` |
| 2 | Say it plainly: lines, chip, authored-range pins, ledger | `efe18e46` |
| 3 | Measure, declare and regenerate the moved fixture | `3b39f8e1` |

Task 1 followed the test-first order (the new test file failed 8 of 10 before the change). It is committed as one `feat` commit with its implementation.

## Fixture drift (ITEM-05)

Base `70164797`. Measured, not predicted:

- `node --test "test/parity/**/*.test.js"`: 66 / 66, zero drift. `tools/fixture-inventory.mjs --json` lists no Enlarge. `test/parity/prototype-master.js.txt` and `test/parity/harness/comparables.js` untouched (no `REWORDED_TXT_ITEMS` carve-out needed).
- `roll-high-state-pins.test.js` 13 / 13 and `roll-high-save-compat.test.js`: zero drift, no label pasted, `roll-high-baseline.mjs save` never run.
- ONE moved fixture, regenerated alone with `MZ_SNAPSHOT_UPDATE=1` (the other seven re-wrote byte-identical and were restored): `test/unit/fixtures/shell-snapshots/thief-store.store.txt`, the Enlarge row.
  - before: `one size larger for fifty squares: +2 damage, and one face easier for foes to hit`, `53 wm`
  - after: `one size larger for fifty squares: +11 damage, and foes +1 to hit you`, `105 wm`
  - rationale: the potion's new text and price (75 x 0.7 haggle = 53 to 150 x 0.7 = 105). Declared in `shell-tab-snapshots.test.js`'s header and in `FIXTURE-INVENTORY.md` ("### Phase 89 plan 02").
- Unit pins moved with the rule (only the Enlarge expectations; before then after):
  - `size-items.test.js`: `ACTIVATION_OF.Enlarge` `{ size: 1 }` then `{ size: 1, dmg: 9 }`; a Human's damage +2 then +11; Gauntlet plus Enlarge +4 then +13; Dwarf +4 then +13 over Human; Elf back to Human then Human + 9; started event gains `dmgTotal` 11.
  - `conditions.test.js`: the Gauntlet chip gains `dmgTotal: 2`; a haste chip carries none.
  - `authored-ranges.test.js`: the Enlarge SIGNED_ROW "+2 damage" then "+11 damage" (engine value computed from `weaponDamageTerms`); the combined giant/enlarge explain test split, the Enlarge half stating "+11 damage, and foes +1 to hit you"; the face-change test split.
  - `size-voice.test.js`: the chip explanation and the Oracle/rail line pins for Enlarge, both numbers read from the engine.

Verification: `node tools/narrative-review.mjs --check` exits 0. `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json` untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Declared the snapshot regeneration in `test/unit/shell-tab-snapshots.test.js`**
- **Found during:** Task 3 (full `npm test`)
- **Issue:** the plan predicted the save-compat pin or a parity scenario might move; the one fixture that actually moved was `thief-store.store.txt`, which the plan's files list did not name.
- **Fix:** regenerated only that fixture and added the house-style declared paragraph to the test's header plus the FIXTURE-INVENTORY section.
- **Files modified:** `test/unit/fixtures/shell-snapshots/thief-store.store.txt`, `test/unit/shell-tab-snapshots.test.js`
- **Commit:** `3b39f8e1`

Otherwise none: the plan executed as written.

## Notes for the orchestrator

- The corpus's synthetic itemEffectStarted variant (`tools/lib/event-variants.mjs`, off limits) carries no `dmgTotal`, so the corpus renders Enlarge's line with the step's own "+2"; a real potion prints "+11". The ledger rows (`docs/narrative-pass/why/89-02.json`) quote the real "+11" line (the review test is number-blind for builders) and say so in their why.
- `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html` are generated; if 89-01 or another plan also adds ledger rows, re-run `node tools/narrative-review.mjs` after the merge.
- `npm test` full run: 8,296 tests, 8,294 pass, 0 fail, 2 skipped (base 8,282 / 8,280 / 0 / 2). None of the known worktree-only CRLF doc-ledger failures appeared.

## Known Stubs

None.

## Flagged assumption (spec-less probe)

ITEM-05's probe row stays unresolved: whether +11 for 50 squares at foes +1 to hit is "worth drinking" at every depth is not measured here (bots run once, at the milestone end, Phase 92). This plan pins the ruled numbers and the Troll stack only.

## Human verification (deferred to end of run)

1. Buy an Enlarge potion: the store line reads 150 wilmst and states "+11 damage, and foes +1 to hit you".
2. Drink it: the Oracle and rail say +11 damage and foes +1 to hit; the Hero sheet's damage range rises by 11; the Enlarged chip explains the same.
3. As a Troll, drink Enlarge: the size reads Huge and the damage range rises by 11 again.

## Self-Check: PASSED

- Files found: test/unit/enlarge-potion.test.js, docs/narrative-pass/why/89-02.json, content/potions.js, engine/items.js, engine/derived.js.
- Commits found: c01f9581, efe18e46, 3b39f8e1.
- STATE.md, ROADMAP.md and REQUIREMENTS.md not modified.
