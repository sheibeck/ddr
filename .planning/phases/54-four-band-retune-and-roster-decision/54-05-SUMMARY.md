---
phase: 54-four-band-retune-and-roster-decision
plan: 05
subsystem: difficulty-model
tags: [difficulty-model, global-dials, foe-level-from-depth, whole-hit-scale, round-damage-ceiling, hero-hp-regen, one-and-done-climb, parity-declared, user-ruling-d]

# Dependency graph
requires:
  - phase: 54-four-band-retune-and-roster-decision
    plan: 04
    provides: "the fair bot, the three-class/pace/identity readout blocks, and the fresh BEFORE (untouched engine) this plan's identity commit is measured against"
provides:
  - "engine/difficulty.js — DIALS (frozen, 28 dials), setDialsForTuning (harness-only), difficultyCurve (12-key global shape), foeLevelFor, FOE_COUNT_TABLE, foeCountFor, foeWpFor, foeHitFor, roundDamageCapFor, heroMeanMaxWpFor, heroMaxWpFor, heroRegenFor, heroSpFor, campHealFor, dotHpFor, startingRationsFor, tierSpreadFor — every floor-range knot/ramp constant and helper from Phases 21/27/54's knot ladder retired"
  - "engine/combat.js/character.js/movement.js/encounters.js rewired through the pure helpers; dmgBonus retired; ONE-AND-DONE climb/leap (a failed roll still hurts but crosses); engine/events.js#floorRegen; narrationLines.js/eventNarration.js/rail.js in-voice lines + rail card for draggedOver/floorRegen"
  - "every non-parity test re-pinned from measured output against the identity-commit engine (difficulty, combat-scaling, movement, encounters, foe-turn-draw-count, foe-abilities determinism, plus the out-of-scope-but-legitimately-affected files: floor-gen-rng-pin, maze, foe-abilities unit, foe-cadence, phobia-triggers, tools, bot-tactics, tuning-bot, combat.test.js)"
  - "the identity-commit's measured moved set (2 level-cap + 1 dot-hp cause) declared and regenerated on their fixtures; a new USER RULING D guard in divergence-records.test.js; FIXTURE-INVENTORY.md's Phase 54 identity-commit section; tools/initiative-fixture-scan-output.txt re-committed"
  - "docs/DIFFICULTY-RETUNE.md's #### Identity commit section — the remove list as landed, the identity column, what moved and why, the 25-row curve table, the full re-pin ledger"
