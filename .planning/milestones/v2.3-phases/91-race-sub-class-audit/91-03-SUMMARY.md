---
phase: 91-race-sub-class-audit
plan: 03
subsystem: movement-identity
tags: [illusionist, teleport, pending-decision, save-load, bot, narration, identity, fixtures, ident-14]
requires:
  - phase: 90-spell-skill-audit
    provides: the Illusionist's starting book (Mirror Self, Door Illusion, one more Illusion spell) and the removal of Phantom Host
  - phase: 91-race-sub-class-audit (plans 01 and 02)
    provides: docs/IDENTITY-AUDIT.md rows, the identity-audit guard, the narrative-pass ledger pattern
provides:
  - "engine/movement.js: TELEPORT_REACH (12), TELEPORT_DIRS (8 rays), teleportReach, teleportTargets (explored squares only), autoTeleportLanding, landTeleport (the one landing tail), resolveTeleportPick; teleport() opens the pick for an Illusionist"
  - "state.pendingTeleport = { x, y, depth } (present only while a pick is open), the teleportPick action ({ x, y } | { auto: true }), the input hold in applyAction, tolerant save/load"
  - "events teleportPickOffered { count, auto } and teleportPickRefused { reason }; teleported gains picked / auto"
  - "the bot answers every pick with LET IT CHOOSE"
  - "traits illusionist-teleport (new text) and illusionist-book; SUB_NOTE.Illusionist states the pick"
  - "test/unit/teleport-pick.test.js (22 tests) and test/unit/teleport-pick-lines.test.js (7 tests)"
affects: [91-04, phase-92]
tech-stack:
  added: []
  patterns:
    - "a pending decision whose key exists only while the decision is open (nothing added to fresh states, fixtures or hashes)"
    - "the input hold at the applyAction boundary, like an invalid action (same state object, no events, nothing counted)"
    - "one landing tail shared by the rolled, picked and automatic teleports"
key-files:
  created:
    - test/unit/teleport-pick.test.js
    - test/unit/teleport-pick-lines.test.js
    - docs/narrative-pass/why/91-03.json
  modified:
    - engine/movement.js
    - engine/actions.js
    - engine/engine.js
    - engine/saveState.js
    - test/parity/harness/comparables.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/rail.js
    - tools/lib/tuning-bot.mjs
    - tools/lib/days-farm.mjs
    - tools/roll-high-baseline.mjs
    - content/identity.js
    - content/flavor.js
    - test/unit/movement.test.js
    - test/unit/actions.test.js
    - test/unit/identity-audit.test.js
    - docs/IDENTITY-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - test/parity/FIXTURE-INVENTORY.md
key-decisions:
  - "ORCHESTRATOR AMENDMENT built: the pick lists and accepts only reachable floor squares the hero has already explored (cell.seen); fog stays fog and nothing is revealed; with none explored in reach the pick still opens and offers only LET IT CHOOSE (teleportPickOffered count 0). Reach stays 12"
  - "The pick opens whenever any floor square at all is in reach (explored or not); only when the raw reach is empty does the teleport resolve at once by the automatic rule (hero stays put, travelled 0)"
  - "state.pendingTeleport exists ONLY while a pick is open (set on open, deleted on commit or refusal-as-stale); newRun and every non-pick state never carry it, so no fixture, save fixture or state hash gains a field. sanitizePendingTeleport adds it back only for a valid record, like pendingJoiner's presence rule"
  - "teleportPickOffered is classified like hazardChoice: ORACLE_ONLY on the line side with a RAIL_FAMILY entry (the card, built from state in 91-04, is the UI); teleportPickRefused is a rail refusal line (FEATURE_EVENTS)"
requirements-completed: [IDENT-14]
status: complete
duration: ~one session
completed: 2026-10-01
---

# Phase 91 Plan 03: The Illusionist picks where a teleport lands Summary

**An Illusionist who steps on a teleport now gets a pending pick instead of a landing: nothing moves and no rng value is drawn until the player picks a floor square the hero has already explored (up to 12 along any of 8 rays) or lets it choose (the old automatic landing); a save mid-pick restores it, every other action is held, and the bot answers LET IT CHOOSE. The measured fixture drift is zero.**

## What was built

