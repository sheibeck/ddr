---
phase: 44-retire-the-classic-engine-from-the-shell
plan: 02
subsystem: infra
tags: [dead-code, shell, movement-engine, orphaned-tables]

# Dependency graph
requires:
  - phase: 44-retire-the-classic-engine-from-the-shell (Plan 01)
    provides: "tools/shell-boot-check.mjs, tools/shell-sweep.mjs (reachability-aware refs/orphans gates), layer-1 mirror+combat-cluster deletion (mazeworld.html 8710 -> 7670 lines)"
provides:
  - "Deletion layer 2: the classic movement/encounter engine (move, newDay, teleport, reveal-related wiring, winGame, treasure rollers, trap/chest/find/faerie/affliction helpers, epitaph tables, die/bury/vitalsStrip) deleted from mazeworld.html"
  - "The two surviving bare move(...) call sites rewritten to the explicit window.move(...) bridge; the camp sheet's else-makeCamp() fallback collapsed to a single window.mzMakeCamp() call"
  - "Deletion layer 3: the orphaned classic content tables and combat-math/chargen helpers only the deleted engine ever reached (BESTIARY, ENCOUNTER_TABLES, SPELLS, MU_CHART, WEAPON_*, ARMORS, CLASSES, KIT, BLADE_NAMES/JEWELRY/CLOAKS/STAVES/POTIONS/FOODS/TRAPS/AFFLICTIONS/FAERIE/MISC_MAGIC, TEMPERAMENTS/MOTIVES/PHOBIAS/RACE_D8, NAMES/nameFor, bfs/shuffle, strikeDie/toHit/inDark/climbBonus/leapBonus/foeDie/foeToHitVs/weaponDamage/levelFromSP, pick/priceFor/rollSkills/skillTier/schoolAllowed/schoolGate/schoolBonus/canLearn/rollGrimoire) deleted"
  - "tools/shell-sweep.mjs gained isForeignMemberAccess() — excludes obj.NAME member-access reads (obj != window/globalThis) from refs/orphans matching, fixing a false 'still referenced' positive"
  - "mazeworld.html 7670 -> 6600 lines (930 lines removed this plan)"
