#!/usr/bin/env node
// tools/boards-admin.mjs
//
// Phase 83 (SRV-07), Plan 05 Task 1. Dev-only Firestore admin/moderation and
// balance-export tool for the leaderboard's `runs` collection: `top` (a
// leaderboard preview by any rank stat), `suspicious` (implausible-run
// heuristics: days/floor and kills/steps outliers, a name not composable
// from content/names.js, an epitaph matching no content/epitaphs.js
// template for its cause), `delete-run`, `ban`/`unban` (writes/clears
// banned/{uid} and removes that player's runs), and `export` (CSV/JSON of
// every run field, filterable by version/season/date, for balance tracking
// across builds — CONTEXT "Cheating & moderation" and the 2026-09-28
// balance-tracking addition). Never shipped: tools/ is never copied into
// www/ by tools/build-www.mjs.
//
// Auth is the exact shape tools/bug-reports/file-issues.mjs uses. With no
// --key/DDR_BOARDS_SA_KEY: the developer's own `gcloud auth
// print-access-token` (headers add X-Goog-User-Project so Firestore
// attributes quota/billing to this project) — this is IAM access, bypassing
// every firestore.rules check the same way the console would. With --key
// (or the DDR_BOARDS_SA_KEY env var) pointing at a service-account key file
// OUTSIDE the repository, signs and exchanges a JWT (datastore scope) the
// same way file-issues.mjs's signServiceAccountJwt/getAccessToken do. A key
// path resolving INSIDE the repository is refused with exit 2 before it is
// ever read. The key's path and contents are never printed, in an error
// message or in normal output, and never enter the repo or www/.
//
// Every read here (top/suspicious/export scan every matching run once) is
// billed against the shared Spark read quota (docs/LEADERBOARDS.md
// "## 11. Spark quotas") — this is a dev tool run by hand, never on a
// schedule.
//
// Exit codes: 0 ok, 1 a command started but failed partway through, 2 usage
// or an auth/key-safety refusal. Destructive commands (delete-run, ban,
// unban) are dry runs by default — printing exactly what would change — and
// only act with --yes.
//
// Node built-ins only; zero new dependencies.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getAccessToken } from "./bug-reports/file-issues.mjs";
import { FIREBASE_CONFIG } from "../src/browser/firebaseConfig.js";
import { FIRESTORE_BASE, documentsPath, docName, fromFirestoreFields } from "../src/browser/firestoreRest.js";
import {
  RUN_COLLECTION,
  BANNED_COLLECTION,
  RUN_DOC_FIELDS,
  RANK_FIELD,
  BOARD_STATS,
  isBoardStat,
  TOP_N,
  LIST_LIMIT_MAX,
  topTenQuery,
} from "../src/browser/runDoc.js";
import { NAMES } from "../content/names.js";
import { EPITAPHS } from "../content/epitaphs.js";
import { SEASON } from "../content/season.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEFAULT_PROJECT_ID = FIREBASE_CONFIG.projectId;

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

const BOOLEAN_FLAGS = new Set(["yes", "all-seasons"]);

/**
 * parseArgs(argv) — argv[0] is the command; every subsequent `--name value`
 * pair becomes flags[name] = value, `--name` alone (or a name in
 * BOOLEAN_FLAGS) becomes flags[name] = true, and every other token is a
 * positional. Never throws; never validates the command or positionals —
 * that is runCommand's job.
 */
