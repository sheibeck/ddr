// test/emulator/firestore-rules.emulator.test.js
//
// Release 2.3.0 (live finding 2026-10-02). The unit tests read the rules as
// TEXT; only Firestore's own engine enforces the per-request budget of 1,000
// evaluated expressions, which a second evaluation of isValidBoardRun blows
// (the shipped 2.2.0 create was refused live with every condition satisfied).
// This test runs the real rules engine: the Firestore emulator, over REST, no
// extra dependency. It SKIPS unless FIRESTORE_EMULATOR_HOST is set, so
// `npm test` stays dependency-free. Run it before any rules deploy:
//
//   RULES_UNDER_TEST=transition firebase emulators:exec --only firestore --project demo-ddr \
//     --config firebase.transition.json "node --test test/emulator/firestore-rules.emulator.test.js"
//   RULES_UNDER_TEST=final      firebase emulators:exec --only firestore --project demo-ddr \
//     --config firebase.json            "node --test test/emulator/firestore-rules.emulator.test.js"
//
// (the demo- project id keeps it off every real project; nothing is deployed).
// Delete the transition expectations with the transition files at the 2.3 cutover.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { buildRunDoc, createRunCommit, legacyHandleUpdateCommit, legacyDeepKeyOf, deepKeyOf } from "../../src/browser/runDoc.js";
import { toFirestoreFields } from "../../src/browser/firestoreRest.js";
import { runHash } from "../../engine/records.js";

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const WHICH = process.env.RULES_UNDER_TEST === "final" ? "final" : "transition";
const SKIP = HOST ? false : "FIRESTORE_EMULATOR_HOST is not set (run through firebase emulators:exec)";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const RULES_FILE = path.join(__dirname, "..", "..", "firebase", WHICH === "final" ? "firestore.rules" : "firestore.transition.rules");
const PROJECT = "demo-ddr";
const CONFIG = { projectId: PROJECT, apiKey: "x" };
const BASE = `http://${HOST}`;
const DOCS = `${BASE}/v1/projects/${PROJECT}/databases/(default)/documents`;

const jwt = (uid) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b({ alg: "none", typ: "JWT" })}.${b({ user_id: uid, sub: uid, aud: PROJECT })}.`;
};

async function loadRules() {
  // a clean database per test: names/{uid}, banned/{uid} and runs from an earlier test must not leak
  const wiped = await fetch(`${BASE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(wiped.status, 200);
  const content = fs.readFileSync(RULES_FILE, "utf8");
  const res = await fetch(`${BASE}/emulator/v1/projects/${PROJECT}:securityRules`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ rules: { files: [{ name: "firestore.rules", content }] } }),
  });
  const body = await res.json();
  const errors = (body.issues || []).filter((i) => i.severity !== "WARNING");
  assert.equal(res.status, 200);
  assert.deepEqual(errors, [], "the rules compile");
}

