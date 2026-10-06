// test/unit/play-achievements.test.js
//
// Phase 101 plan 02 task 1. The pure core of src/browser/playAchievements.js:
// resource names, the one legal Play op per entry, the tolerant ledger, the
// record-minus-ledger diff, the full-coverage proof against the real Play
// Console export (PGS-11), and the source pins.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { ACHIEVEMENTS } from "../../content/achievements.js";
import { sanitizeRecord } from "../../src/browser/achievementRecord.js";
import { PLAY_GAMES_CONFIG } from "../../src/browser/firebaseConfig.js";
import {
  PGS_ACH_KEY,
  BATCH_MAX,
  UNLOCK_DELAY_MS,
  PROGRESS_DELAY_MS,
  achievementResourceName,
  playOpFor,
  emptyLedger,
  sanitizeLedger,
  pendingOps,
} from "../../src/browser/playAchievements.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SRC_PATH = path.join(REPO_ROOT, "src", "browser", "playAchievements.js");

const byId = (id) => ACHIEVEMENTS.find((e) => e.id === id);
const INCREMENTALS = ACHIEVEMENTS.filter((e) => e.type === "incremental");
const STANDARDS = ACHIEVEMENTS.filter((e) => e.type === "standard");
const sorted = [...ACHIEVEMENTS].sort((a, b) => a.listOrder - b.listOrder || (a.id < b.id ? -1 : 1));

function rec(extra = {}) {
  return sanitizeRecord({ v: 1, ...extra });
}

function readExport() {
  const xml = fs.readFileSync(path.join(REPO_ROOT, "achievements", "games-ids.xml"), "utf8").replace(/\r\n/g, "\n");
  const map = new Map();
  const re = /<string name="([^"]+)"[^>]*>([^<]*)<\/string>/g;
  let m;
  while ((m = re.exec(xml)) !== null) map.set(m[1], m[2]);
  return map;
}

test("constants carry the CONTEXT values", () => {
  assert.equal(PGS_ACH_KEY, "ddr.pgsAch.v1");
  assert.equal(BATCH_MAX, 20);
  assert.equal(UNLOCK_DELAY_MS, 1500);
  assert.equal(PROGRESS_DELAY_MS, 60000);
});

test("catalog shape the mirror relies on: 77 entries, 57 incremental, 20 standard", () => {
  assert.equal(ACHIEVEMENTS.length, 77);
  assert.equal(INCREMENTALS.length, 57);
  assert.equal(STANDARDS.length, 20);
});

// ---------------------------------------------------------------------
// achievementResourceName
// ---------------------------------------------------------------------

test("achievementResourceName: the documented examples", () => {
  assert.equal(achievementResourceName({ name: "Downward Mobility I" }), "achievement_downward_mobility_i");
  assert.equal(achievementResourceName({ name: "Unicorn!" }), "achievement_unicorn");
  assert.equal(achievementResourceName({ name: "Body Count: Lair Beasts II" }), "achievement_body_count_lair_beasts_ii");
});

test("achievementResourceName: every derived name is a legal resource name", () => {
  for (const e of ACHIEVEMENTS) {
    assert.match(achievementResourceName(e), /^achievement_[a-z0-9_]{1,80}$/, e.id);
  }
});

// ---------------------------------------------------------------------
// PGS-11 coverage against the real Play Console export
// ---------------------------------------------------------------------

test("coverage: the 77 derived names are exactly the export's achievement strings", () => {
  const exported = readExport();
  const exportNames = new Set([...exported.keys()].filter((k) => k.startsWith("achievement_")));
  const derived = ACHIEVEMENTS.map(achievementResourceName);
  const derivedSet = new Set(derived);

  assert.equal(derivedSet.size, derived.length, "the derived resource names must be distinct");
  assert.equal(derived.length, 77);
  const missing = derived.filter((n) => !exportNames.has(n));
  const unused = [...exportNames].filter((n) => !derivedSet.has(n));
  assert.deepEqual(missing, [], `catalog entries with no string in games-ids.xml: ${missing.join(", ")}`);
  assert.deepEqual(unused, [], `achievement strings in games-ids.xml the catalog does not derive: ${unused.join(", ")}`);
  assert.equal(exportNames.size, 77);
});

