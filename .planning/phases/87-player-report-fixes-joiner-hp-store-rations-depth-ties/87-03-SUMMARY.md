---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 03
subsystem: ui
tags: [store, rations, viewModels, bot, tuning-bot, days-farm, STORE-04]
requires:
  - phase: 87-02
    provides: "rationsLeft, storeBuyRefusal rationsFull, per-ration buyFrom, the `left` field on the Rations line"
provides:
  - "storeCountText(line) and STORE_ROW_COPY.rationsLeft / rationsFull (src/browser/viewModels.js); the Rations row shows 'N left' and names the pack-full reason"
  - "BOT_RATION_DAYS = 3 and the fair bot's ration pass in chooseStorePurchase (tools/lib/tuning-bot.mjs)"
  - "hoarderStorePick buys one ration per purchase up to the bag cap (tools/lib/days-farm.mjs)"
affects: [phase-92]
tech-stack:
  added: []
  patterns: ["row state and bot picks both read the engine's own storeBuyRefusal / rationsLeft, never a restated rule"]
key-files:
  created: []
  modified:
    - src/browser/viewModels.js
    - src/browser/storeScreen.js
    - tools/lib/tuning-bot.mjs
    - tools/lib/days-farm.mjs
    - test/unit/store-rows.test.js
    - test/unit/storeScreen.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/bot-buy-policy.test.js
    - test/unit/days-farm.test.js
    - test/unit/fixtures/shell-snapshots/mu-store.store.txt
    - test/unit/fixtures/shell-snapshots/thief-store.store.txt
key-decisions:
  - "BOT_RATION_DAYS = 3 x nightlyEats(state) is the fair bot's ration target (the one appetite definition the eat step and makeCamp read); one ration per pick"
  - "The ration pass is gated by storeBuyRefusal (purse and pack cap), not GOLD_RESERVE: the reserve exists for 'a later repair/food need' and this is that need"
requirements-completed: [STORE-04]
duration: ~40 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 03: Rations row count and the bots' per-ration policy (STORE-04, presentation and bot half) Summary

**The store's Rations row now reads "N left" and greys with "your pack holds no more rations" at the cap, both straight from the engine's own `rationsLeft` and `storeBuyRefusal`; the fair bot tops up to three days of its party's ration upkeep after its gear passes, and the DAYS-farm hoarder buys one ration per purchase up to its cap.**

## What changed

