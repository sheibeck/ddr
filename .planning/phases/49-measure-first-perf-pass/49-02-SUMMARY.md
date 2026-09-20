---
phase: 49-measure-first-perf-pass
plan: 02
subsystem: performance
tags: [performance, perf-marks, dom-rendering, shell, android]

# Dependency graph
requires:
  - phase: 49-measure-first-perf-pass
    provides: "49-01's dev-gated performance.now() rings + the user's Pixel 7 device report"
provides:
  - "docs/PERF-BASELINE.md Device/Protocol/BEFORE/Jank report/Decision sections filled from the Pixel 7 report"
  - "fix 1 (9fe9bb5): paint() skips the hidden Hero/Gear tab mount on the step path, re-renders on tab switch — cites the step row"
  - "AFTER (fix 1) table + user ruling to land a second fix rather than revert (step p95 19.3 still >= 16 ms after fix 1 alone)"
  - "fix 2 (cfce555): removes the redundant second canvas draw() per step (49-01's finding) — the draw timing row re-bracketed inside paint() via a new window.__mzPerfMarks bridge"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "conditional tab-mount rendering gated by a module-scope flag set only around the specific hot-path caller, never a function-signature change, when source-pin tests anchor on the function's literal declaration/call text"
    - "when relocating a dev-gated performance.now() bracket across the classic/module script boundary, bridge the SAME module instance (never a second one) so the timing ring stays continuous, and use the identical `perf`/`tDraw` local-variable naming the existing source-pin tests already check for, to minimize collateral pin-test churn"

key-files:
  created: []
  modified:
    - mazeworld.html
    - docs/PERF-BASELINE.md
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/perfMarks.test.js
    - test/unit/shell-map-rail.test.js

key-decisions:
  - "step (median 14.2 / p95 28.9 ms) is the only qualifying row; no sub-row (dispatch/paint/draw) independently crosses 16 ms"
  - "Even though this is mechanically the plan's 'step-only' case, the arithmetic (dispatch+paint+draw sums to within ~0.1 ms median / ~2.0 ms p95 of step's own reported number) shows the Oracle logLine append / camera nudge are NOT where the cost is — paint (the largest single component) is the real target, cited via the step row per the fix rule"
  - "Fix 1 implemented as a module-scope classic-script flag (mwPaintSkipHiddenTabs) rather than a paint(opts) parameter, because gearTab.test.js/heroTab.test.js/shell-party-camp.test.js/perfMarks.test.js all anchor on the literal strings `function paint() {` and `window.paint();` — changing either would have broken multiple source-pin tests for no behavioral benefit"
  - "Fix 1 alone reduced step's median (14.2 -> 11.3) and p95 (28.9 -> 19.3) but p95 stayed >= 16 ms — the user's binding ruling (2026-09-20) was to land a second fix citing the same step row rather than revert fix 1, and to keep both fixes regardless of the AFTER 2 outcome (deviation from the plan's own 'ONE fix / revert if not < 16 ms' clauses)"
  - "Fix 2: removed stepWith's redundant external draw() call (paint() already draws once internally); verified safe by reading draw()/positionCanvas()/centerMap()/keepPartyInView() — draw()'s pixel content depends only on S (via inViewWindow reading state.floor.px/py), never on cam, so moving the sole remaining draw() earlier in stepWith changes nothing about final on-screen correctness"
  - "Fix 2 re-bracketed the draw timing row inside paint() itself (a new window.__mzPerfMarks bridge to the SAME perfMarks instance stepWith already imports) rather than deleting the row — the coordinator's directive required the draw readout never go to 0"

patterns-established: []

requirements-completed: []
# PERF-01/PERF-02 are NOT marked complete here — Task 3 (after AFTER 2)
# closes both requirements together, per this plan's own task shape.

# Metrics
duration: in progress — checkpoint reached after Task 2 (fix 2 landed, awaiting AFTER 2)
completed: null
status: awaiting-after-report-2
---

# Phase 49 Plan 02: Measure-First Perf Pass — Two Fixes + AFTER 1 Summary (Task 2 checkpoint, round 2)

