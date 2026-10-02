// test/unit/boards-smoke.test.js
//
// Phase 83 Plan 07, rebuilt by Phase 91.2 Plan 04 (BOARD-31, BOARD-33, D-11,
// D-13) around the names gate. Covers tools/boards-smoke.mjs against
// src/browser/fakeBoardServer.js: the default probe (final rules: an admin
// seeds the probe name, every create is bound to it, no client update, names
// closed), the --function probe (the boardName refusal path), the failure path
// with complete cleanup, and the CLI (the --transition probe was deleted at the
// 2.3 cutover). No live network call here: the CLI is only ever spawned with
// --dry-run or an unrecognized flag, and main() is driven in-process with an
// injected fake fetch, config and gcloud stand-in — a bare invocation would use
// the REAL FIREBASE_CONFIG and a real gcloud login and must never run in a
// test (the live run is the maintainer's, on his go).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";

import { SEASON } from "../../content/season.js";
import { runHash } from "../../engine/records.js";
import { buildRunDoc } from "../../src/browser/runDoc.js";
import { BOARD_NAME_FN } from "../../src/browser/firebaseConfig.js";
import { createFakeBoardFetch, FAKE_ADMIN_TOKEN } from "../../src/browser/fakeBoardServer.js";
import { resolveAdminAuth, createAdminApi } from "../../tools/boards-admin.mjs";
import {
  smokeSummaries,
  runSmoke,
  runFunctionProbe,
  main,
} from "../../tools/boards-smoke.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TOOL_PATH = path.join(REPO_ROOT, "tools", "boards-smoke.mjs");
const TOOL_SRC = fs.readFileSync(TOOL_PATH, "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({ projectId: "delve-die-repeat-6ba5f", apiKey: `AIza${"A".repeat(35)}` });

/* ---------------- helpers ---------------- */

function clockBox(start = 1000000) {
  let t = start;
  const now = () => t;
  now.advance = (d) => {
    t += d;
  };
  return now;
}

function runTool(args) {
  return spawnSync(process.execPath, [TOOL_PATH, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
}

const SMOKE_STEP_ORDER = [
  "signup", "deny-unnamed-create", "seed-name", "create-a", "create-b", "resubmit-a",
  "top-ten", "totals", "ranks",
  "deny-bad-key", "deny-other-id", "deny-no-auth", "deny-wrong-name", "deny-update",
  "deny-names-read", "deny-names-write", "deny-list-51",
  "ban", "admin-delete",
  "erase", "account-deleted",
];

const FUNCTION_STEP_ORDER = ["signup", "claim-unlinked", "release", "account-deleted"];

async function makeAdmin(fake) {
  const auth = await resolveAdminAuth({ env: {}, execFn: () => FAKE_ADMIN_TOKEN });
  assert.equal(auth.ok, true);
  const api = createAdminApi({ projectId: VALID_CONFIG.projectId, fetchFn: fake.fetchFn, headers: auth.headers });
  return { api };
}

function assertBoardLeftAsFound(fake) {
  assert.deepEqual(fake.docs(), []);
  assert.deepEqual(fake.banned(), []);
  assert.deepEqual(fake.users(), []);
  assert.deepEqual(fake.names(), []);
  assert.deepEqual(fake.overrides(), []);
}

/* ---------------- smokeSummaries ---------------- */

test("smokeSummaries: three frozen RunSummaries, each with a valid hash, each passing buildRunDoc", () => {
  const clock = clockBox(5000000);
  const { a, b, c } = smokeSummaries(clock);

  for (const s of [a, b, c]) {
    assert.equal(Object.isFrozen(s), true);
    assert.equal(s.race, "Troll");
    assert.equal(s.cls, "Magic User");
    assert.equal(s.sub, "Court Mage");
    assert.equal(s.name, "Smoke Probe");
    assert.equal(s.cause, "combat");
    assert.equal(s.epitaph, "Smoke test run. Safe to delete.");
    assert.equal(s.season, SEASON);
    assert.equal(s.seed, 5000000);
    assert.equal(s.hash, runHash(s));
    assert.equal(typeof s.note, "string");
    assert.ok(s.note.length > 0);
    assert.equal(Number.isInteger(s.when), true);
    assert.equal(s.when, 5000000);
    const built = buildRunDoc(s, { uid: "fakeuid000001", handle: "Smoke Probe", version: s.version });
    assert.equal(built.ok, true, JSON.stringify(built.fails));
  }

  assert.equal(a.floor, 7);
  assert.equal(b.floor, 3);
  assert.equal(c.floor, 2);
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(b.hash, c.hash);
});

test("smokeSummaries: object is frozen and re-calling with the same now() gives the same seed/hash", () => {
  const clock = clockBox(42);
  const first = smokeSummaries(clock);
  const second = smokeSummaries(clock);
  assert.equal(first.a.hash, second.a.hash);
  assert.equal(Object.isFrozen(first), true);
});

/* ---------------- runSmoke: the names-gate pass ---------------- */

test("runSmoke: a full pass against a fresh final-rules fake resolves ok:true in step order, with facts, and leaves nothing behind", async () => {
  const clock = clockBox(2000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const admin = await makeAdmin(fake);
  const logLines = [];
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: (l) => logLines.push(l), admin });

  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.deepEqual(result.steps.map((s) => s.name), SMOKE_STEP_ORDER);
  assert.equal(result.steps.every((s) => s.pass), true);

  assert.equal(result.facts.duplicateStatus, 400);
  assert.equal(result.facts.countUnderListRule, "pass");
  assert.deepEqual(result.facts.missingIndexes, []);
  assert.equal(result.facts.commitShape, "single-write");

  assert.equal(result.cleanup.erased, true);
  assert.equal(result.cleanup.accountDeleted, true);
  assert.equal(result.cleanup.nameRemoved, true);
  assertBoardLeftAsFound(fake);
});

test("runSmoke: existsResponse 'denied' records duplicateStatus 403 and still passes every step", async () => {
  const clock = clockBox(2000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock, existsResponse: "denied" });
  const admin = await makeAdmin(fake);
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: () => {}, admin });
  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.equal(result.facts.duplicateStatus, 403);
  assertBoardLeftAsFound(fake);
});

