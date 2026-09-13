# Project Research Summary

**Project:** Delve, Die, Repeat (Mazeworld) - v1.1 Monster Balancing & Abilities
**Domain:** Deterministic, parity-frozen rules engine extension (turn-based mobile roguelike, subsequent milestone)
**Researched:** 2026-09-13
**Confidence:** HIGH

## Executive Summary

All four researchers converge on the same headline: this milestone needs zero new dependencies and is fully served by extending existing, proven data/code shapes (dice-notation tables, the single mulberry32 RNG stream, sp.* bestiary flags, the parity-carve-out pattern). The engine already has the resistance primitive (intel>=12 / d20<intel), the dice/effect vocabulary (SPELLS[], castSpell's sp.kind switch), and a documented precedent for deliberate, parity-safe divergence (stripFoeDamageClosures, stripDarkForField, etc.). The work is data-and-engine-extension, not new tooling.

The single biggest risk, called out by every research file independently, is RNG-order/parity discipline: any new foe-cast roll, ability-attempt roll, or resistance roll must be strictly gated behind a new, currently-absent field so that every existing (non-caster) foe and every frozen parity fixture draws exactly zero additional RNG - mirroring the codebase's own "zero-draw gate" pattern already used for c.regen / f.acid / party-targeting. The second major risk is that the frozen prototype (prototype-master.js.txt) embeds its own independent copy of the bestiary - so any bestiary rebalance affecting a creature a parity fixture can roll (only Beasts/Humans are forced today) requires an explicit inventory plus a narrow, named carve-out, never a blanket strip or fixture regeneration without a documented before/after table.

Recommended approach: (1) do a short fixture-inventory spike, (2) land two small behavior-preserving refactors (pickFoeTarget, applyFoeDamageToPlayer) to avoid duplicating the ward/armor/damage pipeline, (3) build foe abilities via a new, additive `abilities` field (not by activating sp.caster), (4) rebalance the bestiary with carve-outs where needed, (5) fold ability threat into difficulty.js and re-run the tuning harness, and (6) do the parley/Language pass last, gated on the retuned curve. Confidence is HIGH throughout - all four researchers did direct code reads of the same files and agree on mechanism; the two disagreements below are reconciled explicitly rather than left open.

## Reconciling Disagreements

### Disagreement 1: Key foe casting off sp.caster (STACK/PITFALLS) vs. a new abilities field (ARCHITECTURE)

**Recommendation: use ARCHITECTURE's approach - a brand-new `abilities: [id,...]` field, never activate sp.caster directly.**

Rationale: test/parity/harness/sandboxPrototype.js runs the frozen prototype-master.js.txt, which carries its own independent, byte-identical embedded BESTIARY copy (confirmed at prototype-master.js.txt:304) - not a shared reference to content/bestiary.js. sp.caster: true already exists on Djinni/Krupke/Drudge/Vampire in both copies today, as flavor-only data, per combat.js's own header. If the engine's code starts reading sp.caster as a live gate, any parity fixture whose seed happens to roll one of those four creatures would newly draw RNG that the frozen prototype never draws for that same roll - an ungated divergence with no existing carve-out mechanism, because the field itself isn't new (only its meaning changed), so comparables.js's per-field strip pattern doesn't naturally apply. A new abilities field is undefined on every existing entry by construction, giving a clean, structural, zero-cost gate (Pattern 1's "zero-draw gate") exactly like c.regen / f.acid today. STACK and PITFALLS both reference sp.caster as the natural home for the flag conceptually - that intent is preserved: the new abilities field is added specifically to the creatures already carrying sp.caster/sp.awe etc. (Djinni, Krupke, Drudge, Vampire, Stalka Beast), and sp.caster itself is left inert exactly as-is (per ARCHITECTURE's Anti-Pattern 2). This costs nothing extra (adding one field alongside an existing one is trivial) and removes all parity risk. Treat STACK/PITFALLS' "gate behind sp.caster" language as describing content targeting (which creatures get abilities), not the literal code gate (which must be the new field).

### Disagreement 2: Build order (FEATURES: abilities then bestiary; ARCHITECTURE: bestiary then abilities; PITFALLS: abilities, bestiary, parley, retune last)

**Recommendation: ARCHITECTURE's order - bestiary-fixture inventory, then low-risk refactors, then bestiary rebalance, then abilities, then retune, then parley/Language, then final consolidated pass.**

Rationale: PITFALLS' and FEATURES' ordering (abilities first) is defensible in isolation ("you can't rebalance stats for creatures that don't yet do what they're supposed to"), but ARCHITECTURE's ordering resolves a hard technical prerequisite that the other two files don't address as concretely: the bestiary-rebalance parity risk (Pitfall 4 / ARCHITECTURE Pitfall 1) requires a fixture-inventory spike before any bestiary edits land, and the two low-risk refactors (pickFoeTarget, applyFoeDamageToPlayer) are pure extractions with no feature dependency - landing them first is strictly lower-risk and de-risks the ability work that follows (abilities reuse both helpers). Doing bestiary rebalance before abilities does not waste effort: base stats (wp/dmg/toHit/ar) are logically independent from ability kits, and both FEATURES and PITFALLS agree the combined effect must be re-tuned in the same retune pass regardless of which piece of content lands first - so "rebalance base numbers, then layer abilities on top, then retune once" is at least as sound as "add abilities, then rebalance around them," and it lets the fixture-inventory/carve-out work (the highest-parity-risk item in the whole milestone) happen early and in isolation rather than compounded with new-RNG-draw risk from abilities landing simultaneously. Net: sequence bestiary-safety-first, abilities-second, matching ARCHITECTURE's Recommended Build Order - but treat FEATURES' point as valid design guidance (numbers may get revisited) - the retune pass is exactly where that reconciliation happens, not before.

Parley/Language is treated by all three as substantially independent of abilities/bestiary (different subsystem) but its final numbers must land after the retune, per Pitfall 3/13 - this is uncontested across research files and is preserved as-is.

## Key Findings

### Recommended Stack

No new dependencies. Reuse node:test, the single mulberry32 RNG (engine/rng.js), dice-notation {n,sides,bonus} tables, and plain ESM content/*.js object literals - the same toolkit used across all four prior v1.0 milestones (Joiners, Economy, phobias/flight, item wiring).

**Core technologies (all pre-existing, extended not added):**
- node:test / assert.deepStrictEqual - lock new content-table shapes exactly like content-tables.test.js already does for BESTIARY/SPELLS
- engine/rng.js mulberry32 - the ONLY RNG stream; all new foe-cast/resist/ability rolls must draw from it, never a second stream
- Dice notation {n,sides,bonus} via engine/dice.js - reuse for any new foe-ability damage/heal/duration numbers
- tools/tune-difficulty.mjs and tools/tune-economy.mjs - extend (don't replace) to tally ability-cast events and update the heuristic bot's policy

**Explicitly avoid:** schema validators (ajv/zod), a second RNG library, property-based testing (fast-check), a YAML/content build pipeline, and gating a CI build on the tuning harness's numeric output (it's a sanity proxy, not a pass/fail gate, per its own header).

### Expected Features

**Must have (this milestone, land in order below):**
- Foe spellcasting core via a new, small foeAbilities.js resolver (not a generalized castSpell) - offense-only, level-capped spell/ability subsets per creature, keyed by the new abilities field
- Symmetric player-INT resistance (intel>=12, d20<intel), mirroring the existing foe-resists-player check exactly, as a single shared helper reused by both directions
- High-value canon fixes with existing seams: foe ar as real armor, pursues (Spectre), never_melee (Drudge), every-N cooldown gating (Drake)
- Bestiary rebalance (HP/damage/to-hit/AR vs. depth), sequenced with a fixture-inventory spike first
- ONE consolidated difficulty.js retune folding party/economy/monster-power/ability-threat together
- Parley balance (payout <= combat-equivalent, per-encounter attempt cap or real failure cost, Con Artist odds retuned without gutting the subclass identity) plus Language Option B (graduated fluency bonus in the same parley() bonus term)

**Should have / stretch (still v1.1 candidate):** Sterling's halfDmg, type-vs-damage-source multipliers (Cleric 2x vs Demons, magic 2x vs Walking Dead), Philly's slow die-downgrade.

**Defer past this milestone:** full incapacitation state machines (grapple/entangle/possess/enthrall/awe-as-stun), guaranteed-drop overrides, pack-coordinated focus-fire AI, daggerOnly weapon-type gating, any new UI screen (foe inspect, bestiary browser) - milestone's own scope boundary is "engine/data/narration only, no new screens."

Richest canon-clear caster targets, in order: Drudge (pure caster, never melees), Krupke (hybrid), Djinni (capped casts/day, flees when losing), Vampire (endgame boss, 5 canon traits currently 1/5 modeled), Stalka Beast (unique elemental-immunity plus weapon-vulnerability kit, largest single canon gap in the bestiary).

### Architecture Approach

Every rule domain remains a pure function of (state, rng, events). New foe-ability logic lives in a new, small module (engine/foeAbilities.js), not folded into the already-dense combat.js foeTurn or the player-shaped magic.js castSpell. A new content/foe-abilities.js registry (mirroring SPELLS[]/c.grimoire's name-reference pattern) is referenced by id from a new abilities array on select content/bestiary.js entries. engine/difficulty.js gains new pure exports (foeThreatBudget, abilityThreatWeight) so foe count/level/ability scaling has one source of truth alongside its existing floor-gen-only knobs - or, as a lower-risk v1.1 fallback, simply hand-tune bestiary numbers so ability-bearing foes have proportionally lower raw stats, verified via the existing tuning harness (recommended default; defer the full threat-budget system to v1.2+).

**Major components:**
1. engine/foeAbilities.js (new) - resolveFoeAbility(state, foe, rng, events): ability pick, symmetric INT resist check, effect application via a small (~5-kind: bolt/drain/debuff/summon/heal) vocabulary, sharing a new extracted applyFoeDamageToPlayer helper with the existing melee pipeline
2. content/foe-abilities.js (new) - ability-kind registry, id-referenced from bestiary
3. engine/combat.js foeTurn (modified) - new ability-attempt gate inserted before the swing loop, structurally zero-draw for any foe without the new abilities field; pickFoeTarget extracted for shared party-aware targeting
4. engine/difficulty.js (modified) - extended scope from floor-gen-only to also cover combat-scaling knobs
5. c.foeEffect (new serialized slot) - single new field for foe-inflicted player debuffs, mirroring c.ward's shape, feeding the existing conditionsOf/status-chip UI with zero new UI code

### Critical Pitfalls

1. Unconditional cast-vs-strike roll leaks new RNG into every fight - gate strictly behind the new abilities field (never sp.caster), verified with a draw-count regression test on non-caster fixtures.
2. Bestiary rebalance silently diverges from the frozen prototype's own embedded bestiary - the frozen master has its own independent BESTIARY copy; enumerate exactly which fixture seeds roll which creatures BEFORE changing numbers, and add narrow named comparables.js carve-outs only for what actually changed.
3. Green parity suite does not mean abilities work correctly - the frozen fixtures only force Beasts/Humans; every sp.caster-flavored creature lives in Magical/Demons/Walking Dead. New, purpose-built determinism tests must specifically exercise those types.
4. Retuning to tune-difficulty.mjs's bot, not to human feel - the bot has zero model of foe abilities/potions; treat harness output as a sanity floor, require a human DR-round exit criterion before finalizing constants.
5. Con Artist nerfed into uselessness - fix parley's shape (real failure cost/attempt cap) rather than just cutting the reward/odds; state a concrete post-rebalance win-rate target so the subclass stays viable.

## Implications for Roadmap

### Phase 1: Fixture Inventory + Low-Risk Refactors
**Rationale:** Hard prerequisite gating all later parity-safe work; pure extractions carry zero feature risk and de-risk everything downstream.
**Delivers:** Documented list of which bestiary entries the 4 parity fixture seeds roll; pickFoeTarget and applyFoeDamageToPlayer extracted from foeTurn with byte-identical-behavior tests.
**Avoids:** Pitfalls 1, 4, 16 (RNG leak, silent bestiary divergence, party-member combat-path asymmetry).

### Phase 2: Bestiary Rebalance
**Rationale:** Depends on Phase 1's inventory; base stats (wp/dmg/toHit/ar) are independent of ability kits and safest to land first, in isolation from new-RNG-draw risk.
**Delivers:** Rebalanced HP/damage/to-hit/AR per creature vs. intended depth band, with narrow named comparables.js carve-outs for any fixture-exercised creature, plus a written before/after stat table.
**Addresses:** FEATURES' bestiary-rebalance ask.
**Avoids:** Pitfall 4/14 (silent divergence, fixture-regeneration masking regressions).

### Phase 3: Foe Abilities + Spellcasting + Symmetric INT Resistance
**Rationale:** Depends on Phase 1's refactors; the milestone's headline ask; must land as one unit with resistance (fairness valve for any lock/instakill-style ability).
**Delivers:** New content/foe-abilities.js registry plus abilities field on Djinni/Krupke/Drudge/Vampire/Stalka Beast; engine/foeAbilities.js resolver; new c.foeEffect slot plus conditionsOf entry; new EVENT_NARRATION entries (sarcastic-Oracle voice, not stubs); new determinism tests forcing Magical/Demons/Walking Dead encounters; comparables.js carve-outs for all new fields.
**Implements:** ARCHITECTURE Patterns 1-4 (zero-draw gate, separate resolver, symmetric resistance, shared targeting).
**Avoids:** Pitfalls 1, 2, 3, 5, 6, 7, 8, 9 (RNG leak, sp.caster misuse, parity-blind false confidence, foe-array mutation, field-reuse collisions, untelegraphed unfair deaths, flat narration, resistance double-counting).

### Phase 4: Consolidated Difficulty Retune (Phase A + B)
**Rationale:** Must be sequenced after Phases 2-3 exist to tune against; the milestone's explicit "ONE retune" directive folding 3 inherited deferrals (PARTY-10, ECON deep-tune, Phase 3 feel-tuning) plus the new ability axis.
**Delivers:** difficulty.js extended with combat-scaling knobs (or the simpler hand-tuned fallback, per Pattern 5); tune-difficulty.mjs/tune-economy.mjs bot policy updated to react to foe-ability events; a human DR-round at depth 20-50+ against caster foes as the exit criterion, not harness numbers alone.
**Uses:** tools/tune-difficulty.mjs, tools/tune-economy.mjs (extended).
**Avoids:** Pitfalls 10, 11 (bot-blind retuning, under-scoped consolidated retune).

### Phase 5: Parley Balance + Language System
**Rationale:** Substantially independent subsystem (combat avoidance, not combat resolution) but final numbers depend on Phase 4's curve; split into two sequenced sub-tasks to keep changes independently attributable.
**Delivers:** Task 1 - Language/Helm-of-Knowledge wiring (Option B: graduated fluency bonus in parley()'s existing additive term) with its own availability test. Task 2 - parley odds/reward/failure-cost retune (payout <= combat-equivalent, attempt cap or real cost) with a stated Con Artist win-rate target.
**Addresses:** DR15-A, FEATURES section 3-4.
**Avoids:** Pitfalls 12, 13 (Con Artist gutted, conflated Language+parley changes).

### Phase 6: Final Consolidated Tuning Pass
**Rationale:** One more full-system run once every prior phase has landed, closing PARTY-10/ECON-deep-tuning/Phase-3-feel-tuning as a single milestone-ending exercise.
**Delivers:** Final tune-difficulty.mjs/tune-economy.mjs run across the complete feature set; final human DR-round sign-off.

### Phase Ordering Rationale

- Parity-safety work (inventory + refactors) must precede any content/behavior change that could introduce new RNG draws or numeric divergence - this is the single most load-bearing constraint across all four research files.
- Bestiary rebalance before abilities avoids compounding two different kinds of parity risk (value divergence and new-RNG-draw risk) in the same phase, while still allowing FEATURES' concern (numbers may need revisiting once abilities exist) to be resolved in the dedicated retune phase rather than skipped.
- Retune is sequenced after both content changes land, per the milestone's own "ONE retune" directive - never per-feature.
- Parley/Language can start in parallel with abilities work (different subsystem) but its numeric finalization must wait for the retune, per Pitfall 3/13.

### Research Flags

Phases likely needing deeper research during planning:
- Phase 3 (Foe Abilities): the single biggest design fork in the milestone (new resolver vocabulary, resistance sharing, new serialized state) - recommend --research-phase during planning.
- Phase 4 (Retune): whether to build the full foeThreatBudget system or use the simpler hand-tuned fallback is an open design call flagged at MEDIUM confidence in ARCHITECTURE - worth a short research/spike pass before committing.

Phases with standard patterns (skip research-phase):
- Phase 1 (Inventory + Refactors): pure extraction plus grep-based inventory, no new design surface.
- Phase 2 (Bestiary Rebalance): well-precedented pattern (stripFoeDamageClosures etc.) already used repeatedly in v1.0.
- Phase 5 (Parley/Language): small numeric/tuning plus one bonus-term change, already scoped in detail by FEATURES.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct reads of engine/content/test/tool source; zero new dependencies needed, low ambiguity |
| Features | HIGH (canon inventory) / MEDIUM (comparable-roguelike patterns) | Canon table cross-checked line-by-line against rulebook and bestiary; competitor patterns are web-research-only |
| Architecture | HIGH (integration points) / MEDIUM (2 flagged open design calls) | Every pattern grounded in file:line citations; threat-budget-vs-hand-tuned and targeting-pool extraction explicitly flagged as needing a planning-time decision |
| Pitfalls | HIGH (repo-grounded) / MEDIUM (general RNG-game/tuning industry patterns) | 16 pitfalls all grounded in direct code read plus project history (v1.0 phase summaries); general patterns cross-checked against this repo's own already-correct implementation |

**Overall confidence:** HIGH

### Gaps to Address

- Threat-budget vs. hand-tuned bestiary for ability power: ARCHITECTURE recommends starting with the simpler hand-tuned fallback and deferring the full foeThreatBudget system - confirm this decision explicitly in Phase 4's CONTEXT rather than defaulting silently either way.
- daggerOnly weapon-type gating (Shadow): no existing weapon-type check exists anywhere in combat resolution; FEATURES defers this, but if planning wants Shadow's canon fidelity, a design call is needed on whether to generalize weapon-type gates or treat it as magicOnly-equivalent.
- Foe-summon ability array-mutation risk (Pitfall 5): no existing precedent in this codebase for appending to C.foes mid-fight; if a summon-kind ability is included in Phase 3, its plan must explicitly design around the C.ally next-round-only precedent rather than improvising.
- Party-member interaction per ability (Pitfall 16): the member-combat branch is a deliberately simplified clone of the hero's; each new ability's plan should explicitly state whether/how it applies to a live party member, since parity fixtures provide zero coverage here (solo-only).

## Sources

### Primary (HIGH confidence)
- Direct code read: engine/combat.js, engine/magic.js, engine/difficulty.js, engine/derived.js, engine/dice.js, engine/rng.js, engine/saveState.js
- Direct code read: content/bestiary.js, content/spells.js, content/skills.js, content/afflictions.js, content/encounters.js, content/treasure-tables.js
- Direct code read: test/parity/harness/comparables.js, test/parity/harness/sandboxPrototype.js, test/parity/fixtures/action-script.combat.json, test/unit/content-tables.test.js, test/unit/formatEventsCoverage.test.js, test/voice/safety-scan.test.js
- Direct code read: tools/tune-difficulty.mjs, tools/tune-economy.mjs, package.json
- mazeworld.pdf "Creatures Described" (pp.36-43), Language (pp.6-7), Spell Resistance (pp.25-26), Jewelry Table (p.47)
- .planning/PROJECT.md, .planning/proposed-milestone-monster-balancing.md, v1.0 phase summaries (03, 11, 16, 04.1)

### Secondary (MEDIUM confidence)
- Shattered Pixel Dungeon, Brogue, Dungeon Crawl Stone Soup enemy-ability and counterplay design consensus - web research, not code-verified against those engines
- Indie diplomacy/negotiation-roguelike patterns (reward parity, escalating retry) - web research

---
*Research completed: 2026-09-13*
*Ready for roadmap: yes*
