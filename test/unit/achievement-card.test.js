// test/unit/achievement-card.test.js
//
// Phase 100 (AUI-01): the achievement rail card builders in
// src/browser/achievementCard.js: the copy bank, the icon path helper, the
// single unlock card and the many-at-once summary card. Pure data in and out.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  ACHIEVEMENT_CARD_COPY,
  ACHIEVEMENT_COLLAPSE_OVER,
  ACHIEVEMENT_ICON_DIR,
  achievementIconSrc,
  achievementCardFor,
  achievementSummaryCard,
} from "../../src/browser/achievementCard.js";
import { ACHIEVEMENTS } from "../../content/achievements.js";
import { RAIL_HOLD, HOLD_MAX, holdForCard, railDismissKind, isCombatCard, railPush, emptyRail } from "../../src/browser/rail.js";

function deepFrozen(v) {
  if (v === null || typeof v !== "object") return true;
  if (!Object.isFrozen(v)) return false;
  return Object.values(v).every(deepFrozen);
}

function leaves(obj, out = []) {
  for (const v of Object.values(obj)) {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") leaves(v, out);
    else out.push(v);
  }
  return out;
}

test("ACHIEVEMENT_CARD_COPY is deeply frozen, all leaves are non-empty strings, many.lead carries {n}", () => {
  assert.ok(deepFrozen(ACHIEVEMENT_CARD_COPY));
  const all = leaves(ACHIEVEMENT_CARD_COPY);
  assert.ok(all.length >= 5);
  for (const s of all) {
    assert.equal(typeof s, "string");
    assert.ok(s.trim().length > 0);
  }
  assert.equal(ACHIEVEMENT_CARD_COPY.title, "ACHIEVEMENT");
  assert.ok(ACHIEVEMENT_CARD_COPY.many.lead.includes("{n}"));
  assert.equal(typeof ACHIEVEMENT_CARD_COPY.many.title, "string");
  assert.equal(typeof ACHIEVEMENT_CARD_COPY.many.hint, "string");
  assert.equal(typeof ACHIEVEMENT_CARD_COPY.strip.label, "string");
});

test("constants: collapse over 3, icon dir achievements/", () => {
  assert.equal(ACHIEVEMENT_COLLAPSE_OVER, 3);
  assert.equal(ACHIEVEMENT_ICON_DIR, "achievements/");
});

test("achievementIconSrc: the ingame path for an entry or an id, null for anything unknown", () => {
  assert.equal(achievementIconSrc("depth_t1"), "achievements/ingame/ach_depth_t1.png");
  assert.equal(achievementIconSrc(ACHIEVEMENTS[0]), "achievements/ingame/ach_depth_t1.png");
  for (const bad of ["nope", "Depth_T1", " depth_t1", "", null, undefined, 5, {}, { id: "nope" }]) {
    assert.equal(achievementIconSrc(bad), null);
  }
});

test("every one of the 77 catalog entries builds a frozen, dismissible, non-decision rail card", () => {
  assert.equal(ACHIEVEMENTS.length, 77);
  for (const entry of ACHIEVEMENTS) {
    const card = achievementCardFor(entry);
    assert.deepEqual(achievementCardFor(entry.id), card, entry.id);
    assert.equal(card.kind, "achievement");
    assert.deepEqual(card.lines, [
      { text: entry.name, roll: null },
      { text: entry.line, roll: null },
    ]);
    assert.equal(card.iconSrc, "achievements/" + entry.icon.ingame);
    assert.ok(existsSync(new URL("../../" + card.iconSrc, import.meta.url)), `icon file for ${entry.id}`);
    assert.equal(card.title, ACHIEVEMENT_CARD_COPY.title);
    assert.equal(card.icon, "★");
    assert.equal(card.iconKey, null);
    assert.equal(card.tone, "good");
    assert.equal(card.hold, RAIL_HOLD.level);
    assert.equal(card.achievementId, entry.id);
    assert.equal("buttons" in card, false);
    assert.equal("locked" in card, false);
    assert.ok(deepFrozen(card), `${entry.id} deeply frozen`);
    assert.ok(holdForCard(card) > RAIL_HOLD.default);
    assert.ok(holdForCard(card) >= RAIL_HOLD.level);
    assert.ok(holdForCard(card) <= HOLD_MAX);
    assert.equal(railDismissKind(false, 0), "dismissible");
    assert.equal(isCombatCard(card), false);
  }
});

test("achievementCardFor: unknown ids and malformed input give null and never throw", () => {
  for (const bad of ["nope", "Depth_T1", " depth_t1", "depth_t1 ", "", null, undefined, 5, NaN, {}, { id: "nope" }, [], true, () => {}]) {
    assert.doesNotThrow(() => achievementCardFor(bad));
    assert.equal(achievementCardFor(bad), null, String(bad));
  }
});

