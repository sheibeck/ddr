// test/unit/joiner-combat-items.test.js
//
// Phase 89 plan 06 (ITEM-07, the in-fight half; user 2026-09-30: "let joiners
// use items they have ... Just like players."). On its own turn in a fight a
// Joiner uses its items automatically, by the class policy's own shape
// (engine/combat.js#pickMemberAbility): in ROUND 1 it first uses a ready worn
// item with a timed effect (a FREE use, as the hero's item uses are free
// actions) and then takes its normal turn; at or below ONE THIRD of its HP it
// drinks one of its own potions INSTEAD of swinging, casting or using an
// ability (the hero's potion costs the hero's turn too). A Joiner under its
// own Speed swings twice on a plain strike, as the hero's haste does. The
// decisions draw nothing; the potion and a Pilfer fumble come from derived
// streams. Ruling Q2 (docs/ITEM-AUDIT.md): the six party-moving and leading
// items (fly, ether, glow, tongue, stone kinds) stay the leader's.

import test from "node:test";
import assert from "node:assert/strict";

import { alliesTurn, pickMemberItem, MEMBER_COMBAT_KINDS } from "../../engine/combat.js";
import { startEffect, startCooldown } from "../../engine/effects.js";
import { MEMBER_LEADER_KINDS } from "../../engine/items.js";
import { ACTIVATION_OF, CLOAKS, JEWELRY, ABILITY_BY_ID } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

// ─── helpers ────────────────────────────────────────────────────────────────

const MISS = 20; // roll-high: a raw 20 mirrors to the bottom face, a miss
const HIT = 1; // a raw 1 mirrors to the top face, a landed (crit) blow

/** fakeRng(seq) — `.d()` pops the next value and THROWS on underflow; `draws`
 * is how many the code consumed. `getState` is what derived streams read. */
function fakeRng(seq = [], cursor = 4242) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
    getState: () => cursor,
    get draws() {
      return i;
    },
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

const cloakRow = (name) => ({ kind: "cloak", ...CLOAKS.find((r) => r.n === name) });
const jewelRow = (name) => ({ kind: "jewel", ...JEWELRY.find((r) => r.n === name) });

/** A Joiner sheet: a classed Knight with a Club, 30 hp, two potions, nothing worn. */
function member(overrides = {}) {
  return {
    name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 30, maxWP: 30, status: "ok",
    weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0,
    potions: 2, worn: {},
    ...overrides,
  };
}

/** The combat-scoped entry startCombat's sync would make for `sheet`. */
const allyFor = (sheet, idx = 0, extra = {}) => ({ partyIdx: idx, name: sheet.name, lvl: sheet.level ?? 1, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP, ...extra });

/** A live fight with the given Joiner sheets, each synced into C.allies. */
function fightWith(sheets, { foes = [fixedFoe()], round = 1 } = {}) {
  const state = {
    version: 1, seed: 1, rngState: 1, acts: 5,
    c: fixedFighter({ potions: 7 }), floor: fixedFloor(),
    day: 1, steps: 0, store: null, beats: null, party: sheets,
    dead: false, deathNote: "", epitaph: "",
  };
  state.combat = {
    foes, type: foes[0]?.type || "Humans", round, target: 0, pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
    allies: sheets.map((s, i) => allyFor(s, i)),
  };
  return state;
}

const types = (events) => events.map((e) => e.type);
const count = (events, type) => events.filter((e) => e.type === type).length;
const swings = (events) => count(events, "allyMissed") + count(events, "allyStruck");

// ─── the list and the pick (pure) ───────────────────────────────────────────

