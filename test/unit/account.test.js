// test/unit/account.test.js
//
// Phase 85 (ACCT-03/05) and Phase 91.2 (BOARD-31/33, D-03, D-10, D-11) — pins
// src/browser/account.js, the account chip/menu/sheet's pure view model for
// our own board: normalizeAccountState (compete/name/signin/erase/welcomed),
// the chip and ☰ faces (pending/avatar/nobody), the sheet's identity/compete/
// help/SIGN IN/erase rows, the rail cards, totality over malformed input, and
// purity (comment-stripped source pins, the boardsPanel-dom.test.js way).

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
import { avatarColour, nameInitials } from "../../src/browser/leaderboardView.js";
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

const NAME = "Moss Knuckle";

const MALFORMED = [
  null, undefined, 0, 42, NaN, "name", true, [], [1, 2, 3], {}, Object.create(null),
  { compete: "yes" }, { name: 7 }, { name: "   " }, { signin: "maybe" }, { erase: "explode" }, { welcomed: "true" },
];

// ─── normalizeAccountState ─────────────────────────────────────────────────

test("normalize: compete is true unless exactly false", () => {
  assert.equal(normalizeAccountState({}).compete, true);
  assert.equal(normalizeAccountState({ compete: 0 }).compete, true);
  assert.equal(normalizeAccountState({ compete: "false" }).compete, true);
  assert.equal(normalizeAccountState({ compete: null }).compete, true);
  assert.equal(normalizeAccountState({ compete: false }).compete, false);
});

test("normalize: name is a cleaned board name, or null", () => {
  assert.equal(normalizeAccountState({ name: NAME }).name, NAME);
  assert.equal(normalizeAccountState({ name: "  Moss   Knuckle  " }).name, NAME);
  for (const bad of [null, undefined, "", "   ", 42, {}, []]) {
    assert.equal(normalizeAccountState({ name: bad }).name, null, JSON.stringify(bad));
  }
});

test("normalize: signin is one of the five states; anything else reads as unknown", () => {
  for (const v of ["unknown", "in", "out", "busy", "unavailable"]) assert.equal(normalizeAccountState({ signin: v }).signin, v);
  for (const v of [undefined, null, "weird", 1, {}, "IN"]) assert.equal(normalizeAccountState({ signin: v }).signin, "unknown");
  assert.equal(normalizeAccountState({}).signin, "unknown");
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
    assert.deepStrictEqual(Object.keys(s).sort(), ["canSignIn", "compete", "erase", "name", "signin", "welcomed"]);
    assert.equal(typeof s.canSignIn, "boolean");
    assert.equal(typeof s.compete, "boolean");
    assert.ok(s.name === null || typeof s.name === "string");
    assert.ok(["unknown", "in", "out", "busy", "unavailable"].includes(s.signin));
    assert.ok(["idle", "armed", "busy"].includes(s.erase));
    assert.equal(typeof s.welcomed, "boolean");
  }
  const hostile = new Proxy({}, { get() { throw new Error("boom"); } });
  assert.doesNotThrow(() => normalizeAccountState(hostile));
  assert.equal(normalizeAccountState(hostile).name, null);
});

// ─── accountChipView ────────────────────────────────────────────────────────

test("chip: no name yet gives the pending face, whatever Compete reads", () => {
  for (const compete of [true, false]) {
    const v = accountChipView({ compete, name: null });
    assert.deepStrictEqual({ ...v }, { face: "pending", initials: "", bg: "", glyph: "?", label: ACCOUNT_COPY.chipLabel.pending });
  }
});

test("chip: Compete ON with a name gives the initials avatar and the name's own label", () => {
  const v = accountChipView({ compete: true, name: NAME });
  assert.equal(v.face, "avatar");
  assert.equal(v.initials, nameInitials(NAME));
  assert.equal(v.initials, "MK");
  assert.equal(v.bg, avatarColour(NAME));
  assert.equal(v.glyph, "");
  assert.equal(v.label, ACCOUNT_COPY.chipLabel.on.replace("{name}", NAME));
});

