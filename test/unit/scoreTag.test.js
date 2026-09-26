// test/unit/scoreTag.test.js
//
// Phase 68 (PGS-03, D-01, D-16; 67 D-18): the public 64-character score tag.
// Pins the worked example, the field caps and unknown-index sentinels, the
// name rule (full, else "First L.", else the first name cut short), the
// sweep over every name the generator can produce, the defensive decoder,
// the append-only index lists against their content tables, and the source
// rule that the tag never reads the epitaph, note, seed, acts or hash.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";
import { SUB_NOTE } from "../../content/flavor.js";
import { CAUSE_TEXT } from "../../content/epitaphs.js";
import { NAMES } from "../../content/names.js";
import {
  TAG_VERSION,
  TAG_MAX_LENGTH,
  TAG_RACES,
  TAG_SUBS,
  TAG_CAUSES,
  TAG_FIELD_CAPS,
  TAG_UNKNOWN,
  classOfSub,
  tagName,
  fitName,
  encodeTag,
  decodeTag,
} from "../../src/browser/scoreTag.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SRC_PATH = path.join(REPO_ROOT, "src", "browser", "scoreTag.js");

const CHARSET_RE = /^[A-Za-z0-9._~-]*$/;

const EXAMPLE = Object.freeze({
  race: "Dwarven", sub: "Pickpocket", level: 3, cause: "combat", floor: 7, day: 22,
  steps: 431, kills: 19, gold: 4688, sp: 1180, name: "Hilda Ferrow",
});

const AT_CAPS = Object.freeze({
  race: "Troll", sub: "Apprentice", cause: "entombed",
  level: 99, floor: 999, day: 9999, steps: 99999, kills: 9999, gold: 999999, sp: 999999,
});

/** Every name the generator composes: first + " " + sur, or a bare first. */
function everyName() {
  const out = new Set();
  for (const pools of Object.values(NAMES)) {
    for (const f of pools.first) {
      out.add(f);
      for (const s of pools.sur) out.add(s ? `${f} ${s}` : f);
    }
  }
  return [...out];
}

// --- constants and the append-only lists -------------------------------------

test("TAG_VERSION is v1 and TAG_MAX_LENGTH is 64", () => {
  assert.equal(TAG_VERSION, "v1");
  assert.equal(TAG_MAX_LENGTH, 64);
});

test("the index lists are frozen literals in their pinned orders", () => {
  for (const list of [TAG_RACES, TAG_SUBS, TAG_CAUSES, TAG_FIELD_CAPS, TAG_UNKNOWN]) {
    assert.ok(Object.isFrozen(list));
  }
  assert.deepEqual([...TAG_RACES], ["Human", "Elven", "Dwarven", "Wilmsry", "Fridgian", "Troll"]);
  assert.deepEqual([...TAG_SUBS], [
    "Knight", "Guard", "Woodsman", "Soldier", "Barbarian", "Master of Arms", "Samurai", "Bard",
    "Pickpocket", "Pilfer", "Cat Burglar", "Cutthroat", "Cloaker", "Ninja", "Con Artist", "Acrobat",
    "Wizard", "Warlock", "Sorcerer", "Court Mage", "Illusionist", "Cleric", "Summoner", "Apprentice",
  ]);
  assert.deepEqual([...TAG_CAUSES], [
    "combat", "starve", "trap", "teleport", "fall", "gorge", "backfire", "summon", "maze",
    "quake", "potion", "insanity", "poison", "abandon", "entombed", "pilferFumble", "scrollFumble",
  ]);
  assert.deepEqual({ ...TAG_FIELD_CAPS }, {
    level: 99, floor: 999, day: 9999, steps: 99999, kills: 9999, gold: 999999, sp: 999999,
  });
  assert.deepEqual({ ...TAG_UNKNOWN }, { race: 9, sub: 99, cause: 99 });
});

test("the lists have no duplicates", () => {
  for (const list of [TAG_RACES, TAG_SUBS, TAG_CAUSES]) {
    assert.equal(new Set(list).size, list.length);
  }
});

