---
phase: 57-map-hud-layout-band
plan: 04
subsystem: ui
tags: [shell, map, darkness, vignette, bridge, vanilla-js]

requires:
  - phase: 57-map-hud-layout-band (plan 03)
    provides: "the rail's tap-to-dismiss + doubled/line-scaled hold table — this plan touches no rail structure, only adds two named RAIL_FAMILY rows"
provides:
  - "src/browser/darknessView.js: VIGNETTE_LEVELS, vignetteFor(inDark, mapViewRadius), waiverFor(flags) — a pure module that turns the engine's OWN inDark/mapViewRadius answers into a three-level vignette state and names which waiver (Night Vision / a live Amulet of Light / a lit torch) is holding the dark back, never recomputing the rule itself."
  - "window.__mzDarkness bridge: { inDark, revealRadius, mapViewRadius, vignetteFor, waiverFor, skill, eff } — the ONE new bridge name this plan adds, with its BRIDGE row and regenerated docs/SHELL-MODULES.md."
  - "mazeworld.html: paintVignette(c) — writes #mw-vignette's data-dark from the SAME live state paintConditions(c) just painted, called directly after it in paint() so the two can never land on different frames."
  - "mazeworld.html: paintConditions' darkness chip now names any open waiver in its countdown detail and its tap card leads with the named waiver — the actual fix for the 2026-09-21 device report (a darkness counter running beside unrestricted vision with no explanation)."
  - "src/browser/rail.js: darknessFell/darknessDispelled RAIL_FAMILY rows, so neither the fall nor the Amulet cancel reads as the generic fallback card any more."
  - "The four resolves_phase:57 todos moved to .planning/todos/completed/ with their resolving plans named."
affects: [58-motion-pacing]

tech-stack:
  added: []
  patterns:
    - "A vignette/legibility module that RECEIVES the engine's already-computed answers as plain arguments (inDark, mapViewRadius) rather than importing state and recomputing the rule — the same receives-answers discipline the Phase 41 bridge (__mzMapView) already established, extended here to a second, presentation-only layer on top of it."
    - "A bridge object can grow additional keys (skill, eff joined __mzDarkness alongside inDark/revealRadius/mapViewRadius/vignetteFor/waiverFor) without registering a new window.__mz* NAME — bridge-registry.test.js's set-equality gate is over names, not over an object's own key count."
    - "A classic-script fail-open branch that cannot import the module's own constant (VIGNETTE_LEVELS) repeats the literal (\"off\") with a comment pointing at the constant's real home, rather than inventing a second bridge just to expose one string."

key-files:
  created:
    - src/browser/darknessView.js
    - test/unit/darkness-vignette.test.js
  modified:
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - mazeworld.html
    - src/browser/rail.js
    - test/unit/darkness-filter.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-gear-39.test.js
    - .planning/todos/completed/2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md
    - .planning/todos/completed/2026-09-21-map-chip-strip-is-a-reserved-band-above-the-map-not-an-overl.md
    - .planning/todos/completed/2026-09-21-hud-reflow-name-hp-row-then-counters-then-conditions-then-chips.md
    - .planning/todos/completed/2026-09-21-table-7-darkness-counter-is-invisible-on-the-map.md

