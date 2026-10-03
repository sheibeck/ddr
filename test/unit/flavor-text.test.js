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
} from "../../src/browser/flavorText.js";
import { POTIONS, SPELLS, TOOLS, BAG_ITEMS, WEAPONS, ARMORS, JEWELRY, CLOAKS, STAVES } from "../../content/index.js";

const COUNTS = { spell: 41, scroll: 1, potion: 10, tool: 4, bag: 3, magic: 23, weapon: 24, armor: 5 };

test("FLAVOR_DOMAINS: eight domains, in order, 111 unique keys", () => {
  assert.deepEqual(
    FLAVOR_DOMAINS.map((d) => d.id),
    ["spell", "scroll", "potion", "tool", "bag", "magic", "weapon", "armor"],
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
  assert.equal(total, 111);
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
