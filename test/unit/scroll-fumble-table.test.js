// test/unit/scroll-fumble-table.test.js
//
// Phase 75.1 (RULES-10), Plan 02, Task 1 — pins content/scroll-fumbles.js:
// exact-name coverage of every SPELLS row, a row-by-row deep-equal against
// the plan's own table (hand-written here, not derived from the content
// module under test), the closed FUMBLE_SIDES/FUMBLE_EFFECTS lists, kind
// consistency (helpful side <-> helpful-shaped spell kind; area side <->
// quake/volley/aoe-all spell), the shape of every `rounds`/`kind`/`how`/
// `then`/`once` extra, and the "no fumble kills outright" / "turn-loss capped
// at d4" severity rulings (2026-09-25).

import test from "node:test";
import assert from "node:assert/strict";

import { SPELLS, SCROLL_FUMBLE, FUMBLE_SIDES, FUMBLE_EFFECTS } from "../../content/index.js";

const D4 = { n: 1, sides: 4, bonus: 0 };
const D4_PLUS_1 = { n: 1, sides: 4, bonus: 1 };
const D6 = { n: 1, sides: 6, bonus: 0 };

// The plan's table (75.1-02-PLAN.md "The fumble table (decided here)"),
// hand-typed here — deliberately independent of content/scroll-fumbles.js's
// own source so a copy/paste bug in the content file cannot also infect the
// test's expectation.
const EXPECTED = {
  "Heal": { side: "helpful", effect: "heal" },
  "Shield": { side: "helpful", effect: "ward" },
  "Strength": { side: "helpful", effect: "might" },
  "Doze": { side: "harmful", effect: "out", kind: "asleep", rounds: D4 },
  "Freeze": { side: "harmful", effect: "heavy", how: "frozen" },
  "Map the Floor": { side: "helpful", effect: "wasted" },
  "Mirror Self": { side: "helpful", effect: "mirror", rounds: D6 },
  "Stun": { side: "harmful", effect: "out", kind: "asleep", rounds: D4 },
  "Weaken": { side: "harmful", effect: "weakened", rounds: D4_PLUS_1 },
  "Acid": { side: "harmful", effect: "dot", rounds: D6 },
  "Stupidity": { side: "harmful", effect: "out", kind: "stupefied", rounds: D4 },
  "Blind": { side: "harmful", effect: "blind" },
  "Shrink": { side: "harmful", effect: "shrink" },
  "Ice": { side: "harmful", effect: "dot", rounds: D4_PLUS_1, then: "heavy" },
  "Earthquake": { side: "area", effect: "damage", once: true },
  "Noxious Vapor": { side: "harmful", effect: "vapor", rounds: D4 },
  "Fireballs": { side: "area", effect: "volley" },
  "Petrify": { side: "harmful", effect: "heavy", how: "stone" },
  "Insane": { side: "harmful", effect: "out", kind: "maddened", rounds: D4 },
  "Summon": { side: "helpful", effect: "summon" },
  "Fireball": { side: "harmful", effect: "damage" },
  "Major Heal": { side: "helpful", effect: "heal" },
  "Bubble": { side: "helpful", effect: "ward" },
  "Sense Danger": { side: "helpful", effect: "wasted" },
  "Turn Walking Dead": { side: "harmful", effect: "none" },
  "Plane Gate": { side: "harmful", effect: "none" },
  "Sense Presence": { side: "helpful", effect: "senses" },
  "Phantom Host": { side: "helpful", effect: "summon" },
  "Lightning": { side: "area", effect: "damage" },
  "Regeneration": { side: "helpful", effect: "regen" },
  "Mangle": { side: "harmful", effect: "damage" },
  "Death": { side: "harmful", effect: "heavy", how: "death" },
  "Lesser Summon": { side: "helpful", effect: "summon" },
};

// Kinds whose castSpell branch benefits the CASTER (content/spells.js's own
// header comment, "combatOnly: false ... unconditional ... c.* fields", plus
// summon's no-combat pendingAlly branch) -> the spell's fumble side must be
// "helpful". Every other kind must NOT be helpful.
const HELPFUL_KINDS = new Set([
  "heal", "ward", "might", "mirror", "senses", "reveal", "foresee", "regen", "summon",
]);

/**
 * The exact-name coverage check under test: every SPELLS row (by its exact
 * `n` string) has exactly one SCROLL_FUMBLE entry, and the table has no key
 * that is not a spell name. Exercised directly against the real content
 * (below) and again against a doctored SPELLS-shaped list (further down) to
 * prove it actually fails on a mismatch instead of vacuously passing.
 */
