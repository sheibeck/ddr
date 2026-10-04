// test/unit/flavor-sweep.test.js
//
// Phase 96 (FLAVOR-03, FLAVOR-04, FLAVOR-06; CONTEXT 'The review: The "no rulebook sentence left" proof'):
// the automated sweep behind ROADMAP criterion 4. The per-surface cases in
// rules-surfaces.test.js pin each surface's own details; this file is the
// cross-cutting sweep that would catch a surface added or changed later. It
// paints every surface that shows a player-layer description through the REAL
// classic paint(), renderEncounter() and renderRail() (test/unit/harness/
// shellSandbox.js) or the real module renderers, into a recording document,
// and applies the same four assertions to each one:
//
//   S1  every flavour line the surface should show occurs in its visible text
//       and states no digit, percent sign, die token or number word;
//   S2  no rules sentence (from an index built out of the content tables, the
//       footers, the shell's explanation tables and the surface's own stat
//       lines) occurs in the visible text outside a RULES body;
//   S3  the RULES bodies on the surface equal, line for line, the unchanged
//       rules text computed from the content tables, never from the DOM;
//   S4  with Always show the rules off every body has a toggle that controls
//       it and starts hidden (the opener surfaces, which carry no toggle by
//       design, have no body at all); with it on there is no toggle and every
//       body is visible.
//
// Adding a surface means adding one probe below: the coverage test ties the
// probes to the Surfaces table in docs/TEXT-LAYERS.md, so a surface listed there
// without a probe fails. The sweep reads and paints only. The second half of
// criterion 4 (a person reading every screen on a phone, Always show the rules
// off and on) is the milestone's Pixel 7 checklist, not this file.
//
// Every helper here is a per-file copy; nothing is imported across tests.

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { clearRulesOpen, setAlwaysRules, mountRules } from "../../src/browser/rulesLayer.js";
import { flavorOfItem, flavorOfSpell, flavorOfScroll, flavorOf } from "../../src/browser/flavorText.js";
import { GRIMOIRE_COPY } from "../../src/browser/heroTab.js";
import { footerLines, identityFooter } from "../../src/browser/identityFooter.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import {
  SPELLS, NICHE_LABELS, POTIONS, TOOLS, BAG_ITEMS, BAG_ORDER, JEWELRY, CLOAKS, STAVES, ABILITIES,
  FIGHTER_SKILLS, THIEF_SKILLS, RACES, RACE_NOTE, CLASS_NOTE, SUB_NOTE,
} from "../../content/index.js";
import { SPELL_FLAVOR, SCROLL_FLAVOR } from "../../content/spells.js";
import { WEAPON_FLAVOR } from "../../content/weapons.js";
import { ARMOR_FLAVOR } from "../../content/armors.js";
import { POTION_FLAVOR } from "../../content/potions.js";
import { MAGIC_ITEM_FLAVOR } from "../../content/treasure-tables.js";
import { newRun } from "../../engine/state.js";
import { rollJewel, rollBlade, rollMailPiece, stowItem, toolItem } from "../../engine/items.js";
import { offerFind } from "../../engine/encounters.js";
import { makeRng } from "../../engine/rng.js";
import { renderGearTab, GEAR_COPY, bagUsage, renderCarriedList } from "../../src/browser/gearTab.js";
import { usableBy, itemStatLines, wornItemFor, bagArmorText, dropShelfRows, lootCompare, storeRowState } from "../../src/browser/viewModels.js";
import { renderGearSheet, GEAR_SHEET_IDS } from "../../src/browser/gearSheet.js";
import { scrollReadOdds } from "../../src/browser/rollOdds.js";

setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const LAYERS_DOC = fs.readFileSync(path.join(ROOT, "docs", "TEXT-LAYERS.md"), "utf8").replace(/\r\n/g, "\n");

beforeEach(() => {
  clearRulesOpen();
  setAlwaysRules(false);
});

// ─── text helpers ─────────────────────────────────────────────────────────

/** Whitespace-normalised: runs of whitespace collapse to one space, ends trimmed. */
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };
const stripTags = (html) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m]);

// The number-word list is this file's own copy (flavor-layer.test.js keeps another). "one" is deliberately absent: idiom
// such as "no one" stays legal.
const NUMBER_WORDS = [
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty",
  "seventy", "eighty", "ninety", "hundred", "once", "twice", "half", "double",
];
const NUMBER_WORD_RE = new RegExp(`\\b(?:${NUMBER_WORDS.join("|")})\\b`, "i");
const DIE_RE = /\bd\d/i;

/** numberProblems(line) — the reasons `line` states a number, a die or a percentage. */
function numberProblems(line) {
  const out = [];
  if (/\d/.test(line)) out.push("digit");
  if (line.includes("%")) out.push("percent sign");
  if (DIE_RE.test(line)) out.push("die token");
  const w = NUMBER_WORD_RE.exec(line);
  if (w) out.push(`number word "${w[0]}"`);
  return out;
}

// ─── DOM helpers ──────────────────────────────────────────────────────────

const hasClass = (el, name) => String(el?.className || "").split(/\s+/).includes(name);

