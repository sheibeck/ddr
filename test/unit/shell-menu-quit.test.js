// test/unit/shell-menu-quit.test.js
//
// Phase 70 (POLISH-03, D-06/D-07), Plan 03 — pins the ☰ menu's two quit rows
// in mazeworld.html: SAVE & QUIT (no dialog, the menu closes first, then
// window.mzAbandonRun) and ABANDON THIS CHARACTER (the in-row two-tap arm
// from src/browser/hudMenu.js#abandonRowNext, governed by Settings › Confirm
// before quit; the ABANDON_ARM_MS expiry; NEW CHARACTER while dead), the
// retired confirm dialogs, the dead-state Save & quit ruling (no resume armed)
// and the D-07 close-first helper every ☰ row goes through (closeMenuThen).
//
// mazeworld.html has no ESM surface a test could import, so this follows
// test/unit/shell-account.test.js: SOURCE pins over the comment-stripped
// text, and BEHAVIOUR tests that evaluate the exact shipped source of a
// region with fakes threaded in. The reducer, the arm window and the
// settings predicate are the real modules, never copies.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { abandonRowNext, ABANDON_ARM_MS } from "../../src/browser/hudMenu.js";
import { shouldConfirmQuit } from "../../src/browser/settings.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

// Line comments first, THEN block comments (shell-combat-over.test.js's order).
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

// ─── the quit-row block, evaluated with fakes ─────────────────────────────

/**
 * quitRows({ dead, confirmBeforeQuit }) — the shipped module block from
 * `let abandonArmTimer = null;` up to the dev long-press constant, run over
 * two fake rows (with datasets and recorded click listeners), a recording
 * window/hudMenuEvent and fake timers.
 */
function quitRows({ dead = false, confirmBeforeQuit = true } = {}) {
  const region = sliceBetween(MODULE, "let abandonArmTimer = null;", "const DEV_LONG_PRESS_MS");
  const log = [];
  const listeners = {};
  const row = (id, dataset) => ({
    id,
    dataset,
    addEventListener: (type, fn) => {
      assert.equal(type, "click");
      listeners[id] = fn;
    },
  });
  const rows = {
    "mw-menu-save-quit": row("mw-menu-save-quit", {}),
    "mw-menu-abandon": row("mw-menu-abandon", { armed: "0", dead: dead ? "1" : "0" }),
  };
  const doc = { getElementById: (id) => rows[id] || null };
  const state = { dead };
  const win = {
    __mzState: { get: () => state },
    mzAbandonRun: () => log.push("mzAbandonRun"),
    mzAbandonCharacter: () => log.push("mzAbandonCharacter"),
    mzStartRoll: () => log.push("mzStartRoll"),
  };
  const timers = new Map();
  let nextTimer = 1;
  const cleared = [];
  const setTimeoutFake = (fn, ms) => {
    const id = nextTimer++;
    timers.set(id, { fn, ms });
    return id;
  };
  const clearTimeoutFake = (id) => {
    cleared.push(id);
    timers.delete(id);
  };
  const settings = { confirmBeforeQuit };
  new Function(
    "document",
    "window",
    "hudMenuEvent",
    "abandonRowNext",
    "ABANDON_ARM_MS",
    "shouldConfirmQuit",
    "currentSettings",
    "setTimeout",
    "clearTimeout",
    region,
  )(doc, win, (kind) => log.push(kind), abandonRowNext, ABANDON_ARM_MS, shouldConfirmQuit, settings, setTimeoutFake, clearTimeoutFake);

  function click(id) {
    const ev = { stopped: false, stopPropagation() { this.stopped = true; } };
    listeners[id](ev);
    return ev;
  }
  return {
    log,
    rows,
    timers,
    cleared,
    state,
    tapSave: () => click("mw-menu-save-quit"),
    tapAbandon: () => click("mw-menu-abandon"),
    fire(id) {
      const t = timers.get(id);
      timers.delete(id);
      t.fn();
    },
  };
}

test("(1) BEHAVIOUR: SAVE & QUIT stops propagation, closes the menu (select), then calls window.mzAbandonRun", () => {
  const q = quitRows();
  const ev = q.tapSave();
  assert.equal(ev.stopped, true, "the container's bubble select never sees the tap");
  assert.deepStrictEqual(q.log, ["select", "mzAbandonRun"]);
});

