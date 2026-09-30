# Phase 89: Item Audit & Fixes - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Every item does what its text says. One audit table covers every treasure, armour, weapon, cloak, jewel, staff, wand, potion and scroll; each mismatch is fixed (and pinned by a test) or recorded as a deliberate ruling. The Enlarge potion is worth drinking (ITEM-05, report #6). Every system the audit finds missing is built or re-ruled, party-wide item effects included (ITEM-06). Joiners use the items they carry and their armour soaks foe hits like the hero's (ITEM-07). The TEXT-01 plain-language wording rules apply to every item row.

Requirements: ITEM-01, ITEM-05, ITEM-06, ITEM-07, TEXT-01 (item rows). No bot pass (Phase 92 runs the milestone's one bot pass).

**Required reading for every plan:** `.planning/notes/v2.3-user-rulings-2026-09-30.md` (Items and TEXT-01 sections) and `.planning/notes/v2.3-item-audit-findings.md`.

</domain>

<decisions>
## Implementation Decisions

### Already ruled by the user (2026-09-30, not re-asked)
- **Walnut Staff:** text-only change: it casts Weaken (the engine already runs the Weaken effect). Resolves the ledger mismatch.
- **Heavy-weapon "−1 to hit" stays** (Bastard Sword, Battle Axe, Kopesh, Flail, Mace, Morning Star, Spiked Staff, Awl Pike, Naganita −1; Bardiche −2); light blades +1. Correct under roll-high; no change.
- **Death potion typo:** "your dead!" becomes "you're dead!" (`content/potions.js`).
- **TEXT-01 for items:** "faces" wording becomes "+/− to hit" (e.g. "every foe has two fewer faces that hit you" → "foes −2 to hit you"); hard caps name the range on a d20 ("foes hit you only on a high roll (20 on a d20)" style); "squares of opponents/enemies" becomes how many foes an area effect hits (Amulet of Stone, Birch, Oak and Cedar Staves); "can talk to"/"understand them" wording on the Helm of Knowledge says it lets you always parley, and says what a parley is.
- **ITEM-07 exists:** "let joiners use items they have, and let their armor soak damage. Just like players."

### How the item audit runs (ITEM-01, ITEM-06; accepted 2026-09-30)
- **The table:** `docs/ITEM-AUDIT.md`, one row per item (every treasure, armour, weapon, cloak, jewel, staff, wand, potion and scroll), columns **text / engine / canon / verdict** (the milestone's audit gate).
- **Canon:** the rulebook (`mazeworld.pdf`) and the prototype (`test/parity/prototype-master.js.txt`, read only), with the user's rulings overriding both.
- **Default fix direction:** the engine does what the item text promises (the text is the promise to the player), unless the text is a typo or the user ruled otherwise.
- **Balance calls:** obvious fixes are built. Any mismatch whose fix moves balance materially (e.g. a heal that becomes party-wide, a number that changes a lot) is collected into ONE batched `checkpoint:decision` mid-phase for the user's ruling before it is built. Rulings are recorded in the table's verdict column.
- **Pins:** each fixed row is pinned by a test in the `authored-ranges` / `roll-sign-consistency` style, plus a text-vs-engine guard so an item's text and its numbers (duration, charges, cooldown, bonuses) can't drift apart again. The Gear tab, store, loot and find cards state what the engine does.

### The Enlarge potion (ITEM-05, report #6; accepted 2026-09-30)
- **Troll-sized:** +11 damage total, meaning the one size step's +2 (SIZE_DAMAGE_PER_STEP) plus +9 bulk, in line with a Troll's +11 (its own +9 plus Large +2).
- **The cost stays one size step:** foes +1 to hit the drinker (SIZE_FACES_PER_STEP).
- **Duration stays 50 squares.**
- **Price 75 → 150,** so +11 for 50 squares doesn't undercut the Strength potion (+8 for 25 squares at 100). Phase 92 may retune it with the store economy.
- The text states both sides plainly (damage bonus and the to-hit cost), in the TEXT-01 wording.

### Joiners use their items and soak hits (ITEM-07; accepted 2026-09-30)
- **Both ways:** automatically in combat, and player-directed outside combat.
  - **In combat (automatic, on the Joiner's turn):** a Joiner at or below ⅓ of its HP drinks one of its own healing potions instead of swinging (if it has any); in round 1 it uses a ready worn item's timed effect. Mirrors the existing class policy in `engine/combat.js#pickMemberAbility` (round-1 opener, defensive below half HP).
  - **Outside combat:** a USE on the Hero tab's Company panel lets the player make the Joiner drink a potion or use a worn item.
- **Carried gear is worn on joining:** a cloak or jewel in a Joiner's bag (the Thief's starting cloak) goes into a free slot when the Joiner joins, so it can be used.
- **Armour soak exactly like the hero:** a foe's hit on a Joiner goes through the same soak roll (`engine/derived.js#armorSoak` on the Joiner's sheet), armour wear and breakage, narrated (today the member branch of `foeTurn` subtracts the full damage).
- **Joiner item chips:** a Joiner's live item effects show chips in YOUR LOT and the Company panel like the hero's (88-03 finding: `engine/derived.js#memberConditionsOf` reports only duration abilities and Brace).
- Item effects a Joiner starts carry `src` and end through Phase 88's `endSourceEffects` like the hero's (the link already works on any sheet).
- Every new event gets its `EVENT_NARRATION` entry and rail twin; any new roll comes from a derived stream.

### The known item findings (accepted 2026-09-30)
- **Poplar Staff:** engine to text: it heals every party member (hero and Joiner) d20+10 each; the text says "the whole party" (the party is at most two). Today `use: "heal"` falls into `useItem`'s Healing-potion branch (d10+2, hero only). Heal rolls from a derived stream.
- **Pendant of Fortitude:** taking it off disarms it (today `use: "half"` sets `c.halfNext` on the character, which survives take-off). It joins the Phase 88 source link like every item; the use stays spent (its 100-square cooldown runs on).
- **Party-wide effects:** the audit confirms the Crystal Staff's invisibility covers the Joiner (`PARTY_WIDE_ITEM_EFFECTS`, read on the member side of `foeToHitVs`), and gives any other item whose text promises a party-wide effect the same reach, each pinned.
- **"Past floor 12" limits on items** (Amulet of Stone, Oak Staff, Cedar Staff): kept for now and stated plainly. Each gets an audit row that goes to the user at the batched checkpoint (the Phase 90 spell rulings removed the cap from Petrify and Blind).

### Gates (milestone)
- Greenfield: no dual code paths; old saves tolerant-load only.
- New rolls from derived streams; existing draws never reorder.
- An `EVENT_NARRATION` entry for every new event (coverage guard).
- Moved fixtures measured, declared (before/after rationale) and regenerated: only those.
- `test/parity/prototype-master.js.txt` is never edited.
- No bot pass (Phase 92).

### Claude's Discretion
- The audit table's exact column wording and row order; how the batched checkpoint groups the balance calls.
- The Joiner's item-use thresholds beyond the accepted ⅓ HP potion rule, event names and payloads, and the Company panel USE layout (within the UI rulings: the rail is the one feedback surface; Joiners appear only in YOUR LOT and the Hero tab's Company panel).
- How the Enlarge +9 bulk is carried (activation data vs a size-damage multiplier), as long as the total reads +11 and a Troll drinking it stacks.
- Plan split and wave order.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/potions.js`: POTIONS rows with `act` records; Enlarge `act: { kind: "enlarge", effect: 50, eff: { size: 1 } }`, price 75; Strength `act: { kind: "might", effect: 25, might: 8 }`, price 100; Death `txt: "your dead!"`.
- `content/treasure-tables.js`: JEWELRY / CLOAKS / STAVES rows (Pendant of Fortitude `use: "half"` ~L138; Amulet of Stone `aoe: 4` ~L166; Birch/Walnut/Oak/Crystal/Poplar/Cedar staves ~L256-280).
- `engine/derived.js`: size rules (`SIZE_DAMAGE_PER_STEP` 2, `SIZE_FACES_PER_STEP` 1, `sizeAxisStep`, `sizeDamage`, `itemSizeStep`), `armorSoak(c)` (~L1107), `memberConditionsOf`, `PARTY_WIDE_ITEM_EFFECTS`, `foeToHitVs`.
- `engine/items.js`: `useItem` (`case "heal"` ~L1679, `case "half"` ~L1728), `applyActivation`, Phase 88's `endSourceEffects` / `SOURCE_SLOTS` / `src`.
- `engine/combat.js`: `alliesTurn` (~L2018), `memberView` (~L2127), `pickMemberAbility`, `foeTurn`'s member branch (no soak today, 87-01 finding).
- `engine/character.js#rollCharacter`: a Joiner sheet carries `potions` (a count), `scrolls` (MU 1), `items` (Thief: one random cloak), `worn`.
- `engine/encounters.js#meetJoiner` / `resolveJoiner` (the join path where carried gear gets worn).

### Established Patterns
- Greenfield rules, derived rng streams, declared fixture moves, comparables carve-outs (`test/parity/harness/comparables.js`).
- Audit docs in `docs/` with one row per entry (e.g. `docs/USABLE-FEATURES-AUDIT.md`, `docs/GEAR-BALANCE.md`, `docs/ROLL-LEDGER.md`).
- Executor commits: plain `git commit` with the attribution trailer, never amend or reset.

### Integration Points
- Item text surfaces: Gear tab sheet, store lines, loot and find cards (one `itemStatLines` helper since Phase 71).
- Joiner surfaces: YOUR LOT (combat) and the Hero tab's Company panel only.
- Chips: `src/browser/heroConditions.js`, the member conditions path.

</code_context>

<specifics>
## Specific Ideas

- Report #6 (verbatim): "Enlarge potion send worthless. +2 damage to get hit now often? Should be more in alignment with troll +11 to damage."
- "let joiners use items they have, and let their armor soak damage. Just like players." (user, 2026-09-30)

</specifics>

<deferred>
## Deferred Ideas

- A GIVE action (the hero hands an item to a Joiner): a new system beyond "use what they carry"; not built this phase.

</deferred>
