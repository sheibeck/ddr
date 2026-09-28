// test/unit/spell-resist.test.js
//
// Quick 260927-rsx (user ruling 2026-09-27): "Every spell cast on an enemy
// should have a chance to be resisted based on their intelligence. High
// intelligence is more chance to resist ... I want the resist rolls noted in
// the Oracle, too." A resisted damage spell has no effect; scale half-intel.
//
// Pins:
//   - the odds: faces = max(1, round(intel / 2)) on a d20, roll-high, for
//     intel 1, 2, 3, 6, 10 and 16 (5/5/10/15/25/40%), every foe rolling (no
//     intel-12 gate);
//   - a resisted Fireball does nothing (no throw, no damage), the turn and
//     the charge spent; its failing twin throws;
//   - a multi-target spell with mixed resists (Lightning per foe; Weaken per
//     foe, the resisting foe skipped by the landed Weaken; all resist, no
//     Weaken);
//   - every caster path: the hero, a Joiner (allyCast), a scroll (the free
//     cast) and an item activation (the Birch Staff, the Pine Staff);
//   - both sides share one resist (quick 260928-hrs, user ruling 2026-09-28):
//     the hero resisting a foe's spell or ability rolls the same resistRoll
//     on the same resistFaces scale, no intel-12 gate (this reverses
//     260927-rsx's "the hero side is unchanged canon" pin);
//   - (the Oracle and rail lines, the foe card and the spell rows live in
//     test/unit/spell-resist-copy.test.js).
//
// Determinism idiom (75.3-04's control-resist tests): a forced resist / land
// outcome is found by searching state.acts against the REAL
// engine/derived.js#foeSpellResistCheck off the fake rng's fixed cursor
// (getState -> 0), never a mocked stream.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { castSpell, readScroll } from "../../engine/magic.js";
import { useItem } from "../../engine/items.js";
import { alliesTurn } from "../../engine/combat.js";
import {
  resistFaces,
  foeSpellResistCheck,
  foeWeakened,
  resistRoll,
  spellTargetsFoe,
  SPELL_SELF_KINDS,
} from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const PAD = (n, v = 10) => new Array(n).fill(v);

/** fakeRng(seq) — `.d()` pops the next value; throws on underflow. The
 * cursor (`getState`) is a FIXED 0 so a forced resist outcome never depends
 * on how many main draws came first; `count()` is the number of main draws
 * taken. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
    getState: () => 0,
    count: () => i,
  };
}

function fixedFloor(depth) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth };
}

function hero(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 5, sp: 0,
    maxWP: 60, wp: 60, skills: {}, vp: 0, intel: 10,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 4, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    ...overrides,
  };
}

function foe(name, overrides = {}) {
  return { name, type: "Beasts", lvl: 1, size: "S", intel: 10, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function fightState({ depth = 1, c = {}, foes = [foe("F1")], acts = 0, party } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts,
    c: hero(c),
    floor: fixedFloor(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    ...(party ? { party } : {}),
    combat: { foes, type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false },
  };
}

/** findActs(source, wants, intels, caster) — the first state.acts whose REAL
 * foeSpellResistCheck gives every `[idx, resisted]` in `wants` off cursor 0,
 * round 1, with foe idx's intel from `intels` (default 10), for `caster`
 * ("you" for the hero or an item, a Joiner's name for a Joiner). */
function findActs(source, wants, intels = {}, caster = "you") {
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    const ok = wants.every(([idx, resisted]) => {
      const r = foeSpellResistCheck({ acts, combat: { round: 1 } }, probe, source, idx, intels[idx] ?? 10, caster);
      return r.resisted === resisted;
    });
    if (ok) return acts;
  }
  throw new Error(`findActs: nothing for ${source} ${JSON.stringify(wants)}`);
}

// ---------------------------------------------------------------------------
// The odds.
// ---------------------------------------------------------------------------

