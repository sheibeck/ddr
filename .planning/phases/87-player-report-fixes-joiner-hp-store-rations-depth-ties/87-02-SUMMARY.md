---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 02
subsystem: engine
tags: [store, rations, derived-rng, economy, narration, STORE-04]
requires: []
provides:
  - "RATIONS_STOCK_DIE, rollRationsStock(rng, depth), rationsLeft(line) exported from engine/economy.js"
  - "Rations stock line field `left` (1..10); buyFrom sells one ration per tap until spent"
  - "storeBuyRefusal reason rationsFull; engine events rationsSoldOut and rationsFull, both narrated"
affects: [87-03, phase-92]
tech-stack:
  added: []
  patterns: ["derived rng stream keyed on the main cursor after all draws (zero main-rng draws)", "tolerant count read for old saves (rationsLeft)"]
key-files:
  created:
    - test/unit/store-rations-stock.test.js
  modified:
    - engine/economy.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/store-roll.test.js
    - test/unit/roll-high-guard.test.js
    - test/unit/narrationLinesTable.test.js
    - test/unit/narrationLinesCoverage.test.js
key-decisions:
  - "Derived-stream key: derivedRng(<main rng cursor after every openStore draw>, 'storeRations', depth).d(10), tagged roll:amount; flat d10 at every depth"
  - "Old save (no `left`): unsold reads 1 left, sold reads 0 (the old one-ration store); a tampered count is capped at 10"
  - "Pack-cap refusal (kept by the user): rationsFull is refused before any gold moves, only when the character has a bag (BAGS[c.bag])"
requirements-completed: [STORE-04]
duration: ~35 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 02: Stores stock a d10 of rations (STORE-04, engine half) Summary

**Opening a store rolls 1-10 rations from a derived rng stream onto the Rations line as `left`; each BUY tap sells one ration at the unchanged price until the count is spent, with sold-out and over-cap buys refused before any gold moves. The main rng cursor and every stock index are untouched.**

## What changed

- `engine/economy.js`
  - `RATIONS_STOCK_DIE = 10`, `rollRationsStock(rng, depth)` (fresh `derivedRng(cursor, "storeRations", depth).d(10)`, cursor = `rng.getState()` after every openStore draw, never advances `rng`) and `rationsLeft(line)` (old-save-tolerant read, capped at the die).
  - `openStore` sets `left` on the just-added Rations line; name, price, position, effect and params are byte-identical, and it still sits before the tool lines and the haggle pass.
  - `storeBuyRefusal` gains `rationsFull { have, cap }` for a ration buy past `BAGS[c.bag].rations` (a bag-less old-save or test hero is never cap-refused). `insufficientGold` still wins first.
  - `buyFrom`: a spent Rations line (`rationsLeft <= 0`) is a silent no-op before any gold moves; otherwise `left` decrements and the line stays buyable until 0, then `sold` flips and `rationsSoldOut` follows `rationsBought`. A refused over-cap buy pushes `rationsFull`. Every other line still sells once. `STORE_EFFECTS.buyRations` and its `rationsBought` event are unchanged.
- `src/browser/eventNarration.js` / `narrationLines.js`: `rationsSoldOut` ("Last ration off the shelf. The shopkeeper eyes you the way a pantry eyes a Troll.") and `rationsFull` ("Your pack already holds N of M rations. ...sandwich you would have to carry in your teeth."), with rail lines "Shelf's bare: that was the last ration." (beat) and "Pack full: N/M rations." (block refusal shape). Both toast-only, neither is a card event.
- `engine/saveState.js` untouched: `sanitizeStore` already carries extra line fields, and `rationsLeft` is the tolerant read.

## Tests

`test/unit/store-rations-stock.test.js` (new, 19 tests): openStore shape and `left` in 1..10 over six seeds; main rng never moved by the roll; roll pure per (cursor, depth) and covers exactly 1..10 over cursors 0..9999; the `storeRations` key and the cursor-0 fallback; flat across depths; left 3 sells 3 then sells out and 20 more taps change nothing; minimum roll (1) sells exactly one; a real rolled store bought to the end delivers exactly the stock; malformed `left 0 / sold false` refused with nothing moved; `rationsLeft` old-save and garbage reads; an old-save line through `serializeRun` / `validateSave` / `rehydrate` still buys and sells out; save/load mid-store keeps the remaining count; rationsFull (small bag at 10 refused, 9 buys one then refuses, gold/rations/left unchanged, insufficientGold first, bag-less never refused, non-Rations lines unaffected); every other line sells once; both new events render on the Oracle and rail with bare and full payloads.

