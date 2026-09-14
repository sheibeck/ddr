---
phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
plan: 03
subsystem: combat
tags: [engine, combat, foe-abilities, resolver, summon, debuff, drain, pursuit, narration, determinism, node-test]

requires:
  - phase: 19-01
    provides: FOE_ABILITIES registry (ids/kinds/dmg/effect/every/uses/txt), bestiary abilities kits, sp.fleesBelow
  - phase: 19-02
    provides: derived.js#resistRoll shared helper, conditionsOf foeEffect chip, clearFoeEffect load-time guard, parity comparables strippers for the new serialized fields
provides:
  - "engine/foeAbilities.js: the pure foe-side ability resolver (tickAbilityCooldowns/firstReadyAbility/resolveFoeAbility)"
  - "engine/combat.js seams: applyFoeDamageToPlayer's additive ignoresArmor/ability/applied, startCombat's kit copy, playerStrike's weakened halving, endCombat's foeEffect clear, flee's pursuitStrike + cleared-check, foeTurn's pendingFoes join + fleesBelow check + ability gate + foeEffect tick, exported downMember"
  - "11 new event types + EVENT_NARRATION builders + foeFled lowHp branch — coverage guard and voice safety scan green"
affects: [19-04, 20-parley-balance-language-system, 21-consolidated-difficulty-retune]

tech-stack:
  added: []
  patterns:
    - "foe-side ability resolver as a SEPARATE module next to castSpell (never a generalization of it), sharing one primitive (resistRoll) and the existing damage/targeting seams"
    - "structural zero-draw gate: f.abilities absent/empty short-circuits before any rng touch, mirroring the existing C.allies/C.ally gates"
    - "{ died } result contract propagated resolveFoeAbility -> foeTurn, pursuitStrike -> flee, mirroring applyFoeDamageToPlayer's existing contract"

key-files:
  created:
    - engine/foeAbilities.js
    - test/unit/foe-abilities.test.js
  modified:
    - engine/combat.js
    - src/browser/eventNarration.js
    - test/unit/combat.test.js

key-decisions:
  - "heroResist helper pushes heroResisted/heroResistFailed via two literal `type: \"...\"` pushes (not a ternary-computed type) so the plan's own acceptance-criteria grep (`type: \"[A-Za-z]*\"` literal match) finds all 8 distinct type literals — a ternary-computed type string is functionally identical but invisible to that grep"
  - "test 16 (summoned foe accounting) exercises killFoe directly on the joined Skeleton rather than chaining playerStrike's full melee+afterPlayerAction rng sequence through a real kill (treasure/cooking draws) — equally proves 'an ordinary C.foes entry gets normal XP', with far less rng-sequence fragility"
  - "test 6's Drudke kit-order trace matched the plan's own hand-traced note exactly (Freeze, Fireball, Lightning, Fireball, Weaken, Lightning) — no code-vs-trace disagreement found, so no order adjustment was needed"

patterns-established:
  - "Pattern: cooldown lazy-init-then-decrement (tickAbilityCooldowns) — every N fires on visit N, resets to N on cast, refires on visit 2N; the tick always runs before the readiness read on the same visit"
  - "Pattern: RESISTIBLE-kind dispatch (bolt/drain/debuff) shares one `heroResist` helper that both pushes the resist event and reports back whether to short-circuit the rest of the effect"

requirements-completed: [FOE-01, FOE-02, FOE-03, FOE-04, FOE-06, FOE-07, FOE-08, FOE-09, CANON-02]

