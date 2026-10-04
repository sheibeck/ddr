// tools/lib/flavor-review.mjs
//
// Phase 96 (FLAVOR-06; CONTEXT 'The review: Mechanism and Verdicts'): the
// review mechanism that sits beside the Phase 79 why-ledgers.
//
// A why-ledger row says what changed and why (before / after / why). It has no
// room for a repeatable judgement, so a reviewer's verdicts live in their own
// files under docs/narrative-pass/verdicts/, one file per round:
//
//   { "round": 1, "reviewer": "<who>", "rows": [
//       { "key": "bank:SPELL_FLAVOR.Heal", "h": "1a2b3c4d", "verdict": "pass" },
//       { "key": "...", "h": "...", "verdict": "revise", "fails": ["voice"], "note": "..." } ] }
//
// `key` is the ledger key (compared exactly, code unit for code unit). `h` is
// the first eight hex characters of the SHA-1 of the line's UTF-8 text, so a
// verdict is tied to the exact wording it judged: a rewritten line makes the
// old hash stale and the review page says so.
//
// The reviewed set is exactly the player lines the Phase 95 and Phase 96
// ledgers added (every key in docs/narrative-pass/why/y-95-*.json and
// y-96-*.json), resolved to the last `after` in plan order.
//
// Node built-ins only. Presentation tooling: no engine import, no rng. The
// repo modules the worksheet prints from are imported dynamically, inside
// worksheet(), so the page generator can load this file cheaply.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { readLedgers } from "./voice-checks.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const VERDICT_DIR = "docs/narrative-pass/verdicts";
export const LEDGER_DIR = "docs/narrative-pass/why";

/** The ledger files whose keys are the reviewed set: y-95-NN.json and y-96-NN.json. */
export const REVIEWED_PLAN = /^y-9[56]-/;

/** The five checks, in the order a worksheet lists them. A verdict records failures only. */
export const REVIEW_CHECKS = Object.freeze(["voice", "family", "numberFree", "consistent", "goodBad"]);

/** What each check asks (also quoted in docs/narrative-pass/README.md). */
export const REVIEW_CHECKLIST = Object.freeze({
  voice: "sarcastic, deadpan, in the house voice; a plain restatement of the rule in other words fails",
  family: "family-friendly: nothing crude, gory or adult, and the sarcasm lands on the adventurer or the trope, never a real group",
  numberFree: "states no number, die, percentage or number word, in disguise either (a duration, a count, a doubling)",
  consistent: "points the same way as its rules text, never contradicts it, never promises more than it delivers",
  goodBad: "for a tagged race or sub-class line: the wording conveys at least one tagged good and one tagged bad a player could act on (a joke with no information fails)",
});

/**
 * USER_OWNED_LINES — lines the user accepted as their own example. If a
 * reviewer disagrees with one, the round that closes the review records a pass
 * with `userOwned: true` and the concern in the note; the line is never
 * rewritten.
 */
export const USER_OWNED_LINES = Object.freeze(["bank:SPELL_FLAVOR.Heal"]);

const VERDICTS = Object.freeze(["pass", "revise"]);
const ROW_FIELDS = Object.freeze(["key", "h", "verdict", "fails", "note", "selfChecked", "userOwned"]);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const isText = (v) => typeof v === "string" && v.trim() !== "";

/** lineHash(text) — the first eight lowercase hex characters of the SHA-1 of the UTF-8 text. */
export function lineHash(text) {
  return crypto.createHash("sha1").update(String(text), "utf8").digest("hex").slice(0, 8);
}

/**
 * reviewedLines({ ledgers }) — [{ key, line, plan }] for every key the
 * y-95-* and y-96-* ledgers added, in code-unit key order. `line` is the last
 * `after` in plan order (a rewritten line is judged in its final wording);
 * `plan` is the plan that set it. A key whose last row removes the line
 * (`after` empty) is no longer a line and is left out.
 */
