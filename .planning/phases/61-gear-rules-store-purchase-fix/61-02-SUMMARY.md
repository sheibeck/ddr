---
phase: 61-gear-rules-store-purchase-fix
plan: 02
subsystem: gear-economy
tags: [engine, view-models, upgrade-explanation, family-friendly-voice]

# Dependency graph
requires: []
provides:
  - "engine/derived.js#noCritFor(c) — the ONE noCrit rule expectedStrike already used, now exported and reused"
  - "engine/derived.js#gearCompareParts(c, it) — plain-data parts for the weapon/armor upgrade explanation"
  - "src/browser/upgradeWhy.js — engine-free, import-free UPGRADE_WHY_COPY + upgradeWhyText(parts) + swingText(x)"
  - "src/browser/viewModels.js#lootCompare(...).why — additive explained-line field; line reads '{why} · upgrade|not an upgrade' for weapons/armor"
  - "mazeworld.html find card shows the compare line for a weapon/armor find"
affects: [61-03-rail-explanation, 61-04-store-row-explanation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parts-then-format split: engine/derived.js exposes plain-data PARTS from the same arithmetic the verdict already used; a zero-import presentation module formats them — narrationLines.js/eventNarration.js can reuse the formatter in Plan 03 without breaking their own purity guards."

key-files:
  created:
    - src/browser/upgradeWhy.js
    - test/unit/upgrade-why.test.js
    - .planning/phases/61-gear-rules-store-purchase-fix/deferred-items.md
  modified:
    - engine/derived.js
    - src/browser/viewModels.js
    - mazeworld.html
    - test/unit/lootCompare.test.js
    - test/unit/gear-axes.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/shell-clarity-43.test.js

key-decisions:
  - "gearCompareParts never restates weaponUpgradeDelta/armorUpgradeDelta's arithmetic — it calls expectedStrike with the exact same argument shapes, pinned equal by a consistency test across every WEAPONS key x bonus 0..2 x 4 sample heroes."
  - "The weapon line's shape changed from a bare '+0.5 a swing'/'not an upgrade' to '{why} · upgrade|not an upgrade' — a deliberate, plan-specified change (greenfield: pins updated, no old wording kept alive). The armor line stayed byte-identical."
  - "why is null when the item is illegal (can't-use line unchanged) — the explanation is advice only, never computed for something you can't buy/take anyway."

requirements-completed: [STORE-03]

coverage:
  - id: D1
    description: "engine/derived.js exports noCritFor(c) (extracted verbatim from expectedStrike) and gearCompareParts(c, it), pinned equal to weaponUpgradeDelta/armorUpgradeDelta by a consistency test"
    requirement: STORE-03
    verification:
      - kind: unit
        ref: "test/unit/upgrade-why.test.js#consistency: round2(got.strike - have.strike) === weaponUpgradeDelta(c, it), for every WEAPONS key x bonus 0..2 x sample hero"
        status: pass
      - kind: unit
        ref: "test/unit/gear-axes.test.js (expectedStrike/weaponUpgradeDelta pins unchanged after the noCritFor extraction)"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/browser/upgradeWhy.js formats gearCompareParts into the explanation line; the Spiked Staff case reads the exact CONTEXT-pinned string"
    requirement: STORE-03
    verification:
      - kind: unit
        ref: "test/unit/upgrade-why.test.js#Spiked Staff: level-3 Human Wizard (Quarter Staff, prof 0) reads the exact CONTEXT string"
        status: pass
    human_judgment: false
  - id: D3
    description: "lootCompare's line explains itself on the loot screen (already renders cmp.line) and the find card now shows it too"
    requirement: STORE-03
    verification:
      - kind: unit
        ref: "test/unit/lootCompare.test.js (Broadsword +2 / Dagger explained lines, armor pins byte-identical)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-clarity-43.test.js#FIND branch: a weapon/armor find shows the explained compare line via window.__mzLootCompare(c, it).line"
        status: pass
    human_judgment: false
  - id: D4
    description: "The bot plays unchanged (byte-identical smoke), and the full suite / this plan's own test files are green"
    verification:
      - kind: other
        ref: "cmp of tools/tune-difficulty.mjs --seeds=20 --json before/after the engine.derived.js edit"
        status: pass
      - kind: unit
        ref: "node --test test/unit/upgrade-why.test.js test/unit/lootCompare.test.js test/unit/gear-axes.test.js test/unit/hp-not-wp.test.js test/unit/shell-clarity-43.test.js test/unit/shell-loot-screen.test.js test/unit/bag-cap-gate.test.js (all pass)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-23
status: complete
---

# Phase 61 Plan 02: The Upgrade Line Explains Itself Summary

**The one hit-math verdict is unchanged; `gearCompareParts`/`upgradeWhyText` now build the explanation from the SAME derived helpers, and the loot screen + find card show it — the Spiked Staff case reads exactly "d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade".**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-23
- **Tasks:** 2
- **Files modified/created:** 10 (2 new source files, 1 new test file, 6 modified, 1 new deferred-items ledger)

## Accomplishments

- `engine/derived.js#noCritFor(c)` extracted verbatim from `expectedStrike`'s own inline noCrit rule, then reused by both `expectedStrike` and the new `gearCompareParts`.
- `engine/derived.js#gearCompareParts(c, it)` returns plain-data parts (weapon `got`/`have` dice/need/crit/strike, `lostProf`; armor `got`/`have` AR) from the exact same `expectedStrike` call shapes `weaponUpgradeDelta` uses — never restates the arithmetic.
- `src/browser/upgradeWhy.js` (new): engine-free, import-free formatter — `UPGRADE_WHY_COPY`, `upgradeWhyText(parts)`, `swingText(x)`. Names only the terms that differ (dice, to-hit, crit range, per-swing numbers, lost proficiency).
- `src/browser/viewModels.js#lootCompare` now returns an additive `why` field and joins it into `line` for weapons/armor: `"{why} · upgrade"` / `"{why} · not an upgrade"`. Armor's rendered text is byte-identical to before; the weapon line's shape is a deliberate change (was a bare "+0.5 a swing"/"not an upgrade").
- The loot screen already rendered `cmp.line` (no change needed); the find card (`mazeworld.html`, `S.pendingFind` branch) now pushes one additional line for a weapon/armor find via `window.__mzLootCompare(c, it).line`. Diff: +1/-0 lines in `mazeworld.html`.
- Bot smoke (`tools/tune-difficulty.mjs --seeds=20 --json`) byte-identical before/after the `engine/derived.js` edit — proves the `noCritFor` extraction changed nothing behaviorally.

## Measured strings (pinned by test)

- **The Spiked Staff case** (level-3 Human Wizard, seed 7, Quarter Staff, prof 0): `upgradeWhyText(gearCompareParts(c, it))` = `"d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing"`; full `lootCompare` line = `"d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade"`.
- **`lootCompare.test.js` fixedChar (Fighter/Soldier, Broadsword, noCrit)**:
  - Broadsword +2 (upgrade): `"d10+2 +2 vs your d10+2 · 2.6 vs 2.1 a swing · upgrade"`
  - Dagger (not better): `"d6/2 vs your d10+2 · +1 to hit · 0.9 vs 2.1 a swing · not an upgrade"`
- **Armor pins unchanged**: `"AR 15 vs your AR 6 · upgrade"`, `"AR 6 vs your AR 6 · not an upgrade"`.
- **Sample heroes used in `test/unit/upgrade-why.test.js`** (all built from `newRun(seed).c` with explicit field overrides, per the plan's instruction):
  - seed 7 → level-3 Magic User/Wizard, Quarter Staff, prof 0 (the CONTEXT-pinned Spiked Staff case).
  - seed 3 → overridden into a Knight-style Fighter, prof 2, Long Sword (lostProf term).
  - seed 5 → overridden into a noCrit Guard, Quarter Staff (no crit term).
  - seed 9 → overridden into a bare-handed Fighter, weapon "Fists" (bare-hands term).
  - seed 11 → overridden into a Fighter who can crit, Quarter Staff (Rapier crit-range term).

## Bot smoke

`node tools/tune-difficulty.mjs --seeds=20 --json` before (captured pre-edit, baseline) and after (post both tasks) are byte-identical (`cmp` exit 0).

## `npm test`

3907 pass / 16 fail / 3923 total. All 16 failures are pre-existing, unrelated to this plan's files (CRLF/EOL fixture mismatches in `test/unit/class-pass-ledger.test.js`, `test/unit/flee-ledger.test.js`, `test/unit/shell-tab-snapshots.test.js`, and a report-parsing issue in `test/parity/divergence-records.test.js`) — see `deferred-items.md` for the root-cause analysis (no `.gitattributes`, `core.autocrlf=true`, matches the already-tracked v1.8 "`.gitattributes eol=lf` pin" deferred item). Every test this plan's own `<verify>` blocks name is green.

Every test this plan's own scope names is green: `node --test test/unit/upgrade-why.test.js test/unit/lootCompare.test.js test/unit/gear-axes.test.js test/unit/hp-not-wp.test.js test/unit/shell-clarity-43.test.js test/unit/shell-loot-screen.test.js test/unit/bag-cap-gate.test.js` → 114/114 pass (across all seven files, combined run).

`npm run boot:check`: `FAIL painted`/`FAIL graves`/`FAIL title` (162-byte DOM dump) — the SAME pre-existing, documented environment block STATE.md already records under "Blockers/Concerns (open)" (Phase 50 tooling note), reproduced here unrelated to this plan's one-line `mazeworld.html` edit.

## Task Commits

Each task was committed atomically:

1. **Task 1: gearCompareParts + noCritFor (derived.js) and the upgradeWhy.js formatter, test-first** - `44ca833` (feat)
2. **Task 2: lootCompare explains itself; the find card shows it; pins updated; bot smoke** - `6d939f0` (feat)

_Note: this was `type="auto" tdd="true"` for Task 1 but landed as a single commit — the plan's own `<verify>` was the test-first gate (the test file was authored alongside the implementation and iterated to green before committing), not a separate RED/GREEN commit pair; no plan-level `type: tdd` gate applies to this plan._

## Files Created/Modified

- `engine/derived.js` - adds `noCritFor(c)` (extracted from `expectedStrike`) and `gearCompareParts(c, it)`
- `src/browser/upgradeWhy.js` - NEW: `UPGRADE_WHY_COPY`, `upgradeWhyText(parts)`, `swingText(x)`
- `test/unit/upgrade-why.test.js` - NEW: 17 tests covering consistency, the Spiked Staff string, per-term/edge/purity/voice
- `src/browser/viewModels.js` - `lootCompare` gains additive `why`; weapon/armor `line` explains itself
- `mazeworld.html` - find card pushes `window.__mzLootCompare(c, it).line` for a weapon/armor find (+1/-0 lines)
- `test/unit/lootCompare.test.js` - weapon line pins updated to the measured explained strings; `cmp.why` asserted
- `test/unit/gear-axes.test.js` - line-shape pin updated (ends `' · upgrade'`/`' · not an upgrade'`, contains `' a swing'`)
- `test/unit/hp-not-wp.test.js` - `UPGRADE_WHY_COPY` added to the walked copy-object list
- `test/unit/shell-clarity-43.test.js` - one new pin for the find-card compare line
- `.planning/phases/61-gear-rules-store-purchase-fix/deferred-items.md` - NEW: logs the 16 pre-existing unrelated `npm test` failures and the documented `boot:check` environment block

## Decisions Made

- `gearCompareParts` is placed directly after `expectedStrike` in `engine/derived.js` (not a new file) — it is engine-scoped derived data, matching where `weaponCrit`/`weaponNeedMod`/`expectedStrike` already live.
- `upgradeWhy.js` carries zero imports (not even from `content/`) so `narrationLines.js`'s T-25-23 purity guard and `eventNarration.js`'s engine-free contract can import it unmodified in Plan 03.
- The weapon line's wording changed (was a bare per-swing delta, now the full explanation) — this is the plan's explicit intent (STORE-03's whole point), so every affected pin was updated rather than preserved; the armor line's wording was kept byte-identical because `gearCompareParts`'s armor branch produces exactly the same `"AR {got} vs your AR {have}"` text the old inline template did.

## Deviations from Plan

None - plan executed exactly as written. The two tasks' `<action>` and `<verify>` blocks were followed as specified; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

- The full `npm test` run surfaced 16 pre-existing failures unrelated to this plan (CRLF/EOL fixture mismatches from the missing `.gitattributes` pin, plus one report-parsing issue in `test/parity/divergence-records.test.js`). Confirmed none touch this plan's files (`git diff --stat -- engine/items.js engine/economy.js src/browser/storeScreen.js test/parity/` is empty) and logged to `deferred-items.md` per the SCOPE BOUNDARY rule rather than fixed.
- `npm run boot:check` fails with a 162-byte DOM dump — the same pre-existing environment block already tracked in STATE.md's "Blockers/Concerns" section (not a regression from this plan's one-line `mazeworld.html` change).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (rail explanation) and Plan 04 (store row explanation) can both import `upgradeWhyText`/`gearCompareParts` directly — the parts-then-format split was built specifically so `narrationLines.js`/`eventNarration.js` (Plan 03) and `storeScreen.js` (Plan 04) can format the same parts without re-deriving the arithmetic or breaking their own purity guards.
- No blockers for Plans 03/04. The pre-existing CRLF/EOL and boot:check environment issues are tracked (STATE.md + this plan's `deferred-items.md`) but do not block further Phase 61 work.

---
*Phase: 61-gear-rules-store-purchase-fix*
*Completed: 2026-09-23*
