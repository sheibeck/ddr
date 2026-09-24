// src/browser/fightLog.js
//
// Phase 34 (CSCR-04) — the whole-fight, newest-first, tap-to-reveal fight
// log (it replaced the Phase 32 Round Card).
//
// Decision 1 (34-01-PLAN.md objective, RESEARCH Open Question 1): the
// fight log's lines are sourced from `linesForAction(type, events, ctx,
// { limit: Infinity, withIdx: true })` — the SAME folded/deduped pipeline —
// rather than from raw `formatEvents()` output.
// 34-CONTEXT.md pins "log line count = folded count" (the worst-case
// fight-log round test pins line count = folded count), so the
// folding/dedup pipeline must stay the ONE source; sourcing lines from raw
// per-event HTML would yield one
// line per narrated event and break both that pin and the 400-seed fold
// proof. A folded multi-event entry reveals the dice of its FIRST
// constituent event (`events[idx]`, via `narrateEvent`/`oracleDetailText`)
// — the Oracle stays the complete per-swing log (CSCR-04: "the Oracle
// stays the complete log").
//
// PRESENTATION ONLY, pure module: no DOM/global access, no timers, no
// storage anywhere in this file. Every export is a plain function
// returning plain data — the shell's own presentation-only global bridge
// (mazeworld.html) is where the caller stores this module's output; this
// module never touches `S`/`state`.

import { linesForAction, PRIORITY, narrativeLineText, oracleDetailText } from "./narrationLines.js";
import { narrateEvent } from "./eventNarration.js";

/** FIGHT_LOG_TONES — the two tones a fight-log entry carries. */
export const FIGHT_LOG_TONES = Object.freeze(["narrative", "dull"]);

/**
 * fightLogLinesFor(type, events, ctx = {}) — one fight-log line per folded
 * linesForAction entry (uncapped, per the Decision 1 fold-preserving
 * source). Each line is `{ text, tone, roll }`:
 *   - text: the folded line's own text (narrativeLineText-normalized —
 *     already roll-free from LINE_FOR/ctx.narrate, this is a defensive
 *     pass so the fight log never renders a stray tag).
 *   - tone: "dull" when the entry's priority is PRIORITY.block (a
 *     refusal/rejection), else "narrative".
 *   - roll: the folded entry's FIRST constituent event's Oracle sentence
 *     (dice kept), via `oracleDetailText(narrateEvent(events[idx]))`, or
 *     null when that event has no roll span to reveal.
 */
export function fightLogLinesFor(type, events, ctx = {}) {
  const lines = linesForAction(type, events, ctx, { limit: Infinity, withIdx: true });
  return lines.map((t) => ({
    text: narrativeLineText(t.text) || t.text,
    tone: t.priority === PRIORITY.block ? "dull" : "narrative",
    roll: oracleDetailText(narrateEvent(events[t.idx])) || null,
  }));
}

/** emptyFightLog() — the fight log's zero state. */
export function emptyFightLog() {
  return { seq: 0, nextId: 1, entries: [] };
}

/**
 * dullFightLogLine(text) — a manually-built dull entry (no fold pipeline
 * involved), for shell call sites that need to inject a single dull line
 * directly (mirrors the shape fightLogLinesFor produces).
 */
export function dullFightLogLine(text) {
  return { text: String(text ?? ""), tone: "dull", roll: null };
}

/**
 * appendFightLog(log, lines, round) — appends `lines` (fightLogLinesFor's
 * output, or dullFightLogLine's) to `log` as a new batch, returning a NEW
 * log object (never mutates `log`). A null/undefined `log` is treated as
 * `emptyFightLog()`. Each appended entry gets a strictly-increasing `id`,
 * the batch's `seq` (log.seq + 1), the given `round`, and `show: false`.
 */
export function appendFightLog(log, lines, round) {
  const base = log || emptyFightLog();
  const seq = base.seq + 1;
  const entries = lines.map((l, k) => ({
    id: base.nextId + k,
    seq,
    text: l.text,
    tone: l.tone,
    roll: l.roll ?? null,
    round: round ?? null,
    show: false,
  }));
  return {
    seq,
    nextId: base.nextId + lines.length,
    entries: [...base.entries, ...entries],
  };
}

/** fightLogRows(log) — entries newest-first (last appended first); [] for a null log. Never mutates. */
export function fightLogRows(log) {
  if (!log || !Array.isArray(log.entries)) return [];
  return [...log.entries].reverse();
}

/**
 * toggleFightLogEntry(log, id) — flips the `show` flag of the entry whose
 * `id` matches; returns a NEW log object (seq unchanged). When no entry
 * matches, returns the input log unchanged (same reference).
 */
