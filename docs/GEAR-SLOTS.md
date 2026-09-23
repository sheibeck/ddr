# Equipment Slot Model (Phase 37, GEAR-03 / GEAR-04)

**Phase:** 37-equipment-slot-model-eff-refactor
**Date:** 2026-09-17

> **Status (v1.6, Phase 48):** design record of Phase 37; the worn-slot model is live and unconditional since Phase 45 (the `wornSlots` run option and the reconciliation hedges are gone — old saves fold on load).

This ledger declares Phase 37's one deliberate canon change, the worn-slot
taxonomy, the model, the play rules that follow from it, the old-save
reconciliation mechanics, the full `eff()` call-site inventory, and what is
deliberately deferred to later phases.

## §1. Declared canon change

The 1994 rulebook and the prototype's classic `eff(key)` (`mazeworld.html`,
pre-Phase-37) summed `it.eff[key]` over **every** carried cloak, ring,
bracelet, amulet, helm and staff unconditionally — a character wearing two
Rings of Power got `+2 damage`, not `+1`, and there was no concept of
"worn" at all: an item's effect applied the instant it was carried, bag
slot or not.

From v1.5, a character wears **one item per slot type** (`ring`,
`bracelet`, `amulet`, `helm`, `cloak`, `staff`). Equipping a second item of
an already-occupied slot type is an explicit **swap** — the previously-worn
piece drops back into the bag — never silent stacking. Activatable
cloaks/jewelry/staves (potions and staves with a `use`) must be **worn** to
work; the same item in the bag does nothing (`useRefused { reason:
"notWorn" }`).

> **260918-wy1 update (2026-09-19):** the six-slot-type sentence above is
> superseded. The current model (after both the staff amendment (260918-w4n)
> and the jewelry merge (260918-wy1)) is **three worn KEYS** —
> `jewelry1`/`jewelry2`/`cloak` — see the dated §8 section below for the
> full ruling and model.

**Rationale:** the prototype's carried-copy summation is a latent stacking
bug, not a deliberate design choice — nothing in the rulebook or the
prototype's own flavor text describes wearing two rings on one finger as
intentional. The v1.5 milestone's magic-item rework (Phase 39, use →
effect → cooldown chips) and the Gear ON YOU / BAG split (Phase 43) both
need a real "what is currently worn" set to build on; retrofitting one
after those phases land would be far more invasive than landing it first,
alone, fully regression-tested.

