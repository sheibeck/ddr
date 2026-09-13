# Feature Research — Foe Abilities, Bestiary Rebalance, Parley/Language

**Domain:** Turn-based dice-driven mobile roguelike dungeon-crawler (solo, offline, 5–10 min sessions)
**Researched:** 2026-09-13
**Confidence:** HIGH for the canon inventory (direct rulebook + source read, cross-checked line-by-line against `content/bestiary.js` and `engine/combat.js`); MEDIUM for comparable-roguelike patterns (web search, general design consensus, not primary-sourced code reads of those engines).

---

## 0. Headline Finding (reframes the whole milestone)

`engine/combat.js`'s own module header states this as an already-audited fact, confirmed here by cross-reading every creature against the rulebook:

> "Most BESTIARY creature `sp.*` flags (poison/disease/steals/enthrall/awe/grapple/entangle/possess/raise/shriek/quills/ar/critOn/loot/song/pack/slow/halfDmg/age/pursues/seesInvis/noTurn/never_melee/dark/daggerOnly/caster/breaks/every, etc.) are flavor-only… Only `sp.atk`, `sp.dmg`, `sp.toHit`, `sp.fast`, `sp.magicOnly`, `sp.noArmor`, and `sp.twice` (via `lives`) have any mechanical effect."

This was already true in the **frozen `mazeworld.html` prototype**, not just an engine-port gap — so it is not a regression to fix, it is **uncharted territory to build**. Every creature's rulebook-described "special" beyond that 7-flag set (attack count, flat/dice damage, a numeric to-hit override, "fast" = harder to hit, "magicOnly"/"noArmor" = damage-source/soak bypass, "twice" = 2 lives) is currently **pure narration text** (`sp.note`) with zero game-state effect. Giving foes "real abilities" for this milestone means building the mechanical hooks for a long tail of already-named-but-inert flags, not wiring a couple of stragglers.

Two other cross-cutting gaps, confirmed by grep, apply to nearly every creature and are worth fixing once, generically, rather than per-creature:
- **A foe's own `sp.ar` (natural armor, e.g. Drat 12, Craig/Google/Herman 15) is never read anywhere** — it is flavor text ("natural mail", "chitin plate") with no actual damage-reduction effect on player hits. Every armored foe currently takes full player damage.
- **No spell-school-vs-creature-type multiplier exists** — canon repeatedly calls this out ("Cleric spells 2x effective" vs Gremlins, "magic has double effect" vs Walking Dead) and nothing in `engine/magic.js` reads foe `type` for a damage multiplier.

---

## 1. Canon Ability Inventory

Table columns: **Creature** (name as in `content/bestiary.js`, `{type} L{level}`) · **Rulebook ability** (condensed from `mazeworld.pdf` "Creatures Described," pp.36–43) · **Bestiary `sp` flag today** · **Mechanically modeled today?** (per the 7-flag real set above — everything else is `sp.note` flavor only).

### Beasts

