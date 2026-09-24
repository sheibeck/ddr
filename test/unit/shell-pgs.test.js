// test/unit/shell-pgs.test.js
//
// Phase 68 (PGS-03..05, PLACE-01/02; D-01..D-07, D-10..D-12), Plan 07 —
// pins the shell's Phase 68 wiring in mazeworld.html: the THAT IS THAT rank
// line (the classic renderRankLine, its CSS and the __mzPlacement bridge),
// and the module's submission queue, death listener, flush triggers,
// placement routing, rail-card parking, season-drop Oracle line and the
// Leaderboards panel's global seams. mazeworld.html has no ESM surface a
// test could import, so this uses the comment-stripping and
// region-extraction technique of test/unit/shell-new-best.test.js and
// test/unit/shell-account.test.js: SOURCE pins over the comment-stripped
// text, and BEHAVIOUR tests that evaluate the exact shipped source of a
// region with recording fakes threaded in.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BRIDGE } from "../../src/browser/bridge.js";
import { placementLine, deferredPlacementCard, seasonDropLine } from "../../src/browser/placement.js";

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

// A per-function slice of the classic script, from an exact signature to
// the NEXT zero-indent "\nfunction " after it.
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

// ─── a recording DOM for renderRankLine ─────────────────────────────────────

function makeElement(tag) {
  const el = {
    tagName: tag,
    className: "",
    id: "",
    textContent: "",
    attrs: {},
    parent: null,
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
    },
    remove() {
      if (!this.parent) return;
      const i = this.parent.children.indexOf(this);
      if (i !== -1) this.parent.children.splice(i, 1);
      this.parent = null;
    },
  };
  return el;
}

function makeHost() {
  return {
    children: [],
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, ref) {
      child.parent = this;
      const i = this.children.indexOf(ref);
      if (i === -1) this.children.push(child);
      else this.children.splice(i, 0, child);
      return child;
    },
    querySelector(sel) {
      if (sel.startsWith("#")) return this.children.find((c) => c.id === sel.slice(1)) || null;
      if (sel.startsWith(".")) return this.children.find((c) => String(c.className).split(" ").includes(sel.slice(1))) || null;
      return null;
    },
  };
}

function loadRenderRankLine(win = {}) {
  const src = fnRegion("function renderRankLine(host, placement)");
  const created = [];
  const doc = {
    createElement(tag) {
      const el = makeElement(tag);
      created.push(el);
      return el;
    },
  };
  const fn = new Function("document", "window", src + "\nreturn renderRankLine;")(doc, win);
  return { renderRankLine: fn, win, created };
}

const ranks = (host) => host.children.filter((c) => c.id === "cb-over-rank");

// ═══════════════════════ (R) the THAT IS THAT rank line (D-10/D-11) ════════

test("(R1) BEHAVIOUR: a fresh placement adds one p#cb-over-rank before .cb-over-actions, marked data-fresh, and the bridge turns not fresh", () => {
  const win = {};
  const { renderRankLine } = loadRenderRankLine(win);
  const host = makeHost();
  const line = makeElement("div");
  line.className = "cb-over-line";
  host.appendChild(line);
  const actions = makeElement("div");
  actions.className = "cb-over-actions";
  host.appendChild(actions);
  const placement = { hash: "h1", line: "You placed 3,117th of 9,044.", fresh: true };
  win.__mzPlacement = placement;
  renderRankLine(host, placement);
  const rows = ranks(host);
  assert.equal(rows.length, 1);
  const p = rows[0];
  assert.equal(p.tagName, "p");
  assert.equal(p.className, "cb-over-rank");
  assert.equal(p.textContent, "You placed 3,117th of 9,044.");
  assert.equal(p.getAttribute("data-fresh"), "1");
  assert.equal(host.children.indexOf(p), 1, "inserted before .cb-over-actions");
  assert.deepEqual({ ...win.__mzPlacement }, { hash: "h1", line: "You placed 3,117th of 9,044.", fresh: false });
});

