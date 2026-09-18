# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch closed; see `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.4 Combat & Map Screens** — Phases 34–35 (shipped 2026-09-16, device round closed 2026-09-17; see `.planning/milestones/v1.4-ROADMAP.md`)
- 🚧 **v1.5 Meaningful Choices — Spells, Gear & Abilities** — Phases 36–43 (current, started 2026-09-17; requirements: `.planning/REQUIREMENTS.md`; research: `.planning/research/SUMMARY.md`)
- 📋 **v1.0 launch tail** — first-run tutorial (UX-06) + Google Play production launch (STR-01..04, STR-06); deliberately deferred until after v1.5's Gear/Hero-screen changes settle (a tutorial built now would need a redo)
- 📋 **Next tuning pass** — TUNE-06 roster decision + TUNE-07 human DR round; explicitly deferred out of v1.3 by user decision 2026-09-15 (`docs/DIFFICULTY-RETUNE.md`)

## Engine Gate (non-negotiable, every phase — carried from v1.1–v1.4, extended for v1.5)

Every phase in this milestone touches serialized character/combat/floor state and/or introduces new RNG draws (ability rolls, item cooldown draws, water-blob generation, Cutthroat murder checks). The gate, carried from `STATE.md` and `PROJECT.md`:

- Engine stays pure/deterministic.
- Parity stays byte-identical for every existing fixture, bot, and old save against the frozen `test/parity/prototype-master.js.txt`.
- Every new RNG draw is added strictly **after** all existing draws in its function and fires only **behind a feature condition false for every current fixture** — the `state.storeRoll` run-flag precedent (Phase 33) is the exact template for anything new in `genFloor` (water blobs) and is the model for any other new-run-only draw (Cutthroat murder check, ability rolls on load of an old save, etc.).
- Every new serialized field (worn-slot map, ability cooldowns, item use/cooldown timers, terrain flags) is carved out of all three `*Comparable()` functions (`test/parity/harness/comparables.js`) and round-trips through save/load tolerant of saves that lack the field.
- `test/parity/prototype-master.js.txt` is NEVER edited.
- Every new event type gets an `EVENT_NARRATION` entry AND a toast-table entry — the coverage guards (`toastsCoverage.test.js`, `formatEventsCoverage.test.js`) stay green every phase, not just in the Clarity phase.
- Deliberate canon divergences (Detect Magic duration, flee odds, phobia triggers, item cooldowns, Cutthroat's Joiner reversal, Elven-style rule flips) are declared **per phase** with a rationale and, where a fixture is affected, a documented before/after table — never a blanket fixture regeneration.
- The prototype master (`mazeworld.pdf` reference, `test/parity/prototype-master.js.txt`) is never edited.
- Every new line of copy (ability roll flavor, item-use flavor, Cutthroat murder lines, phobia cause text) passes the family-friendly sarcasm voice-safety scan and a human tone read — dark wit, never profanity/gore/adult content.

**Explicitly out of this milestone** (per `PROJECT.md`'s v1.5 "Out of this milestone" list): the v1.0 launch tail (UX-06 tutorial, STR-01..04/06 production launch), the deferred tuning pass (TUNE-06/07), the store screen restyle to the dark vocabulary, a dice-mode setting, haptics polish, and the climb dice payload (`roll`/`need` on the four climb events) carried over from v1.4. None of these get a v1.5 phase.

## Phases

### 🚧 v1.5 Meaningful Choices — Spells, Gear & Abilities (In Progress)

**Milestone Goal:** Every spell, item, skill, phobia and piece of gear does something you can feel and choose between — no budget picks, no dead phobias, no silent causes — with the gear/target/ration UI made honest to match.

- [x] **Phase 36: Balance Foundation, Effect Timers & Small Independent Wins** - The BEFORE class-matrix pin is captured before any new power lands, a general-purpose effect/cooldown/timer model exists for later phases to build on, dead foes can never be targeted, Cutthroats can accept (and occasionally lose) a Joiner, and any hero can dismiss one from the Company panel. (completed 2026-09-17)
- [x] **Phase 37: Equipment Slot Model & eff() Refactor** - One worn item per slot type, with a narrated migration for any old save that illegally has two — the widest-blast-radius change in the milestone, landed alone. (completed 2026-09-17)
- [x] **Phase 38: Melee Active Abilities** - Fighters and Thieves get a rolled pool of class-flavored active abilities with cooldowns, plus select passive skills converted to actives, all surfaced in the combat ABILITIES submenu. (completed 2026-09-18)
- [ ] **Phase 39: Gear, Magic Items & One-Shot Tools** - Weapons/armor are rebalanced for real trade-offs, every activatable magic item follows one use-effect-cooldown model, and rope/ladder/torch give players a consumable answer to a specific hazard each.
- [ ] **Phase 40: Spell Rework** - Combat spells are differentiated by niche instead of a damage ladder, every utility spell has a felt effect, every Wizard sub-class starts with a damage spell, Detect Magic is renamed and time-boxed, and scribed scrolls are instantly castable.
- [ ] **Phase 41: Terrain, Darkness & Phobias** - Water squares cost extra movement and can scare swimmers, a dark square fogs the view to a 3×3 window, and every phobia has a real, once-per-entry trigger.
- [ ] **Phase 42: Flee Retune & Consolidated Balance Close** - Flee odds are lower and shown transparently, and the ONE consolidated AFTER class-matrix run verifies abilities + gear + spells together against the depth-20 target.
- [ ] **Phase 43: Clarity Pass** - Every costly line names its cause, every loot offer shows who can use it, ration math is honest, and the Gear screen splits into ON YOU and BAG.

<details>
<summary>✅ v1.4 Combat & Map Screens (Phases 34–35) — SHIPPED 2026-09-16 (device round closed 2026-09-17)</summary>

Full details: `.planning/milestones/v1.4-ROADMAP.md`.

- [x] Phase 34: Combat Screen Rebuild - The encounter panel becomes the mock's full-screen layout (header, foes, YOUR LOT, › log, four-action bar with submenus), with the Fight! gate and the loot/flee/death endings folded into the same screen, engine untouched, validated on the Pixel 7. (completed 2026-09-16)
- [x] Phase 35: Map Screen Rebuild - The map tab becomes the mock's column: HUD + condition chips, tap-to-step viewport (no D-pad), the bottom rail that replaces every toast and carries every decision, the major overlay for encounters/descents/death, and the MARKS/CENTRE/MAKE CAMP chips with their sheets — engine untouched, validated on the Pixel 7. (completed 2026-09-16)

</details>

<details>
<summary>✅ v1.3 Feel, Loot & Combat Flow (Phases 28–33) — SHIPPED 2026-09-16 (device UAT batch pending; UIF-04 dropped to UX-06)</summary>

Full details: `.planning/milestones/v1.3-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.3-phases/`.

- [x] **Phase 28: Armor Integrity & Durability** - Armor behaves exactly as the screen says: the soak-vs-wear rule is audited and decided, durability lives on the item, and every armor outcome is legible (completed 2026-09-15)
- [x] **Phase 29: End-of-Combat Loot & Bag Cap** - Foe drops become a real, presented decision after combat, gated by one consistent bag-cap system, with bigger bags as a treasure path (completed 2026-09-15)
- [x] **Phase 30: Combat Narrative & Input — Research** - A written, decision-ready survey of combat-feedback UI patterns exists, with a recommended design for this game's combat flow agreed before any implementation begins (completed 2026-09-16)
- [x] **Phase 31: Combat Start Gating & Effect Hygiene** - Combat only truly starts on Fight!, every refusal explains itself, and every consumable/condition behaves and expires honestly (completed 2026-09-16)
- [x] **Phase 32: Combat Narrative & Input UI Build** - The chosen combat-feedback design is built — round narrative in one place, one-tap move-on, decision buttons safe from D-pad thumb-spam — then proven on-device (completed 2026-09-16)
- [x] **Phase 33: UI Feel & Store Polish** - Gear panel, map, tutorial toggle, toolbar layout, and store stock all get their remaining polish pass, done once against the finished combat UI (completed 2026-09-16)

</details>

<details>
<summary>✅ v1.2 Class Pass & Mass Playtest (Phases 22–27) — SHIPPED 2026-09-15 (override closeout: TUNE-07 deferred by user)</summary>

Full details: `.planning/milestones/v1.2-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.2-phases/`.

- [x] **Phase 22: Class-Aware Harness & BEFORE Matrix** - Force any class/sub-class/race through the bot with a sub-class-aware policy, print a ranked 144-combo matrix, and capture the BEFORE snapshot before any identity change lands (completed 2026-09-14)
- [x] **Phase 23: Casters Can Act** - Fix the three "cannot act" states and guarantee every fresh Magic User a day-one attack spell (completed 2026-09-14)
- [x] **Phase 24: Every Sub-class and Race: One Good, One Bad** - Every sub-class and race gets a code-verified good and bad, flavor text matches the mechanics, and an identity-contract test proves it (completed 2026-09-14)
- [x] **Phase 25: Nothing Happens Silently (Feature Feedback)** - Every class/sub-class/racial feature that fires or blocks is narrated in the Oracle and as a toast; enemy hits are unmistakable from player hits/misses (completed 2026-09-15)
- [x] **Phase 25.1: Device Feedback Batch** - Card only for decisions/big updates, minor events toast-only, Oracle fills the screen, Joiner swap with snark, Joiners fight by class, camp refusal states the numbers (completed 2026-09-15)
- [x] **Phase 26: Mass Playtest & Class-Pass Ledger** - An AFTER matrix on the post-pass engine ranks over/under-performers with a fun-band verdict per row, committed to `docs/CLASS-PASS.md` (completed 2026-09-15)
- [x] **Phase 27: Delve-to-Death Retune** - The deferred TUNE-04 re-attempt on the corrected player power, closed by a human DR round on the Pixel 7 (completed 2026-09-15; TUNE-07 verdict deferred by user)

</details>

<details>
<summary>✅ v1.1 Monster Balancing & Abilities (Phases 17–21) — SHIPPED 2026-09-14 (override closeout: TUNE-04 retune deferred)</summary>

Full details: `.planning/milestones/v1.1-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.1-phases/`.

- [x] **Phase 17: Fixture Inventory & Foe-Turn Refactors** - Document which bestiary creatures each parity fixture rolls and extract shared foe-turn helpers before any bestiary or ability behavior changes land (completed 2026-09-13)
- [x] **Phase 18: Bestiary Rebalance & Canon Combat Fixes** - Review every creature's stats against its intended depth band and land canon-accurate combat modifiers (armor, half-damage, type multipliers, slow) (completed 2026-09-13)
- [x] **Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance** - Foes cast, drain, debuff, heal, and summon via a data-driven ability system; the player's Intelligence resists incoming foe magic (completed 2026-09-14)
- [x] **Phase 20: Parley Balance & Language System** - Fix parley's payout/spam dominance and wire Language/Helm-of-Knowledge fluency into the same bonus term (completed 2026-09-14)
- [x] **Phase 21: Consolidated Difficulty Retune** - The ONE retune across party power, economy, monster power, ability threat, and parley numbers, closed out by a human DR-round sign-off (completed 2026-09-14)

</details>

<details>
<summary>✅ v1.0 Delve, Die, Repeat (Phases 1–16 + 04.1/04.2) — SHIPPED 2026-09-13 (internal testing)</summary>

Full details: `.planning/milestones/v1.0-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.0-phases/`.

- [x] Phase 1: Engine Extraction & Determinism (10/10 plans) — completed 2026-09-08
- [x] Phase 2: Android Packaging & Native Persistence (4/4 plans) — completed 2026-09-08
- [x] Phase 3: Endless Descent & Difficulty Balance (3/3 plans) — completed 2026-09-08
- [x] Phase 4: Mobile Presentation, Controls & Onboarding (10/11 plans + DR1–DR18) — 04-10 tutorial carried forward (UX-06)
- [x] Phase 04.1: Rules Review & Wiring (6/6 plans) — completed 2026-09-09
- [x] Phase 04.2: Bug Fixes & Text Polish (5 batches) — completed 2026-09-09
- [x] Phase 5: Voice, Content & Graveyard (3/3) — completed 2026-09-09
- [~] Phase 6: Google Play Compliance & Launch — store entry + internal-testing track live 2026-09-10 (STR-05 ✓); production launch carried forward (STR-01..04, STR-06)
- [x] Phases 7–11: Joiners / Party System — completed 2026-09-09 (PARTY-10 retune carried forward)
- [x] Phases 12–16: Economy & Item Balancing — completed 2026-09-10 (deep tuning carried forward)

</details>

## Phase Details

### Phase 36: Balance Foundation, Effect Timers & Small Independent Wins

**Goal**: Before any new player power lands anywhere in v1.5, the class-matrix BEFORE snapshot is pinned; a small, general-purpose effect/cooldown/timer engine (`engine/effects.js`) exists so Phases 38–40 share one timer shape instead of each inventing its own; and two fully independent, zero-dependency wins ship: a dead foe can never be targeted, a Cutthroat can accept a Joiner (with a small, stated murder risk on descent), and any hero can dismiss a Joiner from the Hero tab's Company panel with a confirmation and a parting line.
**Depends on**: Nothing in v1.5 (first phase); builds on the shipped v1.4 engine/state.
**Requirements**: BAL-01, TGT-01, TGT-02, CUT-01, CUT-02, JOIN-01
**Success Criteria** (what must be TRUE):

  1. A committed BEFORE class-matrix pin exists (mirroring `docs/class-pass/before*.json`), timestamped before any other v1.5 change lands, and `tools/tune-classes.mjs` runs cleanly against the current engine.
  2. In a multi-foe fight, killing a foe immediately makes the next living foe the target; tapping a downed foe's card does nothing, and the auto-switch never races a guarded tap into a mis-target.
  3. A Cutthroat player who meets a Joiner sees an acceptance offer (the old refusal is gone) and the sub-class blurb matches the new behavior.
  4. Each descent with a Joiner as a Cutthroat carries a small, stated chance the Joiner turns up murdered, narrated with its own event type and several sarcastic lines.
  5. The Hero tab's Company panel shows the Joiner's sheet (class/sub/race, HP, weapon, "eats N a rest") and a DISMISS control that asks for confirmation; on confirm the Joiner leaves with a sarcastic parting line of their own and the party slot is free.
  6. `npm test` is green and the engine/content/parity diff is empty; `engine/effects.js` has no player-visible behavior yet — it exists so later phases don't each build a bespoke timer.

**Plans**: 6 plans

Plans:
**Wave 1**

- [x] 36-01-PLAN.md — BAL-01 v1.5 BEFORE class-matrix pin (both runs, ledger section, additive guard) — wave 1, before any engine change

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 36-02-PLAN.md — engine/effects.js timer model + guarded tick sites + load tolerance + parity carve-out (no records created) — wave 2

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 36-03-PLAN.md — TGT-01/02 normalizeTarget export, shell post-dispatch normalize, inert dead cards, arm-window race test — wave 3
- [x] 36-04-PLAN.md — CUT-01/02 Cutthroat Joiner reversal, one guarded d20 murder check, six lines, blurb + identity row — wave 3

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 36-05-PLAN.md — JOIN-01 dismissJoiner engine action + parting/refusal narration, toast and rail entries — wave 4

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 36-06-PLAN.md — JOIN-01 Company sheet + two-tap DISMISS + bridge, SUB_NOTE sync, phase gate + aggregated deferred checklist — wave 5

**Cross-cutting constraints:**

- npm test prints '# fail 0'; fixtures untouched; master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0

**Research flag**: Standard/precedented (research: both changes are fully specified by existing code precedent — display suppression already correct, the Cutthroat refusal ternary already isolated, the effects-model shape is fully specified from existing `c.ward`/`f.cd`/`c.darkFor` precedents). `--research-phase` optional; the Cutthroat murder-odds value is a small balance call that can be settled directly in the plan.

### Phase 37: Equipment Slot Model & eff() Refactor

**Goal**: A player can wear only one item per slot type (ring, bracelet/anklet, amulet/pendant, helm/gauntlet, cloak, staff); equipping into an occupied slot is an explicit swap, not silent stacking; old saves with an illegal double-equip are reconciled on load without a crash or a silent loss. This is the widest-blast-radius change in the milestone (15+ `eff()` call sites) and lands alone, fully regression-tested, before magic items or the Gear-tab split depend on it.
**Depends on**: Phase 36 (shares the milestone's serialization/parity conventions; no hard code dependency).
**Requirements**: GEAR-03, GEAR-04
**Success Criteria** (what must be TRUE):

  1. Equipping a second ring/cloak/staff/bracelet while one of that type is already worn prompts an explicit swap choice instead of silently stacking both.
  2. A player's total bonuses (armor, magic effects) reflect only the currently worn one-per-slot set — no double-counting from two copies of the same slot type.
  3. Loading a save created before this phase that illegally has two items of one slot type does not crash; the extra item is narrated into the bag on load.
  4. Every pre-existing gear/`eff()` code path (armor, weapons, potions) behaves identically to before for any save or fixture that was already slot-legal.

**Plans**: 4 plans

Plans:
**Wave 1**

- [x] 37-01-PLAN.md — slot taxonomy (authored on content rows, exported byte-identical + SLOT_OF) + `c.worn` model helpers (WORN_SLOTS/slotFor/carriedItems/reconcileWorn) + two-path `eff()` + bag ∪ worn lookups + `stripWornField` carve-out + pinned legacy-equivalence and invariant tests — wave 1

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 37-02-PLAN.md — `equipItem`/`unequipSlot` six-slot branches (direct swap, `replaced` payload, staff class gate, `bagFull`), auto-wear on take, `useItem { slot }` + `useRefused notWorn`, action validation, toast/Oracle copy, refusal-ledger row — wave 2

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 37-03-PLAN.md — `newRun({ wornSlots })` shell-only option, option-gated load migration + returned reconciliation report + tampered-`worn` tolerance, engineAdapter plumbing (`takeBootWornReport`), rail reconciliation copy/card, combat ITEMS worn rows — wave 3

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 37-04-PLAN.md — shell: classic `eff` routing, Gear-tab worn rows, EQUIP + two-tap swap confirm, `mzUseItem`/`COMBAT_DISPATCH` slot forms, resume-time reconciliation rail card + Oracle line; `docs/GEAR-SLOTS.md` canon ledger; phase gate + aggregated Pixel 7 checklist — wave 4

**Research flag**: Standard shape (research: the worn-slot model and refactor scope are already mapped file-by-file in ARCHITECTURE.md). No `--research-phase` needed — this phase's risk is regression breadth, not design ambiguity; plan carefully around every `eff()` call site.

### Phase 38: Melee Active Abilities

**Goal**: Combat is more than pressing STRIKE for melee classes — Fighters and Thieves get activated combat abilities with cooldowns, a class-flavored ability pool is rolled (never chosen) at level 1 and every skill level, a chosen subset of existing passive Special Skills converts to actives, and everything is legible and usable from the combat ABILITIES submenu.
**Depends on**: Phase 36 (the effects/cooldown model this phase's `c.abilityCd` map extends).
**Requirements**: ABIL-01, ABIL-02, ABIL-03, ABIL-04, ABIL-05
**Success Criteria** (what must be TRUE):

  1. A Fighter or Thief opens the ABILITIES submenu mid-combat and sees at least one usable ability with a clear "ready" / "N rounds" state.
  2. Trying to use an ability on cooldown produces a named refusal in the fight log, never a silent no-op.
  3. A fresh level-1 Fighter/Thief already has a rolled ability; each skill-level gain can add another, narrated when it happens.
  4. Every sub-class that had one code-verified good and one bad (Phase 24) still has both after any of its passive skills converts to an active — the identity-contract suite is updated in this same phase, not deferred.
  5. A melee-class Joiner in the party uses its own abilities in combat by the same class-driven policy Joiners already fight with.

**Plans**: 5 plans (sequential waves 1-5)

Plans:
**Wave 1**

- [x] 38-01-PLAN.md — Reshaped skills tables (positions/costs preserved) + FREE_SKILL same-position repoint, the 20-entry `content/abilities.js` catalog, derived rng stream, `c.abilities` + level-1/level-up/Joiner pool rolls + tolerant load, parity carve-out and the 20 declared chargen-field divergences

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 38-02-PLAN.md — Retire every old passive read (Tracking/Language/Climbing/Leaping dropped; Agility/Death-touch/Kata/Silence converted), the transient `abilityStrike` descriptor in `playerStrike`, timer-driven need shifts in the twin need functions, identity-contract updates + the SC-4 guard

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 38-03-PLAN.md — `engine/abilities.js` `useAbility { key }` dispatcher (named refusal ladder, cooldowns on `c.timers`, all 20 effect resolutions on existing hooks), foe-side hooks in `foeTurn`/`pickFoeTarget`/`applyFoeDamageToPlayer`/`flee`, action registration, narration for every new event

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 38-04-PLAN.md — Joiners use their own abilities by the class policy (opener round 1 / damage above half / defensive below half) through shared primitives, member timers on the sheet with per-member tick/clear sites, party-wide Battle Roar

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 38-05-PLAN.md — Combat ABILITIES submenu rows (READY / N ROUNDS / ONCE A FIGHT · USED, tappable on cooldown), shell dispatch bridge, Hero-tab abilities list, first-paint pool rail card, fight-report learned line, ledger close, phase gate + aggregated Pixel 7 checklist

**Research flag**: Yes — which specific Special Skills convert to actives (vs. staying passive) is a per-skill judgment call against the `docs/CLASS-PASS.md` good/bad identity-contract table; start with a small (2–3 skill) initial set. Recommend `/gsd-discuss-phase` or `--research-phase` before planning.
**UI hint**: yes

### Phase 39: Gear, Magic Items & One-Shot Tools

**Goal**: Weapons and armor are reworked so store and loot present meaningful trade-offs instead of one best pick per class; every activatable magic item (cloaks, staves, rings/jewelry, potions with a duration) follows one model — use → effect for X → cooldown for Y; new one-shot tools (rope, ladder, torch) each answer exactly one hazard and are consumed on use.
**Depends on**: Phase 36 (effects/cooldown model, for item duration-then-cooldown pairs), Phase 37 (worn-slot model, for magic items that occupy a slot).
**Requirements**: GEAR-01, GEAR-02, GEAR-05
**Success Criteria** (what must be TRUE):

  1. Store and loot tables show differentiated weapon/armor choices per class rather than a single best pick, recorded in a before/after ledger.
  2. Using an activatable magic item (cloak/staff/ring/potion) shows its effect-remaining, then its cooldown-remaining, as a condition chip until it's usable again.
  3. Facing a pit, an unclimbable wall, or a dark region, a player carrying rope/ladder/torch respectively can consume it at that decision point (e.g. the CLIMB IT rail card) to bypass or ease the hazard; each tool is consumed exactly once.
  4. Rope, ladder, and torch appear as loot and store stock at depth-appropriate tiers.

**Plans**: 5 plans (sequential waves 1–5; `mazeworld.html` touched only by 39-05)

Plans:
**Wave 1**

- [ ] 39-01-PLAN.md — GEAR-01 axes: weapon `need`/`crit`, armor `bulk`, re-diced/re-priced tables (key order pinned), engine reads (toHit/crit/climb/leap/flee/stealth), expected-strike upgrade heuristic, declared fixture divergences (economy + measured combat)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 39-02-PLAN.md — GEAR-01 close: tuning-bot store buy/equip policy on expectedStrike + bulk, 429-run class-matrix smoke vs the v1.5 BEFORE pin, `docs/GEAR-BALANCE.md` before/after ledger

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 39-03-PLAN.md — GEAR-02 engine: `ACTIVATION_OF` content declarations (duration+cd / charges+recharge / consumables), timer-backed `itemReady`/`useItem` on `c.timers`, counter retirement (haste/invis/ether/acute/flight/potion might/usedAt), tick-site narration, `conditionsOf` chips, tolerant save fold, harness carve-out

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 39-04-PLAN.md — GEAR-05 engine: rope/ladder/torch as `kind: "tool"` items (loot via derived rng, store by tier), `pendingHazard` pre-roll decision + `useTool` action, torch lights/holds off `c.darkFor`, narration, `pendingHazard` carve-out

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 39-05-PLAN.md — Shell + close: hazard decision/retry/dark rail cards (USE LADDER / USE ROPE / USE TORCH), `itemRowState` for Gear-tab + ITEMS rows, item chips + tap explanations, engine-routed Hero-tab to-hit, ledger requirements map, whole-phase gate, aggregated Pixel 7 checklist

**Research flag**: Standard/precedented for the item-cooldown extension (research: `itemReady`/`useItem` already has this exact shape; Lockpicks is the existing 1:1 tool precedent). Light discussion optional for GEAR-01's specific weapon/armor rebalance numbers only.

### Phase 40: Spell Rework

**Goal**: Every combat spell is a real situational choice — differentiated by niche (single-target burst, damage-over-time, multi-target, control with a scope/duration axis, defensive), not a damage ladder; every utility spell has a measurable effect and none is a dead pick; every Wizard sub-class starts with a damage spell; Detect Magic is renamed to say what it does and time-boxed; a scribed scroll is castable immediately once its level qualifies.
**Depends on**: Phase 36 (effects/cooldown model, for the timed map-reveal spell kind).
**Requirements**: SPELL-01, SPELL-02, SPELL-03, SPELL-04, SPELL-05, SPELL-06, SPELL-07
**Success Criteria** (what must be TRUE):

  1. Comparing two combat spells of the same level, a player can tell they solve different problems (burst, DOT, multi-target, control, defensive) — each spell's grimoire text states its niche in one line.
  2. Casting any utility spell (heal/ward/might/mirror/senses/foresee/regen/summon/turn/gate) produces an observable effect the player can point to; none is a dead pick.
  3. Every Magic User sub-class's day-one grimoire includes at least one spell that deals damage (Summoner/Illusionist keep their Phase 23 level-1 overrides and additionally qualify).
  4. Casting the renamed map-reveal spell shows the floor for a stated number of steps, then re-fogs only the cells it revealed — cells seen by normal walking stay seen, per the ratified re-fog provenance decision.
  5. A scroll scribed into the grimoire is castable immediately once the caster's level qualifies, or refuses by naming the level needed.
  6. An active Shield's remaining pool and rounds show on the Hero sheet and as a map HUD condition chip, not only mid-combat.

**Plans**: TBD
**Research flag**: Yes — the offense-school niche re-derivation and the control-spell scope/duration axis are genuine design/balance decisions, not mechanical extensions; the Detect Magic re-fog provenance question (does normal exploration during the reveal window keep what it would have revealed anyway, or does everything the spell touched re-fog unconditionally?) must be ratified as a Key Decision before implementation. Recommend `/gsd-discuss-phase` or `--research-phase` before planning.

### Phase 41: Terrain, Darkness & Phobias

**Goal**: Water and darkness become real, felt terrain. Floors can contain multi-square water pools (parity-gated exactly like `storeRoll`); stepping onto water costs 2 moves; a dark square without Night Vision or a light effect shows only the 3×3 area around the party; every phobia (Bodies of water, Darkness, Heights, Being trapped, Death, and the six combat types) fires once on fresh entry into its trigger — never every step inside a region — as the existing Afraid penalty, never a lost action.
**Depends on**: Phase 36 (the `storeRoll` parity-gating precedent this phase's `state.terrainRoll` mirrors). Independent of Phases 37–40 otherwise. Within this phase's own plan sequence, water (TERR-01/02) must land before the phobia triggers that depend on it (TERR-04/05).
**Requirements**: TERR-01, TERR-02, TERR-03, TERR-04, TERR-05
**Success Criteria** (what must be TRUE):

  1. New floors can contain a multi-square blue water pool on the map; every existing fixture, bot, and old save generates identically to before (gated behind a new `state.terrainRoll` run flag, mirroring `storeRoll`).
  2. Stepping onto a water square costs 2 moves, and every squares-based counter or timer (HUD, cooldowns) reflects that cost consistently.
  3. Standing on a dark square without Night Vision or a light effect shows only the 3×3 area around the party on the map; leaving the dark square restores the previously explored view.
  4. Entering water once triggers the Bodies-of-water phobia; a crevice/gorge climb can trigger Heights; a dead end can trigger Being-trapped; near-death can trigger Death — each named in the rail line, firing once on fresh entry rather than every step inside the region.

**Plans**: TBD
**Research flag**: Yes — the `genFloor`/`terrainRoll` parity gate is the single highest parity risk in the milestone (every fixture, bot run, and old save calls `genFloor`); the phase's own plan must include a live fixture-roster scan and an explicit draw-count table before any code lands, mirroring `storeRoll` exactly. Recommend `--research-phase`.
**UI hint**: yes

### Phase 42: Flee Retune & Consolidated Balance Close

**Goal**: Flee is transparently fair — a lower, honestly-shown baseline success rate with the Thief edge kept and small class/race modifiers — and the milestone's ONE consolidated AFTER class-matrix run verifies the combined effect of every power-adding phase (abilities, gear, spells) against the depth-20 target, closing the balance loop BAL-01 opened.
**Depends on**: Phase 38 (abilities), Phase 39 (gear), Phase 40 (spells) — BAL-02 explicitly waits until all three are code-complete. Independent of Phase 41.
**Requirements**: FLEE-01, FLEE-02, BAL-02
**Success Criteria** (what must be TRUE):

  1. Attempting to flee shows the roll, modifiers, and the number needed in the fight log before it resolves.
  2. Base flee success is noticeably below the old 50%, the Thief edge is still meaningfully better than other classes, and a before/after table records the change as a declared canon divergence.
  3. A failed flee still hands every foe its swing, unchanged from today.
  4. One consolidated AFTER class-matrix run (post spells + abilities + gear) reports pick-rates for every new spell/ability and a fun-band verdict per sub-class in `docs/CLASS-PASS.md`; any out-of-band row is tuned or explicitly accepted with a written reason against the depth-20 target.

**Plans**: TBD
**Research flag**: Flee retune is a standard numeric retune of one existing formula — skip `--research-phase`. BAL-02's matrix read may surface out-of-band rows worth a short discussion before accepting or tuning them.

### Phase 43: Clarity Pass

**Goal**: Every cost the player pays names its cause, every loot offer shows who can use it, ration math is honest and matches what Make Camp actually charges, and the Gear screen tells the truth about what's worn versus carried.
**Depends on**: Phase 37 (worn-slot model, for the Gear ON YOU/BAG split) and every earlier v1.5 phase — each should have added its own cause-payload field at the point of introduction (per this roadmap's Engine Gate), so this phase is a sweep, not a retrofit scramble.
**Requirements**: CLAR-01, CLAR-02, CLAR-03, CLAR-04, CLAR-05
**Success Criteria** (what must be TRUE):

  1. A costly Oracle/rail line names its cause in plain language sourced from the event payload — e.g. a Being-trapped phobia line states "Being trapped: four walls and one door you already used. −4 hp."
  2. Every loot offer (encounter-dot find, victory screen, store row) shows "(usable by …)" when an item is class-restricted.
  3. The Hero screen lists rations eaten per rest for the hero and each Joiner and the total, matching what Make Camp actually charges — the race/class ration rules are audited against the prototype/rulebook and recorded in a ledger.
  4. The Gear screen is two panels — ON YOU (Worn: armor, cloak, jewelry · Carried: weapon, staff, shield) and BAG — and the bag-full drop prompt lists bag items only.
  5. `toastsCoverage.test.js` and `formatEventsCoverage.test.js` stay green — no cause string bypasses the coverage guard.

**Plans**: TBD
**Research flag**: Standard wiring/display sweep — skip `--research-phase`. Verify each earlier phase actually added its cause payload at introduction rather than retrofitting all of it here.
**UI hint**: yes

<details>
<summary>v1.4 phase details (34–35) — archived, see `.planning/milestones/v1.4-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.4 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.3 phase details (28–33) — archived, see `.planning/milestones/v1.3-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.3 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.2 phase details (22–27) — archived, see `.planning/milestones/v1.2-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.2 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.1 phase details (17–21) — archived, see `.planning/milestones/v1.1-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.1 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.0 phase details (Phases 1–16 + 04.1/04.2) — archived, see `.planning/milestones/v1.0-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.0 live in the archived roadmap, not duplicated here.

</details>

## Deferred / Not This Milestone

- **UX-06** first-run tutorial — deliberately last, once the UI (now including v1.5's Gear/Hero changes) settles.
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout).
- **TUNE-06/07** human DR round of the difficulty retune and the tier-3/5 roster decision (`docs/DIFFICULTY-RETUNE.md`).
- Store screen restyle to the dark vocabulary.
- Dice-mode setting.
- Haptics polish.
- Climb dice payload (`roll`/`need` on the four climb events) — carried over from v1.4 as a post-UAT quick task.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 36. Balance Foundation, Effect Timers & Small Independent Wins | v1.5 | 6/6 | Complete    | 2026-09-17 |
| 37. Equipment Slot Model & eff() Refactor | v1.5 | 4/4 | Complete    | 2026-09-17 |
| 38. Melee Active Abilities | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 39. Gear, Magic Items & One-Shot Tools | v1.5 | 0/? | Not started | - |
| 40. Spell Rework | v1.5 | 0/? | Not started | - |
| 41. Terrain, Darkness & Phobias | v1.5 | 0/? | Not started | - |
| 42. Flee Retune & Consolidated Balance Close | v1.5 | 0/? | Not started | - |
| 43. Clarity Pass | v1.5 | 0/? | Not started | - |
| 34. Combat Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 35. Map Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 28–33 | v1.3 | 16/16 | Shipped | 2026-09-16 |
| 22–27 (+25.1) | v1.2 | 31/31 | Shipped (override closeout: TUNE-07 deferred by user) | 2026-09-15 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.5 | - |
| Next tuning pass (TUNE-06/07) | Post-v1.3 | 0/1 | Deferred by user (2026-09-15) | - |
