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
import { flavorOfItem, flavorOfSpell, flavorOfScroll, flavorOf, flavorOfChip, flavorOfIdentity, flavorOfAbility, flavorOfSkill } from "../../src/browser/flavorText.js";
import { GRIMOIRE_COPY, renderHeroTab, characterSheetViewModel } from "../../src/browser/heroTab.js";
import { footerLines, identityFooter } from "../../src/browser/identityFooter.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import {
  SPELLS, POTIONS, TOOLS, BAG_ITEMS, BAG_ORDER, JEWELRY, CLOAKS, STAVES, ABILITIES, ABILITY_BY_ID,
  FIGHTER_SKILLS, THIEF_SKILLS, RACES, RACE_NOTE, CLASS_NOTE, SUB_NOTE,
} from "../../content/index.js";
import { SCROLL_FLAVOR } from "../../content/spells.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { railPush, railLineCard, conditionCard, abilityPoolCard, abilityPoolFlavor } from "../../src/browser/rail.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { applyAction } from "../../engine/engine.js";
import { die } from "../../engine/death.js";
import { finalSheetViewModel, renderFinalSheet } from "../../src/browser/finalSheet.js";
import { createRoller, ROLLER_IDS, ROLLER_TIMELINE } from "../../src/browser/roller.js";
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

// ─── the seven Phase 96 surfaces ──────────────────────────────────────────
//
// Setup is copied by value from roller.test.js (the roller rig), rules-surfaces.test.js (the Hero, Final Sheet and chip cases),
// status-chit-combat.test.js (the chip rig) and shell-company-items.test.js (the Company panel chip). The chip cards are driven
// through the REAL classic paint and the REAL renderRail; the module script's two entry points (window.mzRailLine,
// window.mzConditionCard) are not in the sandbox, so the rig installs mirrors of their bodies built on the real railLineCard and
// conditionCard with the trailing flavour argument (the source pins in rules-surfaces.test.js hold the module's real bodies to
// that shape).

// ─── Roller reveal ────────────────────────────────────────────────────────

function makeFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const setTimeout_ = (fn, ms) => { const id = nextId++; timers.set(id, { at: now + ms, fn, every: null }); return id; };
  const setInterval_ = (fn, ms) => { const id = nextId++; timers.set(id, { at: now + ms, fn, every: ms }); return id; };
  const clear = (id) => { timers.delete(id); };
  async function advance(ms) {
    const target = now + ms;
    for (;;) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= target && (!next || t.at < next[1].at)) next = [id, t];
      if (!next) break;
      const [id, t] = next;
      now = t.at;
      if (t.every != null) t.at = now + t.every;
      else timers.delete(id);
      t.fn();
      await Promise.resolve();
    }
    now = target;
  }
  return { setTimeout: setTimeout_, clearTimeout: clear, setInterval: setInterval_, clearInterval: clear, now: () => now, advance };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Rolls `state` through a real createRoller on fake timers to its reveal and returns the reveal's RULES column. */
async function paintRollerReveal(state) {
  const { document } = createRecordingDocument();
  let resolveRoll;
  const startNewRun = () => new Promise((resolve) => { resolveRoll = resolve; });
  const timers = makeFakeTimers();
  const roller = createRoller({ doc: document, startNewRun, sheetFor: characterSheetViewModel, onCommit: () => {}, timers, random: () => 0 });
  const started = roller.start();
  await flush();
  resolveRoll(state);
  await flush();
  await started;
  await timers.advance(ROLLER_TIMELINE.reveal);
  return document.getElementById(ROLLER_IDS.rules);
}

const WARLOCK_ELVEN = () => newRun(2, [], { force: { sub: "Warlock", race: "Elven" } });
const SUMMONER_HUMAN = () => newRun(1, [], { force: { sub: "Summoner", race: "Human" } });

