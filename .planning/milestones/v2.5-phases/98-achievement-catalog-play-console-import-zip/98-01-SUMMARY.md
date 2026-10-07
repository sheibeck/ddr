---
phase: 98-achievement-catalog-play-console-import-zip
plan: 01
subsystem: content
tags: [achievements, catalog, play-games, voice-tooling, icons]
requires: []
provides:
  - "content/achievements.js: ACHIEVEMENTS (77 entries) and TRIGGER_VOCABULARY, the single catalog later phases read"
  - "achievements/manifest.json trimmed to 77 rows"
  - "voice-tooling registration for the 231 name / description / line slots"
affects: [98-02, 98-03, 99, 100, 101]
tech-stack:
  added: []
  patterns: ["pure-data content module with a closed declarative trigger vocabulary", "locked rulings pinned as literals in the test, independent of the module"]
key-files:
  created:
    - content/achievements.js
    - test/unit/achievements-catalog.test.js
  modified:
    - achievements/manifest.json
    - achievements/build_achievements.py
    - achievements/README.md
    - achievements/contact_sheet.png
    - tools/lib/voice-corpus.mjs
    - test/voice/safety-scan.test.js
  deleted:
    - "achievements/{play,ingame,master}/ach_disposable_help_t1..t4.png (12 files)"
key-decisions:
  - "listOrder is 10 x position (10..770) so a later import can interleave"
  - "Entries are written as plain greppable literals, one field per line, in the 14-field order plan 98-02 anchors on"
  - "ACHIEVEMENTS registered on the panels surface with pick [name, description, line]"
requirements-completed: [ACH-01, ACH-03, ACH-04, ACH-05]
duration: 25min
completed: 2026-10-05
status: complete
---

# Phase 98 Plan 01: Achievement Catalog Structure Summary

**A 77-entry pure-data achievement catalog (14 fields, closed six-kind trigger vocabulary) with every locked ruling pinned by test, the icon set trimmed to 77, and the 231 copy slots registered with the voice tools.**

BASE: `35bb255288947826a38aa7150ed90843f587d043`

## Accomplishments

- **Icon trim.** `manifest.json` went from 81 to 77 rows (diff is exactly the four removed objects); the twelve `ach_disposable_help_t*.png` exports left `play/`, `ingame/` and `master/`; `sources/ach_disposable_help.png` stays. `build_achievements.py` no longer names the dropped id (its `EXPECTED` imports as 77) and README states 77. The contact sheet WAS regenerated (1268 x 2390, 7 x 11 tiles) by calling only `contact_sheet()`; `main()` was never run.
- **Catalog.** `content/achievements.js` exports frozen `ACHIEVEMENTS` (77 entries, 57 incremental / 20 standard, 8 Hidden / 69 Revealed, 1110 points) and frozen `TRIGGER_VOCABULARY`. No imports, no functions; header documents the fields, the at-least threshold rule and what each vocabulary word measures. Copy fields are empty strings for plan 98-02. Not added to `content/index.js`.
- **Catalog test.** `test/unit/achievements-catalog.test.js` (26 tests) spells the id order, points, thresholds, types, Hidden set and the 8 reveal pairs as its own literals, and cross-checks triggers against BESTIARY, RACES, CLASSES, CAUSE_TEXT and BAGS, icons against the manifest and PNG IHDR sizes (512 / 144).
- **Voice registration.** One `BANK_REGISTRY` row and a `collectAuthoredStrings` block plus label test (231 labels, no duplicates).

## Task Commits

| Task | Commit | Summary |
|------|--------|---------|
| 1 | e3a709b6 | chore: trim Disposable Help exports from the icon set |
| 2 | f0e4d875 | feat: add the 77-entry achievement catalog and its pinning test |
| 3 | c9f17da3 | test: register the achievement catalog with the voice tooling |

## Verification (targeted only; no full suite, no bot)

- `achievements-catalog.test.js`: 26 / 26 pass.
- `content-is-pure-data` + `stale-terms` + the catalog test: 33 / 33 pass.
- `safety-scan` + `voice-corpus` + `content-is-pure-data` + `stale-terms` together: 46 / 46 pass (planning measured 45; +1 is the new Phase 98 label test).
- All five files together: 72 / 72 pass.
- `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints `0`; `--key "bank:ACHIEVEMENTS.*" --count` prints `231`.
- Mutation check run and reverted: flipping `naked_ambition` to Revealed fails 2 tests; changing a 25-point tier to 20 fails 2 tests.
- `git diff --name-only 35bb2552 HEAD` lists nothing under `engine/`, `src/browser/` or `mazeworld.html`.

## Interpretation Note

The catalog_spec was copied as written. The only judgment calls: entry literals are laid out one field per line (the spec fixed the field order, not the layout); trigger objects are single-line literals with every key present; the CONTEXT hidden-reveal table (Still Standing I reveals Fatal Misstep, Survivor I reveals Empty Calories, and so on) agrees with the plan's reveal pairs, and the plan's ids (`trap_survivor`, `parlay`, `death_*`, `ether_entombed`) were used verbatim. The BANK_REGISTRY row sits just above ARMOR_FLAVOR, the last content/ row, rather than in alphabetical order, because that block is grouped by phase rather than sorted.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

A stray `achievements/__pycache__/` appeared from importing the build script; removed before the commit.

## Known Stubs

`name`, `description` and `line` are empty strings on all 77 entries. Intentional: plan 98-02 writes all 231.

## Next Phase Readiness

Plan 98-02 can anchor on the 14-field order and replace the empty copy strings; plan 98-03 reads `ACHIEVEMENTS` and the manifest for the zip tool.

## Self-Check: PASSED

- content/achievements.js, test/unit/achievements-catalog.test.js: present.
- Commits e3a709b6, f0e4d875, c9f17da3: present in `git log`.
