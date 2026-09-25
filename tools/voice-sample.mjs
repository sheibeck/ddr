#!/usr/bin/env node
// tools/voice-sample.mjs
//
// VOX-02 human-review artifact generator. Renders a broad, DETERMINISTIC
// sample of the game's actual authored voice — src/browser/eventNarration.js's
// EVENT_NARRATION table (the delivered VOX-01 voice system) plus
// content/epitaphs.js's EPITAPHS + CAUSE_TEXT — into a single readable text
// file (tools/voice-sample-output.txt) for the DEFERRED manual tone/"is it
// still funny?" skim.
//
// This is a REVIEW TOOL, not the safety guarantee: the exhaustive machine
// guardrail is test/voice/safety-scan.test.js. This script exists so a human
// can eyeball whether the deadpan sarcasm still lands across the full event
// vocabulary without scrolling the source.
//
// Node built-ins only (no dependency — offline / zero-SDK constraint). A fixed
// seed drives a tiny mulberry32 PRNG, so re-running produces byte-identical
// output (diff-friendly review).
//
// NOTE: this tool deliberately does NOT build or call any presentation/voice.js
// "narrate()" generator — that parallel system described in the stale
// 05-01/05-02 plans was never built and would duplicate EVENT_NARRATION, which
// is the real, shipped voice seam. This tool renders the real thing.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { EVENT_NARRATION } from "../src/browser/eventNarration.js";
import { EPITAPHS, CAUSE_TEXT } from "../content/epitaphs.js";
import { BESTIARY } from "../content/bestiary.js";
import { NAMES } from "../content/names.js";
import { RACES } from "../content/races.js";
import { SUB_NOTE, MOTIVES } from "../content/flavor.js";
import { SPELLS } from "../content/spells.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "voice-sample-output.txt");
const SEED = 0x5eed1e; // fixed → deterministic, re-runnable output

// ── tiny seeded PRNG (mulberry32) ───────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const stripMarkup = (s) => String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// ── closed vocabularies to fill tokens from ─────────────────────────────────
const FOES = [...new Set(Object.values(BESTIARY).flat(2).map((c) => c.n))];
// NAMES is now a { first, sur } generative bank per race (DR-name-generator);
// sample from the combined first + surname tokens.
const CHAR_NAMES = Object.values(NAMES).flatMap((p) => [...p.first, ...p.sur].filter(Boolean));
const SUBS = Object.keys(SUB_NOTE);
const RACE_NAMES = Object.keys(RACES);
const SPELL_NAMES = SPELLS.map((s) => s.n);
const ROMAN = ["I", "II", "III", "IV", "V"];

// Phase 73 (ROLL-05): the roll-carrying vocabulary every builder now reads —
// `roll` (the mirrored, high-is-good face, 1..dieN), `atLeast` (the lowest
// winning face, 1..dieN+1 so "nothing" is exercised too), `dieN` (fixed at
// 20 — the common check die every builder above formats through
// rollRange.js), `rolls` (a several-draws array, e.g. climb segments/wake
// hours), `mods` (one or two signed `{name, delta}` terms, signed for the
// ROLLER), and `critAtLeast` (a top-face crit threshold). The old roll-under
// `need`/`total` fields are gone — no event carries them anymore.
const MOD_NAMES = ["weapon", "class", "dark-cap", "insulted", "fluency", "armor-bulk"];

