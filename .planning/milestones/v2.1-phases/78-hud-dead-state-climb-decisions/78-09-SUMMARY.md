---
phase: 78-hud-dead-state-climb-decisions
plan: 09
status: complete
subsystem: engine derived reads + map shell (HUD-07) + phase close
tags: [hud-07, acute-hearing, heardSquares, map, hold-inspect, marks-legend, phase-close, pixel-7-checklist]
requires:
  - 78-08 (draw() digest b59a98cb…, the stairs fade hold)
  - 78-04 (the Phase 78 FIXTURE-INVENTORY H2)
  - 76-01 (darkLimited / inViewWindow, the dark view window)
provides:
  - engine/derived.js#HEARING_RANGE (3) and #heardSquares(state)
  - Acute Hearing's new description
  - the heard ripple in draw(), the HEARD hold card, the HEARD MARKS row
  - the Phase 78 compiled Pixel 7 checklist
affects:
  - mazeworld.html (draw, inspectAt, renderMarksLegend, the __mzMapView bridge, CSS)
  - src/browser/mapMarks.js, src/browser/tapStep.js, src/browser/rail.js, src/browser/bridge.js
tech-stack:
  added: []
  patterns:
    - pure engine derived read bridged through an existing window.__mz* object (separate import line)
    - canvas ring drawing inside save/restore, fail-open on a missing bridge
key-files:
  created:
    - test/unit/heard-squares.test.js
    - test/unit/shell-hearing.test.js
  modified:
    - engine/derived.js
    - content/skills.js
    - mazeworld.html
    - src/browser/mapMarks.js
    - src/browser/tapStep.js
    - src/browser/rail.js
    - src/browser/bridge.js
    - test/unit/harness/shellSandbox.js
    - test/unit/abilities-catalog.test.js
    - test/unit/mapMarks.test.js
    - test/unit/tapStep.test.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/shell-terrain-41.test.js
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
    - test/parity/FIXTURE-INVENTORY.md
    - tools/voice-sample-output.txt
decisions:
  - "HUD-07 built as ruled (option A, user 2026-09-26): heardSquares returns unresolved encounter dots (feat 'dot') within 3 squares (Chebyshev, walls ignored) that the map is not showing (not seen, or outside the dark view window), row-major; hero only; [] for no skill, a dead hero (state.dead or wp <= 0) or a missing state"
  - "The heard hold card is checked before every other inspectCell branch, so a seen-but-dark dot never leaks its ENCOUNTER legend row or mark glyph"
  - "The ripple is three static P.heard rings (alpha 0.38/0.26/0.14) inside save/restore; no animation, so reduced motion has nothing to settle"
  - "The HEARD MARKS row carries swatch 'ripple'; the sheet draws it as a CSS radial-gradient span, not a PNG, glyph or emoji"
  - "The hold-inspect copy lives in RAIL_COPY.heard (rail.js), beside every other hold card, so the existing RAIL_COPY voice scans cover it"
metrics:
  duration: "about 20 minutes of commits (00:58 to 01:08 local), plus the gates"
  completed: 2026-09-27
  tasks: 3
  commits: 4
---

# Phase 78 Plan 09: Acute Hearing hears the next room, and the phase closes Summary

A hero with Acute Hearing now sees three faint parchment rings over the fog on every unresolved encounter dot within three squares, through walls, that the map is not showing. The rings come from a pure engine read, `heardSquares(state)`, and never say what is there. A hold on one says only that something is there, and MARKS explains the ripple. Phase 78 is closed with every gate green and one compiled Pixel 7 checklist below.

**Plan base:** `5d4292a195da53e4c2db354c7f484e2c6e305426`. **Phase base:** `e8bd4808`.

## What was built

