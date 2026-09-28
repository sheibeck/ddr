// test/unit/report-sheet.test.js
//
// Phase 79.3 (BUG-01/02; D-06, D-09, D-10, D-15) — the REPORT A BUG sheet's
// whole behaviour, tested as a pure module before src/browser/reportSheet.js
// exists (TDD RED). Covers BUG_REPORT_COPY's exact house-voice strings, the
// reportSheetNext reducer's total state machine and reportSheetView's view
// model, plus a purity scan mirroring test/unit/final-sheet.test.js's own
// pattern (lines 283-310).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { TEXT_MAX_CHARS, REPORT_REASONS } from "../../src/browser/bugReport.js";
import {
  BUG_REPORT_COPY,
  REPORT_SHEET_INITIAL,
  REPORT_SHEET_PHASES,
  REPORT_SENT_HOLD_MS,
  REPORT_COUNTER_FROM,
  reportSheetNext,
  reportSheetView,
} from "../../src/browser/reportSheet.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { BANNED as SAFETY_BANNED, ALLOWLIST as SAFETY_ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "reportSheet.js"), "utf8").replace(/\r\n/g, "\n");

/** vmStrings(obj) — every string leaf of a plain object/array tree. */
function vmStrings(obj, out = []) {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => vmStrings(v, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((v) => vmStrings(v, out));
  return out;
}

// ─── (A) BUG_REPORT_COPY: exact strings, frozen, D-06 ordering ─────────────

test("(A1) BUG_REPORT_COPY: frozen, failed frozen, exactly the twelve leaf strings", () => {
  assert.ok(Object.isFrozen(BUG_REPORT_COPY));
  assert.ok(Object.isFrozen(BUG_REPORT_COPY.failed));
  assert.equal(BUG_REPORT_COPY.title, "REPORT A BUG");
  assert.equal(
    BUG_REPORT_COPY.notice,
    "Your report and this run's Oracle will be posted publicly on GitHub. Leave out anything private. The dungeon keeps no secrets, and neither does this form.",
  );
  assert.equal(BUG_REPORT_COPY.placeholder, "What happened, and what did you expect instead?");
  assert.equal(BUG_REPORT_COPY.counter, "{left} characters left");
  assert.equal(BUG_REPORT_COPY.send, "SEND");
  assert.equal(BUG_REPORT_COPY.cancel, "CANCEL");
  assert.equal(BUG_REPORT_COPY.sending, "Sending your report…");
  assert.equal(BUG_REPORT_COPY.sent, "Report sent. Thank you: a real person will read it, which is more than the monsters ever did.");
  assert.equal(
    BUG_REPORT_COPY.failed.offline,
    "Could not reach the server, so nothing was sent. Your report is still here; send it again when you have signal. Dungeons are not known for their reception.",
  );
  assert.equal(
    BUG_REPORT_COPY.failed.refused,
    "The server turned this report away, so nothing was sent. Your report is still here; try again, and shorten it if it keeps refusing.",
  );
  assert.equal(
    BUG_REPORT_COPY.failed.server,
    "The server is having a bad day, so nothing was sent. Your report is still here; try again in a little while.",
  );
  assert.equal(
    BUG_REPORT_COPY.failed.unavailable,
    "Bug reports are not switched on in this build, so nothing was sent. Your report is still here, waiting patiently like a mimic.",
  );
});

test("(A2) the failed keys equal REPORT_REASONS (as a set); the notice states the public-GitHub fact first, then names private (D-06)", () => {
  assert.deepStrictEqual(Object.keys(BUG_REPORT_COPY.failed).slice().sort(), [...REPORT_REASONS].sort());
  const sentences = BUG_REPORT_COPY.notice.split(". ");
  assert.match(sentences[0], /posted publicly on GitHub/);
  assert.match(sentences[1], /private/);
});

test("(A3) no BANNED safety-wordlist term (after ALLOWLIST) and no standalone wp/WP in any leaf", () => {
  const leaves = vmStrings(BUG_REPORT_COPY);
  const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;
  const escaped = SAFETY_BANNED.filter((w) => !SAFETY_ALLOWLIST.includes(w)).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const bannedRe = new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
  for (const leaf of leaves) {
    assert.doesNotMatch(leaf, PLAYER_WP, leaf);
    assert.doesNotMatch(leaf, bannedRe, leaf);
  }
});

// ─── (B) REPORT_SHEET_INITIAL / REPORT_SHEET_PHASES / holds ────────────────

test("(B1) REPORT_SHEET_INITIAL and REPORT_SHEET_PHASES are frozen and exact", () => {
  assert.ok(Object.isFrozen(REPORT_SHEET_INITIAL));
  assert.deepStrictEqual(REPORT_SHEET_INITIAL, { phase: "idle", draft: "", reason: null });
  assert.ok(Object.isFrozen(REPORT_SHEET_PHASES));
  assert.deepStrictEqual(REPORT_SHEET_PHASES, ["idle", "sending", "sent", "failed"]);
  assert.equal(REPORT_SENT_HOLD_MS, 2400);
  assert.equal(REPORT_COUNTER_FROM, 1800);
});

// ─── (C) reportSheetNext: total, frozen, never throws ──────────────────────

test("(C1) a missing, hostile or non-object model is treated as the initial model", () => {
  for (const bad of [undefined, null, 42, "x", [], { phase: "bogus" }, { phase: "idle", draft: 5 }]) {
    let out;
    assert.doesNotThrow(() => {
      out = reportSheetNext(bad, { type: "open" });
    });
    assert.ok(Object.isFrozen(out));
    assert.deepStrictEqual(out, REPORT_SHEET_INITIAL);
  }
});

test("(C2) open: sent -> idle with draft cleared; failed -> idle with the draft kept; sending and idle are unchanged", () => {
  assert.deepStrictEqual(reportSheetNext({ phase: "sent", draft: "", reason: null }, { type: "open" }), { phase: "idle", draft: "", reason: null });
  assert.deepStrictEqual(reportSheetNext({ phase: "failed", draft: "abc", reason: "offline" }, { type: "open" }), {
    phase: "idle",
    draft: "abc",
    reason: null,
  });
  assert.deepStrictEqual(reportSheetNext({ phase: "sending", draft: "abc", reason: null }, { type: "open" }), {
    phase: "sending",
    draft: "abc",
    reason: null,
  });
  assert.deepStrictEqual(reportSheetNext({ phase: "idle", draft: "abc", reason: null }, { type: "open" }), {
    phase: "idle",
    draft: "abc",
    reason: null,
  });
});

test("(C3) input: only applies in idle or failed; draft is clamped to TEXT_MAX_CHARS; phase becomes idle and reason clears", () => {
  const long = "y".repeat(TEXT_MAX_CHARS + 50);
  const out = reportSheetNext({ phase: "idle", draft: "", reason: null }, { type: "input", text: long });
  assert.equal(out.phase, "idle");
  assert.equal(out.reason, null);
  assert.equal(out.draft.length, TEXT_MAX_CHARS);
  const fromFailed = reportSheetNext({ phase: "failed", draft: "old", reason: "server" }, { type: "input", text: "new" });
  assert.deepStrictEqual(fromFailed, { phase: "idle", draft: "new", reason: null });
  for (const phase of ["sending", "sent"]) {
    const before = { phase, draft: "keep", reason: null };
    assert.deepStrictEqual(reportSheetNext(before, { type: "input", text: "ignored" }), before);
  }
});

test("(C4) send: only from idle or failed with a non-blank draft; otherwise unchanged", () => {
  assert.deepStrictEqual(reportSheetNext({ phase: "idle", draft: "x", reason: null }, { type: "send" }), { phase: "sending", draft: "x", reason: null });
  assert.deepStrictEqual(reportSheetNext({ phase: "failed", draft: "x", reason: "offline" }, { type: "send" }), {
    phase: "sending",
    draft: "x",
    reason: null,
  });
  const blank = { phase: "idle", draft: "   ", reason: null };
  assert.deepStrictEqual(reportSheetNext(blank, { type: "send" }), blank);
  const sending = { phase: "sending", draft: "x", reason: null };
  assert.deepStrictEqual(reportSheetNext(sending, { type: "send" }), sending);
  const sent = { phase: "sent", draft: "", reason: null };
  assert.deepStrictEqual(reportSheetNext(sent, { type: "send" }), sent);
});

test("(C5) result: only applies while sending; ok true clears the draft; otherwise keeps the draft with a validated reason (unknown falls back to offline)", () => {
  const sending = { phase: "sending", draft: "abc", reason: null };
  assert.deepStrictEqual(reportSheetNext(sending, { type: "result", ok: true }), { phase: "sent", draft: "", reason: null });
  assert.deepStrictEqual(reportSheetNext(sending, { type: "result", ok: false, reason: "server" }), { phase: "failed", draft: "abc", reason: "server" });
  assert.deepStrictEqual(reportSheetNext(sending, { type: "result", ok: false, reason: "bogus" }), { phase: "failed", draft: "abc", reason: "offline" });
  assert.deepStrictEqual(reportSheetNext(sending, { type: "result", ok: false }), { phase: "failed", draft: "abc", reason: "offline" });
  const idle = { phase: "idle", draft: "abc", reason: null };
  assert.deepStrictEqual(reportSheetNext(idle, { type: "result", ok: true }), idle);
});

test("(C6) close: sending is unchanged; sent -> idle with draft cleared; failed -> idle with the draft kept; idle -> idle", () => {
  const sending = { phase: "sending", draft: "abc", reason: null };
  assert.deepStrictEqual(reportSheetNext(sending, { type: "close" }), sending);
  assert.deepStrictEqual(reportSheetNext({ phase: "sent", draft: "", reason: null }, { type: "close" }), { phase: "idle", draft: "", reason: null });
  assert.deepStrictEqual(reportSheetNext({ phase: "failed", draft: "abc", reason: "server" }, { type: "close" }), {
    phase: "idle",
    draft: "abc",
    reason: null,
  });
  assert.deepStrictEqual(reportSheetNext({ phase: "idle", draft: "abc", reason: null }, { type: "close" }), { phase: "idle", draft: "abc", reason: null });
});

test("(C7) an unknown event type returns an equal model; the return is always frozen", () => {
  const m = { phase: "idle", draft: "abc", reason: null };
  const out = reportSheetNext(m, { type: "bogus" });
  assert.deepStrictEqual(out, m);
  assert.ok(Object.isFrozen(out));
  assert.doesNotThrow(() => reportSheetNext(m, null));
  assert.doesNotThrow(() => reportSheetNext(m, undefined));
  assert.doesNotThrow(() => reportSheetNext(m, "bogus"));
});

test("(C8) draft survival: input 'abc', then close, then open gives idle with the draft kept", () => {
  let m = REPORT_SHEET_INITIAL;
  m = reportSheetNext(m, { type: "input", text: "abc" });
  m = reportSheetNext(m, { type: "close" });
  m = reportSheetNext(m, { type: "open" });
  assert.deepStrictEqual(m, { phase: "idle", draft: "abc", reason: null });
});

// ─── (D) reportSheetView ────────────────────────────────────────────────────

test("(D1) idle with a blank draft: SEND disabled, CANCEL enabled, not locked, no status", () => {
  const vm = reportSheetView({ phase: "idle", draft: "   ", reason: null });
  assert.equal(vm.sendEnabled, false);
  assert.equal(vm.cancelEnabled, true);
  assert.equal(vm.locked, false);
  assert.equal(vm.status, "");
  assert.equal(vm.tone, "");
  assert.equal(vm.title, BUG_REPORT_COPY.title);
  assert.equal(vm.notice, BUG_REPORT_COPY.notice);
  assert.equal(vm.placeholder, BUG_REPORT_COPY.placeholder);
  assert.equal(vm.sendLabel, BUG_REPORT_COPY.send);
  assert.equal(vm.cancelLabel, BUG_REPORT_COPY.cancel);
  assert.ok(Object.isFrozen(vm));
});

test("(D2) idle with 'x': SEND enabled", () => {
  const vm = reportSheetView({ phase: "idle", draft: "x", reason: null });
  assert.equal(vm.sendEnabled, true);
});

test("(D3) sending: locked, SEND and CANCEL disabled, the sending status and busy tone", () => {
  const vm = reportSheetView({ phase: "sending", draft: "x", reason: null });
  assert.equal(vm.locked, true);
  assert.equal(vm.sendEnabled, false);
  assert.equal(vm.cancelEnabled, false);
  assert.equal(vm.status, BUG_REPORT_COPY.sending);
  assert.equal(vm.tone, "busy");
});

test("(D4) sent: locked, SEND disabled, CANCEL enabled, the sent status and ok tone", () => {
  const vm = reportSheetView({ phase: "sent", draft: "", reason: null });
  assert.equal(vm.locked, true);
  assert.equal(vm.sendEnabled, false);
  assert.equal(vm.cancelEnabled, true);
  assert.equal(vm.status, BUG_REPORT_COPY.sent);
  assert.equal(vm.tone, "ok");
});

test("(D5) failed offline with a draft: not locked, SEND enabled, the offline status and warn tone", () => {
  const vm = reportSheetView({ phase: "failed", draft: "x", reason: "offline" });
  assert.equal(vm.locked, false);
  assert.equal(vm.sendEnabled, true);
  assert.equal(vm.status, BUG_REPORT_COPY.failed.offline);
  assert.equal(vm.tone, "warn");
});

test("(D6) every REPORT_REASONS failed status is reachable, and a hostile/unknown reason falls back to offline", () => {
  for (const reason of REPORT_REASONS) {
    const vm = reportSheetView({ phase: "failed", draft: "x", reason });
    assert.equal(vm.status, BUG_REPORT_COPY.failed[reason]);
  }
  const vm = reportSheetView({ phase: "failed", draft: "x", reason: "bogus" });
  assert.equal(vm.status, BUG_REPORT_COPY.failed.offline);
});

test("(D7) counterText is null below REPORT_COUNTER_FROM chars, and reads '200 characters left' at 1800 chars", () => {
  const under = reportSheetView({ phase: "idle", draft: "x".repeat(REPORT_COUNTER_FROM - 1), reason: null });
  assert.equal(under.counterText, null);
  const at = reportSheetView({ phase: "idle", draft: "x".repeat(REPORT_COUNTER_FROM), reason: null });
  assert.equal(at.counterText, "200 characters left");
  const atMax = reportSheetView({ phase: "idle", draft: "x".repeat(TEXT_MAX_CHARS), reason: null });
  assert.equal(atMax.counterText, "0 characters left");
});

test("(D8) reportSheetView is total: never throws on a hostile model", () => {
  for (const bad of [undefined, null, 42, "x", [], {}]) {
    assert.doesNotThrow(() => reportSheetView(bad));
  }
});

// ─── (E) purity ──────────────────────────────────────────────────────────

test("(E) purity: no window/document/navigator/localStorage/setTimeout/globalThis identifier and no global fetch call", () => {
  const code = stripJs(MODULE_SRC);
  for (const banned of [/\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsetTimeout\b/, /\bglobalThis\b/, /(?<![.\w])fetch\(/]) {
    assert.doesNotMatch(code, banned, `reportSheet.js must not use ${banned}`);
  }
});
