// test/unit/item-stat-lines.test.js
//
// Phase 71 (POLISH-06, D-04) — itemStatLines(item, c), wornItemFor(c, slot)
// and ITEM_STAT_COPY (src/browser/viewModels.js): the ONE stat formatter
// the store stock rows and the Gear tab's action sheet both render from, so
// the two surfaces can never drift. Items are built the way the store and
// loot build them (engine/economy.js#openStore's line shapes, and
// engine/items.js's own rollBlade/rollMailPiece/rollJewel/rollCloak/
// rollStaff/toolItem/bagItemFor under a fixed makeRng seed).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { newRun, applyAction } from "../../engine/engine.js";
import { rollBlade, rollMailPiece, rollJewel, rollCloak, rollStaff, toolItem, bagItemFor } from "../../engine/items.js";
import { WEAPONS, ARMORS, BAGS, POTIONS } from "../../content/index.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { itemStatLines, wornItemFor, ITEM_STAT_COPY, usableBy } from "../../src/browser/viewModels.js";

// ─── fixtures ────────────────────────────────────────────────────────────

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter",
    race: "Human",
    sub: null,
    level: 3,
    weapon: "Axe",
    prof: 0,
    magicWpn: 0,
    armor: "Mail",
    ar: 12,
    armorMin: 3,
    armorWP: 30,
    armorMax: 30,
    patches: 0,
    gold: 250,
    items: [],
    worn: {},
    skills: {},
    timers: {},
    wp: 10,
    maxWP: 10,
    ...overrides,
  };
}

/** economy.js#openStore's weaponLine item shape. */
const shopWeapon = (w) => ({ kind: "weapon", n: w, base: w, bonus: 0, txt: WEAPONS[w].lab });
/** economy.js#openStore's armorLine item shape. */
function shopArmor(name) {
  const a = ARMORS.find((x) => x.name === name);
  return { kind: "armor", n: a.name, armor: a.name, ar: a.ar, wp: a.wp, min: a.min, cls: a.cls, txt: `AR ${a.ar}` };
}
const texts = (lines) => lines.map((l) => l.text);

