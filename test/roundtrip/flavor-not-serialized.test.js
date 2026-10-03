// test/roundtrip/flavor-not-serialized.test.js
//
// Phase 95 (FLAVOR-05; CONTEXT 'Data shape and guards'): the standing guard
// that flavour is never a serialized field. A flavour line is looked up by
// name at draw time (src/browser/flavorText.js); the treasure and bag rows are
// spread onto rolled items, so a flavour key on a row would leak into every
// save. A failure here means a flavour key leaked onto an item.
//
// Builds items with the REAL engine builders (rollJewel/rollCloak/rollStaff,
// toolItem, bagItemFor, rollBlade, rollMailPiece, the store and found potion
// shapes), proves each resolves through flavorKeyOf to a key of its domain,
// then serializes a run holding them and checks no "flavor" substring appears
// and the items rehydrate deep-equal.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { serializeRun, rehydrate } from "../../engine/saveState.js";
import { rollJewel, rollCloak, rollStaff, rollBlade, rollMailPiece, toolItem, bagItemFor } from "../../engine/items.js";
import { JEWELRY, CLOAKS, STAVES, TOOL_ORDER, POTIONS, WEAPONS, ARMORS, BAG_ITEMS } from "../../content/index.js";
import { FLAVOR_DOMAINS, flavorKeyOf } from "../../src/browser/flavorText.js";

const domainKeys = (id) => new Set(FLAVOR_DOMAINS.find((d) => d.id === id).keys());

/** Roll with seeds 1.. until every name in `names` was seen (bounded). */
function rollUntilAll(roller, names) {
  const seen = new Map();
  const out = [];
  for (let seed = 1; seed <= 4000 && seen.size < names.length; seed++) {
    const it = roller(makeRng(seed));
    if (!seen.has(it.n)) {
      seen.set(it.n, true);
      out.push(it);
    }
  }
  assert.equal(seen.size, names.length, "every name rolled within the seed bound");
  return out;
}

function buildAllItems() {
  const items = [];
  items.push(...rollUntilAll((r) => rollJewel(r), JEWELRY.map((j) => j.n)));
  items.push(...rollUntilAll((r) => rollCloak(r), CLOAKS.map((j) => j.n)));
  items.push(...rollUntilAll((r) => rollStaff(r), STAVES.map((j) => j.n)));
  for (const key of TOOL_ORDER) items.push(toolItem(key));
  items.push({ kind: "picks", n: "Lockpicks", txt: "6–10 on d10 against any lock" });
  for (const tier of Object.keys(BAG_ITEMS)) items.push(bagItemFor(tier));
  for (const p of POTIONS) {
    // store shape (engine/economy.js#potionLine) and found shape (engine/encounters.js#findMisc)
    items.push({ kind: "potion", n: `${p.n} potion`, txt: p.txt, eff2: p.eff, uses: 1 });
    items.push({ kind: "potion", n: `${p.n} potion (${p.col.toLowerCase()})`, txt: p.txt, eff2: p.eff, uses: 1 });
  }
  // plain blades and premium blades from the real roller, plus one store-shaped weapon per type
  for (let seed = 1; seed <= 60; seed++) {
    items.push(rollBlade(makeRng(seed), 3, true));
    items.push(rollBlade(makeRng(seed), 3, false));
  }
  for (const w of Object.keys(WEAPONS)) items.push({ kind: "weapon", n: w, base: w, bonus: 0, txt: WEAPONS[w].lab });
  // warded armour from the real roller, plus one store-shaped armour per row
  for (let seed = 1; seed <= 60; seed++) items.push(rollMailPiece(makeRng(seed)));
  for (const a of ARMORS) items.push({ kind: "armor", n: a.name, armor: a.name, ar: a.ar, wp: a.wp, min: a.min, cls: a.cls, txt: `AR ${a.ar}` });
  return items;
}

test("every item shape the engine builds resolves to a key of its domain", () => {
  const items = buildAllItems();
  const covered = { potion: new Set(), tool: new Set(), bag: new Set(), magic: new Set(), weapon: new Set(), armor: new Set() };
  for (const it of items) {
    const k = flavorKeyOf(it);
    assert.ok(k, `resolves: ${JSON.stringify(it)}`);
    assert.ok(domainKeys(k.domain).has(k.key), `${k.domain} has key ${k.key} (item ${it.n})`);
    covered[k.domain].add(k.key);
  }
  // the union of keys per item domain is the domain's full key set
  for (const [id, set] of Object.entries(covered)) {
    assert.deepEqual([...set].sort(), [...domainKeys(id)].sort(), `${id} fully covered by engine item shapes`);
  }
  // a premium blade is named like "Whisper, a long sword" and resolves by base
  const premium = items.find((i) => i.kind === "weapon" && i.bonus > 0);
  assert.ok(premium && premium.n !== premium.base);
  assert.equal(flavorKeyOf(premium).key, premium.base);
  // a warded armour resolves by its armor type
  const warded = items.find((i) => i.kind === "armor" && /^Warded /.test(i.n));
  assert.ok(warded);
  assert.equal(flavorKeyOf(warded).key, warded.armor);
});

test("flavorKeyOf leaves every built item untouched (no field is added)", () => {
  for (const it of buildAllItems()) {
    const before = JSON.stringify(it);
    flavorKeyOf(it);
    assert.equal(JSON.stringify(it), before);
    assert.ok(!Object.keys(it).some((k) => /flavor/i.test(k)), `no flavour key on ${it.n}`);
  }
});

test("a serialized run holding every item shape has no flavor field and rehydrates deep-equal", () => {
  const state = newRun(20260403);
  const items = buildAllItems();
  // a serialization test, not a stow test: assign past the bag cap directly
  state.c.items = items;
  const json = JSON.stringify(serializeRun(state));
  assert.ok(!json.includes("flavor"), "no flavor in the serialized run");
  assert.ok(!/FLAVOR/.test(json), "no FLAVOR in the serialized run");
  const back = rehydrate(JSON.parse(json));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(back.c.items)), JSON.parse(JSON.stringify(items)));
  assert.ok(!JSON.stringify(back).includes("flavor"), "no flavor after rehydrate");
});
