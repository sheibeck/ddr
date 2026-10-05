// test/unit/achievements-copy.test.js
//
// Phase 98 plan 02 (ACH-01, ACH-02, ACH-04): the copy contract for the 77
// achievements in content/achievements.js. The name and description go to
// Play Console in the import zip and FREEZE there, so this file holds them
// to Google's import limits, the house rules and the counting rulings of
// 98-CONTEXT "What counts". The in-game unlock line is held to its length,
// its distinctness and, for the 8 revealers, a hint toward the hidden
// achievement it reveals. Every table below (verbatim names, tiered bases,
// ruling pins, hint pins) is spelled as a literal here, never derived from
// the module under test.

import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS } from "../../content/achievements.js";
import { buildCorpus } from "../../tools/lib/voice-corpus.mjs";

const NUMERALS = ["I", "II", "III", "IV"];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
const get = (id) => {
  const a = byId.get(id);
  assert.ok(a, `no catalog entry with id ${id}`);
  return a;
};
const q = (s) => JSON.stringify(s);
const isBlank = (s) => typeof s !== "string" || s.trim() === "";

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

// The user's single names, verbatim (98-CONTEXT "Names").
const VERBATIM_SINGLES = {
  unicorn: "Unicorn!",
  fully_dressed: "Fully Dressed",
  naked_ambition: "Naked Ambition",
  teetotaler: "Teetotaler",
  read_the_label: "Read the Label",
  special_snowflake: "Special Snowflake",
  tourist: "Tourist",
  ether_entombed: "Solid Miscalculation",
  death_falling: "Gravity Wins",
  death_disease: "Terminal Condition",
  death_starvation: "Empty Calories",
  chicken: "Chicken",
  death_trap: "Fatal Misstep",
};

// The user's tiered bases, verbatim: name = base + " " + numeral.
const VERBATIM_BASES = {
  frequent_flier: "Frequent Flier",
  kills_beasts: "Body Count: Beasts",
  kills_demons: "Body Count: Demons",
  kills_humans: "Body Count: Humans",
  kills_lair_beasts: "Body Count: Lair Beasts",
  kills_magical: "Body Count: Magical",
  kills_walking_dead: "Body Count: Walking Dead",
  survivor: "Survivor",
  hoarder: "Hoarder",
  party_animal: "Party Animal",
  human_shields: "Human Shields",
  parlay: "Silver Tongue",
  trap_survivor: "Still Standing",
};

// The 12 names Claude authors, each against the manifest placeholder it
// must not equal.
const AUTHORED_PLACEHOLDERS = {
  race_human: "Human",
  race_elven: "Elven",
  race_dwarven: "Dwarven",
  race_wilmsry: "Wilmsry",
  race_fridgian: "Fridgian",
  race_troll: "Troll",
  class_magic_user: "Magic User",
  class_fighter: "Fighter",
  class_thief: "Thief",
};
const DEPTH_IDS = ["depth_t1", "depth_t2", "depth_t3"];

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;
const normaliseName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

test("names: no entry has an empty name", () => {
  const empty = ACHIEVEMENTS.filter((a) => isBlank(a.name)).map((a) => a.id);
  assert.deepEqual(empty, [], `empty or whitespace-only name on: ${empty.join(", ")}`);
});

test("names: the user's single names are verbatim", () => {
  for (const [id, name] of Object.entries(VERBATIM_SINGLES)) {
    assert.equal(get(id).name, name, `${id}: name must be exactly ${q(name)}, got ${q(get(id).name)}`);
  }
});

test("names: the 13 tiered tracks are the user's base plus I, II, III, IV", () => {
  for (const [track, base] of Object.entries(VERBATIM_BASES)) {
    for (let t = 1; t <= 4; t++) {
      const id = `${track}_t${t}`;
      const want = `${base} ${NUMERALS[t - 1]}`;
      assert.equal(get(id).name, want, `${id}: name must be exactly ${q(want)}, got ${q(get(id).name)}`);
    }
  }
});

