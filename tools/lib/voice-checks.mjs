// tools/lib/voice-checks.mjs
//
// Phase 79 (ROLL-04, VOX-05), 79-01: the checks every rewrite plan drives to
// zero for its own lines, run over the narration corpus
// (tools/lib/voice-corpus.mjs#buildCorpus):
//   - ROLL_UNDER_PATTERNS: roll-under phrasing (ROLL-04);
//   - HYGIENE_RULES: rendering leaks and wrong characters;
//   - scanTwins: a number the rail line prints that its Oracle twin lacks;
//   - scanSafety: the family-friendly word list (content/safety-wordlist.js)
//     by the safety scan's own word-boundary rule and allowlist;
//   - validateLedgers: the why-ledger rows (docs/narrative-pass/why/*.json).
//
// ROLL-04 (79-CONTEXT, user accepted 2026-09-25): "Where the die is FIXED
// (d20 checks, d10 locks/climbs), text states the Phase 74 range format:
// 'foes find you only on a 20 (19–20 if you insulted them)', 'Weaken: they
// hit only on 18–20'. Where the die SCALES with level (the hero's strike
// die d20→d6), text speaks in faces: 'only your die's top face lands', 'one
// face better'." And: "A DOC-SYNCED TEST scans every player-facing string
// … for roll-under patterns ('1–N' as a to-hit range, 'need N', 'natural
// 1', 'N or under/less', '−N on to-hit') and fails on any."
//
// THE ROLL-HIGH CONVENTION. Every check is roll-high since Phase 73: a
// higher face is always better, so a 1 is always the worst face. A MISHAP on
// a low face ("a natural 1 fumbles the pick", "a scroll fumbles on 1–3") is
// therefore canon phrasing and stays legal; only a low face named as the
// way to SUCCEED (hit, find, open, crit) is roll-under.
//
// Every pattern and rule carries its own violation and clean fixtures; the
// test (test/unit/voice-corpus.test.js) and `--self-test` run each against
// every dash variant (hyphen-minus, U+2013, U+2014, U+2212), the number
// words one to six and upper case, so a pattern can neither go blind nor
// start firing on the phrasing the rule asks for.
//
// EXCEPTIONS. ROLL_PHRASING_EXCEPTIONS and HYGIENE_EXCEPTIONS are
// `{ key, match, reason }` lists (match: a regex source tested against the
// line). A rewrite plan fixes its lines rather than adding exceptions; 79-12
// prunes both lists for rot at the phase close.
//
// Node built-ins only.

import fs from "node:fs";
import path from "node:path";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { SURFACES, REPO_ROOT, normalizeText } from "./voice-corpus.mjs";

// ---------------------------------------------------------------------------
// Roll-under patterns
// ---------------------------------------------------------------------------

export const DASHES = Object.freeze(["-", "–", "—", "−"]);
export const NUMBER_WORDS = Object.freeze(["one", "two", "three", "four", "five", "six"]);

const NUM = "(?:\\d+|one|two|three|four|five|six)";
const LOW = "(?:[1-9]|one|two|three|four|five|six)";
const DASH = "[-\\u2013\\u2014\\u2212]";

/** The ROLL-04 examples themselves: every pattern must pass all of them. */
export const ROLL_HIGH_CLEAN = Object.freeze([
  "foes find you only on a 20 (19–20 if you insulted them)",
  "Weaken: they hit only on 18–20",
  "only your die's top face lands",
  "one face better",
  "Roll 17 vs 18–20: a miss.",
]);

const pat = (id, catches, source, violation, clean) => Object.freeze({ id, catches, source, flags: "i", violation: Object.freeze(violation), clean: Object.freeze(clean) });

