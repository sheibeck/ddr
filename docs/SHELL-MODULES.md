# Shell modules

`mazeworld.html` is a mount point. The Gear tab, the Hero tab and the Store
screen render from named `src/browser/` modules — `gearTab.js`, `heroTab.js`
and `storeScreen.js` (landing in Plans 03–05 of Phase 47). This doc is
written first, before those carves, so the module contract is fixed and
every `window.__mz*` bridge crossing the classic-script/module-script seam
is listed in one place, with an owner, before a single line moves.

## Contract

Each tab module exports one render function:

- `renderGearTab(host, state, deps)`
- `renderHeroTab(host, state, deps)`
- `renderStoreScreen(host, state, deps)`

- `host` — the mount element (`#screen-gear`, `#screen-hero`, `#enc-body`).
- `state` — the engine state (`S`).
- `deps` — the object the classic script's `tabDeps()` builds, each key an
  action closure over the matching `window.mz*` bridge: `guardTap`,
  `useItem`, `equipItem`, `unequip`, `dropItem`, `sellItem`, `takeLoot`,
  `leaveLoot`, `buyItem`, `leaveStore`, `dismissJoiner`, `castSpell`.

Rules:

- A module reaches the page only through `host`, `host.ownerDocument` and
  `deps` — **never** `window`/`document` globals.
- A module imports `content/`, `engine/` and `viewModels.js` directly; it
  never re-derives what an import already gives it.
- `paint()` makes exactly one call per surface: `window.__mzTabs.gear(host,
  S, deps)`, `window.__mzTabs.hero(host, S, deps)`. `renderEncounter()`'s
  `S.store` branch becomes one `window.__mzTabs.store(host, S, deps)` call.
- `window.__mzTabs = Object.freeze({ gear, hero, store })` is assigned by
  the module script BEFORE the first `paint()` call — the same discipline
  as `window.__mzControls`/`window.__mzTables`.
- The shared carried-item list (`renderCarriedList`, exported by
  `gearTab.js` once it lands) is reached by the classic loot card through
  `window.__mzCarriedList`.

## What stays shared

`src/browser/viewModels.js` keeps the view models more than one surface
reads: `armorDisplay`, `bagArmorText`, `USABLE_COPY`, `usableBy`,
`lootCompare`, `dropShelfItems`, `oracleLogViewModel`.

`renderDropShelf` stays in the shell — it renders on the LOOT and FIND
cards (encounter surfaces, not the Gear tab). The encounter overlay's
host/frame also stays in the shell.

## Module bridge

Generated from `src/browser/bridge.js` by `node tools/bridge-doc.mjs
--write`; `test/unit/bridge-registry.test.js` fails when this table and the
map disagree, or when the shell/modules define a name the map lacks.

<!-- bridge-table:start -->

