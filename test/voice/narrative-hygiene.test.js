// test/voice/narrative-hygiene.test.js
//
// Phase 79 (VOX-05), plan 79-12 — the standing hygiene and twin guard over
// the whole narration corpus (tools/lib/voice-corpus.mjs#buildCorpus: every
// Oracle and rail builder rendered through the synthetic events, every
// registered copy bank, every content text field and the raw literal sweep
// of src/browser, engine and mazeworld.html).
//
// VOX-05 ("every line states clearly what happened, to whom and why") has
// two mechanical halves this file holds at zero:
//   - EMPTY AND ENCODING (tools/lib/voice-checks.mjs#HYGIENE_RULES): no
//     leaked undefined, NaN, null or [object …]; no unfilled {token} outside
//     a template; U+2212 for a minus and U+2013 for a range; no standalone
//     WP (HP, not WP); neither the retired working title nor "Maze Master";
//     clean spacing; and the house spelling ("armour", decided by 79-12 by
//     the corpus majority; item names such as the Cloak of Armor are proper
//     nouns and stay);
//   - ADJACENCY (scanTwins): a number the rail line prints that its Oracle
//     twin, rendered from the same event, lacks.
// Anything outside HYGIENE_EXCEPTIONS fails, and an exception that no longer
// matches a live string it would otherwise catch fails too (rot).

import test from "node:test";
import assert from "node:assert/strict";

import { buildCorpus } from "../../tools/lib/voice-corpus.mjs";
import { HYGIENE_RULES, HYGIENE_EXCEPTIONS, checkFixtures, scanHygiene, scanTwins } from "../../tools/lib/voice-checks.mjs";
import { playerNote } from "../../src/browser/combatPanel.js";

const corpus = await buildCorpus();
const byKey = new Map(corpus.entries.map((e) => [e.key, e]));
const compile = (r) => new RegExp(r.source, r.flags);

test("no vacuity: the corpus is the full narration corpus", () => {
  assert.ok(corpus.counts.texts > 2990, `texts: ${corpus.counts.texts}`);
  assert.ok(corpus.entries.length > 1500, `entries: ${corpus.entries.length}`);
  assert.ok(corpus.renderings && corpus.renderings.size > 250, "the per-variant renderings the twin check reads are present");
});

test("every hygiene rule has teeth both ways, and the rule set covers VOX-05's encoding list", () => {
  assert.deepEqual(checkFixtures(), []);
  const ids = HYGIENE_RULES.map((r) => r.id);
  for (const id of ["leaked-value", "unfilled-token", "ascii-sign", "hyphen-range", "standalone-wp", "retired-name", "spacing", "house-spelling"]) {
    assert.ok(ids.includes(id), `HYGIENE_RULES must keep "${id}"`);
  }
});

test("VOX-05 empty and encoding: zero hygiene hits over the whole corpus outside HYGIENE_EXCEPTIONS", () => {
  const hits = scanHygiene(corpus);
  assert.deepEqual(hits.map((h) => `${h.rule} ${h.key} [${h.owner}] «${h.match}» ${h.text}`), []);
});

test("VOX-05 adjacency: no rail line prints a number its Oracle twin lacks", () => {
  const hits = scanTwins(corpus);
  assert.deepEqual(hits.map((h) => `${h.key} [${h.owner}] missing ${h.match}: rail "${h.text}" / oracle "${h.oracle}" (${h.variants} variants)`), []);
});

test("no rot: every hygiene exception has a reason and matches a live string its rule would otherwise catch", () => {
  for (const x of HYGIENE_EXCEPTIONS) {
    assert.ok(x.reason && x.reason.length > 20, `${x.key}: an exception needs a reason`);
    const rule = HYGIENE_RULES.find((r) => r.id === x.rule);
    assert.ok(rule, `${x.key}: unknown rule ${x.rule}`);
    const e = byKey.get(x.key);
    assert.ok(e, `${x.key}: the key is no longer in the corpus`);
    const live = e.texts.filter((t) => new RegExp(x.match).test(t) && compile(rule).test(t));
    assert.ok(live.length > 0, `${x.key}: ${x.match} no longer matches a live ${x.rule} hit, so the exception is dead`);
  }
});

test("the bestiary wp exceptions hold only because the player reads the note through playerNote, which renders it clean", () => {
  const wp = compile(HYGIENE_RULES.find((r) => r.id === "standalone-wp"));
  const excepted = HYGIENE_EXCEPTIONS.filter((x) => x.rule === "standalone-wp");
  assert.ok(excepted.length > 0, "the two prototype-identical notes are listed");
  for (const x of excepted) {
    assert.match(x.key, /^content:BESTIARY\..+\.sp\.note$/, `${x.key}: only a bestiary note may keep a wp, and only for playerNote to render`);
    for (const t of byKey.get(x.key).texts) assert.equal(wp.test(playerNote(t)), false, `${x.key}: playerNote should render "${t}" without a wp`);
  }
});