test("TAG_RACES matches content/races.js as a set", () => {
  assert.deepEqual(new Set(TAG_RACES), new Set(Object.keys(RACES)));
});

test("TAG_SUBS matches SUB_NOTE and the union of every CLASSES subs list", () => {
  assert.deepEqual(new Set(TAG_SUBS), new Set(Object.keys(SUB_NOTE)));
  const union = new Set(Object.values(CLASSES).flatMap((c) => c.subs));
  assert.deepEqual(new Set(TAG_SUBS), union);
});

test("every CAUSE_TEXT key has a TAG_CAUSES index", () => {
  for (const k of Object.keys(CAUSE_TEXT)) assert.ok(TAG_CAUSES.includes(k), `missing cause ${k}`);
});

test("the unknown sentinels sit outside every list", () => {
  assert.ok(TAG_UNKNOWN.race >= TAG_RACES.length);
  assert.ok(TAG_UNKNOWN.sub >= TAG_SUBS.length);
  assert.ok(TAG_UNKNOWN.cause >= TAG_CAUSES.length);
});

// --- classOfSub ----------------------------------------------------------------

test("classOfSub maps a sub-class to its class, else empty", () => {
  assert.equal(classOfSub("Court Mage"), "Magic User");
  assert.equal(classOfSub("Ninja"), "Thief");
  assert.equal(classOfSub("Bard"), "Fighter");
  assert.equal(classOfSub("Nope"), "");
  assert.equal(classOfSub(undefined), "");
});

test("every TAG_SUBS entry maps to exactly one class", () => {
  for (const sub of TAG_SUBS) {
    const owners = Object.keys(CLASSES).filter((c) => CLASSES[c].subs.includes(sub));
    assert.equal(owners.length, 1, sub);
    assert.equal(classOfSub(sub), owners[0]);
  }
});

// --- tagName and fitName -------------------------------------------------------

test("tagName makes a URL-safe underscore name", () => {
  assert.equal(tagName("Hilda Ferrow"), "Hilda_Ferrow");
  assert.equal(tagName("  Anne-Marie   Voss "), "Anne-Marie_Voss");
  assert.equal(tagName("Ëlwyn Døre"), "Elwyn_Dre");
  assert.equal(tagName(null), "");
  assert.equal(tagName(undefined), "");
  assert.equal(tagName("!!! ???"), "");
  assert.equal(tagName("A . B"), "A_B");
});

test("fitName keeps the full name, else First L., else the first name cut short", () => {
  assert.equal(fitName("Lithariel_Silverbough", 16), "Lithariel_S.");
  assert.equal(fitName("Hilda_Ferrow", 16), "Hilda_Ferrow");
  assert.equal(fitName("Abcdefghijklmnopqrstu", 16), "Abcdefghijklmnop");
  assert.equal(fitName("Ab_Cd", 0), "");
  assert.equal(fitName("Ab_Cd", -3), "");
  assert.equal(fitName("Abcdefghij_Klmnop", 5), "Abcde");
  assert.equal(fitName("", 16), "");
});

// --- encodeTag -----------------------------------------------------------------

test("the worked example encodes exactly", () => {
  assert.equal(encodeTag(EXAMPLE), "v1.2.8.3.0.7.22.431.19.4688.1180.Hilda_Ferrow");
});

test("encodeTag reads only the twelve tag fields (extra fields change nothing)", () => {
  const noisy = { ...EXAMPLE, epitaph: "Here lies.", note: "cut down", seed: 42, acts: 900, hash: "deadbeef", when: 1 };
  assert.equal(encodeTag(noisy), encodeTag(EXAMPLE));
  assert.ok(!encodeTag(noisy).includes("lies"));
});

test("one past every cap encodes the cap", () => {
  const over = { ...AT_CAPS };
  for (const k of Object.keys(TAG_FIELD_CAPS)) over[k] = TAG_FIELD_CAPS[k] + 1;
  assert.equal(encodeTag(over), encodeTag(AT_CAPS));
  const huge = { ...AT_CAPS };
  for (const k of Object.keys(TAG_FIELD_CAPS)) huge[k] = 1e15;
  assert.equal(encodeTag(huge), encodeTag(AT_CAPS));
});

