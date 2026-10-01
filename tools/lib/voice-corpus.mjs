// tools/lib/voice-corpus.mjs
//
// Phase 79 (VOX-05, ROLL-04), 79-01: the narration corpus — every
// player-facing string in the game, with the surface it shows on, what
// triggers it, its narration domain (builders only) and the Phase 79 plan
// that owns it. One call (buildCorpus) answers "which lines are mine, what
// do they say, and where do they come from" for every rewrite plan, and the
// phase-base snapshot (docs/narrative-pass/corpus-base.json) is this
// module's output at the phase base.
//
// NOTHING HERE IS A HARD-CODED LINE LIST. The corpus is rebuilt from the
// tree at run time from five sources, in this order:
//   1. Builders. Every EVENT_NARRATION entry (src/browser/eventNarration.js)
//      is rendered through tools/lib/event-variants.mjs#variantsFor and keyed
//      `oracle:<type>`; every LINE_FOR entry (src/browser/narrationLines.js)
//      the same way, keyed `rail:<type>`. A type ending in Refused, Rejected,
//      Blocked or Denied goes to the `refusals` surface instead. A builder
//      that throws on a variant records that variant id in the entry's
//      `errors` and the build continues.
//   2. Banks. Every exported copy bank named in BANK_REGISTRY: every string
//      leaf, keyed `bank:<EXPORT>.<path>` (object keys and array indices
//      joined by "."; a plain string export is `bank:<EXPORT>`). A row's
//      `pick` narrows the walk to leaves whose own key is listed (a table
//      mixing labels with ids and CSS). Plus the generated sources in
//      GENERATED_SOURCES (79-03's identity footers, pre-registered).
//   3. Content tables. Every text field named in CONTENT_FIELDS, keyed
//      `content:<TABLE>.<rowKey>.<field>`; rowKey is the row's `n`, `id` or
//      `name`, else its object key, else its array index (a repeated rowKey
//      gets "~2", "~3" appended in table order).
//   4. The raw sweep. A comment-stripped string-literal sweep of
//      src/browser/*.js (except the two narration files, whose builders are
//      RENDERED in step 1 instead, so sweeping their source would only add
//      half-sentences), every engine/*.js file and mazeworld.html (script
//      literals and markup text). Keyed `raw:<file>#<enclosing top-level
//      declaration>` ("top" outside any declaration; "markup" for
//      mazeworld.html's markup text nodes and its aria-label, title, alt and
//      placeholder attributes). One entry per declaration, its texts in
//      source order.
//   5. Nothing else. content/*.js is covered by banks and tables only.
//
// THE RAW SWEEP IS A HEURISTIC NET (the registered builders, banks and
// tables stay the authoritative corpus). A literal is kept when, after JS
// escapes are decoded and markup is stripped, it looks like copy: at least
// two letters, and either a space between words or a trailing sentence mark
// (. ! ? …). It is dropped when it looks like code: a path, URL or file
// name; CSS (a selector, a declaration, px/rgba/var()/calc()); a media
// query; a string whose every word is a kebab, snake or camel token or
// holds = ( ) [ ] (class lists, attribute selectors); an object key; the
// right-hand side of an ===/!==/case comparison (dispatch keys); an argument
// to console.*, an Error, an import, a storage/DOM-query/event-listener
// call. A literal inside a declaration that is itself a registered bank,
// table or non-copy export is skipped (the bank walk or the non-copy reason
// covers it), and a literal whose text equals a text already in steps 1-3
// is dropped (it is the same line).
//
// WHY A LEXER OF ITS OWN. tools/ident-sweep.mjs#stripJs is the house
// single-pass comment stripper, but it does not track template literals
// nested inside `${}` (eventNarration.js#foeShattered's
// `${e.by ?? "Something"}'s` closes its outer template early and the `'s`
// then reads as a string opener, so every comment after it survives), and
// it treats a quote inside a regex literal as a string. The raw sweep and
// the declaration scan need exact literal boundaries, so lexJs below does
// the same single-pass comment strip with template nesting and regex
// literals tracked. CRLF is normalised to LF before anything is read, so a
// Windows checkout and a Linux one build byte-identical JSON.
//
// DOMAINS. domainOf(type) reads which engine files emit the type (a
// comment-stripped scan of `type: "<name>"` expressions, including ternary
// types, `refuseIfPending(state, events, "<name>")` and the engine/events.js
// factory calls): fight when engine/combat.js emits it; powers when
// engine/abilities.js, engine/magic.js, any engine/foe*.js or
// engine/scrollFumble.js does; world for every other emitter and for a type
// no engine file emits (shell-stamped or indirect). Fight wins over powers,
// powers over world.
//
// OWNERS. ownerOf(entry) walks OWNER_RULES in order (by surface, module,
// export and domain; never by line); the first rule that matches names the
// owning plan, and anything unplaced belongs to 79-12.
//
// COMPLETENESS. auditRegistry() imports every src/browser/*.js and
// content/*.js module (content/index.js is a barrel of re-exports and is
// skipped) and lists every export holding a copy-like string leaf that is in
// none of BANK_REGISTRY, CONTENT_FIELDS or NON_COPY_EXPORTS. A module that
// cannot be imported under node must be in NON_IMPORTABLE with a reason (it
// is still covered by the raw sweep). A registered module or export that
// does not exist in the tree is skipped and reported in `absent`, never a
// crash (the phase base lists 79-03's two pre-registered sources there).
//
// NOT EDITED AFTER 79-01, except by 79-12: a rewrite plan changes existing
// strings, it does not add exported copy banks (docs/narrative-pass/
// README.md, "no new banks").
//
// Node built-ins only.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { variantsFor } from "./event-variants.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// Surfaces, domains
// ---------------------------------------------------------------------------

/** The fixed surface order; entries sort by this, then by key. */
export const SURFACES = Object.freeze([
  "blurbs", // class and race blurbs
  "oracle", // the Oracle log
  "rail", // rail lines and the fight log
  "refusals", // any builder whose type ends in Refused, Rejected, Blocked or Denied
  "rail-cards", // rail cards and decision cards
  "combat-screen", // the combat screen and its chips
  "items", // item, gear and store text
  "spells", // spells, abilities and skills
  "foes", // bestiary and foe text
  "death", // epitaphs and death
  "boards", // leaderboards and account
  "panels", // hero, gear, store and final-sheet panels
  "map", // map, marks and legend
  "title", // title, roller, settings and menus
  "other", // anything the rules above do not place
]);

export const DOMAINS = Object.freeze(["fight", "powers", "world"]);

const REFUSAL_RE = /(Refused|Rejected|Blocked|Denied)$/;

// ---------------------------------------------------------------------------
// Registries
// ---------------------------------------------------------------------------

const bank = (module, exp, surface, trigger, extra = {}) => Object.freeze({ module, export: exp, surface, trigger, ...extra });

