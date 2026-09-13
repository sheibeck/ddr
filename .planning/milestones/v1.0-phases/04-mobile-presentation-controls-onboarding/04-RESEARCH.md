# Phase 4: Mobile Presentation, Controls & Onboarding - Research

**Researched:** 2026-09-08
**Domain:** Mobile touch UX (canvas input mapping, DPR/safe-area rendering), Capacitor/Android WebView platform quirks, offline font/asset self-hosting, vanilla-JS presentation architecture, engine-routing completion
**Confidence:** HIGH (grounded in direct source reads of `mazeworld.html`, `src/browser/*.js`, `engine/*.js`, `tools/build-www.mjs`, and the imported design file) with MEDIUM/LOW pockets flagged inline (Android WebView safe-area behavior, font-subsetting tooling, icon-pipeline specifics)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Visual theme & fidelity**
- Adopt the dark "torch-lit ledger" theme as the app's new visual identity (palette: grounds `#14110c`/`#080705`/`#1b170f`, frames `#3a3226`/`#6b5c3c`, ink `#e6ddc6`, gold accent `#e8c97a`, muted `#a89c82`/`#c9bda0`, danger `#e07260`/`#a63a2c`).
- Recolor the native status bar to the dark theme (was Style.Light + `#EFE7D6` parchment in 02-04) — dark grounds with light status-bar text. Splash asset stays as-is; first painted post-splash screen should be the dark theme.
- Self-host Press Start 2P + Courier Prime as local `fonts/*.woff2` (latin subset), following the existing self-hosted pattern (Special Elite/Crimson Pro/IBM Plex Mono from 02-04).
- High fidelity to the design's layout/palette/components; adapt only where real engine data or Android constraints require.
- Adopt the design's pannable maze viewport with fog-of-war, edge vignette, and MARKS/CENTRE overlay controls.

**Controls (UX-01, UX-02)**
- Ship BOTH control schemes: tap-to-move is DEFAULT, the design's on-screen D-pad is the selectable ALTERNATE.
- Tap model: tap an adjacent (orthogonally reachable) square to step one square. No tap-anywhere auto-path in v1.
- All interactive touch targets ≥48dp with spacing separating destructive actions (styled red) from safe ones.
- Persist the control-scheme choice (tap vs D-pad) in settings via `window.mzStorage`.

