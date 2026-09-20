// test/unit/bridge-registry.test.js
//
// Phase 47 (SHELL-04)'s gate — proves src/browser/bridge.js's BRIDGE map is
// the exhaustive, live source of truth for every `window.__mz*` name that
// crosses the seam between mazeworld.html's classic <script> and its
// trailing <script type="module">. A comment-stripped `__mz\w+` scan over
// mazeworld.html + every src/browser/*.js file is compared against
// bridgeNames() by SET EQUALITY: a name the scan finds but the map lacks
// (unlisted — a new global sneaking in unregistered) fails, and a name the
// map lists but nothing defines any more (stale) fails too.
//
// bridge.js itself is EXCLUDED from the scan. Its own object keys are the
// literal strings "__mzFoo", "__mzBar", ... — if it were scanned, every
// listed key would show up as a "live" match regardless of whether anything
// still assigns or reads that name, silently defeating the stale-key half
// of this test forever.
//
// The scan is comment-stripped using tools/ident-sweep.mjs's OWN stripJs/
// stripHtml (imported, not reimplemented) — the Phase 46 (NAME-02) ident-
// sweep precedent already proved a naive two-pass stripper can misread a
// `//` comment containing `@capacitor/*`-shaped text as an unterminated
// block-comment opener; reusing the same single-pass state machine here
// means this test can never regress that same failure mode with a second,
// divergent implementation.
//
// Every teeth test below runs against SYNTHETIC inputs (a fabricated
// `sources` array), never against the real files — a fail-first proof that
// this test would actually catch an unlisted/stale/comment-only name, not
// just happen to pass today.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs, stripHtml } from "../../tools/ident-sweep.mjs";
import { BRIDGE, bridgeNames } from "../../src/browser/bridge.js";
import { renderTable } from "../../tools/bridge-doc.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "SHELL-MODULES.md");

const BRIDGE_NAME_RE = /__mz\w+/g;

// An owner is exactly one of the classic script, the module script, or a
// src/browser/ file — the only three places a window.__mz* name (or, for
// the three test-injection hooks, a globalThis.__mz* name) can be declared.
const OWNER_RE = /^mazeworld\.html \((classic|module)\)$|^src\/browser\/[\w.-]+\.js$/;

// The three test-only injection hooks (globalThis.__mz*Override) — listed
// explicitly so test (h) can assert their consumers are real test paths,
// not the same "mazeworld.html (classic/module: fn)" shape every other
// bridge's consumers use.
const INJECTION_HOOKS = ["__mzAppImportOverride", "__mzHapticsImportOverride", "__mzPreferencesOverride"];

/**
 * liveBridgeNames(sources) — sources: [{ path, text, kind }] (kind: "html"
 * or "js") -> a sorted array of unique __mz\w+ matches over the
 * comment-stripped text of every source.
 */
function liveBridgeNames(sources) {
  const found = new Set();
  for (const { text, kind } of sources) {
    const stripped = kind === "html" ? stripHtml(text) : stripJs(text);
    for (const m of stripped.match(BRIDGE_NAME_RE) || []) found.add(m);
  }
  return [...found].sort();
}

/**
 * defaultSources() — the real scan surface: mazeworld.html (html) plus
 * every src/browser/*.js file EXCEPT bridge.js (js).
 */
function defaultSources() {
  const sources = [];
  const htmlPath = path.join(REPO_ROOT, "mazeworld.html");
  sources.push({ path: "mazeworld.html", text: fs.readFileSync(htmlPath, "utf8"), kind: "html" });

  const browserDir = path.join(REPO_ROOT, "src", "browser");
  for (const entry of fs.readdirSync(browserDir).sort()) {
    if (!entry.endsWith(".js")) continue;
    if (entry === "bridge.js") continue; // excluded — see header comment
    sources.push({
      path: `src/browser/${entry}`,
      text: fs.readFileSync(path.join(browserDir, entry), "utf8"),
      kind: "js",
    });
  }
  return sources;
}

/**
 * diffNames(live, keys) -> { unlisted, stale } — live names the map lacks,
 * and mapped keys nothing live defines any more.
 */
function diffNames(live, keys) {
  const liveSet = new Set(live);
  const keySet = new Set(keys);
  return {
    unlisted: live.filter((n) => !keySet.has(n)),
    stale: keys.filter((n) => !liveSet.has(n)),
  };
}

// ─── (a) set-equality ───────────────────────────────────────────────────

test("SHELL-04: BRIDGE's keys are exactly the live __mz* names (no unlisted, no stale)", () => {
  const live = liveBridgeNames(defaultSources());
  const { unlisted, stale } = diffNames(live, bridgeNames());
  assert.deepEqual(
    { unlisted, stale },
    { unlisted: [], stale: [] },
    `unlisted (live but not in BRIDGE): ${JSON.stringify(unlisted)}\nstale (in BRIDGE but not live): ${JSON.stringify(stale)}`,
  );
});

// ─── (b) entry shape ────────────────────────────────────────────────────

test("SHELL-04: every BRIDGE entry has a valid owner, a non-empty consumers array, and a purpose", () => {
  for (const [name, entry] of Object.entries(BRIDGE)) {
    assert.match(entry.owner, OWNER_RE, `${name}: owner "${entry.owner}" is not an allowed form`);
    assert.ok(Array.isArray(entry.consumers) && entry.consumers.length > 0, `${name}: consumers must be a non-empty array`);
    for (const c of entry.consumers) {
      assert.equal(typeof c, "string", `${name}: a consumer entry is not a string`);
      assert.ok(c.length > 0, `${name}: a consumer string is empty`);
    }
    assert.equal(typeof entry.purpose, "string", `${name}: purpose must be a string`);
    assert.ok(entry.purpose.length > 0, `${name}: purpose is empty`);
  }
});

