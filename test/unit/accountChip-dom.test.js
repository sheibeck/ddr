// test/unit/accountChip-dom.test.js
//
// Phase 85 (ACCT-03/05, 85-CONTEXT group 1), Plan 03 Task 2 — recordingDom
// tests of the account renderers (renderAccountChip, renderAccountSheet,
// renderMenuFace, renderAccountMenu) against views built by the REAL
// src/browser/account.js view model, mirroring boardsPanel-dom.test.js's
// comment-stripped source-pin approach (stripJs from tools/ident-sweep.mjs).
// Replaces every test of the retired sign-on flow (the SIGN IN/STOP
// COMPETING action row, its own accessible labels and its D-04/D-11 rail
// cards) with the reroll/erase row pair for our own board.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import {
  ACCOUNT_CLASSES,
  ERASE_ARM_MS,
  renderAccountChip,
  renderAccountSheet,
  renderMenuFace,
  renderAccountMenu,
} from "../../src/browser/accountChip.js";
import { accountChipView, accountSheetView, accountMenuView } from "../../src/browser/account.js";
import { HUD_MENU_GLYPH, ABANDON_ARM_MS } from "../../src/browser/hudMenu.js";
import { ACCOUNT_COPY } from "../../content/account.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_PATH = path.join(REPO_ROOT, "src", "browser", "accountChip.js");
const MODULE_SRC = fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

const HANDLE = "@lanternjaw";
const STATES = Object.freeze({
  pending: { compete: true, handle: null },
  onIdle: { compete: true, handle: HANDLE, erase: "idle" },
  onArmed: { compete: true, handle: HANDLE, erase: "armed" },
  off: { compete: false, handle: HANDLE },
});

function spy() {
  const fn = (...args) => fn.calls.push(args);
  fn.calls = [];
  return fn;
}

function freshButton() {
  const { document } = createRecordingDocument();
  const button = document.createElement("button");
  return { document, button };
}

function freshSheet() {
  const { document } = createRecordingDocument();
  const rows = document.createElement("div");
  const title = document.createElement("span");
  return { document, rows, title };
}

function faces(button) {
  return button.children.filter((c) => /\bmw-acct-face\b/.test(c.className || ""));
}

/** Every class token emitted anywhere under `root` (root included). */
function classesUnder(root, out = new Set()) {
  for (const tok of (root.className || "").split(/\s+/).filter(Boolean)) out.add(tok);
  for (const child of root.children || []) if (child.nodeType !== 3) classesUnder(child, out);
  return out;
}

function hasClass(el, cls) {
  return (el.className || "").split(/\s+/).includes(cls);
}

/** byAction(root, action) — the .mw-acct-action button with data-action === action (recordingDom has no attribute-selector support). */
function byAction(root, action) {
  return root.querySelectorAll(".mw-acct-action").find((b) => b.dataset.action === action);
}

// ─── ERASE_ARM_MS ──────────────────────────────────────────────────────────

test("ERASE_ARM_MS equals hudMenu.js's ABANDON_ARM_MS", () => {
  assert.equal(ERASE_ARM_MS, ABANDON_ARM_MS);
});

// ─── the chip ────────────────────────────────────────────────────────────

test("chip, avatar (hand-built view): one .mw-acct-face with data-state avatar, aria-hidden, inline background and the initials; aria-label set", () => {
  const { button } = freshButton();
  const view = { face: "avatar", initials: "LJ", bg: "#5c4a6b", glyph: "", label: "Account: @lanternjaw" };
  renderAccountChip(button, view);
  const fs1 = faces(button);
  assert.equal(fs1.length, 1);
  const face = fs1[0];
  assert.equal(face.dataset.state, "avatar");
  assert.equal(face.getAttribute("aria-hidden"), "true");
  assert.equal(face.style.background, "#5c4a6b");
  assert.equal(face.children.length, 1);
  assert.ok(hasClass(face.children[0], "mw-acct-initials"));
  assert.equal(face.children[0].textContent, "LJ");
  assert.equal(button.getAttribute("aria-label"), "Account: @lanternjaw");
});