test("coverage: every value is non-empty and distinct, and app_id matches the config", () => {
  const exported = readExport();
  const values = [];
  for (const [name, value] of exported) {
    if (!name.startsWith("achievement_")) continue;
    assert.ok(value.length > 0, `empty value for ${name}`);
    values.push(value);
  }
  assert.equal(new Set(values).size, values.length, "the export's achievement values must be distinct");
  assert.equal(exported.get("app_id"), PLAY_GAMES_CONFIG.appId);
});

// ---------------------------------------------------------------------
// playOpFor
// ---------------------------------------------------------------------

test("playOpFor: steps for all 57 incrementals, unlock for all 20 standards", () => {
  for (const e of INCREMENTALS) assert.equal(playOpFor(e), "steps", e.id);
  for (const e of STANDARDS) assert.equal(playOpFor(e), "unlock", e.id);
});

test("playOpFor: null for a non-object or an unknown type", () => {
  assert.equal(playOpFor(null), null);
  assert.equal(playOpFor(undefined), null);
  assert.equal(playOpFor("depth_t1"), null);
  assert.equal(playOpFor([]), null);
  assert.equal(playOpFor({ type: "mystery" }), null);
  assert.equal(playOpFor({}), null);
});

// ---------------------------------------------------------------------
// emptyLedger and sanitizeLedger
// ---------------------------------------------------------------------

test("emptyLedger is the documented empty shape and a fresh object each call", () => {
  assert.deepEqual(emptyLedger(), { v: 1, player: null, u: [], r: [], s: {}, failures: 0, retryAt: 0 });
  assert.notEqual(emptyLedger(), emptyLedger());
  assert.notEqual(emptyLedger().u, emptyLedger().u);
});

test("sanitizeLedger: garbage and another version load empty", () => {
  for (const raw of [null, undefined, "x", 7, [], { v: 2, u: ["special_snowflake"] }, { u: ["special_snowflake"] }]) {
    assert.deepEqual(sanitizeLedger(raw), emptyLedger());
  }
});

test("sanitizeLedger: only catalog ids, deduplicated, steps clamped to incrementals", () => {
  const out = sanitizeLedger({
    v: 1,
    player: "p1",
    u: ["special_snowflake", "special_snowflake", "nope", 5, "class_fighter"],
    r: ["death_falling", "death_falling", "ghost"],
    s: {
      kills_beasts_t1: 37.9,
      depth_t1: 9999,
      tourist: 0,
      parlay_t1: -3,
      parlay_t2: "12",
      kills_beasts_t2: Number.NaN,
      special_snowflake: 1,
      ghost: 4,
    },
    failures: 2,
    retryAt: 12345,
  });
  assert.deepEqual(out.u, ["special_snowflake", "class_fighter"]);
  assert.deepEqual(out.r, ["death_falling"]);
  assert.deepEqual(out.s, { kills_beasts_t1: 37, depth_t1: 5 });
  assert.equal(out.player, "p1");
  assert.equal(out.failures, 2);
  assert.equal(out.retryAt, 12345);
  assert.ok(!Object.isFrozen(out), "the ledger must stay updatable");
});

