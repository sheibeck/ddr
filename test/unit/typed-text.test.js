// test/unit/typed-text.test.js
//
// Phase 58 (MOTION-04/05), Plan 05 — the __mzTypewriter bridge wired into
// renderRail() and renderMajorOverlay(). Every test below drives the REAL
// renderRail() (test/unit/harness/shellSandbox.js#loadShellSandbox with
// stubRail: false) and the REAL __mzTypewriter (createTypewriter, wired by
// the harness) against a deterministic fake clock (test/unit/harness/
// fakeClock.js) — no test here ever sleeps; `clock.advance(ms)` is the only
// way time moves.
//
// Per D-13/D-14/D-15/D-16 (58-CONTEXT.md): rail cards and the encounter
// overlay's line type on at 12ms/char capped at 700ms/block; the Oracle,
// HUD numbers and buttons never type; the rail's hold starts only once
// typing finishes; a tap on typing text completes it instead of dismissing;
// a same-content re-render continues an in-flight block instead of
// restarting it; the announcer/description always carries the complete
// text at once, regardless of typing.

import test from "node:test";
import assert from "node:assert/strict";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { newRun } from "../../engine/state.js";
import { railPush, railClear, emptyRail, RAIL_HOLD, holdForCard } from "../../src/browser/rail.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { typeDurationMs } from "../../src/browser/typewriter.js";

// scenario({ seed, reducedMotion, clock }) — the one shared sandbox builder
// every test below drives: the REAL renderRail() (stubRail: false) and the
// REAL __mzTypewriter, both wired by loadShellSandbox itself.
function scenario({ seed, reducedMotion = false, clock } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion, clock, stubRail: false });
  sandbox.setState(newRun(seed));
  return { doc, sandbox };
}

// pushCard(sandbox, overrides) — pushes a hand-built rail card (a fresh seq/
// key every call) directly onto window.__mzRail, bypassing the fold
// pipeline entirely (this file only needs a stable, fully-controlled card
// shape — railLineCard's own one-line-only shape is too narrow for the
// two-span (line + roll) cases below).
function pushCard(sandbox, { title = "A TRAP", lines = [{ text: "Patient as furniture.", roll: null }], tone = "bad", hold = RAIL_HOLD.default, icon = "✕", buttons } = {}) {
  const card = { icon, iconKey: null, title, lines, tone, hold };
  if (buttons) card.buttons = buttons; // not read by renderRail (buttons come from S.pending*), kept only for readability at call sites that never set it
  sandbox.context.window.__mzRail = railPush(sandbox.context.window.__mzRail || emptyRail(), card);
  return sandbox.context.window.__mzRail.card;
}

function linesEl(doc) {
  return doc.document.getElementById("mw-rail-lines");
}

// ─── (1) a new card types on; the announcer gets the complete text at
// once; the typing host is aria-hidden for exactly the typing window ──────

test("typed-text (1): a new rail card types on — #mw-rail-live holds the complete text in the same render, #mw-rail-lines is aria-hidden while typing, each line/roll holds a typed+rest span pair, and settles to plain full text with aria-hidden gone once its duration elapses", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ seed: 101, clock });
  const text = "The floor gives way beneath your very confident boots.";
  const roll = "d20 · 14 vs 12";
  pushCard(sandbox, { lines: [{ text, roll }] });
  sandbox.context.renderRail();

  const live = doc.document.getElementById("mw-rail-live");
  assert.equal(live.textContent, "A TRAP. " + text, "the announcer must carry the complete text in the same render that shows the card");

  const host = linesEl(doc);
  assert.equal(host.getAttribute("aria-hidden"), "true", "the visibly-typing host must be aria-hidden for exactly the typing window");

  const lineEl = host.querySelectorAll(".mw-rail-line")[0];
  const rollEl = host.querySelectorAll(".mw-rail-roll")[0];
  assert.equal(lineEl.children.length, 2, "a typing line must hold a typed span and a rest span, never a plain text write");
  assert.ok(lineEl.children[1].classList.contains("mw-type-rest"), "the second span must carry the rest class that reserves final layout");
  assert.equal(rollEl.children.length, 2);
  assert.ok(rollEl.children[1].classList.contains("mw-type-rest"));

  const duration = typeDurationMs(text.length + roll.length);
  clock.advance(duration + 64);

  assert.equal(host.getAttribute("aria-hidden"), null, "aria-hidden must be restored once typing finishes");
  assert.equal(lineEl.textContent, text, "the line must settle to its plain full text");
  assert.equal(rollEl.textContent, roll, "the roll must settle to its plain full text");
  assert.equal(lineEl.children.length, 0, "a finished block writes plain text, not span children");
});

