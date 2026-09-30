---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
status: passed
verified: 2026-09-30
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 5/5
human_verification:
  - "With a Joiner in the party, a foe hit on the Joiner drops its YOUR LOT card by that amount on the same beat; mid-fight the Hero-tab Company panel shows the same hp; a Joiner at 0 shows DOWN (never \"0/30\") and both displays still agree after the fight (87-01)"
  - "Open a store: the Rations row reads \"N left\" (1-10); each BUY tap drops it by one, the last one greys the row as sold with the Oracle's last-ration line; Save & Quit mid-store and relaunch keeps the same count (87-02, 87-03)"
  - "Small bag at 10 rations: the Rations row greys with \"your pack holds no more rations\" and a buy moves no wilmst (87-02, 87-03)"
  - "Leaderboards ME DEPTH: two same-floor runs list the one with more squares walked first; the DEPTH rule line says ties go to more squares walked; after updating over 2.2.0 the ME list re-orders on first open without losing a run (87-04)"
  - "BOARD-28 live, DEFERRED by the user 2026-09-30 (runs before the milestone-end debug-APK device testing with Compete ON or at Release 2.3.0 step 1, whichever comes first): the user's go, then firebase deploy --only firestore:rules,firestore:indexes --config firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive; 19 READY indexes; node tools/boards-smoke.mjs --transition (2.3 key accepted, 2.2.0 key accepted, a third refused); optional read-only rekey-deep census. Then on the 2.3 debug APK: two same-floor deaths rank most-steps-first on ALL DEPTH, \"You placed #N\" matches the board, and a 2.2.0 tester's death still appears (87-05, 87-08; docs/LEADERBOARDS.md section 14)"
  - "Release 2.3.0 DEPTH-key steps (docs/RELEASING.md): rekey-deep --yes at the release; final rules plus rekey-deep again at the cutover; transition files deleted after (87-06, 87-07)"
  - "Leaderboards row: an opened row shows e.g. \"Dwarven · Wizard (Magic User)\" with FILTER LIKE THIS; a long press gives a light haptic and the FILTER LIKE THIS sheet without opening or closing the row; a pick sets RACE and/or SUB-CLASS and reloads, CANCEL changes nothing; a press that turns into a scroll opens nothing and selects no text; TalkBack reads the changed picker and back closes the menu; the combat foe long press still opens the foe card (87-09)"
  - "RANK BY opened from the title and from the DEAD tab shows WILMST and its rule line fully above the navigation bar (gesture and 3-button navigation, largest text size); RACE, SUB-CLASS and FILTER LIKE THIS sheets reach their last option; no extra dead band above the in-game tab bar (87-10)"
---

# Phase 87: Player-Report Fixes: Joiner HP, Store Rations & DEPTH Ties — Verification

