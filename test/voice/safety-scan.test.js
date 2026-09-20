// test/voice/safety-scan.test.js
//
// VOX-02 — the EXHAUSTIVE family-friendly safety guardrail. This is a STANDING
// tripwire (like test/roundtrip/* and test/unit/formatEventsCoverage.test.js):
// it renders the COMPLETE closed corpus of player-facing authored copy and
// asserts none of it contains a banned term, so procedural combinatorics can
// never ship profanity / slurs / sexual / gore copy to a "PEGI 3 / Everyone"
// store listing (.claude/CLAUDE.md's family-friendly tone constraint;
// threat T-05-04).
//
// ── WHAT IT SCANS (auto-covering, driven off the exported structures) ───────
//   1. src/browser/eventNarration.js EVENT_NARRATION — the ~162-entry voice
//      table (the delivered VOX-01 voice system). The scan iterates the
//      EXPORTED map, so a new narration entry is covered automatically — add
//      an entry, it is scanned, no test edit required. Each entry is an
//      (e) => htmlString builder; the scan invokes every builder across a set
//      of branch-discriminating event variants AND injects every closed-vocab
//      token value into its interpolated fields, then strips the <span> markup
//      and scans the visible words.
//   2. content/epitaphs.js EPITAPHS (every bucket) + CAUSE_TEXT — the death
//      copy, whose {tokens} are filled from the SAME closed vocabularies the
//      engine fills them from, every value in every template.
//   3. Every other authored player-facing flavor bank: flavor.js
//      (RACE/CLASS/SUB notes, temperaments, motives, phobias), the item `txt`
//      fields (spells / potions / skills / jewelry / cloaks / staves), and the
//      authored proper-noun banks (creatures, names, subclasses, blade names,
//      insanity outcomes, encounter cells).
//
// ── HOW IT MATCHES ──────────────────────────────────────────────────────────
// Case-insensitive, WORD-BOUNDARY (\b…\b) matching against every term in
// content/safety-wordlist.js's BANNED corpus, skipping any whole-word match
// present in that file's ALLOWLIST. Word boundaries make the scan
// Scunthorpe-safe on their own ("assassin"/"grass"/"class" never trip on a
// short banned substring); the allowlist then rescues the handful of whole
// words the game genuinely uses that are themselves on a profanity list (the
// "Bastard Sword" weapon, "balls" as fireball projectiles). Two meta-tests
// keep both halves honest:
//   • the closed-vocab SANITY test proves the allowlist is COMPLETE (every
//     collision on real game vocabulary is allowlisted → no false positives);
//   • the LOAD-BEARING test proves the allowlist has no DEAD entries (each one
//     actually rescues a real in-corpus collision → no silent over-permitting).
//
// NOTE (comment discipline): no literal banned word appears anywhere in this
// file — categories are referenced abstractly. The only place literal banned
// terms live is content/safety-wordlist.js's data arrays.

import test from "node:test";
import assert from "node:assert/strict";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
// Phase 25 (FEED-05/narration-line architecture): the LINE_FOR table and the
// fledgling-miss quip corpus are new player-facing authored copy — both are
// scanned alongside EVENT_NARRATION so a new line string or quip is
// voice-checked automatically.
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { MISS_LINES } from "../../src/browser/missLines.js";
import { EPITAPHS, CAUSE_TEXT } from "../../content/epitaphs.js";
import { BESTIARY } from "../../content/bestiary.js";
import { FOE_ABILITIES } from "../../content/foe-abilities.js";
import { NAMES } from "../../content/names.js";
import { RACES } from "../../content/races.js";
import { RACE_NOTE, CLASS_NOTE, SUB_NOTE, TEMPERAMENTS, MOTIVES, PHOBIAS, JOINER_EXIT_LINES, JOINER_MURDER_LINES, JOINER_PARTING_LINES } from "../../content/flavor.js";
import { SPELLS } from "../../content/spells.js";
import { POTIONS } from "../../content/potions.js";
import { FIGHTER_SKILLS, THIEF_SKILLS } from "../../content/skills.js";
import { ABILITIES } from "../../content/abilities.js";
import { JEWELRY, CLOAKS, STAVES, BLADE_NAMES, FAERIE, MISC_MAGIC } from "../../content/treasure-tables.js";
import { INSANITY } from "../../content/misc-tables.js";
import { WEAPONS } from "../../content/weapons.js";
import { ARMORS } from "../../content/armors.js";
import { FOODS } from "../../content/foods.js";
import { ENCOUNTER_TABLES } from "../../content/encounters.js";

