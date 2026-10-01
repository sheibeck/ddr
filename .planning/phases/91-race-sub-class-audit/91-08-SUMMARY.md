---
phase: 91-race-sub-class-audit
plan: 08
subsystem: identity-rules
tags: [pickpocket, cutthroat, troll, wilmsry, store-prices, joiners, idents, rulings, fixtures]
requires:
  - phase: 91-race-sub-class-audit
    provides: "91-01's rulings (Q1 B, Q5 A, Q8 A) and the audit rows; 91-05's foeSpoils (kills and parleys share it); 91-07 as the plan base"
provides:
  - "IDENT-18: a Pickpocket's extra item from every chest and monster drop (items.js#pickpocketExtra, derived stream)"
  - "Q1 B: the Pickpocket's extra gold take retired (gainWilmst takes no draw)"
  - "IDENT-19: the Cutthroat's Joiner check is a d10 on every descent with a Joiner"
  - "IDENT-21: Troll prices doubled, no weapon double on top; the Wilmsry refuses Magic User Joiners (wording only)"
  - "Q5 A: selling pays every race the ordinary price; Q8 A: every non-tool store line takes the race and Pickpocket buy rule"
affects: [91-10, phase-91.1, phase-92]
tech-stack:
  added: []
  patterns:
    - "a hero-only bonus item drawn from derivedRng(cursor, key, acts, pile length) so the main stream is a twin hero's"
    - "one price helper (px) per openStore so every routed line, including the storeRoll rewrites, takes the same rule once, at open"
key-files:
  created:
    - test/unit/pickpocket-item.test.js
    - test/unit/troll-prices.test.js
    - docs/narrative-pass/why/91-08.json
  modified:
    - engine/items.js
    - engine/combat.js
    - engine/encounters.js
    - engine/movement.js
    - engine/economy.js
    - content/identity.js
    - content/flavor.js
    - content/races.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - docs/IDENTITY-AUDIT.md
    - test/parity/FIXTURE-INVENTORY.md
key-decisions:
  - "The extra goes into state.pendingLoot (the spoils pile) for a chest too, because the find card holds one item; the key is derivedRng(cursor, 'pickpocket', acts, pile length)"
  - "Q1 B built as ruled: the Pickpocket's gold take is removed (not kept), so pickpocket-take is a retired audit record"
  - "Q5 A built as ruled: sellPriceFor ignores the race argument and keeps the Pickpocket's x0.75"
  - "Q8 A built as ruled (against the recommendation): potions, food, lockpicks and the sealed scroll go through priceFor; Torch, Rope and Ladder stay flat"
  - "The Cutthroat footer reads 'a 1 kills that Joiner' (not 'on a 1') because the footer hygiene scan bans a low face named after 'on a'"
requirements-completed: [IDENT-18, IDENT-19, IDENT-21]
status: complete
completed: 2026-10-01
---

# Phase 91 Plan 08: Pickpocket, Cutthroat, Troll and Wilmsry rulings Summary

**A Pickpocket gets one extra item (from its own derived stream) whenever a monster or chest gives it one and loses its gold take; a Cutthroat rolls a d10 on every descent with a Joiner; a Troll's prices are doubled, selling pays every race the ordinary price, and every non-tool store line now takes the race and Pickpocket buy rule.**

## What was built

1. **IDENT-18 and Q1 B (commit 48c18714).** `items.js#pickpocketExtra(state, rng, events)` rolls `rollTreasureItem` on `derivedRng(<rng cursor or 0>, "pickpocket", <state.acts>, <pile length>)` and `offerLoot`s it with `{ pickpocket: true }`. `combat.js#foeSpoils` calls it right after a passing drop's own `offerLoot` (a kill and a won parley both reach it, and `foeSpoils` counts it in `items`), and `encounters.js#openChest` calls it right after `offerFind`. The extra is its own pile entry (never merged, even when it is the same item; a bag-upgrade drop and the extra are both kept), lands immediately after the item it follows with its `lootDropped` right behind that item's event, and is hero-only. A failed drop check, a locked chest, a Faerie gift, a Misc Magic find, a gear find and a store purchase never reach it. `gainWilmst` lost the Pickpocket branch: no draw, no `goldGained { why: "pickpocket" }`. The main rng after a Pickpocket's kill or chest is exactly a Cutthroat twin's (pinned).
2. **IDENT-19, IDENT-21, Q5, Q8 (commit 3ce939e0).** `cutthroatMurderCheck` rolls `rng.d(10)` where the d20 sat (last in `descend`), `joinerMurdered.dieN` 10. `priceFor` doubles for the exact key `"Troll"`; `openStore`'s weapon line is `priceFor` alone (the old x6 is gone); `sellPriceFor` no longer reads the race; `openStore` routes food, potions, lockpicks and the sealed scroll through one `px` helper (the storeRoll potion and weapon rewrites share it); the three tools stay flat; the Wilmsry haggle still reaches every line. `meetJoiner` behaviour is unchanged, its comment and every line now say the Wilmsry refuses.
3. **Text, ledger, audit, drift (commit 6d43bfdf).** The Pickpocket's extra item has its own Oracle line ("Your fingers find a second one: ...") and rail twin ("Light fingers: ... too."); the Wilmsry refusal is in the Wilmsry's voice on both surfaces; the store line says "Trolls pay double"; the rail's "(Pickpocket)" gold suffix is retired. Traits: `pickpocket-item` (new), `pickpocket-take` and `troll-weapons` removed, `cutthroat-joiner`, `troll-prices`, `wilmsry-joiners` reworded, the Elven and Dwarven proofs renamed. Blurbs: `SUB_NOTE.Pickpocket`, `SUB_NOTE.Cutthroat`, `RACE_NOTE.Troll`, `RACE_NOTE.Wilmsry`, `RACES.Wilmsry.note`. `docs/narrative-pass/why/91-08.json` holds 19 rows; the narrative pages were regenerated and `--check` is in sync. `docs/IDENTITY-AUDIT.md` rows read `fixed engine (91-08)`, `fixed text (91-08)` or `retired (91-08)` with Pinned by, and Rulings Q1, Q5 and Q8 are marked built.

