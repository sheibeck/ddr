# Phase 49 (PERF-01/02) — Measure-First Perf Pass: baseline

Measure first, fix only what is measured. This doc's Method/Protocol/How to
re-measure sections were written by Plan 49-01 (instrumentation); the report
sections (Device, BEFORE, Jank report, Decision, AFTER) are reserved for
Plan 49-02, filled from the user's Pixel 7 device session.

## Method

A dev (start-at-depth) run records four timing rows into a 100-sample ring
per row, using `src/browser/perfMarks.js` (a pure module — no clock, no DOM,
no globals — unit-tested in node with injected samples) plus seven
`performance.now()` call sites inside `mazeworld.html`'s module script,
every one guarded by the shell's existing dev flag (`state.dev`, true only
for a start-at-depth run started from the Settings sheet's hidden dev row).
A normal run takes no timing reading and records nothing: `const perf =
window.__mzState.get()?.dev ? perfMarks : null;`, and every clock read is
`perf ? performance.now() : 0` or wrapped in `if (perf)`.

The four rows, and what each brackets:

- **step** — the whole `stepWith(action)` body: `dispatchWithNarration`, the
  `window.__mzState.set(state)` write, `noteCombat`/haptics, the pending-
  obstacle/hazard/dark computation, the pre-death beat, the narration
  stash, `paint()`, `draw()`, the Oracle log append (`window.logLine`), and
  the moved-event camera nudge (`mzCenterMap`/`mzKeepPartyInView`). It is a
  superset of every other row — the number to read first.
- **dispatch** — `dispatchWithNarration(action)`: the engine action dispatch
  itself, the narration fold, and the rail-card push. Measured from the
  start of `stepWith` to just after the destructured dispatch call, so it
  also carries any engine-adjacent setup ahead of the call (there is none
  today; the name follows the call it brackets, not a hand-trimmed window).
- **paint** — one `window.paint()` call: the DOM re-render (HUD, panels,
  Gear/Hero/Oracle, the rail). `paint()` itself **ends by calling `draw()`**
  (`renderEncounter(); renderRail(); draw();`), so **paint ≥ draw always**,
  and DOM-only cost is approximately `paint − draw`.
- **draw** — the trailing, standalone `window.draw()` call directly after
  `paint()`. Because `paint()` already draws once internally, **`stepWith`
  draws the canvas twice per step** — this is a finding this plan records,
  not a fix: it is subject to the same ≥ 16 ms fix-rule test as any other
  row (see the Fix rule below), not resolved here.

The ring keeps the last 100 samples per row; `summary()` reports `n`
(samples currently in the ring), `total` (all-time record count, so a ring
that has wrapped still shows how many steps actually ran), and `median`/
`p95`/`max` computed by the nearest-rank method (`sorted[Math.ceil(k · n) −
1]`). The `#mw-dev-perf` line (inside the hidden `#mw-dev-row`, under the
Settings sheet's Start button) is written after every recorded step:

```
step 7.4 / 12.1 / 30.2 · dispatch 1.1 / 2.0 / 4.0 · paint 3.2 / 6.0 / 9.9 · draw 1.9 / 4.3 / 7.7 ms (med / p95 / max, n=57)
```

and the same summary is logged to the console as JSON every 10 recorded
steps (`PERF_LOG_EVERY`): `console.log("[mzperf] " + JSON.stringify(s))`, so
`adb logcat -s chromium | grep mzperf` reports identical numbers off-device.

**Criterion-4 ship proof** — after `npm run build:www`, `grep -rn
"performance.now" www/` lists exactly these 7 lines, all in
`www/index.html`, all inside `stepWith`, every one guarded:

```
www/index.html:4952:    const tStep = perf ? performance.now() : 0;
www/index.html:4954:    if (perf) perf.record("dispatch", performance.now() - tStep);
www/index.html:5014:    const tPaint = perf ? performance.now() : 0;
www/index.html:5016:    if (perf) perf.record("paint", performance.now() - tPaint);
www/index.html:5017:    const tDraw = perf ? performance.now() : 0;
www/index.html:5019:    if (perf) perf.record("draw", performance.now() - tDraw);
www/index.html:5032:    if (perf) { perf.record("step", performance.now() - tStep); perfReadout(perf); }
```

The instrumentation stays in the shipped build (dev-gated) rather than
being removed — it is the phase's measurement method under criterion 1, not
a "fix" under criterion 2, and it lets a future perf pass skip this plan's
work. This is recorded as a judgment call the user can reverse in one
revert commit.

### Fix rule (PERF-02), verbatim from the ROADMAP

A code change is allowed only if it cites a baseline row with **median or
p95 ≥ 16 ms** per step, or a jank the user confirmed on device (quoted).
Otherwise the phase's whole diff beyond the instrumentation is this doc —
and the SUMMARY says "no row qualified; the phase closes with the baseline
and no fix" in those words. If a fix lands: presentation-only (shell/
`src/browser`), one commit, citing the row; the user re-runs the same
protocol on a second APK and this doc's AFTER table shows that row < 16 ms
with no other row slower. The DOM-snapshot smoke must still pass byte-equal
(a perf fix must not change rendered DOM; if it must, that is a user
decision — ask).

