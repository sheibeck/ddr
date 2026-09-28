// test/unit/freeze-rule.test.js
//
// User rulings 2026-09-28 (folded into plan 79.2-01):
//   - "freeze should never kill outright. It should deal its damage and
//     freeze an enemy for 1d4 rounds."
//   - "if it hits and resists, deal damage, but no freeze."
// The order for every Freeze (the hero's cast, a scroll's free cast, a
// Joiner's allyCast, the Birch Staff's freeze power):
//   1. to-hit (as before; the staff has none);
//   2. on a hit, the damage lands; a kill is a normal kill (no frozenSolid);
//   3. a survivor draws the hold's d4 (FREEZE_HOLD_DIE), then rolls its intel
//      resist (resisted = damage only, no freeze);
//   4. past the knee, the RULES-18 control resist (shaken off = no freeze);
//   5. otherwise frozen (combat.js#holdFoe, kind "frozen") for the d4's rounds.
// The fixtures below read the REAL derived resist streams (never mocked),
// picking a `state.acts` where the foe resists or not as each case needs.
// Quick 260928-sq2 (re-pinned): a hit's damage is the d6 + the caster's
// level² (1 for these level-1 casters), so a d6 of 4 lands 5 (wp 30 -> 25).

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import { useItem } from "../../engine/items.js";
import { foeTurn, alliesTurn, FREEZE_HOLD_DIE } from "../../engine/combat.js";
import { controlResistCheck, foeSpellResistCheck } from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, linesForAction } from "../../src/browser/narrationLines.js";
import { actsWhere } from "./harness/spellResistActs.js";

const FREEZE = SPELLS.findIndex((sp) => sp.n === "Freeze");
const PAD = (n, v = 10) => new Array(n).fill(v);

/** fakeRng(seq) — `.d()` pops the next value; the cursor is a fixed 0 so the
 * derived resist streams read the same key whatever the main draw count. */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 0,
    count: () => i,
  };
}

function floorAt(depth) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth };
}

