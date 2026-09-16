---
phase: 28-armor-integrity-durability
verified: 2026-09-16T02:30:00Z
status: passed
score: 5/5 requirements verified (ARMOR-01..05) — automated evidence; on-device confirmation deferred to the end-of-run UAT batch per the user's "defer uat to end" instruction
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7: HUD Armor line drops by exactly the toast's wear N after a soaked hit", "Pixel 7: GEAR Unequip → Equip of a damaged piece keeps its durability (no free repair)", "Pixel 7: with a Cloak of Armor carried, HUD/worn row read 'Cloak of Armor · AR 15 · magic plate, never wears · under the cloak: <piece> x/y hp' and soaked hits toast 'The cloak's plate takes N · never wears'", "Pixel 7: the four armor toasts read distinctly (takes N · wear N / shrugs off N · under its min, no wear / cloak's plate takes N · never wears / Your armour gives out.)", "Pixel 7: Store Repair row sub-label reads 'AR n · x/y hp · k hp to mend at a tenth of its cost each'"]
gaps: []
---

# Phase 28 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-15)

Goal-backward check of the phase goal: *armor behaves exactly as the screen says — the soak-vs-wear rule is audited and decided, the "toast says wear / panel shows no damage" discrepancy is root-caused and fixed, durability lives on the item instead of the character (killing the re-equip full-repair exploit), Cloak of Armor is legible and real, and every armor outcome is distinguishable on screen.*

## Automated evidence (re-run by the orchestrator after 28-03)

- `npm test`: **1485/1485, 0 failures** (1448 at phase start → +15 `test/unit/armor-durability.test.js`, +2 feedback-payload pins, +15 `test/unit/armorDisplay.test.js`, +7 `test/unit/shell-armor-display.test.js`, minus/plus pin restructures). Parity suites green; `git status --porcelain test/parity/` empty; `test/parity/prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); no fixture JSON edited. `npm run build:www` exit 0 (28-03). Voice safety scan green with the new copy.
- Three plans, three SUMMARY.md files, all `## Self-Check: PASSED`; working tree clean at HEAD `a1f8a45`.

## Success criteria → evidence

| # | Success criterion (ROADMAP) | Evidence |
|---|-----------------------------|----------|
| 1 | Toast "wear" and displayed durability always agree | `test/unit/armorDisplay.test.js` reproduction pin: Plate 45/45, soaked blow of 39 → `armorSoaked.wear === 39 === armorDisplay(c).current` delta; line `Plate · AR 15 · 6/45 hp`. Root cause was the `#s-arm` HUD line (`mazeworld.html` paint()) that never referenced durability — now fed by `armorDisplay(c).line` (28-03, pinned by `shell-armor-display.test.js`). |
| 2 | Unequip → swap → re-equip preserves durability | `wornArmorItem` carries `left`/`patches`; `equipItem` restores `it.left ?? it.wp` / `it.patches ?? 0` (`engine/items.js`, 28-01); exploit, idempotency, index-stable swap, legacy-save read, destroyed-unequip/swap/full-bag cases in `armor-durability.test.js` (15 tests). `stripBagArmorFields` carved out of all three comparables. |
| 3 | Cloak of Armor legible and shown as effective armor | `content/treasure-tables.js` txt: "soaks as plate (AR 15) over whatever you wear — any class, never wears out, light as a rumor"; `armorDisplay(c)` derives the cloak headline from `armorSoak(c)` (magic → `Cloak of Armor · AR 15 · magic plate, never wears` + `under the cloak: …`); wired into HUD, sheet kit row and gear worn row (28-03). Cosmetic `txt` divergence declared via `stripCloakArmorTxt` (seed 17 starts with the cloak). |
| 4 | Four armor outcomes distinguishable | Additive `underMin`/`magic` flags on `armorSoaked` (28-01, soak math byte-identical); toasts.js + eventNarration.js three-way branch + existing `armorDestroyed` (28-02); pinned in `armorDisplay.test.js` and `feedback-payload.test.js`. |
| 5 | Ruling recorded as Key Decision; any change a declared divergence | PROJECT.md Key Decisions row (28-03, `fe4bda2`): canon kept — rulebook p.44 = prototype = engine; no rule change, so no fixture regenerated and no new rules divergence. |

## Requirements

ARMOR-01 ✓ (Key Decision + audit, no code change needed) · ARMOR-02 ✓ (repro test + `#s-arm` fix) · ARMOR-03 ✓ (durability on the item, comparables carve-out, tolerant read) · ARMOR-04 ✓ (cloak text + effective-armor readout) · ARMOR-05 ✓ (four outcomes via payload flags).

## Deferred human verification

The five Pixel 7 checks in the frontmatter `human_verification` list (verbatim from `28-03-SUMMARY.md` "Human verification (deferred to end of run)") are batched into the end-of-run UAT list per the user's instruction for this autonomous run; they do not gate phase completion (precedent: Phases 26/27, Key Decision "Human UAT deferred to milestone end; user's device play IS the UAT").
