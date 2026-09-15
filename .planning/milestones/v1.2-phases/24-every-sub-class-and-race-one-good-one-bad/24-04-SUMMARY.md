---
phase: 24-every-sub-class-and-race-one-good-one-bad
plan: 04
subsystem: economy
tags: [engine, economy, pricing, parity, fid-07, identity-pass]

# Dependency graph
requires:
  - phase: 24-every-sub-class-and-race-one-good-one-bad
    provides: "actionPathDivergenceOf/skipsByteDiffAt/declaredEndDiffs/PRICEFOR_ROUTED_EFFECTS/stockMarkupDiff (Plan 24-02) — this plan is the SECOND real consumer, declaring the economy fixture's own top-level record"
provides:
  - "priceFor(base, race, sub = null) — a Pickpocket's routed store buys mark up x1.25 after the race multiplier, floor 1; every other sub/omitted-sub call is value-identical"
  - "sellPriceFor(item, race, sub = null) — a Pickpocket's sells pay x0.75 of the ordinary (un-marked-up) sell price, floor 1"
  - "sellItem passes c.sub; every openStore priceFor call site (repair, weapon, armour, both premium branches, rations) passes c.sub"
  - "storeOpened.pickpocket: true only for a Pickpocket hero (additive event field)"
  - "window.__mzSellPrice bridge passes c.sub so the classic sell-button label matches what the engine will pay"
  - "economy fixture (seed 3, a Human Pickpocket) declared action-path divergence record (kind action-path, fromAction 0, stockCostMul 1.25) — the second real consumer of Plan 24-02's harness"
affects: [24-05, 24-06, 24-07]

tech-stack:
  added: []
  patterns:
    - "A race-price hook's signature grows a third, optional, default-null argument (priceFor/sellPriceFor's `sub`) rather than a sibling function or a new field — every existing 2-argument call site stays value-identical, matching the plan's zero-new-serialized-field discipline"
    - "The sell markdown is computed off the ORDINARY (non-marked-up) buy price — sellPriceFor's internal priceFor(...) call deliberately omits `sub` so a x1.25 buy markup and a x0.75 sell markdown never compound"

key-files:
  created: []
  modified:
    - engine/economy.js
    - mazeworld.html
    - test/unit/economy.test.js
    - test/parity/fixtures/action-script.economy.json

key-decisions:
  - "The sell-label bridge (mazeworld.html's __mzSellPrice) reads state once into a local `st` and passes both `st?.c?.race` and `st?.c?.sub` — the plan's instruction to 'read the state once into a local' rather than calling window.__mzState.get() twice."
  - "The plan's own acceptance criterion `grep -c \"__mzSellPrice\" mazeworld.html == 1` is unsatisfiable as literally written and pre-dates this plan: the string already appears on 3 lines before any edit here (the button-render call site at ~L3481, the bridge definition, and a doc comment at ~L5504 that names __mzSellPrice/__mzBags together). Documented as a deviation rather than silently reinterpreted; the substantive criterion (`c?.sub` present, >=1) is satisfied and the file's only functional change is the bridge definition itself."
  - "The economy divergence record's `fields` list is [gold, weapon, items] (not armor) — armor (Studded) and store (null) are identical on both sides at scenario end and are correctly omitted per declaredEndDiffs' own contract (only fields that actually differ)."

requirements-completed: [IDENT-05, FID-07]

