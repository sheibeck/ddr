# Project Research Summary

**Project:** Delve, Die, Repeat -- Milestone v1.5 "Meaningful Choices -- Spells, Gear & Abilities"
**Domain:** Subsequent-milestone extension of a shipped, deterministic, offline Android roguelike engine (vanilla JS, zero runtime dependencies, Capacitor shell unchanged)
**Researched:** 2026-09-17
**Confidence:** HIGH

## Executive Summary

v1.5 is a differentiation and enforcement pass over existing primitives, not new-system invention. Every capability the milestone needs -- squares-based item cooldowns (items.js itemReady/useItem with it.usedAt/it.every), round-based combat timers (c.ward.rounds, combat.afraid, foeAbilities.js tickAbilityCooldowns), class-gated data, and even the darkness-vision infrastructure -- already has a live, shipped precedent somewhere in engine/ or content/. Zero new npm dependencies are needed or should be added; node --test and the existing tools/tune-classes.mjs matrix bot remain the only tooling. The recommended approach is to (1) build one small new engine/effects.js module to own only the new cooldown/duration timers this milestone introduces (ability cooldowns, magic-item duration-then-cooldown pairs, timed map reveal) rather than retrofitting the four existing bespoke timer idioms; (2) land the equipment worn-slot model and its wide-blast-radius eff() refactor early, since gear, magic items, and the Gear-tab split all depend on it; (3) land water terrain before phobias, since the Bodies-of-water phobia has no real trigger without it; and (4) run spells and melee abilities through one shared class-matrix tuning checkpoint rather than two, since both are player-power-additive changes the existing curve was tuned without.

The single biggest risk is parity: engine/maze.js#genFloor is called by every fixture, bot run, and old save via newRun/descend, so any new unconditional rng draw for water-blob generation would silently reorder or regenerate every maze layout in the test suite. This must be gated behind a new state.terrainRoll run flag, mirroring the storeRoll precedent exactly (Phase 33) -- there is no strip-helper remedy once this class of divergence occurs; only a run-flag gate prevents it. The second biggest risk is scope: this milestone spans six of the largest game systems (spells, melee abilities, gear, terrain/phobias, flee/social mechanics, targeting/UI clarity) simultaneously, which is the exact multi-variable-change pattern the project own tuning methodology ("ONE consolidated difficulty retune") was built to avoid -- mitigated by sequencing power-additive phases before survivability-changing phases, with an explicit tuning checkpoint in between, and by extending the tuning bot policy (tools/lib/tuning-bot.mjs) to actually use new abilities/items before any matrix run is trusted.

Feature-wise, the actual design gap is narrower than the milestone feature list implies: the offense-spell school is a straight damage ladder and the control school has 9 overlapping spells with no scope/duration differentiation -- the fix is re-deriving numbers and niches, not adding a new spell mechanic. Equipment has no slot concept at all today (cloaks/jewelry/staves stack unboundedly and are summed unconditionally by eff()), which is a real, confirmed gap and the milestone biggest architectural prerequisite. The Cutthroat-can-take-a-Joiner ask is a deliberate reversal of an existing, documented refusal (meetJoiner:473) rather than new ground. Dead-foe retarget is nearly done -- display suppression already works; only a normalize-on-kill call and a shell tap-guard remain. Throughout, the project own identity rule (100 percent dice-rolled characters, no player-authored build choices) rules out any "pick your ability/spell" UI -- the rolled-pool approach specified in PROJECT.md is correct and must not slide toward a choice screen under implementation pressure.

## Key Findings

### Recommended Stack

No new runtime dependencies. Every mechanism needed (cooldowns, durations, terrain flags, fog rendering) is data/logic extension inside the existing zero-dependency engine, using node --test (native, Node 22+) as the sole test runner and tools/tune-classes.mjs as the unmodified balance yardstick.

