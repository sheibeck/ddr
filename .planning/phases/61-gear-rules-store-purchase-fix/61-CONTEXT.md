# Phase 61: Gear Rules & Store Purchase Fix - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the two gear-rule holes found in the device rounds, in the engine first, so that Phases 62–63 can show real engine refusal reasons:

1. **Combat gear lock (GRULE-01).** While a fight is up, the engine refuses every player-reachable gear change (equip, unequip, the targeted jewelry/cloak swap), with one `gearRefused` event and a line in voice.
2. **A store purchase always delivers (STORE-02).** `buyFrom` settles legality and room before any gold moves. A legal item that isn't better goes into the bag instead of vanishing.
3. **The upgrade line explains itself (STORE-03, reworded by the user this session).** The one hit-math verdict stays. The line names the terms that differ (dice, to-hit, per-swing number, lost proficiency). It is shown on store weapon/armor rows (new), the loot screen and the find card, and it is advice, never a gate.

Out of this phase: the Gear tab layout (Phase 62), the action sheet and its greyed combat rows (Phase 63; this phase gives it the engine reason and the ruling on what stays live), and any content rebalance of weapon stats.

</domain>

<decisions>
## Implementation Decisions

### Combat gear lock (GRULE-01) — user accepted all recommendations
- **Lock window:** whenever `state.combat` is set, including the pending Fight! preview (`combat.pending`). Once a foe is in front of you, you fight with what you walked in with. Loot is unaffected: `state.combat` is cleared (`engine/combat.js:1359`) before the Victory loot card, so `takeLoot`'s equip-now still works.
- **Gated verbs:** `equipItem` (which covers the targeted jewelry/cloak swap via its `target` argument) and `unequipSlot`, the only player-reachable gear-change actions in `engine/actions.js` (`"equipItem"`, `"unequipSlot"`). `wearItem` stays an ungated internal primitive; its callers (`takeFind`, `takeLoot`, `takeItem`, and the two helper sites at `engine/items.js:918/1000`) never run mid-fight. A test proves that no dispatchable action changes `c.weapon`/`c.armor`/`c.worn` while `state.combat` is set. This satisfies GRULE-01's "wearItem" clause without gating the primitive.
- **Event and copy:** one NEW event, `gearRefused { verb: "equipItem"|"unequipSlot", reason: "combat", item?, slot? }`, zero rng draws, with state untouched on refusal. The line in voice is *"Not the moment to change outfits."* It needs entries in both narration tables (`src/browser/eventNarration.js` EVENT_NARRATION and `src/browser/narrationLines.js` at block priority, so the fight log renders it as a dull refusal entry). It also needs to be covered by whatever narration-coverage/voice/hp-not-wp scans already walk those tables. It reaches the player through the rail (standing ruling: the rail is the one feedback surface).
- **Stays live mid-fight:** USE (staffs, torch, jewelry/cloak powers: `useItem` already costs the turn in combat), potions, scrolls, the Shield spell, and Drop. None of them changes what you fight with. **This settles GRULE-02's open question for Phase 63:** the Shield is a spell pool and the torch is a `useItem` activatable, so neither is a gear change and neither is locked.

### Store purchase always delivers (STORE-02) — user accepted all recommendations
- **Legal but not better → bagged.** A weapon/armor/premium buy whose `weaponUpgradeDelta`/`armorUpgradeDelta` is ≤ 0 is bought and stowed in the bag (the `stowItem` path) instead of being rejected with `notBetter`. The player equips it from Gear whenever they like. An upgrade still auto-equips on purchase exactly as today.
- **Replaced piece on an upgrade: unchanged (traded in).** `takeItem`'s prototype behaviour stands: the old weapon/armor is replaced, not bagged. The purchase narration now says so in voice (e.g. *"The shopkeeper keeps your old Quarter Staff."*). Keep the change to the not-better branch so only that fixture moves.
- **Refusals before payment.** `buyFrom` checks, BEFORE deducting gold or marking the row sold: legality (`weaponRefusalReason` / `armorRefusalReason`: wrong class, race, too heavy) and, for a buy that will be bagged, room (`canStow`). A refusal is a no-op plus a reasoned event (extend the existing `buyFailed { reason }` or the existing refusal events; the planner picks the shape that keeps narration single-sourced). The store row (`src/browser/storeScreen.js`, the `row.disabled` line) is disabled for an illegal item or a bag-full bag-bound buy, and shows the reason ("can't use — Fighters only", "bag full").
- **Guarantee scope: every store effect.** A test iterates every `STORE_EFFECTS` effectId: a buy either delivers (the item is owned or the effect applied) or refuses with `c.gold` unchanged and `item.sold` still false. `STOWING_EFFECTS` (`engine/economy.js:469`) already pre-checks lockpicks and tools; the weapon/armor/premium branches join that pre-check discipline.

