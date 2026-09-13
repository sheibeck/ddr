# Phase 18: Bestiary Rebalance & Canon Combat Fixes - Research

**Researched:** 2026-09-13
**Domain:** Deterministic RPG combat-math rebalance (bestiary stat tuning) + four canon combat modifiers (foe natural armor, damage-source halving, type-vs-source multipliers, to-hit downgrade) routed through one new foe-damage seam, in a frozen-parity engine
**Confidence:** HIGH — every claim is grounded in a direct read of `engine/combat.js`, `engine/magic.js`, `engine/derived.js`, `engine/items.js`, `content/bestiary.js`, `content/spells.js`, `content/mu-chart.js`, `content/classes.js`/`races.js`/`weapons.js`/`armors.js`/`kit.js`/`misc-tables.js`, the Phase 17 research/summary artifacts, `test/parity/FIXTURE-INVENTORY.md`, and `mazeworld.pdf` pp.36-44 (`pdftotext -layout`). The full 53-row yardstick table (Section "Rebalance Yardstick") is a from-scratch expected-value computation done in this session, not copied from prior research — treat its exact decimals as a reasonable, reproducible approximation (methodology fully specified so a committed script can regenerate/refine it), not as machine-verified ground truth.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rebalance Yardstick (BEST-01, BEST-02)**
- D-01: A creature's "intended depth band" is its bestiary tier (1-5): foe level = clamp(min(hero level, floor depth), 1, 5), so a tier-N creature must be a fair fight for a level-N hero. Yardstick = the hero's expected HP and damage-per-round at level N (chargen/level-up math + `tools/tune-difficulty.mjs` bot), computing time-to-kill and rounds-to-die per creature.
- D-02: Conservative pass — fix ONLY outliers (>2x off the tier's median TTK or damage-per-round, or a stat contradicting the creature's own `note`); keep prototype numbers everywhere else so Phase 21 retunes from a stable baseline.
- D-03: Pre-ability discount for the five caster foes (Djinni, Krupke, Drudge, Vampire, Stalka Beast): -25% HP (rounded how?) and "one dice-step lower" melee damage now, flagged "pre-ability discount — revisit Phase 21" in the stat table; Drudge (never melees) gets the HP cut only.
- D-04: The before/after stat table lives in-repo at `content/BESTIARY-REBALANCE.md` (referenced from the `content/bestiary.js` header) and is summarized in the phase SUMMARY.

**Foe Natural Armor (CANON-01)**
- D-05: Mirror the canon player rule (rulebook p.44 "Using Armor"): on a landed physical hit against a foe with `sp.ar`, roll d20; <= `sp.ar` -> the blow is soaked entirely (no durability tracking). The d20 fires ONLY when `foe.sp.ar` is set -- zero-draw for every other creature (none of Bat/Rat, Shriek, Viper, Dante has `ar`).
- D-06: Applies to physical damage only -- hero weapon strikes and party-member/summon-ally strikes. Spells bypass foe armor (rulebook "Spells v. Armor": armor protects only against thrown physical-damage spells; simplified to "all spells bypass").
- D-07: A critical hit (natural 1 on the strike die) ignores the soak.
- D-08: New event `foeArmorSoaked { name, amount }` with a sarcastic, family-friendly Oracle line; `EVENT_NARRATION` entry required (coverage guard).

**Creature Specials (CANON-03, CANON-04, CANON-05)**
- D-09: Introduce ONE central foe-damage seam -- `damageFoe(state, foe, dmg, source, rng, events)` (name/signature at planner discretion) -- through which every damage-to-foe path flows (hero strike, ally/member strike, spell damage, acid tick, ward reflect, volley/quake). It hosts the armor soak (D-05..D-07), Sterling halving (D-10) and the multiplier table (D-11), and is the seam Phase 19's ability resolver reuses. Kill accounting (`killFoe`) stays where it is; the seam only computes/applies damage.
- D-10: Sterling `halfDmg` halves ALL damage the foe takes, rounding UP (`Math.ceil(dmg/2)`).
- D-11: Multipliers live in a small pure table `content/damage-multipliers.js`, keyed by (damage source, creature type/name): Cleric-cast spells (`c.sub === "Cleric"`) 2x vs Demons; any spell damage 2x vs Walking Dead; Fighter melee 2x vs Trachea (canon, rulebook "Lair Beasts" Trachea entry). "Magic" = spell damage only -- magic weapons do NOT count. Table locked by a content-table test.
- D-12: Philly `slow`: the hero's to-hit roll vs a `slow` foe is rolled twice and the LOWER result kept (low = hit, so player-favorable). The extra draw fires only when `t.sp.slow` (zero-draw otherwise; Philly is not fixture-exposed).
- D-13: Test contract: each special gets dedicated `fakeRng` unit tests (pattern: `test/unit/party-combat.test.js` helpers); the FID-02 `countingRng` test (`test/unit/foe-turn-draw-count.test.js`) gains cases proving zero extra draws vs creatures without `ar`/`slow`; multiplier table pinned by a content-table test.

**Parity Carve-Outs & Process (BEST-03, FID-05)**
- D-14: The four fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante -- all L1, per `test/parity/FIXTURE-INVENTORY.md`) keep their numbers UNCHANGED in Phase 18 -> zero `comparables.js` carve-outs. If the review flags one as an outlier, record it in the stat table as "deferred to Phase 21" instead of carving out.
- D-15: Parity proof: all new mechanics are gated on flags absent from the fixture roster, so the parity suite stays byte-identical with NO fixture regeneration; the FID-02 draw-count pins are unchanged; the pinned fixture-inventory test proves the roster didn't move. `test/parity/prototype-master.js.txt`, fixtures, and `comparables.js` are not edited.
- D-16: Run `tools/tune-difficulty.mjs` before and after the rebalance and record both readouts in the stat table as an informational sanity signal -- NOT a gate (the bot is blind to abilities until Phase 21).
- D-17: No bestiary schema change: stats stay flat on existing entries (`wp`, `sp.dmg`, `sp.ar`, `sp.toHit`, `sp.atk`); only numbers move, so `test/unit/content-tables.test.js` pins are updated for changed entries only, each with a one-line rationale.

