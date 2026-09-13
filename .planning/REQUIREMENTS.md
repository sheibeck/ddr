# Requirements: Delve, Die, Repeat — v1.1 Monster Balancing & Abilities

**Defined:** 2026-09-13
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown. Fights at depth must feel fair *and* dangerous.
**Milestone goal:** Give foes real abilities (spellcasting and specials), rebalance the bestiary, fix parley's dominance, and run the ONE consolidated difficulty retune across party, economy, and monster power. Engine/data/narration only — no new screens.

## v1.1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Fidelity & Determinism (FID)

The non-negotiable engine gate, made explicit for this milestone because every feature below touches combat RNG or the bestiary the frozen prototype embeds its own copy of.

- [x] **FID-01**: A written fixture inventory documents exactly which `content/bestiary.js` creatures each parity fixture seed rolls (combat/magic/full-suite), BEFORE any bestiary number or foe-turn behavior changes land
- [x] **FID-02**: A foe without the new `abilities` field draws exactly zero additional RNG in any fight — verified by a draw-count regression test on non-ability fixtures — so solo/empty-party play stays byte-identical to the frozen prototype master
- [x] **FID-03**: The foe-turn targeting and player-damage pipeline (ward/armor/damage) is extracted into shared helpers (`pickFoeTarget`, `applyFoeDamageToPlayer`) with behavior-preserving tests, so foe abilities reuse the melee path instead of duplicating it
- [ ] **FID-04**: Every new serialized field (per-foe ability state, foe-inflicted player effects, summoned foes) is carved out in all three `*Comparable()` functions and round-trips through save/load; a v1.0 internal-tester save loads without data loss
- [x] **FID-05**: Deliberate divergences from the prototype (bestiary numbers, parley formula) regenerate only their specific fixtures, each with a before/after table and rationale — never a blanket fixture regeneration

### Foe Abilities & Spellcasting (FOE)

- [ ] **FOE-01**: Foes can have a data-driven ability kit — a new `abilities` array on select bestiary entries referencing a `content/foe-abilities.js` registry — resolved each foe turn by a pure `engine/foeAbilities.js` resolver (the inert `sp.caster` flag stays inert; `castSpell` is not generalized)
- [ ] **FOE-02**: The player is attacked by offensive foe spells (bolt kind) that deal dice-notation damage through the shared damage pipeline (ward, armor, and existing conditions apply)
- [ ] **FOE-03**: Foes can drain the player (drain kind: WP/HP or attribute drain per canon), debuff the player (debuff kind: a timed foe-inflicted condition stored in one new `c.foeEffect` slot), and heal themselves (heal kind), each deterministic and event-narrated
- [ ] **FOE-04**: Foes can summon reinforcements (summon kind) that join the fight on the following round, appended to the foe list via a designed mutation pattern (mirrors the `C.ally` next-round precedent) so mid-loop targeting, kill accounting, and XP split stay correct
- [ ] **FOE-05**: The five canon casters are wired rulebook-first — Drudge (pure caster, never melees, lvl 1–4), Krupke (lvl 1–2 hybrid), Djinni (lvl 1–4, capped casts per day, flees when losing), Vampire (lvl 1–5 capstone), Stalka Beast (unlimited casting + its elemental/weapon kit) — with abilities drawn from the existing offensive `SPELLS` subset; invented abilities only where a depth band has no canon caster
- [ ] **FOE-06**: Per-foe ability usage is bounded (per-day caps / every-N-turn cooldowns per canon) so a caster cannot spam its strongest effect every round, and every ability is telegraphed in the Oracle the turn it fires (no untelegraphed one-shots)
- [ ] **FOE-07**: The player's Intelligence resists incoming foe spells with the SAME canon rule foes already use (`intel ≥ 12`, `d20 < intel` negates), implemented as one shared resistance helper reused in both directions — and the resistance roll fires only when a foe actually casts
- [ ] **FOE-08**: Foe-inflicted debuffs appear in the existing condition tracker via `conditionsOf` (no new UI), and every new event type has a sarcastic, family-friendly `EVENT_NARRATION` entry that passes the voice safety scan (coverage guard stays green)
- [ ] **FOE-09**: A live party member can be targeted by foe abilities through the shared `pickFoeTarget` path, with each ability's plan stating explicitly how it applies to the member; new determinism tests force Magical / Demons / Walking Dead encounters (the types parity fixtures never exercise)

