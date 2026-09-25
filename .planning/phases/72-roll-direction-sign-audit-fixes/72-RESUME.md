# v2.1 autonomous-run resume point

**Updated:** 2026-09-25, after Phase 73 wave 1 merged (master 5,751/5,751 green).

## Where the run is
- `/gsd-autonomous` is running milestone v2.1. Phases 72 and 81 are COMPLETE and pushed. Phase 81 ran early, by the user's choice.
- **Phase 73 (Engine Roll-High Mirror) is executing:** 10 plans in 8 waves.
  - Wave 1 (73-01 helper + guard, 73-02 baselines, 73-03 rollRange + ledger verdicts) is MERGED and green.
  - The base readout matches Phase 72's AFTER block exactly.
  - **NEXT: wave 2 = 73-04** (hero strike, crits, foe soak), then 73-05 … 73-10, ONE plan per wave, in series. Each executes as a gsd-executor (sonnet) in a worktree, with a stall Monitor.
- **Remaining order after 73:** 74 → 75 → 75.1 → 75.2 (NEW) → 76 → 77 → 78 → 79 → 80 (researcher) → lifecycle.
- Every phase has a committed CONTEXT.md (discuss pre-collected), so every phase skips discuss: plan with `--skip-research` (except 80), then execute.

## Captures since the last compact (all routed and committed)
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
- **Worktree-only noise:** `core.autocrlf=true` gives 7 CRLF doc-ledger test failures ONLY inside worktrees. Tell every executor.
- The 200-seed readout takes ~15 min, which is over the 10-min Bash cap, so it runs in the background and waits on the completion notification.
- **Research:** only Phase 80. **Verification agents are off.** The orchestrator writes each VERIFICATION with a `human_verification` list, and device checks are batched for milestone close. Build the debug APK after the last wave.
- **Stall watch:** a Monitor per executor watching commits plus tree/file-mtime hashes. Transcript .output files can be 0 bytes, so don't trust their size.
- When `phase.complete` runs on the highest phase, the STATE pointer can jump to a 999.x backlog item. Fix it by hand to the next phase in run order.
