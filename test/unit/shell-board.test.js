// test/unit/shell-board.test.js
//
// Phase 85 (ACCT-04; 85-CONTEXT groups 1 and 3), Plan 04 — replaces the
// retired test/unit/shell-pgs.test.js. Pins the shell's board wiring in
// mazeworld.html: the THAT IS THAT rank line (the classic renderRankLine,
// its CSS and the __mzPlacement bridge — unchanged from Phase 68/84) plus
// the module's boardSync wiring (createBoardSync, the death listener, the
// online/visibility flush triggers, the boot backfill) and the rail-card
// parking (the account card, then the placement card). mazeworld.html has
// no ESM surface a test could import, so this uses the comment-stripping
// and region-extraction technique of test/unit/shell-new-best.test.js and
// test/unit/shell-account.test.js: SOURCE pins over the comment-stripped
// text, and BEHAVIOUR tests that evaluate the exact shipped source of a
// region with recording fakes threaded in.
//
// Deliberately imports nothing from src/browser/placement.js: 85-05
// rewrites that module for our own board and adds its own placement tests
// to this file (the death screen's "You placed X" line and the deferred
// rail card). This plan keeps renderRankLine, window.__mzPlacement and the
// card parking in place for it, unwired to any live rank data yet.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BRIDGE } from "../../src/browser/bridge.js";

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

// ═══════════════════════ (R) the THAT IS THAT rank line ════════════════════

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

test("(R9) REGISTRY: __mzPlacement is registered as a module-owned presentation bridge naming its consumers, including handlePlacement", () => {
  const entry = BRIDGE.__mzPlacement;
  assert.ok(entry, "registered");
  assert.equal(entry.owner, "mazeworld.html (module)");
  const consumers = entry.consumers.join(" ");
  assert.match(consumers, /renderCombatOver/);
  assert.match(consumers, /renderRankLine/);
  assert.match(consumers, /onRunRecorded/);
  assert.match(consumers, /showTitleScreen/);
  assert.match(consumers, /handlePlacement/);
  assert.match(entry.purpose, /never a field on state/);
});

test("(R10) no S.placement/S.rank/S.pgs* field is ever assigned in the shell", () => {
  assert.doesNotMatch(CODE, /\bS\.(placement|rank|pgs\w*)\b/);
});

// ═══════════════════════ (S) boardSync SOURCE pins ══════════════════════════

