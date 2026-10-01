// test/unit/boardWrites.test.js
//
// Phase 83 Plan 06 Task 1, moved to the named flow by Phase 91.2 Plan 05.
// Covers createBoardWrites on the shared rig (test/unit/harness/boardHarness.js:
// the fake board server under the FINAL rules, a fake Play Games player, the
// real identity): the idempotent submitRun under the verified name (created /
// exists under all three existsResponse modes / refused / invalid / 401
// refresh-and-retry / offline / server / off / signin / a stale name that is
// re-claimed once) and eraseMyRuns (success, mid-way failure, name released).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { SEASON } from "../../content/season.js";
import { runHash } from "../../engine/records.js";
import { RUN_CLIENT_FIELDS, rankKeys, runDocId } from "../../src/browser/runDoc.js";
import { IDENTITY_KEY } from "../../src/browser/firebaseAuth.js";
import { WRITE_REASONS, classifyWrite, createBoardWrites } from "../../src/browser/boardWrites.js";
import { makeBoardRig } from "./harness/boardHarness.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BOARD_WRITES_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "boardWrites.js"), "utf8").replace(/\r\n/g, "\n");

const PLAYER_NAME = "Dev Delver"; // the fake Play Games player's default name

/* ---------------- helpers ---------------- */

function clockBox(start = 0) {
  let t = start;
  const now = () => t;
  now.set = (v) => {
    t = v;
  };
  now.advance = (d) => {
    t += d;
  };
  return now;
}

function baseSummary(overrides = {}) {
  const s = {
    name: "Test Hero",
    race: "Human",
    sub: "Knight",
    cls: "Fighter",
    level: 1,
    sp: 40,
    floor: 5,
    day: 3,
    steps: 500,
    gold: 100,
    kills: 10,
    cause: "combat",
    note: "died",
    epitaph: "",
    when: 1000,
    season: SEASON,
    seed: 12345,
    acts: 10,
    ...overrides,
  };
  s.hash = runHash(s);
  return s;
}

function docFor(overrides = {}) {
  const merged = {
    uid: "fakeuid000001",
    handle: PLAYER_NAME,
    season: SEASON,
    name: "Hero",
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
    note: "died",
    epitaph: "",
    when: 1000,
    hash: "00000001",
    version: "2.3.0 (13)",
    seed: 1,
    acts: 10,
    ...overrides,
  };
  const keys = rankKeys(merged);
  const doc = {};
  for (const f of RUN_CLIENT_FIELDS) doc[f] = f in keys ? keys[f] : merged[f];
  return doc;
}

function seedFor(overrides = {}) {
  const doc = docFor(overrides);
  return { id: runDocId(doc.uid, doc.hash), doc };
}

function hexHash(n) {
  return n.toString(16).padStart(8, "0");
}

// A rig plus writes. The player is signed in to Play Games unless play says otherwise.
function makeSetup({ competeOn = true, fakeOpts = {}, play = {} } = {}) {
  const clock = clockBox(0);
  let competing = competeOn;
  const rig = makeBoardRig({ now: clock, fakeOpts, play, competeOn: () => competing });
  const writes = createBoardWrites({ fetchFn: rig.fetchFn, identity: rig.identity, config: rig.config });
  return {
    rig,
    fake: rig.fake,
    storage: rig.storage,
    clock,
    identity: rig.identity,
    writes,
    setCompeting: (v) => {
      competing = v;
    },
  };
}

function commitCalls(fake) {
  return fake.calls().filter((c) => c.method === "POST" && c.url.includes(":commit"));
}

