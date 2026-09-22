# Phase 57: Map & HUD Layout Band - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 12 decisions across 3 areas, all accepted as recommended

<domain>
## Phase Boundary

This phase makes the map screen's chrome stop fighting the map. Four surfaces, all in the shell: the **rail** stops reflowing the viewport and gains tap-to-dismiss and a longer hold; the **chip strip** leaves the viewport and becomes a real layout band; the **HUD** stacks into four bands instead of one clipping row; and **Table-7 darkness** gets a visible face on the map.

In scope: LAYOUT-01..06. This is the whole of backlog 999.4, promoted into the milestone — the four todos in `.planning/todos/pending/` tagged `resolves_phase: 57` are the source material and should be closed by this phase.

**Out of scope — this phase makes motion POSSIBLE, it does not add motion.** Phase 58 (MOTION-01..05) owns easing, transition curves, typed text and combat pacing. Here the rail moves from `display:none` to a `transform`/`visibility` model *because `display:none` cannot be animated* — but the transition itself, its duration and its easing curve are Phase 58's. Ship the rail with a transform-driven show/hide and let Phase 58 tune it. Likewise: no animated pan, no menu transitions, no typing effect.

Also out of scope: any engine or content change. In particular the darkness work is **legibility only** — see the re-fog decision below.

</domain>

<decisions>
## Implementation Decisions

### Rail overlay & dismissal (LAYOUT-01/02/03)

- **The rail becomes an overlay, not a flex sibling.** `position:absolute; left:0; right:0; bottom:0` inside `.mazebox`, shown and hidden with `transform: translateY(100%) → translateY(0)` plus `visibility`. **Never `display:none`** — that is what forces the reflow today (`.mw-rail{flex:none;min-height:132px}` at `mazeworld.html:687` + `.mw-rail[hidden]{display:none}` at `:688` inside the `#screen-maze` flex column), and it is also unanimatable, which would block Phase 58. Keep an `[hidden]`/`data-idle` state for accessibility but drive visibility with the transform.
- **The viewport must not move.** `.mw-maze-viewport` (`flex:1`, `:335`) keeps its size across every rail show/hide. This extends the Phase 35 / 260918-vm3 **stationary-camera ruling** to the rail: nothing but a drag, the keep-in-view nudge, CENTRE, stairs, teleport or a new run may shift the map. Verify `keepInViewAxis` / `mzKeepPartyInView` no longer fire on rail show/hide, and that `fit()` is not called from `renderRail()`.
- **No chip/rail collision to solve.** The chip strip moves to a top band (below), so a bottom-anchored rail never overlaps it. Do not build a "lift the chips when the rail shows" mechanism — the layout change removes the problem.
- **Holds roughly double AND scale by line count.** The current `RAIL_HOLD` table (`src/browser/rail.js:50`) is `default 4200, dull 2400, dullShort 2200, mark 3400, day 3000, floor 5000, camp 5200, level 6000`, plus `WORN_RECONCILE_HOLD 6000`. Double them as a base, then add a per-line increment — the user's complaint was "all the text", so a four-line card must hold longer than a one-line card. This mirrors the 2026-09-15 toast ruling ("about 2×, tap to dismiss") that the rail inherited the old numbers from. Update the `rail.test.js` pins on the numbers.
- **Tap-to-dismiss, guarded.** A `guardTap` handler on the rail element: if `railLocked()` is true **or** the card carries buttons, `railPulse()` and do NOT dismiss — the buttons are the only way out of a decision card (Phase 35 ruling 3). Otherwise clear `railTimer`, clear the rail view-model, re-render. A tap on a rail BUTTON must still route to that button (check the event target), and the tap must **not** fall through to `tapStep()` on the map.

### Chip strip & HUD bands (LAYOUT-04/05)

