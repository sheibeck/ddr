// test/unit/harness/boardNameStub.js
//
// Phase 91.2-02. An in-memory stand-in for everything the boardName core
// talks to: Identity Toolkit accounts:lookup, the Firestore REST documents
// API (GET / PATCH / DELETE on one document, :runQuery, :commit), the OAuth
// token endpoint and the Games API players/me. One `fetchFn` routes on the
// URL and records every call, so a test can assert on what was written and
// what was not. Not a rules mirror: the core runs with the service account,
// which bypasses rules, so the stub only enforces the commit preconditions
// and the 500-writes-per-commit ceiling the real API has.

import { toFirestoreFields } from "../../../src/browser/firestoreRest.js";

const DOCS = "/documents/";

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * createUpstreamStub({ projectId }) — { fetchFn, calls, writes, docs, seedUser,
 * seedRun, seedDoc, getDoc, setOauth, setPlayer, failNext }.
 */
export function createUpstreamStub({ projectId = "proj" } = {}) {
  const docs = new Map(); // "collection/id" -> typed fields
  const users = new Map(); // idToken -> { localId, providers } | { error } | { status }
  const oauthCodes = new Map(); // code -> access token
  const players = new Map(); // access token -> { playerId, displayName }
  const calls = []; // { method, url, headers, body }
  const writes = []; // every mutation: { kind, path }
  const failures = []; // [{ match: RegExp, response | throw }]

  const docsRoot = `projects/${projectId}/databases/(default)`;

  function seedUser(idToken, { localId, providers = [] }) {
    users.set(idToken, { localId, providers });
  }
  function seedDoc(path, obj) {
    docs.set(path, toFirestoreFields(obj));
  }
  let runCounter = 0;
  function seedRun(uid, hash, over = {}) {
    runCounter += 1;
    const floor = over.floor ?? 3;
    const steps = over.steps ?? 120;
    const fields = {
      uid,
      handle: "@old handle",
      season: 1,
      name: "Aldric Vane",
      race: "Human",
      sub: "Knight",
      cls: "Fighter",
      level: 2,
      floor,
      day: 4,
      steps,
      kills: 9,
      gold: 77,
      sp: 5,
      cause: "combat",
      note: "cut down by a Rat",
      epitaph: "",
      when: 1790000000000,
      hash,
      version: "2.2.0 (12)",
      seed: 1000 + runCounter,
      acts: 10,
      deepKey: floor * 1000000 + (999999 - steps),
      daysKey: 4003,
      killsKey: 9003,
      goldKey: 77,
      ...over,
    };
    const typed = toFirestoreFields(fields);
    typed.createdAt = { timestampValue: "2026-09-20T10:00:00.000Z" };
    docs.set(`runs/${uid}_${hash}`, typed);
    return `runs/${uid}_${hash}`;
  }
  function getDoc(path) {
    return docs.get(path) ?? null;
  }
  function setOauth(code, accessToken) {
    oauthCodes.set(code, accessToken);
  }
  function setPlayer(accessToken, player) {
    players.set(accessToken, player);
  }
  /** failNext(match, response) — the next call whose URL matches answers `response` (a Response factory) or throws when it is an Error. */
  function failNext(match, response) {
    failures.push({ match, response });
  }

  function pathOf(url) {
    const i = url.indexOf(DOCS);
    if (i < 0) return null;
    return decodeURIComponent(url.slice(i + DOCS.length).split("?")[0]);
  }

  function runQuery(body) {
    const q = body?.structuredQuery ?? {};
    const collection = q.from?.[0]?.collectionId;
    const f = q.where?.fieldFilter;
    const wantField = f?.field?.fieldPath;
    const wantValue = f?.value?.stringValue;
    const after = q.startAt?.values?.[0]?.referenceValue ?? null;
    const limit = q.limit ?? 1000;
    const rows = [];
    for (const [path, fields] of docs) {
      if (!path.startsWith(`${collection}/`)) continue;
      if (wantField && fields[wantField]?.stringValue !== wantValue) continue;
      const name = `${docsRoot}/documents/${path}`;
      if (after && !(name > after)) continue;
      rows.push({ name, fields });
    }
    rows.sort((a, b) => (a.name < b.name ? -1 : 1));
    const page = rows.slice(0, limit);
    if (page.length === 0) return [{ readTime: "2026-10-01T00:00:00Z" }];
    return page.map((r) => ({ document: { name: r.name, fields: r.fields, createTime: "2026-09-20T10:00:00Z" }, readTime: "2026-10-01T00:00:00Z" }));
  }

  function commit(body) {
    const list = body?.writes ?? [];
    if (list.length > 500) return jsonResponse(400, { error: { status: "INVALID_ARGUMENT", message: "too many writes" } });
    // Validate preconditions first so a failed commit changes nothing (atomic).
    const staged = [];
    for (const w of list) {
      if (w.delete) {
        staged.push({ kind: "delete", path: w.delete.slice(w.delete.indexOf(DOCS) + DOCS.length) });
        continue;
      }
      const path = w.update.name.slice(w.update.name.indexOf(DOCS) + DOCS.length);
      const exists = docs.has(path);
      if (w.currentDocument?.exists === true && !exists) return jsonResponse(404, { error: { status: "NOT_FOUND", message: "missing" } });
      if (w.currentDocument?.exists === false && exists) return jsonResponse(409, { error: { status: "ALREADY_EXISTS", message: "exists" } });
      staged.push({ kind: "update", path, fields: w.update.fields ?? {}, mask: w.updateMask?.fieldPaths ?? null, w });
    }
    for (const s of staged) {
      if (s.kind === "delete") {
        docs.delete(s.path);
        writes.push({ kind: "commit-delete", path: s.path });
      } else if (s.mask) {
        const cur = { ...(docs.get(s.path) ?? {}) };
        for (const k of s.mask) cur[k] = s.fields[k];
        docs.set(s.path, cur);
        writes.push({ kind: "commit-patch", path: s.path, mask: s.mask, fields: Object.keys(s.fields), precondition: s.w.currentDocument ?? null });
      } else {
        docs.set(s.path, s.fields);
        writes.push({ kind: "commit-set", path: s.path, precondition: s.w.currentDocument ?? null });
      }
    }
    return jsonResponse(200, { writeResults: staged.map(() => ({})) });
  }

  async function fetchFn(url, init = {}) {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = init.headers ?? {};
    let body = null;
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ method, url, headers, body, rawBody: init.body });

    for (let i = 0; i < failures.length; i++) {
      if (failures[i].match.test(url)) {
        const { response } = failures.splice(i, 1)[0];
        if (response instanceof Error) throw response;
        return response();
      }
    }

    if (url.startsWith("https://identitytoolkit.googleapis.com/v1/accounts:lookup")) {
      const u = users.get(body?.idToken);
      if (!u) return jsonResponse(400, { error: { code: 400, message: "INVALID_ID_TOKEN", status: "INVALID_ARGUMENT" } });
      if (u.error) return jsonResponse(400, { error: { code: 400, message: u.error } });
      return jsonResponse(200, {
        kind: "identitytoolkit#GetAccountInfoResponse",
        users: [
          {
            localId: u.localId,
            providerUserInfo: u.providers.map((p) => ({ federatedId: p.rawId, rawId: p.rawId, ...p })),
          },
        ],
      });
    }

    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const form = new URLSearchParams(String(init.body ?? ""));
      const token = oauthCodes.get(form.get("code"));
      if (!token) return jsonResponse(400, { error: "invalid_grant" });
      return jsonResponse(200, { access_token: token, expires_in: 3600, token_type: "Bearer" });
    }

    if (url.startsWith("https://games.googleapis.com/games/v1/players/me")) {
      const auth = String(headers.Authorization ?? "");
      const p = players.get(auth.replace(/^Bearer /, ""));
      if (!p) return jsonResponse(401, { error: { status: "UNAUTHENTICATED" } });
      return jsonResponse(200, { kind: "games#player", playerId: p.playerId, displayName: p.displayName });
    }

    if (url.startsWith("https://firestore.googleapis.com/v1/")) {
      if (!String(headers.Authorization ?? "").startsWith("Bearer ")) return jsonResponse(401, { error: { status: "UNAUTHENTICATED" } });
      if (url.includes(":runQuery")) return jsonResponse(200, runQuery(body));
      if (url.includes(":commit")) return commit(body);
      const path = pathOf(url);
      if (path !== null) {
        if (method === "GET") {
          const fields = docs.get(path);
          if (!fields) return jsonResponse(404, { error: { status: "NOT_FOUND" } });
          return jsonResponse(200, { name: `${docsRoot}/documents/${path}`, fields });
        }
        if (method === "PATCH") {
          docs.set(path, body?.fields ?? {});
          writes.push({ kind: "patch", path, query: url.split("?")[1] ?? "" });
          return jsonResponse(200, { name: `${docsRoot}/documents/${path}`, fields: body?.fields ?? {} });
        }
        if (method === "DELETE") {
          docs.delete(path);
          writes.push({ kind: "delete", path });
          return jsonResponse(200, {});
        }
      }
    }
    return jsonResponse(404, { error: { status: "NOT_FOUND", message: `stub has no route for ${method} ${url}` } });
  }

  return { fetchFn, calls, writes, docs, seedUser, seedRun, seedDoc, getDoc, setOauth, setPlayer, failNext };
}

/** field(typed, key) — the plain value of a stored typed field (string, integer, timestamp). */
export function field(typed, key) {
  const v = typed?.[key];
  if (!v) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("timestampValue" in v) return v.timestampValue;
  return undefined;
}
