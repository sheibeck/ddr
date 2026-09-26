---
phase: 76-darkness-unification-relaunch-persistence
plan: 05
subsystem: shell-boot/persistence
status: complete
tags: [persistence, relaunch, SAV-06, SAV-07, oracle, fixture-inventory, deferred-uat]
requires:
  - "76-03: resumeEventsFor, fightResumed/storeResumed narration"
  - "76-04: engineAdapter.js#takeBootResumeEvents()"
provides:
  - "mazeworld.html: the Oracle resume line logged at boot under 'Delve resumed.'"
  - "test/unit/shell-resume-line.test.js: boot wiring pins and resume-line formatting checks"
  - "test/parity/FIXTURE-INVENTORY.md: the Phase 76 persistence subsection (Plans 03-05)"
  - "the compiled Phase 76 device checklist for the milestone-close Pixel 7 batch"
affects:
  - "76-06 (Map the Floor + Weaken fumble) runs next on this head"
  - "Phase 77 effect indicators (handoff below)"
tech-stack:
  added: []
  patterns:
    - "boot-time one-shot adapter read, formatted by formatEvents, logged Oracle-only"
key-files:
  created:
    - test/unit/shell-resume-line.test.js
  modified:
    - mazeworld.html
    - test/parity/FIXTURE-INVENTORY.md
decisions:
  - "The resume line is logged once at boot, right under the 'Delve resumed.' banner and hero line, before the first paint; it is not repeated on ENTER"
  - "Oracle only (no rail line, no card): a relaunch is a minor event per the card-vs-rail ruling"
metrics:
  duration: "~25 min"
  completed: 2026-09-26
  tasks: 2
  files: 3
---

# Phase 76 Plan 05: The Oracle's resume line and the persistence measurement Summary

After a relaunch into a live fight or an open shop, the Oracle now says so, once and in voice, right under "Delve resumed." ("Still here. Still fighting. Round N, where you left it." / "They waited. Monsters can be very patient." / "The shopkeeper has not moved. Neither have the prices."). The persistence half of the phase is recorded as a measured zero in FIXTURE-INVENTORY.md, beside the darkness half. Every gate is green at the head.

**Phase base:** `e090d1daba0ac7726851ec796792b8a9ca34d59a` (the commit before 76-01's and 76-03's first commits).
**Dispatch base:** `b7d33827` (76-01..04 merged).

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 (RED) | Failing test for the Oracle resume line | `a3fa84ba` | test/unit/shell-resume-line.test.js |
| 1 (GREEN) | The Oracle's resume line at boot | `bf762b9f` | mazeworld.html |
| 2 | Record the persistence measurement | `c1679170` | test/parity/FIXTURE-INVENTORY.md |

## What changed

- **mazeworld.html (module script).**
  - A second import line: `import { takeBootResumeEvents, formatEvents } from "./src/browser/engineAdapter.js";`. The pinned `boot, dispatch, startNewRun, waitForPending, takeBootWornReport` line is byte-identical and still occurs once.
  - Inside `if (hadSaveAtLaunch) {`, after the banner and the hero line: `for (const line of formatEvents(takeBootResumeEvents() || [])) window.logLine(line);`. It runs before `window.paint()`.
  - A fresh boot gives null, and a quiet save gives `[]`; both log nothing. The fight or store overlay comes back through paint() and renderEncounter() from the rehydrated S, so no rendering change was needed.
- **test/unit/shell-resume-line.test.js (6 tests).**
  - The import-line counts.
  - The order within the block: the banner, then the hero line, then the one read of `takeBootResumeEvents()` (the only one on the page), then paint().
  - The `formatEvents(takeBootResumeEvents() || [])` → `window.logLine` wiring.
  - No rail or card call in the block.
  - Three formatted lines (under way, pending and store): each is non-empty and clean on the safety word list, and the two fight lines differ.
  - Empty input gives no lines.
- **test/parity/FIXTURE-INVENTORY.md.** `### Plans 03–05 — relaunch persistence (SAV-06/07): measured zero` sits under the existing Phase 76 H2, after the Plan 01 subsection. It records:
  - the rule and the predictor (the loader never runs in a parity replay, and there is no new serialized field);
  - the live scans;
  - 76-04's `sanitizeWorn` purse-clamp change (no fixture moved);
  - the 10-row flipped-pin table;
  - the standing guards: save-resume, resume-roundtrip with its corpus counts, resume-mid-encounter, engineAdapter and shell-resume-line.

## Gate results at the phase head (`c1679170`)

