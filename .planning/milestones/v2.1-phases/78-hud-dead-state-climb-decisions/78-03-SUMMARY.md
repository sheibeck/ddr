---
phase: 78-hud-dead-state-climb-decisions
plan: 03
subsystem: shell-rail
status: complete
tags: [CLIMB-01, CLIMB-02, rail, decision-card, odds, map-marks]
requirements: [CLIMB-01, CLIMB-02]
dependency-graph:
  requires:
    - "78-01: state.pendingHazard { feat, dir, tool }, the resolveHazard action, pure hazardOdds, turnedBack narration"
    - "78-02: the text-scale rule (no new font sizes were added here)"
  provides:
    - "src/browser/hazardCard.js (HAZARD_CARD_COPY, hazardCardViewModel)"
    - "src/browser/rollOdds.js#hazardOddsText and HAZARD_ODDS_COPY"
    - "window.__mzRailVM.hazardCard and window.mzResolveHazard(cross)"
    - "RAIL_FAMILY.turnedBack (TURNED BACK, feat-based icon)"
    - "the one-and-done wall/crevice copy in MARKS_LEGEND"
  affects:
    - "78-04 (the relaunch probe still answers a pending hazard with a move; the card itself now dispatches resolveHazard)"
tech-stack:
  added: []
  patterns:
    - "decision card built by a pure view model from an engine pending record, read through the existing __mzRailVM bridge object"
    - "card buttons answer their own record directly instead of sitting behind railLocked()"
key-files:
  created:
    - src/browser/hazardCard.js
    - test/unit/hazard-card.test.js
  modified:
    - src/browser/rollOdds.js
    - src/browser/rail.js
    - src/browser/mapMarks.js
    - mazeworld.html
    - test/unit/harness/shellSandbox.js
    - test/unit/rollOdds.test.js
    - test/unit/rail.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/mapMarks.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-gear-39.test.js
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/shell-armor-display.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/shell-combat-over.test.js
    - test/unit/shell-loot-screen.test.js
decisions:
  - "Button order is [CLIMB IT / LEAP IT, USE LADDER / USE ROPE (only while carried), TURN BACK]; TURN BACK is last and the only secondary-styled button"
  - "The card shows the honest spread, not one number: a climb's most common per-10-ft range with each differing wall kind named, and a leap's narrowest-gap range down to its widest"
  - "Penalties sit on the odds line's second row as 'Heights −2, armour −1, already counted', because the ranges already include them"
  - "mzUseTool and mzResolveHazard answer only a live pending record (and nothing covering the map) instead of railLocked(), which now covers the hazard itself"
  - "The card's key includes whether the tool is carried, so the buttons re-arm if the bag changes"
metrics:
  duration: "about 75 min"
  completed: 2026-09-26
  tasks: 3
  files: 19
---

# Phase 78 Plan 03: The wall/crevice decision card on the rail (CLIMB-01/02) Summary

Stepping toward a wall or crevice now shows one decision card on the rail: CLIMB IT or LEAP IT with the engine's own odds, USE LADDER or USE ROPE while the tool is carried, and TURN BACK. It locks movement until answered, and nothing is rolled until the player commits. The post-fall retry card is gone, and the MARKS legend describes the choice and one-and-done.

**Plan base SHA:** `c6de10dba86725e0c64e03aab460be96cf5bc3b6`

## COMMITS WERE BLOCKED: nothing from this plan is committed

My first `git commit` (the TDD RED commit) was refused by the Claude Code auto-mode permission classifier with the reason "[Modify Shared Resources]". The denial said not to retry the same outcome by any route, so I made no further commit attempts. All the work is in the worktree:

- **Staged (index):** `test/unit/hazard-card.test.js`, `test/unit/rail.test.js`, `test/unit/rollOdds.test.js`. These are the RED-stage versions; the working tree has later edits on top.
- **Unstaged or untracked:** every other file in key-files above, plus this SUMMARY. `src/browser/hazardCard.js` is untracked.

