// test/unit/final-sheet.test.js
//
// Phase 78 (HUD-03), Plan 06 Task 1 — the FINAL SHEET: a read-only look at
// the run that just ended (the user's 2026-09-24 ruling: "a FINAL SHEET
// button on the DEAD screen opens the Hero tab's character sheet in
// READ-ONLY mode: stats, level, gear, grimoire and the epitaph, with no
// action buttons").
//
// Every dead hero below is a REAL engine state: newRun with a forced class,
// then engine/death.js#die. The view model must agree with the Hero and Gear
// tabs' own view models (characterSheetViewModel, grimoireViewModel,
// gearWornModel, gearBagCardsModel), never restate them. The renderer is
// driven through the recording DOM: no button, no handler, no HTML-string
// write, every text node byte-identical to its view-model string.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/state.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";
import { JEWELRY, CLOAKS, ROMAN, ABILITY_BY_ID } from "../../content/index.js";
import { characterSheetViewModel, grimoireViewModel } from "../../src/browser/heroTab.js";
import { gearWornModel, gearBagCardsModel, GEAR_WORN_ORDER, GEAR_COPY } from "../../src/browser/gearTab.js";
import { FINAL_SHEET_COPY, finalSheetViewModel, renderFinalSheet } from "../../src/browser/finalSheet.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
// Phase 96 (FLAVOR-04): the tricks-row pin below reads the real ability lookup.
import { flavorOfAbility, flavorOfItem } from "../../src/browser/flavorText.js";
import { setAlwaysRules } from "../../src/browser/rulesLayer.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { BANNED as SAFETY_BANNED, ALLOWLIST as SAFETY_ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "finalSheet.js"), "utf8").replace(/\r\n/g, "\n");

/** deadMagicUser() — a Magic User killed at depth 4 on day 3, with a worn
 * ring, a worn cloak, two bag items and a five-spell book. */
function deadMagicUser() {
  const s = newRun(7, [], { force: { cls: "Magic User" }, startDepth: 4 });
  s.c.worn = { jewelry1: Object.assign({ kind: "jewel" }, JEWELRY[0]), cloak: Object.assign({ kind: "cloak" }, CLOAKS[0]) };
  s.c.items = [Object.assign({ kind: "jewel" }, JEWELRY[1]), { kind: "tool", n: "Rope", tool: "rope" }];
  s.c.grimoire = ["Heal", "Stun", "Sense Presence"];
  s.day = 3;
  s.steps = 212;
  die(s, "combat", "a rat", makeRng(4), [], () => 1);
  return s;
}

/** deadFighter() — a Fighter with nothing worn but the start kit and an empty bag. */
function deadFighter() {
  const s = newRun(3, [], { force: { cls: "Fighter" } });
  s.c.items = [];
  s.c.worn = {};
  s.c.weapon = "Fists";
  s.c.armor = "";
  s.c.ar = 0;
  die(s, "trap", null, makeRng(2), [], () => 1);
  return s;
}

/** walk(node, fn) — every element and text node under `node`, depth first. */
function walk(node, fn) {
  fn(node);
  for (const child of node.children || []) walk(child, fn);
}

function textsOf(root) {
  const out = [];
  walk(root, (n) => {
    if (n.nodeType === 3) out.push(n.textContent);
    else if (n._content && n._content.kind === "text") out.push(n._content.value);
  });
  return out;
}

