// src/browser/playGames.js
//
// Phase 67 (PGS-02, D-12): the Play Games provider seam, and the ONE module
// that names the Play Games plugin package. The shell and every other module
// reach Play Games only through a provider made here: createPlayGames() over
// the Capacitor plugin on a native build, createFakePlayGames() in memory for
// `node --test` and the browser dev loop. Both expose the same four methods
// (PROVIDER_METHODS), so callers swap them without a code change.
//
// The caller (the account controller, 67-07) decides whether to call at all.
// Compete OFF means no call, and since the plugin module is loaded lazily on
// the first method call only (D-02), a provider nobody calls never loads it.
// (D-20: the plugin's own native load() still initializes Google's SDK at app
// start; that is outside this module and outside the game's control.)
//
// init() is the silent launch attempt; signIn() is the interactive attempt,
// reached only from the Sign in row, and passes `silent: false` explicitly
// because the plugin's signIn() defaults to silent (67-01 research). Every
// method resolves and never rejects: a load failure, a rejection, a declined
// prompt or no Play Games profile all resolve signed out (D-01, D-11). There
// is no retry here; the controller owns retry policy.
//
// There is no sign-out method: PGS v2 has no programmatic sign-out (D-03,
// confirmed by 67-RESEARCH.md). Only initialize / signIn / isSignedIn /
// getPlayer are ever called on the plugin; nothing telemetry-shaped (stats,
// events, recall or server-side access) is touched. The player identity is
// exactly { id, displayName }: avatar, hi-res and banner image URLs are
// dropped, so nothing downstream can fetch a remote profile image (D-07).
//
// The Capacitor plugin object is a registerPlugin Proxy that forwards EVERY
// property read, `then` included, to native. It is never returned from an
// async function nor used as a resolution value (the thenable trap
// documented at src/browser/nativeChrome.js#loadApp); it lives only inside a
// plain wrapper object and is reached through real method calls.
//
// No DOM, no window/document global, no bridge name, no network API.

/** The provider contract every implementation exposes (D-12). */
export const PROVIDER_METHODS = Object.freeze(["init", "isAuthenticated", "signIn", "getPlayer"]);

/**
 * The plugin's leaderboard methods, reserved for Phase 68, which binds them
 * behind this same seam. This phase exposes none of them. Carried to Phase
 * 68: D-14 (the 64-char URL-safe score tag), D-18 (no epitaph in the tag)
 * and D-19 (five boards per season; LINEAGE sampled from a DEEPEST fetch).
 * See docs/PLAY-GAMES-SETUP.md's engineering notes.
 */
export const RESERVED_LEADERBOARD_METHODS = Object.freeze([
  "submitScore",
  "loadTopScores",
  "loadPlayerCenteredScores",
  "loadCurrentPlayerScore",
  "loadFriends",
]);

/** The fake provider's default signed-in identity (browser dev loop, tests). */
export const FAKE_PLAYER = Object.freeze({ id: "fake-player", displayName: "Dev Delver" });

/** trimmed(x) — module-private: a trimmed string, or "" for a non-string. */
function trimmed(x) {
  return typeof x === "string" ? x.trim() : "";
}

/**
 * toPlayer(info) — module-private: the plugin's PlayerInfo normalized to a
 * frozen { id, displayName }. Copies nothing else (D-07: no image URL).
 * Returns null for anything that is not an object.
 */
function toPlayer(info) {
  if (!info || typeof info !== "object") return null;
  return Object.freeze({ id: trimmed(info.playerId), displayName: trimmed(info.displayName) });
}

function signedOut() {
  return Object.freeze({ signedIn: false, player: null });
}

function signedInAs(player) {
  return Object.freeze({ signedIn: true, player });
}

/**
 * createPlayGames({ loadPlugin }) — the native provider. `loadPlugin` is an
 * optional injected loader resolving the plugin's module namespace (tests
 * pass a fake); the default is the dynamic import of the plugin package.
 * Constructing the provider loads nothing.
 */
