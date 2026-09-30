---
phase: 89-item-audit-fixes
plan: 03
subsystem: items
tags: [poplar-staff, pendant, party-heal, source-link, narration, fixtures]
requires:
  - phase: 88
    provides: endSourceEffects, SOURCE_SLOTS and the effect-source link; reconcileItemSources
  - phase: 89-02
    provides: the declared-drift record shape and the ledger conventions
provides:
  - "Poplar Staff: use partyHeal, heals the hero then every living Joiner d20+10 each from one derived stream (partyHeal), dice on ACTIVATION_OF (act.heal)"
  - "engine/items.js#healPartyMember: the one write for a Joiner's heal (fight entry in a fight, sheet outside), reused by 89-05"
  - "partyHealed event with its Oracle line, rail twin and heal clip"
  - "Pendant of Fortitude: armed charge is halfNext = { slot, n }, disarmed by endSourceEffects on take-off, swap, destroy and the sweep (itemEffectEnded kind half), cooldown untouched"
  - "reconcileItemSources links a legacy armed Pendant or quietly disarms it"
affects: [89-04, 89-05, 89-10, phase-92-bot-pass]
tech-stack:
  added: []
  patterns:
    - "a staff's kind resolves from its activation record first, so an old save's item needs no migration"
    - "an armed one-shot charge carries its source like a timer record and ends through the one early-end helper"
key-files:
  created:
    - test/unit/poplar-party-heal.test.js
    - test/unit/pendant-source-link.test.js
    - docs/narrative-pass/why/89-03.json
  modified:
    - content/treasure-tables.js
    - engine/items.js
    - engine/saveState.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/sfx.js
    - tools/lib/tuning-bot.mjs
    - test/unit/bot-tactics.test.js
    - test/unit/item-activation.test.js
    - test/unit/item-effect-ended-lines.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/unit/worn-slots.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/ROLL-LEDGER.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "The Poplar gets its own activation kind partyHeal (not the Healing potion's heal); its dice are activation data so the 89-10 text guard reads one place"
  - "The armed Pendant stays the halfNext field every read already uses, but its value becomes { slot, n } (truthy, so applyFoeDamageToPlayer and conditionsOf are untouched)"
  - "Heal dice go through rollDice on a derived stream, so engine/items.js gains no tagged .d( and the roll-high DRAW_INVENTORY does not move"
  - "partyHealBody (private) is the one place that decides where a member's live hp sits and who counts as living; the event lists only living bodies"
patterns-established:
  - "healPartyMember(state, idx, amount): null for a missing, downed or departed member; else the hp gained after the clamp"
requirements-completed: [ITEM-01, ITEM-06]
status: complete
duration: ~2h
completed: 2026-09-30
---

# Phase 89 Plan 03: The Poplar Staff heals the party; the Pendant disarms when it comes off Summary