// ─── Matching logic (lives HERE, not in the pure-data wordlist) ─────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// One case-insensitive, word-boundary matcher per banned term.
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));

/** Strip HTML tags so only the player-visible words are scanned. */
const stripMarkup = (s) => String(s).replace(/<[^>]*>/g, " ");

/**
 * findBannedTerms(text) — every banned term whose word-boundary match survives
 * the allowlist, as {term, match} tuples. Empty array = clean.
 */
function findBannedTerms(text) {
  const clean = stripMarkup(text);
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = clean.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}

// ─── Closed vocabularies (the token universe the engine can substitute) ─────

const FOE_NAMES = [...new Set(Object.values(BESTIARY).flat(2).map((c) => c.n))];
// DR-name-generator (2026-09-09): NAMES is now a { first, sur } bank per race
// (generative first × surname), so flatten every authored first name AND
// surname/epithet token so the safety scan still covers the full name corpus.
const CHAR_NAMES = Object.values(NAMES).flatMap((p) => [...p.first, ...p.sur]);
const SUBCLASSES = Object.keys(SUB_NOTE);
const RACE_NAMES = Object.keys(RACES);
// Every string value that could ever land in a {token} slot or a builder field.
const TOKEN_VALUES = [...new Set([...FOE_NAMES, ...CHAR_NAMES, ...SUBCLASSES, ...RACE_NAMES, ...MOTIVES])];
// Numeric-ish boundary values, as strings, for numeric tokens.
const NUMERIC_VALUES = ["0", "1", "5", "13", "999"];

// ─── Corpus 1: EVENT_NARRATION (driven off the exported map) ────────────────

// A rich base event carrying every field any builder reads, at safe values.
const BASE_EVENT = {
  side: "approach", hurt: 3, loss: 2, kind: "Poison", charges: 2, max: 5, day: 3,
  amount: 2, cost: 4, hours: 2, reason: "parley", foes: [{ name: "Viper" }], name: "Viper",
  tracked: true, roll: 7, target: "Viper", need: 5, critical: true, dmg: 6, spGained: 5,
  wp: 4, rations: 1, bonus: 2, song: "a tune", count: 2, n: 2, r: 2, member: "the companion",
  spell: "Heal", intel: 5, rounds: 3, rolls: 2, totalDamage: 8, nextEncounter: "encounter",
  might: 3, pool: 50, reflect: true, short: 5, item: { n: "Dagger" }, table: 4,
  result: "something", spells: ["Heal"], what: "a cloak", gift: "Magic Weapon", first: 2,
  mult: 2, remaining: 1, motive: "Blood", level: 2, wpGain: 3, depth: 3, steps: 40, total: 8,
  troll: true, elfOrDwarf: true, untouchable: true,
  // Phase 20 (D-14): fluency annotation on parleyRolled; why on goldGained
  // (distinguishes the rare parley wilmst payout from every other source).
  fluency: 2, why: "parley",
  // Phase 38 (ABIL-01/04): abilityRefused's cooldown/notLowEnough fields,
  // dotTick's generic `by`, lastStandCalled's `attacks`.
  left: 3, have: 10, by: "poisonedEdge", attacks: 3,
};

