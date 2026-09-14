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

- [x] **Phase 17: Fixture Inventory & Foe-Turn Refactors** - Document which bestiary creatures each parity fixture rolls and extract shared foe-turn helpers before any bestiary or ability behavior changes land (completed 2026-09-13)
- [x] **Phase 18: Bestiary Rebalance & Canon Combat Fixes** - Review every creature's stats against its intended depth band and land canon-accurate combat modifiers (armor, half-damage, type multipliers, slow) (completed 2026-09-13)
- [ ] **Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance** - Foes cast, drain, debuff, heal, and summon via a data-driven ability system; the player's Intelligence resists incoming foe magic
- [x] **Phase 20: Parley Balance & Language System** - Fix parley's payout/spam dominance and wire Language/Helm-of-Knowledge fluency into the same bonus term (completed 2026-09-14)
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

**Plans:** 3/3 plans complete

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

**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 18-01-PLAN.md — BEST-01/02: `tools/bestiary-yardstick.mjs` (TTK/RTD calculator, prototype/canon modes) + unit pins; `content/BESTIARY-REBALANCE.md` BEFORE half (tune-difficulty BEFORE readout, prototype-mode table, review verdicts, D-03 numbers, zero-carve-out statement)
- [x] 18-02-PLAN.md — CANON-01/03/04: the seam `engine/foeDamage.js#damageFoe` (multiplier → halfDmg → gated d20 soak → apply) + `multiplierFor`; `content/damage-multipliers.js` (3 rows, pinned); `foeArmorSoaked` event + narration; 18 dedicated fakeRng tests

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 18-03-PLAN.md — CANON-01/03/04/05: route playerStrike / allyTurn / alliesTurn / ward-reflect / acid-tick in `engine/combat.js` through the seam; Philly `slow` two-dice-keep-lower; 12 behavioral tests + D-13 countingRng draw pins (FID-02 baseline unchanged)
- [x] 18-04-PLAN.md — CANON-01/03/04: route quake / volley / insane / thrown in `engine/magic.js` and the fire item in `engine/items.js`; Cleric-vs-Demons, spell-vs-Walking-Dead, per-foe Earthquake, halfDmg volley, spell-bypass tests
- [x] 18-05-PLAN.md — BEST-01/02/03: bestiary numbers (D-03 discount x7 entries, Drake 135→38, Werebeast d10+5→d10), header reference to the stat doc, content-table pins incl. verbatim fixture-exposed rows and tier shape (zero carve-outs)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 18-06-PLAN.md — seam-only invariant test (no foe-wp decrement outside `engine/foeDamage.js`); `BESTIARY-REBALANCE.md` AFTER table (canon mode, consistency-tested), tune-difficulty AFTER readout, change ledger with deferred canon consequences (Sterling, the five `sp.ar` creatures); phase parity gate

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

**Plans:** 4/4 plans executed

Plans:
**Wave 1**

- [x] 19-01-PLAN.md — FOE-01/05/06, CANON-02 (data half): `content/foe-abilities.js` registry (19 pure-data descriptors), `abilities` kits on the 8 caster rows + Djinni `sp.fleesBelow`, content pins, safety-scan corpus line
- [x] 19-02-PLAN.md — FOE-07/08, FID-04 (leaf half): `resistRoll` in `engine/derived.js` + draw-neutral `castSpell` refactor, `conditionsOf` foeEffect chip + `toHit` dazed penalty, `saveState` foeEffect clear, named strippers in all three comparables

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-03-PLAN.md — FOE-01..04/06/07/08, FOE-09 (member-targeting half), CANON-02: `engine/foeAbilities.js` resolver + every `engine/combat.js` seam (ability gate, summon join, fleesBelow flee, pursuit strike, foeEffect tick/clear, applyFoeDamageToPlayer options), 11 event types + narration, behavioural tests

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-04-PLAN.md — FOE-09 (D-15 determinism suite at pinned seeds), FOE-01/06 draw-count Section 4 + seam-invariant extension, FOE-08 D-21 chip labels ("Weakened"/"Dazed") in `mazeworld.html` + chip test, FID-04 mid-fight JSON round-trip, phase gate

### Phase 20: Parley Balance & Language System