test("(2) BEHAVIOUR: the first ABANDON tap only arms — no select, no abandon, data-armed 1, one ABANDON_ARM_MS (3000 ms) timer, propagation stopped (the menu stays open)", () => {
  const q = quitRows();
  const ev = q.tapAbandon();
  assert.equal(ev.stopped, true);
  assert.deepStrictEqual(q.log, []);
  assert.equal(q.rows["mw-menu-abandon"].dataset.armed, "1");
  assert.equal(q.timers.size, 1);
  assert.equal([...q.timers.values()][0].ms, 3000);
  assert.equal(ABANDON_ARM_MS, 3000);
});

test("(3) BEHAVIOUR: a second tap while armed clears the timer, closes the menu, then buries the hero (select, then mzAbandonCharacter)", () => {
  const q = quitRows();
  q.tapAbandon();
  const [timerId] = [...q.timers.keys()];
  q.tapAbandon();
  assert.ok(q.cleared.includes(timerId), "the arm timer is cleared");
  assert.equal(q.timers.size, 0);
  assert.deepStrictEqual(q.log, ["select", "mzAbandonCharacter"]);
  assert.equal(q.rows["mw-menu-abandon"].dataset.armed, "0");
});

test("(4) BEHAVIOUR: the arm expires — the timer disarms the row, and the next tap arms again, never abandons", () => {
  const q = quitRows();
  q.tapAbandon();
  const [timerId] = [...q.timers.keys()];
  q.fire(timerId);
  assert.equal(q.rows["mw-menu-abandon"].dataset.armed, "0");
  q.tapAbandon();
  assert.deepStrictEqual(q.log, [], "the tap after expiry only re-arms");
  assert.equal(q.rows["mw-menu-abandon"].dataset.armed, "1");
});

test("(5) BEHAVIOUR: a row disarmed by the menu closing (setHudMenuOpen writes data-armed 0) arms again on the next tap", () => {
  const q = quitRows();
  q.tapAbandon();
  q.rows["mw-menu-abandon"].dataset.armed = "0"; // what setHudMenuOpen(false) writes
  q.tapAbandon();
  assert.deepStrictEqual(q.log, []);
  assert.equal(q.rows["mw-menu-abandon"].dataset.armed, "1");
});

test("(6) BEHAVIOUR: with Settings › Confirm before quit Off, one tap closes the menu, then buries the hero; no timer is started", () => {
  const q = quitRows({ confirmBeforeQuit: false });
  q.tapAbandon();
  assert.deepStrictEqual(q.log, ["select", "mzAbandonCharacter"]);
  assert.equal(q.timers.size, 0);
  assert.equal(q.rows["mw-menu-abandon"].dataset.armed, "0");
});

test("(7) BEHAVIOUR: with the hero dead the row is NEW CHARACTER — armed or not, a tap closes the menu, then calls mzStartRoll, never mzAbandonCharacter", () => {
  for (const armed of ["0", "1"]) {
    const q = quitRows({ dead: true });
    q.rows["mw-menu-abandon"].dataset.armed = armed;
    q.tapAbandon();
    assert.deepStrictEqual(q.log, ["select", "mzStartRoll"], `armed ${armed}`);
    assert.equal(q.rows["mw-menu-abandon"].dataset.armed, "0");
  }
});

test("(8) BEHAVIOUR: re-arming clears the previous timer, so only one arm window is ever pending", () => {
  const q = quitRows();
  q.tapAbandon();
  const [first] = [...q.timers.keys()];
  q.fire(first); // expired: disarmed
  q.tapAbandon(); // arms again (a new timer)
  q.rows["mw-menu-abandon"].dataset.armed = "0"; // the menu closed and reopened
  const [second] = [...q.timers.keys()];
  q.tapAbandon(); // arms again: the second timer is cleared first
  assert.ok(q.cleared.includes(second), "the pending timer is cleared before re-arming");
  assert.equal(q.timers.size, 1);
  assert.deepStrictEqual(q.log, []);
});

// ─── D-07: the close-first helper ─────────────────────────────────────────

