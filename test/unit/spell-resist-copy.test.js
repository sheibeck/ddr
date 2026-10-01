// test/unit/spell-resist-copy.test.js
//
// Quick 260927-rsx (user ruling 2026-09-27): "I want the resist rolls noted
// in the Oracle, too." The presentation half of the spell-resist rule
// (test/unit/spell-resist.test.js holds the engine half):
//   - every resist roll, success AND failure, is its own Oracle line with the
//     roll and its roll-high range, naming whose spell it was;
//   - the rail twins name the spell; a failed resist folds behind the effect
//     it let through (a throw, a Joiner's outcome, a room spell's summary),
//     so a resist on every cast never doubles the rail or the fight log —
//     the Oracle keeps every roll either way. Resist lines are never a
//     dismissible card (CARD_EVENTS is only floorChanged / leveled);
//   - a Weaken that some foes resisted says so instead of "every foe".

import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, linesForAction, CARD_EVENTS } from "../../src/browser/narrationLines.js";

const strip = (html) => String(html).replace(/<[^>]+>/g, "");
const resisted = { type: "spellResisted", target: "the Orc", spell: "Fireball", roll: 19, atLeast: 16, dieN: 20, intel: 10, faces: 5 };
const failed = { type: "resistFailed", target: "the Orc", spell: "Fireball", roll: 4, atLeast: 16, dieN: 20, intel: 10, faces: 5 };

test("the Oracle notes both outcomes with the roll and the range, and whose spell it was", () => {
  const o1 = strip(EVENT_NARRATION.spellResisted(resisted));
  const o2 = strip(EVENT_NARRATION.resistFailed(failed));
  assert.equal(o1, "the Orc resists your Fireball: no effect. 19 vs 16–20 (intel 10).");
  assert.equal(o2, "the Orc fails to resist your Fireball. 4 vs 16–20 (intel 10).");
  assert.match(strip(EVENT_NARRATION.spellResisted({ ...resisted, by: "Ada" })), /^the Orc resists Ada's Fireball: no effect\./);
  assert.match(strip(EVENT_NARRATION.resistFailed({ ...failed, by: "Ada" })), /^the Orc fails to resist Ada's Fireball\./);
  // A bare event never throws.
  assert.doesNotThrow(() => EVENT_NARRATION.spellResisted({ type: "spellResisted" }));
  assert.doesNotThrow(() => EVENT_NARRATION.resistFailed({ type: "resistFailed" }));
});

test("the rail twins name the spell; resist lines are never a dismissible card", () => {
  assert.equal(LINE_FOR.spellResisted(resisted).text, "the Orc resists your Fireball: no effect");
  assert.equal(LINE_FOR.spellResisted(resisted).tone, "miss");
  assert.equal(LINE_FOR.resistFailed(failed).text, "the Orc fails to resist your Fireball.");
  assert.equal(LINE_FOR.spellResisted({ ...resisted, by: "Ada" }).text, "the Orc resists Ada's Fireball: no effect");
  assert.equal(CARD_EVENTS.has("spellResisted"), false);
  assert.equal(CARD_EVENTS.has("resistFailed"), false);
});

test("a failed resist folds behind the throw it let through (both orders); a resist stands as its own line", () => {
  const events = [
    failed,
    { type: "spellThrown", spell: "Fireball", target: "the Orc", roll: 7, atLeast: 5, dieN: 8 },
    { type: "spellHit", target: "the Orc", dmg: 9, mult: 1 },
  ];
  for (const order of ["priority", "event"]) {
    const out = linesForAction("castSpell", events, {}, { order });
    assert.equal(out.length, 1, `${order}: ${JSON.stringify(out.map((l) => l.text))}`);
    assert.match(out[0].text, /Fireball hits the Orc \(9\)/);
  }
  const alone = linesForAction("castSpell", [resisted], {}, { order: "event" });
  assert.deepEqual(alone.map((l) => l.text), ["the Orc resists your Fireball: no effect"]);
});

// Phase 90 plan 05: Stun holds one foe now (its `stunned { count }` summary line is retired), so the room
// spell this pin uses is Weaken, whose `weakened` line is the untargeted summary a run of failed resists folds into.
test("a room spell's run of failed resists folds into its summary line (Weaken), in the event order too", () => {
  const events = [
    { type: "resistFailed", target: "A", spell: "Weaken", roll: 3, atLeast: 20, dieN: 20, intel: 1, faces: 1 },
    { type: "resistFailed", target: "B", spell: "Weaken", roll: 9, atLeast: 20, dieN: 20, intel: 1, faces: 1 },
    { type: "weakened", rounds: 3 },
  ];
  for (const order of ["priority", "event"]) {
    const out = linesForAction("castSpell", events, {}, { order });
    assert.equal(out.length, 1, `${order}: ${JSON.stringify(out.map((l) => l.text))}`);
  }
});

test("a Joiner's failed resist folds behind the Joiner's outcome", () => {
  const events = [
    { type: "allyCast", name: "Ada", spell: "Doze", target: "the Orc" },
    { type: "resistFailed", target: "the Orc", spell: "Doze", by: "Ada", roll: 2, atLeast: 16, dieN: 20, intel: 10, faces: 5 },
    // Phase 90 plan 05: a Joiner's Doze says `dozed` with `by` (before: allySpellHit { effect: "asleep" }).
    { type: "dozed", target: "the Orc", rounds: 3, by: "Ada" },
  ];
  const out = linesForAction("alliesTurn", events, {}, { order: "event" });
  assert.equal(out.filter((l) => /fails to resist/.test(l.text)).length, 0, JSON.stringify(out.map((l) => l.text)));
});

test("weakened with spared foes says so instead of 'every foe' (Oracle and rail)", () => {
  assert.match(strip(EVENT_NARRATION.weakened({ type: "weakened", rounds: 3, spared: 1 })), /^Every foe but the one that resisted is weakened for 3 rounds/);
  assert.match(strip(EVENT_NARRATION.weakened({ type: "weakened", rounds: 3, spared: 2 })), /^Every foe but the 2 that resisted is weakened/);
  assert.match(strip(EVENT_NARRATION.weakened({ type: "weakened", rounds: 3 })), /^Every foe is weakened for 3 rounds/);
  assert.match(LINE_FOR.weakened({ type: "weakened", rounds: 3, spared: 1 }).text, /^Every foe but one weakened, 3 rounds/);
  assert.match(LINE_FOR.weakened({ type: "weakened", rounds: 3, spared: 2 }).text, /^Every foe but 2 weakened, 3 rounds/);
  assert.match(LINE_FOR.weakened({ type: "weakened", rounds: 3 }).text, /^Every foe weakened, 3 rounds/);
});
