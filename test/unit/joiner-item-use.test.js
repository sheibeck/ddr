// test/unit/joiner-item-use.test.js
//
// Phase 89 plan 05 (ITEM-07, item half; user 2026-09-30: "let joiners use items
// they have ... Just like players."). A Joiner wears the cloak or jewel it joins
// with, can be told (outside a fight) to drink its own healing potion or use a
// worn item through ONE engine action (memberUseItem), and its item effects
// run, tick, heal and end on its OWN sheet exactly like the hero's. The hero's
// potions, items and timers are never touched. Every refusal is its own named
// `useRefused` reason. Every roll is a derived stream, so no main-rng draw is
// added. Rulings (docs/ITEM-AUDIT.md "## Rulings"): Q2 = A (a Joiner cannot use
// the party-moving and leading items), Q3 = A (a Magic User Joiner reads its
// starting scroll on joining).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng, derivedRng } from "../../engine/rng.js";
import { rollDice, rollCheck, atLeastFor } from "../../engine/dice.js";
import { GW, GH } from "../../engine/maze.js";
import { move } from "../../engine/movement.js";
import { applyAction } from "../../engine/engine.js";
import { validateAction } from "../../engine/actions.js";
import { resolveJoiner } from "../../engine/encounters.js";
import { grantableAt } from "../../engine/character.js";
import { validateSave, rehydrate } from "../../engine/saveState.js";
import {
  memberUseItem,
  memberUseWorn,
  memberDrinkPotion,
  MEMBER_LEADER_KINDS,
  endSourceEffects,
  useItem,
  tickHealOverTime,
} from "../../engine/items.js";
import { critWardOf, canLearn, spellLevelFor } from "../../engine/derived.js";
import { serializeRun } from "../../engine/saveState.js";
import { newRun } from "../../engine/state.js";
import { ACTIVATION_OF, CLOAKS, JEWELRY, SPELLS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

// ─── helpers ────────────────────────────────────────────────────────────────

/** fakeRng(seq) — `.d()` pops the next value and THROWS on underflow, so
 * fakeRng([]) doubles as a "no main-rng draw expected" assertion. `cursor`
 * is what the derived streams read (engine code only reads getState). */
function fakeRng(seq = [], cursor = 4242) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => cursor,
    get draws() {
      return i;
    },
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, halfNext: false, worn: {},
    ...overrides,
  };
}

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, dark: false, seen: false, feat: null });
  }
  return g;
}
function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, dark: false, seen: false, feat: null, ...extra };
}

/** fixedState — the party stands on (5,5); (5,4) and (5,6) are open floor so
 * the hero can pace N/S as many squares as a test needs. */
