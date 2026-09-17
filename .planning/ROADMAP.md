# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch pending; see `.planning/milestones/v1.3-ROADMAP.md`)
- 🚧 **v1.4 Combat & Map Screens** — Phases 34–35 (current, started 2026-09-16; requirements: `.planning/REQUIREMENTS.md`; specs: `design/Mazeworld Combat Panel.dc.html`, `design/Mazeworld Map.dc.html` + `Mazeworld Map Panel.dc.html`)
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

### 🚧 v1.4 Combat & Map Screens (In Progress)

**Milestone Goal:** Replace the combat AND map UX with the Claude Design "Mazeworld Combat" and "Mazeworld Map" screens — a dark combat screen (foes, your lot, › fight log, four actions) and a map with no D-pad and no toasts (tap-to-step, a bottom rail for every event and decision, a major overlay for encounters and descents, HUD + condition chips) — keeping the engine, parity, refusals, loot, joiners and the Phase 32 input guards exactly as shipped.

- [x] **Phase 34: Combat Screen Rebuild** - The encounter panel becomes the mock's full-screen layout (header, foes, YOUR LOT, › log, four-action bar with submenus), with the Fight! gate and the loot/flee/death endings folded into the same screen, engine untouched, validated on the Pixel 7. (completed 2026-09-16)
- [x] **Phase 35: Map Screen Rebuild** - The map tab becomes the mock's column: HUD + condition chips, tap-to-step viewport (no D-pad), the bottom rail that replaces every toast and carries every decision, the major overlay for encounters (FIGHT IT OUT) / descents / death, and the MARKS / CENTRE / MAKE CAMP chips with their sheets — engine untouched, validated on the Pixel 7. (completed 2026-09-16)

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

<details>
<summary>✅ v1.3 Feel, Loot & Combat Flow (Phases 28–33) — SHIPPED 2026-09-16 (device UAT batch pending; UIF-04 dropped to UX-06)</summary>

Full details: `.planning/milestones/v1.3-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.3-phases/`.

- [x] **Phase 28: Armor Integrity & Durability** - Armor behaves exactly as the screen says: the soak-vs-wear rule is audited and decided, durability lives on the item, and every armor outcome is legible (completed 2026-09-15)
- [x] **Phase 29: End-of-Combat Loot & Bag Cap** - Foe drops become a real, presented decision after combat, gated by one consistent bag-cap system, with bigger bags as a treasure path (completed 2026-09-15)
- [x] **Phase 30: Combat Narrative & Input — Research** - A written, decision-ready survey of combat-feedback UI patterns exists, with a recommended design for this game's combat flow agreed before any implementation begins (completed 2026-09-16)
- [x] **Phase 31: Combat Start Gating & Effect Hygiene** - Combat only truly starts on Fight!, every refusal explains itself, and every consumable/condition behaves and expires honestly — landed as engine groundwork ahead of the combat narrative rebuild (completed 2026-09-16)
- [x] **Phase 32: Combat Narrative & Input UI Build** - The chosen combat-feedback design is built — round narrative in one place, one-tap move-on, decision buttons safe from D-pad thumb-spam — then proven on-device (completed 2026-09-16)
- [x] **Phase 33: UI Feel & Store Polish** - Gear panel, map, tutorial toggle, toolbar layout, and store stock all get their remaining polish pass, done once against the finished combat UI (completed 2026-09-16)

</details>

## Phase Details

### Phase 34: Combat Screen Rebuild

**Goal**: The combat UX is rebuilt to the imported Claude Design spec (`design/Mazeworld Combat Panel.dc.html`): one dark full-screen panel with ENCOUNTER · ROUND N · N STANDING, foe cards (glyph, name, size · INT · trait, wp/max, hp bar, TARGET/DOWN tags), a YOUR LOT strip for the hero and every joiner, a newest-first › fight log with tap-to-reveal dice (refusals as dull entries), and a 2×2 STRIKE / SPELLS(ABILITIES) / ITEMS / SOCIAL action grid with the mock's submenus — the loot, flee and death endings folded into the same screen; the Fight! gate is the map's major overlay (Phase 35 spec, built here so the combat screen never renders a pending combat); Phase 32 guards intact, engine/parity untouched.
**Depends on**: Phase 33 (v1.3) — builds on the Round Card routing, input guards, Fight! gate and loot card.
**Requirements**: CSCR-01..10
**Success Criteria** (what must be TRUE):

  1. Walking into an encounter shows the major overlay (SOMETHING IS HERE / THEY ARE ALREADY HERE, the foes named, FIGHT IT OUT); nothing resolves before the tap; the tap opens the new combat screen at round 1.
  2. During a fight every narrative line lands in the › log (newest first, tap reveals the dice) and every refusal is a dull › entry — no toasts; the Oracle still has everything.
  3. STRIKE resolves at once; SPELLS/ABILITIES, ITEMS and SOCIAL open the submenu with the right options for the class and the fight; number keys still work.
  4. Killing the last foe shows THEY ARE DOWN with the loot rows inside; fleeing shows YOU GOT OUT; dying shows THAT IS THAT with Review the Oracle / Confirm.
  5. Every button is guarded (250 ms arm, settle on dismiss); nothing dismisses on a map tap; TalkBack announces a new log line once.
  6. `npm test` green with every shell test re-pinned; `build:www` exit 0; engine/content/parity diff empty; the Pixel 7 DR round signs it off.

**Plans**: 5 plans (sequential waves 1–5 — every wave after the first edits `mazeworld.html`, so none run in parallel)

Plans:
**Wave 1**

