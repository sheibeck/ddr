// src/browser/runDoc.js
//
// Phase 83 (SRV-01, SRV-02, SRV-03). The one definition of the leaderboard
// run document: its field set, bounds, the four integer rank keys, and the
// REST commit/query shapes 83-04's board client and run queue build on.
//
// The doc id is always `{uid}_{hash}` (runDocId), reusing engine/death.js's
// RunSummary hash as the run's stable identity — resubmitting the same run
// hits the same document and is idempotent by construction (createRunCommit's
// currentDocument.exists=false precondition).
//
// The four rank keys (deepKey/daysKey/killsKey/goldKey) are exact integers so
// every board query is a single orderBy/count — no client-side sort. deepKey is
// floor * 1,000,000 + steps (floor desc, ties by MORE steps; Phase 87 BOARD-28). daysKey
// applies the Phase 82 DAYS rule (docs/DAYS-FARMING.md "## The DAYS rule"):
// min(day, 10 * floor) desc, ties by floor desc — a deliberate divergence
// from engine/records.js#compareRuns("days")'s uncapped local comparator, so
// this module derives daysKey itself rather than reusing compareRuns for it.
//
// validateRunDoc is the JS mirror of firebase/firestore.rules#isValidBoardRun
// (83-02 Task 3) — the two are kept equal by test/unit/firestore-rules.test.js.
// The client never builds a doc the rules would refuse: buildRunDoc always
// runs its output back through validateRunDoc before returning ok:true.
//
// Phase 84 (BOARD-20, BOARD-22) adds `note` (the killer's name on board rows
// — engine/death.js#buildRunSummary's death note, e.g. "cut down by a
// Werebeast", filled from content banks and the bestiary, never free text)
// and `when` (the death time in ms, feeding the expanded row's date line).
// `when`'s upper bound carries a one-day clock-skew allowance
// (WHEN_SKEW_MS): a phone whose clock runs a little fast must not lose its
// run. The bound is enforced by the server clock (firebase/firestore.rules,
// request.time) and, in the browser dev loop, by fakeBoardServer.js's own
// injected clock — validateRunDoc only checks it client-side when an
// explicit `now` is passed in. rankKeyOf(stat, run) is the one shared
// rank-key function both Leaderboards views (Phase 84) rank by.
//
// Phase 91.2 (BOARD-31, D-11, D-13): `handle` is the poster's verified Play
// Games name (the field keeps its name because shipped 2.2.0 clients decode it
// for the board headline). The rules bind it to names/{uid}.name; validateRunDoc
// mirrors that when it is given the verified `name`, and otherwise only checks
// the size bound. The 2.2.0 rolled-handle regex and the 2.2.0 deepKey formula were
// transition artefacts, deleted at the 2.3 cutover (docs/RELEASING.md Release 2.3.0 step 4).
//
// Pure, DOM-free: no window, document, navigator, localStorage,
// sessionStorage or bare global fetch. Never throws.

import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";
import { CAUSE_TEXT } from "../../content/epitaphs.js";
import { THRESHOLDS } from "../../content/misc-tables.js";
import { SEASON } from "../../content/season.js";
import { RANKED_BOARDS } from "../../engine/records.js";
import { toFirestoreFields, docName } from "./firestoreRest.js";
import { BOARD_NAME_MAX_CHARS } from "./boardName.js";

// ---------------------------------------------------------------------------
// Collections, field lists, bounds
// ---------------------------------------------------------------------------

export const RUN_COLLECTION = "runs";
export const BANNED_COLLECTION = "banned";

/** RUN_CLIENT_FIELDS — every field a client-built run doc carries, in order. */
export const RUN_CLIENT_FIELDS = Object.freeze([
  "uid", "handle", "season", "name", "race", "sub", "cls", "level", "floor",
  "day", "steps", "kills", "gold", "sp", "cause", "note", "epitaph", "when",
  "hash", "version", "seed", "acts", "deepKey", "daysKey", "killsKey", "goldKey",
]);

/** RUN_DOC_FIELDS — RUN_CLIENT_FIELDS plus the server-set createdAt. */
export const RUN_DOC_FIELDS = Object.freeze([...RUN_CLIENT_FIELDS, "createdAt"]);

