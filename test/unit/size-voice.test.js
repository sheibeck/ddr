// test/unit/size-voice.test.js
//
// RULES-11 (Phase 75.2, Plan 04, "Hero Size Matters" — user ruling
// 2026-09-25/26): every surface says what size does. 75.2-CONTEXT's display
// rule ("condition chips show a stepped size while it lasts") and its
// item-text rule ("their text states exactly what a step does ... the
// 'mind the ceilings' promise is dropped") land here:
//   (a) a live size-stepping item's chip is labelled with the hero's
//       resulting size (cn.size), never the item's own fixed label;
//   (b) its tap card leads with conditionEffectText's measured effect, then
//       names the item and its squares, then says exactly what a step does;
//   (c) a chip with no `size` field renders exactly as before;
//   (d) the Oracle and the rail narrate a size item's start from the
//       event's own fields, with a plain fallback when they are absent;
//   (e) the Elven/Dwarven/Troll race notes state their net size truth;
//   (f) every new string passes the voice rules (hp not wp, U+2212, no
//       raw ASCII hyphen-minus before a digit).
//
// The chip half drives the REAL classic script through the shell sandbox
// (test/unit/status-chit-combat.test.js's own rig, trimmed) with a state
// carrying real `startEffect` records for the items — never a hand-typed
// chip descriptor. The narration half calls EVENT_NARRATION/LINE_FOR
// directly with events shaped like 75.2-02's own itemEffectStarted (size/
// step/sizeDmg). The race-note half reads content/races.js and
// content/flavor.js directly.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { railPush, railLineCard } from "../../src/browser/rail.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { startEffect } from "../../engine/effects.js";

import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { RACES, RACE_D8 } from "../../content/races.js";
import { RACE_NOTE } from "../../content/flavor.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fixtures ──────────────────────────────────────────────────────────────

/** A minimal, real fixed state — mirrors test/unit/status-chit-combat.test.js's
 * own fixedState() (a level-3 Human Fighter Soldier), so paintConditions'
 * label/tone rules run against the SAME shape every other chip test uses. */
function fixedState(raceOverride = "Human") {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: raceOverride, level: 3, sp: 0, maxWP: 55, wp: 55, skills: {},
      weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, timers: {},
    },
    floor: { g, px: 1, py: 1, depth: 2 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
  };
}

/** rig() — mirrors status-chit-combat.test.js's own rig(), trimmed to what
 * the chip half of this file needs: paint(), the chip lookup, explainCondition
 * and a plain out-of-combat mzRailLine shim (no combat/beat wiring). */
function rig() {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false, clock });
  const w = sandbox.context.window;
  w.mzRailLine = (title, line, tone, hold, icon, iconKey = null) => {
    w.__mzRail = railPush(w.__mzRail, railLineCard(title, line, tone, hold, icon, iconKey));
    w.renderRail?.();
  };
  const chips = () => doc.document.getElementById("mm-conditions").children.filter((c) => c.className === "mw-cond");
  const chip = (key) => chips().find((c) => c.dataset.key === key);
  const chipDetail = (c) => {
    const d = c && c.children.find((x) => x.className === "mw-cond-detail");
    return d ? d.textContent : null;
  };
  const explain = (cn, label) => sandbox.context.explainCondition(cn, label);
  const descriptor = (key) => w.__mzConditionsOf(w.__mzState.get()).find((cn) => cn.key === key);
  return { clock, doc, sandbox, w, chips, chip, chipDetail, explain, descriptor };
}

// ─── (a)/(b)/(c) the chip label, detail and tap card ───────────────────────

test("(a) a Human with a live Gauntlet of the Giant: chip labelled 'Large', detail '50 sq', tone good", () => {
  const r = rig();
  const s = fixedState("Human");
  startEffect(s.c, "item:Gauntlet of the Giant", { squares: 50, cd: 50 });
  r.w.__mzState.set(s);
  r.sandbox.paint();
  const c = r.chip("giant");
  assert.ok(c, "the giant chip is painted");
  assert.equal(c.textContent, "Large", "the chip is labelled with the hero's resulting size");
  assert.equal(r.chipDetail(c), "50 sq");
  assert.equal(c.dataset.tone, "good");
});

