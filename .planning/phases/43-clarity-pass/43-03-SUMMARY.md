---
phase: 43-clarity-pass
plan: 03
subsystem: view-model
tags: [view-model, loot-legibility, gear-tab, pure, deferred-uat]

# Dependency graph
requires:
  - phase: 37-equipment-slot-model-eff-refactor
    provides: "c.worn = { ring?, bracelet?, amulet?, helm?, cloak?, staff? } (WORN_SLOTS, slotFor, autoWearSlot's staff Magic-User gate) and slotItems(c)'s potion-exemption capacity count this plan's emptySlotRows/dropShelfItems build on directly"
  - phase: 43-clarity-pass (Plan 01/02)
    provides: "the docs/CLARITY.md ledger this plan appends two sections to, and the HP-not-WP standing guard (test/unit/hp-not-wp.test.js) this plan's two new COPY objects join"
provides:
  - "src/browser/viewModels.js#usableBy(it, c = null) + USABLE_COPY — the ONE '(usable by …)' rule for weapons/armor/staves, legality via the engine's own weaponRefusalReason/armorRefusalReason and the staff Magic-User gate, never a restated class rule"
  - "lootCompare(c, it).usable — additive on all four branches (weapon/armor/bag/fallthrough), so the LOOT screen reads the suffix from the same source it already reads"
  - "dropShelfItems(c) — the bag-full drop prompt's ONE source list: true c.items indices, potions excluded, in lock-step with engine/derived.js#slotItems"
  - "emptySlotRows(c) + GEAR_COPY — one in-voice row per empty worn slot (armor + the six WORN_SLOTS), the staff row reading staffNotYou for a non-Magic-User"
  - "docs/CLARITY.md ## Loot legibility (CLAR-02) and ## Gear screen (CLAR-04) sections"
  - "test/unit/usableBy.test.js (25 tests), test/unit/gear-panels.test.js (14 tests); test/unit/lootCompare.test.js extended with a usable assertion in every case; USABLE_COPY/GEAR_COPY added to test/unit/hp-not-wp.test.js's COPY walk"
affects: [43-04-shell-wiring-phase-close]

tech-stack:
  added: []
  patterns:
    - "usableBy/lootCompare/dropShelfItems/emptySlotRows all defer legality/capacity to the engine's own predicates (weaponRefusalReason, armorRefusalReason, slotItems) rather than restating a rule locally — the same single-source-of-truth discipline armorDisplay/damageBracket already established in this file."
    - "GEAR_COPY.empty and USABLE_COPY are frozen leaf-string objects walked by both the family-friendly safety-wordlist scan and the standing hp-not-wp guard, mirroring ITEM_STATE_COPY/RATIONS_COPY's precedent."

key-files:
  created:
    - test/unit/usableBy.test.js
    - test/unit/gear-panels.test.js
  modified:
    - src/browser/viewModels.js
    - test/unit/lootCompare.test.js
    - test/unit/hp-not-wp.test.js
    - docs/CLARITY.md

key-decisions:
  - "An unrestricted item (cls === \"FTM\") never gets a '(usable by …)' suffix, even when the CURRENT hero cannot use it for some other reason (a sub-class gate like Acrobat-dagger-only, or a noArmor race offered Cloth) — that refusal is lootCompare's separate 'can't use (…)' line's job, not this suffix's. Verified directly against the plan's own behavior spec (an Acrobat offered an Axe reads '', not 'not you')."
  - "The Heft clause ('— and a Thief with Heft') fires only when the hero legally CAN use the item (armorRefusalReason returned null) but their class letter isn't among the item's own restricted letters — the one live case is a Thief with the Heft skill wearing ar<=12 armor whose cls is 'F'. Any other legal-but-not-in-letters case would hit the same branch, but no such case exists in the current content (staves/weapons never have a Thief-only Heft-style escape hatch)."
  - "emptySlotRows(c) guards against a non-object c (returns []) even though the plan's own acceptance criteria only exercise real character shapes — this matches the file's existing defensive style (bagUsage, slotItems) rather than leaving one new export as the file's only crash-on-null function."

requirements-completed: [CLAR-02, CLAR-04]

