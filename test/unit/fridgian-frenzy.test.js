// test/unit/fridgian-frenzy.test.js
//
// Phase 91 plan 09 (IDENT-20, user 2026-09-30): "Frenzy: each swing, a 4-6 on a
// d6 gives a second swing; no armour, thick hide soaks 2; the 'never wastes
// itself on a corpse' line is removed." One d6 check per strike action, sitting
// at the old d8's draw position (a changed die, not a new roll), a second swing
// one step narrower (the user's 2026-09-24 ruling), lost when the first swing
// kills its foe (Q6 A), never a third swing, and a Fridgian Joiner's hide soaks
// 2 (Q7 A, pinned in test/unit/joiner-armour-soak.test.js too).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { playerStrike, applyFoeDamageToPlayer } from "../../engine/combat.js";
import { RACES, RACE_NOTE } from "../../content/index.js";
import { identityFooter } from "../../src/browser/identityFooter.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { faceOdds, heroState, foeFrom, inCombat } from "./harness/rollOdds.js";

setIdentityDials();

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");

/** A scripted rng: `at(i, sides)` is the raw draw; every die size is logged. */
function scripted(at) {
  const sides = [];
  return {
    d(n) {
      const i = sides.length;
      sides.push(n);
      return Math.min(n, Math.max(1, at(i, n)));
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 1,
    sides,
  };
}

/** A raw draw that always misses (the worst roll-high face: raw = sides). */
const MISS = (_i, n) => n;

function fridgian(over = {}) {
  const state = heroState({ cls: "Fighter", sub: "Soldier", race: "Fridgian" });
  Object.assign(state.c, { weapon: "Club", magicWpn: 0, prof: 0, spellsUsed: 999, skills: {}, ...over });
  return state;
}

const bigFoe = (name = "Ned") => foeFrom("Humans", 1, name, { wp: 999 });
const SWING_TYPES = ["strikeMissed", "struck", "foeArmorSoaked"];
const swings = (events) => events.filter((e) => SWING_TYPES.includes(e.type)).length;

test("IDENT-20 odds: a raw d6 of 1, 2 or 3 (a roll of 6, 5 or 4) frenzies; 4, 5 or 6 does not (three faces of six)", () => {
  const odds = faceOdds(
    (rng) => {
      const state = inCombat(fridgian(), [bigFoe()]);
      return playerStrike(state, rng, []).some((e) => e.type === "frenzy");
    },
    { fill: (i, sides) => sides, label: "IDENT-20 frenzy die" },
  );
  assert.equal(odds.n, 6, "the frenzy check is a d6");
  assert.equal(odds.wins, 3, "a 4, 5 or 6 wins: half the time");
});

test("IDENT-20 boundary: a roll of 3 gives no frenzy and one swing, a roll of 4 gives the frenzy and a second swing", () => {
  const run = (rawFrenzy) => {
    const state = inCombat(fridgian(), [bigFoe()]);
    const rng = scripted((i, n) => (i === 0 ? rawFrenzy : n));
    const events = playerStrike(state, rng, []);
    return { events, rng };
  };
  const three = run(4); // roll = 6 + 1 - 4 = 3
  assert.equal(three.events.some((e) => e.type === "frenzy"), false);
  assert.equal(swings(three.events), 1);
  const four = run(3); // roll = 6 + 1 - 3 = 4
  const ev = four.events.find((e) => e.type === "frenzy");
  assert.ok(ev, "a 4 frenzies");
  assert.deepEqual({ roll: ev.roll, atLeast: ev.atLeast, dieN: ev.dieN }, { roll: 4, atLeast: 4, dieN: 6 });
  assert.equal(swings(four.events), 2);
});

test("IDENT-20 position: the d6 replaces the d8 at the same draw position; every later draw of the strike keeps its place", () => {
  const frenzy = scripted((i, n) => (i === 0 ? 1 : n));
  playerStrike(inCombat(fridgian(), [bigFoe()]), frenzy, []);
  const none = scripted((i, n) => n);
  playerStrike(inCombat(fridgian(), [bigFoe()]), none, []);
  assert.equal(frenzy.sides[0], 6, "the first draw of a Fridgian's strike is the frenzy d6");
  assert.equal(none.sides[0], 6);
  const strikeDie = frenzy.sides[1];
  assert.equal(frenzy.sides[2], strikeDie, "the frenzy swing is a second strike die, straight after the first");
  assert.deepEqual(frenzy.sides.slice(0, 2).concat(frenzy.sides.slice(3)), none.sides, "dropping the frenzy swing's one draw leaves the no-frenzy draw list: nothing else moved");
});

test("IDENT-20 ordering: the frenzy event comes before every strike event", () => {
  const events = playerStrike(inCombat(fridgian(), [bigFoe()]), scripted((i, n) => (i === 0 ? 1 : n)), []);
  const frenzyAt = events.findIndex((e) => e.type === "frenzy");
  const firstSwing = events.findIndex((e) => SWING_TYPES.includes(e.type));
  assert.ok(frenzyAt >= 0 && firstSwing > frenzyAt, `frenzy at ${frenzyAt}, first swing at ${firstSwing}`);
});

test("IDENT-20 narrow swing: the frenzy swing wins one face fewer than the first swing (floor 1)", () => {
  const landed = (rng) => {
    const events = [];
    playerStrike(inCombat(fridgian(), [bigFoe()]), rng, events);
    return events.some((e) => e.type === "struck" || e.type === "foeArmorSoaked");
  };
  const fill = (i, sides) => (i === 0 ? 1 : sides);
  const first = faceOdds(landed, { isProbe: (i) => i === 1, fill, label: "IDENT-20 swing 1" });
  const second = faceOdds(landed, { isProbe: (i) => i === 2, fill: (i, s) => (i === 0 ? 1 : i === 1 ? s : s), label: "IDENT-20 swing 2" });
  assert.equal(second.n, first.n);
  assert.equal(second.wins, first.wins - 1, "one step narrower, as the 2026-09-24 ruling set");
});

test("IDENT-20 edge (adjacency): a second attack from Ambidextrous keeps the normal to-hit; a frenzy on top never adds a third swing", () => {
  const withAmbi = () => inCombat(fridgian({ skills: { Ambidextrous: 1 } }), [bigFoe()]);
  const landed = (rng) => {
    const events = [];
    playerStrike(withAmbi(), rng, events);
    return events.some((e) => e.type === "struck" || e.type === "foeArmorSoaked");
  };
  // No frenzy (raw 6 = a roll of 1): swing 1 is draw 1, the Ambidextrous swing is draw 2.
  const noFrenzy = (i, sides) => (i === 0 ? sides : sides);
  const s1 = faceOdds(landed, { isProbe: (i) => i === 1, fill: noFrenzy, label: "ambi swing 1" });
  const s2 = faceOdds(landed, { isProbe: (i) => i === 2, fill: noFrenzy, label: "ambi swing 2" });
  assert.equal(s2.wins, s1.wins, "no frenzy fired: the second attack is a plain one at the full to-hit");
  // Frenzy fires on a hasted/Ambidextrous Fridgian: still exactly two swings.
  const events = playerStrike(withAmbi(), scripted((i, n) => (i === 0 ? 1 : n)), []);
  assert.ok(events.some((e) => e.type === "frenzy"));
  assert.equal(swings(events), 2, "the frenzy never adds a third swing");
});

test("IDENT-20 Q6 A (edge, empty): a first swing that kills its foe ends the strike; the frenzy swing is lost and the next live foe is untouched", () => {
  const dying = foeFrom("Humans", 1, "Ned", { wp: 1 });
  const next = { ...foeFrom("Humans", 1, "Ned", { wp: 999 }), name: "Ted" };
  const state = inCombat(fridgian(), [dying, next]);
  // Raw 1 everywhere: the frenzy fires (roll 6), the first swing hits on the best face and kills.
  const events = playerStrike(state, scripted(() => 1), []);
  assert.ok(events.some((e) => e.type === "frenzy"), "the frenzy was rolled");
  assert.equal(dying.alive, false);
  assert.equal(events.filter((e) => e.type === "struck" || e.type === "foeArmorSoaked").length, 1, "one swing only");
  assert.equal(next.wp, 999, "the frenzy swing does not carry to the next live foe");
});

// Phase 91.1 plan 03 (V17 B, 2026-10-01): the hide soaks 3 (was 2), so a 7 takes 4.
test("IDENT-20: a Fridgian still wears no armour, and the hero's hide soaks 3 from a landed blow (7 takes 4)", () => {
  assert.equal(RACES.Fridgian.noArmor, true);
  assert.equal(RACES.Fridgian.hide, 3);
  const state = heroState({ cls: "Fighter", sub: "Soldier", race: "Fridgian" });
  state.c.skills = {};
  const before = state.c.wp;
  applyFoeDamageToPlayer(state, foeFrom("Humans", 1, "Ned"), { d: () => 1, pick: (a) => a[0], shuffle: (a) => a, getState: () => 1 }, [], { dmg: 7, roll: 20, atLeast: 12, dieN: 20, mods: [] });
  assert.equal(before - state.c.wp, 4, "max(1, 7 - 3) = 4");
});

test("IDENT-20 text: the footer names the d6, the 4-6 and the -1 to hit; nothing the player reads promises the corpse rule", () => {
  const good = identityFooter("race", "Fridgian").good;
  const line = good.find((t) => t.startsWith("each time you strike"));
  assert.ok(line, `frenzy line missing in ${JSON.stringify(good)}`);
  assert.match(line, /d6/);
  assert.match(line, /4–6/);
  assert.match(line, /−1 to hit/);
  assert.ok(good.includes("thick hide soaks 3 from every blow"));
  assert.ok(identityFooter("race", "Fridgian").bad.includes("can never wear armour"));
  const all = [...good, ...identityFooter("race", "Fridgian").bad, RACE_NOTE.Fridgian, RACES.Fridgian.note].join(" ");
  assert.doesNotMatch(all, /corpse|already dead|five times in eight/i);
  assert.match(RACE_NOTE.Fridgian, /d6/);
  assert.match(RACES.Fridgian.note, /d6/);
});

test("IDENT-20 source pin: the engine rolls rollCheck(rng, 6, atLeastFor(3, 6)) and the footer source names the same check", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const combat = strip(read("engine/combat.js"));
  const i = combat.indexOf("if (R.frenzy) {");
  assert.ok(i !== -1);
  assert.match(combat.slice(i, i + 200), /rollCheck\(rng, 6, atLeastFor\(3, 6\)\)/);
  assert.equal((combat.match(/rollCheck\(rng, 6, atLeastFor\(3, 6\)\)/g) || []).length, 1);
  assert.match(read("src/browser/identityFooter.js"), /rollCheck\(rng, 6, atLeastFor\(3, 6\)\)/);
});
