#!/usr/bin/env node
// tools/boards-smoke.mjs
//
// Phase 83 (SRV-08's proof instrument: "a smoke test creates, reads, ranks
// and deletes a run against the live project"), also exercising SRV-01 (no
// duplicate on resubmit), SRV-02 (the denies) and SRV-03 (every stat and
// filter shape, total and rank, which also proves the declared indexes
// live). Plan 07. The end-to-end smoke test for the board: a dev-only Node
// tool that drives the SHIPPED client modules (src/browser/firebaseAuth.js,
// boardWrites.js, boardClient.js, nameClient.js, runDoc.js) against a project
// exactly the way a real device would — never a re-implementation — so the
// live run is a measurement, not a debugging session.
//
// Phase 91.2 (BOARD-31, BOARD-33, D-11, D-13) rebuilt it around the names gate.
// A run is only accepted when its handle equals names/{uid}.name, which only
// the boardName function and the admin write, and the probe's anonymous account
// can never claim a name (it is not linked to Play Games). So the probe seeds a
// probe name for its own uid through the admin API (IAM), builds every doc with
// buildRunDoc(summary, { uid, handle: <that name>, version }) and posts every
// create with createRunCommit and the probe's own bearer token through this
// file's request helper — never boardWrites' own run-submit call, which from
// 91.2-05 on needs a Play Games session the smoke can never have. The admin seed is therefore
// REQUIRED for the default and --transition probes (resolved up front, exit 2
// without it). Nothing is deployed or run by the tests; the live run belongs to
// 91.2-10 (transition deploy) and the final-rules cutover (Release 2.3.0).
//
// What each step of the default probe (the FINAL rules) proves:
//   signup                   an anonymous identity can be created
//   deny-unnamed-create      an uid with no names document cannot post a run
//   seed-name                the admin writes names/{uid} (the probe name)
//   create-a / create-b      a run under the probe name lands and rank keys
//                            are accepted
//   resubmit-a               a duplicate create is acknowledged, not
//                            duplicated (SRV-01's idempotence argument: an
//                            ambiguous answer, then one public GET shows the run
//                            there under the probe uid)
//   top-ten / totals / ranks every stat (deep/days/kills/purse) and every
//                            race/sub filter shape reads correctly, and
//                            rankOf orders runs the same way topTen does
//   deny-bad-key             a tampered rank key is refused
//   deny-other-id            a doc id not matching {uid}_{hash} is refused
//   deny-no-auth             an unauthenticated create is refused
//   deny-wrong-name          a run whose handle is not the verified name is
//                            refused
//   deny-update              NO client update lands: not a rename, not a field
//   deny-names-read          the names / nameOverrides documents and a query
//                            over them are closed to a client
//   deny-names-write         a client cannot write them either (REST patch and
//                            commit), and the name is unchanged afterwards
//   deny-list-51             a list read above the 50-row cap is refused
//   ban / admin-delete       the banned check and an admin delete both work
//   erase / account-deleted  owner delete-everything, then the anonymous
//                            account is gone
// The finally block also removes the seeded names/{uid}.
//
// Phase 87 (BOARD-28) + 91.2 add a separate --transition probe
// (runTransitionProbe), a transition artifact deleted at the 2.3 cutover
// (docs/RELEASING.md, Release 2.3.0), run against the transition rules:
//   signup                   as above
//   create-legacy            an UNNAMED uid posts a run shaped like a shipped
//                            2.2.0 client's (an @handle, the legacyDeepKeyOf
//                            key), and its 2.2.0 handle-only re-roll update lands
//   deny-third-key           a run carrying any other DEPTH key is refused
//   seed-name                as above
//   create-named             a named run with the 2.3 DEPTH key lands under the
//                            probe name
//   deny-legacy-when-named   now the uid is named: the legacy @handle create
//                            and the legacy re-roll update are both refused
//   erase / account-deleted  as above
//
// 91.2 also adds --function (runFunctionProbe), which needs no admin: it asks
// the deployed boardName function to claim a name for the probe's anonymous
// account (it must answer refused NOT_LINKED: no Play Games link) and to
// release (it must answer ok), through createNameClient.
//
// It creates short-lived, PUBLIC rows on the board named "Smoke Probe"
// (race Troll, class Magic User, sub Court Mage — see smokeSummaries below)
// and always deletes them, in a finally block, even when a step fails. It
// must never be pointed at any project other than the one baked into
// src/browser/firebaseConfig.js — there is no --project override, by
// design, so a copy-pasted invocation can never hit someone else's Firebase
// project. (main() takes injected dependencies for the unit tests only; the
// CLI entry point passes none.)
//
// Dev-only: never shipped (tools/ is never copied into www/ by
// tools/build-www.mjs). Node built-ins only; zero new dependencies.

import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { SEASON } from "../content/season.js";
import { runHash } from "../engine/records.js";
import { FIREBASE_CONFIG, firebaseConfigured } from "../src/browser/firebaseConfig.js";
import { firestoreUrl, restError, docName, toFirestoreFields } from "../src/browser/firestoreRest.js";
import {
  buildRunDoc,
  createRunCommit,
  handleUpdateCommit,
  RUN_COLLECTION,
  RANK_FIELD,
  BOARD_STATS,
  rankKeys,
  deepKeyOf,
  legacyDeepKeyOf,
} from "../src/browser/runDoc.js";
import { createBoardClient, decodeRunDocument } from "../src/browser/boardClient.js";
import { createBoardWrites } from "../src/browser/boardWrites.js";
import { createIdentity } from "../src/browser/firebaseAuth.js";
import { createNameClient } from "../src/browser/nameClient.js";
import { resolveAdminAuth, createAdminApi, execGcloud } from "./boards-admin.mjs";