function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = wallGrid();
  open(g, 5, 5);
  open(g, 5, 4);
  open(g, 5, 6);
  return {
    version: 1, seed: 1, rngState: 1, acts: 3,
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

const cloakRow = (name) => ({ kind: "cloak", ...CLOAKS.find((r) => r.n === name) });
const jewelRow = (name) => ({ kind: "jewel", ...JEWELRY.find((r) => r.n === name) });

/** A hand-built Joiner sheet: 10/40 hp, two potions, nothing worn. */
function joiner(overrides = {}) {
  return fixedFighter({ name: "Brom", potions: 2, wp: 10, maxWP: 40, status: "ok", ...overrides });
}

/** A state with the hero (potions 5, distinctive) and one Joiner at index 0. */
function partyState(sheetOverrides = {}, stateOverrides = {}) {
  return fixedState({ c: { potions: 5, name: "Hero" }, party: [joiner(sheetOverrides)], ...stateOverrides });
}

/** Everything a Joiner action must leave alone: the hero's sheet. */
const heroSnap = (state) => JSON.stringify(state.c);

/** The potion the engine rolls for (cursor, acts, idx, potions before). */
function potionAmount(cursor, acts, idx, before) {
  return 2 * derivedRng(cursor, "memberPotion", acts, idx, before).d(10) + 5;
}

// ─── Task 1: potion ─────────────────────────────────────────────────────────

test("potion: a Joiner out of a fight drinks one of ITS potions: 2d10+5 from a derived stream, clamped; the hero's potions never move", () => {
  const state = partyState({ wp: 10, maxWP: 40, potions: 2 });
  const hero = heroSnap(state);
  const rng = fakeRng([]);
  const events = memberUseItem(state, 0, { potion: true }, rng, []);
  const amount = potionAmount(4242, 3, 0, 2);
  assert.equal(state.party[0].wp, Math.min(40, 10 + amount));
  assert.equal(state.party[0].potions, 1);
  assert.equal(state.c.potions, 5, "the hero's potions are untouched");
  assert.equal(heroSnap(state), hero);
  assert.equal(rng.draws, 0, "no main-rng draw");
  assert.deepEqual(events, [{ type: "memberPotionDrunk", member: "Brom", amount, gained: Math.min(40, 10 + amount) - 10, remaining: 1 }]);
});

test("potion: a heal-twice race (Wilmsry) drinks double and the event says so", () => {
  const state = partyState({ race: "Wilmsry", wp: 1, maxWP: 100, potions: 1 });
  const events = memberUseItem(state, 0, { potion: true }, fakeRng([]), []);
  const amount = potionAmount(4242, 3, 0, 1) * 2;
  assert.equal(events[0].amount, amount);
  assert.equal(events[0].doubled, "Wilmsry");
  assert.equal(state.party[0].wp, 1 + amount);
});

test("potion: a draught that would overshoot heals exactly to the maximum (edge: clamp)", () => {
  const state = partyState({ wp: 39, maxWP: 40, potions: 1 });
  const events = memberUseItem(state, 0, { potion: true }, fakeRng([]), []);
  assert.equal(state.party[0].wp, 40);
  assert.equal(events[0].gained, 1);
  assert.ok(events[0].amount >= 7, "the roll itself is 2d10+5, at least 7");
});

test("potion: the derived stream varies with the acts counter and the potions left (two different drinks, two different rolls' keys)", () => {
  const seen = new Set();
  for (let acts = 0; acts < 40; acts++) seen.add(potionAmount(4242, acts, 0, 2));
  assert.ok(seen.size > 3, "the roll is keyed on the act, not a constant");
  assert.ok(seen.has(potionAmount(4242, 3, 0, 2)));
});

// ─── Task 1: refusals ───────────────────────────────────────────────────────

function refusal(state, idx, ref) {
  const before = JSON.stringify(state);
  const rng = fakeRng([]);
  const events = memberUseItem(state, idx, ref, rng, []);
  assert.equal(rng.draws, 0, "a refusal draws nothing");
  assert.equal(JSON.stringify(state), before, "a refusal changes nothing");
  return events;
}

test("refusal noMember: no party member at the index, or a downed one", () => {
  assert.deepEqual(refusal(partyState(), 3, { potion: true }), [{ type: "useRefused", reason: "noMember" }]);
  assert.deepEqual(refusal(fixedState(), 0, { potion: true }), [{ type: "useRefused", reason: "noMember" }]);
  assert.deepEqual(refusal(partyState({ status: "downed" }), 0, { potion: true }), [{ type: "useRefused", reason: "noMember" }]);
  assert.deepEqual(refusal(partyState(), -1, { potion: true }), [{ type: "useRefused", reason: "noMember" }]);
  assert.deepEqual(refusal(partyState(), 0.5, { potion: true }), [{ type: "useRefused", reason: "noMember" }]);
});

test("refusal inCombat: a fight, or a pending one, refuses: the fight runs itself", () => {
  const live = partyState({}, { combat: { foes: [], round: 1, allies: [] } });
  assert.deepEqual(refusal(live, 0, { potion: true }), [{ type: "useRefused", member: "Brom", reason: "inCombat" }]);
  const pending = partyState({}, { combat: { foes: [], round: 0, pending: true, allies: [] } });
  assert.deepEqual(refusal(pending, 0, { slot: "cloak" }), [{ type: "useRefused", member: "Brom", reason: "inCombat" }]);
});

test("refusal noPotions: a Joiner with none (edge: empty) is refused and keeps its hp", () => {
  const state = partyState({ potions: 0 });
  assert.deepEqual(refusal(state, 0, { potion: true }), [{ type: "useRefused", member: "Brom", reason: "noPotions" }]);
  const junk = partyState({ potions: undefined });
  assert.deepEqual(refusal(junk, 0, { potion: true }), [{ type: "useRefused", member: "Brom", reason: "noPotions" }]);
});

test("refusal fullHealth: a Joiner at exactly full hp (edge: adjacency) is refused and keeps its potion", () => {
  const state = partyState({ wp: 40, maxWP: 40, potions: 2 });
  assert.deepEqual(refusal(state, 0, { potion: true }), [{ type: "useRefused", member: "Brom", reason: "fullHealth" }]);
  assert.equal(state.party[0].potions, 2);
  const oneShort = partyState({ wp: 39, maxWP: 40, potions: 2 });
  const events = memberUseItem(oneShort, 0, { potion: true }, fakeRng([]), []);
  assert.equal(events[0].type, "memberPotionDrunk", "one hp short is drinkable");
});

test("a bare or unknown ref is a silent no-op (empty slot, like the hero's)", () => {
  const state = partyState();
  assert.deepEqual(refusal(state, 0, {}), []);
  assert.deepEqual(refusal(state, 0, null), []);
  assert.deepEqual(refusal(state, 0, { slot: "cloak" }), [], "an empty slot is silent");
  assert.deepEqual(refusal(state, 0, { slot: "weapon" }), [], "a Joiner wields no staff here: silent");
});

// ─── Task 1: a worn item's effect on the Joiner's own sheet ─────────────────

test("worn item: a Joiner's Cloak of Strength starts ITS OWN record with the src link; the hero's timers are untouched; itemUsed then itemEffectStarted, both with member", () => {
  const cloak = cloakRow("Cloak of Strength");
  const state = partyState({ worn: { cloak } });
  const hero = heroSnap(state);
  const rng = fakeRng([]);
  const events = memberUseItem(state, 0, { slot: "cloak" }, rng, []);
  assert.equal(rng.draws, 0);
  assert.deepEqual(state.party[0].timers["item:Cloak of Strength"], {
    cadence: "squares", left: 50, cd: 50, phase: "effect", src: { slot: "cloak", n: "Cloak of Strength" },
  });
  assert.equal(critWardOf(state.party[0]), "Cloak of Strength");
  assert.equal(critWardOf(state.c), null, "the hero is not warded");
  assert.equal(heroSnap(state), hero);
  assert.deepEqual(events.map((e) => e.type), ["itemUsed", "itemEffectStarted"]);
  assert.equal(events[0].member, "Brom");
  assert.equal(events[0].item, cloak);
  assert.deepEqual(events[1], { type: "itemEffectStarted", item: "Cloak of Strength", kind: "critWard", left: 50, cadence: "squares", member: "Brom" });
});

test("link: taking it off ends that Joiner's effect through endSourceEffects: one itemEffectEnded with member, the use spent", () => {
  const state = partyState({ worn: { cloak: cloakRow("Cloak of Strength") } });
  memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  // ten squares of walking later
  state.party[0].timers["item:Cloak of Strength"].left = 40;
  delete state.party[0].worn.cloak;
  const ev = endSourceEffects(state, state.party[0], [], { slots: ["cloak"], why: "removed" });
  assert.deepEqual(ev, [
    { type: "itemEffectEnded", item: "Cloak of Strength", kind: "critWard", slot: "cloak", why: "removed", left: 40, ready: 90, member: "Brom" },
  ]);
  assert.deepEqual(state.party[0].timers["item:Cloak of Strength"], { cadence: "squares", left: 90, phase: "cooldown" });
});

test("cooling: using it again while its record lives is refused cooldown with left, and nothing moves", () => {
  const state = partyState({ worn: { cloak: cloakRow("Cloak of Strength") } });
  memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  state.party[0].timers["item:Cloak of Strength"].left = 12;
  const events = refusal(state, 0, { slot: "cloak" });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "useRefused");
  assert.equal(events[0].reason, "cooldown");
  assert.equal(events[0].left, 12);
  assert.equal(events[0].phase, "effect");
  assert.equal(events[0].member, "Brom");
  assert.equal(events[0].item.n, "Cloak of Strength");
});

