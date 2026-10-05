// src/browser/achievementsSheet.js
//
// Phase 100 (AUI-02, AUI-03): the pure core of the hamburger menu's
// ACHIEVEMENTS list. A copy bank, the block and track structure, date and
// progress formatting, the counts, the view model that turns a lifetime
// record into rows, and a DOM renderer that reads correctly under TalkBack.
// No window, no storage, no clock, no timers: plan 100-03 mounts it.
//
// Rulings from Phase 100 CONTEXT ("The achievements list") implemented here:
//   - one row per TRACK, grouped under the seven catalog blocks (The descent,
//     Dressing for it, Who you are, Staying alive, Company, Body counts,
//     Dying). A tiered track shows the icon of the highest tier earned (tier I
//     greyed when none), an I to IV ladder and the next rung's progress such
//     as "37 / 50 kills"; the depth ladder and Unicorn! read as ONE track of
//     four rungs (TRACK_JOINS);
//   - locked rows are greyed and show the Play description plus progress where
//     the entry has some (incremental entries only, via progressFor in
//     achievementTracker.js); unlocked rows show the sarcastic line and the
//     date earned;
//   - the single-run tracks (depth, days, wilmst held) read as the best run so
//     far ("best: floor 7 / 10"), the same value Play's set-steps will show;
//   - a Hidden entry is a "Secret" row (teaser line, its own icon as a
//     silhouette) until it is unlocked or revealed, and the header counts the
//     secrets still undiscovered. A secret row exposes nothing of the real
//     achievement: row keys are opaque "t{listOrder}" strings, never ids;
//   - no fact rides on colour, a greyed icon or a glyph alone: the same fact
//     is always in the row's text, and the icons are decorative.
//
// 35 rows, not 36: CONTEXT says 36 rows but also says "the depth ladder and
// Unicorn! read as one track of four rungs". The catalog derives 35 tracks
// (13 four-tier tracks, the depth-and-Unicorn! track and 21 single
// achievements), and the structural rule wins. The row count is computed from
// the catalog and never hard-coded.
//
// Read-only: the view model and the renderer never write, reset, re-lock,
// back-fill or repair anything in the record, and nothing here reaches storage.
// The renderer builds DOM only through host.ownerDocument with createElement,
// createTextNode, textContent and setAttribute.

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { progressFor } from "./achievementTracker.js";
import { emptyRecord, sanitizeRecord } from "./achievementRecord.js";
import { achievementIconSrc } from "./achievementCard.js";

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * ACHIEVEMENTS_SHEET_COPY — every chrome string this module owns, in one
 * nested object literal so the voice scan (test/voice/safety-scan.test.js) and
 * the voice corpus (tools/lib/voice-corpus.mjs) can walk it recursively.
 * British spelling; the player's words (wilmst, floor, Joiner, parleys).
 */
export const ACHIEVEMENTS_SHEET_COPY = deepFreeze({
  title: "ACHIEVEMENTS",
  earned: "{n} of {total} earned",
  menuCount: "{n} / {total}",
  secrets: {
    none: "No secrets left. Thorough, in a slightly worrying way.",
    one: "1 secret still hiding",
    many: "{n} secrets still hiding",
  },
  blocks: {
    descent: "The descent",
    dressing: "Dressing for it",
    who: "Who you are",
    alive: "Staying alive",
    company: "Company",
    bodies: "Body counts",
    dying: "Dying",
  },
  state: {
    earned: "Earned {date}",
    earnedNoDate: "Earned. Nobody wrote down when.",
    locked: "Locked",
    partial: "{n} of {total} tiers earned",
    complete: "All {total} tiers earned",
  },
  secret: {
    name: "Secret",
    line: "Some achievements are shy. This one will introduce itself when it is good and ready.",
  },
  tier: {
    label: "Tier {tier}",
    next: "Next: tier {tier}",
  },
  progress: {
    count: "{value} / {steps} {unit}",
    bestFloor: "best: floor {value} / {steps}",
    best: "best: {value} / {steps} {unit}",
  },
  units: {
    kills: "kills",
    deaths: "deaths",
    joinersAccepted: "Joiners",
    joinersFallen: "Joiners fallen",
    parleysWon: "parleys won",
    trapsSurvived: "traps survived",
    days: "days",
    wilmstHeld: "wilmst held",
    subClasses: "sub-classes",
  },
  expand: "Tap for every tier",
  collapse: "Tap to fold it away",
});

/** The tier numerals of a ladder. Not copy: they are labels, not sentences. */
export const TIER_NUMERALS = Object.freeze(["I", "II", "III", "IV"]);

