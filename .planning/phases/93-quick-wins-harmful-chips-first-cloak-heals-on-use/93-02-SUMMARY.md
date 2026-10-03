---
phase: 93-quick-wins-harmful-chips-first-cloak-heals-on-use
plan: 02
subsystem: engine
tags: [items, heal-over-time, cloak, derived-rng, fair-bot, fixtures]
requires: []
provides:
  - "healTicksTotal(act): walking ticks plus one when act.hot.onUse === true (4 for the Cloak of Regeneration), 0 for no valid hot"
  - "applyActivation fires an instant healTick (stream tick key 0) after itemEffectStarted for an onUse item: hero in or out of a fight, Joiner outside one"
  - "itemEffectStarted.now === true for an onUse item (93-03's start line reads it)"
  - "knitWindowHeal(Cloak of Regeneration) = 14 in the fair bot"
affects: [93-03]
tech-stack:
  added: []
  patterns: ["one module-private healTickOnce shared by the instant and walking ticks; instant tick uses stream key 0 so every walking tick rolls what it rolled before"]
key-files:
  created: []
  modified:
    - content/treasure-tables.js
    - engine/derived.js
    - engine/items.js
    - engine/movement.js
    - engine/combat.js
    - tools/lib/tuning-bot.mjs
    - test/unit/heal-over-time.test.js
    - test/unit/item-activation.test.js
    - test/unit/item-text-engine.test.js
    - test/unit/item-wiring.test.js
    - test/unit/honest-gains.test.js
    - test/unit/joiner-item-use.test.js
    - test/unit/bot-balance-close.test.js
    - test/unit/bot-tactics.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/FIXTURE-INVENTORY.md
key-decisions:
  - "Data shape: act.hot keeps ticks: 3 (the WALKING ticks) and gains onUse: true, so validHot, healTicksDue, healTicksLeft, the chip's 3/2/1, the take-off 'N ticks unspent' and the every x ticks === effect invariant are all unchanged"
  - "Instant tick numbering: tick 1 of 4; walking tick k is told k + 1 of 4; stream keys stay 1..3 for the walking ticks and 0 for the instant tick"
  - "Instant tick requires c.wp > 0 and not state.dead; a full-hp use is told (gained 0) and spent"
requirements-completed: [ITEM-08]
duration: 75min
completed: 2026-10-03
status: complete
---

# Phase 93 Plan 02: The Cloak of Regeneration heals a d6 at once Summary

**Using the Cloak of Regeneration heals a d6 at once from the healTick derived stream (tick 1 of 4, hero in or out of a fight, Joiner outside one), then the walking ticks at 10, 20 and 30 squares exactly as before; the main rng is only read for its cursor.**

BASE (plan start HEAD): `c6d9fc27a6cb9a7f572b14ee3047fda9e43ad9a2`

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | The instant tick in engine and content (hero, fight, Joiner), the new item text, every moved engine pin | c09a62f9 |
| 2 | The fair bot plays the new rule (knitWindowHeal 14), stale engine comments | 377aa573 |
| 3 | Measure, declare and regenerate only what moved | c9d5c2e1 |

## What was built

- `content/treasure-tables.js`: the cloak's `act.hot` gains `onUse: true` (`ticks` stays 3, the walking ticks). Row comment rewritten for Phase 93 ruling B.
- `engine/derived.js`: `export function healTicksTotal(act)` (0 for no valid hot; `ticks + 1` only when `onUse === true` exactly). Chip doc line says the chip's `ticks` are the walking ticks still owed.
- `engine/items.js`: module-private `healTickOnce(state, c, key, act, k, cursor, events, isMember, partyIdx)` (one die, one clamp, one `healTick` shape) used by `tickHealOverTime` (walking keys 1..3, now told 2..4 of 4) and by `applyActivation` (instant key 0, told 1 of 4, right after `itemEffectStarted`; guarded by `c.wp > 0 && !state.dead`). `itemEffectStarted.now = true` for an `onUse` item. Joiner use goes through the same seam (`memberUseWorn`), keyed `"member", partyIdx`; `knit` stays out of `MEMBER_COMBAT_KINDS` and `MEMBER_SELF_KINDS` is untouched. The stale Phase 88 comment above `case "knit"` is rewritten.
- `tools/lib/tuning-bot.mjs`: `knitWindowHeal` multiplies the average die by `healTicksTotal(activationFor(it))`: 4 x 3.5 = 14. `knitWanted`, `chooseFieldItem`, `chooseMemberItem` and `buffKinds` are unchanged (the bot never uses the cloak in a fight).
- `engine/movement.js`, `engine/combat.js`: comment-only rewording (diff is comments only; `MEMBER_COMBAT_KINDS` byte-identical).
- `engine/economy.js`: untouched; the cloak's price stays 1400.

