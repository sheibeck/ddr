# v2.1 autonomous-run resume point

**Updated:** 2026-09-26 ~04:30 local, all phases planned; 75.1 wave 4 in flight.

## Where the run is
- `/gsd-autonomous` is running milestone v2.1.
- **Complete and pushed:** 72, 81, 73, 74 and 75.
- **Phase 75.1 is EXECUTING** (9 plans in 7 waves). Waves 1–3 are merged, with master at 6,306 green.
  - Wave 4 (75.1-05 and 75.1-09) was dispatched at base 6ebcae3. Its manifest is `<scratchpad>/wave-75.1-4.json`.
  - Still to run: W5 06, W6 07, W7 08.
- **EVERY remaining phase is PLANNED and committed.** Each executes after the previous phase merges, in this order:
  - 75.2: 5 plans
  - 75.3: 7 plans. Plan 06 is the checkpointed sweep against the ruled tail targets.
  - 76: 5 plans
  - 77: 8 plans
  - 78: 9 plans
  - 79: 13 plans
  - 80: 6 plans, last
- **User rulings made during planning** are in each phase's CONTEXT ("rulings after planning" sections):
  - 75.1 fumble severity
  - 75.2 race signatures and Joiners
  - 75.3 hold, knee, wanderers and tail targets
  - 76 combat light and the Joiner persisting
  - 78 HUD-07 option A and the dead map viewable
- **At milestone close:**
  1. Publish `docs/narrative-pass/review.html` (79-13) as an artifact.
  2. The user judges the insanity death-cause tone at review (79-06).
  3. Run the batched Pixel 7 checklist.
  4. Build the debug APK.
  5. Offer a Play internal push, asking first.
- **USER-APPROVED PENDING EDIT:** after plan 80-02 lands, update the `.claude/CLAUDE.md` stack table: `@capacitor/status-bar` becomes the Capacitor 8 core SystemBars plugin. Also run `npm ci` in the main checkout after 80-02 merges.
- **Merge recipe:**
  1. In each worktree, run `git -C <wt> checkout -- test/unit/fixtures/shell-snapshots/`.
  2. Run `worktree.cleanup-wave`. If a rerun reports branch_mismatch, merge manually.
  3. Run `npm test`, parity and boot:check. boot:check is flaky, so rerun it once before judging.
  4. Run `update-plan-progress` for each merged plan, then commit.
  5. At phase end: write the VERIFICATION, run `requirements.mark-complete` and `phase.complete`, run `state.planned-phase` for the next phase, then commit and push.
- Watch executors with `<scratchpad>/watch.sh <base> <stall-min> <ids>`. The executor prompt pattern is in `<scratchpad>/last-executor-prompt.txt`. **Never `cd` into a worktree.**

## Captures (all routed and committed)
- Also added after the Phase 73 start: Phase 75 RULES-12 (a tile interrupted by a wanderer is resolved after the fight), RULES-13 (a magic staff is a wielded d8 weapon for Magic Users), RULES-14 (Bubble reflects the next attack and keeps a small pool), and RULES-15 (no rations, no spell refill). Phase 75.3 (deep-floor difficulty) covers RULES-16/17/18: foe count, the curve from floor 12, and control spells at depth. Phase 77 gets CMBUI-14 (combat ITEMS shows EQUIPPED and greys out gear) and Dazed honesty. Phase 78 gets HUD-09 (the full-bag find card), and the new-day refill line was folded into the charge rail item.
- Phase 75:
  - The Summoner's offense gate is removed (RULES-03 amended).
  - The Summoner's new weakness: healing spells it casts restore half (floor, min 1).
- Phase 77: Lesser Summon sorts with the level-1 spells. (The "missing from YOUR LOT" report was withdrawn by the user.)
- Phase 78:
  - A rail toast when a spell charge is regained (`spellChargeRecovered` is stale in ORACLE_ONLY).
  - HUD-08: a movement setting, tap-to-move or an on-screen arrow pad in the bottom-left or bottom-right; auto-scroll treats the pad as an edge.
- NEW Phase 75.2 Hero Size Matters (RULES-11):
  - race sets size;
  - each step gives ±2 damage and ±1 face for foes to hit you;
  - big/small rules read the hero's size;
  - Gauntlet and Enlarge are each +1 step, and Enlarge loses its +4.
- Phase 81: GRAVEYARD KEPT (the user reversed BOARD-14). It is ME-only, at the rail's end beside LINEAGE.
- The user declined a Play internal push after Phase 81 ("Not now"). Offer again at milestone close.

## Standing facts for the rest of the run
- **Per-wave merge:** after the executor returns, `worktree.record-agent` (use the TRUE base; an executor may misreport it) then `worktree.cleanup-wave --manifest <scratchpad>/wave-<phase>-<n>.json`.
  - If blocked, merge manually with `git merge --no-ff` after checking the merge-base, then remove the worktree and branch.
  - REQUIREMENTS.md conflicts: keep master's version, and mark requirements complete centrally.
- **The worktree CRLF noise is FIXED** (e52f711 made the ledger tests CRLF-tolerant). `npm test` must be 100% green everywhere; any failure is real.
- The 200-seed readout takes ~15 min, which is over the 10-min Bash cap, so it runs in the background and waits on the completion notification.
- **Research:** only Phase 80. **Verification agents are off.** The orchestrator writes each VERIFICATION with a `human_verification` list, and device checks are batched for milestone close. Build the debug APK after the last wave.
- **Stall watch:** a Monitor per executor watching commits plus tree/file-mtime hashes. Transcript .output files can be 0 bytes, so don't trust their size.
- When `phase.complete` runs on the highest phase, the STATE pointer can jump to a 999.x backlog item. Fix it by hand to the next phase in run order.
