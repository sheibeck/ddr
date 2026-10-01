// test/unit/abilities-catalog.test.js
//
// Phase 38 (ABIL-01/02/03), Plan 01 Task 1 — TDD RED-first pins for:
//   1. The reshaped FIGHTER_SKILLS/THIEF_SKILLS tables: same 12/9 keys, same
//      insertion order, same per-position cost as the pre-phase tables (the
//      chargen shuffle-outcome-by-position pin), each active entry carrying
//      an `active: "<catalog id>"` marker whose catalog counterpart matches
//      byte-for-byte, and the ten kept passives' txt UNCHANGED.
//   2. content/kit.js's FREE_SKILL repointed to the same-position keys.
//   3. content/abilities.js's 20-entry catalog shape + canon txt lines.
//   4. engine/rng.js's hashString/derivedRng.
//   5. rollSkills' draw count is UNCHANGED by the reshape (measured on the
//      pre-phase engine at commit 56d51e3, 2026-09-17, via a scratch
//      countingRng script — see the plan's Task 1 action for the measuring
//      method).
//
// No cross-test-file imports (project convention, per
// test/unit/identity-contract.test.js) — every rng/state helper this file
// needs is defined locally.

import test from "node:test";
import assert from "node:assert/strict";

import { FIGHTER_SKILLS, THIEF_SKILLS } from "../../content/skills.js";
import { FREE_SKILL } from "../../content/kit.js";
import { ABILITIES, ABILITY_BY_ID, ABILITY_POOL, ONCE_A_FIGHT } from "../../content/abilities.js";
import { makeRng, hashString, derivedRng } from "../../engine/rng.js";
import { rollSkills } from "../../engine/character.js";

/** countingRng — copied verbatim from test/unit/chargen-rng-pin.test.js. */
function countingRng(inner) {
  let draws = 0;
  return {
    d(n) { draws++; return inner.d(n); },
    pick(a) { draws++; return inner.pick(a); },
    shuffle(a) { draws += Math.max(0, a.length - 1); return inner.shuffle(a); },
    get draws() { return draws; },
  };
}

// ─── 1. Table position/cost pins ────────────────────────────────────────────

test("FIGHTER_SKILLS: 12 keys, same order, same per-position cost as the pre-phase table", () => {
  const tuples = Object.entries(FIGHTER_SKILLS).map(([k, v]) => [k, v.cost]);
  assert.deepStrictEqual(tuples, [
    ["Kata", 4], ["Stealth", 3], ["Death Touch", 4], ["Sidestep", 5],
    ["Hardiness", 6], ["Ambidextrous", 4], ["Cooking", 3], ["Pommel Strike", 1],
    ["Runes/Signs", 2], ["Battle Roar", 4], ["Second Wind", 2], ["Sweep", 2],
  ]);
});

test("THIEF_SKILLS: 9 keys, same order, same per-position cost as the pre-phase table", () => {
  const tuples = Object.entries(THIEF_SKILLS).map(([k, v]) => [k, v.cost]);
  assert.deepStrictEqual(tuples, [
    ["Feint", 5], ["Locks", 2], ["Sewing", 4], ["Night Vision", 3], ["Heft", 5],
    ["Acute Hearing", 5], ["Dirty Trick", 3], ["Smoke", 4], ["Silent Step", 6],
  ]);
});