export function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const command = args[0];
  const flags = {};
  const positionals = [];
  for (let i = command === undefined ? 0 : 1; i < args.length; i++) {
    const a = args[i];
    if (typeof a === "string" && a.startsWith("--")) {
      const name = a.slice(2);
      if (BOOLEAN_FLAGS.has(name)) {
        flags[name] = true;
        continue;
      }
      const next = args[i + 1];
      if (next !== undefined && !(typeof next === "string" && next.startsWith("--"))) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { command, flags, positionals };
}

// ---------------------------------------------------------------------------
// resolveAdminAuth
// ---------------------------------------------------------------------------

function resolvePathInfo(repoRoot, targetPath) {
  const abs = path.isAbsolute(targetPath) ? targetPath : path.resolve(repoRoot, targetPath);
  const rel = path.relative(repoRoot, abs);
  const inside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  return { abs, inside };
}

/**
 * resolveAdminAuth({ flags, env, execFn, fetchFn, now, repoRoot, readFile,
 * getAccessTokenFn }) — the two admin auth paths described above. Returns
 * { ok: true, headers } or { ok: false, message } — `message` never
 * contains the key path or its contents. Never throws.
 */
export async function resolveAdminAuth(opts = {}) {
  const {
    flags = {},
    env = {},
    execFn,
    fetchFn,
    now = Date.now,
    repoRoot = REPO_ROOT,
    readFile,
    getAccessTokenFn = getAccessToken,
  } = opts;

  const keyPath =
    (flags && typeof flags.key === "string" && flags.key) ||
    (env && typeof env.DDR_BOARDS_SA_KEY === "string" && env.DDR_BOARDS_SA_KEY);

  if (keyPath) {
    if (resolvePathInfo(repoRoot, keyPath).inside) {
      return {
        ok: false,
        message:
          "A service-account key file must live outside the repository (never committed, never copied into www/).",
      };
    }
    let sa;
    try {
      sa = JSON.parse(readFile(keyPath, "utf8"));
    } catch {
      return { ok: false, message: "Could not read or parse the service-account key file." };
    }
    let accessToken;
    try {
      accessToken = await getAccessTokenFn({ sa, fetchFn, now });
    } catch {
      return { ok: false, message: "Could not exchange the service-account key for a Firestore access token." };
    }
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      return { ok: false, message: "The service-account token exchange returned no token." };
    }
    return { ok: true, headers: { Authorization: `Bearer ${accessToken}` } };
  }

  let raw;
  try {
    raw = execFn("gcloud auth print-access-token");
  } catch {
    return {
      ok: false,
      message:
        "`gcloud auth print-access-token` failed — run `gcloud auth login`, or pass --key with a service-account key file outside the repo.",
    };
  }
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    return { ok: false, message: "`gcloud auth print-access-token` returned no token." };
  }
  const projectId = (env && env.DDR_BOARDS_PROJECT_ID) || DEFAULT_PROJECT_ID;
  return { ok: true, headers: { Authorization: `Bearer ${token}`, "X-Goog-User-Project": projectId } };
}

// ---------------------------------------------------------------------------
// createAdminApi
// ---------------------------------------------------------------------------

function fieldEq(field, value) {
  return { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } };
}

function fieldEqInt(field, value) {
  return { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { integerValue: String(value) } } };
}

function decodeHit(hit) {
  if (!hit || !hit.document) return null;
  const id = String(hit.document.name).split("/").pop();
  return { id, doc: fromFirestoreFields(hit.document.fields || {}) };
}

/**
 * createAdminApi({ projectId, fetchFn, headers }) — the admin REST surface
 * over `runs`/`banned`: query (a raw structuredQuery), listAll (paged by
 * __name__, pageSize default 300), getRun/deleteRun, runsOf/deleteRunsOf
 * (commit deletes batched at most 100 per :commit), setBan/clearBan. Every
 * call carries `headers` (an admin Authorization Bearer token — IAM access,
 * bypassing firestore.rules) and never an API key.
 */