// ─── (2) the hold starts after typing, not at render time ─────────────────

test("typed-text (2): the hold starts after typing — the rail is still showing at holdForCard(card) ms after the render (typing time not yet added), and clears once typing time plus holdForCard(card) ms has actually elapsed", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ seed: 102, clock });
  const text = "A".repeat(30); // typeDurationMs(30) = 360ms
  const card = pushCard(sandbox, { lines: [{ text, roll: null }] });
  sandbox.context.renderRail();

  const holdMs = holdForCard(card);
  const duration = typeDurationMs(text.length);

  clock.advance(holdMs);
  assert.equal(doc.document.getElementById("mw-rail").hidden, false, "the card must still be showing at holdForCard(card) ms after the render — the hold has not even started yet");
  assert.equal(doc.document.getElementById("mw-rail").dataset.shown, "1");

  // Generous margin past duration+holdMs to absorb the fake clock's frame
  // quantization (advance() steps in 16ms increments) — never a real sleep.
  clock.advance(duration + 64);
  assert.equal(doc.document.getElementById("mw-rail").hidden, true, "the card must clear once typing time plus holdForCard(card) ms has elapsed");
  assert.equal(doc.document.getElementById("mw-rail").dataset.shown, "0");
});

// ─── (3) a same-card re-render mid-typing continues, never restarts ──────

test("typed-text (3): a same-card re-render mid-typing (renderRail() called again at the same key) continues from the current progress — the typed prefix length never drops, and the block still ends at the original end time", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ seed: 103, clock });
  const text = "B".repeat(40); // typeDurationMs(40) = 480ms
  pushCard(sandbox, { lines: [{ text, roll: null }] });
  sandbox.context.renderRail(); // t=0

  clock.advance(64);
  const lineBefore = linesEl(doc).querySelectorAll(".mw-rail-line")[0];
  const typedBefore = lineBefore.children[0].textContent.length;
  assert.ok(typedBefore > 0, "scenario setup must actually be mid-typing before the re-render");

  sandbox.context.renderRail(); // same key — isNew false, adopt() runs
  const lineAfter = linesEl(doc).querySelectorAll(".mw-rail-line")[0];
  const typedAfter = lineAfter.children[0].textContent.length;
  assert.ok(typedAfter >= typedBefore, "the typed prefix length must never drop across a same-card re-render");

  // Advance to comfortably past the ORIGINAL end time (480ms from t=0) but
  // well short of a restarted run's end time (64+480=544ms) — if adopt()
  // had failed to hand the block over (a restart), the block would still
  // be typing here.
  clock.advance(480 - 64 + 32); // total elapsed from t=0: ~512ms
  assert.equal(lineAfter.textContent, text, "the block must have finished by its ORIGINAL end time, not a restarted one");
  assert.equal(lineAfter.children.length, 0, "a finished block writes plain text, not span children");
});

// ─── (4) a tap mid-typing completes typing, never dismisses; the next
// armed tap dismisses ────────────────────────────────────────────────────

