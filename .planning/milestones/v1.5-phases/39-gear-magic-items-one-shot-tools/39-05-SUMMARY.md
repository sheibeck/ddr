---
phase: 39-gear-magic-items-one-shot-tools
plan: 05
subsystem: ui
tags: [shell, gear-tab, combat-menu, rail-card, condition-chips, hero-tab, docs-ledger, phase-close, deferred-uat]

# Dependency graph
requires:
  - phase: 39-gear-magic-items-one-shot-tools plan 01
    provides: "content/weapons.js need/crit axes, content/armors.js bulk axis, engine/derived.js#toHit/strikeDie rewritten onto the weapon-need-mod model"
  - phase: 39-gear-magic-items-one-shot-tools plan 03
    provides: "engine/derived.js activation-model helpers (activationFor/itemTimerId/chargesTimerId/liveItemEffects), conditionsOf's itemCooldown/staffCharges chip families, the c.timers activation model"
  - phase: 39-gear-magic-items-one-shot-tools plan 04
    provides: "content/tools.js, engine/derived.js#hasTool, engine/items.js#toolIndex, state.pendingHazard, the useTool action, the torch's lit c.timers effect"
  - phase: 38-melee-active-abilities plan 05
    provides: "the always-enabled-row-on-cooldown precedent (abilityRows), the shell-plan/aggregated-checklist SUMMARY shape"
provides:
  - "src/browser/viewModels.js: itemRowState(state, it) + ITEM_STATE_COPY — the ONE row-state rule (READY/N SQ/cd N SQ/k-max SQ)"
  - "src/browser/combatMenu.js: ITEMS submenu rows (carried + worn) route their cost text through itemRowState, always enabled: true"
  - "src/browser/rail.js: RAIL_COPY.hazard (title/ladder/rope/climb/leap/wall/crevice) + RAIL_COPY.dark.torch"
  - "mazeworld.html: window.mzUseTool, stepNow refactored onto stepWith(action), the hazard pre-roll / retry-with-tool / dark-with-torch rail cards, Gear-tab row states via window.__mzItemRowState, the chip copy tables + explainCondition(cn, label), the Hero tab's engine-routed to-hit/strike-die, five new read-only bridges"
  - "test/unit/itemRowState.test.js (new, 12 tests), test/unit/shell-gear-39.test.js (new, 10 tests) — the row-state rule and the shell wiring's source pins"
  - "docs/GEAR-BALANCE.md: 'Chips and row states — Plan 05' + 'Requirements map — Plan 05' + 'Out of scope / next'"
  - ".planning/REQUIREMENTS.md: GEAR-02 and GEAR-05 marked complete — Phase 39 fully closed"
affects: ["40 (spells/scrolls — the same submenu/condition-chip conventions)", "41 (torch vs the reveal/timed-light rework)", "42 (tuning-bot item-use/tool-carry policy)", "milestone-close UAT batch"]

tech-stack:
  added: []
  patterns:
    - "itemRowState(state, it) is the ONE row-state rule two independent consumers (combatMenu.js's ITEMS submenu, mazeworld.html's Gear tab) both call without importing each other — mirrors the Phase 38 abilityRows precedent exactly"
    - "stepWith(action) is the action-agnostic dispatch body stepNow(dir) and window.mzUseTool(tool, dir) both funnel through — dispatchWithToasts/noteCombat/haptics/pending-rail-computation/paint/draw/log/recenter live in exactly one place"
    - "a rail decision's tool button resolves its bag index at TAP time (window.__mzToolIndex(S.c, 'torch')), never a stashed index — a stale card can never dispatch a wrong slot (T-39-15)"
    - "explainCondition(cn, label) is the ONE chip-tap-explanation rule: an item-sourced chip (cn.source or cn.item) names the item and what's counting first, then appends the plain CONDITION_EXPLAIN sentence; every non-item chip falls straight through to that sentence, unchanged"

