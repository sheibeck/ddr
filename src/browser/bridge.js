// src/browser/bridge.js
//
// Phase 47 (SHELL-04) — the SOURCE OF TRUTH for every `window.__mz*` name
// that crosses the seam between `mazeworld.html`'s classic `<script>` (not a
// module — cannot `import`) and its trailing `<script type="module">`
// (which can). BRIDGE lists every live name with its owner (the file/script
// that assigns it) and its consumers (the readers). Adding or removing a
// `window.__mz*` name ANYWHERE (the shell or a src/browser/ module)
// requires editing this map in the SAME commit — test/unit/bridge-registry
// .test.js fails the build otherwise (an unlisted new name, or a stale
// listed name nothing defines any more).
//
// `node tools/bridge-doc.mjs --write` regenerates docs/SHELL-MODULES.md's
// `## Module bridge` table from this map — the map is the source, the doc
// is generated.
//
// Four names (`__mzAppImportOverride`, `__mzHapticsImportOverride`,
// `__mzPreferencesOverride`, `__mzSfxBackendOverride`) are test-only
// injection hooks: a src/browser/ module checks `globalThis.<name>` so a
// test can swap its native import/backend for a fake, WITHOUT any shipped
// code path ever setting the global itself — the hook is reachable only
// when a test sets it.
//
// Five names (`__mzCombatMenu`, `__mzFightEnd`, `__mzFightLog`, `__mzRail`,
// `__mzStair`) are presentation-only state written by BOTH scripts: the
// module script defines the bridge object/API and its resting value, the
// classic script also writes a fresh value at specific UI moments (dismiss,
// refuse, tap). Never a field on `S`/state — `serializeRun` spreads `S`
// wholesale, so these would leak into a save if they were.

