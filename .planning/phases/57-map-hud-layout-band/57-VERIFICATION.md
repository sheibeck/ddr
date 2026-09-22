---
phase: 57-map-hud-layout-band
verified: 2026-09-22T22:30:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD f220718); device checks deferred to the Phase 60 batch
behavior_unverified: 0
overrides_applied: 1
human_verification:
  - "LAYOUT-01 (Pixel 7): the map does not jump or shift on any rail show or hide — the party stays on the same screen pixel through a full show/hold/hide cycle"
  - "LAYOUT-01 (Pixel 7): the rail overlays the bottom of the play area without covering the tab bar at any safe-area inset"
  - "LAYOUT-02 (Pixel 7): a body tap dismisses a plain (no-button) rail card; a body tap on a decision card does NOT dismiss it — only its buttons do"
  - "LAYOUT-03 (Pixel 7): a four-line rail card reads comfortably before it clears at the doubled, line-scaled hold"
  - "LAYOUT-04 (Pixel 7, supersedes 57-01/57-04's chip-tap item): with the party 1-2 cells below band 2, open the ☰ and tap each row (MARKS / CENTRE MAP / MAKE CAMP / SETTINGS) — zero party movement; a map tap while the menu is open only closes it; a tab tap while open closes it, a second tap switches; the map never shifts"
  - "LAYOUT-04 (Pixel 7): walking the party to the top edge fires the keep-in-view nudge with nothing of the map hidden under the HUD"
  - "LAYOUT-05 (Pixel 7): past 1,000 Squares no HUD band overlaps at text sizes S and M; at L band 1 does not overlap, the ☰ stays visible and Rations clips ~34px (accepted)"
  - "LAYOUT-05 (Pixel 7): ☰ ◈ ⊕ ☾ ⚙ render as text glyphs in the mock colours (no tofu/emoji substitution); the ☰ is reachable one-handed"
  - "LAYOUT-05 (Pixel 7): on the Dead tab the HUD is gone and the first line clears the status bar"
  - "LAYOUT-06 (Pixel 7): rolling Table-7 Darkness without light gear closes the vignette to radius 1 while the DARK chip counts down; with a lit torch / Amulet of Light / Night Vision the chip names the waiver and the tap card leads with it; an Amulet cancel clears vignette and chip together with an Oracle line; the vignette reads as darkness against the Phase 35 palette"
gaps: []
---

# Phase 57 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, standing 2026-09-14 ruling)

Goal-backward check of the phase goal: *the map screen's chrome stops fighting the map — the rail overlays instead of reflowing the viewport, chip taps never double as a move, and the HUD reads as legible stacked bands with darkness visible on the map itself.*

Five plans, strictly sequential on the main tree (every plan edits `mazeworld.html`). 57-01..04 were planned up front; **57-05 was added mid-phase from the user's 2026-09-22 HUD mock** (chip band folded into a ☰ menu, HP strip under band 1). Worktrees were degraded (`fork-ref-unknown`) for 57-01..02 and re-enabled during the run (`worktree.baseRef: head`, user request) — immaterial here since every plan shared `mazeworld.html`.

