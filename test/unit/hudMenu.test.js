// test/unit/hudMenu.test.js
//
// Phase 57 (LAYOUT-04/05), Plan 05, Task 1 — the pure module pin for
// src/browser/hudMenu.js: hudMenuNext()'s totality over every open/kind/ctx
// shape, HUD_MENU_ITEMS' shape (ids/labels/glyphs/colours/sizes in the
// mock's own order), HUD_MENU_EVENTS' exact six kinds, and a purity check
// that the module touches no DOM/timer/storage global.

import test from "node:test";
import assert from "node:assert/strict";

import {
  HUD_MENU_ITEMS,
  HUD_MENU_EVENTS,
  hudMenuNext,
  HUD_MENU_GLYPH,
  HUD_MENU_QUIT_COPY,
  ABANDON_ARM_MS,
  ABANDON_ROW_EVENTS,
  abandonRowNext,
  hudMenuRowStates,
} from "../../src/browser/hudMenu.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── hudMenuNext() — the <behavior> matrix ──────────────────────────────

test("hudMenuNext: toggle opens whatever the context (D-08) and closes from open", () => {
  // Phase 70 D-08 lifted the Phase 57 T-57-17 refusal: the ☰ opens on the
  // map, in combat and every other encounter, and while dead.
  for (const ctx of [{}, { encounter: true }, { encounter: false }, null, undefined, 42, { dead: true }]) {
    assert.equal(hudMenuNext(false, "toggle", ctx), true, `ctx=${JSON.stringify(ctx)} opens`);
    assert.equal(hudMenuNext(true, "toggle", ctx), false, `ctx=${JSON.stringify(ctx)} closes`);
  }
  assert.equal(hudMenuNext(false, "toggle"), true);
});

test("hudMenuNext: every kind other than toggle, and any unknown/missing kind, closes from either starting state", () => {
  const otherKinds = HUD_MENU_EVENTS.filter((k) => k !== "toggle");
  for (const kind of [...otherKinds, "bogus", undefined, null, 42]) {
    assert.equal(hudMenuNext(false, kind, {}), false, `kind=${String(kind)} from closed`);
    assert.equal(hudMenuNext(true, kind, {}), false, `kind=${String(kind)} from open`);
  }
});

test("hudMenuNext: totality — every open/kind/ctx combination returns a strict boolean and never throws", () => {
  const opens = [true, false, undefined, null, 1, 0];
  const kinds = [...HUD_MENU_EVENTS, "bogus", undefined, null, 42];
  const ctxs = [undefined, null, {}, { encounter: true }, { encounter: false }];
  for (const open of opens) {
    for (const kind of kinds) {
      for (const ctx of ctxs) {
        let result;
        assert.doesNotThrow(() => {
          result = hudMenuNext(open, kind, ctx);
        }, `hudMenuNext(${String(open)}, ${String(kind)}, ${JSON.stringify(ctx)}) must not throw`);
        assert.equal(typeof result, "boolean");
      }
    }
  }
});

// ─── HUD_MENU_ITEMS ──────────────────────────────────────────────────────

test("HUD_MENU_ITEMS: five frozen rows in order camp, marks, settings, report, notes, with the three legacy chip ids and the mock's glyph codepoints", () => {
  // Phase 85 (85-01, ACCT-03): the user's 2026-09-28 todo dropped the CENTRE
  // MAP row and put MAKE CAMP first under the account block.
  assert.ok(Object.isFrozen(HUD_MENU_ITEMS));
  assert.equal(HUD_MENU_ITEMS.length, 5);
  for (const row of HUD_MENU_ITEMS) assert.ok(Object.isFrozen(row));

  const expected = [
    { key: "camp", id: "btn-camp", glyph: "☾" },
    { key: "marks", id: "mw-chip-marks", glyph: "◈" },
    { key: "settings", id: "mw-gear-btn", glyph: "⚙" },
    { key: "report", id: "mw-menu-report", glyph: "✎" },
    { key: "notes", id: "mw-menu-notes", glyph: "¶" },
  ];
  assert.deepStrictEqual(
    HUD_MENU_ITEMS.map((r) => ({ key: r.key, id: r.id, glyph: r.glyph })),
    expected,
  );
});

