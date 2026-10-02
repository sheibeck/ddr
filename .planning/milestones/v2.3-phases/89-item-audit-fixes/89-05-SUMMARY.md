---
phase: 89-item-audit-fixes
plan: 05
subsystem: items
tags: [joiner, items, potion, worn-gear, heal-over-time, derived-rng, narration, fixtures, q2-q3-rulings]
requires:
  - phase: 89-01
    provides: the audit rulings Q2 and Q3 (docs/ITEM-AUDIT.md "## Rulings")
  - phase: 89-03
    provides: healPartyMember (the one write for a Joiner's heal), the Pendant's linked halfNext
  - phase: 89-04
    provides: the Joiner's damage pipeline and the additive `member` event pattern
  - phase: 88
    provides: endSourceEffects and the `src` effect-source link (works on any sheet)
provides:
  - "engine/items.js: memberUseItem, memberUseWorn, memberDrinkPotion, MEMBER_LEADER_KINDS; applyActivation, narrateTimerTransitions and tickHealOverTime take an optional sheet"
  - "the memberUseItem action ({ i, potion: true } / { i, slot }) with named refusals"
  - "a Joiner joins dressed (joinerJoined.wore), a saved Joiner is dressed on load, and every Joiner's item timers and heal-over-time tick on every step"
  - "Q2 = A and Q3 = A built as ruled"
  - "the new engine event memberPotionDrunk, and the additive `member` field on itemUsed, itemEffectStarted, itemEffectFaded, itemCooled, healTick, useRefused, pilferFumbled"
affects: [89-06, 89-07, 89-08, phase-91, phase-92-bot-pass]
tech-stack:
  added: []
  patterns:
    - "the Joiner twin of a hero item path, sharing the same internal functions through an optional trailing `sheet` parameter that defaults to the hero, events tagged with the additive `member` field"
key-files:
  created:
    - test/unit/joiner-item-use.test.js
    - test/unit/joiner-item-lines.test.js
    - docs/narrative-pass/why/89-05.json
  modified:
    - engine/items.js
    - engine/actions.js
    - engine/engine.js
    - engine/encounters.js
    - engine/movement.js
    - engine/saveState.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/sfx.js
    - docs/ROLL-LEDGER.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/fixtures/roll-high/pre-switch-save.json
    - test/unit/roll-high-state-pins.test.js
    - test/unit/roll-high-save-compat.test.js
    - test/unit/roll-high-guard.test.js
    - test/unit/joiner-acquisition.test.js
    - test/unit/party-model.test.js
    - test/unit/map-until-move.test.js
    - test/unit/combat-gear-lock.test.js
    - test/persistence/resume-mid-encounter.test.js
key-decisions:
  - "A Joiner's hero-shared internals take an optional trailing `sheet` (default: the hero), so every hero call is byte-identical and there is one code path"
  - "The hero's and the Joiner's Pilfer fumble share one module-private roll (rollPilferFumble), so neither adds a rollCheck or `.d(` count"
  - "Q2 = A: MEMBER_LEADER_KINDS = fly, ether, glow, tongue, stone (the six named items); the refusal is leaderOnly, checked before combatOnly and cooldown, with no draw"
  - "Q3 = A: candidates are the spells the sub can learn (grantableAt) that are also castable at the Joiner's level (spellLevelFor), as readScroll's scribe gate requires; the scroll is spent even when nothing is learnable (scroll: null)"
  - "memberUseItem is not added to NARRATIVE_ACTIONS: useItem is not there either, so the Company panel's USE keeps the terse rail table text (the dismissJoiner precedent is for an action whose line is a whole sentence)"
  - "engine/derived.js needed no change (the plan's step 6 is the Q2 = B branch only)"
requirements-completed: [ITEM-07, ITEM-06]
status: complete
duration: ~3h
completed: 2026-09-30
---

# Phase 89 Plan 05: Joiners wear and use their own items Summary

**A Joiner joins wearing the cloak or jewel it carries, can be told outside a fight to drink its own potion or use a worn item through one action (`memberUseItem`), and its item effects start, tick, heal and end on its own sheet exactly like the hero's, every line naming the Joiner and no main-rng draw added.**

## What changed

- **The use path (`engine/items.js`).**
  - `memberDrinkPotion(state, idx, rng, events)`: `2 * d10 + 5`, doubled for a heal-twice race, from `derivedRng(cursor, "memberPotion", acts, idx, potionsBefore)`; spends the Joiner's own `potions`, heals through `healPartyMember` (its `C.allies` entry in a fight, its sheet otherwise), pushes `memberPotionDrunk { member, amount, gained, remaining, doubled? }`.
  - `memberUseWorn(state, idx, slot, rng, events, now)`: no fight refusal (89-06 calls it in a fight). Refusal ladder `leaderOnly`, `combatOnly`, `cooldown`, then the Pilfer fumble from `derivedRng(cursor, "pilferFumble", acts, it.n, "member", idx)`, then `itemUsed { member }`, the Pendant's `halfNext = { slot, n }`, and `applyActivation(state, it, rng, events, slot, sheet)`, which starts the same `item:<key>` record, cooldown and `src` link on the Joiner's sheet, so taking it off, a swap or destruction ends it through `endSourceEffects`.
  - `memberUseItem(state, idx, ref, rng, events, now)`: the action. Refusals `noMember` (none, or downed), `inCombat` (a fight or a pending one), `noPotions`, `fullHealth`, then the `memberUseWorn` ones. Every refusal is zero-draw and mutation-free; an empty slot is a silent no-op.
  - `applyActivation`, `narrateTimerTransitions`, `tickHealOverTime` take an optional trailing `sheet`. The hero's heal key is unchanged; a Joiner's appends `"member", <party index>`.
- **The action.** `memberUseItem { i, potion: true }` or `{ i, slot }` in `engine/actions.js` (validated: non-negative integer `i`, exactly one of `potion === true` / `slot` in the three worn keys) and dispatched in `engine/engine.js`.
- **Wear on joining.** `resolveJoiner` runs `reconcileWorn` on the pending sheet (the cloak or jewel moves from its bag into a worn slot, the same object) and pushes `joinerJoined.wore` (additive, only when non-empty). A Joiner with nothing to wear joins with `worn: {}` and no `wore` key. `validateSave` and `rehydrate` dress a saved Joiner the same way (after `sanitizeWorn(member)`, before `reconcileItemSources(member)`).
- **Ticks.** `move` runs a Joiner loop right after the hero's tick block: `tickHealOverTime` then `narrateTimerTransitions(state, tickSquares(m, cost), events, m)` for each Joiner with a plain-object `timers`. The hero's lines come first, Joiners in party order; a solo run never enters the loop.
- **Narration.** Oracle and rail lines for `memberPotionDrunk`, the Joiner forms of `itemUsed`, `itemEffectStarted`, `itemEffectFaded`, `itemCooled`, `healTick`, `pilferFumbled`, the `wore` and `scroll` clauses of `joinerJoined`, and a line per new refusal reason (plus member `cooldown` and `combatOnly`). `memberPotionDrunk` is a rail feature line (in `FEATURE_EVENTS`), not a card event, and plays the drink clip.

## Q2 and Q3 build notes

- **Q2 = A (docs/ITEM-AUDIT.md, 2026-09-30).** `MEMBER_LEADER_KINDS = ["fly", "ether", "glow", "tongue", "stone"]`, frozen. A Joiner's Cloak of Flying, Cloak of Ether, Bracelet of Flight, Amulet of Light, Helm of Knowledge or Amulet of Stone is refused `leaderOnly` with zero draws, before any other check, even through `memberUseWorn` in a fight. The `combatOnly` refusal is reachable only for a hand-built targeted item (the Amulet of Stone, the one worn targeted item, is leader-only first). The one-line wording on the Company panel is 89-07's; the Oracle and rail `leaderOnly` lines already say why ("only the one in front does that"). Every other use-activated cloak and jewel a Joiner can wear is pinned to work.
- **Q3 = A.** `grep -c '"joinerScroll"' engine/encounters.js` prints 1. A Magic User Joiner with `scrolls > 0` reads it on joining: one spell from `derivedRng(state.rngState, "joinerScroll", name, depth).pick(...)` among the spells its sub can learn at its level (`grantableAt`), castable at once (`spellLevelFor <= level`), and not already in its book, goes into its grimoire; `scrolls` becomes 0; `joinerJoined.scroll` names the spell, or is `null` (scroll still spent) when nothing was learnable. Any other class, or a mage with no scroll, gets no `scroll` key.

## Tasks and commits

| Task | Name | Commit |
|------|------|--------|
| 1 | The Joiner use path: potion, worn item, the action and its refusals, and the Q2 ruling | `171d4917` |
| 2 | Wear on joining, dress saved Joiners on load, tick Joiner item timers, and the Q3 scroll ruling | `74a9a5ba` |
| 3 | Narrate every Joiner item line; ledger the rolls; measure and declare the drift | `1704188b` |

## Results

- `npm test` (final full run, after the last code change): 8,480 tests, **8,478 pass, 0 fail, 2 skipped** (base 8,368 / 8,366 / 0 / 2; +112 new tests: 50 in `joiner-item-use.test.js`, 62 in `joiner-item-lines.test.js`). No CRLF doc-ledger failures appeared in this worktree run.
- `node --test "test/parity/**/*.test.js"`: 66 / 66, zero drift. `node tools/narrative-review.mjs` then `--check`: in sync (583 rows).
- Acceptance greps: the four `export` names in `engine/items.js` 4; `applyActivation(state, it, rng, events, slot, sheet)` 1; `"memberPotion"` 1; `"memberUseItem"` in `actions.js` 2 (the type list and the validator case) and `memberUseItem(next` in `engine.js` 1; `reconcileWorn(member)` in `saveState.js` 2; `tickSquares(m, cost)` 1; `memberPotionDrunk` in `eventNarration.js` 1 and `narrationLines.js` 3; `leaderOnly|noPotions|fullHealth` in `narrationLines.js` 4; `### Phase 89 plan 05` in FIXTURE-INVENTORY 1; `prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `corpus-base.json` untouched.
- Edge probes (all pinned in `joiner-item-use.test.js`): a Joiner at exactly full hp is refused `fullHealth` (one hp short drinks); a draught that would overshoot heals exactly to its maximum; no potions is `noPotions`; an empty slot is a silent no-op; a sheet with no timers ticks nothing and never gains a timers map; a Joiner with nothing to wear joins with `worn: {}` and no `wore`; a use pushes `itemUsed` then `itemEffectStarted` (both with `member`); on a step the hero's item lines precede each Joiner's in party order.
- Prohibitions: a Joiner's use never spends the hero's potions, items or timers (the hero's sheet is JSON-compared before and after), and no item passes between hero and Joiner (GIVE stays deferred).

## Fixture drift (Joiner item use)

Predicted: zero parity drift; state pins moved wherever a bot run takes a Joiner with a cloak (now worn) or a Magic User Joiner (Q3). Measured against the base tree (`git archive 3d2f5d3b`):

- **Parity fixtures:** 66 / 66, zero drift; comparables unchanged (`state.party` is stripped whole; no new top-level field).
- **Bot state pins moved: 1 of 8**, re-recorded alone (hand-pasted from `node tools/roll-high-baseline.mjs pins`; `save` never run), with a dated Phase 89 plan 05 comment:

| Label | Before | After | First divergence |
|---|---|---|---|
| `solo-magicuser-sorcerer` | 400 / alive / 5, `565c5fcb...` | 400 / alive / 5, `e457e2c1...` | bot step 249: Cedric Thorne (a Cutthroat) joins, `wore ["Cloak of Speed"]` |

  A pure state-shape move: every step's event list and every party hp line are identical to the base for all 400 steps, and undoing the dressing in the final state re-hashes to the old pin exactly. The other seven labels are byte-identical.
- **Save fixture moved:** `test/unit/fixtures/roll-high/pre-switch-save.json`, `expected.hash` only: `b390924b...` -> `0e2cc518...` (`dead`/`depth`/`actions` unchanged; `save` and `dispatched` untouched; its `note` carries the dated entry). The save's Joiner, Denn of Ash Alley, has no cloak or jewel, so the load only gives him `worn: {}`; deleting that empty map from the replayed final state re-hashes to the old pin exactly.
- **Unit pins moved (before -> after):**
  - `joiner-acquisition.test.js` ("a second accept SWAPS the roster"): the joined sheet's keys equal the pending sheet's -> plus `worn`.
  - `party-model.test.js` (round-trip; fail-open malformed members): the loaded member deep-equals the saved one -> plus `worn: {}`.
  - `resume-mid-encounter.test.js` (SAV-06 pending Joiner): the party gains exactly the offered sheet -> plus `worn: {}`.
  - `map-until-move.test.js` ("one tick site"): one `tickSquares(` call in `movement.js` -> two (the hero's and each Joiner's, in the one per-step tick block).
  - `roll-high-guard.test.js` `DRAW_INVENTORY` `engine/items.js`: `amount` 7 -> 8 (the Joiner's potion `.d(10)`, derived stream).
  - `combat-gear-lock.test.js` `payloadTable`: a `memberUseItem` row added (the action joins `ACTION_TYPES`).
- **Narrative corpus:** see the deviation below. Full before/after rationale is in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 89 plan 05") and `docs/ROLL-LEDGER.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pins and guards the change moved that the plan did not list**
- **Found during:** Task 3 (`npm test`)
- **Issue:** `roll-high-save-compat.test.js` (the pre-switch save fixture's continuation hash), `party-model.test.js` (two tests), `resume-mid-encounter.test.js`, `map-until-move.test.js` and `combat-gear-lock.test.js` (none in the plan's file list) pinned a joined or loaded Joiner sheet with no worn map, a single `tickSquares(` call, and the action list.
- **Fix:** moved each expectation to the new engine value as described above; each proven state-only where it is a hash, each declared in FIXTURE-INVENTORY.
- **Files modified:** the six test files and `test/unit/fixtures/roll-high/pre-switch-save.json` (`expected.hash` and `note` only)
- **Commits:** `171d4917` (combat-gear-lock), `1704188b` (the rest)

**2. [Rule 3 - Blocking] The narrative corpus renders the Joiner forms, so earlier ledger rows needed chaining**
- **Found during:** Task 3 (`narrative-review.test.js`)
- **Issue:** the corpus builds every builder's synthetic event with `member: "the companion"` and `tools/lib/event-variants.mjs` is frozen after Phase 79, so a builder that gains a Joiner form shows that form (not the hero's) for every variant not crossed with the `member: null` toggle. Two earlier plans' `after` lines (79-11's Unseen line and cooldown refusal, 88-04's full-hp tick, 89-02's Enlarge line) left the corpus, which the live page test rejects.
- **Fix:** `docs/narrative-pass/why/89-05.json` (28 rows) logs each changed key and chains those earlier `after` lines to the Joiner forms; each why says the hero's line is unchanged in the game. To keep the damage small the member branch of `useRefused` handles only the Joiner's reasons and lets any other reason fall through to the hero's line. `joiner-item-lines.test.js` pins the hero forms byte-for-byte. The frozen `event-variants.mjs` and `corpus-base.json` are untouched.
- **Commit:** `1704188b`

