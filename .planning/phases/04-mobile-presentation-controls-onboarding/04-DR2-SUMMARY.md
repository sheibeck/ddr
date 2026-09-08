---
phase: 04-mobile-presentation-controls-onboarding
plan: DR2 (device-review revision round 2, ad hoc — not a numbered PLAN.md)
subsystem: ui
tags: [icons, buttons, dpad, tab-bar, overlay, combat, title-screen, device-review]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR1: over-map .mw-overlay (#enc-panel), hasActiveEncounter(), D-pad-only MAP screen, 48/60/72 cell sizes"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-06: PNG icon pipeline (icons.js), pannable DPR viewport, tap/dpad control seam"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-05: dark torch-lit theme tokens, GAME_NAME constant, build-www.mjs asset-copy pattern"
provides:
  - "drawFeatureIcon icon-size factor bumped 0.6 -> 0.94 (icons fill ~the whole cell instead of 60%)"
  - "Mock-matched chunky button chrome (2px border + hard 0/4px offset box-shadow) applied to the base button rule, .primary, .small, .dpad button, .mw-chip — D-pad, MAKE CAMP, MARKS/CENTRE, MOVE ON, combat actions, and the bottom-nav tabs are all visibly taller/chunkier"
  - "D-pad arrows: one fixed 28px size on all four buttons (was a 13px glyph-font size, effectively invisible)"
  - "Bottom-nav .mw-tab.active: gold text + gold top-border (already color-correct from 04-05; strengthened with font-weight/letter-spacing for unambiguous salience)"
  - "The over-map .mw-overlay (renderEncounter()/hasActiveEncounter()) now shows for EVERY feature-tile landing (trap/chest/teleport/one-way/climb/gorge/descend/non-combat encounter-dot outcomes), not just combat/store/dead/won — via a new beats-synthesis step in window.move=engineMove(), reusing the existing S.beats/'Move on' machinery untouched"
  - "HIT -N WP / MISS badge in the combat overlay, hooked to playerStrike()'s existing hit/dmg resolution (C.lastStrike)"
  - "#mw-title-screen: a start/title gate (splash art + GAME_NAME + ENTER/RESUME) shown over the app on launch, dismissing into the already-booted game"
affects: [04-07, 04-08, 04-09, 04-10, 04-11]

tech-stack:
  added: []
  patterns:
    - "beatsTitleFor(events) + a FEATURE_EVENT_TITLE lookup table synthesize the SAME {groups:[{title,tone,lines}],i,action} shape the classic (now-dead) beginEvent()/newBeat() used to build, entirely from engineAdapter.js's own formatEvents() output — renderEncounter()/hasActiveEncounter() needed zero changes, because state.beats was already part of the engine's GameState shape (engine/state.js) and already presentation-transient (engine/saveState.js's rehydrate()/validateSave() always reset/omit it, never round-tripping it through a save)"
    - "C.lastStrike as a small per-turn array on the combat object (S.combat), cleared at the top of every action (Strike/Potion/Flee) and populated only by the two common Strike outcomes (miss, plain hit) — the badge only ever reflects the CURRENT turn's Strike, never a stale one from a prior turn or a non-Strike action"

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR2-SUMMARY.md
  modified:
    - src/browser/icons.js
    - mazeworld.html
    - tools/build-www.mjs

key-decisions:
  - "The classic (pre-04-DR1) move()/beginEvent()/springTrap()/openChest()/teleport() functions in mazeworld.html's top <script> are DEAD CODE for actual gameplay — window.move is unconditionally overwritten by the engine-routed engineMove() in the trailing module script (01-07/03-03), so the D-pad/keydown handlers never call the classic move() at all. This was the root cause of the device-review complaint ('overlay only shows for combat'): the classic move() DID call beginEvent() for every feature tile, but that code path is unreachable. The fix lives entirely in engineMove(), not in the classic script."
  - "HIT/MISS badging only covers the two common Strike outcomes (miss, and a normal resolved hit) inside the attack loop — the rare Death-touch instant-kill and Con-Artist-opening-does-nothing branches are NOT separately badged (they keep their own distinct say() narration lines only). Documented as a deliberate scope-limit rather than an oversight, to avoid touching crit/multi-attack-sensitive branches of playerStrike() for a purely cosmetic indicator."
  - "The title screen's RESUME visibility is decided by checking window.mzStorage for the ddr.delve.v1 save key BEFORE boot() runs (not after), matching engineAdapter.js#boot()'s own documented behavior that a fresh boot with no prior save never itself persists one — so 'before' and 'after' are equivalent in practice, but 'before' is the clearer invariant to read."
  - "ENTER always starts a brand-new run (via the same engine-routed window.newGame() the death-card's 'Roll another delver' button uses) even when a save exists underneath — matching the plan's literal 'ENTER (start a new run)' wording. This can discard an in-progress run if tapped by mistake; RESUME exists specifically to avoid that for a returning player who wants to continue. Both boot sequences (classic + engine-routed) are otherwise completely untouched; the title screen is a pure post-boot presentation gate, never a fork in the boot logic itself."
  - "state.beats (used by the new overlay-extension code) is never round-tripped through save/load (engine/saveState.js's rehydrate()/validateSave() both always reset or omit it) — setting it from the presentation layer is therefore not a mutation of anything the 'presentation must never mutate GameState.rngState' constraint is protecting."

patterns-established:
  - "Any future engine event type that should headline the over-map overlay (rather than just append a log line) only needs one more entry in mazeworld.html's FEATURE_EVENT_TITLE map — no renderEncounter()/hasActiveEncounter() changes required."

requirements-completed: []

duration: ~90min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR2: Device-review round 2 polish Summary

Applied the user's second live device-review pass (after seeing the DR1 build on the Pixel 7): visual polish (bigger icons, chunky mock-matched buttons, big equal D-pad arrows, confirmed/strengthened active-tab highlight), feedback polish (the over-map overlay now fires on every feature-tile landing instead of only combat, plus a HIT/MISS strike badge), and a new title/start screen with splash art and ENTER/RESUME. Committed as three atomic commits in the requested order (visual first).

## What Changed

### Group 1 — Visual (`d8c93ba`)

1. **Icons ~2x bigger** (`src/browser/icons.js`): `drawFeatureIcon`'s icon-draw factor bumped from `size * 0.6` to `size * 0.94` — feature icons now fill nearly the whole cell (small ~3%-per-side inset) instead of looking small inside the DR1-enlarged 48/60/72px cells. No test asserted the old `0.6` factor (confirmed via search), so no test needed updating.

2. **All 8 feature icons verified.** Every PNG in `icons/optimized/` (chest, crevice, descent, encounter, onewaydoor, party, teleport, trap, wall) decodes as a valid 144×144 RGBA PNG (`file` command confirmed each individually). The `featureKeyForCell` mapping (dot→encounter, tele→teleport, one→onewaydoor, trap→trap, chest→chest, climb→wall, gorge→crevice, exit/gate→descent) is complete and already unit-tested (`test/unit/tutorial.test.js`). **No broken/blank icon found — all render correctly.**

3. **Taller, mock-matched buttons** (`mazeworld.html`): new `--mw-btn-border`/`--mw-btn-shadow` CSS custom properties (literal hex matching `design/Mazeworld Mobile.dc.html`'s own button colors, `#6b5c3c`/`#0d0b08`) applied to the base `button` rule (2px border, `0 4px 0` hard offset shadow, `14px 16px` padding, `min-height:48px`), `.primary` (gold-shadow variant), `.small` (bumped from 5px/9px to 13px/14px padding), `.dpad button` (own chunky treatment), and `.mw-chip` (MARKS/CENTRE, padding bumped 6px→9px vertical). This covers the D-pad, MAKE CAMP, MARKS/CENTRE, MOVE ON (`.small`/`.primary` ternary), and all combat action buttons (Strike/Potion/Flee) without any HTML/JS changes — they all inherit from the updated base rules.

4. **Fixed tiny/mismatched D-pad arrows**: `.dpad button` now sets a fixed `font-size:28px` (was inheriting the base button's 13px), so all four arrows (↑←↓→) render at one large, equal size regardless of glyph-font metrics.

5. **Bottom-nav active highlight**: Inspection showed `.mw-tab.active` already matched the mock's gold-text + gold-top-border treatment color-for-color (`color:var(--ditto)` = `#e8c97a`, `background:#241d12`, `border-top-color:var(--ditto)` — literal matches to the mock's `t.style`). Strengthened with `font-weight:700`/`letter-spacing:.08em` so the signal reads unambiguously, and bumped `.mw-tab` height (`min-height:48px`→`56px`, padding `15px 0 13px`→`18px 0 16px`) per "give the bottom nav-tab items more height" (with `.mw-screens`' reserved bottom clearance bumped 88px→96px to match).

### Group 2 — Feedback (`8a1d95e`)

1. **Encounter overlay on every feature landing.** Root cause: DR1's `hasActiveEncounter()`/`renderEncounter()` over-map-overlay machinery was already correct and complete — but the classic script's `move()`/`beginEvent()`/`springTrap()`/etc. functions that used to populate `S.beats` are **dead code for actual gameplay**. `window.move` is unconditionally overwritten by the engine-routed `engineMove()` (01-07/03-03), so the D-pad/keydown handlers never reach the classic `move()` at all — only `state.combat`/`state.store`/`state.dead`/`state.won` (set directly by engine rule modules) ever made `hasActiveEncounter()` true. Fixed entirely inside `engineMove()`: when a dispatch produces narration (`html.length > 0`, i.e. more than a silent "moved") and did NOT already claim the overlay via combat/store/dead/won, it now synthesizes the same `{groups:[{title,tone,lines}],i,action}` shape via a new `beatsTitleFor(events)` helper + `FEATURE_EVENT_TITLE` lookup table, built directly from `formatEvents()`'s own narration (the same lines the Oracle log already shows). `renderEncounter()`/`hasActiveEncounter()`/"Move on" needed **zero** changes — they already knew how to show and dismiss this shape.
2. **HIT/MISS indicator on Strike.** `playerStrike()` now tracks `C.lastStrike` (an array of `{hit, dmg, crit}` per attack), cleared at the top of every Strike/Potion/Flee call. `renderEncounter()`'s combat branch renders a `HIT −N WP[· CRIT]` or `MISS` badge (`.mw-strike-result`/`.mw-badge-hit`/`.mw-badge-miss`, same chunky-badge chrome as Group 1's buttons) directly under the encounter head. Covers the two common Strike outcomes (miss, plain hit); the rare Death-touch instant-kill and Con-Artist-opening-does-nothing branches are not separately badged (documented deviation — see Deviations below).

### Group 3 — Title screen (`d1733e3`)

Added `#mw-title-screen`: a full-screen gate (splash art `assets/ddr_splash.png` + `GAME_NAME` heading + tagline + ENTER/RESUME buttons) shown over the app on launch, in the dark torch-lit style. **ENTER** always starts a brand-new run (reusing the exact same engine-routed `window.newGame()` the death-card's "Roll another delver" button already calls). **RESUME** is shown only when a `ddr.delve.v1` save existed at launch (checked via `window.mzStorage` before `boot()` runs) and simply dismisses the gate, since both boot sequences (classic + engine-routed) already silently rehydrate the saved run underneath it — neither boot sequence was touched. `tools/build-www.mjs` gained `copySplash()` (mirrors `copyFonts()`/`copyIcons()`'s exact pattern) to copy `assets/ddr_splash.png` into `www/assets/ddr_splash.png` for the Android build.

## Deviations from Plan

### Auto-fixed / scoped issues

**1. [Rule 3 — blocking discovery] Classic move()/beginEvent() is dead code**
- **Found during:** investigating why the overlay "only shows for combat" per the user's report, despite 04-DR1's over-map-overlay machinery appearing complete on inspection.
- **Issue:** `window.move` is overwritten by the engine-routed `engineMove()` in the trailing module script; the classic script's own `move()` (which called `beginEvent()` for every feature tile) is never invoked by the D-pad/keydown handlers.
- **Fix:** Extended `engineMove()` itself (not the dead classic code) to synthesize the beats-overlay shape from engine events — see Group 2 above.
- **Files modified:** `mazeworld.html`
- **Commit:** `8a1d95e`

**2. [Scope-limit, documented] HIT/MISS badge does not cover every playerStrike() branch**
- Death-touch instant-kill and the Con-Artist "first blow does nothing" branch are not separately badged (they retain their own distinct `say()` narration only). This keeps the change minimal and avoids touching crit/multi-attack-sensitive code paths for a cosmetic indicator. Full engine-routed combat (04-07/04-08) is the natural place to revisit this with a cleaner event-driven design.

None of these required a checkpoint or user decision — both are documented, low-risk scope calls consistent with Rule 1/Rule 3 (bug-adjacent discovery, blocking-issue fix) and the "Claude's Discretion" latitude already granted in 04-CONTEXT.md.

## Per-Icon Render Status

| Icon | File | Status |
|---|---|---|
| Encounter dot | `icons/optimized/encounter.png` | OK — 144×144 RGBA, decodes, mapped from `dot` |
| Teleport | `icons/optimized/teleport.png` | OK — 144×144 RGBA, decodes, mapped from `tele` |
| One-way door | `icons/optimized/onewaydoor.png` | OK — 144×144 RGBA, decodes, mapped from `one` |
| Trap | `icons/optimized/trap.png` | OK — 144×144 RGBA, decodes, mapped from `trap` |
| Locked box | `icons/optimized/chest.png` | OK — 144×144 RGBA, decodes, mapped from `chest` |
| Wall/climb | `icons/optimized/wall.png` | OK — 144×144 RGBA, decodes, mapped from `climb` |
| Crevice | `icons/optimized/crevice.png` | OK — 144×144 RGBA, decodes, mapped from `gorge` |
| Descent | `icons/optimized/descent.png` | OK — 144×144 RGBA, decodes, mapped from `exit`/`gate` |
| Player marker | `icons/optimized/party.png` | OK — 144×144 RGBA, decodes (not a feature icon, `PLAYER_MARKER_ICON`) |

All 9 render at the new `size * 0.94` scale factor.

## Verification

- `npm run build:www` — succeeds after every group's commit (verified independently at each of the 3 checkpoints); `www/assets/ddr_splash.png` present after Group 3.
- `npm test` — **451/451 green** after every group's commit.
- `npm run test:quick` — **362/362 green** after every group's commit.
- No headless-DOM/visual harness exists in this project (consistent with prior 04-* plans' own verification notes) — the on-device "feel" of the taller buttons/badge placement/title-screen splash framing is unverified here and should be confirmed on the Pixel 7 build the orchestrator produces next.

## Known Stubs / Threat Flags

None. This was presentation-layer (DOM/CSS/JS UI wiring) work reusing existing engine seams (`window.move()`/`dispatch()`, `window.mzStorage`, `window.newGame()`) — no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- FOUND: src/browser/icons.js (`iconSize = Math.round(size * 0.94)`)
- FOUND: mazeworld.html (`--mw-btn-border`/`--mw-btn-shadow`, `.dpad button{font-size:28px}`, `.mw-strike-result`/`.mw-badge-hit`/`.mw-badge-miss`, `FEATURE_EVENT_TITLE`/`beatsTitleFor`, `#mw-title-screen`, `initTitleScreen`)
- FOUND: tools/build-www.mjs (`copySplash`)
- FOUND: www/assets/ddr_splash.png (post-build)
- FOUND commit `d8c93ba` (feat(04-dr2): visual polish — bigger icons, chunky mock-matched buttons, taller controls)
- FOUND commit `8a1d95e` (feat(04-dr2): show the encounter overlay on every feature landing + HIT/MISS strike badge)
- FOUND commit `d1733e3` (feat(04-dr2): add title/start screen with splash art + ENTER/RESUME)