// Phase 79.3 (BUG-01 D-08, NOTES-02 D-20): the two new rows' full shape.
test("HUD_MENU_ITEMS (79.3 D-08, D-20): REPORT A BUG and PATCH NOTES carry their label, colour and size", () => {
  const report = HUD_MENU_ITEMS.find((r) => r.key === "report");
  const notes = HUD_MENU_ITEMS.find((r) => r.key === "notes");
  assert.deepStrictEqual(
    { key: report.key, id: report.id, label: report.label, glyph: report.glyph, color: report.color, size: report.size },
    { key: "report", id: "mw-menu-report", label: "REPORT A BUG", glyph: "✎", color: "#d9826b", size: 14 },
  );
  assert.deepStrictEqual(
    { key: notes.key, id: notes.id, label: notes.label, glyph: notes.glyph, color: notes.color, size: notes.size },
    { key: "notes", id: "mw-menu-notes", label: "PATCH NOTES", glyph: "¶", color: "#8fb3c9", size: 15 },
  );
});

// ─── HUD_MENU_EVENTS ─────────────────────────────────────────────────────

test("HUD_MENU_EVENTS: exactly toggle, select, outside, tab, encounter, escape, frozen", () => {
  assert.ok(Object.isFrozen(HUD_MENU_EVENTS));
  assert.deepStrictEqual([...HUD_MENU_EVENTS], ["toggle", "select", "outside", "tab", "encounter", "escape"]);
});

// ─── purity ──────────────────────────────────────────────────────────────

test("purity: the comment-stripped module source contains no document/window/globalThis/setTimeout/localStorage identifier", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "hudMenu.js"), "utf8");
  const stripped = stripJs(src);
  assert.doesNotMatch(stripped, /\b(document|window|globalThis|setTimeout|localStorage)\b/);
});

// ─── quit rows (Phase 70 D-06) — the ☰ glyph, the quit-row copy and the
// two-tap abandon reducer ─────────────────────────────────────────────────

test("quit rows (D-06): HUD_MENU_GLYPH is the ☰ codepoint 9776", () => {
  assert.equal(HUD_MENU_GLYPH, String.fromCodePoint(9776));
});

test("quit rows (D-06): HUD_MENU_QUIT_COPY is frozen with the four row labels", () => {
  assert.ok(Object.isFrozen(HUD_MENU_QUIT_COPY));
  assert.deepStrictEqual(
    { ...HUD_MENU_QUIT_COPY },
    {
      saveQuit: "SAVE & QUIT",
      abandon: "ABANDON THIS CHARACTER",
      armed: "TAP AGAIN TO BURY THEM",
      newCharacter: "NEW CHARACTER",
    },
  );
});

test("quit rows (D-06): ABANDON_ARM_MS is 3000 and ABANDON_ROW_EVENTS is exactly tap, timeout, close, frozen", () => {
  assert.equal(ABANDON_ARM_MS, 3000);
  assert.ok(Object.isFrozen(ABANDON_ROW_EVENTS));
  assert.deepStrictEqual([...ABANDON_ROW_EVENTS], ["tap", "timeout", "close"]);
});

test("quit rows (D-06): a tap on a dead hero's row is NEW CHARACTER from either armed state", () => {
  for (const armed of [true, false]) {
    assert.deepStrictEqual({ ...abandonRowNext(armed, "tap", { dead: true }) }, { armed: false, act: "newCharacter" });
    assert.deepStrictEqual(
      { ...abandonRowNext(armed, "tap", { dead: true, confirm: false }) },
      { armed: false, act: "newCharacter" },
    );
  }
});

test("quit rows (D-06): confirm on — the first live tap arms, the second abandons", () => {
  const first = abandonRowNext(false, "tap", { dead: false, confirm: true });
  assert.deepStrictEqual({ ...first }, { armed: true, act: null });
  const second = abandonRowNext(first.armed, "tap", { dead: false, confirm: true });
  assert.deepStrictEqual({ ...second }, { armed: false, act: "abandon" });
});