/** Every exported copy bank: one row per export. */
export const BANK_REGISTRY = Object.freeze([
  bank("src/browser/arrowPad.js", "ARROW_PAD_COPY", "title", "the opt-in arrow pad's button names"),
  bank("src/browser/combatMenu.js", "COMBAT_MENU_COPY", "combat-screen", "the combat action grid and its submenus"),
  bank("src/browser/combatPanel.js", "COMBAT_PANEL_COPY", "combat-screen", "the combat panel header, foe cards and YOUR LOT"),
  bank("src/browser/conditionEffects.js", "CONDITION_EFFECT_COPY", "combat-screen", "a condition chip's computed effect clause"),
  bank("src/browser/eventNarration.js", "PHOBIA_TRIGGER_PHRASE", "oracle", "the trigger phrase inside the Oracle's phobia lines"),
  bank("src/browser/eventNarration.js", "RATION_RULE_LINE", "oracle", "the ration rule inside the Oracle's eating lines"),
  bank("src/browser/fightLog.js", "ROUND_STRIP_COPY", "rail", "the fight's what-happened strip and THE FIGHT SO FAR sheet"),
  bank("src/browser/finalSheet.js", "FINAL_SHEET_COPY", "panels", "the FINAL SHEET after a death"),
  bank("src/browser/foeConditions.js", "FOE_CONDITION_COPY", "combat-screen", "a foe condition chip's label"),
  bank("src/browser/foeConditions.js", "FOE_CONDITION_DESC", "combat-screen", "a foe condition's line on the long-press foe card"),
  bank("src/browser/foeDetails.js", "FOE_DETAILS_COPY", "combat-screen", "the long-press foe card"),
  bank("src/browser/gameName.js", "GAME_NAME", "title", "the game's name"),
  bank("src/browser/gearSheet.js", "GEAR_SHEET_COPY", "panels", "the Gear tab's item action sheet"),
  bank("src/browser/gearTab.js", "GEAR_COPY", "panels", "the Gear tab"),
  bank("src/browser/gearTab.js", "ITEM_STATE_COPY", "panels", "an item row's state tag on the Gear tab"),
  bank("src/browser/hazardCard.js", "HAZARD_CARD_COPY", "rail-cards", "the wall and crevice decision card"),
  bank("src/browser/heroConditions.js", "HERO_CHIP_COPY", "combat-screen", "a hero or member condition chip's tap sheet"),
  bank("src/browser/heroTab.js", "ABILITY_VIEW_COPY", "panels", "the Hero tab's ability rows"),
  bank("src/browser/heroTab.js", "GRIMOIRE_COPY", "panels", "the Hero tab's Grimoire rows and the combat menu's spell rows (the resist sentence)"),
  bank("src/browser/heroTab.js", "COMPANY_COPY", "panels", "a Joiner's armour, potion and worn-item rows on the Hero tab's Company panel"),
  bank("src/browser/heroTab.js", "HERO_SIZE_COPY", "panels", "the Hero tab's size row"),
  bank("src/browser/heroTab.js", "RATIONS_COPY", "panels", "the Hero tab's rations row"),
  bank("src/browser/hudMenu.js", "HUD_MENU_ITEMS", "title", "a ☰ menu row", { pick: ["label"] }),
  bank("src/browser/hudMenu.js", "HUD_MENU_QUIT_COPY", "title", "the ☰ menu's Save & quit and Abandon rows"),
  bank("src/browser/mapMarks.js", "MARKS_LEGEND", "map", "the MARKS legend sheet", { pick: ["name", "desc"] }),
  bank("src/browser/missLines.js", "MISS_LINES", "rail", "a fledgling's miss quip"),
  bank("src/browser/patchNotes.js", "PATCH_NOTES_COPY", "title", "the ☰ PATCH NOTES sheet"),
  bank("src/browser/rail.js", "RAIL_COPY", "rail-cards", "the rail card chrome and the idle card"),
  bank("src/browser/rail.js", "RAIL_FAMILY", "rail-cards", "a rail card's family title", { pick: ["title"] }),
  bank("src/browser/reportSheet.js", "BUG_REPORT_COPY", "title", "the ☰ REPORT A BUG sheet"),
  bank("src/browser/rollOdds.js", "HAZARD_ODDS_COPY", "rail-cards", "the odds lines on the wall and crevice card"),
  bank("src/browser/rollOdds.js", "SCROLL_ODDS_COPY", "items", "a scroll's reading odds"),
  bank("src/browser/rollRange.js", "MOD_LABEL", "other", "a named roll modifier inside a roll line"),
  bank("src/browser/rollRange.js", "ROLL_COPY", "other", "the signed to-hit template every roll line shares"),
  bank("src/browser/roller.js", "ROLLER_COPY", "title", "the character roller"),
  bank("src/browser/storeScreen.js", "STORE_ROLL_COPY", "panels", "the store screen"),
  bank("src/browser/teleportCard.js", "TELEPORT_CARD_COPY", "rail-cards", "the Illusionist's teleport decision card"),
  bank("src/browser/upgradeWhy.js", "UPGRADE_WHY_COPY", "items", "why a store or loot item is, or is not, an upgrade"),
  bank("src/browser/viewModels.js", "ITEM_STAT_COPY", "items", "an item's stat line"),
  bank("src/browser/viewModels.js", "STORE_ROW_COPY", "items", "a store row's reason"),
  bank("src/browser/viewModels.js", "USABLE_COPY", "items", "an item's usable-state line"),
  bank("content/account.js", "ACCOUNT_COPY", "boards", "the account chip, sheet and rail card"),
  // Phase 84 (BOARD-18..25, BOARD-20), 84-09: the old panel's BOARDS_PANEL_COPY,
  // BOARD_FOOTNOTES, STANDING_LINES and GLOBAL_STANDING_LINES rows are
  // retired along with the panel itself. BOARD_COPY is trimmed to the four
  // NEW PERSONAL BEST rows; LEADERBOARD_COPY is the only panel copy bank.
  bank("content/boards.js", "BOARD_COPY", "boards", "a NEW PERSONAL BEST row's title and unit"),
  bank("content/boards.js", "FIRST_DEATH_LINES", "boards", "the first-death quip"),
  bank("content/boards.js", "NEW_BEST_HEAD", "boards", "the new-best card head"),
  bank("content/boards.js", "NEW_BEST_LINES", "boards", "the new-best quip"),
  // Phase 84 (BOARD-18, BOARD-24, BOARD-25, BOARD-27): the v3 Leaderboards
  // panel's own copy and the season-name table it shows under the title.
  bank("content/boards.js", "LEADERBOARD_COPY", "boards", "the Leaderboards panel v3"),
  bank("content/season.js", "SEASON_NAMES", "boards", "the season's name on the LEADERBOARD view"),
  bank("content/epitaphs.js", "EPITAPHS", "death", "the epitaph on the death screen"),
  bank("content/epitaphs.js", "CAUSE_TEXT", "death", "the cause-of-death line"),
  bank("content/flavor.js", "CLASS_NOTE", "blurbs", "the class blurb (roller and Hero tab)"),
  bank("content/flavor.js", "RACE_NOTE", "blurbs", "the race blurb (roller and Hero tab)"),
  bank("content/flavor.js", "SUB_NOTE", "blurbs", "the sub-class blurb (roller and Hero tab)"),
  bank("content/flavor.js", "JOINER_EXIT_LINES", "oracle", "a Joiner swapped out of a full party"),
  bank("content/flavor.js", "JOINER_MURDER_LINES", "oracle", "the Cutthroat's per-descent murder line"),
  bank("content/flavor.js", "JOINER_PARTING_LINES", "oracle", "a Joiner dismissed from the Company panel"),
  bank("content/flavor.js", "MOTIVES", "panels", "the hero's rolled motive"),
  bank("content/flavor.js", "TEMPERAMENTS", "panels", "the hero's rolled temperament"),
  bank("content/flavor.js", "PHOBIAS", "panels", "the hero's rolled phobia", { pick: ["n"] }),
  bank("content/placement.js", "PLACEMENT_CARD", "rail-cards", "the deferred placement rail card"),
  bank("content/placement.js", "PLACEMENT_LINES", "boards", "the DEPTH rank line"),
  bank("content/spells.js", "NICHE_LABELS", "spells", "a spell's niche label"),
  // Phase 91 plan 06 (IDENT-17): the titles a Bard's song is sung under (content/songs.js).
  bank("content/songs.js", "SONG_TITLES", "oracle", "the title a Bard's song is sung under"),
  bank("content/treasure-tables.js", "FAERIE", "items", "a Faerie's gift"),
  bank("content/treasure-tables.js", "MISC_MAGIC", "items", "a misc-magic treasure kind"),
  // Pre-registered for wave-1 sibling 79-03 (absent at the phase base).
  bank("content/identity.js", "IDENTITY_TRAITS", "blurbs", "an authored advantage or disadvantage line in a sub-class or race footer", { pick: ["text"] }),
]);

/**
 * Generated sources: copy produced by calling a pure function rather than
 * read from a table. Pre-registered for wave-1 sibling 79-03: the sub-class
 * and race footer lines, `footerLines(kind, key)` for every sub-class
 * (CLASSES[*].subs) and race (RACES keys), keyed
 * `bank:IDENTITY_FOOTER.<kind>.<key>`.
 */