test("names: the depth ladder shares one new base (not Depth) plus I, II, III", () => {
  const names = DEPTH_IDS.map((id) => get(id).name);
  const m = /^(.+) I$/.exec(names[0]);
  assert.ok(m, `depth_t1: name must be <base> I, got ${q(names[0])}`);
  const base = m[1];
  assert.notEqual(base.trim().toLowerCase(), "depth", `depth ladder: the base must not be the placeholder Depth, got ${q(base)}`);
  assert.ok(!isBlank(base), "depth ladder: the base must not be empty");
  DEPTH_IDS.forEach((id, i) => {
    const want = `${base} ${NUMERALS[i]}`;
    assert.equal(get(id).name, want, `${id}: name must be ${q(want)} (shared base), got ${q(get(id).name)}`);
  });
});

test("names: the 9 race and class names are authored, never the placeholder", () => {
  for (const [id, placeholder] of Object.entries(AUTHORED_PLACEHOLDERS)) {
    const name = get(id).name;
    assert.ok(!isBlank(name), `${id}: name is empty`);
    assert.notEqual(name.trim().toLowerCase(), placeholder.toLowerCase(), `${id}: name must not be the placeholder ${q(placeholder)}`);
  }
});

test("names: printable ASCII, 1-100 characters, no comma, no double quote, trimmed", () => {
  for (const a of ACHIEVEMENTS) {
    const n = a.name;
    assert.ok(typeof n === "string" && n.length >= 1 && n.length <= 100, `${a.id}: name length ${n.length} outside 1-100: ${q(n)}`);
    assert.match(n, PRINTABLE_ASCII, `${a.id}: name must be printable ASCII: ${q(n)}`);
    assert.ok(!n.includes(","), `${a.id}: name has a comma: ${q(n)}`);
    assert.ok(!n.includes('"'), `${a.id}: name has a double quote: ${q(n)}`);
    assert.equal(n, n.trim(), `${a.id}: name has a leading or trailing space: ${q(n)}`);
  }
});

test("names: unique case-insensitively and after normalising", () => {
  const seenLower = new Map();
  const seenNorm = new Map();
  for (const a of ACHIEVEMENTS) {
    const lower = a.name.toLowerCase();
    const norm = normaliseName(a.name);
    assert.ok(norm !== "", `${a.id}: name normalises to nothing: ${q(a.name)}`);
    assert.ok(!seenLower.has(lower), `${a.id}: name ${q(a.name)} repeats ${seenLower.get(lower)} case-insensitively`);
    assert.ok(!seenNorm.has(norm), `${a.id}: name ${q(a.name)} normalises to ${q(norm)}, same as ${seenNorm.get(norm)}`);
    seenLower.set(lower, a.id);
    seenNorm.set(norm, a.id);
  }
});

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

const THOUSANDS_SEPARATOR = /\d[,. ]\d{3}(?!\d)/;
const HYPHEN_BETWEEN_DIGITS = /\d\s*-\s*\d/;
const LEVEL_WORD = /\blevels?\b/i;
const US_SPELLING = /\b(?:armor|honor|rumor|favor|color|humor|behavior|valor)(?:s|ed|ing)?\b/i;
const STANDALONE_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;
const RETIRED_TITLE = /\bMaze\s?world\b|\bMaze[\s-]?Master\b/i;
const NOT_WILMST = /\b(?:coins?|gold)\b/i;

test("descriptions: no entry has an empty description", () => {
  const empty = ACHIEVEMENTS.filter((a) => isBlank(a.description)).map((a) => a.id);
  assert.deepEqual(empty, [], `empty or whitespace-only description on: ${empty.join(", ")}`);
});