test("runSmoke: existsResponse 'conflict' records duplicateStatus 409 and still passes every step", async () => {
  const clock = clockBox(2000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock, existsResponse: "conflict" });
  const admin = await makeAdmin(fake);
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: () => {}, admin });
  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.equal(result.facts.duplicateStatus, 409);
});

test("runSmoke: every probe run carries the admin-seeded probe name as its handle, never one read from the identity", async () => {
  const clock = clockBox(2100000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const admin = await makeAdmin(fake);
  const handles = new Set();
  const spy = async (rawUrl, init) => {
    if (typeof rawUrl === "string" && rawUrl.includes(":commit") && init && init.body) {
      for (const w of JSON.parse(init.body).writes || []) {
        const h = w.update && w.update.fields && w.update.fields.handle;
        if (h && h.stringValue !== undefined) handles.add(h.stringValue);
      }
    }
    return fake.fetchFn(rawUrl, init);
  };
  const result = await runSmoke({ fetchFn: spy, config: VALID_CONFIG, now: clock, log: () => {}, admin });
  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.ok(handles.has("Smoke Probe"), "the seeded probe name is the handle");
  assert.ok(handles.has("Smoke Impostor"), "deny-wrong-name posts a different handle");
  for (const h of handles) assert.ok(!h.startsWith("@") || h === "@gravepouch", `unexpected rolled handle ${h}`);
});

test("runSmoke: without an admin it refuses to run, touches no network, and says why", async () => {
  const clock = clockBox(2200000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: () => {} });
  assert.equal(result.ok, false);
  assert.deepEqual(result.steps, []);
  assert.equal(result.error, "admin-required");
  assert.deepEqual(fake.calls(), []);
});

/* ---------------- runSmoke: failure paths + cleanup ---------------- */

