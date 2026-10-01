// functions/board-names/index.js
//
// Phase 91.2 (BOARD-31), D-01. The HTTP entry point of the boardName
// 2nd-gen Cloud Function: CORS preflight, the method gate, Bearer token
// extraction, JSON body parsing and op routing in front of core.js. The
// contract (URL, ops, status and error codes) is in 91.2-CONTEXT.md
// "boardName Cloud Function".
//
// The deploy command lives in tools/board-names/deploy.mjs (dry-run by
// default; the live run is the user's go at 91.2-10, D-14).
//
// The Functions Framework is supplied by the Cloud Functions Node 22 runtime
// when package.json lists no dependency [ASSUMED]. Fallback if the deploy
// refuses that: add @google-cloud/functions-framework, pinned, after a
// package-legitimacy check (91.2-CONTEXT "Zero-dependency function").
//
// The res object is the Functions Framework's Express response: status(),
// set() and send() are all this file uses. A request carries the caller's
// Firebase ID token only in the Authorization header; the body never carries a
// name (the core would ignore one anyway).
//
// Loading this module makes no network call: the core and the metadata token
// getter are constructed but only talk when a request arrives.

import { createBoardNameCore, metadataTokenGetter } from "./core.js";

// The same values as src/browser/firebaseConfig.js#FIREBASE_CONFIG (a public
// project id and a public, restricted API key). Copied rather than imported
// because the deploy uploads only this directory; a test pins them equal.
export const DEFAULT_PROJECT_ID = "delve-die-repeat-6ba5f";
export const DEFAULT_API_KEY = "AIzaSyBMevk4MUgW7enDgE9NR96ItJcaiDV-SaI";

const CORS_ORIGIN = { "Access-Control-Allow-Origin": "*" };
const CORS_PREFLIGHT = {
  ...CORS_ORIGIN,
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "3600",
};

const MAX_FIELD_CHARS = 8192; // an ID token is about 1 KB; anything past this is not one

function send(res, status, body, headers = CORS_ORIGIN) {
  res.status(status);
  for (const [k, v] of Object.entries(headers)) res.set(k, v);
  if (body === undefined) {
    res.send("");
    return;
  }
  res.set("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

function fail(res, status, error) {
  send(res, status, { ok: false, error });
}

function header(req, name) {
  const headers = req && req.headers && typeof req.headers === "object" ? req.headers : {};
  const want = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === want) {
      const v = headers[key];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

function bearerToken(req) {
  const value = header(req, "authorization");
  if (typeof value !== "string") return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(value);
  return m && m[1].length <= MAX_FIELD_CHARS ? m[1] : null;
}

// The request body as a plain object, or null when it is not one.
function parseBody(raw) {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  } else if (value instanceof Uint8Array) {
    try {
      value = JSON.parse(Buffer.from(value).toString("utf8"));
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function optionalString(value) {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value === "string" && value.length <= MAX_FIELD_CHARS) return { ok: true, value };
  return { ok: false };
}

/** createHandler({ core }) — an (req, res) handler over the core's claim/release. Never throws. */
export function createHandler({ core }) {
  return async function handler(req, res) {
    try {
      const method = String((req && req.method) || "").toUpperCase();
      if (method === "OPTIONS") {
        send(res, 204, undefined, CORS_PREFLIGHT);
        return;
      }
      if (method !== "POST") {
        fail(res, 405, "METHOD_NOT_ALLOWED");
        return;
      }
      const idToken = bearerToken(req);
      if (idToken === null) {
        fail(res, 401, "UNAUTHENTICATED");
        return;
      }
      const body = parseBody(req.body);
      if (body === null) {
        fail(res, 400, "BAD_REQUEST");
        return;
      }
      if (body.op === "release") {
        const r = await core.release({ idToken });
        send(res, r.status, r.body);
        return;
      }
      if (body.op === "claim") {
        const adopt = optionalString(body.adoptIdToken);
        const code = optionalString(body.gamesAuthCode);
        if (!adopt.ok || !code.ok) {
          fail(res, 400, "BAD_REQUEST");
          return;
        }
        const r = await core.claim({ idToken, adoptIdToken: adopt.value, gamesAuthCode: code.value });
        send(res, r.status, r.body);
        return;
      }
      fail(res, 400, "BAD_REQUEST");
    } catch {
      try {
        fail(res, 500, "INTERNAL");
      } catch {
        // the response is already gone; nothing more to do
      }
    }
  };
}

const fetchNow = (...args) => globalThis.fetch(...args);
const env = process.env;

/** boardName — the deployed entry point (`--entry-point=boardName`). */
export const boardName = createHandler({
  core: createBoardNameCore({
    fetchFn: fetchNow,
    getAdminToken: metadataTokenGetter({ fetchFn: fetchNow }),
    projectId: env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID,
    apiKey: env.FIREBASE_API_KEY || DEFAULT_API_KEY,
    nameSource: env.NAME_SOURCE === "games" ? "games" : "provider",
    pgsClientId: env.PGS_WEB_CLIENT_ID,
    pgsClientSecret: env.PGS_WEB_CLIENT_SECRET,
  }),
});