test("(R2) BEHAVIOUR: without .cb-over-actions the line is appended", () => {
  const { renderRankLine } = loadRenderRankLine({});
  const host = makeHost();
  host.appendChild(makeElement("div"));
  renderRankLine(host, { hash: "h1", line: "L", fresh: true });
  assert.equal(host.children.length, 2);
  assert.equal(host.children[1].id, "cb-over-rank");
});

test("(R3) BEHAVIOUR: a second call with the not-fresh placement replaces the element (still one) without data-fresh", () => {
  const win = {};
  const { renderRankLine } = loadRenderRankLine(win);
  const host = makeHost();
  win.__mzPlacement = { hash: "h1", line: "L", fresh: true };
  renderRankLine(host, win.__mzPlacement);
  const first = ranks(host)[0];
  renderRankLine(host, win.__mzPlacement);
  const rows = ranks(host);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0], first, "the element is replaced");
  assert.equal(rows[0].getAttribute("data-fresh"), null);
  assert.equal(rows[0].textContent, "L");
});

test("(R4) BEHAVIOUR: a null placement, a non-string line or an empty line removes any rank line and adds nothing; a null host is a no-op", () => {
  const { renderRankLine, created } = loadRenderRankLine({});
  for (const bad of [null, undefined, {}, { line: 42 }, { line: "" }, "text"]) {
    const host = makeHost();
    renderRankLine(host, { hash: "h1", line: "L", fresh: false });
    assert.equal(ranks(host).length, 1);
    renderRankLine(host, bad);
    assert.equal(ranks(host).length, 0, `removed for ${JSON.stringify(bad)}`);
    assert.equal(host.children.length, 0);
  }
  const before = created.length;
  assert.doesNotThrow(() => renderRankLine(null, { line: "L", fresh: true }));
  assert.equal(created.length, before, "nothing built for a null host");
});

test("(R5) SOURCE: renderCombatOver calls renderRankLine(over, window.__mzPlacement) on the line directly after the renderNewBestBlock call", () => {
  const region = fnRegion("function renderCombatOver(host, kind, opts = {})");
  const lines = region.split("\n").map((l) => l.trim()).filter(Boolean);
  const i = lines.indexOf('if (kind === "dead") renderNewBestBlock(over, window.__mzDeathRecord);');
  assert.ok(i !== -1, "the renderNewBestBlock call site is still there");
  assert.equal(lines[i + 1], 'if (kind === "dead") renderRankLine(over, window.__mzPlacement);');
  assert.equal(occurrences(HTML, "renderRankLine(over, window.__mzPlacement);"), 1);
  assert.equal(occurrences(HTML, "function renderRankLine"), 1);
});

test("(R6) SOURCE: renderRankLine builds DOM with createElement/textContent only (no innerHTML)", () => {
  const region = fnRegion("function renderRankLine(host, placement)");
  assert.doesNotMatch(region, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.match(region, /document\.createElement\("p"\)/);
  assert.match(region, /\.textContent = /);
});

test("(R7) CSS: .cb-over-rank has a rule; [data-fresh=\"1\"] animates with mwrankin, defined once; the blanket reduced-motion rule is intact", () => {
  const rule = CODE.match(/\.cb-over-rank\{([^}]*)\}/);
  assert.ok(rule, ".cb-over-rank rule");
  assert.match(rule[1], /#e8c97a/);
  assert.match(rule[1], /var\(--mono\)/);
  const fresh = CODE.match(/\.cb-over-rank\[data-fresh="1"\]\{([^}]*)\}/);
  assert.ok(fresh, "fresh rule");
  assert.match(fresh[1], /animation:\s*mwrankin 600ms ease-out/);
  assert.equal(occurrences(CODE, "@keyframes mwrankin"), 1);
  assert.match(CODE, /@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}\}/);
  assert.equal(occurrences(CODE, "prefers-reduced-motion:reduce"), 1, "no second reduced-motion rule");
});