**The Poplar Staff heals the hero and every living Joiner d20+10 each from a derived stream (an old save's staff included), and the Pendant of Fortitude's armed half-damage charge is linked to its slot and disarmed the moment the Pendant leaves it.**

## What changed

- `content/treasure-tables.js`: the Poplar row is `use: "partyHeal"`, `act: { kind: "partyHeal", charges: 3, recharge: 60, heal: { n: 1, sides: 20, bonus: 10 } }`, text "heals you and every Joiner with you d20+10 hp each". `buildActivation` copies a frozen `act.heal` on both branches.
- `engine/items.js`:
  - `useItem`'s kind line reads a staff's activation kind first (`it.kind === "staff" ? activationFor(it)?.kind ?? it.use`), so a saved Poplar still saying `use: "heal"` heals the party.
  - New `case "partyHeal"`: hero first, then each index of `state.party` through the exported `healPartyMember`; every die from `derivedRng(cursor, "partyHeal", acts, item name)` via `rollDice`; one `partyHealed { item, heals: [{ name, hero?, amount, gained }] }`. A full body gains 0 and is still listed; a downed or departed Joiner is skipped and draws no die.
  - `case "half"` sets `c.halfNext = { slot: slot || null, n }`.
  - `endSourceEffects` no longer returns early on a sheet with no `timers`; after the timers walk a linked `halfNext` disarms by the same rule (slot touched, or the slot no longer holds the Pendant) with one `itemEffectEnded { kind: "half", ... }` (plus `member` for a Joiner). The Pendant's cooldown record is never touched, so the use stays spent.
- `engine/saveState.js#reconcileItemSources`: a legacy `halfNext: true` links to the first worn Pendant or is quietly disarmed; a malformed charge is disarmed; the quiet sweep also runs on a sheet with no `timers`.
- Narration: `EVENT_NARRATION.partyHealed`, `LINE_FOR.partyHealed` (tone hit, PRIORITY.you, not a card), the `half` clause in both itemEffectEnded tables, and the sfx map (`partyHealed: "heal"`, like `healed`).
- `tools/lib/tuning-bot.mjs#chooseCombatItem`: the wielded Poplar (`partyHeal`) also fires when a live Joiner in the fight is below `potionThreshold`. No bot run (Phase 92).

## Tasks and commits

| Task | Name | Commit |
|------|------|--------|
| 1 | The Poplar Staff heals the whole party, d20+10 each, from a derived stream | `7b0f7a82` |
| 2 | The Pendant of Fortitude's armed charge joins the source link | `c0d7d136` |
| 3 | Narrate the party heal and the disarmed Pendant; measure and declare the drift | `e2789502` |

Tasks 1 and 2 followed test-first order (the new test files failed before the change); each is committed as one `feat` commit with its implementation. The narration assertions in `poplar-party-heal.test.js` were written with task 1 and committed in task 3 with the lines they pin.

## Fixture drift (Poplar, Pendant)

Base `149b3edd`. Measured, not predicted (full record in `test/parity/FIXTURE-INVENTORY.md`, "### Phase 89 plan 03"):

- `node tools/fixture-inventory.mjs --json`: no parity scenario lists a Poplar Staff or a Pendant. `node --test "test/parity/**/*.test.js"`: 66 / 66, zero drift. `test/parity/prototype-master.js.txt` untouched. `test/parity/harness/comparables.js` untouched: no compared object carries `halfNext`, so no carve-out was needed (measured).
- `roll-high-save-compat.test.js`: zero drift. `roll-high-baseline.mjs save` never run.
- Moved, each declared and regenerated alone:
  1. `roll-high-state-pins.test.js` `solo-thief-pilfer`: `400 / false / 4` unchanged; hash `845bfc4c...d3b0` to `5f0056f4...d8ca`. Cause: the run's bag ends holding a Poplar Staff (a Pilfer cannot wield it) and the item object rides the hashed state; its `use` (`heal` to `partyHeal`) and text changed. Proven use/text-only: swapping the old use and text back into the new final state re-hashes to the old pin. Only this label was pasted, by hand, from `node tools/roll-high-baseline.mjs pins` (hashed identically twice). A dated comment carries the declaration.
  2. `worn-slots.test.js` "a wielded staff heals, spends its one charge ...": before the use pushed `healed` (d10+2, main rng, the faked 5); after it pushes `partyHealed` (d20+10, derived stream, the faked rng never drawn) and the hero's hp rises. Charge and recharge bookkeeping byte-identical.
  3. `item-activation.test.js` "useItem on a Pendant of Fortitude ...": before `c.halfNext === true`; after it deep-equals `{ slot: null, n: "Pendant of Fortitude" }` (a bag use on a legacy double; a worn use carries its slot).
- Roll guard: the dice go through `rollDice`, so `engine/items.js` has no new tagged `.d(` and `DRAW_INVENTORY` does not move (rollCheck 1, amount 7, selection 9 before and after). `docs/ROLL-LEDGER.md` carries the new "Phase 89 plan 03" section.
- Narrative ledger: `docs/narrative-pass/why/89-03.json` (3 rows: the Poplar text, `oracle:partyHealed`, `rail:partyHealed`). The corpus's synthetic event carries no `heals`, so the two new lines are ledgered as the corpus renders them (the empty-party fallback) and the why quotes the real per-body line. `node tools/narrative-review.mjs` then `--check` exit 0; `node tools/voice-inventory.mjs --check-ledgers --plan 89-03 --after` clean. `tools/lib/event-variants.mjs` and `corpus-base.json` untouched.

## Verification

- `npm test` (full, final run after the last change): 8,342 tests, 8,340 pass, 0 fail, 2 skipped (base 8,296 / 8,294 / 0 / 2). None of the known CRLF doc-ledger failures appeared. One earlier full run had one failure (the `worn-slots` pin above), fixed and the full suite re-run.
- `git diff --stat -- test/parity/prototype-master.js.txt`: nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pinned `worn-slots.test.js` and `roll-high-state-pins.test.js` `solo-thief-pilfer`**
- **Found during:** Task 3 (full `npm test`, pin measurement)
- **Issue:** neither file is in the plan's files list. The Poplar's new use and text moved one state pin (a bag item rides the hashed state) and one unit pin asserted the old `healed` event.
- **Fix:** each re-recorded alone with a before/after declaration (above and in FIXTURE-INVENTORY.md); the state pin proven text/use-only.
- **Files modified:** `test/unit/worn-slots.test.js`, `test/unit/roll-high-state-pins.test.js`
- **Commit:** `e2789502`

**2. [Rule 2 - Missing coverage] Added a bot read test in `test/unit/bot-tactics.test.js`**
- The bot change (Poplar fires for a hurt Joiner) was not pinned by the plan's files; one test covers healthy, Joiner-hurt and downed-Joiner cases. **Commit:** `7b0f7a82`

Otherwise none: the plan executed as written.

## Notes for the orchestrator

- `docs/ITEM-AUDIT.md` was not edited (its Poplar and Pendant verdicts read "fix engine (89-03)", which `item-audit.test.js` accepts). If the guard plan wants them flipped to "fixed", that is one cell each.
- `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html` are generated; if another plan also adds ledger rows, re-run `node tools/narrative-review.mjs` after the merge.
- The sfx map now lists `partyHealed` beside `healed` (the map did not require it; it is the Poplar's heal and should sound like one).
- Joiner side of the Pendant (a Joiner's own pendant halving its blows) is 89-04; `endSourceEffects` already disarms a Joiner sheet's linked `halfNext` and tags `member`, pinned here with a hand-built sheet. A Joiner using its own items is 89-05 and can reuse `healPartyMember`.

## Known Stubs

None.

## Flagged assumption (spec-less probes)

ITEM-06's two probes stay unresolved by measurement: "an item whose text promises the whole party must never quietly leave a Joiner out" and "taking the Pendant off must never make it ready sooner or hand the armed charge back later" are pinned for the Poplar Staff and the Pendant (and the three edge probes: a full-hp body, invisibility stacking, empty and ordering), but the audit of every other party-promising item is the plan set's, and the balance effect of d20+10 to two bodies is not measured here (bots run once, Phase 92).

## Human verification (deferred to end of run)

1. A Magic User with a Joiner wields a Poplar Staff while both are hurt and uses it: the Oracle and rail name both heals, and the Company panel's HP rises for the Joiner.
2. Use the Pendant of Fortitude, then take it off before any blow lands: the Oracle says the next blow is no longer halved, and the Pendant shows cooling.
3. Use the Pendant and take a hit with it on: the blow is halved as before.

## Self-Check: PASSED

- Files found: test/unit/poplar-party-heal.test.js, test/unit/pendant-source-link.test.js, docs/narrative-pass/why/89-03.json, engine/items.js (healPartyMember, case "partyHeal"), engine/saveState.js.
- Commits found: 7b0f7a82, c0d7d136, e2789502.
- STATE.md, ROADMAP.md and REQUIREMENTS.md not modified.
