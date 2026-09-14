---
phase: 18-bestiary-rebalance-canon-combat-fixes
fixed_at: 2026-09-14T01:00:00Z
review_path: .planning/phases/18-bestiary-rebalance-canon-combat-fixes/18-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-09-14T01:00:00Z
**Source review:** .planning/phases/18-bestiary-rebalance-canon-combat-fixes/18-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (fix_scope: critical_warning — 0 critical, 2 warning; the 2 Info findings were out of scope and left untouched)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `content/bestiary.js`'s header comment miscounts the number of rows this phase actually changed

**Files modified:** `content/bestiary.js`
**Commit:** `93961ea`
**Applied fix:** Before editing, verified `content/BESTIARY-REBALANCE.md`'s "Change ledger" table (lines 414-424) actually lists nine rows (Drake, Werebeast, Djinni T4, Djinni T5, Krupke, Drudge T4, Drudge T5, Vampire, Stalka Beast) and contains no reference to "ten" anywhere in the document, confirming the review's finding and that no edit was needed there. Corrected the header comment in `content/bestiary.js` (lines 11-16) from "deliberately moved ten entries away from the prototype's numbers" to explicitly state nine numeric changes (naming all nine creatures) plus the tenth pre-existing flag (Sterling's `sp.halfDmg`) that was wired into the engine without changing its own numbers. This is a comment-only change — no code, numbers, or tests touched.

### WR-02: `engine/foeDamage.js`'s own header comment is stale and misdescribes the shipped state

**Files modified:** `engine/foeDamage.js`
**Commit:** `d9eb38b`
**Applied fix:** Updated the module header comment (lines 11-15) to remove the stale parenthetical claiming "no call site is routed through this seam yet in this plan" and replaced it with an accurate statement that `engine/combat.js`, `engine/magic.js`, and `engine/items.js` all route through the seam (wired by 18-03/18-04), and that `test/unit/foe-damage.test.js`'s invariant tests enforce this. Comment-only change — no code, numbers, or tests touched.

## Skipped Issues

None — both in-scope findings (WR-01, WR-02) were fixed successfully.

**Note:** IN-01 and IN-02 were out of scope for this fix pass (`fix_scope: critical_warning`) and were left unaddressed per the review's own framing as low-priority follow-ups for a future narration pass.

## Verification

- Tier 1 (re-read): both modified files re-read after edit; fix text present, surrounding code/comments intact.
- Tier 2 (syntax check): `node --check content/bestiary.js` and `node --check engine/foeDamage.js` both passed.
- Full suite: `npm test` run after both fixes — 796/796 passing (matches the pre-fix baseline reported in REVIEW.md; comment-only changes introduce no regression).
- Both fixes stayed entirely outside the `<!-- yardstick:after:begin/end -->` markers in `content/BESTIARY-REBALANCE.md` — that file was inspected but not modified, since its ledger already correctly states nine rows.

---

_Fixed: 2026-09-14T01:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