// ---------------------------------------------------------------------------
// smokeSummaries — the three fixed runs described in the plan's own context
// ---------------------------------------------------------------------------

const SMOKE_SHARED = Object.freeze({
  race: "Troll",
  cls: "Magic User",
  sub: "Court Mage",
  name: "Smoke Probe",
  cause: "combat",
  note: "cut down by a smoke test",
  epitaph: "Smoke test run. Safe to delete.",
  season: SEASON,
  version: "smoke",
});

// The probe's verified name (seeded through the admin API), a name it was never
// given, and the two 2.2.0-shaped handles the transition probe posts and re-rolls to.
const SMOKE_NAME = "Smoke Probe";
const SMOKE_WRONG_NAME = "Smoke Impostor";
const LEGACY_PROBE_HANDLE = "@mossjaw";
const LEGACY_REROLL_HANDLE = "@gravepouch";

const ADMIN_REQUIRED_MESSAGE =
  "boards-smoke needs admin auth: the names gate is probed by seeding a probe name through the admin API (the admin seed). Run `gcloud auth login`, or set DDR_BOARDS_SA_KEY to a service-account key file outside the repo.";

/**
 * smokeSummaries(now) — the three frozen RunSummary-shaped objects the
 * smoke drives: run A (floor 7), run B (floor 3), run C (floor 2, the
 * ban-step-only submit that must be refused). Each carries a hash computed
 * via engine/records.js#runHash after every field is set, and every one
 * passes src/browser/runDoc.js#buildRunDoc for a plausible {uid, handle}.
 * The shared `seed` (and Phase 84's `when`, the same value — `when` is
 * outside the hash, so reusing it changes nothing about hash computation
 * order) is read once from `now()` so every field of a given smoke run is
 * fixed for the whole call. Never throws.
 */
export function smokeSummaries(now = Date.now) {
  const seed = Math.trunc(now());
  const base = { ...SMOKE_SHARED, seed, when: seed };
  const a = { ...base, floor: 7, steps: 400, day: 5, kills: 3, gold: 50, sp: 250, level: 2, acts: 500 };
  const b = { ...base, floor: 3, steps: 150, day: 2, kills: 1, gold: 10, sp: 40, level: 1, acts: 200 };
  const c = { ...base, floor: 2, steps: 90, day: 1, kills: 0, gold: 5, sp: 10, level: 1, acts: 120 };
  a.hash = runHash(a);
  b.hash = runHash(b);
  c.hash = runHash(c);
  return Object.freeze({ a: Object.freeze(a), b: Object.freeze(b), c: Object.freeze(c) });
}

// ---------------------------------------------------------------------------
// Small local helpers
// ---------------------------------------------------------------------------

