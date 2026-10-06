// src/browser/playIdentity.js
//
// Phase 91.2 (BOARD-31/33, D-02): the seam between the game and the in-repo
// PlayIdentity Capacitor plugin (android/.../PlayIdentityPlugin.java). The
// identity layer and the shell reach Play Games only through an object made
// here: createPlayIdentity() over the native plugin, or
// createFakePlayIdentity() in memory for `node --test` and the browser dev
// loop. Both expose the same six Play Games methods, so callers swap them
// freely:
//
//   init()                          -> { ok: true } | { ok: false, reason }
//   status() / signIn()             -> { ok: true, signedIn: false }
//                                    | { ok: true, signedIn: true, playerId, displayName }
//                                    | { ok: false, reason }
//   serverAuthCode({ serverClientId }) -> { ok: true, authCode } | { ok: false, reason }
//   syncAchievements({ ops })       -> { ok: true, results: [{ i, ok } | { i, ok: false, reason }] }
//                                    | { ok: false, reason }
//   showAchievements()              -> { ok: true } | { ok: false, reason }
//
// Every method resolves a plain object and never rejects or throws. The four
// identity methods carry reasons from the closed set PLAY_IDENTITY_REASONS.
//
// ACHIEVEMENTS (Phase 101, PGS-07/PGS-10, AUI-04). `ops` is a batch of 1 to 20
// { kind: "unlock" | "reveal" | "steps", resource, n? } objects: `resource` is
// a NAME such as achievement_x that the native plugin looks up in the Play
// Console resource file (no Play ID is ever in JS) and `n` is the absolute
// step count of a "steps" op. `results` covers the ops the plugin attempted
// (it stops at the first network or signin answer), by index `i` into the
// batch. The two achievement methods carry reasons from their own closed set
// PLAY_ACHIEVEMENT_REASONS. The shell calls them only through the Play mirror
// (src/browser/playAchievements.js, plan 101-02) and the sheet button, and
// only while Compete is ON: the first call starts the Play Games SDK.
//
// BUILD INFO. The native seam (only) also has buildInfo() -> { ok: true,
// debug: boolean } | { ok: false, reason }, the plugin's BuildConfig.DEBUG.
// It is not a Play Games call: the plugin answers it without initializing the
// SDK, so asking never breaks the Compete-OFF privacy gate. The shell's dev
// rows use it through src/browser/devBuild.js and fail closed on anything but
// debug === true. The fake has no buildInfo (the browser dev loop is not a
// release build, devBuild.js never asks it).
//
// LAZY. Constructing a seam loads nothing. The native plugin is touched only
// when a method is first called. The Play Games methods are only called while
// Compete is ON (the SDK starts on the first one); buildInfo is the one
// exception and never starts the SDK.
//
// THE PROXY-THENABLE RULE. The plugin object from Capacitor's registerPlugin
// is a Proxy that forwards EVERY property read, `then` included, to the
// native bridge. Returning it from an async function, or awaiting it, makes
// Promise adoption read `.then` and raises "PlayIdentity.then() is not
// implemented on android". So the plugin only ever lives inside a plain
// `{ plugin }` wrapper, is destructured at the call site, and is reached
// through explicit method calls (the same rule as storage.js
// loadNativePreferences and nativeChrome.js loadApp).
//
// This module exports ids and reason codes only: no player-facing text.
// No DOM, no global window or document access.

/** The closed set of failure reasons every method may carry. */
export const PLAY_IDENTITY_REASONS = Object.freeze(["unavailable", "config", "denied", "error"]);

function fail(reason) {
  return Object.freeze({ ok: false, reason: PLAY_IDENTITY_REASONS.includes(reason) ? reason : "error" });
}

function signedOut() {
  return Object.freeze({ ok: true, signedIn: false });
}

function signedInAs(playerId, displayName) {
  return Object.freeze({ ok: true, signedIn: true, playerId, displayName });
}

// ─── native answer normalizers: unknown shapes become { ok: false, reason: "error" } ──