test("MEMBER_COMBAT_KINDS: the bot's round-1 buff list plus invis and half, frozen, none of them a leader kind (Q2), no stone", () => {
  assert.deepEqual([...MEMBER_COMBAT_KINDS], ["haste", "critWard", "plate", "unseen", "power", "giant", "invis", "half"]);
  assert.ok(Object.isFrozen(MEMBER_COMBAT_KINDS));
  for (const k of MEMBER_COMBAT_KINDS) {
    assert.ok(!MEMBER_LEADER_KINDS.includes(k), `${k} is a leader kind`);
    assert.ok(Object.values(ACTIVATION_OF).some((a) => a.kind === k), `${k} is a real activation kind`);
  }
  assert.ok(!MEMBER_COMBAT_KINDS.includes("stone"), "Q2 keeps the Amulet of Stone for the leader");
  assert.ok(!MEMBER_COMBAT_KINDS.includes("knit"), "Regeneration heals only by walking: not a fight item");
});

test("pickMemberItem: the first ready worn item of a combat kind, in WORN_SLOTS order; null for nothing worn, cooling, live or leader-only", () => {
  const cloak = cloakRow("Cloak of Strength");
  const ring = jewelRow("Ring of Power");
  // jewelry1 precedes cloak in WORN_SLOTS
  let s = fightWith([member({ worn: { cloak, jewelry1: ring } })]);
  assert.equal(pickMemberItem(s, 0), "jewelry1");
  s = fightWith([member({ worn: { cloak } })]);
  assert.equal(pickMemberItem(s, 0), "cloak");

  // nothing worn, no worn map, a bad index: null, never a throw
  assert.equal(pickMemberItem(fightWith([member()]), 0), null);
  assert.equal(pickMemberItem(fightWith([member({ worn: undefined })]), 0), null);
  assert.equal(pickMemberItem(fightWith([member()]), 4), null);
  assert.equal(pickMemberItem({ party: null }, 0), null);

  // cooling: skipped, the next slot is offered
  s = fightWith([member({ worn: { cloak, jewelry1: ring } })]);
  startCooldown(s.party[0], "item:Ring of Power", { squares: 50 });
  assert.equal(pickMemberItem(s, 0), "cloak");
  // live: skipped
  s = fightWith([member({ worn: { cloak } })]);
  startEffect(s.party[0], "item:Cloak of Strength", { squares: 50, cd: 50 });
  assert.equal(pickMemberItem(s, 0), null);
  // the same KIND already live from another source: skipped
  s = fightWith([member({ worn: { cloak: cloakRow("Cloak of Speed") } })]);
  startEffect(s.party[0], "item:Speed", { rounds: 50 });
  assert.equal(ACTIVATION_OF["Speed"]?.kind, "haste", "the Speed potion's record is a haste kind");
  assert.equal(pickMemberItem(s, 0), null);
  // leader-only kinds are never picked (Q2)
  for (const row of [cloakRow("Cloak of Flying"), cloakRow("Cloak of Ether")]) {
    assert.equal(pickMemberItem(fightWith([member({ worn: { cloak: row } })]), 0), null, row.n);
  }
  for (const n of ["Amulet of Light", "Helm of Knowledge", "Bracelet of Flight", "Amulet of Stone"]) {
    assert.equal(pickMemberItem(fightWith([member({ worn: { jewelry1: jewelRow(n) } })]), 0), null, n);
  }
  // the Regeneration cloak heals only by walking: not picked
  assert.equal(pickMemberItem(fightWith([member({ worn: { cloak: cloakRow("Cloak of Regeneration") } })]), 0), null);
  // an armed Pendant is live: not picked again
  s = fightWith([member({ worn: { jewelry1: jewelRow("Pendant of Fortitude") } })]);
  assert.equal(pickMemberItem(s, 0), "jewelry1");
  s.party[0].halfNext = { slot: "jewelry1", n: "Pendant of Fortitude" };
  assert.equal(pickMemberItem(s, 0), null);
});

test("pickMemberItem is pure: it draws nothing and changes nothing", () => {
  const s = fightWith([member({ worn: { cloak: cloakRow("Cloak of Strength") } })]);
  const before = JSON.stringify(s);
  pickMemberItem(s, 0);
  assert.equal(JSON.stringify(s), before);
});

