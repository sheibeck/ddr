// test/unit/pgsProbe.test.js
//
// Phase 91.2-03 Task 3. The Play Games spike probe (src/browser/pgsProbe.js),
// proven offline against the fake board server and the fake PlayIdentity:
// the ordered steps, the six gate verdicts, the offline spike-gate failure
// modes, non-invasiveness (it deletes only what it created, restores the
// top-level displayName), the no-secrets report and never-throws.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";
import { IDENTITY_BASE } from "../../src/browser/firestoreRest.js";
import { createFakePlayIdentity } from "../../src/browser/playIdentity.js";
import { createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";
import * as probeModule from "../../src/browser/pgsProbe.js";

const { runPgsProbe } = probeModule;

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PROBE_SRC = fs.readFileSync(path.join(__dirname, "..", "..", "src", "browser", "pgsProbe.js"), "utf8").replace(/\r\n/g, "\n");

const NOW_MS = Date.parse("2026-10-01T12:00:00.000Z");
const PLAY_CONFIG = Object.freeze({ appId: "517177834262", webClientId: "123456789-abc.apps.googleusercontent.com" });
const PROVIDER = "playgames.google.com";
const STEP_IDS = ["init-status", "idp-sign-in", "claims", "lookup", "tamper", "second-link", "cleanup"];

/* ---------------- rig ---------------- */

// Wraps a fetchFn so every token and auth code the server mints or sees is
// remembered (the report must never contain any), and `tweak` can rewrite a
// request or a response for the failure-mode tests.
function makeRig({ serverOpts = {}, playOpts = {}, tweak } = {}) {
  const fake = createFakeBoardFetch({ now: () => NOW_MS, ...serverOpts });
  const play = createFakePlayIdentity(playOpts);
  const secrets = new Set();
  const seenUrls = [];

  function collect(value) {
    if (!value || typeof value !== "object") return;
    for (const [k, v] of Object.entries(value)) {
      if (["idToken", "refreshToken", "id_token", "access_token", "refresh_token"].includes(k) && typeof v === "string") secrets.add(v);
      else collect(v);
    }
  }

  async function fetchFn(rawUrl, init = {}) {
    seenUrls.push(rawUrl);
    let body = null;
    try {
      body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    if (body && typeof body.postBody === "string") {
      const code = new URLSearchParams(body.postBody).get("code");
      if (code) secrets.add(code);
    }
    if (body) collect(body);
    if (tweak) {
      const handled = await tweak({ url: rawUrl, init, body, forward: (override) => fake.fetchFn(rawUrl, override ?? init) });
      if (handled) return handled;
    }
    const res = await fake.fetchFn(rawUrl, init);
    const json = await res.json();
    collect(json);
    return { ok: res.ok, status: res.status, json: async () => json, text: async () => JSON.stringify(json) };
  }

  const run = (extra = {}) => runPgsProbe({ playIdentity: play, fetchFn, config: FIREBASE_CONFIG, playConfig: PLAY_CONFIG, now: () => NOW_MS, ...extra });
  return { fake, play, fetchFn, secrets, seenUrls, run };
}

const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) });
const step = (report, id) => report.steps.find((s) => s.id === id);
const hits = (url, op) => url.includes(`accounts:${op}`);

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/* ---------------- the happy path ---------------- */

test("probe against the fake: every step runs, G4/A4/G3/A6 pass, G1 asks for a human, A3 skips on opaque tokens", async () => {
  const rig = makeRig();
  const report = await rig.run();
  assert.equal(report.v, 1);
  assert.equal(report.at, new Date(NOW_MS).toISOString());
  assert.deepEqual(report.steps.map((s) => s.id), STEP_IDS);
  for (const s of report.steps) {
    assert.equal(s.ok, true, `${s.id} ok`);
    assert.equal(typeof s.facts, "object");
  }
  assert.deepEqual(report.gates, { G1: "check", G3: "pass", G4: "pass", A3: "skip", A4: "pass", A6: "pass" });
  assert.equal(step(report, "lookup").facts.providerNameMatchesLocal, true);
  assert.equal(step(report, "lookup").facts.rawIdMatchesPlayer, true);
  assert.equal(step(report, "idp-sign-in").facts.isNewUser, true);
  assert.equal(step(report, "second-link").facts.answer, "FEDERATED_USER_ID_ALREADY_LINKED");
  assert.equal(step(report, "tamper").facts.refusedLink, true);
  assert.equal(step(report, "tamper").facts.providerNameUnchanged, true);
  // Non-invasive: both accounts the probe made are gone.
  assert.deepEqual(rig.fake.users(), []);
  assert.equal(step(report, "cleanup").facts.deletedProbeAccount, true);
  assert.equal(step(report, "cleanup").facts.deletedThrowaway, true);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.steps));
  assert.ok(Object.isFrozen(report.gates));
});