export const GENERATED_SOURCES = Object.freeze([
  Object.freeze({
    id: "IDENTITY_FOOTER",
    module: "src/browser/identityFooter.js",
    export: "footerLines",
    surface: "blurbs",
    trigger: "the generated mechanical footer under a sub-class or race blurb (roller and Hero tab)",
  }),
]);

const table = (module, exp, surface, fields, trigger, extra = {}) => Object.freeze({ module, export: exp, surface, fields, trigger, ...extra });

/** Content tables with text fields: one row per table. */
export const CONTENT_FIELDS = Object.freeze([
  table("content/abilities.js", "ABILITIES", "spells", ["txt"], "an ability's one-line effect (Hero tab, combat menu)"),
  table("content/afflictions.js", "AFFLICTIONS", "other", ["dur"], "an affliction's duration"),
  table("content/bags.js", "BAG_ITEMS", "items", ["txt"], "a bag's item text"),
  table("content/bestiary.js", "BESTIARY", "foes", ["sp.note"], "a foe's special note (foe card)", { walk: "bestiary" }),
  table("content/foe-abilities.js", "FOE_ABILITIES", "foes", ["txt"], "a foe ability's telegraph line"),
  table("content/misc-tables.js", "LEAP_TABLE", "other", ["ft"], "a leap distance row"),
  table("content/potions.js", "POTIONS", "items", ["txt"], "a potion's item text"),
  table("content/races.js", "RACES", "blurbs", ["note"], "a race's rules note"),
  table("content/skills.js", "FIGHTER_SKILLS", "spells", ["txt", "txt2"], "a Fighter skill's text"),
  table("content/skills.js", "THIEF_SKILLS", "spells", ["txt", "txt2"], "a Thief skill's text"),
  table("content/spells.js", "SPELLS", "spells", ["txt"], "a spell's Grimoire and scroll text"),
  table("content/tools.js", "TOOLS", "items", ["txt"], "a tool's item text"),
  table("content/treasure-tables.js", "CLOAKS", "items", ["txt"], "a cloak's item text"),
  table("content/treasure-tables.js", "JEWELRY", "items", ["txt"], "a jewelry piece's item text"),
  table("content/treasure-tables.js", "STAVES", "items", ["txt"], "a staff's item text"),
]);

const nonCopy = (module, exp, reason) => Object.freeze({ module, export: exp, reason });

/** Exports holding copy-like strings that are not player copy, each with why. */
export const NON_COPY_EXPORTS = Object.freeze([
  nonCopy("src/browser/bridge.js", "BRIDGE", "the developer registry of window.__mz* bridges; its owner, consumer and purpose notes are never rendered"),
  nonCopy("src/browser/combatPanel.js", "ENC_TYPES", "encounter family ids"),
  nonCopy("src/browser/foeConditions.js", "FOE_CONDITIONS", "rows point at FOE_CONDITION_COPY and FOE_CONDITION_DESC; the text is walked through those banks"),
  nonCopy("src/browser/heroConditions.js", "HERO_CONDITIONS", "the condition table: keys, fields, timers and source item names; the copy is HERO_CHIP_COPY"),
  // Phase 84, Plan 07: exported (from an already-existing module-private
  // const) so leaderboardPanel.js's controller can validate a SUB-CLASS
  // sheet pick without importing content/classes.js directly (its own
  // source-pin test forbids a direct /content/ import) — sub-class name ids
  // (name vocabulary, not sentences). 84-09 retired the old panel's own
  // boardsView.js#LINEAGE_SUBS row this disposition used to mirror.
  nonCopy("src/browser/leaderboardView.js", "SUB_IDS", "sub-class name ids used to validate a SUB-CLASS sheet pick (name vocabulary, not sentences)"),
  nonCopy("src/browser/motion.js", "REDUCED_MOTION_QUERY", "a CSS media query"),
  // 79.3: the bundled release notes for this version, generated from
  // docs/patch-notes/<versionName>.md by tools/patch-notes.mjs --write-module:
  // release content, not UI copy (D-18/D-19 and the addendum's Copy note).
  nonCopy("src/browser/patchNotesData.js", "PATCH_NOTES", "the bundled release notes for this version, generated from docs/patch-notes/<versionName>.md by tools/patch-notes.mjs --write-module: release content, not UI copy (79.3 D-18/D-19 and the addendum's Copy note)"),
  nonCopy("src/browser/uiTap.js", "UI_TAP_SELECTOR", "a CSS selector"),
  nonCopy("content/abilities.js", "ABILITY_BY_ID", "an index of ABILITIES, which is walked as a content table"),
  nonCopy("content/bestiary.js", "ELITE_TITLES", "name prefixes for elite foes (proper-noun vocabulary)"),
  nonCopy("content/bestiary.js", "ENC_ALIAS", "encounter family alias keys"),
  nonCopy("content/bestiary.js", "ENC_TYPES", "encounter family ids"),
  nonCopy("content/classes.js", "CLASSES", "the class rules table; sub-class names are ids"),
  nonCopy("content/damage-multipliers.js", "DAMAGE_MULTIPLIERS", "a rules table keyed by foe family ids"),
  nonCopy("content/encounters.js", "ENCOUNTER_TABLES", "engine dispatch keys, not copy (79-02 stops printing them)"),
  nonCopy("content/kit.js", "FREE_SKILL", "skill names (ids into the skill tables)"),
  nonCopy("content/identity.js", "BLURB_ANCHORS", "regex sources the IDENT-12 blurb guard matches against the blurbs (Phase 91 plan 10); the player reads the blurbs, never these patterns"),
  // 79-12: registered as a bank until 79-11 stopped printing it.
  nonCopy("content/misc-tables.js", "INSANITY", "never printed since 79-11 (the hero's insanityRolled line no longer shows the foe-side row); engine/encounters.js#goInsane still stamps it as insanityRolled.result, so it stays as engine data, and test/voice/safety-scan.test.js still scans it"),
  nonCopy("content/kit.js", "KIT", "starting-kit weapon names (ids into WEAPONS)"),
  nonCopy("content/names.js", "NAMES", "character name vocabulary (proper nouns, safety-scanned)"),
  nonCopy("content/safety-wordlist.js", "ALLOWLIST", "the safety matcher's own word list"),
  nonCopy("content/safety-wordlist.js", "BANNED", "the safety matcher's own word list"),
  nonCopy("content/safety-wordlist.js", "GORE", "the safety matcher's own word list"),
  nonCopy("content/safety-wordlist.js", "PROFANITY", "the safety matcher's own word list"),
  nonCopy("content/safety-wordlist.js", "SEXUAL", "the safety matcher's own word list"),
  nonCopy("content/safety-wordlist.js", "SLURS", "the safety matcher's own word list"),
  nonCopy("content/store-stock.js", "STORE_POTION_POOL", "potion names (ids into POTIONS)"),
  nonCopy("content/traps.js", "TRAPS", "trap names (proper nouns); the trap lines are builder text"),
  nonCopy("content/treasure-tables.js", "BLADE_NAMES", "proper-noun blade names"),
  nonCopy("content/treasure-tables.js", "STAFF_NAMES", "proper-noun staff names"),
  nonCopy("content/weapons.js", "WEAPON_TYPE_TABLE", "weapon family ids"),
  // 79-13: an engine lookup, so only the raw sweep ever met it (the
  // completeness audit walks src/browser and content, not engine).
  nonCopy("engine/derived.js", "PARTY_WIDE_ITEM_EFFECTS", "activation keys (item names used as ids) for the party-wide item effects quick fix 79-02b added; the lookup is never printed, and the Crystal Staff's text is walked as content:STAVES"),
]);

/** Modules that cannot be imported under node, each with why (raw sweep still covers them). */
export const NON_IMPORTABLE = Object.freeze([]);

/** Barrel modules of re-exports; their exports are audited in the defining module. */
export const BARREL_MODULES = Object.freeze([
  Object.freeze({ module: "content/index.js", reason: "re-exports the per-table content modules" }),
]);

