// test/unit/shell-boards-panel.test.js
//
// Phase 66 (BOARD-01..08, D-13/D-14/D-15/D-16), Plan 06 — original v1 panel
// pins. Rewired for the v3 panel by Phase 84 (BOARD-18, BOARD-19, BOARD-25,
// BOARD-27), Plan 08: wires the REAL v3 Leaderboards panel
// (src/browser/leaderboardPanel.js + leaderboardView.js) into the shell
// sandbox and pins the DEAD tab end to end: sandbox rendering/interaction
// behaviour through window.__mzShowTab("dead"), routeFromBoards' dock/back
// routing (extracted from the module script and evaluated with a fake
// window/showTitleScreen/surfaceWornReconcile — unchanged by this plan),
// the deletion of the classic graveyard screen/renderers/bridge, and the
// zero-network pin (BOARD-08). Uses the comment-stripping and
// region-extraction helpers from test/unit/shell-combat-over.test.js
// (mazeworld.html has no ESM surface a test could import directly), and
// builds fixture history records with runHistory.js#historyRecordOf the way
// test/unit/runHistory.test.js does.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { runHash } from "../../engine/records.js";
import { historyRecordOf } from "../../src/browser/runHistory.js";
import { newRun } from "../../engine/state.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — see
// test/unit/shell-combat-over.test.js's own header note on why order
// matters) ───────────────────────────────────────────────────────────────
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

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── fixtures — YOUR DEAD history records (runHistory.js#historyRecordOf
// over a RunSummary-shaped object, the same construction
// test/unit/runHistory.test.js uses) ─────────────────────────────────────
function historyRun(overrides = {}) {
  const base = {
    season: 1,
    seed: 1,
    acts: 10,
    floor: 5,
    steps: 500,
    day: 3,
    kills: 2,
    gold: 100,
    sp: 50,
    level: 2,
    race: "Human",
    sub: "Soldier",
    cls: "Fighter",
    name: "Anna",
    cause: "combat",
    note: "died to a rat",
    epitaph: "The rat remembers.",
    when: 1700000000000,
    ...overrides,
  };
  const record = historyRecordOf({ ...base, hash: runHash(base) }, overrides.version || "2.1.0 (11)");
  assert.ok(record, `expected a valid history record for ${JSON.stringify(overrides)}`);
  return record;
}

/** twelveHistoryRuns() — 12 distinctly-floored history records, so YOUR DEAD's top-ten cap is exercised. */
function twelveHistoryRuns() {
  const runs = [];
  for (let i = 0; i < 12; i++) {
    runs.push(
      historyRun({
        name: `Runner ${i}`,
        floor: 20 - i,
        steps: 200 + i,
        day: 5 + i,
        kills: i,
        gold: 1000 - i * 10,
        level: (i % 5) + 1,
        when: 1700000000000 - i * 3600000,
      }),
    );
  }
  return runs;
}

/** boardDoc(overrides) — a minimal, valid LEADERBOARD row doc (the shape runDoc.js#buildRunDoc produces). */
function boardDoc(overrides = {}) {
  return {
    id: overrides.id || "doc1",
    uid: overrides.uid || "uidOther",
    handle: overrides.handle || "@mossjaw",
    name: overrides.name || "Runner",
    race: overrides.race || "Human",
    sub: overrides.sub || "Wizard",
    cls: overrides.cls || "Magic User",
    level: overrides.level ?? 3,
    floor: overrides.floor ?? 10,
    day: overrides.day ?? 8,
    steps: overrides.steps ?? 400,
    kills: overrides.kills ?? 15,
    gold: overrides.gold ?? 900,
    sp: overrides.sp ?? 50,
    cause: overrides.cause || "combat",
    note: overrides.note || "cut down by a Werebeast",
    epitaph: overrides.epitaph || "The dungeon remembers.",
    when: overrides.when ?? Date.UTC(2026, 8, 28, 12, 0),
    version: overrides.version || "2.1.0 (11)",
  };
}

/** READY_SNAPSHOT — a resolved, cache-hit LEADERBOARD board snapshot: two rows, no pinned own-best row. */
const READY_SNAPSHOT = Object.freeze({
  status: "ready",
  stale: false,
  fetchedAt: Date.UTC(2026, 8, 29, 11, 0),
  rows: Object.freeze([boardDoc({ id: "doc1", handle: "@mossjaw" }), boardDoc({ id: "doc2", handle: "@sootknee", uid: "uidOther2" })]),
  total: 2,
  filteredTotal: null,
  you: null,
  youKnown: true,
  uid: "uidSelf",
});

/** openDeadTab(boardsOpts) — a fresh sandbox with the real v3 panel wired over `{ history, compete, board }`, already on the DEAD tab. */
function openDeadTab(boardsOpts) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, boards: boardsOpts });
  sandbox.context.window.__mzShowTab("dead");
  const screenDead = doc.elementsById.get("screen-dead");
  return { doc, sandbox, screenDead, root: screenDead.querySelector(".mw-lb") };
}

