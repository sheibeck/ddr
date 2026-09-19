---
phase: quick-260918-wy1
plan: 01
subsystem: rules-engine
tags: [vanilla-js, rules-engine, items, worn-slots, jewelry, tolerant-load, tuning-bot, gear-tab]

requires:
  - phase: quick-260918-w4n
    provides: "the five-key WORN_SLOTS (ring/bracelet/amulet/helm/cloak), SLOT_OF 15 entries, use-activated-only items, staff-to-bag"
provides:
  - "engine/derived.js: SLOT_FAMILIES/WORN_KEYS_OF/WORN_FAMILY_OF/freeWornKey — the jewelry family (two keys) and cloak family (one key); WORN_SLOTS is now [jewelry1, jewelry2, cloak]; slotFor returns the family with jewel/cloak kind fallbacks; reconcileWorn reports per family with an array `worn`"
  - "engine/items.js: autoWearSlot/equipItem re-pointed at freeWornKey; equipItem gains an optional targeted-swap key with jewelryFull/wrongSlot refusals"
  - "engine/actions.js + engine/engine.js: validators accept the three worn keys and reject the four legacy names; equipItem.slot forwarded through dispatch"
  - "engine/saveState.js: LEGACY_JEWELRY_KEYS fold in sanitizeWorn — ring/bracelet/amulet/helm migrate into the two jewelry keys in order, spillover to the bag, before the unknown-key strip"
  - "content/treasure-tables.js: all 8 JEWELRY_ROWS authored slot: jewelry; SLOT_OF's 15 entries map to only jewelry/cloak"
  - "Gear tab (viewModels.js#GEAR_COPY/emptySlotRows), combat submenu (combatMenu.js), rail card (rail.js#wornReconcileCard), toasts/Oracle (toasts.js#slotWord, eventNarration.js) all speak jewelry, never a raw key or an old slot name"
  - "mazeworld.html: __mzWornKeysOf bridge, mzEquipItem(i, slot) targeted-swap bridge, the BAG row's multi-choice swap confirm (mkSwapConfirm(i, choices))"
  - "tools/lib/tuning-bot.mjs#readyWornOfKind(state, ctx, kinds) — family-agnostic scan replacing the slot-addressed readyWorn"
affects: [gear-panel, item-activation, combat-menu, rail, toasts, tuning-bot, saves, docs]

tech-stack:
  added: []
  patterns:
    - "Family/key split: slotFor(it) returns a FAMILY (jewelry|cloak); WORN_KEYS_OF maps a family to its concrete worn KEYS (jewelry -> two, cloak -> one); freeWornKey(c, family) is the ONE first-free-key rule every wear/swap/migrate site reads. WORN_SLOTS stays the flat, ordered list of concrete keys — the address space for actions, the worn map, and display order."
    - "readyWornOfKind(state, ctx, kinds, opts) in tools/lib/tuning-bot.mjs — scans WORN_SLOTS itself (family-agnostic), with an opts.skipIfActive flag for the round-1 buff tier's 'keep scanning past an already-live match' rule."

key-files:
  created: []
  modified:
    - content/treasure-tables.js
    - engine/derived.js
    - engine/items.js
    - engine/actions.js
    - engine/engine.js
    - engine/saveState.js
    - src/browser/viewModels.js
    - src/browser/combatMenu.js
    - src/browser/rail.js
    - src/browser/toasts.js
    - src/browser/eventNarration.js
    - mazeworld.html
    - tools/lib/tuning-bot.mjs
    - docs/GEAR-SLOTS.md
    - docs/GEAR-BALANCE.md
    - docs/USABLE-FEATURES-AUDIT.md
    - "~20 test/unit/*.test.js files re-pinned to the three-key jewelry model"

