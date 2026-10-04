#!/usr/bin/env node
// tools/flavor-review.mjs
//
// Phase 96 (FLAVOR-06; CONTEXT 'The review: Mechanism and Verdicts'): the
// reviewer's command line. Library: tools/lib/flavor-review.mjs. Process:
// docs/narrative-pass/README.md, "The Phase 96 review (FLAVOR-06)".
//
// Usage:
//   node tools/flavor-review.mjs --worksheet [--domain <id>]
//        print what a reviewer reads for every Phase 95 and 96 line: the ledger
//        key, the domain, the line, its hash, its exact rules text and, for a
//        race or sub-class, the tagged good and bad entries' texts
//   node tools/flavor-review.mjs --skeleton --round N --reviewer "<text>" --out <file>
//        write a verdict file with one row per reviewed key { key, h, verdict:
//        null } (round 1) or per key whose latest verdict is revise (round 2
//        and later; also any key with no verdict yet, e.g. a line added after
//        round 1). Every verdict is null: the validator rejects the file
//        until a reviewer has judged each line. --out must sit under
//        docs/narrative-pass/verdicts and must not exist yet.
//   node tools/flavor-review.mjs --check
//        validate every present verdict file (schema, key membership,
//        duplicates, round-1 coverage); exit 1 on any error; exit 0 with no
//        verdict file present
//   node tools/flavor-review.mjs --closed
//        also require every key's latest verdict to be a pass with a hash
//        equal to the current line's; exit 1 with no verdict file
//   --root <dir>   read and write under <dir> (tests)
//
// Exit 0 on success, 1 on errors, 2 on a bad flag. Node built-ins only. No
// script ever sets a verdict: the skeleton carries nulls.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { readLedgers } from "./lib/voice-checks.mjs";
import {
  LEDGER_DIR, VERDICT_DIR, formatWorksheet, lineHash, readVerdicts, reviewedLines, validateClosed, validateVerdicts, worksheet,
} from "./lib/flavor-review.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const FLAGS = new Set(["--worksheet", "--skeleton", "--check", "--closed", "--domain", "--round", "--reviewer", "--out", "--root"]);

function valueOf(argv, flag) {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
}

/** The verdict file text: a header, then one compact row per line (LF, 2-space indent). */
export function formatVerdictFile({ round, reviewer, rows }) {
  const body = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  return `{\n  "round": ${round},\n  "reviewer": ${JSON.stringify(reviewer)},\n  "rows": [\n${body}\n  ]\n}\n`;
}

async function main(argv) {
  const flags = argv.filter((a) => a.startsWith("--"));
  for (const f of flags) if (!FLAGS.has(f)) { console.error(`flavor-review: unknown flag ${f}`); return 2; }
  const rootArg = valueOf(argv, "--root");
  const root = rootArg ? path.resolve(rootArg) : REPO_ROOT;
  const modes = ["--worksheet", "--skeleton", "--check", "--closed"].filter((m) => flags.includes(m));
  if (modes.length !== 1) { console.error("flavor-review: give exactly one of --worksheet, --skeleton, --check, --closed"); return 2; }
  const mode = modes[0];
  const lines = reviewedLines({ ledgers: readLedgers(path.join(root, LEDGER_DIR)) });
  const verdicts = readVerdicts(path.join(root, VERDICT_DIR));

  if (mode === "--worksheet") {
    const { entries, problems } = await worksheet({ root });
    const domain = valueOf(argv, "--domain");
    process.stdout.write(formatWorksheet(entries, { domain }));
    for (const p of problems) console.error(`flavor-review: ${p}`);
    return problems.length ? 1 : 0;
  }

  if (mode === "--skeleton") {
    const roundText = valueOf(argv, "--round");
    const reviewer = valueOf(argv, "--reviewer");
    const out = valueOf(argv, "--out");
    const round = Number(roundText);
    if (!Number.isInteger(round) || round < 1 || !reviewer || !reviewer.trim() || !out) {
      console.error("flavor-review: --skeleton needs --round N (a whole number from 1), --reviewer \"<text>\" and --out <file>");
      return 2;
    }
    const dir = path.resolve(root, VERDICT_DIR);
    const target = path.resolve(root, out);
    if (path.dirname(target) !== dir) { console.error(`flavor-review: --out must be a file directly under ${VERDICT_DIR}`); return 2; }
    if (fs.existsSync(target)) { console.error(`flavor-review: ${out} exists; a skeleton never overwrites judged verdicts`); return 2; }
    const { entries, problems } = await worksheet({ root });
    if (problems.length) { for (const p of problems) console.error(`flavor-review: ${p}`); return 1; }
    let keep = entries;
    if (round >= 2) {
      const latest = new Map();
      for (const v of verdicts) {
        if (!Number.isInteger(v.round) || v.round >= round || !Array.isArray(v.rows)) continue;
        for (const r of v.rows) {
          const prior = latest.get(r.key);
          if (!prior || prior.round <= v.round) latest.set(r.key, { round: v.round, verdict: r.verdict });
        }
      }
      keep = entries.filter((e) => !latest.has(e.key) || latest.get(e.key).verdict === "revise");
    }
    const rows = keep.map((e) => ({ key: e.key, h: lineHash(e.line), verdict: null }));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(target, formatVerdictFile({ round, reviewer, rows }), "utf8");
    console.log(`flavor-review: wrote ${rows.length} null-verdict rows to ${path.relative(root, target)}`);
    return 0;
  }

  if (mode === "--check") {
    if (!verdicts.length) { console.log("flavor-review: no verdict file present; nothing to validate"); return 0; }
    const errors = validateVerdicts({ verdicts, lines });
    for (const e of errors) console.log(e);
    const byKey = new Map(lines.map((l) => [l.key, lineHash(l.line)]));
    const stale = verdicts.flatMap((v) => (Array.isArray(v.rows) ? v.rows.filter((r) => r && byKey.has(r.key) && r.h !== byKey.get(r.key)).map((r) => `${v.file}: ${r.key}`) : []));
    if (stale.length) console.log(`flavor-review: note: ${stale.length} verdict hash(es) differ from the current line (the review page shows them as stale):\n  ${stale.join("\n  ")}`);
    console.log(errors.length ? `flavor-review: ${errors.length} error(s)` : `flavor-review: ${verdicts.length} verdict file(s) valid`);
    return errors.length ? 1 : 0;
  }

  const { errors, selfChecked } = validateClosed({ verdicts, lines });
  for (const e of errors) console.log(e);
  if (selfChecked.length) console.log(`flavor-review: ${selfChecked.length} row(s) are selfChecked: ${selfChecked.map((s) => `${s.key} (round ${s.round})`).join(", ")}`);
  console.log(errors.length ? `flavor-review: not closed: ${errors.length} problem(s)` : `flavor-review: closed: all ${lines.length} lines pass with a matching hash`);
  return errors.length ? 1 : 0;
}

if (path.resolve(process.argv[1] || "") === url.fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => { console.error(err); process.exitCode = 1; });
}
