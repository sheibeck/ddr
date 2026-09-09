---
phase: 04-mobile-presentation-controls-onboarding
plan: DR12 (device-review revision round 12 — Warlock potion-duplication rules change + "Maze" -> "Dungeon" player-facing text sweep, from live user direction — ad hoc, not a numbered PLAN.md)
subsystem: rules-engine, presentation
tags: [device-review, deliberate-rules-change, warlock, copy-sweep, terminology]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "engine/movement.js's newDay() upkeep tick (ENG-01/ENG-05), which this round's Warlock change edits at its existing per-day seam"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "content/epitaphs.js, content/flavor.js, content/races.js, src/browser/eventNarration.js, engine/death.js (the modern extracted engine/content modules this round's copy sweep updates)"
provides:
  - "Warlock subclass now duplicates a potion on EVERY newDay tick (was: gated to once every 7 days) — a deliberate design change, not a fidelity bug"
  - "All player-facing 'Maze'/'the maze' prose replaced with 'Dungeon'/'the dungeon', and 'Maze Master' replaced with 'Game Master', across epitaphs, race/class/subclass flavor notes, in-run narration, the Hero screen's dossier heading, and the engine's death-note fallback string"
  - "gameName.js's branding comment updated to reflect the Game Master rename while keeping 'Mazeworld' itself as the untouched in-fiction world/product-lore name"
affects: []

tech-stack:
  added: []
  patterns:
    - "Deliberate rules deviations from the frozen prototype reference (test/parity/prototype-master.js.txt) are made ONLY in the live engine module (engine/movement.js), with a code comment at the change site explaining why the frozen reference is deliberately left untouched — the reference documents the ORIGINAL 1994 rule for fidelity history, not the current live rule."
    - "A player-facing terminology sweep across a strangler-fig migration (mazeworld.html's classic <script> + the newer engine/content/*.js modules it's being replaced by) must classify EVERY hit before touching it: code identifiers/CSS classes/ids/data-attributes/object keys are never player-visible and must be left alone even when they share the same English word as visible copy sitting one line away."
    - "Before editing text inside mazeworld.html's classic <script>, trace whether the enclosing function is still reachable — `window.move`/`window.__mzState.set()` bridge assignments in the trailing `<script type=\"module\">` block silently overwrite classic globals (`window.move = engineMove`, etc.), making large stretches of the classic script (move(), teleport(), encounterDot(), springTrap(), classic die()/winGame(), classic newDay()) unreachable dead code even without an explicit 'dead code' comment at every site."

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR12-SUMMARY.md
  modified:
    - engine/movement.js
    - content/flavor.js
    - content/epitaphs.js
    - content/races.js
    - engine/death.js
    - src/browser/eventNarration.js
    - src/browser/gameName.js
    - mazeworld.html

key-decisions:
  - "Changed the Warlock's potion-duplication cadence from weekly (`state.day - dupAt >= 7`) to daily by simply dropping the `>= 7` gate at engine/movement.js's existing newDay() seam — no new state field, no raw mutation outside the engine, `GameState.rngState` untouched. `dupAt` itself is retained (still set every trigger) purely for save-shape stability even though the cadence gate it backed no longer exists."
  - "Left test/parity/prototype-master.js.txt (the frozen 1994-rule reference) completely untouched, per the project's fidelity constraint: it documents the ORIGINAL rule for history/parity-test purposes, and this Warlock change is an intentional, user-directed deviation from it, not a regression to fix. Confirmed via the fixture registry that no parity fixture (movement/combat/economy/encounters/magic/chargen) drives a Warlock through multiple newDay ticks, so this deviation has zero parity-test blast radius — no fixture needed updating."
  - "Treated 'Built from the Mazeworld rulebook' (mazeworld.html's credit line, linking to mazeworld.pdf) as an untouched proper-noun/title reference — the same category as the excluded file names/paths (mazeworld.html, mazeworld.pdf) — rather than generic 'maze' prose, since it names the real-world tabletop rulebook the game is built from, not the in-fiction dungeon."
  - "Left every CAUSE_TEXT/EPITAPHS lookup KEY named `maze` (the death-cause identifier, e.g. `EPITAPHS.maze`, `die(state, \"maze\", ...)`) unchanged — only the STRING VALUES those keys map to were reworded. Renaming the key itself would be an internal identifier change out of scope for a text-only sweep and would touch save-shape/cause-comparison code paths unnecessarily."
  - "Applied the sweep to BOTH the live engine/content copies (content/epitaphs.js, content/flavor.js, content/races.js, src/browser/eventNarration.js, engine/death.js's deathNote fallback) AND mazeworld.html's classic-script mirrors of the same tables, even after confirming most of the classic script's game-LOGIC call chain (move()/newDay()/die()/winGame()/teleport()/encounterDot()) is dead code superseded by the engine module's `window.move`/`window.__mzState.set()` bridges. Rationale: RACE_NOTE/CLASS_NOTE/SUB_NOTE ARE still live (directly read by the still-active classic `paint()` render function for the Hero-screen dossier), so at minimum those three tables needed the edit regardless; syncing the remaining (confirmed-dead) EPITAPHS/CAUSE_TEXT mirrors too avoids leaving stale, contradictory copy sitting next to the live version for a future reader or cleanup pass to trip over."
  - "Updated gameName.js's branding doc-comment to note the Maze Master -> Game Master rename, while explicitly preserving its statement that 'Mazeworld' survives as the in-fiction world/product-lore name unaffected by GAME_NAME (\"Delve, Die, Repeat\") — the rename applies to the narrator TITLE ('the Maze Master'), not the world's proper-noun name."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1 through 04-DR11-SUMMARY.md's own precedent.