test("(9) BEHAVIOUR + SOURCE (D-07): closeMenuThen(fn) raises select, then runs fn with the click's arguments; the four legacy rows pass their existing handlers through it", () => {
  const region = sliceBetween(CODE, "function closeMenuThen(fn) {", '\ndocument.getElementById("mw-hud-menu-btn").onclick');
  const order = [];
  const closeMenuThen = new Function("hudMenuEvent", region + "\nreturn closeMenuThen;")((kind) => order.push(kind));
  const handler = closeMenuThen((...args) => {
    order.push("fn");
    return args;
  });
  assert.deepStrictEqual(handler("evt"), ["evt"]);
  assert.deepStrictEqual(order, ["select", "fn"]);

  assert.match(CODE, /document\.getElementById\("mw-chip-marks"\)\.addEventListener\("click", closeMenuThen\(openMarksLegend\)\);/);
  assert.match(CODE, /document\.getElementById\("mw-chip-centre"\)\.addEventListener\("click", closeMenuThen\(glideCenterMap\)\);/);
  assert.match(CODE, /document\.getElementById\("btn-camp"\)\.onclick = closeMenuThen\(openCampSheet\);/);
  assert.match(MODULE, /document\.getElementById\("mw-gear-btn"\)\?\.addEventListener\("click", closeMenuThen\(openSettingsSheet\)\);/);
  // closeMenuThen is a hoisted classic declaration, defined once, directly
  // after hudMenuEvent; the container's bubble select stays as the net.
  assert.equal(CODE.split("function closeMenuThen(").length - 1, 1);
  assert.ok(CODE.indexOf("function hudMenuEvent(") < CODE.indexOf("function closeMenuThen("));
  assert.match(CODE, /document\.getElementById\("mw-hud-menu"\)\.onclick = \(\) => hudMenuEvent\("select"\);/);
});

// ─── mzAbandonRun: the dead-state Save & quit ruling ─────────────────────

test("(10) BEHAVIOUR: window.mzAbandonRun opens the title with allowResume = hasActiveDelveSave() (true alive, false dead), no dialog, no dispatch, no state write", () => {
  const region = sliceBetween(MODULE, "window.mzAbandonRun = function saveAndQuit() {", "\n  };") + "\n  };";
  for (const alive of [true, false]) {
    const calls = [];
    const win = {
      confirm: () => {
        calls.push("confirm");
        return true;
      },
      __mzState: { set: () => calls.push("stateSet") },
    };
    new Function(
      "window",
      "showTitleScreen",
      "hasActiveDelveSave",
      "dispatchWithNarration",
      region,
    )(
      win,
      (opts) => calls.push(["title", opts]),
      () => alive,
      () => calls.push("dispatch"),
    );
    win.mzAbandonRun();
    assert.deepStrictEqual(calls, [["title", { allowResume: alive }]], `alive ${alive}`);
  }
});

// ─── source pins ──────────────────────────────────────────────────────────

test("(11) SOURCE: no confirm dialog anywhere in the comment-stripped shell; mzAbandonCharacter keeps its hasActiveDelveSave() guard and the engine's abandon dispatch; the quit rows' wiring is in the module script only", () => {
  assert.doesNotMatch(CODE, /(?:^|[^\w.])confirm\(/m, "no bare confirm(...) call");
  assert.doesNotMatch(CODE, /\.confirm\(/, "no window.confirm(...) call");
  const abandon = sliceBetween(MODULE, "window.mzAbandonCharacter = function abandonCharacter() {", "\n  };");
  assert.match(abandon, /if \(!hasActiveDelveSave\(\)\) return;/);
  assert.match(abandon, /dispatchWithNarration\(\{ type: "abandon" \}\)/);
  assert.match(abandon, /window\.__mzState\.set\(state\);/);
  assert.match(abandon, /showTitleScreen\(\);/);
  assert.doesNotMatch(abandon, /shouldConfirmQuit/, "the confirm gate moved to the row");
  // shouldConfirmQuit is still imported and used by the row.
  assert.match(MODULE, /confirm: shouldConfirmQuit\(currentSettings\),/);
  const classic = CODE.slice(0, CODE.indexOf('<script type="module">'));
  for (const id of ["mw-menu-save-quit", "mw-menu-abandon"]) {
    assert.equal(MODULE.split(`document.getElementById("${id}")?.addEventListener("click"`).length - 1, 1, `#${id} wired once, in the module`);
  }
  assert.doesNotMatch(classic, /getElementById\("mw-menu-(?:save-quit|abandon)"\)\??\.(?:onclick|addEventListener)/, "the classic script wires neither quit row");
  // The module imports the reducer and the arm window in place on the
  // existing hudMenu.js line.
  assert.equal(HTML.split('from "./src/browser/hudMenu.js";').length - 1, 1);
  assert.match(HTML, /import \{ hudMenuNext, abandonRowNext, ABANDON_ARM_MS \} from "\.\/src\/browser\/hudMenu\.js";/);
});