coverage:
  - id: D1
    description: "usableBy(it, c) + USABLE_COPY: the full truth table (unrestricted/F/FT/M items, no-hero and with-hero legal/illegal/Heft cases) reads exactly per the plan's <behavior> spec; lootCompare(c, it).usable is additive and matches usableBy(it, c) on every branch"
    requirement: "CLAR-02"
    verification:
      - kind: unit
        ref: "test/unit/usableBy.test.js (25/25); test/unit/lootCompare.test.js (18/18, every case usable-asserted)"
        status: pass
    human_judgment: false
  - id: D2
    description: "dropShelfItems(c) returns only slot-consuming bag items with true c.items indices (potions excluded), length-locked to slotItems(c); emptySlotRows(c) returns armor-then-WORN_SLOTS rows for every empty slot, staff row staff-aware, [] for a fully-equipped Magic User; GEAR_COPY frozen and voice-clean"
    requirement: "CLAR-04"
    verification:
      - kind: unit
        ref: "test/unit/gear-panels.test.js (14/14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/CLARITY.md's Loot legibility (CLAR-02) and Gear screen (CLAR-04) sections exist, cross-link docs/GEAR-SLOTS.md, and precede the Requirements map heading; the whole-suite gate holds (master hash unchanged, npm test green, build:www exits 0, fixtures untouched)"
    verification:
      - kind: other
        ref: "grep -c on both section headers + docs/GEAR-SLOTS.md cross-link; npm test 3146/3146 (# fail 0); git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; npm run build:www exit 0; git status --porcelain test/parity/fixtures empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "The new usableBy/dropShelfItems/emptySlotRows/GEAR_COPY strings are visually confirmable on a Pixel 7 once Plan 04 wires them into mazeworld.html"
    verification: []
    human_judgment: true
    rationale: "Deferred per the standing defer-uat-to-end instruction — this plan is pure view-model work with zero mazeworld.html change; nothing here is on-screen yet, so no device check is meaningful until Plan 04 lands the wiring."

duration: unrecorded (single continuous session, no start-time checkpoint captured)
completed: 2026-09-18
status: complete
---

# Phase 43 Plan 03: Loot Legibility (usableBy) + Gear Panel View Models Summary

**One pure `usableBy(it, c)` rule (legality via the engine's own `weaponRefusalReason`/`armorRefusalReason` and the staff Magic-User gate, never restated) feeding an additive `lootCompare.usable` field, plus `dropShelfItems(c)` (bag-only, true `c.items` indices, lock-stepped with `slotItems`) and `emptySlotRows(c)`/`GEAR_COPY` (the ON YOU panel's in-voice empty-slot rows) — everything Plan 04's shell wiring needs, built and tested before any `mazeworld.html` edit.**

## Performance

- **Duration:** unrecorded (single continuous session, no start-time checkpoint captured)
- **Tasks:** 3 (plan tasks) — committed as 4 atomic commits (one small follow-up correction)
- **Files modified:** 5 (2 new, 3 modified) plus the SUMMARY

## Accomplishments

- **Task 1 — `usableBy(it, c)` + `USABLE_COPY` + `lootCompare.usable`:** `restrictedClasses(it)` reads a weapon's `WEAPONS[it.base].cls`, an armor's `it.cls` (falling back to an `ARMORS` name lookup for a sparse item), or `"M"` for any `kind: "staff"` — returning `null` (unrestricted) for `"FTM"` or any other kind. `usableBy(it, c = null)` builds the "(usable by …)" text from `USABLE_COPY`'s letter map, then — only when a hero is given — checks legality via `weaponRefusalReason`/`armorRefusalReason` (engine/items.js, never restated) or `c.cls === "Magic User"` for a staff, appending `notYou` when illegal or `heft` when legal but the hero's own class letter isn't among the item's restricted letters (the Thief-with-Heft-wearing-Fighter-armor case). `lootCompare` gained an additive `usable: usableBy(it, c)` field on all four return branches (weapon/armor/bag/fallthrough) with a one-line Phase 43 comment on each. `test/unit/usableBy.test.js` (new, 25 tests) pins every `<behavior>` case plus a `USABLE_COPY` shape/frozen pin, a safety-wordlist walk, and a purity test; `test/unit/lootCompare.test.js`'s existing 9 compare cases and 2 bag/misc cases each gained a `cmp.usable` assertion; `USABLE_COPY` was added to `test/unit/hp-not-wp.test.js`'s COPY walk.
- **Task 2 — `dropShelfItems(c)`, `emptySlotRows(c)`, `GEAR_COPY`:** `dropShelfItems(c)` maps `c.items` to `{ it, i }` pairs (true index preserved) and filters out potions — the same exemption `engine/derived.js#slotItems` uses, so the two stay length-locked by test across every shape. `emptySlotRows(c)` pushes an armor row (via `armorDisplay(c)`, only when neither worn nor the Cloak of Armor's magic plate) followed by one row per `WORN_SLOTS` key that is falsy in `c.worn` — a legacy `c` with no `worn` map yields all six slot rows plus armor. The staff row alone is class-aware: `GEAR_COPY.empty.staffNotYou` for anyone but a Magic User, `GEAR_COPY.empty.staff` otherwise. `GEAR_COPY` was added exactly per the plan's literal (ON YOU/WIELDED/WORN/ALSO ON YOU/BAG headings + eight in-voice empty-slot strings, nested `empty` also frozen). `test/unit/gear-panels.test.js` (new, 14 tests) pins the `GEAR_COPY` shape/frozen/wordlist checks, `dropShelfItems`'s true-index/potion-skip/null-safety/lock-step-with-`slotItems` behavior, and `emptySlotRows`'s order, staff-not-you, magic-plate-counts-as-worn, legacy-no-`worn`, fully-equipped-empty, and purity cases. A follow-up commit added `GEAR_COPY` to `test/unit/hp-not-wp.test.js`'s COPY walk (initially omitted from the Task 2 commit, caught and fixed before Task 3's gate).
- **Task 3 — CLARITY ledger + gate:** `docs/CLARITY.md` gained `## Loot legibility (CLAR-02)` (the `usableBy` rule, the three text forms, the never-restate-legality discipline, where it shows, and the "Joiner offer carries no item" finding resolving CONTEXT's open question) and `## Gear screen (CLAR-04)` (the ON YOU/ALSO ON YOU/BAG panel split against Phase 37's worn model, the bag-only drop prompt, cross-linked to `docs/GEAR-SLOTS.md`), both inserted before the `## Requirements map` placeholder. Full gate run and recorded below.

