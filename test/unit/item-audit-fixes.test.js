// test/unit/item-audit-fixes.test.js
//
// Phase 89 plan 08 (ITEM-01, ITEM-06): one pin per engine row or ruling the
// item audit (docs/ITEM-AUDIT.md) handed to plan 89-08. Every test name
// carries the row's item (or system) name, and the last test parses the audit
// table and fails if a row owned by 89-08 has no test named after it.
//
// The rulings built here (docs/ITEM-AUDIT.md "## Rulings", user 2026-09-30):
//   Q1  no floor-12 special effects on the Amulet of Stone, Oak, Cedar, Birch
//       and Walnut staves; ONE depth-rising resist for every item or staff
//       effect a foe can resist (derived.js#risingResistFaces)
//   Q4  A: each store offers a repair line per Joiner's worn armour
//   Q5  A: each cure potion cures only its own kind; the wrong kind, or none,
//       is refused and the potion kept
//   Q6  B: the Walnut Staff casts the full Weaken
//
// Text-only rows this plan found (Cedar Staff's "3 squares" reach: the engine
// already reaches every foe and a fight holds at most three) move to 89-09.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { useItem, CURE_KIND_OF } from "../../engine/items.js";
import { foeResistsEffect, foeResistsSpell } from "../../engine/combat.js";
import { risingResistFaces, foeRisingResistCheck, foeSpellResistCheck, resistFaces, foeWeakened, RISING_RESIST_CEILING } from "../../engine/derived.js";
import { controlResistFacesFor } from "../../engine/difficulty.js";
import { openStore, buyFrom, priceFor, memberArmourToMend, memberRepairRefusal, STORE_EFFECTS } from "../../engine/economy.js";
import { serializeRun, validateSave } from "../../engine/saveState.js";
import { startEffect } from "../../engine/effects.js";
import { JEWELRY, STAVES, POTIONS, AFFLICTIONS, TREASURE_ACTIVATION_OF } from "../../content/index.js";
import { makeRng } from "../../engine/rng.js";
import { GW, GH } from "../../engine/maze.js";
import { renderStoreScreen } from "../../src/browser/storeScreen.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const NOW = () => 12345;

// --- scripted states (the usable-features-audit helpers) --------------------

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 5, sp: 0,
    maxWP: 9999, wp: 9999, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 6, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, songAt: -999,
    ...overrides,
  };
}
function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}
function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    party: [], pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}
const fixedFoe = (overrides = {}) => ({ name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides });
const fixedCombat = (foes, overrides = {}) => ({ foes, type: foes[0]?.type || "Humans", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides });
const threeFoes = () => [fixedFoe({ name: "Ann" }), fixedFoe({ name: "Bo" }), fixedFoe({ name: "Cy" })];

/** A scripted fight at `depth` with `foes`, the hero a Magic User wielding staff `staffName`. */
function staffFight(staffName, depth, foes, cOverrides = {}) {
  const item = { kind: "staff", n: staffName, use: STAVES.find((s) => s.n === staffName).use, charges: TREASURE_ACTIVATION_OF[staffName].charges };
  const state = fixedState({ c: { cls: "Magic User", weapon: staffName, staff: item, items: [], ...cOverrides }, floor: { depth } });
  state.combat = fixedCombat(foes);
  return state;
}
const useStaff = (state, seed) => {
  const rng = makeRng(seed);
  const events = useItem(state, { slot: "weapon" }, rng, [], NOW);
  return { events, rng };
};
const resistEvents = (events) => events.filter((e) => e.type === "spellResisted" || e.type === "resistFailed");
const noFloor12Events = (events) => events.filter((e) => e.type === "controlResisted" || e.type === "controlHeld");

/** Runs `fn(seed)` over seeds 1..N and returns the results (scripted outcomes vary by seed). */
const seeds = (n, fn) => Array.from({ length: n }, (_, i) => fn(i + 1));

// ============================================================================
// The shared depth-rising resist (Q1, user 2026-09-30)
// ============================================================================

