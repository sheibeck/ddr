# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- 🚧 **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (current, started 2026-09-15; requirements: `.planning/REQUIREMENTS.md`)
- 📋 **v1.0 launch tail** — first-run tutorial (04-10 / UX-06) + Google Play production launch (STR-01..04, STR-06); deliberately deferred until after v1.3 (CMBUI reshapes the UI the tutorial would teach)
- 📋 **Next tuning pass** — TUNE-06 roster decision + TUNE-07 human DR round; explicitly deferred out of v1.3 by user decision 2026-09-15 (`docs/DIFFICULTY-RETUNE.md`)

## Engine Gate (non-negotiable, every phase — carried from v1.1/v1.2)

Every phase in this milestone touches serialized character/combat state and/or introduces new RNG draws (bigger-bag drops, store stock). The gate, carried from `STATE.md`:

- Engine stays pure/deterministic.
- Parity stays byte-identical for solo/empty-party play against the frozen `test/parity/prototype-master.js.txt`.
- New RNG draws (bigger-bag treasure, store stock rolls) fire only behind new-feature guards — never unconditionally.
- Every new serialized field (item-carried armor durability, the pending end-of-combat loot pile) is carved out in all three `*Comparable()` functions (`test/parity/harness/comparables.js`) and round-trips through save/load — tolerant of pre-v1.3 saves that lack the field.
- `test/parity/prototype-master.js.txt` is NEVER edited.
- Every new event type gets an `EVENT_NARRATION` entry (coverage-guard stays green, family-friendly voice-safety scan stays green).
- Deliberate divergences from the prototype (e.g. an armor soak-vs-wear ruling change) regenerate only their specific fixtures, each with a documented before/after table and rationale — never a blanket fixture regeneration.

**Explicitly out of this milestone** (user decision 2026-09-15): the difficulty retune (TUNE-06/07), the Play versionCode-4 internal upload, the first-run tutorial (UX-06), and Google Play production launch. None of these get a v1.3 phase.

## Phases

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

### 🚧 v1.3 Feel, Loot & Combat Flow (In Progress)

**Milestone Goal:** Make gear and combat legible and honest — armor behaves the way the screen says it does, kill drops become a real end-of-combat loot decision, and the combat narrative is delivered through a researched, less tap-heavy, tap-safe UI — while landing the parked Feel & Polish backlog (inventory integrity, UI feel, combat start, store stock). Tuning is explicitly NOT this milestone.

- [x] **Phase 28: Armor Integrity & Durability** - Armor behaves exactly as the screen says: the soak-vs-wear rule is audited and decided, durability lives on the item, and every armor outcome is legible (completed 2026-09-15)
- [x] **Phase 29: End-of-Combat Loot & Bag Cap** - Foe drops become a real, presented decision after combat, gated by one consistent bag-cap system, with bigger bags as a treasure path (completed 2026-09-15)
- [x] **Phase 30: Combat Narrative & Input — Research** - A written, decision-ready survey of combat-feedback UI patterns exists, with a recommended design for this game's combat flow agreed before any implementation begins (completed 2026-09-16)
- [x] **Phase 31: Combat Start Gating & Effect Hygiene** - Combat only truly starts on Fight!, every refusal explains itself, and every consumable/condition behaves and expires honestly — landed as engine groundwork ahead of the combat narrative rebuild (completed 2026-09-16)
- [ ] **Phase 32: Combat Narrative & Input UI Build** - The chosen combat-feedback design is built — round narrative in one place, one-tap move-on, decision buttons safe from D-pad thumb-spam — then proven on-device
- [ ] **Phase 33: UI Feel & Store Polish** - Gear panel, map, tutorial toggle, toolbar layout, and store stock all get their remaining polish pass, done once against the finished combat UI

## Phase Details