key-decisions:
  - "Worn shape is two flat keys (jewelry1/jewelry2) plus cloak, NOT a two-element array — every existing c.worn[slot] reader (useItem/unequipSlot/wearItem/autoWearSlot/sanitizeWorn/emptySlotRows/wornSlotRow/combatMenu/readyWornOfKind/carriedItems) needed zero shape branching; the action address stays the flat {slot} string every validator/bridge/bot already emits; serialization stays 'key -> item object' (sanitizeWorn's non-null-non-array invariant, delete c.worn[slot] as the one empty convention); the legacy migration is a simple key rename"
  - "toasts.js deviation from the plan's literal instruction: the plan proposed importing WORN_FAMILY_OF from engine/derived.js into toasts.js. That import trips test/unit/toastsCoverage.test.js's standing T-25-23 purity guard, which forbids ANY `engine/` import line in toasts.js (not just an impure one) — a real, pre-existing test, not a hypothetical. Rather than weaken that guard, slotWord() carries its own small local mirror of the same three-entry table (jewelry1/jewelry2 -> jewelry, cloak -> cloak); both tables are pinned by their own test suites so a future drift is caught, not silent."
  - "The round-1 combat buff tier's WORN_SLOTS loop collapsed into a single readyWornOfKind(state, ctx, buffKinds, { skipIfActive: true }) call — the new opts.skipIfActive flag preserves the original 'skip a kind that's already live, keep scanning the other worn keys' behavior now that a hero can carry two independently-live jewelry effects at once"
  - "engine/derived.js#slotFor gains a jewel-kind fallback (kind: 'jewel' -> 'jewelry') mirroring the pre-existing cloak fallback, so a jewel rolled under an unrecognized name still has a home"
  - "docs/GEAR-SLOTS.md, GEAR-BALANCE.md and USABLE-FEATURES-AUDIT.md keep their Phase-37/w4n historical prose (six-slot / five-slot models) intact but each superseded claim now carries a dated 260918-wy1 update note pointing at the new §8 section, rather than rewriting history in place"

requirements-completed: [QUICK-260918-wy1]

