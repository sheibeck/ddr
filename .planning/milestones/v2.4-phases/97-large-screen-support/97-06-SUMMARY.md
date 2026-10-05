---
phase: 97-large-screen-support
plan: 06
subsystem: tooling
tags: [layout, cdp, headless-chrome, verification, large-screen]
requires: [97-01, 97-02, 97-03, 97-04, 97-05]
provides:
  - "tools/layout-check.mjs (npm run layout:check): exports PROFILES, BOUNDARY_PROBES, SCENES, rectsIntersect; flags --chrome --port --devtools-port --out --no-shots --only --json --keep-profile; exit 0 / 1 / 2"
  - "test/unit/layout-check.test.js"
  - ".gitignore entry tools/layout-check-output/"
affects: []
tech-stack:
  added: []
  patterns: [page-side functions serialised with toString(), engine states built in node and injected through window.__mzState.set + paint(), one Chrome for the whole run switched by Emulation.setDeviceMetricsOverride]
key-files:
  created:
    - tools/layout-check.mjs
    - test/unit/layout-check.test.js
  modified:
    - mazeworld.html
    - package.json
    - .gitignore
    - test/unit/layout-shell.test.js
  deleted:
    - tools/letterbox-check.mjs
requirements-completed: [SCREEN-03, SCREEN-04, SCREEN-05, SCREEN-06]
status: complete
completed: 2026-10-04
---

# Phase 97 Plan 06: The CDP layout check Summary

`npm run layout:check` drives one headless Chrome through 12 screen shapes x 15 scenes plus 7 threshold probes, and exits 0 against the finished layout: `layout-check: 12/12 profiles passed, 7/7 boundary probes passed`.

## What was built

