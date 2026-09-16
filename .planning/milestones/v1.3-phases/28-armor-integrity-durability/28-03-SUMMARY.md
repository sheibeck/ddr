---
phase: 28-armor-integrity-durability
plan: 03
subsystem: shell
tags: [armor, shell, hud, gear-panel, store, key-decision]

# Dependency graph
requires:
  - phase: 28-armor-integrity-durability
    plan: "01"
    provides: "left/patches bag-item fields, armorSoaked.underMin/.magic flags, itemUnequipped.destroyed flag"
  - phase: 28-armor-integrity-durability
    plan: "02"
    provides: "armorDisplay(c)/bagArmorText(it) formatter exports from src/browser/viewModels.js"
provides:
  - "window.__mzArmorDisplay = { armorDisplay, bagArmorText } bridged onto the classic script's global namespace, mirroring the __mzConditionsOf/__mzNightlyEats precedent"
  - "The live HUD Armor line (#s-arm) now shows durability — closes the reported 'toast says wear, panel shows no damage' bug at its actual root cause"
  - "The #s-kit armor row and the gear panel worn row read the same armorD object as the HUD line — one formatter, three call sites, no inline current/max template survives"
  - "Every bag armor row (GEAR tab, store sell list, combat use list, full-bag drop shelf, pending-find card) shows remaining durability via bagArmorText(it), never the frozen it.txt"
  - "A destroyed worn piece's Unequip control works even on a full bag (no slot needed — the piece is discarded per Plan 01's unequipSlot branch)"
  - "The store repair row's sub-label reads the worn piece's durability via armorDisplay(S.c).wornSub plus an hp-to-mend count, relabelled entirely in the shell — engine/economy.js's parity-compared stock sub string is untouched"
  - "The classic (dead-code) CLOAKS table's Cloak of Armor line now mirrors the live content/treasure-tables.js string"
  - "PROJECT.md's Key Decisions table records the ARMOR-01 ruling: soak-vs-wear canon kept; Cloak of Armor = never-wearing plate for any carrier; destroyed armor is gone"
affects: []

tech-stack:
  added: []
  patterns:
    - "Single computed armorD const per paint() call, read by three DOM sites (HUD line, kit row, gear worn row) — mirrors the project's established window.__mz* read-only bridge pattern (__mzConditionsOf, __mzNightlyEats, __mzBags)"
    - "wornRow() gained a noSlotNeeded parameter so a destroyed piece's Unequip control bypasses the bag-full block (mirrors the existing bagFull-gated gearBtn pattern, extended rather than duplicated)"

key-files:
  created:
    - test/unit/shell-armor-display.test.js
  modified:
    - mazeworld.html
    - .planning/PROJECT.md

key-decisions:
  - "The store repair row's relabelling happens entirely in mazeworld.html's shelf renderer (a local `sub` computed from armorDisplay(S.c).wornSub) — engine/economy.js's repairArmor stock `sub` string was never touched, keeping the economy parity harness green"
  - "The find-card and drop-shelf armor substitutions each compute a local `const` (findSub / biSub) before interpolation, rather than an inline ternary inside the template literal, so the literal source string `it.kind === \"armor\" ? window.__mzArmorDisplay.bagArmorText(it)` (and the bi.kind analog) appears verbatim and greppable at both call sites — matching the plan's own literal acceptance-criteria greps"

requirements-completed: [ARMOR-01, ARMOR-02, ARMOR-04]

coverage:
  - id: D1
    description: "paint() writes #s-arm from armorDisplay(c).line — the HUD Armor line now shows durability and moves with every soaked hit, closing the reported display bug at its actual root cause"
    requirement: "ARMOR-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-armor-display.test.js#Phase 28 (ARMOR-02): paint() computes armorD once and writes #s-arm from armorD.line"
        status: pass
      - kind: integration
        ref: "npm test (full suite) — 1485/1485 passing"
        status: pass
    human_judgment: false
  - id: D2
    description: "The #s-kit armor row and the gear panel worn row are built from the same armorD object — no inline current/max template literal survives in mazeworld.html; the Cloak of Armor headline + underneath piece render on the worn row, with a destroyed piece's Unequip control working even on a full bag"
    requirement: "ARMOR-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-armor-display.test.js#Phase 28 (ARMOR-03/04): the gear worn row is wired through armorD, with a noSlotNeeded param"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every bag armor row (GEAR tab, store sell list, combat use list via renderCarriedList, the full-bag drop shelf, and the pending-find card) shows bagArmorText(it) — remaining durability with the hp label — never the frozen it.txt for kind armor"
    requirement: "ARMOR-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-armor-display.test.js#Phase 28 (ARMOR-03): renderCarriedList reads bagArmorText for a kind:\"armor\" item"
        status: pass
      - kind: unit
        ref: "test/unit/shell-armor-display.test.js#Phase 28 (ARMOR-03): the pending-find card and full-bag drop shelf both read bagArmorText"
        status: pass
    human_judgment: false
  - id: D4
    description: "The store repair row's sub-label reads the worn piece via armorDisplay(c).wornSub plus the hp-to-mend count while engine/economy.js's stock sub string is untouched (parity-safe)"
    requirement: "ARMOR-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-armor-display.test.js#Phase 28 (ARMOR-02): the store repair row reads armorDisplay(S.c).wornSub + hp to mend, engine text untouched"
        status: pass
      - kind: integration
        ref: "git diff --stat engine/economy.js — 0 lines changed"
        status: pass
    human_judgment: false
  - id: D5
    description: "The classic CLOAKS table's Cloak of Armor line carries the same rule text as content/treasure-tables.js (one string, two copies, both greppable); PROJECT.md's Key Decisions table has the ARMOR-01 ruling row"
    requirement: "ARMOR-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-armor-display.test.js#Phase 28 (ARMOR-04): the classic (dead) CLOAKS table's Cloak of Armor txt mirrors the live string"
        status: pass
      - kind: other
        ref: "grep -c \"Armor soak-vs-wear: canon kept\" .planning/PROJECT.md == 1 (and the never-wearing/destroyed-armor-is-gone phrases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The full suite stays green (npm test: 0 failures) and npm run build:www exits 0"
    requirement: "ARMOR-01"
    verification:
      - kind: integration
        ref: "npm test — 1485/1485 passing, 0 failures"
        status: pass
      - kind: integration
        ref: "npm run build:www — exit 0"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-09-16