### Canon Fixes (CANON)

Cheap rulebook-described mechanics with existing engine seams.

- [x] **CANON-01**: A foe's own `sp.ar` (natural armor) reduces damage it takes, per canon (generic formula, all creatures)
- [ ] **CANON-02**: Spectre pursues a fleeing player (reuses the existing flee resolution path); Drudge never melees; Drake's breath is gated by an `every`-N cooldown (mirrors the item-cooldown pattern)
- [x] **CANON-03**: Sterling takes half damage from all sources (`halfDmg`)
- [x] **CANON-04**: Damage-source-vs-creature-type multipliers apply per canon (Cleric spells 2× vs Demons, magic 2× vs Walking Dead) via one small `{source, target} → multiplier` table in the magic damage path
- [x] **CANON-05**: Philly's `slow` gives the player the lower of two dice on its strikes (isolated to `strikeDie`/to-hit resolution)

### Bestiary Rebalance (BEST)

- [x] **BEST-01**: Every creature's HP / damage / to-hit / AR / attack count is reviewed against its intended depth band and the encounter tables, with outliers fixed and a before/after stat table committed
- [x] **BEST-02**: Ability-bearing foes carry proportionally lower raw stats (hand-tuned; the formal threat-budget system is deferred unless the tuning harness proves it necessary)
- [ ] **BEST-03**: Bestiary changes to creatures a parity fixture rolls land only through narrow, named `comparables.js` carve-outs per FID-05

### Consolidated Difficulty Retune (TUNE)

The ONE retune that closes PARTY-10, ECON deep tuning, and Phase 3 feel-tuning.

- [ ] **TUNE-01**: `engine/difficulty.js` is extended from floor-generation-only knobs to also own combat-scaling knobs (foe count / level / ability threat by depth) so monster power has one source of truth
- [ ] **TUNE-02**: `tools/tune-difficulty.mjs` and `tools/tune-economy.mjs` are extended to tally foe-ability events and their heuristic bot policy reacts to caster foes, so harness output is a usable proxy after abilities exist
- [ ] **TUNE-03**: The curve is retuned ONCE across party power, economy (loot/wilmst/store), monster power, and ability threat so a run still targets a 5–10 minute session and a bounded soft-cap descent to floor 30–50+
- [ ] **TUNE-04**: Final constants are signed off by a human on-device DR round at depth 20–50+ against caster foes — harness numbers are a sanity floor, not the exit criterion (UAT deferred to milestone end)

### Parley Balance (PARLEY)

- [ ] **PARLEY-01**: Successful parley pays XP ≤ the combat-equivalent value of the group (no longer 2.5× the kill value); the Humans wilmst bonus amount is left to the economy numbers but its odds are tuned here
- [ ] **PARLEY-02**: Parley has a real cost of failure — a per-encounter attempt cap and/or an aggro penalty on a failed attempt — so it cannot be spammed until success
- [ ] **PARLEY-03**: Con Artist's baseline odds are retuned to a stated post-rebalance win-rate target that keeps the subclass identity viable ("play the hand you're dealt"), not gutted
- [ ] **PARLEY-04**: The dead `parleyRefused` Wilmsry-vs-Magical branch is removed or made reachable, with tests covering every `canParley` gate

### Language System (LANG)