test("quit rows (D-06): confirm off — one live tap abandons", () => {
  assert.deepStrictEqual(
    { ...abandonRowNext(false, "tap", { dead: false, confirm: false }) },
    { armed: false, act: "abandon" },
  );
});

test("quit rows (D-06): a missing, null, non-object or confirm-less ctx is fail-safe — the first tap only arms", () => {
  for (const ctx of [undefined, null, 42, "confirm", true, {}, { dead: false }, { confirm: "false" }, { confirm: 0 }]) {
    assert.deepStrictEqual({ ...abandonRowNext(false, "tap", ctx) }, { armed: true, act: null }, `ctx=${JSON.stringify(ctx)}`);
  }
});

test("quit rows (D-06): a hostile ctx (throwing getters, a throwing proxy) never throws and is fail-safe", () => {
  const hostile = {
    get confirm() {
      throw new Error("boom");
    },
    get dead() {
      throw new Error("boom");
    },
  };
  let r;
  assert.doesNotThrow(() => {
    r = abandonRowNext(false, "tap", hostile);
  });
  assert.deepStrictEqual({ ...r }, { armed: true, act: null });
  const proxy = new Proxy(
    {},
    {
      get() {
        throw new Error("trap");
      },
    },
  );
  assert.doesNotThrow(() => {
    r = abandonRowNext(false, "tap", proxy);
  });
  assert.deepStrictEqual({ ...r }, { armed: true, act: null });
});

test("quit rows (D-06): timeout, close, unknown and missing kinds disarm from either state", () => {
  for (const kind of ["timeout", "close", "bogus", undefined, null, 42]) {
    for (const armed of [true, false]) {
      assert.deepStrictEqual(
        { ...abandonRowNext(armed, kind, { dead: false, confirm: true }) },
        { armed: false, act: null },
        `kind=${String(kind)} armed=${armed}`,
      );
    }
  }
});

test("quit rows (D-06): adjacency — a tap after timeout re-arms; only a tap on an armed row abandons", () => {
  const ctx = { dead: false, confirm: true };
  let s = abandonRowNext(false, "tap", ctx);
  assert.equal(s.armed, true);
  s = abandonRowNext(s.armed, "timeout", ctx);
  assert.deepStrictEqual({ ...s }, { armed: false, act: null });
  s = abandonRowNext(s.armed, "tap", ctx);
  assert.deepStrictEqual({ ...s }, { armed: true, act: null });
  s = abandonRowNext(s.armed, "close", ctx);
  assert.deepStrictEqual({ ...s }, { armed: false, act: null });
  s = abandonRowNext(s.armed, "tap", ctx);
  s = abandonRowNext(s.armed, "tap", ctx);
  assert.deepStrictEqual({ ...s }, { armed: false, act: "abandon" });
});

test("quit rows (D-06): only a strict-true armed value abandons on the next tap", () => {
  for (const armed of [1, "true", {}, undefined, null]) {
    assert.deepStrictEqual({ ...abandonRowNext(armed, "tap", { confirm: true }) }, { armed: true, act: null });
  }
});

test("quit rows (D-06): totality — always frozen, armed strictly boolean, act in {null, abandon, newCharacter}, never throws", () => {
  const armeds = [true, false, undefined, null, 1, 0, "true"];
  const kinds = [...ABANDON_ROW_EVENTS, "bogus", undefined, null, 42];
  const ctxs = [
    undefined,
    null,
    {},
    7,
    { dead: true },
    { dead: "true" },
    { confirm: false },
    { confirm: true },
    { dead: false, confirm: false },
  ];
  for (const armed of armeds) {
    for (const kind of kinds) {
      for (const ctx of ctxs) {
        let r;
        assert.doesNotThrow(() => {
          r = abandonRowNext(armed, kind, ctx);
        });
        assert.ok(Object.isFrozen(r));
        assert.equal(typeof r.armed, "boolean");
        assert.ok([null, "abandon", "newCharacter"].includes(r.act), `act=${String(r.act)}`);
      }
    }
  }
});