export const ROLL_UNDER_PATTERNS = Object.freeze([
  pat(
    "need-face",
    "a need phrase with a face count (\"foes need a 1 to hit\")",
    `\\bneeds?\\s+(?:an?\\s+)?${NUM}\\b(?!\\s*(?:\\+|${DASH}|or\\s+(?:better|higher|more|above)\\b|more\\b|better\\b))(?=\\s*(?:$|[.,;:)!?]|(?:to|on|if|and|or)\\b))`,
    ["foes need a 1 to hit", "enemies need a 1", "they need a 3 to hit, d4+1 rounds", "you need a two to find it"],
    ["you need 2 rations to camp", "you need a 15 or better to hit", "they need two better", "needs level 3; you are 2", "you need 3 more squares"],
  ),
  pat(
    "natural-low",
    "a natural-low success phrase (\"need a natural 1 to find you\"); a mishap on a 1 is roll-high canon",
    `\\bneeds?\\s+(?:an?\\s+)?natural\\s+(?:1|one)\\b|\\bnatural\\s+(?:1|one)\\s+to\\s+(?:hit|find|land|spot|see|strike|succeed|catch)\\b`,
    ["foes need a natural 1 to find you", "they need a natural 1", "a natural 1 to hit"],
    ["a natural 1 fumbles the pick", "on a natural 1 the scroll bites back", "a mishap on a 1"],
  ),
  pat(
    "low-range",
    "a low range tied to a roll (\"1–5 on a d10\", \"a 1–2 if you insulted them\")",
    `\\b(?:an?\\s+)?(?:1|one)\\s*${DASH}\\s*${NUM}\\b(?=\\s+(?:on\\s+(?:an?\\s+)?d\\d+|if\\b|to\\s+(?:hit|find|open|land)\\b))`,
    ["1–5 on d10 against any lock", "a 1–2 if you insulted them", "1–7 on a d10 to open a lock", "1–3 to hit"],
    ["a scroll fumbles on 1–3", "17 vs 1–20", "they hit only on 18–20"],
  ),
  pat(
    "or-under",
    "N or under / less / lower / below (a stat threshold such as \"wit of 6 or under\" is not a roll)",
    `(?<!\\b(?:wit|intel(?:ligence)?|level|IQ)(?:\\s+of)?\\s+)\\b${NUM}\\s+or\\s+(?:under|less|lower|below)\\b`,
    ["hits on a 5 or under", "roll 3 or less to spot it", "a two or lower finds you"],
    ["anything with wit of 6 or under declines", "foes of level 3 or lower", "a 15 or better"],
  ),
  pat(
    "face-to-hit",
    "a face count to hit (\"a 5 to hit\", \"2 to hit\"); a signed modifier (\"+2 to hit\", \"−2 to hit\") is Phase 74's display and stays legal",
    `(?:\\ban?\\s+|(?<![+\\u2212\\u2013\\u2014\\w.-]))${NUM}\\s+to\\s+(?:hit|land|find|strike|crit)\\b`,
    ["a 5 to hit", "an 8 to land it", "a three to find you", "small: strike as one level lower, 2 to hit"],
    ["+2 to hit", "−2 to hit", "a 15 or better to hit", "one face better to hit"],
  ),
  pat(
    "single-low-face",
    "a single low face that hits or crits (\"hittable only on a 4\", \"criticals on a 2\", \"hits on 5\")",
    `\\b(?:hits?|hittable|crits?|criticals?|strikes?)\\b(?:\\s+[A-Za-z]+){0,2}?\\s+on\\s+(?:an?\\s+)?${LOW}\\b(?!\\s*${DASH})`,
    ["hittable only on a 4", "criticals on a 2", "critical on a 2 when you open a fight", "they hit on a 3 and do half", "hit on a 5 whatever the class", "hits on 5 whatever the class"],
    ["crit only on a 20", "they hit only on 18–20", "you strike on a d6 for 3 rounds", "the die lands on a 4"],
  ),
  pat(
    "penalty-to-hit",
    "a penalty on to-hit (\"−3 on to-hit\")",
    `${DASH}\\s*${NUM}\\s+(?:on\\s+)?(?:your\\s+|their\\s+|the\\s+)?to${DASH}hit\\b`,
    ["−3 on to-hit", "−2 on your to-hit", "−1 to-hit for the fight"],
    ["−2 to hit", "+2 to hit", "a −2 penalty"],
  ),
  pat(
    "need-better",
    "need(s) N better (\"every foe needs two better\")",
    `\\bneeds?\\s+${NUM}\\s+better\\b`,
    ["every foe needs two better", "you need two better to land it", "They need 2 better."],
    ["one face better", "needs a better weapon", "you need to do better"],
  ),
]);

