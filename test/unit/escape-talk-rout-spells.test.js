// test/unit/escape-talk-rout-spells.test.js
//
// Phase 90 plan 09 (SPELL-10): the Illusion spells that end or tilt a fight, the
// last three of the accepted slate.
//   - Door Illusion (Illusion 1): the cleverest live foe (highest intelligence,
//     the first in C.foes order on a tie) rolls the one depth-rising resist; if
//     it fails, the fight ends through the flee path Smoke uses (no flee roll, no
//     parting blow, spoils forfeited, `fled { reason: "door" }`); if it resists,
//     `doorIllusionSeen` and the turn is spent. A hero who may never flee (the
//     Samurai, through combat.js#fleeRefusal, the predicate flee() reads) is
//     refused before the charge.
//   - Chameleon Tongue (Illusion 3): the fight's one parley at fluency 2 (+4 on
//     the roll, Magical foes can be talked to, the Walking Dead never), through
//     the fight-scoped C.tongue that derived.js#fluency reads. Refused before the
//     charge when the parley cannot happen (combat.js#parleyBlockedReason).
//   - Size of the Behemoth (Illusion 4): every live foe rolls its resist; a
//     failer below the caster's level flees (no experience, no spoils), any
//     other failer cowers for the fight (a per-foe flag: top three numbers, half
//     damage; a Weaken's expiry never clears it).
//
// Every resist is the ONE depth-rising resist (derived stream); its outcome is
// forced by searching for a `state.acts` whose real roll gives the wanted result
// (the control-slate-spells.test.js pattern), the main-rng cursor fixed at 0.

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import { flee, canParley, parley, fleeRefusal, parleyBlockedReason, doorIllusionEscape, behemothRoar, foeTurn } from "../../engine/combat.js";
import { resolveScrollFumble } from "../../engine/scrollFumble.js";
import { foeRisingResistCheck, foeSwingVsHero, foeWeakened, fluency, canCast, spellTargetsFoe, SPELL_SELF_KINDS } from "../../engine/derived.js";
import { SPELLS, SCROLL_FUMBLE } from "../../content/index.js";
import { FUMBLE_EFFECTS } from "../../content/scroll-fumbles.js";
import { GW, GH } from "../../engine/maze.js";

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const SP = Object.fromEntries(SPELLS.map((sp) => [sp.n, sp]));
const ONES = (n) => new Array(n).fill(1);

/** fakeRng(seq) — `.d()` pops the next raw value (a raw 1 is the best face of a
 * roll-high check); the cursor (`getState`) is fixed at 0 so a forced resist
 * outcome never depends on how many main draws came first. */
function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 0,
    count: () => i,
  };
}

function fixedFloor(depth = 1) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth };
}

function hero(overrides = {}) {
  return {
    cls: "Magic User", sub: "Illusionist", race: "Human", level: 5, sp: 0,
    maxWP: 60, wp: 60, skills: {}, vp: 0,
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
  return { name, type: "Humans", lvl: 1, size: "S", intel: 10, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function spellState(spellName, foes, { sub = "Illusionist", level = 5, depth = 1, type = "Humans", heroOver = {} } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ sub, level, grimoire: spellName ? [spellName] : [], ...heroOver }),
    floor: fixedFloor(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: foes.map((f, k) => (typeof f === "string" ? foe(f) : { ...foe(`F${k + 1}`), ...f })),
      type, round: 1, target: 0, spellOpen: false, tracked: false,
    },
  };
}

const isResistLine = (e) => e.type === "spellResisted" || e.type === "resistFailed";

/** findActs(wants, depth, intel) — the first state.acts whose REAL resist roll
 * gives every `[source, idx, resisted, by, intel?]` in `wants`. */
function findActs(wants, depth = 1, intel = 10) {
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    if (wants.every(([source, idx, resisted, by, i]) => foeRisingResistCheck({ floor: { depth }, acts, combat: { round: 1 } }, probe, source, idx, i ?? intel, by).resisted === resisted)) return acts;
  }
  throw new Error(`findActs: nothing for ${JSON.stringify(wants)}`);
}

// ---------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------

