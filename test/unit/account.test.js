// test/unit/account.test.js
//
// Phase 67 (ACCT-01/02), 67-03 Task 2 — pins src/browser/account.js, the
// account chip and sheet's pure view model: state normalization (Compete OFF
// always wins over a stale signed-in status), the chip's initials avatar vs
// the "nobody" glyph (D-07), the sheet's rows for every status (D-10), the
// D-03 helper line with no sign-out row, the D-04/D-11 rail cards, the
// Leaderboards identity input (D-08), totality over malformed input, and
// purity (comment-stripped source pins, the boardsPanel-dom.test.js way).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  ACCOUNT_STATUS,
  normalizeAccountState,
  accountChipView,
  accountSheetView,
  accountCard,
  accountIdentity,
} from "../../src/browser/account.js";
import { ACCOUNT_COPY } from "../../content/account.js";
import { avatarColour, initialsOf } from "../../src/browser/boardsView.js";
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

const HILDA = { id: "p-1", displayName: "Hilda Ferrow" };
const SIGNED_IN = { compete: true, status: "signedIn", player: HILDA, welcomed: true };
const SIGNED_OUT = { compete: true, status: "signedOut", player: null, welcomed: false };
const PENDING = { compete: true, status: "pending", player: null, welcomed: false };
const OFF = { compete: false, status: "off", player: null, welcomed: false };
const STALE_OFF = { compete: false, status: "signedIn", player: HILDA, welcomed: true };

const MALFORMED = [
  null,
  undefined,
  0,
  42,
  NaN,
  "signedIn",
  true,
  [],
  [1, 2, 3],
  {},
  { compete: "yes" },
  { compete: 0, status: "signedIn", player: HILDA },
  { status: 7 },
  { status: "weird" },
  { status: "signedIn", player: "Hilda" },
  { status: "signedIn", player: { id: 5, displayName: 9 } },
  { status: "signedIn", player: [] },
  { status: "signedIn", player: null },
  { status: "toString" },
  { welcomed: "true" },
  Object.create(null),
];

// ─── ACCOUNT_STATUS ────────────────────────────────────────────────────────

test("ACCOUNT_STATUS is the frozen four-status table", () => {
  assert.deepStrictEqual({ ...ACCOUNT_STATUS }, { OFF: "off", PENDING: "pending", SIGNED_IN: "signedIn", SIGNED_OUT: "signedOut" });
  assert.ok(Object.isFrozen(ACCOUNT_STATUS));
});

// ─── normalizeAccountState ─────────────────────────────────────────────────

test("normalize: compete is true unless exactly false", () => {
  assert.equal(normalizeAccountState({}).compete, true);
  assert.equal(normalizeAccountState({ compete: 0 }).compete, true);
  assert.equal(normalizeAccountState({ compete: "false" }).compete, true);
  assert.equal(normalizeAccountState({ compete: null }).compete, true);
  assert.equal(normalizeAccountState({ compete: false }).compete, false);
});

test("normalize: Compete OFF forces status off and player null, even over a stale signedIn", () => {
  const s = normalizeAccountState(STALE_OFF);
  assert.equal(s.compete, false);
  assert.equal(s.status, "off");
  assert.equal(s.player, null);
});

test("normalize: unknown, missing or contradictory status becomes signedOut with Compete ON", () => {
  for (const status of [undefined, null, 7, "weird", "SIGNEDIN", "toString", "off"]) {
    assert.equal(normalizeAccountState({ compete: true, status }).status, "signedOut", String(status));
  }
  assert.equal(normalizeAccountState({ status: "pending" }).status, "pending");
  assert.equal(normalizeAccountState({ status: "signedIn", player: HILDA }).status, "signedIn");
});

test("normalize: a player is kept only for signedIn, as a frozen { id, displayName } of strings", () => {
  const s = normalizeAccountState({ status: "signedIn", player: { id: "p-1", displayName: "Hilda Ferrow", extra: "x" } });
  assert.deepStrictEqual({ ...s.player }, { id: "p-1", displayName: "Hilda Ferrow" });
  assert.ok(Object.isFrozen(s.player));
  const odd = normalizeAccountState({ status: "signedIn", player: { id: 5, displayName: 9 } });
  assert.deepStrictEqual({ ...odd.player }, { id: "", displayName: "" });
  assert.equal(normalizeAccountState({ status: "signedOut", player: HILDA }).player, null);
  assert.equal(normalizeAccountState({ status: "pending", player: HILDA }).player, null);
});