- [ ] **LANG-01**: Language is a graduated fluency system: the Language skill and the Helm of Knowledge (`tongue`) contribute a fluency bonus to the SAME parley `bonus` term (Option B), tuned in the same pass as PARLEY-01..03 so it isn't balanced twice
- [ ] **LANG-02**: Fluency widens which encounter types a character can parley (per the rulebook's language/tongue rules) with an availability test per race/class/skill/Helm combination

## v2 Requirements

Deferred to a future milestone. Tracked but not in this roadmap.

### Foe Model

- **FOE-V2-01**: Full incapacitation state machines (grapple / entangle / possess / enthrall / awe-as-stun) — no existing engine seam; each is its own status-effect feature
- **FOE-V2-02**: Pack-coordinated focus-fire AI (Bones) — a targeting-AI change, not a per-creature flag
- **FOE-V2-03**: `daggerOnly` weapon-type gating (Shadow) — needs a weapon-type check that doesn't exist in combat resolution
- **FOE-V2-04**: Formal `foeThreatBudget(depth)` system in `difficulty.js` — only if hand-tuning proves insufficient
- **FOE-V2-05**: Guaranteed-drop overrides (Hobgoblin loot, Frank's steal-and-vanish) — crosses into the economy system

### Presentation

- **UI-V2-01**: Foe inspect / "this one casts" threat hint on the encounter panel
- **UI-V2-02**: Browsable discovered-creatures bestiary screen
- **UI-V2-03**: DR16-G "squares of opponents" group model + Amulet of Stone 4-target (backlog per user, 2026-09-13)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New UI screens of any kind | User directive: this milestone is engine/data/narration only |
| Generalizing `castSpell` into a caster-agnostic function | Player-shaped (grimoire/charges/subclass gating); a small separate foe resolver is lower-risk |
| Activating the inert `sp.caster` flag as the code gate | The frozen prototype embeds its own bestiary copy with the same flag — reading it live risks ungated parity divergence |
| A second RNG stream, schema validators, property-based testing, YAML content pipeline, harness-as-CI-gate | Research: zero new dependencies; the single mulberry32 stream + existing test patterns cover every need |
| Per-milestone difficulty retunes | Explicit decision: ONE consolidated retune (this milestone) |
| Pre-milestone-end human UAT | User directive 2026-09-13: defer UAT to milestone end (TUNE-04 is the single human sign-off) |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FID-01 | Phase 17 | Complete |
| FID-02 | Phase 17 | Complete |
| FID-03 | Phase 17 | Complete |
| FID-04 | Phase 19 | Pending |
| FID-05 | Phase 18 | Complete |
| FOE-01 | Phase 19 | Pending |
| FOE-02 | Phase 19 | Pending |
| FOE-03 | Phase 19 | Pending |
| FOE-04 | Phase 19 | Pending |
| FOE-05 | Phase 19 | Pending |
| FOE-06 | Phase 19 | Pending |
| FOE-07 | Phase 19 | Pending |
| FOE-08 | Phase 19 | Pending |
| FOE-09 | Phase 19 | Pending |
| CANON-01 | Phase 18 | Complete |
| CANON-02 | Phase 19 | Pending |
| CANON-03 | Phase 18 | Complete |
| CANON-04 | Phase 18 | Complete |
| CANON-05 | Phase 18 | Complete |
| BEST-01 | Phase 18 | Complete |
| BEST-02 | Phase 18 | Complete |
| BEST-03 | Phase 18 | Pending |
| TUNE-01 | Phase 21 | Pending |
| TUNE-02 | Phase 21 | Pending |
| TUNE-03 | Phase 21 | Pending |
| TUNE-04 | Phase 21 | Pending |
| PARLEY-01 | Phase 20 | Pending |
| PARLEY-02 | Phase 20 | Pending |
| PARLEY-03 | Phase 20 | Pending |
| PARLEY-04 | Phase 20 | Pending |
| LANG-01 | Phase 20 | Pending |
| LANG-02 | Phase 20 | Pending |

**Coverage:**

- v1.1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

**Phase map:**

- Phase 17 — Fixture Inventory & Foe-Turn Refactors: FID-01, FID-02, FID-03
- Phase 18 — Bestiary Rebalance & Canon Combat Fixes: BEST-01, BEST-02, BEST-03, CANON-01, CANON-03, CANON-04, CANON-05, FID-05
- Phase 19 — Foe Abilities, Spellcasting & Symmetric INT Resistance: FOE-01..09, CANON-02, FID-04
- Phase 20 — Parley Balance & Language System: PARLEY-01..04, LANG-01, LANG-02
- Phase 21 — Consolidated Difficulty Retune: TUNE-01..04

---
*Requirements defined: 2026-09-13*
*Last updated: 2026-09-13 — roadmap created (`.planning/ROADMAP.md`, Phases 17–21), all 32 v1.1 requirements mapped with zero orphans*
