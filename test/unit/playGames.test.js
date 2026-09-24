// test/unit/playGames.test.js
//
// Phase 67 (PGS-02, D-12): the Play Games provider seam. Proves the native
// provider (createPlayGames) and the in-memory fake (createFakePlayGames)
// share one contract; that the native provider never loads the plugin until
// a method is called (D-02) and loads it at most once; that init() is the
// silent attempt and signIn() the explicit silent:false one (the plugin's own
// silent option defaults to true); that every method resolves and never
// rejects (D-01, D-11); that the identity is exactly { id, displayName } with
// no image URL (D-07); that there is no sign-out (D-03); that the plugin sees
// only PLUGIN_METHODS_USED; and that the Capacitor proxy's thenable trap
// (nativeChrome.js#loadApp) can never fire.
//
// Phase 68 (PGS-03..05): the five leaderboard methods. submitScore validates
// before touching the plugin and reports the all-time newBest (D-01); the
// top-score and player-score reads use the all-time window of the public or
// friends collection with maxResults clamped to 1..25 and scores normalized
// to { rank, rawScore, tag, handle, playerId, friend } (D-05, D-06);
// loadStanding reads the DEEPEST rank and count (D-10); friendsAccess only
// shows consent on request: true (D-06); and every leaderboard call but the
// consent request times out to its failure shape (D-07). The fake keeps an
// in-memory best-score store with offline, consent and ordering switches.
//
// Every test injects a recording fake through createPlayGames({ loadPlugin });
// the real plugin is never loaded.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import {
  PROVIDER_METHODS,
  PLUGIN_METHODS_USED,
  FAKE_PLAYER,
  normalizeScore,
  createPlayGames,
  createFakePlayGames,
} from "../../src/browser/playGames.js";
import * as playGamesModule from "../../src/browser/playGames.js";

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

/** A plugin LeaderboardScore with every field the SDK attaches. */
function rawScore({ rank = 1, rawScore: raw = 6999569, tag = "t", name = "Rival", playerId = "r1", friendStatus } = {}) {
  return {
    rank,
    displayRank: `${rank}`,
    rawScore: raw,
    displayScore: `${raw}`,
    achievedAt: 1,
    scoreTag: tag,
    scoreHolder: { playerId, displayName: name, avatarUrl: "https://a", friendStatus },
    scoreHolderDisplayName: name,
    scoreHolderIconImageUrl: "https://b",
    scoreHolderHiResImageUrl: "https://c",
  };
}

/** A plugin Leaderboard with all-time public and friends variants. */
function rawBoard({ publicRank = 3, publicCount = 9044, friendsCount = 4 } = {}) {
  return {
    leaderboardId: "L1",
    displayName: "Deepest",
    iconImageUrl: "https://i",
    scoreOrder: "largerIsBetter",
    variants: [
      { timeSpan: "daily", collection: "public", hasPlayerInfo: true, playerRank: 1, numScores: 7 },
      { timeSpan: "allTime", collection: "public", hasPlayerInfo: true, playerRank: publicRank, numScores: publicCount },
      { timeSpan: "allTime", collection: "friends", hasPlayerInfo: true, playerRank: 1, numScores: friendsCount },
    ],
  };
}

const LEADERBOARD_DEFAULTS = Object.freeze({
  submitScore: { leaderboardId: "L1", playerId: "p1", results: [{ timeSpan: "allTime", rawScore: 1, formattedScore: "1", scoreTag: "t", newBest: true }] },
  loadTopScores: { leaderboard: rawBoard(), scores: [rawScore()], stale: false },
  loadCurrentPlayerScore: { score: rawScore({ rank: 3, name: "Lanternjaw", playerId: "p1" }), stale: false },
  loadLeaderboard: { leaderboard: rawBoard(), stale: false },
  loadFriends: { friends: [], stale: false, resolutionRequired: false },
});

