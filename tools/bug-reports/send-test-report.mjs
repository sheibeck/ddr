#!/usr/bin/env node
// tools/bug-reports/send-test-report.mjs
//
// Phase 79.3 (D-17 items 2 and 6): the orchestrator's one-command test
// report and live rules probe. It runs the exact client code the app
// ships (src/browser/bugReport.js) against the live Firestore project, so
// the live check proves what players' devices will actually do, not a
// re-implementation of it.
//
// Modes:
//   (no flag)      sends one clearly-marked [TEST] report through
//                  sendBugReport, prints the JSON result. Exit 0 on ok,
//                  1 on a send failure, 2 while reporting is unavailable
//                  (an empty or malformed apiKey).
//   --dry-run      prints the masked endpoint (the key replaced by <key>)
//                  and the pretty-printed request body, without sending.
//                  Exit 0 even with an empty key.
//   --probe-rules  sends the three D-17 probes (a list read, a create with
//                  an extra field, a create with a pre-filed status) and
//                  expects every one refused with HTTP 403. Prints PASS or
//                  FAIL per probe; if a probe unexpectedly succeeds, also
//                  prints the created document's name for manual cleanup.
//                  Exit 0 only when all three probes got 403, else 1; exit
//                  2 while reporting is unavailable.
//   anything else  prints usage and exits 2.
//
// Never prints the API key itself. Node built-ins only.

import { pathToFileURL } from "node:url";

import { buildReportPayload, toFirestoreFields, reportingAvailable, reportsEndpoint, sendBugReport } from "../../src/browser/bugReport.js";
import { BUG_REPORT_CONFIG } from "../../src/browser/bugReportConfig.js";

const UNAVAILABLE_MESSAGE = "reporting unavailable: set apiKey in src/browser/bugReportConfig.js (79.3-08)";

/** testReportInputs(now) — buildReportPayload inputs for one clearly-marked [TEST] report. */
export function testReportInputs(now = new Date()) {
  return {
    text: `[TEST] Phase 79.3 live end-to-end check. Safe to close. ${now.toISOString()}`,
    oracleEntries: [
      '[TEST] <span class="roll">d20: 20</span> the probe roll landed clean.',
      "[TEST] the live rules probe began.",
    ],
    version: "test",
    platform: "node",
    userAgent: `node ${process.version} (${process.platform})`,
    state: null,
    now,
  };
}

/**
 * probeRequests(config, report) — the three D-17 requests, each expected
 * to be refused with HTTP 403 by the live rules:
 *   list-read    a GET of the collection URL (no body)
 *   extra-field  a create whose fields carry one the rules do not allow
 *   wrong-status a create whose status is not "new"
 */
export function probeRequests(config, report) {
  const url = reportsEndpoint(config);
  const baseFields = toFirestoreFields(report);
  return [
    { name: "list-read", url, init: { method: "GET" } },
    {
      name: "extra-field",
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { ...baseFields, extra: { stringValue: "x" } } }),
      },
    },
    {
      name: "wrong-status",
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: toFirestoreFields({ ...report, status: "filed" }) }),
      },
    },
  ];
}

function printUsage() {
  console.log("usage: node tools/bug-reports/send-test-report.mjs [--dry-run | --probe-rules]");
}

async function runProbe(probe) {
  try {
    const res = await globalThis.fetch(probe.url, probe.init);
    if (res.status === 403) return { name: probe.name, status: 403 };
    let createdName = null;
    if (res.ok) {
      try {
        const json = await res.json();
        createdName = json?.name ?? null;
      } catch {
        createdName = null;
      }
    }
    return { name: probe.name, status: res.status, createdName };
  } catch (err) {
    return { name: probe.name, status: `error: ${err.message}` };
  }
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.length > 1) {
    printUsage();
    return 2;
  }
  const flag = args[0];
  if (flag !== undefined && flag !== "--dry-run" && flag !== "--probe-rules") {
    printUsage();
    return 2;
  }

  const { report } = buildReportPayload(testReportInputs());

  if (flag === "--dry-run") {
    const maskedUrl = reportsEndpoint(BUG_REPORT_CONFIG).replace(/key=.*/, "key=<key>");
    console.log(maskedUrl);
    console.log(JSON.stringify({ fields: toFirestoreFields(report) }, null, 2));
    return 0;
  }

  if (flag === "--probe-rules") {
    if (!reportingAvailable(BUG_REPORT_CONFIG)) {
      console.log(UNAVAILABLE_MESSAGE);
      return 2;
    }
    const probes = probeRequests(BUG_REPORT_CONFIG, report);
    let allPass = true;
    for (const probe of probes) {
      const outcome = await runProbe(probe);
      if (outcome.status === 403) {
        console.log(`PASS ${outcome.name} (403)`);
      } else {
        allPass = false;
        console.log(`FAIL ${outcome.name} (${outcome.status})`);
        if (outcome.createdName) console.log(`created ${outcome.createdName} — clean it up`);
      }
    }
    return allPass ? 0 : 1;
  }

  // no flag: send the report through the shipped client code
  if (!reportingAvailable(BUG_REPORT_CONFIG)) {
    console.log(UNAVAILABLE_MESSAGE);
    return 2;
  }
  const result = await sendBugReport(report, { fetchFn: globalThis.fetch.bind(globalThis), config: BUG_REPORT_CONFIG });
  console.log(JSON.stringify(result));
  return result.ok ? 0 : 1;
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
