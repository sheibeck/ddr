---
phase: 38-melee-active-abilities
plan: 05
subsystem: ui
tags: [shell, combat-menu, hero-tab, rail-card, first-paint, docs-ledger, phase-close, deferred-uat]

# Dependency graph
requires:
  - phase: 38-melee-active-abilities plan 01
    provides: "content/abilities.js catalog (ABILITY_BY_ID/ABILITY_POOL/ONCE_A_FIGHT), c.abilities on every character"
  - phase: 38-melee-active-abilities plan 02
    provides: "engine/derived.js#abilityEffectActive, the transient state.combat.abilityStrike descriptor"
  - phase: 38-melee-active-abilities plan 03
    provides: "engine/abilities.js#useAbility/abilityRoundsLeft, the useAbility action, 23 narrated events, the abilityRefused canon refusal register"
  - phase: 38-melee-active-abilities plan 04
    provides: "the Joiner class-driven ability policy (no shell dependency, already reachable on-device)"
provides:
  - "src/browser/combatMenu.js: abilityRows(c), the melee ABILITIES branch (READY/N ROUNDS/ONCE A FIGHT · USED, always tappable), the Bard's Sing-then-abilities rows, five new COMBAT_MENU_COPY literals"
  - "src/browser/viewModels.js: characterSheetViewModel(state).abilities[] ({ id, name, description, source, state }), ABILITY_VIEW_COPY"
  - "src/browser/rail.js: RAIL_COPY.abilityPool, abilityPoolCard(c) — the first-paint level-1 pool-pick rail card"
  - "mazeworld.html: COMBAT_DISPATCH.useAbility + window.mzUseAbility, the #s-abilities Hero-tab list + renderAbilityRows(c), window.__mzAbilities bridge, surfaceAbilityPool(state) wired into commitRolledState + the dev start-at-depth path, mzCombatReport's 'New trick:' line + noteCombat's learned field"
  - "test/unit/shell-abilities.test.js (new, source pins); re-pinned test/unit/shell-combat-actions.test.js (nine dispatch types)"
  - "docs/ABILITIES.md: 'UI (Plan 05)' + 'Requirements map' sections; the phase-close ledger is complete"
  - "REQUIREMENTS.md: ABIL-01 and ABIL-04 marked complete (ABIL-02/03/05 already complete from Plans 01/04) — Phase 38 fully closed"
affects: ["39 (gear/magic items — builds on the same submenu/Hero-tab conventions)", "42 (tuning-bot ability-use policy)", "milestone-close UAT batch"]

tech-stack:
  added: []
  patterns:
    - "the ABILITIES branch's rows are ALWAYS enabled: true — a deliberate departure from SPELLS' castable-gated enabled — because a tap on cooldown must reach the engine's own abilityRefused canon refusal line in the fight log, never a disabled/greyed no-op"
    - "the state-suffix rule (READY/N ROUNDS/ONCE A FIGHT · USED, cd N ROUNDS/once a fight) lives in exactly ONE place — src/browser/viewModels.js#characterSheetViewModel — read by both the Hero-tab list (via window.__mzAbilities.sheet) and, independently, combatMenu.js#abilityRows for the submenu's own cost text; both compute the SAME cooldown-source facts (isReady/abilityRoundsLeft) without importing each other, since the submenu's row shape (id/label/cost/desc/enabled/dispatch) and the Hero-tab's row shape (id/name/description/source/state) are genuinely different consumers"
    - "surfaceAbilityPool(state) mirrors surfaceWornReconcile's own posture (Phase 37): a directly-built rail card from a pure view-model function (abilityPoolCard), pushed via window.mzRailLine + window.logLine, never folded through railCardFor's applyAction pipeline — a first-paint event, not a dispatch"