export function createAdminApi({ projectId, fetchFn, headers }) {
  const config = { projectId };
  const base = `${FIRESTORE_BASE}/${documentsPath(config)}`;

  async function request(suffix, init) {
    const res = await fetchFn(`${base}${suffix}`, {
      ...init,
      headers: { ...headers, "Content-Type": "application/json", ...(init && init.headers) },
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  }

  async function query(structuredQuery) {
    const { ok, json } = await request(":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery }) });
    if (!ok || !Array.isArray(json)) return [];
    const rows = [];
    for (const hit of json) {
      const row = decodeHit(hit);
      if (row) rows.push(row);
    }
    return rows;
  }

  async function listAll({ where, pageSize = 300 } = {}) {
    const rows = [];
    let afterName = null;
    for (;;) {
      const structuredQuery = {
        from: [{ collectionId: RUN_COLLECTION }],
        orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
        limit: pageSize,
      };
      if (where) structuredQuery.where = where;
      if (afterName) structuredQuery.startAt = { values: [{ referenceValue: afterName }], before: false };
      const page = await query(structuredQuery);
      rows.push(...page);
      if (page.length < pageSize) break;
      afterName = docName(config, RUN_COLLECTION, page[page.length - 1].id);
    }
    return rows;
  }

  async function getRun(id) {
    const { ok, json } = await request(`/${RUN_COLLECTION}/${id}`, { method: "GET" });
    if (!ok || !json) return null;
    return { id, doc: fromFirestoreFields(json.fields || {}) };
  }

  async function deleteRun(id) {
    const { ok } = await request(`/${RUN_COLLECTION}/${id}`, { method: "DELETE" });
    return ok;
  }

  async function runsOf(uid) {
    return listAll({ where: fieldEq("uid", uid) });
  }

  // Deletes go through the single-document admin DELETE endpoint, not a
  // :commit batch: firebase/firestore.rules' (and its fakeBoardServer.js
  // mirror's) commit-based delete Write is owner-gated even for the admin
  // token — only the single-document GET/DELETE endpoints extend the
  // IAM-level admin bypass. Deleted in waves of at most 100 concurrent
  // requests, preserving the "at most 100 at a time" shape without a
  // Write the admin commit path would refuse.
  async function deleteRunsOf(uid) {
    const rows = await runsOf(uid);
    const ids = rows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      await Promise.all(batch.map((id) => deleteRun(id)));
    }
    return ids.length;
  }

  async function setBan(uid, { reason, at }) {
    const { ok } = await request(`/${BANNED_COLLECTION}/${uid}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { at: { timestampValue: at }, reason: { stringValue: String(reason) } } }),
    });
    return ok;
  }

  async function clearBan(uid) {
    const { ok } = await request(`/${BANNED_COLLECTION}/${uid}`, { method: "DELETE" });
    return ok;
  }

  return Object.freeze({ query, listAll, getRun, deleteRun, runsOf, deleteRunsOf, setBan, clearBan });
}

// ---------------------------------------------------------------------------
// suspicious: name and epitaph plausibility
// ---------------------------------------------------------------------------

export const SUSPICIOUS_DEFAULTS = Object.freeze({ daysPerFloor: 20, killsPerStep: 0.2 });

/** isRolledName(name, race) — true when `name` is exactly some content/names.js NAMES[race].first (+ " " + .sur) combination. */
export function isRolledName(name, race) {
  if (typeof name !== "string") return false;
  const pool = NAMES[race];
  if (!pool) return false;
  for (const first of pool.first) {
    for (const sur of pool.sur) {
      const built = sur ? `${first} ${sur}` : first;
      if (built === name) return true;
    }
  }
  return false;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function templateToRegExp(template) {
  const parts = String(template).split(/(\{[a-zA-Z]+\})/g);
  const pattern = parts
    .map((part) => (/^\{[a-zA-Z]+\}$/.test(part) ? "[\\s\\S]+?" : escapeRegExp(part)))
    .join("");
  return new RegExp(`^${pattern}$`);
}

/** isBankedEpitaph(epitaph, cause) — true when a non-empty `epitaph` matches some content/epitaphs.js EPITAPHS[cause] template (each {token} a non-empty wildcard). Empty epitaph, or an unknown cause, is false. */
export function isBankedEpitaph(epitaph, cause) {
  if (typeof epitaph !== "string" || epitaph.length === 0) return false;
  const templates = EPITAPHS[cause];
  if (!Array.isArray(templates)) return false;
  return templates.some((t) => templateToRegExp(t).test(epitaph));
}

/**
 * scoreSuspicious(run, thresholds) — the reasons a run doc looks
 * implausible: "days-per-floor" (day > thresholds.daysPerFloor * floor),
 * "kills-per-step" (kills > thresholds.killsPerStep * max(steps, 1)),
 * "name-not-rolled" (isRolledName false), "epitaph-not-banked" (a
 * non-empty epitaph matches no template for its cause). Never throws.
 */
export function scoreSuspicious(run, thresholds = SUSPICIOUS_DEFAULTS) {
  const r = run && typeof run === "object" ? run : {};
  const t = thresholds && typeof thresholds === "object" ? thresholds : SUSPICIOUS_DEFAULTS;
  const floor = Number(r.floor) || 0;
  const day = Number(r.day) || 0;
  const steps = Number(r.steps) || 0;
  const kills = Number(r.kills) || 0;
  const reasons = [];
  if (day > t.daysPerFloor * floor) reasons.push("days-per-floor");
  if (kills > t.killsPerStep * Math.max(steps, 1)) reasons.push("kills-per-step");
  if (!isRolledName(r.name, r.race)) reasons.push("name-not-rolled");
  if (typeof r.epitaph === "string" && r.epitaph.length > 0 && !isBankedEpitaph(r.epitaph, r.cause)) {
    reasons.push("epitaph-not-banked");
  }
  return reasons;
}

// ---------------------------------------------------------------------------
// export: filter + CSV
// ---------------------------------------------------------------------------

/** filterExport(rows, { version, since, until }) — version equality; since/until are inclusive UTC calendar days over each row's createdAt. Never throws. */
export function filterExport(rows, opts = {}) {
  const { version, since, until } = opts || {};
  const sinceMs = typeof since === "string" && since ? Date.parse(`${since}T00:00:00.000Z`) : null;
  const untilMs = typeof until === "string" && until ? Date.parse(`${until}T23:59:59.999Z`) : null;
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((row) => {
    if (version && row.version !== version) return false;
    if (sinceMs !== null) {
      const t = Date.parse(row.createdAt);
      if (!(Number.isFinite(t) && t >= sinceMs)) return false;
    }
    if (untilMs !== null) {
      const t = Date.parse(row.createdAt);
      if (!(Number.isFinite(t) && t <= untilMs)) return false;
    }
    return true;
  });
}

function csvEscapeField(v) {
  const s = v === undefined || v === null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** toCsv(rows) — a header of "id" + RUN_DOC_FIELDS, then one RFC 4180-escaped row per run. */
export function toCsv(rows) {
  const header = ["id", ...RUN_DOC_FIELDS];
  const lines = [header.join(",")];
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    lines.push(header.map((k) => csvEscapeField(row ? row[k] : undefined)).join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function formatRunRow(rank, row) {
  const d = row.doc || {};
  return [
    String(rank),
    row.id,
    d.handle,
    d.name,
    d.race,
    d.sub,
    `floor ${d.floor}`,
    `day ${d.day}`,
    `steps ${d.steps}`,
    `kills ${d.kills}`,
    `gold ${d.gold}`,
    d.version,
    d.createdAt,
  ].join("  ");
}

async function cmdTop(api, flags, out) {
  const stat = flags.stat;
  let limit = Number.parseInt(flags.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = TOP_N;
  if (limit > LIST_LIMIT_MAX) limit = LIST_LIMIT_MAX;
  const season = flags.season !== undefined ? Number(flags.season) : SEASON;
  const race = typeof flags.race === "string" ? flags.race : null;
  const sub = typeof flags.sub === "string" ? flags.sub : null;

  let structuredQuery;
  if (flags["all-seasons"]) {
    const filters = [];
    if (race) filters.push(fieldEq("race", race));
    if (sub) filters.push(fieldEq("sub", sub));
    structuredQuery = {
      from: [{ collectionId: RUN_COLLECTION }],
      orderBy: [{ field: { fieldPath: RANK_FIELD[stat] }, direction: "DESCENDING" }],
      limit,
    };
    if (filters.length === 1) structuredQuery.where = filters[0];
    else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: "AND", filters } };
  } else {
    structuredQuery = topTenQuery({ stat, season, race, sub, limit }).structuredQuery;
  }

  const rows = await api.query(structuredQuery);
  rows.forEach((row, i) => out(formatRunRow(i + 1, row)));
  return 0;
}

async function cmdSuspicious(api, flags, out) {
  const thresholds = {
    daysPerFloor:
      flags["days-per-floor"] !== undefined ? Number(flags["days-per-floor"]) : SUSPICIOUS_DEFAULTS.daysPerFloor,
    killsPerStep:
      flags["kills-per-step"] !== undefined ? Number(flags["kills-per-step"]) : SUSPICIOUS_DEFAULTS.killsPerStep,
  };
  const rows = await api.listAll({});
  const scored = rows
    .map((row) => ({ ...row, reasons: scoreSuspicious(row.doc, thresholds) }))
    .filter((row) => row.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length);
  for (const row of scored) {
    const d = row.doc || {};
    out(`${row.id}  [${row.reasons.join(", ")}]  ${d.handle}  ${d.name}  floor ${d.floor} day ${d.day} steps ${d.steps} kills ${d.kills}`);
  }
  return 0;
}

async function cmdDeleteRun(api, id, flags, out) {
  const row = await api.getRun(id);
  if (!row) {
    out(`Run ${id} was not found.`);
    return 0;
  }
  const d = row.doc || {};
  if (!flags.yes) {
    out(`Would delete run ${id} (${d.handle || "?"}, ${d.name || "?"}, floor ${d.floor}, day ${d.day}). Pass --yes to delete.`);
    return 0;
  }
  await api.deleteRun(id);
  out(`Deleted run ${id}.`);
  return 0;
}

async function cmdBan(api, uid, flags, now, out) {
  if (!flags.yes) {
    out(`Would ban ${uid} and delete every one of their runs. Pass --yes to ban.`);
    return 0;
  }
  const reason = typeof flags.reason === "string" ? flags.reason : "banned by admin";
  const at = new Date(now()).toISOString();
  await api.setBan(uid, { reason, at });
  const deleted = await api.deleteRunsOf(uid);
  out(`Banned ${uid} (${reason}); deleted ${deleted} run(s).`);
  return 0;
}

async function cmdUnban(api, uid, flags, out) {
  if (!flags.yes) {
    out(`Would unban ${uid}. Pass --yes to unban.`);
    return 0;
  }
  await api.clearBan(uid);
  out(`Unbanned ${uid}.`);
  return 0;
}

async function cmdExport(api, flags, out, err, writeFile, repoRoot) {
  const format = flags.format === "json" ? "json" : "csv";
  const allSeasons = flags["all-seasons"] === true;
  const season = allSeasons ? null : flags.season !== undefined ? Number(flags.season) : SEASON;
  const where = season === null ? undefined : fieldEqInt("season", season);
  const rawRows = await api.listAll({ where });
  const flat = rawRows.map((r) => ({ id: r.id, ...r.doc }));
  const rows = filterExport(flat, { version: flags.version, since: flags.since, until: flags.until });
  const content = format === "json" ? JSON.stringify(rows, null, 2) : toCsv(rows);

  if (flags.out) {
    const outPath = typeof flags.out === "string" ? flags.out : "";
    const { abs, inside } = resolvePathInfo(repoRoot, outPath);
    if (inside && !path.basename(abs).startsWith("boards-export")) {
      err("--out inside the repository must be named boards-export* (which .gitignore ignores).");
      return 2;
    }
    writeFile(abs, content);
    out(`Wrote ${rows.length} run(s) to ${abs}.`);
    return 0;
  }

  out(content);
  return 0;
}

// ---------------------------------------------------------------------------
// runCommand
// ---------------------------------------------------------------------------

const COMMANDS = new Set(["top", "suspicious", "delete-run", "ban", "unban", "export", "help"]);

function usage(out) {
  out("tools/boards-admin.mjs — leaderboard moderation and balance export (dev-only)");
  out("");
  out("Usage: node tools/boards-admin.mjs <command> [flags]");
  out("");
  out("Commands:");
  out("  top --stat <deep|days|kills|purse> [--race R] [--sub S] [--limit N] [--season N|--all-seasons]");
  out("  suspicious [--days-per-floor N] [--kills-per-step N]");
  out("  delete-run <id> [--yes]");
  out("  ban <uid> [--reason TEXT] [--yes]");
  out("  unban <uid> [--yes]");
  out("  export [--format csv|json] [--version V] [--season N|--all-seasons] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--out PATH]");
  out("  help");
  out("");
  out("Auth: no --key uses `gcloud auth print-access-token`. --key (or DDR_BOARDS_SA_KEY) must");
  out("point at a service-account key file OUTSIDE the repository — it never enters the repo or www/.");
}

/**
 * runCommand({ argv, env, fetchFn, execFn, now, out, err, repoRoot,
 * writeFile, readFile, getAccessTokenFn }) — parses argv, validates the
 * command and its required positionals (usage + exit 2 on failure),
 * resolves admin auth, then dispatches. Returns an exit code; never throws
 * (a command failure prints via `err` and returns 1).
 */
export async function runCommand(opts = {}) {
  const {
    argv = [],
    env = {},
    fetchFn,
    execFn,
    now = Date.now,
    out = () => {},
    err = () => {},
    repoRoot = REPO_ROOT,
    writeFile = () => {},
    readFile,
    getAccessTokenFn,
  } = opts;

  const { command, flags, positionals } = parseArgs(argv);

  if (!command || command === "help") {
    usage(out);
    return 0;
  }

  if (!COMMANDS.has(command)) {
    err(`Unknown command: ${command}`);
    usage(out);
    return 2;
  }

  if (command === "top" && !isBoardStat(flags.stat)) {
    err(`top requires --stat one of: ${BOARD_STATS.join(", ")}.`);
    usage(out);
    return 2;
  }
  if (command === "delete-run" && positionals.length < 1) {
    err("delete-run requires a run id.");
    usage(out);
    return 2;
  }
  if ((command === "ban" || command === "unban") && positionals.length < 1) {
    err(`${command} requires a uid.`);
    usage(out);
    return 2;
  }

  const auth = await resolveAdminAuth({ flags, env, execFn, fetchFn, now, repoRoot, readFile, getAccessTokenFn });
  if (!auth.ok) {
    err(auth.message);
    return 2;
  }

  const projectId = (env && env.DDR_BOARDS_PROJECT_ID) || DEFAULT_PROJECT_ID;
  const api = createAdminApi({ projectId, fetchFn, headers: auth.headers });

  try {
    if (command === "top") return await cmdTop(api, flags, out);
    if (command === "suspicious") return await cmdSuspicious(api, flags, out);
    if (command === "delete-run") return await cmdDeleteRun(api, positionals[0], flags, out);
    if (command === "ban") return await cmdBan(api, positionals[0], flags, now, out);
    if (command === "unban") return await cmdUnban(api, positionals[0], flags, out);
    if (command === "export") return await cmdExport(api, flags, out, err, writeFile, repoRoot);
  } catch {
    err("The command failed before it could finish.");
    return 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const code = await runCommand({
    argv: process.argv.slice(2),
    env: process.env,
    fetchFn: globalThis.fetch,
    execFn: (cmd) => execSync(cmd, { encoding: "utf8" }),
    now: Date.now,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    repoRoot: REPO_ROOT,
    writeFile: (p, content) => writeFileSync(p, content, "utf8"),
    readFile: (p, encoding) => readFileSync(p, encoding || "utf8"),
  });
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