**Core precedents to reuse, not reinvent:**
- Squares-based cooldowns: it.usedAt/it.every read against state.steps (engine/items.js:774-870) -- already the exact shape magic items need; STAVES is the one table still missing every.
- Round-based durations: c.ward.pool/rounds, combat.afraid, c.foeEffect.kind/rounds -- all ticked once per combat round, cleared unconditionally at endCombat.
- Multi-keyed cooldown pools on one entity: f.cd map of abilityId to roundsRemaining (engine/foeAbilities.js:39-95) -- the direct template for a new c.abilityCd map for hero melee actives.
- Terrain move-cost: no existing precedent; simplest-consistent extension is a second boolean tile flag (water) consulted at the one state.steps++ call site, charging 2 instead of 1 -- this "for free" also feeds every existing squares-based cadence (haste, flight cooldown, cloak heal/regen), which is a design decision to ratify explicitly, not an accidental side effect to discover in QA.
- New serialized fields must all get parity carve-outs in test/parity/harness/comparables.js three Comparable functions, mirroring stripFoeEffectField/stripFoeAbilityState.
- New rng draws follow the narrow feature-guard convention (a draw only fires on a genuinely new state shape, or is explicitly gated like storeRoll) -- not a new top-level flag for every draw.

**What NOT to add:** any property-based testing library, a canvas/visual-regression tool, an npm wrapper script for the tuning bot, or a generic "TimedEffect"/"Cooldown" class abstraction (the codebase convention is bespoke, explicit, independently-serializable fields per effect -- a shared class would fight the plain-JSON structuredClone contract the parity comparators depend on).

### Expected Features

**Must have (table stakes):**
- Combat spells differentiated by niche (single/multi-target, DOT, control, defensive) instead of a pure damage ladder -- the real gap is concentrated in the single-target damage ladder (Freeze to Ice to Fireball to Mangle, one "best" per level) and a 9-spell control glut with no scope/duration axis.
- Every wizard sub-class has a guaranteed day-one damage spell.
- One worn item per equipment-slot type (ring/bracelet/cloak/...) -- a real, confirmed gap; no slot field exists anywhere in content/treasure-tables.js today, and eff() sums every carried copy unconditionally (a latent stacking bug this milestone newly surfaces).
- One-shot terrain tools (rope/pit, ladder/wall, torch/dark) strictly 1:1 with their hazard -- Lockpicks is the existing in-codebase precedent for this exact shape.
- Darkness fog (3x3 view while on a dark square, re-fogged on entry, waived by Night Vision/light) -- Night Vision and Amulet/Cloak of Light are currently inert flavor text waiting for this mechanic.
- Water as a movement-cost (2x) and phobia-trigger tile.
- Fairer, lower-baseline flee odds with class/race modifiers, shown transparently in the fight log -- hiding the math would be inconsistent with the game own "the tables decide" dice-forward identity.
- Loot "(usable by ...)" tags -- pure display pass over existing cls fields on weapons/armor.

**Should have (differentiators):**
- Transparent flee math shown in-log (most genre peers hide it -- showing it reinforces this game identity).
- Rolled (not chosen) class-flavored ability pool at level-up -- the correct genre deviation given the "100 percent dice-rolled, no player-authored build" identity.
- Dual-cadence cooldowns (rounds in combat, squares while exploring) -- already Mazeworld own idiom; extend it, do not collapse it.
- Sarcastic/deadpan narration on every new mechanic (cooldown refusals, tool-use flavor, Cutthroat murder) -- the comedy voice is the core differentiator layer.
- Risk/reward AoE spells with a real downside (e.g. Earthquake self-damage) kept deliberately, not "fixed" into safety.

**Defer / anti-features (explicitly out of scope):**
- Any player-facing ability/spell/perk "choice" UI -- directly conflicts with the 100 percent dice-rolled identity Key Decision.
- Full itemization sandbox (affix rolling, enchanting, procedural magic items) -- wrong session length and wrong item-pool philosophy (hand-authored 8-per-category tables are legible because they are small).
- On-grid AoE telegraph/preview UI -- conflicts with the established "narration IS the telegraph, no new UI screens" finding.
- A universal "skeleton key" tool bypassing any hazard.
- Full always-on fog-of-war across the whole map (not just darkness-flagged squares).
- "Smart"/adaptive foe AI reacting to player build choices.

### Architecture Approach

