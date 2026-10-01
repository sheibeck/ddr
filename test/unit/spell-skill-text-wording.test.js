// test/unit/spell-skill-text-wording.test.js
//
// Phase 90 plan 11 (TEXT-01 for spells and skills, user 2026-09-30): the wording
// guard over every surface that tells a player what a spell, a skill or an
// ability does:
//   - every SPELLS, ABILITIES, FIGHTER_SKILLS and THIEF_SKILLS row `txt` (and a
//     skill's `txt2`),
//   - the live corpus (tools/lib/voice-corpus.mjs#buildCorpus) lines of the
//     spell and skill events, Oracle and rail, bare payload and a Joiner's,
//   - the foe chip sentences (FOE_CONDITION_DESC) and the hero chip sentences a
//     spell or skill puts up (CONDITION_EXPLAIN in mazeworld.html),
//   - the Grimoire rows (heroTab.js#grimoireViewModel) and the combat SPELLS menu
//     rows (combatMenu.js#combatMenuViewModel).
//
// The rules (90-CONTEXT "TEXT-01 for spells and skills", 89-CONTEXT's item rules):
//   - nobody speaks in faces: a shift is a signed to-hit ("+3 to hit", "foes −2
//     to hit you", "foes −2 to hit anyone on your side", "−2 to hit"); a hard
//     cap names its range on a d20 ("20 on a d20; 19–20 if you insulted them",
//     "18–20 on a d20; 17–20 if you insulted them"), computed here from the
//     engine's own winning faces through src/browser/rollRange.js;
//   - no "squares of" foes: an area effect says how many foes it reaches;
//   - a spell a foe can resist says so plainly (one sentence, GRIMOIRE_COPY
//     .resistNote, on the Grimoire row and the menu row, beside the menu's
//     per-target "resists on {range}"), and the deeper the floor, the likelier;
//   - parley wording says what a parley is (Chameleon Tongue);
//   - the orchestrator amendment: Q9 (the unturned Walking Dead swing only at the
//     caster: the Fixated chip), Q10 (Joiners use Stealth, Hardiness and
//     Ambidextrous: the skill wording), Q11 (Death Touch is one swing: if it
//     lands it doubles and finishes anything under 15 hp; once per fight; the
//     engine is unchanged), Q7 (Stupidity and Death hit the foe you picked).
//
// The four TEXT-01 probe edges (fallback probes, 90-11-PLAN truths):
//   ADJACENCY  rows that state one rule state it in the same computed words
//              (Mirror Self and Smoke; the Fighter-table Sidestep and the
//              catalog Sidestep; Kata and Feint); a table skill's txt equals its
//              catalog ability's txt.
//   EMPTY      a row with no roll wording is left as it is (Heal, Shield, Brace,
//              Sweep); every reworded line renders a bare payload with no
//              "undefined" or "NaN".
//   ENCODING   a negative shift uses the minus sign U+2212 and every range the
//              en dash U+2013 from rollRange.js; the checkers reject a
//              hyphen-minus in a shift or a range.
//   ORDERING   where a text states both a plain and an insulted case, the plain
//              case comes first and the insulted case follows in parentheses,
//              on every surface.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { SPELLS, ABILITIES, ABILITY_BY_ID, FIGHTER_SKILLS, THIEF_SKILLS } from "../../content/index.js";
import { foeToHitVs, foeSwingVsHero, strikeDie, spellTargetsFoe, risingResistFaces } from "../../engine/derived.js";
import { useAbility, abilityReadyAfter, KATA_FEINT_NEED_SHIFT, SWEEP_MIN_FOES } from "../../engine/abilities.js";
import { playerStrike, applyFoeDamageToPlayer } from "../../engine/combat.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { FOE_CONDITION_DESC } from "../../src/browser/foeConditions.js";
import { COMBAT_MENU_COPY, combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { grimoireViewModel, GRIMOIRE_COPY } from "../../src/browser/heroTab.js";
import { facesRangeText, hitRangeText, signedText } from "../../src/browser/rollRange.js";
import { buildCorpus } from "../../tools/lib/voice-corpus.mjs";

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
const html = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

const plain = (s) => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const MINUS = "−"; // U+2212, the minus sign every negative shift uses
const EN_DASH = "–"; // U+2013, the en dash every range uses

// --- local fixtures (this repo's per-file-fixture convention) -----------------

function fakeRng(seq, fill) {
  let i = 0;
  return {
    d(_sides) {
      if (i < seq.length) return seq[i++];
      if (fill !== undefined) return fill;
      throw new Error(`fakeRng: sequence exhausted at index ${i}`);
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Woodsman", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, intel: 10, timers: {},
    ...overrides,
  };
}

function fixedFloor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function fixedState(cOverrides = {}, rest = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const abilityTimer = (key) => ({ [`ability:${key}`]: { cadence: "rounds", left: 2, phase: "effect", cd: 5 } });

// --- the checkers (their own edges are tested below) --------------------------

/** toHitProblems(text) — every "N to hit" token must be [+−]N with N >= 1, the minus being U+2212. */
function toHitProblems(text) {
  const out = [];
  for (const m of String(text).matchAll(/(\S*?)(\d+) to hit/g)) {
    const sign = m[1].slice(-1);
    if (sign !== "+" && sign !== MINUS) out.push(`unsigned or hyphen-signed to-hit "${m[0]}"`);
    if (Number(m[2]) === 0) out.push(`zero to-hit "${m[0]}"`);
  }
  return out;
}

/** rangeProblems(text) — every "… on a d20" range is one number, or lo–hi with U+2013, low to high, on the d20. */
function rangeProblems(text) {
  const out = [];
  for (const m of String(text).matchAll(/(\d+)(?:([^\d\s])(\d+))? on a d20/g)) {
    const lo = Number(m[1]);
    if (m[2] === undefined) {
      if (lo < 1 || lo > 20) out.push(`range "${m[0]}" is off the d20`);
      continue;
    }
    const hi = Number(m[3]);
    if (m[2] !== EN_DASH) out.push(`range "${m[0]}" is not written with an en dash`);
    if (!(lo < hi)) out.push(`range "${m[0]}" does not read low to high`);
    if (lo < 1 || hi > 20) out.push(`range "${m[0]}" is off the d20`);
  }
  return out;
}

/** wordingProblems(text) — everything TEXT-01 bans from a spell or skill surface. */
function wordingProblems(text) {
  const t = plain(text);
  const out = [...toHitProblems(t), ...rangeProblems(t)];
  if (/\bfaces?\b/i.test(t)) out.push(`says "face(s)": ${t}`);
  if (/squares of (?:opponents?|enemies|enemy|foes?)/i.test(t)) out.push(`says "squares of" foes: ${t}`);
  if (/\bundefined\b|\bNaN\b/.test(t)) out.push(`leaks a bad value: ${t}`);
  return out;
}

/** statedD20Ranges(text) — the d20 ranges a text states, the plain case first, the insulted case after it. */
function statedD20Ranges(text) {
  const t = plain(text);
  const out = [];
  const first = t.match(/(\d+(?:–\d+)?) on a d20/);
  if (first) out.push(first[1]);
  const insulted = t.match(/; (\d+(?:–\d+)?) if (?:you )?insulted/);
  if (insulted) out.push(insulted[1]);
  return out;
}

// --- the engine's measured numbers (every stated range and shift is compared with these) ---

/** foeFaces(cOverrides, foeOverrides, combatOverrides) — a foe's winning faces against the hero, plain and insulted. */
function foeFaces(cOverrides = {}, foeOverrides = {}, combatOverrides = {}) {
  const foe = fixedFoe(foeOverrides);
  const at = (extra) => foeSwingVsHero(fixedState(cOverrides, { combat: fixedCombat([foe], { ...combatOverrides, ...extra }) }), foe).faces;
  return { plain: at({}), insulted: at({ parleyInsulted: true }) };
}
const d20Range = (faces) => facesRangeText(faces, 20);

const BASE = foeFaces();
const MIRROR = foeFaces({ mirror: 3 });
const SMOKE = foeFaces({ cls: "Thief", sub: "Burglar", timers: abilityTimer("smoke") });
const WEAKEN = foeFaces({}, {}, { foeToHitPenalty: 3, weakened: true });
const BLIND = foeFaces({}, { blind: true });
const COWER = foeFaces({}, { cowering: true });

/** shiftOf(timers) — the foe-side shift an ability's live effect puts on every foe, signed from the player's side. */
const shiftOf = (key) => -(foeToHitVs(fixedState({})) - foeToHitVs(fixedState({ timers: abilityTimer(key) })));

// --- the surfaces --------------------------------------------------------------

const catalogRows = [
  ...SPELLS.map((r) => ({ id: `SPELLS.${r.n}`, text: r.txt })),
  ...ABILITIES.map((r) => ({ id: `ABILITIES.${r.id}`, text: r.txt })),
  ...Object.entries(FIGHTER_SKILLS).flatMap(([n, r]) => [{ id: `FIGHTER_SKILLS.${n}`, text: r.txt }, ...(r.txt2 ? [{ id: `FIGHTER_SKILLS.${n}.txt2`, text: r.txt2 }] : [])]),
  ...Object.entries(THIEF_SKILLS).flatMap(([n, r]) => [{ id: `THIEF_SKILLS.${n}`, text: r.txt }, ...(r.txt2 ? [{ id: `THIEF_SKILLS.${n}.txt2`, text: r.txt2 }] : [])]),
];
const rowText = (id) => catalogRows.find((r) => r.id === id).text;

/** The spell and skill events whose Oracle and rail lines state a rule (read from the live corpus, bare and a Joiner's payloads). */
const EVENTS = [
  "battleRoarRaised", "sidestepped", "smokeThrown", "dirtyTrickLanded", "pommelStruck", "stealthStrike", "lastStandCalled",
  "weakened", "blinded", "mirrorSelf", "stupefied", "fumbleOnFoe", "foeCowers", "behemothCast", "foeRouted",
  "timeStopped", "foeMisdirected", "tongueCast", "doorIllusionSeen", "vaporRolled", "insaneRolled", "iceCast", "strengthCast",
  "spellEffectStarted", "walkingDeadTurned", "planeGated", "shrunk", "petrified", "memberHealed",
];
const corpus = await buildCorpus();
const eventLines = [];
for (const ev of EVENTS) {
  for (const prefix of ["oracle", "rail"]) {
    const entry = corpus.entries.find((e) => e.key === `${prefix}:${ev}`);
    if (!entry) continue;
    for (const [i, t] of entry.texts.entries()) eventLines.push({ id: `${prefix}:${ev}#${i}`, text: t });
  }
}

/** CONDITION_EXPLAIN, read out of mazeworld.html's classic script. */
function conditionExplain() {
  const start = html.indexOf("const CONDITION_EXPLAIN = {");
  assert.ok(start >= 0, "mazeworld.html should declare CONDITION_EXPLAIN");
  const end = html.indexOf("\n};", start);
  const out = {};
  for (const m of html.slice(start, end).matchAll(/^\s*(\w+): "((?:[^"\\]|\\.)*)",?\s*$/gm)) out[m[1]] = m[2];
  return out;
}
const EXPLAIN = conditionExplain();
/** The hero chips a spell or a skill puts up. (The parley insult and the Bard's song chips are Phase 91's wording.) */
const SPELL_SKILL_CHIP_KEYS = ["mirror", "heroBlind", "senses", "regen", "foresight", "reveal", "braced", "ability", "halfNext", "critWard", "might"];
const chipLines = SPELL_SKILL_CHIP_KEYS.filter((k) => k in EXPLAIN).map((k) => ({ id: `CONDITION_EXPLAIN.${k}`, text: EXPLAIN[k] }));
const foeChipLines = Object.entries(FOE_CONDITION_DESC).map(([k, v]) => ({ id: `FOE_CONDITION_DESC.${k}`, text: v }));

/** A level-5 Apprentice holding every spell: every row the Grimoire and the combat menu can show. */
function everySpellState(inCombat) {
  const foe = fixedFoe({ name: "Viper", intel: 10 });
  return fixedState(
    { cls: "Magic User", sub: "Apprentice", level: 5, grimoire: SPELLS.map((s) => s.n), spellsUsed: 0 },
    inCombat ? { combat: fixedCombat([foe]) } : {},
  );
}
const menuRows = combatMenuViewModel(everySpellState(true)).submenus.spells.rows.filter((r) => r.dispatch);
const grimoireRows = grimoireViewModel(everySpellState(false)).rows;
const menuLines = menuRows.map((r) => ({ id: `menu ${r.label}`, text: r.desc }));
const grimoireLines = grimoireRows.map((r) => ({ id: `Grimoire ${r.name}`, text: `${r.txt}${r.resistNote ? ` · ${r.resistNote}` : ""}` }));

const everySurface = [...catalogRows, ...eventLines, ...foeChipLines, ...chipLines, ...menuLines, ...grimoireLines];

test("the guard reads every surface it names (so it cannot pass by reading nothing)", () => {
  assert.ok(catalogRows.length >= SPELLS.length + ABILITIES.length + 21, `rows: ${catalogRows.length}`);
  for (const ev of ["smokeThrown", "weakened", "blinded", "mirrorSelf", "foeCowers", "sidestepped", "battleRoarRaised"]) {
    assert.ok(eventLines.some((l) => l.id.startsWith(`oracle:${ev}`)) && eventLines.some((l) => l.id.startsWith(`rail:${ev}`)), `${ev}: an Oracle and a rail line from the live corpus`);
  }
  assert.ok(eventLines.length >= 40, `event lines: ${eventLines.length}`);
  assert.ok(foeChipLines.length >= 20 && chipLines.length >= 6, `chips: ${foeChipLines.length} foe, ${chipLines.length} hero`);
  assert.equal(menuRows.length, SPELLS.length, "a level-5 Apprentice's menu lists every spell");
  assert.equal(grimoireRows.length, SPELLS.length, "a level-5 Apprentice's Grimoire lists every spell");
  // The measured faces are the ones the texts depend on (a changed engine rule fails here first).
  assert.deepEqual([MIRROR.plain, MIRROR.insulted, SMOKE.plain, SMOKE.insulted], [1, 2, 1, 2]);
  assert.deepEqual([WEAKEN.plain, WEAKEN.insulted, COWER.plain, COWER.insulted], [3, 4, 3, 4]);
  assert.deepEqual([BLIND.plain, BLIND.insulted], [1, 1], "the blind cap is applied last: an insult never widens it");
  assert.ok(BASE.plain > WEAKEN.plain && BASE.plain > MIRROR.plain && BASE.plain > BLIND.plain, "every condition really narrows the foe's faces");
});

test("no spell, ability or skill row, event line (Oracle or rail), chip sentence or menu row speaks in faces or squares of foes", () => {
  for (const s of everySurface) assert.deepEqual(wordingProblems(s.text), [], `${s.id}: ${plain(s.text)}`);
});

test("every spell and skill surface that names a to-hit shift signs it with + or U+2212, never zero", () => {
  const seen = new Set();
  for (const s of everySurface) {
    assert.deepEqual(toHitProblems(plain(s.text)), [], s.id);
    for (const m of plain(s.text).matchAll(/[+−]\d+ to hit/g)) seen.add(m[0]);
  }
  for (const want of ["+3 to hit", `${MINUS}2 to hit`]) assert.ok(seen.has(want), `a surface states "${want}", saw ${[...seen]}`);
});

test("every d20 range a spell or skill surface states is one number or low–high with an en dash, on the d20", () => {
  let stated = 0;
  for (const s of everySurface) {
    assert.deepEqual(rangeProblems(plain(s.text)), [], s.id);
    stated += [...plain(s.text).matchAll(/ on a d20/g)].length;
  }
  assert.ok(stated >= 24, `the caps name their ranges on many surfaces, saw ${stated}`);
});

// --- shifts: the engine's numbers ---------------------------------------------

test("Kata and Feint state +3 to hit (KATA_FEINT_NEED_SHIFT), the same words on the skill and the catalog ability; Overhead Blow states −2 to hit", () => {
  assert.equal(KATA_FEINT_NEED_SHIFT, 3);
  const kata = `${signedText(KATA_FEINT_NEED_SHIFT)} to hit on this strike, and it adds your level in damage; ready again ${abilityReadyAfter("kata")} rounds after you use it`;
  for (const id of ["ABILITIES.kata", "FIGHTER_SKILLS.Kata", "ABILITIES.feint", "THIEF_SKILLS.Feint"]) assert.ok(rowText(id).includes(kata), `${id}: ${rowText(id)}`);
  // Overhead Blow's own shift, measured from a real use (the strike event carries its mods).
  const state = fixedState({ abilities: ["overheadBlow"] }, { combat: fixedCombat([fixedFoe()]) });
  const events = [];
  useAbility(state, "overheadBlow", fakeRng([], 20), events);
  const strike = events.find((e) => e.type === "strikeMissed" || e.type === "struck");
  const mod = (strike.mods || []).find((m) => m.name === "overhead");
  assert.equal(signedText(mod.delta), `${MINUS}2`);
  assert.ok(rowText("ABILITIES.overheadBlow").includes(`but ${signedText(mod.delta)} to hit; ready again ${abilityReadyAfter("overheadBlow")} rounds after you use it`), rowText("ABILITIES.overheadBlow"));
});

test("Sidestep and Battle Roar state 'foes −2 to hit' from the engine's shift: skill, ability, Oracle line and rail line say the same", () => {
  const side = shiftOf("sidestep");
  const roar = shiftOf("battleRoar");
  assert.equal(side, -2);
  assert.equal(roar, -2);
  for (const id of ["ABILITIES.sidestep", "FIGHTER_SKILLS.Sidestep"]) assert.ok(rowText(id).includes(`foes ${signedText(side)} to hit you`), rowText(id));
  for (const id of ["ABILITIES.battleRoar", "FIGHTER_SKILLS.Battle Roar"]) assert.ok(rowText(id).includes(`foes ${signedText(roar)} to hit anyone on your side`), rowText(id));
  for (const [type, shift, who] of [["sidestepped", side, "you"], ["battleRoarRaised", roar, "anyone on your side"]]) {
    assert.ok(plain(EVENT_NARRATION[type]({})).includes(`foes are ${signedText(shift)} to hit ${who}`), plain(EVENT_NARRATION[type]({})));
    assert.ok(LINE_FOR[type]({}, {}).text.includes(`Foes ${signedText(shift)} to hit ${who === "you" ? "you" : "your side"}`), LINE_FOR[type]({}, {}).text);
  }
  // A Joiner's own Sidestep reads "them".
  assert.ok(plain(EVENT_NARRATION.sidestepped({ member: "Joiny" })).includes(`${signedText(side)} to hit them`));
  assert.ok(LINE_FOR.sidestepped({ member: "Joiny" }, {}).text.includes(`${signedText(side)} to hit them`));
});

test("Enchant Character states the shifts its payload carries: +2 to hit, foes −2 to hit you", () => {
  const eff = SPELLS.find((s) => s.n === "Enchant Character").act.eff;
  const stated = `${signedText(eff.toHit)} to hit, foes ${signedText(eff.foeToHit)} to hit you`;
  assert.ok(rowText("SPELLS.Enchant Character").includes(stated), rowText("SPELLS.Enchant Character"));
});

// --- hard caps: the d20 range of the engine's faces ----------------------------

const CAPS = [
  { who: "Mirror Self", faces: MIRROR, rows: ["SPELLS.Mirror Self"], phrase: "only on their best roll", direct: true },
  { who: "Smoke", faces: SMOKE, rows: ["ABILITIES.smoke", "THIEF_SKILLS.Smoke"], phrase: "only on their best roll", direct: true },
];

test("Mirror Self and Smoke state the foe's winning faces as a d20 range, plain and insulted, on the row, the Oracle, the rail and the chip", () => {
  for (const cap of CAPS) {
    const stated = `${cap.phrase} (${d20Range(cap.faces.plain)} on a d20; ${d20Range(cap.faces.insulted)} if you insulted them)`;
    for (const id of cap.rows) assert.ok(rowText(id).includes(stated), `${id}: ${rowText(id)} should state "${stated}"`);
  }
  // Oracle and rail lines, hero's and Joiner's: the same two ranges, plain first.
  for (const type of ["smokeThrown", "mirrorSelf"]) {
    for (const ev of [{ rounds: 3 }, { rounds: 3, member: "Joiny" }]) {
      const o = EVENT_NARRATION[type](ev);
      const r = LINE_FOR[type](ev, {}).text;
      const want = type === "mirrorSelf" ? [d20Range(MIRROR.plain), d20Range(MIRROR.insulted)] : [d20Range(SMOKE.plain), d20Range(SMOKE.insulted)];
      if (type === "mirrorSelf" && ev.member) continue; // a Joiner never casts Mirror Self (docs/SPELL-AUDIT.md, Joiner casters)
      assert.deepEqual(statedD20Ranges(o), want, `Oracle ${type}: ${plain(o)}`);
      assert.deepEqual(statedD20Ranges(r), want, `rail ${type}: ${r}`);
    }
  }
  assert.deepEqual(statedD20Ranges(EXPLAIN.mirror), [d20Range(MIRROR.plain), d20Range(MIRROR.insulted)], EXPLAIN.mirror);
  // The same words on both rules that cap a foe at its best roll (ADJACENCY): Mirror Self and Smoke state one range pair.
  assert.deepEqual(statedD20Ranges(rowText("SPELLS.Mirror Self")), statedD20Ranges(rowText("ABILITIES.smoke")));
});

test("Weaken and the Behemoth's cower state 'a high roll' as the d20 range of a cap of three faces, plain and insulted, on every surface", () => {
  const stated = `hit only on a high roll (${d20Range(WEAKEN.plain)} on a d20; ${d20Range(WEAKEN.insulted)} if you insulted them)`;
  assert.deepEqual([d20Range(WEAKEN.plain), d20Range(WEAKEN.insulted)], [d20Range(COWER.plain), d20Range(COWER.insulted)], "Weaken and the cower cap the foe the same way");
  assert.ok(rowText("SPELLS.Weaken").includes(`foes ${stated}`), rowText("SPELLS.Weaken"));
  assert.ok(rowText("SPELLS.Size of the Behemoth").includes(`hitting only on a high roll (${d20Range(COWER.plain)} on a d20; ${d20Range(COWER.insulted)} if you insulted them) for half damage`), rowText("SPELLS.Size of the Behemoth"));
  const range = [d20Range(WEAKEN.plain), d20Range(WEAKEN.insulted)];
  assert.deepEqual(statedD20Ranges(plain(EVENT_NARRATION.weakened({ rounds: 3 }))), range);
  assert.deepEqual(statedD20Ranges(LINE_FOR.weakened({ rounds: 3 }, {}).text), range);
  assert.deepEqual(statedD20Ranges(plain(EVENT_NARRATION.foeCowers({ name: "Orc" }))), range);
  assert.deepEqual(statedD20Ranges(FOE_CONDITION_DESC.weakened), range, "FOE_CONDITION_DESC.weakened");
  assert.deepEqual(statedD20Ranges(FOE_CONDITION_DESC.cowering), range, "FOE_CONDITION_DESC.cowering");
});

test("Blind and Dirty Trick state the blind foe's best roll as one d20 number: an insult never widens it, so no insulted case is stated", () => {
  const stated = `its best roll (${d20Range(BLIND.plain)} on a d20) and never lands a critical`;
  assert.equal(BLIND.plain, BLIND.insulted);
  assert.ok(rowText("SPELLS.Blind").includes(`it hits only on ${stated}`), rowText("SPELLS.Blind"));
  assert.ok(rowText("ABILITIES.dirtyTrick").includes(`so it hits only on ${stated}`), rowText("ABILITIES.dirtyTrick"));
  assert.equal(rowText("ABILITIES.dirtyTrick"), rowText("THIEF_SKILLS.Dirty Trick"));
  for (const t of [plain(EVENT_NARRATION.blinded({ target: "Viper" })), LINE_FOR.blinded({ target: "Viper" }, {}).text, FOE_CONDITION_DESC.blind]) {
    assert.ok(plain(t).includes(`only on its best roll (${d20Range(BLIND.plain)} on a d20)`), t);
    assert.deepEqual(statedD20Ranges(t), [d20Range(BLIND.plain)], "one number, no insulted case");
  }
});

test("Stealth states the strike die's top two numbers and their range on a d20, measured from a real opening blow", () => {
  const hero = { sub: "Woodsman", skills: { Stealth: 1 } };
  const dieN = strikeDie(fixedFighter(hero));
  let n = 0;
  for (let roll = dieN; roll >= dieN - 5; roll--) {
    const state = fixedState(hero, { combat: fixedCombat([fixedFoe()]) });
    const events = [];
    playerStrike(state, fakeRng([dieN + 1 - roll], 1), events);
    if (events.some((e) => e.type === "stealthStrike")) n++;
    else break;
  }
  assert.equal(n, 2, "the Stealth crit fires on exactly the top two numbers");
  const stated = `crits on the top two numbers of your die (${d20Range(n)} on a d20)`;
  assert.ok(rowText("FIGHTER_SKILLS.Stealth").includes(stated), rowText("FIGHTER_SKILLS.Stealth"));
  assert.equal(d20Range(n), `19${EN_DASH}20`);
});

// --- area effects, resists, parley --------------------------------------------

test("area effects say how many foes: Doze d4, Shrink up to d6, Plane Gate d6, Fireballs d8 bolts spread across the foes, Ice and Weaken every foe", () => {
  assert.match(rowText("SPELLS.Doze"), /^control · d4 foes, your target first/);
  assert.match(rowText("SPELLS.Shrink"), /^control · up to d6 foes/);
  assert.match(rowText("SPELLS.Plane Gate"), /d6 Demons or Walking Dead/);
  assert.match(rowText("SPELLS.Fireballs"), /d8 bolts .* spread across the foes/);
  for (const n of ["Ice", "Weaken", "Lightning", "Earthquake", "Noxious Vapor", "Size of the Behemoth", "Stop Time"]) assert.match(rowText(`SPELLS.${n}`), /every foe/, n);
  for (const s of everySurface) assert.doesNotMatch(plain(s.text), /squares of (?:opponents?|enemies|enemy|foes?|them)\b/i, `${s.id}: no "squares of" foes`);
});

test("every spell a foe can resist says so on its Grimoire row and its combat menu row, deeper floors included; a spell on yourself says nothing of it", () => {
  assert.match(GRIMOIRE_COPY.resistNote, /may resist/);
  assert.match(GRIMOIRE_COPY.resistNote, /the deeper the floor, the likelier it does/);
  for (const sp of SPELLS) {
    const g = grimoireRows.find((r) => r.name === sp.n);
    const m = menuRows.find((r) => r.label === sp.n.toUpperCase());
    assert.ok(g && m, `${sp.n}: a Grimoire row and a menu row`);
    if (spellTargetsFoe(sp)) {
      assert.equal(g.resistNote, GRIMOIRE_COPY.resistNote, `${sp.n}: the Grimoire row carries the resist sentence`);
      assert.ok(m.desc.includes(GRIMOIRE_COPY.resistNote), `${sp.n}: the menu row carries the resist sentence`);
      // beside the menu's per-target range, in the engine's own faces at this floor
      const range = hitRangeText(risingResistFaces(1, 10), 20);
      assert.ok(m.desc.endsWith(COMBAT_MENU_COPY.spellResist.replace("{target}", "Viper").replace("{range}", range)), `${sp.n}: ${m.desc}`);
    } else {
      assert.equal(g.resistNote, null, `${sp.n}: a self spell's Grimoire row says nothing of resisting`);
      assert.ok(!m.desc.includes(GRIMOIRE_COPY.resistNote), `${sp.n}: a self spell's menu row says nothing of resisting`);
      assert.ok(!/resists on/.test(m.desc), `${sp.n}: no per-target range either`);
    }
    assert.equal(g.txt, sp.txt, `${sp.n}: the row's own text is untouched`);
  }
});

test("Chameleon Tongue says 'parley' and what a parley is, and that it spends the fight's one parley", () => {
  const t = rowText("SPELLS.Chameleon Tongue");
  assert.match(t, /a parley \(talking your way out of the fight instead of swinging\) at \+4 to the roll/);
  assert.match(t, /it spends the fight's one parley/);
  assert.doesNotMatch(t, /talk at once: a parley at/, "the bare 'a parley at +4' is gone");
});

// --- the table: the table skill and its catalog ability are one text ---------------

test("ADJACENCY: a table skill's txt equals its catalog ability's txt (the Fighter-table Sidestep and the catalog Sidestep, Kata and Feint)", () => {
  for (const a of ABILITIES.filter((x) => x.source === "table")) {
    const table = a.cls === "Fighter" ? FIGHTER_SKILLS : THIEF_SKILLS;
    assert.equal(table[a.skillKey].txt, a.txt, `${a.skillKey}`);
  }
  // Kata and Feint share one rule in one set of words.
  assert.equal(rowText("ABILITIES.kata").replace(/^[^:]*: /, ""), rowText("ABILITIES.feint").replace(/^[^:]*: /, ""));
});

test("every once-per-fight ability says 'once per fight' in its text, and no other ability does (the menu and the Hero tab state it too)", () => {
  for (const a of ABILITIES) {
    assert.equal(/once per fight/.test(a.txt), a.cd === "fight", `${a.id}: cd ${a.cd}, txt "${a.txt}"`);
  }
});

// Phase 91.1 plan 02 (user rulings V1 to V5, 2026-10-01): an ability that comes back after a wait states it as
// "ready again N rounds after you use it", N read from the engine (abilityReadyAfter: the cooldown, plus the effect
// rounds first for a duration ability), and never together with "once per fight". A once-per-fight ability has no wait.
test("an ability that says 'ready again N rounds after you use it' says the engine's N, once, and never beside 'once per fight'", () => {
  let saying = 0;
  for (const a of ABILITIES) {
    const m = a.txt.match(/ready again (\d+) rounds after you use it/g);
    if (!m) continue;
    saying += 1;
    assert.equal(m.length, 1, `${a.id}: says it once`);
    assert.equal(a.cd === "fight", false, `${a.id}: a once-per-fight ability has no wait`);
    assert.equal(Number(m[0].match(/\d+/)[0]), abilityReadyAfter(a.id), `${a.id}: ${a.txt}`);
    assert.equal(/once per fight/.test(a.txt), false, a.id);
  }
  assert.equal(saying, 8, "Kata, Feint, Overhead Blow, Last Stand, Second Wind, Smoke, Hamstring and Mark");
  for (const a of ABILITIES) if (a.cd === "fight") assert.equal(abilityReadyAfter(a.id), null, a.id);
});

// --- the orchestrator amendment: Q7, Q9, Q10, Q11 -----------------------------------

test("Q11: Death Touch is one swing, rolled as normal: if it lands it doubles and finishes anything under 15 hp; once per fight (engine unchanged)", () => {
  const t = rowText("ABILITIES.deathTouch");
  assert.equal(t, "call it: one swing, rolled as normal; if it lands it doubles and finishes anything under 15 hp; once per fight");
  assert.equal(FIGHTER_SKILLS["Death Touch"].txt, t);
  // The engine, measured. A landing top roll: a forced critical, and a foe under 15 dies; a foe at 15 or more does not die of it.
  const swing = (wp, draw) => {
    const foe = fixedFoe({ wp, maxWP: 999 });
    const state = fixedState({ abilities: ["deathTouch"] }, { combat: fixedCombat([foe]) });
    const events = [];
    useAbility(state, "deathTouch", fakeRng([draw], 1), events);
    return { state, foe, events };
  };
  const low = swing(14, 1);
  assert.equal(low.foe.alive, false, "a foe under 15 hp dies of a landed Death Touch");
  const high = swing(15, 1);
  assert.equal(high.foe.alive, true, "a foe at 15 hp is only hit (and doubled)");
  assert.ok(high.events.some((e) => e.type === "struck" && e.critical), "a landed Death Touch doubles");
  // A miss spends the use and nothing waits for a later blow.
  const miss = swing(14, 20);
  assert.ok(miss.events.some((e) => e.type === "strikeMissed"), "a roll of 1 misses");
  assert.equal(miss.state.combat.abilityStrike, undefined, "nothing waits for a later blow");
  assert.equal(miss.foe.alive, true);
  const after = [];
  playerStrike(miss.state, fakeRng([5], 1), after);
  assert.ok(!after.some((e) => e.type === "struck" && e.critical), "the next ordinary blow that lands is not doubled");
  assert.equal(miss.foe.alive, true, "and it finishes nothing");
});

test("Q9: the Fixated chip says the unturned Walking Dead swing only at the caster, never at a Joiner, and no longer 'fights exactly as before'", () => {
  assert.match(FOE_CONDITION_DESC.fixated, /swings only at you, never at your Joiner/);
  assert.match(FOE_CONDITION_DESC.fixated, /rest of the fight/);
  assert.doesNotMatch(FOE_CONDITION_DESC.fixated, /exactly as before/);
  assert.match(rowText("SPELLS.Turn Walking Dead"), /any left standing swing only at you for the rest of the fight, never at your Joiner/);
});

test("Q7: Stupidity and Death say they hit the foe you picked", () => {
  assert.match(rowText("SPELLS.Stupidity"), /^control · the foe you picked ·/);
  assert.match(rowText("SPELLS.Death"), /^burst · the foe you picked ·/);
});

test("Q10: Stealth, Hardiness and Ambidextrous say a Joiner uses them too, with the engine's numbers", () => {
  assert.match(rowText("FIGHTER_SKILLS.Stealth"), /and so does a Joiner's own if it has Stealth/);
  assert.match(rowText("FIGHTER_SKILLS.Hardiness"), /a Joiner with it takes 3 less from each blow/);
  assert.match(rowText("FIGHTER_SKILLS.Ambidextrous"), /^two swings every time you strike, each rolling to hit and for damage, and a Joiner with it swings twice on a plain strike; it does not stack with Speed$/);
  // Hardiness: −3 on a landed blow, never below 1 (measured through the engine's own damage seam).
  const hurt = (dmg) => {
    const foe = fixedFoe();
    const state = fixedState({ skills: { Hardiness: 1 } }, { combat: fixedCombat([foe]) });
    return applyFoeDamageToPlayer(state, foe, fakeRng([], 1), [], { dmg }).applied;
  };
  const bare = (dmg) => {
    const foe = fixedFoe();
    return applyFoeDamageToPlayer(fixedState({}, { combat: fixedCombat([foe]) }), foe, fakeRng([], 1), [], { dmg }).applied;
  };
  assert.equal(bare(10) - hurt(10), 3, "Hardiness takes 3 off a blow");
  assert.equal(hurt(2), 1, "never below 1");
  assert.match(rowText("FIGHTER_SKILLS.Hardiness"), new RegExp(`${MINUS}3 to every blow, bolt and trap that hurts you \\(never below 1\\)`));
});

test("the other audit text fixes: Cooking, Locks, Sewing, Silent Step, Noxious Vapor and Insane say what the engine does", () => {
  assert.match(rowText("FIGHTER_SKILLS.Cooking"), /heal a quarter of its max hp \(at least 1\) and pocket a ration/);
  assert.match(rowText("THIEF_SKILLS.Locks"), /with lockpicks; intelligence 15 and 20 each add one more number; a failed roll loses the chest/);
  assert.match(rowText("THIEF_SKILLS.Sewing"), /once on each fed day's rest, patch hurt armour: d6 hp back, 4 times in all/);
  assert.match(rowText("THIEF_SKILLS.Sewing.txt2"), /d6\+3 hp back, 6 times in all/);
  assert.match(rowText("ABILITIES.silentStep"), /never misses and doubles its damage, any round; once per fight; heavy armour, the dark \(without a light\), a Guard or a Soldier keep the hit and lose the doubling/);
  assert.match(rowText("SPELLS.Noxious Vapor"), /on a 4 each foe dies unless its own d10 shows a 1; any other number puts it to sleep for d6\+2 rounds; from level 5 it is always the 4/);
  assert.match(rowText("SPELLS.Insane"), /1 it dies, 2 it hits the next foe, 3 or 6 it flees, 4 it sleeps d4 rounds, 5 it swings twice for the fight/);
  assert.equal(SWEEP_MIN_FOES, 2);
  assert.match(rowText("ABILITIES.sweep"), /needs two or more foes/);
});

// --- ADJACENCY, EMPTY, ENCODING, ORDERING (the four probe edges) ------------------

test("EMPTY: a row with no roll wording is left as it is, and every reworded line renders a bare payload with no 'undefined' or 'NaN'", () => {
  assert.equal(rowText("SPELLS.Heal"), "healing · you · d10 hp");
  assert.equal(rowText("SPELLS.Shield"), "defensive · you · soaks 50 hp for 5 rounds");
  assert.equal(rowText("ABILITIES.brace"), "halve the next blow that lands on you");
  assert.equal(rowText("ABILITIES.sweep"), "one wide arc: every living foe takes half damage; needs two or more foes");
  for (const id of ["SPELLS.Heal", "SPELLS.Shield", "ABILITIES.brace", "ABILITIES.riposte", "ABILITIES.taunt"]) assert.doesNotMatch(rowText(id), /to hit| on a d20/, id);
  for (const ev of EVENTS) {
    for (const bare of [{}, { member: "Joiny" }, { type: ev }]) {
      for (const [label, fn] of [["Oracle", () => EVENT_NARRATION[ev]?.(bare)], ["rail", () => LINE_FOR[ev]?.(bare, {})?.text]]) {
        let out;
        try { out = fn(); } catch (e) { assert.fail(`${label} ${ev} threw on a bare payload: ${e.message}`); }
        if (out === undefined) continue;
        assert.doesNotMatch(plain(out), /\bundefined\b|\bNaN\b/, `${label} ${ev} ${JSON.stringify(bare)}: ${plain(out)}`);
      }
    }
  }
});

test("ENCODING: the guard wants U+2212 and U+2013 exactly, and rejects a hyphen-minus in a to-hit or a range", () => {
  assert.deepEqual(toHitProblems("foes −2 to hit you"), []);
  assert.deepEqual(toHitProblems("+3 to hit"), []);
  assert.notDeepEqual(toHitProblems("foes -2 to hit you"), [], "a hyphen-minus is rejected");
  assert.notDeepEqual(toHitProblems("foes –2 to hit you"), [], "an en dash is not a minus");
  assert.notDeepEqual(toHitProblems("foes 2 to hit you"), [], "an unsigned shift is rejected");
  assert.notDeepEqual(toHitProblems("foes +0 to hit you"), [], "+0 is rejected");
  assert.deepEqual(rangeProblems("19–20 on a d20"), []);
  assert.notDeepEqual(rangeProblems("19-20 on a d20"), [], "a hyphen-minus range is rejected");
  assert.notDeepEqual(rangeProblems("19−20 on a d20"), [], "a minus sign is not a range separator");
  assert.notDeepEqual(rangeProblems("20–19 on a d20"), [], "high to low is rejected");
  assert.notDeepEqual(rangeProblems("20–20 on a d20"), [], "20–20 is not a range");
  assert.notDeepEqual(wordingProblems("one face easier for foes to hit"), []);
  assert.equal(MINUS.codePointAt(0), 0x2212);
  assert.equal(EN_DASH.codePointAt(0), 0x2013);
  // And the live surfaces use exactly those code points: every ranged or shifted line holds a U+2212 or U+2013, never the ASCII look-alikes.
  for (const s of everySurface) {
    const t = plain(s.text);
    assert.doesNotMatch(t, /\d-\d+ on a d20|[ (]-\d+ to hit/, `${s.id}: an ASCII hyphen in a range or shift: ${t}`);
  }
  // facesRangeText is the one range formatter: it writes the en dash.
  assert.equal(facesRangeText(3, 20), `18${EN_DASH}20`);
  assert.equal(hitRangeText(1, 20), "20 (d20)");
});

test("ORDERING: where a text states both a plain and an insulted case, the plain case comes first and the insulted case follows, on every surface", () => {
  let both = 0;
  for (const s of everySurface) {
    const t = plain(s.text);
    const insult = t.search(/if (?:you )?insulted/);
    if (insult < 0) continue;
    both++;
    const reach = t.search(/\d+(?:–\d+)? on a d20/);
    assert.ok(reach >= 0 && reach < insult, `${s.id}: the plain range comes before the insulted exception: ${t}`);
    const [lo, hi] = statedD20Ranges(t);
    assert.ok(hi !== undefined && Number(lo.split(EN_DASH)[0]) > Number(hi.split(EN_DASH)[0]), `${s.id}: the insulted range is wider than the plain one: ${t}`);
  }
  assert.ok(both >= 12, `the insulted case is stated on many surfaces, saw ${both}`);
});
