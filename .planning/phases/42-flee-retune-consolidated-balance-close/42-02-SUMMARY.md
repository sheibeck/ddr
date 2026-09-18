---
phase: 42-flee-retune-consolidated-balance-close
plan: 02
subsystem: tools
tags: [tuning-bot, abilities, items, loot, worn-slots, store-roll, harness, no-stall]

# Dependency graph
requires:
  - phase: 42-flee-retune-consolidated-balance-close plan 01
    provides: "content/flee.js, engine/derived.js#fleeBreakdown, engine/combat.js#flee's fleeRolled { roll, mods, total, need } — the bot's flee/parley threshold reads through the same flee() call, unaffected by this plan"
  - phase: 38-melee-active-abilities plan 04
    provides: "engine/combat.js#pickMemberAbility/resolveMemberAbility (the Joiner class-driven ability-use policy this plan mirrors for the hero) and engine/abilities.js#useAbility's refusal ladder"
  - phase: 39-gear-magic-items-one-shot-tools plan 02/03/04
    provides: "engine/items.js#itemReady/useItem/TARGETED_KINDS/takeAllLoot/leaveAllLoot, engine/derived.js#activationFor/itemEffectActive/inDark/DEATH_PANIC_THRESHOLD, engine/state.js#newRun's storeRoll/wornSlots options"
provides:
  - "tools/lib/tuning-bot.mjs#chooseAbility(state, ctx) + hardestFoeIndex(state): mirrors engine/combat.js#pickMemberAbility's exact policy (round-1 opener; damage above half hp with Last Stand's death-panic gate; defensive below half) with sheet=ally=state.c; once-a-fight foe-targeted abilities (mark/hamstring/cutpurse/lastStand) aimed at the hardest live foe"
  - "tools/lib/tuning-bot.mjs#chooseCombatItem/chooseFieldItem(state, ctx): heal-before-flee, round-1 buff before a hard fight (bag potion or worn Cloak of Speed), a Magic User's ready worn/bagged staff, and a bag torch lit in the dark"
  - "tools/lib/tuning-bot.mjs#BOT_TACTICS (frozen tactics constants, kept OUT of the frozen Bot: line) and RUN_FLAGS = { storeRoll: true, wornSlots: true } (the bot now plays the shipped run rules)"
  - "decideAction's extended chain: (a0) heal, (a) flee/parley, (b) drinkPotion, (b2)/(b3) buff/staff, (c) talk-first, ... (h) spell scoring, (h2) ability, (i) attack; out of combat: (loot) takeAllLoot/leaveAllLoot FIRST, (torch) after camp"
  - "makeBotContext's abilityBlocked/itemBlocked Sets + observe's abilityRefused/useRefused/lootTaken/lootLeft handling — the Rule-1 no-stall safety net for a refused ability/item"
  - "playRun's second harness-only write-path bypass: assigns state.combat.target from a once-a-fight ability's own target before dispatching the bare { type: 'useAbility', key } action, mirroring the shell's foe-card tap"
  - "test/unit/bot-tactics.test.js (new, 32 tests): the ability policy matrix, the item policy matrix, every guard, the loot pile, the torch, RUN_FLAGS plumbing, and two measured no-stall proofs"
affects: [42-03-usage-tallies, 42-04-consolidated-balance-close]

tech-stack:
  added: []
  patterns:
    - "chooseAbility(state, ctx) mirrors pickMemberAbility(sheet, ally, round, target) with sheet=ally=state.c (the hero uses its own kit exactly like a Joiner uses its own) — a second instance of the same class-driven policy rather than a bespoke bot rule"
    - "ctx.abilityBlocked/ctx.itemBlocked (Set<string>) extend the existing ctx.parleyBlocked/fleeBlocked/strikeBlocked Rule-1 pattern: a refusal event blocks the exact key/label for the rest of the encounter (itemBlocked also clears on floorChanged), so a refused pick can never loop the bot to maxActions"
    - "playRun's SECOND harness-only write-path bypass (after forceParty): a presentation-layer state.combat.target assignment before dispatching, mirroring mazeworld.html's own foe-card tap — decideAction itself never mutates state"
    - "RUN_FLAGS is a separate frozen constant from BOT_DEFAULTS/BOT_TACTICS specifically so the botLine()/BOT_DEFAULTS byte-identity with the BEFORE pin's meta.bot is preserved — new tactics numbers and new run rules both stay off that line"