### Plan adjustments (not bugs)

- **Shared fumble roll:** the plan said to roll the Joiner's Pilfer fumble "exactly like useItem's branch". The roll is now one module-private `rollPilferFumble(fumbleRng)` used by both, so the hero's draws are unchanged (same d20, same d10, same stream order) and the roll-high inventory gains only the one `.d(10)` of the potion.
- **Q3 castable filter:** the plan's candidates were "canLearn and grantableAt"; I also require `spellLevelFor(sub, sp) <= level`, the bar `readScroll` applies before it scribes, so the copied spell is usable at once. Every candidate still satisfies `grantableAt`.
- **`NARRATIVE_ACTIONS`:** `memberUseItem` was not added (see key-decisions): the Company panel's USE keeps the terse rail table text like `useItem`.
- **TDD order:** each task's test file was written alongside the implementation, not as a separate red commit; each task is one `feat` commit with engine and tests. Task 1's commit leaves two narration-coverage tests (`formatEvents narrates every engine-emitted event type`, `every engine-emitted event type either has a LINE_FOR builder or is ORACLE_ONLY`) red until Task 3 adds the lines, as the plan splits the work; the final tree is green.
- **`engine/derived.js` untouched:** the plan lists it for the Q2 = B reach only.

## Known Stubs

None.