| Gate | Result |
|---|---|
| `npm test` | **6,773 / 6,773 pass**, 0 fail, 0 cancelled (6,767 at dispatch + 6 new) |
| `node --test "test/parity/**/*.test.js"` | **64 / 64 pass** |
| `npm run boot:check` | **PASS** no-uncaught, painted, graves, title (run after Task 1 and again at the head) |
| `git diff --quiet e090d1da -- test/parity/prototype-master.js.txt` | exit 0 |
| `git hash-object test/parity/prototype-master.js.txt` | `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged) |
| `git diff --stat e090d1da -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness/comparables.js` | empty |
| `git diff --stat e090d1da -- test/unit/fixtures` | empty (no shell snapshot or state pin moved) |
| Task 1 verify (`shell-resume-line`, `shell-account`, `shell-pgs`, `resume-mid-encounter`) | 77 / 77 pass |

No band or survival test failed. No bot balance runs were made (user ruling 2026-09-26), and no `tools/readouts/76-*` files exist.

## Phase 76 device checklist (milestone-close Pixel 7 batch, deferred UAT)

1. On a dark patch with no light source, only the 3x3 around the party is revealed and shown.
2. Light a torch on a dark patch and walk: squares two away are revealed as you walk, and the explored map stays visible.
3. Use the Amulet of Light on a dark patch: squares three away are revealed as you walk.
4. Start a fight on a dark patch with no light: "You cannot see what you are fighting." appears and the odds are capped. With a torch lit, there is no such line, and the odds match a lit square.
5. A Darkness-phobic hero entering a dark patch with a torch lit is not frightened; with no light they are.
6. Fall into the Table-7 darkness (the DARK chip counting down) with no light: the vignette closes in and dark tiles look dark.
7. Light a torch: the vignette lifts, the DARK chip names "your torch", its tap card says the torch is holding the dark back, and dark tiles take a faint warm tint that still reads as dark.
8. Use the Amulet of Light, then play a Night Vision race: the chip names "your Amulet of Light" and "your night vision" respectively.
9. In a fight in the Table-7 darkness with a torch lit, tap the DARK chip: the card says the torch is holding the dark back and shows no to-hit penalty. With no light it shows the penalty.
10. Let the torch burn out in the dark: the tint goes back to full dark and the vignette returns.
11. Mid-fight, swipe the app away from recents and relaunch: the same fight is up, with the same foes, round and HP. The Oracle's first lines after "Delve resumed." say the fight is still on, and the map refuses a move until the fight ends.
12. Mid-fight, use SAVE & QUIT, close the app, relaunch and tap ENTER: the same fight.
13. Force-close mid-fight right after an action: the relaunch shows the same fight at that action (SAV-07's kill-between-dispatch-and-write timing cannot be reproduced under node, so this is the device backstop).
14. In a store, swipe away and relaunch: the Oracle says the shop is still open, and the store screen is up with the same stock and prices. Something bought before the relaunch is still sold, and the gold is still spent.
15. Relaunch on a fight that has not been joined yet (the encounter step): the Oracle says "They waited. Monsters can be very patient." and the fight is up.
16. Relaunch while a find card is up: the same find is offered.
17. Relaunch while a ladder or rope hazard card is up: the same choice is offered.
18. Relaunch while a Joiner offer is up: the same Joiner is offered, and accepting adds them.
19. Relaunch mid-fight after a debuff landed: the debuff chip is still there.
20. Relaunch with a torch lit in the dark: the tint and the chip come back as they were.
21. Relaunch on a quiet save (no fight, store or card up): only "Delve resumed." and the hero line appear, with no resume line.
22. A light lifting the dark in a fight: with a torch lit or a live Amulet in a dark fight, the strike odds match a lit square and crits can land.

## Phase 77 handoff

Phase 77's effect indicators must read the rehydrated `c.foeEffect`, the rounds-cadence `c.timers` records and the `combat` fields (the round, `C.weakened`, `foeToHitPenalty` and the other per-round flags) after a relaunch. They come back wholesale from the save (76-03), and `beats` is always null after a load. An indicator that builds its state from beats or from in-session events alone would come up blank after a relaunch.

## Deviations from Plan

### Orchestrator / user ruling

- **No bot balance runs (user ruling 2026-09-26).** This plan had no readout step. No `tools/readouts/76-*` files were created.
- **76-04's loader change recorded.** Per the orchestrator note, the persistence subsection has a paragraph on 76-04's Rule 1 fix in `engine/saveState.js#sanitizeWorn`: a load no longer clamps an over-cap purse, and the clamp runs only when an old-save gear migration spills an item into the bag. No fixture moved.

### Auto-fixed issues

None. The only environment step: boot:check needs a built www/, and the worktree has no node_modules. I created a temporary directory junction to the main checkout's node_modules, built www, ran the check twice, then removed only the junction and the gitignored www/. The main node_modules is intact, and nothing from www/ was committed.

### Plan notes

- 76-05 is no longer the last plan in the phase (76-06 follows). The phase-head gates here cover the head as of 76-05.
- Device checks 13, 15, 21 and 22 were added beyond the plan's list. They come from 76-04's SUMMARY (the force-close backstop and the encounter-step boundary), this plan's quiet-save branch, and the plan's "a light lifting the dark in a fight" item.

## Known Stubs

None.

## TDD Gate Compliance

RED `a3fa84ba` test(76-05): 3 of 6 tests failed as expected (the resume import was missing, and the block did not read takeBootResumeEvents). The formatting checks passed at RED because 76-03 had already landed the narration. GREEN `bf762b9f` feat(76-05) followed. No refactor commit was needed.

## Threat surface

Nothing new. The boot reads adapter state that is never serialized and logs engine-authored narration HTML through the existing `window.logLine`.

## Self-Check: PASSED
- FOUND: test/unit/shell-resume-line.test.js
- FOUND: mazeworld.html contains `takeBootResumeEvents`
- FOUND: test/parity/FIXTURE-INVENTORY.md contains `SAV-06` (8 hits), and `## Phase 76` appears once
- FOUND commits: a3fa84ba, bf762b9f, c1679170