key-files:
  created:
    - test/unit/shell-abilities.test.js
  modified:
    - src/browser/combatMenu.js
    - src/browser/viewModels.js
    - src/browser/rail.js
    - mazeworld.html
    - test/unit/combatMenu.test.js
    - test/unit/characterSheetViewModel.test.js
    - test/unit/rail.test.js
    - test/unit/shell-combat-actions.test.js
    - test/unit/shell-worn-slots.test.js
    - docs/ABILITIES.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "abilityRows(c)'s cost rule is isReady ? READY : (meta.cd === \"fight\" ? ONCE A FIGHT · USED : left === 1 ? 1 ROUND : N ROUNDS.replace) — a cd:\"fight\" ability that is not ready ALWAYS reads ONCE A FIGHT · USED regardless of its remaining phase (e.g. Smoke's 2-round effect phase before its own 999-round cooldown), matching the plan's must_haves exactly"
  - "characterSheetViewModel(state).abilities' out-of-combat state text reads the ability's OWN declared cd (meta.cd), never a live c.timers record — c.timers is combat-scoped and cleared every fight (Phase 36/38's endCombat clearRoundTimers), so a live read out of combat would be structurally always-READY and useless as a state signal"
  - "abilityPoolCard(c) finds the FIRST id in c.abilities whose catalog entry has source === \"pool\" — chargen's own roll order guarantees this is always the level-1 guarantee for a fresh run (table actives are spliced in ahead of the level-1 pool pick per Plan 01), never a later level-up's pick a fresh run hasn't reached yet"
  - "surfaceAbilityPool(state) is called from BOTH commitRolledState (the roll-screen commit) and window.mzDevStartAtDepth (the dev start-at-depth path) — the plan's own must_haves explicitly names the dev path as a second reachable commit point for a fresh run's first paint"
  - "renderAbilityRows(c) uses ul.replaceChildren() (not innerHTML = \"\") to clear the list, and createElement/textContent for every row, satisfying T-38-11's no-innerHTML-in-the-region mitigation literally, not just in spirit"
  - "Rule 1 fix (out-of-scope file): test/unit/shell-worn-slots.test.js's pre-existing rail.js import-line pin broke when abilityPoolCard was appended to the same shared import statement — re-pinned to the new literal text, mirroring the Plan 01/03 grep-collision-fix precedent for unavoidable fallout in a file outside this plan's own <files> list"

requirements-completed: [ABIL-01, ABIL-04]

coverage:
  - id: D1
    description: "combatMenu.js's ABILITIES branch: a Fighter/Thief with a populated c.abilities gets submenu rows (READY/N ROUNDS/ONCE A FIGHT · USED, always tappable) and the grid sub-line reads {ready}/{n} READY; the Bard keeps Sing first; an empty/absent c.abilities keeps today's disabled fallback; a Magic User is unchanged"
    requirement: "ABIL-01"
    verification:
      - kind: unit
        ref: "test/unit/combatMenu.test.js (ABILITIES-branch section, 6 new tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The shell dispatch bridge: COMBAT_DISPATCH.useAbility -> window.mzUseAbility -> engineCombatAction(\"useAbility\", { key }), the real useAbility action from Plan 03"
    requirement: "ABIL-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-abilities.test.js (COMBAT_DISPATCH section); test/unit/shell-combat-actions.test.js (re-pinned to nine dispatch types)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hero tab: #s-abilities lists c.abilities with a provenance tag (special skill · active / trick) and a legible state suffix (READY/N rounds/once a fight · used in combat; cd N rounds/once a fight out of combat); a Magic User shows the none row; #s-skills stays passives-only, byte-identical"
    requirement: "ABIL-04"
    verification:
      - kind: unit
        ref: "test/unit/characterSheetViewModel.test.js (abilities[] section, 4 new tests); test/unit/shell-abilities.test.js (renderAbilityRows section)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A fresh run's level-1 pool pick is narrated once on first paint (rail card via abilityPoolCard + Oracle line), from both the roll-screen commit and the dev start-at-depth path; a level-up's new trick is a second line on the fight report"
    requirement: "ABIL-01"
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js (abilityPoolCard section, 3 new tests); test/unit/shell-abilities.test.js (surfaceAbilityPool + mzCombatReport sections)"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/ABILITIES.md carries the UI section and the full requirement -> plan / SC -> plan map; REQUIREMENTS.md marks ABIL-01/04 complete; the whole-phase gate is green with the master/fixtures untouched"
    verification:
      - kind: unit
        ref: "npm test (2563/2563, # fail 0); npm run build:www exit 0; git hash-object prototype-master.js.txt unchanged; test/parity/fixtures untouched"
        status: pass
    human_judgment: false
  - id: D6
    description: "The aggregated, plan-grouped, continuously-numbered Pixel 7 checklist exists in this SUMMARY for the milestone-close UAT batch (never executed in this run)"
    verification: []
    human_judgment: true
    rationale: "On-device verification is explicitly deferred to the milestone-close UAT batch per the phase's 'defer uat to end' protocol — no device steps, no adb, no APK build in this run."

