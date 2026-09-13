# Research: Economy & Item Balancing milestone

**Domain:** offline Android roguelike; pure deterministic serializable vanilla-JS engine (`engine/*`) driven by a UI shell (`mazeworld.html`).
**Researched:** 2026-09-09
**Confidence:** HIGH (grounded in current code + the rulebook PDF p.9/p.10; every claim carries a file:line or PDF-page cite).
**Sources:** direct read of `engine/{character,items,economy,encounters,derived,saveState,engine,actions}.js`, `content/{potions,foods,treasure-tables,armors,weapons}.js`, `test/parity/harness/comparables.js`, `mazeworld.html`; `pdftotext -f 8 -l 11 mazeworld.pdf`.

---

## 1. Bags / carry capacity — the rulebook p.9 table (CANON)

Extracted verbatim from `mazeworld.pdf` p.9 ("Baggage" + "Bag Table"):

> "you can only hold so much with just your hands; two items to be exact. Everything else must either be worn, or put into your bag. Each character will begin with a certain container based on class. You may never have more than one bag at any one time, and if you lose your bag, you lose whatever is in it."

**Bag Table (p.9) — columns are `Bag · Weapons · Wilmst · Food · Cost`:**

| Bag | Weapons (items) | Wilmst cap | Food cap | Cost |
|-----|-----------------|------------|----------|------|
| Small | 1 | 2000 wm | 10 wp | 1000 |
| Medium | 2 | 5000 wm | 20 wp | 2000 |
| Large | 3 | 8000 wm | 40 wp | 5000 |
| Ex-large\* | 4 | 10,000 wm | 60 wp | 8000 |

\* p.9 footnote: "creatures smaller than a human cannot carry this bag, a human can only carry it for about 100 squares." (A size-gate + a soft carry-time limit — treat as a v1 flavor note, not a mechanic, unless a phase wants it.)

**Starting bag by class (p.10 "Starting Item Table"):** Magic User = **1 Small**, Fighter = **1 Medium**, Thief = **1 Small**. (Same table also states book starting Wilmst 200/1000/500 MU/Ftr/Thief — but see the gold divergence note below.)

### Recommended v1 numbers

The book's raw item column (1/2/3/4) is unusably tight for a solo digital crawl. Per the spec, rescale the **item-slot** axis and keep the other two axes near-book:

| Bag | Item slots (v1) | Wilmst cap (v1) | Rations cap (v1, days) |
|-----|-----------------|-----------------|------------------------|
| Small | **4** | 2000 | 10 |
| Medium | **6** | 5000 | 20 |
| Large | **8** | 8000 | 40 |
| Ex-large | **10** | 10,000 | 60 |

