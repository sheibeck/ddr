---
phase: 31-combat-start-gating-effect-hygiene
plan: 02
subsystem: engine-combat
tags: [refusal-vocabulary, afraid, cmb-02, cmb-03, cmb-04, cmb-05, cmb-06, item-gate, acuteness, elven-flip]

# Dependency graph
requires:
  - phase: 31-combat-start-gating-effect-hygiene
    plan: 01
    provides: "refuseIfPending guard, combat.afraid/afraidNeed/afraidDamage, combatJoined{first}, the castRefused/actionRefused/useRefused reason vocabulary's notFought/cooldown/wrongClass/combatOnly/exploreOnly/noTarget entries already landed ahead of schedule"
provides:
  - "engine/magic.js#castSpell: combatOnly guard (castRefused) placed after the charge/grimoire/level/school diagnostics and before c.spellsUsed++ — applies to direct casts and scroll casts alike; the dead-target retarget mirroring playerStrike; afraidNeed/afraidDamage wired into the thrown/Earthquake/Volley branches (needMods on spellThrown, afraid:true on spellHit)"
  - "engine/items.js#useItem: TARGETED_KINDS export; the full refusal ladder (wrongClass -> pilfer -> combatOnly -> cooldown) before usedAt/itemUsed fire; foeStoned{names} pushed before the stone case's per-foe kill loop; the narrow cleared-check (encounterCleared -> endCombat) after any item kill, without a full afterPlayerAction call; afraidDamage wired into the Pine Staff's fire damage"
  - "engine/combat.js#sing: cooldown/wrongClass split out of songReady's old silent no-op; Acuteness's per-foeTurn-round tick (between mirror and foeEffect) and endCombat's unconditional clear"
  - "engine/movement.js: Acuteness's per-exploration-step tick, mirroring haste/invis/ether"
  - "engine/derived.js#conditionsOf: the ward chip {key:'ward', polarity:'good', pool, remaining, name}, placed after might and before flight"
  - "content/races.js: the Elven foeToHit flip (-1 -> +1, DELIBERATE RULES CHANGE, user decision 2026-09-16) — Elves are now genuinely easier to hit (foe need 6 vs the Human 5), matching every design source"
  - "docs/USABLE-FEATURES-AUDIT.md: the full CMB-02 ledger (refusal vocabulary, every spell/potion/staff/cloak/jewelry/scroll circumstance, every class/race/sub-class active feature, the Afraid penalty as a §5b penalty row never a refusal, every timed effect's expiry, verified-not-bugs, declared divergences, Plan 03's shell obligations)"
  - "test/unit/cast-refusals.test.js, item-combat-gate.test.js, effect-expiry.test.js, usable-features-audit.test.js (new); afraid.test.js extended with the spell/item side (x)-(xiv); magic/conditions/identity-contract/item-wiring/items re-pinned"
