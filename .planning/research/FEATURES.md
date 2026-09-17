# Feature Research — v1.5 "Meaningful Choices — Spells, Gear & Abilities"

**Domain:** Turn-based, dice-driven, offline mobile roguelike dungeon-crawler (solo + 1-Joiner party, 5–10 min sessions, one-thumb phone UI, permadeath, family-friendly dark comedy)
**Researched:** 2026-09-17
**Confidence:** HIGH for all existing-codebase claims (direct reads of `content/spells.js`, `content/skills.js`, `content/treasure-tables.js`, `content/weapons.js`, `content/armors.js`, `content/potions.js`, `content/flavor.js`, `docs/USABLE-FEATURES-AUDIT.md`, `.planning/PROJECT.md`). MEDIUM for comparable-roguelike design patterns (web research — design consensus and community/dev commentary, not code reads of those engines).

This file answers one question: **how do situational spell lists, activated-ability cooldowns, item use/duration patterns, terrain hazards + fog-of-war, flee odds, and loot legibility typically work in well-regarded dice/turn-based crawlers — and which of those conventions are table stakes, differentiators, or anti-features for *this* game's identity** (crunchy dice made visible, deadpan family-friendly comedy, 5–10 minute runs, one-thumb phone taps, 100%-dice-rolled character progression with **no player-authored build choices**)?

---

## 0. Headline finding

Mazeworld already has the *scaffolding* for almost everything this milestone asks for — the milestone is a **differentiation and enforcement pass on existing primitives**, not new-system invention:

- **Use → effect-for-X → cooldown-for-Y-squares already exists** and works today on 8 cloaks, 8 jewelry items, and several potions (`content/treasure-tables.js` — Pendant of Fortitude `every 100`, Amulet of Stone `every 200`, Cloak of Speed `every 50`, Cloak of Invisibility/Ether `every 100`; `content/potions.js` — Speed 50 squares, Strength 25 squares, Enlarge 50 squares). The milestone's "magic items as use→effect→cooldown" ask is **extend this pattern to more items**, not invent it.
- **Round-based combat timers already exist** (`c.ward` pool+rounds, `c.mirror` rounds, `c.regen`, `combat.afraid` — all ticked once per `foeTurn` round and cleared at `endCombat`, per `docs/USABLE-FEATURES-AUDIT.md` §6). The milestone's "activated cooldown abilities" for melee classes should reuse this **rounds** clock for in-combat actives, keeping the existing **squares** clock for exploration items — two clocks, not one, matching what's already shipped.
- **The Shield ward chip (pool + rounds) already shipped** in v1.3 Phase 31 ("Shield chip shows pool + rounds" — PROJECT.md Validated list). The v1.5 ask ("Shield shows its remaining pool on the hero") is most likely about surfacing it **outside combat too** (Hero tab), not building it from scratch — verify scope before treating as new engine work.
- **Class-gating already exists as data** on every weapon (`cls: "FTM"/"F"/"FT"`) and armor (`cls`, `min` level) row in `content/weapons.js`/`content/armors.js` — the "(usable by …)" loot-legibility ask is a **display pass over data that already exists**, not a new gating system.
- **What does NOT exist today:** an equipment-slot model (no `slot` field anywhere in `content/treasure-tables.js` — nothing stops a hero from carrying/wearing multiple rings, multiple cloaks, etc.), a terrain move-cost model (map squares are presence/absence, not typed tiles with a cost), and a real "combat spell niche" design (many offense spells in `content/spells.js` are pure damage-die variants at increasing level, which the milestone itself calls "cheapest damage wins").

---

## 1. Per-sub-question findings, ranked for THIS game

### (a) Spell list as situational choices, not a damage ladder

