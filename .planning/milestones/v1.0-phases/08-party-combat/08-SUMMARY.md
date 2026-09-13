---
phase: "8"
name: Party Combat
status: complete
completed: 2026-09-09
tests: 587/587 (parity 25/25, empty-party byte-identical)
requirements: [PARTY-03, PARTY-04, PARTY-05, PARTY-06]
---

# Phase 8: Party Combat — SUMMARY

**Complete + verified 2026-09-09.** `npm test` = **587/587** (574 + 13 new party-combat tests), parity **25/25** byte-identical for an empty party. No master edit, no comparable loosening.

## What landed (`engine/combat.js` +258/−52, `src/browser/eventNarration.js` +2 narration)
- **`startCombat`** syncs `state.party → state.combat.allies` (combat-scoped), gated `if (state.party?.length)` so the `allies` KEY is **absent** (not empty) for solo runs → `state.combat` byte-identical to the frozen master (the key discipline that avoided any comparable edit).
- **`alliesTurn`** (new) iterates `C.allies`, member strikes (`STRIKE_DICE`, reuse `allyStruck`/`allyMissed`), called after `allyTurn` in `afterPlayerAction`; gated `if (!C.allies?.length) return` — zero rng when empty. Summon `C.ally` path untouched.
- **`foeTurn` target pool** — each swing picks from `[hero]+live members`; hero target runs the existing branch UNCHANGED (ward/armor/`die()`); member target takes a simplified branch (no ward/armor), `memberStruck`, `downMember` on ≤0 — never `die()`. Target roll drawn ONLY when live members exist.
- **`downMember`** — sets member downed, splices from combat, flags `state.party[idx].status="downed"`, `memberDowned` event; hero run never ends.
- **`endCombat`** — syncs surviving member wp back to `state.party`, drops downed members.
- **`killFoe` XP split** — `raw` d6 draw unchanged; `heroShare = shares>1 ? round(gained/shares) : gained`; members no loot/XP; solo byte-identical.
- **Loop safety** — bounded `for` over a snapshot, re-checks `liveFoes()`, no `while`.

## Determinism: every new draw gated behind party presence (`state.party?.length`, `C.allies.length`, `liveMembers.length`, `shares>1`); fakeRng-underflow tests prove solo draw order is untouched. Requirements PARTY-03/04/05/06 ✅ (engine half; voice/flavor polished in Phase 9).
## Next: Phase 9 — Joiner Acquisition (accept/decline) + Voice.