**Goal:** A Joiner's hp shows every hit it takes, each store stocks a visible supply of up to ten rations, and DEPTH ties rank by the most steps.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | A foe hit on a Joiner takes that hp off at once (report #5: Cave Bear 11 takes Zell Bonecrack 30/30 → 19/30) and YOUR LOT, the Hero Company panel and every other party display show it | 87-01: `src/browser/partyHp.js#memberLiveWp` reads the live fight roster entry (`state.combat.allies` by `partyIdx`) during a fight and the sheet otherwise; both party displays that show Joiner hp read it (`combatPanel.js:212` YOUR LOT, `heroTab.js:599` Company panel; no other shell display reads a member's hp). `test/unit/joiner-live-hp.test.js` drives the real `foeTurn` and pins the #5 scene ("a Cave Bear hit on Zell Bonecrack shows on YOUR LOT and the Company panel before the fight ends"). Zero engine bytes | ✓ |
| 2 | Opening a store rolls 1–10 rations, the store shows how many are left, they sell one at a time until none remain, the count survives save and load, and the fair bot tops up to about three days of party ration upkeep | 87-02: `engine/economy.js` `RATIONS_STOCK_DIE = 10`, `rollRationsStock` on the derived `"storeRations"` stream (zero main-rng draws, stock order unchanged), `rationsLeft` (tolerant: old saves read 1/0, tampered counts cap at 10), `buyFrom` sells one per tap, `rationsSoldOut` / `rationsFull` narrated, cap refusal before any gold moves. `store-rations-stock.test.js` includes "save/load mid-store keeps the remaining count and never re-rolls". 87-03: `storeCountText` "N left" on the Rations row, pack-full reason; `BOT_RATION_DAYS = 3` × `nightlyEats(state)` in `tools/lib/tuning-bot.mjs`, DAYS-farm hoarder buys one per purchase to its cap (`bot-buy-policy.test.js`, `days-farm.test.js`) | ✓ |
| 3 | DEPTH ties rank most steps first; runs already on the server re-rank without resubmission; a shipped 2.2.0 client's run ranks correctly too | 87-04: local DEPTH / LINEAGE / GRAVEYARD comparators (`engine/records.js`) floor desc then most steps, stored lists re-sort on load. 87-05: `deepKeyOf = floor * 1,000,000 + steps` (`runDoc.js:132`), final rules match; `firebase/firestore.transition.rules` accepts exactly the new or the vc12 formula from the doc's own floor and steps and refuses any third value (`firestore-transition-rules.test.js`); the 87-04 interim deep-pair pin is back on `compareRuns("deep", a, b)` (`runDoc.test.js:415`). 87-06: `boards-admin.mjs rekey-deep` (dry run by default, idempotent, single-field PATCH) re-keys existing and 2.2.0-written runs. 87-07: `boards-smoke --transition` probe and the Release 2.3.0 steps. Per the recorded decision (87-CONTEXT), a 2.2.0 run mis-orders only among same-floor ties until a re-key, which is accepted. The live deploy is DEFERRED by the user (87-08, "defer", 2026-09-30); the live proof is listed in human_verification | ✓ (live proof pending the user's deferred deploy) |
| 4 | An expanded row states race and sub-class; a long press offers filter by race / sub-class / both, a pick sets the filters and reloads; the long press never toggles the row | 87-09: `leaderboardView.js` detail line (race · sub-class), `content/boards.js` FILTER LIKE THIS menu copy, `leaderboardPanel.js` menu (validated twice against RACE_IDS / SUB_IDS), `mazeworld.html` board-row long press with its trailing click folded into the one shared window click suppressor (`mazeworld.html:7540`); `board-row-menu-shell.test.js`, `leaderboardPanel*.test.js` | ✓ |
| 5 | RANK BY and every leaderboard sheet show the last option (WILMST and its description) in full above the navigation bar at the smallest screen and largest text scale | 87-10: `.mw-lb-sheet-opts` pads its bottom by `calc(26px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))` on the title-opened panel and resets to 26px in game, where the tab bar already pads it (`mazeworld.html:1491-1492`); the list scrolls inside the capped panel; pinned in `leaderboard-css.test.js`. Device checks listed | ✓ |

## Requirements

PARTY-11 ✓ · STORE-04 ✓ · BOARD-28 ✓ (code, tooling and release steps done; live proof pending the user's deferred deploy) · BOARD-29 ✓ · BOARD-30 ✓

## Automated checks

- Full `npm test` re-run by the orchestrator on HEAD `f4e78fcb` (2026-09-30): **8172 tests, 8170 pass, 0 fail, 2 skipped** (152.9 s). Matches the 87-10 close.
- Engine gate over the phase range (`ea4f0e48..f4e78fcb`, 36 commits): `test/parity/prototype-master.js.txt` untouched; no `test/parity/` change; engine bytes only in `engine/economy.js` (STORE-04, derived stream) and `engine/records.js` (BOARD-28 local comparator).
- Declared pin moves: `store-roll.test.js` static Rations line (87-02); shell snapshots `mu-store.store.txt` and `thief-store.store.txt` (87-03); `boardFeed.test.js` steps expectation (87-05); `runDoc.test.js` deep-pair pin (interim in 87-04, restored in 87-05).
- Code review, regression gate and security gate: inactive per project config (first phase of the milestone; no prior VERIFICATION.md in `.planning/phases/`).

## Execution notes

- Ten plans in ten waves; 87-08 (the live deploy checkpoint) ran last and took the user's "defer" branch: nothing ran against the live project (no `firebase deploy`, `boards-smoke`, `boards-admin` or `rekey-deep`). The live project still runs the 2.2.0 final rules.
- BOARD-29 and BOARD-30 were added after planning from the user's 2026-09-29 todos.
- Finding carried forward: a Joiner's armour never soaks a foe hit (87-01), recorded for Phase 89 (ITEM-06); nothing built here.
- Phase 92 baseline note: the fair bot now buys rations from stores (`BOT_RATION_DAYS = 3`).
- Two task commits (87-02, 87-03) carry a `Claude Sonnet 5.5` co-author trailer; left as-is rather than rewrite history.