| Name | Owner | Consumers | Purpose |
| --- | --- | --- | --- |
| __mzAppImportOverride | src/browser/nativeChrome.js | test/persistence/lifecycle.test.js<br>test/unit/haptics.test.js | Test-only injection hook so a test can replace the native @capacitor/app import with a fake, without any shipped code path setting it. |
| __mzArmorDisplay | mazeworld.html (module) | mazeworld.html (classic: paint — sheet armor line)<br>mazeworld.html (classic: renderCarriedList — bag armor swap-compare text)<br>mazeworld.html (classic: renderDropShelf — bag armor text)<br>mazeworld.html (classic: renderEncounter — loot/find armor text) | Bridges the pure armorDisplay/bagArmorText formatters so every armor string on screen renders from one engine-derived source. |
| __mzBagUsage | mazeworld.html (module) | mazeworld.html (classic: paint — bag usage readout)<br>mazeworld.html (classic: renderEncounter — loot/find bag-full gate) | Bridges the pure bag-capacity readout (used/slots, full) so the Gear tab and every loot/find/store surface agree with the engine's real cap. |
| __mzCanvasSizing | mazeworld.html (module) | mazeworld.html (classic: fit — canvas backing size + cell size for text scale) | Bridges the pure canvas-backing/cell-size math so the map canvas resizes identically to the engine's own text-scale settings model. |
| __mzCarriedList | mazeworld.html (module) | mazeworld.html (classic: the loot card — the shared carried-item list; the store sell list reaches it directly now, via src/browser/storeScreen.js's own gearTab.js import) | Bridges src/browser/gearTab.js's renderCarriedList so the loot card reaches the ONE shared carried-item list renderer, never a second copy. |
| __mzClassicBoot | mazeworld.html (classic) | mazeworld.html (module: initRollerScreen — awaits the classic boot before first paint) | Exposes the classic script's async boot routine so the module script can await it before running the roller screen's own init. |
| __mzCombatMenu | mazeworld.html (module) | mazeworld.html (classic: openCombatMenu / renderActionArea / fightLogRefuse — reads and also writes)<br>mazeworld.html (module: dispatchWithNarration — closes the menu after every dispatched action) | Presentation-only open/closed state for the combat action submenu; never a field on state (serializeRun spreads state wholesale). |
| __mzCombatVM | mazeworld.html (module) | mazeworld.html (classic: renderActionArea / renderEncounter — combat header/foe-card/YOUR LOT/overlay content) | Bridges the pure combat header/foe-list/your-lot/overlay/menu view-model builders for renderEncounter's combat branch. |
| __mzConditionsOf | mazeworld.html (module) | mazeworld.html (classic: paint — top-of-screen condition tracker) | Bridges the pure condition enumerator so paint()'s condition chips map data-only descriptors to labels through one shared source. |
| __mzControls | mazeworld.html (module) | mazeworld.html (classic: keepPartyInView / map pointer handlers — screenToCell, resolveTapDirection, classifyPointerGesture, keepInViewAxis) | Bridges the pure pointer-to-cell and camera-keep-in-view math so map taps and the stationary camera use one shared calculation. |
| __mzDescend | mazeworld.html (module) | mazeworld.html (classic: the stair-down overlay's primary action) | Exposes the module's descend action so the classic stair overlay's GO button can dispatch it without importing the module a second time. |
| __mzDropShelfItems | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — LOOT and FIND drop-shelf cards) | Bridges the pure bag-items-only list the shared drop shelf renders when a pickup would overflow the bag. |
| __mzEther | mazeworld.html (module) | mazeworld.html (classic: condition-chip tone for the ether condition)<br>mazeworld.html (classic: map pointer handlers — tap-to-move isOpen predicate, hold-inspect ethereal flag) | Bridges the pure Cloak of Ether predicates (itemEffectActive, inStone) so tap-to-move, hold-inspect and the condition chip agree on wall-walking state. |
| __mzFightEnd | mazeworld.html (module) | mazeworld.html (classic: renderCombatOver — reads and also resets to null)<br>mazeworld.html (module: the post-dispatch combat-end tracker — sets the ending-line parcel) | Presentation-only parcel of a just-ended fight's closing lines; never a field on state. |
| __mzFightLog | mazeworld.html (module) | mazeworld.html (classic: renderFightLog / fightLogRefuse — reads and also writes via __mzFightLogVM.toggle/append)<br>mazeworld.html (module: dispatchWithNarration — appends every dispatch's fight-log lines) | Presentation-only whole-fight log entries (rows, seq); never a field on state. |
| __mzFightLogVM | mazeworld.html (module) | mazeworld.html (classic: renderFightLog / fightLogRefuse — rows/toggle/announcement/append/dull) | Bridges fightLog.js's pure view-model functions so the classic fight-log renderer never imports the module a second time. |
| __mzGravesCount | mazeworld.html (classic) | mazeworld.html (module: refreshTitleDead — the roller screen's death counter) | Exposes the classic script's graveyard-count accessor so the module's title-screen death counter reads the same total. |
| __mzHapticsImportOverride | src/browser/haptics.js | test/unit/haptics.test.js | Test-only injection hook so a test can replace the native @capacitor/haptics import with a fake, without any shipped code path setting it. |
| __mzHasTool | mazeworld.html (module) | mazeworld.html (classic/module: rail dark/hazard cards — torch retry, dark-fell gating) | Bridges the pure carried-tool predicate so a hazard/dark rail card only offers a retry when the party actually carries the tool. |
| __mzIconMap | mazeworld.html (module) | mazeworld.html (classic: draw — the preloaded map icon atlas) | Bridges the preloaded PNG icon atlas so the map canvas's draw() can paint feature icons without re-fetching them. |
| __mzIconsApi | mazeworld.html (module) | mazeworld.html (classic: draw — featureKeyForCell/drawFeatureIcon/PLAYER_MARKER_ICON) | Bridges the pure icon-selection helpers so the map canvas's draw() resolves and paints the same icon set as the rest of the shell. |
| __mzInputGuards | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — encArmed/encounterSettled/armEncounterButtons) | Bridges the pure arm-delay/dismiss-settle predicates so the encounter overlay's double-tap and stale-dismiss guards read one shared clock rule. |
| __mzLootCompare | mazeworld.html (module) | mazeworld.html (classic: renderEncounter loot branch — equip-now compare verdict) | Bridges the pure compare-to-equipped verdict so the loot screen's Equip Now button and the Gear tab agree with the engine. |
| __mzLootReport | mazeworld.html (module) | mazeworld.html (classic: renderEncounter loot branch — folds the victory report into the loot card) | Presentation-only transient carrying a just-won fight's report into the loot card when drops are pending; never a field on state. |
| __mzMapMarks | mazeworld.html (module) | mazeworld.html (classic: draw / renderMarksLegend / inspectAt — palette, glyphs, legend, markForCell) | Bridges the pure map-mark palette/glyph/legend tables so the canvas, the legend sheet and hold-inspect all agree on one mark vocabulary. |
| __mzMapView | mazeworld.html (module) | mazeworld.html (classic: draw — the render-window radius/visibility predicate) | Bridges the pure render-window read so draw() only paints the currently-visible window; missing bridge falls back to showing everything. |
| __mzNightlyEats | mazeworld.html (module) | mazeworld.html (classic: paint — camp button's food-need readout) | Bridges the pure nightly-food-need calculation so the camp button's readout matches the engine's own camp gate. |
| __mzOracleToNewest | mazeworld.html (classic) | mazeworld.html (classic: showTab — scrolls the Oracle log to newest on tab entry) | Forward-declared scroll-to-newest callback for the Oracle log, called by showTab whenever the Oracle tab is opened. |
| __mzPartyCap | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — Joiner offer party-size cap) | Bridges the engine's PARTY_CAP constant so the Joiner offer card's cap check never drifts from the engine's own limit. |
| __mzPendingNarration | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — the narrated() helper building loot/find/store narration lines) | Presentation-only queue of narration HTML lines a dispatch produced, read once by the encounter card that follows; never a field on state. |
| __mzPreferencesOverride | src/browser/storage.js | test/persistence/harness/fakePreferences.js | Test-only injection hook so a test can replace the native @capacitor/preferences import with a fake, without any shipped code path setting it. |
| __mzRail | mazeworld.html (module) | mazeworld.html (classic: renderRail / railLocked — reads and also clears pending on dismiss)<br>mazeworld.html (module: dispatchWithNarration / darkFell / mzRailLine — pushes new cards) | Presentation-only rail state (seq/card/pending) — what is currently on screen at the bottom of the map; never a field on state. |
| __mzRailVM | mazeworld.html (module) | mazeworld.html (classic: renderRail / isOpen — card/push/clear/lineCard/announcement/copy) | Bridges rail.js's pure view-model functions so the classic rail renderer never imports the module a second time. |
| __mzRations | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — Joiner card eats line) | Bridges the pure rations view-model and eats-line formatter so the Joiner card's eats readout reads engine/movement.js#eatsFor the same way the Hero tab (src/browser/heroTab.js, a direct import — no bridge needed) and its own Company panel do. |
| __mzSettings | mazeworld.html (module) | mazeworld.html (classic: fit — reads the current text-scale/haptics/sound settings) | Exposes the module's currently-applied settings object so the classic canvas-fit routine can read the live text-scale setting. |
| __mzShowTab | mazeworld.html (classic) | mazeworld.html (classic: the death card's Oracle button)<br>mazeworld.html (module: initRollerScreen / the death-screen router — switches tabs after boot or death) | Exposes the classic script's tab-switch function so the module script can route to a tab (maze on boot, dead on death) without a DOM click. |
| __mzStair | mazeworld.html (module) | mazeworld.html (classic: the stair-down overlay's STAY button — reads and also clears to null)<br>mazeworld.html (module: the tap-to-move step handler / getGameContext / closeModal — sets and clears the overlay flag) | Presentation-only stair-down gate flag ({ dir } while the overlay is up, else null); never a field on state. |
| __mzState | mazeworld.html (classic) | mazeworld.html (classic: paint/renderRail/railPulse — reads the live GameState)<br>mazeworld.html (module: dispatchWithNarration and every engine-action bridge — get()/set() the live GameState)<br>tools/store-screenshots/bot.js<br>tools/store-screenshots/capture.js | The one get()/set() accessor onto the classic script's `S` variable, letting the module script read and replace the live GameState. |
| __mzTables | mazeworld.html (module) | mazeworld.html (classic: mzCombatReport — level roman numerals)<br>mazeworld.html (classic: renderEncounter — level roman numerals in the graves stone / Joiner card) | Bridges the one read-only content table (ROMAN) the classic script still cannot import — RACE_NOTE/CLASS_NOTE/SUB_NOTE/THRESHOLDS/WEAPONS/FIGHTER_SKILLS/THIEF_SKILLS/RACES moved to gearTab.js/heroTab.js, which import content/ directly. |
| __mzTabs | mazeworld.html (module) | mazeworld.html (classic: paint() — one call per tab surface; renderEncounter() — the store branch) | The tab modules' render functions, one frozen object — gear + hero + store, the phase's final shape — the __mzControls/__mzTables precedent for a module-assigned, classic-read bridge. |
| __mzTakesBagSlot | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — loot/find per-item bag-full gate) | Bridges the one bag-free predicate (potions/scrolls/bags ride free) so the loot and find cards gate bag-full per item, not on the aggregate alone. |
| __mzTapStep | mazeworld.html (module) | mazeworld.html (classic: map pointer handlers — resolveStep/inspectCell/HOLD_MS/TAP_MAX_TRAVEL_PX) | Bridges the pure tap-to-move step resolver and hold-inspect builder so map taps and holds share one gesture-to-action rule. |
| __mzToolIndex | mazeworld.html (module) | mazeworld.html (classic: the dark rail card's USE TORCH button) | Bridges the engine's tool-slot resolver so the dark card's USE TORCH tap dispatches the correct, freshly-resolved bag index. |
| __mzUsableBy | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — loot/find usable-by suffix; the store reaches it directly now, via src/browser/storeScreen.js's own viewModels.js import) | Bridges the pure usable-by-class predicate so every item row's usable-by suffix (loot, find, and — indirectly, via storeScreen.js's own import — the store) reads one shared rule. |

<!-- bridge-table:end -->

How to add a bridge name: assign it, add its entry to `BRIDGE`, run
`--write`, commit all three together.

## DOM snapshots

`test/unit/harness/recordingDom.js` (a from-scratch recording DOM + a
deterministic serializer) and `test/unit/harness/shellSandbox.js` (loads the
classic `<script>` under `node:vm` with the real bridges wired) back the
standing test `test/unit/shell-tab-snapshots.test.js`, which compares seven
fixtures under `test/unit/fixtures/shell-snapshots/` byte-for-byte on every
run.

Fixtures are regenerated only with `MZ_SNAPSHOT_UPDATE=1`, only for a
declared, deliberate DOM change, with the rationale in the commit message —
never to make a carve pass. A diff means the carve moved rendered DOM.

## Line budget

**Criterion 2 (ROADMAP Phase 47, `wc -l mazeworld.html` < 5000): NOT MET — 5621 lines at the phase's final commit.**

| Milestone | Commit | `wc -l mazeworld.html` (comma) | lines (plain) | Delta |
| --- | --- | --- | --- | --- |
| Phase start (smart-discuss context) | `0129ca3` | 6,339 | 6339 | — |
| Post Plan 01 (DOM-snapshot harness) / Plan 02 (bridge registry) | `bbb6503` | 6,330 | 6330 | -9 |
| Post Plan 03 (Gear tab carve) | `4cd35ea` | 5,980 | 5980 | -350 |
| Post Plan 04 (Hero tab carve) | `6d1a999` | 5,669 | 5669 | -311 |
| Post Plan 05 Task 1 (Store carve) | `df78e66` | 5,621 | 5621 | -48 |
| **Final (Plan 05 Task 2)** | (this commit) | **5,621** | **5621** | **-718 total** |

**The CONTEXT's own fallback (move the tabs' remaining private helpers) was applied and found nothing in scope.** `node tools/shell-sweep.mjs orphans` at the final commit reports 27 orphaned classic top-level declarations — every one of them belongs to the Map/camera/tap-control cluster, the combat/rail/HUD renderers, or the graves/Oracle log (`cv`, `ctx`, `GW`, `ZOOM_MIN`, `CANVAS_PAD`, `CAPTURE`, `logEl`, `CONDITION_COPY`, `MAP_COPY`, `FOE_EFFECT_LABEL`, `CONDITION_TONE`, `CONDITION_EXPLAIN`, `lastCondKeyShown`, `GRAVE_KEY`, `GRAVE_TOTAL_KEY`, `gravesLoadError`, `saveGraves`, `encRenderedAt`, `armTimer`, `lastDismissAt`, `encWasActive`, `lastLogSeqShown`, `fightLogAnnouncedSeq`, `FEATURE_ICON_PATH`, `COMBAT_DISPATCH`, `lastRailKeyShown`, `railTimer`). None trace to the Gear, Hero or Store bodies this phase carved — the phase ground rules explicitly forbid moving Map/Oracle/rail/combat code, so this lever has nothing left to pull for SHELL-01..04's own scope.

**Classified breakdown of the remaining 5,621 lines** (measured at the final commit):

| Category | Lines | Detail |
| --- | --- | --- |
| Markup + CSS (`<head>`/`<style>`, before `<body>`) | 1,196 | lines 1–1,196 |
| Body markup between the classic and module `<script>` tags | 491 | lines 1,197–1,687 |
| Classic `<script>` (total) | 2,507 | lines 1,687–4,193 |
| — of which comment-only lines | 885 | `//`, `/* … */`, `*` continuation lines |
| Module `<script type="module">` (total) | 1,424 | lines 4,195–5,618 |
| — of which comment-only lines | 757 | `//`, `/* … */`, `*` continuation lines |
| Trailing lines (`</html>` etc.) | 4 | after the module script closes |

Comment-only lines alone total **1,642** across both scripts — the single largest lever left, and it is explicitly **out of scope for this phase** (Phase 48's DOCS-01..03 comment purge per the phase ground rules: "comment purges outside moved lines are Phase 48"). The largest remaining classic function bodies by line count are all Map/Combat/Rail/Graves/Oracle surfaces this phase never touched: `inspectAt` (map tap/hold-inspect), `renderEncounter` (261 lines — now almost entirely combat, the Store/Gear/Hero branches having moved out), `logLine`/`CAPTURE`/`logEl` (Oracle log), `renderRail`/`railPulse`/`railLocked` (the rail), `draw` (map canvas), `renderDropShelf` (shared, deliberately NOT moved into a tab module per this phase's own CONTEXT ruling), `paint` (the tab-mount skeleton + HUD writes, deliberately NOT moved into the module script per this phase's own CONTEXT ruling: "Moving `paint()` itself into the module script is out of scope"), `paintConditions` (HUD condition strip), `renderFoeCards`/`renderCombatOver`/`renderYourLot`/`renderActionArea`/`cbRow`/`foeStatusBadges`/`renderMajorOverlay`/`renderFightLog`/`syncFightLogLive` (combat renderers), `renderGraves` (the graveyard).

**Candidate levers for a user ruling** (recorded, not acted on — out of this plan's scope): Phase 48's comment purge (DOCS-01..03, ~1,642 lines); moving `renderDropShelf` into a shared module (currently deliberately shell-owned, serving both the LOOT and FIND cards); moving `paint()`'s own tab-mount skeleton into the module script (currently deliberately shell-owned per this phase's CONTEXT); a future phase naming the Map/Combat/Rail/Oracle surfaces as additional named modules (out of SHELL-01..04's stated scope, which names only Gear/Hero/Store).

**Ruling (2026-09-19, user):** re-baselined and closed at 5,621 lines. The three surfaces are carved and the shell is their mount point; the "< 5,000" figure was a planning estimate that under-counted the Map/Combat/Rail/Oracle/Graves bodies the phase deliberately left in place. SHELL-04 is complete against the amended clause. No comment purge or combat carve was traded for the number.
