---
quick_id: 260918-vvt
slug: potions-do-not-count-against-bag-space
date: 2026-09-18
status: planned
phase: quick-260918-vvt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - engine/derived.js
  - engine/items.js
  - src/browser/viewModels.js
  - mazeworld.html
  - test/unit/bag-cap-gate.test.js
  - test/unit/gear-panels.test.js
  - test/unit/shell-loot-screen.test.js
autonomous: true
requirements: [QUICK-260918-vvt]
tags: [vanilla-js, rules-engine, inventory, bag-capacity, potions, scrolls, single-helper, source-assertion-tests]

must_haves:
  truths:
    - "ONE engine predicate, engine/derived.js#takesBagSlot(it) (reading the frozen BAG_FREE_KINDS set: potion, scroll, bag), is the only place the bag-free rule is written; slotItems (the capacity count), stowItem (the capacity gate), dropShelfItems (the make-room list), the loot screen's needsSlot and the find card's full flag all read it — no inline kind inequality survives in engine/derived.js, engine/items.js, src/browser/viewModels.js or mazeworld.html"
    - "A potion or scroll is always carryable regardless of slot count: finding a potion on a full bag shows the plain find card (no bag-full line, no drop shelf, TAKE IT not TAKE IT NOW) and taking it succeeds; a full-bag store visit still sells potions and Sealed scrolls (gold deducted, no bagFull event); a Scroll find increments c.scrolls with no bagFull; takeLoot/takeAllLoot/unequip behave as before for gear"
    - "Every N / MAX readout counts slot-consuming items only (unchanged), and the Gear tab's BAG header appends the in-voice note that potions & scrolls ride free whenever the character carries a capped bag; the store's bag-full line says the same"
    - "No serialized field is added or renamed; a v1.5 save loads unchanged (clampCarry still exempts potions and never pads); npm test is # fail 0, the engine/content/parity tree regenerates NO fixture (git diff --stat -- content test/parity is empty) and the parity golden-master hash is a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
  artifacts:
    - path: "engine/derived.js"
      provides: "BAG_FREE_KINDS (Set: potion, scroll, bag) + takesBagSlot(it) exported; slotItems filters through takesBagSlot"
    - path: "engine/items.js"
      provides: "stowItem's capacity gate reads takesBagSlot(it) (import added to the existing ./derived.js import block)"
    - path: "src/browser/viewModels.js"
      provides: "dropShelfItems filters through takesBagSlot; GEAR_COPY.freeRide leaf"
    - path: "mazeworld.html"
      provides: "module import of takesBagSlot from ./engine/derived.js on its own line + window.__mzTakesBagSlot bridge; find card full flag gated per item; loot needsSlot via the bridge; Gear BAG header note; store bag-full clause"
    - path: "test/unit/bag-cap-gate.test.js"
      provides: "takesBagSlot/BAG_FREE_KINDS unit tests; slotItems + stowItem scroll-kind defensives; buyFrom Sealed scroll on a full bag; findMisc Scroll and Potion-then-takeFind on a full bag"
    - path: "test/unit/gear-panels.test.js"
      provides: "re-pinned GEAR_COPY frozen shape with freeRide; dropShelfItems excludes kind:scroll"
    - path: "test/unit/shell-loot-screen.test.js"
      provides: "new section 8: bridge/import pins, find-card + loot + gear-header + store source pins, and the comment-stripped negative sweep over the four files"
  key_links:
    - "engine/derived.js#takesBagSlot -> engine/items.js#stowItem gate (the only enforcement point every stow path funnels through: takeFind/takeLoot/takeAllLoot/unequipSlot/buyFrom)"
    - "engine/derived.js#takesBagSlot -> mazeworld.html window.__mzTakesBagSlot -> find card `full` and loot `needsSlot` (the two shell prompts that must never call the bag full for a potion)"
    - "src/browser/viewModels.js#bagUsage (unchanged shape) -> #s-carry-n readout + gearCopy.freeRide suffix"
---

<objective>
Make "potions and scrolls never count against bag space" a single, named rules-engine predicate and route EVERY capacity check, prompt and readout through it — then fix the one shell prompt that ignores the rule today.

