// test/unit/achievements-zip-cli.test.js
//
// Phase 98 plan 98-03 (ZIP-01, ZIP-03): the tools/achievements-zip.mjs CLI.
// Exit codes, atomic and concurrent builds, the default output path, the
// copy table, and the .gitignore entry for the output directory.

import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { REPO_ROOT, DEFAULT_ZIP_PATH, copyTable, loadCatalog } from "../../tools/lib/achievements-zip.mjs";

const CLI = path.join(REPO_ROOT, "tools", "achievements-zip.mjs");

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function runAsync(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function withTemp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ach-zip-cli-"));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  let result;
  try {
    result = fn(dir);
  } catch (err) {
    cleanup();
    throw err;
  }
  if (result && typeof result.then === "function") return result.finally(cleanup);
  cleanup();
  return result;
}

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const printed = (stdout, key) => (stdout.match(new RegExp(`^${key}: (.+)$`, "m")) || [])[1];

test("--build writes a valid zip and prints its path, size, sha256 and counts", () =>
  withTemp((dir) => {
    const out = path.join(dir, "z", "ddr-achievements.zip");
    const r = run(["--build", "--out", out]);
    assert.equal(r.status, 0, r.stderr);
    const bytes = fs.readFileSync(out);
    assert.equal(printed(r.stdout, "path"), out);
    assert.equal(printed(r.stdout, "size"), `${bytes.length} bytes`);
    assert.equal(printed(r.stdout, "sha256"), sha(bytes));
    assert.equal(printed(r.stdout, "entries"), "79");
    assert.equal(printed(r.stdout, "achievements"), "77");
    assert.equal(printed(r.stdout, "points"), "1110");
    assert.deepEqual(fs.readdirSync(path.dirname(out)), ["ddr-achievements.zip"], "no temp file left");
  }));

test("a rebuild is byte-identical", () =>
  withTemp((dir) => {
    const a = path.join(dir, "a.zip");
    const b = path.join(dir, "b.zip");
    const ra = run(["--build", "--out", a]);
    const rb = run(["--build", "--out", b]);
    assert.equal(ra.status, 0, ra.stderr);
    assert.equal(rb.status, 0, rb.stderr);
    assert.equal(printed(ra.stdout, "sha256"), printed(rb.stdout, "sha256"));
    assert.ok(fs.readFileSync(a).equals(fs.readFileSync(b)));
    const again = run(["--build", "--out", a]);
    assert.equal(again.status, 0, again.stderr);
    assert.equal(printed(again.stdout, "sha256"), printed(ra.stdout, "sha256"), "overwriting is idempotent");
  }));

test("--check passes on a built zip", () =>
  withTemp((dir) => {
    const out = path.join(dir, "ok.zip");
    assert.equal(run(["--build", "--out", out]).status, 0);
    const r = run(["--check", out]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^PASS /);
    assert.match(r.stdout, /77 achievements/);
  }));

test("--check fails on a flipped byte and names zip-readable", () =>
  withTemp((dir) => {
    const out = path.join(dir, "bad.zip");
    assert.equal(run(["--build", "--out", out]).status, 0);
    const bytes = fs.readFileSync(out);
    bytes[bytes.indexOf("IHDR") + 20] ^= 0xff;
    fs.writeFileSync(out, bytes);
    const r = run(["--check", out]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^zip-readable: /m);
  }));

test("--check on a missing path fails with a clear message", () =>
  withTemp((dir) => {
    const r = run(["--check", path.join(dir, "nope.zip")]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Cannot read/);
  }));

test("--check on a zip that differs from the catalog names matches-catalog", () =>
  withTemp((dir) => {
    const root = path.join(dir, "root");
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    const src = fs.readFileSync(path.join(REPO_ROOT, "content", "achievements.js"), "utf8");
    fs.writeFileSync(path.join(root, "content", "achievements.js"), src.replace('points: 100,', 'points: 105,'));
    const out = path.join(dir, "ok.zip");
    assert.equal(run(["--build", "--out", out]).status, 0);
    const r = run(["--check", out, "--root", root]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^matches-catalog: /m);
  }));

