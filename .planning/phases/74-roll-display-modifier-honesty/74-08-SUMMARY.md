---
phase: 74-roll-display-modifier-honesty
plan: 08
subsystem: testing
tags: [roll-high, signed-modifier, consistency-guard, voice-scan, ledger, phase-close]

# Dependency graph
requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "74-02's rollRange.js formatter, 74-03's Oracle/rail re-signing, 74-04's rollOdds.js/hero sheet/combat menu, 74-05's upgradeWhy.js/lootCompare, 74-06's foeDetails.js odds line and foeConditionEffect, 74-07's conditionEffects.js"
provides:
  - "test/unit/roll-sign-consistency.test.js — the cross-surface sign guard (11 tests), the range-format pin and the one-formatter source scan"
  - "test/unit/hp-not-wp.test.js registers CONDITION_EFFECT_COPY/MOD_LABEL/ROLL_COPY in the standing wp/WP walk and gains a BANNED/ALLOWLIST voice scan over those plus FOE_DETAILS_COPY/COMBAT_MENU_COPY/UPGRADE_WHY_COPY"
  - "docs/ROLL-LEDGER.md's '## Phase 74 display closure (ROLL-02/03)' — the sign rule, the non-event surfaces, the O3/device-trigger closures, the consistency guard, and the Phase 77/78/79 handoffs"
  - "the phase's final whole-phase gate measurements (parity, fixtures, engine-file diff, shell-snapshot diff, npm test)"
