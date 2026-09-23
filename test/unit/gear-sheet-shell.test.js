// test/unit/gear-sheet-shell.test.js
//
// Phase 63 (GSCR-07..10, GRULE-02), Plan 04 — the GEAR action sheet's shell
// lifecycle suite: markup, CSS, source pins on mazeworld.html's classic and
// module scripts, and the sandbox lifecycle (open/close paths, focus, motion
// and reduced motion, the live combat re-render, the vanish-close). Mirrors
// panel-motion.test.js's own HTML/CODE reads and buildScenario pattern, and
// gearTab.test.js's own stripComments/extractScriptRegions/sliceBetween
// source-pin trio.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { CLOSE_MS, CLOSE_SLACK_MS } from "../../src/browser/motion.js";
import { gearSheetModel, GEAR_SHEET_IDS } from "../../src/browser/gearSheet.js";
import { dropShelfItems } from "../../src/browser/viewModels.js";
import { slotFor } from "../../engine/derived.js";
import { toolIndex } from "../../engine/items.js";
import { newRun } from "../../engine/engine.js";
import { startCombat } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { CLOAKS, JEWELRY, ARMORS } from "../../content/index.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// fixedStates()/the local combat-lock builders below both roll/derive
// content-table data under it, so this file runs under the SAME explicit
// identity override every sibling DOM-snapshot suite uses.
setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");
const HTML_RAW = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

// ─── comment stripping + classic/module region split (gearTab.test.js's own
// precedent) ────────────────────────────────────────────────────────────
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

function extractScriptRegions(raw) {
  const classicStart = raw.indexOf("\n<script>\n");
  assert.ok(classicStart !== -1, "column-0 <script> tag not found");
  const classicEnd = raw.indexOf("\n</script>\n", classicStart + 1);
  assert.ok(classicEnd !== -1, "classic </script> tag not found");
  const modStart = raw.indexOf('\n<script type="module">\n', classicEnd);
  assert.ok(modStart !== -1, 'column-0 <script type="module"> tag not found');
  const modEnd = raw.indexOf("\n</script>\n", modStart + 1);
  assert.ok(modEnd !== -1, "module </script> tag not found");
  return {
    classic: raw.slice(classicStart + 1, classicEnd),
    mod: raw.slice(modStart + 1, modEnd),
  };
}

const { classic: CLASSIC_RAW, mod: MOD_RAW } = extractScriptRegions(HTML_RAW);
const CLASSIC = stripComments(CLASSIC_RAW);
const MOD = stripComments(MOD_RAW);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ═══════════════════════════════════════════════════════════════════════
// ─── markup ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function gearSheetMarkup() {
  return sliceBetween(HTML_RAW, '<div id="mw-gear-sheet"', '<div id="app"');
}

