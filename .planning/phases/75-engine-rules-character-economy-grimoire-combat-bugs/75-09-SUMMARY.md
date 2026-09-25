---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 09
subsystem: engine-rules
tags: [combat, items, bot, staff, weapon, difficulty-readout]

requires:
  - phase: 75-engine-rules-character-economy-grimoire-combat-bugs
    provides: "75-07 (the staff wield model — weaponRow/wieldedStaff, c.staff, useItem({slot:'weapon'})); its own handoff note: gate the bag-index refusal on wieldedStaff(c) !== it"
provides:
  - "RULES-13 (second half): a bagged staff's power is inert — useItem on a staff reached by bag index is refused useRefused {reason:'notWielded'} before any side effect (no charge, no cooldown, no draw), gated on wieldedStaff(c) !== it; the wielded staff (useItem({slot:'weapon'})) is unaffected"
  - "The notWielded Oracle/rail line beside notWorn, same voice: '<Staff> is in your bag, doing what things in bags do: nothing. Wield it first.'"
  - "Every test that used a bagged staff's power is re-pinned to the wielded form (or to the notWielded refusal), each with a RULES-13 comment"
  - "The bot wields the first bagged staff it carries when none is wielded (out of combat, equipItem), and uses the wielded staff by useItem({slot:'weapon'}) in combat under its existing staffMinFoes/dome/heal rules — never touches a bagged staff"
  - "A 200-seed before/after bot readout measuring the balance effect; zero parity fixtures moved (measured against the plan base)"
affects: [75-11, 75-13]

tech-stack:
  added: []
  patterns:
    - "The refusal ladder gains a rung: refuseIfPending -> wrongClass -> notWielded -> notWorn -> pilfer -> combatOnly -> notDark -> cooldown/recharging — a staff reached by bag index is never the wielded one, checked via wieldedStaff(c) !== it rather than 'addressed by index,' so the check stays correct even if item storage shape ever changes."
    - "The bot's out-of-combat gear loop gains a first-staff-wins equip rule, checked right after the store step and before the field-item/potion/camp checks — the ONE place the bot ever calls equipItem for a staff (loot/find pickups still bag a staff via takeItem, same as any other non-auto-equipping kind)."

key-files:
  created: []
  modified:
    - engine/items.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - docs/USABLE-FEATURES-AUDIT.md
    - test/unit/staff-wield.test.js
    - test/unit/item-activation.test.js
    - test/unit/item-combat-gate.test.js
    - test/unit/item-wiring.test.js
    - test/unit/items.test.js
    - test/unit/usable-features-audit.test.js
    - test/unit/worn-slots.test.js
    - tools/lib/tuning-bot.mjs
    - test/unit/bot-tactics.test.js
    - tools/readouts/75-09-before.txt
    - tools/readouts/75-09-after.txt

key-decisions:
  - "The notWielded gate reads wieldedStaff(c) !== it, not 'this staff was addressed by bag index' — a defensive equivalence per 75-07's own handoff note, so the refusal stays correct by construction even if a future change ever let a wielded staff coexist in c.items."
  - "docs/USABLE-FEATURES-AUDIT.md — not in the plan's files_modified — was updated anyway (Rule 3: a blocking test-correctness fix): its own doc-sync tests require every CASES refusal reason and every staff behavior row to be documented; without the notWielded row and the staff-table/amendment rewrite, three doc-sync tests would fail."
  - "usable-features-audit.test.js gained one NEW CASES row per staff ('bagged, unwielded: refused notWielded') beyond the plan's re-pin instruction, to keep the table-driven audit's own coverage promise (every reason exercised) honest for the newest reason string."

requirements-completed: [RULES-13]

