---
phase: 56-sound-effects-audio-settings
plan: 01
subsystem: build
tags: [capacitor, build-pipeline, node-test, offline-assets]

# Dependency graph
requires: []
provides:
  - "copySfx() in tools/build-www.mjs — whole-directory copy of sfx/ into www/sfx/, wired into main()'s copy sequence, throws loud when sfx/ is missing"
  - "test/unit/sfx-assets.test.js — pins the 30-clip manifest by set equality and source-scans copySfx()'s wiring/fail-loud contract"
affects: [56-02-sound-effects-audio-settings, 56-03-sound-effects-audio-settings, 56-04-sound-effects-audio-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "copySfx() mirrors the existing copyIcons()/copyFonts()/copySplash() shape exactly: existsSync guard -> throw new Error(named path) -> cpSync(recursive) -> step() log line"

key-files:
  created:
    - test/unit/sfx-assets.test.js
  modified:
    - tools/build-www.mjs

key-decisions:
  - "copySfx() call placed directly after copySplash() and before vendorCapacitorPackages() in main(), per the plan's exact ordering requirement."
  - "Reworded a test file comment to avoid an accidental substring match against the plan's own 'no import of src/browser/sfx' acceptance-criteria grep pattern (comment prose, not an actual import statement, but the literal text collided with the grep regex)."

patterns-established:
  - "Asset-manifest pinning: a node:test file that reads a source directory off disk and asserts set equality against a frozen expected-filenames array, plus a source-scan of the build script proving the copy step is wired and fail-loud. Reusable for any future whole-directory asset copy."

requirements-completed: [AUD-06]

coverage:
  - id: D1
    description: "npm run build:www copies all 30 sfx/*.mp3 clips into www/sfx/ byte-identical, as part of the normal build sequence (positioned after copySplash(), before vendorCapacitorPackages())"
    requirement: "AUD-06"
    verification:
      - kind: unit
        ref: "test/unit/sfx-assets.test.js#AUD-06: tools/build-www.mjs defines copySfx() and calls it after copySplash()"
        status: pass
      - kind: integration
        ref: "npm run build:www && find www/sfx -name '*.mp3' | wc -l -> 30; cmp sfx/walk1.mp3 www/sfx/walk1.mp3 && cmp sfx/enemy-undead.mp3 www/sfx/enemy-undead.mp3 (both exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A build run with sfx/ absent fails loud (non-zero exit, named missing path) instead of shipping a silent bundle"
    requirement: "AUD-06"
    verification:
      - kind: unit
        ref: "test/unit/sfx-assets.test.js#AUD-06: copySfx()'s body guards on existsSync and throws when sfx/ is absent"
        status: pass
      - kind: integration
        ref: "mv sfx sfx_tmp_hidden && node tools/build-www.mjs (exit 1, stderr names C:\\projects\\mazeworld\\sfx); restored, npm run build:www exits 0 again"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 30 delivered clip filenames are pinned by a test — a silently added, renamed, or deleted clip fails npm test"
    requirement: "AUD-06"
    verification:
      - kind: unit
        ref: "test/unit/sfx-assets.test.js#AUD-06: sfx/ contains exactly the 30 expected .mp3 filenames (set equality)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-22
status: complete
---

# Phase 56 Plan 01: Sound Asset Build Pipeline Summary

**`copySfx()` wires `sfx/`'s 30 delivered clips into every `www/` build byte-identical, fails loud if the source directory is missing, and `test/unit/sfx-assets.test.js` pins the exact 30-filename manifest plus the build wiring so drift fails `npm test`.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-22T13:09:00Z
- **Completed:** 2026-09-22T13:34:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `tools/build-www.mjs` gained `copySfx()`, mirroring `copyIcons()` line-for-line: throws a named-path error when `sfx/` is absent, otherwise a plain recursive `cpSync` into `www/sfx/`, called between `copySplash()` and `vendorCapacitorPackages()`.
- `test/unit/sfx-assets.test.js` pins the 30-clip manifest (`EXPECTED_CLIPS`) against `sfx/` by set equality, checks every clip is non-empty, and source-scans `tools/build-www.mjs` to prove `copySfx()` exists, runs after `copySplash()`, and has a throwing `existsSync` guard.
- Verified end-to-end: `npm run build:www` produces exactly 30 `.mp3` files in `www/sfx/`, two spot-checked clips are byte-identical to their `sfx/` source (`cmp` exit 0), and a build with `sfx/` renamed away exits non-zero with the missing path named in stderr.
- `npm test` reports 3484/3484 passing, 0 failing; `git diff --stat -- engine/ content/` is empty; `git hash-object test/parity/prototype-master.js.txt` still equals `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add copySfx() to the build's copy sequence** - `1426711` (feat)
2. **Task 2: Pin the 30-clip manifest and the build wiring in a unit test** - `6eb8343` (test)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `tools/build-www.mjs` - added `copySfx()` (whole-directory copy of `sfx/` -> `www/sfx/`, throws if source missing) and wired its call into `main()`'s copy sequence
- `test/unit/sfx-assets.test.js` - new: pins the 30-clip manifest by set equality, non-zero file size, and source-scans `copySfx()`'s definition/call-order/fail-loud guard

## Decisions Made
- `copySfx()` call ordering fixed exactly as the plan specified: after `copySplash()`, before `vendorCapacitorPackages()` — verified by comparing call-site string indices in the test itself (`splashCallIdx < sfxCallIdx`), not just by eyeballing the source.
- Reworded one comment sentence in the new test file ("this file has no dependency on the sfx module under src/browser/" instead of a phrase containing the literal substring "import ... src/browser/sfx") because the plan's own acceptance-criteria grep (`grep -c "import .*src/browser/sfx"` expected `0`) was matching the original comment's prose as a false positive, even though no actual import statement existed. No behavior change — comment text only.

## Deviations from Plan

None - plan executed exactly as written. (One in-flight self-correction: the test-file comment wording above was fixed before either task was committed, so it never shipped as a deviation from a committed state — noted here for completeness.)

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `copySfx()` and its test are in place; 56-02 (event->clip mapping in `src/browser/sfx.js`) can now assume `www/sfx/` is populated correctly by every build without touching this plan's files.
- `sfx-assets.test.js` deliberately does not import `src/browser/sfx.js` (doesn't exist yet) — 56-02 should add its own `test/unit/sfx-map.test.js` rather than extending this file, per the plan's stated boundary.
- No human_verification items deferred from this plan — Task 1's fail-loud check and byte-identity spot checks were run directly in this environment (not device-dependent); the AUD-06 airplane-mode Pixel 7 confirmation remains a backstop item for the Phase 60 UAT batch as already scoped in the plan's `must_haves.truths`.

---
*Phase: 56-sound-effects-audio-settings*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: tools/build-www.mjs
- FOUND: test/unit/sfx-assets.test.js
- FOUND: .planning/phases/56-sound-effects-audio-settings/56-01-SUMMARY.md
- FOUND: commit 1426711
- FOUND: commit 6eb8343
- FOUND: commit c0c2078