test("(S1) SOURCE: exactly one createBoardSync block wires storage/fetchFn/identity/client/competeOn, the version read from #mw-app-version, liveHash/onAcked/onPlacement (85-05) and an onChange that clears the feed and refreshes the panel", () => {
  assert.equal(occurrences(MODULE, "createBoardSync({"), 1);
  const region = sliceBetween(MODULE, "const boardSync = createBoardSync({", "\n  });");
  assert.match(region, /storage: window\.mzStorage,/);
  assert.match(region, /fetchFn: boardFetch,/);
  assert.match(region, /identity: boardIdentity\(\),/);
  assert.match(region, /client: boardClient,/);
  assert.match(region, /competeOn: competeIsOn,/);
  assert.match(region, /online: \(\) => navigator\.onLine !== false,/);
  assert.match(region, /version: \(\) => document\.getElementById\("mw-app-version"\)\?\.textContent \|\| "dev",/);
  assert.match(region, /liveHash: \(\) => liveDeathHash,/);
  assert.match(region, /onAcked: \(\) => account\?\.boardAcked\(\),/);
  assert.match(region, /onPlacement: handlePlacement,/);
  // Phase 91.2 (91.2-08): the board session's answer feeds the account controller.
  assert.match(region, /onSession: \(info\) => account\?\.sessionChanged\(info\),/);
  assert.match(region, /onChange: \(\) => \{/);
  assert.match(region, /boardFeed\.clear\(\);/);
  assert.match(region, /boardsPanel\.refresh\(\);/);
});

test("(S1b) SOURCE: the placement import line imports only placementOutcome (85-05 dropped placementLine/deferredPlacementCard/seasonDropLine from the shell's own import)", () => {
  assert.equal(occurrences(MODULE, 'import { placementOutcome } from "./src/browser/placement.js";'), 1);
  assert.equal(occurrences(MODULE, "placementLine, deferredPlacementCard"), 0);
  assert.equal(occurrences(MODULE, "seasonDropLine"), 0);
});

test("(S1c) SOURCE: handlePlacement calls placementOutcome, then renderRankLine for a line and parkPlacementCard for a card, wrapped in try/catch", () => {
  const region = sliceBetween(MODULE, "function handlePlacement(report) {", "\n  function onRunRecorded");
  assert.match(region, /try \{/);
  assert.match(region, /placementOutcome\(\{/);
  assert.match(region, /liveHash: liveDeathHash,/);
  assert.match(region, /panelUp: window\.__mzState\?\.get\?\.\(\)\?\.dead === true,/);
  assert.match(region, /renderRankLine\(document\.getElementById\("cb-over"\), window\.__mzPlacement\);/);
  assert.match(region, /parkPlacementCard\(outcome\.card\);/);
  assert.match(region, /\} catch \{/);
});

test("(S2) SOURCE: setRunRecordedListener(onRunRecorded) is wired and onRunRecorded calls boardSync.record", () => {
  assert.equal(occurrences(HTML, "setRunRecordedListener(onRunRecorded)"), 1);
  const region = sliceBetween(MODULE, "function onRunRecorded(summary) {", "\n  }");
  assert.match(region, /liveDeathHash = summary && typeof summary\.hash === "string" \? summary\.hash : null;/);
  assert.match(region, /window\.__mzPlacement = null;/);
  assert.match(region, /boardSync\.record\(summary\);/);
});

test("(S3) SOURCE: the online listener forces a flush; boardSync's own visibilitychange listener is the FIRST one in the file and runs the board session (name re-check plus flush) while visible", () => {
  assert.match(MODULE, /window\.addEventListener\("online", \(\) => boardSync\.flush\(\{ force: true \}\)\);/);
  const boardVisMarker = 'document.addEventListener("visibilitychange", () => {\n    if (document.visibilityState === "visible") boardSync.session();\n  });';
  assert.equal(occurrences(MODULE, boardVisMarker), 1);
  const boardVisIdx = MODULE.indexOf(boardVisMarker);
  const anyVisIdx = MODULE.indexOf('document.addEventListener("visibilitychange"');
  assert.equal(boardVisIdx, anyVisIdx, "boardSync's own visibilitychange listener is the first one in the file");
});

test("(S3b) SOURCE: one lazy PlayIdentity seam (native plugin on Android, the fake in the dev loop) is handed to both identities, and creating it calls no plugin method (D-02)", () => {
  assert.equal(occurrences(MODULE, "function playIdentity()"), 1);
  const seam = sliceBetween(MODULE, "function playIdentity() {", "\n  }");
  assert.match(seam, /window\.Capacitor\?\.isNativePlatform\?\.\(\) \? createPlayIdentity\(\) : createFakePlayIdentity\(\)/);
  assert.match(seam, /if \(!playIdentityInstance\)/);
  for (const method of ["init(", "status(", "signIn(", "serverAuthCode("]) {
    assert.equal(seam.includes(method), false, `the seam builder must not call ${method}`);
  }
  assert.equal(
    (MODULE.match(/createIdentity\(\{[^}]*playIdentity: playIdentity\(\)/g) || []).length,
    2,
    "sharedIdentity() and the dev boardIdentity() both get it",
  );
  assert.equal(occurrences(HTML, 'import { createPlayIdentity, createFakePlayIdentity } from "./src/browser/playIdentity.js";'), 1);
  assert.equal(occurrences(HTML, 'import { runPgsProbe } from "./src/browser/pgsProbe.js";'), 1);
});

test("(S3c) SOURCE: the PLAY GAMES PROBE and its fake sign-in toggle live only in #mw-dev-pgs-row, a sibling after #mw-dev-row, revealed by the same long-press; the toggle is hidden on native", () => {
  assert.equal(occurrences(HTML, 'id="mw-dev-pgs-row" hidden'), 1);
  assert.equal(occurrences(HTML, 'id="mw-dev-pgs-probe"'), 1);
  assert.equal(occurrences(HTML, 'id="mw-dev-pgs-fake"'), 1);
  assert.equal(occurrences(HTML, 'id="mw-dev-pgs-out" hidden'), 1);
  const devIdx = HTML.indexOf('id="mw-dev-row" hidden');
  const pgsRowIdx = HTML.indexOf('id="mw-dev-pgs-row" hidden');
  const devRowEnd = HTML.indexOf('<div id="mw-dev-perf"></div></div>', devIdx);
  assert.ok(devIdx !== -1 && devRowEnd !== -1 && pgsRowIdx > devRowEnd, "the probe row follows #mw-dev-row, never inside it");
  const pgsRow = sliceBetween(HTML, 'id="mw-dev-pgs-row" hidden', "</pre></div>");
  assert.ok(pgsRow.includes("mw-dev-pgs-probe") && pgsRow.includes("mw-dev-pgs-fake"));
  assert.match(MODULE, /const pgsRow = document\.getElementById\("mw-dev-pgs-row"\);\s*if \(pgsRow\) pgsRow\.hidden = false;/);
  assert.match(MODULE, /runPgsProbe\(\{\s*playIdentity: playIdentity\(\),\s*fetchFn: pgsNative \? globalThis\.fetch\.bind\(globalThis\) : boardFetch,\s*\}\)/);
  assert.match(MODULE, /console\.info\(`\[pgs-probe\] \$\{JSON\.stringify\(report\)\}`\)/);
  assert.match(MODULE, /if \(pgsNative\) pgsFakeBtn\.hidden = true;/);
  assert.match(MODULE, /playIdentity\(\)\.setSignedIn\?\.\(pgsFakeSignedIn\);/);
});

test("(S4) SOURCE: boardSync.boot({ history: getRunHistory() }) runs once, right after account.boot(), and is never awaited", () => {
  assert.equal(occurrences(MODULE, "boardSync.boot({ history: getRunHistory() })"), 1);
  assert.equal(occurrences(MODULE, "boardSync.boot({ history: getRunHistory() }).catch(() => {});"), 1);
  const bootIdx = MODULE.indexOf("account.boot()");
  const syncIdx = MODULE.indexOf("boardSync.boot(");
  assert.ok(bootIdx !== -1 && syncIdx > bootIdx, "boardSync.boot() must come after account.boot()");
  assert.doesNotMatch(MODULE, /await\s+boardSync\.boot\(/);
});

test("(S5) SOURCE: the native pause path awaits the adapter's and boardSync's pending writes", () => {
  const chrome = sliceBetween(MODULE, "registerNativeChrome({", "getGameContext:");
  assert.match(chrome, /waitForPending: \(\) => Promise\.all\(\[waitForPending\(\), boardSync\.waitForPending\(\)\]\),/);
});

test("(S6) SOURCE: no import of any retired game-service module, and the shell opens no network channel of its own", () => {
  for (const retired of ["playGames.js", "pgsQueue.js", "globalBoards.js", "boardScores.js", "scoreTag.js"]) {
    assert.equal(occurrences(HTML, retired), 0, retired);
  }
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(CODE, bad);
  }
});

/** handlePlacementFns(opts) — the shipped handlePlacement over fakes for
 * placementOutcome/renderRankLine/parkPlacementCard/document, and a fixed
 * liveDeathHash/window.__mzState.dead. opts.outcome is the fake
 * placementOutcome's return value (or a function of its input). */
function handlePlacementFns(opts = {}) {
  const region = sliceBetween(MODULE, "function handlePlacement(report) {", "\n  function onRunRecorded");
  const calls = { outcome: null, renderRankLine: [], parkPlacementCard: [] };
  const win = { __mzPlacement: "stale", __mzState: { get: () => ({ dead: opts.dead === true }) } };
  const doc = { getElementById: (id) => ({ id }) };
  const placementOutcome = (input) => {
    calls.outcome = input;
    return typeof opts.outcome === "function" ? opts.outcome(input) : opts.outcome;
  };
  const renderRankLine = (...args) => calls.renderRankLine.push(args);
  const parkPlacementCard = (...args) => calls.parkPlacementCard.push(args);
  const make = new Function(
    "window",
    "document",
    "placementOutcome",
    "renderRankLine",
    "parkPlacementCard",
    "liveDeathHash",
    region + "\nreturn handlePlacement;",
  );
  const handlePlacement = make(win, doc, placementOutcome, renderRankLine, parkPlacementCard, opts.liveDeathHash ?? null);
  return { handlePlacement, win, calls };
}

test("(H1) BEHAVIOUR: a matching live run with the panel up draws one fresh rank line and parks no card", () => {
  const { handlePlacement, win, calls } = handlePlacementFns({
    liveDeathHash: "aaa11111",
    dead: true,
    outcome: () => ({ line: { hash: "aaa11111", line: "You placed 12th of 340." }, card: null }),
  });
  handlePlacement({ live: { hash: "aaa11111", rank: 12, total: 340 }, rest: null });
  assert.deepEqual(calls.outcome, {
    live: { hash: "aaa11111", rank: 12, total: 340 },
    rest: null,
    liveHash: "aaa11111",
    panelUp: true,
  });
  assert.equal(calls.renderRankLine.length, 1);
  assert.deepEqual(win.__mzPlacement, { hash: "aaa11111", line: "You placed 12th of 340.", fresh: true });
  assert.match(win.__mzPlacement.line, /^You placed/);
  assert.equal(calls.parkPlacementCard.length, 0);
});

test("(H2) BEHAVIOUR: the same report once the panel is gone parks one card (count 1) and sets no placement", () => {
  const card = { title: "THE LEDGER CAUGHT UP", line: "Your earlier death placed 12th of 340 on DEPTH.", tone: "good", hold: 12000 };
  const { handlePlacement, win, calls } = handlePlacementFns({
    liveDeathHash: "aaa11111",
    dead: false,
    outcome: () => ({ line: null, card }),
  });
  handlePlacement({ live: { hash: "aaa11111", rank: 12, total: 340 }, rest: null });
  assert.equal(calls.outcome.panelUp, false);
  assert.equal(calls.renderRankLine.length, 0);
  assert.equal(win.__mzPlacement, "stale", "left untouched");
  assert.deepEqual(calls.parkPlacementCard, [[card]]);
});

test("(H3) BEHAVIOUR: live plus a rest batch draws the line and still parks the rest's own card (count 2)", () => {
  const restCard = { title: "THE LEDGER CAUGHT UP", line: "2 earlier deaths reached the ledger. The best placed 40th of 340 on DEPTH.", tone: "good", hold: 12000 };
  const { handlePlacement, calls, win } = handlePlacementFns({
    liveDeathHash: "aaa11111",
    dead: true,
    outcome: () => ({ line: { hash: "aaa11111", line: "You placed 12th of 340." }, card: restCard }),
  });
  handlePlacement({ live: { hash: "aaa11111", rank: 12, total: 340 }, rest: { count: 2, hash: "bbb22222", rank: 40, total: 340 } });
  assert.equal(calls.outcome.rest.count, 2);
  assert.equal(calls.renderRankLine.length, 1);
  assert.deepEqual(calls.parkPlacementCard, [[restCard]]);
  assert.equal(win.__mzPlacement.line, "You placed 12th of 340.");
});

test("(H4) BEHAVIOUR: a live hash that no longer matches liveDeathHash parks a card instead of drawing", () => {
  const card = { title: "THE LEDGER CAUGHT UP", line: "Your earlier death placed 12th of 340 on DEPTH.", tone: "good", hold: 12000 };
  const { handlePlacement, calls, win } = handlePlacementFns({
    liveDeathHash: "different-hash",
    dead: true,
    outcome: (input) => (input.live && input.live.hash !== input.liveHash ? { line: null, card } : { line: null, card: null }),
  });
  handlePlacement({ live: { hash: "aaa11111", rank: 12, total: 340 }, rest: null });
  assert.equal(calls.outcome.liveHash, "different-hash");
  assert.equal(calls.renderRankLine.length, 0);
  assert.deepEqual(calls.parkPlacementCard, [[card]]);
  assert.equal(win.__mzPlacement, "stale");
});

test("(H5) BEHAVIOUR: an incomplete or garbage report — or a placementOutcome that throws — draws nothing, parks nothing and never throws", () => {
  const { handlePlacement: throwing, calls: throwingCalls } = handlePlacementFns({
    outcome: () => {
      throw new Error("boom");
    },
  });
  assert.doesNotThrow(() => throwing({ live: null, rest: null }));
  assert.equal(throwingCalls.renderRankLine.length, 0);
  assert.equal(throwingCalls.parkPlacementCard.length, 0);

  const { handlePlacement, calls } = handlePlacementFns({ outcome: () => ({ line: null, card: null }) });
  for (const report of [null, undefined, {}, { live: null, rest: null }, "garbage", 42]) {
    assert.doesNotThrow(() => handlePlacement(report));
  }
  assert.equal(calls.renderRankLine.length, 0);
  assert.equal(calls.parkPlacementCard.length, 0);
});

// ═══════════════════════ (D) the death listener ═════════════════════════════

/** runRecordedFns() — the shipped onRunRecorded over a fake window and a recording boardSync.record. */
function runRecordedFns() {
  const region = sliceBetween(MODULE, "function onRunRecorded(summary) {", "\n  window.__mzControls = {");
  const calls = [];
  const win = { __mzPlacement: "stale" };
  const boardSync = { record: (s) => calls.push(["record", s]) };
  const make = new Function(
    "window",
    "boardSync",
    "let liveDeathHash = null;\n" + region + "\nreturn { onRunRecorded, live: () => liveDeathHash };",
  );
  const fns = make(win, boardSync);
  return { ...fns, win, calls };
}

test("(D1) BEHAVIOUR: onRunRecorded records the live hash, clears the placement and calls boardSync.record once", () => {
  const f = runRecordedFns();
  const summary = { hash: "h1", season: 1 };
  f.onRunRecorded(summary);
  assert.equal(f.live(), "h1");
  assert.equal(f.win.__mzPlacement, null);
  assert.deepEqual(f.calls, [["record", summary]]);
});

test("(D2) BEHAVIOUR: a non-string/missing hash records a null live hash, still clears the placement and still calls record", () => {
  const f = runRecordedFns();
  f.onRunRecorded({ season: 1 });
  assert.equal(f.live(), null);
  assert.equal(f.win.__mzPlacement, null);
  assert.deepEqual(f.calls, [["record", { season: 1 }]]);
});

// ═══════════════════════ (C) card parking ═══════════════════════════════════

/** cardParking(opts) — the shipped dungeonVisible/parkAccountCard/flushAccountCard/parkPlacementCard with a fake timer. pendingPlacementCard/placementCardTimer are declared inside this same slice (renamed from the retired pgs card, 85-04). */
function cardParking({ title = false, dead = false } = {}) {
  const region = sliceBetween(CODE, "let pendingAccountCard = null;", "\n  const boardSync = createBoardSync({");
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
    region + "\nreturn { dungeonVisible, parkAccountCard, flushAccountCard, parkPlacementCard };",
  );
  return { ...make(doc, win, setTimeoutFake), rail, timers, doc, state };
}

const ACCOUNT_CARD = Object.freeze({ title: "WELCOME TO THE BOARD", line: "welcome line", tone: "good", hold: 9000 });
const PLACEMENT_CARD = Object.freeze({ title: "THE LEDGER CAUGHT UP", line: "placed line", tone: "good", hold: 12000 });
const asArgs = (c) => [c.title, c.line, c.tone, c.hold];

test("(C1) BEHAVIOUR: with the dungeon visible, parkPlacementCard delivers the card through mzRailLine once", () => {
  const p = cardParking();
  p.parkPlacementCard(PLACEMENT_CARD);
  assert.deepEqual(p.rail, [asArgs(PLACEMENT_CARD)]);
  p.flushAccountCard();
  assert.equal(p.rail.length, 1, "delivered once");
});

test("(C2) BEHAVIOUR: a null card is ignored", () => {
  const p = cardParking();
  p.parkPlacementCard(null);
  assert.deepEqual(p.rail, []);
});

test("(C3) BEHAVIOUR: with an account card parked too, the account card goes first and the placement card follows by timer after its hold", () => {
  const p = cardParking({ title: true });
  p.parkAccountCard(ACCOUNT_CARD);
  p.parkPlacementCard(PLACEMENT_CARD);
  assert.deepEqual(p.rail, []);
  p.doc.nodes["mw-title-screen"].hidden = true;
  p.flushAccountCard();
  assert.deepEqual(p.rail, [asArgs(ACCOUNT_CARD)]);
  assert.equal(p.timers.length, 1);
  assert.equal(p.timers[0].ms, ACCOUNT_CARD.hold + 600);
  p.flushAccountCard();
  assert.deepEqual(p.rail, [asArgs(ACCOUNT_CARD)], "never on top of the account card while its timer runs");
  p.timers[0].fn();
  assert.deepEqual(p.rail, [asArgs(ACCOUNT_CARD), asArgs(PLACEMENT_CARD)]);
  assert.equal(p.timers.length, 1, "no second timer");
});

test("(C4) BEHAVIOUR: with the title up nothing is delivered until flushAccountCard runs with the dungeon visible; the latest card wins", () => {
  const p = cardParking({ title: true });
  p.parkPlacementCard(PLACEMENT_CARD);
  const later = Object.freeze({ ...PLACEMENT_CARD, line: "later line" });
  p.parkPlacementCard(later);
  assert.deepEqual(p.rail, []);
  p.doc.nodes["mw-title-screen"].hidden = true;
  p.flushAccountCard();
  assert.deepEqual(p.rail, [asArgs(later)]);
});

test("(C5) BEHAVIOUR: the placement card waits while the party is dead (the rail is hidden then) and lands on the next map", () => {
  const p = cardParking({ dead: true });
  p.parkPlacementCard(PLACEMENT_CARD);
  assert.deepEqual(p.rail, []);
  p.state.dead = false;
  p.flushAccountCard();
  assert.deepEqual(p.rail, [asArgs(PLACEMENT_CARD)]);
});

test("(C6) BEHAVIOUR: an account card alone still goes straight to the rail (Phase 67 unchanged)", () => {
  const p = cardParking();
  p.parkAccountCard(ACCOUNT_CARD);
  assert.deepEqual(p.rail, [asArgs(ACCOUNT_CARD)]);
  assert.equal(p.timers.length, 0);
});
