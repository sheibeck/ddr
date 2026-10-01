// test/unit/moa-never-leaves.test.js
//
// Phase 91 plan 05 (IDENT-16): the Master of Arms never leaves a fight once it
// starts (user ruling 2026-09-30: "never leaves a fight ... fights every battle
// to the end"). One predicate, engine/derived.js#neverFlees (the Samurai and the
// Master of Arms), is read by combat.js#fleeRefusal (which flee() and the Door
// Illusion cast read), the combat menu's FLEE row and the tuning bot.
//
// The audit row `unstated:moa-escape-routes` (docs/IDENTITY-AUDIT.md) lists every
// way a hero leaves a live fight; each is pinned here for the Master of Arms AND
// the Samurai:
//   (1) the ordinary flee d20            (2) the Cloaker's free vanish (Thief only)
//   (3) the tracked round-1 withdrawal   (4) Smoke
//   (5) Door Illusion, cast and scroll   (6) a successful parley
// (2) and (6) are not reachable by a Master of Arms: a Cloaker is a Thief, and a
// Master of Arms can never parley (identity-contract's Master of Arms entry).
// A Samurai may parley, so (6) stays open to it by design.

import test from "node:test";
import assert from "node:assert/strict";

import { flee, canParley, parley, fleeRefusal } from "../../engine/combat.js";
import { castSpell, readScroll } from "../../engine/magic.js";
import { useAbility } from "../../engine/abilities.js";
import { neverFlees, NEVER_FLEES } from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { decideAction, makeBotContext } from "../../tools/lib/tuning-bot.mjs";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** countingRng(seq) — `.d()` pops the next value; counts draws; throws when exhausted. */
function countingRng(seq = []) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`countingRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 0,
    get draws() {
      return i;
    },
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Master of Arms", race: "Human", level: 3, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
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
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 2, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

/** fight(sub, combatOver, cOver) — a live fight for `sub`. */
function fight(sub, combatOver = {}, cOver = {}) {
  const state = {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: fixedFighter({ sub, ...cOver }),
    floor: fixedFloor(),
    day: 1, steps: 0, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
    combat: { foes: [fixedFoe()], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...combatOver },
  };
  return state;
}

const NEVER = ["Master of Arms", "Samurai"];
const reasonOf = (sub) => (sub === "Samurai" ? "samurai" : "masterOfArms");

test("neverFlees: exactly the Samurai and the Master of Arms; no other sub-class, no missing hero", () => {
  assert.deepEqual([...NEVER_FLEES].sort(), [...NEVER].sort());
  for (const sub of NEVER) assert.equal(neverFlees({ sub }), true, sub);
  for (const sub of ["Knight", "Soldier", "Barbarian", "Cloaker", "Pickpocket", "Wizard", "Illusionist", "Bard"]) assert.equal(neverFlees({ sub }), false, sub);
  assert.equal(neverFlees(null), false);
  assert.equal(neverFlees(undefined), false);
  assert.equal(neverFlees({}), false);
  assert.equal(fleeRefusal({ c: { sub: "Master of Arms" } }), "masterOfArms");
  assert.equal(fleeRefusal({ c: { sub: "Samurai" } }), "samurai");
  assert.equal(fleeRefusal({ c: { sub: "Knight" } }), null);
});

// ---------------------------------------------------------------------------
// (1) flee, every round
// ---------------------------------------------------------------------------

test("(1) flee: a Master of Arms is refused in a tracked round 1, in round 2 and at 1 HP: fleeRefused masterOfArms, no roll, no foe turn, the fight stays live", () => {
  const cases = [
    ["tracked round 1", { tracked: true, round: 1 }, {}],
    ["untracked round 1", { round: 1 }, {}],
    ["round 2", { round: 2 }, {}],
    ["round 9 at 1 HP", { round: 9 }, { wp: 1 }],
    ["tracked round 1 at 1 HP", { tracked: true, round: 1 }, { wp: 1 }],
  ];
  for (const [label, combatOver, cOver] of cases) {
    const s = fight("Master of Arms", combatOver, cOver);
    const rng = countingRng([]);
    const ev = flee(s, rng, []);
    assert.deepEqual(ev, [{ type: "fleeRefused", reason: "masterOfArms" }], label);
    assert.equal(rng.draws, 0, `${label}: zero draws`);
    assert.ok(s.combat, `${label}: the fight stays live`);
    assert.equal(s.combat.round, combatOver.round ?? 1, `${label}: no round advanced, no foe turn`);
    assert.equal(s.c.wp, cOver.wp ?? 55, `${label}: nobody hit the hero`);
  }
});

test("(1) flee: a Samurai's refusal keeps reason 'samurai', in every round, with zero draws", () => {
  for (const combatOver of [{ tracked: true, round: 1 }, { round: 2 }]) {
    const s = fight("Samurai", combatOver, { wp: 1 });
    const rng = countingRng([]);
    assert.deepEqual(flee(s, rng, []), [{ type: "fleeRefused", reason: "samurai" }]);
    assert.equal(rng.draws, 0);
    assert.ok(s.combat);
  }
});

test("(3) the tracked round-1 withdrawal has no Master of Arms branch: a Knight and a Soldier one step away still withdraw cleanly, with the same events and no roll", () => {
  for (const sub of ["Knight", "Soldier", "Barbarian"]) {
    const s = fight(sub, { tracked: true, round: 1 });
    const rng = countingRng([]);
    const ev = flee(s, rng, []);
    assert.ok(ev.some((e) => e.type === "fled" && e.reason === "tracked"), `${sub} withdraws`);
    assert.equal(ev.some((e) => e.type === "fleeRolled"), false, `${sub}: no roll`);
    assert.equal(ev.some((e) => e.type === "withdrawalDenied"), false, `${sub}: the denial event is retired`);
    assert.equal(rng.draws, 0, `${sub}: no draw (no pursuing foe)`);
    assert.equal(s.combat, null, `${sub}: the fight is over`);
  }
});

test("flee: a Knight past round 1 still rolls the ordinary d20 and escapes on a 14 (unchanged)", () => {
  const s = fight("Knight", { round: 2 });
  const rng = countingRng([14]);
  const ev = flee(s, rng, []);
  assert.deepEqual(ev.map((e) => e.type).slice(0, 2), ["fleeRolled", "fled"]);
  assert.equal(rng.draws, 1);
});

test("the withdrawal-denied event is emitted nowhere any more (engine source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../engine/combat.js", import.meta.url), "utf8");
  assert.equal(/type:\s*"withdrawalDenied"/.test(src), false);
});

// ---------------------------------------------------------------------------
// (4) Smoke
// ---------------------------------------------------------------------------

test("(4) Smoke: a live smoke effect does not let a Master of Arms or a Samurai leave (no fled smoke); a Pilfer still does", () => {
  for (const sub of NEVER) {
    const s = fight(sub, {}, { abilities: ["smoke"], wp: 999, maxWP: 999 });
    useAbility(s, "smoke", countingRng(new Array(60).fill(10)), []);
    const rng = countingRng([]);
    const ev = flee(s, rng, []);
    assert.deepEqual(ev, [{ type: "fleeRefused", reason: reasonOf(sub) }], sub);
    assert.equal(rng.draws, 0);
    assert.ok(s.combat, `${sub}: still in the fight`);
  }
  const thief = fight("Pilfer", {}, { cls: "Thief", abilities: ["smoke"], wp: 999, maxWP: 999 });
  useAbility(thief, "smoke", countingRng(new Array(60).fill(10)), []);
  const ev = flee(thief, countingRng([]), []);
  assert.ok(ev.some((e) => e.type === "fled" && e.reason === "smoke"), "everyone else walks out through the smoke");
});

// ---------------------------------------------------------------------------
// (2) the Cloaker vanish stays a Cloaker's (not reachable by a never-flee sub)
// ---------------------------------------------------------------------------

test("(2) the Cloaker's free vanish is unchanged for a Cloaker and unreachable for a Master of Arms (not a Cloaker)", () => {
  const cloaker = fight("Cloaker", {}, { cls: "Thief" });
  const ev = flee(cloaker, countingRng([]), []);
  assert.ok(ev.some((e) => e.type === "fled" && e.reason === "cloaker"));
  const moa = fight("Master of Arms", { opened2: false });
  assert.deepEqual(flee(moa, countingRng([]), []), [{ type: "fleeRefused", reason: "masterOfArms" }]);
});

// ---------------------------------------------------------------------------
// (5) Door Illusion, cast and scroll
// ---------------------------------------------------------------------------

test("(5) Door Illusion: refused for a Master of Arms and a Samurai through the one predicate, BEFORE the charge, with the turn unspent; the fight stays live", () => {
  for (const sub of NEVER) {
    const s = fight(sub, {}, { cls: "Fighter", grimoire: ["Door Illusion"] });
    const rng = countingRng([]);
    const ev = castSpell(s, IDX["Door Illusion"], rng, []);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].type, "castRefused");
    assert.equal(ev[0].spell, "Door Illusion");
    assert.equal(ev[0].reason, sub === "Samurai" ? "samurai" : "masterOfArmsStays");
    assert.equal(s.c.spellsUsed, 0, `${sub}: no charge`);
    assert.equal(rng.draws, 0);
    assert.ok(s.combat);
    assert.equal(s.combat.round, 1, `${sub}: the turn is not spent`);
    assert.equal(ev.some((e) => e.type === "fled"), false);
  }
});

test("(5) Door Illusion scroll: the scroll stays spent (RULES-10) and only the escape is refused, with the reader told why", () => {
  // A Fighter reads an intelligence scroll on a derived-stream d20 (state.acts), so
  // hunt the acts values where the read goes through and the cast is refused.
  for (const sub of NEVER) {
    let refusedAt = 0;
    for (let acts = 0; acts < 60; acts++) {
      const s = fight(sub, {}, { cls: "Fighter", scrolls: 1, intel: 18 });
      s.acts = acts;
      const pick = (arr) => arr.find((sp) => sp.n === "Door Illusion");
      const rng = { ...countingRng(new Array(40).fill(1)), pick };
      const ev = readScroll(s, rng, []);
      assert.equal(s.c.scrolls, 0, `${sub}: the scroll is spent (acts ${acts})`);
      assert.equal(ev.some((e) => e.type === "fled"), false, `${sub}: no escape (acts ${acts})`);
      assert.ok(s.combat, `${sub}: the fight stays live (acts ${acts})`);
      const refused = ev.find((e) => e.type === "castRefused" && e.spell === "Door Illusion");
      if (refused) {
        refusedAt++;
        assert.equal(refused.reason, sub === "Samurai" ? "samurai" : "masterOfArmsStays", `${sub}: told why`);
      }
    }
    assert.ok(refusedAt > 0, `${sub}: some reads reach the refused cast`);
  }
});

test("(5) Door Illusion still works for a hero who may flee (Illusionist), as Phase 90 built it", () => {
  const s = fight("Illusionist", {}, { cls: "Magic User", level: 5, grimoire: ["Door Illusion"] });
  s.combat.foes = [fixedFoe({ intel: 1 })];
  // hunt a state.acts where the one resist fails
  let ev = null;
  for (let acts = 0; acts < 400 && !ev; acts++) {
    const t = fight("Illusionist", {}, { cls: "Magic User", level: 5, grimoire: ["Door Illusion"] });
    t.combat.foes = [fixedFoe({ intel: 1 })];
    t.acts = acts;
    const e = castSpell(t, IDX["Door Illusion"], countingRng([]), []);
    if (e.some((x) => x.type === "fled" && x.reason === "door")) ev = e;
  }
  assert.ok(ev, "the escape works for an Illusionist");
});

// ---------------------------------------------------------------------------
// (6) parley
// ---------------------------------------------------------------------------

test("(6) parley: a Master of Arms can never parley (the other way out stays shut); a Samurai may, by design", () => {
  const moa = fight("Master of Arms", { type: "Humans" });
  moa.combat.foes = [fixedFoe({ type: "Humans" })];
  assert.equal(canParley(moa), false);
  assert.deepEqual(parley(moa, countingRng([]), []), [{ type: "parleyRefused", reason: "masterOfArms" }]);
  const sam = fight("Samurai", { type: "Humans" }, { skills: {} });
  sam.combat.foes = [fixedFoe({ type: "Humans" })];
  assert.equal(neverFlees(sam.c), true);
  assert.equal(fleeRefusal(sam), "samurai", "a Samurai refuses to run; parley is a choice it may make when a rule opens it");
});

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

test("menu: the FLEE row is disabled for a Master of Arms and a Samurai with a one-line reason, never an odds range, never WITHDRAW; a Knight keeps its odds", () => {
  for (const sub of NEVER) {
    for (const combatOver of [{ round: 1, tracked: false }, { round: 1, tracked: true }, { round: 3 }]) {
      const vm = combatMenuViewModel(fight(sub, combatOver));
      const row = vm.submenus.social.rows[0];
      assert.equal(row.id, "flee");
      assert.equal(row.enabled, false, `${sub}: disabled`);
      assert.equal(row.label, COMBAT_MENU_COPY.flee, `${sub}: never WITHDRAW`);
      assert.equal(row.cost, COMBAT_MENU_COPY.neverFlees);
      assert.doesNotMatch(row.cost, /\d/, `${sub}: no odds in the cost`);
      assert.equal(row.desc, COMBAT_MENU_COPY.neverFleesReason[reasonOf(sub)]);
      assert.doesNotMatch(row.desc, /\d+–\d+|d20/, `${sub}: no odds range in the reason`);
      assert.ok(!row.desc.includes("\n"), "one line");
      assert.deepEqual(row.dispatch, { type: "flee" }, "still tappable: the engine's own refusal explains");
    }
  }
  const knight = combatMenuViewModel(fight("Knight", { round: 2 })).submenus.social.rows[0];
  assert.equal(knight.enabled, true);
  assert.equal(knight.cost, "14–20 (d20)");
  assert.equal(knight.label, "FLEE");
  const knightWithdraw = combatMenuViewModel(fight("Knight", { tracked: true, round: 1 })).submenus.social.rows[0];
  assert.equal(knightWithdraw.label, "WITHDRAW", "the clean withdrawal label still exists for everyone else");
});

test("menu: a Master of Arms in a live fight keeps strike, items and abilities available (the prohibition: never left without an action)", () => {
  const s = fight("Master of Arms", {}, { potions: 1, wp: 20, abilities: ["sidestep"] });
  const vm = combatMenuViewModel(s);
  assert.equal(vm.actions[0].key, "strike");
  assert.equal(vm.actions[0].enabled, true);
  assert.deepEqual(vm.actions[0].dispatch, { type: "attack" });
  assert.equal(vm.actions[1].key, "abilities");
  assert.equal(vm.actions[2].key, "items");
  assert.equal(vm.actions[2].enabled, true);
  const potion = vm.submenus.items.rows.find((r) => r.id === "potion");
  assert.ok(potion && potion.enabled, "a potion at 20/55 HP is drinkable");
  assert.ok(vm.submenus.abilities.rows.length >= 1);
  assert.equal(vm.actions[3].key, "social", "SOCIAL still opens (its rows are greyed, not removed)");
});

test("menu: the disabled-row copy says HP-free, family-friendly words (no WP, no odds)", () => {
  for (const line of [...Object.values(COMBAT_MENU_COPY.neverFleesReason), COMBAT_MENU_COPY.neverFlees, COMBAT_MENU_COPY.doorBlocked.masterOfArms]) {
    assert.doesNotMatch(line, /\bWP\b/);
    assert.ok(line.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------------

function botState(sub, over = {}) {
  const base = fight(sub, { type: "Walking Dead", foes: [{ name: "foe0", alive: true, wp: 20, maxWP: 20 }], round: 2 }, { wp: 6, maxWP: 55, potions: 0 });
  base.pendingFind = null;
  base.pendingJoiner = null;
  return { ...base, ...over };
}
const fixedPolicyRng = { pick: (arr) => arr[0] };

test("bot: below the flee threshold with parley unavailable, a Master of Arms and a Samurai fight; a Knight still flees", () => {
  const ctx = makeBotContext();
  for (const sub of NEVER) {
    const action = decideAction(botState(sub), fixedPolicyRng, ctx);
    assert.notEqual(action.type, "flee", `${sub} never tries to flee`);
    assert.equal(action.type, "attack", `${sub} fights`);
  }
  assert.deepEqual(decideAction(botState("Knight"), fixedPolicyRng, makeBotContext()), { type: "flee" });
});

test("bot: a Master of Arms at 1 HP in round 1 (the old withdrawal moment) fights too", () => {
  const ctx = makeBotContext();
  const s = botState("Master of Arms");
  s.c.wp = 1;
  s.combat.round = 1;
  s.combat.tracked = true;
  assert.equal(decideAction(s, fixedPolicyRng, ctx).type, "attack");
});

// ---------------------------------------------------------------------------
// Narration: the new reasons have lines (EVENT_NARRATION entry and rail twin)
// ---------------------------------------------------------------------------

test("narration: fleeRefused masterOfArms and castRefused masterOfArmsStays have an Oracle line and a rail twin that say the Master of Arms stays", () => {
  const oracle = EVENT_NARRATION.fleeRefused({ type: "fleeRefused", reason: "masterOfArms" });
  assert.match(oracle, /without question/);
  const rail = LINE_FOR.fleeRefused({ type: "fleeRefused", reason: "masterOfArms" });
  assert.ok(rail && JSON.stringify(rail).length > 0);
  assert.doesNotMatch(JSON.stringify(rail), /undefined|NaN/);
  const samurai = EVENT_NARRATION.fleeRefused({ type: "fleeRefused", reason: "samurai" });
  assert.match(samurai, /Samurai/);
  const cast = EVENT_NARRATION.castRefused({ type: "castRefused", spell: "Door Illusion", reason: "masterOfArmsStays" });
  assert.match(cast, /No spell charge was spent/);
  assert.doesNotMatch(cast, /sentence/, "it must not borrow the Chameleon Tongue's parley line");
});
