// test/unit/hero-conditions.test.js
//
// Phase 77 (CMBUI-13) — the ONE hero and party-member chip table
// (src/browser/heroConditions.js) and its engine-scan coverage guard,
// mirroring test/unit/foe-conditions.test.js.
//
// The user's report (2026-09-25): "When I use the ability smoke, I have no
// indication on myself or the enemies that it's active ... Abilities and
// spells all need to have some sort of active indicator while in combat."
//
// Sections:
//   (a) the table: one entry per descriptor key conditionsOf and
//       memberConditionsOf can emit, each with fields/fight/lasts/source;
//   (b) lotChips, chipText and chipSheetFacts;
//   (c) malformed and hostile inputs;
//   (d) the coverage guard: every hero field, combat-wide flag and member
//       field the engine assigns, every DURATION_ROUNDS ability and every
//       timer id the engine starts is read by an entry, shown by the foe
//       table, or on NOT_A_CONDITION with a reason; plus self-checks and a
//       synthetic miss;
//   (e) HERO_CHIP_COPY is frozen, voice-safe and says HP, never WP;
//   (f) plan 77-08, the shell-table guard: every key this table lists has a
//       label, a tone and an explanation in mazeworld.html's one copy table
//       (CONDITION_COPY / CONDITION_TONE / CONDITION_EXPLAIN, with the
//       documented per-kind label and explanation rules), and every
//       DURATION_ROUNDS ability has an ABILITY_CHIP_LABEL.
//
// The guard reads the engine as text and never edits it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { HERO_CONDITIONS, HERO_CHIP_COPY, LASTS, SOURCES, lotChips, harmfulFirst, chipText, chipSheetFacts } from "../../src/browser/heroConditions.js";
import { FOE_CONDITIONS } from "../../src/browser/foeConditions.js";
import { conditionsOf, memberConditionsOf, SPELL_ACT_OF } from "../../engine/derived.js";
import { DURATION_ROUNDS } from "../../engine/abilities.js";
import { ABILITY_BY_ID } from "../../content/abilities.js";
import { ACTIVATION_OF } from "../../content/activations.js";
import { SCROLL_FUMBLE } from "../../content/scroll-fumbles.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DERIVED = fs.readFileSync(path.join(REPO_ROOT, "engine", "derived.js"), "utf8").replace(/\r\n/g, "\n");

// ─── fixtures ──────────────────────────────────────────────────────────────

function hero(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, maxWP: 40, wp: 40, skills: {}, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0,
    phobia: "Spiders", phobiaType: "x", items: [], might: 0, ward: null, mirror: 0, darkFor: 0, name: "Test Delver",
    ...overrides,
  };
}

function fight({ c = {}, combat = {}, dark = false, party = [] } = {}) {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark, seen: true, feat: null })));
  return {
    c: hero(c),
    floor: { g, px: 1, py: 1, depth: 1 },
    party,
    combat: { foes: [{ name: "Target", wp: 9, maxWP: 9, alive: true }], type: "Beasts", round: 1, target: 0, ...combat },
  };
}

const live = (left) => ({ cadence: "rounds", left, phase: "effect", cd: 4 });

// ─── (a) the table ─────────────────────────────────────────────────────────

/** fnBody(head) — the source of the named function in engine/derived.js. */
function fnBody(head) {
  const start = DERIVED.indexOf(head);
  assert.ok(start !== -1, `${head} found`);
  return DERIVED.slice(start, DERIVED.indexOf("\n}\n", start));
}

/** emittableKeys() — every descriptor key the two enumerators can emit: the
 * literal keys in conditionsOf, liveAbilityChips and memberConditionsOf, plus
 * (Phase 89 plan 06) the two builders both enumerators now share, liveItemChips
 * (the `flight` key) and itemCooldownChips (`itemCooldown`), plus one per live
 * activation kind (the generic item loop; fly shows as flight), plus (Phase 90,
 * SPELL-09) one per live spell-sourced timed effect's act kind (the same loop
 * reads `spell:<name>` records through SPELL_ACT_OF). */
function emittableKeys() {
  const keys = new Set();
  for (const head of ["export function conditionsOf(state)", "function liveItemChips(sheet)", "function itemCooldownChips(sheet)", "function liveAbilityChips(timers)", "export function memberConditionsOf(state, partyIdx)"]) {
    for (const m of fnBody(head).matchAll(/key: "([A-Za-z]+)"/g)) keys.add(m[1]);
  }
  for (const act of [...Object.values(ACTIVATION_OF), ...Object.values(SPELL_ACT_OF)]) {
    const e = act && act.effect;
    const isLive = (typeof e === "number" && e > 0) || (e && typeof e === "object" && e.sides > 0);
    if (isLive) keys.add(act.kind === "fly" ? "flight" : act.kind);
  }
  return keys;
}

test("table: exactly one entry per descriptor key conditionsOf and memberConditionsOf can emit", () => {
  const keys = HERO_CONDITIONS.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length, "no key twice");
  assert.deepEqual([...keys].sort(), [...emittableKeys()].sort());
});

test("table: the scan of emittable keys still sees the CMBUI-13 keys and the old ones", () => {
  const keys = emittableKeys();
  // Phase 91.1 plan 05 (2026-10-01): "inspired" left this list (the Inspire chip was removed; nothing wrote C.inspired).
  for (const k of ["ability", "braced", "insulted", "selfDot", "halfNext", "strength", "fightDark", "nightVision", "ward", "afraid", "foeEffect", "flight", "haste", "lit", "unlock", "enchant"]) {
    assert.ok(keys.has(k), `the scan sees ${k}`);
  }
  assert.ok(!keys.has("strengthBoost"), "the retired doubled-hit-point chip is gone (Phase 90)");
  // Phase 88 (ITEM-03): `knit` (the Cloak of Regeneration) now HAS a live window
  // (effect 30), so it is an emittable chip; before it was effect 0 and never one.
  for (const k of ["fly", "half"]) assert.ok(!keys.has(k), `${k} never makes a live chip`);
  assert.ok(keys.has("knit"), "knit is a live chip since Phase 88");
});

