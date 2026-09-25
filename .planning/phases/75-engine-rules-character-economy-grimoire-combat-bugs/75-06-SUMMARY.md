---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 06
subsystem: engine-rules
tags: [combat, initiative, spells, ward, narration, saveState]

requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "roll-high check helpers (rollCheck/atLeastFor/rollFields), src/browser/rollRange.js formatter, conditionEffects.js's what-if chip map"
provides:
  - "RULES-05: Sense Presence (c.senses) wins initiative outright — joins Foresight/Acute Hearing in the unconditional 'you go first' branch, waives combatInDark and the dark no-crit ban, and the verdict line names it ('You felt them coming.')"
  - "RULES-14: Bubble is a one-shot mirror ({ mirror:true, popPool:25 }) — reflects the next landed blow in full via damageFoe(kind:'reflect'), then pops into a plain 25hp/1-round pool; Shield is untouched"
affects: [75-07, 75-08, 75-09, 75-10, 75-11, 75-12, 75-13, 75.1]

tech-stack:
  added: []
  patterns:
    - "Mirror check sits at the very top of applyFoeDamageToPlayer, ahead of Hardiness/hide/halfNext/Brace, so a reflected blow never spends a single-charge buffer."
    - "A ward's rounds field distinguishes armed (null, never ticks) from popped (a plain integer, foeTurn's tail tick decrements it) — replaces the retired reflect boolean."

