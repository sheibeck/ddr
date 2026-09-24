// test/unit/shell-account.test.js
//
// Phase 67 (PGS-02, ACCT-01/02; D-01/D-02, D-04..D-12), Plan 08 — pins the
// shell's Play Games account wiring in mazeworld.html's module script: the
// provider chosen by platform (D-12), the non-awaited launch sign-in (D-01),
// the title chip and the account sheet (D-06..D-10), the Phase 70 account
// surfaces (the ☰ face and the ACCOUNT block, D-03/D-04/D-07), the Android
// back button, the Leaderboards identity seam (D-08) and the rail-card
// parking (D-04, D-11). mazeworld.html has no ESM surface a test could
// import, so this uses the comment-stripping and region-extraction technique of
// test/unit/shell-boards-panel.test.js / shell-boards-entry.test.js: SOURCE
// pins over the comment-stripped text, and BEHAVIOUR tests that evaluate the
// exact shipped source of a region with fakes threaded in.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACCOUNT_CLASSES } from "../../src/browser/accountChip.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — the
// order test/unit/shell-combat-over.test.js documents) ──────────────────────
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
const CODE = stripComments(HTML);
const MODULE = CODE.slice(CODE.indexOf('<script type="module">'));

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function occurrences(source, literal) {
  return source.split(literal).length - 1;
}

// The plugin's npm package name, built from two halves so no other scan of
// this file ever counts it (D-12: only playGames.js may name it).
const PLUGIN_PACKAGE = "@modbender/" + "capacitor-play-games";

// ─── fakes ─────────────────────────────────────────────────────────────────

/** fakeDocument({ title, roller, sheet }) — ids mapped to { hidden } nodes, a body with a dataset. */
function fakeDocument({ title = false, roller = false, sheet = false } = {}) {
  const nodes = {
    "mw-title-screen": { hidden: !title },
    "mw-roller-screen": { hidden: !roller },
    "mw-acct-sheet": { hidden: !sheet },
    "mw-acct-rows": { id: "mw-acct-rows" },
    "mw-acct-title": { id: "mw-acct-title" },
  };
  return {
    nodes,
    body: { dataset: {} },
    getElementById: (id) => nodes[id] || null,
  };
}

/** cardParking(doc) — the shipped dungeonVisible/parkAccountCard/flushAccountCard over a fake document and a recording window.mzRailLine. */
function cardParking(doc) {
  const region = sliceBetween(CODE, "let pendingAccountCard = null;", "\n  account = createAccountController({");
  const rail = [];
  const win = { mzRailLine: (...args) => rail.push(args) };
  // Phase 68 (D-12): flushAccountCard also delivers the placement card, whose
  // slot (pendingPgsCard) is declared beside `let account` before the panel.
  const make = new Function(
    "document",
    "window",
    "let pendingPgsCard = null;\n" + region + "\nreturn { dungeonVisible, parkAccountCard, flushAccountCard };",
  );
  return { ...make(doc, win), rail };
}

const WELCOME = Object.freeze({ title: "ON THE PUBLIC RECORD", line: "welcome line", tone: "good", hold: 9000 });
const FAILED = Object.freeze({ title: "PLAY GAMES DID NOT ANSWER", line: "failed line", tone: "dull", hold: 8000 });

/** accountSheet(opts) — the shipped accountSheetOpen/renderAccountSheetNow/openAccountSheet/closeAccountSheet with fakes. */
function accountSheet({ encounter = false, hasState = true, sheetOpen = false } = {}) {
  const region = sliceBetween(CODE, "function accountSheetOpen() {", '\n  document.getElementById("mw-title-acct-chip")');
  const doc = fakeDocument({ sheet: sheetOpen });
  const calls = [];
  let handlers = null;
  const win = {
    __mzState: hasState ? { c: {} } : undefined,
    mzKeepPartyInView: () => calls.push(["keepInView"]),
  };
  const account = {
    sheetView: () => ({ view: "sheet" }),
    signIn: () => calls.push(["signIn"]),
    stopCompeting: () => calls.push(["stopCompeting"]),
    setCompete: (v) => calls.push(["setCompete", v]),
  };
  const panelMotion = {
    open: (el) => {
      calls.push(["open", el === doc.nodes["mw-acct-sheet"]]);
      el.hidden = false;
    },
    close: (el) => {
      calls.push(["close", el === doc.nodes["mw-acct-sheet"]]);
      el.hidden = true;
    },
  };
  const renderAccountSheet = (hosts, view, h) => {
    calls.push(["render", hosts.rows?.id, hosts.title?.id, view.view]);
    handlers = h;
  };
  const openSettingsSheet = () => calls.push(["openSettings"]);
  const hasActiveEncounter = () => encounter;
  const make = new Function(
    "document",
    "window",
    "account",
    "hasActiveEncounter",
    "panelMotion",
    "renderAccountSheet",
    "openSettingsSheet",
    region + "\nreturn { accountSheetOpen, renderAccountSheetNow, openAccountSheet, closeAccountSheet };",
  );
  const fns = make(doc, win, account, hasActiveEncounter, panelMotion, renderAccountSheet, openSettingsSheet);
  return { ...fns, doc, calls, handlers: () => handlers };
}