affects: [31-03-shell-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TARGETED_KINDS (engine/items.js, exported Set) — the one definition of which useItem kinds are combat-targeted (freeze/weaken/stone/fire/gas); consumed by both useItem's own combatOnly gate and the usable-features-audit test, so the two can never drift apart"
    - "The 'empty-foes combat, not combat:null' trick — a fixedCombat([]) bypasses a combatOnly guard (state.combat is truthy) while keeping afterPlayerAction's trailing tail a zero-draw no-op (its own first check, !liveFoes(state).length, clears immediately) — used throughout the re-pinned magic.test.js Apprentice-backfire/Earthquake-ward tests to keep pre-existing fakeRng sequences byte-identical after the new combatOnly guard moved the goalposts"
    - "Real seeded rng (makeRng(seed), never throws) for the usable-features-audit test's bulk per-spell/per-item generation, reserving fakeRng's zero-draw-proof discipline for the refusal-ladder assertions where 'zero draws' is itself the claim under test — this avoided hand-tracing ~150 individual draw sequences while keeping every refusal-path test exact"

key-files:
  created:
    - test/unit/cast-refusals.test.js
    - test/unit/item-combat-gate.test.js
    - test/unit/effect-expiry.test.js
    - test/unit/usable-features-audit.test.js
    - docs/USABLE-FEATURES-AUDIT.md
  modified:
    - engine/magic.js
    - engine/items.js
    - engine/combat.js
    - engine/movement.js
    - engine/derived.js
    - content/races.js
    - src/browser/toasts.js
    - src/browser/eventNarration.js
    - test/unit/magic.test.js
    - test/unit/afraid.test.js
    - test/unit/conditions.test.js
    - test/unit/identity-contract.test.js
    - test/unit/item-wiring.test.js
    - test/unit/items.test.js

key-decisions:
  - "Acuteness ticks BOTH per foeTurn round (in combat) AND per exploration step (outside combat) — RESEARCH §6.1's 'Key Decision' open question resolved as a synthesis of its options 2+3: the timer starts counting the moment it's drunk from Gear (per-step tick honors CMB-03's 'starts its timer immediately'), and clears unconditionally at endCombat regardless of remaining count (so a round-based effect never survives past the fight it's active in, even mid-count)."
  - "Damage-halving scope for Afraid (Claude's discretion, plan-authorized): every point of damage the HERO deals DIRECTLY — weapon strikes (Plan 01), thrown-spell hits, Earthquake (including its own self-damage, since both reuse the same post-halved `d` variable — a deliberate, plan-specified reuse, not an oversight), Volley bolts, and the Pine Staff's fire. Never companion/ally strikes, ward/acid ticks, or foe-dealt damage."
  - "The cast-damage record (seed 8, Freeze) was RE-VERIFIED, not re-measured: the thrown-spell need shrink (6->3) still admits the fixture's pinned d10=1 roll, and Freeze's kill-through-killFoe payout is hp-independent, so the declared Plan 01 divergence record holds byte-identical with zero fixture edits."
  - "Elven foeToHit +1 lands at the DATA layer only (content/races.js), never at the consumer (engine/derived.js#foeToHitVs/foeToHitBreakdown) — the consumer already reads `h += R.foeToHit` additively, so the sign flip alone corrects the direction with zero fixture impact (verified: chargen seed 13 and encounters/faerie seed 38 are the only two Elven-hero fixtures and neither ever reaches foeToHitVs)."

patterns-established:
  - "See tech-stack.patterns above"

requirements-completed: [CMB-02, CMB-03, CMB-04, CMB-05, CMB-06]

coverage:
  - id: D1
    description: "castSpell refuses every combat-only spell outside combat (castRefused combatOnly) before any side effect — applies to direct casts and scroll casts alike, closing the Earthquake/Death self-harm-for-nothing bug; the guard ladder order (notFought -> noChargesLeft -> spellNotKnown -> spellAboveLevel -> spellSchoolLocked -> combatOnly) is pinned; the dead-target retarget makes noTarget unreachable for thrown/acid/blind/petrify/stupid/insane in combat"
    requirement: "CMB-02"
    verification:
      - kind: unit
        ref: "test/unit/cast-refusals.test.js — ladder order, retarget, sing cooldown/wrongClass/ready, combatOnly scroll cast, afraid negative pin"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js — every combat:null combatOnly-spell test re-pinned to the new guard"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Afraid penalty extends to the spell/item side: thrown-spell target shrinks by AFRAID_TO_HIT_PENALTY (needMods on spellThrown), and every hero-dealt spell/item damage (thrown, Earthquake incl. self-damage, Volley, Pine Staff fire) halves via afraidDamage (afraid:true on spellHit) — zero new rng draws, never a refusal for fear anywhere"
    requirement: "CMB-02"
    verification:
      - kind: unit
        ref: "test/unit/afraid.test.js — tests (x)-(xiv)"
        status: pass
    human_judgment: false
  - id: D3
    description: "useItem's full refusal ladder (wrongClass for a non-caster's staff, pilfer, combatOnly for a targeted kind outside combat, cooldown naming the squares left) fires before usedAt/itemUsed — buff potions/items already worked anywhere and now provably so; targeted staves/amulets refuse instead of silently fizzling and burning their cooldown"
    requirement: "CMB-03"
    verification:
      - kind: unit
        ref: "test/unit/item-combat-gate.test.js — combatOnly/wrongClass/cooldown rows, the every-potion-eff2 in/out-of-combat parity check, the free-action (no foe turn) pin"
        status: pass
      - kind: unit
        ref: "test/unit/items.test.js — the re-pinned cooldown test"
        status: pass
    human_judgment: false
  - id: D4
    description: "conditionsOf surfaces the ward as {key:'ward', polarity:'good', pool, remaining, name}, placed after might and before flight; pool<=0 or ward null yields no chip; a pure read"
    requirement: "CMB-04"
    verification:
      - kind: unit
        ref: "test/unit/conditions.test.js — the four new ward tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "c.acute decrements exactly once per foeTurn round (between the mirror and foeEffect ticks) AND once per exploration step, never below 0, never adding the key to a character that lacked it, and clears unconditionally (with one acuteFaded) at endCombat"
    requirement: "CMB-05"
    verification:
      - kind: unit
        ref: "test/unit/effect-expiry.test.js — foeTurn/endCombat/move() tick-and-clear pins, the full 5-effect tail order (ward->mirror->acute->foeEffect->afraid), and every OTHER timed effect's untouched behavior"
        status: pass
    human_judgment: false
  - id: D6
    description: "An item kill (stone/fire) that removes the last live foe closes the encounter through the normal encounterCleared -> endCombat path in the SAME useItem call, with a full killFoe payout per stoned foe and a foeStoned{names} line before the per-foe foeKilled lines; a 4-of-5 stone leaves combat open with 1 live foe; items never gain foe retaliation (no afterPlayerAction call)"
    requirement: "CMB-06"
    verification:
      - kind: unit
        ref: "test/unit/item-combat-gate.test.js — the Amulet-of-Stone payout-equals-direct-killFoe pin, the 5-foe 4-stoned pin, the Oak Staff/Pine Staff cleared-encounter pins, the freeze/gas no-kill-stays-open pin"
        status: pass
    human_judgment: false
  - id: D7
    description: "docs/USABLE-FEATURES-AUDIT.md documents every usable spell/potion/staff/cloak/jewelry/scroll circumstance and every class/race/sub-class active feature's refusal reason, records Afraid as a PENALTY row (never a refusal) in its own §5b, and lists every timed effect's expiry (§6); a table-driven, doc-synced test (150 rows) exercises each row and keeps the doc honest"
    requirement: "CMB-02"
    verification:
      - kind: unit
        ref: "test/unit/usable-features-audit.test.js — 150/150 passing, including 6 doc-sync tests"
        status: pass
    human_judgment: false
  - id: D8
    description: "Elven foeToHit flipped -1 -> +1 (DELIBERATE RULES CHANGE, user decision 2026-09-16) — Elves are genuinely easier to hit (foe need one HIGHER than a Human's), matching every design source; zero fixture impact; identity-contract asserts the direction, not a literal number"
    requirement: "CMB-02"
    verification:
      - kind: unit
        ref: "test/unit/identity-contract.test.js — the re-pinned Elven bad-case (foeToHitVs(elven) === foeToHitVs(control) + 1)"
        status: pass
    human_judgment: false
  - id: D9
    description: "npm test fully green (1834/1834, up from Plan 01's 1641 baseline); prototype-master.js.txt and every fixture untouched; no new rng draws anywhere this plan touches"
    verification:
      - kind: unit
        ref: "npm test (1834/1834); git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt (empty)"
        status: pass
    human_judgment: false
  - id: D10
    description: "On-device verification of the Acuteness chip, the Amulet of Stone's encounter close, staff cooldown/combatOnly toasts, and the afraid thrown-spell cast/narration end to end (deferred to the end of the milestone run, after Plan 03's shell wiring)"
    verification: []
    human_judgment: true
    rationale: "Requires a physical device session with an active encounter and Gear tab to observe the chip counting down, the loot card after an Amulet kill, and the toast/Oracle copy together — Plan 03 (shell wiring) is what wires these engine events to visible UI; see the Human verification section below"

duration: 55min
completed: 2026-09-16
status: complete
---

# Phase 31 Plan 2: Usable-Features Refusal Vocabulary & Effect Hygiene Summary

**Closes CMB-02..CMB-06 engine-side: `castSpell`/`useItem` refuse every gated circumstance by name instead of silently fizzling, the Afraid penalty extends to spells/items, Acuteness finally counts down and clears, the Shield chip has data, an item kill closes the encounter with a full payout, the Elven `foeToHit` sign is corrected, and `docs/USABLE-FEATURES-AUDIT.md` + a 150-row doc-synced test complete the audit — full suite 1834/1834, zero fixture drift.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 19 (5 new, 14 modified)

## Accomplishments

- `engine/magic.js#castSpell`: a `combatOnly` guard (`castRefused {spell, reason:"combatOnly"}`) sits after the charge/grimoire/level/school diagnostics and before `c.spellsUsed++`, closing the Earthquake/Death self-harm-for-nothing bug and applying to scroll casts too (the scroll still consumes; nothing fizzles); a dead-target retarget mirrors `playerStrike`'s so `noTarget` is unreachable in combat for thrown/acid/blind/petrify/stupid/insane
- The Afraid penalty (Plan 01's strike-side mechanic) extends to spells and items: `afraidNeed` shrinks the thrown-spell target (4→1, Freeze 6→3, `needMods` on `spellThrown`), `afraidDamage` halves thrown/Earthquake(incl. self-damage)/Volley/Pine-Staff-fire damage (`afraid:true` on `spellHit`) — zero new rng draws, and no refusal is ever named after fear anywhere in the engine (grep-verified)
- `engine/combat.js#sing`: the old silent `songReady` no-op splits into `actionRefused {reason:"cooldown", left}` / `actionRefused {reason:"wrongClass"}`
- `engine/items.js#useItem`: `TARGETED_KINDS` (freeze/weaken/stone/fire/gas) drives a full refusal ladder — `wrongClass` (a staff by a non-caster) → `pilfer` → `combatOnly` (a targeted kind outside combat) → `cooldown {left}` (`itemReady`'s old silent no-op) — all before `usedAt`/`itemUsed` fire; `foeStoned {names}` is pushed before the stone case's per-foe `killFoe` loop; a narrow cleared-check after the switch closes the encounter (`encounterCleared` → `endCombat`) after ANY item kill without giving items foe retaliation
- Acuteness (`c.acute`) finally decrements: once per `foeTurn` round (between the mirror and foeEffect ticks) and once per exploration step (`movement.js`), clearing unconditionally at `endCombat` — the headline CMB-05 fix, permanent since chargen until now
- `engine/derived.js#conditionsOf` gained the ward chip `{key:"ward", polarity:"good", pool, remaining, name}`, placed after might and before flight
- `content/races.js`'s Elven `foeToHit` flipped `-1` → `+1` (DELIBERATE RULES CHANGE, user decision 2026-09-16, roll-direction audit Finding 1) — the prototype's `-1` made Elves HARDER to hit because `foeToHitVs` adds it to the foe's need; `+1` makes them genuinely easier to hit, matching the race's own note, `flavor.js`, and `CLASS-PASS.md`; zero fixture impact
- `docs/USABLE-FEATURES-AUDIT.md` (new, §1-9): the refusal vocabulary, every spell (32)/potion (10)/staff (8)/cloak+jewelry `use` kind/scroll circumstance, every class/race/sub-class active feature, Afraid as a §5b PENALTY row (never a refusal), every timed effect's expiry (§6), verified-not-bugs (§7), declared divergences incl. the Elven flip (§8), and Plan 03's shell obligations (§9)
- `test/unit/usable-features-audit.test.js` (new, 150 tests): a `CASES` array walks every SPELLS/POTIONS/STAVES row outside and inside combat, the guard-ladder generics, cloak/jewelry `use` kinds, scrolls, and Strike/Flee/Parley/Sing's refusals + afraid-never-refuses rows, plus 6 doc-sync tests
- New `test/unit/cast-refusals.test.js` (11 tests), `item-combat-gate.test.js` (9 tests), `effect-expiry.test.js` (11 tests); `afraid.test.js` extended with 5 new tests ((x)-(xiv))
- Full suite: **1834/1834 passing (0 fail)**, up from Plan 01's 1641 baseline; `test/parity/prototype-master.js.txt` and every fixture untouched (`git status --porcelain` empty)

## Task Commits

Each task was committed atomically:

1. **Task 1: Spell/scroll/song refusals, dead-target retarget, spell/item Afraid** - `1fb222f` (feat)
2. **Task 2: useItem refusal ladder + item-kill close, Acuteness expiry, ward chip, Elven flip** - `f9be52d` (feat)
3. **Task 3: docs/USABLE-FEATURES-AUDIT.md + table-driven doc-synced test** - `6726869` (docs)

## Files Created/Modified

**Engine:**
- `engine/magic.js` — `castSpell`'s `combatOnly` guard + retarget line; `afraidNeed`/`afraidDamage` wired into the thrown/quake/volley branches
- `engine/items.js` — `TARGETED_KINDS`; `useItem`'s full refusal ladder; `foeStoned`; the narrow cleared-check; `afraidDamage` on the fire staff
- `engine/combat.js` — `sing`'s cooldown/wrongClass split; the `foeTurn` tail's acute tick; `endCombat`'s acute clear
- `engine/movement.js` — the per-step acute tick
- `engine/derived.js` — `conditionsOf`'s ward entry
- `content/races.js` — the Elven `foeToHit` flip + DELIBERATE RULES CHANGE comment

**Presentation:**
- `src/browser/toasts.js`, `src/browser/eventNarration.js` — `foeStoned`/`acuteFaded` copy; `spellThrown`/`spellHit` render `needModsClause`/the afraid fear-pulls-the-spell line

**New tests:**
- `test/unit/cast-refusals.test.js`, `test/unit/item-combat-gate.test.js`, `test/unit/effect-expiry.test.js`, `test/unit/usable-features-audit.test.js`

**Docs:**
- `docs/USABLE-FEATURES-AUDIT.md` (new)

**Re-pinned:**
- `test/unit/magic.test.js` — every `combat: null` combatOnly-spell cast test moved to the new `castRefused` guard (the Apprentice-backfire and Earthquake-ward tests moved to an "empty-foes combat" instead of `combat: null` to keep their original zero-extra-draw `fakeRng` sequences intact while bypassing the new guard)
- `test/unit/conditions.test.js` — `ward: null` added to `cleanChar`, four new ward tests
- `test/unit/identity-contract.test.js` — the Elven `bad:` case re-pinned to assert direction, not a literal number
- `test/unit/item-wiring.test.js`, `test/unit/items.test.js` — staff-using tests given a Magic User caster (the new `wrongClass` gate); the cooldown test re-pinned to the new `useRefused {reason:"cooldown", left}` event

## Decisions Made
See `key-decisions` in frontmatter. Headline: Acuteness ticks BOTH per `foeTurn` round and per exploration step (RESEARCH §6.1's open question resolved as options 2+3 combined), and Afraid's damage-halving reuses the same post-halved value for Earthquake's self-damage (a deliberate, plan-specified reuse rather than a separately-computed self-damage halving).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The new staff `wrongClass` gate broke a pre-existing `item-wiring.test.js` test**
- **Found during:** Task 2, running `node --test test/unit/item-wiring.test.js`
- **Issue:** `"Amulet of Stone petrifies up to 4 foes... a plain stone source hits 2"` used a default Fighter character (`fixedFighter`'s default `cls`) to exercise the Oak Staff's `aoe` default via `useItem` directly (bypassing the acquire-time `takeItem` gate, which already refused a Fighter a staff). The new use-time `wrongClass` gate (this plan's own CMB-02 deliverable) now correctly refuses that call before it ever reaches the stone case.
- **Fix:** Gave that one state a `cls: "Magic User"` override so the test keeps exercising the `aoe`-count logic it was written for, not the (separately, correctly) gated class check.
- **Files modified:** `test/unit/item-wiring.test.js`
- **Verification:** `node --test test/unit/item-wiring.test.js` green; full `npm test` 1834/1834.
- **Committed in:** `f9be52d` (Task 2 commit)

**2. [Rule 1 - Bug] A stray duplicate test survived an in-place edit, leaving two conflicting Earthquake-combat-only tests**
- **Found during:** Task 1, running `node --test test/unit/magic.test.js` after re-pinning the Earthquake/Death 04-DR10 block
- **Issue:** The first `Edit` call replaced the ward-sparing test + the following comment block with a new combatOnly-refusal test, but the OLD "Earthquake (combat-only) cast with no foes present still self-damages for zero benefit" test (documenting the pre-Plan-31 self-harm bug this very plan closes) still existed lower in the file, now asserting the STALE pre-fix behavior and failing against the fixed engine.
- **Fix:** Deleted the stale duplicate — its replacement (asserting the combatOnly refusal, zero self-damage) already existed from the same edit pass.
- **Files modified:** `test/unit/magic.test.js`
- **Verification:** `node --test test/unit/magic.test.js` — 39/39 green.
- **Committed in:** `1fb222f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug — both surfaced by this plan's own required verify commands, both necessary for `npm test` to stay green)
**Impact on plan:** Neither weakens an assertion or expands scope — both are direct, necessary consequences of this plan's own new gates (the `wrongClass` staff check, the `combatOnly` spell guard) breaking pre-existing tests that predated those gates.

## Issues Encountered

None beyond the two deviations above. The bulk of Task 3's effort went into designing the `usable-features-audit.test.js` generation strategy: an initial draft using `fakeRng([])`-style hand-traced sequences for ~150 rows proved impractical (many spell kinds pull in `afterPlayerAction`'s foeTurn/initiative tail unpredictably); switching to `makeRng(seed)` (a real, never-throwing seeded PRNG) for every "does it succeed" row — reserving exact `fakeRng` sequences for the zero-draw refusal-ladder assertions where "zero draws" is itself the claim — solved this cleanly and is recorded as a `tech-stack.patterns` entry for future similar audits.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 (shell wiring) can build directly on: the complete refusal vocabulary (every reason already has toast + Oracle copy); the `ward` chip data shape; the `acuteFaded`/`foeStoned` events and their copy; `docs/USABLE-FEATURES-AUDIT.md` §9's explicit shell obligations list (Use button always visible with countdown, the combat spell menu bridged to `canCast`/`spellLevelFor`, the Sing button's countdown, the Acute chip, the two-number ward chip).
- No blockers identified for Plan 03.

## Human verification (deferred to end of run)

Deferred to the end of the autonomous run (needs Plan 03's shell):
- Pixel 7: drink Acuteness from Gear in a corridor — the "Acute" chip appears and counts down as you walk; enter a fight — it keeps counting per round; when the fight ends the chip is gone and the Oracle shows "The Acuteness wears off."
- Use the Amulet of Stone on the last foe — "… turn to stone. Statues don't hit back.", the kill payout lines, and Phase 29's loot card (if a drop rolled) — no stranded combat screen.
- Tap a staff's Use in a corridor — a toast names why (wants a target); tap it on cooldown — the toast says how many squares are left and the row shows the countdown.
- In an afraid fight (the "Afraid · N rds" chip up), open Spells and cast a thrown spell (Fireball/Freeze): the cast goes ahead — never a refusal toast for fear — and the Oracle's line reads roll vs the shrunk need, e.g. "3 vs 1 (needs 1: afraid −3)"; a landed spell reads "… for N hp. Fear pulls the spell." with the halved number; your to-hit range shrinks by 3 while afraid, then the chip clears and "The fear passes." prints.
- Roll (or force) an Elven hero and confirm foes land on them noticeably more often than a Human control at the same level — the character sheet's own "TO HIT"/foe-need display should read the higher number (Finding 2 in the roll-direction audit — the sheet's own display bug — is OUT of this phase's scope; only the underlying number is fixed here).

---
*Phase: 31-combat-start-gating-effect-hygiene*
*Completed: 2026-09-16*

## Key Decision (copy into PROJECT.md)

| Elven foeToHit flipped −1 → +1 (easier to hit) — Phase 31, 2026-09-16 | The 1994 prototype's −1 made Elves HARDER to hit because foeToHitVs adds the value to the foe's need (hit on roll ≤ need) — the opposite of the race note, flavor.js and CLASS-PASS ("thin-boned and easy to hit"); the roll-direction audit caught the inversion and the user ruled the prose is canon | ✓ Deliberate canon deviation: data-layer flip in content/races.js with a DELIBERATE RULES CHANGE comment, identity-contract asserts the direction (foe need 6 vs 5), zero fixtures affected, master untouched |

## Self-Check: PASSED

All 5 new files (test/unit/cast-refusals.test.js, test/unit/item-combat-gate.test.js, test/unit/effect-expiry.test.js, test/unit/usable-features-audit.test.js, docs/USABLE-FEATURES-AUDIT.md) exist on disk; all 3 task commit hashes (1fb222f, f9be52d, 6726869) found in git history; `npm test` 1834/1834, 0 fail; `git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` empty.