/** mapStorage() — an in-memory storage matching src/browser/storage.js's async getItem/setItem/removeItem contract. */
function mapStorage() {
  const map = new Map();
  return {
    async getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      map.set(key, String(value));
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

function classifyRecordedUrl(rawUrl) {
  if (typeof rawUrl !== "string") return "other";
  if (rawUrl.includes(":commit")) return "commit";
  if (rawUrl.includes(":runQuery")) return "runQuery";
  if (rawUrl.includes(":runAggregationQuery")) return "runAggregationQuery";
  return "other";
}

/**
 * wrapRecorder(fetchFn) — wraps `fetchFn`, keeping the HTTP status and (for
 * a 4xx/5xx answer) the REST error's `.status`/`.message` of every
 * :commit/:runQuery/:runAggregationQuery call, WITHOUT consuming the
 * response body the caller still needs: a real fetch Response is cloned
 * first (the fake's own response object has no clone() and its json() is
 * safely re-callable). Never throws, never logs a token.
 */
function wrapRecorder(fetchFn) {
  const calls = [];
  async function wrapped(rawUrl, init) {
    const res = await fetchFn(rawUrl, init);
    let errStatus = null;
    let message = null;
    if (typeof res.status === "number" && res.status >= 400) {
      try {
        const json = typeof res.clone === "function" ? await res.clone().json() : await res.json();
        const decoded = restError(json);
        errStatus = decoded.status || null;
        message = decoded.message || null;
      } catch {
        // best-effort: the caller's own read of the body is what matters
      }
    }
    calls.push(Object.freeze({ kind: classifyRecordedUrl(rawUrl), status: res.status, errStatus, message }));
    return res;
  }
  return { fetchFn: wrapped, calls };
}

/** boardShapes(summary) — the four race/sub filter shapes exercised by every board read step. */
function boardShapes(summary) {
  return [
    { race: null, sub: null },
    { race: summary.race, sub: null },
    { race: null, sub: summary.sub },
    { race: summary.race, sub: summary.sub },
  ];
}

/** refused(status) — the two answers Firestore gives a rule denial (a 400 FAILED_PRECONDITION on a live project, a 403). */
function refused(status) {
  return status === 400 || status === 403;
}

/**
 * createKit({ fetchFn, config, now, log }) — what every probe shares: the
 * recording fetch, an in-memory identity, the step runner (a failing step
 * stops the run), the raw bearer request helper and the read-back GET.
 */
function createKit({ fetchFn, config, now, log }) {
  const steps = [];
  const recorder = wrapRecorder(fetchFn);
  const storage = mapStorage();
  const identity = createIdentity({ storage, fetchFn: recorder.fetchFn, config, competeOn: () => true, now });
  const writes = createBoardWrites({ fetchFn: recorder.fetchFn, identity, config });

  function bearerInit(body, idToken, method = "POST") {
    const headers = { "Content-Type": "application/json" };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    return { method, headers, body: JSON.stringify(body) };
  }

  async function rawRequest(url, init) {
    const res = await recorder.fetchFn(url, init);
    let json = null;
    try {
      json = await res.json();
    } catch {
      // treated as no body below
    }
    return { status: res.status, ok: res.ok, json };
  }

  async function getRun(id) {
    return rawRequest(firestoreUrl(config, `/${RUN_COLLECTION}/${id}`), { method: "GET" });
  }

  async function runStep(name, fn) {
    let outcome;
    try {
      outcome = await fn();
    } catch (err) {
      outcome = { pass: false, detail: { error: String((err && err.message) || err) } };
    }
    const pass = !!(outcome && outcome.pass);
    const detail = outcome && "detail" in outcome ? outcome.detail : null;
    steps.push(Object.freeze({ name, pass, detail: detail === undefined ? null : detail }));
    log(pass ? `PASS ${name}` : `FAIL ${name}${detail != null ? ` ${JSON.stringify(detail)}` : ""}`);
    if (!pass) {
      const failure = new Error(`step failed: ${name}`);
      failure.isStepFailure = true;
      throw failure;
    }
  }

  /** commitCreate(token, built, { doc, id, auth }) — POSTs a create commit; `auth: false` sends no bearer. */
  async function commitCreate(token, built, { doc = built.doc, id = built.id, auth = true } = {}) {
    return rawRequest(firestoreUrl(config, ":commit"), bearerInit(createRunCommit(config, id, doc), auth ? token.idToken : undefined));
  }

  /** buildFor(token, summary, handle) — a doc built the way the client builds it, with an EXPLICIT handle. */
  function buildFor(token, summary, handle) {
    return buildRunDoc(summary, { uid: token.uid, handle, version: summary.version });
  }

  return { steps, recorder, identity, writes, bearerInit, rawRequest, getRun, runStep, commitCreate, buildFor };
}

/**
 * finishCleanup(kit, admin, state, cleanup) — the shared finally body: clear a
 * leftover ban, erase the probe's runs (owner delete, or the admin when the
 * identity is already gone), delete the anonymous account, remove the seeded
 * names/{uid}, drop the identity. Best-effort: nothing here throws.
 */
async function finishCleanup(kit, admin, state, cleanup) {
  try {
    if (state.bannedUid && admin) {
      try {
        cleanup.banCleared = await admin.api.clearBan(state.bannedUid);
      } catch {
        cleanup.banCleared = false;
      }
      state.bannedUid = null;
    }

    const snap = await kit.identity.snapshot();
    if (snap.uid) {
      const eraseResult = await kit.writes.eraseMyRuns();
      cleanup.erased = eraseResult.ok === true;
    } else if (admin && state.createdIds.length > 0) {
      let allDeleted = true;
      for (const id of state.createdIds) {
        try {
          const ok = await admin.api.deleteRun(id);
          if (!ok) allDeleted = false;
        } catch {
          allDeleted = false;
        }
      }
      cleanup.erased = allDeleted;
    } else {
      cleanup.erased = true;
    }

    const snap2 = await kit.identity.snapshot();
    if (snap2.uid) {
      const delRes = await kit.identity.deleteAccount();
      cleanup.accountDeleted = !!(delRes && delRes.ok === true && delRes.deleted === true);
    } else {
      cleanup.accountDeleted = true;
    }

    if (state.seededNameUid && admin) {
      try {
        cleanup.nameRemoved = (await admin.api.clearNameRecord(state.seededNameUid)) === true;
      } catch {
        cleanup.nameRemoved = false;
      }
    }
    await kit.identity.drop();
  } catch {
    // best-effort cleanup; the caller's own report of `cleanup` reflects what happened above
  }
}

function missingIndexesOf(kit) {
  return kit.recorder.calls
    .filter((c) => c.errStatus === "FAILED_PRECONDITION" && typeof c.message === "string" && /index/i.test(c.message))
    .map((c) => c.message);
}

function refusedNoAdmin(facts) {
  return {
    ok: false,
    error: "admin-required",
    steps: Object.freeze([]),
    facts: Object.freeze({ ...facts }),
    cleanup: Object.freeze({ erased: null, accountDeleted: false, banCleared: null, nameRemoved: null }),
  };
}

/** seedNameStep(kit, admin, state, now) — the shared seed-name step body: admin writes names/{uid}, then reads it back. */
async function seedName(kit, admin, state, now) {
  const token = await kit.identity.getToken();
  if (!token.ok) return { pass: false, detail: { reason: token.reason } };
  const wrote = await admin.api.setNameRecord(token.uid, SMOKE_NAME, new Date(now()).toISOString());
  if (wrote !== true) return { pass: false, detail: { reason: "seed-failed" } };
  state.seededNameUid = token.uid;
  const doc = await admin.api.getDocument("names", token.uid);
  return { pass: !!doc && doc.name === SMOKE_NAME, detail: { name: doc ? doc.name : null } };
}

// ---------------------------------------------------------------------------
// runSmoke
// ---------------------------------------------------------------------------

/**
 * runSmoke({ fetchFn, config = FIREBASE_CONFIG, now = Date.now,
 * log = console.log, admin }) — drives the shipped client modules end to end
 * against the FINAL rules. `admin` is { api } built from
 * tools/boards-admin.mjs#createAdminApi and is REQUIRED (it seeds the probe
 * name); without it the run refuses with { ok: false, error: "admin-required" }
 * before any network call. Resolves { ok, steps, facts, cleanup }: `steps` is
 * every step in run order as { name, pass, detail }; a failing step stops the
 * run (later steps are never attempted) but cleanup always runs in a finally
 * block. `facts` records what only a live project can answer (duplicateStatus,
 * countUnderListRule, missingIndexes, commitShape). Never throws, never logs a
 * token, an id token or the API key.
 */
export async function runSmoke(opts = {}) {
  const { fetchFn, config = FIREBASE_CONFIG, now = Date.now, log = console.log, admin = null } = opts;

  const facts = { duplicateStatus: null, countUnderListRule: null, missingIndexes: [], commitShape: "single-write" };
  if (!admin || !admin.api) return refusedNoAdmin(facts);

  const kit = createKit({ fetchFn, config, now, log });
  const { steps, identity, writes, recorder, bearerInit, rawRequest, getRun, runStep, commitCreate, buildFor } = kit;
  const client = createBoardClient({ fetchFn: recorder.fetchFn, config, competeOn: () => true, now, ttlMs: 0 });

  const state = { createdIds: [], seededNameUid: null, bannedUid: null };
  let builtAId = null;
  let builtBId = null;

  const summaries = smokeSummaries(now);
  const keysA = rankKeys(summaries.a);
  const keysB = rankKeys(summaries.b);

  let cleanup = { erased: null, accountDeleted: false, banCleared: null, nameRemoved: null };

  try {
    await runStep("signup", async () => {
      const token = await identity.getToken();
      return { pass: token.ok === true, detail: token.ok ? { uid: token.uid } : { reason: token.reason } };
    });

    await runStep("deny-unnamed-create", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const built = buildFor(token, summaries.a, SMOKE_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const res = await commitCreate(token, built);
      if (res.status === 200) state.createdIds.push(built.id);
      const check = await getRun(built.id);
      return { pass: refused(res.status) && check.status === 404, detail: { status: res.status, getStatus: check.status } };
    });

    await runStep("seed-name", () => seedName(kit, admin, state, now));

    await runStep("create-a", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const built = buildFor(token, summaries.a, SMOKE_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const res = await commitCreate(token, built);
      if (res.status === 200) {
        builtAId = built.id;
        state.createdIds.push(built.id);
      }
      return { pass: res.status === 200, detail: { status: res.status } };
    });

    await runStep("create-b", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const built = buildFor(token, summaries.b, SMOKE_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const res = await commitCreate(token, built);
      if (res.status === 200) {
        builtBId = built.id;
        state.createdIds.push(built.id);
      }
      return { pass: res.status === 200, detail: { status: res.status } };
    });

    // The same commit again: an ambiguous answer (400/403/409, whichever the
    // project gives for a failed exists:false precondition), then one public
    // GET shows the run is there under the probe uid (boardWrites' idempotence).
    await runStep("resubmit-a", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const built = buildFor(token, summaries.a, SMOKE_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const res = await commitCreate(token, built);
      facts.duplicateStatus = res.status;
      const ambiguous = res.status === 400 || res.status === 403 || res.status === 409;
      const check = await getRun(built.id);
      const decoded = check.status === 200 ? decodeRunDocument(check.json) : null;
      return { pass: ambiguous && !!decoded && decoded.uid === token.uid, detail: { status: res.status, getStatus: check.status } };
    });

    await runStep("top-ten", async () => {
      const shapes = boardShapes(summaries.a);
      for (const statId of BOARD_STATS) {
        const rankField = RANK_FIELD[statId];
        let aInRaceSub = false;
        for (const shape of shapes) {
          const res = await client.topTen(statId, shape.race, shape.sub);
          if (!res.ok) return { pass: false, detail: { stat: statId, shape, reason: res.reason } };
          if (res.rows.length > 10) return { pass: false, detail: { stat: statId, shape, reason: "too-many-rows" } };
          for (let i = 1; i < res.rows.length; i++) {
            if (res.rows[i - 1][rankField] < res.rows[i][rankField]) {
              return { pass: false, detail: { stat: statId, shape, reason: "not-descending" } };
            }
          }
          if (shape.race !== null && shape.sub !== null) {
            aInRaceSub = res.rows.some((r) => r.id === builtAId);
          }
        }
        if (!aInRaceSub) return { pass: false, detail: { stat: statId, reason: "run-a-missing-from-race-sub-read" } };
      }
      return { pass: true, detail: { reads: BOARD_STATS.length * shapes.length } };
    });

    await runStep("totals", async () => {
      const shapes = boardShapes(summaries.a);
      let countFact = "pass";
      for (const statId of BOARD_STATS) {
        for (const shape of shapes) {
          const res = await client.total(statId, shape.race, shape.sub);
          if (!res.ok) {
            countFact = res.status !== undefined ? String(res.status) : res.reason;
            facts.countUnderListRule = countFact;
            return { pass: false, detail: { stat: statId, shape, reason: res.reason, status: res.status } };
          }
          if (!Number.isInteger(res.count) || res.count < 0) {
            return { pass: false, detail: { stat: statId, shape, reason: "bad-count" } };
          }
          if (shape.race !== null && shape.sub !== null && res.count < 2) {
            return { pass: false, detail: { stat: statId, shape, reason: "race-sub-total-below-2", count: res.count } };
          }
        }
      }
      facts.countUnderListRule = countFact;
      return { pass: true, detail: { reads: BOARD_STATS.length * shapes.length } };
    });

    await runStep("ranks", async () => {
      const shapes = [
        { race: null, sub: null, keys: keysA },
        { race: summaries.a.race, sub: null, keys: keysA },
        { race: null, sub: summaries.a.sub, keys: keysA },
        { race: summaries.a.race, sub: summaries.a.sub, keys: keysB },
      ];
      let deepA = null;
      let deepB = null;
      for (const statId of BOARD_STATS) {
        const rankField = RANK_FIELD[statId];
        for (const shape of shapes) {
          const key = shape.keys[rankField];
          const res = await client.rankOf(statId, key, shape.race, shape.sub);
          if (!res.ok) return { pass: false, detail: { stat: statId, shape: { race: shape.race, sub: shape.sub }, reason: res.reason } };
          if (!(Number.isInteger(res.rank) && res.rank >= 1)) {
            return { pass: false, detail: { stat: statId, reason: "bad-rank" } };
          }
          if (statId === "deep" && shape.keys === keysA && shape.race === null && shape.sub === null) deepA = res.rank;
          if (statId === "deep" && shape.keys === keysB && shape.race === summaries.a.race && shape.sub === summaries.a.sub) deepB = res.rank;
        }
      }
      if (!(deepA !== null && deepB !== null && deepA < deepB)) {
        return { pass: false, detail: { deepA, deepB, reason: "deep-rank-order" } };
      }
      return { pass: true, detail: { reads: BOARD_STATS.length * shapes.length, deepA, deepB } };
    });

    await runStep("deny-bad-key", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const summary = { ...summaries.b, floor: summaries.b.floor + 1 };
      summary.hash = runHash(summary);
      const built = buildFor(token, summary, SMOKE_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const tampered = { ...built.doc, daysKey: built.doc.daysKey + 1 };
      const res = await commitCreate(token, built, { doc: tampered });
      const check = await getRun(built.id);
      return { pass: refused(res.status) && check.status === 404, detail: { status: res.status, getStatus: check.status } };
    });

    await runStep("deny-other-id", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const summary = { ...summaries.b, floor: summaries.b.floor + 2 };
      summary.hash = runHash(summary);
      const built = buildFor(token, summary, SMOKE_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const wrongId = `someoneelse_${built.doc.hash}`;
      const res = await commitCreate(token, built, { id: wrongId });
      const check = await getRun(wrongId);
      return { pass: refused(res.status) && check.status === 404, detail: { status: res.status, getStatus: check.status } };
    });

    await runStep("deny-no-auth", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const summary = { ...summaries.b, floor: summaries.b.floor + 3 };
      summary.hash = runHash(summary);
      const built = buildFor(token, summary, SMOKE_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const res = await commitCreate(token, built, { auth: false });
      const check = await getRun(built.id);
      return { pass: refused(res.status) && check.status === 404, detail: { status: res.status, getStatus: check.status } };
    });

    await runStep("deny-wrong-name", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const summary = { ...summaries.b, floor: summaries.b.floor + 4 };
      summary.hash = runHash(summary);
      const built = buildFor(token, summary, SMOKE_WRONG_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const res = await commitCreate(token, built);
      if (res.status === 200) state.createdIds.push(built.id);
      const check = await getRun(built.id);
      return { pass: refused(res.status) && check.status === 404, detail: { status: res.status, getStatus: check.status } };
    });

    // D-11: not the 2.2.0 re-roll, not a rename to the very same name, not a stat.
    await runStep("deny-update", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const commitUrl = firestoreUrl(config, ":commit");
      const reroll = await rawRequest(commitUrl, bearerInit(handleUpdateCommit(config, builtAId, LEGACY_REROLL_HANDLE), token.idToken));
      const same = await rawRequest(commitUrl, bearerInit(handleUpdateCommit(config, builtAId, SMOKE_NAME), token.idToken));
      const floorBody = {
        writes: [
          {
            update: { name: docName(config, RUN_COLLECTION, builtAId), fields: toFirestoreFields({ floor: summaries.a.floor + 100 }) },
            updateMask: { fieldPaths: ["floor"] },
            currentDocument: { exists: true },
          },
        ],
      };
      const stat = await rawRequest(commitUrl, bearerInit(floorBody, token.idToken));
      const check = await getRun(builtAId);
      const decoded = check.status === 200 ? decodeRunDocument(check.json) : null;
      const unchanged = !!decoded && decoded.handle === SMOKE_NAME && decoded.floor === summaries.a.floor;
      return {
        pass: refused(reroll.status) && refused(same.status) && refused(stat.status) && unchanged,
        detail: { reroll: reroll.status, same: same.status, stat: stat.status, handle: decoded ? decoded.handle : null, floor: decoded ? decoded.floor : null },
      };
    });

    await runStep("deny-names-read", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const bearer = { headers: { Authorization: `Bearer ${token.idToken}` } };
      const names = await rawRequest(firestoreUrl(config, `/names/${token.uid}`), { method: "GET", ...bearer });
      const overrides = await rawRequest(firestoreUrl(config, `/nameOverrides/${token.uid}`), { method: "GET", ...bearer });
      const anon = await rawRequest(firestoreUrl(config, `/names/${token.uid}`), { method: "GET" });
      const listBody = { structuredQuery: { from: [{ collectionId: "names" }], limit: 1 } };
      const list = await rawRequest(firestoreUrl(config, ":runQuery"), bearerInit(listBody, token.idToken));
      const listClosed = refused(list.status) || (Array.isArray(list.json) && list.json.every((h) => !h.document));
      return {
        pass: refused(names.status) && refused(overrides.status) && refused(anon.status) && listClosed,
        detail: { names: names.status, overrides: overrides.status, anon: anon.status, list: list.status },
      };
    });

    await runStep("deny-names-write", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const fields = { name: { stringValue: SMOKE_WRONG_NAME }, updatedAt: { timestampValue: new Date(now()).toISOString() } };
      const patch = await rawRequest(firestoreUrl(config, `/names/${token.uid}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.idToken}` },
        body: JSON.stringify({ fields }),
      });
      const commitNames = {
        writes: [{ update: { name: docName(config, "names", token.uid), fields }, currentDocument: { exists: true } }],
      };
      const viaCommit = await rawRequest(firestoreUrl(config, ":commit"), bearerInit(commitNames, token.idToken));
      const commitOverride = {
        writes: [{ update: { name: docName(config, "nameOverrides", token.uid), fields: { name: { stringValue: SMOKE_WRONG_NAME } } }, currentDocument: { exists: false } }],
      };
      const override = await rawRequest(firestoreUrl(config, ":commit"), bearerInit(commitOverride, token.idToken));
      const after = await admin.api.getDocument("names", token.uid);
      const overrideAfter = await admin.api.getDocument("nameOverrides", token.uid);
      return {
        pass: refused(patch.status) && refused(viaCommit.status) && refused(override.status) && !!after && after.name === SMOKE_NAME && overrideAfter === null,
        detail: { patch: patch.status, commit: viaCommit.status, override: override.status, name: after ? after.name : null },
      };
    });

    await runStep("deny-list-51", async () => {
      const structuredQuery = {
        from: [{ collectionId: RUN_COLLECTION }],
        where: { fieldFilter: { field: { fieldPath: "season" }, op: "EQUAL", value: { integerValue: String(SEASON) } } },
        orderBy: [{ field: { fieldPath: "deepKey" }, direction: "DESCENDING" }],
        limit: 51,
      };
      const res = await rawRequest(firestoreUrl(config, ":runQuery"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery }),
      });
      return { pass: refused(res.status), detail: { status: res.status } };
    });

    await runStep("ban", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const setOk = await admin.api.setBan(token.uid, { reason: "boards-smoke", at: new Date(now()).toISOString() });
      if (!setOk) return { pass: false, detail: { reason: "set-ban-failed" } };
      state.bannedUid = token.uid;
      const built = buildFor(token, summaries.c, SMOKE_NAME);
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const res = await commitCreate(token, built);
      if (res.status === 200) state.createdIds.push(built.id);
      const check = await getRun(built.id);
      const clearOk = await admin.api.clearBan(token.uid);
      state.bannedUid = null;
      return { pass: refused(res.status) && check.status === 404 && clearOk === true, detail: { submit: res.status, getStatus: check.status, clearOk } };
    });

    await runStep("admin-delete", async () => {
      const deleted = await admin.api.deleteRun(builtBId);
      if (!deleted) return { pass: false, detail: { reason: "delete-failed" } };
      const check = await getRun(builtBId);
      return { pass: check.status === 404, detail: { getStatus: check.status } };
    });

    await runStep("erase", async () => {
      const res = await writes.eraseMyRuns();
      if (!res.ok) return { pass: false, detail: { reason: res.reason } };
      const check = await getRun(builtAId);
      return { pass: check.status === 404, detail: { deleted: res.deleted, getStatus: check.status } };
    });

    await runStep("account-deleted", async () => {
      const snap = await identity.snapshot();
      return { pass: snap.uid === null, detail: { uid: snap.uid } };
    });
  } catch {
    // a step recorded its own failure via runStep; nothing more to do here
  } finally {
    await finishCleanup(kit, admin, state, cleanup);
    facts.missingIndexes = missingIndexesOf(kit);
    cleanup = Object.freeze(cleanup);
  }

  const allPass = steps.length > 0 && steps.every((s) => s.pass);
  return { ok: allPass, steps: Object.freeze([...steps]), facts: Object.freeze({ ...facts }), cleanup };
}