test("markup: #mw-gear-sheet is a hidden .mw-legend-sheet with the scrim, the role=dialog/aria-modal/aria-labelledby panel, a tabindex=-1 title, every GEAR_SHEET_IDS id exactly once, and a real CANCEL button", () => {
  const markup = gearSheetMarkup();
  assert.match(markup, /<div id="mw-gear-sheet" class="mw-legend-sheet" hidden>/);
  assert.match(markup, /<div class="mw-legend-scrim" id="mw-gear-sheet-scrim"><\/div>/);
  assert.match(markup, /role="dialog" aria-modal="true" aria-labelledby="mw-gear-sheet-title"/);
  assert.match(markup, /<h2 class="mw-gsheet-title" id="mw-gear-sheet-title" tabindex="-1">/);
  assert.match(markup, /<button type="button" class="mw-gsheet-cancel" id="mw-gear-sheet-cancel">/);
  for (const id of Object.values(GEAR_SHEET_IDS)) {
    const re = new RegExp(`id="${id}"`, "g");
    assert.equal((markup.match(re) || []).length, 1, `expected id="${id}" exactly once inside the sheet markup`);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── CSS ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

// The Phase 63 CSS block: from its own header comment to the next rule this
// plan did not add (.mw-roller-screen{) — a precise, self-controlled bound
// so this scan never wanders into unrelated markup (which legitimately
// carries plain aria-hidden/aria-label attributes) the way a generic "next
// /* ---------- header" search would past this section's own close.
function gsheetCssBlock() {
  return sliceBetween(HTML_RAW, "/* ---------- GEAR action sheet (Phase 63, GSCR-07..10) ----------", ".mw-roller-screen{");
}

function gsheetStyleLines() {
  return gsheetCssBlock()
    .split("\n")
    .filter((line) => /^\.mw-gsheet[^{]*\{/.test(line));
}

test("CSS: every .mw-gsheet-* rule's font-size (when present) scales with var(--mw-text-scale), and none carries a transition/animation token", () => {
  const lines = gsheetStyleLines();
  assert.equal(lines.length, 18, `expected 18 .mw-gsheet-* style lines, found ${lines.length}`);
  let fontSizeCount = 0;
  for (const line of lines) {
    assert.doesNotMatch(line, /transition/i, `unexpected transition in ${line.trim()}`);
    assert.doesNotMatch(line, /animation/i, `unexpected animation in ${line.trim()}`);
    const m = line.match(/font-size:([^;}]+)[;}]/);
    if (!m) continue;
    fontSizeCount++;
    assert.match(m[1], /var\(--mw-text-scale\)/, `expected ${line.trim()} to scale with var(--mw-text-scale)`);
  }
  assert.equal(fontSizeCount, 8, `expected 8 font-size declarations, found ${fontSizeCount}`);
});

test("CSS: the Phase 63 block carries no aria- token anywhere (comments included)", () => {
  assert.doesNotMatch(gsheetCssBlock(), /aria-/);
});

test("CSS: the [data-off] rules grey the row (opacity .45) and hide the chevron", () => {
  const block = gsheetCssBlock();
  assert.match(block, /\.mw-gsheet-act\[data-off\]\{opacity:\.45;cursor:default\}/);
  assert.match(block, /\.mw-gsheet-act\[data-off\] \.mw-gsheet-chev\{visibility:hidden\}/);
});

// ═══════════════════════════════════════════════════════════════════════
// ─── source pins ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

test("source pin: tabDeps() names openGearSheet and closeGearSheet", () => {
  const region = sliceBetween(CLASSIC, "function tabDeps() {", "\nfunction paint() {");
  assert.match(region, /\bopenGearSheet\b/);
  assert.match(region, /\bcloseGearSheet\b/);
});

test("source pin: paint()'s region contains exactly one refreshGearSheet() call, after the gear mount", () => {
  const region = sliceBetween(CLASSIC, "function paint() {", "\n}");
  const matches = region.match(/refreshGearSheet\(\)/g) || [];
  assert.equal(matches.length, 1, "expected exactly one refreshGearSheet() call inside paint()");
  const mountIdx = region.indexOf('window.__mzTabs.gear(document.getElementById("screen-gear"), S, tabDeps());');
  const refreshIdx = region.indexOf("refreshGearSheet()");
  assert.ok(mountIdx !== -1 && refreshIdx !== -1 && refreshIdx > mountIdx, "refreshGearSheet() must come after the gear mount");
});

test("source pin: the gear-sheet lets are declared before function tabDeps()", () => {
  const targetIdx = CLASSIC.indexOf("let gearSheetTarget = null;");
  const openerIdx = CLASSIC.indexOf("let gearSheetOpenerId = null;");
  const tabDepsIdx = CLASSIC.indexOf("function tabDeps() {");
  assert.ok(targetIdx !== -1 && openerIdx !== -1 && tabDepsIdx !== -1);
  assert.ok(targetIdx < tabDepsIdx && openerIdx < tabDepsIdx, "gearSheetTarget/gearSheetOpenerId must precede tabDeps() (never a TDZ)");
});

test("source pin: armEncounterButtons' arm sweep excludes greyed Gear-sheet actions", () => {
  assert.match(CLASSIC, /\.mw-legend-sheet \[aria-disabled="true"\]:not\(\[data-off\]\)/);
});

test("source pin: the scrim tap closes the sheet", () => {
  assert.match(CLASSIC, /getElementById\("mw-gear-sheet-scrim"\)\.addEventListener\("click", closeGearSheet\);/);
});

test("source pin: hasOpenModal ORs in the Gear sheet's visibility", () => {
  const region = sliceBetween(MOD, "hasOpenModal:", "hasLiveRun:");
  assert.match(region, /mw-gear-sheet/);
});

test("source pin: closeModal closes the Gear sheet first — after hudMenuEvent(\"escape\") and before window.__mzStair = null", () => {
  const region = sliceBetween(MOD, "closeModal: () => {", "navigateBack:");
  assert.match(region, /if \(gearSheetTarget !== null\) \{ closeGearSheet\(\); return; \}/);
  const hudIdx = region.indexOf('hudMenuEvent("escape");');
  const gearIdx = region.indexOf("if (gearSheetTarget !== null)");
  const stairIdx = region.indexOf("window.__mzStair = null;");
  assert.ok(hudIdx !== -1 && gearIdx !== -1 && stairIdx !== -1);
  assert.ok(hudIdx < gearIdx && gearIdx < stairIdx, "closeGearSheet() must run after hudMenuEvent and before the stair clear");
});

test("source pin: window.__mzGearSheet = renderGearSheet; precedes await boot(", () => {
  const bridgeIdx = MOD.indexOf("window.__mzGearSheet = renderGearSheet;");
  const bootIdx = MOD.indexOf("await boot(");
  assert.ok(bridgeIdx !== -1, "window.__mzGearSheet assignment not found");
  assert.ok(bootIdx !== -1, "await boot( call not found");
  assert.ok(bridgeIdx < bootIdx, "window.__mzGearSheet must be assigned before the first await boot(");
});

// ═══════════════════════════════════════════════════════════════════════
// ─── sandbox lifecycle ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

const states = fixedStates();

/** bagJewelTarget(state) — the thief fixture's bagged third jewel (never a
 * hard-coded index): the one dropShelfItems entry whose slotFor is
 * "jewelry". */
function bagJewelTarget(state) {
  const entry = dropShelfItems(state.c).find(({ it }) => slotFor(it) === "jewelry");
  assert.ok(entry, "expected a bagged jewel in the fixture");
  return { i: entry.i, n: entry.it.n };
}

/** ropeTarget(state) — the thief fixture's rope, by engine lookup, never a
 * hard-coded index. */
function ropeTarget(state) {
  const i = toolIndex(state.c, "rope");
  assert.ok(i !== -1, "expected a rope in the fixture's bag");
  return { i, n: state.c.items[i].n };
}

function actionButtons(doc) {
  return doc.document.getElementById("mw-gear-sheet-actions").children.filter((c) => c.nodeType !== 3);
}

test("sandbox open: openGearSheet on the bagged jewel un-hides the sheet, sets the title to the jewel's name, renders one button per gearSheetModel action key, and moves focus to the title exactly once", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc }); // reduced motion, the default
  sandbox.setState(states.thief);

  const sheet = doc.document.getElementById("mw-gear-sheet");
  sheet.hidden = true;
  const titleEl = doc.document.getElementById("mw-gear-sheet-title");
  let focusCalls = 0;
  titleEl.focus = () => {
    focusCalls++;
  };

  const bag = bagJewelTarget(states.thief);
  const target = { from: "bag", i: bag.i, n: bag.n };
  sandbox.context.openGearSheet(target, "gear-open-bag-" + bag.i);

  assert.equal(sheet.hidden, false);
  assert.equal(titleEl.textContent, bag.n);
  const expectedKeys = gearSheetModel(states.thief, target).actions.map((a) => a.key);
  const actualKeys = actionButtons(doc).map((c) => c.dataset.key);
  assert.deepEqual(actualKeys, expectedKeys);
  assert.equal(focusCalls, 1);
});