// Month abbreviations for formatEarnedDate. Not copy: they are not sentences.
const MONTHS = Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);

/**
 * ACHIEVEMENT_BLOCKS — the seven Phase 98 list blocks, by catalog listOrder
 * range. `id` is also the key into the bank's `blocks`.
 */
export const ACHIEVEMENT_BLOCKS = Object.freeze(
  [
    { id: "descent", firstOrder: 10, lastOrder: 60 },
    { id: "dressing", firstOrder: 70, lastOrder: 100 },
    { id: "who", firstOrder: 110, lastOrder: 200 },
    { id: "alive", firstOrder: 210, lastOrder: 340 },
    { id: "company", firstOrder: 350, lastOrder: 470 },
    { id: "bodies", firstOrder: 480, lastOrder: 710 },
    { id: "dying", firstOrder: 720, lastOrder: 770 },
  ].map((b) => Object.freeze(b)),
);

/** TRACK_JOINS — a single entry that joins another track as its last rung. */
export const TRACK_JOINS = Object.freeze({ unicorn: "depth" });

function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole));
}

function byListOrder(a, b) {
  return a.listOrder - b.listOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * tracksOf(catalog) — the catalog grouped into tracks, sorted by the first
 * entry's listOrder. A tiered entry (tier 1 to 4) belongs to the track named
 * by its id without the _t{tier} suffix; an id in TRACK_JOINS joins the named
 * track as its last rung; every other entry is a one-entry track keyed by its
 * own id. Entries run in tier order, the joined rung last. The catalog's own
 * entries are never altered.
 */
export function tracksOf(catalog = ACHIEVEMENTS) {
  const sorted = [...(Array.isArray(catalog) ? catalog : [])].sort(byListOrder);
  const map = new Map();
  const joins = [];
  for (const entry of sorted) {
    if (Object.prototype.hasOwnProperty.call(TRACK_JOINS, entry.id)) {
      joins.push(entry);
      continue;
    }
    const tiered = Number.isInteger(entry.tier) && entry.tier >= 1 && entry.tier <= 4;
    const key = tiered ? entry.id.replace(new RegExp(`_t${entry.tier}$`), "") : entry.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  for (const entry of joins) {
    const key = TRACK_JOINS[entry.id];
    if (map.has(key)) map.get(key).push(entry);
    else map.set(entry.id, [entry]);
  }
  const tracks = [...map].map(([key, entries]) => Object.freeze({ key, entries: Object.freeze(entries) }));
  tracks.sort((a, b) => a.entries[0].listOrder - b.entries[0].listOrder);
  return Object.freeze(tracks);
}

/**
 * formatEarnedDate(at, tzOffsetMinutes) — "D Mon YYYY" for an unlock time, or
 * null for a non-finite, zero or negative time. tzOffsetMinutes is what
 * Date.prototype.getTimezoneOffset() returns (minutes the local time is behind
 * UTC); a non-finite offset reads as 0. A pure function of its arguments.
 */
export function formatEarnedDate(at, tzOffsetMinutes) {
  if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return null;
  const offset = typeof tzOffsetMinutes === "number" && Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  const d = new Date(at - offset * 60000);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const BY_ID = new Map(ACHIEVEMENTS.map((e) => [e.id, e]));
const HIDDEN = Object.freeze(ACHIEVEMENTS.filter((e) => e.initialState === "Hidden"));
const DEFAULT_TRACKS = tracksOf(ACHIEVEMENTS);

/** Any value in, a complete record out; a throw while sanitising reads as the empty record. */
function safeRecord(record) {
  try {
    return sanitizeRecord(record);
  } catch {
    return emptyRecord();
  }
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * progressText(record, entry) — the progress reading for an incremental
 * catalog entry, or null for a standard or unknown entry. The numbers come
 * from progressFor (value clamped to the steps); the units come from the bank.
 */
export function progressText(record, entry) {
  const known = entry && typeof entry === "object" && typeof entry.id === "string" ? BY_ID.get(entry.id) : null;
  if (!known) return null;
  let p;
  try {
    p = progressFor(record, known);
  } catch {
    return null;
  }
  if (!p) return null;
  const P = ACHIEVEMENTS_SHEET_COPY.progress;
  const U = ACHIEVEMENTS_SHEET_COPY.units;
  const t = known.trigger || {};
  const values = { value: p.value, steps: p.steps };
  if (t.kind === "singleRunBest") {
    if (t.metric === "depth") return fill(P.bestFloor, values);
    const unit = t.metric === "days" ? U.days : t.metric === "wilmstHeld" ? U.wilmstHeld : null;
    return unit === null ? null : fill(P.best, { ...values, unit });
  }
  if (t.kind === "lifetimeCounter") {
    const unit = t.counter === "kills" ? U.kills : has(U, t.counter) ? U[t.counter] : null;
    return unit === null ? null : fill(P.count, { ...values, unit });
  }
  if (t.kind === "distinctSetCount") return fill(P.count, { ...values, unit: U.subClasses });
  return null;
}

/** earnedCount(record) — how many catalog ids are in record.unlocked. */
export function earnedCount(record) {
  const rec = safeRecord(record);
  return ACHIEVEMENTS.reduce((n, e) => (has(rec.unlocked, e.id) ? n + 1 : n), 0);
}

/** secretCount(record) — Hidden entries neither unlocked nor revealed. */
export function secretCount(record) {
  const rec = safeRecord(record);
  return HIDDEN.reduce((n, e) => (has(rec.unlocked, e.id) || rec.revealed.includes(e.id) ? n : n + 1), 0);
}

/** menuCountText(record) — the menu row's "12 / 77": earned over the catalog size, from the record only. */
export function menuCountText(record) {
  return fill(ACHIEVEMENTS_SHEET_COPY.menuCount, { n: earnedCount(record), total: ACHIEVEMENTS.length });
}

// ---------------------------------------------------------------------
// The view model
// ---------------------------------------------------------------------

const KEY_PREFIX = "t";

/** The row key: an opaque "t" plus the entry's listOrder. Never an id. */
function keyOf(entry) {
  return KEY_PREFIX + entry.listOrder;
}

function numeralName(name) {
  return String(name).replace(/\s+(IV|III|II|I)$/, "");
}

function earnedAt(rec, entry) {
  return has(rec.unlocked, entry.id) ? rec.unlocked[entry.id] : null;
}

/** dateText for an earned entry: the formatted date, or the "nobody wrote it down" line for a stored time of 0. */
function dateTextOf(at, tz) {
  return formatEarnedDate(at, tz) || ACHIEVEMENTS_SHEET_COPY.state.earnedNoDate;
}

function earnedStateText(at, tz) {
  const date = formatEarnedDate(at, tz);
  return date === null ? ACHIEVEMENTS_SHEET_COPY.state.earnedNoDate : fill(ACHIEVEMENTS_SHEET_COPY.state.earned, { date });
}

function isSecret(rec, entry) {
  return entry.initialState === "Hidden" && !has(rec.unlocked, entry.id) && !rec.revealed.includes(entry.id);
}

function labelOf(name, stateText, detail, progress) {
  return [name, stateText, detail, progress].filter((part) => typeof part === "string" && part.length > 0).join(". ");
}

function singleRow(rec, entry, tz) {
  const key = keyOf(entry);
  const at = earnedAt(rec, entry);
  const base = { key, kind: "single", ladder: [], rungs: [], expandable: false };
  if (at !== null) {
    const stateText = earnedStateText(at, tz);
    return {
      ...base,
      state: "earned",
      name: entry.name,
      iconSrc: achievementIconSrc(entry),
      silhouette: false,
      dim: false,
      detail: entry.line,
      dateText: dateTextOf(at, tz),
      progressText: null,
      stateText,
      label: labelOf(entry.name, stateText, entry.line, null),
    };
  }
  if (isSecret(rec, entry)) {
    const name = ACHIEVEMENTS_SHEET_COPY.secret.name;
    const detail = ACHIEVEMENTS_SHEET_COPY.secret.line;
    return {
      ...base,
      state: "secret",
      name,
      iconSrc: achievementIconSrc(entry),
      silhouette: true,
      dim: false,
      detail,
      dateText: null,
      progressText: null,
      stateText: "",
      label: labelOf(name, "", detail, null),
    };
  }
  const progress = progressText(rec, entry);
  const stateText = ACHIEVEMENTS_SHEET_COPY.state.locked;
  return {
    ...base,
    state: "locked",
    name: entry.name,
    iconSrc: achievementIconSrc(entry),
    silhouette: false,
    dim: true,
    detail: entry.description,
    dateText: null,
    progressText: progress,
    stateText,
    label: labelOf(entry.name, stateText, entry.description, progress),
  };
}

function rungOf(rec, entry, index, tz) {
  const at = earnedAt(rec, entry);
  const earned = at !== null;
  return {
    key: keyOf(entry),
    tier: TIER_NUMERALS[index] || String(index + 1),
    name: entry.name,
    state: earned ? "earned" : "locked",
    text: earned ? entry.line : entry.description,
    dateText: earned ? dateTextOf(at, tz) : null,
    progressText: earned ? null : progressText(rec, entry),
    stateText: earned ? earnedStateText(at, tz) : ACHIEVEMENTS_SHEET_COPY.state.locked,
    iconSrc: achievementIconSrc(entry),
  };
}

function trackRow(rec, track, tz) {
  const rungs = track.entries.map((entry, i) => rungOf(rec, entry, i, tz));
  const earnedIdx = rungs.map((r, i) => (r.state === "earned" ? i : -1)).filter((i) => i >= 0);
  const top = earnedIdx.length ? earnedIdx[earnedIdx.length - 1] : -1;
  const next = rungs.findIndex((r) => r.state === "locked");
  const first = track.entries[0];
  const name = numeralName(first.name);
  const state = earnedIdx.length === rungs.length ? "earned" : earnedIdx.length > 0 ? "partial" : "locked";
  const S = ACHIEVEMENTS_SHEET_COPY.state;
  const stateText =
    state === "earned"
      ? fill(S.complete, { total: rungs.length })
      : state === "partial"
        ? fill(S.partial, { n: earnedIdx.length, total: rungs.length })
        : S.locked;
  const shown = top >= 0 ? top : 0;
  const detail = top >= 0 ? rungs[top].text : track.entries[0].description;
  const progress = next >= 0 ? rungs[next].progressText : null;
  return {
    key: keyOf(first),
    kind: "track",
    state,
    name,
    iconSrc: rungs[shown].iconSrc,
    silhouette: false,
    dim: top < 0,
    detail,
    dateText: top >= 0 ? rungs[top].dateText : null,
    progressText: progress,
    stateText,
    ladder: rungs.map((r, i) => ({ tier: TIER_NUMERALS[i] || String(i + 1), state: r.state })),
    rungs,
    expandable: true,
    label: labelOf(name, stateText, detail, progress),
  };
}

function rowOf(rec, track, tz) {
  return track.entries.length > 1 ? trackRow(rec, track, tz) : singleRow(rec, track.entries[0], tz);
}

/**
 * buildAchievementsView(record, opts) — a lifetime record becomes the list:
 * { title, earned, total, secrets, earnedText, secretsText, blocks }, deeply
 * frozen. opts is { tzOffset } (minutes, default 0). The record goes through
 * sanitizeRecord (a throw falls back to the empty record), so null, undefined
 * and hostile values read as the all-zero record. Read-only and clock-free.
 */
export function buildAchievementsView(record, opts) {
  const rec = safeRecord(record);
  const tz = opts && typeof opts === "object" && typeof opts.tzOffset === "number" && Number.isFinite(opts.tzOffset) ? opts.tzOffset : 0;
  const total = ACHIEVEMENTS.length;
  const earned = earnedCount(rec);
  const secrets = secretCount(rec);
  const C = ACHIEVEMENTS_SHEET_COPY;
  const secretsText = secrets === 0 ? C.secrets.none : secrets === 1 ? C.secrets.one : fill(C.secrets.many, { n: secrets });
  const blocks = ACHIEVEMENT_BLOCKS.map((block) => ({
    id: block.id,
    title: C.blocks[block.id],
    rows: DEFAULT_TRACKS.filter((t) => t.entries[0].listOrder >= block.firstOrder && t.entries[0].listOrder <= block.lastOrder).map((t) => rowOf(rec, t, tz)),
  }));
  return deepFreeze({
    title: C.title,
    earned,
    total,
    secrets,
    earnedText: fill(C.earned, { n: earned, total }),
    secretsText,
    blocks,
  });
}

// ---------------------------------------------------------------------
// The DOM renderer
// ---------------------------------------------------------------------

function el(doc, tag, cls) {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

function str(value) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function textEl(doc, tag, cls, value) {
  const node = el(doc, tag, cls);
  node.textContent = str(value);
  return node;
}

/**
 * Appends the non-empty parts as spans, each followed by a plain space node, so a
 * screen reader that computes a button's name from its content hears separate
 * words whatever the stylesheet does with the spans.
 */
function appendParts(doc, parent, parts) {
  for (const [cls, value] of parts) {
    if (typeof value !== "string" || value.length === 0) continue;
    parent.appendChild(textEl(doc, "span", cls, value));
    parent.appendChild(doc.createTextNode(" "));
  }
}

function isOpen(expanded, key) {
  if (Array.isArray(expanded)) return expanded.includes(key);
  if (expanded && typeof expanded.has === "function") return expanded.has(key) === true;
  return false;
}

function iconEl(doc, row) {
  const img = el(doc, "img", "mw-ach-icon" + (row.dim ? " mw-ach-icon-dim" : "") + (row.silhouette ? " mw-ach-icon-silhouette" : ""));
  if (typeof row.iconSrc === "string") img.setAttribute("src", row.iconSrc);
  img.setAttribute("alt", "");
  img.setAttribute("aria-hidden", "true");
  return img;
}

function rungsEl(doc, rungs) {
  const ul = el(doc, "ul", "mw-ach-rungs");
  for (const rung of Array.isArray(rungs) ? rungs : []) {
    if (!rung || typeof rung !== "object") continue;
    const li = el(doc, "li", "mw-ach-rung");
    li.setAttribute("data-state", str(rung.state));
    appendParts(doc, li, [
      ["mw-ach-rung-name", rung.name],
      ["mw-ach-rung-state", rung.stateText],
      ["mw-ach-rung-text", rung.text],
      ["mw-ach-rung-progress", rung.progressText],
    ]);
    ul.appendChild(li);
  }
  return ul;
}

function rowEl(doc, row, opts) {
  const expandable = row.expandable === true;
  const open = expandable && isOpen(opts.expanded, row.key);
  const li = el(doc, "li", "mw-ach-row");
  li.setAttribute("data-state", str(row.state));
  li.setAttribute("data-kind", str(row.kind));
  li.setAttribute("data-key", str(row.key));

  let head;
  if (expandable) {
    head = el(doc, "button", "mw-ach-head");
    head.setAttribute("type", "button");
    head.setAttribute("aria-expanded", open ? "true" : "false");
    head.onclick = () => {
      if (typeof opts.onToggle === "function") opts.onToggle(row.key);
    };
  } else {
    head = el(doc, "div", "mw-ach-head");
  }
  head.appendChild(iconEl(doc, row));

  const body = el(doc, "div", "mw-ach-text");
  appendParts(doc, body, [
    ["mw-ach-name", row.name],
    ["mw-ach-state", row.stateText],
    ["mw-ach-detail", row.detail],
    ["mw-ach-progress", row.progressText],
  ]);
  if (expandable) body.appendChild(textEl(doc, "span", "mw-ach-hint", open ? ACHIEVEMENTS_SHEET_COPY.collapse : ACHIEVEMENTS_SHEET_COPY.expand));
  head.appendChild(body);

  if (expandable) {
    const ladder = el(doc, "span", "mw-ach-ladder");
    ladder.setAttribute("aria-hidden", "true");
    for (const pip of Array.isArray(row.ladder) ? row.ladder : []) {
      if (!pip || typeof pip !== "object") continue;
      const i = textEl(doc, "i", "mw-ach-pip", pip.tier);
      i.setAttribute("data-state", str(pip.state));
      ladder.appendChild(i);
    }
    head.appendChild(ladder);
  }
  li.appendChild(head);
  if (open) li.appendChild(rungsEl(doc, row.rungs));
  return li;
}

/**
 * renderAchievementsSheet(host, view, opts) — builds the list into `host`
 * (replacing its children) from a buildAchievementsView result and returns
 * the root. opts is { expanded, onToggle }: `expanded` an array or Set of row
 * keys, `onToggle` called with a track row's key when its button is tapped.
 * DOM order is reading order: a track's rung list sits directly after that
 * row's head inside the same list item. No timers, no scrolling, no animation:
 * expanding is a re-render driven by the caller's `expanded` set.
 */
export function renderAchievementsSheet(host, view, opts) {
  if (!host || typeof host !== "object" || !host.ownerDocument) return null;
  const doc = host.ownerDocument;
  const settings = opts && typeof opts === "object" ? opts : {};
  const root = el(doc, "div", "mw-ach");
  const v = view && typeof view === "object" ? view : {};

  if (typeof v.earnedText === "string" || typeof v.secretsText === "string") {
    const summary = el(doc, "div", "mw-ach-summary");
    summary.appendChild(textEl(doc, "p", "mw-ach-count", v.earnedText));
    summary.appendChild(textEl(doc, "p", "mw-ach-secrets", v.secretsText));
    root.appendChild(summary);
  }

  for (const block of Array.isArray(v.blocks) ? v.blocks : []) {
    if (!block || typeof block !== "object") continue;
    const rows = (Array.isArray(block.rows) ? block.rows : []).filter((r) => r && typeof r === "object");
    if (rows.length === 0) continue;
    const section = el(doc, "section", "mw-ach-block");
    section.appendChild(textEl(doc, "h3", "mw-ach-block-title", block.title));
    const list = el(doc, "ul", "mw-ach-list");
    for (const row of rows) list.appendChild(rowEl(doc, row, settings));
    section.appendChild(list);
    root.appendChild(section);
  }

  host.replaceChildren(root);
  return root;
}
