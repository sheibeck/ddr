// test/unit/rail.test.js
//
// Phase 35 (Map Screen Rebuild), Plan 01 (MAP-03/MAP-04) — direct unit
// coverage for src/browser/rail.js: the family table (icon/title/tone/
// hold) over every TOAST_FOR key, the RAIL_DIRECT subset/disjointness
// proof, the generic roll-line rule, one-card-per-dispatch folding/
// stacking/head-selection, push/clear/announcement seq discipline, and a
// BANNED voice scan of every player-facing string this module owns.
//
// Synthetic event lists only — no rules-tier calls needed (mirrors
// test/unit/fightLog.test.js's own approach).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import url from "node:url";

import { toastsForAction, TOAST_FOR, ORACLE_ONLY, PRIORITY } from "../../src/browser/toasts.js";
import { narrateEvent } from "../../src/browser/eventNarration.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { FEATURE_ICONS } from "../../src/browser/icons.js";
import {
  RAIL_TONES,
  RAIL_HOLD,
  RAIL_COPY,
  RAIL_FAMILY,
  RAIL_FEATURE_ICON,
  RAIL_DIRECT,
  railFamilyFor,
  rollLineFor,
  railCardFor,
  railLineCard,
  emptyRail,
  railPush,
  railClear,
  railAnnouncement,
  WORN_RECONCILE_HOLD,
  wornReconcileCard,
} from "../../src/browser/rail.js";

// ─── Test 1: RAIL_TONES / RAIL_HOLD sanity ─────────────────────────────────

test("RAIL_TONES lists the five tones; RAIL_HOLD's named holds are all within [2200, 6000]", () => {
  assert.deepEqual([...RAIL_TONES], ["info", "good", "bad", "odd", "dull"]);
  for (const [name, ms] of Object.entries(RAIL_HOLD)) {
    assert.ok(ms >= 2200 && ms <= 6000, `RAIL_HOLD.${name} out of range: ${ms}`);
  }
});

// ─── Test 2: railFamilyFor — explicit families from the behavior table ────

test("railFamilyFor: explicit RAIL_FAMILY entries carry the exact icon/title/tone (+ hold override where specified)", () => {
  assert.deepEqual(railFamilyFor("trapSprung", "hurt", PRIORITY.them), { icon: "✕", title: "A TRAP", tone: "bad", hold: RAIL_HOLD.default });
  assert.deepEqual(railFamilyFor("trapAvoided", "miss", PRIORITY.other), { icon: "✕", title: "A TRAP", tone: "good", hold: RAIL_HOLD.default });
  assert.equal(railFamilyFor("teleported", "beat", PRIORITY.other).title, "TELEPORTED");
  assert.equal(railFamilyFor("teleported", "beat", PRIORITY.other).tone, "odd");
  assert.deepEqual(railFamilyFor("oneWayBlocked", "beat", PRIORITY.other), { icon: "▲", title: "ONE-WAY DOOR", tone: "odd", hold: RAIL_HOLD.mark });
  assert.equal(railFamilyFor("chestOpened", "hit", PRIORITY.other).title, "A LOCKED BOX");
  assert.equal(railFamilyFor("chestOpened", "hit", PRIORITY.other).tone, "good");
  assert.equal(railFamilyFor("chestLocked", "miss", PRIORITY.other).title, "THE LOCK HOLDS");
  assert.equal(railFamilyFor("chestLocked", "miss", PRIORITY.other).tone, "bad");
  assert.equal(railFamilyFor("climbedOver", "hit", PRIORITY.other).title, "CLIMBED");
  assert.equal(railFamilyFor("leaptOver", "hit", PRIORITY.other).title, "CLEARED IT");
  assert.equal(railFamilyFor("fellClimbing", "hurt", PRIORITY.other).title, "FELL");
  assert.equal(railFamilyFor("fellClimbing", "hurt", PRIORITY.other).tone, "bad");
  assert.equal(railFamilyFor("flownOver", "hit", PRIORITY.other).title, "OVER IT");
  assert.deepEqual(railFamilyFor("floorChanged", "beat", PRIORITY.other), { icon: "▼", title: "FLOOR {n}", tone: "odd", hold: RAIL_HOLD.floor });
  assert.deepEqual(railFamilyFor("leveled", "hit", PRIORITY.feature), { icon: "★", title: "SKILL LEVEL {n}", tone: "good", hold: RAIL_HOLD.level });
  assert.deepEqual(railFamilyFor("dayBegan", "beat", PRIORITY.other), { icon: "☾", title: "DAY {n}", tone: "dull", hold: RAIL_HOLD.day });
  assert.deepEqual(railFamilyFor("rested", "hit", PRIORITY.other), { icon: "☾", title: "CAMP MADE", tone: "good", hold: RAIL_HOLD.camp });
  assert.equal(railFamilyFor("wentHungry", "hurt", PRIORITY.other).title, "NOTHING TO EAT");
  assert.equal(railFamilyFor("campFailed", "block", PRIORITY.block).title, "NOTHING TO EAT", "an explicit family wins over the block fallback");
  assert.equal(railFamilyFor("wanderingMonster", "beat", PRIORITY.feature).title, "SOMETHING WANDERED IN");
  assert.equal(railFamilyFor("tableFour", "beat", PRIORITY.other).tone, "info");
  assert.deepEqual(railFamilyFor("tableFourNoop", "beat", PRIORITY.other), { icon: "●", title: "THE DOT", tone: "dull", hold: RAIL_HOLD.dull });
  assert.equal(railFamilyFor("joinerJoined", "hit", PRIORITY.feature).tone, "good");
  assert.equal(railFamilyFor("joinerDeclined", "beat", PRIORITY.feature).tone, "dull");
  assert.equal(railFamilyFor("joinerLeft", "beat", PRIORITY.feature).tone, "dull");
  assert.equal(railFamilyFor("findTaken", "beat", PRIORITY.other).title, "TAKEN");
  assert.deepEqual(railFamilyFor("findLeft", "beat", PRIORITY.other), { icon: "▪", title: "LEFT IT", tone: "dull", hold: RAIL_HOLD.dull });
  assert.equal(railFamilyFor("heightsFear", "hurt", PRIORITY.other).title, "AFRAID");
  assert.equal(railFamilyFor("waterFear", "hurt", PRIORITY.other).title, "AFRAID");
  assert.equal(railFamilyFor("trappedPanic", "hurt", PRIORITY.other).title, "AFRAID");
});

