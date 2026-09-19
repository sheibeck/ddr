# Rations & upkeep audit (Phase 43 ledger, CLAR-03/05)

**Phase:** 43-clarity-pass
**Date:** 2026-09-18

This ledger audits every ration/upkeep rule the engine enforces against the
frozen prototype (`test/parity/prototype-master.js.txt` — READ-ONLY, hash
`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`) and the original rulebook
(`mazeworld.pdf`). The prototype is canon; the rulebook is secondary and is
recorded only where it adds context the prototype itself never states (it
has no ration count at all — "rations" are the prototype's own
discretisation of its WP-valued food table). `engine/movement.js#eatsFor` /
`#nightlyEats` are THE one definition of appetite: every consumer below
(the fed-night charge, the camp refusal, the `rationsEaten` event and the
`rationsViewModel` the Hero sheet reads) calls through them, so none can
ever disagree.

## Audit method

Two sources, cross-checked:

1. **The prototype** (frozen, never edited) — read directly at the line
   numbers cited in each row below: `upkeep()` (line 1052), the 100-square
   day trigger (line 1256), `newDay()` (lines 1272-1327), `makeCamp()`
   (lines 1329-1338), `RACES` upkeep/eats (lines 279-289), Heft's half-upkeep
   note (line 159), starting rations by class (line 641), the store's silent
   food-ration side effect (lines 1558-1559), `findFood` (lines 1704-1710),
   and Cooking / meat-luck rations (lines 1978-1987).
2. **The rulebook**, via `pdftotext mazeworld.pdf - | grep -n -i -A3 "cost
   of living\|^sleep\|heft\|food table"`: p.9 "Cost of Living — 4wp per
   day … replenished by food, drink or sleep"; p.9 "Sleep — 8 hours; each
   hour less than 8 loses an additional 1WP"; p.11 Dwarves "only lose 1WP a
   day"; p.12 Trolls "cost of living is 15WP per day"; the Thief skill Heft
   halves what its owner loses to cost of living; p.14 "each 100 squares …
   subtract the cost of living"; p.14 a disturbed wandering-monster hour
   forfeits the WP that hour would otherwise have returned; p.48's food
   table (Chicken, Bread, Water, Ale, Meat, …) is the prototype's FOODS
   bank, already ported verbatim.

## Rules (audited)

| # | Rule | Prototype (line) | Rulebook (page) | Engine site | Event / narration | Status |
|---|---|---|---|---|---|---|
| R1 | Hero appetite: 1 a night; Troll 2 | 1278 (`R_().eats \|\| 1`); `content/races.js` (Troll `eats:2`) | no ration count in the rulebook — Trolls' "cost of living is 15WP a day" is the closest rulebook echo (p.12) | `engine/movement.js#eatsFor` | `rationsEaten` | IMPLEMENTED |
| R2 | Each live Joiner eats `eatsFor(m)` too | none — the prototype hero is always solo | n/a | `engine/movement.js#nightlyEats` (party loop) | `rationsEaten.eaters` | DECLARED DIVERGENCE, kept (Phase 11 PARTY-10 / Phase 25.1 DFB-06) |
| R3 | Camp gate need = `nightlyEats(state)` (hero + every live member) | 1332 (hero-only `S.c.rations < (R_().eats \|\| 1)`) | n/a | `engine/movement.js#makeCamp` | `campFailed { need, have, members }` | DECLARED DIVERGENCE, kept (DFB-06) |
| R4 | A day passes every 100 squares, or on Make Camp | 1256 / 1329 | p.14 "each 100 squares … one day" | `engine/movement.js#move` (`crossings(100)`) / `#makeCamp` | `dayBegan` | IMPLEMENTED |
| R5 | Fed night: rations `-= eats`, heal `d10 + 2×level` (×2 for Wilmsry `heal2x` / a Soldier), no hp charge | 1280-1287 — the prototype's own line NARRATES "pay N wp of upkeep from your rations" but never subtracts wp anywhere in the branch | n/a | `engine/movement.js#newDay` (fed branch) | `rationsEaten { eats, left, eaters }`, `rested { amount, doubled }` | IMPLEMENTED — a narration-only "upkeep" cost in BOTH the prototype and the engine; the fed night's real cost is the ration count, never hp |
| R6 | Unfed night: `hp -= upkeep(c)` (+ `Σ upkeep(m)` for a party), `upkeep = max(1, round(R.upkeep × (Heft ? ½ : 1)) + eff("upkeep"))`; `R.upkeep` is 4 for Human/Elven/Wilmsry/Fridgian, 1 for Dwarven, 15 for Troll | 1052 (`upkeep()`); 1316-1318 (unfed branch) | p.9 "4wp per day"; p.11 Dwarves "1WP a day"; p.12 Trolls "15WP per day"; Heft halves cost of living | `engine/derived.js#upkeep`; `engine/movement.js#newDay` (unfed branch, + party loop) | `wentHungry { cost, need, have, mouths, heft }` | IMPLEMENTED — the party-upkeep half of this rule is R2's other side |
| R7 | Starve at hp ≤ 0 | 1319 | n/a (rulebook has no ration/upkeep death rule — starvation-to-death is the prototype's own invention) | `engine/death.js#die("starve")` | `died` | IMPLEMENTED |
| R8 | Starting rations: Fighter 6, Thief 5, Magic User 4 | 641 | n/a | `engine/character.js:542` | n/a (chargen field) | IMPLEMENTED |
| R9 | Ration sources: the store's dedicated Rations line (engine-only, declared 04.1-03 RATION-01 — the prototype's food purchases silently add +1 ration alongside their hp, an inert side effect the engine deliberately made visible and separate); Cooking on Beasts +1 ration; a lucky meat roll (d6 ≥ 4) +1 ration; `findFood`'s ration bump was REMOVED from the engine (declared 04.1-03, food is pure hp now) | 1558-1559 (store food); 1978-1983 (Cooking); 1985-1986 (meat luck); 1704-1710 (`findFood`, engine no longer mirrors this +1) | p.48 (the WP-valued FOODS bank the store/Cooking/findFood all draw from) | `engine/economy.js#STORE_EFFECTS.buyRations`; `engine/combat.js` (`cooked`) | `rationsBought`, `cooked` | IMPLEMENTED (with the one declared 04.1-03 divergence on `findFood`) |
| R10 | The carried bag caps `c.rations` at `BAGS[c.bag].rations` | none — the prototype has no bag-capacity model at all | n/a | `engine/derived.js#clampCarry` / `content/bags.js` | n/a (a silent clamp, not narrated) | DECLARED, engine-only (Phase 12) |
| R11 | Rest-time affliction cure is a d20 roll, not automatic | the prototype cures unconditionally on a fed night | n/a | `engine/movement.js#newDay` (fed branch) | `afflictionCured` / `afflictionLingers` | DECLARED DIVERGENCE (audit-batch1, A3) — orthogonal to the ration math itself, listed here because it shares the same fed-night branch |
| R12 | An `eff(c, "upkeep")` term exists in the upkeep formula, but no content row (race/skill/item) currently provides one | n/a (engine-only formula term) | n/a | `engine/derived.js#upkeep` | n/a | IMPLEMENTED but DORMANT (value 0 for every character today) |

