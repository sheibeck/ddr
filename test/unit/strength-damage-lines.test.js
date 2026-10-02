// test/unit/strength-damage-lines.test.js
//
// Phase 92.2 plan 01, ruling 2 (user 2026-10-02): "I can't tell if the Strength
// bonus rolled in." The damage events report the Strength parts that actually
// applied, `might` (the potion's +8) and `strength` (the spell's d10), each only
// when above 0 and with no new main-rng draw; the Oracle line and its rail twin
// append a clause only when a field is present, so every old line is unchanged.

import test from "node:test";
import assert from "node:assert/strict";

import { playerStrike } from "../../engine/combat.js";
import { weaponDamage, weaponDamageParts, strengthFields } from "../../engine/derived.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { MIGHT, d10At, mkRng, hero, foe, withStrength, stateOf, cast } from "./harness/strengthCast.js";

setIdentityDials();

test("strengthFields: a key only for a part above 0", () => {
  assert.deepStrictEqual(strengthFields({ strength: 0, might: 0 }), {});
  assert.deepStrictEqual(strengthFields({ strength: 4, might: 0 }), { strength: 4 });
  assert.deepStrictEqual(strengthFields({ strength: 0, might: 8 }), { might: 8 });
  assert.deepStrictEqual(strengthFields(undefined), {});
});

test("spellHit (Freeze): the potion reports might, the spell reports its d10, neither reports nothing", () => {
  let landed = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const hit = (mode) => cast("Freeze", mode, { seed }).events.find((e) => e.type === "spellHit");
    const none = hit("none");
    if (!none) continue;
    landed++;
    assert.equal("might" in none || "strength" in none, false, "no key at all without a Strength");
    const potion = hit("potion");
    assert.equal(potion.might, MIGHT);
    assert.equal("strength" in potion, false);
    const both = hit("both");
    assert.equal(both.might, MIGHT);
    assert.ok(both.strength >= 1 && both.strength <= 10, "the reported d10");
    assert.equal(both.dmg, none.dmg + MIGHT + both.strength, "the reported parts are exactly what was added");
  }
  assert.ok(landed >= 4);
});

test("volley, earthquake and Ice report the Strength parts that applied", () => {
  const vol = cast("Fireballs", "potion", { level: 4, seq: [2, 5, 3, 20] }).events.find((e) => e.type === "volley");
  assert.equal(vol.might, 2 * MIGHT, "summed over the two bolts");
  assert.equal("might" in cast("Fireballs", "none", { level: 4, seq: [2, 5, 3, 20] }).events.find((e) => e.type === "volley"), false);

  const opts = { level: 4, foes: [{ name: "A" }, { name: "B" }], seq: [10, 10, 10, 20, 20] };
  const q = cast("Earthquake", "potion", opts).events.find((e) => e.type === "earthquake");
  assert.equal(q.might, MIGHT);
  assert.equal(q.amount, cast("Earthquake", "none", opts).events.find((e) => e.type === "earthquake").amount + MIGHT);
  const qs = cast("Earthquake", "spell", opts).events.find((e) => e.type === "earthquake");
  assert.equal(qs.strength, d10At(0));
  assert.equal("might" in qs, false);

  const ice = cast("Ice", "both", { level: 3, foes: [{ name: "A" }, { name: "B" }], seed: 3 }).events.filter((e) => e.type === "spellHit");
  assert.equal(ice.length, 2);
  for (const h of ice) {
    assert.equal(h.might, MIGHT);
    assert.ok(h.strength >= 1);
  }
});

test("struck (melee): might and strength report what applied; a bare blow adds no key; the main rng draws no more", () => {
  const strike = (mode) => {
    const c = withStrength(hero({ cls: "Fighter", sub: "Knight", weapon: "Club", grimoire: [] }), mode);
    const state = stateOf(c, [foe()]);
    const rng = mkRng([5, 4, 20]);
    return playerStrike(state, rng, []).find((e) => e.type === "struck");
  };
  const none = strike("none");
  const potion = strike("potion");
  const both = strike("both");
  assert.equal("might" in none || "strength" in none, false);
  assert.equal(potion.might, MIGHT);
  assert.equal("strength" in potion, false);
  assert.equal(both.strength, d10At(0));
  assert.equal(both.dmg, none.dmg + MIGHT + both.strength);
});

test("weaponDamageParts: the same number as weaponDamage; a Sorcerer's cap that swallows the bonus reports none", () => {
  const c = withStrength(hero({ cls: "Fighter", sub: "Knight", weapon: "Club" }), "potion");
  for (const v of [1, 3, 4]) {
    const parts = weaponDamageParts(c, mkRng([v]));
    assert.equal(parts.dmg, weaponDamage(c, mkRng([v])));
    assert.equal(parts.might, MIGHT);
  }
  const sorc = withStrength(hero({ cls: "Magic User", sub: "Sorcerer", weapon: "Club", level: 5 }), "potion");
  const capped = weaponDamageParts(sorc, mkRng([4]));
  assert.equal(capped.dmg, 9);
  assert.equal(capped.might, 0, "the cap swallowed it: the line says nothing");
});