**Two presentation-only fixes citing the `step` row: (1) paint() skips the Hero/Gear tab's full DOM rebuild while hidden behind the map tab during a step, re-rendering on tab switch; (2) the redundant second canvas draw() per step is removed. AFTER 1 (fix 1 alone) moved step from 14.2/28.9/33.4 to 11.3/19.3/24.9 ms — p95 still >= 16 ms, so the user ruled: land fix 2, re-measure, keep both regardless of the outcome.**

**This is NOT the phase-closing SUMMARY.** Task 1 (doc + decision + fix 1)
and the fix-2 round (landed after the AFTER 1 device report, per a binding
user ruling — see `## Fix 2` below) are both complete; Task 2's checkpoint
is reached a second time, below. The executor stops here per the plan.
Task 3 (the AFTER 2 table, ROADMAP criteria 1-4, closing gates, PERF-01/02
marked complete) runs once the orchestrator supplies the AFTER 2 device
report.

## Performance

- **Duration:** this session, across two device round-trips
- **Tasks:** 1 of 3 fully completed (Task 1); Task 2's checkpoint reached
  twice (once for fix 1's AFTER report, now again for fix 2's); Task 3
  pending
- **Files modified:** `mazeworld.html`, `docs/PERF-BASELINE.md`,
  `src/browser/bridge.js`, `docs/SHELL-MODULES.md`,
  `test/unit/perfMarks.test.js`, `test/unit/shell-map-rail.test.js`,
  `.planning/phases/49-measure-first-perf-pass/49-02-SUMMARY.md`

## Accomplishments

- `docs/PERF-BASELINE.md`: Device, Protocol ("As run"), BEFORE table, Jank
  report, and Decision sections filled verbatim from `49-01-SUMMARY.md`'s
  `## Device report` — Pixel 7, build CP2A.260705.006, APK commit 742c916,
  session 2026-09-20; step 14.2/28.9/33.4, dispatch 3.9/8.3/15.1, paint
  8.6/15.3/17.9, draw 1.6/3.3/4.2 ms (med/p95/max, n=62); jank "None".
- Decision applied the fix rule mechanically per row (only `step` qualifies,
  p95 28.9 ≥ 16 ms) and then reasoned, with arithmetic and node-side code
  evidence, from "step-only" to the real, actionable target: `paint()`'s
  unconditional Hero/Gear tab-mount rebuild.