export function toggleFightLogEntry(log, id) {
  if (!log || !Array.isArray(log.entries)) return log;
  if (!log.entries.some((e) => e.id === id)) return log;
  return {
    ...log,
    entries: log.entries.map((e) => (e.id === id ? { ...e, show: !e.show } : e)),
  };
}

/**
 * ROUND_STRIP_COPY — Phase 71 (D-07): the what-happened strip's own copy,
 * from the user's combat v2 mock. `{n}` is filled by the shell (the round
 * number, the log's entry count). The shell never declares these literals.
 */
export const ROUND_STRIP_COPY = Object.freeze({
  roundHappened: "ROUND {n} · WHAT HAPPENED",
  resolving: "RESOLVING",
  fullLog: "FULL LOG · {n} ›",
});

/** ROUND_STRIP_MAX_LINES — the mock's "last 3 lines of the latest round". */
const ROUND_STRIP_MAX_LINES = 3;

/**
 * roundSummary(log, beatView = null) — Phase 71 (D-07): the content of the
 * "ROUND n · WHAT HAPPENED" strip fixed above the combat actions (the
 * user's combat v2 mock: the last 3 lines of the latest round).
 *
 * Returns a frozen `{ round, lines, newestId, total }`:
 *   - round: the newest entry's `round` (the round playing or just played),
 *     or null.
 *   - lines: at most the LAST 3 entries of that round, oldest -> newest,
 *     each `{ id, text, tone, newest }`. Text is kept whole (the strip
 *     never cuts a line mid-text); exactly one line is `newest`.
 *   - newestId: that newest line's id, or null.
 *   - total: the whole log's entry count (the FULL LOG chip).
 *
 * R-21 ("latest round"): the entries whose `round` equals the newest
 * entry's round, read back from the end while it matches, so a refusal
 * appended in the same round joins it. When the newest round is null the
 * newest batch (its `seq`) stands in.
 *
 * Order: the fight log's own fold order (append order), deliberately the
 * same order the full-log sheet shows, so the two never disagree (backlog
 * 999.5 note (3): if the fold moves to event order, both follow).
 *
 * No spoilers: with a `beatView` (a live beat's `{ log, maxId }`), the
 * source is `beatView.log` and only entries with `id <= maxId` show, so a
 * playing round shows only the lines the beat has already revealed. The
 * round itself is read from the whole log, so a beat that has revealed
 * nothing of its round shows no lines, never the round before. `total`
 * counts the whole log (a count is not a spoiler).
 *
 * Null, empty or malformed input gives no lines and never throws. Pure:
 * never mutates `log`.
 */
export function roundSummary(log, beatView = null) {
  const bv = beatView && typeof beatView === "object" ? beatView : null;
  const src = bv && bv.log ? bv.log : log;
  const raw = src && typeof src === "object" && Array.isArray(src.entries) ? src.entries : [];
  const entries = raw.filter((e) => e && typeof e === "object");
  const total = entries.length;
  if (!entries.length) return Object.freeze({ round: null, lines: Object.freeze([]), newestId: null, total });
  const last = entries[entries.length - 1];
  const round = last.round ?? null;
  const same = round == null ? (e) => e.seq === last.seq && (e.round ?? null) === null : (e) => e.round === round;
  const inRound = [];
  for (let i = entries.length - 1; i >= 0 && same(entries[i]); i--) inRound.unshift(entries[i]);
  const maxId = bv && Number.isFinite(bv.maxId) ? bv.maxId : Infinity;
  const shown = inRound.filter((e) => !(e.id > maxId)).slice(-ROUND_STRIP_MAX_LINES);
  const newestId = shown.length ? shown[shown.length - 1].id ?? null : null;
  const lines = shown.map((e, k) =>
    Object.freeze({
      id: e.id ?? null,
      text: String(e.text ?? ""),
      tone: e.tone === "dull" ? "dull" : "narrative",
      newest: k === shown.length - 1,
    })
  );
  return Object.freeze({ round, lines: Object.freeze(lines), newestId, total });
}

/**
 * fightLogAnnouncement(log, announcedSeq) — the aria-live announcer's next
 * text: every entry whose `seq` is greater than `announcedSeq`, joined by
 * a single space in append order. Returns `{ seq: log.seq, text }`; for a
 * null/empty log (or when nothing is newer than `announcedSeq`), `text` is
 * "" and `seq` is `log.seq` (0 for a null log).
 */
export function fightLogAnnouncement(log, announcedSeq) {
  if (!log || !Array.isArray(log.entries)) return { seq: 0, text: "" };
  const text = log.entries
    .filter((e) => e.seq > announcedSeq)
    .map((e) => e.text)
    .join(" ");
  return { seq: log.seq, text };
}