/**
 * fakePlugin(opts) — a recording stand-in for the plugin's PlayGames object.
 * Every method call is appended to `log` as [name, args]. Options pick each
 * method's outcome. The five leaderboard methods take `results` (a map of
 * resolved values, overriding LEADERBOARD_DEFAULTS), `rejects` (names that
 * reject) and `hangs` (names that never settle until `settle(name, value)`).
 */
function fakePlugin({
  signInResult = { signedIn: true, player: PLAYER_INFO },
  getPlayerResult = PLAYER_INFO,
  getPlayerRejects = false,
  initializeRejects = false,
  signInRejects = false,
  isSignedInResult = { signedIn: true },
  isSignedInRejects = false,
  results = {},
  rejects = [],
  hangs = [],
} = {}) {
  const log = [];
  const rec = (name, args) => log.push([name, args]);
  const pending = new Map();
  const leaderboard = (name) =>
    async function (...args) {
      rec(name, args);
      if (rejects.includes(name)) throw new Error(`${name} failed`);
      if (hangs.includes(name)) return new Promise((resolve) => pending.set(name, resolve));
      return Object.hasOwn(results, name) ? results[name] : LEADERBOARD_DEFAULTS[name];
    };
  const plugin = {
    submitScore: leaderboard("submitScore"),
    loadTopScores: leaderboard("loadTopScores"),
    loadCurrentPlayerScore: leaderboard("loadCurrentPlayerScore"),
    loadLeaderboard: leaderboard("loadLeaderboard"),
    loadFriends: leaderboard("loadFriends"),
    // Never called by the provider: present so a stray call would be caught.
    loadPlayerCenteredScores: leaderboard("loadPlayerCenteredScores"),
    submitEvent: leaderboard("submitEvent"),
    getCurrentPlayerStats: leaderboard("getCurrentPlayerStats"),
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
  const settle = (name, value) => {
    const resolve = pending.get(name);
    if (resolve) resolve(value);
  };
  const argsOf = (name) => log.filter(([n]) => n === name).map(([, a]) => a);
  return { plugin, log, names: () => log.map(([n]) => n), settle, argsOf };
}

/** A manual timer: setTimer records, fire() runs every pending callback. */
function manualTimer() {
  const pending = new Map();
  let next = 0;
  return {
    setTimer(fn, ms) {
      next += 1;
      pending.set(next, { fn, ms });
      return next;
    },
    clearTimer(id) {
      pending.delete(id);
    },
    fire() {
      for (const [id, { fn }] of [...pending]) {
        pending.delete(id);
        fn();
      }
    },
    size: () => pending.size,
    delays: () => [...pending.values()].map((p) => p.ms),
  };
}

/** Let queued microtasks (ready(), the plugin call) run. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

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

test("PROVIDER_METHODS is exactly the nine provider methods, frozen", () => {
  assert.deepEqual(PROVIDER_METHODS, [
    "init",
    "isAuthenticated",
    "signIn",
    "getPlayer",
    "submitScore",
    "loadTopScores",
    "loadPlayerScore",
    "loadStanding",
    "friendsAccess",
  ]);
  assert.equal(Object.isFrozen(PROVIDER_METHODS), true);
});

test("PLUGIN_METHODS_USED is exactly the nine plugin methods ever called, frozen; the retired reserved list is gone", () => {
  assert.deepEqual(PLUGIN_METHODS_USED, [
    "initialize",
    "signIn",
    "isSignedIn",
    "getPlayer",
    "submitScore",
    "loadTopScores",
    "loadCurrentPlayerScore",
    "loadLeaderboard",
    "loadFriends",
  ]);
  assert.equal(Object.isFrozen(PLUGIN_METHODS_USED), true);
  const exported = Object.keys(playGamesModule);
  assert.equal(exported.some((k) => /RESERVED/.test(k)), false, "no reserved-method list is exported any more");
});

test("FAKE_PLAYER is a frozen { id, displayName }", () => {
  assert.deepEqual(FAKE_PLAYER, { id: "fake-player", displayName: "Dev Delver" });
  assert.equal(Object.isFrozen(FAKE_PLAYER), true);
});

const fnKeys = (o) => Object.keys(o).filter((k) => typeof o[k] === "function").sort();

test("the native provider is frozen and exposes exactly the nine PROVIDER_METHODS as functions, kind native", () => {
  const native = createPlayGames({ loadPlugin: loaderFor(fakePlugin().plugin) });
  assert.equal(Object.isFrozen(native), true);
  assert.deepEqual(fnKeys(native), [...PROVIDER_METHODS].sort());
  assert.equal(native.kind, "native");
});

test("no sign-out (D-03) and no raw plugin-only leaderboard name on either provider", () => {
  const native = createPlayGames({ loadPlugin: loaderFor(fakePlugin().plugin) });
  const fake = createFakePlayGames();
  const forbidden = [
    "signOut",
    "signout",
    "disconnect",
    "loadCurrentPlayerScore",
    "loadLeaderboard",
    "loadFriends",
    "loadPlayerCenteredScores",
  ];
  for (const p of [native, fake]) {
    for (const k of forbidden) assert.equal(k in p, false, `${p.kind} provider must not have ${k}`);
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

/** exerciseAll(pg) — every provider method once, including both consent paths. */
async function exerciseAll(pg) {
  await pg.init();
  await pg.signIn();
  await pg.isAuthenticated();
  await pg.getPlayer();
  await pg.submitScore({ leaderboardId: "L1", score: 5, tag: "t" });
  await pg.loadTopScores({ leaderboardId: "L1", collection: "public", maxResults: 10 });
  await pg.loadTopScores({ leaderboardId: "L1", collection: "friends", maxResults: 10 });
  await pg.loadPlayerScore({ leaderboardId: "L1", collection: "public" });
  await pg.loadStanding({ leaderboardId: "L1" });
  await pg.friendsAccess({ request: false });
  await pg.friendsAccess({ request: true });
}

test("across every method the plugin sees only PLUGIN_METHODS_USED (nothing telemetry-shaped)", async () => {
  const f = fakePlugin({ signInResult: { signedIn: true } });
  const touched = new Set();
  const recording = new Proxy(f.plugin, {
    get(target, key) {
      touched.add(String(key));
      return target[key];
    },
  });
  const pg = createPlayGames({ loadPlugin: loaderFor(recording) });
  await exerciseAll(pg);
  const allowed = new Set(PLUGIN_METHODS_USED);
  for (const k of touched) assert.equal(allowed.has(k), true, `the provider touched plugin.${k}`);
  for (const name of f.names()) assert.equal(allowed.has(name), true, `the provider called plugin.${name}`);
  for (const name of ["submitScore", "loadTopScores", "loadCurrentPlayerScore", "loadLeaderboard", "loadFriends"]) {
    assert.equal(f.names().includes(name), true, `plugin.${name} was exercised`);
  }
});

test("a plugin proxy whose 'then' throws (the Capacitor thenable trap) works through all nine methods", async () => {
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
  assert.deepEqual(await pg.submitScore({ leaderboardId: "L1", score: 5, tag: "t" }), { ok: true, newBest: true });
  assert.equal((await pg.loadTopScores({ leaderboardId: "L1", collection: "public", maxResults: 10 })).ok, true);
  assert.equal((await pg.loadPlayerScore({ leaderboardId: "L1", collection: "public" })).ok, true);
  assert.deepEqual(await pg.loadStanding({ leaderboardId: "L1" }), { ok: true, rank: 3, total: 9044 });
  assert.equal(await pg.friendsAccess({ request: false }), "granted");
  assert.equal(await pg.friendsAccess({ request: true }), "granted");
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

// --- Phase 68: normalizeScore ------------------------------------------------------

test("normalizeScore copies exactly { rank, rawScore, tag, handle, playerId, friend } and no image URL", () => {
  const got = normalizeScore({
    rank: 3,
    rawScore: 6999569,
    scoreTag: "t",
    scoreHolderDisplayName: " Lanternjaw ",
    scoreHolder: { playerId: "p9", displayName: "X", friendStatus: "friend", avatarUrl: "https://a" },
    scoreHolderIconImageUrl: "https://b",
  });
  assert.deepEqual(got, { rank: 3, rawScore: 6999569, tag: "t", handle: "Lanternjaw", playerId: "p9", friend: true });
  assert.deepEqual(Object.keys(got), ["rank", "rawScore", "tag", "handle", "playerId", "friend"]);
  assert.equal(Object.isFrozen(got), true);
  assert.doesNotMatch(JSON.stringify(got), /https?:/);
});

test("normalizeScore: a missing or non-integer rank is null; the handle falls back to scoreHolder.displayName, then \"\"", () => {
  assert.equal(normalizeScore({ rawScore: 1, scoreTag: "t", scoreHolderDisplayName: "A" }).rank, null);
  assert.equal(normalizeScore({ rank: 2.5, rawScore: 1 }).rank, null);
  assert.equal(normalizeScore({ rank: 0, rawScore: 1 }).rank, null);
  assert.equal(normalizeScore({ rank: "4", rawScore: 1 }).rank, null);

  const fallback = normalizeScore({ rank: 1, rawScore: 1, scoreHolder: { playerId: "p", displayName: " Moss " } });
  assert.equal(fallback.handle, "Moss");
  const blank = normalizeScore({ rank: 1, rawScore: 1, scoreHolderDisplayName: "   " });
  assert.deepEqual(blank, { rank: 1, rawScore: 1, tag: "", handle: "", playerId: "", friend: false });

  assert.equal(normalizeScore({ rawScore: 1, scoreHolder: { friendStatus: "noRelationship" } }).friend, false);
  assert.equal(normalizeScore(null), null);
  assert.equal(normalizeScore("x"), null);
});

// --- Phase 68: submitScore (D-01) ---------------------------------------------------

const TAG = "v1.2.8.3.0.7.22.431.19.4688.1180.Hilda_F.";

test("submitScore calls initialize once, then the plugin's submitScore with scoreTag, and reports the all-time newBest", async () => {
  const f = fakePlugin({
    results: {
      submitScore: {
        leaderboardId: "L1",
        playerId: "p1",
        results: [
          { timeSpan: "daily", newBest: false },
          { timeSpan: "allTime", newBest: true },
        ],
      },
    },
  });
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  const result = await pg.submitScore({ leaderboardId: "L1", score: 6999569, tag: TAG });
  assert.deepEqual(result, { ok: true, newBest: true });
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(f.names(), ["initialize", "submitScore"]);
  assert.deepEqual(f.argsOf("submitScore"), [[{ leaderboardId: "L1", score: 6999569, scoreTag: TAG }]]);
  await pg.submitScore({ leaderboardId: "L1", score: 1, tag: "t" });
  assert.equal(f.names().filter((n) => n === "initialize").length, 1);
});

test("submitScore: newBest false for an all-time false, null when there is no all-time result or no results", async () => {
  const cases = [
    [{ results: [{ timeSpan: "allTime", newBest: false }] }, false],
    [{ results: [{ timeSpan: "weekly", newBest: true }] }, null],
    [{ results: [] }, null],
    [{}, null],
    [null, null],
  ];
  for (const [submitResult, expected] of cases) {
    const f = fakePlugin({ results: { submitScore: submitResult } });
    const got = await createPlayGames({ loadPlugin: loaderFor(f.plugin) }).submitScore({ leaderboardId: "L1", score: 1, tag: "t" });
    assert.deepEqual(got, { ok: true, newBest: expected }, JSON.stringify(submitResult));
  }
});

test("submitScore rejects invalid input without calling the plugin", async () => {
  const bad = [
    { leaderboardId: "", score: 1, tag: "t" },
    { leaderboardId: "   ", score: 1, tag: "t" },
    { leaderboardId: 7, score: 1, tag: "t" },
    { leaderboardId: "L1", score: -1, tag: "t" },
    { leaderboardId: "L1", score: 1.5, tag: "t" },
    { leaderboardId: "L1", score: NaN, tag: "t" },
    { leaderboardId: "L1", score: 2 ** 53, tag: "t" },
    { leaderboardId: "L1", score: "5", tag: "t" },
    { leaderboardId: "L1", score: 1, tag: "has space" },
    { leaderboardId: "L1", score: 1, tag: "bang!" },
    { leaderboardId: "L1", score: 1, tag: "a".repeat(65) },
    { leaderboardId: "L1", score: 1, tag: undefined },
    { leaderboardId: "L1", score: 1 },
  ];
  const f = fakePlugin();
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  for (const input of bad) assert.deepEqual(await pg.submitScore(input), { ok: false }, JSON.stringify(input));
  assert.deepEqual(await pg.submitScore(), { ok: false });
  assert.deepEqual(await pg.submitScore(null), { ok: false });
  assert.equal(f.names().includes("submitScore"), false, "no submit reached the plugin");

  const edge = await pg.submitScore({ leaderboardId: "L1", score: 0, tag: "a".repeat(64) });
  assert.deepEqual(edge, { ok: true, newBest: true }, "score 0 and a 64-char tag are valid");
  const empty = await pg.submitScore({ leaderboardId: "L1", score: Number.MAX_SAFE_INTEGER, tag: "" });
  assert.equal(empty.ok, true, "an empty tag and the largest safe integer are valid");
  const charset = await pg.submitScore({ leaderboardId: "L1", score: 1, tag: "AZaz09-._~" });
  assert.equal(charset.ok, true, "the whole unreserved charset is valid");
});

test("submitScore resolves { ok: false } on a plugin rejection", async () => {
  const f = fakePlugin({ rejects: ["submitScore"] });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(f.plugin) }).submitScore({ leaderboardId: "L1", score: 1, tag: "t" }), {
    ok: false,
  });
});