test("chip: rendering pending after avatar keeps the same face element, clears the background and shows the ? glyph", () => {
  const { button } = freshButton();
  renderAccountChip(button, accountChipView(STATES.onIdle));
  const face = faces(button)[0];
  renderAccountChip(button, accountChipView(STATES.pending));
  assert.equal(faces(button).length, 1);
  assert.strictEqual(faces(button)[0], face, "face element identity is preserved across renders");
  assert.equal(face.dataset.state, "pending");
  assert.equal(face.style.background, "");
  assert.equal(face.children.length, 1);
  assert.ok(hasClass(face.children[0], "mw-acct-glyph"));
  assert.equal(face.children[0].textContent, "?");
});

test("chip: Compete OFF gives the nobody face with its own label; the real avatar view paints the initials and hashed colour", () => {
  const { button } = freshButton();
  renderAccountChip(button, accountChipView(STATES.off));
  const face = faces(button)[0];
  assert.equal(face.dataset.state, "nobody");
  assert.equal(button.getAttribute("aria-label"), ACCOUNT_COPY.chipLabel.off);

  const view = accountChipView(STATES.onIdle);
  renderAccountChip(button, view);
  assert.equal(faces(button)[0].querySelector(".mw-acct-initials").textContent, view.initials);
  assert.equal(faces(button)[0].style.background, view.bg);
  assert.ok(view.bg);
  assert.equal(button.getAttribute("aria-label"), view.label);
});

test("chip: a button whose static markup already holds a .mw-acct-face is reused, not duplicated", () => {
  const { document, button } = freshButton();
  const staticFace = document.createElement("span");
  staticFace.className = "mw-acct-face";
  staticFace.dataset.state = "pending";
  const glyph = document.createElement("span");
  glyph.className = "mw-acct-glyph";
  glyph.textContent = "?";
  staticFace.appendChild(glyph);
  button.appendChild(staticFace);

  renderAccountChip(button, accountChipView(STATES.onIdle));
  assert.equal(faces(button).length, 1);
  assert.strictEqual(faces(button)[0], staticFace);
  assert.equal(staticFace.dataset.state, "avatar");
  assert.equal(staticFace.querySelector(".mw-acct-glyph"), null, "the stale glyph is replaced");
});

test("chip: a null button is a no-op", () => {
  assert.doesNotThrow(() => renderAccountChip(null, accountChipView(STATES.off)));
  assert.doesNotThrow(() => renderAccountChip(undefined, accountChipView(STATES.off)));
});

// ─── the sheet ───────────────────────────────────────────────────────────

test("sheet, no handle yet: identity, the Compete row, the on-help line, reroll and erase both disabled, then Settings, in order", () => {
  const { rows, title } = freshSheet();
  const view = accountSheetView(STATES.pending);
  renderAccountSheet({ rows, title }, view, {});
  assert.equal(title.textContent, view.title);

  const kids = rows.children;
  assert.deepEqual(kids.map((c) => c.className.split(/\s+/)[0]), ["mw-acct-id", "mw-acct-row", "mw-acct-help", "mw-acct-action", "mw-acct-action", "mw-acct-settings"]);
  const [id, row, help, reroll, erase, settings] = kids;

  assert.ok(hasClass(id, "mw-acct-id"));
  assert.equal(id.children[0].dataset.state, "pending");
  assert.equal(id.children[0].getAttribute("aria-hidden"), "true");
  assert.equal(id.children[1].querySelector(".mw-acct-name").textContent, view.identity.name);
  assert.equal(id.children[1].querySelector(".mw-acct-status").textContent, view.identity.status);

  assert.ok(hasClass(row, "mw-acct-row"));
  assert.equal(help.textContent, view.help);

  assert.equal(reroll.tagName, "button");
  assert.equal(reroll.type, "button");
  assert.equal(reroll.dataset.action, "reroll");
  assert.equal(reroll.textContent, ACCOUNT_COPY.sheet.reroll);
  assert.equal(reroll.disabled, true);

  assert.equal(erase.dataset.action, "erase");
  assert.equal(erase.dataset.armed, "0");
  assert.equal(erase.disabled, true);
  assert.equal(erase.textContent, ACCOUNT_COPY.sheet.erase);

  assert.ok(hasClass(settings, "mw-acct-settings"));
  assert.equal(settings.tagName, "button");
  assert.equal(settings.type, "button");
  assert.equal(settings.textContent, view.settings.label);
});

