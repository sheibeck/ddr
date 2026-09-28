---
phase: 76-darkness-unification-relaunch-persistence
plan: 02
subsystem: shell-darkness-surfaces
status: complete
tags: [darkness, DARK-02, shell, map, palette, chip, vignette]
requires:
  - "76-01: engine/derived.js DARK_WAIVERS, darkWaiver, darkWaived, darkLimited"
provides:
  - "src/browser/darknessView.js: two-way waiverFor(waiver) over DARK_WAIVERS; one-radius vignetteFor docs"
  - "window.__mzDarkness carries darkWaiver (skill/eff dropped)"
  - "MAP_PALETTE.floorDarkLit / waterDarkLit and draw()'s waived-dark tint"
  - "test/unit/dark-surfaces.test.js: the every-surface agreement table"
affects:
  - "Phase 77 effect indicators (the darkness chip copy and tap card changed)"
  - "Milestone-close Pixel 7 checklist (device checks below)"
tech-stack:
  added: []
  patterns:
    - "one engine predicate read once per paint and bridged, never recomputed in the shell"
key-files:
  created:
    - test/unit/dark-surfaces.test.js
  modified:
    - src/browser/darknessView.js
    - src/browser/mapMarks.js
    - src/browser/bridge.js
    - mazeworld.html
    - test/unit/darkness-vignette.test.js
    - test/unit/mapMarks.test.js
    - test/unit/shell-terrain-41.test.js
    - test/unit/shell-spells-40.test.js
    - test/unit/reduced-motion.test.js
    - docs/SHELL-MODULES.md
    - docs/TERRAIN.md
decisions:
  - "waiverFor takes the engine's single key and returns it only when it is a DARK_WAIVERS member; the flags-object form and the module-local precedence list are gone (greenfield, one form)"
  - "The waived-dark tint shows on every rendered .dark cell while darkWaiver(S.c) is non-null (read once per draw), per the accepted planner default"
  - "Tint hexes: floorDarkLit #4f4531 and waterDarkLit #2d4a57, solid fills so each cell stays one fillRect"
  - "draw()'s SHA-256 pin in reduced-motion.test.js re-pinned with the traced DARK-02 cause"
metrics:
  duration: "~45 min"
  completed: 2026-09-26
  tasks: 2
  files: 12
---

# Phase 76 Plan 02: Every darkness surface reads the one predicate Summary

The DARK chip, its tap card, the map vignette and draw()'s per-tile dark painting now all read `darkWaiver(S.c)` from engine/derived.js, bridged on `window.__mzDarkness`. The shell no longer computes any waiver of its own. While a light holds the dark back, dark tiles paint a faint warm "lit by your light" tint instead of full dark. The chip and its explain copy now tell the fight truth as well as the map truth.

**Plan base:** `034d7ece29d3013251f7957e571364e54644dcb0`

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 (RED) | Failing tests for the one-predicate chip and vignette | `75f5fc43` | test/unit/darkness-vignette.test.js |
| 1 (GREEN) | Chip, tap card and vignette read the one predicate | `675ca818` | darknessView.js, mazeworld.html, bridge.js, SHELL-MODULES.md, TERRAIN.md |
| 2 (RED) | Failing tests for the waived-dark tint | `6b0b8cf8` | test/unit/dark-surfaces.test.js, test/unit/mapMarks.test.js |
| 2 (GREEN) | Waived dark tiles paint with a faint lit tint | `a46b7ebd` | mapMarks.js, mazeworld.html, the fill-line pins, the draw() SHA pin |

## What changed

- **src/browser/darknessView.js.** `waiverFor(waiver)` returns the engine's key when it is in `DARK_WAIVERS` (imported from engine/derived.js), and null otherwise. `WAIVER_PRECEDENCE` and the flags-object form are gone, so precedence lives only in the engine. `vignetteFor` keeps its signature, levels and totality. Its JSDoc and the module header now describe the Phase 76 one-rule, one-radius model. The Phase 57 "which radius" argument and the 999.8 backlog pointer (the stale lines 20-27) are removed.
- **mazeworld.html (module script).** The second derived.js import is now `inDark, revealRadius, darkWaiver`; skill/eff were only used by the bridge. The bridge is `window.__mzDarkness = { inDark, revealRadius, mapViewRadius, darkWaiver, vignetteFor, waiverFor };`. The pinned first derived.js import line is byte-identical.
- **mazeworld.html (classic).**
  - The darkness chip reads `dk?.waiverFor?.(dk.darkWaiver?.(S.c)) ?? null`. The three-flag object is gone, including the ether bridge's `itemEffectActive(S.c, "lit")` read.
  - The chip detail and the tap card now say the light is "holding it back".
  - `CONDITION_EXPLAIN.darkness` is rewritten (text below).
  - The paintVignette comment and the WAIVER_LABEL comment now describe the one rule.
  - draw() reads `const darkLit = !!window.__mzDarkness?.darkWaiver?.(S.c);` once per paint. The fill line and the water override line choose `floorDarkLit` / `waterDarkLit` for a `.dark` cell while `darkLit` is true. spellSeen still takes priority. The fallback palette literal carries both new keys.
- **src/browser/mapMarks.js.** `MAP_PALETTE` gains `floorDarkLit` and `waterDarkLit`. It stays frozen and every prior key is unchanged.
- **Docs.** The bridge registry and the SHELL-MODULES `__mzDarkness` row now name darkWaiver and the draw() consumer. SHELL-MODULES has no separate darknessView module entry; the bridge row is the only mention. TERRAIN.md gains "One rule for the map and the fight (Phase 76, DARK-01/02)", covering `darkWaiver` / `darkLimited`, the three lights, Sense Presence as fight-only, `sight` as additive, and the chip, vignette and tint surfaces. Its render-filter bullets and the Darkness row of the phobia trigger table now read `darkLimited`.

