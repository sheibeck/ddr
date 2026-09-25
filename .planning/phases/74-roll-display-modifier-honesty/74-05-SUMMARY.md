---
phase: 74-roll-display-modifier-honesty
plan: 05
subsystem: ui
tags: [formatter, upgrade-compare, roll-high, signed-modifier, store, loot]

# Dependency graph
requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "src/browser/rollRange.js's toHitText/facesRangeText (74-02); engine/derived.js's strikeDie (pre-existing)"
provides:
  - "upgradeWhyText(parts, { dieN, haveName }) — every gear comparison states which way the to-hit change goes and writes the crit-range term on the hero's own strike die"
  - "viewModels.js#lootCompare passes strikeDie(c) and the wielded weapon's name into upgradeWhyText for the find card, loot screen, gear sheet and store rows"
  - "thief-store.store.txt re-pinned (Flail/Spear rows); every compare-text test re-pinned to the exact new strings"
affects: [74-06, 74-07, 74-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "upgradeWhy.js's purity contract narrowed from 'zero imports' to 'exactly one import, from ./rollRange.js' — the same pure formatter every 74-0x plan shares"
    - "A caller-supplied opts object ({ dieN, haveName }) lets one formatter serve both a die-aware, named-weapon comparison (lootCompare) and a die-free, unnamed one (purchaseBagged's Oracle/rail lines) without branching inside the formatter itself"

key-files:
  created: []
  modified:
    - src/browser/upgradeWhy.js
    - src/browser/viewModels.js
    - test/unit/upgrade-why.test.js
    - test/unit/lootCompare.test.js
    - test/unit/gear-sheet-dom.test.js
    - test/unit/gear-sheet-model.test.js
    - test/unit/store-rows.test.js
    - test/unit/store-delivery.test.js
    - test/unit/fixtures/shell-snapshots/thief-store.store.txt

key-decisions:
  - "upgradeWhyText(parts, opts) takes opts as a second, optional argument rather than folding dieN/haveName into `parts` — keeps gearCompareParts' engine-derived shape untouched and lets purchaseBagged's die-free callers (eventNarration.js/narrationLines.js) keep calling with zero opts, unmodified"
  - "The crit term's dieN gate is separate from the have.crit !== null / got.crit !== have.crit gate — a caller with no die in reach (purchaseBagged) never sees a crit term even when the underlying counts differ, closing the 'crits on 1-2' pre-mirror form entirely rather than leaving a conditional path to it"
  - "lootCompare's haveName falls back to UPGRADE_WHY_COPY.bareHands (\"bare hands\") when WEAPONS[c.weapon] is undefined, so the to-hit term always names something concrete (\"worse than your bare hands\") instead of the bare \"worse than yours\" — matching the plan's bare-handed behavior pin"

requirements-completed: [ROLL-02, ROLL-03]

coverage:
  - id: D1
    description: "upgradeWhyText(parts, { dieN, haveName }) states which way a to-hit change goes ('-2 to hit, worse than your Club', '+1 to hit, better than your Quarter Staff') and writes the crit-range term on the hero's own strike die ('crits on 19-20 vs your 20'); with no dieN, no crit term appears at all"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "test/unit/upgrade-why.test.js (20 tests, including the dieN=20/dieN=12/no-dieN/noCrit/bare-handed/no-pre-mirror-range pins)"
        status: pass
    human_judgment: false
  - id: D2
    description: "lootCompare passes strikeDie(c) and the wielded weapon's name (or 'bare hands') into upgradeWhyText for the find card, loot screen, gear sheet and store rows; the device-trigger case (a need -2 weapon vs a Club) reads '-2 to hit, worse than your Club'"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "test/unit/lootCompare.test.js (19 tests, including the new device-trigger test); test/unit/gear-sheet-dom.test.js, test/unit/gear-sheet-model.test.js, test/unit/store-rows.test.js, test/unit/store-delivery.test.js (all re-pinned and passing)"
        status: pass
    human_judgment: false
  - id: D3
    description: "thief-store.store.txt is the only shell fixture that changed (Flail/Spear rows gain the named-weapon verdict and roll-high crit range); mu-store.store.txt and every other shell fixture stay byte-identical"
    verification:
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js (regenerated with MZ_SNAPSHOT_UPDATE=1, then reran clean; git diff --stat -- test/unit/fixtures/shell-snapshots shows only thief-store.store.txt)"
        status: pass
    human_judgment: false
  - id: D4
    description: "On the Pixel 7, the store/find screen for a heavy weapon reads '-N to hit, worse than your <weapon>', and a precise blade reads 'crits on 19-20 vs your 20' at level 1"
    verification: []
    human_judgment: true
    rationale: "Deferred UAT protocol — device verification batched at milestone close, per user's standing ruling; not verifiable from this worktree"

duration: 35min
completed: 2026-09-25
status: complete
---

# Phase 74 Plan 05: Item/Loot/Store/Find Comparisons — Which Way & Roll-High Crits Summary

**Every gear comparison (find card, loot screen, gear sheet, store row) now states which way a to-hit change goes and writes crit ranges on the hero's own strike die, closing the ROLL-LEDGER device-trigger case: a dropped heavy weapon reads "−2 to hit, worse than your Club" instead of a bare, directionless "−2 to hit".**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-25
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- `upgradeWhyText(parts, { dieN, haveName })` (`src/browser/upgradeWhy.js`) now appends a verdict clause to the to-hit term: `"{toHit}, {better|worse} than {yours|your {name}}"`. A positive need delta reads "better", a negative one "worse" — the bigger-is-better convention from 74-CONTEXT holds all the way through.
- The crit term now reads roll-high, on the caller-supplied `dieN`, via `rollRange.js#facesRangeText` — "crits on 19–20 vs your 20" — replacing the pre-mirror roll-under reading ("crits on 1–2 vs your 1") that Phase 73's top-face crit move made wrong. The term is omitted entirely when no `dieN` is supplied (the purchase-bagged Oracle/rail lines, which carry only the compare parts with no hero die in reach).
- `upgradeWhy.js`'s purity contract is now "exactly one import, from `./rollRange.js`" — the module's private `critRange`/`signedNeed` helpers are gone, replaced by `rollRange.js`'s `toHitText`/`facesRangeText`.
- `viewModels.js#lootCompare`'s weapon branch now calls `upgradeWhyText(gearCompareParts(c, it), { dieN: strikeDie(c), haveName })`, where `haveName` is `c.weapon` when `WEAPONS` has it, else `UPGRADE_WHY_COPY.bareHands` ("bare hands") — so every surface that reads through `lootCompare` (find card, loot screen, gear sheet, store rows) gets the named-weapon, die-aware comparison. The armor branch is unchanged (a one-argument call; AR stays a stat).
- Closes the ROLL-LEDGER device-trigger case: a Human Fighter/Soldier holding a Club compared with a need −2 weapon (Bardiche) now reads "−2 to hit, worse than your Club"; the light-weapon mirror (Dagger) reads "+1 to hit, better than your Club".
- `thief-store.store.txt` is the only shell fixture that changed: its Flail and Spear rows (both compared against the sample Thief's Dagger) gain the named-weapon verdict and the roll-high crit range.

## Task Commits

1. **Task 1: upgradeWhyText says which way, and writes crits roll-high** - `a80aafb` (feat)
2. **Task 2: lootCompare passes the die and the weapon; every compare pin and the store snapshot** - `5d221aa` (feat)

_No plan-metadata commit and no STATE.md/ROADMAP.md/REQUIREMENTS.md updates — this is a parallel worktree plan; the orchestrator handles those after all wave agents complete._

## Files Created/Modified
- `src/browser/upgradeWhy.js` — `upgradeWhyText(parts, opts)` now takes `{ dieN, haveName }`; the to-hit term states which way it goes; the crit term reads roll-high on `dieN`; the module's one import is `./rollRange.js`
- `src/browser/viewModels.js` — imports `strikeDie` from `engine/derived.js`; `lootCompare`'s weapon branch passes `{ dieN: strikeDie(c), haveName }`
- `test/unit/upgrade-why.test.js` — re-pinned every compare-text assertion to the new verdict/crit-range form; retitled the crit test to the roll-high reading; added dieN/no-dieN/noCrit/bare-handed/no-pre-mirror-range coverage; the purity test now checks for exactly one import from `./rollRange.js`
- `test/unit/lootCompare.test.js` — re-pinned the Broadsword/Dagger `why`/`line` assertions; added the device-trigger test (Bardiche vs Club, Dagger vs Club)
- `test/unit/gear-sheet-dom.test.js`, `test/unit/gear-sheet-model.test.js`, `test/unit/store-rows.test.js` — re-pinned the Spiked-Staff-vs-Quarter-Staff `why`/`compareLine` string to include "worse than your Quarter Staff"
- `test/unit/store-delivery.test.js` — re-pinned the three purchaseBagged (no-opts) assertions to "worse than yours"
- `test/unit/fixtures/shell-snapshots/thief-store.store.txt` — regenerated; only the Flail and Spear rows changed

## Before/After

**Device-trigger line (ROLL-LEDGER, verified via the new lootCompare test):**
- Before (74-04 and earlier): `−2 to hit`
- After: `−2 to hit, worse than your Club`

**thief-store.store.txt, Flail row:**
- Before: `d10+2 vs your d6/2 · −2 to hit · crits on 1 vs your 1–2 · 1.7 vs 1.0 a swing · upgrade`
- After: `d10+2 vs your d6/2 · −2 to hit, worse than your Dagger · crits on 20 vs your 19–20 · 1.7 vs 1.0 a swing · upgrade`

**thief-store.store.txt, Spear row:**
- Before: `d8 vs your d6/2 · −1 to hit · crits on 1 vs your 1–2 · 1.4 vs 1.0 a swing · upgrade`
- After: `d8 vs your d6/2 · −1 to hit, worse than your Dagger · crits on 20 vs your 19–20 · 1.4 vs 1.0 a swing · upgrade`

(`mu-store.store.txt`'s two compare lines carry no to-hit/crit terms in this fixture's scenario and stayed byte-identical, confirmed via `git diff --stat`.)

## Decisions Made
- `opts` is a second, optional argument to `upgradeWhyText` rather than a field folded into `parts` — this keeps `gearCompareParts`' engine-derived shape untouched and lets the purchase-bagged Oracle/rail callers in `eventNarration.js`/`narrationLines.js` keep calling with zero opts, unmodified (not in this plan's `files_modified`).
- The crit term's `dieN` gate is independent of the `have.crit !== null` / `got.crit !== have.crit` gate — a caller with no die in reach never sees a crit term, even when the underlying counts differ, so the pre-mirror "1–2" form is closed off structurally rather than left reachable through some path.
- `lootCompare`'s `haveName` always resolves to a concrete string ("bare hands" when `WEAPONS[c.weapon]` is undefined) rather than leaving it `undefined`, so every to-hit term through `lootCompare` names something ("worse than your bare hands") instead of falling back to the bare "worse than yours".

## Deviations from Plan

None - plan executed exactly as written. `git status --short test/unit/fixtures/shell-snapshots` showed all eight fixtures flagged as modified after the snapshot regeneration, but `git diff --stat` confirmed only `thief-store.store.txt` has a real content change (2 lines) — the other seven are CRLF line-ending normalization noise from Windows Git config (a known, pre-existing worktree artifact per the orchestrator's notes), not content diffs, and were left unstaged/uncommitted.

## Issues Encountered

None. `npm test` is 5917/5917 passing in this worktree.

## Human verification (deferred to end of run)

Per the deferred-UAT protocol: on the Pixel 7, open the store or find a heavy weapon and confirm the line reads "−N to hit, worse than your <weapon>"; a precise blade (Dagger/Rapier/Katana/Ninja-to/Wakazashi — the `crit: 2` weapons) reads "crits on 19–20 vs your 20" at level 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `upgradeWhyText`'s `{ dieN, haveName }` contract is now the shared shape for any future comparison surface that needs a die-aware, named-weapon explanation.
- 74-06 (foe-details odds line) and 74-07 (condition-chip effects) can proceed independently — this plan touched no foe-facing or condition-chip files.
- 74-08's consistency guard test and copy-bank scans have a stable, fully-tested `upgradeWhy.js` surface to guard against divergence; the ROLL-LEDGER device-trigger case is now closed and can be marked resolved in that plan's ledger update.

---
*Phase: 74-roll-display-modifier-honesty*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: src/browser/upgradeWhy.js
- FOUND: src/browser/viewModels.js
- FOUND: test/unit/upgrade-why.test.js
- FOUND: test/unit/lootCompare.test.js
- FOUND: test/unit/gear-sheet-dom.test.js
- FOUND: test/unit/gear-sheet-model.test.js
- FOUND: test/unit/store-rows.test.js
- FOUND: test/unit/store-delivery.test.js
- FOUND: test/unit/fixtures/shell-snapshots/thief-store.store.txt
- FOUND: .planning/phases/74-roll-display-modifier-honesty/74-05-SUMMARY.md
- FOUND commits: a80aafb, 5d221aa (all present in `git log`)