duration: ~50min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR12: Warlock potion cadence change + Maze -> Dungeon text sweep Summary

Two independent changes from live user direction, each its own atomic commit. (1) A deliberate game-rules change: the Warlock subclass's potion-duplication ability now fires on EVERY newDay tick instead of being gated to once every 7 days, changed at engine/movement.js's existing newDay() seam with no new raw state mutation and `GameState.rngState` untouched; the frozen prototype reference (test/parity/prototype-master.js.txt) is deliberately left as-is since it documents the original 1994 rule, and no parity fixture exercises a Warlock across multiple newDay ticks so the change has zero parity blast radius. (2) A player-facing text sweep replacing "Maze" -> "Dungeon" and "Maze Master" -> "Game Master" everywhere the words appear as visible copy — epitaphs, race/class/subclass flavor notes, in-run narration strings, the Hero screen's "Maze Master's notes" heading (now "Game Master's notes"), and the engine's death-note fallback text — while leaving every code identifier, CSS class, id, data-attribute, lookup key, file name, and the dark maze-canvas palette untouched.

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-08
- **Items:** 2 (Warlock potion cadence; Maze -> Dungeon text sweep) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** `engine/movement.js`, `content/flavor.js`, `content/epitaphs.js`, `content/races.js`, `engine/death.js`, `src/browser/eventNarration.js`, `src/browser/gameName.js`, `mazeworld.html`

## Accomplishments

### Item 1 — Warlock potion duplication: weekly -> daily (`f3579eb`)

1. `engine/movement.js`'s `newDay()` upkeep tick: the Warlock potion-duplication condition changed from `c.sub === "Warlock" && state.day - (c.dupAt || 0) >= 7 && c.potions > 0` to `c.sub === "Warlock" && c.potions > 0` — the ability now fires every newDay tick a Warlock has at least one potion, instead of only every 7th day.
2. A code comment at the change site documents this as a DELIBERATE rules deviation (not a fidelity bug), names the plan (04-DR12), and explains that the frozen prototype reference is intentionally left untouched.
3. `c.dupAt` is still assigned on every trigger (retained for save-shape stability) even though the weekly gate it originally backed no longer exists.
4. `content/flavor.js`'s `SUB_NOTE.Warlock` flavor text updated from "a potion copied every week" to "a potion copied every day" for consistency with the new live behavior.
5. Confirmed via a direct check of all five parity fixtures (movement/combat/economy/encounters/magic, plus chargen) that none drive a Warlock through more than one `newDay` tick — the movement fixture's single triggered `newDay` rolls a Cat Burglar (seed 256), not a Warlock — so no parity fixture needed regenerating.

### Item 2 — "Maze" -> "Dungeon" / "Maze Master" -> "Game Master" text sweep (`c010c93`)