test("rows: the last three SPELLS rows are Door Illusion, Chameleon Tongue, Size of the Behemoth, after Duplicate Foe, and SPELLS holds all ten slate spells (41 rows)", () => {
  assert.equal(SPELLS.length, 41);
  assert.deepEqual(SPELLS.slice(-4).map((sp) => sp.n), ["Duplicate Foe", "Door Illusion", "Chameleon Tongue", "Size of the Behemoth"]);
  const door = SP["Door Illusion"];
  assert.equal(door.lvl, 1);
  assert.equal(door.kind, "door");
  assert.equal(door.niche, "defensive");
  const tongue = SP["Chameleon Tongue"];
  assert.equal(tongue.lvl, 3);
  assert.equal(tongue.kind, "tongue");
  assert.equal(tongue.fluency, 2);
  assert.equal(tongue.niche, "answer");
  const behemoth = SP["Size of the Behemoth"];
  assert.equal(behemoth.lvl, 4);
  assert.equal(behemoth.kind, "behemoth");
  assert.equal(behemoth.niche, "control");
  for (const sp of [door, tongue, behemoth]) {
    assert.equal(sp.s, "illusion", `${sp.n} is Illusion`);
    assert.equal(sp.combatOnly, true, `${sp.n} is combat-only`);
    assert.equal(sp.roll, "derived", `${sp.n} joins the pools through a derived stream`);
    assert.ok(sp.txt.startsWith(`${sp.niche} · `), `${sp.n}: text starts with its niche`);
  }
  assert.match(door.txt, /cleverest foe/);
  assert.match(tongue.txt, /\+4/);
  assert.match(tongue.txt, /Magical/);
  assert.match(behemoth.txt, /6–8 on a d8, 18–20 on a d20/);
  // the slate's ten: one Special and one Illusion at every level 1 to 5
  const slate = ["Open/Lock", "Door Illusion", "Fly", "Senseless", "Stop Time", "Chameleon Tongue", "Enchant Character", "Size of the Behemoth", "Speed of Sound", "Duplicate Foe"];
  for (let lvl = 1; lvl <= 5; lvl++) {
    const at = slate.map((n) => SP[n]).filter((sp) => sp.lvl === lvl);
    assert.ok(at.some((sp) => sp.s === "special"), `a Special spell at level ${lvl}`);
    assert.ok(at.some((sp) => sp.s === "illusion"), `an Illusion spell at level ${lvl}`);
  }
});

test("Tongue joins SPELL_SELF_KINDS (never resisted: the parley roll is its check); Door and Behemoth are cast on foes", () => {
  assert.equal(SPELL_SELF_KINDS.has("tongue"), true);
  assert.equal(spellTargetsFoe(SP["Chameleon Tongue"]), false);
  assert.equal(spellTargetsFoe(SP["Door Illusion"]), true);
  assert.equal(spellTargetsFoe(SP["Size of the Behemoth"]), true);
});