function foe(name, overrides = {}) {
  return { name, type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function hero(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1, sp: 0,
    maxWP: 60, wp: 60, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 4, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: ["Freeze"], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    ...overrides,
  };
}

function fightState(depth, foes, acts = 0) {
  return {
    version: 1, seed: 1, rngState: 1, acts,
    c: hero(),
    floor: floorAt(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: { foes, type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false },
  };
}

const noResist = (source, idxs = [0], caster = "you") => actsWhere(source, idxs.map((i) => [i, false]), { caster });
const resists = (source, idx = 0, caster = "you") => actsWhere(source, [[idx, true]], { caster });

// --- the hero's cast ----------------------------------------------------------

test("FREEZE_HOLD_DIE is 4 (user ruling 2026-09-28: frozen for 1d4 rounds)", () => {
  assert.equal(FREEZE_HOLD_DIE, 4);
});

test("a Freeze that hits and does not kill freezes for the rolled d4 (walk 1..4) at floor 1, never frozen solid", () => {
  for (let d = 1; d <= 4; d++) {
    const s = fightState(1, [foe("F1")], noResist("Freeze"));
    const rng = fakeRng([1, 4, d, ...PAD(20)]); // to-hit (raw 1 -> 10), d6 = 4, the hold's d4
    const events = castSpell(s, FREEZE, rng, []);
    const f = s.combat.foes[0];
    assert.equal(f.alive, true, `d4 ${d}`);
    assert.equal(f.wp, 25, `d4 ${d}: the damage landed`);
    assert.equal("frozen" in f, false, `d4 ${d}: never frozen solid`);
    assert.equal(events.some((e) => e.type === "frozenSolid" || e.type === "foeKilled"), false, `d4 ${d}`);
    const held = events.find((e) => e.type === "controlHeld");
    assert.deepEqual(
      { target: held.target, kind: held.kind, rounds: held.rounds, freeze: held.freeze, dmg: held.dmg, source: held.source },
      { target: "F1", kind: "frozen", rounds: d, freeze: true, dmg: 5, source: "Freeze" },
      `d4 ${d}`,
    );
    // The same dispatch's foeTurn spends the first frozen visit.
    if (d === 1) assert.equal("held" in f, false, "a 1-round freeze thaws on its first visit");
    else assert.deepEqual(f.held, { kind: "frozen", left: d - 1 }, `d4 ${d}`);
    assert.ok(events.some((e) => e.type === "resistFailed" && e.freeze === true), `d4 ${d}: the resist rolled after the damage`);
    assert.ok(events.findIndex((e) => e.type === "spellHit") < events.findIndex((e) => e.type === "resistFailed"), "the resist follows the hit");
  }
});

test("a Freeze whose damage kills is a normal kill: foeKilled, no frozenSolid, no resist roll, no hold", () => {
  const s = fightState(1, [foe("F1", { wp: 3 })]);
  const events = castSpell(s, FREEZE, fakeRng([1, 4, ...PAD(20)]), []);
  const f = s.combat ? s.combat.foes[0] : null;
  if (f) assert.equal(f.alive, false);
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.equal(events.some((e) => e.type === "frozenSolid"), false);
  assert.equal(events.some((e) => e.type === "resistFailed" || e.type === "spellResisted"), false);
  assert.equal(events.some((e) => e.type === "controlHeld"), false);
});

test("a Freeze that hits a foe that resists: the damage lands, no freeze; the event says so (freeze: true)", () => {
  const s = fightState(1, [foe("F1")], resists("Freeze"));
  const rng = fakeRng([1, 4, 3, ...PAD(20)]);
  const events = castSpell(s, FREEZE, rng, []);
  const f = s.combat.foes[0];
  assert.equal(f.wp, 25, "the damage landed");
  assert.equal("held" in f, false, "no freeze");
  assert.equal(events.some((e) => e.type === "controlHeld"), false);
  const r = events.find((e) => e.type === "spellResisted");
  assert.equal(r.freeze, true);
  assert.equal(r.target, "F1");
  assert.equal(EVENT_NARRATION.spellResisted(r).includes("F1 resists the freeze: the damage lands, the ice doesn't."), true, EVENT_NARRATION.spellResisted(r));
  assert.equal(LINE_FOR.spellResisted(r).text, "F1 resists the freeze: the damage lands, the ice doesn't");
});

test("a resisted and a landed Freeze take the same main draws (to-hit, damage, the d4)", () => {
  const counts = [resists("Freeze"), noResist("Freeze")].map((acts) => {
    const s = fightState(1, [foe("F1"), foe("F2")], acts);
    s.combat.foes[1].asleep = 99; // the second foe naps, so the foe turn draws nothing
    s.combat.foes[0].asleep = 0;
    const rng = fakeRng([1, 4, 3, ...PAD(20)]);
    const events = [];
    const origPush = events.push.bind(events);
    let atFoeTurn = null;
    events.push = (...xs) => {
      for (const x of xs) if (x && (x.type === "spellResisted" || x.type === "resistFailed") && atFoeTurn === null) atFoeTurn = rng.count();
      return origPush(...xs);
    };
    castSpell(s, FREEZE, rng, events);
    return atFoeTurn;
  });
  assert.deepEqual(counts, [3, 3]);
});

test("a Freeze that misses rolls no resist at all", () => {
  const s = fightState(1, [foe("F1")], resists("Freeze"));
  const events = castSpell(s, FREEZE, fakeRng([10, ...PAD(20)]), []); // raw 10 -> roll 1: a miss
  assert.ok(events.some((e) => e.type === "spellMissed"));
  assert.equal(events.some((e) => e.type === "spellResisted" || e.type === "resistFailed"), false);
  assert.equal(s.combat.foes[0].wp, 30);
});

test("past the knee the RULES-18 control resist still applies: shaken off = damaged, not frozen", () => {
  const depth = 20;
  const probe = { getState: () => 0 };
  let acts = -1;
  for (let a = 0; a <= 20000; a++) {
    const intel = foeSpellResistCheck({ acts: a, combat: { round: 1 } }, probe, "Freeze", 0, 1).resisted;
    const ctl = controlResistCheck({ floor: { depth }, acts: a, combat: { round: 1 } }, probe, "freeze:Freeze", 0);
    if (!intel && ctl.rolled && ctl.resisted) {
      acts = a;
      break;
    }
  }
  assert.ok(acts >= 0);
  const s = fightState(depth, [foe("F1")], acts);
  const events = castSpell(s, FREEZE, fakeRng([1, 4, 3, ...PAD(20)]), []);
  const f = s.combat.foes[0];
  assert.equal(f.alive, true);
  assert.equal(f.wp < 30, true, "the damage landed");
  assert.equal(f.resisted, "freeze");
  assert.equal("held" in f, false);
  assert.ok(events.some((e) => e.type === "controlResisted" && e.effect === "freeze"));
});

// --- a frozen foe skips its turns, then thaws ------------------------------------

test("a frozen foe does not act for its rounds, then thaws and acts again", () => {
  const s = fightState(1, [foe("F1")], noResist("Freeze"));
  castSpell(s, FREEZE, fakeRng([1, 4, 2, ...PAD(20)]), []); // frozen for 2; the cast's own dispatch spends 1
  const f = s.combat.foes[0];
  assert.deepEqual(f.held, { kind: "frozen", left: 1 });

  const thawRng = fakeRng(PAD(20));
  const thaw = foeTurn(s, thawRng, []);
  assert.ok(thaw.some((e) => e.type === "foeHoldBroken" && e.name === "F1" && e.kind === "frozen"));
  assert.equal("held" in f, false);
  assert.equal(thawRng.count(), 0, "a frozen visit draws nothing: it does not act");

  const actRng = fakeRng(PAD(40));
  foeTurn(s, actRng, []);
  assert.ok(actRng.count() > 0, "thawed, it swings again");
});

// --- a scroll, a Joiner and the Birch Staff meet the same rule -------------------

test("a scroll of Freeze read in combat meets the same rule (castSpell's own branch)", () => {
  const s = fightState(1, [foe("F1")], noResist("Freeze"));
  s.c.scrolls = 1;
  const rng = { ...fakeRng([1, 4, 3, ...PAD(20)]), pick: (arr) => arr.find((sp) => sp.n === "Freeze") };
  const events = readScroll(s, rng, []);
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Freeze"));
  const held = events.find((e) => e.type === "controlHeld");
  assert.deepEqual({ rounds: held.rounds, freeze: held.freeze }, { rounds: 3, freeze: true });
  assert.equal(s.combat.foes[0].alive, true);
  assert.equal(events.some((e) => e.type === "frozenSolid" || e.type === "foeKilled"), false);
});

function joinerState(acts) {
  const s = fightState(1, [foe("F1")], acts);
  s.party = [
    {
      name: "Ada", level: 1, cls: "Magic User", sub: "Wizard", race: "Human", wp: 20, maxWP: 20, status: "ok",
      weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: ["Freeze"], spellsUsed: 0,
    },
  ];
  s.combat.allies = [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Wizard", wp: 20, maxWP: 20 }];
  return s;
}

test("a Joiner's Freeze matches the hero's: damage, then frozen for the d4; a resist keeps the damage and drops the freeze", () => {
  const landed = joinerState(noResist("Freeze", [0], "Ada"));
  const ev1 = alliesTurn(landed, fakeRng([5, 4, 3]), []);
  const f1 = landed.combat.foes[0];
  assert.equal(f1.wp, 25);
  assert.deepEqual(f1.held, { kind: "frozen", left: 3 });
  assert.ok(ev1.some((e) => e.type === "allySpellHit" && e.effect === "damage" && e.dmg === 5));
  assert.ok(ev1.some((e) => e.type === "controlHeld" && e.freeze && e.rounds === 3));

  const shrugged = joinerState(resists("Freeze", 0, "Ada"));
  const ev2 = alliesTurn(shrugged, fakeRng([5, 4, 3]), []);
  const f2 = shrugged.combat.foes[0];
  assert.equal(f2.wp, 25, "the damage landed");
  assert.equal("held" in f2, false, "no freeze");
  const r = ev2.find((e) => e.type === "spellResisted");
  assert.deepEqual({ by: r.by, freeze: r.freeze }, { by: "Ada", freeze: true });

  const killed = joinerState(noResist("Freeze", [0], "Ada"));
  killed.combat.foes[0].wp = 3;
  const ev3 = alliesTurn(killed, fakeRng([5, 4, ...PAD(20)]), []);
  assert.ok(ev3.some((e) => e.type === "foeKilled"));
  assert.equal(ev3.some((e) => e.type === "frozenSolid" || e.type === "controlHeld"), false);
});

test("the Birch Staff's freeze: each foe it reaches is frozen for its own d4 (no damage, no asleep 99); a resist means no effect", () => {
  const staff = () => ({ kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 });
  const run = (acts, seq) => {
    const s = fightState(1, [foe("F1"), foe("F2"), foe("F3")], acts);
    s.c.weapon = "Birch Staff";
    s.c.staff = staff();
    const rng = fakeRng(seq);
    const events = useItem(s, { slot: "weapon" }, rng, [], () => 0);
    return { s, events, rng };
  };
  const both = run(noResist("Birch Staff", [0, 1]), [2, 4, ...PAD(20)]);
  const [a, b, c] = both.s.combat.foes;
  assert.deepEqual(a.held, { kind: "frozen", left: 2 });
  assert.deepEqual(b.held, { kind: "frozen", left: 4 });
  assert.equal("held" in c, false, "outside the staff's two squares");
  assert.deepEqual([a, b, c].map((f) => [f.wp, f.asleep]), [[30, 0], [30, 0], [30, 0]]);
  const held = both.events.filter((e) => e.type === "controlHeld");
  assert.deepEqual(held.map((e) => [e.target, e.rounds, e.freeze, "dmg" in e]), [["F1", 2, true, false], ["F2", 4, true, false]]);
  assert.equal(both.rng.count(), 2, "one d4 per foe reached");

  const first = run(actsWhere("Birch Staff", [[0, true], [1, false]]), [2, 4, ...PAD(20)]);
  assert.equal("held" in first.s.combat.foes[0], false);
  assert.deepEqual(first.s.combat.foes[1].held, { kind: "frozen", left: 4 });
  const r = first.events.find((e) => e.type === "spellResisted");
  assert.equal(r.freeze, undefined, "the staff did no damage, so its resist is the plain 'no effect'");
  assert.equal(first.rng.count(), 2, "the resisting foe's d4 is drawn too");
});

// --- the lines ------------------------------------------------------------------------

test("the lines: a Freeze that holds reads its damage and 'frozen for N rounds'; the rail folds the hit, the resist and the hold into one line", () => {
  const s = fightState(1, [foe("F1")], noResist("Freeze"));
  const events = castSpell(s, FREEZE, fakeRng([1, 4, 3, ...PAD(20)]), []);
  const held = events.find((e) => e.type === "controlHeld");
  assert.match(EVENT_NARRATION.controlHeld(held), /F1 is frozen for 3 rounds\./);
  assert.equal(LINE_FOR.controlHeld(held).text, "F1 frozen for 3 rounds.");
  for (const order of ["priority", "event"]) {
    const lines = linesForAction("castSpell", events, {}, { order });
    const texts = lines.map((l) => l.text);
    assert.ok(texts.includes("Freeze hits F1 (5), frozen for 3 rounds"), `${order}: ${JSON.stringify(texts)}`);
    assert.equal(texts.some((t) => /fails to resist/.test(t)), false, `${order}: the failed resist folds behind the freeze`);
    assert.equal(texts.some((t) => /frozen solid/.test(t)), false, order);
  }
  // A one-round freeze reads "1 round".
  assert.match(EVENT_NARRATION.controlHeld({ ...held, rounds: 1 }), /frozen for 1 round\./);
});