duration: 30min
completed: 2026-09-18
status: complete
---

# Phase 38 Plan 05: Combat Submenu, Hero-Tab List, First-Paint Pool Card & Phase Close Summary

**Put abilities on the screen and closed the phase: the ABILITIES submenu's third branch (READY / N ROUNDS / ONCE A FIGHT · USED, always tappable), the shell dispatch bridge, a Hero-tab abilities list beside Special skills, the level-1 pool roll narrated once as a rail card on first paint, the fight-report's "New trick" line, the `docs/ABILITIES.md` UI/requirements sections, and the phase's full aggregated Pixel 7 checklist.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 11 (1 new, 10 modified)

## Accomplishments

- `src/browser/combatMenu.js`: `abilityRows(c)` (module-private) — one row per `c.abilities` catalog id, `{ id: "ability-<key>", label, cost, desc, enabled: true, dispatch: { type: "useAbility", key } }`; a new `else if (Array.isArray(c.abilities) && c.abilities.length)` branch (inserted before the existing disabled fallback) drives the grid's `{ready}/{n} READY` sub-line and the submenu; the Bard's branch appends `...abilityRows(c)` after the byte-identical Sing row. Five new `COMBAT_MENU_COPY` literals (`abilityReady`/`abilityUsedUp`/`abilityRound`/`abilityRounds`/`abilitiesSub`).
- `src/browser/viewModels.js`: `characterSheetViewModel(state).abilities[]` — `{ id, name, description, source, state }` per `c.abilities` entry, with the in-combat (`READY`/`{n} rounds`/`once a fight · used`) vs. out-of-combat (`cd {n} rounds`/`once a fight`) state-suffix rule in `ABILITY_VIEW_COPY` — the ONE place this rule lives.
- `src/browser/rail.js`: `RAIL_COPY.abilityPool` + `abilityPoolCard(c)` — the first-paint rail card for a fresh run's guaranteed level-1 pool pick (SC-3), finding the FIRST `source: "pool"` id in `c.abilities`; `null` for a Magic User or a table-only/empty/invalid `c`.
- `mazeworld.html`: `COMBAT_DISPATCH.useAbility` + `window.mzUseAbility(key)` (the real dispatch bridge); the `#s-abilities` Hero-tab `<ul>` directly beside `#s-skills`, rendered by paint-local `renderAbilityRows(c)` via the new `window.__mzAbilities` bridge (`byId`/`roundsLeft`/`isReady`/`sheet: characterSheetViewModel`) — createElement/textContent only, no innerHTML in the region (T-38-11); `surfaceAbilityPool(state)` (new) called at the tail of `commitRolledState` and inside `window.mzDevStartAtDepth`; `mzCombatReport`'s victory report gains a `"New trick: {name}."` line per `d.learned` entry, and `noteCombat`'s report `data` carries `learned` from `abilityLearned` events.
- `test/unit/shell-abilities.test.js` (new, 9 tests): source pins for every `mazeworld.html` change above, plus build-artefact sanity.
- `test/unit/shell-combat-actions.test.js`'s `COMBAT_DISPATCH` pin re-pinned to nine dispatch types.
- `docs/ABILITIES.md`: "UI (Plan 05)" (submenu rows, the Bard ruling, the Hero-tab list, first paint, the fight-report line) and "Requirements map" (ABIL-01..05 → plans, SC-1..5 → proving tests). `REQUIREMENTS.md`: ABIL-01 and ABIL-04 marked complete — Phase 38 fully closed (all five ABIL requirements complete).
- Whole-phase gate reverified green: `npm test` 2563/2563 (`# fail 0`); `npm run build:www` exit 0; `test/parity/fixtures` untouched; `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); no package/tools diff; zero `fonts.googleapis`; `test/unit/chargen-rng-pin.test.js` unchanged since `56d51e3` and green; the cumulative `engine`/`content`/`src`/`mazeworld.html`/`docs` footprint since `56d51e3` is exactly 23 files (the union of all five plans' declared footprints); `store-listing/`/`tools/store-screenshots/` never staged in any Phase 38 commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: combatMenu.js ABILITIES branch (+ Bard rows), viewModels.js abilities[], rail.js abilityPoolCard — pure modules, tests first** — `318556b` (test)
2. **Task 2: mazeworld.html — dispatch bridge, Hero-tab list + bridge, surfaceAbilityPool, mzCombatReport learned line; source pins** — `95963c5` (feat)
3. **Task 3: docs/ABILITIES.md UI + requirements map, REQUIREMENTS.md ABIL-01/04, Phase 38 closing gate** — `b607ccf` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/browser/combatMenu.js` — `abilityRows(c)`, the ABILITIES branch, the Bard's Sing+rows branch, five new `COMBAT_MENU_COPY` literals
- `src/browser/viewModels.js` — `characterSheetViewModel(state).abilities[]`, `ABILITY_VIEW_COPY`
- `src/browser/rail.js` — `RAIL_COPY.abilityPool`, `abilityPoolCard(c)`
- `mazeworld.html` — `COMBAT_DISPATCH.useAbility`/`window.mzUseAbility`, `#s-abilities` markup + `renderAbilityRows(c)`, `window.__mzAbilities` bridge, `surfaceAbilityPool(state)`, `mzCombatReport`'s "New trick" line + `noteCombat`'s `learned` field
- `test/unit/combatMenu.test.js`, `test/unit/characterSheetViewModel.test.js`, `test/unit/rail.test.js` — pure-module TDD coverage (12 new tests total)
- `test/unit/shell-abilities.test.js` (new, 9 tests) — mazeworld.html source pins
- `test/unit/shell-combat-actions.test.js` — re-pinned COMBAT_DISPATCH to nine types
- `test/unit/shell-worn-slots.test.js` — Rule 1 re-pin (rail.js's shared import line gained `abilityPoolCard`)
- `docs/ABILITIES.md` — "UI (Plan 05)" + "Requirements map" sections
- `.planning/REQUIREMENTS.md` — ABIL-01/04 marked complete

## Decisions Made

- `abilityRows(c)`'s cost rule reads `READY` / `ONCE A FIGHT · USED` (any `cd: "fight"` ability that is not ready, regardless of remaining phase) / `"N ROUND(S)"` — matching the plan's must_haves exactly, including the singular "1 ROUND".
- `characterSheetViewModel(state).abilities`' out-of-combat state text reads the ability's OWN declared `cd`, never a live `c.timers` record — a live read out of combat would always show READY (timers are combat-scoped, cleared at `endCombat`) and convey nothing useful.
- `abilityPoolCard(c)` finds the FIRST `source: "pool"` id in `c.abilities` — chargen's own roll order (table actives spliced in ahead of the level-1 pool pick, Plan 01) guarantees this is always the level-1 guarantee for a fresh run.
- `surfaceAbilityPool(state)` is called from both `commitRolledState` (the roll-screen commit) and `window.mzDevStartAtDepth` (the dev start-at-depth path) — the plan's own must_haves names both as reachable first-paint commit points.
- `renderAbilityRows(c)` clears via `ul.replaceChildren()` (not `innerHTML = ""`) and builds every row via `createElement`/`textContent` — satisfying the threat model's T-38-11 mitigation literally, not just in spirit.
- The two `VIEW_COPY`-style literal groups (`ABILITY_VIEW_COPY` in viewModels.js, the five new `COMBAT_MENU_COPY` entries in combatMenu.js) are kept as two independent small objects rather than one shared cross-module copy table — the submenu's cost vocabulary (`ROUNDS`/`ROUND`) and the Hero-tab's state vocabulary (`rounds`/lowercase) are genuinely different display registers for the same underlying facts, matching the plan's own separately-named literal lists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `combatMenu.js`'s new doc comment collided with its own `ONCE A FIGHT · USED` grep tripwire**
- **Found during:** Task 1, acceptance-criteria grep sweep
- **Issue:** `abilityRows(c)`'s doc comment quoted the literal string `"ONCE A FIGHT · USED"`, making `grep -c "ONCE A FIGHT · USED" src/browser/combatMenu.js` print 2 instead of the required 1 (the same grep-collision pattern documented in Plans 01/03's own SUMMARYs).
- **Fix:** Reworded the comment to reference `abilityUsedUp`'s copy key by name instead of repeating the literal string.
- **Files modified:** src/browser/combatMenu.js
- **Verification:** `grep -c "ONCE A FIGHT · USED" src/browser/combatMenu.js` now prints 1.
- **Committed in:** `318556b` (Task 1 commit)