test("sandbox unresolvable: an unresolvable bag target opens nothing — the sheet stays hidden and focus is never moved", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(states.thief);

  const sheet = doc.document.getElementById("mw-gear-sheet");
  sheet.hidden = true;
  const titleEl = doc.document.getElementById("mw-gear-sheet-title");
  let focusCalls = 0;
  titleEl.focus = () => {
    focusCalls++;
  };

  sandbox.context.openGearSheet({ from: "bag", i: 99, n: "x" }, "gear-open-bag-99");

  assert.equal(sheet.hidden, true);
  assert.equal(focusCalls, 0);
});

test("sandbox close under reduced motion: closeGearSheet() hides the sheet synchronously and stamps the settle window at call time", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(states.thief);

  sandbox.context.openGearSheet({ from: "worn", slot: "cloak" }, "btn-camp");
  const sheet = doc.document.getElementById("mw-gear-sheet");
  assert.equal(sheet.hidden, false);

  sandbox.context.closeGearSheet();
  assert.equal(sheet.hidden, true);
  assert.equal(sandbox.context.encounterSettled(), false, "lastDismissAt must be stamped at call time");
});

test("sandbox close under motion: closeGearSheet() animates the close and returns focus to the opener only after the 0ms timer fires", () => {
  const clock = createFakeClock();
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: false, clock });
  sandbox.setState(states.thief);

  const bag = bagJewelTarget(states.thief);
  const openerId = "gear-open-bag-" + bag.i;
  const openerEl = doc.document.getElementById(openerId); // auto-created
  let focusCalls = 0;
  openerEl.focus = () => {
    focusCalls++;
  };

  sandbox.context.openGearSheet({ from: "bag", i: bag.i, n: bag.n }, openerId);
  const sheet = doc.document.getElementById("mw-gear-sheet");
  assert.equal(sheet.hidden, false);

  sandbox.context.closeGearSheet();
  assert.equal(sheet.hidden, false, "must stay un-hidden through the animated close");
  assert.equal(sheet.dataset.motion, "closing");
  assert.equal(focusCalls, 0, "focus must not run before the 0ms timer fires");

  clock.advance(1);
  assert.equal(focusCalls, 1, "focus returns to the opener once the dispatch-driven 0ms timer fires");

  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(sheet.hidden, true);
});

