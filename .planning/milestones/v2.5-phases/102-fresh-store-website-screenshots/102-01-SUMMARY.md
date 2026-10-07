---
phase: 102-fresh-store-website-screenshots
plan: 01
subsystem: tooling
tags: [screenshots, play-store, playwright-core, harness, achievements-record]
requires: []
provides:
  - "tools/store-screenshots config (sizes, scenes, keys), Play-rules check, offline seed builder, frame guard"
affects: [102-02, 102-03]
tech-stack:
  added: ["playwright-core 1.63.0 (tools/store-screenshots only, exact pin, --ignore-scripts)"]
  patterns: ["seed.mjs is the one repo-importing file; CommonJS harness reads seeds.json as data", "saves resumed through validateSave; overlay scenes injected"]
key-files:
  created:
    - tools/store-screenshots/package.json
    - tools/store-screenshots/package-lock.json
    - tools/store-screenshots/.gitignore
    - tools/store-screenshots/config.js
    - tools/store-screenshots/play-rules.js
    - tools/store-screenshots/seed.mjs
    - tools/store-screenshots/frame-guard.js
  modified:
    - tools/store-screenshots/README.md
    - test/unit/achievements-bot-isolation.test.js
key-decisions:
  - "Hero seed 29 (Tamsin of Ash Alley, Wilmsry Guard) is the first seed in 7..60 that passes every check; seed 7 has no reachable two-foe fight on floor 1"
  - "attachGuards is async (it awaits the route install) rather than returning synchronously"
  - "frame-guard rail check: spec.allowRail is false, true or 'achievement'"
metrics:
  tasks: 3
  completed: 2026-10-05
status: complete
---

# Phase 102 Plan 01: Screenshot tool foundation Summary

The capture tool now owns its sizes, its eight-scene order and Play's rules as code with self-tests, builds every record, save and injected state offline from the game's own engine and tracker (hero seed 29, a 16-unlock mid-game record, a strip of three real unlocks), and has a mechanical frame guard; no shipped code changed.

## Tasks and commits

| Task | Name | Commit | Files |
| --- | --- | --- | --- |
| 1 | Package, sizes and scene order, Play-rules check | 52d8b931 | package.json, package-lock.json, .gitignore, config.js, play-rules.js |
| 2 | seed.mjs and the declared pin update | 0f42542f | seed.mjs, test/unit/achievements-bot-isolation.test.js |
| 3 | Frame guard with self-test, README foundations | 6779b042 | frame-guard.js, README.md |

## Self-test and check outputs

```
node play-rules.js --self-test       play-rules self-test: 27 cases passed          (exit 0)
node frame-guard.js --self-test      frame-guard self-test: 25 cases passed         (exit 0)
node play-rules.js ../../store-listing/screenshots   40 violation(s), exit 1       (the 2.0-era tree: portrait tablets, old names, missing 04-achievements / 07-store / 08-board)
node seed.mjs --check                21 PASS, 0 FAIL                                (hero seed 29)
node seed.mjs                        wrote seeds.json (all eight scenes, achievementsKey, notesVersion 2.4.0)
node --test test/unit/achievements-bot-isolation.test.js test/unit/stale-terms.test.js   10 tests, 10 pass, 0 fail
node tools/stale-terms.mjs --paths tools/store-screenshots   no unlisted lines
```

`seed.mjs --check` lines (all PASS): record 16 of 77 unlocked; dates inside the 30 days before build time; earlier tiers earlier; 16 incremental tracks in progress; 4 Hidden entries unrevealed; nothing the numbers already earn is missing from `unlocked` (a probe fold returns zero unlocks and zero reveals); record round-trips through the game's writer and reader; every best at or above every scene hero; `beginRun` over the combat, deep, store and death heroes returns zero unlocks and zero reveals; strip ids `depth_t2, race_wilmsry, class_fighter` from the real tracker over a real `die()`; combat hero 2 abilities, 2 foes, 20 steps, replay survives (Pommel Strike); the combat save is what the shell resumes; deep floor 9 with 75 open cells seen and dev false; store 16 lines at 110 wilmst (some affordable, some not); all eight scenes carry their data; phone compact and both tablets expanded (at least 840 x 480); export sizes strictly inside Play's limits; harness data stays out of shipping folders.

## Seed table

All scenes use hero seed 29 (`newRun(29, [], { force: { cls: "Fighter" }, storeRoll: true })`), Tamsin of Ash Alley, a Wilmsry Guard, level-1 abilities Pommel Strike and Brace. The search tries seeds 7 to 60 in order and keeps the first that passes every check. Seeds 7, 9 and 11 to 28 (except those below) fail with no floor-1 step that starts a fight with two or more foes; seed 8 owns one ability; seeds 10, 17, 22, 25 and 26 find a fight but their floor-9 or floor-10 walk cannot reveal 70 open cells.

| Scene | Built from | Why |
| --- | --- | --- |
| title | the mid-game record only | the menu count and the title read the record |
| combat | level-1 hero, state one step before the fight (floor 1, 20 steps from the start, direction E, 2 foes); click path: move E, FIGHT, Pommel Strike, strike | nearest step by breadth-first walk that starts a fight with 2 or more foes; replay in node ends with the hero alive and foes still up. Expected ability words after the replay: `READY IN 2` (Pommel Strike), `READY` (Brace) |
| deep | same hero levelled to floor 9 (`startDepth` 9, dev set back to false), a walked region of 75 open cells seen, steps 360 plus the walk, day from steps | a believable explored map; resumable save |
| achievements | the deep save plus the mid-game record | list shows 16 of 77 earned, 4 secrets still hiding |
| death | same hero at `startDepth` 10, taken through `die(state, "combat", "Drake", ...)` | a real death on floor 10 |
| hero | the deep save | flavour lines of race, class, sub-class, abilities and skills from flavorText.js |
| store | the deep hero with `openStore` (16 lines) and gold 110 | splits the stock into affordable and unaffordable rows |
| board | the deep save (a live run reaches the DEAD tab) | board names from `devBoardRuns()`: top three by depth are Cask_Warden_77, Moss Knuckle, Nell of the Mines |

