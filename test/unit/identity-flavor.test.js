// test/unit/identity-flavor.test.js
//
// Phase 96 (FLAVOR-03; CONTEXT 'Good and bad are guarded by tags'): a race or
// sub-class flavour blurb is tagged with the identity good and bad ids it hints
// at, and every tag must be a real id of that identity (identityEntries in
// src/browser/identityFooter.js, the Phase 24 identity contract). So no blurb
// can claim a perk or a drawback its identity does not have, and none can lose
// its good or its bad. The ids are read live, never typed from memory.
//
// Also pins the fact the guard rests on: every race and every sub-class has at
// least one real good and one real bad entry (Human alone is neutral).
//
// The live loop runs for every FLAVOR_DOMAINS record with a `tags` function
// (race and sub).

import test from "node:test";
import assert from "node:assert/strict";

import { identityEntries } from "../../src/browser/identityFooter.js";
import { FLAVOR_DOMAINS } from "../../src/browser/flavorText.js";
import { RACES, CLASSES } from "../../content/index.js";

/**
 * tagProblems(kind, key, record) — the reasons `record` does not tag the
 * identity `kind`/`key` correctly. An empty array is a valid tagging.
 */
function tagProblems(kind, key, record) {
  const out = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) return ["not a record"];
  if (typeof record.line !== "string" || !record.line) out.push("line is not a non-empty string");
  const entries = identityEntries(kind, key);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const neutral = entries.find((e) => e.side === "neutral");
  for (const side of ["good", "bad"]) {
    const ids = record[side];
    if (!Array.isArray(ids)) { out.push(`${side} is not an array`); continue; }
    if (new Set(ids).size !== ids.length) out.push(`${side} has a duplicated id`);
    for (const id of ids) {
      if (typeof id !== "string") { out.push(`${side} holds a non-string`); continue; }
      const e = byId.get(id);
      if (!e) out.push(`${side} id "${id}" is not an entry of ${kind} ${key}`);
      else if (e.side !== side) out.push(`${side} id "${id}" is a ${e.side} entry`);
    }
  }
  if (Array.isArray(record.good) && Array.isArray(record.bad)) {
    const shared = record.good.filter((id) => record.bad.includes(id));
    if (shared.length) out.push(`good and bad share ${shared.join(", ")}`);
  }
  if (neutral) {
    if (record.neutral !== neutral.id) out.push(`neutral is not "${neutral.id}"`);
    if (Array.isArray(record.good) && record.good.length) out.push("a neutral identity carries a good id");
    if (Array.isArray(record.bad) && record.bad.length) out.push("a neutral identity carries a bad id");
  } else {
    if (record.neutral !== undefined) out.push("a non-neutral identity claims neutral");
    if (Array.isArray(record.good) && record.good.length < 1) out.push("no good id");
    if (Array.isArray(record.bad) && record.bad.length < 1) out.push("no bad id");
  }
  return out;
}

const idsOf = (kind, key, side) => identityEntries(kind, key).filter((e) => e.side === side).map((e) => e.id);

// ---------------------------------------------------------------------------
// the fact the guard rests on
// ---------------------------------------------------------------------------

test("every non-Human race and every sub-class has a real good and a real bad entry; Human is exactly one neutral", () => {
  for (const race of Object.keys(RACES)) {
    const entries = identityEntries("race", race);
    if (race === "Human") {
      assert.deepEqual(entries.map((e) => [e.id, e.side]), [["human-neutral", "neutral"]]);
      continue;
    }
    assert.ok(entries.some((e) => e.side === "good"), `${race} has a good entry`);
    assert.ok(entries.some((e) => e.side === "bad"), `${race} has a bad entry`);
    assert.ok(!entries.some((e) => e.side === "neutral"), `${race} has no neutral entry`);
  }
  let subs = 0;
  for (const [cls, row] of Object.entries(CLASSES)) {
    for (const sub of row.subs) {
      const entries = identityEntries("sub", sub);
      assert.ok(entries.some((e) => e.side === "good"), `${cls}/${sub} has a good entry`);
      assert.ok(entries.some((e) => e.side === "bad"), `${cls}/${sub} has a bad entry`);
      subs++;
    }
  }
  assert.equal(subs, 24, "all 24 sub-classes were checked");
});

// ---------------------------------------------------------------------------
// teeth: the guard must catch what it claims to
// ---------------------------------------------------------------------------

test("teeth: a valid Elven record built from live ids passes the tag guard", () => {
  const rec = { line: "x.", good: [idsOf("race", "Elven", "good")[0]], bad: [idsOf("race", "Elven", "bad")[0]] };
  assert.deepEqual(tagProblems("race", "Elven", rec), []);
  const all = { line: "x.", good: idsOf("race", "Elven", "good"), bad: idsOf("race", "Elven", "bad") };
  assert.deepEqual(tagProblems("race", "Elven", all), []);
});