/** vmStrings(vm) — every string leaf of the view model. */
function vmStrings(obj, out = []) {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => vmStrings(v, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((v) => vmStrings(v, out));
  return out;
}

function renderInto(vm) {
  const { document } = createRecordingDocument();
  const listeners = [];
  const create = document.createElement;
  document.createElement = (tag) => {
    const el = create(tag);
    el.addEventListener = (...args) => listeners.push(args);
    return el;
  };
  const host = document.createElement("div");
  renderFinalSheet(host, vm);
  return { host, listeners };
}

test("HUD-03: a dead Magic User's sheet names who they were (name, Race Sub-class, class, level numeral, HP 0/max)", () => {
  const s = deadMagicUser();
  const vm = finalSheetViewModel(s);
  assert.equal(vm.empty, false);
  assert.equal(vm.who.name, s.c.name);
  assert.equal(vm.who.lineage, `${s.c.race} ${s.c.sub}`);
  assert.equal(vm.who.cls, s.c.cls);
  assert.equal(vm.who.level, FINAL_SHEET_COPY.level.replace("{n}", ROMAN[s.c.level - 1]));
  assert.equal(vm.who.hp, FINAL_SHEET_COPY.hp.replace("{max}", String(s.c.maxWP)));
  assert.match(vm.who.hp, /^HP 0\/\d+$/);
});

test("HUD-03: every stat row equals characterSheetViewModel's label and value", () => {
  const s = deadMagicUser();
  const vm = finalSheetViewModel(s);
  const sheet = characterSheetViewModel(s);
  assert.deepStrictEqual(
    vm.stats.map((r) => [r.label, r.value]),
    sheet.stats.map((r) => [r.label, String(r.value)]),
  );
});

test("HUD-03: skills and abilities carry name and description only, no ready or cooldown state", () => {
  const s = newRun(3, [], { force: { cls: "Fighter" } });
  s.c.abilities = [Object.keys(ABILITY_BY_ID)[0]];
  die(s, "trap", null, makeRng(2), [], () => 1);
  const vm = finalSheetViewModel(s);
  const sheet = characterSheetViewModel(s);
  // Phase 96 (FLAVOR-04): declared re-pin: each row gains the additive `flavor` (a skill's own, or the ability's looked up by name).
  const expected = [
    ...sheet.skills.map((r) => ({ name: r.name, description: r.description, flavor: r.flavor })),
    ...sheet.abilities.map((r) => ({ name: r.name, description: r.description, flavor: flavorOfAbility(r.name) })),
  ];
  assert.deepStrictEqual(vm.tricks.rows, expected);
  for (const r of vm.tricks.rows) assert.deepStrictEqual(Object.keys(r).sort(), ["description", "flavor", "name"]);
  assert.ok(vm.tricks.rows.length >= 1);
});

test("HUD-03: worn gear follows GEAR_WORN_ORDER with each row's stat line from gearWornModel", () => {
  const s = deadMagicUser();
  const vm = finalSheetViewModel(s);
  const worn = gearWornModel(s).rows;
  assert.deepStrictEqual(vm.worn.map((r) => r.key), [...GEAR_WORN_ORDER]);
  assert.deepStrictEqual(
    vm.worn.map((r) => [r.label, r.name, r.value, r.note]),
    worn.map((r) => [r.label, r.name, r.value, r.note]),
  );
  assert.equal(vm.worn.find((r) => r.key === "jewelry1").name, JEWELRY[0].n);
  assert.equal(vm.worn.find((r) => r.key === "cloak").name, CLOAKS[0].n);
});

test("HUD-03: the bag lists its item names; the book lists its spells with levels", () => {
  const s = deadMagicUser();
  const vm = finalSheetViewModel(s);
  assert.deepStrictEqual(vm.bag.names, gearBagCardsModel(s).map((c) => c.name));
  assert.deepStrictEqual(vm.bag.names, [JEWELRY[1].n, "Rope"]);
  assert.equal(vm.bag.emptyLine, "");
  const rows = grimoireViewModel(s).rows;
  assert.deepStrictEqual(
    vm.book.spells.map((sp) => [sp.name, sp.level]),
    rows.map((r) => [r.name, FINAL_SHEET_COPY.spellLevel.replace("{n}", String(r.lvl))]),
  );
  assert.equal(vm.book.spells.length, 3);
  assert.equal(vm.book.emptyLine, "");
});

// Phase 96 (FLAVOR-04), plan 96-12: the worn and bag notes read the item's Phase 95 flavour line; the exact rules note is the
// view model's `note` (the HUD-03 pin above reads it unedited) and renders only as a static body with Always show the rules on.
const classOf = (n) => String(n.className || "");
const bodiesOf = (host) => { const out = []; walk(host, (n) => { if (n.nodeType !== 3 && classOf(n).includes("mw-rules-body")) out.push(n); }); return out; };

test("96-12: a worn ring and cloak and the bag items carry their Phase 95 flavour line; note stays the exact rules text", () => {
  const s = deadMagicUser();
  const vm = finalSheetViewModel(s);
  const worn = gearWornModel(s).rows;
  for (const key of ["jewelry1", "cloak"]) {
    const row = vm.worn.find((r) => r.key === key);
    assert.equal(row.flavor, flavorOfItem(s.c.worn[key]), `${key}: the flavour is the item's line`);
    assert.ok(row.flavor, `${key}: has a line`);
    assert.equal(row.note, worn.find((r) => r.key === key).rules, `${key}: note is the exact rules text`);
    assert.doesNotMatch(row.flavor, /[0-9]/);
  }
  for (const key of ["jewelry2", "armor"]) assert.equal(vm.worn.find((r) => r.key === key).flavor, "", `${key}: no flavour (empty slot or live wear state)`);
  assert.deepStrictEqual(vm.bag.items.map((i) => i.name), vm.bag.names);
  const cards = gearBagCardsModel(s);
  vm.bag.items.forEach((it, n) => {
    assert.equal(it.flavor, flavorOfItem(s.c.items[cards[n].i]), `bag ${n}: the flavour is the item's line`);
    assert.equal(it.rules, it.flavor ? cards[n].rules : "", `bag ${n}: rules are the card's exact text`);
  });
  assert.ok(vm.bag.items.some((i) => i.flavor), "at least one bag item has a line");
});

test("96-12: with Always off the sheet shows the flavour and none of the rules text; with Always on each flavoured row gets a static body, still no control", () => {
  const s = deadMagicUser();
  const vm = finalSheetViewModel(s);
  const flavoured = vm.worn.filter((r) => r.filled && r.flavor);
  const bagFlavoured = vm.bag.items.filter((i) => i.flavor);
  assert.ok(flavoured.length >= 2 && bagFlavoured.length >= 1);

  setAlwaysRules(false);
  const off = renderInto(vm);
  const offTexts = textsOf(off.host);
  for (const r of flavoured) {
    assert.ok(offTexts.includes(r.flavor), `${r.key}: flavour shown`);
    assert.ok(!offTexts.includes(r.note), `${r.key}: the rules note is absent with the setting off`);
  }
  for (const i of bagFlavoured) assert.ok(offTexts.includes(i.flavor) && !offTexts.includes(i.rules));
  assert.equal(bodiesOf(off.host).length, 0, "no body with the setting off");

  setAlwaysRules(true);
  try {
    const on = renderInto(vm);
    const onTexts = textsOf(on.host);
    const bodies = bodiesOf(on.host);
    for (const r of flavoured) {
      const body = bodies.find((b) => b.id === "mw-rules-final-worn-" + r.key);
      assert.ok(body, `${r.key}: has a final:worn body`);
      assert.equal(body.hidden, false);
      assert.ok(onTexts.includes(r.note), `${r.key}: the exact note shows`);
    }
    vm.bag.items.forEach((i, n) => {
      if (!i.flavor || !i.rules) return; // the fixture's bare Rope carries no txt, so it has nothing to show under RULES
      const body = bodies.find((b) => b.id === "mw-rules-final-bag-" + n);
      assert.ok(body, `bag ${n}: has a final:bag body`);
      assert.equal(body.hidden, false);
      assert.ok(onTexts.includes(i.rules));
    });
    walk(on.host, (n) => {
      if (n.nodeType === 3) return;
      assert.notEqual(n.tagName, "button");
      assert.equal(n.onclick, null);
    });
    assert.equal(on.listeners.length, 0);
  } finally {
    setAlwaysRules(false);
  }
});

test("96-12: an item with no flavour line keeps today's note (worn) and name line (bag)", () => {
  const s = deadMagicUser();
  s.c.worn.jewelry1 = { kind: "jewel", n: "Mystery Trinket", txt: "does a mysterious thing" };
  s.c.items.push({ kind: "tool", n: "Mystery Gadget", tool: "noSuchTool", txt: "also mysterious" });
  const vm = finalSheetViewModel(s);
  const ring = vm.worn.find((r) => r.key === "jewelry1");
  assert.equal(ring.flavor, "");
  const { host } = renderInto(vm);
  const texts = textsOf(host);
  assert.ok(texts.includes("does a mysterious thing"), "the unknown ring's own note still shows");
  assert.ok(texts.includes("Mystery Gadget"));
  const gadget = vm.bag.items.find((i) => i.name === "Mystery Gadget");
  assert.deepStrictEqual(gadget, { name: "Mystery Gadget", flavor: "", rules: "" });
});

test("HUD-03: how it ended carries the epitaph, the cause, depth 4, day 3 and the squares", () => {
  const s = deadMagicUser();
  const vm = finalSheetViewModel(s);
  assert.equal(vm.death.epitaph, s.epitaph);
  assert.equal(vm.death.cause, s.deathNote);
  assert.ok(vm.death.epitaph.length > 0 && vm.death.cause.length > 0);
  assert.deepStrictEqual(
    vm.death.facts.map((f) => [f.label, f.value]),
    [
      [FINAL_SHEET_COPY.depth, "4"],
      [FINAL_SHEET_COPY.day, "3"],
      [FINAL_SHEET_COPY.squares, "212"],
    ],
  );
});

test("HUD-03 empty: a dead Fighter gets one empty line for the book, the empty worn lines and the empty bag line", () => {
  const s = deadFighter();
  const vm = finalSheetViewModel(s);
  assert.deepStrictEqual(vm.book.spells, []);
  assert.equal(vm.book.emptyLine, FINAL_SHEET_COPY.bookNone);
  assert.deepStrictEqual(vm.bag.names, []);
  assert.equal(vm.bag.emptyLine, FINAL_SHEET_COPY.bagEmpty);
  const weapon = vm.worn.find((r) => r.key === "weapon");
  assert.equal(weapon.filled, false);
  assert.equal(weapon.note, GEAR_COPY.empty.weapon);
  for (const key of ["cloak", "jewelry1", "jewelry2"]) {
    assert.equal(vm.worn.find((r) => r.key === key).note, GEAR_COPY.empty[key]);
  }
  const { host } = renderInto(vm);
  const texts = textsOf(host);
  assert.equal(texts.filter((t) => t === FINAL_SHEET_COPY.bookNone).length, 1);
  assert.ok(texts.includes(FINAL_SHEET_COPY.bagEmpty));
});

test("HUD-03 empty: a Magic User with an empty book gets the caster's empty line", () => {
  const s = deadMagicUser();
  s.c.grimoire = [];
  const vm = finalSheetViewModel(s);
  assert.deepStrictEqual(vm.book.spells, []);
  assert.equal(vm.book.emptyLine, FINAL_SHEET_COPY.bookEmpty);
});

test("HUD-03 empty: no epitaph or deathNote leaves those lines out; null or undefined state gives an empty model", () => {
  const s = deadMagicUser();
  s.epitaph = "";
  delete s.deathNote;
  const vm = finalSheetViewModel(s);
  assert.equal(vm.death.epitaph, "");
  assert.equal(vm.death.cause, "");
  const { host } = renderInto(vm);
  const texts = textsOf(host);
  assert.ok(!texts.includes(""), "no empty text line is rendered");
  assert.ok(!texts.includes(FINAL_SHEET_COPY.epitaph));
  assert.ok(!texts.includes(FINAL_SHEET_COPY.cause));

  for (const bad of [null, undefined, {}, { c: null }, 42, "x"]) {
    let empty;
    assert.doesNotThrow(() => {
      empty = finalSheetViewModel(bad);
    });
    assert.equal(empty.empty, true);
    assert.deepStrictEqual(empty.stats, []);
    assert.deepStrictEqual(empty.worn, []);
    assert.deepStrictEqual(empty.bag.names, []);
    assert.deepStrictEqual(empty.book.spells, []);
    assert.deepStrictEqual(empty.tricks.rows, []);
    assert.deepStrictEqual(empty.death.facts, []);
    assert.doesNotThrow(() => renderInto(empty));
  }
});

test("HUD-03 read-only: the rendered sheet has no button, no onclick, no listener and no HTML-string write", () => {
  for (const s of [deadMagicUser(), deadFighter()]) {
    const { host, listeners } = renderInto(finalSheetViewModel(s));
    let elements = 0;
    walk(host, (n) => {
      if (n.nodeType === 3) return;
      elements++;
      assert.notEqual(n.tagName, "button");
      assert.notEqual(n.tagName, "a");
      assert.notEqual(n.tagName, "input");
      assert.equal(n.onclick, null);
      assert.notEqual(n._content.kind, "html");
      assert.notEqual(n.getAttribute("role"), "button");
      assert.equal(n.getAttribute("tabindex"), null);
    });
    assert.ok(elements > 10, "the sheet rendered its sections");
    assert.equal(listeners.length, 0);
  }
});

test("HUD-03 encoding: every rendered text equals a view-model string byte for byte (em dash, U+2212, U+2013 round-trip)", () => {
  const s = deadMagicUser();
  s.epitaph = "Here lies Corwin — who counted −3 twice, and 4–6 once.";
  s.c.name = "Mira Ash—Vale";
  const vm = finalSheetViewModel(s);
  assert.equal(vm.death.epitaph, s.epitaph);
  const { host } = renderInto(vm);
  const texts = textsOf(host);
  // The headings and labels are the sheet's own copy; everything else is the view model's.
  const pool = new Set([...vmStrings(vm), ...vmStrings(FINAL_SHEET_COPY)]);
  for (const t of texts) assert.ok(pool.has(t), `rendered text not in the view model: ${JSON.stringify(t)}`);
  assert.ok(texts.includes("Here lies Corwin — who counted −3 twice, and 4–6 once."));
  assert.ok(texts.includes("Mira Ash—Vale"));
  // Nothing is shortened in JS: a very long name and epitaph survive whole.
  const long = "A".repeat(400);
  s.epitaph = long;
  s.c.name = long;
  const vm2 = finalSheetViewModel(s);
  assert.equal(vm2.death.epitaph, long);
  assert.equal(vm2.who.name, long);
  assert.ok(textsOf(renderInto(vm2).host).filter((t) => t === long).length >= 2);
});

test("HUD-03 read-only: the view model never mutates the state", () => {
  const s = deadMagicUser();
  const before = JSON.stringify(s);
  finalSheetViewModel(s);
  assert.equal(JSON.stringify(s), before);
});

test("HUD-03 purity: the module reads no window/document globals, timers or storage, and builds DOM through host.ownerDocument", () => {
  const code = stripJs(MODULE_SRC);
  for (const banned of [/\bwindow\b/, /\bdocument\b/, /\bglobalThis\b/, /setTimeout|setInterval|requestAnimationFrame/, /localStorage|sessionStorage|Preferences/, /\.innerHTML\b/, /addEventListener|\.onclick\b/, /createElement\(\s*["']button/]) {
    assert.doesNotMatch(code, banned, `finalSheet.js must not use ${banned}`);
  }
  assert.match(code, /host\.ownerDocument/);
  assert.equal((MODULE_SRC.match(/export function finalSheetViewModel/g) || []).length, 1);
  assert.ok((code.match(/characterSheetViewModel\(/g) || []).length >= 1);
  assert.doesNotMatch(code, /applyAction|dispatch|stepWith/, "the sheet never reaches an engine action");
});

test("HUD-03 voice: FINAL_SHEET_COPY says HP never WP and is clear of a BANNED safety-wordlist term", () => {
  const leaves = vmStrings(FINAL_SHEET_COPY);
  assert.ok(Object.isFrozen(FINAL_SHEET_COPY));
  const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;
  const escaped = SAFETY_BANNED.filter((w) => !SAFETY_ALLOWLIST.includes(w)).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const bannedRe = new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
  for (const leaf of leaves) {
    assert.doesNotMatch(leaf, PLAYER_WP, leaf);
    assert.doesNotMatch(leaf, bannedRe, leaf);
  }
  const s = deadMagicUser();
  for (const t of vmStrings(finalSheetViewModel(s))) assert.doesNotMatch(t, PLAYER_WP, t);
});
