// test/unit/joiner-defences.test.js
//
// Phase 79, quick fix 79-02b (user ruling 2026-09-27, "Joiners use only
// their own defences against foe swings"). When a foe swings at a Joiner,
// only that Joiner's OWN race, size, class/sub-class and worn gear count.
// None of the hero's personal defences (gear, the sub-class dodge/Guard,
// Mirror Self, invisibility) protect a Joiner. Effects the content calls
// party-wide stay party-wide.
//
// The bug, measured at base 90fa443: engine/derived.js#foeToHitVs(state,
// "member") read the HERO's sheet for the Acrobat override, the Guard −1,
// gear (`eff(c, "foeToHit")`), Mirror Self (`c.mirror`) and invisibility
// (`itemEffectActive(c, "invis")`), and the member branch's foe die was
// `foeDie(c, f)` — the HERO's race `foeStrikeStep`. A Joiner's own Acrobat,
// Guard, gear, mirror and Dwarven die never counted.
//
// The rule these tests pin: a Joiner is its own body, built by the SAME
// rule the hero's odds use. A hero with a given sheet and a Joiner with the
// same sheet face the same foe faces and the same foe die.

import test from "node:test";
import assert from "node:assert/strict";

import { foeSwingVsHero, foeDie, foeToHitVs, foeToHitBreakdown, PARTY_WIDE_ITEM_EFFECTS } from "../../engine/derived.js";
import { ACTIVATION_OF, STAVES, JEWELRY, CLOAKS } from "../../content/index.js";
import { foeTurn } from "../../engine/combat.js";
import { startEffect } from "../../engine/effects.js";
import { setDialsForTuning, DIALS } from "../../engine/difficulty.js";
import { heroState, withMember, inCombat, foeFrom } from "./harness/rollOdds.js";

const NEUTRAL_FOE = () => foeFrom("Humans", 1, "Ned");
const PLAIN = Object.freeze({ cls: "Fighter", sub: "Soldier", race: "Human" });

/** A body decoration: a name, the sheet it forces, and what it does to that
 * sheet once rolled (a live timer, a Mirror Self count). */
const BODIES = Object.freeze([
  { name: "plain", opts: PLAIN },
  { name: "Acrobat", opts: { cls: "Thief", sub: "Acrobat", race: "Human" } },
  { name: "Guard", opts: { cls: "Fighter", sub: "Guard", race: "Human" } },
  { name: "Elven", opts: { ...PLAIN, race: "Elven" } },
  { name: "Troll", opts: { ...PLAIN, race: "Troll" } },
  { name: "Dwarven", opts: { ...PLAIN, race: "Dwarven" } },
  { name: "Anklet", opts: PLAIN, dress: (sh) => startEffect(sh, "item:Anklet of Invisibility", { rounds: 50 }) },
  { name: "Gauntlet", opts: PLAIN, dress: (sh) => startEffect(sh, "item:Gauntlet of the Giant", { squares: 50, cd: 50 }) },
  { name: "Mirror Self", opts: PLAIN, dress: (sh) => { sh.mirror = 3; } },
  { name: "Cloak of Invisibility", opts: PLAIN, dress: (sh) => startEffect(sh, "item:Cloak of Invisibility", { squares: 50, cd: 50 }) },
  { name: "Invisible potion", opts: PLAIN, dress: (sh) => startEffect(sh, "item:Invisible", { rounds: 90 }) },
  { name: "Sidestep", opts: PLAIN, dress: (sh) => startEffect(sh, "ability:sidestep", { rounds: 2 }) },
  { name: "Smoke", opts: PLAIN, dress: (sh) => startEffect(sh, "ability:smoke", { rounds: 2 }) },
]);

/** partyState(heroBody, memberBody) — a live fight with one taunting Joiner
 * (pickFoeTarget's zero-draw taunt short-circuit), so the foe's swing
 * always takes the member branch. */
function partyState(heroBody, memberBody) {
  const s = heroState(heroBody.opts);
  if (heroBody.dress) heroBody.dress(s.c, s);
  const idx = withMember(s, memberBody.opts);
  const sheet = s.party[idx];
  // Phase 89 plan 04 (ITEM-07): a Joiner's own armour now soaks the landed
  // blow (memberStruck becomes armorSoaked on a soak). These pins are about
  // the foe's to-hit faces and die, so the pinned Joiner wears no armour and
  // its landed blow stays a memberStruck.
  sheet.ar = 0;
  sheet.armorWP = 0;
  sheet.armorMin = 0;
  if (memberBody.dress) memberBody.dress(sheet, s);
  startEffect(sheet, "ability:taunt", { rounds: 1 });
  inCombat(s, [NEUTRAL_FOE()], {
    allies: [{ partyIdx: idx, name: sheet.name, lvl: sheet.level ?? 1, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }],
  });
  return s;
}

