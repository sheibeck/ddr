# Phase 76: Darkness Unification & Relaunch Persistence - Context

**Gathered:** 2026-09-25 (collected ahead, while Phase 72 wave 5 executed)
**Status:** Ready for planning

<domain>
## Phase Boundary

- One shared darkness-waiver rule governs everything the player experiences as dark (DARK-01/02): reveal while walking, the render window, per-tile dark painting, the DARK chip and the map vignette.
- Saving or force-closing never lets a player escape a live fight or an open store (SAV-06/07). A pending find and a pending hazard also survive a relaunch.

**Not in scope:**
- New light sources.
- Darkness balance tuning beyond recording the readout.
- The relaunch of any other transient UI (menus, sheets).
</domain>

<decisions>
## Implementation Decisions

### Darkness unification (user accepted 2026-09-25; direction ruled 2026-09-22)
- **One shared predicate** (e.g. `darkWaived(state)`/`(c)`) waives the dark for BOTH `revealRadius` (what new cells enter `seen` as you walk, engine/derived.js ~L823) AND `mapViewRadius` (what already-seen cells render, ~L850).
  - The waivers are Night Vision, the Amulet (`eff("light") > 0`) and a lit torch (`itemEffectActive("lit")`). A torch now lights your way as you walk, not just the explored map.
  - `+ eff("sight")` stays the separate additive it already is.
  - `revealRadius` and `mapViewRadius` can never disagree again. Pin that with a test across every waiver × dark/non-dark tile.
- **Per-tile `tile.dark` painting** in `draw()` reads the same predicate.
  - While a waiver holds the dark back, dark tiles paint with a FAINT "lit by your light" tint, so the player still knows the area is dark and the light is doing the work.
  - With no waiver, full dark painting.
- **The DARK chip** keeps naming what holds the dark back ("your torch", "the Amulet", "Night Vision"), now from the single predicate. `src/browser/darknessView.js#waiverFor`'s three-way split collapses to two (waived by X / not waived).
- **The map vignette** follows the one radius. Remove Phase 57's "source argument" split and its pointer comment.
- **Difficulty:** the dark gets kinder to light carriers. Take a `tools/tune-difficulty.mjs` 200-seed readout before and after and record both in `docs/DIFFICULTY-RETUNE.md`. There is NO compensating nerf; the user judges at milestone close.
- **Engine gate:** widening `revealRadius` changes `seen`, which is serialized, so parity fixtures move.
  - Measure the moved set with `tools/fixture-inventory.mjs`.
  - Declare each with before/after in `test/parity/FIXTURE-INVENTORY.md` and regenerate ONLY those.
  - Never edit the prototype master. Greenfield, with no dual path.

### Relaunch persistence (user accepted 2026-09-25)
- **A resumed fight picks up at a clean round boundary:** the player's turn in the current round, with foes, HP, the round number, active effects (hero and foe, including `c.foeEffect`, the timers and per-round flags), cooldowns and foe order all intact.
  - `beats` (UI animation state) is NOT restored.
  - The Oracle adds a short in-voice resume line (e.g. "Still here. Still fighting.").
- **What survives a relaunch:** `combat`, `store` (same stock and prices), `pendingFind`, `pendingHazard`, and `pendingTile` (new in Phase 75, RULES-12). `pendingLoot` already survives (LOOT-06).
  - Carry each through `validateSave` and `rehydrate` (`engine/saveState.js` ~L735-745 currently nulls combat/store/beats/pendingFind/pendingHazard, copying the 1994 prototype's load).
- **Save & Quit mid-fight is allowed.** It resumes into the same fight, and force-closing can no longer escape one. Every combat action is already persisted by dispatch. Confirm the save after each action includes the live combat.
- **Old saves:** if a stored `combat`/`store`/pending value validates, resume it. If not, drop it as today (tolerant load, never a crash).
- **Engine gate:** measure which parity/roundtrip expectations move, declare them, and never edit the master. `test/persistence/resume-mid-encounter.test.js` (the 70-04 pin of today's drop behaviour) is REWRITTEN to pin the new resume behaviour, with a pointer to this phase.

### Claude's Discretion
- The predicate's name and module, the tint colour/alpha (within the parchment palette), the validation depth for a stored combat/store, and the resume-line wording (family-friendly, deadpan).
- Plan split: the darkness and persistence halves are independent and can run in parallel waves.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/derived.js`: `inDark` ~L794, `revealRadius` ~L823 (canon: ports `mazeworld.html` `reveal()`'s radius line 838), `mapViewRadius` ~L850 (Phase 41 TERR-03), `inViewWindow` ~L867.
- `src/browser/darknessView.js:105` `waiverFor(flags)`: the chip's waiver naming (Phase 57).
- `engine/saveState.js`: `validateSave`, `rehydrate` (~L735-745 null list), and the tolerant-load helpers pattern (e.g. `migrateCarry`, `migrateSpellNames`).
- `test/persistence/`: `resume-mid-encounter.test.js`, `lifecycle.test.js`, `storage*.test.js` and the harness (real engineAdapter + fake storage).

### Established Patterns
- The measured divergence (ROADMAP 999.8): `darkFor: 30` on a non-dark tile with a lit torch gives `revealRadius 1` / `mapViewRadius Infinity`. That's the bug.
- Parity comparables already strip several transient fields. A persisted `combat`/`store` may need carve-outs, since the prototype drops them.

### Integration Points
- Phase 77's effect indicators must read the rehydrated effects correctly after a relaunch.
- The milestone-close Pixel 7 checklist: relaunch mid-fight, relaunch mid-store, and a torch in the dark revealing as you walk.
</code_context>

<specifics>
## Specific Ideas

- Device report 2026-09-21: "It looks like I'm in the dark, but it's not limiting my vision."
- The 70-04 proof: in-session SAVE & QUIT → ENTER resumes exactly, but after a relaunch the fight is gone and force-close escapes it.
</specifics>

<deferred>
## Deferred Ideas

- Balancing the easier dark: only if the user asks after reading the readout.
</deferred>