**Goal**: Parley pays fairly, can no longer be spammed for free, keeps the Con Artist subclass viable, and Language/Helm-of-Knowledge fluency is wired into the same bonus term so it isn't balanced twice.
**Depends on**: Phase 17 (baseline gate); substantially independent of Phases 18–19 (parley touches a different subsystem than combat/bestiary) but sequenced here so its economy impact lands before the one consolidated retune
**Requirements**: PARLEY-01, PARLEY-02, PARLEY-03, PARLEY-04, LANG-01, LANG-02
**Success Criteria** (what must be TRUE):

  1. Successful parley pays XP no greater than the combat-equivalent value of the group (no longer 2.5x the kill value), verified by a test comparing parley payout to computed combat-equivalent.
  2. A failed parley attempt carries a real cost — a per-encounter attempt cap and/or an aggro penalty — so it cannot be spammed until success; every `canParley` gate has test coverage, including the previously-dead Wilmsry-vs-Magical branch now removed or made reachable.
  3. Con Artist's baseline parley odds are retuned to a stated, documented post-rebalance win-rate target that keeps the subclass identity viable rather than gutted.
  4. The Language skill and the Helm of Knowledge (`tongue`) both contribute a fluency bonus to the same parley `bonus` term (Option B), and fluency widens which encounter types a character can parley, verified by an availability test per race/class/skill/Helm combination.

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 20-01-PLAN.md — PARLEY-01..03 baseline (D-13/D-15/D-18): `stripParleyDivergence` in the harness applied scenario-scoped at BOTH seed-303 replay sites (combat-parity local comparable + full-suite shared comparable) + carve-out test; `tools/tune-difficulty.mjs` parley tally; `docs/PARLEY-REBALANCE.md` with the BEFORE readout measured on the pre-Phase-20 engine

**Wave 2** *(blocked on Wave 1 — the carve-out must precede the divergence and the BEFORE readout must precede the engine change)*

- [x] 20-02-PLAN.md — PARLEY-01..04, LANG-01/02 (D-01..D-12, D-14, D-16, D-17, D-20): `fluency` + `killSpFor` in `engine/derived.js`, `killFoe` via `killSpFor` (byte-identical), `canParley`/`parley` rewrite (one attempt, insulted aggro, Con Artist +4, need ≤ 17, +2×fluency, ×0.5 combat-equivalent, wilmst on a 6, reachable Wilmsry-vs-Magical refusal), `foeTurn` `need += 1` at both sites, narration + safety-scan tokens, `mazeworld.html` classic `canParley()` mirror, `test/unit/fluency.test.js`

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 20-03-PLAN.md — PARLEY-01..04, LANG-01/02 proof (D-02, D-04, D-05..D-08, D-10..D-13, D-15, D-17, D-19, D-21): `test/unit/parley.test.js` (576-case availability matrix vs an independent oracle, every gate, refusal, exhausted, insulted incl. member branch, odds 13/12, clamp 17, payout property, wilmst odds, countingRng draw shape, seed-303 pin, save/load edge), `test/unit/parley-button-mirror.test.js`, FIXTURE-INVENTORY.md Phase 20 before/after table, AFTER readout + comparison, phase gate

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

**Plans:** 5/5 plans executed

Plans:
**Wave 1**

- [x] 21-01-PLAN.md — TUNE-02: shared bot module `tools/lib/tuning-bot.mjs` (D-05/D-06 policies, D-07 tallies, D-08 reach/actions-per-floor/caster-rate readout, `--party` D-12/D-20, D-23), both tools rewired, BEFORE readout (3 × 200 seeds, backgrounded, engine untouched) into `docs/DIFFICULTY-RETUNE.md` (wave 1)

**Wave 2** *(blocked on Wave 1)*

- [x] 21-02-PLAN.md — TUNE-01: `difficultyCurve` gains foeCap/foeBonus/foeLvlBias/foePower/abilityThreat (softCapFloat, identity ≤ 5 — D-01/D-04/D-17/D-19), startCombat count/wp/dmgBonus wiring, `tickAbilityCooldowns(state, f)` + cadence via `abilityCadenceFor` (D-03/D-18); constants land at identity; combat-scaling tests; parity 30/30, zero carve-outs (wave 2)

**Wave 3** *(blocked on Wave 2)*

- [x] 21-03-PLAN.md — TUNE-04 infra: `newRun(seed, exclude, { startDepth })` + `state.dev` (D-13/D-14/D-23), save coercion + the one `dev` carve-out, adapter graveyard/best-depth exclusion, Settings version line + long-press dev field + DEV chip (D-22), build-www version stamp (wave 3)

**Wave 4** *(blocked on Wave 3)*

- [x] 21-04-PLAN.md — TUNE-03: the ONE retune — dials set, AFTER readouts (same bot parameters), ≤ 2 iterations (D-09/D-11), conditional depth-gated economy `lootDepth` (D-10/D-21) and party `memberUpkeepScale` (D-12/D-20), ledger change table / AFTER / comparison / not-changed (wave 4)

**Wave 5** *(blocked on Wave 4)*

- [x] 21-05-PLAN.md — TUNE-04 sign-off packaging: DR checklist (3 runs at depths 20/35/50, D-15), debug-build/adb how-to, D-16 outcomes, phase gate; the phase ends `human_needed` on the DR verdict (wave 5)

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
| 17. Fixture Inventory & Foe-Turn Refactors | v1.1 | 3/3 | Complete    | 2026-09-13 |
| 18. Bestiary Rebalance & Canon Combat Fixes | v1.1 | 6/6 | Complete    | 2026-09-13 |
| 19. Foe Abilities, Spellcasting & Symmetric INT Resistance | v1.1 | 4/4 | In Progress|  |
| 20. Parley Balance & Language System | v1.1 | 3/3 | Complete    | 2026-09-14 |
| 21. Consolidated Difficulty Retune | v1.1 | 5/5 | In Progress|  |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.1 | - |
