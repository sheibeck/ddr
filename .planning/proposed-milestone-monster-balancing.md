# Proposed Milestone: "Monster Balancing & Abilities"

**Captured:** 2026-09-09 (from user via /gsd-next)
**Status:** PROPOSED — needs RESEARCH before planning; stand up via `/gsd-new-milestone` (with a research pass) after current in-flight work + the milestone-planning session.

## Vision

Rebalance the bestiary and give monsters **additional abilities** (e.g. **magic / spellcasting**, and other special abilities beyond the current strike/status kit). Retune how monsters scale so the fight difficulty is fair and interesting at depth. Explicitly figure out **how this affects the overall difficulty dial**.

## Why it matters / key facts
- **Foes do not cast offensive spells today.** Per the 04.1 audit, `castSpell` is player-only; foes have `intel` (read for *resisting* the player's spells) but never cast at the player. Adding foe magic is a real new mechanic.
- **Unlocks a deferred item:** giving foes offensive spells enables the **symmetric Intelligence spell-resistance** idea from Phase 04.1 RULE-01 (Option A) — which was deferred *precisely because* foes couldn't cast. If Monster Balancing lands foe-casting, revisit wiring the player's `c.intel` to resist incoming spells.
- **Directly moves the difficulty dial** — interacts with `engine/difficulty.js` + the Phase 3 tuned descent curve. New abilities change effective monster threat, so the curve likely needs re-tuning (the Phase 3 headless tuning harness is the tool for this).

## Candidate scope (to be broken down after research)
1. **Bestiary rebalance** — review every creature's HP/damage/to-hit/AR/special vs. its intended depth; fix outliers.
2. **Foe abilities** — a data-driven ability system for monsters: **spellcasting** (reuse/generalize `engine/magic.js` so foes can cast, deterministically), plus other specials (summons, drains, status inflicts beyond the current set). Pure/deterministic, event-narrated.
3. **Difficulty-dial integration** — fold ability-bearing monsters into `engine/difficulty.js`'s scaling so encounters stay on the tuned 5–10 min curve; re-run the tuning harness.
4. **Symmetric INT resistance** (carry-over from 04.1) — once foes cast, let the player's Intelligence resist.
5. **Parley balance pass** (encounter-resolution mechanic; user-requested 2026-09-09). Parley = "talk the fight down" as an alternative to combat. Current wiring (`engine/combat.js` `canParley()` :456 + `parley()` :477; UI button `mazeworld.html:4489` "5 · Parley"):
   - **When it's offered** (`canParley`, blocked entirely vs `Walking Dead` & `Magical`): Con Artist (any talkable type), Woodsman (Beasts/Lair Beasts), Bard (Humans), anyone with the **Language** skill (`TALKATIVE` = Humans/Demons/Lair Beasts/Beasts), **Wilmsry** race (any non-Magical), **Elven** race (Humans only).
   - **Success roll:** `d20 ≤ 9 + bonus`, bonus = `+6 Con Artist, +3 Woodsman, +4 Wilmsry, +3 Elven-vs-Humans, + c.level − topFoeLvl`. So base ~50% at even level, and a **Con Artist gets 9+6=15/20 (75%) before level** — very high.
   - **Reward on success:** `~2.5 × Σ(d6 × foeLvl)` skill points (**XP**) — i.e. MORE than killing (killFoe gives `d6 × lvl` per foe; parley pays ~2.5× the whole group at once) — **plus**, vs `Humans` type on a d6≥4, a `d6 × 100 × depth` **wilmst** bonus. Combat ends cleanly, no risk taken.
   - **Penalty on failure:** none but a lost turn (foes act via `afterPlayerAction`). No cost to attempt, retryable each turn.
   - **Balance concerns to resolve:** (a) parley paying MORE XP than fighting + zero risk makes it strictly dominant for classes/races that can use it — should success XP be *less* than or equal to the kill value, not 2.5×? (b) Con Artist's 75%-at-level-1 odds trivialize early floors; (c) no failure cost means spam-until-success; consider a per-encounter attempt cap, an aggro/ambush penalty on failure, or consuming the turn as it does now but disabling retry; (d) the `parleyRefused` Wilmsry-vs-Magical branch (`parley()` :489) is **dead code** — `canParley` already returns false for `Magical`, so it never fires (cleanup, not balance).
   - **Cross-ref Economy milestone** for the wilmst payout amount (the `d6 × 100 × depth` Humans bonus) — tune the *number* there, the *odds/availability/risk* here.
   - **Cross-ref DR15-A "Language as a system"** (`proposed-features-dr15.md`): the `Language` skill and the (currently inert) Helm of Knowledge `eff:{tongue:1}` both gate/expand `canParley` — so wiring Language + widening who can talk directly changes parley's availability. Tune Language's parley reach together with this parley balance pass so they aren't balanced twice.

## Research needed (why this is a research-first milestone)
- How to add foe spellcasting without breaking engine determinism / RNG order or the parity suite.
- How ability-bearing monsters change the effective difficulty curve, and how to re-tune the dial.
- Which abilities fit the tone + the rulebook's creature descriptions (prototype canon).

## Sequencing / interactions (the balance web)
This is the THIRD balance-touching proposed milestone alongside **Economy & Item Balancing** and **Joiners / Party System**. All three move game balance:
- Joiners add party power; Monster Balancing adds enemy power; Economy changes gear/resource power. Their balance passes must be coordinated (ideally the difficulty-dial retune happens once, after the power-changing milestones land, or is revisited per milestone).
- Decide global order at the milestone-planning session.
