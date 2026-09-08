---
phase: 01-engine-extraction-determinism
plan: 02
subsystem: content
tags: [content-extraction, dice-notation, pure-data, es-modules]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/rng.js (makeRng), engine/dice.js (rollDice), content-is-pure-data + rng-no-math-random static guards, zero-dependency test tree"
provides:
  - "19 pure-data content modules under content/ covering every prototype rules table (classes, races, weapons, armors, kit, skills, MU chart, bestiary, encounters, spells, potions, foods, traps, afflictions, treasure tables, misc tables, flavor, epitaphs, names)"
  - "content/index.js barrel re-exporting all content symbols for single-import engine consumption"
  - "~79 embedded dice/pick RNG closures converted to plain {n,sides,bonus} dice-notation (or halve/times flags) the engine resolves via rollDice()"
  - "test/unit/content-tables.test.js: 14 spot-value assertions pinning extracted tables to the prototype's exact numbers"
  - "content-is-pure-data guard now live (no longer vacuous) across all 19 modules"
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content dice-closures -> plain {n,sides,bonus} dice-notation data (Pattern 1); flat non-dice values use {n:0,sides:0,bonus:flat} so rollDice() resolves everything uniformly"
    - "Special multiplier/transform flags (halve:true for Dagger/Whip's ceil(D(6)/2), times:5 for Spike's D(10)*5) recorded as sibling data fields next to the base dice notation, not baked into the notation itself"
    - "Callback-bearing string templates (CAUSE_TEXT's detail=>`...`) converted to plain {token} string data plus a companion *_TOKENS map recording which placeholder names the engine must supply"
    - "content/index.js barrel: single import surface for all content, so downstream engine modules never import individual table files directly"

key-files:
  created:
    - content/classes.js
    - content/races.js
    - content/weapons.js
    - content/armors.js
    - content/kit.js
    - content/skills.js
    - content/mu-chart.js
    - content/bestiary.js
    - content/encounters.js
    - content/spells.js
    - content/potions.js
    - content/foods.js
    - content/traps.js
    - content/afflictions.js
    - content/treasure-tables.js
    - content/misc-tables.js
    - content/flavor.js
    - content/epitaphs.js
    - content/names.js
    - content/index.js
    - test/unit/content-tables.test.js
  modified: []

key-decisions:
  - "SPELLS has 32 entries in the actual prototype source, not the 31 the plan's acceptance criteria illustratively stated — ground truth (direct read of mazeworld.html lines 831-864) wins; the content-tables test asserts 32 and documents the discrepancy rather than silently matching a wrong number."
  - "WEAPON_BONUS_TABLE placed in content/misc-tables.js (per the plan's top-level <artifacts> file mapping) rather than content/weapons.js (which Task 1's prose loosely implied) — resolved the ambiguity in favor of the authoritative artifacts list."
  - "CAUSE_TEXT's twelve death-note closures converted to plain string templates with {foe} as the only live token (combat only); a companion CAUSE_TEXT_TOKENS map records per-cause token names as explicit data, satisfying the plan's 'record the token names as data' instruction literally rather than leaving it implicit."
  - "Flat/non-random dice-notation values (e.g. Thief's baseWP, Herman's dmg:()=>25) use {n:0,sides:0,bonus:X} rather than a separate shape, keeping rollDice(rng,{n,sides,bonus}) the single resolution path for every content value with no special-casing in the engine."

patterns-established:
  - "Pattern 1 (dice-closures -> plain notation) now exercised across all 19 content modules, not just the RNG primitives from 01-01 — content-is-pure-data guard is live, not vacuous."
  - "Non-serializable callback fields (CAUSE_TEXT) get the same id/token-data treatment as Pattern 3's store-effect descriptors will need later — string templates + explicit token-name data instead of closures."

requirements-completed: [ENG-03, ENG-02]

