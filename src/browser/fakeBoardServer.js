// src/browser/fakeBoardServer.js
//
// Phase 83 (SRV-03, SRV-09), Plan 04 Task 1. The browser dev loop's
// in-memory stand-in for the live board — the Firestore/Identity Toolkit/
// Secure Token REST surfaces this project's three services expose
// (anonymous sign-up/refresh/delete, Firestore runQuery/runAggregationQuery/
// commit/document get/delete/patch), enforcing exactly the contract
// firebase/firestore.rules deploys through the same JS mirrors the rules
// are kept equal to: src/browser/runDoc.js's validateRunDoc (runs),
// src/browser/bugReport.js's validateReport and src/browser/reportLimits.js's
// validateLimitStep (bugReports/reportLimits). The shell selects this fake
// only in the browser dev loop (non-native); Android debug and release
// builds both talk to the live project — the shell makes that choice in
// Phases 84/85, not here. This module must be updated together with
// firebase/firestore.rules whenever the rules change (test/unit/
// firestore-rules.test.js is the contract that keeps the rules and their JS
// mirrors equal; this file is a third, hand-written mirror of the same
// contract, exercised by test/unit/fakeBoardServer.test.js instead).
//
// Phase 84 (BOARD-20, BOARD-22): a run create's `note`/`when` fields are
// enforced the same way here as by the live rules — commitRunCreate passes
// this factory's own injected `now()` into validateRunDoc so the fake's
// `when` upper bound tracks its own clock, not the live server's.
//
// `existsResponse` exists because the live answer to a duplicate run create
// (400 FAILED_PRECONDITION, 403 PERMISSION_DENIED or 409 ALREADY_EXISTS) is
// unverified until 83-08's live smoke test confirms which one Firestore
// actually returns; every later module that reads this fake's answer should
// treat all three as "already there, acknowledged".
//
// Phase 87 (BOARD-28): `acceptLegacyDeepKey` (default false) is the DEPTH-key
// transition mode. The default mirrors the FINAL rules (firebase/
// firestore.rules: deepKey = floor * 1,000,000 + steps only); with it true the
// fake mirrors firebase/firestore.transition.rules (the new formula or the
// shipped 2.2.0 one, floor * 1,000,000 + (999999 - steps), nothing else).
// Delete the option with the transition files at the 2.3 cutover. The fake
// also accepts an admin single-field PATCH of a run's deepKey (the way
// Firestore's IAM-level admin access does), which is what tools/
// boards-admin.mjs's rekey-deep uses.
//
// Phase 91.2 (BOARD-31, BOARD-32): the Play Games identity mirror and the
// admin-only names collections. accounts:signInWithIdp (create, sign in or
// link with an idToken, single-use fake codes `fake:<pid>:<name>:<n>`),
// accounts:lookup (providerUserInfo), accounts:update (unlink, top-level
// displayName only; linkProviderUserInfo is refused), accounts:delete frees
// the player. names/{uid} and nameOverrides/{uid} answer only the admin token
// (clients are denied read, write and query); admin :runQuery reads them and
// runs, and admin :commit applies run updates (with or without an updateMask),
// deletes and creates with no client rule, all-or-nothing, which is how the
// boardName function and tools/boards-admin.mjs write. No client create or
// update rule changed here. Options, each modelling one spike gate offline:
//   playGamesEnabled   false -> OPERATION_NOT_ALLOWED (G4: provider not enabled)
//   linkKeepsUid       false -> a link answers a new uid (G3: uid not kept)
//   refreshProviderName false -> the provider name never refreshes (G2)
//   nameSource         "games" -> the boardName emulation asks for a Games
//                      auth code (G1/A4 fallback)
//
// The boardName Cloud Function is emulated at BOARD_NAME_FN.url (any path
// match, no API-key check, CORS headers on every answer). That emulation is a
// hand-written MIRROR of functions/board-names/core.js and index.js, kept
// equal by test/unit/board-names-contract.test.js, which runs one scenario
// table through the real core (pointed at this fake as its Google: Identity
// Toolkit, Firestore REST, plus the OAuth token and Games players/me stand-ins
// below) and through this endpoint. Update both together.
//
// Pure, DOM-free: never calls a bare global fetch and never reads window,
// document, navigator or localStorage. The only side effects are in-memory
// (this module's own closures) and the injected `now()` clock.

import { RUN_COLLECTION, validateRunDoc, runDocId, deepKeyOf, legacyDeepKeyOf, LIST_LIMIT_MAX } from "./runDoc.js";
import { sanitizeBoardName } from "./boardName.js";
import { validateReport } from "./bugReport.js";
import { REPORT_LIMITS_COLLECTION, validateLimitStep, decodeLimitDoc } from "./reportLimits.js";
import { isValidHandle } from "./handles.js";
import {
  FIRESTORE_BASE,
  IDENTITY_BASE,
  SECURETOKEN_BASE,
  documentsPath,
  docName,
  toFirestoreFields,
  fromFirestoreFields,
  fromFirestoreValue,
} from "./firestoreRest.js";
import { FIREBASE_CONFIG, BOARD_NAME_FN } from "./firebaseConfig.js";

export const FAKE_ADMIN_TOKEN = "fake-admin-token";

const BUG_REPORTS_COLLECTION = "bugReports";
const BANNED_COLLECTION = "banned";
const NAMES_COLLECTION = "names";
const NAME_OVERRIDES_COLLECTION = "nameOverrides";
const NAME_COLLECTIONS = [NAMES_COLLECTION, NAME_OVERRIDES_COLLECTION];
const PLAY_GAMES_PROVIDER = "playgames.google.com";
const ADMIN_COMMIT_MAX_WRITES = 500;

// The Google endpoints the boardName function core calls when NAME_SOURCE is
// "games" (the G1/A4 fallback): the OAuth token exchange and the Games API.
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GAMES_PLAYER_URL = "https://games.googleapis.com/games/v1/players/me";

// The boardName emulation's HTTP surface (functions/board-names/index.js).
const NAME_FN_MAX_FIELD_CHARS = 8192;
const NAME_FN_HASH_RE = /^[A-Za-z0-9]{1,64}$/;
const CORS_ORIGIN = { "Access-Control-Allow-Origin": "*" };
const CORS_PREFLIGHT = {
  ...CORS_ORIGIN,
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "3600",
};

function errorBody(code, status) {
  return { error: { code, message: status, status } };
}

function jsonResponse(status, body, headers) {
  const lower = {};
  for (const [k, v] of Object.entries(headers ?? {})) lower[k.toLowerCase()] = v;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => lower[String(k).toLowerCase()] ?? null },
    // An empty body (a 204) rejects in json() like a real Response.
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
      return body;
    },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function parseUrl(rawUrl) {
  const qIndex = rawUrl.indexOf("?");
  const path = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const query = new URLSearchParams(qIndex === -1 ? "" : rawUrl.slice(qIndex + 1));
  return { path, query };
}

function parseJsonBody(bodyStr) {
  if (typeof bodyStr !== "string") return null;
  try {
    return JSON.parse(bodyStr);
  } catch {
    return null;
  }
}