// A representative, randomly-filled event carrying every field any builder
// reads. Re-rolled per line so tone variety across a run is visible.
function sampleEvent(type) {
  const foe = pick(FOES);
  const dieN = 20;
  const modCount = 1 + (rng() < 0.5 ? 1 : 0);
  const mods = Array.from({ length: modCount }, () => ({
    name: pick(MOD_NAMES),
    delta: (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 3)),
  }));
  return {
    type,
    side: pick(["approach", "exit"]), hurt: 1 + Math.floor(rng() * 12), loss: Math.floor(rng() * 8),
    kind: pick(["Poison", "Disease"]), charges: 1 + Math.floor(rng() * 5), max: 5, day: 1 + Math.floor(rng() * 30),
    amount: 1 + Math.floor(rng() * 25), cost: 1 + Math.floor(rng() * 6), hours: 1 + Math.floor(rng() * 8),
    reason: pick(["parley", "descend", "wizard", "cloaker", "tracked", "other"]),
    foes: [{ name: foe }, { name: pick(FOES) }], name: foe, member: pick(CHAR_NAMES),
    tracked: rng() < 0.5, roll: 1 + Math.floor(rng() * dieN), target: pick(FOES),
    atLeast: 1 + Math.floor(rng() * (dieN + 1)), dieN, rolls: Array.from({ length: 1 + Math.floor(rng() * 3) }, () => 1 + Math.floor(rng() * dieN)),
    mods, critAtLeast: dieN - Math.floor(rng() * 2),
    critical: rng() < 0.3, dmg: 1 + Math.floor(rng() * 30), spGained: Math.floor(rng() * 50), wp: Math.floor(rng() * 20),
    rations: 1 + Math.floor(rng() * 3), bonus: Math.floor(rng() * 4), song: "a tune", count: 1 + Math.floor(rng() * 6),
    n: 1 + Math.floor(rng() * 6), r: 1 + Math.floor(rng() * 4), spell: pick(SPELL_NAMES), intel: 1 + Math.floor(rng() * 10),
    rounds: 1 + Math.floor(rng() * 6), totalDamage: Math.floor(rng() * 40),
    nextEncounter: "encounter", might: 1 + Math.floor(rng() * 8), pool: 50, reflect: rng() < 0.5, short: 1 + Math.floor(rng() * 50),
    item: { n: pick(["Dagger", "Katana", "Cloak of Speed", "Ring of Power"]) }, table: 1 + Math.floor(rng() * 8),
    result: "something odd", spells: [pick(SPELL_NAMES), pick(SPELL_NAMES)], what: "a cloak", gift: "Magic Weapon",
    first: Math.floor(rng() * 5), mult: pick([1, 2, 3]), remaining: Math.floor(rng() * 4), level: 1 + Math.floor(rng() * 5),
    wpGain: 1 + Math.floor(rng() * 6), depth: 1 + Math.floor(rng() * 5), steps: Math.floor(rng() * 2000),
    troll: rng() < 0.3, elfOrDwarf: rng() < 0.3, untouchable: rng() < 0.2,
  };
}

function fillEpitaph(tmpl) {
  const map = {
    foe: pick(FOES), name: pick(CHAR_NAMES), sub: pick(SUBS), race: pick(RACE_NAMES),
    lvl: pick(ROMAN), gold: Math.floor(rng() * 4000), sp: Math.floor(rng() * 2000),
    floor: 1 + Math.floor(rng() * 5), day: 1 + Math.floor(rng() * 40), motive: pick(MOTIVES),
  };
  return tmpl.replace(/\{([a-z]+)\}/gi, (_, k) => (k in map ? map[k] : `{${k}}`));
}

// ── build the artifact ──────────────────────────────────────────────────────
const SAMPLES_PER_TYPE = 3;
const lines = [];
const rule = (c = "─") => c.repeat(78);

lines.push(rule("═"));
lines.push("DELVE, DIE, REPEAT — VOICE SAMPLE (human tone review)");
lines.push(`Generated deterministically (seed 0x${SEED.toString(16)}) by tools/voice-sample.mjs`);
lines.push("Source: src/browser/eventNarration.js EVENT_NARRATION + content/epitaphs.js");
lines.push(rule("═"));
lines.push("");
lines.push(`## ORACLE / EVENT LOG — ${Object.keys(EVENT_NARRATION).length} event types × ${SAMPLES_PER_TYPE} samples`);
lines.push("");

for (const [type, fn] of Object.entries(EVENT_NARRATION)) {
  lines.push(`▶ ${type}`);
  for (let i = 0; i < SAMPLES_PER_TYPE; i++) {
    let out;
    try { out = stripMarkup(fn(sampleEvent(type))); } catch (e) { out = `‹builder threw: ${e.message}›`; }
    lines.push(`    ${out}`);
  }
  lines.push("");
}

lines.push(rule("═"));
lines.push("## DEATH EPITAPHS — every bucket");
lines.push(rule("═"));
lines.push("");
for (const [bucket, arr] of Object.entries(EPITAPHS)) {
  lines.push(`▶ ${bucket}  (cause note: "${fillEpitaph(CAUSE_TEXT[bucket] ?? "—")}")`);
  for (const tmpl of arr) lines.push(`    ${fillEpitaph(tmpl)}`);
  lines.push("");
}

const totalLines = Object.keys(EVENT_NARRATION).length * SAMPLES_PER_TYPE +
  Object.values(EPITAPHS).reduce((n, a) => n + a.length, 0);
lines.push(rule("═"));
lines.push(`Total rendered voice lines: ${totalLines}`);
lines.push(rule("═"));

fs.writeFileSync(OUT_FILE, lines.join("\n") + "\n", "utf8");
console.log(`voice-sample: wrote ${totalLines} lines to ${path.relative(process.cwd(), OUT_FILE)}`);