coverage:
  - id: D1
    description: "Every prototype rules table (classes, races, weapons, armors, kit, skills, bestiary, encounters, spells, MU chart, potions, foods, traps, afflictions, treasure, misc tables, flavor, epitaphs, names) exists as a pure-data module under content/, with a barrel index re-exporting all of it"
    requirement: "ENG-03"
    verification:
      - kind: unit
        ref: "test/determinism/content-is-pure-data.test.js#content/*.js exports contain no function-typed leaves (pure data only)"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#content/index.js exposes WEAPONS/CLASSES/RACES/BESTIARY/SPELLS"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every embedded dice/pick closure (~79 sites) is now dice-notation ({n,sides,bonus}) or flag+notation data (halve, times) the engine resolves via rollDice(), with values numerically identical to the prototype"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#WEAPONS: Axe/Bastard Sword/Dagger dice-notation matches the prototype's rolls"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#CLASSES.Fighter: baseWP is 50 + d8, gain[1] is d8 notation"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY: Bat/Rat sp.dmg is a flat 1, atk 2; Drake dmg is 2d10+4"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#TRAPS: Spike carries base d10 notation with a times:5 flag"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#SPELLS: Fireball is 2d10+4, Mangle is 2d20+15"
        status: pass
  - id: D3
    description: "Content-values test locks a dozen+ known rows/counts to the prototype (ARMORS length/Plate cost, RACE_D8 distinct-races/Human count, SPELLS count, ENC_TYPES count, POTIONS count, EPITAPHS.combat non-empty strings, CAUSE_TEXT strings not functions)"
    requirement: "ENG-03"
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js (14 tests total)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-07
status: complete
---

# Phase 1 Plan 2: Content Table Extraction & Dice-Closure Removal Summary

**19 pure-data content modules under content/ (barrel-exported via content/index.js) reproduce every prototype rules table with all ~79 embedded RNG dice-closures converted to plain {n,sides,bonus} dice-notation, making ENG-02 and ENG-03's shared refactor pass mechanically complete and test-locked.**

## Performance

- **Duration:** 6 min (per commit timestamps 22:20:29 → 22:25:56)
- **Started:** 2026-09-07T22:20:29-04:00 (first task commit)
- **Completed:** 2026-09-07T22:25:56-04:00 (last task commit)
- **Tasks:** 3 completed
- **Files modified:** 21 created (19 content modules + content/index.js barrel + test/unit/content-tables.test.js)

## Accomplishments
- Extracted every prototype rules table (mazeworld.html lines ~493-1163) into 19 standalone pure-data ES modules under `content/`, with a `content/index.js` barrel re-exporting all symbols for single-import engine consumption.
- Converted all ~79 embedded dice/pick RNG closures (`d:()=>D(6)`, `baseWP:()=>50+D(8)`, `sp.dmg:()=>2*D(10)+4`, `uses:()=>D(8)`, `loss:()=>2*D(6)`, `dmg:()=>D(10)*5`, etc.) into plain `{n,sides,bonus}` dice-notation the engine resolves via the existing `rollDice()` — the same refactor pass that satisfies both ENG-02 (no RNG in content) and ENG-03 (content as pure data).
- Preserved special non-dice transforms as sibling data flags rather than baking them into the notation: Dagger/Whip's `Math.ceil(D(6)/2)` became `dice:{n:1,sides:6,bonus:0}, halve:true`; the Spike trap's `D(10)*5` became `dmg:{n:1,sides:10,bonus:0}, times:5`.
- Converted the twelve `CAUSE_TEXT` death-note closures (including the one parameterized `combat: f => \`cut down by a ${f}\``) into plain `{token}` string templates plus a `CAUSE_TEXT_TOKENS` data map recording which placeholder names each cause needs.
- Wrote `test/unit/content-tables.test.js` (14 tests) locking the extracted tables to the prototype's exact numbers: ARMORS length/Plate cost, RACE_D8 distinct-race count/Human frequency, SPELLS count, ENC_TYPES count, POTIONS count, weapon/class/bestiary/trap/spell dice-notation spot checks, and CAUSE_TEXT type checks.
- The `content-is-pure-data` static guard (built vacuously green in 01-01) is now live and exercises real data across all 19 modules — confirmed green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Character & equipment tables — classes, races, weapons, armors, kit, skills, MU chart** - `a4063d2` (feat)
2. **Task 2: Creatures, encounters, spells, consumables & hazard tables** - `21f7f87` (feat)
3. **Task 3: Flavor/voice tables + barrel index + content values test** - `191c50a` (feat)

**Plan metadata:** committed via `docs(01-02): complete plan` (see final_commit step)

