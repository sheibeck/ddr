// test/unit/harness/boardHarness.js
//
// Phase 91.2-05. The one rig every board test shares now that a run posts only
// under a verified Play Games name: the in-memory fake board server (final
// rules unless a test asks for the transition window), a fake Play Games seam,
// an in-memory storage and the REAL identity wired to all three. A test that
// needs a signed-in player just calls rig.identity.boardSession(); one that
// needs a particular name asks the fake (rig.fake.setName) or the fake player
// (rig.play.setPlayer).
//
// makeBoardRig({ now, fakeOpts, play, competeOn, storage }) -> { fake, play,
// storage, identity, config, playConfig, fetchFn, sent, competeOn, now }.
//   fetchFn    the fake's fetch behind a recorder: rig.sent lists every request
//              as { method, url, body } (bodies parsed, headers never kept)
//   makeIdentity(rig, overrides) builds another identity on the same fake,
//              player and storage (a second launch).
//   now        the clock handed to BOTH the fake server and the identity
//   fakeOpts   createFakeBoardFetch options (playGamesEnabled, linkKeepsUid,
//              refreshProviderName, nameSource, transition, runs, ...)
//   play       createFakePlayIdentity options (signedIn, playerId, displayName,
//              interactive)
//   competeOn  () => boolean, default () => true
//   storage    an existing storage double (default: a fresh makeMemoryStorage())
//
// Pure test support: no DOM, no real network, no timers of its own.

import { createFakeBoardFetch } from "../../../src/browser/fakeBoardServer.js";
import { createFakePlayIdentity } from "../../../src/browser/playIdentity.js";
import { createIdentity } from "../../../src/browser/firebaseAuth.js";
import { FIREBASE_CONFIG } from "../../../src/browser/firebaseConfig.js";

/** A Play Games config whose web client id passes playGamesConfigured. */
export const TEST_PLAY_CONFIG = Object.freeze({
  appId: "517177834262",
  webClientId: "517177834262-testwebclient0000000000.apps.googleusercontent.com",
});

/**
 * makeMemoryStorage(initial) — an async getItem/setItem/removeItem double over
 * a Map. `initial` is an object of key -> string. `calls` counts each method.
 */
export function makeMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  const calls = { getItem: 0, setItem: 0, removeItem: 0 };
  return {
    map,
    calls,
    async getItem(key) {
      calls.getItem++;
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      calls.setItem++;
      map.set(key, String(value));
    },
    async removeItem(key) {
      calls.removeItem++;
      map.delete(key);
    },
  };
}

function parseSentBody(body) {
  if (typeof body !== "string") return body ?? null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/**
 * makeIdentity(rig, overrides) — another identity wired to the same fake
 * server, fake player and storage as `rig` (a second launch, a second device
 * state, a changed option). `overrides` replace any createIdentity option.
 */
export function makeIdentity(rig, overrides = {}) {
  return createIdentity({
    storage: rig.storage,
    fetchFn: rig.fetchFn,
    config: rig.config,
    playConfig: rig.playConfig,
    playIdentity: rig.play,
    competeOn: rig.competeOn,
    now: rig.now,
    ...overrides,
  });
}

export function makeBoardRig({ now, fakeOpts = {}, play = {}, competeOn = () => true, storage } = {}) {
  const clock = typeof now === "function" ? now : Date.now;
  const fake = createFakeBoardFetch({ now: clock, ...fakeOpts });
  const fakePlay = createFakePlayIdentity(play);
  const store = storage ?? makeMemoryStorage();
  const config = fakeOpts.config ?? FIREBASE_CONFIG;

  // Every request the clients make, in order: { method, url, body } (a JSON
  // body is parsed; headers are never recorded, so no token lands here).
  const sent = [];
  const fetchFn = (url, init) => {
    sent.push({ method: String((init && init.method) || "GET").toUpperCase(), url, body: parseSentBody(init && init.body) });
    return fake.fetchFn(url, init);
  };

  const rig = { fake, play: fakePlay, storage: store, config, playConfig: TEST_PLAY_CONFIG, fetchFn, sent, competeOn, now: clock };
  rig.identity = makeIdentity(rig);
  return rig;
}