probe("Roller reveal", {
  paint: async () => [await paintRollerReveal(WARLOCK_ELVEN()), await paintRollerReveal(SUMMONER_HUMAN())],
  expect: () => ({
    // A group per rolled sub-class, then a non-Human race: flavour first, the unchanged footer lines in the RULES body.
    flavours: [["sub", "Warlock"], ["race", "Elven"], ["sub", "Summoner"]].map(([kind, key]) => flavorOfIdentity(kind, key)),
    bodies: [...footerLines("sub", "Warlock"), ...footerLines("race", "Elven"), ...footerLines("sub", "Summoner")],
    extraRules: [],
  }),
});

// ─── Hero dossier and trait line; Hero abilities and skills ───────────────

function paintHero(sub, race, mutate = null) {
  const { document } = createRecordingDocument();
  const state = newRun(1, [], { force: { sub, race } });
  if (mutate) mutate(state);
  renderHeroTab(document.getElementById("screen-hero"), state, {});
  return { document, state };
}

probe("Hero dossier and trait line", {
  paint: () => {
    const roots = [];
    for (const [sub, race] of [["Cat Burglar", "Wilmsry"], ["Wizard", "Elven"]]) {
      const { document } = paintHero(sub, race);
      roots.push(document.getElementById("doss"), document.getElementById("s-trait"));
    }
    return roots;
  },
  expect: () => {
    const flavours = [];
    const bodies = [];
    for (const [sub, race] of [["Cat Burglar", "Wilmsry"], ["Wizard", "Elven"]]) {
      const c = newRun(1, [], { force: { sub, race } }).c;
      flavours.push(flavorOfIdentity("race", c.race), flavorOfIdentity("class", c.cls), flavorOfIdentity("sub", c.sub));
      bodies.push(
        RACE_NOTE[c.race], ...footerLines("race", c.race),
        CLASS_NOTE[c.cls],
        SUB_NOTE[c.sub], ...footerLines("sub", c.sub),
        RACES[c.race].note, // the trait line's RULES body holds the race note alone
      );
    }
    return { flavours, bodies, extraRules: [] };
  },
});

/** The passive skills a Hero tab shows with a flavour line, in the order the sheet owns them: [name, level, table]. */
function passiveSkillRows(c) {
  const table = c.cls === "Thief" ? THIEF_SKILLS : FIGHTER_SKILLS;
  return Object.entries(c.skills || {}).filter(([name]) => flavorOfSkill(name)).map(([name, level]) => [name, level, table]);
}

const HERO_AB_STATES = [["Soldier", null], ["Cat Burglar", { Locks: 2, Sewing: 1 }]];

probe("Hero abilities and skills", {
  paint: () => {
    const roots = [];
    for (const [sub, skills] of HERO_AB_STATES) {
      const { document } = paintHero(sub, "Wilmsry", skills ? (s) => { s.c.skills = skills; } : null);
      roots.push(document.getElementById("s-abilities"), document.getElementById("s-skills"));
    }
    return roots;
  },
  expect: () => {
    const flavours = [];
    const bodies = [];
    for (const [sub, skills] of HERO_AB_STATES) {
      const state = newRun(1, [], { force: { sub, race: "Wilmsry" } });
      if (skills) state.c.skills = skills;
      const abilities = characterSheetViewModel(state).abilities;
      assert.ok(abilities.length >= 1, `${sub}: the Hero tab lists abilities`);
      for (const row of abilities) {
        flavours.push(flavorOfAbility(row.name));
        bodies.push(ABILITY_BY_ID[row.id].txt);
      }
      const passive = passiveSkillRows(state.c);
      assert.ok(passive.length >= 1, `${sub}: the Hero tab lists passive skills`);
      for (const [name, level, table] of passive) {
        flavours.push(flavorOfSkill(name));
        bodies.push(level >= 2 && table[name].txt2 ? table[name].txt2 : table[name].txt);
      }
    }
    return { flavours, bodies, extraRules: [] };
  },
});

// ─── Combat ABILITIES rows and SING ───────────────────────────────────────