coverage:
  - id: D1
    description: "engine/foeAbilities.js resolver (tickAbilityCooldowns/firstReadyAbility/resolveFoeAbility) with readiness caps, D-04 cast policy, and all five effect kinds"
    requirement: "FOE-01"
    verification:
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#gate: a foe without abilities / with abilities: [] takes the melee path with no extra draw"
        status: pass
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#gate: kit with a ready bolt — d6 1..4 casts (foeCast then foeBolted), 5..6 melees; no to-hit roll for the bolt"
        status: pass
    human_judgment: false
  - id: D2
    description: "cooldown (every) and uses caps behave per D-05/D-20, including the Drudge kit-order interleave over six visits"
    requirement: "FOE-06"
    verification:
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#cooldown cadence (D-20): every:4 fires on the 4th visit, resets, fires on the 8th; a d6 of 5 on a ready visit leaves cd at 0"
        status: pass
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#uses (D-05): four casts then never again this encounter — the 5th visit draws no d6"
        status: pass
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#kit order + interleave (D-04): the Drudge kit casts Freeze, Fireball, Lightning, Fireball, Weaken, Lightning over six visits"
        status: pass
    human_judgment: false
  - id: D3
    description: "hero Intelligence resistance (FOE-07) via the shared resistRoll helper, gated at intel>=12, for hero-targeted bolt/drain/debuff only"
    requirement: "FOE-07"
    verification:
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#resist (D-07): intel 12 hero — d20 11 resists a bolt (no damage die), d20 12 fails then the bolt lands; intel 11 never rolls"
        status: pass
    human_judgment: false
  - id: D4
    description: "bolt/drain route through applyFoeDamageToPlayer's additive ignoresArmor/ability options — no to-hit roll, ward/armor/Hardiness still apply, drain heals the foe by the applied amount capped at maxWP"
    requirement: "FOE-02"
    verification:
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#bolt through the pipeline (D-02): armor soak d20 applies to a bolt, Hardiness reduces it, a reflecting ward bounces it"
        status: pass
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#drain (D-11): no soak roll on an armoured hero; heals the foe by the applied amount capped at maxWP; foeDrained after foeBolted"
        status: pass
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#drain kills: a lethal drain runs die() and foeTurn returns { died }"
        status: pass
    human_judgment: false
  - id: D5
    description: "debuff (D-09/D-10) sets a NEW c.foeEffect object with d4 rounds; same kind refreshes, different kind replaces; never targets a member; ticks once per foeTurn with an identity guard so it never fades the turn it lands"
    requirement: "FOE-03"
    verification:
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#debuff (D-09/D-10): sets a NEW foeEffect with d4 rounds; same kind refreshes; different kind replaces; a resisted debuff does nothing"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#foeTurn: foeEffect ticks at the end of a foeTurn that did NOT apply it, fades at 0, and endCombat clears a set one without adding the key"
        status: pass
    human_judgment: false
  - id: D6
    description: "heal (D-02) and summon (D-12) — self-heal capped at maxWP, and a gated one-pick summon queued to C.pendingFoes and joined at the top of the NEXT foeTurn with normal killFoe accounting"
    requirement: "FOE-04"
    verification:
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#heal (D-02): capped at maxWP, not ready at full HP"
        status: pass
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#summon (D-12): queues one pending reinforcement, joins next foeTurn, has no abilities, lvl = summoner - 1, lives per twice"
        status: pass
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#summoned foe accounting: killFoe pays normal XP and it targets like any foe"
        status: pass
    human_judgment: false
  - id: D7
    description: "member targeting (D-13, the resolver half of FOE-09) — a bolt/drain can land on a live party member via pickFoeTarget, skipping resist/ward/armor, downing at 0 wp"
    requirement: "FOE-09"
    verification:
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#member path (D-13): a bolt on a live member skips resist/ward/armor, hits member.wp, and can down it; a drain on a member heals the foe by the raw dmg"
        status: pass
    human_judgment: false
  - id: D8
    description: "CANON-02 pursuit — a live sp.pursues foe strikes once on every flee success exit before the fled event, plus a Djinni-style fleesBelow flee at the start of its own visit and a post-flee-failure cleared check"
    requirement: "CANON-02"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js#flee: a live pursues foe strikes once on the roll-based escape — foePursued, hit, then fled"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#flee: the pursuit also fires on the Cloaker and tracked-round-1 exits (D-19), and never without a pursues foe"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#foeTurn: sp.fleesBelow — wp under the threshold flees with no draw and no XP; at exactly the threshold it fights"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#flee: a failed flee whose foeTurn leaves no live foe ends the encounter instead of stranding it"
        status: pass
    human_judgment: false
  - id: D9
    description: "every new event type has a sarcastic, family-friendly EVENT_NARRATION builder that survives a bare { type }; foeFled gains a lowHp branch; coverage guard and voice safety scan stay green"
    requirement: "FOE-08"
    verification:
      - kind: unit
        ref: "test/unit/foe-abilities.test.js#narration: every new event builder returns a non-empty string for a bare { type } and for a full payload"
        status: pass
      - kind: unit
        ref: "test/unit/formatEventsCoverage.test.js#formatEvents narrates every engine-emitted event type (derived from engine/*.js source)"
        status: pass
      - kind: unit
        ref: "test/voice/safety-scan.test.js"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-13
