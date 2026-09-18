# Equipment Slot Model (Phase 37, GEAR-03 / GEAR-04)

**Phase:** 37-equipment-slot-model-eff-refactor
**Date:** 2026-09-17

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

**Rationale:** the prototype's carried-copy summation is a latent stacking
bug, not a deliberate design choice — nothing in the rulebook or the
prototype's own flavor text describes wearing two rings on one finger as
intentional. The v1.5 milestone's magic-item rework (Phase 39, use →
effect → cooldown chips) and the Gear ON YOU / BAG split (Phase 43) both
need a real "what is currently worn" set to build on; retrofitting one
after those phases land would be far more invasive than landing it first,
alone, fully regression-tested.

**Fixture impact: ZERO.** The legacy sum-all-carried path (`eff()`'s
`for (const it of (S.c.items || [])) if (it.eff && it.eff[key]) t +=
it.eff[key];` loop) is preserved byte-for-byte for every state without
`c.worn` — proved by the pinned legacy-equivalence table over all 14
chargen fixture seeds (`test/unit/worn-model.test.js`, Plan 01) and the
untouched parity suite (`prototype-master.js.txt` hash unchanged across all
four plans). Nothing in the fixture/bot/tools/test call paths ever passes
the `wornSlots` option or calls `reconcileWorn` — the model is entirely
opt-in.

**Assumption-delta record (Plan 01):** the detector fired on pluralization
("a second ring/cloak/staff/bracelet"). Noun = "worn slot" (`c.worn[slot]`
— the ONE item the character benefits from per slot). Decision = **PROMOTE**:
`c.worn` becomes the primary representation of what confers effects; the
old "sum of every carried copy" is demoted to the legacy variant, kept only
for states that predate the model (fixtures, bots, un-migrated saves).
Adding a worn flag alongside the bag (rather than promoting a real worn
map) was rejected — it would have kept the bag as the primary
representation and left stacking latent for the new UI to expose, not fix.

## §2. Slot taxonomy

Every JEWELRY, CLOAKS and STAVES row (`content/treasure-tables.js`) is
authored with a `slot` field on its module-private `*_ROWS` array (never
spread onto the exported row or any rolled item — see §3). 24 rows total.

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
| Cloak of Healing | cloak | cloak |
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
entries) as the runtime lookup — `engine/derived.js#slotFor(it)` consults
`it.slot` first, then `SLOT_OF[it.n]`, then a `kind` fallback (`cloak` →
`cloak`, `staff` → `staff`) for a name not in the table, else `null`.

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

- **Storage:** `c.worn = { ring?, bracelet?, amulet?, helm?, cloak?, staff?
  }` — a slot-key → item map, **lazily created**. Absent on every fixture,
  bot run and un-migrated save. A worn item is **not a bag member**: it
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
- **Refusal vocabulary** (§1 of `docs/USABLE-FEATURES-AUDIT.md` carries the
  full table; the new row this phase adds):

  | Reason | Carried by | Meaning |
  |---|---|---|
  | `notWorn` | `useRefused` | a cloak/jewelry/staff activatable used from the BAG while the character is on the worn-slot model — activatables must be worn to work; legacy states (no `c.worn`) keep bag-use |

## §5. Old-save reconciliation (GEAR-04)