test("table: frozen; every entry has key, non-empty fields, a boolean fight, a documented lasts and source", () => {
  assert.ok(Object.isFrozen(HERO_CONDITIONS));
  for (const e of HERO_CONDITIONS) {
    assert.ok(Object.isFrozen(e), `${e.key} frozen`);
    assert.ok(typeof e.key === "string" && e.key.length > 0);
    assert.ok(Array.isArray(e.fields) && e.fields.length > 0 && Object.isFrozen(e.fields), `${e.key} fields`);
    assert.equal(typeof e.fight, "boolean", `${e.key} fight`);
    assert.ok(LASTS.includes(e.lasts), `${e.key} lasts ${e.lasts}`);
    assert.ok(SOURCES.includes(e.source), `${e.key} source ${e.source}`);
  }
});

test("table: the fight rule — map-only, recharging and waiting chips stay out of YOUR LOT; fight effects are in", () => {
  const fightOf = Object.fromEntries(HERO_CONDITIONS.map((e) => [e.key, e.fight]));
  // Phase 90 plan 07 (SPELL-10): Open/Lock (a next-chest charm) is not a fight chip; Enchant Character changes the rolls of a fight.
  for (const k of ["reveal", "itemCooldown", "staffCharges", "fearArmed", "foresight", "flight", "tongue", "ether", "knit", "unlock"]) assert.equal(fightOf[k], false, `${k} is not a fight chip`);
  for (const k of ["afraid", "foeEffect", "ward", "mirror", "senses", "regen", "ability", "braced", "insulted", "selfDot", "halfNext", "fightDark", "nightVision", "acute", "invis", "unseen", "heroOut", "heroBlind", "heroShrunk", "enchant"]) {
    assert.equal(fightOf[k], true, `${k} is a fight chip`);
  }
});

// ─── (b) lotChips, chipText, chipSheetFacts ────────────────────────────────

test("lotChips: Smoke in a fight is a good ability chip with its rounds and sub", () => {
  const state = fight({ c: { timers: { "ability:smoke": live(2) } } });
  const chips = lotChips(conditionsOf(state));
  assert.equal(chips.length, 1);
  const [ch] = chips;
  assert.deepEqual({ key: ch.key, sub: ch.sub, tone: ch.tone, rounds: ch.rounds }, { key: "ability", sub: "smoke", tone: "good", rounds: 2 });
  assert.equal(ch.cn.ability, "smoke");
  assert.ok(Object.isFrozen(ch) && Object.isFrozen(chips));
  assert.deepEqual(Object.keys(ch), ["key", "sub", "tone", "rounds", "cn"]);
});

test("lotChips: keeps only fight entries, in input order; tone follows polarity; squares effects carry no rounds", () => {
  const conds = [
    { key: "reveal", polarity: "good" }, // Plan 76-06: the reveal chip carries no countdown
    { key: "foeEffect", polarity: "bad", kind: "dazed", remaining: 2 },
    { key: "haste", polarity: "good", remaining: 34, cadence: "squares", source: "Cloak of Speed" },
    { key: "itemCooldown", polarity: "good", item: "Cloak of Speed", remaining: 4 },
    { key: "ward", polarity: "good", pool: 10, remaining: 3, name: "Shield" },
    { key: "senses", polarity: "good" },
    { key: "fearArmed", polarity: "bad", phobia: "Heights", trigger: "heights" },
  ];
  assert.deepEqual(
    lotChips(conds).map(({ key, sub, tone, rounds }) => ({ key, sub, tone, rounds })),
    [
      { key: "foeEffect", sub: "dazed", tone: "bad", rounds: 2 },
      { key: "haste", sub: null, tone: "good", rounds: null },
      { key: "ward", sub: null, tone: "good", rounds: 3 },
      { key: "senses", sub: null, tone: "good", rounds: null },
    ],
  );
});

test("lotChips: every DURATION_ROUNDS ability makes a chip with its rounds when its effect is live", () => {
  for (const id of Object.keys(DURATION_ROUNDS)) {
    const state = fight({ c: { timers: { [`ability:${id}`]: live(DURATION_ROUNDS[id]) } } });
    const chips = lotChips(conditionsOf(state));
    assert.deepEqual(chips.map((c) => [c.key, c.sub, c.rounds]), [["ability", id, DURATION_ROUNDS[id]]], id);
    assert.ok(abilityName(id), `${id} has a content name`);
  }
});

function abilityName(id) {
  return ABILITY_BY_ID[id] && ABILITY_BY_ID[id].name;
}

test("lotChips: a member's chips come from memberConditionsOf through the same table", () => {
  const party = [hero({ name: "Joiner", timers: { "ability:sidestep": live(1) } })];
  const state = fight({ combat: { allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30, braced: true }] }, party });
  assert.deepEqual(lotChips(memberConditionsOf(state, 0)).map((c) => [c.key, c.sub, c.rounds]), [["ability", "sidestep", 1], ["braced", null, null]]);
});

// ─── (b2) harmfulFirst (Phase 93, CHIP-01) ─────────────────────────────────

const BAD_KEYS = ["affliction", "foeEffect", "darkness", "fearArmed", "afraid", "heroOut", "heroBlind", "heroShrunk", "fightDark", "insulted", "selfDot"];

test("harmfulFirst: a stable bad-first partition — same objects, each group in input order", () => {
  const g1 = { key: "haste", polarity: "good" };
  const b1 = { key: "darkness", polarity: "bad" };
  const g2 = { key: "might", polarity: "good" };
  const b2 = { key: "affliction", polarity: "bad" };
  const g3 = { key: "mirror", polarity: "good" };
  const out = harmfulFirst([g1, b1, g2, b2, g3]);
  assert.equal(out.length, 5);
  [b1, b2, g1, g2, g3].forEach((cn, i) => assert.equal(out[i], cn, `slot ${i} is the same object`));
});