function findAuthHeader(init) {
  const headers = (init && init.headers) || {};
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "authorization") return headers[key];
  }
  return undefined;
}

function splitName(name) {
  const parts = String(name).split("/");
  return { collection: parts[parts.length - 2], id: parts[parts.length - 1] };
}

function hasTransform(write, fieldPath) {
  return Array.isArray(write.updateTransforms) && write.updateTransforms.some((t) => t.fieldPath === fieldPath);
}

function matchesFilter(doc, where) {
  if (!where) return true;
  if (where.compositeFilter) {
    return where.compositeFilter.filters.every((f) => matchesFilter(doc, f));
  }
  if (where.fieldFilter) {
    const { field, op, value } = where.fieldFilter;
    const fieldPath = field.fieldPath;
    const have = doc[fieldPath];
    const want = fromFirestoreValue(value);
    if (op === "EQUAL") return have === want;
    if (op === "GREATER_THAN") return typeof have === "number" && typeof want === "number" && have > want;
    return false;
  }
  return false;
}

function sortRecords(records, orderBy) {
  const list = [...records];
  const hasNameOrder = orderBy.some((o) => o.field?.fieldPath === "__name__");
  list.sort((a, b) => {
    for (const o of orderBy) {
      const fp = o.field.fieldPath;
      const dir = o.direction === "DESCENDING" ? -1 : 1;
      const av = fp === "__name__" ? a.name : a.doc[fp];
      const bv = fp === "__name__" ? b.name : b.doc[fp];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
    }
    if (!hasNameOrder) {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
    }
    return 0;
  });
  return list;
}

/**
 * createFakeBoardFetch({ config, now, online, existsResponse,
 * anonymousEnabled, runs, tokenTtlMs, acceptLegacyDeepKey }) — the in-memory
 * fetchFn factory.
 * Returns { fetchFn, calls, docs, reports, limits, users, banned, setOnline,
 * ban, unban }. Never throws.
 */
