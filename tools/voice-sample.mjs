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
const MOD_NAMES = ["weapon", "class", "dark-cap", "insulted", "fluency", "armor-bulk", "size"];

// Phase 75 (75-13): a handful of event types carry a NEW field-driven
// branch (RULES-05/07/08/12/13/14/15) that the closed vocabularies above
// never randomly reach on their own (a rolled `feat`/`why`/`mirror`/
// `destroyed`/`booksKept`/`reason:"notWielded"` is a needle in a wide
// haystack). SAMPLE_OVERRIDES names, per event type, a field patch applied
// to exactly the FIRST of that type's SAMPLES_PER_TYPE samples (index 0) —
// every other sample keeps the fully-random draw above, so tone variety
// across the remaining lines is untouched. This guarantees the human voice
// skim always shows each new branch at least once, deterministically.
const SAMPLE_OVERRIDES = {
  useRefused: { reason: "notWielded" },
  wentHungry: { booksKept: true },
  wardRaised: { mirror: true },
  wardReflected: { mirror: true },
  afflictionRolled: { roll: 5 },
  tileResumed: { feat: "chest" },
  itemEquipped: { destroyed: true, discarded: { n: "Leather" } },
  itemTaken: { destroyed: true, discarded: { n: "Leather" } },
  combatJoined: { why: "senses" },
  // VOX-05 (Phase 79, plan 79-13): 79-02's honest gains. Every clamped gain
  // shows its capped branch once ("+3 hp … (8 rolled, back to full)"), the
  // cloak its used-at-full line, and Table 4 (an ARRAY: one patch per
  // sample index) its hp loss and its capped heal, with the engine's own
  // prose (engine/encounters.js#tableFour). A raise (faerieBoon, leveled,
  // the +25 HP row) always gains what it rolls, so the random draw shows it.
  healed: { spell: "Heal", amount: 8, gained: 3 },
  potionDrunk: { amount: 8, gained: 3, remaining: 1 },
  regenerated: { amount: 8, gained: 3 },
  healTick: { item: "Cloak of Regeneration", amount: 5, gained: 0, tick: 1, ticks: 3 }, // Phase 88: replaces the retired use-time instant-heal sample
  secondWindHealed: { amount: 3, gained: 3, rolled: 8 },
  memberSecondWind: { name: "Grunk", amount: 3, gained: 3, rolled: 8 },
  cooked: { wp: 8, gained: 3, rations: 1 },
  foodFound: { name: "Chicken", wp: 12, gained: 3 },
  bought: { item: "Chicken (+12 hp)", cost: 20, gained: 3, meal: 12 },
  tableFour: [
    { row: "-15 HP", stat: "hp", amount: -19, result: "The maze extracts a toll you did not agree to." },
    { row: "+10 HP", stat: "hp", amount: 3, rolled: 8, gained: 3, result: "The maze, for once, gives something back." },
  ],
};

const ITEM_NAME_TYPES = new Set(["bought", "itemCooled", "itemEffectFaded", "itemEffectStarted", "pilferFumbled", "staffRecharged"]);

// A representative, randomly-filled event carrying every field any builder
// reads. Re-rolled per line so tone variety across a run is visible.
function sampleEvent(type, sampleIndex = 0) {
  const foe = pick(FOES);
  const dieN = 20;
  const modCount = 1 + (rng() < 0.5 ? 1 : 0);
  const mods = Array.from({ length: modCount }, () => ({
    name: pick(MOD_NAMES),
    delta: (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 3)),
  }));
  const base = {
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
    // RULES-11 (Phase 75.2): constant fields, no new random draw (adding one
    // here would reshuffle every sample after it) — `size` (the character's
    // CURRENT resulting size name), `step` (this item's own +1) and
    // `sizeDmg` (the matching damage delta) mirror 75.2-02's own
    // itemEffectStarted/conditionsOf payload shape exactly.
    size: "Large", step: 1, sizeDmg: 2,
  };
  // 79-13: these types carry the item's NAME, not the `{ n }` object
  // (tools/lib/event-variants.mjs#TYPE_FIELDS makes the same correction);
  // the drawn name is reused, so no rng draw moves.
  if (ITEM_NAME_TYPES.has(type)) base.item = base.item.n;
  const o = SAMPLE_OVERRIDES[type];
  const patch = Array.isArray(o) ? o[sampleIndex] : sampleIndex === 0 ? o : undefined;
  return patch ? { ...base, ...patch } : base;
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
    try { out = stripMarkup(fn(sampleEvent(type, i))); } catch (e) { out = `‹builder threw: ${e.message}›`; }
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

