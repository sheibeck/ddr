// test/unit/playGames.test.js
//
// Phase 67 (PGS-02, D-12): the Play Games provider seam. Proves the native
// provider (createPlayGames) and the in-memory fake (createFakePlayGames)
// share one four-method contract; that the native provider never loads the
// plugin until a method is called (D-02) and loads it at most once; that
// init() is the silent attempt and signIn() the explicit silent:false one
// (the plugin's own silent option defaults to true); that every method
// resolves and never rejects (D-01, D-11); that the identity is exactly
// { id, displayName } with no image URL (D-07); that there is no sign-out
// (D-03) and no Phase 68 leaderboard method yet; that the plugin sees only
// initialize/signIn/isSignedIn/getPlayer; and that the Capacitor proxy's
// thenable trap (nativeChrome.js#loadApp) can never fire.
//
// The real plugin is NOT installed in this plan (67-06 installs it); every
// test injects a recording fake through createPlayGames({ loadPlugin }).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import {
  PROVIDER_METHODS,
  RESERVED_LEADERBOARD_METHODS,
  FAKE_PLAYER,
  createPlayGames,
  createFakePlayGames,
} from "../../src/browser/playGames.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_PATH = path.join(REPO_ROOT, "src", "browser", "playGames.js");
const PLUGIN_NAME = "@modbender/capacitor-play-games";

const PLAYER_INFO = Object.freeze({
  playerId: "p1",
  displayName: "Lanternjaw",
  avatarUrl: "https://x",
  hiResImageUrl: "https://x/hi",
  bannerImageUrlLandscape: "https://x/bl",
  bannerImageUrlPortrait: "https://x/bp",
  title: "Sir",
  level: 3,
});

/**
 * fakePlugin(opts) — a recording stand-in for the plugin's PlayGames object.
 * Every method call is appended to `log` as [name, args]. Options pick each
 * method's outcome.
 */
function fakePlugin({
  signInResult = { signedIn: true, player: PLAYER_INFO },
  getPlayerResult = PLAYER_INFO,
  getPlayerRejects = false,
  initializeRejects = false,
  signInRejects = false,
  isSignedInResult = { signedIn: true },
  isSignedInRejects = false,
} = {}) {
  const log = [];
  const rec = (name, args) => log.push([name, args]);
  const plugin = {
    async initialize(...args) {
      rec("initialize", args);
      if (initializeRejects) throw new Error("initialize failed");
    },
    async signIn(...args) {
      rec("signIn", args);
      if (signInRejects) throw new Error("signIn failed");
      return signInResult;
    },
    async isSignedIn(...args) {
      rec("isSignedIn", args);
      if (isSignedInRejects) throw new Error("isSignedIn failed");
      return isSignedInResult;
    },
    async getPlayer(...args) {
      rec("getPlayer", args);
      if (getPlayerRejects) throw new Error("not signed in");
      return getPlayerResult;
    },
  };
  return { plugin, log, names: () => log.map(([n]) => n) };
}

/** A loader spy resolving a module namespace-shaped object. */
function loaderFor(plugin) {
  const spy = async () => {
    spy.count += 1;
    return { PlayGames: plugin };
  };
  spy.count = 0;
  return spy;
}

const SIGNED_OUT = { signedIn: false, player: null };

// --- contract shape -------------------------------------------------------

test("PROVIDER_METHODS is exactly the four provider methods, frozen", () => {
  assert.deepEqual(PROVIDER_METHODS, ["init", "isAuthenticated", "signIn", "getPlayer"]);
  assert.equal(Object.isFrozen(PROVIDER_METHODS), true);
});

test("RESERVED_LEADERBOARD_METHODS names the five Phase 68 plugin methods, frozen", () => {
  assert.deepEqual(RESERVED_LEADERBOARD_METHODS, [
    "submitScore",
    "loadTopScores",
    "loadPlayerCenteredScores",
    "loadCurrentPlayerScore",
    "loadFriends",
  ]);
  assert.equal(Object.isFrozen(RESERVED_LEADERBOARD_METHODS), true);
});