test("harmfulFirst: an all-good list and an all-bad list come back in their own order", () => {
  const goods = [{ key: "haste", polarity: "good" }, { key: "might", polarity: "good" }, { key: "mirror", polarity: "good" }];
  const bads = [{ key: "darkness", polarity: "bad" }, { key: "afraid", polarity: "bad" }, { key: "selfDot", polarity: "bad" }];
  assert.deepEqual(harmfulFirst(goods).map((c) => c.key), ["haste", "might", "mirror"]);
  assert.deepEqual(harmfulFirst(bads).map((c) => c.key), ["darkness", "afraid", "selfDot"]);
  assert.deepEqual(harmfulFirst([]), []);
});

test("harmfulFirst: the input is not mutated and the result is frozen", () => {
  const input = [{ key: "haste", polarity: "good" }, { key: "darkness", polarity: "bad" }];
  const snapshot = [...input];
  const out = harmfulFirst(input);
  assert.deepEqual(input, snapshot);
  assert.equal(input[0], snapshot[0]);
  assert.notEqual(out, input);
  assert.ok(Object.isFrozen(out));
  assert.ok(Object.isFrozen(harmfulFirst([])));
});

test("harmfulFirst: null, undefined, a string and a non-array object give a frozen empty array", () => {
  for (const bad of [null, undefined, "affliction", 7, { length: 2, 0: { polarity: "bad" } }]) {
    const out = harmfulFirst(bad);
    assert.deepEqual(out, [], String(bad));
    assert.ok(Object.isFrozen(out));
  }
});

test("harmfulFirst: a throwing polarity getter, a null entry and a missing polarity are kept in the rest group, in order", () => {
  const hostile = {};
  Object.defineProperty(hostile, "polarity", { get() { throw new Error("hostile"); } });
  hostile.key = "haste";
  const noPolarity = { key: "might" };
  const bad = { key: "darkness", polarity: "bad" };
  let out;
  assert.doesNotThrow(() => { out = harmfulFirst([hostile, null, noPolarity, bad]); });
  assert.equal(out.length, 4);
  assert.equal(out[0], bad);
  assert.equal(out[1], hostile);
  assert.equal(out[2], null);
  assert.equal(out[3], noPolarity);
});

test("harmfulFirst: all eleven polarity-bad keys go first, in input order, ahead of interleaved good ones", () => {
  const goods = ["haste", "might", "mirror", "foresight"].map((key) => ({ key, polarity: "good" }));
  const conds = [];
  BAD_KEYS.forEach((key, i) => {
    conds.push(goods[i % goods.length]);
    conds.push({ key, polarity: "bad" });
  });
  const out = harmfulFirst(conds);
  assert.deepEqual(out.slice(0, 11).map((c) => c.key), BAD_KEYS);
  assert.ok(out.slice(0, 11).every((c) => c.polarity === "bad"));
  assert.ok(out.slice(11).every((c) => c.polarity === "good"));
  assert.equal(out.length, conds.length);
});

test("harmfulFirst: the test is polarity, never tone — an engine-good ether stays in the good group", () => {
  const ether = { key: "ether", polarity: "good" };
  const afraid = { key: "afraid", polarity: "bad" };
  const haste = { key: "haste", polarity: "good" };
  assert.deepEqual(harmfulFirst([ether, haste, afraid]).map((c) => c.key), ["afraid", "ether", "haste"]);
});

test("harmfulFirst: a real conditionsOf list — Poisoned leads, then the rest in conditionsOf's own order", () => {
  const state = fight({ c: { might: 2, mirror: 1, affliction: { kind: "Poison" }, darkFor: 3, timers: { "ability:smoke": live(2) } } });
  const conds = conditionsOf(state);
  const keys = conds.map((c) => c.key);
  assert.notEqual(keys[0], "affliction", "the engine emits good descriptors first");
  assert.ok(keys.indexOf("affliction") >= 2, "at least two good conditions precede the affliction");
  const out = harmfulFirst(conds);
  assert.equal(out[0].key, "affliction");
  assert.deepEqual(
    out.map((c) => c.key),
    [...conds.filter((c) => c.polarity === "bad"), ...conds.filter((c) => c.polarity !== "bad")].map((c) => c.key),
  );
  assert.deepEqual(conds.map((c) => c.key), keys, "conditionsOf's own list is untouched");
});

test("lotChips: keeps its input order — the partition lives only in harmfulFirst, so the member card never reorders", () => {
  const conds = [
    { key: "haste", polarity: "good", remaining: 34, cadence: "squares", source: "Cloak of Speed" },
    { key: "foeEffect", polarity: "bad", kind: "dazed", remaining: 2 },
  ];
  assert.deepEqual(lotChips(conds).map((c) => c.key), ["haste", "foeEffect"]);
  assert.deepEqual(lotChips(harmfulFirst(conds)).map((c) => c.key), ["foeEffect", "haste"]);
});

test("chipText: the house style — ' · n' only for a whole-number rounds above 0", () => {
  assert.equal(chipText("Smoke", { rounds: 2 }), "Smoke · 2");
  assert.equal(chipText("Shield", { rounds: 3 }), "Shield · 3");
  assert.equal(chipText("Senses", { rounds: null }), "Senses");
  assert.equal(chipText("Senses", {}), "Senses");
  for (const bad of [0, -1, 1.5, "2", NaN]) assert.equal(chipText("Smoke", { rounds: bad }), "Smoke", `rounds ${String(bad)}`);
  assert.equal(chipText("Smoke", null), "Smoke");
  assert.equal(chipText(null, { rounds: 2 }), "", "no label, no orphan count");
  assert.equal(chipText("", { rounds: 2 }), "");
});

