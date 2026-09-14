# Proposed Milestone: "Feedback, Feel & Polish"

**Captured:** 2026-09-13 (from user via `/gsd-new-milestone`, while v1.1 Phase 19 was still executing)
**Status:** PROPOSED — stand up via `/gsd-new-milestone` AFTER v1.1 (Phases 19–21) closes. Captured here so the active milestone's STATE/ROADMAP/REQUIREMENTS were not reset mid-flight. Mostly UX/feedback + a handful of rules fixes; a light research pass (class/sub-class/racial feature audit) is warranted, the rest is direct.

## Vision

**Nothing happens silently.** Every class / sub-class / racial feature that fires — or that *blocks* the player (can't equip, can't strike) — every spell effect in either direction, every scroll, weapon, and item effect produces obvious, on-screen player feedback so nobody feels lost by "whatever just happened." Alongside that: make brutal early combat read as narrative rather than "miss, miss, miss," and clean up a set of UI-feel and rules-integrity issues surfaced by on-device play.

## User's brief (verbatim intent, lightly grouped)

### A. Feedback is critical (the through-line)
- If a class/sub-class/racial feature fires, or prevents equipping/using something, the player must be told **what** happened and **why**.
- **Every spell effect** — ours on the enemy, the enemy's on us — must be obvious. Same for **scroll** effects, **weapon** effects, and **racial/class/sub-class** effects.
- **Enemy hits must toast RED** to denote an enemy hit. Today all hits and misses are green. Expected reading: "You miss the enemy." / "The enemy hits you (or misses)." For multi-attack foes: "The enemy hits you **2 out of 4** times" (aggregate, not four toasts).
- **Vary early-combat miss narration.** Early levels are brutal (that's OK), but instead of "Miss" over and over, build in call-outs to fledgling adventurers not being very good at this yet — make it feel like part of the narrative. (Sarcastic, family-friendly voice per project identity.)

### B. Class / sub-class / racial rules
- **Wizard weapon rule:** Wizards can't use weapons until they've cast their last spell — but this should apply **only if they actually have attack (combat) spells**. A Wizard with no attack spells may use weapons.
  - Today: `engine/combat.js` ~L292 refuses the strike whenever `c.sub === "Wizard" && maxCharges(c) - c.spellsUsed > 0` — it counts charges, not *attack* spells.
- **Audit every class/sub-class/racial feature for "feels horrible" cases** like the above — anything that makes playing that option miserable rather than flavorful. (Research-first item: enumerate features → classify by player-facing effect → fix + add feedback.)

### C. Gear / inventory integrity
- **Armor durability reset exploit:** with worn armor at 0 hp, equip another armor from inventory, then re-equip the depleted one → it comes back at **full** hp.
  - Root cause: durability lives on the character (`c.armorWP/armorMax/patches`), not on the item; `equipItem`/`swapArmor` in `engine/items.js` (~L256–260, ~L420–424) set `c.armorWP = it.wp` on every equip. Fix = carry remaining `wp` on the item when unequipped/swapped (new serialized field → comparables carve-out + save-migration tolerance).
- **Bag slot cap not enforced everywhere:** the starting bag has 4 slots but the player can exceed it. `bagCap(c)` (`engine/items.js` ~L287) is only checked at two sites (~L345, ~L446); find the pickup/loot/buy/starting-kit paths that bypass it and route them through one gate (with feedback when the bag is full).
- **Bigger bags in loot tables:** medium/large/exlarge (`content/bags.js`) need to be obtainable as treasure, depth-appropriate.
- **Cloak of Armor needs a real effect.** Its text says "a full suit of plate that weighs nothing," but the game has no encumbrance, so the flavor promises nothing meaningful. (Note: 04.2 Bugs-B wired it as "take-the-better Plate that never wears out" in `engine/derived.js#armorSoak` — decide whether to keep that and *say so* in the item text, or redesign it. Either way the item must be legible.)
- **Fold in backlog G16** — DR16-G "N squares of opponents" group model + Amulet of Stone 4-target (tracked as `UI-V2-03` in `REQUIREMENTS.md` v2 backlog) — together with the cloak rework.

### D. UI feel
- **Gear panel:** put **Use** and **Drop** side by side (not stacked), **Drop on the far right**, and **confirm before dropping** so nothing is dropped by accident. Saves real estate.
- **Map recenter on return:** coming back from the Store (and any other full-screen panel) often leaves the map off-center. Always recenter on the party icon when the map view returns.
- **Default map zoom:** currently starts fully zoomed in (`zoom = 1` against `ZOOM_MIN 0.6 / ZOOM_MAX 2.4`, `mazeworld.html` ~L2363). Default should be **halfway between fully zoomed in and fully zoomed out**.
- **Tutorial toggle:** a setting to turn tutorials off for veterans — or dismiss-once with a way to re-enable from Settings. (`src/browser/tutorial.js` persists `mazeworld.tutorialSeen` today; needs a user-facing switch, and note UX-06 first-run tutorial is itself still deferred "until the UI settles.")

### F. Combat start & usability (added 2026-09-13)
- **No pre-emptive enemy attack before "Fight!":** today, if the enemy wins initiative they attack — and show up as a row in the Oracle — *before* the player has even pressed the Fight button. Don't roll initiative or start combat until **Fight!** is pushed; the encounter screen before that is a preview/decision point only.
- **"Not ready yet" audit:** some spells always report "not ready yet." Every spell and every piece of equipment must be usable under its proper circumstances — audit all loot, gear, spells, and items that claim to be usable and prove each one actually is (cooldown/readiness logic, class gates, combat-vs-explore gates). Each blocked use must say *why* (ties back to §A).
- **Combat-only potions usable from the Gear page too:** the standard "combat" potions should be drinkable from the gear panel outside combat, not only during a fight.

### E. Store
- **Store stock should be random and floor-appropriate** — items rolled for the current depth rather than a fixed list (`engine/economy.js#openStore` builds `state.store.stock`; stock entries are plain data with `effectId`).

## Candidate scope (to be broken down at milestone planning)
1. **Combat feedback pass** — red enemy-hit toasts, "X of N hits" aggregation for multi-attack foes, explicit you-miss / they-miss wording, varied fledgling-adventurer miss narration (voice-safe corpus).
2. **Effect legibility pass** — every spell/scroll/weapon/item/racial/class/sub-class effect emits an event with an `EVENT_NARRATION` line and a visible toast/log entry, including *blocked* actions (can't equip / can't strike, with the reason).
3. **Feature audit + rules fixes** — Wizard attack-spell rule; audit of all class/sub-class/racial features for "feels horrible" behaviors; each fix ships with feedback.
4. **Inventory integrity** — item-carried armor durability; single bag-cap gate; bigger bags in loot; Cloak of Armor rework; G16 monster-squares + Amulet of Stone.
5. **UI feel** — gear panel Use/Drop layout + drop confirm; map recenter on panel return; default zoom midpoint; tutorial off/on setting.
6. **Store stock** — depth-appropriate random inventory.
7. **Combat start & usability** — initiative/first-strike only after Fight! is pressed; "not ready yet" audit proving every usable spell/item/gear piece is usable in its proper circumstances; combat potions usable from the Gear page.

## Constraints / interactions
- **Engine gate applies as always:** pure/deterministic engine, parity byte-identical for solo/empty-party play, new rng draws only behind new-feature guards, new serialized fields carved out in all 3 `*Comparable()` fns, every new event type gets an `EVENT_NARRATION` entry. Random store stock and loot-table bags are new rng draws → guard them.
- **Balance web:** Wizard rule, cloak rework, bag caps, and store randomness all touch power/economy — land them *after* v1.1's single consolidated retune (Phase 21) and expect a small feel-check DR round, not a full retune.
- **Voice:** miss/feature/effect narration is core identity — sarcastic, deadpan, family-friendly; runs through `test/voice/safety-scan.test.js`.
- **Working method:** GSD phases for the systems work (feedback events, inventory fixes, store), on-device DR rounds for the UI-feel items (gear panel, zoom, recenter, tutorial toggle).
