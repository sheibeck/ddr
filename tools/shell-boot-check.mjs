#!/usr/bin/env node
// tools/shell-boot-check.mjs
//
// Install-free headless-Chrome boot gate for www/index.html (Phase 44
// 44-01, DEAD-01 gate infrastructure). Uses the locally installed
// Chrome/Edge binary directly via --headless=new --dump-dom — no
// playwright, no npm install. node:http + node:fs + node:child_process
// only.
//
// Usage:
//   node tools/shell-boot-check.mjs [--chrome <path>] [--out <dir>]
//     [--url <url>] [--budget <ms>]
//   node tools/shell-boot-check.mjs --self-test
//
// Behaviour (plain run):
//   1. Serve ./www on 127.0.0.1:8765 (unless --url is given).
//   2. Resolve the browser binary (--chrome, else $CHROME, else the first
//      existing default Chrome/Edge install path on this machine).
//   3. Spawn it headless against the URL, --dump-dom to <out>/boot-dom.html,
//      console/stderr captured to <out>/boot-console.log.
//   4. Evaluate four checks against the captured DOM/console and print one
//      PASS/FAIL line each: no-uncaught, painted, graves, title.
//   5. Exit 0 iff all four pass, else 1. Browser-resolution failure exits 2.
//
// --self-test: proves the no-uncaught check has teeth. Serves a scratch
// page that throws, runs the same pipeline, and exits 0 ONLY IF the
// no-uncaught check FAILED on it (the throw was actually detected).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const DEFAULT_CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

function parseArgs(argv) {
  const args = { budget: 8000, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") args.selfTest = true;
    else if (a === "--chrome") args.chrome = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--budget") args.budget = Number(argv[++i]);
  }
  return args;
}

function resolveBrowser(args) {
  if (args.chrome) {
    if (fs.existsSync(args.chrome)) return args.chrome;
    console.error(`ERROR: --chrome path does not exist: ${args.chrome}`);
    return null;
  }
  if (process.env.CHROME) {
    if (fs.existsSync(process.env.CHROME)) return process.env.CHROME;
    console.error(`ERROR: $CHROME path does not exist: ${process.env.CHROME}`);
    return null;
  }
  for (const p of DEFAULT_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  console.error(
    "ERROR: no Chrome/Edge binary found. Pass --chrome <path> (or set $CHROME) to point at your local install."
  );
  return null;
}

function startStaticServer(root, port) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/index.html";
    const f = path.join(root, p);
    fs.readFile(f, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": CONTENT_TYPES[path.extname(f)] || "application/octet-stream",
      });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function runChromeDumpDom(chromePath, url, outDir, budget) {
  const profileDir = path.join(outDir, "profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--user-data-dir=${profileDir}`,
    `--virtual-time-budget=${budget}`,
    "--enable-logging=stderr",
    "--v=0",
    "--dump-dom",
    url,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(chromePath, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", () => resolve({ stdout, stderr, child }));
    // SIGINT / cleanup hook
    activeChild = child;
  });
}

let activeChild = null;
let activeServer = null;

function cleanup() {
  if (activeChild && !activeChild.killed) {
    try {
      activeChild.kill();
    } catch {
      /* ignore */
    }
  }
  if (activeServer) {
    try {
      activeServer.close();
    } catch {
      /* ignore */
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

async function runOnce({ url, outDir, chromePath, budget, domFile, consoleFile }) {
  const { stdout, stderr } = await runChromeDumpDom(chromePath, url, outDir, budget);
  fs.writeFileSync(domFile, stdout, "utf8");
  fs.writeFileSync(consoleFile, stderr, "utf8");
  // Strip <script>/<style> element bodies before checking — --dump-dom
  // serializes their raw source text verbatim, and that source text can
  // contain the same substrings (e.g. a `mw-error` class name literal
  // inside a template string, or a CSS selector) the checks look for in
  // actual RENDERED markup. Checks below run against markup only.
  const markup = stdout
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const noUncaught = !stderr.includes("Uncaught ");
  const painted = markup.includes('id="s-level">Lvl ');
  const graves =
    (markup.includes("mw-empty") || markup.includes("mw-grave")) &&
    !markup.includes("mw-error");
  const title = markup.includes('id="mw-title"');
  return {
    checks: { "no-uncaught": noUncaught, painted, graves, title },
    domFile,
    consoleFile,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.out || path.join(os.tmpdir(), "shell-boot-check");
  fs.mkdirSync(outDir, { recursive: true });

  const chromePath = resolveBrowser(args);
  if (!chromePath) {
    process.exit(2);
  }

  if (args.selfTest) {
    await selfTest(args, outDir, chromePath);
    return;
  }

  let server = null;
  let url = args.url;
  if (!url) {
    const root = path.resolve(process.cwd(), "www");
    server = await startStaticServer(root, 8765);
    activeServer = server;
    url = "http://127.0.0.1:8765/";
  }

  const domFile = path.join(outDir, "boot-dom.html");
  const consoleFile = path.join(outDir, "boot-console.log");

  let result;
  try {
    result = await runOnce({
      url,
      outDir,
      chromePath,
      budget: args.budget,
      domFile,
      consoleFile,
    });
  } finally {
    cleanup();
  }

  const names = ["no-uncaught", "painted", "graves", "title"];
  let allPass = true;
  for (const name of names) {
    const pass = result.checks[name];
    if (!pass) allPass = false;
    console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  }
  console.log(`DOM: ${result.domFile}`);
  console.log(`Console: ${result.consoleFile}`);
  process.exit(allPass ? 0 : 1);
}

async function selfTest(args, outDir, chromePath) {
  const selfTestHtml = path.join(outDir, "selftest.html");
  fs.writeFileSync(
    selfTestHtml,
    `<!doctype html><html><body><script>throw new Error("shell-boot-check self-test");</script></body></html>`,
    "utf8"
  );

  const server = await startStaticServer(outDir, 8765);
  activeServer = server;
  const url = "http://127.0.0.1:8765/selftest.html";

  const domFile = path.join(outDir, "selftest-dom.html");
  const consoleFile = path.join(outDir, "selftest-console.log");

  let result;
  try {
    result = await runOnce({
      url,
      outDir,
      chromePath,
      budget: args.budget,
      domFile,
      consoleFile,
    });
  } finally {
    cleanup();
  }

  console.log(`DOM: ${result.domFile}`);
  console.log(`Console: ${result.consoleFile}`);

  // Fail-first proof: the injected throw must have been DETECTED, i.e. the
  // no-uncaught check itself FAILED on the scratch page.
  if (result.checks["no-uncaught"] === false) {
    console.log("SELF-TEST PASS: the injected uncaught error WAS detected (no-uncaught check correctly failed).");
    process.exit(0);
  } else {
    console.log("SELF-TEST FAIL: the injected uncaught error was NOT detected — the no-uncaught check has no teeth.");
    process.exit(1);
  }
}

main().catch((err) => {
  cleanup();
  console.error(err);
  process.exit(1);
});