// RULES-11 (Phase 75.2, Plan 05): a short, fully deterministic block (fixed
// fields, zero rng() calls — inserting one earlier in this file would
// reshuffle every random sample above) proving the Gauntlet of the
// Giant/Enlarge start lines render their size fields honestly, no restated
// formula. Both kinds are mechanically identical (each exactly a +1 step),
// so one shared field set renders both.
const SIZE_ITEM_KINDS = ["giant", "enlarge"];
lines.push(rule("═"));
lines.push("## SIZE ITEMS — giant/enlarge deterministic sample (RULES-11, Phase 75.2)");
lines.push(rule("═"));
lines.push("");
for (const kind of SIZE_ITEM_KINDS) {
  const event = { type: "itemEffectStarted", kind, left: 50, size: "Large", step: 1, sizeDmg: 2 };
  lines.push(`▶ itemEffectStarted (${kind})`);
  lines.push(`    ${stripMarkup(EVENT_NARRATION.itemEffectStarted(event))}`);
  lines.push("");
}

// RULES-18 (Phase 75.3, Plan 07): the four control-at-depth events, from
// constant fields (zero rng() calls, placed after every random sample so
// nothing above reshuffles). One deep Freeze, shaken off with its roll; one
// that lands as a three-round hold, ticks down and breaks; and the stone
// hold's break, so every hold word shows at least once.
const CONTROL_AT_DEPTH_SAMPLES = [
  { type: "controlResisted", target: "Grim Stalka Beast", effect: "freeze", source: "Freeze", roll: 17, atLeast: 13, dieN: 20, depth: 20 },
  { type: "controlHeld", target: "Grim Stalka Beast", kind: "frozen", rounds: 3, source: "Freeze" },
  { type: "foeStillHeld", name: "Grim Stalka Beast", kind: "frozen", left: 2 },
  { type: "foeHoldBroken", name: "Grim Stalka Beast", kind: "frozen" },
  { type: "controlHeld", target: "Dread Vampire", kind: "stone", rounds: 3, source: "Petrify" },
  { type: "foeStillHeld", name: "Dread Vampire", kind: "stone", left: 1 },
  { type: "foeHoldBroken", name: "Dread Vampire", kind: "stone" },
];
lines.push(rule("═"));
lines.push("## CONTROL AT DEPTH — deterministic sample (RULES-18, Phase 75.3)");
lines.push(rule("═"));
lines.push("");
for (const event of CONTROL_AT_DEPTH_SAMPLES) {
  lines.push(`▶ ${event.type}${event.kind ? ` (${event.kind})` : ""}`);
  lines.push(`    ${stripMarkup(EVENT_NARRATION[event.type](event))}`);
  lines.push("");
}

const totalLines = Object.keys(EVENT_NARRATION).length * SAMPLES_PER_TYPE +
  Object.values(EPITAPHS).reduce((n, a) => n + a.length, 0) +
  SIZE_ITEM_KINDS.length +
  CONTROL_AT_DEPTH_SAMPLES.length;
lines.push(rule("═"));
lines.push(`Total rendered voice lines: ${totalLines}`);
lines.push(rule("═"));

fs.writeFileSync(OUT_FILE, lines.join("\n") + "\n", "utf8");
console.log(`voice-sample: wrote ${totalLines} lines to ${path.relative(process.cwd(), OUT_FILE)}`);