**What good crawlers do:** DCSS's own dev commentary (`crawl.develz.org`) describes an explicit, ongoing effort to make spells "useful but situational" rather than permanent/always-correct — the design goal stated by the devs is that over a game made of "thousands of fights," a spell that is *always* the right pick is a design smell, not a feature. Slay the Spire's community-documented philosophy (Cloudfall Studios' breakdown, widely cited) is the sharpest version of this: **each card should solve some problems, not all** — a card's power is allowed to be extreme *because* it's narrow (works in Act 1, dead in Act 3; works vs. a single elite, useless vs. a swarm). The mechanism that makes a spell list feel like real choices is a **niche taxonomy**, not a level gate:

| Niche | Function | Where it fits a dice-crawler |
|---|---|---|
| Single-target burst | High variance, kills one dangerous thing fast | vs. a lone strong foe |
| Multi-target/AoE | Lower per-target damage, hits everything | vs. a pack |
| DOT | Damage spread over rounds, no upfront spike | vs. a foe you plan to outlast, or when your own to-hit is bad this fight |
| Control (sleep/stun/confuse-equivalent) | Removes a foe's turn(s) rather than dealing damage | vs. the ONE foe that would otherwise wreck you |
| Defensive/ward | Reduces incoming damage/risk | vs. an alpha-strike encounter or a fight you're entering hurt |
| Utility | No combat effect at all — detection, escape prep, info | outside combat, before a decision |

**Mazeworld's actual gap (grounded in `content/spells.js`):** the utility/defensive/divination niches are already well-separated (Heal/Major Heal, Shield/Bubble, Strength, Detect Magic, Mirror Self, Sense Danger, Sense Presence, Regeneration, Summon/Phantom Host, Turn Walking Dead, Plane Gate) — 13 of 32 spells already occupy distinct non-combat niches with no overlap. The genuine problem is concentrated in **two places**:
1. **Pure single-target damage spells are a straight ladder**: Freeze (d6, lvl1) → Ice (d6/round + freeze, lvl3) → Fireball (2d10+4, lvl3) → Mangle (2d20+15, lvl5) — at any given level a caster has exactly one "best damage per WP," so the others are never chosen once the better one is known. Fireballs (volley, d8 balls of d10+2 each) and Lightning (d10+6 vs. every foe) are the ONLY spells that differentiate on multi-target — everything else in the offense school is single-target damage at a rising die.
2. **A control glut**: Doze, Stun, Weaken, Stupidity, Blind, Shrink, Petrify, Insane, Turn Walking Dead all "disable or cripple one-or-more foes" with no stated axis for *why* you'd pick one over another beyond spell level — 9 of 32 spells share one functional lane.

**Recommendation (ties to identity):** re-derive the offense school along the niche table above rather than a pure damage curve — e.g., keep exactly one clean single-target burst per tier, make Acid/Ice genuinely the DOT choice (situational: "I'm about to be Afraid/underpowered to-hit this fight, so damage-over-time beats a single roll"), keep Earthquake/Fireballs/Lightning as the AoE trio each with a distinct downside (Earthquake hurts you too — a genuine risk/reward pick fitting the game's "play the hand you're dealt" dice identity), and differentiate the control glut by **scope** (single foe vs. up to d6 foes) and **duration** rather than raw level. **Every wizard sub-class needs a day-one damage spell** (already a stated v1.5 requirement) — this is additive to the niche work, not in tension with it.

**Classification:** **Table stakes** for this milestone (it's the headline ask). **Complexity: MEDIUM** — no new engine mechanism, but every offense spell's numbers and `kind` need re-deriving together, gated behind the class-pass yardstick (`tools/tune-classes.mjs`) exactly like prior balance passes.
**Anti-feature to avoid:** don't chase DCSS/Spire's depth by inventing entirely new spell *mechanics* (charges-per-turn schools, spell combos) — 32 spells for a 5–10 min session is already generous; the fix is differentiation of what exists, not expansion of the system.

### (b) Activated-ability design for melee classes (cooldowns in turns/squares)

**What good crawlers do:** Hoplite (the closest comparable — a short-session, mobile, turn-based tactical roguelike) is instructive because it deliberately avoids "bump-attack-spam" (the designer's own stated goal, per Giant Bomb/ResetEra summaries): a **small fixed action set** (move, melee, one cooldown special — shield bash on a 3-turn cooldown, unlimited uses), **limited-use tools** (throwing spear must be retrieved, sandals have a small charge count), and a **level-up "gifts" system** that improves cooldowns/charges rather than adding new buttons. Shattered Pixel Dungeon's wand rework (`shatteredpixel.com` blog) reinforces the same shape at the item level: 2 base charges, faster regen the more charges are missing — **short cooldowns on a small kit**, not long cooldowns on a big kit.

**Applied to Mazeworld:** the combat screen is a fixed 2×2 grid (STRIKE / SPELLS-or-ABILITIES / ITEMS / SOCIAL) on a phone screen — the existing SPELLS submenu pattern (per-class filtered list) is the template the new ABILITIES submenu should copy exactly (`docs/USABLE-FEATURES-AUDIT.md` §9 already documents this submenu shape). Recommended sizing for a 5–10 minute session:
- **Pool size:** 3–6 abilities visible per class at once (the existing Fighter/Thief skill lists are 9–12 entries total, but not all convert to actives — a converted subset of ~3–5 plus a rolled pool addition per level keeps the submenu scannable in one thumb-reach, matching Hoplite's "small kit" lesson).
- **Cooldown unit:** **rounds**, not squares, for anything usable only in combat — mirrors the existing `c.ward`/`c.mirror`/`combat.afraid` round-tick precedent already in the engine. 2–5 rounds is the sweet spot: short enough to fire more than once in a fight that might last 3–8 rounds, long enough that it isn't "spam every turn" (Hoplite's 3-turn shield-bash cooldown is the closest analog and is explicitly praised for feeling meaningful without stalling play).
- **Squares-based cooldowns stay for exploration-usable actives** (anything with a passive-skill precedent like Bard's Sing, already squares-gated at 100) — do not collapse the two clocks into one; the dual-cadence (rounds in combat, squares while walking) is already Mazeworld's own established idiom, not something to import.

**Classification:** **Differentiator** (activating passive skills + a rolled ability pool is new relative to what exists, and directly serves "melee variety," a named milestone goal) with one **table-stakes constraint**: cooldowns must be small pools / short cooldowns, per genre consensus on short-session mobile turn-based combat. **Complexity: MEDIUM–HIGH** — needs new per-hero cooldown-counter state, a new dispatchable action type per ability (or one generic `useAbility` action, mirroring `useItem`'s existing shape), and UI wiring reusing the SPELLS-submenu pattern.
**Identity tie-back:** the ability pool must be **rolled, not chosen** (see §2 anti-features) — "a class-flavored active-ability pool rolled at level 1 and each skill level" (the milestone's own wording) is exactly right and should not slide toward a player-facing "choose your upgrade" screen under implementation pressure.

### (c) Item use/duration/cooldown patterns + equipment slot rules

**What good crawlers do:** SPD's equipment model (Fandom wiki + DeepWiki) caps a character at a small, fixed number of equipment slots (~5: weapon, armor, and a few ring/misc slots) and enforces **one item per slot type** — this is the mechanism that makes finding a second ring of the same category a real decision ("swap or sell") instead of a pure accumulation. Artifacts in SPD only charge/cooldown **while equipped**, reinforcing that wearing is itself the resource commitment, not just carrying.

**Mazeworld today (grounded read):** `content/treasure-tables.js`'s JEWELRY (8), CLOAKS (8), and STAVES (8) tables carry no `slot` field at all — nothing in the read data or the audit indicates an enforced "one ring at a time" rule. The milestone's own text explicitly flags this as new: "one worn item per slot type (ring/bracelet/cloak/…), no stacking of a type." This is a **real, confirmed gap**, not a restatement of an existing rule.

**Recommendation:** add a `slot` field per item (ring/bracelet/cloak/amulet/staff/shield — matching the milestone's own "On You: Worn (armor/cloak/jewelry) · Carried (weapon/staff/shield)" split) and enforce equip-time replace-not-add. Keep the **use → effect-for-X-squares → cooldown-for-Y-squares** shape exactly as it exists today (Cloak of Speed/Ether/Invisibility, Pendant of Fortitude, Amulet of Stone) and extend it to more items rather than inventing a second pattern (e.g. a charges-per-day system) — one mental model for "how do magic items work" is a genre-agnostic UX win and costs nothing new to build.

**Classification:** **Table stakes** (slot enforcement is what makes "meaningful choices" true of gear at all — without it, a player just wears everything they find, which is the opposite of this milestone's stated goal). **Complexity: LOW–MEDIUM** — one new data field + one new equip-time guard; the use/cooldown mechanism itself is already proven code, not new.
**Anti-feature to avoid:** don't build a full itemization sandbox (affix rolling, enchanting, upgrade currency) — SPD/DCSS have these because their run lengths are hours; Mazeworld's hand-authored 8-item tables per category and 5–10 minute sessions call for **small, legible, memorizable** item pools, not a procedural loot system.

### (d) Consumable tools that bypass terrain/hazards (rope, ladder, torch)

**What good crawlers do:** the durable convention (DCSS scrolls of teleport/blinking, and general roguelike "tool" design) is **narrow, one-shot items tied 1:1 to a specific hazard type**, not a universal skeleton key. A rope that only helps with pits and nothing else is a *good* design specifically because it's legible and situational — you know exactly when to use it and exactly when it's dead weight, which is the same "situational, not universally correct" principle as (a).

**Mazeworld precedent (grounded):** Lockpicks are already exactly this shape — a passive, single-purpose, consumed-by-one-specific-gated-action item (`hasPicks`, consumed by `openChest`'s lock roll, per `docs/USABLE-FEATURES-AUDIT.md` §4). Rope/ladder/torch should follow the identical shape: no cooldown, no duration — **one-shot, consumed on the specific hazard check it answers** (a pit roll, a wall-climb roll, a darkness-view check).

**Classification:** **Table stakes** once water/darkness/climb hazards become real player-facing mechanics this milestone (a hazard with zero counterplay tool feels unfair in a permadeath game). **Complexity: LOW–MEDIUM** — the milestone's own PROJECT.md notes the climb-decision "major overlay" (CLIMB IT) already exists from Phase 35 as the exact hook point; rope/ladder should present as an alternate resolution path at that SAME decision point, not a new screen.
**Anti-feature to avoid:** a single universal tool that bypasses all hazards (a "skeleton key" item) trivializes the exact hazards this milestone is adding real teeth to — keep the 1:1 mapping strict.

### (e) Terrain that costs extra movement + fog-of-war in darkness

**What good crawlers do:** friction tiles (deep water, quicksand, chasms) that cost extra movement or require preparation are a standard "make the player think about routing" device across the genre; darkness/vision-radius fog is near-universal in vision-based roguelikes, with the standard behavior being **currently-visible squares fully rendered, previously-seen-but-now-out-of-radius squares shown dimmed/"remembered" rather than erased**, and light sources or race/class traits as the mitigation.

**Mazeworld precedent (grounded):** the map already permanently reveals explored squares as "dark-blob" marks (per PROJECT.md's Phase 35 description) — the milestone's darkness ask is narrower and consistent with genre convention: only *while standing on/near a dark square*, shrink the view to 3×3, and **re-fog** previously-explored squares until the hero leaves the dark (an intentional, scoped reversal of the map's normal "always shown once explored" rule, exactly the kind of "declared canon divergence" this project already tracks per phase). Two existing hooks make this cheap: the Thief's **Night Vision** skill ("darkness costs you nothing," `content/skills.js`) and **Amulet of Light** ("a standing light spell; dispels darkness," `content/treasure-tables.js`) are both currently-inert flavor text waiting for exactly this mechanic to attach to.

**Water as a friction tile:** "2 moves per square" is a clean, low-complexity friction cost (a per-square move-cost multiplier) with an existing built-in tension valve — the milestone pairs it directly with the Bodies-of-water phobia trigger, so the "cost" of water is narrative/tension-based (slower, scarier) rather than needing a separate counter-item this milestone.

**Classification:** **Table stakes** for making phobias and gear (Night Vision, Amulet/Cloak of Light) mean something real — both are currently named-but-inert, exactly the pattern this milestone exists to fix everywhere else. **Complexity: MEDIUM** — needs one new generic "square property" concept (light requirement / move-cost multiplier / phobia trigger) rather than three bespoke one-offs for water/darkness/heights, since all three plug into the same rendering + phobia-check seam.
**Anti-feature to avoid:** don't generalize fog-of-war to the WHOLE map (a full NetHack-style vision-radius-everywhere system) — that's a much larger rendering/memory change than this milestone scopes, and conflicts with the map's existing "explored stays visible" identity outside of darkness specifically.

### (f) Flee/escape odds that feel fair

**What good crawlers do:** across tabletop-derived and indie crawlers, flee is treated as a real, roughly even-odds decision (not a near-guarantee, which removes all tension from disengaging, and not a near-impossibility, which punishes recognizing a bad fight) — genre commentary and design write-ups on "diplomatic"/escape mechanics converge on this middle ground, with class/build modifiers shifting the odds rather than replacing them. Most digital roguelikes (DCSS, Brogue) show only a flavor result ("you escape" / "you fail to escape"), not the underlying number.

**Mazeworld's actual dial (grounded in PROJECT.md's own milestone text):** today's formula is d20 + Thief bonus 5, need ≥ 11 (roughly 50% baseline / 75% for a Thief), with **no race input at all** — the milestone wants it lowered with small class/race modifiers and the roll/need shown in the fight log.

**Classification:** **Table stakes** for fairness (lowering a too-generous baseline) but the **transparent roll/need display is a genuine differentiator** — most comparable roguelikes deliberately hide the number to preserve suspense; Mazeworld's whole identity is "the tables decide" and every dice roll is already shown on tap-to-reveal in the fight log (Phase 34) — hiding the flee math would be inconsistent with the game's own established voice, not just a missed nicety. **Complexity: LOW** — a numeric retune of one existing formula plus reusing the already-built dice-reveal fight-log convention; no new UI surface needed.

### (g) Loot legibility ("usable by …")

**What good crawlers do:** the standard solution across the genre (Diablo-lineage color/tint coding, tabletop-crawler text tags) is to mark class/level restriction directly on the item so a player never wastes a decision picking up or equipping something they can't use. Text tags beat color-only coding for accessibility and for small phone screens where color alone is easy to miss.

**Mazeworld's actual gap:** class-gating data already exists on every weapon and armor row (`cls: "FTM"/"F"/"FT"`, `content/weapons.js`/`content/armors.js`) — the milestone's ask is purely a **display** pass, surfacing data that's already there onto the encounter-dot, find, and victory-loot presentations.

**Classification:** **Table stakes**, and arguably overdue given this project's own established "nothing happens silently" principle (v1.2's 209-event narration coverage guarantee) — an un-narrated class restriction is exactly the kind of silent rule this project has spent two milestones eliminating everywhere else. **Complexity: LOW** — pure view-model text derived from existing `cls` fields, no new data or engine change.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Combat spells differentiated by niche (single/multi-target, control, DOT, defensive) instead of a pure damage ladder | Genre consensus (DCSS/Spire): a spell that's always the right pick is a design flaw; players expect each spell to have a "moment" | MEDIUM | Re-derive `content/spells.js` offense school against the niche table in §1(a); gate behind `tools/tune-classes.mjs` |
| Every wizard sub-class has a day-one damage spell | Already a stated v1.5 requirement; a caster with no way to hurt anything at level 1 is broken, not situational | LOW | Data-only fix, mirrors the v1.2 Phase 23 precedent (every non-Summoner caster already gets a guaranteed day-one attack spell) |
| One worn item per equipment-slot type (no stacking rings/cloaks) | SPD's 5-slot model; without it, gear accumulation replaces gear choice | LOW–MEDIUM | New `slot` field on `content/treasure-tables.js` rows + an equip-time replace guard; no existing enforcement found in a direct read |
| One-shot tools tied 1:1 to a specific hazard (rope→pit, ladder→wall, torch→dark) | Narrow, legible tools are a genre norm; the existing Lockpicks item is the in-codebase precedent for this exact shape | LOW–MEDIUM | Hook into the existing CLIMB IT major-overlay decision point (Phase 35), don't build a new screen |
| Darkness fog (3×3 view, re-fog on entry, waived by Night Vision/light items) | Vision-radius fog is near-universal in this genre; Night Vision and Amulet/Cloak of Light are existing inert flavor waiting for this | MEDIUM | One generic "square property" (light requirement) rather than a bespoke darkness-only hack |
| Water as a movement-cost + phobia-trigger tile | Friction terrain is standard; pairs cleanly with the existing (currently non-firing) Bodies-of-water phobia | LOW | Per-square move-cost multiplier; shares the same "square property" seam as darkness |
| Fairer, lower-baseline flee odds with class/race modifiers | Flee should be a real coin-flip decision, not a near-guarantee; today's ~50–75% is on the generous side per genre norms | LOW | Numeric retune of the existing d20+bonus≥need formula (`engine/combat.js`) |
| Loot "(usable by …)" tags on every offer (encounter dot / find / victory) | Class-gating already exists as data; an unnarrated restriction contradicts this project's own "nothing happens silently" principle | LOW | Pure display pass over existing `cls` fields — no new data |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Transparent flee math (roll + need shown in the fight log, not a hidden %) | Most comparable roguelikes hide this number to preserve suspense; showing it is consistent with — and reinforces — this game's "the tables decide" dice-forward identity | LOW | Reuses the already-built tap-to-reveal dice convention from Phase 34's fight log |
| Rolled (not chosen) class-flavored ability pool at level-up | Most genre peers (Spire's card rewards, Hoplite's gift menu) make ability acquisition a PLAYER CHOICE; Mazeworld's whole identity is "100%-dice-rolled, no player-authored build" — rolling the ability pool is the correct genre deviation, not a compromise | MEDIUM–HIGH | Must resist scope pressure toward a "pick your upgrade" screen during implementation |
| Dual-cadence cooldowns (rounds for in-combat actives, squares for exploration items) | Already Mazeworld's own idiom (ward/mirror tick per round; cloaks/jewelry tick per square) — most modern roguelikes use one uniform "turn" clock for everything | MEDIUM | Extend the existing pattern to new melee actives rather than collapsing to a single clock |
| Sarcastic/deadpan narration on every new mechanic (cooldown refusals, tool-use flavor, Cutthroat-murders-Joiner) | The comedy voice is this project's core differentiator layer over otherwise-standard mechanics; every new system this milestone adds is an opportunity for a new joke, not just a new rule | LOW (per-line) | Must pass the existing `test/voice/safety-scan.test.js` family-friendly guardrail |
| Risk/reward AoE spells with a real downside (Earthquake's self-damage) kept as a deliberate identity feature, not "fixed" away | A spell that can hurt you too is a distinctly dice-crawler, "play the hand you're dealt" flavor of risk most modern balanced-RNG roguelikes smooth away | LOW | Keep, don't nerf into safety, when doing the niche-rework pass in §1(a) |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Player-chosen ability/spell/perk selection screen (Slay the Spire card-reward style, Hoplite gift-menu style) | It's the genre-standard way to make level-ups feel meaningful | Directly conflicts with the established Key Decision "100%-dice-rolled characters, no player choice... faithful to the game's comedic identity" | Roll the ability pool exactly as the milestone spec already states; keep any "choice" flavor-narrated, not mechanically player-driven |
| Full itemization sandbox (affix rolling, enchanting, socketing, procedural magic items) | SPD/DCSS have deep item-identify/enchant subsystems that feel rewarding over long runs | Wrong session length (hours vs. 5–10 min) and wrong item-pool philosophy (this game's hand-authored 8-per-category tables are legible precisely because they're small and memorizable) | Extend the existing hand-authored tables with `slot` + use/cooldown fields; do not add procedural generation |
| On-grid AoE telegraph/preview UI (SPD/Brogue-style tile highlighting before a spell/ability resolves) | Feels like it would reduce "gotcha" AoE damage | Conflicts with this project's own established "no new UI screens, narration IS the telegraph" finding from the v1.1 milestone research (Oracle/fight-log lines already serve this role) | A distinct narrated line before the effect resolves (already the pattern for foe ability casts) |
| A universal "skeleton key" tool that bypasses any hazard | Feels convenient, reduces the sting of a bad die roll on a specific hazard | Trivializes the exact hazards (water, darkness, climbing) this milestone is giving real teeth; breaks the situational-tool principle from §1(d) | Keep tools strictly 1:1 with their hazard (rope/pit, ladder/wall, torch/dark), exactly as the milestone spec already states |
| Percentage-only flee/spell-resist UI that hides the underlying dice | Common mobile-UX pattern to reduce "math anxiety" | Undercuts the crunchy, dice-forward core value this whole game is built around; contradicts the existing tap-to-reveal fight-log convention | Show roll + need explicitly, as the milestone's own spec already intends |
| Full-map, always-on fog-of-war (vision-radius fog everywhere, not just on dark squares) | Reads as "more roguelike" (NetHack/Brogue-style universal vision limits) | Much larger rendering/memory-model change than scoped; conflicts with the map's existing "explored squares stay visible" identity outside darkness | Scope fog strictly to darkness-flagged squares, exactly as the milestone spec states ("on a dark square the map shows only the 3×3...") |
| "Smart" foe AI that adapts to the player's new abilities/gear (lookahead, counter-picking) | Feels like it would make fights react meaningfully to player builds | Reconfirms the same anti-feature the v1.1 milestone research already flagged for foe spellcasting: massive complexity for a pure/deterministic, parity-gated engine at this session length; genre peers (DCSS/Brogue) don't do this either | Bounded, deterministic per-creature behavior tables, unchanged from the existing foe-ability model |

---

## Feature Dependencies

```
Equipment slot model (new `slot` field + equip-time replace guard)
    └──requires──> nothing new (pure data + one guard)
    └──enables───> Gear tab "On You / Bag" split (needs a slot taxonomy to know what counts as "Worn" vs "Carried")
    └──enables───> Magic-item use→cooldown extension feeling like a real choice (can't "pick the best ring" if you can wear all of them)

Generic "square property" (light requirement / move-cost multiplier / phobia trigger)
    └──enables───> Darkness 3×3 fog + re-fog behavior
    └──enables───> Water squares (2 moves, Bodies-of-water phobia trigger)
    └──enables───> Heights hook (crevices/gorges) — same property, different trigger
    └──shared with──> Night Vision skill / Amulet of Light / Cloak of Light activation (existing inert flavor text becomes real once the property exists)

Consumable terrain tools (rope/ladder/torch)
    └──requires──> the square-property terrain work landing FIRST (or in the same phase) — a tool needs a real hazard to bypass
    └──requires──> the existing CLIMB IT major-overlay decision point (Phase 35) as its UI hook — no new screen

Melee active abilities (skill-to-ability conversion + rolled ability pool)
    └──requires──> a new per-hero cooldown-counter state (rounds-based, mirrors c.ward/c.mirror)
    └──requires──> the existing SPELLS-submenu UI pattern (reused for a new ABILITIES submenu)
    └──shares────> the class-pass balance yardstick (tools/tune-classes.mjs) with the spell niche rework — retune together, not sequentially, to avoid double-tuning power (the same lesson the v1.1 "ONE consolidated retune" decision already encoded)

Spell niche rework (combat spells differentiated; every wizard sub gets a day-one damage spell)
    └──independent of gear/abilities work mechanically
    └──shares────> the SAME class-pass balance yardstick as melee abilities — land in the same tuning pass

Flee retune (lower baseline + class/race modifiers + shown roll/need)
    └──independent of everything else — pure numeric + fight-log text change

Loot "(usable by …)" legibility
    └──requires──> nothing new — reuses existing `cls` fields on weapons/armors
    └──independent of everything else

Cutthroat-can-take-a-Joiner + murder chance
    └──requires──> the existing Joiner accept/swap flow (already shipped, v1.0 Phases 7–11)
    └──conflicts with──> the current SUB_NOTE flavor text ("no Joiner will ever agree to walk beside you") — must be rewritten as part of this feature, not left contradicting the new mechanic
```

---

## MVP Definition

*(This is a milestone-scoped MVP — what v1.5 itself must land vs. what can slip — not a general product MVP; the product has already shipped v1.0–v1.4.)*

### Land this milestone (v1.5)

- [ ] **Spell niche rework** — differentiate the offense-school damage ladder and control glut by function (single/multi-target, DOT, control scope/duration); guarantee every wizard sub a day-one damage spell; scribed scrolls castable immediately — essential, it's the headline ask and the class-pass yardstick already exists to gate it
- [ ] **Detect Magic → timed map-reveal** — a small, self-contained scoping change (permanent → N-turn duration) with an existing declared-divergence precedent (canon-vs-engine deviations are already a normal, tracked part of this project's process)
- [ ] **Melee active abilities** (skill conversion + rolled level-up pool) — essential per milestone scope; reuse the SPELLS-submenu UI shape and the rounds-based cooldown clock already established
- [ ] **Equipment slot model** (`slot` field + one-per-type enforcement) — essential prerequisite for both the magic-item rework and the Gear tab's On You/Bag split; cheap, do it first
- [ ] **Magic-item use→effect→cooldown extension** to more weapons/armor/gear beyond the current 8 cloaks/8 jewelry — essential to this milestone's "gear rework" goal; reuses proven code
- [ ] **One-shot terrain tools** (rope/ladder/torch) — essential, but sequence AFTER the terrain "square property" work lands (nothing to bypass otherwise)
- [ ] **Terrain "square property"** (darkness fog, water move-cost + phobia, Heights hook) — essential; build once, generically, rather than three bespoke special-cases
- [ ] **Flee retune** (lower baseline, class/race modifiers, shown roll/need) — essential, low-complexity, independent
- [ ] **Cutthroat Joiner + murder chance** — essential per milestone scope; must include a flavor-text rewrite of the contradicting `SUB_NOTE` line
- [ ] **Dead-foe auto-retarget** — essential per milestone scope, low complexity (a targeting guard, not a new system)
- [ ] **Loot "(usable by …)" legibility + Gear On You/Bag split + rations-per-camp on Hero** — essential "clarity pass" items; all pure display work over existing data, do these last so they reflect the final slot/gear shape

### Add after this milestone, if scope allows (still v1.5-adjacent, lower priority)

- [ ] Shield-pool visibility on the Hero tab specifically (outside combat) — verify first whether v1.3 Phase 31's combat-chip work already satisfies the intent before treating this as new
- [ ] A second consumable tool per hazard type (e.g., a cheaper/worse alternative to rope) — only if the single-tool version proves too binary in on-device play

### Explicitly defer past this milestone

- [ ] Any player-facing ability/spell "choice" UI — conflicts with the dice-rolled-everything identity; not a v1.5 candidate at all, ever, unless a future explicit user decision reverses the Key Decision
- [ ] Procedural/affix-rolled magic items — wrong shape for this game's hand-authored, small-table item design
- [ ] Full always-on fog-of-war across the whole map — far larger than the darkness-only scope stated
- [ ] AoE telegraph/preview UI on the grid — conflicts with the existing "no new UI screens, narration is the telegraph" finding
- [ ] Adaptive/"smart" foe AI reacting to player build choices — same anti-feature already flagged in the v1.1 milestone research for foe spellcasting; still applies here

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Spell niche rework + day-one damage spell | HIGH | MEDIUM | P1 |
| Equipment slot model | HIGH | LOW–MEDIUM | P1 |
| Melee active abilities (rolled pool) | HIGH | MEDIUM–HIGH | P1 |
| Terrain square-property (darkness/water/heights) | MEDIUM–HIGH | MEDIUM | P1 |
| One-shot terrain tools | MEDIUM | LOW–MEDIUM | P1 |
| Magic-item use→cooldown extension | MEDIUM–HIGH | LOW–MEDIUM | P1 |
| Flee retune + shown roll/need | MEDIUM | LOW | P1 |
| Loot "(usable by …)" legibility | MEDIUM | LOW | P1 |
| Gear On You/Bag split + rations-per-camp | MEDIUM | LOW | P1 |
| Cutthroat Joiner + murder chance | LOW–MEDIUM | LOW | P2 |
| Dead-foe auto-retarget | LOW | LOW | P2 |
| Detect Magic timed reveal | LOW–MEDIUM | LOW | P2 |
| Shield-pool-on-Hero (if not already satisfied) | LOW | LOW | P3 |

**Priority key:** P1 = essential to this milestone's stated goal ("no budget picks, no dead phobias, no silent causes"); P2 = clearly in-scope per the milestone's own target-feature list but lower user-facing weight; P3 = verify-first, may already be done.

---

## Competitor Feature Analysis

| Feature area | DCSS / Brogue | Shattered Pixel Dungeon | Slay the Spire | Hoplite | Mazeworld's approach |
|---|---|---|---|---|---|
| Spell/card situationality | Explicit dev goal: avoid "always correct" spells | N/A (wands, not spells) | Extreme power tied to narrow applicability | N/A | Niche taxonomy (§1a) over the existing 32-spell table, not a new spell system |
| Ability cooldowns | N/A (mostly passive/no-cooldown abilities) | Wand charges regen faster the more depleted | N/A (deck-based, not cooldown-based) | 3-turn cooldown on a small, fixed kit | Rounds-based cooldowns on a small (3–6) rolled ability pool |
| Equipment slots | Multiple ring/amulet slots, still capped | ~5 fixed slots, one item per slot | N/A | N/A (fixed 2-item kit: sandals + spear) | New: one-per-type slot model layered onto existing hand-authored jewelry/cloak/staff tables |
| Terrain hazards | Deep water requires swimming/flying; lava blocks | Chasms, quicksand slow/skip movement | N/A | Lava blocks movement entirely | Water = 2 moves/square + phobia trigger; darkness = 3×3 fog; both new "square property" work |
| Fog of war | Vision-radius fog, remembered-dim tiles outside radius | Standard vision-radius fog | N/A | N/A (small hex grid, fully visible) | Scoped to darkness-flagged squares only, not the whole map — a deliberate narrower scope |
| Flee/escape | Flavor-only result, no shown odds | Flavor-only result | N/A | N/A (no flee mechanic — small board, must resolve) | Numeric odds SHOWN in the fight log — a deliberate divergence from genre norm, matching the dice-forward identity |
| Loot legibility | Identify system (unknown until used/identified) | Similar identify system | Rarity color-coding, no class gating (single-character decks) | N/A | Explicit "(usable by …)" text tag over existing `cls` data — no identify-mystery layer, matching the "nothing happens silently" principle |

---

## Sources

**Primary (HIGH confidence — direct code/document reads):**
- `.planning/PROJECT.md` — v1.5 milestone scope, target features, Key Decisions table (100%-dice-rolled/no-player-choice identity), prior milestone precedent for "declared canon divergences" and "one consolidated retune"
- `content/spells.js` — full 32-spell table, `kind`/`combatOnly`/level/dice fields
- `content/skills.js` — Fighter (12) and Thief (9) passive skill tables
- `content/treasure-tables.js` — Jewelry (8), Cloaks (8), Staves (8) use/cooldown (`every`) fields; no `slot` field present
- `content/weapons.js`, `content/armors.js` — class-gating (`cls`) and dice-curve data
- `content/potions.js` — square-based duration precedent (Speed/Strength/Enlarge)
- `content/flavor.js` — Cutthroat/phobia flavor text requiring a rewrite for this milestone
- `docs/USABLE-FEATURES-AUDIT.md` — refusal vocabulary, per-spell/item gating table, §6 effect-expiry clock table (rounds vs. squares precedent), §9 shell obligations (existing Shield chip, SPELLS-submenu shape)
- `.planning/research/FEATURES.md` (prior v1.1 version, superseded by this file) — the "no lookahead/smart-AI" and "narration is the telegraph, no new UI" anti-feature findings, reconfirmed here for melee abilities/spells

**Secondary (MEDIUM confidence — web research, design consensus, not code-verified against those engines):**
- DCSS spell-buff/situational-design commentary — [A Brief History Of Buffness](https://crawl.develz.org/wordpress/a-brief-history-of-buffness), [DCSS manual](https://crawl.akrasiac.org/docs/crawl_manual.txt)
- Slay the Spire situational-card philosophy — [Game Design Tips from Slay the Spire — Cloudfall Studios](https://www.cloudfallstudios.com/blog/2020/11/2/game-design-tips-reverse-engineering-slay-the-spires-decisions), [Slay the Spire Wiki: Cards](https://slay-the-spire.fandom.com/wiki/Cards)
- Shattered Pixel Dungeon wand/artifact charge-cooldown design — [Shattered PD v0.3.0: The Wand Rework](https://shatteredpixel.com/blog/shattered-pixel-dungeon-v030.html), [Pixel Dungeon Wiki: Wands](https://pixeldungeon.fandom.com/wiki/Shattered_Pixel_Dungeon/Wands), [Pixel Dungeon Wiki: Artifacts](https://pixeldungeon.fandom.com/wiki/Shattered_PD_-_Artifacts)
- Hoplite ability/cooldown/kit-size design — [Giant Bomb: Hoplite](https://giantbomb.com/wiki/Games/Hoplite), [ResetEra: Let me introduce you to Hoplite](https://www.resetera.com/threads/let-me-introduce-you-to-hoplite-small-but-addictive-mobile-rogue-like-turn-based-puzzle-game.94812/), [Magma Fortress: Hoplite](http://www.magmafortress.com/p/hoplite.html)
- General roguelike/indie flee-escape design consensus — [Rogue Dungeon (Steam)](https://store.steampowered.com/app/1822640/Rogue_Dungeon/), general genre pattern (fair, roughly even-odds escape, class-modified) cross-checked against Mazeworld's own stated formula in PROJECT.md
- Brogue/DCSS fog-of-war and vision-radius conventions — general genre knowledge (direct search did not surface Brogue-specific developer commentary; treated as LOW-confidence genre convention, not a sourced claim, and flagged as such)

---
*Feature research for: Delve, Die, Repeat — v1.5 Meaningful Choices — Spells, Gear & Abilities*
*Researched: 2026-09-17*