### The upgrade line (STORE-03, reworded) — user accepted all recommendations
- **Keep the ONE verdict.** `weaponUpgradeDelta` (via `engine/derived.js#expectedStrike`) stays the single "is this better" rule that `takeItem`, `lootCompare`, the loot screen's Equip-now and the tuning bot (`tools/lib/tuning-bot.mjs:711/729`) share. It is true under the rules: the Spiked Staff (d8, `need: -1`) swings worse than a Quarter Staff (d6) for most heroes. At level 3 a Magic User's expected strike is 4.05 vs 5.0. The todo's "proficiency" diagnosis was wrong for Magic Users, whose kits carry `prof 0`.
- **The line explains itself.** `lootCompare` names the terms that differ: dice (`d8 vs your d6`), to-hit (`−1 to hit`, from `weaponNeedMod`), crit range when it differs, the per-swing numbers (`4.1 vs 5.0 a swing`), and, when the current weapon carries a kit proficiency (`c.prof > 0`, which resets to 0 on any switch), *"loses your +N practiced bonus"*. Armor names AR and durability as today. It never restates the arithmetic: the parts come from the same derived helpers.
- **Where:** weapon/armor **store rows** (new: `storeScreen.js` currently shows only `usableBy`), the loot screen, and the find card. All read `lootCompare`.
- **Advice only.** It never disables BUY. It only decides auto-equip (upgrade) versus bag (not better).
- **Requirement reworded (done in this discuss):** STORE-03 and Phase 61 success criterion 4 now read *"A Magic User buys a Spiked Staff: gold is charged, the staff lands in the bag, and the line says why it isn't an upgrade (unit test)"*, replacing "a strictly bigger die must never read as not an upgrade".

### Engine Gate (standing rulings, not re-asked)
- The engine stays pure and deterministic, with zero new rng draws. `test/parity/prototype-master.js.txt` is never edited.
- Fixture impact measured up front: no parity fixture dispatches `equipItem`/`unequipSlot`, so the combat lock should move nothing. `action-script.economy.json` carries one `notBetter` store rejection plus 8 buys. That one fixture is expected to move: measure it with the fixture scan, declare it with before/after in `test/parity/FIXTURE-INVENTORY.md` (plus the divergence-records test if it applies), and regenerate only that fixture.
- Greenfield ruling: no dual-path code and no run-option gating. The bot plays the new rules (it never buys non-upgrades and never equips mid-fight, so its behaviour should not change; confirm with a short bot smoke).

### Claude's Discretion
- The exact `gearRefused` payload fields, and whether the pre-payment refusal reuses `buyFailed { reason }` or the existing `itemRejected`/`bagFull` events (keep one narration source per reason).
- The wording of the "traded in" and "explained upgrade" lines, in the house voice (sarcastic, family-friendly, HP not WP).
- Plan split, likely two plans: (1) combat lock plus narration and tests; (2) store pre-payment checks, not-better → bag, lootCompare explanation plus store-row display, then fixture declare/regenerate. They can run in parallel only if they don't both edit `engine/items.js` hunks; the planner decides waves.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/items.js`: `weaponRefusalReason`/`armorRefusalReason` (legality), `weaponUpgradeDelta`/`armorUpgradeDelta` (:363/:374, the one verdict), `takeItem` (:428, used ONLY by the store's `buyWeapon`/`buyArmor`/`buyPremium`), `stowItem` (:541, the one path into `c.items`, cap-gated), `canStow`, `equipItem` (:714, direct swap, prof reset at :727), `unequipSlot` (:821), `wearItem` (:406).
- `engine/economy.js`: `buyFrom` (:483; gold deducted and row sold BEFORE the effect runs), `STORE_EFFECTS` (:198–244), `STOWING_EFFECTS` (:469, the existing pre-payment stow check), `enchantForTier` (:287; premium = enchanted weapon or armor).
- `engine/movement.js:523`: the existing `if (state.combat) return events` gate pattern.
- `engine/derived.js`: `expectedStrike` (:1021), `weaponNeedMod` (:904), `classNeed` (:884), `strikeDie` (:766), `weaponDiceMean`; `content/weapons.js` for `lab`/`need`/`crit`; `content/kit.js` for kit proficiencies (Knight/Guard +2, Woodsman +3, Cleric +1; every Magic User sub is 0).
- `src/browser/viewModels.js#lootCompare` (:180): already returns `{legal, reason, delta, upgrade, equipNow, line, sub, usable}`; extend `line`/`sub` with the explanation.
- `src/browser/fightLog.js`: `PRIORITY.block` → dull entry, so refusals render dull automatically.

### Established Patterns
- Refusals are engine events with a reason plus a narration row in BOTH tables (`eventNarration.js` HTML Oracle copy, `narrationLines.js` rail/fight-log copy). Copy lives in frozen objects that the voice scan and hp-not-wp guard walk.
- Invalid actions are no-ops plus an event, never a throw (T-01-10b).
- Engine changes land with unit tests per verb and a fixture-scan measurement; the declared-divergence ledger is `test/parity/FIXTURE-INVENTORY.md`.

### Integration Points
- `engine/actions.js:156–180`: the `equipItem`/`unequipSlot` dispatch (argument validation lives here; the combat gate belongs in the engine verbs so any caller is covered).
- `src/browser/storeScreen.js:62–75`: the stock row builder (`row.disabled`, `usableBy` sub), where the reason and the lootCompare line are added.
- Shell mount points for the loot screen and find card that already call `lootCompare`.

</code_context>

<specifics>
## Specific Ideas

- The Spiked Staff case is the acceptance example: a Magic User with a Quarter Staff buys a Spiked Staff → gold is charged, the staff is in the bag, and the store row (before buying) and the rail line (after) say why it isn't an upgrade (`d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing`).
- User's words (Pixel 7, 2026-09-21): "I didn't think we should allow changing equipped gear during combat." / "Make sure our store items are actually purchasable."

</specifics>

<deferred>
## Deferred Ideas

- Keeping the replaced piece in the bag on an upgrade purchase (instead of trading it in). Considered and declined this phase because it moves every upgrade-buy fixture; revisit if players ask for it.
- Rebalancing the Spiked Staff's stats (`need: -1`) is a content change, not taken here.

</deferred>