test("sheet, a handle with Compete ON, erase idle: the avatar identity, reroll and erase both enabled, armed=0", () => {
  const { rows, title } = freshSheet();
  const view = accountSheetView(STATES.onIdle);
  renderAccountSheet({ rows, title }, view, {});
  const reroll = byAction(rows, "reroll");
  const erase = byAction(rows, "erase");
  assert.equal(reroll.disabled, false);
  assert.equal(erase.disabled, false);
  assert.equal(erase.dataset.armed, "0");
  assert.equal(erase.textContent, ACCOUNT_COPY.sheet.erase);
  const id = rows.querySelector(".mw-acct-id");
  const face = id.querySelector(".mw-acct-face");
  assert.equal(face.dataset.state, "avatar");
  assert.equal(face.style.background, view.identity.bg);
  assert.equal(face.querySelector(".mw-acct-initials").textContent, view.identity.initials);
  assert.equal(id.querySelector(".mw-acct-name").textContent, HANDLE);
  assert.equal(id.querySelector(".mw-acct-status").textContent, ACCOUNT_COPY.sheet.status.on);
});

test("sheet, erase armed: the erase button reads TAP AGAIN TO ERASE with armed=1, still enabled", () => {
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.onArmed), {});
  const erase = byAction(rows, "erase");
  assert.equal(erase.textContent, ACCOUNT_COPY.sheet.eraseArmed);
  assert.equal(erase.dataset.armed, "1");
  assert.equal(erase.disabled, false);
});

test("sheet, Compete OFF: the handle's avatar still shows, erase disabled, the off-help line, OFF active", () => {
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.off), {});
  const id = rows.querySelector(".mw-acct-id");
  assert.equal(id.querySelector(".mw-acct-face").dataset.state, "avatar");
  assert.equal(id.querySelector(".mw-acct-name").textContent, HANDLE);
  assert.equal(id.querySelector(".mw-acct-status").textContent, ACCOUNT_COPY.sheet.status.off);
  const opts = rows.querySelectorAll(".mw-acct-opt");
  assert.ok(!hasClass(opts[0], "active"));
  assert.ok(hasClass(opts[1], "active"));
  assert.equal(opts[1].getAttribute("aria-pressed"), "true");
  assert.equal(byAction(rows, "erase").disabled, true);
  assert.equal(byAction(rows, "reroll").disabled, false, "re-roll stays available with Compete off");
  assert.equal(rows.querySelector(".mw-acct-help").textContent, ACCOUNT_COPY.sheet.offHelp);
});

test("sheet handlers: the click event is handed to each handler as the trailing argument", () => {
  const h = { onCompete: spy(), onReroll: spy(), onErase: spy(), onSettings: spy() };
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.onIdle), h);

  byAction(rows, "reroll").onclick({ tag: "reroll-evt" });
  assert.deepEqual(h.onReroll.calls, [[{ tag: "reroll-evt" }]]);

  byAction(rows, "erase").onclick({ tag: "erase-evt" });
  assert.deepEqual(h.onErase.calls, [[{ tag: "erase-evt" }]]);

  const opts = rows.querySelectorAll(".mw-acct-opt");
  opts[0].onclick({ tag: "on-evt" });
  opts[1].onclick({ tag: "off-evt" });
  assert.deepEqual(h.onCompete.calls, [[true, { tag: "on-evt" }], [false, { tag: "off-evt" }]]);

  rows.querySelector(".mw-acct-settings").onclick({ tag: "settings-evt" });
  assert.deepEqual(h.onSettings.calls, [[{ tag: "settings-evt" }]]);
});

test("sheet handlers: a disabled reroll/erase button calls nothing; missing handlers never throw", () => {
  const h = { onReroll: spy(), onErase: spy() };
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.pending), h);
  byAction(rows, "reroll").onclick();
  byAction(rows, "erase").onclick();
  assert.equal(h.onReroll.calls.length, 0);
  assert.equal(h.onErase.calls.length, 0);

  for (const status of Object.keys(STATES)) {
    const { rows: r2, title: t2 } = freshSheet();
    const view = accountSheetView(STATES[status]);
    renderAccountSheet({ rows: r2, title: t2 }, view);
    for (const btn of [...r2.querySelectorAll(".mw-acct-action"), ...r2.querySelectorAll(".mw-acct-opt"), r2.querySelector(".mw-acct-settings")]) {
      if (btn && typeof btn.onclick === "function") assert.doesNotThrow(() => btn.onclick());
    }
  }
});