/** Every element under `root`, root included, depth first, text nodes skipped. */
function elementsUnder(root, out = []) {
  if (!root || root.nodeType === 3) return out;
  out.push(root);
  for (const child of root.children || []) elementsUnder(child, out);
  return out;
}

/**
 * visibleText(root) — what a player reads: each element's own text (the tag-stripped innerHTML for elements the code fills that way,
 * its text for elements filled with textContent) plus the recursion over children; a `.mw-rules-body` is skipped entirely and so is
 * any descendant with `hidden` set. Returned whitespace-normalised.
 */
function visibleText(root) {
  const parts = [];
  const visit = (el, isRoot) => {
    if (!el) return;
    if (el.nodeType === 3) { parts.push(el.textContent); return; }
    if (!isRoot && el.hidden === true) return;
    if (hasClass(el, "mw-rules-body")) return;
    const content = el._content;
    if (content && content.kind === "html") parts.push(stripTags(content.value));
    else if (content && content.kind === "text") parts.push(content.value);
    for (const child of el.children || []) visit(child, false);
  };
  visit(root, true);
  return norm(parts.join(" "));
}

const bodiesUnder = (root) => elementsUnder(root).filter((el) => hasClass(el, "mw-rules-body"));
const buttonsUnder = (root) => elementsUnder(root).filter((el) => hasClass(el, "mw-rules-btn"));

/** The `.mw-rules-line` texts of every RULES body under `root`, in document order. */
function rulesLinesUnder(root) {
  return bodiesUnder(root).flatMap((body) => elementsUnder(body).filter((el) => hasClass(el, "mw-rules-line")).map((p) => norm(p.textContent)));
}

// ─── the rules-text index ─────────────────────────────────────────────────

/**
 * readTable(name) — one `const NAME = { ... };` object literal out of the classic script, evaluated. It tries each `};` after the
 * head until the slice parses, so a `};` inside a comment cannot end it early.
 */
function readTable(name) {
  const head = `const ${name} = {`;
  const at = HTML.indexOf(head);
  assert.ok(at >= 0, `${name} is declared in mazeworld.html`);
  const start = at + head.length - 1;
  for (let end = HTML.indexOf("};", start); end !== -1; end = HTML.indexOf("};", end + 1)) {
    try {
      const table = new Function(`return (${HTML.slice(start, end + 1)});`)();
      if (table && typeof table === "object") return table;
    } catch {
      // not the end of the literal yet
    }
  }
  return assert.fail(`${name} could not be read out of mazeworld.html`);
}

const SHELL_TABLES = ["CONDITION_EXPLAIN", "FOE_EFFECT_EXPLAIN", "HERO_OUT_EXPLAIN", "HASTE_SPELL_EXPLAIN"];
const shellTables = () => Object.fromEntries(SHELL_TABLES.map((name) => [name, readTable(name)]));

/** The lockpicks line is built in the engine and sold through the store; the store's own stock row holds it. */
function lockpicksText() {
  const line = fixedStates().thiefStore.store.stock.find((l) => l.effectId === "giveLockpicks");
  assert.ok(line && line.effectParams.item.txt, "the store sells lockpicks");
  return line.effectParams.item.txt;
}

/** The "New trick" line the UP YOUR SLEEVE card carries behind RULES, for an ability row. */
const newTrickLine = (ability) => `New trick: ${ability.name} — ${ability.txt}`;

/** buildRulesIndex() — every rules sentence the layers hide, as a normalised Set (at least twelve characters each). */
function buildRulesIndex() {
  const out = new Set();
  const add = (s) => {
    if (typeof s !== "string") return;
    const n = norm(s);
    if (n.length >= 12) out.add(n);
  };
  for (const sp of SPELLS) add(sp.txt);
  add(GRIMOIRE_COPY.resistNote);
  for (const p of POTIONS) add(p.txt);
  for (const t of Object.values(TOOLS)) add(t.txt);
  for (const b of Object.values(BAG_ITEMS)) add(b.txt);
  for (const row of [...JEWELRY, ...CLOAKS, ...STAVES]) add(row.txt);
  add(lockpicksText());
  for (const a of ABILITIES) { add(a.txt); add(newTrickLine(a)); }
  for (const row of [...Object.values(FIGHTER_SKILLS), ...Object.values(THIEF_SKILLS)]) { add(row.txt); add(row.txt2); }
  for (const map of [RACE_NOTE, CLASS_NOTE, SUB_NOTE]) for (const v of Object.values(map)) add(v);
  for (const race of Object.values(RACES)) add(race.note);
  // The footers, as the displayed lines and as the single good, bad and neutral entries they are joined from: a leak could be one clause.
  for (const [kind, keys] of [["race", Object.keys(RACES)], ["sub", Object.keys(SUB_NOTE)]]) {
    for (const key of keys) {
      for (const line of footerLines(kind, key)) add(line);
      const f = identityFooter(kind, key);
      for (const entry of [...f.good, ...f.bad, f.neutral]) add(entry);
    }
  }
  add(COMBAT_MENU_COPY.potionDesc);
  add(COMBAT_MENU_COPY.scrollDesc);
  add(COMBAT_MENU_COPY.singDesc);
  add(GEAR_COPY.healingDesc);
  add(GEAR_COPY.scrollDesc);
  for (const table of Object.values(shellTables())) for (const v of Object.values(table)) add(v);
  return out;
}