key-decisions:
  - "vignetteFor's level split reads the RAW mapViewRadius argument's finiteness for the off/close/near decision (a waiver -> Infinity -> off), but the returned `radius` field is always a finite, floor-1 display value — the two use cases (the decision vs. a friendly number) needed different rounding rules, documented explicitly in the module's own doc comment so a future reader does not 'simplify' them into one."
  - "waiverFor's precedence (Night Vision, then Amulet of Light, then lit torch) is most-durable-first, not table order or alphabetical — an innate skill is the least likely of the three to expire mid-conversation, so it is the one named when more than one happens to be true at once."
  - "The __mzDarkness import for inDark/revealRadius/skill/eff was kept on its OWN import line (not folded into the existing `conditionsOf, hasTool, mapViewRadius, inViewWindow` line), mirroring the 260919-00d/260918-vvt precedent — three existing tests (shell-gear-39, shell-loot-screen, shell-worn-slots) pin that exact import-line literal byte-for-byte."
  - "The guardTap call site for the darkness chip now reads a local `explainText` (the waiver-led text when a waiver is open, else explainCondition(cn, label) unchanged) instead of calling explainCondition(cn, label) inline — shell-gear-39.test.js's literal-call-site pin was re-pinned to match (Rule 1, see Deviations)."
  - "darknessFell's RAIL_FAMILY title (\"IN THE DARK\") deliberately matches the pre-existing torch-offer card's own fallback heading at mazeworld.html's `rail.pending.kind === \"dark\"` branch, so the fresh-fall card and a later pending-torch-offer card read as the same event rather than two unrelated ones."

requirements-completed: [LAYOUT-06]

