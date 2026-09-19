# Phase 44: Retire the Classic Engine from the Shell - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning
**Mode:** Autonomous smart discuss — infrastructure phase (dead-code deletion; ROADMAP: "Discuss: not worth a round — the deletion list was verified by direct code read"). No user questions asked; the rulings below are derived from standing user rulings, not new decisions.

<domain>
## Phase Boundary

`mazeworld.html` carries only the live shell. The 16 pre-extraction classic-engine mirrors (`castSpell`, `parley`, `startCombat`, `meetJoiner`, `genFloor`, `rollCharacter`, `descend`, `makeCamp`, `takeItem`, `useItem`, `playerStrike`, `foeTurn`, `killFoe`, `openStore`, `readScroll`, `drinkPotion`) and every helper, table or constant reachable only from them are deleted; the Hero-tab dossier reads `content/flavor.js` (classic `SUB_NOTE` gone) with a source-pin test against any second copy of a `content/` table; every test that `new Function`/`vm`-extracts a classic helper from the shell is re-pointed at the `engine/`/`content/` implementation or deleted with its reason recorded. Requirements DEAD-01, DEAD-02, DEAD-03.

**Hard scope fence:** zero bytes change under `engine/`, `content/`, `test/parity/fixtures/`, `test/parity/prototype-master.js.txt` (success criterion 5 — `git diff --stat <phase-start> -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` must be empty). The game plays identically; any device check is batched to the milestone-close Pixel 7 round (deferred-UAT protocol).

