---
phase: 42-flee-retune-consolidated-balance-close
plan: 01
subsystem: engine
tags: [combat, flee, content-table, narration, fight-log, toasts, rail, combat-menu, canon-divergence, ledger]

# Dependency graph
requires: []
provides:
  - "content/flee.js: FLEE_NEED=14, FLEE_THIEF_BONUS=5, FLEE_CLASS_MOD, FLEE_RACE_MOD (bounded ±2), re-exported from content/index.js"
  - "engine/derived.js#fleeBreakdown(c) -> { need, mods, bonus } — the ONE flee-need rule, mirroring foeToHitBreakdown"
  - "engine/combat.js#flee: fleeRolled { roll, mods, total, need } (bonus/bulk fields retired); the ONE d20 draw at the same position; failure path byte-identical"
  - "src/browser/eventNarration.js/toasts.js/rail.js/combatMenu.js: fleeRolled narrated with named modifiers on the Oracle sentence, the fight-log fold (roll first), a toast, a rail family, and the honest per-character FLEE submenu cost"
  - "docs/FLEE.md: the declared canon divergence ledger — modifier table, before/after table (11 rows), what did not change, event payload/narration, parity fixture reading, requirements map"
  - "test/unit/flee-retune.test.js, test/unit/flee-ledger.test.js; test/parity/FIXTURE-INVENTORY.md Phase 42 section"
affects: [42-02-bot-tactics, 42-03-usage-tallies, 42-04-consolidated-balance-close]

tech-stack:
  added: []
  patterns:
    - "fleeBreakdown(c) mirrors foeToHitBreakdown's { name, delta } mods shape — every narration surface (Oracle, toast, rail, combat submenu) reads the SAME list instead of re-deriving the formula"
    - "fleeChain/TOAST_FOR.fleeRolled: the fold reuses TOAST_FOR.fleeRolled's own text (roll first) rather than restating the format, keeping the fight log's one-line-per-attempt fold intact"

key-files:
  created:
    - content/flee.js
    - docs/FLEE.md
    - test/unit/flee-retune.test.js
    - test/unit/flee-ledger.test.js
  modified:
    - content/index.js
    - engine/derived.js
    - engine/combat.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - src/browser/combatMenu.js
    - test/unit/combat.test.js
    - test/unit/gear-axes.test.js
    - test/unit/feedback-payload.test.js
    - test/unit/toastsForAction.test.js
    - test/unit/combatMenu.test.js
    - test/unit/rail.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/GEAR-BALANCE.md

key-decisions:
  - "The plan's own <behavior> bullet claimed Troll Fighter in Plate escapes 3/20 (15%); the plan's own Action A content table (Troll -1) and Before/after table (need 17, 20%) both compute 4/20 (20%) — measured live, the enumeration test asserts the arithmetically-consistent 4/20, and the discrepancy is documented inline in the test and here rather than silently matched to the wrong number"
  - "fleeBreakdown pushes mods in the fixed order Thief -> class -> race -> armor, only when non-zero, so a Human Fighter in no armor carries mods: [] rather than a padded zero-delta list"
  - "The old fleeRolled bonus/bulk keys are fully retired (greenfield) — every narration surface reads roll/mods/total/need, never re-derives armor/race/class math"

requirements-completed: [FLEE-01, FLEE-02]

coverage:
  - id: D1
    description: "content/flee.js's bounded class/race modifier table (Thief +5 kept, need 14) with fleeBreakdown(c) as the one flee-need rule"
    requirement: "FLEE-01"
    verification:
      - kind: unit
        ref: "test/unit/flee-retune.test.js (table bounds, worked rows, exhaustive d20 enumeration)"
        status: pass
      - kind: unit
        ref: "test/unit/flee-ledger.test.js (docs/FLEE.md numbers pinned to content/flee.js)"
        status: pass
    human_judgment: false
  - id: D2
    description: "engine/combat.js#flee rewritten to the new formula with a richer fleeRolled event, same one d20 draw, byte-identical failure path"
    requirement: "FLEE-01"
    verification:
      - kind: unit
        ref: "test/unit/flee-retune.test.js (event shape, one-draw proof, failure path, sub-class flavour untouched)"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js, test/unit/gear-axes.test.js, test/unit/feedback-payload.test.js (re-pinned)"
        status: pass
      - kind: integration
        ref: "test/parity/combat-parity.test.js (flee scenario, seed 17) + live seed-17 measurement recorded in docs/FLEE.md and test/parity/FIXTURE-INVENTORY.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "fleeRolled narrated with named modifiers, roll before outcome, on the Oracle sentence, the fight-log fold, a toast, a rail family, and the combat submenu's honest FLEE cost"
    requirement: "FLEE-02"
    verification:
      - kind: unit
        ref: "test/unit/flee-retune.test.js narration section, test/unit/toastsForAction.test.js, test/unit/combatMenu.test.js, test/unit/rail.test.js"
        status: pass
      - kind: other
        ref: "npm run build:www (exit 0); test/voice/safety-scan.test.js (pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The declared canon-divergence ledger (docs/FLEE.md) and the whole-suite plan gate"
    requirement: "FLEE-01"
    verification:
      - kind: unit
        ref: "test/unit/flee-ledger.test.js"
        status: pass
      - kind: other
        ref: "npm test (2935/2935, # fail 0); git hash-object test/parity/prototype-master.js.txt (a1f4d0dc29782218d8e5aab65bc5989c33f917f0, unchanged); git status --porcelain test/parity/fixtures (empty)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-18