- One presentation-only fix commit (`9fe9bb5`): `paint()` skips the
  Hero/Gear tab mount when that screen is not the active tab, but ONLY on
  `stepWith`'s own `window.paint()` call (a module-scope flag,
  `mwPaintSkipHiddenTabs`, set true then immediately reset false around that
  one call); `showTab()` now re-renders the Hero/Gear mount the instant that
  tab becomes active, so a hidden tab is never stale — only unrendered while
  unseen. Every other `window.paint()` call site (~19 others, including the
  DOM-snapshot harness's `sandbox.paint()`) is unaffected.

## Task Commits

1. **Task 1 (fix, branch B):** `9fe9bb5` (perf) — `paint()` skips hidden
   Hero/Gear tab mounts on the step path, re-renders on tab switch — cites
   docs/PERF-BASELINE.md BEFORE row step (median 14.2 / p95 28.9 ms)
2. **Task 1 (doc, BEFORE half):** `52a8b00` (docs) — PERF-BASELINE.md Pixel 7
   BEFORE table, jank report, decision
3. **Task 1 (doc, fix-landed note):** `b8c9293` (docs) — decision: fix
   9fe9bb5 landed, AFTER run pending
4. **AFTER 1 report + user ruling (doc):** `d9be880`, `a6888cd` (docs,
   orchestrator-authored) — AFTER 1 numbers appended, user ruling to land a
   second fix recorded
5. **Fix 2:** `cfce555` (perf) — removes the redundant second canvas draw()
   per step — cites step p95 19.3 ms (AFTER 1) / 28.9 ms (BEFORE)
6. **Fix 2 doc (AFTER fix 1 table + AFTER fix 2 reserved):** `70e199f`
   (docs) — PERF-BASELINE.md AFTER section filled with the fix-1 table and
   the user's ruling; AFTER (fix 2) subsection reserved

_Note: the fix commit (9fe9bb5) landed before the doc commits in wall-clock
order — the code was diagnosed and implemented first, then the doc was
written to record the diagnosis and cite the resulting commit hash. All
three commits carry the required citations; the plan's acceptance criteria
were re-verified after all three landed._

## Files Created/Modified

- `mazeworld.html` - `paint()` gains the `mwPaintSkipHiddenTabs`-gated
  conditionals around the Hero/Gear tab mounts (2 lines); `stepWith` sets/
  resets the flag around its unchanged `window.paint();` call (3 lines);
  `showTab()` gains a catch-up render for the Hero/Gear mount on tab switch
  (7 lines); +37/-2 lines total, CRLF preserved (Edit tool only, no
  whole-file rewrite)
- `docs/PERF-BASELINE.md` - Device/Protocol/BEFORE/Jank report/Decision
  sections filled; AFTER section still reserved ("Filled by Plan 49-02")
  pending Task 3

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `function paint(opts = {})` broke 6 source-pin tests**
- **Found during:** Task 1 (verification after the first fix attempt)
- **Issue:** The first implementation changed `paint()`'s signature to
  accept an options object and changed `stepWith`'s call to
  `window.paint({ skipHiddenTabs: true })`. `npm test` immediately showed 7
  failures: `gearTab.test.js`, `heroTab.test.js`, and
  `shell-party-camp.test.js` each slice the classic script between the
  literal strings `"function paint() {"` and a following anchor to extract
  paint()'s body for regex assertions (mount-call shape, dossier/ability-row
  literals, `paintConditions(c);` presence, WP-fill threshold writes, the
  party-roster-via-paint() ruling); `perfMarks.test.js`'s PERF-01 shell pin
  independently asserts the literal substring `"window.paint();"` exists
  inside `stepWith`, in index order relative to the other instrumentation
  literals. Changing either the signature or the call broke every one of
  these pins even though none of the underlying behavior they test had
  regressed — the region-slice anchors simply no longer matched.
- **Fix:** Reverted to the exact original `function paint() {` signature and
  the exact original `window.paint();` call. Replaced the parameter with a
  module-scope classic-script global, `let mwPaintSkipHiddenTabs = false;`,
  declared just above `paint()`. `stepWith` now does
  `mwPaintSkipHiddenTabs = true; window.paint(); mwPaintSkipHiddenTabs =
  false;` around its one call (synchronous, single-threaded — no
  reentrancy risk). Every other `window.paint()` call site is untouched and
  runs with the flag at its default `false`.
- **Files modified:** `mazeworld.html` (same file, corrected in place before
  the fix commit landed — the flag design is what's in `9fe9bb5`, not the
  discarded `paint(opts)` attempt)
- **Verification:** `npm test` 3,313/3,313 (0 fail); `node --test
  test/unit/shell-tab-snapshots.test.js` 10/10, `git diff --stat --
  test/unit/fixtures/` empty
- **Committed in:** `9fe9bb5` (the flag-based version is what was committed;
  the parameter-based attempt was never committed)

---

**Total deviations:** 1 auto-fixed (1 bug — a source-pin regression caught
before commit, not shipped)
**Impact on plan:** No scope creep; the final shipped fix is smaller and
lower-risk than the discarded first attempt (a plain boolean flag vs. a
threaded options parameter), and every pre-existing source-pin test still
passes unchanged.

## Issues Encountered

None beyond the deviation above (caught and corrected within Task 1, before
any commit landed).

## Gate results (recorded verbatim, at commit `9fe9bb5`)

