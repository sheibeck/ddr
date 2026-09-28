// test/unit/bug-report-issue.test.js
//
// Phase 79.3 (BUG-04) Plan 02 Task 1 — pins tools/bug-reports/issue-format.mjs:
// the pure issue title/body formatter (neutralising @/#, HTML-lite escaping,
// backtick-safe fencing, the details table, Oracle trimming to GitHub's
// 65,536-char body limit) and the Firestore typed-value decoder.

import test from "node:test";
import assert from "node:assert/strict";

import {
  GITHUB_BODY_MAX,
  TITLE_TEXT_MAX,
  neutralize,
  escapeLite,
  quoteBlock,
  fenceFor,
  markerFor,
  issueTitle,
  detailsTable,
  issueBody,
  decodeFirestoreValue,
  decodeFirestoreFields,
} from "../../tools/bug-reports/issue-format.mjs";

test("neutralize puts a ZWJ after every @ and #", () => {
  assert.equal(neutralize("@sheibeck see #12"), "@‍sheibeck see #‍12");
  assert.equal(neutralize("no ampersands here"), "no ampersands here");
});

test("escapeLite escapes & first, then < and >", () => {
  assert.equal(
    escapeLite('<!-- ddr-report:x --> & <b>'),
    "&lt;!-- ddr-report:x --&gt; &amp; &lt;b&gt;",
  );
});

test("quoteBlock quotes every line, normalizes CRLF, and neutralises", () => {
  assert.equal(quoteBlock("line one\r\n\r\n@x"), "> line one\n> \n> @‍x");
});

test("fenceFor returns a fence longer than the longest backtick run, minimum three", () => {
  assert.equal(fenceFor("a ``` b ```` c"), "`".repeat(5));
  assert.equal(fenceFor("plain"), "`".repeat(3));
});

test("issueTitle collapses whitespace, skips leading blank lines, and neutralises", () => {
  assert.equal(
    issueTitle({ text: "\n  The rat ate my  @torch #3\nmore" }),
    "[Player report] The rat ate my @‍torch #‍3",
  );
});

test("issueTitle truncates a first line over 70 chars to 69 plus an ellipsis", () => {
  const long = "B".repeat(100);
  const result = issueTitle({ text: long });
  assert.equal(result, `[Player report] ${"B".repeat(TITLE_TEXT_MAX - 1)}…`);
  assert.equal(result.length, "[Player report] ".length + TITLE_TEXT_MAX);
});

test("issueTitle gives a placeholder for empty text", () => {
  assert.equal(issueTitle({ text: "" }), "[Player report] (no summary)");
  assert.equal(issueTitle({ text: "   \n  " }), "[Player report] (no summary)");
});

test("markerFor wraps the doc id in the hidden HTML comment", () => {
  assert.equal(markerFor("abc"), "<!-- ddr-report:abc -->");
});

const BASE_REPORT = {
  text: "The rat ate my torch",
  oracle: "first line\nsecond line\nthird line",
  version: "2.1.0 (11)",
  platform: "android",
  device: "Pixel 7",
};

const BASE_META = { docId: "abc", createTime: "2026-09-28T17:00:00.000Z" };

test("issueBody: first line is the marker, followed by the quoted text", () => {
  const body = issueBody(BASE_REPORT, BASE_META);
  const lines = body.split("\n");
  assert.equal(lines[0], markerFor("abc"));
  assert.equal(lines[1], `> ${neutralize(escapeLite(BASE_REPORT.text))}`);
});

test("issueBody: details table has all ten rows, with run fields populated", () => {
  const report = {
    ...BASE_REPORT,
    run: { depth: 5, cls: "Fighter", sub: "Berserker", race: "Human", level: 3, steps: 42, day: 2, dead: false },
  };
  const body = issueBody(report, BASE_META);
  assert.match(body, /\| Version \| 2\.1\.0 \(11\) \|/);
  assert.match(body, /\| Platform \| android \|/);
  assert.match(body, /\| Device \| Pixel 7 \|/);
  assert.match(body, /\| Floor \| 5 \|/);
  assert.match(body, /\| Hero \| Human Berserker \(Fighter\) \|/);
  assert.match(body, /\| Level \| 3 \|/);
  assert.match(body, /\| Turn \| day 2, step 42 \|/);
  assert.match(body, /\| State \| alive \|/);
  assert.match(body, /\| Sent at \| 2026-09-28T17:00:00\.000Z \|/);
  assert.match(body, /\| Report \| abc \|/);
  assert.match(body, /\| \| \|\n\|---\|---\|/);
});

test("issueBody: State reads dead when the run is dead", () => {
  const report = {
    ...BASE_REPORT,
    run: { depth: 5, cls: "Fighter", sub: "Berserker", race: "Human", level: 3, steps: 42, day: 2, dead: true },
  };
  const body = issueBody(report, BASE_META);
  assert.match(body, /\| State \| dead \|/);
});

test("issueBody: with no run, the run-derived rows read 'no run'", () => {
  const body = issueBody(BASE_REPORT, BASE_META);
  assert.match(body, /\| Floor \| no run \|/);
  assert.match(body, /\| Hero \| no run \|/);
  assert.match(body, /\| Level \| no run \|/);
  assert.match(body, /\| Turn \| no run \|/);
  assert.match(body, /\| State \| no run \|/);
});