export const FLOOR_MIN = 1;
export const FLOOR_MAX = 200;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = THRESHOLDS.length;
export const DAY_MIN = 1;
export const DAY_CAMP_ALLOWANCE = 300;
export const STEPS_MAX = 999999;
export const GOLD_MAX = 10000000;
export const SP_MAX = 1000000000;
export const ACTS_MAX = 1000000000;
export const SEED_MAX = Number.MAX_SAFE_INTEGER;
export const NAME_MAX_CHARS = 40;
export const EPITAPH_MAX_CHARS = 400;
export const VERSION_MAX_CHARS = 64;
export const NOTE_MAX_CHARS = 120;
export const WHEN_SKEW_MS = 86400000;
export const UID_MAX_CHARS = 128;
export const LIST_LIMIT_MAX = 50;
export const TOP_N = 10;
export const DAYS_PER_FLOOR_CAP = 10;
export const HASH_PATTERN = "^[0-9a-f]{8}$";

/** RANK_FIELD — the doc field each board stat's rank key lives in. */
export const RANK_FIELD = Object.freeze({
  deep: "deepKey",
  days: "daysKey",
  kills: "killsKey",
  purse: "goldKey",
});

/** BOARD_STATS — the ranked board stats (engine/records.js#RANKED_BOARDS re-exported). */
export const BOARD_STATS = RANKED_BOARDS;

/** isBoardStat(stat) — true for every ranked board stat id. */
export function isBoardStat(stat) {
  return BOARD_STATS.includes(stat);
}

export const RUN_FAIL_IDS = Object.freeze([
  "keys", "uid", "handle", "season", "name", "race", "sub", "cls", "level",
  "floor", "day", "steps", "kills", "gold", "sp", "cause", "note", "epitaph",
  "when", "hash", "version", "seed", "acts", "deepkey", "dayskey", "killskey",
  "goldkey",
]);

// Module-private content lists (never exported — a "Magic User"/"Court Mage"
// export would be flagged copy by the voice-corpus completeness audit).
const RACE_LIST = Object.keys(RACES);
const CLASS_LIST = Object.keys(CLASSES);
const CAUSE_LIST = Object.keys(CAUSE_TEXT);
const SUB_UNIVERSE = new Set(CLASS_LIST.flatMap((cls) => CLASSES[cls].subs));
const HASH_RE = new RegExp(HASH_PATTERN);

// ---------------------------------------------------------------------------
// Rank keys
// ---------------------------------------------------------------------------

/**
 * deepKeyOf(run) — floor desc, then more steps (floor * 1,000,000 + steps).
 * steps never exceed STEPS_MAX (999,999), so a floor's keys never reach the
 * next floor. Phase 87 (BOARD-28, report #9) reverses v2.1 BOARD-17's
 * fewer-steps tie-break.
 */
export function deepKeyOf(run) {
  const floor = Number(run?.floor);
  const steps = Number(run?.steps);
  return floor * 1000000 + steps;
}

/** daysKeyOf(run) — the Phase 82 DAYS rule: min(day, 10 * floor) * 1000 + floor. */
export function daysKeyOf(run) {
  const day = Number(run?.day);
  const floor = Number(run?.floor);
  const capped = day < DAYS_PER_FLOOR_CAP * floor ? day : DAYS_PER_FLOOR_CAP * floor;
  return capped * 1000 + floor;
}

/** killsKeyOf(run) — kills desc, then floor desc (kills * 1,000 + floor). */
export function killsKeyOf(run) {
  const kills = Number(run?.kills);
  const floor = Number(run?.floor);
  return kills * 1000 + floor;
}

/** goldKeyOf(run) — gold desc (the raw gold value). */
export function goldKeyOf(run) {
  return Number(run?.gold);
}

/** rankKeys(run) — {deepKey, daysKey, killsKey, goldKey} computed from run. */
export function rankKeys(run) {
  return {
    deepKey: deepKeyOf(run),
    daysKey: daysKeyOf(run),
    killsKey: killsKeyOf(run),
    goldKey: goldKeyOf(run),
  };
}

