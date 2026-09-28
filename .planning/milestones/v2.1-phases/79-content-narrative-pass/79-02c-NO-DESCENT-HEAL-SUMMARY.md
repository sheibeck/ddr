---
phase: 79-content-narrative-pass
plan: 02c
status: complete
subsystem: engine movement (descend) and the difficulty dials
tags: [descend, heal, dials, fit-tooling, user-ruling-2026-09-27]
requires: [79-02, 79-02b, 79-05]
provides:
  - "engine/movement.js#descend: arriving on a new floor restores no hp (only a level-up on the stairs adds its own gain)"
  - "engine/difficulty.js#DIALS: no HERO_REGEN_PER_FLOOR; setDialsForTuning throws on a dial set that names it"
  - "tools/lib/fit-score.mjs#SEARCH_PLAN: nine coordinates (the regen coordinate is gone)"
  - "docs/narrative-pass/why/79-02c.json: ledger rows for the two removed floorRegen lines"
affects: [79.1, 79-13]
tech-stack:
  added: []
  patterns:
    - "greenfield removal: the rule, its dial, its event and its copy go together; no dial is left at 0"
key-files:
  created:
    - test/unit/no-descent-heal.test.js
    - docs/narrative-pass/why/79-02c.json
  modified:
    - engine/movement.js
    - engine/difficulty.js
    - engine/events.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - tools/lib/fit-score.mjs
    - tools/fit-difficulty.mjs
    - tools/lib/voice-corpus.mjs
    - docs/DIFFICULTY-RETUNE.md
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/roll-high-state-pins.test.js
    - test/unit/harness/identityDials.js
    - test/difficulty/difficulty.test.js
    - test/unit/fit-score.test.js
    - test/unit/movement.test.js
    - test/unit/honest-gains.test.js
    - test/unit/formatEventsCoverage.test.js
    - test/unit/narrationLinesCoverage.test.js
    - test/unit/trap-death-repro.test.js
    - .planning/phases/79.1-milestone-balance-check-deep-floor-tuning/79.1-CONTEXT.md
decisions:
  - "The per-floor regen is deleted, not set to 0: the dial, heroRegenFor, the descend block, the floorRegen event builder and EVENT_TYPES entry, and both narration lines"
  - "A dial set that still names HERO_REGEN_PER_FLOOR fails loudly. This is the tooling's existing convention: setDialsForTuning already throws on an unknown dial, and fit-difficulty.mjs passes every --start/--dials set through it"
  - "The DIALS-equals-fit-artifacts pin drops the one retired key from Phase 54's fit/best.json by name. The artifact is history and still records 0.25; any other unknown key still fails the pin"
  - "The level-up HP gain on the stairs is kept, per the ruling; it is reported below, not changed"
metrics:
  completed: 2026-09-27
  tasks: 1
  commits: 2
---

# Phase 79 Quick Fix 79-02c: No Descent Heal Summary

Going down a floor now heals nothing. The Phase 54 per-floor regen (0.25 × max hp on each arrival) is removed with its dial, its `floorRegen` event and its Oracle and rail lines. No dial is left that could turn it back on, and the fit tooling no longer searches it. Every other heal is unchanged.

**Base:** `089699296fb43f4fb8349f0364081c423308e91d`

## Commits

| Step | Commit |
|------|--------|
| Engine, tests, re-pins, inventory, ledger | de7c158f |
| DIFFICULTY-RETUNE note, 79.1 CONTEXT line, todo moved, SUMMARY | this commit |

The objective asked for two commits (engine and tests, then docs), so RED and GREEN share the first commit. RED was run before the engine edit: 5 of 6 rows in `no-descent-heal.test.js` failed at the base. The sixth row checks the descend SP bonus, which is meant to pass at the base.

## What was removed

- `engine/movement.js#descend`: the regen block. The import of `heroRegenFor` and `floorRegen` is gone. A comment records the ruling.
- `engine/difficulty.js`: the `HERO_REGEN_PER_FLOOR` dial (its doc comment and fitted value) and `heroRegenFor`.
- `engine/events.js`: `EVENT_TYPES.FLOOR_REGEN` and the `floorRegen` builder.
- `src/browser/eventNarration.js` and `src/browser/narrationLines.js`: only the `floorRegen` entries ("A new floor, and the dungeon lets you keep +N hp of it. Do not mistake this for kindness.").
- `tools/lib/fit-score.mjs#SEARCH_PLAN`: the regen coordinate. The core is now 9, and the header comment says why. `tools/fit-difficulty.mjs`'s header and `--help` now say "core 9".
- `tools/lib/voice-corpus.mjs`: `floorRegen` is out of 79-02's `OWNER_RULES` type list. `tools/lib/event-variants.mjs` never named it.
- Dial lists in tests: `test/unit/harness/identityDials.js`, `test/difficulty/difficulty.test.js` (the key list, the identity column, and two `heroRegenFor` rows), `test/unit/fit-score.test.js`, and the `KNOWN_INDIRECT_TYPES` lists in `formatEventsCoverage` and `narrationLinesCoverage`. It also left `GAIN_TYPES` in `trap-death-repro.test.js`.