status: complete
---

# Phase 19 Plan 3: Foe Ability Resolver + Combat.js Wiring + Narration Summary

**Foe abilities go live: a pure `engine/foeAbilities.js` resolver (readiness caps, D-04 cast policy, all five effect kinds) wired into `engine/combat.js#foeTurn`'s new ability gate, with hero INT resistance, member targeting, Spectre pursuit, Djinni-style low-HP flee, and the 11 new event types fully narrated — FID-02 draw pins and the 30/30 parity suite untouched.**

## Performance

- **Duration:** 45 min
- **Tasks:** 3
- **Files modified:** 4 (1 new: `engine/foeAbilities.js`; 1 new test: `test/unit/foe-abilities.test.js`; 2 modified: `engine/combat.js`, `src/browser/eventNarration.js`; `test/unit/combat.test.js` extended)

## Accomplishments

- Built `engine/foeAbilities.js` — a foe-shaped resolver placed NEXT to `castSpell` (never a generalization of it), exporting `tickAbilityCooldowns(f)`, `firstReadyAbility(state, f)`, and `resolveFoeAbility(state, f, a, rng, events) -> { died }`.
- Wired every `engine/combat.js` seam the phase's core mechanic needs: `startCombat`'s kit copy, `foeTurn`'s pending-summon join / `fleesBelow` flee / D-04 ability gate / `c.foeEffect` tick, `flee`'s new `pursuitStrike` + cleared-check, `endCombat`'s foeEffect clear, `applyFoeDamageToPlayer`'s additive `ignoresArmor`/`ability`/`applied`, `playerStrike`'s weakened halving, and an exported `downMember`.
- Narrated all 11 new event types plus a `foeFled` low-HP branch in `src/browser/eventNarration.js`, closing the coverage-guard window opened between Task 1/2 and this commit.
- 47 new/updated tests (10 in `combat.test.js`, 20 in the new `foe-abilities.test.js`, plus 6 existing `applyFoeDamageToPlayer` result assertions updated for the new `applied` field) — full `npm test` green (852/852), parity 30/30 byte-identical, FID-02 draw pins unchanged (20/20).

## Task Commits

Each task was committed atomically:

1. **Task 1: combat.js seams — applyFoeDamageToPlayer options/applied, downMember export, startCombat kit copy, playerStrike weakened halving, endCombat clear, flee pursuit strike + cleared check, foeTurn fleesBelow check + foeEffect tick — with combat.test.js pins** - `a730fb9` (feat)
2. **Task 2: engine/foeAbilities.js resolver + the combat.js import line + foe-abilities.test.js (resolver/gate tests 1-19)** - `96b3fc8` (feat)
3. **Task 3: EVENT_NARRATION builders for the 11 new event types + the foeFled lowHp branch, narration test 20, and the plan gate (coverage guard, safety scan, npm test)** - `c48cdbb` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `engine/foeAbilities.js` — new: the pure foe-side ability resolver (see contract below)
- `engine/combat.js` — modified: import line, `startCombat` kit copy, `playerStrike` weakened halving, `endCombat` foeEffect clear, `flee`'s `pursuitStrike` + cleared-check, `foeTurn`'s pendingFoes join / fleesBelow check / ability gate / foeEffect tick, `applyFoeDamageToPlayer`'s additive options/return, exported `downMember`
- `src/browser/eventNarration.js` — modified: 11 new builders + `foeFled` lowHp branch
- `test/unit/combat.test.js` — modified: Phase 19 seam-test section (10 tests) + 6 existing `applyFoeDamageToPlayer` result assertions updated for `applied`
- `test/unit/foe-abilities.test.js` — new: 20 resolver/gate/narration tests

