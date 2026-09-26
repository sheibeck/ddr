---
phase: 80-android-release-build-tooling
plan: 03
subsystem: infra
tags: [android, capacitor, css, cdp, headless-chrome, large-screens]

requires:
  - phase: 80-android-release-build-tooling (80-01, 80-02)
    provides: R8/keep-rule config and the status-bar removal, running in parallel (no shared files)
provides:
  - "tools/letterbox-check.mjs: a dependency-free headless-Chrome CDP layout check + screenshot driver"
  - "android:appCategory=\"game\" on <application> so Android 16 keeps honouring the portrait lock on large screens"
  - "mazeworld.html's <style id=\"mw-letterbox\"> block: a centred 480 CSS px portrait column with #080705 gutters on anything wider than a phone"
  - "docs/ANDROID-DISPLAY.md: the large-screen decision record (created; 80-04/80-05 append)"
affects: [80-04, 80-05]

tech-stack:
  added: []
  patterns:
    - "CDP-driven layout/screenshot checks (roller-repro.mjs scaffolding reused for a second tool)"
    - "contain:layout on html>body as a containing-block trick to letterbox every fixed overlay with zero per-overlay CSS"

key-files:
  created:
    - tools/letterbox-check.mjs
    - test/unit/android-large-screen.test.js
    - docs/ANDROID-DISPLAY.md
    - .planning/phases/80-android-release-build-tooling/80-screens/browser-{phone,tablet,foldable,chromebook}-{title,app}.png
  modified:
    - android/app/src/main/AndroidManifest.xml
    - mazeworld.html

key-decisions:
  - "Column width 480 CSS px (Claude's discretion per CONTEXT): just above the widest common phones, so every phone keeps its full-width layout and every large screen gets a phone-shaped column."
  - "CSS letterboxing via contain:layout on html>body, not a native/per-overlay approach: makes body the containing block for every position:fixed inset:0 descendant in one rule, so present AND future fixed overlays land in the column automatically."
  - "Screenshots captured for phone/tablet/foldable/chromebook only; phone-max is a layout-boundary measurement viewport, not a screenshot pair (matches the plan's eight committed PNGs)."

patterns-established:
  - "Pattern: :root/html>body selectors (not a lone body{} rule folded into an existing block) to guarantee this rule wins regardless of where other <style> blocks set body's own margin/background."

requirements-completed: [DROID-03]

coverage:
  - id: D1
    description: "tools/letterbox-check.mjs measures the letterboxed column across five viewports and exits non-zero on any mismatch"
    requirement: "DROID-03"
    verification:
      - kind: other
        ref: "node tools/letterbox-check.mjs --shots .planning/phases/80-android-release-build-tooling/80-screens (5/5 viewports passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "android:appCategory=\"game\" declared on <application>; MainActivity portrait lock and nativeChrome.js ScreenOrientation lock untouched; no resizeableActivity/restricted-resizability opt-out added"
    requirement: "DROID-03"
    verification:
      - kind: unit
        ref: "test/unit/android-large-screen.test.js#DROID-03: the manifest declares the app a game, keeps the portrait lock, and adds no large-screen opt-out"
        status: pass
      - kind: unit
        ref: "test/unit/android-large-screen.test.js#DROID-03: nativeChrome.js still locks orientation to portrait"
        status: pass
    human_judgment: false
  - id: D3
    description: "mazeworld.html carries exactly one delimited <style id=\"mw-letterbox\"> block (BEGIN/END markers, min-width:481px media query, html>body max-width:480px + contain:layout, :root #080705 background), last in <head>, with no other style block setting a max-width on body"
    requirement: "DROID-03"
    verification:
      - kind: unit
        ref: "test/unit/android-large-screen.test.js#DROID-03: mazeworld.html has exactly one mw-letterbox <style> block, last in <head>"
        status: pass
      - kind: unit
        ref: "test/unit/android-large-screen.test.js#DROID-03: the mw-letterbox block holds BEGIN/END markers and the column rules"
        status: pass
      - kind: unit
        ref: "test/unit/android-large-screen.test.js#DROID-03: no OTHER <style> block in mazeworld.html sets a max-width on body"
        status: pass
    human_judgment: false
  - id: D4
    description: "phone layout is pixel-unchanged: mazeworld.html changed by exactly one added hunk before </head>, no lines removed/changed"
    requirement: "DROID-03"
    verification:
      - kind: other
        ref: "git diff -U0 -- mazeworld.html | grep -c '^@@' == 1; git diff -- mazeworld.html | grep -c '^-[^-]' == 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/ANDROID-DISPLAY.md records the large-screen decision, the corrected Android 16 mechanism, and Play's warning-3 verdict; full test suite green"
    requirement: "DROID-03"
    verification:
      - kind: other
        ref: "node -e \"...docs/ANDROID-DISPLAY.md keyword check...\" (printed 'display doc ok')"
        status: pass
      - kind: unit
        ref: "npm test (6568/6568 pass)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Play's display-configuration warning (#3) verdict — confirmed only by the next Play pre-launch report, or accepted per this doc's rationale"
    human_judgment: true
    verification: []
    rationale: "Play Console's own pre-launch report is the only authority for whether the warning actually clears after the appCategory declaration; that report doesn't run until the next upload, which is out of this plan's (code-only, no-build) scope. Batched into the milestone-close human checklist."