Every rule domain remains a pure function of (state, rng, events) dispatched through engine/engine.js applyAction single chokepoint -- no DOM, no Math.random, no global mutable state outside state. v1.5 new work slots into this shape via two new modules (engine/effects.js for new timers, engine/abilities.js for a parallel hero-side ability dispatcher mirroring magic.js castSpell shape) plus targeted extensions to maze.js (water flag), items.js/derived.js (worn-slot model, eff() refactor), encounters.js (Cutthroat reversal), movement.js descend (murder hook), and combatMenu.js (ABILITIES submenu -- the seam already exists as a hard-disabled stub).

**Major components:**
1. engine/effects.js (new) -- owns only the new ability-cooldown, magic-item duration-then-cooldown, and timed-map-reveal timers; ticked from movement.js move per-step block and combat.js per-round tail, cleared at endCombat.
2. engine/abilities.js (new) -- a useAbility dispatcher parallel to magic.js castSpell, reading a new c.abilities/c.abilityCd map; wired into engine.js action-dispatch table as a new "useAbility" action type.
3. c.worn slot model plus eff() refactor (items.js/derived.js) -- the widest-blast-radius change in the milestone (15+ call sites read eff()); must land as its own regression-tested sub-phase before magic items or the Gear-tab split depend on it.
4. engine/maze.js genFloor with a water option, plus state.terrainRoll run flag -- the water-cell generator, parity-gated exactly like storeRoll.
5. Render-layer only: the 3x3 dark view is a pure draw() filter over already-seen cells, zero engine/state changes, zero parity risk -- the cheapest, most isolated item in the whole milestone.

### Critical Pitfalls

1. **New rng draws inserted before existing draws silently reorder every later roll** -- every new draw (item use, ability roll, Cutthroat murder check, water-square check) must be added strictly after all existing draws in its function and gated behind a feature condition false for every current fixture; measure draw-counts, never assume.
2. **Cooldown/duration timers desync between per-step and per-round ticking, or do not survive save/load** -- every new timer must declare explicitly which tick site owns it (squares vs. rounds) and follow the c.darkFor/f.cd additive-with-safe-default idiom so old saves load with the field simply absent, never crashing or auto-activating.
3. **Activated abilities and item cooldowns silently move the depth-20 curve without anyone re-running the matrix** -- treat this like the v1.1 to v1.2 retune history: capture a BEFORE matrix pin before any power lands, update the tuning bot policy to actually use new abilities/items FIRST (or the matrix is blind to them), then an AFTER matrix once spells, abilities and gear are code-complete -- one consolidated checkpoint, not per-feature guessing.
4. **Water/darkness phobia triggers must fire only on fresh entry into terrain, not every step inside a multi-square region** -- otherwise a "spice" mechanic becomes a near-permanent debuff, contradicting the existing Phase 31 ruling that phobia is "a penalty, never a lost action."
5. **New equipment slot-uniqueness rules can orphan items already legally double-equipped in old saves** -- this is the project first restrictive migration (all prior migrations were additive-with-default); it needs an explicit, narrated load-time reconciliation and a synthetic illegal-old-save test, not a silent drop or a crash.

## Implications for Roadmap

Phase numbering continues from 36 per PROJECT.md.
### Phase 36: Dead-foe targeting and Cutthroat Joiner reversal (small independent wins)
**Rationale:** Zero new state, zero dependencies on anything else in the milestone; cheapest possible wins that build early confidence and are naturally small enough to ride together.
**Delivers:** combat.js normalizeTarget called from killFoe; a shell-side tap-guard refusing dead-card taps; removal of the Cutthroat clause in meetJoiner refusal ternary so Cutthroats can accept Joiners.
**Addresses:** Combat targeting (dead foes never targetable, auto-switch) and the Cutthroat-can-accept-a-Joiner target feature.
**Avoids:** Pitfall 10 (retarget racing the guarded tap) by extending inputGuards.js test coverage in the same phase, not after.

### Phase 37: Generic effect/cooldown/timer model (engine/effects.js)
**Rationale:** Foundational -- blocks melee abilities, magic-item cooldowns, and the timed-reveal spell kind. Must land before anything that needs a new timer.
**Delivers:** tickSquareEffects/tickRoundEffects/clearCombatEffects, a new c.timers-style serialized field, one new parity strip helper.
**Uses:** The c.darkFor/f.cd/c.ward.rounds precedents from STACK.md/ARCHITECTURE.md -- do not retrofit existing fields.