coverage:
  - id: D1
    description: "A Pickpocket's store buys cost Math.max(1, Math.round(racePrice * 1.25)) on every priceFor-routed line (weapons, armour, premium, rations, armour repair); flat lines (food/potions/lockpicks/scroll) are unaffected; a non-Pickpocket's prices are value-identical to before this plan"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/economy.test.js — priceFor Pickpocket markup/floor/non-Pickpocket-unchanged tests; seed-3 stock pin (Katana 656/Axe 63/Studded 938/Casket 3750/Rations 38, flat lines unchanged) and the same seed forced to Cutthroat (un-marked-up, same roll)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Pickpocket sells items back at x0.75 of the ordinary sell price (never the marked-up buy price), floor 1; sellItem and the __mzSellPrice label bridge both route c.sub through to sellPriceFor"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/economy.test.js — sellPriceFor Pickpocket case (Cloak of Armor 938 vs 1250 non-Pickpocket); sellItem-on-Pickpocket credits 938 test"
        status: pass
    human_judgment: false
  - id: D3
    description: "storeOpened carries pickpocket: true only for a Pickpocket hero (additive event field, no narration change this phase)"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/economy.test.js — storeOpened.pickpocket true/false test"
        status: pass
    human_judgment: false
  - id: D4
    description: "The economy fixture (seed 3, a Human Pickpocket) carries a live-measured, machine-checked action-path divergence record: the openStore roll (names/order/subs) is proven byte-identical to the frozen prototype while gold/weapon/items diverge because purchases run out of gold two items earlier on the engine side"
    requirement: "FID-07"
    verification:
      - kind: other
        ref: "node --test test/parity/economy-parity.test.js test/parity/full-suite.test.js — 12/12 pass; node --test \"test/parity/**/*.test.js\" — 33/33"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm test ends # fail 0 with the full suite green; no other parity fixture or prototype-master.js.txt touched"
    requirement: "FID-07"
    verification:
      - kind: other
        ref: "npm test — 1096/1096, # fail 0; git diff --stat -- test/parity/prototype-master.js.txt (and every other fixture) empty"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-14
status: complete
---

# Phase 24 Plan 04: Pickpocket Store Markup (IDENT-05, FID-07) Summary

**A Pickpocket now pays shopkeepers who remember their face: every priceFor-routed store line costs x1.25 to buy and pays only x0.75 to sell back (floor 1, zero new rng draws) — landed through the existing priceFor/sellPriceFor hooks — plus the one measured, machine-checked parity divergence this creates on the economy fixture (seed 3, whose hero IS a Pickpocket), which still proves the store's roll is byte-identical to the frozen prototype.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 4 (all modified, no new files)

## Accomplishments

- `engine/economy.js#priceFor(base, race, sub = null)`: computes the race price exactly as before (Troll x3; Elven/Dwarven Math.round(base/2); else base), then, only for `sub === "Pickpocket"`, returns `Math.max(1, Math.round(p * 1.25))`. Every existing 2-argument call (and every non-Pickpocket 3-argument call) is value-identical to before this plan.
- `engine/economy.js#sellPriceFor(item, race, sub = null)`: `buy = priceFor(baseValueFor(item), race)` (deliberately WITHOUT `sub` — the markdown rides the ordinary, un-marked-up sell price), then `Math.max(1, Math.round(buy * SELL_SPREAD * (sub === "Pickpocket" ? 0.75 : 1)))`.
- `sellItem` now calls `sellPriceFor(it, c.race, c.sub)`. `openStore` passes `c.sub` as the third argument at all 6 `priceFor` call sites (repair, both weapon lines, armour, both premium branches, rations); the Troll x2 weapon factor and premium x(2+bonus)/x2 multipliers stay outside `priceFor`, applied after the markup, exactly as before. `storeOpened` gained `pickpocket: c.sub === "Pickpocket"` (additive; Phase 25 owns the toast).
- `mazeworld.html`'s `window.__mzSellPrice` bridge now reads state once into a local and passes both `race` and `sub` to `sellPriceFor`, so the classic sell-button label matches exactly what the engine will pay.
- `test/unit/economy.test.js` (10 new tests): `priceFor`/`sellPriceFor` Pickpocket markup/markdown/floor/non-Pickpocket-unchanged cases; `storeOpened.pickpocket` true/false; the seed-3 stock pin (below); the same seed forced to Cutthroat (proving the store ROLL is unchanged — only routed costs move); a Pickpocket `sellItem` credit.
- **Declared the economy fixture's action-path divergence** (FID-07, second real consumer of Plan 24-02's harness): seed 3 (a Human Pickpocket) now carries a top-level `divergence` record (`kind: "action-path"`, `fromAction: 0`, `stockCostMul: 1.25`) in `test/parity/fixtures/action-script.economy.json`, with live-measured `before`/`after` `c` fields (`gold`, `weapon`, `items`), asserted via `declaredEndDiffs` and `stockMarkupDiff` at both `economy-parity.test.js` and `full-suite.test.js`.

