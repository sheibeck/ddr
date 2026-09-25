---
phase: 72-roll-direction-sign-audit-fixes
plan: 06
subsystem: engine (combat to-hit, magic thrown spells, bestiary content)
tags: [roll-01, sign-fix, combat, skeleton, shatter, bestiary, parity]

requires:
  - phase: 72-01
    provides: "docs/ROLL-LEDGER.md's known fix (c) and the `## Skeleton shatter scope` finding"
  - phase: 72-02
    provides: "test/unit/rollDirection.test.js's six pending [shatter:*] rows and test/unit/harness/rollOdds.js"
  - phase: 72-05
    provides: "test/parity/FIXTURE-INVENTORY.md's Phase 72 H2 and ROLL01_EXPECTED_HOLDERS in test/parity/divergence-records.test.js"
provides:
  - "engine/dice.js#isBestFace(roll, dieN): the best face of an N-sided die for the roller — today roll === 1"
  - "engine/combat.js#shatterIfBest(state, t, roll, dieN, by, rng, events, extra): a landed to-hit on its die's best face against a shatter-flagged foe destroys it outright, both lives, zero damage draws, exported"
  - "shatterIfBest wired into playerStrike, memberStrike, alliesTurn's legacy branch, allyTurn, allyCast, and engine/magic.js#castSpell's thrown branch"
  - "content/bestiary.js: the Skeleton's sp.shatterOnBest: true replaces its roll-under crit key; M&M's dead 'criticals on a 1' clause and critOn key are removed"
  - "the foeShattered event with EVENT_NARRATION (src/browser/eventNarration.js) and LINE_FOR (src/browser/narrationLines.js) entries"
  - "test/unit/skeleton-shatter.test.js: full behavioural coverage of the mechanic"
  - "test/unit/rollDirection.test.js's six [shatter:*] rows are green, todo removed"
  - "test/parity/FIXTURE-INVENTORY.md's Plan 06 section (measured zero) and test/parity/divergence-records.test.js's ROLL-01 (Phase 72) guard extended with part (c)"
affects: ["72-07", "Phase 73 (roll-high mirror)", "Phase 74 (display-sign)", "Phase 79 (roll-direction phrasing)"]

tech-stack:
  added: []
  patterns:
    - "shatterIfBest is called AFTER the to-hit has landed (post-miss-check) and BEFORE the caller's own damage roll, returning true to signal the caller must skip that damage roll and (where applicable) continue to the next target/loop iteration — the same insertion point at every one of the six call sites."
    - "A shatter routes through the existing killFoe by forcing t.lives = 1 immediately before the call, so a kill-twice foe's SECOND life is destroyed in the same call as the first — no new lives-handling branch."
    - "isBestFace(roll, dieN) intentionally takes dieN even though today's implementation ignores it (roll === 1 only) — Phase 73's roll-high mirror redefines it as roll === dieN, a one-line change with no call-site edits."

key-files:
  created:
    - test/unit/skeleton-shatter.test.js
  modified:
    - engine/dice.js
    - engine/combat.js
    - engine/magic.js
    - content/bestiary.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/rollDirection.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/divergence-records.test.js

key-decisions:
  - "shatterIfBest is a single shared helper (not duplicated per call site) taking `by` (the striker's display name, 'you' for the hero) and an optional `extra` object (used only by the two thrown-spell call sites for `{ spell: sp.n }`) — every call site differs only in how it obtains `roll`/`dieN` and what it does on a `true` return (continue vs return vs the allyTurn rounds-countdown structuring)."
  - "allyTurn's `if (roll <= 5) { ... }` block was restructured to wrap the ordinary-hit damage logic in `if (!shatterIfBest(...)) { ... }` rather than an early return, so the pre-existing `--C.ally.rounds` countdown below still runs unconditionally after a shatter, per the plan's explicit requirement."
  - "test/unit/skeleton-shatter.test.js's zero-extra-draws test compares two independent 'always return 1' rng runs — one through playerStrike's actual shatter path, one through a standalone killFoe call on an equivalently pre-shattered foe — and asserts the draw sequence AFTER the to-hit die matches exactly, proving no damage draw sneaks in between, without needing to hand-count killFoe's own variable draw total (XP roll, loot gate, treasure/bag draws, checkLevel)."
  - "The hero-thrown-spell foeShattered test captures the foe reference BEFORE calling castSpell, because castSpell's own tail (afterPlayerAction) ends combat and nulls state.combat once the Skeleton dies — reading s.combat.foes[0] afterward throws."