// ─── the one-third potion ───────────────────────────────────────────────────

test("potion: a Joiner at exactly one third of its HP drinks one of ITS potions instead of swinging; its C.allies hp rises; the hero's potions never move", () => {
  const s = fightWith([member({ wp: 10, maxWP: 30, potions: 2 })]);
  const rng = fakeRng([]); // no main-rng draw: the potion is a derived stream
  const events = alliesTurn(s, rng, []);
  assert.equal(rng.draws, 0);
  assert.deepEqual(types(events), ["memberPotionDrunk"]);
  assert.equal(events[0].member, "Ada");
  assert.equal(s.party[0].potions, 1);
  assert.equal(s.c.potions, 7, "the hero's potions are untouched");
  assert.equal(s.combat.allies[0].wp, 10 + events[0].gained);
  assert.ok(s.combat.allies[0].wp > 10);
  assert.equal(swings(events), 0, "its turn is spent: no strike");
});

test("potion edge (adjacency): one HP above one third acts normally; exactly one third drinks", () => {
  const above = fightWith([member({ wp: 11, maxWP: 30 })]);
  const a = alliesTurn(above, fakeRng([MISS]), []);
  assert.equal(count(a, "memberPotionDrunk"), 0);
  assert.equal(swings(a), 1);
  assert.equal(above.party[0].potions, 2, "no potion spent");

  const at = fightWith([member({ wp: 10, maxWP: 30 })]);
  assert.equal(count(alliesTurn(at, fakeRng([]), []), "memberPotionDrunk"), 1);

  // a maximum that does not divide by three: 10 of 31 is under a third, 11 of 32 is not (10.67)
  assert.equal(count(alliesTurn(fightWith([member({ wp: 10, maxWP: 31 })]), fakeRng([]), []), "memberPotionDrunk"), 1);
  assert.equal(count(alliesTurn(fightWith([member({ wp: 11, maxWP: 32 })]), fakeRng([MISS]), []), "memberPotionDrunk"), 0);
});

test("potion edge (empty): below one third with no potions left acts normally", () => {
  for (const potions of [0, undefined]) {
    const s = fightWith([member({ wp: 5, maxWP: 30, potions })]);
    const events = alliesTurn(s, fakeRng([MISS]), []);
    assert.equal(count(events, "memberPotionDrunk"), 0);
    assert.equal(swings(events), 1);
  }
});

test("potion comes before an ability: a low Joiner with a ready opener drinks instead of using it", () => {
  const opener = Object.values(ABILITY_BY_ID).find((m) => m.cls === "Fighter" && m.tag === "opener" && m.target === "self");
  assert.ok(opener, "a Fighter opener exists");
  const s = fightWith([member({ wp: 8, maxWP: 30, abilities: [opener.id] })]);
  const events = alliesTurn(s, fakeRng([]), []);
  assert.deepEqual(types(events), ["memberPotionDrunk"]);
  assert.equal(s.party[0].timers?.[`ability:${opener.id}`], undefined, "the ability was not spent");
});

test("potion comes before a Magic User's cast: a low caster drinks instead of casting, and keeps its charge", () => {
  const s = fightWith([member({ cls: "Magic User", sub: "Wizard", weapon: "Quarter Staff", prof: 0, grimoire: ["Freeze"], wp: 9, maxWP: 30 })]);
  const events = alliesTurn(s, fakeRng([]), []);
  assert.deepEqual(types(events), ["memberPotionDrunk"]);
  assert.equal(s.party[0].spellsUsed, 0);
});

test("potion: a downed Joiner (wp 0) takes no turn and drinks nothing", () => {
  const s = fightWith([member({ wp: 0, maxWP: 30 })]);
  s.combat.allies[0].wp = 0;
  const events = alliesTurn(s, fakeRng([]), []);
  assert.deepEqual(events, []);
  assert.equal(s.party[0].potions, 2);
});

