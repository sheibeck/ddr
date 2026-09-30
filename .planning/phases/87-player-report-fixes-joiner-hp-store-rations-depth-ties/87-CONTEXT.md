# Phase 87: Player-Report Fixes: Joiner HP, Store Rations & DEPTH Ties - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Three small, independent fixes: PARTY-11 (report #5, a Joiner's hp during a fight), STORE-04 (d10 rations per store, todo 2026-09-28) and BOARD-28 (report #9, DEPTH ties go to the MOST steps). Order inside the phase: PARTY-11, then STORE-04, then BOARD-28. BOARD-28 lives in its own plan(s) with no engine bytes, and no engine plan touches server files.

**Required reading for every plan:** `.planning/notes/v2.3-player-reports.md`, which holds the full bodies of reports #5 and #9 with the Oracle logs the players submitted (user, 2026-09-29: "make sure those github issues include the submitted oracle logs to help troubleshoot").

</domain>

<decisions>
## Implementation Decisions

### Joiner hp during a fight (PARTY-11, #5)
- **Root cause (orchestrator scout, confirmed in code):** a foe hit on a Joiner subtracts from the fight's roster entry (`member.wp -= mDmg`, `engine/combat.js` ~L3429). The persistent sheet `state.party[i].wp` is synced from the roster only at `endCombat` (`engine/combat.js` ~L1811-1813). YOUR LOT reads the sheet (`src/browser/combatPanel.js:204`), so mid-fight it shows stale hp: "Cave Bear turns on Zell Bonecrack for 11 hp", still 30/30. The user's alternative theory ("it's possible that Joiner hit point issue was just his armor soaking a hit") is ruled out, because the member branch has no armour soak at all. The executor re-confirms both points against the #5 Oracle log before fixing.
- **Fix in the presentation layer:** add one view helper (e.g. `memberLiveWp(state, partyIdx)` → `{ wp, maxWP }`) that reads the live `state.combat` roster entry while a fight is on and the sheet otherwise. The engine is untouched and no fixture moves.
- **Every party display uses the helper:** YOUR LOT (combat panel), the Hero Company panel, long-press or member details, and any other place that shows Joiner hp. It covers heals and every other mid-fight hp change as well as hits.
- **Joiner armour never soaks a hit.** Record this as a finding for the item phases (Phase 88/89, ITEM-06 "missing systems") and don't build it here. Note it in the SUMMARY so the Phase 89 audit picks it up.
- **Test:** pin the #5 scene. A foe hits a Joiner mid-fight and the card view-model shows the reduced hp (for example 19/30) before the fight ends.

### Store rations (STORE-04)
- **Each BUY tap buys one ration.** The Rations row stays in the store with its remaining count (for example "Rations · 7 left") until the stock hits 0, then shows as sold out or greyed like other sold rows. There is no count picker.
- **Stock roll:** d10 (1–10) rolled when the store opens, from a DERIVED rng stream (`makeRng(hash(seed, "storeRations", …))`, keyed so it is stable per store), so `genFloor` and the existing store draws don't reorder. The count lives on the stock line (for example `left`) so it survives save, load and relaunch (open stores already persist through a relaunch, v2.1 SAV). Old saves load tolerantly: a Rations line with no count is read sensibly.
- **Price per ration is unchanged:** `RATIONS_BASE_PRICE` 30 through `priceFor` (race and sub-class adjusted).
- **Engine touch points:** `engine/economy.js` builds the Rations line (~L452) and `buyRations` (~L232). `buyFrom` today marks a row sold after one purchase; the Rations row must stay buyable until its count is spent. Every new or changed event gets an EVENT_NARRATION entry, and the existing `rationsBought` line stays.
- **Bot:** `tools/lib/tuning-bot.mjs`'s store purchase keeps its current ration target and buys one ration per purchase up to that target, affordable and in stock (also check `test/unit/bot-buy-policy.test.js` and `tools/lib/days-farm.mjs`). There is no bot readout (bots only at the milestone end, Phase 92).
- **Flat d10 at every depth.** No depth scaling.
- **Fixtures:** measure which fixtures move (economy/store), declare them with a before/after rationale, and regenerate only those. `test/parity/prototype-master.js.txt` is never edited, and the new count field is carved out of the comparables if needed.
- **UI:** `src/browser/storeScreen.js` shows the count left on the Rations row.