## Final item text (93-03 depends on this)

`used, a d6 hp back at once, and again every ten squares you walk, three more times; then fifty squares before it will do it again`

Event shapes for 93-03's narration: `itemUsed`, then `itemEffectStarted { kind: "knit", left: 30, every: 10, ticks: 3, heal: { n: 1, sides: 6, bonus: 0 }, now: true }`, then `healTick { item: "Cloak of Regeneration", amount, gained, tick: 1, ticks: 4 }` (plus `member` for a Joiner). Walking ticks read `tick: 2, 3, 4`, `ticks: 4`. The Regenerating chip still reads 3, 2, 1 and the take-off line still reports walking ticks unspent (3 right after a use).

## Renamed and added test titles (93-03 pins these in docs/ITEM-AUDIT.md)

- `test/unit/heal-over-time.test.js`:
  - renamed: `use: heals a d6 at once from the healTick stream (tick 1 of 4) and starts the 30-square knit window linked to the cloak slot; zero main-rng draws` (was "use: starts a 30-square knit window linked to the cloak slot; no instant heal, zero main-rng draws")
  - unchanged ITEM-AUDIT pins: `content: the Cloak of Regeneration is 30 squares of window, a d6 every 10, three ticks, 50 to cool` and `ticks: heal exactly on the 10th, 20th and 30th step; each die is the derived-stream d6; the main cursor never moves`
  - new: `healTicksTotal: the cloak is four ticks (one at once, three walking); a plain hot is its walking ticks; no valid hot is 0`; `use: the instant tick only reads the main cursor, it never draws (a real rng is where it was)`; `use: at full hp the instant tick is told (gained 0, amount is the die) and spent`; `use: in a fight the d6 lands at once too, the fight stays open and the window is untouched`; `use: a hero at 0 hp or a dead state gets no instant tick`
- `test/unit/item-wiring.test.js`: renamed to `Cloak of Regeneration USE starts a 30-square window with zero main-rng draws and one d6 at once (tick 1 of 4)`.
- `test/unit/joiner-item-use.test.js`: new `heal-over-time: a Joiner's own Cloak of Regeneration heals a d6 at once on use (tick 1 of 4) from the member-keyed stream key 0; the hero is untouched`; the pinned `heal-over-time: a hurt Joiner's own Cloak of Regeneration heals a d6 on its 10th, 20th and 30th square ...` title is byte-identical (its assertions now expect `tick: k + 1, ticks: 4`).
- `test/unit/item-text-engine.test.js`: cloak fact is now `/a (#) hp back at once, and again every (#) squares you walk, (#) more times; then (#) squares/d` (same value expression; 21 tests pass).
- `test/unit/bot-balance-close.test.js`: knitWindowHeal title now "(4 x d6 = 14: Phase 93, one at once)"; trigger tests use wp 26 (used) and 27 (not used) of 40 for the hero and the Joiner.

## Fixture drift (ITEM-08)

Measured against a `git archive` of BASE. `node --test "test/parity/**/*.test.js"` was 63 / 66 before the fixture edit (chargen seed 4 `worn.cloak.txt`, one root cause) and is 66 / 66 after. `node tools/roll-high-baseline.mjs pins` (each label twice): 2 of 8 moved; the other six (`solo-1`, `solo-2`, `solo-thief-pilfer`, `solo-magicuser-sorcerer`, `party-fighter-knight`, `deep-8`) are byte-identical, so a seeded run that never uses the cloak plays out identically. `node tools/fixture-inventory.mjs --json` is byte-identical to BASE; `roll-high-save-compat` and `roll-high-guard` unchanged. `test/parity/prototype-master.js.txt` untouched; `roll-high-baseline.mjs save` never run.