coverage:
  - id: D1
    description: "The vignette state comes from the engine's own inDark/mapViewRadius through window.__mzDarkness, with no second copy of the rule in the shell — anchored, comment-stripped: exactly ONE darkFor read (the pre-existing torch-offer guard) and zero local definitions of inDark/revealRadius."
    requirement: LAYOUT-06
    verification:
      - kind: unit
        ref: "test/unit/darkness-vignette.test.js#(shell) source anchor: comment-stripped mazeworld.html contains exactly ONE darkFor occurrence ... and ZERO local definitions of inDark/revealRadius"
        status: pass
      - kind: unit
        ref: "grep -nE purity/no-dup checks over src/browser/darknessView.js (Task 1 acceptance)"
        status: pass
    human_judgment: false
  - id: D2
    description: "paintVignette() is fed mapViewRadius(S), never revealRadius(S) — the two disagree under a waiver, and the vignette must explain what the map is RENDERING."
    requirement: LAYOUT-06
    verification:
      - kind: unit
        ref: "test/unit/darkness-vignette.test.js#(shell) paintVignette's body references mapViewRadius and does NOT reference revealRadius"
        status: pass
      - kind: unit
        ref: "test/unit/darkness-vignette.test.js#end-to-end: a running counter WITH a lit torch composes to the off level too"
        status: pass
    human_judgment: false
  - id: D3
    description: "The vignette and the DARK chip appear and clear on the same frame, including the Amulet of Light cancel — no stored flag, recomputed from live state on every paint()."
    requirement: LAYOUT-06
    verification:
      - kind: unit
        ref: "test/unit/darkness-vignette.test.js#(shell) chip-agreement: the darkness chip and the vignette appear together and clear together on the same paint"
        status: pass
    human_judgment: false
  - id: D4
    description: "USER RULING 2026-09-22 (waiver visibility): while c.darkFor runs with a waiver open (Night Vision, a live Amulet of Light, a lit torch), the DARK chip's countdown detail names it and its tap card leads with the named waiver."
    requirement: LAYOUT-06
    verification:
      - kind: unit
        ref: "test/unit/darkness-vignette.test.js#(shell) waiver visibility — a lit torch / a live Amulet of Light / Night Vision (3 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/darkness-vignette.test.js#(shell) no waiver: the darkness chip names none, and the vignette is at the close level"
        status: pass
    human_judgment: false
  - id: D5
    description: "The DARK chip's tap card states the actual rule (radius-1 reveal on unwalked ground, a to-hit penalty) and names the torch/amulet cancel."
    requirement: LAYOUT-06
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(e) CONDITION_TONE/CONDITION_EXPLAIN ... — darkness names the radius-1 rule and the to-hit penalty"
        status: pass
    human_judgment: false
  - id: D6
    description: "darknessFell/darknessDispelled each get a named RAIL_FAMILY row (own icon/title/tone) so neither the fall nor the Amulet cancel falls through to the generic fallback card; both stay absent from ORACLE_ONLY so the rail fold still reaches them."
    requirement: LAYOUT-06
    verification:
      - kind: unit
        ref: "test/unit/shell-map-invariants.test.js#voice scan: every RAIL_FAMILY title is non-empty and clear of BANNED (imports RAIL_FAMILY directly, covers the two new rows)"
        status: pass
      - kind: other
        ref: "manual verification: darknessFell/darknessDispelled confirmed absent from src/browser/narrationLines.js's ORACLE_ONLY set (not a persisted test — mirrors 57-03-SUMMARY.md's D5 precedent for a structural, non-regressable fact)"
        status: pass
    human_judgment: false
  - id: D7
    description: "engine/ and content/ are byte-identical to the phase base; no cell is re-fogged; the Phase 41 render-window filter is untouched and now characterised by its own pins; on a first frame with darkFor 0 and no dark tile, the vignette carries its off state and throws nothing."
    requirement: LAYOUT-06
    verification:
      - kind: unit
        ref: "test/unit/darkness-filter.test.js#Phase 57 characterisation (5 tests) + test/unit/shell-terrain-41.test.js (the two-call-site pin)"
        status: pass
      - kind: unit
        ref: "test/unit/darkness-vignette.test.js#(shell) a missing __mzDarkness bridge: #mw-vignette is at the off level and paint() throws nothing"
        status: pass
      - kind: other
        ref: "git diff --stat 4d43edf..HEAD -- engine/ content/ test/parity/"
        status: pass
    human_judgment: false
  - id: D8
    description: "Phase gate: npm test fail 0; npm run build:www exit 0; git diff --stat empty; parity master hash unchanged; bridge-registry.test.js green on both halves; boot:check exit 0."
    requirement: LAYOUT-06
    verification:
      - kind: other
        ref: "npm test (3607/3607) · npm run build:www (exit 0) · git hash-object test/parity/prototype-master.js.txt (a1f4d0dc29782218d8e5aab65bc5989c33f917f0) · node --test test/unit/bridge-registry.test.js (10/10) · npm run boot:check (exit 0)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The four resolves_phase:57 todos are in todos/completed/ with their resolving plans named."
    requirement: LAYOUT-06
    verification:
      - kind: other
        ref: "ls .planning/todos/pending | grep -c 'rail-overlays|map-chip-strip|hud-reflow|table-7-darkness' == 0; same grep against todos/completed == 4"
        status: pass
    human_judgment: false
  - id: D10
    description: "On the Pixel 7, rolling Table-7 Darkness without light gear visibly closes the map while the existing chip counts down; with an Amulet of Light the chip clears on the next step with a line."
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule for this run) — device-only visual check, batched for Phase 60's Pixel 7 session. The automated half (the vignette level, the waiver clause, the chip-agreement timing) is D3/D4 above."
  - id: D11
    description: "The vignette reads as darkness at radius 1 against the Phase 35 map palette and is distinguishable from the static base vignette."
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol — a visual alpha-ramp judgment call, batched for Phase 60's Pixel 7 session. The CSS rules themselves are pinned (no transition/animation, box-shadow present) by darkness-vignette.test.js's automated section."

duration: ~40min
completed: 2026-09-22
status: complete
---

# Phase 57 Plan 04: Darkness Legibility — Vignette, Waiver Naming, Named Cancel (LAYOUT-06) Summary

**A counter-driven map vignette read through a new `__mzDarkness` bridge (`window.__mzDarkness.vignetteFor(inDark, mapViewRadius)`), plus the actual fix for the 2026-09-21 device report: the DARK chip now names any waiver (Night Vision / Amulet of Light / lit torch) holding the dark back instead of running silently beside unrestricted vision.**

## Performance

- **Duration:** ~40 min (14:06 dispatch → 14:46 Task 3 commit)
- **Completed:** 2026-09-22T18:46:28Z
- **Tasks:** 3 of 3
- **Files modified:** 13 (2 created, 7 modified code/test, 4 todo files renamed with a Resolved note appended)