test("depth-rising resist: one roll that keeps the old two-chance odds (half-intel faces a, floor faces c: a + c - a*c/20), capped at 19", () => {
  // At or below floor 12 the floor adds nothing: exactly resistFaces(intel).
  for (const depth of [1, 5, 12]) for (const intel of [0, 1, 6, 10, 20]) assert.equal(risingResistFaces(depth, intel), resistFaces(intel), `floor ${depth}, intel ${intel}`);
  // Past it the floor's faces (controlResistFacesFor: +1 per floor, dial cap 15) fold in.
  assert.equal(risingResistFaces(13, 10), 6); // 5 + 1 - 0.25
  assert.equal(risingResistFaces(20, 10), 11); // 5 + 8 - 2
  assert.equal(risingResistFaces(20, 1), 9); // 1 + 8 - 0.4
  assert.equal(risingResistFaces(27, 10), 16); // 5 + 15 - 3.75
  assert.equal(risingResistFaces(27, 20), 18); // 10 + 15 - 7.5
  assert.equal(risingResistFaces(99, 20), 18, "the dial's cap holds the rise");
  // It is the old odds: P(resist) = 1 - (1 - a/20)(1 - c/20), to the nearest face.
  for (let d = 1; d <= 40; d++) for (const intel of [0, 1, 6, 10, 20]) {
    const a = resistFaces(intel);
    const c = controlResistFacesFor(d);
    const old = 20 * (1 - (1 - a / 20) * (1 - c / 20));
    assert.ok(Math.abs(risingResistFaces(d, intel) - old) <= 0.5 + 1e-9, `floor ${d}, intel ${intel}`);
    assert.ok(risingResistFaces(d, intel) >= a, "deeper never makes an effect easier to land");
  }
  // A d20's top face always wins for the caster.
  assert.equal(RISING_RESIST_CEILING, 19);
  for (let d = 1; d <= 60; d++) for (const intel of [0, 10, 20]) assert.ok(risingResistFaces(d, intel) <= 19 && risingResistFaces(d, intel) >= 1);
  // The rise is monotone in depth (the existing curve, no second curve).
  for (const intel of [1, 10]) for (let d = 2; d <= 40; d++) assert.ok(risingResistFaces(d, intel) >= risingResistFaces(d - 1, intel));
});

test("depth-rising resist: one roll on the spell-resist stream, the same die as the half-intel check at or below floor 12, the main rng untouched", () => {
  const state = fixedState({ floor: { depth: 12 } });
  state.combat = fixedCombat(threeFoes());
  for (let seed = 1; seed <= 40; seed++) {
    const rng = makeRng(seed);
    const before = rng.getState();
    const a = foeSpellResistCheck(state, rng, "Oak Staff", 1, 6, "you");
    const b = foeRisingResistCheck(state, rng, "Oak Staff", 1, 6, "you");
    assert.equal(rng.getState(), before, "neither resist moves the main rng");
    assert.deepEqual({ ...b, depthFaces: undefined }, { ...a, depthFaces: undefined }, "floor 12: identical roll and result");
    assert.equal(b.depthFaces, 0);
  }
  // Past the knee the die is the same, only the faces that win grow.
  const deep = fixedState({ floor: { depth: 20 } });
  deep.combat = fixedCombat(threeFoes());
  for (let seed = 1; seed <= 40; seed++) {
    const rng = makeRng(seed);
    const a = foeSpellResistCheck(deep, rng, "Oak Staff", 1, 6, "you");
    const b = foeRisingResistCheck(deep, rng, "Oak Staff", 1, 6, "you");
    assert.equal(b.roll, a.roll, "same stream, same die");
    assert.equal(b.faces, 10); // 3 + 8 - 1.2
    assert.equal(b.depthFaces, 7);
    assert.equal(b.resisted, b.roll >= 21 - b.faces);
  }
});

test("depth-rising resist: a resist line carries depthFaces only when the floor added faces, and foeResistsSpell is unchanged", () => {
  const shallow = fixedState({ floor: { depth: 5 } });
  shallow.combat = fixedCombat([fixedFoe()]);
  const events = [];
  foeResistsEffect(shallow, shallow.combat.foes[0], "Oak Staff", makeRng(3), events);
  assert.equal(events.length, 1);
  assert.equal("depthFaces" in events[0], false);
  const deep = fixedState({ floor: { depth: 20 } });
  deep.combat = fixedCombat([fixedFoe()]);
  const e2 = [];
  foeResistsEffect(deep, deep.combat.foes[0], "Oak Staff", makeRng(3), e2);
  assert.equal(e2[0].depthFaces, 8);
  assert.equal(e2[0].faces, 9);
  // The spell gate (Phase 90 moves it) still rolls the half-intel faces alone.
  const e3 = [];
  foeResistsSpell(deep, deep.combat.foes[0], "Oak Staff", makeRng(3), e3);
  assert.equal(e3[0].faces, resistFaces(1));
  assert.equal("depthFaces" in e3[0], false);
});

test("depth-rising resist: no item effect keeps a floor-12 cap, hold or extra control resist in useItem", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "engine", "items.js"), "utf8")
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
  for (const token of ["resistControl(", "controlHoldRoundsFor(", "controlCapRounds(", "holdFoe(", "foeResistsSpell("]) {
    assert.equal(src.includes(token), false, `engine/items.js no longer calls ${token}`);
  }
  assert.ok(src.includes("foeResistsEffect("), "items resist through the depth-rising gate");
});

