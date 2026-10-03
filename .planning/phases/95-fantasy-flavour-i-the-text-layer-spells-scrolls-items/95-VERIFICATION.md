---
phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
status: passed
verified: 2026-10-03
verifier: orchestrator (deferred-UAT protocol)
requirements: [FLAVOR-01, FLAVOR-02, FLAVOR-05]
full_suite: "10,404 tests / 10,396 pass / 0 fail / 8 skipped (95-08 gate; phase start 10,291 / 10,283 / 0 / 8). Orchestrator re-run of flavor-layer, flavor-text and rules-surfaces: 74 / 74 pass. build:www exit 0; boot:check 'graves' leg fails identically at PHASE_BASE (pre-existing flake in STATE)."
human_verification:
  - "(95) Pixel 7 at text size L, Always show the rules OFF then ON: Grimoire, combat SPELLS and ITEMS rows, the find card, the Gear tab (WORN, BAG, CONSUMABLES), the Gear sheet, the store, the sell list, the loot card and the bag-full drop shelf each show flavour first, with RULES revealing the exact old text (95-08-SUMMARY items 1–9 and 11–18)."
  - "(95) Read all 114 new lines (111 flavour lines and 3 RULES words) on docs/narrative-pass/review.html and confirm or overrule them (item 10)."
  - "(95) Confirm or overrule the Claude's-discretion calls in 95-08-SUMMARY items 19–26: niche label before flavour; armour WORN row keeps its wear note; weapon voice line gives way to the type flavour; jewel and cloak candidates read flavour; the Sealed scroll's RULES; the loot advice line; a RULES body that repeats a usable-by tag; 2.4.0 Headline unchanged."
  - "(95) Drop shelf at large text: a long flavour line plus the usable-by tag may clip at the two-line clamp."
---
# Phase 95 Verification

1. **Spell and scroll text reads as flavour (FLAVOR-01): passed.**
   - `SPELL_FLAVOR` has 41 lines and `SCROLL_FLAVOR` has 1. They show first in the Grimoire, the combat SPELLS rows and the find card.
   - The exact `txt` sits behind RULES.
   - Covered by `rules-surfaces.test.js` cases a to e and the declared `mu.hero` snapshot.
2. **Equipment, magic-item and potion text reads as flavour (FLAVOR-02): passed.**
   - The lines are `POTION_FLAVOR` (10), `TOOL_FLAVOR` (4), `BAG_FLAVOR` (3), `MAGIC_ITEM_FLAVOR` (23), `WEAPON_FLAVOR` (24) and `ARMOR_FLAVOR` (5).
   - They show on the combat ITEMS rows, the Gear tab and Gear sheet, the store and Sealed scroll, the sell and loot lists, and the drop shelf.
   - Covered by `rules-surfaces.test.js` cases f to q and six declared snapshots: the `thief`/`mu` gear and gear-sheet snapshots and the two store snapshots.
3. **The technical layer is reachable and no guard was lost (FLAVOR-05): passed.**
   - Every surface has a tap-to-reveal RULES line, and the "Always show the rules" setting (default off) shows them all. Both come from `rulesLayer.js`.
   - The flavour lives in keyed maps that are never serialized (`flavor-not-serialized`), so saves are untouched.
   - The 18 v2.3 guard files and the five audit docs have an empty diff against PHASE_BASE cb5f77ec, with row counts 121/112/32/168/100 at both ends.
   - `flavor-drift` proves a drifted rules number still fails the real guards.
   - `flavor-layer` pins all 8 domains and 111 entries as complete, with no numbers, dice or percentages, one sentence each, and at most 100 characters.
4. **No rule or number moved: passed.**
   - `engine`, `test/parity` and `test/determinism` have an empty diff, and `content` has 0 removed lines.
   - Exactly seven fixtures moved, each declared.
   - All 114 new lines are ledgered and pass the safety, hygiene and roll-under scans with 0 hits.

The planning gap was closed mid-phase: plans 95-06 to 95-08 were written to match the hand-offs in 95-01 and 95-05. The hand checks above are batched into the v2.4 device checklist at milestone close. The 2.4.0 DRAFT has the two new Interface bullets, which the user still has to agree.