**Unknown-dial convention.** `setDialsForTuning` throws `unknown dial "HERO_REGEN_PER_FLOOR"`. `fit-difficulty.mjs` passes every `--start`/`--dials` set through it, so an old start file or fit log that names the dial fails loudly. `no-descent-heal.test.js` and `movement.test.js` pin the throw.

## Tests

- **New: `test/unit/no-descent-heal.test.js`** runs at the shipped dials. It has 6 tests:
  - 20 depth/seed cases (seeds 7, 42, 606, 1234 at start depths 1, 2, 4, 7, 12). A wounded hero with SP 0 (so no level-up) arrives with the same hp, and no `floorRegen` event is emitted.
  - The level-up case, isolated. With enough SP to level on the stairs, hp afterwards equals hp before plus the `leveled` gain, and nothing else. At least 6 of the 12 cases really level.
  - The descend SP bonus still fires.
  - The dial, `heroRegenFor` and the event builder are gone.
  - A dial set that names the retired dial throws.
  - Tolerant load: a stray old `floorRegen` event renders nothing. `narrateEvent` returns `""`, `formatEvents` returns `[]`, and `linesForAction` skips it.
- **`movement.test.js`:** the old "0.25 override heals" test is replaced by "stepping onto the exit heals nothing", including the level-up gain and the unknown-dial throw.
- **`honest-gains.test.js`:** the `floorRegen` gain row now pins no hp back and no event. The rng cursor still matches the plan-base pin `-869104716`, because the regen never drew. The rail sample that used `floorRegen` now uses `rested`.
- **`difficulty.test.js`:** the pin that DIALS equals the identity column + Phase 54 `fit/best.json` + the 75.3 overlay now drops the retired key from `best.json` by name. It also asserts that the artifact still records 0.25, so the history is not edited.

## Old saves

Saves do not hold events or rendered text. `serializeRun` writes the run state, and no field in it keeps an event log. `beats` is reset to null on load. The Oracle log and the rail exist only in the page's memory, and the graveyard and bests keys store no events. So no save can carry a `floorRegen` event. A resumed run just continues on its floor, and there was never a "regen applied" marker to migrate. In case an old event object reaches a narration surface in-session, `no-descent-heal.test.js` pins that it is dropped quietly.

## Copy