test("chipSheetFacts: an ability chip names its rounds, its ability and the ability's own content text", () => {
  const facts = chipSheetFacts({ key: "ability", ability: "smoke", polarity: "good", remaining: 2, cadence: "rounds" });
  assert.deepEqual(facts, { lasts: "2 more rounds", source: "from your Smoke", detail: ABILITY_BY_ID.smoke.txt });
  assert.ok(Object.isFrozen(facts));
  assert.equal(chipSheetFacts({ key: "ability", ability: "riposte", polarity: "good", remaining: 1 }).lasts, "1 more round");
});

test("chipSheetFacts: every lasts and source phrase", () => {
  const f = (cn) => chipSheetFacts(cn);
  assert.deepEqual(f({ key: "braced", polarity: "good" }), { lasts: "until the next blow lands", source: `from your ${ABILITY_BY_ID.brace.name}`, detail: "" });
  assert.deepEqual(f({ key: "insulted", polarity: "bad" }), { lasts: "for the rest of this fight", source: "from your insult", detail: "" });
  // Phase 90 (SPELL-09): the Strength spell's chip counts squares and names the spell as its source.
  assert.deepEqual(f({ key: "strength", polarity: "good", remaining: 61, cadence: "squares", source: "Strength" }), { lasts: "61 squares left", source: "from a spell", detail: "" });
  // Phase 90 plan 07 (SPELL-10): Open/Lock and Enchant Character count squares and name a spell as their source.
  assert.deepEqual(f({ key: "unlock", polarity: "good", remaining: 140, cadence: "squares", source: "Open/Lock" }), { lasts: "140 squares left", source: "from a spell", detail: "" });
  assert.deepEqual(f({ key: "enchant", polarity: "good", remaining: 1, cadence: "squares", source: "Enchant Character" }), { lasts: "1 square left", source: "from a spell", detail: "" });
  assert.deepEqual(f({ key: "halfNext", polarity: "good" }), { lasts: "until the next blow lands", source: "from Pendant of Fortitude", detail: "" });
  assert.deepEqual(f({ key: "fearArmed", polarity: "bad", phobia: "Heights" }), { lasts: "until your next fight", source: "from your fear", detail: "" });
  assert.deepEqual(f({ key: "selfDot", polarity: "bad", remaining: 2, by: "acid", spell: "Acid" }), { lasts: "2 more rounds", source: "from a fumbled scroll", detail: "" });
  assert.deepEqual(f({ key: "foeEffect", polarity: "bad", kind: "dazed", remaining: 2 }), { lasts: "2 more rounds", source: "from a foe's power", detail: "" });
  assert.deepEqual(f({ key: "fightDark", polarity: "bad" }), { lasts: "for the rest of this fight", source: "from the dark", detail: "" });
  assert.deepEqual(f({ key: "darkness", polarity: "bad", remaining: 12 }), { lasts: "12 squares left", source: "from the dark", detail: "" });
  // Plan 76-06 (user ruling 2026-09-26): Map the Floor lasts until you move; its chip has no countdown.
  assert.deepEqual(f({ key: "reveal", polarity: "good" }), { lasts: "until you move", source: "from a spell", detail: "" });
  assert.deepEqual(f({ key: "haste", polarity: "good", remaining: 34, cadence: "squares", source: "Cloak of Speed" }), { lasts: "34 squares left", source: "from Cloak of Speed", detail: "" });
  // Phase 90: a source-less might chip is the phobia rage (c.might), not a spell.
  assert.deepEqual(f({ key: "might", polarity: "good" }), { lasts: "until the day ends", source: "from your fear", detail: "" });
  assert.deepEqual(f({ key: "might", polarity: "good", remaining: 5, cadence: "squares", source: "Strength", might: 8 }), { lasts: "5 squares left", source: "from Strength", detail: "" });
  assert.deepEqual(f({ key: "ward", polarity: "good", pool: 0, name: "Bubble", mirror: true }).lasts, "until the next blow lands");
  assert.deepEqual(f({ key: "staffCharges", polarity: "good", item: "Oak Staff", charges: 2, max: 5, remaining: 9 }), { lasts: "2 of 5 charges left", source: "from Oak Staff", detail: "" });
  // VOX-05 (79-07): an affliction also runs out on its own (engine/movement.js
  // counts c.affliction.left down), so its "how long" says so.
  assert.deepEqual(f({ key: "affliction", polarity: "bad", kind: "Poison" }), { lasts: "until it runs its course or something cures it", source: "from the dungeon's hospitality", detail: "" });
  assert.deepEqual(f({ key: "nightVision", polarity: "good" }), { lasts: "for the rest of this fight", source: "from your own eyes", detail: "" });
  assert.deepEqual(f({ key: "afraid", polarity: "bad", remaining: 2, phobia: "Crowds" }).lasts, "2 more rounds");
  assert.deepEqual(f({ key: "heroOut", polarity: "bad", kind: "sleep", remaining: 1 }).source, "from a fumbled scroll");
});

// ─── (c) malformed and hostile inputs ──────────────────────────────────────

test("malformed: lotChips and chipSheetFacts never throw and give empty results", () => {
  for (const bad of [null, undefined, 0, "x", {}, { key: 7 }]) {
    assert.deepEqual(lotChips(bad), []);
    assert.deepEqual(chipSheetFacts(bad), { lasts: "", source: "", detail: "" });
  }
  assert.deepEqual(lotChips([null, 3, "x", { key: "nope" }, { key: "senses", polarity: "good" }]).map((c) => c.key), ["senses"]);
  // a rounds entry missing its count reads no rounds and no lasts phrase
  assert.deepEqual(lotChips([{ key: "ability", ability: "smoke", polarity: "good" }]).map((c) => c.rounds), [null]);
  assert.equal(chipSheetFacts({ key: "ability", ability: "smoke" }).lasts, "");
  // an unknown ability id names nothing and has no detail
  assert.deepEqual(chipSheetFacts({ key: "ability", ability: "hexStorm", remaining: 2 }), { lasts: "2 more rounds", source: "", detail: "" });
  assert.deepEqual(chipSheetFacts({ key: "ability", ability: "__proto__", remaining: 2 }), { lasts: "2 more rounds", source: "", detail: "" });
  // staff charges with no numbers
  assert.equal(chipSheetFacts({ key: "staffCharges", item: "Oak Staff" }).lasts, "");
});