key-files:
  created:
    - test/unit/sense-presence.test.js
    - test/unit/bubble-mirror.test.js
    - tools/readouts/75-06-before.txt
    - tools/readouts/75-06-after.txt
  modified:
    - engine/combat.js
    - engine/magic.js
    - engine/derived.js
    - engine/saveState.js
    - engine/items.js
    - content/spells.js
    - mazeworld.html
    - src/browser/conditionEffects.js (read only, deliberately untouched — see Decisions)
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/gearTab.js (Rule 1 deviation, not in plan's files_modified)
    - docs/SPELLS.md
    - test/unit/sense-presence.test.js
    - test/unit/bubble-mirror.test.js
    - test/unit/initiative-line.test.js
    - test/unit/magic.test.js
    - test/unit/combat.test.js
    - test/unit/spell-table.test.js
    - test/unit/spell-utility.test.js
    - test/unit/conditions.test.js (checked, no change needed — see Decisions)
    - test/unit/status-chit-combat.test.js (checked, no change needed — see Decisions)
    - test/unit/tuning-bot.test.js (checked, no change needed — see Decisions)
    - test/roundtrip/serialize-rehydrate.test.js
    - test/unit/foe-abilities.test.js (Rule 1 deviation, not in plan's files_modified)
    - test/unit/feedback-payload.test.js (Rule 1 deviation, not in plan's files_modified)
    - test/unit/shell-fight-gate.test.js (Rule 1 deviation, not in plan's files_modified)
    - test/unit/gear-panels.test.js (Rule 1 deviation, not in plan's files_modified)
    - test/unit/gear-view-models.test.js (Rule 1 deviation, not in plan's files_modified)
    - test/voice/safety-scan.test.js (Rule 1 deviation, not in plan's files_modified)

key-decisions:
  - "conditionEffects.js is deliberately untouched: its darkness/senses what-if builders measure to-hit odds only, never state a crit ban, so there is nothing for RULES-05's dark-crit waiver to update there."
  - "gearTab.js's kit row for an armed mirror (deviation Rule 1, not in the plan's files list): the old wardValue interpolation would have printed '0 hp left · null rds' for a null rounds — added a dedicated wardMirrorValue: 'next hit' row, matching the map-HUD chip."
  - "Five more test files outside the plan's declared files_modified needed re-pinning after removing c.ward.reflect and the old Bubble shape (Rule 1 — a real bug the shape change would otherwise cause): test/unit/foe-abilities.test.js, feedback-payload.test.js, shell-fight-gate.test.js, gear-panels.test.js, gear-view-models.test.js, plus test/voice/safety-scan.test.js's dummy-event fixture."
  - "Task-boundary note: RULES-14's engine/combat.js (applyFoeDamageToPlayer mirror, foeTurn tail-tick guard) and src/browser/narrationLines.js's wardRaised/wardReflected landed inside the RULES-05 commit (67b9227), because both files were edited (Task 1 then Task 2/3) before that commit was staged. All code is correct and fully tested either way — this is a commit-boundary artifact, not a functional issue."

requirements-completed: [RULES-05, RULES-14]

coverage:
  - id: D1
    description: "Sense Presence wins initiative outright (joins the unconditional 'you go first' branch), waives combatInDark and the dark no-crit ban, and the verdict line names it in voice"
    requirement: RULES-05
    verification:
      - kind: unit
        ref: "test/unit/sense-presence.test.js (all 6 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/initiative-line.test.js"
        status: pass
      - kind: unit
        ref: "test/unit/spell-utility.test.js (3 re-pinned SPELL-02 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bubble reflects the next landed blow in full at its attacker, then pops into a 25hp/1-round pool; Shield is unchanged; old saves tolerant-load"
    requirement: RULES-14
    verification:
      - kind: unit
        ref: "test/unit/bubble-mirror.test.js (all 15 tests: mirror, boundary 24/25/26, adjacency, ordering, pursuit strike, endCombat, tolerant load, allyCast-never)"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js, test/unit/magic.test.js, test/unit/spell-table.test.js, test/roundtrip/serialize-rehydrate.test.js (re-pinned)"
        status: pass
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (53/53, zero fixtures moved — measured via git diff --quiet against the plan base)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero difficulty regression from the Bubble nerf — measured via a 200-seed bot readout before/after"
    verification:
      - kind: other
        ref: "tools/readouts/75-06-before.txt vs tools/readouts/75-06-after.txt (mean death depth 7.88->7.85, verdict unchanged, reach-20 1.5%->1.5%)"
        status: pass
    human_judgment: true
    rationale: "The tune-difficulty readout is an informational proxy, not a pass/fail gate (per its own header) — the human DR round at milestone close is the real signal for whether the nerf feels right in play."

duration: 60min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 06: Sense Presence & Bubble rules changes Summary

**Sense Presence now wins initiative outright and grants full skill in the dark; Bubble is a one-shot mirror with a 25 hp pop pool instead of a bigger Shield**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-09-25T16:00:00-04:00 (approx.)
- **Completed:** 2026-09-25T17:24:51-04:00
- **Tasks:** 3
- **Files modified:** 32 (27 declared in the plan + 6 Rule 1 deviations not in the plan's `files_modified` list)

## Accomplishments

- **RULES-05:** `engine/combat.js#resolveInitiative` puts `c.senses` in the unconditional "you go first" branch beside Foresight/Acute Hearing — a sensed hero can no longer lose the fair d20 roll and go second (the device report this fixes: a depth-8 Court Mage with senses up lost initiative 2 vs 17 in the dark and died). Both d20s are still always drawn. `fight()`'s `combatInDark` push and `playerStrike`'s dark no-crit clause both gained a `&& !c.senses` term, mirroring `toHit`'s existing dark-cap waiver. `narrationLines.js#initiativeVerdictText`'s `"senses"` case now reads "You felt them coming. You go first." on both the Oracle and the rail/fight log.
- **RULES-14:** Bubble (`content/spells.js`) is now `{ kind: "ward", mirror: true, popPool: 25 }` — the old `pool`/`rounds`/`reflect` keys are gone. `engine/magic.js`'s ward branch raises an armed mirror (`{ name, mirror: true, pool: 0, popPool, rounds: null }`) for a mirror spell. `engine/combat.js#applyFoeDamageToPlayer` checks the armed mirror FIRST — ahead of Hardiness, the Fridgian hide, the Pendant's `halfNext`, and Brace — reflects the full blow via `damageFoe(kind:"reflect")`, and pops the ward into `{ pool: popPool, rounds: 1 }`. `foeTurn`'s tail tick only decrements `rounds` when it's a number, so an armed mirror (`rounds: null`) never fades on its own, while a popped pool (`rounds: 1`) always fades at the end of the same foe turn it popped in. Shield is byte-identical to before.
- The ward condition chip (`engine/derived.js#conditionsOf`) and the shell (`mazeworld.html`'s chip label/detail/tap-card, `explainCondition`) both go mirror-aware: an armed Bubble reads its own name with "next hit"; a popped pool reads the plain pool/rounds text, same as Shield.
- `engine/saveState.js#sanitizeWard` tolerant-loads a pre-Phase-75 save's `{ reflect: true }` ward as the armed mirror (popPool read live from the SPELLS Bubble row, never hard-coded); any other ward simply loses a stray `reflect` key.
- Zero parity fixtures moved (measured): `node --test "test/parity/**/*.test.js"` is 53/53, and `git diff --quiet` against the plan base (`5e7fe0c`) for `test/parity/fixtures` and `test/parity/prototype-master.js.txt` both exit clean.
- Full test suite green: `npm test` — 6062/6062. `npm run boot:check` fails `painted`/`graves`/`title` on both attempts, matching the STANDING, pre-existing environment blocker documented in `.planning/STATE.md` (not a regression from this plan).
- A 200-seed bot readout (`tools/readouts/75-06-{before,after}.txt`) shows the Bubble nerf is noise-level at the aggregate difficulty-curve level: mean death depth 7.88 → 7.85, the per-floor-survival verdict unchanged ("all floors 1-12 inside the pass band"), reach-20 1.5% → 1.5%. The Magic User class-identity row's `dmgTaken/fight` moved 8.15 → 8.01 (slightly better, since a reflected blow now costs the caster nothing at all, vs. Shield's old partial soak) — consistent with the intended shape of the change, not a regression.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sense Presence wins initiative and lifts both dark rules (RULES-05)** — `67b9227` (feat) — *also includes RULES-14's `engine/combat.js` and `src/browser/narrationLines.js` code, see the Task Boundary Note below*
2. **Task 2 + Task 3: Bubble as a one-shot mirror; the ward chip, lines, docs; fixture measurement** — `36e313c` (feat)
3. **Readouts** — `1bc0041` (docs)

**Plan metadata:** this SUMMARY.md's own commit (pending, by the orchestrator's convention)

## Files Created/Modified

- `engine/combat.js` — `resolveInitiative`'s senses branch/JSDoc; `combatInDark`/`noCrit` dark waivers; `applyFoeDamageToPlayer`'s mirror-first check (RULES-14) and the old reflect-the-soaked-share branch's removal; `foeTurn`'s tail-tick `typeof rounds === "number"` guard
- `engine/magic.js` — the ward branch's mirror/plain split; `wardRaised`'s additive `mirror`/`popPool` fields
- `engine/derived.js` — `conditionsOf`'s ward entry fires for an armed mirror too (`pool > 0 || mirror`)
- `engine/saveState.js` — new `sanitizeWard` tolerant-load helper, wired into both `validateSave` and `rehydrate`
- `engine/items.js` — the Rowan Staff dome's ward literal drops its stray `reflect: false`
- `content/spells.js` — Bubble's row rewritten to the mirror shape; Shield untouched
- `mazeworld.html` — the ward chip's label/detail/tap-card go mirror-aware
- `src/browser/eventNarration.js`, `src/browser/narrationLines.js` — `wardRaised`/`wardReflected` read mirror-aware lines on the Oracle and the rail/fight log; `initiativeVerdictText`'s `"senses"` case reworded
- `src/browser/gearTab.js` — the kit row's armed-mirror "next hit" fix (Rule 1 deviation)
- `docs/SPELLS.md` — the Sense Presence rules-change section updated; a new "Phase 75 (RULES-05, RULES-14)" section appended (the file is never rewritten wholesale, per its own header)
- `test/unit/sense-presence.test.js`, `test/unit/bubble-mirror.test.js` — new, full behaviour coverage
- `test/unit/initiative-line.test.js`, `test/unit/magic.test.js`, `test/unit/combat.test.js`, `test/unit/spell-table.test.js`, `test/unit/spell-utility.test.js`, `test/roundtrip/serialize-rehydrate.test.js` — re-pinned for the new shapes
- `test/unit/foe-abilities.test.js`, `test/unit/feedback-payload.test.js`, `test/unit/shell-fight-gate.test.js`, `test/unit/gear-panels.test.js`, `test/unit/gear-view-models.test.js`, `test/voice/safety-scan.test.js` — Rule 1 deviations, re-pinned/extended (not in the plan's declared `files_modified`)
- `tools/readouts/75-06-before.txt`, `tools/readouts/75-06-after.txt` — the 200-seed bot readouts

## Decisions Made

- **`conditionEffects.js` left untouched.** Its darkness/senses what-if builders (`WHAT_IF.darkness`/`WHAT_IF.senses`) measure to-hit ODDS only (via `heroHitOdds`/`foeToHitVs`) — neither states a crit ban or a to-hit cap in its own text, so there was nothing for RULES-05's dark-crit waiver to update there. Documented per the plan's own fallback instruction.
- **Six files outside the plan's declared `files_modified` needed re-pinning** after retiring `c.ward.reflect`/the old Bubble shape (Rule 1 — this is a real bug the shape change would otherwise cause, not scope creep): `test/unit/foe-abilities.test.js` (a foe ability bolt through a reflecting ward — now the armed mirror), `test/unit/feedback-payload.test.js` (a stray `reflect: false` in a ward fixture), `test/unit/shell-fight-gate.test.js` (a source-scan test whose `CODE.indexOf('cn.key === "ward"')` now finds `explainCondition`'s new earlier mirror check instead of `paintConditions`' detail branch — scoped the search to the `paintConditions` function region), `test/unit/gear-panels.test.js`/`gear-view-models.test.js` (the Gear tab's `GEAR_COPY.kit` frozen-shape pin and a new armed-mirror row test), `test/voice/safety-scan.test.js` (the dummy `BASE_EVENT`'s `reflect: true` field, unread by any builder now, swapped for `mirror: true, popPool: 25` so the new narration branches are actually safety-scanned).
- **The pop pool is 25 hp**, per the plan's own flagged assumption (the user's recommended value, half of Shield's 50) — the readout shows no material difficulty shift at this value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] gearTab.js's kit row would have printed "0 hp left · null rds" for an armed mirror**
- **Found during:** Task 3 (the ward chip/lines pass)
- **Issue:** `gearKitRows`'s ward row interpolates `GEAR_COPY.kit.wardValue` (`"{pool} hp left · {rounds} rds"`) against `c.ward.pool`/`c.ward.rounds` unconditionally — an armed mirror's `rounds` is `null`, which would have rendered literally as `"0 hp left · null rds"` on the Hero/Gear tab.
- **Fix:** Added `GEAR_COPY.kit.wardMirrorValue: "next hit"` and a mirror branch in `gearKitRows`, matching the map-HUD chip's own "next hit" text.
- **Files modified:** `src/browser/gearTab.js`, `test/unit/gear-panels.test.js` (frozen-shape pin), `test/unit/gear-view-models.test.js` (new armed-mirror/popped-pool row test)
- **Verification:** `node --test test/unit/gear-panels.test.js test/unit/gear-view-models.test.js` — pass
- **Committed in:** `36e313c`

**2. [Rule 1 - Bug] Five more test files broke on the retired `c.ward.reflect`/old Bubble shape**
- **Found during:** Task 2/3 (running the full unit suite before committing)
- **Issue:** `test/unit/foe-abilities.test.js`'s "a reflecting ward bounces" bolt test, `test/unit/feedback-payload.test.js`'s stray `reflect: false` ward fixture, and `test/unit/shell-fight-gate.test.js`'s source-position-dependent `cn.key === "ward"` scan all assumed the pre-Phase-75 shape/source layout.
- **Fix:** Re-pinned the foe-abilities bolt test to the armed-mirror shape (now also asserting the tail-tick `wardFaded`); dropped the stray `reflect: false` key; scoped `shell-fight-gate.test.js`'s scan to the `paintConditions` function region and its distinguishing `else if` form, since `explainCondition`'s new mirror check (added ahead of `paintConditions` in source order) introduced an earlier, legitimate match of the same literal string.
- **Files modified:** `test/unit/foe-abilities.test.js`, `test/unit/feedback-payload.test.js`, `test/unit/shell-fight-gate.test.js`
- **Verification:** `node --test test/unit/foe-abilities.test.js test/unit/feedback-payload.test.js test/unit/shell-fight-gate.test.js` — pass; full `npm test` — 6062/6062
- **Committed in:** `36e313c`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs the RULES-14 shape change would otherwise have introduced/exposed)
**Impact on plan:** Both fixes necessary for correctness; no scope creep. Neither changes engine behaviour beyond what the plan already specified — they are shell-copy and test-fixture corrections.

## Issues Encountered

- **Task-boundary mixing (process note, not a bug):** `engine/combat.js`'s RULES-14 mirror logic and `src/browser/narrationLines.js`'s mirror-aware `wardRaised`/`wardReflected` lines landed inside the Task 1 commit (`67b9227`), because both files received their Task 1 AND Task 2/3 edits before that commit was staged (I implemented all of Task 1's and part of Task 2's `combat.js`/`narrationLines.js` work before running Task 1's own verification and committing). All code in that commit is correct, tested, and matches the plan — this only means the commit's diff is slightly broader than its own commit message describes. No functional impact; documented here for the record.
- `npm run boot:check` fails `painted`/`graves`/`title` on both a first and a rerun attempt — this exactly matches the STANDING, pre-existing environment blocker in `.planning/STATE.md` (`tools/shell-boot-check.mjs`'s raw `--headless=new --dump-dom` is environment-blocked on this machine; not a code regression, `test/unit/**` and `npm test` are the real gate).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RULES-05/RULES-14 are fully landed, tested, and measured with zero fixture drift. The Phase 75.1 handoff note is recorded in both `docs/SPELLS.md` and this SUMMARY: RULES-10's fumbled Bubble scroll can land the spell on a FOE — the mirror lives only on the hero's own damage pipeline (`applyFoeDamageToPlayer`), so Phase 75.1 must add a matching foe-side mirror check to `engine/foeDamage.js#damageFoe` (or an equivalent foe-ward seam) before a fumbled Bubble can protect a foe the same way.
- The human-check items from this plan's `<verification>` block (cast Sense Presence into a dark fight → "you go first", no "cannot see" line; cast Bubble → the next hit bounces back and pops, a small pool soaks the rest of that round) are queued for the milestone-close Pixel 7 UAT batch, per the deferred-UAT protocol.

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: test/unit/sense-presence.test.js
- FOUND: test/unit/bubble-mirror.test.js
- FOUND: tools/readouts/75-06-before.txt
- FOUND: tools/readouts/75-06-after.txt
- FOUND: .planning/phases/75-engine-rules-character-economy-grimoire-combat-bugs/75-06-SUMMARY.md
- FOUND commit: 67b9227 (feat: RULES-05)
- FOUND commit: 36e313c (feat: RULES-14)
- FOUND commit: 1bc0041 (docs: readouts)
- FOUND commit: e857b43 (docs: this SUMMARY)
