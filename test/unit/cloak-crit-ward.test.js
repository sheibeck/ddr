// test/unit/cloak-crit-ward.test.js
//
// Quick 260928-cos (user-approved fix 2026-09-28): the Cloak of Strength
// was wired backwards. The user, on a Pixel 7: "the cloak of strength is
// supposed to stop critical hits, but I'm still getting critted. just now I
// had Braced on from my cloak, and I took a critical hit from a [wolf]."
//
// The bug: engine/combat.js#playerStrike read the cloak's `eff(c,"noCrit")`
// as the WEARER's own crit ban (the Phase 15 ECON-08 comment said so), so the
// cloak stopped the hero's crits while every foe crit still landed, and its
// chip borrowed the Fighter's "Braced" label.
//
// The rule these tests pin (content/treasure-tables.js txt: "used, no
// critical damage lands on you for fifty squares"): while the cloak's used
// effect is live, a foe's critical against the WEARER lands as an ordinary
// hit. The crit roll still happens (the draws are unchanged); only its
// doubling is dropped, and the Oracle says so. The wearer's own crits are
// untouched; Guard, Soldier and the dark keep their own-crit ban.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { foeTurn, flee, playerStrike } from "../../engine/combat.js";
import { useItem } from "../../engine/items.js";
import { conditionsOf, critWardOf, eff, noCritFor } from "../../engine/derived.js";
import { startEffect } from "../../engine/effects.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun, validateSave } from "../../engine/saveState.js";
import { ACTIVATION_OF, CLOAKS } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { HERO_CONDITIONS } from "../../src/browser/heroConditions.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Canon-mechanic damage numbers, written against identity dials.
setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SHELL = fs.readFileSync(path.resolve(__dirname, "..", "..", "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

const CLOAK = Object.freeze({ kind: "cloak", n: "Cloak of Strength", eff: { critWard: 1 }, txt: "" });

/** fakeRng(seq) — `.d()` pops the next value; throws on underflow, so an
 * exhausted sequence doubles as a "no further draw expected" assertion. */
function fakeRng(seq) {
  let i = 0;
  const rng = {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    get draws() {
      return i;
    },
  };
  return rng;
}

const noDrawRng = () => fakeRng([]);

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0,
    maxWP: 200, wp: 200, skills: {}, vp: 0,
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

function fixedFloor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Wolf", type: "Beasts", lvl: 5, size: "S", intel: 1, wp: 500, maxWP: 500, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** wearer(sub) — a hero wearing the cloak AND having used it (the real
 * useItem path; the brace-era activation drew nothing and neither does
 * this one). */
function wearer(cOverrides = {}) {
  const state = fixedState({ c: { worn: { cloak: CLOAK }, ...cOverrides } });
  const events = useItem(state, { slot: "cloak" }, noDrawRng(), []);
  assert.ok(events.some((e) => e.type === "itemEffectStarted"), "the cloak's use starts its effect");
  return state;
}

// ─── the wearer is protected ──────────────────────────────────────────────

test("a foe's top-face swing at a wearer with the cloak live lands as an ordinary hit, and the Oracle says the cloak turned it", () => {
  const state = wearer();
  state.combat = fixedCombat([fixedFoe()]);
  // to-hit raw 1 -> the foe die's top face (a crit); damage d6 = 6.
  const rng = fakeRng([1, 6]);
  const events = foeTurn(state, rng, []);
  assert.equal(rng.draws, 2, "the crit roll still happens: to-hit + one damage die, exactly as an unprotected crit");
  const warded = events.find((e) => e.type === "critWarded");
  assert.ok(warded, "a critWarded event names the save");
  assert.equal(warded.name, "Wolf");
  assert.equal(warded.item, "Cloak of Strength");
  assert.equal(warded.roll, warded.dieN, "the warded roll was the top face");
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.equal(hit.dmg, 31, "25 + 6: the dice count once, not twice");
  assert.equal(hit.critical, false, "the blow is not a critical any more");
  assert.equal(hit.critWarded, true, "the struck line carries the save");
  assert.equal(hit.critAtLeast, undefined, "no crit threshold is narrated for a warded crit");
  assert.ok(events.indexOf(warded) < events.indexOf(hit), "the save is told before the blow lands");

  const oracle = EVENT_NARRATION.critWarded(warded);
  assert.match(oracle, /Cloak of Strength/);
  assert.match(oracle, /Wolf/);
  assert.match(oracle, /critical/i);
  const rail = LINE_FOR.critWarded(warded);
  assert.match(rail.text, /Cloak of Strength/);
  assert.match(rail.text, /critical/i);
});

test("without the cloak (or worn but unused) the same top-face swing is a critical and doubles the dice", () => {
  for (const state of [fixedState(), fixedState({ c: { worn: { cloak: CLOAK } } })]) {
    state.combat = fixedCombat([fixedFoe()]);
    const rng = fakeRng([1, 6]);
    const events = foeTurn(state, rng, []);
    assert.equal(rng.draws, 2);
    const hit = events.find((e) => e.type === "struckByFoe");
    assert.equal(hit.dmg, 37, "25 + 2*6");
    assert.equal(hit.critical, true);
    assert.equal(events.some((e) => e.type === "critWarded"), false);
  }
});

test("an ordinary hit on a wearer is untouched and says nothing about the cloak", () => {
  const state = wearer();
  state.combat = fixedCombat([fixedFoe()]);
  const events = foeTurn(state, fakeRng([5, 6]), []);
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.equal(hit.dmg, 31);
  assert.equal(hit.critical, false);
  assert.equal("critWarded" in hit, false);
  assert.equal(events.some((e) => e.type === "critWarded"), false);
});

test("a Soldier wearer: the foe's second face (a crit against a Soldier) is warded too", () => {
  const state = wearer({ sub: "Soldier" });
  state.combat = fixedCombat([fixedFoe()]);
  const events = foeTurn(state, fakeRng([2, 6]), []);
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.equal(hit.dmg, 31);
  assert.equal(hit.critical, false);
  assert.equal(hit.soldierCrit, undefined);
  assert.ok(events.some((e) => e.type === "critWarded"));

  const bare = fixedState({ c: { sub: "Soldier" } });
  bare.combat = fixedCombat([fixedFoe()]);
  const bareHit = foeTurn(bare, fakeRng([2, 6]), []).find((e) => e.type === "struckByFoe");
  assert.equal(bareHit.dmg, 37, "unprotected, the Soldier's second face doubles the dice");
  assert.equal(bareHit.soldierCrit, true);
});

test("a pursuer's parting crit on a fleeing wearer is warded", () => {
  const state = wearer({ cls: "Thief", sub: "Cloaker" });
  state.combat = fixedCombat([fixedFoe({ lvl: 2, sp: { pursues: true } })]);
  const events = flee(state, fakeRng([1, 5]), []);
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.equal(hit.dmg, 9, "4 + 5, not 4 + 2*5");
  assert.equal(hit.critical, false);
  assert.ok(events.some((e) => e.type === "critWarded"));
});

test("an armour-soaked warded blow still tells the player the cloak turned the crit", () => {
  const state = wearer({ armor: "Plate", ar: 15, armorMin: 0, armorWP: 90, armorMax: 90 });
  state.combat = fixedCombat([fixedFoe()]);
  // to-hit raw 1 (crit), d6 = 6, soak d20 raw 1 -> the top face: soaked.
  const events = foeTurn(state, fakeRng([1, 6, 1]), []);
  const soaked = events.find((e) => e.type === "armorSoaked");
  assert.ok(soaked, "the armour took it");
  assert.equal(soaked.amount, 31, "the armour soaked an ordinary blow, not a doubled one");
  assert.ok(events.some((e) => e.type === "critWarded"));
});

// ─── a Joiner wearing it ──────────────────────────────────────────────────

function joinerFight(sheetExtras) {
  const sheet = { name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 200, maxWP: 200, status: "ok", ...sheetExtras };
  const state = fixedState({ party: [sheet] });
  startEffect(sheet, "ability:taunt", { rounds: 1 }); // every swing goes at Ada, zero draws
  state.combat = fixedCombat([fixedFoe()], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Knight", wp: 200, maxWP: 200 }] });
  return state;
}

test("a Joiner with the cloak's effect live takes a foe's crit as an ordinary hit; without it the crit lands", () => {
  const warded = joinerFight({ worn: { cloak: CLOAK } });
  startEffect(warded.party[0], "item:Cloak of Strength", { squares: 50, cd: 50 });
  const wRng = fakeRng([1, 6]);
  const wEvents = foeTurn(warded, wRng, []);
  assert.equal(wRng.draws, 2);
  const wHit = wEvents.find((e) => e.type === "memberStruck");
  assert.equal(wHit.dmg, 31);
  assert.equal(wHit.critical, false);
  assert.equal(wHit.critWarded, true);
  const note = wEvents.find((e) => e.type === "critWarded");
  assert.ok(note);
  assert.equal(note.member, "Ada");
  assert.equal(note.item, "Cloak of Strength");
  assert.match(EVENT_NARRATION.critWarded(note), /Ada/);

  const bare = joinerFight({});
  const bHit = foeTurn(bare, fakeRng([1, 6]), []).find((e) => e.type === "memberStruck");
  assert.equal(bHit.dmg, 37);
  assert.equal(bHit.critical, true);
});

test("the HERO's cloak does not protect a Joiner, and a Joiner's cloak does not protect the hero", () => {
  const heroCloak = joinerFight({});
  heroCloak.c.worn = { cloak: CLOAK };
  useItem(heroCloak, { slot: "cloak" }, noDrawRng(), []);
  const hit = foeTurn(heroCloak, fakeRng([1, 6]), []).find((e) => e.type === "memberStruck");
  assert.equal(hit.critical, true, "the hero's cloak is the hero's");
});

// ─── the wearer's own blows ───────────────────────────────────────────────

test("the wearer's own crits happen again: a natural top face doubles the hero's blow with the cloak live", () => {
  // strike raw 1 -> the top face (crit), Club d6 = 5: (1 + 5) * 2 = 12.
  const foeOverrides = { wp: 19, maxWP: 19, lvl: 1 };
  const state = wearer();
  state.combat = fixedCombat([fixedFoe(foeOverrides)]);
  const struck = playerStrike(state, fakeRng([1, 5, 10]), []).find((e) => e.type === "struck");
  assert.equal(struck.critical, true);
  assert.equal(struck.dmg, 12);
  assert.equal(noCritFor(state.c), false, "the gear-compare rule no longer reads the cloak as an own-crit ban");
});

test("Guard and Soldier still never crit, cloak or no cloak", () => {
  for (const sub of ["Guard", "Soldier"]) {
    for (const state of [fixedState({ c: { sub } }), wearer({ sub })]) {
      state.combat = fixedCombat([fixedFoe({ wp: 19, maxWP: 19, lvl: 1 })]);
      const struck = playerStrike(state, fakeRng([1, 5, 10, 10, 10]), []).find((e) => e.type === "struck");
      assert.ok(struck, `${sub} lands the blow`);
      assert.equal(struck.critical, false, `${sub} never crits`);
      assert.equal(noCritFor(state.c), true);
    }
  }
});

// ─── content, chip and copy ───────────────────────────────────────────────

test("content: the cloak's payload is critWard (not the own-crit noCrit), under its own activation kind", () => {
  const row = CLOAKS.find((r) => r.n === "Cloak of Strength");
  assert.deepStrictEqual(row.eff, { critWard: 1 });
  assert.match(row.txt, /no critical damage lands on you/);
  assert.deepStrictEqual(ACTIVATION_OF["Cloak of Strength"], { kind: "critWard", effect: 50, cd: 50, eff: { critWard: 1 } });
  const state = wearer();
  assert.equal(eff(state.c, "noCrit"), 0);
  assert.equal(eff(state.c, "critWard"), 1);
  assert.equal(critWardOf(state.c), "Cloak of Strength");
  assert.equal(critWardOf(fixedFighter()), null);
  assert.equal(critWardOf(null), null);
});

test("the chip: the live cloak shows its own Crit-proof chip, never Braced", () => {
  const state = wearer();
  state.combat = fixedCombat([fixedFoe()]);
  const keys = conditionsOf(state).map((cn) => cn.key);
  assert.ok(keys.includes("critWard"), "the cloak's chip key is critWard");
  assert.equal(keys.includes("brace"), false);
  assert.equal(keys.includes("braced"), false, "the Fighter's Brace chip is not borrowed");
  const entry = HERO_CONDITIONS.find((e) => e.key === "critWard");
  assert.ok(entry && entry.fight, "the chip shows in YOUR LOT (it changes a foe's blow)");
  assert.equal(HERO_CONDITIONS.some((e) => e.key === "brace"), false);

  assert.match(SHELL, /critWard:\s*\{\s*label:\s*"Crit-proof",\s*unit:\s*"sq"\s*\}/);
  assert.doesNotMatch(SHELL, /\bbrace:\s*\{\s*label:\s*"Braced"/);
  const explain = /critWard:\s*"([^"]*)"/.exec(SHELL.slice(SHELL.indexOf("const CONDITION_EXPLAIN")));
  assert.ok(explain, "a CONDITION_EXPLAIN sentence of its own");
  assert.match(explain[1], /^No critical hit lands on you/);
});

test("the use line names what the cloak does", () => {
  const e = { type: "itemEffectStarted", kind: "critWard", item: "Cloak of Strength", left: 50 };
  assert.match(EVENT_NARRATION.itemEffectStarted(e), /nothing critical landing on you/);
  assert.match(LINE_FOR.itemEffectStarted(e).text, /nothing critical landing on you/);
});

// ─── an old save ──────────────────────────────────────────────────────────

test("an old save (the cloak item still carrying eff.noCrit, its record live) loads and the ward holds", () => {
  const state = newRun(3);
  state.c.worn = { ...(state.c.worn || {}), cloak: { kind: "cloak", n: "Cloak of Strength", eff: { noCrit: 1 }, txt: "used, no critical damage lands on you for fifty squares; then fifty squares of ordinary luck" } };
  startEffect(state.c, "item:Cloak of Strength", { squares: 50, cd: 50 });
  const loaded = validateSave(JSON.stringify(serializeRun(state)));
  assert.ok(loaded.ok, loaded.reason);
  const c = loaded.value.c;
  assert.equal(c.worn.cloak.n, "Cloak of Strength");
  assert.equal(critWardOf(c), "Cloak of Strength", "the live record reads the cloak's current payload");
  assert.ok(conditionsOf(loaded.value).some((cn) => cn.key === "critWard"));
});
