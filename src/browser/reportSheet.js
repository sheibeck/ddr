// src/browser/reportSheet.js
//
// Phase 79.3 (BUG-01/02; D-06, D-09, D-10, D-15). The REPORT A BUG sheet's
// whole copy bank, reducer and view model — pure. The shell
// (mazeworld.html's module script, 79.3-05) owns the DOM, the
// REPORT_SENT_HOLD_MS timer and the send call (through bugReport.js's
// buildReportPayload/sendBugReport); this module never reads window,
// document, navigator or storage, and never calls fetch. Every string below
// is the house voice: the plain fact first, then the joke — D-06's public
// notice states the fact alone, with the joke saved for after it, and every
// other line states what happened before it lands the line.

import { TEXT_MAX_CHARS, REPORT_REASONS } from "./bugReport.js";

/** REPORT_SENT_HOLD_MS — how long the sent thank-you holds before the shell auto-closes the sheet. */
export const REPORT_SENT_HOLD_MS = 2400;

/** REPORT_COUNTER_FROM — the draft length at which the near-limit counter starts showing. */
export const REPORT_COUNTER_FROM = 1800;

/**
 * BUG_REPORT_COPY — every word the sheet says, frozen (failed frozen too).
 * D-06: the notice's first two sentences are plain fact (posted publicly on
 * GitHub, leave out anything private); its last sentence is the joke. The
 * four failed.* lines each state what happened, that the draft is kept, then
 * the joke; failed's keys are exactly REPORT_REASONS.
 */
export const BUG_REPORT_COPY = Object.freeze({
  title: "REPORT A BUG",
  notice:
    "Your report and this run's Oracle will be posted publicly on GitHub. Leave out anything private. The dungeon keeps no secrets, and neither does this form.",
  placeholder: "What happened, and what did you expect instead?",
  counter: "{left} characters left",
  send: "SEND",
  cancel: "CANCEL",
  sending: "Sending your report…",
  sent: "Report sent. Thank you: a real person will read it, which is more than the monsters ever did.",
  failed: Object.freeze({
    offline:
      "Could not reach the server, so nothing was sent. Your report is still here; send it again when you have signal. Dungeons are not known for their reception.",
    refused: "The server turned this report away, so nothing was sent. Your report is still here; try again, and shorten it if it keeps refusing.",
    server: "The server is having a bad day, so nothing was sent. Your report is still here; try again in a little while.",
    unavailable: "Bug reports are not switched on in this build, so nothing was sent. Your report is still here, waiting patiently like a mimic.",
  }),
});

/** REPORT_SHEET_PHASES — the sheet's four states, in their natural order. */
export const REPORT_SHEET_PHASES = Object.freeze(["idle", "sending", "sent", "failed"]);

/** REPORT_SHEET_INITIAL — the sheet's model at rest: idle, no draft, no reason. */
export const REPORT_SHEET_INITIAL = Object.freeze({ phase: "idle", draft: "", reason: null });

const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;

/** clampChars(s, max) — the same surrogate-safe clamp bugReport.js#clampChars uses, kept local so this module has no non-copy export. */
function clampChars(s, max) {
  if (s.length <= max) return s;
  let sliced = s.slice(0, max);
  const last = sliced.charCodeAt(sliced.length - 1);
  if (last >= HIGH_SURROGATE_MIN && last <= HIGH_SURROGATE_MAX) sliced = sliced.slice(0, -1);
  return sliced;
}

/** baseModel(model) — a well-formed { phase, draft, reason }, or REPORT_SHEET_INITIAL for anything hostile, missing or malformed. */
function baseModel(model) {
  if (model && typeof model === "object" && !Array.isArray(model) && REPORT_SHEET_PHASES.includes(model.phase) && typeof model.draft === "string") {
    const reason = typeof model.reason === "string" || model.reason === null ? model.reason : null;
    return { phase: model.phase, draft: model.draft, reason };
  }
  return REPORT_SHEET_INITIAL;
}

const IDLE_OR_FAILED = new Set(["idle", "failed"]);