key-files:
  created:
    - test/unit/itemRowState.test.js
    - test/unit/shell-gear-39.test.js
  modified:
    - src/browser/viewModels.js
    - src/browser/combatMenu.js
    - src/browser/rail.js
    - mazeworld.html
    - test/unit/combatMenu.test.js
    - test/unit/shell-fight-gate.test.js
    - test/unit/shell-worn-slots.test.js
    - test/unit/shell-armor-display.test.js
    - test/unit/shell-loot-screen.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-map-rail.test.js
    - docs/GEAR-BALANCE.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "itemRowState treats a staff with a missing/non-integer it.charges field as FULL (READY) — a fresh/legacy item with no charge record has nothing counting down, matching the plan's own 'a legacy c with no timers gets READY' rule generalized to the item's own charges field"
  - "itemRowState's non-activatable/consumable gate is (!it.use && it.kind !== 'potion') -> none, then (kind === 'potion' || kind === 'tool') -> consumable — this correctly sorts rope/ladder (no use, kind tool) into 'none' and the torch (use:'light', kind tool) into 'consumable' without a torch-specific special case"
  - "the hazard pre-roll card's buttons read the pending record's OWN feat/dir/tool fields directly (no re-derivation) — the retry card's tool-offer button clears window.__mzRail.pending itself before calling mzUseTool, mirroring the existing CLIMB IT button's own pending-clear-then-dispatch shape exactly"
  - "the dark card is gated on THREE conditions at render time (rail.pending.kind === 'dark' AND S.c.darkFor > 0 AND window.__mzHasTool(S.c, 'torch')) rather than trusting the pending record alone — a torch used/dropped/darkness-cleared between the pending stash and the next paint never shows a stale card"
  - "explainCondition's item-sourced branch reads cn.source (a live item-effect chip, e.g. haste/invis/lit) OR cn.item (itemCooldown/staffCharges) — two different field names on the SAME conceptual 'which item' fact, because conditionsOf's two chip families were authored independently in Plan 03; explainCondition is the one place that reconciles them for display"
  - "the classic script's strikeDie()/toHit()/useItem() duplicates are deliberately left in place, unread, as dead code — deleting dead code is the cleanup milestone's job, not this phase's, matching the plan's own explicit scope note"

requirements-completed: [GEAR-02, GEAR-05]

coverage:
  - id: D1
    description: "itemRowState(state, it) is the ONE row-state rule (READY/N SQ/cd N SQ/k-max SQ); the Gear tab's worn/carried rows and the ITEMS submenu both read it and stay enabled:true always, never it.usedAt/it.every"
    requirement: "GEAR-02"
    verification:
      - kind: unit
        ref: "test/unit/itemRowState.test.js (12 tests, full behavior matrix)"
        status: pass
      - kind: unit
        ref: "test/unit/combatMenu.test.js (ITEMS-branch section, rewritten onto charges + planted c.timers records); test/unit/shell-gear-39.test.js (Gear-tab row-builder source pins)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The condition-chip strip shows lit/itemCooldown/staffCharges chips with the correct label/detail; tapping any chip explains it via explainCondition(cn, label), naming the item and what's counting for an item-sourced chip"
    requirement: "GEAR-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-gear-39.test.js (CONDITION_TONE/explainCondition section); test/unit/shell-map-hud.test.js (paintConditions wiring, re-measured)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The hazard pre-roll decision card (USE LADDER/USE ROPE vs CLIMB IT/LEAP IT), the retry card's added tool offer, and the dark card's USE TORCH all render correctly and dispatch through window.mzUseTool/window.move/window.mzUseItem"
    requirement: "GEAR-05"
    verification:
      - kind: unit
        ref: "test/unit/shell-gear-39.test.js (rail-card sections); test/unit/shell-map-rail.test.js (climb/lock re-measured against the stepWith refactor)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Hero tab's TO STRIKE/TO HIT read the engine's strikeDie/toHit (weapon need mod and Acuteness included), not the stale classic duplicates"
    requirement: "GEAR-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-gear-39.test.js (Hero-tab to-hit routing section)"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/GEAR-BALANCE.md carries the UI section and the full requirements map; REQUIREMENTS.md marks GEAR-02 and GEAR-05 complete; the whole-phase gate is green"
    verification:
      - kind: unit
        ref: "npm test (2686/2686, # fail 0); npm run build:www exit 0; git hash-object prototype-master.js.txt unchanged; test/parity/fixtures porcelain empty; fonts.googleapis count 0; chargen-rng-pin green; package.json/package-lock.json absent from the cumulative diff"
        status: pass
    human_judgment: false
  - id: D6
    description: "The aggregated, plan-grouped, continuously-numbered Pixel 7 checklist exists in this SUMMARY for the milestone-close UAT batch (never executed in this run)"
    verification: []
    human_judgment: true
    rationale: "On-device verification is explicitly deferred to the milestone-close UAT batch per this run's 'defer uat to end' protocol — no device steps, no adb, no APK build in this run."

