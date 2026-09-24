// test/unit/accountChip-dom.test.js
//
// Phase 67 (ACCT-01/02, PGS-02), Plan 07 Task 1 — recordingDom tests of the
// account chip and sheet renderers (renderAccountChip, renderAccountSheet)
// against views built by the REAL src/browser/account.js view model for each
// status, so the renderer is proven against the live contract rather than a
// hand-copied shape. Mirrors boardsPanel-dom.test.js's comment-stripped
// source-pin approach (stripJs from tools/ident-sweep.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { ACCOUNT_CLASSES, renderAccountChip, renderAccountSheet } from "../../src/browser/accountChip.js";
import { accountChipView, accountSheetView } from "../../src/browser/account.js";
import { ACCOUNT_COPY } from "../../content/account.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_PATH = path.join(REPO_ROOT, "src", "browser", "accountChip.js");
const MODULE_SRC = fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

const PLAYER = Object.freeze({ id: "p-1", displayName: "Hilda Ferrow" });
const STATES = Object.freeze({
  signedIn: { compete: true, status: "signedIn", player: PLAYER },
  signedOut: { compete: true, status: "signedOut" },
  pending: { compete: true, status: "pending" },
  off: { compete: false, status: "off" },
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

// ─── the chip ────────────────────────────────────────────────────────────

test("chip, avatar (hand-built view): one .mw-acct-face with data-state avatar, aria-hidden, inline background and the initials; aria-label set", () => {
  const { button } = freshButton();
  const view = { face: "avatar", initials: "HF", bg: "#5c4a6b", glyph: "", label: "Play Games account: Hilda Ferrow" };
  renderAccountChip(button, view);
  const fs1 = faces(button);
  assert.equal(fs1.length, 1);
  const face = fs1[0];
  assert.equal(face.dataset.state, "avatar");
  assert.equal(face.getAttribute("aria-hidden"), "true");
  assert.equal(face.style.background, "#5c4a6b");
  assert.equal(face.children.length, 1);
  assert.ok(hasClass(face.children[0], "mw-acct-initials"));
  assert.equal(face.children[0].textContent, "HF");
  assert.equal(button.getAttribute("aria-label"), "Play Games account: Hilda Ferrow");
});

test("chip: rendering nobody after avatar keeps the same face element, clears the background and shows the ? glyph", () => {
  const { button } = freshButton();
  renderAccountChip(button, accountChipView(STATES.signedIn));
  const face = faces(button)[0];
  renderAccountChip(button, accountChipView(STATES.signedOut));
  assert.equal(faces(button).length, 1);
  assert.strictEqual(faces(button)[0], face, "face element identity is preserved across renders");
  assert.equal(face.dataset.state, "nobody");
  assert.equal(face.style.background, "");
  assert.equal(face.children.length, 1);
  assert.ok(hasClass(face.children[0], "mw-acct-glyph"));
  assert.equal(face.children[0].textContent, "?");
  assert.equal(button.getAttribute("aria-label"), ACCOUNT_COPY.chipLabel.signedOut);
});

test("chip: pending gives data-state pending with the glyph; Compete OFF gives nobody with its own label", () => {
  const { button } = freshButton();
  renderAccountChip(button, accountChipView(STATES.pending));
  const face = faces(button)[0];
  assert.equal(face.dataset.state, "pending");
  assert.equal(face.querySelector(".mw-acct-glyph").textContent, "?");
  assert.equal(button.getAttribute("aria-label"), ACCOUNT_COPY.chipLabel.pending);

  renderAccountChip(button, accountChipView(STATES.off));
  assert.equal(face.dataset.state, "nobody");
  assert.equal(button.getAttribute("aria-label"), ACCOUNT_COPY.chipLabel.off);
});

test("chip: the real signed-in view paints the initials and the hashed colour", () => {
  const { button } = freshButton();
  const view = accountChipView(STATES.signedIn);
  renderAccountChip(button, view);
  const face = faces(button)[0];
  assert.equal(face.querySelector(".mw-acct-initials").textContent, view.initials);
  assert.equal(face.style.background, view.bg);
  assert.ok(view.bg, "the real view carries a colour");
  assert.equal(button.getAttribute("aria-label"), view.label);
});

test("chip: a button whose static markup already holds a .mw-acct-face is reused, not duplicated", () => {
  const { document, button } = freshButton();
  const staticFace = document.createElement("span");
  staticFace.className = "mw-acct-face";
  staticFace.dataset.state = "nobody";
  const glyph = document.createElement("span");
  glyph.className = "mw-acct-glyph";
  glyph.textContent = "?";
  staticFace.appendChild(glyph);
  button.appendChild(staticFace);

  renderAccountChip(button, accountChipView(STATES.signedIn));
  assert.equal(faces(button).length, 1);
  assert.strictEqual(faces(button)[0], staticFace);
  assert.equal(staticFace.dataset.state, "avatar");
  assert.equal(staticFace.querySelector(".mw-acct-glyph"), null, "the stale glyph is replaced");
});

test("chip: a null button is a no-op", () => {
  assert.doesNotThrow(() => renderAccountChip(null, accountChipView(STATES.signedOut)));
  assert.doesNotThrow(() => renderAccountChip(undefined, accountChipView(STATES.signedOut)));
});

// ─── the sheet ───────────────────────────────────────────────────────────

test("sheet, signed out: title, then identity, a signIn action, no help, the Compete row (ON active) and Settings, in order", () => {
  const { rows, title } = freshSheet();
  const view = accountSheetView(STATES.signedOut);
  renderAccountSheet({ rows, title }, view, {});
  assert.equal(title.textContent, view.title);

  const kids = rows.children;
  assert.equal(kids.length, 4);
  const [id, action, row, settings] = kids;

  assert.ok(hasClass(id, "mw-acct-id"));
  assert.ok(hasClass(id.children[0], "mw-acct-face"));
  assert.equal(id.children[0].dataset.state, "nobody");
  assert.equal(id.children[0].getAttribute("aria-hidden"), "true");
  assert.ok(hasClass(id.children[1], "mw-acct-id-text"));
  assert.equal(id.children[1].querySelector(".mw-acct-name").textContent, view.identity.name);
  assert.equal(id.children[1].querySelector(".mw-acct-status").textContent, view.identity.status);

  assert.ok(hasClass(action, "mw-acct-action"));
  assert.equal(action.tagName, "button");
  assert.equal(action.type, "button");
  assert.equal(action.dataset.action, "signIn");
  assert.equal(action.textContent, ACCOUNT_COPY.sheet.signIn);
  assert.equal(action.disabled, false);

  assert.equal(rows.querySelector(".mw-acct-help"), null);

  assert.ok(hasClass(row, "mw-acct-row"));
  assert.equal(row.querySelector(".mw-acct-label").textContent, view.compete.label);
  const opts = row.querySelector(".mw-acct-options").querySelectorAll(".mw-acct-opt");
  assert.equal(opts.length, 2);
  assert.equal(opts[0].dataset.value, "true");
  assert.equal(opts[1].dataset.value, "false");
  assert.equal(opts[0].type, "button");
  assert.equal(opts[0].textContent, ACCOUNT_COPY.sheet.on);
  assert.equal(opts[1].textContent, ACCOUNT_COPY.sheet.off);
  assert.ok(hasClass(opts[0], "active"));
  assert.equal(opts[0].getAttribute("aria-pressed"), "true");
  assert.ok(!hasClass(opts[1], "active"));
  assert.equal(opts[1].getAttribute("aria-pressed"), "false");

  assert.ok(hasClass(settings, "mw-acct-settings"));
  assert.equal(settings.tagName, "button");
  assert.equal(settings.type, "button");
  assert.equal(settings.textContent, view.settings.label);
});

test("sheet, signed in: the avatar identity, a stopCompeting action and the helper line", () => {
  const { rows, title } = freshSheet();
  const view = accountSheetView(STATES.signedIn);
  renderAccountSheet({ rows, title }, view, {});
  const id = rows.querySelector(".mw-acct-id");
  const face = id.querySelector(".mw-acct-face");
  assert.equal(face.dataset.state, "avatar");
  assert.equal(face.style.background, view.identity.bg);
  assert.equal(face.querySelector(".mw-acct-initials").textContent, view.identity.initials);
  assert.equal(id.querySelector(".mw-acct-name").textContent, "Hilda Ferrow");
  const action = rows.querySelector(".mw-acct-action");
  assert.equal(action.dataset.action, "stopCompeting");
  assert.equal(action.textContent, ACCOUNT_COPY.sheet.stopCompeting);
  const help = rows.querySelector(".mw-acct-help");
  assert.ok(help);
  assert.equal(help.textContent, ACCOUNT_COPY.sheet.stopHelp);
  // order: id, action, help, row, settings
  assert.deepEqual(
    rows.children.map((c) => c.className.split(/\s+/)[0]),
    ["mw-acct-id", "mw-acct-action", "mw-acct-help", "mw-acct-row", "mw-acct-settings"],
  );
});

test("sheet, pending: a disabled SIGNING IN action with data-action pending and the pending face", () => {
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.pending), {});
  const action = rows.querySelector(".mw-acct-action");
  assert.equal(action.dataset.action, "pending");
  assert.equal(action.disabled, true);
  assert.equal(action.textContent, ACCOUNT_COPY.sheet.signingIn);
  assert.equal(rows.querySelector(".mw-acct-face").dataset.state, "pending");
  assert.equal(rows.querySelector(".mw-acct-help"), null);
});

