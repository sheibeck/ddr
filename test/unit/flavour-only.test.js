// test/unit/flavour-only.test.js
//
// Phase 97.1 (FLAVOR-07): the standing guards for "players see only the flavour lines".
//
// Phases 95 and 96 built a two-layer text model with a RULES control on every surface and an
// "Always show the rules" setting. Phase 97.1 retired both and kept the data: the exact rules
// text lives on in code (the content tables, the identity notes and footers, the view models'
// `rules` fields) because the v2.3 truth guards read it, and no screen draws it.
//
// This file keeps the machinery from coming back and the data from going missing:
//   1. the component file and its test are gone
//   2. no shipped source (mazeworld.html and every src/browser module) names the retired machinery
//   3. teeth for that matcher
//   4. the Always setting is gone
//   5. the docs make no promise of a RULES toggle or the Always switch
//   6. the exact rules data is still in code
//   7. a flavoured item's Gear sheet keeps its numeric stat rows and drops its effect sentence

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs, stripHtml } from "../../tools/ident-sweep.mjs";
import { SETTINGS_DEFAULTS } from "../../src/browser/settings.js";
import { RACE_NOTE, SUB_NOTE, CLASS_NOTE, SPELLS, ABILITIES, FIGHTER_SKILLS, THIEF_SKILLS } from "../../content/index.js";
import { footerLines } from "../../src/browser/identityFooter.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { renderGearSheet, gearSheetModel, GEAR_SHEET_IDS } from "../../src/browser/gearSheet.js";
import { flavorOfItem } from "../../src/browser/flavorText.js";
import { GEAR_COPY } from "../../src/browser/gearTab.js";
import { itemStatLines, wornItemFor } from "../../src/browser/viewModels.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8").replace(/\r\n/g, "\n");

// ─── 1. the component is gone ─────────────────────────────────────────────

test("the RULES component and its test are gone", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "src", "browser", "rulesLayer.js")), false, "src/browser/rulesLayer.js is deleted");
  assert.equal(fs.existsSync(path.join(ROOT, "test", "unit", "rules-layer.test.js")), false, "test/unit/rules-layer.test.js is deleted");
});

// ─── 2. no shipped source names the retired machinery ─────────────────────

const RETIRED = [
  /\brulesLayer\b/,
  /\bmountRules\b/,
  /\bwrapRow\b/,
  /\blayerText\b/,
  /\balwaysRules\b/,
  /\bsetAlwaysRules\b/,
  /\brulesOpen\b/,
  /\btoggleRulesOpen\b/,
  /\bclearRulesOpen\b/,
  /\bRULES_COPY\b/,
  /\b__mzRules\b/,
  /mw-rules-/,
  /RULES ▸/,
  /RULES ▾/,
];

/** Every retired token a comment-stripped source text still names. */
const retiredHits = (strippedText) => RETIRED.filter((re) => re.test(strippedText)).map((re) => String(re));

function shippedSources() {
  const out = [{ file: "mazeworld.html", stripped: stripHtml(read("mazeworld.html")) }];
  const dir = path.join(ROOT, "src", "browser");
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".js")).sort()) {
    out.push({ file: `src/browser/${name}`, stripped: stripJs(read("src", "browser", name)) });
  }
  return out;
}

test("no shipped source names the retired machinery", () => {
  const sources = shippedSources();
  assert.ok(sources.length > 10, "the page and the src/browser modules were read");
  const found = [];
  for (const { file, stripped } of sources) for (const hit of retiredHits(stripped)) found.push(`${file}: ${hit}`);
  assert.deepEqual(found, [], "the RULES machinery or the Always setting is back in the shipped source");
});

// ─── 3. teeth ─────────────────────────────────────────────────────────────

test("teeth: the matcher reports a call, a class and a toggle word, and passes clean source", () => {
  assert.ok(retiredHits("function f(d, h) { mountRules(d, h, spec); }").length > 0, "a mountRules call is reported");
  assert.ok(retiredHits('<button class="mw-rules-btn">x</button>').length > 0, "a mw-rules class is reported");
  assert.ok(retiredHits('const t = "RULES ▸";').length > 0, "a toggle word is reported");
  assert.ok(retiredHits("const s = { alwaysRules: false };").length > 0, "the Always key is reported");
  assert.deepEqual(retiredHits("function f(row) { return row.rules ? row.lead : row.desc; }"), [], "the model-side rules field is not a hit");
  // Comments are stripped before matching, so retirement prose is not a hit.
  assert.deepEqual(retiredHits(stripJs("// the old mountRules( call is retired\nconst x = 1;")), []);
});

// ─── 4. the Always setting is gone ────────────────────────────────────────

