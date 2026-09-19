// test/unit/usableBy.test.js
//
// Phase 43 (CLAR-02): pins for src/browser/viewModels.js#usableBy/USABLE_COPY
// — the ONE "(usable by …)" rule for the FIND card / LOOT screen (via
// lootCompare.usable) / store rows. Legality is the engine's own
// weaponRefusalReason/armorRefusalReason and the staff Magic-User gate —
// never restated here; only the display text is local.

import test from "node:test";
import assert from "node:assert/strict";

import { usableBy, USABLE_COPY } from "../../src/browser/viewModels.js";
import { BANNED } from "../../content/safety-wordlist.js";

function collectStringLeaves(obj, pathLabel = "") {
  const leaves = [];
  if (typeof obj === "string") {
    leaves.push([pathLabel, obj]);
    return leaves;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) leaves.push(...collectStringLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
  }
  return leaves;
}

function hero(overrides = {}) {
  return { cls: "Fighter", sub: "Soldier", race: "Human", skills: {}, weapon: "Broadsword", armor: "Leather", ar: 6, ...overrides };
}

const thief = () => hero({ cls: "Thief", sub: "Pilfer", weapon: "Dagger" });
const thiefWithHeft = () => hero({ cls: "Thief", sub: "Pilfer", weapon: "Dagger", skills: { Heft: 1 } });
const acrobatThief = () => hero({ cls: "Thief", sub: "Acrobat", weapon: "Dagger" });
const magicUser = () => hero({ cls: "Magic User", sub: "Wizard", weapon: "Dagger", armor: "Cloth", ar: 3 });
const fridgianFighter = () => hero({ race: "Fridgian", armor: "Nothing", ar: 0 });
const woodsman = () => hero({ sub: "Woodsman" });

// ─── USABLE_COPY — frozen shape pin ─────────────────────────────────────────

test("USABLE_COPY carries the exact frozen literal shape", () => {
  assert.deepEqual(USABLE_COPY, {
    F: "Fighters",
    T: "Thieves",
    M: "Magic Users",
    usable: "(usable by {who})",
    notYou: "(usable by {who} — not you)",
    heft: "(usable by {who} — and a Thief with Heft)",
  });
  assert.ok(Object.isFrozen(USABLE_COPY));
});

test("USABLE_COPY: every string leaf clears the family-friendly safety wordlist", () => {
  const bannedRe = BANNED.map((term) => new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const [leafPath, value] of collectStringLeaves(USABLE_COPY)) {
    for (const re of bannedRe) {
      assert.doesNotMatch(value, re, `USABLE_COPY.${leafPath} -> "${value}" matches banned term ${re}`);
    }
  }
});

// ─── no hero — "who can use it" only ────────────────────────────────────────

test("usableBy(no hero): F-only weapon (Bardiche)", () => {
  assert.equal(usableBy({ kind: "weapon", base: "Bardiche" }), "(usable by Fighters)");
});

test("usableBy(no hero): FT weapon (Katana)", () => {
  assert.equal(usableBy({ kind: "weapon", base: "Katana" }), "(usable by Fighters, Thieves)");
});

test("usableBy(no hero): FTM weapon (Axe) is unrestricted", () => {
  assert.equal(usableBy({ kind: "weapon", base: "Axe" }), "");
});

test("usableBy(no hero): F-only armor (Mail)", () => {
  assert.equal(usableBy({ kind: "armor", armor: "Mail", cls: "F", ar: 12 }), "(usable by Fighters)");
});

test("usableBy(no hero): FTM armor is unrestricted", () => {
  assert.equal(usableBy({ kind: "armor", cls: "FTM" }), "");
});

test("usableBy(no hero): a staff is Magic Users only", () => {
  assert.equal(usableBy({ kind: "staff", n: "Rowan Staff" }), "(usable by Magic Users)");
});

test("usableBy(no hero): unrestricted/other kinds all read empty", () => {
  for (const it of [{ kind: "cloak" }, { kind: "jewel" }, { kind: "potion" }, { kind: "tool" }, { kind: "bag" }, null, {}]) {
    assert.equal(usableBy(it), "", JSON.stringify(it));
  }
});

test("usableBy(no hero): an unknown weapon base reads empty (not a WEAPONS row)", () => {
  assert.equal(usableBy({ kind: "weapon", base: "Not A Real Weapon" }), "");
});

// ─── with a hero — legality via the engine's own refusal reasons ───────────

test("usableBy: a Thief offered a Bardiche reads '— not you' (wrongClass)", () => {
  assert.equal(usableBy({ kind: "weapon", base: "Bardiche" }, thief()), "(usable by Fighters — not you)");
});

test("usableBy: a Fighter offered a Katana reads legal (no '— not you')", () => {
  assert.equal(usableBy({ kind: "weapon", base: "Katana" }, hero()), "(usable by Fighters, Thieves)");
});

test("usableBy: an Acrobat offered a Long Sword reads '— not you' (acrobat dagger-only)", () => {
  assert.equal(usableBy({ kind: "weapon", base: "Long Sword" }, acrobatThief()), "(usable by Fighters, Thieves — not you)");
});

test("usableBy: a Thief with Heft offered Mail reads the Heft clause", () => {
  const mail = { kind: "armor", armor: "Mail", cls: "F", ar: 12, wp: 30, min: 3 };
  assert.equal(usableBy(mail, thiefWithHeft()), "(usable by Fighters — and a Thief with Heft)");
});

test("usableBy: a Thief without Heft offered Mail reads '— not you'", () => {
  const mail = { kind: "armor", armor: "Mail", cls: "F", ar: 12, wp: 30, min: 3 };
  assert.equal(usableBy(mail, thief()), "(usable by Fighters — not you)");
});

test("usableBy: a Fighter offered a Rowan Staff reads '— not you'", () => {
  assert.equal(usableBy({ kind: "staff", n: "Rowan Staff" }, hero()), "(usable by Magic Users — not you)");
});

test("usableBy: a Magic User offered a Rowan Staff reads legal", () => {
  assert.equal(usableBy({ kind: "staff", n: "Rowan Staff" }, magicUser()), "(usable by Magic Users)");
});

test("usableBy: a Fridgian (noArmor) offered Leather reads '— not you'", () => {
  const leather = { kind: "armor", armor: "Leather", cls: "FT", ar: 6, wp: 15, min: 1 };
  assert.equal(usableBy(leather, fridgianFighter()), "(usable by Fighters, Thieves — not you)");
});

test("usableBy: a Woodsman offered Plate reads '— not you'", () => {
  const plate = { kind: "armor", armor: "Plate", cls: "F", ar: 15, wp: 45, min: 4 };
  assert.equal(usableBy(plate, woodsman()), "(usable by Fighters — not you)");
});

test("usableBy: an unrestricted Axe reads '' for anyone, even an Acrobat who cannot wield it", () => {
  assert.equal(usableBy({ kind: "weapon", base: "Axe" }, acrobatThief()), "");
});

// ─── purity ─────────────────────────────────────────────────────────────────

test("usableBy: pure — never mutates the item or the hero, never throws on a sparse item", () => {
  const it = { kind: "weapon", base: "Bardiche" };
  const c = thief();
  const itBefore = JSON.stringify(it);
  const cBefore = JSON.stringify(c);
  assert.doesNotThrow(() => usableBy(it, c));
  assert.equal(JSON.stringify(it), itBefore);
  assert.equal(JSON.stringify(c), cBefore);
  assert.doesNotThrow(() => usableBy({}, {}));
  assert.doesNotThrow(() => usableBy(null, null));
});
