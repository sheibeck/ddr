# v2.1 autonomous-run resume point

**Updated:** 2026-09-26 ~16:40 local (compact point).

## Where the run is (compact point 2026-09-26 ~16:40 local)
- `/gsd-autonomous` is running milestone v2.1.
- **Complete and pushed:** 72, 81, 73, 74, 75, 75.1 and 75.2 (75.2 closed at 5f09cec3).

### Phase 75.3 (EXECUTING, 6 plans; 75.3-06 moved to 79.1)
- Waves 1 and 2 are merged: 01 (foe count by depth), 02 (tools) and 03 (curve + elites). Master was 6,563 green before the 80 split commit a32fb95.
- **75.3-04 (control at depth) is DONE but NOT MERGED.**
  - Branch: `worktree-agent-a6fb26a7737bfd582`. Worktree: `.claude/worktrees/agent-a6fb26a7737bfd582`. Base: a53405f.
  - Manifest: `<scratchpad>/wave-75.3-3.json`. Its npm test was 6598 green.
  - NEXT: merge it (`worktree.cleanup-wave --manifest <scratchpad>/wave-75.3-3.json`), run npm test and parity, then `roadmap.update-plan-progress 75.3 75.3-04 complete`.
- Remaining: wave 4 = 75.3-05 (hero spells, scrolls and items under the resist rule; the bot treats Freeze as a hold), then wave 5 = 75.3-07 (non-bot close-out only).
- Then 75.3's VERIFICATION, `phase.complete 75.3`, and `state.planned-phase 76`.

### Phase 80 CODE part (IN FLIGHT, parallel with the gameplay chain)
- Four worktree executors were dispatched at base a32fb95 (manifest `<scratchpad>/wave-80-1.json`):
  - 80-01 (R8 config + API scanner): agent add4ee435865f0c87
  - 80-02 (SystemBars swap): a30a2555408c795c8
  - 80-03 (letterbox CSS): ae911d6e883e6612d
  - 80-06 (fit-tool CLI test): aeb8c305be0e18d4a
- When they return, merge the wave (cleanup-wave; manual `merge --no-ff` if blocked), then run npm test.
- **After 80-02 merges, the orchestrator must:**
  1. Run `npm ci` in the main checkout.
  2. Update the `.claude/CLAUDE.md` stack table: `@capacitor/status-bar` becomes the Capacitor 8 core SystemBars plugin (user-approved).
- Phase 80 BUILD part (80-04: the ONE release build; 80-05: the emulator pass) runs ONLY after Phase 79.1. Both plans gate on 79.1-VERIFICATION.md.

### Order after 75.3
76 → 77 → 78 → 79 → **79.1** (NEW: the milestone-end bot pass + deep-floor tuning sweep; plan it from `79.1/SOURCE-75.3-06-sweep-plan.md` plus the deferred readouts) → 80 BUILD part → lifecycle.
- 76, 77, 78, 79 and 80 are planned and committed. 79.1 still needs planning, with its CONTEXT written.

### User rulings from this session (all in memory and in the phase CONTEXTs)
- Bots run only at the milestone end (79.1).
- No full test suite after build-only steps.
- Code first, then ONE release build.
- The Phase 80 code part may run in parallel.
- Phase-specific rulings are in each CONTEXT's "rulings after planning" section.

### Standing mechanics
- **Worktree isolation is flaky:** the harness sometimes refuses its own worktree while its checkout is still running. Fallback: dispatch WITHOUT isolation (a `<sequential_execution>` block on master, one at a time), and clean up refused worktrees with `git worktree unlock`, `remove -f -f`, `prune` and `branch -D`.
- A lingering executor background process can lock a worktree. Fix: TaskStop that agent, then remove the worktree with `node fs.rmSync`.
- Merge recipe:
  1. `git -C <wt> checkout -- test/unit/fixtures/shell-snapshots/`
  2. cleanup-wave
  3. npm test, parity, boot:check (rerun once if it fails)
  4. `update-plan-progress`, then commit
- Stall watch: `<scratchpad>/watch.sh <base> <stall-min> <agent ids...>`. The executor prompt pattern is in `<scratchpad>/last-executor-prompt.txt`, and the Phase 80 variant in `<scratchpad>/p80.txt`.
- **Never `cd` into a worktree;** use `git -C`.
- Floor-11 survival miss (Phase 75.1): flagged for the user and checked at 79.1.
- **At milestone close:**
  1. Publish the 79 review page.
  2. The user judges the insanity death-cause tone.
  3. Run the batched Pixel 7 checklist.
  4. Offer a Play internal push (ask first).

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