- [x] 34-01-PLAN.md — Pure modules: toasts.js `withIdx` + `oracleDetailText`, `fightLog.js`, `combatMenu.js`, `combatPanel.js` + unit tests (Decision 1: fold-preserving roll detail)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 34-02-PLAN.md — Routing seam → `window.__mzFightLog` (narrative + dull, uncapped), `renderFightLog` newest-first tap-to-reveal, announcer, DR18 rule scoped, noteCombat `over` tags; shell-round-card → shell-fight-log

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 34-03-PLAN.md — Combat screen bands (header / foes / YOUR LOT / log / action band), the Phase 34 CSS, `renderMajorOverlay` for `combat.pending` (Decision 2), guarded retarget (Decision 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 34-04-PLAN.md — 2×2 STRIKE / SPELLS(ABILITIES) / ITEMS / SOCIAL grid + submenus, keys, potion refusals as dull entries; old bar retired, guards re-pinned

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 34-05-PLAN.md — Endings (THEY ARE DOWN + loot rows / YOU GOT OUT / THAT IS THAT), joiner/find dark restyle, full executor gate, deferred Pixel 7 checklist (CSCR-10)

**UI hint**: yes

### Phase 35: Map Screen Rebuild

**Goal**: The map tab is rebuilt to the imported Claude Design spec (`design/Mazeworld Map.dc.html` + `Mazeworld Map Panel.dc.html`): HUD strip (FLOOR · DAY · SQUARES · RATIONS · WP bar) with a condition-chip strip beneath, a tap-to-step viewport (hold to inspect, drag to pan, pinch to zoom; the D-pad is gone), the bottom RAIL that replaces every toast and carries every decision with its dice (movement is locked until the decision is answered — user ruling 2026-09-16; crevices/walls are climb-only and block until a success), the MAJOR OVERLAY for encounters (FIGHT IT OUT), descents (GO DOWN / NOT YET) and out-of-combat death, and the MARKS / CENTRE / MAKE CAMP chips with their bottom sheets; the canvas renderer adopts the mock's palette; Phase 32 guards intact; engine/parity untouched.
**Depends on**: Phase 34 (the combat screen the overlay hands off to; the log-routing seam).
**Requirements**: MAP-01..10
**Success Criteria** (what must be TRUE):

  1. No D-pad and no toast exists anywhere; a tap on the map steps one square toward it; hold inspects; drag pans; pinch zooms.
  2. Every out-of-combat event appears in the rail with its dice and clears on its own; every decision (joiner, find, climb) is answered in the rail and tap-to-step stays locked until it is (a tap re-shows the pending card — user ruling 2026-09-16, "never move past an active choice"); level-up and floor arrival need no tap.
  3. Encounters, descents and out-of-combat death use the major overlay; FIGHT IT OUT opens the combat screen at round 1.
  4. HUD + condition chips match the mock; MARKS / CENTRE / MAKE CAMP work from the top chips with their sheets.
  5. Guards hold on every new button; `npm test` green with every shell test re-pinned; `build:www` exit 0; engine/content/parity diff empty; the Pixel 7 DR round signs it off.

**Plans**: 5 plans (sequential waves 1–5 — every wave after the first edits `mazeworld.html`, so none run in parallel)

Plans:
**Wave 1**

- [x] 35-01-PLAN.md — Pure modules: `rail.js` (event family → icon/title/tone/hold, generic roll line, one card per dispatch), `tapStep.js` (step-toward-a-tap, hold-inspect), `mapMarks.js` (palette, coloured glyphs, legend rows) + unit tests (decisions 1, 3, 4)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 35-02-PLAN.md — The RAIL surface + routing seam → rail, toast retirement, joiner/find/CLIMB IT as rail decisions, the GLOBAL movement lock, Move-on cards retired, out-of-combat death folded, static tab bar; eight suites re-pinned (decisions 2, 4, 5, 6)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 35-03-PLAN.md — HUD strip + condition-chip strip (ruling 5), MARKS / CENTRE / MAKE CAMP chips + the two sheets, canvas palette + glyph marks + pulsing party ring, `MAP_COPY` (decision 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 35-04-PLAN.md — Tap-to-step / hold / drag / pinch pointer model, D-pad retired, the stair-down gate as a shell pre-dispatch interception on `window.move` (THE STAIR DOWN / GO DOWN / NOT YET), keys, back-button context (decision 5)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 35-05-PLAN.md — Phase-wide invariant suite, full executor gate, the milestone's debug APK build (no adb install), the aggregated deferred Pixel 7 checklist (MAP-10) and the climb-dice deferred note

**UI hint**: yes

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

<details>
<summary>v1.3 phase details (28–33) — archived, see `.planning/milestones/v1.3-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.3 live in the archived roadmap, not duplicated here.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 34. Combat Screen Rebuild | v1.4 | 5/5 | Complete    | 2026-09-16 |
| 35. Map Screen Rebuild | v1.4 | 5/5 | Complete    | 2026-09-16 |
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 22–27 (+25.1) | v1.2 | 31/31 | Shipped (override closeout: TUNE-07 deferred by user) | 2026-09-15 |
| 28. Armor Integrity & Durability | v1.3 | 3/3 | Complete    | 2026-09-15 |
| 29. End-of-Combat Loot & Bag Cap | v1.3 | 3/3 | Complete    | 2026-09-15 |
| 30. Combat Narrative & Input — Research | v1.3 | 1/1 | Complete    | 2026-09-16 |
| 31. Combat Start Gating & Effect Hygiene | v1.3 | 3/3 | Complete    | 2026-09-16 |
| 32. Combat Narrative & Input UI Build | v1.3 | 3/3 | Complete    | 2026-09-16 |
| 33. UI Feel & Store Polish | v1.3 | 3/3 | Complete    | 2026-09-16 |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.3 | - |
| Next tuning pass (TUNE-06/07) | Post-v1.3 | 0/1 | Deferred by user (2026-09-15) | - |
