---
quick_id: 260918-vm3
slug: map-camera-follows-player-only-on-drag-o
phase: quick-260918-vm3
plan: 01
subsystem: ui
status: complete
tags: [vanilla-js, map-camera, viewport, canvas, ui-only, source-assertion-tests]

requires:
  - phase: 35-map-screen-rebuild
    provides: the pointer pipeline (tap/hold/drag/pinch) and centerMap bridge this plan retargets
provides:
  - "A stationary map camera: `cam` (grid-point, cell units) replaces the player-relative CSS-px `pan` — the party sprite/ring moves, the map itself only shifts on a drag, a keep-in-view nudge near an edge, or an explicit centring trigger"
  - "src/browser/controls.js#keepInViewAxis(camAxis, partyAxis, spanCells) — the pure one-axis stationary-camera rule, with EDGE_TRIGGER_CELLS=2"
  - "mazeworld.html#keepPartyInView()/window.mzKeepPartyInView — the non-centring nudge wired to every former auto-recentre site except CENTRE/stairs/teleport/new-run/boot"
affects: [map-screen]

tech-stack:
  added: []
  patterns:
    - "Camera-as-grid-point: cam {x,y} is a maze-grid coordinate (cell units, fractional) pinned under the viewport centre, not a CSS-px offset from the party — partyCentre()/cameraPan()/anchorCamOnParty() are the three read/derive/set helpers every camera consumer (positionCanvas, positionPartyPulse, tapStep, inspectAt, drag, pinch, centerMap) goes through"
    - "keep-in-view vs centre split: stepWith()'s engine-event split (floorChanged|teleported -> centre, moved -> keep-in-view) is the single shell hook, since engine/movement.js#move is the sole producer of all three event types"
    - "Call-time bridge read (2026-09-16 UAT lesson, reapplied): keepPartyInView() reads window.__mzControls fresh inside its own function body on every call, never captured once at parse time"

key-files:
  created: []
  modified:
    - mazeworld.html
    - src/browser/controls.js
    - test/unit/controls.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/shell-combat-over.test.js

key-decisions:
  - "keepInViewAxis's post-nudge trigger uses a strict '<' comparison exactly as specified in the plan's own literal implementation code; the plan's illustrative Test 6 prose ('1.5 from the new edge... nudges again to 1.5') was arithmetically off by 0.5 against that same literal formula — verified by direct computation, not hand-derivation. Implemented the formula exactly as written and adjusted the RED-phase test's boundary values (nudge confirmed to first trigger at partyAxis=-1, not -0.5) so the test asserts the code's real, correct behaviour rather than the prose's arithmetic slip."
  - "The plan's own Task 3 test spec for keepPartyInView's bridge-read pattern (doesNotMatch(CODE, /^\\s*(?:const|let|var) \\w+ = window\\.__mzControls;/m) checked globally) would contradict Task 1's own literal action code (`const C = window.__mzControls;` inside keepPartyInView's body) — a plain function body statement is inherently call-time, never parse-time, so the anti-pattern the regex targets (a top-level/IIFE-closure capture) cannot occur inside a plain function declaration. Wrote the (m) test to assert the bridge read exists exactly once inside keepPartyInView's own region instead of a self-contradicting global doesNotMatch."

requirements-completed: [MAP-02, MAP-07]

coverage:
  - id: D1
    description: "keepInViewAxis pure function (identity, low-edge nudge, high-edge nudge, off-screen recovery, tiny-span centre, post-nudge stability) plus EDGE_TRIGGER_CELLS export"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/controls.test.js — 9 new keepInViewAxis tests"
        status: pass
  - id: D2
    description: "cam grid-point camera anchor replaces the px pan; partyCentre/cameraPan/anchorCamOnParty helpers; positionCanvas/positionPartyPulse/centerMap/tapStep/inspectAt/drag/pinch all run on cam"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js (d)/(e)/(f)/(m); test/unit/shell-map-store-polish.test.js #5/#6"
        status: pass
  - id: D3
    description: "Every former auto-recentre site (tab return, overlay dismiss, pinch-end, Settings close, textSize change, resize, a genuine step) retargeted to keep-in-view; only CENTRE/floorChanged/teleported/new-run/boot still centre"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js (f) camera call sites (mzCenterMap=5, mzKeepPartyInView=7); test/unit/shell-map-store-polish.test.js sites 1-3+pinch; test/unit/shell-combat-over.test.js CSCR-08"
        status: pass
    human_judgment: true
    rationale: "The felt experience of a stationary map (does it actually feel like the tabletop piece-moves-not-the-board request) can only be judged on a real device/browser — see Human verification below"
  - id: D4
    description: "Drag-to-pan, tap-to-step, hold-to-inspect and pinch-to-zoom (origin on the party, no longer snapping to centre on release) all keep working through the single shared cameraPan()/screenToCell transform"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js (d)/(e)/(m) drag/pinch pins"
        status: pass
    human_judgment: true
    rationale: "Gesture feel (drag responsiveness, pinch zoom-about-party, tap/hold accuracy) needs a real touch device"