## Task Commits

Each task was committed atomically:

1. **Task 1: usableBy(it, c) + USABLE_COPY; lootCompare.usable (additive)** - `d8639b5` (feat)
2. **Task 2: dropShelfItems (bag-only, true indices) + emptySlotRows + GEAR_COPY** - `5d97c86` (feat)
2a. **Follow-up: add GEAR_COPY to hp-not-wp.test.js's COPY walk** - `5376bf6` (test) — a correction of an omission from Task 2's own action spec, caught before the plan gate
3. **Task 3: docs/CLARITY.md ledger sections + plan gate** - `70fc543` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `test/unit/usableBy.test.js` (new) — 25 tests: the full `usableBy` truth table, `USABLE_COPY` shape/frozen pin, safety-wordlist walk, purity
- `test/unit/gear-panels.test.js` (new) — 14 tests: `GEAR_COPY` shape/frozen/wordlist, `dropShelfItems`, `emptySlotRows`
- `src/browser/viewModels.js` — `USABLE_COPY`, `restrictedClasses`, `usableBy`, `lootCompare`'s additive `usable` field (4 sites), `GEAR_COPY`, `dropShelfItems`, `emptySlotRows`; `WORN_SLOTS`/`ARMORS` added to the existing import lines
- `test/unit/lootCompare.test.js` — every existing case gained a `cmp.usable` assertion
- `test/unit/hp-not-wp.test.js` — `USABLE_COPY` and `GEAR_COPY` added to the walked COPY banks
- `docs/CLARITY.md` — `## Loot legibility (CLAR-02)` and `## Gear screen (CLAR-04)` sections

## Decisions Made

See `key-decisions` in the frontmatter: (1) unrestricted items never carry the usable-by suffix even when the current hero has some other reason to be refused; (2) the Heft clause is a legal-but-not-in-letters branch, currently only reachable via the Thief-with-Heft/`ar<=12` armor case; (3) `emptySlotRows` guards a non-object `c` defensively, matching the file's existing null-safety style even though no acceptance test required it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `GEAR_COPY` missing from `test/unit/hp-not-wp.test.js`'s COPY walk in the Task 2 commit**
- **Found during:** Task 2 (self-review before the Task 3 gate)
- **Issue:** The plan's Task 2 action B explicitly calls for adding `GEAR_COPY` to the hp-not-wp COPY walk; the initial Task 2 commit added the export and its own test file but omitted the hp-not-wp.test.js edit.
- **Fix:** Added `GEAR_COPY` to the import and the walked `banks` object in `test/unit/hp-not-wp.test.js`; re-ran the full Task 2 verification set (102/102 green).
- **Files modified:** `test/unit/hp-not-wp.test.js`
- **Verification:** `node --test test/unit/hp-not-wp.test.js test/unit/gear-panels.test.js test/unit/lootCompare.test.js test/unit/itemRowState.test.js test/unit/worn-slots.test.js test/voice/safety-scan.test.js` — 102/102
- **Committed in:** `5376bf6`

---

**Total deviations:** 1 auto-fixed (1 bug — a same-plan omission caught before the gate, not a plan defect)
**Impact on plan:** No scope creep; the fix is exactly the plan's own already-specified action, applied in a follow-up commit rather than an amend.

