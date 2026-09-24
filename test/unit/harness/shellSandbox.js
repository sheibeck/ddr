// test/unit/harness/shellSandbox.js
//
// Phase 47 (SHELL-01/02/03), Plan 01, Task 2 — loads mazeworld.html's
// classic <script> under node:vm (the same node:vm/vm.runInContext
// technique test/parity/harness/sandboxPrototype.js uses to run the frozen
// prototype headless), wires the SAME real window.__mz* bridges the trailing
// module script assigns (imported from the exact same source files — never
// a dummy stand-in), and exposes deterministic, engine-built fixed states so
// Plan 01's DOM-snapshot test can paint() the Gear tab, the Hero tab and the
// Store from a real GameState without ever running the module script's own
// boot()/dispatch machinery (async persistence, real rng draws at import
// time — none of that belongs in a synchronous snapshot harness).
//
// Per 01-RESEARCH.md Assumption A4 (mirrored by sandboxPrototype.js's own
// header comment): start with the minimal stub surface and add a method
// only where vm.runInContext/paint() actually throws on a missing one, with
// a comment naming the shell function that required it. Never stub a
// window.__mz* bridge with a dummy — wire the real import instead.

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ROMAN, TOOLS } from "../../../content/index.js";
import { nightlyEats } from "../../../engine/movement.js";
import { PARTY_CAP, newRun, addPartyMember } from "../../../engine/state.js";
import { openStore } from "../../../engine/economy.js";
import {
  conditionsOf,
  itemEffectActive,
  inStone,
  mapViewRadius,
  inViewWindow,
  hasTool,
  takesBagSlot,
} from "../../../engine/derived.js";
import { toolIndex, rollJewel, rollBlade, rollMailPiece, toolItem, stowItem, equipItem } from "../../../engine/items.js";
import { makeRng } from "../../../engine/rng.js";
import { rollCharacter } from "../../../engine/character.js";
import { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled } from "../../../src/browser/inputGuards.js";
import {
  armorDisplay,
  bagArmorText,
  lootCompare,
  usableBy,
  dropShelfItems,
} from "../../../src/browser/viewModels.js";
import { bagUsage, renderGearTab, renderCarriedList } from "../../../src/browser/gearTab.js";
// Phase 63 (GSCR-07..10, GRULE-02) — the GEAR action sheet's DOM renderer,
// wired below as window.__mzGearSheet exactly as the module script assigns it.
import { renderGearSheet } from "../../../src/browser/gearSheet.js";
import {
  rationsViewModel,
  eatsLineFor,
  renderHeroTab,
} from "../../../src/browser/heroTab.js";
import { renderStoreScreen } from "../../../src/browser/storeScreen.js";
import { identityLine, identityParts, counterSlots } from "../../../src/browser/hudBands.js";
import { hudMenuNext, hudMenuRowStates } from "../../../src/browser/hudMenu.js";
import { REDUCED_MOTION_QUERY, prefersReducedMotion, createPanelMotion } from "../../../src/browser/motion.js";
import { createCameraGlide } from "../../../src/browser/cameraGlide.js";
import { createTypewriter, typeDurationMs } from "../../../src/browser/typewriter.js";
// Phase 59 (ANIM-01/02) — the REAL party-sprite controller (wired below),
// and (only when a caller opts into `stubDraw: false`) what the REAL
// draw() itself reads: the icon pipeline and the map-mark palette.
import { createPartySprite } from "../../../src/browser/partySprite.js";
import { FEATURE_ICONS, featureKeyForCell, drawFeatureIcon } from "../../../src/browser/icons.js";
// Phase 59 (DRESS-01..05) — the REAL createDressingBridge factory, wired
// below (always, like __mzPartySprite) over an injectable art source (like
// the fake clock: `dressing = { enabled, images }` chooses what
// art.enabled()/art.images() answer — never a second copy of dressing.js's
// own rules).
import { createDressingBridge } from "../../../src/browser/dressing.js";
import { MAP_PALETTE, MARK_GLYPHS, MARK_SCALE, ONEWAY_ROTATION_DEG, MARKS_LEGEND, markForCell, legendFor } from "../../../src/browser/mapMarks.js";
import {
  railCardFor,
  railPush,
  railClear,
  railLineCard,
  railAnnouncement,
  RAIL_COPY,
  holdForCard,
  railDismissKind,
  emptyRail,
} from "../../../src/browser/rail.js";
// Phase 58 (MOTION-03), Plan 06 — the fight-log/combat-panel/combat-menu
// view-models (the module script's own __mzFightLogVM/__mzCombatVM bridge
// shapes) and the pure+timed combat-beat core, wired below so
// combat-beat-shell.test.js can drive the REAL renderEncounter()/
// renderFightLog()/renderActionArea() through a REAL beat, never a stub.
import {
  fightLogRows,
  toggleFightLogEntry,
  fightLogAnnouncement,
  appendFightLog,
  dullFightLogLine,
} from "../../../src/browser/fightLog.js";
import {
  combatHeaderViewModel,
  foeListViewModel,
  yourLotViewModel,
  encounterOverlaySpec,
} from "../../../src/browser/combatPanel.js";
import { combatMenuViewModel } from "../../../src/browser/combatMenu.js";
import { planBeat, createBeat, createBeatRunner } from "../../../src/browser/combatBeat.js";
// Phase 66 (BOARD-01, D-14/D-15) — the REAL Leaderboards panel and view
// model, only the data source injected (like the dressing art source):
// wired below as window.__mzBoards exactly as the module script assigns it.
import { createBoardsPanel } from "../../../src/browser/boardsPanel.js";
import { boardsView } from "../../../src/browser/boardsView.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");