test("achievementSummaryCard: four ids, catalog order whatever the input order", () => {
  const card = achievementSummaryCard(["depth_t1", "kills_beasts_t1", "special_snowflake", "tourist"]);
  assert.equal(card.kind, "achievement-many");
  assert.equal(card.opensList, true);
  assert.deepEqual(card.achievementIds, ["depth_t1", "tourist", "kills_beasts_t1", "special_snowflake"]);
  const byId = (id) => ACHIEVEMENTS.find((e) => e.id === id);
  assert.deepEqual(
    card.lines.map((l) => l.text),
    [
      ACHIEVEMENT_CARD_COPY.many.lead.replace("{n}", "4"),
      ...card.achievementIds.map((id) => byId(id).name),
      ACHIEVEMENT_CARD_COPY.many.hint,
    ],
  );
  assert.equal(card.title, ACHIEVEMENT_CARD_COPY.many.title);
  assert.equal(card.hold, RAIL_HOLD.level);
  assert.equal(card.tone, "good");
  assert.equal(card.iconSrc, achievementIconSrc("depth_t1"));
  assert.ok(holdForCard(card) <= HOLD_MAX);
  assert.ok(holdForCard(card) >= RAIL_HOLD.level);
  assert.equal(isCombatCard(card), false);
  assert.equal("buttons" in card, false);
  assert.equal("locked" in card, false);
  assert.ok(deepFrozen(card));
  // order independence
  const rev = achievementSummaryCard(["special_snowflake", "tourist", "kills_beasts_t1", "depth_t1"]);
  assert.deepEqual(rev, card);
});

test("achievementSummaryCard: accepts entries, ignores unknowns, null under two resolved", () => {
  const e1 = ACHIEVEMENTS.find((e) => e.id === "tourist");
  const e2 = ACHIEVEMENTS.find((e) => e.id === "chicken");
  const card = achievementSummaryCard([e2, "nope", e1]);
  assert.deepEqual(card.achievementIds, ["tourist", "chicken"]);
  assert.ok(card.lines[0].text.startsWith("2 "));
  assert.equal(achievementSummaryCard(["tourist"]), null);
  assert.equal(achievementSummaryCard(["tourist", "nope"]), null);
  assert.equal(achievementSummaryCard(["tourist", "tourist"]), null, "one id twice is one entry");
  for (const bad of [null, undefined, [], "tourist", 5, {}]) assert.equal(achievementSummaryCard(bad), null);
});

test("a card pushed through the rail keeps its kind, icon path, id and gains a seq", () => {
  const single = achievementCardFor("unicorn");
  const r1 = railPush(emptyRail(), single);
  assert.equal(r1.card.kind, "achievement");
  assert.equal(r1.card.iconSrc, single.iconSrc);
  assert.equal(r1.card.achievementId, "unicorn");
  assert.equal(r1.card.seq, 1);
  const many = achievementSummaryCard(["depth_t1", "depth_t2"]);
  const r2 = railPush(r1, many);
  assert.equal(r2.card.kind, "achievement-many");
  assert.equal(r2.card.opensList, true);
  assert.deepEqual(r2.card.achievementIds, ["depth_t1", "depth_t2"]);
  assert.equal(r2.card.seq, 2);
});

// Quick 261005-vn5: the death screen hint line for a death-revealed secret.
import { deathHintFor } from "../../src/browser/achievementCard.js";

test("deathHintFor: a reveal of Special Snowflake without its unlock gives the one hint line; it never names the achievement", () => {
  const hint = deathHintFor({ unlocks: [], reveals: ["special_snowflake"], progress: [] });
  assert.equal(hint, ACHIEVEMENT_CARD_COPY.strip.hint);
  assert.equal(typeof hint, "string");
  assert.match(hint, /floor 1/);
  for (const word of ["Special", "Snowflake", "snowflake", "special_snowflake"]) assert.equal(hint.includes(word), false, word);
  assert.equal(hint.trim(), hint);
});

test("deathHintFor: nothing when the death earned it, revealed another secret, or the payload is missing or malformed", () => {
  assert.equal(deathHintFor({ unlocks: [{ id: "special_snowflake", at: 1 }], reveals: ["special_snowflake"] }), null);
  assert.equal(deathHintFor({ unlocks: [], reveals: ["death_falling", "ether_entombed"] }), null);
  assert.equal(deathHintFor({ unlocks: [{ id: "depth_t1", at: 1 }], reveals: [] }), null);
  for (const bad of [null, undefined, 5, "x", [], {}, { reveals: "special_snowflake" }, { reveals: [null, 7, {}] }, { reveals: ["nope"] }]) {
    assert.equal(deathHintFor(bad), null);
  }
  assert.equal(deathHintFor({ reveals: ["special_snowflake"], unlocks: "bad" }), ACHIEVEMENT_CARD_COPY.strip.hint);
});