- `src/browser/viewModels.js`: new separate import `rationsLeft` (the `storeBuyRefusal` import line is byte-identical). `STORE_ROW_COPY` gains `rationsLeft: "{n} left"` and `rationsFull: "your pack holds no more rations"`. New export `storeCountText(line)` returns the "N left" text for an unsold `buyRations` line, else `null`. `storeRowState`'s reason chain gains a `rationsFull` branch; the returned object keeps exactly `disabled, refusal, reasonText, compareLine, showUsable`.
- `src/browser/storeScreen.js`: new separate import `storeCountText` (the pinned line 29 is byte-identical). The row's italic sub is `[sub, storeCountText(item), rs.compareLine, rs.reasonText]`, so the Rations row reads "Rations (+1 ration)" with "7 left" under it, and "7 left · your pack holds no more rations" when refused. Price column and the sold class are untouched: a spent row shows "sold" and greys like any sold row.
- `tools/lib/tuning-bot.mjs`: `export const BOT_RATION_DAYS = 3`; `chooseStorePurchase` gains a third pass after the weapon and armour passes. While `c.rations < BOT_RATION_DAYS * nightlyEats(state)` it returns the first `buyRations` line with `rationsLeft(line) > 0` and `storeBuyRefusal(c, line) === null`. One ration per call, so it can never offer a buy the engine refuses and `decideAction` can never loop on one.
- `tools/lib/days-farm.mjs`: `hoarderStorePick` picks the first `buyRations` line with stock left that `storeBuyRefusal` lets through (still returns `null` at the bag's ration cap). One ration per purchase, asked again on each decision; the old one-ration-per-visit note is retired. The farmer-policy JSDoc notes the wrapped fair bot now tops up rations too.

## Discretion note: GOLD_RESERVE

"About three days" is `BOT_RATION_DAYS x nightlyEats(state)` (engine/movement.js, the one definition `newDay` and `makeCamp` both read), so a Troll (eats 2) targets 6 and a Human with one Troll Joiner (1 + 2) targets 9. The ration pass deliberately does NOT apply `GOLD_RESERVE`: that constant's own comment says it is kept back for "a later repair/food need", and buying food is that need. It is gated by the engine's `storeBuyRefusal` instead (affordable against the whole purse, and the pack-cap refusal).

## Tests added

- `test/unit/store-rows.test.js`: `storeCountText` (7 left, 1 left, sold null, legacy line reads 1 left, non-Rations null, null line), the two `STORE_ROW_COPY` strings, `rationsFull` at the small-bag cap (disabled, refusal, reason text, key order unchanged), a Rations row with room, a sold-out row, and a DOM render pin (count in the italic sub, the reason appended at the cap, "sold" plus the greyed class when spent).
- `test/unit/storeScreen.test.js`: source pin for the new import and the row composition.
- `test/unit/bot-buy-policy.test.js` (8 new): `BOT_RATION_DAYS` is 3; Human tops up 1 -> 3 through the real `buyFrom` then `decideAction` leaves; Troll targets 6 and Human + Troll Joiner targets 9 from `nightlyEats`; weapon then armour are still bought before rations even when the Rations line is listed first; stops at the shelf, the purse and the pack cap without ever proposing a refused buy; null at or above the target; ignores `GOLD_RESERVE`; a legacy line without `left` is bought once.
- `test/unit/days-farm.test.js` (4 new): left 3 gold 100 gives exactly 3 buys (gold 10); left 10 with 8 rations in a small bag gives exactly 2 (cap); left 10 gold 70 gives exactly 2 (purse); a legacy line still returns its idx once. All driven through the real engine `buyFrom`.

## Declared moves

**Store snapshots (2 regenerated, declared in the `shell-tab-snapshots.test.js` header ledger).** Verified with `git diff --stat`: only these two fixtures differ; every other fixture is byte-identical.

| Fixture | Before | After | Reason |
|---|---|---|---|
| `mu-store.store.txt` | `Rations (+1 ration)` with no sub | `Rations (+1 ration)<i>6 left</i>` | the row now shows the d10 count from 87-02's derived `storeRations` stream for that fixture's seed |
| `thief-store.store.txt` | `Rations (+1 ration)` with no sub | `Rations (+1 ration)<i>3 left</i>` | same, that fixture's seed |

**Unit pins moved (2):**

- `test/unit/store-rows.test.js` "DOM (Phase 71, R-07)" byte pin: its expected composition for the Rations row (a legacy line with no `left`) now includes `storeCountText(item)` (`<i>1 left</i>`); food, the sealed scroll and the repair row still render byte-identically. Title amended to say so.
- `test/unit/shell-clarity-43.test.js` "Store rows ... sub composes" source pin: the `subText` regex now includes `storeCountText(item)` after `sub`. Not named in the plan's file list; it is a direct source pin on the line this plan changes.

**Bot state pins: none moved.** `roll-high-state-pins`, `tuning-bot`, `bot-tactics`, `class-matrix`, `control-rotation-bot`, `fight-gate`, `map-until-move`, `ablation-switch` and `trap-death-repro` all passed unmodified with the new policy, and the full suite confirms no other bot pin moved. Nothing was regenerated, so `roll-high-state-pins.test.js`'s ledger carries no Phase 87 paragraph (the plan asked for one only "if any of its labels moved"). No bot readout, sweep or fit was run.

## Verification

- Full `npm test`: tests 8119, **pass 8117, fail 0**, skipped 2 (baseline after 87-02: 8098 pass / 0 fail / 2 skipped; +19 new tests). The first full run failed once on the `shell-clarity-43` source pin above, fixed and re-run green.
- `git diff --stat -- engine/ firebase/` for this plan's commits prints nothing. `test/parity/prototype-master.js.txt` untouched.

## For Phase 92

**The fair bot now buys and eats store rations.** `chooseStorePurchase` tops `c.rations` up to `BOT_RATION_DAYS (3) x nightlyEats(state)`, one ration per purchase, after its weapon and armour passes, gated only by the purse and the pack cap. TUNE-10's baseline and starvation re-measure must note this: starvation deaths and gold at depth will differ from every earlier bot readout, and the DAYS-farm hoarder now needs several buy decisions per store visit rather than one.

## Deviations from Plan

**1. [Rule 3 - Blocking] `shell-clarity-43.test.js` source pin.** The first full run failed one test that pins `storeScreen.js`'s `subText` line verbatim. Updated its regex to the new composition. Not in the plan's `files_modified`. Re-verified green.

**2. Commit trailer.** The two task commits carry `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (my own harness-given line) plus the specified `Claude-Session:` line. Git printed CRLF-normalisation warnings on commit; nothing else to note.

**3. Plan-wording notes.** The plan says the ration pass runs after "both gear passes find nothing"; implemented exactly. The plan's roll-high re-pin ledger paragraph was conditional and is not needed (no pin moved).

## Known Stubs

None.

## Threat Flags

None. No new network, auth or trust-boundary surface; the row text is a static template filled with an engine integer.

## Human verification (deferred to end of run)

- [ ] Open a store: the Rations row shows "N left" under its name (N between 1 and 10).
- [ ] Tap BUY on Rations repeatedly: the count drops by one each tap; on the last one the row greys and reads "sold".
- [ ] With a full ration pack (small bag at 10), the Rations row is greyed and says "your pack holds no more rations".
- [ ] Arrows and tap-to-move modes both reach the store and the row behaves the same.

## Self-Check: PASSED

- FOUND: `export function storeCountText` in src/browser/viewModels.js; `storeCountText(item)` in src/browser/storeScreen.js; `export const BOT_RATION_DAYS = 3` and `BOT_RATION_DAYS * nightlyEats(state)` in tools/lib/tuning-bot.mjs; `rationsLeft(line) > 0` in tools/lib/days-farm.mjs
- FOUND commits: 027f0b66, 72f2ed19
- `git diff --name-only` on the shell-snapshots fixtures lists exactly mu-store.store.txt and thief-store.store.txt.
