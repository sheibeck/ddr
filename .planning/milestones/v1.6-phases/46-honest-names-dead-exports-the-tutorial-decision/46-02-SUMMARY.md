---
phase: 46-honest-names-dead-exports-the-tutorial-decision
plan: 02
subsystem: engine
tags: [dead-code, win-flag, parity-harness, save-validation, tolerant-load]

requires:
  - phase: 46
    provides: "46-01's narrationLines rename (LINE_FOR/linesForAction/dispatchWithNarration) — this plan imports from the renamed module unchanged"
provides:
  - "engine/movement.js with winGame() and its JSDoc deleted; the three move/useTool/makeCamp guards read combat/store/dead only"
  - "engine/engine.js's abandon guard reads !next.dead alone"
  - "engine/saveState.js's validateSave/rehydrate whitelists that never copy a won key — a stale won:true save loads tolerantly, pinned by a new DEAD-04 test"
  - "engine/state.js's fresh state with no won key; engine/events.js with no WON type/won() creator; engine/death.js's note falls back to a plain \"died\""
  - "src/browser/eventNarration.js and narrationLines.js's ORACLE_ONLY with their won entries removed; both coverage guards' KNOWN_INDIRECT_TYPES follow"
  - "test/parity/harness/comparables.js's three *Comparable() fns + the three local parity comparables destructuring the prototype-side won out (a Phase 46 retired-field carve-out, the stripRetiredCounterFields precedent) — zero fixture moves, master hash unchanged"
  - "tools/lib/tuning-bot.mjs, class-matrix.mjs, tune-difficulty.mjs with every won read/field dropped (outcome bucket is now \"dead\" | \"stuck\" | \"unknown\")"
affects: [46-03, 46-04, 48]

tech-stack:
  added: []
  patterns:
    - "Retired-field carve-out (stripRetiredCounterFields precedent): when a frozen-prototype-only field the engine no longer carries would otherwise trip diffState's key-set mismatch, destructure it out of the prototype-side comparable rather than reconcile or special-case it — a one-word strip, not a fixture regeneration"
    - "Tolerant load by omission: a validateSave/rehydrate whitelist that simply never copies a retired key IS the tolerant load — no fold, no read-back, no migration code required"

key-files:
  created: []
  modified:
    - mazeworld.html
    - tools/store-screenshots/bot.js
    - test/unit/shell-combat-over.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-loot-screen.test.js
    - test/unit/shell-map-viewport.test.js
    - engine/movement.js
    - engine/engine.js
    - engine/saveState.js
    - engine/state.js
    - engine/events.js
    - engine/death.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js
    - test/parity/full-suite.test.js
    - test/roundtrip/serialize-rehydrate.test.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/narrationLinesCoverage.test.js
    - test/unit/formatEventsCoverage.test.js
    - tools/lib/tuning-bot.mjs
    - tools/lib/class-matrix.mjs
    - tools/tune-difficulty.mjs
    - test/unit/movement.test.js
    - test/unit/endless-descent.test.js
    - test/unit/engine-purity.test.js
    - test/unit/permadeath.test.js
    - test/unit/effects.test.js
    - test/unit/death.test.js
    - test/unit/engineAdapter.test.js
    - test/unit/save-validation.test.js
    - test/unit/newrun.test.js

key-decisions:
  - "Premise correction recorded and acted on: DEAD-04/ROADMAP criterion 2 describe removing \"the harness carve-out that strips won\" — no such carve-out existed (grep -n won test/parity/harness/*.js at 39c5a0f returns 0 lines). The field was compared LIVE on both sides; removing the engine field required ADDING a prototype-side strip (the stripRetiredCounterFields precedent), which is what this plan's harness commit does. The criterion-2 grep still returns 0 (a destructured won carries no dot)."
  - "Extended the zero-straggler grep sweep beyond the plan's literal files_modified list to three files it did not name (test/parity/full-suite.test.js, test/roundtrip/serialize-rehydrate.test.js, test/unit/newrun.test.js) — each carried a comment or assertion that would have failed the plan's own acceptance-criteria grep or broken once the engine no longer set state.won. Treated as Rule 1 (bug) auto-fixes: required for the plan's own gate to pass, not scope creep."
  - "movement.test.js's fixedState() helper had its own won: false literal (not called out explicitly in the plan's action text) — removed it once the L714 assertion was changed to assert.ok(!(\"won\" in state)), since fixedState() otherwise always injected an inert won key that a real newRun() state no longer carries, causing a false test failure."

requirements-completed: [DEAD-04]

coverage:
  - id: D1
    description: "winGame() and the won run flag removed end to end (movement guards, abandon guard, serialize/validate/rehydrate, state init, WON event type, death note branch, narration tables + coverage guards, tools, tests); a stale won:true save loads tolerantly (pinned); the parity harness gains exactly the six one-word retired-field strips with zero fixture moves and an unchanged master hash"
    requirement: "DEAD-04"
    verification:
      - kind: unit
        ref: "npm test — # pass 3240, # fail 0"
        status: pass
      - kind: unit
        ref: "node --test test/parity/*.test.js — # pass 39, # fail 0"
        status: pass
      - kind: other
        ref: "grep -rnE \"winGame|state\\.won|\\.won\\b\" engine/ src/ mazeworld.html test/ tools/ test/parity/harness/ | grep -vE \"prototype-master\\.js\\.txt|COMBAT_COPY\\.over\\.won\" — (empty); grep -rnwE \"won|WON\" engine/ — (empty)"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-09-19
status: complete
---

# Phase 46 Plan 02: winGame / won Run-Flag Removal Summary