const BASE_INDEX = buildRulesIndex();

/** The base index plus a probe's own rules strings (the stat lines of the items it paints). */
function indexWith(extra = []) {
  const out = new Set(BASE_INDEX);
  for (const s of extra) {
    const n = norm(s);
    if (n.length >= 12) out.add(n);
  }
  return out;
}

// ─── the four assertions; each returns an array of problems ────────────────

/** S1 — every flavour line occurs in the visible text and states no number. */
function assertS1(flavours, text) {
  const out = [];
  const seen = norm(text);
  for (const f of flavours) {
    if (!norm(f)) { out.push("S1: an empty flavour line"); continue; }
    if (!seen.includes(norm(f))) out.push(`S1: the flavour line is not in the visible text: "${f}"`);
    for (const reason of numberProblems(f)) out.push(`S1: the flavour line states a number (${reason}): "${f}"`);
  }
  return out;
}

/** S2 — no rules sentence of the index occurs in the visible text. */
function assertS2(text, index) {
  const seen = norm(text);
  const out = [];
  for (const sentence of index) if (seen.includes(sentence)) out.push(`S2: a rules sentence is in the visible text: "${sentence}"`);
  return out;
}

/** S3 — the RULES bodies' lines equal the unchanged rules text, line for line. */
function assertS3(expected, actual) {
  const want = expected.map(norm);
  const got = actual.map(norm);
  const out = [];
  if (want.length !== got.length) out.push(`S3: ${got.length} body lines on the surface, ${want.length} expected`);
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) out.push(`S3: body line ${i} is ${JSON.stringify(got[i])}, expected ${JSON.stringify(want[i])}`);
  }
  return out;
}

/**
 * S4 — the toggle contract under `root`. Always off: an opener surface has no body and no toggle; any other has, for every body, a
 * toggle whose aria-controls names it, the body hidden and the toggle collapsed, and no toggle without a body. Always on: no toggle,
 * and every body visible.
 */
function assertS4(root, always, openers = false) {
  const out = [];
  const bodies = bodiesUnder(root);
  const buttons = buttonsUnder(root);
  if (always) {
    if (buttons.length) out.push(`S4: ${buttons.length} RULES toggle(s) with Always show the rules on`);
    for (const body of bodies) if (body.hidden !== false) out.push(`S4: body ${body.id || "(no id)"} is not visible with Always show the rules on`);
    return out;
  }
  if (openers) {
    if (bodies.length) out.push(`S4: an opener surface carries ${bodies.length} RULES body(ies)`);
    if (buttons.length) out.push(`S4: an opener surface carries ${buttons.length} RULES toggle(s)`);
    return out;
  }
  for (const body of bodies) {
    const own = buttons.filter((b) => b.getAttribute("aria-controls") === body.id && body.id);
    if (own.length !== 1) out.push(`S4: body ${body.id || "(no id)"} has ${own.length} controlling toggles, expected 1`);
    else if (own[0].getAttribute("aria-expanded") !== "false") out.push(`S4: toggle for ${body.id} starts expanded`);
    if (body.hidden !== true) out.push(`S4: body ${body.id || "(no id)"} does not start hidden`);
  }
  for (const button of buttons) {
    if (!bodies.some((b) => b.id && b.id === button.getAttribute("aria-controls"))) out.push(`S4: a toggle controls no body (${button.getAttribute("aria-controls")})`);
  }
  return out;
}

// ─── the probe table and its runner ────────────────────────────────────────

const PROBES = [];

/**
 * probe(covers, { variant, paint, expect }) — one surface state. `paint()` (sync or async) paints with the current Always setting and
 * returns the painted root elements; `expect()` returns { flavours, bodies, extraRules, openers? } computed from the lookups and the
 * content tables. A surface with several states (a weapon and an armour, a harmful and a helpful chip) paints them all inside one probe.
 */
function probe(covers, spec) {
  PROBES.push({ covers, variant: "", ...spec });
}

/** sweepProbe(p) — runs S1 to S4 with Always off and on and returns every problem found. */
async function sweepProbe(p) {
  const problems = [];
  for (const always of [false, true]) {
    clearRulesOpen();
    setAlwaysRules(always);
    const roots = await p.paint();
    const exp = p.expect();
    const tag = (list) => list.map((s) => `[${p.covers}${p.variant ? ` / ${p.variant}` : ""}, Always ${always ? "on" : "off"}] ${s}`);
    // The vacuity guards: a probe must name flavour lines and rules bodies, and must paint something.
    if (!Array.isArray(roots) || !roots.length) problems.push(...tag(["the probe painted no root"]));
    if (!exp.flavours.length) problems.push(...tag(["vacuous: the probe expects no flavour line"]));
    if (!exp.bodies.length) problems.push(...tag(["vacuous: the probe expects no RULES body"]));
    const text = roots.map(visibleText).join(" ");
    const lines = roots.flatMap(rulesLinesUnder);
    problems.push(...tag(assertS1(exp.flavours, text)));
    problems.push(...tag(assertS2(text, indexWith(exp.extraRules))));
    problems.push(...tag(assertS3(exp.openers && !always ? [] : exp.bodies, lines)));
    for (const root of roots) problems.push(...tag(assertS4(root, always, !!exp.openers)));
  }
  return problems;
}

