#!/usr/bin/env node
// tools/boards-smoke.mjs
//
// Phase 83 (SRV-08's proof instrument: "a smoke test creates, reads, ranks
// and deletes a run against the live project"), also exercising SRV-01 (no
// duplicate on resubmit), SRV-02 (the denies) and SRV-03 (every stat and
// filter shape, total and rank, which also proves the declared indexes
// live). Plan 07. The end-to-end smoke test for the board: a dev-only Node
// tool that drives the SHIPPED client modules (src/browser/firebaseAuth.js,
// boardWrites.js, boardClient.js, runDoc.js) against a project exactly the
// way a real device would — never a re-implementation — so 83-08's live run
// is a measurement, not a debugging session.
//
// What each step proves:
//   signup                  an anonymous identity can be created
//   create-a / create-b     a run create lands and rank keys are accepted
//   resubmit-a               a duplicate create is acknowledged, not
//                            duplicated (SRV-01's idempotence argument)
//   top-ten / totals / ranks every stat (deep/days/kills/purse) and every
//                            race/sub filter shape reads correctly, and
//                            rankOf orders runs the same way topTen does
//   deny-bad-key             a tampered rank key is refused
//   deny-other-id            a doc id not matching {uid}_{hash} is refused
//   deny-no-auth              an unauthenticated create is refused
//   deny-non-handle-update   only the owner's `handle` field can be updated
//   deny-list-51             a list read above the 50-row cap is refused
//   ban / admin-delete       (--with-admin only) the banned check and an
//                            admin delete both work
//   handle-rewrite           a re-roll rewrites every one of the player's
//                            own runs
//   erase / account-deleted  owner delete-everything, then the anonymous
//                            account is gone
//
// It creates short-lived, PUBLIC rows on the board named "Smoke Probe"
// (race Troll, class Magic User, sub Court Mage — see smokeSummaries below)
// and always deletes them, in a finally block, even when a step fails. It
// must never be pointed at any project other than the one baked into
// src/browser/firebaseConfig.js — there is no --project override, by
// design, so a copy-pasted invocation can never hit someone else's Firebase
// project.
//
// Dev-only: never shipped (tools/ is never copied into www/ by
// tools/build-www.mjs). Node built-ins only; zero new dependencies.

import { pathToFileURL } from "node:url";

import { SEASON } from "../content/season.js";
import { runHash } from "../engine/records.js";
import { FIREBASE_CONFIG, firebaseConfigured } from "../src/browser/firebaseConfig.js";
import { firestoreUrl, restError, docName, toFirestoreFields } from "../src/browser/firestoreRest.js";
import { buildRunDoc, createRunCommit, RUN_COLLECTION, RANK_FIELD, BOARD_STATS, rankKeys } from "../src/browser/runDoc.js";
import { createBoardClient, decodeRunDocument } from "../src/browser/boardClient.js";
import { createBoardWrites } from "../src/browser/boardWrites.js";
import { createIdentity } from "../src/browser/firebaseAuth.js";
import { rollHandle } from "../src/browser/handles.js";
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

// ---------------------------------------------------------------------------
// runSmoke
// ---------------------------------------------------------------------------

/**
 * runSmoke({ fetchFn, config = FIREBASE_CONFIG, now = Date.now,
 * log = console.log, admin = null }) — drives the shipped client modules
 * end to end. `admin` is null (client-only run) or { api } built from
 * tools/boards-admin.mjs#createAdminApi. Resolves
 * { ok, steps, facts, cleanup }: `steps` is every step in run order as
 * { name, pass, detail }; a failing step stops the run (later steps are
 * never attempted) but cleanup always runs in a finally block. `facts`
 * records what only a live project can answer (duplicateStatus,
 * countUnderListRule, missingIndexes, commitShape). Never throws, never
 * logs a token, an id token or the API key.
 */