// ─── classic <script> / <script type="module"> region split — the same
// column-0 marker technique test/unit/shell-no-content-copies.test.js uses,
// except the slice bounds here exclude the tag lines themselves (that sibling
// test only regex-scans its CLASSIC/MOD text, so a leading "<script>\n" is
// harmless there; here the region is fed straight to vm.runInContext as JS
// source, so the literal tag markup must not be included). ─────────────────
const CLASSIC_OPEN = "\n<script>\n";
const MODULE_OPEN = '\n<script type="module">\n';
const SCRIPT_CLOSE = "\n</script>\n";
function extractScriptRegions(raw) {
  const classicStart = raw.indexOf(CLASSIC_OPEN);
  if (classicStart === -1) throw new Error("shellSandbox: column-0 <script> tag not found");
  const classicEnd = raw.indexOf(SCRIPT_CLOSE, classicStart + 1);
  if (classicEnd === -1) throw new Error("shellSandbox: classic </script> tag not found");
  const modStart = raw.indexOf(MODULE_OPEN, classicEnd);
  if (modStart === -1) throw new Error('shellSandbox: column-0 <script type="module"> tag not found');
  const modEnd = raw.indexOf(SCRIPT_CLOSE, modStart + 1);
  if (modEnd === -1) throw new Error("shellSandbox: module </script> tag not found");
  return {
    classic: raw.slice(classicStart + CLASSIC_OPEN.length, classicEnd),
    mod: raw.slice(modStart + MODULE_OPEN.length, modEnd),
  };
}

/**
 * wireBridges(context) — assigns onto context.window exactly the bridge
 * objects the module script assigns, importing the SAME names from the SAME
 * files (twin of the module script's bridge block — when a carve moves an
 * export, re-point the import here in the same commit; src/browser/bridge.js
 * is the source of truth for every live `window.__mz*` name). Bridges some
 * snapshot surfaces never reach (__mzIconMap, __mzMapMarks, __mzCanvasSizing,
 * __mzTapStep, __mzControls, __mzIconsApi, __mzHaptics, __mzSettings) are
 * deliberately NOT wired — renderRail()/draw() are stubbed no-ops (see
 * loadShellSandbox step 5), so paint() never reaches for them. __mzTabs is
 * the module script's mount bridge (gear/hero/store); __mzCarriedList is its
 * sibling. renderHeroTab (wired below) renders the Grimoire itself — this
 * harness carries no separate grimoire-rendering seam.
 *
 * Phase 58 (MOTION-03), Plan 06 — __mzFightLogVM and __mzCombatVM are now
 * wired from the REAL src/browser/fightLog.js/combatPanel.js/combatMenu.js
 * exports (previously absent — the pre-Plan-06 comment above named them as
 * never-reached), and __mzBeat is wired over a REAL createBeatRunner (this
 * sandbox's own clock — the fake clock's setTimeout/performance.now when
 * loadShellSandbox was given one, else the sandbox's inert never-firing
 * default — and the live reduced-motion predicate). The runner itself is
 * exposed on loadShellSandbox's returned object as `beatRunner` so a test
 * can `beatRunner.start(planBeat({...}))` directly, reproducing
 * engineCombatAction's own handoff (that function lives in the module
 * script and cannot run in this classic-only sandbox).
 */