## Chosen hexes (relative luminance)

| Key | Hex | Luminance | Neighbours |
|---|---|---|---|
| floorDark | #3d372a | 0.0389 | |
| **floorDarkLit** | **#4f4531** | **0.0614** | floorDark < floorDarkLit < floor |
| floor | #645c48 | 0.1083 | |
| waterDark | #1f3a4a | 0.0381 | |
| **waterDarkLit** | **#2d4a57** | **0.0614** | waterDark < waterDarkLit < water |
| water | #2f5f7a | 0.1019 | |

Both new hexes sit closer to the dark shade, so a lit dark area still reads as dark. Both differ from every other palette key (pinned in test/unit/mapMarks.test.js).

## New copy

- **Chip detail (with a light):** `<countdown> · your torch is holding it back` (or "your night vision" / "your Amulet of Light").
- **Tap card lead (with a light):** "The dark is on you, but your torch is holding it back." followed by the explain sentence below. With no light, the card leads with the measured to-hit penalty from conditionEffectText, then the explain sentence.
- **CONDITION_EXPLAIN.darkness:** "While this counts down you see one square around you, the map shows no further, and in a fight every strike is harder to land, none of them critical, and anyone afraid of the dark gets to prove it. Night Vision, a lit torch or a live Amulet of Light holds all of it back, and the Amulet ends it outright. Sense Presence lets you fight at full skill anyway, but it lights nothing."

conditionEffects.js needed no change. Its darkness lead follows toHit, so it names a to-hit penalty with no light and returns null under a lit torch or a live Amulet. This is pinned in darkness-vignette.test.js.

## Verification

- `npm test`: 6,752/6,752 green (run after the fixes below).
- Parity: 64/64. No parity fixture, shell snapshot or state pin moved (`git diff 034d7ece -- test/parity test/unit/fixtures` is empty). tools/fixture-inventory.mjs's roster is unchanged, so this plan declares nothing in FIXTURE-INVENTORY.md.
- `npm run boot:check`: PASS on all four checks (no-uncaught, painted, graves, title). The worktree has no node_modules, so build:www could not vendor Capacitor. I pointed a temporary directory junction at the main checkout's node_modules, built www, ran the check and the www-artefact test, then removed the junction (only the link; the main node_modules is intact) and the gitignored www/.
- Acceptance greps: all hold. `999.8` = 0 and `WAIVER_PRECEDENCE` = 0 in darknessView.js; `DARK_WAIVERS` = 3. `NEVER revealRadius`, `off the map` and `itemEffectActive(S.c, "lit")` = 0 in mazeworld.html. `floorDarkLit` and `waterDarkLit` each appear once in mapMarks.js; in mazeworld.html `floorDarkLit` appears 3 times and `waterDarkLit` 4 times. darkWaiver is in bridge.js and SHELL-MODULES.md, and darkLimited is in TERRAIN.md.
- No bot readouts were run (user ruling 2026-09-26), and no tools/readouts files were created.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Pin with traced cause] reduced-motion.test.js draw() SHA-256.** draw()'s comment-stripped body is hash-pinned "unchanged by any OTHER plan". This plan deliberately changes draw() (two fallback palette keys, the one `darkLit` read, the two tinted fill lines). I re-pinned DRAW_SHA256 to `455c2b5f…feef3`, with a comment naming the three changes and the previous digest. Commit `a46b7ebd`.

**2. [Rule 1 - Test] stale-terms hit in my own test.** My voice check's regex named the retired term "toast", which the DOCS-01/03 stale-term sweep flags. I dropped it from the regex; the copy never contained it. Commit `a46b7ebd`.

**3. [Rule 3 - Environment] boot:check needs a built www/.** See Verification. Nothing was installed and no file was committed.

### Plan notes

- The plan asked me to update "the darknessView module entry in SHELL-MODULES.md". No such entry exists; darknessView.js appears only in the `__mzDarkness` bridge row, which is updated.
- Beyond the plan's list, TERRAIN.md's phobia trigger-table Darkness row now reads `darkLimited`. 76-01 moved `regionActive` to that predicate, and the row was stale.

## Device checks (milestone-close Pixel 7 checklist, deferred UAT)

- Fall into the Table-7 darkness (the DARK chip counting down) with no light: the vignette closes in and dark tiles look dark.
- Light a torch. The vignette lifts and the DARK chip names "your torch". Its tap card says the torch is holding the dark back. Dark tiles take a faint warm tint that still reads as dark.
- Use the Amulet of Light, then play a Night Vision race: the chip names "your Amulet of Light" and "your night vision" respectively.
- In a fight in the Table-7 darkness with a torch lit, tap the DARK chip: the card says the torch is holding the dark back and shows no to-hit penalty. With no light it shows the penalty.
- Let the torch burn out in the dark: the tint goes back to full dark and the vignette returns.

## Known Stubs

None.

## TDD Gate Compliance

Task 1: RED `75f5fc43`, then GREEN `675ca818`. Task 2: RED `6b0b8cf8`, then GREEN `a46b7ebd`. No refactor commits were needed.

## Self-Check: PASSED

- Commits 75f5fc43, 675ca818, 6b0b8cf8 and a46b7ebd are in git log.
- test/unit/dark-surfaces.test.js and src/browser/darknessView.js exist.
- STATE.md, ROADMAP.md and REQUIREMENTS.md are untouched (the orchestrator owns them).