function getRunCalls(fake) {
  return fake.calls().filter((c) => c.method === "GET" && /\/runs\//.test(c.url));
}

function firestoreCalls(fake) {
  return fake.calls().filter((c) => c.url.includes("firestore.googleapis.com"));
}

/* ================================================================
   constants
   ================================================================ */

test("constants: WRITE_REASONS gains signin", () => {
  assert.deepEqual(WRITE_REASONS, ["off", "offline", "server", "refused", "invalid", "auth", "unavailable", "signin"]);
  assert.ok(Object.isFrozen(WRITE_REASONS));
});

/* ================================================================
   classifyWrite
   ================================================================ */

test("classifyWrite: 2xx is ok, 401/UNAUTHENTICATED is auth, 429/5xx is server, 400/403/409 is ambiguous, else refused", () => {
  assert.equal(classifyWrite(200, {}), "ok");
  assert.equal(classifyWrite(401, {}), "auth");
  assert.equal(classifyWrite(403, { error: { status: "UNAUTHENTICATED" } }), "auth");
  assert.equal(classifyWrite(429, {}), "server");
  assert.equal(classifyWrite(503, {}), "server");
  assert.equal(classifyWrite(400, {}), "ambiguous");
  assert.equal(classifyWrite(403, {}), "ambiguous");
  assert.equal(classifyWrite(409, {}), "ambiguous");
  assert.equal(classifyWrite(418, {}), "refused");
});

/* ================================================================
   submitRun
   ================================================================ */

test("submitRun: a signed-in player's run lands under their verified name (D-06: the session claims first)", async () => {
  const { fake, writes } = makeSetup({ play: { playerId: "p-ann", displayName: "Ann the Bold" } });
  const summary = baseSummary();
  const res = await writes.submitRun(summary, { version: "2.3.0 (13)" });
  assert.equal(res.ok, true);
  assert.equal(res.status, "created");
  const docs = fake.docs();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].hash, summary.hash);
  assert.equal(docs[0].handle, "Ann the Bold");
  assert.equal(docs[0].handle, fake.names()[0].name, "the run's handle is the name the function wrote");
  assert.equal(typeof docs[0].createdAt, "string");
});

for (const mode of ["precondition", "denied", "conflict"]) {
  test(`submitRun: a duplicate is acknowledged as exists (existsResponse=${mode})`, async () => {
    const setup = makeSetup({ fakeOpts: { existsResponse: mode } });
    const summary = baseSummary();
    const first = await setup.writes.submitRun(summary, { version: "1" });
    assert.equal(first.ok, true);
    assert.equal(first.status, "created");

    const before = getRunCalls(setup.fake).length;
    const second = await setup.writes.submitRun(summary, { version: "1" });
    assert.equal(second.ok, true);
    assert.equal(second.status, "exists");
    assert.equal(second.id, first.id);
    assert.equal(getRunCalls(setup.fake).length, before + 1, "exactly one public GET settles the ambiguity");
    assert.equal(setup.fake.docs().length, 1);
  });
}

test("submitRun: a player who is not signed in to Play Games gets reason signin and nothing reaches Firestore", async () => {
  const { fake, writes } = makeSetup({ play: { signedIn: false, interactive: false } });
  const res = await writes.submitRun(baseSummary(), { version: "1" });
  assert.deepEqual(res, { ok: false, reason: "signin" });
  assert.equal(fake.calls().length, 0);
  assert.equal(firestoreCalls(fake).length, 0);
});

test("submitRun: a session failure's reason passes through unchanged with no create", async () => {
  const setup = makeSetup();
  for (const reason of ["offline", "server", "unavailable", "off"]) {
    const identity = { boardSession: async () => ({ ok: false, reason }) };
    const writes = createBoardWrites({ fetchFn: setup.fake.fetchFn, identity, config: setup.rig.config });
    assert.deepEqual(await writes.submitRun(baseSummary(), { version: "1" }), { ok: false, reason });
  }
  assert.equal(setup.fake.calls().length, 0);
});

test("submitRun: Compete OFF resolves off with zero requests", async () => {
  const setup = makeSetup({ competeOn: false });
  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.deepEqual(res, { ok: false, reason: "off" });
  assert.equal(setup.fake.calls().length, 0);
  assert.equal(setup.rig.play.calls().length, 0);
});

test("submitRun: a create refused for a doc that does not exist (banned uid) resolves refused after one name refresh and no loop", async () => {
  const { fake, identity, writes } = makeSetup();
  const session = await identity.boardSession();
  assert.equal(session.ok, true);
  fake.ban(session.uid);

  const res = await writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "refused");
  assert.equal(res.status, "PERMISSION_DENIED");
  assert.equal(fake.docs().length, 0);
  assert.equal(commitCalls(fake).length, 1, "the name did not change, so there is no second create");
});