test("normalize: signedIn with a missing player still carries an empty player (the unnamed fallback)", () => {
  const s = normalizeAccountState({ status: "signedIn", player: null });
  assert.equal(s.status, "signedIn");
  assert.deepStrictEqual({ ...s.player }, { id: "", displayName: "" });
});

test("normalize: welcomed is true only when exactly true", () => {
  assert.equal(normalizeAccountState({ welcomed: true }).welcomed, true);
  for (const w of [1, "true", undefined, null, {}]) assert.equal(normalizeAccountState({ welcomed: w }).welcomed, false);
});

test("normalize: every malformed input returns a frozen, well-formed state without throwing", () => {
  for (const input of MALFORMED) {
    const s = normalizeAccountState(input);
    assert.ok(Object.isFrozen(s));
    assert.deepStrictEqual(Object.keys(s).sort(), ["compete", "player", "status", "welcomed"]);
    assert.equal(typeof s.compete, "boolean");
    assert.ok(Object.values(ACCOUNT_STATUS).includes(s.status));
    assert.equal(typeof s.welcomed, "boolean");
  }
  const hostile = new Proxy({}, { get() { throw new Error("boom"); } });
  assert.doesNotThrow(() => normalizeAccountState(hostile));
  assert.equal(normalizeAccountState(hostile).status, "signedOut");
});

// ─── accountChipView ───────────────────────────────────────────────────────

test("chip: signed in gives the initials avatar from the display name", () => {
  const v = accountChipView(SIGNED_IN);
  assert.equal(v.face, "avatar");
  assert.equal(v.initials, "HF");
  assert.equal(v.initials, initialsOf("Hilda Ferrow"));
  assert.equal(v.bg, avatarColour("Hilda Ferrow"));
  assert.equal(v.glyph, "");
  assert.match(v.label, /Hilda Ferrow/);
  assert.equal(v.label, ACCOUNT_COPY.chipLabel.signedIn.replace("{name}", "Hilda Ferrow"));
});

test("chip: the display name is trimmed before initials, colour and label", () => {
  const v = accountChipView({ status: "signedIn", player: { id: "p", displayName: "  Hilda Ferrow  " } });
  assert.equal(v.bg, avatarColour("Hilda Ferrow"));
  assert.equal(v.label, ACCOUNT_COPY.chipLabel.signedIn.replace("{name}", "Hilda Ferrow"));
});

test("chip: signed in with an empty display name falls back to the unnamed line", () => {
  const unnamed = ACCOUNT_COPY.sheet.unnamed;
  for (const displayName of ["", "   "]) {
    const v = accountChipView({ status: "signedIn", player: { id: "p", displayName } });
    assert.equal(v.face, "avatar");
    assert.equal(v.initials, initialsOf(unnamed));
    assert.equal(v.bg, avatarColour(unnamed));
    assert.match(v.label, new RegExp(unnamed));
  }
});

test("chip: a name with $ patterns fills {name} literally", () => {
  const v = accountChipView({ status: "signedIn", player: { id: "p", displayName: "$& $1 Cash" } });
  assert.equal(v.label, ACCOUNT_COPY.chipLabel.signedIn.split("{name}").join("$& $1 Cash"));
});

test("chip: Compete OFF, even with a stale signed-in status and player, gives the nobody glyph and the off label", () => {
  const v = accountChipView(STALE_OFF);
  assert.deepStrictEqual({ ...v }, { face: "nobody", initials: "", bg: "", glyph: "?", label: ACCOUNT_COPY.chipLabel.off });
  assert.doesNotMatch(v.label, /Hilda/);
});

test("chip: signed out gives nobody with the signedOut label", () => {
  assert.deepStrictEqual({ ...accountChipView(SIGNED_OUT) }, { face: "nobody", initials: "", bg: "", glyph: "?", label: ACCOUNT_COPY.chipLabel.signedOut });
});

test("chip: pending gives the pending face, the glyph and the pending label", () => {
  assert.deepStrictEqual({ ...accountChipView(PENDING) }, { face: "pending", initials: "", bg: "", glyph: "?", label: ACCOUNT_COPY.chipLabel.pending });
});

