// test/unit/account.test.js
//
// Phase 85 (ACCT-03/05, 85-CONTEXT group 1), Plan 03 Task 1 — pins
// src/browser/account.js, the account chip/menu/sheet's pure view model for
// our own board: normalizeAccountState (compete/handle/erase/welcomed), the
// chip and ☰ faces (pending/avatar/nobody), the sheet's identity/compete/
// help/reroll/erase rows, the two handle-bearing rail cards plus the
// token-free failure card, totality over malformed input, and purity
// (comment-stripped source pins, the boardsPanel-dom.test.js way).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  normalizeAccountState,
  accountChipView,
  accountMenuView,
  accountSheetView,
  accountCard,
} from "../../src/browser/account.js";
import { ACCOUNT_COPY } from "../../content/account.js";
import { HUD_MENU_GLYPH } from "../../src/browser/hudMenu.js";
import { avatarColour, handleInitials } from "../../src/browser/leaderboardView.js";
import { isValidHandle } from "../../src/browser/handles.js";
import { RAIL_HOLD, RAIL_TONES } from "../../src/browser/rail.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MODULE_PATH = path.resolve(__dirname, "..", "..", "src", "browser", "account.js");
const MODULE_SRC = fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

/** Recursively freeze a plain object tree. */
function deepFreeze(o) {
  if (o && typeof o === "object") {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

/** Every nested object in a tree, the root included. */
function objectsIn(o, p = "view") {
  if (o === null || typeof o !== "object") return [];
  const out = [[p, o]];
  for (const [k, v] of Object.entries(o)) out.push(...objectsIn(v, `${p}.${k}`));
  return out;
}

function assertDeepFrozen(o, label) {
  for (const [p, x] of objectsIn(o, label)) assert.ok(Object.isFrozen(x), `${p} should be frozen`);
}

// "lantern" + "jaw" and "soot" + "boot" are both real HANDLE_FIRST/SECOND pairs (content/handles.js).
const HANDLE = "@lanternjaw";
assert.ok(isValidHandle(HANDLE), "test fixture HANDLE must be a real rolled handle");

const MALFORMED = [
  null, undefined, 0, 42, NaN, "handle", true, [], [1, 2, 3], {}, Object.create(null),
  { compete: "yes" }, { handle: "not-a-handle" }, { handle: "@lantern" }, { erase: "explode" }, { welcomed: "true" },
];

// ─── normalizeAccountState ─────────────────────────────────────────────────

test("normalize: compete is true unless exactly false", () => {
  assert.equal(normalizeAccountState({}).compete, true);
  assert.equal(normalizeAccountState({ compete: 0 }).compete, true);
  assert.equal(normalizeAccountState({ compete: "false" }).compete, true);
  assert.equal(normalizeAccountState({ compete: null }).compete, true);
  assert.equal(normalizeAccountState({ compete: false }).compete, false);
});

test("normalize: handle is a valid rolled handle, or null", () => {
  assert.equal(normalizeAccountState({ handle: HANDLE }).handle, HANDLE);
  for (const bad of [null, undefined, "", "lanternjaw", "@lantern", "@lanternjawx", "@nope nope", 42, {}]) {
    assert.equal(normalizeAccountState({ handle: bad }).handle, null, JSON.stringify(bad));
  }
});

test("normalize: erase is idle/armed/busy; anything else reads as idle", () => {
  for (const v of ["idle", "armed", "busy"]) assert.equal(normalizeAccountState({ erase: v }).erase, v);
  for (const v of [undefined, null, "weird", 1, {}]) assert.equal(normalizeAccountState({ erase: v }).erase, "idle");
});

test("normalize: welcomed is true only when exactly true", () => {
  assert.equal(normalizeAccountState({ welcomed: true }).welcomed, true);
  for (const w of [1, "true", undefined, null, {}]) assert.equal(normalizeAccountState({ welcomed: w }).welcomed, false);
});

test("normalize: every malformed input returns a frozen, well-formed state without throwing", () => {
  for (const input of MALFORMED) {
    const s = normalizeAccountState(input);
    assert.ok(Object.isFrozen(s));
    assert.deepStrictEqual(Object.keys(s).sort(), ["compete", "erase", "handle", "welcomed"]);
    assert.equal(typeof s.compete, "boolean");
    assert.ok(s.handle === null || typeof s.handle === "string");
    assert.ok(["idle", "armed", "busy"].includes(s.erase));
    assert.equal(typeof s.welcomed, "boolean");
  }
  const hostile = new Proxy({}, { get() { throw new Error("boom"); } });
  assert.doesNotThrow(() => normalizeAccountState(hostile));
  assert.equal(normalizeAccountState(hostile).handle, null);
});

// ─── accountChipView ────────────────────────────────────────────────────────

test("chip: no handle yet gives the pending face, whatever Compete reads", () => {
  for (const compete of [true, false]) {
    const v = accountChipView({ compete, handle: null });
    assert.deepStrictEqual({ ...v }, { face: "pending", initials: "", bg: "", glyph: "?", label: ACCOUNT_COPY.chipLabel.pending });
  }
});

test("chip: Compete ON with a handle gives the initials avatar and the handle's own label", () => {
  const v = accountChipView({ compete: true, handle: HANDLE });
  assert.equal(v.face, "avatar");
  assert.equal(v.initials, handleInitials(HANDLE));
  assert.equal(v.bg, avatarColour(HANDLE));
  assert.equal(v.glyph, "");
  assert.equal(v.label, ACCOUNT_COPY.chipLabel.on.replace("{handle}", HANDLE));
});

test("chip: Compete OFF with a handle gives the dim nobody glyph and the off label, never the handle itself", () => {
  const v = accountChipView({ compete: false, handle: HANDLE });
  assert.deepStrictEqual({ ...v }, { face: "nobody", initials: "", bg: "", glyph: "?", label: ACCOUNT_COPY.chipLabel.off });
  assert.doesNotMatch(v.label, new RegExp(HANDLE.slice(1)));
});

test("chip: the three states give three distinct accessible labels", () => {
  const labels = [
    accountChipView({ compete: true, handle: null }).label,
    accountChipView({ compete: true, handle: HANDLE }).label,
    accountChipView({ compete: false, handle: HANDLE }).label,
  ];
  assert.equal(new Set(labels).size, 3);
});

// ─── accountMenuView ────────────────────────────────────────────────────────

test("menu: Compete ON with a handle wears the same avatar the chip does, labelled with the handle", () => {
  const v = accountMenuView({ compete: true, handle: HANDLE });
  const chip = accountChipView({ compete: true, handle: HANDLE });
  assert.equal(v.face, "avatar");
  assert.equal(v.initials, chip.initials);
  assert.equal(v.bg, chip.bg);
  assert.equal(v.label, ACCOUNT_COPY.menuLabel.on.replace("{handle}", HANDLE));
});

test("menu: no handle yet, or Compete OFF, wears the plain ☰ labelled Menu", () => {
  for (const state of [{ compete: true, handle: null }, { compete: false, handle: null }, { compete: false, handle: HANDLE }]) {
    const v = accountMenuView(state);
    assert.deepStrictEqual({ ...v }, { face: "menu", initials: "", bg: "", glyph: HUD_MENU_GLYPH, label: "Menu" });
  }
});

test("menu: total over malformed input, frozen, and never the avatar without Compete ON and a handle", () => {
  for (const input of MALFORMED) {
    let v;
    assert.doesNotThrow(() => { v = accountMenuView(input); });
    assertDeepFrozen(v, "menu");
    assert.ok(["avatar", "menu"].includes(v.face));
    if (v.face === "menu") assert.equal(v.glyph, HUD_MENU_GLYPH);
  }
});

// ─── accountSheetView ───────────────────────────────────────────────────────

function assertCommonSheet(v, competeOn) {
  assert.equal(v.title, "ACCOUNT");
  assert.equal(v.compete.label, "COMPETE");
  assert.equal(v.compete.on, competeOn);
  assert.deepStrictEqual(v.compete.options.map((o) => ({ ...o })), [{ value: true, label: "ON" }, { value: false, label: "OFF" }]);
  assert.deepStrictEqual({ ...v.settings }, { label: "SETTINGS" });
  assert.deepStrictEqual(Object.keys(v).sort(), ["compete", "erase", "help", "identity", "reroll", "settings", "title"]);
  assert.deepStrictEqual(Object.keys(v.identity).sort(), ["bg", "face", "glyph", "initials", "name", "status"]);
}

test("sheet: no handle yet — pending identity, disabled reroll and erase, the on-help line", () => {
  const v = accountSheetView({ compete: true, handle: null });
  assertCommonSheet(v, true);
  assert.equal(v.identity.face, "pending");
  assert.equal(v.identity.name, ACCOUNT_COPY.sheet.pending);
  assert.equal(v.identity.status, ACCOUNT_COPY.sheet.status.pending);
  assert.deepStrictEqual({ ...v.reroll }, { id: "reroll", label: "RE-ROLL HANDLE", disabled: true });
  assert.equal(v.erase.disabled, true);
  assert.equal(v.help, ACCOUNT_COPY.sheet.onHelp);
});

test("sheet: a handle with Compete ON — avatar identity ON THE BOARD, reroll enabled, erase enabled when idle", () => {
  const v = accountSheetView({ compete: true, handle: HANDLE, erase: "idle" });
  assertCommonSheet(v, true);
  assert.equal(v.identity.face, "avatar");
  assert.equal(v.identity.initials, handleInitials(HANDLE));
  assert.equal(v.identity.bg, avatarColour(HANDLE));
  assert.equal(v.identity.name, HANDLE);
  assert.equal(v.identity.status, ACCOUNT_COPY.sheet.status.on);
  assert.deepStrictEqual({ ...v.reroll }, { id: "reroll", label: "RE-ROLL HANDLE", disabled: false });
  assert.deepStrictEqual({ ...v.erase }, { id: "erase", label: "ERASE MY RUNS", armed: false, disabled: false });
  assert.equal(v.help, ACCOUNT_COPY.sheet.onHelp);
});

test("sheet: a handle with Compete OFF — the handle's avatar still shows (85-CONTEXT: yours either way), COMPETE OFF status, erase disabled, the off-help line", () => {
  const v = accountSheetView({ compete: false, handle: HANDLE });
  assertCommonSheet(v, false);
  assert.equal(v.identity.face, "avatar");
  assert.equal(v.identity.name, HANDLE);
  assert.equal(v.identity.status, ACCOUNT_COPY.sheet.status.off);
  assert.equal(v.reroll.disabled, false, "re-roll stays available with Compete off");
  assert.equal(v.erase.disabled, true, "erase needs Compete on");
  assert.equal(v.help, ACCOUNT_COPY.sheet.offHelp);
});

test("sheet: erase armed/busy change only the erase row's label and flags", () => {
  const armed = accountSheetView({ compete: true, handle: HANDLE, erase: "armed" });
  assert.deepStrictEqual({ ...armed.erase }, { id: "erase", label: "TAP AGAIN TO ERASE", armed: true, disabled: false });
  const busy = accountSheetView({ compete: true, handle: HANDLE, erase: "busy" });
  assert.deepStrictEqual({ ...busy.erase }, { id: "erase", label: ACCOUNT_COPY.sheet.erasing, armed: false, disabled: true });
});

test("sheet: every view is deep-frozen", () => {
  for (const s of [{ compete: true, handle: null }, { compete: true, handle: HANDLE }, { compete: false, handle: HANDLE }]) {
    assertDeepFrozen(accountSheetView(s), "sheet");
  }
});

// ─── accountCard ────────────────────────────────────────────────────────────

test("card: welcome names the handle, tone odd, held for RAIL_HOLD.floor", () => {
  const c = accountCard("welcome", HANDLE);
  assert.equal(c.title, ACCOUNT_COPY.cards.welcome.title);
  assert.equal(c.line, ACCOUNT_COPY.cards.welcome.line.replace("{handle}", HANDLE));
  assert.equal(c.tone, "odd");
  assert.equal(c.hold, RAIL_HOLD.floor);
  assert.ok(Object.isFrozen(c));
  assert.ok(RAIL_TONES.includes(c.tone));
});

test("card: erased names the handle, tone dull, held for RAIL_HOLD.default", () => {
  const c = accountCard("erased", HANDLE);
  assert.equal(c.line, ACCOUNT_COPY.cards.erased.line.replace("{handle}", HANDLE));
  assert.equal(c.tone, "dull");
  assert.equal(c.hold, RAIL_HOLD.default);
  assert.ok(RAIL_TONES.includes(c.tone));
});

test("card: eraseFailed carries no handle token, tone dull, held for RAIL_HOLD.default", () => {
  const c = accountCard("eraseFailed");
  assert.deepStrictEqual({ ...c }, { ...ACCOUNT_COPY.cards.eraseFailed, tone: "dull", hold: RAIL_HOLD.default });
  assert.ok(Object.isFrozen(c));
});

test("card: welcome/erased with an invalid handle, or any other kind, gives null", () => {
  for (const kind of ["welcome", "erased"]) {
    for (const bad of [null, undefined, "", "not-a-handle", "lanternjaw"]) {
      assert.equal(accountCard(kind, bad), null, `${kind}(${bad})`);
    }
  }
  for (const k of [undefined, null, "", "toString", "constructor", "WELCOME", 1, {}, []]) {
    assert.equal(accountCard(k, HANDLE), null, String(k));
  }
});

// ─── totality and purity ───────────────────────────────────────────────────

test("every view is total over malformed input and returns deep-frozen results", () => {
  for (const input of MALFORMED) {
    for (const [name, fn] of [["chip", accountChipView], ["sheet", accountSheetView], ["menu", accountMenuView]]) {
      let v;
      assert.doesNotThrow(() => { v = fn(input); }, `${name}(${JSON.stringify(input) ?? typeof input})`);
      assertDeepFrozen(v, name);
    }
  }
});

test("deep-frozen inputs are never mutated, and equal inputs give deepStrictEqual views", () => {
  const state = { compete: true, handle: HANDLE, erase: "idle", welcomed: true };
  const frozen = deepFreeze(structuredClone(state));
  const copy = structuredClone(state);
  for (const fn of [normalizeAccountState, accountChipView, accountSheetView, accountMenuView]) {
    assert.doesNotThrow(() => fn(frozen));
    assert.deepStrictEqual(fn(frozen), fn(copy));
  }
  assert.deepStrictEqual(frozen, state);
  assert.deepStrictEqual(accountCard("welcome", HANDLE), accountCard("welcome", HANDLE));
});

test("source: imports the avatar helpers from leaderboardView.js, isValidHandle from handles.js, and the copy from content/account.js", () => {
  assert.match(STRIPPED, /from\s*"\.\/leaderboardView\.js"/);
  assert.match(STRIPPED, /from\s*"\.\/handles\.js"/);
  assert.match(STRIPPED, /from\s*"\.\.\/\.\.\/content\/account\.js"/);
  assert.doesNotMatch(STRIPPED, />>>\s*0/, "the avatar hash is imported, never re-implemented");
});

test("source: no DOM, storage, clock, randomness or network reference", () => {
  for (const re of [/\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /\bmzStorage\b/, /\bDate\./, /\bnew Date\b/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(STRIPPED, re, `account.js must not reference ${re}`);
  }
});

test("source: no Play-Games or sign-in/sign-out wording anywhere in the file, including comments", () => {
  assert.doesNotMatch(MODULE_SRC, /play[ _-]?games/i);
  assert.doesNotMatch(MODULE_SRC, /\bsign(s|ed|ing)?[ -]?(in|out)\b/i);
});

test("source: handleInitials is used at least once", () => {
  assert.ok((MODULE_SRC.match(/handleInitials/g) || []).length >= 1);
});