**Phase-start baseline (measured 2026-09-19, commit `ba45dfd`):** `mazeworld.html` = **8,710 lines** (the ROADMAP's 8,607 predates quick task 260919-00d) → success criterion 2 target is **≤ 6,710**. Classic `<script>` spans L1693–L7182 (5,490 lines); the `<script type="module">` spans L7184–L8707. 3,257 tests green.

</domain>

<decisions>
## Implementation Decisions

### Sweep rulings (derived from the 2026-09-17 greenfield ruling — "no dual-path code, fixtures follow" — and ROADMAP Phase 44; not new user decisions)
- **Reachability roots are the live shell only:** references from the module script (comments and string literals excluded — the module mentions `"castSpell"` etc. only as action-type strings, L8433/L8503–8509), HTML `id`/`onclick` wiring, and classic top-level statements. A comment or a prose string that names a function is not a reference.
- **`window.move` / `window.newGame` are module overrides, so the classic bodies are dead.** The module assigns `window.move = function engineMove(dir)` (L7878) and `window.newGame = async function engineNewRun()` (L8020); classic `function move(dir)` (L3615–3712) and `function newGame()` (L6743–6751) are the only two classic globals the module overwrites (measured: `comm` of module `window.X =` targets vs classic top-level declarations). The classic bare calls that resolve to those overrides at runtime — `move(res.dir)` in `tapStep()` (L6963) — are rewritten to the explicit bridge form (`window.move(...)`) so the shell reads honestly once the classic declaration is gone.
- **Every `else classicX()` fallback is deleted, not preserved:** `newGame()` fallbacks at L5550 (`wireDeathConfirm`), L6275 (`btn-again`), L6769 (`btn-save-quit`), L6785/L6789 (abandon-character), `else makeCamp()` at L6875, and the captured `const classicNewGame = newGame` (L6759). The module bridges (`window.mzReturnToTitle` / `mzStartRoll` / `mzAbandonRun` / `mzAbandonCharacter` / `mzMakeCamp`) are the only path; a missing bridge is a boot bug to surface, not a reason to keep a second engine.
- **`window.__mzClassicBoot` (L7165–7181) keeps only what is live:** `renderGravesLoading()` → `await loadGraves()` → `renderGraves()` → `fit()` → `paint()`. Its `load()` → `S = restored` / `reveal()` / `classicNewGame()` branch is deleted: the module already did `window.__mzState.set(engineState)` (L7667) from `engineAdapter.boot()` BEFORE awaiting `__mzClassicBoot()` (L8224), and today's cold-boot-with-no-save path actually clobbers that engine state with a classic `rollCharacter(true)`/`genFloor(1)` roll and writes a classic-shaped save (`newGame()` → `save()`) — the last live foothold of the dead engine. The two resume lines (`"Delve resumed."` banner + `"{name}, {race} {sub}, skill level {ROMAN}, on floor {depth} of the dungeon."`) are player-facing Oracle text and MUST survive: move them to the module boot path, emitted only when `boot()` rehydrated a save (the module already computes `hadSaveAtLaunch`, L7652–7659), unless the planner finds the module already logs an equivalent resume banner (then delete, and say so in the SUMMARY).
- **Classic run-save persistence dies with `newGame`:** classic `save()`/`load()` (L6725–6739, inside the `@gsd:dual-write-convergence-extract:save` sentinel block L6715–6740) and the classic `SAVE_KEY` (L1792) are reachable only from dead paths (`move`, `openChest`, `die`, `newGame`) once the fallbacks go; `engineAdapter.js#persist()/boot()` is the one run-save path (its own `SAVE_KEY` literal at `src/browser/engineAdapter.js:48` stays). The **graves** block (`saveGraves()/loadGraves()`, sentinel L5275–5330) is LIVE and untouched.
- **Classic `reveal()` (L2690) is dead:** the engine owns fog reveal (`engine/movement.js:339/862/967` `reveal(f, revealRadius(state))`); the classic one is called only from `move`, `teleport`, `descend`, `newGame` and the `__mzClassicBoot` load branch.
- **Deletion is by reachability, not by name list:** the executor sweeps to a fixed point — delete, then word-boundary grep the post-deletion shell for every deleted symbol (must be 0 outside comments), then `npm run build:www` + boot to the map tab in the browser dev loop + `npm test`. The SUMMARY lists every deleted symbol (DEAD-01 success criterion 1).
- **Ordering:** commit the deletion in reachability layers (mirrors → movement/encounter engine → orphaned tables/helpers → persistence/boot slimming) so any boot regression bisects to one commit. Tests are re-pointed in the same commit as the deletion that breaks them (the suite never sits red at a commit boundary).

### DEAD-02 — dossier from `content/flavor.js`
- `content/flavor.js` exports `RACE_NOTE`, `CLASS_NOTE`, `SUB_NOTE` (L24/L33/L39). The classic Hero-tab dossier render (L3589–3592) reads classic `RACE_NOTE[c.race]`, `CLASS_NOTE[c.cls]`, `SUB_NOTE[c.sub]` — all three classic tables go, not just `SUB_NOTE` (a "second copy of any exported `content/` table" is the success criterion 3 wording).
- The classic script cannot `import`; hand the three tables across on the established bridge pattern (`window.__mzState` / `window.__mzControls` / `window.__mzIconMap` — module-assigned, classic-read; first `paint()` is the module's own call at L7668, after all bridge assignments). Exact bridge name at the planner's discretion (Phase 47's SHELL-04 registry will list it); do NOT carve the dossier into a module here — that is Phase 47's `heroTab.js`.
- Source-pin test (new `test/unit/shell-*.test.js` in the existing readFileSync-regex style): fails if `mazeworld.html` declares `SUB_NOTE`, `RACE_NOTE`, `CLASS_NOTE`, or any other `content/` export name as a classic `const`/`let`/`function`; and a byte-equality check that each of the 24 sub-class dossier strings the shell renders equals `content/flavor.js`'s (assert the shell reaches the text only through the bridge).

### DEAD-03 — the extraction tripwires
- `test/unit/parley-button-mirror.test.js` — `new Function`-extracts classic `fluency()`/`canParley()` and replays 576 cases. The engine side is already pinned by `test/unit/parley.test.js`'s prose oracle (`expectedCanParley`, 576 cases, mismatches=0 — Phase 20-03). Delete, with that reason recorded in the SUMMARY (or re-point the 576-case replay at `engine` `canParley` if the planner finds the oracle test does not cover the same matrix).
- `test/unit/spell-menu-mirror.test.js` — `new Function`-extracts classic `canCast(sp)`; re-point the same matrix at the engine's `canCast` (locate in `engine/magic.js`/`engine/derived.js`) with the extraction removed, or delete if `test/unit/magic*.test.js` already pins it.
- `test/persistence/dual-write-convergence.test.js` + `harness/sandboxClassicPersistence.js` — `vm`-extracts BOTH sentinel blocks. Keep the graves half (live); drop the `save` half and its markers with the deletion of classic `save()/load()` (engineAdapter persistence is covered by `test/unit/engineAdapter.test.js`).
- `test/parity/harness/sandboxPrototype.js` extracts `prototype-master.js.txt`, NOT the shell — untouched.
- The ~25 `test/unit/shell-*.test.js` readFileSync source pins (and `casters-can-act`, `cutthroat-joiner`, `hp-not-wp`, `shell-company-panel`, `shell-worn-slots`, which grep classic-engine strings such as `function eff(`/`SUB_NOTE`/`const CLOAKS`) are re-pointed individually as the sweep breaks them — each re-point or deletion gets one line in the SUMMARY with its reason. `shell-map-invariants.test.js` must stay green throughout.
- After the phase: `grep -rl "new Function" test/` is empty.

### Claude's Discretion
- Exact commit slicing, the bridge object's name, the new source-pin test's file name, and whether `ROMAN`, `D`, `pick`, `nameFor`, `rollGrimoire`, `WEAPONS`, `SPELLS`, `EPITAPHS`/`epitaphFor`, `mwActiveTab` survive — decided by the post-deletion grep, not by this document.

</decisions>

<code_context>
## Existing Code Insights

### Measured reachability (scratch analysis 2026-09-19 over the classic script; grep-graph with comments/strings stripped, `window.move`/`window.newGame` overrides and the `else classicX()` fallbacks treated as cut points)
- 253 classic top-level declarations; **~101 fall out (~1,727 lines of declaration bodies, before their doc-comment blocks)** — the −2,000 is real. Expected dead set (line numbers at `ba45dfd`):
  - **The 16 mirrors:** `rollCharacter` L2360–2429, `genFloor` L2485–2566, `makeCamp` L3783–3794, `descend` L3855–3865, `takeItem` L3948–3974, `useItem` L3982–4014, `openStore` L4261–4306, `meetJoiner` L4471–4478, `startCombat` L4542–4605, `playerStrike` L4621–4708, `killFoe` L4710–4743, `castSpell` L4783–4980, `drinkPotion` L4982–4992, `parley` L5045–5064, `readScroll` L5106–5124, `foeTurn` L5167–5232.
  - **Classic movement/encounter engine:** `move` L3615–3712, `newDay` L3714–3769, `teleport` L3796–3841, `bestTeleportDir` L3843–3853, `winGame` L3867–3877, `giveItem` L3896–3901, `gainWilmst`/`LOOT_DIVISOR` L3906–3917, `hasPicks`, `rollJewel`/`rollCloak`/`rollStaff`/`rollBlade`/`rollMailPiece`/`rollTreasureItem` L3918–3946, `springTrap` L4326–4340, `openChest` L4343–4373, `encounterDot` L4375–4399, `tableFour` L4402–4416, `findFood`/`findGrimoire`/`findGear`/`findMisc`/`meetFaerie`/`catchAffliction`/`goInsane`/`newPhobia`/`fallDark` L4418–4516, `rollInitiative`/`liveFoes` L4607–4619, `checkLevel` L4745–4781, `flee` L4994–5009, `TALKATIVE`/`fluency`/`canParley` L5012–5044, `SONGS`/`songReady`/`sing` L5066–5100, `endCombat`/`afterPlayerAction`/`allyTurn` L5126–5165, `die` L5250 (+ `epitaphFor` L2341, `EPITAPHS`), `newGame` L6743–6751, `classicNewGame` L6759, classic `save`/`load` L6725–6739, `reveal` L2690, `vitalsStrip` L5525–5533.
  - **Orphaned classic content tables** (the live shell imports `content/` in the module): `BESTIARY` L2055–2121, `ENCOUNTER_TABLES`/`ENC_ALIAS`/`ENC_TYPES` L2122–2135, `DIRECTION_TABLE` L2026–2041, `CLIMB_TABLE`/`LEAP_TABLE` L2015–2021, `SPELL_LEVEL_TABLE` L2014, `WEAPON_MAX`/`WEAPON_TYPE_TABLE`/`WEAPON_BONUS_TABLE` L1850–1858, `MAGIC_ARMOR_TABLE` L1866, `FIGHTER_SKILLS`/`THIEF_SKILLS` L1889–1913, `BLADE_NAMES`/`JEWELRY`/`STAVES`/`POTIONS`/`FOODS`/`TRAPS`/`AFFLICTIONS`/`FAERIE`/`MISC_MAGIC` L1938–2013, `INSANITY` L2221, `SUB_NOTE` L2445 (+ `RACE_NOTE` L2432, `CLASS_NOTE` L2440 per DEAD-02), `DIRV`/`OPP` L3612–3613.
  - **Orphaned combat-math helpers:** `priceFor` L1868, `skillTier` L1933, `schoolBonus` L2187, `canCast` L2196, `toHit` L2916, `inDark` L2927, `climbBonus`/`leapBonus` L2931–2932, `foeDie` L2933, `foeToHitVs` L2937, `weaponDamage` L2948, `levelFromSP` L2962, `beginEvent` L2843, `itemReady` L3977.
- **Known false edges in the grep-graph** (why the executor must verify by post-deletion grep, not trust this list): prose words in flavor strings (`die`, `move`, `flee`, `reveal`) and object keys (`flee: () => window.mzFlee?.()` L5934) read as references; the HTML head's title text roots `die`/`save`. Conversely `mwActiveTab` (L1733) is probably live via assignment — check before deleting.
- **Live classic code that stays** (rooted from the module/HTML): the tab painters (`paint()` L3261, `draw()` L2722, `renderEncounter` L6161, `renderRail`, `renderCombatOver`, `showTab`, `fit`, camera/pan, `tapStep` L6939, `wireDeathConfirm` L5544, `hasActiveEncounter`, `COMBAT_DISPATCH` L5924 — all routed through `window.mz*` bridges), the graveyard (`saveGraves`/`loadGraves`/`renderGraves`), `S` + `window.__mzState` (L2347–2354), `window.__mzClassicBoot` (slimmed), `epitaph` rendering if the death card reads it (check `die`'s survivors).

### Reusable Assets
- **Bridge pattern:** `window.__mzState = { get, set }` (L2354), `window.__mzControls` (module-assigned, `tapStep` reads it L6950), `window.__mzIconMap = await preloadIcons(...)` (L7620) — the shape for handing `content/flavor.js` tables to the classic dossier render.
- **Source-pin test style:** `test/unit/shell-map-invariants.test.js` and the 24 other `test/unit/shell-*.test.js` files (readFileSync + regex over `mazeworld.html`; assert exactly-once/never-present) — copy for the DEAD-02 "no second copy of a `content/` table" pin.
- **Engine-side oracles already pinning what the tripwires guarded:** `test/unit/parley.test.js` (`expectedCanParley`, 576 cases), `test/unit/engineAdapter.test.js` (persist/boot), the magic unit tests for `canCast`.
- `tools/build-www.mjs` (`npm run build:www`) — the parse/boot gate for the shell; `npm test` = 3,257 tests ≈ 24 s.

### Established Patterns
- Classic-script `function` declarations are `window` properties; the module reassigns exactly two (`move`, `newGame`) and otherwise adds `window.mz*` / `window.__mz*` bridges — never a third code path.
- Action dispatch: every live player action goes `window.mz*` → `engineCombatAction()`/`inventoryAction()`/`stepWith()` → `engineAdapter.dispatch()` → `window.__mzState.set(state)` → `paint()`; the classic `S` is a render mirror only.
- Sentinel-comment extraction (`/* @gsd:...:start */ … :end */`) is how persistence tests reach classic source; a deleted block must take its markers and its harness half with it.
- Commit discipline from prior phases: one deletion layer per commit, test re-points in the same commit, SUMMARY carries the symbol list and the per-test reason lines.

### Integration Points
- `mazeworld.html` L7165–7181 (`__mzClassicBoot`), L7640–7670 (module boot: `hadSaveAtLaunch`, `boot(freshSeed)`, `__mzState.set`, first `paint()`), L8224 (`await window.__mzClassicBoot()`), L3586–3594 (dossier render), L6939–6970 (`tapStep`), the five `newGame()` fallback sites, L6875 (`else makeCamp()`).
- `test/persistence/harness/sandboxClassicPersistence.js` (`extractBlock` for the `graves` and `save` sentinels), `test/persistence/dual-write-convergence.test.js`.
- `test/unit/parley-button-mirror.test.js`, `test/unit/spell-menu-mirror.test.js` (the only two `new Function` sites).
- `.planning/ROADMAP.md` Phase 44 success criteria (the acceptance greps) and `REQUIREMENTS.md` DEAD-01..03.

</code_context>

<specifics>
## Specific Ideas

- The success-criterion greps are the plan's acceptance checks verbatim: the 16-name `grep -cE` → 0; `wc -l mazeworld.html` ≤ 6,710; `grep -rl "new Function" test/` empty; `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` empty; `npm run build:www` green; `npm test` fail 0.
- Human verification is deferred to the milestone-close Pixel 7 batch (deferred-UAT protocol): the SUMMARY carries a short "Human verification (deferred to end of run)" list — cold boot with no save reaches the title → roller → map; resume shows the "Delve resumed." Oracle lines; the Hero-tab dossier reads correctly for a Thief/Fighter/Magic User; a death still buries the character (graves path untouched).

</specifics>

<deferred>
## Deferred Ideas

- Carving the dossier/Hero tab into `src/browser/heroTab.js` — Phase 47 (SHELL-02).
- Renaming `dispatchWithToasts`/`toasts.js` and removing `winGame`/`state.won` from the engine — Phase 46 (NAME-01, DEAD-04); this phase deletes only the classic `winGame()` in the shell.
- Purging the "dead classic X()" comment archaeology that survives in live functions — Phase 48 (DOCS-01); this phase only removes comments attached to deleted code.

</deferred>
