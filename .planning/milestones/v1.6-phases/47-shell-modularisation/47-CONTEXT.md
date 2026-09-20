# Phase 47: Shell Modularisation - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning
**Mode:** Autonomous smart discuss — one user round (2 areas, both accepted as recommended, 2026-09-19).

<domain>
## Phase Boundary

The Gear tab, the Hero tab and the Store screen each render from a named `src/browser/` module with its own source-pin test suite; `mazeworld.html` is a mount point under 5,000 lines whose `window.__mz*` bridge surface is listed in one registry with an owner and consumer per name, enforced by a test. Pixel-identical: the three surfaces render the same DOM before and after. Requirements SHELL-01, SHELL-02, SHELL-03, SHELL-04.

**Engine-gate fence:** zero bytes under `engine/`, `content/`, `test/parity/fixtures/`, `test/parity/prototype-master.js.txt` (hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). Shell + `src/browser/` + tests only. No behaviour change — the DOM snapshots are the proof.

**Phase-start baseline (2026-09-19, HEAD `3b269e3`):** `mazeworld.html` 6,339 lines (classic `<script>` L1687–4833 holding `paint()` L2375–2777 with the Hero sheet/dossier/skills/abilities/rations/grimoire writes and the Gear ON YOU/BAG writes inline, `renderCarriedList` L2777–2973, `renderDropShelf` L2974, `renderPartyRoster` L3326, the Store branch inside `renderEncounter()` at L4059–4200; the `<script type="module">` from L4835). 20 modules in `src/browser/` (6,793 lines); `viewModels.js` 743 lines holds the Gear/Hero view models; 53 unique `window.__mz*` bridge names across the shell and `src/browser/`. 3,231 tests green; `npm run boot:check` 4/4.

</domain>

<decisions>
## Implementation Decisions

### Module contract — user accepted 2026-09-19
- **Signature: `renderGearTab(host, state, deps)`, `renderHeroTab(host, state, deps)`, `renderStoreScreen(host, state, deps)`** — explicit state and explicit deps (`{ dispatch, showTab, inventoryAction, engineCombatAction, storeAction, guardTap, featureIconSrc, tables, … }` — whatever the moved body reaches for today via globals), NO `window.*` reads inside a module. Mirrors the existing `renderFoeCards(host, vm, onPick)` shape and keeps the modules testable in node with a fake element.
- **Bridge from the classic script: one `window.__mzTabs = Object.freeze({ gear: renderGearTab, hero: renderHeroTab, store: renderStoreScreen })`** assigned by the module script BEFORE the first `paint()` (the `__mzControls`/`__mzTables` precedent). `paint()` keeps its tab-switch skeleton and makes exactly one call per surface: `window.__mzTabs.gear(host, S, deps)` etc.; `renderEncounter()`'s `S.store` branch becomes one `window.__mzTabs.store(host, S, deps)` call. Moving `paint()` itself into the module script is out of scope.
- **View models: tab-only view models move into their tab module with their tests** — to `gearTab.js`: `bagUsage`, `emptySlotRows`, `GEAR_COPY`, `ITEM_STATE_COPY`, `itemRowState`; to `heroTab.js`: `characterSheetViewModel`, `ABILITY_VIEW_COPY`, `RATIONS_COPY`, `eatsLineFor`, `rationsViewModel`, `grimoireViewModel`. **Shared view models stay in `viewModels.js`:** `armorDisplay`, `bagArmorText`, `USABLE_COPY`, `usableBy`, `lootCompare`, `dropShelfItems`, `oracleLogViewModel` (used by loot/find cards, the store and the Oracle tab). Each move is `git mv`-style for the test file where one exists (history follows), and the shell's `window.__mz*` bridge for a moved export follows the export (e.g. `__mzDropShelfItems` stays — its VM stays shared).
- **Pixel-identical proof (criterion 5): a DOM snapshot before/after per screen** — a node fake-element harness (the `test/parity/harness/sandboxPrototype.js` `fakeElement()` idea, or a minimal recording element) renders each surface from a fixed state (a fresh Thief with gear; a Hero with a Joiner + grimoire; a store with buy/sell/repair rows) BEFORE the carve (captured and committed as a fixture) and AFTER, and the serialized DOM must be byte-equal. This is the milestone's 3-screen smoke; it stays as a standing test.