// ─── Test 3: railFamilyFor — the block/tone fallback ───────────────────────

test("railFamilyFor: the block/tone fallback for an unlisted type", () => {
  assert.deepEqual(railFamilyFor("neverListed", "hurt", PRIORITY.block), { icon: "·", title: "NOTHING DOING", tone: "dull", hold: RAIL_HOLD.dull });
  assert.deepEqual(railFamilyFor("neverListed", "hurt", PRIORITY.other), { icon: "·", title: "THAT HURT", tone: "bad", hold: RAIL_HOLD.default });
  assert.deepEqual(railFamilyFor("neverListed", "hit", PRIORITY.other), { icon: "·", title: "WELL THEN", tone: "good", hold: RAIL_HOLD.default });
  assert.deepEqual(railFamilyFor("neverListed", "miss", PRIORITY.other), { icon: "·", title: "NOTHING", tone: "dull", hold: RAIL_HOLD.dull });
  assert.deepEqual(railFamilyFor("neverListed", "magic", PRIORITY.other), { icon: "·", title: "MAGIC", tone: "odd", hold: RAIL_HOLD.default });
  assert.deepEqual(railFamilyFor("neverListed", "dodge", PRIORITY.other), { icon: "·", title: "CLOSE", tone: "info", hold: RAIL_HOLD.default });
  assert.deepEqual(railFamilyFor("neverListed", "beat", PRIORITY.other), { icon: "·", title: "MEANWHILE", tone: "info", hold: RAIL_HOLD.default });
});

// ─── Test 4: full TOAST_FOR coverage ───────────────────────────────────────

test("coverage: every TOAST_FOR key resolves to a family with a non-empty title, a tone in RAIL_TONES and a hold in [2200, 6000]", () => {
  for (const [type, builder] of Object.entries(TOAST_FOR)) {
    let tone = "beat";
    let priority = PRIORITY.other;
    try {
      const built = builder({ type }, {});
      if (built && typeof built === "object") {
        tone = built.tone ?? tone;
        priority = built.priority ?? priority;
      }
    } catch {
      // defended per the plan: a builder that throws on a bare {type} falls
      // back to the beat/other default.
    }
    const fam = railFamilyFor(type, tone, priority);
    assert.ok(fam.title && fam.title.length > 0, `${type}: title must be non-empty`);
    assert.ok(RAIL_TONES.includes(fam.tone), `${type}: tone ${fam.tone} not in RAIL_TONES`);
    assert.ok(fam.hold >= 2200 && fam.hold <= 6000, `${type}: hold ${fam.hold} out of range`);
  }
});

// ─── Test 5: RAIL_DIRECT subset/disjointness proof ─────────────────────────

