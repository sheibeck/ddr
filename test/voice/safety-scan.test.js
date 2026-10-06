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
// Phase 61 (STORE-02/03): the upgrade-explanation copy and the store row's
// own frozen reason copy — new player-facing authored copy, scanned
// alongside every other presentation COPY bank in collectAuthoredStrings.
import { UPGRADE_WHY_COPY } from "../../src/browser/upgradeWhy.js";
import { STORE_ROW_COPY } from "../../src/browser/viewModels.js";
// Phase 62 (GSCR-01..06): the rebuilt Gear tab's extended copy bank — every
// string leaf scanned AND counted here so it participates in the
// completeness/load-bearing meta-tests too.
import { GEAR_COPY } from "../../src/browser/gearTab.js";
// Phase 63 (GSCR-07..10): the action sheet's own copy bank — every string
// leaf scanned AND counted here so it participates in the completeness/
// load-bearing meta-tests too.
import { GEAR_SHEET_COPY } from "../../src/browser/gearSheet.js";
import { EPITAPHS, CAUSE_TEXT } from "../../content/epitaphs.js";
// Phase 65 (RUN-04): the shared board table's voice half — board copy and
// both new-best/first-death quip banks, scanned alongside every other
// presentation COPY bank in collectAuthoredStrings.
// Phase 84 (BOARD-18..25, BOARD-20), 84-09: the old panel's BOARD_FOOTNOTES,
// BOARDS_PANEL_COPY, STANDING_LINES and GLOBAL_STANDING_LINES exports are
// retired along with the panel. LEADERBOARD_COPY (the v3 panel's own copy)
// joins the same walk.
import { BOARD_COPY, NEW_BEST_HEAD, NEW_BEST_LINES, FIRST_DEATH_LINES, LEADERBOARD_COPY } from "../../content/boards.js";
// Phase 84 (BOARD-18, BOARD-24, BOARD-25, BOARD-27): the v3 Leaderboards
// panel's own copy bank and the season-name table it shows, walked the same
// way LEADERBOARD_COPY is.
import { SEASON_NAMES } from "../../content/season.js";
// Phase 85 (ACCT-04): the DEPTH rank-line bank and the deferred rail-card
// copy join the same walk. Every run has its own rank now, so there is no
// standing band and no season-drop line.
import { PLACEMENT_LINES, PLACEMENT_CARD } from "../../content/placement.js";
// RULES-10 (Phase 75.1), 75.1-07: the scroll-reading odds copy bank joins
// the same walk.
import { SCROLL_ODDS_COPY } from "../../src/browser/rollOdds.js";
// Phase 67 (ACCT-01/02): the account chip, sheet and rail-card copy joins the same walk.
import { ACCOUNT_COPY } from "../../content/account.js";
// Phase 70 (D-06): the ☰ menu's Save & quit / Abandon row copy joins the same walk.
import { HUD_MENU_QUIT_COPY } from "../../src/browser/hudMenu.js";
import { BESTIARY } from "../../content/bestiary.js";
import { FOE_ABILITIES } from "../../content/foe-abilities.js";
import { NAMES } from "../../content/names.js";
import { RACES } from "../../content/races.js";
import { RACE_NOTE, CLASS_NOTE, SUB_NOTE, TEMPERAMENTS, MOTIVES, PHOBIAS, JOINER_EXIT_LINES, JOINER_MURDER_LINES, JOINER_PARTING_LINES } from "../../content/flavor.js";
import { SPELLS } from "../../content/spells.js";
// Phase 98 (ACH-02): the achievement catalog's name / description / line copy joins the same walk.
import { ACHIEVEMENTS } from "../../content/achievements.js";
// Phase 100 (AUI-01): the unlock banner's chrome copy (card titles, the many-at-once lead and hint, the Earned strip label).
import { ACHIEVEMENT_CARD_COPY } from "../../src/browser/achievementCard.js";
// Phase 100 (AUI-02): the achievements list's chrome copy (header, block titles, row states, the Secret teaser, progress units).
import { ACHIEVEMENTS_SHEET_COPY } from "../../src/browser/achievementsSheet.js";
import { POTIONS } from "../../content/potions.js";
import { FIGHTER_SKILLS, THIEF_SKILLS } from "../../content/skills.js";
import { ABILITIES } from "../../content/abilities.js";
import { JEWELRY, CLOAKS, STAVES, BLADE_NAMES, FAERIE, MISC_MAGIC } from "../../content/treasure-tables.js";
import { INSANITY } from "../../content/misc-tables.js";
import { WEAPONS } from "../../content/weapons.js";
import { ARMORS } from "../../content/armors.js";
import { FOODS } from "../../content/foods.js";
import { ENCOUNTER_TABLES } from "../../content/encounters.js";
// Phase 79 (VOX-04/05), 79-12: the whole narration corpus the narrative pass
// ran on (every builder, bank, content field and raw literal, the 79-03
// footers and the banks Phases 75.1-78 added).
import { buildCorpus } from "../../tools/lib/voice-corpus.mjs";
// Phase 95 (FLAVOR-01/02/05): the player-layer flavour lines (spells, scrolls,
// potions, tools, bags, magic items, weapons, armour).
import { everyFlavorLine } from "../../src/browser/flavorText.js";

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
  // RULES-14 (Phase 75): reflect (a retired ward field, no builder reads it
  // anymore) replaced by mirror/popPool — the wardRaised/wardReflected
  // builders' new mirror-branch text.
  might: 3, pool: 50, mirror: true, popPool: 25, short: 5, item: { n: "Dagger" }, table: 4,
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
  // Phase 61 (GRULE-01): both gearRefused branches — the loot/find verbs
  // ("takeLoot" here covers the shared Set check) and the equip/unequip
  // verbs (BASE_EVENT carries no `verb`, so the default equip/unequip
  // branch is already covered by the base render; this pair exercises both
  // named sides explicitly).
  { verb: "takeLoot" }, { verb: "unequipSlot" },
  // Phase 61 (STORE-02/STORE-03): purchaseBagged's real (non-string) `why`
  // shapes — a weapon compare (with a lostProf term) and an armor compare —
  // and itemRejected's legality reasons that now route to the generic
  // "Not for the likes of you." refusal instead of the old blanket
  // "Not an upgrade." fallback (notBetter keeps its own dedicated clause).
  { why: { kind: "weapon", got: { lab: "d8", need: -1, crit: 1, strike: 4.05 }, have: { lab: "d6", need: 0, crit: 1, strike: 5 }, lostProf: 2 } },
  { why: { kind: "armor", got: { ar: 15 }, have: { ar: 6 } } },
  { reason: "tooHeavy" }, { reason: "noArmor" }, { reason: "notBetter" }, { reason: "wrongClass" },
  // Phase 63 (GSCR-09): itemUnequipped's destroyed branch (the DISCARD
  // outcome's own line), so the scan renders both sides of its ternary.
  { destroyed: true },
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
  // Phase 95 (FLAVOR-01/02/05): every flavour line, scanned AND counted here.
  // The walk is FLAVOR_DOMAINS-driven (everyFlavorLine), so Phase 96's domains
  // need no edit here (Phase 97.1 retired the toggle-word bank with the rules control).
  for (const [domain, key, line] of everyFlavorLine()) push(`FLAVOR.${domain}.${key}`, line);
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
  // Phase 61 (STORE-02/03): the upgrade-explanation formatter's copy bank
  // and the store row's own frozen reason copy — every string leaf scanned
  // AND counted here so they participate in the completeness/load-bearing
  // meta-tests too.
  for (const [k, v] of Object.entries(UPGRADE_WHY_COPY)) push(`UPGRADE_WHY_COPY.${k}`, v);
  for (const [k, v] of Object.entries(STORE_ROW_COPY)) push(`STORE_ROW_COPY.${k}`, v);
  // Phase 62 (GSCR-01..06): GEAR_COPY nests groups (empty/slot/family/use/kit/
  // act), so walk every string leaf recursively rather than a flat Object.entries.
  (function walkGearCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkGearCopy(v, label);
    }
  })(GEAR_COPY, "GEAR_COPY");
  // Phase 63 (GSCR-07..10): GEAR_SHEET_COPY nests groups (head/act/sub/use)
  // the same way GEAR_COPY does — the same recursive walk applies.
  (function walkGearSheetCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkGearSheetCopy(v, label);
    }
  })(GEAR_SHEET_COPY, "GEAR_SHEET_COPY");
  // Phase 65 (RUN-04): BOARD_COPY nests per-board groups (tab/title/rule/
  // unit/unitOne) the same way GEAR_COPY does — the same recursive walk
  // applies. New-best voice: the head string plus both quip banks.
  (function walkBoardCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkBoardCopy(v, label);
    }
  })(BOARD_COPY, "BOARD_COPY");
  push("NEW_BEST_HEAD", NEW_BEST_HEAD);
  NEW_BEST_LINES.forEach((s, i) => push(`NEW_BEST_LINES[${i}]`, s));
  FIRST_DEATH_LINES.forEach((s, i) => push(`FIRST_DEATH_LINES[${i}]`, s));
  // Phase 84 (BOARD-18, BOARD-24, BOARD-25, BOARD-27): LEADERBOARD_COPY and
  // SEASON_NAMES join the same recursive string-leaf walk used for
  // BOARD_COPY, so the v3 panel's copy is scanned and counted here too.
  (function walkBoardCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkBoardCopy(v, label);
    }
  })(LEADERBOARD_COPY, "LEADERBOARD_COPY");
  (function walkBoardCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkBoardCopy(v, label);
    }
  })(SEASON_NAMES, "SEASON_NAMES");
  // Phase 67 (ACCT-01/02): ACCOUNT_COPY joins the same recursive string-leaf walk.
  (function walkAccountCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkAccountCopy(v, label);
    }
  })(ACCOUNT_COPY, "ACCOUNT_COPY");
  // Phase 70 (D-06): the ☰ quit-row copy, same recursive string-leaf walk.
  (function walkQuitCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkQuitCopy(v, label);
    }
  })(HUD_MENU_QUIT_COPY, "HUD_MENU_QUIT_COPY");
  // Phase 85 (ACCT-04): the rank-line bank and the deferred rail card, same
  // recursive walk.
  for (const [bankName, bank] of [
    ["PLACEMENT_LINES", PLACEMENT_LINES],
    ["PLACEMENT_CARD", PLACEMENT_CARD],
    // RULES-10 (Phase 75.1), 75.1-07: the scroll-reading odds copy bank.
    ["SCROLL_ODDS_COPY", SCROLL_ODDS_COPY],
  ]) {
    (function walkPlacementCopy(obj, pathLabel) {
      for (const [k, v] of Object.entries(obj)) {
        const label = `${pathLabel}.${k}`;
        if (typeof v === "string") push(label, v);
        else if (v && typeof v === "object") walkPlacementCopy(v, label);
      }
    })(bank, bankName);
  }
  // Phase 98 (ACH-02): the achievement catalog is a new content bank and is NOT
  // auto-discovered; walk its three copy fields (name and description go to Play,
  // line is the in-game unlock line).
  for (const a of ACHIEVEMENTS) {
    push(`ACHIEVEMENTS.${a.id}.name`, a.name);
    push(`ACHIEVEMENTS.${a.id}.description`, a.description);
    push(`ACHIEVEMENTS.${a.id}.line`, a.line);
  }
  // Phase 100 (AUI-01): the unlock banner's chrome copy, same recursive string-leaf
  // walk. Labels start with ACHIEVEMENT_CARD_COPY. so the Phase 98 count of
  // ACHIEVEMENTS.* labels stays exact.
  (function walkAchievementCardCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkAchievementCardCopy(v, label);
    }
  })(ACHIEVEMENT_CARD_COPY, "ACHIEVEMENT_CARD_COPY");
  // Phase 100 (AUI-02): the achievements list's chrome copy, same walk. Labels
  // start with ACHIEVEMENTS_SHEET_COPY. (never ACHIEVEMENTS.) so the Phase 98
  // count of 231 ACHIEVEMENTS.* labels stays exact.
  (function walkAchievementsSheetCopy(obj, pathLabel) {
    for (const [k, v] of Object.entries(obj)) {
      const label = `${pathLabel}.${k}`;
      if (typeof v === "string") push(label, v);
      else if (v && typeof v === "object") walkAchievementsSheetCopy(v, label);
    }
  })(ACHIEVEMENTS_SHEET_COPY, "ACHIEVEMENTS_SHEET_COPY");

  return out;
}