### DEPTH ties go to the most steps (BOARD-28, #9)
- **Keep the `deepKey` field and change the formula** to `floor × 1,000,000 + steps` (steps capped at 999,999, the existing STEPS_MAX). This reverses v2.1 BOARD-17 ("deepest, then fewest steps"), because report #9 wins. All 19 composite indexes stay (same field, same direction).
- **Touch points:** `src/browser/runDoc.js` `deepKeyOf` (L122-127, plus the JSDoc/comments that say "fewer steps"), its validator (~L270), `firebase/firestore.rules` `deepKeyOf` (~L155-160) and its check (L148), `src/browser/fakeBoardServer.js`, `tools/boards-smoke.mjs`, the rules JS mirror and its tests, and any board copy that explains the tie-break.
- **Shipped 2.2.0 / vc12 clients** keep writing the OLD formula, and today's rules require `deepKey == deepKeyOf(d)`. Use a v2.2-style transition:
  - Transition rules accept `deepKey` matching EITHER the old or the new formula. They go in a transition rules file, the same pattern as v2.2's transition rules, with tests for both formulas and a refusal for any third value.
  - The 2.3 client writes the new formula.
  - A new admin re-key operation (extend `tools/boards-admin.mjs`) rewrites every doc whose `deepKey` matches the old formula to the new one. It supports a dry run and is idempotent.
  - At the 2.3 release: run the re-key. At the final-rules cutover (once 2.3 is live on the track): deploy the final rules (new formula only) and run the re-key once more. Those release steps go into `docs/RELEASING.md` for v2.3.
  - Until a re-key, a 2.2.0 run only mis-orders among runs tied on the same floor, which is accepted.
- **Local boards follow the same rule:** ME boards, personal bests and the local record ordering (`engine/records.js`, `src/browser/boardScores.js` or wherever the local DEEPEST ordering lives) use "deepest, then most steps", and stored local records re-rank on load (tolerant, no migration ceremony).
- **Live deploy is a user checkpoint.** At the END of Phase 87, deploying the transition rules to the live Firebase project (`delve-die-repeat-6ba5f`) is a `checkpoint:human-action` or decision for the user. They must be live before any 2.3 client submits, and they are harmless to 2.2.0. The re-key and final rules happen in the release steps, not in this phase. Never deploy without the user's go.

### Claude's Discretion
- The helper's exact name and module, and whether Hero Company and YOUR LOT share one view-model function.
- The exact derived-stream key for the ration roll (it must be stable per store and never touch the main stream).
- The re-key tool's CLI shape, as long as it has a dry run, is idempotent and has a count report.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/combat.js` ~L402-414: the fight roster carries `partyIdx` so `endCombat` can sync hp out (~L1811). `combatPanel.js` builds the member cards from `state.party` (~L202-212).
- `engine/economy.js`: `buyRations` (~L232), the Rations stock line (~L452), `priceFor`, `RATIONS_BASE_PRICE`, the `add()` stock builder and `replaceStockLines`.
- `engine/rng.js` `makeRng` + hash: the derived-stream pattern used across v1.5–v2.1.
- `src/browser/runDoc.js`: `deepKeyOf`, `rankKeys`, the doc validator and the structured queries. `firebase/firestore.rules`: `deepKeyOf` and the key checks. `tools/boards-admin.mjs`: the admin and moderation tooling. `tools/boards-smoke.mjs`: the live smoke.

### Established Patterns
- Greenfield: no dual code paths, old saves tolerant-load only, only the moved fixtures declared and regenerated.
- v2.2 rules transition: transition rules first (compatible with the shipped client), final rules plus probes at release, transition files deleted after.
- Executor commits: plain `git commit` with the attribution trailers, never amend or reset (see the executor dispatch rules).

### Integration Points
- Store screen `src/browser/storeScreen.js`, the bot `tools/lib/tuning-bot.mjs`, and the leaderboards panel copy for the tie-break.

</code_context>

<specifics>
## Specific Ideas

- The #5 scene: "Cave Bear turns on Zell Bonecrack for 11 hp", and the card must read 19/30 at once.
- The #9 wording: "Depth leaderboard should defer to depth, then most steps."
- The store row: "Rations · 7 left".

</specifics>

<deferred>
## Deferred Ideas

- Joiner armour soaking foe hits: a missing system for Phase 88/89 (ITEM-06).
- The final-rules cutover and the re-key runs: the v2.3 release steps (`docs/RELEASING.md`).

</deferred>