affects: [54-06, 54-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "every difficulty dial is ONE number or { base, perDepth } — a smooth slope over depth, never a floor-range knot; difficultyCurve(depth) evaluates all of them in one pure, draw-free lookup"
    - "setDialsForTuning(overrides) is the harness-only entry point 54-06/54-07's fit tool reads — deep-merges a partial DIALS shape into a new frozen live copy, throws on an unknown key, returns a restore() closure"
    - "foe-side power keys to DEPTH (foeLevelFor, FOE_HIT_SCALE, FOE_HP_SCALE); hero-side power keys to the hero's LEVEL (HERO_HP_SCALE, HERO_SP_SCALE, HERO_REGEN_PER_FLOOR) — the governing principle from USER RULING D"
    - "ROUND_DAMAGE_CEILING is a per-foe, per-visit damage budget (dealtThisVisit, reset per foe, shared across hero+member targets and every swing including frenzy/sp.atk) — a structural no-op (Infinity) at identity"
    - "one-and-done: a failed climb/leap consumes the feature and crosses the hero to the far side either way — the retry loop that used to leave the feature in place on a failed roll is gone; a fatal fall still dies in place, no move"

key-files:
  created:
    - test/unit/one-and-done-lines.test.js
  modified:
    - engine/difficulty.js
    - engine/combat.js
    - engine/character.js
    - engine/movement.js
    - engine/encounters.js
    - engine/events.js
    - src/browser/narrationLines.js
    - src/browser/eventNarration.js
    - src/browser/rail.js
    - test/difficulty/difficulty.test.js
    - test/difficulty/fairness.test.js
    - test/unit/combat-scaling.test.js
    - test/unit/movement.test.js
    - test/unit/encounters.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/narrationLinesCoverage.test.js
    - test/unit/formatEventsCoverage.test.js
    - test/determinism/foe-abilities.test.js
    - test/unit/combat.test.js
    - test/unit/maze.test.js
    - test/unit/floor-gen-rng-pin.test.js
    - test/unit/foe-abilities.test.js
    - test/unit/foe-cadence.test.js
    - test/unit/phobia-triggers.test.js
    - test/unit/tools.test.js
    - test/unit/tuning-bot.test.js
    - test/unit/bot-tactics.test.js
    - test/parity/fixtures/action-script.combat.json
    - test/parity/fixtures/action-script.encounters.json
    - test/parity/divergence-records.test.js
    - test/parity/economy-parity.test.js
    - test/parity/full-suite.test.js
    - test/parity/fixture-inventory.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - tools/initiative-fixture-scan-output.txt
    - tools/damage-curve-audit.mjs
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "dmgBonus is fully retired (not deprecated in place) — foeHitFor scales the WHOLE hit (foeLevelBase + dice, crit included) at all three damage sites, replacing the retired flat lvl^2-only bonus that left the dominant dice terms (Werebeast 2xd10, Dante x3, Drake 2d10+4) untouched and let the old knot ladder saturate"
  - "ROUND_DAMAGE_CEILING's budget (dealtThisVisit) is declared once per foe inside foeTurn's per-foe loop, shared across every swing that foe takes this visit (hero AND member targets), reset fresh for the next foe — pursuitStrike gets its own fresh budget since it's a single strike outside foeTurn's loop"
  - "tools/damage-curve-audit.mjs's retired foeDmgBonusFor caller is stubbed at identity (0, matching FOE_HIT_SCALE's own identity) rather than reworked against the new model — the tool's whole per-monster-trim logic is superseded by ROUND_DAMAGE_CEILING and is 54-06/54-07's to rewire, not this plan's"
  - "economy-parity.test.js and full-suite.test.js's encounters-scenario loops gained the same actionPathDivergenceOf/skipsByteDiffAt/declaredEndDiffs support combat-parity.test.js's scenario loop already had — a test-infrastructure addition (not an engine change), needed because no encounters scenario had ever declared an action-path record before this plan and the tablefour dot-hp mover needed one"
  - "the tier-forcing pattern in test/determinism/foe-abilities.test.js and test/unit/foe-abilities.test.js moved from `c.level = floor.depth = tier` to `floor.depth = firstDepthOfTier(tier)` (scanning foeLevelFor live) — foe level keys to depth now, never the hero's level, so tier-forcing a fight means forcing the DEPTH, not the character's level"
  - "one-and-done retires the possibility of a same-tile climb/leap retry entirely (the feature is consumed on both outcomes) — two phobia-trigger tests whose premise was 'retry the same tile' were rewritten: one as a direct noteHeightsAttempt debounce unit test (the underlying contract still exists, just unreachable via move() now), one as a two-DIFFERENT-tiles scenario (the realistic post-one-and-done equivalent)"
  - "test/unit/tuning-bot.test.js and test/unit/bot-tactics.test.js's bot-survivability seed sets were re-measured and swapped where a seed now genuinely never resolves (re-measured live up to 20,000-30,000 actions, confirmed not a routing bug) — an expected consequence of landing at RAW identity strength before 54-06/54-07's fit softens it, not a regression"

requirements-completed: [BAND-02]

coverage:
  - id: D1
    description: "The global difficulty model (28-dial frozen DIALS object + setDialsForTuning) replaces every floor-range knot/ramp constant and helper; difficultyCurve returns the 12-key global shape, draw-free"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js (24/24 pass) — export-key-set pin, no floor-range name regex, DIALS frozen, identity column, curve pins 1..25/35/50, foeLevelFor map, storeTier/darkBlobs maps, FOE_COUNT_TABLE canon shape, heroMeanMaxWpFor pins, roundDamageCapFor, setDialsForTuning throw/restore, identity fast paths, harness-only grep"
        status: pass
      - kind: other
        ref: "node -e prints badKeys [], map 1111222223333344444555555, c1 (12-key floor-1 identity object), frozen true function, mean 41.67 46.17 50.00 54.50 60.00"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every consumer (combat.js/character.js/movement.js/encounters.js) rewired through the pure helpers — foe level from depth, whole-hit FOE_HIT_SCALE at 3 sites, count table with canon draw shape and no level-keyed cap, ROUND_DAMAGE_CEILING per-visit budget, hero HP/regen/SP/camp/dot/food helpers"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "test/unit/combat-scaling.test.js (17/17), test/unit/movement.test.js (77/77), test/unit/encounters.test.js (32/32)"
        status: pass
      - kind: other
        ref: "grep -c \"Math.min(c.level, state.floor.depth)\" engine/combat.js = 0; grep -c \"c.level <= 2 ? 2 : 3\" = 0; grep -c \"foeHitFor(\" = 3; grep -c \"roundDamageCapFor(\" = 3; grep -c \"foeCountFor(rng.d(4), () => rng.d(4))\" = 1; grep -c \"heroMaxWpFor(\" engine/character.js = 2; grep -c \"campHealFor(c.maxWP, rng.d(10))\" engine/movement.js = 1; grep -c \"dotHpFor(\" engine/encounters.js = 4"
        status: pass
    human_judgment: false
  - id: D3
    description: "Walls/crevices are ONE AND DONE — a failed roll still hurts but crosses the hero to the far side, feature consumed either way; draggedOver/floorRegen events in voice on both the Oracle and the rail"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "test/unit/one-and-done-lines.test.js (4/4 pass) — real engine replay proves [fellClimbing|fellInGorge, draggedOver, moved] event order for both feats; test/unit/movement.test.js's rewritten climb/gorge tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "The identity-commit's measured moved set (2 level-cap causes on combat.json, 1 dot-hp cause on encounters.json) is declared, regenerated, and guarded; every other test the engine change legitimately touched is re-pinned from measured output; the full suite is green"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "node --test (3427/3427 pass, fail 0); node --test test/parity/*.test.js (43/43 pass); test/parity/divergence-records.test.js's BAND-02 (USER RULING D) guard"
        status: pass
      - kind: other
        ref: "master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0 unchanged at every commit; git diff --stat 78a4a15 -- content/ tools/lib/tuning-bot.mjs test/parity/harness/comparables.js test/parity/prototype-master.js.txt empty; npm run build:www exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~4h
completed: 2026-09-21
status: complete
---

# Phase 54 Plan 05: The Global Difficulty Model at Identity (USER RULING D) Summary

**Replaced the entire five-rung floor-range knot ladder with a single frozen 28-dial `DIALS` object (every dial ONE number or `{ base, perDepth }`), landed every dial at its identity value, wired foe level to DEPTH (never the hero's level) and every damage/heal/regen/dot path through the new pure helpers, folded in the one-and-done climb/leap bug fix, re-pinned every affected test from measured output, and declared + regenerated the identity commit's 3-site measured moved set (2 level-cap, 1 dot-hp).**

## Success criteria → proof

| # | Success criterion | Proof |
|---|---|---|
| SC1 (remove list) | Every floor-range constant/helper gone; export-key-set pin | `test/difficulty/difficulty.test.js`'s "USER RULING D: the module's export key set contains no floor-range name" test; `docs/DIFFICULTY-RETUNE.md`'s remove-list table (every name from the objective present, grep-verified) |
| SC2 (identity column) | Every dial at identity (or starting/mean-matched) value; 12-key curve shape, draw-free | `node -e` prints `badKeys []`, the 25-char `foeLevelFor` map, the 12-key floor-1 curve object, `frozen true function`, the 5 mean-maxWP pins |
| SC3 (foe-side wiring) | Foe level from depth, whole-hit scale, count table (canon shape, no level cap), round-damage ceiling | `test/unit/combat-scaling.test.js` (17/17); the acceptance-criteria greps (all pass except the `return events;` count, see Deviations) |
| SC4 (hero-side + one-and-done) | Hero HP/regen/SP/camp/dot/food helpers wired; climb/leap one-and-done with in-voice lines | `test/unit/movement.test.js` (77/77), `test/unit/encounters.test.js` (32/32), `test/unit/one-and-done-lines.test.js` (4/4) |
| SC5 (every test re-pinned; parity measured/declared/regenerated) | The identity-commit moved set measured, declared, regenerated, guarded, inventoried | `node --test` 3427/3427; `node --test test/parity/*.test.js` 43/43; `docs/DIFFICULTY-RETUNE.md`'s `#### Identity commit` section; `test/parity/FIXTURE-INVENTORY.md`'s Phase 54 section |
| SC6 (gates green, prohibited files untouched) | `npm test`/`build:www` green at every commit; master hash unchanged; `content/`/`comparables.js`/`tuning-bot.mjs` untouched | `git diff --stat 78a4a15 -- content/ tools/lib/tuning-bot.mjs test/parity/harness/comparables.js test/parity/prototype-master.js.txt` empty; `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` |

## Remove list (as landed)

Every constant/helper the objective named is retired: `COMBAT_SCALE_FROM_DEPTH`, `FOE_CAP_BASE/MAX/SOFT_K`, `FOE_POWER_BASE/MAX/SOFT_K`, `ABILITY_THREAT_BASE/MAX/SOFT_K`, `FOE_LVL_BIAS`, `FOE_GRACE_AT_1..4`, `HAZARD_FROM_DEPTH`, `HAZARD_SCALE_AT_START/3/4`, `WALL_*`/`BREAKAWAY_*`/`ENDGAME_*` (knot pairs + band boundaries), `ENCOUNTER_DOT_BASE/CAP/SOFT_K`, `DENSITY_CANON_THROUGH_DEPTH`, `DARK_HOLD_THROUGH_DEPTH`, `DARK_RADIUS_BASE`, `softCap`/`softCapFloat`/`bandLerp`/`knotFoePowerFor`/`knotHazardFor`/`knotAbilityThreatFor`/`foeDmgBonusFor`, combat.js's `Math.min(c.level, state.floor.depth)`, the level-keyed `cap = c.level <= 2 ? 2 : 3`, and the `dmgBonus` key at all 3 damage sites. Full table with what replaced each: `docs/DIFFICULTY-RETUNE.md`'s `#### Identity commit` section.

## Identity column (as landed)

28 dials on `DIALS`, every one identity except: `FOE_LEVEL` (no identity — the starting map `{ base: 0.6, perDepth: 0.2 }`), `CAMP_HEAL_FRACTION` (0.17, mean-matched), `DOT_HP_FRACTION` (`{ small: 0.24, mid: 0.36, large: 0.6 }`, mean-matched). 54-06's dials (`LOOT_SCALE`, `FOE_ACCURACY`, `DOT_MIX`, `WANDER_RATE`, `FLEE_NEED_MOD`, `PARLEY_NEED_MOD`, `STARTING_GOLD`, `STARTING_POTION_BONUS`, `CLASS_MITIGATION`) are present at identity, held — this plan wires no consumer for them. Full table with hook/identity-flag/note: `docs/DIFFICULTY-RETUNE.md`.

## What moved at identity

- **level-cap** (the retired level-keyed foe-count cap is gone; `FOE_COUNT_TABLE` row 0 can now roll a 3rd foe): `action-script.combat.json#lose-apprentice` (Bat/Rat, Shriek, Shriek), `action-script.combat.json#flee` (Viper, Shriek, Shriek)
- **dot-hp** (table-four's `+25 HP` row is now `dotHpFor("large", maxWP)`): `action-script.encounters.json#tablefour` (`c.wp`/`c.maxWP` 65 → 64)
- **camp-heal** / **one-and-done** / **foe-level**: measured EXPOSURE zero across all 31 replay sites (see `docs/DIFFICULTY-RETUNE.md`'s predictor table) — no fixture-visible movers from these three causes this commit.

## Re-pin ledger

Every file/test/old-value/new-value/source is tabulated in full in `docs/DIFFICULTY-RETUNE.md`'s `#### Identity commit` section (17 rows). Highlights: `test/difficulty/difficulty.test.js` and `test/unit/combat-scaling.test.js` fully rewritten (24 + 17 tests); `test/unit/foe-turn-draw-count.test.js`'s `FULL_FIGHTS`/`OPENER_DRAWS` seeds 17/127 gain a third Shriek; `test/determinism/foe-abilities.test.js`'s tier-forcing moved from hero-level to depth (`firstDepthOfTier`), every `FULL_FIGHT_PINS`/`PER_VISIT_PINS` re-measured at full canon strength; `test/unit/maze.test.js`/`test/unit/floor-gen-rng-pin.test.js` re-pinned for `ENCOUNTER_DOT_CAP`'s removal (depths 3-5 now read the uncapped `9+depth`).

## Parity — measured set (identity commit)

**Scan diff** (`tools/initiative-fixture-scan.mjs` re-run on the edited engine): `#lose-apprentice` row `divergence.phase` `31+51` → `31+51+54`, `maxRound` `7` → `15`; `#flee` row `divergence.phase` `none` → `54`, `firstDivergentAction` `never` → `0`; `#lose-apprentice`'s Record-values `fields.after (engine @end)` `{"wp":23,"sp":40,"gold":52,"kills":2,"rations":6}` → `{"wp":23,"sp":60,"gold":50,"kills":2,"rations":4}`.

**Suite totals:** `node --test test/parity/*.test.js` 43/43 pass, fail 0 (before the two records landed: 9 failures across `combat-parity.test.js` ×2, `encounters` via `full-suite.test.js`, `divergence-records.test.js`, `fixture-inventory.test.js` ×2).

**The guard's `EXPECTED`** (in `test/parity/divergence-records.test.js`'s `BAND-02 (USER RULING D)` test): `["action-script.combat.json#flee", "action-script.combat.json#lose-apprentice", "action-script.encounters.json#tablefour"]` — also pins `difficultyCurve(1)` to the identity column and proves the count roll's canon draw shape at every `FOE_COUNT_SKEW` row (0..4).

**The inventory** (`test/parity/FIXTURE-INVENTORY.md`'s `## Phase 54: the global difficulty model` section): the rule, a 31-row predictor table, the live scan, the moved-set table, draw-count pins, and byte-identical-elsewhere accounting.

## New events and lines

- `floorRegen(amount)` — `engine/events.js`; hero-only, floor-arrival tick; identity (`HERO_REGEN_PER_FLOOR` 0) never fires. `LINE_FOR.floorRegen` / `EVENT_NARRATION.floorRegen` in voice ("A new floor, and the dungeon lets you keep +N hp of it. Do not mistake this for kindness."); no rail card (toast-only, minor event).
- `draggedOver { feat }` — pushed inline in `engine/movement.js`'s climb/gorge block on a survived failure. `LINE_FOR.draggedOver` / `EVENT_NARRATION.draggedOver` in voice, chosen by `feat` (climb vs gorge); `RAIL_FAMILY.draggedOver` (`OVER, BARELY`, tone `bad` — no `warn` tone exists in this codebase's vocabulary, so `bad` was used, matching `fellClimbing`/`fellInGorge`'s own tone); `RAIL_FEATURE_ICON` exception mirroring `toolUsed`'s own feat-keyed icon lookup.
- BANNED-scan test: `test/unit/one-and-done-lines.test.js` (both lines, both feats, clean; a real engine replay proves the event order).

## Gates

`npm test` 3427/3427 pass, fail 0 at the final commit (intermediate: 3272/3272 minus 9 parity failures right after the engine edit landed, before Task 2's declarations — exactly as the plan's ground rules anticipated: "Tasks 1 and 2 may land as ONE commit; the parity suite is red between the engine edit and the declared records"). `npm run build:www` exit 0 at every commit. Master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged throughout. `git diff --stat 78a4a15 -- content/ tools/lib/tuning-bot.mjs test/parity/harness/comparables.js test/parity/prototype-master.js.txt` empty at every commit.

## Schema

No new persisted state key. `HERO_HP_SCALE` touches `c.maxWP`/`c.wp` at chargen (`rollCharacter`) and level-up (`checkLevel`) only — both pre-existing fields. `HERO_REGEN_PER_FLOOR` touches `c.wp` at floor arrival only (`descend`, the one arrival path, runs once per floor by construction — no "regen applied" marker needed; a loaded save resumes on its current floor owing no regen). `startingRationsFor` touches `c.rations` at chargen only. The maze grid stays 21×21 (MAZE_SIZE cut). Old saves tolerant-load: canon HP formulas at identity (`heroMaxWpFor`/`campHealFor`/`dotHpFor` are all identity or mean-matched, never structurally different), no new keys required.

## Commits

| Commit | Type | Subject |
|---|---|---|
| `3226c20` | feat | the global difficulty model at identity (USER RULING D) — DIALS + setDialsForTuning; floor-range knots/ramps removed; foe level from depth, whole-hit FOE_HIT_SCALE, FOE_HP_SCALE, count table (canon draw shape, level cap gone), ROUND_DAMAGE_CEILING (off), hero helpers, ENCOUNTER_DOTS/HAZARD_SCALE/ABILITY_THREAT/DARK/STORE_TIER as globals; ONE-AND-DONE climbs/leaps + lines; every pin re-measured; identity movers declared + regenerated (MOVED SET (3)) |
| `419946f` | docs | ledger — identity commit (remove list as landed, identity column, what moved at identity, curve table 1..25, re-pin ledger) (USER RULING D, BAND-02) |

Full SHAs: `3226c20e6f48d0283eb837a3a9e4dcd2b31d0bfd`, `419946f` (see `git log` for the full 40-hex).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tools/damage-curve-audit.mjs` imported the retired `foeDmgBonusFor`**
- **Found during:** Task 1 (grep sweep for removed-name survivors)
- **Issue:** This tool (out of this plan's declared `files_modified`, but a direct consumer of the removed export) would throw `Cannot find module export` the instant anyone ran it, since `foeDmgBonusFor` no longer exists.
- **Fix:** Stubbed `dmgBonusForBand` at identity (0, matching the new `FOE_HIT_SCALE` identity — no bonus term at identity either way), with a module-header comment naming the successor model and flagging 54-06/54-07 as the rewire owner. Preserved the function's `null`-for-tier-unreachable contract so every existing caller's null-check still holds.
- **Files modified:** `tools/damage-curve-audit.mjs`
- **Verification:** the file imports cleanly; no test exercises this tool directly (not `node --test`-picked-up), confirmed by grep.
- **Committed in:** `3226c20` (Task 1+2 commit)

**2. [Rule 1 - Bug] Several out-of-scope test files broke from the legitimate engine change and needed re-pinning**
- **Found during:** Task 1 (full suite run after the engine edit)
- **Issue:** `test/difficulty/fairness.test.js` (`ENCOUNTER_DOT_CAP` import gone), `test/unit/combat.test.js` (`FOE_CAP_MAX` import gone), `test/unit/maze.test.js`/`test/unit/floor-gen-rng-pin.test.js` (dot-count formula changed at depths 3-5), `test/unit/foe-abilities.test.js`/`test/unit/foe-cadence.test.js` (tier-forcing via hero level no longer reaches the intended tier), `test/unit/phobia-triggers.test.js`/`test/unit/tools.test.js` (one-and-done retires the same-tile-retry premise), `test/unit/tuning-bot.test.js`/`test/unit/bot-tactics.test.js` (some forced-cell bot seeds now genuinely never resolve at raw identity strength).
- **Fix:** Every one re-pinned/re-measured from live output against the landed engine (never hand-computed); two phobia-trigger tests were restructured (a direct-call debounce unit test + a two-different-tiles scenario) since their premise became structurally unreachable under one-and-done; two bot-survivability tests had their seed sets re-measured and swapped where a seed no longer resolves within a bounded action budget (confirmed via up-to-30,000-action replays that this is genuine "the identity model is harsh pre-fit," not a routing bug).
- **Files modified:** listed in `key-files.modified` above.
- **Verification:** `node --test` 3427/3427 pass, fail 0.
- **Committed in:** `3226c20` (Task 1+2 commit)

**3. [Rule 2 - Missing critical] `economy-parity.test.js`/`full-suite.test.js`'s encounters loops had no action-path divergence support**
- **Found during:** Task 2 (declaring the `tablefour` dot-hp mover)
- **Issue:** No encounters scenario had ever needed to declare an `action-path` divergence before this plan; the two test files' encounters-scenario replay loops had no `actionPathDivergenceOf`/`skipsByteDiffAt`/`declaredEndDiffs` wiring at all (unlike `combat-parity.test.js`'s scenario loop, which already had it) — without this, `tablefour`'s legitimate one-field divergence could never be declared, only worked around by picking a different seed (which the engine gate's "everything that moves is declared" principle explicitly rejects as the right move).
- **Fix:** Added the identical `actionPathDivergenceOf`/`skipsByteDiffAt`/`declaredEndDiffs` support `combat-parity.test.js`'s loop already has, to both files' encounters loops.
- **Files modified:** `test/parity/economy-parity.test.js`, `test/parity/full-suite.test.js`
- **Verification:** `node --test test/parity/*.test.js` 43/43 pass.
- **Committed in:** `3226c20` (Task 1+2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug-class re-pin sweep, 1 missing-critical infrastructure addition).
**Impact on plan:** All three were necessary consequences of the engine change this plan's own objective mandated ("everything that moves is declared"), not scope creep — no dial value, roster, or gameplay behavior was invented beyond what the plan specified.

## Issues Encountered

**The `return events;` grep-count acceptance criterion (`engine/movement.js`) reads 25, not the plan's expected 24 ("one fewer than PRE_MODEL").** The one-and-done restructure moves the fatal-fall `return events;` from an unconditional statement at the end of the `if (!ok)` block to a conditional one nested inside `if (state.c.wp <= 0) { die(...); return events; }` — textually still exactly one `return events;` occurrence in that hunk (unchanged from before), because the "early return for a survived failure" that the plan's phrasing implies was removed was never itself a SEPARATE `return events;` statement — it was the SAME unconditional one the fatal case also used. The actual required behavior (fatal fall dies in place with no move; a survived failure crosses) is fully implemented and tested (`test/unit/one-and-done-lines.test.js`, `test/unit/movement.test.js`'s rewritten climb/gorge tests, `test/unit/tools.test.js`'s rewritten pendingHazard test) — this is a diagnostic-heuristic mismatch, not a functional gap. Documented here per the plan's own ground rule ("A test failure NOT explained by a change in this plan's objective is a STOP... do not paper over").

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Commit `3226c20`** (engine + tests) and `419946f` (ledger) are the identity commit every later Phase 54 number compares against. 54-06 wires the remaining held-at-identity dials (`LOOT_SCALE`'s consumer, `STORE_TIER`'s economy consumer, `CLASS_MITIGATION`, `FOE_ACCURACY`, `DOT_MIX`, `WANDER_RATE`, `FLEE_NEED_MOD`/`PARLEY_NEED_MOD`, `STARTING_GOLD`/`STARTING_POTION_BONUS`) plus the fit tool (`tools/fit-difficulty.mjs`), coordinate-searching the CORE 10 dials this plan already exposed through `setDialsForTuning`.
- `setDialsForTuning` is confirmed harness-only (pinned by grep across `src/`, `mazeworld.html`, every other engine module) — 54-06/54-07's fit tool is the intended (and only sanctioned) caller.
- The dial table in `docs/DIFFICULTY-RETUNE.md`'s `#### Global model (USER RULING D) — the dial table` (landed in 54-04) is what this plan's `DIALS` object implements verbatim — 54-06/54-07 read the SAME table for the held dials and the fit's search bounds/order.
- The roster note (tier 5 reachable only from floor 20 under the starting `FOE_LEVEL` map) is unchanged from 54-04's recording — a v1.8 content candidate, not this phase's work.
- No blockers. `npm test` 3427/3427, `npm run build:www` green, master hash and every prohibited file untouched across both commits.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. **A failed climb or crevice leap now lands you on the far side, hurt, with a new line** ("Over, eventually. The wall took its cut on the way." / "Across, technically. The crevice kept your dignity as a toll.") instead of leaving you stuck retrying the same wall — check this feels right, not like a bug (you take damage but keep moving forward).
2. **A new floor shows no regen line yet** (`HERO_REGEN_PER_FLOOR` is identity/0 this plan) — nothing to look at here until 54-06/54-07 potentially release this dial.
3. **Traps, table-four dots, and combat on floor 1 feel unchanged** — floor 1 is byte-identical to before this plan by design; the actual difficulty-curve FEEL change (foes hitting/holding harder or softer with depth) is what 54-06/54-07's fit will actually move, at floor 2+.
4. **Table-four's ±HP dots (and camp heals) now scale with your OWN max HP** rather than being a flat number — a level-5 hero's dots/heals should read noticeably bigger than a level-1 hero's; worth a glance if a Hero-tab/Oracle line reads oddly at a higher level.

## Self-Check: PASSED

- FOUND: engine/difficulty.js
- FOUND: engine/combat.js
- FOUND: engine/character.js
- FOUND: engine/movement.js
- FOUND: engine/encounters.js
- FOUND: engine/events.js
- FOUND: src/browser/narrationLines.js
- FOUND: src/browser/eventNarration.js
- FOUND: src/browser/rail.js
- FOUND: test/unit/one-and-done-lines.test.js
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: docs/DIFFICULTY-RETUNE.md
- FOUND commit: 3226c20 (Task 1+2)
- FOUND commit: 419946f (Task 3, docs)
