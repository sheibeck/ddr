# v2.1 autonomous-run resume point

**Updated:** 2026-09-25 ~14:10 local, Phase 74 wave 1 in flight, Phase 75 planner in flight.

## Where the run is
- `/gsd-autonomous` is running milestone v2.1.
- Phases 72, 81 and 73 are COMPLETE and pushed.
- **Phase 74 is EXECUTING.** It has 8 plans in 4 waves: W1 is 74-01 and 74-02; W2 is 74-03, 74-04 and 74-05; W3 is 74-06 and 74-07; W4 is 74-08. The plans are committed (7cb462b and 7053e67).
  - Wave 1 was dispatched at base 7053e67. Its manifest is `<scratchpad>/wave-74-1.json`.
  - After a compact, check `git worktree list` and the `agent-*` branches for SUMMARYs. Merge each finished wave with `worktree.cleanup-wave`, run `npm test`, run `roadmap.update-plan-progress`, then dispatch the next wave. Copy the executor prompt pattern from `<scratchpad>/last-executor-prompt.txt`.
  - The orchestrator ACCEPTED 74-01 editing engine/derived.js and combat.js as a byte-identical extraction, as the planner proposed.
- **IN FLIGHT: the Phase 75 planner**, a background gsd-planner in NO-COMMIT mode. When it finishes, run the gates (requirements, decision coverage, plan-structure), then `state.planned-phase 75`, `annotate-dependencies`, and commit `docs(75): create phase plan`. Execute 75 only after 74 is complete.
- **Remaining order:** 74, 75, 75.1, 75.2, 75.3, 76, 77, 78, 79, 80 (with a researcher), then the lifecycle.
- The edge-probe reports are pre-built: `<scratchpad>/cov<phase>.json` for 75, 75.1, 75.2, 75.3 and 76-80.
- Every phase has a committed CONTEXT.md, so every one skips discuss.

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