- **The pending pick (Task 1).** `teleport()` for `c.sub === "Illusionist"` sets `state.pendingTeleport = { x, y, depth }` and pushes `teleportPickOffered { count, auto }` (`count`: the explored targets, `auto`: where LET IT CHOOSE would land). `teleportReach(state)` is every floor square in reach along the eight rays N, NE, E, SE, S, SW, W, NW (nearest first, a diagonal step is one square, a wall on a ray is skipped and the squares beyond it stay, never off the map, never the hero's own square); `teleportTargets(state)` is that list narrowed to `cell.seen` squares (the amendment). `autoTeleportLanding(state)` is the old Illusionist rule moved verbatim (`bestTeleportDir`, a fixed 12, the same fallback order). `resolveTeleportPick` handles `{ auto: true }` and `{ x, y }` (exact integer equality to a listed target) and refuses with `teleportPickRefused { reason }` (`none`, `stale`, `notATarget`), drawing nothing. `landTeleport` is the ONE landing tail: the rolled teleport, a pick and LET IT CHOOSE all end there (position, `pendingHazard` reset, reveal, `teleported`, terrain phobias, the landing square's dot or trap). A non-Illusionist teleport still draws two d8 then a d20 and its `teleported` event keeps its exact key set and order (pinned against a reference copy of the old algorithm on 8 seeds).
- **The action and the hold.** `teleportPick` is registered in `engine/actions.js` (valid for `auto: true` or finite `x`, `y`; a non-integer still reaches the engine's named refusal). `applyAction` returns the SAME state and no events for every action but `teleportPick` while `state.pendingTeleport` is set (nothing cloned, counted or drawn).
- **Save and load.** `sanitizePendingTeleport` keeps only a record with integer in-map `x`/`y`, `depth` equal to the floor's and the square equal to the hero's position; anything else loads as no pick, never a throw. Both load chains (`validateSave`, `rehydrate`) carry it; `serializeRun`'s spread persists it.
- **Carve-out.** `pendingTeleport` is stripped in all three comparables (`movementComparable`, `combatComparable`, `economyComparable`).
- **The bot (Task 2).** `decideAction` answers `state.pendingTeleport` first of all with `{ type: "teleportPick", auto: true }`. `tools/lib/days-farm.mjs` counts it as an open decision (the breaker must not turn a pick answer into a farmer move) and `tools/roll-high-baseline.mjs#isQuiet` never snapshots mid-pick.
- **Words (Task 2).** `teleportPickOffered` (Oracle only, classified like `hazardChoice`, plus `RAIL_FAMILY.teleportPickOffered`) says the teleporter hums and waits, how many squares glow (singular and the none case have their own lines) and that the player picks on the map or lets it choose. `teleportPickRefused` has an Oracle line and a rail block line per reason. `teleported` has a picked voice (compass word and distance, `COMPASS_WORD` in `content/flavor.js`), a let-it-choose voice and the unchanged rolled voice.
- **Traits.** `illusionist-teleport` states the pick (explored floor squares up to 12 away in the 8 directions, or let it choose); new `illusionist-book` states Phase 90's starting book, proof `test/unit/illusionist-book.test.js`. `SUB_NOTE.Illusionist` says the pick, the book and the d20 and names no Phantom Host.
- **Docs.** `docs/IDENTITY-AUDIT.md`: `illusionist-teleport` reads `fixed engine (91-03)`, `illusionist-book` `fixed text (91-03)`, with Pinned by. `docs/narrative-pass/why/91-03.json` (8 rows, each `after` from the live corpus) and the regenerated review pages (`--check` in sync).

## Start-of-plan check: callers of teleport()

`grep -n "teleport(" engine/` finds three callers: `resolveFeature`'s "tele" branch (a step, and `resolvePendingTile`'s resumed tile), `encounterDot`'s `Teleport` result, and `goInsane` (r === 3). **No Phase 90 spell calls `teleport()`**: Door Illusion's escape and every other spell never reach it, so a pick can never open while a fight is live (the map is always on screen). Note: the encounter tables no longer contain a `Teleport` result (E1, `content/encounters.js`), so `encounterDot`'s `case "Teleport"` is dead code that still routes through the same function; the live callers are the tele tile (a step or a resumed tile) and insanity, both pinned.

## Fixture drift (IDENT-14)

Measured, declared in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 91 plan 03"): **zero drift, nothing re-recorded.**

- `node --test "test/parity/**/*.test.js"`: 66 of 66 pass, no declaration needed (no parity script has an Illusionist on a tele tile).
- `roll-high-state-pins.test.js` and `roll-high-save-compat.test.js`: 13 of 13 pass; 0 of 8 labels moved (no pin run is an Illusionist), the save-compat hash did not move. `roll-high-baseline.mjs save` was never run.
- `roll-high-guard`, `roll-high-helper`, `shell-tab-snapshots` (11), `save-resume`, `save-validation`, `test/determinism`, `test/persistence`, `test/roundtrip`: 215 of 215 pass.
- Predictor (stated in the inventory): only an Illusionist whose path steps on a teleport gains one extra validated action per teleport (`acts` and every stream keyed on it shift from there); a scratch scan of 40 forced-Illusionist bot runs (600 actions, not a balance run, nothing recorded) reached a teleport in 35 and answered 92 picks, so any future Illusionist fixture or pin will move by that extra `acts`. None does today.
- One test moved with the rule, declared with before/after: `movement.test.js` "teleport: an Illusionist chooses their best direction and travels a fixed 12" (before: one `teleport()` call landed at (17, 5); after: it opens the pick with no move and no draw, and LET IT CHOOSE lands at (17, 5) with the same `dist` and `used` plus `auto: true`). `identity-audit.test.js`: `illusionist-book` left the pre-registered list (a live `identityEntries` id now).
- `test/parity/prototype-master.js.txt` untouched (`git diff --stat` empty).

