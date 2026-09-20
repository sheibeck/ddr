// test/unit/hp-not-wp.test.js
//
// Phase 43 (CLAR-01 HP-not-WP sweep) — the standing guard proving no
// player-facing string anywhere in the app says "wp"/"WP". Scans: (a) every
// EVENT_NARRATION/LINE_FOR builder across bare/numeric-rich/name-rich
// payloads; (b) every string leaf of RAIL_COPY/ITEM_STATE_COPY/
// ABILITY_VIEW_COPY/COMBAT_MENU_COPY/COMBAT_PANEL_COPY/MISS_LINES; (c) every
// note/txt/txt2 of the content banks; (d) mazeworld.html's player-facing
// markup text and script string literals (comments stripped first); (e) the
// same scan on www/index.html when the build artifact is present.
//
// PLAYER_WP is a standing guard, not a one-shot check: it is exercised
// against known-safe code identifiers (c.wp, maxWP, cb-foe-wp, wp: 12,
// viewport, mwpulse) and known-bad player copy (" wp/day", "+d10+2 wp",
// "75 WP", "(WP)") in a self-check test below, so a future accidental
// widen/narrow of the regex itself is caught.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { RAIL_COPY } from "../../src/browser/rail.js";
import { ABILITY_VIEW_COPY, RATIONS_COPY, USABLE_COPY } from "../../src/browser/viewModels.js";
import { ITEM_STATE_COPY, GEAR_COPY } from "../../src/browser/gearTab.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { COMBAT_PANEL_COPY } from "../../src/browser/combatPanel.js";
import { MISS_LINES } from "../../src/browser/missLines.js";
import {
  RACES, FIGHTER_SKILLS, THIEF_SKILLS, POTIONS, JEWELRY, CLOAKS, STAVES, SPELLS, ABILITIES, TOOLS,
  RACE_NOTE, CLASS_NOTE, SUB_NOTE,
} from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** PLAYER_WP — matches a standalone "wp"/"WP" token, never a code
 * identifier fragment (c.wp, maxWP, cb-foe-wp are all excluded by the
 * lookbehind; `wp:` as an object-literal key is excluded by the lookahead).
 * Node 22 supports lookbehind. */
const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;

/** ALLOWLIST — exact offending snippets that are code identifiers the regex
 * could not exclude (never prose). Empty unless a real false positive is
 * found and documented here with a one-line reason. */
const ALLOWLIST = [];

function isAllowlisted(snippet) {
  return ALLOWLIST.some((entry) => snippet.includes(entry));
}

// ─── (a) EVENT_NARRATION / LINE_FOR builders ──────────────────────────────

function stripTags(html) {
  return String(html ?? "").replace(/<[^>]+>/g, " ");
}

const NUMERIC_RICH = {
  side: "approach", hurt: 3, loss: 2, charges: 2, max: 5, day: 3, amount: 2, cost: 4, hours: 2,
  roll: 7, need: 5, dmg: 6, spGained: 5, wpGain: 3, rations: 1, bonus: 2, count: 2, n: 2, r: 2,
  rounds: 3, rolls: 2, totalDamage: 8, might: 3, pool: 50, short: 5, table: 4, first: 2, mult: 2,
  remaining: 1, level: 2, depth: 3, steps: 40, total: 8, fluency: 2, left: 3, have: 10,
  attacks: 3, penalty: 2, fee: 25, stolen: 4, spell_charges: 2, price: 100,
};

const NAME_RICH = {
  name: "Viper", target: "Viper", member: "Grunk", kind: "Poison", spell: "Fireball", sub: "Apprentice",
  item: { n: "Dagger" }, items: [{ n: "A" }, { n: "B" }], result: "something", what: "a cloak",
  gift: "Magic Weapon", motive: "Blood", song: "a tune", by: "poisonedEdge", tool: "ladder",
  reason: "escaped", phobia: "Being trapped", replacedBy: "Someone new", troll: true, elfOrDwarf: true,
};