test("sheet, Compete OFF: no action row, the off help, and the OFF option active", () => {
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.off), {});
  assert.equal(rows.querySelector(".mw-acct-action"), null);
  assert.equal(rows.querySelector(".mw-acct-help").textContent, ACCOUNT_COPY.sheet.offHelp);
  const opts = rows.querySelectorAll(".mw-acct-opt");
  assert.ok(!hasClass(opts[0], "active"));
  assert.equal(opts[0].getAttribute("aria-pressed"), "false");
  assert.ok(hasClass(opts[1], "active"));
  assert.equal(opts[1].getAttribute("aria-pressed"), "true");
  assert.equal(rows.querySelector(".mw-acct-status").textContent, ACCOUNT_COPY.sheet.status.off);
});

test("sheet handlers: signIn → onSignIn, stopCompeting → onStopCompeting, options → onCompete(value), settings → onSettings", () => {
  const h = { onSignIn: spy(), onStopCompeting: spy(), onCompete: spy(), onSettings: spy() };
  const { rows, title } = freshSheet();

  renderAccountSheet({ rows, title }, accountSheetView(STATES.signedOut), h);
  rows.querySelector(".mw-acct-action").onclick();
  assert.equal(h.onSignIn.calls.length, 1);
  assert.equal(h.onStopCompeting.calls.length, 0);
  const opts = rows.querySelectorAll(".mw-acct-opt");
  opts[0].onclick();
  opts[1].onclick();
  assert.deepEqual(h.onCompete.calls, [[true], [false]]);
  rows.querySelector(".mw-acct-settings").onclick();
  assert.equal(h.onSettings.calls.length, 1);

  renderAccountSheet({ rows, title }, accountSheetView(STATES.signedIn), h);
  rows.querySelector(".mw-acct-action").onclick();
  assert.equal(h.onStopCompeting.calls.length, 1);
  assert.equal(h.onSignIn.calls.length, 1);
});