test("a Joiner's jewel works from a jewelry slot too (Ring of Power: its own record)", () => {
  const ring = jewelRow("Ring of Power");
  const state = partyState({ worn: { jewelry2: ring } });
  const events = memberUseItem(state, 0, { slot: "jewelry2" }, fakeRng([]), []);
  assert.ok(state.party[0].timers["item:Ring of Power"]);
  assert.equal(state.party[0].timers["item:Ring of Power"].src.slot, "jewelry2");
  assert.equal(events.at(-1).type, "itemEffectStarted");
  assert.equal(state.c.timers, undefined, "the hero never gains a timers map");
});

// ─── Task 1: the Q2 ruling ──────────────────────────────────────────────────

test("Q2 = A: MEMBER_LEADER_KINDS is exactly fly, ether, glow, tongue, stone, and it is frozen", () => {
  assert.deepEqual([...MEMBER_LEADER_KINDS], ["fly", "ether", "glow", "tongue", "stone"]);
  assert.ok(Object.isFrozen(MEMBER_LEADER_KINDS));
});

test("Q2 = A: a Joiner's Cloak of Flying, Cloak of Ether, Bracelet of Flight, Amulet of Light, Helm of Knowledge and Amulet of Stone are refused leaderOnly with zero draws and no change", () => {
  const items = [
    ["cloak", cloakRow("Cloak of Flying")],
    ["cloak", cloakRow("Cloak of Ether")],
    ["jewelry1", jewelRow("Bracelet of Flight")],
    ["jewelry1", jewelRow("Amulet of Light")],
    ["jewelry1", jewelRow("Helm of Knowledge")],
    ["jewelry1", jewelRow("Amulet of Stone")],
  ];
  for (const [slot, it] of items) {
    assert.ok(MEMBER_LEADER_KINDS.includes(ACTIVATION_OF[it.n].kind), `${it.n} is a leader kind`);
    const state = partyState({ worn: { [slot]: it } });
    const events = refusal(state, 0, { slot });
    assert.deepEqual(events, [{ type: "useRefused", item: it, member: "Brom", reason: "leaderOnly" }], it.n);
    assert.equal(state.party[0].timers, undefined, `${it.n} starts nothing`);
  }
  // Even in a fight (89-06's automatic path calls memberUseWorn): still leaderOnly, before combatOnly.
  const stone = jewelRow("Amulet of Stone");
  const fight = partyState({ worn: { jewelry1: stone } }, { combat: { foes: [], round: 1, allies: [] } });
  assert.equal(memberUseWorn(fight, 0, "jewelry1", fakeRng([]), []).at(-1).reason, "leaderOnly");
});

test("Q2 = A: every other use-activated cloak and jewel a Joiner can wear DOES work (only the five leader kinds are kept back)", () => {
  const rows = [
    ...CLOAKS.map((r) => ({ kind: "cloak", ...r })),
    ...JEWELRY.map((r) => ({ kind: "jewel", ...r })),
  ].filter((it) => ACTIVATION_OF[it.n]);
  let worked = 0;
  for (const it of rows) {
    const kind = ACTIVATION_OF[it.n].kind;
    if (MEMBER_LEADER_KINDS.includes(kind)) continue;
    const slot = it.kind === "cloak" ? "cloak" : "jewelry1";
    const state = partyState({ worn: { [slot]: it } });
    const events = memberUseItem(state, 0, { slot }, fakeRng([]), []);
    assert.equal(events[0]?.type, "itemUsed", `${it.n} is used`);
    assert.ok(!events.some((e) => e.type === "useRefused" || e.type === "itemFizzled"), `${it.n}: ${JSON.stringify(events)}`);
    worked++;
  }
  assert.ok(worked >= 5, `expected several usable items, got ${worked}`);
});