// --- Phase 68: loadTopScores / loadPlayerScore (D-05, D-06) -------------------------

test("loadTopScores reads the all-time window and resolves normalized scores with the collection's total", async () => {
  const f = fakePlugin({
    results: {
      loadTopScores: {
        leaderboard: rawBoard({ publicCount: 9044, friendsCount: 4 }),
        scores: [rawScore({ rank: 1, name: "Rival", playerId: "r1", friendStatus: "friend" }), rawScore({ rank: 2, name: "Stranger", playerId: "r2" }), null],
        stale: false,
      },
    },
  });
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  const result = await pg.loadTopScores({ leaderboardId: "L1", collection: "public", maxResults: 10 });
  assert.deepEqual(f.argsOf("loadTopScores"), [
    [{ leaderboardId: "L1", timeSpan: "allTime", collection: "public", maxResults: 10, forceReload: false }],
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.total, 9044);
  assert.deepEqual(result.scores, [
    { rank: 1, rawScore: 6999569, tag: "t", handle: "Rival", playerId: "r1", friend: true },
    { rank: 2, rawScore: 6999569, tag: "t", handle: "Stranger", playerId: "r2", friend: false },
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.scores), true);
  assert.doesNotMatch(JSON.stringify(result), /https?:/);

  const friends = await pg.loadTopScores({ leaderboardId: "L1", collection: "friends", maxResults: 10 });
  assert.equal(friends.total, 4, "the friends total comes from the all-time friends variant");
  assert.equal(f.argsOf("loadTopScores")[1][0].collection, "friends");
});

test("loadTopScores clamps maxResults to 1..25 (10 for a non-number) and sends any non-friends collection as public", async () => {
  const f = fakePlugin();
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  for (const [maxResults, collection] of [
    [0, "public"],
    [99, "everyone"],
    ["x", undefined],
    [NaN, null],
    [7.9, "friends"],
  ]) {
    await pg.loadTopScores({ leaderboardId: "L1", collection, maxResults });
  }
  const sent = f.argsOf("loadTopScores").map(([o]) => [o.maxResults, o.collection]);
  assert.deepEqual(sent, [
    [1, "public"],
    [25, "public"],
    [10, "public"],
    [10, "public"],
    [7, "friends"],
  ]);
});

test("loadTopScores: total is null when the variant or its count is missing; bad results and rejections fail", async () => {
  const noBoard = fakePlugin({ results: { loadTopScores: { leaderboard: null, scores: [], stale: false } } });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(noBoard.plugin) }).loadTopScores({ leaderboardId: "L1" }), {
    ok: true,
    scores: [],
    total: null,
  });
  const badCount = rawBoard();
  badCount.variants[1].numScores = -1;
  const neg = fakePlugin({ results: { loadTopScores: { leaderboard: badCount, scores: [], stale: false } } });
  assert.equal((await createPlayGames({ loadPlugin: loaderFor(neg.plugin) }).loadTopScores({ leaderboardId: "L1" })).total, null);

  const garbage = fakePlugin({ results: { loadTopScores: { scores: "nope" } } });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(garbage.plugin) }).loadTopScores({ leaderboardId: "L1" }), { ok: false });
  const rejected = fakePlugin({ rejects: ["loadTopScores"] });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(rejected.plugin) }).loadTopScores({ leaderboardId: "L1" }), { ok: false });
  const noId = fakePlugin();
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(noId.plugin) }).loadTopScores({ leaderboardId: "" }), { ok: false });
  assert.equal(noId.names().includes("loadTopScores"), false);
});

