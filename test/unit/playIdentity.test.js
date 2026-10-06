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
  PLAY_ACHIEVEMENT_REASONS,
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

test("fake and native expose the same six Play Games methods and are frozen (Phase 101-01 adds the achievement pair)", () => {
  const fake = createFakePlayIdentity();
  const native = createPlayIdentity({ loadPlugin: async () => ({ plugin: {} }) });
  for (const m of ["init", "status", "signIn", "serverAuthCode", "syncAchievements", "showAchievements"]) {
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

// ─── Phase 101-01: the achievement pair (PGS-07, AUI-04) ────────────────────

const OPS = [
  { kind: "unlock", resource: "achievement_chicken" },
  { kind: "steps", resource: "achievement_downward_mobility_i", n: 3 },
  { kind: "reveal", resource: "achievement_death_falling" },
];

test("PLAY_ACHIEVEMENT_REASONS is the frozen closed set; PLAY_IDENTITY_REASONS is unchanged", () => {
  assert.ok(Object.isFrozen(PLAY_ACHIEVEMENT_REASONS));
  assert.deepEqual([...PLAY_ACHIEVEMENT_REASONS], ["unavailable", "signin", "network", "unknown", "type", "config", "error"]);
  assert.deepEqual([...PLAY_IDENTITY_REASONS], ["unavailable", "config", "denied", "error"]);
});

test("native: syncAchievements forwards { ops } and normalizes the per-op results", async () => {
  const seen = [];
  const plugin = {
    async syncAchievements(args) {
      seen.push(args);
      return {
        ok: true,
        results: [
          { i: 0, ok: true },
          { i: 1, ok: false, reason: "network" },
          { i: 2, ok: false, reason: "weird" }, // unknown reason clamps to error
          { i: 3, ok: true }, // outside the 3-op batch: dropped
          { i: "1", ok: true }, // not an integer: dropped
          { i: 1.5, ok: true }, // not an integer: dropped
          { i: -1, ok: true }, // negative: dropped
          { i: 0, ok: "yes" }, // ok not a boolean: dropped
          null,
          "x",
        ],
      };
    },
  };
  const id = createPlayIdentity({ loadPlugin: async () => ({ plugin }) });
  const out = await id.syncAchievements({ ops: OPS });
  assert.deepEqual(seen, [{ ops: OPS }]);
  assert.deepEqual(out, {
    ok: true,
    results: [
      { i: 0, ok: true },
      { i: 1, ok: false, reason: "network" },
      { i: 2, ok: false, reason: "error" },
    ],
  });
  assert.ok(Object.isFrozen(out));
});

test("native: syncAchievements clamps whole-call reasons and turns every other shape into error", async () => {
  const answers = [
    [{ ok: false, reason: "signin" }, { ok: false, reason: "signin" }],
    [{ ok: false, reason: "weird" }, { ok: false, reason: "error" }],
    [{ ok: false }, { ok: false, reason: "error" }],
    [{ ok: true }, { ok: false, reason: "error" }], // ok without a results array
    [{ ok: true, results: "nope" }, { ok: false, reason: "error" }],
    [{}, { ok: false, reason: "error" }],
    [null, { ok: false, reason: "error" }],
    ["text", { ok: false, reason: "error" }],
  ];
  for (const [raw, want] of answers) {
    const id = createPlayIdentity({ loadPlugin: async () => ({ plugin: { async syncAchievements() { return raw; } } }) });
    assert.deepEqual(await id.syncAchievements({ ops: OPS }), want);
  }
  const rejecting = createPlayIdentity({ loadPlugin: async () => ({ plugin: { syncAchievements() { throw new Error("boom"); } } }) });
  assert.deepEqual(await rejecting.syncAchievements({ ops: OPS }), { ok: false, reason: "error" });
  const rejecting2 = createPlayIdentity({ loadPlugin: async () => ({ plugin: { syncAchievements: () => Promise.reject(new Error("no")) } }) });
  assert.deepEqual(await rejecting2.syncAchievements({ ops: OPS }), { ok: false, reason: "error" });
  const noOps = createPlayIdentity({ loadPlugin: async () => ({ plugin: { async syncAchievements() { return { ok: true, results: [{ i: 0, ok: true }] }; } } }) });
  assert.deepEqual(await noOps.syncAchievements(), { ok: true, results: [] }, "no batch: no entry is inside it");
});

test("native: a failed plugin load answers unavailable for both achievement methods", async () => {
  const bad = createPlayIdentity({
    loadPlugin: async () => {
      throw new Error("no bridge");
    },
  });
  assert.deepEqual(await bad.syncAchievements({ ops: OPS }), { ok: false, reason: "unavailable" });
  assert.deepEqual(await bad.showAchievements(), { ok: false, reason: "unavailable" });
});

test("native: showAchievements forwards, keeps ok, clamps reasons and turns other shapes into error", async () => {
  let calls = 0;
  const plugin = {
    async showAchievements() {
      calls++;
      return { ok: true, extra: "ignored" };
    },
  };
  const id = createPlayIdentity({ loadPlugin: async () => ({ plugin }) });
  assert.deepEqual(await id.showAchievements(), { ok: true });
  assert.equal(calls, 1);

  const answers = [
    [{ ok: false, reason: "signin" }, { ok: false, reason: "signin" }],
    [{ ok: false, reason: "weird" }, { ok: false, reason: "error" }],
    [{ ok: false, reason: "denied" }, { ok: false, reason: "error" }], // an identity reason, not an achievement one
    [{}, { ok: false, reason: "error" }],
    [null, { ok: false, reason: "error" }],
    [7, { ok: false, reason: "error" }],
  ];
  for (const [raw, want] of answers) {
    const one = createPlayIdentity({ loadPlugin: async () => ({ plugin: { async showAchievements() { return raw; } } }) });
    assert.deepEqual(await one.showAchievements(), want);
  }
  const throwing = createPlayIdentity({ loadPlugin: async () => ({ plugin: { showAchievements() { throw new Error("x"); } } }) });
  assert.deepEqual(await throwing.showAchievements(), { ok: false, reason: "error" });
});

test("native: the thenable-plugin rule holds for the achievement pair", async () => {
  const plugin = {
    get then() {
      throw new Error("the plugin object was treated as a thenable");
    },
    async syncAchievements() {
      return { ok: true, results: [{ i: 0, ok: true }] };
    },
    async showAchievements() {
      return { ok: true };
    },
  };
  const id = createPlayIdentity({ loadPlugin: async () => ({ plugin }) });
  assert.deepEqual(await id.syncAchievements({ ops: [OPS[0]] }), { ok: true, results: [{ i: 0, ok: true }] });
  assert.deepEqual(await id.showAchievements(), { ok: true });
});

test("fake: both achievement methods are recorded in calls()", async () => {
  const fake = createFakePlayIdentity();
  await fake.syncAchievements({ ops: OPS });
  await fake.showAchievements();
  assert.deepEqual(fake.calls(), [{ method: "syncAchievements", args: { ops: OPS } }, { method: "showAchievements" }]);
});

test("fake: signed out, both achievement methods answer signin", async () => {
  const fake = createFakePlayIdentity({ signedIn: false });
  assert.deepEqual(await fake.syncAchievements({ ops: OPS }), { ok: false, reason: "signin" });
  assert.deepEqual(await fake.showAchievements(), { ok: false, reason: "signin" });
  // Neither signs the player in.
  assert.deepEqual(await fake.status(), { ok: true, signedIn: false });
  assert.equal(fake.calls().length, 3);
});

test("fake: signed in, syncAchievements answers one ok entry per op for a 1 to 20 op batch; show answers ok", async () => {
  const fake = createFakePlayIdentity();
  assert.deepEqual(await fake.syncAchievements({ ops: OPS }), {
    ok: true,
    results: [
      { i: 0, ok: true },
      { i: 1, ok: true },
      { i: 2, ok: true },
    ],
  });
  const twenty = Array.from({ length: 20 }, (_, k) => ({ kind: "unlock", resource: `achievement_x${k}` }));
  const out = await fake.syncAchievements({ ops: twenty });
  assert.equal(out.ok, true);
  assert.equal(out.results.length, 20);
  assert.deepEqual(await fake.showAchievements(), { ok: true });
});

test("fake: a missing, empty or over-long batch answers error", async () => {
  const fake = createFakePlayIdentity();
  const twentyOne = Array.from({ length: 21 }, (_, k) => ({ kind: "unlock", resource: `achievement_x${k}` }));
  for (const arg of [undefined, {}, { ops: [] }, { ops: "x" }, { ops: twentyOne }]) {
    assert.deepEqual(await fake.syncAchievements(arg), { ok: false, reason: "error" });
  }
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