test("typed-text (4): a body tap mid-typing, after the arm window, completes the typing, leaves the card showing, and schedules the hold; the next armed tap dismisses", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ seed: 104, clock });
  const text = "C".repeat(40); // typeDurationMs(40) = 480ms — still typing past the arm window
  const card = pushCard(sandbox, { lines: [{ text, roll: null }] });
  sandbox.context.renderRail(); // t=0

  clock.advance(ARM_DELAY_MS + 10); // armed, but well inside the 480ms typing block
  assert.equal(sandbox.context.window.__mzTypewriter.active("rail"), true, "scenario setup must still be typing at the tap moment");

  const railEl = doc.document.getElementById("mw-rail");
  const titleBefore = doc.document.getElementById("mw-rail-title").textContent;

  railEl.onclick({ target: { closest: () => null } });

  assert.equal(sandbox.context.window.__mzTypewriter.active("rail"), false, "the tap must complete the typing block instead of dismissing");
  assert.equal(railEl.hidden, false, "the card must still be showing right after the completing tap");
  assert.equal(doc.document.getElementById("mw-rail-title").textContent, titleBefore, "the card itself must be unchanged by the completing tap");
  assert.equal(linesEl(doc).querySelectorAll(".mw-rail-line")[0].textContent, text, "the line must read its full text once the tap completes typing");

  // The hold was scheduled from the tap's own onDone — prove it fires on
  // schedule (holdForCard(card) after the completing tap), not before.
  const holdMs = holdForCard(card);
  clock.advance(holdMs - 32);
  assert.equal(railEl.hidden, false, "the hold must not have fired yet");
  clock.advance(64);
  assert.equal(railEl.hidden, true, "the hold scheduled by the completing tap must eventually clear the card");

  // A fresh card, then the "next armed tap dismisses" half of the claim.
  pushCard(sandbox, { lines: [{ text: "D".repeat(40), roll: null }] });
  sandbox.context.renderRail();
  clock.advance(ARM_DELAY_MS + 10);
  const railEl2 = doc.document.getElementById("mw-rail");
  railEl2.onclick({ target: { closest: () => null } }); // completes typing
  assert.equal(sandbox.context.window.__mzTypewriter.active("rail"), false);
  assert.equal(railEl2.hidden, false, "the completing tap must never dismiss");
  railEl2.onclick({ target: { closest: () => null } }); // the NEXT armed tap
  assert.equal(railEl2.hidden, true, "the next armed tap (typing already complete) must dismiss");
  assert.equal(sandbox.context.window.__mzRail.card, null);
});

// ─── (5) a card replaced mid-typing schedules no hold for the old card ────

test("typed-text (5): a card replaced mid-typing schedules no hold for the old card — only the new card's own hold ever fires", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ seed: 105, clock });
  const railEl = doc.document.getElementById("mw-rail");

  const cardA = pushCard(sandbox, { title: "CARD A", lines: [{ text: "E".repeat(60), roll: null }] }); // typeDurationMs caps at 700ms
  sandbox.context.renderRail(); // t=0
  clock.advance(100); // still mid-typing (well under 700ms)

  pushCard(sandbox, { title: "CARD B", lines: [{ text: "F".repeat(12), roll: null }] }); // typeDurationMs(12)=144ms
  sandbox.context.renderRail(); // t=100, isNew true — cancels A's run, types B's

  const holdA = holdForCard(cardA);
  // If A's hold had (incorrectly) been scheduled directly at A's OWN render
  // time (the pre-Phase-58 model this plan replaces), it would fire at
  // t=holdA. Advance to exactly that moment and confirm the rail is still
  // showing CARD B, untouched by any stray A timer.
  clock.advance(holdA - 100);
  assert.equal(railEl.hidden, false, "a stray hold from the replaced card must never fire");
  assert.equal(doc.document.getElementById("mw-rail-title").textContent, "CARD B", "CARD B must still be the one showing");

  // CARD B's own schedule: typed at t=100, finishes ~144ms later, then
  // holds for holdForCard(cardB) — generous margin past that combined time.
  clock.advance(1000);
  assert.equal(railEl.hidden, true, "CARD B's own hold must eventually clear it");
});

// ─── (6) a card cleared mid-typing leaves the departing lines in full,
// schedules no hold ────────────────────────────────────────────────────────

test("typed-text (6): a card cleared mid-typing (the view-model cleared, then renderRail()) leaves the departing lines' full text in place and schedules no hold", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ seed: 106, clock });
  const text = "G".repeat(40);
  pushCard(sandbox, { lines: [{ text, roll: null }] });
  sandbox.context.renderRail(); // t=0

  clock.advance(50); // mid-typing
  const lineEl = linesEl(doc).querySelectorAll(".mw-rail-line")[0];
  const typedMid = lineEl.children[0].textContent.length;
  assert.ok(typedMid > 0 && typedMid < text.length, "scenario setup must actually be mid-typing before the clear");

  sandbox.context.window.__mzRail = railClear(sandbox.context.window.__mzRail);
  sandbox.context.renderRail(); // the idle re-render — retains content, cancels typing

  assert.equal(lineEl.textContent, text, "the departing line must be written out in full for its slide-out, not left mid-typed");
  assert.equal(sandbox.context.window.__mzTypewriter.active("rail"), false, "the cancel must end the run immediately");

  const railEl = doc.document.getElementById("mw-rail");
  assert.equal(railEl.hidden, true, "the rail must already be idle/hidden");

  clock.advance(30000);
  assert.equal(railEl.hidden, true, "no stray hold may ever fire for a card that already cleared");
});

