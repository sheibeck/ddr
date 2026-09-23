# Phase 59: Party Animation & Dungeon Set Dressing - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 15 decisions across 4 areas, all accepted as recommended

<domain>
## Phase Boundary

Two pure-presentation features on the map canvas surface: the **party marker comes alive** (an idle frame cycle while standing, a step cycle + glide while moving, the stark dark ring dialled back — ANIM-01..03), and **the floors carry ambient props** from the 54 `set_dungeon_*` images, dimmed on walkable squares, never on a feature/stairs/party square, deterministic per seed+depth, and switchable off in Settings (DRESS-01..05).

Presentation gate (milestone-wide): `engine/` and `content/` byte-identical, no engine rng draw, zero parity fixtures move. Prop placement randomness comes from a SHELL-side derived stream (`makeRng(hash(seed, "dressing", depth))` in `src/browser/`), never the engine's main stream. Props are not interactable and have no rules effect (Out of Scope: "Interactive or rule-bearing set dressing").

Builds on: Phase 57 (stabilised viewport, `#mw-stage` rail overlay, the 57-04 darkness vignette + `__mzDarkness`, the 57-05 compact HUD / ☰ menu) and Phase 58 (the shared reduced-motion predicate in `src/browser/motion.js`, the `cameraGlide` 200 ms camera tween — Phase 58 deliberately deferred the marker glide to this phase).

Source: backlog 999.1 (the ring: "Dial back the black circle around the party marker — the party is already highlighted, the ring is too stark") and 999.3 (set dressing — its "Context for planning" block carries the draw-order and placement design).

</domain>

<decisions>
## Implementation Decisions

