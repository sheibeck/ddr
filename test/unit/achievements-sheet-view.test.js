// test/unit/achievements-sheet-view.test.js
//
// Phase 100 (AUI-02), plan 02 task 2: the view model. A lifetime record becomes
// a frozen, fully ordered list of 35 rows with ladders, rungs, dates, progress
// and secrets, and a secret row leaks nothing of itself.

import test from "node:test";
import assert from "node:assert/strict";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { CLASSES } from "../../content/classes.js";
import { emptyRecord, sanitizeRecord } from "../../src/browser/achievementRecord.js";
import { achievementIconSrc } from "../../src/browser/achievementCard.js";
import { ACHIEVEMENTS_SHEET_COPY, buildAchievementsView } from "../../src/browser/achievementsSheet.js";

const byId = (id) => ACHIEVEMENTS.find((e) => e.id === id);
const rec = (over) => sanitizeRecord({ v: 1, ...over });
const HIDDEN = ACHIEVEMENTS.filter((e) => e.initialState === "Hidden");

const T_A = Date.UTC(2026, 9, 1, 12, 0, 0);
const T_B = Date.UTC(2026, 9, 5, 12, 0, 0);

function allRows(view) {
  return view.blocks.flatMap((b) => b.rows);
}
function rowNamed(view, name) {
  const row = allRows(view).find((r) => r.name === name);
  assert.ok(row, `row ${name}`);
  return row;
}

function deepFrozen(obj) {
  if (obj === null || typeof obj !== "object") return true;
  return Object.isFrozen(obj) && Object.values(obj).every(deepFrozen);
}

// --- empty and hostile records ----------------------------------------------

function assertEmptyView(view) {
  assert.equal(view.blocks.length, 7);
  assert.equal(allRows(view).length, 35);
  assert.equal(view.earned, 0);
  assert.equal(view.total, 77);
  assert.equal(view.secrets, 9);
  assert.equal(view.earnedText, "0 of 77 earned");
  assert.equal(view.secretsText, "9 secrets still hiding");
  const secretRows = allRows(view).filter((r) => r.state === "secret");
  assert.equal(secretRows.length, 9);
  for (const r of allRows(view)) {
    assert.ok(r.state === "locked" || r.state === "secret", `${r.key} is ${r.state}`);
  }
  assert.ok(secretRows.every((r) => r.kind === "single"));
}

test("buildAchievementsView: the empty record is 35 locked-or-secret rows, 0 of 77, 9 secrets", () => {
  assertEmptyView(buildAchievementsView(emptyRecord()));
});

test("buildAchievementsView: null, undefined, a string, an array and a number read as the empty record", () => {
  const empty = buildAchievementsView(emptyRecord());
  for (const bad of [null, undefined, "x", [], 42, true]) {
    assert.deepStrictEqual(buildAchievementsView(bad), empty);
  }
});

test("buildAchievementsView: a hostile record (throwing getter, wrong types) reads as the empty record", () => {
  const throwing = {
    get v() {
      throw new Error("boom");
    },
  };
  assertEmptyView(buildAchievementsView(throwing));
  assertEmptyView(buildAchievementsView({ v: 1, counters: "no", kills: [1], bests: 5, unlocked: "x", revealed: 7, run: "r" }));
  assertEmptyView(buildAchievementsView({ v: 2, unlocked: { race_human: 5 } }));
});

test("buildAchievementsView: a record with zero unlocks and a record with every unlock both build 35 rows", () => {
  const unlocked = {};
  for (const e of ACHIEVEMENTS) unlocked[e.id] = T_A;
  const full = buildAchievementsView(rec({ unlocked }));
  assert.equal(allRows(full).length, 35);
  assert.equal(full.earned, 77);
  assert.equal(full.secrets, 0);
  assert.equal(full.secretsText, ACHIEVEMENTS_SHEET_COPY.secrets.none);
  assert.ok(allRows(full).every((r) => r.state === "earned"));
});

// --- shape ---------------------------------------------------------------------

