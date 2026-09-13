---
phase: 04-mobile-presentation-controls-onboarding
plan: DR8 (device-review revision round 8 — engine-routing completion for spells/combat/camp + auto-center on every move, ad hoc — not a numbered PLAN.md)
subsystem: engine-routing
tags: [engine-routing, combat, magic, camp, rng-determinism, auto-center, device-review]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR7: window.mzBuyItem/window.mzLeaveStore dispatch()->applyAction() bridge pattern for the STORE — the SAME pattern this round replicates for combat/magic/camp"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR7/04-DR5B1: window.mzCenterMap bridge (fires on run start + floor change) — extended here to fire on every successful step"
  - phase: 01-04 (walking skeleton engine port)
    provides: "engine/combat.js's playerStrike/flee/parley/sing/killFoe/foeTurn/allyTurn/startCombat and engine/magic.js's castSpell/drinkPotion/readScroll — already-complete, already-tested ports of every classic combat/magic function this round stops bypassing"
provides:
  - "The live SPELLS button, STRIKE/POTION/FLEE/PARLEY/SING/SCROLL combat actions, and MAKE CAMP now all dispatch through the engine (window.mzAttack/mzFlee/mzParley/mzSing/mzCastSpell/mzDrinkPotion/mzReadScroll/mzMakeCamp bridges, trailing module script) — closing the LAST piece of the deferred 04-07 engine-routing item (04-DR7 closed the store half; this closes combat/magic/camp)"
  - "engineCombatAction() — the one choke point every combat/magic action button funnels through: dispatch, synthesize state.combat.lastStrike (the HIT/MISS badge) from the engine's own struck/strikeMissed events, narrate, re-render"
  - "window.move (engineMove) recenters the viewport on the party after EVERY successful step (engine/movement.js's `moved` event), not only on floor change — the player no longer drifts off-center while walking"
  - "3 new engineAdapter tests guarding this fix: castSpell heals WP (and caps at max WP), camp spends rations and advances the day, camp with no rations reports why rather than silently no-op'ing"
affects: [05-graveyard-voice-system]

tech-stack:
  added: []
  patterns:
    - "A classic mazeworld.html function mutating the shared `S` object directly (S.c.wp = ..., via Math.random()-backed D()) is NOT equivalent to routing through dispatch()->applyAction(), even when S and engineAdapter.js's `currentState` happen to be the SAME object reference at the moment of mutation (true immediately after boot() and immediately after every engine-routed action, since window.__mzState.set(state) always re-points S at whatever dispatch() just returned). The mutation appears to work in the SAME render pass — but the classic action never advances engineAdapter.js's own rngState cursor, so the very next `dispatch()` call (e.g. any subsequent move) rebuilds its next state via `applyAction(currentState, ...)`, which HAS the mutated field (same object, so it's not literally lost) but has NOT had its rngState cursor advanced by the classic dice rolls the effect actually consumed. This silently diverges the persisted RNG stream from what a save/replay expects, and — more visibly to a live player — any effect computed AFTER a classic action but processed by a DIFFERENT subsequent engine-routed dispatch (e.g. a foe's damage this round outweighing a heal cast this same round, or the next move's dispatch producing a state that doesn't reflect a heal if two classic actions raced) can make an effect look like it silently 'didn't happen.' Routing everything through dispatch()->applyAction() is the only construction that keeps state, narration, and the RNG cursor all advancing from the SAME seam."
    - "A presentation-only derived field (state.combat.lastStrike, the HIT/MISS strike badge) that a classic function used to populate as a side effect of resolving the rule itself has NO equivalent field on the engine's state.combat, by design (engine/combat.js's own header: no DOM/render concerns inside the engine) — it must be synthesized OUTSIDE the engine, in the presentation bridge, from the STRUCTURED EVENTS the engine already emits (`struck`/`strikeMissed`) rather than invented as a new engine-side field. This is the general pattern for any future 'the engine doesn't carry a UI-only field the classic code used to set' gap: derive it from events in the bridge, don't add it to GameState."
    - "engine/movement.js#move pushes exactly one `moved` event per genuine step and returns BEFORE that push on every blocked/no-op path (wall, out-of-bounds, wrong side of a one-way door) — this makes `events.some(e => e.type === 'moved')` the correct, already-available predicate for 'did the party actually move this dispatch,' with no new event type or engine change needed to support a presentation feature (auto-center) that only cares about real steps."

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR8-SUMMARY.md
  modified:
    - mazeworld.html
    - test/unit/engineAdapter.test.js