test("descriptions: Play limits (20-500 characters, printable ASCII, no comma, no double quote, no line break)", () => {
  for (const a of ACHIEVEMENTS) {
    const d = a.description;
    assert.ok(d.length >= 20 && d.length <= 500, `${a.id}: description length ${d.length} outside 20-500: ${q(d)}`);
    assert.match(d, PRINTABLE_ASCII, `${a.id}: description must be printable ASCII on one line: ${q(d)}`);
    assert.ok(!d.includes(","), `${a.id}: description has a comma: ${q(d)}`);
    assert.ok(!d.includes('"'), `${a.id}: description has a double quote: ${q(d)}`);
    assert.equal(d, d.trim(), `${a.id}: description has a leading or trailing space: ${q(d)}`);
  }
});

test("descriptions: house number rules (no thousands separator, no hyphen range, never level)", () => {
  for (const a of ACHIEVEMENTS) {
    const d = a.description;
    assert.doesNotMatch(d, THOUSANDS_SEPARATOR, `${a.id}: write numbers without a thousands separator (2000 not 2,000): ${q(d)}`);
    assert.doesNotMatch(d, HYPHEN_BETWEEN_DIGITS, `${a.id}: no hyphen between digits (write "5 to 10"): ${q(d)}`);
    assert.doesNotMatch(d, LEVEL_WORD, `${a.id}: say floor, never level: ${q(d)}`);
  }
});

test("descriptions: house words (British spelling, HP not WP, wilmst not coin or gold, no retired title)", () => {
  for (const a of ACHIEVEMENTS) {
    const d = a.description;
    assert.doesNotMatch(d, US_SPELLING, `${a.id}: house spelling is British (armour, honour, colour): ${q(d)}`);
    assert.doesNotMatch(d, STANDALONE_WP, `${a.id}: say HP, never WP: ${q(d)}`);
    assert.doesNotMatch(d, NOT_WILMST, `${a.id}: the currency is wilmst: ${q(d)}`);
    assert.doesNotMatch(d, RETIRED_TITLE, `${a.id}: Game Master or Dungeon Master only: ${q(d)}`);
  }
});

test("descriptions: each entry with a threshold states it in plain digits", () => {
  for (const a of ACHIEVEMENTS) {
    if (a.threshold === null) continue;
    const re = new RegExp(`(?<![\\d,.])${a.threshold}(?![\\d,.]\\d|\\d)`);
    assert.match(a.description, re, `${a.id}: description must state its threshold ${a.threshold} in plain digits: ${q(a.description)}`);
  }
});