affects: [77, 78, 79]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The cross-surface sign guard drives the REAL engine (playerStrike/foeTurn/flee with a scripted rng) for every scenario except heightsFear (presentation-only) and purchaseBagged (built from the engine's own gearCompareParts) — the guard binds to engine truth, never a hand-typed event"
    - "signedTokens(text, names) strips HTML tags then harvests every 'name ±N' occurrence per expected modifier name — a surface printing the opposite sign for a name simply never produces the expected token, which is how 'opposite signs' fails loudly rather than silently"

key-files:
  created:
    - test/unit/roll-sign-consistency.test.js
  modified:
    - test/unit/hp-not-wp.test.js
    - docs/ROLL-LEDGER.md

key-decisions:
  - "The one-formatter source scan lists every src/browser/*.js file except rollRange.js, plus mazeworld.html, and checks two independent things: no banned formatter name (modsText/modsClause/needModsText/needModsClause/signedNeed/critRange/fleeModsText) is DEFINED outside rollRange.js, and no file contains a local sign ternary on a `.delta` comparison — a usage/import of rollRange.js's exports (e.g. `modsText(...)`) never trips either check"
  - "tools/voice-sample-output.txt was re-generated and found byte-identical (0 changed lines) — 74-03's and 74-05's parallel changes were already reflected in the committed sample — so it was left uncommitted per the plan's own 'commit only if it changed' instruction"
  - "docs/ROLL-LEDGER.md's new section is appended with CRLF line endings (via a small Node script, not the Edit tool) to match the file's existing convention and keep the append-only diff exactly zero deletion lines"

requirements-completed: [ROLL-02, ROLL-03]

coverage:
  - id: D1
    description: "A build-failing cross-surface sign guard (test/unit/roll-sign-consistency.test.js, 11 tests) proves the same modifier never renders with opposite signs on two surfaces, for insulted/Guard/Sidestep, Weaken, Battle Roar, Elven, afraid, a weapon comparison, flee and heights — each scenario driven through the real engine except the two presentation-only cases the plan names"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "node --test test/unit/roll-sign-consistency.test.js (11/11 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The guard has teeth: temporarily flipping foeMissed's roller to ROLLERS.you made 4 of 11 tests fail; the change was reverted and eventNarration.js is byte-identical to before (git diff empty)"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "manual sanity check, recorded below (not a permanent test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The range-pin test proves a level-1 Human Fighter/Thief/Magic User on a Club reads 16–20/17–20/18–20 identically on the hero sheet, the combat menu's STRIKE row, foe details' 'You hit it on' range and a real playerStrike event's rangeText(atLeast, dieN)"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/roll-sign-consistency.test.js (the 'range pin' test)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The range-format guard proves every harvested range is 'lo–hi' (U+2013) or a single face or 'nothing', with no '%' and no 'N+' shorthand anywhere the guard renders"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/roll-sign-consistency.test.js (the 'range format' test)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The one-formatter guard proves rollRange.js is the ONLY src/browser/*.js (or mazeworld.html) module defining a modifier-sign formatter or a local sign ternary"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/roll-sign-consistency.test.js (the 'one formatter' test)"
        status: pass
    human_judgment: false
  - id: D6
    description: "test/unit/hp-not-wp.test.js's standing wp/WP walk covers CONDITION_EFFECT_COPY/MOD_LABEL/ROLL_COPY, and a new BANNED/ALLOWLIST voice scan covers those plus FOE_DETAILS_COPY/COMBAT_MENU_COPY/UPGRADE_WHY_COPY"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/hp-not-wp.test.js (13/13 pass); grep -c CONDITION_EFFECT_COPY test/unit/hp-not-wp.test.js = 4"
        status: pass
    human_judgment: false
  - id: D7
    description: "docs/ROLL-LEDGER.md records the Phase 74 display closure as its final, append-only H2 section"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "grep -c '^## Phase 74 display closure' docs/ROLL-LEDGER.md = 1; it is the file's last H2; git diff 0f6dc5c -- docs/ROLL-LEDGER.md has zero deletion lines; node --test test/unit/roll-ledger-sync.test.js (3/3 pass)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every whole-phase gate holds: the parity suite is green, the declared untouched surfaces (fixtures/prototype-master/comparables/roll-high pins/direction tests/content) have zero diff since 0f6dc5c, only engine/combat.js and engine/derived.js changed in engine/, only mu.hero.txt/thief-store.store.txt/thief.hero.txt changed in shell-snapshots, and npm test is green"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test \"test/parity/**/*.test.js\" (53/53 pass); git diff --quiet 0f6dc5c -- <declared paths> exits 0; git diff --name-only 0f6dc5c -- engine lists exactly combat.js/derived.js; git diff --name-only 0f6dc5c -- test/unit/fixtures/shell-snapshots lists exactly the 3 declared files; npm test (5986/5986 pass, 0 failures)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The rolled-up Pixel 7 human-verification list for the milestone-close deferred UAT batch (see below) — every 'Human verification (deferred to end of run)' note from 74-03 through 74-07"
    verification: []
    human_judgment: true
    rationale: "Visual/on-device confirmation, deferred to the milestone's end-of-run UAT batch per the project's deferred-UAT protocol (project memory) — not independently automatable beyond the unit-level string pins already covered by D1–D6."

# Metrics
duration: ~55min
completed: 2026-09-25
status: complete
---

# Phase 74 Plan 08: Roll Display & Modifier Honesty — Consistency Guard, Copy-Bank Registration & Ledger Closure Summary

**A build-failing guard (test/unit/roll-sign-consistency.test.js, 11 tests driving the real engine) now proves the same modifier never renders with an opposite sign on two surfaces, pins the ONE range format and the ONE formatter module, and docs/ROLL-LEDGER.md records the phase's full display closure — closing ROADMAP Phase 74 success criteria 1–3.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-25
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **`test/unit/roll-sign-consistency.test.js`** (new, 11 tests) — the cross-surface sign guard named by the plan, driving the real engine (`engine/combat.js#playerStrike`/`foeTurn`/`flee` with a scripted `fakeRng`) for every scenario except `heightsFear` (presentation-only) and `purchaseBagged` (built from the engine's own `gearCompareParts`):
  - **foe side** (Guard/Sidestep/insulted): a real `foeMissed`/`struckByFoe` event's Oracle line, fight-log reveal and the foe details odds line all read "Guard +1", "Sidestep +2" and "insulted −1".
  - **Weaken**: `combat.foeToHitPenalty 3` reads "Weaken +2" on the real foe line and foe details for a plain Human Fighter/Soldier.
  - **Battle Roar**: the hero's own live Battle Roar reads "Battle Roar +2" on both surfaces.
  - **Elven**: the race's own `foeToHit +1` (bad for the hero) reads "Elven −1" on both surfaces.
  - **afraid**: a real `playerStrike` shows "afraid −3" on the Oracle line and reveal; the Afraid chip's measured effect (`conditionEffectText`, via a real `conditionsOf(state)` descriptor) starts "−3 to hit".
  - **weapons**: a Bardiche (need −2) and a Dagger (need +1) vs a Club read the same to-hit sign on `lootCompare`, `EVENT_NARRATION.purchaseBagged` and `LINE_FOR.purchaseBagged`.
  - **flee**: a real Human Thief flee reads "Thief +5" on the `fleeRolled` Oracle line, `LINE_FOR.fleeRolled` and the combat menu's FLEE row.
  - **heights**: `heightsFear` with `penalty: 2` shows "−2" on both the Oracle and the rail line.
  - **range pin**: a level-1 Human Fighter/Thief/Magic User on a Club reads 16–20/17–20/18–20 identically on the hero sheet, the combat menu's STRIKE sub, foe details' "You hit it on" range, and `rangeText(atLeast, dieN)` of a real `playerStrike` event.
  - **range format**: every harvested range across a representative sample of surfaces matches `lo–hi`/single-face/"nothing" (U+2013), with no "%" and no "N+" shorthand anywhere.
  - **one formatter**: a source scan of every `src/browser/*.js` file except `rollRange.js`, plus `mazeworld.html`, proves no file defines a banned formatter name (`modsText`/`modsClause`/`needModsText`/`needModsClause`/`signedNeed`/`critRange`/`fleeModsText`) or a local sign ternary on a `.delta` comparison.
- **The guard's teeth, verified live**: temporarily flipped `foeMissed`'s roller in `eventNarration.js` from `ROLLERS.foe` to `ROLLERS.you` — 4 of the 11 tests (foe side, Weaken, Battle Roar, Elven) immediately failed, each reporting the missing expected token. Reverted; `git diff` on `eventNarration.js` is empty (byte-identical).
- **`test/unit/hp-not-wp.test.js`** — imports `CONDITION_EFFECT_COPY` (`conditionEffects.js`), `MOD_LABEL`/`ROLL_COPY` (`rollRange.js`) and adds them to the standing wp/WP-walked `banks` object; a new test runs the same BANNED/ALLOWLIST voice scan `test/unit/upgrade-why.test.js` uses (imported as `SAFETY_BANNED`/`SAFETY_ALLOWLIST` to avoid colliding with the file's own local `ALLOWLIST` for the wp/WP scan) over those three banks plus `FOE_DETAILS_COPY`, `COMBAT_MENU_COPY` and `UPGRADE_WHY_COPY` leaves — all clear.
- **`docs/ROLL-LEDGER.md`** — appended `## Phase 74 display closure (ROLL-02/03)` as the file's final H2, append-only (zero deletion lines since commit `0f6dc5c`): the sign rule and roller-per-line table (you/ally/foe), the non-event ("right now") surfaces with one worked example each, the O3/`needModsClause` handoff closed by 74-03, the device-trigger case closed by 74-05, the consistency guard itself, the hooks left for Phase 77 (`WHAT_IF`/`foeConditionEffect` reuse) and Phase 78 (the climb card's range format), and what stays for Phase 79 (Smoke/Battle Roar narration prose, the "They need two better" chip/narration lines, the authored `CONDITION_EXPLAIN`/`FOE_CONDITION_DESC` sentences, and unflagged bestiary notes).
- **`tools/voice-sample-output.txt`** re-generated (`node tools/voice-sample.mjs`) on the merged tree: **0 lines changed** — 74-03's and 74-05's parallel changes were already reflected in the committed sample from an earlier wave. Left uncommitted, per the plan's own "commit only if it changed" instruction.
- **Whole-phase gates**, all measured clean:
  - `node --test "test/parity/**/*.test.js"`: **53/53 pass, 0 failures**.
  - `git diff --quiet 0f6dc5c -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness/comparables.js test/unit/roll-high-state-pins.test.js test/unit/roll-high-save-compat.test.js test/unit/fixtures/roll-high test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js content`: exit 0 (no diff).
  - `git diff --name-only 0f6dc5c -- engine`: exactly `engine/combat.js` and `engine/derived.js`.
  - `git diff --name-only 0f6dc5c -- test/unit/fixtures/shell-snapshots`: exactly `mu.hero.txt`, `thief-store.store.txt`, `thief.hero.txt`.
  - `npm test`: **5986/5986 pass, 0 failures**.

## Task Commits

Each task was committed atomically:

1. **Task 1: The cross-surface sign guard, the range-format pin and the copy-bank registration** — `a9676ed` (test)
2. **Task 2: The ledger's Phase 74 closure and the phase's final gates** — `62a0c34` (docs)

_No plan-metadata commit and no STATE.md/ROADMAP.md/REQUIREMENTS.md updates — this is a parallel worktree plan; the orchestrator handles those after all wave agents complete._

## Files Created/Modified

- `test/unit/roll-sign-consistency.test.js` — new: the 11-test cross-surface sign guard, range-format pin and one-formatter scan.
- `test/unit/hp-not-wp.test.js` — `CONDITION_EFFECT_COPY`/`MOD_LABEL`/`ROLL_COPY` registered in the standing wp/WP walk; new BANNED/ALLOWLIST voice scan over those plus `FOE_DETAILS_COPY`/`COMBAT_MENU_COPY`/`UPGRADE_WHY_COPY`.
- `docs/ROLL-LEDGER.md` — `## Phase 74 display closure (ROLL-02/03)` appended as the file's final H2.

## Decisions Made

- The one-formatter scan checks two independent things (a banned name definition, and a local sign ternary on `.delta`) rather than a single combined regex — this keeps each failure message specific about which rule tripped, and avoids false positives on the many legitimate `modsText(...)`/`modsClause(...)` call sites that import and use `rollRange.js`'s real exports.
- `tools/voice-sample-output.txt` was regenerated and diffed before deciding whether to commit it — since 74-03/74-05 ran in parallel and one of their samples might have predated the other, but the committed tree already reflected both, so the regenerated file was byte-identical (0 lines changed) and was left uncommitted.
- `docs/ROLL-LEDGER.md`'s append used a small Node script (not the Edit tool) so the new section's CRLF line endings exactly match the rest of the file — this keeps `git diff`'s deletion-line count at zero, satisfying the "append-only" acceptance criterion precisely.

## Deviations from Plan

None - plan executed exactly as written. Every behavior named in Task 1's `<behavior>` block passed on the first run with no surface needing a fix; the guard never found a real sign bug to report.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

Rolled up from every "Human verification (deferred to end of run)" note in 74-03 through 74-07, for the milestone-close Pixel 7 batch (deferred UAT protocol; no device pause here):

1. Get insulted after a failed parley while Sidestep is up, and confirm the Oracle foe line reads "(Sidestep +2, insulted −1)". (74-03)
2. Tap that fight-log row and confirm the tap-to-reveal dice shows the same signs. (74-03)
3. Trigger a Heights climb and confirm the Oracle/rail both read "−2 on the climb" (or the live penalty's value). (74-03)
4. A new level-1 hero's sheet reads the class range on d20 at the TO HIT row (a Fighter reads "16–20 (d20)", a Thief with a dagger reads "16–20 (d20)" [classNeed 4 + Dagger's +1], a Magic User reads "18–20 (d20)"). (74-04)
5. The combat menu's STRIKE row reads "Hit 16–20 (d20) · N–M dmg" (matching the hero sheet's own TO HIT value exactly). (74-04)
6. The combat menu's FLEE row reads a "N–20 (d20)" range as its cost, with any modifiers ("Thief +5") in its description. (74-04)
7. On the store or find screen, a heavy weapon reads "−N to hit, worse than your <weapon>"; a precise blade (Dagger/Rapier/Katana/Ninja-to/Wakazashi) reads "crits on 19–20 vs your 20" at level 1. (74-05)
8. Long-press a foe mid-fight and confirm the card reads "You hit it on … · it hits you on …" right after the defence line (or right after HP with no defence line). (74-06)
9. With Sidestep live and after insulting a foe during parley, confirm the foe's side reads "(Sidestep +2, insulted −1)". (74-06)
10. Cast Weaken and confirm the card's Weakened effect line reads "it hits you only on 18–20 (d20)" followed by the unchanged Weakened description. (74-06)
11. While Afraid in a fight, tap the Afraid chip and confirm the card opens with "−3 to hit (now …)"; with an Anklet of Invisibility running, tap its chip and confirm "+2 vs their swings". (74-07)

## Next Phase Readiness

- Phase 74 (Roll Display & Modifier Honesty) is complete: ROADMAP success criteria 1–3 hold and are pinned by a build-failing test, not just a code read.
- Phase 77 (CMBUI-13 effect indicators) has a stable `rollRange.js`/`rollOdds.js`/`conditionEffects.js#WHAT_IF`/`foeDetails.js#foeConditionEffect` surface to extend with one more entry, not a second mechanism.
- Phase 78's climb card can reuse this phase's range format directly.
- Phase 79 has the ledger's consolidated "what stays" list (Smoke/Battle Roar prose, the "They need two better" lines, `CONDITION_EXPLAIN`/`FOE_CONDITION_DESC`, unflagged bestiary notes) as its starting inventory, on top of the existing `## Handoffs → Phase 79` list.
- No blockers. No known stubs or deferred items from this plan.

---
*Phase: 74-roll-display-modifier-honesty*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: test/unit/roll-sign-consistency.test.js
- FOUND: test/unit/hp-not-wp.test.js
- FOUND: docs/ROLL-LEDGER.md
- FOUND: .planning/phases/74-roll-display-modifier-honesty/74-08-SUMMARY.md
- FOUND commits: a9676ed (Task 1), 62a0c34 (Task 2)