const rng = makeRng(3);
const PREMIUM_BLADE = rollBlade(rng, 3, true);
const PREMIUM_MAIL = rollMailPiece(rng);
const JEWEL = rollJewel(rng);
const CLOAK = rollCloak(rng);
const STAFF = rollStaff(rng);
const TORCH = toolItem("torch");
const BAG = bagItemFor("medium");
const POTION = { kind: "potion", n: `${POTIONS[3].n} potion`, txt: POTIONS[3].txt, eff2: POTIONS[3].eff, uses: 1 };
const PICKS = { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" };

// ─── per kind ────────────────────────────────────────────────────────────

test("weapon: the damage label from WEAPONS[base].lab, then usable-by — no '+0' on a bonus-0 blade", () => {
  const c = fixedChar();
  const it = shopWeapon("Long Sword");
  const lines = itemStatLines(it, c);
  assert.deepStrictEqual(lines.map((l) => l.key), ["damage", "usable"]);
  assert.equal(lines[0].text, WEAPONS["Long Sword"].lab);
  assert.equal(lines[1].text, usableBy(it, c));
  for (const l of lines) assert.doesNotMatch(l.text, /\+0\b/);
});

test("weapon: an unrestricted weapon carries no usable-by entry", () => {
  const c = fixedChar();
  const it = shopWeapon("Dagger");
  assert.equal(usableBy(it, c), "");
  assert.deepStrictEqual(itemStatLines(it, c).map((l) => l.key), ["damage"]);
});

test("weapon: an enchanted blade reads '<lab> +N' then the enchanted mark (the store's premium line)", () => {
  const c = fixedChar();
  assert.ok(PREMIUM_BLADE.bonus > 0);
  const lines = itemStatLines(PREMIUM_BLADE, c);
  assert.equal(lines[0].key, "damage");
  assert.equal(lines[0].text, `${WEAPONS[PREMIUM_BLADE.base].lab} +${PREMIUM_BLADE.bonus}`);
  assert.equal(lines[1].key, "enchanted");
  assert.equal(lines[1].text, ITEM_STAT_COPY.text.enchanted);
});

test("armour: 'AR n', then 'left/wp hp' (a fresh drop reads left = wp), then usable-by", () => {
  const c = fixedChar();
  const it = shopArmor("Plate");
  const lines = itemStatLines(it, c);
  assert.deepStrictEqual(lines.map((l) => l.key), ["ar", "wear", "usable"]);
  assert.equal(lines[0].text, `AR ${it.ar}`);
  assert.equal(lines[1].text, `${it.wp}/${it.wp} hp`);
  assert.equal(lines[2].text, usableBy(it, c));
});

test("armour: a worn-down piece reads its own left; exactly 0 left reads destroyed", () => {
  const c = fixedChar();
  const it = { ...shopArmor("Mail"), left: 7 };
  assert.equal(itemStatLines(it, c).find((l) => l.key === "wear").text, `7/${it.wp} hp`);
  const dead = { ...shopArmor("Mail"), left: 0 };
  assert.equal(itemStatLines(dead, c).find((l) => l.key === "wear").text, ITEM_STAT_COPY.text.destroyed);
});

test("armour: a warded (premium) piece carries the enchanted mark after its durability", () => {
  const c = fixedChar();
  const lines = itemStatLines(PREMIUM_MAIL, c);
  const keys = lines.map((l) => l.key);
  assert.deepStrictEqual(keys.slice(0, 3), ["ar", "wear", "enchanted"]);
  assert.equal(lines[0].text, `AR ${PREMIUM_MAIL.ar}`);
});

test("staff: its effect text, then its charges, then usable-by (Magic Users)", () => {
  const c = fixedChar({ cls: "Magic User" });
  const lines = itemStatLines(STAFF, c);
  assert.deepStrictEqual(lines.map((l) => l.key), ["effect", "charges", "usable"]);
  assert.equal(lines[0].text, STAFF.txt);
  assert.match(lines[1].text, /^\d+\/\d+ charges$/);
  assert.equal(lines[2].text, usableBy(STAFF, c));
  const spent = { ...STAFF, charges: 0 };
  assert.match(itemStatLines(spent, c)[1].text, /^0\/\d+ charges$/);
});

test("cloak, jewel, potion, tool, lockpicks: the item's own effect text, and nothing else", () => {
  const c = fixedChar();
  for (const it of [CLOAK, JEWEL, POTION, TORCH, PICKS]) {
    const lines = itemStatLines(it, c);
    assert.deepStrictEqual(texts(lines), [it.txt], `${it.kind} ${it.n}`);
    assert.equal(lines[0].key, "effect");
  }
});

test("bag: its slot count from BAGS[tier]", () => {
  const lines = itemStatLines(BAG, fixedChar());
  assert.deepStrictEqual(lines.map((l) => l.key), ["slots"]);
  assert.equal(lines[0].text, `${BAGS.medium.slots} slots`);
});

test("every entry is { key, label, value, text } with label from ITEM_STAT_COPY.label", () => {
  const c = fixedChar({ cls: "Magic User" });
  const labels = new Set(Object.values(ITEM_STAT_COPY.label));
  for (const it of [shopWeapon("Long Sword"), PREMIUM_BLADE, shopArmor("Plate"), PREMIUM_MAIL, STAFF, CLOAK, JEWEL, POTION, TORCH, PICKS, BAG]) {
    for (const l of itemStatLines(it, c)) {
      assert.deepStrictEqual(Object.keys(l).sort(), ["key", "label", "text", "value"]);
      assert.ok(labels.has(l.label), `label "${l.label}" must come from ITEM_STAT_COPY.label`);
      assert.equal(typeof l.text, "string");
      assert.ok(l.text.length > 0);
      assert.ok(!l.text.includes(" · "), `a stat text never carries the row separator: "${l.text}"`);
    }
  }
});

// ─── edges ───────────────────────────────────────────────────────────────

test("edge: null, a non-object, an unknown kind with no txt, a weapon with an unknown base, a field-less armour — all [] and never throw", () => {
  const c = fixedChar();
  for (const it of [null, undefined, 7, "Dagger", {}, { kind: "gear", n: "pad" }, { kind: "weapon", base: "Spork", n: "Spork" }, { kind: "armor", n: "Rags" }, { kind: "bag", tier: "bottomless" }]) {
    assert.doesNotThrow(() => itemStatLines(it, c));
    assert.deepStrictEqual(itemStatLines(it, c), [], JSON.stringify(it));
  }
});

test("edge: works without a hero (c = null) and with a sparse hero", () => {
  assert.doesNotThrow(() => itemStatLines(shopArmor("Plate")));
  assert.equal(itemStatLines(shopArmor("Plate")).at(-1).text, usableBy(shopArmor("Plate")));
  assert.doesNotThrow(() => itemStatLines(shopWeapon("Long Sword"), { weapon: "Fists" }));
});

test("purity: two calls deep-equal, order is stable, the result is frozen, item and c never mutate", () => {
  const c = fixedChar({ cls: "Magic User" });
  for (const it of [PREMIUM_BLADE, PREMIUM_MAIL, STAFF, JEWEL, BAG]) {
    const itBefore = structuredClone(it);
    const cBefore = structuredClone(c);
    const a = itemStatLines(it, c);
    const b = itemStatLines(it, c);
    assert.deepStrictEqual(a, b);
    assert.ok(Object.isFrozen(a));
    for (const l of a) assert.ok(Object.isFrozen(l));
    assert.deepStrictEqual(it, itBefore);
    assert.deepStrictEqual(c, cBefore);
  }
});

// ─── wornItemFor ─────────────────────────────────────────────────────────

test("wornItemFor: weapon/armor adapters carry the engine's worn fields; worn slots return c.worn[slot]; empty slots return null", () => {
  const c = fixedChar({ weapon: "Long Sword", magicWpn: 2, worn: { cloak: CLOAK } });
  const w = wornItemFor(c, "weapon");
  assert.equal(w.kind, "weapon");
  assert.equal(w.base, "Long Sword");
  assert.equal(w.bonus, 2);
  const a = wornItemFor(c, "armor");
  assert.equal(a.kind, "armor");
  assert.equal(a.armor, "Mail");
  assert.equal(a.ar, 12);
  assert.equal(a.wp, 30);
  assert.equal(a.left, 30);
  assert.equal(wornItemFor(c, "cloak"), CLOAK);
  assert.equal(wornItemFor(c, "jewelry1"), null);

  const bare = fixedChar({ weapon: "Fists", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0 });
  assert.equal(wornItemFor(bare, "weapon"), null);
  assert.equal(wornItemFor(bare, "armor"), null);
  assert.equal(wornItemFor(bare, "nonsense"), null);
  assert.equal(wornItemFor(null, "weapon"), null);
  assert.deepStrictEqual(itemStatLines(wornItemFor(bare, "armor"), bare), []);
});

test("wornItemFor: equipping an item never changes its stat list — weapon, premium blade, armour, premium mail, cloak, jewel", () => {
  const cases = [
    [shopWeapon("Long Sword"), "weapon"],
    [PREMIUM_BLADE, "weapon"],
    [shopArmor("Plate"), "armor"],
    [PREMIUM_MAIL, "armor"],
    [CLOAK, "cloak"],
    [JEWEL, "jewelry1"],
  ];
  for (const [it, slot] of cases) {
    const base = newRun(11);
    const state = structuredClone(base);
    state.c.cls = "Fighter";
    state.c.sub = null;
    state.c.race = "Human";
    state.c.worn = {};
    state.c.items = [structuredClone(it)];
    const bagLines = itemStatLines(state.c.items[0], state.c);
    // Equip through the engine's own action, then read the worn slot.
    const run = { type: "equipItem", i: 0 };
    if (slot === "cloak" || slot === "jewelry1") run.slot = slot;
    const { state: after } = applyEquip(state, run);
    const wornLines = itemStatLines(wornItemFor(after.c, slot), after.c);
    assert.deepStrictEqual(texts(wornLines), texts(bagLines), `${it.n} (${slot})`);
  }
});

// A tiny local wrapper so the test reads as "equip through the engine".
function applyEquip(state, action) {
  const s = structuredClone(state);
  applyAction(s, action);
  return { state: s };
}

// ─── ITEM_STAT_COPY: frozen, no WP, family-friendly ──────────────────────

function leaves(obj, at = "") {
  if (typeof obj === "string") return [[at, obj]];
  return Object.entries(obj).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k));
}

test("ITEM_STAT_COPY: frozen, every nested group frozen, every leaf a string", () => {
  const walk = (o) => {
    assert.ok(Object.isFrozen(o));
    for (const v of Object.values(o)) {
      if (typeof v === "string") continue;
      assert.ok(v && typeof v === "object");
      walk(v);
    }
  };
  walk(ITEM_STAT_COPY);
});

test("Voice: every ITEM_STAT_COPY leaf clears the family-friendly safety wordlist and never says wp/WP", () => {
  const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [at, value] of leaves(ITEM_STAT_COPY)) {
    for (const term of BANNED) {
      const m = value.match(new RegExp("\\b" + escapeRegExp(term) + "\\b", "i"));
      assert.ok(!m || ALLOW.has(m[0].toLowerCase()), `ITEM_STAT_COPY.${at} contains banned term "${m && m[0]}"`);
    }
    assert.doesNotMatch(value, /\bwp\b/i, `ITEM_STAT_COPY.${at} must not say wp/WP`);
  }
});
