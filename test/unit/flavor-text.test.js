// test/unit/flavor-text.test.js
//
// Phase 95 (FLAVOR-05; CONTEXT 'Data shape and guards'): the pure flavour
// lookup in src/browser/flavorText.js. Domain shape, key resolution for every
// item shape the engine builds, the never-throws / never-mutates contract, and
// the "" fallback. Written to stay green as the *_FLAVOR maps land (95-03..07):
// the absent-map assertions are conditional on the live export.

import test from "node:test";
import assert from "node:assert/strict";

import {
  FLAVOR_DOMAINS,
  flavorKeyOf,
  flavorOf,
  flavorOfItem,
  flavorOfSpell,
  flavorOfScroll,
  everyFlavorLine,
  identityDomain,
  tagsOfRecord,
  flavorOfIdentity,
  flavorTagsOf,
  flavorOfAbility,
  flavorOfSkill,
} from "../../src/browser/flavorText.js";
import { POTIONS, SPELLS, TOOLS, BAG_ITEMS, WEAPONS, ARMORS, JEWELRY, CLOAKS, STAVES, ABILITIES, ABILITY_FLAVOR, FIGHTER_SKILLS, THIEF_SKILLS, SKILL_FLAVOR } from "../../content/index.js";

// Phase 96 (FLAVOR-03): declared re-pin, race (6), sub (24) and class (3) added
// Phase 96 (FLAVOR-04): declared re-pin, ability (21: the 20 catalog names plus the Bard's Sing) and skill (10 passives) added
const COUNTS = { spell: 41, scroll: 1, potion: 10, tool: 4, bag: 3, magic: 23, weapon: 24, armor: 5, race: 6, sub: 24, class: 3, ability: 21, skill: 10 };

test("FLAVOR_DOMAINS: thirteen domains, in order, 175 unique keys", () => {
  assert.deepEqual(
    FLAVOR_DOMAINS.map((d) => d.id),
    ["spell", "scroll", "potion", "tool", "bag", "magic", "weapon", "armor", "race", "sub", "class", "ability", "skill"],
  );
  let total = 0;
  for (const d of FLAVOR_DOMAINS) {
    const keys = d.keys();
    assert.equal(keys.length, COUNTS[d.id], `${d.id} key count`);
    assert.equal(new Set(keys).size, keys.length, `${d.id} keys are unique`);
    assert.ok(keys.every((k) => typeof k === "string" && k), `${d.id} keys are non-empty strings`);
    assert.ok(Object.isFrozen(d), `${d.id} record is frozen`);
    total += keys.length;
  }
  assert.ok(Object.isFrozen(FLAVOR_DOMAINS));
  assert.equal(total, 175);
});

test("skill domain: the keys are exactly the rows with no `active` marker, and no key is an ability twin", () => {
  const d = FLAVOR_DOMAINS.find((x) => x.id === "skill");
  const passives = [...Object.entries(FIGHTER_SKILLS), ...Object.entries(THIEF_SKILLS)].filter(([, r]) => !r.active).map(([n]) => n);
  assert.deepEqual(d.keys(), passives);
  assert.equal(d.keys().length, 10);
  assert.deepEqual(d.keys(), ["Stealth", "Hardiness", "Ambidextrous", "Cooking", "Runes/Signs", "Locks", "Sewing", "Night Vision", "Heft", "Acute Hearing"]);
  const twins = new Set([...Object.entries(FIGHTER_SKILLS), ...Object.entries(THIEF_SKILLS)].filter(([, r]) => r.active).map(([n]) => n));
  assert.ok(twins.size > 0 && d.keys().every((k) => !twins.has(k)), "no key is an active skill's name");
  assert.deepEqual(Object.keys(SKILL_FLAVOR), passives);
  assert.ok(Object.isFrozen(SKILL_FLAVOR));
  assert.equal(d.module, "content/skills.js");
  assert.equal(d.exportName, "SKILL_FLAVOR");
  // an active skill reads "" (its ability line covers it), as does anything unknown; never throws
  for (const k of d.keys()) assert.equal(flavorOfSkill(k), SKILL_FLAVOR[k], k);
  for (const bad of [...twins, "No Such Skill", "__proto__", "", null, undefined, 7, [], hostile()]) assert.equal(flavorOfSkill(bad), "");
});

