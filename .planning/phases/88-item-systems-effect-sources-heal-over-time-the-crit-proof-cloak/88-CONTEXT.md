# Phase 88: Item Systems: Effect Sources, Heal-Over-Time & the Crit-Proof Cloak - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Engine work that the Phase 89 item audit builds on. ITEM-02: every timed item effect carries its source item and slot, and ends the moment that item comes off (take off, swap, drop, sell, destroyed), surviving save, load and relaunch, with Joiners' gear covered. ITEM-03: a general heal-over-time system, first used by the Cloak of Regeneration. ITEM-04: the Cloak of Strength's crit ward, already shipped by quick 260928-cos, is closed with pinning tests and joins the source link. No bot pass (Phase 92).

**Source (user's words, backlog 999.16, 2026-09-28):** "the cloak of regeneration should actually heal every 10 steps for 30 steps. Also, when you use an item and then take that item off, you should lose the items benefit. For instance, if I wear the cloak of flying and use it, I gain flying, and then if I take it off, I should lose that flying condition. We don't want people just putting everything on and stacking benefits without actually wearing the item for the benefit."

</domain>

<decisions>
## Implementation Decisions

### Scope of the effect-source link (ITEM-02; orchestrator scout, confirmed in code)
- **Root cause:** an item effect is a `c.timers` record keyed only by the item's name (`item:<name>`, `engine/derived.js#itemTimerId`). `liveItemEffects` never checks that the item is still worn, so a benefit outlives its item.
- **Linked effects:** the 12 worn items that start a timed effect (cloaks: Strength, Invisibility, Speed, Armor, Flying, Ether; jewelry: Ring of Power, Gauntlet of the Giant, Amulet of Light, Anklet of Invisibility, Helm of Knowledge, Bracelet of Flight) plus the Cloak of Regeneration's new 30-square window.
- **Not linked:** potions (Speed, Strength, Enlarge, Invisible) and the Torch are used up on use (`useItem` pushes `itemConsumed` and removes them), so their effects run their course. No staff or other bag item starts a timed effect today.
- **The record carries its source:** the slot (`cloak`, `jewelry1`, `jewelry2`) and the item, on the timer record itself, so it survives save, load and relaunch. New serialized fields are carved out of all three `*Comparable()` functions.

### When an effect ends (ITEM-02, user-accepted 2026-09-30)
- **Any slot change ends it:** anything that empties the source slot or puts another item there — take off (`unequipSlot`), swap (`equipItem` / `wearItem` replacing it, even with an identical copy), drop, sell (`sellItem`), or the item destroyed by any path (e.g. the RULES-09 Pilfer fumble). Putting the item back on does not bring the effect back.
- **One mechanism:** a single engine helper ends the effects linked to a slot, called from every gear-change path, plus one load-time reconciliation. No scattered per-path checks.
- **The use is spent:** after an early end the item is ready again exactly when it would have been had the effect run its full length (remaining effect + cooldown). Taking an item off never gets it back sooner.
- **Narration:** one line per ended effect on the Oracle and a rail card, naming the item and what stops, in the house voice (sarcastic, family-friendly). Every new event type gets its `EVENT_NARRATION` entry and rail twin.
- **Old saves:** on load, a live item effect with no recorded source is linked to the matching worn item if one is there; otherwise it ends quietly (tolerant load, no event).

### Edge cases (user rulings 2026-09-30)
- **Cloak of Ether inside rock: allowed, and the hero is entombed.** Taking it off, dropping it or selling it while standing in rock ends the Ether effect, which goes through `engine/movement.js#resolveEtherEnd` (its docstring makes it the one home of the entombment rule for every early end). No refusal and no warning (the user chose this over "refuse" and "allow after a two-tap warning"). Consistent with the 2026-09-19 rule: "if your movement ends when you are in a wall, you die". Gear changes are already locked in a fight (`gearLockReason`), and there is no fight in stone.
- **Flight ending strands nothing:** the climb and leap checks run as a step enters a tile, so a flight that ends early leaves the hero where they stand.
- **Joiners: covered by design.** Joiners can't use items today: only the hero's `useItem` → `applyActivation(state.c)` starts an item effect, and Joiner sheets hold rolled gear with no path that starts an effect on them. The link and its end helper work on any character sheet (hero or Joiner) and are pinned on a Joiner sheet. "Joiners can't use their items" is recorded for the Phase 89 audit (ITEM-06). No Joiner item-use system is built here.

### Cloak of Strength (ITEM-04, user-accepted 2026-09-30)
- **Already shipped by quick 260928-cos (2026-09-28):** the payload is `critWard`, read only at the foe-crit sites (`foeTurn`'s hero and member branches, `pursuitStrike`) through `derived.js#critWardOf`; the wearer's own crits are no longer banned; it has its own activation kind and chip ("Crit-proof", `mazeworld.html:3519`), distinct from the Fighter's Braced. Pinned today by `test/unit/cloak-crit-ward.test.js`.
- **Close it with tests:** pin every clause (hero, Joiner sheet, pursuit strike, the wearer's own crits still land, the Crit-proof chip and its name are not Braced), adding whichever pin is missing. Its ward joins the source link: it ends when the cloak comes off, like every other effect.

### Cloak of Regeneration heal-over-time (ITEM-03)
- **General system:** heal-over-time is activation data (heal every N squares, M ticks, a die) consumed by the squares-cadence timer tick, so any item can use it and Phase 89 can reuse it.
- **The cloak (user, 2026-09-30):** "The cloak should be active for 30 squares, healing 1d6 every 10 squares. Then it goes on cooldown for 50 squares." Three ticks, at 10, 20 and 30 squares after use; then a 50-square cooldown (one use every 80 squares). The instant d6 on use is gone (greenfield), and the item text is rewritten to match.
- **Rolls:** each tick's d6 comes from a derived rng stream, never the main stream, so floor generation and existing draws don't reorder.
- **Squares, not taps:** ticks follow `state.steps` squares (a water step costs 2). A 2-square step that crosses a mark ticks exactly once: never skipped, never doubled. There are no ticks in a fight (no steps).
- **Every tick is narrated,** including a tick at full hp ("Nothing left to knit."), which is spent.
- **Taking the cloak off stops the ticks that are left** (through the source link).
- **Its own "Regenerating" chip** shows the ticks left.
- Wearer only (the hero; Joiners covered by design).

### Gates (roadmap)
- Greenfield: no dual code paths; old saves tolerant-load only.
- New rolls from derived streams.
- An `EVENT_NARRATION` entry for every new event (coverage guard).
- Moved fixtures measured, declared (before/after rationale) and regenerated: only those.
- `test/parity/prototype-master.js.txt` is never edited.
- No bot pass (Phase 92 runs the milestone's one bot pass).

### Claude's Discretion
- The exact source-record shape on the timer (e.g. `src: { slot, n }`), the helper names, and how each gear-change path calls the end helper.
- Event names and payloads for "effect ended" and "regeneration tick", and the exact line wording (house voice).
- How a 2-square water step that crosses a 10-square mark is counted (it must tick exactly once).
- The derived-stream key for the tick roll.
- How the Regenerating chip shows the ticks left.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/effects.js` (Phase 36): `startEffect` (L140), `startCooldown` (L163), `tickRounds` (L179), `tickSquares` (L192), `remaining` (L202), `isReady` (L213), `clearRoundTimers` (L227). The effect-then-cooldown record every item activation uses.
- `engine/derived.js`: `activationKeyFor`, `activationFor`, `itemTimerId`, `chargesTimerId`, `liveItemEffects`, `itemEffectActive`, `critWardOf` (L257), `eff()`, `moveCost` / `WATER_MOVE_COST`, `inStone`.
- `engine/items.js`: `wearItem` (L456), `takeItem` (L478), `dropItem` (L785), `equipItem` (L818), `unequipSlot` (L962), `applyActivation` (L1272), `useItem` (L1422), the `knit` case (~L1616, today's instant d6), `PILFER_FUMBLE_KINDS` / `pilferFumbles` (~L1339-1360), the `itemConsumed` branch (~L1796).
- `engine/economy.js`: `sellItem` (L192).
- `engine/movement.js`: the per-step `c.timers` tick block in `move`, and `resolveEtherEnd` (L183).
- `engine/saveState.js` ~L755: item cooldown restore on load.
- `content/treasure-tables.js`: CLOAKS / JEWELRY rows with `act` records; Cloak of Regeneration (~L206, `act: { kind: "knit", effect: 0, cd: 20 }`); Cloak of Strength (~L187, `critWard`). `content/activations.js`: `ACTIVATION_OF` (treasure + potions + tools).
- `src/browser/heroConditions.js`: the item chip entries (`item("critWard", true)` etc.); `mazeworld.html` ~L3519 chip label map (`critWard: { label: "Crit-proof", unit: "sq" }`).
- `src/browser/eventNarration.js` + `src/browser/narrationLines.js`: Oracle and rail lines (existing `cloakRegenerated`, `critWarded`).

### Established Patterns
- Greenfield rules, derived rng streams (`derivedRng` / `makeRng(hash(seed, purpose, …))`), declared fixture moves, comparables carve-outs (`test/parity/harness/comparables.js`).
- Executor commits: plain `git commit` with the attribution trailers, never amend or reset.
- Tests in the `item-activation` / `item-wiring` / `cloak-crit-ward` style; narration coverage guards (`narrationLinesCoverage`, `narrationLinesTable`).

### Integration Points
- Every gear-change path (`unequipSlot`, `equipItem`, `wearItem`, `dropItem`, `sellItem`, item destruction) calls the one end helper.
- The squares tick in `move` drives both effect expiry and the heal-over-time ticks.
- Save/load: `serializeRun` / `validateSave` / `rehydrate` (tolerant load of records with no source).
- The Gear tab and YOUR LOT chips read `heroConditions.js`.

</code_context>

<specifics>
## Specific Ideas

- "if I wear the cloak of flying and use it, I gain flying, and then if I take it off, I should lose that flying condition" (user, 999.16).
- "The cloak should be active for 30 squares, healing 1d6 every 10 squares. Then it goes on cooldown for 50 squares." (user, 2026-09-30)
- A full-hp tick: "Nothing left to knit."

</specifics>

<deferred>
## Deferred Ideas

- Joiners using their own items (a new system): a finding for the Phase 89 audit (ITEM-06).
- Joiner armour never soaks a foe hit (finding from 87-01): Phase 89 (ITEM-06).

</deferred>
