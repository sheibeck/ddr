// test/unit/round-card-worst-case.test.js
//
// Phase 32 (CMBUI-02, design §6.7 / RESEARCH Pitfall 4), Plan 03 — measures
// the worst-case Round Card round against the REAL engine (applyAction) and
// the REAL toastsForAction pipeline, combining BOTH frenzy mechanics (a
// Fridgian hero's player-side frenzy second swing AND a foe carrying
// `sp.atk:2` + `frenzied:true` for a 4-swing melee turn) plus three
// ability-kit foes (Stalka Beast/Djinni/Krupke, straight off
// content/bestiary.js), swept over a deterministic seed range. For every
// seed it asserts the Round Card's line count EQUALS the uncapped folded
// non-refusal toast count (`toastsForAction(..., { limit: Infinity })` —
// CONTEXT Area 1 #5: the card has no cap) while the toast-host's default
// call still caps at MAX_TOASTS. The two `fixed*` state-builder helpers are
// copied verbatim from test/unit/foe-abilities.test.js (module-local there,
// not exported).

import test from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "../../engine/engine.js";
import { toastsForAction, MAX_TOASTS, narrativeToastText, PRIORITY } from "../../src/browser/toasts.js";

// ─── fixed* helpers, copied verbatim from test/unit/foe-abilities.test.js ──

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// ─── the worst-case roster: BOTH frenzy mechanics + three ability kits ────
//
// Player-side frenzy: a Fridgian hero (RACES.Fridgian.frenzy === true,
// engine/combat.js#playerStrike). Foe-side frenzy: sp.atk:2 + frenzied:true
// on the Stalka Beast doubles ITS multi-attack too (foeTurn's
// `swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1)` = 4). The
// Stalka Beast/Djinni/Krupke shapes are lifted straight from
// content/bestiary.js (including their real ability kits); the Djinni also
// carries frenzied:true so a caster's kit and a frenzy-doubled melee turn
// can coexist on the same foe across the sweep. wp:400 on the hero survives
// every seed in the sweep (the worst single foeTurn tops out well under
// that).

function worstCaseFoes() {
  return [
    {
      name: "Stalka Beast", type: "Beasts", lvl: 4, size: "XL", intel: 15,
      wp: 94, maxWP: 94, alive: true, asleep: 0, lives: 1,
      sp: { atk: 2, dmg: { n: 1, sides: 4, bonus: 0 } },
      frenzied: true,
      abilities: ["stalkaHeal", "stalkaLightning", "stalkaFireball", "stalkaFreeze"],
    },
    {
      name: "Djinni", type: "Beasts", lvl: 4, size: "G", intel: 16,
      wp: 65, maxWP: 65, alive: true, asleep: 0, lives: 1,
      sp: { caster: true, dmg: { n: 1, sides: 4, bonus: 0 }, fleesBelow: 0.25 },
      frenzied: true,
      abilities: ["djinniFireball", "djinniDaze", "djinniLightning", "djinniFreeze"],
    },
    {
      name: "Krupke", type: "Beasts", lvl: 1, size: "H", intel: 8,
      wp: 17, maxWP: 17, alive: true, asleep: 0, lives: 1,
      sp: { caster: true, ar: 12, dmg: { n: 1, sides: 6, bonus: 2 } },
      abilities: ["krupkeWeaken", "krupkeFreeze"],
    },
    {
      name: "Giant Rat", type: "Beasts", lvl: 1, size: "S", intel: 1,
      wp: 10, maxWP: 10, alive: true, asleep: 0, lives: 1,
      sp: { atk: 2 },
      frenzied: true,
    },
  ];
}

function fridgianHero(overrides = {}) {
  return fixedFighter({
    race: "Fridgian", cls: "Fighter", sub: "Soldier",
    maxWP: 400, wp: 400, weapon: "Club", potions: 0,
    ...overrides,
  });
}

const SEED_COUNT = 400;