test("resistFaces: half-intel faces on a d20 — intel 1, 2, 3, 6, 10, 16, 18, 20 resist on 1, 1, 2, 3, 5, 8, 9, 10 faces (5/5/10/15/25/40/45/50%)", () => {
  const table = { 1: [1, 5], 2: [1, 5], 3: [2, 10], 6: [3, 15], 10: [5, 25], 16: [8, 40], 18: [9, 45], 20: [10, 50] };
  for (const [intel, [faces, pct]] of Object.entries(table)) {
    assert.equal(resistFaces(Number(intel)), faces, `intel ${intel}`);
    // Exhaustive d20: count the raw faces that resist through the real roll.
    let wins = 0;
    for (let raw = 1; raw <= 20; raw++) if (resistRoll(fakeRng([raw]), Number(intel)).resisted) wins++;
    assert.equal(wins, faces, `intel ${intel} winning faces`);
    assert.equal((wins / 20) * 100, pct, `intel ${intel} percent`);
  }
  // A missing or odd intel still gets the floor of one face.
  assert.equal(resistFaces(undefined), 1);
  assert.equal(resistFaces(0), 1);
});

test("resistRoll: every resistor rolls (no intel-12 gate) — one roll-high d20, resisted on roll >= 21 - faces", () => {
  const rng = fakeRng([1]);
  const r = resistRoll(rng, 1);
  assert.deepEqual(r, { rolled: true, resisted: true, roll: 20, atLeast: 20, dieN: 20, faces: 1 });
  assert.throws(() => rng.d(20), /exhausted/, "exactly one draw");
  assert.equal(resistRoll(fakeRng([2]), 1).resisted, false);
  const sixteen = resistRoll(fakeRng([8]), 16); // roll 13 vs 13–20
  assert.equal(sixteen.atLeast, 13);
  assert.equal(sixteen.resisted, true);
  assert.equal(resistRoll(fakeRng([9]), 16).resisted, false);
});

test("foeSpellResistCheck draws from a derived stream: the caller's rng is never touched", () => {
  const rng = fakeRng([]);
  const r = foeSpellResistCheck({ acts: 3, combat: { round: 2 } }, rng, "Fireball", 0, 10);
  assert.equal(rng.count(), 0);
  assert.equal(r.dieN, 20);
  assert.equal(r.atLeast, 16);
  // Deterministic: the same key gives the same roll.
  assert.deepEqual(foeSpellResistCheck({ acts: 3, combat: { round: 2 } }, rng, "Fireball", 0, 10), r);
});

test("the caster is part of the resist key: a Joiner casting the hero's spell in the same round rolls its own resist", () => {
  const probe = { getState: () => 0 };
  let differ = 0;
  for (let acts = 0; acts < 200; acts++) {
    const you = foeSpellResistCheck({ acts, combat: { round: 1 } }, probe, "Freeze", 0, 10, "you");
    const ada = foeSpellResistCheck({ acts, combat: { round: 1 } }, probe, "Freeze", 0, 10, "Ada");
    if (you.roll !== ada.roll) differ++;
  }
  assert.ok(differ > 150, `the two casters' rolls are independent (${differ}/200 differ)`);
});

test("spellTargetsFoe: only the self and ally kinds are never resisted", () => {
  assert.deepEqual([...SPELL_SELF_KINDS].sort(), ["foresee", "heal", "might", "mirror", "regen", "reveal", "senses", "summon", "ward"]);
  for (const sp of SPELLS) assert.equal(spellTargetsFoe(sp), !SPELL_SELF_KINDS.has(sp.kind), sp.n);
  assert.equal(spellTargetsFoe(SPELLS[IDX.Fireball]), true, "thrown damage is resistible now");
  assert.equal(spellTargetsFoe(SPELLS[IDX.Heal]), false);
});

// ---------------------------------------------------------------------------
// The hero's cast.
// ---------------------------------------------------------------------------