key-decisions:
  - "Did NOT delete the classic castSpell/playerStrike/killFoe/flee/parley/sing/afterPlayerAction/foeTurn/allyTurn/startCombat/makeCamp functions in this same commit, even though every one of them is now provably dead code (their only call sites were just rewired) — per 04-RESEARCH.md Pattern 3's own explicit guidance and unlike 04-DR7's store functions (which had exactly two simple call sites), this cluster is large, deeply interconnected, and shares utility calls (checkLevel, gainWilmst, rollTreasureItem, takeItem) with code elsewhere in the file; deleting it in the same commit that rewires 13+ call sites is a materially higher-risk change than deferring cleanup to a follow-up pass once the engine-routed path is proven on-device."
  - "canParley()/songReady()/canRead()/canCast() were explicitly NOT touched or deprecated — they are gating/visibility helpers (which buttons renderEncounter() shows), not rule-resolving functions, and they read directly off the correctly-engine-synced `S` object; only the ACTION-EXECUTING functions were dead-coded."
  - "Synthesized state.combat.lastStrike in the presentation bridge (engineCombatAction) from the engine's struck/strikeMissed events rather than adding a lastStrike field to engine/combat.js's state.combat — keeps the engine free of presentation-only fields (its own documented design constraint) while preserving the DR2 HIT/MISS badge UX exactly."
  - "window.mzMakeCamp is a standalone bridge (not routed through the generic engineCombatAction helper) because camp can populate `state.beats` for a non-combat feature-landing narration (a wandering-monster ambush during the night's sleep) the same way window.move's engineMove already does — reusing that exact beats-synthesis shape (via the same stripRollDetail helper) rather than inventing a second, subtly different overlay-population path for one action."
  - "Checked events.some(e => e.type === 'moved') rather than keeping the prior floorChanged-only check for the auto-center fix — a floor transition always also pushes a moved event first (confirmed by reading engine/movement.js), so this single check is a strict superset of the old one, not a parallel/redundant condition."
  - "Investigated the reported 'teleport option in encounter/combat actions' exhaustively (the live combat action row, the SPELLS table, ENCOUNTER_TABLES, engine/encounters.js, all treasure/item tables, the Marks-legend sheet) and found no reachable player-facing teleport CHOICE anywhere in the code — only the automatic ENCOUNTER_TABLES 'Teleport' table outcome (a rule effect, not a menu item) and the purely-informational Marks-legend row describing the teleport FEATURE TILE. Made no removal, since removing either of those would violate the explicit 'do not touch the teleport feature tile mechanic' constraint and there was no actual combat action button to remove. Documented as a no-op finding in the Group 2 commit rather than silently skipping the request."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1 through 04-DR7-SUMMARY.md's own precedent.

duration: ~120min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR8: Device-review round 8 (engine-routing completion + auto-center) Summary

Closed the last piece of the deferred 04-07 engine-routing item (04-DR7 closed the STORE half; this round closes combat/magic/camp): the live page's SPELLS button, every in-combat action (STRIKE/POTION/FLEE/PARLEY/SING/SCROLL), and MAKE CAMP were all calling classic mazeworld.html functions that fully duplicated engine/combat.js's and engine/magic.js's already-complete, already-tested rule logic — against a separate Math.random()-backed dice roller instead of the persisted GameState's seeded rngState. This was the root cause of the on-device report "Greater Heal didn't heal": a classic action's mutation of the shared `S` object never advanced engineAdapter.js's own rngState cursor via dispatch(), so its effect could silently diverge from what the next engine-routed action (any subsequent move) would compute. Rewired every one of those call sites to dispatch through the engine, exactly mirroring 04-DR7's window.mzBuyItem/window.mzLeaveStore pattern. Also extended the existing auto-center bridge to fire after every successful step (not only a floor change), and thoroughly audited for a reported "teleport" combat-action choice — found none in the reachable code, documented that finding rather than silently skipping it. Two atomic commits, each independently rebuilt (`npm run build:www`) and fully tested (`npm test` + `npm run test:quick`) before the next commit landed.