test("chip: the four statuses give four distinct accessible labels", () => {
  const labels = [SIGNED_IN, SIGNED_OUT, PENDING, OFF].map((s) => accountChipView(s).label);
  assert.equal(new Set(labels).size, 4);
});

// ─── accountSheetView ──────────────────────────────────────────────────────

function assertCommonSheet(v, competeOn) {
  assert.equal(v.title, "PLAY GAMES");
  assert.equal(v.compete.label, "COMPETE");
  assert.equal(v.compete.on, competeOn);
  assert.deepStrictEqual(v.compete.options.map((o) => ({ ...o })), [{ value: true, label: "ON" }, { value: false, label: "OFF" }]);
  assert.deepStrictEqual({ ...v.settings }, { label: "SETTINGS" });
  assert.deepStrictEqual(Object.keys(v).sort(), ["action", "compete", "help", "identity", "settings", "title"]);
  assert.deepStrictEqual(Object.keys(v.identity).sort(), ["bg", "face", "glyph", "initials", "name", "status"]);
}

test("sheet: signed out with Compete ON offers Sign in, no help line", () => {
  const v = accountSheetView(SIGNED_OUT);
  assertCommonSheet(v, true);
  assert.deepStrictEqual({ ...v.action }, { id: "signIn", label: "SIGN IN", disabled: false });
  assert.equal(v.help, "");
  assert.equal(v.identity.face, "nobody");
  assert.equal(v.identity.name, ACCOUNT_COPY.sheet.nobody);
  assert.equal(v.identity.status, "PLAY GAMES · SIGNED OUT");
});

test("sheet: signed in offers Stop competing and the Play Games app helper line (D-03)", () => {
  const v = accountSheetView(SIGNED_IN);
  assertCommonSheet(v, true);
  assert.deepStrictEqual({ ...v.action }, { id: "stopCompeting", label: "STOP COMPETING", disabled: false });
  assert.equal(v.help, ACCOUNT_COPY.sheet.stopHelp);
  assert.equal(v.identity.face, "avatar");
  assert.equal(v.identity.initials, "HF");
  assert.equal(v.identity.bg, avatarColour("Hilda Ferrow"));
  assert.equal(v.identity.glyph, "");
  assert.equal(v.identity.name, "Hilda Ferrow");
  assert.equal(v.identity.status, "PLAY GAMES · SIGNED IN");
});

test("sheet: signed in with no name shows the unnamed line", () => {
  const v = accountSheetView({ status: "signedIn", player: { id: "p", displayName: "" } });
  assert.equal(v.identity.name, ACCOUNT_COPY.sheet.unnamed);
  assert.equal(v.action.id, "stopCompeting");
});

test("sheet: pending shows a disabled SIGNING IN… row", () => {
  const v = accountSheetView(PENDING);
  assertCommonSheet(v, true);
  assert.deepStrictEqual({ ...v.action }, { id: "pending", label: "SIGNING IN…", disabled: true });
  assert.equal(v.help, "");
  assert.equal(v.identity.face, "pending");
  assert.equal(v.identity.status, "PLAY GAMES · SIGNING IN");
});

test("sheet: Compete OFF has no action, the offHelp line and the COMPETE OFF status, even over a stale signedIn", () => {
  for (const s of [OFF, STALE_OFF]) {
    const v = accountSheetView(s);
    assertCommonSheet(v, false);
    assert.equal(v.action, null);
    assert.equal(v.help, ACCOUNT_COPY.sheet.offHelp);
    assert.equal(v.identity.face, "nobody");
    assert.equal(v.identity.name, ACCOUNT_COPY.sheet.nobody);
    assert.equal(v.identity.status, "PLAY GAMES · COMPETE OFF");
  }
});

test("sheet: no state, malformed ones included, ever offers a sign-out row (D-03)", () => {
  const allowed = new Set(["signIn", "stopCompeting", "pending"]);
  for (const s of [SIGNED_IN, SIGNED_OUT, PENDING, OFF, STALE_OFF, ...MALFORMED]) {
    const v = accountSheetView(s);
    if (v.action !== null) assert.ok(allowed.has(v.action.id), `unexpected action ${v.action.id}`);
  }
});