test("Flavor banks: all remaining authored player-facing copy is family-friendly", () => {
  const offenders = [];
  for (const [label, s] of collectAuthoredStrings()) {
    for (const { match } of findBannedTerms(s)) offenders.push(`${label} → "${match}" in: ${s}`);
  }
  assert.deepStrictEqual(offenders, [], `Banned copy in flavor banks:\n${offenders.join("\n")}`);
});

test("Phase 85: the LEADERBOARD_COPY.global-equivalent and the placement banks are in the authored-string walk", () => {
  const labels = new Set(collectAuthoredStrings().map(([label]) => label));
  for (const l of [
    "LEADERBOARD_COPY.scope.board", "LEADERBOARD_COPY.state.unreachable",
    "PLACEMENT_LINES.rest.0", "PLACEMENT_CARD.many.0",
  ]) {
    assert.ok(labels.has(l), `missing ${l}`);
  }
});

test("Phase 98: the achievement catalog's 231 name / description / line strings are in the authored-string walk", () => {
  const labels = collectAuthoredStrings().map(([label]) => label).filter((l) => l.startsWith("ACHIEVEMENTS."));
  assert.equal(labels.length, 231);
  assert.equal(new Set(labels).size, 231, "no duplicate labels");
  assert.equal(ACHIEVEMENTS.length * 3, 231);
  const have = new Set(labels);
  for (const a of ACHIEVEMENTS) {
    for (const f of ["name", "description", "line"]) assert.ok(have.has(`ACHIEVEMENTS.${a.id}.${f}`), `missing ${a.id}.${f}`);
  }
  assert.ok(have.has("ACHIEVEMENTS.special_snowflake.line"));
  assert.ok(have.has("ACHIEVEMENTS.kills_walking_dead_t4.description"));
});