test("the school gates hold with no extra code: only the Illusionist and the Apprentice cast the three", () => {
  const can = (sub, name) => canCast({ c: { sub, level: 5, grimoire: [name] } }, SP[name]);
  for (const name of ["Door Illusion", "Chameleon Tongue", "Size of the Behemoth"]) {
    for (const sub of ["Illusionist", "Apprentice"]) assert.equal(can(sub, name), true, `${sub} casts ${name}`);
    for (const sub of ["Wizard", "Warlock", "Sorcerer", "Court Mage", "Cleric", "Summoner"]) assert.equal(can(sub, name), false, `${sub} never casts ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Door Illusion
// ---------------------------------------------------------------------------

test("fleeRefusal: the one never-flee predicate (a Samurai), null for everyone else; flee() reads it", () => {
  assert.equal(fleeRefusal({ c: { sub: "Samurai" } }), "samurai");
  assert.equal(fleeRefusal({ c: { sub: "Soldier" } }), null);
  assert.equal(fleeRefusal({ c: { sub: "Illusionist" } }), null);
  const s = spellState(null, ["F1"], { sub: "Samurai" });
  const ev = flee(s, fakeRng([]), []);
  assert.deepEqual(ev, [{ type: "fleeRefused", reason: "samurai" }]);
  assert.ok(s.combat, "the fight goes on");
});

test("Door Illusion: only the cleverest foe rolls (three foes, intelligences 3, 12, 12: the first intelligence-12 foe); failing it, the fight ends through the Smoke path: no flee roll, no parting blow, spoils forfeited", () => {
  const s = spellState("Door Illusion", [{ intel: 3 }, { intel: 12 }, { intel: 12 }]);
  s.pendingLoot = [{ kind: "gold", amount: 10 }];
  s.acts = findActs([["Door Illusion", 1, false]], 1, 12);
  const rng = fakeRng([]);
  const ev = castSpell(s, IDX["Door Illusion"], rng, []);
  const resists = ev.filter(isResistLine);
  assert.equal(resists.length, 1, "exactly one foe rolls");
  assert.equal(resists[0].target, "F2", "the first of the cleverest, in C.foes order");
  assert.equal(resists[0].type, "resistFailed");
  assert.equal(rng.count(), 0, "no main-rng draw: no flee roll, no parting blow");
  assert.equal(ev.some((e) => e.type === "fleeRolled" || e.type === "fleeFailed"), false, "no flee roll");
  assert.equal(ev.some((e) => e.type === "foeHit" || e.type === "pursuitStruck" || e.type === "pursuit"), false, "no parting blow");
  const types = ev.map((e) => e.type);
  assert.ok(types.indexOf("lootForfeited") >= 0 && types.indexOf("lootForfeited") < types.indexOf("fled"), "the spoils are forfeited before the fled line, as in any flee");
  assert.deepEqual(ev.filter((e) => e.type === "fled"), [{ type: "fled", reason: "door" }]);
  assert.equal(s.combat, null, "the fight is over");
  assert.deepEqual(s.pendingLoot, [], "spoils left behind");
  assert.equal(s.c.spellsUsed, 1, "the charge is spent");
  assert.equal(s.c.wp, 60, "nothing hit the hero");
});

test("Door Illusion: the cleverest foe of the highest intelligence rolls; on a tie the first in C.foes order", () => {
  const s = spellState(null, [{ intel: 12 }, { intel: 12 }, { intel: 5 }]);
  s.acts = findActs([["Door Illusion", 0, false]], 1, 12);
  const ev = [];
  assert.equal(doorIllusionEscape(s, SP["Door Illusion"], fakeRng([]), ev), true);
  assert.deepEqual(ev.filter(isResistLine).map((e) => e.target), ["F1"]);
  const s2 = spellState(null, [{ intel: 4 }, { intel: 16 }, { intel: 16 }]);
  s2.acts = findActs([["Door Illusion", 1, false]], 1, 16);
  const ev2 = [];
  doorIllusionEscape(s2, SP["Door Illusion"], fakeRng([]), ev2);
  assert.deepEqual(ev2.filter(isResistLine).map((e) => e.target), ["F2"]);
});

test("Door Illusion: when the cleverest foe resists, the door is seen through: nothing else changes, the turn is spent and the foes take theirs", () => {
  const s = spellState("Door Illusion", [{ intel: 3 }, { intel: 16 }]);
  s.acts = findActs([["Door Illusion", 1, true]], 1, 16);
  const ev = castSpell(s, IDX["Door Illusion"], fakeRng(ONES(60)), []);
  assert.deepEqual(ev.filter(isResistLine).map((e) => [e.type, e.target]), [["spellResisted", "F2"]]);
  assert.deepEqual(ev.filter((e) => e.type === "doorIllusionSeen"), [{ type: "doorIllusionSeen", foe: "F2" }]);
  assert.equal(ev.some((e) => e.type === "fled"), false);
  assert.ok(s.combat, "the fight goes on");
  assert.equal(s.combat.round, 2, "the turn is spent: the foes took theirs, once");
  assert.equal(s.c.spellsUsed, 1, "the charge is spent");
});

test("Door Illusion edge (adjacency): with a Joiner in the party the fight ends for both, and the Joiner's hit points sync back", () => {
  const s = spellState("Door Illusion", [{ intel: 2 }]);
  s.acts = findActs([["Door Illusion", 0, false]], 1, 2);
  s.combat.allies = [{ name: "Joiner Jo", partyIdx: 0, wp: 14, maxWP: 20 }];
  s.party = [{ name: "Joiner Jo", race: "Human", cls: "Fighter", sub: "Soldier", level: 1, wp: 20, maxWP: 20 }];
  const ev = castSpell(s, IDX["Door Illusion"], fakeRng([]), []);
  assert.equal(s.combat, null, "the fight is over for both");
  assert.equal(s.party.length, 1, "the Joiner leaves with the hero");
  assert.equal(s.party[0].wp, 14, "its hit points synced back");
  assert.deepEqual(ev.filter((e) => e.type === "fled"), [{ type: "fled", reason: "door" }]);
});

test("Door Illusion edge (empty): a lone intelligence-1 foe fails its resist on all but a rising-resist sliver, and the escape works", () => {
  const s = spellState("Door Illusion", [{ intel: 1 }]);
  s.acts = findActs([["Door Illusion", 0, false]], 1, 1);
  const ev = castSpell(s, IDX["Door Illusion"], fakeRng([]), []);
  assert.equal(ev.filter(isResistLine)[0].type, "resistFailed");
  assert.equal(s.combat, null);
  assert.deepEqual(ev.filter((e) => e.type === "fled"), [{ type: "fled", reason: "door" }]);
});

test("Door Illusion: a Samurai is refused through fleeRefusal BEFORE the charge, the fight and the turn are untouched; a scroll's cast is still consumed and the hero is told why", () => {
  const s = spellState("Door Illusion", [{ intel: 2 }], { sub: "Samurai", heroOver: { cls: "Fighter" } });
  s.c.grimoire = ["Door Illusion"];
  s.c.scrollCast = true;
  const rng = fakeRng([]);
  const ev = castSpell(s, IDX["Door Illusion"], rng, []);
  assert.deepEqual(ev, [{ type: "castRefused", spell: "Door Illusion", reason: "samurai" }]);
  assert.equal(s.c.spellsUsed, 0, "no charge");
  assert.equal(rng.count(), 0);
  assert.ok(s.combat);
  assert.equal(s.combat.round, 1, "the turn is not spent");
  // readScroll end to end: the scroll is consumed (RULES-10) and the line says why
  const s2 = spellState(null, [{ intel: 2 }], { sub: "Samurai", heroOver: { cls: "Magic User", scrolls: 1 } });
  const pick = (arr) => arr.find((sp) => sp.n === "Door Illusion");
  const ev2 = readScroll(s2, { ...fakeRng(ONES(40)), pick }, []);
  assert.equal(s2.c.scrolls, 0, "the scroll is spent");
  assert.ok(ev2.some((e) => e.type === "castRefused" && e.spell === "Door Illusion" && e.reason === "samurai"), "and the reader is told why");
  assert.ok(s2.combat);
});

test("Door Illusion: outside a fight it is refused (combat-only) like any combat spell", () => {
  const s = spellState("Door Illusion", [{ intel: 2 }]);
  s.combat = null;
  const ev = castSpell(s, IDX["Door Illusion"], fakeRng([]), []);
  assert.deepEqual(ev, [{ type: "castRefused", spell: "Door Illusion", reason: "combatOnly" }]);
  assert.equal(s.c.spellsUsed, 0);
});

// ---------------------------------------------------------------------------
// Chameleon Tongue
// ---------------------------------------------------------------------------

test("fluency: C.tongue is a fight-scoped source that lifts it to 2; it never stacks with the Helm and never leaks outside the fight", () => {
  const c = hero();
  assert.equal(fluency(c), 0);
  assert.equal(fluency(c, {}), 0);
  assert.equal(fluency(c, { tongue: 2 }), 2);
  assert.equal(fluency(c, { tongue: 0 }), 0);
});

test("parleyBlockedReason: names each refusal in parley's order, and null when talking can happen; canParley and parley read it", () => {
  const humans = (over = {}, heroOver = {}) => spellState(null, ["F1"], { heroOver, ...over });
  assert.equal(parleyBlockedReason(humans({ sub: "Illusionist" }), 2), null, "an Illusionist vs Humans at fluency 2");
  assert.equal(parleyBlockedReason(humans({ sub: "Illusionist" })), "noTalk", "without the tongue it cannot open Humans");
  const spent = humans({ sub: "Illusionist" });
  spent.combat.parleyTried = true;
  assert.equal(parleyBlockedReason(spent, 2), "parleySpent");
  assert.equal(parleyBlockedReason(humans({ sub: "Ninja" }), 2), "ninja");
  assert.equal(parleyBlockedReason(humans({ sub: "Master of Arms" }), 2), "masterOfArms");
  assert.equal(parleyBlockedReason(humans({ sub: "Illusionist", type: "Walking Dead" }), 2), "walkingDead");
  assert.equal(parleyBlockedReason(humans({ sub: "Illusionist", type: "Magical" }), 2), null, "Magical opens at fluency 2");
  assert.equal(parleyBlockedReason(humans({ sub: "Illusionist", type: "Magical" })), "noTalk", "and not below it");
  assert.equal(parleyBlockedReason(humans({ sub: "Illusionist", type: "Magical" }, { race: "Wilmsry" }), 2), "wilmsryVsMagical", "the Wilmsry-vs-Magical refusal stands");
  // canParley is unchanged: the button still shows for a fluency-2 Wilmsry vs Magical (parley then refuses)
  const wm = humans({ sub: "Illusionist", type: "Magical" }, { race: "Wilmsry" });
  wm.combat.tongue = 2;
  assert.equal(canParley(wm), true);
  const ev = parley(wm, fakeRng([]), []);
  assert.deepEqual(ev, [{ type: "parleyRefused", reason: "wilmsryVsMagical" }]);
  assert.equal(wm.combat.parleyTried, undefined, "a refusal never spends the one attempt");
});

test("Chameleon Tongue: a level-3 caster against level-3 Humans parleys at fluency 2: +4 on the roll (13 winning faces), tongueCast then parleyRolled with fluency 2", () => {
  const s = spellState("Chameleon Tongue", [{ lvl: 3 }], { level: 3 });
  assert.equal(canParley(s, 2), true);
  // raw 8 on the d20 reads as roll 13 (21 - 8): 13 is a win only when the need is <= 13 (8-20 = 13 faces)
  const rng = fakeRng([8, ...ONES(60)]);
  const ev = castSpell(s, IDX["Chameleon Tongue"], rng, []);
  const types = ev.map((e) => e.type);
  assert.ok(types.indexOf("tongueCast") >= 0 && types.indexOf("parleyRolled") > types.indexOf("tongueCast"), "tongueCast then parleyRolled");
  const rolled = ev.find((e) => e.type === "parleyRolled");
  assert.equal(rolled.fluency, 2);
  assert.equal(rolled.dieN, 20);
  assert.equal(rolled.atLeast, 8, "9 + 4 = 13 winning faces: 8 to 20, a 65% parley");
  assert.ok(rolled.roll >= rolled.atLeast, "the roll wins");
  assert.equal(s.combat, null, "a successful parley ends the fight");
  assert.equal(s.c.spellsUsed, 1);
});

test("Chameleon Tongue: the winning faces cap at 17 (the D-08 ceiling) however the level gap helps", () => {
  const s = spellState("Chameleon Tongue", [{ lvl: 1 }], { level: 5 });
  const ev = castSpell(s, IDX["Chameleon Tongue"], fakeRng([1, ...ONES(60)]), []);
  const rolled = ev.find((e) => e.type === "parleyRolled");
  assert.equal(rolled.atLeast, 4, "17 faces is the cap: 4 to 20 (85%)");
});

test("Chameleon Tongue: a failed parley insults the room, spends the one parley, and the foes take ONE turn (castSpell never runs the foe turn twice)", () => {
  const s = spellState("Chameleon Tongue", [{ lvl: 3 }], { level: 3 });
  const ev = castSpell(s, IDX["Chameleon Tongue"], fakeRng([20, ...ONES(80)]), []);
  assert.ok(ev.some((e) => e.type === "parleyFailed"));
  assert.ok(ev.some((e) => e.type === "parleyInsulted"));
  assert.ok(s.combat, "the fight goes on");
  assert.equal(s.combat.parleyTried, true, "the fight's one parley is spent");
  assert.equal(s.combat.parleyInsulted, true);
  assert.equal(s.combat.round, 2, "exactly one foe turn: the round advanced once");
  assert.equal(s.c.spellsUsed, 1);
});

test("Chameleon Tongue: Magical foes can be talked to (it is allowed)", () => {
  const s = spellState("Chameleon Tongue", [{ lvl: 3 }], { level: 3, type: "Magical" });
  assert.equal(parleyBlockedReason(s, 2), null);
  const ev = castSpell(s, IDX["Chameleon Tongue"], fakeRng([1, ...ONES(60)]), []);
  assert.ok(ev.some((e) => e.type === "parleyRolled" && e.fluency === 2));
  assert.equal(s.combat, null);
});

test("Chameleon Tongue: refused BEFORE the charge against the Walking Dead, after a spent parley, and for a Ninja reading the scroll, each with its reason", () => {
  const dead = spellState("Chameleon Tongue", [{ lvl: 3 }], { level: 3, type: "Walking Dead" });
  const evDead = castSpell(dead, IDX["Chameleon Tongue"], fakeRng([]), []);
  assert.deepEqual(evDead, [{ type: "castRefused", spell: "Chameleon Tongue", reason: "walkingDead" }]);
  assert.equal(dead.c.spellsUsed, 0, "no charge");
  assert.equal(dead.combat.round, 1, "no turn spent");
  assert.equal(dead.combat.tongue, undefined, "and the fight is left as it was");

  const spent = spellState("Chameleon Tongue", [{ lvl: 3 }], { level: 3 });
  spent.combat.parleyTried = true;
  assert.deepEqual(castSpell(spent, IDX["Chameleon Tongue"], fakeRng([]), []), [{ type: "castRefused", spell: "Chameleon Tongue", reason: "parleySpent" }]);
  assert.equal(spent.c.spellsUsed, 0);

  const ninja = spellState("Chameleon Tongue", [{ lvl: 3 }], { sub: "Ninja", level: 3, heroOver: { cls: "Thief" } });
  ninja.c.scrollCast = true;
  assert.deepEqual(castSpell(ninja, IDX["Chameleon Tongue"], fakeRng([]), []), [{ type: "castRefused", spell: "Chameleon Tongue", reason: "ninja" }]);
  assert.equal(ninja.c.spellsUsed, 0);
});

test("Chameleon Tongue edge (adjacency): after a failed ORDINARY parley it is refused with no charge spent", () => {
  const s = spellState("Chameleon Tongue", [{ lvl: 3 }], { level: 3, heroOver: { race: "Elven" } });
  const ev1 = parley(s, fakeRng([20, ...ONES(80)]), []);
  assert.ok(ev1.some((e) => e.type === "parleyFailed"), "the ordinary parley failed");
  const rng = fakeRng([]);
  const ev2 = castSpell(s, IDX["Chameleon Tongue"], rng, []);
  assert.deepEqual(ev2, [{ type: "castRefused", spell: "Chameleon Tongue", reason: "parleySpent" }]);
  assert.equal(s.c.spellsUsed, 0, "no charge spent");
  assert.equal(rng.count(), 0);
});

test("Chameleon Tongue edge (empty): against the Walking Dead it is refused before the charge, and the fight has no tongue", () => {
  const s = spellState("Chameleon Tongue", [{ lvl: 1 }], { level: 5, type: "Walking Dead" });
  const ev = castSpell(s, IDX["Chameleon Tongue"], fakeRng([]), []);
  assert.deepEqual(ev.map((e) => e.reason), ["walkingDead"]);
  assert.equal(s.c.spellsUsed, 0);
  assert.equal(fluency(s.c, s.combat), 0);
});

// ---------------------------------------------------------------------------
// Size of the Behemoth
// ---------------------------------------------------------------------------

test("Size of the Behemoth: a level-3 caster against foes of level 2, 3 and 4, none resisting: the level-2 foe flees (no experience, no spoils); the level-3 and 4 foes cower", () => {
  const s = spellState("Size of the Behemoth", [{ lvl: 2 }, { lvl: 3 }, { lvl: 4 }], { level: 3 });
  s.acts = findActs([["Size of the Behemoth", 0, false], ["Size of the Behemoth", 1, false], ["Size of the Behemoth", 2, false]]);
  s.c.scrollCast = true;
  s.pendingLoot = [{ kind: "gold", amount: 10 }];
  const rng = fakeRng(ONES(80));
  const ev = castSpell(s, IDX["Size of the Behemoth"], rng, []);
  const [f1, f2, f3] = s.combat.foes;
  assert.equal(f1.alive, false);
  assert.equal(f1.fled, true);
  assert.equal(f2.alive, true, "a foe exactly at the caster's level is not below it: it cowers");
  assert.equal(f2.cowering, true);
  assert.equal(f3.cowering, true);
  assert.equal(f1.cowering, undefined);
  assert.equal(ev.some((e) => e.type === "foeKilled"), false, "a routed foe is never killed");
  assert.equal(s.c.kills, 0);
  assert.equal(s.c.sp, 0, "no experience");
  assert.deepEqual(s.pendingLoot, [{ kind: "gold", amount: 10 }], "and no spoils were taken or forfeited");
  assert.deepEqual(ev.filter((e) => e.type === "foeRouted"), [{ type: "foeRouted", name: "F1" }]);
  assert.deepEqual(ev.filter((e) => e.type === "foeCowers").map((e) => e.name), ["F2", "F3"]);
  assert.deepEqual(ev.filter((e) => e.type === "behemothCast"), [{ type: "behemothCast", routed: 1, cowering: 2 }]);
});

test("Size of the Behemoth edge (ordering): foes resolve in C.foes order (rout or cower), then the summary line; each foe's resist line comes first", () => {
  const s = spellState(null, [{ lvl: 4 }, { lvl: 1 }, { lvl: 2 }], { level: 3 });
  s.acts = findActs([["Size of the Behemoth", 0, false], ["Size of the Behemoth", 1, false], ["Size of the Behemoth", 2, false]]);
  const ev = [];
  const out = behemothRoar(s, SP["Size of the Behemoth"], fakeRng([]), ev, { level: 3 });
  assert.deepEqual(out, { routed: 2, cowering: 1 });
  assert.deepEqual(ev.map((e) => (isResistLine(e) ? `resist:${e.target}` : `${e.type}:${e.name ?? ""}`)), [
    "resist:F1", "foeCowers:F1", "resist:F2", "foeRouted:F2", "resist:F3", "foeRouted:F3", "behemothCast:",
  ]);
});

test("Size of the Behemoth: a foe that resists is untouched; a Behemoth that every foe resists changes nothing and says so", () => {
  const s = spellState(null, [{ lvl: 1 }, { lvl: 5 }], { level: 3 });
  s.acts = findActs([["Size of the Behemoth", 0, true], ["Size of the Behemoth", 1, false]]);
  const ev = [];
  behemothRoar(s, SP["Size of the Behemoth"], fakeRng([]), ev, { level: 3 });
  const [a, b] = s.combat.foes;
  assert.equal(a.alive, true, "the resister stays, though below the level");
  assert.equal(a.cowering, undefined);
  assert.equal(b.cowering, true);

  const all = spellState(null, [{ lvl: 1 }, { lvl: 5 }], { level: 3 });
  all.acts = findActs([["Size of the Behemoth", 0, true], ["Size of the Behemoth", 1, true]]);
  const ev2 = [];
  const out = behemothRoar(all, SP["Size of the Behemoth"], fakeRng([]), ev2, { level: 3 });
  assert.deepEqual(out, { routed: 0, cowering: 0 });
  assert.deepEqual(all.combat.foes.map((f) => [f.alive, f.cowering, f.fled]), [[true, undefined, undefined], [true, undefined, undefined]]);
  assert.deepEqual(ev2.filter((e) => e.type === "behemothCast"), [{ type: "behemothCast", routed: 0, cowering: 0 }]);
});

test("Size of the Behemoth: when the rout empties the room the encounter clears through the usual path, with nothing paid", () => {
  const s = spellState("Size of the Behemoth", [{ lvl: 1 }, { lvl: 1 }], { level: 4 });
  s.acts = findActs([["Size of the Behemoth", 0, false], ["Size of the Behemoth", 1, false]]);
  const ev = castSpell(s, IDX["Size of the Behemoth"], fakeRng(ONES(40)), []);
  assert.equal(s.combat, null);
  assert.ok(ev.some((e) => e.type === "encounterCleared"));
  assert.equal(s.c.kills, 0);
  assert.equal(s.c.sp, 0);
});

test("a cowering foe hits only on its die's top three numbers and deals half damage, whatever the room's Weaken is doing; a Weaken's expiry never clears it", () => {
  const s = spellState(null, [{ lvl: 1 }]);
  const f = s.combat.foes[0];
  const plain = foeSwingVsHero(s, f).faces;
  assert.ok(plain > 3, "an unafraid foe hits on more than three numbers");
  assert.equal(foeWeakened(s.combat, f), false);
  f.cowering = true;
  const cow = foeSwingVsHero(s, f);
  assert.equal(cow.faces, 3, "the top three numbers: 6-8 on a d8, 18-20 on a d20");
  assert.ok(cow.mods.some((m) => m.name === "cowering"));
  assert.equal(foeWeakened(s.combat, f), true, "half damage");
  // a Weaken lands and runs out (combat.js#foeTurn's tail clears the room's fields): still cowering
  s.combat.weakened = true;
  s.combat.foeToHitPenalty = 3;
  assert.equal(foeSwingVsHero(s, f).faces, 3);
  s.combat.weakened = false;
  s.combat.foeToHitPenalty = 0;
  assert.equal(foeSwingVsHero(s, f).faces, 3, "the expiry did not clear the cower");
  assert.equal(foeWeakened(s.combat, f), true);
  // the insult comes after the cap, blind stays last
  s.combat.parleyInsulted = true;
  assert.equal(foeSwingVsHero(s, f).faces, 4);
  f.blind = true;
  assert.equal(foeSwingVsHero(s, f).faces, 1);
});

test("a cowering foe's real blow is half a plain foe's (same dice)", () => {
  const lose = (cowering) => {
    const s = spellState(null, [{ lvl: 1, cowering }]);
    // raw 2 on the die is its second-best face: a hit on the top three, never a crit; then the d6 damage die
    foeTurn(s, fakeRng([2, 4, ...ONES(40)]), []);
    return 60 - s.c.wp;
  };
  const plainLoss = lose(undefined);
  const cowLoss = lose(true);
  assert.ok(plainLoss >= 2, "the plain foe hit");
  assert.equal(cowLoss, Math.ceil(plainLoss / 2));
});

// ---------------------------------------------------------------------------
// Scroll fumbles
// ---------------------------------------------------------------------------

test("fumbles: a fumbled Door Illusion does nothing, a fumbled Chameleon Tongue insults the room, a fumbled Behemoth weakens the reader", () => {
  assert.deepEqual(SCROLL_FUMBLE["Door Illusion"], { side: "harmful", effect: "none" });
  assert.deepEqual(SCROLL_FUMBLE["Chameleon Tongue"], { side: "harmful", effect: "insulted" });
  assert.equal(SCROLL_FUMBLE["Size of the Behemoth"].side, "harmful");
  assert.equal(SCROLL_FUMBLE["Size of the Behemoth"].effect, "weakened");
  assert.deepEqual(SCROLL_FUMBLE["Size of the Behemoth"].rounds, { n: 1, sides: 4, bonus: 1 });
  assert.ok(FUMBLE_EFFECTS.harmful.includes("insulted"));

  const door = spellState(null, [{ lvl: 1 }]);
  const evDoor = resolveScrollFumble(door, SP["Door Illusion"], fakeRng([]), fakeRng([]), []);
  assert.deepEqual(evDoor, [{ type: "fumbleOnReader", spell: "Door Illusion", effect: "none" }]);
  assert.ok(door.combat, "the door doesn't open: the fight is as it was");

  const tongue = spellState(null, [{ lvl: 1 }]);
  const evTongue = resolveScrollFumble(tongue, SP["Chameleon Tongue"], fakeRng([]), fakeRng([]), []);
  assert.deepEqual(evTongue, [{ type: "fumbleOnReader", spell: "Chameleon Tongue", effect: "insulted" }]);
  assert.equal(tongue.combat.parleyInsulted, true, "the room takes it personally");
  assert.equal(tongue.combat.parleyTried, undefined, "it spends no parley");

  const beh = spellState(null, [{ lvl: 1 }]);
  const evBeh = resolveScrollFumble(beh, SP["Size of the Behemoth"], fakeRng([3]), fakeRng([]), []);
  assert.deepEqual(beh.c.foeEffect, { kind: "weakened", rounds: 4 });
  assert.deepEqual(evBeh, [{ type: "fumbleOnReader", spell: "Size of the Behemoth", effect: "weakened", rounds: 4 }]);
});