test("sheet: a missing title element is tolerated", () => {
  const { rows } = freshSheet();
  assert.doesNotThrow(() => renderAccountSheet({ rows, title: null }, accountSheetView(STATES.onIdle), {}));
  assert.equal(rows.children.length, 6);
});

test("sheet: a re-render replaces the rows, never duplicating them", () => {
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.onIdle), {});
  renderAccountSheet({ rows, title }, accountSheetView(STATES.onIdle), {});
  renderAccountSheet({ rows, title }, accountSheetView(STATES.pending), {});
  assert.equal(rows.querySelectorAll(".mw-acct-id").length, 1);
  assert.equal(rows.querySelectorAll(".mw-acct-action").length, 2);
  assert.equal(rows.querySelectorAll(".mw-acct-row").length, 1);
  assert.equal(rows.querySelectorAll(".mw-acct-settings").length, 1);
});

// ─── the ☰ face (unchanged contract) ──────────────────────────────────────

/** A ☰ button shaped like the shell's static markup: one .mw-hud-menu-face holding the glyph. */
function freshMenuButton() {
  const { document } = createRecordingDocument();
  const button = document.createElement("button");
  button.className = "mw-hud-menu-btn";
  button.setAttribute("aria-label", "Menu");
  const face = document.createElement("span");
  face.className = "mw-hud-menu-face";
  face.setAttribute("aria-hidden", "true");
  face.textContent = HUD_MENU_GLYPH;
  button.appendChild(face);
  return { document, button, face };
}

test("menu face: the avatar view reuses .mw-hud-menu-face and paints one initials child on the hashed colour", () => {
  const { button, face } = freshMenuButton();
  const view = accountMenuView(STATES.onIdle);
  renderMenuFace(button, view);
  assert.equal(button.children.length, 1, "no face is added");
  assert.strictEqual(button.children[0], face);
  assert.equal(face.dataset.state, "avatar");
  assert.equal(face.getAttribute("aria-hidden"), "true");
  assert.equal(face.children.length, 1);
  assert.ok(hasClass(face.children[0], "mw-acct-initials"));
  assert.equal(face.children[0].textContent, view.initials);
  assert.equal(face.style.background, view.bg);
  assert.ok(view.bg);
  assert.equal(button.getAttribute("aria-label"), view.label);
});

test("menu face: no handle or Compete OFF shows only the ☰ text, clears the background, labels Menu", () => {
  const { button, face } = freshMenuButton();
  renderMenuFace(button, accountMenuView(STATES.onIdle));
  for (const status of ["pending", "off"]) {
    renderMenuFace(button, accountMenuView(STATES[status]));
    assert.strictEqual(button.querySelector(".mw-hud-menu-face"), face);
    assert.equal(face.dataset.state, "menu");
    assert.equal(face.getAttribute("aria-hidden"), "true");
    assert.equal(face.children.filter((c) => c.nodeType !== 3).length, 0, `${status}: no element children`);
    assert.equal(face.textContent, HUD_MENU_GLYPH);
    assert.equal(face.style.background, "");
    assert.equal(button.getAttribute("aria-label"), "Menu");
    renderMenuFace(button, accountMenuView(STATES.onIdle));
    assert.equal(face.dataset.state, "avatar");
    assert.equal(face.querySelectorAll(".mw-acct-initials").length, 1);
  }
});

test("menu face: a null button, a null view or a button with no .mw-hud-menu-face is a no-op that creates nothing", () => {
  assert.doesNotThrow(() => renderMenuFace(null, accountMenuView(STATES.onIdle)));
  assert.doesNotThrow(() => renderMenuFace(undefined, accountMenuView(STATES.onIdle)));
  const { button, face } = freshMenuButton();
  assert.doesNotThrow(() => renderMenuFace(button, null));
  assert.equal(face.dataset.state, undefined);
  assert.equal(button.getAttribute("aria-label"), "Menu");
  const bare = freshButton().button;
  bare.setAttribute("aria-label", "Menu");
  assert.doesNotThrow(() => renderMenuFace(bare, accountMenuView(STATES.onIdle)));
  assert.equal(bare.children.length, 0, "nothing is created");
  assert.equal(bare.getAttribute("aria-label"), "Menu", "the label is left alone");
});

