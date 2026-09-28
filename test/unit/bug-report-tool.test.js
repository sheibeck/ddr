// test/unit/bug-report-tool.test.js
//
// Phase 79.3 (D-17), Plan 01 Task 3 — tools/bug-reports/send-test-report.mjs.
// No network call here: the CLI's --dry-run and no-flag/reporting-unavailable
// paths are driven through spawnSync, which never reaches the network while
// BUG_REPORT_CONFIG.apiKey is empty. probeRequests and testReportInputs are
// asserted directly as pure functions.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";

import { buildReportPayload, validateReport, reportingAvailable } from "../../src/browser/bugReport.js";
import { BUG_REPORT_CONFIG } from "../../src/browser/bugReportConfig.js";
import { testReportInputs, probeRequests } from "../../tools/bug-reports/send-test-report.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TOOL_PATH = path.join(REPO_ROOT, "tools", "bug-reports", "send-test-report.mjs");

function runTool(args) {
  return spawnSync(process.execPath, [TOOL_PATH, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
}

test("testReportInputs: builds an ok, valid, clearly-marked [TEST] report", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");
  const { ok, report } = buildReportPayload(testReportInputs(now));
  assert.ok(ok);
  assert.deepEqual(validateReport(report), []);
  assert.match(report.text, /^\[TEST\]/);
});

test("probeRequests: the three named probes with the right shapes", () => {
  const { report } = buildReportPayload(testReportInputs());
  const probes = probeRequests(BUG_REPORT_CONFIG, report);
  assert.deepEqual(probes.map((p) => p.name), ["list-read", "extra-field", "wrong-status"]);

  const listRead = probes.find((p) => p.name === "list-read");
  assert.equal(listRead.init.method, "GET");
  assert.ok(!("body" in listRead.init) || listRead.init.body === undefined);

  const extraField = probes.find((p) => p.name === "extra-field");
  const extraBody = JSON.parse(extraField.init.body);
  assert.ok("extra" in extraBody.fields);

  const wrongStatus = probes.find((p) => p.name === "wrong-status");
  const wrongBody = JSON.parse(wrongStatus.init.body);
  assert.equal(wrongBody.fields.status.stringValue, "filed");
});

test("CLI --dry-run: exits 0, prints [TEST] and the masked key, sends nothing", () => {
  const result = runTool(["--dry-run"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[TEST\]/);
  assert.match(result.stdout, /<key>/);
});

test("CLI no flag: while reporting is unavailable, exits 2 and says so", (t) => {
  if (reportingAvailable(BUG_REPORT_CONFIG)) {
    t.skip("BUG_REPORT_CONFIG.apiKey is already filled (79.3-08 landed) — this unavailable-path assertion no longer applies");
    return;
  }
  const result = runTool([]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /reporting unavailable/);
});

test("CLI --probe-rules: while reporting is unavailable, exits 2 and says so", (t) => {
  if (reportingAvailable(BUG_REPORT_CONFIG)) {
    t.skip("BUG_REPORT_CONFIG.apiKey is already filled (79.3-08 landed) — this unavailable-path assertion no longer applies");
    return;
  }
  const result = runTool(["--probe-rules"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /reporting unavailable/);
});

test("CLI: an unknown flag exits 2", () => {
  const result = runTool(["--bogus"]);
  assert.equal(result.status, 2);
});

test("CLI: too many arguments exits 2", () => {
  const result = runTool(["--dry-run", "extra"]);
  assert.equal(result.status, 2);
});