test("hostile: a throwing getter drops only what read it", () => {
  const cn = { key: "ability", ability: "smoke", polarity: "good" };
  Object.defineProperty(cn, "remaining", { get() { throw new Error("boom"); }, enumerable: true });
  let out;
  assert.doesNotThrow(() => { out = lotChips([cn, { key: "senses", polarity: "good" }]); });
  assert.deepEqual(out.map((c) => [c.key, c.rounds]), [["ability", null], ["senses", null]]);
  assert.doesNotThrow(() => chipSheetFacts(cn));
  const hostileKey = {};
  Object.defineProperty(hostileKey, "key", { get() { throw new Error("boom"); } });
  assert.deepEqual(lotChips([hostileKey]), []);
  assert.deepEqual(chipSheetFacts(hostileKey), { lasts: "", source: "", detail: "" });
});

test("purity: the table's functions never mutate a descriptor", () => {
  const conds = conditionsOf(fight({ dark: true, c: { timers: { "ability:smoke": live(2) } }, combat: { braced: true, selfDot: { left: 2, by: "ice", spell: "Ice" } } }));
  const before = JSON.stringify(conds);
  lotChips(conds);
  conds.forEach((cn) => chipSheetFacts(cn));
  assert.equal(JSON.stringify(conds), before);
  assert.deepEqual(lotChips(conds), lotChips(conds));
});

// ─── (d) the engine-scan coverage guard ────────────────────────────────────

const ENGINE_DIR = path.join(REPO_ROOT, "engine");
const ENGINE_FILES = fs.readdirSync(ENGINE_DIR).filter((f) => f.endsWith(".js")).map((f) => `engine/${f}`);

/** NOT_A_CONDITION — every field the scan finds on the hero, the fight or a
 * party member that is NOT an effect the player should see as a chip, each
 * with its one-line reason. Test-owned: the engine is never edited to
 * satisfy this guard. */
const NOT_A_CONDITION = Object.freeze({
  // ── hero sheet: stats, kit and bookkeeping ──
  wp: "hit points: the HP bar shows them",
  maxWP: "max hit points: the HP bar shows them",
  strengthBoost: "retired (Phase 90): only the tolerant load (engine/saveState.js) deletes the old Strength doubling field; no live effect",
  sp: "spell points: the SP bar shows them",
  vp: "victory points: the sheet shows them",
  level: "the hero's level: the sheet shows it",
  name: "the hero's name",
  sub: "the sub-class: identity, not an effect",
  abilities: "the list of abilities known; a live one shows as its ability chip",
  grimoire: "the spells known: the SPELLS menu lists them",
  spellsUsed: "the spells cast today: the SPELLS menu's cost line counts them",
  gold: "the purse: the HUD shows it",
  rations: "food: the HUD shows it",
  potions: "healing potions carried: the ITEMS menu shows them",
  scrolls: "scrolls carried: the ITEMS menu shows them",
  items: "the bag: the ITEMS menu shows it",
  worn: "the worn slots: the gear screen shows them",
  bag: "the bag size: the gear screen shows it",
  staff: "the staff carried: its charges show through staffCharges",
  weapon: "the weapon: the sheet and the strike odds show it",
  prof: "weapon proficiency: the sheet shows it",
  magicWpn: "the weapon's magic plus: the sheet shows it",
  armor: "the armour: the sheet shows it",
  ar: "the armour's soak rating: the sheet shows it",
  armorMin: "the armour's soak floor: the sheet shows it",
  armorMax: "the armour's durability cap: the sheet shows it",
  armorWP: "the armour's durability: the sheet shows it",
  patches: "armour patches carried: the ITEMS menu shows them",
  kills: "the kill count for the graveyard",
  joiner: "the Joiner offer: a party member gets its own YOUR LOT card",
  phobiaType: "the fear's trigger family: a trait, shown as Afraid only when it bites",
  phobiaState: "the terrain-phobia bookkeeping behind fearArmed",
  dupAt: "the duplicate-find bookkeeping for loot",
  pendingAlly: "a summon queued for the next fight: it appears as its own YOUR LOT card when that fight starts",
  scrollCast: "set and cleared inside one scroll read",
  // ── the fight ──
  allies: "the party members' combat entries: each member has its own YOUR LOT card",
  ally: "the summoned ally: its own YOUR LOT card with its rounds",
  abilityStrike: "an ability's strike, consumed inside the same action",
  cut: "the Cutthroat's once-a-fight crit is spent, narrated by its own line",
  // Phase 91 (IDENT-17, plan 91-06): a Bard's once-per-fight song has been sung; the combat menu's SING row says SPENT THIS FIGHT (Phase 94) and the Oracle names the song.
  sang: "the Bard's once-per-fight song is spent: the SING row says SPENT THIS FIGHT",
  // Phase 91.1 plan 03 part B (V7 B, 2026-10-01): the round of the first song (null after the second), the SING row's clock.
  sangAt: "the round of the Bard's first song (null after the second): the SING row counts READY IN n from it",
  opened: "the Cat Burglar/Ninja free opener is spent, narrated by its own line",
  opened2: "the opening strike has landed (opening-crit bookkeeping)",
  first: "initiative: who swings first",
  target: "the hero's aim: the foe card shows it",
  round: "the round counter the header shows",
  pending: "the pre-join encounter marker",
  pendingFoes: "foes waiting to join: they arrive as foe cards",
  spellOpen: "the spell submenu's open flag",
  parleyTried: "the one parley attempt is spent",
  tongue: "Phase 90 plan 09: Chameleon Tongue's fight-scoped fluency (the parley's own bonus, spent by the cast itself): the roll line says \"+4 for the tongue\"; not a condition the hero carries",
  foeToHitPenalty: "the to-hit half of Weaken: the foe cards' Weakened chip shows it",
  // ── a party member's combat entry ──
  backstabUsed: "the member's once-a-fight backstab is spent",
});

