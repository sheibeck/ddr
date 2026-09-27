// test/unit/voice-corpus.test.js
//
// Phase 79 (VOX-05, ROLL-04), 79-01 — the standing guard for the narration
// corpus (tools/lib/voice-corpus.mjs) the whole narrative pass runs on:
//   - completeness: every export of an importable src/browser or content
//     module that holds copy-like strings is a registered bank, a walked
//     content table or a declared non-copy export (a new copy bank cannot
//     slip past it, proven on a scratch copy of the tree);
//   - every EVENT_NARRATION and LINE_FOR builder is in the corpus;
//   - determinism: two builds serialise byte-identically, in the fixed
//     surface-then-key order;
//   - floors: no surface, and not the text total, can quietly shrink, so an
//     empty or truncated corpus never reads as clean;
//   - domains (fight > powers > world) and the ownership rules.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

import {
  SURFACES, DOMAINS, BANK_REGISTRY, CONTENT_FIELDS, NON_COPY_EXPORTS, OWNER_RULES, DEFAULT_OWNER,
  buildCorpus, corpusJson, auditRegistry, domainOf, ownerOf, scanEmitters, lexJs, topLevelDecls, declAt,
} from "../../tools/lib/voice-corpus.mjs";
import { BRANCH_TOGGLES, BASE_EVENT, variantsFor } from "../../tools/lib/event-variants.mjs";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const corpus = await buildCorpus();
const byKey = new Map(corpus.entries.map((e) => [e.key, e]));

// ─── Completeness ─────────────────────────────────────────────────────────

test("completeness: no unregistered copy-bearing export and no unexpected import failure", async () => {
  const audit = await auditRegistry();
  assert.deepStrictEqual(audit.unregistered, [], `Register these as a bank, a content table or a non-copy export (with a reason):\n${JSON.stringify(audit.unregistered, null, 1)}`);
  assert.deepStrictEqual(audit.importFailures, []);
});

