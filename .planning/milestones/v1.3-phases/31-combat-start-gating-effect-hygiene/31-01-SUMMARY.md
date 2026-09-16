---
phase: 31-combat-start-gating-effect-hygiene
plan: 01
subsystem: engine-combat
tags: [rng, parity, combat, phobia, afraid, fight-gate, cmb-01]

# Dependency graph
requires:
  - phase: 29-end-of-combat-loot-bag-cap
    provides: "reconcilePendingLoot precedent (compare-only harness reconcile pattern) and the three local comparable() copies convention this plan's reconcilePendingFight mirrors"
provides:
  - "engine/combat.js: export function fight(state, rng, events) — initiative onward, the phobia trigger now sets combat.afraid; export function refuseIfPending(state, events, type, extra) — the ONE notFought guard, wired into playerStrike/flee/parley/sing/castSpell/drinkPotion/readScroll/useItem"
  - "startCombat ends at the roster with combat.pending:true and an encounterStarted that no longer carries first"
  - "engine/derived.js: AFRAID_ROUNDS/AFRAID_TO_HIT_PENALTY/AFRAID_DMG_DIV constants, afraidNeed(state, need)/afraidDamage(state, dmg) pure helpers, conditionsOf's afraid chip (replaces the old phobia chip)"
  - "engine/actions.js + engine/engine.js: the fight action type, validated and dispatched"
  - "tools/lib/tuning-bot.mjs: decideAction presses Fight! first whenever state.combat.pending"
  - "src/browser/toasts.js + eventNarration.js: combatJoined/castRefused/actionRefused/phobiaAfraid/fearPassed entries; every refusal builder's reason map extended with notFought (and useRefused's CMB-02 cooldown/wrongClass/combatOnly/exploreOnly/noTarget reasons)"
  - "test/parity/harness/comparables.js: reconcilePendingFight (exported, compare-only), applyStartCombat chains a real fight"
  - "three declared action-path divergence records (combat/lose seed 14, combat/lose-apprentice seed 127, magic/cast-damage seed 8) plus a fourth re-measured Phase 27 record (combat/parley seed 303) for a discovered rng-reordering side effect"
  - "test/parity/fixtures/action-script.combat.json: new lose-plain scenario (seed 1119) restoring byte-identical death-path parity coverage"
  - "test/parity/pending-fight-audit.test.js: the standing A3 walk"
  - "test/unit/fight-gate.test.js + test/unit/afraid.test.js: the CMB-01/Afraid engine-level pins"
