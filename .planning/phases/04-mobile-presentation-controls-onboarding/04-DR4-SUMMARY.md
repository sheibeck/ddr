---
phase: 04-mobile-presentation-controls-onboarding
plan: DR4 (device-review revision round 4, ad hoc — not a numbered PLAN.md)
subsystem: ui
tags: [dpad, hud, icons, marks-legend, bottom-sheet, death-card, title-screen, mock-fidelity]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR2/04-DR3: dark torch-lit HUD/tabbar/mw-chip/dpad chrome, #mw-title-screen (ENTER/RESUME), #mw-roller-screen (\"THE TABLES DECIDE\"), window.mzStartRoll/window.mzAbandonRun bridges"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-06: icons.js FEATURE_ICONS/featureKeyForCell/drawFeatureIcon, icons/optimized/*.png preloaded at boot"
provides:
  - "mazefoot layout with MAKE CAMP and the D-pad as separate flex children (space-between spreads them: camp left, d-pad right)"
  - "Scoped .mw-chip / #btn-camp :hover/:active overrides so MARKS/CENTRE/MAKE CAMP invert to the mock's gold-chip treatment on press instead of flashing near-white"
  - "drawFeatureIcon's size factor at 1.08 (icons.js), up from round 2's 0.94"
  - "--mw-font-hud-label/--mw-font-hud-num tokens + mock-matched HUD FLOOR/DAY/SQUARES/RATIONS typography (Press Start 2P labels, bold Courier Prime numbers, gold FLOOR) and a 2-row RATIONS layout"
  - "#mw-legend-sheet — the mock's \"WHAT THE MARKS MEAN\" scrim + rising bottom-sheet panel, listing all 9 FEATURE_ICONS as real PNGs with name + deadpan description; opened by MARKS, closed via scrim tap or Close"
  - "wireDeathConfirm()/window.mzReturnToTitle() — the death card's single CONFIRM action, returning to the title screen with no reroll lock/hint"
  - "showTitleScreen()'s dynamic hasActiveDelveSave() resume-visibility resolution + RESUME-above-ENTER markup order; dead/won-aware hadSaveAtLaunch cold-boot check"
affects: [04-07, 04-08, 04-09, 04-10, 04-11]

tech-stack:
  added: []
  patterns:
    - "CSS specificity fix pattern: a generic light-theme button:hover:not(:disabled){background:#F7F1E2} rule was winning over .mw-chip's/#btn-camp's own darker backgrounds because element+2-pseudo-class beat single-class selectors — fixed with higher-specificity scoped overrides (.mw-chip:hover:not(:disabled), #btn-camp:hover:not(:disabled)) rather than touching the shared generic rule, keeping the fix local to the 3 elements this round named."
    - "Flex space-between requires >=2 visible children to actually spread — .mazefoot's camp+dpad were previously nested in one shared wrapper div, so with the (also-present) .legend hidden by default there was only ONE visible flex child and it just sat at flex-start. Splitting camp and dpad into direct siblings fixed the spread without touching justify-content itself."
    - "hasActiveDelveSave() reads the classic script's own `S` global directly from the trailing module script — confirmed safe/already-established by registerNativeChrome's pre-existing getGameContext() (same pattern), since a classic <script>'s top-level `let`/`const` bindings are visible to a later <script type=module> sharing the same document/realm."
    - "A save being PRESENT at ddr.delve.v1 is not the same as a run being ACTIVE: dispatch()/persist() write the save unconditionally on every action including the one that kills/wins the run, so a dead/won run's save persists. \"Active delve\" for RESUME purposes must check the parsed save's own dead/won fields (or the live S.dead/S.won), not just key presence."

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR4-SUMMARY.md
  modified:
    - mazeworld.html
    - src/browser/icons.js