/** Where a raw-sweep entry shows, by file (first match wins; default "other"). */
export const RAW_SURFACES = Object.freeze([
  Object.freeze({ files: ["engine/items.js", "engine/economy.js"], surface: "items" }),
  Object.freeze({ fileMatch: "^engine/", surface: "oracle" }),
  Object.freeze({
    keys: [
      "raw:mazeworld.html#CONDITION_COPY", "raw:mazeworld.html#COMBAT_COPY", "raw:mazeworld.html#FOE_EFFECT_LABEL",
      "raw:mazeworld.html#FOE_EFFECT_EXPLAIN", "raw:mazeworld.html#ABILITY_CHIP_LABEL", "raw:mazeworld.html#CONDITION_EXPLAIN",
      "raw:mazeworld.html#WAIVER_LABEL", "raw:mazeworld.html#CONDITION_TONE", "raw:mazeworld.html#EXPLAIN_BY_KIND",
    ],
    surface: "combat-screen",
  }),
  Object.freeze({ keys: ["raw:mazeworld.html#MAP_COPY"], surface: "map" }),
  Object.freeze({ keys: ["raw:mazeworld.html#markup"], surface: "title" }),
  Object.freeze({
    files: ["src/browser/combatMenu.js", "src/browser/combatPanel.js", "src/browser/conditionEffects.js", "src/browser/heroConditions.js", "src/browser/foeConditions.js", "src/browser/foeDetails.js", "src/browser/combatBeat.js"],
    surface: "combat-screen",
  }),
  Object.freeze({ files: ["src/browser/heroTab.js", "src/browser/gearTab.js", "src/browser/gearSheet.js", "src/browser/storeScreen.js", "src/browser/finalSheet.js"], surface: "panels" }),
  Object.freeze({ files: ["src/browser/viewModels.js", "src/browser/upgradeWhy.js", "src/browser/rollOdds.js"], surface: "items" }),
  Object.freeze({
    files: ["src/browser/leaderboardView.js", "src/browser/leaderboardPanel.js", "src/browser/account.js", "src/browser/accountChip.js", "src/browser/placement.js", "src/browser/newBest.js"],
    surface: "boards",
  }),
  Object.freeze({ files: ["src/browser/mapMarks.js", "src/browser/darknessView.js"], surface: "map" }),
  Object.freeze({ files: ["src/browser/roller.js", "src/browser/settings.js", "src/browser/hudMenu.js", "src/browser/arrowPad.js", "src/browser/gameName.js", "src/browser/titleMusic.js"], surface: "title" }),
  Object.freeze({ files: ["src/browser/rail.js", "src/browser/hazardCard.js"], surface: "rail-cards" }),
  Object.freeze({ files: ["src/browser/fightLog.js", "src/browser/missLines.js"], surface: "rail" }),
]);

const rule = (owner, when, note) => Object.freeze({ owner, when: Object.freeze(when), note });

/**
 * OWNER_RULES — the Phase 79 ownership rules as data (docs/narrative-pass/
 * README.md, "Ownership"). Walked in order; the first rule whose every
 * condition matches owns the entry. Conditions: kind (builder, bank,
 * content, raw), types (builder event types), keys (exact keys), exports
 * (bank or table export names, or raw declaration names), modules (source
 * file), moduleMatch (a regex source on the source file), surfaces,
 * domains. Anything no rule places belongs to 79-12.
 */
export const OWNER_RULES = Object.freeze([
  rule("79-02", {
    kind: "builder",
    types: ["healed", "regenerated", "potionDrunk", "secondWindHealed", "foodFound", "faerieBoon", "healTick", "cooked", "rested", "leveled", "tableFour", "tableFourNoop", "encounterRolled"],
  }, "the gain, Table 4 and table-roll builders"),
  rule("79-02", { keys: ["raw:engine/encounters.js#tableFour"] }, "Table 4's engine prose"),
  rule("79-03", { surfaces: ["blurbs"] }, "class, sub-class and race blurbs, RACES notes and the identity footers"),
  rule("79-03", { exports: ["JOINER_EXIT_LINES", "JOINER_MURDER_LINES", "JOINER_PARTING_LINES"] }, "the Joiner lines"),
  rule("79-06", { exports: ["EPITAPHS", "CAUSE_TEXT", "MISS_LINES"] }, "epitaphs, death causes and the miss quips"),
  rule("79-06", {
    modules: ["content/boards.js", "content/placement.js", "content/account.js", "content/epitaphs.js", "src/browser/missLines.js", "src/browser/placement.js", "src/browser/account.js", "src/browser/newBest.js"],
  }, "boards, placement, account and score-tag copy"),
  rule("79-04", { kind: "builder", domains: ["fight"] }, "fight-domain Oracle and rail lines"),
  rule("79-04", { modules: ["src/browser/fightLog.js", "engine/combat.js"] }, "the fight log and engine/combat.js literals"),
  rule("79-05", {
    modules: [
      "content/spells.js", "content/potions.js", "content/skills.js", "content/abilities.js", "content/treasure-tables.js", "content/bestiary.js",
      "content/foe-abilities.js", "content/afflictions.js", "content/misc-tables.js", "content/traps.js", "content/tools.js", "content/scroll-fumbles.js",
      "content/activations.js", "content/kit.js", "content/bags.js", "content/foods.js", "content/store-stock.js", "engine/items.js", "engine/economy.js",
    ],
  }, "content rules text and engine/items.js and engine/economy.js literals"),
  rule("79-07", {
    modules: ["src/browser/combatMenu.js", "src/browser/combatPanel.js", "src/browser/conditionEffects.js", "src/browser/heroConditions.js", "src/browser/foeConditions.js", "src/browser/foeDetails.js"],
  }, "combat screen and chip copy"),
  rule("79-07", {
    modules: ["mazeworld.html"],
    exports: ["CONDITION_COPY", "COMBAT_COPY", "FOE_EFFECT_LABEL", "FOE_EFFECT_EXPLAIN", "ABILITY_CHIP_LABEL", "CONDITION_EXPLAIN", "WAIVER_LABEL", "CONDITION_TONE", "EXPLAIN_BY_KIND"],
  }, "mazeworld.html's combat and condition consts"),
  rule("79-08", { kind: "builder", domains: ["powers"] }, "powers-domain Oracle and rail lines"),
  rule("79-08", { modules: ["engine/magic.js", "engine/abilities.js", "engine/scrollFumble.js"] }, "powers engine literals"),
  rule("79-08", { moduleMatch: "^engine/foe[^/]*\\.js$" }, "foe engine literals"),
  rule("79-09", {
    modules: [
      "src/browser/heroTab.js", "src/browser/gearTab.js", "src/browser/gearSheet.js", "src/browser/storeScreen.js", "src/browser/viewModels.js", "src/browser/upgradeWhy.js",
      "src/browser/leaderboardView.js", "src/browser/leaderboardPanel.js", "src/browser/finalSheet.js",
    ],
  }, "hero, gear, store, boards and final-sheet panel copy"),
  rule("79-10", {
    modules: ["src/browser/mapMarks.js", "src/browser/roller.js", "src/browser/settings.js", "src/browser/hudMenu.js", "src/browser/arrowPad.js", "src/browser/accountChip.js", "mazeworld.html"],
  }, "map, legend, title, roller, settings, menu and remaining shell copy"),
  rule("79-11", { kind: "builder", domains: ["world"] }, "world-domain Oracle and rail lines"),
  rule("79-11", { modules: ["src/browser/rail.js", "src/browser/hazardCard.js"] }, "the rail cards and the hazard card"),
  rule("79-11", { exports: ["PHOBIA_TRIGGER_PHRASE", "RATION_RULE_LINE"] }, "phrase banks only the world-domain builders print"),
  rule("79-11", { moduleMatch: "^engine/" }, "every other engine literal"),
  rule("79-12", { modules: ["src/browser/rollRange.js"] }, "the one number formatter (reused, not changed)"),
]);

export const DEFAULT_OWNER = "79-12";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", minus: "−", times: "×", middot: "·" };

/** decodeEntities(s) — the named entities the shell uses, plus numeric ones. */
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g) => {
    if (g[0] === "#") {
      const cp = g[1] === "x" || g[1] === "X" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[g.toLowerCase()] ?? m;
  });
}