test("quit rows (D-06): the five new names are each exported exactly once", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "hudMenu.js"), "utf8");
  for (const name of ["HUD_MENU_GLYPH", "HUD_MENU_QUIT_COPY", "ABANDON_ARM_MS", "ABANDON_ROW_EVENTS", "abandonRowNext"]) {
    const re = new RegExp(`export\\s+(?:const|function)\\s+${name}\\b`, "g");
    assert.equal((src.match(re) || []).length, 1, name);
  }
});

// ─── row states (Phase 70 D-08) — the ☰ opens everywhere and dims the rows
// that cannot act in the current context ─────────────────────────────────

const ROW_ORDER = [
  { key: "camp", id: "btn-camp" },
  { key: "marks", id: "mw-chip-marks" },
  { key: "settings", id: "mw-gear-btn" },
  // Phase 79.3 (BUG-01 D-08, NOTES-02 D-20): the two new always-enabled rows.
  { key: "report", id: "mw-menu-report" },
  { key: "notes", id: "mw-menu-notes" },
  { key: "saveQuit", id: "mw-menu-save-quit" },
  { key: "abandon", id: "mw-menu-abandon" },
];

function enabledMap(rows) {
  return Object.fromEntries(rows.map((r) => [r.key, r.enabled]));
}

const ALL_ON = Object.freeze({
  camp: true,
  marks: true,
  settings: true,
  report: true,
  notes: true,
  saveQuit: true,
  abandon: true,
});

test("row states (D-08): seven frozen { key, id, enabled } entries in dropdown order; the first five ids equal HUD_MENU_ITEMS'", () => {
  // Phase 85 (85-01, ACCT-03): re-pinned from eight to seven rows — the
  // CENTRE MAP row is gone.
  const rows = hudMenuRowStates({ hero: true });
  assert.ok(Object.isFrozen(rows));
  assert.equal(rows.length, 7);
  for (const r of rows) {
    assert.ok(Object.isFrozen(r));
    assert.deepStrictEqual(Object.keys(r).sort(), ["enabled", "id", "key"]);
    assert.equal(typeof r.enabled, "boolean");
  }
  assert.deepStrictEqual(
    rows.map((r) => ({ key: r.key, id: r.id })),
    ROW_ORDER,
  );
  assert.deepStrictEqual(
    rows.slice(0, 5).map((r) => r.id),
    HUD_MENU_ITEMS.map((r) => r.id),
  );
});

test("row states (D-08): a live, idle hero enables all seven rows", () => {
  // Phase 85 (85-01, ACCT-03): re-pinned from eight to seven rows.
  assert.deepStrictEqual(enabledMap(hudMenuRowStates({ hero: true, dead: false, encounter: false })), { ...ALL_ON });
});

test("row states (D-08): an over-map encounter disables MAKE CAMP only", () => {
  // Phase 85 (85-01, ACCT-03): CENTRE MAP is gone, so an encounter no longer
  // disables a second row.
  assert.deepStrictEqual(enabledMap(hudMenuRowStates({ hero: true, dead: false, encounter: true })), {
    ...ALL_ON,
    camp: false,
  });
});

// Phase 78 (HUD-02): "once the hero is dead, only the Oracle, the DEAD/
// Leaderboards screen and the ☰ menu (Settings, the way back to the title)
// accept input ... camp, marks and centre-map are inert". Phase 85 (85-01)
// removed the centre-map row entirely; a dead hero now disables MARKS and
// MAKE CAMP.
test("row states (HUD-02): a dead hero disables MARKS and MAKE CAMP; SETTINGS and both quit rows stay live", () => {
  const DEAD = { ...ALL_ON, marks: false, camp: false };
  assert.deepStrictEqual(enabledMap(hudMenuRowStates({ hero: true, dead: true, encounter: true })), DEAD);
  assert.deepStrictEqual(enabledMap(hudMenuRowStates({ hero: true, dead: true, encounter: false })), DEAD);
  assert.deepStrictEqual(enabledMap(hudMenuRowStates({ hero: false, dead: true, encounter: true })), DEAD);
});

