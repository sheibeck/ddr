// functions/board-names/core.js
//
// Phase 91.2 (BOARD-31, BOARD-32), D-01, D-04, D-06. The trusted writer of the
// board's player names: turns a verified Play Games link into a names/{uid}
// record, stamps that name onto every run the player owns (their 2.2.0
// @handle runs included), adopts an anonymous uid's runs when linking could
// not keep the uid, and releases the record on erase.
//
// THE TRUST ARGUMENT. The client never sends a name. The caller is whoever
// Google's Identity Toolkit accounts:lookup says the presented ID token
// belongs to (Google validates the token server-side), and the name is the
// providerUserInfo displayName Google itself wrote when it exchanged the
// player's Play Games server auth code. A client can rewrite its own
// top-level displayName with accounts:update but not a provider's entry, so
// the board's name cannot be forged by editing the account. If a live probe
// ever shows otherwise (spike gate A4), NAME_SOURCE=games switches the source
// to the Games API: the client sends a fresh server auth code, the function
// exchanges it with the web client secret, calls players/me and requires the
// player id to equal the linked provider's rawId. That switch is a redeploy
// with one env var, not a client update.
//
// Firestore is reached over REST with the runtime service account's token
// (metadataTokenGetter), which bypasses the security rules; so this module
// enforces ownership itself: it only ever writes names/{uid} and the runs of
// the uid Google verified, and only moves runs from an account that has no
// provider at all and whose own valid token the caller presents.
//
// ZERO DEPENDENCIES. The deploy uploads only this directory, so the module
// imports nothing from src/ and nothing from npm: Node 22 built-ins only
// (fetch, URLSearchParams). Two things are copies of the client's and are
// pinned equal by tests: deepKeyOf (src/browser/runDoc.js) and the sanitizing
// rule sanitizeName (src/browser/boardName.js#sanitizeBoardName).
//
// Never throws. claim and release resolve { status, body } in the HTTP
// contract's shape (91.2-CONTEXT interfaces); stamp resolves { ok, stamped }.
// Response bodies carry codes only: never a token, a secret or an upstream
// error body.

export const BOARD_NAME_MAX_CHARS = 64;

const IDENTITY_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GAMES_PLAYER_URL = "https://games.googleapis.com/games/v1/players/me";
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const PLAY_GAMES_PROVIDER = "playgames.google.com";

const QUERY_PAGE = 300;
const STAMP_BATCH = 500; // writes per commit when stamping (Firestore's ceiling)
const ADOPT_BATCH = 200; // runs per commit when adopting: an update and a delete each, so 400 writes
const REQUEST_TIMEOUT_MS = 20000;
const TOKEN_GUARD_MS = 60000;

// Google answers an unusable token with HTTP 400 and one of these messages.
const AUTH_ERROR_RE =
  /^(INVALID_ID_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND|USER_DISABLED|CREDENTIAL_TOO_OLD_LOGIN_AGAIN|MISSING_ID_TOKEN|INVALID_REFRESH_TOKEN)/;
const HASH_RE = /^[A-Za-z0-9]{1,64}$/;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * sanitizeName(raw) — NFC, control and format characters dropped, whitespace
 * runs collapsed to one space, trimmed, cut to 64 UTF-16 units without
 * splitting a surrogate pair. Null for a non-string or an empty result.
 * KEEP IN STEP with src/browser/boardName.js#sanitizeBoardName (a test runs
 * one input table through both).
 */
export function sanitizeName(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.normalize("NFC");
  s = s.replace(/[\p{Cc}\p{Cf}]/gu, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > BOARD_NAME_MAX_CHARS) {
    let end = BOARD_NAME_MAX_CHARS;
    const last = s.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    s = s.slice(0, end).trim();
  }
  return s === "" ? null : s;
}

/**
 * deepKeyOf(run) — floor desc, then more steps (floor * 1,000,000 + steps).
 * A copy of src/browser/runDoc.js#deepKeyOf (a test pins equality).
 */
export function deepKeyOf(run) {
  const floor = Number(run?.floor);
  const steps = Number(run?.steps);
  return floor * 1000000 + steps;
}

/**
 * metadataTokenGetter({ fetchFn, now }) — an async () => access token for the
 * runtime service account, read from the metadata server and cached until 60 s
 * before it expires. A failed read rejects (the core maps that to 502).
 */
