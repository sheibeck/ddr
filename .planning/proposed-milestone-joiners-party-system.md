# Proposed Milestone: "Joiners / Party System"

**Captured:** 2026-09-09 (from user via mid-turn message)
**Priority:** The user wants this as the **NEXT focus milestone** ("Once we've planned any new milestones, revisit Joiners... focus on this as our next milestone").
**Status:** PROPOSED — plan/stand up via `/gsd-new-milestone` after the current in-flight work (04.1 UAT + rules-text-audit batch) and after the milestone-planning pass.

## Vision

**Joiners** = NPCs that can join the player in the (still single-player) game. This milestone **introduces the party system** — the foundation the whole engine was designed for (pure, serializable `applyAction` state was explicitly built "multiplayer-ready" per CLAUDE.md). Joiners is the single-player on-ramp to that; true multiplayer ("play with your friends") remains a later/v2 add-on.

## Why it matters
- First real multi-character gameplay — party composition, joiner AI/behavior in combat, and shared/party resources.
- **Affects game balance** (user flagged this explicitly): more bodies in a fight changes combat difficulty, the difficulty curve (Phase 3), loot/economy pressure, and rations/upkeep (a party eats more). Must be balanced against the endless-descent curve.

## Existing footing in the codebase (from the 04.1 audit + prior work)
- Partial ally support already exists: `engine/combat.js:601` pushes an `allyStruck` event and references `C.ally` — so the engine already has a single-ally hook to build the party system out from. (Confirm scope of what's wired vs. stub when planning.)
- The prototype/rulebook had "Joiners" content — source material for joiner types/behavior (prototype is canon).

## Candidate scope (to be broken down by /gsd-new-milestone)
1. **Joiner acquisition** — how NPCs join (encounter offer? recruit? the rulebook's Joiner rules).
2. **Party model** — multiple characters in `state` (generalize the single `C.ally` into a party array), each with their own sheet/gear/HP, serialized + save-migration.
3. **Party combat** — joiners act in combat (turn order, targeting, their own strikes/spells — extend the existing `allyStruck` path).
4. **Party UI** — the mock's "party rail" (currently hidden/OFF for v1 per the 04-UI-SPEC combat screen) gets turned on; party sheet(s), joiner status.
5. **Balance pass** — re-tune the difficulty curve + economy/upkeep for party size (interacts with the **Economy & Item Balancing** milestone — sequence/coordinate the two balance passes).
6. **Death/permadeath semantics** for joiners (do they permadie? leave? affect the run?).

## Sequencing / interactions
- **Interacts with the Economy & Item Balancing milestone** — both change game balance; decide order so the balance work isn't done twice. (Party size affects economy pressure; bag/economy affects party viability.)
- Multiplayer ("play with friends") stays a later milestone; Joiners is the single-player party foundation.
- Slots relative to v1.0's remaining phases (tutorial, Voice, Play launch) — TBD at milestone-creation time (likely a post-v1.0 milestone, but the user wants it prioritized as "next").
