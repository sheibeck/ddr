# Phase 39: Gear, Magic Items & One-Shot Tools - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run, `defer uat to end`) — 3 grey areas, one batched question; all three answered by the user (Area 2 and 3 with their own wording, recorded verbatim below). No research pass (roadmap flag: standard/precedented; user's per-run research policy).

<domain>
## Phase Boundary

Weapons and armor become real trade-offs instead of "highest dice you can afford" (GEAR-01, with a before/after ledger). Every item that does something when used follows ONE activation model on Phase 36's `c.timers` — use → effect that counts down in squares with a condition chip → cooldown in squares before it can be used again; charged items recharge every X squares; consumables are one-shot with an effect that lasts X squares (GEAR-02). Three new one-shot tools — rope, ladder, torch — each answer exactly one hazard, are consumed on use, appear as loot and store stock at depth-appropriate tiers, and are offered at the hazard's decision point (GEAR-05).

Requirements: GEAR-01, GEAR-02, GEAR-05.

Out of scope here: spells and scrolls (Phase 40), the map reveal/timed-light rework (Phase 41 — the torch only interacts with `c.darkFor` darkness, not the reveal radius model), the tuning bot's tactics for *when* to pop an item (Phase 42, but see the GEAR-01 bot-policy note — the bot must at least *buy/equip* under the new axes so the ledger is honest), the store restyle, haptics.

</domain>

<decisions>
## Implementation Decisions

### Standing rulings that bind this phase
- **Greenfield, no legacy paths (user, 2026-09-17):** new rules are the only rules. No `if (c.timers)`/`if (it.cd)` dual paths, no shell-only `newRun` options. Where a change moves a parity fixture, DECLARE the divergence (before/after rationale) and regenerate exactly that fixture — never a blanket regeneration. `test/parity/prototype-master.js.txt` is never edited; new serialized fields are carved out of all three `*Comparable()` fns in `test/parity/harness/comparables.js` AND the three local duplicates (combat/magic/movement-parity tests). Old saves get a tolerant load only (`it.usedAt`/`c.haste`-style fields dropped or folded into `c.timers` deterministically; no card). The bot plays the new rules.
- **Deferred UAT:** no device pauses; every plan's SUMMARY carries a "Human verification (deferred to end of run)" section; the last plan aggregates the phase's Pixel 7 checklist.
- **Rail is the one feedback surface**; new cards only for decisions/big updates, minor events are narrative lines only. Every new event type needs `EVENT_NARRATION` (`src/browser/eventNarration.js`) + `TOAST_FOR` (`src/browser/toasts.js`, the narrative-line table) + rail entries; guards `toastsCoverage.test.js` / `formatEventsCoverage.test.js`; voice scan `test/voice/safety-scan.test.js`.
- **Depth-20 tuning target**; the v1.5 BEFORE pin (`docs/class-pass/v15-before*.json`) is the yardstick — the ONE consolidated AFTER matrix is Phase 42, so this phase's ledger records the *design* before/after and a bot smoke run, not a full retune.

### Area 1 — GEAR-05 tool decision point: **Both: pre-roll card + retry card** (user-chosen, recommended)
- Stepping onto a climbable wall while carrying a **ladder**, or onto a gorge/crevice while carrying a **rope**, PAUSES before any roll on a rail decision card: `USE LADDER` / `CLIMB IT` (wall) or `USE ROPE` / `LEAP IT` (gorge). Choosing the tool consumes it and passes the tile with **no roll and no fall damage**; the other button runs today's synchronous roll. No card when the matching tool is not carried — fixtures and the bot (no tools) see byte-identical movement.
- The same `USE LADDER` / `USE ROPE` button is added to the existing post-fall **CLIMB IT retry card** (`rail.pending.kind === "climb"`, `mazeworld.html` ~6225) when the tool is carried — you fell, you're still standing there, the tool is the way past.
- **Torch:** lights darkness. When `fallDark` sets `c.darkFor` (30 squares, `engine/encounters.js:630`), the darkness card gets a `USE TORCH` button if one is carried; a torch can also be used from the Gear tab / ITEMS while `inDark(state)`. Using it clears the current darkness (`c.darkFor = 0`, `darknessDispelled`-style event) AND grants a lit effect of N squares (during which a new `fallDark` is suppressed — "you're carrying a light"). Torch used while not dark → refusal, not consumed. Torches are the one tool with an *effect timer* (Area 2 model); rope/ladder are instant.
- Engine shape: a pure pre-check in `engine/movement.js` (before the climb/leap block) that, when the tile is `climb`/`gorge` and the matching tool is carried and no `state.pendingHazard` decision has been made, emits `hazardChoice { feat, dir, tool }` and stops WITHOUT moving or rolling; a new action `useTool { kind, dir }` consumes the tool and moves; `move(dir)` again (the CLIMB IT / LEAP IT button) sets a one-shot "declined" flag so the roll runs. Planner decides the exact flag/pending shape — the requirement is: zero new rng draws on the no-tool path, roll order unchanged when the player declines.
- Tools are bag items with a new `kind: "tool"` (`{ kind: "tool", tool: "rope"|"ladder"|"torch", n, txt }`), one bag slot each (bag cap applies), never stack; the Lockpicks `kind: "picks"` row (`engine/items.js:159`) is the 1:1 precedent for a bag item that gates a check.
- **Availability (orchestrator assumption, planner may tune numbers, not the shape):** store stock — Torch from depth 0 (~25 wilmst), Rope from depth 0 (~60), Ladder from depth 1 (~150), each offered like the lockpick row in `engine/economy.js` (`add(...)` with a stowing effect) and only when not already carried; loot — a tool row in `rollTreasureItem` at low odds, weighted to the hazard density of the depth (torch commonest). One of each in the bag at most (a second is refused/bagged like a second lockpick set — follow the picks precedent).