test("completeness: a new frozen object of sentences in a scratch copy of the tree is listed", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "voice-corpus-"));
  try {
    for (const d of ["src", "content", "engine"]) fs.cpSync(path.join(REPO_ROOT, d), path.join(tmp, d), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, "package.json"), path.join(tmp, "package.json"));
    const target = path.join(tmp, "src", "browser", "gameName.js");
    fs.appendFileSync(target, '\nexport const SCRATCH_COPY = Object.freeze({ hello: "A sentence the registry has never seen.", nested: { again: "Another one, deeper." } });\n');
    const audit = await auditRegistry({ root: tmp });
    assert.deepStrictEqual(audit.unregistered.map((u) => `${u.module}#${u.export}`), ["src/browser/gameName.js#SCRATCH_COPY"]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("completeness: every registry row names a real module or is reported absent (never silently skipped)", () => {
  const absent = new Set(corpus.absent.map((a) => `${a.module}#${a.export}`));
  for (const r of [...BANK_REGISTRY, ...CONTENT_FIELDS]) {
    const present = fs.existsSync(path.join(REPO_ROOT, r.module));
    if (!present) assert.ok(absent.has(`${r.module}#${r.export}`), `${r.module}#${r.export} is missing and not in absent`);
  }
  for (const r of NON_COPY_EXPORTS) assert.ok(r.reason && r.reason.length > 8, `${r.module}#${r.export} needs a reason`);
});

// ─── Builders ─────────────────────────────────────────────────────────────

test("every EVENT_NARRATION builder yields an oracle or refusals entry", () => {
  for (const type of Object.keys(EVENT_NARRATION)) {
    const e = byKey.get(`oracle:${type}`);
    assert.ok(e, `missing oracle:${type}`);
    assert.ok(e.surface === "oracle" || e.surface === "refusals", `oracle:${type} on ${e.surface}`);
    assert.equal(e.surface === "refusals", /(Refused|Rejected|Blocked|Denied)$/.test(type));
  }
});

test("every LINE_FOR builder yields a rail or refusals entry", () => {
  for (const type of Object.keys(LINE_FOR)) {
    const e = byKey.get(`rail:${type}`);
    assert.ok(e, `missing rail:${type}`);
    assert.ok(e.surface === "rail" || e.surface === "refusals", `rail:${type} on ${e.surface}`);
  }
});

test("builder renderings: each rendering is text, never the bare event type alone", () => {
  for (const e of corpus.entries) {
    if (!e.key.startsWith("oracle:") && !e.key.startsWith("rail:")) continue;
    const type = e.key.split(":")[1];
    assert.ok(e.texts.length > 0, `${e.key} rendered nothing`);
    for (const t of e.texts) {
      assert.equal(typeof t, "string");
      assert.notEqual(t, type, `${e.key} renders its own type name`);
      assert.ok(!/<[a-z/][^>]*>/i.test(t), `${e.key} kept markup: ${t}`);
    }
  }
});

test("variantsFor: bare, base, then one variant per toggle, in a fixed order", () => {
  const v = variantsFor("healed");
  assert.equal(v.length, BRANCH_TOGGLES.length + 2);
  assert.deepStrictEqual(v.slice(0, 3).map((x) => x.id), ["bare", "base", "t0"]);
  assert.deepStrictEqual(v[0].event, { type: "healed" });
  assert.equal(v[1].event.amount, BASE_EVENT.amount);
  // the 79-02 fields are rendered: gained equal to amount, below it and 0
  assert.ok(BRANCH_TOGGLES.some((t) => t.gained === 0) && BRANCH_TOGGLES.some((t) => t.gained === 3) && BRANCH_TOGGLES.some((t) => t.gained === 8));
  assert.ok(BRANCH_TOGGLES.some((t) => t.stat === "armor") && BRANCH_TOGGLES.some((t) => t.stat === "maxHp") && BRANCH_TOGGLES.some((t) => t.stat === "xp"));
});

// ─── Determinism and order ────────────────────────────────────────────────

test("determinism: two builds serialise to byte-identical JSON", async () => {
  const again = await buildCorpus();
  assert.equal(corpusJson(again), corpusJson(corpus));
});

test("order: entries sort by the fixed surface order, then by key, and keys are unique", () => {
  const idx = new Map(SURFACES.map((s, i) => [s, i]));
  const keys = new Set();
  for (let i = 0; i < corpus.entries.length; i++) {
    const e = corpus.entries[i];
    assert.ok(idx.has(e.surface), `${e.key} has unknown surface ${e.surface}`);
    assert.ok(!keys.has(e.key), `duplicate key ${e.key}`);
    keys.add(e.key);
    if (i === 0) continue;
    const p = corpus.entries[i - 1];
    const cmp = idx.get(p.surface) - idx.get(e.surface) || (p.key < e.key ? -1 : 1);
    assert.ok(cmp < 0, `${p.key} sorts after ${e.key}`);
  }
  for (const e of corpus.entries) {
    assert.deepStrictEqual(e.texts, [...new Set(e.texts)], `${e.key} has repeated texts`);
  }
});

// ─── Floors (about 80% of the phase-base counts) ───────────────────────────

const FLOORS = Object.freeze({
  blurbs: 31, oracle: 261, rail: 229, refusals: 30, "rail-cards": 112, "combat-screen": 162, items: 88, spells: 69,
  foes: 62, death: 96, boards: 145, panels: 152, map: 16, title: 13,
});
const TEXT_FLOOR = 3200;

test("floors: every surface and the text total stay above their floors (an empty corpus never reads as clean)", () => {
  for (const [s, floor] of Object.entries(FLOORS)) {
    assert.ok(corpus.counts.bySurface[s] >= floor, `${s}: ${corpus.counts.bySurface[s]} entries, floor ${floor}`);
  }
  assert.ok(corpus.counts.texts >= TEXT_FLOOR, `texts: ${corpus.counts.texts}, floor ${TEXT_FLOOR}`);
});

// ─── Domains ──────────────────────────────────────────────────────────────

test("domainOf: fight before powers before world, and no emitter is world (synthetic emitter map)", () => {
  const map = new Map([
    ["a", [{ file: "engine/magic.js" }, { file: "engine/combat.js" }, { file: "engine/movement.js" }]],
    ["b", [{ file: "engine/movement.js" }, { file: "engine/foeAbilities.js" }]],
    ["c", [{ file: "engine/scrollFumble.js" }]],
    ["d", [{ file: "engine/abilities.js" }]],
    ["e", [{ file: "engine/movement.js" }, { file: "engine/items.js" }]],
  ]);
  assert.equal(domainOf("a", map), "fight");
  assert.equal(domainOf("b", map), "powers");
  assert.equal(domainOf("c", map), "powers");
  assert.equal(domainOf("d", map), "powers");
  assert.equal(domainOf("e", map), "world");
  assert.equal(domainOf("nobodyEmitsThis", map), "world");
});

test("domainOf on the live engine: combat.js emitters are fight; every builder entry has exactly one domain", async () => {
  const emitters = await scanEmitters();
  const regen = emitters.get("regenerated") ?? [];
  assert.equal(domainOf("regenerated", emitters), regen.some((e) => e.file === "engine/combat.js") ? "fight" : domainOf("regenerated", new Map([["regenerated", regen]])));
  assert.equal(domainOf("struck", emitters), "fight");
  for (const e of corpus.entries) {
    const builder = e.key.startsWith("oracle:") || e.key.startsWith("rail:");
    if (builder) assert.ok(DOMAINS.includes(e.domain), `${e.key} domain ${e.domain}`);
    else assert.equal(e.domain, undefined, `${e.key} is not a builder but has a domain`);
  }
});

// ─── Ownership ────────────────────────────────────────────────────────────

test("ownership: every entry has an owning Phase 79 plan", () => {
  for (const e of corpus.entries) assert.match(e.owner, /^79-\d\d$/, `${e.key} owner ${e.owner}`);
  assert.equal(DEFAULT_OWNER, "79-12");
  for (const r of OWNER_RULES) assert.match(r.owner, /^79-\d\d$/);
});

test("ownership: rules applied by surface, module, export and domain", () => {
  const own = (e) => ownerOf(e);
  // 79-02: the gain and Table 4 builders, and Table 4's engine prose
  assert.equal(own({ kind: "builder", type: "healed", domain: "powers", surface: "oracle", module: "src/browser/eventNarration.js", key: "oracle:healed" }), "79-02");
  assert.equal(own({ kind: "raw", key: "raw:engine/encounters.js#tableFour", module: "engine/encounters.js", export: "tableFour", surface: "oracle" }), "79-02");
  // 79-03: blurbs and the Joiner lines
  assert.equal(own({ kind: "bank", key: "bank:SUB_NOTE.Wizard", surface: "blurbs", module: "content/flavor.js", export: "SUB_NOTE" }), "79-03");
  assert.equal(own({ kind: "content", key: "content:RACES.Human.note", surface: "blurbs", module: "content/races.js", export: "RACES" }), "79-03");
  assert.equal(own({ kind: "bank", key: "bank:JOINER_EXIT_LINES.0", surface: "oracle", module: "content/flavor.js", export: "JOINER_EXIT_LINES" }), "79-03");
  // domains
  assert.equal(own({ kind: "builder", type: "struck", domain: "fight", surface: "oracle", module: "src/browser/eventNarration.js" }), "79-04");
  assert.equal(own({ kind: "builder", type: "spellThrown", domain: "powers", surface: "rail", module: "src/browser/narrationLines.js" }), "79-08");
  assert.equal(own({ kind: "builder", type: "moved", domain: "world", surface: "oracle", module: "src/browser/eventNarration.js" }), "79-11");
  // modules
  assert.equal(own({ kind: "raw", module: "engine/combat.js", export: "foeTurn", surface: "oracle", key: "raw:engine/combat.js#foeTurn" }), "79-04");
  assert.equal(own({ kind: "content", module: "content/spells.js", export: "SPELLS", surface: "spells", key: "content:SPELLS.Heal.txt" }), "79-05");
  assert.equal(own({ kind: "raw", module: "engine/items.js", export: "rollTreasureItem", surface: "items", key: "raw:engine/items.js#rollTreasureItem" }), "79-05");
  assert.equal(own({ kind: "bank", module: "content/epitaphs.js", export: "EPITAPHS", surface: "death", key: "bank:EPITAPHS.combat.0" }), "79-06");
  assert.equal(own({ kind: "bank", module: "src/browser/missLines.js", export: "MISS_LINES", surface: "rail", key: "bank:MISS_LINES.0" }), "79-06");
  assert.equal(own({ kind: "bank", module: "src/browser/foeDetails.js", export: "FOE_DETAILS_COPY", surface: "combat-screen", key: "bank:FOE_DETAILS_COPY.x" }), "79-07");
  assert.equal(own({ kind: "raw", module: "mazeworld.html", export: "CONDITION_EXPLAIN", surface: "combat-screen", key: "raw:mazeworld.html#CONDITION_EXPLAIN" }), "79-07");
  assert.equal(own({ kind: "raw", module: "engine/foeAbilities.js", export: "x", surface: "oracle", key: "raw:engine/foeAbilities.js#x" }), "79-08");
  assert.equal(own({ kind: "bank", module: "src/browser/finalSheet.js", export: "FINAL_SHEET_COPY", surface: "panels", key: "bank:FINAL_SHEET_COPY.title" }), "79-09");
  assert.equal(own({ kind: "raw", module: "mazeworld.html", export: "paint", surface: "other", key: "raw:mazeworld.html#paint" }), "79-10");
  assert.equal(own({ kind: "bank", module: "src/browser/arrowPad.js", export: "ARROW_PAD_COPY", surface: "title", key: "bank:ARROW_PAD_COPY.pad" }), "79-10");
  assert.equal(own({ kind: "bank", module: "src/browser/hazardCard.js", export: "HAZARD_CARD_COPY", surface: "rail-cards", key: "bank:HAZARD_CARD_COPY.x" }), "79-11");
  assert.equal(own({ kind: "raw", module: "engine/movement.js", export: "move", surface: "oracle", key: "raw:engine/movement.js#move" }), "79-11");
  assert.equal(own({ kind: "bank", module: "src/browser/rollRange.js", export: "ROLL_COPY", surface: "other", key: "bank:ROLL_COPY.toHit" }), "79-12");
  assert.equal(own({ kind: "raw", module: "src/browser/perfMarks.js", export: "x", surface: "other", key: "raw:src/browser/perfMarks.js#x" }), "79-12");
});

test("ownership on the live corpus: the ROLL-LEDGER handoffs land with their plans", () => {
  assert.equal(byKey.get("content:SPELLS.Mirror Self.txt")?.owner, "79-05");
  assert.equal(byKey.get("content:ABILITIES.smoke.txt")?.owner, "79-05");
  assert.equal(byKey.get("raw:engine/items.js#rollTreasureItem")?.owner, "79-05");
  assert.equal(byKey.get("bank:SUB_NOTE.Summoner")?.owner, "79-03");
});

// ─── The lexer (why the corpus does not reuse stripJs) ─────────────────────

test("lexJs: nested template literals and regex literals keep exact literal boundaries", () => {
  const src = [
    "const a = (e) => `x ${e.by === \"you\" ? \"Your\" : `${e.by ?? \"Something\"}'s`} best. ${e.t ?? \"It\"} goes.`;",
    "// a comment that must not survive, with a quote ' in it",
    "const b = s.replace(/\"/g, \"&quot;\");",
    "function c() { return 'Plain sentence here.'; }",
  ].join("\n");
  const { noComments, literals, balanced } = lexJs(src);
  assert.ok(balanced);
  assert.ok(!noComments.includes("must not survive"));
  const raws = literals.map((l) => l.raw);
  assert.ok(raws.includes("x … best. … goes."), JSON.stringify(raws));
  assert.ok(raws.includes("Plain sentence here."));
  assert.ok(raws.includes("&quot;"));
  const { code } = lexJs(src);
  const decls = topLevelDecls(code);
  assert.deepStrictEqual(decls.map((d) => d.name), ["a", "b", "c"]);
  assert.equal(declAt(decls, src.indexOf("Plain")), "c");
  assert.equal(declAt(decls, src.indexOf("comment")), "top");
});