const ABILITY_FIGHTS = [
  { cOverrides: { cls: "Fighter", sub: "Soldier", grimoire: [], abilities: ["kata", "brace"] }, rows: ["kata", "brace"], sing: false },
  { cOverrides: { cls: "Thief", sub: "Cat Burglar", grimoire: [], abilities: ["smoke", "hamstring"] }, rows: ["smoke", "hamstring"], sing: false },
  { cOverrides: { cls: "Thief", sub: "Bard", grimoire: [], abilities: ["smoke"] }, rows: ["smoke"], sing: true },
];

probe("Combat ABILITIES rows and SING", {
  paint: () => ABILITY_FIGHTS.map((f) => openMenu(fightState(f.cOverrides), "abilities").list),
  expect: () => {
    const flavours = [];
    const bodies = [];
    for (const f of ABILITY_FIGHTS) {
      if (f.sing) { flavours.push(flavorOfAbility("Sing")); bodies.push(COMBAT_MENU_COPY.singDesc); }
      for (const id of f.rows) { flavours.push(flavorOfAbility(ABILITY_BY_ID[id].name)); bodies.push(ABILITY_BY_ID[id].txt); }
    }
    return { flavours, bodies, extraRules: [] };
  },
});

// ─── Final Sheet tricks ───────────────────────────────────────────────────

function deadSheet(cls) {
  const state = newRun(3, [], { force: { cls } });
  if (cls === "Fighter") state.c.abilities = ["secondWind", "taunt"];
  die(state, "trap", null, makeRng(2), [], () => 1);
  const vm = finalSheetViewModel(state);
  const { document } = createRecordingDocument();
  const host = document.createElement("div");
  renderFinalSheet(host, vm);
  return { vm, host };
}

/** One data-sec section of a painted Final Sheet (who, death, stats, tricks, worn, bag, book). */
const finalSection = (host, key) => {
  const found = elementsUnder(host).find((e) => e.dataset && e.dataset.sec === key);
  assert.ok(found, `the Final Sheet has a ${key} section`);
  return found;
};

probe("Final Sheet tricks", {
  // The surface is the WHAT THEY COULD DO section; the worn and bag sections are other surfaces (see the todo test below).
  paint: () => ["Fighter", "Thief"].map((cls) => finalSection(deadSheet(cls).host, "tricks")),
  expect: () => {
    const flavours = [];
    const bodies = [];
    for (const cls of ["Fighter", "Thief"]) {
      for (const row of deadSheet(cls).vm.tricks.rows) {
        if (!row.flavor) continue;
        // The row's exact text must be an unchanged content sentence, not whatever the view model happens to hold.
        assert.ok(BASE_INDEX.has(norm(row.description)), `${cls}: ${row.name}'s description is a content rules sentence`);
        flavours.push(row.flavor);
        bodies.push(row.description);
      }
    }
    return { flavours, bodies, extraRules: [], openers: true };
  },
});

// A finding, not a probe: the Final Sheet's worn and bag sections still print the worn items' own rules text as notes. They are not in
// the Surfaces table (Phase 95 dressed the Gear tab and the store, 96-06 dressed the tricks only), so no plan owned them. This stays a
// todo test so the gap shows in every run and goes green by itself the day those notes are dressed; see 96-10-SUMMARY.md.
test("Final Sheet worn and bag sections carry no rules sentence outside a RULES body", { todo: "Final Sheet worn notes still read the item's rules text; no plan dressed them" }, () => {
  const problems = [];
  for (const cls of ["Fighter", "Thief"]) {
    const { host } = deadSheet(cls);
    for (const key of ["worn", "bag"]) problems.push(...assertS2(visibleText(finalSection(host, key)), BASE_INDEX).map((p) => `${cls} / ${key}: ${p}`));
  }
  assert.deepEqual(problems, []);
});