## Contracts for 19-04 (this plan's stated dependents)

**`engine/foeAbilities.js` exports:**
- `tickAbilityCooldowns(f)` — mutates `f.cd` in place (lazy-init to `every`, then decrement floored at 0); no return value; 0 rng draws.
- `firstReadyAbility(state, f)` — returns the first ready descriptor in `f.abilities` kit order, or `null`; 0 rng draws.
- `resolveFoeAbility(state, f, a, rng, events) -> { died: boolean }` — fires the ability; `died: true` means `die()` already ran (state.combat nulled) and the caller must return immediately.

**`foeTurn` step order (as implemented):** pending-summon join (`C.pendingFoes` -> `C.foes`, `C.pendingFoes = null`) → `c.regen` tick → per foe: acid-over-time tick → alive check → sleep → `sp.fleesBelow` check → the D-04 ability gate (`tickAbilityCooldowns` → `firstReadyAbility` → d6 cast-or-melee, `never_melee` skips the d6) → melee swings (target pool, to-hit, damage, `applyFoeDamageToPlayer`) → end-of-loop `ward`/`mirror` ticks → `c.foeEffect` tick (identity-guarded against the turn that applied it).

**`applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, need, ignoresArmor, ability })` return shape:** `{ died, onArmour, applied }` on EVERY branch — `applied` is the amount actually subtracted from `c.wp` this call (0 on every early-return branch: reflect-kill, `dmg<=0`, armor-soaked; the landed `dmg` on both tail returns). `ability` set → pushes `foeBolted` instead of `struckByFoe`.

**`C.pendingFoes` wrapper shape:** `[{ by: <summoner name>, foe: <full foe literal, no `abilities` key> }]` — absent/null/`[]` are all "nothing pending"; set only by `resolveFoeAbility`'s summon branch, consumed only by `foeTurn`'s top-of-turn join.