**Deleted `engine/movement.js#winGame()` and the `won` run flag end to end (four movement/abandon guards, serialize/validate/rehydrate, the WON event type, the death-note branch, both narration tables + coverage guards, three tools files, and every test pin), with a stale `won: true` save now loading tolerantly (pinned) and the parity harness gaining exactly six one-word prototype-side retired-field strips — zero fixture moves, master hash unchanged.**

## Performance

- **Duration:** ~40min
- **Started:** 2026-09-19
- **Completed:** 2026-09-19
- **Tasks:** 3
- **Files modified:** 33 (6 in Task 1's commit, 27 in Task 2's commit) + this SUMMARY

## Accomplishments

- Shell layer (Task 1, one commit): every `S.won` read deleted — the won card (`Through the Gate`/`btn-again`), the `.stone.won`/`.deathcard` CSS (the won card was the only `.deathcard` user), the graveyard stone's won ternary, the over-map gate, the stair gate, `railEl.hidden`, `hadSaveAtLaunch`, the combat-snapshot guard, `hasActiveDelveSave`, `hasLiveRun`, and two stale keyboard comments — behaviour-identical while the engine still carried the flag
- Engine layer (Task 2, one commit): `winGame()` and its JSDoc deleted from `engine/movement.js`; the three `|| state.won` guards (move/useTool/makeCamp) dropped; `engine.js`'s abandon guard reads `!next.dead` alone; `engine/saveState.js`'s validateSave/rehydrate whitelists no longer copy a `won` key (tolerant load by omission — no fold, no migration); `engine/state.js`'s fresh state carries no `won` key; `engine/events.js`'s `WON` type + `won()` creator deleted; `engine/death.js`'s walked-out note branch collapsed to a plain `"died"` fallback
- `grep -rnwE "won|WON" engine/` returns empty across all six touched engine files — not just the guard removals but every comment mentioning the retired flag was reworded
- Narration tables: `eventNarration.js`'s `won:` entry and `narrationLines.js`'s ORACLE_ONLY `"won"` entry deleted; both coverage guards' `KNOWN_INDIRECT_TYPES` follow (`LINE_FOR` stays internally consistent, no unreachable entry)
- Parity harness: the six top-level comparable destructures (`harness/comparables.js`'s three `*Comparable()` fns + the three local test comparables in combat/magic/movement-parity.test.js) each gain a `won` strip with a Phase 46 rationale comment — a retired-field carve-out (the `stripRetiredCounterFields` precedent), not a reconcile or fixture regeneration; `node --test test/parity/*.test.js` passes with exactly these six one-word edits, zero fixture moves, master hash unchanged
- `tools/lib/tuning-bot.mjs`, `class-matrix.mjs`, `tune-difficulty.mjs` — every `won` read/field dropped; `playRun`'s `outcome` bucket is now `"dead" | "stuck" | "unknown"` (was `"dead" | "won" | "stuck" | "unknown"`)
- DEAD-04's stale-save pin: a new test in `test/unit/save-validation.test.js` proves a save carrying `won: true` loads (`ok: true`), and neither the validated value nor the rehydrated state carries a `won` key
- Every remaining functional/test pin re-measured live: `endless-descent.test.js`, `engine-purity.test.js`, `movement.test.js` (dormant winGame test deleted, one guard-array test re-pinned, one gate-tile test reworded), `permadeath.test.js`, `effects.test.js`, `death.test.js` (retitled + reworded to a plain-died-note test), `engineAdapter.test.js` (html.length 4→3, Gate assertion dropped), `newrun.test.js`

## Task Commits

1. **Task 1: shell layer — every S.won read, the won card, the graveyard stone branch and CSS, the screenshot bot; shell test anchors re-pointed** — `af9b313` (refactor)
2. **Task 2: engine + harness + narration tables + tools + unit tests — winGame and the won flag removed, stale saves tolerant, one retired-field strip** — `990ad88` (refactor)

**Plan metadata:** committed via `<final_commit>` (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Premise correction (DEAD-04 "harness carve-out")

DEAD-04 and ROADMAP criterion 2 speak of removing "the harness carve-out that strips `won`". No such carve-out existed:

```
$ git show 39c5a0f:test/parity/harness/comparables.js | grep -n won | wc -l
0
```

Before this plan, the `won` field was compared LIVE on both sides of the parity diff: the frozen prototype (`test/parity/prototype-master.js.txt`) initialises its top-level `won` flag to `false` at every fixture replay, and the pre-existing engine carried `won: false` too — `diffState`'s key-set-mismatch semantics (`test/parity/harness/diffState.js#findDivergence`) meant both sides needed the SAME keys, so nothing needed stripping while both sides had the field.

Removing the engine field (this plan's whole point) therefore REQUIRED **adding** a prototype-side strip, not removing an existing one — the `stripRetiredCounterFields` precedent (Phase 39/GEAR-02: "strip from WHICHEVER side carries it"). This plan's harness commit adds exactly that: `won` destructured out of the prototype-side literal in all six comparable sites, each carrying a Phase 46 rationale comment.

The criterion-2 grep still returns 0 (a destructured `won` carries no dot, doesn't match `\.won\b`), no comparable reconciles or special-cases a won state, zero fixture files moved, and the master file was never edited. The intent of ROADMAP criterion 2 — "the comparables carry no won handling" — is met in substance: one retired-field strip, not a reconcile, not a special case.

## Survivors of the criterion-2 grep

```
$ grep -rnE "winGame|state\.won|\.won\b" engine/ src/ mazeworld.html test/ tools/ test/parity/harness/ | grep -vE "prototype-master\.js\.txt"
mazeworld.html:3802:  const copy = COMBAT_COPY.over[kind] || COMBAT_COPY.over.won;
mazeworld.html:3989:        buttons: [{ id: "cb-over-btn", label: COMBAT_COPY.over[b.over] ? COMBAT_COPY.over[b.over].btn : COMBAT_COPY.over.won.btn, cls: "", onTap: () => { S.beats = null; renderEncounter(); } }],
```

Both lines are `COMBAT_COPY.over.won` — the **fight-outcome** copy key ("THEY ARE DOWN"), a live identifier for winning a FIGHT, not the retired run-terminator flag. Per the plan's own prohibition, these were left untouched and are listed here as the intended survivors. (The frozen `test/parity/prototype-master.js.txt` also still contains historical `won`/`winGame` text — excluded from the grep above as the third allowed survivor category, never edited.)

## Engine diff (the won removal only)

`git diff --stat 39c5a0f -- engine/` touches exactly the six files this plan's fence names, no others:

```
 engine/death.js     |  4 ++--
 engine/engine.js    |  4 ++--
 engine/events.js    |  4 +---
 engine/movement.js  | 30 +++++++-----------------------
 engine/saveState.js | 22 ++++++++++++++--------
 engine/state.js     |  3 +--
 6 files changed, 30 insertions(+), 37 deletions(-)
```

Full diff:

```diff
diff --git a/engine/death.js b/engine/death.js
index 8029377..130aba9 100644
--- a/engine/death.js
+++ b/engine/death.js
@@ -74,7 +74,7 @@ function buildRunSummary(state, cause, when) {
     gold: c.gold,
     kills: c.kills || 0,
     cause,
-    note: state.deathNote || (cause === "won" ? "walked out" : "died"),
+    note: state.deathNote || "died",
     epitaph: state.epitaph,
     when,
   };
@@ -135,8 +135,8 @@ export function die(state, cause, detail, rng, events = [], now = Date.now) {
 
 /**
  * bury(state, cause, detail, graves, now) — builds this run's RunSummary
- * (from state.deathNote/state.epitaph, already set by die() or a winGame
- * path) and returns a NEW graves array with it unshifted and capped at 60.
+ * (from state.deathNote/state.epitaph, already set by die()) and returns a
+ * NEW graves array with it unshifted and capped at 60.
  * The graveyard array itself is owned by the persistence layer — this
  * function never touches localStorage (ports mazeworld.html bury(), lines
  * 2950-2961, sans storage and DOM re-render).
diff --git a/engine/engine.js b/engine/engine.js
index 0b3adc7..a43759a 100644
--- a/engine/engine.js
+++ b/engine/engine.js
@@ -115,8 +115,8 @@ export function applyAction(state, action) {
       // terminator every other death in the game calls) so it goes through
       // this ONE rngState-persisting seam rather than presentation code
       // rolling its own epitaph off-band. A no-op if the run is already
-      // over (dead/won) — nothing left to abandon.
-      if (!next.dead && !next.won) die(next, "abandon", null, rng, events);
+      // over (dead) — nothing left to abandon.
+      if (!next.dead) die(next, "abandon", null, rng, events);
       break;
     case "resolveJoiner":
       // PARTY-01 (Phase 9): accept/decline the pending Joiner meetJoiner stashed.
diff --git a/engine/events.js b/engine/events.js
index 04481ff..97197bb 100644
--- a/engine/events.js
+++ b/engine/events.js
@@ -14,7 +14,6 @@ export const EVENT_TYPES = {
   FLOOR_CHANGED: "floorChanged",
   DIED: "died",
   LEVELED: "leveled",
-  WON: "won",
 };
 
 /** moved(to) — the player stepped to grid cell `to` ({x, y}). */
@@ -31,6 +30,3 @@ export const died = (cause) => ({ type: EVENT_TYPES.DIED, cause });
 
 /** leveled(level, wpGain) — the character reached a new skill level. */
 export const leveled = (level, wpGain) => ({ type: EVENT_TYPES.LEVELED, level, wpGain });
-
-/** won(level, day, steps) — the run reached the Gate and won. */
-export const won = (level, day, steps) => ({ type: EVENT_TYPES.WON, level, day, steps });
diff --git a/engine/movement.js b/engine/movement.js
index ded2277..6d2f747 100644
--- a/engine/movement.js
+++ b/engine/movement.js
@@ -2,8 +2,8 @@
 //
 // The movement domain (ENG-01, ENG-05) — the first rule domain routed
 // through applyAction, and the walking skeleton's proof slice. Ports
-// mazeworld.html's move/newDay/makeCamp/teleport/bestTeleportDir/descend/
-// winGame (lines 1614-1868), replacing every D()/pick()-backed Math.random()
+// mazeworld.html's move/newDay/makeCamp/teleport/bestTeleportDir/descend
+// (lines 1614-1868), replacing every D()/pick()-backed Math.random()
 // draw with the injected engine rng (in the prototype's exact consumption
 // order), and every say()/evt()/beginEvent() narration call with a pushed
 // `{type, ...}` event. No DOM, no localStorage, no Math.random, no global S
@@ -19,8 +19,9 @@
 // anymore, so "exit" is the only descent tile a freshly-generated floor can
 // have; the "gate" branch survives ONLY as legacy-save compatibility — an
 // in-flight save from before this change may still hold a "gate" tile, and
-// stepping onto it now routes to descend() (never winGame()), so permadeath
-// is the sole run terminator. Circular import with engine/encounters.js
+// stepping onto it now routes to descend(), so permadeath is the sole run
+// terminator (Phase 46, DEAD-04: the unreachable win path is gone entirely).
+// Circular import with engine/encounters.js
 // (encounterDot/springTrap/openChest call back into teleport() here;
 // move()/teleport() call them) is safe — see engine/encounters.js's header
 // comment for why.
@@ -29,11 +30,11 @@ import { GW, GH, genFloor, reveal, refogSpellSeen } from "./maze.js";
 import { difficultyCurve, scaleHazard } from "./difficulty.js";
 import { skill, skillTier, upkeep, eff, revealRadius, isFlying, armorBulk, itemEffectActive, activationFor, hasTool, moveCost, inStone } from "./derived.js";
 import { rollDice } from "./dice.js";
-import { die, epitaphFor, epitaphCtx } from "./death.js";
+import { die } from "./death.js";
 import { checkLevel } from "./character.js";
 import { startCombat } from "./combat.js";
 import { encounterDot, springTrap, openChest } from "./encounters.js";
-import { moved, floorChanged, won } from "./events.js";
+import { moved, floorChanged } from "./events.js";
 import { CLIMB_TABLE, LEAP_TABLE, DIRECTION_TABLE, RACES, TOOLS, ACTIVATION_OF } from "../content/index.js";
 import { tickSquares } from "./effects.js";
 import { narrateTimerTransitions, toolIndex } from "./items.js";
@@ -135,7 +136,7 @@ export function resolveEtherEnd(state, rng, events = [], now = Date.now) {
  * runs for them — byte-identical to before this plan.
  */
 export function move(state, dir, rng, events = [], now = Date.now, opts = {}) {
-  if (state.combat || state.store || state.dead || state.won) return events;
+  if (state.combat || state.store || state.dead) return events;
 
   const f = state.floor;
   const [dx, dy] = DIRV[dir];
@@ -546,7 +547,7 @@ export function move(state, dir, rng, events = [], now = Date.now, opts = {}) {
  * tile with no roll and no fall damage. The torch is NOT reachable here — it
  * is a `useItem` activatable (engine/items.js), not a movement-tile tool.
  * The full refusal ladder, every step BEFORE any mutation: combat/store/
- * dead/won (silent no-op, mirrors `move`'s own guard) -> `unknown` (`tool`
+ * dead (silent no-op, mirrors `move`'s own guard) -> `unknown` (`tool`
  * is not a recognized hazard tool — `validateAction` already rejects
  * anything but "ladder"/"rope", so this only ever fires for a `TOOLS[tool]`
  * lookup miss on a tampered/malformed call) -> `noTool` (not carried) ->
@@ -556,7 +557,7 @@ export function move(state, dir, rng, events = [], now = Date.now, opts = {}) {
  * there, per that block's own header comment).
  */
 export function useTool(state, tool, dir, rng, events = [], now = Date.now) {
-  if (state.combat || state.store || state.dead || state.won) return events;
+  if (state.combat || state.store || state.dead) return events;
   const feat = TOOLS[tool]?.feat;
   if (!feat) {
     events.push({ type: "toolRefused", tool, reason: "unknown" });
@@ -781,7 +782,7 @@ export function newDay(state, camped, rng, events = [], now = Date.now) {
  * runs a `camped` newDay.
  */
 export function makeCamp(state, rng, events = [], now = Date.now) {
-  if (state.combat || state.store || state.dead || state.won) return events;
+  if (state.combat || state.store || state.dead) return events;
   // DELIBERATE RULES CHANGE, Phase 25.1, 2026-09-15 (DFB-06): the gate now
   // counts every live member's appetite exactly as newDay does (the old
   // gate counted the hero only, so a hero with a member could pass the gate
@@ -975,28 +976,3 @@ export function descend(state, rng, events = []) {
   cutthroatMurderCheck(state, rng, events);
   return events;
 }
-
-/**
- * winGame(state, rng, events, now) — ports mazeworld.html winGame() (lines
- * 1858-1868), minus paint()/renderEncounter() (presentation) and bury()
- * (owned by the persistence layer, matching engine/death.js's pattern: the
- * caller supplies the current graveyard array and calls `bury` itself once
- * it has one to persist). Sets `state.won`, NOT `state.dead` — a winner
- * keeps walking, they just already won.
- *
- * RETIRED as a run terminator (RUN-04, Plan 02): genFloor no longer ever
- * emits a "gate" tile and move() no longer dispatches to this function (its
- * old "gate" branch now calls descend() for legacy-save compatibility
- * instead) — winGame() is unreachable via normal play. Permadeath (die,
- * engine/death.js) is the sole run terminator. Retained, still exported, and
- * still directly callable (movement.test.js documents this explicitly) only
- * until Phase 4's win-screen UI cleanup removes state.won entirely.
- */
-export function winGame(state, rng, events = [], now = Date.now) {
-  state.won = true;
-  state.deathAt = now();
-  state.deathNote = "walked out";
-  state.epitaph = epitaphFor("won", epitaphCtx(state), rng);
-  events.push(won(state.c.level, state.day, state.steps));
-  return events;
-}
diff --git a/engine/saveState.js b/engine/saveState.js
index d0cd6f2..bec2d01 100644
--- a/engine/saveState.js
+++ b/engine/saveState.js
@@ -641,11 +641,13 @@ export function validateSave(raw, options = {}) {
     // unlike pendingFind (transient, nulled by rehydrate below).
     pendingLoot: sanitizeLoot(obj.pendingLoot),
     dead: !!obj.dead,
-    won: !!obj.won,
-    // Phase 21 (D-14/D-23): boolean-coerced like dead/won; absent on a
+    // Phase 46 (DEAD-04): the retired run-terminator flag is deliberately
+    // absent from this whitelist now — a stale save carrying it (any value)
+    // loads tolerantly; the key is simply never copied, never rejected.
+    // Phase 21 (D-14/D-23): boolean-coerced like dead; absent on a
     // pre-Phase-21 save → false.
     dev: !!obj.dev,
-    // Phase 33 (STORE-01): boolean-coerced like dev/dead/won; absent on a
+    // Phase 33 (STORE-01): boolean-coerced like dev/dead; absent on a
     // pre-Phase-33 save → false, so an old save keeps today's fixed store
     // stock and never gains the new draws mid-run.
     storeRoll: !!obj.storeRoll,
@@ -658,7 +660,7 @@ export function validateSave(raw, options = {}) {
     epitaph: obj.epitaph || "",
   };
   // MD-01: pass deathAt/lastWords through the validated value too, so a
-  // terminal (dead/won) run's real save/load path — validateSave then
+  // terminal (dead) run's real save/load path — validateSave then
   // rehydrate() — doesn't lose them even though rehydrate() alone now
   // preserves them when present on its input.
   if (obj.deathAt !== undefined) value.deathAt = obj.deathAt;
@@ -737,7 +739,7 @@ export function rehydrate(obj) {
     // pendingFind just above) — the player must still get their loot screen
     // back on resume, so it is carried through here, never reset.
     pendingLoot: sanitizeLoot(obj.pendingLoot),
-    // PARTY-02 (Phase 7): whitelist the persistent roster, mirroring dead/won
+    // PARTY-02 (Phase 7): whitelist the persistent roster, mirroring dead
     // above. sanitizeParty fail-opens a missing party (pre-Phase-7 save) to []
     // and drops malformed members, so old saves load with `party: []` and zero
     // other data loss. serializeRun's state spread already persists it; this is
@@ -746,20 +748,22 @@ export function rehydrate(obj) {
     // Phase 38 (ABIL-05): ensurePartyAbilities mirrors validateSave's own call.
     party: ensurePartyAbilities(sanitizeParty(obj.party)),
     dead: !!obj.dead,
-    won: !!obj.won,
-    // Phase 21 (D-14/D-23): boolean-coerced like dead/won; absent on a
+    // Phase 46 (DEAD-04): the retired run-terminator flag is deliberately
+    // absent from this whitelist now — a stale save carrying it (any value)
+    // loads tolerantly; the key is simply never copied, never rejected.
+    // Phase 21 (D-14/D-23): boolean-coerced like dead; absent on a
     // pre-Phase-21 save → false.
     dev: !!obj.dev,
-    // Phase 33 (STORE-01): boolean-coerced like dev/dead/won; absent on a
+    // Phase 33 (STORE-01): boolean-coerced like dev/dead; absent on a
     // pre-Phase-33 save → false, so an old save keeps today's fixed store
     // stock and never gains the new draws mid-run.
     storeRoll: !!obj.storeRoll,
     deathNote: obj.deathNote || "",
     epitaph: obj.epitaph || "",
   };
-  // MD-01: die()/winGame() also set deathAt/lastWords on a terminal run, and
+  // MD-01: die() also sets deathAt/lastWords on a terminal run, and
   // serializeRun() (which spreads the FULL state) preserves them — round-trip
-  // them here too rather than silently dropping a dead/won run's time-of-death
+  // them here too rather than silently dropping a dead run's time-of-death
   // and "last words" on reload. Only added when present so a save that never
   // reached a terminal state doesn't gain spurious `undefined` fields.
   if (obj.deathAt !== undefined) state.deathAt = obj.deathAt;
diff --git a/engine/state.js b/engine/state.js
index fca18bd..85b5045 100644
--- a/engine/state.js
+++ b/engine/state.js
@@ -219,9 +219,8 @@ export function newRun(seed, exclude = [], { startDepth = 1, force = null, store
     // via reconcilePendingLoot (Task 3, mirrors reconcilePendingFind).
     pendingLoot: [],
     dead: false,
-    won: false,
     // Phase 21 (TUNE-04, D-13/D-14): dev — true only for a start-at-depth run;
-    // a plain boolean present on EVERY fresh state exactly like dead/won
+    // a plain boolean present on EVERY fresh state exactly like dead
     // above (so serializeRun/validateSave/rehydrate round-trip it and the
     // fresh-run round-trip test stays deepStrictEqual). The parity harness
     // strips it in all three comparables. A dev run is never written to the
```

## Harness diff (the six one-word retired-field strips)

```diff
diff --git a/test/parity/combat-parity.test.js b/test/parity/combat-parity.test.js
index e7d38b7..dfbb6d9 100644
--- a/test/parity/combat-parity.test.js
+++ b/test/parity/combat-parity.test.js
@@ -126,8 +126,11 @@ function comparable(state) {
   // Phase 39 (GEAR-05): strip `state.pendingHazard` too — a seventh analog,
   // mirroring harness combatComparable; always null on a fixture.
+  // Phase 46 (DEAD-04): strip the prototype-side win flag too — see
+  // harness/comparables.js's Phase 46 rationale (a retired-field carve-out,
+  // stripRetiredCounterFields precedent).
   state = reconcilePendingFight(state);
-  const { beats, seed, rngState, version, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...state0 } = state;
+  const { beats, seed, rngState, version, won, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...state0 } = state;
diff --git a/test/parity/harness/comparables.js b/test/parity/harness/comparables.js
index 46f908a..d438bcc 100644
--- a/test/parity/harness/comparables.js
+++ b/test/parity/harness/comparables.js
@@ -509,7 +509,14 @@ export function movementComparable(state) {
-  const { beats, seed, rngState, version, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...state0 } = state;
+  // Phase 46 (DEAD-04, retired-field carve-out — the stripRetiredCounterFields
+  // precedent): the frozen prototype still initialises its top-level win flag
+  // to false at every fixture replay, and no fixture ever reaches a win, so
+  // the field is a permanent no-op difference either way (false vs absent).
+  // The engine no longer carries the field at all (Phase 46 deleted it
+  // entirely) — the prototype-side literal is stripped here, a retired-field
+  // carve-out, not a reconcile or a special case.
+  const { beats, seed, rngState, version, won, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...state0 } = state;
@@ -597,7 +604,10 @@ export function combatComparable(state) {
-  const { beats, seed, rngState, version, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...state0 } = state;
+  // Phase 46 (DEAD-04): strip the prototype-side win flag too — see
+  // movementComparable's Phase 46 rationale above (a retired-field carve-out,
+  // stripRetiredCounterFields precedent).
+  const { beats, seed, rngState, version, won, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...state0 } = state;
@@ -1121,7 +1131,10 @@ export function economyComparable(state) {
-  const { beats, seed, rngState, version, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...state0 } = state;
+  // Phase 46 (DEAD-04): strip the prototype-side win flag too — see
+  // movementComparable's Phase 46 rationale above (a retired-field carve-out,
+  // stripRetiredCounterFields precedent).
+  const { beats, seed, rngState, version, won, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...state0 } = state;
diff --git a/test/parity/magic-parity.test.js b/test/parity/magic-parity.test.js
index 5be06e7..0b52506 100644
--- a/test/parity/magic-parity.test.js
+++ b/test/parity/magic-parity.test.js
@@ -87,8 +87,11 @@ function comparable(state) {
+  // Phase 46 (DEAD-04): strip the prototype-side win flag too — see
+  // harness/comparables.js's Phase 46 rationale (a retired-field carve-out,
+  // stripRetiredCounterFields precedent).
   state = reconcilePendingFight(state);
-  const { beats, seed, rngState, version, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...rest } = state;
+  const { beats, seed, rngState, version, won, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...rest } = state;
diff --git a/test/parity/movement-parity.test.js b/test/parity/movement-parity.test.js
index 441e919..55073ab 100644
--- a/test/parity/movement-parity.test.js
+++ b/test/parity/movement-parity.test.js
@@ -1,5 +1,5 @@
 // ENG-05 movement parity: the extracted engine's move/newDay/teleport/
-// descend/winGame match the frozen prototype's, action for action, for the
+// descend match the frozen prototype's, action for action, for the
@@ -65,8 +65,11 @@ function comparable(state) {
+  // Phase 46 (DEAD-04): strip the prototype-side win flag too — see
+  // harness/comparables.js's Phase 46 rationale (a retired-field carve-out,
+  // stripRetiredCounterFields precedent).
   state = reconcilePendingFight(state);
-  const { beats, seed, rngState, version, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...rest } = state;
+  const { beats, seed, rngState, version, won, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, ...rest } = state;
```

Fence proof:

```
$ git status --porcelain test/parity/fixtures
(empty)
$ git hash-object test/parity/prototype-master.js.txt
a1f4d0dc29782218d8e5aab65bc5989c33f917f0
$ node --test test/parity/*.test.js
# pass 39
# fail 0
```

## Tests re-pinned or deleted

| File | Kind | Reason |
|---|---|---|
| `test/unit/movement.test.js` | test case deleted | The dormant `winGame` test (still calling the now-deleted function directly) removed; the `winGame` import dropped |
| `test/unit/movement.test.js` | re-pinned | `move: combat/store/dead/won all short-circuit` retitled to drop `won`; the `{ won: true }` override case removed (the guard no longer checks it, so the case would otherwise assert a false negative); `fixedState()`'s own inert `won: false` literal removed (once L714 became `assert.ok(!("won" in state))`, the helper's literal `won: false` would have made every state built through it carry a `won` key, defeating the assertion); the legacy-'gate'-tile test's assertion and comment re-pinned to `!("won" in state)` |
| `test/unit/endless-descent.test.js` | re-pinned | Three `assert.equal(state.won, false, …)` calls become `assert.ok(!("won" in state), …)` |
| `test/unit/engine-purity.test.js` | re-pinned | Abandon-no-op test title drops "won"; the JSON round-trip test's required-shape key list drops `"won"`; its final assertion becomes `assert.ok(!("won" in state))` |
| `test/unit/permadeath.test.js` | re-pinned | Test title reworded ("no win/Gate path"); its final assertion becomes `assert.ok(!("won" in state), …)` |
| `test/unit/effects.test.js` | re-pinned | Two movement-loop guard conditions drop `|| state.won` / `|| s.won` |
| `test/unit/death.test.js` | retitled + rewritten | "bury falls back to a cause-based note when state.deathNote is empty (e.g. a win)" → "bury falls back to a plain died note when deathNote is empty"; now calls `bury(state, "trap", …)` and expects `note === "died"` (the `won`-cause branch no longer exists) |
| `test/unit/engineAdapter.test.js` | re-pinned | `formatEvents` coverage test drops the `won` event from its input array; `html.length` expectation 4 → 3; the "Gate" assertion dropped |
| `test/unit/save-validation.test.js` | new test added | `DEAD-04: a stale save carrying won: true loads tolerantly` — `validateSave` returns `ok: true`, neither the validated value nor the rehydrated state carries a `won` key; the two pre-existing `won: false` OLD-SAVE INPUT literals (old-shape-save tests) are left exactly as they are — they are stale-save inputs by design, not assertions on live engine output |
| `test/unit/narrationLinesCoverage.test.js` | re-pinned | `KNOWN_INDIRECT_TYPES` drops `"won"` |
| `test/unit/formatEventsCoverage.test.js` | re-pinned | `KNOWN_INDIRECT_TYPES` drops `"won"`; its L23-ish header comment's factory-type list drops the `won` mention |
| `test/unit/shell-combat-over.test.js` | re-pinned | `deathBranch()`'s end anchor moves from `"if (S.won) {"` to the beats-branch line; the "S.won card and store region" test replaced with "Phase 46: the retired won card is gone and the store region is untouched" (`doesNotMatch(/Through the Gate/)` + a single `if (S.dead) {` count) |
| `test/unit/shell-map-rail.test.js` | re-pinned | `deathBranch()`'s end anchor moves the same way; the `railEl.hidden` regex pin drops `\|\| S\.won` |
| `test/unit/shell-loot-screen.test.js` | re-pinned | `WON_GUARD` renamed `BEATS_GUARD` (now holds the beats-branch line); the loot-branch-ordering test retitled and re-pinned against `BEATS_GUARD` |
| `test/unit/shell-map-viewport.test.js` | re-pinned | The stair-branch index lookup drops `&& !S.won` |
| `test/parity/full-suite.test.js`, `test/roundtrip/serialize-rehydrate.test.js`, `test/unit/newrun.test.js` | comment/assertion re-pinned (not in the plan's `files_modified` list) | See Deviations below — required by the plan's own zero-straggler grep and, for `newrun.test.js`, to keep a live assertion from breaking |

`npm test` count: 3,240 (46-01 close) → 3,240 (net 0: one dormant `winGame` test deleted, one DEAD-04 pin added).

## Out of scope, counted for Phase 48

54 test files under `test/unit/` build hand-made states with an inert `won: false` key (a literal property in a locally-defined `fixedState()`/scenario object) that the plan's own facts flagged as out of this plan's scope — they match neither the criterion-2 grep (`won:` has no dot, not `.won\b`) nor a functional dependency on the removed guards, so they are harmless extra keys on plain JS object literals:

```
$ grep -rlE "won: false" test/unit | wc -l
54
```

`abilities.test.js, ability-strike.test.js, afraid.test.js, armorDisplay.test.js, armor-durability.test.js, bag-cap-gate.test.js, bot-buy-policy.test.js, bot-tactics.test.js, carry-model.test.js, casters-can-act.test.js, cast-refusals.test.js, clarity-cause-lines.test.js, class-matrix.test.js, combat.test.js, combatMenu.test.js, combatPanel.test.js, combat-scaling.test.js, economy.test.js, effect-expiry.test.js, encounters.test.js, ether-wallwalk.test.js, feedback-payload.test.js, fight-gate.test.js, flee-retune.test.js, fluency.test.js, foe-abilities.test.js, foe-turn-draw-count.test.js, freeze-pays-out.test.js, gear-axes.test.js, grimoireViewModel.test.js, identity-combat.test.js, identity-race.test.js, identity-world.test.js, inventory-actions.test.js, item-wiring.test.js, joiner-acquisition.test.js, loot-pile.test.js, magic.test.js, map-reveal.test.js, parley.test.js, party-abilities.test.js, party-combat.test.js, phobia-triggers.test.js, rations-audit.test.js, round-card-worst-case.test.js, save-validation.test.js (the two OLD-SAVE inputs, intentionally kept), spell-mechanics.test.js, spell-utility.test.js, store-sell.test.js, tools.test.js, tuning-bot.test.js, usable-features-audit.test.js, water-cost.test.js, worn-slots.test.js`

Left untouched by design — Phase 48's DOCS-01..03 sweep is the closing pass over stale comment/test-fixture prose.

## Files Created/Modified

- `mazeworld.html` — won card, `.stone.won`/`.deathcard` CSS, graveyard stone ternary, over-map/stair gates, rail/boot/snapshot/resume checks all read `dead` alone; two keyboard comments reworded
- `tools/store-screenshots/bot.js` — `blocked` expression drops `S.won||`
- `test/unit/shell-combat-over.test.js`, `shell-map-rail.test.js`, `shell-loot-screen.test.js`, `shell-map-viewport.test.js` — anchors re-pointed off the deleted won card
- `engine/movement.js` — `winGame()` deleted; three guards drop `|| state.won`; imports trimmed (`die` only from death.js, `moved, floorChanged` only from events.js); two prose comments reworded
- `engine/engine.js` — abandon guard reads `!next.dead` alone
- `engine/saveState.js` — validateSave/rehydrate whitelists never copy `won`; four comments reworded
- `engine/state.js` — fresh state has no `won` key
- `engine/events.js` — `WON` type + `won()` creator deleted
- `engine/death.js` — death-note fallback is a plain `"died"`; a stale JSDoc mention of "a winGame path" reworded
- `test/parity/harness/comparables.js`, `combat-parity.test.js`, `magic-parity.test.js`, `movement-parity.test.js` — six one-word `won` destructure strips with Phase 46 rationale comments
- `test/parity/full-suite.test.js`, `test/roundtrip/serialize-rehydrate.test.js` — historical comments mentioning `winGame`/`won` reworded (see Deviations)
- `src/browser/eventNarration.js` — `won:` narration entry deleted
- `src/browser/narrationLines.js` — ORACLE_ONLY's `"won"` entry deleted
- `test/unit/narrationLinesCoverage.test.js`, `formatEventsCoverage.test.js` — `KNOWN_INDIRECT_TYPES` drops `"won"`
- `tools/lib/tuning-bot.mjs` — loop guard, `stuck`, `outcome`, `cause`, and the result shape all drop `won`; JSDoc reworded
- `tools/lib/class-matrix.mjs` — `rowFromRun`'s `won: run.won` field deleted
- `tools/tune-difficulty.mjs` — `wonCount` deleted; the outcome print line and the JSON `won` field dropped
- `test/unit/movement.test.js`, `endless-descent.test.js`, `engine-purity.test.js`, `permadeath.test.js`, `effects.test.js`, `death.test.js`, `engineAdapter.test.js`, `save-validation.test.js`, `newrun.test.js` — see Tests re-pinned or deleted above

## Decisions Made

See `key-decisions` in the frontmatter (the premise correction, the three files added beyond the plan's `files_modified` list, and `movement.test.js`'s `fixedState()` fix).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three files outside the plan's `files_modified` list carried stale `winGame`/`won` comments or assertions that would have failed the plan's own gates**
- **Found during:** Task 2's broad zero-straggler grep sweep (run before the parity/unit gates, per the plan's own read-through instructions)
- **Issue:** `test/parity/full-suite.test.js:11` and `test/roundtrip/serialize-rehydrate.test.js:33,264` carry historical prose mentioning `` `winGame` `` by name (matched the `winGame` pattern in the plan's own acceptance-criteria grep); `test/unit/newrun.test.js:38` asserted `state.won === false`, which would fail once `engine/state.js` stopped setting the key
- **Fix:** Reworded the three comments to describe the retired win path without spelling `winGame`/`won` as bare identifiers; changed `newrun.test.js`'s assertion to `assert.ok(!("won" in state), …)`
- **Files modified:** `test/parity/full-suite.test.js`, `test/roundtrip/serialize-rehydrate.test.js`, `test/unit/newrun.test.js`
- **Verification:** `npm test` → `# pass 3240, # fail 0`; the criterion-2 grep returns only the two allowed `COMBAT_COPY.over.won` survivors
- **Committed in:** `990ad88` (Task 2's own commit — caught before that commit was made)

**2. [Rule 1 - Bug] `test/unit/movement.test.js`'s `fixedState()` helper carried its own `won: false` literal not named in the plan's action text**
- **Found during:** Task 2's `npm test` gate run — 3,239 pass / 1 fail (`move: a legacy 'gate' tile routes to descend…`)
- **Issue:** The plan's action text re-pinned this test's assertion to `assert.ok(!("won" in state), …)`, but `fixedState()` (used by nearly every test in the file) unconditionally injected `won: false` into every state it built — so `"won" in state` was still `true`, failing the new assertion even though the engine's real `newRun()` no longer sets the key
- **Fix:** Removed the `won: false` literal from `fixedState()`'s base object
- **Files modified:** `test/unit/movement.test.js`
- **Verification:** `node --test test/unit/movement.test.js` → `# pass 76, # fail 0`; full `npm test` → `# pass 3240, # fail 0`
- **Committed in:** `990ad88` (Task 2's own commit — caught before that commit was made)

**3. [Rule 1 - Bug] `test/unit/movement.test.js`'s "combat/store/dead/won all short-circuit" test would have false-negatived once the `won` guard was removed**
- **Found during:** Authoring Task 2's edits (inspected before running gates, since the guard removal makes a `{ won: true }` override a no-op that would no longer block movement)
- **Issue:** The test iterated `[{ combat: {} }, { store: {} }, { dead: true }, { won: true }]` asserting each blocks movement; with the guard removed, `{ won: true }` no longer blocks anything
- **Fix:** Dropped the `{ won: true }` case and retitled the test to "combat/store/dead all short-circuit as a no-op"
- **Files modified:** `test/unit/movement.test.js`
- **Verification:** `node --test test/unit/movement.test.js` → `# pass 76, # fail 0`
- **Committed in:** `990ad88` (Task 2's own commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs the plan's own gates would have caught before commit; two were caught pre-commit by running the gates in the order the plan specifies)
**Impact on plan:** No scope creep — all three were required for the plan's own stated acceptance criteria (the zero-straggler grep, `npm test` fail 0) to actually pass. No architectural change, no new behavior.

## Issues Encountered

None beyond the three auto-fixed deviations above, all caught and fixed before their respective commits landed.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Consolidated for the milestone-close Pixel 7 UAT round — no device pauses were taken (the parity suite + full unit suite are the desk proof that behavior is unchanged for every reachable path):

1. A save from the current Play build (which serialized `won: false`) still resumes and plays on — the dropped key is silently ignored (tolerant load, pinned by the new DEAD-04 unit test; not separately re-verified on-device this plan).
2. "THEY ARE DOWN" still shows after a won FIGHT (not a won RUN) — the fight-outcome copy key (`COMBAT_COPY.over.won`) is untouched by this plan.
3. The graveyard renders every stone with its `note` field (the removed `cause === "won"` branch never fired on a real save — RUN-04 made winning unreachable since v1.0 — so this is a no-visible-change check, not a new-behavior check).

## Next Phase Readiness

- `engine/`, `src/browser/narrationLines.js`/`eventNarration.js`, the parity harness, and every listed tools/test file are clean of `winGame`/`state.won`/`.won\b` outside the two documented fight-outcome survivors and the frozen prototype master.
- Phase 46 Plan 03 (`controlScheme`/`tutorial.js` deletion) is independent of this plan's edits — no blocker.
- Phase 46 Plan 04's closing NAME-02 zero-straggler grep is unaffected by this plan (this plan is DEAD-04, not NAME-01/02).
- Phase 48's DOCS-01..03 sweep inherits the 54-file "inert `won: false` test literal" list recorded above as its starting point for this specific pattern.
- No blockers for Plan 03.

---
*Phase: 46-honest-names-dead-exports-the-tutorial-decision*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: .planning/phases/46-honest-names-dead-exports-the-tutorial-decision/46-02-SUMMARY.md
- FOUND: commit af9b313 (Task 1 — shell layer)
- FOUND: commit 990ad88 (Task 2 — engine + harness + narration + tools + tests)
