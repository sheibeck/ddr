// test/unit/achievements-catalog.test.js
//
// Phase 98 plan 01 (ACH-01, ACH-03, ACH-04, ACH-05): pins the structure of
// content/achievements.js. Every locked ruling from 98-CONTEXT (the 77-id
// order, points, types, the Hidden set, the reveal pairs, thresholds, list
// order) is spelled as a literal below, independent of the module under
// test, so a silent drift fails here before it can reach a published
// achievement: type and initial state are permanent once the Play Console
// zip is imported. The name / description / line copy is plan 98-02's to test.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { ACHIEVEMENTS, TRIGGER_VOCABULARY } from "../../content/achievements.js";
import { BESTIARY } from "../../content/bestiary.js";
import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";
import { CAUSE_TEXT } from "../../content/epitaphs.js";
import { BAGS } from "../../content/bags.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ACH_DIR = path.resolve(__dirname, "..", "..", "achievements");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ACH_DIR, "manifest.json"), "utf8"));

// [id, threshold, points, tier, "inc" | "std", "R" | "H"] in list order.
const LOCKED = [
  ["depth_t1", 5, 10, 1, "inc", "R"],
  ["depth_t2", 10, 20, 2, "inc", "R"],
  ["depth_t3", 15, 30, 3, "inc", "R"],
  ["unicorn", 20, 100, null, "inc", "R"],
  ["death_falling", null, 5, null, "std", "H"],
  ["ether_entombed", null, 10, null, "std", "H"],
  ["fully_dressed", null, 10, null, "std", "R"],
  ["naked_ambition", 5, 25, null, "std", "H"],
  ["teetotaler", 5, 15, null, "std", "R"],
  ["read_the_label", null, 5, null, "std", "H"],
  ["race_human", 10, 20, null, "std", "R"],
  ["race_elven", 10, 20, null, "std", "R"],
  ["race_dwarven", 10, 20, null, "std", "R"],
  ["race_wilmsry", 10, 20, null, "std", "R"],
  ["race_fridgian", 10, 20, null, "std", "R"],
  ["race_troll", 10, 20, null, "std", "R"],
  ["class_magic_user", 10, 20, null, "std", "R"],
  ["class_fighter", 10, 20, null, "std", "R"],
  ["class_thief", 10, 20, null, "std", "R"],
  ["tourist", 24, 30, null, "inc", "R"],
  ["survivor_t1", 10, 5, 1, "inc", "R"],
  ["survivor_t2", 25, 10, 2, "inc", "R"],
  ["survivor_t3", 50, 15, 3, "inc", "R"],
  ["survivor_t4", 100, 25, 4, "inc", "R"],
  ["death_starvation", null, 5, null, "std", "H"],
  ["hoarder_t1", 2000, 5, 1, "inc", "R"],
  ["hoarder_t2", 5000, 10, 2, "inc", "R"],
  ["hoarder_t3", 8000, 15, 3, "inc", "R"],
  ["hoarder_t4", 10000, 25, 4, "inc", "R"],
  ["trap_survivor_t1", 10, 5, 1, "inc", "R"],
  ["trap_survivor_t2", 25, 10, 2, "inc", "R"],
  ["trap_survivor_t3", 50, 15, 3, "inc", "R"],
  ["trap_survivor_t4", 100, 25, 4, "inc", "R"],
  ["death_trap", null, 5, null, "std", "H"],
  ["party_animal_t1", 10, 5, 1, "inc", "R"],
  ["party_animal_t2", 25, 10, 2, "inc", "R"],
  ["party_animal_t3", 50, 15, 3, "inc", "R"],
  ["party_animal_t4", 100, 25, 4, "inc", "R"],
  ["human_shields_t1", 5, 5, 1, "inc", "R"],
  ["human_shields_t2", 10, 10, 2, "inc", "R"],
  ["human_shields_t3", 25, 15, 3, "inc", "R"],
  ["human_shields_t4", 50, 25, 4, "inc", "R"],
  ["parlay_t1", 10, 5, 1, "inc", "R"],
  ["parlay_t2", 25, 10, 2, "inc", "R"],
  ["parlay_t3", 50, 15, 3, "inc", "R"],
  ["parlay_t4", 100, 25, 4, "inc", "R"],
  ["chicken", 10, 15, null, "std", "H"],
  ["kills_beasts_t1", 50, 5, 1, "inc", "R"],
  ["kills_beasts_t2", 100, 10, 2, "inc", "R"],
  ["kills_beasts_t3", 200, 15, 3, "inc", "R"],
  ["kills_beasts_t4", 500, 25, 4, "inc", "R"],
  ["kills_demons_t1", 50, 5, 1, "inc", "R"],
  ["kills_demons_t2", 100, 10, 2, "inc", "R"],
  ["kills_demons_t3", 200, 15, 3, "inc", "R"],
  ["kills_demons_t4", 500, 25, 4, "inc", "R"],
  ["kills_humans_t1", 50, 5, 1, "inc", "R"],
  ["kills_humans_t2", 100, 10, 2, "inc", "R"],
  ["kills_humans_t3", 200, 15, 3, "inc", "R"],
  ["kills_humans_t4", 500, 25, 4, "inc", "R"],
  ["kills_lair_beasts_t1", 50, 5, 1, "inc", "R"],
  ["kills_lair_beasts_t2", 100, 10, 2, "inc", "R"],
  ["kills_lair_beasts_t3", 200, 15, 3, "inc", "R"],
  ["kills_lair_beasts_t4", 500, 25, 4, "inc", "R"],
  ["kills_magical_t1", 50, 5, 1, "inc", "R"],
  ["kills_magical_t2", 100, 10, 2, "inc", "R"],
  ["kills_magical_t3", 200, 15, 3, "inc", "R"],
  ["kills_magical_t4", 500, 25, 4, "inc", "R"],
  ["kills_walking_dead_t1", 50, 5, 1, "inc", "R"],
  ["kills_walking_dead_t2", 100, 10, 2, "inc", "R"],
  ["kills_walking_dead_t3", 200, 15, 3, "inc", "R"],
  ["kills_walking_dead_t4", 500, 25, 4, "inc", "R"],
  ["frequent_flier_t1", 50, 5, 1, "inc", "R"],
  ["frequent_flier_t2", 100, 10, 2, "inc", "R"],
  ["frequent_flier_t3", 200, 15, 3, "inc", "R"],
  ["frequent_flier_t4", 500, 25, 4, "inc", "R"],
  ["death_disease", null, 15, null, "std", "H"],
  ["special_snowflake", null, 5, null, "std", "R"],
];

