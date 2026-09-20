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

import { RACE_NOTE, CLASS_NOTE, SUB_NOTE, ROMAN, THRESHOLDS, WEAPONS, FIGHTER_SKILLS, THIEF_SKILLS, RACES, ABILITY_BY_ID, TOOLS } from "../../../content/index.js";
import { nightlyEats } from "../../../engine/movement.js";
import { PARTY_CAP, newRun, addPartyMember } from "../../../engine/state.js";
import { openStore } from "../../../engine/economy.js";
import {
  conditionsOf,
  itemEffectActive,
  inStone,
  mapViewRadius,
  inViewWindow,
  eff,
  hasTool,
  toHit,
  strikeDie,
  takesBagSlot,
} from "../../../engine/derived.js";
import { isReady } from "../../../engine/effects.js";
import { abilityRoundsLeft } from "../../../engine/abilities.js";
import { toolIndex, rollJewel, rollBlade, rollMailPiece, toolItem, stowItem, equipItem } from "../../../engine/items.js";
import { makeRng } from "../../../engine/rng.js";
import { rollCharacter } from "../../../engine/character.js";
import { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled } from "../../../src/browser/inputGuards.js";
import {
  characterSheetViewModel,
  grimoireViewModel,
  armorDisplay,
  bagArmorText,
  lootCompare,
  usableBy,
  rationsViewModel,
  eatsLineFor,
  dropShelfItems,
} from "../../../src/browser/viewModels.js";
import { bagUsage, renderGearTab, renderCarriedList } from "../../../src/browser/gearTab.js";

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
 * wireLegacyGrimoire(context, mod) — BEFORE-only seam, Plan 04 deletes it
 * the same commit heroTab.js takes the grimoire. Locates the module
 * script's renderGrimoire() function (paint()'s window.__mzRenderGrimoire
 * bridge target) and runs it in the SAME vm context so the Hero-tab
 * fixtures include the real Grimoire markup. Its only free identifiers are
 * `document`, `window` and `grimoireViewModel` (see its own head comment in
 * mazeworld.html) — all three are already on the sandbox by the time this
 * runs. A no-op when the block is absent (post-Plan-04 mazeworld.html).
 */
function wireLegacyGrimoire(context, mod) {
  const startMarker = "  function renderGrimoire() {";
  const endMarker = "  window.__mzRenderGrimoire = renderGrimoire;";
  const start = mod.indexOf(startMarker);
  if (start === -1) return; // Plan 04 deletes this whole block — nothing to wire
  const endLineStart = mod.indexOf(endMarker, start);
  if (endLineStart === -1) throw new Error("shellSandbox: found renderGrimoire() but not its window.__mzRenderGrimoire bridge line");
  const end = endLineStart + endMarker.length;
  const block = mod.slice(start, end);
  context.grimoireViewModel = grimoireViewModel;
  vm.runInContext(block, context, { filename: "mazeworld.html#module-grimoire-seam" });
}

/**
 * wireBridges(context) — assigns onto context.window exactly the bridge
 * objects the module script assigns, importing the SAME names from the SAME
 * files (twin of the module script's bridge block — when a carve moves an
 * export, re-point the import here in the same commit). Bridges the three
 * snapshot surfaces never reach (__mzRailVM, __mzFightLogVM, __mzCombatVM,
 * __mzIconMap, __mzMapMarks, __mzCanvasSizing, __mzTapStep, __mzControls,
 * __mzIconsApi, __mzHaptics, __mzSettings) are deliberately NOT wired —
 * renderRail()/draw() are stubbed no-ops (see loadShellSandbox step 5), so
 * paint() never reaches for them. Phase 47 (SHELL-01), Plan 03, Task 2:
 * __mzGear/__mzItemRowState/__mzWornSlots/__mzWornKeysOf/__mzSlotFor/
 * __mzSellPrice are retired (gearTab.js reaches them directly now);
 * __mzTabs/__mzCarriedList are the twin of the module script's new mount
 * bridges.
 */