// ============================================================================
// Amulet of Stone, Oak Staff, Cedar Staff, Birch Staff, Walnut Staff (Q1, Q6)
// ============================================================================

test("Amulet of Stone: a foe that fails its resist is stoned outright at floor 20, no hold and no extra control resist", () => {
  const row = JEWELRY.find((j) => j.n === "Amulet of Stone");
  assert.equal(row.aoe, 4);
  let resisted = 0;
  let stoned = 0;
  for (const depth of [1, 12, 13, 20, 30]) {
    const results = seeds(40, (seed) => {
      const foes = threeFoes();
      const state = fixedState({ c: { items: [{ ...row }] }, floor: { depth } });
      state.combat = fixedCombat(foes);
      const events = useItem(state, 0, makeRng(seed), [], NOW);
      return { events, foes };
    });
    for (const { events, foes } of results) {
      assert.deepEqual(noFloor12Events(events), [], `floor ${depth}: no controlResisted / controlHeld`);
      const rolls = resistEvents(events);
      assert.equal(rolls.length, 3, "every reached foe rolls exactly one resist");
      for (const r of rolls) {
        const foe = foes.find((f) => f.name === r.target);
        assert.equal(r.faces, risingResistFaces(depth, 1), `floor ${depth}: the rising faces`);
        if (r.type === "spellResisted") {
          resisted++;
          assert.equal(foe.alive, true);
          assert.equal(foe.held, undefined);
        } else {
          stoned++;
          assert.equal(foe.alive, false, `floor ${depth}: a foe that fails its resist is dead, not held`);
          assert.equal(foe.held, undefined);
        }
      }
    }
  }
  assert.ok(resisted > 0 && stoned > 0, "both outcomes occur across the scripted seeds");
});

test("Oak Staff: a foe that fails its resist is stoned outright at floor 20, only two are reached, no hold", () => {
  let resisted = 0;
  let stoned = 0;
  for (const depth of [1, 13, 20]) {
    for (const { events, foes } of seeds(40, (seed) => {
      const foes = threeFoes();
      const state = staffFight("Oak Staff", depth, foes);
      return { events: useStaff(state, seed).events, foes };
    })) {
      assert.deepEqual(noFloor12Events(events), []);
      const rolls = resistEvents(events);
      assert.equal(rolls.length, 2, "the staff's stone reaches two foes");
      assert.equal(foes[2].alive, true, "the third foe is not reached");
      for (const r of rolls) {
        const foe = foes.find((f) => f.name === r.target);
        assert.equal(r.faces, risingResistFaces(depth, 1));
        if (r.type === "spellResisted") {
          resisted++;
          assert.equal(foe.alive, true);
        } else {
          stoned++;
          assert.equal(foe.alive, false);
          assert.equal(foe.held, undefined);
        }
      }
    }
  }
  assert.ok(resisted > 0 && stoned > 0);
});

test("Cedar Staff: a foe that fails its resist sleeps the whole fight (99 rounds) at floor 20, and every foe is reached", () => {
  let resisted = 0;
  let slept = 0;
  for (const depth of [1, 12, 13, 20, 27]) {
    for (const { events, foes, rng, before } of seeds(40, (seed) => {
      const foes = threeFoes();
      const state = staffFight("Cedar Staff", depth, foes);
      const rng = makeRng(seed);
      const before = rng.getState();
      const events = useItem(state, { slot: "weapon" }, rng, [], NOW);
      return { events, foes, rng, before };
    })) {
      assert.deepEqual(noFloor12Events(events), []);
      const rolls = resistEvents(events);
      assert.equal(rolls.length, 3, "every live foe (a fight holds at most three) is reached");
      assert.equal(rng.getState(), before, "the gas draws nothing from the main rng");
      for (const r of rolls) {
        const foe = foes.find((f) => f.name === r.target);
        assert.equal(r.faces, risingResistFaces(depth, 1));
        if (r.type === "spellResisted") {
          resisted++;
          assert.equal(foe.asleep, 0);
        } else {
          slept++;
          assert.equal(foe.asleep, 99, `floor ${depth}: asleep for the fight, never three rounds`);
        }
      }
    }
  }
  assert.ok(resisted > 0 && slept > 0);
});