const IDS = LOCKED.map((r) => r[0]);

const HIDDEN = [
  "naked_ambition", "read_the_label", "death_trap", "death_starvation",
  "death_falling", "ether_entombed", "death_disease", "chicken",
];

const REVEAL_PAIRS = {
  fully_dressed: ["naked_ambition"],
  teetotaler: ["read_the_label"],
  trap_survivor_t1: ["death_trap"],
  survivor_t1: ["death_starvation"],
  depth_t1: ["death_falling"],
  death_falling: ["ether_entombed"],
  frequent_flier_t1: ["death_disease"],
  parlay_t1: ["chicken"],
};

const NULL_THRESHOLD = [
  "fully_dressed", "read_the_label", "death_trap", "death_falling",
  "death_starvation", "ether_entombed", "death_disease", "special_snowflake",
];

const FIELDS = [
  "id", "name", "description", "line", "trigger", "threshold", "tier", "points",
  "initialState", "type", "steps", "reveals", "listOrder", "icon",
];

const TRIGGER_KEYS = {
  lifetimeCounter: ["kind", "counter", "group"],
  singleRunBest: ["kind", "metric", "race", "parentClass"],
  singleRunFlag: ["kind", "flag"],
  deathCause: ["kind", "causes", "floor"],
  lifetimeFlagPair: ["kind", "flags"],
  distinctSetCount: ["kind", "set"],
};

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
const trackOf = (id) => id.replace(/_t[1-4]$/, "");
const isInt = Number.isInteger;