test("the Always setting is gone from the defaults and the page", () => {
  assert.equal("alwaysRules" in SETTINGS_DEFAULTS, false, "SETTINGS_DEFAULTS has no alwaysRules");
  assert.equal(/data-setting="alwaysRules"/.test(stripHtml(read("mazeworld.html"))), false, "the Settings sheet has no alwaysRules row");
});

// ─── 5. the docs make no promise of either ────────────────────────────────

test("the docs say flavour-only: no RULES toggle, no Always switch", () => {
  const layers = read("docs", "TEXT-LAYERS.md");
  const notes = read("docs", "patch-notes", "2.4.0.md");
  for (const [name, text] of [["docs/TEXT-LAYERS.md", layers], ["docs/patch-notes/2.4.0.md", notes]]) {
    assert.equal(text.includes("Always show the rules"), false, `${name} promises the Always switch`);
    assert.equal(text.includes("RULES toggle"), false, `${name} promises a RULES toggle`);
  }
  assert.ok(/^## Flavour only \(Phase 97\.1\)$/m.test(layers), "docs/TEXT-LAYERS.md has the Flavour only section");
});

// ─── 6. the exact rules data is still in code ─────────────────────────────

test("the exact rules data is still in code: the identity notes, footers, and the spell, ability and skill txt", () => {
  // Floors, not equalities: the content tables are pinned to the engine elsewhere; this is the "no rules data deleted" prohibition.
  assert.ok(Object.keys(RACE_NOTE).length >= 6, "RACE_NOTE keeps its six races");
  assert.ok(Object.keys(SUB_NOTE).length >= 24, "SUB_NOTE keeps its 24 sub-classes");
  assert.ok(Object.keys(CLASS_NOTE).length >= 3, "CLASS_NOTE keeps its three classes");
  for (const [name, table] of [["RACE_NOTE", RACE_NOTE], ["SUB_NOTE", SUB_NOTE], ["CLASS_NOTE", CLASS_NOTE]]) {
    for (const [key, note] of Object.entries(table)) assert.ok(typeof note === "string" && note.length > 0, `${name}.${key} is non-empty`);
  }
  for (const s of SPELLS) assert.ok(typeof s.txt === "string" && s.txt.length > 0, `spell ${s.n} keeps its txt`);
  for (const a of ABILITIES) assert.ok(typeof a.txt === "string" && a.txt.length > 0, `ability ${a.name} keeps its txt`);
  assert.ok(THIEF_SKILLS && typeof THIEF_SKILLS === "object", "THIEF_SKILLS is exported");
  assert.ok(typeof FIGHTER_SKILLS.Kata.txt === "string" && FIGHTER_SKILLS.Kata.txt.length > 0, "Kata keeps its txt");
  assert.ok(footerLines("sub", "Summoner").length > 0, "the Summoner identity footer still renders");
});

// ─── 7. the Gear sheet keeps its numbers and drops its rulebook sentence ──

function gearChar(overrides = {}) {
  return {
    cls: "Fighter", race: "Human", level: 1, weapon: "Long Sword", armor: "Leather", ar: 8, armorWP: 20, armorMax: 20, magicWpn: 0,
    gold: 250, items: [], worn: {}, bag: "small", potions: 2, scrolls: 0, rations: 3, kills: 2, wp: 4, maxWP: 10, timers: {}, ...overrides,
  };
}

const ANKLET = { kind: "jewel", n: "Anklet of Invisibility", txt: "used, foes aim at -2 for fifty squares; then fifty squares of visibility", eff: { foeToHit: -2 } };
const STUDDED = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };

const hasClass = (el, name) => String(el.className || "").split(/\s+/).includes(name);
const textOf = (el) => String(el.textContent ?? "");
function descendants(node, out = []) {
  for (const child of node.children || []) {
    if (child.nodeType === 3) continue;
    out.push(child);
    descendants(child, out);
  }
  return out;
}

function openSheet(state, target) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("mw-gear-sheet");
  assert.equal(renderGearSheet(host, state, target, {}), true);
  return { doc, get: (id) => doc.document.getElementById(GEAR_SHEET_IDS[id]) };
}

/** No node under (or at) the container has a class that starts mw-rules-. Returns the offending class names. */
const rulesClassesUnder = (root) => [root, ...descendants(root)].map((el) => String(el.className || "")).filter((c) => /(^|\s)mw-rules-/.test(c));