/**
 * rankKeyOf(stat, run) — Phase 84 (CONTEXT area 4): the one shared rank-key
 * function both Leaderboards views (the board and YOUR DEAD) rank by,
 * dispatching to the same four formulas above. Returns null for any stat
 * that is not one of the four ranked board stats. Never throws.
 */
export function rankKeyOf(stat, run) {
  if (stat === "deep") return deepKeyOf(run);
  if (stat === "days") return daysKeyOf(run);
  if (stat === "kills") return killsKeyOf(run);
  if (stat === "purse") return goldKeyOf(run);
  return null;
}

// ---------------------------------------------------------------------------
// Doc id, build, validate
// ---------------------------------------------------------------------------

/** runDocId(uid, hash) — the run document's id: `{uid}_{hash}`. */
export function runDocId(uid, hash) {
  return `${uid}_${hash}`;
}

/**
 * validateRunDoc(doc, {uid, now, name}) — the JS mirror of
 * firebase/firestore.rules#isValidBoardRun plus the runs create rule's name
 * binding. Returns [] when the rules would accept a create with this data;
 * otherwise an array of RUN_FAIL_IDS
 * entries, one per failing clause (a bad/missing/extra key set short-circuits
 * to exactly ["keys"]). `handle` must be a string of 1..BOARD_NAME_MAX_CHARS
 * characters and, when `name` is a string (the poster's verified Play Games
 * name, names/{uid}.name), equal to it exactly; the fail id stays "handle".
 * `now`, when a finite number, bounds `when` the same
 * way the live rules' request.time does (Phase 84's WHEN_SKEW_MS
 * clock-skew allowance); without `now` the upper bound is not checked
 * client-side (the server/fake clock is the source of truth). Never throws.
 */