## Rulebook-only rules (not adopted — prototype canon)

- **Sleep-hours penalty** (p.9/p.14): "each hour less than 8 [slept] loses
  an additional 1WP." The prototype's `newDay` has no partial-sleep
  concept at all — a camp always represents a full rest. Not adopted; the
  prototype's binary fed/unfed model is canon.
- **Wandering-monster hour forfeit** (p.14): a disturbed hour forfeits the
  1WP that hour would have returned. The prototype's own wandering-monster
  check (the eight d20 draws in `newDay`) has no such forfeit — it only
  starts a fight. Not adopted.
- **The rulebook's WP-valued food table** (p.48) is not a separate rule to
  adopt — it IS the prototype's `FOODS` bank (Chicken, Bread, Water, Ale,
  Meat, …), already ported verbatim; nothing further to reconcile.

## Missing prototype rules found

None. Every ration/upkeep rule the frozen prototype implements (R1, R4-R9)
has a live engine counterpart; the remaining rows are either engine-only
additions with a recorded rationale (R2/R3/R10) or DECLARED DIVERGENCES
already ratified in an earlier phase (R2/R3/R11). This planning-time
expectation of zero missing prototype rules is confirmed live by
`test/unit/rations-audit.test.js`'s ledger-shape test.

## The rest narration names every rule

- **`rationsEaten`** (example line: "Rations: you eat 1; Grunk (Troll) eats
  2. Trolls eat for two. −3 rations, 4 left.") names R1 (the base
  appetite), R2 (every live member's own appetite) and, via
  `RATION_RULE_LINE`, the doubling rule by name: "Trolls eat for two."
  — never just a number.
- **`wentHungry`** ("Hunger: nobody packed — you eat 1 a night, and you had
  0. Cost of living −4 hp." / "… −2 hp (Heft: half, as promised).") names
  R6 (the unfed cost-of-living charge) and, when it applied, the Heft
  halving by name.
- **`rested`** (unchanged this plan, already verified) names R5's healing
  and, via its `doubled` field, which race/sub-class doubled it.

`src/browser/eventNarration.js#RATION_RULE_LINE = { Troll: "Trolls eat for
two." }` is the one race → rule-sentence map both the Oracle's
`rationsEaten` builder and `src/browser/viewModels.js#RATIONS_COPY.why`
(the Hero-sheet reason clause) read — the same key drives both surfaces, so
they can never say something different about the same race.

## View model

`src/browser/viewModels.js#rationsViewModel(state)` is the ONE ration
readout every screen (Hero RATIONS panel, Joiner offer card, Company panel
— Plan 04) reads: `{ hero: {name, race, eats, why}, members: [...],
total, carried, nights, carriedText, line }`. The invariant this ledger
exists to guarantee: **`total === nightlyEats(state)`**, always — `total`
IS `nightlyEats(state)` itself, never a re-sum, so the Hero sheet, the camp
refusal (`makeCamp`) and the fed-night charge (`newDay`) can never disagree
about how much this party eats tonight.

## Fixture impact

Zero. `rationsEaten` is a new event (parity fixtures compare `state`, never
events — `diffState` of prototype vs. engine); `eatsFor` is a pure,
value-identical refactor of three existing inline reads, not a behavior
change. `wentHungry`'s new keys are additive. No fixture in
`test/parity/fixtures/` moves; the only fixture that reaches a rest at all
is `action-script.movement.json` (seed 256, its 100-square tick).

## Requirements map

- **CLAR-03** (ration math on the Hero sheet matches what Make Camp
  charges): proven by `rationsViewModel(state).total === nightlyEats(state)`
  — the same function the camp refusal and the fed-night charge both call.
- **CLAR-05** (the race/class ration and upkeep rules audited and
  ledgered): this document, plus `test/unit/rations-audit.test.js`'s
  ledger-shape test, which parses this file's own `## Rules (audited)`
  table and asserts every `Engine site` cell names a file that exists.

REQUIREMENTS.md itself is flipped by Plan 04, per the phase's own plan
split.