## Tests run (rule 4: no full `npm test`)

Task 1 set (teleport-pick, movement, actions, hazard-decision, save-validation, save-resume, parity glob): 247 pass. Task 2 set (teleport-pick-lines, teleport-pick, narrationLinesCoverage, formatEventsCoverage, narrationLinesTable, voice-corpus, narrative-review, safety-scan, stale-terms, identity-footer, identity-audit, identity-contract, illusionist-book, casters-can-act, hp-not-wp, tuning-bot): 326 pass; `node tools/narrative-review.mjs --check` exit 0. Task 3 set (parity glob 66; roll-high pins and save-compat 13; guard/helper/snapshots/save/determinism/persistence/roundtrip 215): all pass. Every other test file that mentions `teleport` or `Illusionist` (22 files, 888 tests): all pass. `teleport-pick.test.js` has 22 tests, `teleport-pick-lines.test.js` 7; total fail 0 everywhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan inaccuracy] The map is 21x21, not 25x25**
- **Found during:** Task 1 tests
- **Issue:** the plan's behavior bullet ("on an open 25x25 room the list has 8 x 12 entries") cannot hold: `GW = GH = 21`, so the playable square is 19x19 and no ray from a real square is 12 long in every direction.
- **Fix:** the targets test asserts the east ray from (7, 10) holds exactly 12 squares nearest first, the ray order, the diagonal one-square step, the wall-skip and the bounds instead of an 8 x 12 count. Reach stays 12.
- **Files modified:** test/unit/teleport-pick.test.js

**2. [Rule 2 - Missing critical functionality] The bot loops that read pending decisions**
- **Found during:** Task 1
- **Issue:** `tools/lib/days-farm.mjs` lists the open decisions its breaker must not interrupt, and `tools/roll-high-baseline.mjs#isQuiet` lists the states it must not snapshot; neither knew `pendingTeleport` (a pick answer could become a farmer move the engine then holds).
- **Fix:** one line each. Neither file was in the plan's file list.
- **Commit:** 91af1599

**3. [Rule 3 - Blocking] The identity-audit guard's pre-registered list**
- **Found during:** Task 2
- **Issue:** `illusionist-book` became a live `identityEntries` id, so `test/unit/identity-audit.test.js`'s PRE_REGISTERED list (which pins it as `ruled -> 91-03`) failed, exactly as 91-02 handled its two built traits.
- **Fix:** removed the entry with a comment. The audit-doc edit that Task 3 lists was done in Task 2's commit because the guard needs it to pass.
- **Commit:** 63f8eba4

**4. [Plan reading] teleportPickOffered's rail twin**
- **Found during:** Task 2
- **Issue:** the plan asks both for a rail line "Teleport: pick a glowing square, or let it choose." and for classifying `teleportPickOffered` exactly as `hazardChoice` (ORACLE_ONLY, which the coverage guard makes disjoint from LINE_FOR).
- **Fix:** followed the explicit classification: ORACLE_ONLY plus a `RAIL_FAMILY.teleportPickOffered` entry (hazardChoice's own twin shape), so no rail toast duplicates the decision card; the card text is 91-04's. `rail.js` was not in the plan's file list.

**5. [Fact] The Oracle corpus cannot render the picked and let-it-choose voices**
- `tools/lib/event-variants.mjs` is frozen after 79-01, so the corpus (and the review page) show only the rolled `teleported` line. The picked and auto lines are pinned in `teleport-pick-lines.test.js` instead.

**6. [Fact] The encounter-table Teleport result no longer exists**
- The plan's "encounterDot's Teleport result opens the pick" test cannot be driven (E1 removed it from the tables); the resumed-tile caller (`resolvePendingTile`) and `goInsane` are pinned instead. `encounterDot`'s case is dead code left alone.

## Known Stubs

None. The map highlight, the tap and the decision card are plan 91-04 (the engine lists the squares and holds the pick; nothing is a placeholder).

## Threat Flags

None. The new action is validated at the wire boundary and re-validated by the engine (exact integer equality to a recomputed target list); the saved record is sanitized on load and never trusted.

## Human verification (deferred to end of run)

For the batched Pixel 7 checklist at milestone close (the card and the map are 91-04):

1. As an Illusionist, step on a teleport: nothing moves until you choose, and the Oracle says the teleport is waiting for you.
2. Quit the app mid-pick and relaunch: the pick is still waiting.

## Commits

- 91af1599: feat(91-03): an Illusionist's teleport waits on a pick of explored squares (IDENT-14)
- 63f8eba4: feat(91-03): narrate the teleport pick and state the Illusionist's choice and book (IDENT-14)
- 20cf2a2b: docs(91-03): declare the measured zero fixture drift of the teleport pick (IDENT-14)

## Self-Check: PASSED

Created files present (`teleport-pick.test.js`, `teleport-pick-lines.test.js`, `docs/narrative-pass/why/91-03.json`, this SUMMARY); the three commit hashes above exist on the branch; `test/parity/prototype-master.js.txt` is unchanged; STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.