function wireBridges(context) {
  const w = context.window;
  w.__mzTables = Object.freeze({ RACE_NOTE, CLASS_NOTE, SUB_NOTE, ROMAN, THRESHOLDS, WEAPONS, FIGHTER_SKILLS, THIEF_SKILLS, RACES });
  w.__mzNightlyEats = nightlyEats;
  w.__mzPartyCap = PARTY_CAP;
  w.__mzConditionsOf = conditionsOf;
  w.__mzEther = { itemEffectActive, inStone };
  w.__mzMapView = { mapViewRadius, inViewWindow };
  w.__mzAbilities = { byId: ABILITY_BY_ID, roundsLeft: abilityRoundsLeft, isReady, sheet: characterSheetViewModel };
  w.__mzEff = eff;
  w.__mzInputGuards = { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled };
  w.__mzArmorDisplay = { armorDisplay, bagArmorText };
  w.__mzBagUsage = bagUsage;
  w.__mzTakesBagSlot = takesBagSlot;
  w.__mzLootCompare = lootCompare;
  w.__mzHasTool = hasTool;
  w.__mzToolIndex = toolIndex;
  w.__mzToHit = toHit;
  w.__mzStrikeDie = strikeDie;
  w.__mzUsableBy = usableBy;
  w.__mzRations = { view: rationsViewModel, eatsLine: eatsLineFor };
  w.__mzDropShelfItems = dropShelfItems;
  w.__mzTabs = Object.freeze({ gear: renderGearTab });
  w.__mzCarriedList = renderCarriedList;
}

/**
 * loadShellSandbox({ doc }) — runs mazeworld.html's classic <script> in a
 * fresh vm context built around the recording document `doc`
 * (createRecordingDocument() from recordingDom.js), wires the real
 * window.__mz* bridges, wires the BEFORE-only Grimoire seam, and stubs the
 * two heavy classic globals (draw/renderRail) so a paint() call never
 * touches the maze canvas or the RAIL — neither is part of the Gear/Hero/
 * Store surfaces this plan locks.
 */
export function loadShellSandbox({ doc }) {
  const raw = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");
  const { classic, mod } = extractScriptRegions(raw);

  const fakeStorage = new Map();
  const sandbox = {
    document: doc.document,
    console,
    Math,
    // setTimeout returns an incrementing integer and never fires — every
    // confirm/arm-delay timer the Gear tab schedules (DROP_CONFIRM_MS,
    // SWAP_CONFIRM_MS, armEncounterButtons' ARM_DELAY_MS sweep) stays armed
    // for the lifetime of a single snapshot, which is exactly the state the
    // gear-confirms fixture needs to capture.
    setTimeout: (() => {
      let id = 1;
      return () => id++;
    })(),
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    getComputedStyle() {
      return { getPropertyValue: () => "" };
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: {
      getItem: (k) => (fakeStorage.has(k) ? fakeStorage.get(k) : null),
      setItem: (k, v) => fakeStorage.set(k, String(v)),
      removeItem: (k) => fakeStorage.delete(k),
    },
    navigator: { userAgent: "node", vibrate() {} },
    performance: { now: () => 0 },
    innerWidth: 400,
    innerHeight: 800,
    devicePixelRatio: 1,
    location: { search: "" },
  };
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(classic, context, { filename: "mazeworld.html#classic" });

  wireBridges(context);
  wireLegacyGrimoire(context, mod);

  // Step 5: stub the heavy classic globals AFTER the script ran (a
  // top-level `function draw(){...}`/`function renderRail(){...}`
  // declaration is a writable global-object property in vm semantics, same
  // as sandboxPrototype.js's own `let S` note documents for `let` — here
  // both are plain `function` declarations, so a direct reassignment is
  // enough, no defineProperty getter trick needed). paintConditions stays
  // live — it only renders the HUD condition strip, harmless and cheap.
  context.draw = () => {};
  context.renderRail = () => {};
  context.window.renderRail = context.renderRail;

  return {
    context,
    setState: (s) => context.window.__mzState.set(s),
    paint: () => context.paint(),
    renderEncounter: () => context.renderEncounter(),
    doc,
  };
}

/**
 * SNAPSHOT_IDS — the element ids the three surfaces' fixtures capture.
 */
export const SNAPSHOT_IDS = Object.freeze({
  hero: [
    "s-level", "s-name", "s-tag", "btn-abandon-character", "s-wp", "s-wpmax", "s-wpfill",
    "s-die", "s-hit", "s-dmg", "s-arm", "s-int", "s-sp", "s-next", "s-cost", "s-rations",
    "s-rations-n", "s-trait", "s-vp", "s-skills", "s-abilities", "s-grim-count", "s-grimoire",
    "doss-who", "doss", "hero-party", "hero-party-list",
  ],
  gear: ["m-gold", "s-kit", "s-carry-n", "s-onyou", "s-carry"],
  store: ["enc-panel", "enc-body", "shelf", "sell-head", "sell-list", "a-leave"],
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
