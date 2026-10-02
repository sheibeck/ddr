// test/unit/watch-readout.test.js
//
// Phase 92 plan 04 (TUNE-10): the watch-list tally and readout
// (tools/lib/watch-readout.mjs) — pure, report only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWatchTally, tallyWatch, watchReadout, formatWatchReadout } from "../../tools/lib/watch-readout.mjs";

const inFight = { combat: {}, party: [] };
const noFight = { combat: null, party: [] };

test("watch: tallyWatch counts frenzies, Door Illusion casts and see-throughs, ally casts, camp failures and rations", () => {
  const t = makeWatchTally();
  tallyWatch(t, [{ type: "encounterStarted" }], noFight, inFight, { type: "fight" });
  tallyWatch(t, [{ type: "frenzy" }], inFight, inFight, { type: "attack" });
  tallyWatch(t, [{ type: "doorIllusionSeen", foe: "Ogre" }], inFight, inFight, { type: "castSpell", idx: 1 });
  tallyWatch(t, [{ type: "fled", reason: "door" }], inFight, noFight, { type: "castSpell", idx: 1 });
  tallyWatch(t, [{ type: "fled", reason: "escaped" }], inFight, noFight, { type: "flee" });
  tallyWatch(t, [{ type: "allyCast", name: "Joe", spell: "Heal" }], inFight, inFight, { type: "attack" });
  tallyWatch(t, [{ type: "campFailed", reason: "noRations" }], noFight, noFight, { type: "camp" });
  tallyWatch(t, [{ type: "rationsBought", amount: 3 }, { type: "rationsBought", amount: 2 }], noFight, noFight, { type: "buy" });
  assert.equal(t.fights, 1);
  assert.equal(t.frenzies, 1);
  assert.equal(t.doorSeen, 1);
  assert.equal(t.doorEscapes, 1);
  assert.equal(t.allyCasts, 1);
  assert.equal(t.campFailed, 1);
  assert.equal(t.rations, 5);
  assert.equal(t.attacks, 2);
  assert.equal(t.strikes, 1);
});

test("watch: abilityUsed twice with the same key in one fight counts one second use; a new fight resets", () => {
  const t = makeWatchTally();
  tallyWatch(t, [{ type: "encounterStarted" }], noFight, inFight, { type: "fight" });
  tallyWatch(t, [{ type: "abilityUsed", key: "kata" }], inFight, inFight, { type: "useAbility", key: "kata" });
  tallyWatch(t, [{ type: "abilityUsed", key: "kata" }], inFight, inFight, { type: "useAbility", key: "kata" });
  tallyWatch(t, [{ type: "abilityUsed", key: "kata" }], inFight, inFight, { type: "useAbility", key: "kata" });
  tallyWatch(t, [{ type: "encounterStarted" }], noFight, inFight, { type: "fight" });
  tallyWatch(t, [{ type: "abilityUsed", key: "kata" }], inFight, inFight, { type: "useAbility", key: "kata" });
  assert.equal(t.abilityUses.kata, 4);
  assert.equal(t.abilityFights.kata, 2);
  assert.equal(t.abilitySecond.kata, 1);
});

test("watch: Joiner fights, downs and parley successes with a Joiner present; healing spells are the hero's own", () => {
  const t = makeWatchTally();
  const withJoiner = { combat: {}, party: [{}] };
  tallyWatch(t, [{ type: "encounterStarted" }], noFight, withJoiner, { type: "fight" });
  tallyWatch(t, [{ type: "memberDowned", name: "Joe" }], withJoiner, withJoiner, { type: "attack" });
  tallyWatch(t, [{ type: "spGained", reason: "parley", amount: 5 }], withJoiner, { combat: null, party: [{}] }, { type: "parley" });
  tallyWatch(t, [{ type: "healed", spell: "Heal", gained: 4 }], inFight, inFight, { type: "castSpell", idx: 0 });
  tallyWatch(t, [{ type: "healed", amount: 5, gained: 5 }], noFight, noFight, { type: "drinkPotion" });
  assert.equal(t.partyFights, 1);
  assert.equal(t.joinerDowns, 1);
  assert.equal(t.joinerParleys, 1);
  assert.equal(t.parleySuccesses, 1);
  assert.equal(t.healCasts, 1);
  assert.equal(t.healCastsInFight, 1);
});

function run(over) {
  const watch = makeWatchTally();
  return { cls: "Fighter", sub: "Knight", race: "Human", deathDepth: 4, dead: true, stuck: false, cause: "cut down by a Ghoul", identity: { flees: 0 }, memberAtStart: 0, watch, ...over };
}

test("watch: watchReadout pools by class, Magic User sub-class and race; stuck runs leave the depth median; an empty pool prints no NaN", () => {
  const ill = run({ cls: "Magic User", sub: "Illusionist", race: "Fridgian", deathDepth: 6 });
  ill.watch.doorSeen = 2;
  ill.watch.fights = 4;
  ill.watch.frenzies = 1;
  ill.watch.strikes = 2;
  ill.identity = { flees: 3 };
  const starved = run({ cls: "Magic User", sub: "Wizard", deathDepth: 3, cause: "starved in the dark" });
  const stuck = run({ deathDepth: 20, dead: false, stuck: true, cause: "maxActionsHit" });
  const fighter = run({ deathDepth: 5 });
  const r = watchReadout([ill, starved, stuck, fighter]);
  const pool = (label) => r.pools.find((p) => p.label === label);
  assert.equal(pool("ALL").n, 4);
  assert.equal(pool("ALL").stuck, 1);
  assert.equal(pool("ALL").p50, 5);
  assert.equal(pool("class Magic User").n, 2);
  assert.equal(pool("MU Illusionist").n, 1);
  assert.equal(pool("MU Illusionist").p50, 6);
  assert.equal(pool("MU Illusionist").fleesPerRun, 3);
  assert.equal(pool("MU Illusionist").doorSeenPerRun, 2);
  assert.equal(pool("MU Summoner").n, 0);
  assert.equal(pool("MU Summoner").p50, null);
  assert.equal(pool("race Fridgian").n, 1);
  assert.equal(r.starvation.deaths, 3);
  assert.equal(r.starvation.starved, 1);
  assert.equal(r.starvation.floors.find((x) => x.floor === 3).starved, 1);
  assert.equal(r.fridgian.frenziesPerFight, 0.25);
  assert.equal(r.fridgian.frenziesPerStrike, 0.5);
  const text = formatWatchReadout(r).join("\n");
  assert.ok(!/NaN|undefined|Infinity/.test(text));
  assert.match(text, /^Watch list \(Phase 92/);
});

test("watch: watchReadout and formatWatchReadout on no results print no NaN", () => {
  const text = formatWatchReadout(watchReadout([])).join("\n");
  assert.ok(!/NaN|undefined|Infinity/.test(text));
});

test("watch: formatWatchReadout is byte-stable for the same input", () => {
  const a = run({ cls: "Thief", sub: "Burglar" });
  a.watch.abilityUses = { kata: 3 };
  a.watch.abilityFights = { kata: 2 };
  a.watch.abilitySecond = { kata: 1 };
  const x = formatWatchReadout(watchReadout([a, run({})])).join("\n");
  const y = formatWatchReadout(watchReadout([a, run({})])).join("\n");
  assert.equal(x, y);
  assert.match(x, /kata\s+91\.1/);
});