## Accomplishments

- **The discovery-block correction confirmed and pinned.** LAYOUT-06's premise ("`draw()` dims only `tile.dark` cells and nothing reads the counter") was false at HEAD — Phase 41 (TERR-03) already wired `mapViewRadius`/`inViewWindow` to collapse the map to a 3x3 window whenever `c.darkFor > 0`. `test/unit/darkness-filter.test.js` gained five "Phase 57 characterisation" tests pinning this AS ALREADY CORRECT, including the exact torch/Amulet/Night Vision divergence (`revealRadius` stays 1, `mapViewRadius` jumps to `Infinity`) that is the confirmed explanation of the 2026-09-21 report. `draw()` and its two `visible(x, y)` call sites are untouched (`shell-terrain-41.test.js` still green).
- **`src/browser/darknessView.js`** (new, pure, DOM-free): `VIGNETTE_LEVELS` (`["off","near","close"]`), `vignetteFor(inDark, mapViewRadius)` — total over every input, fed `mapViewRadius` never `revealRadius` per USER RULING 2026-09-22 — and `waiverFor(flags)` — a fixed-precedence (Night Vision > Amulet of Light > lit torch) key-naming function, receiving pre-computed booleans, never recomputing the rule.
- **`window.__mzDarkness`** bridge: `{ inDark, revealRadius, mapViewRadius, vignetteFor, waiverFor, skill, eff }` — the one new bridge name this plan adds, BRIDGE row + `node tools/bridge-doc.mjs --write` landed in the same commit as the export.
- **`paintVignette(c)`**: writes `#mw-vignette`'s `data-dark` from `vignetteFor(inDark(S), mapViewRadius(S))`, called directly after `paintConditions(c)` in `paint()` — no stored flag, so the vignette and the DARK chip are always painted from the same live state and clear together, including the Amulet of Light cancel. Fails open to `"off"` when the bridge is missing.
- **Waiver visibility (the actual bug fix).** `paintConditions`'s darkness-chip branch now calls `window.__mzDarkness.waiverFor(...)` with the three live booleans (`skill(c,"Night Vision")`, `eff(c,"light")>0`, `itemEffectActive(c,"lit")`) and, when one is open, appends a named clause to the chip's countdown detail and leads the tap card with it ("The dark is on you, but your torch is keeping it off the map. ...").
- **`CONDITION_EXPLAIN.darkness`** rewritten to state the actual rule (radius-1 reveal on unwalked ground, a to-hit penalty) and that a torch/amulet ends it early — no longer the vague "walk carefully" line.
- **`src/browser/rail.js`**: `darknessFell`/`darknessDispelled` RAIL_FAMILY rows (own icon/title/tone) so neither event falls through to the generic block/tone fallback card any more; both remain absent from `ORACLE_ONLY` so the rail fold still reaches them.
- **CSS**: two new `.mw-vignette[data-dark="near"|"close"]` attribute rules tightening the existing inset box-shadow toward the party, using near-black values from the Phase 35 map palette; no transition/animation (Phase 58 owns motion).
- **`test/unit/darkness-vignette.test.js`** (new, 27 tests): module totality/precedence tests, an end-to-end composition test against the real engine reads, and a shell section (through `loadShellSandbox`) proving the vignette level, the waiver clause, the chip-agreement timing, the source anchors, and the no-motion CSS constraint, all on the real classic `paint()`.
- **Phase gate (Task 3):** `npm test` **3607/3607** (green; +75 over the phase-base 3532; +32 this plan: 20 in Task 1, 12 in Task 2). `npm run build:www` exit 0. `git diff --stat 4d43edf..HEAD -- engine/ content/ test/parity/` empty. `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged). `git diff 4d43edf..HEAD -- package.json package-lock.json` empty. `node --test test/unit/bridge-registry.test.js` 10/10 (set-equality AND doc-sync). `npm run boot:check` exit 0 (PASS on all four checks — no-uncaught/painted/graves/title; this machine did NOT reproduce the Phase 50 environment block recorded in STATE.md's Blockers/Concerns).
- **Todo closure:** the four `resolves_phase: 57` todos moved to `.planning/todos/completed/` via `git mv`, each with a `## Resolved` heading naming its resolving plan(s); the darkness todo's note additionally records the discovery-block correction.