test("a targeted (fight-only) item outside a fight is refused combatOnly for a Joiner, after leaderOnly and before cooldown", () => {
  // No worn cloak or jewel carries a targeted kind today; a hand-built one proves the ladder.
  const real = ACTIVATION_OF["Birch Staff"];
  assert.ok(real, "the staves carry targeted activations");
  const fake = { kind: "cloak", n: "Birch Staff", slot: "cloak", eff: {} };
  const state = partyState({ worn: { cloak: fake } });
  const events = refusal(state, 0, { slot: "cloak" });
  assert.deepEqual(events, [{ type: "useRefused", item: fake, member: "Brom", reason: "combatOnly" }]);
});

// ─── Task 1: Pendant ────────────────────────────────────────────────────────

test("Pendant: a Joiner's Pendant use arms ITS halfNext { slot, n } and starts its 100-square cooldown on its own sheet", () => {
  const state = partyState({ worn: { jewelry1: jewelRow("Pendant of Fortitude") } });
  const hero = heroSnap(state);
  const events = memberUseItem(state, 0, { slot: "jewelry1" }, fakeRng([]), []);
  assert.deepEqual(state.party[0].halfNext, { slot: "jewelry1", n: "Pendant of Fortitude" });
  assert.deepEqual(state.party[0].timers["item:Pendant of Fortitude"], { cadence: "squares", left: 100, phase: "cooldown" });
  assert.equal(state.c.halfNext, false, "the hero's charge stays unarmed");
  assert.equal(heroSnap(state), hero);
  assert.deepEqual(events.map((e) => e.type), ["itemUsed"]);
});

// ─── Task 1: Pilfer ─────────────────────────────────────────────────────────

/** The first cursor whose member-pilfer d20 satisfies `want(ok)`. */
function pilferCursor(state, it, idx, acts, wantOk) {
  for (let cur = 0; cur < 5000; cur++) {
    const chk = rollCheck(derivedRng(cur, "pilferFumble", acts, it.n, "member", idx), 20, atLeastFor(19, 20));
    if (chk.ok === wantOk) return cur;
  }
  throw new Error("no cursor");
}

test("Pilfer: a Pilfer Joiner's steady hands hold (a non-1 d20): the cloak works, from the member-keyed stream", () => {
  const it = cloakRow("Cloak of Strength");
  const state = partyState({ sub: "Pilfer", cls: "Thief", worn: { cloak: it } });
  const cursor = pilferCursor(state, it, 0, 3, true);
  const events = memberUseItem(state, 0, { slot: "cloak" }, fakeRng([], cursor), []);
  assert.deepEqual(events.map((e) => e.type), ["itemUsed", "itemEffectStarted"]);
  assert.ok(state.party[0].worn.cloak);
});

test("Pilfer: a fumble (a natural 1) destroys the cloak, costs the Joiner a d10 off its own hp, ends its linked effect and names it", () => {
  const it = cloakRow("Cloak of Strength");
  const state = partyState({ sub: "Pilfer", cls: "Thief", wp: 30, worn: { cloak: it } });
  const hero = heroSnap(state);
  const cursor = pilferCursor(state, it, 0, 3, false);
  const fr = derivedRng(cursor, "pilferFumble", 3, it.n, "member", 0);
  rollCheck(fr, 20, atLeastFor(19, 20));
  const dmg = fr.d(10);
  const rng = fakeRng([], cursor);
  const events = memberUseItem(state, 0, { slot: "cloak" }, rng, []);
  assert.equal(rng.draws, 0, "no main-rng draw");
  assert.equal(state.party[0].worn.cloak, undefined, "the cloak is gone");
  assert.equal(state.party[0].wp, 30 - dmg);
  assert.equal(events[0].type, "pilferFumbled");
  assert.equal(events[0].member, "Brom");
  assert.equal(events[0].dmg, dmg);
  assert.equal(events[0].slot, "cloak");
  assert.equal(heroSnap(state), hero);
  assert.ok(!events.some((e) => e.type === "itemUsed"));
});

test("Pilfer: a fumble in a fight takes the d10 off the Joiner's C.allies entry and downs it at 0 (memberDowned after the source ends)", () => {
  const it = cloakRow("Cloak of Strength");
  const ally = { partyIdx: 0, name: "Brom", wp: 1, maxWP: 40, lvl: 1 };
  const state = partyState({ sub: "Pilfer", cls: "Thief", wp: 30, worn: { cloak: it } }, { combat: { foes: [], round: 1, allies: [ally] } });
  const cursor = pilferCursor(state, it, 0, 3, false);
  const events = memberUseWorn(state, 0, "cloak", fakeRng([], cursor), []);
  assert.equal(state.party[0].wp, 30, "the sheet syncs at endCombat, not here");
  assert.equal(state.party[0].status, "downed");
  assert.deepEqual(events.map((e) => e.type), ["pilferFumbled", "memberDowned"]);
  assert.equal(state.combat.allies.length, 0);
});