/**
 * ROLL_PHRASING_EXCEPTIONS — `{ key, match, reason }`: a base hit that is
 * not a roll phrase and could not be excluded by tightening its pattern
 * without losing a genuine phrase. Calibrated on the phase base in 79-01;
 * pruned for rot by 79-12.
 *
 * 79-12 (the phase close): still empty, on purpose. Every hit the patterns
 * ever found was a genuine roll-under phrase and was rewritten roll-high by
 * its owning plan, so the live corpus reads zero with no exception at all.
 * docs/ROLL-LEDGER.md's `## Phase 79 roll phrasing closure (ROLL-04)`
 * Exceptions table mirrors this list, and test/unit/roll-phrasing.test.js
 * fails when the two differ, when an entry stops matching a live string, or
 * when a live string trips a pattern outside this list. An entry here is
 * only ever for a phrase that is not about a roll.
 */
export const ROLL_PHRASING_EXCEPTIONS = Object.freeze([]);

// ---------------------------------------------------------------------------
// Hygiene rules
// ---------------------------------------------------------------------------

/** PLAYER_WP, copied from test/unit/hp-not-wp.test.js (sameness self-checked). */
export const PLAYER_WP_SOURCE = "(?<![\\w.$-])(wp|WP)(?![\\w:])";

const hyg = (id, catches, source, flags, violation, clean, extra = {}) => Object.freeze({ id, catches, source, flags, violation: Object.freeze(violation), clean: Object.freeze(clean), ...extra });

export const HYGIENE_RULES = Object.freeze([
  hyg("leaked-value", "a leaked undefined, NaN, null or [object …]", "\\bundefined\\b|\\bNaN\\b|\\bnull\\b|\\[object\\b", "",
    ["You gain undefined hp.", "NaN squares to go", "[object Object] falls over"],
    ["You gain 3 hp.", "Nothing left.", "an object lesson"]),
  hyg("unfilled-token", "an unfilled {token} outside a template entry", "\\{[A-Za-z_]\\w*\\}", "",
    ["Here lies {name}.", "{foe} wins."],
    ["Here lies Sera.", "a {} pair"], { skipTemplates: true }),
  hyg("ascii-sign", "an ASCII hyphen-minus used as a sign before a digit (U+2212 belongs)", "(?:^|[\\s(\\[:,/—–])-\\d", "",
    ["-15 HP", "The dice decide — -15 HP.", "armour (-2)"],
    ["−15 hp", "3–4 feet", "d4-1 damage"]),
  hyg("hyphen-range", "a hyphen range between digits (U+2013 belongs)", "(?<![\\w.])\\d+-\\d+(?![\\w.])", "",
    ["3-4 feet", "roll 1-5 on d10"],
    ["3–4 feet", "d4-1 damage", "floor 2"]),
  hyg("standalone-wp", "a standalone wp/WP (the PLAYER_WP pattern: HP not WP)", PLAYER_WP_SOURCE, "",
    ["75 WP", "+d10+2 wp", "(WP)", " wp/day"],
    ["c.wp", "maxWP", "cb-foe-wp", "viewport", "75 hp"]),
  hyg("retired-name", "the retired working title or \"Maze Master\" (the Dungeon or Game Master now)", "\\bMazeworld\\b|\\bMaze[\\s-]?Master\\b", "i",
    ["Welcome to Mazeworld.", "The Maze Master frowns."],
    ["The Dungeon Master frowns.", "Delve, Die, Repeat", "The Game Master's notes"]),
  // Calibrated on the phase base: a lone "?" is the house unknown-value
  // marker (rollRange.js prints "?" for a missing field, as in "Lock: ? vs ?",
  // and FOE_DETAILS_COPY.hpUnknown reads "HP ?"), so a space before a "?"
  // standing on its own is a token, not a typo; the rule checks . , ; : !
  // and a "?" glued to the end of a word run ("Really ?word" never occurs).
  // Texts are whitespace-collapsed, so the doubled-space half only bites on
  // a string checked directly (the fixtures, a ledger's after).
  hyg("spacing", "doubled spaces, or a space before . , ; : ! (a lone ? is the unknown-value marker)", "\\S {2,}\\S| [.,;:!](?=\\s|$)", "",
    ["You win  again.", "You win .", "Well , fine.", "Stop !"],
    ["You win. Again.", "Floor 3 · day 2", "… of …", "HP ?", "Lock: ? vs ?"]),
  // 79-12 (the house-spelling decision, docs/narrative-pass/README.md): the
  // player reads "armour". Counted on the live corpus at dispatch base
  // 1968d3e8, "armour" held 64 occurrences in 39 keys against "armor"'s 31
  // in 22, so the majority won; the rest of the -our family was already
  // British by the same count (honour 2 / honor 1, rumour 3 / rumor 1,
  // favour 2, colour 1, no US form), so the rule holds the whole family.
  // Item names that carry the word are proper nouns and ids that reach
  // saved state (the Cloak of Armor, the Faerie's Magic Armor gift), so
  // they keep their spelling; code identifiers (armorSoaked, c.armor) never
  // match the word boundary.
  hyg("house-spelling", "a US -or spelling in player copy (the house spelling is British: armour, honour, rumour, favour, colour; the Cloak of Armor and Magic Armor are names)", "(?<!\\bCloak of |\\bMagic |[.$-])\\b(?:armor|honor|rumor|favor|color|humor|behavior|valor)(?:s|ed|ing)?\\b", "i",
    ["Your armor takes 2 so you do not have to.", "ARMOR RATING", "Heavy armor gives you away.", "The bag declines the honor.", "light as a rumor", "colored glass"],
    ["Your armour takes 2 so you do not have to.", "ARMOUR RATING", "Cloak of Armor", "Magic Armor", "armorSoaked", "c.armor", "The bag declines the honour.", "favourite"]),
]);