test("FAKE_PLAYER is a frozen { id, displayName }", () => {
  assert.deepEqual(FAKE_PLAYER, { id: "fake-player", displayName: "Dev Delver" });
  assert.equal(Object.isFrozen(FAKE_PLAYER), true);
});

test("both providers are frozen and expose exactly the four PROVIDER_METHODS as functions (the fake adds calls())", () => {
  const native = createPlayGames({ loadPlugin: loaderFor(fakePlugin().plugin) });
  const fake = createFakePlayGames();
  assert.equal(Object.isFrozen(native), true);
  assert.equal(Object.isFrozen(fake), true);

  const fnKeys = (o) => Object.keys(o).filter((k) => typeof o[k] === "function").sort();
  assert.deepEqual(fnKeys(native), [...PROVIDER_METHODS].sort());
  assert.deepEqual(fnKeys(fake), [...PROVIDER_METHODS, "calls"].sort());
  assert.equal(native.kind, "native");
  assert.equal(fake.kind, "fake");
});

test("no sign-out (D-03) and no Phase 68 leaderboard method on either provider", () => {
  const native = createPlayGames({ loadPlugin: loaderFor(fakePlugin().plugin) });
  const fake = createFakePlayGames();
  for (const p of [native, fake]) {
    for (const k of ["signOut", "signout", "disconnect", ...RESERVED_LEADERBOARD_METHODS]) {
      assert.equal(k in p, false, `${p.kind} provider must not have ${k}`);
    }
  }
});

// --- laziness (D-02) -------------------------------------------------------

test("createPlayGames never loads the plugin until a method runs, then loads it exactly once", async () => {
  const { plugin } = fakePlugin();
  const spy = loaderFor(plugin);
  const pg = createPlayGames({ loadPlugin: spy });
  assert.equal(spy.count, 0, "constructing the provider must not load the plugin");

  await pg.init();
  assert.equal(spy.count, 1);
  await pg.signIn();
  await pg.isAuthenticated();
  await pg.getPlayer();
  await Promise.all([pg.init(), pg.getPlayer(), pg.isAuthenticated()]);
  assert.equal(spy.count, 1, "the loader is memoized across every call");
});

test("initialize() runs once per provider, memoized across init/signIn/isAuthenticated/getPlayer", async () => {
  const f = fakePlugin();
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  await pg.init();
  await pg.signIn();
  await pg.isAuthenticated();
  await pg.getPlayer();
  assert.equal(f.names().filter((n) => n === "initialize").length, 1);
});

// --- init(): the silent launch attempt --------------------------------------

test("init() calls initialize() then signIn({ silent: true }) and normalizes the player", async () => {
  const f = fakePlugin();
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  const result = await pg.init();
  assert.deepEqual(result, { signedIn: true, player: { id: "p1", displayName: "Lanternjaw" } });
  assert.deepEqual(Object.keys(result.player).sort(), ["displayName", "id"]);
  assert.deepEqual(f.names(), ["initialize", "signIn"]);
  assert.deepEqual(f.log[1][1], [{ silent: true }]);
});

test("init() signed in without a player falls back to getPlayer(); a getPlayer rejection resolves player null", async () => {
  const ok = fakePlugin({ signInResult: { signedIn: true } });
  const r1 = await createPlayGames({ loadPlugin: loaderFor(ok.plugin) }).init();
  assert.deepEqual(r1, { signedIn: true, player: { id: "p1", displayName: "Lanternjaw" } });
  assert.deepEqual(ok.names(), ["initialize", "signIn", "getPlayer"]);

  const bad = fakePlugin({ signInResult: { signedIn: true }, getPlayerRejects: true });
  const r2 = await createPlayGames({ loadPlugin: loaderFor(bad.plugin) }).init();
  assert.deepEqual(r2, { signedIn: true, player: null });
});