test("loadPlayerScore calls loadCurrentPlayerScore with the all-time window and resolves the normalized score or null", async () => {
  const f = fakePlugin();
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  const mine = await pg.loadPlayerScore({ leaderboardId: "L1", collection: "friends" });
  assert.deepEqual(f.argsOf("loadCurrentPlayerScore"), [[{ leaderboardId: "L1", timeSpan: "allTime", collection: "friends" }]]);
  assert.deepEqual(mine, {
    ok: true,
    score: { rank: 3, rawScore: 6999569, tag: "t", handle: "Lanternjaw", playerId: "p1", friend: false },
  });

  await pg.loadPlayerScore({ leaderboardId: "L1", collection: "bogus" });
  assert.equal(f.argsOf("loadCurrentPlayerScore")[1][0].collection, "public");

  const none = fakePlugin({ results: { loadCurrentPlayerScore: { score: null, stale: false } } });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(none.plugin) }).loadPlayerScore({ leaderboardId: "L1" }), {
    ok: true,
    score: null,
  });
  const rejected = fakePlugin({ rejects: ["loadCurrentPlayerScore"] });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(rejected.plugin) }).loadPlayerScore({ leaderboardId: "L1" }), {
    ok: false,
  });
});

// --- Phase 68: loadStanding (D-10) ------------------------------------------------