**2. [Rule 1 - Bug] `test/unit/shell-worn-slots.test.js`'s pre-existing rail.js import-line pin broke when `abilityPoolCard` was appended to the same shared import statement**
- **Found during:** Task 2, `npm test` sweep after the mazeworld.html edits
- **Issue:** This file (not in either task's `<files>` list) pins `mazeworld.html`'s `import { ..., wornReconcileCard } from "./src/browser/rail.js";` line verbatim. Adding `abilityPoolCard` as a sibling named import on the same line (per this plan's own action text) made the exact-suffix regex fail.
- **Fix:** Re-pinned the assertion to the new literal text (`wornReconcileCard, abilityPoolCard } from "./src/browser/rail.js";`), documenting why inline — mirrors the Plan 01/03 grep-collision-fix precedent for unavoidable fallout in an out-of-scope file.
- **Files modified:** test/unit/shell-worn-slots.test.js
- **Verification:** `node --test test/unit/shell-worn-slots.test.js` — 36/36 pass; full `npm test` 2563/2563.
- **Committed in:** `95963c5` (Task 2 commit)

**3. [Rule 1 - Note] `38-05-PLAN.md`'s own `<files_to_read>` names `test/unit/viewModels.test.js`, which does not exist in this repo — the real file is `test/unit/characterSheetViewModel.test.js`**
- **Found during:** file-discovery at execution start
- **Issue:** The plan text (and its own frontmatter `files_modified`) references a `test/unit/viewModels.test.js` that has never existed in this repo; `characterSheetViewModel.test.js` is the actual, pre-existing home for `src/browser/viewModels.js#characterSheetViewModel`'s unit coverage.
- **Fix:** Added the plan's `abilities[]` tests to `test/unit/characterSheetViewModel.test.js` instead — the file the plan's own described content (lines 262-295, skills[] tests) actually lives in.
- **Files modified:** test/unit/characterSheetViewModel.test.js (not `test/unit/viewModels.test.js`)
- **Committed in:** `318556b` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs — a self-inflicted grep collision and unavoidable fallout in a sibling test file's shared import pin; 1 Rule 1 documentation note — a stale filename in the plan text resolved to the real, pre-existing test file). No scope creep, no architectural changes.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required.

## Success Criteria Map (ROADMAP SC-1..5)

| SC | Text | Landed in | Proof |
|----|------|-----------|-------|
| 1 | A Fighter or Thief opens the ABILITIES submenu mid-combat and sees at least one usable ability with a clear "ready" / "N rounds" state | Plan 05 | `test/unit/combatMenu.test.js` ("Fighter with c.abilities = ['kata', 'brace']..." section) |
| 2 | Trying to use an ability on cooldown produces a named refusal in the fight log, never a silent no-op | Plan 03 | `test/unit/abilities.test.js` (refusal ladder section) |
| 3 | A fresh level-1 Fighter/Thief already has a rolled ability; each skill-level gain can add another, narrated when it happens | Plan 01 (the roll) + Plan 05 (the first-paint narration + the fight-report "New trick" line) | `test/unit/ability-pool.test.js`; `test/unit/rail.test.js` (abilityPoolCard section); `test/unit/shell-abilities.test.js` (mzCombatReport section) |
| 4 | Every sub-class that had one code-verified good and one bad still has both after any passive-to-active conversion | Plan 02 | `test/unit/identity-contract.test.js` (SC-4 guard) |
| 5 | A melee-class Joiner in the party uses its own abilities in combat by the same class-driven policy Joiners already fight with | Plan 04 | `test/unit/party-abilities.test.js` (policy matrix) |

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol: no device pause was taken anywhere in Phase 38 — this is the phase's full aggregated Pixel 7 checklist, grouped by plan and numbered continuously, for the milestone-close UAT batch. `adb install -r` + `am force-stop` + relaunch and the debug APK build itself happen at milestone close, not in this phase.

### Plan 01

1. Level a fresh Fighter or Thief once (dev start-at-depth, or a kill) and confirm the SKILL LEVEL N rail card / fight log shows a second line reading "New trick: {name} — {txt}".

### Plan 02

Nothing to add as its own device-testable action — this plan's only new engine surface (`state.combat.abilityStrike`, the three `c.timers` need-shift terms) has no producer until Plan 03/05 ship, and its two flagged latent gameplay changes (fluency now maxes at 1; climb/leap fall damage is no longer halved for anyone) have no dedicated UI surface to check — they are passive rules changes recorded for the milestone-close tone read, not a checklist item.

### Plan 03

Nothing to add as its own numbered item — this plan's engine surface (`useAbility`, the 23 new events, the canon refusal register) had no shell trigger until Plan 05 shipped the submenu; its two carry-forward asks (the cooldown line's exact wording, an on-cooldown row staying tappable) are covered by Plan 05's items 6 and 7 below. Its third ask (a voice spot-check of a few ability tones in real play) is folded into Plan 05's item 15 below.

### Plan 04

2. Recruit a Fighter or Thief Joiner and, in a fight, watch the fight log for a "{name} calls {ability}." line in round 1 (an opener ability, e.g. Pommel Strike/Dirty Trick/Battle Roar/Silent Step) followed by its effect line, and confirm the companion's name appears correctly.
3. Continue the fight past round 1 and confirm the Joiner uses a damage-tagged ability (e.g. Kata/Feint/Sweep) against a healthy foe, or a defensive-tagged one (e.g. Brace/Second Wind) once it takes damage — matching the "fights by class and by kit" design intent.
4. Confirm a Joiner's ability shows READY again at the start of the NEXT fight (cooldowns clear at `endCombat`), and that a member Battle Roar's fight-log line reads as covering the whole party's side, not just that one companion.

### Plan 05

5. Open ABILITIES mid-fight as a fresh Fighter/Thief — at least one row reads READY with its effect line.
6. Use it — the fight log shows "You call {name}." then the effect line, the foes take their turn once, the row now reads "N ROUNDS".
7. Tap the same row on cooldown — the fight log shows "{Name}: N rounds. Your arm has opinions." and nothing else happens.
8. A once-a-fight ability after use reads "ONCE A FIGHT · USED" and is READY again next fight.
9. Bard: Sing is still the first row, ability rows follow.
10. Hero tab: Special skills list shows only kept passives; the Abilities list shows table actives tagged "special skill · active" and pool tricks tagged "trick", with "cd N rounds" / "once a fight" out of combat.
11. A brand-new run's first paint shows the UP YOUR SLEEVE rail card "New trick: {name} — {txt}" once, mirrored in the Oracle.
12. Level up in a fight — the fight log carries "New trick: …" and the victory report lists it.
13. TalkBack reads each ability row's label/cost/desc.
14. A pre-Phase-38 save resumes with its old skills renamed/dropped and abilities present (Hero tab) with no card or crash.
15. Spot-check a few ability tones (e.g. Pommel Strike/Sweep/Riposte/Smoke) for the family-friendly deadpan voice in real play, not just the synthetic safety-scan corpus (carried forward from Plan 03).

## Next Phase Readiness

- Phase 38 is fully closed: all five ABIL requirements (ABIL-01..05) are complete, `npm test` is green at 2563/2563, and the parity master/fixtures are byte-identical to before the phase.
- Every engine surface (Plans 01-04) and every shell surface (this plan) needed for melee active abilities is complete and reusable as-is.
- `docs/ABILITIES.md` is the living reference for the full catalog, the level-pool mechanism, the dispatcher's play rules, the Joiner policy, and the UI conventions this phase established.
- The 15-item aggregated Pixel 7 checklist above (plus Plans 02/03's "nothing to add" notes) is queued for the milestone-close UAT batch — no device steps or APK build were taken in this phase, per the standing `defer uat to end` protocol.
- No blockers.

---
*Phase: 38-melee-active-abilities*
*Completed: 2026-09-18*

## Self-Check: PASSED

All created/modified files found on disk (`src/browser/combatMenu.js`, `src/browser/viewModels.js`, `src/browser/rail.js`, `mazeworld.html`, `test/unit/shell-abilities.test.js`, `test/unit/characterSheetViewModel.test.js`, `docs/ABILITIES.md`, `.planning/REQUIREMENTS.md`, this SUMMARY.md); all three task commit hashes (`318556b`, `95963c5`, `b607ccf`) found in `git log --oneline --all`.
