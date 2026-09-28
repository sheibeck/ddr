// tools/bug-reports/issue-format.mjs
//
// Phase 79.3 (BUG-04), D-05 (public issues, no mentions) and D-14 (issue
// format: marker, neutralised quote, details table, collapsed trimmed
// Oracle). Pure: no I/O, no clock, no network. Every export here is a plain
// function over plain data so it can be unit-tested without a filer, a
// fetch, or a service account.
//
// Also carries the Firestore typed-value JSON decoder the filer needs to
// read `runQuery` results (decodeFirestoreValue / decodeFirestoreFields).

export const GITHUB_BODY_MAX = 65536;
export const TITLE_TEXT_MAX = 70;
export const ISSUE_TITLE_PREFIX = "[Player report] ";
export const MARKER_PREFIX = "<!-- ddr-report:";
const MARKER_SUFFIX = " -->";

/** Every @ and # gets a zero-width joiner right after it, so GitHub never
 * treats player text as a mention or an issue/PR reference. */
export function neutralize(str) {
  return String(str ?? "").replace(/[@#]/g, (m) => m + "‍");
}

/** Minimal HTML escaping: & first, then < and >. Nothing else changes. */
export function escapeLite(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Quotes text as a Markdown blockquote, one `>` per source line, with
 * every line HTML-escaped then neutralised so a quoted line can't mention
 * anyone or forge a marker. */
export function quoteBlock(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map((line) => `> ${neutralize(escapeLite(line))}`)
    .join("\n");
}

/** A code fence at least one backtick longer than the longest backtick run
 * in `str`, so the fenced content can never break out of the fence. Always
 * at least three backticks. */
export function fenceFor(str) {
  const runs = String(str ?? "").match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return "`".repeat(Math.max(3, longest + 1));
}

/** The hidden HTML-comment marker that ties a filed issue back to its
 * Firestore report. Always the body's first line. */
export function markerFor(docId) {
  return `${MARKER_PREFIX}${docId}${MARKER_SUFFIX}`;
}

/** `[Player report] <first line, collapsed, neutralised, ≤ 70 chars>`.
 * Empty (or whitespace-only) text gives "(no summary)". */
export function issueTitle(report) {
  const raw = String(report?.text ?? "").trim();
  const firstLine = raw.split("\n")[0];
  const collapsed = firstLine.replace(/\s+/g, " ").trim();
  if (!collapsed) return `${ISSUE_TITLE_PREFIX}(no summary)`;
  let summary = neutralize(collapsed);
  if (summary.length > TITLE_TEXT_MAX) {
    summary = `${summary.slice(0, TITLE_TEXT_MAX - 1)}…`;
  }
  return `${ISSUE_TITLE_PREFIX}${summary}`;
}

/** A single Markdown table cell: whitespace collapsed, HTML-escaped, then
 * neutralised, then its own `|` escaped so it can't break the table. */
function tableCell(value) {
  const collapsed = String(value ?? "").replace(/\s+/g, " ").trim();
  return neutralize(escapeLite(collapsed)).replace(/\|/g, "\\|");
}

/** The two-column details table: Version, Platform, Device, Floor, Hero,
 * Level, Turn, State, Sent at, Report. Without a `run`, the run-derived
 * rows (Floor, Hero, Level, Turn, State) read "no run". `deviceOverride`
 * lets issueBody clamp an outsized Device cell as a last-resort fallback. */
export function detailsTable(report, meta, deviceOverride) {
  const run = report?.run;
  const noRun = "no run";
  const floor = run ? String(run.depth) : noRun;
  const hero = run ? `${run.race} ${run.sub} (${run.cls})` : noRun;
  const level = run ? String(run.level) : noRun;
  const turn = run ? `day ${run.day}, step ${run.steps}` : noRun;
  const state = run ? (run.dead ? "dead" : "alive") : noRun;
  const rows = [
    ["Version", report?.version],
    ["Platform", report?.platform],
    ["Device", deviceOverride !== undefined ? deviceOverride : report?.device],
    ["Floor", floor],
    ["Hero", hero],
    ["Level", level],
    ["Turn", turn],
    ["State", state],
    ["Sent at", meta?.createTime],
    ["Report", meta?.docId],
  ];
  const lines = ["| | |", "|---|---|"];
  for (const [label, value] of rows) lines.push(`| ${label} | ${tableCell(value)} |`);
  return lines.join("\n");
}

/** Builds the full issue body: marker, quoted text, details table, then the
 * Oracle in a collapsed `<details>` block inside a fence longer than any
 * backtick run it contains. Trims the Oracle's oldest lines, one at a
 * time, until the body fits GITHUB_BODY_MAX; the note this adds names the
 * dropped-line count. If even an empty Oracle doesn't fit (impossible
 * under the D-11/D-13 field caps), the Device cell is clamped as a last
 * resort. */
export function issueBody(report, meta) {
  const marker = markerFor(meta?.docId);
  const quote = quoteBlock(report?.text ?? "");

  const oracleText = String(report?.oracle ?? "");
  const oracleAllLines = oracleText === "" ? [] : oracleText.split("\n");

  let deviceOverride;
  const head = () => `${marker}\n${quote}\n\n${detailsTable(report, meta, deviceOverride)}\n\n`;

  let dropped = 0;
  for (;;) {
    const kept = dropped >= oracleAllLines.length ? [] : oracleAllLines.slice(dropped);
    const keptText = kept.join("\n");
    const fence = fenceFor(keptText);
    const trimNote =
      dropped > 0
        ? `The oldest ${dropped} lines are trimmed here to fit GitHub; the full Oracle is in the Firestore report \`${meta?.docId}\`.\n\n`
        : "";
    const detailsBlock =
      `<details><summary>Oracle (${kept.length} lines)</summary>\n\n` +
      `${trimNote}${fence}text\n${keptText}\n${fence}\n\n</details>`;
    const body = head() + detailsBlock;

    if (body.length <= GITHUB_BODY_MAX) return body;

    if (kept.length === 0) {
      if (deviceOverride === undefined) {
        // Last-resort fallback: clamp the Device cell and retry once with
        // an empty Oracle. Not expected to trigger under the D-11/D-13
        // field caps, but the body is still returned even if this doesn't
        // bring it under the limit.
        deviceOverride = "(clamped)";
        continue;
      }
      return body;
    }
    dropped++;
  }
}

/** Decodes one Firestore REST typed value (`{ stringValue }`,
 * `{ integerValue }`, …) into a plain JS value. Timestamps stay strings.
 * An unrecognised shape decodes to null. */
export function decodeFirestoreValue(value) {
  if (value == null || typeof value !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return value.doubleValue;
  if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
  if (Object.prototype.hasOwnProperty.call(value, "mapValue")) {
    return decodeFirestoreFields((value.mapValue && value.mapValue.fields) || {});
  }
  if (Object.prototype.hasOwnProperty.call(value, "arrayValue")) {
    return ((value.arrayValue && value.arrayValue.values) || []).map(decodeFirestoreValue);
  }
  if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue;
  return null;
}

/** Decodes a Firestore `fields` map (as returned by `runQuery`'s
 * `document.fields`) into a plain object. */
export function decodeFirestoreFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    out[key] = decodeFirestoreValue(value);
  }
  return out;
}