- Only the two `floorRegen` narration lines promised a heal on the stairs. I grepped `content/`, `src/browser/` and `mazeworld.html` for stairs, descend, next floor, new floor, every floor, regen, catch your breath and heal. Nothing else promises it.
- THE STAIR DOWN overlay reads "Floor {n} is colder, longer, and considerably less forgiving. Nobody has asked you to do this." It promises nothing and is unchanged.
- `docs/DIFFICULTY-RETUNE.md` has a new dated section, "v2.1 per-floor regen removed (quick fix 79-02c, user ruling 2026-09-27)", after the Phase 78 section. The Phase 54 history above it is not rewritten.
- Not edited, as instructed: `docs/narrative-pass/corpus-base.json` and `tools/voice-sample-output.txt`. The historical mentions in `docs/UAT-v1.7.md`, `docs/narrative-pass/README.md` (79-02's scope list), the parity fixtures' Phase 54 rationale strings and FIXTURE-INVENTORY line 2388 are history and are left as written.

## Voice-pass ledgers

- **Before:** `--check-ledgers --after --coverage` found 115 errors across 5 ledgers. Two of them were `oracle:floorRegen` and `rail:floorRegen` ("changed between base and current with no ledger row"). That gap already existed: the live corpus rendered an extra `+3` variant.
- **After:** a new `docs/narrative-pass/why/79-02c.json` has two rows. Each has a base rendering as `before` and `""` as `after`. The validator accepts a deletion in that form: a real change, not both empty, and `--after` skips an empty after.
- The run then reports 113 errors across 6 ledgers, and neither floorRegen key is among them. The other 113 are not from this change: 79-03's identity-footer afters, identity-trait and `raw:` coverage gaps, and so on. The before and after outputs are otherwise the same.
- `node --test test/unit/voice-corpus.test.js`: 27 of 27 pass.

## Moved set

- **Fixture roster:** `node tools/fixture-inventory.mjs --json` is byte-identical before and after.
- **Parity:** 66 of 66. No carve-out existed for `floorRegen`, so none was removed. The one replay that descends (`action-script.movement.json`, action 12) does so at full hp, where the regen used to clamp to 0. The prototype master is unchanged (`a1f4d0dc…`).
- **State pins:** 7 of 8 moved, with the traced cause "per-floor heal removed (user ruling 2026-09-27)".
  - Method: I traced each label against an extracted base tree (`git archive 08969929`), with a scratch trace of every bot step's full state hash.
  - Each label's first divergence is its first descent that pushed `floorRegen` at the base, and every earlier step is identical:
    - solo-1: step 205, +18
    - solo-2: step 103, +9
    - solo-thief-pilfer: step 74, +4
    - solo-magicuser-sorcerer: step 85, +4
    - party-1: step 147, +7
    - party-fighter-knight: step 318, +17
    - deep-8: step 77, +15
  - actions, dead and depth are unchanged except deep-8, which goes from 250 to 262 actions and is still dead on floor 10.
  - deep-14 did not move: it dies on floor 14 before any descent.
  - Re-pinned with `node tools/roll-high-baseline.mjs pins`, which hashes each run twice.
- **Unchanged:** the pre-switch save (`roll-high-save-compat`: no healing descent in its replayed window), `foe-turn-draw-count`, `bot-tactics` and `test/determinism/**`.
- **Event-order corpus:** it records no `floorRegen` event and its test passes unchanged, so it was **not** regenerated.
- **Declared** in `test/parity/FIXTURE-INVENTORY.md`, in `### No descent heal (user ruling 2026-09-27)` appended at the end of the file under `## Phase 79`.

## For the user

- **One heal can still fire on a descent: the level-up gain.** The descend SP bonus can tip the hero over a level on the stairs, and that level's HP gain is added to current hp. The ruling kept this, and it is unchanged. How often it happens: across the 22 descents in the eight pin runs, 1 had a level-up on the same step (solo-1, +10). If it still feels like too much, that is the knob to look at.
- No other heal fires on every descent. `descend` also runs `checkLevel`, `genFloor`, `resetFloorPhobiaRegions` and `cutthroatMurderCheck`, and none of them restores hp.

## Handed on

- **79-13:** `tools/voice-sample-output.txt` still has a `▶ floorRegen` block (line 129). It is 79-13's regenerated artifact, so I did not edit it. Its next regeneration drops the block.
- **79.1:** the CONTEXT note now ends with "Implemented in 79-02c: the dial and the event are removed, so there is nothing to lock or search." If a 79.1 sweep reuses a Phase 54 start file or fit log that names `HERO_REGEN_PER_FLOOR`, `setDialsForTuning` will throw. The fix is to drop the key from that file.

## Deviations from Plan

1. **[Rule 3] `test/difficulty/difficulty.test.js`'s DIALS-equals-fit-artifacts pin.**
   - The pin merges Phase 54's `fit/best.json`, which still carries `HERO_REGEN_PER_FLOOR: 0.25`.
   - I did not edit the planning artifact, which is history. The pin now drops that one key by name and asserts its historical value.
2. **Commit shape.** RED and GREEN share the engine commit, as the objective asked (engine+tests, then docs/summary). RED was run and failed first (see Commits).
3. **`tools/fit-difficulty.mjs`** was not in the listed files. Its header and `--help` said "core 10", so I updated both to say "core 9". This is text only.

## Gates

- `npm test`: **7,412 tests, 7,412 pass, 0 fail.** That is the base's 7,406 plus 6 new rows. The replaced rows in `movement` and `honest-gains` are one for one.
- Parity (`node --test "test/parity/**/*.test.js"`): **66 of 66.**
- `npm run boot:check`: **PASS** (no-uncaught, painted, graves, title), after a local `npm run build:www`. `www/` is gitignored and not committed.
- A temporary `node_modules` junction to the main checkout was used and is removed before hand-off. Its target was not touched.
- No bot balance runs, per the user ruling.

## Known Stubs

None.

## Threat Flags

None. This change removes a rule. It adds no state field, no surface and no input path.

## TDD Gate Compliance

`no-descent-heal.test.js` was written and run first: 5 of 6 failed at the base. The engine edit followed and all 6 pass. Both live in the `fix(79-02c)` commit de7c158f, per the objective's two-commit shape, so there is no separate `test(...)` commit.

## Self-Check: PASSED

- `test/unit/no-descent-heal.test.js`, `docs/narrative-pass/why/79-02c.json`, this SUMMARY and the moved todo all exist.
- Commit de7c158f is on the branch and deletes no file.