const exc = (key, rule, match, reason) => Object.freeze({ key, rule, match, reason });

/**
 * HYGIENE_EXCEPTIONS — `{ key, rule, match, reason }`: base hits that are
 * artifacts of the synthetic events or are not the leak the rule targets.
 * Calibrated on the phase base in 79-01; pruned for rot by 79-12.
 *
 * 79-12 pruned the four bare-variant and soaked-object entries
 * (itemEffectStarted and braceHeld, Oracle and rail): their owning plans
 * gave the builders fallbacks, so the leaks they excused no longer render
 * (test/voice/narrative-hygiene.test.js fails on an entry that matches no
 * live text). It also dropped the credits line's "Mazeworld rulebook"
 * entry: that line lived in mazeworld.html's never-shown rulebook-notes
 * section, which 79-12 deleted.
 */
export const HYGIENE_EXCEPTIONS = Object.freeze([
  // 79-12 (handed on by 79-05): the two bestiary notes Phase 18's D-14 holds
  // byte-identical to the prototype (fixture-exposed rows, pinned in
  // test/unit/content-tables.test.js). The player never reads them raw:
  // every surface that prints a note (the foe card meta line, the long-press
  // foe card) routes it through src/browser/combatPanel.js#playerNote, which
  // rewrites the token to HP (pinned in test/unit/combatPanel.test.js;
  // test/voice/narrative-hygiene.test.js proves the rendering is clean).
  exc("content:BESTIARY.Bat/Rat.sp.note", "standalone-wp", "^two attacks, 1 wp each$", "prototype-identical note (Phase 18 D-14); every surface renders it through combatPanel.js#playerNote, which prints HP"),
  exc("content:BESTIARY.Viper.sp.note", "standalone-wp", "^venom: 2 wp a round for d10 rounds$", "prototype-identical note (Phase 18 D-14); every surface renders it through combatPanel.js#playerNote, which prints HP"),
  exc("raw:engine/difficulty.js#DOT_MIX_FAMILIES", "ascii-sign", "^-\\d+ HP$", "an ENCOUNTER_TABLES cell used as a dispatch key inside the engine; never printed from here"),
]);

// ---------------------------------------------------------------------------
// Fixture expansion (the teeth)
// ---------------------------------------------------------------------------

/**
 * fixtureVariants(s) — s, s with every standalone digit 1-6 as its word,
 * each of those with every dash replaced by each dash variant, and all of
 * them in upper case.
 */
export function fixtureVariants(s) {
  const bases = [s, s.replace(/(?<![\w.])([1-6])(?![\w.])/g, (_, d) => NUMBER_WORDS[Number(d) - 1])];
  const out = new Set();
  for (const b of bases) {
    out.add(b);
    if (/[-–—−]/.test(b)) for (const d of DASHES) out.add(b.replace(/[-–—−]/g, d));
  }
  for (const v of [...out]) out.add(v.toUpperCase());
  return [...out];
}