test("(a) Gauntlet and Enlarge both live on a Human: two chips labelled 'Huge', in c.timers insertion order", () => {
  const r = rig();
  const s = fixedState("Human");
  startEffect(s.c, "item:Gauntlet of the Giant", { squares: 50, cd: 50 });
  startEffect(s.c, "item:Enlarge", { squares: 40 });
  r.w.__mzState.set(s);
  r.sandbox.paint();
  const giant = r.chip("giant");
  const enlarge = r.chip("enlarge");
  assert.ok(giant && enlarge, "both chips are painted");
  assert.equal(giant.textContent, "Huge");
  assert.equal(enlarge.textContent, "Huge");
  assert.equal(r.chipDetail(giant), "50 sq", "each chip counts its OWN item down");
  assert.equal(r.chipDetail(enlarge), "40 sq");
  const host = r.doc.document.getElementById("mm-conditions");
  const keys = host.children.filter((c) => c.className === "mw-cond").map((c) => c.dataset.key);
  assert.deepEqual(keys, ["giant", "enlarge"], "insertion order, mirroring c.timers");
});

test("(a) Enlarge alone: chip labelled 'Large', tone good; the tap card names 'Enlarge'", () => {
  const r = rig();
  const s = fixedState("Human");
  startEffect(s.c, "item:Enlarge", { squares: 50 });
  r.w.__mzState.set(s);
  r.sandbox.paint();
  const c = r.chip("enlarge");
  assert.ok(c);
  assert.equal(c.textContent, "Large");
  assert.equal(c.dataset.tone, "good");
  const cn = r.descriptor("enlarge");
  const text = r.explain(cn, c.textContent);
  assert.match(text, /^Enlarge — large, 50 squares\./, "names the item, not the chip's own fixed label");
  assert.match(text, /One size larger while it lasts: \+2 damage, and one face easier for foes to hit\.$/);
});

test("(b) a Human with a live Gauntlet: the tap card leads with the measured effect, then the item, then what a step does", () => {
  const r = rig();
  const s = fixedState("Human");
  startEffect(s.c, "item:Gauntlet of the Giant", { squares: 50, cd: 50 });
  r.w.__mzState.set(s);
  r.sandbox.paint();
  const c = r.chip("giant");
  r.clock.advance(ARM_DELAY_MS + 10);
  c.onclick();
  const card = r.w.__mzRail.card;
  assert.equal(card.title, "LARGE");
  const cn = r.descriptor("giant");
  const effectLead = r.w.__mzConditionEffect(cn, r.w.__mzState.get());
  assert.equal(effectLead, "−1 vs their swings");
  const explainText = r.explain(cn, "Large");
  assert.equal(card.lines[0].text, `${effectLead}. ${explainText}`);
  assert.equal(
    card.lines[0].text,
    "−1 vs their swings. Gauntlet of the Giant — large, 50 squares. One size larger while it lasts: +2 damage, and one face easier for foes to hit."
  );
});

test("(c) a chip with no size field renders its old label and detail (a Ring of Power's power chip, a Strength might chip)", () => {
  const r = rig();
  const s = fixedState("Human");
  startEffect(s.c, "item:Ring of Power", { squares: 50, cd: 50 });
  startEffect(s.c, "item:Strength", { squares: 20 });
  r.w.__mzState.set(s);
  r.sandbox.paint();
  const power = r.chip("power");
  const might = r.chip("might");
  assert.ok(power && might);
  assert.equal(power.textContent, "Empowered", "unchanged fixed label — no cn.size on this chip");
  assert.equal(might.textContent, "Strong", "unchanged fixed label — no cn.size on this chip");
});

// ─── (d) the Oracle and the rail narrate a size item's start ───────────────

test("(d) EVENT_NARRATION.itemEffectStarted (giant/enlarge) names the resulting size, the signed damage and the face clause, with no overhead-clearance/corridor promise", () => {
  for (const kind of ["giant", "enlarge"]) {
    const html = EVENT_NARRATION.itemEffectStarted({ type: "itemEffectStarted", kind, item: "X", left: 50, cadence: "squares", size: "Large", step: 1, sizeDmg: 2 });
    assert.match(html, /50 squares one size larger: you are Large\./, `${kind}: names the resulting size`);
    assert.match(html, /\+2 damage, and one face easier for foes to hit\./, `${kind}: states exactly what a step does`);
    assert.doesNotMatch(html, /ceiling/i, `${kind}: no overhead-clearance promise`);
    assert.doesNotMatch(html, /corridor/i, `${kind}: the old corridor line is gone`);
  }
});

test("(d) EVENT_NARRATION.itemEffectStarted (giant/enlarge) with no size fields falls back to a plain line", () => {
  for (const kind of ["giant", "enlarge"]) {
    const html = EVENT_NARRATION.itemEffectStarted({ type: "itemEffectStarted", kind, item: "X", left: 50, cadence: "squares" });
    assert.match(html, /One size larger for 50 squares\./, `${kind}: plain fallback line`);
  }
});