## Q1 and Q5 outcomes (and Q8)

- **Q1 B (built as ruled):** the extra item replaces the Pickpocket's extra gold take. The d10 + d10 + d4 on every coin gain is gone (three main-rng draws, the `goldGained` pickpocket beat, the "(Pickpocket)" rail suffix, the `pickpocket-take` trait and the blurb's "percentage of everything" claim). The shop drawback is exactly as before (buy x1.25, sell x0.75 of the ordinary price).
- **Q5 A (built as ruled):** an Elf, a Dwarf, a Troll, a Wilmsry and a Human are paid the same for the same item; a Pickpocket keeps x0.75. The race multiplier is a buying rule only.
- **Q8 A (built as ruled, against the recommendation):** every stock line except the three flat tools takes Elven/Dwarven half, Troll double, Pickpocket x1.25. A Healing potion is now 150 / 75 / 300 / 188 for a Human, an Elf, a Troll and a Pickpocket. No difference from what the ruling asks.

## Flagged assumption (IDENT-19)

"Descend with a Joiner" is read as **every descent** (the stairs, and a legacy gate tile; both go through `descend`) with one or more party members. PARTY_CAP is 1, so it is one d10 per descent. The d10 replaces the d20 at the same draw position (last in `descend`, after `checkLevel` and `genFloor`), so it is not a new roll and needs no derived stream. A kill is named in its own narrated line (the Oracle line and the rail twin both include the Joiner's name, pinned).

## Fixture drift (IDENT-18, IDENT-19, IDENT-21)

Full before/after in `test/parity/FIXTURE-INVENTORY.md`, "### Phase 91 plan 08". In short, measured against the plan base `f807790c`:

- **Parity 66 of 66 pass**, with one declared record updated: `action-script.economy.json` `divergence.stockAfter` (Chicken 20 to 25, Bread 15 to 19, Meat 25 to 31, Healing potion 150 to 188, Xtra Healing 500 to 625, Strength 100 to 125, Speed 500 to 625, lockpicks 450 to 563) and `after.gold` 2066 to 1785. `test/parity/prototype-master.js.txt` is untouched.
- **Roll-high state pins: 8 of 8 unmoved; save-compat unchanged.** No label re-recorded; `roll-high-baseline.mjs save` was never run.
- **Draws:** the Pickpocket's extra item adds no main-rng draw; `gainWilmst` loses three per coin gain; the Cutthroat swaps `d(20)` for `d(10)` (same count, same position).
- **Pins re-recorded alone:** `test/determinism/foe-abilities.test.js` `humans-t2` 17 to 14 draws; `roll-high-guard` DRAW_INVENTORY `engine/items.js` `amount` 8 to 5; `parley-rewards` KILL_GOLDEN seed 3 (gold 143 to 60, coin 93 to 10, cursor moved) and its Pickpocket parley pin; the one event-order corpus label (`+12 wilmst (Pickpocket) ×2` to `+12 wilmst ×2`, two lines, pasted by hand; the corpus was NOT regenerated because that rewrites 105 of 182 cases with unrelated drift); `thief.hero.txt` shell snapshot (three text lines); the Troll and Pickpocket price pins in `economy.test.js`, `store-sell.test.js`, `item-audit-fixes.test.js`, `identity-footer.test.js`, `identity-contract.test.js`; the Troll Knight bot seed 4 swapped for seed 1 in `bot-tactics.test.js` (seed 4 now falls into the documented campFailed loop).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Cutthroat footer cannot say "on a 1"**
- **Found during:** Task 2
- **Issue:** the plan's wording "roll a d10: on a 1 that Joiner dies" fails `identity-footer.test.js`'s hygiene scan (`/\bon a [1-4]\b/`).
- **Fix:** "whenever you descend with a Joiner, roll a d10: a 1 kills that Joiner" (the user's rule, same meaning).
- **Files modified:** content/identity.js, test/unit/identity-contract.test.js
- **Commit:** 3ce939e0

**2. [Rule 1 - Bug] Pins and guards that read what this plan moved**
- **Found during:** Tasks 2 and 3 (targeted sweeps)
- **Issue:** tests outside the plan's file list pinned the old values: `parley-rewards` (91-05's Pickpocket gold pin and KILL_GOLDEN seed 3), `items.test.js`, `joiner-level-cap.test.js`, `narrationLinesTable.test.js`, `size-voice.test.js`, `item-audit-fixes.test.js`, `store-sell.test.js`, `foe-abilities.test.js` (determinism), `roll-high-guard.test.js`, `bot-tactics.test.js`, the event-order corpus, the economy parity record, the `thief.hero` snapshot, `identity-audit.test.js` PRE_REGISTERED.
- **Fix:** each was re-recorded or rewritten alone with a dated comment naming Phase 91 plan 08 (before and after in FIXTURE-INVENTORY).
- **Commits:** 48c18714, 3ce939e0, 6d43bfdf

**3. [Rule 2 - Missing critical functionality] The 79-03, 79-11, 79-12 and 91-05 ledger rows**
- **Found during:** Task 1
- **Issue:** `node tools/voice-inventory.mjs --check-ledgers --after` (and the 79-03 ledger test) failed because those plans' last `after` for the Pickpocket, Cutthroat, Troll and Wilmsry footer, trait and `rail:joinerRefused` keys was no longer current.
- **Fix:** 91-08.json chains a row from each (the 79-03 identity-footer test treats a later plan's key as superseding it).
- **Commit:** 6d43bfdf

**Between commits.** After commits 1 and 2 `identity-audit.test.js` and the 79-03 ledger test failed on purpose (the audit rows and ledger rows were Task 3's work, as the plan splits it); both are green at 6d43bfdf.

**Testing.** Per the user's 2026-10-01 rule, `npm test` was NOT run. Run instead, all passing: the plan's three verify lists (157 + 190 tests), `test/parity` glob (66), `roll-high-state-pins` + `save-compat` + `roll-high-guard` (24), `identity-audit` + `voice-corpus` + `narrative-review` + `shell-tab-snapshots` (70), `node tools/narrative-review.mjs --check` (in sync) and `--check-ledgers --after` (0 errors), plus keyword-targeted sweeps of the test files that name what this plan touches (3,316 tests), the seed-3 files (751), every test that reads an engine, content or src file (2,265) and the determinism, roundtrip, persistence, voice and difficulty directories (179). The CRLF doc-ledger failures the plan warned about did not occur (the doc-reading tests normalize CRLF).

## Known Stubs

None.

## Threat Flags

None: no new endpoint, auth path or file access.

## Human verification (deferred to end of run)

1. As a Pickpocket, open a chest: the find card offers the usual item and the loot pile holds one more, with a line saying your fingers found a second one. Kill something that drops an item: two entries in the pile.
2. As a Troll, open a store: every price (weapons too) is twice what a Human pays; potions and food too (Healing potion 300), but the Torch, Rope and Ladder stay flat. Sell something: the price is the same as a Human would get.
3. As a Wilmsry, meet a Magic User Joiner: the line says you refuse to travel with them.
4. As a Cutthroat with a Joiner, descend several floors: when a Joiner is lost (one descent in ten), the line names them.
5. As an Elf or Dwarf, a store halves potions, food, lockpicks and the sealed scroll as well as gear; as a Pickpocket they cost a quarter more (Healing potion 188).

## Self-Check: PASSED

- FOUND: test/unit/pickpocket-item.test.js, test/unit/troll-prices.test.js, docs/narrative-pass/why/91-08.json, engine/items.js (`pickpocketExtra`)
- FOUND commits: 48c18714, 3ce939e0, 6d43bfdf
- `git diff --stat -- test/parity/prototype-master.js.txt` prints nothing; STATE.md, ROADMAP.md and REQUIREMENTS.md untouched
- `node -e "import('./engine/economy.js')..."` priceFor(100, 'Troll') is 200; `grep -c "rng.d(10)" engine/movement.js` 3, `dieN: 10` 2, `pickpocket-item` in content/identity.js 1; RACE_NOTE.Troll no longer says triple
