// test/unit/boards-admin.test.js
//
// Phase 83 (SRV-07), Plan 05 Task 1. Drives tools/boards-admin.mjs's
// runCommand against src/browser/fakeBoardServer.js's createFakeBoardFetch
// (the admin token), covering parseArgs, both auth paths, the in-repo key
// refusal, top, suspicious (all four reasons and threshold overrides),
// delete-run with and without --yes, ban then refused create, unban, and
// export in CSV and JSON with every filter.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import url from "node:url";

import { SEASON } from "../../content/season.js";
import { FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";
import { FIRESTORE_BASE, IDENTITY_BASE, documentsPath } from "../../src/browser/firestoreRest.js";
import { rollHandle } from "../../src/browser/handles.js";
import { RUN_CLIENT_FIELDS, RUN_DOC_FIELDS, rankKeys, deepKeyOf, legacyDeepKeyOf, runDocId, createRunCommit } from "../../src/browser/runDoc.js";
import { createFakeBoardFetch, FAKE_ADMIN_TOKEN } from "../../src/browser/fakeBoardServer.js";
import {
  parseArgs,
  resolveAdminAuth,
  createAdminApi,
  SUSPICIOUS_DEFAULTS,
  scoreSuspicious,
  isRolledName,
  isBankedEpitaph,
  filterExport,
  toCsv,
  classifyDeepKeys,
  runCommand,
} from "../../tools/boards-admin.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const NOW_MS = Date.parse("2026-09-28T12:00:00.000Z");

// --- helpers ---------------------------------------------------------------

function baseValidPartial(over = {}) {
  return {
    uid: "u1",
    handle: rollHandle(() => 0.15, null),
    season: SEASON,
    name: "Aldric Vane",
    race: "Human",
    sub: "Knight",
    cls: "Fighter",
    level: 1,
    floor: 5,
    day: 3,
    steps: 500,
    kills: 10,
    gold: 100,
    sp: 40,
    cause: "combat",
    note: "cut down by a Rat",
    epitaph: "",
    when: NOW_MS,
    hash: "0a1b2c3d",
    version: "2.2.0 (12)",
    seed: 12345,
    acts: 10,
    ...over,
  };
}

function docFrom(overrides = {}) {
  const merged = baseValidPartial(overrides);
  const keys = rankKeys(merged);
  const doc = {};
  for (const f of RUN_CLIENT_FIELDS) doc[f] = f in keys ? keys[f] : merged[f];
  return doc;
}

function seedRun(id, overrides = {}) {
  const { createdAt, ...rest } = overrides;
  const doc = createdAt !== undefined ? { ...docFrom(rest), createdAt } : docFrom(rest);
  return { id, doc };
}

function noop() {}

function baseOpts(fake, extra = {}) {
  return {
    env: {},
    fetchFn: fake.fetchFn,
    execFn: () => FAKE_ADMIN_TOKEN,
    now: () => NOW_MS,
    out: noop,
    err: noop,
    repoRoot: REPO_ROOT,
    writeFile: noop,
    ...extra,
  };
}

async function signUp(fake) {
  const res = await fake.fetchFn(`${IDENTITY_BASE}/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const json = await res.json();
  return { uid: json.localId, idToken: json.idToken };
}

async function submitRun(fake, uid, idToken, overrides = {}) {
  const doc = docFrom({ uid, ...overrides });
  const id = runDocId(uid, doc.hash);
  const commit = createRunCommit(FIREBASE_CONFIG, id, doc);
  const res = await fake.fetchFn(`${FIRESTORE_BASE}/${documentsPath(FIREBASE_CONFIG)}:commit?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(commit),
  });
  return { ok: res.ok, status: res.status, id };
}

// --- parseArgs ---------------------------------------------------------------

test("parseArgs: command, --name value flags, positionals", () => {
  const result = parseArgs(["top", "--stat", "days", "--race", "Elven", "--limit", "20"]);
  assert.deepEqual(result, { command: "top", flags: { stat: "days", race: "Elven", limit: "20" }, positionals: [] });
});

test("parseArgs: boolean flags (--yes, --all-seasons) parse as true", () => {
  const result = parseArgs(["export", "--all-seasons", "--yes"]);
  assert.equal(result.flags["all-seasons"], true);
  assert.equal(result.flags.yes, true);
});

test("parseArgs: positionals after the command", () => {
  const result = parseArgs(["ban", "uid123", "--yes"]);
  assert.deepEqual(result.positionals, ["uid123"]);
  assert.equal(result.flags.yes, true);
});

// --- resolveAdminAuth ---------------------------------------------------------

test("resolveAdminAuth: gcloud path — trims the token, adds X-Goog-User-Project", async () => {
  const result = await resolveAdminAuth({
    flags: {},
    env: {},
    execFn: () => " sometoken123 \n",
    fetchFn: async () => {},
    now: () => NOW_MS,
    repoRoot: REPO_ROOT,
  });
  assert.equal(result.ok, true);
  assert.equal(result.headers.Authorization, "Bearer sometoken123");
  assert.equal(result.headers["X-Goog-User-Project"], FIREBASE_CONFIG.projectId);
});

test("resolveAdminAuth: execFn throwing (no gcloud login) is an error", async () => {
  const result = await resolveAdminAuth({
    flags: {},
    env: {},
    execFn: () => {
      throw new Error("gcloud: command not found");
    },
    fetchFn: async () => {},
    now: () => NOW_MS,
    repoRoot: REPO_ROOT,
  });
  assert.equal(result.ok, false);
});