### Boundaries & registry — user accepted 2026-09-19
- **`storeScreen.js` owns the whole `S.store` branch** of `renderEncounter()` — buy/sell/repair rows, `STORE_ROLL_COPY`, the usable-by suffixes (`usableBy` imported from the shared `viewModels.js`), the repair-row math display. The encounter overlay host/frame stays in the shell.
- **The drop shelf stays shared in the shell** — `renderDropShelf(shelf, entries)` renders on the LOOT card (L4045) and the FIND card (L4364), i.e. encounter surfaces, not the Gear tab; `dropShelfItems` stays in `viewModels.js`. Not moved into `gearTab.js`.
- **Bridge registry = `src/browser/bridge.js`:** a frozen map `BRIDGE = { "__mzState": { owner: "mazeworld.html (classic)", consumers: ["src/browser/engineAdapter.js", …], purpose: "…" }, … }` for every `window.__mz*` name (53 today, plus `__mzTabs`), with `test/unit/bridge-registry.test.js` asserting set-equality between the map's keys and a `__mz\w+` grep over `mazeworld.html` + `src/browser/*.js` (comment-stripped — `tools/ident-sweep.mjs`'s stripper is reusable), so a new unlisted name or a stale listed name fails. A `## Module bridge` doc section (e.g. `docs/SHELL-MODULES.md`) is generated from or references the map — the map is the source of truth.
- **Line budget:** carve the three bodies (Gear ON YOU/BAG rendering + `renderCarriedList` + `wornSlotRow`/empty-slot rows ≈ 300 lines; Hero sheet/dossier/skills/abilities/rations/grimoire + `renderPartyRoster` ≈ 400+ lines; Store ≈ 150 lines) and the comments attached to them; if `wc -l` is still ≥ 5,000, move the tabs' private helpers with their tab (never the Oracle/Map tabs — out of scope). Record the final count in the SUMMARY.

### Test suites (SHELL-01..03)
- Each module gets `test/unit/gearTab.test.js` / `heroTab.test.js` / `storeScreen.test.js` in the existing source-pin style (readFileSync + regex pins on the module AND on the shell's mount call), plus the moved view-model tests, plus the DOM-snapshot smoke (`test/unit/shell-tab-snapshots.test.js` or similar, with committed snapshot fixtures under `test/unit/fixtures/`).
- Existing `test/unit/shell-gear-39.test.js`, `shell-gear-toolbar.test.js`, `shell-company-panel.test.js`, `shell-abilities.test.js`, `shell-armor-display.test.js`, `shell-spells-40.test.js`, `shell-map-store-polish.test.js`, `shell-worn-slots.test.js` (and any other `shell-*.test.js` pinning Gear/Hero/Store source) are re-pointed at the module file in the same commit as the move — pins must not be deleted, only re-homed.
- The widened "no duplicate table" pin (criterion 3): Phase 44's `test/unit/shell-no-content-copies.test.js` widened to every `src/browser/` export name as well (derive the name set from the modules' `export` statements), naming every tab module.

