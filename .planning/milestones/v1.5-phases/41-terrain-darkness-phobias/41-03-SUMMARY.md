---
phase: 41-terrain-darkness-phobias
plan: 03
subsystem: engine
tags: [phobias, afraid, region-model, fear-armed, terrain-triggers, narration, key-decision]

# Dependency graph
requires:
  - phase: 41-terrain-darkness-phobias (Plan 01)
    provides: "cell.water on every generated floor, the structural stripWaterField carve-out precedent this plan's stripPhobiaFields mirrors"
  - phase: 41-terrain-darkness-phobias (Plan 02)
    provides: "the water move-cost mechanism and per-square tick sites, orthogonal to but adjacent to this plan's movement wiring"
  - phase: 31 (CMB-01, Afraid)
    provides: "engine/combat.js#fight's existing three-condition Afraid trigger, AFRAID_ROUNDS/afraidNeed/afraidDamage — this plan's fourth OR-condition slots directly into the existing mechanism"
  - phase: 39-gear-magic-items-one-shot-tools (Plan 04)
    provides: "the state.pendingHazard pre-roll pending-decision precedent — the climb/gorge block's exact branch structure noteHeightsAttempt slots into"
provides:
  - "engine/phobias.js (new leaf): TERRAIN_PHOBIAS, PHOBIA_TRIGGER_KEY, DEATH_REARM_FRACTION, isDeadEnd (relocated from movement.js), tileKey, armFear, regionActive, checkDeathPhobia, checkTerrainPhobias, noteHeightsAttempt, resetFloorPhobiaRegions"
  - "engine/movement.js: checkTerrainPhobias wired into move()'s per-step tick site and teleport()'s landing; noteHeightsAttempt wired into the climb/gorge roll branch (before the roll); resetFloorPhobiaRegions wired into descend()"
  - "engine/combat.js#fight: the fourth OR-condition (armed), consumed unconditionally before the trigger check, additive trigger on phobiaAfraid; foeTurn's tail gains checkDeathPhobia (the in-combat Death crossing)"
  - "engine/derived.js#conditionsOf: the fearArmed chip (placed after darkness, before afraid)"
  - "test/parity/harness/comparables.js#stripPhobiaFields — structural carve-out, wired into all three exported comparables + the three local comparable() duplicates"
  - "engine/saveState.js#sanitizePhobiaFields — tolerant load, wired into both validateSave/rehydrate migratedC chains"
  - "src/browser/{eventNarration,toasts,rail}.js — phobiaTriggered entries, PHOBIA_TRIGGER_PHRASE, phobiaAfraid's 'Still rattled from...' clause"
  - "tools/terrain-fixture-scan.mjs — the phobia-trigger column + TERRAIN TRIGGER EXPOSURE line (measured 0)"
  - "docs/TERRAIN.md — the Phobia triggers Key Decision section filled"
affects: [41-04-darkness-shell-close]

tech-stack:
  added: []
  patterns:
    - "A region model (c.phobiaState: { [phobia]: bool|string }) driving a once-per-fresh-entry narration + arm, distinct from the phobia's own pre-existing standalone penalty (heightsPenalty/waterPenalty/trappedPanic) — the arm lands on a DIFFERENT roll (the next fight's strikes) than the existing penalty (the climb/leap/tile event itself), structurally avoiding double-counting."
    - "A zero-rng 'arm now, consume later' flag (c.fearArmed) read as an additional OR-condition inside an EXISTING trigger check (engine/combat.js#fight), rather than a parallel mechanism — the armed trigger opens the SAME AFRAID_ROUNDS/afraidNeed/afraidDamage penalty every other phobia trigger already uses."
    - "Consume-at-the-reading-site discipline: the arm is deleted the instant fight() reads it (whether or not Hardiness then shrugs off the resulting effect, and even for a now-stale phobia match) — never at endCombat/descend, so it deliberately survives a Death crossing with no fight left on the current floor."

key-files:
  created:
    - engine/phobias.js
    - test/unit/phobia-triggers.test.js
  modified:
    - engine/movement.js
    - engine/combat.js
    - engine/derived.js
    - engine/saveState.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - test/parity/harness/comparables.js
    - test/parity/movement-parity.test.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/conditions.test.js
    - test/unit/save-validation.test.js
    - tools/terrain-fixture-scan.mjs
    - docs/TERRAIN.md