export function metadataTokenGetter({ fetchFn, now = Date.now } = {}) {
  let cached = null;
  let expiresAt = 0;
  let inflight = null;
  return async function getToken() {
    if (cached && now() < expiresAt - TOKEN_GUARD_MS) return cached;
    if (inflight) return inflight;
    inflight = (async () => {
      const res = await fetchFn(METADATA_TOKEN_URL, { headers: { "Metadata-Flavor": "Google" } });
      if (!res.ok) throw new Error("metadata token unavailable");
      const json = await res.json();
      if (!json || typeof json.access_token !== "string" || json.access_token === "") {
        throw new Error("metadata token malformed");
      }
      const ttl = Number(json.expires_in);
      cached = json.access_token;
      expiresAt = now() + (Number.isFinite(ttl) ? ttl : 0) * 1000;
      return cached;
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}

function reply(status, error) {
  return { status, body: { ok: false, error } };
}

function timeoutSignal() {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;
}

function str(typedField) {
  return typedField && typeof typedField.stringValue === "string" ? typedField.stringValue : undefined;
}

// ---------------------------------------------------------------------------
// The core
// ---------------------------------------------------------------------------

/**
 * createBoardNameCore({ fetchFn, getAdminToken, adminHeaders, projectId,
 * apiKey, nameSource, pgsClientId, pgsClientSecret, now }) — { claim, release,
 * stamp, lookup }. See the module header. nameSource is "provider" (default)
 * or "games".
 */
export function createBoardNameCore({
  fetchFn,
  getAdminToken,
  adminHeaders = {},
  projectId,
  apiKey,
  nameSource = "provider",
  pgsClientId,
  pgsClientSecret,
  now = Date.now,
} = {}) {
  const docsRoot = `projects/${projectId}/databases/(default)/documents`;
  const docsBase = `${FIRESTORE_BASE}/${docsRoot}`;

  // One upstream call. Resolves { ok, status, json }; a network failure or a
  // timeout is { ok: false, status: 0 }. Never rejects.
  async function call(url, init) {
    try {
      const signal = timeoutSignal();
      const res = await fetchFn(url, signal ? { ...init, signal } : init);
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      return { ok: res.ok, status: res.status, json };
    } catch {
      return { ok: false, status: 0, json: null };
    }
  }

  // A Firestore call as the service account (IAM, rules bypassed).
  async function admin(suffix, init = {}) {
    let token;
    try {
      token = await getAdminToken();
    } catch {
      return { ok: false, status: 0, json: null };
    }
    return call(`${docsBase}${suffix}`, {
      ...init,
      headers: { ...adminHeaders, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  }

  const docPath = (collection, id) => `/${collection}/${encodeURIComponent(id)}`;

  // ---- Identity ------------------------------------------------------------

  /** lookup(idToken) — { ok: true, uid, providers, playGames } or { ok: false, status: 401|502, error }. */
  async function lookup(idToken) {
    if (typeof idToken !== "string" || idToken === "") return { ok: false, status: 401, error: "UNAUTHENTICATED" };
    const r = await call(`${IDENTITY_LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!r.ok) {
      const message = typeof r.json?.error?.message === "string" ? r.json.error.message : "";
      if (r.status === 400 && AUTH_ERROR_RE.test(message)) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
      return { ok: false, status: 502, error: "UPSTREAM" };
    }
    const user = Array.isArray(r.json?.users) ? r.json.users[0] : null;
    if (!user || typeof user.localId !== "string" || user.localId === "") {
      return { ok: false, status: 401, error: "UNAUTHENTICATED" };
    }
    const providers = Array.isArray(user.providerUserInfo) ? user.providerUserInfo : [];
    const playGames = providers.find((p) => p && p.providerId === PLAY_GAMES_PROVIDER) ?? null;
    return { ok: true, uid: user.localId, providers, playGames };
  }

  const lookupFailure = (who) => reply(who.status, who.error);

  // ---- Firestore reads and writes ----------------------------------------

  async function readDoc(collection, id) {
    const r = await admin(docPath(collection, id), { method: "GET" });
    if (r.ok) return { ok: true, found: true, fields: r.json?.fields ?? {} };
    if (r.status === 404) return { ok: true, found: false, fields: {} };
    return { ok: false };
  }

  async function writeName(uid, name) {
    const r = await admin(docPath("names", uid), {
      method: "PATCH",
      body: JSON.stringify({
        fields: {
          name: { stringValue: name },
          updatedAt: { timestampValue: new Date(now()).toISOString() },
        },
      }),
    });
    return r.ok;
  }

  async function deleteDoc(collection, id) {
    const r = await admin(docPath(collection, id), { method: "DELETE" });
    return r.ok || r.status === 404;
  }

  // Every run document of one uid, paged by document name. { ok, docs: [{ name, fields }] }.
  async function listRuns(uid) {
    const docs = [];
    let after = null;
    for (;;) {
      const structuredQuery = {
        from: [{ collectionId: "runs" }],
        where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: uid } } },
        orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
        limit: QUERY_PAGE,
      };
      if (after) structuredQuery.startAt = { values: [{ referenceValue: after }], before: false };
      const r = await admin(":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery }) });
      if (!r.ok || !Array.isArray(r.json)) return { ok: false, docs: [] };
      const page = r.json.filter((row) => row && row.document).map((row) => row.document);
      for (const d of page) docs.push({ name: d.name, fields: d.fields ?? {} });
      if (page.length < QUERY_PAGE) break;
      after = page[page.length - 1].name;
    }
    return { ok: true, docs };
  }

  async function commit(writes) {
    const r = await admin(":commit", { method: "POST", body: JSON.stringify({ writes }) });
    return r.ok;
  }

  /**
   * stamp(uid, name) — handle := name on every run of uid whose handle
   * differs (D-04, BOARD-32: a 2.2.0 @handle run is renamed too). Only the
   * handle field is written (updateMask), and only on a document that exists.
   */
  async function stamp(uid, name) {
    try {
      if (typeof uid !== "string" || uid === "" || typeof name !== "string" || name === "") {
        return { ok: false, stamped: 0 };
      }
      const listed = await listRuns(uid);
      if (!listed.ok) return { ok: false, stamped: 0 };
      const changed = listed.docs.filter((d) => str(d.fields.handle) !== name);
      for (let i = 0; i < changed.length; i += STAMP_BATCH) {
        const writes = changed.slice(i, i + STAMP_BATCH).map((d) => ({
          update: { name: d.name, fields: { handle: { stringValue: name } } },
          updateMask: { fieldPaths: ["handle"] },
          currentDocument: { exists: true },
        }));
        if (!(await commit(writes))) return { ok: false, stamped: 0 };
      }
      return { ok: true, stamped: changed.length };
    } catch {
      return { ok: false, stamped: 0 };
    }
  }

  /**
   * adoptRuns(fromUid, toUid, name) — moves every run of fromUid to toUid as
   * `<toUid>_<hash>`: the fields are copied verbatim except uid, handle and
   * deepKey (recomputed), then the source is deleted in the same commit. A
   * plain update with no precondition: the target id is deterministic and is
   * the same run, so a re-run after a partial failure is idempotent.
   */
  async function adoptRuns(fromUid, toUid, name) {
    const listed = await listRuns(fromUid);
    if (!listed.ok) return { ok: false, adopted: 0 };
    const moves = [];
    for (const d of listed.docs) {
      const hash = str(d.fields.hash);
      if (hash === undefined || !HASH_RE.test(hash)) continue;
      const fields = { ...d.fields };
      fields.uid = { stringValue: toUid };
      fields.handle = { stringValue: name };
      const floor = Number(d.fields.floor?.integerValue);
      const steps = Number(d.fields.steps?.integerValue);
      if (Number.isFinite(floor) && Number.isFinite(steps)) {
        fields.deepKey = { integerValue: String(deepKeyOf({ floor, steps })) };
      }
      moves.push({ from: d.name, to: `${docsRoot}/runs/${toUid}_${hash}`, fields });
    }
    for (let i = 0; i < moves.length; i += ADOPT_BATCH) {
      const writes = [];
      for (const m of moves.slice(i, i + ADOPT_BATCH)) {
        writes.push({ update: { name: m.to, fields: m.fields } });
        writes.push({ delete: m.from });
      }
      if (!(await commit(writes))) return { ok: false, adopted: 0 };
    }
    return { ok: true, adopted: moves.length };
  }

  // ---- The Games API source (G1/A4 fallback) --------------------------------

  // { name } or { failure: <reply> }.
  async function gamesName(gamesAuthCode, linkedRawId) {
    if (!pgsClientId || !pgsClientSecret) return { failure: reply(500, "INTERNAL") };
    // [ASSUMED] An empty redirect_uri is what Google expects when it exchanges
    // a Play Games server auth code; the live check at 91.2-10 settles it.
    const form = new URLSearchParams({
      code: gamesAuthCode,
      client_id: pgsClientId,
      client_secret: pgsClientSecret,
      redirect_uri: "",
      grant_type: "authorization_code",
    }).toString();
    const t = await call(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    // A spent or expired code is the client's cue to send a fresh one.
    if (t.status === 400 || t.status === 401) return { failure: reply(409, "NEEDS_GAMES_CODE") };
    const accessToken = t.json?.access_token;
    if (!t.ok || typeof accessToken !== "string" || accessToken === "") return { failure: reply(502, "UPSTREAM") };
    const me = await call(GAMES_PLAYER_URL, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
    if (!me.ok || typeof me.json?.playerId !== "string") return { failure: reply(502, "UPSTREAM") };
    if (typeof linkedRawId !== "string" || linkedRawId === "" || me.json.playerId !== linkedRawId) {
      return { failure: reply(403, "GAMES_MISMATCH") };
    }
    return { name: me.json.displayName };
  }

  // ---- claim / release -------------------------------------------------------

  async function claim({ idToken, adoptIdToken, gamesAuthCode } = {}) {
    try {
      const who = await lookup(idToken);
      if (!who.ok) return lookupFailure(who);
      if (!who.playGames) return reply(403, "NOT_LINKED");
      const uid = who.uid;

      // Validate the adopt request before anything is written.
      const wantsAdopt = adoptIdToken !== undefined && adoptIdToken !== null && adoptIdToken !== "";
      let adoptUid = null;
      if (wantsAdopt) {
        if (typeof adoptIdToken !== "string") return reply(403, "ADOPT_REFUSED");
        const anon = await lookup(adoptIdToken);
        if (!anon.ok) return anon.status === 502 ? lookupFailure(anon) : reply(403, "ADOPT_REFUSED");
        if (anon.uid === uid || anon.providers.length > 0) return reply(403, "ADOPT_REFUSED");
        adoptUid = anon.uid;
      }

      // The name: an admin override wins, then the configured source.
      const override = await readDoc("nameOverrides", uid);
      if (!override.ok) return reply(502, "UPSTREAM");
      let name = null;
      let overridden = false;
      if (override.found) {
        name = sanitizeName(str(override.fields.name));
        overridden = name !== null;
      }
      if (name === null) {
        let raw;
        if (nameSource === "games") {
          if (typeof gamesAuthCode !== "string" || gamesAuthCode === "") return reply(409, "NEEDS_GAMES_CODE");
          const g = await gamesName(gamesAuthCode, who.playGames.rawId ?? who.playGames.federatedId);
          if (g.failure) return g.failure;
          raw = g.name;
        } else {
          raw = who.playGames.displayName;
        }
        name = sanitizeName(raw);
        if (name === null) return reply(422, "NO_NAME");
      }

      // Write names/{uid} only when it changed.
      const current = await readDoc("names", uid);
      if (!current.ok) return reply(502, "UPSTREAM");
      if (!current.found || str(current.fields.name) !== name) {
        if (!(await writeName(uid, name))) return reply(502, "UPSTREAM");
      }

      // Adopt first, so the stamp pass sees (and skips) the moved runs.
      let adopted = 0;
      if (adoptUid !== null) {
        const a = await adoptRuns(adoptUid, uid, name);
        if (!a.ok) return reply(502, "UPSTREAM");
        adopted = a.adopted;
      }

      const s = await stamp(uid, name);
      if (!s.ok) return reply(502, "UPSTREAM");

      return { status: 200, body: { ok: true, name, overridden, stamped: s.stamped, adopted } };
    } catch {
      return reply(500, "INTERNAL");
    }
  }

  async function release({ idToken } = {}) {
    try {
      const who = await lookup(idToken);
      if (!who.ok) return lookupFailure(who);
      if (!(await deleteDoc("names", who.uid))) return reply(502, "UPSTREAM");
      return { status: 200, body: { ok: true, released: true } };
    } catch {
      return reply(500, "INTERNAL");
    }
  }

  return Object.freeze({ claim, release, stamp, lookup });
}