test("probe: A3 passes when the ID token's decoded payload lists the Play Games identity, fails when it does not", async () => {
  for (const withIdentity of [true, false]) {
    const realFor = new Map(); // jwt -> the fake's opaque token
    // A fetch layer that swaps the sign-in's opaque ID token for a JWT-shaped
    // one (and swaps it back on every later request body).
    const rig = makeRig({
      tweak: async ({ url, init, body, forward }) => {
        let text = typeof init.body === "string" ? init.body : undefined;
        if (text) for (const [jwt, real] of realFor) text = text.split(jwt).join(real);
        const res = await forward({ ...init, body: text });
        const json = await res.json();
        if (hits(url, "signInWithIdp") && body && !body.idToken && typeof json.idToken === "string") {
          const payload = { firebase: { sign_in_provider: PROVIDER, identities: withIdentity ? { [PROVIDER]: ["fake-player"] } : { anonymous: [] } } };
          const jwt = `${b64url({ alg: "none" })}.${b64url(payload)}.signaturepart`;
          realFor.set(jwt, json.idToken);
          json.idToken = jwt;
        }
        return reply(res.status, json);
      },
    });
    const report = await rig.run();
    assert.equal(report.gates.A3, withIdentity ? "pass" : "fail", `identity listed: ${withIdentity}`);
    assert.equal(step(report, "claims").facts.signInProvider, PROVIDER);
    assert.equal(step(report, "claims").facts.hasPlayGamesIdentity, withIdentity);
    assert.equal(report.gates.G4, "pass");
    for (const jwt of realFor.keys()) assert.ok(!JSON.stringify(report).includes(jwt), "no token in the report");
    assert.ok(!JSON.stringify(report).includes("signaturepart"));
  }
});

/* ---------------- the spike-gate failure modes ---------------- */

test("probe: provider disabled is G4 fail, later steps skip and cleanup still runs", async () => {
  const rig = makeRig({ serverOpts: { playGamesEnabled: false } });
  const report = await rig.run();
  assert.equal(report.gates.G4, "fail");
  assert.equal(step(report, "idp-sign-in").ok, false);
  assert.equal(step(report, "idp-sign-in").facts.error, "OPERATION_NOT_ALLOWED");
  for (const id of ["claims", "lookup", "tamper", "second-link"]) {
    assert.equal(step(report, id).ok, false, `${id} not ok`);
    assert.equal(step(report, id).facts.skipped, true, `${id} skipped`);
  }
  assert.deepEqual({ G1: report.gates.G1, G3: report.gates.G3, A3: report.gates.A3, A4: report.gates.A4 }, { G1: "skip", G3: "skip", A3: "skip", A4: "skip" });
  assert.equal(step(report, "cleanup").ok, true);
  assert.deepEqual(rig.fake.users(), []);
});

test("probe: a signed-out player who stays signed out skips every network step", async () => {
  const rig = makeRig({ playOpts: { signedIn: false, interactive: false } });
  const report = await rig.run();
  assert.ok(["fail", "check"].includes(report.gates.A6), `A6 was ${report.gates.A6}`);
  assert.equal(report.gates.G4, "skip");
  for (const id of ["idp-sign-in", "claims", "lookup", "tamper", "second-link"]) assert.equal(step(report, id).facts.skipped, true, id);
  assert.equal(rig.seenUrls.length, 0, "no network call at all");
  assert.equal(step(report, "cleanup").ok, true);
});

test("probe: a signed-out player is asked to sign in once, interactively", async () => {
  const rig = makeRig({ playOpts: { signedIn: false, interactive: true } });
  const report = await rig.run();
  assert.equal(rig.play.calls().filter((c) => c.method === "signIn").length, 1);
  assert.equal(report.gates.G4, "pass");
  assert.equal(step(report, "init-status").facts.signedInInteractively, true);
});

test("probe: A4 fails when the forged provider link is accepted", async () => {
  const rig = makeRig({
    tweak: async ({ url, body }) => (hits(url, "update") && body && body.linkProviderUserInfo ? reply(200, { localId: "whatever" }) : undefined),
  });
  const report = await rig.run();
  assert.equal(report.gates.A4, "fail");
  assert.equal(step(report, "tamper").facts.refusedLink, false);
});

