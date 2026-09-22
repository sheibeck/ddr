---
phase: 56-sound-effects-audio-settings
plan: 02
subsystem: audio
tags: [web-audio-prep, event-mapping, node-test, determinism]

# Dependency graph
requires:
  - phase: 56-sound-effects-audio-settings (plan 01)
    provides: "copySfx() build wiring + sfx-assets.test.js's 30-clip manifest pin, so src/browser/sfx.js's CLIP_IDS has a real www/sfx/ to point at"
provides:
  - "src/browser/sfx.js pure core: CLIP_IDS, CLIP_GROUPS, EVENT_CLIP_GROUP, FAMILY_CRY, STEP_SUPPRESSING_EVENTS, DISPATCH_CLIP_CAP, groupsForDispatch(), createVariation(), clipsForDispatch() — all frozen, import-free, pseudo-random-free"
  - "test/unit/sfx-map.test.js — 18 tests pinning every AUD-01/02/03 mapping and edge predicate, including a teeth case"
affects: [56-03-sound-effects-audio-settings, 56-04-sound-effects-audio-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Counter-driven shuffle-bag variation (Map<groupId, counter> + modulo cycling) as the zero-rng alternative to Math.random() for presentation-only repeat variation — reusable anywhere a phase needs non-repeating variety without touching engine determinism."
    - "Totality-by-test against a content table's own keys (Object.keys(BESTIARY) vs Object.keys(FAMILY_CRY), set-equal both ways) rather than a hand-maintained list, with a teeth test proving the check actually rejects a tampered map."

key-files:
  created:
    - test/unit/sfx-map.test.js
  modified:
    - src/browser/sfx.js

key-decisions:
  - "Combined Tasks 1+2 into one initial Write, then split the file back into two commits matching the plan's task boundaries (Task 1 = tables, Task 2 = resolver functions) so each task lands as its own atomic, independently-verifiable commit."
  - "Reworded the doc header's variation-guarantee sentence to avoid the literal substring \"Math.random()\" — the module's own header comment collided with this plan's own verification grep (grep -rn \"Math.random\" src/browser/sfx.js expects zero output), even though the comment-filtered acceptance-criteria grep (grep -vE \"^\\s*(//|\\*|/\\*)\" | grep -cE ...) already passed. Same class of self-correction 56-01's SUMMARY documented for its own test file."

requirements-completed: [AUD-01, AUD-02, AUD-03]

coverage:
  - id: D1
    description: "src/browser/sfx.js exports the complete, frozen clip vocabulary: 30 clip ids, 18 clip groups, 26 mapped engine event types, and a total 6-family BESTIARY-to-cry map with its two documented shares (Lair Beasts/Humans -> enemy-human, Magical/Demons -> enemy-demon)"
    requirement: "AUD-01"
    verification:
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: CLIP_IDS has 30 unique entries, each with a matching file in sfx/"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: the map's reachable clip set and CLIP_IDS are set-equal (30 of 30, both directions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "groupsForDispatch() resolves any dispatch to an ordered, de-duplicated, 3-capped list of group ids — synthesized walk/water step first (suppressed by leap/climb/fly/phase/teleport), then mapped events in array order, never alphabetized or reordered"
    requirement: "AUD-01"
    verification:
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: EDGE ordering — a mapped dispatch resolves in array order, not alphabetical order"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: EDGE adjacency — identical events in one dispatch collapse; across two dispatches the sample rotates"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: a step-suppressing event stops the synthesized walk/water clip from firing alongside it"
        status: pass
    human_judgment: false
  - id: D3
    description: "A combatJoined event resolves the foe's BESTIARY family to a named enemy-* cry through FAMILY_CRY — all six families resolve, proven total against content/bestiary.js's own keys (not a hand-written list), with a teeth case proving the check rejects a tampered map"
    requirement: "AUD-02"
    verification:
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: EDGE AUD-02 totality — FAMILY_CRY is total over BESTIARY's keys and matches the ruled table exactly"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: TEETH — deleting a FAMILY_CRY entry makes the totality check fail"
        status: pass
    human_judgment: false
  - id: D4
    description: "createVariation() is a counter-driven round-robin shuffle-bag with no pseudo-random source: size-1 groups never attempt a no-repeat guarantee, size-2 groups strictly alternate, size-3 groups cycle with no back-to-back repeat, and an unknown group returns null without throwing"
    requirement: "AUD-03"
    verification:
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: EDGE AUD-03 — every size-1 group returns its one clip five times without a no-repeat attempt, and throws nothing"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: EDGE AUD-03 — size-3 groups cycle over 6 calls with no back-to-back repeat"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-map.test.js#sfx-map: two independently constructed variations fed the same call sequence produce identical output"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-22
status: complete
---

# Phase 56 Plan 02: Sound Effects & Audio Settings — Pure Mapping Core Summary

**`src/browser/sfx.js`'s pure core resolves any dispatch to an ordered, de-duplicated, 3-capped list of concrete clip ids — 30 clips, 18 groups, 26 mapped events, a total 6-family BESTIARY cry map, and counter-driven (never rng-driven) repeat variation — all pinned by 18 new passing tests.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-22T13:40:12Z
- **Completed:** 2026-09-22T13:46:37Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- `src/browser/sfx.js` created with the complete, frozen clip vocabulary: `CLIP_IDS` (30), `CLIP_GROUPS` (18: 5 multi-clip + 13 single-clip), `EVENT_CLIP_GROUP` (26 real engine event types, each verified against `eventNarration.js`'s vocabulary), `FAMILY_CRY` (all 6 BESTIARY families total over 4 `enemy-*` cries, with the two ruled shares — Lair Beasts/Humans and Magical/Demons — documented and a comment blocking any future per-creature override layer), and `STEP_SUPPRESSING_EVENTS`.
- `groupsForDispatch(actionType, events, ctx)` added: synthesizes the walk/water step clip first (suppressed by leap/climb/fly/phase/teleport), walks the event array in order resolving `combatJoined` through `FAMILY_CRY` and everything else through `EVENT_CLIP_GROUP`, de-duplicates keeping first occurrence, and caps at `DISPATCH_CLIP_CAP` (3). Never throws on `null`/`undefined`/malformed entries.
- `createVariation()` added: a `Map`-backed round-robin shuffle-bag — `next(groupId)` is null-safe for unknown groups, skips the no-repeat guarantee entirely for size-1 groups, and modulo-cycles multi-clip groups (strict alternation at size 2, no-back-to-back cycling at size 3) with zero pseudo-random calls anywhere.
- `clipsForDispatch(actionType, events, ctx, variation)` added, threading `groupsForDispatch`'s output through a variation instance (module-level default, injectable for tests) to concrete clip ids.
- `test/unit/sfx-map.test.js` created: 18 named tests covering vocabulary integrity, map/asset closure (30-of-30 both directions), AUD-01 coverage, EDGE empty/ordering/adjacency, EDGE AUD-02 totality (proven against `content/bestiary.js`'s live `BESTIARY` keys, with a teeth case), EDGE AUD-03 degenerate groups, `DISPATCH_CLIP_CAP`, `STEP_SUPPRESSING_EVENTS`, and cross-instance determinism.
- Verified end-to-end: `node --test test/unit/sfx-map.test.js` → 18/18 pass; `npm test` → 3502/3502 pass (up from 3484); `npm run build:www` exits 0; `git diff --stat 6278968..HEAD -- engine/ content/ test/parity/` is empty; `git hash-object test/parity/prototype-master.js.txt` still equals `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`; `grep -rn "Math.random" src/browser/sfx.js` returns nothing (literal check, not just the comment-filtered one).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/browser/sfx.js with the clip tables and the family cry map** - `44397d8` (feat)
2. **Task 2: Add the pure per-dispatch resolver and the counter-driven variation** - `a25bd0d` (feat)
3. **[deviation] Reword sfx.js header comment to avoid a literal grep false-positive** - `28811c4` (docs)
4. **Task 3: Pin every mapping and variation edge in test/unit/sfx-map.test.js** - `8e25171` (test)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `src/browser/sfx.js` - new: the Phase 56 pure audio core (clip tables + family cry map + dispatch resolver + counter-driven variation); no audio API, no DOM, no imports, no pseudo-random source
- `test/unit/sfx-map.test.js` - new: 18 tests pinning every mapping and variation edge predicate, including map/asset closure and an AUD-02 teeth case

## Decisions Made
- Wrote Task 1 and Task 2's content in a single initial pass, then deliberately split the file back to only Task 1's content, verified and committed it, then appended Task 2's content, verified and committed separately — preserving the plan's per-task atomic-commit contract even though drafting happened together.
- Reworded one doc-header sentence to remove the literal substring "Math.random()" after confirming it collided with this plan's own literal verification grep (`grep -rn "Math.random" src/browser/sfx.js`), even though the comment-filtered acceptance-criteria grep in the plan itself already passed cleanly. No behavior change — same self-correction class documented in 56-01's SUMMARY for its own test file's comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a doc-header comment colliding with the plan's literal Math.random() grep**
- **Found during:** Task 1/2 verification, before Task 3
- **Issue:** The doc header's explanatory prose named `Math.random()` literally while documenting that the module never calls it. The plan's own acceptance criteria use a comment-filtered grep (correctly passing at 0), but the executor's top-level success criteria (`grep -rn "Math.random" src/browser/sfx.js` must return nothing) is a literal, unfiltered grep and would have matched the comment.
- **Fix:** Reworded the sentence to describe the same no-pseudo-random guarantee without the literal substring ("no JS built-in PRNG call, no crypto random-bytes call" instead of naming the function).
- **Files modified:** src/browser/sfx.js
- **Verification:** `grep -rn "Math.random" src/browser/sfx.js` returns nothing; `node --test test/unit/sfx-map.test.js` still 18/18 pass; `git diff -- engine/ content/` still empty.
- **Committed in:** `28811c4`

---

**Total deviations:** 1 auto-fixed (1 bug — comment wording only, no functional change)
**Impact on plan:** Zero scope creep; purely a self-inflicted grep-collision fix before it could ever fail a gate.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/browser/sfx.js`'s pure core (tables + `groupsForDispatch`/`createVariation`/`clipsForDispatch`) is complete and fully pinned; 56-03 can append the Web Audio backend (decode/play/voice management, `VOICE_CAP`, `unlockSfx()`, `applySfxSettings()`, `playForDispatch()`, `playUiTap()`, `stopAllSfx()`, the `__mzSfxBackendOverride` test hook) to this same file without touching anything landed in this plan.
- `FAMILY_CRY`'s totality-by-test pattern (set-equal against a content table's own keys, with a teeth case) is a reusable pattern for any future phase that needs a content-table-driven map proven exhaustive rather than hand-verified.
- No human_verification items deferred from this plan — everything here is pure-function unit-testable and was run directly in this environment; device confirmation of actual audio playback remains 56-03/56-04's concern and the Phase 60 UAT batch's backstop, as already scoped.

---
*Phase: 56-sound-effects-audio-settings*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: src/browser/sfx.js
- FOUND: test/unit/sfx-map.test.js
- FOUND: .planning/phases/56-sound-effects-audio-settings/56-02-SUMMARY.md
- FOUND: commit 44397d8
- FOUND: commit a25bd0d
- FOUND: commit 28811c4
- FOUND: commit 8e25171
- FOUND: commit 09214fd