### Area 2 — GEAR-02 one activation model: user's ruling, verbatim
> "Every activated item gets an effect that counts with chip. The effect lasts for x (number of squares moved), upon expiration the cooldown is x number of squares before reuse is available. Items with charges recharge every x squares. Consumables are one time uses that effect last for x squares. Staves, cloaks, jewelry, everything that has an effect on use."

Applied:
- **Three item classes, one table shape.** Every activatable row (`content/treasure-tables.js` JEWELRY/CLOAKS/STAVES, `content/potions.js`, the torch) declares its activation explicitly:
  - **Duration + cooldown** (`{ effect: X, cd: Y }`, both in squares): cloaks/jewelry with a `use` — the canon `every: N` becomes the cooldown and the canon duration (invis 100, haste 50, ether 20, flying 20 …) becomes the effect; instant effects (`half`, `stone`) have `effect: 0` and only a cooldown.
  - **Charges** (`{ charges: N, recharge: X }`): **staves** — they have NO cooldown today (`itemReady` is always true when `every` is absent: infinite Pine Staff fireballs). Each staff gets a small charge pool (planner picks per staff, 1–3; Pine/Cedar/Oak the scarcest) that refills one charge every X squares; a staff at 0 charges shows the recharge countdown and refuses with a named reason.
  - **Consumables** (`{ effect: X }`, consumed on use): potions with a duration (Speed 50, Strength 25, Enlarge 50, Acuteness d8 *rounds* → keep the canon roll but express it in the timer's `cadence: "rounds"`, Invisible 100); instant potions (Healing, Xtra Healing, Cure Poison/Disease, Death) stay instant with no timer. Torch = consumable with a lit effect.
- **One representation:** every live effect and cooldown is a `c.timers[id]` record (Phase 36 `engine/effects.js`: `startEffect`/`startCooldown`/`tickSquares`/`tickRounds`/`remaining`/`isReady`), keyed `item:<name>` (effect/cd) or `charges:<name>`. **Retire** `it.usedAt`/`it.every`-based `itemReady`, and the scattered counters `c.haste`, `c.invis`, `c.ether`, `c.acute`, the `flyLeft`-style fields and `c.might` from potions (Strength/Enlarge become timed effects read through `eff()`/derived — today `c.might += 8` never expires, which is a bug the canon text "25 squares" contradicts). `itemReady(state, it)` keeps its name and callers but reads the timers. Members' worn items follow the same records on the member sheet if they can use items (planner checks; if members never use items, say so and skip).
- **Chips:** `conditionsOf(state)` (`engine/derived.js:351`) enumerates one chip per live item effect ("Haste · 23") and one per cooling item ("Cloak of Speed · cd 41") and one per recharging staff ("Pine Staff · 1/3 · 17"); the Gear tab / ITEMS submenu rows show the same remaining numbers and READY, mirroring the Phase 38 ability rows (READY / N ROUNDS). Tapping a chip explains it (existing behaviour).
- **Fixtures follow:** the magic/movement/economy fixtures that use an item or drink a potion WILL move (the timer records replace the counters; Strength now expires). Declare each in `test/parity/FIXTURE-INVENTORY.md` with the before/after and regenerate only those. The Phase 37 `docs/GEAR-SLOTS.md` inventory of `eff()` call sites is the map for the counter retirement.

### Area 3 — GEAR-01 gear axes: **option 1 (new axes on weapons AND armor, prices rebanded)** with the user's correction
> "The problem with - to hit is that our current hit ranges are lowest never hits. A range of 1-6 is a hit with a to hit penalty is brutal at low levels. But still seems best. Remember, that would make it a + to hit as a penalty instead of minus. So, go with option #1"

Applied:
- **To-hit is a LOW range** (a strike lands on `roll <= need`, `need` is 3–5 by class, `engine/derived.js toHit`). Follow the Phase 31 convention (`afraidNeed`): **a weapon's to-hit modifier changes the NEED, never the roll** — a light weapon's bonus is `need + 1`, a heavy weapon's penalty is `need − 1`, floored at 1 (the user's "+ to hit as a penalty" is the same arithmetic seen from the die; document the equivalence once in the ledger so nobody re-litigates it). Magnitudes are **±1 only**; the planner may give at most the two heaviest pole arms −2 and must show in the ledger that no class at its base need can be pushed below 2 by a weapon it is allowed to wield. Keep it brutal-but-fair: heavy weapons are expensive, so a level-1 hero rarely faces the penalty.
- **Crit range:** today `roll === 1` doubles damage (Soldier 1–2). Weapons get `crit: 1|2` — precise blades (Rapier, Katana, Wakazashi, Ninja-to, Dagger) crit on 1–2; everything else stays 1. Soldier's 1–2 stacks to 1–3 with a precise blade (cap 3).
- **Armor bulk:** `bulk: 0|1|2` — Cloth/Leather 0, Studded 1, Mail 1, Plate 2 — subtracted from the climb/leap roll comparison the way `heightsPenalty`/`waterPenalty` already are (`engine/movement.js:55-58`, added to `r`), and from the flee roll and the Thief skill checks that Stealth already gates on `c.armor !== "Plate"` (`engine/combat.js:630`) — generalise that hard-coded Plate check to `bulk >= 2`. AR/WP stay the soak axis; bulk is what you pay for it.
- **Rebanding:** re-price and re-band so every store weapon band (`content/store-stock.js STORE_WEAPON_BANDS`) offers 2–3 genuinely different picks per class — e.g. within one band a d10 heavy (−1 need), a d8 neutral, a d6+1 precise (+1 need, crit 2). Add/remove/rename rows as needed (the tables are ours; frozen fixtures only pin the *items the fixtures roll*, so a row that a fixture rolls and you remove/rename is a declared divergence, not a reason to keep it). Depth availability via the existing bands + `STORE_ARMOR_CAP`.
- **Ledger:** `docs/GEAR-BALANCE.md` — before/after tables (dice, expected damage, need mod, crit, cost, class, band; armor AR/WP/bulk/cost), the per-class "best pick" analysis before (single) and after (a choice per band), and a short tuning-bot smoke (400-seed, the bot updated to weigh expected-damage × hit-chance under the new need mod, and to prefer bulk 0–1 as a Thief) against the v1.5 BEFORE pin. NOT a retune — Phase 42 owns the AFTER matrix.