// ─── the ACCOUNT block in the ☰ dropdown ──────────────────────────────────

function freshHost() {
  const { document } = createRecordingDocument();
  return { document, host: document.createElement("div") };
}

const firstClass = (c) => (c.className || "").split(/\s+/)[0];

test("account menu: each status draws identity, Compete, the help line, then reroll and erase — no title, no Settings", () => {
  const expected = {
    pending: ["mw-acct-id", "mw-acct-row", "mw-acct-help", "mw-acct-action", "mw-acct-action"],
    onIdle: ["mw-acct-id", "mw-acct-row", "mw-acct-help", "mw-acct-action", "mw-acct-action"],
    onArmed: ["mw-acct-id", "mw-acct-row", "mw-acct-help", "mw-acct-action", "mw-acct-action"],
    off: ["mw-acct-id", "mw-acct-row", "mw-acct-help", "mw-acct-action", "mw-acct-action"],
  };
  for (const [status, order] of Object.entries(expected)) {
    const { host } = freshHost();
    const view = accountSheetView(STATES[status]);
    renderAccountMenu(host, view, {});
    assert.deepEqual(host.children.map(firstClass), order, status);
    assert.equal(host.querySelector(".mw-acct-settings"), null, `${status}: no Settings row`);
    assert.equal(host.querySelector(".mw-acct-name").textContent, view.identity.name);
    assert.equal(host.querySelector(".mw-acct-status").textContent, view.identity.status);
    for (const c of host.children) assert.notEqual(c.textContent, view.title, `${status}: no title row`);
  }
});

test("account menu: onCompete/onReroll/onErase receive the event; missing handlers never throw", () => {
  const h = { onCompete: spy(), onReroll: spy(), onErase: spy() };
  const { host } = freshHost();
  renderAccountMenu(host, accountSheetView(STATES.onIdle), h);
  byAction(host, "reroll").onclick({ tag: "r" });
  byAction(host, "erase").onclick({ tag: "e" });
  assert.deepEqual(h.onReroll.calls, [[{ tag: "r" }]]);
  assert.deepEqual(h.onErase.calls, [[{ tag: "e" }]]);
  const opts = host.querySelectorAll(".mw-acct-opt");
  opts[0].onclick({ tag: "c" });
  assert.deepEqual(h.onCompete.calls, [[true, { tag: "c" }]]);

  for (const status of Object.keys(STATES)) {
    for (const handlers of [undefined, null, {}]) {
      const { host: bare } = freshHost();
      assert.doesNotThrow(() => renderAccountMenu(bare, accountSheetView(STATES[status]), handlers));
      for (const btn of [...bare.querySelectorAll(".mw-acct-action"), ...bare.querySelectorAll(".mw-acct-opt")]) {
        if (btn && typeof btn.onclick === "function") assert.doesNotThrow(() => btn.onclick());
      }
    }
  }
});

test("account menu: a disabled reroll/erase calls nothing", () => {
  const h = { onReroll: spy(), onErase: spy() };
  const { host } = freshHost();
  renderAccountMenu(host, accountSheetView(STATES.pending), h);
  byAction(host, "reroll").onclick();
  byAction(host, "erase").onclick();
  assert.equal(h.onReroll.calls.length, 0);
  assert.equal(h.onErase.calls.length, 0);
});

test("account menu: a re-render replaces the rows, never duplicating them; a null host or view is a no-op", () => {
  const { host } = freshHost();
  renderAccountMenu(host, accountSheetView(STATES.onIdle), {});
  renderAccountMenu(host, accountSheetView(STATES.onIdle), {});
  renderAccountMenu(host, accountSheetView(STATES.pending), {});
  assert.equal(host.querySelectorAll(".mw-acct-id").length, 1);
  assert.equal(host.querySelectorAll(".mw-acct-action").length, 2);
  assert.equal(host.querySelectorAll(".mw-acct-row").length, 1);
  assert.doesNotThrow(() => renderAccountMenu(null, accountSheetView(STATES.onIdle), {}));
  assert.doesNotThrow(() => renderAccountMenu(undefined, accountSheetView(STATES.onIdle), {}));
  const before = host.children.length;
  assert.doesNotThrow(() => renderAccountMenu(host, null, {}));
  assert.equal(host.children.length, before, "a null view leaves the rows alone");
});

