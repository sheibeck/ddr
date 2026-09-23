---
phase: 60-performance-footprint-close
plan: 02
subsystem: infra
tags: [capacitor, gradle, android, git-worktree, aab, perf]

# Dependency graph
requires:
  - phase: 60-performance-footprint-close (plan 01)
    provides: tools/cold-start.mjs, the CLI contract plan 60-03 uses for device measurement
provides:
  - Four build artifacts (v1.7 + v1.8 debug APK, v1.7 + v1.8 signed release AAB) built in temporary out-of-repo worktrees, no version bump
  - C:/projects/mazeworld-perf60/artifacts/sizes.json, www-v1.7.json, www-v1.8.json — byte/sha256 records plan 60-03 reads
  - docs/PERF-BASELINE.md `## v1.8 — Phase 60` section (Method, AAB size + footprint note, empty device tables)
  - docs/UAT-v1.8.md — the one batched Pixel 7 checklist merging Phases 56-59's 31 deferred device checks
affects: [60-03 (the device session plan), any future perf pass referencing PERF-BASELINE.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Side-by-side AAB comparison built in temporary detached git worktrees (core.autocrlf=false) outside the repo tree, node_modules copied (never linked) per worktree, keystore.properties/local.properties copied then discarded with the worktree"
    - "robocopy with MSYS_NO_PATHCONV=1 for bulk directory copy/purge on Windows Git Bash (bare /E flag is otherwise mis-parsed as a drive letter by MSYS path conversion)"
    - "robocopy /MIR against an empty source dir as a long-path-safe alternative to `git worktree remove --force` when a nested node_modules tree exceeds Windows MAX_PATH"

key-files:
  created:
    - docs/UAT-v1.8.md
  modified:
    - docs/PERF-BASELINE.md

key-decisions:
  - "Both v1.7 and v1.8 built from the same copied node_modules (toolchain-identity pre-flight confirmed package.json/package-lock.json/android/capacitor.config.json byte-identical at both commits) rather than running npm ci in each worktree, per plan 60-02's own discovery notes"
  - "AAB size footprint note states explicitly that the v1.7->v1.8 delta (420,608 B / +4.520%) is the 30 sfx clips plus code, NOT the 54 set-dressing props + 9 party frames — those were already bundled unused in the v1.7 AAB (committed in 90dc06c, before the v1.7 tag)"
  - "git worktree remove --force failed with 'Filename too long' on both v1.7 and v1.8 (deeply nested node_modules paths exceed Windows MAX_PATH); git's own admin-metadata removal succeeded in both cases, only the on-disk directory tree was left behind — cleaned it up with a robocopy /MIR-against-empty-dir purge, then rmdir, then git worktree prune"

requirements-completed: [PERF-03]

coverage:
  - id: D1
    description: "Four build artifacts (v1.7 + v1.8 debug APK, v1.7 + v1.8 signed release AAB) built in temporary detached worktrees outside the repo, no version bump, both signed AABs jarsigner-verified"
    requirement: "PERF-03"
    verification:
      - kind: other
        ref: "node -e check against C:/projects/mazeworld-perf60/artifacts/sizes.json (Task 1's plan-specified verify script) — all four byte counts positive integers, aabDeltaBytes arithmetic correct"
        status: pass
      - kind: other
        ref: "jarsigner -verify on both app-release.aab (both builds) printed '^jar verified.'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Master checkout provably undisturbed by the temporary-worktree builds (status, main AAB stat, version.properties all identical before/after)"
    requirement: "PERF-03"
    verification:
      - kind: other
        ref: "diff of main-status-before.txt vs main-status-after.txt (byte-identical); node fs.statSync comparison of android/app/build/outputs/bundle/release/app-release.aab (8358944 bytes, same mtime); git diff --quiet -- android/version.properties"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/PERF-BASELINE.md v1.8 section: Method, AAB size table + www/ breakdown + footprint note, five empty device-table headings in order, additions-only diff"
    requirement: "PERF-03"
    verification:
      - kind: other
        ref: "node heading-order + numstat-deletions=0 check specified in plan 60-02 Task 2's <verify> block"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/UAT-v1.8.md merges all 31 deferred human_verification items from Phases 56-59 VERIFICATION.md frontmatter verbatim, grouped newest-first, with correct When/Result cell rules"
    requirement: "PERF-03"
    verification:
      - kind: other
        ref: "node verbatim-coverage script (per-phase row count == source length, every source string present as a complete table cell) — 56:6/6, 57:10/10, 58:7/7, 59:8/8"
        status: pass
      - kind: other
        ref: "node script checking Result cells empty and When cell in the allowed enum, fresh install (destructive) used exactly once (56-3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm test green on the main checkout after the device-artifact build/cleanup cycle, engine gate untouched"
    requirement: null
    verification:
      - kind: unit
        ref: "npm test (node --test) — 3886/3886, matching the phase-start baseline"
        status: pass
      - kind: other
        ref: "git diff --quiet v1.7 HEAD -- engine/ content/ test/parity/; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; package.json/package-lock.json unchanged since HEAD~2"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-23
status: complete
---

# Phase 60 Plan 02: Side-by-side v1.7/v1.8 builds + AAB footprint record Summary

**Built four out-of-repo artifacts (v1.7 6c299ab + v1.8 d6db678, debug APK and signed release AAB each) in temporary detached git worktrees with no version bump, recorded a +420,608-byte (+4.520%) AAB delta attributed correctly to the 30 sfx clips (not the already-bundled dressing images) in a new `docs/PERF-BASELINE.md` v1.8 section, and compiled `docs/UAT-v1.8.md` merging all 31 deferred Phase 56-59 device checks for plan 60-03.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-22T21:40:00Z (approx, main-status-before.txt snapshot)
- **Completed:** 2026-09-23T02:07:54Z
- **Tasks:** 3
- **Files modified:** 2 (docs/PERF-BASELINE.md, docs/UAT-v1.8.md) + out-of-repo artifacts under `C:/projects/mazeworld-perf60/artifacts/` (never committed)

## Accomplishments

- Built v1.7 (`6c299ab07e91cd8d00b30e8e690210172c3b4be7`) and v1.8 (`d6db678c10e444aae76f6fd4cbb897eb8010e0b9`) debug APK + signed release AAB, sequentially, in temporary detached `git worktree`s under `C:/projects/mazeworld-perf60/` created with `core.autocrlf=false`, no version bump — both stamp `1.5.0 (6)`, both AABs `jarsigner -verify` clean
- Recorded `sizes.json` (bytes + sha256 for all four artifacts, `aabDeltaBytes: 420608`, `apkDeltaBytes: 460698`) and per-build `www/` byte breakdowns (`www-v1.7.json`, `www-v1.8.json`)
- Proved master was undisturbed: identical `git status --porcelain`, identical main-checkout AAB stat (8,358,944 bytes, same mtime), clean `android/version.properties` diff, before and after
- Appended `docs/PERF-BASELINE.md`'s `## v1.8 — Phase 60` section: Method (build/cold-start/step/AAB/threshold description), AAB size table + `www/` breakdown table + the footprint note (delta is the 30 clips + code, not the already-bundled 54 props/9 party frames), and five empty device-result headings (Device, Cold start, Step time, Verdicts, Dispositions) scaffolded for plan 60-03
- Compiled `docs/UAT-v1.8.md`: perf protocol (section A, 5 rows) first, then Phases 59→56 verbatim (31 rows total, `When` cell classified as `any time` / `reduced-motion pass` / `TalkBack pass` / `fresh install (destructive)` — the last used exactly once, 56-3), Result cells left empty
- Deleted both `*-release.aab` files from the artifacts directory after recording their bytes/hashes (kept the two `-debug.apk` files, `sizes.json`, and the two `www-*.json` files, per the plan's key_link contract)
- Removed both temporary worktrees and pruned; `npm test` (3886/3886) and `npm run build:www` both green on the untouched main checkout afterward

## Task Commits

Each task was committed atomically:

1. **Task 1: Build v1.7 and v1.8 (debug APK + signed AAB each) in temporary detached worktrees outside the repo** — no commit (task's outputs live entirely outside the repo, per plan instruction)
2. **Task 2: PERF-BASELINE.md — record the AAB change and scaffold the v1.8 device tables** — `e642b0f` (docs)
3. **Task 3: docs/UAT-v1.8.md — the one batched Pixel 7 checklist** — `0cdf638` (docs)

**Plan metadata:** none yet — this SUMMARY's own commit is the plan-metadata commit, made immediately after this file is written.

## Files Created/Modified

- `docs/UAT-v1.8.md` - new: the merged 31-item Phase 56-59 device checklist behind the perf protocol
- `docs/PERF-BASELINE.md` - appended `## v1.8 — Phase 60` section (167 insertions, 0 deletions); one pointer line added directly under the H1

**Out-of-repo (never committed), under `C:/projects/mazeworld-perf60/artifacts/`:**
- `ddr-v1.7-6c299ab-debug.apk` (10,519,640 B), `ddr-v1.8-d6db678-debug.apk` (10,980,338 B) — kept for plan 60-03's device install
- `sizes.json`, `www-v1.7.json`, `www-v1.8.json` — kept for plan 60-03's reference (`sizes.json`'s `v1.8.sha` is plan 60-03's freshness-gate input)
- `main-status-before.txt`, `main-status-after.txt` — the master-undisturbed proof artifacts
- The two `*-release.aab` files were built, hashed, recorded, then deleted (not upload candidates, per the plan's prohibitions)

## Decisions Made

- Followed the plan's node_modules-copy (not link) approach exactly, since Gradle builds `:capacitor-android` inside `node_modules/@capacitor/android/capacitor/build` and a symlink would make that build directory the main checkout's own
- Ran the v1.7 and v1.8 worktree `git worktree add` + `node_modules` copy steps for BOTH builds up front (before either Gradle build started), since worktree creation and file copying are not Gradle operations and don't violate the plan's "never run two Gradle builds at once" rule — this let the v1.8 prep happen while v1.7's cold Gradle daemon was starting, saving wall-clock time without any actual build parallelism
- Used `MSYS_NO_PATHCONV=1 robocopy` instead of a Bash `cp -r` for the ~55 MB `node_modules` copies, since Git Bash's default path translation mangles robocopy's single-letter flags (`/E` → `E:/`) and `cp -r` would be materially slower for tens of thousands of small files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `git worktree remove --force` failed with "Filename too long" on both worktrees**
- **Found during:** Task 1, after-both-builds cleanup step
- **Issue:** Both `v1.7` and `v1.8` temporary worktrees have deeply nested `node_modules` paths (e.g. `node_modules/@capacitor/android/capacitor/build/...`) that exceed the Windows `MAX_PATH` (260 chars) limit for the directory-tree deletion `git worktree remove` performs internally. Git's own admin-metadata removal (`.git/worktrees/<name>`) succeeded in both cases — confirmed by `.git/worktrees/` no longer listing the removed worktree — but the on-disk directory itself was left behind, orphaned.
- **Fix:** Used a long-path-safe purge: `robocopy <empty-dir> <target-dir> /MIR` (robocopy's own long-path handling clears the tree without hitting the same limit), then `rmdir` on the now-empty directory, then `git worktree prune` to confirm the registration was already clean. Verified with `git worktree list --porcelain | grep mazeworld-perf60` returning zero matches after both.
- **Files modified:** none (filesystem-only cleanup outside the repo, no repo files touched)
- **Verification:** `git worktree list --porcelain` shows zero `mazeworld-perf60` entries; the concurrent plan 60-01 worktree (`agent-a334008571016fe8b`) and the pre-existing `build-7d3dc11` scratchpad worktree were both left untouched throughout
- **Committed in:** not applicable — no repo commit needed for this fix

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix is purely operational (Windows long-path cleanup) and touches nothing in the repo or the recorded artifacts. No scope creep; both worktrees are fully gone and pruned, matching the plan's acceptance criterion exactly.

## Issues Encountered

- Two `node -e` one-liners initially failed writing to `C:/projects/mazeworld-perf60/artifacts/*.json` because a leading `/c/...` Unix-style path, when passed to Node on Windows, resolves relative to the current drive rather than being translated the way Git Bash translates it for other tools — Node interpreted it as `C:\c\projects\...`. Fixed by using the Windows-style path (`C:/projects/mazeworld-perf60/artifacts/...`) directly in the Node script arguments; no impact on results, both `www-v1.7.json` and `www-v1.8.json` wrote correctly on the retry.
- `robocopy /E` (bare single-letter flag) is silently mis-parsed by Git Bash's MSYS path-conversion layer into a drive-letter path (`/E` → `E:/`), which robocopy then rejects as "Invalid Parameter". Fixed by setting `MSYS_NO_PATHCONV=1` on the robocopy invocations (both the initial `node_modules` copies and the later cleanup purges).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 60-03 (the device session) has everything it needs: both debug APKs at `C:/projects/mazeworld-perf60/artifacts/` (`ddr-v1.7-6c299ab-debug.apk`, `ddr-v1.8-d6db678-debug.apk`), `sizes.json` for the freshness gate and the AAB numbers, `docs/PERF-BASELINE.md`'s empty device tables ready to fill, and `docs/UAT-v1.8.md`'s 31-item checklist with every Result cell empty and ready for the batched Pixel 7 session.
- No blockers. The main checkout is clean, `npm test` is green at 3886/3886, and the engine gate (`engine/`, `content/`, `test/parity/` unchanged since `v1.7`, master hash `a1f4d0dc…` unchanged) holds.

---
*Phase: 60-performance-footprint-close*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: docs/UAT-v1.8.md
- FOUND: docs/PERF-BASELINE.md
- FOUND: C:/projects/mazeworld-perf60/artifacts/sizes.json
- FOUND: .planning/phases/60-performance-footprint-close/60-02-SUMMARY.md
- FOUND commit: e642b0f
- FOUND commit: 0cdf638