test("a resisted Fireball does nothing: no throw, no damage; the charge and the turn are spent", () => {
  const acts = findActs("Fireball", [[0, true]]);
  const s = fightState({ acts, c: { grimoire: ["Fireball"] } });
  const rng = fakeRng(PAD(20));
  const events = castSpell(s, IDX.Fireball, rng, []);
  const res = events.find((e) => e.type === "spellResisted");
  assert.ok(res, "spellResisted pushed");
  assert.equal(res.target, "F1");
  assert.equal(res.spell, "Fireball");
  assert.equal(res.intel, 10);
  assert.equal(res.faces, 5);
  assert.equal(res.atLeast, 16);
  assert.equal(res.dieN, 20);
  assert.ok(res.roll >= 16);
  assert.equal(events.some((e) => e.type === "spellThrown" || e.type === "spellHit" || e.type === "resistFailed"), false);
  assert.equal(s.combat.foes[0].wp, 30, "no effect");
  assert.equal(s.c.spellsUsed, 1, "the charge is spent");
  assert.ok(events.some((e) => e.type === "foeMissed" || e.type === "foeStruck"), "the foe's turn ran");
});

test("a Fireball the target fails to resist: resistFailed (with the roll), then the throw", () => {
  const acts = findActs("Fireball", [[0, false]]);
  const s = fightState({ acts, c: { grimoire: ["Fireball"] } });
  const events = castSpell(s, IDX.Fireball, fakeRng(PAD(20)), []);
  const types = events.map((e) => e.type);
  const i = types.indexOf("resistFailed");
  assert.ok(i >= 0);
  assert.ok(types.indexOf("spellThrown") > i);
  const rf = events[i];
  assert.equal(rf.spell, "Fireball");
  assert.ok(rf.roll < rf.atLeast);
});

test("an intel-1 foe still rolls against a spell (the old intel-12 gate is gone for spells cast on foes)", () => {
  const s = fightState({ foes: [foe("F1", { intel: 1 })], c: { grimoire: ["Doze"] } });
  const events = castSpell(s, IDX.Doze, fakeRng(PAD(20)), []);
  const r = events.find((e) => e.type === "spellResisted" || e.type === "resistFailed");
  assert.ok(r, "a roll was made");
  assert.equal(r.intel, 1);
  assert.equal(r.atLeast, 20);
});

test("Lightning with mixed resists: each foe rolls its own; only the one that failed is thrown at", () => {
  const acts = findActs("Lightning", [[0, true], [1, false], [2, true]]);
  const s = fightState({ acts, foes: [foe("F1"), foe("F2"), foe("F3")], c: { grimoire: ["Lightning"] } });
  const events = castSpell(s, IDX.Lightning, fakeRng(PAD(40)), []);
  assert.deepEqual(events.filter((e) => e.type === "spellResisted").map((e) => e.target), ["F1", "F3"]);
  assert.deepEqual(events.filter((e) => e.type === "resistFailed").map((e) => e.target), ["F2"]);
  assert.deepEqual(events.filter((e) => e.type === "spellThrown").map((e) => e.target), ["F2"]);
  assert.equal(s.combat.foes[0].wp, 30);
  assert.equal(s.combat.foes[2].wp, 30);
});

test("Weaken with mixed resists: the landed Weaken skips the foe that resisted it", () => {
  const acts = findActs("Weaken", [[0, true], [1, false]]);
  const s = fightState({ acts, foes: [foe("F1"), foe("F2")], c: { grimoire: ["Weaken"] } });
  const events = castSpell(s, IDX.Weaken, fakeRng(PAD(40)), []);
  const C = s.combat;
  assert.equal(C.weakened, true);
  assert.equal(C.foes[0].weakenResisted, true);
  assert.equal("weakenResisted" in C.foes[1], false);
  assert.equal(foeWeakened(C, C.foes[0]), false);
  assert.equal(foeWeakened(C, C.foes[1]), true);
  const w = events.find((e) => e.type === "weakened");
  assert.equal(w.spared, 1);
});

