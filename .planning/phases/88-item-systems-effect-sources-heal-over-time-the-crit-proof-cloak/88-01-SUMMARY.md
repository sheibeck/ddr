---
phase: 88-item-systems-effect-sources-heal-over-time-the-crit-proof-cloak
plan: 01
subsystem: engine
tags: [items, timers, effect-source, narration, ITEM-02]
requires:
  - phase: 87
    provides: "the Joiner sheet paths (PARTY-11) the helper is pinned on"
provides:
  - "src { slot, n } on every timer record started from a source slot (jewelry1, jewelry2, cloak, weapon)"
  - "engine/items.js#endSourceEffects, the one early-end helper every gear-change path calls"
  - "engine/effects.js#endEffectEarly (the spent use: left + cd, or the record removed when it has no cd)"
  - "engine/derived.js SOURCE_SLOTS, sourceSlotItem, effectSourceOf"
  - "the itemEffectEnded event, narrated on the Oracle and the rail"
affects: [88-02, 88-03, 88-04, 89]
tech-stack:
  added: []
  patterns:
    - "one helper ends a linked effect for every gear change (slots touched, plus a sweep for a slot that no longer holds src.n)"
    - "the natural effect-to-cooldown flip drops consumer fields, so a cooling record keeps the pre-link shape"
key-files:
  created:
    - test/unit/item-effect-source.test.js
    - test/unit/item-effect-ended-lines.test.js
    - docs/narrative-pass/why/88-01.json
  modified:
    - engine/effects.js
    - engine/derived.js
    - engine/items.js
    - engine/economy.js
    - engine/engine.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/item-activation.test.js
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - docs/GEAR-BALANCE.md
    - test/parity/FIXTURE-INVENTORY.md
key-decisions:
  - "Source shape src { slot, n } on the timer record; stamped only when the use came through a source slot and the item is not used up on use (potions, one-use items, tools carry no src)."
  - "The weapon slot is a source slot (user, 2026-09-30): a wielded Crystal Staff's party invisibility ends when the staff leaves the weapon slot. A staff has no cooldown, so its record is removed and the charge it cost stays spent; the charges: record is never touched."
  - "Drop and sell only address bag rows, so a slotted item reaches them through the take-off; both still run the helper's sweep, so the one-mechanism rule holds by construction."
  - "The Cloak of Ether ending in rock entombs the hero through movement.js#resolveEtherEnd (itemEffectEnded, entombed, died), with no refusal and no warning."
requirements-completed: []
duration: ~22 min (tasks), plus the close-out after the session restart
completed: 2026-09-30
status: complete
---

# Phase 88 Plan 01: item effects end when the item comes off (ITEM-02 core) Summary

**Every timed effect started from a worn slot (the 12 linked cloaks and jewelry) or from a wielded Crystal Staff now carries `src: { slot, n }`, and one helper, `engine/items.js#endSourceEffects`, ends it the moment the item leaves its slot: take off, unwield, swap (an identical copy included), drop, sell or a Pilfer fumble. The use stays spent, the Cloak of Ether in rock entombs, and each early end prints one Oracle line and one rail line naming the item and what stops.**

ITEM-02 stays open in REQUIREMENTS.md until 88-02 lands the save/load half (the effect still knows its item after a relaunch).

## Performance

- **Started:** 2026-09-30T10:11:28-04:00 (`690c90c0`, phase execution start)
- **Tasks completed:** 2026-09-30T10:33:02-04:00 (`2647b37f`)
- **Closed out:** 2026-09-30, after a session restart. The executor stopped before it wrote this SUMMARY; the orchestrator re-ran the full suite on HEAD and checked every acceptance criterion before writing it.
- **Tasks:** 3 of 3
- **Files:** 15 (3 created, 12 modified)

## Accomplishments

- **The link.** `applyActivation(state, it, rng, events, slot)` stamps `src { slot, n }` when the use came through one of `SOURCE_SLOTS` (`jewelry1`, `jewelry2`, `cloak`, `weapon`) and the item is not used up on use. `useItem` passes its resolved slot, so a wielded Crystal Staff (`{ slot: "weapon" }`) is linked. Potions, the Torch and bag uses carry no `src`.
- **The one helper.** `endSourceEffects(state, sheet, events, { slots, why, rng, now, quiet })` ends every live linked record whose slot this change touched, or whose slot no longer holds an item named `src.n` (the sweep). It is called by `wearItem`, `unequipSlot` (the weapon slot included), `equipItem`'s weapon, staff and cloak/jewel branches, `takeItem`'s weapon branch, `takeLoot`'s equip weapon and staff branches, `dropItem`, the Pilfer fumble branch and `economy.js#sellItem` (12 call sites in items.js counting the definition, 1 in economy.js). A refused change (bag full, combat gear lock) ends nothing.
- **The spent use.** `engine/effects.js#endEffectEarly` turns a record with a cooldown into a cooldown of (squares left + `cd`), so the item is ready exactly when it would have been; a record with no `cd` (the charged staff) is removed. The natural flip in `tick()` now drops every non-timer field, so a cooling record is byte-identical to the pre-link shape.
- **Ether and flight.** An ended Ether effect on the hero goes through `resolveEtherEnd` (entombed in rock, harmless out of it). An early flight end moves nobody and rolls nothing.
- **Any sheet.** On a Joiner sheet the event carries `member` and nothing entombs. `engine.js#applyAction` hands the main rng to `unequipSlot`/`equipItem`; only an entombment's epitaph pick draws from it.
- **Narration.** `itemEffectEnded { item, kind, slot, why, left, ready, party?, member? }`: a lead per `why` (off, swap, destroyed, gone), a what-stops clause per kind (fly, ether, critWard, invis, unseen, haste, plate, power, giant, glow, tongue; the Crystal Staff says the whole party is seen again), and a ready clause when `ready` is positive. Rail twin in `narrationLines.js`, not a card event. Ledger rows in `docs/narrative-pass/why/88-01.json`; the review pages regenerated (`node tools/narrative-review.mjs --check`: in sync).