export const BRIDGE = Object.freeze({
  __mzAppImportOverride: Object.freeze({
    owner: "src/browser/nativeChrome.js",
    consumers: Object.freeze(["test/persistence/lifecycle.test.js", "test/unit/haptics.test.js"]),
    purpose: "Test-only injection hook so a test can replace the native @capacitor/app import with a fake, without any shipped code path setting it.",
  }),
  __mzArmorDisplay: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: paint — sheet armor line)",
      "mazeworld.html (classic: renderCarriedList — bag armor swap-compare text)",
      "mazeworld.html (classic: renderDropShelf — bag armor text)",
      "mazeworld.html (classic: renderEncounter — loot/find armor text)",
    ]),
    purpose: "Bridges the pure armorDisplay/bagArmorText formatters so every armor string on screen renders from one engine-derived source.",
  }),
  __mzBagUsage: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: paint — bag usage readout)",
      "mazeworld.html (classic: renderEncounter — loot/find bag-full gate)",
    ]),
    purpose: "Bridges the pure bag-capacity readout (used/slots, full) so the Gear tab and every loot/find/store surface agree with the engine's real cap.",
  }),
  __mzBeat: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderEncounter/renderFightLog/renderActionArea — view())",
      "mazeworld.html (classic: hasActiveEncounter/encArmed — active())",
      "mazeworld.html (classic: beatHurryTap/showTab — hurry())",
      "mazeworld.html (module: settleAllMotion — hurry())",
    ]),
    purpose: "Bridges the pure src/browser/combatBeat.js runner (Phase 58, MOTION-03: D-09..D-11, D-17) so the classic renderer reveals an already-resolved combat round one exchange at a time, without a second copy of the reveal schedule.",
  }),
  __mzBoards: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: showTab — the DEAD tab opens the Leaderboards panel, or re-centres its rail when the panel is already open from the title)",
    ]),
    purpose: "Bridges the module-owned Leaderboards panel (src/browser/boardsPanel.js over boardsView.js and the adapter's in-memory bests record and graveyard) so the classic tab switch opens it without importing a module; presentation only, never a field on state.",
  }),
  __mzCameraGlide: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: keepPartyInView — the glided keep-in-view nudge)",
      "mazeworld.html (classic: glideCenterMap — the CENTRE row of the ☰ menu)",
      "mazeworld.html (classic: anchorCamOnParty — cancels before a snap or a pinch frame)",
      "mazeworld.html (classic: the viewport's pointerdown handler — cancels so the finger wins)",
    ]),
    purpose: "Bridges the pure src/browser/cameraGlide.js retargetable ease-out tween (Phase 58, MOTION-01) so the classic camera code eases `cam` without a second copy of the tween math.",
  }),
  __mzCanvasSizing: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: fit — canvas backing size + cell size for text scale)"]),
    purpose: "Bridges the pure canvas-backing/cell-size math so the map canvas resizes identically to the engine's own text-scale settings model.",
  }),
  __mzCarriedList: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: the loot card — the shared carried-item list; the store sell list reaches it directly now, via src/browser/storeScreen.js's own gearTab.js import)"]),
    purpose: "Bridges src/browser/gearTab.js's renderCarriedList so the loot card reaches the ONE shared carried-item list renderer, never a second copy.",
  }),
  __mzClassicBoot: Object.freeze({
    owner: "mazeworld.html (classic)",
    consumers: Object.freeze(["mazeworld.html (module: the boot sequence after the roller mount — awaits the classic boot before first paint)"]),
    purpose: "Exposes the classic script's async boot routine (the first canvas fit and paint) so the module script can await it before running the title screen's own init.",
  }),
  __mzCombatMenu: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: openCombatMenu / renderActionArea / fightLogRefuse — reads and also writes)",
      "mazeworld.html (module: dispatchWithNarration — closes the menu after every dispatched action)",
    ]),
    purpose: "Presentation-only open/closed state for the combat action submenu; never a field on state (serializeRun spreads state wholesale).",
  }),
  __mzCombatVM: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderActionArea / renderEncounter — combat header/foe-card/YOUR LOT/overlay content)"]),
    purpose: "Bridges the pure combat header/foe-list/your-lot/overlay/menu view-model builders for renderEncounter's combat branch.",
  }),
  __mzConditionsOf: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: paint — top-of-screen condition tracker)"]),
    purpose: "Bridges the pure condition enumerator so paint()'s condition chips map data-only descriptors to labels through one shared source.",
  }),
  __mzControls: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: keepPartyInView / map pointer handlers — screenToCell, resolveTapDirection, classifyPointerGesture, keepInViewAxis)"]),
    purpose: "Bridges the pure pointer-to-cell and camera-keep-in-view math so map taps and the stationary camera use one shared calculation.",
  }),
  __mzDarkness: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: paintVignette — the counter-driven map vignette; paintConditions — the DARK chip's waiver clause)"]),
    purpose: "Bridges the engine's own inDark/revealRadius/mapViewRadius/skill/eff reads plus the pure darknessView.js vignette/waiver helpers, so the shell reads the darkness rule and its three waiver checks instead of reimplementing them.",
  }),
  __mzDeathRecord: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderCombatOver — renders the NEW PERSONAL BEST block on the THAT IS THAT panel)",
      "mazeworld.html (module: dispatchWithNarration — sets it on a died event; showTitleScreen — resets it to null)",
    ]),
    purpose: "Presentation-only parcel of the just-died run's new-personal-best block view; never a field on state.",
  }),
  __mzDescend: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: the stair-down overlay's primary action)"]),
    purpose: "Exposes the module's descend action so the classic stair overlay's GO button can dispatch it without importing the module a second time.",
  }),
  __mzDressing: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: draw — the ambient prop layer beneath the feature icons)"]),
    purpose: "Bridges the pure src/browser/dressing.js ambient-prop layer (Phase 59, DRESS-01..05) so draw() places, dims and excludes props with one thin call and no second copy of the rules; it draws nothing while Set dressing is Off.",
  }),
  __mzDropShelfItems: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter — LOOT and FIND drop-shelf cards)"]),
    purpose: "Bridges the pure bag-items-only list the shared drop shelf renders when a pickup would overflow the bag.",
  }),
  __mzEther: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: condition-chip tone for the ether condition)",
      "mazeworld.html (classic: map pointer handlers — tap-to-move isOpen predicate, hold-inspect ethereal flag)",
    ]),
    purpose: "Bridges the pure Cloak of Ether predicates (itemEffectActive, inStone) so tap-to-move, hold-inspect and the condition chip agree on wall-walking state.",
  }),
  __mzFightEnd: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderCombatOver — reads and also resets to null)",
      "mazeworld.html (module: the post-dispatch combat-end tracker — sets the ending-line parcel)",
    ]),
    purpose: "Presentation-only parcel of a just-ended fight's closing lines; never a field on state.",
  }),
  __mzFightLog: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderFightLog / fightLogRefuse — reads and also writes via __mzFightLogVM.toggle/append)",
      "mazeworld.html (module: dispatchWithNarration — appends every dispatch's fight-log lines)",
    ]),
    purpose: "Presentation-only whole-fight log entries (rows, seq); never a field on state.",
  }),
  __mzFightLogVM: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderFightLog / fightLogRefuse — rows/toggle/announcement/append/dull)"]),
    purpose: "Bridges fightLog.js's pure view-model functions so the classic fight-log renderer never imports the module a second time.",
  }),
  __mzFoeConditions: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: foeStatusBadges — the combat foe cards' condition chips, via chips)"]),
    purpose: "Bridges src/browser/foeConditions.js's foeConditionChips, the one foe-condition chip table (Phase 71 D-14), so the classic foe cards read every ability, spell and item condition from one source that 71-04's long-press card also reads.",
  }),
  __mzFoeInspect: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderRail — re-derives the live foe card's lines while S.combat is set, via card)",
      "mazeworld.html (classic: renderFoeCards — the Details button's accessible name, via label)",
    ]),
    purpose: "Bridges src/browser/foeDetails.js's foeDetailsCard and detailsLabel: the long-press foe card view model (Phase 71 D-09/D-10) that the classic rail keeps live through a fight, and the TalkBack Details action's name (D-11).",
  }),
  __mzGearSheet: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: openGearSheet / refreshGearSheet — the Gear action sheet's render)"]),
    purpose: "Bridges src/browser/gearSheet.js's renderGearSheet so the classic sheet lifecycle (open, repaint refresh, close, back button, ghost-tap arm) renders the ONE pure sheet model, never a second copy.",
  }),
  __mzHapticsImportOverride: Object.freeze({
    owner: "src/browser/haptics.js",
    consumers: Object.freeze(["test/unit/haptics.test.js"]),
    purpose: "Test-only injection hook so a test can replace the native @capacitor/haptics import with a fake, without any shipped code path setting it.",
  }),
  __mzHasTool: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic/module: rail dark/hazard cards — torch retry, dark-fell gating)"]),
    purpose: "Bridges the pure carried-tool predicate so a hazard/dark rail card only offers a retry when the party actually carries the tool.",
  }),
  __mzHudBands: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: paint — band 1's name/line split via identityParts, and the fixed-width counter slots)"]),
    purpose: "Bridges the pure src/browser/hudBands.js identityLine/identityParts/counterSlots formatters (Phase 57, LAYOUT-05) so paint() renders band 1's identity line (split into a never-truncated name and a truncating race/class/level line, Plan 05) and band 2's fixed-width counters from ONE engine-agnostic source.",
  }),
  __mzHudMenu: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: hudMenuEvent — the ☰ HUD menu's open/close policy, via next)",
      "mazeworld.html (classic: syncHudMenuRows — the ☰ rows' per-row availability, via rows)",
    ]),
    purpose: "Bridges the pure src/browser/hudMenu.js hudMenuNext reducer (Phase 57, LAYOUT-04/05, Plan 05) and hudMenuRowStates (Phase 70, D-08) so the shell holds no second copy of the ☰ menu's rules; the classic hudMenuEvent reads the live open state and asks next for the open/close policy (the menu opens on every screen, failing closed when the bridge is missing), and the classic syncHudMenuRows asks rows which of the six rows can act in the current context (encounter, dead, hero) and writes disabled plus aria-disabled onto the rest.",
  }),
  __mzIconMap: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: draw — the preloaded map icon atlas)"]),
    purpose: "Bridges the preloaded PNG icon atlas so the map canvas's draw() can paint feature icons without re-fetching them.",
  }),
  __mzIconsApi: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: draw — featureKeyForCell/drawFeatureIcon)"]),
    purpose: "Bridges the pure icon-selection helpers so the map canvas's draw() resolves and paints the same icon set as the rest of the shell; the party marker moved to the DOM sprite (window.__mzPartySprite) in Phase 59.",
  }),
  __mzInputGuards: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter — encArmed/encounterSettled/armEncounterButtons)"]),
    purpose: "Bridges the pure arm-delay/dismiss-settle predicates so the encounter overlay's double-tap and stale-dismiss guards read one shared clock rule.",
  }),
  __mzLootCompare: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter loot branch — equip-now compare verdict)"]),
    purpose: "Bridges the pure compare-to-equipped verdict so the loot screen's Equip Now button and the Gear tab agree with the engine.",
  }),
  __mzLootReport: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter loot branch — folds the victory report into the loot card)"]),
    purpose: "Presentation-only transient carrying a just-won fight's report into the loot card when drops are pending; never a field on state.",
  }),
  __mzMapMarks: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: draw / renderMarksLegend / inspectAt — palette, glyphs, legend, markForCell)"]),
    purpose: "Bridges the pure map-mark palette/glyph/legend tables so the canvas, the legend sheet and hold-inspect all agree on one mark vocabulary.",
  }),
  __mzMapView: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: draw — the render-window radius/visibility predicate)"]),
    purpose: "Bridges the pure render-window read so draw() only paints the currently-visible window; missing bridge falls back to showing everything.",
  }),
  __mzMotion: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: showPanel/hidePanel — the fail-open wrappers every D-05 hidden-based close/open routes through)",
      "mazeworld.html (classic: showTab — the reduced() check that decides whether an outgoing screen leaves with a pinned translateY or hides instantly)",
    ]),
    purpose: "Bridges src/browser/motion.js's one shared, timer-driven panel close helper (Phase 58, MOTION-02) and its reduced-motion predicate so the classic script animates every hidden-based close (the MARKS/Settings/camp sheets, the encounter overlay, a tab's outgoing screen) without a second copy of the close-then-hide timing.",
  }),
  __mzNightlyEats: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: paint — camp button's food-need readout)"]),
    purpose: "Bridges the pure nightly-food-need calculation so the camp button's readout matches the engine's own camp gate.",
  }),
  __mzOracleToNewest: Object.freeze({
    owner: "mazeworld.html (classic)",
    consumers: Object.freeze(["mazeworld.html (classic: showTab — scrolls the Oracle log to newest on tab entry)"]),
    purpose: "Forward-declared scroll-to-newest callback for the Oracle log, called by showTab whenever the Oracle tab is opened.",
  }),
  __mzPartyCap: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter — Joiner offer party-size cap)"]),
    purpose: "Bridges the engine's PARTY_CAP constant so the Joiner offer card's cap check never drifts from the engine's own limit.",
  }),
  __mzPartySprite: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: partyShown — the displayed point a step glide is heading toward)",
      "mazeworld.html (classic: positionPartySprite — box/pose/frame, in lockstep with positionCanvas())",
      "mazeworld.html (classic: glideParty — stepTo, the step glide, Phase 59 Plan 04)",
      "mazeworld.html (module: settleAllMotion — finish())",
    ]),
    purpose: "Bridges the pure src/browser/partySprite.js marker controller (Phase 59, ANIM-01/02) so the classic placement code reads one lockstep box and one step glide, never a second copy of the camera math.",
  }),
  __mzPendingNarration: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter — the narrated() helper building loot/find/store narration lines)"]),
    purpose: "Presentation-only queue of narration HTML lines a dispatch produced, read once by the encounter card that follows; never a field on state.",
  }),
  __mzPerfMarks: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: paint — the one canvas draw() call's dev-gated timing bracket, PERF-02 fix 2)"]),
    purpose: "Bridges the SAME perfMarks module instance stepWith already imports directly, so classic paint()'s draw() call — now the only canvas draw per step — can record its own `draw` timing row from the classic side (which cannot `import`); read-only from paint() (record() only, never reset()/summary()).",
  }),
  __mzPlacement: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderCombatOver / renderRankLine — draws the DEEPEST rank line on the THAT IS THAT panel, then marks it not fresh)",
      "mazeworld.html (module: onRunRecorded — resets it for a new death; handlePgsFlush — sets it when the run's rank returns; showTitleScreen and onAccountForPgs — reset it to null)",
    ]),
    purpose: "Presentation-only parcel { hash, line, fresh } of the just-died run's DEEPEST rank line (Phase 68, PLACE-01); never a field on state.",
  }),
  __mzPreferencesOverride: Object.freeze({
    owner: "src/browser/storage.js",
    consumers: Object.freeze(["test/persistence/harness/fakePreferences.js"]),
    purpose: "Test-only injection hook so a test can replace the native @capacitor/preferences import with a fake, without any shipped code path setting it.",
  }),
  __mzRail: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderRail / railLocked — reads and also clears pending on dismiss)",
      "mazeworld.html (module: dispatchWithNarration / darkFell / mzRailLine / mzInspectFoe — pushes new cards)",
    ]),
    purpose: "Presentation-only rail state (seq/card/pending) — what is currently on screen at the bottom of the map; never a field on state.",
  }),
  __mzRailVM: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderRail / isOpen — card/push/clear/lineCard/announcement/copy)",
      "mazeworld.html (classic: renderRail's auto-clear timer — holdForCard; the guarded #mw-rail body-tap dismiss handler — dismissKind)",
    ]),
    purpose: "Bridges rail.js's pure view-model functions so the classic rail renderer never imports the module a second time.",
  }),
  __mzRations: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter — Joiner card eats line)"]),
    purpose: "Bridges the pure rations view-model and eats-line formatter so the Joiner card's eats readout reads engine/movement.js#eatsFor the same way the Hero tab (src/browser/heroTab.js, a direct import — no bridge needed) and its own Company panel do.",
  }),
  __mzSettings: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: fit — reads the current text-scale/haptics/sound settings)"]),
    purpose: "Exposes the module's currently-applied settings object so the classic canvas-fit routine can read the live text-scale setting.",
  }),
  __mzSfxBackendOverride: Object.freeze({
    owner: "src/browser/sfx.js",
    consumers: Object.freeze(["test/unit/sfx.test.js", "test/unit/sfx-settings.test.js"]),
    purpose: "Test-only injection hook so a test can replace the Web Audio backend with a fake and assert which clips actually started, without any shipped code path setting it.",
  }),
  __mzShowTab: Object.freeze({
    owner: "mazeworld.html (classic)",
    consumers: Object.freeze([
      "mazeworld.html (classic: the death card's Oracle button)",
      "mazeworld.html (module: the roller mount's onCommit / the death-screen router — switches tabs after commit or death)",
      "mazeworld.html (module: routeFromBoards — back to the map when the panel's title mode exits)",
    ]),
    purpose: "Exposes the classic script's tab-switch function so the module script can route to a tab (maze on boot, dead on death) without a DOM click.",
  }),
  __mzStair: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: the stair-down overlay's STAY button — reads and also clears to null)",
      "mazeworld.html (module: the tap-to-move step handler / getGameContext / closeModal — sets and clears the overlay flag)",
    ]),
    purpose: "Presentation-only stair-down gate flag ({ dir } while the overlay is up, else null); never a field on state.",
  }),
  __mzState: Object.freeze({
    owner: "mazeworld.html (classic)",
    consumers: Object.freeze([
      "mazeworld.html (classic: paint/renderRail/railPulse — reads the live GameState)",
      "mazeworld.html (module: dispatchWithNarration and every engine-action bridge — get()/set() the live GameState)",
      "tools/store-screenshots/bot.js",
      "tools/store-screenshots/capture.js",
    ]),
    purpose: "The one get()/set() accessor onto the classic script's `S` variable, letting the module script read and replace the live GameState.",
  }),
  __mzTables: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: mzCombatReport — level roman numerals)",
      "mazeworld.html (classic: renderEncounter — level roman numerals in the graves stone / Joiner card)",
    ]),
    purpose: "Bridges the one read-only content table (ROMAN) the classic script still cannot import — RACE_NOTE/CLASS_NOTE/SUB_NOTE/THRESHOLDS/WEAPONS/FIGHTER_SKILLS/THIEF_SKILLS/RACES moved to gearTab.js/heroTab.js, which import content/ directly.",
  }),
  __mzTabs: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: paint() — one call per tab surface; renderEncounter() — the store branch)"]),
    purpose: "The tab modules' render functions, one frozen object — gear + hero + store, the phase's final shape — the __mzControls/__mzTables precedent for a module-assigned, classic-read bridge.",
  }),
  __mzTakesBagSlot: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter — loot/find per-item bag-full gate)"]),
    purpose: "Bridges the one bag-free predicate (potions/scrolls/bags ride free) so the loot and find cards gate bag-full per item, not on the aggregate alone.",
  }),
  __mzTapStep: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: map pointer handlers — resolveStep/inspectCell/HOLD_MS/TAP_MAX_TRAVEL_PX)"]),
    purpose: "Bridges the pure tap-to-move step resolver and hold-inspect builder so map taps and holds share one gesture-to-action rule.",
  }),
  __mzToolIndex: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: the dark rail card's USE TORCH button)"]),
    purpose: "Bridges the engine's tool-slot resolver so the dark card's USE TORCH tap dispatches the correct, freshly-resolved bag index.",
  }),
  __mzTypewriter: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze([
      "mazeworld.html (classic: renderRail — types a fresh card's lines/rolls, adopts an in-flight block on a same-card re-render, starts the hold from the block's own onDone)",
      "mazeworld.html (classic: the #mw-rail body-tap handler — a tap on typing text completes it instead of dismissing)",
      "mazeworld.html (classic: renderMajorOverlay — types the encounter/stair overlay's line once per content, adopts it on a same-content re-render)",
    ]),
    purpose: "Bridges src/browser/typewriter.js's one shared, keyed typewriter (Phase 58, MOTION-04: rail cards, the encounter overlay's line, and — Plan 58-06 — fight-log rows type on at 12ms/char, capped at 700ms/block) so the classic renderers type without a second copy of the schedule; a caller's own announcer/description node always carries the complete text at once, regardless of typing (D-16).",
  }),
  __mzUsableBy: Object.freeze({
    owner: "mazeworld.html (module)",
    consumers: Object.freeze(["mazeworld.html (classic: renderEncounter — loot/find usable-by suffix; the store reaches it directly now, via src/browser/storeScreen.js's own viewModels.js import)"]),
    purpose: "Bridges the pure usable-by-class predicate so every item row's usable-by suffix (loot, find, and — indirectly, via storeScreen.js's own import — the store) reads one shared rule.",
  }),
});

/**
 * bridgeNames() — the sorted list of every key in BRIDGE. The registry
 * test asserts this equals both the alphabetical order of Object.keys(BRIDGE)
 * itself and the live `__mz\w+` scan's sorted result, so grep order and file
 * declaration order never matter.
 */
export function bridgeNames() {
  return Object.keys(BRIDGE).sort();
}