// ─── the round-1 worn item ──────────────────────────────────────────────────

test("round 1: a Joiner wearing a ready Cloak of Strength uses it (free), THEN strikes in the same turn; zero main-rng draws for the use", () => {
  const s = fightWith([member({ worn: { cloak: cloakRow("Cloak of Strength") } })]);
  const rng = fakeRng([MISS]); // exactly the strike's one draw
  const events = alliesTurn(s, rng, []);
  assert.equal(rng.draws, 1);
  assert.deepEqual(types(events), ["itemUsed", "itemEffectStarted", "allyMissed"]);
  assert.equal(events[0].member, "Ada");
  assert.equal(events[0].item.n, "Cloak of Strength");
  assert.equal(events[1].member, "Ada");
  assert.equal(events[1].kind, "critWard");
  assert.ok(s.party[0].timers["item:Cloak of Strength"], "the effect is live on the Joiner's own sheet");
  assert.equal(s.c.timers?.["item:Cloak of Strength"], undefined, "never on the hero");
});

test("round 2: the Joiner does not use a ready worn item again", () => {
  const s = fightWith([member({ worn: { cloak: cloakRow("Cloak of Strength") } })], { round: 2 });
  const events = alliesTurn(s, fakeRng([MISS]), []);
  assert.deepEqual(types(events), ["allyMissed"]);
});

test("round 1: a cooling item, an item whose kind is already live, and a leader-only kind are skipped with zero draws and no refusal event", () => {
  const cooling = fightWith([member({ worn: { cloak: cloakRow("Cloak of Strength") } })]);
  startCooldown(cooling.party[0], "item:Cloak of Strength", { squares: 30 });
  const live = fightWith([member({ worn: { cloak: cloakRow("Cloak of Strength") } })]);
  startEffect(live.party[0], "item:Cloak of Strength", { squares: 30, cd: 50 });
  const flying = fightWith([member({ worn: { cloak: cloakRow("Cloak of Flying") } })]);
  const stone = fightWith([member({ worn: { jewelry1: jewelRow("Amulet of Stone") } })]);
  for (const [name, s] of [["cooling", cooling], ["live", live], ["flying (leader-only)", flying], ["stone (leader-only)", stone]]) {
    const rng = fakeRng([MISS]);
    const events = alliesTurn(s, rng, []);
    assert.deepEqual(types(events), ["allyMissed"], name);
    assert.equal(rng.draws, 1, name);
  }
});

test("round 1: a Joiner with nothing worn draws nothing extra and acts as before", () => {
  const s = fightWith([member()]);
  const rng = fakeRng([MISS]);
  const events = alliesTurn(s, rng, []);
  assert.deepEqual(types(events), ["allyMissed"]);
  assert.equal(rng.draws, 1);
});

test("round 1 with a LOW Joiner: the free item use first, then the potion instead of the strike", () => {
  const s = fightWith([member({ wp: 9, maxWP: 30, worn: { cloak: cloakRow("Cloak of Strength") } })]);
  const events = alliesTurn(s, fakeRng([]), []);
  assert.deepEqual(types(events), ["itemUsed", "itemEffectStarted", "memberPotionDrunk"]);
});

test("round 1: the Pendant of Fortitude is armed on the Joiner's own sheet (a free use), then the turn goes on", () => {
  const s = fightWith([member({ worn: { jewelry1: jewelRow("Pendant of Fortitude") } })]);
  const events = alliesTurn(s, fakeRng([MISS]), []);
  assert.deepEqual(types(events), ["itemUsed", "allyMissed"]);
  assert.deepEqual(s.party[0].halfNext, { slot: "jewelry1", n: "Pendant of Fortitude" });
});