function normInit(raw) {
  if (raw && typeof raw === "object") {
    if (raw.ok === true) return Object.freeze({ ok: true });
    if (raw.ok === false) return fail(raw.reason);
  }
  return fail("error");
}

function normStatus(raw) {
  if (!raw || typeof raw !== "object") return fail("error");
  if (raw.ok === false) return fail(raw.reason);
  if (raw.ok !== true) return fail("error");
  if (!raw.signedIn) return signedOut();
  if (typeof raw.playerId !== "string" || raw.playerId === "") return fail("error");
  return signedInAs(raw.playerId, typeof raw.displayName === "string" ? raw.displayName : "");
}

function normCode(raw) {
  if (!raw || typeof raw !== "object") return fail("error");
  if (raw.ok === false) return fail(raw.reason);
  if (raw.ok === true && typeof raw.authCode === "string" && raw.authCode !== "") {
    return Object.freeze({ ok: true, authCode: raw.authCode });
  }
  return fail("error");
}

/** buildInfo: only a literal boolean `debug` on an ok answer counts. */
function normBuildInfo(raw) {
  if (!raw || typeof raw !== "object") return fail("error");
  if (raw.ok === false) return fail(raw.reason);
  if (raw.ok === true && typeof raw.debug === "boolean") return Object.freeze({ ok: true, debug: raw.debug });
  return fail("error");
}

// ─── the achievement pair (Phase 101-01): their own closed reason set ───────

/** The closed set of failure reasons the two achievement methods may carry. */
export const PLAY_ACHIEVEMENT_REASONS = Object.freeze([
  "unavailable",
  "signin",
  "network",
  "unknown",
  "type",
  "config",
  "error",
]);

function failAch(reason) {
  return Object.freeze({ ok: false, reason: PLAY_ACHIEVEMENT_REASONS.includes(reason) ? reason : "error" });
}

/**
 * syncAchievements: { ok: true, results } keeps only well-formed entries that
 * point inside the batch that was sent (`args.ops`); { ok: false, reason }
 * clamps the reason; anything else is an error.
 */
function normSync(raw, args) {
  if (!raw || typeof raw !== "object") return failAch("error");
  if (raw.ok === false) return failAch(raw.reason);
  if (raw.ok !== true || !Array.isArray(raw.results)) return failAch("error");
  const size = Array.isArray(args && args.ops) ? args.ops.length : 0;
  const results = [];
  for (const entry of raw.results) {
    if (!entry || typeof entry !== "object") continue;
    if (!Number.isInteger(entry.i) || entry.i < 0 || entry.i >= size) continue;
    if (typeof entry.ok !== "boolean") continue;
    results.push(
      Object.freeze(entry.ok ? { i: entry.i, ok: true } : { i: entry.i, ok: false, reason: failAch(entry.reason).reason }),
    );
  }
  return Object.freeze({ ok: true, results: Object.freeze(results) });
}

function normShow(raw) {
  if (!raw || typeof raw !== "object") return failAch("error");
  if (raw.ok === true) return Object.freeze({ ok: true });
  if (raw.ok === false) return failAch(raw.reason);
  return failAch("error");
}

const NORMALIZERS = {
  init: normInit,
  status: normStatus,
  signIn: normStatus,
  serverAuthCode: normCode,
  buildInfo: normBuildInfo,
  syncAchievements: normSync,
  showAchievements: normShow,
};

/**
 * defaultLoadPlugin() — the dynamic import of @capacitor/core lives only in
 * this function body, so node and the browser dev loop never resolve it at
 * module load. Resolves a plain `{ plugin }` wrapper, never the proxy itself.
 */
async function defaultLoadPlugin() {
  const mod = await import("@capacitor/core");
  return { plugin: mod.registerPlugin("PlayIdentity") };
}

/**
 * createPlayIdentity({ loadPlugin }) — the native seam. `loadPlugin` is an
 * optional injected loader resolving a plain `{ plugin }` object (tests pass a
 * fake). The load is memoized; a failed load clears the memo so a later call
 * retries.
 */
