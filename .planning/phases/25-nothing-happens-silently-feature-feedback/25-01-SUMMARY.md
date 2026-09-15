---
phase: 25-nothing-happens-silently-feature-feedback
plan: 01
subsystem: engine
tags: [combat, narration, event-payload, feature-feedback, oracle, feed-01, feed-02, feed-06]

# Dependency graph
requires:
  - phase: 24-every-sub-class-and-race-one-good-one-bad
    provides: "Passive class/race mechanics this plan surfaces (Guard/Agility need shift, Fridgian hide, Dwarven armorWear, Soldier crit-on-2, Acrobat dagger-only rule)"
provides:
  - "engine/derived.js#foeToHitBreakdown(state) -> { need, mods } — a narration-only breakdown of foeToHitVs's arithmetic, proven value-identical across the full race x sub x skill x override matrix"
  - "engine/combat.js: needMods on struckByFoe/foeMissed(hero+member+pursuit)/memberStruck; soaked{hardiness,hide,ward} + soldierCrit on struckByFoe/foeBolted; armorSoaked.wear + .halved; struck.need + struck.critBy"
  - "engine/movement.js: rested.doubled, armorPatched.by (always); engine/magic.js: scrollRefused{reason}, potionDrunk.doubled; engine/items.js: exported weaponRefusalReason(c, it) -> 'acrobat' | 'wrongClass' | null"
  - "src/browser/eventNarration.js: scrollRefused entry + extended struckByFoe/foeBolted/foeMissed/memberStruck/armorSoaked/struck/strikeMissed/rested/potionDrunk/armorPatched/itemRejected/equipRejected builders, all rendering the new fields only when present"
  - "test/unit/feedback-payload.test.js (37 tests) proving every field present-when-applicable / absent-otherwise, the breakdown/foeToHitVs equality matrix, and zero-draw refusals"
