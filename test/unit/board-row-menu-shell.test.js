// test/unit/board-row-menu-shell.test.js
//
// Phase 87 (BOARD-29), Plan 09, Task 3 — the shell half of "long-press a
// leaderboard row to filter the board by that hero's race and sub-class".
//
// The recording DOM's addEventListener is a no-op, so (as in
// test/unit/foe-inspect-shell.test.js) the gesture wiring is proven by
// test/unit/longPress.test.js (the recognizer itself), the controller tests
// in test/unit/leaderboardPanel.test.js (openRowMenu and the menu picks) and
// the source pins below (where each listener sits and what it calls). The one
// behaviour check here drives the REAL createLongPress with a fake clock the
// way the shell wires it, and proves a fired press opens the row sheet
// through the REAL controller while the trailing click is swallowed once.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { createLongPress } from "../../src/browser/longPress.js";
import { HOLD_MS } from "../../src/browser/tapStep.js";
import { createLeaderboardPanel } from "../../src/browser/leaderboardPanel.js";
import { leaderboardView } from "../../src/browser/leaderboardView.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);

function sliceFrom(source, startMarker, len = 2400) {
  const i = source.indexOf(startMarker);
  assert.ok(i !== -1, `marker not found: ${startMarker}`);
  return source.slice(i, i + len);
}

// ─── behaviour: the shell's wiring, driven through the real recognizer ───────

test("a held press on a board row opens the FILTER LIKE THIS sheet once and the trailing click is swallowed; a tap still toggles the row", () => {
  const clock = createFakeClock();
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-dead");
  const panel = createLeaderboardPanel({
    host,
    buildView: leaderboardView,
    history: () => [
      { hash: "aaaaaaa1", name: "Hilda Ferrow", race: "Dwarven", cls: "Magic User", sub: "Wizard", level: 1, floor: 4, day: 2, steps: 90, kills: 3, gold: 10, sp: 5, cause: "combat", note: "cut down by a Rat King", epitaph: "Meh.", when: 1, version: "2.3.0 (13)", season: 1 },
    ],
    board: {},
    competeOn: () => false,
    prefs: null,
    now: () => 0,
    tzOffset: () => 0,
    season: 1,
  });
  panel.openFromTab({});

  let haptics = 0;
  const press = createLongPress({
    setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
    clearTimeout: (id) => clock.clearTimeout(id),
    now: () => clock.now(),
    onLongPress: (key) => {
      haptics += 1;
      panel.openRowMenu(key);
    },
  });

  const row = () => host.querySelectorAll(".mw-lb-row").find((r) => r.dataset.key === "aaaaaaa1");

  // press and hold: fires once at HOLD_MS
  panel.state(); // no side effect
  press.down({ id: 1, x: 10, y: 10, foe: "aaaaaaa1" });
  clock.advance(HOLD_MS + 5);
  assert.equal(haptics, 1);
  assert.equal(panel.state().sheet, "row");
  press.up({ id: 1, x: 10, y: 10 });

  // the trailing click is swallowed exactly once, so the row never toggles
  assert.equal(press.consumeClick(), true);
  assert.equal(press.consumeClick(), false);
  assert.equal(panel.state().open, null, "the long press never toggled the row");

  // a plain tap (no hold) still toggles the row
  panel.back();
  press.down({ id: 2, x: 10, y: 10, foe: "aaaaaaa1" });
  clock.advance(50);
  press.up({ id: 2, x: 10, y: 10 });
  assert.equal(press.consumeClick(), false);
  row().onclick();
  assert.equal(panel.state().open, "aaaaaaa1");

  // moving past the travel limit cancels
  panel.back();
  press.down({ id: 3, x: 10, y: 10, foe: "aaaaaaa1" });
  press.move({ id: 3, x: 10, y: 200 });
  clock.advance(HOLD_MS + 50);
  assert.equal(haptics, 1, "a scroll-sized move never fires the press");
  assert.equal(panel.state().sheet, null);
});

// ─── source pins ─────────────────────────────────────────────────────────────