test("negatives, NaN, Infinity and non-numbers encode 0; fractions truncate", () => {
  for (const bad of [-1, NaN, Infinity, -Infinity, "7", null, undefined, {}, true]) {
    const t = encodeTag({ ...EXAMPLE, floor: bad });
    assert.equal(t.split(".")[5], "0", String(bad));
  }
  assert.equal(encodeTag({ ...EXAMPLE, floor: 7.9 }).split(".")[5], "7");
});

test("unknown race, sub and cause encode their sentinels and decode to empty", () => {
  const t = encodeTag({ ...EXAMPLE, race: "Gnome", sub: "Plumber", cause: "boredom" });
  const parts = t.split(".");
  assert.equal(parts[1], "9");
  assert.equal(parts[2], "99");
  assert.equal(parts[4], "99");
  const d = decodeTag(t);
  assert.equal(d.race, "");
  assert.equal(d.sub, "");
  assert.equal(d.cls, "");
  assert.equal(d.cause, "");
});

test("a missing or null summary encodes a valid tag of zeros, sentinels and an empty name", () => {
  for (const s of [undefined, null, {}, 42, "x", { name: null, floor: null }]) {
    const t = encodeTag(s);
    assert.equal(t, "v1.9.99.0.99.0.0.0.0.0.0.");
    assert.ok(t.length <= TAG_MAX_LENGTH);
    const d = decodeTag(t);
    assert.ok(d);
    assert.equal(d.name, "");
    assert.equal(d.floor, 0);
  }
});

test("two runs with identical fields encode identical tags", () => {
  assert.equal(encodeTag({ ...EXAMPLE }), encodeTag({ ...EXAMPLE }));
});

test("the length is counted in UTF-16 units of an ASCII string; the name is cleaned before budgeting", () => {
  const t = encodeTag({ ...AT_CAPS, name: "Ëlwyn!!! Døre-Smythe-Vanderholt" });
  assert.ok(t.length <= TAG_MAX_LENGTH);
  assert.ok(/^[\x20-\x7e]*$/.test(t));
  assert.ok(CHARSET_RE.test(t));
  // prefix at caps is 48 characters, so the name budget is 16.
  const prefix = encodeTag(AT_CAPS);
  assert.equal(prefix.length, 48);
  assert.equal(t.slice(48), "Elwyn_D.");
});

test("every generated name fits at typical values and at all caps, and decodes to the full name or First L.", () => {
  const names = everyName();
  assert.ok(names.length > 1000);
  for (const name of names) {
    for (const base of [EXAMPLE, AT_CAPS]) {
      const t = encodeTag({ ...base, name });
      assert.ok(t.length <= TAG_MAX_LENGTH, `${name}: ${t.length}`);
      assert.ok(CHARSET_RE.test(t), t);
      const d = decodeTag(t);
      assert.ok(d, t);
      const words = name.split(" ");
      const short = words.length >= 2 ? `${words[0]} ${words[words.length - 1][0]}.` : name;
      assert.ok(d.name === name || d.name === short, `${name} -> ${d.name}`);
    }
  }
});

test("the longest generated name rides as First L. at all caps", () => {
  const t = encodeTag({ ...AT_CAPS, name: "Lithariel Silverbough" });
  assert.ok(t.length <= TAG_MAX_LENGTH);
  assert.equal(decodeTag(t).name, "Lithariel S.");
  // with typical values it rides in full
  assert.equal(decodeTag(encodeTag({ ...EXAMPLE, name: "Lithariel Silverbough" })).name, "Lithariel Silverbough");
});

// --- decodeTag -----------------------------------------------------------------