// Branch-discriminator overrides so every ternary path in every builder renders.
const BRANCH_TOGGLES = [
  {}, { side: "exit" }, { loss: 0 }, { tracked: false }, { wandering: false, foes: [] },
  { reason: "wizard" }, { reason: "descend" }, { reason: "cloaker" }, { reason: "tracked" },
  { critical: false }, { wp: 0 }, { mult: 1 }, { troll: false, elfOrDwarf: false },
  { troll: false, elfOrDwarf: true }, { roll: null }, { amount: 1 }, { untouchable: false },
  // Phase 20 (D-14): both sides of parleyRolled's fluency ternary, goldGained's
  // why ternary, and parleyRefused's wilmsryVsMagical branch.
  { fluency: 0 }, { why: null }, { reason: "wilmsryVsMagical" },
  // Phase 25 (LINE_FOR table / passive-modifier payload): every new reason/flag
  // branch the LINE_FOR builders (and their extended EVENT_NARRATION siblings)
  // read, so each ternary/reason-map path renders under the scan.
  { reason: "pilfer" }, { reason: "acrobat" }, { reason: "woodsman" }, { reason: "noRunes" },
  { reason: "knight" }, { reason: "conArtist" }, { reason: "wilmsry" },
  { why: "pickpocket" }, { pickpocket: true }, { bard: true }, { doubled: "Soldier" },
  { halved: true, wear: 2 }, { soaked: { hide: 2, hardiness: 3, ward: 1 } },
  { needMods: [{ name: "Guard", delta: -1 }] }, { critBy: "cutthroat" }, { soldierCrit: true },
  { quip: "X" }, { untouchable: true },
  { knightBigFoe: true, courtMageTalksFirst: true, samuraiNeverFirst: true, fridgianSlow: true, acuteHearing: true },
  // Phase 36 (JOIN-01): dismissJoiner's three named refusal reasons.
  { reason: "noParty" }, { reason: "inCombat" }, { reason: "badIndex" },
  // Phase 37 (GEAR-03): the notWorn refusal and itemEquipped's additive
  // replaced payload.
  { reason: "notWorn" }, { replaced: { n: "Ring of Power" } },
  // Phase 38 (ABIL-01/04): abilityRefused's own reason register, and fled's
  // new smoke branch.
  { reason: "cooldown" }, { reason: "unknown" }, { reason: "notInCombat" },
  { reason: "noTarget" }, { reason: "notLowEnough" }, { reason: "smoke" },
  // Phase 38 Plan 04 (ABIL-05): the OTHER side of every `e.member ? ... : ""`
  // ternary this plan adds — a hero-cast use (BASE_EVENT's own `member`
  // value covers the Joiner-cast side already).
  { member: null },
  // Phase 40 (SPELL-01/04): dotTick's ice branch (BASE_EVENT's own `by`
  // covers the poison side), Lesser Summon's `lesser` wording, and
  // `weakened`'s fallback wording when no `rounds` payload is present.
  { by: "ice" }, { lesser: true }, { rounds: 0 },
  // Phase 43 (CLAR-01): the nine additive cause-payload keys' own
  // interpolated values, plus lootForfeited's `died` branch and toolUsed's
  // two tool names — every ternary/default this plan's rewrite added.
  { reason: "died" }, { phobia: "Being trapped" }, { penalty: 2 },
  { cost: 25 }, { fee: 25 }, { sub: "Apprentice" },
  { tool: "ladder" }, { tool: "rope" },
  // Phase 43 (CLAR-01/03/05, Plan 02): rationsEaten's/wentHungry's own new
  // branches — the Heft clause, a multi-mouth party, and both shapes of
  // the eaters array (a named Troll member, and an empty array default).
  { heft: true }, { mouths: 3 },
  { eaters: [{ name: "Grunk", race: "Troll", eats: 2 }] }, { eaters: [] },
];

// The builder fields that ever receive an authored token value; injecting every
// closed-vocab value into all of them covers name/foe/subclass seams exhaustively.
const NAME_FIELDS = ["name", "target", "member", "kind", "spell", "result", "what", "song"];

function renderEventVariants(type, fn) {
  const outputs = [];
  // (a) every branch path, base token values
  for (const tog of BRANCH_TOGGLES) {
    try { outputs.push(fn({ type, ...BASE_EVENT, ...tog })); } catch { /* builder guards its own fields */ }
  }
  // (b) every closed-vocab token value injected into every interpolated field
  for (const value of TOKEN_VALUES) {
    const ev = { type, ...BASE_EVENT, foes: [{ name: value }], item: { n: value } };
    for (const f of NAME_FIELDS) ev[f] = value;
    try { outputs.push(fn(ev)); } catch { /* ignore */ }
  }
  return outputs;
}