test("catalog: 77 entries in the pinned id order, listOrder is 10 x position", () => {
  assert.equal(ACHIEVEMENTS.length, 77);
  assert.deepEqual(ACHIEVEMENTS.map((a) => a.id), IDS);
  ACHIEVEMENTS.forEach((a, i) => assert.equal(a.listOrder, (i + 1) * 10, a.id));
  assert.equal(new Set(IDS).size, 77);
});

test("catalog: list order sits in the locked block sizes 6 + 4 + 10 + 14 + 13 + 24 + 6", () => {
  const sizes = [6, 4, 10, 14, 13, 24, 6];
  assert.equal(sizes.reduce((s, n) => s + n, 0), 77);
  const firstOfBlock = ["depth_t1", "fully_dressed", "race_human", "survivor_t1", "party_animal_t1", "kills_beasts_t1", "frequent_flier_t1"];
  let at = 0;
  sizes.forEach((n, b) => {
    assert.equal(IDS[at], firstOfBlock[b], `block ${b + 1} starts here`);
    at += n;
  });
  assert.equal(IDS[76], "special_snowflake");
  // The body-count blocks follow BESTIARY key order.
  const groups = Object.keys(BESTIARY).map((g) => `kills_${g.toLowerCase().replace(" ", "_")}_t1`);
  assert.deepEqual(IDS.filter((id) => id.startsWith("kills_") && id.endsWith("_t1")), groups);
});

test("catalog: ids, listOrders and icon paths are unique; ids are safe identifiers", () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.listOrder)).size, 77);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.icon.play)).size, 77);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.icon.ingame)).size, 77);
  for (const a of ACHIEVEMENTS) assert.match(a.id, /^[a-z][a-z0-9_]*$/);
});

test("catalog: strictly ascending listOrder (array order is list order)", () => {
  for (let i = 1; i < ACHIEVEMENTS.length; i++) {
    assert.ok(ACHIEVEMENTS[i].listOrder > ACHIEVEMENTS[i - 1].listOrder, ACHIEVEMENTS[i].id);
  }
});

test("catalog: every entry has exactly the fourteen keys in order, with the right shapes", () => {
  for (const a of ACHIEVEMENTS) {
    assert.deepEqual(Object.keys(a), FIELDS, a.id);
    for (const k of FIELDS) assert.notEqual(a[k], undefined, `${a.id}.${k}`);
    for (const k of ["id", "name", "description", "line"]) assert.equal(typeof a[k], "string", `${a.id}.${k}`);
    assert.ok(a.trigger && typeof a.trigger === "object", a.id);
    assert.ok(Array.isArray(a.reveals), `${a.id}.reveals is an array`);
    assert.ok(a.icon && typeof a.icon.play === "string" && typeof a.icon.ingame === "string", a.id);
    assert.deepEqual(Object.keys(a.icon), ["play", "ingame"], a.id);
    assert.ok(a.type === "standard" || a.type === "incremental", `${a.id} type`);
    assert.ok(a.initialState === "Hidden" || a.initialState === "Revealed", `${a.id} initialState`);
  }
});

test("catalog: integers where present; null only where the rulings allow", () => {
  for (const a of ACHIEVEMENTS) {
    for (const k of ["threshold", "tier", "steps"]) assert.ok(a[k] === null || isInt(a[k]), `${a.id}.${k}`);
    assert.ok(isInt(a.points), `${a.id}.points`);
    assert.ok(isInt(a.listOrder), `${a.id}.listOrder`);
  }
  assert.equal(ACHIEVEMENTS.filter((a) => a.tier === null).length, 22);
  assert.equal(ACHIEVEMENTS.filter((a) => a.tier !== null).length, 55);
  assert.equal(ACHIEVEMENTS.filter((a) => a.steps === null).length, 20);
  assert.deepEqual(ACHIEVEMENTS.filter((a) => a.threshold === null).map((a) => a.id).sort(), [...NULL_THRESHOLD].sort());
  for (const a of ACHIEVEMENTS) {
    if (a.tier !== null) assert.ok(a.tier >= 1 && a.tier <= 4, a.id);
  }
});