test("ability domain: the keys are the 20 catalog names in table order plus Sing, and Sing alone has no catalog row", () => {
  const d = FLAVOR_DOMAINS.find((x) => x.id === "ability");
  assert.deepEqual(d.keys(), [...ABILITIES.map((a) => a.name), "Sing"]);
  assert.equal(d.keys().length, 21);
  const catalog = new Set(ABILITIES.map((a) => a.name));
  assert.deepEqual(d.keys().filter((k) => !catalog.has(k)), ["Sing"]);
  assert.equal(d.module, "content/abilities.js");
  assert.equal(d.exportName, "ABILITY_FLAVOR");
  assert.ok(Object.isFrozen(ABILITY_FLAVOR));
  // the lookup reads the map by name, "" for anything it does not hold, and never throws
  for (const k of d.keys()) assert.equal(flavorOfAbility(k), ABILITY_FLAVOR[k], k);
  for (const bad of ["No Such Ability", "__proto__", "", null, undefined, 7, [], hostile()]) assert.equal(flavorOfAbility(bad), "");
});

test("FLAVOR_DOMAINS: keys() returns a fresh array every call", () => {
  for (const d of FLAVOR_DOMAINS) {
    const a = d.keys();
    a.push("mutated");
    assert.notEqual(d.keys().length, a.length, `${d.id} keys() is fresh`);
  }
});

test("flavorKeyOf resolves every item shape to its domain and key", () => {
  const death = POTIONS[8];
  assert.equal(death.n, "Death");
  assert.deepEqual(flavorKeyOf({ kind: "potion", n: "Death potion", txt: "x", eff2: death.eff, uses: 1 }), { domain: "potion", key: "Death" });
  assert.deepEqual(flavorKeyOf({ kind: "potion", n: "Death potion (grey)", txt: "x", eff2: death.eff, uses: 1 }), { domain: "potion", key: "Death" });
  assert.deepEqual(flavorKeyOf({ kind: "jewel", ...JEWELRY[0] }), { domain: "magic", key: JEWELRY[0].n });
  assert.deepEqual(flavorKeyOf({ kind: "cloak", ...CLOAKS[1] }), { domain: "magic", key: CLOAKS[1].n });
  assert.deepEqual(flavorKeyOf({ kind: "staff", ...STAVES[2] }), { domain: "magic", key: STAVES[2].n });
  assert.deepEqual(flavorKeyOf({ kind: "tool", tool: "rope", n: "Rope", txt: "x" }), { domain: "tool", key: "Rope" });
  assert.deepEqual(flavorKeyOf({ kind: "tool", n: "Ladder", txt: "x" }), { domain: "tool", key: "Ladder" });
  assert.deepEqual(flavorKeyOf({ kind: "picks", n: "Lockpicks", txt: "x" }), { domain: "tool", key: "Lockpicks" });
  assert.deepEqual(flavorKeyOf({ kind: "bag", tier: "large", n: "Large bag", txt: "x" }), { domain: "bag", key: "Large bag" });
  assert.deepEqual(flavorKeyOf({ kind: "bag", n: "Medium bag" }), { domain: "bag", key: "Medium bag" });
  assert.deepEqual(flavorKeyOf({ kind: "weapon", n: "Whisper, a long sword", base: "Long Sword", bonus: 2, txt: "x" }), { domain: "weapon", key: "Long Sword" });
  assert.deepEqual(flavorKeyOf({ kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0 }), { domain: "weapon", key: "Dagger" });
  assert.deepEqual(flavorKeyOf({ kind: "armor", n: "Warded plate", armor: "Plate", ar: 18, wp: 60 }), { domain: "armor", key: "Plate" });
  assert.deepEqual(flavorKeyOf({ kind: "armor", n: "Mail", armor: "Mail" }), { domain: "armor", key: "Mail" });
});