// ─── Test 1: the index ────────────────────────────────────────────────────

test("index: the rules index is built from the content tables and the shell tables, and is not vacuous", () => {
  assert.ok(BASE_INDEX.size >= 300, `the index holds ${BASE_INDEX.size} strings, at least 300 expected`);
  for (const s of BASE_INDEX) assert.ok(s.length >= 12 && s === norm(s), `index entry is normalised and long enough: ${s}`);
  const heal = SPELLS.find((s) => s.n === "Heal");
  assert.ok(BASE_INDEX.has(norm(heal.txt)), "Heal's txt");
  assert.ok(BASE_INDEX.has(norm(RACE_NOTE.Troll)), "the Troll's RACE_NOTE");
  assert.ok(BASE_INDEX.has(norm(footerLines("race", "Elven")[0])), "a footer line");
  assert.ok(BASE_INDEX.has(norm(FIGHTER_SKILLS.Kata.txt)), "Kata's txt");
  assert.ok(BASE_INDEX.has(norm(shellTables().HASTE_SPELL_EXPLAIN["Speed of Sound"])), "the haste explanation");
  assert.ok(BASE_INDEX.has(norm(GRIMOIRE_COPY.resistNote)), "the resist sentence");
  assert.ok(BASE_INDEX.has(norm(lockpicksText())), "the lockpicks line");
  const tables = shellTables();
  for (const name of SHELL_TABLES) assert.ok(Object.keys(tables[name]).length >= 1, `${name} was found and holds sentences`);
  assert.ok(Object.keys(tables.CONDITION_EXPLAIN).length >= 20, "CONDITION_EXPLAIN holds its sentences");
  assert.equal(indexWith(["short"]).size, BASE_INDEX.size, "a probe string under twelve characters is not indexed");
  assert.equal(indexWith(["A probe-specific rules sentence."]).size, BASE_INDEX.size + 1);
});

// ─── Test 2: the teeth ────────────────────────────────────────────────────

/** A tiny surface: one flavour slot, then the real RULES pair for `rules` (mountRules), in a recording document. */
function fragment({ flavor, rules, id = "teeth:one" }) {
  const { document } = createRecordingDocument();
  const root = document.createElement("div");
  const slot = document.createElement("p");
  slot.textContent = flavor;
  root.appendChild(slot);
  const mounted = mountRules(document, root, { id, name: "the fragment", rules });
  return { document, root, slot, mounted };
}

const HEAL_TXT = SPELLS.find((s) => s.n === "Heal").txt;

test("teeth: a clean fragment passes S1, S2, S3 and S4, Always off and on", () => {
  for (const always of [false, true]) {
    clearRulesOpen();
    setAlwaysRules(always);
    const { root } = fragment({ flavor: "A warm and slightly smug glow.", rules: [HEAL_TXT] });
    const text = visibleText(root);
    assert.deepEqual(assertS1(["A warm and slightly smug glow."], text), []);
    assert.deepEqual(assertS2(text, BASE_INDEX), []);
    assert.deepEqual(assertS3([HEAL_TXT], rulesLinesUnder(root)), []);
    assert.deepEqual(assertS4(root, always, false), []);
  }
});

test("teeth: S2 fails when the flavour slot holds a rules sentence, and passes once it sits in a RULES body", () => {
  const { root, slot } = fragment({ flavor: HEAL_TXT, rules: [HEAL_TXT] });
  assert.equal(slot.textContent, HEAL_TXT);
  const problems = assertS2(visibleText(root), BASE_INDEX);
  assert.ok(problems.length >= 1 && problems[0].startsWith("S2:"), problems.join("\n"));
  // The same sentence inside the body is invisible to the sweep.
  const ok = fragment({ flavor: "A warm and slightly smug glow.", rules: [HEAL_TXT] });
  assert.deepEqual(assertS2(visibleText(ok.root), BASE_INDEX), []);
  // A rules sentence set through innerHTML is read too, tags stripped.
  const { document } = createRecordingDocument();
  const html = document.createElement("div");
  html.innerHTML = `<b>Heal</b><i>${HEAL_TXT}</i>`;
  assert.ok(assertS2(visibleText(html), BASE_INDEX).length >= 1, "an innerHTML flavour slot is swept");
});

test("teeth: S3 fails when a body line has one digit changed, and when a line is missing or extra", () => {
  const { root } = fragment({ flavor: "A warm and slightly smug glow.", rules: [HEAL_TXT] });
  const lines = rulesLinesUnder(root);
  assert.deepEqual(assertS3([HEAL_TXT], lines), []);
  const changed = HEAL_TXT.replace(/\d+/, (d) => String(Number(d) + 1));
  assert.notEqual(changed, HEAL_TXT, "the doctored line really differs");
  assert.ok(assertS3([changed], lines).length >= 1, "a changed digit fails S3");
  assert.ok(assertS3([HEAL_TXT, HEAL_TXT], lines).length >= 1, "a missing line fails S3");
  assert.ok(assertS3([], lines).length >= 1, "an extra line fails S3");
});