test("points: per-id values match the locked table, 5..200 in multiples of 5", () => {
  for (const [id, , points] of LOCKED) assert.equal(byId.get(id).points, points, id);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.points >= 5 && a.points <= 200 && a.points % 5 === 0, a.id);
  }
  assert.equal(Math.min(...ACHIEVEMENTS.map((a) => a.points)), 5);
  assert.equal(Math.max(...ACHIEVEMENTS.map((a) => a.points)), 100);
});

test("points: total is 1200 (group by group), 800 under Play's 2000 cap", () => {
  const sum = (ids) => ids.reduce((s, id) => s + byId.get(id).points, 0);
  const tracks = ["frequent_flier", "kills_beasts", "kills_demons", "kills_humans", "kills_lair_beasts",
    "kills_magical", "kills_walking_dead", "survivor", "hoarder", "party_animal", "human_shields", "parlay", "trap_survivor"];
  const tiered = tracks.flatMap((t) => [1, 2, 3, 4].map((n) => `${t}_t${n}`));
  assert.equal(tiered.length, 52);
  assert.equal(sum(tiered), 715);
  assert.equal(sum(["depth_t1", "depth_t2", "depth_t3"]), 60);
  assert.equal(sum(["unicorn"]), 100);
  assert.equal(sum(["race_human", "race_elven", "race_dwarven", "race_wilmsry", "race_fridgian", "race_troll"]), 120);
  assert.equal(sum(["class_magic_user", "class_fighter", "class_thief"]), 60);
  assert.equal(sum(["tourist"]), 30);
  assert.equal(sum(["fully_dressed", "teetotaler", "chicken", "naked_ambition"]), 65);
  assert.equal(sum(["special_snowflake", "read_the_label", "death_trap", "death_falling", "death_starvation", "ether_entombed", "death_disease"]), 50);
  const total = ACHIEVEMENTS.reduce((s, a) => s + a.points, 0);
  assert.equal(total, 1200);
  assert.equal(715 + 60 + 100 + 120 + 60 + 30 + 65 + 50, 1200);
  assert.ok(total < 2000);
  assert.equal(2000 - total, 800);
});

test("types: exactly the 57 incremental ids and 20 standard ids, pinned by name", () => {
  const inc = LOCKED.filter((r) => r[4] === "inc").map((r) => r[0]);
  const std = LOCKED.filter((r) => r[4] === "std").map((r) => r[0]);
  assert.equal(inc.length, 57);
  assert.equal(std.length, 20);
  assert.deepEqual(ACHIEVEMENTS.filter((a) => a.type === "incremental").map((a) => a.id), inc);
  assert.deepEqual(ACHIEVEMENTS.filter((a) => a.type === "standard").map((a) => a.id), std);
  assert.deepEqual(std, [
    "death_falling", "ether_entombed", "fully_dressed", "naked_ambition", "teetotaler", "read_the_label",
    "race_human", "race_elven", "race_dwarven", "race_wilmsry", "race_fridgian", "race_troll",
    "class_magic_user", "class_fighter", "class_thief", "death_starvation", "death_trap", "chicken",
    "death_disease", "special_snowflake",
  ]);
});

test("steps: equal threshold on incremental (1..10000, hoarder_t4 on the cap), null on standard", () => {
  for (const a of ACHIEVEMENTS) {
    if (a.type === "incremental") {
      assert.equal(a.steps, a.threshold, a.id);
      assert.ok(a.steps >= 1 && a.steps <= 10000, a.id);
    } else {
      assert.equal(a.steps, null, a.id);
    }
  }
  assert.equal(byId.get("hoarder_t4").steps, 10000);
  assert.equal(Math.max(...ACHIEVEMENTS.map((a) => a.steps ?? 0)), 10000);
});