| Entry | before | after | kind and evidence |
| --- | --- | --- | --- |
| chargen seed 4 `after.worn.cloak.txt` (+ one rationale sentence) | `used, a d6 hp back every ten squares you walk, three times; ...` | the new text above | display text only, zero draws; the item is never used in the script |
| roll-high `party-1` | 400 / alive / 4 / `de6ebf64...` | 400 / alive / 4 / `d3f7b8db49145beb82c8cca2940b37d7171d9abbaa9893d9b0a916d94e8b50c7` | TEXT ONLY. The run has no `useItem`, `itemEffectStarted` or `healTick` (per-step trace, 400 steps). Control: old txt restored with `onUse` on re-hashes to the old pin `de6ebf64...`; new txt with `onUse` off gives `d3f7b8db...` |
| roll-high `deep-14` | 47 / dead / 14 / `9f87e12d...` | 48 / dead / 14 / `3972ff6279f62beb9a70a1e523274371338426f2c4f3d2ab677974924d41b866` | BEHAVIOUR. Per-step trace vs the base extract: steps 1-9 identical; at bot step 10 the Thief uses its cloak at 69/83 hp (14 missing; the base also used it at this step): base `itemUsed, itemEffectStarted` (hp 69), new adds `healTick 1/4` amount 6 (hp 75); the run dies one action later. Control: `onUse` off with the new txt = 47 actions, so the extra action is the tick |

Declared in `test/parity/FIXTURE-INVENTORY.md` under "### Phase 93 plan 02: the Cloak of Regeneration heals a d6 at once on use (ITEM-08)", with dated comments above both re-pinned entries in `roll-high-state-pins.test.js` (2 comment lines, 2 roll-high rows in the Moved table).

## Test results

- Full `npm test`: 10,202 tests, 10,194 pass, 0 fail, 8 skipped (93-01 baseline 10,196 / 10,188 / 0 / 8; this plan added 6 tests: 5 in heal-over-time, 1 in joiner-item-use).
- Parity glob 66 / 66; `roll-high-state-pins` + `save-compat` + `guard` 24 / 24.
- Acceptance greps: `healTicksTotal` export 1, `healTickOnce` defined once and called 3 times, `started.now = true` once, stale Phase 88 knit comment 0, `10.5` absent from the bot and its test, price 1400 unchanged (`git diff BASE` on economy.js, roll-high-guard, save-compat, the master file prints nothing), engine/movement.js and engine/combat.js diffs are comments only.

## Deviations from Plan

None - plan executed as written. (Tooling note: some working-tree files are LF, not CRLF - `engine/combat.js`, `test/unit/bot-balance-close.test.js`, `test/parity/FIXTURE-INVENTORY.md` - so edits were made with a script that preserves each file's own line endings; commit stats are small.)

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, storage key or schema; the instant tick is guarded by `c.wp > 0 && !state.dead`, and `onUse` is content data tested `=== true`.

## Human verification (end of phase, batched)

1. Hurt, use the worn Cloak of Regeneration: hp rises at once, with "Tick 1 of 4"; walk: heals at 10, 20 and 30 squares ("Tick 2/3/4 of 4"); the Regenerating chip counts 3, 2, 1.
2. Use it mid-fight from the combat ITEMS menu: hp rises at once; the fight goes on; no more ticks until you walk.
3. Use it at full hp: "Nothing left to knit." and the chip still shows 3 ticks.
4. Use a Joiner's cloak from the Company panel: the Joiner heals at once, by name.

(Note for 93-03: the Oracle and rail start lines still say the old "a d6 hp back every 10 squares you walk, 3 times"; they read `e.now` only after 93-03 wires it. The healTick lines already print "Tick 1 of 4" because they read the event's own numbers.)

## Self-Check: PASSED

- Files verified present: content/treasure-tables.js, engine/derived.js, engine/items.js, tools/lib/tuning-bot.mjs, test/parity/FIXTURE-INVENTORY.md.
- Commits c09a62f9, 377aa573, c9d5c2e1 exist in `git log`.