metrics:
  duration: "~65min"
  tasks_completed: 3
  files_changed: 6
  completed_date: 2026-09-18
---

# Quick Task 260918-vm3: Map camera follows player, only on drag Summary

Replaced the map's player-relative CSS-px `pan` camera with a grid-point camera (`cam`, cell units) so the map itself only moves on a drag, an edge-approach keep-in-view nudge, or an explicit centring trigger (CENTRE chip, stairs, teleport, new run, boot) — a plain step now moves only the party ring, matching the requested tabletop "piece moves, board holds still" feel.

## What Was Built

1. **Task 1: Anchor the camera to a grid point instead of the party (behaviour-preserving)** — `23c08cf` (feat)
2. **Task 2: Retarget every auto-recentre to keep-in-view except stairs/teleport/new run/CENTRE** — `72a4b5f` (feat)
3. **Task 3: Pin the stationary-camera contract, run the full suite** — `21d5dfd` (test)

## Files Created/Modified

- `mazeworld.html` — `let cam = { x: 0, y: 0 }` (grid-point, cell units) replaces the retired `let pan = { x: 0, y: 0 }` (CSS-px); `partyCentre()`/`cameraPan()`/`anchorCamOnParty(offsetPx)` helpers; `positionCanvas()`/`positionPartyPulse(rect)` read `cam`/`cameraPan()`; `centerMap()` now calls `anchorCamOnParty({x:0,y:0})`; new `keepPartyInView()` + `window.mzKeepPartyInView` bridge (guards on a 0x0 rect, drives both axes through `window.__mzControls.keepInViewAxis`, always ends with `positionCanvas()`); `tapStep()`/`inspectAt()` feed `cameraPan()` into `screenToCell`; drag derives `cam` from `camStart`/`CELL`; pinch captures `pan: cameraPan()` at start and calls `anchorCamOnParty(pinch.pan)` on zoom (origin stays on the party, never snaps to centre on release); `stepWith()` splits `floorChanged`/`teleported` (centre) from `moved` (keep-in-view); `showTab`'s maze branch, `renderEncounter`'s dismissal block, pinch-end `release`, `closeSettingsSheet`, the `textSize` setting branch, and the `resize` listener all retargeted from `window.mzCenterMap` to `window.mzKeepPartyInView`; the module bridge/import both carry `keepInViewAxis`
- `src/browser/controls.js` — `EDGE_TRIGGER_CELLS = 2` (exported) and `keepInViewAxis(camAxis, partyAxis, spanCells)` (pure, DOM-free)
- `test/unit/controls.test.js` — 9 new `keepInViewAxis` behaviour tests (identity, low/high edge, off-screen recovery, tiny-span centre, post-nudge stability) + `EDGE_TRIGGER_CELLS` export check
- `test/unit/shell-map-viewport.test.js` — (d)/(e) re-pinned to `cameraPan()`; (f) zoom-line re-pinned to `anchorCamOnParty(pinch.pan)`, `wasPinch` line re-pinned to `mzKeepPartyInView`, call-site-count test split into `mzCenterMap=5`/`mzKeepPartyInView=7`; new (m) section (9 tests) pinning `cam`, the four camera helpers, `positionCanvas`'s transform, `keepPartyInView`'s full contract, `stepWith`'s branch order, the module bridge, and the drag formula
- `test/unit/shell-map-store-polish.test.js` — sites 1/2/3 + pinch re-pinned to `mzKeepPartyInView`; #6 `centerMap` body re-pinned to `anchorCamOnParty`; the total call-site-count test split into 5/7
- `test/unit/shell-combat-over.test.js` — CSCR-08 dismissal-block pin retargeted to `mzKeepPartyInView`

## Decisions Made