test("thresholds: pinned per id; met when the measured value is at least the threshold", () => {
  for (const [id, threshold, , tier] of LOCKED) {
    assert.equal(byId.get(id).threshold, threshold, id);
    assert.equal(byId.get(id).tier, tier, id);
  }
  // The module header states the at-least rule.
  const src = fs.readFileSync(path.resolve(__dirname, "..", "..", "content", "achievements.js"), "utf8");
  assert.match(src, /AT LEAST the threshold/);
});

test("thresholds: strictly ascend within every track, so no tier shares its neighbour's number", () => {
  const tracks = new Map();
  for (const a of ACHIEVEMENTS) {
    if (a.tier === null) continue;
    const t = trackOf(a.id);
    if (!tracks.has(t)) tracks.set(t, []);
    tracks.get(t).push(a);
  }
  assert.equal(tracks.size, 14); // 13 four-tier tracks and the depth ladder
  for (const [t, list] of tracks) {
    assert.deepEqual(list.map((a) => a.tier), t === "depth" ? [1, 2, 3] : [1, 2, 3, 4], t);
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].threshold > list[i - 1].threshold, `${t} tier ${list[i].tier}`);
      assert.equal(list[i].listOrder, list[i - 1].listOrder + 10, `${t} tiers stay together`);
    }
  }
});

test("hidden: exactly the 8 named ids start Hidden, the other 69 Revealed; no Hidden entry is incremental", () => {
  const hidden = ACHIEVEMENTS.filter((a) => a.initialState === "Hidden").map((a) => a.id);
  assert.equal(hidden.length, 8);
  assert.deepEqual([...hidden].sort(), [...HIDDEN].sort());
  assert.equal(ACHIEVEMENTS.filter((a) => a.initialState === "Revealed").length, 69);
  for (const [id, , , , , state] of LOCKED) assert.equal(byId.get(id).initialState, state === "H" ? "Hidden" : "Revealed", id);
  for (const id of HIDDEN) assert.equal(byId.get(id).type, "standard", id);
});

test("reveals: the 8 pinned pairs, every other entry reveals nothing", () => {
  for (const a of ACHIEVEMENTS) assert.deepEqual(a.reveals, REVEAL_PAIRS[a.id] ?? [], a.id);
  assert.equal(Object.keys(REVEAL_PAIRS).length, 8);
});

test("reveals: each Hidden id has exactly one revealer, no Revealed id is revealed, no self-reveal", () => {
  const count = new Map();
  for (const a of ACHIEVEMENTS) {
    for (const r of a.reveals) {
      assert.ok(byId.has(r), `${a.id} reveals unknown ${r}`);
      assert.notEqual(r, a.id, `${a.id} reveals itself`);
      count.set(r, (count.get(r) ?? 0) + 1);
    }
  }
  for (const a of ACHIEVEMENTS) {
    if (a.initialState === "Hidden") assert.equal(count.get(a.id), 1, `${a.id} has one revealer`);
    else assert.equal(count.get(a.id), undefined, `${a.id} is Revealed so nothing reveals it`);
  }
});