test("usage errors exit 2", () => {
  for (const args of [[], ["--build", "--check"], ["--frobnicate"], ["--build", "--out"], ["--check", "a.zip", "b.zip"], ["--copy-table", "extra"]]) {
    const r = run(args);
    assert.equal(r.status, 2, `args ${JSON.stringify(args)}`);
    assert.match(r.stderr, /Usage: node tools\/achievements-zip\.mjs/);
  }
});

test("a failing build exits 1 and leaves neither the output nor a temp file", () =>
  withTemp((dir) => {
    const root = path.join(dir, "root");
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, "content", "achievements.js"), path.join(root, "content", "achievements.js"));
    const outDir = path.join(dir, "out");
    fs.mkdirSync(outDir);
    const out = path.join(outDir, "ddr-achievements.zip");
    const r = run(["--build", "--root", root, "--out", out]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing/);
    assert.deepEqual(fs.readdirSync(outDir), []);
  }));

test("a failing build keeps an earlier good file untouched", () =>
  withTemp((dir) => {
    const root = path.join(dir, "root");
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, "content", "achievements.js"), path.join(root, "content", "achievements.js"));
    const out = path.join(dir, "keep.zip");
    fs.writeFileSync(out, "previous good bytes");
    assert.equal(run(["--build", "--root", root, "--out", out]).status, 1);
    assert.equal(fs.readFileSync(out, "utf8"), "previous good bytes");
    assert.deepEqual(fs.readdirSync(dir).sort(), ["keep.zip", "root"]);
  }));

test("two concurrent builds both pass, agree and leave one valid file", async () =>
  withTemp(async (dir) => {
    const single = path.join(dir, "single.zip");
    const s = run(["--build", "--out", single]);
    assert.equal(s.status, 0, s.stderr);
    const want = printed(s.stdout, "sha256");

    const outDir = path.join(dir, "race");
    const out = path.join(outDir, "ddr-achievements.zip");
    const [a, b] = await Promise.all([runAsync(["--build", "--out", out]), runAsync(["--build", "--out", out])]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(sha(fs.readFileSync(out)), want);
    assert.equal(printed(a.stdout, "sha256"), want);
    assert.equal(printed(b.stdout, "sha256"), want);
    assert.deepEqual(fs.readdirSync(outDir), ["ddr-achievements.zip"], "no temp file left");
  }));

test("--build with only --root writes build/achievements/ddr-achievements.zip under that root", () =>
  withTemp((dir) => {
    const root = path.join(dir, "root");
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, "content", "achievements.js"), path.join(root, "content", "achievements.js"));
    fs.cpSync(path.join(REPO_ROOT, "achievements", "play"), path.join(root, "achievements", "play"), { recursive: true });
    const r = run(["--build", "--root", root]);
    assert.equal(r.status, 0, r.stderr);
    const expected = path.join(root, ...DEFAULT_ZIP_PATH.split("/"));
    assert.equal(DEFAULT_ZIP_PATH, "build/achievements/ddr-achievements.zip");
    assert.ok(fs.existsSync(expected));
    assert.equal(printed(r.stdout, "path"), expected);
    const c = run(["--check", "--root", root]);
    assert.equal(c.status, 0, c.stdout + c.stderr);
  }));

test("--copy-table prints exactly copyTable, and --out writes the same text", async () => {
  const want = copyTable(await loadCatalog(REPO_ROOT));
  const r = run(["--copy-table"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, want);
  withTemp((dir) => {
    const out = path.join(dir, "sub", "copy.md");
    const w = run(["--copy-table", "--out", out]);
    assert.equal(w.status, 0, w.stderr);
    assert.equal(fs.readFileSync(out, "utf8"), want);
  });
});

test("the build never touches committed sources", () =>
  withTemp((dir) => {
    const before = ["content/achievements.js", "achievements/manifest.json"].map((f) => sha(fs.readFileSync(path.join(REPO_ROOT, f))));
    assert.equal(run(["--build", "--out", path.join(dir, "z.zip")]).status, 0);
    const after = ["content/achievements.js", "achievements/manifest.json"].map((f) => sha(fs.readFileSync(path.join(REPO_ROOT, f))));
    assert.deepEqual(after, before);
  }));

test(".gitignore ignores the output directory with the exact line build/achievements/", () => {
  const lines = fs.readFileSync(path.join(REPO_ROOT, ".gitignore"), "utf8").split(/\r?\n/);
  assert.ok(lines.includes("build/achievements/"));
});