// A second finding: a bought ACTIVE skill (Kata, Smoke, ...) has no skill flavour line of its own (its twin ability carries the line), and
// 96-06 deliberately renders such a row as today's markup, so the Hero tab's special-skills list prints the skill's rules text in the open.
// The probe above sweeps the passive skills, which are dressed; this todo keeps the active rows visible until a plan dresses them.
test("Hero special-skills list shows no rules sentence for a bought active skill", { todo: "an active skill row keeps today's markup (96-06, case (y)); its rules text is outside any RULES body" }, () => {
  const problems = [];
  for (const [sub, table] of [["Soldier", FIGHTER_SKILLS], ["Cat Burglar", THIEF_SKILLS]]) {
    const active = Object.keys(table).filter((name) => table[name].active);
    assert.ok(active.length >= 1, `${sub}: the skill table has active skills`);
    const { document } = paintHero(sub, "Wilmsry", (s) => { s.c.skills = Object.fromEntries(active.map((name) => [name, 1])); });
    problems.push(...assertS2(visibleText(document.getElementById("s-skills")), BASE_INDEX).map((p) => `${sub}: ${p}`));
  }
  assert.deepEqual(problems, []);
});

// ─── Chip tap cards, and UP YOUR SLEEVE ───────────────────────────────────

function chipState() {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human", level: 3, sp: 0, maxWP: 55, wp: 55, skills: {}, vp: 0,
      weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, timers: {},
    },
    floor: { g, px: 1, py: 1, depth: 2 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
  };
}

const chipFoe = (name, extra = {}) => ({ name, type: "Beasts", lvl: 2, size: "S", intel: 4, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: { dmg: { n: 1, sides: 6, bonus: 2 }, note: "+2 damage" }, lives: 1, ...extra });

function chipFightState({ afraid = 2 } = {}) {
  const s = chipState();
  s.combat = { foes: [chipFoe("Wolf"), chipFoe("Cave Bear", { size: "L", wp: 25, maxWP: 25 })], type: "Beasts", round: 2, target: 1, spellOpen: false, tracked: false, first: "you", afraid };
  return s;
}

function chipRig() {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false, clock, reducedMotion: true });
  const w = sandbox.context.window;
  w.mzRailLine = (title, line, tone, hold, icon, iconKey = null, flavor = null) => {
    w.__mzRail = railPush(w.__mzRail, railLineCard(title, line, tone, hold, icon, iconKey, flavor));
    w.renderRail?.();
  };
  w.mzConditionCard = (title, text, flavor = null) => {
    const live = w.__mzState?.get?.();
    if (!live || !(live.combat || w.__mzBeat?.active?.())) return;
    w.__mzRail = railPush(w.__mzRail, conditionCard(title, text, flavor));
    w.renderRail?.();
  };
  const chip = (key) => doc.document.getElementById("mm-conditions").children.find((c) => c.className === "mw-cond" && c.dataset.key === key);
  const descriptor = (key) => w.__mzConditionsOf(w.__mzState.get()).find((cn) => cn.key === key);
  const show = (state) => { w.__mzState.set(state); sandbox.paint(); };
  const railLines = () => { sandbox.context.renderRail(); return doc.document.getElementById("mw-rail-lines"); };
  const press = (el) => { clock.advance(ARM_DELAY_MS + 10); el.onclick(); };
  return { clock, doc, sandbox, w, ctx: sandbox.context, chip, descriptor, show, railLines, press };
}

/** The explanation sentences the chip tap text is built from; when the key has one, the exact text must still contain it. */
function assertExplains(exact, key) {
  const sentence = shellTables().CONDITION_EXPLAIN[key];
  if (sentence) assert.ok(exact.includes(sentence), `the ${key} tap text keeps its CONDITION_EXPLAIN sentence`);
}

/** Paints one chip card per entry of `cases` (each case builds its own rig and returns { r, lead, exact, key }) and collects the expectation. */
let chipExpect = { flavours: [], bodies: [], extraRules: [] };
function paintChipCards(cases) {
  chipExpect = { flavours: [], bodies: [], extraRules: [] };
  return cases.map((build) => {
    const { r, lead, exact, key } = build();
    assert.ok(lead, `the ${key} chip has a flavour line`);
    if (key) assertExplains(exact, key);
    chipExpect.flavours.push(lead);
    chipExpect.bodies.push(exact);
    chipExpect.extraRules.push(exact);
    return r.railLines();
  });
}