coverage:
  - id: D1
    description: "A bagged staff's power is inert: useItem on a staff reached by bag index is refused notWielded before any side effect (no charge spent, no cooldown, no draw); the wielded staff still works and still spends a charge; a bagged staff still recharges on the squares tick"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-wield.test.js (bag refusal + no-side-effect, Fighter still wrongClass, wielded staff unaffected, bagged recharge, both narration lines — 8 new tests)"
        status: pass
      - kind: unit
        ref: "node --test test/unit/staff-wield.test.js test/unit/roll-high-guard.test.js — 49/49 pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Oracle and rail name the staff and say 'Wield it first.'; every existing test that exercised a bagged staff's power is re-pinned to the wielded form (or to the refusal), each carrying a RULES-13 comment, with none deleted"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "src/browser/eventNarration.js / narrationLines.js useRefused notWielded branch, asserted in test/unit/staff-wield.test.js"
        status: pass
      - kind: unit
        ref: "test/unit/item-activation.test.js, item-combat-gate.test.js, item-wiring.test.js, items.test.js, usable-features-audit.test.js, worn-slots.test.js — every re-pinned test passes; npm test 6122 (plan base) -> 6139, 0 failures"
        status: pass
    human_judgment: false
  - id: D3
    description: "The bot plays the new rule: out of combat a Magic User equips a bagged staff when none is wielded (first-staff-wins); in combat it uses the wielded staff by slot under its existing thresholds and never touches a bagged one; zero parity fixtures moved; a 200-seed before/after readout is committed"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (chooseCombatItem re-pinned to wieldedStaff(c)/{slot:'weapon'} + bagged-never-picked; 3 new decideAction out-of-combat equip cases)"
        status: pass
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (54/54) + git diff --quiet against the plan base for test/parity/fixtures and prototype-master.js.txt (both exit 0 — zero fixtures moved)"
        status: pass
      - kind: other
        ref: "tools/readouts/75-09-before.txt vs -after.txt: mean death depth 7.79 -> 7.51, reach-20 1.5% -> 1.5% (unchanged), per-floor-survival verdict unchanged"
        status: pass
    human_judgment: true
    rationale: "The tune-difficulty readout is an informational proxy, not a pass/fail gate (per its own header) — a human DR round is the real signal for whether the balance shift feels right in play."

duration: 55min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 09: A bagged staff is inert, and the bot wields its own Summary

**A staff's charged power now works only while wielded — a bagged staff is refused `notWielded` before any side effect, every test that relied on bag-use is re-pinned to the wielded form, and the tuning bot equips the first staff it carries and fights with it by slot**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-25T18:20:00-04:00 (approx.)
- **Completed:** 2026-09-25T19:20:00-04:00 (approx.)
- **Tasks:** 3
- **Files modified:** 13 modified, 2 created (readouts)

## Accomplishments

- **Task 1 — a bagged staff is inert, and says so:** `engine/items.js#useItem` gained a `notWielded` rung right after `wrongClass`, before `notWorn`: a staff reached by bag index that is not the currently-wielded one (`wieldedStaff(c) !== it`) is refused before any side effect — no charge spent, no cooldown started, no die drawn (proven with a `fakeRng([])` that would throw on any draw). The wielded staff (`useItem({slot:"weapon"})`) is completely unaffected, and a bagged staff still recharges normally on the squares tick. `src/browser/eventNarration.js` and `narrationLines.js` gained a `notWielded` line beside `notWorn`, same voice: "*Staff* is in your bag, doing what things in bags do: nothing. Wield it first." `test/unit/staff-wield.test.js` gained 8 new tests covering all of the above plus both narration builders.
- **Task 2 — every bag-staff test re-pinned:** Running `npm test` after Task 1 surfaced exactly 26 failures across 6 files — every one a bag-staff use that now gets `notWielded`, confirming Task 1 introduced no other regression. Each was re-pinned to the wielded form (equip the staff first via `c.weapon`/`c.staff`, then address it `{slot:"weapon"}`), with a `RULES-13` comment on every change; nothing was deleted. `docs/USABLE-FEATURES-AUDIT.md` — not in the plan's declared `files_modified` — needed updating too: its own doc-sync tests assert every CASES refusal reason and every staff behavior row appears in the doc, so `notWielded` was added to the §1 refusal vocabulary table and the staff table/"amendment" section was rewritten for the RULES-13 reversal (Rule 3 — a blocking test-correctness fix, not scope creep). `npm test`: 6122 (plan base) → 6139, 0 failures — the count is HIGHER than the base because Task 1 and Task 2 both added new coverage (the notWielded refusal itself, and a new "bagged, unwielded" CASES row per staff in the audit test).
- **Task 3 — the bot wields its staff:** `tools/lib/tuning-bot.mjs`'s `chooseCombatItem` staff tier now reads `wieldedStaff(c)` and dispatches `useItem({slot:"weapon"})` — a bagged staff is never picked in combat at all (proven with a new "bagged is never picked" test). A new out-of-combat step in `decideAction`, checked right after the store step: a Magic User carrying a bagged staff with none currently wielded gets `{type:"equipItem", i:<staffIndex>}` — "first staff wins" (75-CONTEXT.md's flagged assumption): the bot keeps the first staff it finds, never swaps it for a second bagged one, and never swaps it away for a mundane weapon. A non-Magic-User never triggers the equip. `test/unit/bot-tactics.test.js` re-pinned every `chooseCombatItem` staff case to the wielded form and added 3 new `decideAction` cases for the equip step. Parity: `node --test "test/parity/**/*.test.js"` 54/54, and `git diff --quiet` against the plan base for `test/parity/fixtures`/`prototype-master.js.txt` both exit 0 — zero fixtures moved, exactly as predicted (no replay site carries a staff). A 200-seed before/after readout (`tools/readouts/75-09-{before,after}.txt`) shows a small, expected difficulty effect (see below) with the per-floor-survival verdict unchanged.
- Full test suite green throughout: `npm test` 6139/6139; `node --test "test/parity/**/*.test.js"` 54/54.