test("flavorKeyOf: every content name resolves back to a key of its domain", () => {
  const keysOf = (id) => new Set(FLAVOR_DOMAINS.find((d) => d.id === id).keys());
  for (const [kind, rows] of [["jewel", JEWELRY], ["cloak", CLOAKS], ["staff", STAVES]]) {
    for (const r of rows) assert.ok(keysOf("magic").has(flavorKeyOf({ kind, ...r }).key), r.n);
  }
  for (const p of POTIONS) assert.ok(keysOf("potion").has(flavorKeyOf({ kind: "potion", n: `${p.n} potion`, eff2: p.eff }).key), p.n);
  for (const [tool, t] of Object.entries(TOOLS)) assert.ok(keysOf("tool").has(flavorKeyOf({ kind: "tool", tool, n: t.n }).key), t.n);
  for (const [tier, b] of Object.entries(BAG_ITEMS)) assert.ok(keysOf("bag").has(flavorKeyOf({ kind: "bag", tier, n: b.n }).key), b.n);
  for (const w of Object.keys(WEAPONS)) assert.ok(keysOf("weapon").has(flavorKeyOf({ kind: "weapon", n: w, base: w }).key), w);
  for (const a of ARMORS) assert.ok(keysOf("armor").has(flavorKeyOf({ kind: "armor", n: a.name, armor: a.name }).key), a.name);
  assert.equal(SPELLS.length, keysOf("spell").size);
});

test("flavorKeyOf: null for anything that is not a known item, and it never throws", () => {
  const hostile = new Proxy({}, { get() { throw new Error("boom"); }, has() { throw new Error("boom"); } });
  const cases = [null, undefined, [], ["potion"], "potion", 7, true, {}, { kind: "food", n: "Hardtack" }, { kind: "mystery", n: "X" }, { kind: "potion", eff2: "nope" }, { kind: "jewel" }, { kind: "weapon" }, { kind: "bag" }, hostile];
  cases.forEach((c, i) => assert.equal(flavorKeyOf(c), null, `case ${i}`));
});

test("flavorKeyOf never mutates its argument", () => {
  const it = Object.freeze({ kind: "weapon", n: "Whisper, a long sword", base: "Long Sword", bonus: 1, txt: "d10+2 +1" });
  const before = JSON.stringify(it);
  assert.doesNotThrow(() => flavorKeyOf(it));
  assert.equal(JSON.stringify(it), before);
});

test("lookups return '' for an unknown key, a bad domain and an absent map", () => {
  assert.equal(flavorOf("spell", "No Such Spell"), "");
  assert.equal(flavorOf("nope", "Heal"), "");
  assert.equal(flavorOf("spell", null), "");
  assert.equal(flavorOf("spell", "__proto__"), "");
  assert.equal(flavorOfItem(null), "");
  assert.equal(flavorOfItem({ kind: "food" }), "");
  assert.equal(flavorOfSpell("No Such Spell"), "");
  // While a domain's export is absent every key reads "", and once it lands
  // every key reads the map's own line.
  for (const d of FLAVOR_DOMAINS) {
    const m = d.lines();
    for (const k of d.keys()) {
      if (!m) assert.equal(flavorOf(d.id, k), "", `${d.id}/${k} while absent`);
      else assert.equal(flavorOf(d.id, k), m[k] ?? "", `${d.id}/${k}`);
    }
  }
  const scroll = FLAVOR_DOMAINS.find((d) => d.id === "scroll").lines();
  assert.equal(flavorOfScroll(), scroll ? scroll.Scroll : "");
});

test("everyFlavorLine is frozen and lists [domain, key, line] triples", () => {
  const all = everyFlavorLine();
  assert.ok(Object.isFrozen(all));
  for (const t of all) {
    assert.ok(Object.isFrozen(t));
    assert.equal(t.length, 3);
    assert.ok(FLAVOR_DOMAINS.some((d) => d.id === t[0]));
    assert.equal(typeof t[2], "string");
  }
  const expected = FLAVOR_DOMAINS.reduce((n, d) => n + (d.lines() ? Object.keys(d.lines()).length : 0), 0);
  assert.equal(all.length, expected);
});

// ---------------------------------------------------------------------------
// Phase 96 (FLAVOR-03): identity records, exercised through a local fake export
// so no real domain is needed
// ---------------------------------------------------------------------------

const hostile = () => new Proxy({}, { get() { throw new Error("boom"); }, has() { throw new Error("boom"); }, ownKeys() { throw new Error("boom"); } });

