// src/browser/achievementTracker.js
//
// Phase 99 (TRACK-03, TRACK-04, TRACK-05). The pure tracker: it folds each
// action's events and state into the lifetime record (achievementRecord.js)
// and returns what the adapter's listener needs, which is the new record, the
// unlocks, the reveals and the progress changes. Phase 100 (unlock banner and
// the list) and Phase 101 (Play mirror) build on this result shape.
//
// Entry points:
//   beginRun(record, state, options)               a run starts (Tourist, run reset)
//   foldAction(record, events, before, after, options)   one dispatched action
//   progressFor(record, entry)                     the list's "37 / 50" reading
//   runTagOf(state), filledSlotCount(c)            helpers the adapter and tests share
// Both folds return { record, unlocks, reveals, progress, changed }, deep-frozen:
//   unlocks   [{ id, at }]            at = options.now, floored, 0 when not finite
//   reveals   [id]                    Hidden entries newly revealed
//   progress  [{ id, value, steps }]  incremental entries whose clamped value moved
//   changed   true when the record differs from the one passed in; then record is
//             a new frozen record, otherwise it is the very object passed in.
// options is { now, catalog }; catalog defaults to ACHIEVEMENTS and is always
// evaluated sorted by listOrder (ties by id), so unlocks, reveals and progress
// come out in list order whatever order the events or the catalog array had.
//
// State fields read, and nothing else (a missing or malformed field reads as
// 0 or empty and never throws): dev, seed, day, steps, floor.depth, c.name,
// c.race, c.cls, c.sub, c.gold, c.weapon, c.armor, c.worn.jewelry1,
// c.worn.jewelry2, c.worn.cloak.
//
// Counting rulings (LOCKED in 98-CONTEXT "What counts", races and classes at
// floor 10 per quick 261005-opm):
//   - body counts: every foeKilled counts under its group, plus the
//     walkingDeadTurned count as Walking Dead (Turn Undead emits no foeKilled)
//   - Human Shields: memberDowned and joinerMurdered
//   - Still Standing: each trapSprung that does not end in a trap death
//   - abandon is not a death (no Frequent Flier step, no Special Snowflake, no
//     death achievement, no death reveal), but its run still counted for Tourist
//   - Special Snowflake starts Hidden (quick 261005-vn5); its catalog revealOn
//     { kind: "realDeath" } reveals it on the first real death, floor 1 (which
//     also unlocks it) or deeper; the reveal persists in record.revealed
//   - Special Snowflake is any real death on floor 1; Gravity Wins is fall or
//     gorge; Read the Label potion; Fatal Misstep trap; Empty Calories starve;
//     Solid Miscalculation entombed
//   - Terminal Condition: the Disease flag and the Poison flag are set only by
//     an afflictionCaught (first above 0) or afflictionTick whose wp is exactly
//     1; the flags are lifetime and it is never a death
//   - Hoarder reads c.gold as the most held at once in a run
//
// Current-run progress lives in the record's run section, tagged to its run
// (runTagOf): { tag, seen, stepped, naked, teetotal, fleesWon }. beginRun resets
// it (Chicken, Naked Ambition and Teetotaler start over); a relaunch mid-run
// keeps it because the tag still matches. A run the tracker did not see start (no
// run section, or another run's tag: a pre-2.5 save resumed) gets seen false, so
// it can never earn Naked Ambition or Teetotaler; everything else counts from
// the moment it is seen. Chicken counts fled events with reason escaped only (10
// in one run); Teetotaler breaks only on the hero's own potionDrunk and unlocks
// on reaching floor 5; Fully Dressed needs all five slots filled at one moment;
// Naked Ambition needs all five slots empty on the state the first step was
// taken from and none filled again before floor 5.
//
// Only real runs count: a state with dev true earns nothing and returns the
// same record. The tuning bot drives the engine directly and never calls this
// module. The tracker folds facts and does not deduplicate actions; folding
// each dispatch exactly once is the adapter's guarantee. Pure: it imports only
// content/ and ./achievementRecord.js, and reads no clock, no random source,
// no DOM and no storage; its inputs are never mutated.

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { BESTIARY } from "../../content/bestiary.js";
import { CLASSES } from "../../content/classes.js";
import { emptyRecord, sanitizeRecord, serializeRecord } from "./achievementRecord.js";

const KILL_KEYS = new Set(Object.keys(BESTIARY));
const SUB_CLASSES = new Set(Object.values(CLASSES).flatMap((cls) => (Array.isArray(cls.subs) ? cls.subs : [])));