- **The chip strip leaves the viewport.** `.mw-map-chips` is `position:absolute; left:10px; right:10px; top:10px; z-index:3` *inside* `.mw-maze-viewport` today (`mazeworld.html:341`). It becomes a real layout band — a secondary header directly under the tab chits, outside the viewport, `position:static`, no `z-index`. This fixes **both** reported symptoms with one change and needs no canvas hit-test special-casing: (a) chip taps can no longer also reach the canvas's tap-to-move, and (b) `keepInViewAxis`'s `rect` becomes the true visible map, so the "within 2 cells of an edge" nudge stops counting cells hidden under the band. Keep the Phase 35 chip look (`.mw-map-chip`) and the MAKE CAMP / gear order (gear right of MAKE CAMP, v1.4 ruling).
- **The HUD becomes four stacked bands, in the user's ruled order (2026-09-21).** This **supersedes Phase 35 ruling 5's single-row HUD** — record the reversal in the code comment that currently documents it (`mazeworld.html:867-873`), do not silently contradict it.
  1. **Identity + vitals** — `Name — Race Class (Sub) · Lvl N` on the left; `x/y HP` text + threshold bar on the right, the bar taking the full remaining width so it can never collide.
  2. **Counters** — `Depth · Day · Squares · Rations`, one row.
  3. **Condition chips** — the existing `.mw-cond-strip`, still hidden when empty.
  4. **Map chip strip** — MARKS / CENTRE / MAKE CAMP / gear.
- **The identity line comes back.** Phase 35 (MAP-01, ruling 5) deliberately retired the name/class line from the HUD; the 2026-09-21 ruling reverses that. Band 1 carries it.
- **Counters get fixed-width numerals.** A tabular-nums slot sized for **5 digits**, so Squares growing past 1,000 (the reported trigger — the HP block landed on top of Rations) can never widen the row. Not wrapping, not `1.2k` abbreviation.
- **Preserve `paint()`'s contract.** Keep the ids `m-floor`, `m-day`, `m-steps`, `m-rations`, `mw-hud-wp` and the low/critical threshold classes. Safe-area padding stays on band 1. Other tabs and the DEV chip are unaffected.

### Darkness legibility (LAYOUT-06)

- **Give `c.darkFor` a face: dim every cell beyond the live reveal radius while the counter runs.** A vignette centred on the party. The bug the user hit is that `draw()` dims only `tile.dark` cells and nothing reads the counter, while fog-of-war is cumulative — so an already-explored corridor looks identical whether you are in a Table-7 darkness or not, even though the radius really is 1. Natural dark *paths* read as limited because their tiles are painted dim; the rolled condition has no visual form at all.
- **Reveal-only. Do NOT re-fog.** Re-fogging already-seen cells beyond radius 1 would be a **rules change** — `engine/movement.js`'s `reveal()` is cumulative and never re-hides — and would break this milestone's presentation gate, move fixtures, and need its own declared divergence. Recorded as a deliberate non-change; it remains available as a future phase if the vignette proves insufficient on device. **The engine is correct here and is not to be touched: the rules already work, this is purely legibility.**
- **`inDark` / `revealRadius` need a bridge entry — the todo's premise was wrong.** The 2026-09-21 todo says to read them "via the existing bridge"; they are not there (`grep` finds neither in `src/browser/bridge.js` nor the shell). Add the bridge entry properly, with its BRIDGE row and a `tools/bridge-doc.mjs --write` regen **in the same commit** — `bridge-registry.test.js` enforces both set-equality and doc-sync, exactly as Phase 56's `__mzSfxBackendOverride` did. Do **not** read `c.darkFor` raw in the shell and recompute the radius: that duplicates a rule in two places and will drift.
- **Keep the DARK chip; give its tap a real card.** The chip and its countdown already work (user confirmed it counts down). Its tap card should say what the counter actually does — radius 1 on unexplored ground, to-hit penalty in fights — and offer the torch when one is carried (the shell already has this shape at `mazeworld.html:3706`). Make sure the existing `darknessDispelled` line surfaces when an Amulet of Light cancels the condition, so the cancel is not silent.

### Claude's Discretion