<details>
<summary>v1.0 phase details (Phases 1–16 + 04.1/04.2) — archived, see `.planning/milestones/v1.0-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.0 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.1 phase details (17–21) — archived, see `.planning/milestones/v1.1-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.1 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.2 phase details (22–27) — archived, see `.planning/milestones/v1.2-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.2 live in the archived roadmap, not duplicated here.

</details>

### Phase 28: Armor Integrity & Durability

**Goal**: Armor behaves exactly as the screen says — the soak-vs-wear rule is audited and decided, the "toast says wear / panel shows no damage" discrepancy is root-caused and fixed, durability lives on the item instead of the character (killing the re-equip full-repair exploit), Cloak of Armor is legible and real, and every armor outcome is distinguishable on screen.
**Depends on**: Phase 27 (v1.2) — first phase of v1.3; no dependency on later v1.3 phases.
**Requirements**: ARMOR-01, ARMOR-02, ARMOR-03, ARMOR-04, ARMOR-05
**Success Criteria** (what must be TRUE):

  1. After any armor-soaked hit, the "wear" number in the toast and the durability shown in the gear panel/character sheet always agree — the observed discrepancy is gone.
  2. Unequipping armor, swapping to something else, and re-equipping the original piece preserves its remaining durability exactly — the re-equip full-repair exploit no longer exists.
  3. Cloak of Armor's item text states plainly what it does (never-wearing magic plate, or a redesign), and the armor UI shows it as the effective armor whenever it's carried.
  4. Player can tell apart, on screen, the four armor outcomes: soaked-with-wear, soaked-without-wear (blow at or below armor min), magic-plate soak, and armor giving out.
  5. The soak-vs-wear keep/change decision is recorded as a Key Decision in PROJECT.md, and any rule change ships as a declared, documented parity divergence.

**Plans**: 3/3 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 28-01-PLAN.md — Engine: durability rides the bag item (`left`/`patches`), destroyed armor is gone (wornArmorItem guard + unequipSlot branch, A1 accepted), `armorSoaked` `underMin`/`magic` flags, `stripBagArmorFields` parity carve-out, engine pin tests (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-02-PLAN.md — Presentation model: ARMOR-02 reproduction test first, shared `armorDisplay`/`bagArmorText` formatter over `armorSoak(c)`, sheet ARMOR tile, four-outcome toast + Oracle copy, destroyed-unequip narration, Cloak of Armor item text (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 28-03-PLAN.md — Shell: `window.__mzArmorDisplay` bridge; `#s-arm` HUD line, kit row, gear worn row, bag rows, find card, drop shelf, store repair row wired to the formatter; shell source-assertion test; PROJECT.md Key Decision row; full `npm test` gate (Wave 3)

### Phase 29: End-of-Combat Loot & Bag Cap

**Goal**: Foe drops during combat go into a pending pile instead of being auto-equipped or silently discarded; when combat clears, the player is presented a loot screen with take/leave per item; one bag-cap gate covers every pickup/buy/kit/loot path with clear feedback when full; bigger bags exist as depth-appropriate treasure; the pending pile survives save/resume and is honestly forfeited on flight or death.
**Depends on**: Phase 28 — both phases touch item/character serialization; landing armor's item-carried durability field first keeps the two new serialized fields (durability, pending pile) from colliding mid-flight.
**Requirements**: LOOT-01, LOOT-02, LOOT-03, LOOT-04, LOOT-05, LOOT-06
**Success Criteria** (what must be TRUE):

  1. When combat ends, the player sees a loot screen listing every drop from that fight with take/leave per item plus take-all/leave-all — no drop was auto-equipped or auto-rejected mid-fight, and nothing is silently discarded.
  2. Taking a weapon or armor item from the loot screen shows a compare-to-equipped readout ("+2 damage" / "not an upgrade") with a choice to equip now or stow in the bag.
  3. Every pickup, buy, starting-kit, and loot-take path is blocked by the same "bag full" message with a drop-to-make-room option when the bag is full; healing potions, special potions, and scrolls never count against the cap.
  4. A depth-appropriate bigger bag (medium/large/xlarge) can turn up as treasure and expands carry capacity when taken.
  5. Closing and resuming the app mid-loot-screen preserves the pending pile exactly; fleeing or dying instead forfeits it with a narrated line rather than losing it without explanation.

