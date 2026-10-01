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
  assert.equal(oracle(e), "One song a fight. The audience has had enough.");
  assert.equal(rail(e), "One song a fight. The audience has had enough.");
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