// ─── the class contract ──────────────────────────────────────────────────

test("ACCOUNT_CLASSES is the frozen, pinned list (unchanged from Phase 67)", () => {
  assert.ok(Object.isFrozen(ACCOUNT_CLASSES));
  assert.deepEqual(
    [...ACCOUNT_CLASSES],
    [
      "mw-acct-face", "mw-acct-initials", "mw-acct-glyph", "mw-acct-id", "mw-acct-id-text",
      "mw-acct-name", "mw-acct-status", "mw-acct-action", "mw-acct-help", "mw-acct-row",
      "mw-acct-label", "mw-acct-options", "mw-acct-opt", "mw-acct-settings",
    ],
  );
});

test("ACCOUNT_CLASSES completeness: every class emitted across every sheet state and both chip faces is listed, and every listed class is emitted", () => {
  const emitted = new Set();
  for (const status of Object.keys(STATES)) {
    const { rows, title } = freshSheet();
    renderAccountSheet({ rows, title }, accountSheetView(STATES[status]), {});
    for (const child of rows.children) classesUnder(child, emitted);
  }
  for (const status of ["onIdle", "off"]) {
    const { button } = freshButton();
    renderAccountChip(button, accountChipView(STATES[status]));
    for (const child of button.children) classesUnder(child, emitted);
  }
  for (const status of Object.keys(STATES)) {
    const { host } = freshHost();
    renderAccountMenu(host, accountSheetView(STATES[status]), {});
    for (const child of host.children) classesUnder(child, emitted);
    const { face, button } = freshMenuButton();
    renderMenuFace(button, accountMenuView(STATES[status]));
    for (const child of face.children) if (child.nodeType !== 3) classesUnder(child, emitted);
  }
  // "active" is a state modifier on .mw-acct-opt, not a contract class.
  emitted.delete("active");
  for (const cls of emitted) assert.ok(ACCOUNT_CLASSES.includes(cls), `emitted class not in ACCOUNT_CLASSES: ${cls}`);
  for (const cls of ACCOUNT_CLASSES) assert.ok(emitted.has(cls), `ACCOUNT_CLASSES entry never emitted: ${cls}`);
});

// ─── source pins ─────────────────────────────────────────────────────────

test("source pins: no document./window./globalThis., no HTML-string assignment, no content/ import, no storage, no network identifier, no retired provider/plugin wording", () => {
  assert.doesNotMatch(STRIPPED, /\bdocument\./);
  assert.doesNotMatch(STRIPPED, /\bwindow\./);
  assert.doesNotMatch(STRIPPED, /\bglobalThis\./);
  assert.doesNotMatch(STRIPPED, /\.(innerHTML|outerHTML)\s*=/);
  assert.doesNotMatch(STRIPPED, /insertAdjacentHTML/);
  assert.doesNotMatch(STRIPPED, /from\s+["'][^"']*\/content\//);
  for (const ident of ["localStorage", "mzStorage", "Preferences"]) {
    assert.doesNotMatch(STRIPPED, new RegExp(`\\b${ident}\\b`), `unexpected storage identifier: ${ident}`);
  }
  for (const ident of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon"]) {
    assert.doesNotMatch(STRIPPED, new RegExp(`\\b${ident}\\b`), `unexpected network identifier: ${ident}`);
  }
  assert.doesNotMatch(MODULE_SRC, /play[ _-]?games/i);
  assert.doesNotMatch(MODULE_SRC, /provider/i);
  assert.doesNotMatch(MODULE_SRC, /\bsignIn\b/);
  assert.doesNotMatch(MODULE_SRC, /\bstopCompeting\b/);
  assert.doesNotMatch(MODULE_SRC, /capacitor-play-games/);
});

test("source pins: the renderer exports, ERASE_ARM_MS and the controller export are present exactly once", () => {
  assert.equal((MODULE_SRC.match(/export const ACCOUNT_CLASSES/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export const ERASE_ARM_MS/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export function renderAccountChip/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export function renderAccountSheet/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export function renderMenuFace\b/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export function renderAccountMenu\b/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export function createAccountController/g) || []).length, 1);
});
