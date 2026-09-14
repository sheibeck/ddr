---
phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
reviewed: 2026-09-14T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - content/bestiary.js
  - content/foe-abilities.js
  - content/index.js
  - engine/combat.js
  - engine/derived.js
  - engine/foeAbilities.js
  - engine/magic.js
  - engine/saveState.js
  - mazeworld.html
  - src/browser/eventNarration.js
  - test/determinism/foe-abilities.test.js
  - test/parity/harness/comparables.js
  - test/unit/combat.test.js
  - test/unit/conditions.test.js
  - test/unit/content-tables.test.js
  - test/unit/foe-abilities.test.js
  - test/unit/foe-ability-carveouts.test.js
  - test/unit/foe-damage.test.js
  - test/unit/foe-effect-chip.test.js
  - test/unit/foe-turn-draw-count.test.js
  - test/unit/magic.test.js
  - test/unit/resist-roll.test.js
  - test/unit/save-validation.test.js
  - test/voice/safety-scan.test.js
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-09-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22 (source: content/bestiary.js, content/foe-abilities.js, content/index.js, engine/combat.js, engine/derived.js, engine/foeAbilities.js, engine/magic.js, engine/saveState.js, mazeworld.html (foeEffect-chip hunk only), src/browser/eventNarration.js; remainder test files)
**Status:** issues_found (no blockers; three warnings, two info items)

## Summary

This phase adds a foe-ability resolver (`engine/foeAbilities.js`), a content
registry (`content/foe-abilities.js`), per-foe kit/cooldown/uses state,
symmetric hero/foe intelligence resistance (`resistRoll` in
`engine/derived.js`), a Spectre-style pursuit strike, a Djinni-style low-HP
flee, and the accompanying save/parity/narration wiring. The engine-side
determinism discipline is exceptionally rigorous — every new rng draw is
gated behind structural conditions (`f.abilities` presence, `every`/`uses`
readiness, intel ≥ 12), and the accompanying test suite (unit, determinism,
parity carve-out, save-validation, and voice-safety tests) verifies almost
every seam this review traced by hand, including several edge cases I set
out to find independently (fleesBelow strict `<`, foeEffect same-turn tick
guard, `applyFoeDamageToPlayer`'s additive `applied`/`ignoresArmor` options
leaving old callers unaffected, shared vs. per-foe `abilities` array
copying, and the save-tampering `clearFoeEffect` fail-closed behavior).

I did not find any correctness bug that reaches production behavior
incorrectly for an existing caller, any injection/security issue, or any
determinism/parity regression. The issues below are a genuine content/data
design gap in the summon mechanic's damage scaling (a real, evidence-backed
balance defect the existing dice-budget test does not catch), plus smaller
maintainability/documentation nits.

## Warnings

### WR-01: `vampireSummon` reinforcements inherit the summoner's level for combat math, not the roster tier they were drawn from — this silently exceeds the phase's own 50%-hero-HP damage budget

**File:** `engine/foeAbilities.js:160-175` (the `summon` branch of `resolveFoeAbility`)

**Issue:** When a Vampire's `vampireSummon` ability fires, the reinforcement's
*stats* (wp/intel/size/sp) are correctly drawn from the declared weak tier
(`a.effect = { type: "Walking Dead", tier: 2 }`, i.e. Google/Skeleton), but
its `.lvl` field — the value that actually drives foe-side combat math — is
set from the *summoner's* level instead:

```js
const foe = {
  name: picked.n,
  type: a.effect.type,
  lvl: Math.max(1, f.lvl - 1),   // <- summoner's lvl - 1, NOT the tier's lvl
  ...
  wp: picked.wp,       // <- tier-2 wp (weak)
  ...
};
```