test("loadStanding reloads the board and reads the all-time public rank and count", async () => {
  const f = fakePlugin({ results: { loadLeaderboard: { leaderboard: rawBoard({ publicRank: 3117, publicCount: 9044 }), stale: false } } });
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin) });
  assert.deepEqual(await pg.loadStanding({ leaderboardId: "L1" }), { ok: true, rank: 3117, total: 9044 });
  assert.deepEqual(f.argsOf("loadLeaderboard"), [[{ leaderboardId: "L1", forceReload: true }]]);
});

test("loadStanding: absent rank or count is null; a null leaderboard or a rejection fails", async () => {
  const board = rawBoard();
  delete board.variants[1].playerRank;
  delete board.variants[1].numScores;
  const partial = fakePlugin({ results: { loadLeaderboard: { leaderboard: board, stale: false } } });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(partial.plugin) }).loadStanding({ leaderboardId: "L1" }), {
    ok: true,
    rank: null,
    total: null,
  });
  const noVariants = fakePlugin({ results: { loadLeaderboard: { leaderboard: { variants: [] }, stale: false } } });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(noVariants.plugin) }).loadStanding({ leaderboardId: "L1" }), {
    ok: true,
    rank: null,
    total: null,
  });
  const missing = fakePlugin({ results: { loadLeaderboard: { leaderboard: null, stale: false } } });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(missing.plugin) }).loadStanding({ leaderboardId: "L1" }), { ok: false });
  const rejected = fakePlugin({ rejects: ["loadLeaderboard"] });
  assert.deepEqual(await createPlayGames({ loadPlugin: loaderFor(rejected.plugin) }).loadStanding({ leaderboardId: "L1" }), { ok: false });
});