- `npm test 2>&1 | grep -E "^# (pass|fail)"` — `# pass 3313` / `# fail 0`
- `node --test test/unit/shell-tab-snapshots.test.js 2>&1 | grep -E "^# (pass|fail)"` — `# pass 10` / `# fail 0`; `git diff --stat -- test/unit/fixtures/` — empty
- `npm run build:www` — exit 0, `www/index.html` stamped
- `npm run boot:check` — `PASS no-uncaught`, `PASS painted`, `PASS graves`, `PASS title` (4/4)
- `node --test test/unit/bridge-registry.test.js` — `# pass 10` / `# fail 0`; `node tools/bridge-doc.mjs --check` — exit 0
- `node tools/stale-terms.mjs` — exit 0
- `grep -rn "performance.now" www/` — exactly the same 7 guarded lines as 49-01 (line numbers shifted, content unchanged); `grep -rn "performance.now" www/ | grep -vc "perf ? \|if (perf)"` — 0; `grep -rl "performance.now" www/` — exactly `www/index.html`
- `git status --porcelain engine/ content/ test/parity/` — empty; `git hash-object test/parity/prototype-master.js.txt` — `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `git diff --stat 9c9a755..HEAD -- engine/ content/ test/parity/` — empty
- `git diff --numstat -- mazeworld.html` (fix commit) — `37  2  mazeworld.html`; `git ls-files --eol mazeworld.html` — `i/lf w/crlf` (CRLF preserved)

## User Setup Required

None for Task 1. Task 2 (below) is the in-phase human device-verification
step — the AFTER run on a second APK.

## Next Phase Readiness

- **AWAITING AFTER REPORT.** Task 2's checkpoint is reached — see the
  checkpoint block in this handoff. The orchestrator must build a second
  debug APK at commit `9fe9bb5` (or later, but the fix must be included),
  record its commit hash, and have the user repeat the exact 49-01 checklist
  protocol (depth 5, ≥ 50 mixed steps through water/dark/encounter/tab
  switch) on the Pixel 7, then report the seven items listed in the
  checkpoint's how-to-verify.
- Task 3 cannot start until that AFTER report exists — it fills the AFTER
  table, checks the cited row against < 16 ms with no other row slower (or
  `git revert`s the fix and records why), quotes ROADMAP criteria 1-4
  verbatim with evidence, runs the closing gate set, and marks PERF-01/
  PERF-02 complete in REQUIREMENTS.md.
- No blockers beyond the device session itself.

---
*Phase: 49-measure-first-perf-pass*
*Completed: pending — Task 2/3 remain*

## AFTER report (fix 1, `9fe9bb5`; APK `b8c9293`)

Reported by the user in chat, 2026-09-20, same protocol (depth 5, ≥ 50 mixed steps). Numbers quoted exactly as pasted:

```
step 11.3 / 19.3 / 24.9 · dispatch 4.1 / 8.0 / 15.4 · paint 4.8 / 7.4 / 9.8 · draw 1.9 / 3.6 / 7.8 ms (med / p95 / max, n=70)
```

| Row | Median | p95 | Max | n |
| --- | --- | --- | --- | --- |
| step | 11.3 | 19.3 | 24.9 | 70 |
| dispatch | 4.1 | 8.0 | 15.4 | 70 |
| paint | 4.8 | 7.4 | 9.8 | 70 |
| draw | 1.9 | 3.6 | 7.8 | 70 |

- **Device build number:** CP2A.260705.006 (unchanged)
- **APK commit (AFTER 1):** b8c9293 (includes `9fe9bb5`)
- **Jank report (user's words):** "Jank is none"
- **Also raised by the user on this run (not a regression):** the dev Start-at-depth run rolls a fresh character (`startNewRun(undefined, { startDepth })`, unchanged since Phase 21 `83526ae`), so the roller showed a Court Mage and the Hero tab the dev run's own Thief — by design; a possible post-milestone todo (dev start keeps the rolled character).

### Orchestrator ruling (user, 2026-09-20)

`step` p95 19.3 ≥ 16 ms — criterion 3's "< 16 ms" is met on median (11.3) and NOT MET on p95 after fix 1. The user chose **a second presentation-only fix citing the same `step` row**: remove the redundant second `draw()` per step in `stepWith` (classic `paint()` already ends with `draw()`; see 49-01's finding), then APK #3 and one more re-measure. Rationale: dispatch + paint + draw p95 (19.0) ≈ step p95 (19.3), so the remaining step cost is the sum of its parts and the duplicate draw is the one known redundant part (~1.9 ms median / ~3.6 ms p95). If p95 still lands ≥ 16 after fix 2, the user's standing ruling is: record the numbers honestly, keep both fixes (every row improved or held; draw +0.3 ms is within noise), do not revert. Recorded as a deviation from the plan's "ONE fix commit" and "revert if not < 16" clauses.

## Fix 2

**Commit:** `cfce555` — `perf(49-02): remove the redundant second canvas draw() per step — cites step p95 19.3 ms (AFTER 1) / 28.9 ms (BEFORE) (PERF-02)`

**What changed:** `stepWith` called `window.draw()` a second time after
`window.paint()` — but classic `paint()` already ends with `renderEncounter();
renderRail(); draw();` internally (49-01's own documented finding). Removed
`stepWith`'s standalone `window.draw()` call (and its own `tDraw`/
`perf.record("draw", ...)` bracket) entirely. The single remaining `draw()`
call — inside `paint()` — is now the ONLY canvas draw per step.

**Safety verified before removing (read, not re-measured):** `draw()`'s
pixel content depends only on `S` (already set earlier in `stepWith`, via
`inViewWindow(state, x, y)` reading `state.floor.px/py`), never on `cam`
(the camera/viewport variable). `centerMap()`/`keepPartyInView()` (the
camera nudge `stepWith` calls after this point) only mutate `cam` and
reposition the already-drawn canvas element via `positionCanvas()`'s CSS
`left`/`top` — they never redraw pixels. The Oracle `logLine` loop has no
`draw()` dependency either. So moving the one remaining `draw()` earlier
(now inside `paint()`, before the `logLine` loop and the camera nudge)
changes nothing about final on-screen correctness.

**Keeping the `draw` row meaningful:** re-bracketed the dev-gated
`performance.now()` pair inside `paint()` itself, around its own `draw()`
call, via a new `window.__mzPerfMarks` bridge (the SAME `perfMarks` module
instance `stepWith` already imports directly — `paint()` is the classic
`<script>` and cannot `import`). Registered in `src/browser/bridge.js`
(alphabetically between `__mzPendingNarration` and
`__mzPreferencesOverride`) and `docs/SHELL-MODULES.md` regenerated via
`node tools/bridge-doc.mjs --write`. The `draw` row now measures the one
real draw from inside `paint()` rather than a second, now-removed `draw()`
call from `stepWith`.

**Test-pin maintenance** (`test/unit/perfMarks.test.js`,
`test/unit/shell-map-rail.test.js`): several source-pin tests asserted the
OLD shape (draw bracketed inside `stepWith`; zero `performance.now`/
`perfMarks` tokens anywhere in the classic script; `renderRail()`
immediately followed by `draw()` with zero gap). Updated to assert the NEW,
intentional shape: draw's dev-gated bracket now lives inside `paint()`'s
own tail (a new `PAINT_DRAW_REGION` pin mirrors the `stepWith` region pins
exactly — same ordering check, same record-count check, same dev-gate-
phrasing check); the classic-script "carries no perf token" invariant is
narrowed to "carries no perf token OUTSIDE paint()'s own draw() bracket"
(still zero everywhere else, pinned at exactly 2 tokens inside the
bracket); the `renderRail()`/`draw()` adjacency check now tolerates the new
bracket's non-brace content between them instead of requiring a zero-length
gap.

**Ship-proof grep re-recorded** (a `performance.now()` pair moved, per the
ground rules — "if you moved a performance.now line, re-record the grep"):

```
$ grep -rn "performance.now" www/
www/index.html:2503:  const tDraw = perf ? performance.now() : 0;
www/index.html:2505:  if (perf) perf.record("draw", performance.now() - tDraw);
www/index.html:4999:    const tStep = perf ? performance.now() : 0;
www/index.html:5001:    if (perf) perf.record("dispatch", performance.now() - tStep);
www/index.html:5061:    const tPaint = perf ? performance.now() : 0;
www/index.html:5072:    if (perf) perf.record("paint", performance.now() - tPaint);
www/index.html:5098:    if (perf) { perf.record("step", performance.now() - tStep); perfReadout(perf); }
```

Still exactly 7 guarded lines (0 unguarded), only in `www/index.html` — 2
now inside classic `paint()` (lines 2503, 2505), 5 still inside module
`stepWith` (lines 4999–5098).

### Gate results (recorded verbatim, at commit `cfce555`)

- `npm test 2>&1 | grep -E "^# (pass|fail)"` — `# pass 3315` / `# fail 0` (+2 net over fix 1's 3,313 — the two new `PAINT_DRAW_REGION` pins)
- `node --test test/unit/shell-tab-snapshots.test.js 2>&1 | grep -E "^# (pass|fail)"` — `# pass 10` / `# fail 0`; `git diff --stat -- test/unit/fixtures/` — empty
- `npm run build:www` — exit 0, `www/index.html` stamped
- `npm run boot:check` — `PASS no-uncaught`, `PASS painted`, `PASS graves`, `PASS title` (4/4)
- `node --test test/unit/bridge-registry.test.js` — `# pass 10` / `# fail 0`; `node tools/bridge-doc.mjs --check` — exit 0
- `node tools/stale-terms.mjs` — exit 0
- `grep -rn "performance.now" www/` — 7 lines, re-recorded above; `grep -rn "performance.now" www/ | grep -vc "perf ? \|if (perf)"` — 0; `grep -rl "performance.now" www/` — exactly `www/index.html`
- `git status --porcelain engine/ content/ test/parity/` — empty; `git hash-object test/parity/prototype-master.js.txt` — `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `git diff --stat 9c9a755..HEAD -- engine/ content/ test/parity/` — empty

### Deviations from Plan (Fix 2)

**2. [User ruling — plan deviation] Second fix landed instead of reverting fix 1**
- **Found during:** Task 2's checkpoint resume (AFTER 1 report)
- **Issue:** The plan's own rule (Task 3, step 1) says: if the cited row is still ≥ 16 ms (median or p95) after the AFTER run, `git revert` the fix and close as "no fix". AFTER 1 showed `step` p95 19.3 ms — still ≥ 16 ms.
- **Ruling:** The user, reviewing the AFTER 1 numbers directly (every row improved or held, no jank, no regression), overrode the revert-on-failure clause and directed a second presentation-only fix citing the same `step` row, to be re-measured once more (AFTER 2) before any final revert decision. A standing ruling was also given: if AFTER 2's p95 is still ≥ 16 ms, keep BOTH fixes and record the numbers honestly rather than revert.
- **Files modified:** `mazeworld.html`, `src/browser/bridge.js`, `docs/SHELL-MODULES.md`, `test/unit/perfMarks.test.js`, `test/unit/shell-map-rail.test.js`
- **Verification:** all gates green at `cfce555` (see above)
- **Committed in:** `cfce555` (fix), `70e199f` (doc)

---

**AWAITING AFTER REPORT 2**

Nothing else in code or docs should be written until the AFTER 2 numbers
exist. Task 3 (the AFTER table close, ROADMAP criteria 1-4, closing gates,
PERF-01/PERF-02 marked complete) cannot start until then.

**Orchestrator:** build a third debug APK with `npm run android:debug` at
commit `cfce555` (or later, as long as it includes both fixes), and record
its commit hash as APK_COMMIT_AFTER_2.

**User — repeat the same checklist protocol a second time:**
1. If a Play-installed build is on the phone, uninstall it first (different signer).
2. `adb devices` (or `adb mdns services` if the port rotated — Pixel 7 is `adb-28051FDH200H0R`).
3. `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
4. `adb shell am force-stop com.darktierstudios.delvedierepeat` then `adb shell monkey -p com.darktierstudios.delvedierepeat 1` (install alone doesn't reload the WebView).
5. Title → ENTER → take any roll → on the map open Settings (gear chip right of MAKE CAMP) and long-press "Version …" for about 1.2 s until "Start at depth (dev)" appears.
6. Enter 5 in the depth field and tap Start.
7. Walk at least 50 tapped steps, mixed the way you normally play: through a water pool, into a dark region and back out, at least one encounter card, and at least one tab switch (Gear or Hero, then back to the map). Don't steer around things to make the numbers look good.
8. Open Settings again and read the line under the Start button (or `adb logcat -s chromium | grep mzperf`).
9. Report back, copying the numbers exactly as shown (do not round):
   1. step median / p95 / max, n
   2. dispatch median / p95 / max
   3. paint median / p95 / max
   4. draw median / p95 / max
   5. device build number (Settings → About phone → Build number)
   6. APK commit (APK_COMMIT_AFTER_2)
   7. jank — anything seen and where, or "none"

**Expected outcome:** `step`'s p95 now below 16 ms (with the redundant
draw removed, dispatch + paint + draw's own p95 sum was already ≈ 19.0 ms
in AFTER 1 — removing draw's ~3.6 ms p95 contribution from the total should
land step's p95 close to 15-16 ms, though this is a projection, not a
promise — the actual device number is what counts). Per the user's standing
ruling: if p95 is still ≥ 16 ms, Task 3 records the numbers honestly and
KEEPS both fixes rather than reverting either.