key-decisions:
  - "Group 1's D-pad fix touches the SAME mazefoot markup Group 2 later strips the inline legend from — sequenced deliberately so Group 1's structural fix (camp/dpad as direct flex siblings) lands and is verified independently first, then Group 2 removes the now-orphaned #mw-legend block/CSS entirely rather than doing both in one commit."
  - "MARKS/CENTRE and MAKE CAMP's gold-invert-on-press treatment has no direct counterpart in the mock (design/Mazeworld Mobile.dc.html only defines style-active for the D-pad's 4 arrow buttons, not these 3) — applied by analogy to the D-pad's own already-correct :active pattern per the live user directive fixing the reported 'goes bright white' bug, not a literal 1:1 mock copy for these specific elements."
  - "The MARKS legend bottom-sheet is a position:fixed overlay covering the WHOLE app (inserted as a body-level sibling before #app, same placement pattern as #mw-title-screen/#mw-roller-screen), not scoped inside .mw-maze-viewport — matches the mock's own legendOpen block, which sits at the top-level device wrapper, not nested inside the maze viewport."
  - "WALL (the 'climb' feat) and the party marker (YOU) have no FEATS entry in the mock's own legend data (design/Mazeworld Mobile.dc.html only lists the 7 rollable feature-tile marks) — their legend copy is new, deadpan-voice-matched content, not copied from the mock, per the plan's explicit instruction to legend ALL 9 FEATURE_ICONS including the player marker."
  - "Scope-limited the death-card CONFIRM-to-title change to the DEATH card only, per the plan's literal wording ('On death, the death card's primary action becomes CONFIRM'). The won card's 'Roll another delver' still opens the roller directly, unchanged — not named in Group 3's scope, and changing it would be an unrequested behavior change to a working, differently-purposed flow (winning isn't permadeath; an immediate reroll-into-the-reveal for a WIN is a defensible different UX than CONFIRM-gating a DEATH)."
  - "showTitleScreen()'s allowResume parameter stays backward-compatible (mzAbandonRun still passes an explicit {allowResume:true}) while gaining a dynamic default (hasActiveDelveSave()) for the new window.mzReturnToTitle() bridge — avoids forcing every future caller to compute the check itself, and avoids a behavior change to the already-correct, already-tested abandon flow."
  - "The cold-boot hadSaveAtLaunch check was upgraded to parse the save and check .dead/.won (previously just checked key presence) — a Rule 1 correctness fix discovered while implementing the same 'active delve' semantics DR4 explicitly asked for on the death->title path; without this fix, a player who force-quits right after death would see a RESUME button at next cold launch that leads right back to the same death card, which is the same dead-end the plan's dynamic-resume requirement exists to prevent."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1/04-DR2/04-DR3-SUMMARY.md's own precedent.

duration: ~90min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR4: Device-review round 4 — mock fidelity pass Summary

Brought the live app's MAP controls/HUD, marks legend, and death/title flow into fidelity with `design/Mazeworld Mobile.dc.html` per the user's live device-review direction. Three atomic commits (controls+HUD, marks-legend bottom-sheet, death/title flow), each independently rebuilt (`npm run build:www`) and fully tested (`npm test` 451/451, `npm run test:quick` 362/362) before the next commit landed.

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-09-08
- **Tasks:** 3 groups (controls+HUD visuals; marks-legend bottom-sheet; death card + title flow) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 2 (`mazeworld.html`, `src/browser/icons.js`)

## Accomplishments

### Group 1 — Controls + HUD visuals (`100ac99`)
- **D-pad shifted right.** `.mazefoot`'s MAKE CAMP button and the D-pad grid are now separate direct flex children (previously nested together in one shared wrapper div) — `.mazefoot`'s existing `justify-content:space-between` now actually has two visible children to spread apart (with `#mw-legend` hidden, the common case), pinning MAKE CAMP to the left edge and the D-pad to the right, matching the mock's bottom bar.
- **MARKS/CENTRE + MAKE CAMP no longer flash white on press.** A leftover light-theme `button:hover:not(:disabled){background:#F7F1E2}` rule was winning on CSS specificity over `.mw-chip`'s and `#btn-camp`'s own dark backgrounds — worse on Android WebView, where a tap can stick as `:hover`. Added scoped, higher-specificity `:hover`/`:active` overrides that invert these three controls to the mock's gold-chip treatment on press (`#e8c97a` background / `#14110c` text), mirroring the D-pad's own already-correct `:active` pattern.
- **Icons bigger.** `drawFeatureIcon`'s size factor bumped from round 2's `0.94` to `1.08` (`src/browser/icons.js`) so feature icons fill/slightly overflow their cell instead of merely nearly filling it.
- **HUD FLOOR/DAY/SQUARES bigger + mock fonts.** New `--mw-font-hud-label`/`--mw-font-hud-num` tokens (still `--mw-text-scale`-multiplied) give the HUD tags the mock's Press Start 2P ~7px treatment (was Courier Prime at a smaller size) and the numbers the mock's bold Courier Prime ~19px size; FLOOR's number is gold via a new `.mw-hud-floor` modifier class.
- **RATIONS layout per mock.** Restructured from a single 3-item flex column (label text node + `<b>` + bar div all stacking onto separate lines) into the mock's 2-row layout: a label+number row, with the depletion bar below it.