async function ownerWrite(docPath, fields) {
  const res = await fetch(`${DOCS}/${docPath}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields }),
  });
  assert.equal(res.status, 200, `owner write ${docPath}`);
}

async function commit(body, uid) {
  const res = await fetch(`${DOCS}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt(uid)}` },
    body: JSON.stringify(body),
  });
  return res.status;
}

let counter = 0;
const newUid = () => `emu${String(++counter).padStart(4, "0")}${"x".repeat(20)}`;

// The shapes the live smoke (tools/boards-smoke.mjs) and a real 2.2.0 client send. `worst` uses the
// data that costs the most expressions: the last race, the last class and sub, the last cause.
function summary({ worst = false, steps = 321 } = {}) {
  const seed = Date.now() + counter;
  const s = {
    race: "Troll", cls: worst ? "Thief" : "Magic User", sub: worst ? "Acrobat" : "Court Mage", name: "Emu Probe",
    cause: worst ? "scrollFumble" : "combat", note: "n", epitaph: "e", season: 1, version: "2.2.0",
    seed, when: seed, floor: worst ? 200 : 4, day: 3, kills: 2, gold: 30, sp: 120, level: worst ? 5 : 2, acts: 300, steps,
  };
  s.hash = runHash(s);
  return s;
}

function create(uid, s, handle, deepKey) {
  const built = buildRunDoc(s, { uid, handle, version: s.version });
  assert.equal(built.ok, true, JSON.stringify(built));
  return commit(createRunCommit(CONFIG, built.id, { ...built.doc, deepKey }), uid);
}

const LEGACY_CREATE = WHICH === "transition" ? 200 : 403;

for (const worst of [false, true]) {
  const label = worst ? "worst-case data" : "smoke data";

  test(`[${WHICH}] a 2.2.0 create (unnamed uid, @handle, old DEPTH key) ${LEGACY_CREATE === 200 ? "lands" : "is refused"} - ${label}`, { skip: SKIP }, async () => {
    await loadRules();
    const uid = newUid();
    const s = summary({ worst });
    assert.equal(await create(uid, s, "@mossjaw", legacyDeepKeyOf(s)), LEGACY_CREATE);
  });

  test(`[${WHICH}] a named 2.3 create lands, and the legacy branches are shut for a named uid - ${label}`, { skip: SKIP }, async () => {
    await loadRules();
    const uid = newUid();
    await ownerWrite(`names/${uid}`, toFirestoreFields({ name: "Emu Probe" }));
    const s = summary({ worst, steps: 500 });
    assert.equal(await create(uid, s, "Emu Probe", deepKeyOf(s)), 200);
    const t = summary({ worst, steps: 400 });
    assert.equal(await create(uid, t, "@mossjaw", legacyDeepKeyOf(t)), 403, "legacy create for a named uid");
    const u = summary({ worst, steps: 300 });
    assert.equal(await create(uid, u, "Emu Impostor", deepKeyOf(u)), 403, "named uid, wrong name");
  });
}

test(`[${WHICH}] an unnamed uid is refused with a non-legacy handle, a third DEPTH key, a bad race, or a ban`, { skip: SKIP }, async () => {
  await loadRules();
  const uid = newUid();
  const s = summary();
  assert.equal(await create(uid, s, "Emu Probe", deepKeyOf(s)), 403, "non-legacy handle");
  const t = summary({ steps: 77 });
  assert.equal(await create(uid, t, "@mossjaw", deepKeyOf(t) + 1), 403, "third key");
  const u = summary({ steps: 78 });
  const built = buildRunDoc(u, { uid, handle: "@mossjaw", version: "2.2.0" });
  assert.equal(await commit(createRunCommit(CONFIG, built.id, { ...built.doc, race: "Goblin", deepKey: legacyDeepKeyOf(u) }), uid), 403, "bad race");
  const banned = newUid();
  await ownerWrite(`banned/${banned}`, toFirestoreFields({ at: "x" }));
  const v = summary({ steps: 79 });
  assert.equal(await create(banned, v, "@mossjaw", legacyDeepKeyOf(v)), 403, "banned");
});

test(`[${WHICH}] the 2.2.0 handle re-roll ${WHICH === "transition" ? "works for an unnamed owner, not for a named one or to a non-legacy handle" : "is refused"}`, { skip: SKIP }, async () => {
  await loadRules();
  const uid = newUid();
  const s = summary({ steps: 321 });
  const built = buildRunDoc(s, { uid, handle: "@mossjaw", version: "2.2.0" });
  await ownerWrite(`runs/${built.id}`, { ...toFirestoreFields({ ...built.doc, deepKey: legacyDeepKeyOf(s) }), createdAt: { timestampValue: new Date().toISOString() } });
  assert.equal(await commit(legacyHandleUpdateCommit(CONFIG, built.id, "@gravepouch"), uid), WHICH === "transition" ? 200 : 403);
  assert.equal(await commit(legacyHandleUpdateCommit(CONFIG, built.id, "Hacker"), uid), 403, "non-legacy handle");
  await ownerWrite(`names/${uid}`, toFirestoreFields({ name: "Emu Probe" }));
  assert.equal(await commit(legacyHandleUpdateCommit(CONFIG, built.id, "@mossjaw"), uid), 403, "named owner");
});