test("init() signed out resolves { signedIn: false, player: null } and never calls getPlayer", async () => {
  const f = fakePlugin({ signInResult: { signedIn: false } });
  const result = await createPlayGames({ loadPlugin: loaderFor(f.plugin) }).init();
  assert.deepEqual(result, SIGNED_OUT);
  assert.equal(f.names().includes("getPlayer"), false);
});

test("init() resolves signed out on a loader rejection, and a later call tries the loader again", async () => {
  const { plugin } = fakePlugin();
  let attempts = 0;
  const loadPlugin = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("module not found");
    return { PlayGames: plugin };
  };
  const pg = createPlayGames({ loadPlugin });
  assert.deepEqual(await pg.init(), SIGNED_OUT);
  assert.equal(attempts, 1);
  const second = await pg.init();
  assert.equal(attempts, 2, "the failed load is not memoized");
  assert.equal(second.signedIn, true);
});

test("init() resolves signed out when initialize() rejects, and retries initialize() next time", async () => {
  const f = fakePlugin({ initializeRejects: true });
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  assert.deepEqual(await pg.init(), SIGNED_OUT);
  assert.deepEqual(await pg.init(), SIGNED_OUT);
  assert.equal(f.names().filter((n) => n === "initialize").length, 2);
  assert.equal(f.names().includes("signIn"), false);
});

test("init() resolves signed out when signIn rejects", async () => {
  const f = fakePlugin({ signInRejects: true });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(f.plugin) }).init(), SIGNED_OUT);
});

test("init() resolves signed out when the loaded module has no PlayGames export or signIn returns garbage", async () => {
  const empty = createPlayGames({ loadPlugin: async () => ({}) });
  assert.deepEqual(await empty.init(), SIGNED_OUT);
  const garbage = fakePlugin({ signInResult: null });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(garbage.plugin) }).init(), SIGNED_OUT);
});

test("a loader that throws synchronously still resolves signed out", async () => {
  const pg = createPlayGames({
    loadPlugin: () => {
      throw new Error("sync boom");
    },
  });
  assert.deepEqual(await pg.init(), SIGNED_OUT);
  assert.deepEqual(await pg.signIn(), SIGNED_OUT);
  assert.equal(await pg.isAuthenticated(), false);
  assert.equal(await pg.getPlayer(), null);
});

// --- signIn(): the interactive attempt ---------------------------------------

test("signIn() calls initialize() then signIn with silent explicitly false", async () => {
  const f = fakePlugin();
  const result = await createPlayGames({ loadPlugin: loaderFor(f.plugin) }).signIn();
  assert.deepEqual(result, { signedIn: true, player: { id: "p1", displayName: "Lanternjaw" } });
  assert.deepEqual(f.names(), ["initialize", "signIn"]);
  const opts = f.log[1][1][0];
  assert.equal(Object.hasOwn(opts, "silent"), true, "the silent key must be present (the plugin defaults it to true)");
  assert.equal(opts.silent, false);
});

test("signIn() resolves signed out on a decline or a rejection", async () => {
  const declined = fakePlugin({ signInResult: { signedIn: false } });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(declined.plugin) }).signIn(), SIGNED_OUT);
  const rejected = fakePlugin({ signInRejects: true });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(rejected.plugin) }).signIn(), SIGNED_OUT);
});

// --- isAuthenticated() / getPlayer() -------------------------------------------

test("isAuthenticated() resolves true/false from isSignedIn(); a rejection resolves false", async () => {
  const yes = fakePlugin({ isSignedInResult: { signedIn: true } });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(yes.plugin) }).isAuthenticated(), true);
  const no = fakePlugin({ isSignedInResult: { signedIn: false } });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(no.plugin) }).isAuthenticated(), false);
  const truthy = fakePlugin({ isSignedInResult: { signedIn: "yes" } });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(truthy.plugin) }).isAuthenticated(), false);
  const bad = fakePlugin({ isSignedInRejects: true });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(bad.plugin) }).isAuthenticated(), false);
});