/** NOT_A_TIMER — timer id families the scan finds that are not effects. */
const NOT_A_TIMER = Object.freeze({
  "joiner:*": "a Joiner's derived rng stream key, not a c.timers record",
});

/** FOE_TABLE_TIMERS — timer ids the foe table shows (its entry key must exist). */
const FOE_TABLE_TIMERS = Object.freeze({ "spell:weaken": "weakened" });

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
}

const ASSIGN = String.raw`\s*(?:=(?![=>])|\+=|-=|\*=|\/=|\+\+|--)`;
const HERO_BINDING = String.raw`(?<![\w.$])(?:c|state\.c|hero)`;
const COMBAT_BINDING = String.raw`(?<![\w.$])(?:state\.combat|combat|C)`;
const MEMBER_BINDING = String.raw`(?<![\w.$])(?:ally|member|sheet)`;

/** scanEngineFields(src) — { hero, combat, member } Sets of every field the
 * source assigns (=, op=, ++, --, prefix ++/--, delete) on each binding.
 * Comments are stripped first. */
function scanEngineFields(rawSrc) {
  const src = stripComments(rawSrc);
  const out = { hero: new Set(), combat: new Set(), member: new Set() };
  const collect = (binding, into) => {
    const patterns = [
      new RegExp(`${binding}\\.([A-Za-z_$][\\w$]*)${ASSIGN}`, "g"),
      new RegExp(`(?:\\+\\+|--)\\s*${binding}\\.([A-Za-z_$][\\w$]*)`, "g"),
      new RegExp(`delete\\s+${binding}\\.([A-Za-z_$][\\w$]*)`, "g"),
    ];
    for (const re of patterns) for (const m of src.matchAll(re)) into.add(m[1]);
  };
  collect(HERO_BINDING, out.hero);
  collect(COMBAT_BINDING, out.combat);
  collect(MEMBER_BINDING, out.member);
  return out;
}

/** scanTimerIds(src) — every timer id started with a literal id, and every
 * `prefix:${…}` template family ("prefix:*"). */