affects: [44-03, 44-04, 45-collapse-the-phase-37-hedges, 47-shell-modularisation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A-1 escape hatch exercised in the forward direction this time: reveal() was restored (with its original comment) after the sweep gate found a genuine live reference from window.__mzClassicBoot's resume branch — never force-delete a name the gate reports as referenced from live code"
    - "isForeignMemberAccess(): obj.NAME in member-access position, where obj is not window/globalThis, is excluded from refs/orphans matching — a same-named property on an unrelated object (e.g. COMBAT_COPY.over.dead.bury) is never a reference to the top-level classic declaration NAME"

key-files:
  created: []
  modified:
    - mazeworld.html
    - tools/shell-sweep.mjs
    - test/unit/shell-combat-actions.test.js
    - test/unit/shell-combat-screen.test.js
    - test/unit/shell-fight-log.test.js
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-loot-screen.test.js
    - test/unit/shell-party-camp.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/shell-armor-display.test.js
    - test/unit/shell-company-panel.test.js

key-decisions:
  - "reveal() restored (A-1 kept-with-live-reference): window.__mzClassicBoot's resume-a-save branch still calls it directly; removing that call path is Plan 44-04's boot/persistence-slimming scope, not this plan's"
  - "A-3 resolved: newBeat/CAPTURE both kept — still called from act()/say(), independent of the deleted beginEvent/evt one-line wrappers"
  - "shell-sweep.mjs extended with isForeignMemberAccess() (Rule 1 tool fix) rather than restoring bury() — the one remaining hit was a button-label object key (COMBAT_COPY.over.dead.bury), not a call to the deleted classic bury()"

patterns-established: []

requirements-completed: [DEAD-01, DEAD-03]

coverage:
  - id: D1
    description: "Deletion layer 2 — the classic movement/encounter engine deleted; window.move bridge calls explicit; no else-makeCamp fallback; six broken shell pins re-anchored"
    requirement: DEAD-01
    verification:
      - kind: unit
        ref: "npm test (3241/3241, fail 0 after this plan's two commits); node --test test/unit/shell-map-invariants.test.js test/unit/shell-terrain-41.test.js (fail 0)"
        status: pass
      - kind: other
        ref: "node tools/shell-sweep.mjs refs <layer-2 names> (all 0, reveal excluded/restored per A-1); npm run build:www; npm run boot:check (4 PASS); git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt (empty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Deletion layer 3 — the orphaned classic content tables and combat-math/chargen helpers deleted; CLOAKS txt-mirror pin dropped with reason recorded"
    requirement: DEAD-01
    verification:
      - kind: unit
        ref: "npm test (3241/3241, fail 0); node --test test/unit/shell-map-invariants.test.js test/unit/hp-not-wp.test.js (fail 0)"
        status: pass
      - kind: other
        ref: "node tools/shell-sweep.mjs refs <layer-3 names> (all 0 except the module's own documented import-line survivors); npm run build:www; npm run boot:check (4 PASS); wc -l < mazeworld.html = 6600 (<= 6900 target)"
        status: pass
    human_judgment: false
  - id: D3
    description: "grep -rl \"new Function\" test/ stays empty (DEAD-03 — no regression from this plan)"
    requirement: DEAD-03
    verification:
      - kind: other
        ref: "grep -rl \"new Function\" test/ (prints nothing)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-19
status: complete
---

# Phase 44 Plan 02: Deletion Layers 2 & 3 — Movement/Encounter Engine + Orphaned Tables Summary

**Deleted the classic movement/encounter engine (layer 2: `move`/`newDay`/`teleport`/`winGame`/treasure-rollers/trap-chest-find helpers/epitaph tables/`die`/`bury`/`vitalsStrip`) and the orphaned classic content tables + combat-math/chargen helpers only that engine ever reached (layer 3: `BESTIARY`/`SPELLS`/`WEAPON_*`/`CLASSES`/`KIT`/the eleven flavor tables/`strikeDie`/`toHit`/etc.) from mazeworld.html, rewriting the two surviving movement call sites to the explicit `window.move(...)` bridge and collapsing the camp sheet's `else makeCamp()` fallback — 7670 → 6600 lines, two green commits, zero engine-byte drift.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 11 (`mazeworld.html`, `tools/shell-sweep.mjs`, 9 test files)

## Accomplishments

- Deleted deletion layer 2 (`reveal`\*, `beginEvent`, `evt`, `EPITAPHS`, `epitaphFor`, the movement banner + `DIRV`/`OPP`/`move`/`newDay`/`teleport`/`bestTeleportDir`/`winGame`, `giveItem`/`LOOT_DIVISOR`/`gainWilmst`/`hasPicks`/the five treasure rollers, `springTrap`/`openChest`/`encounterDot`/`tableFour`/the nine find/faerie/affliction helpers, `CAUSE_TEXT`/`die`/`epitaphCtx`, `bury`, `vitalsStrip`) — 41 names, all `refs NAME: 0` except `reveal` (restored, see Deviations) and the expected `window.move(...)` bridge survivors.
- Rewrote `tapStep()`'s `move(res.dir)` and the keydown handler's `move(dirKeys[k])` to explicit `window.move(...)` calls; collapsed the camp sheet's `if (window.mzMakeCamp) window.mzMakeCamp(); else makeCamp();` to a single `window.mzMakeCamp();` (no classic fallback).
- Re-anchored the six shell test pins this layer broke, all in the same commit.
- Deleted deletion layer 3 (`pick`, `STRIKE_DICE`, `CLASSES`, the four weapon/armor tables, `priceFor`, `KIT`, `FREE_SKILL`, `rollSkills`, `skillTier`, the eleven flavor/loot tables, `RACE_D8`/`TEMPERAMENTS`/`MOTIVES`/`PHOBIAS`, `BESTIARY`/`ENC_TYPES`/`ENCOUNTER_TABLES`/`ENC_ALIAS`, `SPELLS`/`MU_CHART`/the five school helpers/`rollGrimoire`, `INSANITY`, `NAMES`/`nameFor`, `bfs`/`shuffle`, the nine combat-math helpers) — 54 names, all `refs NAME: 0` except the module's own documented `import {...}` line survivors.
- Deleted the "book's charts and tables" and "maze generation" section banners (every declaration under each is now gone); kept the "carried treasure"/"encounters" and "derived character numbers" banners (they still head surviving code — `eff`/`R_`/`upkeep`).
- Deleted the ARMOR-04 CLOAKS txt-mirror test case with its reason recorded.
- `mazeworld.html`: 7670 → 6600 lines (below the plan's ≤ 6,900 target; the phase-level ≤ 6,710 target covers all four plans).

## Task Commits

Each task was committed atomically:

1. **Task 1: Deletion layer 2 — the classic movement/encounter engine, the explicit window.move bridge calls, the else-makeCamp fallback, and the six pins it breaks** - `c2aaeb4` (refactor)
2. **Task 2: Deletion layer 3 — the orphaned classic tables and combat-math/chargen helpers, plus the CLOAKS txt-mirror case** - `32372e3` (refactor)

**Plan metadata:** (this commit)

## Files Created/Modified

- `mazeworld.html` — layers 2 and 3 deleted; `reveal()` restored with an explanatory comment (A-1); the two movement call sites and the camp sheet fallback rewritten
- `tools/shell-sweep.mjs` — `isForeignMemberAccess()` added and wired into `cmdRefs`, `textReferencesName`, `bodyCallsName`
- `test/unit/shell-combat-actions.test.js`, `shell-combat-screen.test.js`, `shell-fight-log.test.js`, `shell-input-guards.test.js` — guard-helpers region end anchor `"function vitalsStrip()"` → `"function wireDeathConfirm()"`
- `test/unit/shell-loot-screen.test.js` — same anchor change via `indexOf`
- `test/unit/shell-party-camp.test.js` — `paintRegion` end anchor `"\nfunction move(dir)"` → `"\nfunction eff(key)"`
- `test/unit/shell-map-viewport.test.js` — keydown pin updated from bare `move(dirKeys[k])` to `window.move(dirKeys[k])` (Rule 1 fix, not in the plan's declared file list)
- `test/unit/shell-armor-display.test.js` — ARMOR-04 CLOAKS txt-mirror case + its now-unused `CLOAKS` import deleted
- `test/unit/shell-company-panel.test.js` — `subNoteRegion()` end anchor `"const NAMES = {"` → the "rendering" section banner (Rule 1 fix, not in the plan's declared file list — `NAMES` was deleted this plan, breaking the pin)

## Decisions Made

- **`reveal()` restored per A-1's escape hatch.** The layer-2 sweep gate reported a genuine live reference from `window.__mzClassicBoot`'s resume-a-save branch (`S = restored; ...; reveal();`) — a path that runs on every relaunch with an in-progress run, since the classic script's `SAVE_KEY` and `engineAdapter.js`'s own `SAVE_KEY` are the same literal (`"ddr.delve.v1"`). Force-deleting `reveal()` would have thrown a `ReferenceError` on every resumed boot. Restored with an explanatory comment naming Plan 44-04 (boot/persistence-slimming) as the plan that will remove this call site, per `44-CONTEXT.md`'s own note that the `__mzClassicBoot` load-branch cleanup is later-layer scope.
- **A-3 resolved: `newBeat`/`CAPTURE` kept.** `node tools/shell-sweep.mjs refs newBeat CAPTURE` after the layer-2 deletion showed both still called from `act()`/`say()` — independent of the deleted `beginEvent`/`evt` one-line wrappers that merely called `newBeat`/read `CAPTURE`.
- **`shell-sweep.mjs` extended with `isForeignMemberAccess()` (Rule 1 tool fix), not a `bury()` restoration.** The one non-zero `refs bury` hit after deletion was `COMBAT_COPY.over.dead.bury` — a button-label object key on an unrelated config object, not a call to the deleted classic `bury()` function. The tool's existing `isObjectKeyMatch` only excludes object-literal KEY position (`NAME:`); it had no exclusion for member-ACCESS position (`obj.NAME`) on a non-window object. Added the same exclusion the codebase already uses for `window.`/`globalThis.` prefixes, generalized to "any non-window/globalThis dotted-property read of NAME is not a reference to the top-level declaration NAME," and wired it into `cmdRefs`, `textReferencesName` (orphans roots), and `bodyCallsName` (orphans propagation) for consistency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/shell-map-viewport.test.js`'s keydown pin broke when the bare `move(dirKeys[k])` call was rewritten to `window.move(dirKeys[k])`**
- **Found during:** Task 1 — `npm test` reported 1 failure after the layer-2 deletion: `"(h) keydown: arrows still resolve through dirKeys into move()"` asserted the literal regex `if \(dirKeys\[k\]\) \{ e\.preventDefault\(\); move\(dirKeys\[k\]\); return; \}`, which the plan's own required rewrite (bare `move` → `window.move`) broke. This file was not in the plan's declared `files_modified` list for Task 1.
- **Fix:** Updated the test's regex to `window\.move\(dirKeys\[k\]\)` and reworded the test name to note the Phase 44-02 rewrite.
- **Files modified:** `test/unit/shell-map-viewport.test.js`
- **Verification:** `npm test` returned to 3242/3242, fail 0 (full suite, before Task 2's one intentional case deletion).
- **Committed in:** `c2aaeb4` (Task 1 commit)

**2. [Rule 1 - Bug] `test/unit/shell-company-panel.test.js`'s `subNoteRegion()` end anchor (`"const NAMES = {"`) no longer existed after `NAMES` was deleted**
- **Found during:** Task 2 — `npm test` reported a failure in `"SUB_NOTE: the classic Cutthroat row is byte-identical to content/flavor.js..."` after `NAMES`/`nameFor` were deleted (layer 3). This file was not in the plan's declared `files_modified` list for Task 2 (only `mazeworld.html` and `shell-armor-display.test.js` were named).
- **Fix:** Re-pointed `subNoteRegion()`'s end anchor from `"const NAMES = {"` to `"/* ---------------- rendering ---------------- */"` — the section banner `SUB_NOTE` is now directly followed by, since `NAMES` sat between them and is now gone.
- **Files modified:** `test/unit/shell-company-panel.test.js`
- **Verification:** `npm test` returned to green (3241/3241, fail 0, after Task 2's one intentional CLOAKS-mirror case deletion).
- **Committed in:** `32372e3` (Task 2 commit)

**3. [Rule 1 - Bug] `tools/shell-sweep.mjs` false "still referenced" positive on `bury` (a button-label object key, not a function call)**
- **Found during:** Task 1's post-deletion `refs` gate — `refs bury: 1`, the sole hit `L4552: { id: "btn-death-confirm", label: COMBAT_COPY.over.dead.bury, cls: "dead" },`. `bury` here is a member-access read of an unrelated config object's `.bury` property (a button-label string), not a reference to the deleted classic `bury()` function.
- **Fix:** Added `isForeignMemberAccess()` to `tools/shell-sweep.mjs` (see Decisions Made) and wired it into `cmdRefs`, `textReferencesName`, `bodyCallsName`.
- **Files modified:** `tools/shell-sweep.mjs`
- **Verification:** re-ran `refs bury` → `refs bury: 0`; re-ran the full 41-name layer-2 gate (all 0, `reveal` excluded per A-1); re-ran `npm test` (unaffected — the tool change only narrows `refs`/`orphans` matching, never touches `mazeworld.html`).
- **Committed in:** `c2aaeb4` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule-1 bugs — two test-pin re-points the plan's own rewrite/deletion work broke in files outside its declared list, one tool false-positive fix). Zero deviations required restoring any deleted `mazeworld.html` declaration except `reveal()` itself, which the plan's own A-1 escape hatch anticipated and required.
**Impact on plan:** All fixes were necessary for the gates (`npm test` fail 0) to hold at both commit boundaries, as the plan's own success criteria require. No scope creep beyond the tool file and the two additional test files; `mazeworld.html`'s actual deletion set matches the plan's Task 1 and Task 2 name lists exactly (`reveal` restored per A-1, as the plan's own flagged assumption anticipated).

## Issues Encountered

None beyond the deviations documented above.

## Known Stubs

None — this plan only deletes dead code, restores one name per A-1, and re-points/deletes test pins; no new UI surface or data flow was introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. This plan strictly deletes unreachable classic-script code (plus one narrow tool-matching fix) and its accompanying tests.

## Deleted symbols (layer 2)

All line ranges are `ba45dfd` (phase-start baseline) numbers, taken from the plan's own `read_first` citations (mazeworld.html has since shifted; every deletion in this plan was located and verified by declaration text, not by these numbers).

| Symbol | ba45dfd range | Notes |
|---|---|---|
| `reveal` | L2686–2711 | **RESTORED per A-1** — see Decisions Made / Deviation 3. `window.__mzClassicBoot`'s resume branch still calls it. |
| `beginEvent`, `evt` | L2843–2844 | one-line wrappers around `newBeat`/`say` |
| `EPITAPHS`, `epitaphFor` | L2228–2345 | epitaph-bank table + picker; only callers (`die`, `winGame`) are also deleted this layer |
| the `/* ---------------- movement ---------------- */` banner, `DIRV`, `OPP`, `move` | L3611–3713 | the classic movement entry point; the module's `window.move = function engineMove` override is what the shell now calls explicitly |
| `newDay` | L3714–3769 | |
| `teleport`, `bestTeleportDir` | L3796–3853 | |
| `winGame` | L3867–3877 | the classic shell copy only — the engine's `winGame`/`state.won` is Phase 46 DEAD-04 |
| `giveItem`, `LOOT_DIVISOR`, `gainWilmst`, `hasPicks`, `rollJewel`, `rollCloak`, `rollStaff`, `rollBlade`, `rollMailPiece`, `rollTreasureItem` | L3896–3946 | |
| `springTrap`, `openChest`, `encounterDot`, `tableFour`, `findFood`, `findGrimoire`, `findGear`, `findMisc`, `meetFaerie`, `catchAffliction`, `goInsane`, `newPhobia`, `fallDark` | L4326–4516 | |
| `CAUSE_TEXT`, `die`, `epitaphCtx` | L5234–5272 | |
| `bury` | L5353–5364 | |
| `vitalsStrip` | L5525–5533 | |

### Kept, with the live reference

| Symbol | Reason |
|---|---|
| `reveal` | `window.__mzClassicBoot`'s resume-a-save branch calls it directly (`S = restored; ...; reveal();`) — live on every relaunch with an in-progress run. Restored with its original comment plus a new explanatory note; removing this call site is Plan 44-04's scope. |
| `newBeat`, `CAPTURE` (A-3) | Both still called from `act()`/`say()`, independent of the deleted `beginEvent`/`evt` wrappers. `node tools/shell-sweep.mjs refs newBeat CAPTURE` after deletion: `newBeat` 1 hit (its own declaration only, called via `act()` which is itself live), `CAPTURE` 3 hits (`let CAPTURE = null;` declaration + two live reads in `say()`/`act()`). Neither deleted. |

## Deleted symbols (layer 3)

| Symbol | ba45dfd range | Notes |
|---|---|---|
| `pick` | L1793–1795 (delete only `pick`; `D`/`clamp` kept) | |
| `STRIKE_DICE` | L1799 | |
| `CLASSES` | L1803–1819 | the module's own `import { RACES, CLASSES, BAGS, ABILITY_BY_ID }` line is the expected survivor for the name `CLASSES` (a different binding) |
| `WEAPON_MAX`, `WEAPON_TYPE_TABLE`, `WEAPON_BONUS_TABLE`, `ARMORS`, `MAGIC_ARMOR_TABLE`, `priceFor` | L1850–1872 | `WEAPONS` (kept) sits between `WEAPON_BONUS_TABLE` and `ARMORS` in source order but is untouched |
| `KIT` | L1875–1885 | |
| `FREE_SKILL` | L1914 | |
| `rollSkills`, `skillTier` | L1917–1933 | `skillTable` (L1916) and `skill` (L1932) kept — both still live via `paint()`/`eff()` |
| `BLADE_NAMES`, `JEWELRY`, `CLOAKS`, `STAVES`, `POTIONS`, `FOODS`, `TRAPS`, `AFFLICTIONS`, `FAERIE`, `MISC_MAGIC`, `SPELL_LEVEL_TABLE`, `CLIMB_TABLE`, `LEAP_TABLE`, `DIRECTION_TABLE` | L1938–2026 | plus the "book's charts and tables, pp.44-49" section banner (deleted — every declaration under it is gone) |
| `RACE_D8`, `TEMPERAMENTS`, `MOTIVES`, `PHOBIAS` | L2042–2051 | `RACES` (L2029–2041) kept — still live via `R_()` |
| `BESTIARY`, `ENC_TYPES`, `ENCOUNTER_TABLES`, `ENC_ALIAS` | L2055–2135 | plus the "Creatures Described, pp.36-43" and "Encounters, p.45" comments |
| `SPELLS`, `MU_CHART`, `schoolAllowed`, `schoolGate`, `schoolBonus`, `canLearn`, `rollGrimoire`, `INSANITY` | L2137–2224 | plus the "Magic User bonus table, p.18" comment; `maxCharges` (kept) directly follows `INSANITY` |
| `NAMES`, `nameFor` | L2274–2282 | |
| `bfs`, `shuffle` | L2286–2301 | plus the "maze generation" section banner (deleted — both declarations under it are gone) |
| `strikeDie`, `toHit`, `inDark`, `climbBonus`, `leapBonus`, `foeDie`, `foeToHitVs`, `weaponDamage` | L2631–2682 | `R_` (before) and `upkeep` (directly after) kept — both still live |
| `levelFromSP` | L2684 | |

### Kept, with the live reference

| Symbol | Reason |
|---|---|
| `CLASSES` | the module's `import { RACES, CLASSES, BAGS, ABILITY_BY_ID } from "./content/index.js"` line (a different binding of the same name) plus two module-side `Object.keys(CLASSES)`/`Object.values(CLASSES)` reads of that import — not references to the deleted classic top-level `const CLASSES` |
| `strikeDie`, `toHit` | the module's `import { ..., toHit, strikeDie, ... } from "./engine/derived.js"` line, plus `window.__mzStrikeDie = strikeDie;` / `window.__mzToHit = toHit;` bridge assignments — the engine's own functions of the same name, not the deleted classic ones |

None of the layer-3 names required force-restoring a classic declaration; all `refs NAME: 0` for the 54 deleted names.

## Tests re-pointed or deleted

| File | Change | Reason |
|---|---|---|
| `shell-combat-actions.test.js`, `shell-combat-screen.test.js`, `shell-fight-log.test.js`, `shell-input-guards.test.js` | end anchor `"function vitalsStrip()"` → `"function wireDeathConfirm()"` | `vitalsStrip` deleted this plan; `wireDeathConfirm` is the next surviving top-level declaration after the guard-helpers region |
| `shell-loot-screen.test.js` | same anchor change, via `CODE.indexOf(...)` | same |
| `shell-party-camp.test.js` | `paintRegion` end anchor `"\nfunction move(dir)"` → `"\nfunction eff(key)"` | classic `function move(dir)` deleted this plan; `eff` is the first surviving top-level declaration after `paint()` once `DIRV`/`OPP`/`move`/`newDay`/`teleport`/`bestTeleportDir`/`winGame` are gone |
| `shell-map-viewport.test.js` | keydown pin's literal `move(dirKeys[k])` → `window.move(dirKeys[k])` (Rule 1 fix, not in the plan's declared file list) | the plan's required rewrite of the bare call to the explicit bridge broke this pre-existing pin |
| `shell-armor-display.test.js` | the ARMOR-04 "classic (dead) CLOAKS table's Cloak of Armor txt mirrors the live string" case deleted, plus its now-unused `import { CLOAKS }` | classic `CLOAKS` gone this plan; `content/treasure-tables.js` is the single source, already covered by `hp-not-wp.test.js` and the treasure/economy unit tests |
| `shell-company-panel.test.js` | `subNoteRegion()` end anchor `"const NAMES = {"` → the `"/* ---------------- rendering ---------------- */"` banner (Rule 1 fix, not in the plan's declared file list) | `NAMES`/`nameFor` deleted this plan; `SUB_NOTE` (kept, DEAD-02/Plan 44-03 scope) is now directly followed by the rendering banner |

## Gate outputs

**At the Task 1 (layer 2) commit boundary (`c2aaeb4`):**
- `node tools/shell-sweep.mjs refs <41 layer-2 names>` — all `refs NAME: 0` except `reveal` (excluded from the run once restored, see above) and `move` (`node tools/shell-sweep.mjs refs move --ignore-window` → `refs move: 0`; `grep -cE "^\s*function move\(dir\)" mazeworld.html` → `0`).
- `grep -c "window.move(res.dir)" mazeworld.html` → `1`; `grep -c "window.move(dirKeys\[k\])" mazeworld.html` → `1`.
- `grep -c "else makeCamp()" mazeworld.html` → `0`; `grep -c "^\s*window.mzMakeCamp();" mazeworld.html` → `1`.
- `node tools/shell-sweep.mjs refs newBeat CAPTURE` (A-3) — `newBeat: 1` (own declaration, called live), `CAPTURE: 3` (declaration + two live reads); neither deleted.
- Graves sentinel intact: `@gsd:dual-write-convergence-extract:graves:start`/`:end` each `1`; `async function saveGraves()` → `1`.
- `npm run build:www` — exit 0. `npm run boot:check` — 4 `PASS` lines. `npm test` — 3242/3242, fail 0 (after the shell-map-viewport.test.js Rule 1 fix). `node --test test/unit/shell-map-invariants.test.js test/unit/shell-terrain-41.test.js` — fail 0.
- `wc -l < mazeworld.html` — `7023` (from `7670`).
- `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` — empty.

**At the Task 2 (layer 3) commit boundary (`32372e3`):**
- `node tools/shell-sweep.mjs refs <54 layer-3 names>` — all `refs NAME: 0` except the documented `CLASSES`/`strikeDie`/`toHit` import-line survivors (see "Kept, with the live reference" above).
- Structural greps: zero classic declarations of `STRIKE_DICE|CLASSES|WEAPON_MAX|WEAPON_TYPE_TABLE|WEAPON_BONUS_TABLE|ARMORS|MAGIC_ARMOR_TABLE|KIT|FREE_SKILL|BLADE_NAMES|JEWELRY|CLOAKS|STAVES|POTIONS|FOODS|TRAPS|AFFLICTIONS|FAERIE|MISC_MAGIC|SPELL_LEVEL_TABLE|CLIMB_TABLE|LEAP_TABLE|DIRECTION_TABLE|TEMPERAMENTS|MOTIVES|PHOBIAS|BESTIARY|ENC_TYPES|ENCOUNTER_TABLES|ENC_ALIAS|SPELLS|MU_CHART|INSANITY|NAMES|EPITAPHS|CAUSE_TEXT` remain (`0`); zero classic declarations of `pick|priceFor|rollSkills|skillTier|RACE_D8|schoolAllowed|schoolGate|schoolBonus|canLearn|rollGrimoire|nameFor|bfs|shuffle|strikeDie|toHit|inDark|climbBonus|leapBonus|foeDie|foeToHitVs|weaponDamage|levelFromSP` remain (`0`).
- Survivors intact: `D` (`1`), `R_` (`1`), `skillTable` (`1`), `upkeep` (`1`), `maxCharges` (`1`), `RACES|ROMAN|THRESHOLDS|WEAPONS|FIGHTER_SKILLS|THIEF_SKILLS|RACE_NOTE|CLASS_NOTE|SUB_NOTE` (`9`).
- `grep -c "Cloak of Armor txt mirrors" test/unit/shell-armor-display.test.js` → `0`.
- `npm run build:www` — exit 0. `npm run boot:check` — 4 `PASS` lines. `npm test` — 3241/3241, fail 0 (3242 minus the one intentionally-deleted CLOAKS-mirror case). `node --test test/unit/shell-map-invariants.test.js test/unit/hp-not-wp.test.js` — fail 0 (45/45).
- `wc -l < mazeworld.html` → `6600` (≤ 6,900 target).
- `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` — empty.
- `grep -rl "new Function" test/` — empty (DEAD-03, unchanged from Plan 44-01).

## Human verification (deferred to end of run)

Per the deferred-UAT protocol, batched to the milestone-close Pixel 7 round:

- Tap-to-move still steps the party through the maze (`window.move` bridge — `tapStep()`'s rewritten call site).
- Keyboard arrows on a hardware/BT keyboard still move the party (`window.move` bridge — keydown handler's rewritten call site).
- MAKE CAMP → SLEEP still camps through the engine (single `window.mzMakeCamp()` call, no classic fallback to silently mask a missing bridge).
- A trap / chest / find / faerie encounter reached by walking still resolves through the engine's own rail cards (the classic `springTrap`/`openChest`/`encounterDot`/`findFood`/etc. that used to run this content are gone; the engine-side equivalents are the only live path).
- Death and resume: dying still buries the character and shows an epitaph (via the engine's own death path, not the deleted classic `die`/`bury`/`EPITAPHS`); relaunching mid-run still resumes correctly (the restored `reveal()` call in `window.__mzClassicBoot`'s resume branch).
- The Hero-tab dossier (RACE_NOTE/CLASS_NOTE/SUB_NOTE) is untouched this plan — its migration to the `window.__mzTables` bridge is Plan 44-03 (DEAD-02), not this plan.

## Flagged assumptions

- **A-1** (per-layer name lists are the planner's reachability estimate): status after this plan — **held, escape hatch exercised once, forward direction.** `reveal` was restored (with its comment) after `shell-sweep.mjs refs` reported a genuine live reference from `window.__mzClassicBoot`'s resume branch — the one case in either layer where a name in the plan's deletion list needed to be kept. All other 94 names across both layers (41 in layer 2, 54 in layer 3 — `move` counted once) reported `refs NAME: 0` cleanly.
- **A-3** (`newBeat`/`CAPTURE` survival after layer 2): **resolved — both kept.** `refs newBeat CAPTURE` after the layer-2 deletion showed both still called from live code (`act()`/`say()`), independent of the deleted `beginEvent`/`evt` wrappers that merely delegated to them.

## Next Phase Readiness

- `mazeworld.html` is at 6600 lines, `# fail 0` at 3241 tests, engine gate diff empty, `grep -rl "new Function" test/` empty. Ready for Plan 44-03 (DEAD-02 — the Hero-tab dossier bridge to `content/flavor.js` via `window.__mzTables`, replacing the still-live classic `RACE_NOTE`/`CLASS_NOTE`/`SUB_NOTE`).
- Plan 44-04 (persistence/boot slimming) has its scope confirmed and slightly sharpened by this plan: `window.__mzClassicBoot`'s resume branch still calls the now-restored `reveal()` — that call site (and the "Delve resumed." lines re-homing CONTEXT.md already flagged) is exactly what Plan 44-04 needs to remove, at which point `reveal()` becomes genuinely deletable.
- No blockers.

## Self-Check: PASSED

- FOUND: `mazeworld.html` (6600 lines, confirmed via `wc -l`)
- FOUND: `tools/shell-sweep.mjs` (`isForeignMemberAccess` present)
- FOUND commit: `c2aaeb4`
- FOUND commit: `32372e3`
- CONFIRMED: `grep -c "Cloak of Armor txt mirrors" test/unit/shell-armor-display.test.js` = `0`
- CONFIRMED: `npm test` = 3241/3241, fail 0
- CONFIRMED: `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` = empty

---
*Phase: 44-retire-the-classic-engine-from-the-shell*
*Completed: 2026-09-19*
