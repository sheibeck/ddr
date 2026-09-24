// test/unit/shell-new-best.test.js
//
// Phase 65 (RUN-04), Plan 05 — mazeworld.html has no module surface a test
// could import directly, so — mirroring shell-combat-over.test.js's own
// source-assertion pattern — this file reads the real shipped source with
// fs.readFileSync and asserts against it directly: a fake-DOM behaviour test
// of the classic renderNewBestBlock function (extracted and evaluated with
// `new Function`), the renderCombatOver call-site region pin, the CSS rules,
// the rail-stays-hidden-while-dead pin, the no-GameState-field pin, and the
// Plan 65-05 Task 1 module wiring pins (dispatchWithNarration/showTitleScreen).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — mirrors
// shell-combat-over.test.js's own stripComments) ────────────────────────────
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

// A per-function slice from an exact signature to the NEXT "\nfunction "
// after it (shell-combat-over.test.js's own fnRegion helper).
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

function overRegion() {
  return fnRegion("function renderCombatOver(host, kind, opts = {})");
}
function newBestBlockRegion() {
  return fnRegion("function renderNewBestBlock(host, view)");
}

// The module <script type="module"> body indents its function declarations
// (2 spaces), so the classic script's zero-indent "\nfunction " boundary
// (fnRegion above) never matches inside it. This variant looks for the next
// line that is (optionally indented) "function " instead.
function indentedFnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const rest = CODE.slice(start + sig.length);
  const m = rest.match(/\n[ \t]*function /);
  assert.ok(m, `no following function boundary after: ${sig}`);
  return CODE.slice(start, start + sig.length + m.index);
}
function dispatchWithNarrationRegion() {
  return indentedFnRegion("function dispatchWithNarration(action, opts = {})");
}
function showTitleScreenRegion() {
  return indentedFnRegion("function showTitleScreen({ allowResume } = {})");
}

// ─── a. fake-DOM behaviour: extract the real shipped renderNewBestBlock
// source and evaluate it with `new Function`, against a minimal fake
// document (createElement returning { tagName, className, id, textContent,
// children: [], appendChild }) ───────────────────────────────────────────────

function makeFakeDocument() {
  return {
    createElement(tag) {
      return {
        tagName: tag,
        className: "",
        id: "",
        textContent: "",
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
      };
    },
  };
}

function loadRenderNewBestBlock() {
  const src = newBestBlockRegion();
  const fakeDocument = makeFakeDocument();
  const fn = new Function("document", src + "; return renderNewBestBlock;");
  return { renderNewBestBlock: fn(fakeDocument), fakeDocument };
}

function makeFakeHost() {
  return {
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
  };
}

test("RUN-04: renderNewBestBlock(host, null) appends no child to host", () => {
  const { renderNewBestBlock } = loadRenderNewBestBlock();
  const host = makeFakeHost();
  renderNewBestBlock(host, null);
  assert.equal(host.children.length, 0);
});

test("RUN-04: renderNewBestBlock renders a gold cb-over-best block with head, ordered rows and one quip", () => {
  const { renderNewBestBlock } = loadRenderNewBestBlock();
  const host = makeFakeHost();
  const view = {
    head: "NEW PERSONAL BEST",
    rows: ["DEEPEST DESCENT · floor 9", "DEEPEST, FEWEST STEPS · floor 9 · 312 sq"],
    quip: "Q",
  };
  renderNewBestBlock(host, view);
  assert.equal(host.children.length, 1);
  const block = host.children[0];
  assert.equal(block.className, "cb-over-best");
  assert.equal(block.children.length, 4);
  const [head, row1, row2, quip] = block.children;
  assert.equal(head.className, "cb-over-best-head");
  assert.equal(head.textContent, "NEW PERSONAL BEST");
  assert.equal(row1.className, "cb-over-best-row");
  assert.equal(row1.textContent, "DEEPEST DESCENT · floor 9");
  assert.equal(row2.className, "cb-over-best-row");
  assert.equal(row2.textContent, "DEEPEST, FEWEST STEPS · floor 9 · 312 sq");
  assert.equal(quip.className, "cb-over-best-quip");
  assert.equal(quip.textContent, "Q");
});

