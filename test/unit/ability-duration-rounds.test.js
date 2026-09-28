// test/unit/ability-duration-rounds.test.js
//
// Quick 260928-hrs (user report and ruling 2026-09-28): "Smoke ability says
// it lasts for 2 rounds, but whenever I use it, the chit shows 1 rds. I've
// never seen it show 2 rds."
//
// The cause: using an ability IS the round's action, so the same dispatch's
// foeTurn (afterPlayerAction) ran the foes' swing AND ticked the fresh timer
// before the player ever saw the chip. A "for two rounds" ability started at
// 2, covered the use round's swing plus ONE more round, and its chip first
// read 1; a "for one round" Riposte covered only the use round and never
// showed a chip at all.
//
// The fix (engine/abilities.js#abilityEffectTicks): a "for N rounds" ability
// (Sidestep, Battle Roar, Smoke: 2; Riposte: 1) starts at N + 1, so it still
// covers the foes' swing in the round it was used, then N full rounds after
// it, and its chip reads N right after use: N -> ... -> 1 -> gone. Taunt says
// "this round" and keeps covering exactly that round (the use round).
//
// "Protected" below means the effect is live (abilityEffectActive) when a foe
// turn runs: every rng draw is observed and tagged with the live flag, and
// the one plain foe swings (a d20 draw) in every foe turn, so a foe turn
// counts as protected when its draws saw the effect live.
//
// Pins, for the hero and for a Joiner (engine/combat.js#
// startMemberAbilityTimer shares the length):
//   - each ability covers exactly its stated rounds after the use round (plus
//     the use round's own foe turn), and Taunt only the use round;
//   - the chip (conditionsOf / memberConditionsOf) reads N right after use,
//     then N - 1, and is gone once the rounds are spent;
//   - Smoke's "a flee during it just works" holds on both rounds after the
//     throw, and not after.

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility, abilityEffectTicks, DURATION_ROUNDS, THIS_ROUND_ABILITIES } from "../../engine/abilities.js";
import { abilityEffectActive, conditionsOf, memberConditionsOf } from "../../engine/derived.js";
import { foeTurn, flee, alliesTurn } from "../../engine/combat.js";
import { ABILITY_BY_ID } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

/** probeRng(isLive) — every draw returns 20 (a plain foe swing misses; a raw
 * 20 never resists) and records `isLive()` at that moment. */
