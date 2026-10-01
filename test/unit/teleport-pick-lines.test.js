// test/unit/teleport-pick-lines.test.js
//
// Phase 91 plan 03 (IDENT-14, report #3): the Oracle and rail words for an
// Illusionist's teleport pick. teleportPickOffered heads the decision card (it
// is ORACLE_ONLY on the line side, classified like hazardChoice, with its own
// rail family); teleportPickRefused is a refusal on both surfaces; the
// teleported line has a picked, a let-it-choose and the unchanged rolled voice.

import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, ORACLE_ONLY, FEATURE_EVENTS } from "../../src/browser/narrationLines.js";
import { RAIL_FAMILY } from "../../src/browser/rail.js";
import { COMPASS_WORD } from "../../content/flavor.js";
import { TELEPORT_DIRS } from "../../engine/movement.js";

const plain = (html) => String(html).replace(/<[^>]+>/g, "");
const clean = (text, label) => {
  assert.ok(typeof text === "string" && text.trim().length > 0, `${label}: non-empty`);
  assert.ok(!/undefined|NaN|\[object/.test(text), `${label}: no undefined / NaN / [object]: ${text}`);
};

test("teleportPickOffered: the Oracle names the count (singular, plural, none) and both answers", () => {
  const one = plain(EVENT_NARRATION.teleportPickOffered({ type: "teleportPickOffered", count: 1, auto: { x: 3, y: 4 } }));
  const many = plain(EVENT_NARRATION.teleportPickOffered({ type: "teleportPickOffered", count: 9, auto: { x: 3, y: 4 } }));
  const none = plain(EVENT_NARRATION.teleportPickOffered({ type: "teleportPickOffered", count: 0, auto: { x: 3, y: 4 } }));
  assert.match(one, /One square glows/);
  assert.doesNotMatch(one, /1 squares/);
  assert.match(many, /9 squares glow/);
  assert.match(none, /No square you have explored is in reach/);
  for (const t of [one, many, none]) assert.match(t, /map/i, "says to pick on the map");
  for (const t of [one, many]) assert.match(t, /let it choose/i, "names LET IT CHOOSE");
  assert.match(none, /let it choose/i);
  clean(plain(EVENT_NARRATION.teleportPickOffered({ type: "teleportPickOffered" })), "bare Oracle offer");
});

test("teleportPickOffered: classified like hazardChoice (ORACLE_ONLY, no LINE_FOR) with a rail family of its own", () => {
  assert.ok(ORACLE_ONLY.has("teleportPickOffered"));
  assert.equal(LINE_FOR.teleportPickOffered, undefined);
  assert.ok(ORACLE_ONLY.has("hazardChoice") && LINE_FOR.hazardChoice === undefined, "the model it copies");
  assert.ok(RAIL_FAMILY.teleportPickOffered, "the rail twin");
  assert.match(RAIL_FAMILY.teleportPickOffered.title, /TELEPORT/);
});

test("teleportPickRefused: one Oracle line and one rail line per reason, and a bare payload still reads", () => {
  for (const reason of ["notATarget", "none", "stale"]) {
    const oracle = plain(EVENT_NARRATION.teleportPickRefused({ type: "teleportPickRefused", reason }));
    clean(oracle, `oracle ${reason}`);
    const rail = LINE_FOR.teleportPickRefused({ type: "teleportPickRefused", reason });
    clean(rail.text, `rail ${reason}`);
    assert.equal(rail.tone, "block", `${reason}: a refusal is an amber block`);
  }
  assert.match(plain(EVENT_NARRATION.teleportPickRefused({ reason: "notATarget" })), /not one the teleport can reach/);
  assert.match(plain(EVENT_NARRATION.teleportPickRefused({ reason: "none" })), /no teleport waiting/);
  assert.match(plain(EVENT_NARRATION.teleportPickRefused({ reason: "stale" })), /moment has passed/);
  clean(plain(EVENT_NARRATION.teleportPickRefused({ type: "teleportPickRefused" })), "bare Oracle refusal");
  const bare = LINE_FOR.teleportPickRefused({ type: "teleportPickRefused" });
  clean(bare.text, "bare rail refusal");
  assert.equal(bare.tone, "block");
  assert.ok(FEATURE_EVENTS.includes("teleportPickRefused"), "listed with the other refusals");
});

test("teleported: a picked landing names the direction word and the distance on both surfaces", () => {
  const e = { type: "teleported", picked: true, dir: "NE", dist: 5, travelled: 5, to: { x: 9, y: 4 } };
  const oracle = plain(EVENT_NARRATION.teleported(e));
  const rail = LINE_FOR.teleported(e).text;
  for (const t of [oracle, rail]) {
    assert.match(t, /north-east/);
    assert.match(t, /5 squares/);
    clean(t, "picked");
  }
  const one = plain(EVENT_NARRATION.teleported({ ...e, dir: "W", dist: 1 }));
  assert.match(one, /west, 1 square away/);
  assert.doesNotMatch(one, /1 squares/);
});

test("teleported: a let-it-choose landing says so, and a rolled landing keeps its old words", () => {
  const auto = { type: "teleported", auto: true, dir: "E", dist: 12, used: "E", travelled: 12, to: { x: 17, y: 5 } };
  assert.match(plain(EVENT_NARRATION.teleported(auto)), /let the teleport choose/i);
  assert.match(LINE_FOR.teleported(auto).text, /let the teleport choose/i);
  const rolled = { type: "teleported", dir: "N", other: "E", dist: 5, used: "N", travelled: 4, to: { x: 5, y: 1 } };
  assert.equal(plain(EVENT_NARRATION.teleported(rolled)), "You teleport to an unknown location on this floor… the dungeon does not offer refunds.");
  assert.equal(LINE_FOR.teleported(rolled).text, "You teleport to an unknown location.");
});

test("teleported: a bare payload of every voice renders non-empty text with no undefined or NaN", () => {
  for (const e of [{ type: "teleported" }, { type: "teleported", picked: true }, { type: "teleported", auto: true }, { type: "teleported", picked: true, dir: "ZZ", dist: "far" }]) {
    clean(plain(EVENT_NARRATION.teleported(e)), `oracle ${JSON.stringify(e)}`);
    clean(LINE_FOR.teleported(e).text, `rail ${JSON.stringify(e)}`);
  }
});

test("COMPASS_WORD names every one of the eight rays the pick runs along", () => {
  assert.deepStrictEqual(Object.keys(COMPASS_WORD), Object.keys(TELEPORT_DIRS));
  for (const word of Object.values(COMPASS_WORD)) assert.match(word, /^[a-z-]+$/);
});