test("sanitizeLedger: player, failures and retryAt tolerance", () => {
  assert.equal(sanitizeLedger({ v: 1, player: "" }).player, null);
  assert.equal(sanitizeLedger({ v: 1, player: 12 }).player, null);
  assert.equal(sanitizeLedger({ v: 1, player: "x".repeat(129) }).player, null);
  assert.equal(sanitizeLedger({ v: 1, player: "x".repeat(128) }).player, "x".repeat(128));
  assert.equal(sanitizeLedger({ v: 1, failures: -1 }).failures, 0);
  assert.equal(sanitizeLedger({ v: 1, failures: 1.5 }).failures, 0);
  assert.equal(sanitizeLedger({ v: 1, failures: "3" }).failures, 0);
  assert.equal(sanitizeLedger({ v: 1, retryAt: -5 }).retryAt, 0);
  assert.equal(sanitizeLedger({ v: 1, retryAt: Infinity }).retryAt, 0);
  assert.equal(sanitizeLedger({ v: 1, retryAt: "9" }).retryAt, 0);
});

// ---------------------------------------------------------------------
// pendingOps
// ---------------------------------------------------------------------

test("pendingOps: an empty record has nothing pending, a null record too", () => {
  assert.deepEqual([...pendingOps(rec(), emptyLedger())], []);
  assert.deepEqual([...pendingOps(null, emptyLedger())], []);
});

test("pendingOps: an unlocked standard entry gives one unlock op carrying its resource", () => {
  const ops = pendingOps(rec({ unlocked: { special_snowflake: 111 } }), emptyLedger());
  assert.equal(ops.length, 1);
  assert.equal(ops[0].kind, "unlock");
  assert.equal(ops[0].id, "special_snowflake");
  assert.equal(ops[0].resource, achievementResourceName(byId("special_snowflake")));
  assert.equal("n" in ops[0], false);
});

test("pendingOps: an incremental gives its measure as steps, never above its steps", () => {
  const ops = pendingOps(rec({ kills: { Beasts: 37 } }), emptyLedger());
  const beasts = ops.filter((o) => o.id.startsWith("kills_beasts"));
  assert.equal(beasts.length, 4);
  assert.ok(beasts.every((o) => o.kind === "steps"));
  assert.equal(beasts.find((o) => o.id === "kills_beasts_t1").n, 37);
  assert.equal(beasts.find((o) => o.id === "kills_beasts_t2").n, 37);

  const big = pendingOps(rec({ kills: { Beasts: 100000 } }), emptyLedger());
  assert.equal(big.find((o) => o.id === "kills_beasts_t1").n, 50);
  assert.equal(big.find((o) => o.id === "kills_beasts_t4").n, 500);
});

test("pendingOps: an unlocked incremental sends its full steps whatever the measure", () => {
  const ops = pendingOps(rec({ unlocked: { kills_beasts_t1: 5 } }), emptyLedger());
  assert.equal(ops.length, 1);
  assert.deepEqual({ id: ops[0].id, kind: ops[0].kind, n: ops[0].n }, { id: "kills_beasts_t1", kind: "steps", n: 50 });
});

test("pendingOps: steps adjacency, equal to the acked value is not resent and one greater is", () => {
  const ledger = { ...emptyLedger(), s: { kills_beasts_t2: 37 } };
  const same = pendingOps(rec({ kills: { Beasts: 37 } }), ledger).filter((o) => o.id === "kills_beasts_t2");
  assert.deepEqual(same, []);
  const more = pendingOps(rec({ kills: { Beasts: 38 } }), ledger).filter((o) => o.id === "kills_beasts_t2");
  assert.equal(more.length, 1);
  assert.equal(more[0].n, 38);
  const lower = pendingOps(rec({ kills: { Beasts: 30 } }), ledger).filter((o) => o.id === "kills_beasts_t2");
  assert.deepEqual(lower, []);
});

test("pendingOps: a value equal to entry.steps is sent once and never exceeded", () => {
  const first = pendingOps(rec({ kills: { Beasts: 60 } }), emptyLedger()).find((o) => o.id === "kills_beasts_t1");
  assert.equal(first.n, 50);
  const ledger = { ...emptyLedger(), s: { kills_beasts_t1: 50 } };
  const again = pendingOps(rec({ kills: { Beasts: 400 } }), ledger).filter((o) => o.id === "kills_beasts_t1");
  assert.deepEqual(again, []);
});