affects: [31-02-usable-features-audit-refusal-vocabulary, 31-03-shell-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "refuseIfPending(state, events, type, extra) — a single shared guard function called as the FIRST statement in every combat-gated action, pushing {type, ...extra, reason:'notFought'} and returning true/false, so a future notFought wording change touches one place, not eight call sites"
    - "The parity coverage-derivation tests (formatEventsCoverage/toastsCoverage) scan engine source for literal `type: \"...\"` object keys to build their canonical event-type vocabulary — a shared factory function like refuseIfPending that constructs its event from a parameter is INVISIBLE to that regex; both derivation functions now also union in literal type names passed as refuseIfPending's 3rd positional argument, mirroring the existing KNOWN_INDIRECT_TYPES precedent for factory-constructed event types"
    - "reconcilePendingFight(state) mirrors reconcilePendingLoot's compare-only pattern exactly: real gameplay comparables want combat.pending to survive a dispatch, so the reconcile runs on a CLONE (via applyAction) and is never applied to the real replay state; only the harness's applyStartCombat (used by scripted startCombat fixture actions) does a REAL chain"

key-files:
  created:
    - test/unit/fight-gate.test.js
    - test/unit/afraid.test.js
    - test/parity/pending-fight-audit.test.js
  modified:
    - engine/combat.js
    - engine/derived.js
    - engine/magic.js
    - engine/items.js
    - engine/actions.js
    - engine/engine.js
    - tools/lib/tuning-bot.mjs
    - src/browser/toasts.js
    - src/browser/eventNarration.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js
    - test/parity/full-suite.test.js
    - test/parity/fixtures/action-script.combat.json
    - test/parity/fixtures/action-script.magic.json
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/fixture-inventory.test.js
    - test/unit/toastTable.test.js
    - test/unit/formatEventsCoverage.test.js
    - test/unit/toastsCoverage.test.js
    - test/unit/combat.test.js
    - test/unit/conditions.test.js
    - test/unit/combat-scaling.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/identity-combat.test.js
    - test/unit/identity-contract.test.js
    - test/unit/parley.test.js
    - test/unit/tuning-bot.test.js
    - test/determinism/foe-abilities.test.js

key-decisions:
  - "startCombat's Knight/Con Artist/Court Mage foe-removal loop keeps its EXISTING code position (ahead of the rollInitiative cut line), per the plan's literal instruction to keep encounterStarted/trackable/allyJoined/warlockBoost/foeFled/foeBored/encounterCleared 'exactly where they are' — this means fight's own rollInitiative now runs AFTER that loop rather than before it (the loop was textually before rollInitiative in the pre-split code), a genuine rng-ORDER change for any character whose sub draws in that loop (Con Artist, Court Mage)"
  - "The Afraid needMods/afraid payload fields are additive-only (spread via ...(afraidMods.length ? {...} : {})), so every non-phobia strikeMissed/struck event stays byte-identical in shape to before this phase"
  - "afraidNeed/afraidDamage are pure functions taking (state, value) rather than reading combat.afraid internally at every call site, matching the existing toHit(state)-style signature convention in derived.js"

patterns-established:
  - "See tech-stack.patterns above"

requirements-completed: [CMB-01]

coverage:
  - id: D1
    description: "startCombat ends at the roster with combat.pending:true; nothing rolls or strikes (no initiative, no phobia trigger, no combatInDark, no pre-emptive foe turn) until the new fight action is dispatched"
    requirement: "CMB-01"
    verification:
      - kind: unit
        ref: "test/unit/fight-gate.test.js — tests (a)-(g)"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js — the re-pinned PHOBIA-01/CMB-01 block, the reflect-kill opener test"
        status: pass
    human_judgment: false
  - id: D2
    description: "A triggered phobia sets combat.afraid = 2 (a -3 to-hit-need penalty, floor 1, and halved damage on the player's strikes) instead of freezing the hero for a lost first action; every combat action stays available while afraid, and no refusal is ever routed to fear"
    requirement: "CMB-01"
    verification:
      - kind: unit
        ref: "test/unit/afraid.test.js — tests (i)-(ix)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every player combat action other than fight refuses with reason notFought while combat.pending, via the single shared refuseIfPending guard (8 call sites), and mutates/draws nothing"
    requirement: "CMB-01"
    verification:
      - kind: unit
        ref: "test/unit/fight-gate.test.js — test (f), all 8 REFUSAL_CASES"
        status: pass
    human_judgment: false
  - id: D4
    description: "Parity byte-identical for every non-phobia fixture; the three phobia-triggering fixtures (combat/lose, combat/lose-apprentice, magic/cast-damage) carry declared, measured action-path divergence records; a new lose-plain scenario (seed 1119) restores the byte-identical death-path coverage the Afraid ruling took from lose-apprentice; the harness's applyStartCombat chains a real fight and reconcilePendingFight covers real-gameplay comparables"
    requirement: "CMB-01"
    verification:
      - kind: integration
        ref: "test/parity/combat-parity.test.js, test/parity/magic-parity.test.js, test/parity/movement-parity.test.js, test/parity/full-suite.test.js, test/parity/fixture-inventory.test.js, test/parity/pending-fight-audit.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm test fully green (# fail 0); master untouched; every new/renamed event type has toast + Oracle copy; the old freeze vocabulary is gone from every live engine/browser/tool/test line"
    verification:
      - kind: unit
        ref: "npm test (1641/1641); git status --porcelain test/parity/prototype-master.js.txt (empty); the phobiaFrozen/shookOffFrozen/combat.frozen grep sweep (0 matches)"
        status: pass
    human_judgment: false
  - id: D6
    description: "On-device verification of the Fight! gate and the Afraid mechanic end to end (deferred to the end of the milestone run, after Plan 03's shell wiring)"
    verification: []
    human_judgment: true
    rationale: "Requires a physical device session with an active encounter to observe the Oracle log, the tracker chip, and the Fight! button together — Plan 03 is the shell-wiring plan this depends on; see the Human verification section below"

duration: 50min
completed: 2026-09-16
status: complete
---

# Phase 31 Plan 1: Combat Start Gating & Afraid Penalty Summary

**Splits `startCombat` at the roster into an encounter-only step (`pending:true`) and a new `fight` action carrying initiative/phobia/pre-emptive-strike, replaces the phobia freeze with an "Afraid" -3-to-hit/half-damage penalty (never a lost turn), and re-proves parity/draw-count fidelity across the whole suite (1641/1641 passing).**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 33 (3 new, 30 modified)

## Accomplishments
- `engine/combat.js#fight(state, rng, events)` is a validated, dispatched engine action performing `rollInitiative` → the phobia trigger → `combatInDark` → the pre-emptive `foeTurn` in the prototype's exact draw order, idempotent (zero-draw) on a null or already-joined combat; `startCombat` now ends at the roster with `combat.pending: true` and an `encounterStarted` event that no longer carries `first`
- `refuseIfPending(state, events, type, extra)` is the ONE `notFought` guard, wired as the first statement in `playerStrike`/`flee`/`parley`/`sing` (combat.js), `castSpell`/`drinkPotion`/`readScroll` (magic.js), and `useItem` (items.js) — 8 call sites, one implementation
- A triggered phobia sets `combat.afraid = AFRAID_ROUNDS` (2) instead of freezing the hero: `engine/derived.js#afraidNeed`/`afraidDamage` shrink the strike need by 3 (floor 1, never revives an untouchable foe) and halve already-rolled weapon damage (floor 1), applied as the LAST modifier in `playerStrike`'s attack loop; the counter ticks down once per `foeTurn` (last in the tail, after ward/mirror/foeEffect), emitting `fearPassed` exactly once at 0; `endCombat` clears it implicitly; `conditionsOf` surfaces `{key:"afraid", polarity:"bad", remaining, phobia}`
- `engine/actions.js`/`engine/engine.js` wire the `fight` action type; `tools/lib/tuning-bot.mjs`'s bot presses Fight! as its first combat move
- `toasts.js`/`eventNarration.js` gained `combatJoined`/`castRefused`/`actionRefused`/`phobiaAfraid`/`fearPassed` entries; every refusal builder's reason map now covers `notFought` (and `useRefused` additionally covers the CMB-02 `cooldown`/`wrongClass`/`combatOnly`/`exploreOnly`/`noTarget` reasons ahead of schedule, since the shared reason vocabulary made it a one-line addition per site); the old `phobiaFrozen`/`shookOffFrozen` entries are gone
- `test/parity/harness/comparables.js#reconcilePendingFight` (compare-only, mirrors `reconcilePendingLoot`) is wired into all three shared comparables and the three parity test files' own local `comparable()` copies; `applyStartCombat` (shared + 2 local copies) now chains a real `fight()` dispatch on the same rng so every scripted `startCombat` fixture action advances exactly as far as the prototype's single call did
- Three phobia-triggering fixtures carry declared, measured `kind:"action-path"` divergence records (`combat/lose` seed 14, `combat/lose-apprentice` seed 127 — new, `magic/cast-damage` seed 8 — upgraded from a Phase 23 field-only record); a new `lose-plain` scenario (seed 1119, no divergence) restores the byte-identical death-path parity coverage the Afraid ruling took from `lose-apprentice`
- New standing test `test/parity/pending-fight-audit.test.js` (the A3 walk) proves no fixture ever chains a non-fight action onto a pending combat, and that the movement/`encounterDot` fixtures never produce a combat
- New `test/unit/fight-gate.test.js` (18 pins) and `test/unit/afraid.test.js` (14 pins) pin the CMB-01 gate and the Afraid mechanic directly at the engine level
- Full suite: **1641/1641 passing (0 fail)**; `test/parity/prototype-master.js.txt` untouched; the `phobiaFrozen`/`shookOffFrozen`/`combat.frozen` vocabulary has zero live occurrences anywhere in `engine/`, `src/browser/`, `tools/lib/`, or the test suite

## Task Commits

Each task was committed atomically:

1. **Task 1: Split startCombat at the Fight! cut line, the Afraid penalty, the bot's Fight!, and the presentation entries** - `8f3f9d8` (feat)
2. **Task 2: Chain fight through the parity harness, declare the three Afraid divergences, restore lose-plain** - `94da381` (feat)
3. **Task 3: Re-pin every CMB-01/Afraid unit test, add fight-gate.test.js + afraid.test.js** - `7a460ae` (test)

## Files Created/Modified

**Engine:**
- `engine/combat.js` — `fight`/`refuseIfPending` exports; `startCombat` cut at the roster; `playerStrike`'s afraid need/damage integration; `foeTurn`'s afraid countdown tail
- `engine/derived.js` — `AFRAID_ROUNDS`/`AFRAID_TO_HIT_PENALTY`/`AFRAID_DMG_DIV`, `afraidNeed`/`afraidDamage`, `conditionsOf`'s afraid chip
- `engine/magic.js`, `engine/items.js` — `refuseIfPending` wired into `castSpell`/`drinkPotion`/`readScroll`/`useItem`
- `engine/actions.js`, `engine/engine.js` — the `fight` action type
- `tools/lib/tuning-bot.mjs` — the bot's Fight! press

**Presentation:**
- `src/browser/toasts.js`, `src/browser/eventNarration.js` — new/renamed event copy, extended refusal reason maps

**Parity harness + fixtures:**
- `test/parity/harness/comparables.js` — `reconcilePendingFight`, `applyStartCombat` chains `fight`
- `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/parity/movement-parity.test.js` — local reconcile/chain wiring
- `test/parity/full-suite.test.js` — the magic sub-test's action-path handling, mirroring the combat sub-test
- `test/parity/fixtures/action-script.combat.json` — `lose`/`lose-apprentice` divergence records, new `lose-plain` scenario, `parley`'s re-measured divergence
- `test/parity/fixtures/action-script.magic.json` — `cast-damage`'s upgraded divergence record
- `test/parity/FIXTURE-INVENTORY.md`, `test/parity/fixture-inventory.test.js` — the new `lose-plain` row
- `test/parity/pending-fight-audit.test.js` (new) — the A3 standing walk

**Unit tests re-pinned:** `test/unit/combat.test.js`, `test/unit/conditions.test.js`, `test/unit/combat-scaling.test.js`, `test/unit/foe-turn-draw-count.test.js`, `test/unit/identity-combat.test.js`, `test/unit/identity-contract.test.js`, `test/unit/parley.test.js`, `test/unit/tuning-bot.test.js`, `test/determinism/foe-abilities.test.js` — every `startCombat`-driven assertion that depended on initiative/phobia/pre-emptive outcomes now chains `fight()` on the same rng; renamed `phobiaFrozen`/`shookOffFrozen` assertions to `phobiaAfraid`/`fearPassed`/`afraid`. Also: `test/unit/toastTable.test.js` (new refusal types), `test/unit/formatEventsCoverage.test.js`/`test/unit/toastsCoverage.test.js` (the `refuseIfPending` derivation fix, see Deviations).

**New:** `test/unit/fight-gate.test.js`, `test/unit/afraid.test.js`

## Decisions Made
See `key-decisions` in frontmatter. The headline one: the Knight/Con Artist/Court Mage foe-removal loop keeps its existing code position in `startCombat` (per the plan's literal "keep encounterStarted/trackable/.../encounterCleared exactly where they are" instruction), which means it now runs BEFORE `fight`'s `rollInitiative` rather than after — a genuine reordering, not just a re-timing, for any character whose sub draws inside that loop. This is the root cause of every deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A stray `/*` substring in a new comment corrupted the coverage-test's comment stripper**
- **Found during:** Task 1, running the required verify command
- **Issue:** A new combat.js comment read `test/parity/fixtures/*.json` — the literal `/*` inside `fixtures/*.json` was mistaken for a block-comment opener by `formatEventsCoverage.test.js`'s naive `/\/\*[\s\S]*?\*\//g` stripper, which then ate real code (including the new `phobiaAfraid`/`combatInDark` pushes) up to the next `*/`, making the coverage-derivation regex blind to those event types.
- **Fix:** Reworded the comment to avoid the `/*` substring (`"the fixture JSON files under test/parity/fixtures"`).
- **Files modified:** `engine/combat.js`
- **Verification:** `grep -c '/\*' engine/combat.js` / `grep -c '\*/' engine/combat.js` imbalance returned to the pre-existing baseline (1, from an unrelated pre-existing `content/*.js` comment); `node --test test/unit/formatEventsCoverage.test.js` green.
- **Committed in:** `8f3f9d8` (Task 1 commit)

**2. [Rule 3 - Blocking] The coverage-derivation regex can't see event types built by a shared factory function**
- **Found during:** Task 1, the same verify run
- **Issue:** `refuseIfPending(state, events, type, extra)` — the plan's own mandated single-guard design — constructs `{ type, ...extra, reason: "notFought" }` from a PARAMETER, never a literal `type: "..."` object key. `formatEventsCoverage.test.js`/`toastsCoverage.test.js` derive their canonical event-type vocabulary by regex-scanning for literal `type: "..."` keys, so `castRefused`/`actionRefused` (brand-new types with no OTHER literal push site) were invisible to it, failing the "EVENT_NARRATION has no entries for event types the engine never emits" guard.
- **Fix:** Both derivation functions now also union in literal type names passed as `refuseIfPending`'s 3rd positional argument (a small added regex pass, mirroring the existing `KNOWN_INDIRECT_TYPES` precedent for factory-constructed types like `died`/`won`).
- **Files modified:** `test/unit/formatEventsCoverage.test.js`, `test/unit/toastsCoverage.test.js`
- **Verification:** Both coverage tests green; the acceptance-criteria grep sweep for the notFought vocabulary still passes.
- **Committed in:** `8f3f9d8` (Task 1 commit)

**3. [Rule 1 - Bug] The Fight! split's rng reordering diverges the pre-existing `parley` parity fixture (seed 303, a Con Artist) — not one of the plan's three declared phobia divergences**
- **Found during:** Task 2, running the required combat-parity verify command
- **Issue:** As documented in Decisions above, the Knight/Con Artist/Court Mage removal loop's own draws now happen BEFORE `fight`'s initiative draws instead of after. Seed 303's Con Artist rolls a level-1-foe escape check (`rng.d(6)`) in that loop — under the new order this lands before the two initiative d20s, changing which values each draw receives, which flips who wins initiative and shifts every downstream draw. The pre-existing Phase 27 `parley` divergence record's declared `after` values (`wp 40, sp 7, gold 50`) were measured under the OLD order and are now stale.
- **Fix:** Re-measured live against the finished engine and updated the record's `after` values (`wp 40→34, sp 7→5`; gold/kills/rations/dead unchanged), extending `phase`/`requirements` to `"27+31"`/`["TUNE-06","CMB-01"]` and the `rationale` with a dated paragraph explaining the cause — the exact same measure-first pattern the plan mandates for the three phobia records, applied to a fourth record the plan's own RESEARCH probe did not anticipate.
- **Files modified:** `test/parity/fixtures/action-script.combat.json`, `test/parity/FIXTURE-INVENTORY.md` (new documentation subsection), `test/unit/foe-turn-draw-count.test.js` (seed 303's FULL_FIGHTS/opener-only rows), `test/unit/identity-contract.test.js` + `test/unit/identity-combat.test.js` (two Court Mage boredom-roll tests and one Con Artist flee-roll test whose fakeRng sequences assumed the old draw order), `test/unit/parley.test.js` (the D-21 seed-303 pin).
- **Verification:** `node --test test/parity/combat-parity.test.js test/parity/full-suite.test.js test/unit/foe-turn-draw-count.test.js test/unit/identity-contract.test.js test/unit/identity-combat.test.js test/unit/parley.test.js` — all green; full `npm test` 1641/1641.
- **Committed in:** `94da381` (Task 2, the fixture/FIXTURE-INVENTORY.md portion), `7a460ae` (Task 3, the unit-test re-pins)

**4. [Rule 1 - Bug] The same reordering diverges a fourth full-fight determinism pin (`test/determinism/foe-abilities.test.js`'s "beasts-t5")**
- **Found during:** Task 3, running `npm test`
- **Issue:** This spec's seed-1 hero (forced Beasts, tier 5) is a Fridgian Knight who fears "Bats and rats" (Beasts) — an Afraid-ruling effect this time, not a reordering one (the Knight's own removal check draws nothing, so no reorder applies here): the old freeze-then-shake-off no longer wastes the fight's first `playerStrike` call, so the fight resolves one attack sooner (64/4/died → 59/3/died). The file's own 12-visit `runVisits` pins (which never call `playerStrike`) are correctly unaffected and needed no change.
- **Fix:** Re-measured live via the file's own `runFullFight` helper and updated the pinned row with a dated rationale comment.
- **Files modified:** `test/determinism/foe-abilities.test.js`
- **Verification:** `node --test test/determinism/foe-abilities.test.js` — 13/13 green.
- **Committed in:** `7a460ae` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1/3 blocking fixes in Task 1, 2 Rule 1 stale-pin re-measurements surfaced by the Fight! split's genuine, plan-mandated reordering)
**Impact on plan:** All four were necessary for the plan's own required verification commands to pass and for the engine's actual, correctly-implemented behavior to be truthfully documented. None weakens an assertion — every changed pin/record was re-measured live against the finished engine, never hand-adjusted, following this codebase's own "pins are measured, not adjusted" convention. No scope creep: the fixes touch only the draw-order consequences the plan's own literal instructions produce, not new engine behavior.

## Issues Encountered

**Seed 303 (`parley`/`combat-scaling`'s Con Artist) and seed 1 (`beasts-t5`'s Fridgian Knight) are the two rng-reordering "surprises" not listed in the plan's own probe** — see Deviations 3-4. Both are legitimate, inevitable consequences of the plan's literal cut-line instructions (keep the removal loop's position, move only `rollInitiative` onward into `fight`), not an implementation choice this executor made. Every other seed the plan predicted (win/flee/heal/potion/scroll, and the three declared phobia divergences) measured exactly as expected.

## User Setup Required
None - no external service configuration required.

## Death-path coverage (Task 2, plan-mandated section)

`lose-plain` (seed 1119, a plain Human Cutthroat with no Beasts phobia — the plan's primary candidate) was accepted on the first attempt: `startCombat(forced: "Beasts")` + 7 scripted `attack` actions compares byte-identical to the frozen prototype after every single action, and the hero dies on the 7th attack on both sides. The fallback seed (1141) was verified as a working alternative during investigation but was not needed. This restores the byte-identical combat death-path parity coverage that Phase 24's `lose-apprentice` (seed 127) provided until this phase's Afraid ruling turned it into a declared divergence.

## Next Phase Readiness
- Plan 02 (the usable-features audit + refusal vocabulary) can build directly on `refuseIfPending`'s established pattern and the `notFought`/`combatOnly`/`exploreOnly`/`noTarget`/`cooldown`/`wrongClass` reason vocabulary this plan already wired into `useRefused`/`castRefused`/`actionRefused` — several of Plan 02's CMB-02 reason additions landed ahead of schedule as a natural consequence of the shared-guard design.
- Plan 03 (shell wiring) needs: `window.mzFight` re-pointed to dispatch the `fight` action (replacing the old `awaitingFight = false` display-flag flip); the AMBUSH pre-death special case re-based/collapsed per RESEARCH §1.3; the tracker chip renders the new `{key:"afraid", remaining, phobia}` shape instead of the old `phobia` chip; the Oracle/toast copy for `combatJoined`/`phobiaAfraid`/`fearPassed`/`castRefused`/`actionRefused` is already written and ready to render.
- No blockers identified for Plan 02 or Plan 03.

## Human verification (deferred to end of run)

Deferred to the end of the autonomous run (copy into SUMMARY.md under "## Human verification (deferred to end of run)"; needs Plan 03's shell):
- Pixel 7: walk into an encounter — the Oracle shows only the encounter line (foe names) and NO "they move first"/strike lines until Fight! is tapped; after the tap the initiative line and any pre-emptive strike appear together.
- Pixel 7, an afraid fight (a hero whose phobia matches the foe type — e.g. "Bats and rats" vs Beasts): after Fight! the Oracle reads "Your phobia has you shaking. Harder to hit and softer blows for 2 rounds…", the tracker shows the "Afraid · 2 rds" chip, and the very first Strike tap SWINGS (a roll-vs-need line such as "4 vs 2 (needs 2: afraid −3). You miss…" or "… You hit … for N hp. Fear pulls the blow.") — never a lost turn, never a "frozen"/"shake it off" line; Spells/Items/Flee/Parley all respond normally while the chip is up; the chip counts 2 → 1 → gone and the Oracle prints "The fear passes." — your to-hit range shrinks by 3 while afraid, then recovers.

---
*Phase: 31-combat-start-gating-effect-hygiene*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 3 new files (test/unit/fight-gate.test.js, test/unit/afraid.test.js, test/parity/pending-fight-audit.test.js) and this SUMMARY.md exist on disk; all 3 task commit hashes (8f3f9d8, 94da381, 7a460ae) found in git history.
