# Phase 72: autonomous-run resume point

**Written:** 2026-09-25, at the user's request, before a planned /compact (~54% context).

## Where the run is
- `/gsd-autonomous` is running milestone v2.1 (11 phases: 72, 73, 74, 75, 75.1, 76, 77, 78, 79, 80, 81). This is Phase 72 of 11.
- Phase 72 execution (`/gsd-execute-phase 72 --no-transition`) has 7 plans in 5 waves.
  - Waves 1–3 are merged and green, with plans 72-01 to 72-05 complete. The post-merge `npm test` after wave 3 gave 5,621 pass, 0 fail, 7 todo.
  - **Wave 4, 72-06 (Skeleton shatter, fix (c))** is executing in worktree `.claude/worktrees/agent-a651d85b703f5a1a6`, branch `worktree-agent-a651d85b703f5a1a6`, base `904269c`. Its wave manifest is at `<scratchpad>/wave-72-4.json`.
  - Wave 5, **72-07**, comes next: F1 members/allies obey per-target rules, F2 drop the Acute Hearing clause, F3 Shadow daggerOnly, F5 the PARLEY_NEED_MOD sign, the AFTER bot readout, the final ledger and the ledger-sync guard.
- After Phase 72:
  1. Write an orchestrator `72-VERIFICATION.md` (status passed + `human_verification` list) per the deferred-UAT protocol, then run `phase.complete`.
  2. Then Phase 73: smart discuss → plan (`--skip-research`) → execute.

## Standing facts for the rest of the run
- **Per-wave merge:** after the executor returns, run `worktree.record-agent` and then `worktree.cleanup-wave --manifest <m>`. If cleanup is blocked (Windows "Device or resource busy"), merge the branch manually with `git merge --no-ff` after checking the merge-base equals the wave base, then delete the branch.
- **Worktree-only noise:** `core.autocrlf=true` gives 7 CRLF doc-ledger test failures (docs/CLASS-PASS.md, docs/FLEE.md) ONLY inside worktrees. Master is clean. Tell every executor.
- `.claude/worktrees/agent-af51dd6adbaae0ea7` is a stale, busy directory from 72-04 (the branch is already merged and deleted). Remove it later.
- **Pre-supplied rulings:** `72-RULINGS.md` (F1 fix, F2 text + HUD-07 in Phase 78, F3 fix, F4 fix, already applied by 72-05).
- **Research policy (user, once per run):** a researcher runs only for Phase 80. Plan every other phase with `--skip-research`.
- **Verification agents are off** (usage trim). Each phase closes on a green `npm test` plus the SUMMARYs; device checks are batched for milestone close, and the debug APK is built only after the last wave.
- **Stall watch:** a Monitor per executor, watching commits plus hashes of the worktree status/diff; the transcript .output files are 0 bytes, so ignore their mtime.
- New since the roadmap: Phase 75.1 (RULES-09/10 Pilfer and scrolls, fully ruled — see its todos), BOARD-15/16 in Phase 81 (runs lost locally and globally), and HUD-07 in Phase 78.
- The user offered to move Phase 81 (live leaderboard bugs) earlier; there's no answer yet.