coverage:
  - id: D1
    description: "The worn map has exactly three keys (jewelry1, jewelry2, cloak); slotFor returns a slot FAMILY (jewelry for all 8 JEWELRY rows and any kind:jewel item, cloak for CLOAKS rows); WORN_KEYS_OF maps jewelry -> [jewelry1, jewelry2] and cloak -> [cloak]; freeWornKey(c, family) is the one first-free-key rule read by autoWearSlot/equipItem/reconcileWorn/sanitizeWorn"
    requirement: "QUICK-260918-wy1"
    verification:
      - kind: unit
        ref: "test/unit/worn-model.test.js (WORN_SLOTS/SLOT_FAMILIES/WORN_KEYS_OF/WORN_FAMILY_OF/freeWornKey/slotFor pins), test/unit/content-tables.test.js (SLOT_OF 15-entry pin)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Any two of the 8 jewelry pieces can be worn at once, including two of the same former sub-kind — equipItem/takeItem/takeFind/takeLoot wear the first into jewelry1 and the second into jewelry2 (the same object, never a copy); a cloak is unchanged (one slot, direct swap)"
    requirement: "QUICK-260918-wy1"
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js (two-of-a-kind sequences via takeItem/takeFind/takeLoot), test/unit/bot-tactics.test.js (bot two-jewel wear + third-stows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A third piece never wears silently: untargeted equipItem with both jewelry keys occupied pushes equipRejected{reason:jewelryFull} and moves nothing; a targeted equipItem(i, slot) swaps exactly that key (displaced piece drops into the bag); a target outside the item's family pushes equipRejected{reason:wrongSlot}; the Gear BAG row offers Equip when free, a two-choice swap confirm when both jewelry keys are full"
    requirement: "QUICK-260918-wy1"
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js (jewelryFull/targeted-swap/wrongSlot ladder, applyAction dispatch pin), test/unit/actions.test.js + engine/actions.js validator pins, test/unit/shell-worn-slots.test.js (mkSwapConfirm/mzEquipItem source pins)"
        status: pass
      - kind: manual_procedural
        ref: "Human verification checklist steps 2-3 below"
        status: unknown
    human_judgment: true
    rationale: "The two-choice swap confirm's rendered labels/tap targets need an on-device look, per the deferred-UAT protocol — the source-assertion tests prove the code path but not the rendered result"
  - id: D4
    description: "Old saves load with no dual path: every load folds the four legacy jewelry keys (ring, bracelet, amulet, helm, in that order) into the first free jewelry key each, spillover to the bag, running before the unknown-key strip; reconcileWorn on a save with no c.worn wears the first two jewelry pieces in bag order and reports the rest as bagged, one entry per family"
    requirement: "QUICK-260918-wy1"
    verification:
      - kind: unit
        ref: "test/unit/worn-migration.test.js (LEGACY_JEWELRY_KEYS fold cases: full fold, already-two-worn, w4n-interim shape, bag-at-cap overflow, tampered value dropped — both validateSave and rehydrate), test/unit/engineAdapter.test.js (boot()-level two-ring and three-ring migration)"
        status: pass
      - kind: manual_procedural
        ref: "Human verification checklist steps 6 below"
        status: unknown
    human_judgment: true
    rationale: "A real v1.5/pre-worn-model save loading correctly on-device (rail card wording, no lost items) needs an on-device look per the deferred-UAT protocol"
  - id: D5
    description: "The rules engine stays serializable and UI-free: c.worn is a flat key -> item-object map (no arrays, no nulls); every action address is the flat {slot} form or {i, slot?}; the old slot names are rejected by validateAction; parity fixtures stay drift-free and the master hash is unchanged"
    requirement: "QUICK-260918-wy1"
    verification:
      - kind: other
        ref: "npm test (3237/3237, # fail 0); git diff --quiet on test/parity/fixtures + FIXTURE-INVENTORY.md (drift-free); git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (unchanged); npm run build:www (exit 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Gear tab ON YOU lists one row per worn piece in WORN_SLOTS order and one in-voice empty row per free key (three empties on a bare hero); the combat ITEMS submenu lists both worn jewels; the rail reconciliation card counts pieces of jewelry; itemEquipped/itemUnequipped narration says jewelry, never a raw key; the tuning bot uses a ready worn item from EITHER jewelry key and auto-wears up to two pieces"
    requirement: "QUICK-260918-wy1"
    verification:
      - kind: unit
        ref: "test/unit/gear-panels.test.js, test/unit/combatMenu.test.js, test/unit/rail.test.js, test/unit/toastTable.test.js, test/unit/tuning-bot.test.js, test/unit/bot-tactics.test.js"
        status: pass
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=30 --json (30-seed smoke, no throw)"
        status: pass
      - kind: manual_procedural
        ref: "Human verification checklist steps 1-8 below"
        status: unknown
    human_judgment: true
    rationale: "Button visibility, in-voice copy and toast wording on a real device screen need an on-device look, per the deferred-UAT protocol — the source-assertion tests prove the code path but not the rendered result"

duration: extensive (single autonomous session, 2 tasks + gate)
completed: 2026-09-19
status: complete
---

# Quick Task 260918-wy1: Jewelry — Two Jewelry Slots Replace Ring/Bracelet/Amulet/Helm — Summary

**The four former jewelry worn slots (ring/bracelet/amulet/helm) collapse into ONE family, `jewelry`, holding up to two pieces at once (any combination, including two of a kind); the cloak keeps its single slot — three-key `WORN_SLOTS`, first-free-key wear rule, targeted-swap `equipItem`, and a load-bearing legacy-key fold, with every shell/bot surface re-pointed and zero fixture drift.**

## User ruling, verbatim (2026-09-18)

> "We should not have ring/bracelet/amulet as separate equipment slots. We should have jewelry as a slot. Let's allow us to slot up to 2 pieces of jewelry: any combination of rings, bracelets, amulets, and helms."

This task is a delta on top of quick 260918-w4n's end state (the five-key `WORN_SLOTS`, use-activated-only items, staff-to-bag), which had already landed on master (commit `6e3c672`) before this task started.

## Performance

- **Tasks:** 3 (engine, shell/bot/docs, gate)
- **Files modified:** 31 (6 engine/content, 6 shell/bot, 3 docs, ~20 test files)

## The worn-shape decision

**Two flat keys (`jewelry1`, `jewelry2`) plus `cloak` — not an array.** `c.worn = { jewelry1?, jewelry2?, cloak? }`; `WORN_SLOTS = ["jewelry1", "jewelry2", "cloak"]` stays the ordered list of concrete KEYS (the address space for actions, the worn map, and display/report order). The "jewelry" FAMILY exists only in `slotFor` (which now returns a family), a frozen key table `WORN_KEYS_OF = { jewelry: ["jewelry1", "jewelry2"], cloak: ["cloak"] }`, its inverse `WORN_FAMILY_OF`, `SLOT_FAMILIES = ["jewelry", "cloak"]`, and one helper `freeWornKey(c, family)`.

Four reasons this beat an array:

1. Every reader `c.worn[slot]` already used (`useItem`/`unequipSlot`/`wearItem`/`autoWearSlot`/`sanitizeWorn`/`emptySlotRows`/`wornSlotRow`/`combatMenu`/`readyWornOfKind`/`carriedItems` via `Object.values`) kept working with zero shape branching.
2. The action address stays the flat `{ slot }` string the validators, shell bridges, combat submenu dispatch and bot already emit — no new `idx` field, no `{ slot, idx }` arity through `engine/actions.js`.
3. Serialization stays "key -> item object": `sanitizeWorn`'s invariant that every worn value is a non-null non-array object survives; `delete c.worn[slot]` stays the one empty-slot convention.
4. The legacy migration is a key rename into the first free jewelry key.

## The family/key vocabulary (engine/derived.js)

- `SLOT_FAMILIES = ["jewelry", "cloak"]`
- `WORN_KEYS_OF = { jewelry: ["jewelry1", "jewelry2"], cloak: ["cloak"] }` (frozen, inner arrays frozen)
- `WORN_FAMILY_OF = { jewelry1: "jewelry", jewelry2: "jewelry", cloak: "cloak" }`
- `WORN_SLOTS = ["jewelry1", "jewelry2", "cloak"]` (the literal, pinned equal to `SLOT_FAMILIES.flatMap(f => WORN_KEYS_OF[f])`)
- `slotFor(it)` returns the FAMILY: `it.slot` string first, else `SLOT_OF[it.n]`, else kind fallbacks (`jewel` -> `jewelry`, new; `cloak` -> `cloak`, pre-existing), else `null`
- `freeWornKey(c, family)`: the first key of the family with no worn item, or `null` when full — the ONE rule `autoWearSlot`/`equipItem`/`reconcileWorn`/`sanitizeWorn`'s legacy fold all read

## The third-piece rule

- Untargeted `equipItem(i)` with both jewelry keys occupied -> `equipRejected { item, reason: "jewelryFull" }`, nothing moves.
- Targeted `equipItem(i, events, target)` — the action gains an OPTIONAL `slot` field, validated against `WORN_SLOTS` — swaps with exactly that key: the displaced piece drops into the bag, the new piece wears, event carries `replaced`.
- A target outside the item's family (e.g. `cloak` on a jewel) -> `equipRejected { reason: "wrongSlot" }`.
- The cloak's single-key family keeps its existing untargeted direct-swap behavior, byte-identical.
- Shell: the Gear BAG row shows Equip while a jewelry key is free; when both are full it shows a two-choice swap confirm — one button per worn piece (its own name) plus No — each dispatching the targeted `mzEquipItem(i, key)`.

## The legacy fold (tolerant load, no gating)

`engine/saveState.js#sanitizeWorn` gained `LEGACY_JEWELRY_KEYS = ["ring", "bracelet", "amulet", "helm"]` (fold order). Each legacy key holding a genuine object moves to `freeWornKey(c, "jewelry")`, or — when both jewelry keys are already taken — is appended to `c.items` (the same spillover-to-bag shape as w4n's staff fold), then the legacy key is deleted. **Order is load-bearing:** this fold runs AFTER the staff fold but BEFORE the generic "delete any key not in `WORN_SLOTS`" strip — reversing the order would delete the legacy pieces instead of migrating them. `clampCarry(c)` runs immediately after, so an over-cap bag drops the appended overflow exactly like any other item.

`reconcileWorn(c)` (the option-gated bag-scan migration for a save with no `c.worn` at all) now wears by `freeWornKey` and reports PER FAMILY: `{ slot: family, worn: [names], bagged: [names] }` — `worn` is now an ARRAY (one or two names for jewelry). The rail card's count is `worn.length + bagged.length`.

## Surfaces re-pointed

| Surface | Change |
|---|---|
| `content/treasure-tables.js` | all 8 JEWELRY_ROWS author `slot: "jewelry"`; `SLOT_OF`'s 15 entries map to only jewelry/cloak |
| `engine/items.js` | `autoWearSlot`/`equipItem` re-pointed at `freeWornKey`; equipItem's cloak/jewel branch gains the target/jewelryFull/wrongSlot ladder |
| `engine/actions.js`/`engine.js` | validators accept the three worn keys, reject the four legacy names; `equipItem.slot` optional, forwarded through dispatch |
| `src/browser/viewModels.js` | `GEAR_COPY.empty` has exactly `armor`/`jewelry1`/`jewelry2`/`cloak`, each in voice |
| `src/browser/combatMenu.js` | worn rows (already generic over `WORN_SLOTS`) — both jewelry keys list as their own `worn-jewelry1`/`worn-jewelry2` rows |
| `src/browser/rail.js` | `RAIL_COPY.wornReconciled.what` is exactly `{ jewelry, cloak }`; count sums `worn.length + bagged.length` |
| `src/browser/toasts.js` | `jewelryFull`/`wrongSlot` refusal copy; new `slotWord()` renders "(jewelry)" for either jewelry key |
| `src/browser/eventNarration.js` | `itemEquipped`/`itemUnequipped` route the slot through `slotWord`; `equipRejected` gains jewelryFull/wrongSlot clauses |
| `mazeworld.html` | `__mzWornKeysOf` bridge; `mzEquipItem(i, slot)` targeted-swap bridge; `mkSwapConfirm(i, choices)` generalized to a multi-choice confirm |
| `tools/lib/tuning-bot.mjs` | `readyWornOfKind(state, ctx, kinds, opts)` replaces the slot-addressed `readyWorn` at every call site (glow/knit/tongue/fly/round-1 buff) |
| docs | `GEAR-SLOTS.md` §8 (new), `GEAR-BALANCE.md`, `USABLE-FEATURES-AUDIT.md` — dated update notes on every superseded historical claim |

## Task Commits

1. **Task 1: Engine + content + tolerant load — the jewelry family, two keys, first-free-key rule, targeted swap, legacy fold** — `3b959b3` (feat)
2. **Task 2: Gear tab, combat submenu, rail/toast/narration copy, tuning bot, docs** — `c49dd34` (feat)
3. **Task 3: Full gate, build, SUMMARY** — this commit's docs-only metadata (SUMMARY/STATE, handled by the orchestrator per the executor's constraints — not committed by this agent)

## Gate Results

- `npm test`: **3237/3237 pass, # fail 0**
- `npm run build:www`: exit 0
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (**unchanged**)
- `git diff --quiet -- test/parity/fixtures test/parity/FIXTURE-INVENTORY.md`: clean — **zero fixture drift** (equip/wear paths draw nothing, exactly as the plan predicted)
- `node tools/tune-difficulty.mjs --seeds=30 --json`: completes without throwing

## Files Created/Modified

**Content/engine:** `content/treasure-tables.js`, `engine/derived.js`, `engine/items.js`, `engine/actions.js`, `engine/engine.js`, `engine/saveState.js`

**Shell/bot:** `src/browser/viewModels.js`, `src/browser/combatMenu.js`, `src/browser/rail.js`, `src/browser/toasts.js`, `src/browser/eventNarration.js`, `mazeworld.html`, `tools/lib/tuning-bot.mjs`

**Docs:** `docs/GEAR-SLOTS.md`, `docs/GEAR-BALANCE.md`, `docs/USABLE-FEATURES-AUDIT.md`

**Tests (Task 1):** `content-tables`, `worn-model`, `worn-slots`, `worn-migration`, `item-wiring` (re-pinned within the plan's own file list; `save-validation`/`actions`/`inventory-actions`/`bag-cap-gate` needed no changes — already generic or unrelated to the jewelry keys)

**Tests (Task 2):** `itemRowState`, `combatMenu`, `gear-panels`, `shell-worn-slots`, `shell-gear-39`, `rail`, `engineAdapter`, `toastTable`, `tuning-bot`, `bot-tactics`

**Tests (collateral, not in the plan's file list — see Deviations):** `shell-loot-screen.test.js`, `shell-toast-wiring.test.js`

## Decisions Made

See `key-decisions` in the frontmatter above for the four load-bearing calls (the flat two-key worn shape and its four reasons, the toasts.js purity-guard deviation, the round-1 buff loop's `skipIfActive` generalization, and the docs' dated-annotation-over-rewrite approach).

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — bug/behavior directly caused by this task's changes)

**1. [Rule 1] `src/browser/toasts.js` cannot import from `engine/` — a real, standing purity guard, not a hypothetical**

The plan's Task 2 action text proposed: "import `WORN_FAMILY_OF` from `../../engine/derived.js`" into `toasts.js`, reasoning "no cycle: derived.js imports content only." This is true as far as it goes, but `test/unit/toastsCoverage.test.js`'s `T-25-23` purity tripwire greps `toasts.js` for the literal pattern `from\s+["'][^"']*engine\//` and fails on ANY match — it does not care whether the import is cycle-free or side-effect-free, only whether the file contains an `engine/` import line at all. Importing `WORN_FAMILY_OF` tripped this test immediately.

- **Found during:** Task 2, first `toastTable.test.js`/`toastsCoverage.test.js` run after adding the import
- **Fix:** `slotWord()` carries its own local `SLOT_FAMILY_WORD` mirror of the same three-entry table (`{ jewelry1: "jewelry", jewelry2: "jewelry", cloak: "cloak" }`), duplicated on purpose; both `engine/derived.js#WORN_FAMILY_OF` and this local copy are pinned by their own test suites (`test/unit/worn-model.test.js` and `test/unit/toastTable.test.js` respectively) against the same three literal keys, so a future divergence fails a test rather than drifting silently
- **Files modified:** `src/browser/toasts.js` (header comment amended to record the deviation inline)
- **Verification:** `test/unit/toastsCoverage.test.js`'s purity guard passes; `npm test` 3237/3237, 0 fail
- **Committed in:** `c49dd34` (Task 2)

**2. [Rule 1] Two collateral test files outside the plan's declared file list broke and were re-pinned**

`test/unit/shell-loot-screen.test.js` and `test/unit/shell-toast-wiring.test.js` were not named in either task's `<files>` list. Both source-assert against a literal string in `mazeworld.html` (the `derived.js` import line and the old-shape `window.mzEquipItem = (i) => ...` bridge respectively) that this task's engine-file-list changes and the `mzEquipItem` targeted-swap signature genuinely moved.

- **Found during:** Task 3's full-suite gate run (`npm test`)
- **Fix:** re-pinned both literal-string assertions to the new import line (`..., WORN_KEYS_OF, ...`) and the new two-arg `mzEquipItem` bridge signature
- **Files modified:** `test/unit/shell-loot-screen.test.js`, `test/unit/shell-toast-wiring.test.js`
- **Verification:** `npm test` 3237/3237, 0 fail
- **Committed in:** `c49dd34` (Task 2, folded in before the Task 2 commit since both broke during that task's own work)

---

**Total deviations:** 2 auto-fixed categories (both Rule 1 — a genuine test-guard conflict and collateral test breakage, both surfacing in files/constraints the plan's own text did not fully anticipate).
**Impact on plan:** No scope creep — the toasts.js fix achieves the plan's own stated intent (one source of truth, pinned against drift) through a locally-duplicated-but-tested table instead of a literal cross-module import; the collateral test fixes are straight re-pins proving the same new rule the plan specifies.

## Issues Encountered

None beyond the deviations above (all resolved within the auto-fix budget).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Code-complete, full gate green (3237/3237, 0 fail), zero fixture drift, frozen prototype master untouched. This was the second of three quick tasks gating v1.6 Phase 44 (per `.planning/STATE.md`'s sequencing gate) — `260918-w4n` landed first, this task (`260918-wy1`) lands second; `260919-00d` (Cloak of Ether wall-walking) remains before Phase 44 can start. The eight-step browser sanity checklist below is ready to fold into the next batched Pixel 7 UAT round (per the deferred-UAT protocol — no device pause here).

## Human verification

Executed as part of the next batched Pixel 7 device round (debug APK built from this commit or later):

1. Serve the repo root over http (`npx serve .`), open `mazeworld.html`, start a new run: Hero -> Gear ON YOU shows, under WORN, the armor row/empty, then "jewelry — nothing…" twice and "cloak — nothing…" once — no ring/bracelet/amulet/helm rows anywhere.
2. Acquire two jewelry pieces (e.g. Bracelet of Flight + Anklet of Invisibility, via finds or the store): both auto-wear on take ("Equipped: … (jewelry)"), both appear as worn rows with Use + Unequip, and both Use taps work (flight chip / unseen chip).
3. Acquire a third jewel: "Received: …" and it sits in the BAG with an Equip button; tap Equip -> "Swap for which?" with one button per worn piece plus No; pick one -> that piece is now in the bag and the new one is worn, the other jewelry row untouched; the toast reads "(jewelry)".
4. Unequip on either jewelry row stows exactly that piece; the empty row reappears in voice.
5. In a fight, the ITEMS submenu lists both worn jewels and the cloak; Use from the submenu works from either.
6. Load a v1.5 save wearing a ring, an amulet and a helm: the ring and amulet are worn (two jewelry rows), the helm is in the BAG, nothing is lost, no rail card (the fold is silent — nothing was bagged as spillover). Load a pre-worn-model save (1.4.0 era) carrying three jewels: two worn, one bagged, and the rail card says "You were wearing three pieces of jewelry…".
7. A Thief's starting cloak still wears into the cloak row and its Use button still works.
8. No console errors across all of the above.

## Self-Check: PASSED

Both task commits (`3b959b3`, `c49dd34`) verified present in `git log`; spot-checked file existence for `content/treasure-tables.js`, `engine/derived.js`, `engine/items.js`, `engine/saveState.js`, `src/browser/viewModels.js`, `src/browser/toasts.js`, `mazeworld.html`, `tools/lib/tuning-bot.mjs`, `docs/GEAR-SLOTS.md` — all present on disk.

---
*Phase: quick-260918-wy1*
*Completed: 2026-09-19*
