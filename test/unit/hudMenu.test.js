// test/unit/hudMenu.test.js
//
// Phase 57 (LAYOUT-04/05), Plan 05, Task 1 — the pure module pin for
// src/browser/hudMenu.js: hudMenuNext()'s totality over every open/kind/ctx
// shape, HUD_MENU_ITEMS' shape (ids/labels/glyphs/colours/sizes in the
// mock's own order), HUD_MENU_EVENTS' exact six kinds, and a purity check
// that the module touches no DOM/timer/storage global.

import test from "node:test";
import assert from "node:assert/strict";

import { HUD_MENU_ITEMS, HUD_MENU_EVENTS, hudMenuNext } from "../../src/browser/hudMenu.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── hudMenuNext() — the <behavior> matrix ──────────────────────────────

test("hudMenuNext: toggle opens from closed (no encounter), closes from open, stays closed during an encounter", () => {
  assert.equal(hudMenuNext(false, "toggle", {}), true);
  assert.equal(hudMenuNext(true, "toggle", {}), false);
  assert.equal(hudMenuNext(false, "toggle", { encounter: true }), false);
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

test("HUD_MENU_ITEMS: four frozen rows in order marks, centre, camp, settings, with the four legacy chip ids and the mock's glyph codepoints", () => {
  assert.ok(Object.isFrozen(HUD_MENU_ITEMS));
  assert.equal(HUD_MENU_ITEMS.length, 4);
  for (const row of HUD_MENU_ITEMS) assert.ok(Object.isFrozen(row));

  const expected = [
    { key: "marks", id: "mw-chip-marks", glyph: "◈" },
    { key: "centre", id: "mw-chip-centre", glyph: "⊕" },
    { key: "camp", id: "btn-camp", glyph: "☾" },
    { key: "settings", id: "mw-gear-btn", glyph: "⚙" },
  ];
  assert.deepStrictEqual(
    HUD_MENU_ITEMS.map((r) => ({ key: r.key, id: r.id, glyph: r.glyph })),
    expected,
  );
});

test("HUD_MENU_ITEMS: the centre row reads CENTRE MAP (USER RULING 2026-09-22)", () => {
  assert.equal(HUD_MENU_ITEMS.find((r) => r.key === "centre").label, "CENTRE MAP");
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