## Measured Data (verbatim, per the plan's output spec)

### Stock at action 0 (prototype -> engine), seed 3

| idx | item | prototype cost | engine cost | effectId (engine) |
|---|---|---|---|---|
| 0 | Chicken (+12 hp) | 20 | 20 | eatRation |
| 1 | Bread (+5 hp) | 15 | 15 | eatRation |
| 2 | Meat (+15 hp) | 25 | 25 | eatRation |
| 3 | Healing potion | 150 | 150 | givePotion |
| 4 | Xtra Healing potion | 500 | 500 | givePotion |
| 5 | Strength potion | 100 | 100 | givePotion |
| 6 | Speed potion | 500 | 500 | givePotion |
| 7 | Set of lockpicks | 450 | 450 | giveLockpicks |
| 8 | Katana | 525 | **656** | buyWeapon |
| 9 | Axe | 50 | **63** | buyWeapon |
| 10 | Studded | 750 | **938** | buyArmor |
| 11 | Casket, a broadsword | 3000 | **3750** | buyPremium |
| 12 (engine-only) | Rations (+1 ration) | — | 38 | buyRations |

Names, order, and subs are identical between sides; only the 5 `PRICEFOR_ROUTED_EFFECTS` lines move, each to `Math.max(1, Math.round(cost x 1.25))` — confirmed by `stockMarkupDiff(ctx.S.store, engineState.store, 1.25)` returning `null` at the `openStore` action.

### Per-action gold trajectory (gold bumped to 5000 identically on both sides right after boot)