- Implemented `keepInViewAxis` exactly per the plan's literal `<action>` code (strict `<` boundary comparison). The plan's own `<behavior>` prose for the post-nudge-stability test had an internal arithmetic inconsistency (claimed a nudge at `partyAxis=-0.5`, which the literal formula computes as exactly at the trigger boundary — not inside it). Verified by direct node computation rather than hand-deriving, per this project's own "measured, not hand-computed" convention; wrote the RED test to the mathematically correct boundary (trigger first fires at `-1`, not `-0.5`).
- The plan's Task 3 test spec for "no parse-time capture of the controls bridge inside keepPartyInView" specified a global `doesNotMatch` regex that would also reject the exact `const C = window.__mzControls;` line the plan's own Task 1 action text mandates inside that function. Since a statement inside a plain (non-IIFE) function body is inherently call-time, not parse-time, wrote the (m) test to assert the bridge read lives once inside `keepPartyInView`'s own region instead of a self-contradicting global negative-match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's `<behavior>` spec for keepInViewAxis Test 6 (post-nudge stability) had an arithmetic inconsistency against its own `<action>` literal formula**
- **Found during:** Task 1 (RED-phase test authoring)
- **Issue:** The plan states that after the Test 2 nudge (cam=3.5, low edge=-2.5), a party at `-0.5` is "1.5 from the new edge, inside the trigger" and should nudge the camera to `1.5`. Direct computation of the plan's own literal formula (`partyAxis - (camAxis - half) < EDGE_TRIGGER_CELLS`) gives a distance of exactly `2.0` at `partyAxis=-0.5`, which is not `< 2` — no nudge. The prose is off by 0.5 relative to the code it describes.
- **Fix:** Implemented `keepInViewAxis` exactly per the `<action>` code (authoritative, and it is the actual shipped formula). Wrote the RED test's boundary case to the verified, correct trigger point (no nudge at `-0.5`, exactly at boundary; nudge to `1` first occurs at `-1`), confirmed by running the real formula, not by re-deriving by hand.
- **Files modified:** test/unit/controls.test.js
- **Verification:** `node --test test/unit/controls.test.js` — 21/21 pass
- **Committed in:** 23c08cf (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, in the plan's own illustrative test prose — not a shipped-code defect)
**Impact on plan:** Test-only; the shipped `keepInViewAxis` implementation is a byte-for-byte match of the plan's `<action>` code. No behavior change beyond what the plan specified.

## Issues Encountered

None beyond the deviation above.

## Gate Results

- `npm test`: **3183/3183 pass, fail 0** (baseline 3168 + 6 controls tests from the plan's own count + 9 additional keepInViewAxis/`(m)` tests written during execution; plan required `# fail 0`, `# pass` >= 3174 — met)
- `npm run build:www`: **exit 0**
- `git diff --stat a95c2f0 -- engine content test/parity`: **empty** (no engine/content/parity changes)
- `grep -n "S.cam\|state.cam\|writeSetting([^)]*cam" mazeworld.html src/browser/*.js`: **no matches** (camera is session-only, never persisted)
- Comment-stripped call-site counts: `window.mzCenterMap?.()` = **5** (boot, 3 new-run paths, stepWith's floorChanged/teleported branch); `window.mzKeepPartyInView?.()` = **7** (tab return, overlay dismiss, pinch-end, Settings close, textSize change, resize, a genuine step)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All source-provable contract items (camera state shape, helper functions, call-site retargeting, transform sharing) are pinned by tests.
- The engine/content/parity tree is untouched.
- Per the user's standing rule, the orchestrator should now ASK whether to push a versionCode-bumped Play internal-testing build — no build was produced inside this task.
- The browser sanity checklist below (deferred, autonomous run — no device pause taken) should be folded into the next batched Pixel 7 / browser verification pass.

## Human verification

Browser sanity (Chrome, device toolbar in portrait; serve the repo root with `npx serve .` and open `http://localhost:3000/mazeworld.html` — module scripts do not load from `file://`). Start a new run, then:

1. Walk 6+ squares with the arrow keys or taps while the party is in the middle of the view — the map does not move; only the gold party ring moves.
2. Keep walking toward one edge — when the party is about 2 tiles from the edge, the map scrolls ONCE so the party sits about a third of the way in from that edge (not centred), then holds still again.
3. Drag the map until the party is off-screen, take one step — the map scrolls the party back to the margin, not to the centre. Drag still pans; a tap still steps toward the tapped square; a ~0.5 s hold still shows the inspect card.
4. Tap CENTRE — the party is centred.
5. Pinch (touch emulation) — zoom happens about the party; releasing the pinch does not snap the map to centre.
6. Take the stairs (GO DOWN) or land on a teleport square — the new position is centred.
7. Open the Hero tab and return; open and close Settings; change Text size; dismiss an encounter overlay — the map stays where it was (unless the party was already inside the edge margin).
8. Start a new run — centred.

---
*Quick task: 260918-vm3-map-camera-follows-player-only-on-drag-o*
*Completed: 2026-09-18*

## Self-Check: PASSED

- Commits found in git log: 23c08cf, 72a4b5f, 21d5dfd
- Files found on disk: mazeworld.html, src/browser/controls.js, test/unit/controls.test.js, test/unit/shell-map-viewport.test.js, test/unit/shell-map-store-polish.test.js, test/unit/shell-combat-over.test.js, this SUMMARY.md