function byListOrder(a, b) {
  return a.listOrder - b.listOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

const DEFAULT_CATALOG = Object.freeze([...ACHIEVEMENTS].sort(byListOrder));

function catalogOf(options) {
  const given = options && Array.isArray(options.catalog) ? options.catalog : null;
  return given ? [...given].sort(byListOrder) : DEFAULT_CATALOG;
}

function isObj(v) {
  return v !== null && typeof v === "object";
}

function has(obj, key) {
  return isObj(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

/** toInt(v) — a finite number at least 0, floored and capped at MAX_SAFE_INTEGER; anything else is 0. */
function toInt(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return 0;
  return Math.min(Math.floor(v), Number.MAX_SAFE_INTEGER);
}

function nowOf(options) {
  return toInt(options && options.now);
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function depthOf(state) {
  return toInt(isObj(state) && isObj(state.floor) ? state.floor.depth : 0);
}

/**
 * runTagOf(state) — the string identifying a run: seed, race, sub-class and
 * name joined with a pipe. GameState holds no start time, and a real run's
 * seed is the wall-clock moment of its roll, so this tells one run from the next.
 */
export function runTagOf(state) {
  const c = isObj(state) && isObj(state.c) ? state.c : {};
  const part = (v) => (v === undefined || v === null ? "" : String(v));
  return [isObj(state) ? state.seed : undefined, c.race, c.sub, c.name].map(part).join("|");
}

/**
 * filledSlotCount(c) — how many of the five worn slots are filled. The weapon
 * counts unless it is empty or "Fists"; the armor unless it is empty or
 * "Nothing" (a destroyed piece still named in the slot counts as filled until
 * UNEQUIP clears it); jewelry1, jewelry2 and the cloak when truthy. Bag items
 * and the torch are never read.
 */
export function filledSlotCount(c) {
  if (!isObj(c)) return 0;
  let n = 0;
  if (typeof c.weapon === "string" && c.weapon !== "" && c.weapon !== "Fists") n++;
  if (typeof c.armor === "string" && c.armor !== "" && c.armor !== "Nothing") n++;
  const worn = isObj(c.worn) ? c.worn : {};
  if (worn.jewelry1) n++;
  if (worn.jewelry2) n++;
  if (worn.cloak) n++;
  return n;
}

// ---------------------------------------------------------------------
// Measures: what a trigger reads from a record
// ---------------------------------------------------------------------

/** counterValue(rec, trigger) — the lifetime counter's value, or null for an unknown counter or group. */
function counterValue(rec, trigger) {
  if (trigger.counter === "kills") return KILL_KEYS.has(trigger.group) ? rec.kills[trigger.group] : null;
  return has(rec.counters, trigger.counter) ? rec.counters[trigger.counter] : null;
}

/** bestValue(rec, trigger) — the single-run best's value, or null for an unknown metric. */
function bestValue(rec, trigger) {
  if (trigger.metric === "depth") {
    if (trigger.race) return has(rec.bests.depthByRace, trigger.race) ? rec.bests.depthByRace[trigger.race] : null;
    if (trigger.parentClass) return has(rec.bests.depthByClass, trigger.parentClass) ? rec.bests.depthByClass[trigger.parentClass] : null;
    return rec.bests.depth;
  }
  if (trigger.metric === "days" || trigger.metric === "wilmstHeld" || trigger.metric === "fleesWon") return rec.bests[trigger.metric];
  return null;
}

function setValue(rec, trigger) {
  return trigger.set === "subClassesDelved" ? rec.subClassesDelved.length : null;
}

/** measureOf(rec, entry) — the number a progress reading shows (0 when the trigger has no measure). */
function measureOf(rec, entry) {
  const t = entry.trigger;
  if (!isObj(t)) return 0;
  let v = null;
  if (t.kind === "lifetimeCounter") v = counterValue(rec, t);
  else if (t.kind === "singleRunBest") v = bestValue(rec, t);
  else if (t.kind === "distinctSetCount") v = setValue(rec, t);
  return v === null ? 0 : v;
}

function clampedMeasure(rec, entry) {
  return Math.min(measureOf(rec, entry), toInt(entry.steps));
}

/**
 * progressFor(record, entry) — { value, steps } for an incremental entry
 * (value clamped to steps), null for a standard one. The list reads this.
 */
export function progressFor(record, entry) {
  if (!isObj(entry) || entry.type !== "incremental") return null;
  const rec = record == null ? emptyRecord() : record;
  return { value: clampedMeasure(rec, entry), steps: toInt(entry.steps) };
}

// ---------------------------------------------------------------------
// Evaluation: is an entry's condition met
// ---------------------------------------------------------------------

function flagMet(trigger, threshold, rec, after) {
  const run = rec.run;
  const floorReached = depthOf(after) >= (threshold === null ? 0 : threshold);
  switch (trigger.flag) {
    case "fullyDressed":
      return filledSlotCount(isObj(after) ? after.c : null) === 5;
    case "nakedAtFirstStep":
      // Only a run whose start the tracker saw can prove its first step was bare.
      return run !== null && run.seen && run.stepped && run.naked && floorReached;
    case "noHealingPotion":
      // Likewise: an unseen run's earlier potions were never counted.
      return run !== null && run.seen && run.teetotal && floorReached;
    default:
      return false;
  }
}

function isMet(entry, rec, after, cause) {
  const t = entry.trigger;
  if (!isObj(t)) return false;
  const threshold = typeof entry.threshold === "number" ? entry.threshold : null;
  switch (t.kind) {
    case "lifetimeCounter": {
      const v = counterValue(rec, t);
      return v !== null && threshold !== null && v >= threshold;
    }
    case "singleRunBest": {
      const v = bestValue(rec, t);
      return v !== null && threshold !== null && v >= threshold;
    }
    case "singleRunFlag":
      return flagMet(t, threshold, rec, after);
    case "deathCause":
      if (cause === null || cause === "abandon") return false;
      if (t.causes != null && !(Array.isArray(t.causes) && t.causes.includes(cause))) return false;
      if (t.floor != null && t.floor !== depthOf(after)) return false;
      return true;
    case "lifetimeFlagPair":
      return Array.isArray(t.flags) && t.flags.length > 0 && t.flags.every((f) => has(rec.flags, f) && rec.flags[f] === true);
    case "distinctSetCount": {
      const v = setValue(rec, t);
      return v !== null && threshold !== null && v >= threshold;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------

function freezeResult(record, unlocks, reveals, progress, changed) {
  for (const u of unlocks) Object.freeze(u);
  for (const p of progress) Object.freeze(p);
  return Object.freeze({
    record,
    unlocks: Object.freeze(unlocks),
    reveals: Object.freeze(reveals),
    progress: Object.freeze(progress),
    changed,
  });
}

function unchanged(record) {
  return freezeResult(record, [], [], [], false);
}

/**
 * finish(base, draft, ctx) — the shared evaluation (steps 8 to 11): unlocks,
 * reveals, progress, then the sanitized output record and the changed flag.
 * `base` is the record passed in (never mutated); `draft` is its mutable copy.
 */
function finish(base, draft, ctx) {
  const { catalog, after, cause, now } = ctx;
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const isHidden = (id) => byId.has(id) && byId.get(id).initialState === "Hidden";

  const unlocks = [];
  const newEntries = [];
  for (const entry of catalog) {
    if (has(draft.unlocked, entry.id)) continue;
    if (!isMet(entry, draft, after, cause)) continue;
    draft.unlocked[entry.id] = now;
    unlocks.push({ id: entry.id, at: now });
    newEntries.push(entry);
  }

  const revealSet = new Set();
  for (const entry of newEntries) {
    if (isHidden(entry.id)) revealSet.add(entry.id);
    for (const id of Array.isArray(entry.reveals) ? entry.reveals : []) {
      if (isHidden(id)) revealSet.add(id);
    }
  }
  // A death reveals what the catalog says a real death reveals (revealOn realDeath): any real
  // death (abandons excluded), whether or not it also earns the entry. Idempotent through `revealed`.
  if (cause !== null && cause !== "abandon") {
    for (const entry of catalog) {
      if (isHidden(entry.id) && isObj(entry.revealOn) && entry.revealOn.kind === "realDeath") revealSet.add(entry.id);
    }
  }
  const reveals = catalog.filter((e) => revealSet.has(e.id) && !draft.revealed.includes(e.id)).map((e) => e.id);
  for (const id of reveals) draft.revealed.push(id);

  const out = sanitizeRecord(draft);

  const progress = [];
  for (const entry of catalog) {
    if (entry.type !== "incremental" || has(base.unlocked, entry.id)) continue;
    const before = clampedMeasure(base, entry);
    const value = clampedMeasure(out, entry);
    if (before !== value) progress.push({ id: entry.id, value, steps: toInt(entry.steps) });
  }

  const changed = serializeRecord(out) !== serializeRecord(base);
  return changed ? freezeResult(out, unlocks, reveals, progress, true) : unchanged(base);
}

// ---------------------------------------------------------------------
// The folds
// ---------------------------------------------------------------------

/**
 * beginRun(record, state, options) — a run starts: the run section resets
 * (Chicken, Naked Ambition and Teetotaler start over), the state's sub-class
 * joins the set Tourist counts (an abandoned run still counted), and the
 * shared evaluation runs. A dev run adds nothing.
 */
export function beginRun(record, state, options) {
  const base = record == null ? emptyRecord() : record;
  if (!isObj(state) || state.dev === true) return unchanged(base);
  const draft = clone(base);
  draft.run = { tag: runTagOf(state), seen: true, stepped: false, naked: true, teetotal: true, fleesWon: 0 };
  const sub = isObj(state.c) ? state.c.sub : undefined;
  if (typeof sub === "string" && SUB_CLASSES.has(sub) && !draft.subClassesDelved.includes(sub)) draft.subClassesDelved.push(sub);
  return finish(base, draft, { catalog: catalogOf(options), after: state, cause: null, now: nowOf(options) });
}

/**
 * foldAction(record, events, before, after, options) — one dispatched action:
 * its events and the states either side of it fold into the record.
 */
export function foldAction(record, events, before, after, options) {
  const base = record == null ? emptyRecord() : record;
  if (!isObj(after) || after.dev === true || (isObj(before) && before.dev === true)) return unchanged(base);
  const list = Array.isArray(events) ? events : [];
  const draft = clone(base);

  // A run the tracker did not see start (a pre-2.5 save resumed): counts from now on,
  // but its first step and earlier potions were never seen.
  const tag = runTagOf(after);
  if (!draft.run || draft.run.tag !== tag) {
    draft.run = { tag, seen: false, stepped: true, naked: false, teetotal: false, fleesWon: 0 };
  }

  const run = draft.run;
  let sprung = 0;
  let cause = null;
  let stepTaken = false;
  for (const e of list) {
    if (!isObj(e)) continue;
    switch (e.type) {
      case "foeKilled":
        if (typeof e.group === "string" && KILL_KEYS.has(e.group)) draft.kills[e.group] += 1;
        break;
      case "walkingDeadTurned":
        if (Number.isInteger(e.count) && e.count > 0) draft.kills["Walking Dead"] += e.count;
        break;
      case "joinerJoined":
        draft.counters.joinersAccepted += 1;
        break;
      case "memberDowned":
      case "joinerMurdered":
        draft.counters.joinersFallen += 1;
        break;
      case "parleyWon":
        draft.counters.parleysWon += 1;
        break;
      case "trapSprung":
        sprung += 1;
        break;
      case "fled":
        // Only a won flee roll counts; door, cloaker, tracked and smoke escapes do not.
        if (e.reason === "escaped") run.fleesWon += 1;
        break;
      case "potionDrunk":
        // The hero's own healing potion; memberPotionDrunk and every other event leave it be.
        run.teetotal = false;
        break;
      case "moved":
        stepTaken = true;
        break;
      case "afflictionCaught":
      case "afflictionTick": {
        const counts = e.type === "afflictionTick" || (typeof e.first === "number" && e.first > 0);
        if (counts && e.wp === 1) {
          if (e.kind === "Disease") draft.flags.diseaseLeftOnOneHp = true;
          else if (e.kind === "Poison") draft.flags.poisonLeftOnOneHp = true;
        }
        break;
      }
      case "died":
        if (cause === null) {
          cause = typeof e.cause === "string" ? e.cause : "";
          if (cause !== "abandon") draft.counters.deaths += 1;
        }
        break;
      default:
        break;
    }
  }

  // Each trap that did not end in a trap death was survived.
  draft.counters.trapsSurvived += Math.max(0, sprung - (cause === "trap" ? 1 : 0));

  // First step: judged on the state the step was taken from.
  if (run.seen && !run.stepped && (stepTaken || toInt(after.steps) > toInt(isObj(before) ? before.steps : 0))) {
    run.stepped = true;
    run.naked = filledSlotCount(isObj(before) && isObj(before.c) ? before.c : after.c) === 0;
  }
  // Naked Ambition breaks the moment any slot is filled again.
  if (run.stepped && run.naked && filledSlotCount(after.c) > 0) run.naked = false;

  // Single-run bests.
  const depth = depthOf(after);
  const c = isObj(after.c) ? after.c : {};
  draft.bests.depth = Math.max(draft.bests.depth, depth);
  draft.bests.days = Math.max(draft.bests.days, toInt(after.day));
  draft.bests.wilmstHeld = Math.max(draft.bests.wilmstHeld, toInt(c.gold));
  draft.bests.fleesWon = Math.max(draft.bests.fleesWon, run.fleesWon);
  if (has(draft.bests.depthByRace, c.race)) draft.bests.depthByRace[c.race] = Math.max(draft.bests.depthByRace[c.race], depth);
  if (has(draft.bests.depthByClass, c.cls)) draft.bests.depthByClass[c.cls] = Math.max(draft.bests.depthByClass[c.cls], depth);

  return finish(base, draft, { catalog: catalogOf(options), after, cause, now: nowOf(options) });
}