/** The container's children are exactly one plain stat row per expected text, in order, and no rules class sits anywhere under it. */
function assertStatRows(statsEl, expected, label) {
  assert.deepEqual(rulesClassesUnder(statsEl), [], `${label}: no rules class under the stats container`);
  if (expected.length === 0) {
    assert.equal(statsEl.hidden, true, `${label}: no row is left, so the container hides`);
    assert.equal(statsEl.children.length, 0, `${label}: no children`);
    return;
  }
  assert.equal(statsEl.hidden, false, `${label}: the stats container is shown`);
  assert.equal(statsEl.children.length, expected.length, `${label}: one row per numeric stat`);
  statsEl.children.forEach((row, i) => {
    assert.equal(String(row.tagName).toLowerCase(), "p", `${label}: row ${i} is a p`);
    assert.ok(hasClass(row, "mw-gsheet-note") && hasClass(row, "mw-gsheet-stat"), `${label}: row ${i} is a plain stat row`);
    assert.equal(textOf(row), expected[i], `${label}: row ${i} text`);
  });
}

/** The container does not carry this sentence anywhere in its text. */
const assertSentenceAbsent = (statsEl, sentence, label) => assert.equal(textOf(statsEl).includes(sentence), false, `${label}: the sentence is not drawn`);

const numericRows = (item, c) => itemStatLines(item, c).filter((l) => l.key !== "effect").map((l) => l.text);

test("a flavoured item's Gear sheet keeps its numeric stat rows and drops its effect sentence", () => {
  // (a) the worn Long Sword
  {
    const state = { c: gearChar() };
    const item = wornItemFor(state.c, "weapon");
    const expected = numericRows(item, state.c);
    assert.ok(expected.length > 0, "a weapon has numeric rows");
    const sheet = openSheet(state, { from: "worn", slot: "weapon" });
    assert.equal(textOf(sheet.get("note")), flavorOfItem(item), "the note slot shows the flavour line");
    assert.ok(flavorOfItem(item).length > 0, "the Long Sword has a flavour line");
    assertStatRows(sheet.get("stats"), expected, "worn Long Sword");
    assertSentenceAbsent(sheet.get("stats"), GEAR_COPY.weaponMundane, "worn Long Sword (the voice line)");
  }
  // (b) a bagged Studded armour
  {
    const state = { c: gearChar({ items: [STUDDED] }) };
    const expected = numericRows(STUDDED, state.c);
    assert.ok(expected.length >= 2, "an armour has its AR and wear rows at least");
    const sheet = openSheet(state, { from: "bag", i: 0, n: "Studded" });
    assert.equal(textOf(sheet.get("note")), flavorOfItem(STUDDED));
    assert.ok(flavorOfItem(STUDDED).length > 0, "Studded has a flavour line");
    assertStatRows(sheet.get("stats"), expected, "bagged Studded");
  }
  // (c) a bagged Anklet of Invisibility: every row it has is an effect row, so none is drawn
  {
    const state = { c: gearChar({ items: [ANKLET] }) };
    const rows = itemStatLines(ANKLET, state.c);
    assert.ok(rows.length > 0 && rows.every((l) => l.key === "effect"), "the Anklet's only rows are effect rows");
    const expected = numericRows(ANKLET, state.c);
    assert.deepEqual(expected, [], "so there is no numeric row to draw");
    const target = { from: "bag", i: 0, n: "Anklet of Invisibility" };
    const sheet = openSheet(state, target);
    assert.equal(textOf(sheet.get("note")), flavorOfItem(ANKLET));
    assert.ok(flavorOfItem(ANKLET).length > 0, "the Anklet has a flavour line");
    assertStatRows(sheet.get("stats"), expected, "bagged Anklet");
    assertSentenceAbsent(sheet.get("stats"), ANKLET.txt, "bagged Anklet (the effect row)");
    assert.ok(gearSheetModel(state, target).stats.includes(ANKLET.txt), "the model still lists the sentence for the guards");
  }
});

test("teeth: a container carrying a rules class or the effect sentence fails the checks", () => {
  const doc = createRecordingDocument().document;
  const make = (cls, text) => {
    const container = doc.createElement("div");
    container.hidden = false;
    const row = doc.createElement("p");
    row.className = cls;
    row.textContent = text;
    container.appendChild(row);
    return container;
  };
  const withRulesClass = make("mw-rules-line", "AR 10");
  assert.throws(() => assertStatRows(withRulesClass, ["AR 10"], "teeth"), /no rules class/, "a mw-rules-line row fails the no-rules-class check");
  const withEffect = make("mw-gsheet-note mw-gsheet-stat", ANKLET.txt);
  assert.throws(() => assertSentenceAbsent(withEffect, ANKLET.txt, "teeth"), /is not drawn/, "the effect sentence in a stat row fails the absence check");
  const clean = make("mw-gsheet-note mw-gsheet-stat", "AR 10");
  assert.doesNotThrow(() => assertStatRows(clean, ["AR 10"], "teeth"), "a plain stat row passes");
});
