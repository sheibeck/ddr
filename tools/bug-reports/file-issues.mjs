#!/usr/bin/env node
// tools/bug-reports/file-issues.mjs
//
// Phase 79.3 (BUG-04), D-02 (a scheduled GitHub Action files reports), D-14
// (auth, per-run cap, idempotency, label, issue format) and D-17 (the
// --dry-run / dry_run hooks the orchestrator's live test uses). Reads new
// bug reports from Firestore with a service-account JWT, files each as a
// public labelled issue on sheibeck/ddr, and marks it filed. A report is
// never filed twice: the lock uses the document's updateTime as a
// precondition, and a report stuck in "filing" for over 10 minutes is
// reconciled or retried up to MAX_ATTEMPTS.
//
// Phase 83 Plan 10 (SRV-11): the same run also cleans Firestore up on a
// retention schedule. A filed report whose Oracle fit whole (oracleTrimmed
// false) is deleted right after it is marked filed. A filed report whose
// Oracle was trimmed to fit the issue keeps its Firestore document for
// REPORT_RETENTION_DAYS after filedAt, so the "until <date>" note in the
// issue (issue-format.mjs#issueBodyInfo) stays true. A report marked failed
// keeps its document for REPORT_RETENTION_DAYS after failedAt. A
// reportLimits/{uid} document is deleted LIMIT_RETENTION_DAYS after its
// last write. new and filing reports are never touched by cleanup. Every
// run deletes at most MAX_DELETES_PER_RUN documents, oldest first, via
// four small index-backed range queries (firebase/firestore.indexes.json) —
// never a read of every document. A dry run logs what it would delete and
// deletes nothing.
//
// Node built-ins only (node:crypto, node:fs, node:url) plus
// issue-format.mjs. fetch and the clock are injected everywhere so every
// path here is unit-testable with no network.

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { issueTitle, issueBodyInfo, markerFor, decodeFirestoreFields } from "./issue-format.mjs";

export const LABEL = "player-report";
export const MAX_PER_RUN = 20;
export const STALE_FILING_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
export const QUERY_LIMIT = 200;
export const DEFAULT_PROJECT_ID = "delve-die-repeat-6ba5f";

// Phase 83 Plan 10 (SRV-11) retention constants. Named, not scattered
// numbers: 30 days for both bugReports cases (a trimmed filed report and a
// failed report), 2 days for a stale reportLimits/{uid} document.
export const REPORT_RETENTION_DAYS = 30;
export const LIMIT_RETENTION_DAYS = 2;
export const REPORT_RETENTION_MS = REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const LIMIT_RETENTION_MS = LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const MAX_DELETES_PER_RUN = 100;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signs a Google service-account JWT (RS256) for the datastore scope. Pure
 * given `nowMs`: no I/O. */
export function signServiceAccountJwt(sa, nowMs) {
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + 3600;
  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const claims = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: TOKEN_URL,
    scope: FIRESTORE_SCOPE,
    iat,
    exp,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput, "utf8"), sa.private_key);
  return `${signingInput}.${base64url(signature)}`;
}

/** Exchanges a signed service-account JWT for a datastore access token. */
export async function getAccessToken({ sa, fetchFn, now }) {
  const jwt = signServiceAccountJwt(sa, now());
  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", jwt);
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok || !json || !json.access_token) {
    throw new Error("Firestore token exchange failed.");
  }
  return json.access_token;
}

function firestoreDocsUrl(ctx) {
  return `https://firestore.googleapis.com/v1/projects/${ctx.projectId}/databases/(default)/documents`;
}

function fieldFilter(fieldPath, op, value) {
  return { fieldFilter: { field: { fieldPath }, op, value } };
}

/** A structuredQuery body: one or more fieldFilters ANDed together, ordered
 * ascending by `orderByField`. The caller adds `limit`. */
function cleanupQuery(collectionId, filters, orderByField) {
  const where = filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } };
  return {
    from: [{ collectionId }],
    where,
    orderBy: [{ field: { fieldPath: orderByField }, direction: "ASCENDING" }],
  };
}

/** Runs one structuredQuery and decodes each returned document into
 * `{ id, createTime, updateTime, fields, attempts }`. Shared by the
 * new/filing polling queries and the four cleanup sweeps below. */