function wireBridges(context, { dressing = null } = {}) {
  const w = context.window;
  w.__mzTables = Object.freeze({ ROMAN });
  w.__mzNightlyEats = nightlyEats;
  w.__mzPartyCap = PARTY_CAP;
  w.__mzConditionsOf = conditionsOf;
  w.__mzEther = { itemEffectActive, inStone };
  w.__mzMapView = { mapViewRadius, inViewWindow };
  w.__mzInputGuards = { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled };
  w.__mzArmorDisplay = { armorDisplay, bagArmorText };
  w.__mzBagUsage = bagUsage;
  w.__mzTakesBagSlot = takesBagSlot;
  w.__mzLootCompare = lootCompare;
  w.__mzHasTool = hasTool;
  w.__mzToolIndex = toolIndex;
  w.__mzUsableBy = usableBy;
  w.__mzRations = { view: rationsViewModel, eatsLine: eatsLineFor };
  w.__mzDropShelfItems = dropShelfItems;
  w.__mzTabs = Object.freeze({ gear: renderGearTab, hero: renderHeroTab, store: renderStoreScreen });
  w.__mzCarriedList = renderCarriedList;
  // Phase 63 (GSCR-07..10, GRULE-02) — the REAL sheet renderer, mirroring
  // the module script's own bridge assignment for this same name.
  w.__mzGearSheet = renderGearSheet;
  // Phase 57 (LAYOUT-05): paint() reads band 1's identity line/parts and
  // band 2's fixed-width counter slots through this bridge — wired so the
  // BEHAVIOUR tests in test/unit/hud-bands-layout.test.js can prove paint()
  // routes through it rather than formatting inline.
  w.__mzHudBands = { identityLine, identityParts, counterSlots };
  // Phase 57 (LAYOUT-04/05), Plan 05: the ☰ HUD menu's pure open/close
  // reducer, wired from the real module so test/unit/hud-menu-layout.test.js's
  // BEHAVIOUR cases exercise the real close policy, never a stub.
  w.__mzHudMenu = { next: hudMenuNext, rows: hudMenuRowStates };
  // Phase 58 (MOTION-01) — the REAL camera glide, driven by this sandbox's
  // own scheduler (the fake clock's requestAnimationFrame/performance.now
  // when loadShellSandbox was given one, else the sandbox's inert default
  // no-ops) and the live reduced-motion predicate reading this sandbox's
  // own matchMedia stub (defaulted to reduced — see loadShellSandbox's own
  // doc comment for why). Never a stub instance — map-pan.test.js and
  // reduced-motion.test.js both depend on exercising the real tween.
  w.__mzCameraGlide = createCameraGlide({
    now: () => w.performance.now(),
    raf: (fn) => w.requestAnimationFrame(fn),
    cancelRaf: (id) => w.cancelAnimationFrame(id),
    reduced: () => prefersReducedMotion(w),
  });
  // Phase 58 (MOTION-02) — the REAL panel-close helper, driven by this
  // sandbox's own scheduler (the fake clock's setTimeout/clearTimeout when
  // loadShellSandbox was given one, else the sandbox's inert never-firing
  // default) and the live reduced-motion predicate reading this sandbox's
  // own matchMedia stub. Never a stub instance — panel-motion.test.js and
  // reduced-motion.test.js's "panels" section both depend on exercising
  // the real timer-driven close.
  const panelMotion = createPanelMotion({
    setTimeout: (fn, ms) => w.setTimeout(fn, ms),
    clearTimeout: (id) => w.clearTimeout(id),
    reduced: () => prefersReducedMotion(w),
  });
  w.__mzMotion = {
    reduced: () => prefersReducedMotion(w),
    open: (el) => panelMotion.open(el),
    close: (el, onHidden) => panelMotion.close(el, onHidden),
    isClosing: (el) => panelMotion.isClosing(el),
  };
  // Phase 58 (MOTION-04) — the REAL keyed typewriter (12ms/char, 700ms cap
  // per block), driven by this sandbox's own scheduler (the fake clock's
  // requestAnimationFrame/performance.now when loadShellSandbox was given
  // one, else the sandbox's inert never-firing default) and the live
  // reduced-motion predicate. Never a stub instance — typed-text.test.js
  // and reduced-motion.test.js's "typing" section both depend on
  // exercising the real typewriter through renderRail/renderMajorOverlay.
  const typewriter = createTypewriter({
    now: () => w.performance.now(),
    raf: (fn) => w.requestAnimationFrame(fn),
    cancelRaf: (id) => w.cancelAnimationFrame(id),
    reduced: () => prefersReducedMotion(w),
    doc: w.document,
  });
  w.__mzTypewriter = {
    type: typewriter.type,
    adopt: typewriter.adopt,
    complete: typewriter.complete,
    cancel: typewriter.cancel,
    active: typewriter.active,
    durationFor: (text) => typeDurationMs(String(text ?? "").length),
  };
  // Phase 34/35 — the fight-log and combat-panel/menu view-model bridges,
  // in the SAME shapes the module script assigns (mazeworld.html's own
  // window.__mzFightLogVM/__mzCombatVM lines).
  w.__mzFightLogVM = { rows: fightLogRows, toggle: toggleFightLogEntry, announcement: fightLogAnnouncement, append: appendFightLog, dull: dullFightLogLine };
  w.__mzCombatVM = { header: combatHeaderViewModel, foes: foeListViewModel, lot: yourLotViewModel, overlay: encounterOverlaySpec, menu: combatMenuViewModel };
  // Phase 58 (MOTION-03) — the REAL combat-beat runner, driven by this
  // sandbox's own scheduler (the fake clock when loadShellSandbox was given
  // one, else the sandbox's inert never-firing default) and the live
  // reduced-motion predicate. Never a stub instance — combat-beat-shell
  // .test.js and reduced-motion.test.js's "beat" section both depend on
  // exercising the real reveal/type/hurry/settle machinery through
  // renderEncounter()/renderFightLog()/renderActionArea().
  const beatRunner = createBeatRunner({
    beat: createBeat({
      setTimeout: (fn, ms) => w.setTimeout(fn, ms),
      clearTimeout: (id) => w.clearTimeout(id),
      reduced: () => prefersReducedMotion(w),
    }),
    durationFor: (text) => typeDurationMs(String(text ?? "").length),
    onRender: () => context.renderEncounter(),
    onSettle: () => { context.paint(); context.renderEncounter(); },
    playClips: () => {},
  });
  w.__mzBeat = {
    active: () => beatRunner.active(),
    hurry: () => beatRunner.hurry(),
    view: () => beatRunner.view(),
  };
  context.__mzBeatRunnerInstance = beatRunner;
  // Phase 59 (ANIM-01/02) — the REAL party-marker step-glide controller,
  // driven by this sandbox's own scheduler (the fake clock when
  // loadShellSandbox was given one, else the sandbox's inert never-firing
  // default) and the live reduced-motion predicate; `render` calls the
  // classic script's own window.mzPositionParty, mirroring the module
  // script's own construction exactly. Never a stub instance —
  // party-sprite-shell.test.js's lockstep/reduced-motion tests depend on
  // exercising the real controller.
  w.__mzPartySprite = createPartySprite({
    now: () => w.performance.now(),
    raf: (fn) => w.requestAnimationFrame(fn),
    cancelRaf: (id) => w.cancelAnimationFrame(id),
    reduced: () => prefersReducedMotion(w),
    render: () => w.mzPositionParty?.(),
  });
  // Phase 59 (DRESS-01..05) — the REAL window.__mzDressing bridge, over an
  // injectable art source: given `dressing: { enabled, images }`, the
  // bridge's art answers exactly those two values (a test's fixed decoded-
  // image map or `null`); the default (no `dressing` option) mirrors the
  // real boot state one frame BEFORE the lazy load resolves — Set dressing
  // On, but `images()` still null, which drawLayer's own D-14 guard turns
  // into "draw nothing", matching mazeworld.html's own module-script
  // sequencing exactly. Never a stub instance — dressing-shell.test.js
  // depends on exercising the real bridge/placement/exclusion/draw rules.
  const dressingArt = dressing
    ? { enabled: () => dressing.enabled, images: () => dressing.images }
    : { enabled: () => true, images: () => null };
  w.__mzDressing = createDressingBridge({ art: dressingArt, drawIcon: drawFeatureIcon });
}