## AFTER report 2 (fixes 1+2, `9fe9bb5` + `cfce555`; APK `c0cdbae`)

Reported by the user in chat, 2026-09-20, same protocol (depth 5; the walk came in at n=47, three under the protocol's ≥ 50 — recorded as given, not padded). Numbers quoted exactly as pasted:

```
step 11.8 / 19.9 / 31.2 · dispatch 4.9 / 8.6 / 15.4 · paint 5.4 / 13.6 / 14.1 · draw 3.6 / 11.2 / 12.3 ms (med / p95 / max, n=47)
```

| Row | Median | p95 | Max | n |
| --- | --- | --- | --- | --- |
| step | 11.8 | 19.9 | 31.2 | 47 |
| dispatch | 4.9 | 8.6 | 15.4 | 47 |
| paint | 5.4 | 13.6 | 14.1 | 47 |
| draw | 3.6 | 11.2 | 12.3 | 47 |

- **Device build number:** CP2A.260705.006 (unchanged)
- **APK commit (AFTER 2):** c0cdbae (includes `9fe9bb5` and `cfce555`)
- **Jank report (user's words):** "No jank"
- **Orchestrator reading (for Task 3 to confirm):** `step` p95 19.9 ≥ 16 — criterion 3's "< 16 ms" NOT MET on p95 (median 11.8 met). The `draw` row now brackets the one remaining draw inside `paint()` (fix 2 re-scoped it); its p95 11.2 vs 3.6 on AFTER 1 reflects this walk's route (more steps where the canvas is expensive — the dark-region render filter is the likely cost), and it lifts paint's p95 the same way. Between-walk variance is of the same order as the fixes. **Standing user ruling applies: keep both fixes, no revert; record honestly.** Next lever for a future pass: the dark-region draw cost (measure a dark-only vs lit-only walk before touching it).

### AFTER 2 — final readout (n=61, same run continued)

The user took further steps on the same dev run and re-read the line so the ring holds ≥ 50 samples. This supersedes the n=47 line above as the AFTER-2 record; numbers quoted exactly as pasted:

```
step 11.5 / 19.8 / 31.2 · dispatch 4.7 / 8.1 / 15.4 · paint 5.4 / 10.0 / 14.1 · draw 3.6 / 11.2 / 12.3 ms (med / p95 / max, n=61)
```

| Row | Median | p95 | Max | n |
| --- | --- | --- | --- | --- |
| step | 11.5 | 19.8 | 31.2 | 61 |
| dispatch | 4.7 | 8.1 | 15.4 | 61 |
| paint | 5.4 | 10.0 | 14.1 | 61 |
| draw | 3.6 | 11.2 | 12.3 | 61 |

Reading unchanged: `step` p95 19.8 ≥ 16 (NOT MET on p95; median 11.5 met); paint p95 settled to 10.0 with more samples; both fixes kept by the standing ruling.
