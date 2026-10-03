---
phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
plan: 05
subsystem: shell text layer (Grimoire, combat SPELLS and ITEMS rows, find card)
tags: [flavour, text-layer, rules-layer, grimoire, combat-menu, find-card, snapshots]
requires:
  - phase: 95-02
    provides: rulesLayer.js (mountRules, wrapRow), window.__mzRules, Always show the rules, .mw-rules-* CSS and the combat-lock rule
  - phase: 95-03
    provides: SPELL_FLAVOR, SCROLL_FLAVOR, POTION_FLAVOR
  - phase: 95-04
    provides: MAGIC_ITEM_FLAVOR, WEAPON_FLAVOR, ARMOR_FLAVOR
provides:
  - Grimoire rows that read niche label + flavour with a collapsed RULES toggle holding the exact old line
  - additive lead, rules, rulesId on combat spell, item, potion and scroll rows (src/browser/combatMenu.js#withFlavor)
  - renderActionArea wrapper that puts the RULES toggle beside (never inside) the row button
  - find card item line = name · flavour with a RULES toggle mounted outside the typed lines
  - test/unit/rules-surfaces.test.js (the one-rule-everywhere surface test; 95-06 and 95-07 extend it)
  - one declared fixture move: mu.hero
affects: [95-06, 95-07, 95-08, 96]
tech-stack:
  added: []
  patterns: [additive view-model fields (lead/rules/rulesId) with desc untouched, sibling-not-child toggle for action rows, a rail line's `rules` property as the reuse point for Phase 96's chip card]
key-files:
  created:
    - test/unit/rules-surfaces.test.js
  modified:
    - src/browser/heroTab.js
    - src/browser/combatMenu.js
    - mazeworld.html
    - test/unit/combatMenu.test.js
    - test/unit/find-card-scroll-rows.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
key-decisions:
  - "The niche label stays as the leading category tag before the flavour on both the Grimoire and the combat row (Claude's discretion named in the plan); a blocked spell's reason stays first and visible."
  - "withFlavor adds lead/rules/rulesId only when there is flavour AND rules text to hide; desc is never changed, so every reader and guard sees today's text."
  - "Rules ids for carried, worn and staff rows carry the bag index or slot plus the item name so two same-named items never share a toggle or a DOM id (a deviation from the plan's bare combat:item:<name>, documented below)."
requirements-completed: []
status: complete
duration: ~30 min
completed: 2026-10-03
---

# Phase 95 Plan 05: Grimoire, combat rows and find card show flavour with RULES Summary

The Grimoire, the combat SPELLS and ITEMS rows and the find card now lead with the flavour line and keep the exact rules one tap away behind the shared RULES toggle; the functional tags, the blocked-spell reason, the live resist hint, the compare line and the usable-by suffix stay visible. One snapshot fixture moved (mu.hero), declared.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1. Grimoire shows flavour, RULES under it | a7b108e4 | `grimoireViewModel` rows gain additive `flavor`; `renderGrimoire` writes `nicheLabel · flavour` and mounts `mountRules` (id `grim:<name>`); mu.hero regenerated and declared in the snapshot test header |
| 2. Combat SPELLS and ITEMS rows | 330c2e43 | `withFlavor` helper in combatMenu.js; renderActionArea wraps a row with `window.__mzRules.wrap` when `r.rules` is set, `cbRow` untouched, exactly one `cbRow(row, ` call kept; combatMenu.test.js re-pins and four new tests |
| 3. Find card RULES and the surface test | 55f4d5ed | find branch reads `window.__mzRules.flavorOfItem(it)`; lines loop mounts the toggle outside typedTargets/typedTexts; rail onclick early-returns on `.mw-rules-btn`; `rules-surfaces.test.js` (13 tests) |

## mu.hero before and after (first changed row, Doze)

Before:
`<b><span class="grim-lvl">L1</span>Doze</b><i>control · d4 foes, your target first · asleep d4 rounds each; a hit wakes the sleeper it lands on, because a nap is not armour · a foe may resist this on its intelligence, and the deeper the floor, the likelier it does</i>`

After:
`<b><span class="grim-lvl">L1</span>Doze</b><i>control · A lullaby for several foes together, undone by the first rude interruption.</i>` followed by `<button class="mw-rules-btn" aria-controls="mw-rules-grim-Doze" aria-expanded="false" aria-label="Rules for Doze" ...>RULES ▸</button>` and `<div id="mw-rules-grim-Doze" class="mw-rules-body" hidden><p class="mw-rules-line">` whose text is the whole old line (`control · d4 foes, ... · a foe may resist this on its intelligence, and the deeper the floor, the likelier it does`).

Heal (a self spell) after: `healing · Closes wounds the polite way: quickly, and without asking how you got them.` with rules body `healing · you · d10 hp`.

## Declared re-pins (file, test, what moved)

- `test/unit/fixtures/shell-snapshots/mu.hero.txt`: regenerated with `MZ_SNAPSHOT_UPDATE=1` (the only fixture that moved; thief.hero has no Grimoire and the other eight are byte-identical). Declared in the Phase 95 (FLAVOR-01, FLAVOR-05), Plan 05 paragraph of `test/unit/shell-tab-snapshots.test.js`'s header.
- `test/unit/combatMenu.test.js`: three whole-row `deepEqual` pins re-pinned, each with a "Phase 95 (FLAVOR-01/02/05): declared re-pin" comment: "ITEMS: potion + scroll + a carried item recharging" (potion and scroll rows gain lead/rules/rulesId), "ITEMS: a bagged activatable staff recharging ... Ring of Power" (potion and worn-jewelry1 rows gain them; the NOT WIELDED reason row gains nothing), "ITEMS: a wielded staff gets its own EQUIPPED row" (potion and worn-weapon rows gain them). Four new tests: a spell row's desc is the pre-phase formula while lead starts with the niche label and rules hold the txt (and the live hint stays in lead, not rules); a blocked Door Illusion row's lead starts with its blocked reason and its rules hold only the txt; the NOT EQUIPPED and NOT WIELDED reason rows have no lead, rules or rulesId while a ready carried item leads with its flavour; a ready item with no rules text keeps today's row.
- `test/unit/find-card-scroll-rows.test.js`: "(a) a find with room ... gets no head wrapper" asserted every child of the lines column is a `mw-rail-line|roll`; it now also allows the RULES toggle and body and adds an explicit "no mw-find-head" assertion. Declared re-pin comment in place.
- Not touched, though the plan listed them as possible re-pins: `shell-combat-actions.test.js`, `shell-map-rail.test.js`, `shell-clarity-43.test.js`, `grimoireViewModel.test.js`, `heroTab.test.js`. The sweep proved none of them moved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rules ids made unique per row**
- **Found during:** Task 2
- **Issue:** the plan's `combat:item:${it.n}` for carried, worn and staff rows would give a worn jewel and a bagged copy of the same jewel (or two same-named bag items) the same open-state key and the same DOM id (`mw-rules-<id>`), which duplicates `aria-controls` targets and makes one toggle open the other.
- **Fix:** carried rows use `combat:item:${bagIndex}:${name}`, worn rows `combat:worn:${slot}:${name}`, the wielded staff `combat:worn:weapon:${name}`. Spell, potion and scroll ids are as planned (`combat:spell:<name>`, `combat:potion`, `combat:scroll`).
- **Files modified:** src/browser/combatMenu.js, test/unit/combatMenu.test.js
- **Commit:** 330c2e43

**2. [Plan adaptation] "old save's item with no flavour" at the combat rows**
- **Found during:** Task 2
- **Issue:** a combat ITEMS row only exists for an item the engine can activate, and activation is keyed by the item's name, so an unknown (removed) item never reaches a row; the plan's tolerant-load case is therefore pinned on the find card (where it can occur) and the row-level fallback is pinned with an item that has flavour but no rules text.
- **Files modified:** test/unit/combatMenu.test.js, test/unit/rules-surfaces.test.js

**3. [Housekeeping] Phantom fixture touches**
- `MZ_SNAPSHOT_UPDATE=1` rewrote mu.gear, thief.gear, thief.gear-sheet-bag and thief.gear-sheet-worn with identical content (git showed them modified only through line-ending normalisation, no content diff). They were restored with `git checkout -- <file>` before the commit, so only mu.hero.txt is in the diff against PHASE_BASE.

## Verification results

- Full `npm test` (node --test, run from the repo root at the end of the plan): tests 10372, pass 10364, fail 0, skipped 8, duration about 350 s. The 95-02 baseline was 10355 / 10315 / 0 / 40 skipped; the 32 per-domain flavor-layer tests that skipped by name until the maps landed now run, and this plan adds 17 tests (13 in rules-surfaces.test.js, 4 in combatMenu.test.js). The 8 remaining skips predate the phase.
- Task gates: the Task 1, 2 and 3 verify commands each exit 0 without `MZ_SNAPSHOT_UPDATE`; `node --test --test-name-pattern="Tolerant|tolerant" test/unit/rules-surfaces.test.js` exits 0.
- `grep -c "__mzRules.wrap(document" mazeworld.html` = 1; renderActionArea holds exactly one `cbRow(row, ` call; `grep -c 'closest(".mw-rules-btn")' mazeworld.html` = 1.
- `git diff --stat cb5f77ec -- test/unit/fixtures/shell-snapshots` lists only mu.hero.txt. Engine, parity and determinism files and the guard files are unchanged by this plan.
- Line endings: mazeworld.html, combatMenu.js, heroTab.js, combatMenu.test.js, shell-tab-snapshots.test.js and find-card-scroll-rows.test.js remain `w/crlf`; mu.hero.txt `w/lf`; the new test file LF; none `w/mixed`.

## Requirements bookkeeping

FLAVOR-01 and FLAVOR-02 are NOT marked complete here (95-08 closes them); `requirements.mark-complete` was not run.

## Hand-off

95-06 (Gear) and 95-07 (store, sell, loot, drop) extend `test/unit/rules-surfaces.test.js`, one describe block per surface, using the same helpers (`findAll`, `tap`, `paintFind`) and the `window.__mzRules` bridge. The rail line's `rules` property (find branch plus the lines loop) is the reuse point for Phase 96's chip card.

## For the end-of-phase device check

1. Combat list fit at text size L with the RULES column: the 206 px list cap (`.cb-sub-list`) with a 48 px toggle beside every wrapped row and an open rules body spanning the full width beneath.
2. A ghost tap on a freshly opened submenu's toggle: the toggle is a plain onclick that is not arm-guarded (an inspection), so a tap landing on it right after the SPELLS or ITEMS submenu opens reveals the rules instead of being swallowed. Confirm that reads as harmless.
3. The niche-label-before-flavour call (Claude's discretion): the leading category word (healing, control, burst...) before the flavour on the Grimoire and the combat row.
4. The find card's toggle while the line is still typing: the toggle and its body are not typed targets, so the toggle shows from the first frame while the flavour is still being typed; a tap on it must not complete the typing or dismiss the card (stopPropagation plus the early return ahead of the arm check).

## Known Stubs

None. Every surface reads live flavour maps; a row or item with no flavour renders its rules text as today.

## Threat Flags

None. No network, auth, file-access or schema surface was added; the new fields are view-model strings and are never serialized into saves.

## Self-Check: PASSED

- FOUND: test/unit/rules-surfaces.test.js, src/browser/combatMenu.js (withFlavor), src/browser/heroTab.js (flavor), mazeworld.html (`__mzRules.wrap(document`, `closest(".mw-rules-btn")`)
- FOUND commits: a7b108e4, 330c2e43, 55f4d5ed