async function structuredQuery(ctx, body) {
  const res = await ctx.fetchFn(`${firestoreDocsUrl(ctx)}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: body }),
  });
  const rows = await res.json();
  const docs = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !row.document) continue;
    const document = row.document;
    const id = String(document.name).split("/").pop();
    const fields = decodeFirestoreFields(document.fields || {});
    docs.push({
      id,
      createTime: document.createTime,
      updateTime: document.updateTime,
      fields,
      attempts: typeof fields.attempts === "number" ? fields.attempts : 0,
    });
  }
  return docs;
}

async function runQuery(ctx, statusValue) {
  const docs = await structuredQuery(ctx, {
    from: [{ collectionId: "bugReports" }],
    where: fieldFilter("status", "EQUAL", { stringValue: statusValue }),
    limit: QUERY_LIMIT,
  });
  return docs.map((d) => ({
    id: d.id,
    createTime: d.createTime,
    updateTime: d.updateTime,
    report: d.fields,
    attempts: d.attempts,
  }));
}

async function lockDoc(ctx, doc, attempts) {
  const url =
    `${firestoreDocsUrl(ctx)}/bugReports/${doc.id}` +
    `?updateMask.fieldPaths=status&updateMask.fieldPaths=attempts` +
    `&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`;
  const res = await ctx.fetchFn(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: { status: { stringValue: "filing" }, attempts: { integerValue: String(attempts) } },
    }),
  });
  // Firestore reports a lost currentDocument.updateTime precondition as a
  // non-2xx (typically 400 FAILED_PRECONDITION, sometimes 409/412). Treat
  // any lock failure the same way: someone else has it, skip.
  return res.ok;
}

async function patchFiled(ctx, docId, issueNumber, issueUrl, trimmed) {
  const url =
    `${firestoreDocsUrl(ctx)}/bugReports/${docId}` +
    `?updateMask.fieldPaths=status&updateMask.fieldPaths=issueNumber` +
    `&updateMask.fieldPaths=issueUrl&updateMask.fieldPaths=filedAt` +
    `&updateMask.fieldPaths=oracleTrimmed`;
  const filedAt = new Date(ctx.now()).toISOString();
  return ctx.fetchFn(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        status: { stringValue: "filed" },
        issueNumber: { integerValue: String(issueNumber) },
        issueUrl: { stringValue: issueUrl },
        filedAt: { stringValue: filedAt },
        oracleTrimmed: { booleanValue: trimmed },
      },
    }),
  });
}

async function patchFailed(ctx, doc, attempts) {
  const url =
    `${firestoreDocsUrl(ctx)}/bugReports/${doc.id}` +
    `?updateMask.fieldPaths=status&updateMask.fieldPaths=attempts` +
    `&updateMask.fieldPaths=failedAt` +
    `&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`;
  const failedAt = new Date(ctx.now()).toISOString();
  return ctx.fetchFn(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        status: { stringValue: "failed" },
        attempts: { integerValue: String(attempts) },
        failedAt: { stringValue: failedAt },
      },
    }),
  });
}

/** DELETEs one bugReports or reportLimits document. Never logs a
 * reportLimits document's uid — a failed delete's warning names the
 * collection only, as "reportLimits/<redacted>" (T-83-46). */
async function deleteDoc(ctx, collectionId, id) {
  const url = `${firestoreDocsUrl(ctx)}/${collectionId}/${id}`;
  const res = await ctx.fetchFn(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
  });
  if (!res.ok) {
    const label = collectionId === "reportLimits" ? "reportLimits/<redacted>" : `${collectionId}/${id}`;
    ctx.log(`warning: DELETE ${label} returned HTTP ${res.status}`);
  }
  return res.ok;
}

/** The display string for one deletion in `result.deleted` / the CLI
 * summary: a bugReports id with its reason, or the bare word "limit" for a
 * reportLimits deletion — never that document's uid (T-83-46). */
function deletedEntry(collectionId, id, reason) {
  return collectionId === "reportLimits" ? "limit" : `${id} (${reason})`;
}

/** Deletes a just-filed bugReports document immediately when its Oracle was
 * not trimmed (the issue already holds everything) and the run's delete
 * budget allows it. No-op for a trimmed report — it keeps its document for
 * REPORT_RETENTION_DAYS instead. */
async function maybeImmediateDelete(ctx, docId, trimmed, reason) {
  if (trimmed) return;
  if (ctx.deleteBudget <= 0) return;
  const ok = await deleteDoc(ctx, "bugReports", docId);
  if (ok) {
    ctx.result.deleted.push(deletedEntry("bugReports", docId, reason));
    ctx.deleteBudget--;
  }
}

/** The "YYYY-MM-DD" date REPORT_RETENTION_DAYS after `nowMs` — the date the
 * trim note in a filed-but-trimmed issue names as when the full Oracle
 * stops being kept in Firestore. */
function keepUntilDate(nowMs) {
  return new Date(nowMs + REPORT_RETENTION_MS).toISOString().slice(0, 10);
}

/** The four cleanup sweeps (SRV-11), run in this fixed order after filing:
 *   Q1 filed-full leftovers: status == filed AND oracleTrimmed == false
 *   Q2 filed-expired: status == filed AND filedAt < now - 30d
 *   Q3 failed-expired: status == failed AND failedAt < now - 30d
 *   Q4 limit-expired: reportLimits where last < now - 2d
 * Every query's limit is the run's remaining delete budget, and every
 * bugReports delete re-checks the document's own status field before
 * deleting it (T-83-44: new/filing documents are never touched, however
 * old). A dry run logs "would delete <id> (<reason>)" and deletes nothing;
 * reportLimits deletions are always logged/reported as "reportLimits/
 * <redacted>" / "limit", never the uid. */
async function cleanupRun(ctx) {
  const nowMs = ctx.now();
  const reportCutoff = new Date(nowMs - REPORT_RETENTION_MS).toISOString();
  const limitCutoff = new Date(nowMs - LIMIT_RETENTION_MS).toISOString();

  const sweep = async (collectionId, queryBody, reason, guard) => {
    if (ctx.deleteBudget <= 0) return;
    const docs = await structuredQuery(ctx, { ...queryBody, limit: ctx.deleteBudget });
    for (const doc of docs) {
      if (ctx.deleteBudget <= 0) break;
      if (guard && !guard(doc)) continue;
      if (ctx.dryRun) {
        const label = collectionId === "reportLimits" ? "reportLimits/<redacted>" : doc.id;
        ctx.log(`would delete ${label} (${reason})`);
        ctx.result.deleted.push(deletedEntry(collectionId, doc.id, reason));
        ctx.deleteBudget--;
        continue;
      }
      const ok = await deleteDoc(ctx, collectionId, doc.id);
      if (ok) {
        ctx.result.deleted.push(deletedEntry(collectionId, doc.id, reason));
        ctx.deleteBudget--;
      }
    }
  };

  await sweep(
    "bugReports",
    cleanupQuery(
      "bugReports",
      [fieldFilter("status", "EQUAL", { stringValue: "filed" }), fieldFilter("oracleTrimmed", "EQUAL", { booleanValue: false })],
      "filedAt",
    ),
    "filed-full",
    (doc) => doc.fields.status === "filed",
  );

  await sweep(
    "bugReports",
    cleanupQuery(
      "bugReports",
      [fieldFilter("status", "EQUAL", { stringValue: "filed" }), fieldFilter("filedAt", "LESS_THAN", { stringValue: reportCutoff })],
      "filedAt",
    ),
    "filed-expired",
    (doc) => doc.fields.status === "filed",
  );

  await sweep(
    "bugReports",
    cleanupQuery(
      "bugReports",
      [fieldFilter("status", "EQUAL", { stringValue: "failed" }), fieldFilter("failedAt", "LESS_THAN", { stringValue: reportCutoff })],
      "failedAt",
    ),
    "failed-expired",
    (doc) => doc.fields.status === "failed",
  );

  await sweep(
    "reportLimits",
    cleanupQuery("reportLimits", [fieldFilter("last", "LESS_THAN", { timestampValue: limitCutoff })], "last"),
    "limit-expired",
    null,
  );
}

function githubHeaders(ctx, hasBody) {
  const headers = {
    Authorization: `Bearer ${ctx.githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ddr-bug-reports",
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function ensureLabel(ctx) {
  if (ctx.labelEnsured) return;
  ctx.labelEnsured = true;
  const res = await ctx.fetchFn(`https://api.github.com/repos/${ctx.owner}/${ctx.name}/labels`, {
    method: "POST",
    headers: githubHeaders(ctx, true),
    body: JSON.stringify({
      name: LABEL,
      color: "d93f0b",
      description: "Filed automatically from an in-app player bug report.",
    }),
  });
  // 201 created, or 422 because it already exists: both are fine.
  if (res.status !== 201 && res.status !== 422) {
    ctx.log(`warning: creating the ${LABEL} label returned HTTP ${res.status}`);
  }
}

async function listRecentIssues(ctx) {
  const res = await ctx.fetchFn(
    `https://api.github.com/repos/${ctx.owner}/${ctx.name}/issues` +
      `?labels=${LABEL}&state=all&sort=created&direction=desc&per_page=100`,
    { method: "GET", headers: githubHeaders(ctx, false) },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

async function createIssue(ctx, title, body) {
  const res = await ctx.fetchFn(`https://api.github.com/repos/${ctx.owner}/${ctx.name}/issues`, {
    method: "POST",
    headers: githubHeaders(ctx, true),
    body: JSON.stringify({ title, body, labels: [LABEL] }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return { number: json.number, html_url: json.html_url };
}

/** Files one already-locked doc: ensures the label, posts the issue, then
 * patches the doc to filed (with oracleTrimmed) and — when the Oracle fit
 * whole — deletes it immediately. Leaves the doc in "filing" (no revert
 * patch) on any failure, so a later run can retry or reconcile it. */
async function fileDoc(ctx, doc) {
  await ensureLabel(ctx);
  const title = issueTitle(doc.report);
  const keepUntil = keepUntilDate(ctx.now());
  const info = issueBodyInfo(doc.report, { docId: doc.id, createTime: doc.createTime, keepUntil });
  let issue = null;
  try {
    issue = await createIssue(ctx, title, info.body);
  } catch {
    issue = null;
  }
  if (!issue) {
    ctx.result.failed.push(doc.id);
    return;
  }
  await patchFiled(ctx, doc.id, issue.number, issue.html_url, info.trimmed);
  ctx.result.filed.push(doc.id);
  await maybeImmediateDelete(ctx, doc.id, info.trimmed, "filed-full");
}

function plannedLine(doc, nowMs) {
  const title = issueTitle(doc.report);
  const keepUntil = keepUntilDate(nowMs);
  const info = issueBodyInfo(doc.report, { docId: doc.id, createTime: doc.createTime, keepUntil });
  return `would file ${doc.id}: ${title} (${info.body.length} chars)`;
}

/** Reads new (and stale-filing) reports from Firestore and files each new
 * one, at most `maxPerRun`, oldest createTime first, as a public labelled
 * GitHub issue. A report already stuck "filing" for over
 * STALE_FILING_MS is reconciled against recent player-report issues, retried
 * up to MAX_ATTEMPTS, or marked failed. After filing, the four SRV-11
 * cleanup sweeps run against the run's shared delete budget
 * (MAX_DELETES_PER_RUN). Every network call goes through the injected
 * `fetchFn`; every timestamp through the injected `now`. Returns
 * `{ exitCode, filed, reconciled, skipped, failed, planned, deleted }` (or
 * `{ exitCode: 0, skipped: "no-secret", ... }` when the secret is absent). */
export async function runFiler({ env, fetchFn, now, log = console.log, dryRun = false, maxPerRun = MAX_PER_RUN }) {
  const result = { exitCode: 0, filed: [], reconciled: [], skipped: [], failed: [], planned: [], deleted: [] };

  const saJson = env.FIREBASE_BUG_REPORTS_SA;
  if (!saJson) {
    return { ...result, skipped: "no-secret" };
  }

  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch {
    log("Could not parse FIREBASE_BUG_REPORTS_SA as JSON.");
    return { ...result, exitCode: 1 };
  }

  const repoMatch = /^([^/\s]+)\/([^/\s]+)$/.exec(String(env.GITHUB_REPOSITORY || ""));
  if (!repoMatch) {
    log("GITHUB_REPOSITORY must be set as owner/name.");
    return { ...result, exitCode: 1 };
  }
  const [, owner, name] = repoMatch;

  const ctx = {
    fetchFn,
    now,
    log,
    dryRun,
    projectId: env.FIRESTORE_PROJECT_ID || sa.project_id || DEFAULT_PROJECT_ID,
    owner,
    name,
    githubToken: env.GITHUB_TOKEN,
    labelEnsured: false,
    deleteBudget: MAX_DELETES_PER_RUN,
    result,
  };

  try {
    ctx.accessToken = await getAccessToken({ sa, fetchFn, now });

    const newDocs = await runQuery(ctx, "new");
    const filingDocs = await runQuery(ctx, "filing");

    let recentIssues = null;
    const getRecentIssues = async () => {
      if (recentIssues === null) recentIssues = await listRecentIssues(ctx);
      return recentIssues;
    };

    // Reconcile (or retry, or fail out) reports stuck in "filing".
    for (const doc of filingDocs) {
      const updatedMs = Date.parse(doc.updateTime);
      if (now() - updatedMs < STALE_FILING_MS) continue; // still in flight; leave it alone

      const issues = await getRecentIssues();
      const marker = markerFor(doc.id);
      const match = issues.find((issue) => typeof issue.body === "string" && issue.body.startsWith(marker));

      if (match) {
        if (dryRun) {
          log(`would reconcile ${doc.id}: already filed as #${match.number}`);
        } else {
          const keepUntil = keepUntilDate(now());
          const info = issueBodyInfo(doc.report, { docId: doc.id, createTime: doc.createTime, keepUntil });
          await patchFiled(ctx, doc.id, match.number, match.html_url, info.trimmed);
          await maybeImmediateDelete(ctx, doc.id, info.trimmed, "filed-full");
        }
        result.reconciled.push(doc.id);
        continue;
      }

      const currentAttempts = doc.attempts || 0;
      if (currentAttempts >= MAX_ATTEMPTS) {
        if (dryRun) {
          log(`would mark ${doc.id} failed (attempts ${currentAttempts})`);
        } else {
          await patchFailed(ctx, doc, currentAttempts);
        }
        result.failed.push(doc.id);
        continue;
      }

      if (dryRun) {
        log(plannedLine(doc, now()));
        result.planned.push(doc.id);
        continue;
      }

      const nextAttempts = currentAttempts + 1;
      const locked = await lockDoc(ctx, doc, nextAttempts);
      if (!locked) {
        result.skipped.push(doc.id);
        continue;
      }
      await fileDoc(ctx, doc);
    }

    // File new reports, oldest createTime first, capped at maxPerRun.
    const sorted = newDocs.slice().sort((a, b) => Date.parse(a.createTime) - Date.parse(b.createTime));
    const toFile = sorted.slice(0, maxPerRun);
    for (const doc of toFile) {
      if (dryRun) {
        log(plannedLine(doc, now()));
        result.planned.push(doc.id);
        continue;
      }
      const locked = await lockDoc(ctx, doc, 1);
      if (!locked) {
        result.skipped.push(doc.id);
        continue;
      }
      await fileDoc(ctx, doc);
    }

    await cleanupRun(ctx);
  } catch {
    // Never let a transport failure leak into an unhandled rejection, and
    // never log the caught error itself (it could carry response bodies).
    log("The filer run failed before it could finish. See the workflow's own failure state.");
    return { ...result, exitCode: 1 };
  }

  if (result.failed.length > 0 && result.exitCode === 0) result.exitCode = 1;
  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const env = { ...process.env };

  const saFileFlagIdx = args.indexOf("--sa-file");
  if (saFileFlagIdx !== -1 && args[saFileFlagIdx + 1]) {
    // Never echo the path or its contents.
    env.FIREBASE_BUG_REPORTS_SA = readFileSync(args[saFileFlagIdx + 1], "utf8");
  }

  const dryRun = args.includes("--dry-run") || env.DRY_RUN === "true";

  if (!env.FIREBASE_BUG_REPORTS_SA) {
    console.log("::warning::FIREBASE_BUG_REPORTS_SA is not set; no reports were read");
    process.exit(0);
    return;
  }

  const result = await runFiler({
    env,
    fetchFn: globalThis.fetch.bind(globalThis),
    now: Date.now,
    dryRun,
  });

  const summarize = (label, list) => `${label} ${list.length} [${list.join(", ")}]`;
  console.log(
    [
      summarize("filed", result.filed),
      summarize("reconciled", result.reconciled),
      summarize("skipped", result.skipped),
      summarize("failed", result.failed),
      summarize("deleted", result.deleted),
    ].join(" | "),
  );
  process.exit(result.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