## Fixture drift (STORE-04)

Measured with the full `npm test`, then with the parity suites alone.

- **Parity fixtures: zero drift.** `node --test "test/parity/**/*.test.js"` 66 pass / 0 fail. The Rations line is filtered from every prototype compare (`ENGINE_ONLY_STORE_EFFECTS`), the economy script never buys it, and the roll draws zero main-rng values. `test/parity/prototype-master.js.txt` untouched; `engine/saveState.js`, `firebase/`, `src/browser/runDoc.js`, `tools/` untouched. No fixture was regenerated.
- **`test/unit/store-roll.test.js` "stock-shape pins ... non-rolled lines unchanged"** (1 pin moved). Before: the static Rations line had to be byte-identical between the flag-off and flag-on store. After: identical except `left`, which must be an integer 1..10 on both sides. Rationale: flag-on draws extra values, so its cursor after openStore (and therefore the cursor-keyed d10) differs from flag-off by design; the draw-count pins in that file are untouched and stay green. Every other test in that file, `economy.test.js`, `store-delivery.test.js` and `store-sell.test.js` passed unmodified (the one-buy RATION-01 pin still holds, as a buy adds `amount` 1 and `left` is at least 1).
- **`test/unit/roll-high-guard.test.js` DRAW_INVENTORY** (1 pin moved). `engine/economy.js` `amount: 0` -> `amount: 1`. Rationale: the ration roll is one new tagged raw `.d(` draw (`// roll:amount`, a quantity), on a derived stream.
- **`test/unit/narrationLinesTable.test.js` REFUSAL_TYPES** and **`test/unit/narrationLinesCoverage.test.js` NAMED_LEGIBILITY_EVENTS**: `rationsFull` added (classification lists, not value moves).
- **Bot state pins: none moved.** No bot pin failed. (Bot-policy pins belong to 87-03.)

Final full suite: tests 8100, **pass 8098, fail 0**, skipped 2 (baseline after 87-01: 8079 pass / 0 fail / 2 skipped; +19 new tests).

## Deviations from Plan

**1. [Rule 3 - Blocking] Two guard tests the plan did not name.** The first full run failed `roll-high-guard.test.js` (an untagged raw draw in an enforced file) and `stale-terms.test.js` (the word "toast" in a new comment). Fixed by tagging the draw `// roll:amount` with the inventory bump above, and rewording the comment to "Minor events, never a card." Both re-verified green.

**2. [Test-pin update, planned outcome] `store-roll.test.js` static-line pin** moved as described in Fixture drift; the plan anticipated "unit pins that deep-equal a Rations stock line".

**3. Commit trailer.** The two task commits carry `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the harness-provided attribution for this session) rather than the Opus 5.5 (1M context) line in the orchestrator rules file; the `Claude-Session:` line is the same as specified. Not rewritten, per the no-amend rule.

The plan's `grep -c '"storeRations"'` acceptance count prints 2 rather than 1: one is the call site, the other is the quoted key in the openStore explanatory comment. There is exactly one code call site.

## Findings for later plans

- 87-03 (bot + store screen): the fair bot and the DAYS-farm hoarder must read `rationsLeft(line)` and stop at `rationsFull`; the store row can show "Rations · N left" from `rationsLeft`. `viewModels.js#storeRowState` reads `storeBuyRefusal`, so it already sees `rationsFull` and should grey the row with the reason (its reason-to-text map needs a `rationsFull` entry).
- Phase 92: the fair bot will now be able to buy up to 10 rations per store; re-measure starvation deaths at the milestone-end readout (todo balance note).

## Known Stubs

None.

## Threat Flags

None. No new network, auth or trust-boundary surface; the only new serialized field (`left`) is read through a capped, tolerant helper, so a tampered save cannot conjure more than 10 rations per store.

## Human verification (deferred to end of run)

- [ ] Buy rations one at a time in a store until it runs out; each tap adds exactly one ration and the Oracle's "Last ration off the shelf" line appears on the final one. (The visible "N left" count on the row arrives with 87-03.)
- [ ] Save & Quit mid-store, relaunch: the store resumes with the same count.
- [ ] With a small bag at 10 rations, a ration buy is refused with the "Pack full" line and no wilmst leaves the purse.

## Self-Check: PASSED

- FOUND: test/unit/store-rations-stock.test.js, engine/economy.js (`export function rationsLeft`, `export const RATIONS_STOCK_DIE = 10`)
- FOUND commits: 6fc9c8d4, 970f2e32
- `git diff --stat -- test/parity engine/saveState.js firebase src/browser/runDoc.js tools` is empty.