The orchestrator (or the user) needs to commit these files. The intended per-task split is below. The files overlap between tasks, so one commit for the plan is the practical option.

| Task | Intended commit | Files |
|---|---|---|
| 1 (RED) | `test(78-03): add failing tests for the pre-roll hazard card and its odds` | hazard-card.test.js, rollOdds.test.js, rail.test.js |
| 1 (GREEN) | `feat(78-03): the hazard card view model and its honest odds` | hazardCard.js, rollOdds.js, rail.js, hp-not-wp.test.js |
| 2 | `feat(78-03): the decision card on the rail; the lock; the retry card retired` | mazeworld.html, shellSandbox.js, the shell-*.test.js files, hazard-card.test.js |
| 3 | `feat(78-03): MARKS copy describes the choice and one-and-done` | mapMarks.js, mapMarks.test.js |
| docs | `docs(78-03): complete the hazard decision card plan` | this SUMMARY |

## What was built

### Task 1: the card's view model and its honest odds
- **`src/browser/rollOdds.js#hazardOddsText(state, feat)`** reads `engine/movement.js#hazardOdds`, which uses the same `climbFacesFor`/`leapFacesFor` helpers as the roll. It formats only through rollRange.js (`facesRangeText`, `dieText`, `modsText`) and adjusts no face count. It returns `{ feat, dieN, die, cases[{label, faces, range}], range, others, wide, rolls, penalties, penaltyText, text }`, or null for an unknown feat or a missing hero. The templates are in the frozen `HAZARD_ODDS_COPY`.
- **`src/browser/hazardCard.js`**:
  - `HAZARD_CARD_COPY` holds every card string.
  - `hazardCardViewModel(state, deps)` returns null when there is no record, an unknown feat, combat, an open store, or a dead hero. Otherwise it returns `{ key, feat, dir, tool, carried, icon, iconKey, title, intro, lines, buttons }`.
  - The tool is read live with `hasTool` (`deps.hasTool` can override it), never from the event's `carried`.
- **`src/browser/rail.js`**:
  - `RAIL_COPY.climb` and `RAIL_COPY.hazard` are deleted; `RAIL_COPY.dark.torch` stays.
  - `RAIL_FAMILY.turnedBack` is `{ icon: "⧗", title: "TURNED BACK", tone: "dull" }`.
  - `railCardFor` gives turnedBack the same `.feat`-based icon as toolUsed and draggedOver (climb is the wall icon, gorge the crevice icon).
- Both new copy banks are registered in hp-not-wp.test.js's wp/WP walk and its BANNED voice scan.

### Task 2: the card on the rail, the lock, and the retry card retired
- **Module script:**
  - It imports `hazardCardViewModel` and adds it to the existing `window.__mzRailVM` object as `hazardCard`. No new `__mz` name was added, and bridge-registry passes.
  - New `window.mzResolveHazard(cross)`: it does nothing unless `S.pendingHazard` is set and `hasActiveEncounter()` is false. Otherwise it calls `stepWith({ type: "resolveHazard", cross: cross === true })`, which runs the narration, haptics, paint, keep-in-view and glide.
  - `window.mzUseTool` now dispatches only for a live record with the same tool and dir. It no longer checks `railLocked()`, because that would always refuse the card's own button.
- **`stepWith`:**
  - A fall (`fellClimbing`/`fellInGorge`) no longer sets a climb/gorge `window.__mzRail.pending`. The dark card's torch offer is unchanged: `pending: state.dead ? null : darkFell && torch ? { kind: "dark" } : null`.
  - The pending-narration stash now reads `state.pendingHazard` alone (the `declined` flag is retired).