export function reviewedLines({ ledgers } = {}) {
  const last = new Map();
  for (const { plan, rows } of ledgers ?? []) {
    if (!REVIEWED_PLAN.test(String(plan)) || !Array.isArray(rows)) continue;
    for (const r of rows) {
      if (!r || typeof r.key !== "string") continue;
      last.set(r.key, { key: r.key, line: typeof r.after === "string" ? r.after : "", plan });
    }
  }
  return [...last.values()].filter((e) => e.line !== "").sort((a, b) => cmp(a.key, b.key));
}

/**
 * readVerdicts(dir) — [{ file, round, reviewer, rows }] for every .json file in
 * `dir`, sorted by file name (none when the directory is missing). A file that
 * does not parse reads { file, parseError }. CRLF and a BOM are tolerated.
 */
export function readVerdicts(dir = path.join(REPO_ROOT, VERDICT_DIR)) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
      try {
        const v = JSON.parse(raw);
        return { file, ...(v && typeof v === "object" && !Array.isArray(v) ? v : { parseError: "not a JSON object" }) };
      } catch (err) {
        return { file, parseError: String(err.message) };
      }
    });
}

/**
 * validateVerdicts({ verdicts, lines }, { coverage }) — error strings (empty =
 * valid). `verdicts` is readVerdicts()'s shape, `lines` is reviewedLines()'s.
 * Checks the header, every row's shape, key membership, duplicate (key, round)
 * across files and, unless `coverage` is false, that a round-1 file covers
 * every reviewed line. It does NOT compare hashes with the current lines: a
 * verdict that outlives a rewrite is stale, not invalid (validateClosed and the
 * review page deal with staleness).
 */
export function validateVerdicts({ verdicts, lines }, { coverage = true } = {}) {
  const errors = [];
  const known = new Set((lines ?? []).map((l) => l.key));
  const seen = new Map();
  (verdicts ?? []).forEach((v, fi) => {
    const file = v && typeof v.file === "string" ? v.file : `verdict file ${fi}`;
    if (!v || v.parseError) { errors.push(`${file}: does not parse (${v ? v.parseError : "empty"})`); return; }
    if (!Number.isInteger(v.round) || v.round < 1) errors.push(`${file}: header needs a round that is a whole number from 1`);
    if (!isText(v.reviewer)) errors.push(`${file}: header needs a reviewer`);
    if (!Array.isArray(v.rows)) { errors.push(`${file}: rows is not an array`); return; }
    const inFile = new Set();
    v.rows.forEach((r, i) => {
      const at = `${file}: row ${i}${r && typeof r.key === "string" ? ` (${r.key})` : ""}`;
      if (!r || typeof r !== "object" || Array.isArray(r)) { errors.push(`${at}: not an object`); return; }
      for (const f of Object.keys(r)) if (!ROW_FIELDS.includes(f)) errors.push(`${at}: unknown field ${f}`);
      if (typeof r.key !== "string" || r.key === "") { errors.push(`${at}: no key`); return; }
      if (!known.has(r.key)) errors.push(`${at}: unknown key (not a Phase 95 or 96 ledger key)`);
      if (typeof r.h !== "string" || !/^[0-9a-f]{8}$/.test(r.h)) errors.push(`${at}: h is not eight lowercase hex characters`);
      const dup = `${r.key}\u0000${v.round}`;
      if (seen.has(dup)) errors.push(`${at}: duplicate (key, round ${v.round}) also in ${seen.get(dup)}`);
      else seen.set(dup, file);
      inFile.add(r.key);
      if (r.verdict === null || r.verdict === undefined) errors.push(`${at}: no verdict`);
      else if (!VERDICTS.includes(r.verdict)) errors.push(`${at}: unknown verdict ${JSON.stringify(r.verdict)} (pass or revise)`);
      const fails = r.fails;
      if (fails !== undefined && !Array.isArray(fails)) errors.push(`${at}: fails is not an array`);
      const failList = Array.isArray(fails) ? fails : [];
      for (const f of failList) if (!REVIEW_CHECKS.includes(f)) errors.push(`${at}: unknown check ${JSON.stringify(f)} in fails`);
      if (new Set(failList).size !== failList.length) errors.push(`${at}: fails lists a check twice`);
      if (r.verdict === "revise") {
        if (!failList.length) errors.push(`${at}: a revise needs at least one failed check`);
        if (!isText(r.note)) errors.push(`${at}: a revise needs a note`);
      }
      if (r.verdict === "pass" && failList.length) errors.push(`${at}: a pass lists a failed check`);
      if (r.note !== undefined && typeof r.note !== "string") errors.push(`${at}: note is not a string`);
      if (r.selfChecked !== undefined && r.selfChecked !== true) errors.push(`${at}: selfChecked is only ever true`);
      if (r.userOwned !== undefined) {
        if (r.userOwned !== true) errors.push(`${at}: userOwned is only ever true`);
        else if (!USER_OWNED_LINES.includes(r.key)) errors.push(`${at}: userOwned is valid only on ${USER_OWNED_LINES.join(", ")}`);
        else if (r.verdict !== "pass") errors.push(`${at}: a user-owned line is recorded as a pass, never rewritten`);
      }
    });
    if (coverage && v.round === 1) {
      for (const l of lines ?? []) if (!inFile.has(l.key)) errors.push(`${file}: round 1 misses ${l.key}`);
    }
  });
  return errors;
}