test("issueBody: every cell has its pipe escaped and passes through neutralize(escapeLite(...))", () => {
  const report = {
    ...BASE_REPORT,
    version: "2.1.0 (11) | @weird #1",
    device: "  a   weird   <device> & | name  ",
  };
  const body = issueBody(report, BASE_META);
  const expectedVersion = neutralize(escapeLite("2.1.0 (11) | @weird #1".replace(/\s+/g, " "))).replace(/\|/g, "\\|");
  const expectedDevice = neutralize(escapeLite("a weird <device> & | name")).replace(/\|/g, "\\|");
  assert.match(body, new RegExp(`\\| Version \\| ${expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`));
  assert.match(body, new RegExp(`\\| Device \\| ${expectedDevice.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`));
});

test("issueBody: the Oracle sits inside <details><summary> and a fence, with no trim under the limit", () => {
  const body = issueBody(BASE_REPORT, BASE_META);
  assert.match(body, /<details><summary>Oracle \(3 lines\)<\/summary>/);
  assert.doesNotMatch(body, /trimmed here to fit GitHub/);
  assert.match(body, /```text\nfirst line\nsecond line\nthird line\n```/);
  assert.match(body, /<\/details>\s*$/);
});

test("issueBody: an Oracle containing a backtick run and </details> still renders safely inside the fence", () => {
  const report = {
    ...BASE_REPORT,
    oracle: "prefix\n```code fence``` inline\n</details> looks like a close tag\nsuffix",
  };
  const body = issueBody(report, BASE_META);
  const fence = "`".repeat(4); // longest run in the oracle is 3 backticks
  const fenceOpenIdx = body.indexOf(`${fence}text\n`);
  const fenceCloseIdx = body.indexOf(`\n${fence}\n`, fenceOpenIdx + 1);
  const lastRealCloseTag = body.lastIndexOf("</details>");
  assert.ok(fenceOpenIdx >= 0, "opening fence should be present");
  assert.ok(fenceCloseIdx > fenceOpenIdx, "closing fence should follow the opening fence");
  assert.ok(lastRealCloseTag > fenceCloseIdx, "the real closing </details> tag must come after the fence closes");
  // The forged-looking "</details>" inside the oracle sits between the fences.
  const forgedIdx = body.indexOf("</details> looks like a close tag");
  assert.ok(forgedIdx > fenceOpenIdx && forgedIdx < fenceCloseIdx);
});

test("issueBody: an oversized Oracle is trimmed from the oldest lines to fit GITHUB_BODY_MAX", () => {
  const totalLines = 3000;
  const lines = [];
  for (let i = 0; i < totalLines; i++) {
    lines.push(`line ${String(i).padStart(4, "0")} ${"x".repeat(33)}`);
  }
  const oracle = lines.join("\n"); // ~120,000 chars
  assert.ok(oracle.length > 100000, "fixture oracle should be well over 100k chars");

  const report = { ...BASE_REPORT, oracle };
  const body = issueBody(report, BASE_META);

  assert.ok(body.length <= GITHUB_BODY_MAX, `body length ${body.length} must be <= ${GITHUB_BODY_MAX}`);

  const noteMatch = body.match(
    /The oldest (\d+) lines are trimmed here to fit GitHub; the full Oracle is in the Firestore report `abc`\./,
  );
  assert.ok(noteMatch, "trim note should be present");
  const dropped = Number(noteMatch[1]);
  assert.ok(dropped > 0 && dropped < totalLines);

  const kept = totalLines - dropped;
  assert.match(body, new RegExp(`<details><summary>Oracle \\(${kept} lines\\)</summary>`));

  // The kept lines are the newest ones (highest indices), oldest dropped.
  const keptLines = lines.slice(dropped);
  assert.ok(body.includes(keptLines[keptLines.length - 1]), "the newest line should be kept");
  assert.ok(!body.includes(lines[0]), "the oldest line should be dropped");
});

test("issueBody: a report under the limit has no trim note", () => {
  const body = issueBody(BASE_REPORT, BASE_META);
  assert.doesNotMatch(body, /trimmed here to fit GitHub/);
});

test("decodeFirestoreValue / decodeFirestoreFields round-trip the 79.3-01 typed-value encoding", () => {
  const fields = {
    text: { stringValue: "hello" },
    count: { integerValue: "12" },
    ratio: { doubleValue: 3.5 },
    ok: { booleanValue: true },
    nothing: { nullValue: null },
    nested: { mapValue: { fields: { a: { stringValue: "b" } } } },
    list: { arrayValue: { values: [{ stringValue: "x" }, { integerValue: "2" }] } },
    createTime: { timestampValue: "2026-09-28T17:00:00.000Z" },
    weird: { geoPointValue: { latitude: 1, longitude: 2 } },
  };
  const decoded = decodeFirestoreFields(fields);
  assert.deepEqual(decoded, {
    text: "hello",
    count: 12,
    ratio: 3.5,
    ok: true,
    nothing: null,
    nested: { a: "b" },
    list: ["x", 2],
    createTime: "2026-09-28T17:00:00.000Z",
    weird: null,
  });
  assert.equal(typeof decoded.count, "number");
  assert.equal(typeof decoded.createTime, "string");
});

test("decodeFirestoreValue decodes an unknown shape to null", () => {
  assert.equal(decodeFirestoreValue({ geoPointValue: {} }), null);
  assert.equal(decodeFirestoreValue(undefined), null);
});

test("GITHUB_BODY_MAX is 65536 and neutralize handles adjacent markers", () => {
  assert.equal(GITHUB_BODY_MAX, 65536);
  assert.equal(neutralize("@a#b"), "@‍a#‍b");
});