## Device

Filled by Plan 49-02 from the user's Pixel 7 report (quoted as given, never rounded or estimated).

## Protocol

Planned protocol, run by the user on the Pixel 7 after the orchestrator
builds and hands over the debug APK:

- **Depth:** start at **D = 5** — the shallowest non-breather floor whose
  `difficultyCurve(depth)` gives at least one dark blob. Measured directly
  against the frozen engine (`node -e "import('./engine/difficulty.js')..."`)
  at this plan's execution: `{"D":5,"breather":false,"darkBlobs":3,"waterPools":2}`
  — 3 dark blobs and 2 water pools, so the floor has both a dark region and
  water in one place.
- **Steps:** at least 50 tapped steps, mixed the way the user normally
  plays — not a synthetic best case.
- **Coverage:** the walk must pass through at least one water pool, into a
  dark region and back out, at least one encounter card (fight, flee, or
  parley), and at least one tab switch (Gear or Hero, then back to the
  map).
- **What to read:** the `#mw-dev-perf` line under the Settings sheet's
  Start button — four rows, each `median / p95 / max` in ms, plus `n` (ring
  sample count). Optional cross-check: `adb logcat -s chromium | grep
  mzperf` prints the same numbers as JSON every 10 steps.
- **What to report:** all four rows' med/p95/max/n, the device build number
  (Settings → About phone → Build number), the APK's commit, and any jank
  seen and where (a stutter on a step, a late repaint, a tab flash) — or
  "none".

## BEFORE

Filled by Plan 49-02 from the user's Pixel 7 report (quoted as given, never rounded or estimated).

## Jank report

Filled by Plan 49-02 from the user's Pixel 7 report (quoted as given, never rounded or estimated).

## Decision

Filled by Plan 49-02 from the user's Pixel 7 report (quoted as given, never rounded or estimated).

## AFTER

Filled by Plan 49-02 from the user's Pixel 7 report (quoted as given, never rounded or estimated).

## How to re-measure

1. Build the debug APK: `npm run android:debug` (produces
   `android/app/build/outputs/apk/debug/app-debug.apk`).
2. If a Play-installed build is on the phone, uninstall it first — a Play
   build and a local debug build have different signers.
3. Rediscover the wireless device: `adb devices` (or `adb mdns services` if
   the port has rotated — the Pixel 7 is `adb-28051FDH200H0R`).
4. Install: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
5. Relaunch (install alone does not reload the WebView):
   `adb shell am force-stop com.darktierstudios.delvedierepeat` then
   `adb shell monkey -p com.darktierstudios.delvedierepeat 1`.
6. Title → ENTER → take any roll → on the map open Settings (the gear chip
   right of MAKE CAMP) and long-press the "Version …" label for about 1.2 s
   until the "Start at depth (dev)" row appears.
7. Enter a depth (5 for the standard protocol above) and tap Start.
8. Walk, then read `#mw-dev-perf` under the Start button and/or run
   `adb logcat -s chromium | grep mzperf` for the same numbers as JSON.
9. Optional future cross-check (declined for this pass): Chrome's own
   remote profiling (`chrome://inspect` over adb, attached to the device's
   WebView) can corroborate these numbers with a flame chart if a future
   pass wants finer-grained attribution than the four rows above give.
