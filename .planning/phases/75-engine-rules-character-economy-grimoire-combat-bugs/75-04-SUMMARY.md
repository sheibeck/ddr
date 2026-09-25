---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 04
subsystem: rules-engine
tags: [narration, event-narration, gear-sheet, armor, afflictions, voice, eventNarration, narrationLines]

# Dependency graph
requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "src/browser/rollRange.js (the one roll/modifier formatter) and the event-driven roll lines in both narration files, honored throughout"
  - phase: 28-armor-durability
    provides: "unequipSlot's existing destroyed-armor precedent (item descriptor + additive `destroyed: true`) this plan's new helper extends to the equip-side paths"
  - phase: 61-gear-lock
    provides: "gearLockReason/refuseGear — the combat gear lock every armor-replacing path in this plan already sits behind"
provides:
  - "Honest ailment 5-6 narration: AFFLICTIONS rows 5-6 (a disease of the mind that gives a phobia) narrate as a fear, never 'Disease.', on both the Oracle and the rail"
  - "engine/items.js#destroyedArmorPiece(c) — the one shared descriptor for a worn-but-destroyed armor piece, used by unequipSlot and all three armor-replacing paths"
  - "Additive `{ discarded, destroyed: true }` payload on itemEquipped (equipItem, takeLoot equip-now) and itemTaken (takeItem store delivery) when the outgoing armor piece is destroyed"
  - "Paired Oracle/rail lines naming the destroyed outgoing piece on itemEquipped/itemTaken"
  - "Gear sheet WORN armor slot: SWAP FOR candidates warn when the worn piece is destroyed, prefixing the existing comparison line"