export function validateRunDoc(doc, { uid, now, name } = {}) {
  try {
    if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return ["keys"];
    const keys = Object.keys(doc);
    const hasAll = RUN_CLIENT_FIELDS.every((k) => keys.includes(k));
    const onlyAllowed = keys.every((k) => RUN_CLIENT_FIELDS.includes(k));
    if (!hasAll || !onlyAllowed) return ["keys"];

    const fails = [];

    const uidOk =
      typeof doc.uid === "string" &&
      doc.uid.length >= 1 &&
      doc.uid.length <= UID_MAX_CHARS &&
      (uid === undefined || doc.uid === uid);
    if (!uidOk) fails.push("uid");

    const handleOk =
      typeof doc.handle === "string" &&
      doc.handle.length >= 1 &&
      doc.handle.length <= BOARD_NAME_MAX_CHARS &&
      (typeof name !== "string" || doc.handle === name);
    if (!handleOk) fails.push("handle");

    if (!(Number.isInteger(doc.season) && doc.season === SEASON)) fails.push("season");

    if (!(typeof doc.name === "string" && doc.name.length >= 1 && doc.name.length <= NAME_MAX_CHARS)) fails.push("name");

    if (!(typeof doc.race === "string" && RACE_LIST.includes(doc.race))) fails.push("race");

    const clsOk = typeof doc.cls === "string" && CLASS_LIST.includes(doc.cls);
    if (!clsOk) fails.push("cls");

    const subOk =
      typeof doc.sub === "string" &&
      (clsOk ? CLASSES[doc.cls].subs.includes(doc.sub) : SUB_UNIVERSE.has(doc.sub));
    if (!subOk) fails.push("sub");

    if (!(Number.isInteger(doc.level) && doc.level >= LEVEL_MIN && doc.level <= LEVEL_MAX)) fails.push("level");

    if (!(Number.isInteger(doc.floor) && doc.floor >= FLOOR_MIN && doc.floor <= FLOOR_MAX)) fails.push("floor");

    if (!(Number.isInteger(doc.steps) && doc.steps >= 0 && doc.steps <= STEPS_MAX)) fails.push("steps");

    if (
      !(
        Number.isInteger(doc.day) &&
        doc.day >= DAY_MIN &&
        Number.isInteger(doc.steps) &&
        doc.day * 100 <= doc.steps + DAY_CAMP_ALLOWANCE * 100
      )
    )
      fails.push("day");

    if (!(Number.isInteger(doc.kills) && doc.kills >= 0 && Number.isInteger(doc.steps) && doc.kills <= doc.steps))
      fails.push("kills");

    if (!(Number.isInteger(doc.gold) && doc.gold >= 0 && doc.gold <= GOLD_MAX)) fails.push("gold");

    if (!(Number.isInteger(doc.sp) && doc.sp >= 0 && doc.sp <= SP_MAX)) fails.push("sp");

    if (!(typeof doc.cause === "string" && CAUSE_LIST.includes(doc.cause))) fails.push("cause");

    if (!(typeof doc.note === "string" && doc.note.length <= NOTE_MAX_CHARS)) fails.push("note");

    if (!(typeof doc.epitaph === "string" && doc.epitaph.length <= EPITAPH_MAX_CHARS)) fails.push("epitaph");

    const nowMs = typeof now === "number" && Number.isFinite(now) ? now : undefined;
    const whenOk =
      Number.isSafeInteger(doc.when) &&
      doc.when >= 0 &&
      (nowMs === undefined || doc.when <= nowMs + WHEN_SKEW_MS);
    if (!whenOk) fails.push("when");

    if (!(typeof doc.hash === "string" && HASH_RE.test(doc.hash))) fails.push("hash");

    if (!(typeof doc.version === "string" && doc.version.length >= 1 && doc.version.length <= VERSION_MAX_CHARS))
      fails.push("version");

    if (!(Number.isSafeInteger(doc.seed) && doc.seed >= 0 && doc.seed <= SEED_MAX)) fails.push("seed");

    if (!(Number.isInteger(doc.acts) && doc.acts >= 0 && doc.acts <= ACTS_MAX)) fails.push("acts");

    if (!(Number.isInteger(doc.deepKey) && doc.deepKey === deepKeyOf(doc))) fails.push("deepkey");
    if (!(Number.isInteger(doc.daysKey) && doc.daysKey === daysKeyOf(doc))) fails.push("dayskey");
    if (!(Number.isInteger(doc.killsKey) && doc.killsKey === killsKeyOf(doc))) fails.push("killskey");
    if (!(Number.isInteger(doc.goldKey) && doc.goldKey === goldKeyOf(doc))) fails.push("goldkey");

    return fails;
  } catch {
    return ["keys"];
  }
}

/**
 * buildRunDoc(summary, {uid, handle, version}) — copies summary's run fields
 * (epitaph and note coerced to "" when not a string; every other field
 * copied without coercion), adds uid/handle/version, computes the four rank
 * keys, orders by RUN_CLIENT_FIELDS and validates. Returns {ok:true, id, doc}
 * (both frozen) or {ok:false, reason:"invalid", fails}. Never throws.
 */
export function buildRunDoc(summary, opts = {}) {
  try {
    const s = summary && typeof summary === "object" ? summary : {};
    const { uid, handle, version } = opts && typeof opts === "object" ? opts : {};
    const epitaph = typeof s.epitaph === "string" ? s.epitaph : "";
    const note = typeof s.note === "string" ? s.note : "";
    const partial = {
      uid,
      handle,
      season: s.season,
      name: s.name,
      race: s.race,
      sub: s.sub,
      cls: s.cls,
      level: s.level,
      floor: s.floor,
      day: s.day,
      steps: s.steps,
      kills: s.kills,
      gold: s.gold,
      sp: s.sp,
      cause: s.cause,
      note,
      epitaph,
      when: s.when,
      hash: s.hash,
      version,
      seed: s.seed,
      acts: s.acts,
    };
    const keys = rankKeys(partial);
    const doc = {};
    for (const field of RUN_CLIENT_FIELDS) {
      doc[field] = field in keys ? keys[field] : partial[field];
    }
    Object.freeze(doc);
    const fails = validateRunDoc(doc, { uid });
    if (fails.length > 0) return { ok: false, reason: "invalid", fails };
    const id = runDocId(doc.uid, doc.hash);
    return Object.freeze({ ok: true, id, doc });
  } catch {
    return { ok: false, reason: "invalid", fails: ["keys"] };
  }
}