test("Phase 100: the unlock banner's chrome copy is in the authored-string walk", () => {
  const labels = new Set(collectAuthoredStrings().map(([label]) => label));
  for (const l of [
    "ACHIEVEMENT_CARD_COPY.title", "ACHIEVEMENT_CARD_COPY.many.title", "ACHIEVEMENT_CARD_COPY.many.lead",
    "ACHIEVEMENT_CARD_COPY.many.hint", "ACHIEVEMENT_CARD_COPY.strip.label",
  ]) {
    assert.ok(labels.has(l), `missing ${l}`);
  }
});

test("Phase 100: the achievements list's chrome copy is in the authored-string walk", () => {
  const labels = new Set(collectAuthoredStrings().map(([label]) => label));
  for (const l of [
    "ACHIEVEMENTS_SHEET_COPY.title", "ACHIEVEMENTS_SHEET_COPY.secrets.many",
    "ACHIEVEMENTS_SHEET_COPY.state.earnedNoDate", "ACHIEVEMENTS_SHEET_COPY.secret.line",
  ]) {
    assert.ok(labels.has(l), `missing ${l}`);
  }
});

test("Phase 101: the VIEW IN PLAY GAMES label, its failure line and the Compete help are in the authored-string walk", () => {
  const strings = new Map(collectAuthoredStrings());
  for (const l of [
    "ACHIEVEMENTS_SHEET_COPY.play.view", "ACHIEVEMENTS_SHEET_COPY.play.failed",
    "ACCOUNT_COPY.sheet.onHelp",
  ]) {
    assert.ok(strings.has(l), `missing ${l}`);
    assert.deepStrictEqual(findBannedTerms(strings.get(l)), [], `${l} must be family-friendly`);
  }
  assert.equal(strings.get("ACHIEVEMENTS_SHEET_COPY.play.view"), "VIEW IN PLAY GAMES");
  const failed = strings.get("ACHIEVEMENTS_SHEET_COPY.play.failed");
  assert.ok(!/[<>]/.test(failed), "the failure line carries no markup");
  assert.ok(!/\bWP\b/.test(failed), "the failure line carries no WP word");
  assert.match(failed, /Play Games/);
  assert.match(failed, /achievements/);
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

// ─── Corpus 4 (Phase 79, plan 79-12): the whole narration corpus ────────────
// Every string tools/lib/voice-corpus.mjs#buildCorpus holds — each Oracle and
// rail builder rendered across the narrative pass's synthetic events, every
// registered copy bank (79-03's generated sub-class and race footers and every
// bank Phases 75.1-78 added among them), every content text field, and the
// raw literal sweep of src/browser, engine and mazeworld.html. A template
// entry (a {token} left in its text) is filled with every closed-vocabulary
// value, the same substitution Corpus 2 applies to the death copy.

test("Corpus-wide (79-12): every string in the narration corpus, templates filled with the closed vocabularies, is family-friendly", async () => {
  const corpus = await buildCorpus();
  assert.ok(corpus.counts.texts > 2990, `the corpus should not be empty, saw ${corpus.counts.texts} texts`);
  const offenders = [];
  let filled = 0;
  for (const e of corpus.entries) {
    for (const text of e.texts) {
      const renders = /\{[A-Za-z_]\w*\}/.test(text) ? [text.replace(/\{[A-Za-z_]\w*\}/g, "X"), ...SUBSTITUTIONS.map((v) => text.replace(/\{[A-Za-z_]\w*\}/g, v))] : [text];
      if (renders.length > 1) filled++;
      for (const r of renders) {
        for (const { term, match } of findBannedTerms(r)) offenders.push(`${e.key} → "${match}" (category term #${BANNED.indexOf(term)}) in: ${r}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `Banned copy in the narration corpus:\n${offenders.join("\n")}`);
  assert.ok(filled > 0, "the corpus should carry template entries the closed vocabularies fill");
});