affects: [25-02, 25-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only event enrichment: every new field is a trailing conditional spread (`...(condition ? { field } : {})`) appended after a function's existing keys, so a pinned key-order/shape assertion on the unflagged path never moves"
    - "Narration-breakdown twin: foeToHitBreakdown(state) reproduces foeToHitVs(state)'s exact arithmetic step order and asserts equality by test matrix, rather than refactoring the pinned original function"
    - "Presentation-only field convention: strikeMissed.quip is documented as set ONLY by 25-02's decorateMisses, never by the engine — the Oracle builder renders it if present without the engine ever emitting it"

key-files:
  created:
    - test/unit/feedback-payload.test.js
  modified:
    - engine/derived.js
    - engine/combat.js
    - engine/movement.js
    - engine/magic.js
    - engine/items.js
    - src/browser/eventNarration.js
    - test/unit/inventory-actions.test.js
    - test/unit/magic.test.js

key-decisions:
  - "foeToHitVs's own body is left completely untouched (zero risk) rather than delegating to foeToHitBreakdown — the two are proven value-identical by a dedicated matrix test instead, per the plan's explicit 'either way' discretion clause."
  - "weaponRefusalReason mirrors armorRefusalReason's shape (null | reason string) and is wired at both canEquipWeapon call sites (takeItem, equipItem); the Acrobat dagger-only rule now reports reason 'acrobat' instead of the generic 'wrongClass' whenever the character's class letter IS otherwise legal for the weapon."
  - "readScroll's combined `if (!c.scrolls || !canRead(state)) return events;` guard splits into two independent early-return checks, each pushing its own named `scrollRefused` event before any mutation or rng draw — preserves the zero-draw/no-mutation contract while naming the reason."
  - "struckByFoe's soldierCrit renders identically to critical ('Critical!') in the Oracle — a Soldier's roll-of-2 IS a crit for narration purposes even though the engine's own `critical` flag (roll===1) stays false for it."

patterns-established:
  - "needMods threading: any foe-vs-hero to-hit site that already computes `need`/`mNeed` via foeToHitVs also builds a parallel `needMods` array (seeded from foeToHitBreakdown(state).mods, then appended with blind/penalty/insulted post-mod deltas in the SAME order the existing arithmetic already applies them) and spreads it onto the pushed event only when non-empty."

requirements-completed: [FEED-01, FEED-02, FEED-06]

coverage:
  - id: D1
    description: "Every foe-vs-hero swing event (struckByFoe, foeMissed in all three branches, memberStruck) names the passive modifiers that changed its to-hit number via an additive needMods array, and is proven value-identical to foeToHitVs across the full race x sub x Agility x mirror x invis x dark matrix"
    requirement: "FEED-01"
    verification:
      - kind: unit
        ref: "test/unit/feedback-payload.test.js#foeToHitBreakdown matrix + needMods tests (10 tests); test/unit/combat.test.js struckByFoe key-order pin (unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "struckByFoe/foeBolted name what soaked the blow (soaked.hardiness/hide/ward), a Soldier's roll-of-2 carries soldierCrit, armorSoaked reports real wear plus the Dwarven halving, and struck carries need + a reasoned critBy — all conditional, absent for a plain hero"
    requirement: "FEED-01"
    verification:
      - kind: unit
        ref: "test/unit/feedback-payload.test.js soaked/soldierCrit/armorSoaked/struck sections (11 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "rested/potionDrunk name who doubled the heal (Soldier or a heal2x race); armorPatched always names who mended (Sewing | Master of Arms); readScroll refuses out loud with a reason (noScrolls | pilfer | noRunes), zero draws, no mutation; an Acrobat's weapon rejection names 'acrobat' instead of the generic 'wrongClass'"
    requirement: "FEED-01, FEED-02"
    verification:
      - kind: unit
        ref: "test/unit/feedback-payload.test.js rested/potionDrunk/armorPatched/scrollRefused/weaponRefusalReason sections (6 tests); test/unit/magic.test.js readScroll no-op test (updated); test/unit/inventory-actions.test.js Acrobat equip pin (updated)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new/extended field renders a deadpan Oracle clause (EVENT_NARRATION), every builder survives a bare {type}, and every unflagged sentence stays byte-identical to before"
    requirement: "FEED-01, FEED-05 Oracle half, FEED-06"
    verification:
      - kind: unit
        ref: "test/unit/feedback-payload.test.js narration-clause section (6 tests); test/unit/formatEventsCoverage.test.js (no missing/dead entries); test/voice/safety-scan.test.js (voice clean)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No engine rule change: parity stays byte-identical (33/33, zero fixture diff), no new rng draws, no new serialized state, npm test fully green"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (33/33); git status --porcelain test/parity (empty); npm test (1225 pass, 0 fail); test/determinism/rng-no-math-random.test.js (pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-09-15
status: complete
---

# Phase 25 Plan 01: Passive Modifier & Refusal Payload (Engine Half) Summary

**Every foe-swing event now names its to-hit modifiers and damage soak, armour reports real wear and the Dwarven halving, player crits name their reason, and every scroll/weapon/camp-heal refusal or doubling names itself — all as additive event fields with zero rule changes and byte-identical parity (33/33).**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 8 (6 engine/presentation files, 2 test-pin updates) + 1 new test file

## Accomplishments

- `engine/derived.js` gained `foeToHitBreakdown(state)` — a pure narration breakdown of `foeToHitVs`'s exact arithmetic, returning `{ need, mods: [{ name, delta }] }`; `foeToHitVs` itself is untouched, and the two are proven value-identical across a 6 race × 4 sub × 2 Agility × 2 mirror × 2 invis × 2 dark(+Silence) = 768-combination matrix.
- `engine/combat.js`: `needMods` is now threaded through every foe-vs-hero to-hit site (foeTurn's hero branch, foeTurn's member branch, pursuitStrike) into `struckByFoe`/`foeMissed`/`memberStruck`, in the same post-mod order the engine already applies (blind → penalty → insulted). `applyFoeDamageToPlayer` now computes an additive `soaked` object (`hardiness`/`hide`/`ward`, only the keys that fired), `soldierCrit: true` for a Soldier's roll-of-2, and `armorSoaked.wear` (the real durability cost) plus `.halved: true` for the Dwarven race. `playerStrike`'s `struck` event now carries `need` (fixing the Oracle's old "N vs ?" hole) and `critBy` (`roll | silence | stealth | backstab | ninja | cutthroat`, most-specific reason wins).
- `engine/movement.js`: `rested.doubled` names "Soldier" or a heal2x race only when the camp heal was doubled; `armorPatched.by` always names "Sewing" or "Master of Arms".
- `engine/magic.js`: `readScroll`'s combined silent guard splits into two named `scrollRefused` events (`noScrolls` | `pilfer` | `noRunes`), still zero rng draws and no mutation before the refusal; `drinkPotion`'s `potionDrunk.doubled` names a heal2x race.
- `engine/items.js`: new exported `weaponRefusalReason(c, it)` (mirrors `armorRefusalReason`) — an Acrobat's dagger-only rule now reports `"acrobat"` instead of the generic `"wrongClass"` at both weapon-refusal call sites (`takeItem`, `equipItem`).
- `src/browser/eventNarration.js`: new `scrollRefused` entry plus extended `struckByFoe`/`foeBolted`/`foeMissed`/`memberStruck`/`armorSoaked`/`struck`/`strikeMissed`/`rested`/`potionDrunk`/`armorPatched`/`itemRejected`/`equipRejected` builders — every new clause renders only when its field is present, so every unflagged sentence is byte-identical to before. `strikeMissed` also renders a presentation-only `e.quip` field (documented as set ONLY by 25-02's `decorateMisses`, never by the engine) after the plain miss sentence.
- New `test/unit/feedback-payload.test.js` (37 tests): the breakdown/foeToHitVs equality matrix, needMods on every branch (including pursuitStrike via `flee()`), soaked stacking (Hardiness→hide, ward), soldierCrit gating, armorSoaked wear/halved/magic-plate, every `critBy` reason, rested/potionDrunk/armorPatched doubling, scrollRefused's three reasons with a `countingRng` zero-draw proof, `weaponRefusalReason`'s acrobat/wrongClass split, and the narration clauses themselves.
- Final suite: `npm test` 1225 pass / 0 fail (1188 baseline + 37 new); `node --test "test/parity/**/*.test.js"` 33/33, zero fixture diff; `test/determinism/rng-no-math-random.test.js` green.

## Field Reference for 25-02/25-03 (exact key names)

| Event | New field(s) | Shape / values |
|---|---|---|
| `struckByFoe` | `soaked?`, `needMods?`, `soldierCrit?` | `soaked: { hardiness?, hide?, ward? }` (ints); `needMods: [{ name, delta }]`; `soldierCrit: true` |
| `foeBolted` | `soaked?` | same shape as above |
| `foeMissed` (hero/member/pursuit) | `needMods?` | `[{ name, delta }]` |
| `memberStruck` | `needMods?` | `[{ name, delta }]` |
| `armorSoaked` | `wear` (always), `halved?` | `wear: <int>`; `halved: true` |
| `struck` | `need` (always), `critBy?` | `critBy: "roll" \| "silence" \| "stealth" \| "backstab" \| "ninja" \| "cutthroat"` |
| `strikeMissed` | `quip?` (PRESENTATION-ONLY — set by 25-02, never the engine) | string, appended after the roll + miss sentence |
| `rested` | `doubled?` | `"Soldier"` or a heal2x race name |
| `potionDrunk` | `doubled?` | a heal2x race name |
| `armorPatched` | `by` (always) | `"Sewing"` \| `"Master of Arms"` |
| `scrollRefused` (new event type) | `reason` | `"noScrolls"` \| `"pilfer"` \| `"noRunes"` |
| `itemRejected` / `equipRejected` | reason value | `"acrobat"` (new, alongside existing `wrongClass`/`notBetter`/`noArmor`/`woodsman`/`tooHeavy`) |

`engine/derived.js#foeToHitBreakdown(state)` is exported for any future narration consumer: `{ need, mods: [{ name, delta }] }`, value-identical to `foeToHitVs(state)`.

`engine/items.js#weaponRefusalReason(c, it)` is exported: returns `null` | `"acrobat"` | `"wrongClass"`.

## Task Commits

Each task was committed atomically:

1. **Task 1: foeToHitBreakdown + needMods on every foe swing event; soaked/soldierCrit/armour wear in applyFoeDamageToPlayer; struck.need + critBy in playerStrike** - `3fe1cc9` (feat)
2. **Task 2: rested.doubled/potionDrunk.doubled/armorPatched.by, scrollRefused, weaponRefusalReason("acrobat"), and every Oracle clause in EVENT_NARRATION** - `097052a` (feat)
3. **Task 3: feedback-payload tests (matrix equality, every field present/absent, zero-draw refusal, narration clauses) + full suite and parity proof** - `51fb950` (test)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `engine/derived.js` - new exported `foeToHitBreakdown(state)`; `foeToHitVs` untouched
- `engine/combat.js` - `needMods`/`soaked`/`soldierCrit`/armour `wear`/`halved`/`struck.need`/`critBy` threaded through `applyFoeDamageToPlayer`, `foeTurn`, `pursuitStrike`, `playerStrike`
- `engine/movement.js` - `rested.doubled`, `armorPatched.by`
- `engine/magic.js` - `scrollRefused` (split guard), `potionDrunk.doubled`
- `engine/items.js` - new exported `weaponRefusalReason(c, it)`, wired at both weapon-refusal call sites
- `src/browser/eventNarration.js` - `scrollRefused` entry + 11 extended builders, two new shared render helpers (`soakedText`, `needModsClause`/`needModsText`)
- `test/unit/inventory-actions.test.js` - Acrobat equip-rejection pin updated to `reason: "acrobat"`
- `test/unit/magic.test.js` - `readScroll` no-op test updated to assert the named refusal event, zero draws, no mutation
- `test/unit/feedback-payload.test.js` - new, 37 tests

## Decisions Made

See `key-decisions` in the frontmatter above (foeToHitVs left untouched; weaponRefusalReason mirrors armorRefusalReason; readScroll's guard split; soldierCrit renders identically to critical).

## Deviations from Plan

None - plan executed exactly as written. One pre-existing test (`test/unit/magic.test.js`'s "readScroll: no scrolls or cannot read is a no-op") asserted the OLD silent-no-op behavior the plan explicitly replaces (FEED-02); updating it to assert the new named-refusal behavior was mandated by the plan itself (`must_haves.artifacts`: "test/unit/inventory-actions.test.js — the one Acrobat reason pin updated" — this magic.test.js update is the same category of expected pin churn, not a deviation).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every additive field 25-02 (toast table) and 25-03 (toastsForAction pipeline / shell wiring) need is now landed and documented above with exact key names — both plans can read this table directly instead of re-deriving field shapes from source.
- Parity is byte-identical (33/33, zero fixture diff); `npm test` is fully green (1225/1225); no engine rule changed, no new rng draw, no new serialized state.
- No blockers for 25-02/25-03.

---
*Phase: 25-nothing-happens-silently-feature-feedback*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: engine/derived.js
- FOUND: engine/combat.js
- FOUND: engine/movement.js
- FOUND: engine/magic.js
- FOUND: engine/items.js
- FOUND: src/browser/eventNarration.js
- FOUND: test/unit/feedback-payload.test.js
- FOUND: test/unit/inventory-actions.test.js
- FOUND: test/unit/magic.test.js
- FOUND commit: 3fe1cc9 (Task 1)
- FOUND commit: 097052a (Task 2)
- FOUND commit: 51fb950 (Task 3)