test("(R8) SOURCE: the module resets window.__mzPlacement to null in the bridge init and in showTitleScreen", () => {
  const init = sliceBetween(MODULE, "window.__mzDeathRecord = null;", "window.mzRailLine = ");
  assert.match(init, /window\.__mzPlacement = null;/);
  const title = sliceBetween(MODULE, "function showTitleScreen({ allowResume } = {}) {", "screen.hidden = false;");
  assert.match(title, /window\.__mzPlacement = null;/);
});

test("(R9) REGISTRY: __mzPlacement is registered as a module-owned presentation bridge naming its consumers", () => {
  const entry = BRIDGE.__mzPlacement;
  assert.ok(entry, "registered");
  assert.equal(entry.owner, "mazeworld.html (module)");
  const consumers = entry.consumers.join(" ");
  assert.match(consumers, /renderCombatOver/);
  assert.match(consumers, /renderRankLine/);
  assert.match(consumers, /handlePgsFlush/);
  assert.match(consumers, /showTitleScreen/);
  assert.match(entry.purpose, /never a field on state/);
});

test("(R10) no S.placement field is ever assigned in the shell", () => {
  assert.doesNotMatch(CODE, /\bS\.(placement|rank|pgs\w*)\b/);
});

// ═══════════════════════ Task 2: the module wiring ══════════════════════════

// The plugin's npm package name, built from two halves so no other scan of
// this file ever counts it (67 D-12: only playGames.js may name it).
const PLUGIN_PACKAGE = "@modbender/" + "capacitor-play-games";

// ─── fakes ─────────────────────────────────────────────────────────────────

function recordingQueue() {
  const calls = [];
  return {
    calls,
    enqueue: (s) => {
      calls.push(["enqueue", s]);
      return Promise.resolve(true);
    },
    flush: (o) => {
      calls.push(["flush", o === undefined ? null : o]);
      return Promise.resolve();
    },
    purge: () => {
      calls.push(["purge"]);
      return Promise.resolve();
    },
    waitForPending: () => Promise.resolve(),
  };
}

function recordingBoards() {
  const calls = [];
  return {
    calls,
    view: (q) => {
      calls.push(["view", q]);
      return { status: "loading" };
    },
    requestFriendsAccess: () => {
      calls.push(["consent"]);
      return Promise.resolve("granted");
    },
    clear: () => calls.push(["clear"]),
  };
}

/**
 * pgsFns(opts) — the shipped onRunRecorded / handlePgsFlush /
 * notePgsSeasonDrop / onAccountForPgs over recording fakes. liveDeathHash is
 * the module-level let those functions read and write.
 */
function pgsFns({ dead = true, cbOver = true } = {}) {
  const region = sliceBetween(MODULE, "let pgsLastStatus = null;", "\n  window.__mzControls = {");
  const queue = recordingQueue();
  const boards = recordingBoards();
  const rendered = [];
  const cards = [];
  const oracle = [];
  const over = { id: "cb-over" };
  const win = {
    __mzPlacement: "stale",
    __mzState: { get: () => ({ dead }) },
    logLine: (html) => oracle.push(html),
  };
  const doc = { getElementById: (id) => (id === "cb-over" && cbOver ? over : null) };
  const renderRankLine = (host, placement) => rendered.push([host, placement]);
  const parkPgsCard = (card) => cards.push(card);
  const make = new Function(
    "window",
    "document",
    "pgsQueue",
    "globalBoards",
    "placementLine",
    "deferredPlacementCard",
    "seasonDropLine",
    "renderRankLine",
    "parkPgsCard",
    "let liveDeathHash = null;\n" +
      region +
      "\nreturn { onRunRecorded, handlePgsFlush, notePgsSeasonDrop, onAccountForPgs, live: () => liveDeathHash, setLive: (h) => { liveDeathHash = h; } };",
  );
  const fns = make(win, doc, queue, boards, placementLine, deferredPlacementCard, seasonDropLine, renderRankLine, parkPgsCard);
  return { ...fns, win, queue, boards, rendered, cards, oracle, over };
}