test("Birch Staff: the freeze rolls one resist (no extra control resist) and holds for its d4 rounds at floor 20", () => {
  let resisted = 0;
  let frozen = 0;
  for (const depth of [1, 13, 20]) {
    for (const { events, foes } of seeds(40, (seed) => {
      const foes = threeFoes();
      const state = staffFight("Birch Staff", depth, foes);
      return { events: useStaff(state, seed).events, foes };
    })) {
      assert.deepEqual(events.filter((e) => e.type === "controlResisted"), [], "no separate control resist");
      const rolls = resistEvents(events);
      assert.equal(rolls.length, 2, "the staff's freeze reaches two foes");
      for (const r of rolls) {
        const foe = foes.find((f) => f.name === r.target);
        assert.equal(r.faces, risingResistFaces(depth, 1));
        if (r.type === "spellResisted") {
          resisted++;
          assert.equal(foe.held, undefined);
        } else {
          frozen++;
          assert.equal(foe.held.kind, "frozen");
          assert.ok(foe.held.left >= 1 && foe.held.left <= 4, "the d4's rounds, never a three-round cap");
        }
      }
      for (const h of events.filter((e) => e.type === "controlHeld")) assert.equal(h.freeze, true);
    }
  }
  assert.ok(resisted > 0 && frozen > 0);
});

test("Walnut Staff: casts the full Weaken (half damage and foes hit only on their top three faces) for the whole fight, at every depth", () => {
  let landed = 0;
  for (const depth of [1, 12, 13, 20, 30]) {
    for (const { state, events, foes } of seeds(40, (seed) => {
      const foes = threeFoes();
      const state = staffFight("Walnut Staff", depth, foes);
      return { state, events: useStaff(state, seed).events, foes };
    })) {
      assert.deepEqual(noFloor12Events(events), [], "no extra room resist, no hold");
      const rolls = resistEvents(events);
      assert.equal(rolls.length, 3, "every live foe rolls its own resist");
      for (const r of rolls) assert.equal(r.faces, risingResistFaces(depth, 1));
      const everyoneResisted = rolls.every((r) => r.type === "spellResisted");
      if (everyoneResisted) {
        assert.ok(!state.combat.weakened, "all resisted: nothing lands");
        assert.ok(!state.combat.foeToHitPenalty);
        continue;
      }
      landed++;
      assert.equal(state.combat.weakened, true, "half damage");
      assert.equal(state.combat.foeToHitPenalty, 3, "foes hit only on their top three faces, the Weaken spell's own cap");
      assert.equal(state.c.timers?.["spell:weaken"], undefined, "no timer: it lasts the fight, at any depth");
      for (const f of foes) {
        const resistedIt = rolls.find((r) => r.target === f.name).type === "spellResisted";
        assert.equal(foeWeakened(state.combat, f), !resistedIt, "a foe that resisted is spared");
      }
    }
  }
  assert.ok(landed > 0);
});

test("Walnut Staff: a Weaken spell's own d4+1 timer still running is ended so the staff's fight-long Weaken is not cleared by it", () => {
  const foes = threeFoes().map((f) => ({ ...f, intel: 0 }));
  let checked = 0;
  for (let seed = 1; seed <= 40 && checked < 3; seed++) {
    const state = staffFight("Walnut Staff", 1, foes.map((f) => ({ ...f })));
    startEffect(state.c, "spell:weaken", { rounds: 2 });
    state.combat.weakened = true;
    state.combat.foeToHitPenalty = 3;
    const { events } = useStaff(state, seed);
    if (resistEvents(events).every((e) => e.type === "spellResisted")) continue;
    checked++;
    assert.equal(state.c.timers["spell:weaken"], undefined);
    assert.equal(state.combat.weakened, true);
  }
  assert.ok(checked > 0);
});

test("Pine Staff: its fire resist is the same depth-rising resist (uniform across every item effect a foe can resist)", () => {
  const foes = threeFoes();
  const state = staffFight("Pine Staff", 20, foes);
  const { events } = useStaff(state, 5);
  const rolls = resistEvents(events);
  assert.equal(rolls.length, 3);
  for (const r of rolls) {
    assert.equal(r.faces, risingResistFaces(20, 1));
    assert.equal(r.depthFaces, controlResistFacesFor(20));
  }
});

// ============================================================================
// Cure Poison, Cure Disease (Q5)
// ============================================================================

const potionOf = (name) => {
  const p = POTIONS.find((x) => x.n === name);
  return { kind: "potion", n: p.n, eff2: p.eff, uses: 1 };
};
const poison = () => ({ kind: "Poison", loss: { n: 1, sides: 6, bonus: 0 }, per: 2, left: 10 });
const disease = () => ({ kind: "Disease", loss: { n: 1, sides: 6, bonus: 0 }, per: 10, left: 80 });
/** A rng that throws on any draw: a refusal or a cure draws nothing. */
const noDraws = () => ({ d() { throw new Error("no draw expected"); }, pick: (a) => a[0], shuffle: (a) => a, getState: () => 1 });

