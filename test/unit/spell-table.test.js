// test/unit/spell-table.test.js
//
// Phase 40 (SPELL-01/03/04/05), Plan 01, Task 1 — locks the reshaped
// SPELLS table (Phase 90 plan 06, SPELL-12: Phantom Host and Lesser Summon were
// removed, leaving 31 rows): the 32-entry position/lvl/s/kind quadruple pin (measured
// live from `git show HEAD:content/spells.js` at the commit this plan
// started from, never hand-derived), the two deliberate exceptions (Map the
// Floor's rename, Ice's kind), the data flags (onHit/aoe), and the `niche`/`txt`/NICHE_LABELS contract
// (SPELL-01's "a player can tell two same-level spells solve different
// problems").

import test from "node:test";
import assert from "node:assert/strict";

import { SPELLS, NICHE_LABELS } from "../../content/index.js";

// Measured via `git show HEAD:content/spells.js` (HEAD = b0e93d6, the commit
// this plan started from — clean tree, before content/spells.js was touched)
// — [n, lvl, s, kind] for the pre-Phase-40 rows 0-31, in array order. NOT
// hand-typed.
const PRE_PLAN_QUADRUPLES = [
  ["Heal", 1, "healing", "heal"],
  ["Shield", 1, "protection", "ward"],
  ["Strength", 1, "offense", "might"],
  ["Doze", 1, "offense", "status"],
  ["Freeze", 1, "offense", "thrown"],
  ["Detect Magic", 1, "divination", "reveal"],
  ["Mirror Self", 1, "illusion", "mirror"],
  ["Stun", 1, "offense", "stun"],
  ["Weaken", 1, "offense", "weaken"],
  ["Acid", 2, "offense", "acid"],
  ["Stupidity", 2, "offense", "stupid"],
  ["Blind", 3, "offense", "blind"],
  ["Shrink", 3, "offense", "shrink"],
  ["Ice", 3, "offense", "thrown"],
  ["Earthquake", 4, "offense", "quake"],
  ["Noxious Vapor", 4, "offense", "vapor"],
  ["Fireballs", 4, "offense", "volley"],
  ["Petrify", 5, "offense", "petrify"],
  ["Insane", 2, "offense", "insane"],
  ["Summon", 2, "special", "summon"],
  ["Fireball", 3, "offense", "thrown"],
  ["Major Heal", 3, "healing", "heal"],
  ["Bubble", 3, "protection", "ward"],
  ["Sense Danger", 3, "divination", "foresee"],
  ["Turn Walking Dead", 2, "protection", "turn"],
  ["Plane Gate", 3, "protection", "gate"],
  ["Sense Presence", 2, "protection", "senses"],
  ["Phantom Host", 3, "illusion", "summon"],
  ["Lightning", 4, "offense", "thrown"],
  ["Regeneration", 4, "healing", "regen"],
  ["Mangle", 5, "offense", "thrown"],
  ["Death", 5, "offense", "death"],
];

// Phase 90 plan 06 (SPELL-12): Phantom Host (once row 27) is removed, so the
// rows after it sit one earlier; Lesser Summon (once row 32) is removed.
const PRESENT_QUADRUPLES = PRE_PLAN_QUADRUPLES.filter(([n]) => n !== "Phantom Host");

test("SPELLS: 31 rows, and neither Lesser Summon nor Phantom Host is among them (no row carries lesser or roll)", () => {
  assert.equal(SPELLS.length, 31);
  assert.equal(SPELLS.find((sp) => sp.n === "Lesser Summon"), undefined);
  assert.equal(SPELLS.find((sp) => sp.n === "Phantom Host"), undefined);
  assert.equal(SPELLS[SPELLS.length - 1].n, "Death");
});