test("block row counts are 3, 4, 10, 5, 4, 6, 3 and the keys are distinct opaque t{number} strings", () => {
  const view = buildAchievementsView(emptyRecord());
  assert.deepStrictEqual(view.blocks.map((b) => b.rows.length), [3, 4, 10, 5, 4, 6, 3]);
  assert.deepStrictEqual(view.blocks.map((b) => b.id), ["descent", "dressing", "who", "alive", "company", "bodies", "dying"]);
  assert.deepStrictEqual(view.blocks.map((b) => b.title), ["The descent", "Dressing for it", "Who you are", "Staying alive", "Company", "Body counts", "Dying"]);
  const keys = allRows(view).map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const k of keys) assert.match(k, /^t\d+$/);
  assert.ok(keys.every((k) => !/[a-su-z]/i.test(k)), "no letter other than the leading t");
});

// --- tracks -----------------------------------------------------------------

test("a locked track: dim tier I icon, tier I description, 0 progress, four locked rungs", () => {
  const view = buildAchievementsView(emptyRecord());
  const row = rowNamed(view, "Body Count: Beasts");
  assert.equal(row.kind, "track");
  assert.equal(row.state, "locked");
  assert.equal(row.dim, true);
  assert.equal(row.silhouette, false);
  assert.equal(row.iconSrc, achievementIconSrc("kills_beasts_t1"));
  assert.equal(row.detail, byId("kills_beasts_t1").description);
  assert.equal(row.progressText, "0 / 50 kills");
  assert.equal(row.dateText, null);
  assert.equal(row.expandable, true);
  assert.equal(row.stateText, "Locked");
  assert.deepStrictEqual(row.ladder, [
    { tier: "I", state: "locked" },
    { tier: "II", state: "locked" },
    { tier: "III", state: "locked" },
    { tier: "IV", state: "locked" },
  ]);
  assert.equal(row.rungs.length, 4);
  row.rungs.forEach((rung, i) => {
    const entry = byId(`kills_beasts_t${i + 1}`);
    assert.equal(rung.state, "locked");
    assert.equal(rung.name, entry.name);
    assert.equal(rung.text, entry.description);
    assert.equal(rung.progressText, `0 / ${entry.steps} kills`);
    assert.equal(rung.dateText, null);
  });
});

test("a partial track: highest tier icon and line, next rung progress, ladder, tier dates", () => {
  const r = rec({ kills: { Beasts: 137 }, unlocked: { kills_beasts_t1: T_A, kills_beasts_t2: T_B } });
  const row = rowNamed(buildAchievementsView(r), "Body Count: Beasts");
  assert.equal(row.state, "partial");
  assert.equal(row.dim, false);
  assert.equal(row.iconSrc, achievementIconSrc("kills_beasts_t2"));
  assert.equal(row.detail, byId("kills_beasts_t2").line);
  assert.equal(row.dateText, "5 Oct 2026");
  assert.equal(row.progressText, "137 / 200 kills");
  assert.deepStrictEqual(row.ladder.map((p) => p.state), ["earned", "earned", "locked", "locked"]);
  assert.equal(row.stateText, "2 of 4 tiers earned");
  assert.equal(row.rungs[0].text, byId("kills_beasts_t1").line);
  assert.equal(row.rungs[0].dateText, "1 Oct 2026");
  assert.equal(row.rungs[0].stateText, "Earned 1 Oct 2026");
  assert.equal(row.rungs[1].dateText, "5 Oct 2026");
  assert.equal(row.rungs[2].state, "locked");
  assert.equal(row.rungs[2].text, byId("kills_beasts_t3").description);
  assert.equal(row.rungs[2].progressText, "137 / 200 kills");
  assert.equal(row.rungs[3].progressText, "137 / 500 kills");
  assert.equal(row.rungs[2].stateText, "Locked");
});