## Task Commits

1. **Task 1: stamp each slotted effect with its source and end it through one helper** — `090f8a4e` (feat)
2. **Task 2: narrate the ended effect on the Oracle and the rail** — `1ad0c821` (feat)
3. **Task 3: measure, declare and regenerate only what moved; record the link in the gear ledger** — `2647b37f` (docs)

## Fixture drift (ITEM-02 link)

Measured against the plan base `690c90c0` and recorded in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 88 plan 01: item effects end when the item comes off (ITEM-02)"):

- `node tools/fixture-inventory.mjs --json`: byte-identical to the base.
- Parity: **66 / 66 pass**, no carve-out, no declared divergence. `test/parity/prototype-master.js.txt` and `test/parity/harness/comparables.js` untouched.
- State pins (`roll-high-state-pins.test.js`): every label byte-identical. Save-compat (`roll-high-save-compat.test.js`): `expected.hash` unchanged.
- **Moved (unit pins only, declared):**

| Pin | Before | After | Cause |
|---|---|---|---|
| `item-activation.test.js`, Crystal Staff use | `{ cadence: "squares", left: 15, phase: "effect" }` | the same plus `src: { slot: "weapon", n: "Crystal Staff" }` | the weapon slot is a source slot; the use stamps its record |
| `item-activation.test.js`, Cloak of Speed use | `{ cadence, left: 50, cd: 50, phase }` | the same plus `src: { slot: "cloak", n: "Cloak of Speed" }` | a worn use is linked to its slot |

No fixture, state pin, save or golden was re-recorded.

## Deviations from Plan

- **One extra declared pin move.** The plan named only the Crystal Staff use pin in `item-activation.test.js`; the Cloak of Speed use pin in the same file also gains `src` (a worn use is linked). Same cause as the planned move, declared in the table above and in FIXTURE-INVENTORY.md.
- **Close-out by the orchestrator.** The executor committed all three tasks and stopped (session restart) before this SUMMARY. Nothing in the tree was left uncommitted (`git status` clean at `9f99c958`).

## Tests

- New: `test/unit/item-effect-source.test.js` (37 tests: link, every gear path, the spent use, the Crystal Staff party-wide read stopping, Ether, flight, refusals, the Joiner sheet, the adjacency, empty, ordering and idempotency edges, the flip) and `test/unit/item-effect-ended-lines.test.js` (8 tests): 45 / 45 pass.
- Full `npm test` on HEAD `9f99c958`: **8,217 tests, 8,215 pass, 0 fail, 2 skipped** (base 8,172 / 8,170; +45 new).
- Acceptance greps: `endSourceEffects(` ×12 in items.js and ×1 in economy.js; `resolveEtherEnd(` in items.js; `unequipSlot(next, action.slot, events, rng)` in engine.js; effects.js still has zero imports; no diff in `prototype-master.js.txt`, `tools/lib/event-variants.mjs` or `docs/narrative-pass/corpus-base.json`.

## Findings for Phase 89

For the ITEM-01 / ITEM-06 audit (not built here; both are in `.planning/notes/v2.3-item-audit-findings.md`):

1. **Pendant of Fortitude.** `use: "half"` sets `c.halfNext = true` on the character, not a timed record, so the armed half-damage survives taking the pendant off. The source link does not cover it.
2. **Joiners cannot use their items.** Only the hero's `useItem` starts an effect. The link and `endSourceEffects` already work on a Joiner sheet, so Joiner item use (ITEM-07, user ruling 2026-09-30) is covered by the end rule once it exists.

## Known Stubs

None.

## Threat Flags

None.

## Human verification (deferred to end of run)

- [ ] Wear a Cloak of Flying, use it, take it off: the Flying chip goes, the Oracle and rail say the flying stops, and the cloak shows cooling for the squares left plus 50.
- [ ] With the Cloak of Ether live, walk into rock and take the cloak off: the hero is entombed.
- [ ] Use a Ring of Power worn in the first jewelry slot, then equip another piece into the second slot: the Empowered chip stays.
- [ ] A Magic User wields the Crystal Staff, uses it, then unwields it: the Invisible chip goes, the Oracle says the party is seen again, and the staff's charges are unchanged.

## Self-Check: PASSED

- Commits `090f8a4e`, `1ad0c821`, `2647b37f` exist; the three new files exist; every acceptance grep and `narrative-review --check` pass; full suite green on HEAD.