// ═══════════════════════ (A) imports and provider (D-12) ═══════════════════

test("(A1) SOURCE: the two Phase 67 import lines (the accountChip.js line extended in place by Phase 70 with renderMenuFace and renderAccountMenu) appear exactly once each, and the pinned engineAdapter line is byte-identical", () => {
  assert.equal(occurrences(HTML, 'import { createPlayGames, createFakePlayGames } from "./src/browser/playGames.js";'), 1);
  assert.equal(occurrences(HTML, 'import { createAccountController, renderAccountChip, renderAccountSheet, renderMenuFace, renderAccountMenu } from "./src/browser/accountChip.js";'), 1);
  assert.equal(occurrences(HTML, 'from "./src/browser/playGames.js";'), 1);
  assert.equal(occurrences(HTML, 'from "./src/browser/accountChip.js";'), 1);
  assert.equal(occurrences(HTML, 'import { boot, dispatch, startNewRun, waitForPending, takeBootWornReport } from "./src/browser/engineAdapter.js";'), 1);
});

test("(A2) SOURCE: the provider is chosen by isNativePlatform — createPlayGames() on native, the fake seeded by pgsDevSignedIn in the browser", () => {
  assert.match(MODULE, /const pgsNative = !!window\.Capacitor\?\.isNativePlatform\?\.\(\);/);
  assert.match(
    MODULE,
    // Phase 68 (68-07): the fake also gets the real score orders for the dev IDs.
    /const pgsProvider = pgsNative \? createPlayGames\(\) : createFakePlayGames\(\{ signedIn: currentSettings\?\.pgsDevSignedIn === true, orders: scoreOrdersFor\(pgsIds\) \}\);/,
  );
  assert.equal(occurrences(MODULE, "createPlayGames("), 1);
  assert.equal(occurrences(MODULE, "createFakePlayGames("), 1);
  // The seed is read after the settings load.
  assert.ok(MODULE.indexOf("applySettings(await readSettings());") < MODULE.indexOf("const pgsProvider ="));
});

test("(A3) SOURCE: the shell never names the plugin package (D-12), not even in a comment", () => {
  assert.equal(occurrences(CODE, PLUGIN_PACKAGE), 0);
  assert.equal(occurrences(HTML, PLUGIN_PACKAGE), 0);
});

test("(A4) SOURCE: one controller, wired to the provider, readSettings, writeAccountSetting and the card parker", () => {
  assert.equal(occurrences(MODULE, "createAccountController({"), 1);
  const region = sliceBetween(MODULE, "account = createAccountController({", "});");
  assert.match(region, /provider: pgsProvider,/);
  assert.match(region, /settings: \{ read: readSettings, write: writeAccountSetting \},/);
  assert.match(region, /notify: parkAccountCard,/);
});

test("(A5) BEHAVIOUR: writeAccountSetting awaits writeSetting, then re-applies the settings mirror", async () => {
  const region = sliceBetween(CODE, "async function writeAccountSetting(key, value) {", "\n  let pendingAccountCard = null;");
  const calls = [];
  const writeSetting = async (key, value) => {
    calls.push(["write", key, value]);
    return { compete: value };
  };
  const applySettings = (next) => calls.push(["apply", next]);
  const fn = new Function("writeSetting", "applySettings", region + "\nreturn writeAccountSetting;")(writeSetting, applySettings);
  const next = await fn("compete", false);
  assert.deepStrictEqual(next, { compete: false });
  assert.deepStrictEqual(calls, [
    ["write", "compete", false],
    ["apply", { compete: false }],
  ]);
});

