#!/usr/bin/env node
// tools/bridge-doc.mjs
//
// Phase 47 (SHELL-04) — generates the `## Module bridge` table in
// docs/SHELL-MODULES.md from src/browser/bridge.js's BRIDGE map. The map is
// the source of truth; this file and the doc's table are both derived.
//
// Usage:
//   node tools/bridge-doc.mjs             print the generated table to stdout
//   node tools/bridge-doc.mjs --write     replace the table between the
//                                         `<!-- bridge-table:start -->` /
//                                         `<!-- bridge-table:end -->` markers
//                                         in docs/SHELL-MODULES.md
//   node tools/bridge-doc.mjs --check     exit 1 (with a one-line message) if
//                                         the doc's table differs from the
//                                         generated one; exit 0 otherwise
//
// importable: `import { renderTable } from "../tools/bridge-doc.mjs"`
// (test/unit/bridge-registry.test.js's doc-sync test).
//
// node:fs + node:path only — no packages.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BRIDGE, bridgeNames } from "../src/browser/bridge.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "SHELL-MODULES.md");

const START_MARKER = "<!-- bridge-table:start -->";
const END_MARKER = "<!-- bridge-table:end -->";

/**
 * renderTable() — `| Name | Owner | Consumers | Purpose |` markdown table,
 * one row per BRIDGE key in sorted order (bridgeNames()'s own order).
 * Consumers are joined with `<br>` so a multi-consumer entry stays one row.
 */
function renderTable() {
  const header = "| Name | Owner | Consumers | Purpose |";
  const divider = "| --- | --- | --- | --- |";
  const rows = bridgeNames().map((name) => {
    const entry = BRIDGE[name];
    const consumers = entry.consumers.join("<br>");
    return `| ${name} | ${entry.owner} | ${consumers} | ${entry.purpose} |`;
  });
  return [header, divider, ...rows].join("\n");
}

function replaceMarkedTable(docText, table) {
  const startIdx = docText.indexOf(START_MARKER);
  const endIdx = docText.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`docs/SHELL-MODULES.md is missing a bridge-table marker (start=${startIdx}, end=${endIdx})`);
  }
  const before = docText.slice(0, startIdx + START_MARKER.length);
  const after = docText.slice(endIdx);
  return `${before}\n\n${table}\n\n${after}`;
}

function extractMarkedTable(docText) {
  const startIdx = docText.indexOf(START_MARKER);
  const endIdx = docText.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`docs/SHELL-MODULES.md is missing a bridge-table marker (start=${startIdx}, end=${endIdx})`);
  }
  return docText.slice(startIdx + START_MARKER.length, endIdx).trim();
}

function main() {
  const argv = process.argv.slice(2);
  const table = renderTable();

  if (argv.includes("--write")) {
    const docText = fs.readFileSync(DOC_PATH, "utf8");
    fs.writeFileSync(DOC_PATH, replaceMarkedTable(docText, table));
    console.log(`docs/SHELL-MODULES.md: bridge table written (${bridgeNames().length} rows)`);
    process.exit(0);
  }

  if (argv.includes("--check")) {
    const docText = fs.readFileSync(DOC_PATH, "utf8");
    const current = extractMarkedTable(docText);
    if (current !== table.trim()) {
      console.error("docs/SHELL-MODULES.md's bridge table disagrees with src/browser/bridge.js — run `node tools/bridge-doc.mjs --write`");
      process.exit(1);
    }
    process.exit(0);
  }

  console.log(table);
  process.exit(0);
}

export { renderTable };

// Direct-invocation guard — mirrors tools/ident-sweep.mjs's pattern.
if (path.resolve(process.argv[1] || "") === url.fileURLToPath(import.meta.url)) {
  main();
}