test("pins: boardRowLongPress is built with createLongPress, injected timers, and gives one light haptic then opens the row menu", () => {
  const region = sliceFrom(CODE, "const boardRowLongPress = createLongPress({", 600);
  assert.match(region, /setTimeout: \(fn, ms\) => setTimeout\(fn, ms\)/);
  assert.match(region, /clearTimeout: \(id\) => clearTimeout\(id\)/);
  assert.match(region, /now: \(\) => Date\.now\(\)/);
  assert.match(region, /maybeHaptic\(currentSettings, "Light"\);/);
  assert.equal((CODE.match(/boardsPanel\.openRowMenu\(/g) || []).length, 1);
  assert.ok(
    region.indexOf("maybeHaptic(") < region.indexOf("boardsPanel.openRowMenu("),
    "the haptic plays before the menu opens"
  );
});

test("pins: the gesture listeners — pointerdown on #screen-dead arms only on .mw-lb-row[data-key]; document move/up/cancel/scroll in capture; the window capture click suppressor; contextmenu", () => {
  assert.match(CODE, /closest\("\.mw-lb-row\[data-key\]"\)/);
  const down = sliceFrom(CODE, 'document.getElementById("screen-dead")?.addEventListener("pointerdown"', 500);
  assert.match(down, /boardRowLongPress\.cancel\(\)/, "a press off a row cancels");
  assert.match(down, /boardRowLongPress\.down\(/);
  assert.match(CODE, /document\.addEventListener\("pointermove", \(e\) => boardRowLongPress\.move\([^)]*\), true\);/);
  assert.match(CODE, /document\.addEventListener\("pointerup", \(e\) => boardRowLongPress\.up\([^)]*\), true\);/);
  assert.match(CODE, /document\.addEventListener\("pointercancel", \(\) => boardRowLongPress\.cancel\(\), true\);/);
  assert.match(CODE, /document\.addEventListener\("scroll", \(\) => boardRowLongPress\.cancel\(\), true\);/);
  assert.equal((CODE.match(/boardRowLongPress\.consumeClick\(\)/g) || []).length, 1);
  const click = sliceFrom(CODE, "if (!boardRowLongPress.consumeClick()) return;", 200);
  assert.match(click, /e\.stopPropagation\(\);/);
  assert.match(click, /e\.preventDefault\(\);/);
  const clickStart = CODE.lastIndexOf('window.addEventListener("click"', CODE.indexOf("boardRowLongPress.consumeClick()"));
  assert.ok(clickStart !== -1, "the suppressor is a window click listener");
  assert.match(sliceFrom(CODE.slice(clickStart), 'window.addEventListener("click"', 300), /\}, true\);/, "in the capture phase");
  const menu = sliceFrom(CODE, 'document.getElementById("screen-dead")?.addEventListener("contextmenu"', 300);
  assert.match(menu, /preventDefault\(\)/);
  // No click listener on the host or the rows: the row's own tap keeps working.
  assert.equal((CODE.match(/getElementById\("screen-dead"\)\?\.addEventListener\("click"/g) || []).length, 0);
});

test("pins: no new window.__mz bridge name for the board row press", () => {
  assert.doesNotMatch(CODE, /__mzBoardRow/);
  assert.doesNotMatch(CODE, /window\.__mz\w*\s*=[^;\n]*boardRowLongPress/);
});

test("pins: CSS — .mw-lb-row has no callout and no text selection, and the new classes do not animate", () => {
  const style = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  const rules = [...style.matchAll(/^\.mw-lb-row\{([^}]*)\}/gm)].map((m) => m[1]).join(";");
  assert.match(rules, /-webkit-touch-callout:none/);
  assert.match(rules, /(^|;)user-select:none/);
  assert.match(rules, /-webkit-user-select:none/);
  for (const sel of [".mw-lb-detail-who", ".mw-lb-detail-filter"]) {
    const body = (style.match(new RegExp("^" + sel.replace(/\./g, "\\.") + "\\{([^}]*)\\}", "m")) || [])[1];
    assert.ok(body, `expected a ${sel} rule`);
    assert.doesNotMatch(body, /animation|transition/);
  }
});