test("RAIL_DIRECT is a strict subset of ORACLE_ONLY and disjoint from TOAST_FOR's keys", () => {
  assert.ok(RAIL_DIRECT.size > 0);
  for (const type of RAIL_DIRECT) {
    assert.ok(ORACLE_ONLY.has(type), `${type} must be in ORACLE_ONLY`);
    assert.ok(!(type in TOAST_FOR), `${type} must not be a TOAST_FOR key`);
  }
  assert.ok(RAIL_DIRECT.size < ORACLE_ONLY.size, "strict subset, not equal");
});

// ─── Test 6: rollLineFor ────────────────────────────────────────────────────

test("rollLineFor: narration roll span first, else numeric event.roll(+need)(+hurt), else null — hurt alone never fabricates", () => {
  assert.equal(rollLineFor({ type: "trapSprung", name: "Pit", dmg: 4 }, narrateEvent), "Pit finds you first. 4 hp.");
  assert.equal(rollLineFor({ type: "fellClimbing", hurt: 3 }, narrateEvent), null);
  assert.equal(rollLineFor({ type: "fellClimbing", hurt: 3, roll: 7, need: 4 }, () => ""), "roll 7 · 4 to clear · −3 hp");
  assert.equal(rollLineFor({ type: "x", roll: 12 }, () => ""), "roll 12");
  assert.equal(rollLineFor({ type: "x", hurt: 3 }, () => ""), null);
  assert.equal(rollLineFor(null, () => ""), null);
});

// ─── Test 7: railCardFor — trap + level-up stacking, head selection ───────

test("railCardFor: a trap + level-up move dispatch folds to one card, trap wins the head, lines stack newest-first", () => {
  const events = [{ type: "moved", x: 5, y: 5 }, { type: "trapSprung", name: "Pit", dmg: 4 }, { type: "leveled", level: 3, wpGain: 5 }];
  const folded = toastsForAction("move", events, {}, { limit: Infinity, withIdx: true });
  const card = railCardFor("move", events, folded, {});
  assert.ok(card, "a trap + level-up dispatch must produce a card");
  assert.equal(card.icon, "✕");
  assert.equal(card.iconKey, "trap");
  assert.equal(card.title, "A TRAP");
  assert.equal(card.tone, "bad");
  assert.equal(card.hold, RAIL_HOLD.level, "hold is the max family hold across the lines (6000)");
  assert.equal(card.lines.length, 2);
  assert.match(card.lines[0].text, /skill level/i, "leveled has the higher idx — shows first (newest-first)");
  assert.match(card.lines[1].text, /pit/i);
  assert.ok(card.lines[1].roll, "the trap line carries its roll");
  assert.equal(card.lines[0].roll, null, "the leveled line has no roll span");
});

// ─── Test 8: railCardFor — RAIL_DIRECT alone (floorChanged) ───────────────

test("railCardFor: a floorChanged-only dispatch builds a card straight from RAIL_DIRECT with the {n} placeholder resolved", () => {
  const events = [{ type: "moved", x: 5, y: 5 }, { type: "floorChanged", depth: 3 }];
  const card = railCardFor("move", events, [], {});
  assert.ok(card);
  assert.equal(card.title, "FLOOR 3");
  assert.equal(card.iconKey, "descent");
  assert.equal(card.tone, "odd");
  assert.equal(card.hold, RAIL_HOLD.floor);
  assert.equal(card.lines.length, 1);
  assert.match(card.lines[0].text, /floor 3/i);
});

// ─── Test 9: railCardFor — dayBegan/leveled {n} resolution, nothing-to-show ─

test("railCardFor: dayBegan resolves {n} from event.day; a bare moved dispatch yields null; findTaken yields a good TAKEN card", () => {
  const dayEvents = [{ type: "dayBegan", day: 4 }];
  const dayCard = railCardFor("move", dayEvents, [], {});
  assert.equal(dayCard.title, "DAY 4");

  assert.equal(railCardFor("move", [{ type: "moved", x: 1, y: 1 }], [], {}), null);

  const findCard = railCardFor("takeFind", [{ type: "findTaken", item: { n: "a rusty key" } }], [], {});
  assert.equal(findCard.title, "TAKEN");
  assert.equal(findCard.tone, "good");
});

// ─── Test 10: railCardFor — camp (rested + dayBegan + wanderingMonster) ───