The mid-game record: 16 unlocked entries (depth_t1; survivor t1, t2; hoarder t1, t2; trap_survivor t1, t2; party_animal_t1; human_shields_t1; kills_beasts t1, t2; kills_humans_t1; kills_lair_beasts_t1; kills_magical_t1; teetotaler; special_snowflake), dated from 28.5 down to 0.6 days before the build time with earlier tiers earlier. Teetotaler is in `unlocked` on purpose: a start at floor 5 or deeper reads as a run with no healing potion drunk, so the first `beginRun` would otherwise earn it. Kill counts sit at least 6 below their next threshold and every best is at or above what any scene hero holds, so a click or two in the capture raises no surprise card. The death fold unlocks exactly depth_t2, race_wilmsry and class_fighter (post-death record = mid-game plus those three).

## Declared pin updates

- `test/unit/achievements-bot-isolation.test.js`: `READ_ONLY_VIEW_TOOLS` gains `"tools/store-screenshots/seed.mjs": ["src/browser/achievementTracker.js", "src/browser/achievementRecord.js"]`, with a Phase 102 comment block in the form of the Phase 100 one. The engine adapter stays forbidden for it. The walk, the non-vacuity test, the teeth test and the storage-key test are untouched and pass.

## Play page re-verification (2026-10-05)

Fetched `support.google.com/googleplay/android-developer/answer/9866151`. Matches the plan's constants: JPEG or 24-bit PNG with no alpha; minimum dimension 320 px; maximum 3840 px; longest side at most twice the shortest; up to 8 screenshots per device type; tablet screenshots between 1,080 and 7,680 px, 16:9 landscape or 9:16 portrait; the page names no per-file size cap for phone or tablet shots (its 8 MB figure is for Android XR only), so the 8 MB cap stays the phase's conservative ceiling. One difference worth knowing: for games the page asks for at least three 16:9 landscape (or three 9:16 portrait) shots for the recommendation formats, and at least four for apps; `play-rules.js` keeps four per tablet size (the stricter figure) and the set has eight, so both are met. No constant needed changing.

## Contract notes for plan 102-02

- `seeds.json`: `{ generatedAt, notesVersion, achievementsKey, heroSeed, settings, scenes }` with the scene keys from the plan. Extra fields: `combat` carries `abilityKey`, `abilityName` and `expect.abilities`; `death.expect` carries `epitaph` and `foe`; `board.expect` has `text` (three names) and `optional` (three more) plus `floors`; `store.expect.optional` lists four stock names; `hero.expect.text` is the full list of flavour lines, of which only some will be inside the viewport (trim or scroll in 102-02); `deep.expect.text` is empty.
- `frame-guard.js`: `await attachGuards(context, origin)` (async, installs the route first) then `frameReport(page, guards, spec)` with `spec = { text, selectors, min, sheets, allowRail, allowBlocked, layout }`. `allowRail` is `false` (default), `true` or `"achievement"`. Sheets are any visible element whose id ends in `-sheet`; the rail card test reads `#mw-rail` (`data-idle`, `data-card-kind`, `#mw-rail-title`).
- Flagged assumption (kept from planning): one dev board name reads "Dev Delver" (devuid0002, game code). It is in `board.expect.optional`, not in `text`; plan 102-02 decides what to do about it.
- Combat replay is on the state after `validateSave`; the shell resumes the same way, but the capture must check that the live click path reaches the same state (the frame guard and the fight-log check in 102-02 do this).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `attachGuards` is async**
- **Found during:** Task 3
- **Issue:** the plan describes it returning `{ blocked, errors, failed }` plus `reset()` directly, but Playwright's `context.route` is asynchronous and the route must exist before the first navigation.
- **Fix:** `attachGuards` is an async function that resolves to that object; 102-02 awaits it.
- **Files modified:** tools/store-screenshots/frame-guard.js
- **Commit:** 6779b042

**2. [Rule 1 - Bug] Self-test state leaked across `setContent`**
- **Found during:** Task 3
- **Issue:** `window.__mzState` planted in one self-test page persisted into the next (the window outlives `setContent`) and failed an unrelated case.
- **Fix:** the self-test deletes it before the layout-class cases.
- **Commit:** 6779b042

Otherwise the plan executed as written. Plan text told commands to start with `cd C:/projects/mazeworld`; the worktree was used instead, so every path and test ran against this worktree's copy of the repo.

## Known Stubs

None. `title.record` is the only entry in the title scene by design (the contract has no `expect` for it).

## Threat Flags

None beyond the plan's threat model: `playwright-core` is installed with an exact pin, `--ignore-scripts` and a committed lockfile inside the tool's own folder; every non-origin request is aborted and fails the frame; nothing outside `tools/` and one test file changed (`git diff` over `engine/ content/ src/ mazeworld.html android/` is empty).

## Human verification (deferred to end of run)

None for this plan: it has no device row. The user's eyeball pass of the shots on the Pixel 7 belongs to plan 102-02's captured set.

## Self-Check: PASSED

- Files exist: config.js, play-rules.js, seed.mjs, frame-guard.js, package.json, package-lock.json, .gitignore, README.md; achievements-bot-isolation.test.js changed.
- Commits exist: 52d8b931, 0f42542f, 6779b042.
- `git diff --stat -- engine content src mazeworld.html android` is empty; `seeds.json`, `node_modules/` and `out/` are gitignored.