// ═══════════════════════ (B) the non-blocking boot (D-01/D-02) ═════════════

test("(B1) SOURCE: account.boot() runs once, after the initTitleScreen IIFE, and is never awaited", () => {
  assert.equal(occurrences(MODULE, "account.boot()"), 1);
  assert.equal(occurrences(MODULE, "account.boot().catch(() => {});"), 1);
  const iifeEnd = MODULE.indexOf("refreshTitleDead();\n  })();");
  const bootIdx = MODULE.indexOf("account.boot()");
  assert.ok(iifeEnd !== -1 && bootIdx > iifeEnd, "account.boot() must come after initTitleScreen");
  assert.ok(MODULE.indexOf("(function initTitleScreen() {") < iifeEnd);
  assert.doesNotMatch(MODULE, /await\s+account\.boot\(/);
  assert.doesNotMatch(MODULE, /await\s+account\./);
});

test("(B2) SOURCE: subscribe re-renders the three account surfaces, the open sheet and the Leaderboards panel; renderAccountSurfaces paints the title chip (chipView), the ☰ face (menuView via renderMenuFace) and the ACCOUNT host (sheetView via renderAccountMenu), once before boot too", () => {
  const region = sliceBetween(MODULE, "account.subscribe(() => {", "});");
  assert.match(region, /renderAccountSurfaces\(\);/);
  assert.match(region, /if \(accountSheetOpen\(\)\) renderAccountSheetNow\(\);/);
  assert.match(region, /boardsPanel\.refresh\(\);/);
  assert.equal(occurrences(MODULE, "renderAccountChips"), 0, "the Phase 67 two-chip renderer is retired");
  const surfaces = sliceBetween(MODULE, "function renderAccountSurfaces() {", "\n  account.subscribe(");
  assert.match(surfaces, /renderAccountChip\(document\.getElementById\("mw-title-acct-chip"\), account\.chipView\(\)\);/);
  assert.match(surfaces, /renderMenuFace\(document\.getElementById\("mw-hud-menu-btn"\), account\.menuView\(\)\);/);
  assert.match(surfaces, /renderAccountMenu\(document\.getElementById\("mw-hud-menu-acct"\), account\.sheetView\(\), \{/);
  assert.equal(occurrences(surfaces, "renderAccountChip("), 1, "only the title chip is a chip now");
  const after = MODULE.slice(MODULE.indexOf("account.subscribe(() => {"));
  assert.match(after, /\}\);\n\s*renderAccountSurfaces\(\);/);
});

// ═══════════════════════ (C) the Leaderboards identity seam (D-08) ═════════

test("(C1) SOURCE: `let account = null;` precedes the Leaderboards panel instance, which reads identity() from it", () => {
  const letIdx = MODULE.indexOf("let account = null;");
  const panelIdx = MODULE.indexOf("const boardsPanel = createBoardsPanel({");
  assert.ok(letIdx !== -1 && panelIdx !== -1 && letIdx < panelIdx);
  const region = sliceBetween(MODULE, "const boardsPanel = createBoardsPanel({", "});");
  assert.match(region, /identity: \(\) => \(account \? account\.identity\(\) : \{ signedIn: false, player: null \}\),/);
});

// ═══════════════════════ (D) the account sheet (D-09/D-10) ═════════════════

test("(D1) SOURCE: only the title chip opens the sheet (Phase 70 D-03: the band-2 chip is retired), with no options and no encounter guard; scrim and Close close it", () => {
  assert.match(MODULE, /document\.getElementById\("mw-title-acct-chip"\)\?\.addEventListener\("click", \(\) => openAccountSheet\(\)\);/);
  assert.equal(occurrences(MODULE, '"mw-acct-chip"'), 0, "no listener or render for the retired band-2 chip");
  assert.equal(occurrences(MODULE, "fromHud"), 0);
  assert.match(MODULE, /document\.getElementById\("mw-acct-scrim"\)\?\.addEventListener\("click", closeAccountSheet\);/);
  assert.match(MODULE, /document\.getElementById\("mw-acct-close"\)\?\.addEventListener\("click", closeAccountSheet\);/);
  const open = sliceBetween(MODULE, "function openAccountSheet(", "\n  }");
  assert.ok(open.startsWith("function openAccountSheet() {"), "openAccountSheet takes no options");
  assert.doesNotMatch(open, /hasActiveEncounter/, "the title chip's sheet has no encounter guard");
});

test("(D2) BEHAVIOUR: the title chip opens the sheet even with an encounter flag set, rendering the sheet view first", () => {
  const s = accountSheet({ encounter: true });
  s.openAccountSheet();
  assert.deepStrictEqual(s.calls, [
    ["render", "mw-acct-rows", "mw-acct-title", "sheet"],
    ["open", true],
  ]);
  assert.equal(s.accountSheetOpen(), true);
});

test("(D4) BEHAVIOUR: the rows go through the controller, and Settings closes the account sheet before opening the settings sheet", () => {
  const s = accountSheet();
  s.openAccountSheet();
  const h = s.handlers();
  s.calls.length = 0;
  h.onSignIn();
  h.onStopCompeting();
  h.onCompete(false);
  h.onCompete(true);
  assert.deepStrictEqual(s.calls, [["signIn"], ["stopCompeting"], ["setCompete", false], ["setCompete", true]]);
  s.calls.length = 0;
  h.onSettings();
  assert.deepStrictEqual(s.calls, [["close", true], ["keepInView"], ["openSettings"]]);
  assert.equal(s.accountSheetOpen(), false);
});

test("(D5) SOURCE: the Android back button — hasOpenModal includes the account sheet, and closeModal's first statement closes it", () => {
  const ctx = sliceBetween(MODULE, "getGameContext: () => ({", "navigateBack: () => {");
  const hasOpenModal = ctx.slice(ctx.indexOf("hasOpenModal:"), ctx.indexOf("hasLiveRun:"));
  assert.match(hasOpenModal, /accountSheetOpen\(\)/);
  const helper = sliceBetween(MODULE, "function accountSheetOpen() {", "\n  }");
  assert.match(helper, /document\.getElementById\("mw-acct-sheet"\)/);
  const closeModal = sliceBetween(MODULE, "closeModal: () => {", "\n        navigateBack: () => {");
  const body = closeModal.slice("closeModal: () => {".length).trim();
  assert.ok(
    body.startsWith("if (accountSheetOpen()) { closeAccountSheet(); return; }"),
    `closeModal's first statement must close the account sheet, got: ${body.slice(0, 80)}`,
  );
});

// ═══════════════════════ (E) rail-card parking (D-04/D-11) ═════════════════

test("(E1) BEHAVIOUR: a card parked while the title is up is not delivered; hiding the title and flushing delivers it once", () => {
  const doc = fakeDocument({ title: true });
  const p = cardParking(doc);
  p.parkAccountCard(WELCOME);
  assert.deepStrictEqual(p.rail, []);
  doc.nodes["mw-title-screen"].hidden = true;
  p.flushAccountCard();
  assert.deepStrictEqual(p.rail, [[WELCOME.title, WELCOME.line, WELCOME.tone, WELCOME.hold]]);
  p.flushAccountCard();
  assert.equal(p.rail.length, 1, "each card is delivered once");
});

test("(E2) BEHAVIOUR: two cards parked before a flush deliver only the latest", () => {
  const doc = fakeDocument({ title: true });
  const p = cardParking(doc);
  p.parkAccountCard(WELCOME);
  p.parkAccountCard(FAILED);
  doc.nodes["mw-title-screen"].hidden = true;
  p.flushAccountCard();
  assert.deepStrictEqual(p.rail, [[FAILED.title, FAILED.line, FAILED.tone, FAILED.hold]]);
});

test("(E3) BEHAVIOUR: a flush with nothing parked does nothing; a null card is ignored", () => {
  const p = cardParking(fakeDocument());
  p.flushAccountCard();
  p.parkAccountCard(null);
  assert.deepStrictEqual(p.rail, []);
});

test("(E4) BEHAVIOUR: a card waits while the title-mode Leaderboards panel or the roller is up", () => {
  const doc = fakeDocument({ roller: true });
  doc.body.dataset.boardsEntry = "title";
  const p = cardParking(doc);
  p.parkAccountCard(FAILED);
  assert.deepStrictEqual(p.rail, []);
  delete doc.body.dataset.boardsEntry;
  p.flushAccountCard();
  assert.deepStrictEqual(p.rail, [], "the roller still covers the map");
  doc.nodes["mw-roller-screen"].hidden = true;
  p.flushAccountCard();
  assert.deepStrictEqual(p.rail, [[FAILED.title, FAILED.line, FAILED.tone, FAILED.hold]]);
});

test("(E5) BEHAVIOUR: with the dungeon visible, a card goes straight to the rail", () => {
  const p = cardParking(fakeDocument());
  assert.equal(p.dungeonVisible(), true);
  p.parkAccountCard(WELCOME);
  assert.deepStrictEqual(p.rail, [[WELCOME.title, WELCOME.line, WELCOME.tone, WELCOME.hold]]);
});

test("(E6) SOURCE: the flush runs at the three map landings — hideTitleScreen, the roller's onCommit and routeFromBoards' dungeon branch", () => {
  const hide = sliceBetween(MODULE, "function hideTitleScreen() {", "\n  function hasActiveDelveSave()");
  assert.match(hide, /queueMicrotask\(flushAccountCard\);/);
  const commit = sliceBetween(MODULE, "onCommit: (state) => {", "\n  window.mzStartRoll = roller.start;");
  assert.match(commit, /queueMicrotask\(flushAccountCard\);/);
  const dungeon = sliceBetween(MODULE, '} else if (action === "dungeon") {', '} else if (action === "roll") {');
  assert.match(dungeon, /flushAccountCard\(\);/);
  assert.ok(dungeon.indexOf("surfaceWornReconcile();") < dungeon.indexOf("flushAccountCard();"));
});

test("(E7) BEHAVIOUR: ENTER hides the title and opens the roller in the same tap — the deferred flush from hideTitleScreen keeps the card parked", () => {
  const doc = fakeDocument({ title: true });
  const p = cardParking(doc);
  const queue = [];
  const hideRegion = sliceBetween(CODE, "function hideTitleScreen() {", "\n  function hasActiveDelveSave()");
  const hideTitleScreen = new Function("document", "queueMicrotask", "flushAccountCard", hideRegion + "\nreturn hideTitleScreen;")(
    doc,
    (fn) => queue.push(fn),
    p.flushAccountCard,
  );
  p.parkAccountCard(WELCOME);
  hideTitleScreen();
  doc.nodes["mw-roller-screen"].hidden = false; // window.mzStartRoll() in the same handler
  queue.splice(0).forEach((fn) => fn());
  assert.deepStrictEqual(p.rail, [], "the roller now covers the map");
  doc.nodes["mw-roller-screen"].hidden = true; // the roller's commit
  p.flushAccountCard();
  assert.deepStrictEqual(p.rail, [[WELCOME.title, WELCOME.line, WELCOME.tone, WELCOME.hold]]);
});

// ═══════════════════════ (F) cross-checks and invariants ════════════════════

test("(F1) every ACCOUNT_CLASSES entry has a rule in mazeworld.html's style blocks", () => {
  const styles = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  for (const cls of ACCOUNT_CLASSES) {
    const re = new RegExp(`\\.${cls.replace(/-/g, "\\-")}(?![\\w-])`);
    assert.match(styles, re, `no CSS rule for .${cls}`);
  }
});

test("(F2) the ☰ menu keeps its four legacy rows (ids and listener lines) in order, with the Phase 70 ACCOUNT host as the dropdown's first child", () => {
  for (const id of ["mw-chip-marks", "mw-chip-centre", "btn-camp", "mw-gear-btn"]) {
    assert.equal(occurrences(HTML, `id="${id}"`), 1, `row id ${id}`);
  }
  const menu = sliceBetween(HTML, '<div class="mw-hud-menu" id="mw-hud-menu"', "</header>");
  const order = ["mw-hud-menu-acct", "mw-chip-marks", "mw-chip-centre", "btn-camp", "mw-gear-btn"].map((id) => menu.indexOf(`id="${id}"`));
  for (let i = 0; i < order.length; i++) assert.ok(order[i] !== -1, `row ${i} present`);
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] < order[i], `row ${i} out of order`);
  assert.equal(menu.indexOf("<button"), menu.indexOf('id="mw-chip-marks"') - '<button type="button" role="menuitem" class="mw-hud-menu-item" '.length, "no row precedes the ACCOUNT host");
  // Phase 70 (D-07): every row closes the menu before its action.
  assert.match(CODE, /document\.getElementById\("mw-chip-marks"\)\.addEventListener\("click", closeMenuThen\(openMarksLegend\)\);/);
  assert.match(CODE, /document\.getElementById\("mw-chip-centre"\)\.addEventListener\("click", closeMenuThen\(glideCenterMap\)\);/);
  assert.match(CODE, /document\.getElementById\("btn-camp"\)\.onclick = closeMenuThen\(openCampSheet\);/);
  assert.match(CODE, /document\.getElementById\("mw-gear-btn"\)\?\.addEventListener\("click", closeMenuThen\(openSettingsSheet\)\);/);
});