/**
 * loadShellSandbox({ doc, reducedMotion = true, clock = null, stubRail = true }) —
 * runs mazeworld.html's classic <script> in a fresh vm context built around
 * the recording document `doc` (createRecordingDocument() from
 * recordingDom.js), wires the real window.__mz* bridges, wires the
 * BEFORE-only Grimoire seam, and stubs the two heavy classic globals
 * (draw/renderRail) so a paint() call never touches the maze canvas or the
 * RAIL — neither is part of the Gear/Hero/Store surfaces this harness's
 * original callers lock.
 *
 * Phase 58 (MOTION-01/05): `reducedMotion` (default true) drives the
 * `matchMedia("(prefers-reduced-motion: reduce)")` stub's `matches` answer —
 * REDUCED BY DEFAULT. Once shell effects are timed, a never-firing timer
 * (this sandbox's own pre-Phase-58 default, see the setTimeout comment
 * below) under "motion on" would strand every animated close/type/beat/pan
 * forever and fail every pre-existing sandbox test for a harness reason,
 * not a real one — defaulting to reduced keeps every pre-existing test on
 * the MOTION-05 end-state path, which is exactly the pre-Phase-58 shell
 * behaviour. An animated-path test opts in explicitly with
 * `reducedMotion: false` plus a `clock` (test/unit/harness/fakeClock.js) —
 * without a `clock`, every scheduler default stays exactly what it always
 * was (an inert never-firing setTimeout/rAF, performance.now() => 0, no
 * `Date` override).
 *
 * Phase 58 (MOTION-04): `stubRail` (default true, unchanged pre-Phase-58
 * behaviour) skips the renderRail() stub and instead wires the REAL
 * window.__mzRailVM/__mzRail from src/browser/rail.js's own exports,
 * mirroring rail-dismiss.test.js#loadRailDismissSandbox's own wiring — so
 * typed-text.test.js can exercise renderRail()'s real card-building/typing/
 * hold/dismiss machinery through this one shared harness, rather than a
 * second sibling loader.
 *
 * Phase 59 (ANIM-01) — `stubDraw` (default true, unchanged pre-Phase-59
 * behaviour) keeps draw() stubbed to a no-op; `stubDraw: false` runs the
 * REAL draw() instead, wiring what it reads (window.__mzIconsApi/
 * __mzIconMap/__mzMapMarks — deliberately absent from wireBridges above,
 * since the stubbed draw() never reaches for them): __mzIconMap gets one
 * fake decoded image per FEATURE_ICONS name (`{ complete: true,
 * naturalWidth: 144, key: name }`, this harness's stand-in for a browser
 * Image, mirroring recordingDom.js's own fake-canvas-context precedent).
 * `canvasContext` (default null), when given, replaces the `#maze` canvas's
 * `getContext` BEFORE the classic script runs, so `const ctx =
 * cv.getContext("2d")` (a classic-script top-level statement) captures a
 * caller-supplied recording context (test/unit/harness/recordingCanvas.js)
 * instead of recordingDom.js's own no-op sink.
 *
 * Phase 59 (DRESS-01..05) — `dressing` (default null) feeds wireBridges'
 * own `{ dressing }` option (see its doc comment above): pass
 * `{ enabled, images }` to control exactly what the real window.__mzDressing
 * bridge's art source answers.
 *
 * Phase 66 (BOARD-01, D-14/D-15) — `boards` (default null) feeds the REAL
 * `createBoardsPanel`/`boardsView` panel and view model, only the data
 * source injected (the same pattern as `dressing` above): pass
 * `{ bests, graves, total }` to control exactly what the panel's
 * `readData()` answers; the default mirrors an empty adapter
 * (`{ bests: null, graves: [], total: 0 }`). `host` is the sandbox
 * document's `#screen-dead`, `prefs` is the sandbox's own fake
 * `localStorage`, and `reducedMotion` always answers true (this harness has
 * no scroll geometry, so `centreRail()`'s `behavior` branch is otherwise
 * untestable). `onRoute` pushes `{ action, hasHero }` into the returned
 * `boardsRoutes` array rather than routing a real screen — never a stub of
 * the panel or view model itself.
 */