test("getPlayer() resolves the normalized identity, or null when the plugin rejects", async () => {
  const ok = fakePlugin();
  const player = await createPlayGames({ loadPlugin: loaderFor(ok.plugin) }).getPlayer();
  assert.deepEqual(player, { id: "p1", displayName: "Lanternjaw" });
  assert.equal(Object.isFrozen(player), true);
  const bad = fakePlugin({ getPlayerRejects: true });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(bad.plugin) }).getPlayer(), null);
});

test("identity normalization: trims strings, whitespace-only names become \"\", non-strings become \"\", no image URL survives (D-07)", async () => {
  const cases = [
    [{ playerId: "  p9 ", displayName: "  Moss  ", avatarUrl: "https://a" }, { id: "p9", displayName: "Moss" }],
    [{ playerId: "p2", displayName: "   " }, { id: "p2", displayName: "" }],
    [{ playerId: 42, displayName: null }, { id: "", displayName: "" }],
  ];
  for (const [info, expected] of cases) {
    const f = fakePlugin({ getPlayerResult: info });
    const got = await createPlayGames({ loadPlugin: loaderFor(f.plugin) }).getPlayer();
    assert.deepEqual(got, expected);
  }
  const nonObject = fakePlugin({ getPlayerResult: "p1" });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(nonObject.plugin) }).getPlayer(), null);
});

// --- never touches telemetry, never trips the thenable trap ---------------------

test("across every method the plugin sees only initialize, signIn, isSignedIn and getPlayer", async () => {
  const f = fakePlugin({ signInResult: { signedIn: true } });
  const touched = new Set();
  const recording = new Proxy(f.plugin, {
    get(target, key) {
      touched.add(String(key));
      return target[key];
    },
  });
  const pg = createPlayGames({ loadPlugin: loaderFor(recording) });
  await pg.init();
  await pg.signIn();
  await pg.isAuthenticated();
  await pg.getPlayer();
  const allowed = new Set(["initialize", "signIn", "isSignedIn", "getPlayer"]);
  for (const k of touched) assert.equal(allowed.has(k), true, `the provider touched plugin.${k}`);
});

test("a plugin proxy whose 'then' throws (the Capacitor thenable trap) works through all four methods", async () => {
  const f = fakePlugin({ signInResult: { signedIn: true } });
  const trap = new Proxy(f.plugin, {
    get(target, key) {
      if (key === "then") throw new Error("PlayGames.then() is not implemented on android");
      return target[key];
    },
  });
  const pg = createPlayGames({ loadPlugin: loaderFor(trap) });
  assert.deepEqual(await pg.init(), { signedIn: true, player: { id: "p1", displayName: "Lanternjaw" } });
  assert.deepEqual(await pg.signIn(), { signedIn: true, player: { id: "p1", displayName: "Lanternjaw" } });
  assert.equal(await pg.isAuthenticated(), true);
  assert.deepEqual(await pg.getPlayer(), { id: "p1", displayName: "Lanternjaw" });
});

test("a loader resolving the bare proxy module (then trap on the namespace's plugin) never adopts the proxy", async () => {
  // The module namespace itself is a plain object; only its PlayGames is the
  // trap. A provider that returned PlayGames from an async function would
  // reject here with the trap's error instead of resolving signed in.
  const f = fakePlugin();
  let thenReads = 0;
  const trap = new Proxy(f.plugin, {
    get(target, key) {
      if (key === "then") {
        thenReads += 1;
        return (resolve, reject) => reject(new Error("then forwarded to native"));
      }
      return target[key];
    },
  });
  const pg = createPlayGames({ loadPlugin: loaderFor(trap) });
  assert.equal((await pg.init()).signedIn, true);
  assert.equal(await pg.isAuthenticated(), true);
  assert.equal(thenReads, 0);
});

// --- the fake provider --------------------------------------------------------

