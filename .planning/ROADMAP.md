# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/MILESTONES.md`)
- 🚧 **v1.1 Monster Balancing & Abilities** — Phases 17–21 (current, started 2026-09-13; research: `.planning/research/SUMMARY.md`, requirements: `.planning/REQUIREMENTS.md`)
- 📋 **v1.0 launch tail** — first-run tutorial (04-10 / UX-06) + Google Play production launch (STR-01..04, STR-06); deferred by user until after v1.1

## v1.1 Engine Gate (non-negotiable, every phase below)

Every phase in this milestone touches combat RNG and/or the bestiary the frozen prototype embeds its own copy of. The gate, carried from `STATE.md`:

- Engine stays pure/deterministic.
- Parity stays byte-identical for solo/empty-party play against the frozen `test/parity/prototype-master.js.txt`.
- New RNG draws fire only behind new-feature guards (e.g. a new `abilities` field) — never unconditionally.
- Every new serialized field (per-foe ability state, foe-inflicted player effects, summoned foes) is carved out in all three `*Comparable()` functions (`test/parity/harness/comparables.js`) and round-trips through save/load.
- `test/parity/prototype-master.js.txt` is NEVER edited.
- Every new event type gets an `EVENT_NARRATION` entry (coverage-guard stays green, family-friendly voice-safety scan stays green).
- Deliberate divergences from the prototype (bestiary numbers, parley formula) regenerate only their specific fixtures, each with a documented before/after table and rationale — never a blanket fixture regeneration.

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

### 🚧 v1.1 Monster Balancing & Abilities (In Progress)

**Milestone Goal:** Make fights fair and interesting at depth — give foes real abilities (spellcasting and specials), rebalance the bestiary, fix parley's dominance, and run the ONE consolidated difficulty retune across party, economy, and monster power. Engine/data/narration only — no new screens.

- [ ] **Phase 17: Fixture Inventory & Foe-Turn Refactors** - Document which bestiary creatures each parity fixture rolls and extract shared foe-turn helpers before any bestiary or ability behavior changes land
- [ ] **Phase 18: Bestiary Rebalance & Canon Combat Fixes** - Review every creature's stats against its intended depth band and land canon-accurate combat modifiers (armor, half-damage, type multipliers, slow)
- [ ] **Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance** - Foes cast, drain, debuff, heal, and summon via a data-driven ability system; the player's Intelligence resists incoming foe magic
- [ ] **Phase 20: Parley Balance & Language System** - Fix parley's payout/spam dominance and wire Language/Helm-of-Knowledge fluency into the same bonus term
- [ ] **Phase 21: Consolidated Difficulty Retune** - The ONE retune across party power, economy, monster power, ability threat, and parley numbers, closed out by a human DR-round sign-off

## Phase Details