affects: [75-13-fixture-inventory-summary, 75-11-staff-gear-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row-by-roll narration read (AFFLICTIONS[e.roll - 1].phobia) instead of trusting the event's own `kind` field, so presentation can diverge from the engine's dispatch bucket without an engine/content edit"
    - "Phase 25 additive-payload pattern extended to a THIRD sibling site (equipItem/takeLoot/takeItem) sharing one module-private helper (destroyedArmorPiece) so all four armor-destroy call sites (including the original unequipSlot) stay in lockstep"

key-files:
  created:
    - test/unit/ailment-narration.test.js
    - test/unit/destroyed-armor-swap.test.js
  modified:
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - engine/items.js
    - src/browser/gearSheet.js
    - test/unit/gear-sheet-model.test.js

key-decisions:
  - "afflictionRolled reads the row through AFFLICTIONS[e.roll - 1].phobia rather than adding a new engine field — presentation-only fix, engine/content untouched, zero parity risk since afflictionRolled never carries the row index directly, only the roll"
  - "destroyedArmorPiece(c) is read BEFORE the equip mutation in all three armor-replacing paths (mirrors the existing wornArmorItem-before-mutation timing) so the descriptor always reflects the piece being displaced, not the piece just equipped"
  - "discarded/destroyed and replaced are documented as mutually exclusive on itemEquipped (armor's destroyed branch never sets replaced; replaced only comes from the cloak/jewelry branch) and on itemTaken (wornArmorItem returns null for a destroyed piece, so replaced is never computed for one) — no event ever carries both"
  - "Gear sheet: the discarded warning PREFIXES the candidate's own enabled sub rather than replacing it, so the player still sees the comparison line; a greyed candidate keeps its own refusal reason untouched (per plan's must_haves)"

requirements-completed: [RULES-07, RULES-08]

coverage:
  - id: D1
    description: "An ailment roll of 5 or 6 narrates a fear of the mind (never 'Disease.') on both the Oracle and the rail; real Disease/Poison rows (1-4, 7, 8) keep their exact wording; a missing/out-of-range roll falls back to today's wording"
    requirement: "RULES-07"
    verification:
      - kind: unit
        ref: "test/unit/ailment-narration.test.js (10 tests: rolls 5, 6, 2, 8, 1, missing, zero, strip-span)"
        status: pass
      - kind: unit
        ref: "test/voice/safety-scan.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every armor-replacing path (equipItem, takeLoot equip-now, takeItem store delivery) additively reports a destroyed outgoing piece via destroyedArmorPiece(c); unequipSlot's own destroyed event stays byte-identical; a live-piece control per path is unchanged; each path is refused by the combat gear lock first"
    requirement: "RULES-08"
    verification:
      - kind: unit
        ref: "test/unit/destroyed-armor-swap.test.js (Task 2 section: 8 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/armor-durability.test.js"
        status: pass
      - kind: unit
        ref: "test/unit/loot-pile.test.js"
        status: pass
      - kind: unit
        ref: "test/unit/roll-high-guard.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Oracle and rail name the destroyed outgoing piece on itemEquipped/itemTaken, pairing in voice with the existing itemUnequipped destroyed line; the Gear sheet's WORN armor slot warns before an enabled SWAP FOR swap over a destroyed piece, prefixing the existing comparison line; a greyed candidate keeps its refusal reason; zero parity fixtures moved"
    requirement: "RULES-08"
    verification:
      - kind: unit
        ref: "test/unit/destroyed-armor-swap.test.js (Task 3 section: 7 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/gear-sheet-model.test.js (41 tests, incl. 2 new WORN-side destroyed/live tests)"
        status: pass
      - kind: unit
        ref: 'node --test "test/parity/**/*.test.js" (53/53 pass, zero fixture diff)'
        status: pass
      - kind: other
        ref: "npm test (6,014/6,014 pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 04: Honest Ailment Narration & Destroyed-Armor Swap Honesty Summary

**AFFLICTIONS rows 5-6 narrate as a fear instead of "Disease.", and every armor-replacing path (equip, loot equip-now, store delivery) now says when the outgoing piece was already destroyed — pairing with the existing unequip line and warning on the Gear sheet before the swap.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-25 (worktree base 4076858)
- **Completed:** 2026-09-25
- **Tasks:** 3
- **Files modified:** 7 (2 new test files, 5 modified)

## Accomplishments

- **RULES-07:** `afflictionRolled` in both `eventNarration.js` (Oracle) and `narrationLines.js` (rail) now reads `AFFLICTIONS[e.roll - 1].phobia` and, on rows 5-6, prints an in-voice mind line ("Not your body — your nerve.") instead of "Disease." — the engine and content are byte-for-byte unchanged (verified: `git diff --stat <base> -- engine/encounters.js content/afflictions.js` is empty). The real Disease (rows 2, 8) and Poison (rows 1, 3, 4, 7) rows print exactly as before. A missing or out-of-range roll falls back to today's wording rather than guessing.
- **RULES-08 engine:** a new module-private `destroyedArmorPiece(c)` helper in `engine/items.js` is the ONE shared descriptor for a worn-but-destroyed armor piece. `unequipSlot`'s existing destroyed branch now builds its item through this helper (event stays byte-identical). All three armor-replacing paths — `equipItem`'s armor branch, `takeLoot(i, true)`'s armor branch, and `takeItem`'s armor branch — now read the helper BEFORE the equip mutation and, when it returns a piece, spread `{ discarded: piece, destroyed: true }` onto the existing `itemEquipped`/`itemTaken` event. No new event type, no rng draw, no change to any state mutation.
- **RULES-08 surfaces:** `itemEquipped` and `itemTaken` in both narration tables gained a destroyed clause ("Your old Leather was already in pieces. You leave it where it fell." on the Oracle; a shorter rail twin), keyed on `e.destroyed`/`e.discarded`, placed beside the existing `itemUnequipped` destroyed lines so the two read as a pair. The no-payload strings are byte-identical to before (pinned by test). The Gear sheet's `GEAR_SHEET_COPY.sub.discarded` ("Your worn armor is destroyed — it will be discarded.") now prefixes every ENABLED SWAP FOR candidate's sub when the worn armor slot is destroyed; a greyed candidate keeps its own refusal reason untouched. The BAG-side "SWAP INTO ARMOR" scrap note is unchanged.
- Measured zero moved parity fixtures: `node --test "test/parity/**/*.test.js"` is 53/53 green and `git diff --quiet <base> -- test/parity/fixtures test/parity/prototype-master.js.txt` exits 0. `npm test` reports 6,014/6,014 passing (up from master's 5,986 — 28 new tests added across three files).

## Task Commits

Each task was committed atomically:

1. **Task 1: Honest ailment 5-6 narration (RULES-07)** - `607515b` (feat)
2. **Task 2: The destroyed-armor payload on every armor-replacing path (RULES-08 engine)** - `bbcf27f` (feat)
3. **Task 3: The paired lines and the Gear sheet note (RULES-08 surfaces); measure fixtures** - `d14be31` (feat)

_Note: Task 3's test additions to `test/unit/destroyed-armor-swap.test.js` were authored alongside Task 2's engine work in a single test file (per plan's own file list, both tasks target the same file); the file's Task-2-scoped tests (engine payload, gear-lock refusal, unequipSlot precedent — 8 tests) were verified green under Task 2's commit before Task 3's narration/Gear-sheet code landed on top of them in the following commit._

## Files Created/Modified

- `src/browser/eventNarration.js` - `afflictionRolled` reads AFFLICTIONS row by roll for the phobia clause (RULES-07); `itemEquipped`/`itemTaken` gain the destroyed-piece clause (RULES-08)
- `src/browser/narrationLines.js` - rail twins of both changes above
- `engine/items.js` - new `destroyedArmorPiece(c)` helper; `unequipSlot` refactored onto it; `equipItem`/`takeLoot`/`takeItem` armor branches gain the additive payload
- `src/browser/gearSheet.js` - new `GEAR_SHEET_COPY.sub.discarded`; WORN-target SWAP FOR loop prefixes the warning on enabled candidates when the slot is destroyed armor
- `test/unit/ailment-narration.test.js` - 10 tests pinning RULES-07 (created)
- `test/unit/destroyed-armor-swap.test.js` - 15 tests pinning RULES-08 across the engine payload, the paired lines, and the gear lock (created)
- `test/unit/gear-sheet-model.test.js` - 2 new tests: destroyed-worn-armor SWAP FOR warning, and the live-piece control

## Decisions Made

- `afflictionRolled` reads the row through `AFFLICTIONS[e.roll - 1].phobia` rather than adding a new engine field carrying the phobia flag directly on the event — keeps the fix presentation-only with zero engine/content diff and zero parity risk.
- `destroyedArmorPiece(c)` is read BEFORE the equip mutation in every caller (mirroring the existing `wornArmorItem`-before-mutation convention already used for `replaced`), so the descriptor always reflects the piece actually being displaced.
- `discarded`/`destroyed` and `replaced` are mutually exclusive by construction — armor's destroyed branch never sets `replaced` (the only `itemEquipped` `replaced` source is the cloak/jewelry branch), and `wornArmorItem` already returns null for a destroyed piece so `takeItem`'s `replaced` is never computed for one. No test needed to prove both keys can't co-occur; it's structurally impossible.
- Gear sheet: the discarded warning PREFIXES rather than replaces the candidate's sub, so the SWAP FOR row still shows the comparison line (AR/legality) alongside the warning — matches the plan's must_haves exactly ("followed by the comparison line").

## Deviations from Plan

None - plan executed exactly as written. Voice lines ("Not your body — your nerve.", "Your old Leather was already in pieces. You leave it where it fell.") are the plan's own suggested wording, used verbatim or near-verbatim per "Claude's Discretion: exact voice lines within the family-friendly deadpan voice" (75-CONTEXT.md).

## Issues Encountered

One early test-authoring mistake (not a plan issue): the initial ailment-narration test asserted a roll-0-with-kind-provided call would fall back to the generic "Something has its hooks in you" wording, but the correct behavior (per plan's own `<behavior>` spec — "never print a diagnosis the row does not give") is that an out-of-range roll with no matching row falls through to printing `e.kind` unchanged, exactly as it did before this plan (no row to read `phobia` from, so no override). Fixed the test assertion to match the specified behavior; no code change needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RULES-07 and RULES-08 are closed; ROADMAP Phase 75 criterion 5 holds for both.
- 75-13 (the Phase 75 FIXTURE-INVENTORY summary) can cite this plan's zero-fixture-move measurement directly.
- No blockers for sibling plans (75-01/02/03/05+) — this plan stayed entirely inside its declared `files_modified`.

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*

## Self-Check: PASSED

All created files found on disk (test/unit/ailment-narration.test.js, test/unit/destroyed-armor-swap.test.js, this SUMMARY.md) and all modified files found (src/browser/eventNarration.js, src/browser/narrationLines.js, engine/items.js, src/browser/gearSheet.js, test/unit/gear-sheet-model.test.js). All three task commit hashes (607515b, bbcf27f, d14be31) confirmed present in `git log --oneline -5`.