test("runSmoke: a Firestore 503 after sign-up fails at deny-unnamed-create, names the step, and cleanup still runs", async () => {
  const clock = clockBox(4000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const admin = await makeAdmin(fake);
  const flaky = async (rawUrl, init) => {
    if (typeof rawUrl === "string" && rawUrl.startsWith("https://firestore.googleapis.com/") && !(init && JSON.stringify(init.headers || {}).includes(FAKE_ADMIN_TOKEN))) {
      return { ok: false, status: 503, json: async () => ({ error: { code: 503, message: "UNAVAILABLE", status: "UNAVAILABLE" } }) };
    }
    return fake.fetchFn(rawUrl, init);
  };

  const result = await runSmoke({ fetchFn: flaky, config: VALID_CONFIG, now: clock, log: () => {}, admin });

  assert.equal(result.ok, false);
  assert.deepEqual(result.steps.map((s) => s.name), ["signup", "deny-unnamed-create"]);
  assert.equal(result.steps[0].pass, true);
  assert.equal(result.steps[1].pass, false);

  // no run was ever created, no name was seeded, and the anonymous account is gone
  assertBoardLeftAsFound(fake);
  assert.equal(result.cleanup.accountDeleted, true);
});

test("runSmoke: a failure after the name was seeded still removes the names document, the runs and the account", async () => {
  const clock = clockBox(4100000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const admin = await makeAdmin(fake);
  let userCommits = 0;
  const flaky = async (rawUrl, init) => {
    const isUserCommit =
      typeof rawUrl === "string" && rawUrl.includes(":commit") && !(init && JSON.stringify(init.headers || {}).includes(FAKE_ADMIN_TOKEN));
    if (isUserCommit) {
      userCommits += 1;
      if (userCommits === 2) return { ok: false, status: 503, json: async () => ({ error: { code: 503, message: "UNAVAILABLE", status: "UNAVAILABLE" } }) };
    }
    return fake.fetchFn(rawUrl, init);
  };

  const result = await runSmoke({ fetchFn: flaky, config: VALID_CONFIG, now: clock, log: () => {}, admin });

  assert.equal(result.ok, false);
  assert.deepEqual(result.steps.map((s) => s.name), ["signup", "deny-unnamed-create", "seed-name", "create-a"]);
  assert.equal(result.steps[3].pass, false);
  assertBoardLeftAsFound(fake);
  assert.equal(result.cleanup.nameRemoved, true);
  assert.equal(result.cleanup.accountDeleted, true);
});

test("runSmoke: against rules that let an unnamed uid post, deny-unnamed-create fails and cleanup removes what landed", async () => {
  const clock = clockBox(4200000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const admin = await makeAdmin(fake);
  const permissive = async (rawUrl, init) => {
    const res = await fake.fetchFn(rawUrl, init);
    // pretend the live rules answered 200 to the unnamed create: the step must then fail
    if (typeof rawUrl === "string" && rawUrl.includes(":commit") && !(init && JSON.stringify(init.headers || {}).includes(FAKE_ADMIN_TOKEN)) && res.status === 403 && !permissive.done) {
      permissive.done = true;
      return { ok: true, status: 200, json: async () => ({ writeResults: [{}], commitTime: new Date(clock()).toISOString() }) };
    }
    return res;
  };
  const result = await runSmoke({ fetchFn: permissive, config: VALID_CONFIG, now: clock, log: () => {}, admin });
  assert.equal(result.ok, false);
  assert.equal(result.steps[result.steps.length - 1].name, "deny-unnamed-create");
  assertBoardLeftAsFound(fake);
});

/* ---------------- no tokens or the key ever leak ---------------- */

test("runSmoke: no step, log line or fact contains the API key, an id token or a refresh token", async () => {
  const clock = clockBox(6000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const admin = await makeAdmin(fake);
  const logLines = [];
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: (l) => logLines.push(l), admin });

  assert.equal(result.ok, true);
  const blob = `${JSON.stringify(result.steps)}\n${JSON.stringify(result.facts)}\n${logLines.join("\n")}`;
  assert.ok(!blob.includes(VALID_CONFIG.apiKey));
  assert.ok(!blob.includes(FAKE_ADMIN_TOKEN));
  assert.ok(!/Bearer\s+\S+/.test(blob));
  assert.ok(!/\bidtok\d+/.test(blob));
  assert.ok(!/\brtok\d+/.test(blob));
});

/* ---------------- CLI: --dry-run and a bad flag ---------------- */

test("CLI --dry-run: exits 0, lists every step, prints the three summaries, never the key", () => {
  const res = runTool(["--dry-run"]);
  assert.equal(res.status, 0, res.stderr);
  for (const name of SMOKE_STEP_ORDER) assert.ok(res.stdout.includes(name), name);
  assert.ok(res.stdout.includes("Smoke Probe"));
  assert.ok(!res.stdout.includes("AIza"));
});

test("CLI --bogus: usage + exit 2, no network", () => {
  const res = runTool(["--bogus"]);
  assert.equal(res.status, 2);
  assert.ok(!res.stdout.includes("--transition"), "the transition probe is gone from the usage");
  assert.ok(res.stdout.includes("--function"));
});

test("CLI too many args: usage + exit 2", () => {
  const res = runTool(["--dry-run", "extra"]);
  assert.equal(res.status, 2);
});

test("CLI --with-admin is gone (the admin seed is now always required): usage + exit 2", () => {
  const res = runTool(["--with-admin"]);
  assert.equal(res.status, 2);
});

/* ---------------- main(): admin up front, in-process, injected ---------------- */

function captureOut() {
  const lines = [];
  return { lines, out: (l) => lines.push(String(l)) };
}

test("main(): without admin auth the default probe exits 2 with a message that the names gate needs the admin seed, and never calls the network", async () => {
  const fake = createFakeBoardFetch({ config: VALID_CONFIG });
  const cap = captureOut();
  const code = await main(["node", "boards-smoke.mjs"], {
    config: VALID_CONFIG,
    fetchFn: fake.fetchFn,
    env: {},
    execFn: () => {
      throw new Error("no gcloud");
    },
    out: cap.out,
  });
  assert.equal(code, 2);
  assert.ok(cap.lines.join("\n").toLowerCase().includes("admin seed"), cap.lines.join("\n"));
  assert.deepEqual(fake.calls(), []);
});

test("main(): --transition is gone: usage + exit 2, and no network call", async () => {
  const fake = createFakeBoardFetch({ config: VALID_CONFIG });
  const cap = captureOut();
  const code = await main(["node", "boards-smoke.mjs", "--transition"], {
    config: VALID_CONFIG,
    fetchFn: fake.fetchFn,
    env: {},
    execFn: () => {
      throw new Error("no gcloud");
    },
    out: cap.out,
  });
  assert.equal(code, 2);
  assert.deepEqual(fake.calls(), []);
});

test("main(): the default probe with an admin token exits 0 and prints every step", async () => {
  const clock = clockBox(11000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const cap = captureOut();
  const code = await main(["node", "boards-smoke.mjs"], {
    config: VALID_CONFIG,
    fetchFn: fake.fetchFn,
    now: clock,
    env: {},
    execFn: () => FAKE_ADMIN_TOKEN,
    out: cap.out,
  });
  assert.equal(code, 0, cap.lines.join("\n"));
  for (const name of SMOKE_STEP_ORDER) assert.ok(cap.lines.some((l) => l === `PASS ${name}`), name);
  assertBoardLeftAsFound(fake);
});

test("main(): --function needs no admin auth and exits 0 against the fake's boardName emulation", async () => {
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clockBox(13000000) });
  const cap = captureOut();
  const code = await main(["node", "boards-smoke.mjs", "--function"], {
    config: VALID_CONFIG,
    fetchFn: fake.fetchFn,
    env: {},
    execFn: () => {
      throw new Error("no gcloud");
    },
    out: cap.out,
  });
  assert.equal(code, 0, cap.lines.join("\n"));
  for (const name of FUNCTION_STEP_ORDER) assert.ok(cap.lines.some((l) => l === `PASS ${name}`), name);
  assertBoardLeftAsFound(fake);
});

/* ---------------- 91.2: the function probe ---------------- */

test("runFunctionProbe: against the fake's boardName emulation claim-unlinked is refused NOT_LINKED, release answers ok, the account is cleaned up", async () => {
  const clock = clockBox(14000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const result = await runFunctionProbe({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: () => {} });
  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.deepEqual(result.steps.map((s) => s.name), FUNCTION_STEP_ORDER);
  const claim = result.steps.find((s) => s.name === "claim-unlinked");
  assert.equal(claim.detail.reason, "refused");
  assert.equal(claim.detail.code, "NOT_LINKED");
  assert.equal(result.cleanup.accountDeleted, true);
  assertBoardLeftAsFound(fake);
});

test("runFunctionProbe: a function that answers 200 to an anonymous claim fails the probe, and the account is still removed", async () => {
  const clock = clockBox(15000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const lax = async (rawUrl, init) => {
    if (rawUrl === BOARD_NAME_FN.url && init && init.method === "POST" && String(init.body).includes('"claim"')) {
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ ok: true, name: "Anyone", overridden: false, stamped: 0, adopted: 0 }), text: async () => "" };
    }
    return fake.fetchFn(rawUrl, init);
  };
  const result = await runFunctionProbe({ fetchFn: lax, config: VALID_CONFIG, now: clock, log: () => {} });
  assert.equal(result.ok, false);
  assert.deepEqual(result.steps.map((s) => s.name), ["signup", "claim-unlinked"]);
  assert.equal(result.cleanup.accountDeleted, true);
  assert.deepEqual(fake.users(), []);
});

/* ---------------- the tool's own source ---------------- */

test("the tool names neither the rolled-handle module nor a rolled handle roll, and posts creates itself, not through submitRun", () => {
  assert.equal(TOOL_SRC.includes("handles.js"), false);
  assert.equal(TOOL_SRC.includes("rollHandle"), false);
  assert.equal(TOOL_SRC.includes("submitRun"), false, "from 91.2-05 on submitRun needs a Play Games session the smoke can never have");
  assert.ok(TOOL_SRC.includes("createRunCommit"));
  assert.ok(TOOL_SRC.includes("createNameClient"));
});