duration: 40min
completed: 2026-09-26
status: complete
---

# Phase 80 Plan 03: Large-Screen Letterboxed Column Summary

**A deliberate 480px portrait column (CSS `contain:layout` on `html>body`) plus `android:appCategory="game"` keep phones pixel-unchanged while tablets, foldables and Chromebooks get a centred, gutter-framed layout instead of a stretched one — measured by a new dependency-free headless-Chrome CDP tool across five viewports.**

## Performance

- **Duration:** ~40 min (first commit to last commit; setup/investigation not counted)
- **Started:** 2026-09-26 (task 1 read/build phase)
- **Completed:** 2026-09-26T17:08:55-04:00
- **Tasks:** 3
- **Files modified:** 12 (2 tool/config files, 1 manifest, 1 HTML, 1 test, 1 doc, 8 screenshot PNGs treated as one unit above but individually tracked in git)

## Accomplishments

- Built `tools/letterbox-check.mjs`, a dependency-free CDP layout-check-and-screenshot driver (roller-repro.mjs scaffolding), and used it to record a genuine RED baseline at the plan base (phone/phone-max pass, tablet/foldable/chromebook fail — no column exists yet).
- Declared `android:appCategory="game"` on `<application>` in `AndroidManifest.xml`, correcting the phase's own CONTEXT.md assumption (research showed the exemption runs the OPPOSITE direction: the game category makes Android 16 **keep** honouring the portrait lock on large screens, not "let large screens rotate").
- Added exactly one delimited `<style id="mw-letterbox">` block to `mazeworld.html` (one contiguous added hunk before `</head>`, zero lines changed elsewhere) that centres a 480 CSS px portrait column with `#080705` gutters on anything wider than a phone, using `contain:layout` on `html>body` so every current AND future `position:fixed` overlay lands inside the column with zero per-overlay CSS.
- Re-ran `letterbox-check.mjs` after the change: **5/5 viewports pass**, phone/phone-max rows identical to the RED baseline, 8 browser screenshots captured.
- Wrote `docs/ANDROID-DISPLAY.md`, the large-screen decision record, quoting all three Play Console warnings verbatim and recording the corrected mechanism and warning-3 verdict.
- Ran the full suite: **6568/6568 green** (up from master's 6563/6563 baseline — the 5 new tests in `android-large-screen.test.js`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the letterbox check and record the RED baseline** - `0f461856` (feat)
2. **Task 2: Declare the game category and add the delimited letterbox block** - `5940b6fc` (feat)
3. **Task 3: Create docs/ANDROID-DISPLAY.md with the large-screen decision record; run the full suite** - `71ee6c98` (docs)

_Task 2's commit also folds a small fix to `tools/letterbox-check.mjs` (see Deviations) discovered while producing Task 2's screenshots — see Deviations for the Rule 1 justification._

## RED baseline (Task 1, plan base — before any code change)

Run: `node tools/letterbox-check.mjs --json` — exit code **1**.

| Viewport | innerWidth | Mode | #app left/width | Verdict |
| --- | --- | --- | --- | --- |
| phone | 412 | full | 0 / 412 | **PASS** |
| phone-max | 480 | full | 0 / 480 | **PASS** |
| tablet | 800 | column | 0 / 800 | FAIL — `#app` and every inset-0 overlay spanned the full 800px width instead of a centred 480px column; root background was `rgba(0,0,0,0)` not `rgb(8,7,5)`; `.mw-maze-viewport` spanned the full width |
| foldable | 700 | column | 0 / 700 | FAIL — same shape of mismatch at 700px |
| chromebook | 1280 | column | 0 / 1280 | FAIL — same shape of mismatch at 1280px |

`letterbox-check: 2/5 viewports passed` — confirms the RED expectation: phone-shaped viewports already look correct (no column needed), large viewports do not yet have one.

## GREEN result (Task 2, after the manifest + CSS change)

Run: `node tools/letterbox-check.mjs --shots .planning/phases/80-android-release-build-tooling/80-screens --json` — exit code **0**.

| Viewport | innerWidth | Mode | #app left/width | Verdict |
| --- | --- | --- | --- | --- |
| phone | 412 | full | 0 / 412 | **PASS** (identical to RED baseline) |
| phone-max | 480 | full | 0 / 480 | **PASS** (identical to RED baseline) |
| tablet | 800 | column | 160 / 480 | **PASS** — column centred at `(800-480)/2 = 160` |
| foldable | 700 | column | 110 / 480 | **PASS** — column centred at `(700-480)/2 = 110` |
| chromebook | 1280 | column | 400 / 480 | **PASS** — column centred at `(1280-480)/2 = 400` |

`letterbox-check: 5/5 viewports passed`. Every measured `position:fixed` overlay (`#mw-title-screen`, `#mw-roller-screen`, `#mw-legend-sheet`, `#mw-settings-sheet`, `#mw-acct-sheet`, `#mw-camp-sheet`, `#mw-gear-sheet`, `#mw-fightlog-sheet`, `#mw-hud-menu-scrim`) and `.mw-maze-viewport` were confirmed inside the column on every column-mode viewport, and the root's computed background was `rgb(8, 7, 5)` on every column-mode viewport.

**Phone baseline comparison:** phone and phone-max rows are byte-identical between the RED and GREEN runs (`left: 0`, `width: innerWidth`) — the phone layout did not move.

## vw and position:fixed inventory (Task 2 action item 4)

**`vw` uses re-checked, all capped well inside 480px:**

| Location | Use | Cap |
| --- | --- | --- |
| `mazeworld.html:164` | `font-size:clamp(21px,3vw,30px)` | font size, capped 30px — not a layout-width concern |
| `mazeworld.html:390` (comment) | `min(62vw,420px)` | 420px cap, inside the 480px column |
| `mazeworld.html:1181` `.mw-hud-menu` | `width:min(288px,calc(100vw - 40px))` | 288px cap, well inside the column |
| `mazeworld.html:1515` | `font-size:clamp(20px,6vw,28px)` | font size, capped 28px |

**`position:fixed` rules re-checked, all measured by `letterbox-check.mjs`:**

| Selector | Overlay(s) it applies to | Measured? |
| --- | --- | --- |
| `.mw-hud-menu-scrim` (`mazeworld.html:1230`) | `#mw-hud-menu-scrim` | Yes |
| `.mw-title-screen` (`:1471`) | `#mw-title-screen` | Yes |
| `.mw-legend-sheet` (`:1581`) | `#mw-legend-sheet`, `#mw-settings-sheet`, `#mw-acct-sheet`, `#mw-camp-sheet`, `#mw-gear-sheet`, `#mw-fightlog-sheet` | Yes (all 6 ids measured individually) |
| `.mw-roller-screen` (`:1792`) | `#mw-roller-screen` | Yes |

No fixed rule in the file was left unmeasured.

## Screenshot descriptions (Task 2 action item 6)

- **`browser-phone-app.png`** (412 CSS px): the map fills the viewport edge-to-edge exactly as before — no column, no gutters, HUD band at the top spans full width.
- **`browser-tablet-app.png`** (800 CSS px): the same HUD/map layout now sits inside a visibly centred column with dark `#080705` gutters filling roughly 160px on each side; the map viewport and HUD chrome stay phone-shaped inside the column, not stretched.

## Files Created/Modified

- `tools/letterbox-check.mjs` - dependency-free CDP layout-check + screenshot driver, five viewports, `--shots`/`--json` flags
- `android/app/src/main/AndroidManifest.xml` - `android:appCategory="game"` added to `<application>` with an explanatory comment
- `mazeworld.html` - one delimited `<style id="mw-letterbox">` block inserted before `</head>` (one added hunk, nothing else touched)
- `test/unit/android-large-screen.test.js` - source pins for the manifest, portrait locks and the letterbox CSS block
- `docs/ANDROID-DISPLAY.md` - the large-screen decision record (created; owns Play warning 3)
- `.planning/phases/80-android-release-build-tooling/80-screens/browser-{phone,tablet,foldable,chromebook}-{title,app}.png` - 8 browser screenshots from the GREEN run

## Decisions Made

- Column width 480 CSS px, just above the widest common phones (~430-450px), so every phone keeps its current full-width layout and every large screen gets a phone-shaped column (Claude's discretion per CONTEXT.md).
- CSS letterboxing via `contain:layout` on `html>body` rather than per-overlay `max-width` rules or a native Android letterbox: one rule makes `body` the containing block for every `position:fixed` `inset:0` descendant, so present and future fixed overlays are covered automatically (Claude's discretion per CONTEXT.md).
- Screenshots limited to phone/tablet/foldable/chromebook (8 files) — phone-max exists only to pin the `COLUMN_PX`/`BREAKPOINT_PX` boundary in the layout measurement, not to produce a ninth/tenth screenshot pair, matching the plan's `files_modified` list exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tools/letterbox-check.mjs` captured screenshots for phone-max, which the plan does not list**
- **Found during:** Task 2 (comparing the first full 5-viewport `--shots` run's output against the plan's `files_modified` list — it produced 10 PNGs, not 8)
- **Issue:** The screenshot-capture block in `runViewport()` fired for every viewport, including `phone-max`, producing `browser-phone-max-title.png`/`browser-phone-max-app.png` that the plan does not track
- **Fix:** Scoped screenshot capture to `viewportSpec.name !== "phone-max"`; removed the two stray files and re-ran the full check to regenerate exactly the eight PNGs the plan lists
- **Files modified:** `tools/letterbox-check.mjs`
- **Verification:** Final `--shots` run produced exactly 8 files matching the plan's `files_modified` list; `letterbox-check: 5/5 viewports passed`
- **Committed in:** `5940b6fc` (Task 2 commit)

**2. [Rule 1 - Bug] Environment-flaky headless-Chrome cold boot caused false timeouts on the initial RED-baseline attempts**
- **Found during:** Task 1 (the first two full 5-viewport runs timed out on 3-4 of 5 viewports at "title ready (initial boot)", not a genuine layout failure)
- **Issue:** This machine intermittently takes much longer than a 15s budget for a fresh headless Chrome profile to cold-boot when prior instances' process trees are still winding down — the same class of environment flakiness already recorded in STATE.md for `tools/shell-boot-check.mjs`. Diagnosis: `wmic process ... call terminate` against a viewport's own top-level `chrome.exe` occasionally returns `ReturnValue = 2` (Access Denied) from this shell context, leaving zombie process trees that starve the next viewport's cold boot of CPU/IO
- **Fix:** Widened the initial-boot timeout from 15s to 45s (the post-navigate re-check stays at 20s, since that path only needs a reload of an already-warm renderer), and added an 800ms pause between viewports in `main()`'s loop to let a torn-down process family fully exit before the next launch
- **Files modified:** `tools/letterbox-check.mjs`
- **Verification:** A clean-environment run (`tasklist` confirmed no stray `chrome.exe` beforehand) with the widened timeout produced a genuine RED baseline (2/5 pass, real layout-mismatch failures on the other 3, not timeouts) on the very next attempt, and the subsequent GREEN runs passed 5/5 on the first try each time
- **Committed in:** `5940b6fc` (Task 2 commit, folded in alongside the phone-max screenshot fix since both are `letterbox-check.mjs` hardening discovered in the same investigation)
- **Note:** this machine's inability to `taskkill`/`wmic terminate` some headless Chrome main processes it spawns (Access Denied from this shell context) is a pre-existing environment quirk, not a regression this plan introduced — matches the precedent in STATE.md's `npm run boot:check` blocker entry.

**3. [Rule 1 - Bug] The `nativeChrome.js` source-pin regex in the new test didn't match the actual optional-chaining syntax**
- **Found during:** Task 2 (writing `test/unit/android-large-screen.test.js` RED, before the CSS/manifest change)
- **Issue:** The regex `ScreenOrientation\??\.lock\??\(\{...` expected `lock?(` but the real code is `lock?.(` (optional chaining before the call, not before the paren)
- **Fix:** Added the missing `\.?` between the second `\??` and `\(` in the regex
- **Files modified:** `test/unit/android-large-screen.test.js`
- **Verification:** `node --test test/unit/android-large-screen.test.js` — this specific test now passes
- **Committed in:** `5940b6fc` (Task 2 commit)

**4. [Rule 1 - Bug] Two test regexes produced false positives/negatives against the file's own prose**
- **Found during:** Task 2 (running the new test after adding the CSS block, before the manifest comment wording was finalized)
- **Issue A:** `grep -c "android:appCategory=\"game\""` on the manifest returned 2, not the required 1, because the explanatory XML comment above `<application>` also contained the literal attribute text
- **Issue B:** The "exactly one `<style id=\"mw-letterbox\">`, last in head" test failed because the new CSS block's own explanatory comment contained the literal substring `<style>` (in "the other `<style>` blocks above"), which the test's tag-finding regex matched as a sixth `<style>` element
- **Fix A:** Reworded the manifest comment to describe the attribute without repeating its exact `attr="value"` text
- **Fix B:** Reworded the CSS comment to say "the other style blocks above" instead of "the other `<style>` blocks above"
- **Files modified:** `android/app/src/main/AndroidManifest.xml`, `mazeworld.html`
- **Verification:** `grep -c` now returns 1; `node --test test/unit/android-large-screen.test.js` — all 5 tests pass
- **Committed in:** `5940b6fc` (Task 2 commit)

**5. [Rule 1 - Bug] The "no other style block sets a max-width on body" test regex false-matched `.mw-roller-body`**
- **Found during:** Task 2 (running the new test after the CSS block was added)
- **Issue:** The regex `/body[^{]*\{[^}]*max-width/i` matched the CSS class `.mw-roller-body{...max-width:420px...}` because "body" is a substring of "roller-body", not the intended bare `body` element selector
- **Fix:** Added negative-lookaround word boundaries (`(?<![\w-])body(?![\w-])`) so the regex only matches a standalone `body` token, not a class-name suffix
- **Files modified:** `test/unit/android-large-screen.test.js`
- **Verification:** `node --test test/unit/android-large-screen.test.js` — this test now passes without false-flagging `.mw-roller-body`
- **Committed in:** `5940b6fc` (Task 2 commit)

**6. [Rule 1 - Bug] docs/ANDROID-DISPLAY.md's screenshot links resolved to the wrong path**
- **Found during:** Task 3 (final review before commit)
- **Issue:** The doc lives at `docs/ANDROID-DISPLAY.md`, but the screenshot markdown links used `phases/80-android-release-build-tooling/80-screens/...` — relative to `docs/`, that resolves to a nonexistent `docs/phases/...` path instead of `.planning/phases/...`
- **Fix:** Rewrote each link to `../.planning/phases/80-android-release-build-tooling/80-screens/...`, verified each path resolves from `docs/`
- **Files modified:** `docs/ANDROID-DISPLAY.md`
- **Verification:** Manually confirmed both linked files exist at the corrected relative path from `docs/`
- **Committed in:** `71ee6c98` (Task 3 commit)

---

**Total deviations:** 6 auto-fixed (all Rule 1 — bugs found and fixed inline during TDD RED/GREEN iteration and final review; none required package installs or architectural changes)
**Impact on plan:** All auto-fixes were necessary for the new tool/test/doc to actually work as specified. No scope creep — every fix stayed inside files the plan already lists, plus removing two stray screenshot files the tool over-produced.

## Issues Encountered

- Headless Chrome process cleanup is unreliable from this Bash tool's shell context: `wmic process ... call terminate` against a viewport's own top-level `chrome.exe` sometimes returns Access Denied, leaving zombie process trees that can starve subsequent headless-Chrome launches of resources and cause false cold-boot timeouts (not genuine layout failures). Mitigated for this tool by widening timeouts and adding inter-viewport spacing (see Deviations #2); documented here since it may recur for any future CDP-based tooling on this machine, matching the precedent already recorded in STATE.md for `tools/shell-boot-check.mjs`.

## User Setup Required

None - no external service configuration required. No Gradle task ran and no emulator/device build was touched, per this plan's web-only verification scope (user ruling 2026-09-26).

## Human verification (milestone close)

- On the Pixel 7: confirm the phone layout looks exactly as before (title, map, sheets, HUD menu) — this plan asserts it via automated pixel/rect measurement, but a real-device look is still owed per the deferred-UAT protocol.
- After the next Play upload (80-04/80-05's release build), confirm the pre-launch report no longer shows the display-configuration warning (Play warning 3), or record that this doc's "consciously accepted" verdict stands if it persists.
- 80-04 re-runs `tools/letterbox-check.mjs` against the final milestone code (after gameplay phases 75.3-79.1 land) to confirm no later fixed overlay escaped the column.
- 80-05's emulator tablet/foldable pass is the first real (non-browser) confirmation that the manifest's `appCategory="game"` actually keeps Android honouring the portrait lock outside a browser tab.

## Next Phase Readiness

- `tools/letterbox-check.mjs` is ready for 80-04's re-run against the final milestone code.
- `docs/ANDROID-DISPLAY.md` has its "Large screens (DROID-03)" section complete; 80-04 appends the edge-to-edge and audit sections (warnings 1/2), 80-05 appends the verification section.
- No blockers for 80-04/80-05. This plan touched no Gradle/build files and ran no Gradle task, so it does not interact with 80-01/80-02's parallel work on the same wave.

---
*Phase: 80-android-release-build-tooling*
*Completed: 2026-09-26*

## Self-Check: PASSED

All 13 created/modified files (`tools/letterbox-check.mjs`, `test/unit/android-large-screen.test.js`,
`docs/ANDROID-DISPLAY.md`, `android/app/src/main/AndroidManifest.xml`, `mazeworld.html`, and the 8
`80-screens/*.png` files) confirmed present on disk. All 3 task commit hashes (`0f461856`, `5940b6fc`,
`71ee6c98`) confirmed present in `git log`.
