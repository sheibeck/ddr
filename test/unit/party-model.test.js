// Phase 7 — Party Model + Save Migration (PARTY-02, PARTY-08).
//
// Proves the new top-level persistent roster `state.party[]`:
//   - initializes as an empty array with NO new chargen rng draw (determinism);
//   - serializes and rehydrates losslessly with a full member sheet (round-trip);
//   - migrates a pre-Phase-7 save (no `party` field) to `party: []` with zero
//     other data loss, and fails open on malformed party data (never throws,
//     never nukes the run — drops bad members / defaults to []);
//   - is capped at PARTY_CAP (1 in v1) while the append helper is written for N.
//
// Party is still INERT in combat this phase — these tests only exercise the
// model + save layer, not any gameplay wiring.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, addPartyMember, PARTY_CAP } from "../../engine/state.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { rollCharacter } from "../../engine/character.js";
import { makeRng } from "../../engine/rng.js";

/** A full rollCharacter()-shaped sheet, rolled off its own throwaway rng so it
 * never perturbs the run's seeded cursor. */
function makeMember(seed) {
  return rollCharacter(makeRng(seed));
}

test("newRun seeds an empty top-level party array (sibling of c/combat, not on either)", () => {
  const s = newRun(1);
  assert.ok(Array.isArray(s.party), "state.party must be an array");
  assert.equal(s.party.length, 0, "a fresh run starts with an empty party");
  assert.equal("party" in s.c, false, "party must NOT live on state.c");
  assert.equal(s.combat, null, "party must NOT live on state.combat (nulled on reload)");
});

test("party init adds NO rng draw — newRun(seed) stays byte-identical", () => {
  for (const seed of [1, 42, 256, 12345]) {
    const a = newRun(seed);
    const b = newRun(seed);
    assert.deepStrictEqual(a, b, `seed ${seed}: two newRun() calls must be byte-identical`);
    // The rolled character and the persisted rng cursor are the determinism
    // surface the parity suite freezes; both must be untouched by party init.
    assert.deepStrictEqual(a.c, b.c, `seed ${seed}: rolled character unchanged`);
    assert.equal(a.rngState, b.rngState, `seed ${seed}: rng cursor not advanced by party init`);
  }
});

test("round-trip: a non-empty party serializes and rehydrates losslessly", () => {
  const s = newRun(42);
  const member = makeMember(7);
  assert.equal(addPartyMember(s, member), true, "first member must be accepted");
  assert.equal(s.party.length, 1);

  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.equal(check.ok, true, "a save carrying a full member sheet must validate");
  const rehydrated = rehydrate(check.value);

  assert.deepStrictEqual(rehydrated.party, s.party, "the party must round-trip deep-equal");
  assert.deepStrictEqual(rehydrated.party[0], member, "the member sheet survives byte-for-byte");
});

test("migration: a pre-Phase-7 save with NO party field rehydrates to party:[] with no other loss", () => {
  const s = newRun(99);
  const persisted = serializeRun(s);
  // Simulate an OLD save that predates the party field entirely.
  delete persisted.party;
  assert.equal("party" in persisted, false);

  const check = validateSave(JSON.stringify(persisted));
  assert.equal(check.ok, true, "an old save must still load, not be rejected");
  const rehydrated = rehydrate(check.value);

  assert.ok(Array.isArray(rehydrated.party), "missing party must default to an array");
  assert.equal(rehydrated.party.length, 0, "missing party defaults to empty []");
  // Zero data loss on everything else.
  assert.deepStrictEqual(rehydrated.c, s.c, "character survives migration intact");
  assert.equal(rehydrated.seed, s.seed);
  assert.equal(rehydrated.rngState, s.rngState);
  assert.equal(rehydrated.day, s.day);
  assert.equal(rehydrated.steps, s.steps);
});

test("fail-open: a non-array party (party:'x') degrades to [] without throwing", () => {
  const s = newRun(5);
  const persisted = { ...serializeRun(s), party: "x" };

  let check;
  assert.doesNotThrow(() => { check = validateSave(JSON.stringify(persisted)); });
  assert.equal(check.ok, true, "a tampered party must not reject the whole save");
  const rehydrated = rehydrate(check.value);
  assert.deepStrictEqual(rehydrated.party, [], "a non-array party fails open to []");
});

test("fail-open: malformed members (party:[null] / bad shapes) are dropped, good ones kept", () => {
  const s = newRun(5);
  const good = makeMember(11);
  const persisted = {
    ...serializeRun(s),
    party: [null, good, { not: "a character" }, 42, "nope"],
  };

  let check;
  assert.doesNotThrow(() => { check = validateSave(JSON.stringify(persisted)); });
  assert.equal(check.ok, true);
  const rehydrated = rehydrate(check.value);
  assert.equal(rehydrated.party.length, 1, "only the one valid member survives");
  assert.deepStrictEqual(rehydrated.party[0], good, "the valid member is preserved intact");

  // rehydrate() must also fail open on its own if handed a malformed party
  // directly (not just via validateSave).
  assert.doesNotThrow(() => rehydrate({ ...s, party: [null] }));
  assert.deepStrictEqual(rehydrate({ ...s, party: [null] }).party, []);
});

test("cap: addPartyMember enforces PARTY_CAP (1 in v1) and is written for N", () => {
  assert.equal(PARTY_CAP, 1, "v1 caps the roster at a single joiner");
  const s = newRun(3);
  assert.equal(addPartyMember(s, makeMember(1)), true, "first member fits under the cap");
  assert.equal(addPartyMember(s, makeMember(2)), false, "second member is refused at cap");
  assert.equal(s.party.length, PARTY_CAP, "the array never exceeds PARTY_CAP");

  // Fail-open: a missing/non-array party is initialized before append.
  const bare = newRun(4);
  delete bare.party;
  assert.equal(addPartyMember(bare, makeMember(9)), true);
  assert.equal(bare.party.length, 1);
});