### Phase 38: Equipment slot model plus eff() refactor
**Rationale:** Widest blast-radius change in the milestone (15+ eff() call sites); must land, fully regression-tested, before magic items or the Gear-tab split depend on it. Independent of Phase 37 effects model, so could run in parallel if resourced, but sequenced here to keep gear-related work contiguous.
**Delivers:** c.worn slot map, a slot field on jewelry/cloak/staff content rows, equipItem/unequipSlot extension, eff() rewritten to sum scalar-equipped plus worn items only.
**Addresses:** "One worn item per slot type" table-stakes feature; unblocks Phase 39 and Phase 42.
**Avoids:** Pitfall 8 (old-save migration) -- must ship a narrated, tested illegal-old-save migration in this same phase.

### Phase 39: Terrain (water squares plus parity-gated genFloor/terrainRoll plumbing)
**Rationale:** Independent subsystem from Phases 37-38 (maze/movement, not timers), but must land before phobias (Phase 40) since the Bodies-of-water phobia has no real trigger without it.
**Delivers:** water cell flag, state.terrainRoll run flag mirroring storeRoll, plus-2-step movement cost on water tiles.
**Avoids:** Pitfall 1 in its highest-stakes form -- the water-blob rng draw is the single largest parity risk in the milestone; it must be threaded through genFloor options parameter and appended strictly after every existing draw, gated so every current fixture/bot/old save is unaffected.

### Phase 40: Phobias (water/darkness/heights triggers) plus darkness 3x3 render filter
**Rationale:** Depends on Phase 39 for the water trigger; the 3x3 dark view is presentation-only and has no code dependency on phobias but pairs naturally (both are "make darkness matter").
**Delivers:** Fresh-entry-only phobia triggering (not per-step), the Heights hook reusing existing gorge/climb tiles, a draw()-level 3x3 fog filter gated on being in the dark without Night Vision.
**Avoids:** Pitfall 6 (phobia over-triggering) and Pitfall 7 (fog/reveal rendering collisions) -- needs a single render-state-precedence helper (permanent-explored vs. transient overlay), tested without a canvas.

### Phase 41: Melee active abilities (engine/abilities.js plus ABILITIES submenu) -- balance checkpoint start
**Rationale:** Depends on Phase 37 cooldown model; independent of gear/terrain work. Begins the shared power-additive balance checkpoint with Phase 42.
**Delivers:** Rolled ability pool at level 1/skill levels, a small (2-3 skill) initial passive-to-active conversion set, combatMenu.js existing ABILITIES stub branch filled in.
**Avoids:** Pitfall 5 (passive to active identity-contract breakage) -- every converted skill must be re-checked against docs/CLASS-PASS.md good/bad table and the identity-contract suite updated in this same phase, not deferred.

### Phase 42: Magic items use-to-effect-to-cooldown extension plus one-shot terrain tools
**Rationale:** Depends on Phase 37 (cooldown model) for duration-then-cooldown items and Phase 38 (worn-slot model) for worn magic items specifically; one-shot tools have no dependency on Phase 38 and could land earlier if convenient.
**Delivers:** every/usedAt wired onto STAVES and additional weapon/armor rows; rope/ladder/torch as new useItem cases hooked into the existing CLIMB IT major-overlay decision point.

### Phase 43: Spell rework (niche differentiation, day-one damage spells, timed Detect Magic, scroll-castable-immediately) -- balance checkpoint close
**Rationale:** Mechanically independent of gear/abilities work, but shares the SAME class-pass balance yardstick as Phase 41 -- land the tuning-bot policy extension (scoring for new abilities AND new spell niches) BEFORE running the consolidated BEFORE/AFTER matrix, then run ONE matrix diff covering Phases 41 plus 42 plus 43 together rather than three separate partial checkpoints.
**Delivers:** Re-derived offense-school niches, a distinct new timedReveal spell kind (provenance-tracked, decoupled from the 3x3 dark view per Phase 40), guaranteed day-one damage spells per wizard sub.
**Avoids:** Pitfall 3 (power creep un-measured) and Pitfall 4 (situational spells never picked by the bot) -- every new spell/ability needs a corresponding scoring branch and a measured pick-rate in the class-pass ledger before this phase is considered done.