test("SPELLS: array position, lvl, s, kind are byte-identical to the pre-Phase-40 table (rows 0-26 in place, the rows after Phantom Host one earlier), with exactly two deliberate exceptions", () => {
  assert.equal(SPELLS.length, PRESENT_QUADRUPLES.length);
  for (let i = 0; i < PRESENT_QUADRUPLES.length; i++) {
    const [n, lvl, s, kind] = PRESENT_QUADRUPLES[i];
    const sp = SPELLS[i];
    assert.equal(sp.lvl, lvl, `row ${i} (${n}): lvl must be byte-identical`);
    assert.equal(sp.s, s, `row ${i} (${n}): s (school) must be byte-identical`);
    if (i === 5) {
      // Map the Floor (SPELL-05 rename) — name changes, kind unchanged.
      assert.equal(sp.n, "Map the Floor");
      assert.equal(sp.kind, kind);
    } else if (i === 13) {
      // Ice (SPELL-01 DOT fix) — kind changes, name unchanged. Phase 90 plan 05
      // (SPELL-12, Q5 A): the DOT is gone; Ice is the area freeze, kind "blast".
      assert.equal(sp.n, n);
      assert.equal(sp.kind, "blast");
    } else {
      assert.equal(sp.n, n, `row ${i}: n must be byte-identical`);
      assert.equal(sp.kind, kind, `row ${i} (${n}): kind must be byte-identical`);
    }
  }
});

test("SPELLS: pre-Phase-40 dmg/pool/rounds/reflect/combatOnly fields deep-equal the old table for rows 0-31", () => {
  // Independently re-derived expectations (not read off SPELLS itself) —
  // every row that carried these fields before this phase.
  const EXPECTED = {
    Heal: { dmg: { n: 1, sides: 10, bonus: 0 }, combatOnly: false },
    Shield: { pool: 50, rounds: 5, combatOnly: false },
    // Phase 90 (SPELL-09): Strength's die moved from `dmg` to its `act.dice` (an extra d10 on every damage roll for 100 squares).
    Strength: { act: { kind: "strength", effect: 100, dice: { n: 1, sides: 10, bonus: 0 } }, combatOnly: false },
    Doze: { combatOnly: true },
    Freeze: { dmg: { n: 1, sides: 6, bonus: 0 }, combatOnly: true },
    "Map the Floor": { combatOnly: false },
    "Mirror Self": { combatOnly: false },
    Stun: { combatOnly: true },
    Weaken: { combatOnly: true },
    Acid: { dmg: { n: 2, sides: 6, bonus: 2 }, combatOnly: true },
    Stupidity: { combatOnly: true },
    Blind: { combatOnly: true },
    Shrink: { combatOnly: true },
    // Phase 90 plan 05 (SPELL-12, Q5 A): Ice's damage die is a d10 (was a d6 per tick).
    Ice: { dmg: { n: 1, sides: 10, bonus: 0 }, combatOnly: true },
    Earthquake: { dmg: { n: 3, sides: 10, bonus: 8 }, combatOnly: true },
    "Noxious Vapor": { combatOnly: true },
    Fireballs: { dmg: { n: 1, sides: 10, bonus: 2 }, combatOnly: true },
    Petrify: { combatOnly: true },
    Insane: { combatOnly: true },
    Summon: { combatOnly: false },
    Fireball: { dmg: { n: 2, sides: 10, bonus: 4 }, combatOnly: true },
    "Major Heal": { dmg: { n: 3, sides: 10, bonus: 0 }, combatOnly: false },
    // RULES-14 (Phase 75, user 2026-09-25): Bubble's pool/rounds/reflect
    // shape is retired (greenfield) — it is now a one-shot mirror with a
    // small pop pool. Re-pinned to the new fields.
    Bubble: { mirror: true, popPool: 25, combatOnly: false },
    "Sense Danger": { combatOnly: false },
    "Turn Walking Dead": { combatOnly: true },
    "Plane Gate": { combatOnly: true },
    "Sense Presence": { combatOnly: false },
    Lightning: { dmg: { n: 1, sides: 10, bonus: 6 }, combatOnly: true },
    Regeneration: { combatOnly: false },
    Mangle: { dmg: { n: 2, sides: 20, bonus: 15 }, combatOnly: true },
    Death: { combatOnly: true },
  };
  for (const [name, fields] of Object.entries(EXPECTED)) {
    const sp = SPELLS.find((s) => s.n === name);
    assert.ok(sp, `${name} must exist`);
    for (const [key, val] of Object.entries(fields)) {
      assert.deepStrictEqual(sp[key], val, `${name}.${key}`);
    }
  }
});