test("sheet: only a signed-in state reports SIGNED IN, and a signed-in state never reports SIGNED OUT", () => {
  for (const s of [SIGNED_OUT, PENDING, OFF, STALE_OFF, ...MALFORMED]) {
    const n = normalizeAccountState(s);
    if (n.status !== "signedIn") assert.notEqual(accountSheetView(s).identity.status, ACCOUNT_COPY.sheet.status.signedIn);
  }
  assert.notEqual(accountSheetView(SIGNED_IN).identity.status, ACCOUNT_COPY.sheet.status.signedOut);
});

// ─── accountCard ───────────────────────────────────────────────────────────

test("card: welcome is the D-04 rail card, tone odd, held for RAIL_HOLD.floor", () => {
  const c = accountCard("welcome");
  assert.deepStrictEqual({ ...c }, { ...ACCOUNT_COPY.cards.welcome, tone: "odd", hold: RAIL_HOLD.floor });
  assert.ok(Object.isFrozen(c));
  assert.ok(RAIL_TONES.includes(c.tone));
});

test("card: failed is the D-11 rail card, tone dull, held for RAIL_HOLD.default", () => {
  const c = accountCard("failed");
  assert.deepStrictEqual({ ...c }, { ...ACCOUNT_COPY.cards.failed, tone: "dull", hold: RAIL_HOLD.default });
  assert.ok(Object.isFrozen(c));
  assert.ok(RAIL_TONES.includes(c.tone));
});

test("card: any other kind gives null", () => {
  for (const k of [undefined, null, "", "toString", "constructor", "WELCOME", 1, {}, []]) assert.equal(accountCard(k), null, String(k));
});

// ─── accountIdentity ───────────────────────────────────────────────────────

test("identity: signed in with Compete ON gives { signedIn: true, player }", () => {
  const id = accountIdentity(SIGNED_IN);
  assert.equal(id.signedIn, true);
  assert.deepStrictEqual({ ...id.player }, HILDA);
  assert.ok(Object.isFrozen(id));
  assert.ok(Object.isFrozen(id.player));
});

test("identity: every other state gives { signedIn: false, player: null }", () => {
  for (const s of [SIGNED_OUT, PENDING, OFF, STALE_OFF, ...MALFORMED]) {
    if (normalizeAccountState(s).status === "signedIn") continue;
    const id = accountIdentity(s);
    assert.deepStrictEqual({ ...id }, { signedIn: false, player: null });
    assert.ok(Object.isFrozen(id));
  }
});

// ─── totality and purity ───────────────────────────────────────────────────

test("every view is total over malformed input and returns deep-frozen results", () => {
  for (const input of MALFORMED) {
    for (const [name, fn] of [["chip", accountChipView], ["sheet", accountSheetView], ["identity", accountIdentity]]) {
      let v;
      assert.doesNotThrow(() => { v = fn(input); }, `${name}(${JSON.stringify(input) ?? typeof input})`);
      assertDeepFrozen(v, name);
    }
  }
});

test("deep-frozen inputs are never mutated, and equal inputs give deepStrictEqual views", () => {
  const frozen = deepFreeze(structuredClone(SIGNED_IN));
  const copy = structuredClone(SIGNED_IN);
  for (const fn of [normalizeAccountState, accountChipView, accountSheetView, accountIdentity]) {
    assert.doesNotThrow(() => fn(frozen));
    assert.deepStrictEqual(fn(frozen), fn(copy));
  }
  assert.deepStrictEqual(frozen, SIGNED_IN);
  assert.deepStrictEqual(accountCard("welcome"), accountCard("welcome"));
});

test("source: imports the avatar helpers from boardsView.js and the copy from content/account.js", () => {
  assert.match(STRIPPED, /from\s*"\.\/boardsView\.js"/);
  assert.match(STRIPPED, /from\s*"\.\.\/\.\.\/content\/account\.js"/);
  assert.doesNotMatch(STRIPPED, />>>\s*0/, "the avatar hash is imported, never re-implemented");
});

test("source: no DOM, storage, clock, randomness or network reference", () => {
  for (const re of [/\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /\bmzStorage\b/, /\bDate\./, /\bnew Date\b/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(STRIPPED, re, `account.js must not reference ${re}`);
  }
});