test("a complete track: earned, no progress, All 4 tiers earned, tier IV icon and line", () => {
  const unlocked = {};
  for (let t = 1; t <= 4; t++) unlocked[`kills_beasts_t${t}`] = T_A + t;
  const row = rowNamed(buildAchievementsView(rec({ kills: { Beasts: 500 }, unlocked })), "Body Count: Beasts");
  assert.equal(row.state, "earned");
  assert.equal(row.progressText, null);
  assert.equal(row.stateText, "All 4 tiers earned");
  assert.equal(row.iconSrc, achievementIconSrc("kills_beasts_t4"));
  assert.equal(row.detail, byId("kills_beasts_t4").line);
  assert.ok(row.rungs.every((r) => r.progressText === null));
});

test("the depth track: Downward Mobility with Unicorn! as the fourth rung", () => {
  const partial = rec({ bests: { depth: 18 }, unlocked: { depth_t1: T_A, depth_t2: T_A, depth_t3: T_B } });
  const row = rowNamed(buildAchievementsView(partial), "Downward Mobility");
  assert.equal(row.state, "partial");
  assert.equal(row.iconSrc, achievementIconSrc("depth_t3"));
  assert.equal(row.progressText, "best: floor 18 / 20");
  assert.equal(row.rungs[3].name, "Unicorn!");
  assert.equal(row.rungs[3].tier, "IV");
  assert.equal(row.rungs.length, 4);
  const done = rec({ bests: { depth: 20 }, unlocked: { depth_t1: 1, depth_t2: 1, depth_t3: 1, unicorn: T_B } });
  const full = rowNamed(buildAchievementsView(done), "Downward Mobility");
  assert.equal(full.state, "earned");
  assert.equal(full.iconSrc, achievementIconSrc("unicorn"));
  assert.equal(full.detail, byId("unicorn").line);
  assert.equal(allRows(buildAchievementsView(done)).filter((r) => r.name === "Unicorn!").length, 0, "Unicorn! is never a row of its own");
});

test("exactly at a threshold: depth 5 with depth_t1 earned reads the next rung as best: floor 5 / 10", () => {
  const row = rowNamed(buildAchievementsView(rec({ bests: { depth: 5 }, unlocked: { depth_t1: T_A } })), "Downward Mobility");
  assert.equal(row.progressText, "best: floor 5 / 10");
  assert.equal(row.state, "partial");
});

test("neighbouring blocks never merge their first and last rows", () => {
  const view = buildAchievementsView(emptyRecord());
  const names = view.blocks.map((b) => [b.rows[0].name, b.rows[b.rows.length - 1].name]);
  assert.deepStrictEqual(names[0], ["Downward Mobility", "Secret"]);
  assert.deepStrictEqual(names[1], ["Fully Dressed", "Secret"]);
  assert.deepStrictEqual(names[2], ["Human Error", "Tourist"]);
  assert.equal(new Set(allRows(view).map((r) => r.key)).size, 35);
});

// --- singles ------------------------------------------------------------------

test("a single earned entry: line, date, no progress, no ladder, not expandable", () => {
  const row = rowNamed(buildAchievementsView(rec({ unlocked: { race_human: T_B } })), "Human Error");
  assert.equal(row.kind, "single");
  assert.equal(row.state, "earned");
  assert.equal(row.detail, byId("race_human").line);
  assert.equal(row.dateText, "5 Oct 2026");
  assert.equal(row.stateText, "Earned 5 Oct 2026");
  assert.equal(row.progressText, null);
  assert.equal(row.dim, false);
  assert.deepStrictEqual(row.ladder, []);
  assert.deepStrictEqual(row.rungs, []);
  assert.equal(row.expandable, false);
  assert.equal(row.iconSrc, achievementIconSrc("race_human"));
});

test("a single locked entry shows its description and no progress", () => {
  const row = rowNamed(buildAchievementsView(emptyRecord()), "Human Error");
  assert.equal(row.state, "locked");
  assert.equal(row.detail, byId("race_human").description);
  assert.equal(row.dim, true);
  assert.equal(row.progressText, null);
  assert.equal(row.dateText, null);
});