/** memberSwing(state) — the foe's one swing at the Joiner, through foeTurn:
 * its winning faces (dieN + 1 − atLeast, read roll-high), its die, its mods
 * and the draw count. A raw 1 mirrors to the top face: a guaranteed hit. */
function memberSwing(s) {
  let draws = 0;
  const rng = {
    d() {
      draws++;
      return draws === 1 ? 1 : 3;
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
  const events = foeTurn(s, rng, []);
  const e = events.find((ev) => ev.member && (ev.type === "foeMissed" || ev.type === "memberStruck"));
  assert.ok(e, `the member swing resolved (${events.map((x) => x.type).join(",")})`);
  return { faces: e.dieN + 1 - e.atLeast, dieN: e.dieN, mods: e.mods || [], draws };
}

/** heroSwing(body) — the same body as a solo HERO: the engine's own hero
 * odds (foeSwingVsHero on foeDie), the reference a Joiner must match. */
function heroSwing(body) {
  const s = heroState(body.opts);
  if (body.dress) body.dress(s.c, s);
  const foe = NEUTRAL_FOE();
  inCombat(s, [foe]);
  return { faces: foeSwingVsHero(s, foe).faces, dieN: foeDie(s.c, foe) };
}

const PLAIN_BODY = BODIES[0];

test("a Joiner is its own body: for every race, sub-class, gear and self effect, the foe's faces and die against a Joiner equal the hero's for the same sheet", () => {
  for (const body of BODIES) {
    const asMember = memberSwing(partyState(PLAIN_BODY, body));
    const asHero = heroSwing(body);
    assert.deepEqual({ faces: asMember.faces, dieN: asMember.dieN }, asHero, `${body.name}: Joiner vs hero reference`);
  }
});

test("none of the hero's personal defences reach a Joiner: a plain Joiner reads the same faces and die whatever the hero carries", () => {
  const baseline = memberSwing(partyState(PLAIN_BODY, PLAIN_BODY));
  for (const body of BODIES) {
    const swing = memberSwing(partyState(body, PLAIN_BODY));
    assert.deepEqual({ faces: swing.faces, dieN: swing.dieN }, { faces: baseline.faces, dieN: baseline.dieN }, `hero ${body.name} leaked onto the Joiner`);
  }
});

test("the hero's Acrobat, Guard, gear, Mirror Self and invisibility leave no mod on a Joiner's swing", () => {
  for (const name of ["Acrobat", "Guard", "Anklet", "Mirror Self", "Cloak of Invisibility", "Invisible potion", "Dwarven"]) {
    const body = BODIES.find((b) => b.name === name);
    const { mods } = memberSwing(partyState(body, PLAIN_BODY));
    const leaked = mods.filter((m) => ["Acrobat", "Guard", "gear", "Mirror Self", "invisible", "Dwarven"].includes(m.name));
    assert.deepEqual(leaked, [], `hero ${name}: ${JSON.stringify(mods)}`);
  }
});

test("a Joiner's own sub-class, gear and Mirror Self are named in its own mods, as the hero's are", () => {
  // Quick 260928-nrf (user ruling 2026-09-28): the Acrobat override is four
  // faces (was three), so its delta off the plain five is −1 (was −2).
  const cases = [
    ["Acrobat", "Acrobat", -1],
    ["Guard", "Guard", -1],
    ["Anklet", "gear", -2],
    ["Mirror Self", "Mirror Self", -4],
  ];
  for (const [bodyName, modName, delta] of cases) {
    const body = BODIES.find((b) => b.name === bodyName);
    const { mods } = memberSwing(partyState(PLAIN_BODY, body));
    assert.ok(mods.some((m) => m.name === modName && m.delta === delta), `${bodyName}: ${JSON.stringify(mods)}`);
  }
});

test("a Dwarven Joiner draws the foe's better die from its OWN race; a Dwarven hero's Human Joiner does not", () => {
  const dwarf = BODIES.find((b) => b.name === "Dwarven");
  const plain = memberSwing(partyState(PLAIN_BODY, PLAIN_BODY));
  const ownDwarf = memberSwing(partyState(PLAIN_BODY, dwarf));
  const heroDwarf = memberSwing(partyState(dwarf, PLAIN_BODY));
  assert.ok(ownDwarf.dieN < plain.dieN, `a Dwarven Joiner: d${ownDwarf.dieN} vs d${plain.dieN}`);
  assert.equal(heroDwarf.dieN, plain.dieN, "the hero's Dwarven die stays on the hero");
});

test("a Thief Joiner gets its own evasion dial; a Thief hero's evasion never reaches a Fighter Joiner", () => {
  const thief = { name: "Thief", opts: { cls: "Thief", sub: "Pickpocket", race: "Human" } };
  const identity = memberSwing(partyState(PLAIN_BODY, thief));
  const identityHeroThief = memberSwing(partyState(thief, PLAIN_BODY));
  const restore = setDialsForTuning({ CLASS_MITIGATION: { Thief: { ...DIALS.CLASS_MITIGATION.Thief, evasion: 1 } } });
  try {
    const bumped = memberSwing(partyState(PLAIN_BODY, thief));
    const bumpedHeroThief = memberSwing(partyState(thief, PLAIN_BODY));
    assert.equal(bumped.faces, identity.faces - 1, "a Thief Joiner is one face harder to hit at evasion +1");
    assert.equal(bumpedHeroThief.faces, identityHeroThief.faces, "the hero's evasion stays on the hero");
  } finally {
    restore();
  }
});

test("party-wide effects stay party-wide: Battle Roar and the Crystal Staff's party invisibility still cover a Joiner", () => {
  const plain = memberSwing(partyState(PLAIN_BODY, PLAIN_BODY));
  const roar = memberSwing(partyState({ ...PLAIN_BODY, dress: (c) => startEffect(c, "ability:battleRoar", { rounds: 2 }) }, PLAIN_BODY));
  assert.equal(roar.faces, plain.faces - 2, "the hero's Battle Roar: every foe has two fewer faces that hit anyone on your side");
  const staff = memberSwing(partyState({ ...PLAIN_BODY, dress: (c) => startEffect(c, "item:Crystal Staff", { squares: 10 }) }, PLAIN_BODY));
  assert.equal(staff.faces, 1, "the hero's Crystal Staff: party invisible, foes hit only on their die's top face");
  assert.ok(staff.mods.some((m) => m.name === "invisible"), JSON.stringify(staff.mods));
});

test("a Joiner's own Sidestep sits before the Weaken cap, as the hero's does (one rule, one order)", () => {
  const sidestep = BODIES.find((b) => b.name === "Sidestep");
  const weaken = (s) => {
    s.combat.weakened = true;
    s.combat.foeToHitPenalty = 3;
    return s;
  };
  const member = memberSwing(weaken(partyState(PLAIN_BODY, sidestep)));
  const hs = heroState(sidestep.opts);
  sidestep.dress(hs.c, hs);
  const foe = NEUTRAL_FOE();
  weaken(inCombat(hs, [foe]));
  assert.equal(member.faces, foeSwingVsHero(hs, foe).faces);
});

test("zero new draws: every Joiner and hero decoration draws the same count on the member swing", () => {
  const counts = new Set();
  for (const body of BODIES) {
    counts.add(memberSwing(partyState(PLAIN_BODY, body)).draws);
    counts.add(memberSwing(partyState(body, PLAIN_BODY)).draws);
  }
  assert.deepEqual([...counts], [2]);
});

test("tolerant load: a Joiner sheet with no race row reads as a blank body (the foe's base die, 5 faces), never the hero's, and never throws", () => {
  const dwarfHero = BODIES.find((b) => b.name === "Dwarven");
  const s = partyState(dwarfHero, PLAIN_BODY);
  delete s.party[0].race;
  let swing;
  assert.doesNotThrow(() => {
    swing = memberSwing(s);
  });
  const plain = memberSwing(partyState(PLAIN_BODY, PLAIN_BODY));
  assert.deepEqual({ faces: swing.faces, dieN: swing.dieN }, { faces: 5, dieN: plain.dieN });
});

test("PARTY_WIDE_ITEM_EFFECTS names only real activations whose own content text covers the party (today: the Crystal Staff)", () => {
  const rows = [...STAVES, ...JEWELRY, ...CLOAKS];
  assert.ok(PARTY_WIDE_ITEM_EFFECTS.length >= 1);
  for (const key of PARTY_WIDE_ITEM_EFFECTS) {
    assert.ok(ACTIVATION_OF[key], `${key} is an activation key`);
    const row = rows.find((r) => r.n === key);
    assert.ok(row, `${key} is a treasure row`);
    assert.match(row.txt, /\bparty\b|\bjoiner|\beveryone\b|your side/i, `${key}'s own text must say it covers the party: "${row.txt}"`);
  }
  assert.ok(!PARTY_WIDE_ITEM_EFFECTS.includes("Cloak of Invisibility"), "the Cloak says 'invisible' for you alone");
});

test('foeToHitVs(state, "member", sheet) and its breakdown agree for every body, and a missing sheet reads as a blank body', () => {
  for (const body of BODIES) {
    const s = partyState(PLAIN_BODY, body);
    const sheet = s.party[0];
    assert.equal(foeToHitBreakdown(s, "member", sheet).need, foeToHitVs(s, "member", sheet), body.name);
  }
  const s = partyState(BODIES.find((b) => b.name === "Acrobat"), PLAIN_BODY);
  assert.equal(foeToHitVs(s, "member"), foeToHitVs(s, "member", {}), "no sheet: no hero term either");
  assert.equal(foeToHitVs(s, "member"), 5);
});