- **Item slots** = the count of entries in `c.items` (the bag). Equipped weapon (`c.weapon`) and worn armor (`c.armor`) are scalar fields, NOT in `c.items` — so they do **not** consume slots (matches the book's "two in hands + worn + bag"). Recommend: equipped gear is slot-free; the bag holds everything else.
- **Wilmst cap** — take the book numbers as-is. These are generous vs book prices (long sword 500, plate 2000) and comfortably above the retuned rewards, so the cap rarely bites but is a real late-game sink pressure.
- **Rations cap** — the book's "Food" column is in *wp of food carried*, but Phase 04.1 already made rations a discrete **day-count** (`c.rations`, upkeep 4 wp/day, `derived.js` `upkeep`). Cleanest v1: reinterpret the book's 10/20/40/60 directly as **ration-day caps** (1:1). Flag it as a balancing knob for the tuning phase.

All three caps are **balancing knobs** — the numbers above are the recommended starting point, not frozen.

### Mapping onto the current `c` shape

Current chargen (`engine/character.js:175-217`) builds `c` with, relevant here:
- `gold: 50` (**flat 50 for every class** — `character.js:187`). NB this already diverges from the book's 200/1000/500 (p.10); the prototype is canon and also gives 50, so this is a pre-existing deliberate divergence. The economy-tuning phase may revisit starting gold — call it out then.
- `rations: Fighter 6 / Thief 5 / MU 4` (`character.js:186`).
- `items: []` (Thief seeds one cloak) (`character.js:190`) — this **is the bag**; every non-equipped carried item already lives here.
- No bag field exists today. **New:** add `c.bag` (a string bag type, e.g. `"small"`), assigned by class at chargen via a plain assignment (no rng) exactly like `darkFor`/`flightLeft` (`character.js:200,213`), with caps derived from a new `BAGS` content table. "Every item takes a slot" = enforce `c.items.length <= BAGS[c.bag].slots`.

---

## 2. Inventory model + engine actions

### Where "auto-take-the-best, drop the rest" lives (to replace)

- **`takeItem(state, it, events)` — `engine/items.js:167-223`** is the auto-optimizer. For a `weapon` it equips **only if strictly better** (`then <= now` → `itemRejected/"notBetter"`, `:180`) and enforces class/`Acrobat`/dagger legality (`:171-178`). For `armor` it equips **only if `it.ar > c.ar`** (`:202` → `"notBetter"`) and enforces `noArmor`/class/`Heft`≤12 (`:192-201`). Staves require Magic User (`:216`). Everything else falls through to `giveItem` (unbounded push).
- **`giveItem(state, it, quiet, events)` — `items.js:54-64`** pushes onto `c.items` with **no capacity check** and applies a flat `eff.wp`.
- **Callers of the auto-take path** (all in `engine/encounters.js`): `openChest` (`:142`), `findGear` (`:313-324`, weapon/magicweapon/magicarmor), `findMisc` (`:343-349`, cloak/staff/jewel), `meetFaerie` (`:377-383`, magic weapon/armor/misc). Store equips via `STORE_EFFECTS.buyWeapon/buyArmor` → `takeItem` (`economy.js:71-75`). Non-gear finds (potions, picks, jewelry via `giveItem`) never had a capacity gate.
- **The class/subclass/race equip restrictions to preserve** live entirely inside `takeItem` (`items.js:171-217`): class letter FTM, `Acrobat`→dagger-only, `Heft`→armor AR≤12 for Thieves, `RACES[c.race].noArmor` (Fridgian), staff→Magic-User. Plus a Pilfer's magic-item limit is referenced in the spec (verify its site during planning; not in `takeItem`).

### Recommended new PURE engine actions (all no-rng)

Mirror the existing `pendingJoiner`/`resolveJoiner` pattern (`encounters.js:398-441`) for the "offer, then player chooses" flow:

| Action | Handler | Behavior |
|--------|---------|----------|
| (find) | replace auto-`takeItem` | On a find, stash the rolled item in a new `state.pendingFind` (top-level, like `pendingJoiner`) and push a `findOffered` event — **do not** auto-add/equip. |
| `takeFind` | new | Accept `pendingFind` into the bag if a slot is free; if the bag is full, keep the item pending and push `bagFull` so the UI can prompt keep/drop. Clears `pendingFind` on success. |
| `leaveFind` | new | Decline `pendingFind` (clear it, push `findLeft`). |
| `dropItem {i}` | new | Remove `c.items[i]` from the bag (frees a slot). Pure splice. |
| `equipItem {i}` | new | Equip a bag weapon/armor onto the character **regardless of whether it is better** (deliberate rules change vs `takeItem`'s strictly-better gate), BUT still run the class/subclass/race legality checks factored out of `takeItem`. The previously-worn item drops back into the bag (needs a free slot / swap). Push `equipRejected` on an illegal equip. |
| `unequipSlot {slot}` | new | Move the equipped weapon or armor back into the bag (needs a slot), leaving the character bare-handed / unarmored. |
| `sellItem {i}` | new (Phase 3) | See §3. |

**Refactor:** extract the legality predicates from `takeItem` (`items.js:171-217`) into pure helpers (`canEquipWeapon(c,it)`, `canEquipArmor(c,it)`) so both the new `equipItem` and the store's buy path reuse one source of truth. `takeItem` itself can stay for the store's "buy = auto-equip" convenience, or be re-pointed at `equipItem`.

### New serialized `c.*` / state fields + save-migration + parity carve-out

New persisted state:
- `c.bag` — string bag type (`"small"|"medium"|"large"|"exlarge"`). Set at chargen (plain assignment, no rng).
- `state.pendingFind` — top-level transient stash (nullable), exactly like `state.pendingJoiner`.
- (Optional) per-item `slot`/weight metadata if a phase wants non-1 item weights; **recommend v1 keeps 1 item = 1 slot** and adds no per-item field.

**Migration** (`engine/saveState.js`): follow the `sanitizeParty` precedent (`saveState.js:76-79`). Additive-with-default — an old save missing `c.bag` gets a default bag (recommend Small, or class-derived) in `validateSave`/`rehydrate`; `pendingFind` defaults to `null` and is nulled on `rehydrate` like `combat`/`store` (`saveState.js:163-186`). Additive defaults do **not** require a `STATE_VERSION` bump (same reasoning as PARTY-02 at `saveState.js:74`).

**Parity carve-out** (`test/parity/harness/comparables.js`): add `stripBagField(c)` mirroring `stripDarkForField`/`stripFlightFields` (`comparables.js:36-57`) — strip `c.bag` in all three comparables (`movement/combat/economyComparable`, `:64,106,200`). Strip top-level `state.pendingFind` at the destructure beside `party`/`pendingJoiner` (`:79,112,206`). These make the new fields invisible to the frozen `prototype-master.js.txt` diff, exactly as `darkFor`/`party` are today.

**The critical determinism rule for capacity enforcement:** the cap CLAMP (bag-full rejection, gold cap, ration cap) must live **only in the NEW action handlers** and behind a `if (c.bag) …` gate, and must **not** be retrofitted into the ported `giveItem`/`takeItem`/`gainWilmst` paths that the frozen parity fixtures replay. The new actions have no prototype equivalent, so they touch no parity fixture; the ported paths stay byte-identical. This is the same containment RATION-01 used (`stripRationsField`, `comparables.js:181-197`) — the divergence is a new engine-only field + new-action behavior, covered by new unit tests, never by the frozen fidelity suite.

---

## 3. Store: sell any carried item

- Store engine is `engine/economy.js`. Stock is plain data `{n, sub, cost, effectId, effectParams, sold}` built by `openStore` (`economy.js:94-173`); purchases run through `STORE_EFFECTS` (`:46-83`) via `buyFrom` (`:182-197`). There is **no sell path today**.
- Store UI is rendered by `renderEncounter()`'s store branch in `mazeworld.html` (buy rows dispatch the existing `buyItem`/`leaveStore` engine actions — see `mazeworld.html:3350-3359` note; the classic in-HTML `openStore`/`buyFrom` at `:3298-3344` is dead code, all real stores come from the engine).

**Recommended approach (don't rebuild the store UI twice):**
1. Add a pure `sellItem(state, i, events)` action to `economy.js` + register `"sellItem"` in `actions.js` `ACTION_TYPES` (`actions.js:10-33`) with an `i` index guard (copy the `useItem.i` guard, `actions.js:72-78`) and a dispatch case in `engine.js` (`engine.js:52-106`). No rng.
2. Add a `sellPriceFor(item, race)` helper deriving a sell value from the item's buy cost with a **buy/sell spread** (recommend sell ≈ 50% of `priceFor`, race-adjusted via the existing `priceFor`, `economy.js:26-30`) — a tuning knob for Phase 5. Weapons/armor derive from `WEAPONS[base].cost`/`ARMORS.find(...).cost`; magic gear from its roll cost; jewelry/cloaks/staves/potions need a base value table (many treasure items have no `cost` today — add one during the item audit, §4).
3. Extend the **existing** store render to add a "Your gear" section that lists `c.items` (reuse the GEAR-tab carried-item render at `mazeworld.html:2852-2875`) with a **Sell** button dispatching `{type:"sellItem", i}`, alongside the existing buy rows. Selling frees a slot and credits `c.gold` (clamped to the bag wilmst cap under the §2 gated-clamp rule).
4. **E2 overlap** (deferred "surface combat-usable items in the combat bar"): the engine `useItem` action already exists and is wired (`items.js:248`, `engine.js:86`), and the GEAR tab already shows a **Use** button (`mazeworld.html:2867-2872`) — but there is no in-combat "use potion/staff" affordance. Build the store-sell list and the combat-bar use-list as **one carried-item list component** rendered in two hosts (store + combat bar) so the gear list is authored once.

---

## 4. Item review / audit — what's inert or doesn't earn its slot

The engine sums item effects via `eff(c,key)` (`derived.js:24-28`); an effect is INERT if its `key` (or the `c.*` field its `use:` handler sets) is **read nowhere**. Verified by grepping `engine/` for each key.

### Confirmed INERT (effect set but never read — same bug class as the old `eff.fly`)

| Item (table:line) | Effect | Why inert | Fix |
|---|---|---|---|
| **Helm of Knowledge** (`treasure-tables.js:19`) | `eff:{tongue:1}` | `tongue` read nowhere | Wire `tongue`→`canParley` (DR15-A): carrying it grants Language. |
| **Gauntlet of the Giant** (`treasure-tables.js:15`) | `eff:{size:1}` | player `size` read nowhere (`combat.js:128` `size:` is the *foe's* size) | Either wire a size/damage benefit or retire; today it's a dead slot. |
| **Amulet of Light** (`treasure-tables.js:16`) | `eff:{sight:1,light:1}` | `sight` IS read (`revealRadius`, `derived.js:154`) but `light` ("dispels darkness") is read nowhere | Wire `light` to clear/`darkFor` (dispel persistent darkness). Reveal-radius half already works. |
| **Pendant of Fortitude** (`treasure-tables.js:17`) | `use:"half"` → sets `c.halfNext` (`items.js:304`) | `halfNext` read nowhere | Wire `halfNext` into the combat damage-taken path (halve one incoming hit). |
| **Cloak of Healing** (`treasure-tables.js:25`) | `eff:{cloakHeal:1}` | `cloakHeal` read nowhere | Wire a per-step heal (mirror how `c.haste`/`invis` tick in `movement.js:253-255`). |
| **Cloak of Regeneration** (`treasure-tables.js:29`) | `eff:{cloakRegen:1}` | `cloakRegen` read nowhere | Wire a per-step d6 regen (same tick site). |
| **Cloak of Strength** (`treasure-tables.js:26`) | `eff:{noCrit:1}` | `combat.js:334` `noCrit` is class-based (`Guard`/`Soldier`/dark) only; never reads `eff(c,"noCrit")` | Add `|| eff(c,"noCrit")` to the `noCrit` computation in `combat.js:334`. |
| **Cloak of Ether** (`treasure-tables.js:32`) | `use:"ether"` → `c.ether=20` (`items.js:300`) | `c.ether` only set + decremented (`movement.js:255`); read nowhere | Wire ethereal wall-passing in `movement.js` climb/gorge block (mirror `isFlying`), or document as intentionally-inert. |
| **Amulet of Stone** (`treasure-tables.js:21`) | `use:"stone"`, `every:200`, "up to **4** squares" | Item now EXISTS (DR16-G resolved), but `case "stone"` petrifies `foes.slice(0,2)` (`items.js:325`) — only 2, not 4 | Make the stone/freeze/gas AoE count a per-item field (`n`), so the Amulet hits 4 and staves/potions keep 2. See DR16-G "1 square = 1 foe" simplification. |

### Already WIRED (for completeness — do NOT re-wire)

Ring of Power `dmg` (`derived.js:219`), Anklet of Invisibility `foeToHit` (`derived.js:198`), Bracelet of Flight / Cloak of Flying `fly` (`derived.js:66-71`), Cloak of Armor `cloakArmor` (`derived.js:94-105`), Amulet of Light `sight` (`derived.js:154`), Cloak of Speed/Invisibility `haste`/`invis` and all staves (`useItem` switch, `items.js:260-351`).

### Potions (`content/potions.js`) — engine status vs the DR15-D report

DR15-D flagged Acuteness and Invisible potions as inert — that finding described the **prototype HTML**; the **engine port already wires both**: `strikeDie` reads `c.acute` (`derived.js:118`) and `foeToHitVs` reads `c.invis` (`derived.js:201`). So in the engine, Speed/Strength/Enlarge/Acuteness/Invisible/Death/Heal/Cure all function. Remaining gaps:
- **`ether`** effect stays inert (see table above).
- **Strength/Enlarge duration**: `c.might` resets only at `newDay` (`movement.js:320`), not the "25/50 squares" the flavor text claims — decide honor-the-count vs update-the-text (dual-purpose string caution).
- **The real gap is the USE affordance in combat** (E2), not the effects — see §3.

**Value/cost audit gaps to close during the audit:** treasure items (jewelry, cloaks, staves) carry no `cost`/base value, which blocks §3 sell pricing and §5 tuning — add a base-value field per treasure item as part of this pass.

---

## 5. Economy tuning + DETERMINISM / PARITY

### The loop to tune (find → carry → sell → buy)

- **Item costs:** `WEAPONS[*].cost` (`weapons.js`), `ARMORS[*].cost` (`armors.js`), `POTIONS[*].price` (`potions.js`), `FOODS[*].cost` (`foods.js`), lockpicks 450 (`economy.js:107`), scroll 900 (`economy.js:139`), premium enchant multiplier (`economy.js:143-147`).
- **Spreads:** `priceFor` race multiplier (`economy.js:26-30`); new sell spread (§3); Wilmsry haggle 0.7 (`economy.js:159`).
- **Rations/repair:** `RATIONS_BASE_PRICE = 30` (`economy.js:38`); armor repair = `priceFor(base)/10 * pts` (`economy.js:113`).
- **Wilmst rewards (the over-generous grants to cut):**
  - **`+3000 wilmst` Table-Four row — `encounters.js:254-259`.** Far too much for one red-dot pull. Retune to a depth-scaled amount an order of magnitude lower (e.g. `~300 * depth`). **DETERMINISM-CRITICAL:** this row currently draws **zero rng** (`gainWilmst` only rolls for Pickpocket, `items.js:81-85`). Use a **flat depth-scaled formula with NO new rng draw** — do NOT add a `d10` here; a new draw would shift the entire downstream stream and break `same-seed-same-result` + parity. If a random spread is wanted, it must be gated so the draw count is unchanged (hard here — prefer flat).
  - `openChest` gold `(d10+6)*100*depth/10` (`encounters.js:137`).
  - `meetFaerie` `d10×100` (`encounters.js:384`).
  - `findGrimoire` non-MU sale `+150` (`encounters.js:297`).
  - `LOOT_DIVISOR = 10` (`items.js:71`) — the global "found coin ÷10" lever.
- A **headless tuning harness** (like Phase 3's difficulty harness) is warranted: simulate N seeded runs, report gold-earned / gold-spent / time-to-afford curves. Keep it out of `engine/` (a test/tool script driving `applyAction`).

### The determinism contract for this milestone

1. **Never edit `test/parity/prototype-master.js.txt`** (frozen golden master).
2. **RNG draw order/count must stay byte-identical** for empty/solo play. Every new draw (if any) must be gated behind its qualifying situation (mirror the chargen-parity guarantees documented at `character.js:16-17,140-217`). Prefer NO new draws for reward retunes (use flat/derived formulas).
3. **New serialized fields** (`c.bag`, `state.pendingFind`) get comparables carve-outs (§2) — mirror `stripDarkForField`/`stripFlightFields`/`party`/`pendingJoiner`.
4. **Reward-AMOUNT retunes** (e.g. +3000→depth-scaled) change values the frozen fidelity suite compares. Since these are **deliberate rules changes** and add **no draw**, `same-seed-same-result` stays green; the prototype-fidelity divergence is handled the RATION-01 way — document as a deliberate change and **regenerate/adjust the specific economy-parity fixtures** that touch the retuned rows (or add a targeted carve-out), never by weakening the whole gold comparison.
5. **Capacity clamps** (gold cap, ration cap, bag-full) live only in new gated action handlers, never in the ported paths (§2).

### Boundary: economy-LOCAL vs GLOBAL foe-difficulty (coordination, §6)

**In scope (economy-local):** item costs, buy/sell spreads, rations price, repair, and the wilmst-reward retunes above (`+3000`, chest/faerie/grimoire grants, `LOOT_DIVISOR`).
**OUT of scope (deferred):** the GLOBAL `engine/difficulty.js` foe-scaling retune — deferred to a single consolidated pass across Joiners + Economy + Monster (Joiners Phase 11 already deferred it). Do **not** touch foe HP/damage/`difficulty.js` scaling here. If a reward feels off because foes are too easy/hard, log it for the consolidated difficulty pass — keep the two separate.

---

## 6. Recommended phase breakdown (dependency-ordered, each with a determinism gate)

**Phase A — Carry model + migration (foundation).**
Add `BAGS` content table + `c.bag` chargen assignment (class-derived, no rng); `state.pendingFind` field; the gated `clampCarry(c)` helper (no-op when `!c.bag`); save defaults in `validateSave`/`rehydrate`; comparables `stripBagField` + `pendingFind` strip.
*Determinism gate:* chargen-parity green with `c.bag` stripped; movement/combat/economy parity green (clamp is a no-op on all frozen fixtures); new unit tests cover bag caps.

**Phase B — Inventory actions + UI (replaces auto-take-best).**
New pure actions `takeFind`/`leaveFind`/`dropItem`/`equipItem`/`unequipSlot`; extract `canEquipWeapon/Armor` from `takeItem`; re-point find callers (`openChest`/`findGear`/`findMisc`/`meetFaerie`) to stash `pendingFind` instead of auto-`takeItem`; GEAR-tab keep/drop/equip UI. Log the auto-optimize→player-choice change as a deliberate rules change.
*Determinism gate:* new actions add no rng and touch no frozen fixture; equip-restriction unit tests; parity suite green (ported find paths that fixtures still drive must remain callable, or fixtures migrated to the new actions with documented rationale). **Depends on A.**

**Phase C — Store sells all gear.**
`sellItem` action + `sellPriceFor` spread; add base-value to treasure items (feeds §4); extend the store render with a "Your gear" sell section; unify the carried-item list component with the combat-bar use-list (E2).
*Determinism gate:* sell is pure/no-rng, no parity impact; unit tests for sell pricing + wilmst-cap clamp. **Depends on A, B.**

**Phase D — Item audit + inert-effect wiring.**
Wire the §4 inert set (Helm/tongue, Cloak of Healing/Regeneration/Strength, Pendant halfNext, Amulet of Light light, ether-or-retire), fix Amulet-of-Stone `slice(0,4)` via a per-item AoE count, and retire/fix items that don't earn a slot; add treasure base values.
*Determinism gate:* each new read is a pure state read (mirror `isFlying`/`armorSoak`, `derived.js:66-105`); any new combat draw fires only in the qualifying non-chargen combat path, gated; parity + same-seed-same-result green. **Independent of B/C but pairs naturally with C's base-value work.**

**Phase E — Economy-local tuning (numbers).**
Build the headless tuning harness; retune item costs, spreads, rations price, repair, and the wilmst rewards (`+3000`→depth-scaled flat/no-draw, chest/faerie/grimoire, `LOOT_DIVISOR`); set final bag caps.
*Determinism gate:* no new rng draws (flat/derived formulas only); `same-seed-same-result` green; regenerate only the specific economy-parity fixtures whose reward amounts changed (documented deliberate divergences); GLOBAL `difficulty.js` foe-scaling explicitly untouched. **Depends on A-D (final numbers tune the whole loop).**

### Open questions for the requirements author
- **Rations cap unit**: reinterpret book "Food (wp)" as ration-days 1:1 (recommended) vs a scaled-down curve? (Phase A/E knob.)
- **Starting gold**: keep the ported flat 50, or move toward the book's 200/1000/500 during Phase E? (Pre-existing divergence.)
- **Ex-large bag** size-gate / 100-square carry limit (p.9 footnote): model or treat as flavor? (Recommend flavor for v1.)
- **Equip-swap when bag is full**: does `equipItem` require a free slot for the displaced item, or allow a direct swap? (Recommend direct swap — no net slot change.)
- **`ether` / Gauntlet of the Giant**: wire a real effect or formally retire? (Phase D design call.)