/**
 * normalizeText(s) — the player-visible words: <br> and block tags become a
 * space, every other tag is removed (so "<span>x</span>." stays "x."),
 * entities are decoded and whitespace collapses to single spaces.
 */
export function normalizeText(s) {
  return decodeEntities(
    String(s ?? "")
      .replace(/<\s*(br|\/?p|\/?div|\/?li|\/?tr|\/?h\d)\b[^>]*>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** decodeJsEscapes(s) — a string literal's raw body to its value. */
export function decodeJsEscapes(s) {
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)/g, (m, g) => {
    if (g[0] === "u" && g[1] === "{") return String.fromCodePoint(parseInt(g.slice(2, -1), 16));
    if (g[0] === "u" && g.length === 5) return String.fromCharCode(parseInt(g.slice(1), 16));
    if (g[0] === "x" && g.length === 3) return String.fromCharCode(parseInt(g.slice(1), 16));
    if (g === "n") return "\n";
    if (g === "t") return "\t";
    if (g === "r") return "";
    if (g === "\n" || g === "\r\n") return "";
    return g;
  });
}

const readText = (abs) => fs.readFileSync(abs, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");

// ---------------------------------------------------------------------------
// The lexer (see the header: why not stripJs)
// ---------------------------------------------------------------------------

const REGEX_PREV = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^", ""]);
const REGEX_KEYWORDS = new Set(["return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "instanceof", "yield", "await"]);

/**
 * lexJs(src, placeholder) — one pass over JavaScript source. Returns:
 *   noComments: the source with every comment blanked (strings kept);
 *   code: noComments with every string, template-text and regex body
 *         blanked too (same length; newlines kept), for brace scans;
 *   literals: [{ start, end, quote, raw }] — each string or template
 *         literal's raw body, a template's `${…}` replaced by `placeholder`;
 *   balanced: false when the source ended inside a template or `${`.
 */
export function lexJs(src, placeholder = "…") {
  const n = src.length;
  const noC = [];
  const codeOut = [];
  const literals = [];
  const exprDepth = []; // brace depth inside each open `${`
  const tplStack = []; // enclosing template records while inside `${`
  let tpl = null;
  let i = 0;
  let lastSig = "";
  let lastWord = "";
  let inWord = false;
  const emit = (orig, codeCh) => { noC.push(orig); codeOut.push(codeCh); };
  const emitBlank = (ch) => { const b = ch === "\n" ? "\n" : " "; noC.push(b); codeOut.push(b); };
  const emitStr = (ch) => emit(ch, ch === "\n" ? "\n" : " ");

  const templateText = () => {
    // inside template text; return when the template closes or a `${` opens
    while (i < n) {
      const c = src[i];
      if (c === "\\") { tpl.raw += src.slice(i, i + 2); emitStr(c); if (i + 1 < n) emitStr(src[i + 1]); i += 2; continue; }
      if (c === "`") {
        emit("`", "`"); i++;
        tpl.end = i; literals.push(tpl);
        tpl = null;
        lastSig = "a"; lastWord = ""; inWord = false;
        return;
      }
      if (c === "$" && src[i + 1] === "{") {
        tpl.raw += placeholder; emit("$", "$"); emit("{", "{"); i += 2;
        tplStack.push(tpl); tpl = null; exprDepth.push(0);
        lastSig = "{"; lastWord = ""; inWord = false;
        return;
      }
      tpl.raw += c; emitStr(c); i++;
    }
  };

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") { emitBlank(src[i]); i++; }
      continue;
    }
    if (c === "/" && c2 === "*") {
      emitBlank(c); emitBlank(c2); i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { emitBlank(src[i]); i++; }
      if (i < n) { emitBlank("*"); emitBlank("/"); i += 2; }
      continue;
    }
    if (c === "'" || c === '"') {
      const start = i; let raw = "";
      emit(c, c); i++;
      while (i < n) {
        const d = src[i];
        if (d === "\\") { raw += src.slice(i, i + 2); emitStr(d); if (i + 1 < n) emitStr(src[i + 1]); i += 2; continue; }
        if (d === c) { emit(d, d); i++; break; }
        if (d === "\n") break; // unterminated: stop at the line end
        raw += d; emitStr(d); i++;
      }
      literals.push({ start, end: i, quote: c, raw });
      lastSig = "a"; lastWord = ""; inWord = false;
      continue;
    }
    if (c === "`") {
      tpl = { start: i, end: -1, quote: "`", raw: "" };
      emit("`", "`"); i++;
      templateText();
      continue;
    }
    if (exprDepth.length) {
      if (c === "{") exprDepth[exprDepth.length - 1]++;
      else if (c === "}") {
        if (exprDepth[exprDepth.length - 1] === 0) {
          exprDepth.pop(); emit("}", "}"); i++;
          tpl = tplStack.pop();
          templateText();
          continue;
        }
        exprDepth[exprDepth.length - 1]--;
      }
    }
    if (c === "/" && (REGEX_PREV.has(lastSig) || REGEX_KEYWORDS.has(lastWord))) {
      emit("/", "/"); i++;
      let inClass = false;
      while (i < n) {
        const d = src[i];
        if (d === "\\") { emitStr(d); if (i + 1 < n) emitStr(src[i + 1]); i += 2; continue; }
        if (d === "\n") break;
        if (inClass) { if (d === "]") inClass = false; emitStr(d); i++; continue; }
        if (d === "[") { inClass = true; emitStr(d); i++; continue; }
        if (d === "/") { emit("/", "/"); i++; break; }
        emitStr(d); i++;
      }
      while (i < n && /[a-z]/i.test(src[i])) { emit(src[i], src[i]); i++; }
      lastSig = "a"; lastWord = ""; inWord = false;
      continue;
    }
    emit(c, c); i++;
    if (/\s/.test(c)) { inWord = false; continue; }
    if (/[\w$]/.test(c)) { lastWord = (inWord ? lastWord : "") + c; lastSig = c; inWord = true; }
    else { lastSig = c; lastWord = ""; inWord = false; }
  }
  return { noComments: noC.join(""), code: codeOut.join(""), literals, balanced: exprDepth.length === 0 && tpl === null };
}

/** blankHtmlComments(src) — `<!-- … -->` interiors to spaces, newlines kept. */
export function blankHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}

// ---------------------------------------------------------------------------
// Top-level declarations (brace-depth scan of lexJs's blanked code)
// ---------------------------------------------------------------------------

const DECL_RE = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/;

/**
 * topLevelDecls(code) — [{ name, start, end }] for every declaration at
 * depth 0 of a blanked source. A function or class ends where its body's
 * closing brace returns the depth to 0; a const/let/var ends at the first
 * `;` at depth 0 (or where the next top-level declaration starts, for a
 * statement relying on automatic semicolon insertion).
 */
export function topLevelDecls(code) {
  const decls = [];
  let depth = 0;
  let cur = null; // { name, start, kind, opened }
  const n = code.length;
  for (let i = 0; i < n; i++) {
    const c = code[i];
    if (depth === 0 && /[A-Za-z_$]/.test(c) && (i === 0 || /[\s;})]/.test(code[i - 1]))) {
      const m = DECL_RE.exec(code.slice(i, i + 200));
      if (m) {
        if (cur) { cur.end = i; decls.push(cur); }
        const kind = m[1].startsWith("function") ? "function" : m[1];
        cur = { name: m[2], start: i, end: n, kind, opened: false };
        i += m[0].length - 1;
        continue;
      }
    }
    if (c === "{" || c === "(" || c === "[") {
      depth++;
      if (cur && depth === 1 && c === "{") cur.opened = true;
      continue;
    }
    if (c === "}" || c === ")" || c === "]") {
      depth = Math.max(0, depth - 1);
      if (cur && depth === 0 && c === "}" && cur.opened && (cur.kind === "function" || cur.kind === "class")) {
        cur.end = i + 1; decls.push(cur); cur = null;
      }
      continue;
    }
    if (c === ";" && depth === 0 && cur) { cur.end = i + 1; decls.push(cur); cur = null; }
  }
  if (cur) { cur.end = n; decls.push(cur); }
  return decls.map(({ name, start, end }) => ({ name, start, end }));
}

