# Feature Research

**Domain:** Single-player "Joiner"/party system for a turn-based descent roguelike (Mazeworld / "Delve, Die, Repeat")
**Researched:** 2026-09-09
**Confidence:** HIGH (rulebook canon read directly; existing code inspected line-by-line; genre patterns from established turn-based roguelikes)

> Scope: the SOLO party foundation only. NPCs ("Joiners") that join the single player. True networked multiplayer stays a later milestone. Every balance-affecting choice is flagged inline with **[BALANCE]** because this is one of three balance-touching milestones (sequence/coordinate with the **Economy & Item Balancing** milestone).

---

## What the rulebook actually says (CANON)

Rulebook consulted directly (`mazeworld.pdf`, extracted via `pdftotext`, 6,922 lines). There is a dedicated **JOINERS** section (TOC p.46). Verbatim canon:

> **Joiners** — "A Joiner is a fellow adventurer that your characters meet in the dungeon. Roll on the Level Table to determine the Joiners Level. **If the party accepts the Joiner, roll up a new character.** If the Joiner is a Magic User roll for spells one time for each level. Then randomly choose spells using the Level Table for spell level, and rolling on the Spell Listing to determine the exact spell. **The Maze Master can give the Joiner any weapons and armour (magical or otherwise) that he deems fit.**" (line 5615)

**Level Table** (line ~5645): d10 → 1-2 = level I, 3-4 = II, 5-6 = III, 7-8 = IV, 9-10 = V. (This is the `SPELL_LEVEL_TABLE` already ported in `engine/encounters.js`.)

Other party-relevant canon found across the book:

| Topic | Canon | Line | Implication |
|-------|-------|------|-------------|
| **Recruitment** | "If the party **accepts** the Joiner, roll up a new character." | 5615 | Explicit **accept/decline**. A joiner is a **full rolled character** (own class/race/level/gear/HP), not a stat stub. |
| **Joiner gear** | "The Maze Master can give the Joiner any weapons and armour… he deems fit." | 5615 | No MM in solo → **engine rolls/assigns** the joiner's gear (rollCharacter already does). |
| **Cost of living (upkeep)** | "it takes 4wp per day just to live… subtracted at the start of the day… replenished by food, drink or sleep." Dwarf = 1WP/day, Troll = 15WP/day. | 582, 1309, 719, 732 | **[BALANCE]** Upkeep is **per character** → a party literally eats more. Direct coupling to the Economy milestone. |
| **XP split** | Won combat SP = "d6 × creature level + bonuses… **divided evenly between all of the party members who participated** in the encounter." | 1368 | **[BALANCE]** XP is **split among participants**, slowing the leader's leveling — a natural counterweight to extra party power. |
| **Initiative** | "Roll a d20 for **the party** and a d20 for the **enemy group**." | 1342 | Initiative is **party-level**, one roll for the whole side — matches the existing single-initiative combat model. |
| **Shared-target resolution** | For a dot/gift/trap: "count the total number of party members and assign them a number on a dice. Roll… whoever's number shows up gets the result be it good or bad." | 1311 | Canon precedent for **randomly targeting one party member** (used later for foe targeting design). |
| **Wandering-monster scaling** | "the level of these monsters will never exceed the highest party members level." | 1319 | **[BALANCE]** Difficulty scales off the **highest** party level → a high-level joiner raises the threat floor. |
| **Cutthroat sacrifice gag** | A Cutthroat "will automatically kill one of the party members… during each dungeon… **if there is a joiner at the time of the killing then the joiner must be the victim.** Tough cookies!" | 1177 | Canon treats joiners as **expendable**, and it is played for **dark comedy** — a ready-made voice hook. |
| **Party size** | No explicit numeric cap anywhere. Examples use "a party of four"; size only matters via the Size rule (line 705, members that don't fit a 10'×10' square split into two parties). | 705, 1311 | **[BALANCE]** **Party-size cap is a design decision, not canon.** (Recommend cap = 1 joiner for v1; see below.) |

**Prototype supersedes rulebook where they conflict** (per PROJECT.md): the prototype deliberately did the **solo conversion — "no party/Maze Master"** — and dropped bags/carry-weight. So this milestone *re-introduces* a party as a **solo, engine-driven** system; it does not restore the tabletop's multi-player-around-a-table party or the MM.

---

## What already exists in the code (FOOTING)

Two separate, half-built ally concepts exist. They are **not** the same thing:

**1. `meetJoiner` — a rolled joiner that is currently a DEAD STUB.** (`engine/encounters.js:397-407`)
- Fires on the `"Joiner"` encounter cell (`content/encounters.js` tables 2 & 6).
- Rolls a **full character** via `rollCharacter(rng)` (which produces class/race/subclass, weapon, armor, grimoire, `rations`, `gold`, `wp`/`maxWP`, phobia, temperament, etc. — `engine/character.js:140+`).
- **Keeps only** `c.joiner = {name, race, sub, cls, lvl, wp, maxWP}` and pushes a `joinerMet` event narrated "*X, a [sub], joins you for a while.*" (`src/browser/eventNarration.js:290`).
- **Nothing consumes `c.joiner`.** No accept/decline, no combat participation, no lifecycle. It is set and forgotten. **This is the seam to light up.**

**2. `C.ally` — a per-round combat striker, ONLY from the Summon spell.** (`engine/combat.js:646-665`, `engine/magic.js:99-123`)
- Shape: `{lvl, rounds, name}` — **no HP, no sheet, cannot be targeted or die.**
- `allyTurn()` each round: targets `liveFoes(state)[0]` (first foe only); hits if `rng.d(STRIKE_DICE[lvl-1]) <= 5`; damage = `lvl*lvl + d6`; decrements `rounds`; departs at 0 (`allyDeparted`).
- Enters combat via `c.pendingAlly` → `startCombat` promotes it to `state.combat.ally` and emits `allyJoined` (`combat.js:163-167`).
- This single-slot, auto-acting, temporary striker is the **starting point** the milestone brief calls out — the party system generalizes it from one invulnerable summon into an array of real, damageable joiners.

**3. Party UI already mocked but OFF.** The combat "party rail" exists in the design/UI-SPEC but is hidden for v1 — this milestone turns it on.

**Key gap:** there is **no party array, no accept/decline, no foe→ally targeting, no joiner HP/death, no upkeep for extra members, and no XP split.** `state.c` is a single character; `c.joiner` is inert data.

---

## Feature Landscape

### Table Stakes (a v1 party system feels broken without these)

| Feature | Why Expected | Complexity | Notes / Dependencies |
|---------|--------------|------------|----------------------|
| **Accept/Decline a joiner** | Canon: "*If the party accepts…*". Players expect agency over who joins; auto-adding a body is jarring. | LOW–MED | Gate `meetJoiner` behind a choice. Depends on `encounters.js` + a combat/encounter prompt in `src/browser`. Currently auto-set — must add the branch. |
| **Party model: generalize `C.ally`/`c.joiner` into a party array** | Foundation for everything else; the engine was built serializable for exactly this. | MED–HIGH | New `state.party[]` (or leader `state.c` + `state.party[]` of joiners). Touches `combat.js`, `saveState.js` (migration for saves with no party), the `applyAction` clone. Hard dependency for all combat/UI features. |
| **Joiner keeps its own sheet (class/race/level/gear/HP)** | Canon: a joiner is a full "roll up a new character," MM-gifted gear. Players expect a real teammate, not a number. | LOW (data exists) / MED (wiring) | `rollCharacter` already produces the full sheet; `meetJoiner` currently **discards** most of it. Stop discarding; persist weapon/armor/grimoire/level/`rations`. |
| **Joiner acts in combat automatically each round** | The whole point of a party. AI-acted (not micromanaged) fits the game's "no player choices" identity and the 5–10 min session. | MED | Extend `allyTurn` from one slot to N members, each using **its own** strike dice / spells (Magic-User joiners cast). Depends on party array. |
| **Joiner has its own HP and can be hurt/downed** | Current `C.ally` is invulnerable — a party of invincible bodies is a non-game. Damage-able allies are the core tension. | MED | **[BALANCE]** Give each joiner real `wp`/`maxWP` (already rolled). Foes must be able to reduce it. |
| **Foe targeting across the party** | Players expect enemies to sometimes hit the joiner, not always the leader. Canon precedent: randomize target among members (line 1311). | MED | **[BALANCE]** Pick foe targets across live party members (random or weighted). Touches `foeTurn` in `combat.js`. Big difficulty lever (a joiner as a damage sponge protects the leader). |
| **Party status UI (turn on the party rail)** | Players must see each member's name/HP/status or the party is invisible. The rail is already mocked. | MED | UI-only; depends on the party model + new events (`allyStruck`, joiner-damaged, joiner-down). |
| **Joiner lifecycle & death semantics** | Players must know: do they permadie, flee, or leave? Ambiguity feels buggy. | MED | **[BALANCE + TONE]** Decide: HP≤0 = permadeath (canon-flavored, matches Cutthroat "expendable" gag) vs. flee/leave. Recommend **permadeath on downed** + **voluntary departure after N rounds/floors** (see differentiators). |
| **Save/serialize + migration for the party** | The serializable-state constraint is a project pillar; existing saves have no party field. | MED | Add party array to save shape; migrate old saves (empty party). Depends on `saveState.js` parity/field lists (`joiner` is already a tracked field). |
| **XP split among participants** | Canon (line 1368). Without it, party = free power with no cost — breaks progression. | LOW–MED | **[BALANCE]** Divide combat SP among participants. Decide whether a **temporary** joiner counts as a participant (recommend yes, while present). Slows leader leveling — an intentional counterweight. |
| **Per-member upkeep / rations** | Canon: 4WP/day **per character**; "a party eats more." A costless party unbalances the descent. | MED | **[BALANCE — couples to Economy milestone]** Each joiner consumes upkeep (own `rations`, already rolled). Touches `economy.js`. **Sequence with the Economy balance pass so it isn't tuned twice.** |

### Differentiators (lean into this game's identity)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sarcastic joiner personality & barks** | Voice is a **core identity** (PROJECT.md). Joiners that quip on join / kill / getting downed / leaving are cheap, high-impact, and uniquely on-brand. | LOW–MED (content) | Reuse `temperament`/`motive` fields already rolled per character; write barks in `content/flavor.js` + `eventNarration.js`. Family-friendly dark comedy. |
| **Impermanence by design — "joins you for a while"** | The current narration and the Summon `rounds` timer already imply temporary allies. Bounded joiner tenure (leaves after N rounds/floors) keeps sessions short and stops the party from snowballing the difficulty curve. | LOW–MED | **[BALANCE]** Reuse the `rounds`/departure pattern from `allyTurn`. Turns "party" into a **transient boon**, not a permanent roster — fits 5–10 min runs and permadeath. |
| **Class-flavored joiner behavior** | A Magic-User joiner casts (canon rolls its spells); a Con Artist can defuse a fight; the Cutthroat-sacrifices-the-joiner gag. Depth for free by reusing existing subclass rules. | MED | Canon hooks already exist in the ruleset (Con Artist line 1193, Cutthroat line 1177). The Cutthroat "joiner must be the victim" gag is a signature dark-comedy beat. |
| **Joiner as risk/reward economy pressure** | Feed them (rations) and they fight for you; starve them and they leave (or worse). Ties the party directly into the loot/economy loop. | MED | **[BALANCE — Economy coupling]** Makes the party a meaningful resource decision, not pure upside. |
| **Cheap to ship — the stub is already there** | `meetJoiner` already rolls the character and `allyTurn` already runs an ally each round. Most roguelikes have *no* companions; this game can add one at low marginal cost. | — | Leverage, not a feature: reduces implementation risk vs. the genre. |

### Anti-Features (seductive, but wrong for a 5–10 min mobile roguelike)

| Feature | Why Requested | Why Problematic | Better Approach |
|---------|---------------|-----------------|-----------------|
| **Full manual control of each joiner's turn** | "More tactics / more control." | Multiplies taps per round on a phone, blows past the 5–10 min session, and **contradicts the 100%-dice / no-player-choice identity**. | **Auto-acting AI joiners** (extend `allyTurn`). Player agency is at *recruitment*, not per-turn. |
| **Large parties (4–6 members)** | "Real RPG party." | Each member = another combat turn → slow, and N extra bodies is a **balance explosion** against the endless-descent curve. | **Cap at 1 joiner for v1** (design the array for N). Revisit 2 after balancing. **[BALANCE]** |
| **Party-splitting by creature size** (canon p.705) | It's in the rulebook. | Two independently-moving sub-parties is huge state/UI complexity with zero payoff on a phone. | **Skip.** Single square, single party. Explicitly a dropped tabletop rule (like bags). |
| **Per-member inventory / gear-swapping UI** | "Manage my party's loadout." | Deep management screens; drains the session; not the core loop. | Joiners **keep their rolled gear**; no management. |
| **Permanent party that persists the whole run** | "I bonded with my joiner." | Snowballs power, flattens the difficulty curve, and undercuts permadeath tension. | **Transient joiners** (leave after N rounds/floors, or permadie). Impermanence is a feature. **[BALANCE]** |
| **Formation / front-back positioning** | Tactical depth. | The maze combat has **no positioning model** to build on; large new system. | Flat target pool + random/weighted foe targeting (canon line 1311 precedent). |
| **Player spends own HP/potions to revive/heal joiners as a core loop** | "Keep my buddy alive." | Constant drain + micromanagement; makes joiners a liability treadmill. | Joiners heal via **their own** sleep/upkeep, or not at all in v1. Downed = gone. |
| **Individual per-member loot/wilmst bags** (canon had bags) | Rulebook realism. | Prototype already dropped bags; per-member banking is bookkeeping the solo player won't enjoy. | **Shared wilmst pool** on the leader; joiners carry no persistent loot. **[BALANCE]** |
| **Networked multiplayer / "play with friends" now** | It's the long-term dream. | Out of scope; explicitly a later milestone. Joiners is the **solo on-ramp** to it. | Keep the party model serializable so multiplayer can reuse it later — but don't build sync. |

---

## Feature Dependencies

```
Party model (state.party[] + save migration)   <-- FOUNDATION
    |
    ├── requires ──> generalize C.ally / c.joiner (stop discarding the rolled sheet)
    |
    ├──> Accept/Decline recruitment (meetJoiner gate)
    |
    ├──> Joiner acts in combat (extend allyTurn to N, own strike/spells)
    |        └── requires ──> Joiner HP + foe targeting across party
    |                              └──> Joiner death/lifecycle semantics
    |
    ├──> Party status UI (party rail) ──enhances──> combat readability
    |
    ├──> XP split (participants)            [BALANCE]
    |
    └──> Per-member upkeep / rations        [BALANCE, couples to Economy milestone]

Sarcastic barks ──enhances──> Accept/Decline, death, departure
Impermanence (leave after N) ──conflicts──> Permanent party (pick one: transient)
Large party (4-6) ──conflicts──> 5-10 min session + difficulty curve
```

### Dependency notes
- **Everything depends on the party model.** Land `state.party[]` + save migration first; it is the single highest-risk, highest-leverage piece (touches the `applyAction` clone, `saveState.js`, and every combat function).
- **Joiner combat requires HP + foe targeting requires lifecycle.** These three ship together or not at all — an ally that acts but can't be hurt (today's `C.ally`) is not a party.
- **XP split and upkeep are the two balance counterweights** to the extra combat power; ship them *with* the combat feature, not after, or the first playtest is unbalanced.
- **Impermanence vs. permanence is a fork** — decide early; it changes save, UI, and balance assumptions.

