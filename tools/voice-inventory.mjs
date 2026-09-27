#!/usr/bin/env node
// tools/voice-inventory.mjs
//
// Phase 79 (VOX-05, ROLL-04), 79-01 — the narration pass's one command.
// Builds the live narration corpus (tools/lib/voice-corpus.mjs#buildCorpus:
// every player-facing string with its surface, trigger, narration domain
// and owning Phase 79 plan), then lists it or runs the checks
// (tools/lib/voice-checks.mjs) over it. docs/narrative-pass/README.md is
// the method this tool serves; every rewrite plan runs it with its own
// `--owner`.
//
// Usage:
//   node tools/voice-inventory.mjs [filters] [--table | --json] [--out <file>]
//   node tools/voice-inventory.mjs [filters] --roll-under --hygiene --twins --safety [--table | --json] [--count]
//   node tools/voice-inventory.mjs [filters] --diff [--base <file>]
//   node tools/voice-inventory.mjs --check-ledgers [--plan 79-NN] [--after] [--coverage] [--base <file>]
//   node tools/voice-inventory.mjs --json --base-sha <sha> --out docs/narrative-pass/corpus-base.json
//   node tools/voice-inventory.mjs --self-test
//
// Filters (each repeatable as a comma list; all must match):
//   --owner 79-NN      entries owned by that plan
//   --surface <name>   entries on that surface (SURFACES order)
//   --domain <d>       builder entries in that domain (fight, powers, world)
//   --key <k>          an exact key, or a prefix ending in "*"
//
// Output modes:
//   (none)             a one-line-per-entry listing: key [owner] surface, then its texts
//   --table            markdown rows: surface | key | owner | trigger | text (one row per text)
//   --json             the corpus (or the hits, in a check mode) as JSON
//   --out <file>       write the output to a file instead of stdout
//   --base-sha <sha>   with --json: add `base` and `command` fields (the phase-base snapshot)
//
// Check modes (any combination; hits are listed per rule):
//   --roll-under       ROLL-04 roll-under phrasing
//   --hygiene          leaked values, unfilled tokens, ASCII signs and ranges, wp/WP, retired names, spacing
//   --twins            a number a rail line prints that its Oracle twin lacks
//   --safety           the family-friendly word list
//   --count            print only the total number of hits; exit 1 when it is above 0
//
// Other modes:
//   --diff             added, removed and changed keys against --base (default docs/narrative-pass/corpus-base.json)
//   --check-ledgers    validate docs/narrative-pass/why/*.json against the base: schema and before-side;
//                      --after also checks every after is in the live corpus; --coverage also requires a
//                      row for every key that changed; --plan narrows the report to one plan's rows and keys
//   --self-test        every pattern and rule against its own fixtures, and PLAYER_WP's sameness
//   --root <dir>       build the corpus from another tree (default: this repo)
//
// Exit codes: 0 clean, 1 a check found something (with --count or --check-ledgers or --self-test), 2 bad usage.
// Node built-ins only.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { buildCorpus, corpusJson, countCorpus, SURFACES, REPO_ROOT } from "./lib/voice-corpus.mjs";
import {
  scanRollUnder, scanHygiene, scanTwins, scanSafety, checkFixtures, playerWpSameness, readLedgers, validateLedgers,
} from "./lib/voice-checks.mjs";

const DEFAULT_BASE = "docs/narrative-pass/corpus-base.json";