test("teeth: S1 fails on a digit, a number word, a percent sign, a die token and an absent flavour line", () => {
  assert.ok(assertS1(["Hits for 10."], "Hits for 10.").some((p) => p.includes("digit")));
  assert.ok(assertS1(["Twice as sharp."], "Twice as sharp.").some((p) => p.includes("number word")));
  assert.ok(assertS1(["Mostly harmless."], "Mostly harmless. 50%").length === 0, "a percent sign outside the flavour line is not the flavour line's");
  assert.ok(assertS1(["Sharp to the last d."], "Sharp to the last d.").length === 0, "a lone d is no die token");
  assert.ok(assertS1(["Rolls a d. Then a d6 more."], "Rolls a d. Then a d6 more.").some((p) => p.includes("die token")));
  assert.ok(assertS1(["Up 5% on a good day."], "Up 5% on a good day.").some((p) => p.includes("percent sign")));
  assert.ok(assertS1(["A warm glow."], "Something else entirely.").some((p) => p.includes("not in the visible text")));
  assert.deepEqual(assertS1(["No one is ever ready."], "No one is ever ready."), [], "'no one' is idiom, not a number word");
});

test("teeth: S4 fails for an orphan body with no controlling toggle, a body that starts open, and a toggle left on with Always on", () => {
  const { document } = createRecordingDocument();
  const orphan = document.createElement("div");
  const body = document.createElement("div");
  body.className = "mw-rules-body";
  body.id = "mw-rules-orphan";
  body.hidden = true;
  orphan.appendChild(body);
  assert.ok(assertS4(orphan, false, false).some((p) => p.includes("controlling toggles")), "an orphan body fails S4");

  // A toggle that names some other id controls nothing.
  const wrong = document.createElement("button");
  wrong.className = "mw-rules-btn";
  wrong.setAttribute("aria-controls", "mw-rules-elsewhere");
  wrong.setAttribute("aria-expanded", "false");
  orphan.appendChild(wrong);
  assert.ok(assertS4(orphan, false, false).length >= 2, "the wrong toggle neither controls the body nor controls a body");

  // A real pair that starts open fails; the same pair passes closed.
  clearRulesOpen();
  setAlwaysRules(false);
  const real = fragment({ flavor: "A warm and slightly smug glow.", rules: [HEAL_TXT] });
  assert.deepEqual(assertS4(real.root, false, false), []);
  bodiesUnder(real.root)[0].hidden = false;
  assert.ok(assertS4(real.root, false, false).some((p) => p.includes("does not start hidden")));
  // An opener surface must carry neither a body nor a toggle.
  assert.ok(assertS4(real.root, false, true).length >= 1);

  // Always on: a leftover toggle fails, and so does a hidden body.
  assert.ok(assertS4(real.root, true, false).some((p) => p.includes("toggle")), "a toggle with Always on fails S4");
  setAlwaysRules(true);
  const on = fragment({ flavor: "A warm and slightly smug glow.", rules: [HEAL_TXT], id: "teeth:two" });
  assert.deepEqual(assertS4(on.root, true, false), []);
  bodiesUnder(on.root)[0].hidden = true;
  assert.ok(assertS4(on.root, true, false).some((p) => p.includes("not visible")));
});

test("teeth: a probe that paints nothing, names no flavour or expects no body is reported, not passed", async () => {
  const nothing = { covers: "teeth", variant: "", paint: () => [], expect: () => ({ flavours: [], bodies: [], extraRules: [] }) };
  const problems = await sweepProbe(nothing);
  assert.ok(problems.some((p) => p.includes("painted no root")));
  assert.ok(problems.some((p) => p.includes("expects no flavour line")));
  assert.ok(problems.some((p) => p.includes("expects no RULES body")));
  // A probe whose expected body is doctored goes red on S3 through the real runner.
  const doctored = {
    covers: "teeth", variant: "",
    paint: () => [fragment({ flavor: "A warm and slightly smug glow.", rules: [HEAL_TXT] }).root],
    expect: () => ({ flavours: ["A warm and slightly smug glow."], bodies: [HEAL_TXT.replace(/\d+/, "99")], extraRules: [] }),
  };
  assert.ok((await sweepProbe(doctored)).some((p) => p.includes("S3:")));
  // And the same probe with the true body is green.
  const honest = { ...doctored, expect: () => ({ flavours: ["A warm and slightly smug glow."], bodies: [HEAL_TXT], extraRules: [] }) };
  assert.deepEqual(await sweepProbe(honest), []);
});

// ─── shared setup, copied by value from rules-surfaces.test.js ────────────

const tap = (button) => button.onclick({ stopPropagation() {} });
void tap;