test("reveals: graph is acyclic, every Hidden id is reachable from a Revealed root, revealers come first", () => {
  // Walk up from each Hidden id through its revealer chain; a loop or a Hidden
  // root would never reach a Revealed entry.
  const revealerOf = new Map();
  for (const a of ACHIEVEMENTS) for (const r of a.reveals) revealerOf.set(r, a.id);
  for (const a of ACHIEVEMENTS.filter((e) => e.initialState === "Hidden")) {
    const seen = new Set([a.id]);
    let cur = a.id;
    while (revealerOf.has(cur)) {
      const up = revealerOf.get(cur);
      assert.ok(!seen.has(up), `cycle through ${up}`);
      seen.add(up);
      cur = up;
    }
    assert.equal(byId.get(cur).initialState, "Revealed", `${a.id} chain ends at a Revealed root`);
  }
  for (const a of ACHIEVEMENTS) {
    for (const r of a.reveals) assert.ok(a.listOrder < byId.get(r).listOrder, `${a.id} precedes ${r}`);
  }
  // The chain is two long exactly once: depth_t1 -> death_falling -> ether_entombed.
  assert.equal(revealerOf.get("ether_entombed"), "death_falling");
  assert.equal(revealerOf.get("death_falling"), "depth_t1");
});

test("triggers: vocabulary is the closed six-kind set and every trigger uses it", () => {
  assert.deepEqual(TRIGGER_VOCABULARY.kinds, Object.keys(TRIGGER_KEYS));
  assert.deepEqual(TRIGGER_VOCABULARY.counters, ["deaths", "kills", "joinersAccepted", "joinersFallen", "parleysWon", "trapsSurvived"]);
  assert.deepEqual(TRIGGER_VOCABULARY.metrics, ["depth", "days", "wilmstHeld", "fleesWon"]);
  assert.deepEqual(TRIGGER_VOCABULARY.runFlags, ["fullyDressed", "nakedAtFirstStep", "noHealingPotion"]);
  assert.deepEqual(TRIGGER_VOCABULARY.lifetimeFlags, ["diseaseLeftOnOneHp", "poisonLeftOnOneHp"]);
  assert.deepEqual(TRIGGER_VOCABULARY.sets, ["subClassesDelved"]);
  assert.ok(Object.isFrozen(TRIGGER_VOCABULARY));
  assert.ok(Object.isFrozen(ACHIEVEMENTS));
  const V = TRIGGER_VOCABULARY;
  for (const a of ACHIEVEMENTS) {
    const t = a.trigger;
    assert.ok(V.kinds.includes(t.kind), `${a.id} kind`);
    assert.deepEqual(Object.keys(t), TRIGGER_KEYS[t.kind], `${a.id} key set`);
    for (const v of Object.values(t)) assert.notEqual(v, undefined, a.id);
    if (t.kind === "lifetimeCounter") assert.ok(V.counters.includes(t.counter), a.id);
    if (t.kind === "singleRunBest") assert.ok(V.metrics.includes(t.metric), a.id);
    if (t.kind === "singleRunFlag") assert.ok(V.runFlags.includes(t.flag), a.id);
    if (t.kind === "lifetimeFlagPair") {
      assert.equal(t.flags.length, 2, a.id);
      for (const f of t.flags) assert.ok(V.lifetimeFlags.includes(f), a.id);
    }
    if (t.kind === "distinctSetCount") assert.ok(V.sets.includes(t.set), a.id);
  }
});

test("triggers: kill groups are BESTIARY keys (all six used), death causes are CAUSE_TEXT keys but not abandon", () => {
  const groups = new Set();
  for (const a of ACHIEVEMENTS) {
    const t = a.trigger;
    if (t.kind === "lifetimeCounter") {
      if (t.counter === "kills") {
        assert.ok(Object.hasOwn(BESTIARY, t.group), `${a.id} group`);
        assert.equal(a.id.startsWith(`kills_${t.group.toLowerCase().replace(" ", "_")}_t`), true, a.id);
        groups.add(t.group);
      } else {
        assert.equal(t.group, null, a.id);
      }
    }
    if (t.kind === "deathCause") {
      if (t.causes !== null) {
        assert.ok(Array.isArray(t.causes) && t.causes.length > 0, a.id);
        for (const c of t.causes) {
          assert.ok(Object.hasOwn(CAUSE_TEXT, c), `${a.id} cause ${c}`);
          assert.notEqual(c, "abandon", a.id);
        }
      }
      assert.ok(t.floor === null || isInt(t.floor), a.id);
    }
  }
  assert.deepEqual([...groups], Object.keys(BESTIARY));
});