// Ruling pins: { must: [regex], mustNot: [regex] } per entry id, or per
// track prefix (a key ending in "_" covers every id that starts with it).
const KILL_SOLO = [/\byourself\b/i, /\bpersonally\b/i, /\balone\b/i, /\bsingle-handed/i, /\bsolo\b/i];
const ABANDON_RULING = [/abandon/i, /\b(?:not|never|don't|doesn't|won't)\b/i];
const raceOrClass = (word) => ({ must: [/\bfloor 5\b/, word] });

const DESCRIPTION_PINS = {
  kills_beasts_: { must: [/\bBeasts\b/], mustNot: KILL_SOLO },
  kills_demons_: { must: [/\bDemons\b/], mustNot: KILL_SOLO },
  kills_humans_: { must: [/\bHumans\b/], mustNot: KILL_SOLO },
  kills_lair_beasts_: { must: [/\bLair Beasts\b/], mustNot: KILL_SOLO },
  kills_magical_: { must: [/\bMagical\b/], mustNot: KILL_SOLO },
  kills_walking_dead_: { must: [/\bWalking Dead\b/, /\bTurn Undead\b/], mustNot: KILL_SOLO },
  human_shields_: { must: [/\bJoiner/, /\bfight/i, /murder|Cutthroat/i] },
  party_animal_: { must: [/\bJoiner/] },
  parlay_: { must: [/\bparleys?\b/i] },
  trap_survivor_: { must: [/\btrap/i] },
  frequent_flier_: { must: ABANDON_RULING },
  special_snowflake: { must: [...ABANDON_RULING, /\bfloor 1\b/] },
  tourist: { must: [/\bsub-?class/i, /\b24\b/, /\bdelve/i] },
  survivor_: { must: [/\bdays?\b/i, /\b(?:one|single) run\b/i] },
  hoarder_: { must: [/\bwilmst\b/, /\bat once\b/i] },
  hoarder_t2: { must: [/\bMedium bag\b/] },
  hoarder_t3: { must: [/\bLarge bag\b/] },
  hoarder_t4: { must: [/\bEnormous bag\b/] },
  depth_: { must: [/\bfloor\b/i] },
  unicorn: { must: [/\bfloor\b/i] },
  race_human: raceOrClass(/\bHuman\b/),
  race_elven: raceOrClass(/\b(?:Elven|Elf)\b/),
  race_dwarven: raceOrClass(/\b(?:Dwarven|Dwarf)\b/),
  race_wilmsry: raceOrClass(/\bWilmsry\b/),
  race_fridgian: raceOrClass(/\bFridgian\b/),
  race_troll: raceOrClass(/\bTroll\b/),
  class_magic_user: { must: [/\bfloor 5\b/, /\bsub-?class/i, /\bMagic User\b/] },
  class_fighter: { must: [/\bfloor 5\b/, /\bsub-?class/i, /\bFighter\b/] },
  class_thief: { must: [/\bfloor 5\b/, /\bsub-?class/i, /\bThief\b/] },
  fully_dressed: { must: [/\bweapon/i, /\barmour\b/i, /\bcloak\b/i, /\bjewel/i, /same moment|same time|at once/i] },
  naked_ambition: { must: [/\bfloor 5\b/, /nothing|no weapon|\bbare\b|\bempty\b|unequip|\bFists\b|without/i] },
  teetotaler: {
    must: [/\bfloor 5\b/, /\bhealing potion/i],
    mustNot: [/any potion/i, /every potion/i, /all potions/i, /no potions/i],
  },
  read_the_label: { must: [/\bpotion/i] },
  chicken: {
    must: [/\bflee|\bfled\b|\bescape/i, /\b10\b/],
    mustNot: [/any escape/i, /every escape/i, /all escapes/i, /any flee/i],
  },
  death_trap: { must: [/\btrap/i] },
  death_falling: { must: [/\bfall|\bfell\b/i, /\bwall/i, /\bleap|\bcrevice|\bgap\b|\bjump/i] },
  ether_entombed: { must: [/\bwall/i, /\bCloak\b|\bEther\b|[Ee]ntomb/] },
  death_starvation: { must: [/starv/i] },
  death_disease: { must: [/\bDisease\b/, /\bPoison\b/, /\b1 HP\b/], mustNot: [/\bWP\b/i] },
};

const pinsFor = (id) =>
  Object.entries(DESCRIPTION_PINS)
    .filter(([key]) => (key.endsWith("_") ? id.startsWith(key) : id === key))
    .map(([key, pin]) => [key, pin]);

test("descriptions: every pin key matches at least one catalog entry", () => {
  for (const key of Object.keys(DESCRIPTION_PINS)) {
    const hits = ACHIEVEMENTS.filter((a) => (key.endsWith("_") ? a.id.startsWith(key) : a.id === key));
    assert.ok(hits.length > 0, `ruling pin ${key} matches no catalog id`);
  }
});

test("descriptions: each stays true to its counting ruling (ruling pins)", () => {
  for (const a of ACHIEVEMENTS) {
    for (const [key, pin] of pinsFor(a.id)) {
      for (const re of pin.must ?? []) assert.match(a.description, re, `${a.id} (pin ${key}): description must match ${re}: ${q(a.description)}`);
      for (const re of pin.mustNot ?? []) assert.doesNotMatch(a.description, re, `${a.id} (pin ${key}): description must not match ${re}: ${q(a.description)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

// The 8 revealers (98-CONTEXT "Hidden achievements and who reveals them"):
// revealer id -> [hidden id it reveals, hint pin its line must match].
const HINT_PINS = {
  fully_dressed: ["naked_ambition", /naked|nothing|\bnone\b|\bbare\b|\bempty\b|undress|unequip|without/i],
  teetotaler: ["read_the_label", /potion|bottle|label|drink|\bsip|swig|vial/i],
  trap_survivor_t1: ["death_trap", /trap|\bstep|\btile|flagstone|floor|click/i],
  survivor_t1: ["death_starvation", /food|ration|\beat|meal|lunch|hungry|starv|stomach|snack/i],
  depth_t1: ["death_falling", /fall|drop|\bdown\b|ground|gravity|plunge|leap|crevice/i],
  death_falling: ["ether_entombed", /\bwall|\brock|\bstone|solid|cloak|entomb|inside|ground/i],
  frequent_flier_t1: ["death_disease", /disease|poison|\bill\b|sick|fever|ailment|\bslow|lingering|\b1 HP\b/i],
  parlay_t1: ["chicken", /\brun\b|\bflee|\bfeet\b|\blegs\b|\bbolt|coward|chicken|escape|\bdash/i],
};

test("lines: no entry has an empty line", () => {
  const empty = ACHIEVEMENTS.filter((a) => isBlank(a.line)).map((a) => a.id);
  assert.deepEqual(empty, [], `empty or whitespace-only line on: ${empty.join(", ")}`);
});

test("lines: 1-140 characters, trimmed, one line, not the entry's own name or description", () => {
  for (const a of ACHIEVEMENTS) {
    const l = a.line;
    assert.ok(typeof l === "string" && [...l].length >= 1 && [...l].length <= 140, `${a.id}: line length ${[...l].length} outside 1-140: ${q(l)}`);
    assert.equal(l, l.trim(), `${a.id}: line has a leading or trailing space: ${q(l)}`);
    assert.ok(!/[\r\n]/.test(l), `${a.id}: line has a line break: ${q(l)}`);
    assert.notEqual(l, a.name, `${a.id}: line repeats the name`);
    assert.notEqual(l, a.description, `${a.id}: line repeats the description`);
  }
});

test("lines: Special Snowflake's line is the user's, character for character", () => {
  assert.equal(get("special_snowflake").line, "You're a special snowflake.");
});

test("lines: the hint-pin table is exactly the catalog's revealers", () => {
  const revealers = ACHIEVEMENTS.filter((a) => a.reveals.length > 0).map((a) => [a.id, a.reveals.join("+")]);
  const pinned = Object.entries(HINT_PINS).map(([id, [hidden]]) => [id, hidden]);
  const sort = (xs) => [...xs].sort((x, y) => x[0].localeCompare(y[0]));
  assert.deepEqual(sort(revealers), sort(pinned));
});

test("lines: each revealer's line hints toward the hidden achievement it reveals", () => {
  for (const [id, [hidden, pin]] of Object.entries(HINT_PINS)) {
    assert.match(get(id).line, pin, `${id} reveals ${hidden}: its line must hint (${pin}): ${q(get(id).line)}`);
  }
});

// ---------------------------------------------------------------------------
// Distinctness and the corpus
// ---------------------------------------------------------------------------

test("distinctness: 77 distinct names, descriptions and lines", () => {
  for (const field of ["name", "description", "line"]) {
    const seen = new Map();
    for (const a of ACHIEVEMENTS) {
      const v = a[field];
      assert.ok(!seen.has(v), `${a.id}: ${field} ${q(v)} repeats ${seen.get(v)}`);
      seen.set(v, a.id);
    }
    assert.equal(seen.size, 77, `${field}: expected 77 distinct values`);
  }
});

test("corpus: the voice inventory holds 231 non-empty achievement copy entries", async () => {
  const { entries } = await buildCorpus();
  const ach = entries.filter((e) => String(e.key).startsWith("bank:ACHIEVEMENTS."));
  assert.equal(ach.length, 231, `expected 231 bank:ACHIEVEMENTS entries, got ${ach.length}`);
  const blank = ach.filter((e) => !e.texts.some((t) => typeof t === "string" && t.trim() !== "")).map((e) => e.key);
  assert.deepEqual(blank, [], `corpus entries with no text: ${blank.slice(0, 10).join(", ")}${blank.length > 10 ? " ..." : ""}`);
});