- **Migration runs on load**, gated on the shell-only `wornSlots` option
  (the `storeRoll` precedent) — `engine/saveState.js`'s `validateSave(raw,
  { wornSlots })` / `rehydrate(obj, { wornSlots })`, homed beside
  `migrateCarry`/`clearFoeEffect`/`clearStaleTimers`, both call the same
  `reconcileWorn(c)` (`engine/derived.js`, Plan 01). For any save whose `c`
  lacks `worn`: create `c.worn`, and for each slot wear the **first item
  of that slot type in bag order**; every later copy of the same slot type
  **stays in the bag**. Moving bag → worn only ever frees bag slots, so
  migration can never overflow the bag cap. A save that already carries
  `c.worn` (even an empty `{}`) is **never re-migrated**.
- **Fresh runs:** `newRun(seed, exclude, { wornSlots: true })` — an option
  only the shell's new-game path sets — creates `c.worn` and wears the
  Thief's starting cloak, with zero rng draw. Every fixture/bot/tools/test
  caller of `newRun(seed)` without the option stays byte-identical.
- **`sanitizeWorn(c)`** (`engine/saveState.js`) runs on BOTH load chains,
  unconditionally, and neutralises a present-but-tampered `c.worn`
  (`"999"`, `[]`, `null`, a bare number → `{}`; a non-object entry inside a
  genuine map is dropped) — it never injects a missing key. Creation
  (`reconcileWorn`) is option-gated; tolerance (`sanitizeWorn`) is
  unconditional; the two never overlap in what they touch.
- **The report is a RETURN VALUE, never a serialized field:**
  `reconcileWorn(c)` returns `[{ slot, worn, bagged }]` (one entry per
  populated slot, in `WORN_SLOTS` order — `worn` the display name now
  worn, `bagged` the display names of every later same-slot copy left in
  the bag) or `[]` when nothing was wearable. `validateSave`'s result
  carries this as `wornReport` only when the migration actually ran.
  `src/browser/engineAdapter.js`'s `boot()` passes `wornSlots: true` on
  every real load and stashes the report on a module-level value;
  `takeBootWornReport()` returns it exactly once, then resets to `null` —
  a later ENTER (or a fresh roll) is a no-op.
- **Narration:** the shell surfaces the report **once, only when at least
  one extra was bagged**, as a GEAR-family rail card plus the same line in
  the Oracle log — never a toast (`src/browser/rail.js`'s
  `wornReconcileCard(report)`, called by `mazeworld.html`'s
  `surfaceWornReconcile()` on the ENTER-to-resume branch, Plan 04). Locked
  copy register:

  > You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now.

  (the `{count}`/`{what}`/`{bagged}`/`{verb}` template spells out counts up
  to six and falls back to the plain digit at seven or more).
- **The option gate (surfaced assumption, Plan 03):** an UNCONDITIONAL
  migration would inject a `worn` key into every rehydrated legacy save
  and break six standing round-trip contracts this codebase treats as
  non-negotiable (`save-validation.test.js`'s seed 1/42/12345
  `deepStrictEqual`, `party-model.test.js`, `effects.test.js`'s "never
  injected" rehydrate proof, `engineAdapter.test.js`'s boot contract,
  `dual-write-convergence.test.js`, the Phase 36 "never injects the key on
  load" discipline). Resolution: the migration lives exactly where CONTEXT
  locks it (`validateSave`/`rehydrate`), but is gated on the same
  shell-only option name `newRun` uses (`{ wornSlots: true }`), which
  `engineAdapter.boot()` passes on every real load — every player save
  therefore migrates on load (GEAR-04 holds on device), while tests/tools
  that call `rehydrate` directly keep today's byte-identical contract. One
  existing assertion (`engineAdapter.test.js`'s boot-rehydrates-a-save
  test) was deliberately updated because `boot()` IS the shell's real load
  path and now genuinely migrates.
- **Bot / balance:** landed (Phase 42) — `tools/lib/tuning-bot.mjs`'s
  `RUN_FLAGS = { storeRoll: true, wornSlots: true }` is now spread into
  every `playRun`'s `newRun` call, so the bot plays the worn-slot model
  real players see (the v1.5 BEFORE pin `e69ff07` stays like-for-like,
  since it predates this flag). The "wear/swap policy" this note asked for
  is the engine's own `autoWearSlot` on take, unchanged by this phase — the
  bot wears the first item per slot on pickup and never swaps a worn item
  for a better one mid-run; that IS the recorded policy, not a gap. See
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
- **Phase 42** — landed: `tools/lib/tuning-bot.mjs` now plays under
  `{ wornSlots: true }` (`RUN_FLAGS`); the wear policy is the engine's own
  `autoWearSlot` on take (first item per slot, never swapped) — see
  `docs/CLASS-PASS.md` `### Phase 42 tactics (BAL-01 second half)`.
- **Phase 43** — the Gear tab's ON YOU / BAG two-panel split (worn rows
  currently join the existing worn area beside the weapon/armor `wornRow`
  calls; this phase deliberately does not split the panel), and a
  bag-only drop prompt.