test("decodeTag round-trips a frozen object with the capped fields and the derived class", () => {
  const d = decodeTag(encodeTag(EXAMPLE));
  assert.ok(Object.isFrozen(d));
  assert.deepEqual({ ...d }, {
    v: 1, race: "Dwarven", sub: "Pickpocket", cls: "Thief", level: 3, cause: "combat",
    floor: 7, day: 22, steps: 431, kills: 19, gold: 4688, sp: 1180, name: "Hilda Ferrow",
  });
  const over = { ...AT_CAPS, name: "Skeg" };
  for (const k of Object.keys(TAG_FIELD_CAPS)) over[k] = TAG_FIELD_CAPS[k] + 1;
  const dc = decodeTag(encodeTag(over));
  for (const k of Object.keys(TAG_FIELD_CAPS)) assert.equal(dc[k], TAG_FIELD_CAPS[k], k);
  assert.equal(dc.race, "Troll");
  assert.equal(dc.cls, "Magic User");
  assert.equal(dc.cause, "entombed");
  assert.equal(dc.name, "Skeg");
});

test("decodeTag returns null for every malformed input", () => {
  const good = "v1.2.8.3.0.7.22.431.19.4688.1180.X";
  assert.ok(decodeTag(good));
  const bad = [
    null, undefined, 42, "", {},
    "v2.2.8.3.0.7.22.431.19.4688.1180.X",
    "v1.2.8.3.0.7.22.431.19.4688.1180", // 11 fields
    "v1.2.8.3.0.7a.22.431.19.4688.1180.X",
    "v1.2.8.3.0.1234567.22.431.19.4688.1180.X",
    "v1.2.8.3.0..22.431.19.4688.1180.X",
    `v1.2.8.3.0.7.22.431.19.4688.1180.${"A".repeat(65 - 33)}`,
    "v1.2.8.3.0.7.22.431.19.4688.1180.Hil da",
    "v1.2.8.3.0.7.22.431.19.4688.1180.Hilda!",
    "v1.2.8.3.0.7.22.431.19.4688.1180.Ëlwyn",
  ];
  assert.equal(bad[10].length, 65);
  for (const b of bad) assert.equal(decodeTag(b), null, String(b));
});

test("a 64-character tag decodes; the First L. name keeps its dot", () => {
  const t64 = `v1.2.8.3.0.7.22.431.19.4688.1180.${"A".repeat(64 - 33)}`;
  assert.equal(t64.length, 64);
  assert.ok(decodeTag(t64));
  assert.equal(decodeTag("v1.2.8.3.0.7.22.431.19.4688.1180.Lithariel_S.").name, "Lithariel S.");
});

test("out-of-range indices decode to empty strings, and an empty name is allowed", () => {
  // RULES-09/RULES-10 (Phase 75.1): the cause index bumps from 16 to 17 —
  // TAG_CAUSES grew by a second entry ("scrollFumble", index 16), so 16 is no
  // longer out of range.
  const d = decodeTag("v1.6.24.3.17.7.22.431.19.4688.1180.");
  assert.ok(d);
  assert.equal(d.race, "");
  assert.equal(d.sub, "");
  assert.equal(d.cls, "");
  assert.equal(d.cause, "");
  assert.equal(d.name, "");
});

test("decodeTag never throws on hostile input", () => {
  const inputs = [Symbol("x"), () => 1, [], new String("v1"), "~".repeat(64), "........................", "v1..........."];
  for (const i of inputs) assert.doesNotThrow(() => decodeTag(i));
});

// --- source pins -----------------------------------------------------------------

test("the source never reads epitaph, note, seed, hash or acts, and has no clock, randomness, DOM or network", () => {
  const code = stripJs(fs.readFileSync(SRC_PATH, "utf8"));
  for (const re of [/epitaph/i, /\.note\b/, /\bseed\b/, /\.hash\b/, /\bacts\b/]) {
    assert.ok(!re.test(code), `source matches ${re}`);
  }
  for (const re of [/\bDate\b/, /Math\.random/, /\bwindow\./, /\bdocument\./, /\bfetch\b/, /XMLHttpRequest/, /WebSocket/]) {
    assert.ok(!re.test(code), `source matches ${re}`);
  }
});