## Task Commits

Each task was committed atomically:

1. **Task 1: src/browser/darknessView.js, the __mzDarkness bridge, and the characterisation pins** - `c0e2a9b` (feat)
2. **Task 2: The counter-driven vignette, the DARK chip's real card, and the named cancel** - `6172794` (feat)
3. **Task 3: Phase gate, todo closure, and the deferred device list** - `f964b24` (docs)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/browser/darknessView.js` (new) - `VIGNETTE_LEVELS`, `vignetteFor`, `waiverFor`
- `src/browser/bridge.js` - `__mzDarkness` BRIDGE row (owner/consumers/purpose, extended for skill/eff)
- `docs/SHELL-MODULES.md` - regenerated (`node tools/bridge-doc.mjs --write`)
- `mazeworld.html` - `#mw-vignette` id + two CSS attribute rules; `paintVignette(c)` + its `paint()` call site; the darkness chip's waiver-detection + `explainText`; `CONDITION_EXPLAIN.darkness` rewritten; `WAIVER_LABEL`; the `__mzDarkness` import line and bridge assignment
- `src/browser/rail.js` - `darknessFell`/`darknessDispelled` RAIL_FAMILY rows
- `test/unit/darkness-filter.test.js` - 5 new "Phase 57 characterisation" tests
- `test/unit/darkness-vignette.test.js` (new) - 27 tests (15 module/end-to-end + 12 shell section)
- `test/unit/shell-map-hud.test.js` - extended the CONDITION_EXPLAIN coverage test for the darkness entry's radius-rule/to-hit-penalty wording
- `test/unit/shell-gear-39.test.js` - re-pinned the guardTap call-site literal to `explainText` (Rule 1, see Deviations)
- `.planning/todos/completed/2026-09-19-rail-overlays-...md`, `2026-09-21-map-chip-strip-...md`, `2026-09-21-hud-reflow-...md`, `2026-09-21-table-7-darkness-...md` - moved from `pending/`, each with a `## Resolved` note

## Decisions Made