| action | prototype gold (event) | engine gold (event) | note |
|---|---|---|---|
| 0 openStore | 5000 | 5000 | store roll identical, costs marked up on engine side |
| 1 buyItem 0 (Chicken) | 4980 (bought) | 4980 (bought) | |
| 2 buyItem 3 (Healing potion) | 4830 (bought) | 4830 (bought) | |
| 3 buyItem 9 (Axe) | 4780 (bought, equips) | 4767 (bought, equips) | first cost divergence (63 vs 50) |
| 4 buyItem 10 (Studded) | 4030 (bought, equips) | 3829 (bought, equips) | |
| 5 buyItem 11 (Casket) | 1030 (bought, then itemRejected — a 2-hand upgrade on an already-good weapon) | 79 (bought, then itemRejected) | both sides buy-then-reject the same way; gold still moves |
| 6 buyItem 7 (Set of lockpicks, 450) | 580 (bought) | 79 (**buyFailed**, short) | **first action-path split** — engine already short of the 450 cost |
| 7 buyItem 8 (Katana, base 525 -> engine 656) | 55 (bought + equipped) | 79 (**buyFailed**, short of 656) | prototype affords/equips the Katana; engine cannot |
| 8 buyItem 6 (Speed potion, 500) | 55 (buyFailed, both already can't afford) | 79 (buyFailed) | no further divergence — both already short |
| 9 leaveStore | store null | store null | identical |

### End pins written into the declared record

- prototype (`before`): `gold: 55, weapon: "Katana", items: [Cloak of Ether, Healing potion, Lockpicks]`
- engine (`after`): `gold: 79, weapon: "Axe", items: [Cloak of Ether, Healing potion]`
- `armor: "Studded"` and `store: null` are identical on both sides and intentionally omitted from `fields` (nothing to check).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pickpocket pricing through priceFor/sellPriceFor + sell-label bridge + unit tests** - `0825878` (feat)
2. **Task 2: Declare and measure the economy fixture (seed 3) action-path divergence; parity green** - `40327bb` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `engine/economy.js` - `priceFor(base, race, sub = null)`, `sellPriceFor(item, race, sub = null)`, `sellItem`'s `c.sub` pass-through, `openStore`'s 6 `priceFor(..., race, c.sub)` call sites, `storeOpened.pickpocket`
- `mazeworld.html` - `window.__mzSellPrice` now reads state once and passes both `race` and `sub` to `sellPriceFor`
- `test/unit/economy.test.js` - 10 new tests (Pickpocket priceFor/sellPriceFor, storeOpened.pickpocket, seed-3 stock pin + Cutthroat-forced comparison, Pickpocket sellItem)
- `test/parity/fixtures/action-script.economy.json` - top-level `divergence` record (kind action-path, fromAction 0, stockCostMul 1.25) + extended `_note`

## Decisions Made

- The sell-label bridge reads `window.__mzState?.get?.()` once into a local `st` rather than calling it twice (once per argument) — smaller diff, matches the plan's "read the state once into a local" instruction.
- `sellPriceFor`'s internal `priceFor(baseValueFor(item), race)` call deliberately omits `sub` (per the plan's explicit prohibition: "the sell markdown is applied to the ordinary sell price, never to the marked-up buy price") — a x1.25 buy markup and a x0.75 sell markdown must never compound into an effective 6% penalty.
- The divergence record's `fields` is `["gold", "weapon", "items"]` — `armor` (Studded on both) and the top-level `store` (null on both) are identical and correctly excluded, per `declaredEndDiffs`' own "only fields that actually differ" contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Literal `grep -c "__mzSellPrice" mazeworld.html == 1` acceptance criterion unsatisfiable, pre-dates this plan**
- **Found during:** Task 1 verification pass
- **Issue:** The plan's acceptance criteria require `grep -c "__mzSellPrice" mazeworld.html` to equal exactly `1`. Before any edit in this plan, the literal string `__mzSellPrice` already appeared on 3 distinct lines: the button-render call site (`~L3481`, `window.__mzSellPrice ? window.__mzSellPrice(it) : null`), the bridge's own definition (`~L5496`), and a doc comment a few lines below it (`~L5504`, "same read-only-helper bridge pattern as `__mzSellPrice`/`__mzBags`"). None of these three pre-existing occurrences are things this plan's scope permits touching (the button call site is unrelated wiring; the comment is documentation), so no edit within this plan's boundaries can bring the count to 1.
- **Fix:** Left the count at 3 (unchanged by this plan's edit — the definition line was already counted before and after) and verified the *substantive* half of the criterion instead: `grep -c "c?.sub" mazeworld.html` >= 1 (satisfied, count 1), confirming the bridge genuinely passes `sub` as its third argument. No behavior change results from this; it is purely a pre-existing acceptance-criterion authoring gap, the same class of issue Plan 24-02 documented for its own literal-grep count criterion.
- **Files modified:** None beyond the planned `mazeworld.html` edit.
- **Verification:** `grep -c "__mzSellPrice" mazeworld.html` = 3 (was 3 before this plan's edit too); `grep -c "c?.sub" mazeworld.html` = 1; `node --test test/unit/economy.test.js test/unit/store-sell.test.js test/unit/item-wiring.test.js` — 51/51.
- **Committed in:** `0825878` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/acceptance-criterion-satisfiability, pre-existing before this plan's edit)
**Impact on plan:** Zero behavior change — the bridge function is exactly what the plan specifies (passes `sub` as a third argument, reads state once). Purely a literal-grep authoring gap in the plan's own acceptance criteria, not a code defect.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 24-05/24-06/24-07 can proceed: the Pickpocket good/bad pair (existing good untouched, new bad landed) closes out one of the 11 sub-class changes IDENT-05 requires, and a second real example of Plan 24-02's action-path divergence harness now exists (combat/lose from 24-03, economy/seed-3 from this plan) for any remaining sub-class/race change that needs the same pattern.
- `docs/CLASS-PASS.md`'s Rulings section can cite this plan's rationale paragraph verbatim for the Pickpocket entry.
- No blockers. `npm test` 1096/1096, parity 33/33 (economy fixture's Pickpocket divergence declared and machine-checked), `test/parity/prototype-master.js.txt` and every other fixture untouched.

---
*Phase: 24-every-sub-class-and-race-one-good-one-bad*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: engine/economy.js
- FOUND: mazeworld.html
- FOUND: test/unit/economy.test.js
- FOUND: test/parity/fixtures/action-script.economy.json
- FOUND: .planning/phases/24-every-sub-class-and-race-one-good-one-bad/24-04-SUMMARY.md
- FOUND commit: 0825878 (Task 1)
- FOUND commit: 40327bb (Task 2)
