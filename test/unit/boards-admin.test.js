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
import { RUN_CLIENT_FIELDS, RUN_DOC_FIELDS, rankKeys, runDocId, createRunCommit } from "../../src/browser/runDoc.js";
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
    epitaph: "",
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
  const fake = createFakeBoardFetch({ now: () => NOW_MS });
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
  const fake = createFakeBoardFetch({ now: () => NOW_MS });
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