test("RUN-04: renderNewBestBlock with a first-death view (head null, no rows) holds only the quip", () => {
  const { renderNewBestBlock } = loadRenderNewBestBlock();
  const host = makeFakeHost();
  const view = { head: null, rows: [], quip: "First corpse on the books." };
  renderNewBestBlock(host, view);
  assert.equal(host.children.length, 1);
  const block = host.children[0];
  assert.equal(block.className, "cb-over-best");
  assert.equal(block.children.length, 1);
  assert.equal(block.children[0].className, "cb-over-best-quip");
  assert.equal(block.children[0].textContent, "First corpse on the books.");
});

// ─── b. region pins ─────────────────────────────────────────────────────────

test('RUN-04: renderCombatOver calls renderNewBestBlock(over, window.__mzDeathRecord) after over.appendChild(line) and before the cb-over-actions block', () => {
  const region = overRegion();
  const lineIdx = region.indexOf("over.appendChild(line);");
  const callIdx = region.indexOf('if (kind === "dead") renderNewBestBlock(over, window.__mzDeathRecord);');
  const actionsIdx = region.indexOf('actions.className = "cb-over-actions";');
  assert.ok(lineIdx !== -1, "over.appendChild(line); not found");
  assert.ok(callIdx !== -1, "renderNewBestBlock call site not found");
  assert.ok(actionsIdx !== -1, "cb-over-actions creation not found");
  assert.ok(callIdx > lineIdx, "renderNewBestBlock call must come after over.appendChild(line)");
  assert.ok(callIdx < actionsIdx, "renderNewBestBlock call must come before the cb-over-actions block");
});

test("RUN-04: renderCombatOver and renderNewBestBlock contain no innerHTML", () => {
  assert.doesNotMatch(overRegion(), /innerHTML/);
  assert.doesNotMatch(newBestBlockRegion(), /innerHTML/);
});

// ─── c. CSS ─────────────────────────────────────────────────────────────────

test("RUN-04: .cb-over-best{ CSS rule exists with the #e8c97a gold accent", () => {
  const idx = CODE.indexOf(".cb-over-best{");
  assert.ok(idx !== -1, ".cb-over-best{ rule not found");
  const ruleEnd = CODE.indexOf("}", idx);
  const rule = CODE.slice(idx, ruleEnd + 1);
  assert.match(rule, /#e8c97a/);
});

test("RUN-04: .cb-over-best-head, .cb-over-best-row and .cb-over-best-quip CSS rules all exist", () => {
  assert.match(CODE, /\.cb-over-best-head\{/);
  assert.match(CODE, /\.cb-over-best-row\{/);
  assert.match(CODE, /\.cb-over-best-quip\{/);
});

// ─── d. the rail stays hidden while dead ────────────────────────────────────

test("RUN-04: the rail-hidden-while-dead predicate is unchanged verbatim", () => {
  // Phase 71 (D-10, R-14): the combat half gained the long-press foe card's
  // exception; S.dead still hides the rail unconditionally.
  const hits = CODE.match(/railEl\.hidden = !!\(\(S\.combat && !foeCardUp\) \|\| S\.dead\) \|\| idle;/g) || [];
  assert.equal(hits.length, 1);
});

// ─── e. no GameState field ──────────────────────────────────────────────────

test("RUN-04: no S.bests/deathRecord/newBest field is ever assigned in the shell", () => {
  assert.doesNotMatch(CODE, /\bS\.(bests|deathRecord|newBest)\b/);
});

// ─── f. Task 1 module wiring pins ───────────────────────────────────────────

test('RUN-04: dispatchWithNarration parks newBestView(takeDeathRecord()) on a died event', () => {
  const region = dispatchWithNarrationRegion();
  const diedIdx = region.indexOf('if (result.events.some((e) => e.type === "died"))');
  assert.ok(diedIdx !== -1, "died-event check not found in dispatchWithNarration");
  const rest = region.slice(diedIdx);
  assert.match(rest.split("\n")[0], /newBestView\(takeDeathRecord\(\)\)/);
});

test("RUN-04: showTitleScreen resets window.__mzDeathRecord to null", () => {
  const region = showTitleScreenRegion();
  assert.match(region, /window\.__mzDeathRecord = null/);
});
