// test/unit/item-text-refresh.test.js
//
// Phase 89 plan 09 (TEXT-01): the tolerant-load text refresh. A saved item
// carries its own `txt`, so a save made before the Phase 89 rewording would
// keep the old words on the Gear tab, the store, and the loot and find cards.
// engine/derived.js#canonItemText names an item's CURRENT content text, and
// engine/saveState.js#refreshItemTexts (run at the end of both load chains,
// validateSave and rehydrate) puts it on every item the save holds. Words only:
// no other field moves, no rng, and a second pass changes nothing.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { serializeRun, validateSave, rehydrate, refreshItemTexts } from "../../engine/saveState.js";
import { canonItemText } from "../../engine/derived.js";
import { toolItem } from "../../engine/items.js";
import { POTIONS, CLOAKS, JEWELRY, STAVES, TOOLS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const row = (table, n) => table.find((r) => r.n === n);
const potionRow = (n) => POTIONS.find((p) => p.n === n);
const OLD = "the words before Phase 89";
const clone = (v) => JSON.parse(JSON.stringify(v));

/** A potion item as the store sells it ("X potion") and as a find offers it ("X potion (colour)"). */
const storePotion = (n, txt = OLD) => ({ kind: "potion", n: `${n} potion`, txt, eff2: potionRow(n).eff, uses: 1 });
const foundPotion = (n, txt = OLD) => ({ kind: "potion", n: `${n} potion (${potionRow(n).col.toLowerCase()})`, txt, eff2: potionRow(n).eff, uses: 1 });
const jewel = (n, txt = OLD) => ({ kind: "jewel", ...row(JEWELRY, n), txt });
const cloak = (n, txt = OLD) => ({ kind: "cloak", ...row(CLOAKS, n), txt });
const staff = (n, txt = OLD) => ({ kind: "staff", charges: 1, ...row(STAVES, n), txt });

// ─── canonItemText ──────────────────────────────────────────────────────────

test("canonItemText: a potion (store or find name) returns its POTIONS row text by eff2", () => {
  for (const p of POTIONS) {
    assert.equal(canonItemText(storePotion(p.n)), p.txt, `${p.n} (store)`);
    assert.equal(canonItemText(foundPotion(p.n)), p.txt, `${p.n} (found)`);
  }
});

test("canonItemText: a jewel, a cloak and a staff return their row text by name", () => {
  for (const r of JEWELRY) assert.equal(canonItemText(jewel(r.n)), r.txt, r.n);
  for (const r of CLOAKS) assert.equal(canonItemText(cloak(r.n)), r.txt, r.n);
  for (const r of STAVES) assert.equal(canonItemText(staff(r.n)), r.txt, r.n);
});

test("canonItemText: a tool returns its TOOLS text, by its key or its name", () => {
  for (const [key, t] of Object.entries(TOOLS)) {
    assert.equal(canonItemText(toolItem(key)), t.txt, key);
    assert.equal(canonItemText({ kind: "tool", n: t.n, txt: OLD }), t.txt, `${key} by name`);
  }
});

test("canonItemText: a weapon, armour, bag, lockpicks, scroll or unknown item returns null; hostile values never throw", () => {
  const nulls = [
    { kind: "weapon", n: "Club", base: "Club", txt: "d6" },
    { kind: "armor", n: "Cloth", armor: "Cloth", ar: 3, txt: "AR 3" },
    { kind: "bag", tier: "medium", n: "Medium bag", txt: "6 slots" },
    { kind: "picks", n: "Lockpicks", txt: "6–10 on d10" },
    { kind: "jewel", n: "Ring of Nothing", txt: OLD },
    { kind: "potion", n: "Mystery potion", eff2: "nope", txt: OLD },
    { kind: "tool", tool: "__proto__", n: "Nothing", txt: OLD },
    { kind: "tool", tool: "constructor", txt: OLD },
    { n: "Ring of Power" },
    {},
    null,
    undefined,
    "Ring of Power",
    42,
    [],
    { kind: "cloak", n: { toString: 1 } },
    { kind: "potion" },
  ];
  for (const it of nulls) assert.equal(canonItemText(it), null, JSON.stringify(it));
});

test("canonItemText never mutates the item", () => {
  const it = jewel("Anklet of Invisibility");
  const copy = clone(it);
  canonItemText(it);
  assert.deepEqual(it, copy);
});

// ─── the load refresh ───────────────────────────────────────────────────────

/** A real run carrying one old-text item in every place a save holds them. */
function oldSaveState() {
  const state = newRun(3);
  const c = state.c;
  c.items = [storePotion("Enlarge"), { kind: "weapon", n: "Club", base: "Club", bonus: 0, txt: "d6" }, { kind: "mystery", n: "Odd Thing", txt: "kept as it was" }];
  c.worn = { jewelry1: jewel("Anklet of Invisibility"), cloak: cloak("Cloak of Invisibility") };
  c.timers = {};
  c.weapon = "Crystal Staff";
  c.staff = staff("Crystal Staff");
  state.party = [
    {
      cls: "Thief", sub: "Burglar", race: "Human", level: 1, sp: 0, maxWP: 30, wp: 30, skills: {},
      weapon: "Club", prof: 0, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      name: "Joiny", items: [foundPotion("Speed")], worn: { cloak: cloak("Cloak of Speed") },
    },
  ];
  state.pendingFind = foundPotion("Invisible");
  state.pendingLoot = [jewel("Helm of Knowledge"), staff("Walnut Staff")];
  state.store = {
    haggle: 1,
    race: c.race,
    stock: [
      { n: "Enlarge potion", sub: OLD, cost: 150, effectId: "givePotion", effectParams: { item: storePotion("Enlarge") }, sold: false },
      { n: "Torch", sub: "a torch line", cost: 25, effectId: "givePotion", effectParams: { item: { ...toolItem("torch"), txt: OLD } }, sold: false },
      { n: "Club", sub: "d6", cost: 25, effectId: "buyWeapon", effectParams: { item: { kind: "weapon", n: "Club", base: "Club", bonus: 0, txt: "d6" } }, sold: false },
    ],
  };
  return state;
}

function assertRefreshed(state, label) {
  const c = state.c;
  assert.equal(c.items[0].txt, potionRow("Enlarge").txt, `${label}: a bagged Enlarge potion`);
  assert.equal(c.worn.jewelry1.txt, row(JEWELRY, "Anklet of Invisibility").txt, `${label}: a worn Anklet`);
  assert.equal(c.worn.cloak.txt, row(CLOAKS, "Cloak of Invisibility").txt, `${label}: a worn cloak`);
  assert.equal(c.staff.txt, row(STAVES, "Crystal Staff").txt, `${label}: the wielded staff`);
  assert.equal(state.party[0].worn.cloak.txt, row(CLOAKS, "Cloak of Speed").txt, `${label}: a Joiner's worn cloak`);
  assert.equal(state.party[0].items[0].txt, potionRow("Speed").txt, `${label}: a Joiner's potion`);
  assert.equal(state.pendingFind.txt, potionRow("Invisible").txt, `${label}: the pending find`);
  assert.equal(state.pendingLoot[0].txt, row(JEWELRY, "Helm of Knowledge").txt, `${label}: a loot-pile jewel`);
  assert.equal(state.pendingLoot[1].txt, row(STAVES, "Walnut Staff").txt, `${label}: a loot-pile staff`);
  const [potionLine, torchLine, clubLine] = state.store.stock;
  assert.equal(potionLine.effectParams.item.txt, potionRow("Enlarge").txt, `${label}: the store potion's item text`);
  assert.equal(potionLine.sub, potionRow("Enlarge").txt, `${label}: the store potion's sub`);
  assert.equal(torchLine.effectParams.item.txt, TOOLS.torch.txt, `${label}: the store torch's item text`);
  assert.equal(torchLine.sub, "a torch line", `${label}: a non-potion line's sub is its own`);
  assert.equal(clubLine.effectParams.item.txt, "d6", `${label}: a weapon line is untouched`);
  assert.equal(c.items[1].txt, "d6", `${label}: a weapon keeps its text`);
  assert.equal(c.items[2].txt, "kept as it was", `${label}: an item with no content row keeps its text`);
}

test("validateSave refreshes every saved item's text: bag, worn, wielded staff, a Joiner's, the find, the loot pile and the store", () => {
  const before = oldSaveState();
  const r = validateSave(JSON.stringify(serializeRun(before)));
  assert.ok(r.ok, r.reason);
  assertRefreshed(r.value, "validateSave");
});

test("rehydrate refreshes the same items (the second load chain, run on a raw serialised state)", () => {
  const raw = clone(serializeRun(oldSaveState()));
  assertRefreshed(rehydrate(raw), "rehydrate");
});

test("the full relaunch (validateSave then rehydrate) reads the current words and is idempotent", () => {
  const loaded = validateSave(JSON.stringify(serializeRun(oldSaveState())));
  assert.ok(loaded.ok, loaded.reason);
  const once = rehydrate(clone(loaded.value));
  assertRefreshed(once, "relaunch");
  const again = rehydrate(clone(once));
  assert.deepEqual(again, once, "a second load changes nothing");
  const twice = clone(once);
  refreshItemTexts(twice);
  assert.deepEqual(twice, once, "a second refresh changes nothing");
});

test("the refresh changes words only: no other field moves, and the rng cursor is untouched", () => {
  const raw = clone(serializeRun(oldSaveState()));
  const loaded = rehydrate(clone(raw));
  // Compare against a load of the same save whose item texts are already current.
  const current = oldSaveState();
  const fresh = (it) => {
    const t = canonItemText(it);
    if (typeof t === "string") it.txt = t;
  };
  current.c.items.forEach(fresh);
  Object.values(current.c.worn).forEach(fresh);
  fresh(current.c.staff);
  current.party.forEach((m) => {
    m.items.forEach(fresh);
    Object.values(m.worn).forEach(fresh);
  });
  fresh(current.pendingFind);
  current.pendingLoot.forEach(fresh);
  for (const line of current.store.stock) {
    fresh(line.effectParams.item);
    if (line.effectParams.item.kind === "potion") line.sub = line.effectParams.item.txt;
  }
  const loadedCurrent = rehydrate(clone(serializeRun(current)));
  assert.deepEqual(loaded, loadedCurrent, "an old save loads to exactly what a save with current words loads to");
  assert.equal(loaded.rngState, raw.rngState);
});

test("refreshItemTexts tolerates a sparse or hostile state without throwing", () => {
  for (const s of [null, undefined, 42, "x", [], {}, { c: null, party: "x", store: { stock: "x" }, pendingLoot: "x" }, { c: { items: [null, 3, "x", []], worn: [] }, party: [null, 4], store: { stock: [null, { effectParams: { item: 3 } }] } }]) {
    assert.doesNotThrow(() => refreshItemTexts(s));
  }
  assert.equal(refreshItemTexts(null), null);
});