function coverageHolds(spellNames, table) {
  const spellSet = new Set(spellNames);
  const tableKeys = Object.keys(table);
  if (tableKeys.length !== spellSet.size) return false;
  for (const name of spellNames) {
    if (!(name in table)) return false;
  }
  for (const key of tableKeys) {
    if (!spellSet.has(key)) return false;
  }
  return true;
}

test("SCROLL_FUMBLE: exact-name coverage of all 33 SPELLS rows", () => {
  assert.equal(SPELLS.length, 33);
  assert.equal(Object.keys(SCROLL_FUMBLE).length, 33);
  assert.ok(coverageHolds(SPELLS.map((sp) => sp.n), SCROLL_FUMBLE));
});

test("SCROLL_FUMBLE: coverage check fails on a renamed spell (encoding edge)", () => {
  const doctoredNames = SPELLS.map((sp) => sp.n);
  doctoredNames[0] = "Healing Touch"; // renamed away from "Heal"
  assert.equal(coverageHolds(doctoredNames, SCROLL_FUMBLE), false);
});

test("SCROLL_FUMBLE: coverage check fails on an added spell not in the table", () => {
  const doctoredNames = [...SPELLS.map((sp) => sp.n), "Brand New Spell"];
  assert.equal(coverageHolds(doctoredNames, SCROLL_FUMBLE), false);
});

test("SCROLL_FUMBLE: deep-equals the plan's table, row by row", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(SCROLL_FUMBLE[name], expected, `row mismatch for "${name}"`);
  }
  // No extra rows beyond the plan's 33.
  assert.deepEqual(new Set(Object.keys(SCROLL_FUMBLE)), new Set(Object.keys(EXPECTED)));
});

test("FUMBLE_SIDES: exactly harmful, area, helpful", () => {
  assert.deepEqual([...FUMBLE_SIDES], ["harmful", "area", "helpful"]);
});

test("FUMBLE_EFFECTS: closed effect lists per side, no killing effect anywhere", () => {
  assert.deepEqual([...FUMBLE_EFFECTS.harmful], [
    "damage", "dot", "heavy", "out", "blind", "shrink", "weakened", "vapor", "none",
  ]);
  assert.deepEqual([...FUMBLE_EFFECTS.area], ["damage", "volley"]);
  assert.deepEqual([...FUMBLE_EFFECTS.helpful], [
    "heal", "regen", "ward", "might", "mirror", "senses", "summon", "wasted",
  ]);
});

test("SCROLL_FUMBLE: every row's effect is in its side's closed list", () => {
  for (const [name, row] of Object.entries(SCROLL_FUMBLE)) {
    assert.ok(FUMBLE_SIDES.includes(row.side), `"${name}" has an unknown side "${row.side}"`);
    assert.ok(
      FUMBLE_EFFECTS[row.side].includes(row.effect),
      `"${name}"'s effect "${row.effect}" is not in the ${row.side} list`
    );
  }
});

test("SCROLL_FUMBLE: kind consistency — helpful side matches helpful-shaped spell kinds", () => {
  for (const sp of SPELLS) {
    const row = SCROLL_FUMBLE[sp.n];
    const shouldBeHelpful = HELPFUL_KINDS.has(sp.kind);
    if (shouldBeHelpful) {
      assert.equal(row.side, "helpful", `"${sp.n}" (kind "${sp.kind}") should be helpful`);
    } else {
      assert.notEqual(row.side, "helpful", `"${sp.n}" (kind "${sp.kind}") should not be helpful`);
    }
  }
});

test("SCROLL_FUMBLE: area rows are exactly the quake, volley and aoe-all rows", () => {
  const expectedAreaNames = new Set(
    SPELLS.filter((sp) => sp.kind === "quake" || sp.kind === "volley" || sp.aoe === "all").map((sp) => sp.n)
  );
  const actualAreaNames = new Set(
    Object.entries(SCROLL_FUMBLE)
      .filter(([, row]) => row.side === "area")
      .map(([name]) => name)
  );
  assert.deepEqual(actualAreaNames, expectedAreaNames);
});

test("SCROLL_FUMBLE: no effect list contains a killing effect", () => {
  const KILLING_EFFECTS = ["kill", "death", "frozen", "petrified", "instantDeath"];
  for (const list of Object.values(FUMBLE_EFFECTS)) {
    for (const effect of list) {
      assert.ok(!KILLING_EFFECTS.includes(effect), `"${effect}" reads as a killing effect`);
    }
  }
  // Heavy replaces every former instant kill; confirm exactly the three
  // rows the user's ruling named.
  const heavyNames = new Set(
    Object.entries(SCROLL_FUMBLE)
      .filter(([, row]) => row.effect === "heavy")
      .map(([name]) => name)
  );
  assert.deepEqual(heavyNames, new Set(["Freeze", "Petrify", "Death"]));
});

