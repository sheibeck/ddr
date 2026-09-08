---
phase: 04-mobile-presentation-controls-onboarding
plan: 11
subsystem: persistence
tags: [storage, naming, node-test, vanilla-js]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-02's settings.js (introduced the fourth mazeworld.settings.v1 key, folded into this rename)"
provides:
  - "All four persistence keys renamed mazeworld.*.v1 -> ddr.*.v1 (ddr.delve.v1, ddr.best.v1, ddr.graveyard.v1, ddr.settings.v1) across storage.js, engineAdapter.js, settings.js, mazeworld.html's classic-script literals, and the six asserting test files"
  - "storage.js LEGACY_KEYS / migrateLegacyKeys() now operate on the new ddr.*.v1 key set (no cross-name shim, greenfield/pre-launch)"
affects: [04-05, 04-06, 04-07, 04-08, 04-09, 04-10 (every later Wave-2+ UI/storage plan reads/writes the renamed ddr.*.v1 keys from the start)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persistence key literals are duplicated-by-design across storage.js/engineAdapter.js/mazeworld.html's classic script (documented coupling, no shared const across the classic non-module script boundary) — renames must touch every copy identically, verified by the dual-write-convergence test"

key-files:
  created: []
  modified:
    - src/browser/storage.js
    - src/browser/engineAdapter.js
    - src/browser/settings.js
    - mazeworld.html
    - test/persistence/dual-write-convergence.test.js
    - test/persistence/flush-drain.test.js
    - test/persistence/storage-migration.test.js
    - test/persistence/storage.test.js
    - test/persistence/harness/sandboxClassicPersistence.js
    - test/unit/engineAdapter.test.js

key-decisions:
  - "Extra scope (orchestrator-added, consistent with plan intent): also renamed mazeworld.settings.v1 -> ddr.settings.v1 in src/browser/settings.js (the key 04-02 introduced), for consistency with the other three keys. No test asserted the literal string (test/unit/settings.test.js imports the SETTINGS_STORAGE_KEY constant rather than hardcoding it), so no test file needed changes for this fourth key."
  - "test/parity/prototype-master.js.txt (the FROZEN golden master) was deliberately left untouched per the plan's explicit acceptance-criteria exclusion — its SAVE_KEY/GRAVE_KEY are the prototype's own constants and the parity harness stubs storage, so parity asserts on RNG-driven game state, not key strings."
  - "Task 2 (strip residual PRODUCT-name 'Mazeworld') found no code changes required: the product-name display strings (title/meta/h1) were already renamed to 'Delve, Die, Repeat' by the prior /gsd-quick rename (f81942f). The only remaining 'Mazeworld' hit in mazeworld.html (the credit line 'Built from the Mazeworld rulebook... darktierstudios.com/pdfs/mazeworld.pdf') was judged out of scope: it credits the real historical 1994 tabletop rulebook by its actual title/filename and links to an actual hosted URL — analogous to the content/*.js and engine/*.js header comments referencing the mazeworld.html filename (explicitly excluded by the plan), not a product-branding string. Renaming it would both misrepresent the source-credit history and break a real external link. All src/ and engine/ 'mazeworld' hits are exclusively source-filename references in comments (mazeworld.html lines/functions), also excluded."
  - "src/browser/tutorial.js's mazeworld.tutorialSeen persistence key was left unchanged, consistent with the pre-existing 04-03 decision recorded in STATE.md ('not folded into the ddr.* rename scope — that's limited to the 3 pre-existing delve/graveyard/best keys') and this plan's own extra-scope note (limited to the 3 keys + the 04-02 settings key, not tutorialSeen)."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "The three original persistence keys (delve/best/graveyard) are renamed mazeworld.*.v1 -> ddr.*.v1 consistently across storage.js, engineAdapter.js, mazeworld.html's two classic-script literals, and the six asserting test files"
    verification:
      - kind: unit
        ref: "test/persistence/dual-write-convergence.test.js (classic script + adapter keys match under ddr.delve.v1/ddr.graveyard.v1)"
        status: pass
      - kind: unit
        ref: "test/persistence/storage-migration.test.js (migrateLegacyKeys operates on ddr.*.v1 keys)"
        status: pass
      - kind: unit
        ref: "test/persistence/storage.test.js, test/persistence/flush-drain.test.js, test/unit/engineAdapter.test.js"
        status: pass
      - kind: other
        ref: "grep -rE \"mazeworld\\.(delve|best|graveyard)\\.v1\" src/ mazeworld.html test/ -> zero matches outside test/parity/prototype-master.js.txt"
        status: pass
    human_judgment: false
  - id: D2
    description: "The extra-scope settings key (introduced by 04-02) is also renamed mazeworld.settings.v1 -> ddr.settings.v1"
    verification:
      - kind: other
        ref: "grep -rE \"mazeworld\\.settings\\.v1\" src/ mazeworld.html test/ -> zero matches"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js (imports SETTINGS_STORAGE_KEY constant, unaffected by the literal rename)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full suite stays green after the rename: npm test = 451, npm run test:quick = 362"
    verification:
      - kind: unit
        ref: "npm test"
        status: pass
      - kind: unit
        ref: "npm run test:quick"
        status: pass
    human_judgment: false
  - id: D4
    description: "No residual user-facing PRODUCT-name 'Mazeworld' string remains in the modular src/ UI/display layer; in-fiction world usages and source-filename comments are preserved"
    verification:
      - kind: other
        ref: "grep -rn -i mazeworld src/ engine/ content/ mazeworld.html — all hits are source-filename references in comments (mazeworld.html lines/functions) or the historical rulebook credit line; title/meta/h1 already say Delve, Die, Repeat"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 11: Persistence-Key Rename + Product-Name Cleanup Summary

**Renamed all four persistence keys `mazeworld.*.v1` -> `ddr.*.v1` (delve/best/graveyard/settings) across every in-sync copy — storage.js, engineAdapter.js, settings.js, mazeworld.html's classic-script literals, and six asserting test files — with no migration shim; product-name cleanup found nothing left to change.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-08T20:21:03Z
- **Completed:** 2026-09-08T20:27:00Z
- **Tasks:** 2 (Task 1: rename; Task 2: no-op cleanup, documented)
- **Files modified:** 10

## Accomplishments
- Renamed the three original persistence keys (`mazeworld.delve.v1` -> `ddr.delve.v1`, `mazeworld.best.v1` -> `ddr.best.v1`, `mazeworld.graveyard.v1` -> `ddr.graveyard.v1`) in `src/browser/storage.js` (RUN_SAVE_KEY/BEST_KEY/GRAVE_KEY constants + LEGACY_KEYS + all comments), `src/browser/engineAdapter.js` (SAVE_KEY/BEST_KEY/GRAVE_KEY + mirror comments), and both `mazeworld.html` classic-script literals (SAVE_KEY line 537, GRAVE_KEY line 3007).
- Extra scope: also renamed `mazeworld.settings.v1` -> `ddr.settings.v1` in `src/browser/settings.js` (the key 04-02 introduced), for consistency.
- Updated the six asserting test files (`test/persistence/{dual-write-convergence,flush-drain,storage-migration,storage}.test.js`, `test/persistence/harness/sandboxClassicPersistence.js`, `test/unit/engineAdapter.test.js`) to the new key literals, including comment/message strings.
- `storage.js`'s `migrateLegacyKeys()` now operates on the new `ddr.*.v1` key set as its in-scope migration target — no cross-name (`mazeworld.*` -> `ddr.*`) shim added, per the user-confirmed greenfield/pre-launch decision.
- Left `test/parity/prototype-master.js.txt` (the frozen golden master) completely untouched — its own `SAVE_KEY`/`GRAVE_KEY` literals remain `mazeworld.*.v1`, documented as an explicit, intentional exclusion.
- Task 2 (strip residual product-name "Mazeworld"): audited `src/`, `engine/`, `content/`, and `mazeworld.html` for user-facing "Mazeworld" strings. Found none requiring change — the product display strings (`<title>`, `og:title`, meta description, `<h1>`) were already renamed to "Delve, Die, Repeat" by the prior `/gsd-quick` rename (`f81942f`). The one remaining "Mazeworld" occurrence in `mazeworld.html` (the footer credit line crediting the real 1994 tabletop rulebook and linking to its actual hosted PDF) was judged out of scope — it's a historical source-material credit + real external filename reference, not product branding, matching the plan's explicit carve-out for filename references.
- Full test suite stays green: `npm test` = 451 passing (0 failures), `npm run test:quick` = 362 passing (0 failures).

## Task Commits

1. **Task 1: Rename the three (+1 extra-scope) persistence keys mazeworld.*.v1 -> ddr.*.v1 across sources + tests** - `8f7bf83` (feat)
2. **Task 2: Strip residual PRODUCT-name "Mazeworld" from user-facing modular sources** - no commit (no changes required; audited and documented as a deviation below)

**Plan metadata:** (this commit, following this summary)

## Files Created/Modified
- `src/browser/storage.js` - RUN_SAVE_KEY/BEST_KEY/GRAVE_KEY constants + LEGACY_KEYS renamed to ddr.*.v1
- `src/browser/engineAdapter.js` - SAVE_KEY/BEST_KEY/GRAVE_KEY constants + mirror comments renamed to ddr.*.v1
- `src/browser/settings.js` - SETTINGS_STORAGE_KEY renamed to ddr.settings.v1 (extra scope)
- `mazeworld.html` - classic-script SAVE_KEY (line 537) and GRAVE_KEY (line 3007) literals renamed to ddr.*.v1
- `test/persistence/dual-write-convergence.test.js` - key literals + comments/assertion messages updated to ddr.*.v1
- `test/persistence/flush-drain.test.js` - SAVE_KEY/GRAVE_KEY literals updated to ddr.*.v1
- `test/persistence/storage-migration.test.js` - SAVE_KEY/BEST_KEY/GRAVE_KEY literals + header comment updated to ddr.*.v1
- `test/persistence/storage.test.js` - SAVE_KEY/BEST_KEY/GRAVE_KEY literals updated to ddr.*.v1
- `test/persistence/harness/sandboxClassicPersistence.js` - sandboxed classic-script SAVE_KEY literal updated to ddr.delve.v1
- `test/unit/engineAdapter.test.js` - SAVE_KEY/GRAVE_KEY literals updated to ddr.*.v1

## Decisions Made
- Extra scope: renamed the 04-02-introduced settings key (`mazeworld.settings.v1` -> `ddr.settings.v1`) alongside the plan's three named keys, per the orchestrator's added instruction, for naming consistency. No test asserted the literal string for this key (only the exported `SETTINGS_STORAGE_KEY` constant), so this required a single one-line source change and no test edits.
- Kept `test/parity/prototype-master.js.txt` untouched exactly as the plan mandates — verified via grep that it's the only file still containing the old key literals.
- Judged the `mazeworld.html` credit-line "Built from the Mazeworld rulebook... mazeworld.pdf" as out of scope for the product-name strip: it names the real 1994 tabletop rulebook (per PROJECT.md, `mazeworld.pdf` is that rulebook's actual filename/title) and links to a real hosted URL. Changing it would misrepresent the historical source credit and break a live external link — treated the same as the plan's explicit carve-out for filename-reference comments.
- Left `src/browser/tutorial.js`'s `mazeworld.tutorialSeen` key unchanged — a pre-existing, documented 04-03 decision (STATE.md) that this key is deliberately not part of the ddr.* rename scope, and this plan's own scope note only extends to the delve/best/graveyard/settings keys.

## Deviations from Plan

### Auto-fixed Issues

None — Task 1 executed exactly as specified (including the extra settings-key scope explicitly requested by the orchestrator, which is documented above as an intentional scope addition, not an unplanned auto-fix).

**1. [Rule 4 - judgment call, not an architectural change] Task 2 found zero code changes required**
- **Found during:** Task 2 (strip residual PRODUCT-name "Mazeworld")
- **Issue:** The plan's Task 2 assumed some residual user-facing "Mazeworld" product-name strings remained in `src/browser/*` or modular-owned `mazeworld.html` UI strings. A full grep of `src/`, `engine/`, `content/`, and `mazeworld.html` found none — all hits were either (a) source-filename references in comments (explicitly excluded by the plan) or (b) the footer's rulebook-credit line, which names the real historical 1994 tabletop rulebook and links to its actual hosted PDF.
- **Resolution:** No files modified for Task 2. Verified via `node --test test/unit/engineAdapter.test.js` (16/16 pass) and `npm run test:quick` (362/362 pass) that nothing regressed. Documented the audit and the credit-line judgment call here rather than silently editing a historically-accurate external-link/credit string.
- **Files modified:** none
- **Verification:** grep audit (see Accomplishments); `node --test test/unit/engineAdapter.test.js` and `npm run test:quick` both green.
- **Committed in:** n/a (no code change; this SUMMARY documents the audit)

---

**Total deviations:** 1 documented (Task 2 no-op, judgment call on the rulebook-credit line — not a Rule 1-3 auto-fix, not an architectural change; a scope-boundary read consistent with the plan's own explicit filename-reference carve-out)
**Impact on plan:** No scope creep, no regression. All acceptance criteria for both tasks hold.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every later Phase-4 wave (04-05 through 04-10) reads/writes the renamed `ddr.*.v1` keys from the start — no key-drift between this rename and the UI rebuild.
- `npm test` green at 451 (up from 451 baseline — count unchanged since this plan only renamed literals, added no new tests), `npm run test:quick` green at 362.
- No blockers for the remaining Wave 2+ plans.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*

## Self-Check: PASSED

All modified files verified present on disk with the new `ddr.*.v1` literals (grep confirms zero remaining `mazeworld.(delve|best|graveyard|settings).v1` matches outside the frozen `test/parity/prototype-master.js.txt`). Commit `8f7bf83` verified present in `git log --oneline --all`.