test("identityDomain: lines() is a fresh plain string map built from the records' line", () => {
  const fake = { Elven: { line: "A thin line.", good: ["a"], bad: ["b"] }, Human: { line: "A plain line.", good: [], bad: [], neutral: "human-neutral" } };
  const d = identityDomain({ id: "race", module: "content/flavor.js", exportName: "RACE_FLAVOR", keys: () => Object.keys(fake), read: () => fake });
  assert.ok(Object.isFrozen(d));
  assert.deepEqual(d.lines(), { Elven: "A thin line.", Human: "A plain line." });
  assert.notEqual(d.lines(), d.lines(), "lines() is fresh every call");
  d.lines().Elven = "mutated";
  assert.equal(d.lines().Elven, "A thin line.");
  assert.equal(d.tags(), fake, "tags() hands back the raw record map");
});

test("identityDomain: absent, non-object, array and hostile exports read undefined", () => {
  const proxied = identityDomain({ id: "race", module: "m", exportName: "X", keys: () => [], read: () => hostile() });
  assert.equal(proxied.lines(), undefined, "a throwing map reads undefined, never throws");
  for (const bad of [undefined, null, "x", 7, []]) {
    const d = identityDomain({ id: "race", module: "m", exportName: "X", keys: () => [], read: () => bad });
    assert.equal(d.lines(), undefined);
    assert.equal(d.tags(), undefined);
  }
  const thrower = identityDomain({ id: "race", module: "m", exportName: "X", keys: () => [], read: () => { throw new Error("boom"); } });
  assert.equal(thrower.lines(), undefined);
  assert.equal(thrower.tags(), undefined);
});

test("tagsOfRecord: frozen id arrays; a non-record reads all-empty and never throws", () => {
  const t = tagsOfRecord({ line: "x", good: ["g1", "g2"], bad: ["b1"], neutral: "" });
  assert.deepEqual(t, { good: ["g1", "g2"], bad: ["b1"], neutral: "" });
  assert.ok(Object.isFrozen(t) && Object.isFrozen(t.good) && Object.isFrozen(t.bad));
  assert.equal(tagsOfRecord({ neutral: "human-neutral" }).neutral, "human-neutral");
  const empty = { good: [], bad: [], neutral: "" };
  for (const c of [null, undefined, "x", 7, [], hostile(), { good: "no", bad: 3 }]) assert.deepEqual(tagsOfRecord(c), empty);
  assert.deepEqual(tagsOfRecord({ good: ["a", 7, "", null, "b"] }).good, ["a", "b"]);
  const rec = Object.freeze({ line: "x", good: Object.freeze(["g"]), bad: Object.freeze(["b"]) });
  const before = JSON.stringify(rec);
  tagsOfRecord(rec);
  assert.equal(JSON.stringify(rec), before, "never mutates");
});

test("flavorOfIdentity and flavorTagsOf: unknown kind, unknown key and hostile input read empty", () => {
  const empty = { good: [], bad: [], neutral: "" };
  for (const kind of ["nope", "spell", "", null, undefined, 7, hostile()]) {
    assert.equal(flavorOfIdentity(kind, "Elven"), "");
    assert.deepEqual(flavorTagsOf(kind, "Elven"), empty);
  }
  for (const key of ["No Such Race", "__proto__", "constructor", "", null, undefined, 7, [], hostile()]) {
    assert.equal(flavorOfIdentity("race", key), "");
    assert.deepEqual(flavorTagsOf("race", key), empty);
    assert.equal(flavorOfIdentity("sub", key), "");
    assert.deepEqual(flavorTagsOf("sub", key), empty);
    assert.equal(flavorOfIdentity("class", key), "");
  }
  assert.deepEqual(flavorTagsOf("class", "Fighter"), empty, "a class has no tags");
});

test("flavorTagsOf: the empty result is frozen and not mutable", () => {
  const t = flavorTagsOf("race", "No Such Race");
  assert.ok(Object.isFrozen(t) && Object.isFrozen(t.good) && Object.isFrozen(t.bad));
  assert.throws(() => { "use strict"; t.good.push("x"); }, TypeError);
  assert.deepEqual(flavorTagsOf("race", "No Such Race"), { good: [], bad: [], neutral: "" });
});