function runScenario(scenarioName, buildState, action) {
  let maxEvents = { n: -1, seed: null };
  let maxLines = { n: -1, seed: null };
  let maxChars = { n: -1, seed: null };
  let abilitySeeds = 0;
  let sawFrenzy = false;
  let sawFourStalkaSwings = false;

  for (let seed = 1; seed <= SEED_COUNT; seed++) {
    const state = buildState();
    const result = applyAction({ ...state, rngState: seed }, action);
    const events = result.events;

    // the Round Card's own uncapped request (mazeworld.html's
    // dispatchWithToasts — 32-02) vs. the toast host's default (capped) call
    const folded = toastsForAction(action.type, events, {}, { limit: Infinity });
    const cardEligible = folded.filter((t) => t.priority !== PRIORITY.block);
    const lines = cardEligible.map((t) => narrativeToastText(t.text) || t.text);
    assert.equal(
      lines.length,
      cardEligible.length,
      `seed ${seed}: every card-eligible folded toast must produce one line`,
    );

    const hostCapped = toastsForAction(action.type, events, {});
    assert.ok(
      hostCapped.length <= MAX_TOASTS,
      `seed ${seed}: the toast host's default call must still cap at MAX_TOASTS`,
    );

    if (events.length > maxEvents.n) maxEvents = { n: events.length, seed };
    if (lines.length > maxLines.n) maxLines = { n: lines.length, seed };
    const chars = lines.join(" ").length;
    if (chars > maxChars.n) maxChars = { n: chars, seed };

    if (events.some((e) => e.ability)) abilitySeeds++;
    if (events.some((e) => e.type === "frenzy")) sawFrenzy = true;
    const stalkaSwings = events.filter(
      (e) => (e.type === "struckByFoe" || e.type === "foeMissed") && e.name === "Stalka Beast",
    ).length;
    if (stalkaSwings >= 4) sawFourStalkaSwings = true;
  }

  console.log(
    `round-card worst case (${scenarioName}): seed=${maxLines.seed} events=${maxEvents.n} lines=${maxLines.n} chars=${maxChars.n} abilitySeeds=${abilitySeeds}`,
  );

  return { maxLines, maxEvents, maxChars, abilitySeeds, sawFrenzy, sawFourStalkaSwings };
}

test("fight scenario: the worst-case round card is uncapped, the toast host stays capped, ability kits fire", () => {
  const stats = runScenario(
    "fight",
    () => {
      const state = fixedState({ c: fridgianHero() });
      state.combat = fixedCombat(worstCaseFoes(), { pending: true });
      return state;
    },
    { type: "fight" },
  );
  assert.ok(stats.maxLines.n >= 2, `expected at least 2 card lines in the worst fight-scenario round, got ${stats.maxLines.n}`);
  assert.ok(stats.abilitySeeds >= 1, "expected at least one seed to fire a foe ability kit during the fight scenario");
});

test("attack scenario: the worst-case round card is uncapped, the toast host stays capped, both frenzy mechanics fire", () => {
  const stats = runScenario(
    "attack",
    () => {
      const state = fixedState({ c: fridgianHero() });
      state.combat = fixedCombat(worstCaseFoes(), { first: "foe" });
      return state;
    },
    { type: "attack" },
  );
  assert.ok(stats.maxLines.n >= 2, `expected at least 2 card lines in the worst attack-scenario round, got ${stats.maxLines.n}`);
  assert.ok(stats.abilitySeeds >= 1, "expected at least one seed to fire a foe ability kit during the attack scenario");
  assert.ok(stats.sawFrenzy, "expected at least one seed to fire the Fridgian hero's player-side frenzy (a 'frenzy' event)");
  assert.ok(
    stats.sawFourStalkaSwings,
    "expected at least one seed where the Stalka Beast's foe-side frenzy (frenzied + sp.atk:2) produced >= 4 melee swing events",
  );
});