test("Locks/Sewing keep their up-tier + txt2; the ten kept passives keep their exact pre-phase txt", () => {
  assert.equal(THIEF_SKILLS["Locks"].up, 1);
  // VOX-05/ROLL-04 (79-05): the lock ranges read roll-high (test/unit/authored-ranges.test.js pins them to the engine).
  // Phase 90 plan 11 (TEXT-01): the lock rows also name the lockpick and intelligence terms and what a failed roll costs.
  assert.equal(THIEF_SKILLS["Locks"].txt2, "4–10 on d10 to open a lock, 3–10 with lockpicks; intelligence 15 and 20 each add one more number; a failed roll loses the chest");
  assert.equal(THIEF_SKILLS["Sewing"].up, 2);
  assert.equal(THIEF_SKILLS["Sewing"].txt2, "once on each fed day's rest, patch hurt armour: d6+3 hp back, 6 times in all");

  const KEPT_TXT = {
    // VOX-05/ROLL-04 (79-05): Stealth and Locks read roll-high.
    "FIGHTER_SKILLS.Stealth": [FIGHTER_SKILLS, "Stealth", "your first landed blow of a fight crits on the top two numbers of your die (19–20 on a d20), and so does a Joiner's own if it has Stealth; never in plate"],
    "FIGHTER_SKILLS.Hardiness": [FIGHTER_SKILLS, "Hardiness", "−3 to every blow, bolt and trap that hurts you (never below 1), and a Joiner with it takes 3 less from each blow; phobias halved"],
    "FIGHTER_SKILLS.Ambidextrous": [FIGHTER_SKILLS, "Ambidextrous", "two swings every time you strike, each rolling to hit and for damage, and a Joiner with it swings twice on a plain strike; it does not stack with Speed"],
    // Phase 43 (CLAR, HP-not-WP ruling): unit word reworded wp -> hp.
    "FIGHTER_SKILLS.Cooking": [FIGHTER_SKILLS, "Cooking", "every beast you kill feeds you: you heal a quarter of its max hp (at least 1) and pocket a ration"],
    // RULES-10 (Phase 75.1, plan 75.1-07): rewritten — canRead is gone, so
    // Runes/Signs is the automatic-read guarantee, not the gate.
    "FIGHTER_SKILLS.Runes/Signs": [FIGHTER_SKILLS, "Runes/Signs", "reads any scroll without fail; without it, a scroll is an intelligence roll that can backfire"],
    "THIEF_SKILLS.Locks": [THIEF_SKILLS, "Locks", "6–10 on d10 to open a lock, 4–10 with lockpicks; intelligence 15 and 20 each add one more number; a failed roll loses the chest"],
    "THIEF_SKILLS.Sewing": [THIEF_SKILLS, "Sewing", "once on each fed day's rest, patch hurt armour: d6 hp back, 4 times in all"],
    "THIEF_SKILLS.Night Vision": [THIEF_SKILLS, "Night Vision", "darkness costs you nothing"],
    "THIEF_SKILLS.Heft": [THIEF_SKILLS, "Heft", "+2 damage, mail armour, half upkeep"],
    // Phase 72 (ROLL-01, finding F2): the dead "3 to hit the unseen" clause
    // (no engine site ever read it) was dropped; "never surprised" is kept.
    // HUD-07 (Phase 78, plan 78-09, user ruling 2026-09-26, option A): the
    // replacement mechanic landed, so the text keeps "never surprised" and
    // states the hearing (engine/derived.js#heardSquares).
    "THIEF_SKILLS.Acute Hearing": [THIEF_SKILLS, "Acute Hearing", "never surprised; hears an encounter up to three squares away, walls or no walls, without learning what it is"],
  };
  for (const [label, [table, key, txt]] of Object.entries(KEPT_TXT)) {
    assert.equal(table[key].txt, txt, `${label}: kept-passive txt must be byte-identical to the pre-phase string`);
    assert.equal(table[key].active, undefined, `${label}: a kept passive must NOT carry an active marker`);
  }
});

test("every active table entry cross-checks against its content/abilities.js catalog counterpart", () => {
  let fighterActives = 0, thiefActives = 0;
  const seenTableIds = new Set();
  for (const [bank, table, cls] of [["FIGHTER_SKILLS", FIGHTER_SKILLS, "Fighter"], ["THIEF_SKILLS", THIEF_SKILLS, "Thief"]]) {
    for (const [key, entry] of Object.entries(table)) {
      if (!entry.active) continue;
      if (cls === "Fighter") fighterActives++; else thiefActives++;
      const cat = ABILITY_BY_ID[entry.active];
      assert.ok(cat, `${bank}.${key}: active id "${entry.active}" must exist in ABILITY_BY_ID`);
      assert.equal(cat.source, "table", `${bank}.${key}: catalog entry must be source:"table"`);
      assert.equal(cat.skillKey, key, `${bank}.${key}: catalog skillKey must equal the table key`);
      assert.equal(cat.cls, cls, `${bank}.${key}: catalog cls must match the table's class`);
      assert.equal(cat.txt, entry.txt, `${bank}.${key}: catalog txt must equal the table entry's txt`);
      seenTableIds.add(entry.active);
    }
  }
  assert.equal(fighterActives, 7, "FIGHTER_SKILLS must carry exactly 7 active entries");
  assert.equal(thiefActives, 4, "THIEF_SKILLS must carry exactly 4 active entries");
  const catalogTableIds = ABILITIES.filter((a) => a.source === "table").map((a) => a.id);
  assert.equal(catalogTableIds.length, 11, "the catalog must carry exactly 11 source:table entries");
  assert.deepStrictEqual(new Set(catalogTableIds), seenTableIds, "every catalog source:table id must appear exactly once across the two tables");
});