// --- Phase 68: friendsAccess (D-06) -------------------------------------------------

test("friendsAccess({ request: false }) asks silently: granted, required, or unavailable on a rejection", async () => {
  const granted = fakePlugin({ results: { loadFriends: { friends: [], stale: false, resolutionRequired: false } } });
  const pg = createPlayGames({ loadPlugin: loaderFor(granted.plugin) });
  assert.equal(await pg.friendsAccess({ request: false }), "granted");
  assert.deepEqual(granted.argsOf("loadFriends"), [[{ pageSize: 1, forceReload: false, resolve: false }]]);
  assert.equal(await pg.friendsAccess(), "granted");
  assert.equal(await pg.friendsAccess({ request: "yes" }), "granted");
  assert.equal(
    granted.argsOf("loadFriends").every(([o]) => o.resolve === false),
    true,
    "only request === true may resolve consent",
  );

  const required = fakePlugin({ results: { loadFriends: { friends: [], stale: false, resolutionRequired: true } } });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(required.plugin) }).friendsAccess({ request: false }), "required");
  const rejected = fakePlugin({ rejects: ["loadFriends"] });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(rejected.plugin) }).friendsAccess({ request: false }), "unavailable");
  const garbage = fakePlugin({ results: { loadFriends: null } });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(garbage.plugin) }).friendsAccess({ request: false }), "unavailable");
});