test("SCROLL_FUMBLE: out rows are exactly Doze, Stun, Stupidity and Insane, each rounds d4", () => {
  const outNames = new Set(
    Object.entries(SCROLL_FUMBLE)
      .filter(([, row]) => row.effect === "out")
      .map(([name]) => name)
  );
  assert.deepEqual(outNames, new Set(["Doze", "Stun", "Stupidity", "Insane"]));
  for (const name of outNames) {
    assert.deepEqual(SCROLL_FUMBLE[name].rounds, D4);
  }
  // Noxious Vapor is not an out row (its effect is "vapor"), but its
  // sleeping face is also capped at d4 per the same ruling.
  assert.equal(SCROLL_FUMBLE["Noxious Vapor"].effect, "vapor");
  assert.deepEqual(SCROLL_FUMBLE["Noxious Vapor"].rounds, D4);
});

test("SCROLL_FUMBLE: Blind is the only blind row, Shrink the only shrink row, neither loses turns", () => {
  const blindNames = Object.entries(SCROLL_FUMBLE)
    .filter(([, row]) => row.effect === "blind")
    .map(([name]) => name);
  const shrinkNames = Object.entries(SCROLL_FUMBLE)
    .filter(([, row]) => row.effect === "shrink")
    .map(([name]) => name);
  assert.deepEqual(blindNames, ["Blind"]);
  assert.deepEqual(shrinkNames, ["Shrink"]);
  assert.equal("rounds" in SCROLL_FUMBLE["Blind"], false);
  assert.equal("kind" in SCROLL_FUMBLE["Blind"], false);
  assert.equal("rounds" in SCROLL_FUMBLE["Shrink"], false);
  assert.equal("kind" in SCROLL_FUMBLE["Shrink"], false);
});

test("SCROLL_FUMBLE: every rounds value is integer dice notation, never a string", () => {
  for (const [name, row] of Object.entries(SCROLL_FUMBLE)) {
    if (!("rounds" in row)) continue;
    assert.equal(typeof row.rounds, "object", `"${name}"'s rounds is not an object`);
    assert.ok(Number.isInteger(row.rounds.n), `"${name}"'s rounds.n is not an integer`);
    assert.ok(Number.isInteger(row.rounds.sides), `"${name}"'s rounds.sides is not an integer`);
    assert.ok(Number.isInteger(row.rounds.bonus), `"${name}"'s rounds.bonus is not an integer`);
  }
});

test("SCROLL_FUMBLE: how/kind/then/once extras appear only where the plan places them", () => {
  const howNames = new Set(
    Object.entries(SCROLL_FUMBLE).filter(([, row]) => "how" in row).map(([name]) => name)
  );
  assert.deepEqual(howNames, new Set(["Freeze", "Petrify", "Death"]));

  const kindNames = new Set(
    Object.entries(SCROLL_FUMBLE).filter(([, row]) => "kind" in row).map(([name]) => name)
  );
  assert.deepEqual(kindNames, new Set(["Doze", "Stun", "Stupidity", "Insane"]));

  const thenNames = Object.entries(SCROLL_FUMBLE).filter(([, row]) => "then" in row).map(([name]) => name);
  assert.deepEqual(thenNames, ["Ice"]);
  assert.equal(SCROLL_FUMBLE["Ice"].then, "heavy");

  const onceNames = Object.entries(SCROLL_FUMBLE).filter(([, row]) => "once" in row).map(([name]) => name);
  assert.deepEqual(onceNames, ["Earthquake"]);
  assert.equal(SCROLL_FUMBLE["Earthquake"].once, true);
});

test("SCROLL_FUMBLE and FUMBLE_SIDES/FUMBLE_EFFECTS are frozen (immutable content data)", () => {
  assert.ok(Object.isFrozen(SCROLL_FUMBLE));
  assert.ok(Object.isFrozen(FUMBLE_SIDES));
  assert.ok(Object.isFrozen(FUMBLE_EFFECTS));
  assert.ok(Object.isFrozen(FUMBLE_EFFECTS.harmful));
  for (const row of Object.values(SCROLL_FUMBLE)) {
    assert.ok(Object.isFrozen(row));
  }
});