// ─── 2. FREE_SKILL same-position repoint ────────────────────────────────────

test("FREE_SKILL is repointed to the keys sitting at the OLD free key's exact position", () => {
  assert.deepStrictEqual(FREE_SKILL, { "Cat Burglar": "Dirty Trick", "Acrobat": "Smoke", "Ninja": "Silent Step" });
  const thiefKeys = Object.keys(THIEF_SKILLS);
  assert.equal(thiefKeys[6], "Dirty Trick", "position 7 (was Climbing) must be Dirty Trick");
  assert.equal(thiefKeys[7], "Smoke", "position 8 (was Leaping) must be Smoke");
  assert.equal(thiefKeys[8], "Silent Step", "position 9 (was Silence) must be Silent Step");
  for (const sub of Object.keys(FREE_SKILL)) {
    assert.ok(THIEF_SKILLS[FREE_SKILL[sub]], `${sub}'s free skill "${FREE_SKILL[sub]}" must be a real THIEF_SKILLS key`);
  }
});

// ─── 3. Catalog shape + canon txt ───────────────────────────────────────────

// Quick 260927-opf (user ruling 2026-09-27): the one-shot strike abilities
// are once per fight, and their text says so (declared re-pin of six rows).
const CATALOG_TXT = {
  // Quick 260928-nrf (user rulings 2026-09-28): Kata and Feint roll to hit
  // with three more faces; Sweep needs two or more foes.
  // Phase 90 plan 11 (TEXT-01, user 2026-09-30): a shift reads "+N to hit" / "foes −N to hit you", a hard cap names its d20 range,
  // and every once-per-fight ability says so (test/unit/spell-skill-text-wording.test.js pins the numbers to the engine).
  kata: "one perfect form: +3 to hit on this strike, and it adds your level in damage; once per fight",
  deathTouch: "call it: one swing, rolled as normal; if it lands it doubles and finishes anything under 15 hp; once per fight",
  // VOX-05/ROLL-04 (79-05): sidestep, battleRoar, overheadBlow and smoke read
  // roll-high in faces; feint and mark name what they add (damage).
  sidestep: "two rounds of not being where the blade is: foes −2 to hit you",
  pommelStrike: "the blunt end, to the temple: a normal strike, and a hit also costs the target its next turn",
  battleRoar: "loud enough to matter: for two rounds foes −2 to hit anyone on your side",
  secondWind: "remember why you came: heal d8 + level; once per fight",
  sweep: "one wide arc: every living foe takes half damage; needs two or more foes",
  brace: "halve the next blow that lands on you",
  riposte: "for one round every foe that misses you eats your weapon damage",
  taunt: "every foe swings at you this round and your armour soaks double",
  overheadBlow: "everything into one swing: double damage, but −2 to hit; once per fight",
  lastStand: "under a quarter hp: three attacks this round; once per fight",
  silentStep: "nobody heard that: your next attack never misses and doubles its damage, any round; once per fight; heavy armour, the dark (without a light), a Guard or a Soldier keep the hit and lose the doubling",
  feint: "look left, stab right: +3 to hit on this strike, and it adds your level in damage; once per fight",
  dirtyTrick: "sand, thumb, elbow: the target is blinded for two rounds, so it hits only on its best roll (20 on a d20) and never lands a critical",
  smoke: "gone: for two rounds foes hit you only on their best roll (20 on a d20; 19–20 if you insulted them), and a flee during it just works; once per fight",
  cutpurse: "lift d10 × level gold off the target mid-fight; it has other problems; once per fight",
  poisonedEdge: "the blade weeps: d4 a round to the target for three rounds",
  hamstring: "cut the tendon: the target's blows do half damage for the rest of the fight; once per fight",
  mark: "study it: every strike on the target adds +2 damage for the rest of the fight; once per fight",
};

