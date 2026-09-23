---
phase: 59-party-animation-dungeon-set-dressing
plan: 05
subsystem: ui
tags: [canvas-rendering, dungeon-dressing, settings, bridge, node-test, phase-close]

# Dependency graph
requires:
  - phase: 59-party-animation-dungeon-set-dressing (plan 02)
    provides: "src/browser/dressing.js — createDressingArt/createDressingBridge/DRESSING_ICON_NAMES, the dressing setting, icons.js#loadIconSet — the pure contract this plan wires in"
  - phase: 59-party-animation-dungeon-set-dressing (plan 04)
    provides: "the completed party-marker wiring (glideParty/window.__mzPartySprite) this plan's phase-close gate proves untouched"
provides:
  - "draw()'s one new statement — window.__mzDressing?.drawLayer?.(ctx, S, CELL, visible); — directly after the maze border and before the feature-icon loop, so ambient props draw beneath every feature"
  - "The lazy, Off-aware dressing-art load: dressingArt (createDressingArt) declared before currentSettings (TDZ-safe), applySettings gates dressingArt.setEnabled, release() scheduled one rAF+setTimeout(0) frame after __mzClassicBoot()"
  - "The Settings sheet's 'Set dressing' On/Off row (after Haptics, before the version row), independent of Sound, repainting the map immediately on flip"
  - "window.__mzDressing = createDressingBridge({ art: dressingArt, drawIcon: drawFeatureIcon }) — the BRIDGE row, docs/SHELL-MODULES.md regenerated"
  - "test/unit/harness/shellSandbox.js's `dressing` option — the REAL __mzDressing bridge over an injectable art source, mirroring the fake-clock precedent"
  - "test/unit/dressing-shell.test.js (11 tests) and test/unit/phase59-gates.test.js (4 tests) — the DRESS-01..05 shell-wiring proof and the phase's closing Modularity/Presentation gates"
  - "The re-pinned draw() SHA-256 digest and shell-map-hud.test.js needle, extended for the one new dressing call"
  - "The Phase 60 batched Pixel 7 device checklist (this SUMMARY), merging every deferred device item from 59-01..05"