test("fake: default init() resolves signed out; { signedIn: true } resolves FAKE_PLAYER", async () => {
  assert.deepEqual(await createFakePlayGames().init(), SIGNED_OUT);
  assert.equal(await createFakePlayGames().isAuthenticated(), false);
  assert.equal(await createFakePlayGames().getPlayer(), null);

  const seeded = createFakePlayGames({ signedIn: true });
  assert.deepEqual(await seeded.init(), { signedIn: true, player: FAKE_PLAYER });
  assert.equal(await seeded.isAuthenticated(), true);
  assert.deepEqual(await seeded.getPlayer(), FAKE_PLAYER);
});

test("fake: signIn() accepts by default and signs in; \"decline\" stays signed out", async () => {
  const accept = createFakePlayGames();
  assert.deepEqual(await accept.signIn(), { signedIn: true, player: FAKE_PLAYER });
  assert.equal(await accept.isAuthenticated(), true);
  assert.deepEqual(await accept.init(), { signedIn: true, player: FAKE_PLAYER });

  const decline = createFakePlayGames({ interactive: "decline" });
  assert.deepEqual(await decline.signIn(), SIGNED_OUT);
  assert.equal(await decline.isAuthenticated(), false);
  assert.equal(await decline.getPlayer(), null);
});

test("fake: a custom player is used as given; calls() is the ordered, frozen method log", async () => {
  const me = { id: "me", displayName: "Grimsby" };
  const fake = createFakePlayGames({ player: me });
  await fake.init();
  await fake.signIn();
  await fake.getPlayer();
  await fake.isAuthenticated();
  const calls = fake.calls();
  assert.deepEqual(calls, ["init", "signIn", "getPlayer", "isAuthenticated"]);
  assert.equal(Object.isFrozen(calls), true);
  assert.deepEqual(await fake.getPlayer(), me);
  assert.equal(fake.calls().length, 5, "calls() returns a copy; the log keeps growing");
  assert.equal(calls.length, 4);
});

// --- source pins ---------------------------------------------------------------

const CODE = stripJs(fs.readFileSync(MODULE_PATH, "utf8"));

test("source: exactly one dynamic import, of the plugin package, and no static import of it", () => {
  const dynamic = CODE.match(/\bimport\s*\(/g) || [];
  assert.equal(dynamic.length, 1);
  assert.match(CODE, /import\("@modbender\/capacitor-play-games"\)/);
  assert.doesNotMatch(CODE, /^\s*import\s[^(]*from\s*["']@modbender\//m);
  assert.doesNotMatch(CODE, /^\s*import\s+["']@modbender\//m);
  assert.equal(CODE.split(PLUGIN_NAME).length - 1, 1, "the package name appears exactly once in code");
});

test("source: no network identifier, no window./document. reference, no __mz bridge", () => {
  assert.doesNotMatch(CODE, /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/);
  assert.doesNotMatch(CODE, /\bwindow\./);
  assert.doesNotMatch(CODE, /\bdocument\./);
  assert.doesNotMatch(CODE, /__mz/);
});

test("source: every PlayGames method call is one of initialize/signIn/isSignedIn/getPlayer", () => {
  const called = [...CODE.matchAll(/PlayGames\.(\w+)\s*\(/g)].map((m) => m[1]);
  assert.ok(called.length >= 4, `expected at least four plugin call sites, found ${called.length}`);
  for (const name of called) {
    assert.ok(["initialize", "signIn", "isSignedIn", "getPlayer"].includes(name), `unexpected plugin call ${name}`);
  }
});

test("source: no other src/browser module names the plugin package", () => {
  const dir = path.join(REPO_ROOT, "src", "browser");
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js") || file === "playGames.js") continue;
    const text = stripJs(fs.readFileSync(path.join(dir, file), "utf8"));
    assert.equal(text.includes(PLUGIN_NAME), false, `src/browser/${file} names the plugin`);
  }
});