## Task Commits

Each task was committed atomically:

1. **Task 1: A bagged staff is inert, and says so** — `b9bb8a1` (feat)
2. **Task 2: Re-pin every bag-staff test to the new rule** — `49d2ca6` (test)
3. **Task 3a: The bot wields its staff; measure fixtures** — `fbff054` (feat)
3. **Task 3b: before/after 200-seed readouts** — `73c8dd7` (docs)

**Plan metadata:** this SUMMARY.md's own commit (pending, by the orchestrator's convention)

## Files Created/Modified

- `engine/items.js` — `useItem`'s new `notWielded` refusal rung (gated on `wieldedStaff(c) !== it`); the ladder docstring updated
- `src/browser/eventNarration.js`, `src/browser/narrationLines.js` — the `notWielded` Oracle/rail line beside `notWorn`
- `docs/USABLE-FEATURES-AUDIT.md` — the §1 refusal vocabulary table gains `notWielded`; the staff table/"amendment" section rewritten for the RULES-13 reversal
- `test/unit/staff-wield.test.js` — 8 new tests: bag refusal + no-side-effect, Fighter still `wrongClass`, wielded staff unaffected, bagged recharge, both narration builders
- `test/unit/item-activation.test.js`, `item-combat-gate.test.js`, `item-wiring.test.js`, `items.test.js`, `usable-features-audit.test.js`, `worn-slots.test.js` — every bag-staff-power test re-pinned to the wielded form; one bag-dispatch test re-pinned to assert `notWielded`; 8 new "bagged, unwielded" audit rows
- `tools/lib/tuning-bot.mjs` — `chooseCombatItem`'s staff tier reads `wieldedStaff(c)`/dispatches by slot; `decideAction` gains the out-of-combat equip-a-staff step
- `test/unit/bot-tactics.test.js` — every `chooseCombatItem` staff case re-pinned; 3 new `decideAction` equip-step cases
- `tools/readouts/75-09-before.txt`, `tools/readouts/75-09-after.txt` — the 200-seed bot readouts

## Re-pinned Test Table

| File | Test | Old assertion | New assertion |
|---|---|---|---|
| item-activation.test.js | useItem on a Pine Staff spends its one charge... | bag index `useItem(state, 0, ...)` | wielded `c.weapon`/`c.staff`, `useItem(state, {slot:"weapon"}, ...)` |
| item-activation.test.js | useItem on a Crystal Staff spends a charge... | bag index | wielded, same |
| item-combat-gate.test.js | every TARGETED_KINDS staff refuses combatOnly outside combat | bag index, `items: [staff]` | wielded; "stays carried" bag assertion dropped |
| item-combat-gate.test.js | Oak Staff (aoe default 2) on 2 foes clears the encounter | bag index | wielded |
| item-combat-gate.test.js | a freeze/gas use with no kill leaves combat open | bag index (both staves) | wielded (both staves) |
| item-wiring.test.js | Amulet of Stone petrifies up to 4 foes... (Oak Staff half) | bag index | wielded |
| items.test.js | useItem spends a staff's charge and starts its recharge cooldown | bag index (Rowan Staff) | wielded, `state.c.staff.charges` instead of `state.c.items[0].charges` |
| usable-features-audit.test.js | staff outside combat (MU): [8 staves] | bag index | wielded; +1 new "bagged, unwielded" row per staff asserting `notWielded` |
| usable-features-audit.test.js | staff in combat (MU): [8 staves] | bag index | wielded |
| usable-features-audit.test.js | an empty staff is refused recharging with a positive integer left | bag index | wielded |
| worn-slots.test.js | useItem slot form: a worn staff heals... | the OLD Phase-39-era `worn: {staff}` fixture (a generic slot key that predates RULES-13) | the real wielded form (`c.weapon`/`c.staff`, `{slot:"weapon"}`) |
| worn-slots.test.js | applyAction reaches a BAGGED staff through engine.js's bag-index dispatch | asserted `itemUsed` fired | asserted `useRefused {reason:"notWielded"}` |
| bot-tactics.test.js | chooseCombatItem: a Magic User's bagged targeted staff fires... | bag index | wielded via `wieldedStaff(c)`; +1 new "bagged is never picked" assertion |
| bot-tactics.test.js | chooseCombatItem: a bagged dome/heal staff fires below potionThreshold | bag index | wielded |
| bot-tactics.test.js | chooseCombatItem: a bagged staff is read by index regardless of the worn-slot model | bag index | wielded, resolves via `wieldedStaff(c)` |
| bot-tactics.test.js | chooseCombatItem: a torch/staff/cloak label in ctx.itemBlocked is skipped | bag index | wielded |

