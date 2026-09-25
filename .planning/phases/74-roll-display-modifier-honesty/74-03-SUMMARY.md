---
phase: 74-roll-display-modifier-honesty
plan: 03
subsystem: ui
tags: [oracle, fight-log, rail, signed-modifier, player-view, roll-high]

# Dependency graph
requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "src/browser/rollRange.js's modsClause/modsText/signedText/ROLLERS/modLabel (74-02); the odds helpers this plan does not consume directly (74-01)"
provides:
  - "src/browser/eventNarration.js's Oracle roll lines (strikeMissed, struck, spellThrown, fleeRolled, allyMissed, allyCast, memberStruck, foeMissed, struckByFoe, parleyRolled, heightsFear, waterFear) formatted through rollRange.js's ONE player-side signed-modifier formatter, keyed on an explicit roller"
  - "src/browser/narrationLines.js's rail lines (fleeRolled, heightsFear, waterFear, foeMissed's wouldHaveHit names) through the same formatter"
  - "test/unit/roll-display-lines.test.js — the per-line sign contract for every roll-carrying line on both surfaces, plus the fight log's dice-reveal reuse and an idempotency proof"
affects: [74-04, 74-05, 74-06, 74-07, 74-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every Oracle/rail modifier call site passes an explicit ROLLERS.you/ally/foe roller to rollRange.js's modsClause/modsText — no call site any longer signs a modifier implicitly or restates the format locally"
    - "A phobia penalty (a positive number of winning faces removed) displays as its player-signed negated cost via signedText(-(penalty)), never a bare '+N'"

key-files:
  created:
    - test/unit/roll-display-lines.test.js
  modified:
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/feedback-payload.test.js
    - test/unit/clarity-cause-lines.test.js
    - docs/CLARITY.md
    - tools/voice-sample-output.txt

key-decisions:
  - "The module-private modsText/modsClause (eventNarration.js) and fleeModsText (narrationLines.js) are deleted outright rather than kept as thin wrappers — every call site now imports and calls rollRange.js's shared functions directly, so there is exactly one formatter in the codebase, not two call chains that happen to agree"
  - "heightsFear/waterFear's penalty (a positive faces-removed count) is negated before signedText, not signed as a bare number — signedText(-(e?.penalty ?? 0)) covers the missing-penalty '0' case for free (JS's -0 === 0, and signedText already normalizes -0 to '0')"
  - "LINE_FOR.foeMissed's wouldHaveHit clause switched from raw m.name to modLabel(m.name) so the Weaken cap ('penalty') reads 'Weaken' on the rail, matching the Oracle and fight-log surfaces rather than leaking the engine's internal field name"

requirements-completed: [ROLL-02, ROLL-03]

coverage:
  - id: D1
    description: "Every Oracle roll line (strikeMissed/struck/spellThrown/fleeRolled/allyMissed/allyCast/memberStruck/foeMissed/struckByFoe/parleyRolled) signs its modifiers from the player's side, with foe-rolled lines negating and hero/ally-rolled lines passing through unchanged; heightsFear/waterFear read the player-signed check cost"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "node --test test/unit/roll-display-lines.test.js test/unit/feedback-payload.test.js test/unit/clarity-cause-lines.test.js test/unit/fightLog.test.js test/unit/formatEventsCoverage.test.js (148/148 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rail (LINE_FOR) lines, the fight log's dice-reveal (oracleDetailText(narrateEvent(e))) and the regenerated voice sample all read the same player-signed tokens as the Oracle; no engine/content/parity file changed"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/roll-display-lines.test.js test/unit/clarity-cause-lines.test.js test/unit/narrationLinesTable.test.js test/unit/flee-retune.test.js test/unit/linesForAction.test.js (170/170 pass) && npm test (5930/5930 pass)"
        status: pass
      - kind: unit
        ref: "git diff --stat -- engine content test/parity (empty)"
        status: pass
    human_judgment: false

# Metrics
duration: ~30min
completed: 2026-09-25
status: complete
---

# Phase 74 Plan 03: Roll Display & Modifier Honesty — Oracle, Fight Log & Rail Re-Signing Summary

**Every event-driven roll line in `eventNarration.js` and `narrationLines.js` now formats its modifiers through `rollRange.js`'s ONE player-side signed-modifier formatter with an explicit roller — foe lines negate the engine's roller-signed deltas so a bonus to the foe reads as a minus to the player, closing the ROLL-LEDGER O3 `needModsClause` ambiguity, and the heights/water phobia lines read the player-signed cost of the check ("−2 on the climb.") instead of the old roll-under "+N on a roll you wanted low."**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-25
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- **Task 1 (eventNarration.js, the Oracle):** deleted the module-private `modsText`/`modsClause`, extended the `rollRange.js` import with `modsClause`, `signedText`, `ROLLERS`, and passed an explicit roller at every call site — `ROLLERS.you` on `strikeMissed`, `struck`, `spellThrown`, `fleeRolled`; `ROLLERS.ally` on `allyMissed`, `allyCast`; `ROLLERS.foe` on `memberStruck`, `foeMissed`, `struckByFoe`. `parleyRolled`'s fluency clause now goes through `signedText` for consistency (`(+2 for the tongue)` unchanged in output). `heightsFear`/`waterFear` now read `signedText(-(penalty))` followed by " on the climb."/" on the leap." — a missing penalty reads "0", never "−0".
- **Task 2 (narrationLines.js, the rail):** deleted the module-private `fleeModsText`; `fleeRolled` now calls `modsText(mods, ROLLERS.you)` directly. `heightsFear`/`waterFear`'s rail cards read the same player-signed cost ("Heights: −2 on the climb."). `LINE_FOR.foeMissed`'s `wouldHaveHit` clause names each modifier through `modLabel`, so a Weaken cap ("penalty") reads "Weaken" on the rail too, not the raw engine field name.
- **`test/unit/roll-display-lines.test.js`** (new, 22 tests): the per-line sign contract for every behavior in the plan — foe-rolled negation (foeMissed/struckByFoe/memberStruck), hero/ally passthrough (strikeMissed/struck/spellThrown/allyMissed/fleeRolled), the parley fluency clause, the heights/water phobia cost, the fight log's dice-reveal reuse (`oracleDetailText(narrateEvent(e))`), a deep-frozen-event idempotency proof, and the Task 2 rail-line cases (`LINE_FOR.heightsFear`/`waterFear`/`foeMissed`/`fleeRolled`).
- **Old-text pins updated:** `feedback-payload.test.js`'s `struckByFoe` Guard assertion tightened from a loose digit match to an exact `(Guard +1)` match; `clarity-cause-lines.test.js`'s two Oracle fear rows and two rail fear rows updated to the new endings; `docs/CLARITY.md` rows 35-36's quoted example text updated.
- **`tools/voice-sample-output.txt` regenerated:** 15 lines changed across `heightsFear`/`waterFear` (the fear-clause rewrite) and every foe-rolled `memberStruck`/`foeMissed`/`struckByFoe` sample (modifiers now negated from the player's side) — every other line in the 917-line sample is byte-identical.
- **`npm test`: 5930/5930 pass, 0 failures.** No test outside the ones this plan explicitly names pinned an old foe-line sign or fear clause, so no additional Rule-1 fixes were needed. `git diff --stat -- engine content test/parity` is empty — presentation only, no engine or fixture change.

## Before/After Examples

**A foe line (`struckByFoe`, Guard −1):**
- Before: `1 vs 9–20 (armor-bulk −2). Sterling hits you for 22 hp.` (a foe's Guard-style bonus printed as a minus, ambiguous)
- After: `1 vs 9–20 (armor-bulk +2). Sterling hits you for 22 hp.` (the same engine delta now reads as a plus, exactly as it should for a foe modifier that is bad news the OTHER direction — good news for the player)

**A fear line (`heightsFear`, penalty 2):**
- Before: `Heights: your stomach reaches the ground well before your feet do. +2 on a roll you wanted low.`
- After: `Heights: your stomach reaches the ground well before your feet do. −2 on the climb.`

**The parley line (`parleyRolled`, fluency 1):**
- Before and after (unchanged output, now built through `signedText`): `Talk it down: 15 vs 8–20 (+2 for the tongue).`

## Test Files Touched

| File | Reason |
|---|---|
| `test/unit/roll-display-lines.test.js` | New — the per-line sign contract for every behavior in Tasks 1-2 |
| `test/unit/feedback-payload.test.js` | `struckByFoe`'s Guard assertion tightened to an exact `(Guard +1)` match |
| `test/unit/clarity-cause-lines.test.js` | Two Oracle fear rows + two rail fear rows updated to the new endings |
| `docs/CLARITY.md` | Rows 35-36's quoted example text updated |
| `tools/voice-sample-output.txt` | Regenerated; 15 lines changed |

## Task Commits

Each task was committed atomically:

1. **Task 1: The Oracle roll lines re-signed by roller** — `c328bda` (feat)
2. **Task 2: The rail lines, the would-have-hit names, the docs and the voice sample** — `99c36db` (feat)

_No plan-metadata commit and no STATE.md/ROADMAP.md/REQUIREMENTS.md updates — this is a parallel worktree plan; the orchestrator handles those after all wave agents complete._

## Files Created/Modified

- `src/browser/eventNarration.js` — module-private `modsText`/`modsClause` deleted; import extended with `modsClause`, `signedText`, `ROLLERS` from `rollRange.js`; every call site passes an explicit roller; `parleyRolled` uses `signedText`; `heightsFear`/`waterFear` rewritten to the player-signed cost.
- `src/browser/narrationLines.js` — module-private `fleeModsText` deleted; import extended with `modsText`, `modLabel`, `signedText`, `ROLLERS`; `fleeRolled` calls the shared `modsText`; `heightsFear`/`waterFear` rewritten; `LINE_FOR.foeMissed`'s wouldHaveHit clause names via `modLabel`.
- `test/unit/roll-display-lines.test.js` — new file, 22 tests covering every behavior in both tasks.
- `test/unit/feedback-payload.test.js` — struckByFoe Guard assertion tightened.
- `test/unit/clarity-cause-lines.test.js` — 4 rows updated (2 Oracle, 2 rail).
- `docs/CLARITY.md` — 2 rows updated.
- `tools/voice-sample-output.txt` — regenerated, 15 lines changed.

## Decisions Made

- Deleted the module-private duplicate formatters outright rather than keeping them as thin wrappers around `rollRange.js` — every call site now imports and calls the shared functions directly, so there is exactly one formatter in the codebase.
- `heightsFear`/`waterFear`'s penalty is negated before `signedText` (`signedText(-(e?.penalty ?? 0))`), which covers the "missing penalty reads 0" case for free via `signedText`'s existing `-0` normalization — no separate branch needed.
- `LINE_FOR.foeMissed`'s wouldHaveHit names switched to `modLabel` so the rail matches the Oracle/fight-log surfaces exactly (a Weaken cap reads "Weaken" everywhere, never the raw `"penalty"` field name).

## Deviations from Plan

None - plan executed exactly as written. Task 2's action item 6 ("for any other test that pinned an old foe-line sign or fear clause, apply the same rule") found no additional stale pins — the full `npm test` run (5930/5930) passed cleanly after only the changes named explicitly in the plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7, as part of the milestone's end-of-run UAT batch:
1. Get insulted after a failed parley while Sidestep is up, and confirm the Oracle foe line reads "(Sidestep +2, insulted −1)".
2. Tap that fight-log row and confirm the tap-to-reveal dice shows the same signs.
3. Trigger a Heights climb and confirm the Oracle/rail both read "−2 on the climb" (or the live penalty's value).

## Next Phase Readiness

- `src/browser/eventNarration.js` and `src/browser/narrationLines.js` now import `rollRange.js`'s signed-modifier formatter directly at every roll-carrying call site named in this plan; 74-04 through 74-08 build on top of the same `rollRange.js` contract (74-01/74-02) without needing to touch these two files' modifier-sign logic again.
- No blockers. No known stubs or deferred items from this plan.
- Sibling plans 74-04 (rollOdds.js/heroTab.js/combatMenu.js) and 74-05 (upgradeWhy.js/viewModels.js) ran in parallel on a disjoint file set and are unaffected by this plan's changes.

---
*Phase: 74-roll-display-modifier-honesty*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: src/browser/eventNarration.js
- FOUND: src/browser/narrationLines.js
- FOUND: test/unit/roll-display-lines.test.js
- FOUND: test/unit/feedback-payload.test.js
- FOUND: test/unit/clarity-cause-lines.test.js
- FOUND: docs/CLARITY.md
- FOUND: tools/voice-sample-output.txt
- FOUND: .planning/phases/74-roll-display-modifier-honesty/74-03-SUMMARY.md
- FOUND commits: c328bda (Task 1), 99c36db (Task 2)