requirements-completed: [ROLL-01]

duration: ~1 session
completed: 2026-09-24
status: complete
---

# Phase 72 Plan 06: Skeleton shatter mechanic (ROLL-01 (c)) Summary

**Wired "rolling max on your dice triggers the shatter" as `engine/combat.js#shatterIfBest`, called from all six in-scope strikers (hero, member, legacy/summoned ally, hero/member thrown spells), destroying a shatter-flagged foe outright on its die's best face with zero extra draws; dropped M&M's dead "criticals on a 1" claim; measured and confirmed a zero-fixture parity footprint.**

## Performance

- **Duration:** ~1 session
- **Tasks:** 2 (Task 1: isBestFace/shatterIfBest/the six call sites/content edits/narration/tests; Task 2: measure and declare the parity footprint, extend the ROLL-01 guard)
- **Files modified:** 10 (8 in Task 1 — one new — plus 2 in Task 2)

## Accomplishments

- **`engine/dice.js#isBestFace(roll, dieN)`** — pure, no rng, returns `roll === 1` today; `dieN` is taken now so Phase 73's roll-high mirror (`roll === dieN`) is a one-line change.
- **`engine/combat.js#shatterIfBest(state, t, roll, dieN, by, rng, events, extra = {})`** — exported. Returns `false` unless the target is a live, `sp.shatterOnBest`-flagged foe AND the roll is the die's best face. On a shatter: pushes `{ type: "foeShattered", target, by, ...extra }`, forces `t.lives = 1` and `t.wp = 0`, calls `killFoe` (both lives go in the same call), returns `true`. Draws nothing beyond `killFoe`'s own.
- **Every in-scope call site wired**, each inserted after the to-hit landed and before the damage roll:
  - `playerStrike` — guarded by `!(c.sub === "Con Artist" && !C.opened2)` so the opening warning blow is excluded; sets `C.opened2 = true` and `continue`s on a shatter, `by: "you"`.
  - `memberStrike` — `by: ally.name`; `return`s on a shatter.
  - `alliesTurn`'s legacy (unclassed) branch — `by: ally.name`; `continue`s the outer `for` loop.
  - `allyTurn` (summoned ally) — `by: C.ally.name`; restructured so the pre-existing `--C.ally.rounds` countdown still runs unconditionally after a shatter.
  - `allyCast` (member thrown spell) — `by: ally.name`, `extra: { spell: sp.n }`; `return`s.
  - `engine/magic.js#castSpell`'s thrown branch (hero thrown spell) — imports `shatterIfBest` from `./combat.js`; `by: "you"`, `extra: { spell: sp.n }`; `continue`s to the next target.
