# Phase 4: Mobile Presentation, Controls & Onboarding - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning
**Mode:** mvp — autonomous run (`/gsd-autonomous --defer-uat`). All logic/rendering/controls are buildable + testable now; on-device visual "feel" is deferred UAT (user has a Pixel 7).

<domain>
## Phase Boundary

Make the game feel native and approachable on a phone. Realize the imported **Claude Design "Mazeworld Mobile"** UX — a dark, torch-lit dungeon-ledger redesign — in the REAL app, wired to the existing engine (`engine/*.js` via the browser adapter), NOT a port of the design mockup's throwaway logic. Deliver: mobile-native **tap-to-move touch controls** (with the design's D-pad as a selectable alternate), **DPI-correct + safe-area-aware** canvas rendering locked to portrait, the user's **9 PNG map icons** replacing procedural glyphs, a **character/stat sheet**, a **scrollable Oracle message/combat log**, a **first-run in-context tutorial**, a **settings** screen (sound, haptics, text size, control scheme, confirm-before-quit + diceMode), and **colorblind-safe + scalable** UI throughout. Requirements UX-01…UX-08.

**Also in scope (Phase 1/3 deferred item lands here):** finish routing ALL game domains through the engine adapter in the live page (combat/economy/new-run/camp buttons still call original prototype code) and complete `formatEvents()` narration coverage of the engine's event types — so the mobile UI is driven entirely by `applyAction` + events.