test("submitRun: a summary the JS mirror refuses resolves invalid with no :commit request", async () => {
  const { fake, writes } = makeSetup();
  const bad = baseSummary({ kills: 999999 }); // kills > steps fails the mirror
  const res = await writes.submitRun(bad, { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid");
  assert.ok(Array.isArray(res.fails) && res.fails.includes("kills"));
  assert.equal(commitCalls(fake).length, 0);
});

test("submitRun: a stale name is refused, re-claimed once, rebuilt with the current name and lands", async () => {
  const setup = makeSetup();
  const session = await setup.identity.boardSession();
  assert.equal(session.name, PLAYER_NAME);
  // The server's name moved on (another device renamed the player, or an admin override): the cached name is stale.
  setup.fake.setOverride(session.uid, "Renamed Elsewhere");
  setup.fake.setName(session.uid, "Renamed Elsewhere");

  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, true);
  assert.equal(res.status, "created");
  assert.equal(setup.fake.docs().length, 1);
  assert.equal(setup.fake.docs()[0].handle, "Renamed Elsewhere");
  assert.equal(commitCalls(setup.fake).length, 2, "the refused create and the retry");
  assert.equal((await setup.identity.snapshot()).name, "Renamed Elsewhere");
});

test("submitRun: a second refusal after the re-claim resolves refused (no loop)", async () => {
  const setup = makeSetup();
  const session = await setup.identity.boardSession();
  setup.fake.setOverride(session.uid, "Renamed Elsewhere");
  setup.fake.setName(session.uid, "Renamed Elsewhere");
  setup.fake.ban(session.uid); // the retry is refused for another reason

  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "refused");
  assert.equal(commitCalls(setup.fake).length, 2, "one retry, never more");
  assert.equal(setup.fake.docs().length, 0);
});

test("submitRun: a 401 forces one forceRefresh and one retry, then resolves created", async () => {
  const setup = makeSetup({ fakeOpts: { tokenTtlMs: 100 } });
  const session = await setup.identity.boardSession(); // link and claim at t=0
  assert.equal(session.ok, true);
  setup.clock.set(150); // past the fake's own tokenTtlMs, well within the client's margin

  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, true);
  assert.equal(res.status, "created");
});

test("submitRun: a second 401 (forceRefresh does not help) resolves reason auth", async () => {
  const setup = makeSetup();
  const uid = "fakeuid000001";
  const identity = {
    boardSession: async () => ({ ok: true, uid, idToken: "not-a-real-token", name: PLAYER_NAME }),
    forceRefresh: async () => ({ ok: true, uid, idToken: "still-not-real" }),
    refreshName: async () => ({ ok: false, reason: "server" }),
  };
  const writes = createBoardWrites({ fetchFn: setup.fake.fetchFn, identity, config: setup.rig.config });
  const res = await writes.submitRun(baseSummary(), { version: "1" });
  assert.deepEqual(res, { ok: false, reason: "auth" });
  assert.equal(commitCalls(setup.fake).length, 2);
});

test("submitRun: offline resolves offline", async () => {
  const setup = makeSetup();
  await setup.identity.boardSession(); // sign in while online
  setup.fake.setOnline(false);
  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "offline");
});

test("submitRun: a stub 503 resolves server", async () => {
  const setup = makeSetup();
  await setup.identity.boardSession();
  const stub503 = async (u, init) => {
    if (typeof u === "string" && u.includes(":commit")) {
      return { ok: false, status: 503, json: async () => ({ error: { code: 503, status: "UNAVAILABLE", message: "UNAVAILABLE" } }) };
    }
    return setup.rig.fetchFn(u, init);
  };
  const writes2 = createBoardWrites({ fetchFn: stub503, identity: setup.identity, config: setup.rig.config });
  const res = await writes2.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "server");
});

/* ================================================================
   the rename path is gone (D-11)
   ================================================================ */