test("sandbox CANCEL: wired through guardTap to closeGearSheet()", () => {
  const clock = createFakeClock();
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, clock });
  sandbox.setState(states.thief);

  sandbox.context.openGearSheet({ from: "worn", slot: "cloak" }, "btn-camp");
  clock.advance(ARM_DELAY_MS);
  const sheet = doc.document.getElementById("mw-gear-sheet");
  assert.equal(sheet.hidden, false);

  const cancelBtn = doc.document.getElementById("mw-gear-sheet-cancel");
  cancelBtn.onclick();
  assert.equal(sheet.hidden, true);
});

test("sandbox DROP: the second tap closes the sheet BEFORE dispatching (GSCR-09 order), on the rope's true bag index", () => {
  const clock = createFakeClock();
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, clock });
  sandbox.setState(states.thief);

  const rope = ropeTarget(states.thief);
  const sheet = doc.document.getElementById("mw-gear-sheet");
  const spyCalls = [];
  sandbox.context.window.mzDropItem = (i) => {
    spyCalls.push({ i, closingOrHidden: sheet.hidden || sheet.dataset.motion === "closing" });
  };

  sandbox.context.openGearSheet({ from: "bag", i: rope.i, n: rope.n }, "gear-open-bag-" + rope.i);
  clock.advance(ARM_DELAY_MS);

  const dropBtn = actionButtons(doc).find((c) => c.dataset.key === "drop");
  assert.ok(dropBtn, "expected a DROP button");
  dropBtn.onclick(); // arms the tap-again confirm — no dispatch yet
  assert.equal(spyCalls.length, 0);
  dropBtn.onclick(); // fires

  assert.equal(spyCalls.length, 1);
  assert.equal(spyCalls[0].i, rope.i);
  assert.equal(spyCalls[0].closingOrHidden, true, "the sheet must already be closing/hidden when the dispatch lands");
});

test("sandbox vanish: setState with the sheet's target item removed closes the sheet on the next paint()", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(states.thief);

  const rope = ropeTarget(states.thief);
  sandbox.context.openGearSheet({ from: "bag", i: rope.i, n: rope.n }, "gear-open-bag-" + rope.i);
  const sheet = doc.document.getElementById("mw-gear-sheet");
  assert.equal(sheet.hidden, false);

  const withoutRope = structuredClone(states.thief);
  withoutRope.c.items.splice(rope.i, 1);
  sandbox.setState(withoutRope);
  sandbox.paint();

  assert.equal(sheet.hidden, true);
});

