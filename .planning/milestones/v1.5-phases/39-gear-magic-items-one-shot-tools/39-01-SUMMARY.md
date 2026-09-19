---
phase: 39-gear-magic-items-one-shot-tools
plan: 01
subsystem: engine
tags: [content, weapons, armor, combat, movement, economy, expected-value, parity-declared-divergence]

# Dependency graph
requires: []
provides:
  - "content/weapons.js: WEAPONS[*].need (-2|-1|0|1), WEAPONS[*].crit (1|2); 24 keys/cls/order pinned; WEAPON_MAX recomputed"
  - "content/armors.js: ARMORS[*].bulk (0|1|2)"
  - "engine/derived.js: classNeed(c), weaponNeedMod(x), weaponCrit(c), armorBulk(c), expectedStrike(c, base, bonus, prof); toHit(state) floors at 1 after the weapon term"
  - "engine/combat.js: playerStrike's crit range reads weaponCrit(c); Thief heavy-armor/Stealth gates and memberStrike read armorBulk(c) >= 2; flee reads bulk (roll + bonus - bulk >= 11)"
  - "engine/movement.js: armorBulk(state.c) added to the climb and leap roll comparisons"
  - "engine/items.js: weaponUpgradeDelta rebased on expectedStrike (the one 'is this weapon better' rule)"
  - "src/browser/viewModels.js: lootCompare's weapon line reads '+{delta} a swing'"
  - "test/parity/harness/comparables.js: declaredStockDiffs(protoStore, engineStore, record) — the stockNames/stockAfter store-roll pin replacing stockCostMul"
  - "test/unit/gear-axes.test.js: the 30-test axes contract suite (8 content + 22 engine-read behaviours)"
affects: [39-02-bot-buy-policy, 39-03-item-activation-model, 39-04-one-shot-tools, 39-05-shell-gear-surfaces]

tech-stack:
  added: []
  patterns:
    - "expected damage-per-swing (expectedStrike) as the single upgrade-comparison heuristic, replacing raw WEAPON_MAX"
    - "weapon/armor axes (need/crit/bulk) resolved by content-table lookup, defaulting safely (0 or 1) on an unrecognized name from a tampered save"
    - "declaredStockDiffs: a two-part store-roll divergence pin (names on BOTH sides vs. a declared list; engine [n,cost] pairs vs. a declared snapshot) for when content prices themselves diverge from the frozen prototype"

key-files:
  created:
    - test/unit/gear-axes.test.js
  modified:
    - content/weapons.js
    - content/armors.js
    - engine/derived.js
    - engine/combat.js
    - engine/movement.js
    - engine/items.js
    - src/browser/viewModels.js
    - test/parity/harness/comparables.js
    - test/parity/economy-parity.test.js
    - test/parity/fixtures/action-script.economy.json
    - test/parity/fixtures/action-script.schema.md
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/economy.test.js
    - test/unit/store-roll.test.js
    - test/determinism/foe-abilities.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/ability-strike.test.js
    - test/unit/bag-cap-gate.test.js
    - test/unit/content-tables.test.js
    - test/unit/feedback-payload.test.js
    - test/unit/identity-contract.test.js
    - test/unit/lootCompare.test.js
    - test/unit/store-sell.test.js

key-decisions:
  - "The 24 WEAPONS keys, their object-literal order, and every cls string are pinned byte-identical — only dice/lab/cost and the two new axes moved, since openStore/rollBlade both index Object.keys(WEAPONS) by position"
  - "weaponCrit's precise-blade set (Rapier/Katana/Wakazashi/Ninja-to/Dagger) crits on 1-2; the Whip is the one light (need:+1) weapon that stays crit:1 (not a blade)"
  - "expectedStrike deliberately excludes c.might (a temporary Strength potion should not make every other weapon look permanently better) and the Sorcerer 9-damage cap (out of scope for a comparison heuristic)"
  - "The Soldier/Guard foe-side crit lines (roll===1 || (roll<=2 && sub===Soldier), combat.js:841/2374) are the FOE's crit against a Soldier hero — NOT touched; this corrects the CONTEXT.md note that implied the hero's own crit stacks for a Soldier wielding a precise blade (it doesn't — the hero's crit still uses noCrit via c.sub===Soldier, unchanged)"
  - "Bardiche is the sole -2 weapon (Fighter-only); the floor-guarantee test proves no (class, legal weapon) pair can push a base need below 2"
  - "declaredStockDiffs supersedes stockCostMul for the economy fixture: Katana/Broadsword's base prices moved independent of the Pickpocket 1.25x markup, so a flat multiplier off the FROZEN prototype's cost no longer describes the engine's re-priced line — the store ROLL identity (names/order/subs) is still proven byte-identical, but costs are pinned directly"
  - "Four determinism/unit draw-count pin files (foe-abilities.test.js, foe-turn-draw-count.test.js) were re-measured, not the parity fixture corpus itself — seed-1's Fridgian Knight (Awl Pike, d8+2 n:1 -> 2d6+2 n:2) and seed-17's Fridgian Pilfer (Dagger, crit 1 -> 1-2) both legitimately move draws/attacks/outcome; each file's own 'pins are measured, not adjusted, only escalated with rationale' rule was followed"

