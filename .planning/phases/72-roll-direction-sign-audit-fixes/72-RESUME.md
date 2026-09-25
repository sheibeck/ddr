# Phase 72: autonomous-run resume point

**Updated:** 2026-09-25 ~03:20Z (after the first /compact; wave 5 in flight)

## Where the run is
- `/gsd-autonomous` is running milestone v2.1 (11 phases: 72, 73, 74, 75, 75.1, 76, 77, 78, 79, 80, 81). This is Phase 72 of 11.
- Phase 72 execution (`/gsd-execute-phase 72 --no-transition`) has 7 plans in 5 waves.
  - Waves 1–4 are merged and green (5,643 pass / 0 fail / 1 todo after wave 4).
  - **Wave 5 = 72-07 is DISPATCHED** (worktree `.claude/worktrees/agent-a7ac4afe27ff2ae1d`, branch `worktree-agent-a7ac4afe27ff2ae1d`, base 7327e80, manifest `<scratchpad>/wave-72-5.json`). Its Task 1 committed d2adfd6 (F1/F2/F3/F5), and the AFTER readout was being recorded at ~03:13Z.
- **After 72-07 returns:**
  1. `worktree.record-agent` → `worktree.cleanup-wave --manifest <scratchpad>/wave-72-5.json`. If blocked, merge manually with `--no-ff` after checking the merge-base.
  2. Post-merge `npm test` gate, then `roadmap.update-plan-progress 72 72-07 complete` and a tracking commit.
  3. Write an orchestrator `72-VERIFICATION.md` (status passed + `human_verification`: the Smoke card "(a 1–2 if you insulted them)", the frenzy dark-square Oracle check, and any 72-07 device items), then `phase.complete 72`.
  4. Commit the pre-collected CONTEXT files (below) plus the doc amendments (below).
  5. **Run Phase 81 NEXT** (user accepted 2026-09-25), then 73 → 74 → 75 → 75.1 → 76 → 77 → 78 → 79 → 80.

## Pre-collected discuss (all user-accepted 2026-09-25, "Accept all" on every area)
CONTEXT files are written but UNCOMMITTED until wave 5 merges:
- `73-engine-roll-high-mirror/73-CONTEXT.md`
- `74-roll-display-modifier-honesty/74-CONTEXT.md`
- `75-engine-rules-character-economy-grimoire-combat-bugs/75-CONTEXT.md`
- `75.1-pilfer-fumbles-scroll-reading/75.1-CONTEXT.md`
- `76-darkness-unification-relaunch-persistence/76-CONTEXT.md`
- `77-combat-screen-oracle-readability/77-CONTEXT.md`
- `78-hud-dead-state-climb-decisions/78-CONTEXT.md`
- `79-content-narrative-pass/79-CONTEXT.md`
- `80-android-release-build-tooling/80-CONTEXT.md`
- `81-leaderboards-panel-fixes/81-CONTEXT.md`

Every later phase therefore SKIPS discuss (`has_context` is true).

## Doc amendments owed (apply after the wave-5 merge)
- **REQUIREMENTS.md RULES-07 and ROADMAP Phase 75 SC5:** the user kept canon. Ailment 5–6 stays a phobia ("disease of the mind"); the fix is honest narration. Reword to "narrates what it gives".
- **ROADMAP Phase 78 "Depends on":** now Phases 73/74. CLIMB-01 became an ENGINE pending decision (engine-gated, harness reconcile), and the card shows odds in the Phase 74 range format.
- **STATE.md / ROADMAP:** record the run-order change (81 runs right after 72).

## Standing facts for the rest of the run
- **Per-wave merge:** after the executor returns, run `worktree.record-agent` and then `worktree.cleanup-wave --manifest <m>`. If cleanup is blocked (Windows "Device or resource busy"), merge the branch manually with `git merge --no-ff` after checking the merge-base equals the wave base, then delete the branch.
- **Worktree-only noise:** `core.autocrlf=true` gives 7 CRLF doc-ledger test failures (docs/CLASS-PASS.md, docs/FLEE.md) ONLY inside worktrees. Master is clean. Tell every executor.
- `.claude/worktrees/agent-af51dd6adbaae0ea7` is a stale, busy directory from 72-04 (the branch is already merged and deleted). Remove it later.
- **Research policy (user, once per run):** a researcher runs only for Phase 80. Plan every other phase with `--skip-research`.
- **Verification agents are off** (usage trim). Each phase closes on a green `npm test` plus the SUMMARYs and an orchestrator VERIFICATION with a `human_verification` list. Device checks are batched for milestone close, and the debug APK is built only after the last wave.
- **Stall watch:** a Monitor per executor, watching commits plus hashes of the worktree status/diff; the transcript .output files are 0 bytes, so ignore their mtime. Long bot readouts (tune-difficulty, 200 seeds) legitimately idle ~15 min.
- **Phase 81:** debug-first plan. Ask the user for ONE adb session only if device logs are essential. After 81 lands, OFFER a Play internal-testing push (vc bump).
- **Phase 79:** produce a before/after narrative review page for the user to read at milestone close (no mid-run pause).