/** declAt(decls, pos) — the enclosing top-level declaration's name, or "top". */
export function declAt(decls, pos) {
  let lo = 0;
  let hi = decls.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = decls[mid];
    if (pos < d.start) hi = mid - 1;
    else if (pos >= d.end) lo = mid + 1;
    else return d.name;
  }
  return "top";
}

// ---------------------------------------------------------------------------
// Engine emitters and domains
// ---------------------------------------------------------------------------

const POWERS_FILES = new Set(["engine/abilities.js", "engine/magic.js", "engine/scrollFumble.js"]);
const isPowersFile = (f) => POWERS_FILES.has(f) || /^engine\/foe[^/]*\.js$/.test(f);

const listJs = (absDir) => (fs.existsSync(absDir) ? fs.readdirSync(absDir).filter((f) => f.endsWith(".js")).sort() : []);

/**
 * scanEmitters({ root }) — Map<eventType, [{ file, decl }]>: every engine
 * file and top-level declaration that emits the type, in file then source
 * order, de-duplicated.
 */
export async function scanEmitters({ root = REPO_ROOT } = {}) {
  const engineDir = path.join(root, "engine");
  const out = new Map();
  const add = (type, file, decl) => {
    if (!out.has(type)) out.set(type, []);
    const list = out.get(type);
    if (!list.some((e) => e.file === file && e.decl === decl)) list.push({ file, decl });
  };
  // engine/events.js factories: call each exported function bare to learn its type.
  const factoryType = new Map();
  const eventsAbs = path.join(engineDir, "events.js");
  if (fs.existsSync(eventsAbs)) {
    const mod = await import(url.pathToFileURL(eventsAbs).href);
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      try { const t = fn()?.type; if (typeof t === "string") factoryType.set(name, t); } catch { /* not a bare-callable factory */ }
    }
  }
  for (const f of listJs(engineDir)) {
    const rel = `engine/${f}`;
    const { noComments, code } = lexJs(readText(path.join(engineDir, f)));
    const decls = topLevelDecls(code);
    for (const m of noComments.matchAll(/type:\s*([^,}]+)/g)) {
      for (const s of m[1].matchAll(/"([A-Za-z]+)"/g)) add(s[1], rel, declAt(decls, m.index));
    }
    for (const m of noComments.matchAll(/refuseIfPending\(\s*state,\s*events,\s*"([A-Za-z]+)"/g)) add(m[1], rel, declAt(decls, m.index));
    if (f !== "events.js") {
      const imp = noComments.match(/import\s*\{([^}]*)\}\s*from\s*["']\.\/events\.js["']/);
      if (imp) {
        const names = imp[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter((s) => factoryType.has(s));
        for (const name of names) {
          for (const m of code.matchAll(new RegExp(`(?<![\\w$.])${name}\\s*\\(`, "g"))) add(factoryType.get(name), rel, declAt(decls, m.index));
        }
      }
    }
  }
  return out;
}

/**
 * domainOf(type, emitters) — fight, powers or world (see the header). Pass a
 * synthetic Map<type, [{ file }]> to test the precedence.
 */
export function domainOf(type, emitters) {
  const files = (emitters?.get(type) ?? []).map((e) => e.file);
  if (files.includes("engine/combat.js")) return "fight";
  if (files.some(isPowersFile)) return "powers";
  return "world";
}

function triggerFor(type, emitters) {
  const list = emitters.get(type) ?? [];
  if (!list.length) return `${type} — shell-stamped or indirect`;
  const shown = list.slice(0, 3).map((e) => `${e.file}#${e.decl}`).join("; ");
  return `${type} — ${shown}${list.length > 3 ? `; +${list.length - 3} more` : ""}`;
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

function ruleMatches(when, entry) {
  if (when.kind && entry.kind !== when.kind) return false;
  if (when.types && !(entry.type && when.types.includes(entry.type))) return false;
  if (when.keys && !when.keys.includes(entry.key)) return false;
  if (when.exports && !(entry.export && when.exports.includes(entry.export))) return false;
  if (when.modules && !when.modules.includes(entry.module)) return false;
  if (when.moduleMatch && !new RegExp(when.moduleMatch).test(entry.module ?? "")) return false;
  if (when.surfaces && !when.surfaces.includes(entry.surface)) return false;
  if (when.domains && !when.domains.includes(entry.domain)) return false;
  return true;
}

/**
 * ownerOf(entry) — the owning Phase 79 plan. `entry` carries kind, key,
 * surface, module (the source file), export (bank/table export or raw
 * declaration), type and domain (builders).
 */
export function ownerOf(entry) {
  for (const r of OWNER_RULES) if (ruleMatches(r.when, entry)) return r.owner;
  return DEFAULT_OWNER;
}

// ---------------------------------------------------------------------------
// Walking banks and tables
// ---------------------------------------------------------------------------

/** stringLeaves(value) — [[path, string]] for every string leaf, in key order. */
export function stringLeaves(value, pick = null) {
  const out = [];
  const seen = new Set();
  const walk = (v, p, leafKey) => {
    if (typeof v === "string") {
      if (!pick || pick.includes(leafKey)) out.push([p, v]);
      return;
    }
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    const keys = Array.isArray(v) ? v.map((_, i) => String(i)) : Object.keys(v);
    for (const k of keys) walk(v[k], p ? `${p}.${k}` : k, k);
  };
  walk(value, "", "");
  return out;
}

const TOKEN_RE = /\{[A-Za-z_][\w]*\}/;

/** isCopyLike(s) — the audit's test for a string leaf that reads as copy. */
export function isCopyLike(s) {
  return typeof s === "string" && /[A-Za-z]/.test(s) && (/\s/.test(s.trim()) || /[.!?…]$/.test(s.trim()));
}

function tableRows(value, walkKind) {
  // [[rowKey, row]] in table order
  const rows = [];
  if (walkKind === "bestiary") {
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object" && typeof v.n === "string") rows.push([v.n, v]);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(value);
    return rows;
  }
  if (Array.isArray(value)) {
    value.forEach((row, i) => {
      const k = row && typeof row === "object" ? (row.n ?? row.id ?? row.name ?? String(i)) : String(i);
      rows.push([String(k), row]);
    });
    return rows;
  }
  if (value && typeof value === "object") for (const [k, row] of Object.entries(value)) rows.push([k, row]);
  return rows;
}

const getPath = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

// ---------------------------------------------------------------------------
// The raw sweep
// ---------------------------------------------------------------------------

const CONTEXT_DROP_RE = /(?:console\.\w+|Error|\bfrom|\bimport|require|querySelector(?:All)?|getElementById|closest|matches|addEventListener|removeEventListener|matchMedia|classList\.\w+|getItem|setItem|removeItem|getPropertyValue|setProperty|removeProperty|createElement|getAttribute|hasAttribute|removeAttribute|toggleAttribute|dispatchEvent|CustomEvent|Event|postMessage|===|!==|==|!=|\bcase|\bok\s*:\s*false\s*,\s*(?:reason|error)\s*:)\s*\(?\s*$/;

/** looksLikeCopy(text) — the raw sweep's keep test (documented in the header). */
export function looksLikeCopy(text) {
  const t = text.trim();
  if ((t.match(/[A-Za-z]/g) ?? []).length < 2) return false;
  if (t === "use strict") return false;
  if (/^(?:\.{0,2}\/|https?:|data:|file:|mailto:)/i.test(t)) return false;
  if (/\.(?:png|jpe?g|svg|webp|gif|js|mjs|cjs|css|json|html|mp3|ogg|wav|m4a|txt|md)\b/i.test(t) && !/\s\w+\s/.test(t)) return false;
  if (/^[#.[@:]/.test(t) && !/[.!?…]$/.test(t)) return false;
  if (/(?:\d+px|…px|rgba?\(|hsla?\(|var\(--|calc\(|!important|cubic-bezier|\d+ms\b|[a-z]\d*\((?!\s))/i.test(t) && !/[.!?]$/.test(t)) return false;
  if (/^\(?[a-z-]+\s*:\s*[^\s]+\)?;?$/.test(t)) return false;
  if (/^[a-z-]+\s*:\s*[^;]+;/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length === 1) return /^[A-Za-z][\w'’-]*[A-Za-z][.!?]$|^[A-Za-z][A-Za-z'’]*…$/.test(t);
  // A class list: lowercase tokens, at least one of them kebab-cased.
  if (words.every((w) => /^[a-z0-9…_-]+$/.test(w)) && words.some((w) => /^[a-z0-9]+(?:-[a-z0-9…]*)+$/.test(w))) return false;
  const codeish = (w) => /[=()[\]{}<>]/.test(w) || /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(w) || /^[a-z]+[A-Z][\w$]*$/.test(w) || /^[.#]/.test(w) || /^[\w-]+:[\w-]+$/.test(w);
  if (words.every(codeish)) return false;
  return true;
}

function literalContextDropped(code, lit) {
  const before = code.slice(Math.max(0, lit.start - 48), lit.start);
  if (CONTEXT_DROP_RE.test(before)) return true;
  // an object key: previous significant char is { or , and the next is :
  const prev = before.replace(/\s+$/, "").slice(-1);
  const after = code.slice(lit.end, lit.end + 8).replace(/^\s+/, "");
  if (after[0] === ":" && (prev === "{" || prev === ",")) return true;
  return false;
}

function sweepJs(src, placeholder = "…") {
  const { code, literals } = lexJs(src, placeholder);
  const decls = topLevelDecls(code);
  const out = [];
  for (const lit of literals) {
    if (literalContextDropped(code, lit)) continue;
    const text = normalizeText(decodeJsEscapes(lit.raw));
    if (!looksLikeCopy(text)) continue;
    out.push({ decl: declAt(decls, lit.start), text, pos: lit.start });
  }
  return out;
}

function sweepHtml(html) {
  const src = blankHtmlComments(html);
  const out = [];
  // script blocks
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(src))) {
    const bodyStart = m.index + m[0].indexOf(">") + 1;
    for (const hit of sweepJs(m[1])) out.push({ ...hit, pos: bodyStart + hit.pos });
  }
  // markup: text nodes and the attributes a player (or a screen reader) reads
  const markup = src.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (s) => s.replace(/[^\n]/g, " ")).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (s) => s.replace(/[^\n]/g, " "));
  const tagRe = /<[^>]*>/g;
  let last = 0;
  const texts = [];
  while ((m = tagRe.exec(markup))) {
    texts.push({ text: markup.slice(last, m.index), pos: last });
    for (const a of m[0].matchAll(/\b(aria-label|title|alt|placeholder)\s*=\s*"([^"]*)"/gi)) texts.push({ text: a[2], pos: m.index });
    last = m.index + m[0].length;
  }
  texts.push({ text: markup.slice(last), pos: last });
  for (const t of texts) {
    const text = normalizeText(t.text);
    if (text && looksLikeCopy(text)) out.push({ decl: "markup", text, pos: t.pos });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Building the corpus
// ---------------------------------------------------------------------------

const moduleUrl = (root, rel) => url.pathToFileURL(path.join(root, rel)).href;

async function tryImport(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { missing: true };
  try {
    return { mod: await import(moduleUrl(root, rel)) };
  } catch (err) {
    return { error: String(err?.message ?? err).split("\n")[0] };
  }
}

function rawSurface(key, file) {
  for (const r of RAW_SURFACES) {
    if (r.keys && r.keys.includes(key)) return r.surface;
    if (r.files && r.files.includes(file)) return r.surface;
    if (r.fileMatch && new RegExp(r.fileMatch).test(file)) return r.surface;
  }
  return "other";
}

function renderText(out) {
  if (out == null) return "";
  if (typeof out === "string") return normalizeText(out);
  if (typeof out === "object" && typeof out.text === "string") return normalizeText(out.text);
  return "";
}

/**
 * buildCorpus({ root }) — the whole corpus of the tree at `root`:
 *   { entries, absent, counts, renderings }
 * `entries` are sorted by SURFACES order, then key; each is
 *   { key, surface, owner, source, trigger, domain?, template?, texts, errors? }.
 * `absent` lists registered modules/exports missing from the tree.
 * `renderings` (not serialised) maps each builder type to its per-variant
 * Oracle and rail texts, for scanTwins.
 */
export async function buildCorpus({ root = REPO_ROOT } = {}) {
  const prof = process.env.VOICE_CORPUS_PROFILE ? (label) => console.error(`[voice-corpus] ${label} ${Date.now() - t0}ms`) : () => {};
  const t0 = Date.now();
  const entries = [];
  const absent = [];
  const emitters = await scanEmitters({ root });
  prof("emitters");
  const renderings = new Map();
  const curated = new Set();

  const pushEntry = (e) => {
    const texts = [];
    for (const t of e.texts) if (t && !texts.includes(t)) texts.push(t);
    e.texts = texts;
    for (const t of texts) curated.add(t);
    entries.push(e);
  };

  // 1. Builders
  const builderSources = [
    { module: "src/browser/eventNarration.js", export: "EVENT_NARRATION", prefix: "oracle", surface: "oracle", call: (fn, ev) => fn(ev) },
    { module: "src/browser/narrationLines.js", export: "LINE_FOR", prefix: "rail", surface: "rail", call: (fn, ev) => fn(ev, {}) },
  ];
  for (const bs of builderSources) {
    const { mod, missing, error } = await tryImport(root, bs.module);
    const tableObj = mod?.[bs.export];
    if (!tableObj) { absent.push({ module: bs.module, export: bs.export, why: missing ? "module missing" : error ? `import failed: ${error}` : "export missing" }); continue; }
    for (const type of Object.keys(tableObj)) {
      const fn = tableObj[type];
      if (typeof fn !== "function") continue;
      const texts = [];
      const errors = [];
      const perVariant = {};
      for (const v of variantsFor(type)) {
        let t = "";
        try { t = renderText(bs.call(fn, v.event)); } catch { errors.push(v.id); continue; }
        perVariant[v.id] = t;
        texts.push(t);
      }
      if (!renderings.has(type)) renderings.set(type, {});
      renderings.get(type)[bs.prefix] = perVariant;
      const domain = domainOf(type, emitters);
      const surface = REFUSAL_RE.test(type) ? "refusals" : bs.surface;
      const e = {
        key: `${bs.prefix}:${type}`, kind: "builder", type, surface, module: bs.module, export: bs.export, domain,
        source: `${bs.module}#${bs.export}`, trigger: triggerFor(type, emitters), texts, errors,
      };
      pushEntry(e);
    }
  }

  prof("builders");
  // 2. Banks
  for (const b of BANK_REGISTRY) {
    const { mod, missing, error } = await tryImport(root, b.module);
    if (!mod || !(b.export in mod)) { absent.push({ module: b.module, export: b.export, why: missing ? "module missing" : error ? `import failed: ${error}` : "export missing" }); continue; }
    const value = mod[b.export];
    const leaves = typeof value === "string" ? [["", value]] : stringLeaves(value, b.pick ?? null);
    for (const [p, s] of leaves) {
      pushEntry({
        key: `bank:${b.export}${p ? `.${p}` : ""}`, kind: "bank", surface: b.surface, module: b.module, export: b.export,
        source: `${b.module}#${b.export}`, trigger: b.trigger, template: TOKEN_RE.test(s), texts: [normalizeText(s)],
      });
    }
  }
  // 2b. Generated sources (79-03's identity footers)
  for (const g of GENERATED_SOURCES) {
    const { mod, missing, error } = await tryImport(root, g.module);
    const fn = mod?.[g.export];
    if (typeof fn !== "function") { absent.push({ module: g.module, export: g.export, why: missing ? "module missing" : error ? `import failed: ${error}` : "export missing" }); continue; }
    const classes = (await tryImport(root, "content/classes.js")).mod?.CLASSES ?? {};
    const races = (await tryImport(root, "content/races.js")).mod?.RACES ?? {};
    const keys = [
      ...Object.values(classes).flatMap((c) => c.subs ?? []).map((k) => ["sub", k]),
      ...Object.keys(races).map((k) => ["race", k]),
    ];
    for (const [kind, k] of keys) {
      let lines = [];
      let errors = [];
      try { lines = [].concat(fn(kind, k) ?? []).map((l) => normalizeText(l)); } catch { errors = ["call"]; }
      pushEntry({
        key: `bank:${g.id}.${kind}.${k}`, kind: "bank", surface: g.surface, module: g.module, export: g.id,
        source: `${g.module}#${g.export}`, trigger: g.trigger, template: false, texts: lines, errors,
      });
    }
  }

  prof("banks");
  // 3. Content tables
  for (const t of CONTENT_FIELDS) {
    const { mod, missing, error } = await tryImport(root, t.module);
    if (!mod || !(t.export in mod)) { absent.push({ module: t.module, export: t.export, why: missing ? "module missing" : error ? `import failed: ${error}` : "export missing" }); continue; }
    const used = new Map();
    for (const [rk, row] of tableRows(mod[t.export], t.walk)) {
      const seenN = (used.get(rk) ?? 0) + 1;
      used.set(rk, seenN);
      const rowKey = seenN > 1 ? `${rk}~${seenN}` : rk;
      for (const f of t.fields) {
        const v = getPath(row, f);
        if (typeof v !== "string") continue;
        pushEntry({
          key: `content:${t.export}.${rowKey}.${f}`, kind: "content", surface: t.surface, module: t.module, export: t.export,
          source: `${t.module}#${t.export}`, trigger: t.trigger, template: TOKEN_RE.test(v), texts: [normalizeText(v)],
        });
      }
    }
  }

  prof("content");
  // 4. The raw sweep
  const covered = new Map(); // module -> Set(export names walked or declared non-copy)
  for (const r of [...BANK_REGISTRY, ...CONTENT_FIELDS, ...NON_COPY_EXPORTS]) {
    if (!covered.has(r.module)) covered.set(r.module, new Set());
    covered.get(r.module).add(r.export);
  }
  const rawFiles = [
    ...listJs(path.join(root, "src", "browser")).filter((f) => f !== "eventNarration.js" && f !== "narrationLines.js").map((f) => `src/browser/${f}`),
    ...listJs(path.join(root, "engine")).map((f) => `engine/${f}`),
    ...(fs.existsSync(path.join(root, "mazeworld.html")) ? ["mazeworld.html"] : []),
  ];
  const rawEntries = new Map();
  for (const file of rawFiles) {
    const src = readText(path.join(root, file));
    const hits = file.endsWith(".html") ? sweepHtml(src) : sweepJs(src);
    const skip = covered.get(file) ?? new Set();
    for (const h of hits) {
      if (skip.has(h.decl)) continue;
      if (curated.has(h.text)) continue;
      const key = `raw:${file}#${h.decl}`;
      if (!rawEntries.has(key)) {
        rawEntries.set(key, {
          key, kind: "raw", surface: rawSurface(key, file), module: file, export: h.decl,
          source: key.slice(4), trigger: `inline literal in ${file}#${h.decl}`, texts: [],
        });
      }
      rawEntries.get(key).texts.push(h.text);
    }
  }
  // A {token} in a source literal is a template placeholder by construction
  // (the literal is the source, not a rendering), so a raw entry holding one
  // is a template entry like a {token} bank.
  for (const e of rawEntries.values()) {
    e.template = e.texts.some((t) => TOKEN_RE.test(t));
    pushEntry(e);
  }
  prof("raw");

  // Owners, then the fixed order.
  for (const e of entries) e.owner = ownerOf(e);
  const order = new Map(SURFACES.map((s, i) => [s, i]));
  entries.sort((a, b) => (order.get(a.surface) - order.get(b.surface)) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const shaped = entries.map(shapeEntry);
  absent.sort((a, b) => (`${a.module}#${a.export}` < `${b.module}#${b.export}` ? -1 : 1));
  return { entries: shaped, absent, counts: countCorpus(shaped), renderings };
}

function shapeEntry(e) {
  const out = { key: e.key, surface: e.surface, owner: e.owner, source: e.source, trigger: e.trigger };
  if (e.kind === "builder") out.domain = e.domain;
  if (e.kind !== "builder") out.template = !!e.template;
  out.texts = e.texts;
  if (e.errors && e.errors.length) out.errors = e.errors;
  return out;
}

/** countCorpus(entries) — { total, texts, bySurface, byOwner } (fixed key order). */
export function countCorpus(entries) {
  const bySurface = Object.fromEntries(SURFACES.map((s) => [s, 0]));
  const owners = new Set(entries.map((e) => e.owner));
  const byOwner = Object.fromEntries([...owners].sort().map((o) => [o, 0]));
  let texts = 0;
  for (const e of entries) {
    bySurface[e.surface]++;
    byOwner[e.owner]++;
    texts += e.texts.length;
  }
  return { total: entries.length, texts, bySurface, byOwner };
}

/**
 * corpusJson(corpus, extra) — the serialised corpus: extra fields first
 * (e.g. base, command), then surfaces, counts, absent and entries. No
 * timestamps, so two builds of the same tree are byte-identical.
 */
export function corpusJson(corpus, extra = {}) {
  return JSON.stringify({ ...extra, surfaces: SURFACES, counts: corpus.counts, absent: corpus.absent, entries: corpus.entries }, null, 1) + "\n";
}

// ---------------------------------------------------------------------------
// The completeness guard
// ---------------------------------------------------------------------------

/**
 * auditRegistry({ root }) — { unregistered, absent, importFailures }:
 *   unregistered: [{ module, export, sample }] — an export with a copy-like
 *     string leaf in no registry;
 *   absent: registered rows whose module or export is missing;
 *   importFailures: [{ module, error }] for a module that failed to import
 *     and is not in NON_IMPORTABLE.
 */
export async function auditRegistry({ root = REPO_ROOT } = {}) {
  const registered = new Set([...BANK_REGISTRY, ...CONTENT_FIELDS, ...NON_COPY_EXPORTS].map((r) => `${r.module}#${r.export}`));
  const barrels = new Set(BARREL_MODULES.map((b) => b.module));
  const nonImportable = new Set(NON_IMPORTABLE.map((m) => m.module));
  const unregistered = [];
  const importFailures = [];
  const present = new Set();
  const modules = [
    ...listJs(path.join(root, "src", "browser")).map((f) => `src/browser/${f}`),
    ...listJs(path.join(root, "content")).map((f) => `content/${f}`),
  ];
  for (const rel of modules) {
    if (barrels.has(rel)) continue;
    const { mod, error } = await tryImport(root, rel);
    if (!mod) {
      if (!nonImportable.has(rel)) importFailures.push({ module: rel, error });
      continue;
    }
    for (const [name, value] of Object.entries(mod)) {
      present.add(`${rel}#${name}`);
      if (typeof value === "function") continue;
      const leaves = typeof value === "string" ? [["", value]] : stringLeaves(value);
      const copy = leaves.find(([, s]) => isCopyLike(s));
      if (!copy) continue;
      if (registered.has(`${rel}#${name}`)) continue;
      unregistered.push({ module: rel, export: name, sample: copy[1].slice(0, 80) });
    }
  }
  // 79-13: a non-copy row may name an engine export (the raw sweep reads
  // engine/, the module walk above does not); it is present when it exports it.
  for (const r of NON_COPY_EXPORTS) {
    if (!r.module.startsWith("engine/") || present.has(`${r.module}#${r.export}`)) continue;
    const { mod } = await tryImport(root, r.module);
    if (mod && r.export in mod) present.add(`${r.module}#${r.export}`);
  }
  const absent = [...BANK_REGISTRY, ...CONTENT_FIELDS, ...NON_COPY_EXPORTS]
    .filter((r) => !present.has(`${r.module}#${r.export}`))
    .map((r) => ({ module: r.module, export: r.export }));
  for (const g of GENERATED_SOURCES) {
    const { mod } = await tryImport(root, g.module);
    if (typeof mod?.[g.export] !== "function") absent.push({ module: g.module, export: g.export });
  }
  return { unregistered, absent, importFailures };
}