/** A HUD or combat chip: shows `state`, taps the chip `key` and returns the rig and the card's expectation. */
function tapChip(state, key) {
  const r = chipRig();
  r.show(state);
  const cn = r.descriptor(key);
  assert.ok(cn, `the ${key} chip was enumerated`);
  const label = r.ctx.conditionLabel(cn);
  const lead = flavorOfChip(cn);
  const exact = r.ctx.conditionTapText(cn, label, state);
  r.press(r.chip(key));
  return { r, lead, exact, key };
}

/** `state` with the hero's fields overridden (a copy; the base is a fresh literal each call). */
const withC = (state, over) => ({ ...state, c: { ...state.c, ...over } });

const chipProbe = (variant, cases) => PROBES.push({
  covers: "Chip tap cards",
  variant,
  paint: () => paintChipCards(cases),
  expect: () => chipExpect,
});

chipProbe("HUD strip out of a fight", [
  () => tapChip(withC(chipState(), { darkFor: 9 }), "darkness"),
  () => tapChip(withC(chipState(), { might: 2 }), "might"),
  () => tapChip(withC(chipState(), { senses: true }), "senses"),
]);

chipProbe("combat condition card", [
  () => tapChip(withC(chipFightState(), { might: 2 }), "afraid"),
  () => tapChip(withC(chipFightState(), { might: 2 }), "might"),
]);

function lotHero(overrides = {}) {
  return {
    cls: "Thief", sub: "Burglar", race: "Human", level: 3, sp: 0, maxWP: 200, wp: 200, skills: {}, vp: 0,
    weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
    might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, abilities: ["smoke"], timers: {},
    ...overrides,
  };
}

function lotFightState({ c = {}, party = [], combat = {} } = {}) {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 5, c: lotHero(c), floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, store: null, beats: null, party, dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: [{ name: "Stone Ox", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 900, maxWP: 900, alive: true, asleep: 0, sp: {}, lives: 1 }],
      type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you", ...combat,
    },
  };
}

/** YOUR LOT on a fresh rig: the hero has used Smoke, and a Joiner has a Sidestep chip; returns the rig, the state and the chip rows. */
function lotRig() {
  const r = chipRig();
  for (const name of ["mzAttack", "mzCastSpell", "mzSing", "mzDrinkPotion", "mzReadScroll", "mzUseAbility", "mzUseItem", "mzFlee", "mzParley", "mzLoseTurn", "mzFight"]) r.w[name] = () => {};
  const used = applyAction(lotFightState(), { type: "useAbility", key: "smoke" }).state;
  const state = lotFightState({
    c: used.c,
    party: [{ name: "Joiner", cls: "Fighter", sub: "Soldier", lvl: 1, wp: 30, maxWP: 30, status: "ok", timers: { "ability:sidestep": { cadence: "rounds", left: 1, phase: "effect", cd: 4 } } }],
    combat: { allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30 }] },
  });
  state.rngState = used.rngState;
  r.w.__mzState.set(state);
  r.ctx.renderEncounter();
  const cards = Array.from(r.doc.document.getElementById("enc-body").querySelectorAll(".cb-lot-card"));
  assert.ok(cards.length >= 2, "hero and member cards");
  const chipsOf = (card) => card.children.find((el) => el.className === "cb-lot-chips").children.filter((el) => el.className === "cb-lot-chip");
  return { r, state, heroChip: chipsOf(cards[0])[0], memberChip: chipsOf(cards[1])[0] };
}