test("an unlock stored with time 0 reads: Earned. Nobody wrote down when.", () => {
  const row = rowNamed(buildAchievementsView(rec({ unlocked: { race_human: 0 } })), "Human Error");
  assert.equal(row.state, "earned");
  assert.equal(row.dateText, "Earned. Nobody wrote down when.");
  assert.equal(row.stateText, "Earned. Nobody wrote down when.");
});

test("Tourist, locked with 7 delved sub-classes, shows its description and 7 / 24 sub-classes", () => {
  const subs = Object.values(CLASSES).flatMap((c) => c.subs).slice(0, 7);
  const row = rowNamed(buildAchievementsView(rec({ subClassesDelved: subs })), "Tourist");
  assert.equal(row.kind, "single");
  assert.equal(row.state, "locked");
  assert.equal(row.detail, byId("tourist").description);
  assert.equal(row.progressText, "7 / 24 sub-classes");
});

// --- secrets ------------------------------------------------------------------

function secretRowFor(view, entry) {
  return allRows(view).find((r) => r.key === `t${entry.listOrder}`);
}

// Quick 261005-vn5 (declared re-pin): Special Snowflake now starts Hidden, so 9 entries are secrets (was 8).
test("secrets: nine Hidden entries (Special Snowflake included) are Secret rows with the teaser and a silhouette", () => {
  assert.equal(HIDDEN.length, 9);
  assert.ok(HIDDEN.some((e) => e.id === "special_snowflake"));
  const view = buildAchievementsView(emptyRecord());
  for (const e of HIDDEN) {
    const row = secretRowFor(view, e);
    assert.equal(row.state, "secret", e.id);
    assert.equal(row.name, "Secret");
    assert.equal(row.detail, ACHIEVEMENTS_SHEET_COPY.secret.line);
    assert.equal(row.silhouette, true);
    assert.equal(row.dateText, null);
    assert.equal(row.progressText, null);
    assert.equal(row.stateText, "");
    assert.equal(row.iconSrc, achievementIconSrc(e));
    assert.deepStrictEqual(row.ladder, []);
    assert.equal(row.expandable, false);
  }
});

test("secrets: revealed becomes a normal locked row, unlocked becomes an earned row", () => {
  for (const e of HIDDEN) {
    const revealed = secretRowFor(buildAchievementsView(rec({ revealed: [e.id] })), e);
    assert.equal(revealed.state, "locked", e.id);
    assert.equal(revealed.name, e.name);
    assert.equal(revealed.detail, e.description);
    assert.equal(revealed.silhouette, false);
    const earned = secretRowFor(buildAchievementsView(rec({ unlocked: { [e.id]: T_B } })), e);
    assert.equal(earned.state, "earned", e.id);
    assert.equal(earned.detail, e.line);
    assert.equal(earned.silhouette, false);
    assert.equal(earned.dateText, "5 Oct 2026");
  }
});

test("secrets: the header counts them down as they are revealed or unlocked", () => {
  assert.equal(buildAchievementsView(rec({ revealed: ["chicken"] })).secretsText, "8 secrets still hiding");
  assert.equal(buildAchievementsView(rec({ unlocked: { chicken: 1 }, revealed: ["death_trap"] })).secrets, 7);
  const unlocked = {};
  for (const e of HIDDEN.slice(1)) unlocked[e.id] = 1;
  assert.equal(buildAchievementsView(rec({ unlocked })).secretsText, "1 secret still hiding");
});

test("secrets: a secret row object carries nothing of the real achievement (all 9 Hidden entries)", () => {
  const view = buildAchievementsView(emptyRecord());
  for (const e of HIDDEN) {
    const row = secretRowFor(view, e);
    const { iconSrc, ...rest } = row;
    assert.ok(typeof iconSrc === "string");
    // Values only: the row object's own property names (key, label, ...) are not content.
    const json = JSON.stringify(Object.values(rest));
    for (const [what, text] of [["name", e.name], ["description", e.description], ["line", e.line], ["id", e.id]]) {
      assert.ok(!json.includes(text), `${e.id}: ${what} leaks into the secret row`);
    }
    for (const word of e.id.split("_").filter((w) => w.length > 4)) {
      assert.ok(!new RegExp(`\\b${word}\\b`, "i").test(json), `${e.id}: id word ${word} leaks`);
    }
    assert.match(row.key, /^t\d+$/);
    assert.notEqual(row.key, e.id);
  }
});