IN SCOPE:
- Dark "torch-lit ledger" visual system from the design (`design/Mazeworld Mobile.dc.html` — the authoritative visual/interaction spec; `support.js`/`ios-frame.jsx` are Claude Design's PREVIEW HARNESS, not game code — do not implement them).
- The design's screens/states realized against real engine data: maze crawl (HUD + pannable fog viewport + controls + Make Camp), character sheet ("THE DOOMED"), gear/inventory, graveyard (functional wiring is Phase 5; Phase 4 builds the presentation shell + tab), the Oracle log (dice-transparency), full-screen combat, death card, character-roll ("THE TABLES DECIDE"), 5-tab bottom nav, marks-legend + camp bottom-sheets.
- Tap-to-move + D-pad alternate; ≥48dp targets; DPR canvas; safe-area insets; 9 PNG icons; tutorial; settings; accessibility (colorblind-safe, text scaling).

OUT OF SCOPE:
- The voice/copy GENERATOR + safety scan + graveyard data persistence wiring — Phase 5 (this phase builds the SHELL/tab and consumes whatever copy exists; Phase 5 supplies the data-driven voice system). The design's embedded sample copy is tone reference only.
- Google Play store assets/signing/submission — Phase 6.
- New gameplay/mechanics/balance changes — none (fidelity to engine is canon).
- Final game name/branding lock + app-ID change — deferred to Phase 6 (see decisions).

</domain>

<decisions>
## Implementation Decisions

### Visual theme & fidelity
- **Adopt the dark "torch-lit ledger" theme** as the app's new visual identity, replacing the light-parchment prototype look (user-confirmed). Palette from the design: grounds `#14110c`/`#080705`/`#1b170f`, frames `#3a3226`/`#6b5c3c`, ink `#e6ddc6`, gold accent `#e8c97a`, muted `#a89c82`/`#c9bda0`, danger red `#e07260`/`#a63a2c`.
- Also **recolor the native status bar** to the dark theme (was set to Style.Light + `#EFE7D6` parchment in Phase 2 `02-04`) — update to dark grounds (`#1b170f`/`#14110c`) with light status-bar text. Splash asset can stay as-is (branded image); the first painted post-splash screen should be the dark theme.
- **Self-host fonts** Press Start 2P (pixel labels/headings) + Courier Prime (mono body) as local `fonts/*.woff2` (latin subset) — the design links Google Fonts CDN, which breaks the offline requirement. Follow the existing self-hosted `@font-face` pattern (Phase 2 already self-hosts Special Elite/Crimson Pro/IBM Plex Mono; add/replace as the dark theme needs).
- **High-fidelity** to the design's layout/palette/components; adapt only where real engine data or Android constraints require.
- **Adopt the design's pannable maze viewport** with fog-of-war, edge vignette, and MARKS/CENTRE overlay controls.

### Controls (UX-01, UX-02)
- **Ship BOTH control schemes: tap-to-move is the DEFAULT, the design's on-screen D-pad is the selectable ALTERNATE** (satisfies UX-01 precisely).
- **Tap model: tap an adjacent (orthogonally reachable) square to step one square.** No tap-anywhere auto-path in v1 (auto-path complicates deterministic turn resolution and can spring traps/encounters unpredictably).
- **All interactive touch targets ≥48dp** with spacing that separates destructive actions (RUN AWAY, CUT LOSSES · ROLL ANOTHER, Clear save) from safe ones — destructive actions styled red (`#e07260`/`#a63a2c`) and given their own row/space (per design), preventing mis-tap deaths (UX-02).
- **Persist the control-scheme choice** (tap vs D-pad) in settings via `window.mzStorage`.

### Icons & canvas rendering (UX-03, UX-08)
- **Use the user's 9 PNG map icons** (`icons/`: chest, crevice, descent, encounter, onewaydoor, party, teleport, trap, wall — 1254×1254) for feature marks + player marker, replacing the prototype's procedural vector glyphs AND the design's Unicode glyphs. Downscale/optimize for mobile (target ~64–128px display size; generate density-appropriate assets; keep source). Map to engine feature cells per STATE's "Provided Assets" note.
- **Keep the DPR-aware `<canvas>`** (`mazeworld.html` already sets `setTransform(dpr,…)`; extend it) for crisp rendering at device DPI (UX-03) — do NOT switch to the design's DOM div-grid (that was a mockup convenience; canvas is more performant + inherently DPI-correct). Adopt the design's viewport FRAMING (pan/recenter/fog/vignette) around the canvas.
- **Colorblind-safe status**: every status conveys via icon + shape + text label, never color alone (e.g. rations = "RATIONS n" + bar + icon; traps = trap icon, not just red). Icon + color, per UX-08.
- **Safe-area/notch aware**: pad top HUD and bottom tab/controls with `env(safe-area-inset-*)`. Portrait lock already configured (Phase 2 `@capacitor/screen-orientation`).

### Onboarding & settings (UX-04, UX-05, UX-06, UX-07)
- **Tutorial (UX-06): first-run contextual coach-marks** overlaid on the real first floor (move here / that mark is a trap / descend there / you're starving), dismissible, shown once (persisted `mazeworld.tutorialSeen` flag via mzStorage). No wall of text. The design's MARKS legend + Oracle "tap a line to see the dice that did it" reinforce learning.
- **Settings (UX-07): the 5 required — sound, haptics, text size, control scheme, confirm-before-quit — PLUS diceMode** (on tap / always / never, from the design's config). Fog-of-war stays ON (not user-facing); the design's raw cellSize slider is folded into the text-size setting rather than exposed separately.
- **Character sheet (UX-04) + Oracle log (UX-05) + graveyard via the design's 5-tab bottom nav** (Maze / Sheet / Gear / Log / Graveyard). Sheet shows the rolled adventurer's class, race, stats, kit/gear, skills. Log is the scrollable Oracle with dice transparency.
- **Text scaling (UX-08): rem-based S/M/L in-app setting** driving all UI type, and honor the OS font scale within sane bounds.

### Engine routing completion (deferred Phase 1/3 item)
- Route the live page's combat, economy/store, new-run, and camp inputs through the engine adapter (`applyAction`), replacing the remaining original-prototype code paths, and complete `formatEvents()` coverage of the engine's event types so the mobile UI is fully engine-driven and deterministic.

### Game name (branding) — UPDATED 2026-09-08
- **The product name is LOCKED to "Delve, Die, Repeat"** (user decision 2026-09-08, superseding the earlier "keep Mazeworld placeholder" note). A parallel `/gsd-quick` already renamed the app identity + visible chrome and committed it (`f81942f`): `appId com.darktierstudios.delvedierepeat`, launcher/name "Delve, Die, Repeat", `package.json` name `delve-die-repeat`, MainActivity package moved, `mazeworld.html` chrome updated.
- Phase 4 UI must reference the display name from a **single centralized constant** (in modular `src/`), never hardcoded across files. Point that constant at "Delve, Die, Repeat".
- **"Mazeworld" survives as the in-fiction WORLD/setting name** (the Maze Master, Wilmsry, wilmst currency, the lore) — rename the product, not the universe.

### Folded-in rename scope (user decision 2026-09-08 — Phase 4 owns this)
The rename's deferred deep work is folded INTO Phase 4 (it's the natural home — Phase 4 rebuilds the UI onto modular sources + touches storage):
- **Persistence-key rename `mazeworld.*.v1 → ddr.*.v1`** (the ~3 keys `delve`/`graveyard`/`best`) — do it in the modular `src/browser/*` (storage.js + engineAdapter.js call sites), update the ~8 test files that assert the keys, and keep it verified. Greenfield/pre-launch → NO migration shim needed (user confirmed no save-orphaning concern).
- **Content-string cleanup**: remove residual product-name "Mazeworld" from user-facing modular sources where it means the PRODUCT (keep it where it means the in-fiction world). Canonical content lives in `content/*.js` / `engine/` / `src/`, not the prototype's inline tables.
- **`test:quick` fixed** (commit `c5dcaf7` — Node 22 needs `**/*.test.js` globs, not bare dir args). Both `npm test` (372) and `npm run test:quick` (283) green.
- Note: the build still ships the prototype (`build-www.mjs` makes `www/index.html` = `mazeworld.html` + import map); moving the real UI off the prototype onto modular sources IS the core Phase 4 move — so the deep renames land once, on the real sources.

### Claude's Discretion
- Exact module/file layout for the mobile presentation layer, the canvas viewport/pan implementation, coach-mark mechanism, settings persistence schema, icon downscaling pipeline, and how screens are structured as views/components — all at Claude's discretion, grounded in the design file and existing `src/browser/` patterns.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mazeworld.html` (3500 lines) — the live game UI: `<canvas id="maze" 640×640>`, DPR-aware transform already present (`setTransform(dpr,0,0,dpr,0,0)` ~line 1330), `draw()` renders grid/fog/procedural feature glyphs (~1345–1420), existing `.dpad` (40px — must grow to ≥48dp), character/graveyard panels, keydown + dpad handlers.
- `src/browser/engineAdapter.js` — async boot, `formatEvents`, best-depth + graveyard via `window.mzStorage`; movement/camp already routed through the engine; combat/economy/new-run NOT yet routed (this phase finishes that).
- `src/browser/storage.js` — `window.mzStorage` async abstraction (native Preferences / localStorage fallback, per-key write queue) — reuse for settings + tutorialSeen flags.
- `src/browser/nativeChrome.js` — `decideBackAction`, `flushOnBackground`, status-bar config (recolor for dark theme here).
- `tools/build-www.mjs` — assembles `www/` from `["engine","content","src"]`; rewrites relative import specifiers to add `.js`. **Phase 4 adds any new presentation dirs to `copySourceDirs()`** and includes new fonts/icon assets. **NOTE: Phase 5 also touches this file — coordinate.** After any `npx cap sync`, run `node tools/pin-jdk.mjs` (sync wipes the JDK pin).
- `icons/` — the 9 PNG map icons (user-provided). `fonts/` — self-hosted woff2 pattern.
- `design/Mazeworld Mobile.dc.html` — the imported design (authoritative visual/interaction spec). `design/support.js` + design's `ios-frame.jsx` = Claude Design preview harness (NOT to implement).

### Established Patterns
- Engine is pure/deterministic behind `applyAction(state, action) → {state, events}`; presentation must stay UI-only and never mutate `GameState.rngState` off-band. Log/flavor text stays out of the parity-compared state (or seeded).
- Zero-dependency, no bundler; ESM via import-map in `www/`. Tests are `node:test` (372 currently green — must stay green).
- Storage writes are fire-and-enqueue; boot/reads are awaited.

### Integration Points
- Canvas render loop + input handlers in `mazeworld.html`; engine adapter dispatch; `window.mzStorage` for settings/flags; `tools/build-www.mjs` asset pipeline; native status-bar/orientation via existing `nativeChrome.js`.

</code_context>

<specifics>
## Specific Ideas
- The imported design (`design/Mazeworld Mobile.dc.html`) is the target — realize its screens, palette (dark torch-lit ledger), typography (Press Start 2P + Courier Prime), and signature interactions (dice-transparency log, pannable fog maze, ranked graveyard, deadpan tone) faithfully, wired to the real engine.
- Dice transparency ("TAP A LINE TO SEE THE DICE THAT DID IT") is a signature identity feature — surface the roll behind each log/combat line; gate via the diceMode setting.
- The 9 user PNG icons replace ALL procedural/glyph feature marks.
- Sessions target 5–10 min; controls must feel responsive and native on mid-range phones.

</specifics>

<deferred>
## Deferred Ideas
- Voice/copy GENERATOR + family-friendly safety scan + graveyard DATA persistence wiring — Phase 5 (Phase 4 builds the graveyard/log presentation shell; Phase 5 fills the voice system + re-fetch-on-open persistence).
- Final game name/branding lock + app-ID change (rename likely; candidates researched) — Phase 6.
- Google Play store listing assets, signing, Data Safety/IARC, submission — Phase 6.
- Difficulty feel-tuning (floor 30–50+) — Phase 3 deferred UAT.
- Haptics polish beyond the settings toggle (rich per-event haptics) — optional, not required for MVP.

</deferred>