| Creature | Rulebook ability | `sp` flag | Modeled? |
|---|---|---|---|
| Bat/Rat (L1) | 2 attacks/round, 1WP each | `atk:2, dmg:1` | ✅ YES |
| Shriek (L1) | d4→1: screams, deafens 1 random member 25 sq (−2wp, strike die +1, half dmg); else attacks d4 | `shriek:true` (no `dmg` field at all → falls back to generic `lvl²+d6`) | ❌ NO |
| Viper (L1) | Bite poisons 2wp/round × d10 rounds, cured by Cure Poison | `poison:true` | ❌ NO |
| Cave Bear (L2) | Swipe d8; bite d10+rabies(disease), 10wp/day×2 unless cured, chance of insanity | `dmg:1d8, disease:true` | ⚠️ PARTIAL (dmg only; disease inert) |
| Zit (L2) | Acid: d8 initial +d6/round×3, armor damage permanent; hit only on a 4 | `acid:true, toHit:4` (no `dmg` field) | ⚠️ PARTIAL (toHit:4 real; acid DoT inert, generic dmg fallback) |
| Drat (L3) | Natural mail (AR~12), need 5 to hit, weapon-break chance on a "10 to hit" roll | `ar:12, toHit:5, breaks:true` | ⚠️ PARTIAL (toHit real; `ar`/`breaks` inert) |
| Flube (L3) | Armor-piercing poison spike; blinds d6 rounds; blinded party takes 3-to-hit from Flube | `noArmor:true, blind:true` | ⚠️ PARTIAL (noArmor real; blind-the-player inert — no player-blindness state exists at all) |
| Rast (L3) | +4 damage with any weapon it picks up | `dmg:1d8+4` | ✅ YES |
| Sterling (L3) | Two hearts: **half damage from everything, even magic** | `halfDmg:true, dmg:1d12` | ❌ NO (biggest single balance bug — Sterling should be a damage-sponge and isn't) |
| Wolf (L3) | +2 damage | `dmg:1d6+2` | ✅ YES |
| Drake (L4) | Physical brute-force attack; breathes fire (=Fireball, 2d10+4) **every 4th round only** | `dmg:2d10+4, every:4` | ❌ NO (`every` inert — Drake deals fireball-tier damage EVERY round, not gated) |
| Stink Bug (L4) | Attacked as if 1 level lower; hits player only on a 2; on-hit grants a random 1-day phobia | `toHit:2, phobia:true` | ⚠️ PARTIAL (toHit real; phobia-infliction + attacker-level-down inert) |
| Dread Lock (L5) | No special described | (none) | N/A — correctly plain |
| Stalka Beast (L5) | **Immune to fire/lightning/poison/illness; sees invisible/hears silenced; strikes through force fields; only knives/dirks harm it; casts every lvl1-5 offensive spell without limit** | `atk:2` + note only | ❌ NO — the single largest canon/implementation gap in the bestiary. The game's most powerful beast is currently a generic 2-attack creature with zero of its five defining traits. |

### Demons

| Creature | Rulebook ability | `sp` flag | Modeled? |
|---|---|---|---|
| Gremlin (L1) | +3 damage, fast; Sorcerer in party scares it off (60% no-attack); Cleric spells 2x effective vs it | `dmg:1d6+3` | ⚠️ PARTIAL (dmg only; class-conditional behaviors inert) |
| Poltergeist (L2) | 2 strikes/round; armor ineffective against it | `atk:2, noArmor:true` | ✅ YES |
| Rinkle (L3) | Toxin (d8/3-to-hit): d6 1-2 → "aging" hallucination — victim's OWN strikes become d20 vs a 2-to-hit until Rinkle dies | `age:true` (no dmg field) | ❌ NO |
| Djinni (L4/L5) | **Casts every lvl1-4 spell, up to 4×/day each**; flees to another plane when about to die; 1/20 chance it can be reasoned with | `caster:true` | ❌ NO — prime foe-caster candidate |
| Ghost (L4) | Only magic weapons/spells harm it; armor useless; 1/12 chance to evade whole fight; on-hit d12→1 grants a random phobia | `magicOnly:true, noArmor:true, phobia:true` | ⚠️ PARTIAL (magicOnly/noArmor real; phobia-on-hit inert) |
| Spectre (L4) | Only magic harms it, armor useless; **pursues you after you flee** until killed | `magicOnly:true, noArmor:true, pursues:true` | ⚠️ PARTIAL (pursues inert — fleeing works identically to any other foe) |

### Humans

| Creature | Rulebook ability | `sp` flag | Modeled? |
|---|---|---|---|
| Dante (L1) | 3 strikes/round (4 arms, 3 weapons); immune to ordinary magic (only Planes-shifters can hurt him with it) | `atk:3` | ⚠️ PARTIAL (atk real; magic-immunity inert) |
| China Wolf (L2) | Hunts in pairs, 2 attacks | `atk:2, dmg:1d6` | ✅ YES |
| Krupke (L2) | **Sorcerer — casts every lvl1-2 offensive spell**; d10 strike/4-to-hit longsword+2, mail armor | `caster:true, ar:12, dmg:1d8+2` | ⚠️ PARTIAL (dmg/ar-flavor only; caster inert) — clean tier-1 foe-caster candidate |
| Frank (L3) | Con-man: d10 roll at encounter start, on a 1 steals ALL party treasure and vanishes | `steals:true, dmg:1d8+6` | ⚠️ PARTIAL (dmg only; steal-and-flee inert) |
| Primp (L3) | Beauty: opposite-sex-phobic males auto-faint; d10 enthrall roll (1-5) incapacitates; escape roll d12 each round-end; kills the fully-enthralled party | `enthrall:true, dmg:1d8+2` | ❌ NO (no incapacitation mechanic exists at all) |
| Craig (L4) | Home-field advantage: attacker strikes as if 1 level lower | `dmg:1d12, ar:15` | ⚠️ PARTIAL (dmg/ar-flavor only; home-field penalty inert) |
| Herman (L4/L5) | Turns invisible at will; hittable only on a 2 while invisible; strikes as a level 5 (base 25+weapon) | `invis:true, ar:15, dmg:25` | ⚠️ PARTIAL (flat dmg real; invisibility-raises-player's-to-hit-need entirely inert — no `toHit` field even set) |

### Lair Beasts

| Creature | Rulebook ability | `sp` flag | Modeled? |
|---|---|---|---|
| Dog Face (L1) | Pack; leader carries d8 sword, rest d6; Elves get 2 attacks/3-to-hit frenzy vs this type | `dmg:1d6` | ⚠️ PARTIAL (flat dmg for all, no leader distinction; Elven frenzy bonus inert) |
| Goblin (L1) | Never retreats, carries wilmst | (none besides note) | N/A — flavor matches, no real special needed |
| Hobgoblin (L1) | d6+1 dmg; **guaranteed** misc-magic item in its lair | `dmg:1d6+1, loot:true` | ⚠️ PARTIAL (dmg real; guaranteed-drop override inert — uses the generic per-kill loot roll) |
| M&M (L1) | Crits on a natural 1 (redundant with the universal auto-crit-on-1 rule already applied to every foe); deaf | `critOn:1` | ✅ Effectively already covered by the generic rule (flag itself unread but behavior matches) |
| Pogo (L1) | +4 damage; "fast" = all non-Elves must roll 1 higher to strike it | `dmg:1d6+4, fast:true` | ✅ YES |
| Hair (L2) | Clubs, d6 damage, nothing else | `dmg:1d6` | ✅ YES |
| Trachea (L2) | Poison strike d10; **+4 bonus on its first hit**; Fighters do double damage to it; Thieves need a 5 (not 4) to hit | `poison:true, dmg:1d10` | ⚠️ PARTIAL (base dmg real; poison DoT, first-hit bonus, and the two class-conditional to-hit/damage rules all inert) |
| Blumble (L3) | Quills d12 + a rolling attack d20; **cutting it with a bladed weapon spawns a new Blumble** | `quills:true, dmg:1d12` | ⚠️ PARTIAL (dmg real for the quill hit only; the self-replication-on-bladed-hit and secondary d20 attack are both inert) |
| Drarl (L4/L5) | Acid: base+10 dmg; **mail/plate armor makes it WORSE** (extra +10/round for 2 rounds after) | `acid:true, noArmor:true` (no dmg field) | ⚠️ PARTIAL (noArmor real; the acid DoT + armor-type-punishes-you clause both inert) |

### Magical

| Creature | Rulebook ability | `sp` flag | Modeled? |
|---|---|---|---|
| Drekk (L1) | Initiative-gated sleep song: lose init → d10 roll >6 asleep until birds stop | `song:true` (no dmg) | ❌ NO |
| Shadow (L2) | Casts persistent darkness on 1-7/10 party members (cured by Light/Restore Vision or killing it); only dagger or magic harms it | `daggerOnly:true, dark:true` | ❌ NO (weapon-type-gate and the darkness-infliction are both inert; the *generic* darkness/phobia system from Phase 04.1 is a ready-made reuse target for the infliction half) |
| Werebeast (L3) | 2 attacks, d10+5; **demands ½ each member's wilmst or calls d10 reinforcements**; won't engage if a Stalka Beast is present; vanishes to Planes at fight's end | `atk:2, dmg:1d10+5` | ⚠️ PARTIAL (atk/dmg real; the entire extortion/reinforcement/Stalka-Beast-avoidance mechanic is unflagged AND unmodeled — not even a `sp` key exists for it) |
| Drudge (L4/L5) | **Unlimited innate casting of every lvl1-4 offensive spell; NEVER attacks physically** | `caster:true, never_melee:true` | ❌ NO — the purest "always-casts, no-melee" test case in the whole bestiary; currently just swings for generic melee damage every round, directly contradicting its identity |

### Walking Dead

| Creature | Rulebook ability | `sp` flag | Modeled? |
|---|---|---|---|
| Philly (L1) | Strikes on the LOWER of d10 or normal die (player-favorable downgrade); base+2 only; kill twice | `twice:true, slow:true, dmg:1d4+2` | ⚠️ PARTIAL (twice/dmg real via `lives`; `slow` — the player-favorable die-downgrade — inert) |
| Google (L2) | Rusted plate, longsword d8; no other special. (Canon-wide note: magic does 2× damage to all Walking Dead) | `ar:15, dmg:1d8` | ⚠️ PARTIAL (dmg real; the type-wide 2×-magic-damage rule is unimplemented for ANY Walking Dead creature) |
| Skeleton (L2) | Kill twice; crits on a 1 (redundant with universal rule); needs a 4 to hit | `twice:true, toHit:4, critOn:1` | ✅ YES (twice + toHit real; critOn redundant-but-covered) |
| Ghoul (L3) | 1-3/10 chance per turn to **resurrect an already-killed Ghoul** back to full WP | `raise:true, dmg:1d6` | ❌ NO |
| Zombie (L3) | Nat-1 grapples (immobilize, escalating escape-roll, eventual d20/round loss); separate on-hit d8 1-2 → leprosy (disease) | `grapple:true, disease:true` | ❌ NO |
| Bones (L4) | Whole pack focus-fires one randomly chosen target until dead, then re-targets | `pack:true` | ❌ NO (current targeting is per-swing random, not pack-coordinated) |
| Floater (L4) | On-hit: lifts/entangles; escape roll d20 1-5 (breaks free + falls, d10 fall dmg) else takes normal dmg each round; Plate armor blocks it entirely | `entangle:true` | ❌ NO |
| Undead (L4) | **On-kill**, d12 1-4 → its spirit possesses the killer, forcing d4 rounds of attacking their own party | `possess:true` | ❌ NO (rich mechanic: friendly-fire/possession candidate) |
| Vampire (L5) | d12 1-4 → awestruck (≈Stupidity spell, can shake off 1-2/12 each round-end); 2 attacks; sees invisible/hears silenced; **immune to Turn Walking Dead**; **casts every offensive+special spell lvl1-5, unlimited** | `atk:2, awe:true, caster:true, seesInvis:true, noTurn:true` | ⚠️ PARTIAL (atk real; ALL FOUR other named specials — awe, caster, seesInvis, noTurn — are inert) — the capstone boss currently has 1 of 5 canon traits working |

**Reading the inventory for scope:** the richest, cleanest "give foes spellcasting" targets, in order of canon clarity, are **Drudge** (unlimited lvl1-4, never melees — a pure caster), **Krupke** (restricted to lvl1-2, still swings a sword — a hybrid), **Djinni** (lvl1-4, capped at 4 casts/day/spell, flees when losing), and **Vampire** (unlimited lvl1-5, the endgame boss). **Stalka Beast** is the other must-fix — it is nominally a "Beast," not a caster type, but the rulebook gives it the same "casts every level without limit" clause plus a unique elemental-immunity + weapon-type-vulnerability kit that has no equivalent anywhere else in the bestiary.

---

## 2. Foe Spellcasting: Table Stakes vs Differentiators vs Anti-Features

Comparable turn-based roguelikes (Dungeon Crawl Stone Soup, Brogue, Shattered Pixel Dungeon) converge on a few shared norms for enemy-cast magic. None of these engines were code-read directly (web research only, MEDIUM confidence) — treat this section as design consensus, not implementation spec.

### Table Stakes

| Feature | Why expected | Complexity | Notes |
|---|---|---|---|
| Foes have a bounded, named spell list per creature (not "cast anything") | DCSS explicitly separates natural/magical/divine abilities per-monster; players learn a foe's kit and plan around it | LOW–MED | Canon already hands us this: Krupke = lvl1-2 offense, Djinni/Drudge = lvl1-4 offense, Vampire/Stalka Beast = lvl1-5 all. Reuse `SPELLS` filtered by `sp.lvl` + `kind !== "heal"/"ward"/etc` (offense-only, matching canon's "offensive spells" wording) |
| A resistance/counterplay check exists, not a guaranteed hit | DCSS's own philosophy explicitly avoids "no-brainer" no-counterplay effects | LOW | Already exists in reverse (foe `intel≥12` resists player spells, `engine/magic.js:86-97`) — canon literally states the SAME threshold applies to "any... creature or character with Intelligence 12 or higher" (rulebook p.25), so extending it symmetrically to the player is both table-stakes AND already-speced by the rulebook, not an invention |
| Casting is rate-limited (cooldown / uses-per-day / caster-only-if-melee-refused), not spammed every round | Prevents a single foe from feeling like unavoidable, repeated burst damage in a 5–10 min session | MED | Canon gives per-creature caps for free: Djinni "4×/day/spell", Krupke/Drudge/Vampire "unlimited" but still gated by the once-per-encounter/turn cadence a foe naturally has (1 action/round unless `atk>1`) |
| Foe spell use is narrated distinctly from a melee swing (name the spell, don't just say "hit") | Matches this game's existing Oracle-log-is-the-detail-layer pattern (DR15-E) and lets players learn to fear specific names | LOW | No new UI — an event type + `EVENT_NARRATION` entry per cast, exactly like `spellResisted`/`resistFailed` already work for the reverse direction |

### Differentiators (fits this game's tone/scope, not required elsewhere)

| Feature | Value proposition | Complexity | Notes |
|---|---|---|---|
| Sarcastic Oracle flavor per foe-cast spell (a Djinni's fireball gets a different deadpan line than a generic "Fireball" cast) | Reinforces the voice identity that is core to this project, not just mechanical | LOW | Pure content — new `EVENT_NARRATION` strings, no new event *types* needed beyond a generic `foeCast` |
| "Never melees" casters (Drudge) as a distinct AI branch | A foe that ONLY casts is a different threat-read than a foe that swings AND casts (Krupke); gives depth-band variety without new systems | LOW–MED | `never_melee` flag already exists in bestiary data — just needs `foeTurn` to branch on it |
| Symmetric INT resistance surfaced as a condition/toast ("Your wits turn the curse aside") | Makes the player's rolled Intelligence stat (currently a cosmetic-plus-lockpicking-bonus orphan, `intelBonus`) matter in combat too, which the milestone explicitly wants | LOW | Mirrors the existing `spellResisted`/`resistFailed` event pair, just with `c.intel` as the threshold instead of `t.intel` |

### Anti-Features (seem good, avoid for this scope)

| Feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| Foe AI that "chooses the optimal spell" via any lookahead/scoring | Feels like it would make fights "smarter" | Massive complexity for a pure/deterministic, parity-gated engine with a 5-10 min session target; DCSS/Brogue don't do sophisticated foe AI either — they rely on bounded per-monster kits, not general intelligence | A small deterministic per-creature table (e.g. "if never_melee, always cast the highest available offensive spell it knows"; "if melee-capable caster, cast on cooldown / when a condition is met") |
| A UI "enemy is casting!" telegraph/warning screen | SPD does show telegraphed AoE tiles for *some* mobs | This milestone's own scope boundary is explicit: **no new UI screens** — abilities surface through narration only | The Oracle-log narration ITSELF is the telegraph — a distinct `foeCasting`/`foeCast` line before the effect line functions as a one-beat warning without any new screen |
| Generalizing ALL ~30 inert `sp.*` flags into fully-simulated mechanics this milestone | The inventory above makes it tempting to "fix everything at once" | Most of these (grapple/entangle/possess/steal/enthrall/raise/pack) are BRAND NEW state machines with no existing engine seam (no incapacitation system, no on-kill-effect system, no focus-fire AI) — building all of them is a milestone unto itself and risks blowing the "no new UI" / parity-gate constraints trying to communicate new player states | Rulebook-first triage: land spellcasting (the milestone's headline ask) + the highest-value, lowest-new-surface specials (noArmor-family already done; `pursues`, `never_melee`, `slow`, foe `ar` as real armor, and the type-vs-magic-damage multiplier are all small reads on EXISTING fields/systems) — defer full incapacitation-style mechanics (grapple/entangle/possess/enthrall/awe-as-stun) to a future pass unless research/planning finds a cheap generalization (e.g. reuse the existing `asleep`/`stupid`/`frozen` fields as the incapacitation primitive, since those ALREADY exist and already stop a turn) |
| A full "spell school" AI personality per creature type (e.g. Demons always cast offense, Magical always cast utility) | Sounds thematic | Not canon — canon assigns casting per NAMED creature, not per encounter TYPE (e.g. most Demons don't cast at all; Poltergeist/Gremlin/Rinkle are non-casters) | Keep the caster flag per-creature exactly as canon does, resist the urge to generalize by type |

---

## 3. Parley / Negotiation Balance Patterns

General design consensus for "talk instead of fight" mechanics (Sunless Sea/Cultist Simulator-style negotiation roguelikes, tabletop-diplomacy ports, XCOM-adjacent) plus this game's own captured balance concerns (`proposed-milestone-monster-balancing.md` candidate #5):

| Pattern | What it does | Applicability here |
|---|---|---|
| **Reward parity, not reward superiority** | Diplomacy/talk-down payouts are typically ≤ the combat payout — a "safer, cheaper" option, not a strictly-better one | Directly fixes the flagged bug: parley pays `~2.5× Σ(d6×lvl)` vs a kill's `d6×lvl×5×raceMul`. Current parley is generally already LESS than a full kill per-foe when the raw multipliers are compared per creature (5 vs 2.5), but the *aggregate* pays for the WHOLE group at once with zero risk and no combat rounds — recommend re-deriving parley's total against the killFoe-equivalent for the same roster, then setting it strictly ≤ that sum, not a flat 2.5× multiplier chosen independently of the kill formula |
| **Escalating/diminishing retry** | "Try the same trick twice and they catch on" (a common indie-diplomacy pattern) — either odds worsen on repeat, or a failed attempt has a real cost | Today: zero failure cost beyond a lost turn, unlimited retries per encounter. A per-encounter attempt cap (e.g. 1 attempt, or odds worsening −N per retry) directly targets the "spam until success" concern already flagged |
| **A real failure cost, not just "no gain"** | Common alternative: a failed negotiation triggers a free foe attack, an aggro/ambush penalty, or forfeits the flee option this round | `parley()` already routes failure through `afterPlayerAction` (foes DO act after a failed parley today) — confirm this is felt as a real cost in practice, or make it explicit/harsher (e.g. failed parley forfeits initiative this round even if the player would have won it) |
| **Class/race gates stay wide, odds stay narrow** | Many systems let MOST characters attempt diplomacy but reserve high odds for a dedicated build | Matches the existing design well (Con Artist/Bard/Woodsman/Wilmsry/Elven/Language all WIDEN who can try) — the fix is TIGHTENING Con Artist's ~75%-at-level-1 baseline odds, not narrowing who's eligible |
| **Cost/benefit must never dominate combat for a build that CAN’T fight well either** | If parley is nerfed too hard, a Con Artist/Bard build (whose class identity leans on it) becomes strictly worse than a fighter who just kills things | Keep parley reachable and worthwhile for talk-oriented builds — tune the NUMBER (payout formula, retry cap) rather than removing the class bonuses (`+6`/`+3`/`+4`/`+3`) that define those subclasses |

**Complexity:** LOW — this is pure numeric/tuning + a small state field (attempt count per encounter), no new UI, no new engine domain. Directly composable with the `tools/tune-difficulty.mjs`/`tools/tune-economy.mjs` harnesses already used for the consolidated retune.

---

## 4. "Language as a System" — Design Options

Rulebook grounding (`mazeworld.pdf` pp.6-7, "Language"): every non-human race automatically speaks its own tongue plus the shared trade language ("Slop"); humans (non-Magic-User) speak ONLY Slop; a d12 roll can grant an extra language at chargen; a language BOUGHT at a store (post-chargen) isn't usable until the next skill-level-up. Fighter's `Language` skill entry (p.15) is separately described as letting a fighter "gain any language other than dragon which seems useful to them." The Helm of Knowledge (`content/treasure-tables.js`) is the only in-game item tied to this system: "grants the wearer perfect fluency in ONE chosen language... as long as the helm is worn."

Given the current implementation only uses Language as a single boolean parley-gate (`skill(c,"Language") || eff(c,"tongue")>0`, both already OR'd in `canParley`), three tiers of "Language as a real system" are available, in increasing complexity:

| Option | What it adds | Complexity | Fit for this milestone |
|---|---|---|---|
| **A — Confirm/polish the existing gate** (already landed) | Language skill OR Helm both unlock TALKATIVE-type parley; no further change | Done | Baseline — already shipped per `engine/combat.js:521` |
| **B — Graduated fluency (bonus, not just gate)** | Language skill/Helm ALSO adds a small flat `+N` to the parley roll (mirroring how Con Artist/Woodsman/Wilmsry/Elven already stack additively in `parley()`'s `bonus` calc) rather than being a pure yes/no gate | LOW | Fits cleanly into the existing additive-bonus formula; makes buying Language (1 skill point, cheapest skill in the game) or finding the Helm feel meaningfully better, not just binary-unlocked |
| **C — Widen WHICH types are talkable** | Canon doesn't restrict language by encounter TYPE — a language is a language. A case could be made that Language/Helm should let a character attempt parley against types OUTSIDE the current `TALKATIVE` set the same class/race bonuses already exempt (e.g. still never Magical/Walking Dead — those are canonically "doesn't speak," not "you don't understand it") | LOW–MED | Riskier: changes WHO can enter parley at all for types currently fully blocked; needs a design call on whether e.g. "Demons" already being TALKATIVE covers this, or whether something like Lair-Beast sub-groups warrant a split. Recommend deferring unless a concrete rulebook or player-facing gap is found |

**Recommendation:** ship **Option B** as the core of "Language as a system" for this milestone — it's a small, on-model change (same additive-bonus shape parley already uses), it's inert-item-wiring-shaped (same pattern class as Bracelet of Flight / Cloak of Armor), and it directly satisfies the milestone's own cross-reference note ("Language changes WHO can parley and how well... tune together with the parley balance pass"). Do not couple it to Option C without a separate design pass — the milestone's scope boundary already excludes new UI, and A/B are enough to make Language feel like "a system" instead of a single gate check.

**Dependency:** this option shares the exact `bonus` calculation site in `parley()` that the parley-balance pass (Section 3) is already retuning — land them together, in the same phase, so the bonus math isn't touched twice.

---

## 5. Feature Dependencies

```
Foe spellcasting (generalizing engine/magic.js for foe casters)
    └──requires──> Existing RESIST_IMMUNE_KINDS set + intel-resist pattern (engine/magic.js:33,86-97)
    └──requires──> An offense-only spell subset filtered from content/spells.js by sp.lvl cap per creature
    └──enables───> Symmetric INT resistance (player c.intel vs incoming foe spell, mirrors t.intel vs player spell)
    └──enables───> Krupke/Djinni/Drudge/Vampire/Stalka Beast canon fidelity (Section 1)

Bestiary rebalance (HP/damage/to-hit/AR vs depth)
    └──interacts───> Foe spellcasting (a caster's effective threat = melee stats + spell kit; must retune together, not sequentially, or the curve gets tuned twice)
    └──requires──> engine/difficulty.js as the single source of truth (already exists) — fold ability-bearing foes into the SAME retune pass, not a second one

Foe sp.ar as real armor (new, small, generic)
    └──independent of the above — a pure combat.js formula addition (foe defense subtracts from incoming player damage), touches every creature with a nonzero ar, must be included in the SAME difficulty retune since it changes effective foe survivability

Parley balance pass
    └──requires──> Language-as-a-system Option B (same `bonus` formula site in parley())
    └──independent of foe spellcasting/bestiary rebalance (different subsystem — combat resolution vs. combat avoidance) but SHARES the milestone's single difficulty-retune pass since parley XP feeds the same c.sp/c.gold curve

Language Option B (graduated fluency bonus)
    └──requires──> parley()'s existing additive bonus calc (already reads skill(c,"Language") / eff(c,"tongue") as a gate; add as a bonus term in the same expression)
    └──conflicts with──> doing Language and the parley numeric retune in SEPARATE phases (both touch parley()'s bonus formula — combine into one phase to avoid re-tuning twice, exactly as the milestone doc already flags)
```

---

## 6. MVP Definition (this milestone's scope, not a general product MVP)

### Land this milestone (v1.1)

- [ ] **Foe spellcasting core**: generalize `castSpell`-adjacent logic (or a new `foeCastSpell`) so `sp.caster`/`sp.never_melee` creatures actually cast from an offense-only, level-capped `SPELLS` subset — essential because it is the headline ask and unlocks symmetric resistance
- [ ] **Symmetric INT resistance**: wire `c.intel` (already exists, already has `intelBonus`) to resist incoming foe spells using the SAME `roll < intel, threshold 12` rule the rulebook states applies to "any creature or character" — essential, canon-specified, and explicitly gated on foe-casting landing first
- [ ] **High-value canon fixes with existing seams**: foe `ar` as real armor (generic formula add), `pursues` (Spectre — reuses flee's existing resolution path), `never_melee` (branch in `foeTurn`), `every` cooldown gating (Drake — mirrors existing `every`-squares item-cooldown pattern) — essential because they're cheap (no new state machine) and close some of the largest canon gaps (Stalka Beast, Drudge, Spectre, Drake)
- [ ] **Bestiary rebalance pass**: once ability-bearing foes are real, re-derive HP/damage/to-hit/AR per creature vs. intended depth band — essential, this milestone's second headline ask, and can't happen before spellcasting lands (it would tune stats for foes that don't yet do what they're supposed to)
- [ ] **Consolidated difficulty retune**: fold everything above into ONE `engine/difficulty.js` pass via the existing tuning harnesses — essential per the milestone's own explicit "ONE retune" directive
- [ ] **Parley balance pass**: retune payout formula (target: ≤ combat-equivalent, not 2.5×), Con Artist's baseline odds, and a per-encounter attempt cap or real failure cost — essential, already scoped and flagged as strictly-dominant today
- [ ] **Language Option B**: graduated fluency bonus added to the SAME parley `bonus` term — essential, small, and must land in the same phase as the parley numeric retune to avoid double-tuning

### Add after this milestone, if scope allows (still v1.1 candidate, lower priority)

- [ ] **Sterling `halfDmg`** (foe takes half damage from all sources) — clean generic mechanic, isolated to one creature's damage-taken path, no new state
- [ ] **Type-vs-damage-source multipliers** (Cleric spells 2× vs Gremlin-class Demons; magic 2× vs Walking Dead) — a single generic multiplier lookup, touches `magic.js`'s damage application, moderate scope because it needs a small `{sourceType, targetType} → multiplier` table
- [ ] **`slow` (Philly's player-favorable lower-of-two-dice)** — small, isolated to `strikeDie`/`toHit` resolution for one flag

### Explicitly defer past this milestone (per the milestone doc's own scope boundary + this research)

- [ ] Full incapacitation state machines (grapple/entangle/possess/enthrall/awe-as-real-stun, Primp/Zombie/Floater/Undead/Vampire's `awe`) — no existing engine seam; each is effectively its own status-effect feature. Consider prototyping ONE (e.g. reuse `asleep`/`stupid`/`frozen` as the shared "incapacitated" primitive) only if planning finds it cheap; otherwise backlog
- [ ] Guaranteed-drop overrides (Hobgoblin's loot, Frank's steal-and-vanish) — touches the loot/economy system, cross-references the (also out-of-this-milestone) Economy work
- [ ] Pack-coordinated focus-fire AI (Bones) — a targeting-AI change, not a per-creature data flag; separate from ability-wiring
- [ ] `daggerOnly` weapon-type gating (Shadow) — requires a weapon-TYPE check that doesn't exist anywhere in combat resolution today (only `magicOnly` exists); design call needed on whether to generalize weapon-type gates or treat Shadow as `magicOnly`-equivalent for now
- [ ] DR16-G "squares of opponents" / any AoE-model change beyond what's already wired — explicitly backlogged in the milestone doc
- [ ] Foe inspect screen / bestiary screen — explicitly out of scope (no new UI screens this milestone)

---

## 7. Sources

**Primary (HIGH confidence — direct code/document reads):**
- `mazeworld.pdf` "Creatures Described" (pp.36-43, extracted via `pdftotext -layout`) — full canon ability text for every creature cited above
- `mazeworld.pdf` pp.6-7 ("Language," race/language chargen tables) and p.15 (Fighter `Language` skill description)
- `mazeworld.pdf` pp.25-26 ("About the Spells," "Resisting Spells," "Spells v. Armor") — the canon Intelligence-resist rule (`Int ≥ 12`, `d20 < intel` negates), directly matching `engine/magic.js:86-97`'s existing player→foe implementation
- `mazeworld.pdf` p.47 (Jewelry Table — Helm of Knowledge full text)
- `content/bestiary.js`, `content/spells.js`, `content/skills.js`, `content/afflictions.js`, `content/encounters.js`, `content/treasure-tables.js` (direct read)
- `engine/combat.js`, `engine/magic.js`, `engine/derived.js`, `engine/difficulty.js` (direct read + grep-verified claims about which `sp.*` flags are mechanically real)
- `.planning/proposed-milestone-monster-balancing.md`, `.planning/proposed-features-dr15.md` (existing balance/design notes and prior audits this research extends)

**Secondary (MEDIUM confidence — web research, general design consensus, not code-verified against those engines):**
- Shattered Pixel Dungeon mob AI/telegraphing — [Pixel Dungeon Wiki: Enemies](https://pixeldungeon.fandom.com/wiki/Shattered_Pixel_Dungeon/Enemies), [AI and Mob Behavior — DeepWiki](https://deepwiki.com/00-Evan/shattered-pixel-dungeon/3.4-ai-and-mob-behavior)
- Brogue's counterplay/information-transparency design philosophy — [Brogue Wiki: Roguelikes and roguelites](https://brogue.wiki/wiki/Roguelikes_and_roguelites), [RogueBasin: Brogue](https://www.roguebasin.com/index.php/Brogue)
- Dungeon Crawl Stone Soup's monster-ability categorization and "avoid no-brainer resistances" design philosophy — [DCSS Manual](https://crawl.akrasiac.org/docs/crawl_manual.txt), [DCSS FAQ](https://crawl.github.io/crawl/FAQ.html)
- Indie diplomacy/negotiation-roguelike patterns (reward parity, escalating-retry) — [Ascii Dreams: Being diplomatic](http://roguelikedeveloper.blogspot.com/2008/03/being-diplomatic.html), [Parley (itch.io)](https://goodguystebs.itch.io/parley)

---
*Feature research for: Delve, Die, Repeat — v1.1 Monster Balancing & Abilities*
*Researched: 2026-09-13*
