---
phase: quick-260917-bbs
plan: 01
subsystem: ui
tags: [vanilla-js, uat-fix, perf, compositing, party-roster, hero-tab, png-icons, rail, major-overlay, source-assertion-tests]

requires:
  - phase: 35-map-screen-rebuild
    provides: the RAIL/HUD/party-strip/loot-screen/encounter-overlay surfaces this plan re-pins
provides:
  - Composited .mw-party-pulse ring (opacity/transform only) that pauses/hides under the encounter panel
  - Party roster moved from a map-column strip into a Hero-tab Company panel (#hero-party)
  - Idle rail card suppressed while the encounter panel covers the map (real cards, e.g. bagFull, still show)
  - Loot screen's inline bag-full paragraph removed; the drop shelf and header stay
  - Feature rail cards / hold-inspect card / encounter+stair MAJOR OVERLAYS render the actual PNG icon
affects: [map-screen, combat-screen, hero-tab, loot-screen, rail]

tech-stack:
  added: []
  patterns:
    - "iconKey plumbing: railCardFor/railLineCard/encounterOverlaySpec/renderMajorOverlay/renderRail all carry an optional iconKey resolved to icons/optimized/<key>.png via featureIconSrc(); glyph is the fallback when iconKey is null"
    - "renderEncounter's two panel.hidden toggle sites are now the single choke point for both the party-pulse covered/composited state and the rail's idle-suppression re-render"

key-files:
  created: []
  modified:
    - mazeworld.html
    - src/browser/rail.js
    - src/browser/combatPanel.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-party-camp.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-loot-screen.test.js
    - test/unit/shell-combat-over.test.js
    - test/unit/rail.test.js
    - test/unit/combatPanel.test.js
    - test/unit/shell-combat-screen.test.js
    - test/unit/shell-map-viewport.test.js

key-decisions:
  - "climbedOver/fellClimbing map to the wall.png icon (not crevice) because the climb feat is drawn as wall.png on the map itself; flownOver/phasedThrough (no feat) keep crevice per the ruling's literal text"
  - "renderRail's idle-suppression reuses hasActiveEncounter() (the exact predicate that drives panel.hidden) rather than reading the DOM, so it never lags a render behind"
  - "renderEncounter's two panel.hidden sites became the single wiring point for three UAT items (pulse composite/cover, idle-rail suppression) rather than three separate call sites"

requirements-completed: [MAP-07, PARTY-07, MAP-03, MAP-05, CSCR-06]

coverage:
  - id: D1
    description: "Composited party pulse (static ring shadow, opacity/transform keyframes only) so Chromium composites instead of re-rasterising the map every frame"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(h) PERF 2026-09-17: the party pulse animates only composited properties"
        status: pass
    human_judgment: true
    rationale: "The on-device perf regression (logcat tile-memory spam) and the visual pulse behavior can only be confirmed on the Pixel 7"
  - id: D2
    description: "Party pulse pauses/hides while the encounter panel covers the map (fixes FIGHT IT OUT's missing button colour until a focus change)"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(h) PERF addendum 2026-09-17: the party pulse is paused/hidden while the encounter panel covers the map"
        status: pass
    human_judgment: true
    rationale: "The WebView tile-memory-starvation symptom this fixes only reproduces on-device"
  - id: D3
    description: "Idle rail card hidden while the encounter panel covers the map; a real card (e.g. bagFull) still shows; renderEncounter re-renders the rail on both panel show/hide sites"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(p) 2026-09-17 UAT ruling: renderRail hides the idle card while the encounter panel is up"
        status: pass
    human_judgment: true
    rationale: "Requires visually confirming the rail's real estate frees up under THEY ARE DOWN on-device"
  - id: D4
    description: "Party roster removed from the map column (and the combat screen); Company panel added to the Hero tab, rendered by renderPartyRoster() on the paint() path"
    requirement: PARTY-07
    verification:
      - kind: unit
        ref: "test/unit/shell-party-camp.test.js#2026-09-17 UAT ruling: the party roster is a Hero-tab Company panel"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-invariants.test.js#retirements (2026-09-17 UAT): RAW carries zero of the retired party-strip literals"
        status: pass
    human_judgment: true
    rationale: "Confirming no joiner surface renders above the combat panel or map, and the Company panel behaves correctly with a live joiner, needs on-device play"
  - id: D5
    description: "Loot screen's inline red bag-full paragraph removed; the drop shelf and lootHead·bag header stay"
    verification:
      - kind: unit
        ref: "test/unit/shell-loot-screen.test.js#Phase 29 (LOOT-02/03/04/06)/2026-09-17 UAT: no inline bag-full line, the shelf remains"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-over.test.js#CSCR-07: the loot branch renders won/soothed through renderCombatOver with every Phase 29 literal intact"
        status: pass
    human_judgment: true
    rationale: "Visual confirmation that only the rail card reports the full bag, and the shelf still lets the player drop, needs on-device play"
  - id: D6
    description: "Feature rail cards, the hold-inspect card, and the encounter/stair MAJOR OVERLAYS render the actual PNG icon (RAIL_FEATURE_ICON + featureIconSrc plumbing); glyphs survive for decision cards/death/idle"
    requirement: CSCR-06
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#RAIL_FEATURE_ICON: frozen, every key is a RAIL_FAMILY key, every value is a FEATURE_ICONS key"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(q) 2026-09-17 UAT ruling (actual icons): renderRail renders an <img> from featureIconSrc(iconKey)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-06 (Decision 2): renderMajorOverlay exists before renderEncounter and builds the icon/title/line/roll/actions column"
        status: pass
    human_judgment: true
    rationale: "Confirming the PNG renders correctly (not tofu/broken) for each event family requires on-device play across several tile types"

patterns-established:
  - "iconKey is threaded as an optional trailing/adjacent field alongside every existing glyph field (icon), never replacing it — the glyph stays the universal fallback"

duration: 45min
completed: 2026-09-17
status: complete
---

# Quick Task 260917-bbs: v1.4 UAT Fixes Round 2 Summary

**Composited/paused party pulse, party roster moved to a Hero-tab Company panel, no inline bag-full line on the loot screen, and PNG icons on feature rail cards / hold-inspect / encounter+stair overlays.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 4 (Task 1 included a coordinator-issued mid-task addendum)
- **Files modified:** mazeworld.html, src/browser/rail.js, src/browser/combatPanel.js, 10 test files

## User Rulings (recorded verbatim)

1. **PERF (item 1) — Task 1 addendum, user 2026-09-17 UAT:** "FIGHT IT OUT button doesn't have a button colour unless the window loses focus and I come back."
2. **Item 2, user 2026-09-17:** "Joiner should only show when fighting, and probably on the hero screen."
   Addendum (user, 2026-09-17): "Joiner section on top of the combat window should go, too. We already have our joiner in the Your Lot section."
3. **Item 3, user 2026-09-17:** "When I try to loot something and my bag is full, the message shows up right under the item that I tried to stow, and it shows up in the card at the bottom. We don't need that message to show up right under the gear piece. The card is sufficient."
4. **Item 4, user 2026-09-17:** "On the screens that show up to describe what happens when you land on an icon, we should use the actual icon."
5. **Mid-task addendum, user 2026-09-17 (added to Task 1's scope):** "Don't show the nothing is happening screen until the They are down screen goes away. We need that real estate for judging inventory."

## Accomplishments

- **Composited party pulse (MAP-07).** `.mw-party-pulse`'s ring/halo is now a static `box-shadow`; `@keyframes mwglow` animates only `opacity`/`transform` (`will-change:transform,opacity`), so Chromium composites the pulse on its own layer instead of re-rasterising the whole map layer every frame (the logcat `tile memory limits exceeded` spam this fixes).
- **Pulse pauses/hides under the encounter panel.** `renderEncounter`'s two `panel.hidden` toggle sites now also toggle a `.covered` class on `#mw-party-pulse` (`animation-play-state:paused;visibility:hidden`), fixing the WebView tile-memory-starvation symptom where `FIGHT IT OUT`/`GO DOWN`/`NOT YET` didn't paint their gold background until a focus change.
- **Idle rail suppressed under the encounter panel (mid-task addendum).** `renderRail()` now computes `panelUp = hasActiveEncounter()` and folds `(panelUp && idle)` into `railEl.hidden`, so the "NOTHING IS HAPPENING" card disappears the instant THEY ARE DOWN (or any other overlay) appears, freeing the real estate for the loot list. A real rail card (e.g. the `bagFull` refusal) still shows under the panel. Both `renderEncounter` panel-toggle sites now also call `window.renderRail?.()` (guarded on `window.__mzState`, mirroring `showTab`'s boot-safety pattern) so the rail updates the moment the panel shows or hides.
- **Party roster relocated (PARTY-07).** The Phase 10 party-rail strip (a sibling of `<main>`, so it also rendered above the combat screen) is fully removed. A new Company panel (`#hero-party` / `#hero-party-list`) sits on the Hero tab between the Character sheet and Special skills, rendered by the renamed `renderPartyRoster()` on the `paint()` path (never tab init — TDZ-safe per commit 7ab68d3's rule). The only in-combat joiner surface remains YOUR LOT.
- **Loot screen bag-full line removed (item 3).** The loot branch's `fillMid` no longer prints the inline red "Bag full (...)" paragraph; the rail's `bagFull` refusal card (`src/browser/toasts.js`, untouched) already carries the message. The `lootHead · bag n/m` header and the drop shelf (`usage.full && needsSlot`) are unchanged.
- **PNG icons on feature surfaces (CSCR-06).** `RAIL_FEATURE_ICON` (frozen, 21 `RAIL_FAMILY` keys mapped onto `FEATURE_ICONS` PNG keys) drives `railCardFor`/`railLineCard`'s new `iconKey` field; `featureIconSrc(key)` resolves it to `icons/optimized/<key>.png`. `renderRail()` and `renderMajorOverlay()` render an `<img>` via `createElement` when a card/spec carries an `iconKey`, falling back to the existing glyph otherwise. `inspectAt()` forwards the seen feature's `mark.key` to `mzRailLine`; the stair spec carries `iconKey: "descent"`; `encounterOverlaySpec` carries `iconKey: "encounter"`. Decision cards (joiner/find), the death overlay, and the idle card carry no `iconKey` and keep their glyphs.
- **Climb -> wall refinement (deliberate, documented in-source and in tests).** The ruling's literal "climb family -> crevice" is refined: `climbedOver`/`fellClimbing` fire only on the `climb` feat, which the map itself draws as `wall.png` (`icons.js`: `climb -> "wall"`); mapping them to `wall` matches "the actual icon" more literally than the crevice glyph would. `flownOver`/`phasedThrough` carry no feat (Flight/Ethereal fly over either obstacle) and keep `crevice` per the ruling's literal text.

## Task Commits

Each task was committed atomically (code + tests only; docs commit is the orchestrator's job):

1. **Task 1: PERF — composite the party pulse (+ addendum: pause/hide under the panel; + mid-task addendum: idle rail waits for the panel to clear)** - `5138b4d` (perf)
2. **Task 2: USER RULING — party roster moved to the Hero tab's Company panel** - `6fbffe4` (feat)
3. **Task 3: USER RULING — loot screen drops the inline bag-full paragraph** - `2fe8018` (fix)
4. **Task 4: USER RULING — PNG icons on rail/hold-inspect/encounter+stair overlays** - `f3cc7e2` (feat)

## Files Created/Modified

- `mazeworld.html` - composited pulse CSS/keyframes + `.covered` state; `renderEncounter`'s two panel-toggle sites wired to the pulse and the rail; `renderRail`'s `panelUp && idle` hide clause; the Phase 10 party-rail strip removed; `#hero-party`/`#hero-party-list` Company panel added to the Hero tab; `renderPartyRail` renamed to `renderPartyRoster` and retargeted; loot branch's inline bag-full paragraph removed; `featureIconSrc()` helper + `FEATURE_ICON_PATH`; `renderRail`/`renderMajorOverlay` render `<img>` via `iconKey`; `inspectAt`/`mzRailLine`/stair spec carry `iconKey`
- `src/browser/rail.js` - `RAIL_FEATURE_ICON` (frozen); `railCardFor`/`railLineCard` emit `iconKey`
- `src/browser/combatPanel.js` - `encounterOverlaySpec` carries `iconKey: "encounter"`
- `test/unit/shell-map-hud.test.js` - re-pinned (b) (party strip retired); 2 new PERF tests (composited keyframes; pulse pause/hide under the panel)
- `test/unit/shell-party-camp.test.js` - new test: the roster lives in `#hero-party` on the Hero tab
- `test/unit/shell-map-invariants.test.js` - new retirement sweep for the party-strip literals
- `test/unit/shell-map-rail.test.js` - new (p) test (idle-rail suppression + renderEncounter->renderRail wiring); new (q) test (renderRail `<img>` branch); (o) re-pinned for the new `railEl.hidden` expression
- `test/unit/shell-loot-screen.test.js` - re-pinned: no inline bag-full line, shelf remains
- `test/unit/shell-combat-over.test.js` - re-pinned CSCR-07 loot-branch literals: bag-full paragraph removed from the required list, asserted absent
- `test/unit/rail.test.js` - new `RAIL_FEATURE_ICON` invariants test; `iconKey` pins on `railCardFor`/`railLineCard` cases
- `test/unit/combatPanel.test.js` - `iconKey: "encounter"` pinned on both `encounterOverlaySpec` tests
- `test/unit/shell-combat-screen.test.js` - CSCR-06 test extended with the `iconKey` branch assertions
- `test/unit/shell-map-viewport.test.js` - (e) `mzRailLine` call re-pinned with the trailing `mark.key` arg; (g) stair spec `iconKey` pin added; second (g) test title reworded

## Decisions Made

- `climbedOver`/`fellClimbing` map to `wall.png` (not `crevice.png`) — the map itself draws the `climb` feat as `wall.png`, so this is a deliberate, more-literal reading of "the actual icon" than the ruling's own crevice suggestion. `flownOver`/`phasedThrough` (no feat) keep `crevice` per the ruling's literal text.
- `renderRail`'s idle-suppression reads `hasActiveEncounter()` directly (the same predicate driving `panel.hidden`) rather than the DOM's `panel.hidden` attribute, so it can never be one render-frame stale.
- The mid-task addendum's rail-suppression wiring was folded into `renderEncounter`'s existing two `panel.hidden` toggle sites (same sites already touched for the pulse addendum) rather than adding new call sites elsewhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] shell-party-camp.test.js's new paint()-region slicer used a block-comment marker that stripComments() erases**
- **Found during:** Task 2 (writing the new Company-panel test)
- **Issue:** The plan's suggested `sliceBetween(CODE, "function paint() {", "\n/* ---------------- movement")` fails because `CODE` has block comments stripped to whitespace-only — the literal `/* ---------------- movement` text no longer exists in `CODE`, so the slice threw "end marker not found".
- **Fix:** Used the next real function signature (`\nfunction move(dir)`) as the end marker instead — same region, content-based boundary that survives comment-stripping.
- **Files modified:** test/unit/shell-party-camp.test.js
- **Verification:** `node --test test/unit/shell-party-camp.test.js` — 5/5 pass
- **Committed in:** 6fbffe4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test-only fix, no behavior change. No scope creep.

## Issues Encountered

- A mid-task message from the coordinator added a fifth UAT item (idle rail suppressed while the encounter panel is up) after Task 1's original scope was already partially executed. Folded it into Task 1 since it touches the same `renderEncounter`/`renderRail` call sites already being edited for the pulse addendum; committed together with Task 1.

## Gate Results

- `npm test`: **2179/2179 pass, fail 0** (plan required `# fail 0`, `# pass` >= 2172)
- `npm run build:www`: **exit 0** — `www/icons/optimized/{trap,descent,encounter}.png` all present
- `git diff --stat -- engine content test/parity`: **empty**
- `git hash-object test/parity/prototype-master.js.txt`: **a1f4d0dc29782218d8e5aab65bc5989c33f917f0** (unchanged)
- `npm run android:debug`: **exit 0** — `android/app/build/outputs/apk/debug/app-debug.apk`, **9,477,342 bytes**, mtime **2026-09-17 08:42:26 -04:00** (after the Task 4 commit). No `adb` command was run — the orchestrator installs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four UAT items (plus the Task 1 addendum and the mid-task idle-rail addendum) are source-provable and pinned by tests.
- The engine/content/parity tree is untouched; the parity hash is unchanged.
- `src/browser/icons.js`, `src/browser/mapMarks.js`, `src/browser/toasts.js`, and `icons/` are all untouched (read-only consumers only, per the ENGINE GATE/plan prohibitions).
- A fresh debug APK is on disk for the orchestrator's install.
- See Human verification below for the on-device re-checks this round needs.

## Human verification

Pixel 7 re-checks for this round (deferred UAT protocol — batch at the next milestone/verification pass):

1. **Composited pulse + reduced motion:** the party ring pulses on the map without the `tile memory limits exceeded` logcat spam; with Android's "Remove animations" accessibility setting on, the ring sits still.
2. **Pulse under the panel (Task 1 addendum):** FIGHT IT OUT (and GO DOWN / NOT YET) render with the gold background immediately, without a focus change.
3. **Idle rail suppressed under the panel (mid-task addendum):** on THEY ARE DOWN the bottom rail is gone (no NOTHING IS HAPPENING) so the loot list has the space; tapping Stow with a full bag brings the rail up with the bag-full card, which clears again; after TAKE ALL / LEAVE ALL the idle rail returns on the map.
4. **Joiner relocation:** no joiner strip on the map; the joiner's card appears under Company on the Hero tab (hidden when solo); during a fight nothing party-related sits above the combat panel, and the joiner appears only in YOUR LOT (unchanged).
5. **Loot with a full bag:** only the rail card says the bag is full; no red line under the loot list; the drop shelf still appears.
6. **PNG icons:** trap / teleport / one-way door / locked box / crevice-or-wall / floor rail cards, the hold-inspect card on a seen feature, and the encounter and stair overlays all show the PNG icons; the death overlay, joiner/find decision cards, and the idle card still show their glyphs.

---
*Quick task: 260917-bbs-v1-4-uat-fixes-round-2*
*Completed: 2026-09-17*
