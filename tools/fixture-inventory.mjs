#!/usr/bin/env node
// tools/fixture-inventory.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped, NOT a node:test
// file (it makes no assertions, so `node --test` never picks it up). Prints
// the FID-01 fixture-roster inventory by REPLAYING every parity fixture
// through the existing parity harness (test/parity/harness/fixtureRoster.js)
// — this deliberately imports the parity harness, because the whole point of
// this tool is to replay the same code path the parity tests exercise, not
// to reason about seeds or read BESTIARY arrays by hand.
//
// Run:
//   node tools/fixture-inventory.mjs
//   node tools/fixture-inventory.mjs --json
//
// To regenerate test/parity/FIXTURE-INVENTORY.md's generated table: run this
// script with no flags, then paste its stdout verbatim between the
// `<!-- fixture-inventory:generated:begin -->` / `...:end -->` marker lines
// in that document, then run `node --test test/parity/fixture-inventory.test.js`
// to confirm the document and the live replay agree.

import { enumerateFixtureRoster, rosterToMarkdown } from "../test/parity/harness/fixtureRoster.js";

const rows = enumerateFixtureRoster();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(rosterToMarkdown(rows) + "\n");
}