function foe(overrides = {}) {
  return { name: "Cave Rat", type: "Beasts", lvl: 1, size: "S", intel: 10, wp: 40, maxWP: 40, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

/** A mid-fight Magic User with a potion, a scroll and two spells, below full hp so the potion row is enabled. */
function fightState(cOverrides = {}) {
  const state = fixedStates().mu;
  Object.assign(state.c, {
    level: 3, wp: 20, maxWP: 40, potions: 2, scrolls: 1, grimoire: ["Heal", "Freeze"], spellsUsed: 0, items: [], abilities: [], ...cOverrides,
  });
  state.combat = { foes: [foe()], type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you", pending: false };
  return state;
}

function openMenu(state, which) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.context.window.__mzCombatMenu = { open: which };
  sandbox.context.renderEncounter();
  return { doc, sandbox, list: doc.document.getElementById("cb-sub-list") };
}

function paintFind(pendingFind, cls = "Fighter") {
  const state = newRun(9, [], { force: { cls } });
  if (pendingFind) state.pendingFind = pendingFind;
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false });
  sandbox.setState(state);
  sandbox.context.window.__mzPendingNarration = null;
  sandbox.context.renderRail();
  return { doc, sandbox, state, lines: doc.document.getElementById("mw-rail-lines") };
}

function gearChar(overrides = {}) {
  return {
    cls: "Fighter", race: "Human", level: 1, weapon: "Long Sword", armor: "Leather", ar: 8, armorWP: 20, armorMax: 20, magicWpn: 0,
    gold: 250, items: [], worn: {}, bag: "small", potions: 2, scrolls: 0, rations: 3, kills: 2, wp: 4, maxWP: 10, timers: {},
    ...overrides,
  };
}

const RING = { kind: "jewel", n: "Ring of Power", txt: "used, it adds +1 damage to every attack for fifty squares; then fifty squares of quiet", eff: { dmg: 1 } };
const ANKLET = { kind: "jewel", n: "Anklet of Invisibility", txt: "used, foes aim at -2 for fifty squares; then fifty squares of visibility", eff: { foeToHit: -2 } };

function gearDeps() {
  const spy = () => Object.assign((...a) => spy.calls.push(a), { calls: [] });
  return { useItem: spy(), unequip: spy(), equipItem: spy(), dropItem: spy(), drinkPotion: spy(), readScroll: spy(), openGearSheet: spy() };
}

function paintGear(state) {
  const doc = createRecordingDocument();
  renderGearTab(doc.document.getElementById("screen-gear"), state, gearDeps());
  return doc;
}

function paintStore(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.renderEncounter();
  return { doc, sandbox, shelf: doc.document.getElementById("shelf"), sell: doc.document.getElementById("sell-list") };
}

// bagState and findScenario are copied by value from find-card-full-bag.test.js (the drop shelf's real find card).
function fullBagState({ seed = 7 } = {}) {
  const state = newRun(seed, [], { force: { cls: "Fighter" } });
  const largest = BAG_ORDER[BAG_ORDER.length - 1];
  stowItem(state, { ...BAG_ITEMS[largest] }, [], true);
  const rng = makeRng(31);
  const makers = [() => rollBlade(rng, 3, true), () => rollMailPiece(rng), () => rollJewel(rng), () => toolItem("rope"), () => rollBlade(rng, 5, false)];
  let k = 0;
  while (bagUsage(state.c).slots - bagUsage(state.c).have > 0) {
    stowItem(state, makers[k++ % makers.length](), [], true);
    assert.ok(k < 100, "the bag fills");
  }
  return state;
}

function findShelf(state, find) {
  offerFind(state, find, []);
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false });
  sandbox.context.window.mzDropItem = () => {};
  sandbox.setState(state);
  sandbox.context.window.__mzPendingNarration = null;
  sandbox.context.renderRail();
  const linesEl = doc.document.getElementById("mw-rail-lines");
  const region = linesEl.children.find((el) => hasClass(el, "mw-find-drop"));
  assert.ok(region, "the drop region is rendered");
  return { doc, sandbox, region };
}

/**
 * The loot card's list. The recording document cannot parse the card's innerHTML, so the sandbox cannot reach the loot branch;
 * renderCarriedList is called directly with the SAME options object the branch passes, read from mazeworld.html's source.
 */
function lootOptions(c) {
  const head = 'window.__mzCarriedList(wrap.querySelector("#loot-list"), S, S.pendingLoot, ';
  const from = HTML.indexOf(head);
  assert.ok(from >= 0, "the loot branch's options object is in mazeworld.html");
  const start = from + head.length;
  const end = HTML.indexOf(", tabDeps());", start);
  const literal = HTML.slice(start, end);
  assert.ok(literal.startsWith("{") && literal.endsWith("}") && literal.includes("adviceFor"), "the options literal");
  const window = { __mzLootCompare: lootCompare };
  return new Function("window", "c", "return (" + literal + ");")(window, c);
}

function paintLoot(state) {
  const doc = createRecordingDocument();
  const list = doc.document.createElement("ul");
  list.id = "loot-list";
  const deps = { guardTap: (button, fn) => { button.onclick = fn; } };
  renderCarriedList(list, state, state.pendingLoot, lootOptions(state.c), deps);
  return list;
}