test("row states (HUD-02): only a strictly-true dead flag locks MARKS", () => {
  for (const dead of [false, undefined, null, 1, "true"]) {
    assert.equal(enabledMap(hudMenuRowStates({ hero: true, dead, encounter: false })).marks, true, `dead=${String(dead)}`);
  }
});

test("row states (D-08): no hero (hero not strictly true) disables MAKE CAMP only", () => {
  for (const hero of [false, undefined, null, 1, "true"]) {
    assert.deepStrictEqual(enabledMap(hudMenuRowStates({ hero, dead: false, encounter: false })), { ...ALL_ON, camp: false }, `hero=${String(hero)}`);
  }
});

// Phase 78 (HUD-02): MARKS left this always-on set (a dead hero locks it,
// pinned above); SETTINGS and the two quit rows are the no-trap guarantee.
test("row states (D-08, HUD-02): SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT and ABANDON are always enabled, dead or alive", () => {
  // Phase 79.3 (BUG-01 D-08, NOTES-02 D-20): report and notes join the
  // always-enabled set.
  const ctxs = [{ hero: true }, { hero: true, encounter: true }, { hero: true, dead: true }, { hero: false, dead: true, encounter: true }, {}];
  for (const ctx of ctxs) {
    const m = enabledMap(hudMenuRowStates(ctx));
    for (const key of ["settings", "report", "notes", "saveQuit", "abandon"]) assert.equal(m[key], true, `${key} ctx=${JSON.stringify(ctx)}`);
  }
});

// Phase 79.3 (BUG-01 D-08, NOTES-02 D-20): REPORT A BUG and PATCH NOTES must
// never be disabled by hudMenuRowStates, for any ctx — including hostile ones.
test("row states (79.3 D-08, D-20): REPORT A BUG and PATCH NOTES are enabled for every ctx, hostile included", () => {
  const hostile = {
    get hero() {
      throw new Error("boom");
    },
    get dead() {
      throw new Error("boom");
    },
    get encounter() {
      throw new Error("boom");
    },
  };
  const proxy = new Proxy(
    {},
    {
      get() {
        throw new Error("trap");
      },
    },
  );
  const ctxs = [
    { hero: true },
    { hero: true, encounter: true },
    { hero: true, dead: true },
    { hero: false, dead: true, encounter: true },
    {},
    undefined,
    null,
    42,
    "hero",
    true,
    hostile,
    proxy,
  ];
  const safeLabel = (ctx) => {
    try {
      return JSON.stringify(ctx);
    } catch {
      // A hostile getter or a throwing Proxy can make even String(ctx)
      // throw (it also touches the object's properties) — fall back to a
      // property-free label rather than risk a second throw.
      return typeof ctx;
    }
  };
  for (const ctx of ctxs) {
    let rows;
    assert.doesNotThrow(() => {
      rows = hudMenuRowStates(ctx);
    });
    const m = enabledMap(rows);
    assert.equal(m.report, true, `report ctx=${safeLabel(ctx)}`);
    assert.equal(m.notes, true, `notes ctx=${safeLabel(ctx)}`);
  }
});

test("row states (D-08): a missing, null, non-object or hostile ctx never throws; MAKE CAMP is disabled (fail-safe) and every other row enabled", () => {
  const hostile = {
    get hero() {
      throw new Error("boom");
    },
    get dead() {
      throw new Error("boom");
    },
    get encounter() {
      throw new Error("boom");
    },
  };
  const proxy = new Proxy(
    {},
    {
      get() {
        throw new Error("trap");
      },
    },
  );
  for (const ctx of [undefined, null, 42, "hero", true, hostile, proxy]) {
    let rows;
    assert.doesNotThrow(() => {
      rows = hudMenuRowStates(ctx);
    });
    assert.deepStrictEqual(enabledMap(rows), { ...ALL_ON, camp: false });
  }
  assert.doesNotThrow(() => hudMenuRowStates());
});

test("row states (D-08): hudMenuRowStates is exported exactly once", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "hudMenu.js"), "utf8");
  assert.equal((src.match(/export\s+function\s+hudMenuRowStates\b/g) || []).length, 1);
});