### Group 2 — Marks legend (mock bottom-sheet) (`f856950`)
- **MARKS opens `#mw-legend-sheet`**, a full-screen scrim + rising panel matching the mock's `legendOpen` block (`mwfade`/`mwrise` keyframes), replacing the prototype's inline `.legend` strip toggle entirely (old markup + `.legend`/`.k-*` CSS removed).
- Lists all 9 `FEATURE_ICONS` (`src/browser/icons.js`) as their real preloaded PNGs (`icons/optimized/*.png`, the same set the map itself draws) with a name and a short deadpan-voice description — the 7 feature-tile marks' copy echoes the mock's own `FEATS` table (`design/Mazeworld Mobile.dc.html`); WALL (the "climb" feat) and the party marker (YOU), which have no `FEATS` entry in the mock, get new copy in the same voice.
- Dismissed by tapping the scrim or the Close button (`renderMarksLegend()`/`openMarksLegend()`/`closeMarksLegend()`, classic script).

### Group 3 — Death card + title flow (`75b6127`)
- **Removed the "read it first"/`AGAIN_LOCK` dice-hint delay entirely** — the death card's primary button used to disable itself and show "Read it first…" for 2 seconds before allowing a reroll; the mock's death card has no such hint or lock.
- **Death card's primary action is now a single CONFIRM** that returns to the TITLE/splash screen (`window.mzReturnToTitle()`) instead of opening the roller directly — rolling a new character only ever happens FROM the title (ENTER → the roller), consistent with the existing abandon-run flow. The won card's "Roll another delver" is unchanged (still opens the roller directly) — not named in this group's scope.
- **Title: RESUME sits above ENTER** in both markup order and, when present, visually. `showTitleScreen()` now resolves RESUME's visibility dynamically via `hasActiveDelveSave()` (reads the classic script's live `S`) when a caller omits an explicit `allowResume` — a run only counts as "active" while neither dead nor won, so returning to the title after death never offers a dead-end RESUME back into the same death card. The cold-boot `hadSaveAtLaunch` check got the same dead/won-aware fix (parses the save and checks `.dead`/`.won` instead of just key presence).

## Task Commits

1. **Group 1 — Controls + HUD visuals** — `100ac99` (fix)
2. **Group 2 — Marks legend bottom-sheet** — `f856950` (feat)
3. **Group 3 — Death card CONFIRM-to-title; title RESUME-on-top** — `75b6127` (fix)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test` 451/451, `npm run test:quick` 362/362) at its own checkpoint, plus a `node --check` syntax pass on both the classic and trailing module `<script>` blocks, before the next group's edits began.

## Files Created/Modified

- `mazeworld.html` — mazefoot layout restructure; `.mw-chip`/`#btn-camp` hover/active overrides; new `--mw-font-hud-*` tokens + HUD markup/CSS; RATIONS restructure; `#mw-legend-sheet` markup/CSS/JS replacing the inline `.legend`; `wireDeathConfirm()`/`window.mzReturnToTitle()`/`hasActiveDelveSave()`; RESUME-above-ENTER title markup; dead/won-aware `hadSaveAtLaunch`.
- `src/browser/icons.js` — `drawFeatureIcon`'s size factor `0.94` → `1.08`, doc comment updated.

## Decisions Made