// --- ordering -----------------------------------------------------------------

test("the same unlocks inserted in a different key order give deep-equal views", () => {
  const a = rec({ unlocked: { race_human: T_A, kills_beasts_t1: T_B, chicken: T_A, depth_t1: T_B }, kills: { Beasts: 60 } });
  const b = sanitizeRecord({ v: 1, kills: { Beasts: 60 }, unlocked: { depth_t1: T_B, chicken: T_A, kills_beasts_t1: T_B, race_human: T_A } });
  assert.deepStrictEqual(buildAchievementsView(a), buildAchievementsView(b));
});

test("rows ascend by first listOrder within each block", () => {
  const view = buildAchievementsView(emptyRecord());
  for (const b of view.blocks) {
    const orders = b.rows.map((r) => Number(r.key.slice(1)));
    assert.deepStrictEqual(orders, [...orders].sort((x, y) => x - y));
  }
});

// --- label --------------------------------------------------------------------

test("label: name, state, detail and progress joined with a full stop; a secret is name and teaser", () => {
  const r = rec({ kills: { Beasts: 137 }, unlocked: { kills_beasts_t1: T_A, kills_beasts_t2: T_B } });
  const row = rowNamed(buildAchievementsView(r), "Body Count: Beasts");
  assert.equal(row.label, [row.name, row.stateText, row.detail, row.progressText].join(". "));
  const secret = allRows(buildAchievementsView(emptyRecord())).find((x) => x.state === "secret");
  assert.equal(secret.label, `Secret. ${ACHIEVEMENTS_SHEET_COPY.secret.line}`);
});

// --- time zone and freezing ---------------------------------------------------

test("tzOffset changes only the dates", () => {
  const near = Date.UTC(2026, 9, 6, 2, 0, 0);
  const r = rec({ unlocked: { race_human: near, depth_t1: near } });
  const a = buildAchievementsView(r, { tzOffset: 0 });
  const b = buildAchievementsView(r, { tzOffset: 300 });
  assert.notDeepStrictEqual(a, b);
  assert.equal(rowNamed(a, "Human Error").dateText, "6 Oct 2026");
  assert.equal(rowNamed(b, "Human Error").dateText, "5 Oct 2026");
  const strip = (v) => JSON.parse(JSON.stringify(v), (k, val) => (typeof val === "string" ? val.replace(/\b[56] Oct 2026/g, "DATE") : val));
  assert.deepStrictEqual(strip(a), strip(b));
});

test("the view is deeply frozen and a deep-frozen record is never mutated", () => {
  const r = rec({ kills: { Beasts: 3 }, unlocked: { race_human: T_A }, revealed: ["chicken"] });
  const before = JSON.stringify(r);
  const view = buildAchievementsView(r, { tzOffset: -60 });
  assert.ok(deepFrozen(view));
  assert.equal(JSON.stringify(r), before);
  assert.ok(deepFrozen(r));
});

test("quick 261005-vn5: Special Snowflake is a Secret row until a death below floor 1 reveals it or a floor-1 death earns it", () => {
  const snow = ACHIEVEMENTS.find((e) => e.id === "special_snowflake");
  assert.equal(secretRowFor(buildAchievementsView(emptyRecord()), snow).state, "secret");
  const revealed = secretRowFor(buildAchievementsView(rec({ revealed: ["special_snowflake"] })), snow);
  assert.equal(revealed.state, "locked");
  assert.equal(revealed.name, "Special Snowflake");
  const earned = secretRowFor(buildAchievementsView(rec({ unlocked: { special_snowflake: T_B } })), snow);
  assert.equal(earned.state, "earned");
  assert.equal(earned.detail, "You're a special snowflake.");
});