// ---------------------------------------------------------------------------
// Phase 87 (BOARD-28) + Phase 91.2: the transition probe
// ---------------------------------------------------------------------------

/**
 * transitionSummaries(now) — three frozen RunSummary-shaped runs on one floor
 * (4) with distinct steps (321, 123, 77), hence distinct hashes. Run a is the
 * unnamed 2.2.0-shaped create (the legacy DEPTH key), b the named 2.3 create
 * (the new key), c a third value the rules must refuse (then reused, with a
 * legacy handle, for the named-uid refusal). The seed/when come from one now()
 * read; each hash is computed after every field is set. Never throws.
 */
export function transitionSummaries(now = Date.now) {
  const seed = Math.trunc(now());
  const base = { ...SMOKE_SHARED, seed, when: seed, floor: 4, day: 3, kills: 2, gold: 30, sp: 120, level: 2, acts: 300 };
  const a = { ...base, steps: 321 };
  const b = { ...base, steps: 123 };
  const c = { ...base, steps: 77 };
  a.hash = runHash(a);
  b.hash = runHash(b);
  c.hash = runHash(c);
  return Object.freeze({ a: Object.freeze(a), b: Object.freeze(b), c: Object.freeze(c) });
}

/**
 * runTransitionProbe({ fetchFn, config, now, log, admin }) — proves the DEPLOYED
 * transition rules accept what a shipped 2.2.0 client sends from an unnamed uid
 * (an @handle create with the 2.2.0 DEPTH key, and its handle-only re-roll
 * update), refuse any other DEPTH key, accept a named 2.3 run under the
 * admin-seeded name, and refuse both legacy branches once the uid is named; then
 * erases its runs, removes the seeded name and deletes its anonymous account, in
 * a finally block, even when a step fails. Same option and return shape as
 * runSmoke; `admin` is required. Never throws, never logs a token or the API
 * key. A transition artifact: delete it at the 2.3 cutover (docs/RELEASING.md,
 * Release 2.3.0).
 */