/** cardParking(opts) — the shipped dungeonVisible/parkAccountCard/flushAccountCard/parkPgsCard with a fake timer. */
function cardParking({ title = false, dead = false } = {}) {
  const region = sliceBetween(CODE, "let pendingAccountCard = null;", "\n  account = createAccountController({");
  const nodes = {
    "mw-title-screen": { hidden: !title },
    "mw-roller-screen": { hidden: true },
  };
  const doc = { nodes, body: { dataset: {} }, getElementById: (id) => nodes[id] || null };
  const rail = [];
  const timers = [];
  const state = { dead };
  const win = { mzRailLine: (...args) => rail.push(args), __mzState: { get: () => state } };
  const setTimeoutFake = (fn, ms) => {
    timers.push({ fn, ms });
    return timers.length;
  };
  const make = new Function(
    "document",
    "window",
    "setTimeout",
    "let pendingPgsCard = null;\n" + region + "\nreturn { dungeonVisible, parkAccountCard, flushAccountCard, parkPgsCard };",
  );
  return { ...make(doc, win, setTimeoutFake), rail, timers, doc, state };
}

const ACCOUNT_CARD = Object.freeze({ title: "ON THE PUBLIC RECORD", line: "welcome line", tone: "good", hold: 9000 });
const PGS_CARD = Object.freeze({ title: "THE LEDGER CAUGHT UP", line: "placed line", tone: "good", hold: 12000 });
const asArgs = (c) => [c.title, c.line, c.tone, c.hold];

// ═══════════════════════ (S) source pins ═══════════════════════════════════

test("(S1) SOURCE: one import line each for the Phase 68 modules; the pinned engineAdapter line is byte-identical", () => {
  for (const line of [
    'import { setRunRecordedListener } from "./src/browser/engineAdapter.js";',
    'import { createSubmissionQueue } from "./src/browser/pgsQueue.js";',
    'import { createGlobalBoards } from "./src/browser/globalBoards.js";',
    'import { placementLine, deferredPlacementCard, seasonDropLine } from "./src/browser/placement.js";',
    'import { leaderboardIdsFor, knownSeasons, scoreOrdersFor } from "./src/browser/boardScores.js";',
    'import { SEASON } from "./content/season.js";',
  ]) {
    assert.equal(occurrences(HTML, line), 1, line);
  }
  assert.equal(occurrences(HTML, 'import { boot, dispatch, startNewRun, waitForPending, takeBootWornReport } from "./src/browser/engineAdapter.js";'), 1);
});

test("(S2) SOURCE: the four Phase 68 lets are declared before the Leaderboards panel instance, which gets the global, seasons and onFriendsConsent seams", () => {
  const panelAt = MODULE.indexOf("const boardsPanel = createBoardsPanel({");
  assert.ok(panelAt !== -1);
  for (const decl of ["let globalBoards = null;", "let pgsQueue = null;", "let liveDeathHash = null;", "let pendingPgsCard = null;"]) {
    const at = MODULE.indexOf(decl);
    assert.ok(at !== -1 && at < panelAt, `${decl} before the panel instance`);
    assert.equal(occurrences(MODULE, decl), 1, decl);
  }
  const panel = sliceBetween(MODULE, "const boardsPanel = createBoardsPanel({", "\n  });");
  assert.match(panel, /global: \(q\) => \(globalBoards \? globalBoards\.view\(q\) : null\),/);
  assert.match(panel, /seasons: \(\) => \(\{ current: SEASON, all: knownSeasons\(\) \}\),/);
  assert.match(panel, /onFriendsConsent: \(\) => /);
  assert.equal(occurrences(HTML, "onFriendsConsent:"), 1);
});