export function loadShellSandbox({ doc, reducedMotion = true, clock = null, stubRail = true, stubDraw = true, canvasContext = null, dressing = null, boards = null }) {
  const raw = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");
  const { classic } = extractScriptRegions(raw);

  if (canvasContext) {
    doc.document.getElementById("maze").getContext = () => canvasContext;
  }

  const fakeStorage = new Map();
  const sandbox = {
    document: doc.document,
    console,
    Math,
    // setTimeout returns an incrementing integer and never fires — every
    // confirm/arm-delay timer the Gear tab schedules (DROP_CONFIRM_MS,
    // SWAP_CONFIRM_MS, armEncounterButtons' ARM_DELAY_MS sweep) stays armed
    // for the lifetime of a single snapshot, which is exactly the state the
    // gear-confirms fixture needs to capture. Phase 58: a given `clock`
    // (test/unit/harness/fakeClock.js) replaces this default outright — its
    // own setTimeout DOES fire, driven only by `clock.advance(ms)`.
    setTimeout: clock
      ? clock.setTimeout
      : (() => {
          let id = 1;
          return () => id++;
        })(),
    clearTimeout: clock ? clock.clearTimeout : () => {},
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: clock ? clock.requestAnimationFrame : () => {},
    cancelAnimationFrame: clock ? clock.cancelAnimationFrame : () => {},
    getComputedStyle() {
      return { getPropertyValue: () => "" };
    },
    // Phase 58 (MOTION-05, D-17): the ONE reduced-motion stub every
    // prefersReducedMotion(window) read in this sandbox consults — reduced
    // by default (see this function's own doc comment above).
    matchMedia: (q) => ({
      matches: reducedMotion && q === REDUCED_MOTION_QUERY,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }),
    localStorage: {
      getItem: (k) => (fakeStorage.has(k) ? fakeStorage.get(k) : null),
      setItem: (k, v) => fakeStorage.set(k, String(v)),
      removeItem: (k) => fakeStorage.delete(k),
    },
    navigator: { userAgent: "node", vibrate() {} },
    performance: { now: clock ? clock.now : () => 0 },
    innerWidth: 400,
    innerHeight: 800,
    devicePixelRatio: 1,
    location: { search: "" },
  };
  if (clock) sandbox.Date = clock.Date;
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(classic, context, { filename: "mazeworld.html#classic" });

  wireBridges(context, { dressing });

  // Step 5: stub the heavy classic globals AFTER the script ran (a
  // top-level `function draw(){...}`/`function renderRail(){...}`
  // declaration is a writable global-object property in vm semantics, same
  // as sandboxPrototype.js's own `let S` note documents for `let` — here
  // both are plain `function` declarations, so a direct reassignment is
  // enough, no defineProperty getter trick needed). paintConditions stays
  // live — it only renders the HUD condition strip, harmless and cheap.
  if (stubDraw) {
    context.draw = () => {};
  } else {
    // Phase 59 (ANIM-01): the REAL draw() runs — wire the icon pipeline +
    // map-mark palette it reads (deliberately absent from wireBridges
    // above, since the stubbed draw() never reaches for them).
    context.window.__mzIconsApi = { featureKeyForCell, drawFeatureIcon };
    const iconMap = {};
    for (const name of FEATURE_ICONS) iconMap[name] = { complete: true, naturalWidth: 144, key: name };
    context.window.__mzIconMap = iconMap;
    context.window.__mzMapMarks = { MAP_PALETTE, MARK_GLYPHS, MARK_SCALE, ONEWAY_ROTATION_DEG, MARKS_LEGEND, markForCell, legendFor };
  }
  if (stubRail) {
    context.renderRail = () => {};
    context.window.renderRail = context.renderRail;
  } else {
    // Phase 58 (MOTION-04): the REAL renderRail() runs — wire the rail
    // bridges it reads (deliberately absent from wireBridges above, since
    // the stubbed renderRail() never reaches for them).
    context.window.__mzRailVM = {
      card: railCardFor,
      push: railPush,
      clear: railClear,
      lineCard: railLineCard,
      announcement: railAnnouncement,
      copy: RAIL_COPY,
      holdForCard,
      dismissKind: railDismissKind,
    };
    context.window.__mzRail = emptyRail();
  }

  // Phase 66 (BOARD-01, D-14/D-15) — the REAL panel and view model, only the
  // data source injected (see this function's own doc comment above).
  const boardsData = boards || { bests: null, graves: [], total: 0 };
  const boardsRoutes = [];
  const realBoardsPanel = createBoardsPanel({
    host: context.window.document.getElementById("screen-dead"),
    buildView: boardsView,
    readData: () => boardsData,
    prefs: context.window.localStorage,
    reducedMotion: () => true,
    onRoute: (action, opts) => boardsRoutes.push({ action, ...opts }),
  });
  context.window.__mzBoards = Object.freeze({ onDeadTab: realBoardsPanel.onDeadTab });

  return {
    context,
    setState: (s) => context.window.__mzState.set(s),
    paint: () => context.paint(),
    renderEncounter: () => context.renderEncounter(),
    // Phase 58 (MOTION-03) — the REAL createBeatRunner instance wired by
    // wireBridges above; a test drives it directly via
    // beatRunner.start(planBeat({...})), reproducing engineCombatAction's
    // own module-script-only handoff.
    beatRunner: context.__mzBeatRunnerInstance,
    // Phase 66 (BOARD-01) — the REAL boardsPanel controller instance and the
    // routes onRoute pushed into, so a test can drive
    // boardsPanel.openFromTitle(...)/inspect boardsRoutes directly.
    boardsPanel: realBoardsPanel,
    boardsRoutes,
    doc,
  };
}