test("(F3) no new window.__mz bridge in the account wiring, and the comment-stripped shell has no network-capable call", () => {
  const block = sliceBetween(MODULE, "const pgsNative =", "renderAccountSurfaces();\n");
  assert.doesNotMatch(block, /window\.__mz\w*\s*=/);
  const sheet = sliceBetween(MODULE, "function accountSheetOpen() {", '\n  document.getElementById("mw-acct-close")');
  assert.doesNotMatch(sheet, /window\.__mz\w*\s*=/);
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(CODE, bad);
  }
});

// ═══════════════════════ (G) Phase 70: the ☰ face and the ACCOUNT block ═════

/** accountSurfaces() — the shipped renderAccountSurfaces with recording renderers, a fake account and a recording hudMenuEvent. */
function accountSurfaces() {
  const region = sliceBetween(CODE, "function renderAccountSurfaces() {", "\n  account.subscribe(");
  const log = [];
  const renders = [];
  let handlers = null;
  const doc = { getElementById: (id) => ({ id }) };
  const account = {
    chipView: () => ({ view: "chip" }),
    menuView: () => ({ view: "menu" }),
    sheetView: () => ({ view: "sheet" }),
    signIn: () => log.push("signIn"),
    stopCompeting: () => log.push("stopCompeting"),
    setCompete: (v) => log.push(`setCompete:${v}`),
  };
  const renderAccountChip = (el, view) => renders.push(["chip", el.id, view.view]);
  const renderMenuFace = (el, view) => renders.push(["face", el.id, view.view]);
  const renderAccountMenu = (el, view, h) => {
    renders.push(["menu", el.id, view.view]);
    handlers = h;
  };
  const hudMenuEvent = (kind) => log.push(kind);
  const fn = new Function(
    "document",
    "account",
    "renderAccountChip",
    "renderMenuFace",
    "renderAccountMenu",
    "hudMenuEvent",
    region + "\nreturn renderAccountSurfaces;",
  )(doc, account, renderAccountChip, renderMenuFace, renderAccountMenu, hudMenuEvent);
  return { render: fn, log, renders, handlers: () => handlers };
}

test("(G1) BEHAVIOUR: renderAccountSurfaces renders the three surfaces from the controller's views, and every ACCOUNT handler closes the ☰ (select) BEFORE routing to the controller (D-07)", () => {
  const s = accountSurfaces();
  s.render();
  assert.deepStrictEqual(s.renders, [
    ["chip", "mw-title-acct-chip", "chip"],
    ["face", "mw-hud-menu-btn", "menu"],
    ["menu", "mw-hud-menu-acct", "sheet"],
  ]);
  const h = s.handlers();
  assert.deepStrictEqual(Object.keys(h).sort(), ["onCompete", "onSignIn", "onStopCompeting"], "no Settings handler: the ☰ already has SETTINGS");
  h.onSignIn();
  assert.deepStrictEqual(s.log.splice(0), ["select", "signIn"]);
  h.onStopCompeting();
  assert.deepStrictEqual(s.log.splice(0), ["select", "stopCompeting"]);
  h.onCompete(false);
  assert.deepStrictEqual(s.log.splice(0), ["select", "setCompete:false"]);
  h.onCompete(true);
  assert.deepStrictEqual(s.log.splice(0), ["select", "setCompete:true"]);
});
