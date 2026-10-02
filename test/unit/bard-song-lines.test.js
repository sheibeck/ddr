// test/unit/bard-song-lines.test.js
//
// Phase 91 (IDENT-17, plan 91-06): the Bard's song on both narration surfaces.
// The `sang` event now carries { title, spell, level } (the old `song` name of
// one of five fixed songs is gone), and the second SING in a fight is refused
// with actionRefused { action: "sing", reason: "sungThisFight" }. Every new
// event line has its Oracle line and its rail twin (the EVENT_NARRATION entry
// and the LINE_FOR builder), the four per-song builders are retired, and a
// bare payload never prints "undefined" or "NaN".

import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_NARRATION, narrateEvent } from "../../src/browser/eventNarration.js";
import { LINE_FOR, narrativeLineText } from "../../src/browser/narrationLines.js";

const oracle = (e) => narrativeLineText(narrateEvent(e));
const rail = (e) => LINE_FOR[e.type](e).text;

test("IDENT-17 sang: the Oracle line quotes the title and names the spell the song lands as", () => {
  const e = { type: "sang", title: "An Ode to Freeze", spell: "Freeze", level: 1 };
  const text = oracle(e);
  assert.ok(text.includes('"An Ode to Freeze"'), text);
  assert.ok(text.includes("Freeze"), text);
  assert.ok(text.includes("The song lands as Freeze"), text);
});

test("IDENT-17 sang: the rail twin carries the title and the spell, short", () => {
  const e = { type: "sang", title: "The Ballad of Doze", spell: "Doze", level: 1 };
  assert.equal(rail(e), "Song: The Ballad of Doze (Doze)");
  const line = LINE_FOR.sang(e);
  assert.equal(line.tone, "magic");
});

test("IDENT-17 sang: an old song name is sung as is, with the spell it landed as", () => {
  const e = { type: "sang", title: "Lullaby", spell: "Doze", level: 1 };
  assert.ok(oracle(e).includes('"Lullaby"'));
  assert.ok(rail(e).includes("Lullaby") && rail(e).includes("Doze"));
});

test("IDENT-17 refusal: sungThisFight reads on both surfaces", () => {
  const e = { type: "actionRefused", action: "sing", reason: "sungThisFight" };
  // Phase 91.1 plan 03 part B (V7 B, 2026-10-01): a Bard may sing a second song 5 rounds after the first, so the
  // refusal after the second song reads "Two songs a fight" (the one before it is songResting, pinned in value-identity.test.js).
  assert.equal(oracle(e), "Two songs a fight. The audience has had enough.");
  assert.equal(rail(e), "Two songs a fight. The audience has had enough.");
});

test("IDENT-17 refusal: the squares cooldown line is gone, the other sing reasons stay", () => {
  assert.equal(oracle({ type: "actionRefused", action: "sing", reason: "cooldown", left: 40 }), "Not now.");
  assert.equal(oracle({ type: "actionRefused", action: "sing", reason: "wrongClass" }), "Only a Bard sings here.");
  assert.equal(oracle({ type: "actionRefused", action: "sing", reason: "notFought" }), "Fight! first.");
});

test("IDENT-17 bare payloads: a bare sang renders non-empty text with no undefined or NaN on both surfaces", () => {
  const bare = { type: "sang" };
  for (const text of [oracle(bare), rail(bare)]) {
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /undefined|NaN|null/);
  }
  const bareRefusal = { type: "actionRefused", action: "sing" };
  for (const text of [oracle(bareRefusal), rail(bareRefusal)]) {
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /undefined|NaN|null/);
  }
});

test("IDENT-17 retired: the four per-song builders are gone from both surfaces", () => {
  for (const type of ["beastsSoothed", "songIgnored", "lullabyRolled", "thunderRolled"]) {
    assert.equal(type in EVENT_NARRATION, false, `${type} has no Oracle builder`);
    assert.equal(type in LINE_FOR, false, `${type} has no rail builder`);
  }
});

// --- Phase 91 plan 07 (IDENT-17, the Joiner half): a Joiner Bard's song -----------------------
// `sang` carries `member`, and the self-effect events a sung spell pushes (a ward, Strength, Sense
// Presence, Earthquake's backlash, Death's fee) carry `member` too, so every line names the Joiner
// ("you" in a sung spell is the singer). The hero's own lines, with no `member`, are unchanged.

test("IDENT-17 Joiner sang: the Oracle names the singer and what the song lands as; the hero's line is unchanged", () => {
  const e = { type: "sang", title: "The Ballad of Doze", spell: "Doze", level: 1, member: "Ada" };
  const text = oracle(e);
  assert.ok(text.startsWith('Ada sings "The Ballad of Doze".'), text);
  assert.ok(text.includes("it lands as Doze"), text);
  assert.doesNotMatch(text, /\bYou\b/);
  assert.equal(oracle({ ...e, member: undefined }), 'You sing "The Ballad of Doze". The song lands as Doze.');
});

