# Phase 28: Armor Integrity & Durability - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas proposed in batch tables; user accepted all, with one addition (the cloak is wearable armor for anyone who can equip a cloak)

<domain>
## Phase Boundary

Armor behaves exactly as the screen says. This phase (a) audits and RECORDS the soak-vs-wear ruling (keep canon), (b) root-causes and fixes the "toast says wear / panel shows no damage" discrepancy with a pinning test, (c) moves remaining armor durability onto the item when a piece leaves the body (killing the unequip → swap → re-equip full-repair exploit), (d) makes the Cloak of Armor legible and real as effective armor for any carrier, and (e) narrates the four armor outcomes distinctly. Requirements: ARMOR-01..05.

Out of scope here: end-of-combat loot / removing foe-drop auto-equip (Phase 29), bag-cap gating (Phase 29), any armor tuning, new armor types, encumbrance/weight.

</domain>

<decisions>
## Implementation Decisions

### Soak-vs-wear ruling (ARMOR-01) — KEEP CANON
- Keep "d20 ≤ AR soaks the whole blow" — rulebook p.44 ("Using Armor") and the frozen prototype (`mazeworld.html` ~L4464) agree verbatim; no parity divergence, no fixture regeneration.
- Keep the canon wear charge: the full blocked damage is charged to durability when dmg > the armor's Min; nothing when dmg ≤ Min (rulebook: "if damage is done to your armor and it is above the Min then subtract the damage from your armor's WP").
- Keep the Dwarven half-wear trait (Phase 24 IDENT-09, already a declared divergence).
- Keep 04.2 (E8)'s Cloak of Armor ruling: never-wearing magic Plate, take-the-better of AR 15 / pool 45 against the worn piece (`engine/derived.js#armorSoak`), recorded as the documented interpretation of the rulebook's "acts as an equivalent to a full suit of plate armor … weighs no more than leather".
- **User addition:** the cloak counts as player armor for ANYONE who can equip a cloak — no Fighter-only Plate class gate applies to the cloak's plate (a Thief or Magic User carrying it soaks as Plate). Today's `armorSoak` already ignores class; keep it that way and say so in the item text.
- Record the whole ruling as a Key Decision in PROJECT.md ("Armor soak-vs-wear: canon kept; cloak = never-wearing plate for any carrier"). Because nothing about the soak/wear math changes, no fixture regenerates and no new divergence record is needed for ARMOR-01 itself.