## Performance

- **Duration:** ~120 min
- **Completed:** 2026-09-08
- **Groups:** 2 (engine routing for spells/combat/camp; auto-center-on-every-move + teleport audit) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 2 (`mazeworld.html`, `test/unit/engineAdapter.test.js`)

## Accomplishments

### Group 1 — Spell/potion/scroll/combat/camp engine routing (`c904b04`)

1. **Root-caused "Greater Heal didn't heal."** Traced the SPELLS button's classic `castSpell(idx)` (and every other in-combat action) to a full, independent re-implementation of the corresponding engine rule (engine/magic.js#castSpell, engine/combat.js#playerStrike/flee/parley/sing) operating directly on the shared `S` object via the classic `D()` dice roller (raw `Math.random()`), never through `dispatch()`/`applyAction()`. Because `window.__mzState.set(state)` always re-points the classic script's `S` at whatever the ENGINE's `dispatch()` last returned, `S` and engineAdapter.js's own `currentState` are the same object reference immediately after every engine-routed action — so a classic mutation of `S.c.wp` appeared to "work" in the very next render (paint()/renderEncounter() both read S directly). But the classic action never advanced `currentState`'s persisted `rngState` cursor, so it silently diverged the RNG stream from what any subsequent dispatch() expects, and effects computed this way could be overwritten or masked the moment another engine-routed action (a foe's turn via the classic afterPlayerAction, or literally any other move) ran next — exactly matching the "cast it, and it doesn't seem to have done anything" symptom.
2. **Added 8 engine-routed bridges** (trailing module script, mirroring 04-DR7's `window.mzBuyItem`/`window.mzLeaveStore`): `window.mzAttack`/`mzFlee`/`mzParley`/`mzSing`/`mzCastSpell(idx)`/`mzDrinkPotion`/`mzReadScroll` (all funneling through a new shared `engineCombatAction(type, extra)` helper) and a standalone `window.mzMakeCamp`. Each dispatches the matching, already-fully-implemented engine action (`attack`/`flee`/`parley`/`sing`/`castSpell`/`drinkPotion`/`readScroll`/`camp`) through the SAME `dispatch()`->`applyAction()` seam every other engine-routed action already uses, swaps in the returned state, narrates the returned `html`, and re-renders.
3. **Preserved the DR2 HIT/MISS strike badge.** `state.combat.lastStrike` (the array `renderEncounter()` reads to show a HIT/MISS badge after STRIKE) has no engine-side equivalent — engine/combat.js deliberately carries no presentation-only fields. `engineCombatAction()` synthesizes it from the engine's own `struck`/`strikeMissed` events (populated only for `"attack"`, explicitly cleared to `null` for every other action — matching the classic code's own "switching actions clears a stale badge" behavior).
4. **Rewired every live call site**: the spell-menu list's per-spell button, the STRIKE/POTION/FLEE buttons, the PARLEY/SING/SCROLL buttons, MAKE CAMP's button, and the keydown shortcuts (1–7) all now call the new bridges instead of the classic functions.
5. **Left the classic combat/magic/camp cluster in place, marked dead** (per 04-RESEARCH.md Pattern 3 — don't delete a rule cluster in the same commit that rewires its call sites, unlike 04-DR7's much smaller two-call-site store functions). Added doc comments at `startCombat()` and `makeCamp()` explaining the cluster (`startCombat`/`playerStrike`/`killFoe`/`flee`/`parley`/`sing`/`afterPlayerAction`/`foeTurn`/`allyTurn`/`castSpell`/`drinkPotion`/`readScroll`/`makeCamp`) is now unreachable. `canParley()`/`songReady()`/`canRead()`/`canCast()` were explicitly left untouched and live — they're button-visibility gates, not rule-resolvers, and still correctly read the engine-synced `S`.
6. **Added 3 `engineAdapter.test.js` tests**: casting Heal raises WP and never overshoots max WP (guards the exact regression); a camp dispatch spends rations and advances the day; a camp with no rations is a reported no-op (`campFailed`), never a throw.