/**
 * validateClosed({ verdicts, lines }) — { errors, selfChecked }. The review is
 * closed when every reviewed key's LATEST verdict (highest round) is a pass
 * whose hash equals the hash of the current line. Also fails a round-2 or
 * later row for a key no earlier round revised. `selfChecked` lists the rows
 * flagged `selfChecked: true` as { key, round, file }.
 */
export function validateClosed({ verdicts, lines }) {
  const errors = validateVerdicts({ verdicts, lines }, { coverage: false });
  const selfChecked = [];
  const byKey = new Map();
  for (const v of verdicts ?? []) {
    if (!v || v.parseError || !Array.isArray(v.rows) || !Number.isInteger(v.round)) continue;
    for (const r of v.rows) {
      if (!r || typeof r.key !== "string") continue;
      const list = byKey.get(r.key) ?? [];
      list.push({ ...r, round: v.round, file: v.file });
      byKey.set(r.key, list);
      if (r.selfChecked === true) selfChecked.push({ key: r.key, round: v.round, file: v.file });
    }
  }
  for (const { key, line } of lines ?? []) {
    const rows = (byKey.get(key) ?? []).filter((r) => VERDICTS.includes(r.verdict)).sort((a, b) => a.round - b.round);
    if (!rows.length) { errors.push(`${key}: unreviewed (no pass or revise verdict)`); continue; }
    rows.forEach((r) => {
      if (r.round >= 2 && !rows.some((p) => p.round < r.round && p.verdict === "revise")) {
        errors.push(`${key}: round ${r.round} row but no earlier round revised it`);
      }
    });
    const latest = rows[rows.length - 1];
    if (latest.verdict !== "pass") errors.push(`${key}: latest verdict is ${latest.verdict} (round ${latest.round})`);
    else if (latest.h !== lineHash(line)) errors.push(`${key}: stale: the line changed after its round ${latest.round} verdict`);
  }
  return { errors, selfChecked };
}

// ─── The worksheet ─────────────────────────────────────────────────────────

const DOMAIN_LABEL = Object.freeze({ rules: "the RULES toggle words" });

const imp = (root, rel) => import(url.pathToFileURL(path.join(root, rel)).href);

/** sliceTable(src, name) — the object literal assigned to `const <name> =` in a source text, evaluated; asserts it was found. */
function sliceTable(src, name) {
  const head = new RegExp(`(?:^|\\n)const ${name} = \\{`).exec(src);
  if (!head) throw new Error(`worksheet: table ${name} not found in mazeworld.html`);
  const start = head.index + head[0].length - 1;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2) + 1;
    } else if (c === "{") {
      depth++;
    } else if (c === "}" && --depth === 0) {
      return new Function(`return (${src.slice(start, i + 1)});`)();
    }
  }
  throw new Error(`worksheet: table ${name} is not closed`);
}

