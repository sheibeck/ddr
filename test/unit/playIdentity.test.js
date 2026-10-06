// test/unit/playIdentity.test.js
//
// Phase 91.2 (BOARD-31/33, D-02/D-09/D-01): the JS seam over the PlayIdentity
// plugin (native + in-memory fake) and the shared config constants.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  createPlayIdentity,
  createFakePlayIdentity,
  PLAY_IDENTITY_REASONS,
} from "../../src/browser/playIdentity.js";
import {
  FIREBASE_CONFIG,
  PLAY_GAMES_CONFIG,
  playGamesConfigured,
  BOARD_NAME_FN,
} from "../../src/browser/firebaseConfig.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fake ───────────────────────────────────────────────────────────────────

test("fake: default status is signed in as the dev delver", async () => {
  const id = createFakePlayIdentity();
  assert.equal(id.kind, "fake");
  assert.deepEqual(await id.status(), {
    ok: true,
    signedIn: true,
    playerId: "fake-player",
    displayName: "Dev Delver",
  });
  assert.deepEqual(await id.init(), { ok: true });
});

test("fake: signed-out start, interactive signIn signs in; non-interactive stays out", async () => {
  const id = createFakePlayIdentity({ signedIn: false });
  assert.deepEqual(await id.status(), { ok: true, signedIn: false });
  const r = await id.signIn();
  assert.equal(r.ok, true);
  assert.equal(r.signedIn, true);
  assert.equal((await id.status()).signedIn, true);

  const quiet = createFakePlayIdentity({ signedIn: false, interactive: false });
  assert.deepEqual(await quiet.signIn(), { ok: true, signedIn: false });
  assert.deepEqual(await quiet.status(), { ok: true, signedIn: false });
});

test("fake: serverAuthCode is distinct per call, percent-encoded, denied while signed out, config on empty id", async () => {
  const id = createFakePlayIdentity({ playerId: "p 1", displayName: "A:B" });
  const a = await id.serverAuthCode({ serverClientId: "x" });
  const b = await id.serverAuthCode({ serverClientId: "x" });
  assert.deepEqual(a, { ok: true, authCode: `fake:${encodeURIComponent("p 1")}:${encodeURIComponent("A:B")}:1` });
  assert.equal(b.authCode, `fake:${encodeURIComponent("p 1")}:${encodeURIComponent("A:B")}:2`);
  assert.notEqual(a.authCode, b.authCode);

  assert.deepEqual(await id.serverAuthCode({ serverClientId: "" }), { ok: false, reason: "config" });
  assert.deepEqual(await id.serverAuthCode(), { ok: false, reason: "config" });

  id.setSignedIn(false);
  assert.deepEqual(await id.serverAuthCode({ serverClientId: "x" }), { ok: false, reason: "denied" });
});

test("fake: setPlayer changes status and the next code; calls() lists every call in order", async () => {
  const id = createFakePlayIdentity();
  await id.init();
  id.setPlayer("p2", "Other Name");
  assert.deepEqual(await id.status(), { ok: true, signedIn: true, playerId: "p2", displayName: "Other Name" });
  const code = await id.serverAuthCode({ serverClientId: "x" });
  assert.equal(code.authCode, "fake:p2:Other%20Name:1");
  const log = id.calls();
  assert.deepEqual(
    log.map((c) => c.method),
    ["init", "status", "serverAuthCode"],
  );
});

test("fake and native expose the same four methods and are frozen", () => {
  const fake = createFakePlayIdentity();
  const native = createPlayIdentity({ loadPlugin: async () => ({ plugin: {} }) });
  for (const m of ["init", "status", "signIn", "serverAuthCode"]) {
    assert.equal(typeof fake[m], "function", `fake.${m}`);
    assert.equal(typeof native[m], "function", `native.${m}`);
  }
  assert.equal(native.kind, "native");
  assert.ok(Object.isFrozen(fake));
  assert.ok(Object.isFrozen(native));
  assert.ok(Object.isFrozen(PLAY_IDENTITY_REASONS));
  assert.deepEqual([...PLAY_IDENTITY_REASONS], ["unavailable", "config", "denied", "error"]);
});

