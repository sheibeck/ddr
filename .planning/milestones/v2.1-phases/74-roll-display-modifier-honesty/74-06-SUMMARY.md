---
phase: 74-roll-display-modifier-honesty
plan: 06
subsystem: ui
tags: [roll-high, foe-details, rail-card, condition-chips, roll-02, roll-03]

# Dependency graph
requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "74-01: engine/derived.js#heroStrikeFacesVs/foeSwingVsHero; 74-04: src/browser/rollOdds.js's heroHitOddsVs(state, foe)/foeHitOddsVs(state, foe)"
provides:
  - "src/browser/foeDetails.js's long-press foe card now shows the live, two-way 'right now' odds against the hero — 'You hit it on 17–20 (d20) · it hits you on 16–20 (d20)' — read only from rollOdds.js, right after the defence line"
  - "The old static 'Hit only on a {n} or under' defence label is retired; a sp.toHit cap now shows as a real range on the odds line"
  - "export function foeConditionEffect(chip, foe, state) — a foeConditionChips chip's to-hit effect and resulting range, stated from the player's side (asleep/stupid/blind/weakened); every other chip key returns null. Exported for Phase 77's CMBUI-13 effect indicators to reuse"
affects: [74-07, 74-08, 77]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "foeDetails.js now imports heroHitOddsVs/foeHitOddsVs from rollOdds.js directly rather than reading foe.sp fields itself — the long-press card's odds are a pure presentation read of the SAME engine-derived faces rollOdds.js's other consumers (hero sheet, combat menu) use, so the card can never disagree with the sheet"
    - "oddsLine(foe, sp, state) and foeConditionEffect(chip, foe, state) both return null (never throw) for a state without a full hero (no c.cls/c.race), matching foeDetails.js's existing D-12 'every read is guarded' discipline — a minimal/partial state quietly drops the new lines instead of crashing the card"

key-files:
  created: []
  modified:
    - src/browser/foeDetails.js
    - test/unit/foeDetails.test.js

key-decisions:
  - "oddsLine's you-part and it-part are computed inside one safe(…, null) wrapper (not two) — heroHitOddsVs(state, foe) throwing on a minimal c (no race/cls) is the SAME signal used to drop the whole line, so there is no separate feature-detection branch for 'does this state have a hero'"
  - "foeConditionEffect reads foeHitOddsVs(state, foe).plainText (not .text) for blind/weakened — the chip's own label+desc already names the effect (Blind/Weakened), so the effect clause shows only the resulting range, never a redundant modifier list"
  - "test/unit/foeDetails.test.js's local (d)-section effectLines(card) helper was changed from a fixed line-index offset to shape-detection (regex on the line text) so it keeps working for both the pre-existing minimal-hero (d) tests and the new full-hero Phase 74 tests without duplicating the helper"

requirements-completed: [ROLL-02, ROLL-03]

coverage:
  - id: D1
    description: "foeDetails.js's long-press card shows a two-way 'right now' odds line right after the defence line (or after HP with no defence line), read only from rollOdds.js's heroHitOddsVs/foeHitOddsVs — never a restated formula; the old static toHit defence label is gone, a sp.toHit cap becomes a real range, a magicOnly/daggerOnly foe with no matching weapon reads 'You cannot touch it', and a never_melee foe's line has no 'it hits you' part"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/foeDetails.test.js (Phase 74 odds-line block, 6 tests) — pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "The foe side's odds carry the SAME player-signed modifiers rollOdds.js produces on the hero sheet/combat menu (Sidestep +2, insulted −1, Guard +1, Weaken +2) — proven equal to test/unit/rollOdds.test.js's own pinned strings for the identical states"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "node --test test/unit/foeDetails.test.js — 'the foe side's odds carry the same signed modifiers as rollOdds.js' — pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "foeConditionEffect(chip, foe, state) states each to-hit-moving foe condition's effect from the player's side with its resulting range (asleep/stupid floor the hero's own odds at 5 faces; blind/weakened move the foe's odds at the hero), every other chip key returns null, and it never throws on a minimal state; the long-press effect line gains '<text> — <effect>. <desc>' for those four chips and is byte-identical to before for every other chip"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "node --test test/unit/foeDetails.test.js test/unit/foe-conditions.test.js (66/66 pass); npm test (5959/5959 pass, 0 failures)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pixel 7 device confirmation: long-pressing a foe shows 'You hit it on … · it hits you on …' with Sidestep and an insult reading '(Sidestep +2, insulted −1)'; casting Weaken makes the card's Weakened line read 'it hits you only on 18–20 (d20)'"
    verification: []
    human_judgment: true
    rationale: "Visual/UI confirmation on a physical device, deferred to the milestone's end-of-run UAT batch per the deferred-UAT protocol (project memory) — not independently automatable beyond the unit-level string pins already covered by D1–D3."

