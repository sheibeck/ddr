---
phase: 88-item-systems-effect-sources-heal-over-time-the-crit-proof-cloak
plan: 04
subsystem: engine
tags: [items, heal-over-time, cloak-of-regeneration, narration, chips, derived-rng, ITEM-03]
requires:
  - phase: 88-01
    provides: "src { slot, n } on timer records, endSourceEffects, the itemEffectEnded event and its kind tables"
  - phase: 88-02
    provides: "the link survives save and load (the cloak's window resumes from its own left)"
provides:
  - "act.hot { every, ticks, heal } heal-over-time activation data, copied frozen by buildActivation"
  - "engine/derived.js#healTicksDue and #healTicksLeft (pure counting; progress derived from the record's own left)"
  - "engine/items.js#tickHealOverTime, called once per step from move before tickSquares; the healTick event"
  - "the reworked Cloak of Regeneration: a 30-square window, a d6 at 10/20/30 squares, then 50 squares of rest"
  - "the Regenerating chip (key knit) with the ticks left; healTick, knit start and knit ended lines on the Oracle and the rail"
affects: [89, 92]
tech-stack:
  added: []
  patterns:
    - "heal-over-time is activation data read by the one squares tick: any item can use it (Phase 89 reuse)"
    - "tick progress is derived from effect - left, so no new serialized field and a saved window resumes exactly"
    - "each tick's die comes from derivedRng(cursor, 'healTick', item, tick, steps); the main rng is read for its cursor only"
key-files:
  created:
    - test/unit/heal-over-time.test.js
    - test/unit/heal-over-time-lines.test.js
    - docs/narrative-pass/why/88-04.json
  modified:
    - content/treasure-tables.js
    - engine/derived.js
    - engine/items.js
    - engine/movement.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/heroConditions.js
    - mazeworld.html
    - tools/lib/voice-corpus.mjs
    - tools/voice-sample.mjs
    - test/unit/item-activation.test.js
    - test/unit/item-wiring.test.js
    - test/unit/honest-gains.test.js
    - test/unit/item-effect-source.test.js
    - test/unit/item-effect-ended-lines.test.js
    - test/unit/hero-conditions.test.js
    - test/unit/status-chit-combat.test.js
    - test/unit/trap-death-repro.test.js
    - test/unit/roll-high-guard.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/FIXTURE-INVENTORY.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - docs/GEAR-BALANCE.md
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/ROLL-LEDGER.md
key-decisions:
  - "Counting: a step of cost n moves elapsed e to min(effect, e + n); the ticks due are every whole multiple of every in (e, e + n], capped at ticks, so a 2-square water step that crosses a mark ticks exactly once."
  - "tickHealOverTime runs BEFORE tickSquares in move, reading each record's pre-step left, so the third heal line is told before the same step's wears-off line."
  - "Wearer only: the tick heals the hero (state.c); Joiner sheets are not ticked (CONTEXT 'Wearer only')."
  - "The retired use-time instant-heal event (cloakRegenerated) is removed with its builders; its 79-02 why-ledger rows are closed with deletion rows in 88-04.json."
requirements-completed: [ITEM-03]
duration: ~2 h (including the 6-minute full suite)
completed: 2026-09-30
status: complete
---

# Phase 88 Plan 04: heal-over-time and the Cloak of Regeneration (ITEM-03) Summary

**The Cloak of Regeneration is now a 30-square heal-over-time window: using it starts the window with no instant heal and no main-rng draw, a d6 comes back 10, 20 and 30 squares after the use (each die from `derivedRng(cursor, "healTick", item, tick, steps)`), every tick is narrated (the full-hp one reads "Nothing left to knit."), taking the cloak off stops the ticks left and says how many went unspent, and its own Regenerating chip counts the ticks (3, 2, 1). The heal is general activation data (`act.hot`), so Phase 89 can give any item one.**

## Accomplishments

