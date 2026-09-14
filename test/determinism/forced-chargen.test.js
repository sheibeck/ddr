// test/determinism/forced-chargen.test.js
//
// HARN-01 acceptance suite (Phase 22, Plan 01): proves the dev-only `force`
// option on rollCharacter/newRun is a paired-comparison seam, not a rules
// change — forcing a combo a seed already rolls naturally must be
// byte-identical to the natural roll, the default (force omitted/null) path
// must stay byte-identical to every parity fixture, every chargen draw after
// the first three (class d6/sub d8/race d8) must sit at the identical rng
// cursor, and invalid/canon-impossible combos must throw with the valid keys
// named. See engine/character.js#normalizeForce and engine/state.js#newRun.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { rollCharacter } from "../../engine/character.js";
import { makeRng } from "../../engine/rng.js";
import { CLASSES, RACES } from "../../content/index.js";

// --- countingRng: copied verbatim from test/unit/foe-turn-draw-count.test.js
// (lines 41-79) — wraps ANY rng object and counts every draw-producing call:
// d()/pick()/next() each count as 1 draw; shuffle(arr) counts
// max(0, arr.length - 1) draws, matching engine/rng.js's Fisher-Yates loop.
function countingRng(inner) {
  let draws = 0;
  const wrapped = {
    d(n) {
      draws++;
      return inner.d(n);
    },
    pick(a) {
      draws++;
      return inner.pick(a);
    },
    shuffle(a) {
      draws += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    get draws() {
      return draws;
    },
  };
  if (typeof inner.next === "function") {
    wrapped.next = () => {
      draws++;
      return inner.next();
    };
  }
  if (typeof inner.getState === "function") wrapped.getState = inner.getState;
  if (typeof inner.setState === "function") wrapped.setState = inner.setState;
  return wrapped;
}

// The same paired seed list both tools (tune-classes.mjs, tune-difficulty.mjs)
// use for combo comparisons.
const PAIRED = (n) => Array.from({ length: n }, (_, i) => i * 7919 + 1);

// The only case where the natural roll may have consumed an extra sub d8 —
// the Fridgian/Samurai reroll loop (see engine/character.js). Those seeds are
// SKIPPED by the byte-identity sweep, never asserted against, because forcing
// their own natural combo cannot replay the extra draw the reroll consumed.
const couldHaveRerolled = (c) => c.race === "Fridgian" && c.cls === "Fighter";

test("HARN-01: byte-identity, pinned seeds (one per class)", () => {
  // Pinned via a one-off scan over PAIRED(400) (authoring time): the first
  // seed whose natural roll is a Magic User, the first Fighter that is not
  // Fridgian, and the first Thief.
  //   seed 7920  (i=1) -> Magic User / Court Mage / Dwarven
  //   seed 23758 (i=3) -> Fighter / Master of Arms / Human
  //   seed 31677 (i=4) -> Thief / Cutthroat / Elven
  const pinned = [7920, 23758, 31677];
  const classesSeen = new Set();
  for (const S of pinned) {
    const nat = newRun(S);
    classesSeen.add(nat.c.cls);
    const forced = newRun(S, [], { force: { cls: nat.c.cls, sub: nat.c.sub, race: nat.c.race } });
    assert.deepStrictEqual(forced, nat, `seed ${S}: forcing its own natural combo must be byte-identical`);
  }
  assert.equal(classesSeen.size, 3, "the three pinned seeds must cover three distinct classes");
});

test("HARN-01: byte-identity, sweep over PAIRED(80) (skipping Fridgian Fighters)", () => {
  const seeds = PAIRED(80);
  let compared = 0;
  for (const S of seeds) {
    const nat = newRun(S);
    if (couldHaveRerolled(nat.c)) continue; // natural reroll may have consumed an extra draw
    const forced = newRun(S, [], { force: { cls: nat.c.cls, sub: nat.c.sub, race: nat.c.race } });
    assert.deepStrictEqual(forced, nat, `seed ${S}: forcing its own natural combo must be byte-identical (incl. rngState, dev)`);
    assert.equal(forced.dev, false, `seed ${S}: forcing a natural combo must never flip dev`);
    compared++;
  }
  assert.ok(compared >= 60, `expected at least 60 comparable seeds in PAIRED(80), got ${compared}`);
});

test("HARN-01: default path (force undefined/null/{}) stays byte-identical", () => {
  for (const S of PAIRED(10)) {
    const base = newRun(S);
    assert.deepStrictEqual(newRun(S, [], {}), base, `seed ${S}: newRun(S, [], {}) must equal newRun(S)`);
    assert.deepStrictEqual(newRun(S, [], { force: undefined }), base, `seed ${S}: force: undefined must equal newRun(S)`);
    assert.deepStrictEqual(newRun(S, [], { force: null }), base, `seed ${S}: force: null must equal newRun(S)`);
    assert.deepStrictEqual(newRun(S, [], { startDepth: 1, force: null }), base, `seed ${S}: startDepth:1, force:null must equal newRun(S)`);
  }
});

test("HARN-01: draw-count parity — forced-with-its-own-combo consumes the same draws as natural", () => {
  const pinned = [7920, 23758, 31677];
  for (const S of pinned) {
    const rngA = countingRng(makeRng(S));
    const nat = rollCharacter(rngA);
    const rngB = countingRng(makeRng(S));
    const forced = rollCharacter(rngB, [], { cls: nat.cls, sub: nat.sub, race: nat.race });
    assert.equal(forced.cls, nat.cls);
    assert.equal(forced.sub, nat.sub);
    assert.equal(forced.race, nat.race);
    assert.equal(rngA.draws, rngB.draws, `seed ${S}: natural and forced draw counts must match`);
    assert.equal(rngA.getState(), rngB.getState(), `seed ${S}: natural and forced rng cursors must match after chargen`);
  }
});

test("HARN-01: exhaustive smoke — every one of the 143 valid combos rolls a valid, unenlarged character", () => {
  let visited = 0;
  const baselineKeys = Object.keys(newRun(1));
  for (const cls of Object.keys(CLASSES)) {
    for (const sub of CLASSES[cls].subs) {
      for (const race of Object.keys(RACES)) {
        if (sub === "Samurai" && race === "Fridgian") continue; // canon-impossible, excluded
        const state = newRun(1, [], { force: { cls, sub, race } });
        const c = state.c;
        assert.equal(c.cls, cls);
        assert.equal(c.sub, sub);
        assert.equal(c.race, race);
        assert.equal(c.level, 1);
        assert.deepStrictEqual(Object.keys(state), baselineKeys, `${cls}/${sub}/${race}: no new serialized field`);
        visited++;
      }
    }
  }
  assert.equal(visited, 143, "the exhaustive sweep must visit exactly 143 valid combos");
});

test("HARN-01: rejection — forced Fridgian Samurai throws (both fully-forced spellings)", () => {
  assert.throws(
    () => newRun(1, [], { force: { sub: "Samurai", race: "Fridgian" } }),
    /Fridg/i,
    "sub+race forced without cls must throw naming Fridgian",
  );
  assert.throws(
    () => newRun(1, [], { force: { cls: "Fighter", sub: "Samurai", race: "Fridgian" } }),
    /Fridg/i,
    "cls+sub+race all forced must also throw naming Fridgian",
  );
});

test("HARN-01: unknown/mismatched names throw with the valid keys listed", () => {
  assert.throws(
    () => newRun(1, [], { force: { cls: "Wizard" } }), // Wizard is a sub, not a class
    /Magic User/,
    "an invalid cls must list the real class names",
  );
  assert.throws(
    () => newRun(1, [], { force: { sub: "Paladin" } }), // not a sub of any class
    (e) => /Wizard/.test(e.message) || /Knight/.test(e.message) || /Pickpocket/.test(e.message),
    "an invalid sub must list real subclass names",
  );
  assert.throws(
    () => newRun(1, [], { force: { race: "Orc" } }), // not a RACES key
    /Troll/,
    "an invalid race must list the real race names",
  );
  assert.throws(
    () => newRun(1, [], { force: { cls: "Fighter", sub: "Wizard" } }), // Wizard is not a Fighter sub
    Error,
    "a cls/sub mismatch must throw",
  );
  assert.throws(
    () => newRun(1, [], { force: { sub: 42 } }), // non-string
    Error,
    "a non-string sub must throw",
  );
  assert.throws(
    () => newRun(1, [], { force: { bogus: "x" } }), // unknown key
    Error,
    "an unknown force key must throw",
  );
});

test("HARN-01: partial force — only race substitutes race, leaves natural cls/sub", () => {
  // seed 7920's natural roll: Magic User / Court Mage / Dwarven (non-Fridgian).
  const S = 7920;
  const nat = newRun(S).c;
  const forcedRace = newRun(S, [], { force: { race: "Troll" } }).c;
  assert.equal(forcedRace.race, "Troll");
  assert.equal(forcedRace.cls, nat.cls);
  assert.equal(forcedRace.sub, nat.sub);

  const forcedSub = newRun(S, [], { force: { sub: "Summoner" } }).c;
  assert.equal(forcedSub.cls, "Magic User", "cls is inferred from the forced sub");
  assert.equal(forcedSub.sub, "Summoner");
  if (nat.race !== "Fridgian") assert.equal(forcedSub.race, nat.race);
});

test("HARN-01: forced Samurai against a naturally-rolled Fridgian throws, but a forced race rescues it", () => {
  // seed 1's natural roll includes race Fridgian (Fighter/Knight/Fridgian) —
  // scanned from PAIRED(400) at authoring time.
  const S = 1;
  assert.equal(newRun(S).c.race, "Fridgian", "seed 1 must naturally roll a Fridgian (authoring-time pin)");
  assert.throws(
    () => newRun(S, [], { force: { sub: "Samurai" } }),
    /Fridg/i,
    "a forced Samurai against a naturally-Fridgian race must throw",
  );
  assert.doesNotThrow(() => newRun(S, [], { force: { sub: "Samurai", race: "Human" } }));
});