**Fixture impact (revised Phase 45):** the legacy sum-all-carried path
(`eff()`'s `for (const it of (S.c.items || [])) if (it.eff && it.eff[key])
t += it.eff[key];` loop) is preserved byte-for-byte for every state
without `c.worn` — proved by the pinned legacy-equivalence table over all
14 chargen fixture seeds (`test/unit/worn-model.test.js`, Plan 01) and the
untouched parity suite (`prototype-master.js.txt` hash unchanged across all
plans, including Phase 45). Since Phase 45 (HEDGE-01/03), every
fixture/bot/tools/test caller of `newRun(seed)` DOES create `c.worn`
(`reconcileWorn` runs unconditionally) — the measured moved set is exactly
13 of 31 parity replay sites (every Thief-hero replay site: chargen seeds
2/3/4, the movement script, combat's `win`/`lose-plain`/`flee`/`parley`,
the economy script, and encounters' `chest`/`tablefour`/`faerie`/
`affliction`), each declared with a before/after `items`/`worn` divergence
record — see `test/parity/FIXTURE-INVENTORY.md`, Phase 45. Every other
fixture (every Fighter/Magic User site) is byte-identical.

**Assumption-delta record (Plan 01):** the detector fired on pluralization
("a second ring/cloak/staff/bracelet"). Noun = "worn slot" (`c.worn[slot]`
— the ONE item the character benefits from per slot). Decision = **PROMOTE**:
`c.worn` becomes the primary representation of what confers effects; the
old "sum of every carried copy" is demoted to the legacy variant. No legacy
variant survives; since Phase 45 every state carries `c.worn` (see the
"Fixture impact" revision above). Adding a worn flag alongside the bag
(rather than promoting a real worn
map) was rejected — it would have kept the bag as the primary
representation and left stacking latent for the new UI to expose, not fix.

## §2. Slot taxonomy

Every JEWELRY, CLOAKS and STAVES row (`content/treasure-tables.js`) is
authored with a `slot` field on its module-private `*_ROWS` array (never
spread onto the exported row or any rolled item — see §3). 24 rows total.

> **260918-wy1 update (2026-09-19):** the table below is superseded for the
> 8 JEWELRY rows — every one now authors `slot: "jewelry"` (a FAMILY, not a
> concrete key). The table intro is now **15 rows** whose `Slot` column
> values are only `jewelry`/`cloak` (staves carry none — see the 260918-w4n
> note above). See §8 for the full model.

| Item | Kind | Slot |
|---|---|---|
| Ring of Power | jewel | ring |
| Gauntlet of the Giant | jewel | helm |
| Amulet of Light | jewel | amulet |
| Pendant of Fortitude | jewel | amulet |
| Anklet of Invisibility | jewel | bracelet |
| Helm of Knowledge | jewel | helm |
| Bracelet of Flight | jewel | bracelet |
| Amulet of Stone | jewel | amulet |
| Cloak of Strength | cloak | cloak |
| Cloak of Invisibility | cloak | cloak |
| Cloak of Speed | cloak | cloak |
| Cloak of Regeneration | cloak | cloak |
| Cloak of Armor | cloak | cloak |
| Cloak of Flying | cloak | cloak |
| Cloak of Ether | cloak | cloak |
| Rowan Staff | staff | staff |
| Birch Staff | staff | staff |
| Walnut Staff | staff | staff |
| Oak Staff | staff | staff |
| Crystal Staff | staff | staff |
| Poplar Staff | staff | staff |
| Pine Staff | staff | staff |
| Cedar Staff | staff | staff |

`content/treasure-tables.js` exports `SLOT_OF` (frozen, name → slot, 24
entries in the original taxonomy) as the runtime lookup — `engine/
derived.js#slotFor(it)` consults `it.slot` first, then `SLOT_OF[it.n]`, then
a `kind` fallback for a name not in the table, else `null`.

> **260918-wy1 update (2026-09-19):** `SLOT_OF` is now 15 entries (8
> JEWELRY + 7 CLOAKS, per the 260918-w4n staff amendment below) whose
> values are only the FAMILY strings `jewelry`/`cloak` — `slotFor(it)`
> returns the family, with kind fallbacks `jewel` -> `jewelry` and `cloak`
> -> `cloak` (the jewel fallback is new: it mirrors the pre-existing cloak
> fallback so a jewel rolled under an unknown name still has a home). See
> §8 for the family/key split.

> **260918-w4n update (2026-09-18):** the taxonomy above is now **five
> slots**, not six. The user dropped the Cloak of Healing from the game
> outright ("Drop Cloak of Healing") — its row is deleted from the table
> above, and CLOAKS is 7 rows, not 8. The user also ruled that a staff is
> "a usable item, but not equipable... Staff should not be an equipment
> slot" — `staff` is removed from `WORN_SLOTS` and `SLOT_OF` entirely (24 →
> 15 entries: 8 JEWELRY + 7 CLOAKS); a staff now lives in `c.items` (one bag
> slot) and is used by bag index, Magic User only. A legacy save's
> `c.worn.staff` folds back into the bag on load (`engine/saveState.js#
> sanitizeWorn`) — never re-injected on a save that never had a `worn` key.
> See `.planning/quick/260918-w4n-magic-items-are-use-activated-only-no-pa/`
> for the full ruling and conversion table.