status: complete
---

# Phase 42 Plan 01: Flee Retune — Need 14, Named Modifiers, Declared Ledger Summary

**Flee drops from a flat 50%/75% (d20+5 vs 11, no race/armor input) to a transparently-fair d20 + Thief 5 + bounded class/race modifiers − armor bulk vs 14 (35%/60%/25% anchors), with every modifier named in a richer `fleeRolled` event narrated on the Oracle, fight log, toast and rail BEFORE the outcome, the combat submenu's FLEE row showing the honest per-character cost, and the whole change declared in a new `docs/FLEE.md` ledger whose numbers are pinned to `content/flee.js` by a standing test.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 19 (4 new, 15 modified)

## Accomplishments

- `content/flee.js` (new): `FLEE_NEED = 14`, `FLEE_THIEF_BONUS = 5`, `FLEE_CLASS_MOD` (Fighter 0, Thief 0, Magic User −1), `FLEE_RACE_MOD` (Human 0, Elven +1, Dwarven −1, Wilmsry 0, Fridgian −1, Troll −1) — every value bounded to ±2, reasoned in `docs/FLEE.md`. Re-exported from `content/index.js`.
- `engine/derived.js#fleeBreakdown(c)`: the ONE flee-need rule, returning `{ need, mods, bonus }` with `mods` built in a fixed Thief → class → race → armor order (pushed only when non-zero) — mirroring `foeToHitBreakdown`'s `{ name, delta }` shape so every narration surface reads the same list.
- `engine/combat.js#flee`: the Thief-bonus/bulk arithmetic and the old `fleeRolled { roll, bonus, bulk, need: 11 }` push replaced with `fleeBreakdown(c)` and `fleeRolled { roll, mods, total, need }` — the roll still happens at the exact same position (after the Smoke check, before `pursuitStrike`), still exactly one `rng.d(20)` draw; the failure tail (`fleeFailed` → `foeTurn` → cleared-check) is byte-identical.
- Narration (all four surfaces read `mods`, never re-derive the formula):
  - `src/browser/eventNarration.js`: `EVENT_NARRATION.fleeRolled` renders `Flee: rolled <span class="roll">8</span> (Thief +5, Mail −1) — 12 against 14.` via the existing `needModsText` helper.
  - `src/browser/toasts.js`: `TOAST_FOR.fleeRolled` (`Flee: 8 (Thief +5, Mail −1) = 12 vs 14`) and `fleeChain`'s fold now lead with the roll (`${TOAST_FOR.fleeRolled(e).text}. ${outcome text}`), reusing the builder rather than restating the format — still one fight-log line per attempt.
  - `src/browser/rail.js`: `RAIL_FAMILY.fleeRolled = { icon: "·", title: "FLEE", tone: "info" }`.
  - `src/browser/combatMenu.js`: the FLEE row's `cost`/`desc` computed from `fleeBreakdown(c)` (e.g. `d20+5, 14+` / `d20−3, 14+` with `(Troll −1, Plate −2)`) — the two old hard-coded `"11+"`/`"+5"` strings are gone.