test("EVENT_NARRATION: no builder output contains a standalone wp/WP token, across bare/numeric-rich/name-rich payloads", () => {
  const offenders = [];
  for (const [type, fn] of Object.entries(EVENT_NARRATION)) {
    for (const variant of [{}, NUMERIC_RICH, NAME_RICH]) {
      let out;
      try {
        out = fn({ type, ...variant });
      } catch {
        continue; // a builder that guards its own fields and throws on a partial payload is not this test's concern
      }
      const text = stripTags(out).trim();
      const m = text.match(PLAYER_WP);
      if (m && !isAllowlisted(m[0])) offenders.push(`EVENT_NARRATION.${type} -> "${text}"`);
    }
  }
  assert.deepStrictEqual(offenders, [], `Player-facing wp/WP in EVENT_NARRATION:\n${offenders.join("\n")}`);
});

test("LINE_FOR: no builder .text contains a standalone wp/WP token, across bare/numeric-rich/name-rich payloads", () => {
  const offenders = [];
  for (const [type, fn] of Object.entries(LINE_FOR)) {
    for (const variant of [{}, NUMERIC_RICH, NAME_RICH]) {
      let out;
      try {
        out = fn({ type, ...variant });
      } catch {
        continue;
      }
      const text = stripTags(out?.text ?? "").trim();
      const m = text.match(PLAYER_WP);
      if (m && !isAllowlisted(m[0])) offenders.push(`LINE_FOR.${type} -> "${text}"`);
    }
  }
  assert.deepStrictEqual(offenders, [], `Player-facing wp/WP in LINE_FOR:\n${offenders.join("\n")}`);
});

// ─── (b) presentation COPY objects (recursive string-leaf walk) ────────────

function collectStringLeaves(obj, pathLabel = "") {
  const leaves = [];
  if (typeof obj === "string") {
    leaves.push([pathLabel, obj]);
    return leaves;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      leaves.push(...collectStringLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
    }
  }
  return leaves;
}

test("Presentation COPY objects: every string leaf is free of a standalone wp/WP token", () => {
  const banks = {
    RAIL_COPY, ITEM_STATE_COPY, ABILITY_VIEW_COPY, COMBAT_MENU_COPY, COMBAT_PANEL_COPY, MISS_LINES, RATIONS_COPY, USABLE_COPY, GEAR_COPY,
  };
  const offenders = [];
  for (const [bankName, bank] of Object.entries(banks)) {
    for (const [leafPath, value] of collectStringLeaves(bank)) {
      const m = value.match(PLAYER_WP);
      if (m && !isAllowlisted(m[0])) offenders.push(`${bankName}.${leafPath} -> "${value}"`);
    }
  }
  assert.deepStrictEqual(offenders, [], `Player-facing wp/WP in presentation COPY:\n${offenders.join("\n")}`);
});

// ─── (c) content banks (note/txt/txt2) ─────────────────────────────────────

test("Content banks: every note/txt/txt2 is free of a standalone wp/WP token", () => {
  const offenders = [];
  const check = (label, value) => {
    if (typeof value !== "string") return;
    const m = value.match(PLAYER_WP);
    if (m && !isAllowlisted(m[0])) offenders.push(`${label} -> "${value}"`);
  };

  for (const [k, r] of Object.entries(RACES)) check(`RACES.${k}.note`, r.note);
  for (const [bankName, bank] of [["FIGHTER_SKILLS", FIGHTER_SKILLS], ["THIEF_SKILLS", THIEF_SKILLS]]) {
    for (const [k, v] of Object.entries(bank)) {
      check(`${bankName}.${k}.txt`, v.txt);
      check(`${bankName}.${k}.txt2`, v.txt2);
    }
  }
  for (const p of POTIONS) check(`POTIONS.${p.n}.txt`, p.txt);
  for (const [bankName, bank] of [["JEWELRY", JEWELRY], ["CLOAKS", CLOAKS], ["STAVES", STAVES]]) {
    for (const it of bank) check(`${bankName}.${it.n}.txt`, it.txt);
  }
  for (const s of SPELLS) check(`SPELLS.${s.n}.txt`, s.txt);
  for (const a of ABILITIES) check(`ABILITIES.${a.id ?? a.name}.txt`, a.txt);
  for (const [k, v] of Object.entries(TOOLS)) check(`TOOLS.${k}.txt`, v.txt);
  for (const [bankName, bank] of [["RACE_NOTE", RACE_NOTE], ["CLASS_NOTE", CLASS_NOTE], ["SUB_NOTE", SUB_NOTE]]) {
    for (const [k, v] of Object.entries(bank)) check(`${bankName}.${k}`, v);
  }

  assert.deepStrictEqual(offenders, [], `Player-facing wp/WP in content banks:\n${offenders.join("\n")}`);
});