<details>
<summary>v1.0 phase details (Phases 1–16 + 04.1/04.2) — archived, see `.planning/milestones/v1.0-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.0 live in the archived roadmap, not duplicated here.

</details>

### Phase 17: Fixture Inventory & Foe-Turn Refactors

**Goal**: Establish the parity-safety foundation — know exactly which bestiary creatures each parity fixture rolls, and extract shared foe-turn helpers — before any bestiary or ability behavior changes land.
**Depends on**: Nothing new (first phase of v1.1; builds on the v1.0 engine)
**Requirements**: FID-01, FID-02, FID-03
**Success Criteria** (what must be TRUE):

  1. A written fixture inventory document lists exactly which `content/bestiary.js` creatures each parity fixture seed (combat/magic/full-suite) rolls.
  2. `pickFoeTarget` and `applyFoeDamageToPlayer` exist as shared, tested helper functions used by the existing foe-turn melee path, with behavior-preserving tests proving zero output change.
  3. A draw-count regression test proves a foe without the new `abilities` field draws exactly zero additional RNG in any fight.
  4. The full parity suite remains byte-identical to the frozen prototype master.

**Plans:** 3/3 plans executed

Plans:
**Wave 1**

- [x] 17-01-PLAN.md — FID-01: replay-generated fixture roster (harness module + CLI), committed `test/parity/FIXTURE-INVENTORY.md`, pinned roster/doc-consistency test (wave 1)
- [x] 17-02-PLAN.md — FID-03: extract `pickFoeTarget` + `applyFoeDamageToPlayer` from `foeTurn` with `{ died, onArmour }` signal; direct helper tests + foeTurn control-flow tests; parity byte-identical (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-03-PLAN.md — FID-02: `countingRng` draw-count regression test pinning per-foeTurn and full-fight draws for ability-less foes (+ mulberry32 cursor cross-check); baseline appended to the inventory; phase gate (wave 2)

### Phase 18: Bestiary Rebalance & Canon Combat Fixes

**Goal**: Every creature's HP/damage/to-hit/AR/special is reviewed and fixed against its intended depth band, with canon-accurate combat modifiers applied — all parity-safe via narrow, named carve-outs.
**Depends on**: Phase 17 (fixture inventory + shared helpers)
**Requirements**: BEST-01, BEST-02, BEST-03, CANON-01, CANON-03, CANON-04, CANON-05, FID-05
**Rationale for CANON placement**: CANON-01 (foe AR reduces damage taken) is a generic formula affecting every creature's effective toughness, so it lands alongside the BEST-01 stat review it directly informs. CANON-03/04/05 (Sterling half-damage, damage-type multipliers, Philly's slow) are single-creature "special" stat behaviors the research groups as bestiary-adjacent stretch fixes, not ability-system work. CANON-02 (Spectre pursue, Drudge never-melee, Drake cooldown) instead lands in Phase 19 because it shares the cooldown-gating pattern with foe abilities and Drudge's never-melee behavior is part of its caster wiring (FOE-05).
**Success Criteria** (what must be TRUE):

  1. A committed before/after stat table shows every bestiary creature's HP/damage/to-hit/AR/attack-count reviewed against its intended depth band, with outliers corrected.
  2. Foe AR (`sp.ar`) measurably reduces damage a creature takes, verified by a unit test covering the generic formula.
  3. Sterling takes half damage from all sources; Cleric spells deal 2x to Demons and magic deals 2x to Walking Dead; Philly's `slow` gives the player the lower of two dice on strikes — each verified by a dedicated test.
  4. Only named, narrow `comparables.js` carve-outs cover fixture-exercised creatures that changed numbers — no blanket fixture regeneration — with a documented rationale per carve-out.
  5. Ability-bearing foes (Djinni, Krupke, Drudge, Vampire, Stalka Beast) carry proportionally lower raw stats than their pre-rebalance baseline, anticipating the ability kits landing in Phase 19.

**Plans**: TBD

### Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance

**Goal**: Foes can cast, drain, debuff, heal, and summon via a data-driven ability system resolved deterministically; the player's Intelligence resists incoming foe magic using the same canon rule foes already use against players.
**Depends on**: Phase 17 (`pickFoeTarget` / `applyFoeDamageToPlayer` reused by the ability resolver), Phase 18 (ability-bearing foes' base stats already rebalanced)
**Requirements**: FOE-01, FOE-02, FOE-03, FOE-04, FOE-05, FOE-06, FOE-07, FOE-08, FOE-09, CANON-02, FID-04
**Research flag**: `--research-phase` recommended during planning — the single biggest design fork in the milestone (new resolver vocabulary, resistance sharing, new serialized state, foe-array mutation for summons).
**Success Criteria** (what must be TRUE):

  1. The five canon casters (Drudge, Krupke, Djinni, Vampire, Stalka Beast) each have a wired `abilities` kit resolved by a pure `engine/foeAbilities.js` resolver; new determinism tests forcing Magical/Demons/Walking Dead encounters pass (parity fixtures never exercise these types).
  2. The player takes dice-notation damage from offensive foe bolt spells through the shared damage pipeline (ward/armor/conditions apply), can be drained, debuffed (via a new `c.foeEffect` slot surfaced through `conditionsOf`), or face a foe that heals itself or summons reinforcements that join the fight the following round.
  3. The player's Intelligence resists incoming foe spells via a single shared resistance helper (`intel >= 12`, `d20 < intel`) reused in both directions; the resistance roll fires only when a foe actually casts.
  4. Every ability is bounded (per-day caps / every-N-turn cooldowns per canon) and telegraphed in the Oracle the turn it fires; every new event type has a sarcastic, family-friendly `EVENT_NARRATION` entry passing the voice safety scan (coverage guard stays green).
  5. Spectre pursues a fleeing player, Drudge never melees, and Drake's breath is gated by an every-N cooldown; every new serialized field (per-foe ability state, `c.foeEffect`, summoned foes) is carved out in all three `*Comparable()` functions and round-trips through save/load, including a v1.0 internal-tester save loading without data loss.

**Plans**: TBD

### Phase 20: Parley Balance & Language System

**Goal**: Parley pays fairly, can no longer be spammed for free, keeps the Con Artist subclass viable, and Language/Helm-of-Knowledge fluency is wired into the same bonus term so it isn't balanced twice.
**Depends on**: Phase 17 (baseline gate); substantially independent of Phases 18–19 (parley touches a different subsystem than combat/bestiary) but sequenced here so its economy impact lands before the one consolidated retune
**Requirements**: PARLEY-01, PARLEY-02, PARLEY-03, PARLEY-04, LANG-01, LANG-02
**Success Criteria** (what must be TRUE):

  1. Successful parley pays XP no greater than the combat-equivalent value of the group (no longer 2.5x the kill value), verified by a test comparing parley payout to computed combat-equivalent.
  2. A failed parley attempt carries a real cost — a per-encounter attempt cap and/or an aggro penalty — so it cannot be spammed until success; every `canParley` gate has test coverage, including the previously-dead Wilmsry-vs-Magical branch now removed or made reachable.
  3. Con Artist's baseline parley odds are retuned to a stated, documented post-rebalance win-rate target that keeps the subclass identity viable rather than gutted.
  4. The Language skill and the Helm of Knowledge (`tongue`) both contribute a fluency bonus to the same parley `bonus` term (Option B), and fluency widens which encounter types a character can parley, verified by an availability test per race/class/skill/Helm combination.

**Plans**: TBD

### Phase 21: Consolidated Difficulty Retune

**Goal**: Run the ONE retune across party power, economy, monster power, ability threat, and parley numbers so a run still targets a 5–10 minute session and a bounded soft-cap descent to floor 30–50+ — closing PARTY-10, ECON deep tuning, and Phase 3 feel-tuning as this milestone's single tuning exercise, signed off by human play.
**Depends on**: Phase 18 (rebalanced bestiary), Phase 19 (foe abilities), Phase 20 (parley/economy changes) — every power-changing phase must land before the one retune
**Requirements**: TUNE-01, TUNE-02, TUNE-03, TUNE-04
**Research flag**: `--research-phase` recommended during planning — whether to build the full `foeThreatBudget(depth)` system or use the simpler hand-tuned fallback is an open design call flagged at MEDIUM confidence in research; worth a short spike before committing.
**Success Criteria** (what must be TRUE):

  1. `engine/difficulty.js` owns combat-scaling knobs (foe count / level / ability threat by depth) alongside its existing floor-generation knobs, as one source of truth.
  2. `tools/tune-difficulty.mjs` and `tools/tune-economy.mjs` tally foe-ability events and the heuristic bot's policy reacts to caster foes, producing usable harness output across the full feature set (bestiary + abilities + parley/economy).
  3. The curve is retuned once across party power, economy (loot/wilmst/store), monster power, and ability threat; harness runs confirm a run still targets a 5–10 minute session and a bounded soft-cap descent to floor 30–50+.
  4. A human signs off via an on-device DR round at depth 20–50+ against caster foes — harness numbers are a sanity floor, not the exit criterion — as the milestone's single deferred UAT checkpoint (last thing in the milestone).

**Plans**: TBD

## Carried-forward work (not yet phases)

| Item | Origin | Notes |
|------|--------|-------|
| First-run tutorial (04-10, UX-06) | Phase 4 | Plan exists in `milestones/v1.0-phases/04-.../04-10-PLAN.md` (stale vs. the DR-era UI — re-plan). Build LAST, once the UI settles — after v1.1. |
| Production launch (Phase 6 tail) | Phase 6 | Repo-side: dependency/SDK audit for Data Safety, privacy-policy page, listing copy/screenshots, `versionCode` bump + `npm run play:release`. Console-side (user): Data Safety form, IARC, paid pricing, production rollout. See `docs/RELEASING.md`. Deferred until after v1.1. |

Notes: PARTY-10 / ECON deep tuning / Phase 3 feel-tuning now land in Phase 21. DR15-A "Language as a system" now lands in Phase 20. DR16-G "N squares of opponents" is tracked as `UI-V2-03` in `.planning/REQUIREMENTS.md` v2 Requirements (backlog, not a v1.1 phase).

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| 17. Fixture Inventory & Foe-Turn Refactors | v1.1 | 3/3 | In Progress|  |
| 18. Bestiary Rebalance & Canon Combat Fixes | v1.1 | 0/TBD | Not started | - |
| 19. Foe Abilities, Spellcasting & Symmetric INT Resistance | v1.1 | 0/TBD | Not started | - |
| 20. Parley Balance & Language System | v1.1 | 0/TBD | Not started | - |
| 21. Consolidated Difficulty Retune | v1.1 | 0/TBD | Not started | - |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.1 | - |