### Durability on the item (ARMOR-03) — MINIMAL MODEL
- The WORN piece keeps today's character scalars (`c.armorWP`, `c.armorMax`, `c.patches`). The combat soak block, camp mending (`engine/movement.js` ~L488), and store repair (`engine/economy.js` ~L211/L252) stay untouched → parity stays byte-identical with no engine soak change.
- When a piece LEAVES the body (`unequipSlot`, or the swap inside `equipItem`), the bag item it becomes carries its remaining durability and patch count (e.g. `left` + `patches`; naming is the planner's discretion — the names must be carved out of all three `*Comparable()` fns in `test/parity/harness/comparables.js` via the existing strip-field pattern). `wornArmorItem` (`engine/items.js` ~L351) currently rebuilds the piece at full `c.armorMax` — that IS the exploit; it must carry `left`/`patches` instead.
- `equipItem` restores `c.armorWP = it.left ?? it.wp` and `c.patches = it.patches ?? 0` (instead of resetting to full). `c.armorMax` stays the item's `wp`.
- Fresh pieces always start at full: store buy, foe drop (`takeItem`), starting kit, treasure/magic armor. Only a piece that has been worn carries a `left` value. No random pre-wear (no new rng).
- Destroyed armor (armorWP 0) is GONE: unequipping/swapping a destroyed piece clears the slot with no bag copy (rulebook: "permanently destroyed … may not be repaired"). The existing `armorDestroyed` event already narrates the moment it breaks.
- Save migration is a tolerant read only: a pre-v1.3 bag armor without `left` reads as full (`left ?? wp`); no migration pass; `validateSave`/`rehydrate` need no new required field.

### Toast ↔ panel truth (ARMOR-02, ARMOR-05)
- Root-cause with a reproduction test FIRST: drive `applyAction` through a soaked foe hit (scripted rng) and assert the `armorSoaked` toast's `wear` equals the durability delta on the displayed armor (whatever the sheet/gear view reads). Then close every suspect found in the code read:
  1. `src/browser/viewModels.js#characterSheetViewModel` ARMOR tile shows only `NAME · AR n` — no durability at all.
  2. Bag armor rows (`renderCarriedList`, `mazeworld.html` ~L3507) print the item's static `txt` ("AR 15, 45 wp") — never remaining durability.
  3. A swapped-out piece re-enters the bag at full (`wornArmorItem`) — same root as the exploit.
  4. A strictly-better foe drop auto-equips at full mid-fight (`takeItem`) — narrate it honestly here (the item name changes; the panel is truthful); removing auto-equip entirely is Phase 29's job.
- Durability is displayed EVERYWHERE armor is named, through ONE shared formatter (view-model/helper level, not ad-hoc string building): sheet ARMOR tile → `PLATE · AR 15 · 6/45 hp`; gear panel worn row; bag armor rows (`left/max hp`); store repair line.
- Unit label is "hp" everywhere (the worn row already says hp; bag `txt` says "wp" — unify).
- Four outcomes distinguishable on screen via ADDITIVE payload flags on the existing `armorSoaked` event (no new event types): soaked-with-wear → "Armour takes 12 · wear 12"; soaked-without-wear (dmg ≤ Min) → flag e.g. `underMin: true` → "Armour shrugs off 3 — under its min, no wear"; magic-plate soak (cloak) → flag e.g. `magic: true` → "The cloak's plate takes 20 — it never wears"; armor giving out → existing `armorDestroyed` ("Your armour gives out"). Both the toast table (`src/browser/toasts.js`) and the Oracle narration (`src/browser/eventNarration.js`) read the flags. The Dwarven `halved` flag stays.

### Cloak of Armor legibility (ARMOR-04)
- Item text states the rule (planner's wording within the game's voice): soaks as Plate (AR 15) over whatever you wear, never wears out, any class — keep a wink of the "weighs nothing" flavor.
- Effective-armor readout everywhere (sheet tile + gear worn row): `CLOAK OF ARMOR · AR 15 · magic plate, never wears`, with the piece underneath listed as e.g. "under the cloak: Leather 9/15 hp". The readout is DERIVED from `armorSoak(c)` — one source of truth shared with the engine's soak site.
- The cloak stays a carried bag item (no equip step, no armor-slot record, no Fighter gate); `armorSoak` already derives the plate effect from `eff(c,"cloakArmor")`.
- Repairs (store, camp mending) apply to the worn piece underneath, unchanged; the cloak never needs repair, and the store's Repair line keys off the worn piece as today.

### Claude's Discretion
- Exact serialized field names for remaining durability / patches on bag items, and the shared formatter's location (a `viewModels.js` helper is the established pattern).
- Exact toast/Oracle wording for the four outcomes (voice: sarcastic, deadpan, family-friendly; must pass `test/voice/safety-scan.test.js`).
- Whether the sheet tile and the gear worn row share one HTML snippet or two calls to the same formatter.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/derived.js#armorSoak(c)` — the single source of EFFECTIVE armor (worn vs cloak plate, `magic` flag); reuse it for the UI readout so the sheet can never disagree with the soak site.
- `engine/combat.js#applyFoeDamageToPlayer` (~L1465–1512) — the ONE soak site; `armorSoaked {name, amount, wear, halved?}` and `armorDestroyed` already exist (Phase 25 additive-payload pattern to follow).
- `engine/items.js` — `takeItem` (~L255), `wornArmorItem` (~L351), `equipItem` (~L422), `unequipSlot` (~L473); `equipItem`/`unequipSlot` are pure, no rng.
- `src/browser/viewModels.js#characterSheetViewModel` — the sheet's stat tiles (ARMOR tile at ~L97); `test/unit/characterSheetViewModel.test.js` exists.
- `src/browser/toasts.js` (armorSoaked ~L1049, armorDestroyed ~L1047) and `src/browser/eventNarration.js` (~L353–355) — both must read the new flags.
- `test/parity/harness/comparables.js` — strip-field carve-out helpers (`stripBagField`, `stripFlightFields`, `stripDeclaredFields`) — the exact pattern for carving the new bag-item fields out of all three comparables.
- Rulebook text: `pdftotext -layout mazeworld.pdf <out>` — p.44 "Using Armor"/"Repairing Armor", p.46 Magic Cloaks table ("This cloak acts as an equivalent to a full suit of plate armor. However, it weighs no more than leather and makes no noise whatsoever.").

### Established Patterns
- Engine gate: pure/deterministic engine, parity byte-identical for solo play, new serialized fields carved out of all three `*Comparable()` fns, `test/parity/prototype-master.js.txt` never edited, every NEW event type needs an `EVENT_NARRATION` entry (payload flags on an existing type do not).
- Additive event payloads (Phase 25 FEED-01): add fields to an existing event rather than new types when the outcome is a variant of one event.
- View-model helpers in `src/browser/viewModels.js` are the presentation single-source-of-truth pattern (damageBracket ↔ weaponDamage); UI reads them, engine stays presentation-free.
- Deliberate rules changes are documented in a JSDoc block at the site ("DELIBERATE RULES CHANGE (phase, date, id)") and as a Key Decision in PROJECT.md.

### Integration Points
- `mazeworld.html` sheet kit rows (~L2967), gear panel worn row (~L3036) and `renderCarriedList` (~L3479) — where the shared formatter plugs in.
- `engine/economy.js` store repair (~L252, "Repair your X") — reads `c.armorWP/armorMax` (unchanged) but should use the shared "hp" label.
- `engine/character.js` chargen (~L373) sets `armorWP/armorMax/patches` — unchanged.
- `PROJECT.md` Key Decisions table — new row for the armor ruling.

</code_context>

<specifics>
## Specific Ideas

- The user's observation to root-cause: "Armor takes 39 / Wear 39 but the gear panel shows no damage" — the pinning test is the acceptance evidence for ARMOR-02.
- User rule (Area 1 addition): "the cloak counts as player armor wearable by anyone who can equip a cloak."
- Success criterion 5 (Key Decision recorded in PROJECT.md) is a documentation deliverable of this phase, not of the transition.

</specifics>

<deferred>
## Deferred Ideas

- Removing foe-drop auto-equip / auto-reject entirely → Phase 29 (LOOT-01).
- Random pre-wear on dropped armor ("a bit rusty") — new rng draw, not requested.
- Repairing bag (unworn) pieces at the store — not requested; repair stays worn-piece-only.

</deferred>