test("ABILITIES: 20 unique entries, valid shape/enums, canon txt lines pinned", () => {
  assert.equal(ABILITIES.length, 20);
  assert.equal(new Set(ABILITIES.map((a) => a.id)).size, 20, "every id must be unique");
  assert.deepStrictEqual(Object.keys(CATALOG_TXT).sort(), ABILITIES.map((a) => a.id).sort());
  for (const a of ABILITIES) {
    assert.equal(typeof a.id, "string");
    assert.equal(typeof a.name, "string");
    assert.ok(["Fighter", "Thief"].includes(a.cls), `${a.id}: cls must be Fighter or Thief`);
    assert.ok(["table", "pool"].includes(a.source), `${a.id}: source must be table or pool`);
    if (a.source === "table") assert.equal(typeof a.skillKey, "string", `${a.id}: a table entry must carry skillKey`);
    else assert.equal(a.skillKey, undefined, `${a.id}: a pool entry must NOT carry skillKey`);
    assert.ok(a.cd === "fight" || (Number.isInteger(a.cd) && a.cd > 0), `${a.id}: cd must be a positive integer or "fight"`);
    assert.ok(["foe", "self", "foes"].includes(a.target), `${a.id}: target must be foe/self/foes`);
    assert.ok(["opener", "damage", "defensive"].includes(a.tag), `${a.id}: tag must be opener/damage/defensive`);
    assert.equal(a.txt, CATALOG_TXT[a.id], `${a.id}: txt must equal the canon catalog_spec literal`);
  }
});

test("ABILITY_POOL/ABILITY_BY_ID/ONCE_A_FIGHT shape", () => {
  assert.deepStrictEqual(ABILITY_POOL.Fighter, ["brace", "riposte", "taunt", "overheadBlow", "lastStand"]);
  assert.deepStrictEqual(ABILITY_POOL.Thief, ["cutpurse", "poisonedEdge", "hamstring", "mark"]);
  for (const [cls, ids] of Object.entries(ABILITY_POOL)) {
    for (const id of ids) {
      assert.equal(ABILITY_BY_ID[id]?.source, "pool", `${id}: every ABILITY_POOL id must be source:"pool"`);
      assert.equal(ABILITY_BY_ID[id]?.cls, cls, `${id}: every ABILITY_POOL id's cls must match its pool`);
    }
  }
  for (const a of ABILITIES) assert.equal(ABILITY_BY_ID[a.id], a, `${a.id}: ABILITY_BY_ID must map back to the exact catalog entry`);
  assert.equal(ONCE_A_FIGHT, 999);
  assert.ok(Object.isFrozen(ABILITY_BY_ID));
  assert.ok(Object.isFrozen(ABILITY_POOL));
});

// ─── 4. hashString / derivedRng ─────────────────────────────────────────────

test("hashString: pinned FNV-1a values, always a 32-bit unsigned integer", () => {
  assert.equal(hashString(""), 2166136261);
  assert.equal(hashString("a"), 3826002220);
  const pinned = hashString("1:abilities:1");
  assert.ok(Number.isInteger(pinned) && pinned >= 0 && pinned < 2 ** 32);
  assert.equal(hashString("1:abilities:1"), pinned, "hashString must be a pure function of its input");
});

test("derivedRng: equals makeRng(hashString(joined parts)); two calls agree; never touches an unrelated rng instance", () => {
  const a = derivedRng(1, "abilities", 1);
  const b = makeRng(hashString("1:abilities:1"));
  assert.equal(a.d(6), b.d(6), "derivedRng(...) must equal makeRng(hashString(parts.join(':')))");

  const c = derivedRng(1, "abilities", 1);
  const d = derivedRng(1, "abilities", 1);
  assert.equal(c.d(20), d.d(20), "two derivedRng calls with the same key must produce the same first draw");

  const untouched = makeRng(5);
  const before = untouched.getState();
  derivedRng("joiner", "Bob", 3, "abilities", 2).d(6);
  assert.equal(untouched.getState(), before, "derivedRng must never mutate a separately created makeRng instance");
});

// ─── 5. rollSkills draw count is unchanged by the reshape ───────────────────

test("rollSkills draw count is unchanged: 11 (Fighter), 8 (Thief non-free), 7 (Thief free-skill subs)", () => {
  const measure = (cls, sub) => {
    const rng = countingRng(makeRng(1));
    const c = { cls, sub };
    rollSkills(rng, c);
    return rng.draws;
  };
  assert.equal(measure("Fighter", "Knight"), 11);
  assert.equal(measure("Thief", "Pickpocket"), 8);
  assert.equal(measure("Thief", "Cat Burglar"), 7);
  assert.equal(measure("Thief", "Acrobat"), 7);
  assert.equal(measure("Thief", "Ninja"), 7);
});