- The exact vignette rendering (alpha ramp, whether it is a radial gradient or per-cell dimming), as long as it reads at radius 1 and respects the Phase 35 map palette.
- The per-line hold increment and the exact doubled base values, as long as they are recorded and the tests are re-pinned rather than loosened.
- Band-1 layout mechanics (how the identity text truncates on a narrow phone; the bar's exact flex behaviour).
- Whether the four HUD bands are four elements or a grid, as long as `paint()`'s ids survive and the order is the ruled one.
- How the chip band's markup nests relative to the tab chits, as long as it is outside `.mw-maze-viewport`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/browser/rail.js`** — `RAIL_HOLD` (`:50`), `WORN_RECONCILE_HOLD` (`:68`), the `RAIL_FAMILY` table and `railCardFor`. Hold values live here, not in the shell.
- **`src/browser/inputGuards.js`** — the `guardTap` helper the dismiss handler should use, rather than a raw listener.
- **`src/browser/controls.js:135`** — `keepInViewAxis(camAxis, partyAxis, spanCells)`; called from `mazeworld.html:3979-3983` with `rect.width / CELL` and `rect.height / CELL`. Once the chip band leaves the viewport, `rect` becomes honest with no change to this function.
- **`src/browser/bridge.js`** — the single `window.__mz*` registry with a set-equality test AND a doc-sync test against `docs/SHELL-MODULES.md`. Phase 56 added `__mzSfxBackendOverride` through it; follow that commit's shape exactly (registry row + `tools/bridge-doc.mjs --write` in the same commit).
- **`engine/derived.js`** — `inDark(state)` (~`:794`) and `revealRadius(state)` (~`:824`) already implement the rule; the shell needs to read them, not reimplement them.

### Established Patterns

- **Stationary camera (Phase 35 / 260918-vm3):** the map moves only on a drag, the keep-in-view nudge, CENTRE, stairs, teleport, or a new run. Any chrome change that shifts the viewport violates this.
- **Decision cards lock the rail** (`railLocked()`); minor events are toast-only with their narrative line (the 2026-09-15 card-vs-toast ruling). Tap-to-dismiss must respect that split.
- **Bridge additions are three-part**: the export, the BRIDGE registry row, and the regenerated doc — all in one commit, or `bridge-registry.test.js` fails.
- **Presentation-only phases keep `engine/`+`content/` byte-identical** and never move a parity fixture.

### Integration Points

- `mazeworld.html:318` `.mazebox` (the rail's new positioning parent — already `position:relative`), `:335` `.mw-maze-viewport`, `:341` `.mw-map-chips`, `:687-688` `.mw-rail` + its `[hidden]` rule, `:866-893` the HUD CSS block and its Phase 35 ruling comment, `:1365-1391` the HUD markup and `.mw-cond-strip`, `:1415-1420` the chip markup, `:3706` the torch-offer card, `:3964-3983` the keep-in-view nudge, `:3740` the combat rail suppression, and the `renderRail()` body.
- The four pending todos tagged `resolves_phase: 57` carry the user's verbatim wording and should be moved to `todos/completed/` as this phase closes them.

</code_context>

<specifics>
## Specific Ideas

- The user's words on the chip strip (2026-09-21): *"clicking on marks, center, make camp or settings moves the party on the map. Plus, we're not accounting for that space when we adjust the map as we get too close. Can we make that space a reserved space that is outside the map, like a secondary header just under the chits."* — the "secondary header just under the chits" is the literal instruction for placement.
- The user's words on the HUD (2026-09-21): *"once we moved over 1k steps the hit point bar now sits over top of the ratings. I think we need to put the name/class and hit points at the very top. Then steps/days/depth on the next row, then condition chits on the next row, then the buttons from our previous capture."*
- The user's words on darkness (2026-09-21): *"It looks like I'm in the dark, but it's not limiting my vision."* — the fix is to make the existing, correct limit visible, not to change the limit.

</specifics>

<deferred>
## Deferred Ideas

- **Re-fogging cells beyond radius 1** — a rules change with declared fixtures; explicitly not this phase, and only worth revisiting if the vignette reads as insufficient on device.
- **All easing and transition tuning** — Phase 58 (MOTION-01..05). This phase only makes the rail animatable.
- **Backlog 999.5** (combat screen & Oracle readability) — a different surface; the status-chit-in-combat todo lives there, not here, even though it is rail-adjacent.
- **Haptics on the new tap surfaces** — already on the Future Requirements list.

</deferred>