key-decisions:
  - "Ratified Key Decision (user, 2026-09-18, CONTEXT Area 3): 'Arm Afraid for the next fight' — every terrain-phobia trigger fires once on fresh region entry, narrates immediately naming the trigger, and arms a zero-rng c.fearArmed flag that fight()'s existing Afraid check reads as a fourth OR-condition, opening the NEXT fight Afraid through the real Phase 31 mechanism — never a lost action. Existing standalone mechanics (heightsPenalty/waterPenalty on the climb/leap roll, trappedPanic's flat hp loss) are UNCHANGED and NOT double-counted, since the arm lands on a different roll (the next fight's strikes)."
  - "Planner interpretation of the CONTEXT clarification (binding, recorded in docs/TERRAIN.md): ALL FIVE terrain phobias arm Afraid (TERR-05's literal text) — Being-trapped's flat hp loss is RETAINED, not replaced; the arm applies to it exactly like the other four."
  - "fearArmed is consumed at fight() itself — not on leaving the region, not at endCombat, not at descend() — so a Death crossing mid-fight (or any trigger with no fight left on the current floor) still lands on the NEXT fight regardless of how many floors/encounters pass first."

requirements-completed: [TERR-04, TERR-05]

coverage:
  - id: D1
    description: "Every phobia has a real trigger: water/darkness/heights-attempt/dead-end/death-crossing all fire; the five type-matched combat phobias are unchanged"
    requirement: "TERR-04"
    verification:
      - kind: unit
        ref: "test/unit/phobia-triggers.test.js (24 tests: water/darkness/being-trapped/heights/teleport/descend/Death region-model behavior + fight()/foeTurn armed-trigger behavior)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A terrain phobia fires ONCE on fresh entry into its region (c.phobiaState region model), re-arms only when the region is left, narrates immediately naming the trigger, and arms c.fearArmed for the next fight — never a lost action"
    requirement: "TERR-05"
    verification:
      - kind: unit
        ref: "test/unit/phobia-triggers.test.js (fresh-entry/silent-inside/re-arm-on-leave/re-fire-on-re-entry per phobia; the never-a-lost-action test reusing afraid.test.js's own strike-still-lands proof)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Existing mechanics (heightsPenalty/waterPenalty/trappedPanic) are not double-counted — they land on the climb/leap/tile roll itself, the arm lands on a different roll (the next fight's strikes)"
    requirement: "TERR-05"
    verification:
      - kind: unit
        ref: "test/unit/phobia-triggers.test.js (order-asserted: phobiaTriggered precedes heightsFear/trappedPanic, which still fire and deal their own damage unchanged); test/unit/movement.test.js's existing heightsFear/waterFear/trappedPanic tests stay green byte-for-byte"
        status: pass
    human_judgment: false
  - id: D4
    description: "c.phobiaState and c.fearArmed are structural harness carve-outs (six sites: three exported comparables + three local duplicates) and tolerant-load sanitized (validateSave + rehydrate); every parity fixture replays byte-identical"
    requirement: "TERR-04"
    verification:
      - kind: unit
        ref: "node --test test/parity/**/*.test.js (39/39 green); tools/terrain-fixture-scan.mjs (TERRAIN TRIGGER EXPOSURE: 0 — measured, no fixture hero with a terrain phobia ever has a move action); test/unit/save-validation.test.js (5 new sanitizePhobiaFields tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Zero rng on every trigger path; the only new draw is fight()'s existing Hardiness d2, now also reachable when armed"
    requirement: "TERR-04"
    verification:
      - kind: unit
        ref: "test/unit/phobia-triggers.test.js (every non-roll trigger test uses fakeRng([]), which throws on any draw); test/unit/foe-turn-draw-count.test.js (unchanged — checkDeathPhobia draws nothing)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The trigger lines, the 'Still rattled from...' clause, the Rattled chip copy (Plan 04), and the dead-end double-narration (hp loss + phobia line) are visually confirmable on a Pixel 7"
    verification: []
    human_judgment: true
    rationale: "mazeworld.html is untouched this plan (the fearArmed chip's DATA lands here; its shell copy row is Plan 04's scope) — deferred to the end-of-run Pixel 7 UAT batch per the standing defer-uat-to-end instruction."

duration: unrecorded (single continuous session, no start-time checkpoint captured)
completed: 2026-09-18
status: complete
---

# Phase 41 Plan 03: Terrain Phobia Region Model — Arm Afraid for the Next Fight Summary