const plainText = (html) => html.replace(/<[^>]+>/g, "");

test("Oracle: the clause appears only when a Strength field is present, so the old lines are untouched", () => {
  const struck = { type: "struck", target: "Wolf", roll: 5, atLeast: 4, dieN: 20, dmg: 13, critical: false };
  assert.equal(plainText(EVENT_NARRATION.struck(struck)).includes("incl."), false);
  assert.match(plainText(EVENT_NARRATION.struck({ ...struck, might: 8, strength: 6 })), /for 13 hp \(incl\. \+8 Strength potion, \+6 Strength\)\./);
  assert.match(plainText(EVENT_NARRATION.struck({ ...struck, might: 8 })), /for 13 hp \(incl\. \+8 Strength potion\)\./);

  const hit = { type: "spellHit", target: "Wolf", dmg: 18, levelSq: 9 };
  assert.match(plainText(EVENT_NARRATION.spellHit(hit)), /takes 18 hp \(the roll \+9, for your level\)\./);
  assert.match(plainText(EVENT_NARRATION.spellHit({ ...hit, might: 8, strength: 6 })), /takes 18 hp \(the roll \+9, for your level, incl\. \+8 Strength potion, \+6 Strength\)\./);
  assert.match(plainText(EVENT_NARRATION.spellHit({ type: "spellHit", target: "Wolf", dmg: 10, levelSq: 1, might: 8 })), /takes 10 hp \(incl\. \+8 Strength potion\)\./);
  assert.match(plainText(EVENT_NARRATION.spellHit({ type: "spellHit", target: "Wolf", dmg: 3, levelSq: 1 })), /takes 3 hp\./);

  assert.match(plainText(EVENT_NARRATION.earthquake({ type: "earthquake", amount: 20 })), /damage to every foe in the room\.$/);
  assert.match(plainText(EVENT_NARRATION.earthquake({ type: "earthquake", amount: 20, might: 8 })), /in the room \(incl\. \+8 Strength potion\)\.$/);
  assert.match(plainText(EVENT_NARRATION.volley({ type: "volley", rolls: 2, totalDamage: 30, might: 16 })), /2 shots, 30 total damage \(incl\. \+16 Strength potion\)\.$/);
  assert.match(plainText(EVENT_NARRATION.volley({ type: "volley", rolls: 2, totalDamage: 30 })), /total damage\.$/);
  // null-safe for a bare payload (the voice scan)
  for (const k of ["struck", "spellHit", "earthquake", "volley"]) assert.doesNotThrow(() => EVENT_NARRATION[k]({ type: k }));
});

test("rail: a compact 'incl.' tail naming the same numbers, only when a Strength field is present", () => {
  assert.equal(LINE_FOR.struck({ type: "struck", target: "Wolf", dmg: 13 }).text, "You hit Wolf (13)");
  assert.equal(LINE_FOR.struck({ type: "struck", target: "Wolf", dmg: 13, might: 8 }).text, "You hit Wolf (13, incl. +8)");
  assert.equal(LINE_FOR.struck({ type: "struck", target: "Wolf", dmg: 13, might: 8, strength: 6 }).text, "You hit Wolf (13, incl. +8, +6)");
  assert.equal(LINE_FOR.spellHit({ type: "spellHit", spell: "Freeze", target: "Wolf", dmg: 5, levelSq: 1 }).text, "Freeze hits Wolf (5)");
  assert.equal(LINE_FOR.spellHit({ type: "spellHit", spell: "Freeze", target: "Wolf", dmg: 13, levelSq: 1, might: 8 }).text, "Freeze hits Wolf (13, incl. +8)");
  assert.equal(LINE_FOR.earthquake({ type: "earthquake", amount: 20 }).text, "The floor heaves: 20 to every foe.");
  assert.equal(LINE_FOR.earthquake({ type: "earthquake", amount: 20, might: 8 }).text, "The floor heaves: 20 to every foe (incl. +8).");
  assert.equal(LINE_FOR.volley({ type: "volley", rolls: 2, totalDamage: 30 }).text, "2 shots, 30 total.");
  assert.equal(LINE_FOR.volley({ type: "volley", rolls: 2, totalDamage: 30, might: 16 }).text, "2 shots, 30 total (incl. +16).");
  for (const k of ["struck", "spellHit", "earthquake", "volley"]) assert.doesNotThrow(() => LINE_FOR[k]({ type: k }));
});

test("a hero spellHit folded with its Freeze hold carries the incl. tail on the one rail line", async () => {
  const { linesForAction } = await import("../../src/browser/narrationLines.js");
  const lines = linesForAction("cast", [
    { type: "spellThrown", spell: "Freeze", target: "Wolf", roll: 5, atLeast: 4, dieN: 8 },
    { type: "spellHit", target: "Wolf", dmg: 13, levelSq: 1, might: 8 },
    { type: "controlHeld", target: "Wolf", rounds: 2, freeze: true, kind: "frozen" },
  ]);
  assert.ok(lines.some((l) => /Freeze hits Wolf \(13, incl\. \+8\), frozen for 2 rounds/.test(l.text)));
});