See `key-decisions` in the frontmatter above (group sequencing re: shared mazefoot markup, chip/camp active-state-by-analogy to the mock's D-pad, legend-sheet body-level placement, WALL/party legend copy provenance, death-only CONFIRM scope, `showTitleScreen()` backward-compatible dynamic default, and the cold-boot dead/won-aware save check).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — bug] Cold-boot `hadSaveAtLaunch` counted a dead/won leftover save as resumable**
- **Found during:** implementing Group 3's dynamic "active delve" resume check for the death→title path.
- **Issue:** the pre-existing cold-boot check only tested whether the `ddr.delve.v1` key was present, not whether the saved run was still live — `dispatch()`/`persist()` (`src/browser/engineAdapter.js`) write the save unconditionally on every action including the one that kills/wins the run, so a dead/won run's save persists at the same key. A player who force-quit right after death and relaunched would see RESUME offered, leading right back into the same death card — the exact dead-end the plan's "active delve" requirement exists to prevent, just hit via a different entry point (cold launch instead of the death card's own button).
- **Fix:** parse the raw save and check `!parsed.dead && !parsed.won` (fail-closed to "no save"/ENTER-only on any read/parse error) instead of a bare truthy check.
- **Files modified:** `mazeworld.html`
- **Commit:** `75b6127`

None of the other work required a checkpoint or user decision — all three groups were independently verifiable (build + full test suite) and matched the plan's explicit instructions directly.

## Known Stubs / Threat Flags

None. This was presentation-layer (DOM/CSS/JS UI) work reusing existing engine seams (`window.mzStorage`, `S`/`window.__mzState`, `preloadIcons()`'s already-loaded PNG set, `window.mzStartRoll`/`window.mzAbandonRun`) — no new network endpoints, auth paths, or schema changes. The new `#mw-legend-sheet` and `window.mzReturnToTitle()` are additive UI-only surfaces with no data access beyond reading the same in-memory `S`/`FEATURE_ICONS` already used elsewhere.

## Verification

- `npm run build:www` — succeeds at all three commit checkpoints; `www/index.html`/`www/icons/optimized/*.png` reflect each group's changes.
- `node --check` on both the classic and trailing module `<script>` blocks (extracted to temp files) — syntactically valid at all three checkpoints.
- `npm test` — **451/451 green** at all three checkpoints (unchanged from baseline — no engine/content/src test assertions reference the DR4-touched UI surfaces except `src/browser/icons.js`'s existing `FEATURE_ICONS`/`featureKeyForCell` tests, which don't assert the numeric size factor and needed no update).
- `npm run test:quick` — **362/362 green** at all three checkpoints.
- No headless-DOM/visual harness exists in this project (consistent with prior 04-DR*-SUMMARY.md notes) — the on-device "feel" of the D-pad position, chip/camp press colors, bigger icons, HUD typography, the legend sheet's scroll/PNG rendering, and the death→title→ENTER-only vs. abandon→title→RESUME-on-top flows are unverified here and should be confirmed on the Pixel 7 build the orchestrator produces next.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `.mw-hud-floor`, `--mw-font-hud-label`/`--mw-font-hud-num`, `#mw-legend-sheet`/`#mw-legend-rows`/`renderMarksLegend`/`openMarksLegend`/`closeMarksLegend`, `wireDeathConfirm`/`btn-death-confirm`, `window.mzReturnToTitle`/`hasActiveDelveSave`
- FOUND: `src/browser/icons.js` — `Math.round(size * 1.08)`
- FOUND commit `100ac99` (fix(04-dr4): DR4 group 1 — controls + HUD visuals per mock)
- FOUND commit `f856950` (feat(04-dr4): DR4 group 2 — MARKS opens the mock's marks-legend bottom sheet)
- FOUND commit `75b6127` (fix(04-dr4): DR4 group 3 — death card CONFIRM-to-title; title RESUME-on-top)
- FOUND: `www/index.html` (post-build) contains `mw-legend-sheet`/`btn-death-confirm`/`mzReturnToTitle` and `www/icons/optimized/*.png` (all 9)

## Next Phase Readiness

- All three DR4 groups are complete and test-green; ready for on-device UAT on the Pixel 7 build the orchestrator produces next.
- No blockers. The won card's reroll path was deliberately left on its pre-DR4 behavior (opens the roller directly) — a candidate for a future device-review round only if the user wants CONFIRM-to-title parity there too; not required by this round's scope.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