- **`content/bestiary.js`**: the Skeleton's roll-under crit key is renamed to `sp.shatterOnBest: true` (note: "kill it twice; your best roll shatters it"); M&M's key is removed entirely and its note becomes "deaf" — both under a `DELIBERATE RULES CHANGE (Phase 72, ROLL-01 (c))` comment. `grep -rn "critOn" engine/ content/ src/` prints nothing.
- **Narration**: `EVENT_NARRATION.foeShattered` and `LINE_FOR.foeShattered` — both a family-friendly, deadpan house-voice line naming the striker and the target, safe on a bare `{ type }` payload (the coverage guards).
- **`test/unit/skeleton-shatter.test.js`** (new, 22 tests): `isBestFace`'s contract; every one of the six strikers shatters on exactly one face (`faceOdds`); the shattering face fires `foeShattered` then `foeKilled`, never `foeRevived`/`struck`; every other landing face damages normally; an ORDINARY killing blow still triggers `foeRevived` first (kill-twice intact); the Con Artist's opener never shatters and the strike after it can; a shatter draws zero weapon/spell-damage dice (draw-sequence comparison against a standalone `killFoe` call); a non-flagged foe (M&M) never emits `foeShattered`.
- **`test/unit/rollDirection.test.js`**: all six `[shatter:*]` rows are green, `todo` removed; header comments updated to reflect every known bug group is now landed (no `todo` rows remain in the file).
- **Task 2 — measured a zero moved parity set.** `test/parity/FIXTURE-INVENTORY.md`'s "Parity-exposed bestiary surface" is exactly Beasts lvl 1 / Humans lvl 1; no replay site ever dispatches a Vampire summon (the only path to a Skeleton), so the Skeleton/M&M edits are unreachable by all 31 replay sites — confirmed live: `node --test test/parity/*.test.js` 47/47, both fixture scans empty, `test/parity/fixture-inventory.test.js` 5/5 (roster unchanged), `git diff --stat` over fixtures/comparables/master empty, master hash unchanged.
- **The one determinism candidate re-checked live.** `test/determinism/foe-abilities.test.js`'s `walking-dead-t5` row DOES summon a Skeleton (the Vampire's `vampireSummon` ability) — the only place in the whole suite a Skeleton is reachable outside content itself. Re-run: **13/13 green, zero pins moved** — the pinned seed's summoned Skeleton is never struck on its best face within the fight's natural resolution or the 12-visit window.
- **`test/parity/divergence-records.test.js`**'s `ROLL-01 (Phase 72)` standing guard extended with part (c): zero `foeShattered` events across all 31 replay sites. `ROLL01_EXPECTED_HOLDERS` stays `[]`.

## Task Commits

1. **Task 1: isBestFace, shatterIfBest, the six call sites, the content edits and the narration** — `ed4d076` (fix) — `engine/dice.js`, `engine/combat.js`, `engine/magic.js`, `content/bestiary.js`, `src/browser/eventNarration.js`, `src/browser/narrationLines.js`, `test/unit/skeleton-shatter.test.js`, `test/unit/rollDirection.test.js`.
2. **Task 2: Measure and declare the shatter's parity footprint; extend the ROLL-01 guard** — `44c2b70` (docs) — `test/parity/FIXTURE-INVENTORY.md`, `test/parity/divergence-records.test.js`.

**Plan metadata:** this SUMMARY's own commit (docs: complete plan), made by the execution harness after this file is written.

## Files Created/Modified

- `engine/dice.js` — `isBestFace(roll, dieN)`.
- `engine/combat.js` — `shatterIfBest` export, its six call sites, the header comment's `sp.*` mechanical-flags list updated.
- `engine/magic.js` — imports and calls `shatterIfBest` in `castSpell`'s thrown branch.
- `content/bestiary.js` — the Skeleton's `sp.shatterOnBest: true`; M&M's `critOn` key and crit claim removed.
- `src/browser/eventNarration.js`, `src/browser/narrationLines.js` — `foeShattered` entries.
- `test/unit/skeleton-shatter.test.js` — new, 22 behavioural tests.
- `test/unit/rollDirection.test.js` — the six `[shatter:*]` rows' `todo` option removed; header comments updated.
- `test/parity/FIXTURE-INVENTORY.md` — new "### Plan 06" section under the Phase 72 H2.
- `test/parity/divergence-records.test.js` — the `ROLL-01 (Phase 72)` guard extended with part (c) (`foeShatteredCount`).

## Narration line text

