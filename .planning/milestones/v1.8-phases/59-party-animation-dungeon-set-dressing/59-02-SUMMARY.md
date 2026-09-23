---
phase: 59-party-animation-dungeon-set-dressing
plan: 02
subsystem: ui
tags: [canvas-rendering, deterministic-rng, settings, dungeon-dressing, node-test]

# Dependency graph
requires:
  - phase: 57-map-hud-layout-band
    provides: __mzMapView (inViewWindow/mapViewRadius render-window predicate) and the stationary-camera map surface this layer draws under
  - phase: 41-terrain-water-pools
    provides: the derivedRng(seed, "terrain", depth) precedent (engine/maze.js#placeWater) this plan's derivedRng(seed, "dressing", depth) stream mirrors
provides:
  - The 54-prop DRESSING_PROPS category table (15 wall, 39 floor) with light depth weighting and blood/look-alike rarity
  - placeDressing: a pure, total, deterministic scatter of 8-12 props per floor from a shell-derived rng stream, reading only the immutable floor structure
  - visibleProps/drawDressingLayer: the draw-time feature/stairs/party/fog/render-window exclusion and the dimmed, small, below-feature-layer paint pass
  - createDressingArt/createDressingBridge: the lazy at-most-once image loader and the thin factory 59-05 wires as window.__mzDressing
  - icons.js#loadIconSet: the one image loader, now shared by preloadIcons and the dressing lazy-load
  - The dressing setting (fifth SETTINGS_DEFAULTS field, default true, independent of sound)
  - The DRESS-04 determinism ledger proving dressing never touches engine state or a run's serialized output
affects: [59-05 (the shell wiring wave that calls placeDressing/createDressingArt/createDressingBridge and adds the Settings sheet row)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shell-derived deterministic randomness via engine/rng.js#derivedRng(seed, 'dressing', depth), never the run's main rng stream (mirrors Phase 41's placeWater precedent)"
    - "Placement/draw-time split: placeDressing reads only the immutable floor structure (walls/water/(1,1) start); visibleProps applies every mutable-state exclusion (feat/seen/render-window/party) separately at draw time"
    - "Lazy at-most-once asset loading gated on two independent flags (enabled && released), reusable pattern for any future lazily-loaded shell asset set"
    - "A recording 2D canvas context (test/unit/harness/recordingCanvas.js) for call-by-call draw assertions, additive alongside recordingDom.js's no-op sink"

key-files:
  created:
    - src/browser/dressing.js
    - test/unit/harness/recordingCanvas.js
    - test/unit/dressing.test.js
    - test/unit/dressing-determinism.test.js
  modified:
    - src/browser/icons.js
    - src/browser/settings.js
    - test/unit/icons.test.js
    - test/unit/settings.test.js
    - test/unit/shell-gear-toolbar.test.js

key-decisions:
  - "The plan's literal DRESS-04 test-shape text (`rehydrate(validateSave(JSON.parse(serializeRun(state))))`) doesn't type-check — serializeRun returns an object, not a string, so JSON.parse would throw. Used the landed real-world call shape instead (confirmed against test/unit/loot-pile.test.js and a dozen other call sites): `rehydrate(validateSave(JSON.stringify(serializeRun(state))).value)`."
  - "WALL_PROP_ALPHA locked at 0.85 per D-12, even though DRESS-05's own prose says wall props draw at 'full strength' — the locked decision record wins over the looser requirements phrasing; documented in the export's own JSDoc."

requirements-completed: [DRESS-01, DRESS-02, DRESS-03, DRESS-04, DRESS-05]

coverage:
  - id: D1
    description: "DRESSING_PROPS: 54 frozen entries (15 wall, 39 floor) matching icons/optimized/set_dungeon_*.png exactly, with kind/lean/weight per the discovery table"
    requirement: "DRESS-01"
    verification:
      - kind: unit
        ref: "test/unit/dressing.test.js#DRESSING_PROPS: 54 frozen entries, unique ids, icon = set_dungeon_<id>, 15 wall / 39 floor, matching the discovery table"
        status: pass
    human_judgment: false
  - id: D2
    description: "propWeight: light +/-40% depth lean for shallow/deep props (clamped to depth 1..20), neutral props depth-independent, blood + coins_gems/pit rare at 0.25x"
    requirement: "DRESS-01"
    verification:
      - kind: unit
        ref: "test/unit/dressing.test.js#propWeight: ... (7 named tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "placeDressing: pure, total placement of 8-12 props per floor from derivedRng(seed, 'dressing', depth) only — half wall/half floor, Chebyshev-spaced >=2, never the (1,1) arrival square, never mutates its grid input"
    requirement: "DRESS-01"
    verification:
      - kind: unit
        ref: "test/unit/dressing.test.js#placeDressing: across 200 fixed seeds and depths 1/5/20, ..."
        status: pass
      - kind: unit
        ref: "test/unit/dressing.test.js#placeDressing: total and pure — a missing grid, empty grid, no-walkable-cell grid, non-number seed and NaN depth never throw"
        status: pass
    human_judgment: false
  - id: D4
    description: "visibleProps: draw-time exclusion of any prop on a live feature (stairs included), the party square, an unseen cell, or a cell outside the render window; a prop reappears once its feature resolves"
    requirement: "DRESS-03"
    verification:
      - kind: unit
        ref: "test/unit/dressing.test.js#visibleProps: drops a prop on a feature ..."
        status: pass
    human_judgment: false
  - id: D5
    description: "drawDressingLayer: draws through drawFeatureIcon at PROP_SCALE 0.6 (below the feature layer's 0.75), FLOOR_PROP_ALPHA 0.35 / WALL_PROP_ALPHA 0.85, one save/restore, globalAlpha restored to 1, skips undecoded images"
    requirement: "DRESS-02"
    verification:
      - kind: unit
        ref: "test/unit/dressing.test.js#drawDressingLayer: draws every visible prop dim/small and centred, ..."
        status: pass
    human_judgment: false
  - id: D6
    description: "createDressingArt: the 54 images load at most once, only once BOTH enabled and released; Off never loads; images() persists after a later setEnabled(false)"
    requirement: "DRESS-02"
    verification:
      - kind: unit
        ref: "test/unit/dressing.test.js#createDressingArt: loads the 54 images at most once, ..."
        status: pass
    human_judgment: false
  - id: D7
    description: "createDressingBridge: the window.__mzDressing-shaped factory — drawLayer no-ops while disabled/before images load, propsFor memoises per floor key, drawLayer never mutates state"
    requirement: "DRESS-01"
    verification:
      - kind: unit
        ref: "test/unit/dressing.test.js#createDressingBridge: drawLayer no-ops ..."
        status: pass
    human_judgment: false
  - id: D8
    description: "icons.js#loadIconSet: the one image loader (fail-open, decoding=async, src=base/<name>.png); preloadIcons delegates to it unchanged"
    verification:
      - kind: unit
        ref: "test/unit/icons.test.js#loadIconSet / preloadIcons (3 named tests)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The dressing setting: fifth SETTINGS_DEFAULTS field, default true, independent of sound, rejects invalid values, tolerant-loads true on a blob with no dressing key"
    requirement: "DRESS-05"
    verification:
      - kind: unit
        ref: "test/unit/settings.test.js#dressing: independent of sound / an invalid value is rejected / a persisted blob WITHOUT the dressing key / with an invalid dressing value"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-05: settings.js has no trace of handedness and exposes exactly 5 fields, in order"
        status: pass
    human_judgment: false
  - id: D10
    description: "DRESS-04 ledger: placement is JSON-identical across repeat calls / a structuredClone / a save-reload round trip; resolving a feature never moves a prop; placeDressing+drawDressingLayer never touch state.rngState or JSON.stringify(state); a 40-move scripted walk serializes byte-identically with and without dressing running; no engine/*.js file but maze.js assigns .wall"
    requirement: "DRESS-04"
    verification:
      - kind: unit
        ref: "test/unit/dressing-determinism.test.js (5 named tests)"
        status: pass
    human_judgment: false
  - id: D11
    description: "Device-level legibility check: wall/floor props read as ambiance, never as an encounter, at real device DPI/lighting"
    verification: []
    human_judgment: true
    rationale: "Visual legibility on a real Pixel screen cannot be proven by a unit test; deferred to the Phase 60 batched device-UAT checklist per this codebase's Deferred UAT protocol."

# Metrics
duration: 45min
completed: 2026-09-22
status: complete
---

# Phase 59 Plan 02: Dungeon Set Dressing (pure core) Summary

**The 54-prop `set_dungeon_*` category table, a deterministic shell-rng placement, draw-time feature/stairs/party exclusion, a dimmed/small paint layer, a lazy at-most-once loader, a fifth `dressing` setting, and a determinism ledger proving dressing never touches engine state or a run's outcome.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- `src/browser/dressing.js#DRESSING_PROPS`: all 54 shipped `set_dungeon_*` icons categorised (15 wall, 39 floor), with light depth-lean weighting and 4 rare props (blood x2, `coins_gems`, `pit`) — verified against the actual `icons/optimized/` directory listing.
- `placeDressing({ seed, depth, grid })`: pure, total, deterministic 8-12 prop scatter drawn ONLY from `derivedRng(seed, "dressing", depth)` (engine/rng.js), reading only walls/water/the fixed (1,1) start — never `feat`, `seen`, or the party's live position. Proven byte-identical across repeat calls, a `structuredClone`d grid, and a full save/reload round trip.
- `visibleProps`/`drawDressingLayer`: the draw-time-only exclusion of any feature/stairs/party/unseen/out-of-window square, drawn through the existing `drawFeatureIcon` at 0.6 scale (below the feature layer's 0.75), 0.35 floor / 0.85 wall alpha, inside exactly one save/restore.
- `createDressingArt`/`createDressingBridge`: the lazy, at-most-once image loader (gated on BOTH `setEnabled(true)` AND `release()`) and the thin `window.__mzDressing`-shaped bridge factory 59-05 will wire, with memoised per-floor placement.
- `icons.js#loadIconSet`: factored out as the one image loader; `preloadIcons` now delegates to it, behaviour unchanged (16 pre-existing icons.test.js tests pass byte-for-byte, and the file's diff against BASE_59 is additions-only).
- `test/unit/harness/recordingCanvas.js#createRecordingContext`: a call-recording 2D canvas context (every method `draw()`/`drawFeatureIcon` use, plus `imageDraws()`), additive alongside `recordingDom.js`'s no-op sink.
- `settings.js`: `dressing` (default true) is the fifth `SETTINGS_DEFAULTS` field, fully independent of `sound`, tolerant-loading `true` on any blob missing or corrupting the key — re-pinned `settings.test.js` (10→14 tests) and `shell-gear-toolbar.test.js`'s UIF-05 key-list pin (unchanged count, updated content) to the five-field shape.
- `test/unit/dressing-determinism.test.js`: the DRESS-04 ledger — a 40-move scripted engine walk (via the real `newRun`/`applyAction`/`serializeRun`) proves `serializeRun` output is byte-identical whether or not `placeDressing`/`drawDressingLayer` ran on every intermediate state, and that neither `state.rngState` nor `JSON.stringify(state)` ever changes; a source scan proves no `engine/*.js` file but `maze.js` ever assigns `.wall`.

## Task Commits

Each task was committed atomically:

1. **Task 1: dressing.js — the 54-prop table, depth weights, deterministic placement** - `ddd518c` (feat)
2. **Task 2: draw-time exclusions, the dimmed prop layer, lazy-load, the bridge factory** - `ee671ed` (feat)
   - **Follow-up fix (Rule 1 — bug in the new test itself, found during the Task 2 teeth check)** - `6bc566e` (test)
3. **Task 3: the dressing setting and the DRESS-04 proof** - `3afde2c` (feat)

_No plan-metadata commit yet — this SUMMARY.md is committed as part of finishing this plan; STATE.md/ROADMAP.md are NOT touched here (orchestrator-owned after the wave completes, per this plan's isolation instructions)._

## Files Created/Modified

- `src/browser/dressing.js` - the entire pure dressing core: table, weighting, placement, visibility filter, draw layer, lazy-load controller, bridge factory
- `src/browser/icons.js` - added `loadIconSet`; `preloadIcons` now delegates to it (behaviour unchanged)
- `src/browser/settings.js` - `dressing` is the fifth persisted field, default true, independent of `sound`
- `test/unit/harness/recordingCanvas.js` - new: `createRecordingContext()`, the call-recording 2D context harness
- `test/unit/dressing.test.js` - new: Task 1 + Task 2 pins (24 named tests)
- `test/unit/dressing-determinism.test.js` - new: the DRESS-04 ledger (5 named tests)
- `test/unit/icons.test.js` - extended (additions-only diff) with `loadIconSet`/`preloadIcons` pins (3 named tests)
- `test/unit/settings.test.js` - re-pinned to five fields + 4 new `dressing` behaviour tests (10→14 tests)
- `test/unit/shell-gear-toolbar.test.js` - re-pinned UIF-05's key-list literal to the five fields (test count unchanged, 15)

## Decisions Made

- **DRESS-04's save/reload call shape**: the plan's literal text (`rehydrate(validateSave(JSON.parse(serializeRun(state))))`) doesn't type-check — `serializeRun` returns a plain object, and `JSON.parse` expects a string. Grepped the codebase for the actual landed pattern (`test/unit/loot-pile.test.js` and ~15 other call sites) and used `rehydrate(validateSave(JSON.stringify(serializeRun(state))).value)` instead — the real save/reload round trip every other test in this codebase uses.
- **WALL_PROP_ALPHA = 0.85, not "full strength"**: DRESS-05's own prose says wall props draw at full strength, but 59-CONTEXT.md's decision record (D-12) locks ~85%. Followed the locked decision, documented the tension in the export's own JSDoc so a future reader isn't confused by the discrepancy.
- **Rare-prop discretion (D-07's own clause)**: `coins_gems` and `pit` made rare (0.25x) alongside the two blood props, per the plan's discovery table — the two props most likely to be misread as a real chest or crevice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A Task 2 test fixture masked its own teeth check**
- **Found during:** Task 2's mandatory teeth check (temporarily removing `drawLayer`'s `!art.enabled()` guard)
- **Issue:** The "disabled art" sub-case in the `createDressingBridge` drawLayer test used an `art` fixture with `images: () => null` — so even with the `enabled()` guard removed, the separate (correct) "images not loaded yet" guard still returned 0 before touching the canvas, silently passing a broken teeth check.
- **Fix:** Gave that fixture a fully-loaded `images()` map so only the `enabled()` check protects it; re-ran the teeth check and confirmed it now genuinely fails without the guard, then reverted `src/browser/dressing.js` via `git checkout --`.
- **Files modified:** test/unit/dressing.test.js
- **Verification:** Teeth check now correctly fails-then-passes across a real guard removal/restore cycle; full suite still green.
- **Committed in:** `6bc566e`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test-only fix, tightening the plan's own required teeth-check discipline. No scope creep, no behavior change to shipped code.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/browser/dressing.js` exports exactly the contract 59-05 needs to wire: `createDressingArt({ load, onReady })`, `window.__mzDressing = createDressingBridge({ art, drawIcon: drawFeatureIcon })`, and one `drawLayer(ctx, S, CELL, visible)` call site in `draw()`.
- `DRESSING_ICON_NAMES`/`loadIconSet` are ready for 59-05's `load: () => loadIconSet("./icons/optimized", DRESSING_ICON_NAMES)`.
- The `dressing` setting is ready for 59-05's Settings sheet row and its `setEnabled`/`release` wiring off the shell's boot sequence.
- **Device-level legibility check deferred** (see coverage D11): whether wall/floor props genuinely read as ambiance rather than encounters at real device DPI/lighting is a Phase 60 batched device-UAT item, not verifiable by a unit test.
- Engine gate intact: `engine/`, `content/`, `test/parity/`, `package.json`, `package-lock.json` are byte-identical to `BASE_59` (`f220718`); the prototype master hash is unchanged (`a1f4d0d...`).
- `npm test`: 3799/3815 passing (16 known CRLF-checkout artifacts in `test/parity/divergence-records.test.js`, `test/unit/class-pass-ledger.test.js`, `test/unit/flee-ledger.test.js`, `test/unit/shell-tab-snapshots.test.js` — confirmed identical to the pre-existing baseline, not introduced by this plan).

---
*Phase: 59-party-animation-dungeon-set-dressing*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 9 created/modified plan files and this SUMMARY.md verified present on disk; all 4 task/follow-up commit hashes (`ddd518c`, `ee671ed`, `6bc566e`, `3afde2c`) verified present in `git log --oneline --all`.