function probeRng(isLive) {
  const seen = [];
  return {
    seen,
    d(_sides) {
      seen.push(isLive());
      return 20;
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 999, wp: 999, skills: {}, vp: 0, abilities: [], intel: 1,
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

function floor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function foe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function heroState(key) {
  const cls = ABILITY_BY_ID[key].cls;
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: fighter({ cls, sub: cls === "Thief" ? "Cutthroat" : "Soldier", abilities: [key] }),
    floor: floor(),
    day: 1, steps: 0, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    combat: { foes: [foe()], type: "Beasts", round: 1, target: 0, pending: false, opened: false, opened2: false, spellOpen: false, tracked: false },
  };
}

function chipRounds(state, key) {
  const chip = conditionsOf(state).find((cn) => cn.key === "ability" && cn.ability === key);
  return chip ? chip.remaining : 0;
}

/** Stated rounds AFTER the use round (the chip's first reading). */
function statedAfter(key) {
  return THIS_ROUND_ABILITIES.has(key) ? 0 : DURATION_ROUNDS[key];
}

// ---------------------------------------------------------------------------
// The mapping.
// ---------------------------------------------------------------------------

test("abilityEffectTicks: a 'for N rounds' ability starts at N + 1 (the use round's tick, then N); Taunt ('this round') at 1; a non-duration ability at 0", () => {
  assert.deepEqual(
    Object.fromEntries(Object.keys(DURATION_ROUNDS).map((k) => [k, abilityEffectTicks(k)])),
    { sidestep: 3, battleRoar: 3, riposte: 2, taunt: 1, smoke: 3 },
  );
  assert.equal(abilityEffectTicks("kata"), 0);
  assert.equal(abilityEffectTicks("nope"), 0);
  // The texts the stated rounds come from.
  assert.match(ABILITY_BY_ID.sidestep.txt, /two rounds/);
  assert.match(ABILITY_BY_ID.battleRoar.txt, /two rounds/);
  assert.match(ABILITY_BY_ID.smoke.txt, /two rounds/);
  assert.match(ABILITY_BY_ID.riposte.txt, /one round/);
  assert.match(ABILITY_BY_ID.taunt.txt, /this round/);
});

// ---------------------------------------------------------------------------
// The hero: each ability protects exactly its stated rounds; the chip counts.
// ---------------------------------------------------------------------------

for (const key of Object.keys(DURATION_ROUNDS)) {
  test(`hero ${key}: covers the use round's foe turn plus ${statedAfter(key)} more, and the chip reads ${statedAfter(key)} right after use, then counts down to gone`, () => {
    const state = heroState(key);
    const live = () => abilityEffectActive(state.c, key);
    const N = statedAfter(key);

    // The use dispatch: its own foe turn runs with the effect live.
    const useRng = probeRng(live);
    useAbility(state, key, useRng, []);
    assert.ok(useRng.seen.length > 0, "the use round's foe turn drew");
    assert.ok(useRng.seen.every(Boolean), "the use round's foe turn is covered");
    assert.equal(chipRounds(state, key), N, `the chip reads ${N} right after use`);

    // Each following foe turn: covered while the chip showed a number.
    let protectedAfter = 0;
    for (let turn = 1; turn <= 5; turn++) {
      const before = chipRounds(state, key);
      const rng = probeRng(live);
      foeTurn(state, rng, []);
      const covered = rng.seen.length > 0 && rng.seen.every(Boolean);
      assert.equal(covered, before > 0, `turn ${turn}: covered exactly when the chip showed rounds (${before})`);
      if (covered) protectedAfter++;
      assert.equal(chipRounds(state, key), Math.max(0, before - 1), `turn ${turn}: the chip counts down by one`);
    }
    assert.equal(protectedAfter, N, `${key} protects exactly ${N} full round(s) after the use round`);
    assert.equal(live(), false, "spent");
  });
}

test("hero smoke: the chip reads 2, then 1, then nothing — the user's report", () => {
  const state = heroState("smoke");
  useAbility(state, "smoke", probeRng(() => true), []);
  const reads = [chipRounds(state, "smoke")];
  for (let i = 0; i < 2; i++) {
    foeTurn(state, probeRng(() => true), []);
    reads.push(chipRounds(state, "smoke"));
  }
  assert.deepEqual(reads, [2, 1, 0]);
});

test("hero smoke: a flee just works on both rounds after the throw, and not on the third", () => {
  for (const [roundsLater, works] of [[0, true], [1, true], [2, false]]) {
    const state = heroState("smoke");
    useAbility(state, "smoke", probeRng(() => true), []);
    for (let i = 0; i < roundsLater; i++) foeTurn(state, probeRng(() => true), []);
    const events = flee(state, probeRng(() => true), []);
    const smokeFlee = events.some((e) => e.type === "fled" && e.reason === "smoke");
    assert.equal(smokeFlee, works, `a flee ${roundsLater} round(s) after the throw`);
  }
});

// ---------------------------------------------------------------------------
// A Joiner: the same length on the member's own sheet.
// ---------------------------------------------------------------------------

function partyState(key, memberOverrides = {}) {
  const cls = ABILITY_BY_ID[key].cls;
  const member = {
    name: "Ada", level: 1, cls, sub: cls === "Thief" ? "Cutthroat" : "Knight", race: "Human",
    wp: 20, maxWP: 20, status: "ok", weapon: "Club", prof: 0, magicWpn: 0, might: 0,
    items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: [key],
    ...memberOverrides,
  };
  const state = heroState("kata");
  state.party = [member];
  state.combat.allies = [{ partyIdx: 0, name: "Ada", lvl: 1, sub: member.sub, wp: member.wp, maxWP: 20 }];
  return state;
}

function memberChip(state, key) {
  const chip = memberConditionsOf(state, 0).find((cn) => cn.key === "ability" && cn.ability === key);
  return chip ? chip.remaining : 0;
}

for (const [key, memberOverrides] of [["battleRoar", {}], ["sidestep", { wp: 5 }], ["smoke", { wp: 5 }]]) {
  test(`Joiner ${key}: the member's chip reads ${DURATION_ROUNDS[key]} after the round it was used, then counts down, like the hero's`, () => {
    const state = partyState(key, memberOverrides);
    const events = [];
    alliesTurn(state, probeRng(() => true), events);
    assert.ok(events.some((e) => e.type === "memberAbilityUsed" && e.key === key), `the Joiner used ${key}`);
    foeTurn(state, probeRng(() => true), []);
    const reads = [memberChip(state, key)];
    for (let i = 0; i < DURATION_ROUNDS[key]; i++) {
      foeTurn(state, probeRng(() => true), []);
      reads.push(memberChip(state, key));
    }
    const want = [];
    for (let n = DURATION_ROUNDS[key]; n >= 0; n--) want.push(n);
    assert.deepEqual(reads, want);
  });
}