---

## MVP Definition

### Launch With (v1 of the party system)
- [ ] **Party model** `state.party[]` + save migration — foundation, everything depends on it.
- [ ] **Accept/Decline** on the `Joiner` encounter — canon-required agency; stop auto-setting `c.joiner`.
- [ ] **Cap = 1 joiner** (array built for N) — keeps turns fast + balance tractable. **[BALANCE]**
- [ ] **Joiner keeps full rolled sheet** (class/level/gear/HP) — stop discarding rollCharacter output.
- [ ] **Joiner auto-acts in combat** using its own strike dice / spells — generalize `allyTurn`.
- [ ] **Joiner HP + foe targeting across party + death/departure semantics** — makes it a real party. **[BALANCE]**
- [ ] **Party rail UI on** — visibility of member HP/status.
- [ ] **XP split among participants** — canon, progression counterweight. **[BALANCE]**
- [ ] **Per-member upkeep (rations)** — canon, economy pressure. **[BALANCE, coordinate with Economy milestone]**
- [ ] **Sarcastic join/kill/down/leave barks** — cheap, core-identity payoff.

### Add After Validation (v1.x)
- [ ] **Second joiner slot (cap = 2)** — only after the single-joiner balance pass holds. **[BALANCE]**
- [ ] **Class-specialized joiner behaviors** (Con Artist defuse, Cutthroat sacrifice gag, MU spell selection).
- [ ] **Voluntary departure conditions** (starved/unpaid joiner leaves) tied to the Economy loop.

