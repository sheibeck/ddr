---
phase: 59-party-animation-dungeon-set-dressing
verified: 2026-09-23T01:00:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD 82a0f88); device feel deferred to the Phase 60 batch
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "ANIM-01/03 (Pixel 7): the standing party gently cycles its idle frames (about one breath a second) and reads as the highlight on its own; the old black ring is gone, leaving only a soft warm glow"
  - "ANIM-02 (Pixel 7): each step slides the party into the next square with a quick step animation and settles back to idle; fast tapping never stutters or lags; at a map edge the party and the map move as one; the marker disappears under the encounter panel with no flicker"
  - "ANIM-02 (Pixel 7): stairs and teleports put the party on its new square at once, with no slide"
  - "DRESS-01..03 (Pixel 7): each floor shows a handful of dim props on paths and brighter ones on walls; none is mistaken for an encounter, chest or crevice; no prop covers the stairs, a feature or the party; props appear only where the map is revealed and inside the dark window"
  - "DRESS-05 (Pixel 7): Settings → Set dressing Off clears every prop at once and On brings them back; the Sound setting is unaffected"
  - "DRESS-04 / PERF (Pixel 7): cold start with Set dressing On shows the map as fast as before, with props a moment after; closing and reopening mid-floor shows the props in the same places"
  - "Reduced motion (Pixel 7, 'Remove animations' on): the idle art is frozen on frame 1 with a steady glow; each step lands instantly; the Set dressing flip still redraws immediately"
  - "TalkBack (Pixel 7): the party marker and the props add nothing to what TalkBack announces on the map"
gaps: []
---

# Phase 59 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, standing 2026-09-14 ruling)

Goal-backward check of the phase goal: *the party marker reads as alive instead of a static token, and the floors carry ambient props instead of empty corridors — both landing in the shared canvas/icon pipeline as pure presentation, never touching a rule.*

Five plans. Wave 1 was two parallel worktrees: 59-01 (the `partySprite.js` core) and 59-02 (the `dressing.js` core, `icons.js#loadIconSet`, the `dressing` setting, and the DRESS-04 ledger). Both merged cleanly. Waves 2–4 (59-03 sprite in the shell, 59-04 step glide, 59-05 dressing wiring plus the phase gate) ran sequentially on the main tree. All 15 decisions in `59-CONTEXT.md` were accepted as recommended. One post-planning ruling was confirmed by the user: placement uses only floor data that never changes, and features are excluded at draw time, so a prop may appear once its feature resolves.

## Evidence (orchestrator re-run at HEAD)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | Idle cycle standing, step cycle moving, settle to idle; the dark ring dialled back | 59-03 adds `#mw-party-sprite`, a DOM sprite of 8 stacked frames, beside `#mw-party-pulse`. The idle loop (`mwpartyidle`, about 1.12 s) animates opacity only. `draw()` no longer paints the party at all. The ring's hard 3px dark box-shadow is gone; a .25 halo stays, and the canvas's old under-party glow moved onto the ring at .28 so it travels with the marker. The sprite and ring sit exactly on `positionCanvas()`'s device-pixel-rounded origin at any dpr. 59-04 adds `glideParty`: a roughly 200 ms glide per step that plays the step frames once and matches the camera glide's eased progress frame for frame. Jumps land instantly. Tests: `party-sprite.test.js`, `party-sprite-shell.test.js` and `party-glide.test.js`. |
| 2 | Scattered props from the `set_dungeon_*` set, dimmed on walkable squares, full strength on walls | `dressing.js` holds all 54 props (15 wall, 39 floor, checked against the shipped PNGs) with light depth weighting. Blood props, coins/gems and the pit are rare. 8–12 props per floor, drawn at ~35% on floors and ~85% on walls, at 0.6 of a square. 59-05 adds exactly one `draw()` statement, after the border and before the feature loop. Tests: `dressing.test.js` and `dressing-shell.test.js` (1)–(2), on the real `draw()`. |
| 3 | A prop never sits on a feature, the stairs or the party | Draw-time exclusion of features, stairs, the party and the (1,1) start, plus fog and the 57-04 dark render window. A pinned seed shows a floor prop reappearing once its feature resolves, which the user accepted. Tests: `dressing-shell.test.js` (3)–(5). |
| 4 | Same seed and depth, identical dressing; dressing never changes a run | Placement draws only from `derivedRng(seed, "dressing", depth)`, a pure import from `engine/rng.js`, never the engine's main stream. `dressing-determinism.test.js` runs a real 40-move scripted walk that serializes byte-identically with and without dressing and never touches `state.rngState`. `dressing-shell.test.js` (8) covers repeat draws and a full save/reload. `phase59-gates.test.js` (4) checks that nothing under `engine/` or `content/` imports from `src/browser/`. |
| 5 | Set dressing can be turned off, independent of audio | The Settings row "Set dressing" defaults On; it is the fifth settings field, tolerantly loaded, and independent of `sound`. When Off, nothing is drawn and the images never load. The art loads lazily, one rAF plus `setTimeout(0)` after `__mzClassicBoot()`. Tests: `settings.test.js` and `dressing-shell.test.js` (6), (7), (10), (11). |
| — | Gates | `npm test` **3886 / 0** (3778 at phase start, +108 across five plans). `npm run build:www` exit 0, with all 54 `set_dungeon_*` PNGs in `www/icons/optimized/`. `git diff --stat f220718..HEAD -- engine/ content/ test/parity/` is **empty**. Master hash `a1f4d0dc…` unchanged. `package.json`/lock untouched. `bridge-registry.test.js` 10/10, with new rows `__mzPartySprite` and `__mzDressing`. `phase59-gates.test.js` pins the modularity and presentation gates durably. |

## Notes the reader should have

- **A latent bug in Phase 58's `cameraGlide.js` (found by 59-01), recorded rather than fixed.** `step()` reads its own `run` right after calling the apply callback, so a synchronous `cancel()`/`finish()` from inside that callback throws. `createPartySprite` guards its own case with `inOnPoint`/`endGlide`, and `party-glide.test.js` adds two regression tests. The orchestrator checked the shipped camera path: `applyCam`, the glide's only apply callback, only sets `cam` and calls `positionCanvas()`, so no shipped path can reach the throw. A one-line hardening in `cameraGlide.js` (capture `run` before `apply`, or re-check it after) is a follow-up, not a gap.
- **A test-count baseline quirk.** The phase base `f220718` predates Phase 58's execution, so "a test file never shrinks" checks against it cannot see Phase 58-created files such as `reduced-motion.test.js`. From 59-05 the baseline is the Phase 58 close commit `25136c8`. No file shrank.
- **The AAB footprint story for Phase 60.** The 54 dressing images and 9 party frames were committed before the `v1.7` tag, and v1.7's build already copied `icons/optimized/` whole. So the v1.7→v1.8 AAB delta will be about the 30 clips plus code, not the images. Phase 60's plans record this.