### Party animation (ANIM-01..03)
- **The marker becomes a DOM sprite over the canvas**, like `#mw-party-pulse` already is (positioned by the same `cameraPan()` forward transform `positionPartyPulse` uses). The idle loop is a CSS frame cycle over `party_idle_1..4` — no canvas redraw loop. `draw()` stops drawing the `PLAYER_MARKER_ICON` party icon on the canvas (the static `party.png` remains the fallback/first frame).
- **Idle: ~280 ms per frame** (a ~1.1 s gentle breathing loop).
- **Stepping: the marker glides square to square over ~200 ms** (matching Phase 58's camera glide) while playing `party_step_1..4` once, then settles back to idle on arrival. Rapid steps retarget from the current position (no queueing, no stutter), coordinated with the camera glide so marker and map move together.
- **The ring (ANIM-03):** drop the hard 3px dark ring (`box-shadow:0 0 0 3px #14110c` on `.mw-party-pulse`) and keep a faint warm glow at about half today's strength, so the sprite itself reads as the highlight.
- **Reduced motion** (Phase 58's shared predicate): idle freezes on frame 1; a step lands instantly with no glide; the glow does not pulse.

### Prop placement (DRESS-01/03/04)
- **Sparse: ~8–12 props per floor.**
- **A curated category table** splits the 54 props into **wall-mounted** (banners, wall torches, sconces, braziers, hanging chains, cobwebs, hanging vines, shackles, …) and **floor** props (barrels, crates, sacks, bones, rubble, mushrooms, puddles, slime, rat, …). Wall props go only on wall cells that border a walkable cell (so they are ever seen); floor props go on walkable cells.
- **Light depth weighting:** shallow floors lean to barrels/crates/mushrooms; deep floors lean to bones/skulls/chains. Deterministic: same seed + depth → identical dressing, always.
- **Blood props (`blood_pool`, `blood_drops`) are kept but rare** (family-friendly tone rule is "no gore", not "no grit").
- Never on a square holding a feature, the stairs, or the party (DRESS-03) — and never on the party's arrival square at floor start. Props respect fog (`seen`) and the 57-04 darkness render window (`inViewWindow`/`mapViewRadius` via the bridge).

### Dimming & legibility (DRESS-02)
- **Floor props ~35% opacity**, drawn beneath the feature and party layers, so encounter icons stay unmistakable.
- **Wall props ~85% opacity.**
- **Props drawn at ~60% of a square** (feature icons are 75%) — size alone signals "not an encounter".
- **Lazy-load the 54 images after the first map paint** so cold start does not grow (Phase 60 measures it against `docs/PERF-BASELINE.md`).

### Settings (DRESS-05)
- **A "Set dressing: On / Off" row in the Settings sheet, default On**, persisted in the same settings store as Sound (`src/browser/settings.js`, `ddr.settings.v1`), independent of the audio toggle.
- **When Off:** nothing is drawn AND the 54 images are never loaded.
- **No separate party-animation toggle** — the OS reduced-motion preference already freezes it.

### Claude's Discretion
- The exact per-prop category/weight table and the placement algorithm (as long as it is pure, seeded from the shell-derived stream, total/deterministic, and pinned by tests).
- Whether props draw in `draw()` via a module-provided layer function or as a pre-rendered per-floor layer, as long as no new body grows inside `draw()`/`paint()` (modularity gate: logic in `src/browser/` modules, thin call sites).
- The exact sprite element structure and how its frames are sheeted (CSS `steps()` over individual PNGs vs a composed strip), as long as only the shipped `icons/optimized/party_*` art is used.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `icons/optimized/`: `party.png`, `party_idle_1..4.png`, `party_step_1..4.png`, and 54 `set_dungeon_*.png` (already present; only `icons/optimized/` ships in `www/`).
- `src/browser/icons.js`: `PLAYER_MARKER_ICON = "party"`, `preloadIcons(basePath)`, `featureKeyForCell`, `drawFeatureIcon(ctx, img, dx, dy, size, dir, scale)`; bridged as `window.__mzIconsApi`.
- `mazeworld.html` `draw()` (~L1960+): feature icons drawn via `iconsApi.drawFeatureIcon(..., 0.75)` (~L2171); the party icon via `iconMap[iconsApi.PLAYER_MARKER_ICON]` (~L2182-2190).
- `.mw-party-pulse` (~L374): the DOM ring with `box-shadow:0 0 0 3px #14110c, 0 0 14px 3px rgba(232,201,122,.5)` and `mwglow` animation; positioned by `positionPartyPulse(rect)` alongside `positionCanvas()`.
- `src/browser/settings.js`: `SETTINGS_STORAGE_KEY`, `SETTINGS_DEFAULTS`, `readSettings`, `writeSetting` — Phase 56 added the Sound row the same way.
- Phase 58 (lands before this phase): `src/browser/motion.js` (reduced-motion predicate + durations), `src/browser/cameraGlide.js` (retargetable camera tween), `__mzMotion` / `__mzCameraGlide` bridges.
- Engine read-only surfaces: `engine/maze.js` cells `{ wall, seen, feat }`, `S.floor.px/py`, the stairs feat; `__mzDarkness` (57-04) for the render window.

### Established Patterns
- Modular shell: pure `src/browser/` module + thin call site; every `window.__mz*` via `src/browser/bridge.js` (BRIDGE row + `tools/bridge-doc.mjs --write` in the same commit).
- Shell-derived deterministic randomness (`makeRng(hash(...))`), never the engine stream.
- Stationary camera; the rail/menu/vignette z-ladder (rail 4, menu scrim 5, menu 6, enc-panel 8; the pulse ring z2 inside the viewport).
- Tests: source-assertion + `test/unit/harness/shellSandbox.js`; injectable clocks (Phase 58 fake clock); re-pin never delete; teeth checks after committing, reverted with `git checkout`.

### Integration Points
- `draw()` (party icon removal; prop layer before features), `positionCanvas()`/`positionPartyPulse()` (sprite positioning + glide), `stepWith()`/the `moved` event path (trigger the step cycle), the camera glide (coordination), the Settings sheet (new row), `preloadIcons`/icon loading (lazy dressing load), `.mw-party-pulse` CSS (ring dial-back).

</code_context>

<specifics>
## Specific Ideas

- The user's words (999.1): "Dial back the black circle around the party marker — the party is already highlighted, the ring is too stark."
- The user's words (999.3): props "on walls, or on paths provided they are DIMMED so they are never confused with the real encounter icons. Set dressing only: not interactable, no rules effect, pure ambiance."
- The design project (`claude.ai/design` fed8909e…) has `Mazeworld Party Animation.dc.html` and `Mazeworld Dressing.dc.html` mocks; the SHIPPED art is `icons/optimized/party_*` and `set_dungeon_*` — use those, not the design project's upload names.

</specifics>

<deferred>
## Deferred Ideas

- Interactive / searchable props — a rules feature, out of milestone scope.
- A separate "Animate party" setting — declined (OS reduced motion covers it).
- Dense or depth-scaled prop counts — declined for sparse ~8–12.

</deferred>