requirements-completed: [GEAR-01]

coverage:
  - id: D1
    description: "Every WEAPONS row carries need (-2|-1|0|1) and crit (1|2); armor bulk (0|1|2); key order/cls strings pinned; WEAPON_MAX recomputed"
    requirement: "GEAR-01"
    verification:
      - kind: unit
        ref: "test/unit/gear-axes.test.js (Tests 1-8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "toHit floors at 1 after the weapon need modifier; crit range is weapon-driven; Thief Stealth/backstab gates and flee/climb/leap read armorBulk instead of hard-coded armor names"
    requirement: "GEAR-01"
    verification:
      - kind: unit
        ref: "test/unit/gear-axes.test.js (Task 2 section, 14 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/identity-contract.test.js, test/unit/combat.test.js, test/unit/movement.test.js (292 tests, full re-run)"
        status: pass
    human_judgment: false
  - id: D3
    description: "weaponUpgradeDelta/lootCompare read expected damage-per-swing (expectedStrike), not raw max damage; store weapon pools offer a heavy/neutral/light pick per class per tier"
    requirement: "GEAR-01"
    verification:
      - kind: unit
        ref: "test/unit/gear-axes.test.js (Test 5, weaponUpgradeDelta/lootCompare tests); test/unit/lootCompare.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every parity fixture the axes move is declared and regenerated with measured before/after; the frozen prototype master is untouched"
    verification:
      - kind: unit
        ref: "test/parity/economy-parity.test.js; npm test (2585/2585, # fail 0)"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-09-18
status: complete
---

# Phase 39 Plan 01: Weapon Need/Crit Axes, Armor Bulk, Expected-Strike Upgrade Heuristic Summary

**Weapons get a to-hit `need` axis (-2 to +1) and a `crit` axis (1|2), armor gets a `bulk` axis (0|1|2) that taxes agility, and the "is this weapon better" heuristic across takeItem/lootCompare/the tuning bot becomes expected damage-per-swing instead of raw max damage — with one measured, declared parity-fixture divergence (the re-priced store) and two re-pinned determinism suites (Awl Pike's dice count, Dagger's crit range) whose draw/outcome shifts are legitimate consequences of the rebalance.**

## Performance

- **Duration:** ~95 min
- **Tasks:** 3
- **Files modified:** 24 (1 new, 23 modified)

## Accomplishments