**Icons & canvas rendering (UX-03, UX-08)**
- Use the user's 9 PNG map icons (`icons/`: chest, crevice, descent, encounter, onewaydoor, party, teleport, trap, wall — 1254×1254) for feature marks + player marker, replacing both the prototype's procedural glyphs AND the design's Unicode glyphs. Downscale/optimize for mobile (target ~64–128px display size); keep source.
- Keep the DPR-aware `<canvas>` (do NOT switch to the design's DOM div-grid). Adopt the design's viewport FRAMING (pan/recenter/fog/vignette) around the canvas.
- Colorblind-safe status: icon + shape + text label, never color alone.
- Safe-area/notch aware: pad top HUD and bottom tab/controls with `env(safe-area-inset-*)`. Portrait lock already configured (Phase 2).

**Onboarding & settings (UX-04..UX-07)**
- Tutorial (UX-06): first-run contextual coach-marks on the real first floor, dismissible, shown once (persisted `mazeworld.tutorialSeen` via mzStorage). No wall of text.
- Settings (UX-07): sound, haptics, text size, control scheme, confirm-before-quit PLUS diceMode (on tap / always / never). Fog-of-war stays ON (not user-facing); raw cellSize slider folded into text-size.
- Character sheet (UX-04) + Oracle log (UX-05) + graveyard via the design's 5-tab bottom nav (MAZE / HERO / GEAR / ORACLE / DEAD).
- Text scaling (UX-08): rem-based S/M/L in-app setting driving all UI type, honoring OS font scale within bounds.

**Engine routing completion (deferred Phase 1/3 item)**
- Route combat, economy/store, new-run, and camp inputs through `applyAction`, replacing remaining original-prototype code paths, and complete `formatEvents()` coverage of the engine's event types.

**Game name (branding)**
- Keep "Mazeworld" as a single CENTRALIZED name constant/config for this phase. Final name/app-ID change deferred to Phase 6.

### Claude's Discretion
Exact module/file layout for the mobile presentation layer, the canvas viewport/pan implementation, coach-mark mechanism, settings persistence schema, icon downscaling pipeline, and how screens are structured as views/components — all grounded in the design file and existing `src/browser/` patterns.

### Deferred Ideas (OUT OF SCOPE)
- Voice/copy GENERATOR + family-friendly safety scan + graveyard DATA persistence wiring — Phase 5 (Phase 4 builds the graveyard/log presentation shell only).
- Final game name/branding lock + app-ID change — Phase 6.
- Google Play store listing assets/signing/submission — Phase 6.
- Difficulty feel-tuning (floor 30–50+) — Phase 3 deferred UAT.
- Haptics polish beyond the settings toggle (rich per-event haptics) — optional, not required for MVP.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Tap/contextual touch controls, D-pad as alternate | §1 Tap-to-Move Coordinate Math, §UI-SPEC Controls & Interaction cross-reference |
| UX-02 | ≥48dp touch targets, destructive-action isolation | §1 (tap hit-testing), UI-SPEC's 48dp Corrections table (already authoritative — this research doesn't re-derive it, just confirms the canvas-side tap target is the WHOLE adjacent cell, not a sub-44px sub-region) |
| UX-03 | DPR-crisp canvas, safe-area/notch respect, portrait lock | §2 DPR + Safe-Area |
| UX-04 | Character/stat sheet | §UI-SPEC Screen 2 (already fully specified); this research adds the engine-field binding map in §7 |
| UX-05 | Scrollable message/combat log | §UI-SPEC Screen 5 + §7 formatEvents coverage (the log's content quality depends directly on formatEvents completeness) |
| UX-06 | First-run in-context tutorial | §5 Coach-Mark Tutorial |
| UX-07 | Settings: sound, haptics, text size, control scheme, confirm-before-quit | §6 Settings + Accessibility |
| UX-08 | Colorblind-safe status, scalable text | §6 Settings + Accessibility, §3 fonts (rem-based scaling depends on self-hosted font pipeline) |
</phase_requirements>

## Summary

Phase 4 is a **presentation-and-wiring** phase, not a new-engine phase: every game rule it needs (movement, combat, economy, camp, magic, items) already exists behind `applyAction(state, action) → {state, events}` in `engine/*.js` — confirmed by reading `engine/engine.js`'s dispatch switch, which already has cases for `move`, `camp`, `attack`, `flee`, `parley`, `sing`, `castSpell`, `drinkPotion`, `readScroll`, `buyItem`, `leaveStore`, and `useItem`. The live page (`mazeworld.html`) only routes `move` and `newGame` through this seam today (wired in the trailing `<script type="module">`, lines ~3362–3496); combat (`startCombat`/`playerStrike`/`flee`/`drinkPotion` at lines ~2306+), the store (`openStore`/`buyFrom` at lines ~2054–2111), and camp (`makeCamp()` at line 1830) still run the ORIGINAL, non-engine prototype code paths that duplicate this logic. Finishing that routing is mechanical (same pattern as `window.move` at line 3415) but touches many call sites and — critically — `formatEvents()` in `src/browser/engineAdapter.js` currently handles only ~26 of the **~140 distinct event types** the engine's combat/magic/economy/encounters modules actually emit (grepped directly from `engine/combat.js`, `engine/magic.js`, `engine/economy.js`, `engine/encounters.js`, `engine/items.js`, `engine/movement.js`). This is the single largest hidden-scope item in the phase and should be flagged to the planner explicitly (see §7).

The mobile presentation itself is a ground-up rebuild of `mazeworld.html`'s DOM/CSS chrome around the EXISTING `<canvas id="maze">` element, which already has a working DPR transform (`ctx.setTransform(dpr,0,0,dpr,0,0)` at line 1333, inside `fit()`). The design mockup (`design/Mazeworld Mobile.dc.html`) is itself a full interactive prototype (React-like `DCLogic` component, ~820 lines) with its own throwaway maze/combat/state logic — CONTEXT.md is explicit that only its VISUALS and INTERACTION PATTERNS transfer, not its logic. Reading the mockup's `renderVals()` method directly yields exact, load-bearing values already promoted into `04-UI-SPEC.md` (pan transform math, D-pad grid geometry, tab-bar structure, bottom-sheet chrome) — this research does not re-derive those; it focuses on the parts UI-SPEC explicitly leaves open: tap-to-cell coordinate math, DPR+safe-area platform behavior, the font/icon build pipeline, and the engine-routing completion.

A genuinely non-obvious platform finding: **`env(safe-area-inset-*)` alone is unreliable on Android WebView** (versions below 140 have a documented bug returning 0 or wrong values), and Android 15+ (API 35+, which this app's target SDK already exceeds per STATE.md) **enforces edge-to-edge rendering** — the WebView will render behind the status/nav bars regardless of any `overlaysWebView`/`setBackgroundColor` configuration. Capacitor 8.0+ (this project is on 8.5.1, well past the threshold) bundles a "System Bars" API in `@capacitor/core` itself that injects `--safe-area-inset-{top,bottom,left,right}` CSS custom properties as a reliable fallback (default `insetsHandling: "css"`). The correct CSS pattern project-wide is `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`, not `env()` alone — see §2.

**Primary recommendation:** Build the mobile presentation as new DOM/CSS layered around the untouched `<canvas>` element (never migrate to the design's div-grid), wire tap-to-move via a single `pointerup` handler on the viewport that hit-tests against the SAME `cs`/pan/DPR math the renderer already uses, self-host Press Start 2P + Courier Prime exactly like Phase 2 self-hosted its three fonts (one-time fetch, commit `.woff2` into `fonts/`, zero code-pipeline change needed since `build-www.mjs`'s `copyFonts()` already copies the whole directory verbatim), pre-downscale the 9 PNG icons ONCE to a single ~128–160px committed source (mirroring 02-04's dependency-free PowerShell/System.Drawing icon-mipmap approach, since `@capacitor/assets` is confirmed broken in this environment) and add a small `copyIcons()` step to `build-www.mjs` (there is currently NO icon-copy step at all — `icons/` is not referenced anywhere in the build script), and treat the engine-routing + `formatEvents()` completion as its own tracked sub-scope sized at "~130 new terse narration lines," not a side effect of the UI work.

## Architectural Responsibility Map

This project has no network/server tier — "Backend" below means the pure `engine/*.js` logic core reached only through `applyAction`, not a networked API. "Native Shell" is the Capacitor plugin layer (status bar, haptics, preferences), analogous to a thin OS-integration tier sitting inside the Browser/Client process.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tap-to-move / D-pad input → `{type:"move",dir}` action | Browser/Client | — | Pure DOM/canvas event handling; must translate the SAME `cs`/pan/DPR values the renderer uses, so it lives beside the render code |
| Maze/icon/player canvas rendering | Browser/Client | — | `<canvas>` stays the renderer (locked decision); DPR correctness is a client-only concern |
| Viewport pan/fog/vignette framing (DOM layer around canvas) | Browser/Client | — | Presentation-only, camera-only (never moves the player) |
| Combat/economy/camp/new-run rule resolution | Backend (engine/*.js via applyAction) | Browser/Client (dispatch call site) | Engine already owns ALL these rules (confirmed: `attack`/`buyItem`/`camp`/etc. cases exist in `engine/engine.js`) — the phase's job is only to swap the CALL SITE, never re-implement logic client-side |
| Event → narration text (`formatEvents`) | Browser/Client (`src/browser/engineAdapter.js`) | — | Presentation glue, explicitly documented as temporary/replaceable by Phase 5's voice generator; still must cover the full event vocabulary this phase, in plain functional copy |
| Settings persistence (text size, control scheme, diceMode, haptics, sound, confirm-before-quit) | Browser/Client (`window.mzStorage`) | Native Shell (Preferences plugin, already wired) | No new storage plumbing needed — reuse the existing async abstraction exactly as settings/tutorial flags |
| First-run tutorial state (`tutorialSeen`) | Browser/Client | Native Shell (Preferences) | Same storage abstraction as settings; purely a persisted boolean flag |
| Status bar recolor, haptics feedback, safe-area inset delivery | Native Shell | Browser/Client (CSS consumption) | Native Shell plugins produce the raw values/side-effects (StatusBar.setStyle/setBackgroundColor, Haptics.impact, the System Bars CSS-var injection); the client only consumes them |
| Font/icon asset delivery | Build tooling (`tools/build-www.mjs`) | Browser/Client (consumption via `@font-face`/`drawImage`) | Assets are committed source, copied verbatim at build time — no runtime fetch, matching the offline constraint |
| Persistent graveyard/best-depth data | Backend (engine `bury()`/adapter `persistGrave`/`getBest`) | Native Shell (Preferences) | Already fully wired (Phase 1/2); Phase 4 only consumes it for the sheet/graveyard presentation, does not touch its storage |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none — vanilla JS/HTML/CSS) | n/a | Presentation layer | Project-wide zero-dependency, zero-bundler constraint (`.claude/CLAUDE.md`, `package.json` — no devDependencies beyond `@capacitor/cli`); confirmed unchanged in this phase per CONTEXT.md |
| `@capacitor/core` | 8.5.1 (installed) | Native bridge, including the bundled System Bars safe-area CSS-var injection this phase depends on | Already installed; System Bars API confirmed bundled in `@capacitor/core` since 8.0.0 [CITED: capacitorjs.com/docs/apis/system-bars] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/haptics` | ^8.0.2 [VERIFIED: npm registry — see Package Legitimacy Audit] | Native haptic feedback for the UX-07 haptics setting | NOT currently installed (`package.json` has no `@capacitor/haptics` entry — STACK.md listed it as optional in Phase 2 but it was never added). Must be added this phase to satisfy UX-07's haptics toggle; guard every call behind the same dynamic-import pattern `nativeChrome.js` already uses for other plugins so `node --test` never resolves the bare specifier |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled tap-to-cell math beside the render code | A generic hit-testing/gesture library | Rejected — zero-dependency constraint, and the math is genuinely simple (invert the same affine transform `renderVals()`/`draw()` already compute) |
| Manual coach-mark overlay (position:absolute DOM box + arrow) | A tour/onboarding library (intro.js, shepherd.js, driver.js) | Rejected — adds a real dependency for ~4 fixed, hand-authored steps; a hand-rolled step-array + one reusable overlay component is simpler and stays offline-safe with zero new files to vet |
| PowerShell/System.Drawing icon downscale (same tool as 02-04's launcher mipmaps) | `@capacitor/assets`, `sharp`, ImageMagick | `@capacitor/assets` already confirmed broken in this environment (missing `chevrotain` dep, per STATE.md); `sharp`/ImageMagick add a new native-binary devDependency this project has avoided everywhere else |
| `env(safe-area-inset-*)` alone | Manual `WindowInsetsCompat` native code, or a third-party edge-to-edge Capacitor plugin | Rejected — Capacitor 8's bundled System Bars CSS-var injection is the officially documented Android-appropriate fix and needs zero new dependency |

**Installation:**
```bash
npm install @capacitor/haptics
```

**Version verification:** `npm view @capacitor/haptics version` → `8.0.2`, peer dependency `@capacitor/core >=8.0.0` (satisfied by the installed 8.5.1). Verified live against the npm registry during this research session.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `@capacitor/haptics` | npm | published 2026-03-27 (this release; package itself is a long-standing official Ionic plugin, part of the same monorepo as the already-installed `@capacitor/app`/`@capacitor/status-bar`/etc.) | ~1.2M/week | `github.com/ionic-team/capacitor-haptics` | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`@capacitor/haptics` is published under the same `ionic-team` GitHub org and `@capacitor/*` npm scope as every plugin already installed and trusted in this project (confirmed via `npm view` + the legitimacy checker's registry/downloads/repo signals), so it is treated as `[VERIFIED: npm registry]` rather than `[ASSUMED]` despite being newly proposed — it is not a novel/unfamiliar package, it is the same publisher this codebase already depends on for `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/screen-orientation`, and `@capacitor/splash-screen`.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────── Browser/Client (WebView) ───────────────────────────────┐
│                                                                                          │
│  Touch input                                                                            │
│  (pointerdown/move/up on viewport DOM layer)                                            │
│        │                                                                                │
│        ├─► pan-drag? (movement > threshold before pointerup) ──► camera pan only        │
│        │                                                                                 │
│        └─► tap (no/small movement) ──► hit-test: screen px → cell (x,y)                 │
│                    │           (invert cs/DPR/pan transform, same values draw() uses)    │
│                    │                                                                     │
│                    ▼                                                                     │
│         adjacent + seen? ──no──► no-op (flash/shake)                                     │
│                    │yes                                                                  │
│                    ▼                                                                     │
│         dispatch({type:"move", dir})  ◄── ALSO: D-pad buttons, combat buttons,           │
│                    │                        store buttons, camp button, new-run button    │
│                    ▼                        (all route through the SAME seam this phase)  │
│  ┌─────────────────────────── engineAdapter.js (glue) ───────────────────────────┐        │
│  │  dispatch(action) → applyAction(engine state, action) → {state, events}       │        │
│  │       │                                                                        │        │
│  │       ├─► persist() [fire-and-enqueue, window.mzStorage]                       │        │
│  │       ├─► persistGrave() on "died" event                                       │        │
│  │       └─► formatEvents(events) → narration HTML lines (Oracle/combat log)      │        │
│  └───────────────────────────────────┬────────────────────────────────────────────┘        │
│                                       ▼                                                     │
│                    render: draw() [canvas, DPR-scaled] + paint() [DOM HUD/sheet/log/tabs]   │
│                                       │                                                     │
│                                       ▼                                                     │
│                    icons: PNG drawImage() at devicePixelRatio-correct backing-store size    │
│                                                                                              │
└──────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                            │
                    ┌───────────────────────┼────────────────────────┐
                    ▼                       ▼                        ▼
        window.mzStorage            Native Shell (Capacitor)     Backend (engine/*.js)
     (settings, tutorialSeen,     (StatusBar dark theme,        (pure rules: move/attack/
      textSize, controlScheme,     Haptics.impact, System        buyItem/camp/castSpell/...
      diceMode — Preferences        Bars safe-area CSS vars,      — no I/O, no randomness
      on native / localStorage      portrait lock, back button)   outside the injected RNG)
      in dev loop)
```

### Recommended Project Structure

Everything below is Claude's discretion per CONTEXT.md; this is a suggested (not mandated) layout that follows the existing `src/browser/` precedent:

```
src/browser/
├── engineAdapter.js       # EXISTING — extend formatEvents(), no structural change
├── storage.js             # EXISTING — reuse verbatim for settings/tutorial keys
├── nativeChrome.js        # EXISTING — extend: dark status bar, haptics wiring
├── controls.js            # NEW — tap-to-cell hit-testing, pan-vs-tap gesture disambiguation, D-pad wiring, controlScheme setting
├── settings.js            # NEW — settings schema/read/write over window.mzStorage, textSize/OS-scale clamping
├── tutorial.js            # NEW — coach-mark step data + seen-flag persistence (pure step-state logic, DOM-free — testable)
└── icons.js               # NEW — feature-key → Image() map, preload/decode, drawImage sizing helper

fonts/                     # EXISTING dir — add press-start-2p-400.woff2, courier-prime-400.woff2, courier-prime-700.woff2
icons/                     # EXISTING dir (1254px sources, keep as-is)
icons/optimized/           # NEW — single downscaled (~128–160px) PNG per icon, committed, source of truth for the build
tools/build-www.mjs        # EXTEND — add copyIcons() mirroring copyFonts(); no change needed for fonts (already whole-dir copy)
```

### Pattern 1: Tap-to-cell hit-testing shares the renderer's exact transform

**What:** The tap handler must invert the SAME `cs` (cell size in CSS px), pan offset, and viewport-center math the render loop uses — never a separately-maintained copy, or the two will drift on any text-size/pan change.

**When to use:** Every pointerup on the maze viewport, when `controlScheme === 'tap'`.

**Example (adapted from the design's own `renderVals()` pan math, `design/Mazeworld Mobile.dc.html` lines 664–665, generalized to a forward+inverse pair the live app should share between draw and hit-test):**
```javascript
// Source: design/Mazeworld Mobile.dc.html renderVals(), inverted.
// Forward (already how the renderer places the player/viewport):
//   tx = vw/2 - (pos.x + 0.5) * cs - CANVAS_PAD + pan.x
//   ty = vh/2 - (pos.y + 0.5) * cs - CANVAS_PAD + pan.y
// screenX = tx + cellX * cs   (before DPR scaling — this is CSS px, matching
//   the canvas's cv.style.width, NOT cv.width, since ctx.setTransform(dpr,...)
//   already absorbs the backing-store scale)

function screenToCell(clientX, clientY, viewportRect, pos, pan, cs, canvasPad) {
  const vw = viewportRect.width, vh = viewportRect.height;
  const localX = clientX - viewportRect.left;
  const localY = clientY - viewportRect.top;
  const tx = vw / 2 - (pos.x + 0.5) * cs - canvasPad + pan.x;
  const ty = vh / 2 - (pos.y + 0.5) * cs - canvasPad + pan.y;
  const cellX = Math.floor((localX - tx) / cs);
  const cellY = Math.floor((localY - ty) / cs);
  return { x: cellX, y: cellY };
}

// Resolve tapped cell → orthogonal one-step direction (locked decision: only
// an orthogonally-adjacent, currently-seen cell is a valid tap-move target).
function resolveTapDirection(pos, tappedCell, seenSet) {
  const dx = tappedCell.x - pos.x, dy = tappedCell.y - pos.y;
  const key = `${tappedCell.x},${tappedCell.y}`;
  if (!seenSet.has(key)) return null;
  if (dx === 1 && dy === 0) return "E";
  if (dx === -1 && dy === 0) return "W";
  if (dx === 0 && dy === 1) return "S";
  if (dx === 0 && dy === -1) return "N";
  return null; // not orthogonally adjacent — no-op per CONTEXT.md
}
```
Both functions above are pure (no DOM/canvas reads inside them) and therefore directly unit-testable with `node:test` — feed them synthetic `pos`/`pan`/`cs` values and assert the resolved cell/direction, no headless-DOM needed. See §9/Validation Architecture.

### Pattern 2: Distinguish tap from pan-drag by movement threshold + time, not a separate gesture library

**What:** The design's own viewport already has `onPointerDown`/`onPointerMove`/`onPointerUp` pan handlers (`panDown`/`panMove`/`panUp`, `design/Mazeworld Mobile.dc.html` lines 755–757) with NO tap-vs-drag disambiguation (the mockup has no tap-to-move at all — it's D-pad-only). This phase must add that disambiguation.

**When to use:** Every `pointerdown`→`pointerup` cycle on the maze viewport.

**Example pattern (standard, well-established touch-UX threshold — not from the design source, general mobile-UX practice):**
```javascript
const TAP_MOVE_THRESHOLD_PX = 10;  // total pointer travel below this = a tap
const TAP_MAX_DURATION_MS = 350;   // above this with low travel = long-press, not tap (reserved, no action bound in v1)

function classifyPointerGesture(downEvent, upEvent, totalDeltaPx) {
  const duration = upEvent.timeStamp - downEvent.timeStamp;
  if (totalDeltaPx <= TAP_MOVE_THRESHOLD_PX && duration <= TAP_MAX_DURATION_MS) return "tap";
  return "drag"; // already panned via panMove during the gesture; no move action fires
}
```
Wire this alongside the existing `panDown`/`panMove`/`panUp` handlers: `panMove` already accumulates `pan.x/pan.y` deltas every step, so `totalDeltaPx` is simply the Euclidean distance between the pointerdown and current pointer position at pointerup. If classified `"tap"`, run `screenToCell` + `resolveTapDirection` and dispatch a move; if `"drag"`, do nothing further (the pan transform already updated live during the drag).

### Pattern 3: Route every remaining classic input through the SAME `dispatch()` seam `window.move` already proves

**What:** `window.move` (mazeworld.html line 3415) is the reference implementation for "how a classic call site becomes engine-routed": overwrite the global function the DOM handler already calls, translate its arguments into an `applyAction`-shaped `action`, call `dispatch()`, then re-render from the returned `state`/`html`.

**When to use:** For each of `playerStrike`, `flee`, `parley`, `sing`, `drinkPotion`, `readScroll`, `castSpell`, `buyFrom`, `leaveStore`, `makeCamp` (the classic `S`-state versions at the line numbers found in this research — see §7).

**Example (the exact pattern to replicate, from the existing trailing module):**
```javascript
// Source: mazeworld.html lines 3415-3421 (existing, for movement — the
// pattern this phase repeats for combat/economy/camp).
window.move = function engineMove(dir) {
  const { state, html } = dispatch({ type: "move", dir });
  window.__mzState.set(state);
  window.paint();
  window.draw();
  for (const line of html) window.logLine(line);
};
```
The combat/store/camp equivalents follow identically, e.g.:
```javascript
window.__mzEngineAttack = function () {
  const { state, html } = dispatch({ type: "attack" });
  window.__mzState.set(state);
  window.paint(); // or a dedicated renderEncounter()-equivalent for the new mobile combat screen
  for (const line of html) window.logLine(line);
};
```
Do NOT delete the classic `playerStrike`/`buyFrom`/etc. function bodies outright in the same commit that rewires their call sites — per this project's TDD-per-task convention (see `test/parity/` for precedent), keep them until the new mobile combat/store screens are proven to call the engine-routed versions, then remove the dead classic code as a follow-up cleanup commit (mirrors how `01-07` left `newGame`/`makeCamp` un-migrated deliberately, documented in STATE.md, rather than half-migrating in one risky commit).

### Anti-Patterns to Avoid
- **Re-deriving maze/combat state client-side instead of reading engine `state`:** The design mockup's `Component` class (lines 367–819) has its OWN `buildFloor`, `move`, `land`, `strike`, `startEncounter`, etc. — none of this logic transfers. Every screen must bind to the REAL `GameState` shape from `engine/state.js`/`engine/character.js`, not the mockup's placeholder shape (`s.ch.wp`, `s.floor`, `s.pos` in the mockup are NOT the real engine's field names).
- **Computing DPR/cell-size math twice (once in `draw()`, once in the tap handler):** Guaranteed to drift the moment text-size or pan changes. Factor the shared geometry (cell size, pan offset, viewport center) into one small pure function/object both `draw()` and `screenToCell()` read from.
- **Using `env(safe-area-inset-*)` without the `--safe-area-inset-*` custom-property fallback:** Silently renders correctly on newer devices/emulators (WebView ≥140) and silently WRONG (0 padding, content under the status bar) on older/common production Android WebView versions — see §2.
- **Hand-writing all ~130 event-type narration strings inline in a giant switch inside `formatEvents`:** the existing `formatEvent` function (lines 299–358) is already a monolithic switch; growing it 5x in place will make it unreviewable. Prefer a lookup-table/data-driven approach (see §7) so each entry is a one-line `{type: template}` mapping, easier to review, test-count, and hand off to Phase 5's voice generator later.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native haptic pulse on hit/trap/death | A custom `navigator.vibrate()` shim | `@capacitor/haptics`'s `Haptics.impact({style})` | `navigator.vibrate()` is unreliable/inconsistent inside Android WebViews and doesn't map to native haptic engine "styles" (light/medium/heavy); the plugin is a thin, already-vetted wrapper this org already trusts (same publisher as installed plugins) |
| Safe-area inset detection | Manual `window.visualViewport` diffing or a hardcoded status-bar height guess | `env(safe-area-inset-*)` + Capacitor's `--safe-area-inset-*` CSS var fallback | Device-specific status/nav bar heights vary (gesture-nav vs 3-button nav, notch vs punch-hole vs none); the platform-provided values are the only correct source, and Capacitor's fallback exists specifically because raw `env()` is unreliable on older WebView |
| Icon downscaling/resizing | A bundler image-loader plugin or new native-binary devDependency (`sharp`) | The same PowerShell/System.Drawing one-time script pattern already proven in 02-04 for launcher mipmaps | Zero new dependency, already proven to work in this exact environment; the task is a single one-time preprocessing step (commit the output), not a runtime concern |
| Coach-mark "spotlight" cutout over a highlighted element | A full onboarding library | A `position:fixed` semi-opaque overlay `div` with a CSS `clip-path`/box-shadow cutout sized to the target element's `getBoundingClientRect()` | Only ~4 fixed steps are needed (UX-06 explicitly wants "no wall of text"); a library adds real weight for a feature this narrow |
| Text-size scaling math | Per-component inline scale calculations | One `--mw-text-scale` CSS custom property (already specified in UI-SPEC) multiplying every `rem`-based token | UI-SPEC already locks this exact mechanism — don't reinvent it, just implement it |

**Key insight:** Almost nothing in this phase is a genuinely novel engineering problem — the risk is entirely in (1) faithfully reading engine state instead of the design mockup's placeholder logic, (2) getting Android WebView's specific safe-area quirk right (a well-documented but easy-to-miss platform gotcha), and (3) correctly SCOPING the formatEvents completion so it doesn't become an unbounded side quest.

## Common Pitfalls

### Pitfall 1: Treating the design mockup's `Component` class as portable logic
**What goes wrong:** The mockup (`design/Mazeworld Mobile.dc.html`) is a complete, self-contained interactive prototype with its OWN maze generator (`buildFloor`), movement (`move`/`land`), combat (`strike`/`foeTurn`/`win`), and character-roll (`startRoll`/`enterMaze`) logic, using `Math.random()` directly and a different field shape (`s.ch.wp`, `s.pos`, `s.feats`) than the real engine.
**Why it happens:** It's easy to copy-paste working interactive code straight out of a Claude Design preview when it "just works" in isolation.
**How to avoid:** Every screen's data MUST come from `engineAdapter.getState()`/the values `dispatch()` returns, never from re-running the mockup's own generators. Treat the mockup strictly as a CSS/layout/interaction-timing reference (verified: CONTEXT.md and UI-SPEC both say this explicitly; this research adds the concrete mechanism — read the mockup's `renderVals()` for the STYLE OBJECT SHAPE, discard everything inside `Component`'s state-mutation methods).
**Warning signs:** Any new code that calls `Math.random()` directly (violates ENG-02's seeded-PRNG-only rule, which is enforced project-wide, not just inside `engine/`), or that duplicates a `FEATS`/`RACES`/`CLASSES` table already defined in `content/*.js`.

### Pitfall 2: `env(safe-area-inset-*)` returning 0 on real/older Android WebView
**What goes wrong:** The design's hardcoded `padding-top:50px`/`padding-bottom:20px` (sized for its iOS preview frame) gets replaced with `padding-top: calc(12px + env(safe-area-inset-top))` per UI-SPEC — but on an Android WebView build below version 140, `env(safe-area-inset-top)` can silently return `0px` even though a real inset exists, making the HUD render under the status bar exactly like the bug this change was meant to fix.
**Why it happens:** This is a documented Android WebView bug [CITED: capacitorjs.com/docs/apis/system-bars, dev.to/capawesome/capacitor-edge-to-edge-safe-areas-the-complete-guide], not a Capacitor-config mistake — the CSS spec's `env()` mechanism itself misreports on affected WebView builds.
**How to avoid:** Use the fallback-chained pattern everywhere UI-SPEC calls for a safe-area value: `padding-top: calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))`. Capacitor 8.0+ (already installed at 8.5.1) injects the `--safe-area-inset-*` custom properties automatically (default `insetsHandling: "css"`), so no new plugin install is required — only the CSS pattern needs to change from UI-SPEC's literal `env(...)` wording. Also add `viewport-fit=cover` to `mazeworld.html`'s `<meta name="viewport">` tag (currently `content="width=device-width, initial-scale=1"` — missing `viewport-fit=cover`, which is required for the inset values to be non-zero at all).
**Warning signs:** HUD/tab-bar looks correct in a desktop browser dev-loop test (where `env()` always returns 0 harmlessly against a 0-inset viewport) but is verified only on-device — this is a deferred-UAT item per the project's autonomous-run posture (see Validation Architecture), so the risk must be called out explicitly rather than assumed passing.

### Pitfall 3: Android 15+ edge-to-edge enforcement fighting the "recolor the status bar" decision
**What goes wrong:** CONTEXT.md's decision to "recolor the native status bar to the dark theme" might be implemented as another `StatusBar.setBackgroundColor()` call (the pattern 02-04 used for the parchment color) — but on Android 15+ (API 35+), edge-to-edge is enforced for apps targeting that SDK, and `overlaysWebView`/`setBackgroundColor` escape hatches are documented as no longer reliably honored on Android 16 [CITED: capawesome.io edge-to-edge guide].
**Why it happens:** The status-bar-color API predates Android's edge-to-edge enforcement change; it still exists and doesn't error, it just may be silently ignored on the newest OS versions.
**How to avoid:** Don't rely solely on `StatusBar.setBackgroundColor()`. Since edge-to-edge means the WebView content extends UNDER the status bar regardless, the correct fix is: make sure whatever DOM element sits at the very top of the screen (the HUD header band, `#1b170f`) extends to `y=0` with NO padding, and the safe-area padding is applied to the CONTENT inside it (per UI-SPEC's `padding-top: calc(12px + safe-area-inset)`), so the status bar visually "sees" the app's own dark background color showing through the transparent system-bar area rather than depending on the plugin to paint it. Still call `StatusBar.setStyle({style:"DARK"})`-equivalent (icons/text light-on-dark) since that part of the API is unaffected — only the background-color painting is the fragile part.
**Warning signs:** Status bar looks correct on the emulator/dev device but a differently-configured device (different Android version, different manufacturer skin) shows a mismatched or transparent-over-white status bar.

### Pitfall 4: `formatEvents()` silently dropping unrecognized event types (already-documented behavior, now a bigger surface)
**What goes wrong:** `formatEvent()`'s existing `default: return null` (line 357) is DELIBERATE (documented in the function's own comment as "loosely scoped on purpose") — but once combat/economy are routed through the engine, dozens of event types that were never player-visible in the dev harness become player-visible gaps: a `struck`/`foeKilled`/`bought`/`healed` action would resolve correctly in engine state but produce ZERO log line, looking like a silent bug rather than a missing narration string.
**Why it happens:** The gap between "engine emits 140 event types" and "formatEvents narrates 26" was invisible while only movement was engine-routed (movement's event vocabulary — `moved`, `oneWayBlocked`, `dayBegan`, `teleported`, `floorChanged`, etc. — is a SMALL, mostly-already-covered subset).
**How to avoid:** Before wiring combat/store buttons to `dispatch()`, run a coverage script (or a quick test) that diffs `formatEvent`'s switch cases against the full grepped event-type list this research already produced (§7) and treat any gap as a required task, not an incidental one.
**Warning signs:** Silent, blank combat/store log entries after a strike/purchase that clearly changed WP/gold in the HUD.

## Code Examples

### 1. DPR-correct canvas sizing (existing pattern to extend, not replace)
```javascript
// Source: mazeworld.html lines 1325-1335 (existing `fit()` — already correct;
// extend for the new mobile layout's viewport sizing, don't rewrite the DPR
// mechanism itself).
function fit() {
  const w = cv.parentElement.clientWidth - 26;
  const h = Math.max(300, window.innerHeight - 260);
  CELL = clamp(Math.floor(Math.min(w, h) / GW), 14, 34);
  const px = CELL * GW;
  const dpr = window.devicePixelRatio || 1;
  cv.width = px * dpr; cv.height = px * dpr;       // backing store, device px
  cv.style.width = px + "px"; cv.style.height = px + "px"; // CSS px, unscaled
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);            // every ctx.* call after
  draw();                                            // this line uses CSS-px coords
}
```
The critical invariant to preserve when extending this for the mobile viewport (which needs to be a FIXED on-screen box the maze pans WITHIN, per UI-SPEC's viewport framing, rather than the desktop version's grow-to-fit-window sizing): `cv.width`/`cv.height` are DEVICE pixels (`× dpr`), `cv.style.width`/`cv.style.height` are CSS pixels, and every `ctx.*` drawing call operates in CSS-px space because of the `setTransform`. The tap-hit-test math in Pattern 1 above must operate in the SAME CSS-px space (i.e., use `event.clientX/clientY` relative to the canvas's CSS bounding rect, never divide/multiply by `dpr` again — that's already absorbed by the transform).

### 2. Safe-area CSS pattern (new, replaces UI-SPEC's literal `env()` wording)
```css
/* Source: pattern recommended by capacitorjs.com/docs/apis/system-bars for
   Android WebView < 140's env() bug — see Pitfall 2. */
.mw-hud-top {
  padding-top: calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
}
.mw-tab-bar, .mw-bottom-controls {
  padding-bottom: calc(8px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
}
```
```html
<!-- Source: required for inset values to be non-zero at all on Android;
     mazeworld.html's current viewport meta tag is missing viewport-fit=cover. -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### 3. Icon draw sizing (canvas, DPR-correct, per UI-SPEC's `cellSize * 0.6` contract)
```javascript
// Source: adapts design/Mazeworld Mobile.dc.html's glyph sizing rule
// (fontSize: cs * 0.6, line 661) to a PNG drawImage call. cs already comes
// from the S/M/L text-size setting (28/34/40 CSS px per UI-SPEC).
function drawFeatureIcon(ctx, img, cellX, cellY, cs) {
  const size = Math.round(cs * 0.6);
  const dx = cellX * cs + (cs - size) / 2;
  const dy = cellY * cs + (cs - size) / 2;
  // ctx already has setTransform(dpr,...) applied — draw in CSS-px, same as
  // every other ctx.* call in draw(). No manual DPR multiplication here.
  ctx.drawImage(img, dx, dy, size, size);
}

// Preload once at boot (before first draw()) so there's no first-paint pop —
// UI-SPEC's icon draw size never exceeds ~24px CSS (40 * 0.6 at the L text
// setting), so a single ~128-160px source PNG per icon covers every DPR up
// to 3x with margin; no density-bucket set needed (contrast with the
// splash-screen assets, which DO need density buckets because they cover the
// full screen).
const FEATURE_ICONS = ["chest","crevice","descent","encounter","onewaydoor","party","teleport","trap","wall"];
function preloadIcons(basePath) {
  const map = {};
  const loaded = FEATURE_ICONS.map((name) => new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve();
    img.onerror = () => resolve(); // fail-open: a missing icon just won't draw, never blocks boot
    img.src = `${basePath}/${name}.png`;
    map[name] = img;
  }));
  return Promise.all(loaded).then(() => map);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `StatusBar.setBackgroundColor()` as the sole mechanism for status-bar theming on Android | System Bars edge-to-edge enforcement + `--safe-area-inset-*` CSS var injection | Android 15 (API 35) enforced edge-to-edge for apps targeting that SDK; Capacitor 8.3.1+ split status/nav bar styling state, 8.3.2 removed extra padding on API ≤34 | This project's target SDK already exceeds 35 (per STATE.md's Play-submission research); the phase must treat safe-area padding as load-bearing, not cosmetic |
| `env(safe-area-inset-*)` trusted directly | `var(--safe-area-inset-*, env(...))` fallback chain | Ongoing — WebView < 140 bug still present on many real-world Android WebView versions in the field as of this research (WebView update cadence lags Chrome's) | Directly affects UX-03's safe-area requirement; a naive `env()`-only implementation can pass in a desktop dev-loop check and still fail on-device |
| `@capacitor/assets` for icon/asset generation | Manual dependency-free resize (already proven in 02-04) | N/A — this is project-specific, not an ecosystem-wide change; `@capacitor/assets` has a known broken dependency (`chevrotain`) in this specific environment | Confirms the icon-downscale approach should reuse 02-04's exact toolchain rather than re-attempting `@capacitor/assets` |

**Deprecated/outdated:**
- Relying on `overlaysWebView:false` + a solid status-bar color as a complete safe-area solution on Android: no longer sufficient alone on Android 15+; must be paired with safe-area-aware CSS padding regardless of the status-bar plugin config.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | A single ~128–160px source PNG per icon (no density-bucket set) is sufficient for crisp rendering at the UI-SPEC's max icon draw size (~24px CSS × up to 3x DPR ≈ 72px backing-store px) | §Code Examples #3, "Don't Hand-Roll" icon row | If actual on-device DPR exceeds ~3x combined with a future larger cellSize, icons could look soft; low risk given UI-SPEC's fixed 28/34/40px cellSize ceiling, but genuinely device-untested until UAT |
| A2 | Press Start 2P + Courier Prime latin-subset `.woff2` can be obtained the same way Phase 2 obtained its three font families (a one-time fetch from Google Fonts / a self-hosting helper tool) without a new devDependency | §3 (this research didn't find or execute the exact 02-04 fetch command — its SUMMARY.md doesn't record the literal tool used, only that "latin" subsets were downloaded) | Low risk — both fonts are confirmed OFL-licensed Google Fonts [CITED: github.com/google/fonts], multiple equivalent self-hosting paths exist; worst case is a slightly different tool than 02-04 used, not a blocked path |
| A3 | Capacitor's bundled System Bars `insetsHandling: "css"` default is active with zero explicit `capacitor.config.json` change needed | §2, Pitfall 2 | If the default has changed or requires an explicit key in this exact 8.5.1 release, safe-area CSS vars could resolve empty; verify by inspecting the live `--safe-area-inset-*` values in a debug build early in the phase (cheap, fast check) rather than trusting this assumption through to UAT |

**If this table is empty:** N/A — three assumptions above need lightweight on-device/build-time confirmation early in phase execution, not blocking planning.

## Open Questions

1. **Exact font-fetch tool/command 02-04 used for the existing self-hosted fonts**
   - What we know: `fonts/*.woff2` are latin-subset-only, OFL-licensed Google Fonts, committed as repo-root source; `tools/build-www.mjs`'s `copyFonts()` just copies the directory verbatim (no new tooling needed for Phase 4's two new families).
   - What's unclear: 02-04-SUMMARY.md doesn't name the literal fetch tool (e.g., google-webfonts-helper vs. a direct Google Fonts API download vs. `@fontsource/*` npm packages extracted and discarded).
   - Recommendation: Any equivalent one-time fetch is fine (e.g., `gwfh.mranftl.com` for pinned latin-only woff2, or downloading `@fontsource/press-start-2p`/`@fontsource/courier-prime`'s files and NOT adding them as a runtime dependency — just lift the `.woff2` files into `fonts/`). Confirm Courier Prime's available static weights include both 400 and 700 (UI-SPEC requires both — Body/Data roles use "Courier Prime Bold" 700 throughout).

2. **Whether the live device (Pixel 7, per STATE.md) is on WebView ≥140 or the buggy older range**
   - What we know: The safe-area `env()` bug affects WebView versions below 140; the project's actual on-device WebView version wasn't checked in this research session.
   - What's unclear: Whether Pitfall 2's fallback pattern is strictly necessary on the specific device available for UAT, or purely defensive for the broader Play Store install base.
   - Recommendation: Implement the fallback pattern regardless (near-zero cost, described in Code Examples #2) — this is a "defend broadly, don't assume the dev device is representative" case, since the app ships to arbitrary Android devices via Play, not just the one Pixel 7 available for testing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | build tooling, `node --test` | ✓ | ≥22 (per `package.json` engines, already satisfied per Phase 1-3 execution) | — |
| npm registry access | `npm install @capacitor/haptics`, one-time font fetch | ✓ (used during this research session) | — | — |
| PowerShell + .NET System.Drawing | icon downscale pipeline | ✓ (proven working in 02-04 for launcher mipmaps, same Windows dev environment) | — | — |
| `@capacitor/assets` | icon/asset generation (considered, rejected) | ✗ (confirmed broken — missing `chevrotain` dependency, per STATE.md) | — | PowerShell/System.Drawing (already the adopted fallback, not a new decision) |
| Physical Android device (Pixel 7) for safe-area/haptics/touch UAT | on-device verification of UX-01/02/03/06/07 | ✓ (per STATE.md — "App is LIVE on a real device... Pixel 7") | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `@capacitor/assets` → PowerShell/System.Drawing (already the established, working path from Phase 2 — not a new gap introduced by this phase).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` (no third-party test runner) |
| Config file | none — plain `node --test` over `test/**` (see `package.json` `"test": "node --test"`) |
| Quick run command | `npm run test:quick` (`node --test test/unit test/determinism test/roundtrip`) |
| Full suite command | `npm test` (372 tests currently green, per STATE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| UX-01 | `screenToCell`/`resolveTapDirection` correctly resolve a tap to an adjacent-cell move (or no-op for non-adjacent/unseen) | unit | `node --test test/unit/controls.test.js` | ❌ Wave 0 |
| UX-01 | `classifyPointerGesture` correctly distinguishes tap vs. drag by threshold/duration | unit | `node --test test/unit/controls.test.js` | ❌ Wave 0 |
| UX-01 | Control-scheme setting (tap/dpad) persists via `window.mzStorage` and is read back correctly | unit | `node --test test/unit/settings.test.js` | ❌ Wave 0 |
| UX-02 | 48dp minimum hit-area corrections apply on every element UI-SPEC's correction table lists | manual/visual-only (CSS `min-height`/`min-width` assertions are trivially gameable; real confidence needs device tap testing) | — (document as deferred device-UAT) | n/a |
| UX-03 | Canvas backing-store size = CSS size × `devicePixelRatio` after `fit()`/resize | unit (pure function extracted from `fit()`'s size-math, DOM-free) | `node --test test/unit/canvasSizing.test.js` | ❌ Wave 0 |
| UX-03 | Safe-area CSS custom properties resolve to non-zero values on-device, portrait lock holds | manual device-UAT | — | n/a (device-only, no headless DOM has real `env()`/System Bars injection) |
| UX-04 | Character sheet correctly binds every UI-SPEC row (`TO STRIKE`, `ARMOR`, etc.) to the real `GameState.c` fields, not the mockup's placeholder shape | unit (pure formatter function: `GameState → sheet view-model`) | `node --test test/unit/characterSheetViewModel.test.js` | ❌ Wave 0 |
| UX-05 | Oracle log renders reverse-chronological, dice-reveal gating matches `diceMode` setting | unit (pure formatter: `(logEntries, diceMode) → renderable rows`) | `node --test test/unit/oracleLogViewModel.test.js` | ❌ Wave 0 |
| UX-05 | `formatEvents()` produces a non-null narration line for every event type the engine can emit (see §7's full grepped list) | unit — coverage assertion (import every emitted `type:"..."` literal, or maintain a checked list, and assert `formatEvent` doesn't return `null` for any of them) | `node --test test/unit/formatEventsCoverage.test.js` | ❌ Wave 0 |
| UX-06 | Coach-mark step sequencer advances/dismisses/persists `tutorialSeen` correctly, caps at "no wall of text" (step copy length) | unit | `node --test test/unit/tutorial.test.js` | ❌ Wave 0 |
| UX-07 | Settings read/write round-trip for all 6 fields (sound, haptics, textSize, controlScheme, confirmBeforeQuit, diceMode) via `window.mzStorage` | unit | `node --test test/unit/settings.test.js` | ❌ Wave 0 |
| UX-07 | `decideBackAction`-equivalent confirm-before-quit gating for the Sheet's "Cut Losses" action honors the setting | unit (pure function, same pattern as existing `nativeChrome.js#decideBackAction`) | `node --test test/unit/confirmQuit.test.js` | ❌ Wave 0 |
| UX-08 | Text-scale multiplier (S/M/L → 0.85/1.0/1.25×) clamps OS font-scale input to the same bound | unit | `node --test test/unit/textScale.test.js` | ❌ Wave 0 |
| Engine routing | `attack`/`flee`/`parley`/`sing`/`drinkPotion`/`readScroll`/`castSpell`/`buyItem`/`leaveStore`/`camp` all resolve through `dispatch()` from the live page's new call sites (not the classic `S`-state functions) | integration (extend `test/unit/engineAdapter.test.js`'s existing pattern — dispatch each action type, assert engine state changed and classic globals were NOT touched) | `node --test test/unit/engineAdapter.test.js` | 🔶 extend existing file |

### Sampling Rate
- **Per task commit:** `npm run test:quick`
- **Per wave merge:** `npm test` (full 372+ suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/unit/controls.test.js` — covers UX-01 tap-to-cell/gesture-classification pure functions
- [ ] `test/unit/canvasSizing.test.js` — covers UX-03 DPR backing-store math
- [ ] `test/unit/characterSheetViewModel.test.js` — covers UX-04
- [ ] `test/unit/oracleLogViewModel.test.js` — covers UX-05 dice-reveal gating
- [ ] `test/unit/formatEventsCoverage.test.js` — covers UX-05's narration-completeness requirement (the highest-value new test in this phase — directly guards against Pitfall 4's silent-drop failure mode)
- [ ] `test/unit/tutorial.test.js` — covers UX-06
- [ ] `test/unit/settings.test.js` — covers UX-07 (all 6 fields) + UX-01's control-scheme persistence
- [ ] `test/unit/textScale.test.js` — covers UX-08
- [ ] Extend `test/unit/engineAdapter.test.js` — covers the engine-routing completion (combat/economy/camp/new-run dispatch coverage)
- [ ] No new framework install needed — `node:test` is already fully wired

**Deferred to manual/device-UAT (cannot be headlessly automated, consistent with this project's autonomous-run + deferred-UAT posture per STATE.md):**
- UX-02: real-finger 48dp tap accuracy/mis-tap prevention feel
- UX-03: real safe-area inset values, actual on-device DPR crispness, portrait-lock feel
- UX-06: tutorial "does it actually teach the loop without feeling wordy" — a feel judgment, not a correctness assertion
- UX-07: haptics — no headless way to confirm a physical vibration fired; confirm `Haptics.impact()` is CALLED (unit-testable via an injectable/mocked Haptics object, same pattern as `nativeChrome.js`'s injectable plugin params) but not that it FEELS right

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | no | Fully offline, single-player, no accounts (per PROJECT.md constraints) |
| V3 Session Management | no | No sessions/network |
| V4 Access Control | no | Single local user, no roles |
| V5 Input Validation | yes | Tap coordinates and D-pad direction inputs must resolve through the SAME `validateAction`/`applyAction` chokepoint every other action already uses (`engine/actions.js`'s `validateAction` — confirmed already fail-safe/no-throw on malformed input, per `engine/engine.js`'s doc comment: "Unknown or malformed actions are no-ops... they never throw"). New client-side code must never construct a raw engine state mutation bypassing `dispatch()` |
| V6 Cryptography | no | No secrets/crypto in this phase; storage is plaintext local Preferences (already the established, accepted posture for this offline single-player app per SAV-03) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Malformed/adversarial tap coordinates (e.g. a compromised WebView or dev-tools injection sending an out-of-bounds cell) resolving to an invalid move | Tampering | `resolveTapDirection` only returns a valid direction for an orthogonally-adjacent, currently-seen cell (already a closed rule per the locked decision); anything else returns `null`/no-op. The engine's own `move()` handler additionally re-validates wall/bounds server-side-equivalent (i.e., inside `engine/movement.js`, not trusted from the client) — this is already the existing architecture's posture, this phase must not weaken it by, e.g., trusting a client-computed "you can reach this cell" shortcut instead of always going through `applyAction` |
| A future coach-mark/settings bug writing directly to `localStorage`/`Preferences` bypassing `window.mzStorage`'s per-key write-queue | Tampering (data race, not security in the traditional sense, but a data-integrity threat) | All new settings/tutorial persistence MUST go through `window.mzStorage` (`getItem`/`setItem`), never raw `localStorage`/`Preferences` calls, mirroring the existing dual-write-hazard fix documented in `storage.js`'s own header comment |
| Self-hosted `.woff2`/`.png` assets shipped in the bundle being tampered with post-install (not a network MITM risk since offline, but a supply-chain concern at BUILD time) | Tampering | Fonts/icons are committed source under version control (same posture as the existing `fonts/*.woff2` and `icons/*.png`); no runtime fetch of either asset class, closing the network-tampering vector entirely (matches the project's offline/STR-01 "no data collection" posture) |

## Sources

### Primary (HIGH confidence)
- Direct read of `mazeworld.html` (3500 lines; canvas/DPR/`fit()`/`draw()` at lines 1325-1440, `newGame`/dpad/keydown/trailing module at lines 3279-3497, combat at 2306+, store at 2054-2111, camp at 1830, fonts at 1-62) — primary source, HIGH confidence
- Direct read of `src/browser/engineAdapter.js` (359 lines, full file) — `dispatch()`/`formatEvents()`/`formatEvent()` mechanics
- Direct read of `src/browser/storage.js` (323 lines, full file) — `window.mzStorage` API surface for settings/tutorial persistence
- Direct read of `src/browser/nativeChrome.js` (297 lines, full file) — plugin-injection pattern to replicate for `@capacitor/haptics`, dark status-bar wiring point
- Direct read of `tools/build-www.mjs` (225 lines, full file) — confirmed NO icon-copy step exists yet; `copyFonts()` already whole-directory
- Direct read of `engine/engine.js` (95 lines, full file) — confirmed all combat/economy/camp action types already implemented
- `grep -rn 'type: "[a-zA-Z]+"' engine/` — full ~140-entry event-type inventory across `combat.js`/`magic.js`/`economy.js`/`encounters.js`/`items.js`/`movement.js`
- Direct read of `design/Mazeworld Mobile.dc.html` (822 lines, full file) — mockup interaction/style-object patterns (pan math, D-pad grid, tab structure)
- Direct read of `test/unit/engineAdapter.test.js` (excerpt) — existing `node:test` conventions for headless engine/storage testing
- `.planning/phases/04-mobile-presentation-controls-onboarding/04-UI-SPEC.md` (already VERIFIED design contract) — authoritative for all values not re-derived here
- `.planning/STATE.md` — confirmed `@capacitor/assets` broken, engine-routing gap, on-device Pixel 7 availability, target-SDK/edge-to-edge context

### Secondary (MEDIUM confidence)
- `capacitorjs.com/docs/apis/system-bars` [CITED] via WebFetch — System Bars bundled in `@capacitor/core` since 8.0.0, `--safe-area-inset-*` CSS var injection, default `insetsHandling: "css"`
- `capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide` [CITED] via WebFetch — Android WebView <140 `env()` bug, Android 15+ edge-to-edge enforcement, `overlaysWebView`/`setBackgroundColor` no longer reliably honored on Android 16
- `github.com/google/fonts` (ofl/pressstart2p, Courier Prime OFL license pages) [CITED] via WebSearch — both fonts confirmed OFL-licensed, safe to self-host per the existing pattern
- `npm view @capacitor/haptics version` — live registry check, `8.0.2`, peer dep `@capacitor/core >=8.0.0`
- `gsd-tools query package-legitimacy check` for `@capacitor/haptics` — verdict OK, same publisher/org as already-trusted plugins

### Tertiary (LOW confidence)
- None — every finding in this document is either a direct source read or a cited/cross-checked external source.

## Metadata

**Confidence breakdown:**
- Standard stack / architecture: HIGH — grounded entirely in direct reads of the actual codebase (engine dispatch table, adapter, storage, build script), not general framework knowledge
- Android WebView safe-area/edge-to-edge behavior: MEDIUM — cross-checked across two independent sources (Capacitor's own docs + a third-party guide summarizing the same GitHub issues), but not verified against this project's specific on-device WebView version this session (see Open Question 2)
- Font/icon pipeline: MEDIUM — licensing confirmed HIGH, exact fetch tooling is an open question (A2) since 02-04's own summary doesn't record the literal command used
- formatEvents completion scope: HIGH — the ~140 vs ~26 event-type gap is a direct grep count, not an estimate
- Pitfalls: HIGH for engine-routing/mockup-portability pitfalls (direct source evidence); MEDIUM for the Android platform pitfalls (cited external docs, not this-device-verified)

**Research date:** 2026-09-08
**Valid until:** 30 days for the codebase-grounded findings (stable unless the codebase changes underneath); 14 days for the Capacitor/Android WebView platform findings (this is an actively-evolving area — Android 15/16 edge-to-edge enforcement and WebView update cadence are recent/ongoing changes as of this research)