export function createPlayGames({ loadPlugin } = {}) {
  const loader = typeof loadPlugin === "function" ? loadPlugin : () => import("@modbender/capacitor-play-games");

  let loading = null; // memoized Promise<{ PlayGames }> (a plain wrapper)
  let initializing = null; // memoized Promise<{ PlayGames }> after initialize()

  // load() — resolves a plain wrapper holding only the PlayGames property;
  // never the proxy itself. A failure clears the memo so a later call retries.
  function load() {
    if (!loading) {
      const p = Promise.resolve()
        .then(() => loader())
        .then((mod) => {
          const PlayGames = mod && typeof mod === "object" ? mod.PlayGames : undefined;
          if (!PlayGames) throw new Error("Play Games plugin export missing");
          return { PlayGames };
        });
      loading = p;
      p.catch(() => {
        if (loading === p) loading = null;
      });
    }
    return loading;
  }

  // ready() — load() then the plugin's initialize(), once per provider.
  function ready() {
    if (!initializing) {
      const p = load().then(async (wrap) => {
        await wrap.PlayGames.initialize();
        return wrap;
      });
      initializing = p;
      p.catch(() => {
        if (initializing === p) initializing = null;
      });
    }
    return initializing;
  }

  // attempt(silent) — the shared init()/signIn() flow. Never rejects.
  async function attempt(silent) {
    try {
      const { PlayGames } = await ready();
      const result = await PlayGames.signIn({ silent });
      if (!result || typeof result !== "object" || result.signedIn !== true) return signedOut();
      if (result.player && typeof result.player === "object") return signedInAs(toPlayer(result.player));
      let player = null;
      try {
        player = toPlayer(await PlayGames.getPlayer());
      } catch {
        player = null;
      }
      return signedInAs(player);
    } catch {
      return signedOut();
    }
  }

  /** init() — the silent launch attempt: { signedIn, player }. */
  function init() {
    return attempt(true);
  }

  /** signIn() — the interactive attempt (the Sign in row only). */
  function signIn() {
    return attempt(false);
  }

  /** isAuthenticated() — true only when the plugin reports signedIn === true. */
  async function isAuthenticated() {
    try {
      const { PlayGames } = await ready();
      const result = await PlayGames.isSignedIn();
      return !!result && result.signedIn === true;
    } catch {
      return false;
    }
  }

  /** getPlayer() — the normalized { id, displayName }, or null. */
  async function getPlayer() {
    try {
      const { PlayGames } = await ready();
      return toPlayer(await PlayGames.getPlayer());
    } catch {
      return null;
    }
  }

  return Object.freeze({ kind: "native", init, isAuthenticated, signIn, getPlayer });
}

/**
 * createFakePlayGames({ signedIn, player, interactive }) — the in-memory
 * provider for tests and the browser dev loop (seeded signed in by the
 * dev-only pgsDevSignedIn setting). `interactive` is "accept" (signIn()
 * signs in) or "decline" (it stays signed out). calls() returns the ordered
 * method names called so far, as a frozen copy.
 */
export function createFakePlayGames({ signedIn = false, player = FAKE_PLAYER, interactive = "accept" } = {}) {
  const who =
    player && typeof player === "object"
      ? Object.freeze({
          id: typeof player.id === "string" ? player.id : "",
          displayName: typeof player.displayName === "string" ? player.displayName : "",
        })
      : FAKE_PLAYER;
  let state = signedIn === true;
  const log = [];

  const current = () => (state ? signedInAs(who) : signedOut());

  async function init() {
    log.push("init");
    return current();
  }

  async function isAuthenticated() {
    log.push("isAuthenticated");
    return state;
  }

  async function signIn() {
    log.push("signIn");
    if (interactive === "accept") state = true;
    return current();
  }

  async function getPlayer() {
    log.push("getPlayer");
    return state ? who : null;
  }

  function calls() {
    return Object.freeze([...log]);
  }

  return Object.freeze({ kind: "fake", init, isAuthenticated, signIn, getPlayer, calls });
}