1. `mazeworld.html`'s Hero screen: `<h2>The Maze Master's notes ...</h2>` -> `<h2>The Game Master's notes ...</h2>`.
2. `content/flavor.js`'s `RACE_NOTE`/`SUB_NOTE` entries (Human, Fridgian, Pilfer, Illusionist, Cleric) and `mazeworld.html`'s classic-script mirrors of the same tables: "the maze" -> "the dungeon", "the Maze Master" -> "the Game Master".
3. `content/epitaphs.js`'s `EPITAPHS` bank (combat/starve/trap/teleport/maze/won/abandon categories) and `CAUSE_TEXT.maze`, plus `mazeworld.html`'s classic mirrors of both: every visible "the maze"/"a maze"/"Maze Master" string reworded; the `maze:` object KEYS themselves (the death-cause identifier) were left unchanged in both files.
4. `content/races.js`'s `RACES.Human.note`: "The maze's default." -> "The dungeon's default." (and its `mazeworld.html` mirror).
5. `engine/death.js`'s `die()` fallback deathNote string: "killed by something the maze did not name" -> "killed by something the dungeon did not name" (the LIVE engine code path — confirmed no test asserts the old exact string), plus `mazeworld.html`'s classic (dead-code) mirror of the same fallback and its `CAUSE_TEXT.maze` value.
6. `src/browser/eventNarration.js`: two narration strings ("The maze keeps no such courtesy for you." on spell-charge recovery; "the maze does not offer refunds." on teleport) reworded to "dungeon".
7. `mazeworld.html`'s remaining classic-script narration: the teleport out-of-bounds message, the "The maze takes an interest" (Table Four) event title, and the delve-resumed boot narration ("...on floor N of the maze.") all reworded to "dungeon".
8. `src/browser/gameName.js`'s branding doc-comment updated to note the Maze Master -> Game Master rename while explicitly preserving "Mazeworld" as the untouched in-fiction world/product-lore name.
9. Left untouched (verified by classification, not blanket skip): every `id="maze"`/`data-tab="maze"`/`data-screen="maze"` DOM identifier, every `.mazebox`/`.mazefoot`/`.mw-maze-viewport`/`.col-maze` CSS class, `MAZE_CANVAS_COLORS` and its surrounding dark-canvas-palette code/comments (explicitly out of scope per the plan), `window.__mzShowTab?.("maze")` and other JS identifiers, every `mazeworld.html`/`mazeworld.pdf` file-name reference in comments and the credit-line link, and the `EPITAPHS.maze`/`CAUSE_TEXT.maze` lookup keys.

## Task Commits

1. **Item 1 — Warlock potion duplication fires daily instead of weekly** — `f3579eb` (feat)
2. **Item 2 — Player-facing text sweep, Maze -> Dungeon / Maze Master -> Game Master** — `c010c93` (docs)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next item's edits began.

## Files Created/Modified

- `engine/movement.js` — Warlock potion-duplication cadence gate removed (weekly -> daily) at the `newDay()` seam, with a deviation-documenting code comment.
- `content/flavor.js` — Warlock `SUB_NOTE` cadence text ("week" -> "day"); Human/Fridgian/Pilfer/Illusionist/Cleric `RACE_NOTE`/`SUB_NOTE` "maze"/"Maze Master" -> "dungeon"/"Game Master".
- `content/epitaphs.js` — `EPITAPHS` bank and `CAUSE_TEXT.maze` visible strings reworded (keys unchanged).
- `content/races.js` — `RACES.Human.note` reworded.
- `engine/death.js` — `die()`'s deathNote fallback string reworded (live engine code path).
- `src/browser/eventNarration.js` — two narration strings reworded (spell-charge recovery, teleport).
- `src/browser/gameName.js` — branding doc-comment updated for the Game Master rename.
- `mazeworld.html` — Hero screen "Maze Master's notes" heading; classic-script mirrors of `RACE_NOTE`/`CLASS_NOTE`/`SUB_NOTE`/`EPITAPHS`/`CAUSE_TEXT` (including the Warlock cadence-consistency fix); teleport/Table-Four/boot-resume narration strings; Warlock potion-duplication ability logic was NOT touched here (it lives solely in `engine/movement.js`, confirmed as the only live copy — see Deviations).

## Decisions Made