test("EVENT_NARRATION: every voice builder renders family-friendly across all branches and tokens", () => {
  const offenders = [];
  for (const [type, fn] of Object.entries(EVENT_NARRATION)) {
    assert.equal(typeof fn, "function", `EVENT_NARRATION.${type} should be a builder function`);
    for (const out of renderEventVariants(type, fn)) {
      for (const { term, match } of findBannedTerms(out)) {
        offenders.push(`EVENT_NARRATION.${type} → "${match}" (category term #${BANNED.indexOf(term)}) in: ${stripMarkup(out).trim()}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `Banned copy in event narration:\n${offenders.join("\n")}`);
});

// Phase 25 (narration-line architecture): mirrors the EVENT_NARRATION scan above, but
// LINE_FOR builders return `{ text, tone, priority }` rather than a raw
// HTML string — read `.text` (skip null/falsy results, matching this file's
// own "builder guards its own fields" try/catch convention).
test("LINE_FOR: every line builder renders family-friendly across all branches and tokens", () => {
  const offenders = [];
  for (const [type, fn] of Object.entries(LINE_FOR)) {
    assert.equal(typeof fn, "function", `LINE_FOR.${type} should be a builder function`);
    for (const out of renderEventVariants(type, (ev) => fn(ev, {})?.text)) {
      if (!out) continue;
      for (const { term, match } of findBannedTerms(out)) {
        offenders.push(`LINE_FOR.${type} → "${match}" (category term #${BANNED.indexOf(term)}) in: ${stripMarkup(out).trim()}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `Banned copy in LINE_FOR table:\n${offenders.join("\n")}`);
});

// ─── Corpus 2: EPITAPHS + CAUSE_TEXT (every template × every token value) ────

// Every value a {token} could take: strings + numeric samples, plus a neutral.
const SUBSTITUTIONS = [...TOKEN_VALUES, ...NUMERIC_VALUES, "X"];

function scanTemplate(template, label, offenders) {
  // Static skeleton (tokens blanked) + every token filled with every value.
  const renders = [template.replace(/\{[a-z]+\}/gi, "X"), ...SUBSTITUTIONS.map((v) => template.replace(/\{[a-z]+\}/gi, v))];
  for (const r of renders) {
    for (const { match } of findBannedTerms(r)) {
      offenders.push(`${label} → "${match}" in: ${r}`);
    }
  }
}

test("EPITAPHS + CAUSE_TEXT: every death-copy template is family-friendly for every token value", () => {
  const offenders = [];
  for (const [bucket, arr] of Object.entries(EPITAPHS)) {
    arr.forEach((t, i) => scanTemplate(t, `EPITAPHS.${bucket}[${i}]`, offenders));
  }
  for (const [cause, t] of Object.entries(CAUSE_TEXT)) {
    scanTemplate(t, `CAUSE_TEXT.${cause}`, offenders);
  }
  assert.deepStrictEqual(offenders, [], `Banned copy in death templates:\n${offenders.join("\n")}`);
});

// ─── Corpus 3: every other authored player-facing bank ──────────────────────

/** Flatten all authored player-facing strings from the remaining banks. */
function collectAuthoredStrings() {
  const out = [];
  const push = (label, s) => { if (s != null) out.push([label, String(s)]); };

  // Maze-Master commentary (flavor.js)
  for (const [k, v] of Object.entries(RACE_NOTE)) push(`RACE_NOTE.${k}`, v);
  for (const [k, v] of Object.entries(CLASS_NOTE)) push(`CLASS_NOTE.${k}`, v);
  for (const [k, v] of Object.entries(SUB_NOTE)) push(`SUB_NOTE.${k}`, v);
  TEMPERAMENTS.forEach((s, i) => push(`TEMPERAMENTS[${i}]`, s));
  MOTIVES.forEach((s, i) => push(`MOTIVES[${i}]`, s));
  PHOBIAS.forEach((p, i) => push(`PHOBIAS[${i}].n`, p.n));

  // Item / spell / skill flavor text
  SPELLS.forEach((s) => { push(`SPELLS.${s.n}(name)`, s.n); push(`SPELLS.${s.n}.txt`, s.txt); });
  POTIONS.forEach((p) => { push(`POTIONS.${p.n}(name)`, p.n); push(`POTIONS.${p.n}.txt`, p.txt); push(`POTIONS.${p.n}.col`, p.col); });
  for (const [bank, obj] of Object.entries({ FIGHTER_SKILLS, THIEF_SKILLS })) {
    for (const [name, v] of Object.entries(obj)) {
      push(`${bank}.${name}(name)`, name); push(`${bank}.${name}.txt`, v.txt); if (v.txt2) push(`${bank}.${name}.txt2`, v.txt2);
    }
  }
  for (const [bank, arr] of Object.entries({ JEWELRY, CLOAKS, STAVES })) {
    arr.forEach((it) => { push(`${bank}.${it.n}(name)`, it.n); push(`${bank}.${it.n}.txt`, it.txt); });
  }
  // Phase 19 (D-16 / RESEARCH Pitfall 7) — new content banks are NOT
  // auto-discovered here; every foe-ability telegraph line must be scanned.
  FOE_ABILITIES.forEach((a) => { push(`FOE_ABILITIES.${a.id}(id)`, a.id); push(`FOE_ABILITIES.${a.id}.txt`, a.txt); });
  // Phase 38 (ABIL-01/02/03) — new content bank, not auto-discovered here
  // (same "new content banks are NOT auto-discovered" note as FOE_ABILITIES
  // immediately above): every ability's name + one-line effect text.
  ABILITIES.forEach((a) => { push(`ABILITIES.${a.id}(name)`, a.name); push(`ABILITIES.${a.id}.txt`, a.txt); });

  // Authored proper-noun / result banks
  BLADE_NAMES.forEach((s, i) => push(`BLADE_NAMES[${i}]`, s));
  FAERIE.forEach((s, i) => push(`FAERIE[${i}]`, s));
  MISC_MAGIC.forEach((s, i) => push(`MISC_MAGIC[${i}]`, s));
  INSANITY.forEach((s, i) => push(`INSANITY[${i}]`, s));
  FOE_NAMES.forEach((n) => push(`BESTIARY foe`, n));
  CHAR_NAMES.forEach((n) => push(`NAMES`, n));
  SUBCLASSES.forEach((n) => push(`SUBCLASS`, n));
  RACE_NAMES.forEach((n) => push(`RACE`, n));
  Object.keys(WEAPONS).forEach((n) => push(`WEAPON`, n));
  ARMORS.forEach((a) => push(`ARMOR`, a.name));
  FOODS.forEach((f) => push(`FOOD`, f.n));
  ENCOUNTER_TABLES.flat().forEach((s) => push(`ENCOUNTER`, s));
  // Phase 25 (FEED-05): the fledgling-miss quip corpus — scanned AND counted
  // here so it participates in the completeness/load-bearing meta-tests too.
  MISS_LINES.forEach((s, i) => push(`MISS_LINES[${i}]`, s));
  // Phase 25.1 (DFB-04): the Joiner-swap snark exit lines — scanned AND
  // counted here so they participate in the completeness/load-bearing
  // meta-tests too.
  JOINER_EXIT_LINES.forEach((s, i) => push(`JOINER_EXIT_LINES[${i}]`, s));
  // Phase 36 (CUT-02): the Cutthroat's per-descent murder lines — scanned
  // AND counted here so they participate in the completeness/load-bearing
  // meta-tests too.
  JOINER_MURDER_LINES.forEach((s, i) => push(`JOINER_MURDER_LINES[${i}]`, s));
  // Phase 36 (JOIN-01): the Company-panel dismissal parting lines — scanned
  // AND counted here so they participate in the completeness/load-bearing
  // meta-tests too.
  JOINER_PARTING_LINES.forEach((s, i) => push(`JOINER_PARTING_LINES[${i}]`, s));

  return out;
}

test("Flavor banks: all remaining authored player-facing copy is family-friendly", () => {
  const offenders = [];
  for (const [label, s] of collectAuthoredStrings()) {
    for (const { match } of findBannedTerms(s)) offenders.push(`${label} → "${match}" in: ${s}`);
  }
  assert.deepStrictEqual(offenders, [], `Banned copy in flavor banks:\n${offenders.join("\n")}`);
});

// ─── Meta-test A: the allowlist is COMPLETE (no false positives) ────────────
// Scan the raw closed vocabularies with the allowlist DISABLED; every resulting
// collision must be covered by the allowlist. This proves the scan will never
// false-positive on a legitimate game word (Scunthorpe-completeness, T-05-06).

test("Allowlist completeness: every collision on real game vocabulary is allowlisted", () => {
  const uncovered = [];
  const seen = new Set();
  const rawScan = (label, s) => {
    const clean = stripMarkup(s);
    for (const { term, re } of MATCHERS) {
      const m = clean.match(re);
      if (m) {
        const word = m[0].toLowerCase();
        if (!ALLOW.has(word) && !seen.has(`${label}:${word}`)) {
          seen.add(`${label}:${word}`);
          uncovered.push(`${label} → "${m[0]}" (term "${term}") not in ALLOWLIST: ${s}`);
        }
      }
    }
  };
  // Real authored strings (not the token-substituted permutations).
  for (const [label, s] of collectAuthoredStrings()) rawScan(label, s);
  for (const [bucket, arr] of Object.entries(EPITAPHS)) arr.forEach((t, i) => rawScan(`EPITAPHS.${bucket}[${i}]`, t.replace(/\{[a-z]+\}/gi, "X")));
  for (const [cause, t] of Object.entries(CAUSE_TEXT)) rawScan(`CAUSE_TEXT.${cause}`, t.replace(/\{[a-z]+\}/gi, "X"));

  assert.deepStrictEqual(
    uncovered,
    [],
    `Real game vocabulary collides with the wordlist but is NOT allowlisted — either it is genuinely off-tone (fix the copy) or it is a safe Scunthorpe word (add it to ALLOWLIST):\n${uncovered.join("\n")}`,
  );
});

// ─── Meta-test B: the allowlist is LOAD-BEARING (no dead entries) ───────────
// Every ALLOWLIST entry must (1) actually be a banned term, and (2) actually
// rescue at least one real collision in the authored corpus. This prevents the
// allowlist from silently rotting into over-permissive dead weight.

test("Allowlist is load-bearing: every entry rescues a real in-corpus collision", () => {
  const bannedLower = new Set(BANNED.map((t) => t.toLowerCase()));
  const corpusStrings = [];
  for (const [, s] of collectAuthoredStrings()) corpusStrings.push(stripMarkup(s));

  const dead = [];
  for (const entry of ALLOWLIST) {
    const lower = entry.toLowerCase();
    // (1) an allowlist entry that isn't even banned would be meaningless
    assert.ok(bannedLower.has(lower), `ALLOWLIST entry "${entry}" is not in BANNED — it can never rescue anything.`);
    // (2) it must match a real authored string
    const re = new RegExp("\\b" + escapeRegExp(entry) + "\\b", "i");
    const rescues = corpusStrings.some((s) => re.test(s));
    if (!rescues) dead.push(entry);
  }
  assert.deepStrictEqual(dead, [], `Dead ALLOWLIST entries (no real game string collides with them — remove them): ${dead.join(", ")}`);
});

// ─── Sanity: the wordlist itself is non-trivial ─────────────────────────────

test("Safety wordlist is substantive (guards against an accidentally-empty list)", () => {
  assert.ok(BANNED.length > 100, `expected a substantial banned corpus; got ${BANNED.length}`);
  assert.ok(Array.isArray(ALLOWLIST) && ALLOWLIST.length > 0, "expected a non-empty allowlist for this corpus");
});