// ─── the 13 Phase 95 surfaces ─────────────────────────────────────────────

/** The spells in the order the Grimoire and the combat menu list them: by level, then by name. */
const inListOrder = (names) => names.map((n) => SPELLS.find((s) => s.n === n)).sort((a, b) => a.lvl - b.lvl || a.n.localeCompare(b.n));
const resisted = (sp) => `${sp.txt} · ${GRIMOIRE_COPY.resistNote}`;

probe("Grimoire", {
  paint: () => {
    const state = fixedStates().mu;
    state.c.grimoire = ["Heal", "Doze"];
    const doc = createRecordingDocument();
    const sandbox = loadShellSandbox({ doc });
    sandbox.setState(state);
    sandbox.paint();
    return [doc.document.getElementById("s-grimoire")];
  },
  expect: () => ({
    flavours: ["Heal", "Doze"].map((n) => flavorOfSpell(n)),
    bodies: inListOrder(["Heal", "Doze"]).map((sp) => (sp.n === "Heal" ? sp.txt : resisted(sp))),
    extraRules: [],
  }),
});

probe("Combat SPELLS rows", {
  paint: () => [openMenu(fightState(), "spells").list],
  expect: () => ({
    flavours: ["Heal", "Freeze"].map((n) => flavorOfSpell(n)),
    bodies: inListOrder(["Heal", "Freeze"]).map((sp) => (sp.n === "Heal" ? sp.txt : resisted(sp))),
    extraRules: [],
  }),
});

/** The same fight, with a Ring of Power worn: its row is an item row (flavour leads, the ring's txt behind RULES). */
const ringFightState = () => fightState({ grimoire: [], worn: { jewelry1: RING, jewelry2: null, cloak: null } });

probe("Combat ITEMS rows (items, potion counter, scroll)", {
  paint: () => [openMenu(fightState(), "items").list, openMenu(ringFightState(), "items").list],
  expect: () => {
    const counter = [COMBAT_MENU_COPY.potionDesc, `${COMBAT_MENU_COPY.scrollDesc} ${scrollReadOdds(fightState())}`];
    return {
      flavours: [flavorOf("potion", "Healing"), flavorOfScroll(), MAGIC_ITEM_FLAVOR["Ring of Power"]],
      bodies: [...counter, ...counter, RING.txt],
      extraRules: [RING.txt],
    };
  },
});

probe("Find card", {
  paint: () => [
    paintFind(rollJewel(makeRng(5))).lines,
    paintFind(rollBlade(makeRng(5), 4, true)).lines,
    paintFind(rollMailPiece(makeRng(7))).lines,
  ],
  expect: () => {
    const jewel = rollJewel(makeRng(5));
    const blade = rollBlade(makeRng(5), 4, true);
    const mail = rollMailPiece(makeRng(7));
    return {
      flavours: [jewel, blade, mail].map((it) => flavorOfItem(it)),
      bodies: [jewel.txt, blade.txt, bagArmorText(mail)],
      extraRules: [jewel.txt, blade.txt, bagArmorText(mail)],
    };
  },
});

probe("Gear WORN rows", {
  paint: () => [paintGear({ c: gearChar({ worn: { jewelry1: RING } }) }).document.getElementById("gear-worn")],
  expect: () => ({
    flavours: [MAGIC_ITEM_FLAVOR["Ring of Power"], WEAPON_FLAVOR["Long Sword"]],
    bodies: [GEAR_COPY.weaponMundane, RING.txt], // the WORN list runs weapon, armour, cloak, jewelry
    extraRules: [RING.txt, GEAR_COPY.weaponMundane, GEAR_COPY.weaponMagic],
    openers: true,
  }),
});

probe("Gear BAG cards", {
  paint: () => {
    const studded = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };
    return [paintGear({ c: gearChar({ items: [ANKLET, studded] }) }).document.getElementById("gear-bag")];
  },
  expect: () => {
    const studded = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };
    const usable = usableBy(studded, gearChar());
    return {
      flavours: [MAGIC_ITEM_FLAVOR["Anklet of Invisibility"], ARMOR_FLAVOR.Studded],
      bodies: [ANKLET.txt, usable ? `AR 10 · 18/18 hp ${usable}` : "AR 10 · 18/18 hp"],
      extraRules: [ANKLET.txt, usable ? `AR 10 · 18/18 hp ${usable}` : "AR 10 · 18/18 hp"],
      openers: true,
    };
  },
});

probe("Gear CONSUMABLES", {
  paint: () => [paintGear({ c: gearChar({ scrolls: 2 }) }).document.getElementById("gear-cons")],
  expect: () => ({
    flavours: [POTION_FLAVOR.Healing, SCROLL_FLAVOR],
    bodies: [GEAR_COPY.healingDesc, `${GEAR_COPY.scrollDesc} ${scrollReadOdds({ c: gearChar({ scrolls: 2 }) })}`],
    extraRules: [],
  }),
});