test("Cure Poison and Cure Disease: each potion's kind maps to its own affliction kind", () => {
  assert.deepEqual({ ...CURE_KIND_OF }, { poison: "Poison", disease: "Disease" });
  const kinds = new Set(AFFLICTIONS.map((a) => a.kind));
  for (const k of Object.values(CURE_KIND_OF)) assert.ok(kinds.has(k));
  assert.equal(POTIONS.find((p) => p.n === "Cure Poison").eff, "poison");
  assert.equal(POTIONS.find((p) => p.n === "Cure Disease").eff, "disease");
});

test("Cure Poison: cures a Poison affliction, is spent, and says cured", () => {
  const state = fixedState({ c: { affliction: poison(), items: [potionOf("Cure Poison")] } });
  const events = useItem(state, 0, noDraws(), [], NOW);
  assert.equal(state.c.affliction, null);
  assert.equal(state.c.items.length, 0, "the potion is spent");
  assert.ok(events.some((e) => e.type === "cured" && e.kind === "poison"));
  assert.ok(events.some((e) => e.type === "itemConsumed"));
});

test("Cure Poison: a Disease is refused (nothingToCure), kept, and the potion is not spent", () => {
  const state = fixedState({ c: { affliction: disease(), items: [potionOf("Cure Poison")] } });
  const events = useItem(state, 0, noDraws(), [], NOW);
  assert.equal(state.c.affliction.kind, "Disease", "the Disease is still there");
  assert.equal(state.c.items.length, 1, "the potion is kept");
  const refusal = events.find((e) => e.type === "useRefused");
  assert.equal(refusal.reason, "nothingToCure");
  assert.equal(refusal.need, "Poison");
  assert.equal(refusal.have, "Disease");
  assert.deepEqual(events.map((e) => e.type), ["useRefused"], "no itemUsed, no cured, no consumed");
});

test("Cure Poison: with no affliction at all it is refused and kept", () => {
  const state = fixedState({ c: { items: [potionOf("Cure Poison")] } });
  const events = useItem(state, 0, noDraws(), [], NOW);
  assert.equal(state.c.items.length, 1);
  const refusal = events.find((e) => e.type === "useRefused");
  assert.equal(refusal.reason, "nothingToCure");
  assert.equal(refusal.have, null);
});

test("Cure Disease: cures a Disease affliction, is spent, and says cured", () => {
  const state = fixedState({ c: { affliction: disease(), items: [potionOf("Cure Disease")] } });
  const events = useItem(state, 0, noDraws(), [], NOW);
  assert.equal(state.c.affliction, null);
  assert.equal(state.c.items.length, 0);
  assert.ok(events.some((e) => e.type === "cured" && e.kind === "disease"));
});

test("Cure Disease: a Poison is refused (nothingToCure), kept, and the potion is not spent", () => {
  const state = fixedState({ c: { affliction: poison(), items: [potionOf("Cure Disease")] } });
  const events = useItem(state, 0, noDraws(), [], NOW);
  assert.equal(state.c.affliction.kind, "Poison");
  assert.equal(state.c.items.length, 1);
  const refusal = events.find((e) => e.type === "useRefused");
  assert.equal(refusal.reason, "nothingToCure");
  assert.equal(refusal.need, "Disease");
  assert.equal(refusal.have, "Poison");
  assert.deepEqual(events.map((e) => e.type), ["useRefused"]);
});

test("Cure Disease: a permanent phobia is not an affliction, so the potion is refused and kept", () => {
  const state = fixedState({ c: { phobia: "Spiders", items: [potionOf("Cure Disease")] } });
  const events = useItem(state, 0, noDraws(), [], NOW);
  assert.equal(state.c.phobia, "Spiders");
  assert.equal(state.c.items.length, 1);
  assert.equal(events.find((e) => e.type === "useRefused").reason, "nothingToCure");
});