export async function runTransitionProbe(opts = {}) {
  const { fetchFn, config = FIREBASE_CONFIG, now = Date.now, log = console.log, admin = null } = opts;

  const facts = { missingIndexes: [] };
  if (!admin || !admin.api) return refusedNoAdmin(facts);

  const kit = createKit({ fetchFn, config, now, log });
  const { steps, identity, writes, bearerInit, rawRequest, getRun, runStep, commitCreate, buildFor } = kit;

  const summaries = transitionSummaries(now);
  const state = { createdIds: [], seededNameUid: null, bannedUid: null };
  let legacyRunId = null;

  let cleanup = { erased: null, accountDeleted: false, banCleared: null, nameRemoved: null };

  // Builds a doc from `summary` with its handle and deepKey set, commits it
  // through the shipped commit shape, and reads it back.
  async function commitWith(token, summary, handle, deepKey) {
    const built = buildFor(token, summary, handle);
    if (!built.ok) return { built: null };
    const doc = { ...built.doc, deepKey };
    const res = await commitCreate(token, built, { doc });
    const check = await getRun(built.id);
    return { built, res, check };
  }

  try {
    await runStep("signup", async () => {
      const token = await identity.getToken();
      return { pass: token.ok === true, detail: token.ok ? { uid: token.uid } : { reason: token.reason } };
    });

    await runStep("create-legacy", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const out = await commitWith(token, summaries.a, LEGACY_PROBE_HANDLE, legacyDeepKeyOf(summaries.a));
      if (!out.built) return { pass: false, detail: { reason: "could-not-build" } };
      if (out.res.status === 200) {
        legacyRunId = out.built.id;
        state.createdIds.push(out.built.id);
      }
      const decoded = out.check.status === 200 ? decodeRunDocument(out.check.json) : null;
      const keyOk = !!decoded && decoded.deepKey === legacyDeepKeyOf(summaries.a) && decoded.handle === LEGACY_PROBE_HANDLE;
      if (!(out.res.status === 200 && keyOk)) return { pass: false, detail: { status: out.res.status, getStatus: out.check.status } };

      // the 2.2.0 re-roll: a handle-only update by the (still unnamed) owner
      const reroll = await rawRequest(firestoreUrl(config, ":commit"), bearerInit(handleUpdateCommit(config, legacyRunId, LEGACY_REROLL_HANDLE), token.idToken));
      const after = await getRun(legacyRunId);
      const afterDoc = after.status === 200 ? decodeRunDocument(after.json) : null;
      return {
        pass: reroll.status === 200 && !!afterDoc && afterDoc.handle === LEGACY_REROLL_HANDLE,
        detail: { status: out.res.status, reroll: reroll.status, handle: afterDoc ? afterDoc.handle : null },
      };
    });

    await runStep("deny-third-key", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const third = deepKeyOf(summaries.c) + 1;
      if (third === deepKeyOf(summaries.c) || third === legacyDeepKeyOf(summaries.c)) {
        return { pass: false, detail: { reason: "third-key-collides" } };
      }
      const out = await commitWith(token, summaries.c, LEGACY_PROBE_HANDLE, third);
      if (!out.built) return { pass: false, detail: { reason: "could-not-build" } };
      if (out.res.status === 200) state.createdIds.push(out.built.id);
      return { pass: refused(out.res.status) && out.check.status === 404, detail: { status: out.res.status, getStatus: out.check.status } };
    });

    await runStep("seed-name", () => seedName(kit, admin, state, now));

    await runStep("create-named", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const out = await commitWith(token, summaries.b, SMOKE_NAME, deepKeyOf(summaries.b));
      if (!out.built) return { pass: false, detail: { reason: "could-not-build" } };
      if (out.res.status === 200) state.createdIds.push(out.built.id);
      const decoded = out.check.status === 200 ? decodeRunDocument(out.check.json) : null;
      const ok = !!decoded && decoded.deepKey === deepKeyOf(summaries.b) && decoded.handle === SMOKE_NAME;
      return { pass: out.res.status === 200 && ok, detail: { status: out.res.status, getStatus: out.check.status } };
    });

    await runStep("deny-legacy-when-named", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      // a legacy create (a @handle, the 2.2.0 key) from the now-named uid
      const out = await commitWith(token, summaries.c, LEGACY_PROBE_HANDLE, legacyDeepKeyOf(summaries.c));
      if (!out.built) return { pass: false, detail: { reason: "could-not-build" } };
      if (out.res.status === 200) state.createdIds.push(out.built.id);
      // and the legacy re-roll update of the earlier legacy run
      const reroll = await rawRequest(firestoreUrl(config, ":commit"), bearerInit(handleUpdateCommit(config, legacyRunId, LEGACY_PROBE_HANDLE), token.idToken));
      const after = await getRun(legacyRunId);
      const afterDoc = after.status === 200 ? decodeRunDocument(after.json) : null;
      const unchanged = !!afterDoc && afterDoc.handle === LEGACY_REROLL_HANDLE;
      return {
        pass: refused(out.res.status) && out.check.status === 404 && refused(reroll.status) && unchanged,
        detail: { create: out.res.status, getStatus: out.check.status, reroll: reroll.status },
      };
    });

    await runStep("erase", async () => {
      const res = await writes.eraseMyRuns();
      if (!res.ok) return { pass: false, detail: { reason: res.reason } };
      for (const id of state.createdIds) {
        const check = await getRun(id);
        if (check.status !== 404) return { pass: false, detail: { deleted: res.deleted, getStatus: check.status } };
      }
      return { pass: true, detail: { deleted: res.deleted } };
    });

    await runStep("account-deleted", async () => {
      const snap = await identity.snapshot();
      return { pass: snap.uid === null, detail: { uid: snap.uid } };
    });
  } catch {
    // a step recorded its own failure via runStep; nothing more to do here
  } finally {
    await finishCleanup(kit, admin, state, cleanup);
    facts.missingIndexes = missingIndexesOf(kit);
    cleanup = Object.freeze(cleanup);
  }

  const allPass = steps.length > 0 && steps.every((s) => s.pass);
  return { ok: allPass, steps: Object.freeze([...steps]), facts: Object.freeze({ ...facts }), cleanup };
}