export function createFakeBoardFetch(opts = {}) {
  const {
    config = FIREBASE_CONFIG,
    now = Date.now,
    online: initialOnline = true,
    existsResponse = "precondition",
    anonymousEnabled = true,
    runs: seedRuns = [],
    tokenTtlMs = 3600000,
    acceptLegacyDeepKey = false,
    playGamesEnabled = true,
    linkKeepsUid = true,
    refreshProviderName = true,
    nameSource = "provider",
  } = opts;

  let online = initialOnline !== false;

  const runStore = new Map(); // id -> { id, doc, createdAtIso, name, createTimeIso, updateTimeIso }
  const reports = new Map(); // id -> report fields (no uid)
  const limits = new Map(); // uid -> { lastMs, dayMs, count }
  const banned = new Set();
  const accounts = new Map(); // uid -> { uid, displayName?, providers: [{ providerId, rawId, federatedId, displayName }] }
  const linkedPlayers = new Map(); // Play Games playerId -> uid
  const usedCodes = new Set(); // fake Play Games auth codes already exchanged (single-use)
  const gamesTokens = new Map(); // fake Games API access token -> { playerId, displayName }
  const nameDocs = { names: new Map(), nameOverrides: new Map() }; // collection -> uid -> { fields (typed), createTimeIso, updateTimeIso }
  const idTokens = new Map(); // idToken -> { uid, issuedAtMs }
  const refreshTokens = new Map(); // refreshToken -> uid
  const calls = [];

  let uidCounter = 0;
  let tokenCounter = 0;

  function nowIso() {
    return new Date(now()).toISOString();
  }

  function nextUid() {
    uidCounter += 1;
    return `fakeuid${String(uidCounter).padStart(6, "0")}`;
  }

  function nextToken(prefix) {
    tokenCounter += 1;
    return `${prefix}${String(tokenCounter).padStart(8, "0")}`;
  }

  function denied() {
    return { status: 403, body: errorBody(403, "PERMISSION_DENIED") };
  }

  function notFound() {
    return { status: 404, body: errorBody(404, "NOT_FOUND") };
  }

  function existsError() {
    if (existsResponse === "denied") return { status: 403, body: errorBody(403, "PERMISSION_DENIED") };
    if (existsResponse === "conflict") return { status: 409, body: errorBody(409, "ALREADY_EXISTS") };
    return { status: 400, body: errorBody(400, "FAILED_PRECONDITION") };
  }

  function storeRun(id, clientDoc, createdAtIso) {
    runStore.set(id, {
      id,
      doc: Object.freeze({ ...clientDoc }),
      createdAtIso,
      name: docName(config, RUN_COLLECTION, id),
      createTimeIso: createdAtIso,
      updateTimeIso: createdAtIso,
    });
  }

  // Seed runs are inserted exactly as given (id + doc, matching
  // buildRunDoc's return shape), with no validation.
  for (const seed of Array.isArray(seedRuns) ? seedRuns : []) {
    if (!seed || typeof seed !== "object" || typeof seed.id !== "string") continue;
    const raw = seed.doc && typeof seed.doc === "object" ? seed.doc : {};
    const { createdAt, ...clientDoc } = raw;
    storeRun(seed.id, clientDoc, typeof createdAt === "string" ? createdAt : nowIso());
  }

  function encodeRunDocFields(clientDoc, createdAtIso) {
    return { ...toFirestoreFields(clientDoc), createdAt: { timestampValue: createdAtIso } };
  }

  function commitOkBody(n, timeIso) {
    return { writeResults: Array.from({ length: n }, () => ({ updateTime: timeIso })), commitTime: timeIso };
  }

  // --- auth --------------------------------------------------------------

  function authInfo(init, nowMs) {
    const header = findAuthHeader(init);
    if (typeof header !== "string") return { kind: "none" };
    const m = /^Bearer\s+(.+)$/.exec(header);
    if (!m) return { kind: "none" };
    const token = m[1];
    if (token === FAKE_ADMIN_TOKEN) return { kind: "admin" };
    const rec = idTokens.get(token);
    if (!rec) return { kind: "invalid" };
    if (nowMs > rec.issuedAtMs + tokenTtlMs) return { kind: "expired" };
    return { kind: "user", uid: rec.uid };
  }

  // --- identity: accounts:signUp / accounts:delete, securetoken:token ----

  function createAccount() {
    const uid = nextUid();
    accounts.set(uid, { uid, displayName: undefined, providers: [] });
    return accounts.get(uid);
  }

  function mintTokens(uid) {
    const idToken = nextToken("idtok");
    const refreshToken = nextToken("rtok");
    idTokens.set(idToken, { uid, issuedAtMs: now() });
    refreshTokens.set(refreshToken, uid);
    return { idToken, refreshToken };
  }

  function handleSignUp() {
    if (anonymousEnabled === false) return { status: 400, body: errorBody(400, "OPERATION_NOT_ALLOWED") };
    const { uid } = createAccount();
    const { idToken, refreshToken } = mintTokens(uid);
    return { status: 200, body: { idToken, refreshToken, expiresIn: "3600", localId: uid } };
  }

  // Resolves the idToken in an Identity Toolkit body to a live account:
  // { ok: true, uid, account } or { ok: false, result } carrying the 400 answer.
  function resolveIdToken(idToken) {
    const rec = typeof idToken === "string" ? idTokens.get(idToken) : undefined;
    if (!rec) return { ok: false, result: { status: 400, body: errorBody(400, "INVALID_ID_TOKEN") } };
    if (now() > rec.issuedAtMs + tokenTtlMs) return { ok: false, result: { status: 400, body: errorBody(400, "TOKEN_EXPIRED") } };
    const account = accounts.get(rec.uid);
    if (!account) return { ok: false, result: { status: 400, body: errorBody(400, "USER_NOT_FOUND") } };
    return { ok: true, uid: rec.uid, account };
  }

  function providerInfoOf(account) {
    return Object.freeze(account.providers.map((p) => Object.freeze({ ...p })));
  }

  function freePlayersOf(account) {
    for (const p of account.providers) {
      if (linkedPlayers.get(p.rawId) === account.uid) linkedPlayers.delete(p.rawId);
    }
  }

  function handleAccountDelete(init) {
    const body = parseJsonBody(init.body);
    const idToken = body?.idToken;
    const rec = typeof idToken === "string" ? idTokens.get(idToken) : undefined;
    if (!rec) return { status: 400, body: errorBody(400, "INVALID_ID_TOKEN") };
    const { uid } = rec;
    const account = accounts.get(uid);
    if (account) freePlayersOf(account);
    for (const [tok, r] of [...idTokens]) if (r.uid === uid) idTokens.delete(tok);
    for (const [tok, u] of [...refreshTokens]) if (u === uid) refreshTokens.delete(tok);
    accounts.delete(uid);
    return { status: 200, body: {} };
  }

  // --- Play Games: accounts:signInWithIdp / lookup / update ------------------
  //
  // Fake Play Games auth codes are `fake:<pid>:<name>:<n>` (percent-encoded
  // parts; src/browser/playIdentity.js#createFakePlayIdentity mints them).
  // Every code is single-use. `playGamesEnabled` false models spike gate G4
  // failing (the provider is not enabled on the project); `linkKeepsUid` false
  // models G3 failing (a link answers a different uid); `refreshProviderName`
  // false models G2 failing (the provider's name never changes after the first
  // sign-in).

  const FAKE_CODE_RE = /^fake:([^:]*):([^:]*):(\d+)$/;

  function parseFakeCode(authCode) {
    const m = typeof authCode === "string" ? FAKE_CODE_RE.exec(authCode) : null;
    if (!m) return null;
    try {
      const playerId = decodeURIComponent(m[1]);
      if (playerId === "") return null;
      return { playerId, displayName: decodeURIComponent(m[2]) };
    } catch {
      return null;
    }
  }

  function linkProvider(account, player) {
    account.providers.push({
      providerId: PLAY_GAMES_PROVIDER,
      rawId: player.playerId,
      federatedId: player.playerId,
      displayName: player.displayName,
    });
    linkedPlayers.set(player.playerId, account.uid);
  }

  function signedInBody(account, provider, isNewUser) {
    const { idToken, refreshToken } = mintTokens(account.uid);
    return {
      status: 200,
      body: {
        kind: "identitytoolkit#VerifyAssertionResponse",
        localId: account.uid,
        idToken,
        refreshToken,
        expiresIn: "3600",
        providerId: PLAY_GAMES_PROVIDER,
        federatedId: provider.federatedId,
        displayName: provider.displayName,
        isNewUser,
      },
    };
  }

  function handleSignInWithIdp(init) {
    if (playGamesEnabled === false) return { status: 400, body: errorBody(400, "OPERATION_NOT_ALLOWED") };
    const body = parseJsonBody(init.body) || {};
    const post = new URLSearchParams(typeof body.postBody === "string" ? body.postBody : "");
    if (post.get("providerId") !== PLAY_GAMES_PROVIDER) return { status: 400, body: errorBody(400, "INVALID_IDP_RESPONSE") };
    const authCode = post.get("code");
    const player = parseFakeCode(authCode);
    if (!player || usedCodes.has(authCode)) return { status: 400, body: errorBody(400, "INVALID_IDP_RESPONSE") };

    let caller = null;
    if (body.idToken !== undefined && body.idToken !== null && body.idToken !== "") {
      const who = resolveIdToken(body.idToken);
      if (!who.ok) return who.result;
      caller = who.account;
    }
    usedCodes.add(authCode);

    const linkedUid = linkedPlayers.get(player.playerId);
    const linked = linkedUid !== undefined ? accounts.get(linkedUid) : undefined;

    // The same account (or a plain sign-in): refresh the provider's name, answer its uid.
    if (linked && (caller === null || caller.uid === linked.uid)) {
      const provider = linked.providers.find((p) => p.rawId === player.playerId);
      if (refreshProviderName !== false) provider.displayName = player.displayName;
      return signedInBody(linked, provider, false);
    }

    // The player is linked to another uid: the credential cannot be linked here.
    if (linked) {
      if (body.returnIdpCredential === true) {
        return { status: 200, body: { kind: "identitytoolkit#VerifyAssertionResponse", errorMessage: "FEDERATED_USER_ID_ALREADY_LINKED", providerId: PLAY_GAMES_PROVIDER, federatedId: player.playerId } };
      }
      return { status: 400, body: errorBody(400, "FEDERATED_USER_ID_ALREADY_LINKED") };
    }

    // An unlinked player. With a caller that is a link (the uid is kept unless
    // linkKeepsUid is false); without one, or when the uid is not kept, a new account.
    if (caller && caller.providers.some((p) => p.providerId === PLAY_GAMES_PROVIDER)) {
      return { status: 400, body: errorBody(400, "PROVIDER_ALREADY_LINKED") };
    }
    if (caller && linkKeepsUid !== false) {
      linkProvider(caller, player);
      return signedInBody(caller, caller.providers[caller.providers.length - 1], false);
    }
    const fresh = createAccount();
    linkProvider(fresh, player);
    return signedInBody(fresh, fresh.providers[0], true);
  }

  function handleLookup(init) {
    const body = parseJsonBody(init.body);
    const who = resolveIdToken(body?.idToken);
    if (!who.ok) return who.result;
    const user = { localId: who.uid, providerUserInfo: providerInfoOf(who.account).map((p) => ({ ...p })) };
    if (who.account.displayName !== undefined) user.displayName = who.account.displayName;
    return { status: 200, body: { kind: "identitytoolkit#GetAccountInfoResponse", users: [user] } };
  }

  // A signed-in user may unlink a provider and change the TOP-LEVEL displayName;
  // they cannot write a provider's entry (linkProviderUserInfo is admin-only),
  // which is what spike gate A4 relies on.
  function handleUpdate(init) {
    const body = parseJsonBody(init.body);
    const who = resolveIdToken(body?.idToken);
    if (!who.ok) return who.result;
    if (body.linkProviderUserInfo !== undefined) return { status: 400, body: errorBody(400, "ADMIN_ONLY_OPERATION") };
    const account = who.account;
    if (Array.isArray(body.deleteProvider)) {
      const gone = account.providers.filter((p) => body.deleteProvider.includes(p.providerId));
      for (const p of gone) {
        if (linkedPlayers.get(p.rawId) === account.uid) linkedPlayers.delete(p.rawId);
      }
      account.providers = account.providers.filter((p) => !body.deleteProvider.includes(p.providerId));
    }
    if (Array.isArray(body.deleteAttribute) && body.deleteAttribute.includes("DISPLAY_NAME")) account.displayName = undefined;
    if (typeof body.displayName === "string") account.displayName = body.displayName;
    const out = { kind: "identitytoolkit#SetAccountInfoResponse", localId: account.uid, providerUserInfo: providerInfoOf(account).map((p) => ({ ...p })) };
    if (account.displayName !== undefined) out.displayName = account.displayName;
    return { status: 200, body: out };
  }

  function handleRefresh(init) {
    const params = new URLSearchParams(typeof init.body === "string" ? init.body : "");
    const refreshToken = params.get("refresh_token");
    const uid = refreshToken ? refreshTokens.get(refreshToken) : undefined;
    if (!uid) return { status: 400, body: errorBody(400, "INVALID_REFRESH_TOKEN") };
    const idToken = nextToken("idtok");
    idTokens.set(idToken, { uid, issuedAtMs: now() });
    return {
      status: 200,
      body: {
        access_token: idToken,
        id_token: idToken,
        refresh_token: refreshToken,
        expires_in: "3600",
        token_type: "Bearer",
        user_id: uid,
        project_id: config.projectId,
      },
    };
  }

  // --- runQuery / runAggregationQuery -------------------------------------

  function runQueryExec(structuredQuery, authKind) {
    if (!structuredQuery) return denied();
    const { from, where, orderBy = [], limit, startAt } = structuredQuery;
    const collectionId = from?.[0]?.collectionId;
    // names / nameOverrides are closed to clients: only an admin query reads them.
    const isNameCollection = NAME_COLLECTIONS.includes(collectionId);
    if (collectionId !== RUN_COLLECTION && !(isNameCollection && authKind === "admin")) return denied();
    if (authKind !== "admin") {
      if (!Number.isInteger(limit) || limit > LIST_LIMIT_MAX) return denied();
    }
    let records = isNameCollection
      ? [...nameDocs[collectionId]].map(([uid, rec]) => ({
          name: docName(config, collectionId, uid),
          doc: fromFirestoreFields(rec.fields),
          fieldsTyped: rec.fields,
          createTimeIso: rec.createTimeIso,
          updateTimeIso: rec.updateTimeIso,
        }))
      : [...runStore.values()];
    if (where) records = records.filter((r) => matchesFilter(r.doc, where));
    records = sortRecords(records, orderBy);
    if (startAt) {
      const cursorName = startAt.values?.[0]?.referenceValue;
      records = records.filter((r) => r.name > cursorName);
    }
    if (Number.isInteger(limit)) records = records.slice(0, limit);
    const hits = records.map((r) => ({
      document: { name: r.name, fields: r.fieldsTyped ?? encodeRunDocFields(r.doc, r.createdAtIso), createTime: r.createTimeIso, updateTime: r.updateTimeIso },
      readTime: nowIso(),
    }));
    return { status: 200, body: hits.length ? hits : [{ readTime: nowIso() }] };
  }

  function aggregationQueryExec(saq, authKind) {
    if (!saq) return denied();
    const { aggregations, structuredQuery } = saq;
    const collectionId = structuredQuery?.from?.[0]?.collectionId;
    if (collectionId !== RUN_COLLECTION) return denied();
    let records = [...runStore.values()];
    if (structuredQuery.where) records = records.filter((r) => matchesFilter(r.doc, structuredQuery.where));
    const alias = aggregations?.[0]?.alias || "count";
    return { status: 200, body: [{ result: { aggregateFields: { [alias]: { integerValue: String(records.length) } } }, readTime: nowIso() }] };
  }

  // --- :commit -------------------------------------------------------------
  //
  // Multi-write commits: handleUpdateCommit and deleteCommit can each carry
  // N writes for the SAME collection (the "re-roll rewrites handle on all
  // of the player's existing runs" flow, CONTEXT "Identity & the @handle").
  // These are validated as a batch (every write must be individually valid)
  // and applied only once every write in the batch passes — one failing
  // write changes nothing.

  function classifyWrite(write) {
    if (write.delete) {
      const { collection, id } = splitName(write.delete);
      return { kind: "delete", collection, id, write };
    }
    if (write.update) {
      const { collection, id } = splitName(write.update.name);
      if (write.updateMask) return { kind: "handleUpdate", collection, id, write };
      if (hasTransform(write, "createdAt")) return { kind: "runCreate", collection, id, write };
      if (hasTransform(write, "last")) return { kind: "limitWrite", collection, id, write };
      if (write.currentDocument?.exists === false && !(write.updateTransforms?.length > 0)) return { kind: "reportCreate", collection, id, write };
      return { kind: "unknown", collection, id, write };
    }
    return { kind: "unknown", collection: null, id: null, write };
  }

  function validateRunDeleteWrite(c, authKind, authUid) {
    const rec = runStore.get(c.id);
    if (!rec || authKind !== "user" || rec.doc.uid !== authUid) return null;
    return { apply: () => runStore.delete(c.id) };
  }

  function validateHandleUpdateWrite(c, authKind, authUid) {
    const rec = runStore.get(c.id);
    const fieldPaths = c.write.updateMask?.fieldPaths;
    const validMask = Array.isArray(fieldPaths) && fieldPaths.length === 1 && fieldPaths[0] === "handle";
    const fields = fromFirestoreFields(c.write.update.fields);
    const ownerOk = !!rec && authKind === "user" && rec.doc.uid === authUid;
    const handleOk = isValidHandle(fields.handle);
    if (!validMask || !ownerOk || !handleOk) return null;
    return {
      apply: () => {
        const updateTimeIso = nowIso();
        runStore.set(c.id, { ...rec, doc: Object.freeze({ ...rec.doc, handle: fields.handle }), updateTimeIso });
      },
    };
  }

  function applyAtomic(classified, validate) {
    const applies = [];
    for (const c of classified) {
      const v = validate(c);
      if (!v) return denied();
      applies.push(v.apply);
    }
    for (const apply of applies) apply();
    return { status: 200, body: commitOkBody(classified.length, nowIso()) };
  }

  // Transition mode (Phase 87 BOARD-28): the one failure the transition rules
  // forgive is a deepKey equal to the 2.2.0 formula; anything else denies.
  function runDocValid(clientDoc, validateOpts) {
    const fails = validateRunDoc(clientDoc, validateOpts);
    if (fails.length === 0) return true;
    return (
      acceptLegacyDeepKey === true &&
      fails.length === 1 &&
      fails[0] === "deepkey" &&
      Number.isInteger(clientDoc.deepKey) &&
      clientDoc.deepKey === legacyDeepKeyOf(clientDoc)
    );
  }

  function commitRunCreate(id, write, authKind, authUid) {
    const clientDoc = fromFirestoreFields(write.update.fields);
    if (authKind === "user") {
      if (clientDoc.uid !== authUid) return denied();
      if (id !== runDocId(authUid, clientDoc.hash)) return denied();
      if (banned.has(authUid)) return denied();
      if (!runDocValid(clientDoc, { uid: authUid, now: now() })) return denied();
    } else if (authKind === "admin") {
      if (!runDocValid(clientDoc, { now: now() })) return denied();
    } else {
      return denied();
    }
    if (runStore.has(id)) return existsError();
    const createdAtIso = nowIso();
    storeRun(id, clientDoc, createdAtIso);
    return { status: 200, body: commitOkBody(1, createdAtIso) };
  }

  function commitLimitOnly(uid, write, authKind, authUid) {
    if (!(authKind === "user" && authUid === uid)) return denied();
    const before = limits.has(uid) ? limits.get(uid) : null;
    const fields = fromFirestoreFields(write.update.fields);
    const nowMs = now();
    const after = { lastMs: nowMs, dayMs: Date.parse(fields.day), count: fields.count };
    const create = !limits.has(uid);
    const wantExists = write.currentDocument?.exists;
    if (create && wantExists !== false) return denied();
    if (!create && wantExists !== true) return denied();
    if (validateLimitStep(before, after, nowMs).length > 0) return denied();
    limits.set(uid, after);
    return { status: 200, body: commitOkBody(1, nowIso()) };
  }

  function commitReportPlusLimit(reportId, reportWrite, uid, limitWrite, authKind, authUid) {
    if (authKind !== "user" || authUid !== uid) return denied();
    if (reports.has(reportId)) return denied();
    const report = fromFirestoreFields(reportWrite.update.fields);
    if (validateReport(report).length > 0) return denied();
    const before = limits.has(uid) ? limits.get(uid) : null;
    const limitFields = fromFirestoreFields(limitWrite.update.fields);
    const nowMs = now();
    const after = { lastMs: nowMs, dayMs: Date.parse(limitFields.day), count: limitFields.count };
    const create = !limits.has(uid);
    const wantExists = limitWrite.currentDocument?.exists;
    if (create && wantExists !== false) return denied();
    if (!create && wantExists !== true) return denied();
    if (validateLimitStep(before, after, nowMs).length > 0) return denied();
    reports.set(reportId, Object.freeze({ ...report }));
    limits.set(uid, after);
    return { status: 200, body: commitOkBody(2, nowIso()) };
  }

  // Admin :commit over runs (the boardName function and tools/boards-admin.mjs
  // run as the service account, which bypasses the rules): updates with or
  // without an updateMask, deletes and creates, applied in order with the
  // currentDocument.exists preconditions and all-or-nothing, with no client
  // rule applied. Firestore's 500-writes-per-commit ceiling applies.
  function adminRunCommit(writes) {
    if (writes.length > ADMIN_COMMIT_MAX_WRITES) return { status: 400, body: errorBody(400, "INVALID_ARGUMENT") };
    const staged = new Map(runStore);
    const timeIso = nowIso();
    for (const write of writes) {
      if (write.delete) {
        staged.delete(splitName(write.delete).id);
        continue;
      }
      const id = splitName(write.update.name).id;
      const have = staged.get(id);
      const wantExists = write.currentDocument?.exists;
      if (wantExists === true && !have) return notFound();
      if (wantExists === false && have) return existsError();
      const { createdAt, ...clientFields } = fromFirestoreFields(write.update.fields);
      const maskPaths = write.updateMask?.fieldPaths;
      let doc;
      if (Array.isArray(maskPaths)) {
        doc = { ...(have ? have.doc : {}) };
        for (const fp of maskPaths) {
          if (fp in clientFields) doc[fp] = clientFields[fp];
          else delete doc[fp];
        }
      } else {
        doc = clientFields;
      }
      let createdAtIso = have ? have.createdAtIso : timeIso;
      if (!Array.isArray(maskPaths) && !hasTransform(write, "createdAt") && typeof createdAt === "string") createdAtIso = createdAt;
      staged.set(id, {
        id,
        doc: Object.freeze(doc),
        createdAtIso,
        name: docName(config, RUN_COLLECTION, id),
        createTimeIso: have ? have.createTimeIso : createdAtIso,
        updateTimeIso: timeIso,
      });
    }
    runStore.clear();
    for (const [id, rec] of staged) runStore.set(id, rec);
    return { status: 200, body: commitOkBody(writes.length, timeIso) };
  }

  function commitDispatch(body, authKind, authUid) {
    const writes = Array.isArray(body?.writes) ? body.writes : [];
    if (writes.length === 0) return denied();
    const classified = writes.map(classifyWrite);

    // A lone admin run create keeps its shape check below; every other
    // all-runs admin commit skips the client rules.
    if (
      authKind === "admin" &&
      classified.every((c) => c.collection === RUN_COLLECTION) &&
      !(writes.length === 1 && classified[0].kind === "runCreate")
    ) {
      return adminRunCommit(writes);
    }

    if (classified.every((c) => c.kind === "delete" && c.collection === RUN_COLLECTION)) {
      return applyAtomic(classified, (c) => validateRunDeleteWrite(c, authKind, authUid));
    }
    if (classified.every((c) => c.kind === "handleUpdate" && c.collection === RUN_COLLECTION)) {
      return applyAtomic(classified, (c) => validateHandleUpdateWrite(c, authKind, authUid));
    }
    if (writes.length === 1 && classified[0].kind === "runCreate" && classified[0].collection === RUN_COLLECTION) {
      return commitRunCreate(classified[0].id, classified[0].write, authKind, authUid);
    }
    if (writes.length === 1 && classified[0].kind === "limitWrite" && classified[0].collection === REPORT_LIMITS_COLLECTION) {
      return commitLimitOnly(classified[0].id, classified[0].write, authKind, authUid);
    }
    if (
      writes.length === 2 &&
      classified[0].kind === "reportCreate" &&
      classified[0].collection === BUG_REPORTS_COLLECTION &&
      classified[1].kind === "limitWrite" &&
      classified[1].collection === REPORT_LIMITS_COLLECTION
    ) {
      return commitReportPlusLimit(classified[0].id, classified[0].write, classified[1].id, classified[1].write, authKind, authUid);
    }
    return denied();
  }

  // --- document get/delete/patch: runs, banned, reportLimits, bugReports --

  function handleRunGet(id) {
    const rec = runStore.get(id);
    if (!rec) return notFound();
    return { status: 200, body: { name: rec.name, fields: encodeRunDocFields(rec.doc, rec.createdAtIso), createTime: rec.createTimeIso, updateTime: rec.updateTimeIso } };
  }

  function handleRunDeleteDoc(id, authKind) {
    if (authKind !== "admin") return denied();
    runStore.delete(id);
    return { status: 200, body: {} };
  }

  // Admin-only single-field update of a run's deepKey (updateMask exactly
  // ["deepKey"]). Mirrors Firestore's IAM admin bypass for a document
  // PATCH; used by tools/boards-admin.mjs rekey-deep. Clients never reach it
  // (they get denied()), matching the rules' `allow update: if false`.
  function handleRunPatch(id, init, query, authKind) {
    if (authKind !== "admin") return denied();
    const masks = query.getAll("updateMask.fieldPaths");
    if (masks.length !== 1 || masks[0] !== "deepKey") return { status: 400, body: errorBody(400, "INVALID_ARGUMENT") };
    const rec = runStore.get(id);
    if (!rec) return notFound();
    const body = parseJsonBody(init.body);
    const fields = fromFirestoreFields(body?.fields);
    if (!Number.isInteger(fields.deepKey)) return { status: 400, body: errorBody(400, "INVALID_ARGUMENT") };
    const updated = { ...rec, doc: Object.freeze({ ...rec.doc, deepKey: fields.deepKey }), updateTimeIso: nowIso() };
    runStore.set(id, updated);
    return {
      status: 200,
      body: { name: updated.name, fields: encodeRunDocFields(updated.doc, updated.createdAtIso), createTime: updated.createTimeIso, updateTime: updated.updateTimeIso },
    };
  }

  function encodeLimitFields(rec) {
    return {
      last: { timestampValue: new Date(rec.lastMs).toISOString() },
      day: { timestampValue: new Date(rec.dayMs).toISOString() },
      count: { integerValue: String(rec.count) },
    };
  }

  function handleLimitGet(uid, authKind, authUid) {
    const allowed = (authKind === "user" && authUid === uid) || authKind === "admin";
    if (!allowed) return denied();
    const rec = limits.get(uid);
    if (!rec) return notFound();
    const timeIso = new Date(rec.lastMs).toISOString();
    return { status: 200, body: { name: docName(config, REPORT_LIMITS_COLLECTION, uid), fields: encodeLimitFields(rec), createTime: timeIso, updateTime: timeIso } };
  }

  function handleLimitPatch(uid, init, authKind) {
    if (authKind !== "admin") return denied();
    const body = parseJsonBody(init.body);
    const decoded = decodeLimitDoc(body?.fields);
    if (!decoded) return { status: 400, body: errorBody(400, "INVALID_ARGUMENT") };
    limits.set(uid, decoded);
    return { status: 200, body: {} };
  }

  function handleLimitDelete(uid, authKind) {
    if (authKind !== "admin") return denied();
    limits.delete(uid);
    return { status: 200, body: {} };
  }

  function handleBannedPatch(uid, authKind) {
    if (authKind !== "admin") return denied();
    banned.add(uid);
    return { status: 200, body: {} };
  }

  function handleBannedDelete(uid, authKind) {
    if (authKind !== "admin") return denied();
    banned.delete(uid);
    return { status: 200, body: {} };
  }

  // --- names / nameOverrides: admin-only (clients cannot read or write) ------

  function nameDocBody(collection, uid, rec) {
    return { name: docName(config, collection, uid), fields: rec.fields, createTime: rec.createTimeIso, updateTime: rec.updateTimeIso };
  }

  function putNameDoc(collection, uid, fields) {
    const have = nameDocs[collection].get(uid);
    const timeIso = nowIso();
    nameDocs[collection].set(uid, { fields, createTimeIso: have ? have.createTimeIso : timeIso, updateTimeIso: timeIso });
  }

  function handleNameDocGet(collection, uid, authKind) {
    if (authKind !== "admin") return denied();
    const rec = nameDocs[collection].get(uid);
    if (!rec) return notFound();
    return { status: 200, body: nameDocBody(collection, uid, rec) };
  }

  function handleNameDocList(collection, authKind) {
    if (authKind !== "admin") return denied();
    const documents = [...nameDocs[collection]].map(([uid, rec]) => nameDocBody(collection, uid, rec));
    return { status: 200, body: documents.length ? { documents } : {} };
  }

  // PATCH replaces the document; with updateMask.fieldPaths it merges only the
  // masked fields. The stored name must be a string.
  function handleNameDocPatch(collection, uid, init, query, authKind) {
    if (authKind !== "admin") return denied();
    const body = parseJsonBody(init.body);
    const incoming = body && typeof body.fields === "object" && body.fields !== null ? body.fields : null;
    if (!incoming) return { status: 400, body: errorBody(400, "INVALID_ARGUMENT") };
    const have = nameDocs[collection].get(uid);
    const wantExists = query.get("currentDocument.exists");
    if (wantExists === "true" && !have) return notFound();
    if (wantExists === "false" && have) return existsError();
    const masks = query.getAll("updateMask.fieldPaths");
    let fields = incoming;
    if (masks.length > 0) {
      fields = { ...(have ? have.fields : {}) };
      for (const fp of masks) {
        if (fp in incoming) fields[fp] = incoming[fp];
        else delete fields[fp];
      }
    }
    if (typeof fields.name?.stringValue !== "string") return { status: 400, body: errorBody(400, "INVALID_ARGUMENT") };
    putNameDoc(collection, uid, fields);
    return { status: 200, body: nameDocBody(collection, uid, nameDocs[collection].get(uid)) };
  }

  function handleNameDocDelete(collection, uid, authKind) {
    if (authKind !== "admin") return denied();
    nameDocs[collection].delete(uid);
    return { status: 200, body: {} };
  }

  function handleBugReportGet(id, authKind) {
    if (authKind !== "admin") return denied();
    const rec = reports.get(id);
    if (!rec) return notFound();
    const timeIso = nowIso();
    return { status: 200, body: { name: docName(config, BUG_REPORTS_COLLECTION, id), fields: toFirestoreFields(rec), createTime: timeIso, updateTime: timeIso } };
  }

  // --- the Games API stand-ins (OAuth token exchange, players/me) -------------

  // Exchanges a fake Play Games auth code once: the player it names, or null
  // for a code that is not a fake code or has already been spent.
  function exchangeFakeCode(authCode) {
    const player = parseFakeCode(authCode);
    if (!player || usedCodes.has(authCode)) return null;
    usedCodes.add(authCode);
    return player;
  }

  function handleOauthToken(init) {
    const form = new URLSearchParams(typeof init.body === "string" ? init.body : "");
    const player = exchangeFakeCode(form.get("code"));
    if (!player) return { status: 400, body: { error: "invalid_grant" } };
    const accessToken = nextToken("gtok");
    gamesTokens.set(accessToken, player);
    return { status: 200, body: { access_token: accessToken, expires_in: 3600, token_type: "Bearer" } };
  }

  function handleGamesPlayer(init) {
    const header = findAuthHeader(init);
    const m = typeof header === "string" ? /^Bearer\s+(.+)$/.exec(header) : null;
    const player = m ? gamesTokens.get(m[1]) : undefined;
    if (!player) return { status: 401, body: errorBody(401, "UNAUTHENTICATED") };
    return { status: 200, body: { kind: "games#player", playerId: player.playerId, displayName: player.displayName } };
  }

  // --- the boardName function, emulated ---------------------------------------
  //
  // A hand-written MIRROR of functions/board-names/index.js (the HTTP surface)
  // and functions/board-names/core.js (the decisions: verify the caller, the
  // provider, the name source, the override, adopt, write the name only if it
  // changed, then stamp), run straight against this fake's own stores.
  // test/unit/board-names-contract.test.js keeps it equal to the real function:
  // it runs one scenario table through the real core (pointed at this fake as
  // its Google) and through this endpoint and compares status, body and stored
  // state. Update both together.

  function nameReply(status, body, headers = CORS_ORIGIN) {
    return { status, body, headers };
  }

  function nameFail(status, error) {
    return nameReply(status, { ok: false, error });
  }

  // core.lookup: { ok, uid, providers, playGames } or { ok: false, status, error }.
  function nameLookup(idToken) {
    if (typeof idToken !== "string" || idToken === "") return { ok: false, status: 401, error: "UNAUTHENTICATED" };
    const who = resolveIdToken(idToken);
    if (!who.ok) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
    const providers = who.account.providers;
    return { ok: true, uid: who.uid, providers, playGames: providers.find((p) => p.providerId === PLAY_GAMES_PROVIDER) ?? null };
  }

  function nameClaim({ idToken, adoptIdToken, gamesAuthCode }) {
    const who = nameLookup(idToken);
    if (!who.ok) return nameFail(who.status, who.error);
    if (!who.playGames) return nameFail(403, "NOT_LINKED");
    const uid = who.uid;

    // Validate the adopt request before anything is written.
    let adoptUid = null;
    if (adoptIdToken !== undefined && adoptIdToken !== null && adoptIdToken !== "") {
      const anon = nameLookup(adoptIdToken);
      if (!anon.ok) return nameFail(403, "ADOPT_REFUSED");
      if (anon.uid === uid || anon.providers.length > 0) return nameFail(403, "ADOPT_REFUSED");
      adoptUid = anon.uid;
    }

    // The name: an admin override wins, then the configured source.
    let name = null;
    let overridden = false;
    const override = nameDocs.nameOverrides.get(uid);
    if (override) {
      name = sanitizeBoardName(override.fields.name?.stringValue);
      overridden = name !== null;
    }
    if (name === null) {
      let raw;
      if (nameSource === "games") {
        if (typeof gamesAuthCode !== "string" || gamesAuthCode === "") return nameFail(409, "NEEDS_GAMES_CODE");
        const player = exchangeFakeCode(gamesAuthCode);
        if (!player) return nameFail(409, "NEEDS_GAMES_CODE");
        if (player.playerId !== (who.playGames.rawId ?? who.playGames.federatedId)) return nameFail(403, "GAMES_MISMATCH");
        raw = player.displayName;
      } else {
        raw = who.playGames.displayName;
      }
      name = sanitizeBoardName(raw);
      if (name === null) return nameFail(422, "NO_NAME");
    }

    // Write names/{uid} only when it changed.
    const current = nameDocs.names.get(uid);
    if (!current || current.fields.name?.stringValue !== name) {
      putNameDoc(NAMES_COLLECTION, uid, { name: { stringValue: name }, updatedAt: { timestampValue: nowIso() } });
    }

    // Adopt first, so the stamp pass sees (and skips) the moved runs: every run
    // of the anonymous uid moves to <uid>_<hash> with uid, handle and deepKey
    // replaced and everything else (createdAt included) kept.
    let adopted = 0;
    if (adoptUid !== null) {
      const moves = [];
      for (const rec of [...runStore.values()]) {
        if (rec.doc.uid !== adoptUid) continue;
        const hash = rec.doc.hash;
        if (typeof hash !== "string" || !NAME_FN_HASH_RE.test(hash)) continue;
        const doc = { ...rec.doc, uid, handle: name };
        const floor = Number(rec.doc.floor);
        const steps = Number(rec.doc.steps);
        if (Number.isFinite(floor) && Number.isFinite(steps)) doc.deepKey = deepKeyOf({ floor, steps });
        moves.push({ rec, to: runDocId(uid, hash), doc });
      }
      for (const m of moves) {
        runStore.set(m.to, {
          id: m.to,
          doc: Object.freeze(m.doc),
          createdAtIso: m.rec.createdAtIso,
          name: docName(config, RUN_COLLECTION, m.to),
          createTimeIso: m.rec.createTimeIso,
          updateTimeIso: nowIso(),
        });
        runStore.delete(m.rec.id);
      }
      adopted = moves.length;
    }

    // Stamp: handle := name on every run of the uid whose handle differs.
    let stamped = 0;
    for (const rec of [...runStore.values()]) {
      if (rec.doc.uid !== uid || rec.doc.handle === name) continue;
      runStore.set(rec.id, { ...rec, doc: Object.freeze({ ...rec.doc, handle: name }), updateTimeIso: nowIso() });
      stamped += 1;
    }
    return nameReply(200, { ok: true, name, overridden, stamped, adopted });
  }

  function nameRelease({ idToken }) {
    const who = nameLookup(idToken);
    if (!who.ok) return nameFail(who.status, who.error);
    nameDocs.names.delete(who.uid);
    return nameReply(200, { ok: true, released: true });
  }

  function optionalNameString(value) {
    if (value === undefined || value === null) return { ok: true, value: undefined };
    if (typeof value === "string" && value.length <= NAME_FN_MAX_FIELD_CHARS) return { ok: true, value };
    return { ok: false };
  }

  function handleBoardName(method, init) {
    if (method === "OPTIONS") return nameReply(204, undefined, CORS_PREFLIGHT);
    if (method !== "POST") return nameFail(405, "METHOD_NOT_ALLOWED");
    const header = findAuthHeader(init);
    const m = typeof header === "string" ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
    const idToken = m && m[1].length <= NAME_FN_MAX_FIELD_CHARS ? m[1] : null;
    if (idToken === null) return nameFail(401, "UNAUTHENTICATED");
    const body = parseJsonBody(init.body);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return nameFail(400, "BAD_REQUEST");
    if (body.op === "release") return nameRelease({ idToken });
    if (body.op === "claim") {
      const adopt = optionalNameString(body.adoptIdToken);
      const code = optionalNameString(body.gamesAuthCode);
      if (!adopt.ok || !code.ok) return nameFail(400, "BAD_REQUEST");
      return nameClaim({ idToken, adoptIdToken: adopt.value, gamesAuthCode: code.value });
    }
    return nameFail(400, "BAD_REQUEST");
  }

  // --- routing --------------------------------------------------------------

  function route(path, method, init, auth, query) {
    if (path === BOARD_NAME_FN.url) return handleBoardName(method, init);
    if (path === OAUTH_TOKEN_URL && method === "POST") return handleOauthToken(init);
    if (path === GAMES_PLAYER_URL && method === "GET") return handleGamesPlayer(init);
    if (path === `${IDENTITY_BASE}/accounts:signUp` && method === "POST") return handleSignUp();
    if (path === `${IDENTITY_BASE}/accounts:delete` && method === "POST") return handleAccountDelete(init);
    if (path === `${IDENTITY_BASE}/accounts:signInWithIdp` && method === "POST") return handleSignInWithIdp(init);
    if (path === `${IDENTITY_BASE}/accounts:lookup` && method === "POST") return handleLookup(init);
    if (path === `${IDENTITY_BASE}/accounts:update` && method === "POST") return handleUpdate(init);
    if (path === `${SECURETOKEN_BASE}/token` && method === "POST") return handleRefresh(init);

    const firestorePrefix = `${FIRESTORE_BASE}/${documentsPath(config)}`;
    if (path.startsWith(firestorePrefix)) {
      const suffix = path.slice(firestorePrefix.length);

      if (suffix === ":runQuery" && method === "POST") {
        const body = parseJsonBody(init.body);
        return runQueryExec(body?.structuredQuery, auth.kind);
      }
      if (suffix === ":runAggregationQuery" && method === "POST") {
        const body = parseJsonBody(init.body);
        return aggregationQueryExec(body?.structuredAggregationQuery, auth.kind);
      }
      if (suffix === ":commit" && method === "POST") {
        if (auth.kind === "invalid" || auth.kind === "expired") return { status: 401, body: errorBody(401, "UNAUTHENTICATED") };
        const body = parseJsonBody(init.body);
        return commitDispatch(body, auth.kind, auth.uid);
      }
      // A bare collection-level GET (no document id) is a list attempt.
      // bugReports and reportLimits both deny list unconditionally in
      // firebase/firestore.rules ("list: if false") — modeled here (Phase
      // 83-09) so tools/bug-reports/send-test-report.mjs's list-read and
      // list-limits probes can prove the same deny against this fake.
      if (method === "GET" && (suffix === `/${BUG_REPORTS_COLLECTION}` || suffix === `/${REPORT_LIMITS_COLLECTION}`)) {
        return denied();
      }
      for (const collection of NAME_COLLECTIONS) {
        if (suffix === `/${collection}` && method === "GET") return handleNameDocList(collection, auth.kind);
        if (suffix.startsWith(`/${collection}/`)) {
          let uid;
          try {
            uid = decodeURIComponent(suffix.slice(collection.length + 2));
          } catch {
            return notFound();
          }
          if (method === "GET") return handleNameDocGet(collection, uid, auth.kind);
          if (method === "PATCH") return handleNameDocPatch(collection, uid, init, query, auth.kind);
          if (method === "DELETE") return handleNameDocDelete(collection, uid, auth.kind);
        }
      }
      if (suffix.startsWith("/runs/")) {
        const id = suffix.slice("/runs/".length);
        if (method === "GET") return handleRunGet(id);
        if (method === "DELETE") return handleRunDeleteDoc(id, auth.kind);
        if (method === "PATCH") return handleRunPatch(id, init, query, auth.kind);
      }
      if (suffix.startsWith(`/${BANNED_COLLECTION}/`)) {
        const uid = suffix.slice(BANNED_COLLECTION.length + 2);
        if (method === "PATCH") return handleBannedPatch(uid, auth.kind);
        if (method === "DELETE") return handleBannedDelete(uid, auth.kind);
      }
      if (suffix.startsWith(`/${REPORT_LIMITS_COLLECTION}/`)) {
        const uid = suffix.slice(REPORT_LIMITS_COLLECTION.length + 2);
        if (method === "GET") return handleLimitGet(uid, auth.kind, auth.uid);
        if (method === "PATCH") return handleLimitPatch(uid, init, auth.kind);
        if (method === "DELETE") return handleLimitDelete(uid, auth.kind);
      }
      if (suffix.startsWith(`/${BUG_REPORTS_COLLECTION}/`)) {
        const id = suffix.slice(BUG_REPORTS_COLLECTION.length + 2);
        if (method === "GET") return handleBugReportGet(id, auth.kind);
      }
    }

    return notFound();
  }

  function fetchFn(rawUrl, init = {}) {
    return new Promise((resolve, reject) => {
      if (!online) {
        reject(new TypeError("Failed to fetch"));
        return;
      }
      try {
        const method = (init.method || "GET").toUpperCase();
        const nowMs = now();
        const auth = authInfo(init, nowMs);
        calls.push(Object.freeze({ method, url: rawUrl, auth: auth.kind === "admin" ? "admin" : auth.kind === "user" ? "user" : "none" }));

        const { path, query } = parseUrl(rawUrl);
        // The function endpoint and the Google OAuth / Games hosts are not
        // key-checked REST calls (the function checks the caller's own token).
        const keyless = path === BOARD_NAME_FN.url || path === OAUTH_TOKEN_URL || path === GAMES_PLAYER_URL;
        if (!keyless && auth.kind !== "admin" && query.get("key") !== config.apiKey) {
          resolve(jsonResponse(400, errorBody(400, "INVALID_ARGUMENT")));
          return;
        }

        const result = route(path, method, init, auth, query);
        resolve(jsonResponse(result.status, result.body, result.headers));
      } catch (err) {
        resolve(jsonResponse(500, errorBody(500, "INTERNAL")));
      }
    });
  }

  // --- inspectors -----------------------------------------------------------

  function callsInspector() {
    return Object.freeze([...calls]);
  }

  function docsInspector() {
    return Object.freeze([...runStore.values()].map((r) => Object.freeze({ id: r.id, ...r.doc, createdAt: r.createdAtIso })));
  }

  function reportsInspector() {
    return Object.freeze([...reports.entries()].map(([id, rep]) => Object.freeze({ id, ...rep })));
  }

  function limitsInspector() {
    return Object.freeze([...limits.entries()].map(([uid, rec]) => Object.freeze({ uid, lastMs: rec.lastMs, dayMs: rec.dayMs, count: rec.count })));
  }

  function usersInspector() {
    return Object.freeze([...accounts.keys()]);
  }

  function providersInspector(uid) {
    const account = accounts.get(uid);
    return account ? providerInfoOf(account) : Object.freeze([]);
  }

  function nameDocsInspector(collection) {
    return Object.freeze(
      [...nameDocs[collection]].map(([uid, rec]) => Object.freeze({ uid, name: rec.fields.name?.stringValue })),
    );
  }

  function setNameDoc(collection, uid, name, stampField) {
    putNameDoc(collection, uid, { name: { stringValue: name }, [stampField]: { timestampValue: nowIso() } });
  }

  function bannedInspector() {
    return Object.freeze([...banned]);
  }

  function setOnline(value) {
    online = value === true;
  }

  function ban(uid) {
    banned.add(uid);
  }

  function unban(uid) {
    banned.delete(uid);
  }

  return Object.freeze({
    fetchFn,
    calls: callsInspector,
    docs: docsInspector,
    reports: reportsInspector,
    limits: limitsInspector,
    users: usersInspector,
    providers: providersInspector,
    names: () => nameDocsInspector(NAMES_COLLECTION),
    overrides: () => nameDocsInspector(NAME_OVERRIDES_COLLECTION),
    setName: (uid, name) => setNameDoc(NAMES_COLLECTION, uid, name, "updatedAt"),
    setOverride: (uid, name) => setNameDoc(NAME_OVERRIDES_COLLECTION, uid, name, "at"),
    banned: bannedInspector,
    setOnline,
    ban,
    unban,
  });
}