chipProbe("YOUR LOT hero and Joiner", [
  () => {
    const { r, state, heroChip } = lotRig();
    const cn = r.w.__mzConditionsOf(state).find((x) => x.key === "ability" && x.ability === "smoke");
    const exact = r.ctx.conditionTapText(cn, "Smoke", state, { member: false });
    assert.ok(exact.includes(ABILITY_BY_ID.smoke.txt[0].toUpperCase() + ABILITY_BY_ID.smoke.txt.slice(1)), "the hero's chip body holds the ability's own txt");
    r.press(heroChip);
    return { r, lead: flavorOfAbility("Smoke"), exact };
  },
  () => {
    const { r, state, memberChip } = lotRig();
    const cn = r.w.__mzMemberConditionsOf(state, 0).find((x) => x.key === "ability");
    const exact = r.ctx.conditionTapText(cn, "Sidestep", state, { member: true });
    assert.ok(exact.includes(ABILITY_BY_ID.sidestep.txt[0].toUpperCase() + ABILITY_BY_ID.sidestep.txt.slice(1)), "the Joiner's chip body holds the ability's own txt");
    r.press(memberChip);
    return { r, lead: flavorOfAbility("Sidestep"), exact };
  },
]);

chipProbe("Company panel", [
  () => {
    // The Hero tab's Company panel: a Joiner whose next-blow pendant chip is up, painted by the real paint() outside a fight.
    const r = chipRig();
    const state = newRun(1, [], { force: { cls: "Fighter", sub: "Soldier" } });
    state.party = [{
      name: "Joiner", cls: "Fighter", sub: "Soldier", race: "Human", lvl: 1, level: 1, wp: 30, maxWP: 30, status: "ok", weapon: "Club",
      armor: "Leather", ar: 6, armorWP: 10, armorMax: 12, potions: 0, halfNext: true, worn: {}, timers: {},
    }];
    r.w.__mzState.set(state);
    r.sandbox.setState(state);
    r.sandbox.paint();
    const rows = elementsUnder(r.doc.document.getElementById("hero-party-list")).filter((el) => el.className === "mw-party-chips");
    assert.equal(rows.length, 1, "the Company panel draws the Joiner's chip row");
    const cn = r.w.__mzMemberConditionsOf(state, 0)[0];
    assert.equal(cn.key, "halfNext");
    const exact = r.ctx.conditionTapText(cn, r.ctx.conditionLabel(cn), state, { member: true });
    r.press(rows[0].children[0]);
    return { r, lead: flavorOfChip(cn), exact };
  },
]);

probe("UP YOUR SLEEVE card", {
  paint: () => {
    const roots = [];
    chipExpect = { flavours: [], bodies: [], extraRules: [] };
    for (const cls of ["Fighter", "Thief"]) {
      const r = chipRig();
      const state = newRun(9, [], { force: { cls } });
      r.w.__mzState.set(state);
      r.sandbox.setState(state);
      r.w.__mzPendingNarration = null;
      // The mirror of the module script's surfaceAbilityPool (rules-surfaces.test.js pins it to its source).
      const card = abilityPoolCard(state.c);
      const flavor = abilityPoolFlavor(state.c);
      assert.ok(card && flavor, `${cls}: a fresh run raises the UP YOUR SLEEVE card`);
      r.w.mzRailLine(card.title, card.line, card.tone, card.hold, card.icon, null, flavor);
      const meta = ABILITY_BY_ID[state.c.abilities.find((a) => ABILITY_BY_ID[a] && ABILITY_BY_ID[a].source === "pool")];
      assert.equal(card.line, newTrickLine(meta), `${cls}: the card's own line is the unchanged "New trick" sentence`);
      chipExpect.flavours.push(`New trick: ${meta.name} — ${flavorOfAbility(meta.name)}`);
      chipExpect.bodies.push(newTrickLine(meta));
      chipExpect.extraRules.push(newTrickLine(meta));
      roots.push(r.railLines());
    }
    return roots;
  },
  expect: () => chipExpect,
});

// ─── the coverage test: the sweep is tied to the model document ───────────

const PHASE_96_SURFACES = [
  "Roller reveal", "Hero dossier and trait line", "Combat ABILITIES rows and SING", "Hero abilities and skills",
  "Final Sheet tricks", "Chip tap cards", "UP YOUR SLEEVE card",
];
// A surface that needs several states to be seen may carry several probes under one name; the count is declared, not open.
const DECLARED_MULTI_STATE = { "Chip tap cards": 4 };

