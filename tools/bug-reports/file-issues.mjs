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
// Node built-ins only (node:crypto, node:fs, node:url) plus
// issue-format.mjs. fetch and the clock are injected everywhere so every
// path here is unit-testable with no network.

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { issueTitle, issueBody, markerFor, decodeFirestoreFields } from "./issue-format.mjs";

export const LABEL = "player-report";
export const MAX_PER_RUN = 20;
export const STALE_FILING_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
export const QUERY_LIMIT = 200;
export const DEFAULT_PROJECT_ID = "delve-die-repeat-6ba5f";

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

async function runQuery(ctx, statusValue) {
  const res = await ctx.fetchFn(`${firestoreDocsUrl(ctx)}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "bugReports" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "status" },
            op: "EQUAL",
            value: { stringValue: statusValue },
          },
        },
        limit: QUERY_LIMIT,
      },
    }),
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
      report: fields,
      attempts: typeof fields.attempts === "number" ? fields.attempts : 0,
    });
  }
  return docs;
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

async function patchFiled(ctx, docId, issueNumber, issueUrl) {
  const url =
    `${firestoreDocsUrl(ctx)}/bugReports/${docId}` +
    `?updateMask.fieldPaths=status&updateMask.fieldPaths=issueNumber` +
    `&updateMask.fieldPaths=issueUrl&updateMask.fieldPaths=filedAt`;
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
      },
    }),
  });
}

async function patchFailed(ctx, doc, attempts) {
  const url =
    `${firestoreDocsUrl(ctx)}/bugReports/${doc.id}` +
    `?updateMask.fieldPaths=status&updateMask.fieldPaths=attempts` +
    `&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`;
  return ctx.fetchFn(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: { status: { stringValue: "failed" }, attempts: { integerValue: String(attempts) } },
    }),
  });
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
 * patches the doc to filed. Leaves the doc in "filing" (no revert patch) on
 * any failure, so a later run can retry or reconcile it. */
async function fileDoc(ctx, doc) {
  await ensureLabel(ctx);
  const title = issueTitle(doc.report);
  const body = issueBody(doc.report, { docId: doc.id, createTime: doc.createTime });
  let issue = null;
  try {
    issue = await createIssue(ctx, title, body);
  } catch {
    issue = null;
  }
  if (!issue) {
    ctx.result.failed.push(doc.id);
    return;
  }
  await patchFiled(ctx, doc.id, issue.number, issue.html_url);
  ctx.result.filed.push(doc.id);
}

function plannedLine(doc) {
  const title = issueTitle(doc.report);
  const body = issueBody(doc.report, { docId: doc.id, createTime: doc.createTime });
  return `would file ${doc.id}: ${title} (${body.length} chars)`;
}

/** Reads new (and stale-filing) reports from Firestore and files each new
 * one, at most `maxPerRun`, oldest createTime first, as a public labelled
 * GitHub issue. A report already stuck "filing" for over
 * STALE_FILING_MS is reconciled against recent player-report issues, retried
 * up to MAX_ATTEMPTS, or marked failed. Every network call goes through the
 * injected `fetchFn`; every timestamp through the injected `now`. Returns
 * `{ exitCode, filed, reconciled, skipped, failed, planned }` (or
 * `{ exitCode: 0, skipped: "no-secret", ... }` when the secret is absent). */
export async function runFiler({ env, fetchFn, now, log = console.log, dryRun = false, maxPerRun = MAX_PER_RUN }) {
  const result = { exitCode: 0, filed: [], reconciled: [], skipped: [], failed: [], planned: [] };

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
          await patchFiled(ctx, doc.id, match.number, match.html_url);
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
        log(plannedLine(doc));
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
        log(plannedLine(doc));
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
    ].join(" | "),
  );
  process.exit(result.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