## Threat Flags

None. `memberUseItem` adds a validated wire shape (non-negative integer `i`, exactly one of `potion === true` / a worn slot) and a named refusal for everything else; no new network, auth or file surface.

## Human verification (deferred to end of run)

1. Recruit a Thief Joiner: the rail says what cloak it put on.
2. (After 89-07's buttons) have a hurt Joiner drink a potion outside a fight: its HP rises and the rail names it; the hero's potion count does not change.
3. Have a Joiner with a Cloak of Strength use it, then walk 50 squares: the rail says its cloak wore off, and 50 squares later that it is ready again.
4. Recruit a Magic User Joiner: the rail says what its scroll did (a spell copied into its book, per Q3 = A).
5. (After 89-07) try USE on a Joiner's Cloak of Flying or Helm of Knowledge: it is refused with the "only the one in front" line.

## Self-Check: PASSED

- Files exist: `engine/items.js` (exports `memberUseItem`, `memberUseWorn`, `memberDrinkPotion`, `MEMBER_LEADER_KINDS`), `test/unit/joiner-item-use.test.js`, `test/unit/joiner-item-lines.test.js`, `docs/narrative-pass/why/89-05.json`.
- Commits `171d4917`, `74a9a5ba` and `1704188b` exist on `worktree-agent-a5d03c0d10f621c5e`; the final full `npm test` is green (8,478 pass, 0 fail, 2 skipped); `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched.