// ---------------------------------------------------------------------------
// Phase 91.2: the function probe
// ---------------------------------------------------------------------------

/**
 * runFunctionProbe({ fetchFn, config, now, log }) — proves the DEPLOYED boardName
 * function refuses what it must: a claim from the probe's anonymous account (no
 * Play Games link) must come back { ok: false, reason: "refused", code:
 * "NOT_LINKED" }, and a release must come back ok. Needs no admin. Always
 * deletes the anonymous account in a finally block. Same return shape as
 * runSmoke. Never throws, never logs a token or the API key.
 */
export async function runFunctionProbe(opts = {}) {
  const { fetchFn, config = FIREBASE_CONFIG, now = Date.now, log = console.log } = opts;

  const facts = { missingIndexes: [] };
  const kit = createKit({ fetchFn, config, now, log });
  const { steps, identity, runStep } = kit;
  const nameClient = createNameClient({ fetchFn: kit.recorder.fetchFn });

  let cleanup = { erased: null, accountDeleted: false, banCleared: null, nameRemoved: null };

  try {
    await runStep("signup", async () => {
      const token = await identity.getToken();
      return { pass: token.ok === true, detail: token.ok ? { uid: token.uid } : { reason: token.reason } };
    });

    await runStep("claim-unlinked", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const res = await nameClient.claim({ idToken: token.idToken });
      return { pass: res.ok === false && res.reason === "refused" && res.code === "NOT_LINKED", detail: { reason: res.reason ?? null, code: res.code ?? null } };
    });

    await runStep("release", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const res = await nameClient.release({ idToken: token.idToken });
      return { pass: res.ok === true, detail: { ok: res.ok, reason: res.reason ?? null } };
    });

    await runStep("account-deleted", async () => {
      const res = await identity.deleteAccount();
      const snap = await identity.snapshot();
      return { pass: !!(res && res.ok === true && res.deleted === true) && snap.uid === null, detail: { uid: snap.uid } };
    });
  } catch {
    // a step recorded its own failure via runStep; nothing more to do here
  } finally {
    await finishCleanup(kit, null, { createdIds: [], seededNameUid: null, bannedUid: null }, cleanup);
    cleanup = Object.freeze(cleanup);
  }

  const allPass = steps.length > 0 && steps.every((s) => s.pass);
  return { ok: allPass, steps: Object.freeze([...steps]), facts: Object.freeze({ ...facts }), cleanup };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function plannedStepNames() {
  return [
    "signup", "deny-unnamed-create", "seed-name", "create-a", "create-b", "resubmit-a",
    "top-ten", "totals", "ranks",
    "deny-bad-key", "deny-other-id", "deny-no-auth", "deny-wrong-name", "deny-update",
    "deny-names-read", "deny-names-write", "deny-list-51",
    "ban", "admin-delete",
    "erase", "account-deleted",
  ];
}