**`engine/phobias.js` (new leaf) implements a per-character region model (`c.phobiaState`) that fires each of the five terrain phobias (water/darkness/heights-attempt/dead-end/death-crossing) exactly once on fresh entry, narrates immediately naming the trigger, and arms a zero-rng `c.fearArmed` flag that `fight()` now reads as a fourth OR-condition — opening the NEXT fight Afraid through the real Phase 31 mechanism, consumed the instant that fight reads it, surviving `endCombat`/`descend` in between — while the existing climb/leap-roll penalties and the trapped hp loss stay exactly as they were, landing on a different roll from the arm's eventual payoff.**

## Performance

- **Duration:** single continuous session (not precisely timed)
- **Tasks:** 3 (plan tasks) — committed as 3 atomic commits
- **Files modified:** 18 (2 new, 16 modified)

## Accomplishments

- `engine/phobias.js` (new, cycle-free leaf importing only from `engine/derived.js`): `TERRAIN_PHOBIAS` (the five `t: null` PHOBIAS entries), `PHOBIA_TRIGGER_KEY` (phobia -> short trigger key), `DEATH_REARM_FRACTION` (0.5), `isDeadEnd` (relocated verbatim from `engine/movement.js`), `tileKey`, `armFear` (the ONE `phobiaTriggered` push site in the engine), `regionActive` (the pure water/darkness/dead-end region read), `checkDeathPhobia` (the hp-hysteresis Death trigger, called from both movement and combat), `checkTerrainPhobias` (the hero's fresh-entry dispatcher, no-op for a combat-type-phobic character — no key ever created), `noteHeightsAttempt` (the climb/gorge-attempt tile-key enter check), `resetFloorPhobiaRegions` (descend's floor-bound reset, Death and `fearArmed` survive).
- `engine/movement.js`: `checkTerrainPhobias` wired at `move()`'s per-step tick site (after every per-square hp/dark tick, before feature dispatch) and at `teleport()`'s landing; `noteHeightsAttempt` wired into the climb/gorge roll branch (after the `hazardChoice` pending pre-check, before the roll — so the tool-pause never fires it, only the declined retry does; the flyOver/ether/tool branches never reach it either); `resetFloorPhobiaRegions` wired into `descend()`. The local `isDeadEnd` was deleted (relocated, imported from `./phobias.js` instead) — `trappedPanic`'s own entry check is unaffected.
- `engine/combat.js#fight`: `armed = fearArmed && fearArmed.phobia === c.phobia` computed and `c.fearArmed` deleted UNCONDITIONALLY before the trigger check (spent whether or not Hardiness shrugs it off, and even for a stale/mismatched phobia); `|| armed` added as the fourth OR-condition; `phobiaAfraid` gains an additive `trigger` key only when armed (byte-identical `{type, rounds}` shape otherwise — every parity fixture). `foeTurn`'s tail (after the allies ability-cooldown loop) gains `checkDeathPhobia(state, events)` — the in-combat half of the Death trigger, zero draws, a no-op for every non-Death-phobic hero.
- `engine/derived.js#conditionsOf`: the `fearArmed` chip (`{ key: "fearArmed", polarity: "bad", phobia, trigger }`), placed after `darkness` and before `afraid` in the bad block — a pure read of an already-computed field.
- `test/unit/phobia-triggers.test.js` (new, 24 tests): the full region model (water/darkness/being-trapped/heights/teleport/descend/Death) plus `fight()`'s fourth-condition behavior (armed opens Afraid, control shape unchanged, nearDeathPanic independent, Hardiness draws exactly one extra d2 and still consumes the arm on a shrug, a stale-phobia arm is dropped-but-consumed, an in-combat Death crossing survives `endCombat` and arms the next fight, and a never-a-lost-action proof).
- `test/unit/conditions.test.js`: three new `fearArmed` chip tests plus the existing "fully-loaded character" stable-order pin extended with the new chip.
- `test/parity/harness/comparables.js#stripPhobiaFields` — the structural carve-out for `c.phobiaState`/`c.fearArmed`, wired into all three exported `*Comparable()` functions plus the three per-domain local `comparable()` duplicates (movement/combat/magic-parity.test.js).
- `engine/saveState.js#sanitizePhobiaFields` — tolerant load mirroring `clearFoeEffect`/`clearStaleTimers`/`sanitizeWorn`'s exact discipline: a tampered `phobiaState` (non-object) is dropped outright; a tampered entry inside a genuine map (neither boolean nor string) is dropped in place; a tampered `fearArmed` (not an object with string `phobia`+`trigger`) is dropped outright; the key is NEVER injected. Wired into both `validateSave` and `rehydrate`'s `migratedC` chains, right after `clearFoeEffect`. `test/unit/save-validation.test.js` gains 5 new tests.
- `src/browser/eventNarration.js`: `PHOBIA_TRIGGER_PHRASE` (exported, five trigger-key -> phrase entries), `phobiaTriggered` (five trigger-named lines, all family-friendly deadpan), `phobiaAfraid` extended with a "Still rattled from ..." clause when the fight opened from an armed trigger. `src/browser/toasts.js#TOAST_FOR.phobiaTriggered` (headline-only, no trailing clause). `src/browser/rail.js#RAIL_FAMILY.phobiaTriggered` ("A PHOBIA", bad tone).
- `tools/terrain-fixture-scan.mjs` extended: a per-fixture "Phobia trigger hits (dark/deadEnd/climbGorge)" column and a `TERRAIN TRIGGER EXPOSURE` summary line (the count of fixtures whose hero carries a terrain phobia AND whose script has at least one `move` action). Measured: **`TERRAIN TRIGGER EXPOSURE: 0`** — the only fixture with move actions (seed 256) carries a combat-type phobia ("Vampires and the undead"), and every fixture hero with an actual terrain phobia (Being trapped x2, Heights x2, Bodies of water x1) has zero move actions in its script.
- `test/parity/FIXTURE-INVENTORY.md` gains the "Plan 03" subsection: the measured scan table, the terrain-phobia fixture roster with the exact reason none can trigger, and the exposure conclusion.
- `docs/TERRAIN.md`'s "## Phobia triggers — Key Decision (Plan 03)" section filled: the Key Decision verbatim, the CONTEXT clarification, the trigger table, the `fearArmed` lifecycle, the Heights tile-key model, the dead-end definition, the Death hysteresis, the harness/tolerant-load rules, and the never-a-lost-action pointer.