A Vampire only ever appears at Walking Dead tier 5 (`f.lvl === 5` in
practice — confirmed by `test/unit/foe-abilities.test.js`'s own "summon
(D-12)" test, which pins the summoned Skeleton's `lvl` at exactly `4`), so
the summoned "weak" Skeleton is spawned with `lvl: 4` instead of the `lvl: 2`
a naturally-rolled tier-2 Skeleton would carry. This inflates BOTH halves of
its threat, using the same formulas every other foe uses
(`engine/derived.js#foeDie`, and the inline melee-damage formula in
`engine/combat.js#foeTurn`):

- **To-hit die:** `foeDie` returns `STRIKE_DICE[clamp(lvl-1,0,4)]`
  (`STRIKE_DICE = [20,12,10,8,6]`, `content/misc-tables.js`). At `lvl:2` this
  is a d12; at the actual spawned `lvl:4` it is a d8 — a meaningfully better
  hit chance against the same fixed to-hit threshold.
- **Melee damage:** `f.lvl*f.lvl + (f.sp.dmg ? rollDice : rng.d(6))`. Skeleton
  carries no `sp.dmg`, so damage is `lvl² + d6`. At the natural tier-2 `lvl:2`
  that's `4 + d6` (avg ≈ 7.5); at the actually-spawned `lvl:4` that's
  `16 + d6` (avg ≈ 19.5) — roughly **2.6× the damage**, plus better accuracy.
- It also over-pays XP on death (`killFoe`'s `raw = roll * f.lvl`), doubling
  the XP a natural tier-2 kill of the same creature would award.

This is exactly the kind of scaling the phase's own dice-budget analysis
(`content/foe-abilities.js:26-30`) and its enforcing test
(`test/unit/content-tables.test.js` "FOE_ABILITIES Phase 19 / D-03 cap")
were written to police — but that test explicitly `continue`s past
`summon`-kind abilities (`if (ability.kind !== "bolt" && ability.kind !==
"drain") continue;`), so the summon path's derived melee threat is entirely
unguarded by the budget the rest of the registry is held to. A player who
survives long enough to see a Vampire's summon fire can be hit by its
"weak reinforcement" for ~⅓ of their tier-5 expected HP (60) in one blow —
plausibly harder-hitting than several of the registry's own capped bolts.

**Fix:** Either derive the summoned foe's `lvl` from the tier it was drawn
from (e.g. `a.effect.tier`, giving `lvl: 2` for the current Vampire kit) so
its to-hit/damage/XP math matches its stated weak-tier role, or — if a
veteran/elite reinforcement is the deliberate intent — extend the D-03 dice
budget check to cover the summon path's *derived* melee output (not just
`bolt`/`drain` descriptors) so a future regression is caught the same way
every other ability in this registry is.

```js
// engine/foeAbilities.js, summon branch
const foe = {
  name: picked.n,
  type: a.effect.type,
  lvl: a.effect.tier,        // matches the roster tier its stats came from
  ...
```

### WR-02: two independent copies of the `DEATH_PANIC_THRESHOLD` constant can drift out of sync

**File:** `engine/combat.js:282`, `engine/derived.js:189`

**Issue:** `startCombat`'s phobia-freeze check and `conditionsOf`'s phobia
chip both hardcode `const DEATH_PANIC_THRESHOLD = 0.25;` independently (the
`derived.js` copy is explicitly commented "mirror engine/combat.js's
constant"). Both currently agree, and both are exercised by tests, but
nothing enforces they stay equal — a future edit to one (e.g. a balance
tweak to the Death-phobia panic threshold) that misses the other would
desync the "you are frozen" trigger from the "Phobia" status chip's display
condition without any test failing to say so.

**Fix:** Export the constant from one module (e.g.
`engine/derived.js`) and import it in `engine/combat.js`, or move both
reads through a single shared helper (`isNearDeathPanic(c)`), so there is
exactly one source of truth.

### WR-03: `content/foe-abilities.js`'s "unbounded fallback" invariant does not hold for the Djinni kit

**File:** `content/foe-abilities.js:31-33`, `41-44`

**Issue:** The module header states: "every kit lists its bounded
(every/uses) abilities first and an unbounded fallback last, so a caster
always has something to cast." The Djinni's kit
(`djinniFireball`/`djinniDaze`/`djinniLightning`/`djinniFreeze`) is the one
kit where every single entry carries `uses: 4` — there is no unbounded
fallback ability at all. Functionally this is harmless today because the
Djinni is not `never_melee` (it has a `sp.dmg` melee fallback), so
`engine/combat.js#foeTurn`'s ability gate correctly falls through to a
normal melee swing once all four abilities are spent. But the comment's
stated invariant is inaccurate for this kit, and if a future `never_melee`
caster is modeled on the Djinni's kit shape (all abilities capped by
`uses`), that caster would go permanently silent (`foeOutOfSpells` forever)
once its uses are exhausted, with nothing in the comment warning against it.

**Fix:** Tighten the header comment to note the invariant only applies to
`never_melee` casters (Drudge/Vampire/Stalka Beast/Krupke, each of which
does end its kit with a truly unbounded ability), or add a
`content-tables.test.js` assertion that every `never_melee`-flagged bestiary
row's kit ends in an ability with neither `every` nor `uses`.

## Info

### IN-01: `foe.sp` is a shared reference to the frozen `BESTIARY` row object across every foe instance, including summoned foes

**File:** `engine/combat.js:152` (`sp: picked.sp || {}`), `engine/foeAbilities.js:170` (`sp: picked.sp || {}`)

**Observation:** Every foe object built by `startCombat` or by
`resolveFoeAbility`'s summon branch stores `sp` as the *same object
reference* as the corresponding `content/bestiary.js` row (not a copy). Two
simultaneous foes of the same creature type in one encounter (e.g. the two
Djinni tier rows, or a Vampire plus its own summoned Skeleton if a second
Skeleton were ever drawn) therefore share one `sp` object. I confirmed no
engine code currently ever assigns into `foe.sp.*` (only `foe.*` top-level
fields like `foe.blind`/`foe.acid`/`foe.frozen` are mutated), so this is not
presently exploitable — but it is a pre-existing pattern (not introduced by
this phase) that is one careless future edit away from one foe's mutation
silently corrupting the shared `BESTIARY` data for every future encounter of
that creature for the rest of the process lifetime. Worth a comment at the
`BESTIARY` module boundary warning future contributors never to write
through `foe.sp`.

### IN-02: `pickFoeTarget`/`heroResist` ordering makes party-member bolts/drains fully unresisted — confirm this is the intended asymmetry, not a documentation gap

**File:** `engine/foeAbilities.js:190-209`

**Observation:** For `bolt`/`drain` abilities, `pickFoeTarget` is consulted
before the resist check; when a live party member is the target, the ability
lands unconditionally (no `resistRoll`, no ward, no armor, no Hardiness) even
though the same ability targeting the hero is fully resistible. This is
explicitly documented as intentional (mirroring the pre-existing
Phase 17 member-damage asymmetry) and is well covered by
`test/unit/foe-abilities.test.js`'s "member path (D-13)" test. Flagging only
because a party member with high intel is *by design* strictly worse off
against a foe-ability bolt than the hero is — worth a one-line callout in
the player-facing docs/design notes if none exists yet, so it isn't
mistaken for a bug during a future party-balance pass.

---

_Reviewed: 2026-09-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