test("railCardFor: a camp dispatch (rested + dayBegan + wanderingMonster) folds and resolves a non-empty card", () => {
  const events = [{ type: "rested", amount: 4 }, { type: "dayBegan", day: 2 }, { type: "wanderingMonster", hours: 2 }];
  const folded = toastsForAction("camp", events, {}, { limit: Infinity, withIdx: true });
  const card = railCardFor("camp", events, folded, {});
  assert.ok(card);
  assert.ok(card.lines.length >= 2, "rested + wanderingMonster fold, plus the RAIL_DIRECT dayBegan line");
  assert.equal(card.iconKey, null);
});

// ─── Test 11: railLineCard ──────────────────────────────────────────────────

test("railLineCard: builds a single-line card with the given icon default", () => {
  assert.deepEqual(railLineCard("YOU ARE HERE", "For the moment…", "dull", 2200), {
    icon: "·",
    iconKey: null,
    title: "YOU ARE HERE",
    lines: [{ text: "For the moment…", roll: null }],
    tone: "dull",
    hold: 2200,
  });
  assert.equal(railLineCard("T", "L", "good", 3000, "◆").icon, "◆");
  assert.equal(railLineCard("T", "L", "good", 3000, "◆", "teleport").iconKey, "teleport");
});

// ─── Test 11.1: RAIL_FEATURE_ICON (2026-09-17 UAT ruling) ─────────────────

test("RAIL_FEATURE_ICON: frozen, every key is a RAIL_FAMILY key, every value is a FEATURE_ICONS key, the trap/chest/climb/crevice/floor/encounter families are covered", () => {
  assert.ok(Object.isFrozen(RAIL_FEATURE_ICON));
  const keys = Object.keys(RAIL_FEATURE_ICON);
  for (const k of keys) {
    assert.ok(k in RAIL_FAMILY, `RAIL_FEATURE_ICON key "${k}" must be a RAIL_FAMILY key`);
  }
  for (const v of Object.values(RAIL_FEATURE_ICON)) {
    assert.ok(FEATURE_ICONS.includes(v), `RAIL_FEATURE_ICON value "${v}" must be a FEATURE_ICONS key`);
  }
  const pairs = {
    trapSprung: "trap",
    teleported: "teleport",
    oneWayBlocked: "onewaydoor",
    chestLocked: "chest",
    climbedOver: "wall",
    fellClimbing: "wall",
    leaptOver: "crevice",
    fellInGorge: "crevice",
    floorChanged: "descent",
    tableFour: "encounter",
  };
  for (const [k, v] of Object.entries(pairs)) {
    assert.equal(RAIL_FEATURE_ICON[k], v, `RAIL_FEATURE_ICON.${k} should be "${v}"`);
  }
  assert.equal(RAIL_FEATURE_ICON.leveled, undefined);
  assert.equal(RAIL_FEATURE_ICON.joinerJoined, undefined);
});

// ─── Test 12: emptyRail / railPush / railClear ─────────────────────────────

test("emptyRail/railPush/railClear: seq discipline, pending preserved, never mutates the input", () => {
  const empty = emptyRail();
  assert.deepEqual(empty, { seq: 0, card: null, pending: null });

  const withPending = { ...empty, pending: { kind: "joiner" } };
  const card1 = railLineCard("A", "a", "info", 3000);
  const pushed = railPush(withPending, card1);
  assert.equal(pushed.seq, 1);
  assert.equal(pushed.card.seq, 1);
  assert.deepEqual(pushed.pending, { kind: "joiner" }, "pending preserved across a push");
  assert.deepEqual(withPending, { seq: 0, card: null, pending: { kind: "joiner" } }, "input untouched");

  const card2 = railLineCard("B", "b", "info", 3000);
  const pushed2 = railPush(pushed, card2);
  assert.equal(pushed2.seq, 2);
  assert.equal(pushed2.card.seq, 2);

  const cleared = railClear(pushed2);
  assert.equal(cleared.seq, 2, "seq unchanged by a clear");
  assert.equal(cleared.card, null);
  assert.deepEqual(cleared.pending, { kind: "joiner" });
});

// ─── Test 13: railAnnouncement ─────────────────────────────────────────────

test("railAnnouncement: seq-gated, joins title + line text; null/stale card announces nothing", () => {
  assert.deepEqual(railAnnouncement(emptyRail(), 0), { seq: 0, text: "" });

  const card = railLineCard("A TRAP", "Patient as furniture.", "bad", 4200);
  const rail = railPush(emptyRail(), card);
  const ann = railAnnouncement(rail, 0);
  assert.equal(ann.seq, 1);
  assert.equal(ann.text, "A TRAP. Patient as furniture.");

  assert.deepEqual(railAnnouncement(rail, 1), { seq: 0, text: "" }, "a seq not newer than announcedSeq announces nothing");
});

// ─── Phase 37 (GEAR-04): reconciliation copy ───────────────────────────────