- `content/weapons.js`: all 24 rows re-diced/re-priced with `need`/`crit`; the 24 keys' object-literal order and `cls` strings kept byte-identical (load-bearing for `openStore`'s shuffle and `rollBlade`'s pick); `WEAPON_MAX` recomputed from the new dice.
- `content/armors.js`: `bulk` added (Cloth/Leather 0, Studded/Mail 1, Plate 2); every other field unchanged.
- `engine/derived.js`: `classNeed(c)` (factored out of `toHit`'s first four lines), `weaponNeedMod(x)`, `weaponCrit(c)`, `armorBulk(c)`, and `expectedStrike(c, base, bonus, prof)` — the shared expected-damage-per-swing formula, verified against the plan's exact sample pins (Rapier 1.80, Flail 2.125, Short Sword 1.95 for a level-1 Human Fighter).
- `engine/combat.js`: `playerStrike`'s crit line is now `roll <= weaponCrit(c) && !noCrit`; the Thief heavy-armor gate (hero strike, member strike) and the Stealth backstab clause read `armorBulk(c) >= 2` (generalizing a hard-coded armor-name list that never matched a real ARMORS row anyway); `flee`'s `fleeRolled` event carries `bulk`, success is `roll + bonus - bulk >= 11`.
- `engine/movement.js`: `armorBulk(state.c)` added to both the climb and leap `r` comparisons, alongside the existing phobia penalties — zero new rng draws.
- `engine/items.js`: `weaponUpgradeDelta` rebased on `expectedStrike`, rounded to 2 decimals — the ONE "is this weapon better" rule `takeItem`/`lootCompare`/the tuning bot all share now.
- `src/browser/viewModels.js`: `lootCompare`'s weapon-upgrade line reads `+{delta} a swing` instead of `+{delta} damage`.
- `test/unit/gear-axes.test.js` (new): 30 tests — 8 content-table pins (Task 1) + 22 engine-read behaviours (Task 2: classNeed/weaponNeedMod/weaponCrit/armorBulk/toHit/crit-range/Stealth-bulk/flee-bulk/climb-leap-bulk/expectedStrike/weaponUpgradeDelta/lootCompare).
- Parity: the economy fixture (seed 3, Human Pickpocket) is the ONE declared `test/parity/fixtures/*.json` divergence — `declaredStockDiffs` (new harness helper) replaces `stockCostMul`, proving the store roll identity (names/order/subs) is still byte-identical while pinning the engine's own re-priced costs directly. Every other parity fixture scenario re-ran byte-identical with zero new records.
- Two determinism/unit draw-count suites re-pinned with measured, rationale-bearing values: `test/determinism/foe-abilities.test.js` (seed 1's Fridgian Knight wields an Awl Pike, re-diced d8+2→2d6+2, shifting all four seed-1 full-fight totals; `beasts-t5` still resolves "won" as measured) and `test/unit/foe-turn-draw-count.test.js` (seed 17's Fridgian Pilfer wields a Dagger, now crit:2, roughly halving the fight's draws/attacks).

## Task Commits

1. **Task 1: Weapon need/crit axes, armor bulk, re-diced/re-priced tables, contract tests** - `36dcdf7` (feat)
2. **Task 2: Engine reads — toHit need mod, crit range, armor bulk, expected-strike upgrade heuristic** - `b53ba78` (feat)
3. **Task 3: Measure, declare and regenerate the fixtures the axes move; harness stock pin; FIXTURE-INVENTORY; plan gate** - `80f121e` (test)

**Plan metadata:** this commit (SUMMARY only; `commit_docs: false` was not set, STATE.md/ROADMAP.md are the orchestrator's own writes per this run's instructions)

## Files Created/Modified

- `content/weapons.js` — need/crit axes, re-diced/re-priced 24 rows, recomputed WEAPON_MAX
- `content/armors.js` — bulk axis
- `engine/derived.js` — classNeed/weaponNeedMod/weaponCrit/armorBulk/expectedStrike; toHit rewrite
- `engine/combat.js` — crit range, heavy-armor/Stealth gates on armorBulk, flee's bulk term
- `engine/movement.js` — climb/leap armorBulk term
- `engine/items.js` — weaponUpgradeDelta on expectedStrike
- `src/browser/viewModels.js` — lootCompare's "a swing" line copy
- `test/unit/gear-axes.test.js` (new) — the 30-test axes contract suite
- `test/parity/harness/comparables.js` — declaredStockDiffs
- `test/parity/economy-parity.test.js` — the stockAfter branch
- `test/parity/fixtures/action-script.economy.json` — the one declared divergence, re-measured
- `test/parity/fixtures/action-script.schema.md` — stockNames/stockAfter documented
- `test/parity/FIXTURE-INVENTORY.md` — "## Phase 39: gear axes" section
- `test/unit/economy.test.js`, `test/unit/store-roll.test.js` — re-pinned seed-3 stock costs
- `test/determinism/foe-abilities.test.js`, `test/unit/foe-turn-draw-count.test.js` — re-pinned full-fight draw/attack/outcome totals
- `test/unit/ability-strike.test.js`, `test/unit/bag-cap-gate.test.js`, `test/unit/content-tables.test.js`, `test/unit/feedback-payload.test.js`, `test/unit/identity-contract.test.js`, `test/unit/lootCompare.test.js`, `test/unit/store-sell.test.js` — re-pinned fixtures that used a fake hard-coded armor name ("Chain Mail") or a re-priced/re-diced weapon

## Decisions Made

- See frontmatter `key-decisions` — the WEAPONS key-order/cls pin, the Whip's crit:1 exception, expectedStrike's deliberate exclusions (might, Sorcerer cap), the Bardiche -2 floor-guarantee, the Soldier/Guard foe-crit correction, declaredStockDiffs' design, and the determinism-suite re-measurement scope are all recorded there with rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `"Studded Leather"` literal string survived in a code comment, tripping the plan's own grep acceptance criterion**
- **Found during:** Task 2 (acceptance-criteria verification)
- **Issue:** `grep -c '"Studded Leather"' engine/combat.js` printed 1 (a doc comment quoting the retired hard-coded list), not the required 0.
- **Fix:** Reworded the comment to describe the retired strings without quoting them literally (mirrors the Phase 38 precedent for the same class of self-matching-comment bug).
- **Files modified:** engine/combat.js
- **Verification:** `grep -c '"Studded Leather"' engine/combat.js` now prints 0.
- **Committed in:** b53ba78 (Task 2 commit)

**2. [Rule 1 - Bug] Seven unrelated unit tests broke as a direct, correct consequence of the axes change (not scope creep)**
- **Found during:** Task 2 (full `npm test` run after committing)
- **Issue:** `test/unit/bag-cap-gate.test.js`, `test/unit/lootCompare.test.js`, `test/unit/store-sell.test.js` hard-coded old WEAPON_MAX-based delta/price numbers; `test/unit/ability-strike.test.js`, `test/unit/feedback-payload.test.js`, `test/unit/identity-contract.test.js` used a fake `armor: "Chain Mail"` string to trigger the OLD hard-coded heavy-armor list (never a real ARMORS row); `test/unit/content-tables.test.js` pinned Bastard Sword's pre-phase dice.
- **Fix:** Re-pinned each to the new, measured values/behaviour with an inline comment naming the Phase 39 cause (e.g. `armor: "Plate"` now genuinely triggers `armorBulk(c) >= 2`).
- **Files modified:** the seven files above.
- **Verification:** `node --test test/unit/gear-axes.test.js test/unit/items.test.js test/unit/combat.test.js test/unit/movement.test.js test/unit/characterSheetViewModel.test.js test/unit/identity-contract.test.js` — 292/292 pass.
- **Committed in:** b53ba78 (Task 2 commit)

**3. [Rule 1 - Bug] Six determinism/draw-count pins in two files legitimately moved (Awl Pike's dice count, Dagger's crit range)**
- **Found during:** Task 3 (full `npm test` run after committing)
- **Issue:** `test/determinism/foe-abilities.test.js` (four seed-1 full-fight totals — the Fridgian Knight's Awl Pike moved from `d8+2` (n:1) to `2d6+2` (n:2), a genuine dice-count change) and `test/unit/foe-turn-draw-count.test.js` (seed-17's Fridgian Pilfer wields a Dagger, now `crit: 2`, roughly halving that fight's length) both failed their own "pins are measured, not adjusted" assertions.
- **Fix:** Re-measured every value live via each file's own `runFullFight` helper (never hand-computed), and recorded the rationale inline per each file's explicit escalation rule ("an intentional, escalated, rationale-bearing divergence, never a reason to adjust a pin silently").
- **Files modified:** test/determinism/foe-abilities.test.js, test/unit/foe-turn-draw-count.test.js.
- **Verification:** both files green; full `npm test` 2585/2585, `# fail 0`.
- **Committed in:** 80f121e (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — direct, correct consequences of the plan's own specified axes change; no scope creep, no architectural changes)
**Impact on plan:** Every re-pin was measured live against the finished engine, never hand-computed or silently adjusted — each carries an inline rationale comment per its file's own "pins are measured, not adjusted" convention.

## Issues Encountered

None beyond the deviations above. The plan's exact `expectedStrike` sample pins (Rapier 1.80/Flail 2.125/Short Sword 1.95) matched the implementation on the first run, which caught the formula early and made the rest of Task 2's re-pins mechanical rather than exploratory.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device pauses occurred. These items are recorded for the milestone-close aggregated Pixel 7 checklist:

1. Hero tab TO HIT reads 1–6 with a Rapier / 1–4 with a Flail on a Fighter (need+1/need-1 axes visible) — note this number is only routed through the shell's engine bridge in Plan 05, so this check is only meaningful once Plan 05 lands.
2. A Thief in Plate armor is refused the backstab ("Heavy armor negates..." denial); a Thief in Studded armor is not refused.
3. The store's weapon offerings at any depth show a genuine mix of heavy/neutral/light picks (not "highest dice you can afford") — visible once Plan 05 or a later UI pass surfaces need/crit on the store screen.

## Next Phase Readiness

- The gear axes (`need`/`crit`/`bulk`) and `expectedStrike` are live in every engine rule site CONTEXT Area 3 names; Plan 02 (bot buy policy + ledger) can now build directly on `expectedStrike`/`weaponUpgradeDelta` without touching the axes again.
- `docs/GEAR-BALANCE.md` (Plan 02's own deliverable) is not yet created — this plan only lands the mechanical half, per its own scope boundary ("no shell edits in this plan").
- No blockers.

---
*Phase: 39-gear-magic-items-one-shot-tools*
*Completed: 2026-09-18*

## Self-Check: PASSED