function scanTimerIds(rawSrc) {
  const src = stripComments(rawSrc);
  const ids = new Set();
  for (const m of src.matchAll(/start(?:Effect|Cooldown)\(\s*[\w.]+\s*,\s*["'`]([a-z]+:[^"'`$]+)["'`]/g)) ids.add(m[1]);
  for (const m of src.matchAll(/`([a-z]+):\$\{/g)) ids.add(`${m[1]}:*`);
  return ids;
}

function scanAll() {
  const all = { hero: new Set(), combat: new Set(), member: new Set(), timers: new Set() };
  for (const rel of ENGINE_FILES) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
    const r = scanEngineFields(src);
    for (const k of ["hero", "combat", "member"]) r[k].forEach((f) => all[k].add(f));
    scanTimerIds(src).forEach((id) => all.timers.add(id));
  }
  return all;
}

/** coveredFields() — every field a hero entry reads, plus every field or key the foe table reads. */
function coveredFields() {
  const out = new Set();
  for (const e of HERO_CONDITIONS) for (const f of e.fields) out.add(f);
  for (const e of FOE_CONDITIONS) {
    out.add(e.key);
    for (const f of e.fields || []) out.add(f);
  }
  return out;
}

function uncovered(fields) {
  const covered = coveredFields();
  return [...fields].filter((k) => !covered.has(k) && !Object.hasOwn(NOT_A_CONDITION, k)).sort();
}

/** timerCovered(id) — is timer id (or family) read by a hero entry, shown by the foe table, or excused? */
function timerCovered(id) {
  const family = id.includes("*") ? id : `${id.split(":")[0]}:*`;
  for (const e of HERO_CONDITIONS) for (const t of e.timers || []) if (t === id || t === family) return true;
  if (Object.hasOwn(FOE_TABLE_TIMERS, id)) return FOE_CONDITIONS.some((e) => e.key === FOE_TABLE_TIMERS[id]);
  return Object.hasOwn(NOT_A_TIMER, id) || Object.hasOwn(NOT_A_TIMER, family);
}

test("coverage guard: every hero field, combat-wide flag and member field the engine assigns is a chip, a foe chip, or a reasoned NOT_A_CONDITION", () => {
  const { hero: h, combat, member } = scanAll();
  const missing = uncovered(new Set([...h, ...combat, ...member]));
  assert.deepEqual(missing, [], `engine fields with no chip and no NOT_A_CONDITION reason: ${missing.join(", ")} — add a HERO_CONDITIONS entry (src/browser/heroConditions.js) or a reasoned exclusion here`);
});

test("coverage guard: every timer id the engine starts is read by an entry, shown by the foe table, or excused", () => {
  const { timers } = scanAll();
  const missing = [...timers].filter((id) => !timerCovered(id)).sort();
  assert.deepEqual(missing, [], `timer ids with no chip: ${missing.join(", ")}`);
});

test("coverage guard: every DURATION_ROUNDS ability is read by the ability entry and has a content name", () => {
  const entry = HERO_CONDITIONS.find((e) => e.key === "ability");
  assert.ok(entry && entry.timers.includes("ability:*"));
  for (const id of Object.keys(DURATION_ROUNDS)) {
    assert.ok(ABILITY_BY_ID[id] && ABILITY_BY_ID[id].name, `${id} has a name`);
    const cn = conditionsOf(fight({ c: { timers: { [`ability:${id}`]: live(1) } } })).find((x) => x.key === "ability");
    assert.equal(cn && cn.ability, id, `${id} makes an ability chip`);
  }
});

test("coverage guard self-check: the scan still sees the known hero, combat and member fields and timer ids", () => {
  const { hero: h, combat, member, timers } = scanAll();
  for (const k of ["halfNext", "foeEffect", "ward", "mirror", "senses", "regen", "foresight", "fearArmed", "darkFor", "affliction"]) assert.ok(h.has(k), `hero ${k}`);
  // Phase 91 plan 06: "inspired" left this list (nothing assigns C.inspired once the level-2 song retired).
  for (const k of ["braced", "parleyInsulted", "selfDot", "heroOut", "heroBlind", "heroShrunk", "afraid", "weakened"]) assert.ok(combat.has(k), `combat ${k}`);
  assert.ok(member.has("braced"), "member braced");
  for (const id of ["spell:weaken", "spell:reveal", "ability:*", "item:*", "charges:*"]) assert.ok(timers.has(id), `timer ${id}`);
});

test("coverage guard self-check: a synthetic `c.newHex = true` and a combat-wide `C.hexStorm = 2` are reported", () => {
  const synthetic = "function applyHex(c, C) {\n  c.newHex = true;\n  C.hexStorm = 2;\n  // c.commentOnly = true;\n  sheet.memberHex++;\n}\n";
  const r = scanEngineFields(synthetic);
  assert.deepEqual(uncovered(new Set([...r.hero, ...r.combat, ...r.member])), ["hexStorm", "memberHex", "newHex"]);
  const r2 = scanEngineFields("if (c.halfNext === true && C.braced == 0) run((c) => c.ward);\n");
  assert.deepEqual([...r2.hero, ...r2.combat], []);
  const r3 = scanEngineFields("delete c.a; state.c.b++; --hero.d; state.combat.g = 1; combat.h += 2; ally.i = 1;");
  assert.deepEqual([...r3.hero].sort(), ["a", "b", "d"]);
  assert.deepEqual([...r3.combat].sort(), ["g", "h"]);
  assert.deepEqual([...r3.member], ["i"]);
  const t = scanTimerIds("startEffect(c, \"spell:hex\", { rounds: 2 }); const id = `curse:${k}`;");
  assert.deepEqual([...t].filter((id) => !timerCovered(id)).sort(), ["curse:*", "spell:hex"]);
});

test("coverage guard: NOT_A_CONDITION never lists a covered field, and every reason is a non-empty line", () => {
  const covered = coveredFields();
  for (const [k, reason] of Object.entries(NOT_A_CONDITION)) {
    assert.equal(covered.has(k), false, `${k} is both a chip field and on NOT_A_CONDITION`);
    assert.ok(typeof reason === "string" && reason.trim().length > 0 && !reason.includes("\n"), `${k} needs a one-line reason`);
  }
});

// ─── (e) copy ──────────────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
const PLAYER_WP_RULE = /(?<![\w.$-])(wp|WP)(?![\w:])/;

function leaves(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") out.push(...leaves(v, p));
    else out.push([p, v]);
  }
  return out;
}

test("HERO_CHIP_COPY: frozen at every level, every leaf a non-empty string, clear of BANNED, HP never WP", () => {
  assert.ok(Object.isFrozen(HERO_CHIP_COPY));
  assert.ok(Object.isFrozen(HERO_CHIP_COPY.lasts) && Object.isFrozen(HERO_CHIP_COPY.source));
  const all = leaves(HERO_CHIP_COPY);
  assert.ok(all.length > 0);
  for (const [p, value] of all) {
    assert.ok(typeof value === "string" && value.trim().length > 0, `${p} must be a non-empty string`);
    for (const { term, re } of MATCHERS) {
      const m = value.match(re);
      assert.ok(!m || ALLOW.has(m[0].toLowerCase()), `${p} ("${value}") hits BANNED term ${term}`);
    }
    assert.ok(!PLAYER_WP_RULE.test(value), `${p} ("${value}") says WP; the player reads HP`);
  }
  // every lasts kind but rounds/squares has its own phrase; every source kind has one
  for (const k of LASTS.filter((k) => k !== "rounds" && k !== "squares")) assert.ok(HERO_CHIP_COPY.lasts[k], `lasts ${k}`);
  for (const k of SOURCES) assert.ok(HERO_CHIP_COPY.source[k], `source ${k}`);
});

// ─── (f) plan 77-08: the shell-table guard ─────────────────────────────────
//
// CMBUI-13 (plan 77-08): the chip's label and explanation live in the
// shell's one copy table (mazeworld.html). This guard reads those tables as
// text and fails when a key this table lists (or a DURATION_ROUNDS ability)
// has no label, tone or explanation, so a new chip can never reach the HUD
// strip or YOUR LOT as a raw key or the generic default sentence.

const SHELL = stripHtml(fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n"));

/** shellLiteral(name) — the `const NAME = { ... }` object literal's source (brace-matched). */
function shellLiteral(name) {
  const start = SHELL.indexOf(`const ${name} = {`);
  assert.ok(start !== -1, `const ${name} = { not found in mazeworld.html`);
  const braceStart = SHELL.indexOf("{", start);
  let depth = 0;
  let i = braceStart;
  for (; i < SHELL.length; i++) {
    if (SHELL[i] === "{") depth++;
    else if (SHELL[i] === "}") { depth--; if (depth === 0) break; }
  }
  return SHELL.slice(braceStart, i + 1);
}

/** stringMap(name) — a flat `{ key: "text", ... }` literal as a Map. */
function stringMap(name) {
  return new Map([...shellLiteral(name).matchAll(/(\w+):\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => [m[1], m[2]]));
}

/** copyLabels() — CONDITION_COPY's `key: { label: "..." }` rows as a Map. */
function copyLabels() {
  return new Map([...shellLiteral("CONDITION_COPY").matchAll(/(\w+):\s*\{\s*label:\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

// Keys whose chip label is NOT a fixed CONDITION_COPY label: conditionLabel
// names them from the descriptor itself (documented label rules).
const LABEL_RULES = Object.freeze({
  affliction: "names its own kind (Poison, Disease)",
  itemCooldown: "names the cooling item",
  staffCharges: "names the recharging staff",
});

// House style: one capitalised word, a hyphen allowed. VOX-05 (79-07): the
// last exception, heroOut's two-word "Can't act", became one word per kind
// (Asleep/Stupefied/Maddened, "Helpless" as the fallback), so no label is
// exempt any more; the map stays so a future ruling has one place to go.
const ONE_WORD = /^[A-Z][a-z]+(?:-[A-Za-z][a-z]*)?$/;
const LABEL_STYLE_EXEMPT = Object.freeze({});

test("(f) shell guard: every table key has a CONDITION_COPY label (or a documented label rule) and a CONDITION_EXPLAIN sentence of its own", () => {
  const labels = copyLabels();
  const explain = stringMap("CONDITION_EXPLAIN");
  assert.ok(explain.get("default"), "CONDITION_EXPLAIN keeps its default");
  for (const e of HERO_CONDITIONS) {
    if (LABEL_RULES[e.key]) assert.ok(!labels.get(e.key), `${e.key} is labelled by rule (${LABEL_RULES[e.key]}), not a fixed label`);
    else assert.ok(labels.get(e.key), `${e.key} has no CONDITION_COPY label: the HUD strip would show the raw key`);
    const sentence = explain.get(e.key);
    assert.ok(sentence && sentence !== explain.get("default"), `${e.key} has no CONDITION_EXPLAIN sentence of its own`);
  }
});

test("(f) shell guard: every fight chip has a CONDITION_TONE, and every static fight label is one capitalised word", () => {
  const labels = copyLabels();
  const tones = stringMap("CONDITION_TONE");
  for (const e of HERO_CONDITIONS.filter((x) => x.fight)) {
    assert.ok(["good", "bad", "warn", "odd"].includes(tones.get(e.key)), `${e.key} has no CONDITION_TONE`);
    const label = labels.get(e.key);
    if (LABEL_STYLE_EXEMPT[e.key]) continue;
    assert.match(label, ONE_WORD, `${e.key}'s label "${label}" is not one capitalised word`);
  }
  for (const [kind, label] of stringMap("FOE_EFFECT_LABEL")) assert.match(label, ONE_WORD, `FOE_EFFECT_LABEL.${kind}`);
  // VOX-05 (79-07): heroOut's per-kind labels cover every kind a fumble can
  // set (content/scroll-fumbles.js "out" rows, plus Noxious Vapor's asleep)
  // and each is one word.
  const kindsMatch = /heroOut:\s*\{[^}]*kinds:\s*(\{[^}]*\})/.exec(shellLiteral("CONDITION_COPY"));
  assert.ok(kindsMatch, "CONDITION_COPY.heroOut carries a kinds map");
  const heroOutKinds = new Map([...kindsMatch[1].matchAll(/(\w+):\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const fumbleKinds = new Set(["asleep", ...Object.values(SCROLL_FUMBLE).filter((r) => r.effect === "out").map((r) => r.kind)]);
  assert.deepEqual([...heroOutKinds.keys()].sort(), [...fumbleKinds].sort());
  for (const [kind, label] of heroOutKinds) assert.match(label, ONE_WORD, `CONDITION_COPY.heroOut.kinds.${kind}`);
  // CONDITION_TONE stays a subset of the CONDITION_COPY keys plus affliction.
  for (const key of tones.keys()) assert.ok(labels.has(key) || key === "affliction", `CONDITION_TONE.${key} has no CONDITION_COPY row`);
  assert.equal(labels.get("darkness"), "Dark", "CMBUI-13: 'In the dark' became one word");
});

test("(f) shell guard: every DURATION_ROUNDS ability has an ABILITY_CHIP_LABEL (one word), and nothing else does", () => {
  const abilityLabels = stringMap("ABILITY_CHIP_LABEL");
  assert.deepEqual([...abilityLabels.keys()].sort(), Object.keys(DURATION_ROUNDS).sort());
  for (const [id, label] of abilityLabels) {
    assert.match(label, ONE_WORD, `ABILITY_CHIP_LABEL.${id} "${label}"`);
    assert.ok(ABILITY_BY_ID[id] && ABILITY_BY_ID[id].txt, `${id}'s tap sheet reads the ability's own content text`);
  }
});

test("(f) shell guard: every foe-given effect kind has its own FOE_EFFECT_EXPLAIN sentence naming what it does", () => {
  const kinds = [...stringMap("FOE_EFFECT_LABEL").keys()].sort();
  const explain = stringMap("FOE_EFFECT_EXPLAIN");
  assert.deepEqual([...explain.keys()].sort(), kinds);
  assert.match(explain.get("weakened"), /half damage/, "Weakened says your blows do half damage");
  assert.match(explain.get("dazed"), /hit/, "Dazed says it is harder to hit");
});

test("(f) shell guard: the new copy is clear of BANNED and says HP, never WP", () => {
  const texts = [
    ...stringMap("CONDITION_EXPLAIN"),
    ...stringMap("FOE_EFFECT_EXPLAIN"),
    ...stringMap("ABILITY_CHIP_LABEL"),
    ...copyLabels(),
  ];
  for (const [k, value] of texts) {
    for (const { term, re } of MATCHERS) {
      const m = value.match(re);
      assert.ok(!m || ALLOW.has(m[0].toLowerCase()), `${k} ("${value}") hits BANNED term ${term}`);
    }
    assert.ok(!PLAYER_WP_RULE.test(value), `${k} ("${value}") says WP; the player reads HP`);
  }
});