/**
 * worksheet({ root }) — { entries, problems }. `entries` is one record per
 * reviewed key in the page's domain order (spell, scroll, potion, tool, bag,
 * magic, weapon, armor, race, sub, class, ability, skill, chip, then the
 * RULES_COPY toggle words), keys in content-table order:
 *   { key, domain, domainKey, line, hash, rules: [text], tagged: { good: [{id,text}], bad: [...], neutral: [...] } }
 * `problems` lists a key the live exports cannot resolve, or whose ledger line
 * differs from the live line. Nothing is hand-kept: every domain comes from
 * FLAVOR_DOMAINS (exportName), every rules text from the live content.
 */
export async function worksheet({ root = REPO_ROOT } = {}) {
  const ledgers = readLedgers(path.join(root, LEDGER_DIR));
  const lines = reviewedLines({ ledgers });
  const { FLAVOR_DOMAINS, flavorTagsOf } = await imp(root, "src/browser/flavorText.js");
  const C = await imp(root, "content/index.js");
  const { identityEntries, footerLines } = await imp(root, "src/browser/identityFooter.js");
  const { GEAR_COPY } = await imp(root, "src/browser/gearTab.js");
  const { COMBAT_MENU_COPY } = await imp(root, "src/browser/combatMenu.js");
  const { RULES_COPY } = await imp(root, "src/browser/rulesLayer.js");
  const html = fs.readFileSync(path.join(root, "mazeworld.html"), "utf8");
  const tables = {
    cond: sliceTable(html, "CONDITION_EXPLAIN"),
    foe: sliceTable(html, "FOE_EFFECT_EXPLAIN"),
    out: sliceTable(html, "HERO_OUT_EXPLAIN"),
    haste: sliceTable(html, "HASTE_SPELL_EXPLAIN"),
  };
  const mirror = /if \(cn\.key === "ward" && cn\.mirror\) \{\s*return ("(?:[^"\\]|\\.)*");/.exec(html);
  if (!mirror) throw new Error("worksheet: the Bubble mirror ward sentence was not found in mazeworld.html");
  const mirrorText = JSON.parse(mirror[1]);

  const named = (rows, field, name) => rows.find((r) => r[field] === name);
  const jsonRow = (row) => (row ? JSON.stringify(row) : "");
  const rulesOf = (domain, k) => {
    switch (domain) {
      case "spell": return [named(C.SPELLS, "n", k)?.txt];
      case "scroll": return [GEAR_COPY.scrollDesc];
      case "potion": return [named(C.POTIONS, "n", k)?.txt];
      case "tool": return [k === "Lockpicks" ? "6–10 on d10 against any lock" : Object.values(C.TOOLS).find((t) => t.n === k)?.txt];
      case "bag": return [Object.values(C.BAG_ITEMS).find((b) => b.n === k)?.txt];
      case "magic": return [[...C.JEWELRY, ...C.CLOAKS, ...C.STAVES].find((m) => m.n === k)?.txt];
      case "weapon": return ["generated stat line", jsonRow(C.WEAPONS[k])];
      case "armor": return ["generated stat line", jsonRow(named(C.ARMORS, "name", k))];
      case "race": return [C.RACE_NOTE[k], ...footerLines("race", k)];
      case "sub": return [C.SUB_NOTE[k], ...footerLines("sub", k)];
      case "class": return [C.CLASS_NOTE[k]];
      case "ability": return [k === "Sing" ? COMBAT_MENU_COPY.singDesc : named(C.ABILITIES, "name", k)?.txt];
      case "skill": {
        const row = C.FIGHTER_SKILLS[k] ?? C.THIEF_SKILLS[k];
        return [row?.txt, row?.txt2];
      }
      case "chip": {
        if (k === "foeEffect/dazed" || k === "foeEffect/weakened") return [tables.foe[k.split("/")[1]]];
        if (k === "heroOut/stopped") return [tables.out.stopped];
        if (k === "ward/mirror") return [mirrorText];
        if (k === "haste/Speed of Sound") return [tables.haste["Speed of Sound"]];
        return [tables.cond[k]];
      }
      case "rules": return ["(toggle word)"];
      default: return [];
    }
  };

  const problems = [];
  const order = [...FLAVOR_DOMAINS.map((d) => d.id), "rules"];
  const entries = [];
  for (const { key, line } of lines) {
    let domain = null;
    let domainKey = null;
    let liveLine;
    if (key.startsWith("bank:RULES_COPY.")) {
      domain = "rules";
      domainKey = key.slice("bank:RULES_COPY.".length);
      liveLine = RULES_COPY[domainKey];
    } else if (key.startsWith("bank:")) {
      const rest = key.slice("bank:".length);
      for (const d of FLAVOR_DOMAINS) {
        let k = null;
        if (rest === d.exportName) k = d.id === "scroll" ? "Scroll" : null;
        else if (rest.startsWith(`${d.exportName}.`)) k = rest.slice(d.exportName.length + 1);
        if (k === null) continue;
        if ((d.id === "race" || d.id === "sub") && k.endsWith(".line")) k = k.slice(0, -".line".length);
        if (!d.keys().includes(k)) continue;
        domain = d.id;
        domainKey = k;
        liveLine = d.lines()?.[k];
        break;
      }
    }
    if (!domain) { problems.push(`${key}: no domain resolves this key (FLAVOR_DOMAINS exportName)`); continue; }
    if (liveLine !== line) problems.push(`${key}: the ledger's final line differs from the line the game prints now`);
    const rules = rulesOf(domain, domainKey).filter((t) => typeof t === "string" && t !== "");
    if (!rules.length) problems.push(`${key}: no rules text found`);
    const tagged = { good: [], bad: [], neutral: [] };
    if (domain === "race" || domain === "sub") {
      const tags = flavorTagsOf(domain, domainKey);
      const entriesOf = identityEntries(domain, domainKey);
      const textOf = (id) => entriesOf.find((e) => e.id === id)?.text ?? "(no identity entry with this id)";
      for (const id of tags.good) tagged.good.push({ id, text: textOf(id) });
      for (const id of tags.bad) tagged.bad.push({ id, text: textOf(id) });
      if (tags.neutral) tagged.neutral.push({ id: tags.neutral, text: textOf(tags.neutral) });
    }
    entries.push({ key, domain, domainKey, line, hash: lineHash(line), rules, tagged });
  }
  const keyIndex = new Map();
  for (const d of FLAVOR_DOMAINS) keyIndex.set(d.id, d.keys());
  const rank = (e) => (keyIndex.get(e.domain) ?? []).indexOf(e.domainKey);
  entries.sort((a, b) => order.indexOf(a.domain) - order.indexOf(b.domain) || (a.domain === "rules" ? cmp(RULES_ORDER(a), RULES_ORDER(b)) : rank(a) - rank(b)));
  return { entries, problems };
}

const RULES_ORDER = (e) => ["closed", "open", "label"].indexOf(e.domainKey);

/** formatWorksheet(entries, { domain }) — the text the reviewer reads; every entry opens with a line that starts with its ledger key. */
export function formatWorksheet(entries, { domain } = {}) {
  const out = [];
  for (const e of entries) {
    if (domain && e.domain !== domain) continue;
    out.push(`${e.key}`);
    out.push(`  domain: ${e.domain}${DOMAIN_LABEL[e.domain] ? ` (${DOMAIN_LABEL[e.domain]})` : ""}   hash: ${e.hash}`);
    out.push(`  LINE:  ${e.line}`);
    e.rules.forEach((t, i) => out.push(`  ${i === 0 ? "RULES:" : "      "} ${t}`));
    for (const side of ["good", "bad", "neutral"]) for (const t of e.tagged[side]) out.push(`  tagged ${side} ${t.id}: ${t.text}`);
    out.push("");
  }
  return out.join("\n");
}