## Files Created/Modified
- `content/classes.js` - CLASSES with baseWP `{base,dice}` and dice-notation gain arrays
- `content/races.js` - RACES, RACE_D8 (verbatim)
- `content/weapons.js` - WEAPONS dice-notation, halve flag for Dagger/Whip, WEAPON_MAX, WEAPON_TYPE_TABLE
- `content/armors.js` - ARMORS, MAGIC_ARMOR_TABLE (verbatim)
- `content/kit.js` - KIT, FREE_SKILL (verbatim)
- `content/skills.js` - FIGHTER_SKILLS, THIEF_SKILLS (verbatim)
- `content/mu-chart.js` - MU_CHART (verbatim)
- `content/bestiary.js` - BESTIARY (creature sp.dmg dice-notation), ENC_TYPES, ENC_ALIAS
- `content/encounters.js` - ENCOUNTER_TABLES (8x10, order preserved)
- `content/spells.js` - SPELLS (32 entries) with dmg dice-notation
- `content/potions.js` - POTIONS uses dice-notation
- `content/foods.js` - FOODS (verbatim)
- `content/traps.js` - TRAPS with dmg dice-notation, Spike's times:5 flag
- `content/afflictions.js` - AFFLICTIONS with loss dice-notation
- `content/treasure-tables.js` - JEWELRY, CLOAKS, STAVES, BLADE_NAMES, FAERIE, MISC_MAGIC (verbatim)
- `content/misc-tables.js` - STRIKE_DICE, THRESHOLDS, ROMAN, WEAPON_BONUS_TABLE, SPELL_LEVEL_TABLE, CLIMB_TABLE, LEAP_TABLE, DIRECTION_TABLE, INSANITY
- `content/flavor.js` - TEMPERAMENTS, MOTIVES, PHOBIAS, RACE_NOTE, CLASS_NOTE, SUB_NOTE (verbatim)
- `content/epitaphs.js` - EPITAPHS (verbatim) + CAUSE_TEXT/CAUSE_TEXT_TOKENS (converted from closures to string data)
- `content/names.js` - NAMES (verbatim)
- `content/index.js` - barrel re-exporting every content module
- `test/unit/content-tables.test.js` - 14 spot-value assertions locking tables to the prototype

## Decisions Made
- SPELLS is 32 entries in the actual prototype (not the plan's illustrative "31") — used ground truth from a direct read of `mazeworld.html` lines 831-864 and documented the discrepancy rather than silently matching an incorrect example number.
- WEAPON_BONUS_TABLE placed in `content/misc-tables.js` per the plan's authoritative `<artifacts>` file mapping, resolving an ambiguity where Task 1's prose loosely implied it belonged in `weapons.js`.
- CAUSE_TEXT's parameterized `combat` template keeps a single `{foe}` token (matching the prototype's one interpolated call site); all eleven parameterless causes became fixed strings with no tokens — a companion `CAUSE_TEXT_TOKENS` map records this per-cause token list as explicit data, per the plan's "record the token names as data" instruction.
- All flat/non-random content values (Thief's `baseWP` of exactly 40, Herman's fixed 25 damage) use the same `{n:0,sides:0,bonus:X}` dice-notation shape rather than inventing a separate "flat value" field — keeps `rollDice()` the single, uniform resolution path with zero special-casing.

## Deviations from Plan

None - plan executed as written; the SPELLS-length and WEAPON_BONUS_TABLE-placement discrepancies above are documentation corrections (ground truth vs. the plan's illustrative examples), not scope changes, deferrals, or architectural deviations requiring a Rule 1-4 classification.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 19 content modules + `content/index.js` are ready for 01-03 onward (RNG threading through movement/combat/economy/chargen/death) to consume via a single `import ... from "../content/index.js"`.
- Every dice value the engine will need to roll is already in `{n,sides,bonus}` (plus `halve`/`times` flags where applicable) — no further content-side conversion work remains before the RNG-threading and `applyAction` slices begin.
- `content-is-pure-data` and `rng-no-math-random` static guards both remain green and now exercise real content — any future accidental closure reintroduction will be caught immediately.
- No blockers for 01-03.

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 21 claimed files found on disk; all 3 claimed commit hashes (`a4063d2`, `21f7f87`, `191c50a`) found in git log. Full `node --test` suite: 26/26 passing (14 new content-tables tests + 12 from 01-01).