const compile = (r) => new RegExp(r.source, r.flags);

/**
 * checkFixtures() — every roll-under pattern and hygiene rule against its
 * own fixtures: roll-under ones across fixtureVariants (and ROLL_HIGH_CLEAN
 * as extra clean fixtures), hygiene ones as written (their violations ARE
 * specific characters). Returns a list of failures; empty means every check
 * has teeth both ways.
 */
export function checkFixtures() {
  const failures = [];
  for (const p of ROLL_UNDER_PATTERNS) {
    const re = compile(p);
    for (const v of p.violation) for (const x of fixtureVariants(v)) if (!re.test(x)) failures.push(`roll-under ${p.id}: violation not caught: ${JSON.stringify(x)}`);
    for (const c of [...p.clean, ...ROLL_HIGH_CLEAN]) for (const x of fixtureVariants(c)) if (re.test(x)) failures.push(`roll-under ${p.id}: clean line caught: ${JSON.stringify(x)}`);
  }
  for (const h of HYGIENE_RULES) {
    const re = compile(h);
    for (const v of h.violation) if (!re.test(v)) failures.push(`hygiene ${h.id}: violation not caught: ${JSON.stringify(v)}`);
    for (const c of h.clean) if (re.test(c)) failures.push(`hygiene ${h.id}: clean line caught: ${JSON.stringify(c)}`);
  }
  return failures;
}

/**
 * playerWpSameness(root) — the standing-wp rule must be the same regex as
 * test/unit/hp-not-wp.test.js's PLAYER_WP. Returns { ok, theirs, ours }.
 */
export function playerWpSameness(root = REPO_ROOT) {
  const src = fs.readFileSync(path.join(root, "test", "unit", "hp-not-wp.test.js"), "utf8");
  const m = src.match(/const PLAYER_WP = \/(.+)\/;\s*$/m);
  const theirs = m ? m[1] : null;
  return { ok: theirs === PLAYER_WP_SOURCE, theirs, ours: PLAYER_WP_SOURCE };
}

// ---------------------------------------------------------------------------
// Scans over the corpus
// ---------------------------------------------------------------------------

const excepted = (list, key, text, ruleId) => list.some((x) => x.key === key && (!x.rule || x.rule === ruleId) && new RegExp(x.match).test(text));

/** scanRollUnder(corpus) — [{ rule, key, owner, surface, text, match }]. */
export function scanRollUnder(corpus, { exceptions = ROLL_PHRASING_EXCEPTIONS } = {}) {
  const hits = [];
  const compiled = ROLL_UNDER_PATTERNS.map((p) => [p, compile(p)]);
  for (const e of corpus.entries) {
    for (const text of e.texts) {
      for (const [p, re] of compiled) {
        const m = text.match(re);
        if (m && !excepted(exceptions, e.key, text, p.id)) hits.push({ rule: p.id, key: e.key, owner: e.owner, surface: e.surface, text, match: m[0] });
      }
    }
  }
  return hits;
}

/** scanHygiene(corpus) — [{ rule, key, owner, surface, text, match }]. */
export function scanHygiene(corpus, { exceptions = HYGIENE_EXCEPTIONS } = {}) {
  const hits = [];
  const compiled = HYGIENE_RULES.map((r) => [r, compile(r)]);
  for (const e of corpus.entries) {
    for (const text of e.texts) {
      for (const [r, re] of compiled) {
        if (r.skipTemplates && e.template) continue;
        const m = text.match(re);
        if (m && !excepted(exceptions, e.key, text, r.id)) hits.push({ rule: r.id, key: e.key, owner: e.owner, surface: e.surface, text, match: m[0] });
      }
    }
  }
  return hits;
}

const numbersOf = (t) => (String(t ?? "").match(/\d+(?:\.\d+)?/g) ?? []);

/**
 * scanTwins(corpus) — per event type, every variant whose rail rendering
 * prints a number its Oracle rendering (same variant) lacks:
 * [{ rule: "twin", key: "rail:<type>", owner, surface, type, variants,
 *    missing, text, oracle }] with the first disagreeing variant as the
 * example. Needs a live corpus (buildCorpus keeps the per-variant
 * renderings; a snapshot loaded from JSON has none).
 */
