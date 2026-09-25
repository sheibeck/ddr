// src/browser/playGames.js
//
// Phase 67 (PGS-02, D-12): the Play Games provider seam, and the ONE module
// that names the Play Games plugin package. The shell and every other module
// reach Play Games only through a provider made here: createPlayGames() over
// the Capacitor plugin on a native build, createFakePlayGames() in memory for
// `node --test` and the browser dev loop. Both expose the same nine methods
// (PROVIDER_METHODS), so callers swap them without a code change.
//
// Phase 68 (PGS-03..05) binds the leaderboard calls behind the same seam:
// submitScore (one validated score with its tag, D-01), loadTopScores and
// loadPlayerScore (the all-time public or friends collection, D-05/D-06),
// loadStanding (the DEEPEST rank and score count for the rank line, D-10)
// and friendsAccess (the silent consent check, or the consent request from
// the in-panel button only, D-06). Only PLUGIN_METHODS_USED are ever called
// on the plugin. Every method resolves; the leaderboard reads and writes are
// raced against a call timer and resolve their failure shape instead of
// hanging (D-07), so a wedged native call never blocks the queue or the
// panel. Scores are normalized to { rank, rawScore, tag, handle, playerId,
// friend }: no image URL ever leaves this module.
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
// confirmed by 67-RESEARCH.md). Nothing telemetry-shaped (stats, events,
// recall or server-side access) is touched. The player identity is
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