See `key-decisions` in the frontmatter above (the raw-vs-clamped radius split in `vignetteFor`; `waiverFor`'s most-durable-first precedence; the separate import line for the three-existing-pin precedent; the `explainText` local re-pin; `darknessFell`'s title matching the torch-offer card's own heading).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A pre-existing test pinned the exact `explainCondition(cn, label)` inline call-site literal**
- **Found during:** Task 2, full `npm test` run
- **Issue:** `test/unit/shell-gear-39.test.js` asserted the literal regex `window\.mzRailLine\?\.\(label\.toUpperCase\(\), explainCondition\(cn, label\), "info", 8400, "·"\)` against `paintConditions`'s guardTap call site. USER RULING 2026-09-22 required the darkness chip's tap card to lead with a named waiver when one is open, which the plan's own action text requires computing BEFORE the guardTap call (`explainText`) — the old inline `explainCondition(cn, label)` call could no longer serve every chip.
- **Fix:** Re-pinned the assertion to the new literal `window\.mzRailLine\?\.\(label\.toUpperCase\(\), explainText, "info", 8400, "·"\)`, with a comment recording that `explainCondition(cn, label)` is still exactly what non-darkness chips reach (asserted two lines above the re-pin, unchanged).
- **Files modified:** `test/unit/shell-gear-39.test.js`
- **Verification:** `node --test test/unit/shell-gear-39.test.js` green (10/10).
- **Committed in:** `6172794` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a necessary consequence of the plan's own required waiver-leading change landing correctly in a pre-existing pinned call site).
**Impact on plan:** No scope creep; the plan's own action text explicitly required this call-site shape.

## Issues Encountered

- **Self-corrected mid-execution: a `git checkout -- mazeworld.html` teeth-check revert briefly wiped ALL of Task 2's uncommitted `mazeworld.html` edits, not just the single teeth-check line.** `git checkout -- <file>` reverts the WHOLE file to its last-committed state, not just the lines touched by a prior `Edit` call — since Task 2's `mazeworld.html` changes were still uncommitted at that point (multiple edits spanning CSS, markup, `CONDITION_EXPLAIN`, `paintConditions`, and `paintVignette`), the revert silently discarded all of them at once. Caught immediately via `grep`/`git diff` (the `__mzDarkness` bridge assignment had reverted to Task 1's 5-key form, `#mw-vignette`'s id and the CSS rules were gone). Reconstructed every edit from the conversation's own record, re-verified byte-for-byte against a fresh `git diff` before re-running the full suite (3607/3607 green both before and after). **Corrective action taken:** for the remainder of this plan, Task 2's `mazeworld.html`/`darknessView.js` changes were committed FIRST, and the two teeth checks (the `vignetteFor` close/near inversion; the `paintVignette` `mapViewRadius`→`revealRadius` swap) were run and reverted AFTER that commit landed, so `git checkout --` only ever restored to an already-correct, already-committed state. No lasting effect on the shipped code — both teeth checks proved their catches (4 and 5 failing tests respectively) and reverted cleanly, confirmed by `git status --short` showing nothing but the untracked planner files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The vignette state comes from the engine's own `inDark`/`mapViewRadius` through `__mzDarkness`, with no second copy of the rule in the shell; the Phase 41 render-window filter is untouched and now characterised by its own pins.
- The DARK chip names any waiver holding the dark back — the actual 2026-09-21 device report is closed, not just the vignette that was originally proposed as its fix.
- `engine/`/`content/`/`test/parity/` stay byte-identical to the phase base (`4d43edf`); `package.json`/`package-lock.json` untouched.
- All four `resolves_phase: 57` todos are in `todos/completed/` with their resolving plans named — this was the LAST plan in Phase 57.
- Phase 57 is NOT marked complete by this plan — a fifth plan (`57-05`, importing the 2026-09-22 HUD compaction + hamburger-menu mock) is being planned concurrently by the orchestrator; STATE.md/ROADMAP.md are updated for plan progress only, per this run's standing conventions.
- Deferred device checks (D10/D11 above, plus the nine `human_verification` items below) are recorded for the Phase 60 batched Pixel 7 session per the standing deferred-UAT protocol.

## Human Verification (Deferred — Phase 60 batched Pixel 7 session)

1. The map does not jump or shift on any rail show or hide.
2. The rail overlays the screen without covering the tab bar, respecting the device's safe-area inset.
3. A body tap dismisses a plain (no-button) rail card.
4. A body tap on a decision (button-bearing) rail card does NOT dismiss it — only the buttons do.
5. A four-line rail card reads comfortably before it clears, at the new doubled/line-scaled hold.
6. Tapping each of MARKS / CENTRE / MAKE CAMP / gear with the party one or two cells below causes zero party movement.
7. Walking the party to the top edge fires the keep-in-view nudge with the map chip band fully clear of the map.
8. Past 1,000 Squares, no HUD band overlaps another at text sizes S, M and L.
9. Rolling Table-7 Darkness without light gear visibly closes the map vignette to radius 1 while the DARK chip counts down; cancelling it with a live Amulet of Light clears the vignette and the chip together on the same step, with a line in the Oracle.

---
*Phase: 57-map-hud-layout-band*
*Completed: 2026-09-22*

## Self-Check: PASSED

All created/modified files and referenced commit hashes (`c0e2a9b`, `6172794`, `f964b24`, `faa137a`) verified present on disk / in git log.