### Phase 44: Flee retune
**Rationale:** Fully isolated to combat.js flee and its combatMenu.js display mirror; no dependency on anything else. Sequenced after the power-additive checkpoint (survivability retuning against a settled power baseline, not a moving one).
**Delivers:** Lower baseline chance, small class/race modifiers, roll/need shown transparently in the fight log.

### Phase 45: Clarity pass (cause-naming, loot legibility, Gear On You/Bag split, rations-per-camp)
**Rationale:** Depends on Phase 38 (worn-slot model, for the Gear split) and touches the final shape of every feature above -- a cooldown refusal needs to exist before its refusal reason can be named. Best done last, or continuously feature-by-feature as each phase lands (each of Phases 37-44 should proactively add its own cause payload field at the point of introduction) rather than as one giant terminal retrofit.
**Delivers:** EVENT_NARRATION/toast-table cause fields sourced from event payload (never hand-written duplicate strings), "(usable by ...)" tags, the On You/Bag panel split, rations-per-camp on the Hero screen sourced from the same function makeCamp refusal already uses.
**Avoids:** Pitfall 11 (ad-hoc cause naming bypassing the coverage guard) -- every change must keep toastsCoverage.test.js/formatEventsCoverage.test.js green.

### Phase Ordering Rationale

- Power-additive phases (37-38, 41-43) precede survivability-changing phases (39-40, 44) -- retuning phobia penalties or flee odds against a moving player-power target is far harder than retuning once power is settled; this mirrors the project own "ONE consolidated difficulty retune" lesson applied at milestone-internal scale.
- The eff()/worn-slot refactor (38) is deliberately isolated from new content -- its blast radius (15+ call sites) means bugs there would be indistinguishable from new gear/ability bugs if bundled together.
- Terrain (39) precedes phobias (40) because the Bodies-of-water phobia literally cannot fire without water tiles existing.
- Melee abilities and spells (41, 43) share one balance checkpoint, not two, to avoid the exact "under-measured caster" mistake the v1.1 to v1.2 history already made once -- the tuning bot must be extended to use both new systems before either checkpoint matrix is trusted.
- Clarity (45) is last because it is a wiring/display pass over the final shape of every other feature, but every earlier phase should still proactively add cause-payload fields per Pitfall 11, so this phase is a sweep, not a retrofit scramble.

### Research Flags

Phases likely needing deeper research/design discussion during plan-phase:
- **Phase 39 (Terrain):** the genFloor/terrainRoll parity-gating mechanism is high-stakes and has exactly one correct shape (mirror storeRoll precisely) -- the phase own plan must include a live fixture-roster scan and an explicit draw-count table before any code lands.
- **Phase 40 (Phobias/darkness):** the re-fog provenance question (does normal walking after a timed-reveal spell earn back knowledge, or does everything the spell touched re-fog unconditionally) is an explicitly flagged open design call needing a ratified decision, not an implementation default.
- **Phase 41 (Melee abilities):** which specific Special Skills convert to actives (vs. staying passive) is a per-skill judgment call requiring the good/bad identity-contract table review before implementation -- needs its own discussion pass.
- **Phase 43 (Spell rework):** the niche re-derivation (which offense spells become DOT vs. burst vs. AoE, and the exact control-spell scope/duration axis) is a genuine design/balance decision, not a mechanical extension -- benefits from a dedicated design discussion before coding.