test("pendingOps: a revealed Hidden entry gives a reveal, and once unlocked only the unlock", () => {
  const revealedOnly = pendingOps(rec({ revealed: ["death_falling"] }), emptyLedger());
  assert.equal(revealedOnly.length, 1);
  assert.equal(revealedOnly[0].kind, "reveal");
  assert.equal(revealedOnly[0].id, "death_falling");

  const both = pendingOps(rec({ revealed: ["death_falling"], unlocked: { death_falling: 9 } }), emptyLedger());
  assert.equal(both.length, 1);
  assert.equal(both[0].kind, "unlock");
});

test("pendingOps: acked entries and skipped ids are excluded", () => {
  const record = rec({ unlocked: { special_snowflake: 1, class_fighter: 2 }, revealed: ["death_falling"] });
  const ledger = { ...emptyLedger(), u: ["special_snowflake"], r: ["death_falling"] };
  const ops = pendingOps(record, ledger);
  assert.deepEqual(ops.map((o) => o.id), ["class_fighter"]);
  assert.deepEqual(pendingOps(record, ledger, undefined, new Set(["class_fighter"])).map((o) => o.id), []);
  assert.deepEqual(pendingOps(record, ledger, undefined, ["class_fighter"]).map((o) => o.id), []);
});

test("pendingOps: order is reveals, then steps, then unlocks, each by listOrder", () => {
  const record = rec({
    unlocked: { special_snowflake: 1, class_fighter: 2 },
    revealed: ["death_falling", "naked_ambition"],
    kills: { Beasts: 10, Humans: 60 },
    counters: { deaths: 3 },
  });
  const ops = pendingOps(record, emptyLedger());
  const kinds = ops.map((o) => o.kind);
  const firstSteps = kinds.indexOf("steps");
  const firstUnlock = kinds.indexOf("unlock");
  assert.deepEqual(kinds.slice(0, firstSteps), ["reveal", "reveal"]);
  assert.ok(firstSteps < firstUnlock);
  assert.ok(kinds.slice(firstSteps, firstUnlock).every((k) => k === "steps"));
  assert.ok(kinds.slice(firstUnlock).every((k) => k === "unlock"));
  const order = new Map(sorted.map((e, i) => [e.id, i]));
  for (const kind of ["reveal", "steps", "unlock"]) {
    const group = ops.filter((o) => o.kind === kind).map((o) => order.get(o.id));
    assert.deepEqual(group, [...group].sort((a, b) => a - b), `${kind} group out of listOrder`);
  }
});

test("pendingOps: identical inputs give identical output whatever order the record's arrays hold", () => {
  const a = rec({ revealed: ["death_falling", "naked_ambition", "read_the_label"], unlocked: { class_fighter: 2, special_snowflake: 1 } });
  const b = rec({ revealed: ["read_the_label", "naked_ambition", "death_falling"], unlocked: { special_snowflake: 1, class_fighter: 2 } });
  assert.deepEqual(pendingOps(a, emptyLedger()), pendingOps(b, emptyLedger()));
  assert.deepEqual(pendingOps(a, emptyLedger()), pendingOps(a, emptyLedger()));
});

test("pendingOps: the result and every op are frozen", () => {
  const ops = pendingOps(rec({ unlocked: { special_snowflake: 1 }, kills: { Beasts: 3 } }), emptyLedger());
  assert.ok(ops.length > 0);
  assert.ok(Object.isFrozen(ops));
  for (const op of ops) assert.ok(Object.isFrozen(op));
  assert.ok(Object.isFrozen(pendingOps(null, null)));
});