// ─── native ─────────────────────────────────────────────────────────────────

test("native: forwards each method and returns plain normalized objects", async () => {
  const seen = [];
  const plugin = {
    async init() {
      seen.push("init");
      return { ok: true };
    },
    async status() {
      seen.push("status");
      return { ok: true, signedIn: true, playerId: "P1", displayName: 42 };
    },
    async signIn() {
      seen.push("signIn");
      return { ok: true, signedIn: false };
    },
    async serverAuthCode(args) {
      seen.push(`code:${args.serverClientId}`);
      return { ok: true, authCode: "abc" };
    },
  };
  const id = createPlayIdentity({ loadPlugin: async () => ({ plugin }) });
  assert.deepEqual(await id.init(), { ok: true });
  assert.deepEqual(await id.status(), { ok: true, signedIn: true, playerId: "P1", displayName: "" });
  assert.deepEqual(await id.signIn(), { ok: true, signedIn: false });
  assert.deepEqual(await id.serverAuthCode({ serverClientId: "cid" }), { ok: true, authCode: "abc" });
  assert.deepEqual(seen, ["init", "status", "signIn", "code:cid"]);
});

test("native: a rejecting or throwing plugin method resolves { ok: false, reason: error }", async () => {
  const plugin = {
    async init() {
      throw new Error("boom");
    },
    status() {
      throw new Error("sync boom");
    },
    signIn() {
      return Promise.reject(new Error("no"));
    },
    async serverAuthCode() {
      return null;
    },
  };
  const id = createPlayIdentity({ loadPlugin: async () => ({ plugin }) });
  assert.deepEqual(await id.init(), { ok: false, reason: "error" });
  assert.deepEqual(await id.status(), { ok: false, reason: "error" });
  assert.deepEqual(await id.signIn(), { ok: false, reason: "error" });
  assert.deepEqual(await id.serverAuthCode({ serverClientId: "c" }), { ok: false, reason: "error" });
});

test("native: a plugin answering with an unknown reason is clamped to a known reason", async () => {
  const plugin = {
    async init() {
      return { ok: false, reason: "denied" };
    },
    async status() {
      return { ok: false, reason: "weird" };
    },
    async signIn() {
      return {};
    },
    async serverAuthCode() {
      return { ok: false, reason: "config" };
    },
  };
  const id = createPlayIdentity({ loadPlugin: async () => ({ plugin }) });
  assert.deepEqual(await id.init(), { ok: false, reason: "denied" });
  assert.deepEqual(await id.status(), { ok: false, reason: "error" });
  assert.deepEqual(await id.signIn(), { ok: false, reason: "error" });
  assert.deepEqual(await id.serverAuthCode({ serverClientId: "c" }), { ok: false, reason: "config" });
});

test("native: a rejecting loadPlugin resolves unavailable, and a bad load shape does too", async () => {
  const bad = createPlayIdentity({
    loadPlugin: async () => {
      throw new Error("no bridge");
    },
  });
  for (const m of ["init", "status", "signIn"]) {
    assert.deepEqual(await bad[m](), { ok: false, reason: "unavailable" });
  }
  assert.deepEqual(await bad.serverAuthCode({ serverClientId: "c" }), { ok: false, reason: "unavailable" });

  const empty = createPlayIdentity({ loadPlugin: async () => ({}) });
  assert.deepEqual(await empty.status(), { ok: false, reason: "unavailable" });
});

test("native: loadPlugin is called once across many calls (memoized)", async () => {
  let loads = 0;
  const plugin = { async init() { return { ok: true }; }, async status() { return { ok: true, signedIn: false }; } };
  const id = createPlayIdentity({
    loadPlugin: async () => {
      loads++;
      return { plugin };
    },
  });
  await id.init();
  await id.status();
  await id.status();
  assert.equal(loads, 1);
});