Ground truth from the source read (cite these, do not re-derive): the engine has exempted `kind:"potion"` items since Phase 29 (LOOT-04) via `engine/derived.js#slotItems` -> `engine/items.js#canStow` -> `stowItem`, and every stow path (`takeFind`, `takeLoot`, `takeAllLoot`, `unequipSlot`, `economy.js#buyFrom` via STOWING_EFFECTS) already funnels through `stowItem`; scrolls are a scalar `c.scrolls` (`encounters.js#findMisc` Scroll branch, `economy.js` STORE_EFFECTS.buyScroll) and never enter `c.items` at all. Two things are wrong: (1) the exemption is an inline `it.kind` inequality copy-pasted into FOUR places (`derived.js#slotItems`, `items.js#stowItem`, `viewModels.js#dropShelfItems`, and the loot screen's `needsSlot` in mazeworld.html) — the "scattered ad-hoc filters" this task forbids; (2) the find decision card (mazeworld.html, the `S.pendingFind` rail branch) reads `usage.full` with NO per-item check, so a potion found on a full bag shows RAIL_COPY.find.full ("Your bag is full…"), a drop shelf and TAKE IT NOW even though the engine would accept it. The store's bag-full line and the Gear tab's `n / slots` readout are correct but silent about the exemption.

Scope amendment (coordinator, 2026-09-18): SCROLLS are bag-free too — the predicate excludes potions AND scrolls (and the in-place `kind:"bag"` upgrade, which `stowItem` already never stows). Scroll-kind items do not exist today (scrolls are the `c.scrolls` scalar), so the scroll exclusion is defensive + locked by tests that prove the scroll find/buy paths never touch `c.items` or emit `bagFull` on a full bag.

Precondition (concurrency): the `260918-vm3` map-camera quick task is mid-execution with UNCOMMITTED edits to `mazeworld.html`, `src/browser/controls.js`, `test/unit/controls.test.js`, `test/unit/shell-map-viewport.test.js` (three of its tests fail in the working tree right now — that is its in-flight state, not this task's). Tasks 1–2 touch none of those files; Task 3 edits `mazeworld.html`. Before Task 3, `git status --short -- mazeworld.html` MUST be clean (vm3 committed). If it is not, stop after Task 2 and report — never edit over vm3's working-tree changes.

Purpose: one rule, one home, no prompt that lies about a full bag.
Output: `takesBagSlot` + `BAG_FREE_KINDS` in the engine; four call sites routed through it; the find card fixed; in-voice notes on the two bag readouts; tests that pin all of it; SUMMARY with the browser sanity checklist.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./.claude/CLAUDE.md
@engine/derived.js
@engine/items.js
@src/browser/viewModels.js
@test/unit/bag-cap-gate.test.js
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ENGINE — add `BAG_FREE_KINDS` + `takesBagSlot(it)` to engine/derived.js; route `slotItems` and `stowItem` through it; lock potions AND scrolls bag-free in bag-cap-gate.test.js</name>
  <files>engine/derived.js, engine/items.js, test/unit/bag-cap-gate.test.js</files>
  <read_first>
    - engine/derived.js lines 108-120 (`slotItems` — the LOOT-04 doc comment and the one-line filter you are replacing) and 165-205 (`clampCarry` — reads `slotItems`, must keep exempting potions and never pad).
    - engine/items.js lines 18-32 (the `./derived.js` import block — add `takesBagSlot` here, alphabetical-ish next to `slotItems`), 504-556 (`bagCap`, `canStow`, `stowItem` — the `kind:"bag"` branch stays first; the potion inequality on the gate line is what you replace), and the `takeFind` / `takeAllLoot` bodies (~630-660, ~950-975) just to confirm every path funnels through `stowItem` (do not edit them).
    - engine/economy.js lines 236-246 (STORE_EFFECTS.buyScroll — `state.c.scrolls++`, no bag write) and 458-500 (STOWING_EFFECTS + `buyFrom` — scroll/potion effectIds are deliberately absent; do not edit).
    - engine/encounters.js `findMisc` (~line 379-400): `MISC_MAGIC[rng.d(10) - 1]`; index 1 = "Potion" (then `POTIONS[rng.d(10) - 1]` -> `offerFind`), index 2 = "Scroll" (`c.scrolls++` + `scrollFound`). A stub `{ d: () => 2 }` yields Potion, `{ d: () => 3 }` yields Scroll.
    - test/unit/bag-cap-gate.test.js in full (~330 lines): `fixedChar`/`fixedState`/`GEAR`/`POTION` helpers (lines 30-57), the existing `slotItems` (59-76), `clampCarry` (78-100), `stowItem` (~150-200) and `fixedStoreState`/`buyFrom` (298-330) sections — extend each in place, matching style.
  </read_first>
  <behavior>
    - takesBagSlot: `{kind:"potion"}`, `{kind:"scroll"}`, `{kind:"bag"}` -> false; `null`, `undefined`, a string, a number -> false; `{kind:"gear"}`, weapon, armor, jewel, cloak, staff, tool, picks, and a kind-less `{n:"x"}` -> true.
    - BAG_FREE_KINDS: a Set whose sorted contents are exactly ["bag", "potion", "scroll"].
    - slotItems: `[gear, {kind:"scroll"}, potion, gear]` -> the two gear entries (scroll AND potion exempt); existing null-skip and missing-array tests untouched.
    - stowItem: a `{kind:"scroll", n:"Sealed scroll"}` item stows onto a full small bag (4 gear) — returns true, lands in `c.items`, no `bagFull` event (defensive; mirrors the existing potion test at ~line 169).
    - buyFrom: a third stock entry `{ n: "Sealed scroll", sub: null, cost: 900, effectId: "buyScroll", effectParams: null, sold: false }` bought at index 2 with a FULL small bag -> gold 1000 -> 100, `sold` true, `c.scrolls` 0 -> 1, `c.items` deep-equal before, events contain `bought` and no `bagFull`.
    - findMisc Scroll on a full small bag (`rng = { d: () => 3 }`): `c.scrolls` +1, a `scrollFound` event, `state.pendingFind` still null/undefined, `c.items` unchanged, no `bagFull`.
    - findMisc Potion then takeFind on a full small bag (`rng = { d: () => 2 }`): `state.pendingFind.kind === "potion"` after findMisc; `takeFind(state, events)` clears `pendingFind`, pushes `findTaken`, the potion is the last `c.items` entry, `slotItems(c).length` is still 4, and no `bagFull` was emitted.
  </behavior>
  <action>
    In engine/derived.js, directly ABOVE `slotItems`, add two exports with a doc comment in the file's existing voice (cite "LOOT-04 user rule (2026-09-15)" for potions and "quick 260918-vvt (2026-09-18) scope amendment" for scrolls): `export const BAG_FREE_KINDS = new Set(["potion", "scroll", "bag"]);` — the closed list of item kinds that never consume a bag slot (potion: special potions live in `c.items` but are exempt; scroll: scrolls are the `c.scrolls` scalar today, listed defensively so a future scroll ITEM is exempt by construction; bag: a `kind:"bag"` upgrade is applied in place by `stowItem` and never stowed) — and `export function takesBagSlot(it)` returning `!!it && typeof it === "object" && !BAG_FREE_KINDS.has(it.kind)`. State in the comment that this is THE bag-free predicate: `slotItems`, `engine/items.js#stowItem`, `src/browser/viewModels.js#dropShelfItems` and mazeworld.html's find card / loot `needsSlot` all read it and nothing else may re-derive the rule from `it.kind`. Then change `slotItems`'s filter to `.filter(takesBagSlot)` and update its doc comment's "SPECIAL potions … exempt" sentence to say the exemption is `takesBagSlot` (potions, scrolls, bags). Keep `slotItems` returning `[]` for a missing/non-array `c.items` and skipping null entries (takesBagSlot already rejects null/undefined). Do NOT touch `clampCarry`'s body — it reads `slotItems` and inherits the change.

    In engine/items.js, add `takesBagSlot` to the existing multi-line `./derived.js` import block (lines 18-32) and change `stowItem`'s gate line to `if (takesBagSlot(it) && !canStow(c)) {` — the `kind:"bag"` branch above it stays exactly as is; update the two-line comment above the gate to say a bag-free item (potion or scroll, per `takesBagSlot`) never counts toward capacity AND is never itself refused by the gate. Do not edit `canStow`, `bagCap`, `giveItem`, `takeFind`, `takeAllLoot`, `unequipSlot`, or anything in engine/economy.js / engine/encounters.js — those paths already funnel through `stowItem` or never write `c.items` (this task proves that with tests, it does not re-plumb it).

    Engine gate (STATE.md, non-negotiable): pure, no rng draw, no new serialized field, no comparables change, `test/parity/prototype-master.js.txt` untouched. Frozen parity characters carry no `c.bag` (cap Infinity), so `canStow` is always true for them and this change is byte-identical on every fixture — if any parity/roundtrip fixture moves, that is a BUG in the edit, not a divergence to declare; fix the edit.

    In test/unit/bag-cap-gate.test.js: extend the `../../engine/derived.js` import with `takesBagSlot, BAG_FREE_KINDS`; import `findMisc` from `../../engine/encounters.js` and `takeFind` from `../../engine/items.js` (check whether `takeFind` is already in the existing items.js import list — it likely is); add a `SCROLL = (n) => ({ kind: "scroll", n })` helper beside `POTION`. Add a new `// --- takesBagSlot / BAG_FREE_KINDS ---` section implementing the first two `<behavior>` bullets, extend the `slotItems` section with the scroll case, extend the `stowItem` section with the scroll-kind defensive, add the third stock entry to `fixedStoreState` (existing tests index 0 and 1 by position — append, do not reorder) plus the `buyFrom` Sealed-scroll test, and add a `// --- find paths: scroll + potion on a full bag (quick 260918-vvt) ---` section with the two `findMisc` tests. For the findMisc tests build state via `fixedState({ c: { bag: "small", items: [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")], scrolls: 0, grimoire: [] } })` — read `findMisc`/`offerFind` first and add whatever minimal `state`/`c` fields the Potion branch's `offerFind` reads (e.g. `state.pendingFind = null`); never construct a real run for this. Use the stub rng objects named in `<read_first>`; assert `events.some((e) => e.type === "bagFull")` is false in every full-bag case.

    RED first: write the takesBagSlot/BAG_FREE_KINDS tests, run `node --test test/unit/bag-cap-gate.test.js` and see them fail on the missing exports; then GREEN with the two engine edits; then the remaining tests (they should pass on the first run — they lock existing behaviour).
  </action>
  <verify>
    <automated>test "$(grep -c '^export const BAG_FREE_KINDS = new Set(\["potion", "scroll", "bag"\]);' engine/derived.js)" = "1" && test "$(grep -c '^export function takesBagSlot(it)' engine/derived.js)" = "1" && test "$(grep -c '\.filter(takesBagSlot)' engine/derived.js)" = "1" && test "$(grep -c 'if (takesBagSlot(it) && !canStow(c)) {' engine/items.js)" = "1" && node --test test/unit/bag-cap-gate.test.js test/unit/inventory-actions.test.js test/unit/loot-pile.test.js test/unit/tools.test.js test/unit/economy.test.js test/unit/worn-slots.test.js && node --test "test/parity/**/*.test.js" "test/roundtrip/**/*.test.js" "test/persistence/**/*.test.js" && test -z "$(git diff --stat -- content test/parity)" && test "$(git hash-object test/parity/prototype-master.js.txt)" = "a1f4d0dc29782218d8e5aab65bc5989c33f917f0"</automated>
  </verify>
  <done>`takesBagSlot` and `BAG_FREE_KINDS` exist once in engine/derived.js; `slotItems` and `stowItem` are the only engine readers and neither carries its own kind inequality; the bag-cap-gate suite proves potion, scroll and bag are bag-free (unit, stow, store buy, find paths) and the parity/roundtrip/persistence suites pass with zero fixture drift and the master hash unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: VIEW-MODELS — `dropShelfItems` reads `takesBagSlot`; add `GEAR_COPY.freeRide`; re-pin gear-panels.test.js (bagUsage shape unchanged)</name>
  <files>src/browser/viewModels.js, test/unit/gear-panels.test.js</files>
  <read_first>
    - src/browser/viewModels.js line 10 (the `../../engine/derived.js` import list — append `takesBagSlot`), lines 303-312 (`bagUsage` — DO NOT change its return shape; test/unit/lootCompare.test.js lines 186-203 deepStrictEqual the exact `{have, slots, full, text}` object), lines 314-339 (`GEAR_COPY` — frozen; add the leaf after `bag: "BAG",` and before `empty:`), lines 341-355 (`dropShelfItems` — replace its inline kind inequality with the predicate).
    - test/unit/gear-panels.test.js lines 1-70 (imports, the `GEAR_COPY` frozen-shape deepEqual at 37-57 that you must re-pin, and the safety-wordlist leaf walk at 59-65 that auto-covers the new leaf) and the existing `dropShelfItems` section (~70-110; note the "kept in lock-step with slotItems" test).
  </read_first>
  <behavior>
    - dropShelfItems: `[gear a, {kind:"scroll"}, potion, gear b]` -> `[{it: a, i: 0}, {it: b, i: 3}]` (scroll AND potion excluded, true `c.items` indices preserved); the existing lock-step test (`dropShelfItems(c).map(x => x.it)` deep-equals `slotItems(c)`) still holds with a scroll-kind entry present.
    - GEAR_COPY: deepEquals the pinned literal with the new `freeRide: "potions & scrolls ride free"` leaf between `bag` and `empty`; still frozen; the leaf clears the safety wordlist (auto-walked).
    - bagUsage: unchanged — `test/unit/lootCompare.test.js` passes with no edit.
  </behavior>
  <action>
    In src/browser/viewModels.js: append `takesBagSlot` to the existing derived.js import (line 10); change `dropShelfItems`'s filter to `.filter(({ it }) => takesBagSlot(it))` and reword its doc comment's "the same potion exemption as slotItems" clause to "the same bag-free rule as `engine/derived.js#takesBagSlot` (potions, scrolls, bags)"; add the leaf `freeRide: "potions & scrolls ride free",` to `GEAR_COPY` immediately after `bag: "BAG",` (family-friendly, in voice — the Gear tab's BAG header appends it in Task 3; the phrase deliberately says nothing about counts so it needs no pluralisation). Leave `bagUsage` byte-identical — the shell appends the note; the view-model's `{have, slots, full, text}` contract is pinned by lootCompare.test.js and stays.

    In test/unit/gear-panels.test.js: re-pin the `GEAR_COPY` deepEqual with the new leaf in the same position; add the scroll case to the `dropShelfItems` section and extend the lock-step test's fixture with a `{ kind: "scroll", n: "s" }` entry so it proves both readers agree with a scroll present. RED first on the GEAR_COPY pin (it fails until the leaf lands), then GREEN.
  </action>
  <verify>
    <automated>test "$(grep -c '^    freeRide: "potions & scrolls ride free",$' src/browser/viewModels.js)" = "1" && test "$(grep -c '\.filter(({ it }) => takesBagSlot(it));' src/browser/viewModels.js)" = "1" && node --test test/unit/gear-panels.test.js test/unit/lootCompare.test.js test/unit/shell-clarity-43.test.js test/unit/shell-gear-39.test.js test/unit/shell-worn-slots.test.js test/voice/safety-scan.test.js</automated>
  </verify>
  <done>`dropShelfItems` and `slotItems` share `takesBagSlot` (proved in lock-step with a scroll-kind entry), `GEAR_COPY.freeRide` is the one home of the note copy and clears the safety wordlist, and `bagUsage`'s pinned shape is untouched.</done>
</task>

<task type="auto">
  <name>Task 3: SHELL — bridge `takesBagSlot`; gate the find card per item (the leak); loot `needsSlot` via the bridge; BAG header + store notes; section 8 in shell-loot-screen.test.js incl. the comment-stripped negative sweep; full gate + SUMMARY</name>
  <files>mazeworld.html, test/unit/shell-loot-screen.test.js</files>
  <read_first>
    - PRECONDITION: run `git status --short -- mazeworld.html src/browser/controls.js` — it MUST be empty (the concurrent 260918-vm3 map-camera task has committed). If not empty, do NOT edit mazeworld.html; commit Tasks 1-2, write the SUMMARY with `status: partial` naming the blocker, and stop.
    - mazeworld.html module block: line ~7113 (`import { characterSheetViewModel, …, bagUsage, itemRowState } from "./src/browser/viewModels.js";` — PINNED verbatim by test/unit/shell-clarity-43.test.js:114 and shell-loot-screen.test.js:58; do NOT edit), line ~7116 (the second viewModels import — PINNED by shell-clarity-43.test.js:123; do NOT edit), line ~7119 (`import { conditionsOf, canCast, eff, slotFor, WORN_SLOTS, hasTool, toHit, strikeDie, mapViewRadius, inViewWindow } from "./engine/derived.js";` — PINNED verbatim by shell-gear-39.test.js:61 and shell-worn-slots.test.js:181; do NOT edit — add a NEW import line directly below it), line ~7213 (`window.__mzBagUsage = bagUsage;` — add the new bridge on the next line).
    - mazeworld.html paint() carried-treasure region ~3388-3400: `const usage = window.__mzBagUsage(c);` then `document.getElementById("s-carry-n").textContent = usage.text;` — `gearCopy` (declared ~3319 as `window.__mzGear.copy`) is in scope here (it is used at `headRow(gearCopy.wielded)` a few lines below).
    - mazeworld.html loot branch ~6199-6215: `const needsSlot = S.pendingLoot.some((it) => …two inline kind checks…);` and the pinned `usage.full && needsSlot` shelf condition (test/unit/shell-combat-over.test.js:220 and shell-loot-screen.test.js:214 both match that exact substring — keep the variable name and the condition).
    - mazeworld.html store branch ~6244-6260: the `${usage.full ? \`<p class="enc-sub" style="color:var(--rust)">Bag full (…) — sell or drop something to make room.</p>\` : ""}` line (not pinned by any test; toasts.js/lootCompare.test.js pin a DIFFERENT string, the bagFull toast — leave toasts.js alone).
    - mazeworld.html find-card branch ~6428-6451 (`} else if (S.pendingFind && !S.combat && !S.store) {` … up to the `climb` branch): `const full = usage.full;`, the `key = "find:" + … + (full ? "full" : "room");`, the `if (full) { lines.push(copy.find.full.replace("{have}", usage.have).replace("{slots}", usage.slots)…); shelfItems = …; }` block and the `label: full ? copy.find.takeNow : copy.find.take` button — shell-loot-screen.test.js's `pendingFindRegion()` pins `window.__mzBagUsage(c)`, `usage.have`, `usage.slots` and the exact `copy.find.full.replace(...)` expression: keep all of those lines byte-identical and change ONLY the `const full = …` line.
    - test/unit/shell-loot-screen.test.js in full: the `stripComments` helper and `CODE` (comment-stripped source) near the top, `pendingFindRegion()` (147-155), `paintCarryRegion()` (244-249), `storeRegion()` (~268-273) and the loot-region helper used at line ~214 — reuse these region helpers in the new section; the file ends after section 7 ("no raw count survives").
  </read_first>
  <action>
    mazeworld.html (five surgical edits, nothing else — never touch the three pinned import lines):
    1. Directly below the pinned `./engine/derived.js` import line add a new line `import { takesBagSlot } from "./engine/derived.js";` with a one-line comment naming quick 260918-vvt (ESM allows a second import from the same module; the separate line keeps the two pinned regexes green).
    2. Directly below `window.__mzBagUsage = bagUsage;` add `window.__mzTakesBagSlot = takesBagSlot;` (the classic-script branches below can only reach module exports through `window.__mz*` bridges — same pattern as `__mzBagUsage`/`__mzDropShelfItems`).
    3. Find card: replace `const full = usage.full;` with `const full = usage.full && window.__mzTakesBagSlot(it);` and add a comment: the bag-full line / drop shelf / TAKE IT NOW render only when THIS item needs a slot — a potion or scroll found on a full bag gets the plain card and takeFind accepts it (engine stowItem never refuses a bag-free item). Everything else in the branch stays byte-identical (the `key`, `copy.find.full.replace…`, `shelfItems`, and button lines all key off `full` and inherit the fix).
    4. Loot screen: replace the `needsSlot` initialiser with `const needsSlot = S.pendingLoot.some((it) => window.__mzTakesBagSlot(it));` — keep the name and the `usage.full && needsSlot` condition exactly.
    5. Readouts: in paint() change the header write to `document.getElementById("s-carry-n").textContent = usage.slots !== null ? \`${usage.text} · ${gearCopy.freeRide}\` : usage.text;` (note shown only for a capped bag; a bag-less dev/test character keeps the bare count) with a comment citing GEAR_COPY.freeRide as the copy's one home; in the store branch append the in-voice clause so the rust line reads `Bag full (${usage.have}/${usage.slots}) — sell or drop something to make room. Potions and scrolls still ride free.` (static text inside an existing template literal — no user/item text is interpolated beyond the two numbers already there).

    test/unit/shell-loot-screen.test.js — append `// ─── 8. quick 260918-vvt: potions & scrolls never count against bag space ──` with source-assertion tests over the comment-stripped `CODE` (and, for the three module files, fresh `fs.readFileSync` + `stripComments` reads): (a) the module block contains exactly one `import { takesBagSlot } from "./engine/derived.js";` line AND the pinned derived.js import line is still present verbatim (copy the regex from shell-gear-39.test.js:61); (b) `window.__mzTakesBagSlot = takesBagSlot;` appears exactly once, on the line after `window.__mzBagUsage = bagUsage;`; (c) `pendingFindRegion()` contains `const full = usage.full && window.__mzTakesBagSlot(it);` and still contains the `copy.find.full.replace(...)` expression and `label: full ? copy.find.takeNow : copy.find.take`; (d) the loot region contains `const needsSlot = S.pendingLoot.some((it) => window.__mzTakesBagSlot(it));` and `usage.full && needsSlot`; (e) `paintCarryRegion()` contains `gearCopy.freeRide` and `usage.slots !== null`; (f) `storeRegion()` contains `Potions and scrolls still ride free.`; (g) the NEGATIVE SWEEP — after comment stripping, the inline potion-kind inequality (a `kind` strict-inequality against the potion kind string, in either spacing) appears ZERO times in mazeworld.html, engine/items.js, src/browser/viewModels.js AND engine/derived.js (the Set replaces the literal there too), and the only `"potion"` string left in engine/derived.js is inside the `BAG_FREE_KINDS` Set literal — build the regex in the test file from parts (e.g. `new RegExp("kind !== " + JSON.stringify("potion"))`) so the sweep's literal never has to be written into any source comment; (h) BEHAVIOUR: import `takesBagSlot` and prove `[{kind:"potion"},{kind:"scroll"},{kind:"bag"}].some(takesBagSlot)` is false and `takesBagSlot({kind:"gear"})` is true, so the shell pins and the engine predicate are tied in one file.

    Full gate, then SUMMARY. Run `npm test` and require `# fail 0` (the three vm3 failures seen in the working tree on 2026-09-18 belong to that task's uncommitted edits; with the precondition satisfied they are gone — if any `shell-map-store-polish` / `shell-map-viewport` test still fails on a clean tree, report it as pre-existing in the SUMMARY, do not touch those files). Run `npm run build:www` (exit 0). Confirm `git diff --stat -- content test/parity` is empty and the master hash is unchanged. Do NOT run `npm run android:debug` or any `adb` command (deferred-UAT protocol: one batched device checklist; the orchestrator offers the Play build).

    SUMMARY (`260918-vvt-SUMMARY.md`, frontmatter `status: complete`): record the ground truth (engine already exempt since Phase 29; scrolls scalar), the amendment, the four call sites now reading `takesBagSlot`, the find-card leak fixed, the two readout notes, gate results (test count, fail 0, build:www, parity hash), and end with `## Human verification` listing the manual browser sanity check for the batched Pixel 7 round: (1) serve the repo root over http (`npx serve .` or any static server — the ESM module needs http, not file://) and open mazeworld.html; new run; Hero -> Gear: the BAG header reads `n / m · potions & scrolls ride free`; (2) fill the bag to `m / m` (play, or use the dev start-at-depth harness), then find a Potion: the rail find card shows the item line only — no "Your bag is full" line, no drop shelf, button reads TAKE IT — tap it: the potion appears in the BAG list, the header still reads `m / m · …`; (3) with the bag still full, find gear: the card DOES show the bag-full line + drop shelf + TAKE IT NOW (unchanged); (4) enter a store with a full bag: the rust line ends "Potions and scrolls still ride free."; buying a potion (and, as a Magic User, a Sealed scroll) succeeds and deducts wilmst; buying Set of lockpicks is refused with the bagFull toast and no gold spent; (5) load a v1.5 save: bag/potions/scrolls intact, no console errors.
  </action>
  <verify>
    <automated>test -z "$(git status --short -- mazeworld.html src/browser/controls.js | grep -v '^M  ')" ; test "$(grep -c '^  import { takesBagSlot } from "./engine/derived.js";' mazeworld.html)" = "1" && test "$(grep -c '^  window.__mzTakesBagSlot = takesBagSlot;' mazeworld.html)" = "1" && test "$(grep -c 'const full = usage.full && window.__mzTakesBagSlot(it);' mazeworld.html)" = "1" && test "$(grep -c 'const needsSlot = S.pendingLoot.some((it) => window.__mzTakesBagSlot(it));' mazeworld.html)" = "1" && test "$(grep -c 'gearCopy.freeRide' mazeworld.html)" = "1" && test "$(grep -c 'Potions and scrolls still ride free\.' mazeworld.html)" = "1" && test "$(grep -c 'import { conditionsOf, canCast, eff, slotFor, WORN_SLOTS, hasTool, toHit, strikeDie, mapViewRadius, inViewWindow } from "./engine/derived.js";' mazeworld.html)" = "1" && node --test test/unit/shell-loot-screen.test.js test/unit/shell-combat-over.test.js test/unit/shell-clarity-43.test.js test/unit/shell-gear-39.test.js test/unit/shell-worn-slots.test.js test/unit/shell-map-rail.test.js && npm test 2>&1 | tail -12 | grep -q '^# fail 0' && npm run build:www && test -z "$(git diff --stat -- content test/parity)" && test "$(git hash-object test/parity/prototype-master.js.txt)" = "a1f4d0dc29782218d8e5aab65bc5989c33f917f0" && test -f .planning/quick/260918-vvt-potions-do-not-count-against-bag-space/260918-vvt-SUMMARY.md</automated>
  </verify>
  <done>A potion or scroll found, looted, bought or unequipped-around on a full bag is never called "bag full" by any prompt and is always accepted; the find card, loot shelf, Gear header and store line all read the single engine predicate through one bridge; the three pinned import lines are untouched; section 8 pins every shell edit and sweeps the inline inequality out of all four files; `npm test` is fail 0 with zero fixture drift; the SUMMARY carries the five-step browser sanity list for the batched device round.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| engine state (`S.c.items`, `S.pendingFind`, `S.pendingLoot`, `S.store.stock`) -> shell renderers | trusted engine data (item kinds from content tables); the shell reads `it.kind` through one bridged predicate and renders static copy |
| classic script -> module exports | `window.__mz*` bridges, same pattern as `__mzBagUsage`; assigned once at module init, read-only thereafter |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vvt-01 | Tampering | store branch innerHTML rust line | low | accept | only the pre-existing `usage.have`/`usage.slots` integers are interpolated; the appended clause is static in-voice copy, no item/user text |
| T-vvt-02 | Tampering | `takesBagSlot` on a malformed save item (null / non-object / no kind) | low | mitigate | predicate returns false for non-objects (never counted, never refused) and true for a kind-less object (counted, as `slotItems` always did) — pinned by unit tests; `clampCarry` stays gated on `c.bag` and one-directional so no old save is padded or truncated differently |
| T-vvt-03 | Denial of Service | find card render when `window.__mzTakesBagSlot` is undefined (bridge ordering) | medium | mitigate | the bridge is assigned in the same module init block as `__mzBagUsage`, which the same branch already dereferences on the line above; section 8(b) pins adjacency |
| T-vvt-04 | Tampering | concurrent 260918-vm3 working-tree edits to mazeworld.html | high | mitigate | Task 3 precondition: `git status` clean for mazeworld.html/controls.js before editing; otherwise stop after Task 2 with `status: partial` |
| T-vvt-SC | Tampering | npm/pip/cargo installs | high | mitigate | no package installs in this plan (package.json unchanged) |
</threat_model>

<verification>
- Engine: `node --test test/unit/bag-cap-gate.test.js` green with the new sections; `node --test "test/parity/**/*.test.js" "test/roundtrip/**/*.test.js" "test/persistence/**/*.test.js"` green; `git diff --stat -- content test/parity` empty; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.
- Single-helper invariant: `takesBagSlot` defined once (engine/derived.js); readers = `slotItems`, `stowItem`, `dropShelfItems`, `window.__mzTakesBagSlot` (find card `full`, loot `needsSlot`); the comment-stripped negative sweep over the four files finds zero inline potion-kind inequalities.
- Shell: the three pinned import lines (viewModels x2, derived.js) byte-identical; `usage.full && needsSlot` still present; `copy.find.full.replace(...)` still present; `npm test` `# fail 0`; `npm run build:www` exit 0.
- Manual (recorded in SUMMARY `## Human verification`, executed in the batched device round): the five-step browser sanity list in Task 3.
</verification>

<success_criteria>
- One engine predicate owns the bag-free rule for potions AND scrolls; every capacity check, prompt and readout reads it; the find-card leak is fixed; the Gear header and store line say the rule out loud in voice.
- No save-format change, no fixture regenerated, no parity drift, no APK/adb work in this plan; the SUMMARY hands the orchestrator the browser sanity checklist for the batched Pixel 7 round.
</success_criteria>

<output>
Create `.planning/quick/260918-vvt-potions-do-not-count-against-bag-space/260918-vvt-SUMMARY.md` when done (frontmatter `status: complete`, or `status: partial` naming the vm3 working-tree blocker if Task 3's precondition failed; ends with `## Human verification` per the Task 3 contract).
</output>