### Future Consideration (v2+)
- [ ] **Networked multiplayer** reusing the serializable party model — separate later milestone.
- [ ] **Larger parties / formations** — only if sessions and balance ever justify it (likely never on mobile).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|-----------|---------------------|----------|
| Party model + save migration | HIGH | HIGH | P1 |
| Accept/Decline recruitment | HIGH | LOW | P1 |
| Joiner keeps own sheet | MED | LOW | P1 |
| Joiner auto-acts in combat | HIGH | MED | P1 |
| Joiner HP + foe targeting + death | HIGH | MED | P1 |
| Party rail UI | HIGH | MED | P1 |
| XP split **[BALANCE]** | MED | LOW | P1 |
| Per-member upkeep **[BALANCE]** | MED | MED | P1 |
| Sarcastic joiner barks | HIGH | LOW | P1/P2 |
| Impermanence (leave after N) **[BALANCE]** | MED | LOW | P2 |
| Class-flavored behavior | MED | MED | P2 |
| Second joiner slot **[BALANCE]** | MED | MED | P3 |
| Manual per-member control | LOW | HIGH | P3 (anti) |

---

## Balance interactions (explicit call-outs for the roadmapper)

This milestone is one of three balance-touching efforts. Flag every one of these to the requirements author and **coordinate the tuning pass with the Economy & Item Balancing milestone** so balance isn't done twice:

1. **Party-size cap** — NOT specified by canon. Recommend **1** for v1. Each extra body multiplies combat turns (session length) and combat power (difficulty curve).
2. **Extra combat contribution** — a joiner adds DPS *and* soaks foe attacks (damage sponge protecting the leader). Foes clear faster and the leader takes less → the endless-descent difficulty curve (Phase 3 / `difficulty.js`) will need retuning. Note canon: wandering-monster level scales off the **highest** party member (line 1319).
3. **XP split** (canon line 1368) — the natural brake on the extra power. Decide participant rules for **temporary** joiners.
4. **Upkeep per member** (canon 4WP/day each; Dwarf 1, Troll 15) — the party's cost. Directly couples to rations/economy. **Sequence this with the Economy milestone.**
5. **Loot model** — recommend **shared wilmst on the leader**, joiners carry no persistent loot (avoids per-member banking; prototype already dropped bags).
6. **Joiner death vs. departure** — permadeath-on-downed keeps stakes high and matches the "expendable joiner" tone; voluntary departure caps snowball. Decide the mix.

---

## Genre reference (turn-based roguelike party/follower patterns)

| Pattern | Example | Fit for this game |
|---------|---------|-------------------|
| **Auto-acting temporary follower** | NetHack pet, DCSS summons/allies | **Best fit.** Matches existing `allyTurn` + Summon `rounds`; no micromanagement; keeps sessions short. |
| **Small permanent party, permadeath, upkeep/provisions** | Darkest Dungeon (party of 4, provisions, stress) | Good tonal/upkeep reference, but 4 members is too many turns for a 5–10 min phone session → **shrink to 1**. |
| **Solo, no party** | Slay the Spire, Hoplite, Dredmor | The prototype's current state; this milestone is the deliberate step beyond it. |
| **Manual full-party control** | Classic party CRPGs | **Anti-pattern here** — contradicts the no-choice identity and the session length. |

Takeaway: the genre's mobile/short-session winners use **few, auto-acted, often temporary** allies. That is exactly what the existing `allyTurn`/`rounds`/`c.joiner` seams already point at — the milestone is generalizing a proven pattern, not inventing one.

---

## Sources

- **`mazeworld.pdf`** (rulebook, CANON) — JOINERS section (line 5615) + Level Table (~5645); Cost of Living (582, 1309); XP split (1368); Initiative (1342); party-member target resolution (1311); wandering-monster scaling (1319); Cutthroat joiner-sacrifice (1177); Con Artist (1193); Size/party-split (705). CONFIDENCE: HIGH (primary source, direct extraction).
- **`engine/encounters.js:397-407`** — `meetJoiner` dead-stub; rolls full character, keeps only 7 fields, nothing consumes `c.joiner`. CONFIDENCE: HIGH.
- **`engine/combat.js:646-665, 163-167, 594-640`** — `allyTurn`, `pendingAlly`→`state.combat.ally` join, `afterPlayerAction`/`foeTurn` sequence. CONFIDENCE: HIGH.
- **`engine/magic.js:99-123`** — Summon spell as the only `C.ally` source (`{lvl, rounds, name}`, no HP). CONFIDENCE: HIGH.
- **`engine/character.js:140-200`** — `rollCharacter` full sheet incl. per-character `rations`/`gold`/gear/`grimoire`. CONFIDENCE: HIGH.
- **`content/encounters.js:26,30`** — `"Joiner"` encounter cells (tables 2 & 6). CONFIDENCE: HIGH.
- **`src/browser/eventNarration.js:127,290`** — existing `allyJoined`/`joinerMet` voice. CONFIDENCE: HIGH.
- **`.planning/PROJECT.md`** — solo-conversion canon, voice identity, 5–10 min sessions, serializable-state constraint. **`.planning/proposed-milestone-joiners-party-system.md`** — milestone intent, balance-coupling flag. CONFIDENCE: HIGH.
- Genre patterns (NetHack pets, DCSS summons, Darkest Dungeon party/provisions) — established turn-based roguelike design. CONFIDENCE: HIGH (well-known domain knowledge).

---
*Feature research for: single-player Joiner/party system, Mazeworld ("Delve, Die, Repeat")*
*Researched: 2026-09-09*