## Task Commits

1. **Task 1: engine/phobias.js region model + movement wiring (water / darkness / dead end / heights attempt / teleport / descend)** - `0cb3d39` (feat)
2. **Task 2: fight() reads the armed fear (fourth OR-condition), Death crossing in combat, the fearArmed chip** - `1a81c75` (feat)
3. **Task 3: narration on three surfaces, harness carve-out (six sites), tolerant load, phobia scan column, TERRAIN ledger, plan gate** - `c680301` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `engine/phobias.js` (new) — the region model, all 11 exports
- `test/unit/phobia-triggers.test.js` (new) — 24 tests
- `engine/movement.js` — `checkTerrainPhobias`/`noteHeightsAttempt`/`resetFloorPhobiaRegions` wiring; `isDeadEnd` relocated
- `engine/combat.js` — `fight()`'s fourth OR-condition + consume + additive `trigger`; `foeTurn`'s `checkDeathPhobia` tail call
- `engine/derived.js` — `conditionsOf`'s `fearArmed` chip
- `engine/saveState.js` — `sanitizePhobiaFields` (new), wired into both `validateSave`/`rehydrate`
- `src/browser/{eventNarration,toasts,rail}.js` — `phobiaTriggered` entries, `PHOBIA_TRIGGER_PHRASE`, `phobiaAfraid`'s new clause
- `test/parity/harness/comparables.js` — `stripPhobiaFields` (new), wired into all three exported comparables
- `test/parity/{movement,combat,magic}-parity.test.js` — `phobiaState, fearArmed` mirrored into each local `comparable()`
- `test/unit/conditions.test.js` — 3 new `fearArmed` chip tests + the stable-order pin extended
- `test/unit/save-validation.test.js` — 5 new `sanitizePhobiaFields` tests
- `tools/terrain-fixture-scan.mjs` — the phobia-trigger column + `TERRAIN TRIGGER EXPOSURE` line
- `test/parity/FIXTURE-INVENTORY.md` — the "Plan 03" section
- `docs/TERRAIN.md` — the Phobia triggers Key Decision section

## Key Decisions (for PROJECT.md)

