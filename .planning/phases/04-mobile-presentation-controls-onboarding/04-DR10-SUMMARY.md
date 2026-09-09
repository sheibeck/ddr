---
phase: 04-mobile-presentation-controls-onboarding
plan: DR10 (device-review revision round 10 — map-view vitals + Hero-panel Grimoire, live user direction, ad hoc — not a numbered PLAN.md)
subsystem: magic-ui
tags: [grimoire, spells, magic, hero-tab, map-hud, vitals, out-of-combat-casting, device-review]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-06/04-DR4/DR5: the MAP tab's .mw-map-heading row and .mazebox layout this round adds a vitals readout beside"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-03: src/browser/viewModels.js's characterSheetViewModel pattern (pure, DOM-free, real-GameState-bound view-models) — grimoireViewModel follows the same convention"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR8: window.mzCastSpell/engineCombatAction (the dispatch()->applyAction() bridge) — reused verbatim for the Grimoire's out-of-combat cast button, no new dispatch path"
provides:
  - "A compact HP+LEVEL readout beside the MAP heading (#mw-map-vitals), bound to real GameState.c.wp/c.maxWP/c.level, refreshed by paint() on every action — health visible without opening HERO"
  - "content/spells.js#combatOnly — a boolean per spell (all 32) classifying non-combat/utility/self spells (castable from the Grimoire outside an encounter) vs. combat-only/offensive spells (need a live foe)"
  - "src/browser/viewModels.js#grimoireViewModel(state) — the HERO tab's Grimoire rows: the character's own c.grimoire spells, sorted by level then name, each with a castable/disabledReason verdict"
  - "A Grimoire panel on the HERO tab (#grimoire-panel) listing every learned spell with a working Cast button for non-combat spells (routed through the existing window.mzCastSpell bridge) and a disabled 'Combat only' row for combat-only spells"
affects: [05-graveyard-voice-system]

tech-stack:
  added: []
  patterns:
    - "A spell's combat-only-ness is DERIVED from its `kind`'s actual behavior in engine/magic.js#castSpell (does the branch read state.combat/liveFoes(), or does it only touch c.* fields unconditionally?), not guessed from the spell's name/flavor text — this caught two subtleties: Summon has an explicit non-combat path (c.pendingAlly, joined by the next encounter) so it's non-combat-castable despite reading like an offensive spell, and Earthquake/Death actively HARM the caster for zero benefit if cast with no foe present, which is exactly why they're combat-only despite technically not crashing."
    - "New castability/gating logic for a UI surface (grimoireViewModel) lives in src/browser/viewModels.js as a pure, DOM-free, read-only function bound to real GameState — the SAME convention 04-03's characterSheetViewModel established — rather than duplicating gate logic inline in mazeworld.html's module script or adding a new engine/magic.js export. The engine's own castSpell was NOT modified: it already supported every non-combat spell kind gracefully (heal/ward/might/mirror/senses/reveal/foresee/regen unconditionally touch only c.*; summon explicitly branches for no-combat), so 'enable out-of-combat casting' turned out to be a UI-gating and classification task, not an engine capability gap."
    - "The out-of-combat cast path reuses window.mzCastSpell(idx)/engineCombatAction verbatim (the same bridge the in-combat SPELLS menu already calls) instead of adding a second dispatch function — paint()/renderEncounter() already tolerate being called with no active encounter (hasActiveEncounter() hides the overlay), so no new code path was needed to make casting safe outside combat."

key-files:
  created:
    - test/unit/grimoireViewModel.test.js
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR10-SUMMARY.md
  modified:
    - mazeworld.html
    - content/spells.js
    - src/browser/viewModels.js
    - test/unit/content-tables.test.js
    - test/unit/magic.test.js

key-decisions:
  - "combatOnly classification (12 non-combat: Heal, Shield, Strength, Detect Magic, Mirror Self, Summon, Major Heal, Bubble, Sense Danger, Sense Presence, Phantom Host, Regeneration; 20 combat-only: everything else) is derived per-`kind` from castSpell's actual code, not per-spell-name — every spell sharing a kind gets the same classification (e.g. both Summon and Phantom Host, kind:\"summon\", are non-combat; every kind:\"thrown\" spell is combat-only). Documented inline in content/spells.js's own header comment so a future spell addition can classify itself by inspecting which fields its kind reads."
  - "Enforcement of 'combat-only spells are NOT castable outside combat' lives ENTIRELY in the UI gate (grimoireViewModel's disabledReason + the Grimoire's disabled Cast button), not as a new refusal branch inside engine/magic.js#castSpell. This matches the EXISTING precedent in this codebase — the in-combat SPELLS menu already decides which spell buttons to show via a UI-side canCast(sp) check, not an engine-side block — and avoids risking test/parity/magic-parity.test.js's byte-for-byte prototype fidelity (the prototype's own castSpell has no such guard; adding one inside the shared function would also silently change readScroll's forced-cast behavior for every caller, a bigger, riskier change than this round's stated scope)."
  - "Reused window.mzCastSpell(idx) (already used by the in-combat SPELLS menu) as the Grimoire's own Cast button handler rather than adding a new window.mzCastSpellOutOfCombat — engineCombatAction's dispatch()->applyAction()->engine/magic.js#castSpell chain, plus paint()/renderEncounter(), already work correctly with no active encounter, so a second code path would have been a needless duplicate."
  - "The map-heading HP+level readout binds directly in paint() (mirroring the existing s-wp/s-wpmax/s-level pattern already there for the HERO sheet) rather than going through a new view-model — the values (c.wp/c.maxWP/c.level) are a direct, unmodified read with no derived logic worth centralizing, unlike the Grimoire's castability gate."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1 through 04-DR9-SUMMARY.md's own precedent.