test("friendsAccess({ request: true }) passes resolve: true; a refusal resolves required", async () => {
  const accepted = fakePlugin();
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(accepted.plugin) }).friendsAccess({ request: true }), "granted");
  assert.deepEqual(accepted.argsOf("loadFriends"), [[{ pageSize: 1, forceReload: false, resolve: true }]]);
  const refused = fakePlugin({ results: { loadFriends: { friends: [], stale: false, resolutionRequired: true } } });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(refused.plugin) }).friendsAccess({ request: true }), "required");
  const rejected = fakePlugin({ rejects: ["loadFriends"] });
  assert.equal(await createPlayGames({ loadPlugin: loaderFor(rejected.plugin) }).friendsAccess({ request: true }), "unavailable");
});

// --- Phase 68: timeouts and load failures (D-07) -----------------------------------

const TIMED_CALLS = [
  ["submitScore", "submitScore", (pg) => pg.submitScore({ leaderboardId: "L1", score: 1, tag: "t" }), { ok: false }],
  ["loadTopScores", "loadTopScores", (pg) => pg.loadTopScores({ leaderboardId: "L1" }), { ok: false }],
  ["loadPlayerScore", "loadCurrentPlayerScore", (pg) => pg.loadPlayerScore({ leaderboardId: "L1" }), { ok: false }],
  ["loadStanding", "loadLeaderboard", (pg) => pg.loadStanding({ leaderboardId: "L1" }), { ok: false }],
  ["friendsAccess", "loadFriends", (pg) => pg.friendsAccess({ request: false }), "unavailable"],
];