New coverage added (not re-pins): `staff-wield.test.js` (8 tests, Task 1); `usable-features-audit.test.js` (8 new "bagged, unwielded" CASES rows, one per staff); `bot-tactics.test.js` (3 new `decideAction` out-of-combat equip cases).

## Readout Headline Lines (before -> after)

```
Death-depth distribution:  min=2 p50=7 p90=13 max=40  ->  min=2 p50=7 p90=12 max=28
Four-band: mean death depth=7.79 -> 7.51; floors gained mean=6.79 -> 6.51; encounters survived mean=16.66 -> 15.90
reach-20: 1.5% -> 1.5% (unchanged)
Per-floor-survival verdict: "all floors 1-12 inside the pass band" -> unchanged
Magic User class row: reach5 65.5%->60.0%  reach10 21.8%->16.0%  reach20 1.8%->0.0%
                       dmgTaken/fight 8.02->7.94  casts(def/off) 237/1444 -> 224/1255
Outcome: 178 dead, 22 stuck  ->  173 dead, 27 stuck
```

A small, expected effect: a Magic User carrying a bagged staff no longer benefits from its power until the bot's own equip step wields it (one action later than an instant bag-use would have been) — well inside the readout's own "informational proxy, not a gate" framing, and the per-floor pass-band verdict is unchanged.

## Decisions Made

- **The `notWielded` gate is `wieldedStaff(c) !== it`, not "addressed by bag index."** Per 75-07's own handoff note: since a wielded staff is structurally never in `c.items` (`carriedItems` keeps it out), "addressed by index" and "not the wielded one" are equivalent TODAY — but gating on the equivalence relation itself, rather than the storage-shape coincidence, keeps the refusal correct by construction if that ever changes.
- **`docs/USABLE-FEATURES-AUDIT.md` was updated even though it isn't in the plan's declared `files_modified`** (Rule 3 — a blocking test-correctness fix): three of its own doc-sync tests (`every distinct refused reason in CASES appears in the doc`, `every STAVES name...`, plus the staff table itself going stale) would otherwise fail or silently drift from the shipped behavior.
- **`usable-features-audit.test.js` gained a new CASES row per staff** ("bagged, unwielded... refused notWielded") beyond the minimum re-pin — the file's own stated purpose is a doc-synced audit of every usable-feature circumstance, and the newest refusal reason belongs in that table just as `notWorn` already is.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] docs/USABLE-FEATURES-AUDIT.md required an update outside the plan's files_modified**
- **Found during:** Task 2, after re-pinning `usable-features-audit.test.js`'s CASES
- **Issue:** the file's own `doc-sync` tests (`every distinct refused reason in CASES appears in the doc`, `every STAVES name...appears in the doc`) would fail once a `notWielded` CASES row existed, and the staff table's "Outside/In combat (MU)" columns plus the "Staff amendment (260918-w4n)" section had gone factually stale (they still described a staff as "not equipable at all").
- **Fix:** added `notWielded` to the §1 refusal vocabulary table; rewrote the staff table to note wielded-vs-bagged behavior and added a "Bagged, unwielded" column; rewrote the "Staff amendment" section to describe the RULES-13 reversal.
- **Files modified:** `docs/USABLE-FEATURES-AUDIT.md`
- **Verification:** `node --test test/unit/usable-features-audit.test.js` — pass (all doc-sync tests green)
- **Committed in:** `49d2ca6`

---

**Total deviations:** 1 auto-fixed (Rule 3 — a documentation update required to keep existing doc-sync tests honest, not scope creep)
**Impact on plan:** No functional change beyond what the plan specified; the fix keeps the doc-sync test suite meaningful.

## Issues Encountered

None beyond the deviation above. The 26 test failures Task 2 found were exactly and only the bag-staff-power tests the plan predicted — no Task 1 bug was uncovered.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- RULES-13 is now fully landed at the engine level (75-07's wield model + this plan's bag-inert half) and the bot plays it correctly in both directions (equip when unwielded, use by slot when wielded, never touch a bagged one).
- Handoff for 75-11 (surfaces): the Gear tab / gear sheet / hero sheet / combat ITEMS list still need to show a bagged staff greyed and a wielded one as EQUIPPED — none of this plan's files touch shell/UI code (per 75-CONTEXT.md's own flagged assumption, "Combat ITEMS is 75-11's" — until then a bagged staff row in combat still dispatches, and the engine now always answers with the `notWielded` line, never silently).
- No new event type was introduced (`useRefused` already existed; only a new `reason` value was added), so no new `EVENT_NARRATION` coverage-guard entry was needed — the existing `useRefused` builder's reason-branch structure absorbed it.

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*