# Metrics
duration: ~40min
completed: 2026-09-25
status: complete
---

# Phase 74 Plan 06: Foe Details' Two-Way Odds & Condition Effects Summary

**src/browser/foeDetails.js's long-press foe card now shows the engine's own live, two-way "right now" odds against the hero — "You hit it on 17–20 (d20) · it hits you on 16–20 (d20)" — and each to-hit-moving foe condition chip states its effect and resulting range from the player's side, both read only from rollOdds.js.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-25
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **The odds line (Task 1)** — `foeDetails.js` imports `heroHitOddsVs`/`foeHitOddsVs` from `./rollOdds.js` and adds `oddsLine(foe, sp, state)`, pushed right after the defence line (or right after HP when there is no defence line), before the attack line. The you-part reads `"You hit it on {range}"` or `"You cannot touch it"` when `heroHitOddsVs(...).untouchable`; the it-part reads `"it hits you on {range}"` (the formatter's own player-signed modifier clause) and is omitted for a `never_melee` foe. The whole computation runs inside one `safe(…, null)`, so a state without a full hero (no `c.cls`/`c.race` — `strikeDie`/`classNeed` throw on the missing race/class lookup) quietly drops the line; the card never throws. `FOE_DETAILS_COPY.toHit` ("Hit only on a {n} or under") is retired; `defenceLine` no longer reads `sp.toHit` at all.
- **Sample card (before/after)** — a level-1 Human Fighter (Club) long-pressing a plain level-1 foe (Ned, Humans):
  - **Before:** `HUMANS · SIZE H` / `HP 8 / 8` / `1 swing · d6 · N–M before armour` / …
  - **After:** `HUMANS · SIZE H` / `HP 8 / 8` / **`You hit it on 16–20 (d20) · it hits you on 16–20 (d20)`** / `1 swing · d6 · N–M before armour` / …
  - A `sp.toHit 4` foe (Zit): before `"AR … · Hit only on a 4 or under"` — after the defence line drops the to-hit label entirely and the odds line reads `"You hit it on 17–20 (d20) · it hits you on …"`.
  - With the hero's Sidestep live and `combat.parleyInsulted` set: `"… it hits you on 17–20 (d20; Sidestep +2, insulted −1)"`; a Guard hero reads `"… (d20; Guard +1)"` — both byte-identical to `rollOdds.test.js`'s own pinned strings for the same states.
- **Foe condition effects (Task 2)** — exported `foeConditionEffect(chip, foe, state)`: `asleep`/`stupid` fill `"you hit it on {range}"` from `heroHitOddsVs(state, foe).text` (the hero's own floored-at-5 odds); `blind`/`weakened` fill `"it hits you only on {range}"` from `foeHitOddsVs(state, foe).plainText` (the range alone, no modifier clause — the chip label already names the effect); every other chip key (`stunned`, `hamstrung`, `marked`, `frozen`, `acid`, `dot`, `shrunk`, `fixated`, `frenzied`) returns `null`. `effectLines(foe, state)` now writes `"<chip text> — <effect>. <chip desc>"` when `foeConditionEffect` returns text, and the unchanged `"<chip text> — <chip desc>"` otherwise. `src/browser/foeConditions.js` is untouched (`git diff --stat` empty) — only the computed effect clause was added, never a reworded description.
  - Example: a Weakened fight (`combat.weakened`, `combat.foeToHitPenalty: 3`, `c.timers["spell:weaken"].left: 2`) now reads `"Weakened · 2 — it hits you only on 18–20 (d20). Every one of them does half damage while it lasts. They are not taking it well."` — before, the line had no effect clause at all.
- **`test/unit/foeDetails.test.js`** — a new `fullHeroState(foe, over)` test helper builds a real `newRun(1)` state with `race/cls/sub/level/weapon` overridden to a level-1 Human Fighter (Club) (mirroring `characterSheetViewModel.test.js`'s 74-04 pattern), holding one live foe in `combat.foes` — unlike `stateWith`'s deliberately minimal `c` (no race/cls), which keeps the odds line and `foeConditionEffect` quietly dropping out for every pre-existing test. 30 new/updated assertions across two Phase 74 test blocks (6 for the odds line, 7 for condition effects) plus updates to the (b) line-order and defence-label tests. The local (d)-section `effectLines(card)` helper now detects the optional odds line by regex shape instead of a fixed index offset, so it works for both minimal-hero and full-hero cards.
- **`npm test`: 5959/5959 pass, 0 failures** (worktree base was 5947/5947).

## Task Commits

Each task was committed atomically:

1. **Task 1: The two-way odds line on the long-press foe card** - `73950c4` (feat)
2. **Task 2: Foe condition effects with their ranges on the card** - `3f3c11d` (feat)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `src/browser/foeDetails.js` — `oddsLine`/`foeConditionEffect` added; `FOE_DETAILS_COPY.toHit` retired, `oddsYou`/`oddsUntouchable`/`oddsIt`/`effectYou`/`effectIt` added; `defenceLine` no longer reads `sp.toHit`; `effectLines` gains the computed-effect clause; header D-09 order comment updated
- `test/unit/foeDetails.test.js` — `fullHeroState` helper; new Phase 74 odds-line and condition-effect test blocks; (b) line-order/defence-label tests updated; (d)-section `effectLines` helper generalised to detect the odds line by shape

## Decisions Made

- `oddsLine`'s you-part and it-part share one `safe(…, null)` wrapper rather than two separate guarded reads — `heroHitOddsVs` throwing on a minimal `c` is the same signal used to drop the whole line, so there's no separate "does this state have a hero" check duplicating that logic.
- `foeConditionEffect` reads `foeHitOddsVs(...).plainText` (not `.text`) for blind/weakened — the chip's own label already names the effect (Blind/Weakened), so the added clause shows only the range, never a redundant modifier list alongside it.
- The test file's local `effectLines(card)` helper (used only by section (d) and the new Phase 74 condition-effect tests) was changed from a fixed line-index offset to regex-based shape detection, so one helper serves both the pre-existing minimal-hero tests and the new full-hero tests without a second copy.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7 (per the project's deferred-UAT protocol — batched at milestone close, not a per-plan device pause):
- Long-press a foe mid-fight and confirm the card reads "You hit it on … · it hits you on …" right after the defence line (or right after HP with no defence line).
- With Sidestep live and after insulting a foe during parley, confirm the foe's side reads "(Sidestep +2, insulted −1)".
- Cast Weaken and confirm the card's Weakened effect line reads "it hits you only on 18–20 (d20)" followed by the unchanged Weakened description.

## Next Phase Readiness

- `src/browser/foeDetails.js` exports `foeConditionEffect` — Phase 77's CMBUI-13 effect indicators can reuse it directly instead of re-deriving anything, matching how 74-04's `rollOdds.js` was already designed to be reused here.
- 74-07 (hero condition-chip effects) and 74-08 (the consistency guard/copy-bank scans) have a stable, fully-tested `foeDetails.js` surface — the odds line and condition-effect strings are pinned exactly, so a divergence in either would be caught immediately.
- No blockers. No known stubs or deferred items from this plan.

---
*Phase: 74-roll-display-modifier-honesty*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: src/browser/foeDetails.js
- FOUND: test/unit/foeDetails.test.js
- FOUND: .planning/phases/74-roll-display-modifier-honesty/74-06-SUMMARY.md
- FOUND: 73950c4 (Task 1 commit)
- FOUND: 3f3c11d (Task 2 commit)