test("pendingOps: a catalog argument limits the entries considered", () => {
  const only = ACHIEVEMENTS.filter((e) => e.id === "class_fighter");
  const ops = pendingOps(rec({ unlocked: { special_snowflake: 1, class_fighter: 2 } }), emptyLedger(), only);
  assert.deepEqual(ops.map((o) => o.id), ["class_fighter"]);
});

test("idempotence: a ledger that acked everything pends nothing; a half-acked ledger reloaded pends the other half", () => {
  const record = rec({
    unlocked: { special_snowflake: 1, class_fighter: 2, kills_beasts_t1: 3 },
    revealed: ["death_falling"],
    kills: { Humans: 20 },
  });
  const all = pendingOps(record, emptyLedger());
  assert.ok(all.length >= 4);

  const full = emptyLedger();
  for (const op of all) {
    if (op.kind === "unlock") full.u.push(op.id);
    else if (op.kind === "reveal") full.r.push(op.id);
    else full.s[op.id] = op.n;
  }
  assert.deepEqual([...pendingOps(record, full)], []);

  const half = emptyLedger();
  const firstHalf = all.slice(0, Math.floor(all.length / 2));
  for (const op of firstHalf) {
    if (op.kind === "unlock") half.u.push(op.id);
    else if (op.kind === "reveal") half.r.push(op.id);
    else half.s[op.id] = op.n;
  }
  const reloaded = sanitizeLedger(JSON.parse(JSON.stringify(half)));
  const rest = pendingOps(record, reloaded);
  const key = (o) => `${o.kind}:${o.id}:${o.n ?? ""}`;
  assert.deepEqual(rest.map(key), all.slice(firstHalf.length).map(key));
});

// ---------------------------------------------------------------------
// Source pins
// ---------------------------------------------------------------------

const RAW_SRC = fs.readFileSync(SRC_PATH, "utf8").replace(/\r\n/g, "\n");
const CODE_SRC = stripJs(RAW_SRC);
// The Play id prefix, built from two halves so this file never matches itself.
const PLAY_ID_NEEDLE = "Cgk" + "I";

test("source pin: no whole-word counting call (the catalog word 'incremental' stays allowed)", () => {
  assert.doesNotMatch(CODE_SRC, /\bincrement(Immediate)?\b/);
  assert.match(CODE_SRC, /"incremental"/);
});

test("source pin: no Play id, no listener registration, no network or DOM or localStorage", () => {
  assert.equal(RAW_SRC.includes(PLAY_ID_NEEDLE), false);
  assert.doesNotMatch(CODE_SRC, /setAchievementListener/);
  assert.doesNotMatch(CODE_SRC, /\bfetch\s*\(/);
  assert.doesNotMatch(CODE_SRC, /\bwindow\b/);
  assert.doesNotMatch(CODE_SRC, /\bdocument\b/);
  assert.doesNotMatch(CODE_SRC, /\blocalStorage\b/);
});

test("source pin: the import specifiers are exactly the three allowed modules", () => {
  const specs = [...CODE_SRC.matchAll(/^\s*import\s[^;]*?from\s*["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(specs.sort(), ["../../content/achievements.js", "./achievementTracker.js", "./runQueue.js"].sort());
  assert.doesNotMatch(CODE_SRC, /\bimport\s*\(/);
});

function walk(dir, exts, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, exts, out);
    else if (exts.some((x) => ent.name.endsWith(x))) out.push(full);
  }
  return out;
}

test("source pin: no Play id prefix anywhere in src, content or mazeworld.html", () => {
  const files = [
    ...walk(path.join(REPO_ROOT, "src"), [".js"]),
    ...walk(path.join(REPO_ROOT, "content"), [".js"]),
    path.join(REPO_ROOT, "mazeworld.html"),
  ];
  assert.ok(files.length > 20);
  const hits = files.filter((f) => fs.readFileSync(f, "utf8").includes(PLAY_ID_NEEDLE));
  assert.deepEqual(hits.map((f) => path.relative(REPO_ROOT, f)), []);
});