/**
 * SNAPSHOT_IDS — the element ids the three surfaces' fixtures capture.
 */
export const SNAPSHOT_IDS = Object.freeze({
  hero: [
    "s-level", "s-name", "s-tag", "s-wp", "s-wpmax", "s-wpfill",
    "s-die", "s-hit", "s-dmg", "s-arm", "s-int", "s-sp", "s-next", "s-cost", "s-rations",
    "s-rations-n", "s-trait", "s-vp", "s-skills", "s-abilities", "s-grim-count", "s-grimoire",
    "doss-who", "doss", "hero-party", "hero-party-list",
  ],
  // Phase 62 (GSCR-01..06): the rebuilt Gear tab's ten render roots — header,
  // WORN, BAG (meter + cards), CONSUMABLES, ALSO ON YOU — replacing the
  // retired Phase 43 ON YOU/BAG panel ids (m-gold/s-kit/s-carry-n/s-onyou/
  // s-carry).
  gear: ["gear-stats", "gear-worn-head", "gear-worn", "gear-bag-head", "gear-bag-meter", "gear-bag", "gear-cons-head", "gear-cons", "gear-kit-head", "gear-kit"],
  store: ["enc-panel", "enc-body", "shelf", "sell-head", "sell-list", "a-leave"],
  // Phase 63 (GSCR-07..10): the GEAR action sheet's six GEAR_SHEET_IDS roots.
  gearSheet: ["mw-gear-sheet-label", "mw-gear-sheet-title", "mw-gear-sheet-note", "mw-gear-sheet-why", "mw-gear-sheet-actions", "mw-gear-sheet-cancel"],
});