// ─── (7) a decision card types its lines; its buttons arm on the normal
// ARM_DELAY_MS, never waiting for typing ────────────────────────────────

test("typed-text (7): a decision card (joiner, with buttons) types its lines, and its buttons exist and arm on the normal ARM_DELAY_MS, never waiting for typing", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ seed: 107, clock });
  const s = sandbox.context.window.__mzState.get();
  s.pendingJoiner = { name: "A Wanderer", race: "Human", sub: null, lvl: 3 };
  sandbox.setState(s);

  sandbox.context.renderRail();

  const actionsEl = doc.document.getElementById("mw-rail-actions");
  assert.equal(actionsEl.children.length, 2, "the joiner card must carry its accept/decline action row");
  for (const btn of actionsEl.children) {
    assert.equal(btn.getAttribute("aria-disabled"), "true", "a freshly rendered decision button starts arm-disabled");
  }
  assert.equal(sandbox.context.window.__mzTypewriter.active("rail"), true, "the joiner card's lines must be typing");
  // guardTap's REAL gate is encArmed() (Date.now() vs encRenderedAt), not
  // the cosmetic aria-disabled sweep (which this harness's stubbed
  // document.querySelectorAll() cannot observe) — armEncounterButtons()
  // stamps encRenderedAt synchronously in renderRail()'s own isNew block,
  // entirely independent of the typing block's own async schedule.
  assert.equal(sandbox.context.encArmed(), false, "immediately after render, taps must still be inside the arm window");

  clock.advance(ARM_DELAY_MS);
  assert.equal(sandbox.context.encArmed(), true, "the buttons must arm on the normal ARM_DELAY_MS");
  // Typing itself is driven by requestAnimationFrame, never by armTimer's
  // own setTimeout — the two schedules are independent, and a long enough
  // card's typing block genuinely outlives ARM_DELAY_MS (250ms).
  assert.equal(sandbox.context.window.__mzTypewriter.active("rail"), true, "typing must still be running — arming never waits for it, nor does it wait for arming");
});

// ─── (8) the encounter overlay's line types once per content ─────────────

test("typed-text (8): the encounter overlay's line types with aria-hidden, #mw-major carries aria-describedby pointing at the always-complete #mw-major-desc, a same-content re-render continues rather than restarts, and a tap on the line completes it", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ seed: 108, clock });
  const state = sandbox.context.window.__mzState.get();
  const expectedLine = `Floor ${state.floor.depth + 1} is colder, longer, and considerably less forgiving. Nobody has asked you to do this.`;

  sandbox.context.window.__mzStair = { dir: "n" };
  sandbox.context.renderEncounter();

  const body = doc.document.getElementById("enc-body");
  const lineEl = body.querySelectorAll(".mw-major-line")[0];
  const major = body.querySelectorAll("#mw-major")[0] || doc.document.getElementById("mw-major");
  assert.ok(lineEl, "the overlay's line element must exist");
  assert.equal(major.getAttribute("aria-describedby"), "mw-major-desc");
  const desc = doc.document.getElementById("mw-major-desc");
  assert.equal(desc.hidden, true);
  assert.equal(desc.textContent, expectedLine, "the description must carry the complete line from the first frame");
  assert.equal(lineEl.getAttribute("aria-hidden"), "true", "the visibly-typing line must be aria-hidden while it types");

  clock.advance(50); // mid-typing
  const typedMid = lineEl.children[0] ? lineEl.children[0].textContent.length : 0;
  assert.ok(typedMid > 0 && typedMid < expectedLine.length, "scenario setup must actually be mid-typing before the re-render");

  sandbox.context.renderEncounter(); // same content — must adopt, not restart
  const lineElAfter = body.querySelectorAll(".mw-major-line")[0];
  const typedAfter = lineElAfter.children[0] ? lineElAfter.children[0].textContent.length : 0;
  assert.ok(typedAfter >= typedMid, "a same-content re-render must never drop typed progress");

  lineElAfter.onclick();
  assert.equal(lineElAfter.getAttribute("aria-hidden"), null, "a tap on the line must complete it");
  assert.equal(lineElAfter.textContent, expectedLine);
});