test("chip: Compete OFF with a name gives the dim nobody glyph and the off label, never the name itself", () => {
  const v = accountChipView({ compete: false, name: NAME });
  assert.deepStrictEqual({ ...v }, { face: "nobody", initials: "", bg: "", glyph: "?", label: ACCOUNT_COPY.chipLabel.off });
  assert.doesNotMatch(v.label, /Moss/);
});

test("chip: the three states give three distinct accessible labels", () => {
  const labels = [
    accountChipView({ compete: true, name: null }).label,
    accountChipView({ compete: true, name: NAME }).label,
    accountChipView({ compete: false, name: NAME }).label,
  ];
  assert.equal(new Set(labels).size, 3);
});

test("chip: a name carrying a $-pattern is filled literally", () => {
  const v = accountChipView({ compete: true, name: "Cash$&Money" });
  assert.equal(v.label, "Account: Cash$&Money");
});

// ─── accountMenuView ────────────────────────────────────────────────────────

test("menu: Compete ON with a name wears the same avatar the chip does, labelled with the name", () => {
  const v = accountMenuView({ compete: true, name: NAME });
  const chip = accountChipView({ compete: true, name: NAME });
  assert.equal(v.face, "avatar");
  assert.equal(v.initials, chip.initials);
  assert.equal(v.bg, chip.bg);
  assert.equal(v.label, ACCOUNT_COPY.menuLabel.on.replace("{name}", NAME));
});

test("menu: no name yet, or Compete OFF, wears the plain ☰ labelled Menu", () => {
  for (const state of [{ compete: true, name: null }, { compete: false, name: null }, { compete: false, name: NAME }]) {
    const v = accountMenuView(state);
    assert.deepStrictEqual({ ...v }, { face: "menu", initials: "", bg: "", glyph: HUD_MENU_GLYPH, label: "Menu" });
  }
});