affects: [60-performance-footprint-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A sandbox art-source injection point (test/unit/harness/shellSandbox.js's `dressing: { enabled, images }` option) wiring the REAL createDressingBridge, mirroring the established fake-clock/canvasContext injection precedent — never a second, hand-rolled bridge stub."
    - "A generic expectedVisible(sandbox, state) test helper that replays draw()'s own visibleProps computation (propsFor + the real window.__mzMapView.inViewWindow predicate) so every exclusion test (feature/party/fog/render-window) compares against the SAME rule the shipped code runs, not a re-derived expectation."

key-files:
  created:
    - test/unit/dressing-shell.test.js
    - test/unit/phase59-gates.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/shell-map-hud.test.js
    - test/unit/reduced-motion.test.js

key-decisions:
  - "BASE_59 = f220718eadff6220cc9228b1eacab2ace5cb82ae (the commit that added 59-CONTEXT.md), re-confirmed per the plan's own discovery step — matches every prior 59-0x plan's own recorded value."
  - "PRE59 = 25136c8bd76fefdf3ed05a62de5ea026e2525244 (`git rev-parse \"$(git log --reverse --format=%H f220718..HEAD -- src/browser/partySprite.js src/browser/dressing.js | head -1)^\"`) — the Phase 58 close commit, the one immediately before Phase 59's first code. Its draw() body's comment-stripped, non-blank line count (66) is pinned as PRE59_DRAW_NONBLANK_LINES in phase59-gates.test.js; the current draw() body is 47 non-blank lines, well under that ceiling."
  - "Discovery re-verification: every landed-code assumption in the plan's discovery checklist (draw()'s structure/comments, the settings block's shape, the icons bridge block, 59-02's exported contract, reduced-motion.test.js's digest mechanism) held exactly as documented — no adaptation needed beyond the plan's own instructions."
  - "Test 3's resolved-feature seed was found by a one-off seed search (placeDressing against newRun(seed) for seed 1..500): seed 1, depth 1 puts a floor prop (set_dungeon_fern) at (17,9), a cell genFloor(1, rng) independently gives a 'climb' feature — pinned as a literal (RESOLVED_FEATURE_SEED/RESOLVED_FEATURE_CELL) in dressing-shell.test.js, with a fixture assertion (`assert.equal(g[9][17].feat, \"climb\")`) so a future engine/rng change fails loudly here rather than silently passing a stale fixture."
  - "shellSandbox.js's `dressing` option default (no option given) wires the REAL bridge with `enabled: () => true, images: () => null` — the exact real boot-sequence state one frame BEFORE the lazy load resolves (Set dressing On by default, but the loader hasn't returned yet), which drawLayer's own D-14 guard turns into 'draw nothing'. This matches the real module script's own sequencing without a second copy of the loader state machine."

patterns-established:
  - "expectedVisible(sandbox, state) (dressing-shell.test.js) — replay the shipped bridge's own propsFor/visibleProps computation against the sandbox's real __mzMapView predicate, rather than re-deriving placement/exclusion rules a second time in test code. Reusable for any future dressing-adjacent shell test."

requirements-completed: [DRESS-01, DRESS-02, DRESS-03, DRESS-04, DRESS-05]

coverage:
  - id: D1
    description: "draw() gains exactly one window.__mzDressing?.drawLayer?.(ctx, S, CELL, visible); statement, placed after the maze border and before the feature-icon loop — every prop draws beneath every feature (DRESS-01)"
    requirement: "DRESS-01"
    verification:
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(1) props draw beneath the features"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(i) draw()"
        status: pass
      - kind: unit
        ref: "test/unit/phase59-gates.test.js#(1) draw() only shrank and gained one call"
        status: pass
    human_judgment: false
  - id: D2
    description: "Floor props draw at 0.35 alpha / 0.6 scale, wall props at 0.85 / 0.6 scale; feature icons stay at alpha 1 / 0.75 scale, unaffected by the dressing layer (DRESS-02)"
    requirement: "DRESS-02"
    verification:
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(2) dimming and size"
        status: pass
    human_judgment: false
  - id: D3
    description: "No prop draws on a cell holding a live feature (stairs included), the party's square, or (1,1); a floor prop reappears once its feature resolves (DRESS-03)"
    requirement: "DRESS-03"
    verification:
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(3) exclusions"
        status: pass
    human_judgment: false
  - id: D4
    description: "No prop draws on an unseen cell (fog) or outside the 57-04 dark-square 3x3 render window"
    requirement: "DRESS-03"
    verification:
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(4) fog"
        status: pass
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(5) the render window"
        status: pass
    human_judgment: false
  - id: D5
    description: "The lazy, Off-aware dressing-art load: dressingArt declared before currentSettings (TDZ-safe), setEnabled wired in applySettings, release() scheduled one rAF+setTimeout(0) frame after __mzClassicBoot(); loadIconSet( appears in the module script only inside createDressingArt('s own argument slice (DRESS-05, D-14)"
    requirement: "DRESS-05"
    verification:
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(7) before the lazy load"
        status: pass
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(10) settings wiring (source)"
        status: pass
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(11) lazy load (source)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Settings sheet's 'Set dressing' On/Off row (after Haptics, before the version row), independent of Sound; Off draws zero props and never loads the 54 images; flipping the row repaints the map immediately (D-15, D-16)"
    requirement: "DRESS-05"
    verification:
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(6) Off"
        status: pass
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(10) settings wiring (source)"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#dressing"
        status: pass
    human_judgment: false
  - id: D7
    description: "Determinism (DRESS-04): identical prop-draw call lists across two draw() calls on the same state, and across a save/reload round trip (serializeRun -> validateSave -> rehydrate); the engine's own JSON.stringify(state) is byte-identical before and after draw()"
    requirement: "DRESS-04"
    verification:
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(8) determinism"
        status: pass
      - kind: unit
        ref: "test/unit/dressing-shell.test.js#(9) the engine is untouched"
        status: pass
    human_judgment: false
  - id: D8
    description: "window.__mzDressing is the one new bridge name (createDressingBridge({ art: dressingArt, drawIcon: drawFeatureIcon })), registered in src/browser/bridge.js and docs/SHELL-MODULES.md in the same commit as its wiring"
    requirement: "DRESS-01"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js"
        status: pass
      - kind: unit
        ref: "test/unit/phase59-gates.test.js#(3) bridge registration"
        status: pass
    human_judgment: false
  - id: D9
    description: "Phase 59's closing Modularity/Presentation gates, pinned durably: draw() only shrank and gained one call; the two Phase 59 modules (partySprite.js, dressing.js) import only their one declared dependency each and touch no window/document/Math.random/Date.now/matchMedia; nothing in engine/ or content/ imports from src/browser/"
    verification:
      - kind: unit
        ref: "test/unit/phase59-gates.test.js (4 tests)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The full phase gate: npm test fail 0; npm run build:www exit 0; the engine/content/test-parity diff against BASE_59 is empty; the prototype master hash is unchanged; package.json/package-lock.json are unchanged; bridge-registry.test.js is green; no orphaned Phase 59 shell functions"
    verification:
      - kind: other
        ref: "npm test (3886/3886, fail 0); npm run build:www (exit 0); git diff --stat f220718..HEAD -- engine/ content/ test/parity/ (empty); git hash-object test/parity/prototype-master.js.txt (a1f4d0dc29782218d8e5aab65bc5989c33f917f0); git diff f220718..HEAD -- package.json package-lock.json (empty); node --test test/unit/bridge-registry.test.js (10/10); node tools/shell-sweep.mjs orphans (none of partyShown/positionPartySprite/positionParty/glideParty)"
        status: pass
    human_judgment: false
  - id: D11
    description: "Device-level legibility, Off/On, and cold-start checks on the Pixel 7 (props read as ambiance never an encounter; Set dressing Off/On toggles live; cold start with dressing On is as fast as before, props appear a moment later, positions persist across a mid-floor close/reopen)"
    verification: []
    human_judgment: true
    rationale: "Real-device rendering/DPI/lighting legibility, live-toggle feel and cold-start timing cannot be proven by a unit test — deferred to the Phase 60 batched Pixel 7 session per this run's deferred-UAT protocol (see the checklist below)."

# Metrics
duration: ~95min
completed: 2026-09-22
status: complete
---

# Phase 59 Plan 05: DRESS-01..05 Shell Wiring + Phase Close Summary

**One new `draw()` statement (`window.__mzDressing?.drawLayer?.(ctx, S, CELL, visible);`) wires the ambient dungeon-prop layer beneath the feature icons; the 54 `set_dungeon_*` images load lazily one frame after the first map paint and never while Set dressing (a new independent Settings row, default On) is Off; `window.__mzDressing` is the one new bridge; 15 new tests (`dressing-shell.test.js`, `phase59-gates.test.js`) prove every DRESS-01..05 claim on the real `draw()` and pin Phase 59's closing Modularity/Presentation gates; `npm test` 3886/3886, the engine/content/parity gate is clean, and the Phase 60 batched Pixel 7 checklist is recorded below.**

## Performance

- **Duration:** ~95 min
- **Completed:** 2026-09-22
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- **Task 1 (`dd1bc6d`, feat):** `draw()` gains exactly one new statement — `window.__mzDressing?.drawLayer?.(ctx, S, CELL, visible);` — directly after `ctx.strokeRect(3, 3, size - 6, size - 6);` and before the feature-icon loop, so every prop draws beneath every feature. The Settings sheet gains a "Set dressing" On/Off row (identical shape to Haptics) after Haptics and before the version row. The module script: two new import lines (`createDressingArt`/`createDressingBridge`/`DRESSING_ICON_NAMES` from `dressing.js`; `loadIconSet` from `icons.js`, kept separate so the pre-existing icons import stays byte-identical); `const dressingArt = createDressingArt({ load: () => loadIconSet("./icons/optimized", DRESSING_ICON_NAMES), onReady: () => window.draw?.() })` declared directly before `let currentSettings = null;` (TDZ-safe — the first `applySettings(await readSettings())` call further down reads it); `applySettings` gains `dressingArt.setEnabled(settings.dressing === true);` right after the Phase 56 `applySfxSettings(settings);` line; the settings click handler gains `if (key === "dressing") window.draw?.();`; `window.__mzDressing = createDressingBridge({ art: dressingArt, drawIcon: drawFeatureIcon });` is assigned next to `window.__mzIconsApi`; and `requestAnimationFrame(() => setTimeout(() => dressingArt.release(), 0));` is added directly after `await window.__mzClassicBoot();`. `src/browser/bridge.js` gains the `__mzDressing` BRIDGE row (sorted between `__mzDescend` and `__mzDropShelfItems`); `docs/SHELL-MODULES.md` regenerated via `node tools/bridge-doc.mjs --write` in the same commit. All of Task 1's node-check acceptance criteria (index ordering, exactly-once counts, TDZ order) and `npm run build:www` passed.
- **Task 2 (`e44c23e`, test):** `test/unit/harness/shellSandbox.js` gains a `dressing` option (`{ enabled, images }`), wiring the REAL `createDressingBridge` over an injectable art source — mirroring the established fake-clock injection precedent; the default (no option) mirrors the real pre-lazy-load boot state (enabled, images `null`, which draws nothing). `test/unit/dressing-shell.test.js` (new, 11 named tests, ALL PASSED on the first run) proves every DRESS-01..05 must_haves claim on the REAL `draw()`: props beneath features (1); dimming/size (2); the feature/stairs/party/(1,1) exclusion, including a pinned seed (1, depth 1, cell (17,9)) proving a floor prop reappears once its feature resolves (3); fog (4); the 57-04 dark-square 3x3 render window (5); Off draws zero props with features unaffected (6); the pre-load state draws zero props and never throws (7); determinism across repeat draws and a full save/reload round trip (8); the engine untouched (9); and two source-anchor tests for the Settings row/handler/TDZ order (10) and the lazy-load scheduling (11). `test/unit/shell-map-hud.test.js` (i) gains the dressing call in draw()'s must-include needle list. `test/unit/reduced-motion.test.js`'s `DRAW_SHA256` is re-pinned to draw()'s body after this plan's one added statement; `paint()`'s digest is untouched. Teeth check (after commit, reverted via `git checkout -- mazeworld.html`): temporarily moved the dressing call to after the feature loop — `dressing-shell` test (1) failed exactly as required, then reverted.
- **Task 3 (`150db79`, test):** `test/unit/phase59-gates.test.js` (new, 4 named tests) pins Phase 59's closing Modularity and Presentation gates durably: (1) `draw()` references `__mzDressing` exactly once, never reads `PLAYER_MARKER_ICON`/`createRadialGradient`/`fillText` again, and has fewer non-blank comment-stripped lines (47) than PRE59's (66, pinned as a literal — see key-decisions); (2) `partySprite.js` imports only `./cameraGlide.js`, `dressing.js` imports only `../../engine/rng.js`, and neither touches `window`/`document`/`Math.random`/`Date.now`/`matchMedia`; (3) `__mzPartySprite`/`__mzDressing` are BRIDGE keys, each assigned exactly once in the module script; (4) nothing under `engine/` or `content/` imports from `src/browser/` (a comment-stripped import-specifier scan — the earlier substring-only check would have false-positived on `src/browser/...` mentioned inside doc comments in `engine/derived.js`/`economy.js`/`movement.js`/`phobias.js`/`state.js` and `content/flavor.js`; the real test only matches actual `import ... from "..."` specifiers, and correctly found zero). Teeth check (after commit, reverted): temporarily duplicated the dressing call in `draw()` — `phase59-gates` test (1) failed exactly as required (expected 1 reference, got 2), then reverted.
- **Full phase gate (recorded live, this run):** `npm test` **3886/3886, fail 0** (up from the 3871/3871 baseline recorded at dispatch — +15 across this plan's three tasks). `npm run build:www` exit 0 (confirmed all 54 `set_dungeon_*` PNGs present under `www/icons/optimized/`). `git diff --stat f220718eadff6220cc9228b1eacab2ace5cb82ae..HEAD -- engine/ content/ test/parity/` — empty. `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged). `git diff f220718eadff6220cc9228b1eacab2ace5cb82ae..HEAD -- package.json package-lock.json` — empty. `node --test test/unit/bridge-registry.test.js` — 10/10. `node tools/shell-sweep.mjs orphans` — lists none of `partyShown`, `positionPartySprite`, `positionParty`, `glideParty`. `git status --short` clean after every commit and teeth-check revert.

## Requirement → Proving Test Map

| Requirement | Proving tests |
|---|---|
| ANIM-01 | party-sprite-shell (1)-(8), party-sprite (1) |
| ANIM-02 | party-glide (1)-(7), party-sprite (2) |
| ANIM-03 | party-sprite-shell (9) |
| DRESS-01 | dressing (1), dressing-shell (1) |
| DRESS-02 | dressing-shell (2) |
| DRESS-03 | dressing-shell (3)-(5) |
| DRESS-04 | dressing-determinism, dressing-shell (8)-(9) |
| DRESS-05 | settings, dressing-shell (6), (10) |

## Task Commits

Each task was committed atomically:

1. **Task 1: The draw() prop-layer call, the lazy Off-aware art, the __mzDressing bridge and the Set dressing row** - `dd1bc6d` (feat)
2. **Task 2: dressing-shell.test.js on the real draw(), the sandbox's dressing option and the re-pins** - `e44c23e` (test)
3. **Task 3: The Phase 59 gates test, the full phase gate and the Phase 60 device checklist** - `150db79` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `mazeworld.html` — draw()'s one dressing call; the Set dressing Settings row; the module script's dressingArt declaration, applySettings gate, click-handler redraw, __mzDressing assignment and lazy-release scheduling
- `src/browser/bridge.js` — the `__mzDressing` BRIDGE row
- `docs/SHELL-MODULES.md` — regenerated via `node tools/bridge-doc.mjs --write`
- `test/unit/harness/shellSandbox.js` — the `dressing` option, wiring the REAL __mzDressing bridge
- `test/unit/dressing-shell.test.js` — new, 11 tests
- `test/unit/phase59-gates.test.js` — new, 4 tests
- `test/unit/shell-map-hud.test.js` — (i)'s must-include needle list extended
- `test/unit/reduced-motion.test.js` — DRAW_SHA256 re-pinned

## Decisions Made

See `key-decisions` in the frontmatter above (BASE_59/PRE59 hashes and how they were computed; the discovery re-verification; the pinned resolved-feature seed and its fixture guard; the sandbox's default `dressing` state mirroring the real pre-load boot moment).

## Deviations from Plan

None — plan executed exactly as written. The Task 3 dependency-direction test (4) was written as a comment-stripped, real-`import`-specifier scan rather than a naive substring search specifically because a substring search would have false-positived on `src/browser/...` mentioned inside several `engine/`/`content/` doc comments (discovered while drafting the test, before it ever ran red) — this is the plan's own instruction ("nothing in engine/ or content/ imports from src/browser/") implemented correctly, not a deviation from it.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Phase 60 batched Pixel 7 checklist

Per the standing deferred-UAT protocol, no device pause occurred and no APK was built during Phase 59. This list merges every deferred device item from 59-01 through 59-05, for one batched Pixel 7 session at Phase 60.

**Party animation (ANIM-01..03, from 59-03/59-04):**
1. On the Pixel 7, the standing party gently cycles its idle frames (about one breath a second), reads as the highlight on its own, and the old black ring is gone, leaving only a soft warm glow.
2. Each step slides the party smoothly into the next square with a quick step animation and it settles back to breathing on arrival; tapping fast several times never stutters or lags behind; when the map scrolls at an edge, the party and the map move as one; the marker disappears under the encounter panel with no flicker when a fight opens.
3. Stairs and teleports put the party on its new square at once, with no slide across the map.

**Set dressing (DRESS-01..05, from 59-02/59-05):**
4. Each floor shows a handful of dim props on paths and brighter ones on walls; none is ever mistaken for an encounter, a chest or a crevice; no prop covers the stairs, a feature or the party; props only appear where the map is revealed and inside the dark window.
5. Settings → Set dressing Off clears every prop at once and On brings them back; the Sound setting is unaffected either way.
6. Cold start with Set dressing On shows the map as fast as before, with the props appearing a moment after it; closing and reopening the app mid-floor shows the props in the same places.

**Reduced motion (all of Phase 59, one consolidated item):**
7. With Android's "Remove animations" on: the party's idle art is frozen on its first frame with a steady glow (no pulse); each step lands the party on its new square instantly, with no slide; Set dressing's on/off flip still redraws immediately (dressing has no animation of its own to freeze).

**Accessibility (TalkBack, new for this plan):**
8. With TalkBack on, the party marker and the dungeon props add nothing to what TalkBack announces on the map — neither is in the accessibility tree (both are canvas pixels or `aria-hidden`), so the map screen reads exactly as it did before Phase 59.

**Cold start / PERF-03 (new for this plan, measured against `docs/PERF-BASELINE.md`):**
9. Compare cold-start timing with Set dressing On vs Off against the `docs/PERF-BASELINE.md` baseline: the 8 party-sprite frames (~142 KB) load eagerly at boot in both cases (unaffected by the Set dressing toggle); the 54 dressing images (~980 KB) load lazily, one presented frame after the first map paint, ONLY when Set dressing is On — cold start itself (time to first map paint) should be unaffected by the Set dressing setting either way.

## Next Phase Readiness

- Phase 59 (party animation + dungeon set dressing) is functionally and gate-complete: ANIM-01..03 and DRESS-01..05 are all wired end to end, proven by 15 new tests this plan plus the pre-existing 59-01..04 suites, and pinned durably by `phase59-gates.test.js`.
- No blockers. `npm test` 3886/3886; `npm run build:www` exit 0; engine/content/test-parity gate clean against `f220718`; prototype master hash unchanged; `package.json`/`package-lock.json` untouched; `bridge-registry.test.js` green; no orphaned Phase 59 shell functions; working tree clean.
- The Phase 60 batched Pixel 7 checklist above is ready for that phase's device-UAT session — nothing further is deferred from Phase 59.
- This plan does NOT mark the phase complete (STATE.md/ROADMAP.md plan-progress only) — the orchestrator closes the phase per this run's isolation instructions.

---
*Phase: 59-party-animation-dungeon-set-dressing*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/harness/shellSandbox.js
- FOUND: test/unit/dressing-shell.test.js
- FOUND: test/unit/phase59-gates.test.js
- FOUND: test/unit/shell-map-hud.test.js
- FOUND: test/unit/reduced-motion.test.js
- FOUND: commit dd1bc6d
- FOUND: commit e44c23e
- FOUND: commit 150db79