duration: ~2h
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR10: Map-view vitals + Hero-panel Grimoire Summary

Added a compact HP+level readout beside the MAP heading so health is visible without leaving the map, classified all 32 spells as combat-only vs. non-combat/utility (data-driven, derived from each spell's actual `kind` behavior in `engine/magic.js#castSpell` — not guessed), and built a Grimoire section on the HERO tab listing every spell the character has learned, sorted by level then name, with a working Cast button for non-combat spells (Heal, Detect Magic, Sense Presence, etc.) that routes through the existing engine dispatch bridge, and a disabled "Combat only" row for offensive/target-a-foe spells. No engine runtime changes were required — `castSpell` already handled every non-combat spell kind gracefully; the actual work was classification (`content/spells.js#combatOnly`), a new pure view-model (`grimoireViewModel`), and wiring the HERO tab UI. Three atomic commits, each rebuilt (`npm run build:www`) and fully tested (`npm test` + `npm run test:quick`) before the next group's edits began.

## Performance

- **Duration:** ~2h
- **Completed:** 2026-09-08
- **Groups:** 3 (map heading HP+level; spell classification + out-of-combat cast gating; HERO Grimoire UI) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 5 (`mazeworld.html`, `content/spells.js`, `src/browser/viewModels.js`, `test/unit/content-tables.test.js`, `test/unit/magic.test.js`) + 1 created (`test/unit/grimoireViewModel.test.js`)
- **Tests:** 472 → 491 (`npm test`), 383 → 402 (`npm run test:quick`) — 19 new tests, all green throughout

## Accomplishments

### Group 1 — Map heading HP + level (`6813d40`)

1. **Added a compact HP+LEVEL readout beside the "MAP" heading** (`.mw-map-heading-row` wraps the existing `<h2>` plus a new `#mw-map-vitals`: `LVL <roman>` + `HP n/max` with a thin track/fill bar). Bound in `paint()` to the SAME `c.wp`/`c.maxWP`/`c.level` values already driving the HERO sheet's Win Potential bar/LVL badge — one paint() call, two render targets, no new data source.
2. **Colorblind-safe:** the numeric "HP n/max" label is always rendered alongside the bar; the low-health color swap (`--stamp` red below 34%) is never the sole signal, matching the HERO sheet's own `.wpbar .fill.low` convention.
3. **Reused the dark torch-lit visual language** (`--paper-3`/`--rule`/`--moss`/`--stamp` tokens, matching the WIN POTENTIAL bar treatment) rather than inventing new chrome.

### Group 2 — Spell classification + out-of-combat cast gating (`609c77d`)

1. **Added `content/spells.js#combatOnly`** (boolean, all 32 entries) derived from each spell's `kind` and what that kind's branch in `engine/magic.js#castSpell` actually reads:
   - **Non-combat (12):** Heal, Shield, Strength, Detect Magic, Mirror Self, Summon, Major Heal, Bubble, Sense Danger, Sense Presence, Phantom Host, Regeneration — each kind's effect branch is unconditional (touches only `c.*` fields) or explicitly supports a no-combat caller (Summon/Phantom Host's `kind:"summon"` sets `c.pendingAlly`, auto-joined by the next `startCombat()`, when `state.combat` is null).
   - **Combat-only (20):** everything else — each kind's branch needs `state.combat`/`liveFoes()` to find a target; cast with none present, most are a silent wasted-charge no-op, and two (Earthquake, Death) actively harm the caster for zero benefit (Earthquake's unconditional self-damage guard fires even with no foes to hit; Death's unconditional 25wp cost proceeds even with nothing to kill).
   - No `engine/magic.js` runtime changes were needed — confirmed by exercising Heal/Shield/Bubble/Strength/Detect Magic/Sense Presence/Sense Danger/Summon with `state.combat: null` in `test/unit/magic.test.js`; every one already worked correctly.