See `key-decisions` in the frontmatter above (daily-cadence gate removal + `dupAt` retention; leaving the frozen prototype reference untouched with zero parity blast radius; "Mazeworld rulebook" credit-line treated as a proper noun, not swept; `maze` lookup KEYS left unchanged, only VALUES reworded; syncing both live and confirmed-dead `mazeworld.html` mirrors for consistency; `gameName.js` comment update preserving "Mazeworld" as the untouched world name).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Consistency bug] `mazeworld.html`'s classic SUB_NOTE mirror still said "potion copied every week" after the Item 1 commit**
- **Found during:** Item 2 (text sweep), while auditing every "maze" hit in `mazeworld.html`.
- **Issue:** `content/flavor.js`'s Warlock flavor text was correctly updated to "every day" in Item 1's commit, but `mazeworld.html`'s own classic-script duplicate of the same `SUB_NOTE` table (a strangler-fig-era leftover, still read live by the classic `paint()` render function for the Hero-screen dossier) was missed and still read "every week."
- **Fix:** Updated `mazeworld.html`'s `SUB_NOTE.Warlock` string to match `content/flavor.js`'s "every day" wording.
- **Files modified:** `mazeworld.html`.
- **Commit:** `c010c93` (folded into the Item 2 commit, since it's a copy-consistency fix discovered during the text-sweep pass, not a gameplay-logic change).

No architectural questions arose (Rule 4 not triggered) — both items were scoped exactly as described in the live-user direction, and every discovered edge case (dead-code classification in `mazeworld.html`, the `maze` lookup-key vs. value distinction, the "Mazeworld rulebook" proper-noun exclusion) was resolved by careful reading rather than requiring a design decision.

## Known Stubs / Threat Flags

None. Item 1 is a rules-value change made entirely through the existing engine seam (no new state shape, no raw mutation, `GameState.rngState` untouched). Item 2 is copy-only (no new network endpoints, auth paths, file-access patterns, or schema changes at a trust boundary).

## Verification

- `npm run build:www` — succeeds after both commits.
- `npm test` — **494/494 green**, unchanged from the pre-existing baseline, at every checkpoint (both commits).
- `npm run test:quick` — **405/405 green**, unchanged from the pre-existing baseline, at every checkpoint.
- `node --check` on every modified `.js` file — all parse cleanly.
- Confirmed via targeted `grep` that no unit or parity test asserts the exact old strings this round changed (`epitaphFor falls back to the maze bank for an unknown cause` and `die('maze')` tests assert the death-cause KEY `"maze"`, which is unchanged, not the reworded prose).
- No `npx cap sync`/gradle run, per the plan's explicit instruction — the orchestrator handles the device build.
- Self-check below confirms every claimed file/commit exists.
- **Not verified here (on-device UAT deferred):** the Hero screen's "Game Master's notes" heading, in-run narration copy, and the Warlock's now-daily potion cadence "feel" on an actual multi-day run on the Pixel 7 build — per this project's `mvp — autonomous run` mode, on-device visual/gameplay verification is deferred to the orchestrator's next device build, consistent with every prior `04-DR*` round.

## Self-Check: PASSED

- FOUND: `engine/movement.js` — `if (c.sub === "Warlock" && c.potions > 0) {` (weekly gate removed).
- FOUND: `content/flavor.js` — `"a potion copied every day"` in `SUB_NOTE.Warlock`.
- FOUND: `content/epitaphs.js` — `"The Game Master notes that running was..."`, `"The dungeon did not kill {name}..."`.
- FOUND: `content/races.js` — `"The dungeon's default."`.
- FOUND: `engine/death.js` — `"killed by something the dungeon did not name"`.
- FOUND: `src/browser/eventNarration.js` — `"The dungeon keeps no such courtesy for you."`, `"the dungeon does not offer refunds."`.
- FOUND: `src/browser/gameName.js` — updated doc-comment noting the Game Master rename.
- FOUND: `mazeworld.html` — `<h2>The Game Master's notes`, `"a potion copied every day"` (SUB_NOTE.Warlock mirror), `"The dungeon takes an interest"`.
- FOUND commit `f3579eb` (feat(04-DR12): Warlock potion duplication fires daily instead of weekly).
- FOUND commit `c010c93` (docs(04-DR12): player-facing text sweep, Maze -> Dungeon / Maze Master -> Game Master).
- FOUND: `npm test` 494/494 and `npm run test:quick` 405/405 at final state.

## Next Phase Readiness

- Both DR12 items are complete and test-green; ready for on-device UAT on the next Pixel 7 build — specifically confirming the Warlock's daily potion gain over a multi-day run, and spot-checking the Hero screen's "Game Master's notes" heading and a few in-run "dungeon" narration lines against the design mock's tone.
- No blockers.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