export function scanTwins(corpus) {
  const hits = [];
  const renderings = corpus.renderings;
  if (!renderings) return hits;
  const byKey = new Map(corpus.entries.map((e) => [e.key, e]));
  for (const [type, r] of [...renderings.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!r.oracle || !r.rail) continue;
    const entry = byKey.get(`rail:${type}`);
    if (!entry) continue;
    let first = null;
    let count = 0;
    for (const [variant, railText] of Object.entries(r.rail)) {
      if (!railText || !(variant in r.oracle)) continue;
      const have = new Set(numbersOf(r.oracle[variant]));
      const missing = [...new Set(numbersOf(railText).filter((n) => !have.has(n)))];
      if (!missing.length) continue;
      count++;
      if (!first) first = { variant, missing, text: railText, oracle: r.oracle[variant] };
    }
    if (count) hits.push({ rule: "twin", key: entry.key, owner: entry.owner, surface: entry.surface, type, variants: count, missing: first.missing, variant: first.variant, text: first.text, oracle: first.oracle, match: first.missing.join(",") });
  }
  return hits;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** scanSafety(corpus) — banned terms by the safety scan's word-boundary rule and allowlist. */
export function scanSafety(corpus, { banned = BANNED, allowlist = ALLOWLIST } = {}) {
  const allow = new Set(allowlist.map((w) => w.toLowerCase()));
  const matchers = banned.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
  const hits = [];
  for (const e of corpus.entries) {
    for (const text of e.texts) {
      for (const { term, re } of matchers) {
        const m = text.match(re);
        if (m && !allow.has(m[0].toLowerCase())) hits.push({ rule: "safety", key: e.key, owner: e.owner, surface: e.surface, text, match: `term #${banned.indexOf(term)}` });
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Why-ledgers
// ---------------------------------------------------------------------------

/** The fixed reasons a ledger row may give (docs/narrative-pass/README.md). */
export const REASONS = Object.freeze(["fact", "natural", "joke", "accurate", "roll-under", "number", "identity", "naming", "hygiene"]);

const LEDGER_FIELDS = Object.freeze(["key", "surface", "trigger", "before", "after", "reasons", "why"]);
const KEY_RE = /^(oracle|rail|bank|content|raw):\S/;
const isBuilderKey = (k) => k.startsWith("oracle:") || k.startsWith("rail:");
/** A builder rendering's skeleton: every number collapsed, so a before taken from a real event still matches its base variant. */
export const skeleton = (t) => normalizeText(t).replace(/[−+-]?\d+(?:\.\d+)?/g, "#");

function textsByKey(corpus) {
  if (!corpus) return new Map();
  if (corpus instanceof Map) return corpus;
  return new Map((corpus.entries ?? []).map((e) => [e.key, e.texts]));
}

function textIn(texts, t, key) {
  if (!texts) return false;
  if (texts.includes(t)) return true;
  // 79-12: a generated source renders one key as several lines (79-03's
  // sub-class and race footers: "Good: …" and "Bad: …"); a row may record
  // the whole footer as the lines joined by a space, exactly as they read.
  if (texts.length > 1 && texts.join(" ") === t) return true;
  if (isBuilderKey(key)) {
    const s = skeleton(t);
    return texts.some((x) => skeleton(x) === s);
  }
  return false;
}

/**
 * readLedgers(dir) — [{ plan, file, rows }] for every <plan>.json in `dir`
 * (none when the directory is missing), sorted by plan id. CRLF and a BOM
 * are tolerated.
 */
export function readLedgers(dir = path.join(REPO_ROOT, "docs", "narrative-pass", "why")) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
      let rows;
      try { rows = JSON.parse(raw); } catch (err) { rows = { parseError: String(err.message) }; }
      return { plan: f.replace(/\.json$/, ""), file: f, rows };
    });
}

/**
 * validateLedgers({ base, current, ledgers }, { checkAfter, coverage }) —
 * a list of error strings (empty = valid). `base` and `current` are corpora
 * (or Map<key, texts>); `ledgers` is readLedgers()'s shape, in plan order.
 *   - every row is well-formed: the seven fields, a key in the key scheme,
 *     a known surface, reasons from REASONS, a non-empty why, and a real
 *     change (before !== after, not both empty);
 *   - `before` is "" (a new line), a base rendering of the key (a builder's
 *     compares number-blind: its base renderings are representative), or
 *     the `after` of an earlier plan's row for the same key;
 *   - with checkAfter, a non-empty `after` of the last plan to touch the key
 *     is a current rendering of it (an earlier plan's superseded after is not
 *     checked);
 *   - with coverage, every key whose texts differ between base and current
 *     (added, removed or changed) has at least one row.
 */
export function validateLedgers({ base, current, ledgers }, { checkAfter = false, coverage = false } = {}) {
  const errors = [];
  const baseTexts = textsByKey(base);
  const currentTexts = textsByKey(current);
  const priorAfters = new Map(); // key -> Set(after) from earlier plans
  const covered = new Set();
  // checkAfter looks at the LAST plan to touch a key: an earlier plan's
  // after, superseded by a later row for the same key, is history.
  const lastPlanByKey = new Map();
  for (const { plan, rows } of ledgers ?? []) {
    if (Array.isArray(rows)) for (const r of rows) if (r && typeof r.key === "string") lastPlanByKey.set(r.key, plan);
  }
  for (const { plan, rows } of ledgers ?? []) {
    if (!Array.isArray(rows)) { errors.push(`${plan}: the ledger is not an array of rows${rows?.parseError ? ` (${rows.parseError})` : ""}`); continue; }
    const thisPlanAfters = [];
    rows.forEach((row, i) => {
      const at = `${plan} row ${i}${row && typeof row.key === "string" ? ` (${row.key})` : ""}`;
      if (!row || typeof row !== "object" || Array.isArray(row)) { errors.push(`${at}: not an object`); return; }
      const missing = LEDGER_FIELDS.filter((f) => !(f in row));
      if (missing.length) { errors.push(`${at}: missing ${missing.join(", ")}`); return; }
      const extra = Object.keys(row).filter((f) => !LEDGER_FIELDS.includes(f));
      if (extra.length) errors.push(`${at}: unknown field ${extra.join(", ")}`);
      if (typeof row.key !== "string" || !KEY_RE.test(row.key)) errors.push(`${at}: key is not in the key scheme`);
      if (!SURFACES.includes(row.surface)) errors.push(`${at}: unknown surface ${JSON.stringify(row.surface)}`);
      for (const f of ["trigger", "before", "after", "why"]) if (typeof row[f] !== "string") errors.push(`${at}: ${f} must be a string`);
      if (typeof row.why === "string" && !row.why.trim()) errors.push(`${at}: empty why`);
      if (!Array.isArray(row.reasons) || !row.reasons.length) errors.push(`${at}: reasons must be a non-empty array`);
      else for (const r of row.reasons) if (!REASONS.includes(r)) errors.push(`${at}: unknown reason ${JSON.stringify(r)}`);
      if (typeof row.before !== "string" || typeof row.after !== "string" || typeof row.key !== "string") return;
      if (row.before === row.after) errors.push(`${at}: before and after are the same`);
      if (row.before !== "") {
        const fromBase = textIn(baseTexts.get(row.key), row.before, row.key);
        const prior = priorAfters.get(row.key);
        const fromEarlier = prior ? textIn([...prior], row.before, row.key) : false;
        if (!fromBase && !fromEarlier) errors.push(`${at}: before is neither a base rendering of the key nor an earlier plan's after`);
      }
      if (checkAfter && lastPlanByKey.get(row.key) === plan && row.after !== "" && !textIn(currentTexts.get(row.key), row.after, row.key)) errors.push(`${at}: after is not in the current corpus`);
      covered.add(row.key);
      thisPlanAfters.push([row.key, row.after]);
    });
    for (const [k, a] of thisPlanAfters) {
      if (!priorAfters.has(k)) priorAfters.set(k, new Set());
      priorAfters.get(k).add(a);
    }
  }
  if (coverage) {
    const keys = new Set([...baseTexts.keys(), ...currentTexts.keys()]);
    for (const k of [...keys].sort()) {
      const a = baseTexts.get(k) ?? [];
      const b = currentTexts.get(k) ?? [];
      const same = a.length === b.length && a.every((t, i) => t === b[i]);
      if (!same && !covered.has(k)) errors.push(`coverage: ${k} changed between base and current with no ledger row`);
    }
  }
  return errors;
}