/** statPicker(root) — the RANK BY picker button (recordingDom has no attribute-selector support, so filter .mw-lb-picker by dataset). */
function statPicker(root) {
  const picker = root.querySelectorAll(".mw-lb-picker").find((p) => p.dataset.picker === "stat");
  assert.ok(picker, "expected the RANK BY picker");
  return picker;
}

/** pickStat(root, label) — opens the RANK BY sheet and taps the option whose label matches. */
function pickStat(root, label) {
  statPicker(root).onclick();
  const opt = root.querySelectorAll(".mw-lb-opt").find((o) => o.querySelector(".mw-lb-opt-label").textContent === label);
  assert.ok(opt, `expected a RANK BY option labelled ${label}`);
  opt.onclick();
}

// ═══════════════════════ (A) sandbox: the DEAD tab entry ═══════════════════

test("(A1) BEHAVIOUR: __mzShowTab(\"dead\") leaves #screen-dead holding exactly one .mw-lb root, tab-entered, on YOUR DEAD with INTERRED reading the history count", () => {
  const runs = twelveHistoryRuns();
  const { screenDead, root } = openDeadTab({ history: runs, compete: false });
  assert.equal(screenDead.querySelectorAll(".mw-lb").length, 1);
  assert.ok(root, "expected a .mw-lb root");
  assert.equal(root.dataset.entry, "tab");
  assert.equal(root.dataset.mode, "mine");
  assert.equal(root.querySelector(".mw-lb-box-n").textContent, String(runs.length));
});

test("(A2) BEHAVIOUR: YOUR DEAD lists exactly ten rows (the history's own top-ten cap over 12 runs)", () => {
  const runs = twelveHistoryRuns();
  const { root } = openDeadTab({ history: runs, compete: false });
  assert.equal(root.querySelectorAll(".mw-lb-row").length, 10);
});

test("(A3) BEHAVIOUR: a tab-opened panel has no chevron and a hidden dock", () => {
  const runs = twelveHistoryRuns();
  const { root } = openDeadTab({ history: runs, compete: false });
  assert.equal(root.querySelectorAll(".mw-lb-back").length, 0);
  assert.equal(root.querySelector(".mw-lb-dock").hidden, true);
});

test("(A4) BEHAVIOUR: a tab-opened panel never sets body[data-boards-entry]", () => {
  const runs = twelveHistoryRuns();
  const { sandbox } = openDeadTab({ history: runs, compete: false });
  assert.equal(sandbox.context.window.document.body.dataset.boardsEntry, undefined);
});

// Phase 78 (HUD-03): showTab("dead") passes { dead } to onDeadTab, so a dead
// hero's DEAD tab docks FINAL SHEET and BURY THEM; a live hero's stays hidden.
function openDeadTabWith(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, boards: { history: [], compete: false } });
  sandbox.setState(state);
  sandbox.paint();
  sandbox.context.window.__mzShowTab("dead");
  const root = doc.elementsById.get("screen-dead").querySelector(".mw-lb");
  return { doc, sandbox, root };
}