**Per-ability draw table (as measured against the resolver, hero-targeted, solo, unarmoured, intel<12 — matches the plan's pre-stated table exactly):**

| Kind | Draws after the d6 cast check |
|---|---|
| bolt | dmg dice n (+1 d20 resist if intel>=12; +1 d20 soak if armoured and !noArmor) |
| drain | dmg dice n (+1 d20 resist if intel>=12; never a soak) |
| debuff | 1 d4 (+1 d20 resist if intel>=12) |
| heal | dmg dice n |
| summon | 1 (`rng.pick`) |
| any bolt/drain with a live member | +1 `pickFoeTarget` die first, drawn before resist/damage |

**Drudge/Djinni cadence traces (confirmed by test 6 and test 4):**
- Drudge kit (`drudgeLightning` every:3, `drudgeFireball` every:2, `drudgeWeaken` every:4, `drudgeFreeze` unbounded fallback), kit order as listed, over six visits: **v1 Freeze** (nothing else ready yet) → **v2 Fireball** (its cd reaches 0 this visit) → **v3 Lightning** (its cd reaches 0) → **v4 Fireball** (cd 0 again, ahead of Weaken/Freeze in kit order) → **v5 Weaken** (cd reaches 0; sets `foeEffect: {kind:"weakened", rounds:2}`) → **v6 Lightning**. This matched the plan's own hand-traced expectation exactly — no order adjustment was needed.
- Djinni-shaped `every:4` cadence (using the Drake's `drakeBreath` descriptor as the concrete every:4 example): visits 1-3 tick cd 3→2→1 (melee each time); visit 4 fires (cd resets to 4); visits 5-7 tick cd 3→2→1 (melee); visit 8 a d6 roll of 5/6 skips the cast even though ready, leaving cd at 0 (not consumed); visit 9 fires from cd 0, resets to 4.

**The 11 event shapes:**
- `foeCast { name, ability, kind, txt }`
- `foeBolted { name, ability, dmg, ignoresArmor, member? }`
- `foeDrained { name, ability, stolen, wp, maxWP }`
- `foeDebuffed { name, ability, kind, rounds }`
- `foeHealed { name, ability, amount, wp, maxWP }`
- `foeSummoned { name, by, pending }`
- `foeEffectFaded { kind }`
- `heroResisted { name, ability, roll, intel }`
- `heroResistFailed { name, ability, roll, intel }`
- `foePursued { name }`
- `foeOutOfSpells { name }`
- (plus `foeFled { name, reason: "lowHp" }` — an additive branch on the existing `foeFled` event, not a new type)

## Decisions Made

- `heroResist`'s internal helper pushes `heroResisted`/`heroResistFailed` via two literal `type: "..."` object literals (an `if`/`else if`, not a ternary-computed `type` field) so the plan's own acceptance-criteria grep (a literal `type: "[A-Za-z]*"` regex) can find both — a ternary-computed type string is behaviorally identical but invisible to that particular grep pattern.
- Test 16 ("summoned foe accounting") calls `killFoe` directly on the joined Skeleton rather than chaining two full `playerStrike` calls through a real (non-revival) kill's treasure/cooking rng draws — proves the same claim ("an ordinary `C.foes` entry gets normal XP/purse/split accounting") with a far shorter, more robust rng sequence. `playerStrike`'s own targeting of a joined foe is already covered structurally (no target-selection special-casing exists for summoned foes — they're plain array entries).
- No order adjustment was needed for the Drudge kit-order trace (test 6) — the plan's own hand-traced expectation matched the implementation exactly on first run.

## Deviations from Plan

None — plan executed exactly as written. (The two implementation notes above are the plan's own explicitly-invited "adjust ONLY if it disagrees, and document" and "planner discretion" allowances, not deviations from the locked contract.)

## Issues Encountered

- The pre-existing `git diff --quiet d5fc90a -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness/comparables.js` acceptance check reports "changed" — this is **not** from this plan's work. `d5fc90a` predates 19-01/19-02's own (deliberate, already-committed) `comparables.js` carve-outs for `f.abilities`/`f.cd`/`f.uses`/`c.foeEffect`/`C.pendingFoes`. Verified via `git status --short test/parity/` showing zero uncommitted changes in that directory before, during, and after this plan's three commits — the diff is 51 lines of prior-plan additions to `comparables.js` only, `fixtures`/`prototype-master.js.txt` are untouched. The frozen-fixture/master-file prohibition itself holds; only the anchor commit for this specific grep is stale.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 19-04 can proceed directly: the D-15 determinism suite (forcing Magical/Demons/Walking Dead encounters), the FID-02 draw-count Section 4 additions, the D-21 on-screen chip labels ("Weakened"/"Dazed"), the invariant-test extension, and the phase gate are all it owns per the plan's own scope split — every contract it depends on (resolver signatures, `foeTurn` step order, `applyFoeDamageToPlayer`'s shape, the `pendingFoes` wrapper, the draw table, the cadence traces, and the 11 event shapes) is documented above and pinned by this plan's own passing tests.
- No blockers. `npm test` is green (852/852), parity is byte-identical (30/30), and every FID-02 pin from Phase 18 is unchanged (20/20).

---
*Phase: 19-foe-abilities-spellcasting-symmetric-int-resistance*
*Completed: 2026-09-13*

## Self-Check: PASSED

All created/modified files and all four commit hashes (`a730fb9`, `96b3fc8`, `c48cdbb`, `23dcbe3`) verified present.