test("teeth: a record with no bad id fails", () => {
  const rec = { line: "x.", good: [idsOf("race", "Elven", "good")[0]], bad: [] };
  assert.ok(tagProblems("race", "Elven", rec).includes("no bad id"));
});

test("teeth: a record with no good id fails", () => {
  const rec = { line: "x.", good: [], bad: [idsOf("race", "Elven", "bad")[0]] };
  assert.ok(tagProblems("race", "Elven", rec).includes("no good id"));
});

test("teeth: an id that is not an entry of the identity fails", () => {
  const rec = { line: "x.", good: ["no-such-id"], bad: [idsOf("race", "Elven", "bad")[0]] };
  assert.ok(tagProblems("race", "Elven", rec).some((p) => p.includes('"no-such-id" is not an entry')));
  // an id from another race is not an entry of this one
  const elven = new Set(identityEntries("race", "Elven").map((e) => e.id));
  const other = idsOf("race", "Fridgian", "good").find((id) => !elven.has(id));
  assert.ok(other, "fixture: a Fridgian-only id");
  assert.ok(tagProblems("race", "Elven", { line: "x.", good: [other], bad: [idsOf("race", "Elven", "bad")[0]] }).length > 0);
});

test("teeth: a good id that is a bad entry (wrong side) fails, and the reverse", () => {
  const goodId = idsOf("race", "Elven", "good")[0];
  const badId = idsOf("race", "Elven", "bad")[0];
  assert.ok(tagProblems("race", "Elven", { line: "x.", good: [badId], bad: [badId] }).some((p) => p.includes("is a bad entry")));
  assert.ok(tagProblems("race", "Elven", { line: "x.", good: [goodId], bad: [goodId] }).some((p) => p.includes("is a good entry")));
});

test("teeth: a duplicated id fails", () => {
  const g = idsOf("race", "Elven", "good")[0];
  const b = idsOf("race", "Elven", "bad")[0];
  assert.ok(tagProblems("race", "Elven", { line: "x.", good: [g, g], bad: [b] }).includes("good has a duplicated id"));
  assert.ok(tagProblems("race", "Elven", { line: "x.", good: [g], bad: [b, b] }).includes("bad has a duplicated id"));
});

test("teeth: a neutral claim on a non-neutral race fails", () => {
  const rec = { line: "x.", good: [idsOf("race", "Elven", "good")[0]], bad: [idsOf("race", "Elven", "bad")[0]], neutral: "human-neutral" };
  assert.ok(tagProblems("race", "Elven", rec).includes("a non-neutral identity claims neutral"));
});

test("teeth: Human carries the neutral tag alone, a good id on Human fails", () => {
  assert.deepEqual(tagProblems("race", "Human", { line: "x.", good: [], bad: [], neutral: "human-neutral" }), []);
  assert.ok(tagProblems("race", "Human", { line: "x.", good: [idsOf("race", "Elven", "good")[0]], bad: [], neutral: "human-neutral" }).length > 0, "a good id on Human");
  assert.ok(tagProblems("race", "Human", { line: "x.", good: [], bad: [] }).some((p) => p.includes("neutral is not")), "Human without the neutral tag");
});

test("teeth: malformed records fail", () => {
  for (const bad of [null, undefined, "a string", 7, []]) assert.deepEqual(tagProblems("race", "Elven", bad), ["not a record"]);
  assert.ok(tagProblems("race", "Elven", { line: "", good: ["x"], bad: ["y"] }).includes("line is not a non-empty string"));
  assert.ok(tagProblems("race", "Elven", { line: "x.", good: "elven-prices", bad: [] }).includes("good is not an array"));
});

// ---------------------------------------------------------------------------
// the live loop: every domain with tags() (race and sub)
// ---------------------------------------------------------------------------

for (const d of FLAVOR_DOMAINS.filter((x) => typeof x.tags === "function")) {
  test(`${d.id}: every key has a record that passes the tag guard, and the record keys equal the content keys`, () => {
    const m = d.tags();
    assert.ok(m && typeof m === "object", `${d.exportName} (${d.module}) is not exported`);
    assert.deepEqual(Object.keys(m), d.keys(), `${d.exportName}: record keys in content-table order`);
    for (const k of d.keys()) assert.deepEqual(tagProblems(d.id, k, m[k]), [], `${d.exportName}["${k}"]`);
  });
}

test("the live loop covers both the race and the sub domains, so the tag guard cannot stop covering sub-classes", () => {
  const ids = new Set(FLAVOR_DOMAINS.filter((x) => typeof x.tags === "function").map((x) => x.id));
  assert.ok(ids.has("race"), "race exposes tags()");
  assert.ok(ids.has("sub"), "sub exposes tags()");
  // the class domain is plain strings with no identity good and bad: it stays out of the guard
  assert.ok(!ids.has("class"));
  assert.equal(FLAVOR_DOMAINS.find((x) => x.id === "sub").keys().length, 24);
});