test("(A5) BEHAVIOUR (HUD-03): a dead hero's DEAD tab docks FINAL SHEET then BURY THEM, and each routes through onRoute", () => {
  const s = newRun(5, [], { force: { cls: "Thief" } });
  die(s, "combat", "a rat", makeRng(4), [], () => 1);
  const { root, sandbox } = openDeadTabWith(s);
  const dock = root.querySelector(".mw-lb-dock");
  assert.equal(dock.hidden, false);
  const btns = dock.querySelectorAll(".mw-lb-dock-btn");
  assert.deepStrictEqual(btns.map((b) => [b.dataset.action, b.textContent, b.dataset.primary]), [
    ["finalSheet", "FINAL SHEET", "0"],
    ["bury", "BURY THEM", "1"],
  ]);
  btns[0].onclick();
  btns[1].onclick();
  assert.deepStrictEqual(sandbox.boardsRoutes.map((r) => r.action), ["finalSheet", "bury"]);
});

test("(A6) BEHAVIOUR (HUD-03): a live hero's DEAD tab keeps a hidden dock", () => {
  const { root } = openDeadTabWith(newRun(5, [], { force: { cls: "Thief" } }));
  assert.equal(root.querySelector(".mw-lb-dock").hidden, true);
});

test("(A7) BEHAVIOUR: the in-game DEAD tab keeps the HUD and the condition strip (Phase 70 D-08); only the title-opened panel hides them, through the body marker", () => {
  const runs = twelveHistoryRuns();
  const { doc, sandbox } = openDeadTab({ history: runs, compete: false });
  assert.notEqual(doc.elementsById.get("mw-hud")?.dataset?.offtab, "1");
  assert.notEqual(doc.elementsById.get("mm-conditions")?.dataset?.offtab, "1");
  // Tab mode sets no body marker (A4), so the title-mode hide rules below
  // never apply to the in-game tab. shell-boards-entry.test.js (D1) proves
  // openFromTitle sets the "title" marker these rules key on.
  assert.equal(sandbox.context.window.document.body.dataset.boardsEntry, undefined);
  const html = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
  assert.match(html, /^body\[data-boards-entry="title"\] #mw-hud\{display:none\}$/m);
  assert.match(html, /^body\[data-boards-entry="title"\] #mm-conditions\{display:none\}$/m);
});

// ═══════════════════════ (B) RANK BY stat memory (D-04) ═════════════════════

test("(B1) BEHAVIOUR: picking DAYS in the RANK BY sheet makes it the active picker value and stores \"days\" under ddr.boards.last.v1", () => {
  const runs = twelveHistoryRuns();
  const { sandbox, root } = openDeadTab({ history: runs, compete: false });
  pickStat(root, "DAYS");

  assert.equal(statPicker(root).querySelector(".mw-lb-picker-val").textContent, "DAYS");
  assert.equal(sandbox.context.window.localStorage.getItem("ddr.boards.last.v1"), "days");
});

test("(B2) BEHAVIOUR: the DEAD tab reopens on the last RANK BY stat after a detour through the map", () => {
  const runs = twelveHistoryRuns();
  const { sandbox, screenDead, root } = openDeadTab({ history: runs, compete: false });
  pickStat(root, "DAYS");

  sandbox.context.window.__mzShowTab("maze");
  sandbox.context.window.__mzShowTab("dead");

  const reopened = screenDead.querySelector(".mw-lb");
  assert.equal(statPicker(reopened).querySelector(".mw-lb-picker-val").textContent, "DAYS");
});

// ═══════════════════════ (C) row tap-expand (D-13) ══════════════════════════

test("(C1) BEHAVIOUR: tapping a row opens exactly one .mw-lb-detail carrying six .mw-lb-stat chips", () => {
  const runs = twelveHistoryRuns();
  const { screenDead, root } = openDeadTab({ history: runs, compete: false });
  assert.equal(root.querySelectorAll(".mw-lb-detail").length, 0);

  root.querySelectorAll(".mw-lb-row")[0].onclick();

  const after = screenDead.querySelector(".mw-lb");
  const details = after.querySelectorAll(".mw-lb-detail");
  assert.equal(details.length, 1);
  assert.equal(details[0].querySelectorAll(".mw-lb-stat").length, 6);
});

test("(C2) BEHAVIOUR: opening a different row leaves exactly one .mw-lb-detail open (the previous row's detail closes)", () => {
  const runs = twelveHistoryRuns();
  const { screenDead, root } = openDeadTab({ history: runs, compete: false });
  root.querySelectorAll(".mw-lb-row")[0].onclick();

  const afterFirst = screenDead.querySelector(".mw-lb");
  afterFirst.querySelectorAll(".mw-lb-row")[1].onclick();

  const afterSecond = screenDead.querySelector(".mw-lb");
  assert.equal(afterSecond.querySelectorAll(".mw-lb-detail").length, 1);
});

test("(C3) BEHAVIOUR: tapping the same (already-open) row again closes it — zero .mw-lb-detail remain", () => {
  const runs = twelveHistoryRuns();
  const { screenDead, root } = openDeadTab({ history: runs, compete: false });
  root.querySelectorAll(".mw-lb-row")[0].onclick();
  let current = screenDead.querySelector(".mw-lb");
  current.querySelectorAll(".mw-lb-row")[1].onclick();
  current = screenDead.querySelector(".mw-lb");
  current.querySelectorAll(".mw-lb-row")[1].onclick();

  const finalRoot = screenDead.querySelector(".mw-lb");
  assert.equal(finalRoot.querySelectorAll(".mw-lb-detail").length, 0);
});

// ═══════════════════════ (D) empty state (D-12) ═════════════════════════════

test("(D1) BEHAVIOUR: an empty history shows INTERRED \"0\" and NOBODY YET", () => {
  const { root } = openDeadTab({ history: [], compete: false });
  assert.equal(root.querySelector(".mw-lb-box-n").textContent, "0");
  assert.equal(root.querySelectorAll(".mw-lb-empty").length, 1);
  assert.equal(root.querySelector(".mw-lb-empty-title").textContent, "NOBODY YET");
});

// ═══════════════════════ (E) routeFromBoards (D-01) ═════════════════════════

/** routeFromBoardsFactory() — extracts routeFromBoards' source from the module script and returns a Function taking (window, showTitleScreen, surfaceWornReconcile, flushAccountCard) and returning the live routeFromBoards closure. Never a stub of the real logic — the exact shipped source is evaluated. Phase 67 (D-04/D-11) added the flushAccountCard seam to the dungeon branch. */
function routeFromBoardsFactory() {
  const region = sliceBetween(CODE, "function routeFromBoards(action", "\n  function surfaceWornReconcile(");
  return new Function("window", "showTitleScreen", "surfaceWornReconcile", "flushAccountCard", region + "\nreturn routeFromBoards;");
}

function callRouteFromBoards(action, opts) {
  const calls = [];
  const fakeWindow = {
    __mzShowTab: (name) => calls.push(["showTab", name]),
    mzStartRoll: () => calls.push(["mzStartRoll"]),
    // Phase 78 (HUD-03): the dead-hero dock's two routes.
    mzOpenFinalSheet: () => calls.push(["mzOpenFinalSheet"]),
    mzReturnToTitle: () => calls.push(["mzReturnToTitle"]),
  };
  const showTitleScreen = (arg) => calls.push(["showTitleScreen", arg]);
  const surfaceWornReconcile = () => calls.push(["surfaceWornReconcile"]);
  const flushAccountCard = () => calls.push(["flushAccountCard"]);
  const routeFromBoards = routeFromBoardsFactory()(fakeWindow, showTitleScreen, surfaceWornReconcile, flushAccountCard);
  routeFromBoards(action, opts);
  return calls;
}

test('(E1) SOURCE: routeFromBoards("title", { hasHero: true }) shows the map then the title screen with allowResume true', () => {
  assert.deepStrictEqual(callRouteFromBoards("title", { hasHero: true }), [
    ["showTab", "maze"],
    ["showTitleScreen", { allowResume: true }],
  ]);
});

test('(E2) SOURCE: routeFromBoards("title", { hasHero: false }) passes allowResume false', () => {
  assert.deepStrictEqual(callRouteFromBoards("title", { hasHero: false }), [
    ["showTab", "maze"],
    ["showTitleScreen", { allowResume: false }],
  ]);
});

test('(E3) SOURCE: routeFromBoards("dungeon", ...) shows the map, surfaces the worn-reconcile report, then delivers a parked account card (Phase 67)', () => {
  assert.deepStrictEqual(callRouteFromBoards("dungeon", { hasHero: true }), [
    ["showTab", "maze"],
    ["surfaceWornReconcile"],
    ["flushAccountCard"],
  ]);
});

test('(E4) SOURCE: routeFromBoards("roll", ...) opens the character roller', () => {
  assert.deepStrictEqual(callRouteFromBoards("roll", {}), [["mzStartRoll"]]);
});

test('(E6) SOURCE (HUD-03): routeFromBoards("finalSheet", ...) opens the FINAL SHEET and nothing else', () => {
  assert.deepStrictEqual(callRouteFromBoards("finalSheet", { hasHero: false }), [["mzOpenFinalSheet"]]);
});

test('(E7) SOURCE (HUD-03): routeFromBoards("bury", ...) shows the map, then takes the death card\'s own way back to the title', () => {
  assert.deepStrictEqual(callRouteFromBoards("bury", { hasHero: false }), [["showTab", "maze"], ["mzReturnToTitle"]]);
});

test('(E5) SOURCE: an unknown action calls nothing', () => {
  assert.deepStrictEqual(callRouteFromBoards("nope", {}), []);
});

// ═══════════════════════ (F) deletion + zero-network pins (D-14, BOARD-08) ══

test("(F1) SOURCE: the classic graveyard renderers, its copy and its bridge are gone; #screen-dead has no children; the .yard*/.stone* CSS is gone", () => {
  assert.doesNotMatch(CODE, /function renderGravesLoading\(/);
  assert.doesNotMatch(CODE, /function renderGraves\(\)/);
  assert.doesNotMatch(CODE, /window\.__mzGravesCount\s*=/);
  assert.doesNotMatch(HTML, /id="yard"/);
  assert.doesNotMatch(HTML, /id="yard-count"/);
  assert.match(HTML, /<section class="mw-screen" id="screen-dead" data-screen="dead" hidden><\/section>/);
  assert.doesNotMatch(CODE, /\.yard-wrap\{/);
  assert.doesNotMatch(CODE, /\.yard-head/);
  assert.doesNotMatch(CODE, /\.yard\{/);
  assert.doesNotMatch(CODE, /\.yard-empty\{/);
  assert.doesNotMatch(CODE, /\.yard-loading\{/);
  assert.doesNotMatch(CODE, /\.stone\{/);
  assert.doesNotMatch(CODE, /\.stone-/);
  assert.doesNotMatch(CODE, /Showing last/);
});

test("(F2) SOURCE: showTab's DEAD branch calls the boards bridge, refreshTitleDead reads getRunHistory()/competeIsOn(), and the module script carries the v3 Phase 84 import lines", () => {
  // Phase 78 (HUD-03): the call carries { dead }, so a dead hero's tab docks
  // FINAL SHEET and BURY THEM.
  assert.match(CODE, /if \(name === "dead"\) window\.__mzBoards\?\.onDeadTab\?\.\(\{ dead \}\);/);
  const refreshTitleDeadRegion = sliceBetween(CODE, "function refreshTitleDead()", "function showTitleScreen(");
  assert.match(refreshTitleDeadRegion, /getRunHistory\(\)\.length > 0 \|\| competeIsOn\(\)/);
  assert.match(CODE, /import \{ getRunHistory \} from "\.\/src\/browser\/engineAdapter\.js";/);
  assert.match(CODE, /import \{ createLeaderboardPanel \} from "\.\/src\/browser\/leaderboardPanel\.js";/);
  assert.match(CODE, /import \{ leaderboardView \} from "\.\/src\/browser\/leaderboardView\.js";/);
});

// ═══════════════════════ (G) Compete ON: LEADERBOARD (BOARD-18/19/27) ═══════

test("(G1) BEHAVIOUR: Compete ON with a board seam answering a ready snapshot opens on LEADERBOARD, rendering its rows", () => {
  const history = twelveHistoryRuns();
  const board = { load: () => Promise.resolve(READY_SNAPSHOT), cached: () => READY_SNAPSHOT, clear: () => {} };
  const { root } = openDeadTab({ history, compete: true, board });

  assert.equal(root.dataset.mode, "board");
  assert.equal(root.querySelector(".mw-lb-title").textContent, "LEADERBOARD");
  const rows = root.querySelectorAll(".mw-lb-row");
  assert.equal(rows.length, 2);
  assert.deepStrictEqual(
    rows.map((r) => r.querySelector(".mw-lb-handle").textContent),
    ["@mossjaw", "@sootknee"],
  );
});

test("(G2) BEHAVIOUR: the YOURS › box on LEADERBOARD reads the local history count", () => {
  const history = twelveHistoryRuns();
  const board = { load: () => Promise.resolve(READY_SNAPSHOT), cached: () => READY_SNAPSHOT, clear: () => {} };
  const { root } = openDeadTab({ history, compete: true, board });

  assert.equal(root.querySelector(".mw-lb-box-label").textContent, "YOURS ›");
  assert.equal(root.querySelector(".mw-lb-box-n").textContent, String(history.length));
});

test("(G3) BEHAVIOUR: LEADERBOARD shows the SEASON OF THE ALPHA line under the title", () => {
  const board = { load: () => Promise.resolve(READY_SNAPSHOT), cached: () => READY_SNAPSHOT, clear: () => {} };
  const { root } = openDeadTab({ history: [], compete: true, board });

  assert.equal(root.querySelector(".mw-lb-season").textContent, "SEASON OF THE ALPHA");
});

// ═══ (H) SOURCE pins: the createLeaderboardPanel block and boardFetchFn ═════

test("(H1) SOURCE: the createLeaderboardPanel block carries history, board, competeOn and season seams, and none of the retired Play Games seams", () => {
  const panel = sliceBetween(CODE, "const boardsPanel = createLeaderboardPanel({", "\n  });");
  assert.match(panel, /history: \(\) => getRunHistory\(\)/);
  assert.match(panel, /board: boardFeed/);
  assert.match(panel, /competeOn: competeIsOn/);
  assert.match(panel, /season: SEASON/);
  for (const retired of [/\bidentity:/, /\bglobal:/, /\bseasons:/, /\bonFriendsConsent:/, /\bhero:/, /\bonOpen:/]) {
    assert.doesNotMatch(panel, retired, `expected no retired Play Games seam matching ${retired}`);
  }
});

test("(H2) SOURCE (T-84-11): boardFetchFn selects the live fetch only on a native platform, else the seeded dev-loop fake", () => {
  const region = sliceBetween(CODE, "function boardFetchFn()", "\n  }");
  assert.match(region, /window\.Capacitor\?\.isNativePlatform\?\.\(\)/);
  assert.match(region, /globalThis\.fetch\.bind\(globalThis\)/);
  assert.match(region, /createFakeBoardFetch\(\{ runs: devBoardRuns\(\) \}\)\.fetchFn/);
});

test("(F3) SOURCE (BOARD-08): the comment-stripped shell makes zero network calls", () => {
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(CODE, bad);
  }
});