- **tools/layout-check.mjs** (node built-ins, the global WebSocket/fetch and the repo's own modules; no new package, no `--dump-dom`):
  - **Profiles:** phone-portrait 412x915, phone-landscape 915x412, phone-landscape-360 800x360, tablet7-portrait 600x960, tablet7-landscape 960x600, tablet10-portrait 800x1280, tablet10-landscape 1280x800, foldable-folded 411x797, foldable-unfolded 841x701, foldable-unfolded-portrait 701x841, chromebook-window 1366x768 and chromebook-half 683x768 (the last two with `mobile:false`). Each carries its expected class; every class appears at least twice. `screenWidth/screenHeight` equal the window so the page's smallest-width test sees the device.
  - **Scenes (15):** title, roller, map, map-card, settings, hero, gear, oracle, dead, encounter, combat, combat-turn, store, store-turn, camp. Settings are seeded before each boot (`compete:false`, arrows, `nameWelcomed`, and the bundled version in `ddr.notes.seen.v1` so the what's-new sheet stays shut). Combat and store states are built in node (`newRun`, `startCombat`, `applyAction fight`, `openStore`) and injected.
  - **Per-scene checks:** document and auto/scroll-container horizontal overflow (the two sideways strips excepted), clipped controls (outside the window, cut by a hidden-overflow ancestor, below the window with no scroller), scrollers whose own box leaves the window, page exceptions, any request that leaves the machine, wrong `html[data-mw-layout]`, and the per-class shape rules (app spans the window, tab bar along the bottom or in a left rail, medium Hero at most 640 and centred, short HUD one row, expanded map and a 360-560 Hero pane side by side, panel/card/camp right of the map, map reaching the stage edge with nothing up, pad clear of a docked card, short combat actions on screen, Settings Screen row only under 600 smallest side).
  - **Rotation round-trip (SCREEN-05):** mid-combat and mid-store the window is turned (no reload) and back; `S.combat` / `S.store` byte-identical after each turn, panel still up with its control, tab unchanged, class equal to `layoutClassFor(height, width)`, and the panel's box back within 1 px.
  - **Boundary probes:** 915x479/480, 599x900/600x900, 839x900/840x900, 840x479, all agreeing with `layoutClassFor`.
  - One PNG per scene (plus `-turned` for the two round-trips) saved to the gitignored `tools/layout-check-output/`: 180 files per run.
- **test/unit/layout-check.test.js:** 5 tests (profiles and probes agree with `layoutClassFor`, scene list, `rectsIntersect`); importing the module starts nothing.
- `package.json` script `layout:check`; `.gitignore` line pair; `tools/letterbox-check.mjs` removed with `git rm`.

## Final result

```
| Profile                    | Size      | Class    | Scenes | Verdict |
| phone-portrait             | 412x915   | compact  | 15/15  | PASS    |
| phone-landscape            | 915x412   | short    | 15/15  | PASS    |
| phone-landscape-360        | 800x360   | short    | 15/15  | PASS    |
| tablet7-portrait           | 600x960   | medium   | 15/15  | PASS    |
| tablet7-landscape          | 960x600   | expanded | 15/15  | PASS    |
| tablet10-portrait          | 800x1280  | medium   | 15/15  | PASS    |
| tablet10-landscape         | 1280x800  | expanded | 15/15  | PASS    |
| foldable-folded            | 411x797   | compact  | 15/15  | PASS    |
| foldable-unfolded          | 841x701   | expanded | 15/15  | PASS    |
| foldable-unfolded-portrait | 701x841   | medium   | 15/15  | PASS    |
| chromebook-window          | 1366x768  | expanded | 15/15  | PASS    |
| chromebook-half            | 683x768   | medium   | 15/15  | PASS    |
layout-check: 12/12 profiles passed, 7/7 boundary probes passed
```

A run takes about eight minutes on this machine. Screenshots are on disk only: `tools/layout-check-output/` in the worktree (gitignored, gone with the worktree) and a copy at `C:\Users\Dell\AppData\Local\Temp\claude\C--projects-mazeworld\cb110b10-e59f-4b54-a735-193b936ef4d7\scratchpad\layout-shots\`. After a merge, `npm run layout:check` recreates `tools/layout-check-output/` in the main repo.

## Screenshots looked at

- **phone-landscape map-card:** nav rail on the left, one-row HUD across the top, map filling the left of the stage with the arrow pad in its corner, the rail card docked in the right 45% panel; pad and card do not touch.
- **phone-landscape combat:** same frame with the fight as the right panel: "ENCOUNTER / ROUND 1 2 STANDING" header, a short scrolling foe strip, the round log, and the four action tiles (Strike, Abilities, Items, Social) fully on screen without scrolling. The foe strip is only about 50 px tall at 412 px, so the foe cards scroll inside it (feel item below).
- **phone-landscape hero:** nav rail, HUD, then Hero as two columns (character sheet left, abilities and grimoire right).
- **tablet10-landscape hero:** nav rail, two-row HUD, the map on the left (about 720 px) with its pad, the Hero sheet in a right pane about 480 px wide with its own scroll.
- **tablet10-landscape encounter:** the same map on the left and the "THEY ARE ALREADY HERE ... FIGHT IT OUT" panel in the right pane, party marker visible.
- **tablet7-portrait store:** compact stack widened to 600 px: HUD, the store ("A store", 50 wilmst) filling the width with the tab bar along the bottom; no gutters.

## Layout fixes the tool forced (both in `mazeworld.html`)

1. **One-row HUD, short windows (phone-landscape, phone-landscape-360).** The 48 px menu button (visible face 34 px, `margin:-7px`) reached 3 px above the window. In the SHORT group, selector `.mw-hud-band2`: `padding-top:calc(4px + inset)` became `calc(7px + inset)`. The band grows 3 px; the HUD stays well under the 72 px shape limit. Pinned by (r), declared re-pin in `layout-shell.test.js`.
2. **Compact HUD at 360 px wide (found in the 360x800 turned half of phone-landscape-360).** The Rations counter was cut by 17.7 px. In the compact group of `mw-layout`: `.mw-hud-band2{gap:clamp(6px, calc((100vw - 340px) / 7), 10px)}` and `.mw-hud-counters{gap:clamp(2px, calc((100vw - 332px) / 10), 8px)}`: the gaps stay 10 and 8 px at 412 px and ease down to 6 and about 3 px at 360 px. This is a pre-existing Phase 57/78 gap (the base comment says band 2 was fitted to a Pixel 7), not a Phase 97 regression. New pin (w).

## Deviations from Plan

**1. [Rule 1 - Bug] `rectsIntersect` threshold written `>= 0.5`.** The plan text says "greater than 0.5 px" but its behaviour block requires a rect starting at 9.5 against one ending at 10 (a 0.5 px overlap) to intersect. The behaviour block wins; 0, touching edges and anything below 0.5 do not intersect.

**2. [Rule 1 - Bug, tool] The plan's combat fixture does not start a fight.** A Fighter with seed 7 is a Knight, and a Knight turns away foes under 5 WP, so `startCombat(..., "Beasts")` cleared itself (`state.combat` null). The tool searches seeds 7 upward for the first Fighter whose Beasts fight really begins (seed 8, a Master of Arms), deterministically, and uses that run as the base for every scene.

**3. [Rule 1 - Bug, tool] The "combat" scene injects the fought state instead of clicking `#mw-major-primary`.** The page's engine adapter holds its own run (the roller's), so a click acts on that run and replaces the injected one. The tool applies `{type:"fight"}` in node (`applyAction`) and injects the resulting round-1 state; the `encounter` scene still shows the pending panel. The plan's "resolves in one step: skipped" branch was therefore not needed.

**4. [Test-side] Page-side setup the plan did not list.** Seeding `ddr.notes.seen.v1` to the bundled version (otherwise the what's-new sheet covers every scene) and clearing the rail card after each state injection (a class-intro card was up on the map scene). `#mw-screens`' usable span excludes the classic scrollbar a desktop window shows, so the Hero centring check measures `clientWidth`, not the box (chromebook-half showed a 15 px gap difference that was only the scrollbar). The clipped-control rule treats a hidden-overflow ancestor above a scroller as cutting the scroller's box, not the control scrolled inside it (otherwise every scrolled store row was flagged).

**5. [Rule 3 - declared re-pin]** `test/unit/layout-shell.test.js` (r) re-pinned for fix 1 with a "Phase 97 (SCREEN-03): declared re-pin" comment; (w) added for fix 2.

No check was weakened to pass a profile. No engine, parity, determinism, lockfile or fixture file moved (`git diff a5fbd87f -- engine test/parity test/determinism package-lock.json` is empty).

## Tests run (targeted only)

- `layout-check.test.js`: 5 pass, 0 fail.
- `layout-shell, rail-overlay, hud-menu-layout, shell-tab-snapshots, shell-arrow-pad, hud-bands-layout, layout-check, android-system-bars, text-scale`: 141 pass, 0 fail.
- `npm run layout:check` exit 0 (12/12, 7/7). No full suite, bots, sims, Android build or `cap sync` ran.

## Known Stubs

None.

## Notes for 97-07 and the orchestrator

- `docs/ANDROID-DISPLAY.md` still mentions `tools/letterbox-check.mjs` (97-07 owns docs); the doc should point to `npm run layout:check`.
- The tool proves layout and overflow with zero insets; real cutout and navigation-bar clearance stays on the device and AVD rows.

## Deferred human verification

- Build gate, debug APK, AVD pass (80-05 profiles absorbed): pixel_7 with gesture and 3-button navigation and the tall cutout overlay, portrait and landscape; pixel_tablet rotated both ways mid-fight; pixel_fold folded and unfolded mid-store; a desktop-size resizable window dragged across 840 px. Every row: no restart, the run, fight or store kept, HUD and side panels clear of the bars and cutout.
- Build gate: refresh `docs/PERF-BASELINE.md` on the Pixel 7 (portrait and landscape step timings).
- Feel: at 412 px tall the foe cards in the right-hand combat panel sit in a strip about 50 px high and scroll; confirm on the Pixel 7 that aiming at a foe in landscape is comfortable (the actions are fully on screen).
- Feel: the short HUD band 2 is 3 px taller after fix 1, and a 360 px phone now shows tighter counter gaps (fix 2). Look at both on a real narrow phone if one is available.

## Self-Check: PASSED

tools/layout-check.mjs and test/unit/layout-check.test.js exist; commits 5e5bd943 and d3935abd are in `git log`; `tools/letterbox-check.mjs` is gone; `git check-ignore tools/layout-check-output/x.png` prints the path; no PNG is tracked.