## Issues Encountered

None beyond the self-caught omission above.

## User Setup Required

None — no external service configuration required.

## Gate (Task 3, plan's own verification — verification agents are off)

- `npm test`: **3146/3146**, `# fail 0` (well above the required floor of Plan 02's 3112 + 28 = 3140)
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `npm run build:www`: exit 0 (`src/browser/viewModels.js` was touched, so the build was required and run per the plan's own gate)
- `git status --porcelain test/parity/fixtures`: empty (zero fixture files touched)
- `git status --porcelain` after `build:www`: only `docs/CLARITY.md` modified (the `www/` build artifact is gitignored, confirmed clean)
- `grep -c "^## Loot legibility (CLAR-02)" docs/CLARITY.md`: 1; `grep -c "^## Gear screen (CLAR-04)" docs/CLARITY.md`: 1; `grep -c "docs/GEAR-SLOTS.md" docs/CLARITY.md`: 2; `grep "^## " docs/CLARITY.md | tail -1`: `## Requirements map` (still the last heading)
- No engine, `mazeworld.html`, or content edit was made this plan (confirmed by `git diff --stat` on the four task commits — every touched path is `src/browser/viewModels.js`, `test/unit/*.js`, or `docs/CLARITY.md`)
- `store-listing/`/`tools/store-screenshots/`: untouched throughout (never staged)

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan — this plan is pure view-model and doc work with **zero `mazeworld.html`/shell-render change**, so there is nothing on-screen yet to check. The following become checkable once Plan 04 wires these exports into the shell, and should be batched into the end-of-run Pixel 7 checklist:

1. **FIND card on a class-restricted weapon/armor drop** — offer a Fighter-only weapon (e.g. Bardiche) to a Thief; the card should read `(usable by Fighters — not you)` in the deadpan voice, no tonal drift.
2. **FIND card on a Thief with the Heft skill, offered Mail** — should read `(usable by Fighters — and a Thief with Heft)`.
3. **Victory LOOT screen rows** — every weapon/armor/staff row shows the same suffix as the FIND card would for that item (both read `lootCompare.usable`).
4. **Store buy rows** — a Fighter-only weapon/armor for sale reads `(usable by Fighters)` (or `— not you` if the current hero can't use it); an unrestricted item (Axe, Cloth) shows no suffix at all.
5. **Gear tab ON YOU panel, empty slots** — an unequipped ring/bracelet/amulet/helm/cloak/staff each read their own in-voice empty line ("ring — nothing. Ten fingers, zero commitments." etc.); a non-Magic-User's empty staff slot reads "staff — nothing, and nothing you could hold. Magic Users only." while a Magic User's reads the plain "Wave your hands…" line.
6. **Bag-full drop prompt** — with a potion and two gear items in the bag, the drop shelf lists only the two gear items (never the potion, never the worn/wielded weapon or armor); tapping a listed item drops the correct one (index correctness).

## Corrections to CONTEXT

- CONTEXT's CLAR-02 decision names "the Company/Joiner offer where an item is involved" as a site the usable-by suffix should show. Verified directly (Plan 02's SUMMARY and this plan's read of the offer-card construction sites): **the Joiner offer card carries no item at all** — it offers a companion, not a piece of gear. This resolves to "none today"; `docs/CLARITY.md`'s new Loot legibility section records this explicitly so Plan 04 does not go looking for a wiring site that doesn't exist.

## Next Phase Readiness

- CLAR-02 and CLAR-04's logic is complete, tested (39 new tests across two new files, plus extensions to two existing ones), and ledgered — Plan 04 can wire `usableBy`/`lootCompare.usable`/`dropShelfItems`/`emptySlotRows`/`GEAR_COPY` into `mazeworld.html` as pure bridging with no new logic to write.
- No engine, content, or shell change landed this plan; `mazeworld.html` remains exactly as Plan 02 left it, confirmed by the gate.
- No blockers. `npm test`: 3146/3146, `# fail 0`. Master hash unchanged. Fixtures untouched. `npm run build:www` exit 0.

## Self-Check: PASSED

- Files: `src/browser/viewModels.js`, `test/unit/usableBy.test.js`, `test/unit/gear-panels.test.js`, `test/unit/lootCompare.test.js`, `test/unit/hp-not-wp.test.js`, `docs/CLARITY.md` — all FOUND on disk.
- Commits: `d8639b5`, `5d97c86`, `5376bf6`, `70fc543` — all FOUND in `git log --oneline --all`.

---

*Phase: 43-clarity-pass*
*Completed: 2026-09-18*