test("D-11: there is no rewriteHandle; the writer's surface is submitRun and eraseMyRuns", () => {
  const setup = makeSetup();
  assert.deepEqual(Object.keys(setup.writes).sort(), ["eraseMyRuns", "submitRun"]);
  assert.equal("rewriteHandle" in setup.writes, false);
});

/* ================================================================
   eraseMyRuns
   ================================================================ */

test("eraseMyRuns: with no identity yet drops nothing but resolves ok with zero deletes", async () => {
  const setup = makeSetup();
  const res = await setup.writes.eraseMyRuns();
  assert.deepEqual(res, { ok: true, deleted: 0, dropped: true, accountDeleted: false });
});

test("eraseMyRuns: deletes all 120 of the player's runs, leaves the other player's 5, releases the name, deletes the account, drops the identity", async () => {
  const mine = [];
  for (let i = 0; i < 120; i++) mine.push(seedFor({ uid: "fakeuid000001", hash: hexHash(i + 1) }));
  const theirs = [];
  for (let i = 0; i < 5; i++) theirs.push(seedFor({ uid: "otheruid", hash: hexHash(1000 + i) }));

  const setup = makeSetup({ fakeOpts: { runs: [...mine, ...theirs] } });
  const session = await setup.identity.boardSession(); // fakeuid000001, claims the name
  assert.equal(session.uid, "fakeuid000001");
  assert.equal(setup.fake.names().length, 1);

  const res = await setup.writes.eraseMyRuns();
  assert.equal(res.ok, true);
  assert.equal(res.deleted, 120);
  assert.equal(res.dropped, true);
  assert.equal(res.accountDeleted, true);

  const docs = setup.fake.docs();
  assert.equal(docs.filter((d) => d.uid === "fakeuid000001").length, 0);
  assert.equal(docs.filter((d) => d.uid === "otheruid").length, 5);
  assert.ok(!setup.fake.users().includes("fakeuid000001"));
  assert.equal(setup.fake.names().length, 0, "the name record was released");
  assert.equal(setup.storage.map.has(IDENTITY_KEY), false);
});

test("eraseMyRuns: a mid-way network failure resolves ok:false with the partial deleted count, and keeps the identity stored", async () => {
  const mine = [];
  for (let i = 0; i < 60; i++) mine.push(seedFor({ uid: "fakeuid000001", hash: hexHash(i + 1) }));

  const setup = makeSetup({ fakeOpts: { runs: mine } });
  await setup.identity.boardSession();

  let callCount = 0;
  const wrapped = async (u, init) => {
    callCount += 1;
    if (callCount === 4) setup.fake.setOnline(false); // query(1) commit(2) query(3) then the second commit fails
    return setup.rig.fetchFn(u, init);
  };
  const writes2 = createBoardWrites({ fetchFn: wrapped, identity: setup.identity, config: setup.rig.config });

  const res = await writes2.eraseMyRuns();
  assert.equal(res.ok, false);
  assert.equal(res.reason, "offline");
  assert.equal(res.deleted, 50);
  assert.equal(setup.storage.map.has(IDENTITY_KEY), true);
});

/* ================================================================
   purity
   ================================================================ */

test("purity: boardWrites.js never touches DOM globals and never calls the bare global fetch", () => {
  const code = stripJs(BOARD_WRITES_SRC);
  for (const banned of [/\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.doesNotMatch(code, /(?<!\.)\bdocument\b(?!\s*:)/, "must not use the DOM global `document`");
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
});

test("purity: exports createBoardWrites exactly once, uses createRunCommit and the session's name, and keeps no handle rewrite", () => {
  assert.equal((BOARD_WRITES_SRC.match(/export function createBoardWrites/g) || []).length, 1);
  assert.match(BOARD_WRITES_SRC, /createRunCommit/);
  assert.match(BOARD_WRITES_SRC, /boardSession/);
  assert.equal(BOARD_WRITES_SRC.includes("rewriteHandle"), false);
  assert.equal(BOARD_WRITES_SRC.includes("handleUpdateCommit"), false);
  assert.equal(BOARD_WRITES_SRC.includes("handles.js"), false);
});