function usage(out) {
  out("usage: node tools/boards-smoke.mjs [--dry-run | --transition | --function]");
  out("  (no flag)     runs the names-gate smoke against the live project (FIREBASE_CONFIG); needs admin auth (gcloud login or DDR_BOARDS_SA_KEY): it seeds a probe name");
  out("  --dry-run     prints the planned steps and the three smoke summaries, touches nothing");
  out("  --transition  proves the deployed TRANSITION rules (a 2.2.0 create and re-roll for an unnamed uid, a named run, no legacy branch for a named uid); needs admin auth; run right after a transition-rules deploy");
  out("  --function    proves the deployed boardName function refuses an unlinked claim (NOT_LINKED) and answers a release ok; needs no admin auth");
}

/**
 * main(argv, deps) — the CLI. `deps` exists for the unit tests only (an
 * injected fake fetch, config, gcloud stand-in, env, output and clock); the
 * entry point below passes none, so a real invocation can only ever touch the
 * project baked into src/browser/firebaseConfig.js.
 */
export async function main(argv = process.argv, deps = {}) {
  const {
    config = FIREBASE_CONFIG,
    fetchFn = globalThis.fetch.bind(globalThis),
    env = process.env,
    execFn = execGcloud,
    out = console.log,
    now = Date.now,
  } = deps;

  const args = argv.slice(2);
  if (args.length > 1) {
    usage(out);
    return 2;
  }
  const flag = args[0];
  if (flag !== undefined && flag !== "--dry-run" && flag !== "--transition" && flag !== "--function") {
    usage(out);
    return 2;
  }

  if (flag === "--dry-run") {
    for (const name of plannedStepNames()) out(name);
    out(JSON.stringify(smokeSummaries(now), null, 2));
    out(JSON.stringify({ projectId: config.projectId, apiKey: "<key>" }));
    return 0;
  }

  if (!firebaseConfigured(config)) {
    out("boards-smoke unavailable: FIREBASE_CONFIG is not configured (src/browser/firebaseConfig.js).");
    return 2;
  }

  let admin = null;
  if (flag !== "--function") {
    const auth = await resolveAdminAuth({ env, execFn, fetchFn, now, readFile: fs.readFileSync });
    if (!auth.ok) {
      out(ADMIN_REQUIRED_MESSAGE);
      out(auth.message);
      return 2;
    }
    admin = { api: createAdminApi({ projectId: config.projectId, fetchFn, headers: auth.headers }) };
  }

  const runner = flag === "--transition" ? runTransitionProbe : flag === "--function" ? runFunctionProbe : runSmoke;
  const result = await runner({ fetchFn, config, now, log: () => {}, admin });

  for (const s of result.steps) {
    out(s.pass ? `PASS ${s.name}` : `FAIL ${s.name}${s.detail != null ? ` (${JSON.stringify(s.detail)})` : ""}`);
  }
  out(`facts ${JSON.stringify(result.facts)}`);
  out(`cleanup ${JSON.stringify(result.cleanup)}`);

  const cleanupOk = result.cleanup.erased !== false && result.cleanup.accountDeleted !== false && result.cleanup.nameRemoved !== false;
  return result.ok && cleanupOk ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