duration: unrecorded (single continuous session, no start-time checkpoint captured)
completed: 2026-09-18
status: complete
---

# Phase 39 Plan 05: Chips, Row States, Rail Cards & Phase Close Summary

**Put Phase 39 on the screen and closed the phase: the hazard decision card (pre-roll and retry) with USE LADDER/USE ROPE, the Darkness card's USE TORCH, one Gear-tab/ITEMS row-state rule (READY/N SQ/cd N SQ/k-max SQ), condition chips for item effects/cooldowns/staff charges with a naming-the-item tap explanation, the Hero tab's to-hit routed through the engine, the ledger's UI + requirements-map close, and the phase's full aggregated Pixel 7 checklist.**

## Performance

- **Duration:** not precisely timed (single continuous execution)
- **Tasks:** 3
- **Files modified:** 15 (2 new, 13 modified)

## Accomplishments

- `src/browser/viewModels.js`: `itemRowState(state, it)` (new) + `ITEM_STATE_COPY` — the ONE row-state rule every carried/worn item's cost text reads: `{ text: "", kind: "none" }` for a non-activatable item (weapon/armor/rope/ladder/passive jewel); `{ text: "", kind: "consumable" }` for a potion or the torch; `READY` with no `item:<key>`/full-charges staff record; `"{n} SQ"` (singular `"1 SQ"`) mid-effect; `"cd {n} SQ"` cooling; `"{k}/{max} · {n} SQ"` for a recharging staff. Reads `state.c.timers` ONLY through `engine/effects.js#remaining`/`isReady` and the item's own `activationFor` — never `it.usedAt`/`it.every`.
- `src/browser/combatMenu.js`: both ITEMS row builders (carried + worn) route their `cost` text through `itemRowState(state, it)` and stay `enabled: true` unconditionally (the Phase 38 ruling — a tap on cooldown/recharging reaches the engine's own named refusal).
- `src/browser/rail.js`: `RAIL_COPY.hazard` (title/ladder/rope/climb/leap/wall/crevice) and `RAIL_COPY.dark.torch` for the three rail cards below.
- `mazeworld.html`: five new read-only bridges (`window.__mzHasTool`/`__mzToolIndex`/`__mzToHit`/`__mzStrikeDie`/`__mzItemRowState`); `window.mzUseTool(tool, dir)`; `stepNow(dir)` refactored into `stepWith(action)` (the shared dispatch body — `dispatchWithToasts`/`noteCombat`/haptics/pending-rail-computation/paint/draw/log/recenter) with `stepNow` now a thin `{ type: "move", dir }` wrapper; `renderRail` gains a `S.pendingHazard` decision card (wins over joiner/find — a fresh movement decision), the CLIMB IT retry card now offers the matching tool when carried, and a new dark card offers USE TORCH; the Gear tab's `wornSlotRow`/`renderCarriedList` row builder both read `window.__mzItemRowState(S, it)` and build their row via createElement/textContent (T-38-11) instead of the retired `it.every`/innerHTML template; `CONDITION_COPY`/`CONDITION_TONE`/`CONDITION_EXPLAIN` gain `lit`/`itemCooldown`/`staffCharges`, `paintConditions` gains matching label/detail branches, and a new `explainCondition(cn, label)` names the item and what's counting on a chip tap; `#s-die`/`#s-hit` now read `window.__mzStrikeDie(S.c)`/`window.__mzToHit(S)`.
- `test/unit/itemRowState.test.js` (new, 12 tests): the row-state rule's full behavior matrix, written FIRST (RED-confirmed before implementation, per this task's `tdd="true"`).
- `test/unit/shell-gear-39.test.js` (new, 10 tests): source pins for every `mazeworld.html` surface above.
- `docs/GEAR-BALANCE.md`: "Chips and row states — Plan 05" (the row-state table, the chip table, `explainCondition`'s rule, the three rail cards, the to-hit routing, what stays for the cleanup milestone) and "Requirements map — Plan 05" (GEAR-01/02/05 → plans, SC-1..4 → proving tests) plus a closing "Out of scope / next" list.
- `.planning/REQUIREMENTS.md`: GEAR-02 and GEAR-05 marked `[x]` complete — Phase 39 is now fully closed (GEAR-01/02/03/04/05 all complete).
- Whole-phase gate reverified green: `npm test` 2686/2686 (`# fail 0`); `npm run build:www` exit 0; `test/parity/fixtures` porcelain empty; `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); `fonts.googleapis` count 0; `test/unit/chargen-rng-pin.test.js` green; `package.json`/`package-lock.json` absent from the cumulative `8ab7ef6..HEAD` diff (zero new dependencies, 28 files: `content/`, `docs/`, `engine/`, `mazeworld.html`, `src/browser/`, `tools/`); `docs/class-pass/v15-before*.json` byte-identical to `8ab7ef6`; `store-listing/`/`tools/store-screenshots/` never touched this phase.

## Task Commits

Each task was committed atomically:

1. **Task 1: itemRowState view-model, ITEMS submenu rows, rail hazard/dark copy — pure modules, tests first** — `e79b1d6` (test)
2. **Task 2: mazeworld.html — hazard/retry/dark rail cards, Gear-tab row states, chips, engine-routed to-hit, bridges** — `66ed67c` (feat)
3. **Task 3: ledger close (UI + requirements map), REQUIREMENTS.md, whole-phase gate** — `6e1a1e5` (docs)

**Plan metadata:** this commit (SUMMARY only; `commit_docs: true` in `.planning/config.json`, so the final metadata commit still fires for `.planning/` docs — the orchestrator owns STATE.md/ROADMAP.md per this run's instructions).

## Files Created/Modified

- `src/browser/viewModels.js` — `itemRowState(state, it)`, `ITEM_STATE_COPY`
- `src/browser/combatMenu.js` — ITEMS row builders route through `itemRowState`
- `src/browser/rail.js` — `RAIL_COPY.hazard`/`RAIL_COPY.dark`
- `mazeworld.html` — the five bridges, `mzUseTool`, `stepWith(action)`, the three rail cards, the Gear-tab row builders, the chip copy tables + `explainCondition`, the Hero-tab to-hit routing
- `test/unit/itemRowState.test.js` (new) — 12-test row-state rule suite
- `test/unit/shell-gear-39.test.js` (new) — 10-test shell source-pin suite
- `test/unit/combatMenu.test.js` — ITEMS-branch fixtures moved off `every`/`usedAt` onto `charges` + planted `c.timers` records
- `test/unit/shell-fight-gate.test.js`, `test/unit/shell-worn-slots.test.js`, `test/unit/shell-armor-display.test.js`, `test/unit/shell-loot-screen.test.js`, `test/unit/shell-map-hud.test.js`, `test/unit/shell-map-rail.test.js` — Rule 1 fallout: stale source pins on the shared import lines, the retired `it.every` expression, the inline `CONDITION_EXPLAIN` ternary, and the `stepNow`/`stepWith` pending-object shape re-measured against the new wiring
- `docs/GEAR-BALANCE.md` — "Chips and row states — Plan 05" + "Requirements map — Plan 05" + "Out of scope / next"
- `.planning/REQUIREMENTS.md` — GEAR-02/GEAR-05 marked complete

## Decisions Made

See frontmatter `key-decisions` — the legacy-staff-charges-defaults-to-full rule, the non-activatable/consumable gate's ordering, the pending-record-driven hazard/retry button design, the dark card's three-condition render-time gate, `explainCondition`'s `cn.source`/`cn.item` reconciliation, and the deliberate non-deletion of the classic script's dead `strikeDie()`/`toHit()`/`useItem()` duplicates are all recorded there with rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two self-inflicted grep collisions: doc comments quoting the retired `usedAt` literal tripped their own acceptance-criteria grep**
- **Found during:** Task 1, acceptance-criteria verification
- **Issue:** `grep -c "usedAt" src/browser/combatMenu.js src/browser/viewModels.js` printed 1 for each (a doc comment quoting the retired field name), not the required 0 — the same grep-collision pattern documented in Plans 01/03/38-05's own SUMMARYs.
- **Fix:** Reworded both comments to describe the retired counter-based gate without repeating the literal string.
- **Files modified:** `src/browser/combatMenu.js`, `src/browser/viewModels.js`
- **Verification:** both greps now print 0.
- **Committed in:** `e79b1d6` (Task 1 commit)

**2. [Rule 1 - Bug] A stale source pin in an out-of-scope test broke as a direct, correct consequence of the ITEMS rows moving off a local `cd === 0` gate**
- **Found during:** Task 1, full `npm test` run after the combatMenu.js rewrite
- **Issue:** `test/unit/shell-fight-gate.test.js` pinned the literal `enabled: cd === 0` expression this plan's own row-state rewrite removed.
- **Fix:** Re-measured the assertion against the new `cost: itemRowState(state, it).text` wiring.
- **Files modified:** `test/unit/shell-fight-gate.test.js`
- **Verification:** `node --test test/unit/shell-fight-gate.test.js` — 11/11; full `npm test` 2676/2676 at that point.
- **Committed in:** `e79b1d6` (Task 1 commit)

**3. [Rule 1 - Bug] Six out-of-scope shell test files broke as a direct, correct consequence of Task 2's shared-import-line/`it.every`/`stepNow`-body changes**
- **Found during:** Task 2, full `npm test` run after the `mazeworld.html` edits
- **Issue:** `test/unit/shell-worn-slots.test.js` pinned the derived.js import line (now carrying `hasTool`/`toHit`/`strikeDie`) and the retired `it.every` cooldown expression; `test/unit/shell-armor-display.test.js`/`shell-loot-screen.test.js` pinned the viewModels.js import line (now carrying `itemRowState`); `test/unit/shell-map-hud.test.js` pinned the inline `CONDITION_EXPLAIN[cn.key] || CONDITION_EXPLAIN.default` ternary (now `explainCondition(cn, label)`) and, incidentally, the `wornSlotRow`-region worn-tag innerHTML count (now built via `createElement`); `test/unit/shell-map-rail.test.js` pinned `stepNow`'s old single-object pending shape (now inside `stepWith`, with the widened hazard/dark computation).
- **Fix:** Re-measured every assertion against the new, correct shipped source — new import-line literals, `window.__mzItemRowState(S, it)` region checks, a new `explainCondition` region check, a new `stepWithRegion()` helper for the widened pending-object assertions.
- **Files modified:** `test/unit/shell-worn-slots.test.js`, `test/unit/shell-armor-display.test.js`, `test/unit/shell-loot-screen.test.js`, `test/unit/shell-map-hud.test.js`, `test/unit/shell-map-rail.test.js`
- **Verification:** each file green individually; full `npm test` 2686/2686, `# fail 0`.
- **Committed in:** `66ed67c` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — direct, correct consequences of this plan's own specified row-state/chip/rail-card changes; no scope creep, no architectural changes)
**Impact on plan:** Every re-pin was measured live against the finished shell source, never hand-computed or silently adjusted.

## Issues Encountered

None beyond the deviations above. The plan's exhaustive `<behavior>`/`<action>` text (the exact row-state literals, the pending-record shape, the chip label/detail rules) made every implementation and fix mechanical — re-derive the expected value/shape from the documented model, never guessed.

## User Setup Required

None — no external service configuration required.

## Success Criteria Map (ROADMAP SC-1..4)

| SC | Text | Landed in | Proof |
|----|------|-----------|-------|
| 1 | Store and loot present meaningful weapon/armor trade-offs, recorded as a before/after ledger | Plan 01 + Plan 02 | `test/unit/gear-axes.test.js` (band role coverage); `docs/GEAR-BALANCE.md`'s per-class table |
| 2 | An activated item shows its effect-remaining, then its cooldown-remaining, as a condition chip until it's usable again | Plan 03 (the timer records) + Plan 05 (the chip render + row-state rule) | `test/unit/item-activation.test.js`; `test/unit/itemRowState.test.js`; `test/unit/conditions.test.js` |
| 3 | A one-shot tool is offered and consumed at its decision point (e.g. the CLIMB IT rail card) | Plan 04 (the engine's `pendingHazard`/`useTool`/torch model) + Plan 05 (the actual cards) | `test/unit/tools.test.js`; `test/unit/shell-gear-39.test.js` |
| 4 | Tools appear as loot and store stock at depth-appropriate tiers | Plan 04 | `test/unit/tools.test.js` (loot row + store tiers) |

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device pauses occurred anywhere in Phase 39. This is the phase's full aggregated Pixel 7 checklist, grouped by plan and numbered continuously, for the milestone-close UAT batch.

### Plan 01

1. Hero tab TO HIT reads 1–6 with a Rapier / 1–4 with a Flail on a Fighter (need+1/need-1 axes visible) — now concretely checkable: Plan 05 routes it through the shell's engine bridge (see item 16 below).
2. A Thief in Plate armor is refused the backstab ("Heavy armor negates..." denial); a Thief in Studded armor is not refused.
3. The store's weapon offerings at any depth show a genuine mix of heavy/neutral/light picks (not "highest dice you can afford").

### Plan 02

Nothing to add as its own device-testable action — this plan touched no shell/UI code (tools/, docs/, tests, .planning only); its items are the same three Plan 01 already deferred above. Its own smoke-run pooled table (`docs/class-pass/v15-gear-smoke.json`) is a tuning-bot readout, not a device check.

### Plan 03

4. Drink a Speed potion from the Gear tab — the Oracle shows "You use Speed potion." then "Double attacks for 50 squares.", and (Plan 05 landed) a Hasted chip counts down in the condition strip.
5. Use a worn Cloak of Speed twice in a row — the second tap reads "Cloak of Speed: 50 squares. It is not a vending machine.", and the Gear-tab row now shows "cd 50 SQ" with a matching itemCooldown chip counting down.
6. A Magic User uses a Pine Staff in a fight, then again immediately — the second use reads "Pine Staff: 100 squares to the next charge. Patience is also a spell.", and the ITEMS submenu / staffCharges chip shows "0/1 · N SQ".
7. Resume a pre-Phase-39 save mid-run — no card, no crash, worn cloaks/staves still usable, and any previously-active haste/invis/ether/acute effect reappears as a timed chip rather than silently vanishing.

### Plan 04

8. Buy a Ladder at a depth-2 store, walk into a climbable wall — a decision card appears BEFORE any roll with USE LADDER / CLIMB IT; USE LADDER passes with no damage and the ladder is gone.
9. With a Rope, decline at a crevice (LEAP IT), fall, and confirm the retry card now offers USE ROPE beside LEAP IT.
10. Get Darkness (table result) while carrying a Torch — the card offers USE TORCH; using it lights the maze and a later Darkness within 40 squares is resisted.
11. Try USE from the Gear tab on a Torch in a lit corridor — the refusal line reads "It is not dark. Save the torch for when it is."
12. A Torch/Rope line appears in a depth-1 store, Ladder only from depth 2, and none once carried.

### Plan 05

13. Gear tab: a cloak/staff/potion each show READY / N SQ / cd N SQ / k/max · N SQ exactly as designed, matching what the Gear-tab item claims.
14. ITEMS submenu: a row on cooldown/recharging stays tappable, and tapping it shows the engine's own named refusal ("cooldown"/"recharging") in the fight log, never a silent no-op.
15. Condition-chip strip: a live item effect (e.g. Hasted), a cooling item and a recharging staff each show their own chip with the correct detail; tapping each names the item and what's counting (e.g. "Cloak of Speed — cooling, 41 squares. Used, and not ready to be used again. Squares fix that.").
16. Hero tab TO HIT/TO STRIKE now show the real weapon-adjusted numbers (Rapier 1–6, Flail 1–4 on a Fighter) — Plan 01's item 1 above is now directly checkable on-screen.
17. The hazard pre-roll decision card at a wall with a Ladder carried: USE LADDER / CLIMB IT, before any roll — USE LADDER passes with no roll and no fall damage.
18. The hazard pre-roll decision card at a gorge with a Rope carried: USE ROPE / LEAP IT — USE ROPE passes with no roll and no fall damage.
19. TalkBack reads the new rail buttons (USE LADDER/USE ROPE/USE TORCH/CLIMB IT/LEAP IT) and the condition chips' labels/details.
20. A voice spot-check of the new lines in real play (the hazard/dark card copy, the cooldown/recharging refusal lines, the chip explanations) for the family-friendly deadpan tone, not just the synthetic safety-scan corpus.

## Next Phase Readiness

- Phase 39 is fully closed: all three GEAR requirements (GEAR-01/02/05, plus the already-complete GEAR-03/04 from Phase 37) are complete, `npm test` is green at 2686/2686, and the parity master/fixtures are byte-identical to before the phase.
- Every engine surface (Plans 01/03/04) and every shell surface (this plan) needed for gear, magic items and one-shot tools is complete and reusable as-is.
- `docs/GEAR-BALANCE.md` is the living reference for the full GEAR-01/02/05 ledger, the activation model, the tools model, and the UI conventions this phase established.
- The 20-item aggregated Pixel 7 checklist above is queued for the milestone-close UAT batch — no device steps or APK build were taken in this phase, per the standing `defer uat to end` protocol.
- No blockers.

---
*Phase: 39-gear-magic-items-one-shot-tools*
*Completed: 2026-09-18*

## Self-Check: PASSED