test("probe: A4 fails when the provider's name changes after the tamper attempts", async () => {
  let lookups = 0;
  const rig = makeRig({
    tweak: async ({ url, forward }) => {
      if (!hits(url, "lookup")) return undefined;
      lookups += 1;
      const res = await forward();
      const json = await res.json();
      if (lookups >= 2) json.users[0].providerUserInfo[0].displayName = "forged";
      return reply(res.status, json);
    },
  });
  const report = await rig.run();
  assert.equal(report.gates.A4, "fail");
  assert.equal(step(report, "tamper").facts.providerNameUnchanged, false);
});

test("probe: G1 fails when the provider name is not the local Play Games name, or is missing", async () => {
  for (const shown of ["A Real Person Name", ""]) {
    const rig = makeRig({
      tweak: async ({ url, forward }) => {
        if (!hits(url, "lookup")) return undefined;
        const res = await forward();
        const json = await res.json();
        json.users[0].providerUserInfo[0].displayName = shown;
        return reply(res.status, json);
      },
    });
    const report = await rig.run();
    assert.equal(report.gates.G1, "fail", `provider name "${shown}"`);
  }
});

test("probe: G3 fails when the second link succeeds instead of answering ALREADY_LINKED", async () => {
  const rig = makeRig({
    tweak: async ({ url, body }) =>
      hits(url, "signInWithIdp") && body && body.idToken ? reply(200, { localId: "other", idToken: "tweaked-token", refreshToken: "tweaked-refresh", providerId: PROVIDER, isNewUser: false }) : undefined,
  });
  const report = await rig.run();
  assert.equal(report.gates.G3, "fail");
  assert.equal(report.gates.G4, "pass");
});

test("probe: G3 reads the 400 form of ALREADY_LINKED too", async () => {
  const rig = makeRig({
    tweak: async ({ url, body }) =>
      hits(url, "signInWithIdp") && body && body.idToken ? reply(400, { error: { code: 400, message: "FEDERATED_USER_ID_ALREADY_LINKED", status: "INVALID_ARGUMENT" } }) : undefined,
  });
  const report = await rig.run();
  assert.equal(report.gates.G3, "pass");
});

/* ---------------- non-invasive ---------------- */