test("(d) LINE_FOR.itemEffectStarted (giant/enlarge) mirrors the Oracle line, tone magic", () => {
  for (const kind of ["giant", "enlarge"]) {
    const line = LINE_FOR.itemEffectStarted({ type: "itemEffectStarted", kind, item: "X", left: 50, cadence: "squares", size: "Huge", step: 1, sizeDmg: 2 });
    assert.equal(line.tone, "magic");
    assert.match(line.text, /50 squares one size larger: you are Huge\./);
    assert.match(line.text, /\+2 damage, and one face easier for foes to hit\./);
    const fallback = LINE_FOR.itemEffectStarted({ type: "itemEffectStarted", kind, item: "X", left: 50, cadence: "squares" });
    assert.match(fallback.text, /One size larger for 50 squares\./);
  }
});

test("(d) a negative sizeDmg (a size-shrinking item, hypothetical) still reads a signed U+2212 clause", () => {
  const html = EVENT_NARRATION.itemEffectStarted({ type: "itemEffectStarted", kind: "giant", item: "X", left: 10, cadence: "squares", size: "Small", step: -1, sizeDmg: -2 });
  assert.match(html, /−2 damage/, "U+2212, never an ASCII hyphen-minus");
  assert.doesNotMatch(html, /[^A-Za-z]-2\b/, "no ASCII hyphen-minus before the digit");
});

// ─── (e) the Elven, Dwarven and Troll race notes ───────────────────────────

test("(e) content/races.js: the Elven/Dwarven/Troll notes state their net size truth, and Human/Wilmsry/Fridgian are untouched", () => {
  assert.match(RACES.Elven.note, /thin-boned/i);
  assert.match(RACES.Elven.note, /easy to hit/i);
  assert.match(RACES.Elven.note, /2 damage/);
  assert.match(RACES.Dwarven.note, /\+2 damage/);
  assert.match(RACES.Dwarven.note, /one face harder to hit/i);
  assert.match(RACES.Troll.note, /\+11 damage/);
  assert.match(RACES.Troll.note, /one face easier to hit/i);
  assert.match(RACES.Troll.note, /two rations/i);
  assert.equal(RACES.Human.note, "No advantages, no penalties. The dungeon's default.");
  assert.equal(RACES.Wilmsry.note, "Heals twice as fast, learns half as quickly. Magic Users despise them.");
  assert.match(RACES.Fridgian.note, /Never wears armor/);
});

test("(e) content/flavor.js RACE_NOTE: the Elven/Dwarven/Troll entries name their size and net effect", () => {
  assert.match(RACE_NOTE.Elven, /thin-boned/i);
  assert.match(RACE_NOTE.Elven, /small/i, "the Elven note names its size");
  assert.match(RACE_NOTE.Elven, /two points? of damage/i);
  assert.match(RACE_NOTE.Dwarven, /small/i, "the Dwarven note names its size");
  assert.match(RACE_NOTE.Dwarven, /one face harder to hit/i);
  assert.match(RACE_NOTE.Dwarven, /fair trade/i, "the fair-trade line survives");
  assert.match(RACE_NOTE.Troll, /\+11/, "the Troll note states its damage total");
  assert.match(RACE_NOTE.Troll, /one face easier/i);
  assert.match(RACE_NOTE.Troll, /triple/i, "the triple-price line survives");
});

test("(e) the changed rows carry a Phase 75.2 citation in both files", () => {
  const races = fs.readFileSync(path.join(REPO_ROOT, "content", "races.js"), "utf8");
  const flavor = fs.readFileSync(path.join(REPO_ROOT, "content", "flavor.js"), "utf8");
  assert.match(races, /Phase 75\.2/);
  assert.match(flavor, /Phase 75\.2/);
});

// ─── (f) voice: hp not wp, U+2212, family-friendly ─────────────────────────

test("(f) the new size lines never say wp/WP, and RACE_D8/RACES stay a frozen-shape table (no accidental structural drift)", () => {
  const samples = [
    EVENT_NARRATION.itemEffectStarted({ type: "itemEffectStarted", kind: "giant", left: 50, size: "Large", step: 1, sizeDmg: 2 }),
    LINE_FOR.itemEffectStarted({ type: "itemEffectStarted", kind: "enlarge", left: 50, size: "Huge", step: 1, sizeDmg: 2 }).text,
    RACES.Elven.note, RACES.Dwarven.note, RACES.Troll.note,
    RACE_NOTE.Elven, RACE_NOTE.Dwarven, RACE_NOTE.Troll,
  ];
  for (const s of samples) {
    assert.doesNotMatch(s, /\bwp\b/i, `"${s}" must not say wp/WP`);
  }
  assert.ok(Array.isArray(RACE_D8) && RACE_D8.length === 8, "RACE_D8 stays an 8-entry table");
});