export function createPlayIdentity({ loadPlugin } = {}) {
  const loader = typeof loadPlugin === "function" ? loadPlugin : defaultLoadPlugin;
  let loading = null;

  function load() {
    if (!loading) {
      const p = Promise.resolve()
        .then(() => loader())
        .then((wrap) => {
          const plugin = wrap && typeof wrap === "object" ? wrap.plugin : undefined;
          if (!plugin || (typeof plugin !== "object" && typeof plugin !== "function")) {
            throw new Error("PlayIdentity plugin missing");
          }
          // Plain wrapper out, never the plugin itself.
          return { plugin };
        });
      loading = p;
      p.catch(() => {
        if (loading === p) loading = null;
      });
    }
    return loading;
  }

  async function invoke(method, args) {
    let wrap;
    try {
      wrap = await load();
    } catch {
      return fail("unavailable");
    }
    try {
      const { plugin } = wrap;
      const raw = await plugin[method](args);
      return NORMALIZERS[method](raw, args);
    } catch {
      return fail("error");
    }
  }

  return Object.freeze({
    kind: "native",
    init: () => invoke("init"),
    status: () => invoke("status"),
    signIn: () => invoke("signIn"),
    serverAuthCode: ({ serverClientId } = {}) => invoke("serverAuthCode", { serverClientId }),
    buildInfo: () => invoke("buildInfo"),
    syncAchievements: (arg) => invoke("syncAchievements", { ops: arg ? arg.ops : undefined }),
    showAchievements: () => invoke("showAchievements"),
  });
}

/**
 * createFakePlayIdentity(opts) — the in-memory seam for tests and the browser
 * dev loop. Same four methods, plus setSignedIn / setPlayer / calls().
 * Auth codes are `fake:<pid>:<name>:<n>` (parts percent-encoded, n from 1),
 * which the fake server in 91.2-03 parses.
 */
export function createFakePlayIdentity({
  signedIn = true,
  playerId = "fake-player",
  displayName = "Dev Delver",
  interactive = true,
} = {}) {
  let isSignedIn = !!signedIn;
  let pid = String(playerId);
  let name = String(displayName);
  let counter = 0;
  const log = [];

  const record = (method, args) => {
    log.push(args === undefined ? { method } : { method, args });
  };
  const current = () => (isSignedIn ? signedInAs(pid, name) : signedOut());

  return Object.freeze({
    kind: "fake",
    async init() {
      record("init");
      return Object.freeze({ ok: true });
    },
    async status() {
      record("status");
      return current();
    },
    async signIn() {
      record("signIn");
      if (!isSignedIn && interactive) isSignedIn = true;
      return current();
    },
    async serverAuthCode({ serverClientId } = {}) {
      record("serverAuthCode", { serverClientId });
      if (typeof serverClientId !== "string" || serverClientId === "") return fail("config");
      if (!isSignedIn) return fail("denied");
      counter += 1;
      return Object.freeze({
        ok: true,
        authCode: `fake:${encodeURIComponent(pid)}:${encodeURIComponent(name)}:${counter}`,
      });
    },
    async syncAchievements(arg) {
      const ops = arg ? arg.ops : undefined;
      record("syncAchievements", { ops });
      if (!isSignedIn) return failAch("signin");
      if (!Array.isArray(ops) || ops.length < 1 || ops.length > 20) return failAch("error");
      return Object.freeze({
        ok: true,
        results: Object.freeze(ops.map((_, i) => Object.freeze({ i, ok: true }))),
      });
    },
    async showAchievements() {
      record("showAchievements");
      if (!isSignedIn) return failAch("signin");
      return Object.freeze({ ok: true });
    },
    setSignedIn(value) {
      isSignedIn = !!value;
    },
    setPlayer(newId, newName) {
      pid = String(newId);
      name = String(newName);
    },
    calls() {
      return log.map((c) => ({ ...c }));
    },
  });
}