**The slot is never spread onto a rolled item object.** `slot` lives only
on the private `*_ROWS` arrays — the exported `JEWELRY`/`CLOAKS`/`STAVES`
tables are the same rows with `slot` stripped (`dropSlot`), byte-identical
to the pre-Phase-37 literals. This mirrors the ECON-08 precedent
(`engine/economy.js` `TREASURE_BASE_VALUES`, lines 55-60): keep new
per-item data OUT of the row objects so every `Object.assign({ kind },
ROW)` construction site (`rollJewel`/`rollCloak`/`rollStaff`,
`engine/character.js`'s Thief starting cloak, `engine/encounters.js`'s
three find offers) keeps producing byte-identical item shapes. A `slot`
key on a rolled item would break the frozen parity gate three ways:
chargen seeds 2/3/4 (Thief starting cloaks, `test/parity/chargen-parity
.test.js` `deepStrictEqual` on `c.items`), the combat flee fixture (seed
17's Cloak of Armor in the bag), and `test/parity/fixtures/action-script
.economy.json`'s DECLARED `after.items` Cloak of Ether object (a frozen
fixture that must never be edited).

## §3. The model

> **260918-wy1 update (2026-09-19):** the `Storage` bullet immediately below
> describes the ORIGINAL six-key Phase 37 shape. The current shape (after
> the staff amendment and the jewelry merge) is `c.worn = { jewelry1?,
> jewelry2?, cloak? }` — see §8.

- **Storage:** `c.worn = { ring?, bracelet?, amulet?, helm?, cloak?, staff?
  }` — a slot-key → item map, created by `newRun` for every character
  (`{}` when no slot item was issued) and by the unconditional load
  reconcile (Phase 45); never absent on an engine-produced state. A worn
  item is **not a bag member**: it
  moves out of `c.items` into `c.worn[slot]`, exactly as an equipped
  weapon/armor is not a bag member — `slotItems(c)` (the bag-cap count),
  `renderCarriedList`'s sell/loot-compare/drop-shelf hosts and the store's
  sell list never see it.
- **`carriedItems(c)`** (`engine/derived.js`) is the bag ∪ worn lookup —
  `c.items` plus the populated values of `c.worn` — used by every
  name/kind scan that can involve a cloak/jewelry/staff: `hasItemNamed`
  (→ `isFlying`'s Bracelet/Cloak-of-Flying checks, `conditionsOf`'s
  item-backed chips), `engine/movement.js`'s climb block. `hasPicks`
  (lockpicks are not slot items) and `slotItems` (worn items must stay OUT
  of the bag count by design) are deliberately NOT routed through it.
- **`eff(c, key)` — the two-path rule:** if `c` carries an own `worn` key
  (`"worn" in c`), sum `it.eff[key]` over the populated `c.worn` entries
  only (weapon/armor carry no `eff`, so they never contribute); otherwise,
  sum over `c.items` exactly as the pre-Phase-37 loop did — byte-for-byte,
  no added guards. The presence of `c.worn` is itself the legacy/new-model
  switch; no `state.dev`-style flag was needed.
- **Cooldowns ride the item:** `usedAt`/`every` (an activatable's cooldown
  state) are fields on the item object itself, so they move with it
  whether it is worn or bagged — no separate cooldown ledger was needed.

## §4. Play rules

- **Auto-wear on take:** `autoWearSlot(state, it)` / `wearItem(state, it,
  slot, events)` (`engine/items.js`) wire into all four take sites
  (`takeItem`/`takeFind`/`takeLoot` non-equip form/`takeAllLoot`) — a
  cloak/jewelry/staff item is worn immediately when its slot is empty
  (narrated through the existing `itemEquipped` event, no extra tap); an
  occupied slot leaves it in the bag exactly as today, for a manual swap
  later.
- **`equipItem`'s direct swap:** the same function that already swaps a
  weapon/armor grows a `cloak`/`jewel`/`staff` branch performing the exact
  same pattern: `const worn = c.worn[slot] || null; c.worn[slot] = it; if
  (worn) c.items[i] = worn; else c.items.splice(i, 1);`, pushing
  `itemEquipped { item, slot, replaced? }` — `replaced` is additive, built
  only on a genuine swap (Phase 25 precedent; a no-swap event carries no
  `replaced` key at all, never `replaced: null`). A staff equipped by a
  non-Magic-User is refused `equipRejected { reason: "wrongClass" }` before
  any mutation.
- **`unequipSlot`** extends to the six worn slots through the same
  `stowItem` bag-cap gate every weapon/armor unequip already uses — a full
  bag refuses with `bagFull` and changes nothing; an empty slot is a
  silent no-op.
- **Staff class gate:** a staff (worn or bagged) remains Magic User only —
  `equipRejected { reason: "wrongClass" }` on equip, and `reconcileWorn`
  (§5) never wears a staff onto a non-caster during migration.
- **Combat gear lock (Phase 61, GRULE-01):** `equipItem`, `unequipSlot`,
  `takeFind`, `takeLoot` and `takeAllLoot` all refuse while `state.combat`
  is set — the pending Fight! preview (`combat.pending`) INCLUDED, not
  just a joined fight. Each refusal is exactly one `gearRefused { verb,
  reason: "combat", item?, slot? }` event and zero rng draws; the state is
  otherwise untouched. `gearLockReason(state)` (`engine/items.js`) is the
  read-only predicate — it returns `"combat"` mid-fight, `null` otherwise —
  that any UI (Phase 63's action sheet included) reads to grey the
  EQUIP/SWAP/UNEQUIP rows with the engine's own reason. USE (staffs, torch,
  jewelry/cloak activatables), potions, scrolls, spells (the Shield
  included) and Drop all stay live mid-fight — none of them changes what
  you fight with, so none of them is ever refused with `gearRefused`.
  `wearItem` stays an UNGATED internal primitive — every real caller is
  either combat-gated above it or store-only.
- **Refusal vocabulary** (§1 of `docs/USABLE-FEATURES-AUDIT.md` carries the
  full table; the new rows this phase adds):

  | Reason | Carried by | Meaning |
  |---|---|---|
  | `notWorn` | `useRefused` | a cloak/jewelry/staff activatable used from the BAG while the character is on the worn-slot model — activatables must be worn to work; legacy states (no `c.worn`) keep bag-use |
  | `combat` | `gearRefused` | a gear change attempted while a fight is up (Phase 61, GRULE-01) |

## §5. Old-save reconciliation (GEAR-04)

> **Phase 45 update (2026-09-19):** the bullets below describe the
> ORIGINAL Phase 37 option-gated design. Since Phase 45 (HEDGE-01/02)
> there is one path: `newRun(seed)` always creates `c.worn` (the Thief's
> starting cloak worn, zero rng draws) and `validateSave`/`rehydrate`
> always reconcile — `validateSave` returns `{ ok, value, wornReport }`
> with `wornReport: []` when nothing moved. The parity fixtures this
> moved are declared per site — see `test/parity/FIXTURE-INVENTORY.md`,
> Phase 45.

- **Migration runs on every load (unconditional since Phase 45)** —
  `engine/saveState.js`'s `validateSave(raw, { freshSeed })` /
  `rehydrate(obj)`, homed beside `migrateCarry`/`clearFoeEffect`/
  `clearStaleTimers`, both call the same `reconcileWorn(c)`
  (`engine/derived.js`, Plan 01). For any save whose `c` lacks `worn`:
  create `c.worn`, and for each slot wear the **first item of that slot
  type in bag order**; every later copy of the same slot type **stays in
  the bag**. Moving bag → worn only ever frees bag slots, so migration can
  never overflow the bag cap. A save that already carries `c.worn` (even
  an empty `{}`) is **never re-migrated**.
- **Fresh runs:** `newRun(seed)` — every caller (shell, bot, tools, tests,
  fixtures) — creates `c.worn` and wears the Thief's starting cloak, zero
  rng draws (Phase 45).
- **`sanitizeWorn(c)`** (`engine/saveState.js`) runs on BOTH load chains,
  unconditionally, and neutralises a present-but-tampered `c.worn`
  (`"999"`, `[]`, `null`, a bare number → `{}`; a non-object entry inside a
  genuine map is dropped) — it never injects a missing key. Both
  unconditional (Phase 45); the two never overlap in what they touch.
- **The report is a RETURN VALUE, never a serialized field:**
  `reconcileWorn(c)` returns `[{ slot, worn, bagged }]` (one entry per
  populated slot, in `WORN_SLOTS` order — `worn` the display name now
  worn, `bagged` the display names of every later same-slot copy left in
  the bag) or `[]` when nothing was wearable. `validateSave`'s result
  always carries this as `wornReport` (`[]` when nothing moved, including
  an already-migrated save); `boot()` stashes it; `takeBootWornReport()`
  returns it once.
- **Narration:** the shell surfaces the report **once, only when at least
  one extra was bagged**, as a GEAR-family rail card plus the same line in
  the Oracle log — never a toast (`src/browser/rail.js`'s
  `wornReconcileCard(report)`, called by `mazeworld.html`'s
  `surfaceWornReconcile()` on the ENTER-to-resume branch, Plan 04). Locked
  copy register:

  > You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now.

  (the `{count}`/`{what}`/`{bagged}`/`{verb}` template spells out counts up
  to six and falls back to the plain digit at seven or more).
- **The option gate — collapsed (Phase 45):** the six round-trip contracts
  this codebase treated as non-negotiable when the migration was gated
  (`save-validation.test.js`'s seed 1/42/12345 `deepStrictEqual`,
  `party-model.test.js`, `effects.test.js`'s "never injected" rehydrate
  proof, `engineAdapter.test.js`'s boot contract,
  `dual-write-convergence.test.js`, the Phase 36 "never injects the key on
  load" discipline) were all re-pinned to the single, unconditional path
  in 45-02 — every one of them now expects `c.worn`/`wornReport` present.
  The option is gone; `validateSave`/`rehydrate` take no worn-related
  argument.
- **Bot / balance:** `RUN_FLAGS = { storeRoll: true }` since Phase 45 — the
  worn-slot model needs no flag since `newRun` always creates it. The
  v1.5 AFTER readouts (`docs/class-pass/*.json`) recorded the two-flag era
  in `meta.runFlags` and are frozen history (not regenerated). The
  "wear/swap policy" this note asked for is the engine's own
  `autoWearSlot` on take, unchanged by this phase — the bot wears the
  first item per slot on pickup and never swaps a worn item for a better
  one mid-run; that IS the recorded policy, not a gap. See
  `docs/CLASS-PASS.md` `### Phase 42 tactics (BAL-01 second half)`.

## §6. The `eff()` call-site inventory

Every executable `eff(` read in the repo (measured 2026-09-17; comments
excluded). Plan 01's refactor changes NONE of these call sites — each
keeps its exact expression and, for every state without `c.worn`, its
exact value:

- `engine/derived.js:284` `eff(c, "cloakArmor")` (effectiveArmor / Cloak of
  Armor soak); `:342` `eff(state.c, "sight")` (revealRadius); `:359`
  `eff(c, "toHit")` (toHit); `:438` `eff(c, "foeToHit")` (foeToHitVs);
  `:485` `eff(c, "foeToHit")` (need-mods breakdown); `:535` `eff(c, "dmg")`
  (weaponDamage); `:544` `2 * eff(c, "size")` (Gauntlet); `:556` `eff(c,
  "upkeep")` (upkeep); `:642` `eff(c, "tongue")` (fluency / Helm of
  Knowledge)
- `engine/combat.js:553` `eff(c, "noCrit")` (Cloak of Strength); `:1391`
  `eff(view, "throw")`; `:1396` `eff(view, "spellDmg")` (party-member casts
  — member sheets never carry `worn`, so they stay on the legacy path)
- `engine/items.js:89` `eff(c, "greed")` (gainWilmst)
- `engine/magic.js:376` `eff(c, "throw")`; `:400` `eff(c, "spellDmg")`
- `engine/movement.js:105` `eff(c, "charges")` (maxCharges); `:286` `eff(c,
  "light")` (Amulet of Light dispels darkness); `:319` `eff(c,
  "cloakHeal")`; `:324` `eff(c, "cloakRegen")`
- `src/browser/viewModels.js:47` `eff(c, "dmg")` (damageBracket — imports
  the engine's `eff`)
- `mazeworld.html` (classic-script duplicate `function eff(key)`, routed
  through `window.__mzEff` in Plan 04): callers `:2168` (charges), `:2620`
  (sight), `:2815` (toHit), `:2834` (foeToHit), `:2848` (dmg), `:2853`
  (upkeep), `:3127` (dmg), `:3556` (greed), `:4519` (throw), `:4531`
  (spellDmg), `:4586` (tongue)
- `engine/maze.js:195-196` — comment only, no call

Name/kind scans that can involve a slot item (routed through
`carriedItems` — §3): `engine/derived.js:128` `hasItemNamed` (callers
`:158`/`:159` `isFlying`, `:220`/`:222` `conditionsOf`,
`engine/movement.js:154` climb block).

## §7. Out of scope / next

- **Phase 39** — magic-item use → effect → cooldown chips (visible
  countdown UI beyond the Gear-tab `· N sq` text this phase already
  shows), new one-shot tools (rope, ladder, torch).
- **Phase 42** — landed: `tools/lib/tuning-bot.mjs` played under
  `{ wornSlots: true }` (`RUN_FLAGS`) at the time (Phase 45: that flag is
  gone — `RUN_FLAGS = { storeRoll: true }`; the bot plays the engine's
  only path); the wear policy is the engine's own `autoWearSlot` on take
  (first item per slot, never swapped) — see `docs/CLASS-PASS.md`
  `### Phase 42 tactics (BAL-01 second half)`.
- **Phase 43** — the Gear tab's ON YOU / BAG two-panel split (worn rows
  currently join the existing worn area beside the weapon/armor `wornRow`
  calls; this phase deliberately does not split the panel), and a
  bag-only drop prompt.

## §8. Jewelry family — two pieces (user ruling 2026-09-18, quick 260918-wy1)

**User ruling, verbatim (2026-09-18):**

> "We should not have ring/bracelet/amulet as separate equipment slots. We
> should have jewelry as a slot. Let's allow us to slot up to 2 pieces of
> jewelry: any combination of rings, bracelets, amulets, and helms."

This replaces the four jewelry worn slots the 260918-w4n staff amendment
left in place (`ring`/`bracelet`/`amulet`/`helm`) with ONE slot family,
`jewelry`, holding up to TWO pieces at once — any combination of the 8
JEWELRY rows, including two of the same former sub-kind (two bracelets, two
amulets, etc.). The cloak keeps its single slot, unchanged.

**The worn map — two flat keys, not an array.** `c.worn = { jewelry1?,
jewelry2?, cloak? }`. `WORN_SLOTS = ["jewelry1", "jewelry2", "cloak"]` stays
the ordered list of concrete KEYS — the address space for every action
(`useItem`/`unequipSlot`/`equipItem`), the worn map itself, and display/
report order. The "jewelry" FAMILY exists only in `slotFor` (which now
returns a family, not a key), a frozen key table `WORN_KEYS_OF = { jewelry:
["jewelry1", "jewelry2"], cloak: ["cloak"] }`, its inverse
`WORN_FAMILY_OF`, `SLOT_FAMILIES = ["jewelry", "cloak"]`, and one helper
`freeWornKey(c, family)` — the first key of the family with no `c.worn[key]`
yet, or `null` when every key is occupied. This is the ONE first-free-key
rule `autoWearSlot`, `equipItem`, `reconcileWorn` and the save-load fold all
read.

Why a flat two-key form over a two-element array: (1) every existing reader
(`c.worn[slot]` in `useItem`/`unequipSlot`/`wearItem`/`autoWearSlot`/
`sanitizeWorn`/`emptySlotRows`/`wornSlotRow`/`combatMenu`/`readyWornOfKind`/
`carriedItems` via `Object.values`) keeps working with zero shape branching;
(2) the action address stays the flat `{ slot }` string every validator, the
shell bridges, the combat submenu dispatch and the bot already emit — no new
`idx` field, no `{ slot, idx }` arity through `engine/actions.js`; (3)
serialization stays "key -> item object": `sanitizeWorn`'s invariant that
every worn value is a non-null non-array object survives, `delete
c.worn[slot]` stays the one empty-slot convention; (4) the legacy migration
is a simple key rename into the first free jewelry key.

**A third piece is never worn silently.** Untargeted `equipItem(state, i)`
with both jewelry keys occupied pushes `equipRejected { item, reason:
"jewelryFull" }` — the EXISTING event type with a new reason, no vocabulary
change needed. Targeted `equipItem(state, i, events, target)` — the action
gains an OPTIONAL `slot` field (`{ type: "equipItem", i, slot }`, validated
against `WORN_SLOTS`) — swaps with exactly that key: the displaced piece
drops into the bag at index `i`, same mechanics as the existing cloak swap
(no bag-cap check, net zero slots). A target that is not one of the item's
family keys refuses `equipRejected { reason: "wrongSlot" }`. The rule inside
`equipItem` for a slot item: explicit target wins; else `freeWornKey`; else
a single-key family (cloak) swaps with its one key (today's behaviour,
byte-identical); else refuse `jewelryFull`. The Gear BAG row shows Equip
while a jewelry key is free; when both are occupied it shows a two-choice
swap confirm — one button per worn piece (labelled with that piece's name)
plus No — each dispatching the targeted `mzEquipItem(i, key)`.

**Old saves — tolerant load only, no gating.** `sanitizeWorn` gains a
`LEGACY_JEWELRY_KEYS` fold (`["ring", "bracelet", "amulet", "helm"]`, in
that order) — each legacy key holding an object moves to `freeWornKey(c,
"jewelry")`, or, when both jewelry keys are already taken, is APPENDED to
`c.items` (mirrors the 260918-w4n staff fold, so the existing `clampCarry`
overflow drop is the only thing that can discard it); the legacy key is
deleted either way. ORDER IS LOAD-BEARING: this fold runs AFTER the staff
fold but BEFORE the generic "delete any key not in WORN_SLOTS" strip — if
the fold ran after the strip, the legacy pieces would vanish instead of
migrating. A save with no `c.worn` at all still goes through
`reconcileWorn`, which now wears by `freeWornKey` and reports PER FAMILY:
`{ slot: "jewelry", worn: [names], bagged: [names] }` — `worn` is now an
ARRAY (one or two names), so the rail card's count is
`worn.length + bagged.length` ("You were wearing four pieces of jewelry" is
right when two are worn and two bagged).

**Content.** All 8 JEWELRY_ROWS author `slot: "jewelry"`; `SLOT_OF` has 15
entries whose values are only `jewelry`/`cloak`; the four sub-slot names
(`ring`/`bracelet`/`amulet`/`helm`) leave `SLOT_OF`, `WORN_SLOTS`, the
validators, `GEAR_COPY.empty`, `RAIL_COPY.wornReconciled.what`, the bot and
this doc — surviving only inside `engine/saveState.js`'s
`LEGACY_JEWELRY_KEYS` (the one place those four strings may still appear as
`c.worn` keys) and as item display names (e.g. "Ring of Power" — a name, not
a slot key). Exported JEWELRY rows stay byte-identical (`dropAuthored` still
strips `slot`/`act`), so no rolled item shape moved and the parity fixtures
never drifted.

**Bot.** `tools/lib/tuning-bot.mjs#readyWornOfKind(state, ctx, kinds)`
replaced the old slot-addressed `readyWorn(state, ctx, slot, kinds)` —
family-agnostic: scans `WORN_SLOTS` and returns `{ slot, it }` for the
first ready, unblocked worn item whose activation kind is in `kinds`, so a
glow/tongue/fly/knit item is found in jewelry1, jewelry2 or the cloak key
alike, never by a hard-coded slot name. The bot never calls `equipItem`; it
acquires via `takeFind`/`takeLoot`/buy, all of which route through
`autoWearSlot` -> first free jewelry key, so it wears up to two pieces and
stows the third.