for (const [method, pluginName, run, failure] of TIMED_CALLS) {
  test(`${method}: a plugin call that never settles resolves ${JSON.stringify(failure)} when the timer fires; a late result is ignored`, async () => {
    const f = fakePlugin({ hangs: [pluginName] });
    const timer = manualTimer();
    const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin), callTimeoutMs: 1000, ...timer });
    let outcome = "pending";
    const p = run(pg).then((v) => {
      outcome = v;
      return v;
    });
    await flush();
    assert.equal(outcome, "pending", "the hung call has not resolved yet");
    assert.deepEqual(timer.delays(), [1000]);
    assert.equal(f.names().includes(pluginName), true);
    timer.fire();
    assert.deepEqual(await p, failure);
    f.settle(pluginName, LEADERBOARD_DEFAULTS[pluginName]);
    await flush();
    assert.deepEqual(outcome, failure, "the late settlement changes nothing");
  });
}

test("a call that settles first clears its timer; the default timeout is 15 s", async () => {
  const f = fakePlugin();
  const timer = manualTimer();
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin), ...timer });
  const pending = pg.loadStanding({ leaderboardId: "L1" });
  assert.deepEqual(timer.delays(), [15000]);
  await pending;
  assert.equal(timer.size(), 0, "the timer is cleared when the call wins the race");
  for (const [, , run] of TIMED_CALLS) await run(pg);
  assert.equal(timer.size(), 0);
});

test("the timer also covers a hung initialize()", async () => {
  const hung = {
    initialize: () => new Promise(() => {}),
    submitScore: async () => LEADERBOARD_DEFAULTS.submitScore,
  };
  const timer = manualTimer();
  const pg = createPlayGames({ loadPlugin: loaderFor(hung), callTimeoutMs: 50, ...timer });
  const p = pg.submitScore({ leaderboardId: "L1", score: 1, tag: "t" });
  await flush();
  timer.fire();
  assert.deepEqual(await p, { ok: false });
});

test("friendsAccess({ request: true }) is not timed: the player may take their time on the consent screen", async () => {
  const f = fakePlugin({ hangs: ["loadFriends"] });
  const timer = manualTimer();
  const pg = createPlayGames({ loadPlugin: loaderFor(f.plugin), callTimeoutMs: 1000, ...timer });
  const p = pg.friendsAccess({ request: true });
  await flush();
  assert.equal(timer.size(), 0, "no timer armed for the consent request");
  f.settle("loadFriends", { friends: [], stale: false, resolutionRequired: false });
  assert.equal(await p, "granted");
});

test("a load or initialize failure resolves every leaderboard method's failure shape", async () => {
  const loadFails = createPlayGames({
    loadPlugin: () => {
      throw new Error("sync boom");
    },
  });
  const initFails = createPlayGames({ loadPlugin: loaderFor(fakePlugin({ initializeRejects: true }).plugin) });
  const noExport = createPlayGames({ loadPlugin: async () => ({}) });
  for (const pg of [loadFails, initFails, noExport]) {
    for (const [, , run, failure] of TIMED_CALLS) assert.deepEqual(await run(pg), failure);
    assert.equal(await pg.friendsAccess({ request: true }), "unavailable");
  }
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

test("source: every PlayGames method call is one of PLUGIN_METHODS_USED, and every one is called", () => {
  const called = [...CODE.matchAll(/PlayGames\.(\w+)\s*\(/g)].map((m) => m[1]);
  assert.ok(called.length >= 9, `expected at least nine plugin call sites, found ${called.length}`);
  for (const name of called) {
    assert.ok(PLUGIN_METHODS_USED.includes(name), `unexpected plugin call ${name}`);
  }
  for (const name of PLUGIN_METHODS_USED) assert.ok(called.includes(name), `plugin.${name} has no call site`);
});

test("source: no image URL is copied — the string \"Url\" never appears in code", () => {
  assert.doesNotMatch(CODE, /Url/);
});

test("source: no other src/browser module names the plugin package", () => {
  const dir = path.join(REPO_ROOT, "src", "browser");
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js") || file === "playGames.js") continue;
    const text = stripJs(fs.readFileSync(path.join(dir, file), "utf8"));
    assert.equal(text.includes(PLUGIN_NAME), false, `src/browser/${file} names the plugin`);
  }
});