### Group 2 — Auto-center on every move + teleport audit (`3587430`)

1. **Auto-center now fires on every successful step**, not just a floor change. `window.mzCenterMap` (already firing on run start and floor change, 04-DR5B1/04-DR7) is now also invoked from `window.move` (`engineMove`) whenever the dispatched `move` action's events include a `moved` event — `engine/movement.js#move` pushes exactly one `moved` event per genuine step and returns BEFORE that push on every blocked/no-op path (a wall, an out-of-bounds edge, the wrong side of a one-way door), so this check fires only on real movement, with no engine change needed. Confirmed a floor transition always also pushes `moved` first, so this single check is a strict superset of (and supersedes) the prior floorChanged-only check.
2. **Audited for the reported "teleport" combat-action choice — found none.** Read the live combat action row (STRIKE/POTION/FLEE/SPELLS/PARLEY/SING/SCROLL — no teleport entry), the SPELLS table (no spell named "Teleport"), `ENCOUNTER_TABLES`/`engine/encounters.js` (landing on an Encounter dot can roll a "Teleport" table RESULT, but it's an automatic effect via `engine/movement.js#teleport()`, never a player-facing choice — same table row structure as "+10 WP"/"-10 WP"/etc.), every treasure/item table (staves/cloaks/potions/jewelry — none named "Teleport"), and the Marks-legend bottom-sheet (a purely informational icon+name+description row explaining the teleport FEATURE TILE, not an action). No player-facing "teleport" choice exists anywhere in the reachable code to remove; made no change here rather than invent a removal that would touch the explicitly-protected teleport feature-tile mechanic.

## Task Commits

1. **Group 1 — Spell/potion/scroll/combat/camp engine routing** — `c904b04` (fix)
2. **Group 2 — Auto-center on every move + teleport audit (no-op finding)** — `3587430` (fix)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next group's edits began.

## Files Created/Modified

- `mazeworld.html` — 8 new engine-routed bridges (`window.mzAttack`/`mzFlee`/`mzParley`/`mzSing`/`mzCastSpell`/`mzDrinkPotion`/`mzReadScroll`/`mzMakeCamp`) plus the shared `engineCombatAction()` helper; every combat/spell/camp button and keydown shortcut rewired to them; doc comments marking the now-dead classic combat/magic/camp function cluster; `window.move` (`engineMove`) now recenters on every `moved` event, not only `floorChanged`.
- `test/unit/engineAdapter.test.js` — 3 new tests: `castSpell` heals WP and caps at max, `camp` spends rations and advances the day, `camp` with no rations reports why.

## Decisions Made

See `key-decisions` in the frontmatter above (deferred deletion of the dead classic cluster per 04-RESEARCH.md Pattern 3, keeping gating helpers live, synthesizing `lastStrike` in the bridge rather than the engine, `mzMakeCamp`'s standalone beats-synthesis, the `moved`-event superset check, and the exhaustive-but-empty teleport audit).

## Deviations from Plan

### Auto-fixed issues

None beyond the plan's own explicit instructions — every change (the 8 bridges, the button/keydown rewiring, the `lastStrike` synthesis, the auto-center predicate change) was a direct, planned fix rather than an incidental discovery requiring a Rule 1/2/3 judgment call.

### Notable finding requiring no action

**Group 2's "remove the teleport option" item resolved to a no-op.** The plan anticipated this possibility explicitly ("If 'teleport' is not an action but appears elsewhere in the encounter UI, identify and remove that teleport CHOICE"). After an exhaustive audit (see Accomplishments, Group 2 item 2) no reachable teleport CHOICE exists anywhere in the live combat/encounter UI — only an automatic table outcome and an informational legend row, both explicitly out of scope per the "don't touch the teleport feature tile mechanic" constraint. No files were changed for this item; the audit trail is preserved in the Group 2 commit message and here.

## Known Stubs / Threat Flags

None. This was pure engine-routing/presentation-glue work (rewiring existing button handlers to an existing, already-tested engine seam) plus a doc-comment-only dead-code marking pass and a one-line predicate change to an existing bridge — no new network endpoints, auth paths, or schema changes at a trust boundary. Every combat/magic/camp action now routes through `dispatch({type:"attack"|"flee"|"parley"|"sing"|"castSpell"|"drinkPotion"|"readScroll"|"camp"})` -> `applyAction()` exclusively; no raw `state.c`/`state.combat` mutation was added to presentation code (the one exception, `state.combat.lastStrike`/`state.beats`, are both already-established presentation-transient fields per `engine/saveState.js`'s `rehydrate()`, never round-tripped through a save, matching the same pattern `window.move`'s `state.beats` synthesis already used before this round). No `GameState.rngState` mutation happens outside `applyAction()`'s existing rehydrate-dispatch-persist cycle.

## Verification

- `npm run build:www` — succeeds at both commit checkpoints.
- `npm test` — **464 -> 467/467 green** (464 baseline from 04-DR7 + 3 new `engineAdapter.test.js` tests), green at every checkpoint.
- `npm run test:quick` — **375 -> 378/378 green** at the final checkpoint.
- Both the classic (non-module) `<script>` block and the trailing `<script type="module">` block were extracted and syntax-checked independently via `node --check` after every edit (no headless-DOM/visual harness exists in this project, consistent with prior `04-DR*-SUMMARY.md` notes — this is the closest available static-correctness check for `mazeworld.html`'s inline scripts).
- Self-check: both commit hashes (`c904b04`, `3587430`) present in `git log`; `mazeworld.html` contains `window.mzAttack`, `window.mzFlee`, `window.mzParley`, `window.mzSing`, `window.mzCastSpell`, `window.mzDrinkPotion`, `window.mzReadScroll`, `window.mzMakeCamp`, `function engineCombatAction(type, extra)`, and `events.some((e) => e.type === "moved")`; no remaining `act(playerStrike)`/`act(drinkPotion)`/`act(flee)`/`act(parley)`/`act(sing)`/`act(readScroll)`/`act(() => castSpell(i))` call sites; `test/unit/engineAdapter.test.js` contains 3 new `"Device-review Pass DR8:"`-titled tests.
- The on-device "feel" of the fix (does Greater Heal visibly raise WP on the Pixel 7 build, does the map genuinely stay centered while walking) is unverified here and should be confirmed on the orchestrator's next device build — the unit tests prove the engine seam applies the effect correctly; they cannot prove the live render reflects it identically to what a human sees, though the render path (`window.__mzState.set(state); window.paint(); window.renderEncounter();`) is the exact same one every other already-verified engine-routed action (move, buyItem, leaveStore, abandon) already uses successfully.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `window.mzAttack = () => engineCombatAction("attack");`, `window.mzFlee = () => engineCombatAction("flee");`, `window.mzParley = () => engineCombatAction("parley");`, `window.mzSing = () => engineCombatAction("sing");`, `window.mzCastSpell = (idx) => engineCombatAction("castSpell", { idx });`, `window.mzDrinkPotion = () => engineCombatAction("drinkPotion");`, `window.mzReadScroll = () => engineCombatAction("readScroll");`, `window.mzMakeCamp = () => {`, `function engineCombatAction(type, extra) {`, `if (events.some((e) => e.type === "moved")) window.mzCenterMap?.();`, no remaining `act(playerStrike)`/`act(drinkPotion)`/`act(flee)`/`act(parley)`/`act(sing)`/`act(readScroll)`/`act(() => castSpell(i))`.
- FOUND: `test/unit/engineAdapter.test.js` — 3 new `"Device-review Pass DR8:"`-titled tests (`castSpell` heals WP, `camp` applies, `camp` no-rations no-op).
- FOUND commit `c904b04` (fix(04-dr8): route spell/potion/scroll/combat/camp actions through the engine).
- FOUND commit `3587430` (fix(04-dr8): auto-center the map on every move, not just floor change).
- FOUND: `npm test` 467/467 and `npm run test:quick` 378/378 at final state.

## Next Phase Readiness

- All DR8 items are complete and test-green; ready for on-device UAT on the Pixel 7 build the orchestrator produces next — specifically re-testing Greater Heal (and other heal/damage/status spells), potions, scrolls, every combat action, and MAKE CAMP for a visible effect, plus confirming the map stays centered while walking.
- No blockers.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