test("Weaken that every foe resists lands nothing: no weaken, no timer", () => {
  const acts = findActs("Weaken", [[0, true], [1, true]]);
  const s = fightState({ acts, foes: [foe("F1"), foe("F2")], c: { grimoire: ["Weaken"] } });
  const events = castSpell(s, IDX.Weaken, fakeRng(PAD(40)), []);
  assert.equal(!!s.combat.weakened, false);
  assert.equal(!!(s.c.timers && s.c.timers["spell:weaken"]), false);
  assert.equal(events.some((e) => e.type === "weakened"), false);
  assert.equal(events.filter((e) => e.type === "spellResisted").length, 2);
});

test("self spells never roll a resist (Heal, Shield, Map the Floor)", () => {
  for (const name of ["Heal", "Shield", "Map the Floor"]) {
    const s = fightState({ c: { grimoire: [name], wp: 30 } });
    const events = castSpell(s, IDX[name], fakeRng(PAD(40)), []);
    assert.equal(events.some((e) => e.type === "spellResisted" || e.type === "resistFailed"), false, name);
  }
});

// ---------------------------------------------------------------------------
// The other casters: a Joiner, a scroll, an item.
// ---------------------------------------------------------------------------

function muMember(overrides = {}) {
  return {
    name: "Ada", level: 1, sub: "Wizard", cls: "Magic User", race: "Human", wp: 20, maxWP: 20, status: "ok",
    weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded",
    grimoire: [], spellsUsed: 0, ...overrides,
  };
}

