// test/unit/shell-boards-panel.test.js
//
// Phase 66 (BOARD-01..08, D-13/D-14/D-15/D-16), Plan 06 — wires the REAL
// Leaderboards panel (src/browser/boardsPanel.js + boardsView.js) into the
// shell sandbox and pins the DEAD tab end to end: sandbox rendering/
// interaction behaviour through window.__mzShowTab("dead"), routeFromBoards'
// dock/back routing (extracted from the module script and evaluated with a
// fake window/showTitleScreen/surfaceWornReconcile), the deletion of the
// classic graveyard screen/renderers/bridge, and the zero-network pin
// (BOARD-08). Uses the comment-stripping and region-extraction helpers from
// test/unit/shell-combat-over.test.js (mazeworld.html has no ESM surface a
// test could import directly), and builds fixture runs with
// engine/records.js the same way test/unit/boardsView.test.js does.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { emptyBests, updateBests, runHash } from "../../engine/records.js";

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

// ─── fixtures (the same shape test/unit/boardsView.test.js's makeSummary
// builds) ───────────────────────────────────────────────────────────────
function makeSummary(overrides = {}) {
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
    ...overrides,
  };
  return { ...base, hash: runHash(base) };
}

/** twelveRuns() — 12 distinctly-floored summaries, so DEEPEST's top-ten cap is exercised. */
function twelveRuns() {
  const runs = [];
  for (let i = 0; i < 12; i++) {
    runs.push(
      makeSummary({
        name: `Runner ${i}`,
        floor: 20 - i,
        steps: 200 + i,
        day: 5 + i,
        kills: i,
        gold: 1000 - i * 10,
        level: (i % 5) + 1,
      }),
    );
  }
  return runs;
}

function bestsFromRuns(runs) {
  let record = emptyBests();
  for (const run of runs) record = updateBests(record, run).record;
  return record;
}

/** openDeadTab(boardsData) — a fresh sandbox with the real panel wired over `boardsData`, already on the DEAD tab. */
function openDeadTab(boardsData) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, boards: boardsData });
  sandbox.context.window.__mzShowTab("dead");
  const screenDead = doc.elementsById.get("screen-dead");
  return { doc, sandbox, screenDead, root: screenDead.querySelector(".mw-bd") };
}

// ═══════════════════════ (A) sandbox: the DEAD tab entry ═══════════════════