test("menu: total over malformed input, frozen, and never the avatar without Compete ON and a name", () => {
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
  assert.deepStrictEqual(Object.keys(v).sort(), ["compete", "erase", "help", "identity", "settings", "signIn", "title"]);
  assert.deepStrictEqual(Object.keys(v.identity).sort(), ["bg", "face", "glyph", "initials", "name", "status"]);
  assert.equal("reroll" in v, false, "no re-roll row (D-11)");
}

const S = ACCOUNT_COPY.sheet;

test("sheet: no name yet — pending identity, erase disabled, no SIGN IN row while the state is unknown", () => {
  const v = accountSheetView({ compete: true, name: null });
  assertCommonSheet(v, true);
  assert.equal(v.identity.face, "pending");
  assert.equal(v.identity.name, S.pending);
  assert.equal(v.identity.status, S.status.pending);
  assert.deepStrictEqual({ ...v.signIn }, { id: "signin", label: S.signin, visible: false, disabled: false });
  assert.equal(v.erase.disabled, true);
  assert.equal(v.help, S.onHelp);
});

test("sheet: a name with Compete ON and a signed-in player — avatar identity ON THE BOARD, erase enabled when idle", () => {
  const v = accountSheetView({ compete: true, name: NAME, signin: "in", erase: "idle" });
  assertCommonSheet(v, true);
  assert.equal(v.identity.face, "avatar");
  assert.equal(v.identity.initials, nameInitials(NAME));
  assert.equal(v.identity.bg, avatarColour(NAME));
  assert.equal(v.identity.name, NAME);
  assert.equal(v.identity.status, S.status.on);
  assert.equal(v.signIn.visible, false);
  assert.deepStrictEqual({ ...v.erase }, { id: "erase", label: "ERASE MY RUNS", armed: false, disabled: false });
  assert.equal(v.help, S.onHelp);
});

test("sheet: a name with Compete OFF — the avatar still shows, COMPETE OFF status, erase disabled, the off-help line, no SIGN IN row", () => {
  for (const signin of ["unknown", "in", "out", "busy", "unavailable"]) {
    const v = accountSheetView({ compete: false, name: NAME, signin });
    assertCommonSheet(v, false);
    assert.equal(v.identity.face, "avatar");
    assert.equal(v.identity.name, NAME);
    assert.equal(v.identity.status, S.status.off, `status with signin ${signin}`);
    assert.equal(v.signIn.visible, false, `no SIGN IN with Compete off (${signin})`);
    assert.equal(v.erase.disabled, true, "erase needs Compete on");
    assert.equal(v.help, S.offHelp);
  }
});

test("sheet: Compete ON signed out — NOT SIGNED IN and a visible, enabled SIGN IN WITH PLAY GAMES row", () => {
  const v = accountSheetView({ compete: true, name: null, signin: "out" });
  assert.equal(v.identity.status, S.status.signedOut);
  assert.deepStrictEqual({ ...v.signIn }, { id: "signin", label: "SIGN IN WITH PLAY GAMES", visible: true, disabled: false });
  assert.equal(v.erase.disabled, true, "no name, nothing to erase");
});

test("sheet: Compete ON, a cached name and signed out — the status still says NOT SIGNED IN, erase stays available", () => {
  const v = accountSheetView({ compete: true, name: NAME, signin: "out" });
  assert.equal(v.identity.status, S.status.signedOut);
  assert.equal(v.signIn.visible, true);
  assert.equal(v.erase.disabled, false);
});

test("sheet: signing in — the row shows SIGNING IN… and is disabled, the status says so", () => {
  const v = accountSheetView({ compete: true, name: null, signin: "busy" });
  assert.equal(v.identity.status, S.status.signingIn);
  assert.deepStrictEqual({ ...v.signIn }, { id: "signin", label: S.signingIn, visible: true, disabled: true });
});

test("sheet: Play Games unavailable — the status says so and the row stays offered", () => {
  const v = accountSheetView({ compete: true, name: null, signin: "unavailable" });
  assert.equal(v.identity.status, S.status.unavailable);
  assert.equal(v.signIn.visible, true);
  assert.equal(v.signIn.disabled, false);
});

test("92.1-01: normalize: canSignIn is true unless exactly false", () => {
  assert.equal(normalizeAccountState({}).canSignIn, true);
  for (const v of [undefined, null, 0, "false", {}]) assert.equal(normalizeAccountState({ canSignIn: v }).canSignIn, true, String(v));
  assert.equal(normalizeAccountState({ canSignIn: false }).canSignIn, false);
});

test("92.1-01: sheet: the SIGN IN row is hidden whenever sign-in cannot work, in every sign-in state", () => {
  for (const signin of ["unknown", "in", "out", "busy", "unavailable"]) {
    const v = accountSheetView({ compete: true, name: NAME, signin, canSignIn: false });
    assert.equal(v.signIn.visible, false, `no SIGN IN row when sign-in cannot work (${signin})`);
    const able = accountSheetView({ compete: true, name: NAME, signin, canSignIn: true });
    assert.equal(able.signIn.visible, signin === "out" || signin === "busy" || signin === "unavailable", `the row follows the sign-in state when able (${signin})`);
  }
});

test("sheet: erase armed/busy change only the erase row's label and flags", () => {
  const armed = accountSheetView({ compete: true, name: NAME, erase: "armed" });
  assert.deepStrictEqual({ ...armed.erase }, { id: "erase", label: "TAP AGAIN TO ERASE", armed: true, disabled: false });
  const busy = accountSheetView({ compete: true, name: NAME, erase: "busy" });
  assert.deepStrictEqual({ ...busy.erase }, { id: "erase", label: S.erasing, armed: false, disabled: true });
});

test("sheet: every view is deep-frozen", () => {
  for (const s of [{ compete: true, name: null }, { compete: true, name: NAME, signin: "out" }, { compete: false, name: NAME }]) {
    assertDeepFrozen(accountSheetView(s), "sheet");
  }
});

// ─── accountCard ────────────────────────────────────────────────────────────

test("card: welcome names the Play Games name, tone odd, held for RAIL_HOLD.floor", () => {
  const c = accountCard("welcome", NAME);
  assert.equal(c.title, ACCOUNT_COPY.cards.welcome.title);
  assert.equal(c.line, ACCOUNT_COPY.cards.welcome.line.replace("{name}", NAME));
  assert.match(c.line, /Moss Knuckle/);
  assert.equal(c.tone, "odd");
  assert.equal(c.hold, RAIL_HOLD.floor);
  assert.ok(Object.isFrozen(c));
  assert.ok(RAIL_TONES.includes(c.tone));
});

test("card: erased names the name, tone dull, held for RAIL_HOLD.default", () => {
  const c = accountCard("erased", NAME);
  assert.equal(c.line, ACCOUNT_COPY.cards.erased.line.replace("{name}", NAME));
  assert.equal(c.tone, "dull");
  assert.equal(c.hold, RAIL_HOLD.default);
  assert.ok(RAIL_TONES.includes(c.tone));
});

test("card: eraseFailed and signinNeeded carry no name token, tone dull, held for RAIL_HOLD.default", () => {
  for (const kind of ["eraseFailed", "signinNeeded"]) {
    const c = accountCard(kind);
    assert.deepStrictEqual({ ...c }, { ...ACCOUNT_COPY.cards[kind], tone: "dull", hold: RAIL_HOLD.default });
    assert.ok(Object.isFrozen(c));
    assert.ok(RAIL_TONES.includes(c.tone));
  }
  assert.match(accountCard("signinNeeded").line, /SIGN IN/);
});

test("92.1-01: card: signinUnavailable and signinFailed carry no name token, tone dull, held for RAIL_HOLD.default", () => {
  for (const kind of ["signinUnavailable", "signinFailed"]) {
    const c = accountCard(kind);
    assert.deepStrictEqual({ ...c }, { ...ACCOUNT_COPY.cards[kind], tone: "dull", hold: RAIL_HOLD.default });
    assert.ok(Object.isFrozen(c));
    assert.ok(RAIL_TONES.includes(c.tone));
  }
});

test("card: welcome/erased with no usable name, or any other kind, gives null", () => {
  for (const kind of ["welcome", "erased"]) {
    for (const bad of [null, undefined, "", "   ", 7, {}]) {
      assert.equal(accountCard(kind, bad), null, `${kind}(${bad})`);
    }
  }
  for (const k of [undefined, null, "", "toString", "constructor", "WELCOME", "reroll", 1, {}, []]) {
    assert.equal(accountCard(k, NAME), null, String(k));
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
  const state = { compete: true, name: NAME, signin: "out", erase: "idle", welcomed: true };
  const frozen = deepFreeze(structuredClone(state));
  const copy = structuredClone(state);
  for (const fn of [normalizeAccountState, accountChipView, accountSheetView, accountMenuView]) {
    assert.doesNotThrow(() => fn(frozen));
    assert.deepStrictEqual(fn(frozen), fn(copy));
  }
  assert.deepStrictEqual(frozen, state);
  assert.deepStrictEqual(accountCard("welcome", NAME), accountCard("welcome", NAME));
});

test("source: imports the avatar helpers from leaderboardView.js, the name cleaner from boardName.js and the copy from content/account.js", () => {
  assert.match(STRIPPED, /from\s*"\.\/leaderboardView\.js"/);
  assert.match(STRIPPED, /from\s*"\.\/boardName\.js"/);
  assert.match(STRIPPED, /from\s*"\.\.\/\.\.\/content\/account\.js"/);
  assert.doesNotMatch(STRIPPED, />>>\s*0/, "the avatar hash is imported, never re-implemented");
});

test("source: nothing imports the retired rolled-handle modules, comments included", () => {
  assert.doesNotMatch(MODULE_SRC, /handles\.js/);
  assert.doesNotMatch(MODULE_SRC, /isValidHandle|handleInitials/);
});

test("source: no DOM, storage, clock, randomness or network reference", () => {
  for (const re of [/\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /\bmzStorage\b/, /\bDate\./, /\bnew Date\b/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(STRIPPED, re, `account.js must not reference ${re}`);
  }
});

test("source: nameInitials is used at least once", () => {
  assert.ok((MODULE_SRC.match(/nameInitials/g) || []).length >= 1);
});