test("sheet handlers: a pending or disabled action calls nothing", () => {
  const h = { onSignIn: spy(), onStopCompeting: spy(), onCompete: spy(), onSettings: spy() };
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.pending), h);
  const action = rows.querySelector(".mw-acct-action");
  if (typeof action.onclick === "function") action.onclick();
  // a hand-built disabled signIn action is also inert
  const view = { ...accountSheetView(STATES.signedOut), action: { id: "signIn", label: "SIGN IN", disabled: true } };
  renderAccountSheet({ rows, title }, view, h);
  const disabled = rows.querySelector(".mw-acct-action");
  assert.equal(disabled.disabled, true);
  if (typeof disabled.onclick === "function") disabled.onclick();
  assert.equal(h.onSignIn.calls.length, 0);
  assert.equal(h.onStopCompeting.calls.length, 0);
});

test("sheet handlers: missing handlers never throw (no handlers argument at all, or an empty object)", () => {
  for (const status of Object.keys(STATES)) {
    const { rows, title } = freshSheet();
    const view = accountSheetView(STATES[status]);
    renderAccountSheet({ rows, title }, view);
    for (const btn of [
      rows.querySelector(".mw-acct-action"),
      ...rows.querySelectorAll(".mw-acct-opt"),
      rows.querySelector(".mw-acct-settings"),
    ]) {
      if (btn && typeof btn.onclick === "function") assert.doesNotThrow(() => btn.onclick());
    }
  }
});