- **General data.** The Cloak of Regeneration row is `act { kind: "knit", effect: 30, cd: 50, hot: { every: 10, ticks: 3, heal: { n: 1, sides: 6, bonus: 0 } } }` (30 + 50 = 80 keeps the once-a-day rule; `eff: { cloakRegen: 1 }` kept so no rolled item moves). `buildActivation` copies a frozen `hot`; the exported row still carries no `act`/`hot`, and its text now reads "used, a d6 hp back every ten squares you walk, three times; then fifty squares before it will do it again".
- **Counting.** `healTicksDue(act, leftBefore, n)` and `healTicksLeft(act, rec)` in `engine/derived.js`, pure, never throwing on a hostile value. Progress is `effect - left`, so there is no new serialized field and a saved window resumes exactly (no comparable carve-out needed; `src` and `c.timers` were already stripped).
- **The tick.** `tickHealOverTime(state, cost, rng, events)` in `engine/items.js`: for each live hot record of the hero, for each due tick, `rollDice(derivedRng(cursor, "healTick", key, k, state.steps), act.hot.heal)`, clamped to max hp, pushing `healTick { item, amount, gained, tick, ticks }`. The main rng is read for its cursor only. `move` calls it once per step immediately before `tickSquares`. A dead state, a hero at 0 hp, or a sheet with no plain-object `timers` ticks nothing. No ticks in a fight (move returns early).
- **Use and take-off.** `useItem`'s `knit` case joins the plain-break list (the instant main-rng d6 is deleted). `itemEffectStarted` carries `every`, `ticks`, `heal` for a hot item; 88-01's `endSourceEffects` reads `healTicksLeft` before ending the record and adds `ticks` to `itemEffectEnded`.
- **Narration.** Oracle and rail `healTick` (a full-hp tick: "Nothing left to knit." plus "Tick k of N"; rail "Nothing left to knit (k/N)."), a `knit` entry in `itemEffectStarted` (states the window, die, cadence and count from the event's own numbers) and in both `itemEffectEnded` tables (names the unspent ticks). The retired instant-heal builders are gone. Not a `CARD_EVENTS` type: rail/Oracle lines only.
- **Chip.** `item("knit", false)` in `heroConditions.js` (not a fight chip); `CONDITION_COPY.knit` "Regenerating", a knit detail branch in `paintConditions` ("3 ticks" / "1 tick"), `CONDITION_TONE.knit`, `CONDITION_EXPLAIN.knit`.
- **Ledger.** `docs/narrative-pass/why/88-04.json`: two deletion rows closing the 79-02 rows of the retired event (`before` copied from 79-02's `after`, `after` ""), and `oracle:healTick` / `rail:healTick` rows whose `after` comes from the live corpus. `node tools/narrative-review.mjs --check`: pages in sync.

## Task Commits

1. **Task 1: heal-over-time as activation data; the cloak reworked onto it** - `4c8c1c43` (feat)
2. **Task 2: narrate every tick, retire the instant-heal lines, add the Regenerating chip** - `1087239f` (feat)
3. **Task 3: measure, declare and regenerate only what moved; update the ledgers** - `4190d664` (docs)

## Fixture drift (ITEM-03)

Measured against the plan base `3cce3352` and recorded in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 88 plan 04: the Cloak of Regeneration heals over time (ITEM-03)"):

- `node tools/fixture-inventory.mjs --json`: byte-identical to a `git archive` of the base.
- Parity `node --test "test/parity/**/*.test.js"`: 63 / 66 before the declaration, **66 / 66 after**. `test/parity/prototype-master.js.txt`, `test/parity/harness/comparables.js`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json` are untouched.
- Save-compat (`roll-high-save-compat.test.js`): `expected.hash` unchanged. Pinned state hashes: every label byte-identical except `deep-14`.

| Entry | Before | After | Rationale |
|---|---|---|---|
| chargen seed 4 `after.worn.cloak.txt` (`action-script.chargen.json`) | "used, a d6 hp back at once; then twenty squares of rest before it works again" | "used, a d6 hp back every ten squares you walk, three times; then fifty squares before it will do it again" | the rolled starting cloak is a Cloak of Regeneration; display text only, zero draws, never used in the script. One sentence appended to the record's rationale. |
| `roll-high-guard` DRAW_INVENTORY `engine/items.js` `amount` | 8 | 7 | the use-time `rng.d(6)` (tagged `roll:amount`) is gone; ticks roll through `rollDice` on a derived stream (no `.d(` in items.js) |
| `roll-high-state-pins` `deep-14` | `20cec0b2...8d75` | `fe2e796a...2f1` (35 / dead / 14 unchanged) | this Thief's starting cloak is a Cloak of Regeneration and its `txt` rides the hashed state. Traced against a `git archive` of the base: all 35 steps identical by wp / steps / events. Proven text-only: swapping the old text back into the new final state re-hashes to the old pin. Only this label pasted by hand; `roll-high-baseline.mjs save` not run. |

Unit pins moved with the rule (before, after):

| Pin | Before | After |
|---|---|---|
| `item-activation.test.js` ACTIVATION_OF cloak | `{ knit, effect 0, cd 20, eff }` | `{ knit, effect 30, cd 50, eff, hot { every 10, ticks 3, heal 1d6 } }` |
| `item-wiring.test.js` section 6 | use rolls one main d6, instant heal, 20-square cooldown | use starts the 30-square window with zero main draws and no instant heal; worn-but-unused heals nothing; a live-window walk leaves the main cursor where the same walk without it leaves it |
| `honest-gains.test.js` cloak test and narration asserts | `cloakRegenerated`, 1 main draw | `healTick`, `gained` = clamped die, 0 main draws; "Nothing left to knit" |
| `item-effect-source.test.js` linked worn set | twelve | thirteen (the Regeneration window) |
| `item-effect-ended-lines.test.js` linked list | 13 (12 + Crystal Staff) | 14, with a `knit` phrase |
| `hero-conditions.test.js`, `status-chit-combat.test.js` | `knit` never a live chip | `knit` a live, non-fight chip |
| `trap-death-repro.test.js` GAIN_TYPES | `cloakRegenerated` | `healTick` |

## Deviations from Plan

**1. [Rule 1 - Bug/regression] Two further unit pins from earlier plans moved.** `item-effect-source.test.js` ("the linked worn set is the twelve") and `item-effect-ended-lines.test.js` ("the linked list is the twelve worn items plus the Crystal Staff") derive their lists from content by `effect > 0`; the cloak's effect went 0 to 30, so both grew by one (the cloak is now linked, as CONTEXT "Linked effects" states). Both updated with a dated comment; declared above.

**2. [Rule 3 - Blocking] `roll-high-state-pins` `deep-14` and the DRAW_INVENTORY row moved** (plan Task 3 expected these possibilities; measured and declared above; `roll-high-guard.test.js` and `roll-high-state-pins.test.js` were not in the plan's `files_modified`).

**3. [Rule 2 - Consistency] `tools/lib/voice-corpus.mjs` OWNER_RULES and `tools/voice-sample.mjs`** name `healTick` in place of the retired event (the plan authorised the OWNER_RULES swap; the sample override is the same one-word change). `tools/voice-sample-output.txt` was regenerated to check the sample, found to be stale on unrelated lines (299 vs 305 event types, CRLF noise), and reverted untouched; it is a deferred manual-review file.

**4. TDD note.** The plan marks Task 1 `tdd="true"`. The engine and `heal-over-time.test.js` were written in the same pass (the RED step was not committed separately), and the 19 new tests passed on first run. Every behavior bullet has its own test, and the `test:` RED commit is absent. Recorded here rather than back-filled.

Otherwise the plan ran as written.

## Tests

- New: `test/unit/heal-over-time.test.js` (19: content, use, the three derived-stream ticks and the main-cursor pin, water marks, ordering, full hp, empty edges, fight, cooldown, take-off, chip data) and `test/unit/heal-over-time-lines.test.js` (13: healTick on both surfaces, capped, full hp, bare payloads, no WP, not a card, knit start and ended, the chip in the real shell sandbox).
- Full `npm test` after Task 3's measured moves: 8,282 tests, 8,278 pass, 2 skipped, and 2 fail, both in `item-effect-ended-lines.test.js` (the pin declared in Deviation 1). The file was then fixed and re-run alone (8 / 8 pass); the full suite was not re-run after that one-file fix, so the expected total is 8,282 / 8,280 pass / 0 fail / 2 skipped. No worktree-only CRLF doc-ledger failures appeared.
- Acceptance greps: `export function tickHealOverTime` x1, `export function healTicksDue` x1, `export function healTicksLeft` x1, `tickHealOverTime(state, cost, rng, events)` x1 in movement.js, `"healTick"` in items.js, `Nothing left to knit.` in eventNarration.js, `knit: { label: "Regenerating"` x1 in mazeworld.html, `item("knit", false)` x1, the `node -e` content probe exits 0, `git diff` of `prototype-master.js.txt`, `event-variants.mjs` and `corpus-base.json` empty.

## Known Stubs

None.

## Threat Flags

None. The tick draws nothing from the main rng and reads only the record's own `left`; a tampered `left` outside (0, effect] yields no ticks (`healTicksDue`/`healTicksLeft` return empty/0).

## Findings for later phases

- **Phase 92 (bot pass).** `tools/lib/tuning-bot.mjs` still uses a ready worn Cloak of Regeneration as "a free heal" when hurt (`chooseFieldItem`, kind `knit`). The cloak now heals over 30 squares instead of at once, so its value to the bot changed; no bot run was made here (per the milestone rule). Re-read the bot's cloak use in the Phase 92 pass.
- **Phase 89.** `act.hot` is ready for reuse by any item; a hot row must satisfy `every * ticks == effect` and `effect + cd <= 100` (pinned by `heal-over-time.test.js`). Joiners are not ticked (CONTEXT "Wearer only").

## Human verification (deferred to end of run)

- [ ] Hurt, use the Cloak of Regeneration and walk: a heal line at 10, 20 and 30 squares, the Regenerating chip counting 3, 2, 1 ticks, then the cloak cooling for 50.
- [ ] Use it at full hp and walk ten squares: "Nothing left to knit." and the chip drops to 2 ticks.
- [ ] Use it, walk 15 squares, take it off: the ticks stop and the Oracle names the ticks left unspent.
- [ ] Wade through water across a 10-square mark: exactly one heal line.

## Self-Check: PASSED

- Commits `4c8c1c43`, `1087239f`, `4190d664` exist; `test/unit/heal-over-time.test.js`, `test/unit/heal-over-time-lines.test.js` and `docs/narrative-pass/why/88-04.json` exist; every acceptance grep and probe passes; `node tools/narrative-review.mjs --check` is in sync; parity 66 / 66; the two failing tests of the full run pass after their fix.