test("Pilfer: a potion never fumbles, even for a Pilfer Joiner", () => {
  const state = partyState({ sub: "Pilfer", cls: "Thief", potions: 1 });
  const events = memberUseItem(state, 0, { potion: true }, fakeRng([]), []);
  assert.equal(events[0].type, "memberPotionDrunk");
});

// ─── Task 1: the hero is untouched ──────────────────────────────────────────

test("hero untouched: useItem on the hero gives the same events and records with no sheet argument (Cloak of Strength)", () => {
  const state = fixedState({ c: { worn: { cloak: cloakRow("Cloak of Strength") } } });
  const events = useItem(state, { slot: "cloak" }, fakeRng([]), []);
  assert.deepEqual(events.map((e) => e.type), ["itemUsed", "itemEffectStarted"]);
  assert.deepEqual(events[1], { type: "itemEffectStarted", item: "Cloak of Strength", kind: "critWard", left: 50, cadence: "squares" });
  assert.equal("member" in events[1], false);
  assert.deepEqual(state.c.timers["item:Cloak of Strength"].src, { slot: "cloak", n: "Cloak of Strength" });
});

// ─── Task 1: the action ─────────────────────────────────────────────────────

test("action: validateAction accepts the potion and slot forms and rejects every malformed one", () => {
  const ok = (a) => validateAction({ type: "memberUseItem", ...a }).ok;
  assert.ok(ok({ i: 0, potion: true }));
  assert.ok(ok({ i: 1, slot: "cloak" }));
  assert.ok(ok({ i: 0, slot: "jewelry1" }));
  assert.ok(ok({ i: 0, slot: "jewelry2" }));
  assert.ok(!ok({ i: -1, potion: true }), "negative i");
  assert.ok(!ok({ i: 0.5, potion: true }), "fractional i");
  assert.ok(!ok({ potion: true }), "no i");
  assert.ok(!ok({ i: 0, potion: true, slot: "cloak" }), "both");
  assert.ok(!ok({ i: 0 }), "neither");
  assert.ok(!ok({ i: 0, slot: "weapon" }), "a Joiner wields no staff here");
  assert.ok(!ok({ i: 0, slot: "hat" }), "unknown slot");
  assert.ok(!ok({ i: 0, potion: false }), "potion must be true when present");
  assert.ok(!ok({ i: 0, potion: "yes" }), "potion must be a real true");
});

test("action: applyAction dispatches memberUseItem (potion and worn), spends no hero potion, and persists the same rng cursor", () => {
  const base = partyState({ worn: { cloak: cloakRow("Cloak of Strength") } });
  const a = applyAction(base, { type: "memberUseItem", i: 0, potion: true });
  assert.equal(a.events[0].type, "memberPotionDrunk");
  assert.equal(a.state.c.potions, 5);
  assert.equal(a.state.party[0].potions, 1);
  assert.equal(a.state.rngState, base.rngState, "no main-rng draw");
  assert.equal(a.state.acts, base.acts + 1);
  const b = applyAction(base, { type: "memberUseItem", i: 0, slot: "cloak" });
  assert.deepEqual(b.events.map((e) => e.type), ["itemUsed", "itemEffectStarted"]);
  const refused = applyAction(base, { type: "memberUseItem", i: 4, potion: true });
  assert.deepEqual(refused.events, [{ type: "useRefused", reason: "noMember" }]);
  const bad = applyAction(base, { type: "memberUseItem", i: 0 });
  assert.deepEqual(bad.events, [], "a malformed action is a no-op");
});

test("memberDrinkPotion: the internal drink spends one potion and heals through the Joiner's live body (its C.allies entry in a fight)", () => {
  const ally = { partyIdx: 0, name: "Brom", wp: 5, maxWP: 40, lvl: 1 };
  const state = partyState({ wp: 5 }, { combat: { foes: [], round: 1, allies: [ally] } });
  const events = memberDrinkPotion(state, 0, fakeRng([]), []);
  const amount = potionAmount(4242, 3, 0, 2);
  assert.equal(ally.wp, Math.min(40, 5 + amount), "the fight entry is healed");
  assert.equal(state.party[0].wp, 5, "the sheet syncs at endCombat, not here");
  assert.equal(state.party[0].potions, 1);
  assert.equal(events[0].type, "memberPotionDrunk");
});

// ─── Task 2: wear on joining ────────────────────────────────────────────────

/** A pending Joiner exactly as meetJoiner leaves it: a rollCharacter-shaped
 * sheet with NO worn map, its carried gear in the bag. */
function pending(overrides = {}) {
  const p = joiner({ name: "Pix", cls: "Thief", sub: "Pickpocket", lvl: 2, level: 2, wp: 40, potions: 2, ...overrides });
  delete p.worn;
  return p;
}

test("join: accepting a Thief Joiner whose bag holds a Cloak of Speed wears it (the same object), empties the bag slot, and says what it wore; no draw", () => {
  const cloak = cloakRow("Cloak of Speed");
  const state = fixedState({ pendingJoiner: pending({ items: [cloak] }) });
  const cursor = state.rngState;
  const events = resolveJoiner(state, true, []);
  const member = state.party[0];
  assert.equal(member.worn.cloak, cloak, "the same object, not a copy");
  assert.deepEqual(member.items, []);
  assert.deepEqual(events, [{ type: "joinerJoined", name: "Pix", sub: "Pickpocket", lvl: 2, wore: ["Cloak of Speed"] }]);
  assert.equal(state.rngState, cursor);
  assert.equal(state.pendingJoiner, null);
});