// User rulings 2026-09-28 (re-pinned, plan 79.2-01): "if it hits and
// resists, deal damage, but no freeze." A Joiner's Freeze throws first; the
// resist is rolled only after a hit's damage lands, and it stops only the
// freeze. (A miss rolls no resist.)
test("a Joiner's Freeze that hits a target that resists: the damage lands, spellResisted by the Joiner (freeze), no hold, the charge spent", () => {
  const acts = findActs("Freeze", [[0, true]], { 0: 16 }, "Ada");
  const s = fightState({ acts, foes: [foe("F1", { intel: 16 })], party: [muMember({ grimoire: ["Freeze"] })] });
  s.combat.allies = [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Wizard", wp: 20, maxWP: 20 }];
  // to-hit d10 (raw 5 -> 6, hits), d6 = 4, the hold's d4 = 3.
  const events = alliesTurn(s, fakeRng([5, 4, 3, ...PAD(20)]), []);
  const res = events.find((e) => e.type === "spellResisted");
  assert.ok(res);
  assert.equal(res.by, "Ada");
  assert.equal(res.spell, "Freeze");
  assert.equal(res.faces, 8);
  assert.equal(res.freeze, true);
  assert.ok(events.some((e) => e.type === "allySpellHit" && e.effect === "damage" && e.dmg === 5)); // d6 4 + level² 1 (quick 260928-sq2)
  assert.ok(events.findIndex((e) => e.type === "allySpellHit") < events.indexOf(res), "the resist follows the damage");
  assert.equal(s.combat.foes[0].wp, 25);
  assert.equal("held" in s.combat.foes[0], false);
  assert.equal(s.party[0].spellsUsed, 1);
});

test("a Joiner's Doze that the target fails to resist: resistFailed by the Joiner, then the foe sleeps", () => {
  const acts = findActs("Doze", [[0, false]], {}, "Ada");
  const s = fightState({ acts, foes: [foe("F1")], party: [muMember({ grimoire: ["Doze"] })] });
  s.combat.allies = [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Wizard", wp: 20, maxWP: 20 }];
  const events = alliesTurn(s, fakeRng([3, ...PAD(20)]), []);
  const rf = events.find((e) => e.type === "resistFailed");
  assert.equal(rf.by, "Ada");
  assert.ok(events.some((e) => e.type === "allySpellHit" && e.effect === "asleep"));
  assert.ok(s.combat.foes[0].asleep > 0);
});

test("a scroll's free Fireball follows the rule: a resisting target takes nothing", () => {
  const acts = findActs("Fireball", [[0, true]]);
  const s = fightState({ acts, depth: 3, c: { level: 1, scrolls: 1, grimoire: [] } });
  const rng = fakeRng(PAD(20), { pick: (arr) => arr.find((sp) => sp && sp.n === "Fireball") ?? arr[0] });
  const events = readScroll(s, rng, [], () => 0);
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Fireball"));
  assert.ok(events.some((e) => e.type === "spellResisted" && e.spell === "Fireball"));
  assert.equal(s.combat.foes[0].wp, 30);
});

// User rulings 2026-09-28 (re-pinned): the staff's freeze is a frozen hold
// for a rolled d4 (never a sleep); the resisting foe is not held.
test("the Birch Staff's freeze is a spell on each foe it reaches: the one that resists is not frozen", () => {
  const acts = findActs("Birch Staff", [[0, true], [1, false]]);
  const s = fightState({ acts, foes: [foe("F1"), foe("F2"), foe("F3")] });
  const it = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  s.c.weapon = it.n;
  s.c.staff = it;
  const events = useItem(s, { slot: "weapon" }, fakeRng([2, 3, ...PAD(20)]), [], () => 0);
  assert.ok(events.some((e) => e.type === "spellResisted" && e.target === "F1" && e.spell === "Birch Staff"));
  assert.equal("held" in s.combat.foes[0], false);
  assert.deepEqual(s.combat.foes[1].held, { kind: "frozen", left: 3 });
});

test("the Pine Staff's fireballs skip a foe that resisted them", () => {
  const acts = findActs("Pine Staff", [[0, true], [1, false]]);
  const s = fightState({ acts, foes: [foe("F1"), foe("F2")] });
  const it = { kind: "staff", n: "Pine Staff", use: "fire", charges: 1 };
  s.c.weapon = it.n;
  s.c.staff = it;
  const events = useItem(s, { slot: "weapon" }, fakeRng([4, ...PAD(20, 5)]), [], () => 0);
  assert.ok(events.some((e) => e.type === "spellResisted" && e.target === "F1"));
  assert.equal(s.combat.foes[0].wp, 30, "the resisting foe is untouched");
  assert.ok(s.combat.foes[1].wp < 30, "the other takes the fireballs");
});

// ---------------------------------------------------------------------------
// Both sides share the one helper (quick 260928-hrs, user ruling 2026-09-28:
// "Use the same half-intel scale for heroes now"). This reverses 260927-rsx's
// pin that foeAbilities.js never read the foe-side function: there is now one
// scale (resistFaces) and one roll (resistRoll), and only the stream differs.
// ---------------------------------------------------------------------------

test("both sides share one resist: the hero's resist (foeAbilities.js) and a foe's (foeSpellResistCheck) both roll resistRoll on resistFaces, with no intel-12 gate", () => {
  // The hero side: an intel-11 hero now rolls (canon's gate is retired).
  const rng = fakeRng([1]);
  assert.deepEqual(resistRoll(rng, 11), { rolled: true, resisted: true, roll: 20, atLeast: 15, dieN: 20, faces: 6 });
  assert.throws(() => rng.d(20), /exhausted/, "exactly one draw");
  const src = fs.readFileSync(path.join(REPO_ROOT, "engine", "foeAbilities.js"), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(src, /resistRoll\(rng, c\.intel\)/, "the hero rolls resistRoll off the main rng");
  // The foe side: the derived-stream wrapper returns resistRoll's own shape.
  const r = foeSpellResistCheck({ acts: 0, combat: { round: 1 } }, { getState: () => 0 }, "Fireball", 0, 16);
  assert.equal(r.faces, resistFaces(16));
  assert.equal(r.atLeast, 21 - resistFaces(16));
  // The one scale, read by nobody else: no engine file carries its own copy
  // of the half-intel formula.
  for (const f of ["magic.js", "combat.js", "items.js", "foeAbilities.js"]) {
    const s = fs.readFileSync(path.join(REPO_ROOT, "engine", f), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(s, /intel\s*\/\s*2/, f);
  }
});