// ─── Phase 63 Plan 05: end-to-end row → sheet → dispatch ─────────────────
//
// These two tests drive the REAL gear tab mount (paint(), never
// sandbox.context.openGearSheet directly) — the row's own onclick opens the
// sheet, exactly as a player's tap does, proving renderGearTab's opener
// wiring reaches the real classic openGearSheet/closeGearSheet/dispatch
// path end to end.

test("end-to-end: tapping the bagged jewel's row (through the real gear-tab mount) opens the sheet; SWAP INTO JEWELRY 1 closes it before dispatching equipItem(i, \"jewelry1\"), and focus returns to the opener", () => {
  const clock = createFakeClock();
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: false, clock });
  sandbox.setState(states.thief);
  sandbox.paint();

  const bag = bagJewelTarget(states.thief);
  const openerId = "gear-open-bag-" + bag.i;
  const openerEl = doc.document.getElementById(openerId);
  let focusCalls = 0;
  openerEl.focus = () => {
    focusCalls++;
  };

  const sheet = doc.document.getElementById("mw-gear-sheet");
  sheet.hidden = true;

  const bagEl = doc.document.getElementById("gear-bag");
  const jewelLi = bagEl.children.find((li) => li.dataset.i === String(bag.i));
  assert.ok(jewelLi, "expected the bagged jewel's card");
  jewelLi.onclick();

  assert.equal(sheet.hidden, false, "expected the row's own tap to open the sheet");
  const titles = actionButtons(doc).map((c) => c.textContent);
  assert.ok(titles.some((t) => t.includes("SWAP INTO JEWELRY 1")), "expected a SWAP INTO JEWELRY 1 action");
  assert.ok(titles.some((t) => t.includes("SWAP INTO JEWELRY 2")), "expected a SWAP INTO JEWELRY 2 action");
  assert.ok(titles.some((t) => t.includes("DROP")), "expected a DROP action");

  clock.advance(ARM_DELAY_MS);

  const spyCalls = [];
  sandbox.context.window.mzEquipItem = (i, slot) => {
    spyCalls.push({ i, slot, closingOrHidden: sheet.hidden || sheet.dataset.motion === "closing" });
  };

  const swapBtn = actionButtons(doc).find((c) => c.dataset.key === "slot:jewelry1");
  assert.ok(swapBtn, "expected a slot:jewelry1 action button");
  swapBtn.onclick();

  assert.equal(spyCalls.length, 1);
  assert.equal(spyCalls[0].i, bag.i);
  assert.equal(spyCalls[0].slot, "jewelry1");
  assert.equal(spyCalls[0].closingOrHidden, true, "the sheet must already be closing/hidden when the dispatch lands");

  assert.equal(focusCalls, 0, "focus must not run before the 0ms timer fires");
  clock.advance(1);
  assert.equal(focusCalls, 1, "focus returns to the opener once the dispatch-driven 0ms timer fires");
});

test("end-to-end: clicking a WORN row's USE button (with a stopPropagation stub) dispatches useItem but never opens the sheet", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(states.thief);
  sandbox.paint();

  const sheet = doc.document.getElementById("mw-gear-sheet");
  sheet.hidden = true;

  const useCalls = [];
  sandbox.context.window.mzUseItem = (ref) => useCalls.push(ref);

  const wornEl = doc.document.getElementById("gear-worn");
  const jewelry1 = wornEl.children.find((li) => li.dataset.slot === "jewelry1");
  const useCell = jewelry1.children.find((n) => n.className === "mw-gear-use");
  assert.ok(useCell, "expected the thief fixture's worn jewelry1 to carry a USE cell");
  const btn = useCell.children.find((n) => n.tagName === "button");
  const s = [];
  btn.onclick({ stopPropagation: () => s.push(1) });

  assert.equal(s.length, 1, "expected the USE tap to stop propagation");
  assert.deepStrictEqual(useCalls, [{ slot: "jewelry1" }]);
  assert.equal(sheet.hidden, true, "expected the USE tap to never open the sheet");
});