test("join: a Joiner with no cloak or jewel joins with worn {} and no wore key (edge: empty)", () => {
  const state = fixedState({ pendingJoiner: pending({ cls: "Fighter", sub: "Knight", items: [] }) });
  const events = resolveJoiner(state, true, []);
  assert.deepEqual(state.party[0].worn, {});
  assert.equal("wore" in events[0], false);
  assert.equal("scroll" in events[0], false);
});

test("join: a cloak AND a jewel are both worn; a second cloak stays in the bag (one cloak slot)", () => {
  const p = pending({ items: [cloakRow("Cloak of Speed"), jewelRow("Ring of Power"), cloakRow("Cloak of Strength")] });
  const state = fixedState({ pendingJoiner: p });
  const events = resolveJoiner(state, true, []);
  assert.equal(events[0].wore.length, 2);
  assert.ok(events[0].wore.includes("Cloak of Speed") && events[0].wore.includes("Ring of Power"));
  assert.equal(state.party[0].worn.cloak.n, "Cloak of Speed");
  assert.equal(state.party[0].worn.jewelry1.n, "Ring of Power");
  assert.deepEqual(state.party[0].items.map((i) => i.n), ["Cloak of Strength"]);
});

test("join: declining wears nothing and touches no sheet", () => {
  const state = fixedState({ pendingJoiner: pending({ items: [cloakRow("Cloak of Speed")] }) });
  const events = resolveJoiner(state, false, []);
  assert.equal(events[0].type, "joinerDeclined");
  assert.deepEqual(state.party, []);
});

test("join: swapping out the old Joiner still dresses the new one", () => {
  const state = fixedState({ party: [joiner({ name: "Old" })], pendingJoiner: pending({ items: [cloakRow("Cloak of Speed")] }) });
  const events = resolveJoiner(state, true, []);
  assert.deepEqual(events.map((e) => e.type), ["joinerLeft", "joinerJoined"]);
  assert.equal(state.party[0].name, "Pix");
  assert.equal(state.party[0].worn.cloak.n, "Cloak of Speed");
});

test("join, then use: a Joiner that joined in a cloak uses it the same turn it joins (no extra step needed)", () => {
  const state = fixedState({ pendingJoiner: pending({ items: [cloakRow("Cloak of Speed")] }) });
  resolveJoiner(state, true, []);
  const events = memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  assert.deepEqual(events.map((e) => e.type), ["itemUsed", "itemEffectStarted"]);
});

// ─── Task 2: dress saved Joiners on load ────────────────────────────────────

function saveSheet(overrides = {}) {
  return {
    cls: "Thief", sub: "Pickpocket", race: "Human", level: 1, sp: 0,
    maxWP: 40, wp: 40, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    items: [], name: "Joiny", potions: 1,
    ...overrides,
  };
}
function savedRun(party) {
  const state = newRun(3);
  state.party = party;
  return state;
}
function loadRun(state) {
  const r = validateSave(JSON.stringify(serializeRun(state)));
  assert.ok(r.ok, r.reason);
  return r.value;
}

test("load: a saved Joiner with no worn map and a cloak in its bag loads wearing it (validateSave and rehydrate)", () => {
  const cloak = cloakRow("Cloak of Speed");
  const state = savedRun([saveSheet({ items: [cloak] })]);
  const loaded = loadRun(state);
  assert.equal(loaded.party[0].worn.cloak.n, "Cloak of Speed");
  assert.deepEqual(loaded.party[0].items, []);
  const reloaded = rehydrate(JSON.parse(JSON.stringify(loaded)));
  assert.equal(reloaded.party[0].worn.cloak.n, "Cloak of Speed", "a second load changes nothing");
  // rehydrate alone (skipping validateSave) dresses too
  const direct = rehydrate(JSON.parse(JSON.stringify(serializeRun(state))));
  assert.equal(direct.party[0].worn.cloak.n, "Cloak of Speed");
});

test("load: a Joiner that already has a worn map is untouched (a bagged cloak stays bagged)", () => {
  const cloak = cloakRow("Cloak of Speed");
  const state = savedRun([saveSheet({ items: [cloak], worn: {} })]);
  const loaded = loadRun(state);
  assert.deepEqual(loaded.party[0].worn, {});
  assert.equal(loaded.party[0].items.length, 1);
});

test("load: a tampered Joiner worn map is sanitized as the hero's is (junk entries dropped, a non-object map becomes {})", () => {
  const state = savedRun([saveSheet({ worn: { cloak: "not an item", jewelry1: cloakRow("Cloak of Speed"), hat: { n: "x" } } })]);
  const loaded = loadRun(state);
  assert.deepEqual(Object.keys(loaded.party[0].worn), ["jewelry1"]);
  const tampered = savedRun([saveSheet({ worn: "999" })]);
  assert.deepEqual(loadRun(tampered).party[0].worn, {});
});

test("load: a Joiner with no cloak or jewel gains only an empty worn map (no wore list, no event)", () => {
  const loaded = loadRun(savedRun([saveSheet({ items: [] })]));
  assert.deepEqual(loaded.party[0].worn, {});
});