test("round 1: a Joiner with an item AND an ability: the item line comes before the ability's (ordering)", () => {
  const opener = Object.values(ABILITY_BY_ID).find((m) => m.cls === "Fighter" && m.tag === "opener" && m.target === "self");
  const s = fightWith([member({ abilities: [opener.id], worn: { cloak: cloakRow("Cloak of Strength") } })]);
  const events = alliesTurn(s, fakeRng([MISS, MISS, MISS, MISS]), []);
  assert.equal(events[0].type, "itemUsed");
  assert.equal(events[1].type, "itemEffectStarted");
  assert.ok(events.length > 2, "the ability's own lines follow");
  assert.equal(swings(events), 0, "the ability took the turn, not a plain strike");
});

test("ordering: allies act in C.allies order; a second Joiner's item and strike lines follow the first's", () => {
  const a = member({ name: "Ada", worn: { cloak: cloakRow("Cloak of Strength") } });
  const b = member({ name: "Bea", worn: { cloak: cloakRow("Cloak of Invisibility") } });
  const s = fightWith([a, b]);
  const events = alliesTurn(s, fakeRng([MISS, MISS]), []);
  assert.deepEqual(
    events.map((e) => `${e.type}:${e.member ?? e.name ?? ""}`),
    ["itemUsed:Ada", "itemEffectStarted:Ada", "allyMissed:Ada", "itemUsed:Bea", "itemEffectStarted:Bea", "allyMissed:Bea"],
  );
});

test("a Pilfer Joiner's jewel use can fumble: the roll comes from a derived stream, the main rng draws nothing for it, a fall ends its turn", () => {
  // Find a derived stream that fumbles: sweep acts until the engine's own roll fumbles.
  let fumbled = null;
  for (let acts = 0; acts < 400 && !fumbled; acts++) {
    const s = fightWith([member({ sub: "Pilfer", cls: "Thief", worn: { jewelry1: jewelRow("Ring of Power") } })]);
    s.acts = acts;
    const rng = fakeRng([MISS]);
    const events = alliesTurn(s, rng, []);
    if (events.some((e) => e.type === "pilferFumbled")) fumbled = { s, events, rng };
  }
  assert.ok(fumbled, "a fumble occurs somewhere in 400 derived streams (1 in 20 by the d20 steady-hands check)");
  assert.ok(fumbled.events.some((e) => e.type === "pilferFumbled" && e.member === "Ada"));
  assert.equal(fumbled.s.party[0].worn.jewelry1, undefined, "the jewel is gone");
  assert.equal(fumbled.events.some((e) => e.type === "itemUsed"), false, "a fumbled use is not a use");
  assert.equal(fumbled.rng.draws <= 1, true, "the fumble itself drew nothing from the main rng");
});

// ─── Speed ──────────────────────────────────────────────────────────────────

test("Speed: a Joiner with its own live haste makes two swings at the same target on a plain strike", () => {
  const s = fightWith([member()]);
  startEffect(s.party[0], "item:Cloak of Speed", { squares: 50 });
  const rng = fakeRng([MISS, MISS]);
  const events = alliesTurn(s, rng, []);
  assert.equal(rng.draws, 2);
  assert.deepEqual(types(events), ["allyMissed", "allyMissed"]);
  assert.ok(events.every((e) => e.target === "Target"));
});

test("Speed: without a live haste the Joiner swings once; the hero's haste does not reach a Joiner", () => {
  const s = fightWith([member()]);
  startEffect(s.c, "item:Cloak of Speed", { squares: 50 });
  const events = alliesTurn(s, fakeRng([MISS]), []);
  assert.equal(swings(events), 1);
});

test("Speed: the second swing is skipped when the first kills the target", () => {
  const foe = fixedFoe({ wp: 1, maxWP: 1 });
  const s = fightWith([member()], { foes: [foe, fixedFoe({ name: "Other" })] });
  startEffect(s.party[0], "item:Cloak of Speed", { squares: 50 });
  const events = alliesTurn(s, fakeRng([HIT, ...new Array(30).fill(MISS)]), []);
  assert.equal(foe.alive, false);
  assert.equal(count(events, "allyStruck"), 1, "one landed blow, no second swing");
  assert.equal(swings(events), 1);
});