### Claude's Discretion (planner)
- Exact effect/cd/charge/recharge numbers per item — start from canon durations and `every` values; write every number into the ledger.
- The pending-hazard state shape and action names; the chip label format; the torch's lit-effect length (suggest 40 squares — longer than one darkness).
- Plan split; suggested waves: (1) GEAR-01 tables + axes + ledger + bot policy, (2) GEAR-02 timer model on `c.timers` + counter retirement + chips + fixtures, (3) GEAR-05 tools + hazard decision cards, (4) shell surfaces + phase gate + aggregated Pixel 7 checklist.

</decisions>

<code_context>
## Existing Code Insights (verified 2026-09-18)

- `content/weapons.js` — `WEAPONS` (24 rows `{ dice, lab, cost, cls, halve? }`), `WEAPON_MAX`, `WEAPON_TYPE_TABLE`; `content/armors.js` — `ARMORS` (5 rows `{ name, cost, wp, ar, cls, min }`), `MAGIC_ARMOR_TABLE`; `content/store-stock.js` — `STORE_WEAPON_BANDS`, `STORE_ARMOR_CAP`, `STORE_POTION_POOL`, `STORE_PREMIUM_BONUS`.
- `content/treasure-tables.js` — `JEWELRY_ROWS`/`CLOAKS_ROWS`/`STAVES_ROWS` (`use`, `every`, `eff`, `aoe`), `dropSlot` strips the Phase 37 `slot` into `SLOT_OF`; `content/potions.js` — `POTIONS` (`eff`, `uses` dice, `txt` states durations in squares).
- `engine/items.js` — `itemReady(state, it)` (`state.steps - it.usedAt >= it.every`; **always true for staves**), `useItem(state, ref, rng, events)` refusal ladder (pending fight → … → `cooldown` reason), effect switch at ~1000 (`c.haste = 50`, `c.acute = rng.d(8)`, `c.invis = 100`, `c.ether = 20`, `c.might += 8/4` never expiring, `c.halfNext`, `c.ward` dome), `TARGETED_KINDS`, `rollTreasureItem` (lockpick row at d12 === 1), `hasPicks`, `bagCap`/`slotItems`.
- `engine/effects.js` (Phase 36) — `c.timers[id] = { cadence, left, cd?, phase }`, `startEffect/startCooldown/tickRounds/tickSquares/remaining/isReady/clearRoundTimers`; tick sites already wired per step (movement), `foeTurn` tail, `endCombat`. Phase 38 keys abilities `ability:<key>`.
- `engine/movement.js:135-210` — the climb/leap block runs synchronously on entering the tile: `isFlying`/`ether` skip; `CLIMB_TABLE[kind]` d10 per 10 ft, `LEAP_TABLE` by class; `heightsPenalty`/`waterPenalty` added to `r`; fall damage through `scaleHazard`. `:268-290` darkness tick + Amulet of Light dispel (`darknessDispelled`/`darknessLifted`).
- `engine/encounters.js:630-660` — `DARKNESS_DURATION = 30`, `fallDark` sets `c.darkFor`; `inDark(state)` in derived.
- `engine/derived.js` — `toHit(state)` (low range, `eff(c,"toHit")`, dark clamps to 2), `afraidNeed` (the "penalty shrinks the need" convention), `conditionsOf(state)` (chip descriptors), `eff()` two-path worn/bag sum (Phase 37).
- `engine/combat.js:533-566` hero strike `roll <= need`; `:630` Stealth gate `c.armor !== "Plate"`; `:841`/`:2374` crit `roll === 1 || (roll <= 2 && Soldier)`; Phase 38 `abilityStrike` descriptor already carries `forceCrit`/`autoHit`.
- `engine/economy.js:288-350` store offer builder (`add(label, price, effectName, params, why)`), lockpick row `giveLockpicks`, `STOWING_EFFECTS`.
- Shell: `mazeworld.html` ~6225 CLIMB IT retry card (`rail.pending.kind === "climb"`, `window.move(pend.dir)`), ~1366 condition-chip strip (`paintConditions()`, one chip per `conditionsOf` descriptor, tap explains), Gear tab rows (Phase 37 worn rows with [Use]/[Unequip]), ITEMS combat submenu (`src/browser/combatMenu.js`, Phase 38 ability rows READY/N ROUNDS are the row-state precedent); `src/browser/rail.js:91` `climb: { retry: "CLIMB IT" }` copy.
- Tuning bot: `tools/` — buys/equips by class gating + cost; must learn the new axes for the GEAR-01 smoke (`tools/` was untouched in 36–38; touching it now is expected and is NOT a BEFORE-pin violation — the pin is the committed JSON).
- Tests: 2563 green at `d117782`; parity master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

</code_context>

<specifics>
## Specific Ideas

- Tool card copy stays in voice: "A ladder. Someone thought of everything, and it was you." / "Rope: the honest way across." / "You light the torch. The dark files a complaint." — write the lines, run the voice scan.
- The cooldown refusal for items mirrors the Phase 38 ability refusal shape ("{Item}: N squares. It is not a vending machine.").
- Chip explanation on tap: one line naming the item and what's counting ("Cloak of Speed — cooling, 41 squares").

</specifics>

<deferred>
## Deferred Ideas

- Bot tactics for popping items at the right moment → Phase 42.
- Torch vs the reveal-radius / timed-light model → Phase 41 (this phase only touches `c.darkFor`).
- Weapon durability / repair → not in v1.5.
- Unifying the Phase 37 two-path `eff()` → cleanup milestone (don't fold it in here even though the counter retirement touches `eff()` call sites; only touch what the model needs).

</deferred>

---

*Phase: 39-gear-magic-items-one-shot-tools*
*Context gathered: 2026-09-18 via autonomous smart discuss (one batched question, three areas)*