## Evidence (orchestrator re-run at HEAD)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | Rail slides over the map; the viewport neither resizes nor reflows | `#mw-rail` is `position:absolute` inside the new `#mw-stage` wrapper (57-02) — out of `#app`'s flex flow in every state, so no show/hide can take height from `.mw-maze-viewport`. `rail-overlay.test.js` (7) proves the out-of-flow rule, the unbroken definite-height flex chain, and that `renderRail()` calls neither `fit()` nor the keep-in-view nudge; teeth check confirmed (restoring `flex:none;min-height:132px` fails test 1). **Finding carried to Phase 58 (see override below).** |
| 2 | A body tap dismisses a no-decision card; a decision card clears only by deciding | `railDismissKind(locked, buttonCount)` (pure, `rail.js`) + a guarded `#mw-rail` body-tap handler (57-03): button targets pass through, an arm window (`isArmed(railShownAt, now)`) blocks the ghost tap, a locked/button-bearing card pulses instead of dismissing, and the tap never reaches `tapStep`. `rail-dismiss.test.js` (10) with two teeth checks |
| 3 | A card stays on screen roughly twice as long | Every `RAIL_HOLD` value and `WORN_RECONCILE_HOLD` exactly doubled against `4d43edf`, plus `HOLD_PER_LINE` 900 ms bounded by `HOLD_MIN` 4400 / `HOLD_MAX` 16000 via `holdForCard(card)`; pins re-pinned to exact values |
| 4 | Chip taps never also move the party; the party is never under the chip strip | 57-01 moved the chips out of the viewport; **57-05 (user mock) retired the chip band entirely** — MARKS / CENTRE MAP / MAKE CAMP / SETTINGS are rows of a ☰ dropdown on band 2 whose outside-tap is consumed by a scrim structurally outside `#mw-maze-viewport` (z-ladder rail 4 / scrim 5 / menu 6 / enc-panel 8). `hudMenuNext` is a total, fail-closed reducer (closes on select, re-tap, outside, tab, encounter, Escape; Android back also closes); opening is refused during an encounter. `hud-menu-layout.test.js` (15) with teeth checks on scrim consumption and the z-ladder |
| 5 | HUD reads as stacked bands with nothing overlapping; Table-7 darkness visible on the map with its remaining time | 57-01/57-05: band 1 (name / dim line / `x/y HP`) → 4px HP strip → band 2 (counters in slots sized to real limits: Squares 5, Depth 3, Day 3, Rations 2, + ☰) → condition chips; HUD hidden on Dead; `paint()`'s ids preserved. 57-04: `__mzDarkness` reads the engine's `inDark` / `mapViewRadius` (never recomputed); `paintVignette` follows `mapViewRadius` (user ruling b); the DARK chip names an open waiver (Night Vision / Amulet of Light / lit torch — user ruling a, the actual cause of the 2026-09-21 report) and its tap card leads with it; `darknessFell` / `darknessDispelled` get named rail rows. Five characterisation pins prove the waiver divergence (`revealRadius` 1 vs `mapViewRadius` Infinity under a torch) |
| — | Gates | `npm test` **3633 / 0** (3532 at phase base 4d43edf → +101 across five plans). `npm run build:www` exit 0. `git diff --stat 4d43edf..HEAD -- engine/ content/ test/parity/` **empty**; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `package.json`/lock untouched. `bridge-registry.test.js` 10/10 (set-equality + doc-sync) with the new `__mzDarkness` and `__mzHudMenu` rows |

## Override (1) — the rail's hidden state was never actually animatable

Found by the Phase 58 planner, verified by the orchestrator: the global reset on `mazeworld.html` line 11, `[hidden]{display:none!important}`, outranks 57-02's non-important `.mw-rail[hidden]{display:block;…}`. A hidden rail is therefore still `display:none`. **LAYOUT-01 is unaffected** — the rail is absolutely positioned in every state, so the viewport cannot reflow (criterion 1 holds, proven structurally above) — but 57-02's must_have *"the hidden-attribute rule restores a block display … keeping the element laid out (and therefore animatable by Phase 58)"* is false at HEAD, and 57-02's source-text tests could not see it. Accepted as a carried item rather than a Phase 57 gap because its only consequence is Phase 58's slide animation, and **plan 58-04 already fixes it** (`display:block!important` on the rail's hidden rule, with a computed-cascade test).

## Notes the reader should have

- **57-05 is a user-driven revision, not a fix.** The 2026-09-21 four-band ruling was superseded by the 2026-09-22 mock; LAYOUT-04/05, ROADMAP criteria 4–5 and `57-CONTEXT.md` (Amendment section) were amended to cite it. User rulings recorded in the plan: slots sized to real limits; the ~34px Rations clip at text size L accepted; the one wording change adopted from the mock is **CENTRE MAP**; condition chips stay on every tab but Dead at the current size; mock glyphs only inside the menu.
- **57-04's executor destroyed and rebuilt uncommitted work.** A teeth-check `git checkout -- mazeworld.html` ran before Task 2 was committed, reverting it; the executor rebuilt it from its session record. The orchestrator re-ran the suite (3607/3607) and read the rebuilt `paintVignette` against the plan; both teeth checks were re-run against the rebuilt code and failed as expected. From 57-05 on, the run convention is *commit the task, then teeth-check*.
- **`npm run boot:check` passes again** (57-04 and 57-05 both ran it green), so the Phase 50 "environment-blocked" concern in STATE.md did not reproduce in this session.