// ─── (c) ordering ───────────────────────────────────────────────────────

test("SHELL-04: Object.keys(BRIDGE) is alphabetically sorted", () => {
  const keys = Object.keys(BRIDGE);
  assert.deepEqual(keys, [...keys].sort());
});

// ─── (d) teeth — empty map reports every live name unlisted ────────────

test("SHELL-04 teeth: diffing the real live set against an EMPTY registry reports every live name unlisted", () => {
  const live = liveBridgeNames(defaultSources());
  // Phase 47 (SHELL-01), Plan 03: 53 -> 49 (net -6 +2: __mzGear/
  // __mzItemRowState/__mzWornSlots/__mzWornKeysOf/__mzSlotFor/__mzSellPrice
  // retired, __mzTabs/__mzCarriedList added). Phase 47 (SHELL-02), Plan 04:
  // 49 -> 44 (-5: __mzAbilities/__mzEff/__mzRenderGrimoire/__mzStrikeDie/
  // __mzToHit retired; __mzTabs already existed, just gained the hero key).
  assert.ok(live.length >= 40, `expected at least 40 live __mz* names, measured ${live.length}`);
  const { unlisted, stale } = diffNames(live, []);
  assert.equal(unlisted.length, live.length);
  assert.equal(stale.length, 0);
});

// ─── (e) teeth — a name only this test's registry lacks is caught ──────

test("SHELL-04 teeth: a synthetic window.__mzNotListed source is reported unlisted", () => {
  const syntheticSources = [{ path: "scratch.js", text: "window.__mzNotListed = 1;", kind: "js" }];
  const live = liveBridgeNames(syntheticSources);
  assert.deepEqual(live, ["__mzNotListed"]);
  const { unlisted } = diffNames(live, bridgeNames());
  assert.ok(unlisted.includes("__mzNotListed"), "expected __mzNotListed to be reported unlisted");
});

// ─── (f) teeth — the stripper: comment-only mentions are never live ────

test("SHELL-04 teeth: a name mentioned ONLY inside a comment is never reported live", () => {
  const jsCommentOnly = [
    { path: "scratch.js", text: "// window.__mzCommentOnlyJs = 1;\nconst x = 1;\n/* window.__mzCommentOnlyJs2 = 2; */\n", kind: "js" },
  ];
  assert.deepEqual(liveBridgeNames(jsCommentOnly), []);

  const htmlCommentOnly = [
    { path: "scratch.html", text: "<!-- window.__mzCommentOnlyHtml = 1; -->\n<script>const y = 2;</script>\n", kind: "html" },
  ];
  assert.deepEqual(liveBridgeNames(htmlCommentOnly), []);
});

// ─── (g) adjacency — the retired three-tab-surface pattern never returns ─

test("SHELL-04 adjacency: no live or listed name matches the old per-tab surface pattern", () => {
  const OLD_TAB_SURFACE_RE = /^__mz(Gear|Hero|Store)(Tab|Screen)$/;
  const live = liveBridgeNames(defaultSources());
  assert.deepEqual(live.filter((n) => OLD_TAB_SURFACE_RE.test(n)), []);
  assert.deepEqual(bridgeNames().filter((n) => OLD_TAB_SURFACE_RE.test(n)), []);
});

// ─── (h) the three injection hooks' consumers are real test paths ──────

test("SHELL-04: the three test-injection hooks' consumers are test paths that exist on disk", () => {
  for (const name of INJECTION_HOOKS) {
    const entry = BRIDGE[name];
    assert.ok(entry, `${name} is missing from BRIDGE`);
    assert.ok(entry.consumers.length > 0, `${name} has no consumers`);
    for (const consumerPath of entry.consumers) {
      assert.ok(
        fs.existsSync(path.join(REPO_ROOT, consumerPath)),
        `${name}'s consumer "${consumerPath}" does not exist on disk`,
      );
    }
  }
});

// ─── (i) doc-sync — docs/SHELL-MODULES.md's table matches the map ──────

test("SHELL-04 doc-sync: docs/SHELL-MODULES.md's Module bridge table names match bridgeNames() exactly", () => {
  const docText = fs.readFileSync(DOC_PATH, "utf8");
  const startIdx = docText.indexOf("<!-- bridge-table:start -->");
  const endIdx = docText.indexOf("<!-- bridge-table:end -->");
  assert.ok(startIdx !== -1 && endIdx !== -1, "docs/SHELL-MODULES.md is missing a bridge-table marker");
  const tableText = docText.slice(startIdx, endIdx);
  const names = [...tableText.matchAll(/^\|\s*(__mz\w+)\s*\|/gm)].map((m) => m[1]);
  assert.deepEqual([...names].sort(), bridgeNames());
});

// ─── (j) renderTable() has one row per BRIDGE key ──────────────────────

test("SHELL-04: tools/bridge-doc.mjs#renderTable() emits exactly one row per BRIDGE key", () => {
  const table = renderTable();
  const names = [...table.matchAll(/^\|\s*(__mz\w+)\s*\|/gm)].map((m) => m[1]);
  assert.deepEqual([...names].sort(), bridgeNames());
  assert.equal(names.length, bridgeNames().length);
});