/**
 * reportSheetNext(model, event) -> frozen { phase, draft, reason }
 *
 * Total: a missing, hostile or non-object model reads as REPORT_SHEET_INITIAL;
 * an unrecognised event.type returns an equal model; never throws.
 *
 *   - "open": sent -> idle, draft cleared; failed -> idle, draft kept;
 *     sending and idle are unchanged.
 *   - "input" { text }: only in idle or failed — draft becomes
 *     String(text) clamped to TEXT_MAX_CHARS, phase idle, reason null;
 *     sending/sent are unchanged.
 *   - "send": only from idle or failed with a non-blank draft — phase
 *     becomes sending, reason null; otherwise unchanged.
 *   - "result" { ok, reason }: only while sending — ok === true clears the
 *     draft into "sent"; otherwise "failed" with the draft kept and reason
 *     validated against REPORT_REASONS (an unknown/missing reason falls back
 *     to "offline"); any other phase is unchanged.
 *   - "close": sending is unchanged; sent -> idle, draft cleared; failed ->
 *     idle, draft kept; idle -> idle.
 */
export function reportSheetNext(model, event) {
  const m = baseModel(model);
  const type = event && typeof event === "object" ? event.type : undefined;
  try {
    switch (type) {
      case "open": {
        if (m.phase === "sent") return Object.freeze({ phase: "idle", draft: "", reason: null });
        if (m.phase === "failed") return Object.freeze({ phase: "idle", draft: m.draft, reason: null });
        return Object.freeze({ ...m });
      }
      case "input": {
        if (!IDLE_OR_FAILED.has(m.phase)) return Object.freeze({ ...m });
        const draft = clampChars(String(event.text), TEXT_MAX_CHARS);
        return Object.freeze({ phase: "idle", draft, reason: null });
      }
      case "send": {
        if (IDLE_OR_FAILED.has(m.phase) && m.draft.trim() !== "") return Object.freeze({ phase: "sending", draft: m.draft, reason: null });
        return Object.freeze({ ...m });
      }
      case "result": {
        if (m.phase !== "sending") return Object.freeze({ ...m });
        if (event.ok === true) return Object.freeze({ phase: "sent", draft: "", reason: null });
        const reason = REPORT_REASONS.includes(event.reason) ? event.reason : "offline";
        return Object.freeze({ phase: "failed", draft: m.draft, reason });
      }
      case "close": {
        if (m.phase === "sending") return Object.freeze({ ...m });
        if (m.phase === "sent") return Object.freeze({ phase: "idle", draft: "", reason: null });
        if (m.phase === "failed") return Object.freeze({ phase: "idle", draft: m.draft, reason: null });
        return Object.freeze({ ...m });
      }
      default:
        return Object.freeze({ ...m });
    }
  } catch {
    return Object.freeze({ ...REPORT_SHEET_INITIAL });
  }
}

/** counterTextFor(draft) — null below REPORT_COUNTER_FROM chars, else BUG_REPORT_COPY.counter with {left} filled in (never below 0). */
function counterTextFor(draft) {
  if (draft.length < REPORT_COUNTER_FROM) return null;
  const left = Math.max(0, TEXT_MAX_CHARS - draft.length);
  return BUG_REPORT_COPY.counter.replace("{left}", String(left));
}

/**
 * reportSheetView(model) -> frozen view model
 *
 * { title, notice, placeholder, sendLabel, cancelLabel, sendEnabled,
 *   cancelEnabled, locked, counterText, status, tone }. locked and
 * cancelEnabled/sendEnabled follow the phase; status/tone are "" outside
 * sending/sent/failed. A hostile model reads as REPORT_SHEET_INITIAL (never
 * throws).
 */
export function reportSheetView(model) {
  const m = baseModel(model);
  const trimmed = m.draft.trim();
  const locked = m.phase === "sending" || m.phase === "sent";
  const cancelEnabled = m.phase !== "sending";
  const sendEnabled = IDLE_OR_FAILED.has(m.phase) && trimmed !== "";
  let status = "";
  let tone = "";
  if (m.phase === "sending") {
    status = BUG_REPORT_COPY.sending;
    tone = "busy";
  } else if (m.phase === "sent") {
    status = BUG_REPORT_COPY.sent;
    tone = "ok";
  } else if (m.phase === "failed") {
    const reason = REPORT_REASONS.includes(m.reason) ? m.reason : "offline";
    status = BUG_REPORT_COPY.failed[reason];
    tone = "warn";
  }
  return Object.freeze({
    title: BUG_REPORT_COPY.title,
    notice: BUG_REPORT_COPY.notice,
    placeholder: BUG_REPORT_COPY.placeholder,
    sendLabel: BUG_REPORT_COPY.send,
    cancelLabel: BUG_REPORT_COPY.cancel,
    sendEnabled,
    cancelEnabled,
    locked,
    counterText: counterTextFor(m.draft),
    status,
    tone,
  });
}