test("triggers: per-id wiring of the single-run, death and flag rules", () => {
  const T = (id) => byId.get(id).trigger;
  for (const id of ["depth_t1", "depth_t2", "depth_t3", "unicorn"]) assert.deepEqual(T(id), { kind: "singleRunBest", metric: "depth", race: null, parentClass: null });
  assert.deepEqual(T("death_falling"), { kind: "deathCause", causes: ["fall", "gorge"], floor: null });
  assert.deepEqual(T("ether_entombed"), { kind: "deathCause", causes: ["entombed"], floor: null });
  assert.deepEqual(T("read_the_label"), { kind: "deathCause", causes: ["potion"], floor: null });
  assert.deepEqual(T("death_trap"), { kind: "deathCause", causes: ["trap"], floor: null });
  assert.deepEqual(T("death_starvation"), { kind: "deathCause", causes: ["starve"], floor: null });
  assert.deepEqual(T("special_snowflake"), { kind: "deathCause", causes: null, floor: 1 });
  assert.deepEqual(T("fully_dressed"), { kind: "singleRunFlag", flag: "fullyDressed" });
  assert.deepEqual(T("naked_ambition"), { kind: "singleRunFlag", flag: "nakedAtFirstStep" });
  assert.deepEqual(T("teetotaler"), { kind: "singleRunFlag", flag: "noHealingPotion" });
  assert.deepEqual(T("chicken"), { kind: "singleRunBest", metric: "fleesWon", race: null, parentClass: null });
  assert.deepEqual(T("death_disease"), { kind: "lifetimeFlagPair", flags: ["diseaseLeftOnOneHp", "poisonLeftOnOneHp"] });
  assert.deepEqual(T("tourist"), { kind: "distinctSetCount", set: "subClassesDelved" });
  const counters = { frequent_flier: "deaths", party_animal: "joinersAccepted", human_shields: "joinersFallen", parlay: "parleysWon", trap_survivor: "trapsSurvived" };
  for (const a of ACHIEVEMENTS) {
    const c = counters[trackOf(a.id)];
    if (c) assert.deepEqual(a.trigger, { kind: "lifetimeCounter", counter: c, group: null }, a.id);
  }
  const metrics = { survivor: "days", hoarder: "wilmstHeld" };
  for (const a of ACHIEVEMENTS) {
    const m = metrics[trackOf(a.id)];
    if (m) assert.deepEqual(a.trigger, { kind: "singleRunBest", metric: m, race: null, parentClass: null }, a.id);
  }
});

test("triggers: races and parent classes are RACES / CLASSES keys; Tourist counts every sub-class; Hoarder tiers are the bag caps", () => {
  const races = ACHIEVEMENTS.filter((a) => a.id.startsWith("race_"));
  assert.deepEqual(races.map((a) => a.trigger.race), Object.keys(RACES));
  for (const a of races) {
    assert.equal(a.trigger.parentClass, null);
    assert.equal(a.trigger.metric, "depth");
    assert.equal(a.id, `race_${a.trigger.race.toLowerCase()}`);
  }
  const classes = ACHIEVEMENTS.filter((a) => a.id.startsWith("class_"));
  assert.deepEqual(classes.map((a) => a.trigger.parentClass), Object.keys(CLASSES));
  for (const a of classes) {
    assert.equal(a.trigger.race, null);
    assert.equal(a.trigger.metric, "depth");
    assert.equal(a.id, `class_${a.trigger.parentClass.toLowerCase().replace(" ", "_")}`);
  }
  const subs = Object.values(CLASSES).reduce((n, c) => n + c.subs.length, 0);
  assert.equal(subs, 24);
  assert.equal(byId.get("tourist").threshold, subs);
  assert.deepEqual(
    [1, 2, 3, 4].map((n) => byId.get(`hoarder_t${n}`).threshold),
    [BAGS.small.wilmst, BAGS.medium.wilmst, BAGS.large.wilmst, BAGS.exlarge.wilmst],
  );
});