- **Classic `renderRail`:**
  - The first branch is `const hz = S.pendingHazard && vm.hazardCard ? vm.hazardCard(S) : null; if (hz) {...}`.
  - The card's lines are the step's narration (or the card's intro line on a relaunch) followed by `hz.lines`.
  - Button acts map to literal ids: `a-hazard-cross` → `mzResolveHazard(true)`, `a-hazard-tool` → `mzUseTool(b.tool, hz.dir)`, `a-hazard-back` (secondary) → `mzResolveHazard(false)`.
  - The post-fall retry branch (`mw-rail-climb`, `mw-rail-tool`) is deleted.
- **Classic `railLocked()`** now also covers `S.pendingHazard && !S.store` (out of combat). As a result, a map tap, an arrow key, camp or marks all pulse the card, and `dismissKind` classifies it as `locked`, so a body tap never dismisses it.
- Stale comments were rewritten: railLocked, engineMove, stepWith's header and the back-button `getGameContext` comment.

### Task 3: the MARKS copy
The `crevice` and `wall` rows of `MARKS_LEGEND` are rewritten, with a CLIMB-02 header comment. The hold-inspect card reads the same rows through `legendFor`.

## Voice record (final copy)

**Card (HAZARD_CARD_COPY):**
- Titles: "A WALL" / "A CREVICE"
- Intro lines (shown on a relaunch; a live step shows the hazardChoice narration instead): "A wall. You could climb it. You could also not." / "A crevice. Leaping is traditional. Rope is smarter."
- Odds line template: "{label}: {odds}." Penalty row: "{mods}, already counted"
- Fall line: "Miss a roll and you fall. Falling hurts."
- One-and-done line: "Hurt or not, you end up on the far side. One try, no encores."
- Tool lines: "USE LADDER: up and over, no roll. The ladder stays behind." / "USE ROPE: across, no roll. The rope stays behind."
- TURN BACK line: "TURN BACK: nothing rolled, nothing spent, nothing proved."
- Buttons: CLIMB IT / LEAP IT, USE LADDER / USE ROPE, TURN BACK

**Odds strings (HAZARD_ODDS_COPY, pinned in tests):**
- Fighter at a wall, no penalty: "CLIMB IT: 4–10 on a d10 for each 10 ft (rock: 5–10), 2 or 3 rolls."
- Magic User at a crevice: "LEAP IT: 2–10 on a d10 for a 3–4 ft gap, down to 10 for 12–15 ft, one roll."
- Heights plus Plate at a wall: "CLIMB IT: 8–10 on a d10 for each 10 ft (rock: 9–10), 2 or 3 rolls." with "Heights −2, armour −2, already counted"
- Magic User in Studded at a crevice: "... down to nothing for 12–15 ft, one roll." with "armour −1, already counted"
- Penalty names: Heights, Bodies of water, armour

**MARKS legend:**
- CREVICE: "You choose before anything is rolled: leap it, use a rope if you have one, or turn back. A failed leap still gets you across, hurt."
- WALL: "You choose before anything is rolled: climb it, use a ladder if you have one, or turn back. A failed climb still gets you over, hurt."

**Button order (pinned):** [CLIMB IT or LEAP IT, USE LADDER or USE ROPE (only while carried), TURN BACK]. TURN BACK is always last.

## Re-pinned tests (before -> after)

| File / test | Before | After |
|---|---|---|
| shell-map-rail (f) | precedence joiner < find < climb < card < idle; ids included `mw-rail-climb` | hazard (`if (hz) {`) < joiner < find < dark < card < idle; the three `a-hazard-*` ids |
| shell-map-rail (i) | the `mw-rail-climb` retry calls `window.move(pend.dir)` | (i.1) the card reads `vm.hazardCard(S)` and maps acts to mzResolveHazard/mzUseTool with no `window.move(`; (i.2) CLIMB-02: the retry branch, `mw-rail-climb`, `mw-rail-tool`, `a-hazard-roll`, `copy.climb`, `copy.hazard`, `kind: "climb"` and `pendingHazard.declined` are absent from the shell; (i.3) mzResolveHazard dispatches `resolveHazard` and mzUseTool answers only its own record |
| shell-map-rail (j.1) | railLocked covers joiner/find/rail.pending | also covers `(S.pendingHazard && !S.store)`; hasActiveEncounter never reads pendingHazard |
| shell-map-rail (j.2) | the fellClimbing/fellInGorge climb-pending stash | no fall lookups; the dark-only pending line; the pendingHazard narration stash |
| shell-gear-39 (mzUseTool) | guarded by `railLocked()` | guarded by its own live record (`pend.tool`/`pend.dir`) plus `hasActiveEncounter()` |
| shell-gear-39 (hazard card) | the Phase 39 branch with `copy.hazard.*` and `window.move(dir)` | `vm.hazardCard(S)`, `hz.buttons.map`, mzResolveHazard(true/false), no `window.move(`, and the bridge/import pins |
| shell-gear-39 (retry/dark) | the retry card's tool offer | no retry card (`rail.pending.kind === "climb"` and `retryTool` absent); the dark card's USE TORCH is unchanged |
| shell-input-guards GUARDED_IDS | `mw-rail-climb` | `a-hazard-cross`, `a-hazard-tool`, `a-hazard-back` |
| shell-map-invariants FILE_WIDE_GUARDED_IDS | `mw-rail-climb` | the three `a-hazard-*` ids |
| shell-armor-display, shell-clarity-43, shell-combat-over, shell-loot-screen | find-branch slice ended at `if (rail.pending && rail.pending.kind === "climb") {` | ends at `if (rail.pending && rail.pending.kind === "dark"` (the next branch now) |
| mapMarks MARKS_LEGEND verbatim table | old crevice/wall rows | the two rewritten rows, plus a new CLIMB-02 content pin (no "or fall", no "under your"; legendFor(climb/gorge) reads them) |
| hp-not-wp | banks without the card | HAZARD_CARD_COPY and HAZARD_ODDS_COPY join both the wp/WP walk and the BANNED scan |

**New tests:**
- test/unit/hazard-card.test.js has 21 tests:
  - the card shape per feat and tool, with the tool read live;
  - penalties, including a "nothing" case;
  - an engine-agreement matrix of 156 combinations (13 bases × 2 feats × 6 penalty mixes);
  - null cases and purity;
  - TURNED BACK;
  - no card after any golden crossing (success and fail-and-cross);
  - a stale second tap;
  - TURN BACK then re-pause showing the same card;
  - a validateSave/rehydrate relaunch showing the same card;
  - four real-renderRail shell-sandbox tests (ids and labels, lock and dismiss kind, no card after a crossing);
  - a voice scan.
- rollOdds.test.js has 5 new hazardOddsText tests, and rail.test.js has 2 (turnedBack's family and icon, and the retired RAIL_COPY keys).

## Verification

- `node --test test/unit/hazard-card.test.js test/unit/rollOdds.test.js test/unit/rail.test.js test/unit/hp-not-wp.test.js test/unit/roll-sign-consistency.test.js test/voice/safety-scan.test.js`: pass.
- `node --test test/unit/hazard-card.test.js test/unit/shell-map-rail.test.js test/unit/shell-gear-39.test.js test/unit/bridge-registry.test.js test/unit/shell-input-guards.test.js` (plus the other real-renderRail sandbox suites): pass.
- `node --test test/unit/mapMarks.test.js test/unit/tapStep.test.js test/voice/safety-scan.test.js`: pass.
- **`npm test` (node --test): 7,076 / 7,076 pass, 0 fail** (it was 7,046 at the plan base).
- Parity: `node --test "test/parity/**/*.test.js"` passes 64/64. `git diff --quiet HEAD -- test/parity/prototype-master.js.txt test/parity/fixtures engine content` exits 0, so the engine, content and prototype master are untouched.
- `node tools/build-www.mjs` + `node tools/shell-boot-check.mjs` PASS on all four checks (no-uncaught, painted, graves, title). These ran with a temporary node_modules junction, which I then removed (the link only). With www/ present, I reran the 9 www-reading suites: 113/113 pass. www/ is gitignored.
- Grep gates:
  - `export function hazardCardViewModel`: 1; `export function hazardOddsText`: 1.
  - `hazardOdds(` in rollOdds.js: 1 or more.
  - `hazardCard` in mazeworld.html: 5.
  - `type: "resolveHazard"` in mazeworld.html: 1.
  - `CLIMB-02` in mapMarks.js: 1.
- No bot or balance runs, by user ruling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Four shell tests outside the plan's list used the retired retry branch as a slice anchor**
- **Found during:** Task 2
- **Issue:** shell-armor-display, shell-clarity-43, shell-combat-over and shell-loot-screen ended their find-branch slice at `if (rail.pending && rail.pending.kind === "climb") {`, which no longer exists.
- **Fix:** each now ends at the next branch, the dark card's, with a CLIMB-02 comment. None of their assertions changed.

**2. [Rule 3 - Blocking] Two guarded-id lists named the retired retry button**
- **Found during:** Task 2
- **Issue:** shell-input-guards.test.js (in the plan's verify list, but not in files_modified) and shell-map-invariants.test.js both listed `mw-rail-climb`.
- **Fix:** replaced it with the three `a-hazard-*` ids, which are wired through the same generic railButtons/guardTap path.

**3. [Rule 1 - Bug, test] rng cursor compared signed**
- **Found during:** Task 1
- **Issue:** my stale-tap test compared `rngState` directly. newRun stores it signed and applyAction persists it unsigned, the same issue 78-01 documented.
- **Fix:** the test compares `>>> 0`.

### Design choices within the plan
- The penalty clause goes on the odds line's second (roll) row rather than inline, so the range line stays short on the Pixel 7.
- The card has an `iconKey` (the wall or crevice PNG), matching the feat-icon rule the rail's outcome lines use.
- The live-step narration path (`htmlToPlain` on a `<template>`) can't run in the recording DOM, so that ordering is pinned as source in shell-map-rail (i.1). The sandbox tests cover the relaunch (intro) path.

## Follow-ups for the orchestrator (outside this plan's files)

- **`NARRATIVE_ACTIONS` (src/browser/narrationLines.js, a 78-05 file):**
  - The set is `move, camp, resolveJoiner, dismissJoiner`. A crossing now arrives as a `resolveHazard` dispatch, so its rail card uses the short LINE_FOR text (for example "Over, and no worse for it.", plus the roll line) instead of the Oracle sentence a single `move` used to get. The Oracle log is unaffected.
  - Adding `resolveHazard` to the set would restore that. `useTool` was never in it.
  - test/unit/dismiss-joiner.test.js pins the set's exact contents.
  - I left it alone because the file belongs to 78-05.
- **`src/browser/bridge.js` / docs/SHELL-MODULES.md:** the `__mzRailVM` consumer description doesn't mention `hazardCard` yet. No test requires it. I left it alone so as not to collide with 78-04's docs work.
- **Pixel 7 at text size L:** three buttons (CLIMB IT, USE LADDER, TURN BACK) share one flex row. At worst "USE LADDER" wraps inside its own 48px-high button. This is on the deferred device checklist.

## TDD Gate Compliance

The RED phase ran: the new tests failed with `SyntaxError: ... does not provide an export named 'hazardOddsText'` and 2 failing rail.test.js cases. GREEN followed and passes. However, **no `test(...)` or `feat(...)` commit exists**, because the permission classifier refused the first commit (see above). The gate sequence has to be recorded when the orchestrator commits.

## Known Stubs

None.

## Threat Flags

None. The only new call surface is `window.mzResolveHazard`. It dispatches the engine's existing `resolveHazard` action, which is validated at the engine chokepoint (a strict boolean `cross`), and only while a pending record exists.

## Self-Check: PASSED (files); commits MISSING

- FOUND: src/browser/hazardCard.js, test/unit/hazard-card.test.js, and every modified file listed above (in the working tree).
- MISSING: every task commit. The commit was refused by the permission classifier; the orchestrator or the user must commit.