// ─── Task 2: Joiner item timers tick on every step ──────────────────────────

/** pace(state, n, rng) — n single-square steps N,S,N,S... returning the events. */
function pace(state, n, rng = fakeRng([])) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const dir = state.floor.py === 5 ? "N" : state.floor.py === 4 ? "S" : "N";
    move(state, dir, rng, events);
  }
  return events;
}

test("tick: a Joiner's live Cloak of Strength (left 5) fades on the 5th square with itemEffectFaded { member }, then reads ready 50 squares later with itemCooled { member }", () => {
  const state = partyState({ worn: { cloak: cloakRow("Cloak of Strength") } });
  memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  state.party[0].timers["item:Cloak of Strength"].left = 5;
  const first = pace(state, 5);
  assert.deepEqual(first.filter((e) => e.type === "itemEffectFaded"), [{ type: "itemEffectFaded", item: "Cloak of Strength", kind: "critWard", member: "Brom" }]);
  assert.equal(state.party[0].timers["item:Cloak of Strength"].phase, "cooldown");
  assert.equal(state.party[0].timers["item:Cloak of Strength"].left, 50);
  const later = pace(state, 50);
  assert.deepEqual(later.filter((e) => e.type === "itemCooled"), [{ type: "itemCooled", item: "Cloak of Strength", member: "Brom" }]);
  assert.equal(state.party[0].timers["item:Cloak of Strength"], undefined);
  assert.equal(state.c.timers, undefined, "the hero never gains a timers map");
});

test("tick ordering: on the step, the hero's item lines come before any Joiner's (Joiners in party order)", () => {
  const state = fixedState({
    c: { name: "Hero", worn: { cloak: cloakRow("Cloak of Strength") } },
    party: [joiner({ name: "A", worn: { cloak: cloakRow("Cloak of Speed") } }), joiner({ name: "B", worn: { cloak: cloakRow("Cloak of Strength") } })],
  });
  useItem(state, { slot: "cloak" }, fakeRng([]), []);
  memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  memberUseItem(state, 1, { slot: "cloak" }, fakeRng([]), []);
  state.c.timers["item:Cloak of Strength"].left = 1;
  state.party[0].timers["item:Cloak of Speed"].left = 1;
  state.party[1].timers["item:Cloak of Strength"].left = 1;
  const events = pace(state, 1).filter((e) => e.type === "itemEffectFaded");
  assert.deepEqual(events.map((e) => e.member ?? "hero"), ["hero", "A", "B"]);
});

test("water: a 2-square step ticks a Joiner's records by 2 in one call, as the hero's", () => {
  const state = partyState({ worn: { cloak: cloakRow("Cloak of Strength") } });
  state.floor.g[4][5] = { wall: false, dark: false, seen: false, feat: null, water: true };
  memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  move(state, "N", fakeRng([]), []);
  assert.equal(state.party[0].timers["item:Cloak of Strength"].left, 48);
});

test("tick: a sheet with no timers ticks nothing and never gains a timers map (edge: empty)", () => {
  const state = partyState({ worn: { cloak: cloakRow("Cloak of Strength") } });
  pace(state, 3);
  assert.equal("timers" in state.party[0], false);
  assert.equal("timers" in state.c, false);
});

test("tick: a Joiner with a junk timers value is skipped, never thrown on", () => {
  const state = partyState({ timers: [] });
  assert.doesNotThrow(() => pace(state, 2));
  const str = partyState({ timers: "x" });
  assert.doesNotThrow(() => pace(str, 2));
});

test("solo: a run with no party steps with byte-identical events and the same rng cursor (no loop, no draw)", () => {
  const solo = fixedState({ c: { worn: { cloak: cloakRow("Cloak of Strength") } } });
  useItem(solo, { slot: "cloak" }, fakeRng([]), []);
  const rng = makeRng(99);
  const before = rng.getState();
  const events = pace(solo, 6, rng);
  assert.equal(rng.getState(), before);
  assert.ok(!events.some((e) => "member" in e));
  assert.equal(solo.c.timers["item:Cloak of Strength"].left, 44);
});

// ─── Task 2: heal-over-time on a Joiner ─────────────────────────────────────

const REGEN = "Cloak of Regeneration";
const D6 = { n: 1, sides: 6, bonus: 0 };

test("heal-over-time: a hurt Joiner's own Cloak of Regeneration heals a d6 on its 10th, 20th and 30th square from the member-keyed stream; healTick carries member", () => {
  const state = partyState({ wp: 10, maxWP: 40, worn: { cloak: cloakRow(REGEN) } });
  memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  assert.equal(state.party[0].wp, 10, "no instant heal on use");
  const rng = makeRng(4242);
  const seen = [];
  for (let step = 1; step <= 30; step++) {
    const cursor = rng.getState();
    const before = state.party[0].wp;
    const heroBefore = state.c.wp;
    const events = pace(state, 1, rng);
    assert.equal(rng.getState(), cursor, `step ${step}: no main-rng draw`);
    const ticks = events.filter((e) => e.type === "healTick");
    if (step % 10 !== 0) {
      assert.equal(ticks.length, 0);
      continue;
    }
    assert.equal(ticks.length, 1);
    const k = step / 10;
    const expected = rollDice(derivedRng(cursor, "healTick", REGEN, k, state.steps, "member", 0), D6);
    assert.deepEqual(ticks[0], { type: "healTick", item: REGEN, amount: expected, gained: expected, tick: k, ticks: 3, member: "Brom" });
    assert.equal(state.party[0].wp, before + expected);
    assert.equal(state.c.wp, heroBefore, "the hero is not healed by a Joiner's cloak");
    seen.push(k);
  }
  assert.deepEqual(seen, [1, 2, 3]);
});