/** The provider contract every implementation exposes (D-12; Phase 68 adds five). */
export const PROVIDER_METHODS = Object.freeze([
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

/**
 * The only plugin methods this module ever calls: the telemetry-free
 * allow-list. Stats, events, recall, server-side access and snapshots are
 * never touched.
 */
export const PLUGIN_METHODS_USED = Object.freeze([
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

/** The default leaderboard call timeout (D-07). */
const CALL_TIMEOUT_MS = 15000;

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

/** The failure shape of every { ok } leaderboard method. */
const FAILED = Object.freeze({ ok: false });

/**
 * friendsAccess's own loadFriends call never needs Play Games' cache
 * bypassed (D-06: it is a silent, cheap consent check, never a scores
 * read) — named rather than inlined so only loadTopScores ever forwards a
 * caller-controlled forceReload (Phase 81, BOARD-16).
 */
const FRIENDS_ACCESS_FORCE_RELOAD = false;

/**
 * TAG_OK — module-private: the score tag's alphabet, the URI unreserved
 * characters, 0..64 long (D-01; kept local so this module does not depend on
 * the tag encoder).
 */
const TAG_OK = /^[A-Za-z0-9._~-]{0,64}$/;

/** isScore(n) — a raw score is a non-negative safe integer. */
function isScore(n) {
  return Number.isSafeInteger(n) && n >= 0;
}

/** isBoardId(id) — a leaderboard id is a non-empty string. */
function isBoardId(id) {
  return typeof id === "string" && id.trim() !== "";
}

/** isTag(t) — a string in the tag alphabet, at most 64 characters. */
function isTag(t) {
  return typeof t === "string" && TAG_OK.test(t);
}

/** clampResults(n) — maxResults clamped to the plugin's 1..25; 10 for a non-number. */
function clampResults(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 10;
  return Math.min(25, Math.max(1, Math.trunc(n)));
}

/** collectionOf(c) — "friends", or "public" for anything else. */
function collectionOf(c) {
  return c === "friends" ? "friends" : "public";
}

/** countOf(n) — a non-negative integer, else null. */
function countOf(n) {
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** rankOf(n) — an integer rank >= 1, else null. */
function rankOf(n) {
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** optsOf(o) — the options object, or {} for anything else. */
function optsOf(o) {
  return o && typeof o === "object" ? o : {};
}

/** variantOf(leaderboard, collection) — the all-time variant for that collection, or null. */
function variantOf(leaderboard, collection) {
  if (!leaderboard || typeof leaderboard !== "object" || !Array.isArray(leaderboard.variants)) return null;
  return (
    leaderboard.variants.find(
      (v) => v && typeof v === "object" && v.timeSpan === "allTime" && v.collection === collection,
    ) || null
  );
}

/**
 * normalizeScore(s) — a plugin LeaderboardScore normalized to exactly the
 * frozen { rank, rawScore, tag, handle, playerId, friend }. Nothing else is
 * copied: no display strings, no timestamps, no image URL (D-07). A missing
 * or non-integer rank is null; the handle is the score holder's display name,
 * falling back to the holder's profile name, then "". Returns null for
 * anything that is not an object.
 */
export function normalizeScore(s) {
  if (!s || typeof s !== "object") return null;
  const holder = s.scoreHolder && typeof s.scoreHolder === "object" ? s.scoreHolder : {};
  return Object.freeze({
    rank: rankOf(s.rank),
    rawScore: typeof s.rawScore === "number" && Number.isFinite(s.rawScore) ? s.rawScore : 0,
    tag: typeof s.scoreTag === "string" ? s.scoreTag : "",
    handle: trimmed(s.scoreHolderDisplayName) || trimmed(holder.displayName),
    playerId: trimmed(holder.playerId),
    friend: holder.friendStatus === "friend",
  });
}

/** scoresOf(list) — a frozen array of normalized scores (non-objects dropped). */
function scoresOf(list) {
  return Object.freeze((Array.isArray(list) ? list : []).map(normalizeScore).filter(Boolean));
}

/** accessOf(result) — a loadFriends result read as a consent state. */
function accessOf(result) {
  if (!result || typeof result !== "object") return "unavailable";
  if (result.resolutionRequired === true) return "required";
  if (result.resolutionRequired === false) return "granted";
  return "unavailable";
}

function signedOut() {
  return Object.freeze({ signedIn: false, player: null });
}

function signedInAs(player) {
  return Object.freeze({ signedIn: true, player });
}

/**
 * createPlayGames({ loadPlugin, callTimeoutMs, setTimer, clearTimer }) — the
 * native provider. `loadPlugin` is an optional injected loader resolving the
 * plugin's module namespace (tests pass a fake); the default is the dynamic
 * import of the plugin package. `callTimeoutMs` (default 15 s) bounds every
 * leaderboard call except the consent request; `setTimer`/`clearTimer` are
 * injectable for tests. Constructing the provider loads nothing.
 */
export function createPlayGames({
  loadPlugin,
  callTimeoutMs = CALL_TIMEOUT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
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

  // timed(call, failure) — ready() then call(PlayGames), raced against the
  // call timer. Resolves call's value, or `failure` on a rejection, a throw
  // or the timeout; a late settlement after the timeout is ignored. `call`
  // must resolve a plain value, never the proxy (the thenable trap).
  function timed(call, failure) {
    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (timer !== null) {
          try {
            clearTimer(timer);
          } catch {
            // a broken clearTimer must not wedge the call
          }
        }
        resolve(value);
      };
      try {
        timer = setTimer(() => finish(failure), callTimeoutMs);
      } catch {
        timer = null;
      }
      Promise.resolve()
        .then(() => ready())
        .then((wrap) => call(wrap.PlayGames))
        .then(finish, () => finish(failure));
    });
  }

  /**
   * submitScore({ leaderboardId, score, tag }) — one validated score with its
   * tag (D-01): { ok: true, newBest } where newBest is the all-time result's
   * flag, or null when the plugin reports no all-time result; { ok: false }
   * on invalid input (the plugin is never called), a failure or the timeout.
   */
  async function submitScore(opts) {
    const { leaderboardId, score, tag } = optsOf(opts);
    if (!isBoardId(leaderboardId) || !isScore(score) || !isTag(tag)) return FAILED;
    return timed(async (PlayGames) => {
      const result = await PlayGames.submitScore({ leaderboardId, score, scoreTag: tag });
      const results = result && typeof result === "object" && Array.isArray(result.results) ? result.results : [];
      const allTime = results.find((r) => r && typeof r === "object" && r.timeSpan === "allTime");
      const newBest = allTime && typeof allTime.newBest === "boolean" ? allTime.newBest : null;
      return Object.freeze({ ok: true, newBest });
    }, FAILED);
  }

  /**
   * loadTopScores({ leaderboardId, collection, maxResults, forceReload }) —
   * the all-time top scores of the public or friends collection (D-05, D-06),
   * maxResults clamped to 1..25: { ok: true, scores, total } where total is
   * that collection's all-time score count, or null. Phase 81 (BOARD-16,
   * R-16b): `forceReload` forwards to the plugin exactly as
   * `opts.forceReload === true` — omitted or falsy stays `false` (Play
   * Games' own cache may serve a stale read); a caller (globalBoards.js's
   * load()) passes `true` to bypass it after the player's own submission or
   * on reopening the panel.
   */
  async function loadTopScores(opts) {
    const { leaderboardId, collection, maxResults, forceReload } = optsOf(opts);
    if (!isBoardId(leaderboardId)) return FAILED;
    const c = collectionOf(collection);
    return timed(async (PlayGames) => {
      const result = await PlayGames.loadTopScores({
        leaderboardId,
        timeSpan: "allTime",
        collection: c,
        maxResults: clampResults(maxResults),
        forceReload: forceReload === true,
      });
      if (!result || typeof result !== "object" || !Array.isArray(result.scores)) return FAILED;
      const variant = variantOf(result.leaderboard, c);
      return Object.freeze({
        ok: true,
        scores: scoresOf(result.scores),
        total: variant ? countOf(variant.numScores) : null,
      });
    }, FAILED);
  }

  /**
   * loadPlayerScore({ leaderboardId, collection }) — the signed-in player's
   * own all-time score in that collection: { ok: true, score } (score null
   * when the player has none).
   */
  async function loadPlayerScore(opts) {
    const { leaderboardId, collection } = optsOf(opts);
    if (!isBoardId(leaderboardId)) return FAILED;
    return timed(async (PlayGames) => {
      const result = await PlayGames.loadCurrentPlayerScore({
        leaderboardId,
        timeSpan: "allTime",
        collection: collectionOf(collection),
      });
      if (!result || typeof result !== "object") return FAILED;
      return Object.freeze({ ok: true, score: normalizeScore(result.score) });
    }, FAILED);
  }

  /**
   * loadStanding({ leaderboardId }) — the board's metadata, reloaded, read
   * for the player's all-time public rank and the score count (the DEEPEST
   * rank line, D-10): { ok: true, rank, total }, each null when absent.
   */
  async function loadStanding(opts) {
    const { leaderboardId } = optsOf(opts);
    if (!isBoardId(leaderboardId)) return FAILED;
    return timed(async (PlayGames) => {
      const result = await PlayGames.loadLeaderboard({ leaderboardId, forceReload: true });
      const board = result && typeof result === "object" ? result.leaderboard : null;
      if (!board || typeof board !== "object") return FAILED;
      const variant = variantOf(board, "public");
      return Object.freeze({
        ok: true,
        rank: variant ? rankOf(variant.playerRank) : null,
        total: variant ? countOf(variant.numScores) : null,
      });
    }, FAILED);
  }

  /**
   * friendsAccess({ request }) — "granted", "required" or "unavailable"
   * (D-06). Only request: true may show the Play Games consent screen (the
   * in-panel button); a refusal resolves "required". The request is not
   * timed, like the interactive sign-in: the player may take their time.
   */
  async function friendsAccess(opts) {
    const request = optsOf(opts).request === true;
    const call = async (PlayGames) =>
      accessOf(await PlayGames.loadFriends({ pageSize: 1, forceReload: FRIENDS_ACCESS_FORCE_RELOAD, resolve: request }));
    if (!request) return timed(call, "unavailable");
    try {
      const { PlayGames } = await ready();
      return await call(PlayGames);
    } catch {
      return "unavailable";
    }
  }

  return Object.freeze({
    kind: "native",
    init,
    isAuthenticated,
    signIn,
    getPlayer,
    submitScore,
    loadTopScores,
    loadPlayerScore,
    loadStanding,
    friendsAccess,
  });
}

/** seedEntry(e) — module-private: a seeded board entry, or null when unusable. */
function seedEntry(e) {
  if (!e || typeof e !== "object" || !isScore(e.score)) return null;
  return {
    playerId: typeof e.playerId === "string" ? e.playerId : "",
    handle: typeof e.handle === "string" ? e.handle : "",
    score: e.score,
    tag: typeof e.tag === "string" ? e.tag : "",
    friend: e.friend === true,
  };
}

/**
 * createFakePlayGames({ signedIn, player, interactive, boards, orders,
 * online, friendsConsent }) — the in-memory provider for tests and the
 * browser dev loop (seeded signed in by the dev-only pgsDevSignedIn
 * setting). `interactive` is "accept" (signIn() signs in, and a consent
 * request grants) or "decline" (both refuse).
 *
 * The leaderboard store behaves like a best-score service: `boards` seeds
 * { [id]: [{ playerId, handle, score, tag, friend }] } in insertion order;
 * `orders` marks an id "smallerIsBetter" (anything else is larger-is-better);
 * the player's own entry keeps its best score and that score's tag. Ties keep
 * insertion order. `online` (flipped by setOnline) and signed-in gate every
 * leaderboard call. `friendsConsent` is "granted", "required" (a request
 * with interactive "accept" grants it) or "decline" (a request never does);
 * the friends collection needs the grant.
 *
 * Inspectors: calls() (the ordered provider method names), submissions()
 * (every accepted { leaderboardId, score, tag }), both frozen copies, and
 * setOnline(value).
 */
export function createFakePlayGames({
  signedIn = false,
  player = FAKE_PLAYER,
  interactive = "accept",
  boards = {},
  orders = {},
  online = true,
  friendsConsent = "granted",
} = {}) {
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

  // --- the leaderboard store -------------------------------------------------

  const store = new Map();
  for (const [id, list] of Object.entries(boards && typeof boards === "object" ? boards : {})) {
    if (Array.isArray(list)) store.set(id, list.map(seedEntry).filter(Boolean));
  }
  const smaller = (id) => !!orders && typeof orders === "object" && orders[id] === "smallerIsBetter";
  let reachable = online !== false;
  let consent = friendsConsent === "required" || friendsConsent === "decline" ? friendsConsent : "granted";
  const submitted = [];

  const usable = () => state && reachable;
  const entriesOf = (id) => {
    if (!store.has(id)) store.set(id, []);
    return store.get(id);
  };

  // ranked(id, collection) — the collection's entries, stably sorted in the
  // board's direction (Array.prototype.sort is stable: ties keep insertion
  // order), as frozen normalized scores ranked 1..n.
  function ranked(id, collection) {
    const dir = smaller(id) ? 1 : -1;
    const list = entriesOf(id).filter((e) => collection !== "friends" || e.friend || e.playerId === who.id);
    return [...list]
      .sort((a, b) => dir * (a.score - b.score))
      .map((e, i) =>
        Object.freeze({
          rank: i + 1,
          rawScore: e.score,
          tag: e.tag,
          handle: e.handle,
          playerId: e.playerId,
          friend: e.friend,
        }),
      );
  }

  async function submitScore(opts) {
    log.push("submitScore");
    const { leaderboardId, score, tag } = optsOf(opts);
    if (!isBoardId(leaderboardId) || !isScore(score) || !isTag(tag) || !usable()) return FAILED;
    const list = entriesOf(leaderboardId);
    const mine = list.find((e) => e.playerId === who.id);
    let newBest = true;
    if (!mine) {
      list.push({ playerId: who.id, handle: who.displayName, score, tag, friend: false });
    } else {
      newBest = smaller(leaderboardId) ? score < mine.score : score > mine.score;
      if (newBest) {
        mine.score = score;
        mine.tag = tag;
      }
    }
    submitted.push(Object.freeze({ leaderboardId, score, tag }));
    return Object.freeze({ ok: true, newBest });
  }

  // readable(id, collection) — the shared read gate: signed in, online, a
  // board id, and the friends grant for the friends collection.
  function readable(id, collection) {
    return usable() && isBoardId(id) && (collection !== "friends" || consent === "granted");
  }

  async function loadTopScores(opts) {
    log.push("loadTopScores");
    const { leaderboardId, collection, maxResults } = optsOf(opts);
    const c = collectionOf(collection);
    if (!readable(leaderboardId, c)) return FAILED;
    const all = ranked(leaderboardId, c);
    return Object.freeze({ ok: true, scores: Object.freeze(all.slice(0, clampResults(maxResults))), total: all.length });
  }

  async function loadPlayerScore(opts) {
    log.push("loadPlayerScore");
    const { leaderboardId, collection } = optsOf(opts);
    const c = collectionOf(collection);
    if (!readable(leaderboardId, c)) return FAILED;
    return Object.freeze({ ok: true, score: ranked(leaderboardId, c).find((s) => s.playerId === who.id) || null });
  }

  async function loadStanding(opts) {
    log.push("loadStanding");
    const { leaderboardId } = optsOf(opts);
    if (!readable(leaderboardId, "public")) return FAILED;
    const all = ranked(leaderboardId, "public");
    const mine = all.find((s) => s.playerId === who.id);
    return Object.freeze({ ok: true, rank: mine ? mine.rank : null, total: all.length });
  }

  async function friendsAccess(opts) {
    log.push("friendsAccess");
    if (!usable()) return "unavailable";
    if (consent === "required" && optsOf(opts).request === true && interactive === "accept") consent = "granted";
    return consent === "granted" ? "granted" : "required";
  }

  function calls() {
    return Object.freeze([...log]);
  }

  function submissions() {
    return Object.freeze([...submitted]);
  }

  function setOnline(value) {
    reachable = value === true;
  }

  return Object.freeze({
    kind: "fake",
    init,
    isAuthenticated,
    signIn,
    getPlayer,
    submitScore,
    loadTopScores,
    loadPlayerScore,
    loadStanding,
    friendsAccess,
    calls,
    submissions,
    setOnline,
  });
}