// Phase 90 plan 05 (SPELL-12): Ice, the area version of Freeze, carries Freeze's onHit and Lightning's aoe.
test("SPELLS: exactly the deliberate data flags (onHit on Freeze and Ice, aoe on Lightning and Ice) and no row carries lesser or roll (Phase 90 plan 06 removed Lesser Summon, the one row that did)", () => {
  const freeze = SPELLS.find((sp) => sp.n === "Freeze");
  const lightning = SPELLS.find((sp) => sp.n === "Lightning");
  const ice = SPELLS.find((sp) => sp.n === "Ice");
  assert.equal(freeze.onHit, "freeze");
  assert.equal(lightning.aoe, "all");
  assert.equal(ice.onHit, "freeze");
  assert.equal(ice.aoe, "all");
  for (const sp of SPELLS) {
    if (sp.n === "Freeze" || sp.n === "Ice") continue;
    assert.equal(sp.onHit, undefined, `${sp.n} must not carry onHit`);
  }
  for (const sp of SPELLS) {
    if (sp.n === "Lightning" || sp.n === "Ice") continue;
    assert.equal(sp.aoe, undefined, `${sp.n} must not carry aoe`);
  }
  for (const sp of SPELLS) {
    assert.equal(sp.lesser, undefined, `${sp.n} must not carry lesser`);
    assert.equal(sp.roll, undefined, `${sp.n} must not carry roll`);
  }
});

// Phase 40 (SPELL-05), Plan 04: Map the Floor's reveal window — the data
// field the engine actually reads (engine/magic.js's reveal branch ->
// startEffect's `squares` option), and that no other row carries it.
// Plan 76-06 (user ruling 2026-09-26): the window is ONE square (it was 40),
// so the first step ends it — Map the Floor lasts only until you move.
test("SPELLS[5] (Map the Floor): squares === 1, and no other row carries a squares field", () => {
  assert.equal(SPELLS[5].n, "Map the Floor");
  assert.equal(SPELLS[5].squares, 1);
  for (const sp of SPELLS) {
    if (sp.n === "Map the Floor") continue;
    assert.equal(sp.squares, undefined, `${sp.n} must not carry squares`);
  }
});

test("SPELLS: every row carries a niche key present in NICHE_LABELS, and txt starts with the niche's label", () => {
  for (const sp of SPELLS) {
    assert.equal(typeof sp.niche, "string", `${sp.n}: niche must be a string`);
    assert.equal(typeof NICHE_LABELS[sp.niche], "string", `${sp.n}: niche "${sp.niche}" must be a NICHE_LABELS key`);
    assert.ok(
      sp.txt.startsWith(NICHE_LABELS[sp.niche] + " · "),
      `${sp.n}: txt "${sp.txt}" must start with "${NICHE_LABELS[sp.niche]} · "`,
    );
  }
});

test("NICHE_LABELS: frozen, exactly the 11 documented keys", () => {
  assert.equal(Object.isFrozen(NICHE_LABELS), true);
  const keys = Object.keys(NICHE_LABELS).sort();
  assert.deepStrictEqual(keys, [
    "answer", "buff", "burst", "chaos", "control", "defensive",
    "dot", "healing", "multi", "sight", "summon",
  ]);
});

test("SPELL-01: at every offense-school level with >= 2 spells, at least 2 distinct niches are represented", () => {
  const offense = SPELLS.filter((sp) => sp.s === "offense");
  const byLevel = {};
  for (const sp of offense) {
    (byLevel[sp.lvl] ||= []).push(sp);
  }
  for (const [lvl, group] of Object.entries(byLevel)) {
    if (group.length < 2) continue;
    const niches = new Set(group.map((sp) => sp.niche));
    assert.ok(
      niches.size >= 2,
      `offense level ${lvl}: only one niche (${[...niches]}) across ${group.length} spells`,
    );
  }
});

test("no row's txt contains the substring \" wp\" (HP not WP in player copy)", () => {
  for (const sp of SPELLS) {
    assert.doesNotMatch(sp.txt, / wp\b/i, `${sp.n}: txt must not say "wp"`);
  }
});

test("content-purity: every SPELLS row is plain JSON (no function leaves)", () => {
  for (const sp of SPELLS) {
    for (const [key, val] of Object.entries(sp)) {
      assert.notEqual(typeof val, "function", `${sp.n}.${key} must not be a function`);
    }
  }
});