Phases with standard, already-precedented patterns (can likely skip a research-phase pass):
- **Phase 36 (targeting/Cutthroat):** both changes are fully specified by existing code precedent (display suppression already correct, refusal ternary already isolated).
- **Phase 37 (effects model):** shape is fully specified in ARCHITECTURE.md Section 1 recommendation.
- **Phase 42 (magic items/tools):** extends a proven, already-shipped pattern (itemReady/useItem) to more tables.
- **Phase 44 (flee retune):** pure numeric retune of one existing formula, isolated to one function.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every recommendation is grounded in direct file:line reads of the live engine; no external library research needed since zero new dependencies are introduced |
| Features | HIGH (codebase claims) / MEDIUM (comparable-game design patterns) | Direct reads of content/spells.js, content/skills.js, content/treasure-tables.js, etc. are HIGH; DCSS/Spire/SPD/Hoplite design-pattern citations are MEDIUM (web research, not code-verified against those engines) |
| Architecture | HIGH | Every integration point is a direct code read with file:line citations; only a few explicitly-flagged open design calls (re-fog provenance, water movement-cost side effects, ability-conversion scope) are genuinely undetermined |
| Pitfalls | HIGH | Every pitfall is tied to a concrete file/function/precedent already in this codebase (rng.js, comparables.js, inputGuards.js, CLASS-PASS.md, DIFFICULTY-RETUNE.md), not generic advice |

**Overall confidence:** HIGH

### Gaps to Address

- **Re-fog provenance for timed map reveal** (ARCHITECTURE.md Section 3): whether normal exploration during a Detect Magic window should keep cells it would have revealed anyway is an explicit open design call -- must be ratified as a Key Decision in Phase 43 plan, not defaulted silently.
- **Water shared-counter side effect on cadences** (state.steps driving both movement cost and every squares-based cooldown/cadence): the phase 39 plan must explicitly ratify this as intended flavor (water tiles accelerate cadences per tile crossed) or introduce a separate state.moves counter -- a real design decision, not an accident to discover in QA.
- **Which Special Skills convert to actives** (ARCHITECTURE.md Section 4, PITFALLS.md #5): needs a per-skill design pass against the good/bad identity-contract table before Phase 41 implementation begins; recommend starting with a small (2-3 skill) initial set rather than the whole catalog.
- **Whether Shield-pool-on-Hero is already satisfied** by the existing conditionsOf/ward-chip infrastructure from v1.3 Phase 31 -- verify scope before treating as new engine work; likely only needs a Hero-tab-specific display, not new state.
- **Cutthroat murder odds and the exact roll formula**: FEATURES.md/PITFALLS.md agree the odds must be low and explicitly documented to the player (a rail card on first Joiner acceptance), but the precise probability is a balance call for Phase 36 own plan, not pre-determined by research.

## Sources

### Primary (HIGH confidence -- direct code/document reads)
- engine/movement.js, engine/items.js, engine/derived.js, engine/foeAbilities.js, engine/combat.js, engine/magic.js, engine/maze.js, engine/state.js, engine/encounters.js
- content/spells.js, content/skills.js, content/treasure-tables.js, content/weapons.js, content/armors.js, content/potions.js, content/flavor.js
- test/parity/harness/comparables.js, test/unit/mapMarks.test.js, test/unit/shell-map-invariants.test.js, test/unit/toastsCoverage.test.js, test/unit/formatEventsCoverage.test.js, test/voice/safety-scan.test.js
- src/browser/combatMenu.js, src/browser/combatPanel.js, src/browser/inputGuards.js, src/browser/eventNarration.js, src/browser/toasts.js
- mazeworld.html (Gear tab, foe-card tap wiring, draw())
- tools/tune-classes.mjs, docs/CLASS-PASS.md, docs/DIFFICULTY-RETUNE.md, docs/USABLE-FEATURES-AUDIT.md
- .planning/PROJECT.md (v1.5 Current Milestone section, Key Decisions, Constraints), .planning/STATE.md, .planning/MILESTONES.md

### Secondary (MEDIUM confidence -- web research, design consensus, not code-verified)
- DCSS spell-buff/situational-design commentary -- crawl.develz.org, crawl.akrasiac.org
- Slay the Spire situational-card philosophy -- Cloudfall Studios blog, Slay the Spire Wiki
- Shattered Pixel Dungeon wand/artifact charge-cooldown and equipment-slot design -- shatteredpixel.com, Pixel Dungeon Wiki
- Hoplite ability/cooldown/kit-size design -- Giant Bomb, ResetEra, Magma Fortress
- General roguelike flee-escape and fog-of-war design consensus -- genre-level pattern, cross-checked against Mazeworld own stated formula

---
*Research completed: 2026-09-17*
*Ready for roadmap: yes*