test("resolveAdminAuth: a --key path inside the repo is refused and never echoed", async () => {
  const inRepoKey = path.join(REPO_ROOT, "ddr-boards-test-key.json");
  const result = await resolveAdminAuth({
    flags: { key: inRepoKey },
    env: {},
    execFn: () => {
      throw new Error("should not be called");
    },
    fetchFn: async () => {},
    now: () => NOW_MS,
    repoRoot: REPO_ROOT,
    readFile: () => {
      throw new Error("should not be called");
    },
  });
  assert.equal(result.ok, false);
  assert.ok(!result.message.includes("ddr-boards-test-key.json"));
});

test("resolveAdminAuth: DDR_BOARDS_SA_KEY inside the repo is also refused", async () => {
  const result = await resolveAdminAuth({
    flags: {},
    env: { DDR_BOARDS_SA_KEY: path.join(REPO_ROOT, "ddr-boards-test-key.json") },
    execFn: () => {
      throw new Error("should not be called");
    },
    fetchFn: async () => {},
    now: () => NOW_MS,
    repoRoot: REPO_ROOT,
  });
  assert.equal(result.ok, false);
});

test("resolveAdminAuth: a key outside the repo exchanges via getAccessTokenFn (datastore scope), no X-Goog-User-Project", async () => {
  const outsideKey = path.join(os.tmpdir(), "ddr-boards-sa-test.json");
  let sawSa = null;
  const result = await resolveAdminAuth({
    flags: { key: outsideKey },
    env: {},
    execFn: () => {
      throw new Error("should not be called");
    },
    fetchFn: async () => {},
    now: () => NOW_MS,
    repoRoot: REPO_ROOT,
    readFile: () => JSON.stringify({ client_email: "sa@example.com", private_key: "PK", project_id: FIREBASE_CONFIG.projectId }),
    getAccessTokenFn: async ({ sa }) => {
      sawSa = sa;
      return "sa-access-token";
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.headers.Authorization, "Bearer sa-access-token");
  assert.equal(result.headers["X-Goog-User-Project"], undefined);
  assert.equal(sawSa.client_email, "sa@example.com");
});

// --- runCommand: usage/help/unknown --------------------------------------

test("help: exits 0, prints usage, and contacts neither fetch nor exec", async () => {
  const out = [];
  let fetchCalled = false;
  let execCalled = false;
  const code = await runCommand({
    argv: ["help"],
    env: {},
    fetchFn: async () => {
      fetchCalled = true;
    },
    execFn: () => {
      execCalled = true;
      return FAKE_ADMIN_TOKEN;
    },
    now: () => NOW_MS,
    out: (l) => out.push(l),
    err: noop,
    repoRoot: REPO_ROOT,
    writeFile: noop,
  });
  assert.equal(code, 0);
  assert.ok(out.length > 0);
  assert.equal(fetchCalled, false);
  assert.equal(execCalled, false);
});

test("no argv: same as help, exit 0", async () => {
  const out = [];
  const code = await runCommand({ argv: [], env: {}, fetchFn: async () => {}, execFn: () => FAKE_ADMIN_TOKEN, now: () => NOW_MS, out: (l) => out.push(l), err: noop, repoRoot: REPO_ROOT, writeFile: noop });
  assert.equal(code, 0);
  assert.ok(out.length > 0);
});

test("unknown command: usage + exit 2", async () => {
  const errLines = [];
  const code = await runCommand({ argv: ["bogus"], env: {}, fetchFn: async () => {}, execFn: () => FAKE_ADMIN_TOKEN, now: () => NOW_MS, out: noop, err: (l) => errLines.push(l), repoRoot: REPO_ROOT, writeFile: noop });
  assert.equal(code, 2);
  assert.ok(errLines.length > 0);
});

test("delete-run without a positional id: usage + exit 2", async () => {
  const code = await runCommand({ argv: ["delete-run"], env: {}, fetchFn: async () => {}, execFn: () => FAKE_ADMIN_TOKEN, now: () => NOW_MS, out: noop, err: noop, repoRoot: REPO_ROOT, writeFile: noop });
  assert.equal(code, 2);
});

test("ban/unban without a positional uid: usage + exit 2", async () => {
  const codeBan = await runCommand({ argv: ["ban"], env: {}, fetchFn: async () => {}, execFn: () => FAKE_ADMIN_TOKEN, now: () => NOW_MS, out: noop, err: noop, repoRoot: REPO_ROOT, writeFile: noop });
  const codeUnban = await runCommand({ argv: ["unban"], env: {}, fetchFn: async () => {}, execFn: () => FAKE_ADMIN_TOKEN, now: () => NOW_MS, out: noop, err: noop, repoRoot: REPO_ROOT, writeFile: noop });
  assert.equal(codeBan, 2);
  assert.equal(codeUnban, 2);
});

test("top without --stat: usage + exit 2, no network", async () => {
  let fetchCalled = false;
  const code = await runCommand({
    argv: ["top"],
    env: {},
    fetchFn: async () => {
      fetchCalled = true;
    },
    execFn: () => FAKE_ADMIN_TOKEN,
    now: () => NOW_MS,
    out: noop,
    err: noop,
    repoRoot: REPO_ROOT,
    writeFile: noop,
  });
  assert.equal(code, 2);
  assert.equal(fetchCalled, false);
});

test("runCommand: a --key path inside the repo is refused with exit 2", async () => {
  const errLines = [];
  const code = await runCommand({
    argv: ["top", "--stat", "deep", "--key", path.join(REPO_ROOT, "ddr-boards-test-key.json")],
    env: {},
    fetchFn: async () => {},
    execFn: () => {
      throw new Error("unused");
    },
    now: () => NOW_MS,
    out: noop,
    err: (l) => errLines.push(l),
    repoRoot: REPO_ROOT,
    writeFile: noop,
    readFile: () => {
      throw new Error("unused");
    },
  });
  assert.equal(code, 2);
  assert.ok(errLines.length > 0);
});

// --- top ---------------------------------------------------------------------

test("top: --stat kills --limit 3 prints rows in killsKey order", async () => {
  const seeds = [0, 1, 2, 3, 4].map((i) =>
    seedRun(`run${i}`, { uid: `u${i}`, kills: i * 3, floor: 5, steps: 200, name: "Aldric Vane", race: "Human" }),
  );
  const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });
  const out = [];
  const code = await runCommand({ argv: ["top", "--stat", "kills", "--limit", "3"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.equal(out.length, 3);
  assert.ok(out[0].includes("run4"));
  assert.ok(out[1].includes("run3"));
  assert.ok(out[2].includes("run2"));
});

test("top: --limit above 50 is clamped to 50", async () => {
  const seeds = [];
  for (let i = 0; i < 60; i++) {
    seeds.push(seedRun(`r${i}`, { uid: `u${i}`, kills: i, floor: 5, steps: 200, name: "Aldric Vane", race: "Human" }));
  }
  const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });
  const out = [];
  const code = await runCommand({ argv: ["top", "--stat", "kills", "--limit", "999"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.equal(out.length, 50);
});

test("top: --race filters equality", async () => {
  const seeds = [
    seedRun("h1", { uid: "h1", race: "Human", kills: 5, name: "Aldric Vane" }),
    seedRun("e1", { uid: "e1", race: "Elven", kills: 50, name: "Faelin Shear" }),
  ];
  const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });
  const out = [];
  const code = await runCommand({ argv: ["top", "--stat", "kills", "--race", "Elven"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes("e1"));
});

// --- suspicious ----------------------------------------------------------------

test("scoreSuspicious: constants and each reason in isolation", () => {
  assert.deepEqual(SUSPICIOUS_DEFAULTS, { daysPerFloor: 20, killsPerStep: 0.2 });
  assert.deepEqual(scoreSuspicious({ floor: 1, day: 25, steps: 1000, kills: 10, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "" }), ["days-per-floor"]);
  assert.deepEqual(scoreSuspicious({ floor: 5, day: 10, steps: 10, kills: 5, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "" }), ["kills-per-step"]);
  assert.deepEqual(scoreSuspicious({ floor: 5, day: 10, steps: 500, kills: 50, name: "Nobody Real", race: "Human", cause: "combat", epitaph: "" }), ["name-not-rolled"]);
  assert.deepEqual(
    scoreSuspicious({ floor: 5, day: 10, steps: 500, kills: 50, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "not a template at all" }),
    ["epitaph-not-banked"],
  );
});

test("isRolledName: a real first+sur combo and an empty-sur mononym are true; made-up names are false", () => {
  assert.equal(isRolledName("Aldric Vane", "Human"), true);
  assert.equal(isRolledName("Skalgrim", "Fridgian"), true);
  assert.equal(isRolledName("Aldric Nonexistent", "Human"), false);
  assert.equal(isRolledName("Nobody", "NotARace"), false);
});

test("isBankedEpitaph: a filled combat template is true; made-up text and an empty epitaph are false", () => {
  assert.equal(isBankedEpitaph("Killed by a Rat. The Rat has since been promoted.", "combat"), true);
  assert.equal(isBankedEpitaph("Totally not a template.", "combat"), false);
  assert.equal(isBankedEpitaph("", "combat"), false);
});

test("suspicious: flags all four reasons, most-reasons-first, excludes a clean run", async () => {
  const seeds = [
    seedRun("clean", { uid: "c", floor: 5, day: 10, steps: 500, kills: 50, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "" }),
    seedRun("days", { uid: "d", floor: 1, day: 25, steps: 1000, kills: 50, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "" }),
    seedRun("kills", { uid: "k", floor: 5, day: 10, steps: 10, kills: 5, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "" }),
    seedRun("name", { uid: "n", floor: 5, day: 10, steps: 500, kills: 50, name: "Xzqq Nonexistent", race: "Human", cause: "combat", epitaph: "" }),
    seedRun("epi", { uid: "e", floor: 5, day: 10, steps: 500, kills: 50, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "Not a banked line at all." }),
    seedRun("all4", { uid: "a", floor: 1, day: 999, steps: 5, kills: 5, name: "Bogus Name", race: "Human", cause: "combat", epitaph: "totally not banked" }),
  ];
  const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });
  const out = [];
  const code = await runCommand({ argv: ["suspicious"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.equal(out.length, 5);
  assert.ok(out[0].startsWith("all4"));
  assert.ok(!out.some((l) => l.startsWith("clean")));
});

test("suspicious: --days-per-floor / --kills-per-step override the thresholds", async () => {
  const seeds = [
    seedRun("clean", { uid: "c", floor: 5, day: 10, steps: 500, kills: 50, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "" }),
    seedRun("days", { uid: "d", floor: 1, day: 25, steps: 1000, kills: 50, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "" }),
    seedRun("kills", { uid: "k", floor: 5, day: 10, steps: 10, kills: 5, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "" }),
    seedRun("name", { uid: "n", floor: 5, day: 10, steps: 500, kills: 50, name: "Xzqq Nonexistent", race: "Human", cause: "combat", epitaph: "" }),
    seedRun("epi", { uid: "e", floor: 5, day: 10, steps: 500, kills: 50, name: "Aldric Vane", race: "Human", cause: "combat", epitaph: "Not a banked line at all." }),
    seedRun("all4", { uid: "a", floor: 1, day: 999, steps: 5, kills: 5, name: "Bogus Name", race: "Human", cause: "combat", epitaph: "totally not banked" }),
  ];
  const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });
  const out = [];
  const code = await runCommand({
    argv: ["suspicious", "--days-per-floor", "1000", "--kills-per-step", "1000"],
    ...baseOpts(fake, { out: (l) => out.push(l) }),
  });
  assert.equal(code, 0);
  const ids = new Set(out.map((l) => l.split(/\s+/)[0]));
  assert.deepEqual(ids, new Set(["name", "epi", "all4"]));
});

// --- delete-run ------------------------------------------------------------

test("delete-run: without --yes prints and changes nothing; with --yes deletes", async () => {
  const id = runDocId("uid1", "aaaaaaaa");
  const fake = createFakeBoardFetch({ runs: [seedRun(id, { uid: "uid1", hash: "aaaaaaaa" })], now: () => NOW_MS });

  const out1 = [];
  const code1 = await runCommand({ argv: ["delete-run", id], ...baseOpts(fake, { out: (l) => out1.push(l) }) });
  assert.equal(code1, 0);
  assert.equal(fake.docs().length, 1);
  assert.ok(out1.some((l) => l.includes(id)));

  const out2 = [];
  const code2 = await runCommand({ argv: ["delete-run", id, "--yes"], ...baseOpts(fake, { out: (l) => out2.push(l) }) });
  assert.equal(code2, 0);
  assert.equal(fake.docs().length, 0);
});

test("delete-run: an id that does not exist prints a not-found line and exits 0", async () => {
  const fake = createFakeBoardFetch({ now: () => NOW_MS });
  const out = [];
  const code = await runCommand({ argv: ["delete-run", "nope_00000000", "--yes"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.ok(out.some((l) => l.includes("not found")));
});

// --- ban / unban -----------------------------------------------------------

test("ban --yes writes banned/<uid>, deletes every run of that uid, refuses a further create; unban restores", async () => {
  const fake = createFakeBoardFetch({ transition: true, now: () => NOW_MS });
  const { uid, idToken } = await signUp(fake);

  const first = await submitRun(fake, uid, idToken, { hash: "0a1b2c3d" });
  assert.equal(first.ok, true);
  assert.equal(fake.docs().length, 1);

  const codeBan = await runCommand({ argv: ["ban", uid, "--yes"], ...baseOpts(fake) });
  assert.equal(codeBan, 0);
  assert.equal(fake.docs().length, 0);
  assert.ok(fake.banned().includes(uid));

  const second = await submitRun(fake, uid, idToken, { hash: "0a1b2c3e" });
  assert.equal(second.ok, false);
  assert.equal(second.status, 403);

  const codeUnban = await runCommand({ argv: ["unban", uid, "--yes"], ...baseOpts(fake) });
  assert.equal(codeUnban, 0);
  assert.ok(!fake.banned().includes(uid));

  const third = await submitRun(fake, uid, idToken, { hash: "0a1b2c3f" });
  assert.equal(third.ok, true);
});

test("ban/unban without --yes: dry run changes nothing", async () => {
  const fake = createFakeBoardFetch({ now: () => NOW_MS });
  const { uid } = await signUp(fake);
  const codeBan = await runCommand({ argv: ["ban", uid], ...baseOpts(fake) });
  assert.equal(codeBan, 0);
  assert.equal(fake.banned().includes(uid), false);
});

// --- rekey-deep (Phase 87, BOARD-28) -----------------------------------------

function keyedSeed(id, kind, overrides = {}) {
  const s = seedRun(id, { uid: `u_${id}`, hash: id.padStart(8, "0").slice(-8), ...overrides });
  if (kind === "legacy") s.doc.deepKey = legacyDeepKeyOf(s.doc);
  else if (kind === "other") s.doc.deepKey = deepKeyOf(s.doc) + 7;
  else s.doc.deepKey = deepKeyOf(s.doc);
  return s;
}

function rekeySeeds() {
  return [
    keyedSeed("l1", "legacy", { floor: 6, steps: 100 }),
    keyedSeed("l2", "legacy", { floor: 6, steps: 50 }),
    keyedSeed("l3", "legacy", { floor: 3, steps: 999999 }),
    keyedSeed("c1", "current", { floor: 4, steps: 10 }),
    keyedSeed("c2", "current", { floor: 9, steps: 20 }),
    keyedSeed("o1", "other", { floor: 5, steps: 30 }),
  ];
}

test("classifyDeepKeys: current, legacy (with from/to), other; pure", () => {
  const rows = rekeySeeds().map((s) => ({ id: s.id, doc: s.doc }));
  const frozen = JSON.stringify(rows);
  const result = classifyDeepKeys(rows);
  assert.equal(result.current, 2);
  assert.deepEqual(result.other, ["o1"]);
  assert.deepEqual(
    result.legacy.map((r) => r.id),
    ["l1", "l2", "l3"],
  );
  for (const r of result.legacy) {
    const doc = rows.find((x) => x.id === r.id).doc;
    assert.equal(r.from, legacyDeepKeyOf(doc));
    assert.equal(r.to, deepKeyOf(doc));
    assert.notEqual(r.from, r.to);
  }
  assert.equal(JSON.stringify(rows), frozen);
});

test("classifyDeepKeys: a missing or non-integer floor, steps or deepKey lands in other", () => {
  const good = keyedSeed("g1", "legacy").doc;
  const rows = [
    { id: "a", doc: { ...good, floor: undefined } },
    { id: "b", doc: { ...good, steps: "12" } },
    { id: "c", doc: { ...good, deepKey: undefined } },
    { id: "d", doc: { ...good, deepKey: 1.5 } },
    { id: "e", doc: null },
    { id: "f", doc: { ...good, floor: 2.5 } },
  ];
  const result = classifyDeepKeys(rows);
  assert.deepEqual(result.other, ["a", "b", "c", "d", "e", "f"]);
  assert.equal(result.current, 0);
  assert.equal(result.legacy.length, 0);
  assert.deepEqual(classifyDeepKeys(undefined), { legacy: [], current: 0, other: [] });
});

test("rekey-deep: without --yes prints the counts and the left-alone id and changes nothing", async () => {
  const fake = createFakeBoardFetch({ runs: rekeySeeds(), now: () => NOW_MS });
  const before = JSON.stringify(fake.docs());
  const out = [];
  const code = await runCommand({ argv: ["rekey-deep"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  const text = out.join("\n");
  assert.match(text, /Scanned 6 run\(s\): 2 already on the new DEPTH key, 3 on the old key, 1 left alone/);
  assert.match(text, /o1/);
  assert.match(text, /Would re-key 3 run\(s\).*Pass --yes/);
  assert.equal(JSON.stringify(fake.docs()), before);
  assert.ok(!fake.calls().some((c) => c.method === "PATCH"));
});

test("rekey-deep --yes: re-keys exactly the old-formula docs, touches no other field or doc, creates and deletes nothing", async () => {
  const fake = createFakeBoardFetch({ runs: rekeySeeds(), now: () => NOW_MS });
  const before = fake.docs();
  const out = [];
  const code = await runCommand({ argv: ["rekey-deep", "--yes"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.match(out.join("\n"), /Re-keyed 3 of 3\./);
  const after = fake.docs();
  assert.equal(after.length, before.length);
  for (const b of before) {
    const a = after.find((d) => d.id === b.id);
    assert.ok(a, `${b.id} still exists`);
    if (["l1", "l2", "l3"].includes(b.id)) {
      assert.equal(a.deepKey, deepKeyOf(a));
      const { deepKey: _x, ...aRest } = a;
      const { deepKey: _y, ...bRest } = b;
      assert.deepEqual(aRest, bRest);
    } else {
      assert.deepEqual(a, b);
    }
  }
  // Only single-field PATCHes for the three legacy docs, no other writes.
  const writes = fake.calls().filter((c) => c.method !== "POST" && c.method !== "GET");
  assert.equal(writes.length, 3);
  assert.ok(writes.every((c) => c.method === "PATCH" && c.url.includes("updateMask.fieldPaths=deepKey") && c.url.includes("currentDocument.exists=true")));
});

test("rekey-deep --yes is idempotent: a second run re-keys 0 and changes nothing", async () => {
  const fake = createFakeBoardFetch({ runs: rekeySeeds(), now: () => NOW_MS });
  assert.equal(await runCommand({ argv: ["rekey-deep", "--yes"], ...baseOpts(fake) }), 0);
  const settled = JSON.stringify(fake.docs());
  const patchesBefore = fake.calls().filter((c) => c.method === "PATCH").length;
  const out = [];
  const code = await runCommand({ argv: ["rekey-deep", "--yes"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.match(out.join("\n"), /Scanned 6 run\(s\): 5 already on the new DEPTH key, 0 on the old key, 1 left alone/);
  assert.match(out.join("\n"), /Re-keyed 0 of 0\./);
  assert.equal(JSON.stringify(fake.docs()), settled);
  assert.equal(fake.calls().filter((c) => c.method === "PATCH").length, patchesBefore);
});

test("rekey-deep: default scope is the current SEASON; --season N and --all-seasons scope like export", async () => {
  const seeds = [
    keyedSeed("s1", "legacy", { season: SEASON }),
    keyedSeed("s2", "legacy", { season: SEASON + 1 }),
    keyedSeed("s3", "legacy", { season: SEASON + 1 }),
  ];
  const scanned = async (argv) => {
    const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });
    const out = [];
    await runCommand({ argv, ...baseOpts(fake, { out: (l) => out.push(l) }) });
    return out.join("\n");
  };
  assert.match(await scanned(["rekey-deep"]), /Scanned 1 run\(s\)/);
  assert.match(await scanned(["rekey-deep", "--season", String(SEASON + 1)]), /Scanned 2 run\(s\)/);
  assert.match(await scanned(["rekey-deep", "--all-seasons"]), /Scanned 3 run\(s\)/);
});

test("rekey-deep --yes: a failed patch exits 1 and the report names the failed id; the others are still re-keyed", async () => {
  const fake = createFakeBoardFetch({ runs: rekeySeeds(), now: () => NOW_MS });
  const failingFetch = (u, init) => {
    if (init && init.method === "PATCH" && String(u).includes("/runs/l2?")) {
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => "{}" });
    }
    return fake.fetchFn(u, init);
  };
  const out = [];
  const errs = [];
  const code = await runCommand({
    argv: ["rekey-deep", "--yes"],
    ...baseOpts(fake, { fetchFn: failingFetch, out: (l) => out.push(l), err: (l) => errs.push(l) }),
  });
  assert.equal(code, 1);
  assert.match(out.join("\n"), /Re-keyed 2 of 3\./);
  assert.ok(errs.some((l) => l.includes("l2")));
  const docs = fake.docs();
  assert.equal(docs.find((d) => d.id === "l1").deepKey, deepKeyOf(docs.find((d) => d.id === "l1")));
  assert.equal(docs.find((d) => d.id === "l2").deepKey, legacyDeepKeyOf(docs.find((d) => d.id === "l2")));
});

test("rekey-deep: help lists the usage line", async () => {
  const fake = createFakeBoardFetch({ now: () => NOW_MS });
  const out = [];
  const code = await runCommand({ argv: ["help"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.ok(out.some((l) => l.includes("rekey-deep")));
});

// --- export ------------------------------------------------------------------

test("export: csv prints a header of id + RUN_DOC_FIELDS, one escaped row per run", async () => {
  const seeds = [
    seedRun("r1", { uid: "u1", version: "2.2.0 (10)", name: "Aldric Vane" }),
    seedRun("r2", { uid: "u2", version: "2.2.0 (11)", name: "Ivy Coll", epitaph: 'Said "hi", left' }),
  ];
  const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });
  const out = [];
  const code = await runCommand({ argv: ["export", "--format", "csv"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.equal(out.length, 1);
  const lines = out[0].split("\n");
  assert.equal(lines[0], ["id", ...RUN_DOC_FIELDS].join(","));
  assert.equal(lines.length, 3);
  assert.ok(out[0].includes('"Said ""hi"", left"'));
});

test("export: json filters by version, season (default vs --all-seasons), and since/until", async () => {
  const seeds = [
    seedRun("r1", { uid: "u1", version: "v1", season: SEASON, createdAt: "2026-01-05T00:00:00.000Z" }),
    seedRun("r2", { uid: "u2", version: "v2", season: SEASON, createdAt: "2026-01-15T00:00:00.000Z" }),
    seedRun("r3", { uid: "u3", version: "v1", season: SEASON + 1, createdAt: "2026-01-05T00:00:00.000Z" }),
  ];
  const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });

  let out = [];
  let code = await runCommand({ argv: ["export", "--format", "json"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  let rows = JSON.parse(out[0]);
  assert.deepEqual(rows.map((r) => r.id).sort(), ["r1", "r2"]);

  out = [];
  code = await runCommand({ argv: ["export", "--format", "json", "--all-seasons"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  rows = JSON.parse(out[0]);
  assert.deepEqual(rows.map((r) => r.id).sort(), ["r1", "r2", "r3"]);

  out = [];
  code = await runCommand({ argv: ["export", "--format", "json", "--all-seasons", "--version", "v1"], ...baseOpts(fake, { out: (l) => out.push(l) }) });
  rows = JSON.parse(out[0]);
  assert.deepEqual(rows.map((r) => r.id).sort(), ["r1", "r3"]);

  out = [];
  code = await runCommand({
    argv: ["export", "--format", "json", "--since", "2026-01-10", "--until", "2026-01-20"],
    ...baseOpts(fake, { out: (l) => out.push(l) }),
  });
  rows = JSON.parse(out[0]);
  assert.deepEqual(rows.map((r) => r.id), ["r2"]);
});

test("export: --out writes via writeFile; an in-repo path must be named boards-export*", async () => {
  const seeds = [seedRun("r1", { uid: "u1" })];
  const fake = createFakeBoardFetch({ runs: seeds, now: () => NOW_MS });
  const written = [];
  const writeFile = (p, content) => written.push({ p, content });

  const outsidePath = path.join(os.tmpdir(), "any-export-name.csv");
  let code = await runCommand({ argv: ["export", "--out", outsidePath], ...baseOpts(fake, { writeFile }) });
  assert.equal(code, 0);
  assert.equal(written.length, 1);
  assert.equal(written[0].p, outsidePath);

  written.length = 0;
  const badInRepo = path.join(REPO_ROOT, "some-export.csv");
  const errLines = [];
  code = await runCommand({ argv: ["export", "--out", badInRepo], ...baseOpts(fake, { writeFile, err: (l) => errLines.push(l) }) });
  assert.equal(code, 2);
  assert.equal(written.length, 0);
  assert.ok(errLines.length > 0);

  const goodInRepo = path.join(REPO_ROOT, "boards-export-test.csv");
  code = await runCommand({ argv: ["export", "--out", goodInRepo], ...baseOpts(fake, { writeFile }) });
  assert.equal(code, 0);
  assert.equal(written.length, 1);
});

// --- filterExport / toCsv (direct) ------------------------------------------

test("filterExport: version equality and inclusive since/until UTC days", () => {
  const rows = [
    { id: "a", version: "v1", createdAt: "2026-01-10T00:00:00.000Z" },
    { id: "b", version: "v2", createdAt: "2026-01-10T23:59:59.000Z" },
    { id: "c", version: "v1", createdAt: "2026-01-11T00:00:00.000Z" },
  ];
  assert.deepEqual(filterExport(rows, { version: "v1" }).map((r) => r.id), ["a", "c"]);
  assert.deepEqual(filterExport(rows, { since: "2026-01-10", until: "2026-01-10" }).map((r) => r.id), ["a", "b"]);
});

test("toCsv: header then RFC 4180-escaped rows", () => {
  const rows = [{ id: "r1", ...docFrom({ uid: "u1", epitaph: 'Said "hi", left' }), createdAt: "2026-01-01T00:00:00.000Z" }];
  const csv = toCsv(rows);
  assert.ok(csv.startsWith(["id", ...RUN_DOC_FIELDS].join(",") + "\n"));
  assert.ok(csv.includes('"Said ""hi"", left"'));
});

// --- createAdminApi (direct) --------------------------------------------------

test("createAdminApi: query/getRun/deleteRun/runsOf/deleteRunsOf/setBan/clearBan round-trip", async () => {
  const fake = createFakeBoardFetch({ transition: true, now: () => NOW_MS });
  const api = createAdminApi({ projectId: FIREBASE_CONFIG.projectId, fetchFn: fake.fetchFn, headers: { Authorization: `Bearer ${FAKE_ADMIN_TOKEN}` } });

  const { uid, idToken } = await signUp(fake);
  await submitRun(fake, uid, idToken, { hash: "aaaaaaaa" });
  await submitRun(fake, uid, idToken, { hash: "bbbbbbbb" });

  const runs = await api.runsOf(uid);
  assert.equal(runs.length, 2);

  const one = await api.getRun(runs[0].id);
  assert.equal(one.id, runs[0].id);

  await api.setBan(uid, { reason: "test", at: new Date(NOW_MS).toISOString() });
  assert.ok(fake.banned().includes(uid));

  const deleted = await api.deleteRunsOf(uid);
  assert.equal(deleted, 2);
  assert.equal(fake.docs().length, 0);

  await api.clearBan(uid);
  assert.ok(!fake.banned().includes(uid));
});

// --- module import runs nothing ----------------------------------------------

test("importing the module runs no side effects (main is guarded)", () => {
  assert.equal(typeof runCommand, "function");
  assert.equal(typeof parseArgs, "function");
});

// --- Phase 91.2-02: names, name-override, name-clear --------------------------
//
// The fake board server learns the names collection in 91.2-03, so these drive
// runCommand against the in-memory upstream stub the boardName core tests use.
// Flagged names are built at runtime from the safety list: no banned word is
// spelled out here.

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { createUpstreamStub, field } from "./harness/boardNameStub.js";

const FLAG_TERM = BANNED.find((t) => /^[a-z]{5,}$/.test(t) && !ALLOWLIST.includes(t));
const FLAGGED_NAME = `Xx${FLAG_TERM.charAt(0).toUpperCase()}${FLAG_TERM.slice(1)}Xx`;

function nameOpts(stub, extra = {}) {
  return { env: {}, fetchFn: stub.fetchFn, execFn: () => "admin-token", now: () => NOW_MS, out: noop, err: noop, repoRoot: REPO_ROOT, writeFile: noop, ...extra };
}

function namesStub() {
  const stub = createUpstreamStub({ projectId: FIREBASE_CONFIG.projectId });
  stub.seedDoc("names/uA", { name: "Moss Knuckle", updatedAt: "2026-10-01T00:00:00Z" });
  stub.seedDoc("names/uB", { name: FLAGGED_NAME, updatedAt: "2026-10-01T00:00:00Z" });
  stub.seedDoc("names/uC", { name: "Grim Spoon", updatedAt: "2026-10-01T00:00:00Z" });
  stub.seedDoc("nameOverrides/uC", { name: "Spoonfed", at: "2026-10-02T00:00:00Z" });
  return stub;
}

test("names: lists uid, name and a flagged column for every names doc, with the override shown", async () => {
  const stub = namesStub();
  const out = [];
  const code = await runCommand({ argv: ["names"], ...nameOpts(stub, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  const text = out.join("\n");
  assert.match(out[0], /uid\s+name\s+flagged/i);
  const rowA = out.find((l) => l.includes("uA"));
  const rowB = out.find((l) => l.includes("uB"));
  const rowC = out.find((l) => l.includes("uC"));
  assert.match(rowA, /Moss Knuckle/);
  assert.match(rowA, /\bno\b/i);
  assert.match(rowB, /\bFLAGGED\b/);
  assert.match(rowC, /Grim Spoon/);
  assert.match(rowC, /Spoonfed/);
  assert.equal(text.includes("admin-token"), false);
  assert.equal(stub.writes.length, 0, "a listing writes nothing");
});

test("names --flagged shows only flagged names; --json emits JSON", async () => {
  const stub = namesStub();
  const flaggedOut = [];
  await runCommand({ argv: ["names", "--flagged"], ...nameOpts(stub, { out: (l) => flaggedOut.push(l) }) });
  assert.ok(flaggedOut.some((l) => l.includes("uB")));
  assert.equal(flaggedOut.some((l) => l.includes("uA")), false);
  assert.equal(flaggedOut.some((l) => l.includes("uC")), false);

  const jsonOut = [];
  const code = await runCommand({ argv: ["names", "--json"], ...nameOpts(stub, { out: (l) => jsonOut.push(l) }) });
  assert.equal(code, 0);
  const rows = JSON.parse(jsonOut.join("\n"));
  assert.deepEqual(rows.map((r) => r.uid).sort(), ["uA", "uB", "uC"]);
  assert.equal(rows.find((r) => r.uid === "uB").flagged, true);
  assert.equal(rows.find((r) => r.uid === "uA").flagged, false);
  assert.equal(rows.find((r) => r.uid === "uC").override, "Spoonfed");

  const both = [];
  await runCommand({ argv: ["names", "--flagged", "--json"], ...nameOpts(stub, { out: (l) => both.push(l) }) });
  assert.deepEqual(JSON.parse(both.join("\n")).map((r) => r.uid), ["uB"]);
});

test("names pages the collection (more than one page of names)", async () => {
  const stub = createUpstreamStub({ projectId: FIREBASE_CONFIG.projectId });
  for (let i = 0; i < 650; i++) stub.seedDoc(`names/u${String(i).padStart(4, "0")}`, { name: `Player ${i}`, updatedAt: "x" });
  const out = [];
  await runCommand({ argv: ["names", "--json"], ...nameOpts(stub, { out: (l) => out.push(l) }) });
  assert.equal(JSON.parse(out.join("\n")).length, 650);
});

test("name-override without --yes prints the current name, the sanitized override and the run count, and writes nothing", async () => {
  const stub = namesStub();
  stub.seedRun("uA", "aaaa0001", { handle: "Moss Knuckle" });
  stub.seedRun("uA", "aaaa0002", { handle: "@legacy pair" });
  const out = [];
  const code = await runCommand({ argv: ["name-override", "uA", "  The   Overlord "], ...nameOpts(stub, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  const text = out.join("\n");
  assert.match(text, /Moss Knuckle/);
  assert.match(text, /The Overlord/);
  assert.match(text, /2 run\(s\) would change/);
  assert.match(text, /--yes/);
  assert.equal(stub.writes.length, 0);
  assert.equal(stub.getDoc("nameOverrides/uA"), null);
});

test("name-override --yes writes nameOverrides/{uid} and names/{uid}, and stamps the runs through the core", async () => {
  const stub = namesStub();
  stub.seedRun("uA", "aaaa0001", { handle: "Moss Knuckle" });
  stub.seedRun("uA", "aaaa0002", { handle: "@legacy pair" });
  stub.seedRun("uB", "bbbb0001", { handle: "@other pair" });
  const out = [];
  const code = await runCommand({ argv: ["name-override", "uA", "The", "Overlord", "--yes"], ...nameOpts(stub, { out: (l) => out.push(l) }) });
  assert.equal(code, 0);
  assert.equal(field(stub.getDoc("nameOverrides/uA"), "name"), "The Overlord");
  assert.ok(field(stub.getDoc("nameOverrides/uA"), "at"));
  assert.equal(field(stub.getDoc("names/uA"), "name"), "The Overlord");
  assert.ok(field(stub.getDoc("names/uA"), "updatedAt"));
  assert.equal(field(stub.getDoc("runs/uA_aaaa0001"), "handle"), "The Overlord");
  assert.equal(field(stub.getDoc("runs/uA_aaaa0002"), "handle"), "The Overlord");
  assert.equal(field(stub.getDoc("runs/uB_bbbb0001"), "handle"), "@other pair", "another uid is untouched");
  assert.match(out.join("\n"), /2 run/);
});

test("name-override: text that sanitizes to nothing is a usage error, and a missing uid or text is exit 2", async () => {
  const stub = namesStub();
  const err = [];
  assert.equal(await runCommand({ argv: ["name-override", "uA", "​   ", "--yes"], ...nameOpts(stub, { err: (l) => err.push(l) }) }), 2);
  assert.equal(await runCommand({ argv: ["name-override", "uA"], ...nameOpts(stub) }), 2);
  assert.equal(await runCommand({ argv: ["name-override"], ...nameOpts(stub) }), 2);
  assert.equal(stub.writes.length, 0);
});

test("name-clear without --yes writes nothing; with --yes deletes nameOverrides/{uid} only", async () => {
  const stub = namesStub();
  const dry = [];
  assert.equal(await runCommand({ argv: ["name-clear", "uC"], ...nameOpts(stub, { out: (l) => dry.push(l) }) }), 0);
  assert.ok(stub.getDoc("nameOverrides/uC"));
  assert.match(dry.join("\n"), /--yes/);
  assert.equal(stub.writes.length, 0);

  assert.equal(await runCommand({ argv: ["name-clear", "uC", "--yes"], ...nameOpts(stub) }), 0);
  assert.equal(stub.getDoc("nameOverrides/uC"), null);
  assert.ok(stub.getDoc("names/uC"), "the next claim restores the Play Games name; names/{uid} is not touched");
  assert.equal(await runCommand({ argv: ["name-clear"], ...nameOpts(stub) }), 2);
});

test("usage lists names, name-override and name-clear, and says delete-run is the way to hide a run", async () => {
  const stub = namesStub();
  const out = [];
  assert.equal(await runCommand({ argv: ["help"], ...nameOpts(stub, { out: (l) => out.push(l) }) }), 0);
  const text = out.join("\n");
  assert.match(text, /names \[--flagged\]/);
  assert.match(text, /name-override <uid>/);
  assert.match(text, /name-clear <uid>/);
  assert.match(text, /delete-run[^\n]*hide|hide[^\n]*delete-run/i);
});