test("Speed: a first swing that misses is followed by a second at the SAME target (it keeps the one target)", () => {
  const first = fixedFoe({ wp: 40, maxWP: 40 });
  const second = fixedFoe({ name: "Other", wp: 40, maxWP: 40 });
  const s = fightWith([member()], { foes: [first, second] });
  startEffect(s.party[0], "item:Cloak of Speed", { squares: 50 });
  const events = alliesTurn(s, fakeRng([MISS, MISS]), []);
  assert.deepEqual(events.map((e) => e.target), ["Target", "Target"]);
});

test("Speed: a hasted Magic User's cast is single, as the hero's cast is", () => {
  const s = fightWith([member({ cls: "Magic User", sub: "Wizard", weapon: "Quarter Staff", prof: 0, grimoire: ["Freeze"], potions: 0 })]);
  startEffect(s.party[0], "item:Cloak of Speed", { squares: 50 });
  const rng = fakeRng([5, 4, 3]);
  const events = alliesTurn(s, rng, []);
  assert.equal(count(events, "allyCast"), 1);
  assert.equal(s.party[0].spellsUsed, 1);
});

test("Speed: a hasted Magic User with nothing to cast swings its staff twice", () => {
  const s = fightWith([member({ cls: "Magic User", sub: "Wizard", weapon: "Quarter Staff", prof: 0, grimoire: [], potions: 0 })]);
  startEffect(s.party[0], "item:Cloak of Speed", { squares: 50 });
  const events = alliesTurn(s, fakeRng([MISS, MISS]), []);
  assert.equal(swings(events), 2);
});

test("Speed: a hasted Fighter's ability is single (the swing count is for a plain strike only)", () => {
  const opener = Object.values(ABILITY_BY_ID).find((m) => m.cls === "Fighter" && m.tag === "opener" && m.target === "self");
  const s = fightWith([member({ abilities: [opener.id] })]);
  startEffect(s.party[0], "item:Cloak of Speed", { squares: 50 });
  const events = alliesTurn(s, fakeRng([MISS, MISS, MISS, MISS]), []);
  assert.equal(swings(events), 0, "the ability took the turn: no plain strikes at all");
});

test("Speed from the round-1 item itself: a Joiner that puts on its Cloak of Speed swings twice the same turn", () => {
  const s = fightWith([member({ worn: { cloak: cloakRow("Cloak of Speed") } })]);
  const events = alliesTurn(s, fakeRng([MISS, MISS]), []);
  assert.deepEqual(types(events), ["itemUsed", "itemEffectStarted", "allyMissed", "allyMissed"]);
});

// ─── solo, legacy, determinism ──────────────────────────────────────────────

test("solo: a fight with no C.allies returns at once, drawing nothing", () => {
  const s = fightWith([]);
  s.combat = { foes: [fixedFoe()], round: 1, target: 0, pending: false };
  const rng = fakeRng([]);
  assert.deepEqual(alliesTurn(s, rng, []), []);
  assert.equal(rng.draws, 0);
});

test("a legacy C.allies entry (no persistent sheet) takes the old strike and never reads items", () => {
  const s = fightWith([member({ worn: { cloak: cloakRow("Cloak of Strength") } })]);
  s.party = [];
  const events = alliesTurn(s, fakeRng([MISS]), []);
  assert.deepEqual(types(events), ["allyMissed"]);
});

test("the policy is deterministic: the same state and rng give the same events twice", () => {
  const mk = () => fightWith([member({ wp: 9, maxWP: 30, worn: { cloak: cloakRow("Cloak of Strength") } })]);
  const a = alliesTurn(mk(), fakeRng([], 99), []);
  const b = alliesTurn(mk(), fakeRng([], 99), []);
  assert.deepEqual(a, b);
});