test("(S3) SOURCE: the queue gets window.mzStorage, the IDs map and the SEASON; the death listener, online and visibility triggers are wired", () => {
  assert.equal(occurrences(HTML, "createSubmissionQueue({"), 1);
  assert.equal(occurrences(HTML, "createGlobalBoards({"), 1);
  const q = sliceBetween(MODULE, "pgsQueue = createSubmissionQueue({", "\n  });");
  assert.match(q, /storage: window\.mzStorage,/);
  assert.match(q, /provider: pgsProvider,/);
  assert.match(q, /ids: pgsIds,/);
  assert.match(q, /season: SEASON,/);
  assert.match(q, /isCompeting: \(\) => account\.state\(\)\.compete === true,/);
  assert.match(q, /isSignedIn: \(\) => account\.identity\(\)\.signedIn === true,/);
  assert.match(q, /onFlushed: handlePgsFlush,/);
  assert.match(q, /onSeasonDrop: notePgsSeasonDrop,/);
  const g = sliceBetween(MODULE, "globalBoards = createGlobalBoards({", "\n  });");
  assert.match(g, /provider: pgsProvider,/);
  assert.match(g, /ids: pgsIds,/);
  assert.match(g, /isActive: \(\) => account\.identity\(\)\.signedIn === true,/);
  assert.match(g, /onChange: \(\) => boardsPanel\.refresh\(\),/);
  assert.equal(occurrences(HTML, "setRunRecordedListener(onRunRecorded)"), 1);
  assert.match(MODULE, /account\.subscribe\(onAccountForPgs\);/);
  assert.match(MODULE, /pgsQueue\.load\(\);/);
  assert.match(MODULE, /window\.addEventListener\("online", \(\) => pgsQueue\?\.flush\(\{ force: true \}\)\);/);
  const vis = sliceBetween(MODULE, 'document.addEventListener("visibilitychange", () => {', "\n  });");
  assert.match(vis, /document\.visibilityState === "visible"/);
  assert.match(vis, /pgsQueue\?\.flush\(\)/);
  // The queue and the listener come after the account controller exists and before the launch sign-in.
  const ctl = MODULE.indexOf("account = createAccountController({");
  const created = MODULE.indexOf("pgsQueue = createSubmissionQueue({");
  const bootAt = MODULE.indexOf("account.boot().catch(");
  assert.ok(ctl < created && created < bootAt);
});

test("(S4) SOURCE: the IDs map is built once and the browser fake gets the real score orders", () => {
  assert.equal(occurrences(MODULE, "leaderboardIdsFor("), 1);
  assert.match(MODULE, /const pgsIds = leaderboardIdsFor\(\{ native: pgsNative \}\);/);
  assert.match(
    MODULE,
    /const pgsProvider = pgsNative \? createPlayGames\(\) : createFakePlayGames\(\{ signedIn: currentSettings\?\.pgsDevSignedIn === true, orders: scoreOrdersFor\(pgsIds\) \}\);/,
  );
  assert.ok(MODULE.indexOf("const pgsIds =") < MODULE.indexOf("const pgsProvider ="));
});

test("(S5) SOURCE: the background flush awaits the adapter's and the queue's pending writes", () => {
  const chrome = sliceBetween(MODULE, "registerNativeChrome({", "getGameContext:");
  assert.match(chrome, /waitForPending: \(\) => Promise\.all\(\[waitForPending\(\), pgsQueue\?\.waitForPending\(\)\]\),/);
});

test("(S6) SOURCE: the plugin package is never named and the shell opens no network channel of its own", () => {
  assert.equal(occurrences(HTML, PLUGIN_PACKAGE), 0);
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(CODE, bad);
  }
});