test("heal-over-time: a Joiner at full hp spends the tick with gained 0 (the tick still counts)", () => {
  const state = partyState({ wp: 40, maxWP: 40, worn: { cloak: cloakRow(REGEN) } });
  memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  const events = pace(state, 10, makeRng(1));
  const tick = events.find((e) => e.type === "healTick");
  assert.equal(tick.gained, 0);
  assert.equal(tick.member, "Brom");
  assert.equal(state.party[0].wp, 40);
});

test("heal-over-time: the hero's healTick key is unchanged (no member field, the original key)", () => {
  const state = fixedState({ c: { wp: 10, maxWP: 55, worn: { cloak: cloakRow(REGEN) } } });
  useItem(state, { slot: "cloak" }, fakeRng([]), []);
  const rng = makeRng(77);
  let cursor = rng.getState();
  let events = [];
  for (let i = 0; i < 10; i++) {
    cursor = rng.getState();
    events = pace(state, 1, rng);
  }
  const t = events.find((e) => e.type === "healTick");
  assert.equal(t.amount, rollDice(derivedRng(cursor, "healTick", REGEN, 1, state.steps), D6));
  assert.equal("member" in t, false);
});

test("heal-over-time: a Joiner at 0 hp is not healed (tickHealOverTime guards)", () => {
  const state = partyState({ wp: 0, maxWP: 40, worn: { cloak: cloakRow(REGEN) } });
  memberUseItem(state, 0, { slot: "cloak" }, fakeRng([]), []);
  const events = tickHealOverTime(state, 10, fakeRng([]), [], state.party[0]);
  assert.deepEqual(events, []);
});

// ─── Task 2: the Q3 ruling (a Magic User Joiner reads its scroll on joining) ─

function mageJoiner(overrides = {}) {
  return pending({ cls: "Magic User", sub: "Wizard", items: [], scrolls: 1, grimoire: [], lvl: 3, level: 3, name: "Merlo", ...overrides });
}

test("Q3 = A: a Magic User Joiner with a scroll reads it on joining: a spell it can learn at its level, from the derived stream, lands in its book; the scroll is spent; joinerJoined names it", () => {
  const state = fixedState({ pendingJoiner: mageJoiner(), rngState: 777 });
  const events = resolveJoiner(state, true, []);
  const m = state.party[0];
  assert.equal(m.scrolls, 0);
  assert.equal(m.grimoire.length, 1);
  const name = m.grimoire[0];
  const sp = SPELLS.find((s) => s.n === name);
  assert.ok(sp && canLearn("Wizard", sp) && grantableAt("Wizard", sp, 3), "a spell its sub can learn at its level");
  assert.ok(spellLevelFor("Wizard", sp) <= 3, "castable at once");
  assert.equal(events.at(-1).scroll, name);
  assert.equal(state.rngState, 777, "no main-rng state change");
  // the pick is the derived stream's, keyed on name and floor depth
  const options = SPELLS.filter((s) => grantableAt("Wizard", s, 3) && spellLevelFor("Wizard", s) <= 3);
  assert.equal(name, derivedRng(777, "joinerScroll", "Merlo", 1).pick(options).n);
});

test("Q3 = A: a spell already in the book is never the pick; with nothing learnable the scroll is still spent and scroll is null", () => {
  const all = SPELLS.filter((s) => grantableAt("Wizard", s, 3) && spellLevelFor("Wizard", s) <= 3).map((s) => s.n);
  const full = fixedState({ pendingJoiner: mageJoiner({ grimoire: [...all] }) });
  const ev = resolveJoiner(full, true, []);
  assert.equal(ev.at(-1).scroll, null);
  assert.equal(full.party[0].scrolls, 0);
  assert.equal(full.party[0].grimoire.length, all.length);
  const one = fixedState({ pendingJoiner: mageJoiner({ grimoire: all.slice(1) }) });
  assert.equal(resolveJoiner(one, true, []).at(-1).scroll, all[0], "the only spell the book lacks");
});

test("Q3 = A: only a Magic User with a scroll reads one; a Fighter, a Thief, or a mage with none joins with no scroll key", () => {
  for (const p of [pending({ cls: "Fighter", sub: "Knight", scrolls: 0 }), pending({ scrolls: 0 }), mageJoiner({ scrolls: 0 })]) {
    const events = resolveJoiner(fixedState({ pendingJoiner: p }), true, []);
    assert.equal("scroll" in events[0], false);
  }
});

test("Q3 = A: the same state and Joiner always read the same spell (deterministic)", () => {
  const read = (depth) => {
    const s = fixedState({ pendingJoiner: mageJoiner(), rngState: 5, floor: { depth } });
    return resolveJoiner(s, true, []).at(-1).scroll;
  };
  assert.equal(read(2), read(2));
});