2. **Added `src/browser/viewModels.js#grimoireViewModel(state)`** — a pure, DOM-free, read-only view-model (matching `characterSheetViewModel`'s established convention) returning the character's `c.grimoire` spells sorted by level then name, each row carrying `combatOnly` plus a `castable`/`disabledReason` verdict (`"Combat only"` / `"Only outside combat"` / `"Not ready yet"` / `"No charges left"`) composed from `engine/derived.js#canCast` (existing grimoire/level/school gate) + the new `combatOnly` flag + in-combat state + `engine/movement.js#maxCharges`.
3. **Fixed a latent bug** in `test/unit/magic.test.js`'s `fixedFloor()` helper: it built an undersized 3×3 grid while `engine/maze.js`'s `GW`/`GH` are 21×21, so any test exercising `castSpell`'s `"reveal"` kind (Detect Magic) threw `Cannot read properties of undefined`. Fixed to build a correctly-sized `GW × GH` grid (Rule 1 — auto-fixed bug found while adding the new Detect Magic test).
4. **Updated `test/unit/content-tables.test.js`** with 3 new tests: every spell has a boolean `combatOnly`, the exact 12-name non-combat set, and spot-checks on Fireball/Death/Doze (`combatOnly: true`).
5. **Added `test/unit/grimoireViewModel.test.js`** (10 tests) and 6 new `castSpell` out-of-combat tests in `magic.test.js` (Detect Magic, Sense Presence, Sense Danger, Summon's `pendingAlly` path, and Earthquake/Death's "still costs you, gains nothing" combat-only behavior with `state.combat: null`).

### Group 3 — HERO tab Grimoire UI (`080701d`)

1. **Added `#grimoire-panel`** to the HERO tab, between "Special skills" and "The Maze Master's notes," listing every spell in `c.grimoire` via `grimoireViewModel`, sorted by level then alphabetically, with the spell level shown left of the name (`L2  Detect Magic`) plus a short effect line (`sp.txt`).
2. **Non-combat spells get a working ≥48dp Cast button** (`.small` button class, already ≥48dp) wired to `window.mzCastSpell(idx)` — the SAME `dispatch()->applyAction()` bridge the in-combat SPELLS menu already uses, applying the spell's effect and refreshing vitals through the normal `paint()` cycle (no new dispatch path). Disabled with an inline reason (`title` attribute + visible hint text) when blocked by the level/school gate, charge economy, or an active encounter.
3. **Combat-only spells are shown, grayed** (`.grim-locked` — desaturated left accent bar, matching the existing `ul.skills li.none` treatment) with a static "Combat only" hint instead of a button — never hidden, so the player can see what they'll be able to cast once a fight starts.
4. **`renderGrimoire()`** (trailing module script) is called from `paint()` via a `window.__mzRenderGrimoire` bridge (same optional-chained bridge pattern as `window.move`/`window.__mzState`), so the Grimoire refreshes automatically after every action alongside the rest of the HERO sheet.
5. **Dark torch-lit styling**: `.grimoire` rows reuse `ul.skills`' existing left-accent-bar treatment in a row (not column) layout so the Cast button/hint sits on the right without awkward wrapping; no new color tokens introduced.

## Task Commits

1. **Group 1 — Map heading HP + level** — `6813d40` (feat)
2. **Group 2 — Spell classification + out-of-combat cast gating** — `609c77d` (feat)
3. **Group 3 — HERO tab Grimoire UI** — `080701d` (feat)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next group's edits began.

## Files Created/Modified

- `mazeworld.html` — `.mw-map-heading-row`/`.mw-map-vitals`/`.mw-map-hp*` markup+CSS and `paint()` binding (Group 1); `#grimoire-panel`/`ul.grimoire`/`.grim-*` markup+CSS, `renderGrimoire()` + `window.__mzRenderGrimoire` bridge in the trailing module script, and the `paint()` hook calling it (Group 3).
- `content/spells.js` — added `combatOnly: boolean` to all 32 SPELLS entries plus a header comment documenting the derivation rule.
- `src/browser/viewModels.js` — added `grimoireViewModel(state)`, imported `SPELLS`/`canCast`/`maxCharges`.
- `test/unit/content-tables.test.js` — 3 new SPELLS/combatOnly tests.
- `test/unit/magic.test.js` — 6 new out-of-combat castSpell tests; fixed `fixedFloor()`'s undersized grid.
- `test/unit/grimoireViewModel.test.js` (new) — 10 tests covering sorting, castability gating, and read-only/no-rngState-mutation guarantees.

## Decisions Made

See `key-decisions` in the frontmatter above (kind-derived classification rule, UI-only enforcement of the combat-only refusal vs. an engine-level guard, reusing `window.mzCastSpell` rather than a second dispatch path, and why the map-heading readout binds directly in `paint()` rather than through a view-model).

## Deviations from Plan

### Auto-fixed issues (Rule 1 — bug fix)

**1. [Rule 1] `test/unit/magic.test.js`'s `fixedFloor()` helper built an undersized 3×3 grid.** `engine/maze.js` defines `GW`/`GH` as 21×21, and `castSpell`'s `"reveal"` kind (Detect Magic) iterates the full `GW × GH` grid unconditionally — any test exercising that branch against the old 3×3 fixture crashed with `Cannot read properties of undefined (reading 'wall')`. No existing test happened to exercise that branch before this round. Fixed by building a correctly-sized grid from the real `GW`/`GH` constants.
- **Found during:** writing the new "Detect Magic (non-combat) works with no active encounter" test.
- **Files modified:** `test/unit/magic.test.js`.
- **Commit:** `609c77d`.

No other deviations — engine/magic.js required no runtime changes (every non-combat spell kind already worked correctly with `state.combat: null`), and the plan's UI/data-classification scope was implemented as specified.

## Known Stubs / Threat Flags

None. This round is spell-content classification, a pure read-only view-model, and presentation wiring for two existing screens (MAP heading, HERO tab) — no new network endpoints, auth paths, file access patterns, or schema changes at a trust boundary. Casting continues to go exclusively through `applyAction`'s existing `"castSpell"` action; no presentation code reads or mutates `GameState.rngState`.

## Verification

- `npm run build:www` — succeeds at every commit checkpoint; `www/index.html` confirmed to contain the new `#s-grimoire`/`grimoireViewModel`/`#mm-hpfill` markup and imports.
- `npm test` — **472 → 491/491 green** (19 new tests: 3 content-tables, 6 magic.test.js out-of-combat, 10 grimoireViewModel), green at every checkpoint.
- `npm run test:quick` — **383 → 402/402 green** at the final checkpoint.
- Both the classic (non-module) `<script>` block and the trailing `<script type="module">` block were extracted and syntax-checked independently via `node --check` after each group's edits (no headless-DOM/visual harness exists in this project, consistent with prior `04-DR*-SUMMARY.md` notes).
- Self-check below confirms every claimed file/commit/test exists.
- App boot path unchanged: `renderGrimoire()`/the map-vitals bindings are called from the existing `paint()` function at its normal position, and the module-script bridge (`window.__mzRenderGrimoire`) is optional-chained so a boot-order race never throws.
- **Not verified here (on-device UAT deferred):** the visual "feel" of the map-heading HP/level readout and the Grimoire's Cast/disabled-hint layout on the Pixel 7 build — per this project's `mvp — autonomous run` mode, on-device visual verification is deferred to the orchestrator's next device build, consistent with every prior `04-DR*` round.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `.mw-map-heading-row`, `#mw-map-vitals`, `#mm-level`, `#mm-hp`, `#mm-hpfill`, `#grimoire-panel`, `#s-grimoire`, `function renderGrimoire()`, `window.__mzRenderGrimoire = renderGrimoire;`.
- FOUND: `content/spells.js` — `combatOnly: false` on all 12 non-combat spells, `combatOnly: true` on the remaining 20 (32 total).
- FOUND: `src/browser/viewModels.js` — `export function grimoireViewModel(state)`.
- FOUND: `test/unit/grimoireViewModel.test.js` — 10 tests, all passing.
- FOUND: `test/unit/magic.test.js` — 6 new out-of-combat tests (Detect Magic, Sense Presence, Sense Danger, Summon, Earthquake, Death), all passing.
- FOUND: `test/unit/content-tables.test.js` — 3 new combatOnly tests, all passing.
- FOUND commit `6813d40` (feat(04-DR10): map heading HP + level readout).
- FOUND commit `609c77d` (feat(04-DR10): classify spells combat-only vs. non-combat, add out-of-combat cast gating).
- FOUND commit `080701d` (feat(04-DR10): HERO tab Grimoire — lists all learned spells, casts non-combat ones).
- FOUND: `npm test` 491/491 and `npm run test:quick` 402/402 at final state.

## Next Phase Readiness

- All DR10 items are complete and test-green; ready for on-device UAT on the next Pixel 7 build — specifically the map-heading HP/level readout's legibility at a glance beside the "MAP" label, and the Grimoire's row layout (level prefix, Cast button, "Combat only" hint) at all three text sizes.
- No blockers. `src/browser/haptics.js`/sound wiring, the mock's full separate-line Oracle dice-transparency redesign, and any remaining device-review items from prior rounds remain open, separately-scoped items — not blockers for this round's functional completion.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