function rollThreeDistinctJewels(rng) {
  // "re-roll with the same rng until the three names differ" — draws are
  // cheap (8-row table) and this only ever runs against the one fixed seed
  // this harness uses, so a generous bound is a safety net, not a real limit.
  for (let attempt = 0; attempt < 50; attempt++) {
    const a = rollJewel(rng);
    const b = rollJewel(rng);
    const c = rollJewel(rng);
    if (a.n !== b.n && b.n !== c.n && a.n !== c.n) return [a, b, c];
  }
  throw new Error("shellSandbox: could not roll three distinctly-named jewels within the attempt bound");
}

/**
 * fixedStates() — deterministic, engine-built states for the seven
 * fixtures. Every mutation goes through an exported engine function (never
 * a hand-mutated c.worn/c.items) — the harness's own state-building code is
 * therefore itself a small proof that the engine API is sufficient to reach
 * every DOM branch the fixtures need (worn rows, empty-slot rows, the bag-
 * full store line, the swap confirm).
 */
export function fixedStates() {
  const events = [];

  // ── thief: a fresh Thief with a full bag (worn cloak from chargen, two
  // jewelry pieces worn, a third armed for the swap confirm, weapon/armor/
  // tool filling the small bag's remaining slots) ──────────────────────────
  const thief = newRun(2, [], { force: { cls: "Thief" }, storeRoll: true });
  {
    const rng = makeRng(11);
    // weapon + armor stay in the bag (never equipped — only jewelry
    // exercises the worn-row/swap-confirm branches this fixture needs).
    stowItem(thief, rollBlade(rng, 1, false), events, true);
    stowItem(thief, rollMailPiece(rng), events, true);
    // Three distinctly-named jewels: the first two are stowed-then-equipped
    // immediately (so jewelry1/jewelry2 land occupied without ever pushing
    // the small (4-slot) bag past its cap); the third stays in the bag —
    // both jewelry keys are now full, so its own Equip tap arms the
    // multi-choice swap confirm (thief.gear-confirms.txt).
    const [j1, j2, j3] = rollThreeDistinctJewels(rng);
    // Stow the already-rolled j1/j2 objects directly, equipping each right
    // after it lands in the bag (by its just-known index) so jewelry1/
    // jewelry2 fill without ever needing more than one free slot at a time.
    for (const jewel of [j1, j2]) {
      stowItem(thief, jewel, events, true);
      const i = thief.c.items.length - 1;
      equipItem(thief, i, events);
    }
    stowItem(thief, j3, events, true); // stays in the bag
    const toolKey = TOOLS.rope ? "rope" : Object.keys(TOOLS)[0];
    stowItem(thief, toolItem(toolKey), events, true); // fills the small (4-slot) bag to cap
    stowItem(thief, { kind: "potion", n: "Healing potion", txt: "+d10+2 hp", eff2: "heal", uses: 1 }, events, true); // potions are slot-exempt
    // Filler jewelry until the bag reports full — a no-op loop when the
    // tool stow above already filled it (the small bag's case here), kept
    // generic so a future bag-cap retune can't silently break this fixture.
    let guard = 0;
    while (!bagUsage(thief.c).full) {
      if (guard++ > 20) throw new Error("shellSandbox: filler-jewelry loop never reached bagUsage(c).full");
      stowItem(thief, rollJewel(rng), events, true);
    }
    thief.c.kills = 3;
    thief.c.spellsUsed = 0;
  }

  // ── mu: a fresh Magic User with a joiner in the party ────────────────────
  const mu = newRun(3, [], { force: { cls: "Magic User" } });
  mu.c.spellsUsed = 1;
  const joined = addPartyMember(mu, rollCharacter(makeRng(4)));
  if (!joined) throw new Error("shellSandbox: addPartyMember refused under PARTY_CAP — expected true for a fresh empty party");

  // ── store variants: structuredClone + openStore, never re-rolled ─────────
  const thiefStore = structuredClone(thief);
  openStore(thiefStore, makeRng(5), []);

  const muStore = structuredClone(mu);
  if (muStore.c.items.length !== 0) {
    // A Magic User never starts with bag items (engine/character.js only
    // seeds a Thief's starting cloak, and reconcileWorn moves that into
    // c.worn, not c.items) — this branch is defensive, not expected to run,
    // and is here only so a future chargen change can't silently break the
    // muStore fixture's "nothing to sell" (hidden sell-head) coverage.
    muStore.c.items = [];
  }
  openStore(muStore, makeRng(6), []);

  return { thief, mu, thiefStore, muStore };
}