export async function runSmoke(opts = {}) {
  const { fetchFn, config = FIREBASE_CONFIG, now = Date.now, log = console.log, admin = null } = opts;

  const steps = [];
  const facts = { duplicateStatus: null, countUnderListRule: null, missingIndexes: [], commitShape: "single-write" };
  const createdIds = [];
  let bannedUid = null;
  let builtAId = null;
  let builtBId = null;

  const recorder = wrapRecorder(fetchFn);
  const storage = mapStorage();
  const identity = createIdentity({ storage, fetchFn: recorder.fetchFn, config, competeOn: () => true, now });
  const writes = createBoardWrites({ fetchFn: recorder.fetchFn, identity, config });
  const client = createBoardClient({ fetchFn: recorder.fetchFn, config, competeOn: () => true, now, ttlMs: 0 });

  const summaries = smokeSummaries(now);
  const keysA = rankKeys(summaries.a);
  const keysB = rankKeys(summaries.b);

  function bearerInit(body, idToken) {
    const headers = { "Content-Type": "application/json" };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    return { method: "POST", headers, body: JSON.stringify(body) };
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

  let cleanup = { erased: null, accountDeleted: false, banCleared: null };

  try {
    await runStep("signup", async () => {
      const token = await identity.getToken();
      return { pass: token.ok === true, detail: token.ok ? { uid: token.uid, handle: token.handle } : { reason: token.reason } };
    });

    await runStep("create-a", async () => {
      const res = await writes.submitRun(summaries.a, { version: summaries.a.version });
      if (res.ok) {
        builtAId = res.id;
        createdIds.push(res.id);
      }
      return { pass: res.ok === true && res.status === "created", detail: { status: res.status, reason: res.reason } };
    });

    await runStep("resubmit-a", async () => {
      const before = recorder.calls.length;
      const res = await writes.submitRun(summaries.a, { version: summaries.a.version });
      const commitCall = recorder.calls.slice(before).find((c) => c.kind === "commit");
      if (commitCall) facts.duplicateStatus = commitCall.status;
      return { pass: res.ok === true && res.status === "exists", detail: { status: res.status, reason: res.reason } };
    });

    await runStep("create-b", async () => {
      const res = await writes.submitRun(summaries.b, { version: summaries.b.version });
      if (res.ok) {
        builtBId = res.id;
        createdIds.push(res.id);
      }
      return { pass: res.ok === true && res.status === "created", detail: { status: res.status, reason: res.reason } };
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
      const built = buildRunDoc(summary, { uid: token.uid, handle: token.handle, version: summary.version });
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const tampered = { ...built.doc, daysKey: built.doc.daysKey + 1 };
      const res = await rawRequest(firestoreUrl(config, ":commit"), bearerInit(createRunCommit(config, built.id, tampered), token.idToken));
      const deniedOk = res.status === 400 || res.status === 403;
      const check = await getRun(built.id);
      return { pass: deniedOk && check.status === 404, detail: { status: res.status, getStatus: check.status } };
    });

    await runStep("deny-other-id", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const summary = { ...summaries.b, floor: summaries.b.floor + 2 };
      summary.hash = runHash(summary);
      const built = buildRunDoc(summary, { uid: token.uid, handle: token.handle, version: summary.version });
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const wrongId = `someoneelse_${built.doc.hash}`;
      const res = await rawRequest(firestoreUrl(config, ":commit"), bearerInit(createRunCommit(config, wrongId, built.doc), token.idToken));
      const deniedOk = res.status === 400 || res.status === 403;
      const check = await getRun(wrongId);
      return { pass: deniedOk && check.status === 404, detail: { status: res.status, getStatus: check.status } };
    });

    await runStep("deny-no-auth", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const summary = { ...summaries.b, floor: summaries.b.floor + 3 };
      summary.hash = runHash(summary);
      const built = buildRunDoc(summary, { uid: token.uid, handle: token.handle, version: summary.version });
      if (!built.ok) return { pass: false, detail: { reason: "could-not-build" } };
      const res = await rawRequest(firestoreUrl(config, ":commit"), bearerInit(createRunCommit(config, built.id, built.doc), undefined));
      const deniedOk = res.status === 400 || res.status === 403;
      const check = await getRun(built.id);
      return { pass: deniedOk && check.status === 404, detail: { status: res.status, getStatus: check.status } };
    });

    await runStep("deny-non-handle-update", async () => {
      const token = await identity.getToken();
      if (!token.ok) return { pass: false, detail: { reason: token.reason } };
      const name = docName(config, RUN_COLLECTION, builtAId);
      const commitBody = {
        writes: [
          {
            update: { name, fields: toFirestoreFields({ floor: summaries.a.floor + 100 }) },
            updateMask: { fieldPaths: ["floor"] },
            currentDocument: { exists: true },
          },
        ],
      };
      const res = await rawRequest(firestoreUrl(config, ":commit"), bearerInit(commitBody, token.idToken));
      const deniedOk = res.status === 400 || res.status === 403;
      const check = await getRun(builtAId);
      const decoded = check.status === 200 ? decodeRunDocument(check.json) : null;
      const floorUnchanged = !!decoded && decoded.floor === summaries.a.floor;
      return { pass: deniedOk && floorUnchanged, detail: { status: res.status, floor: decoded ? decoded.floor : null } };
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
      const deniedOk = res.status === 400 || res.status === 403;
      return { pass: deniedOk, detail: { status: res.status } };
    });

    if (admin) {
      await runStep("ban", async () => {
        const snap = await identity.snapshot();
        if (!snap.uid) return { pass: false, detail: { reason: "no-uid" } };
        const setOk = await admin.api.setBan(snap.uid, { reason: "boards-smoke", at: new Date(now()).toISOString() });
        if (!setOk) return { pass: false, detail: { reason: "set-ban-failed" } };
        bannedUid = snap.uid;
        const res = await writes.submitRun(summaries.c, { version: summaries.c.version });
        const refused = res.ok === false && res.reason === "refused";
        const clearOk = await admin.api.clearBan(snap.uid);
        bannedUid = null;
        return { pass: refused && clearOk === true, detail: { submit: { ok: res.ok, reason: res.reason }, clearOk } };
      });

      await runStep("admin-delete", async () => {
        const deleted = await admin.api.deleteRun(builtBId);
        if (!deleted) return { pass: false, detail: { reason: "delete-failed" } };
        const check = await getRun(builtBId);
        return { pass: check.status === 404, detail: { getStatus: check.status } };
      });
    }

    await runStep("handle-rewrite", async () => {
      const snap = await identity.snapshot();
      const newHandle = rollHandle(() => 0.73, snap.handle);
      const res = await writes.rewriteHandle(newHandle);
      if (!res.ok) return { pass: false, detail: { reason: res.reason } };
      const expected = admin ? 1 : 2;
      const check = await getRun(builtAId);
      const decoded = check.status === 200 ? decodeRunDocument(check.json) : null;
      const handleUpdated = !!decoded && decoded.handle === newHandle;
      return { pass: res.updated === expected && handleUpdated, detail: { updated: res.updated, expected, handle: decoded ? decoded.handle : null } };
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
    try {
      if (bannedUid && admin) {
        try {
          cleanup.banCleared = await admin.api.clearBan(bannedUid);
        } catch {
          cleanup.banCleared = false;
        }
        bannedUid = null;
      }

      const snap = await identity.snapshot();
      if (snap.uid) {
        const eraseResult = await writes.eraseMyRuns();
        cleanup.erased = eraseResult.ok === true;
      } else if (admin && createdIds.length > 0) {
        let allDeleted = true;
        for (const id of createdIds) {
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

      const snap2 = await identity.snapshot();
      if (snap2.uid) {
        const delRes = await identity.deleteAccount();
        cleanup.accountDeleted = !!(delRes && delRes.ok === true && delRes.deleted === true);
      } else {
        cleanup.accountDeleted = true;
      }
      await identity.drop();
    } catch {
      // best-effort cleanup; the caller's own report of `cleanup` reflects what happened above
    }

    facts.missingIndexes = recorder.calls
      .filter((c) => c.errStatus === "FAILED_PRECONDITION" && typeof c.message === "string" && /index/i.test(c.message))
      .map((c) => c.message);
    cleanup = Object.freeze(cleanup);
  }

  const allPass = steps.length > 0 && steps.every((s) => s.pass);
  return { ok: allPass, steps: Object.freeze([...steps]), facts: Object.freeze({ ...facts }), cleanup };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function plannedStepNames(withAdmin) {
  const names = [
    "signup", "create-a", "resubmit-a", "create-b", "top-ten", "totals", "ranks",
    "deny-bad-key", "deny-other-id", "deny-no-auth", "deny-non-handle-update", "deny-list-51",
  ];
  if (withAdmin) names.push("ban", "admin-delete");
  names.push("handle-rewrite", "erase", "account-deleted");
  return names;
}

function usage() {
  console.log("usage: node tools/boards-smoke.mjs [--with-admin | --dry-run]");
  console.log("  (no flag)     runs the client-only smoke against the live project (FIREBASE_CONFIG)");
  console.log("  --with-admin  also proves the banned check and an admin delete (needs gcloud auth)");
  console.log("  --dry-run     prints the planned steps and the three smoke summaries, touches nothing");
}

export async function main(argv = process.argv) {
  const args = argv.slice(2);
  if (args.length > 1) {
    usage();
    return 2;
  }
  const flag = args[0];
  if (flag !== undefined && flag !== "--with-admin" && flag !== "--dry-run") {
    usage();
    return 2;
  }

  if (flag === "--dry-run") {
    for (const name of plannedStepNames(true)) console.log(name);
    console.log(JSON.stringify(smokeSummaries(Date.now), null, 2));
    console.log(JSON.stringify({ projectId: FIREBASE_CONFIG.projectId, apiKey: "<key>" }));
    return 0;
  }

  if (!firebaseConfigured(FIREBASE_CONFIG)) {
    console.log("boards-smoke unavailable: FIREBASE_CONFIG is not configured (src/browser/firebaseConfig.js).");
    return 2;
  }

  let admin = null;
  if (flag === "--with-admin") {
    const auth = await resolveAdminAuth({ env: process.env, execFn: execGcloud });
    if (!auth.ok) {
      console.log(auth.message);
      return 2;
    }
    const api = createAdminApi({ projectId: FIREBASE_CONFIG.projectId, fetchFn: globalThis.fetch.bind(globalThis), headers: auth.headers });
    admin = { api };
  }

  const result = await runSmoke({
    fetchFn: globalThis.fetch.bind(globalThis),
    config: FIREBASE_CONFIG,
    now: Date.now,
    log: () => {},
    admin,
  });

  for (const s of result.steps) {
    console.log(s.pass ? `PASS ${s.name}` : `FAIL ${s.name}${s.detail != null ? ` (${JSON.stringify(s.detail)})` : ""}`);
  }
  console.log(`facts ${JSON.stringify(result.facts)}`);
  console.log(`cleanup ${JSON.stringify(result.cleanup)}`);

  const cleanupOk = result.cleanup.erased !== false && result.cleanup.accountDeleted !== false;
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