### Claude's Discretion
- Plan slicing (recommended: 01 = harness + BEFORE snapshots + `bridge.js` registry/test; 02 = `gearTab.js`; 03 = `heroTab.js`; 04 = `storeScreen.js` + AFTER snapshots + closing gates — sequential, every plan edits the shell), the exact deps object shape, whether `renderCarriedList` becomes gearTab-private or a shared helper if the loot card also uses it (check callers first), and the doc file name.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Precedents: `src/browser/combatPanel.js` (pure view models + copy; shell `renderFoeCards(host, vm, onPick)` does the DOM), `src/browser/rail.js` (tables + `railFamilyFor`; shell `renderRail()`), `src/browser/combatMenu.js`, `src/browser/fightLog.js`; source-pin suites `test/unit/shell-combat-screen.test.js`, `shell-map-rail.test.js`, `shell-combat-actions.test.js`.
- Bridge precedents: `window.__mzState` (classic-assigned, module-read), `window.__mzControls`, `window.__mzIconMap`, `window.__mzTables` (module-assigned, classic-read; first `paint()` is the module's own call after all assignments) — `__mzTabs` follows the latter.
- `viewModels.js` exports (L103–723): `armorDisplay`, `bagArmorText`, `USABLE_COPY`, `usableBy`, `lootCompare`, `bagUsage`, `GEAR_COPY`, `dropShelfItems`, `emptySlotRows`, `ITEM_STATE_COPY`, `itemRowState`, `ABILITY_VIEW_COPY`, `characterSheetViewModel`, `RATIONS_COPY`, `eatsLineFor`, `rationsViewModel`, `grimoireViewModel`, `oracleLogViewModel`.
- `test/parity/harness/sandboxPrototype.js#fakeElement()` — a DOM-less element stub the parity harness already uses; `tools/ident-sweep.mjs` — comment-stripping scanner; `tools/shell-sweep.mjs refs` — zero-reference gate; `npm run boot:check` — headless boot gate (must stay 4/4 after every carve).

### Established Patterns
- Classic script cannot import; modules are reached through `window.__mz*` bridges assigned in the module script before the first paint. Every bridge name will now be registry-listed.
- Source-pin tests read `mazeworld.html`/module source with `fs.readFileSync` and assert exact strings — re-point, never delete.
- One surface per commit; suite + `build:www` + `boot:check` green at every commit; the DOM snapshot is the behaviour lock.

### Integration Points
- `mazeworld.html`: `paint()` L2375–2777 (Hero `s-*`/`doss*` writes, Gear ON YOU/BAG), `renderCarriedList` L2777, `renderDropShelf` L2974 (stays), `renderPartyRoster` L3326, `renderEncounter()` store branch L4059–4200, `showTab`, the module-script bridge assignments (~L4835+), the classic `window.__mz*` assignments (`__mzWornSlots` L~5048 pre-44 numbering, `__mzGravesCount`, `__mzClassicBoot`, …).
- `src/browser/viewModels.js`, `src/browser/icons.js` (`featureIconSrc`), `src/browser/engineAdapter.js` (dispatch), `test/unit/shell-*.test.js`, `test/unit/viewModels*.test.js`, `test/unit/shell-no-content-copies.test.js`.
- `.planning/ROADMAP.md` Phase 47 criteria 1–5; `REQUIREMENTS.md` SHELL-01..04; `docs/` (new module doc).

</code_context>

<specifics>
## Specific Ideas

- Closing gates verbatim from ROADMAP criteria 1–5: the three modules + suites exist and `paint()` holds one mount call per surface; `wc -l mazeworld.html` < 5,000; the widened no-duplicate pin; the registry test; the 3-screen DOM snapshot byte-equal before/after; plus `npm test` fail 0, `build:www`, `boot:check` 4/4, engine fence empty.
- Human verification (deferred to the milestone-close Pixel 7 batch): Gear tab (ON YOU / BAG, equip/use/drop/swap confirms), Hero tab (sheet, dossier, Company, Grimoire, RATIONS, abilities), Store (buy/sell/repair rows, usable-by) all look and behave exactly as before; tab switching has no flash or missing panel.

</specifics>

<deferred>
## Deferred Ideas

- Moving `paint()`/`draw()`/the Map and Oracle tabs into modules — not in v1.6 (SHELL-01..04 name three surfaces).
- The UX-06 tutorial hooks onto these modules — the v1.0 launch tail.
- Backlog 999.1/999.3 effects (transitions, set dressing, party frames) land on these modules after v1.6.
</deferred>