test("Cure Poison and Cure Disease: a refused cure works the same in a fight and draws nothing", () => {
  const state = fixedState({ c: { affliction: disease(), items: [potionOf("Cure Poison")] } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = useItem(state, 0, noDraws(), [], NOW);
  assert.equal(events.find((e) => e.type === "useRefused").reason, "nothingToCure");
  assert.equal(state.c.items.length, 1);
});

// ============================================================================
// Joiner armour repair (Q4)
// ============================================================================

const joiner = (overrides = {}) => ({
  name: "Aldric", sub: "Soldier", race: "Human", cls: "Fighter", level: 2,
  wp: 14, maxWP: 20, potions: 0, items: [], worn: {}, timers: {},
  armor: "Leather", ar: 6, armorMin: 1, armorWP: 8, armorMax: 15,
  ...overrides,
});
const storeState = (party, cOverrides = {}) => {
  const state = fixedState({ c: { gold: 5000, ...cOverrides }, floor: { depth: 1 }, party });
  return state;
};
const repairLines = (state) => state.store.stock.map((l, i) => ({ ...l, i })).filter((l) => l.effectId === "repairArmor");

test("Joiner armour repair: a hurt Joiner's armour gets a store line naming the Joiner, at a tenth of the armour's cost per point", () => {
  const state = storeState([joiner()]);
  openStore(state, makeRng(7));
  const lines = repairLines(state);
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.equal(line.n, "Repair Aldric's leather");
  assert.deepEqual(line.effectParams, { member: 0, name: "Aldric" });
  // Leather costs 500; 15 - 8 = 7 points at 50 each.
  assert.equal(line.cost, (priceFor(500, "Human", "Soldier") / 10) * 7);
  assert.equal(line.cost, 350);
  assert.equal(line.sub, "7 points at a tenth of its cost each");
});

test("Joiner armour repair: buying it mends that Joiner's armour to whole, charges the hero, and leaves the hero's armour alone", () => {
  const state = storeState([joiner()], { armor: "Mail", ar: 12, armorMin: 3, armorWP: 10, armorMax: 30 });
  openStore(state, makeRng(7));
  const [heroLine, joinerLine] = repairLines(state);
  assert.equal(heroLine.effectParams, null, "the hero's own line comes first");
  assert.deepEqual(joinerLine.effectParams, { member: 0, name: "Aldric" });
  const gold = state.c.gold;
  const events = buyFrom(state, joinerLine.i);
  assert.equal(state.party[0].armorWP, 15, "the Joiner's armour is whole");
  assert.equal(state.c.armorWP, 10, "the hero's armour is untouched");
  assert.equal(state.c.gold, gold - joinerLine.cost);
  assert.equal(state.store.stock[joinerLine.i].sold, true);
  assert.ok(events.some((e) => e.type === "bought" && e.item === "Repair Aldric's leather" && e.cost === joinerLine.cost));
  // The hero's line is still on the shelf and still mends the hero.
  buyFrom(state, heroLine.i);
  assert.equal(state.c.armorWP, 30);
});

test("Joiner armour repair: the hero's store price modifiers apply (a Dwarven hero pays half, a Troll triple)", () => {
  for (const [race, expected] of [["Dwarven", 175], ["Troll", 1050], ["Human", 350]]) {
    const state = storeState([joiner()], { race });
    openStore(state, makeRng(7));
    const [line] = repairLines(state);
    assert.equal(line.cost, expected, race);
    assert.equal(line.cost, (priceFor(500, race, "Soldier") / 10) * 7);
  }
});

test("Joiner armour repair: no line when the Joiner's armour is whole, destroyed, absent or the Joiner is downed", () => {
  const cases = [
    joiner({ armorWP: 15 }),
    joiner({ armorWP: 0 }),
    joiner({ armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0 }),
    joiner({ status: "downed" }),
  ];
  for (const sheet of cases) {
    const state = storeState([sheet]);
    openStore(state, makeRng(7));
    assert.equal(repairLines(state).length, 0, JSON.stringify({ armor: sheet.armor, wp: sheet.armorWP, status: sheet.status }));
  }
  const empty = storeState([]);
  openStore(empty, makeRng(7));
  assert.equal(repairLines(empty).length, 0);
  assert.equal(memberArmourToMend(joiner()).pts, 7);
  assert.equal(memberArmourToMend(null), null);
});

test("Joiner armour repair: a line costs the hero no extra rng and moves no other line's price", () => {
  const without = storeState([]);
  const rngA = makeRng(11);
  openStore(without, rngA);
  const withJ = storeState([joiner()]);
  const rngB = makeRng(11);
  openStore(withJ, rngB);
  assert.equal(rngB.getState(), rngA.getState(), "the store opens on the same rng draws");
  assert.equal(withJ.store.stock.length, without.store.stock.length + 1);
  const strip = (st) => st.store.stock.filter((l) => !(l.effectParams && Number.isInteger(l.effectParams.member))).map((l) => `${l.n}|${l.cost}`);
  assert.deepEqual(strip(withJ), strip(without));
});

test("Joiner armour repair: a line whose Joiner has left refuses cleanly, with no charge and the line still unsold", () => {
  const state = storeState([joiner()]);
  openStore(state, makeRng(7));
  const [line] = repairLines(state);
  state.party.splice(0, 1); // dismissed from the Hero tab while the store was open
  const gold = state.c.gold;
  const events = buyFrom(state, line.i);
  assert.equal(state.c.gold, gold, "no charge");
  assert.equal(state.store.stock[line.i].sold, false);
  assert.deepEqual(events.map((e) => e.type), ["buyFailed"]);
  assert.equal(events[0].reason, "repairGone");
  assert.equal(events[0].name, "Aldric");
  // A different Joiner now at that index is not the one the line was written for.
  state.party.push(joiner({ name: "Hilda" }));
  assert.equal(memberRepairRefusal(state, line).reason, "repairGone");
  assert.equal(state.party[0].armorWP, 8, "nobody's armour was mended");
});

test("Joiner armour repair: a line whose Joiner's armour is already whole refuses with no charge", () => {
  const state = storeState([joiner()]);
  openStore(state, makeRng(7));
  const [line] = repairLines(state);
  state.party[0].armorWP = 15;
  const gold = state.c.gold;
  const events = buyFrom(state, line.i);
  assert.equal(state.c.gold, gold);
  assert.equal(events[0].type, "buyFailed");
  assert.equal(events[0].reason, "nothingToMend");
});

test("Joiner armour repair: a hero short of gold is refused before anything is mended, like every other line", () => {
  const state = storeState([joiner()], { gold: 10 });
  openStore(state, makeRng(7));
  const [line] = repairLines(state);
  const events = buyFrom(state, line.i);
  assert.ok(events.some((e) => e.type === "buyFailed" && e.reason === "insufficientGold"));
  assert.equal(state.party[0].armorWP, 8);
  assert.equal(state.c.gold, 10);
});

test("Joiner armour repair: the effect with a missing Joiner is a no-op and the hero's own effect is unchanged", () => {
  const state = storeState([], { armor: "Mail", ar: 12, armorWP: 5, armorMax: 30 });
  STORE_EFFECTS.repairArmor(state, { member: 3, name: "Nobody" }, []);
  assert.equal(state.c.armorWP, 5, "a missing Joiner mends nothing, least of all the hero");
  STORE_EFFECTS.repairArmor(state, null, []);
  assert.equal(state.c.armorWP, 30);
});

test("Joiner armour repair: the store shelf draws the Joiner's own armour and points on its line, and the hero's line keeps the hero's", () => {
  const state = storeState([joiner()], { armor: "Mail", ar: 12, armorMin: 3, armorWP: 10, armorMax: 30 });
  openStore(state, makeRng(7));
  const rec = createRecordingDocument();
  const host = rec.document.createElement("div");
  renderStoreScreen(host, state, {});
  const rows = rec.elementsById.get("shelf").children;
  const heroRow = rows.find((r) => r.innerHTML.includes("Repair your mail"));
  const joinerRow = rows.find((r) => r.innerHTML.includes("Repair Aldric&#39;s leather") || r.innerHTML.includes("Repair Aldric's leather"));
  assert.ok(heroRow, "the hero's repair row is drawn");
  assert.ok(joinerRow, "the Joiner's repair row is drawn");
  assert.ok(heroRow.innerHTML.includes("20 hp to mend at a tenth of its cost each"), heroRow.innerHTML);
  assert.ok(joinerRow.innerHTML.includes("Leather · 7 hp to mend at a tenth of its cost each"), joinerRow.innerHTML);
  assert.ok(joinerRow.innerHTML.includes("350 wm"), joinerRow.innerHTML);
});

test("Joiner armour repair: an open store with a Joiner line survives the save round trip", () => {
  const state = storeState([joiner()]);
  state.c.name = "Test Delver";
  openStore(state, makeRng(7));
  const save = JSON.parse(JSON.stringify(serializeRun(state)));
  const loaded = validateSave(JSON.stringify(save));
  assert.equal(loaded.ok, true, JSON.stringify(loaded.errors ?? loaded.reason ?? ""));
  const line = loaded.value.store.stock.find((l) => l.effectParams && l.effectParams.member === 0);
  assert.ok(line, "the Joiner's repair line is kept on load");
  assert.equal(line.n, "Repair Aldric's leather");
});

// ============================================================================
// Narration: what the fixes changed, on the Oracle and on the rail
// ============================================================================

const plain = (html) => String(html).replace(/<[^>]+>/g, "");

test("Cure Poison and Cure Disease narration: the refusal names the potion, the kind it cures and what you carry, and says it stays corked (Oracle and rail)", () => {
  const item = { n: "Cure Poison" };
  const wrong = { type: "useRefused", reason: "nothingToCure", item, need: "Poison", have: "Disease" };
  const none = { type: "useRefused", reason: "nothingToCure", item, need: "Poison", have: null };
  assert.match(plain(EVENT_NARRATION.useRefused(wrong)), /Cure Poison only cures poison\. What you have is disease\..*stays corked/);
  assert.match(plain(EVENT_NARRATION.useRefused(none)), /Cure Poison only cures poison, and you have none\..*stays corked/);
  assert.equal(LINE_FOR.useRefused(wrong).text, "Cure Poison only cures poison, not disease. It stays corked.");
  assert.equal(LINE_FOR.useRefused(none).text, "Cure Poison only cures poison, and you have none. It stays corked.");
  // The cure that does land still reads as before.
  assert.equal(plain(EVENT_NARRATION.cured({ kind: "poison" })), "Cured of poison.");
});

test("Joiner armour repair narration: a refused line says no charge, names the Joiner, and a plain short-of-wilmst line is unchanged (Oracle and rail)", () => {
  const gone = { type: "buyFailed", reason: "repairGone", name: "Aldric" };
  const whole = { type: "buyFailed", reason: "nothingToMend", name: "Aldric" };
  assert.match(plain(EVENT_NARRATION.buyFailed(gone)), /Aldric has left the party.*No charge/);
  assert.match(plain(EVENT_NARRATION.buyFailed(whole)), /Aldric's armour needs no mending.*No charge/);
  assert.equal(LINE_FOR.buyFailed(gone).text, "Aldric has left the party. No charge.");
  assert.equal(LINE_FOR.buyFailed(whole).text, "Aldric's armour needs no mending. No charge.");
  const short = { type: "buyFailed", reason: "insufficientGold", short: 40 };
  assert.equal(plain(EVENT_NARRATION.buyFailed(short)), "You are short 40 wilmst.");
  assert.equal(LINE_FOR.buyFailed(short).text, "Short 40 wilmst.");
});

test("Amulet of Stone, Oak Staff and Cedar Staff narration: a resist line past floor 12 names the floor's extra faces; shallow floors read as before", () => {
  const deep = { type: "spellResisted", target: "Ann", spell: "Oak Staff", roll: 9, atLeast: 12, dieN: 20, intel: 1, faces: 9, depthFaces: 8 };
  const shallow = { ...deep, faces: 1, atLeast: 20, depthFaces: undefined };
  assert.match(plain(EVENT_NARRATION.spellResisted(deep)), /\(intel 1, depth \+8\)/);
  assert.match(plain(EVENT_NARRATION.resistFailed({ ...deep, type: "resistFailed" })), /\(intel 1, depth \+8\)/);
  assert.match(plain(EVENT_NARRATION.spellResisted(shallow)), /\(intel 1\)\./);
  assert.equal(plain(EVENT_NARRATION.spellResisted(shallow)).includes("depth"), false);
});

// ============================================================================
// The guard: every row owned by 89-08 has a pin named after it
// ============================================================================

test("ITEM-AUDIT guard: every row and system docs/ITEM-AUDIT.md assigns to 89-08 has a test named after it", () => {
  const doc = fs.readFileSync(path.join(REPO_ROOT, "docs", "ITEM-AUDIT.md"), "utf8").split(/\r?\n/);
  const owned = [];
  let inRows = false;
  let inSystems = false;
  for (const line of doc) {
    if (/^## Rows/.test(line)) { inRows = true; inSystems = false; continue; }
    if (/^## Systems/.test(line)) { inRows = false; inSystems = true; continue; }
    if (/^## /.test(line)) { inRows = false; inSystems = false; continue; }
    if (!line.startsWith("|") || /^\|\s*-/.test(line) || /^\|\s*(Item|System)\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((s) => s.trim());
    const verdict = inRows ? cells[4] : inSystems ? cells[2] : "";
    if (verdict && /89-08/.test(verdict)) owned.push(cells[0]);
  }
  assert.ok(owned.length >= 8, `the audit hands 89-08 at least eight rows; found ${owned.length}: ${owned.join(", ")}`);
  const names = fs.readFileSync(url.fileURLToPath(import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("test("))
    .map((l) => l.toLowerCase());
  for (const item of owned) {
    assert.ok(names.some((n) => n.includes(item.toLowerCase())), `no test in test/unit/item-audit-fixes.test.js is named after "${item}"`);
  }
  // The rows this plan was handed, by name (a renamed or dropped row must be noticed).
  for (const expected of ["Amulet of Stone", "Birch Staff", "Walnut Staff", "Oak Staff", "Cedar Staff", "Cure Poison", "Cure Disease", "Joiner armour repair"]) {
    assert.ok(owned.includes(expected), `${expected} is owned by 89-08`);
  }
});