status: complete
---

# Phase 28 Plan 03: Shell Armor Wiring & Key Decision Summary

**Every armor string mazeworld.html renders — the HUD Armor line, the kit row, the gear worn row, every bag/find/drop/store row — now flows through the ONE `window.__mzArmorDisplay` bridge onto `armorDisplay(c)`/`bagArmorText(it)`, closing the reported "toast says wear, panel shows no damage" bug at its actual site (`#s-arm`) and recording the ARMOR-01 soak-vs-wear ruling as a Key Decision — full 1485/1485 suite green, parity master untouched, `npm run build:www` exits 0.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-16
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 3 (1 new test file, 2 modified)

## Accomplishments

- Bridged `armorDisplay`/`bagArmorText` (Plan 02's formatters) onto `window.__mzArmorDisplay` inside the module script, right next to the existing `window.__mzConditionsOf` precedent — read-only, no rng, safe every `paint()`.
- Fixed the ROOT CAUSE of the reported bug: `paint()` now computes `const armorD = window.__mzArmorDisplay.armorDisplay(c);` once and writes `#s-arm` from `armorD.line` — this HUD line had never shown durability before (RESEARCH.md's precise finding), so a player watching it during a soaked hit saw zero visible change no matter how much wear landed. It now reads e.g. `Plate · AR 15 · 6/45 hp` after a soaked 39-damage hit.
- Unified the `#s-kit` armor row and the gear panel worn row onto the same `armorD` object computed once per `paint()` — no inline `${c.armorWP}/${c.armorMax} hp` template literal survives anywhere in the live shell.
- Extended `wornRow()`'s signature with a `noSlotNeeded` parameter so a destroyed worn piece's Unequip control skips the bag-full block (it discards the piece rather than stowing it, per Plan 01's `unequipSlot` destroyed-branch). The armor call now reads `if (armorD.worn || armorD.magic) wornRow(armorD.label, ..., armorD.worn, armorD.destroyed)` — with a Cloak of Armor carried, the headline is the cloak (effective armor) and the piece underneath is listed, but Unequip still targets the armor slot underneath.
- Routed every remaining bag-armor display through `bagArmorText(it)`: `renderCarriedList`'s row (covering the GEAR tab, the store's "Your gear" sell list, and the combat use list — one shared renderer, three hosts), the pending-find card (a fresh piece reads truthful max/max hp), and the full-bag drop shelf.
- Relabelled the store's repair row `sub`-text entirely in the shell (`item.effectId === "repairArmor"` branch computing `${ad.wornSub} · ${S.c.armorMax - S.c.armorWP} hp to mend at a tenth of its cost each`), leaving `engine/economy.js`'s parity-compared stock `sub` string completely untouched (`git diff --stat engine/economy.js` = 0 lines).
- Updated the classic (dead-code) `CLOAKS` table's Cloak of Armor `txt` to mirror Plan 02's live `content/treasure-tables.js` string, so the frozen reference copy never contradicts the live one; `test/parity/prototype-master.js.txt` was never touched (hash unchanged).
- Wrote `test/unit/shell-armor-display.test.js` (7 tests) mirroring `shell-party-camp.test.js`'s source-assertion pattern — pins the bridge, the HUD/kit/worn-row wiring, the renderCarriedList/find-card/drop-shelf bag rows, the store repair row, and the CLOAKS mirror (including a check that the pre-Phase-28 flavor line, derived from the frozen parity master rather than hand-pasted, is gone from the live HTML).
- Appended the ARMOR-01 Key Decision row to `.planning/PROJECT.md`'s Key Decisions table, recording the soak-vs-wear ruling as kept-canon, the Cloak of Armor's any-carrier rule, and the destroyed-armor-is-gone rule.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bridge the formatter and wire the HUD line, kit row and gear worn row (paint())** - `93db263` (feat)
2. **Task 2: Bag rows, find card, drop shelf, store repair row — plus the shell source-assertion test** - `ade2919` (test)
3. **Task 3: Record the ARMOR-01 Key Decision in PROJECT.md and run the full-suite gate** - `fe4bda2` (docs)

_All three tasks are `type="auto"` (not tdd) per the plan._

## Files Created/Modified

- `test/unit/shell-armor-display.test.js` (new) - 7 source-assertion tests pinning the `window.__mzArmorDisplay` bridge, the `paint()` HUD/kit/worn-row wiring, the `renderCarriedList`/find-card/drop-shelf bag-row wiring, the store repair row, and the classic CLOAKS mirror
- `mazeworld.html` - extends the `viewModels.js` import with `armorDisplay, bagArmorText`; adds the `window.__mzArmorDisplay` bridge; `paint()` computes `armorD` once and wires `#s-arm`/`#s-kit`/the gear worn row through it; `wornRow()` gains a `noSlotNeeded` parameter; `renderCarriedList`, the pending-find card, and the full-bag drop shelf all read `bagArmorText`; the store shelf's repair row reads `armorDisplay(S.c).wornSub` plus an hp-to-mend count; the classic `CLOAKS` table's Cloak of Armor `txt` now mirrors the live string
- `.planning/PROJECT.md` - new Key Decisions row recording the ARMOR-01 ruling (soak-vs-wear canon kept; Cloak of Armor = never-wearing plate for any carrier; destroyed armor is gone)

## Decisions Made

- The store repair row's relabelling happens entirely in the shell's shelf renderer (a local `sub` computed via `armorDisplay(S.c).wornSub`), never touching `engine/economy.js`'s parity-compared stock `sub` string.
- The find-card and drop-shelf substitutions each compute a local `const` (`findSub`/`biSub`) rather than an inline ternary inside the template literal, so the literal wiring string is greppable/pinnable at both call sites — matching the plan's own literal-substring acceptance criteria exactly.

## Deviations from Plan

None — plan executed exactly as written. The one design choice (computing `findSub`/`biSub` as local consts rather than inline ternaries, per "Decisions Made" above) was made to satisfy the plan's own literal `grep -cF` acceptance criterion for the find-card site (`it.kind === "armor" ? window.__mzArmorDisplay.bagArmorText(it)` appearing twice, verbatim) — not a deviation from the plan's intent, since the plan's own action-text sketch for that site used an inline ternary that would not have satisfied its own acceptance criterion literally; the local-const form renders identically and is provably equivalent.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

Not a blocking task (autonomous run) — UAT notes for the next Pixel 7 session, copied verbatim from 28-03-PLAN.md's `<human_verification>` block:

1. Start a run with armor, get hit until a soak lands: the HUD Armor line must drop by exactly the toast's "wear N" (e.g. `Plate · AR 15 · 6/45 hp` after "Armour takes 39 · wear 39").
2. GEAR tab: Unequip the damaged piece, Equip it again — the durability must be unchanged (no free repair).
3. With a Cloak of Armor in the bag: HUD/worn row read `Cloak of Armor · AR 15 · magic plate, never wears · under the cloak: <piece> x/y hp`; soaked hits toast "The cloak's plate takes N · never wears".
4. The four toasts read distinctly on device: "Armour takes N · wear N", "Armour shrugs off N · under its min, no wear", "The cloak's plate takes N · never wears", "Your armour gives out."
5. Store: the Repair row's sub-label reads `AR n · x/y hp · k hp to mend at a tenth of its cost each`.

## Next Phase Readiness

- Phase 28 (Armor Integrity & Durability) is complete across all three plans (engine durability-on-item, presentation formatter + four-outcome copy, shell wiring + Key Decision). No blockers for the next phase.
- Full `npm test`: **1485/1485 passing, 0 failures**. Parity: `git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` empty; `git hash-object test/parity/prototype-master.js.txt` unchanged at `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`. `npm run build:www` exits 0.

## Self-Check: PASSED

- FOUND: test/unit/shell-armor-display.test.js
- FOUND: mazeworld.html (armor wiring edits present)
- FOUND: .planning/PROJECT.md (Key Decisions row present)
- FOUND commit: 93db263
- FOUND commit: ade2919
- FOUND commit: fe4bda2
- npm test: 1485/1485 passing, 0 failures
- Parity master hash unchanged: a1f4d0dc29782218d8e5aab65bc5989c33f917f0
- npm run build:www: exit 0

---
*Phase: 28-armor-integrity-durability*
*Completed: 2026-09-16*