**Engine (Task 1, TDD).** `engine/derived.js` gains `HEARING_RANGE = 3` and `heardSquares(state)`, right after `inViewWindow`. It scans the 7x7 box around the party. It returns `{x, y}` for each cell whose `feat === "dot"` and which is not shown (`!(seen && inViewWindow(state, x, y))`). It skips the party's own square, clips at the grid edge, and returns squares row-major. It reads no rng, mutates nothing and works on a deep-frozen state. The JSDoc names HUD-07, the user's ruling, why only dots are heard (a dot's contents are rolled when you step on it, so "alive" cannot be known without peeking at the dice) and why walls do not matter.

**Skill text.** `content/skills.js` now reads:

> Acute Hearing: `never surprised; hears an encounter up to three squares away, walls or no walls, without learning what it is`

It keeps "never surprised" (the initiative effect is unchanged) and has no roll-under phrasing. The Phase 72 comment now says HUD-07 landed in Phase 78. `abilities-catalog.test.js` is re-pinned with a HUD-07 comment.

**Shell (Task 2).**
- `mazeworld.html` module: `import { heardSquares } from "./engine/derived.js";` on its own line. The bridge is now `window.__mzMapView = { mapViewRadius, inViewWindow, heardSquares };`.
- `draw()`: after the feature-icon loop, each heard square gets three concentric arcs at `CELL * 0.13 * i`, stroked in `P.heard` at alpha 0.38, 0.26 and 0.14 inside `save()`/`restore()`. The fallback palette literal gains `heard`. The ripple is re-read every paint, so it is gone on the next paint once the square is shown or resolved. A missing bridge draws nothing.
- `inspectAt()`: computes `heard` from `view.heardSquares(S)`, passes it to `inspectCell`, and suppresses the mark glyph for a heard square (`const mark = !heard && …`).
- `tapStep.js#inspectCell`: `opts.heard === true` returns the HEARD card (tone odd, `RAIL_HOLD.mark`) before every other branch.
- `mapMarks.js`: `MAP_PALETTE.heard = "#e6d9b0"` and a tenth `MARKS_LEGEND` row (`key: "heard"`, `swatch: "ripple"`). `renderMarksLegend()` draws that row's swatch as `.mw-legend-ripple`, a 34px CSS radial-gradient of three rings on the fog colour. Every other row keeps its PNG. No font-size was added, so 78-02's text-scale rule is unaffected.
- `src/browser/bridge.js`: the `__mzMapView` entry names the new consumers.

### Voice record (final copy)

| Surface | Text |
|---|---|
| Skill (Hero sheet) | never surprised; hears an encounter up to three squares away, walls or no walls, without learning what it is |
| Hold card title | HEARD |
| Hold card line | Something is there. Your ears are sure of that much and nothing else. |
| MARKS row | **HEARD** — Acute Hearing caught something up to three squares off, walls or no walls. What it is, you find out the usual way. |

No new engine event, so no EVENT_NARRATION entry was needed and the 77-02 event-order corpus did not move.

## Snapshot change

Only `test/unit/fixtures/shell-snapshots/thief.hero.txt` moved (the fixture Thief has Acute Hearing): one line, `<i>never surprised</i>` becomes the new text. Regenerated with `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js`. The regeneration also rewrote seven other snapshots with CRLF-only changes (`git diff --ignore-cr-at-eol` showed none), and those were reverted with `git checkout --`.

## Re-pinned tests (before -> after, cause)

| Test | Before | After | Cause |
|---|---|---|---|
| reduced-motion.test.js `DRAW_SHA256` | `b59a98cb…a5a6` (78-08) | `adc11ef1de7d1e3986191d41a02a812fdb1428777cc39aa922900e5b72c4bd2f` | the heard block and the fallback `heard` key; traced comment names the previous digest |
| shell-terrain-41.test.js bridge pin | `{ mapViewRadius, inViewWindow }` | `{ mapViewRadius, inViewWindow, heardSquares }`, still assigned once | the bridge gained heardSquares |
| shell-map-viewport.test.js (e) | inspectCell with `{ ethereal }` | `{ ethereal, heard }`, plus pins for the heardSquares read and the `!heard` mark guard | the hold's heard flag |
| shell-map-hud.test.js (i) | `globalAlpha` banned anywhere in draw() | the heard block is cut out first and pinned on its own (P.heard arcs, no glyph/icon/party); globalAlpha stays banned everywhere else | the ban guarded the retired party glow; the ripple fades its rings |
| mapMarks.test.js legend | 9 rows | the same 9 rows byte-identical, then the heard row (10) | the HEARD row |
| abilities-catalog.test.js | "never surprised" | the new text | the skill text |

## Engine gate: measured zero

`### Plan 78-09 — heardSquares (HUD-07): measured zero` is appended under the existing `## Phase 78` H2 in `test/parity/FIXTURE-INVENTORY.md`. It records the rule, why no fixture can move (a pure read with no state and no rng that no action, event or save field touches), parity 66/66, the fixture and comparables diff exiting 0, the prototype hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged, and the thief.hero.txt snapshot. The heading follows the orchestrator's `### Plan 78-09` naming. Its first body line repeats the plan's name ("Plan 09 — heardSquares").

**Which Phase 78 plans changed engine behaviour:** only 78-01 (the pre-roll wall/crevice decision, CLIMB-01/02, measured and declared by 78-01/78-04). **Engine additions measured zero:** 78-09 (`heardSquares`, `HEARING_RANGE`).

## Gates (final code, this worktree)

- `npm test`: **7242/7242 pass, 0 fail** (102.7 s). No flake, and no rerun was needed.
- Parity `node --test "test/parity/**/*.test.js"`: **66/66**. Run after Task 1 and again at the end.
- `npm run boot:check`: **PASS** (no-uncaught, painted, graves, title). It ran on the first try over a `www/` built with `npm run build:www` through a temporary `node_modules` junction to the main checkout. Afterwards the junction was unlinked (the target is intact) and `www/` was deleted. Neither was committed.
- `git diff --quiet e8bd4808 -- test/parity/prototype-master.js.txt` exits 0 (phase base). `git diff --quiet 5d4292a1 -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness/comparables.js` exits 0 (plan base).
- `tools/voice-sample-output.txt` was regenerated with `node tools/voice-sample.mjs`. It is deterministic (two runs are byte-identical) and had changed (297 -> 300 event types, the narration added since Phase 75.3), so it is committed.
- No bot balance runs and no readout files (user ruling 2026-09-26; Phase 79.1 owns the measurement).

## Phase 78 Pixel 7 checklist (milestone-close batch, no device pause)

Compiled from the human-check lines of 78-01 through 78-09, one line each, grouped by requirement. Items that overlap across plans are merged.

**CLIMB-01 / CLIMB-02 — the pre-roll wall/crevice decision (78-01, 78-03, 78-04)**
1. Walk into a wall with no ladder. A card shows CLIMB IT with a d10 range and TURN BACK, and no dice appear until CLIMB IT.
2. TURN BACK: the card goes, you stay on your square, the Squares counter and the day do not change, and stepping at the wall again brings the card back.
3. Commit and fail: you land on the far side hurt, and no CLIMB IT button is left behind.
4. Carry a ladder (then a rope at a crevice): USE LADDER / USE ROPE appears and crosses with no roll.
5. With the card up, tap the map and press an arrow key: the card pulses and you do not move.
6. With the card up, force-close and relaunch: the same card returns, and CLIMB IT rolls as it would have (compare the Oracle line).
7. As a Heights-phobic hero, turn back from a wall: no fear line. Then commit: the fear line appears.
8. Hold on a wall mark and on a crevice mark, and open MARKS: the copy describes the choice and one-and-done.
9. At text size L, CLIMB IT / USE LADDER / TURN BACK share one row; at worst "USE LADDER" wraps inside its own button.
10. A wall crossing's rail card reads the Oracle's sentence.

**HUD-01 — band 1 identity line (78-05, 78-06)**
11. Band 1 reads, for example, "Dwarf Pickpocket · Lvl 3", with no parent class and no parentheses.
12. At S, M and L band 1 always shows "Lvl N", and the race and sub-class ellipsize first.

**Rail-line decision 1 — spell charge back (78-05)**
13. As a Magic User with a spent charge, walk 20 squares: a rail line reports the charge coming back with the count (for example "A spell charge wanders back (9/12).").

**Rail-line decision 2 — new-day book refill (78-05)**
14. Cross a day boundary with rations and a spent book: the rail (or, if a wandering monster attacks, THE FIGHT SO FAR's first lines) says the book is full again with the count. Without rations it says the book stayed empty.

**HUD-02 / HUD-03 — dead state and FINAL SHEET (78-06)**
15. Die on the map: THAT IS THAT offers REVIEW THE ORACLE, FINAL SHEET and BURY THEM.
16. While dead, HERO and GEAR are dimmed and do nothing, and ORACLE and DEAD open.
17. While dead, MAP (after a visit to another tab) shows the map where you died. Drag and pinch look around; tap, hold and the arrow keys do nothing.
18. While dead, the ☰ shows MARKS, CENTRE MAP and MAKE CAMP dimmed, and SETTINGS, SAVE & QUIT and NEW CHARACTER work.
19. The DEAD tab shows FINAL SHEET and BURY THEM. FINAL SHEET lists stats, level, gear, the book (Magic User) and the epitaph. It scrolls at L, wraps long epitaphs and has only Close. The back button closes it.
20. Drink an unknown potion from the Gear tab until one kills you: the app switches to the map and shows the death card.

**HUD-04 / HUD-05 — text size and the volume sliders (78-02)**
21. Switch S, M and L. The HUD labels and numbers, tab bar, rail, map screen, Gear, Hero, Oracle, DEAD, Settings, the store and the combat screen (foe cards, YOUR LOT, action buttons and submenus, THE FIGHT SO FAR) all change size with nothing clipped or overlapping. The store was not measured headlessly, so check it here.
22. In Settings with Sound On, drag the sheet up and down starting on each volume slider: the sheet scrolls and no volume changes.
23. Drag a slider sideways: the level follows your finger and sticks after release. Tap a point on the track: the level jumps there. EFFECTS plays one preview tap on release; MASTER and MUSIC play none.

**HUD-06 — the stairs fade (78-08)**
24. Take the stairs down: the screen darkens under the stairs sound, the new floor fades in, and the FLOOR card appears after it. Taps and arrow presses during the fade move nothing.
25. With Android's remove-animations setting on: an instant cut, and the stairs sound still plays.
26. A teleport is unchanged (a snap).

**HUD-07 — Acute Hearing hears the next room (78-09)**
27. As a Thief with Acute Hearing: faint rings appear on unexplored squares up to three away where a red dot is waiting, including through walls. None appear on traps or chests, and a ripple is gone once you see the square or clear the dot.
28. In the dark with no light: a dot you explored earlier but can no longer see shows the ripple again.
29. Hold on a ripple: the card says HEARD, "Something is there. Your ears are sure of that much and nothing else.", with no mark icon. MARKS lists the HEARD row with a ripple swatch.
30. A hero without Acute Hearing never sees ripples. The Hero sheet's Acute Hearing reads "never surprised" plus the new ability.

**HUD-08 — the Movement setting and the arrow pad (78-07)**
31. Settings: switch Movement to ARROWS and back live; the Pad row appears only for ARROWS.
32. Put the pad in BOTTOM LEFT, then BOTTOM RIGHT. Each press takes one step, a map tap does nothing, a hold still inspects and a drag still pans.
33. Walk toward the pad in both corners: the map scrolls before the party slips under it.
34. When a rail line appears, the pad stays above it and keeps working.
35. The pad is gone or inert while dead, in a fight, at the stair prompt, and with Settings or MARKS open.
36. At S the pad buttons are still easy to hit, at L they are bigger, and TalkBack reads "Step north" and so on.

**HUD-09 — the full-bag find card (78-08)**
37. With the biggest bag full at text size L, find a weapon. Its name, stats and TAKE IT NOW / LEAVE IT stay visible, the drop list scrolls inside the card, and each row shows the item's stats.

## Deviations from Plan

1. **[Rule 3 - Blocking] The fixture-inventory heading follows the orchestrator's naming.** The plan's acceptance grep expects `Plan 09 — heardSquares`. The orchestrator notes require a `### Plan 78-09` subsection. The heading is `### Plan 78-09 — heardSquares (HUD-07): measured zero`, and its first body line reads "(Plan 09 — heardSquares, as the plan names it.)", so the plan's grep still finds exactly one match. Commit c293deaa.
2. **[Rule 3 - Blocking] Files touched outside the plan's list.** `src/browser/rail.js` (RAIL_COPY.heard, where every hold card's copy lives and where the voice scans look), `src/browser/bridge.js` (the `__mzMapView` registry text), `test/unit/harness/shellSandbox.js` (the sandbox twin of the bridge, so the real draw() sees heardSquares), and four re-pinned shell tests (`reduced-motion`, `shell-map-hud`, `shell-map-viewport`, `shell-terrain-41`). Each re-pin is traced in the table above. Commit 3ed9a4d9.
3. **[Rule 1 - Bug, prevented] The heard hold is checked before the feat branch.** A seen dot outside the dark window would otherwise have answered its ENCOUNTER legend row and glyph on a hold, telling the player what the ripple is. The heard branch runs first and the mark glyph is suppressed. Both are pinned in `tapStep.test.js` and `shell-hearing.test.js`.
4. **The plan's bot-readout steps were dropped**, per the orchestrator's user ruling (2026-09-26). No tuning tool ran and no readout file was created.
5. **The heard-squares tests use real newRun floors** with the grid cleared to open unseen ground and hand-set feats, as the plan asks. A last case checks the rule against five untouched newRun floors.

## Known Stubs

None.

## Threat Flags

None. `heardSquares` is a read-only derived function. It adds no action, no save field, no network and no storage. The fairness prohibition holds: no rng is read and no contents are revealed (pinned by the purity test and the "names nothing" copy tests).

## TDD Gate Compliance

Task 1 RED `02d920b1` (test) comes before GREEN `c293deaa` (feat). RED failed on the missing export as expected.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 02d920b1 | test(78-09): add failing tests for heardSquares (HUD-07) |
| 1 GREEN | c293deaa | feat(78-09): heardSquares and the new Acute Hearing text (HUD-07) |
| 2 | 3ed9a4d9 | feat(78-09): the heard ripple, its hold line and its MARKS row (HUD-07) |
| 3 | 21f115c8 | chore(78-09): regenerate the voice sample at the Phase 78 close |

## Self-Check: PASSED

- FOUND: engine/derived.js (`export function heardSquares`, 1), test/unit/heard-squares.test.js, test/unit/shell-hearing.test.js, this SUMMARY
- FOUND: `Plan 09 — heardSquares` in test/parity/FIXTURE-INVENTORY.md (1)
- FOUND commits: 02d920b1, c293deaa, 3ed9a4d9, 21f115c8