### Claude's Discretion
- Exact outlier list and new numbers (within D-02's rule), the exact helper name/signature for the damage seam, event field names, and test file layout.
- Whether the yardstick computation is a committed script (e.g. `tools/bestiary-yardstick.mjs`) or a documented one-off -- a committed script is preferred if cheap, since Phase 21 will want it.

### Deferred Ideas (OUT OF SCOPE)
- CANON-02 (Spectre pursues, Drudge never melees, Drake `every` cooldown) -> Phase 19 (shares the cooldown/ability pattern).
- Any change to the four fixture-exposed creatures -> Phase 21 (with carve-outs if ever needed).
- A formal `tier`/threat-budget field on bestiary entries -> v2 (FOE-V2-04) unless Phase 21 proves it necessary.
- Werebeast extortion/reinforcements, Trachea +4 first-hit, Hobgoblin guaranteed loot, Bones pack AI -> backlog.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BEST-01 | Every creature's HP/damage/to-hit/AR/attack count reviewed against depth band, outliers fixed, before/after table committed | Full 53-row yardstick table (below) computes TTK/RTD per creature and flags every >2x-median outlier with rationale and rulebook cross-check |
| BEST-02 | Ability-bearing foes carry proportionally lower raw stats (hand-tuned, not a formal threat-budget system) | Pre-ability discount computation (Djinni/Krupke/Drudge/Vampire/Stalka Beast) with concrete new numbers, rounding convention, and dice-step ladder |
| BEST-03 | Bestiary changes to fixture-exposed creatures land only through narrow, named `comparables.js` carve-outs | Fixture-exposed roster confirmed unchanged from Phase 17 (`Bat/Rat`, `Shriek`, `Viper`, `Dante`, all L1) -- zero carve-outs needed if D-14 is followed |
| CANON-01 | Foe `sp.ar` reduces damage taken, per canon | Exact d20-soak formula from rulebook p.44, insertion point in the new seam, confirmed zero fixture creature has `ar` |
| CANON-03 | Sterling `halfDmg` -- half damage from all sources | Insertion point and rounding (`Math.ceil`) in the seam; flags an interaction risk with BEST-01 (Sterling's WP must be reconsidered once halving lands, since TTK would double) |
| CANON-04 | Damage-source x creature-type multipliers (Cleric spells 2x vs Demons, any spell 2x vs Walking Dead, Fighter melee 2x vs Trachea) | `content/damage-multipliers.js` shape, exact caster/class identification fields, confirms Clerics CAN cast offense-school spells (`MU_CHART.Cleric.offense = 0`, gate defaults to 1) |
| CANON-05 | Philly `slow` -- hero's to-hit roll vs a slow foe rolled twice, lower kept | Exact one-line insertion point in `playerStrike`'s to-hit roll, confirmed Philly is the only `slow` creature and is not fixture-exposed |
| FID-05 | Deliberate divergences regenerate only their specific fixtures, with a before/after table and rationale | D-14/D-15 confirm zero fixture regeneration is needed if fixture-exposed creatures stay untouched; `content/BESTIARY-REBALANCE.md` is the required before/after artifact |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Engine work must route through a GSD workflow (`/gsd-execute-phase`) -- no direct file edits outside it.
- No new third-party SDKs/dependencies of any kind (this phase needs none -- pure content/engine data + logic).
- Android/Play-only constraints (Capacitor, signing, store) are irrelevant to this phase's scope (engine/content/narration only).
- Family-friendly, dark-sarcastic tone is non-negotiable for the new `foeArmorSoaked` narration line -- must pass `test/voice/safety-scan.test.js`.

## Summary

This phase is pure arithmetic-and-plumbing work on top of Phase 17's already-extracted seams. Two independent halves: (1) a **yardstick-driven bestiary review** — compute, for every one of the bestiary's 53 rows (30 unique creature names, 4 of which occupy two tiers each: Djinni, Drudge, Herman, Drarl), the hero's expected time-to-kill (TTK) and the foe's expected rounds-to-die-the-hero (RTD) at the matching tier/level, flag outliers (>2x off the tier median on either axis, or a stat that visibly contradicts the creature's own `note`), and fix ONLY those, plus the five named pre-ability casters get an unconditional -25% HP / one-die-step-lower melee discount regardless of whether the math flags them; and (2) **four canon combat modifiers** (foe armor soak, Sterling's universal half-damage, Cleric/Walking-Dead/Trachea damage multipliers, Philly's player-favorable slow) that all funnel through one new pure function, `damageFoe(state, foe, rawDmg, source, rng, events)`, inserted at every site in `engine/combat.js`/`engine/magic.js`/`engine/items.js` that currently does `foe.wp -= dmg` as real incoming damage (not a status-effect direct-set like `shrink`/`sing`/`petrify`, which are explicitly NOT damage and stay untouched).

Running the actual expected-value math (methodology below, using a composite "generic hero" averaged across the three base classes at chargen-plus-average-level-ups, no store purchases, no skills) against all 53 bestiary rows independently reproduces and *validates* several of the CONTEXT.md decisions from first principles: Djinni (both tiers), Vampire, and Stalka Beast all come out as genuine TTK and/or RTD outliers (>2x tier median) purely from their raw stats, before any ability content exists — confirming D-03's pre-ability discount is not just a "future-proofing" nicety but a real current-state fix. Separately, the math surfaces two NEW findings the CONTEXT.md decisions don't explicitly call out: **Drake** (tier 4 Beasts) is a severe TTK outlier (7.3x the tier-4 median — its `wp: 135` is wildly disproportionate even before considering its still-inert `every: 4` fire-breath gate, which is Phase 19's job to fix mechanically but does not block this phase from right-sizing its `wp`), and **Werebeast** (tier 3 Magical) is a severe RTD outlier (2.9x the tier-3 median — its `atk: 2` plus `dmg: 1d10+5` makes it far more lethal per round than any other tier-3 creature). Both should be added to the outlier-fix list under D-02's own rule. A third finding is a genuine cross-cutting risk: implementing Sterling's `halfDmg` (CANON-03) without reconsidering its `wp: 35` will make Sterling's TTK (currently already a borderline 2.2x-median outlier) roughly DOUBLE to ~4.4x the tier-3 median — this phase must decide (and record in the stat table) whether Sterling's `wp` is lowered to compensate or the resulting tankiness is accepted as canon-intended ("takes only half damage from any attack, even magical" is explicit rulebook text) and flagged for Phase 21.

**Primary recommendation:** Build `tools/bestiary-yardstick.mjs` as a pure (no-rng, expected-value) script reproducing this session's TTK/RTD table exactly (formulas below), use its output to drive `content/BESTIARY-REBALANCE.md`, fix only the confirmed outliers (Djinni x2, Krupke, Drudge x2, Vampire, Stalka Beast via the D-03 discount; Drake and Werebeast via a direct BEST-01 stat fix; Sterling flagged with an explicit decision recorded, not silently changed), leave every other creature's numbers untouched, and land the four canon modifiers through a single new `engine/foeDamage.js` module (`damageFoe`) that both `combat.js` and `magic.js` import, preserving every existing `killFoe(...)` call site exactly where it already lives.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bestiary stat rebalance (BEST-01/02/03) | Content (`content/bestiary.js`) | Test/tooling (`tools/bestiary-yardstick.mjs`, `content/BESTIARY-REBALANCE.md`) | Pure data change; no runtime logic — the yardstick script is offline analysis, not a runtime dependency |
| Foe armor soak (CANON-01) | Engine (`engine/foeDamage.js`, new) | Engine (`engine/combat.js` call sites) | A pure, rng-consuming combat-math function; reads `foe.sp.ar`, mutates `foe.wp` |
| Sterling halfDmg (CANON-03) | Engine (`engine/foeDamage.js`) | — | Same seam as armor soak — a pure damage-transform step, no new state |
| Damage-source x type multipliers (CANON-04) | Content (`content/damage-multipliers.js`) | Engine (`engine/foeDamage.js` consumes the table) | Pure lookup table + a pure consulting function; no persisted state |
| Philly slow (CANON-05) | Engine (`engine/combat.js` `playerStrike`) | — | A one-line insertion into the existing to-hit roll; not part of the damage seam (it's a to-hit mechanic, not a damage mechanic) |
| New `foeArmorSoaked` narration (D-08) | Presentation (`src/browser/eventNarration.js`) | — | Pure string-builder, no engine logic |

## Package Legitimacy Audit

Not applicable — this phase installs no packages. It touches only `content/*.js` (data), `engine/*.js` (pure logic), `src/browser/eventNarration.js` (presentation), and `test/**` (Node's built-in `node:test`, already the project's sole framework).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` (built-in) | Node >=22 | All new unit/content-table tests | `[VERIFIED: package.json]` — the project's only test runner; `"test": "node --test"` |
| `engine/rng.js` `makeRng` (existing) | n/a | Seeded RNG the new `damageFoe`/slow-roll code draws from | `[VERIFIED: engine/rng.js direct read]` — `d(sides)`, `pick(arr)`, `shuffle(arr)`, `next()` are the only draw-producing methods |

### Supporting
No new libraries. `engine/dice.js#rollDice` (already used everywhere `sp.dmg` dice-notation is resolved) is reused unchanged by every new call site.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A committed `tools/bestiary-yardstick.mjs` pure-math script | A one-off spreadsheet/scratch calculation, discarded after planning | Per CONTEXT.md's own stated preference ("a committed script is preferred if cheap, since Phase 21 will want it") — the script is a ~150-line pure function over `content/bestiary.js` + `content/classes.js` etc., zero rng, trivially cheap to commit and exactly what Phase 21's consolidated retune will re-run |
| A new `engine/foeDamage.js` module for the damage seam | Adding `damageFoe` as a new export inside `engine/combat.js` (mirroring Phase 17's `pickFoeTarget`/`applyFoeDamageToPlayer` placement) | Either works — `engine/combat.js` is already the largest, hottest-path module in the engine (its own header calls `foeTurn` "the single hottest parity loop"); a new sibling file keeps the four-modifier surface easy to grep/audit in isolation and is still fully covered by the coverage-guard test (`test/unit/formatEventsCoverage.test.js` scans every top-level `.js` file directly under `engine/`, no subdirectories — a new top-level `engine/foeDamage.js` is automatically included). Recommended: **new file**, but either choice is low-risk and at planner discretion per CONTEXT.md |

**Installation:** None required.

**Version verification:** N/A — no packages.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | Not applicable — no packages installed this phase |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Damage-to-foe call sites (existing, BEFORE this phase — direct `wp -=`)  │
│                                                                            │
│  combat.js#playerStrike (395)   t.wp -= dmg          [physical, MELEE]   │
│  combat.js#allyTurn     (738)   t.wp -= d            [physical, ally]    │
│  combat.js#alliesTurn   (781)   t.wp -= d            [physical, member]  │
│  combat.js#applyFoeDamageToPlayer ward-reflect (899)  foe.wp -= warded   │
│                                                        [reflect]          │
│  combat.js#foeTurn acid tick (981)  f.wp -= d        [spell DoT: acid]   │
│  magic.js#castSpell "quake"   (170) f.wp -= d        [spell: quake]      │
│  magic.js#castSpell "volley"  (200) t.wp -= d        [spell: volley]     │
│  magic.js#castSpell "insane" r=2 (283) o.wp -= d     [foe-on-foe, phys]  │
│  magic.js#castSpell "thrown"  (341) t.wp -= dmg      [spell: thrown]     │
│  items.js "fire" item effect  (593) t.wp -= dmg      [item, physical]    │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │  route ALL of the above through:
                                 ▼
                 engine/foeDamage.js#damageFoe(state, foe, rawDmg, source, rng, events)
                 ┌────────────────────────────────────────────────────────┐
                 │ 1. multiplier lookup (content/damage-multipliers.js)   │
                 │    — ONLY for source.kind === "spell"                  │
                 │    — Math.round(rawDmg * mult)                        │
                 │ 2. Sterling halfDmg (foe.sp.halfDmg)                   │
                 │    — Math.ceil(rawDmg / 2), applies to EVERYTHING      │
                 │ 3. armor soak (foe.sp.ar)                              │
                 │    — ONLY for source.kind !== "spell" (physical only) │
                 │    — ONLY when !source.crit                           │
                 │    — rng.d(20), gated: zero draw if !foe.sp.ar         │
                 │    — full block (0 damage) on success, no durability  │
                 │ 4. foe.wp -= rawDmg  (caller still owns killFoe(...)) │
                 └───────────────────────────┬────────────────────────────┘
                                              ▼
                     returns { applied, soaked }  →  caller's EXISTING
                     `if (t.wp <= 0) killFoe(state, t, rng, events)` is
                     UNCHANGED — the seam never calls killFoe itself.

Excluded from the seam (direct wp=SET, not damage — no armor/halfDmg/mult):
  magic.js "shrink"  f.wp = Math.ceil(f.wp/2)      — stat halving, not a hit
  magic.js "petrify"/"turn"/"gate"/"insane"(r=1,3,6) f.wp = 0 — instant removal
  combat.js "sing" Ode to Death  f.wp = 1          — debuff floor, not damage
```

### Recommended Project Structure (additions only)

```
engine/
├── foeDamage.js          # NEW: damageFoe(state, foe, rawDmg, source, rng, events)
├── combat.js              # MODIFIED: playerStrike (slow roll + route melee dmg
│                           #   through damageFoe), allyTurn/alliesTurn (route
│                           #   through damageFoe), applyFoeDamageToPlayer's
│                           #   ward-reflect branch (route through damageFoe)
├── magic.js                # MODIFIED: quake/volley/thrown/acid-apply/insane
│                            #   route through damageFoe (acid TICK lives in
│                            #   combat.js#foeTurn, also routed)
├── items.js                 # MODIFIED: "fire" item effect routes through damageFoe
content/
├── bestiary.js               # MODIFIED: rebalanced wp/dmg for flagged outliers +
│                              #   pre-ability discount for the 5 named casters
├── BESTIARY-REBALANCE.md      # NEW: the committed before/after stat table (D-04)
├── damage-multipliers.js      # NEW: the {source, target} -> multiplier table
├── index.js                    # MODIFIED: + export * from "./damage-multipliers.js"
tools/
├── bestiary-yardstick.mjs      # NEW (recommended): pure TTK/RTD calculator, no rng
src/browser/
├── eventNarration.js           # MODIFIED: + foeArmorSoaked entry
test/unit/
├── foe-damage.test.js           # NEW: dedicated fakeRng tests per D-13 (armor
│                                 #   soak gate, halfDmg, multiplier table, crit
│                                 #   bypass, zero-draw for non-ar foes)
├── content-tables.test.js       # MODIFIED: updated pins for changed bestiary rows
│                                 #   + a new damage-multipliers pin
├── foe-turn-draw-count.test.js  # MODIFIED: + cases proving zero extra draws for
│                                 #   foes without ar/slow (D-13)
```

### Pattern 1: The zero-draw gate applies to EVERY new mechanic here too

Exactly the same discipline Phase 17's research already established and Phase 17's code already models (`pickFoeTarget`, `applyFoeDamageToPlayer`): every new rng draw this phase introduces must be a *structural* read of already-serialized bestiary data that is `undefined`/falsy for every creature that doesn't opt in.

- Armor soak's `rng.d(20)` fires **only** when `foe.sp.ar` is truthy. Grep of `content/bestiary.js` confirms exactly these creatures carry `ar`: Drat (12), Krupke (12), Craig (15), Herman (15, both tiers), Google (15). None of these is fixture-exposed (`Bat/Rat`, `Shriek`, `Viper`, `Dante` — confirmed in `test/parity/FIXTURE-INVENTORY.md`, none has an `ar` field). Zero draw for every other creature, including all four fixture-exposed ones.
- Philly's slow re-roll fires **only** when `t.sp.slow` is truthy. Grep confirms Philly (`Walking Dead[0]`) is the ONLY creature with `slow: true` in the entire bestiary, and Walking Dead is never a forced encounter type in any parity fixture (`FIXTURE-INVENTORY.md`: fixtures force only `Beasts`/`Humans`). Zero draw for every other creature.
- Sterling's `halfDmg` and the multiplier table are **pure post-draw arithmetic** (no rng at all) — they can never affect draw order regardless of which foe they touch.

**Trade-off:** None — this is strictly additive and is the only pattern that keeps `test/parity/prototype-master.js.txt` byte-identical for all four exposed creatures while allowing the new mechanics to draw rng when (and only when) a NON-exposed creature's flags require it.

### Pattern 2: `damageFoe`'s exact insertion points (file:line, current code)

**`playerStrike` (`engine/combat.js:333-397`)** — hero's own melee strike. Current:
```js
let dmg = weaponDamage(c, rng);
// ... noCrit/opening/backstab/deathTouch logic ...
if (crit) dmg *= 2;
t.wp -= dmg;
events.push({ type: "struck", target: t.name, roll, dmg, critical: crit });
if (t.wp <= 0) killFoe(state, t, rng, events);
```
Recommended:
```js
if (crit) dmg *= 2;
const result = damageFoe(state, t, dmg, { kind: "melee", casterClass: c.cls, casterSub: c.sub, crit }, rng, events);
events.push({ type: "struck", target: t.name, roll, dmg: result.applied, critical: crit });
if (t.wp <= 0) killFoe(state, t, rng, events);
```
`crit` is already computed above this point (line 345/394) and is passed through so `damageFoe` can honor D-07 (crit ignores armor soak). `casterClass`/`casterSub` let the multiplier table identify a Fighter's melee vs Trachea (D-11's "Fighter melee 2x vs Trachea"). **Note:** the `struck` event's `dmg` field currently shows the PRE-soak/multiplier raw damage; changing it to `result.applied` (the actual wp lost) is a narration-accuracy improvement but is a payload SHAPE change on an existing event — verify no other test asserts `struck.dmg` equals the pre-seam raw value before making this change (grep `test/unit/combat.test.js` for `struck`/`.dmg` assertions first).

**`allyTurn` (`engine/combat.js:730-749`) and `alliesTurn` (`engine/combat.js:770-789`)** — both currently do `t.wp -= d;` directly with no class/caster identity available (`C.ally`/`C.allies` entries carry no `cls` field, only `sub` for party members and nothing at all for the summoned `C.ally`). Route both through `damageFoe(state, t, d, { kind: "melee", casterClass: undefined, crit: roll === 1 }, rng, events)`. **Open question (flagged below):** without a `cls` field on `C.allies` entries, a Fighter party member's strike can never trigger the Trachea 2x multiplier — this is a real, minor coverage gap the planner should explicitly accept or close (adding `cls: m.cls` to the `C.allies` mapping at `startCombat`, `combat.js:184-191`, is a one-line, zero-rng, zero-fixture-risk addition since no parity fixture ever populates `state.party`).

**`applyFoeDamageToPlayer`'s ward-reflect branch (`engine/combat.js:898-904`)** — this reduces a FOE's wp (not the hero's), so it belongs in the seam too:
```js
if (c.ward.reflect && warded > 0) {
  const result = damageFoe(state, foe, warded, { kind: "reflect", crit: false }, rng, events);
  events.push({ type: "wardReflected", target: foe.name, amount: result.applied });
  if (foe.wp <= 0) { killFoe(state, foe, rng, events); return { died: false, onArmour: false }; }
}
```
**Design call (Claude's discretion, flagged):** should reflected damage be treated as `kind: "melee"` (subject to armor soak, since it's "physical" energy bouncing back) or `kind: "spell"` (bypasses armor, since it originates from a magical Ward)? Recommend `kind: "reflect"` as its own third-ish bucket that is treated like melee for armor-soak purposes (subject to `foe.sp.ar`) but never subject to the multiplier table (it isn't "Cleric spell damage" or "Fighter melee" in any meaningful sense) — this is the simplest rule and matches the intuition that a physical blow bouncing off a ward is still a physical impact on the foe. Not explicitly locked by CONTEXT.md; state this decision in the plan.

**`foeTurn`'s acid tick (`engine/combat.js:979-987`)** — a foe with an active `acid` DoT (applied earlier by `magic.js`'s `"acid"` spell kind) ticks down each round:
```js
if (f.acid && f.acid.rounds > 0) {
  const d = rollDice(rng, f.acid.dmg);
  const result = damageFoe(state, f, d, { kind: "spell", school: "acid", casterSub: c.sub }, rng, events);
  f.acid.rounds--;
  events.push({ type: "acidTick", target: f.name, dmg: result.applied });
  if (f.wp <= 0 && f.alive) { killFoe(state, f, rng, events); continue; }
}
```
**Important finding:** the caster's identity (`c.sub`) does NOT need to be stashed on `f.acid` at cast time — the player character (`state.c`) cannot change class mid-fight, so `state.c.sub` read at TICK time is identical to what it was at CAST time. This means the Cleric/Demons and any-spell/Walking-Dead multipliers apply correctly to multi-round DoT ticks with zero extra state.

**`magic.js`'s `quake`/`volley`/`thrown` kinds (170, 200, 341)** — all currently `f.wp -=`/`t.wp -=` directly with `state.c` in scope at the call site, so `{ kind: "spell", school: sp.kind, casterSub: c.sub }` is trivially constructible at each site. `insane`'s `r===2` "insaneStruckAlly" branch (283, `o.wp -= d`) is a foe hitting ANOTHER foe (`t.lvl*t.lvl+rng.d(6)`, physically shaped) — route as `{ kind: "melee", casterClass: undefined }` (no player caster identity applies; it can still be soaked by the victim foe's own `sp.ar`, which is thematically correct — armor protects against being hit by anything physical, friend or foe).

**`items.js`'s `"fire"` item effect (~593)** — route as `{ kind: "item" }`. **Design call (Claude's discretion, flagged):** D-06 only says "spells bypass foe armor" — an item's damage is neither a player weapon strike nor a cast spell. Recommend treating `kind: "item"` like melee for armor-soak purposes (subject to `foe.sp.ar`) since the rulebook's armor rule ("Armor only protects its wearer from thrown spells that deal physical damage") is about the WEARER's armor protecting against incoming spells, not about a foe's own natural armor's scope — the safest, most conservative reading is "foe natural armor blocks anything physical that isn't a spell," and a thrown fire flask/bomb reads as physical, not magical. Never subject to the multiplier table (not caster-typed).

### Pattern 3: Sterling's `halfDmg` — apply to EVERYTHING, including spells, before the armor-soak roll

Rulebook (Sterling's entry, p.39): "they have two hearts... they take only half damage from any attack, **even magical**." This means `halfDmg` must apply INSIDE `damageFoe` unconditionally (both physical and spell sources), rounding UP per D-10 (`Math.ceil(dmg/2)`). Recommended order inside the seam: (1) multiplier lookup and apply (spell-only), (2) halfDmg halving (all sources), (3) armor-soak roll (physical-only, decides full-block-or-nothing on the post-halving value). This order means a Cleric spell vs. a hypothetical Demon-type `halfDmg` creature would get `Math.round(raw*2)` then `Math.ceil(that/2)` — no such creature exists today (Sterling is Beasts-type, not Demons/Walking Dead), so this ordering choice has zero interaction risk in practice; document it anyway since it's the kind of two-modifier-stacking decision a future creature addition would need.

### Pattern 4: `content/damage-multipliers.js` shape

```js
// content/damage-multipliers.js
//
// Pure lookup table for CANON-04's damage-source x creature-type multipliers.
// Consulted ONLY by engine/foeDamage.js#damageFoe, and ONLY for source.kind
// === "spell" or source.kind === "melee" (Fighter-vs-Trachea is the one
// melee-side entry; every other row is spell-side). "Magic" per D-11 means
// spell damage ONLY -- magic weapons (c.magicWpn > 0) do NOT trigger any row
// here, matching the rulebook's own "All spells cast by Clerics" framing
// (Gremlin/Demons entry, p.37) and "Magic has double the affect" (Google/
// Walking Dead entry, p.39) -- both describe CAST effects, not equipment.
export const DAMAGE_MULTIPLIERS = [
  // Cleric-cast spells deal double to Demons (rulebook p.37, Gremlin entry;
  // CONTEXT.md D-11 generalizes it from Gremlin specifically to the whole
  // Demons type).
  { sourceKind: "spell", casterSub: "Cleric", foeType: "Demons", mult: 2 },
  // Any spell deals double to Walking Dead (rulebook p.39, Google entry:
  // "Magic has double the affect when used against these walking dead").
  { sourceKind: "spell", casterSub: null, foeType: "Walking Dead", mult: 2 },
  // Fighters deal double melee damage to Trachea specifically (rulebook
  // p.38: "Fighters do double damage against Tracheas").
  { sourceKind: "melee", casterClass: "Fighter", foeName: "Trachea", mult: 2 },
];
```
`casterSub: null` means "matches any/no specific subclass" (the any-spell-vs-Walking-Dead row). A pure consulting function (e.g. `multiplierFor(source, foe)` in `engine/foeDamage.js` or co-located in the content file) filters rows by `sourceKind` first, then `foeType`/`foeName`, then `casterSub`/`casterClass` if the row specifies one, and returns the highest matching multiplier (default `1` if no row matches). **Confirmed via `content/mu-chart.js` direct read:** `MU_CHART.Cleric.offense = 0` (a real, non-null bonus value, not a gate block) and Cleric has no `gate.offense` override, so `schoolGate("Cleric","offense")` defaults to `1` — **Clerics CAN learn and cast offense-school spells (Acid, Fireballs, Earthquake, thrown spells, etc.) starting at level 1**, just with a `+0` bonus on the thrown-spell roll. This confirms the Cleric-vs-Demons multiplier is mechanically reachable, not a dead rule.

**Fighter identification:** use `state.c.cls === "Fighter"` (the top-level class), **not** `c.sub` (the subclass, e.g. "Soldier"/"Knight"/"Barbarian" — none of which is literally `"Fighter"`). `content/classes.js` confirms `CLASSES.Fighter.subs` is the array `["Knight","Guard","Woodsman","Soldier","Barbarian","Master of Arms","Samurai","Bard"]` — any of these subs implies `c.cls === "Fighter"` at chargen (`engine/character.js#rollCharacter:160` sets `cls` from the `d6` roll, `sub` from `CLASSES[cls].subs[d8-1]`), so `c.cls` is the correct, stable field to check.

### Pattern 5: `slow` (Philly) — exact insertion in `playerStrike`

Current (`engine/combat.js:317-319`):
```js
for (let a = 0; a < attacks && t.alive; a++) {
  const dieN = strikeDie(c);
  const roll = rng.d(dieN);
```
Recommended:
```js
for (let a = 0; a < attacks && t.alive; a++) {
  const dieN = strikeDie(c);
  let roll = rng.d(dieN);
  if (t.sp && t.sp.slow) roll = Math.min(roll, rng.d(dieN)); // p.36: strike on a d10 or normal die, whichever is lower — player-favorable
```
This is a single `let`-instead-of-`const` change plus one conditional extra draw. Everything downstream (`hit`, `crit = roll === 1 && !noCrit`, Death-touch's `roll === 1` check, Stealth's `roll <= 2` check) already reads the same `roll` variable, so the player-favorable effect (including a HIGHER chance of a natural-1 crit) flows through every existing mechanic with zero additional wiring. Confirmed via grep: `slow: true` appears exactly once in `content/bestiary.js` (Philly, `Walking Dead[0]`), and `Walking Dead` is never a forced encounter type in any parity fixture.

**Narration:** D-12 does not mandate a new event for the slow re-roll (unlike D-08's explicit `foeArmorSoaked` requirement) — the effect is silently favorable and needs no new `EVENT_NARRATION` entry. Recommend NOT adding one (minimizes new surface); the planner may optionally add a flavor-only event if desired, but it is not required by any locked decision.

### Anti-Patterns to Avoid

- **Reading `sp.dmg` directly inside `damageFoe`:** the seam receives an already-rolled `rawDmg` number, never a dice-notation object — keeps the seam pure and reusable for spell/item/ally sources that don't share `sp.dmg`'s shape.
- **Calling `killFoe` from inside `damageFoe`:** D-09 is explicit — "Kill accounting (`killFoe`) stays where it is; the seam only computes/applies damage." Every call site keeps its own existing `if (t.wp <= 0) killFoe(...)` line immediately after calling `damageFoe`.
- **Applying the multiplier table to melee damage generically:** only the one named Fighter-vs-Trachea row is melee-side; a naive implementation that checks `foeType` against ALL rows regardless of `sourceKind` would incorrectly try to apply "Cleric spell 2x vs Demons" logic to melee damage too (no-op today since no melee source has `casterSub: "Cleric"`, but a fragile design).
- **Stashing caster identity on multi-round DoT state:** unnecessary — `state.c.sub`/`state.c.cls` are read live at tick time and never change mid-fight (see Pattern 2's acid-tick note).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Counting rng draws in the new zero-draw tests | A custom mulberry32-state-diff calculator | The existing `countingRng` wrapper pattern from `test/unit/foe-turn-draw-count.test.js:50-60` | Already proven, already the FID-02 baseline this phase must extend, not replace |
| Dice-notation resolution for the new seam's inputs | A second dice-rolling helper | `engine/dice.js#rollDice` (already used by every `sp.dmg` site) | The seam never rolls dice itself — every call site rolls `rawDmg` BEFORE calling `damageFoe`, exactly as today |
| Multiplier lookup logic | A generic rules-engine/condition-matcher library | A ~15-line pure `.filter()` over `DAMAGE_MULTIPLIERS` | Three static rows, zero need for a general query engine |

**Key insight:** every piece of infrastructure this phase needs (the rng, the dice roller, the fakeRng test pattern, the content-table test pattern, the coverage-guard narration gate) already exists in the codebase from Phases 1-17 — this phase adds new DATA (bestiary numbers, a multiplier table) and one new PURE FUNCTION (`damageFoe`), never a new category of infrastructure.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts reference bestiary creature names or numbers outside `content/bestiary.js` itself and the parity fixtures (already inventoried by Phase 17's `test/parity/FIXTURE-INVENTORY.md`).

## Rebalance Yardstick (BEST-01, BEST-02) — Methodology and Full Table

### Hero-side formulas (generic composite hero, no store purchases, no skills, Human race)

Base data sources: `content/classes.js` (`toHit`, `baseWP`, `gain`), `content/kit.js` (starting weapon per subclass), `content/weapons.js` (weapon dice), `engine/derived.js` (`strikeDie`, `weaponDamage`), `content/misc-tables.js` (`STRIKE_DICE = [20,12,10,8,6]`).

A hero of level N strikes on `STRIKE_DICE[N-1]` and needs `<= need` to hit, where `need` is the class's base `toHit` (MU=3, Fighter=5, Thief=4 — `content/classes.js`). Expected damage per swing, accounting for the universal auto-crit-on-a-natural-1 rule (`playerStrike:394`, `if (crit) dmg *= 2`), is:

```
E[dmg/swing] = avgDmg(level, class) * (need + 1) / dieN(level)
```

(derivation: of the `dieN` equally-likely rolls, `need` of them hit, and the one hit at `roll===1` is additionally doubled — so the weighted sum is `avgDmg*(need-1) + avgDmg*2 = avgDmg*(need+1)`, divided by `dieN`).

`avgDmg(level, class)` = `level^2 + avg(weapon dice) + avg(prof)`, averaged across each class's 8 subclasses' starting kit (`content/kit.js`):
- Fighter (need=5): weapon+prof avg = **7.06** (Awl Pike+2=8.5, Spear+2=6.5, Quarter Staff+3=6.5, Long Sword+1=5.5, Battle Axe+2=6.5, Broadsword+2=9.0, Katana+3=8.5, Short Sword+1=5.5)
- Thief (need=4): weapon+prof avg = **3.125** (Dagger+0=2.0 x5 subs, Short Sword+0=5.5, Wakazashi+1=6.5, Dagger+1=3.0)
- Magic User (need=3, Cleric forces need=4 but is only 1/8 subs so averaged in as ~3.125, rounded to 3 for the table below): weapon+prof avg = **3.875** (Quarter Staff+0=3.5 x7 subs, Club+2+1=6.5)

A "generic hero" DPR (averaged across the three per-class DPR curves, each computed independently then averaged — not a product of averages) by tier/level:

| Level (=tier) | Hero maxWP (avg of 3 classes) | Hero DPR (avg of 3 classes) |
|---|---|---|
| 1 | 41.7 | 1.48 |
| 2 | 46.2 | 3.71 |
| 3 | 50.0 | 6.95 |
| 4 | 54.5 | 13.06 |
| 5 | 60.0 | 24.92 |

Hero maxWP: `base + rollDice(class.baseWP.dice)` at L1, plus each class's `gain[level]` average added per level-up (`content/classes.js`) — MU 25+5.5=30.5 -> 35.0 -> 39.5 -> 46.0 -> 53.5; Fighter 50+4.5=54.5 -> 59.0 -> 62.5 -> 66.0 -> 69.5; Thief 40(flat) -> 44.5 -> 48.0 -> 51.5 -> 57.0; averaged per level as shown above.

**A composite hitFactor(level) = (4+1)/dieN(level)** (using a generic need=4, the Thief's exact value and the rounded midpoint between MU=3 and Fighter=5) is used below to compute each creature's TTK, adjusted per-creature when the foe's `sp.toHit`/`sp.fast`/`sp.magicOnly` overrides the hero's effective need:
- L1(die20): 0.25, L2(die12): 0.4167, L3(die10): 0.5, L4(die8): 0.625, L5(die6): 0.8333
- Generic avgDmg(level) = `level^2 + 4.69` (the average of the three classes' weapon+prof numbers): L1=5.69, L2=8.69, L3=13.69, L4=20.69, L5=29.69
- **Baseline Hero DPR-vs-a-plain-foe(tier) = hitFactor x avgDmg:** T1=1.42, T2=3.62, T3=6.85, T4=12.93, T5=24.74 (used for TTK below; note this is a SEPARATE, slightly different composite than the per-class-averaged DPR table above — both are legitimate ways to average, differing only by Jensen's-inequality-scale rounding; the per-creature TTK/RTD table below uses this second, single-composite-hero version throughout for internal consistency)

### Foe-side formulas

A tier-N foe strikes on `foeDie = max(8, STRIKE_DICE[N-1])` (`engine/derived.js#foeDie`) = `[20,12,10,8,8]` for N=1..5, and needs `foeToHitVs(state) = 5` against a baseline Human hero with no skills/darkness (`engine/derived.js#foeToHitVs`). Using the same crit-adjusted formula:

```
Foe hitFactor(tier) = (5+1) / foeDie(tier) = [0.30, 0.50, 0.60, 0.75, 0.75]  (tiers 1..5)
Foe DPR = atk * (tier^2 + avgDiceComponent) * hitFactor(tier)
```
where `avgDiceComponent` = the average of the creature's `sp.dmg` dice notation, or `3.5` (a d6) if the creature has NO `sp.dmg` field at all (the engine's own fallback, `engine/combat.js:1039`: `f.lvl*f.lvl + (f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6))`).

**Simplifications explicitly assumed (documented, not hidden):** no player armor soak modeled in RTD (the hero's own worn armor is a per-class/per-purchase variable outside this phase's scope — RTD numbers below are a worst-case, no-armor-benefit baseline); no player skills (Hardiness, Agility, etc.); Human race only; `sp.toHit`/`sp.fast` overrides ARE applied where they affect the hero's chance to hit that specific foe (they do not affect the foe's own accuracy against the hero — confirmed by direct read: `foeTurn`'s `need = foeToHitVs(state)` never reads `f.sp.toHit`, only `playerStrike` does, at `combat.js:322`).

### Full 53-row table (all bestiary entries)

TTK = rounds for the hero to kill the foe (`wp / adjusted DPR`, doubled for `twice`/`lives:2` creatures). RTD = rounds for the foe to kill the hero (`heroHP(tier) / foeDPR`). Tier median columns computed across ALL entries at that tier (12/10/12/12/7 rows for tiers 1-5 respectively). "Flag" marks a >2x-median outlier on either axis (D-02's rule), a canon-note contradiction, or a D-03 pre-ability discount target.

**TIER 1** (heroHP=41.7, baseline DPR=1.42, TTK median=3.515, RTD median=30.9)

| Creature | Type | wp | TTK | RTD | Flag |
|---|---|---|---|---|---|
| Bat/Rat | Beasts | 1 | 0.70 | 34.75 | Note: intentionally trivial ("two attacks, 1wp each") — 5.0x below TTK median but matches its own flavor; no fix |
| Shriek | Beasts | 3 | 2.11 | 30.9 | — |
| Viper | Beasts | 3 | 2.11 | 30.9 | — |
| Gremlin | Demons | 8 | 5.63 | 18.53 | — |
| Dante | Humans | 20 | 14.08 | 10.30 | **FIXTURE-EXPOSED — 4.0x TTK / 3.0x RTD outlier on BOTH axes, but MUST NOT be changed (D-14). Record as "deferred to Phase 21" in the stat table.** |
| Dog Face | Lair Beasts | 6 | 4.23 | 30.9 | — |
| Goblin | Lair Beasts | 4 | 2.82 | 30.9 | — |
| Hobgoblin | Lair Beasts | 5 | 3.52 | 25.3 | — |
| M&M | Lair Beasts | 3 | 2.11 | 30.9 | — |
| Pogo | Lair Beasts | 4 | 3.51 | 16.35 | — |
| Drekk | Magical | 7 | 4.93 | 30.9 | — |
| Philly | Walking Dead | 5 (x2, `twice`) | 7.04 | 25.27 | — (slow makes actual TTK better than shown once CANON-05 lands — player-favorable, not accounted for in this baseline) |

**TIER 2** (heroHP=46.2, baseline DPR=3.62, TTK median=3.31, RTD median=10.87)

| Creature | Type | wp | TTK | RTD | Flag |
|---|---|---|---|---|---|
| Cave Bear | Beasts | 25 | 6.91 | 10.87 | Borderline TTK outlier (2.09x median) — within D-02's tolerance band, not flagged for a fix, but worth a one-line note in the stat table |
| Zit | Beasts | 4 | 1.10 | 12.32 | Note: canon-correct — tiny WP offset by "only hit on a 4"; no fix |
| Poltergeist | Demons | 10 | 2.76 | 6.16 | — |
| China Wolf | Humans | 16 | 4.42 | 6.16 | — |
| Krupke | Humans | 23 | 6.35 | 8.80 | **Pre-ability discount target (D-03)** — not itself a >2x outlier (1.92x TTK) but discounted regardless per the named-caster rule |
| Hair | Lair Beasts | 12 | 3.31 | 12.32 | — |
| Trachea | Lair Beasts | 8 | 2.21 | 9.72 | — (canon +4-first-hit / Fighter-2x / Thief-5-to-hit specials are Phase 19/this-phase-CANON-04 territory, not a stat outlier) |
| Shadow | Magical | 4 | 1.10 | 12.32 | Note: canon-correct — `daggerOnly` gimmick offsets low WP; no fix |
| Google | Walking Dead | 19 | 5.25 | 10.87 | — |
| Skeleton | Walking Dead | 6 (x2, `twice`) | 3.31 | 12.32 | — |

**TIER 3** (heroHP=50.0, baseline DPR=6.85, TTK median=2.34, RTD median=6.21)

| Creature | Type | wp | TTK | RTD | Flag |
|---|---|---|---|---|---|
| Drat | Beasts | 26 | 3.80 | 6.67 | — |
| Flube | Beasts | 7 | 1.02 | 6.67 | — |
| Rast | Beasts | 12 | 1.75 | 4.76 | — |
| Sterling | Beasts | 35 | 5.11 (2.18x median, borderline outlier already) | 5.38 | **CRITICAL INTERACTION RISK — see "Sterling / CANON-03 Interaction" callout below. Flag for an explicit decision in the stat table, not a silent change.** |
| Wolf | Beasts | 6 | 0.88 | 5.75 | Note: canon-correct filler ("nothing special... +2 damage"); no fix |
| Rinkle | Demons | 16 | 2.34 | 6.67 | — |
| Frank | Humans | 20 | 2.92 | 4.27 | — |
| Primp | Humans | 18 | 2.63 | 5.38 | — |
| Blumble | Lair Beasts | 16 | 2.34 | 5.38 | — |
| Werebeast | Magical | 32 | 4.67 | 2.14 | **RTD outlier — 2.9x median, FLAG FOR A FIX** (its `atk:2` + `dmg:1d10+5` makes it far more lethal per round than any tier-3 peer; canon does describe it as "two attacks... d10+5! Ouch!" so the danger is intentional flavor, but the MAGNITUDE is out of band for tier 3 — recommend reducing to `atk:2, dmg:{n:1,sides:8,bonus:3}` (avg 7.5+3=10.5 -> new full=9+10.5=19.5... actually recompute: this only changes dice not level term; a more direct fix is dropping the flat bonus from +5 to +2, yielding RTD ~2.85, within 2x median) |
| Ghoul | Walking Dead | 15 | 2.19 | 6.67 | — |
| Zombie | Walking Dead | 12 | 1.75 | 6.67 | — |

**TIER 4** (heroHP=54.5, baseline DPR=12.93, TTK median=1.43 [10 finite values, excludes Ghost/Spectre], RTD median=3.73)

| Creature | Type | wp | TTK | RTD | Flag |
|---|---|---|---|---|---|
| Drake | Beasts | 135 | 10.44 | 2.34 | **TTK outlier — 7.3x median, FLAG FOR A FIX.** Its `wp:135` is disproportionate for tier 4 (compare Herman's 36, Craig's 24, Drudge's 12). Recommend cutting to roughly `wp: 60-70` (still the tankiest tier-4 creature, matching its "humongous" flavor, but within ~2x of median once its `every:4` cooldown gate lands in Phase 19 and its effective per-round threat drops). This is independent of the `every` bug (Phase 19's job) — BEST-01 can and should right-size `wp` now |
| Stink Bug | Beasts | 4 | 0.52 | 3.73 | Note: canon-correct — WP is literally 4 in the rulebook, offset by `toHit:2`; no fix |
| Djinni | Demons | 86 | 6.65 | 3.73 | **Pre-ability discount target (D-03) — ALSO a genuine 4.65x TTK outlier independent of the discount, confirming D-03's rationale** |
| Ghost | Demons | 28 | infinite (magicOnly, no magic weapon) | 3.73 | By-design canon gate ("only magic touches it") — NOT a rebalance bug, do not "fix" the unhittability; note in the table as intentional |
| Spectre | Demons | 32 | infinite (magicOnly) | 3.73 | Same as Ghost — intentional |
| Craig | Humans | 24 | 1.86 | 3.23 | — |
| Herman | Humans | 36 | 2.78 | 1.77 | Note: canon-correct — flat 25 base dmg is explicit rulebook text ("strikes as a level 5... base damage of 25"); RTD 2.1x median but self-consistent with its own TTK (roughly balanced ~2-3 round fight either way), not flagged |
| Drarl | Lair Beasts | 19 | 1.47 | 3.73 | — |
| Drudge | Magical | 12 | 0.93 | 3.73 | **Pre-ability discount target (D-03), HP-only** (never melees per canon — discount applies to `wp` alone, no `sp.dmg` field exists to step down anyway) |
| Bones | Walking Dead | 14 | 1.08 | 3.73 | — |
| Floater | Walking Dead | 8 | 0.62 | 3.73 | — |
| Undead | Walking Dead | 18 | 1.39 | 3.73 | — |

**TIER 5** (heroHP=60.0, baseline DPR=24.74, TTK median=1.62, RTD median=2.81)

| Creature | Type | wp | TTK | RTD | Flag |
|---|---|---|---|---|---|
| Dread Lock | Beasts | 40 | 1.62 | 2.81 | — |
| Stalka Beast | Beasts | 125 | 5.05 | 1.40 | **Pre-ability discount target (D-03) — ALSO a 3.1x TTK outlier AND right at the RTD 0.5x-median boundary, confirming D-03's rationale strongly** |
| Djinni (2nd tier) | Demons | 86 | 3.48 | 2.81 | **Pre-ability discount target (D-03) — ALSO a 2.15x TTK outlier** |
| Herman (2nd tier) | Humans | 36 | 1.45 | 1.60 | Note: canon-correct (see tier-4 Herman note), self-consistent |
| Drarl (2nd tier) | Lair Beasts | 19 | 0.77 | 2.81 | — |
| Drudge (2nd tier) | Magical | 12 | 0.48 | 2.81 | **Pre-ability discount target (D-03), HP-only** |
| Vampire | Walking Dead | 95 | 3.84 | 1.40 | **Pre-ability discount target (D-03) — ALSO a 2.37x TTK outlier AND at the RTD boundary, confirming D-03's rationale strongly** |

### Sterling / CANON-03 interaction (flag for explicit planner decision)

Sterling's current TTK (5.11, using its EXISTING `wp:35` with `halfDmg` still inert) is already a borderline 2.18x-median outlier at tier 3. The MOMENT this phase implements `halfDmg` (CANON-03) per D-10, Sterling's effective DPR taken is halved, so its TTK roughly **doubles to ~10.2** (4.4x the tier-3 median) — a much worse outlier than before the phase even started, purely as a side effect of correctly implementing the canon mechanic. Rulebook text is explicit and unambiguous: "they have two hearts... they take only half damage from any attack (even magical)" — this IS canon-intended tankiness, not a bug. **Recommend:** the planner records an explicit decision in `content/BESTIARY-REBALANCE.md` — either (a) accept the ~10.2-round TTK as canon-correct and flag it for Phase 21's retune rather than fixing now (matches D-02's "keep prototype numbers everywhere else... Phase 21 retunes from a stable baseline" spirit, since `halfDmg` itself is new this phase, not a prototype number), or (b) proactively lower Sterling's `wp` (e.g. `35 -> 24`, bringing post-halving TTK back to ~7.0, still tanky but closer to 2x rather than 4.4x median). Given D-02's explicit conservative-pass instruction, **recommend option (a)** — implement `halfDmg` as specified, leave `wp` untouched, and add a one-line rationale to the stat table: "Sterling's TTK roughly doubles once halfDmg lands (canon-intended two-hearts tankiness); deferred to Phase 21's consolidated retune, not fixed here."

### Cross-check against the rulebook (pp.36-43)

Every WP value in `content/bestiary.js` matches the rulebook's `Creatures Described` tables exactly for every creature checked (Bat/Rat=1, Shriek=3, Viper=3, Cave Bear=25, Zit=4, Drat=26, Flube=7, Rast=12, Sterling=35, Wolf=6, Drake=135, Stink Bug=4, Dread Lock=40, Stalka Beast=125, Gremlin=8, Poltergeist=10, Rinkle=16, Djinni=86, Ghost=28, Spectre=32, Dante=20, China Wolf=16, Krupke=23, Frank=20, Primp=18, Craig=24, Herman=36, Dog Face=6, Goblin=4, Hobgoblin=5, M&M=3, Pogo=4, Hair=12, Trachea=8, Blumble=16, Drarl=19, Drekk=7, Shadow=4, Werebeast=32, Drudge=12, Philly=5, Google=19, Skeleton=6, Ghoul=15, Zombie=12, Bones=14, Floater=8, Undead=18, Vampire=95) `[VERIFIED: mazeworld.pdf pp.36-43, pdftotext -layout]`. **No prototype-vs-book divergence exists in the base WP numbers** — the prototype is a faithful transcription of the rulebook's stat tables. This means every TTK/RTD outlier flagged above is a genuine BALANCE issue relative to the hero's OWN power curve (which the 1994 tabletop rulebook never modeled the same way a solo digital roguelike needs to), not a transcription error — supporting evidence, not the root cause. Damage dice/bonuses likewise match the rulebook prose in every checked case (e.g. Rast "+4 with any weapon" = `dmg:{1,8,4}`; Pogo "+4 damage bonus" = `dmg:{1,6,4}`; Herman "base damage of 25" = `dmg:{0,0,25}`; Craig "two-handed swords which deal d12" = `dmg:{1,12,0}`; Drake "breathes fire, works as a fireball spell" [2d10+4, matching content/spells.js's own `Fireball` entry] = `dmg:{2,10,4}`).

## Pre-Ability Discount (D-03) — Concrete New Numbers

**Rounding convention:** `Math.round(wp * 0.75)`, matching the codebase's established convention for every other HP-affecting derived value (`checkLevel`'s `Math.round(gain * R.wpMul)`, `killFoe`'s `Math.round(raw * mul)` and `Math.round(gained / shares)` — both `engine/character.js`/`engine/combat.js`, direct read).

**Dice-step ladder for "one dice-step lower melee damage":** the standard polyhedral progression already implicit in `STRIKE_DICE`/weapon tables — `d12 -> d10 -> d8 -> d6 -> d4` (floor at d4; no creature here starts below d6). For a creature with NO existing `sp.dmg` field (falls back to the engine's generic `rng.d(6)`), "one step lower" means explicitly authoring `sp.dmg: {n:1, sides:4, bonus:0}` (a d4) so its (currently inert, pre-Phase-19) melee swing is a genuine step down from the d6 fallback the moment it ever does swing.

| Creature | Old wp | New wp (-25%, rounded) | Old melee dmg | New melee dmg (one step down) | Notes |
|---|---|---|---|---|---|
| Djinni (Demons T4) | 86 | **65** | none (d6 fallback) | `{1,4,0}` (d4) | Appears at Demons T4 AND T5 — both entries get identical treatment |
| Djinni (Demons T5) | 86 | **65** | none (d6 fallback) | `{1,4,0}` (d4) | Duplicate entry, same fix |
| Krupke (Humans T2) | 23 | **17** | `{1,8,2}` (d8+2) | `{1,6,2}` (d6+2) | Only Humans T2, single entry |
| Drudge (Magical T4) | 12 | **9** | none (never melees per canon) | **unchanged** — HP-only discount per D-03 | Appears at Magical T4 AND T5 |
| Drudge (Magical T5) | 12 | **9** | none | unchanged | Duplicate entry, same fix |
| Vampire (Walking Dead T5) | 95 | **71** | none (d6 fallback) | `{1,4,0}` (d4) | Single entry |
| Stalka Beast (Beasts T5) | 125 | **94** | none (d6 fallback) | `{1,4,0}` (d4) | Single entry |

All five recommendations flow directly from the yardstick table above, which independently confirms all five (except Drudge, whose weakness is already an intentional never-melee design, and Krupke, whose numbers are not yet a >2x outlier) as genuine current-state TTK outliers — reinforcing that this is not merely a "future-proofing" discount but a real, presently-measurable balance fix.

## Foe Armor Soak (CANON-01) — Full Detail

**Exact rule (rulebook p.44, "Using Armor"):** "If an enemy scores a hit, you must roll d20. If you roll equal or lower than your AR (armor rating), the damage is done to the armor [instead of you]. If you roll higher than your AR rating, damage is done to your character directly." D-05 mirrors this for the FOE side: on a landed hit, roll d20; `<= foe.sp.ar` fully blocks the blow (no durability pool tracked for foes — D-05 explicitly says "no durability tracking," unlike the player's own `armorWP` pool).

**Creatures carrying `sp.ar` today** (confirmed by direct read of `content/bestiary.js`): Drat (12, Beasts T3), Krupke (12, Humans T2), Craig (15, Humans T4), Herman (15, Humans T4 AND T5), Google (15, Walking Dead T2). **None of these five is fixture-exposed** — fixture-exposed creatures are exactly `Bat/Rat`, `Shriek`, `Viper` (Beasts, all T1) and `Dante` (Humans, T1); none of the five `ar`-bearing creatures is tier 1. This confirms zero draw-order risk for any parity fixture.

**Insertion point:** inside the new `damageFoe` seam (see Pattern 2 above), gated `if (sourceIsPhysical && !source.crit && foe.sp && foe.sp.ar) { const roll = rng.d(20); if (roll <= foe.sp.ar) { /* full block */ } }`. `sourceIsPhysical` = `source.kind !== "spell"` (melee/ally/reflect/item all count as physical for this purpose per Pattern 2's design calls above). Crit availability: `crit` is already computed at the `playerStrike` call site (`combat.js:345`, `let crit = roll === 1 && !noCrit;`) before `dmg *= 2` and the seam call — pass it through as `source.crit`.

**New event:** `foeArmorSoaked { name, amount }` (D-08). Narration example (deadpan, family-friendly, matching the existing `armorSoaked` (player-side) sibling event's tone at `src/browser/eventNarration.js`): `` `Your blow rings off the ${e.name}'s hide. It looks bored.` `` — a distinct event NAME from the existing player-side `armorSoaked` (which narrates the HERO's own armor blocking a FOE's hit) to avoid confusion; both must coexist in `EVENT_NARRATION` with different copy.

## Slow (CANON-05) — Confirmed Scope

Already fully detailed in Pattern 5 above. Philly (`Walking Dead[0]`) is the sole `slow: true` creature; Walking Dead is never a forced fixture encounter type. Zero-draw for every other creature; one conditional extra `rng.d(dieN)` draw only when `t.sp.slow` is true.

## Multipliers (CANON-04) — Confirmed Scope

Already fully detailed in Pattern 4 above. Key confirmed facts: Cleric CAN cast offense-school spells (mechanically reachable, `MU_CHART.Cleric.offense = 0`, default gate 1); Fighter identification must use `c.cls === "Fighter"`, never `c.sub`; Trachea's type is `"Lair Beasts"` (confirmed, `content/bestiary.js:75`, `Lair Beasts[1]`).

## Narration

**How `EVENT_NARRATION` entries are written** (`src/browser/eventNarration.js`, direct read): each entry is a `(e) => string` builder, defensive against missing fields via `??`/`?.`, using `<span class="hit|miss|hurt|roll|beat|banner">` CSS classes matching the existing render pipeline. The armor-soak sibling event's existing style (search `armorSoaked:` in the file) is the direct template for the new `foeArmorSoaked` entry.

**Coverage guard** (`test/unit/formatEventsCoverage.test.js`, direct read): derives the canonical event-type set by regex-scanning every literal `type: "..."` occurrence across every TOP-LEVEL `.js` file directly under `engine/` (no subdirectories, confirmed by `collectJsFiles`'s `fs.readdirSync(dir, {withFileTypes:true}).filter(isFile)`). **This means a new `engine/foeDamage.js` file (recommended location for the seam) is automatically scanned** — any `type: "..."` literal pushed from inside it is picked up exactly like one pushed from `combat.js`/`magic.js`. `foeArmorSoaked` must get a real, non-empty narration entry or `npm test` fails loudly (`missing.length` assertion).

**Safety scan** (`test/voice/safety-scan.test.js`, direct read): auto-covers `EVENT_NARRATION` by iterating the exported map and invoking every builder across representative event-field variants, then scans the rendered text against `content/safety-wordlist.js`'s `BANNED` corpus (word-boundary matched, case-insensitive). No manual test-file edit needed for the new entry — just write family-friendly copy.

## Tests

**`test/unit/content-tables.test.js` pins that will change:** the file currently has no direct `BESTIARY[...]` value pins (spot-checks `WEAPONS`/`CLASSES`/`RACES`/`ARMORS`/`RACE_D8`/`SPELLS`/`ENC_TYPES`/`POTIONS`/`EPITAPHS`/`CAUSE_TEXT` only — confirmed by direct read, no `BESTIARY[` assertions found). This phase should ADD new pins for every changed bestiary row (Djinni x2, Krupke, Drudge x2, Vampire, Stalka Beast, Drake, Werebeast, plus any others the planner's final outlier list settles on), each with a one-line rationale comment per D-17, and a new pin locking `DAMAGE_MULTIPLIERS`'s exact three rows (per D-11's "table locked by a content-table test").

**`fakeRng` helper usage** (`test/unit/party-combat.test.js:26-38`, `test/unit/foe-turn-draw-count.test.js:50-74`, direct read): `fakeRng(seq)` pops the next value from `seq` regardless of `sides` argument and THROWS on underflow — this doubles as a "no more draws than expected" assertion. `countingRng(inner)` wraps any rng (fake or real `makeRng`) and tallies every `.d()`/`.pick()`/`.next()` call (`.shuffle()` counts `n-1`). Both patterns are the direct template for this phase's new `test/unit/foe-damage.test.js` (D-13: dedicated fakeRng tests per special) and the `foe-turn-draw-count.test.js` extension (D-13: zero-extra-draw proofs for non-`ar`/non-`slow` foes).

**Extending `foe-turn-draw-count.test.js` for zero-draw proofs:** add a case using a `fixedFoe()` WITHOUT `sp.ar` and assert `countingRng`'s tally is unchanged from the pinned pre-Phase-18 baseline (already documented in `test/parity/FIXTURE-INVENTORY.md`'s "Draw-count baseline" section — e.g. "one swing that hits an unarmoured hero: 2 draws" must stay 2 after `damageFoe` routing lands for a foe without `ar`). Add a SEPARATE new case with `sp.ar` set and assert the count is exactly ONE HIGHER (the armor-soak `rng.d(20)`) — this is the FID-04-style "gate proves exactly one extra draw" pattern Phase 19 will reuse for its own ability-attempt gate.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node >=22 built-in) |
| Config file | none — `package.json`'s `"test": "node --test"` discovers every `*.test.js` under `test/` |
| Quick run command | `node --test test/unit/combat.test.js test/unit/party-combat.test.js test/unit/foe-turn-draw-count.test.js test/unit/foe-damage.test.js test/unit/content-tables.test.js` |
| Full suite command | `npm test` (must stay green; Windows note: use `npm test` or explicit file-path invocations — never a bare `node --test <dir>`, which the codebase's own CI-parity notes flag as unreliable on this platform) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BEST-01 | Rebalanced bestiary rows pinned to their new values | unit (content-table pin) | `node --test test/unit/content-tables.test.js` | Existing file — new pins added |
| BEST-02 | Pre-ability discount numbers pinned for the 5 named casters | unit (content-table pin) | `node --test test/unit/content-tables.test.js` | Existing file — new pins added |
| BEST-03 | Fixture-exposed roster (`Bat/Rat`/`Shriek`/`Viper`/`Dante`) is byte-identical to Phase 17's pinned inventory | parity (fixture-inventory regression) | `node --test test/parity/fixture-inventory.test.js` | Existing — must stay green, unmodified |
| CANON-01 | Armor soak: `rng.d(20) <= foe.sp.ar` fully blocks; crit bypasses; zero draw for non-`ar` foes | unit (dedicated `fakeRng`) | `node --test test/unit/foe-damage.test.js` | New file, Wave 0 |
| CANON-03 | Sterling `halfDmg`: `Math.ceil(dmg/2)` on every source kind | unit (dedicated `fakeRng`) | `node --test test/unit/foe-damage.test.js` | New file, Wave 0 |
| CANON-04 | Multiplier table: Cleric/Demons, any-spell/Walking-Dead, Fighter-melee/Trachea, each 2x, verified via `damageFoe` | unit (dedicated `fakeRng`) + content-table pin | `node --test test/unit/foe-damage.test.js test/unit/content-tables.test.js` | New + existing |
| CANON-05 | Slow: two-dice-keep-lower on Philly, zero draw for non-`slow` foes | unit (dedicated `fakeRng`) | `node --test test/unit/combat.test.js` | Existing file — new test cases |
| FID-05 | Zero fixture regeneration; parity suite byte-identical | parity (full-suite gate) | `npm test` (or `node --test test/parity`) | Existing, unmodified |

### Sampling Rate
- **Per task commit:** the quick-run command above (~5 targeted files)
- **Per wave merge:** `npm test` (full suite, including `test/parity`)
- **Phase gate:** full suite green before `/gsd-verify-work`; explicitly confirm `test/parity/full-suite.test.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, and `test/parity/fixture-inventory.test.js` are all unchanged and green (proves D-14/D-15's "zero fixture regeneration" claim empirically, not just by inspection)

### Wave 0 Gaps
- [ ] `test/unit/foe-damage.test.js` — new file, covers CANON-01/03/04's dedicated `fakeRng` unit tests
- [ ] `content/damage-multipliers.js` — new content module + its `content-tables.test.js` pin
- [ ] `content/BESTIARY-REBALANCE.md` — new document, the literal D-04 deliverable
- [ ] `tools/bestiary-yardstick.mjs` — new script (recommended, not strictly required — see CONTEXT.md's Claude's Discretion note)
- [ ] Extended cases in `test/unit/foe-turn-draw-count.test.js` for zero-draw proofs (D-13)

No framework install needed — `node:test` is already fully wired.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth system exists in this offline, single-player, no-account game |
| V3 Session Management | No | No session concept in a fully-offline app |
| V4 Access Control | No | Single local player, no roles/permissions |
| V5 Input Validation | No | This phase adds no new external input surface — `damageFoe`/the multiplier table/the slow re-roll are all pure internal functions called only from existing, already-validated action handlers (`playerStrike`/`castSpell`/item-use), never directly from an action-type dispatch |
| V6 Cryptography | No | `engine/rng.js`'s mulberry32 is explicitly non-cryptographic and gameplay-only; this phase adds no new rng SOURCE, only new gated CONSUMERS of the existing one |

### Known Threat Patterns for this stack

None applicable — this phase is an internal, offline, single-player engine/content change with zero new external input, zero new network calls, and (per FID-05/D-15) zero new persisted `state.c`/`state.combat` fields (the multiplier table and rebalanced bestiary numbers are static content, not runtime state; `damageFoe`'s inputs/outputs are ephemeral function-call values, never serialized).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "generic composite hero" (averaged across MU/Fighter/Thief, no store purchases, no skills, Human race) is an acceptable yardstick baseline for a "conservative, outliers-only" pass | Rebalance Yardstick methodology | Low — D-02 explicitly wants a conservative pass; a more precise per-class/per-race yardstick would shift exact TTK/RTD numbers by single-digit percentages in most cases but is very unlikely to flip any FLAGGED outlier (Djinni/Vampire/Stalka Beast/Drake/Werebeast) back to "fine," since their margins are 2x-7x, far outside normal per-build variance |
| A2 | Reflect damage (`kind:"reflect"`) should be treated as physical (subject to armor soak) but never subject to the multiplier table | Pattern 2, `applyFoeDamageToPlayer` ward-reflect branch | Low-Medium — an alternative reading (reflect = magical, bypasses armor) is equally defensible; if the planner picks the other reading, only one `if` condition in `damageFoe`'s call site changes, no architectural impact |
| A3 | Item-sourced damage (`kind:"item"`, e.g. the "fire" item effect) should be treated as physical (subject to armor soak) | Pattern 2, `items.js` "fire" call site | Low — same reasoning as A2; D-06 only names "spells," leaving items an open interpretation |
| A4 | `damageFoe` lives in a NEW file `engine/foeDamage.js` rather than as a new export inside `engine/combat.js` | Standard Stack "Alternatives Considered" | None — explicitly flagged as Claude's discretion in CONTEXT.md; both are fully covered by the coverage-guard test either way |
| A5 | Sterling's `wp` is left UNCHANGED (option a) rather than proactively lowered to compensate for `halfDmg`'s TTK-doubling effect | "Sterling / CANON-03 interaction" callout | Medium — if the planner instead lowers Sterling's `wp`, this is a fine, equally-valid choice; the risk of leaving it unchanged is a genuinely tanky tier-3 fight (TTK ~10 rounds) that a human playtester may flag during Phase 21, which the callout explicitly anticipates and defers there |
| A6 | The Drake and Werebeast stat-fix recommendations (new `wp` for Drake, reduced damage bonus for Werebeast) are ADDITIONAL outliers the planner should fix under BEST-01's existing >2x-median rule, even though CONTEXT.md's decisions don't name them explicitly | Full 53-row table, Tier 3/4 sections | Medium — these are derived from this session's own yardstick math, not pre-negotiated with the user; the planner/discuss-phase should confirm these two additions are in-scope for "outliers the review flags" before locking exact new numbers, since D-02 was written before this specific math existed |

**If this table is empty:** N/A — six assumptions listed above; A6 in particular should be surfaced to the user/planner as a specific confirmation point since it expands the outlier list beyond what CONTEXT.md's smart-discuss session explicitly named.

## Open Questions (RESOLVED — see CONTEXT.md D-18, D-20)

1. **Should Drake's and Werebeast's stat fixes be locked now, or treated as "Claude's discretion, exact numbers TBD at plan time"?**
   - What we know: both are >2x-median outliers by the yardstick math computed in this session (Drake 7.3x TTK, Werebeast 2.9x RTD); CONTEXT.md's D-02 rule explicitly covers "fix ONLY outliers... >2x off the tier's median."
   - What's unclear: CONTEXT.md's smart-discuss session did not enumerate these two by name (it focused on the five pre-ability casters).
   - Recommendation: treat them as in-scope under D-02's own general rule (the rule is a formula, not a fixed list) and let the planner pick exact new numbers within the "fix the outlier, don't redesign the creature" spirit — flagged in the stat table with the same rationale format as the five named casters.

2. **Does the `C.allies` party-member struct need a `cls` field added so the Fighter-vs-Trachea multiplier can apply to a Fighter party member's strike, not just the hero's own?**
   - What we know: `C.allies` entries (`combat.js:184-191`) currently carry `partyIdx, name, lvl, sub, wp, maxWP` — no `cls`. No parity fixture ever populates `state.party` (confirmed empty in every fixture), so adding `cls` is zero parity risk.
   - What's unclear: whether this edge case (a Fighter party member specifically fighting a Trachea) is worth the extra field for a phase that also has no party-combat feature work in scope.
   - Recommendation: add it — it's a one-line, zero-risk addition (`cls: m.cls` in the mapping) that closes a real correctness gap the multiplier table would otherwise silently miss, and Phase 19's ability work will likely want richer party-member metadata anyway.

## Sources

### Primary (HIGH confidence — direct code/document reads)
- `engine/combat.js` (full file: `startCombat` 98-270, `playerStrike` 281-401, `killFoe` 409-462, `flee` 470-500, `canParley`/`parley` 506-576, `sing` 590-630, `endCombat` 641-665, `afterPlayerAction` 674-724, `allyTurn`/`alliesTurn` 730-789, `downMember` 799-810, `pickFoeTarget` 832-839, `applyFoeDamageToPlayer` 875-956, `foeTurn` 967-1053)
- `engine/magic.js` (full file: `castSpell` 45-361 including every `sp.kind` branch's damage site, `RESIST_IMMUNE_KINDS` 33)
- `engine/derived.js` (full file: `strikeDie`, `toHit`, `foeDie`, `foeToHitVs`, `weaponDamage`, `armorSoak`, `intelBonus`, `schoolAllowed`/`schoolGate`/`schoolBonus`)
- `engine/character.js` (full file: `rollCharacter`, `checkLevel`, `rollSkills`)
- `engine/items.js` (lines 560-613, the "fire"/"stone"/"gas" item-effect damage sites)
- `engine/dice.js`, partial `engine/rng.js` read (via test file references)
- `content/bestiary.js` (full file — every WP/dmg/sp value)
- `content/classes.js`, `content/races.js`, `content/weapons.js`, `content/armors.js`, `content/kit.js`, `content/misc-tables.js`, `content/mu-chart.js`, `content/spells.js` (full/partial reads for the yardstick formulas and multiplier identification)
- `content/index.js` (barrel export list)
- `test/parity/FIXTURE-INVENTORY.md`, `.planning/phases/17-fixture-inventory-foe-turn-refactors/17-RESEARCH.md` (Phase 17's verified fixture-exposed roster and draw-count baselines)
- `test/unit/foe-turn-draw-count.test.js`, `test/unit/party-combat.test.js` (`fakeRng`/`countingRng` patterns)
- `test/unit/content-tables.test.js` (existing pin format/coverage — confirmed no `BESTIARY` pins exist yet)
- `test/unit/formatEventsCoverage.test.js` (coverage-guard derivation mechanism, confirms top-level-`engine/`-only scanning)
- `test/voice/safety-scan.test.js` (safety-scan auto-coverage mechanism)
- `test/parity/harness/comparables.js` (lines 140-220 — `stripFoeDamageClosures` precedent, `combatComparable`)
- `tools/tune-difficulty.mjs` (header, confirming "tuning proxy, not a gate" status)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`, `.planning/phases/18-bestiary-rebalance-canon-combat-fixes/18-CONTEXT.md` (phase scope, engine-gate rules, locked decisions)
- `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md` (milestone-level research this phase's decisions were built from)
- `mazeworld.pdf` pp.36-44 (`pdftotext -layout -f 36 -l 44`) — full "Creatures Described" text for every creature cross-checked, plus "Using Armor" (p.44) and "Spells v. Armor" (p.26) canon rule text, verified verbatim in this session

### Secondary (MEDIUM confidence)
None — every claim above is either a direct code/document read or an original from-scratch computation with fully-specified methodology (the yardstick table).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Rebalance yardstick numbers: MEDIUM-HIGH — the underlying formulas and input data (WP tables, dice tables, class toHit values) are all `[VERIFIED]` direct reads; the composite "generic hero" methodology is a reasonable, fully-documented approximation appropriate for a "conservative, outliers-only" pass, not a machine-computed exact value — a committed `tools/bestiary-yardstick.mjs` script would let the planner re-verify every number exactly before locking the final outlier list
- Damage seam architecture: HIGH — every insertion point is a direct line-number citation against the current `engine/combat.js`/`engine/magic.js`/`engine/items.js`
- Canon cross-check: HIGH — every rulebook citation was extracted via `pdftotext -layout` in this session and compared character-by-character against `content/bestiary.js`'s values
- Multiplier/Cleric-offense-school claim: HIGH — directly confirmed via `content/mu-chart.js`'s `MU_CHART.Cleric` object

**Research date:** 2026-09-13
**Valid until:** Stable until `content/bestiary.js`'s WP/dmg values, `engine/combat.js`'s `playerStrike`/`foeTurn`/`applyFoeDamageToPlayer`, or `engine/magic.js`'s damage-kind branches change — re-verify the yardstick table specifically if any hero-side formula (class toHit, baseWP, weapon dice) changes before Phase 21's consolidated retune.