// ─── GRULE-02: the live combat re-render ─────────────────────────────────
//
// The seed-6 Demons pending-fight fixture (combat-gear-lock.test.js's own
// builders, copied locally — pendingLoot/pendingFind cleared before
// startCombat so no loot/find card competes with the sheet). paint() itself
// mounts the hero/gear tabs and renderEncounter() for the WHOLE screen, well
// outside this sheet's own scope for a `combat.pending` fixture — this test
// drives refreshGearSheet() directly instead, exactly the call paint() makes
// once gearSheetTarget is non-null (proven by the source pin above), so it
// exercises the real production code path without the unrelated overhead/
// risk of painting a pending-Fight!-preview encounter this harness has no
// existing coverage for.

const LOCK_FIXTURE_SEED = 6;
const LOCK_FORCED_CATEGORY = "Demons";

function buildLockBaseState() {
  const state = newRun(LOCK_FIXTURE_SEED);
  const c = state.c;
  const shortSword = { kind: "weapon", n: "Short Sword", base: "Short Sword", bonus: 0, txt: "d6+2" };
  const studded = ARMORS.find((a) => a.name === "Studded");
  const armorItem = {
    kind: "armor",
    n: studded.name,
    armor: studded.name,
    ar: studded.ar,
    wp: studded.wp,
    min: studded.min,
    cls: studded.cls,
    txt: `AR ${studded.ar}, ${studded.wp} hp`,
  };
  const bagCloak = Object.assign({ kind: "cloak" }, CLOAKS[0]);
  const bagJewel = Object.assign({ kind: "jewel" }, JEWELRY[0]);
  c.items = [shortSword, armorItem, bagCloak, bagJewel];
  c.worn = {
    cloak: Object.assign({ kind: "cloak" }, CLOAKS[1]),
    jewelry1: Object.assign({ kind: "jewel" }, JEWELRY[1]),
  };
  // Phase 63 Plan 04: cleared (combat-gear-lock.test.js's own fixture parks
  // a pendingLoot pile and a pendingFind here) — this test only needs a
  // pending fight, with nothing else competing for the sheet's attention.
  state.pendingLoot = null;
  state.pendingFind = null;
  return state;
}

function buildLockPendingState() {
  const clone = buildLockBaseState();
  const rng = makeRng(clone.rngState);
  const events = [];
  startCombat(clone, false, LOCK_FORCED_CATEGORY, rng, events);
  clone.rngState = rng.getState();
  assert.equal(clone.combat && clone.combat.pending, true, "fixture setup: expected combat.pending === true");
  return clone;
}

test("sandbox combat re-render (GRULE-02): a fight starting greys the open sheet's swap action in place with the Phase 61 refusal line; ending the fight makes it live again", () => {
  const base = buildLockBaseState();
  const pending = buildLockPendingState();
  const target = { from: "worn", slot: "jewelry1" };

  const baseModel = gearSheetModel(base, target);
  const swapAction = baseModel.actions.find((a) => a.key.startsWith("swap:"));
  assert.ok(swapAction && swapAction.enabled, "expected a live swap action outside combat");

  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(base);
  sandbox.context.openGearSheet(target, "gear-open-worn-jewelry1");
  const sheet = doc.document.getElementById("mw-gear-sheet");
  assert.equal(sheet.hidden, false);

  sandbox.setState(pending);
  sandbox.context.refreshGearSheet();
  assert.equal(sheet.hidden, false, "the sheet stays open, greyed in place");
  const swapBtn = actionButtons(doc).find((c) => c.dataset.key === swapAction.key);
  assert.ok(swapBtn, "expected the same swap action button to still exist");
  assert.equal(swapBtn.dataset.off, "1");
  const subEl = doc.document.getElementById(swapBtn.getAttribute("aria-describedby"));
  const expectedReason = LINE_FOR.gearRefused({ type: "gearRefused", verb: "equipItem", reason: "combat" }).text;
  assert.equal(subEl.textContent, expectedReason);

  sandbox.setState(base);
  sandbox.context.refreshGearSheet();
  assert.equal(sheet.hidden, false, "the fight ending must not itself close the sheet");
  const liveSwapBtn = actionButtons(doc).find((c) => c.dataset.key === swapAction.key);
  assert.ok(liveSwapBtn);
  assert.equal(liveSwapBtn.dataset.off, undefined, "the swap action must be live again once the lock clears");
});