test("(A1) BEHAVIOUR: __mzShowTab(\"dead\") leaves #screen-dead holding exactly one .mw-bd root, tab-entered, INTERRED reading the lifetime total", () => {
  const runs = twelveRuns();
  const { screenDead, root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  assert.equal(screenDead.querySelectorAll(".mw-bd").length, 1);
  assert.ok(root, "expected a .mw-bd root");
  assert.equal(root.dataset.entry, "tab");
  assert.equal(root.querySelector(".mw-bd-interred-n").textContent, "37");
});

test("(A2) BEHAVIOUR: the rail carries all seven chips, and DEEPEST is the default active chip", () => {
  const runs = twelveRuns();
  const { root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  const chips = root.querySelectorAll(".mw-bd-chip");
  assert.equal(chips.length, 7);
  const active = chips.filter((c) => c.dataset.on === "1");
  assert.equal(active.length, 1);
  assert.equal(active[0].dataset.board, "deep");
});

test("(A3) BEHAVIOUR: DEEPEST lists exactly ten rows (bests.boards.deep's top-ten cap over 12 folded runs)", () => {
  const runs = twelveRuns();
  const { root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  assert.equal(root.querySelectorAll(".mw-bd-row").length, 10);
});

test("(A4) BEHAVIOUR: a tab-opened panel has no chevron and a hidden dock", () => {
  const runs = twelveRuns();
  const { root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  assert.equal(root.querySelectorAll(".mw-bd-back").length, 0);
  assert.equal(root.querySelector(".mw-bd-dock").hidden, true);
});

test("(A5) BEHAVIOUR: a tab-opened panel never sets body[data-boards-entry]", () => {
  const runs = twelveRuns();
  const { sandbox } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  assert.equal(sandbox.context.window.document.body.dataset.boardsEntry, undefined);
});

test("(A6) BEHAVIOUR: the in-game DEAD tab keeps the HUD and the condition strip (Phase 70 D-08); only the title-opened panel hides them, through the body marker", () => {
  const runs = twelveRuns();
  const { doc, sandbox } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  assert.notEqual(doc.elementsById.get("mw-hud")?.dataset?.offtab, "1");
  assert.notEqual(doc.elementsById.get("mm-conditions")?.dataset?.offtab, "1");
  // Tab mode sets no body marker (A5), so the title-mode hide rules below
  // never apply to the in-game tab. shell-boards-entry.test.js (D1) proves
  // openFromTitle sets the "title" marker these rules key on.
  assert.equal(sandbox.context.window.document.body.dataset.boardsEntry, undefined);
  const html = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
  assert.match(html, /^body\[data-boards-entry="title"\] #mw-hud\{display:none\}$/m);
  assert.match(html, /^body\[data-boards-entry="title"\] #mm-conditions\{display:none\}$/m);
});

// ═══════════════════════ (B) board memory (D-04) ════════════════════════════

test("(B1) BEHAVIOUR: tapping the LEANEST chip makes it active and stores \"lean\" under ddr.boards.last.v1", () => {
  const runs = twelveRuns();
  const { sandbox, screenDead, root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  const leanChip = root.querySelectorAll(".mw-bd-chip").find((c) => c.dataset.board === "lean");
  assert.ok(leanChip, "expected a LEANEST chip");
  leanChip.onclick();

  const after = screenDead.querySelector(".mw-bd");
  const active = after.querySelectorAll(".mw-bd-chip").filter((c) => c.dataset.on === "1");
  assert.equal(active.length, 1);
  assert.equal(active[0].dataset.board, "lean");
  assert.equal(sandbox.context.window.localStorage.getItem("ddr.boards.last.v1"), "lean");
});

test("(B2) BEHAVIOUR: the DEAD tab reopens on the last board viewed after a detour through the map", () => {
  const runs = twelveRuns();
  const { sandbox, screenDead, root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  root.querySelectorAll(".mw-bd-chip").find((c) => c.dataset.board === "lean").onclick();

  sandbox.context.window.__mzShowTab("maze");
  sandbox.context.window.__mzShowTab("dead");

  const reopened = screenDead.querySelector(".mw-bd");
  const active = reopened.querySelectorAll(".mw-bd-chip").filter((c) => c.dataset.on === "1");
  assert.equal(active.length, 1);
  assert.equal(active[0].dataset.board, "lean");
});

// ═══════════════════════ (C) row tap-expand (D-13) ══════════════════════════

test("(C1) BEHAVIOUR: tapping a row opens exactly one .mw-bd-detail carrying six .mw-bd-stat chips", () => {
  const runs = twelveRuns();
  const { screenDead, root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [], total: 12 });
  assert.equal(root.querySelectorAll(".mw-bd-detail").length, 0);

  root.querySelectorAll(".mw-bd-row")[0].onclick();

  const after = screenDead.querySelector(".mw-bd");
  const details = after.querySelectorAll(".mw-bd-detail");
  assert.equal(details.length, 1);
  assert.equal(details[0].querySelectorAll(".mw-bd-stat").length, 6);
});

test("(C2) BEHAVIOUR: opening a different row leaves exactly one .mw-bd-detail open (the previous row's detail closes)", () => {
  const runs = twelveRuns();
  const { screenDead, root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [], total: 12 });
  root.querySelectorAll(".mw-bd-row")[0].onclick();

  const afterFirst = screenDead.querySelector(".mw-bd");
  afterFirst.querySelectorAll(".mw-bd-row")[1].onclick();

  const afterSecond = screenDead.querySelector(".mw-bd");
  assert.equal(afterSecond.querySelectorAll(".mw-bd-detail").length, 1);
});

test("(C3) BEHAVIOUR: tapping the same (already-open) row again closes it — zero .mw-bd-detail remain", () => {
  const runs = twelveRuns();
  const { screenDead, root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [], total: 12 });
  root.querySelectorAll(".mw-bd-row")[0].onclick();
  let current = screenDead.querySelector(".mw-bd");
  current.querySelectorAll(".mw-bd-row")[1].onclick();
  current = screenDead.querySelector(".mw-bd");
  current.querySelectorAll(".mw-bd-row")[1].onclick();

  const finalRoot = screenDead.querySelector(".mw-bd");
  assert.equal(finalRoot.querySelectorAll(".mw-bd-detail").length, 0);
});

// ═══════════════════════ (D) empty state (D-12) ═════════════════════════════

test("(D1) BEHAVIOUR: empty data (null bests, no graves, total 0) shows INTERRED \"0\", a .mw-bd-empty line, and a NO ENTRY standing card", () => {
  const { root } = openDeadTab({ bests: null, graves: [], total: 0 });
  assert.equal(root.querySelector(".mw-bd-interred-n").textContent, "0");
  assert.equal(root.querySelectorAll(".mw-bd-empty").length, 1);
  assert.equal(root.querySelector(".mw-bd-standing-label").textContent, "NO ENTRY");
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

test("(F2) SOURCE: showTab's DEAD branch calls the boards bridge, refreshTitleDead reads getGraveyard(), and the module script carries the three Phase 66 import lines", () => {
  assert.match(CODE, /if \(name === "dead"\) window\.__mzBoards\?\.onDeadTab\?\.\(\);/);
  const refreshTitleDeadRegion = sliceBetween(CODE, "function refreshTitleDead()", "function showTitleScreen(");
  assert.match(refreshTitleDeadRegion, /getGraveyard\(\)/);
  assert.match(CODE, /import \{ getBests, getGraveyard \} from "\.\/src\/browser\/engineAdapter\.js";/);
  assert.match(CODE, /import \{ createBoardsPanel \} from "\.\/src\/browser\/boardsPanel\.js";/);
  assert.match(CODE, /import \{ boardsView \} from "\.\/src\/browser\/boardsView\.js";/);
});

// ═══════════════════════ (G) Phase 70 (D-11): the LINEAGE hero seam ═════════

test("(G1) SOURCE: the createBoardsPanel block carries exactly one hero seam, reading window.__mzState and the dead flag", () => {
  const panel = sliceBetween(CODE, "const boardsPanel = createBoardsPanel({", "\n  });");
  const seams = panel.split("\n").filter((line) => /^\s*hero:/.test(line));
  assert.equal(seams.length, 1, "exactly one hero seam");
  const [seam] = seams;
  assert.match(seam, /window\.__mzState\?\.get\?\.\(\)/);
  assert.match(seam, /!st\.dead/);
  assert.match(seam, /\{ race: st\.c\.race, sub: st\.c\.sub \}/);
  assert.match(seam, /: null; \},$/);
});

/** heroSeam(window) — the shipped `hero:` seam, extracted from the createBoardsPanel block and evaluated over a fake window. */
function heroSeam(fakeWindow) {
  const panel = sliceBetween(CODE, "const boardsPanel = createBoardsPanel({", "\n  });") + "\n";
  const m = panel.match(/\n\s*hero: ([^\n]*?),\n/);
  assert.ok(m, "hero seam");
  return new Function("window", `return (${m[1]});`)(fakeWindow);
}

test("(G2) BEHAVIOUR: the hero seam answers the living hero's { race, sub }, and null when S is absent, heroless or dead", () => {
  const withS = (S) => ({ __mzState: { get: () => S } });
  const hero = { race: "Troll", sub: "Acrobat", cls: "Thief", name: "Grub" };
  assert.deepStrictEqual(heroSeam(withS({ c: hero, dead: false }))(), { race: "Troll", sub: "Acrobat" });
  assert.deepStrictEqual(heroSeam(withS({ c: hero }))(), { race: "Troll", sub: "Acrobat" });
  assert.equal(heroSeam(withS({ c: hero, dead: true }))(), null);
  assert.equal(heroSeam(withS(null))(), null);
  assert.equal(heroSeam(withS({ dead: false }))(), null);
  assert.equal(heroSeam({})(), null, "no __mzState yet");
});

test("(G3) BEHAVIOUR: in the real DEAD tab, tapping LINEAGE shows the RACE / SUB-CLASS picker (the sandbox panel has no hero seam: the newest grave's lineage is on)", () => {
  const runs = twelveRuns().map((r, i) => makeSummary({ ...r, race: "Dwarven", sub: i % 2 ? "Knight" : "Soldier" }));
  const { root } = openDeadTab({ bests: bestsFromRuns(runs), graves: [...runs].reverse(), total: 37 });
  const section = root.querySelector(".mw-bd-lineage");
  assert.equal(section.hidden, true, "hidden off LINEAGE");
  root.querySelector(".mw-bd-rail").children.find((c) => c.dataset.board === "combo").onclick();
  assert.equal(section.hidden, false);
  assert.deepStrictEqual(section.children.map((r) => r.dataset.kind), ["race", "sub"]);
  const onId = (kind) =>
    section.children.find((r) => r.dataset.kind === kind).children[1].children.find((c) => c.dataset.on === "1").dataset.id;
  const newest = runs[runs.length - 1];
  assert.deepStrictEqual([onId("race"), onId("sub")], [newest.race, newest.sub]);
  const rows = root.querySelectorAll(".mw-bd-row");
  assert.equal(rows.length, 6, "the six runs of that lineage");
  // A SUB-CLASS chip tap re-lists the board.
  section.children[1].children[1].children.find((c) => c.dataset.id === (newest.sub === "Knight" ? "Soldier" : "Knight")).onclick();
  assert.equal(root.querySelectorAll(".mw-bd-row").length, 6);
  section.children[1].children[1].children.find((c) => c.dataset.id === "Acrobat").onclick();
  assert.equal(root.querySelectorAll(".mw-bd-row").length, 0);
  assert.equal(root.querySelector(".mw-bd-empty").textContent, "No Dwarven Acrobat of yours has died yet. The dungeon is patient.");
});

test("(F3) SOURCE (BOARD-08): the comment-stripped shell makes zero network calls", () => {
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(CODE, bad);
  }
});