/** The first column of every data row of the Surfaces table in docs/TEXT-LAYERS.md. */
function surfaceTableRows(markdown) {
  const at = markdown.indexOf("### Surfaces");
  assert.ok(at >= 0, "docs/TEXT-LAYERS.md has a Surfaces section");
  const names = [];
  let inTable = false;
  for (const line of markdown.slice(at).split("\n").slice(1)) {
    if (!line.startsWith("|")) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    const first = line.split("|")[1].trim();
    if (first === "Surface" || /^-+$/.test(first)) continue;
    names.push(first);
  }
  return names;
}

/** The table rows (or required names) that no probe covers. */
const unprobed = (names, probes) => names.filter((name) => !probes.some((p) => p.covers === name));

test("coverage: every row of the Surfaces table in docs/TEXT-LAYERS.md has a probe", () => {
  const rows = surfaceTableRows(LAYERS_DOC);
  assert.ok(rows.length >= 13, `the Surfaces table lists its surfaces (${rows.length} rows)`);
  assert.deepEqual(unprobed(rows, PROBES), [], "a surface in the table has no probe in this file");
  // The converse: a probe for a surface the table does not know is stale (a renamed row), unless it is one of the Phase 96 names.
  const known = new Set([...rows, ...PHASE_96_SURFACES]);
  assert.deepEqual([...new Set(PROBES.map((p) => p.covers))].filter((name) => !known.has(name)), [], "a probe covers a name that is in neither the table nor the Phase 96 list");
});

test("coverage: the seven Phase 96 surfaces each have a probe, whether or not the table lists them yet", () => {
  assert.equal(PHASE_96_SURFACES.length, 7);
  assert.deepEqual(unprobed(PHASE_96_SURFACES, PROBES), []);
});

test("coverage: no two probes share a name unless they are the declared multi-state surface, and all 20 surfaces are probed", () => {
  const counts = new Map();
  for (const p of PROBES) counts.set(p.covers, (counts.get(p.covers) || 0) + 1);
  for (const [name, n] of counts) assert.equal(n, DECLARED_MULTI_STATE[name] ?? 1, `${name}: ${n} probe(s)`);
  for (const name of Object.keys(DECLARED_MULTI_STATE)) assert.ok(counts.has(name), `${name} is probed`);
  assert.equal(counts.size, 20, "13 Phase 95 surfaces plus the 7 Phase 96 surfaces");
  const variants = PROBES.filter((p) => p.covers === "Chip tap cards").map((p) => p.variant);
  assert.deepEqual(variants, ["HUD strip out of a fight", "combat condition card", "YOUR LOT hero and Joiner", "Company panel"]);
});

test("coverage teeth: a table row with no probe is reported, and the table parser reads a made-up row", () => {
  const tableEnd = LAYERS_DOC.indexOf("\n\n### Deliberately plain");
  assert.ok(tableEnd > 0, "the Surfaces table is followed by the Deliberately plain section");
  const doc = `${LAYERS_DOC.slice(0, tableEnd)}\n| A surface added later | \`x.js\` | a | b | c | \`z:\` |\n\n### Deliberately plain\n`;
  const rows = surfaceTableRows(doc);
  assert.ok(rows.includes("A surface added later"), "the parser reads the new row");
  assert.deepEqual(unprobed(rows, PROBES), ["A surface added later"], "a surface added without a probe fails");
  assert.ok(rows.includes("Grimoire") && rows.includes("Drop shelf"), "the first and last Phase 95 rows are read");
  assert.ok(!rows.includes("Surface") && !rows.some((r) => /^-+$/.test(r)), "the header and divider are not rows");
});

// ─── the runner loop ──────────────────────────────────────────────────────

for (const p of PROBES) {
  test(`surface ${p.covers}${p.variant ? ` (${p.variant})` : ""}: S1 to S4 hold with Always show the rules off and on`, async () => {
    const problems = await sweepProbe(p);
    assert.deepEqual(problems, []);
  });
}
