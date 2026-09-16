---
phase: 29-end-of-combat-loot-bag-cap
verified: 2026-09-16T05:30:00Z
status: passed
score: 6/6 requirements verified (LOOT-01..06) — automated evidence; on-device confirmation deferred to the end-of-run UAT batch per the user's "defer uat to end" instruction
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7: win a fight with a drop — one Victory card with the report + Take/Leave rows, no 'Move on' first, D-pad inert while it is up", "Pixel 7: Equip now on an upgrade weapon — toast + GEAR tab reflect the swap", "Pixel 7: full bag + gear drop — 'Bag full (4/4)' with the drop shelf; Take blocked until a drop frees a slot", "Pixel 7: background/kill/relaunch with a pile showing — same card, same order, on resume", "Pixel 7: depth 2+, several wins with the small bag — a 'Medium bag' row eventually appears; taking it upgrades capacity", "Pixel 7: store with a full bag — Drop buttons on the sell list + the rust 'Bag full … sell or drop' line; buying lockpicks into a full bag spends nothing", "Pixel 7: kill a foe that drops, then flee — Oracle shows the 'leave on the floor in your hurry' line and the loot never reaches the bag; dying with a pile shows the 'stay where they fell' line", "Pixel 7: Gear tab with an Acuteness potion + 4 gear in a small bag reads '4 / 4' (potion not counted)"]
gaps: []
---

# Phase 29 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-15)

Goal-backward check of the phase goal: *foe drops go into a pending pile instead of being auto-equipped or silently discarded; when combat clears the player gets a loot screen with take/leave per item; one bag-cap gate covers every pickup/buy/kit/loot path with clear feedback when full; bigger bags exist as depth-appropriate treasure; the pending pile survives save/resume and is honestly forfeited on flight or death.*

## Automated evidence (re-run by the orchestrator after 29-03)

- `npm test`: **1593/1593, 0 failures** (1485 at phase start → +43 bag-cap/lootCompare, +50 loot-pile/narration/save/roundtrip, +15 shell-loot-screen). All parity suites green with **zero fixture edits**; `git status --porcelain test/parity/` empty; `test/parity/prototype-master.js.txt` hash unchanged (`a1f4d0dc…`). `npm run build:www` exit 0 (29-03). Voice safety scan green with the new copy. Coverage guard green for `lootDropped/lootTaken/lootLeft/lootForfeited/bagUpgraded`.
- Three plans, three SUMMARY.md files, all `## Self-Check: PASSED`; working tree clean at HEAD `edd0e8e`.
- Parity-risk enumeration (29-RESEARCH.md): only `combat/lose` (seed 14) rolls a drop (a jewel); `reconcilePendingLoot` reconciles it — no declared action-path divergence needed. The LOOT-05 bag draw is guarded by `bagUpgradeTier` (depth ≥ 2 + upgrade available); every fixture fights at floor 1 — draw-count test pins depth 1 vs 2.

## Success criteria → evidence

| # | Success criterion (ROADMAP) | Evidence |
|---|-----------------------------|----------|
| 1 | Loot screen at combat end, take/leave per item + take-all/leave-all, nothing auto-equipped/auto-rejected/silently discarded | `killFoe` contains 0 `takeItem(` calls (grep + source-scan test); `offerLoot` pushes every drop (`lootDropped`); `takeLoot/leaveLoot/takeAllLoot/leaveAllLoot` in `engine/items.js` + `engine.js` dispatch (`test/unit/loot-pile.test.js`); shell loot card in `renderEncounter` folds the victory report (`test/unit/shell-loot-screen.test.js`). |
| 2 | Compare-to-equipped with equip-now vs stow | `lootCompare(c, it)` property-tested against `takeItem`'s own better-than rule for every WEAPONS base × bonus (`test/unit/lootCompare.test.js`); rows render Equip now (upgrade + legal only) / Stow / Leave via `renderCarriedList` loot actions. |
| 3 | One bag-full gate on every path; potions/scrolls never count | `slotItems(c)` excludes `kind:"potion"`; `stowItem` is the single gate used by `takeFind`, `takeLoot`, `takeAllLoot`, `unequipSlot`, store `giveLockpicks`/stowing effects; `buyFrom` checks before paying (refused stow spends nothing — pinned); four negative greps prove no raw capacity count survives in the shell; `clampCarry` preserves potions (`test/unit/bag-cap-gate.test.js`). |
| 4 | Depth-appropriate bigger bag as treasure | `BAG_ORDER/BAG_FLOORS(2/5/9)/BAG_DROP_UNDER/BAG_ITEMS` in `content/bags.js`; `bagUpgradeTier`/`bagItemFor`; the guarded `rng.d(20)` after the treasure roll; taking a bag item upgrades `c.bag` (`bagUpgraded` toast + Oracle). |
| 5 | Pile survives save/resume; flee/death forfeits with a narrated line | `pendingLoot` serialized via `validateSave`/`rehydrate` (`sanitizeLoot`; legacy save → `[]`), roundtrip pinned (`test/roundtrip/serialize-rehydrate.test.js`, `test/unit/save-validation.test.js`); `forfeitLoot` in `die()` and flee's three success exits emits `lootForfeited` (`test/unit/loot-narration.test.js`); the shell re-shows the card on resume with a non-empty pile. |

## Requirements

LOOT-01 ✓ · LOOT-02 ✓ · LOOT-03 ✓ · LOOT-04 ✓ · LOOT-05 ✓ · LOOT-06 ✓

## Deferred human verification

The eight Pixel 7 checks in the frontmatter `human_verification` list (from the three SUMMARY.md "Human verification (deferred to end of run)" sections) are batched into the end-of-run UAT list per the user's instruction for this autonomous run; they do not gate phase completion (precedent: Phases 26/27/28).