key-files:
  created:
    - test/unit/bot-tactics.test.js
  modified:
    - tools/lib/tuning-bot.mjs
    - test/unit/tuning-bot.test.js

key-decisions:
  - "[Rule 1] test/unit/tuning-bot.test.js's pre-existing Phase 41 water test had its maxActions budget raised 1000->1500 (measured live): the new ability policy lets seed 2's Fighter survive to action 1106 (not <1000, the prior measured ceiling) because it now fights more effectively with its kit — a legitimate behavior change, not a routing stall; 1000 would have reported a false stuck purely from a stale budget"
  - "Dropped the unused engine/derived.js#slotFor import (planned per the plan's own Action B text but never called — the address rule is handled directly via c.worn.cloak/c.worn.staff plus the explicit legacy-bag fallback, which is narrower and needed no generic slot lookup)"
  - "A legacy state without c.worn (no wornSlots) still reads a bagged Magic User staff by bag index — kept as a second path per the plan's own Guards text (T-39-04 precedent), even though every real playRun call now sets wornSlots:true via RUN_FLAGS"

requirements-completed: []

coverage:
  - id: D1
    description: "chooseAbility mirrors pickMemberAbility's exact class-driven use policy (round-1 opener; damage above half hp with Last Stand's death-panic gate; defensive below half); hardestFoeIndex aims a once-a-fight foe-targeted ability at the hardest live foe; every pick is guarded by isReady + ctx.abilityBlocked"
    requirement: "BAL-01"
    verification:
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (chooseAbility policy matrix + guards + once-a-fight targeting, 8 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (decideAction wiring: opener/target/sing-precedence, 2 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "chooseCombatItem heals below the flee line before fleeing, pops a round-1 buff (bag potion or worn Cloak of Speed) before a hard fight, and fires a Magic User's ready worn/bagged staff (targeted/dome/heal); chooseFieldItem lights a bag torch in the dark; every candidate is guarded by itemReady + ctx.itemBlocked"
    requirement: "BAL-01"
    verification:
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (heal/buff/staff policy matrix + guards, 12 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (chooseFieldItem + torch decideAction wiring, 2 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The victory loot pile (state.pendingLoot) is taken/left FIRST in the out-of-combat chain (before even a pending Joiner); RUN_FLAGS = { storeRoll: true, wornSlots: true } are spread into playRun's newRun call so the bot plays the shipped game's run rules"
    requirement: "BAL-01"
    verification:
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (loot pile + observe lootTaken/lootLeft, 2 tests; RUN_FLAGS/playRun plumbing, 1 test)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ctx.abilityBlocked/ctx.itemBlocked block a refused ability/item key for the rest of the encounter (itemBlocked also on floorChanged) — the Rule-1 no-stall safety net; a forced-cell no-stall proof (Fighter x5 seeds for abilities, Thief/MU/Fighter x3 seeds for items) confirms zero stalls and at least one real ability/item use"
    requirement: "BAL-01"
    verification:
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (observe abilityRefused/useRefused blocks, 2 tests; two measured no-stall proofs)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Bot: parameter line and BOT_DEFAULTS keys stay byte-identical to the BEFORE pin's meta.bot (new tactics numbers live in BOT_TACTICS, never the line); decideAction stays pure; the whole suite is green with the master hash and fixtures unchanged"
    verification:
      - kind: unit
        ref: "node -e botLine(...) === docs/class-pass/v15-before.json meta.bot (byte-identical, verified live)"
        status: pass
      - kind: unit
        ref: "npm test (2967/2967, # fail 0); git hash-object test/parity/prototype-master.js.txt (a1f4d0dc29782218d8e5aab65bc5989c33f917f0, unchanged); git status --porcelain test/parity/fixtures (empty)"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-09-18
status: complete
---

# Phase 42 Plan 02: Bot Learns Abilities, Items, Loot, and the Shipped Run Rules Summary

**The tuning bot (`tools/lib/tuning-bot.mjs`) now fights with its own kit exactly like a Joiner does — a class-driven ability policy on the hero's own `state.c`, heal-before-flee and round-1 buffs, a Magic User's worn staff, a lit torch in the dark, the victory loot pile it has ignored since v1.3, and the shipped game's `storeRoll`/`wornSlots` run rules — every pick guarded against refusal loops, with the frozen `Bot:` parameter line untouched.**

## Performance

- **Duration:** ~90 min
- **Tasks:** 3
- **Files modified:** 3 (1 new, 2 modified)

## Accomplishments

### Abilities

- `hardestFoeIndex(state)`: the live foe with the highest `lvl` (tie -> higher `wp`, tie -> lowest index), or `null` with no live foe.
- `chooseAbility(state, ctx)`: mirrors `engine/combat.js#pickMemberAbility` verbatim, with `sheet = ally = state.c` — the hero uses its own rolled kit by the exact same class-driven policy a Joiner's own kit follows: a round-1 opener-tagged ability; else a damage-tagged ability while the live target is above half hp (Last Stand excluded unless the hero is at/below `DEATH_PANIC_THRESHOLD`); else a defensive-tagged ability while the hero itself is below half hp; else `null` (falls through to the plain attack). A once-a-fight (`cd === "fight"`) foe-targeted pick (`mark`/`hamstring`/`cutpurse`/`lastStand`) carries `target: hardestFoeIndex(state)`; every other pick carries none. Gated to Fighter/Thief; every candidate must be owned, resolve to the character's own class, be `isReady`, and not already sit in `ctx.abilityBlocked`.
- `decideAction` gains step (h2), between the spell-scoring table and the plain attack fallback — never reached by a Magic User (`chooseAbility` itself gates on `c.cls`).
- `makeBotContext` gains `abilityBlocked`/`itemBlocked` (`Set<string>`); `observe`'s `abilityRefused { key }` adds `key` to `ctx.abilityBlocked` (the Rule-1 no-stall net — a refusal returns with NO state change), cleared on `encounterStarted`.
- `playRun` gains the SECOND harness-only write-path bypass (after `forceParty`): when `decideAction` picks a once-a-fight foe-targeted ability, the loop assigns `state.combat.target` from the action's own `target` before dispatching the bare `{ type: "useAbility", key }` — mirroring `mazeworld.html`'s own foe-card tap (`S.combat.target = i`), never an rng-bearing mutation. `decideAction` itself stays pure.

### Items, loot, and the shipped run rules

- `RUN_FLAGS = Object.freeze({ storeRoll: true, wornSlots: true })`, spread into `playRun`'s `newRun` call — the bot now plays the shipped game's run rules (the worn-slot model + the depth-rolled store) instead of the legacy bag-summed `eff()`/fixed store the BEFORE pin (`e69ff07`) measured against.
- `hardFight(state)`: true when the encounter holds any kit-bearing live foe OR any live foe at/above `BOT_TACTICS.hardFoeLvl` (3).
- `chooseCombatItem(state, ctx)`: (1) below the flee line, drinks a bag Healing/Xtra Healing potion (Xtra Healing preferred) BEFORE the flee/parley decision; (2) at round 1 of a `hardFight`, pops a bag Speed/Strength/Enlarge potion (in that preference order, skipped once its activation kind is already live) or a ready worn Cloak of Speed — skipped entirely for a Pilfer (a non-heal/full item, which `useItem` would refuse `pilfer`); (3) a Magic User's ready staff (worn when `"worn" in c`, else bagged — the legacy T-39-04 path) fires a targeted kind (freeze/weaken/stone/fire/gas) at `BOT_TACTICS.staffMinFoes`+ live foes, or `dome`/`heal` below `potionThreshold` (dome also requires no active `c.ward`). Every candidate passes `itemReady` (covers the death-potion/no-charge/cooldown cases structurally) and is skipped when its `itemLabel` sits in `ctx.itemBlocked`.
- `chooseFieldItem(state, ctx)`: lights a bag torch (`kind === "tool" && use === "light"`) while `inDark(state)` and no `lit` effect is already running; rope/ladder stay on the existing `pendingHazard` answer.
- `decideAction`'s in-combat chain gains (a0) heal-before-flee and (b2)/(b3) buff/staff (after the generic `drinkPotion` step, before talk-first); the out-of-combat chain gains the loot-pile step FIRST (before even a pending Joiner: `takeAllLoot` unless `ctx.findFull`, else `leaveAllLoot`) and the torch step after camp.
- `observe`'s `useRefused { item }` adds `itemLabel(item)` to `ctx.itemBlocked` (the item-side Rule-1 no-stall net); `lootTaken`/`lootLeft` clear `findFull` the same way `findTaken`/`findLeft` do; `itemBlocked` clears on EITHER `encounterStarted` OR `floorChanged` (a torch/staff/cloak refusal doesn't survive a floor change either).
- `itemLabel(it)` exported (`potion:<eff2>` / `tool:<tool>` / the item's own `.n`) for Plan 03's usage tallies.
- `BOT_TACTICS = Object.freeze({ hardFoeLvl: 3, staffMinFoes: 2, dotToughMargin: 1, mapBankRatio: 0.5 })` — a separate frozen constant from `BOT_DEFAULTS`, kept OFF the `Bot:` line, so the byte-identity gate against the BEFORE pin's `meta.bot` holds; `dotToughMargin`/`mapBankRatio` are consumed by Plan 03's spell-by-niche rules.

### Tests and header

- `test/unit/bot-tactics.test.js` (new, 32 tests): the `chooseAbility` policy matrix and guards, once-a-fight hardest-foe targeting, `decideAction` wiring (opener/sing precedence/never-for-MU), the `abilityRefused` observe block, a measured 5-seed ability no-stall proof; `hardFight`/`itemLabel`; the `chooseCombatItem` heal/buff/staff policy matrix and every guard (death potion never chosen, Pilfer skipped for buffs, worn-vs-bagged staff addressing, `itemBlocked`, empty-staff-charges); `chooseFieldItem`'s torch logic and its `decideAction` wiring; the loot-pile step and its `observe` handling; the `useRefused` block (encounter- and floor-scoped clearing); `RUN_FLAGS`/`playRun` plumbing (a Thief starts with its cloak worn); a measured 9-run (Thief/MU/Fighter × seeds 1-3) no-stall proof.
- `test/unit/tuning-bot.test.js`: extended the purity test with a Fighter/abilities/timers state in round 2; `[Rule 1]` raised the pre-existing Phase 41 water test's `maxActions` from 1000 to 1500 (see Deviations).
- `tools/lib/tuning-bot.mjs`'s header comment: the read-only helper list gains `isReady` (effects.js), `itemReady`/`toolIndex`/`TARGETED_KINDS` (items.js), `inDark`/`itemEffectActive`/`activationFor`/`DEATH_PANIC_THRESHOLD` (derived.js), `ABILITY_BY_ID` (content); "exactly ONE write-path bypass" is now "exactly TWO — `forceParty` and `playRun`'s combat-target selection before a `useAbility` dispatch".

## Task Commits

1. **Task 1: Abilities — chooseAbility mirrors pickMemberAbility, hardest-foe targeting for once-a-fight abilities, refusal blocks, purity kept** - `1baa3dc` (feat)
2. **Task 2: Items — heal before flee, buffs before a hard fight, worn staves in combat, torch in the dark, the loot pile, and the shipped run rules** - `933e188` (feat)
3. **Task 3 (part 1): Plan gate, tuning-bot header** - `ef9d73c` (docs)

**Plan metadata:** this commit (SUMMARY only; `commit_docs: true` in this project's config, but per this run's instructions the orchestrator owns STATE.md/ROADMAP.md writes)

## Files Created/Modified

- `tools/lib/tuning-bot.mjs` — `chooseAbility`, `hardestFoeIndex`, `chooseCombatItem`, `chooseFieldItem`, `itemLabel`, `hardFight`, `BOT_TACTICS`, `RUN_FLAGS`, `decideAction`'s extended chain, `makeBotContext`'s new Sets, `observe`'s new handlers, `playRun`'s second bypass + `RUN_FLAGS` pass-through, the updated header comment
- `test/unit/bot-tactics.test.js` (new) — 32 tests covering both the ability and item tactics
- `test/unit/tuning-bot.test.js` — the extended purity-test state; the Rule-1 `maxActions` budget fix

## Decisions Made

See frontmatter `key-decisions` — the measured `maxActions` budget fix on the pre-existing Phase 41 water test, dropping the unused `slotFor` import, and keeping the legacy bagged-staff addressing path alongside the now-always-on worn-slot model are all recorded there with rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/tuning-bot.test.js`'s pre-existing Phase 41 water test's `maxActions` budget was too small for the new ability policy**
- **Found during:** Task 1 (running the full `tuning-bot.test.js` suite after adding `chooseAbility`)
- **Issue:** The test's own comment recorded a live measurement ("all three seeds complete well under 1000 actions") from BEFORE this plan. After `chooseAbility` landed, seed 2's forced-nothing Fighter now fights more effectively with its rolled kit and survives to action 1106 before dying naturally — a legitimate behavior change (the bot uses abilities that extend a fight), not a routing stall. At the old `maxActions: 1000`, this run would report a false `stuck: true`.
- **Fix:** Re-measured live (`node -e` against `playRun`) with a higher budget; raised `maxActions` from 1000 to 1500 (comfortably clear of the new ceiling for all three seeds) and updated the test's own comment to record both the old and new measurements.
- **Files modified:** test/unit/tuning-bot.test.js
- **Verification:** `node --test test/unit/tuning-bot.test.js` — the water test passes; `npm test` stays at `# fail 0`.
- **Committed in:** `1baa3dc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a stale hardcoded test budget invalidated by this plan's own legitimate behavior change, not a defect in the new code)
**Impact on plan:** No scope creep, no architectural change — the fix is entirely a test-budget correction, re-measured live rather than guessed.

## Issues Encountered

None beyond the deviation above. Every acceptance-criteria grep and `node -e` check in both tasks' `<acceptance_criteria>` blocks passed on the first or second attempt (one JSDoc wording tweak was needed in Task 1 so the `state.combat.target = action.target` string appeared exactly once, satisfying the plan's own `grep -c ... == 1` check).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device pauses occurred. This plan is bot-only (`tools/`, `test/`, `.planning/` — no `mazeworld.html`/`src/browser` edits, no `npm run build:www` needed): **nothing device-testable** — the tuning bot never runs on a Pixel 7, and this plan changes no player-facing behavior. Recorded here for the milestone-close aggregated Pixel 7 checklist as an explicit "none" entry, per this run's deferred-UAT protocol:

1. None — dev harness only; the Pixel 7 checklist gains nothing from this plan.

## Corrections to CONTEXT

1. The bot never took the victory loot pile (`state.pendingLoot`) before this plan — items came only from encounter-dot finds (`state.pendingFind`) and store purchases; the pile has been offered by `killFoe` since Phase 29 (v1.3) but the bot's `decideAction` chain never checked for it, so every victory drop sat unclaimed until `forfeitLoot` cleared it on the next flee/death.
2. The bot ran `newRun(seed)` with no options beyond `startDepth`/`force` — no `storeRoll`, no `wornSlots` — since it was first written (Phase 21/22). This meant every prior tuning-bot readout (including the v1.5 BEFORE pin, `e69ff07`) measured the LEGACY bag-summed `eff()` model and the fixed (non-depth-scaled) store, not the worn-slot model or depth-rolled store real players see. `RUN_FLAGS` closes this gap; Plan 03/04 record it in `meta.runFlags` for the AFTER matrix.
3. `maxActions` budget adjustment: see Deviations above (1000 -> 1500 on the Phase 41 water test, measured live).

## Next Phase Readiness

- Plan 03 adds spells-by-niche (`chooseSpell` stays kind-generic per CONTEXT, but `BOT_TACTICS.dotToughMargin`/`mapBankRatio` are already anchored for its DOT/Map-the-Floor rules), the usage tallies (a `usage` count per ability/spell/item — `itemLabel`/ability `key` are the exact keys to tally against), a 3-seed smoke, and the ledger addendum.
- `chooseAbility`/`chooseCombatItem`/`chooseFieldItem`/`hardestFoeIndex`/`hardFight`/`itemLabel`/`BOT_TACTICS`/`RUN_FLAGS` are all exported and ready for Plan 03 to import without further engine or tools changes.
- The `Bot:` line stays frozen; Plan 04's parameter-parity gate against the BEFORE pins will pass unchanged.
- No blockers.

---
*Phase: 42-flee-retune-consolidated-balance-close*
*Completed: 2026-09-18*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`tools/lib/tuning-bot.mjs`, `test/unit/bot-tactics.test.js`, `test/unit/tuning-bot.test.js`, this SUMMARY.md); all three task commits (`1baa3dc`, `933e188`, `ef9d73c`) confirmed present in `git log`.