test("(S7) SOURCE: flushAccountCard delivers the account card before the placement card", () => {
  const region = sliceBetween(MODULE, "function flushAccountCard() {", "\n  function parkPgsCard(");
  assert.ok(region.indexOf("pendingAccountCard") < region.indexOf("pendingPgsCard"));
  assert.match(region, /setTimeout\(/);
});

// ═══════════════════════ (D) the death listener and the flush result ═══════

test("(D1) BEHAVIOUR: onRunRecorded records the live hash, clears the placement and enqueues the summary once", () => {
  const f = pgsFns();
  const summary = { hash: "h1", season: 1 };
  f.onRunRecorded(summary);
  assert.equal(f.live(), "h1");
  assert.equal(f.win.__mzPlacement, null);
  assert.deepEqual(f.queue.calls, [["enqueue", summary]]);
});

test("(D2) BEHAVIOUR: a flush with no standing shows nothing and parks nothing", () => {
  const f = pgsFns();
  f.setLive("h1");
  f.win.__mzPlacement = null;
  f.handlePgsFlush({ submitted: [{ hash: "h1", newBest: true }], standing: null });
  f.handlePgsFlush({ submitted: [], standing: { rank: 3, total: 9 } });
  f.handlePgsFlush(null);
  assert.equal(f.win.__mzPlacement, null);
  assert.deepEqual(f.rendered, []);
  assert.deepEqual(f.cards, []);
});

test("(D3) BEHAVIOUR: the live death with its panel up gets the rank line, drawn once, and no card", () => {
  const f = pgsFns({ dead: true });
  f.setLive("h1");
  f.handlePgsFlush({ submitted: [{ hash: "h1", newBest: true }], standing: { rank: 3117, total: 9044 } });
  const line = placementLine({ rank: 3117, total: 9044, newBest: true, hash: "h1" });
  assert.ok(line);
  assert.deepEqual(f.win.__mzPlacement, { hash: "h1", line, fresh: true });
  assert.equal(f.rendered.length, 1);
  assert.equal(f.rendered[0][0], f.over);
  assert.deepEqual(f.cards, []);
});

test("(D4) BEHAVIOUR: a missing #cb-over still sets the placement for the next panel draw", () => {
  const f = pgsFns({ dead: true, cbOver: false });
  f.setLive("h1");
  f.handlePgsFlush({ submitted: [{ hash: "h1", newBest: true }], standing: { rank: 5, total: 50 } });
  assert.equal(f.win.__mzPlacement.fresh, true);
  assert.equal(f.rendered[0][0], null);
});

test("(D5) BEHAVIOUR: the same flush once the panel is gone parks one card (count 1) and sets no placement", () => {
  const f = pgsFns({ dead: false });
  f.setLive("h1");
  f.win.__mzPlacement = null;
  f.handlePgsFlush({ submitted: [{ hash: "h1", newBest: true }], standing: { rank: 3117, total: 9044 } });
  assert.equal(f.win.__mzPlacement, null);
  assert.deepEqual(f.rendered, []);
  assert.equal(f.cards.length, 1);
  assert.deepEqual(f.cards[0], deferredPlacementCard({ count: 1, rank: 3117, total: 9044, newBest: true, hash: "h1" }));
});

test("(D6) BEHAVIOUR: the live run plus two older runs: the rank line for the live one (standing band when not a new best) and one card with count 2", () => {
  const f = pgsFns({ dead: true });
  f.setLive("h1");
  f.handlePgsFlush({
    submitted: [
      { hash: "h0", newBest: false },
      { hash: "h1", newBest: false },
      { hash: "h2", newBest: true },
    ],
    standing: { rank: 412, total: 9044 },
  });
  const standingLine = placementLine({ rank: 412, total: 9044, newBest: false, hash: "h1" });
  assert.deepEqual(f.win.__mzPlacement, { hash: "h1", line: standingLine, fresh: true });
  assert.equal(f.cards.length, 1);
  assert.deepEqual(f.cards[0], deferredPlacementCard({ count: 2, rank: 412, total: 9044, newBest: true, hash: "h2" }));
});

test("(D7) BEHAVIOUR: queued runs only (no live death) fold into one card; all-false newBest gives the standing variant", () => {
  const f = pgsFns({ dead: false });
  f.handlePgsFlush({
    submitted: [
      { hash: "h0", newBest: false },
      { hash: "h2", newBest: false },
    ],
    standing: { rank: 12, total: 400 },
  });
  assert.deepEqual(f.cards, [deferredPlacementCard({ count: 2, rank: 12, total: 400, newBest: false, hash: "h2" })]);
  assert.equal(f.win.__mzPlacement, "stale", "untouched");
});

test("(D8) BEHAVIOUR: an incomplete standing never throws, draws nothing and parks nothing", () => {
  const f = pgsFns({ dead: true });
  f.setLive("h1");
  f.win.__mzPlacement = null;
  assert.doesNotThrow(() => f.handlePgsFlush({ submitted: [{ hash: "h1", newBest: true }, { hash: "h0" }], standing: { rank: 0, total: 0 } }));
  assert.equal(f.win.__mzPlacement, null);
  assert.deepEqual(f.rendered, []);
  assert.deepEqual(f.cards, []);
});

// ═══════════════════════ (O) the season-drop Oracle line (D-03) ════════════

test("(O1) BEHAVIOUR: notePgsSeasonDrop(2) writes the seasonDropLine(2) text once, inside a beat span", () => {
  const f = pgsFns();
  f.notePgsSeasonDrop(2);
  assert.deepEqual(f.oracle, [`<span class="beat">${seasonDropLine(2)}</span>`]);
});

test("(O2) BEHAVIOUR: notePgsSeasonDrop(0) and bad counts write nothing", () => {
  const f = pgsFns();
  f.notePgsSeasonDrop(0);
  f.notePgsSeasonDrop(undefined);
  f.notePgsSeasonDrop("3");
  assert.deepEqual(f.oracle, []);
});

// ═══════════════════════ (A) account transitions (D-02, D-04) ══════════════

test("(A1) BEHAVIOUR: Compete OFF purges the queue, clears the global cache and resets the placement, once", () => {
  const f = pgsFns();
  f.win.__mzPlacement = { hash: "h1", line: "L", fresh: false };
  f.onAccountForPgs({ compete: false, status: "off" });
  assert.deepEqual(f.queue.calls, [["purge"]]);
  assert.deepEqual(f.boards.calls, [["clear"]]);
  assert.equal(f.win.__mzPlacement, null);
  f.onAccountForPgs({ compete: false, status: "off" });
  assert.deepEqual(f.queue.calls, [["purge"]], "not purged again while still off");
  assert.deepEqual(f.boards.calls, [["clear"]]);
});

test("(A2) BEHAVIOUR: becoming signed in forces one flush; a repeated signed-in state does not flush again", () => {
  const f = pgsFns();
  f.onAccountForPgs({ compete: true, status: "pending" });
  f.onAccountForPgs({ compete: true, status: "signedIn" });
  f.onAccountForPgs({ compete: true, status: "signedIn" });
  assert.deepEqual(f.queue.calls, [["flush", { force: true }]]);
  assert.deepEqual(f.boards.calls, []);
});

test("(A3) BEHAVIOUR: leaving signed in clears the global cache; signing back in flushes again", () => {
  const f = pgsFns();
  f.onAccountForPgs({ compete: true, status: "signedIn" });
  f.onAccountForPgs({ compete: true, status: "signedOut" });
  assert.deepEqual(f.boards.calls, [["clear"]]);
  f.onAccountForPgs({ compete: true, status: "pending" });
  f.onAccountForPgs({ compete: true, status: "signedIn" });
  assert.deepEqual(f.queue.calls, [["flush", { force: true }], ["flush", { force: true }]]);
});

test("(A4) BEHAVIOUR: Compete back ON after OFF does not purge; turning it OFF again purges again", () => {
  const f = pgsFns();
  f.onAccountForPgs({ compete: false, status: "off" });
  f.onAccountForPgs({ compete: true, status: "pending" });
  f.onAccountForPgs({ compete: false, status: "off" });
  assert.deepEqual(
    f.queue.calls.filter((c) => c[0] === "purge"),
    [["purge"], ["purge"]],
  );
});

test("(A5) BEHAVIOUR: a pending boot state with Compete ON never purges (the queue survives launch)", () => {
  const f = pgsFns();
  f.onAccountForPgs({ compete: true, status: "pending" });
  f.onAccountForPgs({ compete: true, status: "signedOut" });
  assert.deepEqual(f.queue.calls, []);
});

// ═══════════════════════ (C) card parking (D-12) ═══════════════════════════

test("(C1) BEHAVIOUR: with the dungeon visible, parkPgsCard delivers the card through mzRailLine once", () => {
  const p = cardParking();
  p.parkPgsCard(PGS_CARD);
  assert.deepEqual(p.rail, [asArgs(PGS_CARD)]);
  p.flushAccountCard();
  assert.equal(p.rail.length, 1, "delivered once");
});

test("(C2) BEHAVIOUR: a null card is ignored", () => {
  const p = cardParking();
  p.parkPgsCard(null);
  assert.deepEqual(p.rail, []);
});

test("(C3) BEHAVIOUR: with an account card parked too, the account card goes first and the placement card follows by timer after its hold", () => {
  const p = cardParking({ title: true });
  p.parkAccountCard(ACCOUNT_CARD);
  p.parkPgsCard(PGS_CARD);
  assert.deepEqual(p.rail, []);
  p.doc.nodes["mw-title-screen"].hidden = true;
  p.flushAccountCard();
  assert.deepEqual(p.rail, [asArgs(ACCOUNT_CARD)]);
  assert.equal(p.timers.length, 1);
  assert.equal(p.timers[0].ms, ACCOUNT_CARD.hold + 600);
  p.flushAccountCard();
  assert.deepEqual(p.rail, [asArgs(ACCOUNT_CARD)], "never on top of the account card while its timer runs");
  p.timers[0].fn();
  assert.deepEqual(p.rail, [asArgs(ACCOUNT_CARD), asArgs(PGS_CARD)]);
  assert.equal(p.timers.length, 1, "no second timer");
});

test("(C4) BEHAVIOUR: with the title up nothing is delivered until flushAccountCard runs with the dungeon visible; the latest card wins", () => {
  const p = cardParking({ title: true });
  p.parkPgsCard(PGS_CARD);
  const later = Object.freeze({ ...PGS_CARD, line: "later line" });
  p.parkPgsCard(later);
  assert.deepEqual(p.rail, []);
  p.doc.nodes["mw-title-screen"].hidden = true;
  p.flushAccountCard();
  assert.deepEqual(p.rail, [asArgs(later)]);
});

test("(C5) BEHAVIOUR: the placement card waits while the party is dead (the rail is hidden then) and lands on the next map", () => {
  const p = cardParking({ dead: true });
  p.parkPgsCard(PGS_CARD);
  assert.deepEqual(p.rail, []);
  p.state.dead = false;
  p.flushAccountCard();
  assert.deepEqual(p.rail, [asArgs(PGS_CARD)]);
});

test("(C6) BEHAVIOUR: an account card alone still goes straight to the rail (Phase 67 unchanged)", () => {
  const p = cardParking();
  p.parkAccountCard(ACCOUNT_CARD);
  assert.deepEqual(p.rail, [asArgs(ACCOUNT_CARD)]);
  assert.equal(p.timers.length, 0);
});

// ═══════════════════════ (P) the panel's global seams (D-05..D-08) ═════════

function panelSeams(boards) {
  const panel = sliceBetween(MODULE, "const boardsPanel = createBoardsPanel({", "\n  });") + "\n";
  const seams = ["global", "seasons", "onFriendsConsent"].map((k) => {
    const m = panel.match(new RegExp(`\\n\\s*${k}: ([^\\n]*?),\\n`));
    assert.ok(m, `${k} seam`);
    return `${k}: ${m[1]}`;
  });
  return new Function("globalBoards", "SEASON", "knownSeasons", `return { ${seams.join(", ")} };`)(boards, 3, () => [1, 2, 3]);
}

test("(P1) BEHAVIOUR: the global seam returns null before the controller exists and forwards the query otherwise", () => {
  assert.equal(panelSeams(null).global({ board: "deep", scope: "all", season: 1 }), null);
  const boards = recordingBoards();
  const q = { board: "deep", scope: "all", season: 1 };
  assert.deepEqual(panelSeams(boards).global(q), { status: "loading" });
  assert.deepEqual(boards.calls, [["view", q]]);
});

test("(P2) BEHAVIOUR: seasons reports the current SEASON and the known seasons; onFriendsConsent requests access", () => {
  const boards = recordingBoards();
  const s = panelSeams(boards);
  assert.deepEqual(s.seasons(), { current: 3, all: [1, 2, 3] });
  s.onFriendsConsent();
  assert.deepEqual(boards.calls, [["consent"]]);
  assert.doesNotThrow(() => panelSeams(null).onFriendsConsent());
});