test("probe: a pre-linked player's account survives, and its top-level displayName is restored", async () => {
  const rig = makeRig();
  // The player already has a linked account with a top-level displayName.
  const pre = await rig.fake.fetchFn(`${IDENTITY_BASE}/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestUri: "http://localhost",
      postBody: `code=${encodeURIComponent("fake:fake-player:Dev%20Delver:1000")}&providerId=${PROVIDER}`,
      returnSecureToken: true,
      returnIdpCredential: true,
    }),
  });
  const preJson = await pre.json();
  await rig.fake.fetchFn(`${IDENTITY_BASE}/accounts:update?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: preJson.idToken, displayName: "Original Real Name" }),
  });

  const report = await rig.run();
  assert.equal(step(report, "idp-sign-in").facts.isNewUser, false);
  assert.equal(report.gates.G3, "pass");
  assert.equal(step(report, "cleanup").facts.deletedProbeAccount, false);
  assert.equal(step(report, "cleanup").facts.keptExistingAccount, true);
  assert.deepEqual(rig.fake.users(), [preJson.localId], "only the player's own account is left");

  const look = await rig.fake.fetchFn(`${IDENTITY_BASE}/accounts:lookup?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: preJson.idToken }),
  });
  const user = (await look.json()).users[0];
  assert.equal(user.displayName, "Original Real Name", "the tamper step restored the top-level displayName");
  assert.equal(user.providerUserInfo.length, 1);
});

test("probe: a fresh account's top-level displayName is cleared again after the tamper step", async () => {
  // Failing every delete leaves the probe's account behind, so its state can be read.
  const rig = makeRig({
    tweak: async ({ url }) => {
      if (hits(url, "delete")) throw new TypeError("Failed to fetch");
      return undefined;
    },
  });
  const report = await rig.run();
  assert.equal(step(report, "cleanup").ok, false);
  const linkedUids = rig.fake.users().filter((u) => rig.fake.providers(u).length > 0);
  assert.equal(linkedUids.length, 1, "the probe's account is still there because delete failed");

  // Sign the same player in again (a fresh code) and read the account back.
  const again = await rig.fake.fetchFn(`${IDENTITY_BASE}/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestUri: "http://localhost",
      postBody: `code=${encodeURIComponent("fake:fake-player:Dev%20Delver:2000")}&providerId=${PROVIDER}`,
      returnSecureToken: true,
      returnIdpCredential: true,
    }),
  });
  const { idToken, localId } = await again.json();
  assert.equal(localId, linkedUids[0]);
  const look = await rig.fake.fetchFn(`${IDENTITY_BASE}/accounts:lookup?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const user = (await look.json()).users[0];
  assert.equal(user.displayName, undefined, "the tamper step's displayName was cleared again");
  assert.equal(user.providerUserInfo[0].displayName, "Dev Delver");
});

/* ---------------- no secrets ---------------- */

test("probe: the report holds no token, auth code, full uid or player id", async () => {
  const rig = makeRig();
  const report = await rig.run();
  const text = JSON.stringify(report);
  assert.ok(rig.secrets.size > 0, "the rig did see tokens");
  for (const secret of rig.secrets) assert.ok(!text.includes(secret), "a minted token or code leaked into the report");
  assert.ok(!text.includes("fakeuid000001"), "no full uid");
  assert.ok(!text.includes("fake-player"), "no player id");
  assert.ok(text.includes("fakeui"), "uids appear as 6-character prefixes");
  assert.ok(!/idtok|rtok/.test(text));
  assert.equal(step(report, "lookup").facts.rawIdMatchesPlayer, true);
});

/* ---------------- failures never throw ---------------- */

const FAILING_OPS = [
  ["signInWithIdp", "idp-sign-in"],
  ["lookup", "lookup"],
  ["update", "tamper"],
  ["signUp", "second-link"],
  ["delete", "cleanup"],
];

for (const [op, stepId] of FAILING_OPS) {
  test(`probe: a failing ${op} call records ok false for ${stepId} and the probe still resolves`, async () => {
    const rig = makeRig({
      tweak: async ({ url }) => {
        if (hits(url, op)) throw new TypeError("Failed to fetch");
        return undefined;
      },
    });
    const report = await rig.run();
    assert.equal(step(report, stepId).ok, false, `${stepId} ok`);
    assert.deepEqual(report.steps.map((s) => s.id), STEP_IDS);
    for (const verdict of Object.values(report.gates)) assert.ok(["pass", "fail", "check", "skip"].includes(verdict), verdict);
  });
}

test("probe: a failing network on sign-in is 'check' for G4, not a verdict", async () => {
  const rig = makeRig({
    tweak: async ({ url }) => {
      if (hits(url, "signInWithIdp")) throw new TypeError("Failed to fetch");
      return undefined;
    },
  });
  const report = await rig.run();
  assert.equal(report.gates.G4, "check");
  assert.equal(step(report, "idp-sign-in").facts.error, "offline");
});

test("probe: never throws on a synchronously throwing fetchFn, a missing seam, or no arguments", async () => {
  const play = createFakePlayIdentity({});
  const a = await runPgsProbe({ playIdentity: play, fetchFn: () => { throw new Error("boom"); }, playConfig: PLAY_CONFIG });
  assert.equal(step(a, "idp-sign-in").ok, false);
  const b = await runPgsProbe({ fetchFn: () => {} });
  assert.equal(b.gates.A6, "fail");
  const c = await runPgsProbe();
  assert.equal(c.v, 1);
  assert.equal(c.gates.G4, "skip");
  assert.deepEqual(c.steps.map((s) => s.id), STEP_IDS);
  const d = await runPgsProbe({ playIdentity: { init: async () => { throw new Error("native exploded"); }, status: async () => { throw new Error("x"); } } });
  assert.equal(d.gates.A6, "fail");
});

test("probe: an unconfigured web client id cannot get an auth code and is a G4 fail", async () => {
  const rig = makeRig();
  const report = await rig.run({ playConfig: { appId: "517177834262", webClientId: "" } });
  assert.equal(report.gates.G4, "fail");
  assert.equal(step(report, "idp-sign-in").facts.error, "config");
});

/* ---------------- shape of the module ---------------- */

test("pgsProbe exports only runPgsProbe and stays off identity storage, the DOM and the console", () => {
  assert.deepEqual(Object.keys(probeModule), ["runPgsProbe"]);
  assert.equal((PROBE_SRC.match(/export async function runPgsProbe|export function runPgsProbe/g) || []).length, 1);
  const code = stripJs(PROBE_SRC);
  for (const banned of [/ddr\.identity/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bwindow\b/, /\bnavigator\b/, /\bconsole\./, /(?<![\w.])fetch\(/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.match(PROBE_SRC, /ddr\.identity/, "the header says it never touches ddr.identity.*");
});