**"Arm Afraid for the next fight"** (user-ratified Key Decision, 2026-09-18, `41-CONTEXT.md` Area 3): every terrain phobia (Bodies of water, Darkness, Heights, Being trapped, Death) fires once on a fresh entry into its region, narrates the trigger immediately on the rail, and arms a zero-rng `c.fearArmed` flag that `engine/combat.js#fight`'s existing three-condition Afraid trigger reads as a fourth OR-condition — so the NEXT fight opens genuinely Afraid through the real, existing Phase 31 mechanism (`afraidNeed`/`afraidDamage`), never a lost action. The arm is consumed the instant `fight()` reads it (whether or not Hardiness then shrugs off the effect, and even for a now-stale phobia match), and deliberately survives `endCombat`/`descend` in between. Existing standalone mechanics — the deterministic `heightsPenalty`/`waterPenalty` added to the climb/leap roll, and `trappedPanic`'s flat hp loss on dead-end entry — are completely unchanged and never double-counted, because the arm's eventual payoff lands on a DIFFERENT roll (the next fight's strikes) than the triggering event's own roll. Per the CONTEXT clarification (binding, recorded in `docs/TERRAIN.md`): all five terrain phobias arm Afraid — Being-trapped's flat hp loss is retained, not replaced. This is the third of Phase 41's Key Decisions handed to `PROJECT.md` (after "water is generated for every run" and "one tap, two squares of time").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - documentation mismatch] Two of the plan's own literal grep-count acceptance criteria undercounted a legitimate second occurrence already established by this file's own sibling conventions**

- **Found during:** Task 3, verifying the plan's own literal acceptance checks after implementation
- **Issue A:** The plan's acceptance text expects `grep -c "sanitizePhobiaFields(" engine/saveState.js` to equal 2 ("definition + chain"). The actual, correct implementation — wiring `sanitizePhobiaFields` into BOTH `validateSave`'s and `rehydrate`'s `migratedC` chains (mirroring every sibling tolerant-load helper in this exact file: `clearFoeEffect`, `sanitizeWorn`, `clearStaleTimers`, and Plan 01's own `sanitizeWaterCells` each appear exactly 4 times — JSDoc self-reference + definition + 2 wiring call sites) — measures 4, not 2. Wiring only `validateSave`'s chain (to hit the literal count of 2) would have left `rehydrate`'s own standalone tolerant-load path unsanitized, which this file's own documentation explicitly calls out as load-bearing ("`rehydrate()` is exercised standalone against a raw serialized state in tests ... so it needs the identical treatment").
- **Issue B:** The plan's acceptance text expects `grep -c "### Plan 03" test/parity/FIXTURE-INVENTORY.md` to equal 1. Phase 40's own pre-existing "### Plan 03 — utility visibility + scroll gate" section header (landed before this phase) already contributes one match; this plan's new "### Plan 03 — `c.phobiaState` / `c.fearArmed`" subsection is the SAME literal substring by the file's own established "### Plan NN — ..." heading convention (mirroring "### Plan 02" used identically two phases earlier in this same Phase 41 section), so the count is unavoidably 2, not 1 — the acceptance check did not account for the pre-existing cross-phase collision.
- **Fix:** Implemented both per the established codebase convention (4 occurrences for `sanitizePhobiaFields`, matching every sibling helper exactly; the "### Plan 03" heading matching the file's own established per-phase numbering scheme) rather than distorting the code/docs to hit a literal count that would have created either a functional gap (Issue A) or a style inconsistency (Issue B) with this file's own established pattern.
- **Files affected:** `engine/saveState.js`, `test/parity/FIXTURE-INVENTORY.md` (no functional change from what was already implemented — this is a documentation note, not a code fix)
- **Verification:** `npm test` 2891/2891, `# fail 0`; the actual sibling-helper counts (`clearFoeEffect(`, `sanitizeWorn(`, `clearStaleTimers(`, `sanitizeWaterCells(`) were grepped and confirmed to be 4 each, proving the implementation is consistent with established precedent, not an outlier.
- **Committed in:** `c680301` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — two of the plan's own literal grep-count checks conflicted with this codebase's own established, measured conventions; the implementation follows the established convention, not the miscounted check).
**Impact on plan:** No scope creep, no architectural change, no functional gap. Both counts are higher than the plan's literal expectation only because the implementation correctly mirrors every sibling precedent already in the same files.

## Issues Encountered

None beyond the item above (found and reconciled inline, verified, part of the green suite before commit).

## User Setup Required

None — no external service configuration required.

## Gate (Task 3, plan's own verification — verification agents are off)