// ---------------------------------------------------------------------------
// REST commit builders
// ---------------------------------------------------------------------------

/**
 * createRunCommit(config, id, doc) — a documents:commit body with ONE Write:
 * an update carrying every doc field (no createdAt), an updateTransforms
 * entry that sets createdAt to the server's REQUEST_TIME, and a
 * currentDocument.exists:false precondition (create-only/idempotent — a
 * resubmit of the same {uid}_{hash} fails this precondition instead of
 * overwriting). Firestore v1's Write message carries update + updateTransforms
 * + currentDocument together, so this is a single atomic Write, not two.
 */
export function createRunCommit(config, id, doc) {
  const name = docName(config, RUN_COLLECTION, id);
  const { createdAt, ...clientDoc } = doc || {};
  return {
    writes: [
      {
        update: { name, fields: toFirestoreFields(clientDoc) },
        updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
        currentDocument: { exists: false },
      },
    ],
  };
}

/** deleteCommit(config, ids) — one delete Write per id. */
export function deleteCommit(config, ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  return { writes: list.map((id) => ({ delete: docName(config, RUN_COLLECTION, id) })) };
}

// ---------------------------------------------------------------------------
// REST query builders
// ---------------------------------------------------------------------------

function fieldFilter(field, op, value) {
  return { fieldFilter: { field: { fieldPath: field }, op, value } };
}

function whereClause(filters) {
  return filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } };
}

/** boardFilters({season, race, sub}) — the equality filters shared by every board query, in order. */
export function boardFilters({ season, race = null, sub = null } = {}) {
  const filters = [fieldFilter("season", "EQUAL", { integerValue: String(season) })];
  if (race !== null && race !== undefined) filters.push(fieldFilter("race", "EQUAL", { stringValue: race }));
  if (sub !== null && sub !== undefined) filters.push(fieldFilter("sub", "EQUAL", { stringValue: sub }));
  return filters;
}

/** topTenQuery({stat, season, race, sub, limit}) — runQuery body for the top N runs by stat's rank key. */
export function topTenQuery({ stat, season, race = null, sub = null, limit = TOP_N } = {}) {
  const rankField = RANK_FIELD[stat];
  const filters = boardFilters({ season, race, sub });
  return {
    structuredQuery: {
      from: [{ collectionId: RUN_COLLECTION }],
      where: whereClause(filters),
      orderBy: [{ field: { fieldPath: rankField }, direction: "DESCENDING" }],
      limit,
    },
  };
}

/**
 * countQuery({stat, season, race, sub, above}) — runAggregationQuery body.
 * With no `above`, a pure-equality count (no orderBy). With `above`, adds a
 * rankField > above filter plus orderBy rankField DESCENDING (rankOf's
 * "how many runs are ahead of mine" read, reusing topTen's index).
 */
export function countQuery({ stat, season, race = null, sub = null, above } = {}) {
  const rankField = RANK_FIELD[stat];
  const filters = boardFilters({ season, race, sub });
  const hasAbove = above !== undefined && above !== null;
  if (hasAbove) filters.push(fieldFilter(rankField, "GREATER_THAN", { integerValue: String(above) }));
  const structuredQuery = {
    from: [{ collectionId: RUN_COLLECTION }],
    where: whereClause(filters),
  };
  if (hasAbove) structuredQuery.orderBy = [{ field: { fieldPath: rankField }, direction: "DESCENDING" }];
  return {
    structuredAggregationQuery: {
      aggregations: [{ alias: "count", count: {} }],
      structuredQuery,
    },
  };
}

/** ownRunsQuery({uid, limit, afterName}) — a page of one player's own runs, ordered by document name. */
export function ownRunsQuery({ uid, limit = LIST_LIMIT_MAX, afterName = null } = {}) {
  const structuredQuery = {
    from: [{ collectionId: RUN_COLLECTION }],
    where: fieldFilter("uid", "EQUAL", { stringValue: uid }),
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit,
  };
  if (afterName) structuredQuery.startAt = { values: [{ referenceValue: afterName }], before: false };
  return { structuredQuery };
}