- `test/unit/flee-retune.test.js` (new, 14 tests): table bounds, worked `fleeBreakdown` rows, the exhaustive d20 enumeration (35%/60%/25%/30%/65%/20% anchors), the `fleeRolled` event's exact `{type,roll,mods,total,need}` shape (no `bonus`/`bulk`), the one-draw proof, the failure path, sub-class flavour untouched, and the narration surfaces (`EVENT_NARRATION`/`TOAST_FOR`/`fightLogLinesFor`).
- Re-pinned `test/unit/combat.test.js`, `gear-axes.test.js`, `feedback-payload.test.js`, `toastsForAction.test.js`, `combatMenu.test.js`, `rail.test.js` to the new need/payload; every roll that stays on the same side of both the old (11) and new (14) need was left untouched.
- `docs/FLEE.md` (new): the declared canon-divergence ledger — canon change, the full modifier table (with reasons), an 11-row before/after table (every percentage computed as `Math.round((21-need)/20*100)`, not typed), what did not change (Samurai/Cloaker/tracked-withdrawal/Smoke/failure-path/pursuit/loot-forfeit/one-draw), the event payload and narration contract, the seed-17 parity fixture reading, tests, and a requirements map. `test/unit/flee-ledger.test.js` (new, 5 tests) proves the modifier and before/after tables can never drift from `content/flee.js`.
- `docs/GEAR-BALANCE.md`'s Flee-roll row updated to cite `fleeBreakdown(c)` and cross-link `docs/FLEE.md`; `test/parity/FIXTURE-INVENTORY.md` gained a `## Phase 42 — flee retune (FLEE-01)` section recording the grep confirmation, the live seed-17 measurement, and the unchanged draw count.

## Task Commits

1. **Task 1: content/flee.js table, fleeBreakdown(c), the flee() rewrite, re-pinned tests, fixture measurement** - `023462d` (feat)
2. **Task 2: Narrate fleeRolled with named modifiers on all three surfaces and the honest combat-menu FLEE cost** - `7a9112e` (feat)
3. **Task 3: docs/FLEE.md ledger, ledger pin test, cross-links, plan gate** - `e8a18ec` (docs)

**Plan metadata:** this commit (SUMMARY only; `commit_docs: true` in this project's config, but per this run's instructions the orchestrator owns STATE.md/ROADMAP.md writes)

## Files Created/Modified

- `content/flee.js` (new) — the flee modifier tables
- `content/index.js` — barrel re-export
- `engine/derived.js` — `fleeBreakdown(c)`
- `engine/combat.js` — `flee()` rewrite
- `src/browser/eventNarration.js` — `EVENT_NARRATION.fleeRolled`
- `src/browser/toasts.js` — `TOAST_FOR.fleeRolled`, `fleeChain`, `fleeModsText`
- `src/browser/rail.js` — `RAIL_FAMILY.fleeRolled`
- `src/browser/combatMenu.js` — the FLEE submenu row's honest cost/desc
- `test/unit/flee-retune.test.js` (new) — the flee-retune contract suite
- `test/unit/flee-ledger.test.js` (new) — the ledger pin test
- `test/unit/combat.test.js`, `gear-axes.test.js`, `feedback-payload.test.js`, `toastsForAction.test.js`, `combatMenu.test.js`, `rail.test.js` — re-pinned to the new need/payload
- `docs/FLEE.md` (new) — the declared canon-divergence ledger
- `docs/GEAR-BALANCE.md` — Flee-roll row cross-link
- `test/parity/FIXTURE-INVENTORY.md` — Phase 42 section

## Decisions Made

