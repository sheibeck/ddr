# v2.1 autonomous-run resume point

**Updated:** 2026-09-25 ~15:45 local, Phase 75 wave 1 in flight, Phase 80 planner in flight.

## Where the run is
- `/gsd-autonomous` is running milestone v2.1.
- Phases 72, 81, 73 and **74 are COMPLETE and pushed**. Master was 5,986/5,986 green at 4076858.
- **Phase 75 is EXECUTING.** It has 13 plans in 6 waves: W1 is 01-04, W2 is 05-06, W3 is 07-08, W4 is 09-10, W5 is 11-12, and W6 is 13. The plans are committed (29c950c).
  - Wave 1 was dispatched at base 4076858. Its manifest is `<scratchpad>/wave-75-1.json`, and it is watched by `<scratchpad>/watch.sh <base> <stall-min> <ids>`.
  - 75-01 is the RULES-06 root-cause debug session. 75-08 (the fix) depends on its documented Fix inputs.
  - Readouts go to `tools/readouts/75-NN-{before,after}.txt`. Only 75-13 writes `docs/DIFFICULTY-RETUNE.md`.
  - After a compact:
    1. Check `git worktree list` and the `agent-*` branches for SUMMARYs.
    2. Merge each finished wave with `worktree.cleanup-wave`. It blocks on worktree-only line-ending noise in the shell snapshots, so run `git checkout -- test/unit/fixtures/shell-snapshots/` in the worktree first. If it reports branch_mismatch on a rerun, merge manually.
    3. Run `npm test`, then `roadmap.update-plan-progress`, then dispatch the next wave. The prompt pattern is in `<scratchpad>/last-executor-prompt.txt`.
- Accepted Phase 75 planner calls:
  - RULES-03 legality = the school gate only; canon grants are kept.
  - The cache pays 100 × depth.
  - A wielded staff is not magic vs magic-only foes.
  - A Summoner's Heal scroll heals half.
- **USER-APPROVED PENDING EDIT (2026-09-25):** after plan 80-02 lands, update `.claude/CLAUDE.md`'s stack table. Replace the `@capacitor/status-bar` row with Capacitor 8's core SystemBars plugin, which ships in `@capacitor/core` and needs no extra package. Also run `npm ci` in the main checkout after 80-02 merges.
- Phase 80 is PLANNED (aa2129b): 6 plans in 4 waves.
- **Remaining order:** 75, 75.1, 75.2, 75.3, 76, 77, 78, 79, 80, then the lifecycle.
- The edge-probe reports are pre-built: `<scratchpad>/cov<phase>.json` for every remaining phase.
- `boot:check` is environment-flaky on this machine. Rerun it once before judging.

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