/** The Gear sheet's note, stats, actions and title elements for a target, after the real renderGearSheet. */
function paintGearSheet(state, target) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("mw-gear-sheet");
  assert.equal(renderGearSheet(host, state, target, {}), true);
  return ["title", "note", "stats", "actions"].map((id) => doc.document.getElementById(GEAR_SHEET_IDS[id]));
}

probe("Gear sheet", {
  paint: () => [
    ...paintGearSheet({ c: gearChar({ items: [ANKLET] }) }, { from: "bag", i: 0, n: "Anklet of Invisibility" }),
    ...paintGearSheet({ c: gearChar() }, { from: "worn", slot: "weapon" }),
  ],
  expect: () => {
    const bag = { c: gearChar({ items: [ANKLET] }) };
    const worn = { c: gearChar() };
    const anklet = itemStatLines(ANKLET, bag.c).map((l) => l.text);
    const weapon = itemStatLines(wornItemFor(worn.c, "weapon"), worn.c).map((l) => l.text);
    return {
      flavours: [MAGIC_ITEM_FLAVOR["Anklet of Invisibility"], WEAPON_FLAVOR["Long Sword"]],
      bodies: [...anklet, GEAR_COPY.weaponMundane, ...weapon],
      extraRules: [...anklet, GEAR_COPY.weaponMundane, ...weapon],
    };
  },
});

/**
 * What a store shelf must show: for every stock line carrying an item, its flavour and (when the old italic stat text is not empty)
 * that exact text as the RULES body; the Sealed scroll's flavour and its scroll rules with the reader's odds.
 */
function storeExpect(state) {
  const c = state.c;
  const flavours = [];
  const bodies = [];
  for (const line of state.store.stock) {
    if (line.effectId === "buyScroll") {
      flavours.push(flavorOfScroll());
      bodies.push(`${GEAR_COPY.scrollDesc} ${scrollReadOdds(state)}`);
      continue;
    }
    const item = line.effectParams && line.effectParams.item;
    if (!item) continue;
    const flavor = flavorOfItem(item);
    if (!flavor) continue;
    const rs = storeRowState(c, line);
    const stats = itemStatLines(item, c).filter((l) => rs.showUsable || l.key !== "usable").map((l) => l.text);
    const old = stats.length ? stats.join(" · ") : line.sub;
    flavours.push(flavor);
    if (old) bodies.push(old);
  }
  return { flavours, bodies, extraRules: bodies };
}

probe("Store stock rows", {
  paint: () => [paintStore(fixedStates().thiefStore).shelf],
  expect: () => storeExpect(fixedStates().thiefStore),
});

probe("Sealed scroll", {
  paint: () => [paintStore(fixedStates().muStore).shelf],
  expect: () => {
    const exp = storeExpect(fixedStates().muStore);
    assert.ok(exp.flavours.includes(flavorOfScroll()), "the mu store sells the Sealed scroll");
    return exp;
  },
});

probe("Your gear sell list", {
  paint: () => [paintStore(fixedStates().thiefStore).sell],
  expect: () => {
    const state = fixedStates().thiefStore;
    const flavours = [];
    const bodies = [];
    for (const it of state.c.items) {
      const flavor = flavorOfItem(it);
      if (!flavor) continue;
      flavours.push(flavor);
      bodies.push(it.kind === "armor" ? bagArmorText(it) : (it.txt ?? ""));
    }
    return { flavours, bodies, extraRules: bodies };
  },
});

probe("Loot list", {
  paint: () => {
    const state = newRun(9, [], { force: { cls: "Fighter" } });
    state.pendingLoot = [rollBlade(makeRng(5), 4, true), rollJewel(makeRng(6))];
    return [paintLoot(state)];
  },
  expect: () => {
    const state = newRun(9, [], { force: { cls: "Fighter" } });
    const blade = rollBlade(makeRng(5), 4, true);
    const jewel = rollJewel(makeRng(6));
    const cmp = lootCompare(state.c, blade);
    const oldBlade = (cmp.sub ? `${cmp.line} · ${cmp.sub}` : cmp.line) + (cmp.usable ? ` ${cmp.usable}` : "");
    return { flavours: [flavorOfItem(blade), flavorOfItem(jewel)], bodies: [oldBlade, jewel.txt], extraRules: [oldBlade, jewel.txt] };
  },
});

probe("Drop shelf", {
  paint: () => [findShelf(fullBagState(), rollBlade(makeRng(5), 4, true)).region],
  expect: () => {
    const rows = dropShelfRows(fullBagState().c).filter((row) => flavorOfItem(row.it));
    assert.ok(rows.length >= 3, "the fixture bag holds several flavoured items");
    return { flavours: rows.map((row) => flavorOfItem(row.it)), bodies: rows.map((row) => row.stats), extraRules: rows.map((row) => row.stats) };
  },
});

// ─── Test 3: the surfaces ─────────────────────────────────────────────────

// <<probes-96>>

// ─── the runner loop ──────────────────────────────────────────────────────

for (const p of PROBES) {
  test(`surface ${p.covers}${p.variant ? ` (${p.variant})` : ""}: S1 to S4 hold with Always show the rules off and on`, async () => {
    const problems = await sweepProbe(p);
    assert.deepEqual(problems, []);
  });
}