See frontmatter `key-decisions` — the Troll-Fighter-in-Plate enumeration correction (4/20, not the plan's own inconsistent 3/20), `fleeBreakdown`'s fixed mod-push order, and the full retirement of the old `bonus`/`bulk` payload keys are all recorded there with rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's own `<behavior>` bullet for Task 1 miscalculated the Troll Fighter in Plate enumeration**
- **Found during:** Task 1 (writing the exhaustive d20 enumeration test)
- **Issue:** The plan's `<behavior>` section claims "Troll Fighter Plate 3/20 (15%)". Computing from the plan's own locked content table (`FLEE_RACE_MOD.Troll = -1`, Plate armor bulk 2) gives `bonus = -1 - 2 = -3`, so the true need is `roll >= 17` (rolls 17-20 = 4/20 = 20%) — which is exactly what the SAME plan's Action A "Before/after" table independently computes ("Troll Fighter Plate (13/40 → 17/20)"). The `<behavior>` bullet's "3/20 (15%)" (which would require need 18) contradicts the plan's own worked rows (`bonus -3`) and its own before/after table.
- **Fix:** Implemented `fleeBreakdown`/`flee()` exactly per the plan's locked content table and formula (no ambiguity there); wrote the exhaustive-enumeration test to assert the arithmetically-correct, internally-consistent value (4/20, 20%), measured live by actually running `flee()` through all 20 rolls — not hand-typed to match either conflicting plan number. Documented the discrepancy inline in the test comment and in this SUMMARY rather than silently "fixing" the test to match the wrong bullet.
- **Files modified:** test/unit/flee-retune.test.js
- **Verification:** `node --test test/unit/flee-retune.test.js` — the enumeration test passes with the measured 4/20 value; every other anchor (35%/60%/25%/30%/65%) matches the plan exactly.
- **Committed in:** 023462d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — an arithmetic inconsistency inside the plan itself, resolved in favor of the plan's own locked content table and before/after table, which agree with each other and disagree only with one illustrative bullet)
**Impact on plan:** No scope creep, no architectural change — the fix is entirely within the plan's own numbers; the flee formula, content table, and every other test/doc value are exactly as specified.

## Issues Encountered

None beyond the deviation above. The plan's worked `fleeBreakdown` rows (bonus values for all 8 example characters) all matched the implementation on the first run, which caught the Troll/Plate discrepancy early via the enumeration test rather than late via a doc/test mismatch.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device pauses occurred. These items are recorded for the milestone-close aggregated Pixel 7 checklist:

1. In a fight, the SOCIAL → FLEE row shows the honest pre-roll cost/desc for the current character — e.g. a plain Fighter reads "d20, 14+"; a Thief reads "d20+5, 14+" with "(Thief +5)" appended to the description; a heavily-modified character (e.g. a Troll in Plate) reads "d20−3, 14+" with both modifiers named.
2. After tapping FLEE, the fight log's newest line reads "Flee: N (modifiers) = T vs 14." followed immediately by the outcome sentence ("You get clear." / "You do not make it."), and tapping the line reveals the Oracle's own fuller sentence with the dice.
3. A failed flee still visibly hands every live foe its swing (a `struckByFoe`/`foeMissed` line appears) and the round counter advances — exactly as before this phase.
4. Sub-class flavour is unchanged on-device: a Samurai still refuses to flee outright; a fresh (unseen) Cloaker still vanishes for free with no roll shown; a round-1 tracked encounter still offers a clean WITHDRAW with no roll.
5. A voice read of the new fleeRolled line (Oracle, toast, and submenu desc) confirms the tone stays deadpan/family-friendly and the minus sign renders correctly (not a stray hyphen or mojibake) on-device.

## Corrections to CONTEXT

- **Races:** the six real races are Human, Elven, Dwarven, Wilmsry, Fridgian, Troll (`content/races.js`). CONTEXT Area 1's illustrative "Halfling +2, Elf +1, ... Dwarf −1, Ogre/large −1" example names races that do not exist in this codebase (Halfling, Elf, Ogre) — the plan's own Action A already corrected this to the six real races before I began implementing, and I followed the plan's corrected table (Elven +1, Dwarven −1, Fridgian −1, Troll −1, Human/Wilmsry 0) rather than CONTEXT's illustrative names.
- **Combat submenu:** CONTEXT Area 1 described the fight-log line as the only surface needing the new event; in fact `src/browser/combatMenu.js`'s SOCIAL → FLEE row also carried the OLD hard-coded need (11) and Thief-only bonus string, which would have shown a dishonest pre-roll cost after this phase's need change. This was in the plan's own Task 2 scope (not a CONTEXT gap I found independently) — noted here because CONTEXT itself didn't call it out.
- **Seed-17 reading:** CONTEXT/the plan predicted (planning-time, not measured) "18 + 5 − 1 Fridgian = 22 vs 14 under this plan's table — the outcome stays `fled`". The live Task 1 measurement (2026-09-18, replaying `newRun(17)` through the finished engine) confirms this exactly: hero Fridgian Thief (Pilfer), no armor, roll 18, mods `Thief +5, Fridgian −1`, total 22, need 14, outcome `fled`. No divergence record was needed; the fixture is untouched.

## Next Phase Readiness

- `content/flee.js`, `engine/derived.js#fleeBreakdown`, and the `fleeRolled { roll, mods, total, need }` shape are the stable API Plan 04's consolidated AFTER matrix run will encounter unchanged — the bot's flee threshold reads through the same `flee()` call, so no bot-side change is needed for FLEE-01/02 specifically (Plan 02 covers the bot's ability/item/spell usage separately, per CONTEXT's BAL-01-second-half scope).
- `docs/FLEE.md` is ready for Plan 04's `docs/CLASS-PASS.md` v1.5 AFTER section to cross-link, per this document's own closing line.
- No blockers.

---
*Phase: 42-flee-retune-consolidated-balance-close*
*Completed: 2026-09-18*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all three task commits (`023462d`, `7a9112e`, `e8a18ec`) confirmed present in `git log`.
