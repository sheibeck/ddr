---
phase: 50-character-roller-fix
plan: 02
subsystem: testing
tags: [dev-tooling, headless-chrome, cdp, repro-driver, roller]

# Dependency graph
requires:
  - phase: 50-character-roller-fix
    provides: "Plan 01's src/browser/roller.js (not consumed by this plan — it runs against the still-live inline mazeworld.html roller block)"
provides:
  - "tools/roller-repro.mjs — dependency-free headless-Chrome (Chrome DevTools Protocol over Node 22's built-in WebSocket) driver for the roller/Hero-tab identity contract; reusable by Plan 03 (AFTER table) and the Phase 55 device batch's browser-side twin"
  - ".planning/phases/50-character-roller-fix/50-02-repro-before.txt — the BEFORE (unfixed inline shell) evidence table"
affects: [50-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chrome DevTools Protocol driver in the tools/shell-boot-check.mjs mould: static server + resolved local Chrome/Edge binary + a fresh --user-data-dir profile, but driving a LIVE page over CDP (Runtime.evaluate/waitFor) instead of a single --dump-dom snapshot"
    - "Profile-directory-based process-family kill (WMI CommandLine LIKE match) instead of PID-based taskkill — needed because chrome.exe on this machine re-execs itself, so Node's child_process.spawn() PID does not belong to the actual running browser process"
    - "Forward-slash --user-data-dir paths even on win32: avoids WQL's backslash-as-LIKE-escape-character pitfall entirely, rather than escaping backslashes in every WMI query"

key-files:
  created:
    - tools/roller-repro.mjs
    - .planning/phases/50-character-roller-fix/50-02-repro-before.txt
  modified: []

key-decisions:
  - "Each scenario gets its own devtools port (base + scenario index) rather than reusing one port across sequential scenarios in a single process run, removing a port-reuse race between successive Chrome launches"
  - "Process cleanup kills by --user-data-dir profile-directory substring match (WMI `CommandLine like \"%<dir>%\"` → `call terminate`) rather than by the PID `child_process.spawn()` returns — on this machine chrome.exe launches a short-lived stub that re-execs into the real browser process under a DIFFERENT pid, so a PID-based `taskkill /PID <pid> /T /F` silently reports \"process not found\" and leaks the whole Chrome process family (renderer/GPU/utility/crashpad children) on every scenario"
  - "Profile directories are constructed with forward slashes (`os.tmpdir().replace(/\\\\/g, \"/\")` + a forward-slash mkdtemp prefix) even though `path.join` would produce Windows backslashes — WQL's LIKE clause treats backslash as an escape character, so a raw backslash Windows path silently fails to match in the WMI kill query even though Chrome itself accepts (and echoes back) forward-slash paths without complaint"

requirements-completed: [ROLL-01]

coverage:
  - id: D1
    description: "tools/roller-repro.mjs: a dependency-free headless-Chrome CDP driver for four roller scenarios (normal, double-tap, play-again, play-again-mid-reveal), each producing a reels-vs-Hero-tab-vs-state.c row with a match verdict; exit 0/1/2 semantics; process-family cleanup via profile-directory match so repeated/looped runs never leak Chrome processes"
    requirement: "ROLL-01"
    verification:
      - kind: other
        ref: "node tools/roller-repro.mjs --scenario all (run twice consecutively) — 4/4 matched, exit 0, both runs; 0 leftover chrome.exe processes after each run (tasklist | grep -c chrome.exe)"
        status: pass
      - kind: other
        ref: "grep -c \"remote-debugging-port\"/\"Runtime.evaluate\"/\"new WebSocket(\" tools/roller-repro.mjs — 1/1/1; grep -c \"^import \" — 5, zero banned (playwright|puppeteer|ws) imports"
        status: pass
    human_judgment: false
  - id: D2
    description: "The BEFORE table for the still-unfixed inline mazeworld.html roller — recorded verbatim (reproduced or explicitly not) with exit code and per-row interpretation"
    requirement: "ROLL-01"
    verification:
      - kind: other
        ref: ".planning/phases/50-character-roller-fix/50-02-repro-before.txt (4/4 matched, exit 0 — not reproduced in this browser environment)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Engine/content/parity fence untouched; mazeworld.html untouched (Plan 03's mount swap deferred); npm test fail 0; npm run build:www green"
    verification:
      - kind: unit
        ref: "npm test — 3327/3327 pass, fail 0"
        status: pass
      - kind: other
        ref: "npm run build:www exit 0; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; git status --porcelain engine/ content/ test/parity/ mazeworld.html empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pixel 7 device verification of the actual roller screen (normal roll, double-tap, Play-again-from-death, dead Hero tab New Character) — deferred to the Phase 55 batch, per the deferred-UAT protocol"
    verification: []
    human_judgment: true
    rationale: "Device UI behavior is out of scope for a dev-loop CDP driver and this plan does not touch mazeworld.html; rides the Phase 55 batched Pixel 7 session, not a mid-run device pause."

# Metrics
duration: ~55min
completed: 2026-09-20
status: complete
---

# Phase 50 Plan 02: Roller repro driver + BEFORE table Summary

**A dependency-free headless-Chrome CDP driver (`tools/roller-repro.mjs`) drives four roller scenarios against the still-unfixed inline `mazeworld.html` roller and records a BEFORE table where every reel/Hero-tab pair matched (not reproduced in this browser environment) — closing SC3 with recorded evidence rather than a claim, and leaving a reusable driver for Plan 03's AFTER table and the Phase 55 device batch.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-20
- **Tasks:** 2
- **Files modified:** 2 new (tools/roller-repro.mjs, 50-02-repro-before.txt)

## Accomplishments

- `tools/roller-repro.mjs` — a zero-dependency driver (`node:http` + `node:fs` + `node:path` + `node:os` + `node:child_process` + the global `WebSocket`) that serves the repo root, boots `mazeworld.html` in a fresh headless Chrome/Edge profile per scenario, and drives title ENTER → roller reveal → DESCEND → HERO tab over the Chrome DevTools Protocol (`Runtime.evaluate`/`Runtime.exceptionThrown`).
- Four scenarios implemented exactly per the plan's locked sequences: `normal`, `double-tap` (re-entrant ENTER tap, reels re-read after the stale-reveal window), `play-again` (death → `mzReturnToTitle` → ENTER → fresh roll), and `play-again-mid-reveal` (a second `mzStartRoll()` fired mid-reveal, superseding the first re-roll).
- Output: a markdown table (`| Scenario | Reels shown | Hero tab shown | state.c | Match? | Notes |`) plus a `roller-repro: n/total matched` summary line; `--json` mode for machine consumption; exit 0/1/2 semantics (browser-unusable is a distinct exit code from a mismatch).
- `npm test` 3327/3327 pass, fail 0; `npm run build:www` exit 0; master-hash and fence unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: write tools/roller-repro.mjs — a dependency-free CDP driver for the three roller scenarios** - `9449e29` (feat)
2. **Task 2: fix the process-cleanup race found while recording the BEFORE table, record the BEFORE table, run the plan gates** - (this commit) (fix)

**Plan metadata:** (this commit) — SUMMARY + STATE + ROADMAP

## Files Created/Modified

- `tools/roller-repro.mjs` (new) — the CDP driver; Task 2 amended it in place (see Deviations) to fix a Chrome process-family cleanup bug discovered while running the tool against the real target, not a functional change to any scenario's click/wait/read sequence.
- `.planning/phases/50-character-roller-fix/50-02-repro-before.txt` (new) — the committed BEFORE evidence: the four-row table, `roller-repro: 4/4 matched`, exit code 0.

## Decisions Made

- Each scenario in a multi-scenario run gets its own devtools port (`--devtools-port` base + scenario index) — running all four scenarios back-to-back on one shared port produced a launch race between a dying Chrome instance and the next one's connect attempt.
- Chrome process cleanup matches on the scenario's unique `--user-data-dir` profile-directory substring via `wmic process where "CommandLine like ..." call terminate`, not on the PID `child_process.spawn()` returns — see Deviations below for why.
- Profile directories are built with forward slashes even on win32, sidestepping WQL's backslash-as-escape-character behavior in the LIKE clause used for cleanup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chrome process-family cleanup never actually killed the browser, leaking orphaned processes across scenario runs**
- **Found during:** Task 2, while running `node tools/roller-repro.mjs --scenario all` to record the BEFORE table — later scenarios in the same run started timing out on `titleReady` (15s), and by the time this was diagnosed, well over a hundred orphaned `chrome.exe` processes (from this session's earlier test runs) were competing for CPU/memory, which was itself enough to push subsequent cold Chrome launches past the wait timeout.
- **Root cause (two compounding bugs, both in `tools/roller-repro.mjs` as first written):**
  1. `killProcessTree(child)` ran `taskkill /PID <child.pid> /T /F`, but on this machine `chrome.exe` re-execs itself on launch: the PID Node's `child_process.spawn()` returns belongs to a short-lived stub process that has already exited by the time the real browser (and its renderer/GPU/utility/crashpad children) is up. The taskkill therefore always reported "process not found" and never touched the actual running Chrome family — every scenario run leaked a full Chrome process tree.
  2. Even after switching to a profile-directory-based match (`wmic process where "CommandLine like \"%<profileDir>%\"" call terminate`), the match still silently failed for the first fix attempt because `profileDir` (built via `path.join(os.tmpdir(), ...)` on win32) contains backslashes, and WQL's `LIKE` operator treats backslash as its own escape character — a raw Windows-style path in the query pattern never matches the literal command line text.
- **Fix:** (a) `killByProfileDir(profileDir)` replaces the PID-based kill, matching on the unique per-scenario `--user-data-dir` substring instead of a PID; (b) profile directories are now constructed with forward slashes (`os.tmpdir().replace(/\\/g, "/")` + a forward-slash mkdtemp prefix) so the WMI LIKE match is unambiguous; (c) each scenario in a multi-scenario run uses its own devtools port (base + index) to remove a secondary port-reuse race between back-to-back launches.
- **Verification:** ran `node tools/roller-repro.mjs --scenario all` twice consecutively after the fix — both runs returned 4/4 matched, exit 0, and `tasklist | grep -c chrome.exe` reported 0 after each run (previously it accumulated dozens of orphans per run). Also manually cleared ~150 orphaned processes accumulated during diagnosis before re-verifying a clean baseline.
- **Files modified:** `tools/roller-repro.mjs`
- **Committed in:** this commit (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in dev-tooling written earlier in this same plan, not a bug in shipped app code)
**Impact on plan:** No scope creep — the fix is entirely inside the tool this plan was already committed to building; it was necessary to reliably run the BEFORE (and later Plan 03's AFTER) table without leaking system resources.

## BEFORE — unfixed shell (inline roller)

Driven with `node tools/roller-repro.mjs --scenario all` against the still-live inline `mazeworld.html` roller block (Plan 01's `src/browser/roller.js` module exists but is not yet mounted — Plan 03 does that swap). Exit code: **0** (4/4 matched — not reproduced in this browser environment on this run).

| Scenario | Reels shown (race / class / sub · name) | Hero tab shown (#s-tag · #s-name) | state.c (race / cls / sub · name) | Match? | Notes |
| --- | --- | --- | --- | --- | --- |
| normal | Wilmsry / Fighter / Knight · Cobb of Low Ward | Wilmsry Knight · Fighter · Cobb of Low Ward | Wilmsry / Fighter / Knight · Cobb of Low Ward | yes | |
| double-tap | Human / Magic User / Court Mage · Ivy Vane | Human Court Mage · Magic User · Ivy Vane | Human / Magic User / Court Mage · Ivy Vane | yes | reels changed after reveal: no |
| play-again | Human / Fighter / Master of Arms · Owen Crane | Human Master of Arms · Fighter · Owen Crane | Human / Fighter / Master of Arms · Owen Crane | yes | |
| play-again-mid-reveal | Elven / Fighter / Soldier · Caelan Willowshade | Elven Soldier · Fighter · Caelan Willowshade | Elven Soldier · Fighter · Caelan Willowshade | yes | reels changed after reveal: yes |

roller-repro: 4/4 matched

**Per-row reading against the two known weaknesses (CONTEXT.md `## Specific Ideas`):**

- **normal:** clean single roll, no re-entry — reels and Hero tab agree as expected; this scenario is a control, not a stress test of either weakness.
- **double-tap:** a double ENTER tap fired `mzStartRoll()` twice in quick succession (80 ms apart). "reels changed after reveal: no" means the reels read immediately at first reveal and the reels re-read 3.3 s later were identical — the second roll's reveal timers were the ones that actually fired (or the first call's re-entry was effectively absorbed before its own timers could overwrite anything visible). The Hero tab matched the (single, stable) reels shown. **Not reproduced**: this run never observed the reported failure mode (a first roll's stale reveal timer overwriting the second roll's locked reels after CTA commit).
- **play-again:** death → `mzReturnToTitle()` → title ENTER → fresh roll → Hero tab. Clean match — the death → replay path does not by itself trigger either weakness on this run.
- **play-again-mid-reveal (bonus row):** after the second ENTER (post-death), a THIRD `mzStartRoll()` was fired 1 s into that reveal (`window.mzStartRoll()` called directly, simulating a re-tap mid-reveal) — this is the sharpest test of weakness #1 (overlapping `mzStartRoll` calls). "reels changed after reveal: yes" confirms the reels DID restart and re-lock on the superseding roll (expected, correct behavior per the CONTEXT's SC2 "double-tap supersedes" contract) — and critically, the Hero tab matched the FINAL (superseding) reels, not a stale first-roll state. **Not reproduced**: the specific failure (a stale first roll's reveal overwriting the superseding roll's committed state) did not occur in this run.

Per the CONTEXT's own fallback clause ("If no mismatch reproduces in the browser, the guards + tests still land"): **not reproduced in browser; structurally guarded; device check in the Phase 55 batch.** Plan 01's `roller.js` guards (monotonic roll token + serialized `startNewRun` chain + pending-state-only reads) were written and unit-tested specifically because code reading identified these two race windows even though this particular headless-Chrome timing did not trigger them against the still-unfixed inline block. Plan 03 mounts `roller.js` in place of the inline block and re-runs this same tool for the AFTER table.

## Gates

- `npm test`: **3327/3327 pass, fail 0** (`# tests 3327`, `# pass 3327`, `# fail 0`).
- `npm run build:www`: **exit 0** (`[build-www] done`).
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged — matches the required pin).
- `git status --porcelain engine/ content/ test/parity/ mazeworld.html`: empty (fence clean).

## Issues Encountered

See "Deviations from Plan" above — the process-cleanup bug in the tool itself was found and fixed within this plan before the BEFORE table was finalized.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tools/roller-repro.mjs` is ready for Plan 03 to re-run against the mounted `roller.js` for the AFTER table (same CLI, same scenarios).
- The BEFORE table shows no reproduced mismatch in this environment; Plan 03 should still land the structural fix (it already exists from Plan 01) and record the AFTER table for the same four scenarios to close SC3 with a direct before/after comparison.
- No blockers.

## Human verification (deferred to end of run)

Per the deferred-UAT protocol and this phase's CONTEXT ("a `human_verification` entry for the Phase 55 device batch"), the following Pixel 7 checks are owed to the Phase 55 batched device session:

1. **Normal roll:** title ENTER → roller screen opens → the three reels lock in sequence (race → class → sub-class) → name + quirk reveal → DESCEND → the Hero tab shows the SAME race / sub-class / class / name the reels displayed.
2. **Double-tap:** double-tap ENTER on the title screen → the reels restart and lock exactly once (no visible flicker of the first roll's labels bleeding into the second) → DESCEND → the Hero tab matches the final (second) reels only.
3. **Play-again-from-death:** die → CONFIRM → ENTER (Play again) → the reels roll fresh → DESCEND → the Hero tab matches the new reels; separately, the dead Hero tab's own "New Character" button → same check (reels shown === Hero tab shown).

## Self-Check: PASSED

- FOUND: tools/roller-repro.mjs
- FOUND: .planning/phases/50-character-roller-fix/50-02-repro-before.txt
- FOUND: .planning/phases/50-character-roller-fix/50-02-SUMMARY.md
- FOUND commit: 9449e29 (Task 1)