// ─── (d)/(e) mazeworld.html + www/index.html ───────────────────────────────

/** stripComments(source) — HTML comments stripped FIRST: mazeworld.html's
 * markup comments contain plain-English text that can itself look like a
 * JS block-comment opener (e.g. "icons/optimized/*.png" inside an HTML
 * comment reads as "/*" to a naive JS-comment regex) — stripping `<!-- -->`
 * before `/* *\/` prevents that false "/*" from swallowing everything up to
 * the next real "*\/" (which, unchecked, ate straight through the classic
 * `<script>` opening tag in this exact file — verified during authoring).
 * Line comments strip before block comments (mirrors test/unit/shell-
 * company-panel.test.js's own order for the remaining JS-only pass). */
function stripComments(source) {
  const noHtmlComments = source.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ""));
  const noLineComments = noHtmlComments
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

function extractBlocks(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const blocks = [];
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

function removeBlocks(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  return html.replace(re, " ");
}

/** STRING_TOKEN_RE — extracts "…"/'…'/`…` literals (with escapes handled). */
const STRING_TOKEN_RE = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

function stringLiteralsOf(js) {
  const tokens = js.match(STRING_TOKEN_RE) || [];
  return tokens.map((tok) => (tok.startsWith("`") ? tok.replace(/\$\{[^}]*\}/g, " ") : tok));
}

/** scanHtmlFile(label, html) — returns an array of offender strings for (d). */
function scanHtmlFile(label, html) {
  const offenders = [];
  const cleaned = stripComments(html);
  const scriptBodies = extractBlocks(cleaned, "script");
  let markup = removeBlocks(cleaned, "script");
  markup = removeBlocks(markup, "style");
  const markupText = markup.replace(/<[^>]+>/g, " ");

  for (const m of markupText.matchAll(new RegExp(PLAYER_WP, "g"))) {
    const snippet = markupText.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, " ").trim();
    if (!isAllowlisted(snippet)) offenders.push(`${label} markup -> "${snippet}"`);
  }
  for (const body of scriptBodies) {
    for (const lit of stringLiteralsOf(body)) {
      const m = lit.match(PLAYER_WP);
      if (m && !isAllowlisted(lit)) offenders.push(`${label} script literal -> ${lit}`);
    }
  }
  return offenders;
}

test("mazeworld.html: no player-facing markup text or script string literal contains a standalone wp/WP token", () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
  const offenders = scanHtmlFile("mazeworld.html", html);
  assert.deepStrictEqual(offenders, [], `Player-facing wp/WP in mazeworld.html:\n${offenders.join("\n")}`);
});

test("www/index.html (build artifact): same scan, skipped when www/ is absent", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) return; // skipped — www/ is a build artifact, not always present
  const html = fs.readFileSync(wwwPath, "utf8").replace(/\r\n/g, "\n");
  const offenders = scanHtmlFile("www/index.html", html);
  assert.deepStrictEqual(offenders, [], `Player-facing wp/WP in www/index.html:\n${offenders.join("\n")}`);
});

// ─── (f) src/browser/gearTab.js — Phase 47 Plan 03 carve; Plans 04/05 append
// their own modules to this same list ───────────────────────────────────────

test("src/browser/gearTab.js: no string literal contains a standalone wp/WP token", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n");
  const offenders = [];
  for (const lit of stringLiteralsOf(stripComments(src))) {
    const m = lit.match(PLAYER_WP);
    if (m && !isAllowlisted(lit)) offenders.push(`gearTab.js script literal -> ${lit}`);
  }
  assert.deepStrictEqual(offenders, [], `Player-facing wp/WP in src/browser/gearTab.js:\n${offenders.join("\n")}`);
});

// ─── standing-guard self-check: the regex itself must not drift ───────────

test("PLAYER_WP self-check: excludes code identifiers, matches real player copy", () => {
  for (const safe of ["c.wp", "maxWP", "cb-foe-wp", "wp: 12", "viewport", "mwpulse"]) {
    assert.equal(PLAYER_WP.test(safe), false, `PLAYER_WP must NOT match code identifier "${safe}"`);
  }
  for (const bad of [" wp/day", "+d10+2 wp", "75 WP", "(WP)"]) {
    assert.equal(PLAYER_WP.test(bad), true, `PLAYER_WP must match player copy "${bad}"`);
  }
});