test("IDENT-17 Joiner sang: the rail twin names the singer, and the hero's rail line is unchanged", () => {
  const e = { type: "sang", title: "The Ballad of Doze", spell: "Doze", level: 1, member: "Ada" };
  assert.equal(rail(e), "Ada sings: The Ballad of Doze (Doze)");
  assert.equal(rail({ ...e, member: undefined }), "Song: The Ballad of Doze (Doze)");
});

const MEMBER_LINES = [
  // [event, Oracle must include, rail must include]
  [{ type: "wardRaised", spell: "Shield", pool: 50, member: "Ada" }, "raises a ward around Ada", "Shield wards Ada"],
  [{ type: "wardRaised", spell: "Bubble", pool: 0, mirror: true, popPool: 25, member: "Ada" }, "A bubble shimmers around Ada", "A bubble shimmers around Ada"],
  [{ type: "wardAbsorbed", amount: 7, remaining: 43, member: "Ada" }, "Ada's ward eats", "Ada's ward eats 7 (43 left)."],
  [{ type: "wardShattered", member: "Ada" }, "Ada's ward shatters", "Ada's ward shatters."],
  [{ type: "wardFaded", member: "Ada" }, "Ada's ward fades", "Ada's ward fades."],
  [{ type: "wardReflected", target: "Ned", amount: 9, mirror: true, member: "Ada" }, "The bubble around Ada catches it", "Ada's bubble sends it back — 9 to Ned. Pop."],
  [{ type: "strengthCast", squares: 100, restarted: false, member: "Ada" }, "Might surges in Ada", "Might surges in Ada"],
  [{ type: "strengthCast", squares: 100, restarted: true, member: "Ada" }, "Ada's Strength starts over", "Ada's Strength starts over"],
  [{ type: "sensesGained", member: "Ada" }, "Ada's senses sharpen", "Ada's senses sharpen"],
  [{ type: "earthquakeSelfDamage", amount: 4, spell: "Earthquake", member: "Ada" }, "Ada included", "Earthquake: Ada −4 hp, theirs too."],
  [{ type: "deathCast", cost: 25, member: "Ada" }, "from Ada", "Death: its fee, from Ada (−25 hp)."],
  [{ type: "deathSpellTooWeak", fee: 25, member: "Ada" }, "Ada needs at least 27", "Death: 25 hp fee. Ada needs at least 27 hp to pay it."],
];

test("IDENT-17 Joiner lines: every self-effect event of a sung spell names the Joiner on both surfaces, never 'you'", () => {
  for (const [e, oracleHas, railHas] of MEMBER_LINES) {
    const o = oracle(e);
    const r = rail(e);
    assert.ok(o.includes(oracleHas), `${e.type}: Oracle "${o}" should include "${oracleHas}"`);
    assert.ok(r.includes(railHas), `${e.type}: rail "${r}" should include "${railHas}"`);
    assert.doesNotMatch(o, /\byou(r)?\b/i, `${e.type}: the Oracle line must not say you: ${o}`);
    assert.doesNotMatch(r, /\byou(r)?\b/i, `${e.type}: the rail line must not say you: ${r}`);
    assert.doesNotMatch(o + r, /undefined|NaN|null/, e.type);
  }
});

test("IDENT-17 Joiner lines: the hero's own lines for the same events are unchanged (no member)", () => {
  assert.equal(oracle({ type: "wardRaised", spell: "Shield", pool: 50 }), "Shield raises a ward: it soaks the next 50 hp of damage.");
  assert.equal(rail({ type: "wardRaised", spell: "Shield", pool: 50 }), "Shield raises a ward: it soaks the next 50 hp.");
  assert.equal(rail({ type: "wardAbsorbed", amount: 7, remaining: 43 }), "The ward eats 7 (43 left).");
  assert.ok(oracle({ type: "wardAbsorbed", amount: 7, remaining: 43 }).startsWith("The ward eats"));
  assert.equal(oracle({ type: "wardShattered" }), "The ward shatters.");
  assert.equal(oracle({ type: "wardFaded" }), "The ward fades.");
  assert.equal(rail({ type: "wardFaded" }), "The ward fades.");
  assert.equal(oracle({ type: "sensesGained" }), "Your senses sharpen: nothing gets the jump on you, and the dark costs you nothing, until your next fight ends.");
  assert.equal(rail({ type: "earthquakeSelfDamage", amount: 4 }), "Earthquake: −4 hp, yours too.");
  assert.equal(rail({ type: "deathCast", cost: 25 }), "Death: its fee (−25 hp).");
  assert.equal(oracle({ type: "deathSpellTooWeak", fee: 25 }), "Death: the fee is 25 hp, and you need at least 27 to pay it. The spell refuses to be what kills you.");
});

test("IDENT-17 Joiner lines: a bare member-form event never prints undefined or NaN", () => {
  for (const type of ["sang", "wardRaised", "wardAbsorbed", "wardShattered", "wardFaded", "wardReflected", "strengthCast", "sensesGained", "earthquakeSelfDamage", "deathCast", "deathSpellTooWeak"]) {
    const bare = { type, member: "Ada" };
    for (const text of [oracle(bare), rail(bare)]) {
      assert.ok(text.length > 0, type);
      assert.doesNotMatch(text, /undefined|NaN|null/, `${type}: ${text}`);
    }
  }
});