- `npm test`: **2891/2891**, `# fail 0`
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `npm run build:www`: exit 0
- `git diff --stat -- mazeworld.html`: empty — the shell was not touched this plan (the `fearArmed` chip's copy row is Plan 04's scope; the chip DATA lands here)
- `node --test "test/parity/**/*.test.js"`: 39/39 green
- `git status --porcelain test/parity/fixtures`: empty (zero fixture files touched by this plan)
- `node tools/terrain-fixture-scan.mjs`: **`TERRAIN TRIGGER EXPOSURE: 0`** — no fixture hero with a terrain phobia ever has a `move` action in its script; measured, not assumed
- `test/voice/safety-scan.test.js`, `test/unit/toastsCoverage.test.js`, `test/unit/formatEventsCoverage.test.js`, `test/unit/rail.test.js`: all green
- `store-listing/`/`tools/store-screenshots/`: untouched throughout (never staged; both remain pre-existing untracked directories this plan never touched)

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan. A Pixel 7 tester should check, at the end of the run (batched with the other Phase 41 plans):

1. **A Bodies-of-water hero entering a pool sees "Water. You knew this was coming. Your knees did too." exactly once**, stays silent while wading further into the same pool, and sees the line again only after stepping fully out and back in.
2. **A Darkness-phobic hero sees "The dark. It was always going to be the dark." on entering an unlit square** — once per fresh entry, silent while it stays dark, again on leaving and re-entering.
3. **A dead end shows BOTH the existing "Four walls and one door you already used. −N hp." line AND the new "A dead end. The walls lean in a little, just to be sure." line, in that order**, for a Being-trapped-phobic hero — the hp loss is unchanged from before this phase.
4. **A climb or gorge attempt shows "That is a long way down. Your stomach has already left." BEFORE any climb/leap roll result**, for a Heights-phobic hero — a retry of the exact same wall/crevice stays silent; walking away and coming back shows it again.
5. **At or below 25% hp, a Death-phobic hero sees "You can hear your own pulse. It sounds unimpressed." once, and not again** until hp climbs back above half.
6. **The next fight after any of the above opens with the Afraid condition chip AND the phobiaAfraid line reads "... Still rattled from the water/the dark/the drop/the dead end/your own pulse."** — this proves the arm actually consumed correctly at fight time.
7. **The Rattled/fearArmed chip itself** (its shell copy row — Plan 04's scope) shows between the trigger moment and that next fight, distinct from the in-fight Afraid chip.

## Next Phase Readiness

- TERR-04/TERR-05's engine half is fully landed: every terrain phobia has a real, once-per-fresh-entry trigger; the Afraid penalty is armed and consumed through the real Phase 31 mechanism; existing standalone penalties are untouched and not double-counted; narration exists on all three surfaces (Oracle/toast/rail); the two new character fields are a structural parity carve-out (six sites) and tolerant-loaded (both load chains).
- Plan 04 (darkness render filter, water map paint, rail lines, `docs/TERRAIN.md` ledger close, whole-phase gate) has everything it needs: the `fearArmed` chip's DATA shape is stable and documented, the five trigger phrases are already narrated, and this plan's own `docs/TERRAIN.md` section states every number/rule Plan 04's shell copy will need to match.
- No blockers. `npm test`: 2891/2891, `# fail 0`. Master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). Full parity suite green (39/39); `git status --porcelain test/parity/fixtures` empty; `mazeworld.html` untouched.

---
*Phase: 41-terrain-darkness-phobias*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `engine/phobias.js`, `test/unit/phobia-triggers.test.js`, `engine/movement.js`, `engine/combat.js`, `engine/derived.js`, `engine/saveState.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `test/parity/harness/comparables.js`, `test/parity/movement-parity.test.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/unit/conditions.test.js`, `test/unit/save-validation.test.js`, `tools/terrain-fixture-scan.mjs`, `test/parity/FIXTURE-INVENTORY.md`, `docs/TERRAIN.md` all exist with the expected content ("TERRAIN_PHOBIAS"/"checkTerrainPhobias" present in `engine/phobias.js`; "|| armed" present in `engine/combat.js`; "fearArmed" chip present in `engine/derived.js`; "stripPhobiaFields"/"sanitizePhobiaFields" present in their respective files; "Plan 03" sections present in both `FIXTURE-INVENTORY.md` and `docs/TERRAIN.md`).
Verified in git log: `0cb3d39`, `1a81c75`, `c680301` all present on `master`.