test("native: constructing loads nothing", () => {
  let loads = 0;
  createPlayIdentity({
    loadPlugin: async () => {
      loads++;
      return { plugin: {} };
    },
  });
  assert.equal(loads, 0);
});

test("native: a thenable plugin (a Capacitor Proxy) never gets awaited or returned", async () => {
  const plugin = {
    get then() {
      throw new Error("the plugin object was treated as a thenable");
    },
    async init() {
      return { ok: true };
    },
    async status() {
      return { ok: true, signedIn: false };
    },
    async signIn() {
      return { ok: true, signedIn: false };
    },
    async serverAuthCode() {
      return { ok: true, authCode: "z" };
    },
  };
  const id = createPlayIdentity({ loadPlugin: async () => ({ plugin }) });
  assert.deepEqual(await id.init(), { ok: true });
  assert.deepEqual(await id.status(), { ok: true, signedIn: false });
  assert.deepEqual(await id.signIn(), { ok: true, signedIn: false });
  assert.deepEqual(await id.serverAuthCode({ serverClientId: "c" }), { ok: true, authCode: "z" });
});

test("module source touches no window or document and names @capacitor/core only inside the loader", () => {
  const src = readFileSync(path.join(REPO_ROOT, "src", "browser", "playIdentity.js"), "utf8");
  const code = src
    .split(/\r?\n/)
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
  assert.ok(!/\bwindow\b|\bdocument\b/.test(code), "no DOM globals outside comments");
  assert.ok(/import\(\s*["']@capacitor\/core["']\s*\)/.test(code));
  assert.ok(!/^\s*import\s.*@capacitor/m.test(code), "no static capacitor import");
});

// ─── config ─────────────────────────────────────────────────────────────────

test("PLAY_GAMES_CONFIG carries the Game server web client; playGamesConfigured validates shape", () => {
  assert.ok(Object.isFrozen(PLAY_GAMES_CONFIG));
  assert.equal(PLAY_GAMES_CONFIG.appId, "517177834262");
  assert.equal(PLAY_GAMES_CONFIG.webClientId, "517177834262-869o2mk93v9n0fkqr4kvc8jues3khmfv.apps.googleusercontent.com");
  assert.equal(playGamesConfigured(PLAY_GAMES_CONFIG), true);

  const good = { appId: "517177834262", webClientId: "517177834262-abc123def456.apps.googleusercontent.com" };
  assert.equal(playGamesConfigured(good), true);
  assert.equal(playGamesConfigured({ ...good, webClientId: "not-a-client-id" }), false);
  assert.equal(playGamesConfigured({ ...good, webClientId: "517177834262-ABC.apps.googleusercontent.com" }), false);
  assert.equal(playGamesConfigured({ ...good, appId: "12345" }), false);
  assert.equal(playGamesConfigured({ ...good, appId: "abcdefgh" }), false);
  assert.equal(playGamesConfigured(null), false);
  assert.equal(playGamesConfigured("x"), false);
  assert.equal(playGamesConfigured(undefined), false);
});

test("the app_id in games-ids.xml (the Play Console export, Phase 101) equals PLAY_GAMES_CONFIG.appId (D-09)", () => {
  const xml = readFileSync(
    path.join(REPO_ROOT, "android", "app", "src", "main", "res", "values", "games-ids.xml"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const m = xml.match(/<string name="app_id"[^>]*>([^<]+)<\/string>/);
  assert.ok(m, "games-ids.xml carries app_id");
  assert.equal(m[1].trim(), PLAY_GAMES_CONFIG.appId);
});

test("BOARD_NAME_FN is the frozen boardName function URL in the Firebase project", () => {
  assert.ok(Object.isFrozen(BOARD_NAME_FN));
  assert.ok(BOARD_NAME_FN.url.startsWith("https://"));
  assert.ok(BOARD_NAME_FN.url.endsWith("/boardName"));
  assert.ok(BOARD_NAME_FN.url.includes(FIREBASE_CONFIG.projectId));
});