test("sheet: a missing title element is tolerated", () => {
  const { rows } = freshSheet();
  assert.doesNotThrow(() => renderAccountSheet({ rows, title: null }, accountSheetView(STATES.signedOut), {}));
  assert.equal(rows.children.length, 4);
});

test("sheet: a re-render replaces the rows, never duplicating them", () => {
  const { rows, title } = freshSheet();
  renderAccountSheet({ rows, title }, accountSheetView(STATES.signedIn), {});
  renderAccountSheet({ rows, title }, accountSheetView(STATES.signedIn), {});
  renderAccountSheet({ rows, title }, accountSheetView(STATES.signedOut), {});
  assert.equal(rows.querySelectorAll(".mw-acct-id").length, 1);
  assert.equal(rows.querySelectorAll(".mw-acct-action").length, 1);
  assert.equal(rows.querySelectorAll(".mw-acct-row").length, 1);
  assert.equal(rows.querySelectorAll(".mw-acct-settings").length, 1);
  assert.equal(rows.querySelectorAll(".mw-acct-help").length, 0);
});

// ─── the class contract ──────────────────────────────────────────────────

test("ACCOUNT_CLASSES is the frozen, pinned list (identical to 67-05's account-layout RENDERER_CLASSES)", () => {
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

test("ACCOUNT_CLASSES completeness: every class emitted across four sheet states and both chip faces is listed, and every listed class is emitted", () => {
  const emitted = new Set();
  for (const status of Object.keys(STATES)) {
    const { rows, title } = freshSheet();
    renderAccountSheet({ rows, title }, accountSheetView(STATES[status]), {});
    for (const child of rows.children) classesUnder(child, emitted);
  }
  for (const status of ["signedIn", "signedOut"]) {
    const { button } = freshButton();
    renderAccountChip(button, accountChipView(STATES[status]));
    for (const child of button.children) classesUnder(child, emitted);
  }
  // "active" is a state modifier on .mw-acct-opt, not a contract class.
  emitted.delete("active");
  for (const cls of emitted) assert.ok(ACCOUNT_CLASSES.includes(cls), `emitted class not in ACCOUNT_CLASSES: ${cls}`);
  for (const cls of ACCOUNT_CLASSES) assert.ok(emitted.has(cls), `ACCOUNT_CLASSES entry never emitted: ${cls}`);
});

// ─── source pins ─────────────────────────────────────────────────────────

test("source pins: no document./window./globalThis., no HTML-string assignment, no content/ import, no storage, no network identifier, no plugin name", () => {
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
  assert.doesNotMatch(STRIPPED, /capacitor-play-games/);
});

test("source pins: the renderer exports are present exactly once", () => {
  assert.equal((MODULE_SRC.match(/export const ACCOUNT_CLASSES/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export function renderAccountChip/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export function renderAccountSheet/g) || []).length, 1);
});