test("triggers: strings are lower-camel identifiers or BESTIARY / RACES / CLASSES keys", () => {
  const keys = new Set([...Object.keys(BESTIARY), ...Object.keys(RACES), ...Object.keys(CLASSES)]);
  const ident = /^[a-z][A-Za-z0-9]*$/;
  for (const a of ACHIEVEMENTS) {
    for (const [k, v] of Object.entries(a.trigger)) {
      const strs = Array.isArray(v) ? v : [v];
      for (const s of strs) {
        if (typeof s !== "string") continue;
        assert.ok(ident.test(s) || keys.has(s), `${a.id}.trigger.${k} = ${s}`);
      }
    }
  }
});

test("icons: the manifest has 77 rows and each entry maps to exactly one row, none left over", () => {
  assert.equal(MANIFEST.length, 77);
  const playRows = new Map(MANIFEST.map((r) => [r.file_play, r]));
  const ingameRows = new Map(MANIFEST.map((r) => [r.file_ingame, r]));
  assert.equal(playRows.size, 77);
  assert.equal(ingameRows.size, 77);
  const used = new Set();
  for (const a of ACHIEVEMENTS) {
    const row = playRows.get(a.icon.play);
    assert.ok(row, `${a.id} play icon in manifest`);
    assert.equal(row.file_ingame, a.icon.ingame, a.id);
    assert.ok(!used.has(row), `${a.id} shares a manifest row`);
    used.add(row);
  }
  assert.equal(used.size, MANIFEST.length);
});

test("icons: id equals the file stem; files exist at the pinned sizes", () => {
  const png = (rel) => {
    const buf = fs.readFileSync(path.join(ACH_DIR, rel));
    assert.equal(buf.subarray(1, 4).toString("latin1"), "PNG", rel);
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  };
  for (const a of ACHIEVEMENTS) {
    assert.equal(a.icon.play, `play/ach_${a.id}.png`);
    assert.equal(a.icon.ingame, `ingame/ach_${a.id}.png`);
    const stem = path.basename(a.icon.play).replace(/^ach_/, "").replace(/\.png$/, "");
    assert.equal(a.id, stem);
    assert.deepEqual(png(a.icon.play), [512, 512], a.icon.play);
    assert.deepEqual(png(a.icon.ingame), [144, 144], a.icon.ingame);
  }
});

test("icons: the dropped fallen-summons achievement has no export left, its source picture stays", () => {
  for (const d of ["play", "ingame", "master"]) {
    const files = fs.readdirSync(path.join(ACH_DIR, d)).filter((f) => f.endsWith(".png"));
    assert.equal(files.length, 77, d);
    assert.deepEqual(files.filter((f) => f.includes("disposable")), [], d);
  }
  assert.ok(MANIFEST.every((r) => r.id !== "disposable_help"));
  assert.ok(!ACHIEVEMENTS.some((a) => a.id.includes("disposable")));
  assert.ok(fs.existsSync(path.join(ACH_DIR, "sources", "ach_disposable_help.png")));
});

test("catalog: stored fields only, never derived from position (reordering cannot change type or state)", () => {
  // Every entry is a frozen-array member whose type and initialState are literal
  // properties; sorting a copy by listOrder leaves the id order untouched.
  const sorted = [...ACHIEVEMENTS].sort((a, b) => a.listOrder - b.listOrder);
  assert.deepEqual(sorted.map((a) => a.id), IDS);
  for (const a of ACHIEVEMENTS) {
    assert.ok(Object.hasOwn(a, "type"));
    assert.ok(Object.hasOwn(a, "initialState"));
  }
});

test("catalog: copy fields are strings (their content is plan 98-02's to test)", () => {
  for (const a of ACHIEVEMENTS) {
    for (const k of ["name", "description", "line"]) assert.equal(typeof a[k], "string", `${a.id}.${k}`);
  }
});
