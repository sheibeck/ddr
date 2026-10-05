---
phase: 97-large-screen-support
plan: 07
subsystem: docs
tags: [docs, large-screen, patch-notes, android-display]
requires: [97-05]
provides:
  - "docs/ANDROID-DISPLAY.md section 'Large screens (DROID-03, SCREEN-01..06)'"
  - "2.4.0 Interface bullet 'Screens' (DRAFT)"
affects: []
key-files:
  modified:
    - docs/ANDROID-DISPLAY.md
    - .claude/CLAUDE.md
    - docs/patch-notes/2.4.0.md
    - docs/RELEASING.md
requirements-completed: [SCREEN-01, SCREEN-06]
status: complete
completed: 2026-10-04
---

# Phase 97 Plan 07: Large-screen docs Summary

The display doc, the stack row in CLAUDE.md, the 2.4.0 draft notes and the release doc now describe the size-class layouts and the phone-only Portrait/Rotate choice; nothing tells a future session to lock orientation.

## What was written

- **docs/ANDROID-DISPLAY.md:** the Phase 80 "Large screens (DROID-03)" section is replaced by "Large screens (DROID-03, SCREEN-01..06)". It records the no-restriction manifest and why Play's notice clears; `appCategory="game"` kept; the ten `configChanges` entries; the phone-only Screen setting (`decideOrientationLock`/`syncOrientationLock`, smallest width under 600); the size-class table (short, compact, medium, expanded, in evaluation order) with the 479.98/599.98/839.98 reasoning; the map cell scale and its 1.5x / 144 px caps; the retired letterbox; `dvh` with `vh` fallbacks and the four safe-area insets per layout; `npm run layout:check`; the build-gate AVD pass; Play's warning 3 verdict; and a short History paragraph. The intro's ownership list now points warning 3 at Phase 97 and marks the 80-05 emulator line as absorbed. The audit's manifest paragraph gains the one sentence that Phase 97 removed the orientation attribute (the historical `screenOrientation=1` build record is left as a dated record).
- **.claude/CLAUDE.md:** the `@capacitor/screen-orientation` "When to Use" cell now says phones only, Portrait or Rotate from Settings, layouts by window size class, no manifest lock.
- **docs/patch-notes/2.4.0.md:** one new last bullet under Interface (text in the report); the DRAFT line is untouched.
- **docs/RELEASING.md:** `npm run layout:check` added after `npm test` in Every update; the DROID-03 pointer now reads "large-screen layouts by window size class (DROID-03, Phase 97 SCREEN-01..06)". The 2.2.0 and 2.3.0 checklists are untouched.

## Commits

- 84362a26 docs(97-07): rewrite the large-screens section for the size-class layouts
- bd563b05 docs(97-07): stack row, 2.4.0 Screens bullet (draft), layout:check in Every update

## Tests run (targeted only)

- `node --test test/unit/cloak-one-rule.test.js test/unit/gauntlet-one-rule.test.js test/unit/patch-notes.test.js test/unit/patch-notes-pipeline.test.js test/unit/stale-terms.test.js`: 87 pass, 0 fail.
- `node tools/patch-notes.mjs --check` exits 0 (reports 2.3.0 OK; it checks the agreed notes, the 2.4.0 draft is validated by the cloak/gauntlet tests).
- The Task 1 `node -e` check prints ok; the Task 2 greps print 1, 1, 0, 1, 1 as required.

## Deviations from Plan

- **Docs written ahead of 97-06.** `tools/layout-check.mjs` had not landed when this plan ran, so the "How to check it" paragraph (twelve profiles, scenes, failure conditions, exit codes 0/1/2, gitignored `tools/layout-check-output/`) is taken from 97-06-PLAN.md. If 97-06 changes a profile, a scene or a flag, this paragraph needs a matching edit.
- **Four insets paragraph:** the per-layout inset placement is written from the 97-03/97-04 summaries, not re-read from `mazeworld.html` (which this plan must not touch).

Otherwise the plan was executed as written. No engine, parity, determinism or mazeworld.html changes; STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.

## Known Stubs

None.

## Deferred human verification

- The user agrees the 2.4.0 wording, including the Screens bullet, before the release build (standing patch-notes rule).

## Self-Check: PASSED

Commits 84362a26 and bd563b05 are in `git log`; the four edited docs keep CRLF line endings throughout.