test("RAIL_COPY.wornReconciled: title, and the six WORN_SLOTS keys with the exact plural noun-phrases", () => {
  assert.equal(RAIL_COPY.wornReconciled.title, "GEAR");
  assert.deepEqual(RAIL_COPY.wornReconciled.what, {
    ring: "rings on one finger",
    bracelet: "bracelets on one wrist",
    amulet: "amulets on one neck",
    helm: "helms on one head",
    cloak: "cloaks on one back",
    staff: "staves in one hand",
  });
});

test("wornReconcileCard: null/empty/no-bagged reports all yield null", () => {
  assert.equal(wornReconcileCard(null), null);
  assert.equal(wornReconcileCard([]), null);
  assert.equal(wornReconcileCard([{ slot: "ring", worn: "Ring of Power", bagged: [] }]), null, "nothing bagged — nothing to say");
});

test("wornReconcileCard: one bagged extra builds the exact locked-copy card", () => {
  const card = wornReconcileCard([{ slot: "ring", worn: "Ring of Power", bagged: ["Ring of Power"] }]);
  assert.deepStrictEqual(card, {
    title: "GEAR",
    line: "You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now.",
    tone: "dull",
    hold: WORN_RECONCILE_HOLD,
    icon: "▪",
  });
});

test("wornReconcileCard: two bagged extras count as three and join both names", () => {
  const card = wornReconcileCard([{ slot: "ring", worn: "Ring of Power", bagged: ["Ring of Power", "Ring of Power"] }]);
  assert.equal(card.line, "You were wearing three rings on one finger. Physics has filed a complaint — Ring of Power, Ring of Power are in your bag now.");
});

test("wornReconcileCard: multiple slots join with a single space, in report order; an empty-bagged slot in the middle is skipped", () => {
  const card = wornReconcileCard([
    { slot: "ring", worn: "Ring of Power", bagged: ["Ring of Power"] },
    { slot: "cloak", worn: "Cloak of Speed", bagged: [] },
    { slot: "staff", worn: "Rowan Staff", bagged: ["Rowan Staff"] },
  ]);
  assert.equal(
    card.line,
    "You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now. " +
      "You were wearing two staves in one hand. Physics has filed a complaint — Rowan Staff is in your bag now.",
  );
});

test("wornReconcileCard: seven or more extras fall back to the plain digit", () => {
  const bagged = Array(7).fill("Ring of Power");
  const card = wornReconcileCard([{ slot: "ring", worn: "Ring of Power", bagged }]);
  assert.match(card.line, /^You were wearing 8 rings on one finger\./);
});

test("wornReconcileCard never mutates its report argument", () => {
  const report = [{ slot: "ring", worn: "Ring of Power", bagged: ["Ring of Power"] }];
  const before = JSON.parse(JSON.stringify(report));
  wornReconcileCard(report);
  assert.deepStrictEqual(report, before);
});

// ─── Test 14: voice scan ───────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function findBannedTerms(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = text.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}
function walkStrings(node, out) {
  if (typeof node === "string") {
    out.push(node);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) walkStrings(v, out);
  }
  return out;
}

test("voice scan: every RAIL_COPY and RAIL_FAMILY string leaf is non-empty and clear of BANNED", () => {
  const leaves = [...walkStrings(RAIL_COPY, []), ...walkStrings(RAIL_FAMILY, [])];
  assert.ok(leaves.length > 10, "sanity: many string leaves collected");
  for (const leaf of leaves) {
    assert.ok(leaf.length > 0, "every string leaf is non-empty");
    const hits = findBannedTerms(leaf);
    assert.equal(hits.length, 0, `banned term(s) in "${leaf}": ${JSON.stringify(hits)}`);
  }
});

// ─── Test 15: purity ────────────────────────────────────────────────────────

test("rail.js is pure: no window/document/Date.now/localStorage/setTimeout/innerHTML/Math.random in live code", () => {
  const src = url.fileURLToPath(new URL("../../src/browser/rail.js", import.meta.url));
  const raw = fs.readFileSync(src, "utf8");
  // Strip comments before scanning — this is a purity check on executable
  // code, not on prose that happens to mention "window.__mzRail" as the
  // shell's future bridge target (mirrors the plan's own acceptance-criteria
  // pure-check, which strips // and /* */ comments the same way).
  const noLineComments = raw
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  const text = noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  for (const needle of ["window.", "document.", "Date.now", "localStorage", "setTimeout", "innerHTML", "Math.random"]) {
    assert.doesNotMatch(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${needle} must not appear in rail.js`);
  }
});