**Plans**: 3/3 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 29-01-PLAN.md — Engine gate + content + view-models: `slotItems`/`bagCap`/`canStow`/`stowItem` (the ONE bag-cap gate, potions exempt), `weaponUpgradeDelta`/`armorUpgradeDelta` extracted from takeItem, `bagUpgradeTier`/`bagItemFor`, `BAG_ORDER`/`BAG_FLOORS`/`BAG_DROP_UNDER`/`BAG_ITEMS`, store pre-pay `bagFull` gate (no gold on a refused stow), potion-preserving `clampCarry`, `lootCompare`/`bagUsage`, richer `bagFull` + `bagUpgraded` toast/Oracle entries, chargen-never-exceeds-cap test, full `npm test` gate (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 29-02-PLAN.md — The pending pile: `state.pendingLoot` (serialized, tolerant, `sanitizeLoot`), `offerLoot` + `takeLoot {i, equip?}`/`leaveLoot`/`takeAllLoot`/`leaveAllLoot` actions, `killFoe` → pile with the one guarded bag d20, `forfeitLoot` in `die()` and flee's three exits, `reconcilePendingLoot` in all three comparables, `lootDropped`/`lootTaken`/`lootLeft`/`lootForfeited` toast/Oracle entries, draw-count + roundtrip + forfeit tests, full `npm test` gate (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 29-03-PLAN.md — Shell: loot screen card replacing the encounter-cleared report (per-row Equip now/Stow-or-Take/Leave via `lootCompare`, Take all/Leave all, shared `renderDropShelf`), `hasActiveEncounter` parks the map on a pile, `noteCombat` folds the report into the card, `window.__mzBagUsage`/`__mzLootCompare` + `mzTakeLoot`/`mzLeaveLoot`/`mzTakeAllLoot`/`mzLeaveAllLoot` bridges, every readout through `bagUsage` (gear panel, find card, store with Drop when full), shell source-assertion test, `npm run build:www` + full `npm test` gates (Wave 3)

### Phase 30: Combat Narrative & Input — Research

**Goal**: A written survey of known combat-feedback interaction patterns is completed, a recommended design for this game's round narrative and input safety is chosen, and the choice is recorded as a Key Decision — before any implementation begins.
**Depends on**: Phase 29 — so the survey and recommendation can design the armor and loot outcomes INTO the new combat flow from the start, rather than bolting them on afterward.
**Requirements**: CMBUI-01
**Research flag**: `--research-phase` recommended during planning; `/gsd-discuss-phase` candidate before this phase is planned — this is a research-only phase with no implementation, matching v1.1 Phase 19 / v1.2 Phase 24's precedent for design-fork phases.
**Success Criteria** (what must be TRUE):

  1. A written survey exists in `docs/` comparing known combat-feedback patterns (combat log/ledger, batched round summary, auto-advance, ticker, mis-tap guards) drawn from mobile roguelikes and turn-based RPGs.
  2. The survey recommends one design for this game's round narrative and input-safety needs, with tradeoffs against the alternatives stated.
  3. The recommended design is recorded as a Key Decision in PROJECT.md before Phase 32 is planned.

**Plans**: 1/1 plans complete

Plans:
**Wave 1**

- [x] 30-01-PLAN.md — `docs/COMBAT-NARRATIVE-DESIGN.md` (documentation only): current state with live-verified toast/Oracle counts and the code-read correction (overlay already covers the D-pad; the real mis-tap mechanism is rapid re-render coordinate collision with zero arm delay), six-pattern survey with tagged shipped examples, weighted scorecard fixed before scoring (20/20/20/10/10/15/5 = 100; Round Card 4.75, Guarded Bundled Toast runner-up), recommendation with tradeoffs against every alternative, fully specified runner-up, Phase 32 build contract (per-state wireframes, 1-tap budget, `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` = 250 ms `Date.now()` guards, toast-vs-round-surface routing, Oracle unchanged, Phase 28/29 fold-in, accessibility, 89-test re-pin list), Ratification section left pending for the orchestrator's user pick; `npm test` 1593/1593 + empty code-diff gate — doc written and all gates passed; checkbox left unticked pending the orchestrator's ratification pause (Wave 1)

### Phase 31: Combat Start Gating & Effect Hygiene

**Goal**: No initiative roll or enemy strike happens before Fight! is pressed; every refusal to act (spell, item, gear) explains itself; combat potions are drinkable from Gear outside combat; Shield shows a condition chip; every round-based effect expires outside combat; and Amulet of Stone ends a fight and pays out like a kill — landed as engine/combat-flow groundwork ahead of the narrative rebuild so the new screen is built against settled rules.
**Depends on**: Phase 30 — the chosen combat-feedback design informs how the encounter-preview and refusal messaging should read, even though this phase is mostly engine-side.
**Requirements**: CMB-01, CMB-02, CMB-03, CMB-04, CMB-05, CMB-06
**Success Criteria** (what must be TRUE):

  1. Encountering a foe shows a preview/decision screen with no initiative roll and no enemy strike until the player presses Fight!.
  2. Every spell, item, and gear piece that refuses to act (cooldown/readiness, class gate, combat-vs-explore gate) tells the player exactly why it refused, confirmed by a completed audit of every usable feature.
  3. Combat potions can be drunk from the Gear page outside of combat.
  4. The Shield condition chip shows remaining pool and remaining rounds.
  5. Every round-based effect (Acuteness, haste, might, ward, and the rest of the audited set) expires on leaving combat or on exploration ticks — none linger indefinitely.
  6. Using Amulet of Stone on a foe ends the encounter immediately and pays out kill rewards (experience, coin, treasure, kill count) as if it had been slain normally.

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 31-01-PLAN.md — Engine Fight! split: `fight` action + `combat.pending` + `combatJoined` + the `notFought` guard; phobia → Afraid penalty (−3 to-hit range, half damage, 2 rounds; never a lost action) replacing the freeze; parity reconcile/chain + the three declared phobia-fixture divergences + a restored byte-identical death scenario (`lose-plain`); A3 walk; CMB-01 + Afraid pins

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 31-02-PLAN.md — Refusal vocabulary (combatOnly/cooldown/wrongClass — never fear), spell/item side of the Afraid penalty, useItem combat gate + item-kill close + `foeStoned`, Acuteness/effect expiry, ward chip data, Elven foeToHit flip (−1 → +1, easier to hit; user decision from the roll-direction audit), `docs/USABLE-FEATURES-AUDIT.md` (fear as a penalty row) + table-driven test

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 31-03-PLAN.md — Shell: Fight! → `fight`, pending gate, AMBUSH collapse, engine-bridged combat spell gate, grimoire reasons, visible Use/Sing/Scroll, Shield chip, Afraid countdown chip, sheet TO HIT reads `1–N`; `build:www` + full suite

**UI hint**: yes

### Phase 32: Combat Narrative & Input UI Build

**Goal**: The design chosen in Phase 30 is built — a combat round's narrative lands in one coherent place instead of a stack of toasts, moving on takes at most one deliberate tap, and decision buttons (Fight!, Joiner accept/decline, loot, Move on) are guarded against D-pad thumb-spam — then validated on-device before the milestone closes.
**Depends on**: Phase 30 (the chosen design) and Phase 31 (settled combat-start gating and effect rules the new screen must reflect).
**Requirements**: CMBUI-02, CMBUI-03, CMBUI-04, CMBUI-05, CMBUI-06
**Success Criteria** (what must be TRUE):

  1. A combat round's narrative appears in one coherent place per the chosen design, not a stack of individual toasts; the full Oracle log still records every event.
  2. Moving on after a round or an encounter takes at most one deliberate tap — no dismiss-then-continue chains.
  3. Decision buttons (Fight!, Joiner accept/decline, loot, Move on) never fire from a tap aimed at the D-pad.
  4. Nothing important dismisses from an incidental movement tap — dismissal always requires a deliberate tap on the surface itself.
  5. An on-device DR round on the Pixel 7 confirms the rebuilt combat flow feels right before the milestone closes.

**Plans**: TBD
**UI hint**: yes

### Phase 33: UI Feel & Store Polish

**Goal**: The gear panel, map, tutorial toggle, toolbar layout, and store all get their remaining polish pass — done once against the finished combat UI rather than bolted on before it existed.
**Depends on**: Phase 32 — the toolbar/gear-panel layout (Make Camp's move into the Marks/Centre row, handedness removal) should be laid out once against the final combat surface, not redone after.
**Requirements**: UIF-01, UIF-02, UIF-03, UIF-04, UIF-05, STORE-01
**Success Criteria** (what must be TRUE):

  1. The gear panel shows Use and Drop side by side (Drop on the far right) with a confirmation step before a drop is applied.
  2. The map recenters on the party icon whenever the view returns from a full-screen panel (Store, sheet, Oracle, etc.), and the default zoom sits at the midpoint between fully zoomed in and fully zoomed out.
  3. A tutorial on/off setting exists — it can be dismissed once and re-enabled later from Settings.
  4. Make Camp lives in the Marks/Centre row (far right), movement buttons are centered, and the handedness option is gone.
  5. Store stock is rolled randomly and floor-appropriately for the current depth on each visit, with parity byte-identical for fixtures.

**Plans**: TBD
**UI hint**: yes

## Carried-forward work (not yet phases)

| Item | Origin | Notes |
|------|--------|-------|
| First-run tutorial (04-10, UX-06) | Phase 4 | Plan exists in `milestones/v1.0-phases/04-.../04-10-PLAN.md` (stale vs. the DR-era UI — re-plan). Build LAST, once the UI settles — after v1.3's CMBUI rebuild. |
| Production launch (Phase 6 tail) | Phase 6 | Repo-side: dependency/SDK audit for Data Safety, privacy-policy page, listing copy/screenshots, `versionCode` bump + `npm run play:release`. Console-side (user): Data Safety form, IARC, paid pricing, production rollout. See `docs/RELEASING.md`. Deferred until after v1.3. |
| Next tuning pass (TUNE-06/07) | Phase 27 (v1.2) | Human DR round (forced 20/35/50 + natural) and the tier-3/5 roster decision wait in `docs/DIFFICULTY-RETUNE.md`. Explicitly NOT v1.3 (user decision 2026-09-15) — v1.3 changes player feel (armor, loot, combat flow), so tuning now would be tuned twice. |
| Play versionCode-4 internal upload | v1.2 close | Pending the user's phone; standing rule is to ask after every update batch (`docs/RELEASING.md`). |
| G16 "squares of opponents" group model | v1.1 backlog | Only the minimal Amulet of Stone fix (CMB-06) ships in v1.3; the full N-target group model stays a v2 candidate (tracked as `UI-V2-03` in REQUIREMENTS.md). |

Notes: PARTY-10 / ECON deep tuning / Phase 3 feel-tuning landed in Phase 21 (v1.1). DR15-A "Language as a system" landed in Phase 20 (v1.1). TUNE-04's deferred retune verdict landed as Phase 27 (v1.2), closed by user deferral of the human DR round (TUNE-07) to a later tuning milestone.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 22–27 (+25.1) | v1.2 | 31/31 | Shipped (override closeout: TUNE-07 deferred by user) | 2026-09-15 |
| 28. Armor Integrity & Durability | v1.3 | 3/3 | Complete    | 2026-09-15 |
| 29. End-of-Combat Loot & Bag Cap | v1.3 | 3/3 | Complete    | 2026-09-15 |
| 30. Combat Narrative & Input — Research | v1.3 | 1/1 | Complete    | 2026-09-16 |
| 31. Combat Start Gating & Effect Hygiene | v1.3 | 3/3 | Complete    | 2026-09-16 |
| 32. Combat Narrative & Input UI Build | v1.3 | 0/? | Not started | - |
| 33. UI Feel & Store Polish | v1.3 | 0/? | Not started | - |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.3 | - |
| Next tuning pass (TUNE-06/07) | Post-v1.3 | 0/1 | Deferred by user (2026-09-15) | - |
