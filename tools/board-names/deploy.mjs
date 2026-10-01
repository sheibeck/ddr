#!/usr/bin/env node
// tools/board-names/deploy.mjs
//
// Phase 91.2 (BOARD-31), D-01, D-14. The one reviewed command that deploys the
// boardName Cloud Function (functions/board-names/), plus the one-time project
// setup it needs. Dev-only, never shipped (tools/ is never copied into www/).
//
//   node tools/board-names/deploy.mjs [--setup] [--name-source provider|games]
//        [--pgs-client-id <id>] [--yes]
//
// DRY RUN BY DEFAULT. Without --yes this prints every gcloud command it would
// run and runs none of them. Every live run is the user's go (D-14): Blaze,
// the provider enable and this deploy happen at the 91.2-10 checkpoint, just
// in time with the release or the Compete-ON device test, not before.
//
//   --setup        also print (and with --yes run) the one-time setup: enable
//                  the APIs, create the function's service account and give it
//                  roles/datastore.user. The deploy alone is the common case.
//   --name-source  provider (default): the name is Google's providerUserInfo
//                  displayName. games: the G1/A4 fallback; the function wants
//                  a server auth code and exchanges it with the web client
//                  secret, which lives in Secret Manager.
//
// The web client SECRET is never accepted or printed here: the games source
// reads it from the Secret Manager secret `pgs-web-client-secret`, and
// --setup --name-source games prints how to create that secret from a file
// kept outside the repository.
//
// Exit codes: 0 ok (or a dry run), 1 a command failed (the run stops there),
// 2 usage. Node built-ins only; commands run through boards-admin.mjs's
// execGcloud (which retries through Git Bash on Windows).

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";
import { execGcloud } from "../boards-admin.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export const DEFAULTS = Object.freeze({
  project: FIREBASE_CONFIG.projectId,
  region: "us-central1",
  functionName: "boardName",
  source: "functions/board-names",
  serviceAccountId: "board-names",
  secretName: "pgs-web-client-secret",
});

const WEB_CLIENT_ID_RE = /^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/;
const SOURCES = new Set(["provider", "games"]);

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.code = "USAGE";
  }
}

function resolve(opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  const nameSource = o.nameSource ?? "provider";
  if (!SOURCES.has(nameSource)) throw new UsageError(`--name-source must be provider or games, not ${JSON.stringify(nameSource)}.`);
  if (nameSource === "games") {
    if (typeof o.pgsClientId !== "string" || !WEB_CLIENT_ID_RE.test(o.pgsClientId)) {
      throw new UsageError("--name-source games needs --pgs-client-id <the Game server web client id>.");
    }
  }
  return {
    project: o.project ?? DEFAULTS.project,
    region: o.region ?? DEFAULTS.region,
    nameSource,
    pgsClientId: o.pgsClientId,
  };
}

const serviceAccountEmail = (project) => `${DEFAULTS.serviceAccountId}@${project}.iam.gserviceaccount.com`;

/** functionUrl(opts) — the HTTPS URL the deployed function answers on. */
export function functionUrl(opts = {}) {
  const r = resolve({ ...opts, nameSource: "provider" });
  return `https://${r.region}-${r.project}.cloudfunctions.net/${DEFAULTS.functionName}`;
}

/** buildDeployArgs(opts) — the gcloud arguments (without `gcloud`) of the deploy. Throws a USAGE error on a bad option. */
export function buildDeployArgs(opts = {}) {
  const r = resolve(opts);
  const env = [`NAME_SOURCE=${r.nameSource}`];
  if (r.nameSource === "games") env.push(`PGS_WEB_CLIENT_ID=${r.pgsClientId}`);
  const args = [
    "functions",
    "deploy",
    DEFAULTS.functionName,
    "--gen2",
    "--runtime=nodejs22",
    `--region=${r.region}`,
    `--source=${DEFAULTS.source}`,
    `--entry-point=${DEFAULTS.functionName}`,
    "--trigger-http",
    "--allow-unauthenticated",
    `--service-account=${serviceAccountEmail(r.project)}`,
    "--max-instances=3",
    "--memory=256Mi",
    "--timeout=60s",
    `--set-env-vars=${env.join(",")}`,
  ];
  if (r.nameSource === "games") args.push(`--set-secrets=PGS_WEB_CLIENT_SECRET=${DEFAULTS.secretName}:latest`);
  args.push(`--project=${r.project}`);
  return args;
}

