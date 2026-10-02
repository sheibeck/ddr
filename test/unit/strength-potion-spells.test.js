// test/unit/strength-potion-spells.test.js
//
// Phase 92.2 plan 01, ruling 1 (user 2026-10-02): "Strength potion description
// says bonus damage applies to melee and spells. I cast Freeze and did 5." The
// Strength potion's +8 now rides with the Strength spell's d10 at every hero
// damage-spell roll (derived.js#spellStrengthParts), per roll and per target
// hit, and never on a damage-over-time tick. Melee stays +8.

import test from "node:test";
import assert from "node:assert/strict";

import { playerStrike } from "../../engine/combat.js";
import { startEffect } from "../../engine/effects.js";
import { potionMight, spellStrengthParts, spellStrengthBonus } from "../../engine/derived.js";
import { POTIONS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { IDX, MIGHT, d10At, mkRng, hero, foe, withStrength, stateOf, cast } from "./harness/strengthCast.js";

setIdentityDials();

test("the potion: its text says blows and spells, and it still carries the one +8 payload", () => {
  const p = POTIONS.find((x) => x.n === "Strength");
  assert.match(p.txt, /\+8 damage to blows and spells, 25 squares/);
  assert.equal(p.act.might, MIGHT);
});

test("helper: spellStrengthParts is the spell's d10 plus the potion's flat bonus, from the sheet's own records", () => {
  const none = hero();
  const potion = withStrength(hero(), "potion");
  const spell = withStrength(hero(), "spell");
  const both = withStrength(hero(), "both");
  assert.deepStrictEqual(spellStrengthParts(none, mkRng([])), { strength: 0, might: 0, total: 0 });
  assert.deepStrictEqual(spellStrengthParts(potion, mkRng([])), { strength: 0, might: MIGHT, total: MIGHT });
  assert.deepStrictEqual(spellStrengthParts(spell, mkRng([])), { strength: d10At(0), might: 0, total: d10At(0) });
  assert.deepStrictEqual(spellStrengthParts(both, mkRng([])), { strength: d10At(0), might: MIGHT, total: d10At(0) + MIGHT });
  assert.equal(spellStrengthBonus(both, mkRng([])), d10At(0) + MIGHT);
  assert.equal(potionMight(both), MIGHT);
  // The potion is the drinker's: a sheet without the record (a Joiner beside a drinking hero) gets nothing.
  assert.equal(spellStrengthBonus(none, mkRng([])), 0);
});

test("Freeze: with only the potion live, the damage is the no-potion damage + 8 on the same seed (levels 1 and 3, eight seeds)", () => {
  let landed = 0;
  for (const level of [1, 3]) {
    for (let seed = 1; seed <= 8; seed++) {
      const none = cast("Freeze", "none", { level, seed });
      const potion = cast("Freeze", "potion", { level, seed });
      const hit0 = none.events.find((e) => e.type === "spellHit");
      const hit1 = potion.events.find((e) => e.type === "spellHit");
      assert.equal(!!hit0, !!hit1, `level ${level} seed ${seed}: the same hit or miss`);
      if (!hit0) continue;
      landed++;
      assert.equal(hit1.dmg, hit0.dmg + MIGHT, `level ${level} seed ${seed}`);
      assert.equal(potion.lost[0], none.lost[0] + MIGHT);
    }
  }
  assert.ok(landed >= 8, "enough landed casts compared");
});

test("Freeze: potion and spell together add both on the same seed", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const none = cast("Freeze", "none", { seed });
    const spell = cast("Freeze", "spell", { seed });
    const both = cast("Freeze", "both", { seed });
    if (!none.events.some((e) => e.type === "spellHit")) continue;
    assert.equal(both.lost[0], spell.lost[0] + MIGHT, `seed ${seed}: the potion adds its +8 on top of the spell's d10`);
  }
});

test("Fireball (a thrown spell): the potion adds +8 to the roll, once per target hit", () => {
  const none = cast("Fireball", "none", { seq: [1, 5, 5, 20] });
  const potion = cast("Fireball", "potion", { seq: [1, 5, 5, 20] });
  assert.equal(potion.lost[0], none.lost[0] + MIGHT);
});

test("Lightning: the potion adds +8 for each foe the bolt reaches", () => {
  const opts = { level: 4, foes: [{ name: "A" }, { name: "B" }], seq: [1, 5, 1, 5, 20, 20] };
  const none = cast("Lightning", "none", opts);
  const potion = cast("Lightning", "potion", opts);
  assert.deepStrictEqual(potion.lost, none.lost.map((d) => d + MIGHT));
});

test("Fireballs (volley): the potion adds +8 to each bolt", () => {
  const opts = { level: 4, seq: [2, 5, 3, 20] };
  const none = cast("Fireballs", "none", opts);
  const potion = cast("Fireballs", "potion", opts);
  const vol = (r) => r.events.find((e) => e.type === "volley");
  assert.equal(vol(potion).rolls, 2);
  assert.equal(vol(potion).totalDamage, vol(none).totalDamage + 2 * MIGHT, "one +8 per bolt");
});

test("Earthquake: every foe takes +8; the caster's backlash is the dice alone", () => {
  const opts = { level: 4, foes: [{ name: "A" }, { name: "B" }], seq: [10, 10, 10, 20, 20] };
  const none = cast("Earthquake", "none", opts);
  const potion = cast("Earthquake", "potion", opts);
  assert.deepStrictEqual(potion.lost, none.lost.map((d) => d + MIGHT));
  assert.equal(potion.state.c.wp, none.state.c.wp, "the backlash does not grow");
});

test("Ice: the potion adds +8 to each foe's damage", () => {
  const opts = { level: 3, foes: [{ name: "A" }, { name: "B" }], seed: 3 };
  const none = cast("Ice", "none", opts);
  const potion = cast("Ice", "potion", opts);
  const hits = (r) => r.events.filter((e) => e.type === "spellHit");
  assert.equal(hits(potion).length, 2);
  hits(potion).forEach((h, i) => assert.equal(h.dmg, hits(none)[i].dmg + MIGHT, `foe ${i}`));
});

test("every damage spell the hero can cast reads the shared helper: no hero damage-spell site rolls the spell's d10 on its own", async () => {
  const fs = await import("node:fs");
  for (const f of ["engine/magic.js", "engine/combat.js"]) {
    const src = fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.equal(/strengthRoll\(/.test(src), false, `${f}: strengthRoll is called only through spellStrengthParts`);
  }
});

test("melee: a blow is still +8 with the potion live", () => {
  const strike = (mode) => {
    const c = withStrength(hero({ cls: "Fighter", sub: "Knight", weapon: "Club", grimoire: [] }), mode);
    const state = stateOf(c, [foe()]);
    return playerStrike(state, mkRng([5, 4, 20]), []).find((e) => e.type === "struck");
  };
  assert.equal(strike("potion").dmg, strike("none").dmg + MIGHT);
});

test("the potion is the drinker's: a Joiner's sheet without the record gets none, one with the record gets it", () => {
  const joiner = hero({ cls: "Magic User", sub: "Wizard" });
  assert.equal(spellStrengthBonus(joiner, mkRng([])), 0);
  startEffect(joiner, "item:Strength", { squares: 25 });
  assert.equal(spellStrengthBonus(joiner, mkRng([])), MIGHT);
  assert.ok(IDX.Freeze >= 0);
});