function parseArgs(argv) {
  const opts = { owner: [], surface: [], domain: [], key: [], checks: [] };
  const flags = new Set(["--table", "--json", "--count", "--diff", "--check-ledgers", "--after", "--coverage", "--self-test"]);
  const valued = new Set(["--owner", "--surface", "--domain", "--key", "--base", "--plan", "--out", "--root", "--base-sha"]);
  const checks = new Set(["--roll-under", "--hygiene", "--twins", "--safety"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (checks.has(a)) opts.checks.push(a.slice(2));
    else if (flags.has(a)) opts[a.slice(2)] = true;
    else if (valued.has(a)) {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      const name = a.slice(2);
      if (Array.isArray(opts[name])) opts[name].push(...v.split(","));
      else opts[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    } else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

function matchesFilters(e, o) {
  if (o.owner.length && !o.owner.includes(e.owner)) return false;
  if (o.surface.length && !o.surface.includes(e.surface)) return false;
  if (o.domain.length && !o.domain.includes(e.domain)) return false;
  if (o.key.length && !o.key.some((k) => (k.endsWith("*") ? e.key.startsWith(k.slice(0, -1)) : e.key === k))) return false;
  return true;
}

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

function entryTable(entries) {
  const lines = ["| surface | key | owner | trigger | text |", "| --- | --- | --- | --- | --- |"];
  for (const e of entries) {
    const texts = e.texts.length ? e.texts : [""];
    for (const t of texts) lines.push(`| ${e.surface} | ${cell(e.key)} | ${e.owner} | ${cell(e.trigger)} | ${cell(t)} |`);
  }
  return lines.join("\n") + "\n";
}

function entryListing(entries) {
  const lines = [];
  for (const e of entries) {
    lines.push(`${e.key} [${e.owner}] ${e.surface}${e.domain ? ` ${e.domain}` : ""} — ${e.trigger}`);
    for (const t of e.texts) lines.push(`    ${t}`);
  }
  return lines.join("\n") + "\n";
}

function hitTable(hits) {
  const lines = ["| rule | key | owner | match | text |", "| --- | --- | --- | --- | --- |"];
  for (const h of hits) lines.push(`| ${h.rule} | ${cell(h.key)} | ${h.owner} | ${cell(h.match)} | ${cell(h.rule === "twin" ? `rail: ${h.text} / oracle: ${h.oracle} (${h.variants} variants)` : h.text)} |`);
  return lines.join("\n") + "\n";
}

function hitListing(hits) {
  return hits.map((h) => `${h.rule}  ${h.key} [${h.owner}]  «${h.match}»  ${h.rule === "twin" ? `rail: ${h.text} | oracle: ${h.oracle} (${h.variants} variants)` : h.text}`).join("\n") + (hits.length ? "\n" : "");
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

function selfTest(root) {
  const failures = checkFixtures();
  const wp = playerWpSameness(root);
  if (!wp.ok) failures.push(`standing-wp: PLAYER_WP differs from test/unit/hp-not-wp.test.js (theirs ${wp.theirs}, ours ${wp.ours})`);
  for (const f of failures) console.log(f);
  console.log(failures.length ? `self-test: FAIL (${failures.length})` : "self-test: PASS");
  return failures.length ? 1 : 0;
}

async function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err.message));
    console.error("usage: see the header of tools/voice-inventory.mjs");
    return 2;
  }
  const root = o.root ? path.resolve(o.root) : REPO_ROOT;
  if (o["self-test"]) return selfTest(root);

  const emit = (text) => {
    if (o.out) fs.writeFileSync(path.resolve(o.out), text, "utf8");
    else process.stdout.write(text);
  };
  const basePath = path.resolve(root, o.base ?? DEFAULT_BASE);

  if (o["check-ledgers"]) {
    if (!fs.existsSync(basePath)) { console.error(`no base snapshot at ${basePath}`); return 2; }
    const base = loadJson(basePath);
    const ledgers = readLedgers(path.join(root, "docs", "narrative-pass", "why"));
    const current = o.after || o.coverage ? await buildCorpus({ root }) : null;
    let errors = validateLedgers({ base, current, ledgers }, { checkAfter: !!o.after, coverage: !!o.coverage });
    if (o.plan) {
      const ownKeys = new Set((current?.entries ?? base.entries).filter((e) => e.owner === o.plan).map((e) => e.key));
      errors = errors.filter((e) => e.startsWith(`${o.plan} `) || e.startsWith(`${o.plan}:`) || (e.startsWith("coverage: ") && ownKeys.has(e.slice(10).split(" ")[0])));
    }
    for (const e of errors) console.log(e);
    console.log(`check-ledgers: ${ledgers.length} ledger file(s), ${errors.length} error(s)`);
    return errors.length ? 1 : 0;
  }

  const corpus = await buildCorpus({ root });
  const entries = corpus.entries.filter((e) => matchesFilters(e, o));
  const filtered = { ...corpus, entries, counts: countCorpus(entries) };

  if (o.diff) {
    if (!fs.existsSync(basePath)) { console.error(`no base snapshot at ${basePath}`); return 2; }
    const base = loadJson(basePath);
    const baseMap = new Map(base.entries.filter((e) => matchesFilters(e, o)).map((e) => [e.key, e]));
    const curMap = new Map(entries.map((e) => [e.key, e]));
    const rows = [];
    for (const [k, e] of curMap) {
      const b = baseMap.get(k);
      if (!b) rows.push({ change: "added", key: k, owner: e.owner, before: [], after: e.texts });
      else if (JSON.stringify(b.texts) !== JSON.stringify(e.texts)) rows.push({ change: "changed", key: k, owner: e.owner, before: b.texts, after: e.texts });
    }
    for (const [k, b] of baseMap) if (!curMap.has(k)) rows.push({ change: "removed", key: k, owner: b.owner, before: b.texts, after: [] });
    rows.sort((a, b) => (a.key < b.key ? -1 : 1));
    if (o.json) emit(JSON.stringify(rows, null, 1) + "\n");
    else if (o.count) emit(`${rows.length}\n`);
    else emit(rows.map((r) => `${r.change}  ${r.key} [${r.owner}]\n${r.before.map((t) => `  - ${t}`).join("\n")}${r.before.length ? "\n" : ""}${r.after.map((t) => `  + ${t}`).join("\n")}${r.after.length ? "\n" : ""}`).join(""));
    return 0;
  }

  if (o.checks.length) {
    const hits = [];
    for (const c of o.checks) {
      if (c === "roll-under") hits.push(...scanRollUnder(filtered));
      if (c === "hygiene") hits.push(...scanHygiene(filtered));
      if (c === "twins") hits.push(...scanTwins(filtered));
      if (c === "safety") hits.push(...scanSafety(filtered));
    }
    if (o.count) { emit(`${hits.length}\n`); return hits.length ? 1 : 0; }
    if (o.json) emit(JSON.stringify(hits, null, 1) + "\n");
    else if (o.table) emit(hitTable(hits));
    else emit(hitListing(hits) + `${hits.length} hit(s)\n`);
    return 0;
  }

  if (o.count) { emit(`${entries.length}\n`); return 0; }
  if (o.json) {
    const extra = {};
    if (o.baseSha) {
      extra.base = o.baseSha;
      extra.command = `node tools/voice-inventory.mjs --json --base-sha ${o.baseSha} --out ${DEFAULT_BASE}`;
    }
    emit(corpusJson(filtered, extra));
    return 0;
  }
  if (o.table) { emit(entryTable(entries)); return 0; }
  emit(entryListing(entries) + `${entries.length} entries on ${SURFACES.filter((s) => filtered.counts.bySurface[s]).length} surfaces\n`);
  return 0;
}

if (path.resolve(process.argv[1] || "") === url.fileURLToPath(import.meta.url)) {
  // exitCode, not exit(): a piped listing is never cut short.
  main().then((code) => { process.exitCode = code; }, (err) => { console.error(err?.stack ?? err); process.exitCode = 2; });
}