/** setupCommands(opts) — the one-time project setup, each command as a gcloud argument list. */
export function setupCommands(opts = {}) {
  const r = resolve(opts);
  const apis = ["cloudfunctions", "cloudbuild", "artifactregistry", "run"];
  if (r.nameSource === "games") apis.push("secretmanager");
  return [
    ["services", "enable", ...apis.map((a) => `${a}.googleapis.com`), `--project=${r.project}`],
    ["iam", "service-accounts", "create", DEFAULTS.serviceAccountId, `--display-name=${DEFAULTS.serviceAccountId}`, `--project=${r.project}`],
    [
      "projects",
      "add-iam-policy-binding",
      r.project,
      `--member=serviceAccount:${serviceAccountEmail(r.project)}`,
      "--role=roles/datastore.user",
      "--condition=None",
    ],
  ];
}

/** secretInstructions(opts) — the manual Secret Manager steps for the games source ([] for the provider source). */
export function secretInstructions(opts = {}) {
  const r = resolve({ ...opts, pgsClientId: opts.pgsClientId ?? "0-x.apps.googleusercontent.com" });
  if (r.nameSource !== "games") return [];
  return [
    "The games source reads the web client secret from Secret Manager. Create it from a file kept OUTSIDE the repo",
    "(never type the secret on a command line, never commit it), then let the function's service account read it:",
    `  gcloud secrets create ${DEFAULTS.secretName} --data-file=<path-to-a-file-outside-the-repo> --project=${r.project}`,
    `  gcloud secrets add-iam-policy-binding ${DEFAULTS.secretName} --member=serviceAccount:${serviceAccountEmail(r.project)} --role=roles/secretmanager.secretAccessor --project=${r.project}`,
  ];
}

function quote(arg) {
  return /[\s"'<>|&;$`]/.test(arg) ? `"${arg.replace(/(["\\$`])/g, "\\$1")}"` : arg;
}

/** formatCommand(args) — the printable `gcloud ...` line. */
export function formatCommand(args) {
  return `gcloud ${args.map(quote).join(" ")}`;
}

const VALUE_FLAGS = new Set(["name-source", "pgs-client-id"]);
const BOOLEAN_FLAGS = new Set(["setup", "yes", "help"]);

function parseArgs(argv) {
  const flags = {};
  const list = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (typeof a !== "string" || !a.startsWith("--")) throw new UsageError(`Unexpected argument: ${typeof a === "string" ? a.slice(0, 40) : "?"}.`);
    const name = a.slice(2);
    if (/secret/i.test(name)) throw new UsageError("This tool never accepts a client secret: it lives in Secret Manager (see --setup --name-source games).");
    if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = true;
    } else if (VALUE_FLAGS.has(name)) {
      const next = list[i + 1];
      if (typeof next !== "string" || next.startsWith("--")) throw new UsageError(`--${name} needs a value.`);
      flags[name] = next;
      i++;
    } else {
      throw new UsageError(`Unknown flag: --${name.slice(0, 30)}.`);
    }
  }
  return flags;
}

function usage(out) {
  out("Usage: node tools/board-names/deploy.mjs [--setup] [--name-source provider|games] [--pgs-client-id <id>] [--yes]");
  out("Prints the gcloud commands; runs them only with --yes (every live run is the user's go, D-14).");
}

/**
 * runDeploy({ argv, run, out, err }) — the CLI. `run(cmd)` executes one
 * command string (injected in tests; execGcloud in main). Returns the exit
 * code; never throws.
 */
export async function runDeploy({ argv = [], run, out = () => {}, err = () => {} } = {}) {
  let flags;
  let opts;
  try {
    flags = parseArgs(argv);
    if (flags.help) {
      usage(out);
      return 0;
    }
    opts = { nameSource: flags["name-source"] ?? "provider", pgsClientId: flags["pgs-client-id"] };
    resolve(opts);
  } catch (e) {
    err(e && e.code === "USAGE" ? e.message : "Could not read the arguments.");
    usage(out);
    return 2;
  }

  const commands = [];
  if (flags.setup) commands.push(...setupCommands(opts));
  commands.push(buildDeployArgs(opts));
  const lines = commands.map(formatCommand);

  if (!flags.yes) {
    for (const line of lines) out(line);
    if (flags.setup) for (const line of secretInstructions(opts)) out(line);
    out(`Expected function URL: ${functionUrl()}`);
    out("Dry run: nothing was run. Pass --yes to run these commands.");
    return 0;
  }

  for (const line of lines) {
    out(`> ${line}`);
    try {
      const result = await run(line);
      if (typeof result === "string" && result.trim()) out(result.trim());
    } catch {
      err(`Command failed: ${line}`);
      return 1;
    }
  }
  if (flags.setup) for (const line of secretInstructions(opts)) out(line);
  out(`Done. Expected function URL: ${functionUrl()}`);
  return 0;
}

async function main() {
  process.chdir(path.resolve(REPO_ROOT));
  const code = await runDeploy({
    argv: process.argv.slice(2),
    run: (cmd) => execGcloud(cmd),
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
