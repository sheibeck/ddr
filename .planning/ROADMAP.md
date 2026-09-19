# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch closed; see `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.4 Combat & Map Screens** — Phases 34–35 (shipped 2026-09-16, device round closed 2026-09-17; see `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.5 Meaningful Choices — Spells, Gear & Abilities** — Phases 36–43 (code-complete 2026-09-18; 140-check Pixel 7 UAT batch pending against one debug APK; see `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-MILESTONE-AUDIT.md`)
- 📋 **Shell Debt & Dead Code cleanup** — retire the classic engine mirrors from `mazeworld.html`, honest module names, collapse the Phase 37 hedges, shell modularisation, measure-first perf (`.planning/proposed-milestone-shell-cleanup.md`; stand up after the v1.5 UAT batch)
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

<details>
<summary>✅ v1.5 Meaningful Choices — Spells, Gear & Abilities (Phases 36–43) — CODE-COMPLETE 2026-09-18 (Pixel 7 UAT batch pending: 140 checks)</summary>

Full details: `.planning/milestones/v1.5-ROADMAP.md`. Audit: `.planning/milestones/v1.5-MILESTONE-AUDIT.md`.

- [x] **Phase 36: Balance Foundation, Effect Timers & Small Independent Wins** - The BEFORE class-matrix pin is captured before any new power lands, a general-purpose effect/cooldown/timer model exists for later phases to build on, dead foes can never be targeted, Cutthroats can accept (and occasionally lose) a Joiner, and any hero can dismiss one from the Company panel. (completed 2026-09-17)
- [x] **Phase 37: Equipment Slot Model & eff() Refactor** - One worn item per slot type, with a narrated migration for any old save that illegally has two — the widest-blast-radius change in the milestone, landed alone. (completed 2026-09-17)
- [x] **Phase 38: Melee Active Abilities** - Fighters and Thieves get a rolled pool of class-flavored active abilities with cooldowns, plus select passive skills converted to actives, all surfaced in the combat ABILITIES submenu. (completed 2026-09-18)
- [x] **Phase 39: Gear, Magic Items & One-Shot Tools** - Weapons/armor are rebalanced for real trade-offs, every activatable magic item follows one use-effect-cooldown model, and rope/ladder/torch give players a consumable answer to a specific hazard each. (completed 2026-09-18)
- [x] **Phase 40: Spell Rework** - Combat spells are differentiated by niche instead of a damage ladder, every utility spell has a felt effect, every Wizard sub-class starts with a damage spell, Detect Magic is renamed and time-boxed, and scribed scrolls are instantly castable. (completed 2026-09-18)
- [x] **Phase 41: Terrain, Darkness & Phobias** - Water squares cost extra movement and can scare swimmers, a dark square fogs the view to a 3×3 window, and every phobia has a real, once-per-entry trigger. (completed 2026-09-18)
- [x] **Phase 42: Flee Retune & Consolidated Balance Close** - Flee odds are lower and shown transparently, and the ONE consolidated AFTER class-matrix run verifies abilities + gear + spells together against the depth-20 target. (completed 2026-09-18)
- [x] **Phase 43: Clarity Pass** - Every costly line names its cause, every loot offer shows who can use it, ration math is honest, and the Gear screen splits into ON YOU and BAG. (completed 2026-09-18)

</details>

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

<details>
<summary>v1.5 phase details (36–43) — archived, see `.planning/milestones/v1.5-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, success criteria and plan lists for v1.5 live in the archived roadmap, not duplicated here.

</details>

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
| 39. Gear, Magic Items & One-Shot Tools | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 40. Spell Rework | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 41. Terrain, Darkness & Phobias | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 42. Flee Retune & Consolidated Balance Close | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 43. Clarity Pass | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 34. Combat Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 35. Map Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 28–33 | v1.3 | 16/16 | Shipped | 2026-09-16 |
| 22–27 (+25.1) | v1.2 | 31/31 | Shipped (override closeout: TUNE-07 deferred by user) | 2026-09-15 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.5 | - |
| Next tuning pass (TUNE-06/07) | Post-v1.3 | 0/1 | Deferred by user (2026-09-15) | - |