- **Oracle log** (`src/browser/eventNarration.js`): `"Your best roll lands clean. {target} comes apart, both lives at once, and nobody is sweeping up."` (a party member's name substitutes for "Your" via `{by}'s`).
- **Rail card / toast** (`src/browser/narrationLines.js`, `LINE_FOR.foeShattered`): the same text, `tone: "hit"`, `priority: PRIORITY.feature`.

## Measured results (Task 2)

1. `node --test test/parity/*.test.js`: 47/47 pass.
2. `node tools/initiative-fixture-scan.mjs | diff --strip-trailing-cr - tools/initiative-fixture-scan-output.txt`: empty.
3. `node tools/worn-fixture-scan.mjs | diff --strip-trailing-cr - tools/worn-fixture-scan-output.txt`: empty.
4. `node --test test/parity/fixture-inventory.test.js`: 5/5 pass (roster unchanged).
5. `git diff --stat 904269c..HEAD -- test/parity/fixtures/ test/parity/harness/comparables.js test/parity/prototype-master.js.txt`: empty.
6. `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged).
7. `node --test test/determinism/foe-abilities.test.js`: 13/13 pass, zero pin edits (the `walking-dead-t5` Vampire-summon row was the one live candidate; re-measured, unmoved).
8. `node --test test/parity/divergence-records.test.js`: 9/9 pass, including the extended `ROLL-01 (Phase 72)` guard.
9. `npm test`: 5636 pass / 7 fail (pre-existing worktree-only CRLF doc-ledger noise, `docs/CLASS-PASS.md`/`docs/FLEE.md`, confirmed byte-identical to the plan base `904269c`) / 1 todo (`[parley:parley-need-mod]`, F5, 72-07's own row — out of this plan's scope).

No pin moved anywhere.

## Decisions Made

See `key-decisions` in the frontmatter — summarized: a single shared `shatterIfBest` helper rather than six duplicated inline checks; `allyTurn`'s countdown restructured (not an early return) so it still ticks after a shatter; the zero-extra-draws test compares draw SEQUENCES against a standalone `killFoe` call rather than hand-counting `killFoe`'s own variable draw total; the hero-thrown-spell test captures the foe reference before `castSpell` because combat ends (and `state.combat` nulls) once the Skeleton dies.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria (`critOn` grep empty, exact `shatterOnBest`/`isBestFace`/`shatterIfBest` export counts, call-site counts in both files, `criticals on a 1` gone, `deaf` note present, narration coverage in both files, all six `[shatter:*]` rows green, FIXTURE-INVENTORY.md's Plan 06 heading, the extended `foeShattered` guard) were met without needing an auto-fix.

## Issues Encountered

One self-caught test bug (not an engine issue): the hero-thrown-spell `foeShattered`-naming test initially read `s.combat.foes[0].alive` AFTER `castSpell`, which throws (`state.combat` is nulled once combat ends on the Skeleton's death). Fixed by capturing the foe reference before the call, per the "castSpell's own tail" note already documented in the plan's `<interfaces>` section. No engine or content change involved.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7: find a Skeleton (Walking Dead, tier 2 — Google's tier), land a best-face strike (roll a natural 1 on the strike die), and confirm the Oracle log shows the shatter line ("Your best roll lands clean...") and the Skeleton does not come back (no "gets back up" — both lives are gone in the same blow).

## Next Phase Readiness

- `docs/ROLL-LEDGER.md`'s known fixes (a), (b), (c) and (d) are all landed (72-04/72-05/this plan); F1/F2/F3/F5 remain for 72-07.
- `ROLL01_EXPECTED_HOLDERS` in `test/parity/divergence-records.test.js` stays `[]` after this plan (72-07 may extend it with its own measured set).
- `test/unit/rollDirection.test.js` carries zero `todo` rows now — every combat-half direction row is green.
- Phase 73's roll-high mirror needs only `engine/dice.js#isBestFace`'s single line changed (`roll === 1` → `roll === dieN`); every `shatterIfBest` call site is untouched, and `test/unit/rollDirection.test.js`/`test/unit/skeleton-shatter.test.js` both run unchanged (odds-based, no roll-convention number written).
- Phase 79 (roll-direction phrasing) will need to revisit the Skeleton's bestiary note ("your best roll shatters it") and the `foeShattered` narration lines once the mirror lands, per `docs/ROLL-LEDGER.md`'s `## Handoffs → Phase 79` pattern already established by known fix (a)'s Smoke text.

---
*Phase: 72-roll-direction-sign-audit-fixes*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: engine/dice.js
- FOUND: engine/combat.js
- FOUND: engine/magic.js
- FOUND: content/bestiary.js
- FOUND: src/browser/eventNarration.js
- FOUND: src/browser/narrationLines.js
- FOUND: test/unit/skeleton-shatter.test.js
- FOUND: test/unit/rollDirection.test.js
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: test/parity/divergence-records.test.js
- FOUND: .planning/phases/72-roll-direction-sign-audit-fixes/72-06-SUMMARY.md
- FOUND commit ed4d076 (Task 1)
- FOUND commit 44c2b70 (Task 2)
