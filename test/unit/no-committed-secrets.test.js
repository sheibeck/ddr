// test/unit/no-committed-secrets.test.js
//
// Phase 79.3 (BUG-04) Plan 02 Task 3, T-79.3-08 — a repo-wide scan that
// fails if any tracked file carries a PEM private-key header or a
// service-account JSON's type-equals-service_account marker. The Firebase
// bug-reports service account key must live only in the GitHub secret
// FIREBASE_BUG_REPORTS_SA (D-14); this is the safety net against a key ever
// landing in git history. Also pins that .gitignore blocks the likely
// key-file names before anyone can `git add` one by accident.
//
// The needles are built from two halves at runtime so this file's own
// source text never contains the literal string it's scanning for.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// Binary (or otherwise non-text) extensions this scan skips reading.
const SKIP_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "ico",
  "mp3", "ogg", "wav", "webm", "mp4",
  "woff", "woff2", "ttf", "otf", "eot",
  "jks", "keystore", "aab", "apk", "jar",
  "zip", "gz",
]);

function pemPrivateKeyNeedles() {
  const begin = "-----BEGIN ";
  return [`${begin}PRIVATE KEY-----`, `${begin}RSA PRIVATE KEY-----`];
}

function serviceAccountJsonNeedle() {
  // Firebase/GCP service-account JSON always carries a type field set to service_account.
  return `${'"type"'}${":"}${' "service_account"'}`;
}

test("no tracked file contains a PEM private-key header or a service-account JSON marker", (t) => {
  const listed = spawnSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (listed.error || listed.status !== 0) {
    t.skip("git is not available here; skipping the tracked-file secret scan.");
    return;
  }

  const files = listed.stdout.split("\0").filter(Boolean);
  const needles = [...pemPrivateKeyNeedles(), serviceAccountJsonNeedle()];

  for (const relPath of files) {
    const ext = path.extname(relPath).slice(1).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) continue;

    const absPath = path.resolve(REPO_ROOT, relPath);
    let stat;
    try {
      stat = fs.statSync(absPath);
    } catch {
      continue; // e.g. a path git still lists mid-rename; nothing to read
    }
    if (!stat.isFile() || stat.size > MAX_SIZE_BYTES) continue;

    let content;
    try {
      content = fs.readFileSync(absPath, "utf8");
    } catch {
      continue;
    }

    for (const needle of needles) {
      assert.ok(
        !content.includes(needle),
        `${relPath} appears to contain a committed secret (matched a needle beginning ${JSON.stringify(needle.slice(0, 12))})`,
      );
    }
  }
});

test(".gitignore blocks the likely service-account key file names", () => {
  const gitignore = fs.readFileSync(path.resolve(REPO_ROOT, ".gitignore"), "utf8");
  for (const pattern of ["ddr-bug-reports*.json", "*service-account*.json", "*-sa-key*.json"]) {
    assert.ok(gitignore.includes(pattern), `.gitignore should include the pattern ${pattern}`);
  }
});
