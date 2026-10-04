// content/spells.js
//
// Pure-data port of mazeworld.html's SPELLS table (~line 831-864). Every
// `dmg: () => D(n)` closure is converted to dice-notation ({n,sides,bonus})
// per Pattern 1. Non-damage spells (wards, status, utility) keep their
// `pool`/`rounds`/`reflect`/`txt` fields verbatim and simply have no `dmg`
// field, matching the prototype. Array order preserved for rows 0-31 (the
// prototype's actual 32-row count; content-tables.test.js locks the total
// at 31 as of Phase 90 plan 06).
//
// 04-DR10: `combatOnly` classifies each spell as castable from the HERO
// tab's Grimoire OUTSIDE an encounter (false) vs. requiring an active
// encounter to have any real effect (true). Derived directly from each
// spell's `kind` and engine/magic.js#castSpell's own implementation — NOT a
// judgment call per spell name:
//   - false (non-combat/utility/self): the kind's effect branch in castSpell
//     is unconditional — it sets/reads only `c.*` fields (heal/ward/might/
//     mirror/senses/reveal/foresee/regen) or explicitly branches for a
//     no-combat caller (summon: sets `c.pendingAlly` when `state.combat` is
//     null, joined automatically by the next `startCombat()`). Casting these
//     while walking around is a real, useful action (e.g. Map the Floor
//     lights the floor; Sense Presence must be up BEFORE an encounter to
//     prevent a surprise round — engine/derived.js reads `c.senses`).
//   - true (combat-only/offensive/target-a-foe): the kind's effect branch
//     reads `state.combat`/`combat.js#liveFoes()` (empty outside combat) to
//     find a target — cast with no foe present, it is either a silent no-op
//     that burns a charge for nothing (stun/weaken/stupid/blind/shrink/acid/
//     vapor/volley/petrify/insane/turn/gate/thrown/status/dot) or actively
//     HARMS the caster for zero benefit (quake's unconditional self-damage/
//     possible death; death's unconditional 25hp cost with no foe to kill).
//
// Phase 40 (SPELL-01/03/04/05 — the "spell rework" content reshape):
//   - `niche` (every row, KEY into NICHE_LABELS below) + a `txt` that always
//     starts with `NICHE_LABELS[niche] + " · "` — the "a player can tell two
//     same-level spells solve different problems" contract
//     (test/unit/spell-table.test.js). Reading the niche key at any engine
//     call site (bot tactics, UI grouping) should read `sp.niche`, never
//     parse `sp.txt`.
//   - Data flags, each read by exactly one engine site: `onHit` (Freeze —
//     engine/magic.js's thrown branch) freezes solid on a hit; `aoe: "all"`
//     (Lightning) replaces the old `sp.n === "Lightning"` name-keyed special
//     case with a data flag so a rename can never silently break it;
//     `roll: "derived"` (engine/character.js#rollGrimoire) — a row so flagged
//     joins the day-one chargen pools through a DERIVED rng stream keyed on
//     the main cursor, never lengthening the main-rng shuffles (so
//     test/unit/chargen-rng-pin.test.js's pin tables stay byte-unedited). No
//     row carries `roll: "derived"` at this plan; the path stays in place for
//     the rows appended after it (Phase 90 plans 07-09).
//   - Row 5 renamed Detect Magic -> Map the Floor (SPELL-05); row 13 (Ice)
//     `kind` changed "thrown" -> "dot" (its `dmg` literal is unchanged — Plan
//     02 wires the actual per-round tick + the promised freeze-on-expiry).
//     Phase 90 plan 05 (SPELL-12, user 2026-09-30, Q5 A): Ice is no longer a
//     damage-over-time spell. Its `kind` is "blast" (no spell row has kind
//     "dot" any more): `aoe: "all"` and `onHit: "freeze"` are the data flags
//     Lightning and Freeze already carry, dmg is a d10, and
//     engine/combat.js#iceStorm reads them. Doze and Stun were swapped the same
//     phase (SPELL-11): Doze sleeps d4 foes and a hit wakes a sleeper, Stun
//     holds one foe for d4 rounds and a hit does not end it.
//   - Phase 40 appended a row 32, Lesser Summon (the Summoner's level-1 safe
//     summon, 40-CONTEXT.md Area 3). Phase 90 plan 06 REMOVED it again (see
//     below): the Summoner casts the level-2 Summon from level 1 instead.
//   - ARRAY-POSITION / lvl / s INVARIANT (load-bearing): `castSpell(state,
//     idx)`, the magic parity fixture's `spellIndex` (it uses only Heal, 0,
//     and Freeze, 4), and `readScroll`'s `SPELLS.indexOf` all index spells by
//     ARRAY POSITION; `rollGrimoire`'s pools filter by `lvl`/`s`. Rows 0-26
//     keep their position, `lvl` and `s`. New rows are APPENDED, never
//     inserted; a REMOVED row shifts the later rows down, keeping their
//     relative order (Phase 90 plan 06: Phantom Host, once row 27, left, so
//     Lightning, Regeneration, Mangle and Death each sit one row earlier).
//     Look a spell up by NAME in any test or tool, never by a literal index
//     past row 26.
//
// Phase 90 plan 06 (SPELL-12, user 2026-09-30): Lesser Summon and Phantom Host
// are REMOVED, and nothing in engine/ or content/ names them but the tolerant
// save load's rename table (engine/saveState.js). The Summoner casts the
// level-2 Summon from level 1 through the named exception in
// content/spell-level-overrides.js; the Wizard lost the Illusion school
// (content/mu-chart.js). The 31 rows left are the old 33 less those two.
// Phase 90 plan 07 (SPELL-10) APPENDS the four Special rows after Death (35 rows).
//
// Phase 90 (SPELL-09): an `act` record on a SPELLS row makes it a
// SPELL-SOURCED TIMED EFFECT: casting it starts one `spell:<n>` c.timers
// record of `act.effect` squares (engine/combat.js#startSpellEffect), and
// engine/derived.js#liveItemEffects reads the live record back through
// SPELL_ACT_OF exactly like an item effect (act.kind, act.eff and the rest of
// the item-activation vocabulary), so eff / itemEffectActive / conditionsOf
// need no spell-specific code. Strength is the first such row: its `act.dice`
// is the extra die every damage roll adds while the record is live (the die
// the row's retired `dmg` used to carry).

export const NICHE_LABELS = Object.freeze({
  burst: "burst",
  dot: "damage over time",
  multi: "multi-target",
  control: "control",
  defensive: "defensive",
  chaos: "chaos",
  buff: "buff",
  healing: "healing",
  answer: "answer",
  sight: "sight",
  summon: "summon",
  // Phase 90 plan 07 (SPELL-10, orchestrator default 2026-09-30): the maze-tool
  // niche of Open/Lock and Fly.
  utility: "utility",
});

export const SPELLS = [
  { n: "Heal", lvl: 1, s: "healing", kind: "heal", dmg: { n: 1, sides: 10, bonus: 0 }, niche: "healing", txt: "healing · you · d10 hp", combatOnly: false },
  { n: "Shield", lvl: 1, s: "protection", kind: "ward", pool: 50, rounds: 5, niche: "defensive", txt: "defensive · you · soaks 50 hp for 5 rounds", combatOnly: false },
  { n: "Strength", lvl: 1, s: "offense", kind: "might", act: { kind: "strength", effect: 100, dice: { n: 1, sides: 10, bonus: 0 } }, niche: "buff", txt: "buff · you · for 100 squares, every damage roll you make (each blow, each spell hit) adds an extra d10; casting it again starts the 100 over; no extra HP, sadly", combatOnly: false },
  { n: "Doze", lvl: 1, s: "offense", kind: "status", niche: "control", txt: "control · d4 foes, your target first · asleep d4 rounds each; a hit wakes the sleeper it lands on, because a nap is not armour", combatOnly: true },
  { n: "Freeze", lvl: 1, s: "offense", kind: "thrown", dmg: { n: 1, sides: 6, bonus: 0 }, onHit: "freeze", niche: "burst", txt: "burst · one foe · hits on 5–10 (d10) before bonuses, for d6 + your level² damage; unless it resists, a survivor is frozen for d4 rounds, then it is just cold and angry", combatOnly: true },
  // Phase 40 (SPELL-05, Plan 04): `squares` is the reveal window the engine
  // reads (engine/magic.js's reveal branch -> a c.timers["spell:reveal"]
  // record). Plan 76-06 (user ruling 2026-09-26): the window is ONE square,
  // so the hero's first step (any step; a water step's cost of 2 included)
  // ends it through the existing squares timer and its one sweep — Map the
  // Floor lasts only until you move. The old once-a-day cap note no longer
  // applies.
  { n: "Map the Floor", lvl: 1, s: "divination", kind: "reveal", squares: 1, niche: "sight", txt: "sight · the whole floor · shown until you take a step, then your focus breaks", combatOnly: false },
  { n: "Mirror Self", lvl: 1, s: "illusion", kind: "mirror", niche: "defensive", txt: "defensive · you · foes hit you only on their best roll (20 on a d20; 19–20 if you insulted them), d6 rounds", combatOnly: false },
  { n: "Stun", lvl: 1, s: "offense", kind: "stun", niche: "control", txt: "control · one foe · held for d4 rounds, and hitting it does not end it: it was never asleep, only stunned", combatOnly: true },
  { n: "Weaken", lvl: 1, s: "offense", kind: "weaken", niche: "control", txt: "control · every foe · foes hit only on a high roll (18–20 on a d20; 17–20 if you insulted them) and do half damage, d4+1 rounds", combatOnly: true },
  { n: "Acid", lvl: 2, s: "offense", kind: "acid", dmg: { n: 2, sides: 6, bonus: 2 }, niche: "dot", txt: "damage over time · one foe · 2d6+2 a round, d6 rounds; the first round adds your level² damage", combatOnly: true },
  { n: "Stupidity", lvl: 2, s: "offense", kind: "stupid", niche: "control", txt: "control · the foe you picked · its intelligence drops to 1 for the fight, so it resists almost nothing (a 20 on a d20, a little more as you go deeper), and it keeps swinging", combatOnly: true },
  { n: "Blind", lvl: 3, s: "offense", kind: "blind", niche: "control", txt: "control · one foe · blind for the fight: it hits only on its best roll (20 on a d20) and never lands a critical", combatOnly: true },
  { n: "Shrink", lvl: 3, s: "offense", kind: "shrink", niche: "control", txt: "control · up to d6 foes · half hp and half damage, the fight", combatOnly: true },
  { n: "Ice", lvl: 3, s: "offense", kind: "blast", dmg: { n: 1, sides: 10, bonus: 0 }, aoe: "all", onHit: "freeze", niche: "multi", txt: "multi-target · every foe · d10 + your level² damage to each, no roll to hit; unless it resists, a survivor is frozen for d4 rounds, then it is just cold and angry", combatOnly: true },
  { n: "Earthquake", lvl: 4, s: "offense", kind: "quake", dmg: { n: 3, sides: 10, bonus: 8 }, niche: "multi", txt: "multi-target · every foe and you · 3d10+8 + your level² damage to each foe; you get half the 3d10+8 unless warded, because the floor does not take sides", combatOnly: true },
  { n: "Noxious Vapor", lvl: 4, s: "offense", kind: "vapor", niche: "chaos", txt: "chaos · every foe · a d6 decides it: on a 4 each foe dies unless its own d10 shows a 1; any other number puts it to sleep for d6+2 rounds; from level 5 it is always the 4", combatOnly: true },
  { n: "Fireballs", lvl: 4, s: "offense", kind: "volley", dmg: { n: 1, sides: 10, bonus: 2 }, niche: "multi", txt: "multi-target · d8 bolts · d10+2 damage each, spread across the foes, + your level² damage once to each foe struck", combatOnly: true },
  { n: "Petrify", lvl: 5, s: "offense", kind: "petrify", niche: "control", txt: "control · one foe · turns to stone and dies; you get the experience and none of the spoils, because statues carry nothing", combatOnly: true },
  { n: "Insane", lvl: 2, s: "offense", kind: "insane", niche: "chaos", txt: "chaos · one foe · a d6 decides it: 1 it dies, 2 it hits the next foe, 3 or 6 it flees, 4 it sleeps d4 rounds, 5 it swings twice for the fight", combatOnly: true },
  { n: "Summon", lvl: 2, s: "special", kind: "summon", niche: "summon", txt: "summon · one ally · fights beside you d4+2 rounds", combatOnly: false },
  { n: "Fireball", lvl: 3, s: "offense", kind: "thrown", dmg: { n: 2, sides: 10, bonus: 4 }, niche: "burst", txt: "burst · one foe · hits on 5–8 (d8) before bonuses, for 2d10+4 + your level² damage", combatOnly: true },
  { n: "Major Heal", lvl: 3, s: "healing", kind: "heal", dmg: { n: 3, sides: 10, bonus: 0 }, niche: "healing", txt: "healing · you · 3d10 hp", combatOnly: false },
  // RULES-14 (Phase 75, user 2026-09-25): Bubble was a strictly-better
  // Shield (100 hp, 12 rounds, PLUS a reflect). It is now a one-shot mirror
  // instead — the next blow bounces back in full, then a small pop pool for
  // the rest of that round. See engine/magic.js's ward branch and
  // engine/combat.js#applyFoeDamageToPlayer's mirror check.
  { n: "Bubble", lvl: 3, s: "protection", kind: "ward", mirror: true, popPool: 25, niche: "defensive", txt: "defensive · you · the next blow bounces back at whoever threw it, then a 25 hp film for the rest of that round", combatOnly: false },
  { n: "Sense Danger", lvl: 3, s: "divination", kind: "foresee", niche: "sight", txt: "sight · your next fight · you act first, whatever turns up (the family it hints at is a hunch, not a promise)", combatOnly: false },
  { n: "Turn Walking Dead", lvl: 2, s: "protection", kind: "turn", niche: "answer", txt: "answer · every Walking Dead of your level or lower · sent back; any left standing swing only at you for the rest of the fight, never at your Joiner", combatOnly: true },
  { n: "Plane Gate", lvl: 3, s: "protection", kind: "gate", niche: "answer", txt: "answer · d6 Demons or Walking Dead · vanquished to The Planes", combatOnly: true },
  { n: "Sense Presence", lvl: 2, s: "protection", kind: "senses", niche: "sight", txt: "sight · you · fight in the dark at full skill and nothing gets the jump on you, till your next fight ends", combatOnly: false },
  { n: "Lightning", lvl: 4, s: "offense", kind: "thrown", dmg: { n: 1, sides: 10, bonus: 6 }, aoe: "all", niche: "multi", txt: "multi-target · every foe · hits each on 5–8 (d8) before bonuses, for d10+6 + your level² damage apiece", combatOnly: true },
  { n: "Regeneration", lvl: 4, s: "healing", kind: "regen", niche: "healing", txt: "healing · you · d8 hp a round, this fight", combatOnly: false },
  { n: "Mangle", lvl: 5, s: "offense", kind: "thrown", dmg: { n: 2, sides: 20, bonus: 15 }, niche: "burst", txt: "burst · one foe · hits on 5–8 (d8) before bonuses, for 2d20+15 + your level² damage", combatOnly: true },
  { n: "Death", lvl: 5, s: "offense", kind: "death", niche: "burst", txt: "burst · the foe you picked · dies outright; costs you 25 hp", combatOnly: true },
  // Phase 90 plan 07 (SPELL-10, user 2026-09-30: the slate in
  // 90-SPELL-SLATE-DRAFT.md accepted as drafted; Q6 A): the four Special spells
  // that buff and travel. Each is a spell-sourced timed effect (an `act` record,
  // engine/combat.js#startSpellEffect), `roll: "derived"` (it joins the day-one
  // pools through a derived stream and never lengthens a main-rng shuffle) and
  // `stretch: "squares"`: each point of the caster's Special school bonus adds
  // SCHOOL_STRETCH_SQUARES (10) squares to its window
  // (engine/derived.js#spellEffectSquares). `kind: "timed"` is a self kind, never resisted.
  { n: "Open/Lock", lvl: 1, s: "special", kind: "timed", act: { kind: "unlock", effect: 100 }, stretch: "squares", roll: "derived", niche: "utility", txt: "utility · your next chest · springs open with no lock roll if you reach one within 100 squares, +10 squares per school bonus point; lockpicks everywhere feel threatened", combatOnly: false },
  { n: "Fly", lvl: 2, s: "special", kind: "timed", act: { kind: "fly", effect: 30 }, stretch: "squares", roll: "derived", niche: "utility", txt: "utility · you · flight for 30 squares, +10 squares per school bonus point: walls to climb and crevices to leap are just scenery, and water costs one square; useless in a fight, where everything can reach you anyway", combatOnly: false },
  { n: "Enchant Character", lvl: 4, s: "special", kind: "timed", act: { kind: "enchant", effect: 50, eff: { toHit: 2, foeToHit: -2, critWard: 1 } }, stretch: "squares", roll: "derived", niche: "buff", txt: "buff · you · for 50 squares, +10 squares per school bonus point: +2 to hit, foes −2 to hit you, and no critical lands on you; the enchantment is on you, not on your personality", combatOnly: false },
  { n: "Speed of Sound", lvl: 5, s: "special", kind: "timed", act: { kind: "haste", effect: 50, eff: { first: 1 } }, stretch: "squares", roll: "derived", niche: "buff", txt: "buff · you · for 50 squares, +10 squares per school bonus point: two blows every time you swing, and you act first in every fight; you arrive before the noise you make", combatOnly: false },
  // Phase 90 plan 08 (SPELL-10, the slate accepted as drafted; Q6 A): the control
  // spells. All three are round-timed (`stretch: "rounds"`: each point of the
  // caster's school bonus adds one round, engine/derived.js#spellEffectRounds),
  // `roll: "derived"` (they join the day-one pools through a derived stream) and
  // combat-only. Stop Time (`kind: "timestop"`, Special 3) holds EVERY foe that
  // fails its resist for `holdRounds` rounds (combat.js#stopTime, a "time" hold).
  // Senseless (Illusion 2) and Duplicate Foe (Illusion 5) are `kind: "misdirect"`
  // (combat.js#misdirectFoe): one foe swings at its own side (`at: "friends"`) or
  // at itself (`at: "self"`) for the `rounds` dice, and never at yours.
  { n: "Stop Time", lvl: 3, s: "special", kind: "timestop", holdRounds: 2, stretch: "rounds", roll: "derived", niche: "control", txt: "control · every foe · stopped for 2 rounds, +1 round per school bonus point, unless it resists: it takes no turns, hitting it neither ends nor restarts the stop, and your melee blows, and your Joiners' and summoned allies', hit it automatically; then time resumes, and so do they", combatOnly: true },
  { n: "Senseless", lvl: 2, s: "illusion", kind: "misdirect", at: "friends", rounds: { n: 1, sides: 4, bonus: 0 }, stretch: "rounds", roll: "derived", niche: "control", txt: "control · one foe · loses its senses for d4 rounds, +1 round per school bonus point, unless it resists: each swing it takes hits another foe at its own damage, never your side; with nobody else to hit, it hits the air, which never complains", combatOnly: true },
  { n: "Duplicate Foe", lvl: 5, s: "illusion", kind: "misdirect", at: "self", rounds: { n: 1, sides: 4, bonus: 1 }, stretch: "rounds", roll: "derived", niche: "control", txt: "control · one foe · meets its double and fights it for d4+1 rounds, +1 round per school bonus point, unless it resists: every swing it takes lands on itself, at its own damage; it leaves you alone, being busy", combatOnly: true },
  // Phase 90 plan 09 (SPELL-10, the slate accepted as drafted; the last three of
  // the ten): the Illusion spells that end or tilt a fight. All three are
  // combat-only and `roll: "derived"` (they join the day-one pools through a
  // derived stream). Door Illusion (`kind: "door"`) leaves the fight through the
  // flee path Smoke uses (combat.js#doorIllusionEscape); Chameleon Tongue
  // (`kind: "tongue"`, `fluency: 2`) IS the fight's one parley, made at fluency 2
  // (combat.js#parley reading the fight-scoped C.tongue); Size of the Behemoth
  // (`kind: "behemoth"`) routs the weaker foes and cows the rest for the fight
  // (combat.js#behemothRoar). None stretches: the chart gives the Illusion school
  // +0 to both sub-classes that learn it, and none of them is round- or
  // square-timed.
  { n: "Door Illusion", lvl: 1, s: "illusion", kind: "door", roll: "derived", niche: "defensive", txt: "defensive · the fight · a door that isn't there, and you through it: no flee roll, no parting blow, spoils left behind; the cleverest foe rolls one resist and may see through it, and then you have spent your turn admiring a wall", combatOnly: true },
  { n: "Chameleon Tongue", lvl: 3, s: "illusion", kind: "tongue", fluency: 2, roll: "derived", niche: "answer", txt: "answer · this fight · you speak their tongue like a local and talk at once: a parley (talking your way out of the fight instead of swinging) at +4 to the roll, which even Magical foes will hear (the Walking Dead still won't); it spends the fight's one parley", combatOnly: true },
  { n: "Size of the Behemoth", lvl: 4, s: "illusion", kind: "behemoth", roll: "derived", niche: "control", txt: "control · every foe · you look enormous: each foe rolls its resist, and one that fails and is below your level flees, spoils and all; the rest cower for the fight, hitting only on a high roll (18–20 on a d20; 17–20 if you insulted them) for half damage", combatOnly: true },
];

// Phase 95 (FLAVOR-01; CONTEXT 'Data shape and guards' and 'Tone'): the player
// line for each of the 41 spells, keyed by spell name, in table order. A row's
// `txt` above stays the exact rules text, pinned by the v2.3 guards and shown
// under RULES; the flavour is keyed here, never inline on the row. Every line
// is one sentence of about 90 characters or fewer with no number, die or
// percentage (test/unit/flavor-layer.test.js), and is reviewed on
// docs/narrative-pass/review.html.
export const SPELL_FLAVOR = Object.freeze({
  "Heal": "Closes wounds the polite way: quickly, and without asking how you got them.",
  "Shield": "A cushion of wishful thinking that soaks up blows until it gives out.",
  "Strength": "Lends every blow and spell a little extra conviction until the magic wears off.",
  "Doze": "A lullaby for several foes together, undone by the first rude interruption.",
  "Freeze": "A well-aimed bolt of winter: it stings, and what survives goes stiff and cross.",
  "Map the Floor": "Lays out the whole floor in your mind, right up until you take a step.",
  "Mirror Self": "A reflection that gets in the way, so most swings miss the real you.",
  "Stun": "Dazes a foe into standing still, however rudely you poke it.",
  "Weaken": "Takes the wind out of every foe, who swing sloppily and hit like damp towels.",
  "Acid": "Eats at a foe round after round, with a hiss that really sets the mood.",
  "Stupidity": "Leaves a foe too dim to resist much, and still perfectly able to hit you.",
  "Blind": "Blinds a foe for the fight, so it flails at the scenery and rarely finds you.",
  "Shrink": "Leaves a handful of foes pocket-sized, with pocket-sized hit points to match.",
  "Ice": "A blizzard for the whole room, whether or not anyone dressed for it.",
  "Earthquake": "Hurts everyone in the room, caster included, by making the ground lose its temper.",
  "Noxious Vapor": "A cloud of dubious intent that puts foes to sleep, or something sterner.",
  "Fireballs": "A volley of little fireballs, scattered among the foes with more enthusiasm than aim.",
  "Petrify": "Turns a foe into garden statuary: permanent, decorative and entirely without loot.",
  "Insane": "Loosens a foe's grip on reality, and the results are anyone's guess.",
  "Summon": "Calls a helper out of thin air, who fights for you until they remember their errands.",
  "Fireball": "A proper ball of fire with a foe's name on it, and no sense of proportion.",
  "Major Heal": "Knits you back together with a firm hand and a long, disapproving look.",
  "Bubble": "Returns the next blow to sender with its compliments, then lingers as a soft cushion for the round.",
  "Sense Danger": "A prickle at the back of your neck, so the next fight never gets the first word.",
  "Turn Walking Dead": "Tells the Walking Dead to go back to bed, and the stubborn ones take it personally.",
  "Plane Gate": "Opens a door to The Planes and shoos a few Demons or Walking Dead through it.",
  "Sense Presence": "Your skin crawls in a helpful direction: no ambushes, and fighting in the dark stops being a chore.",
  "Lightning": "Jumps from foe to foe in a crackle of bad news, leaving each of them singed.",
  "Regeneration": "Persuades your body to keep mending itself for the length of the fight.",
  "Mangle": "The heaviest blow in the book, saved for a foe that has really earned it.",
  "Death": "Ends a foe outright, and bills you in health for the privilege.",
  "Open/Lock": "Persuades your next chest to open itself, to the visible dismay of every lockpick.",
  "Fly": "Lifts you over walls and gaps as if they were rumours, though it is no help in a scrap.",
  "Enchant Character": "Wraps you in a shimmer that sharpens your aim and spoils everyone else's.",
  "Speed of Sound": "Makes you quicker than your own excuses: you swing more and always go first.",
  "Stop Time": "Pauses every foe mid-sneer, which makes them wonderfully easy to hit, until time resumes.",
  "Senseless": "Turns a foe's temper on its friends, and on thin air when it has none.",
  "Duplicate Foe": "Gives a foe a twin to argue with, and it is far too busy to bother you.",
  "Door Illusion": "Paints a door on the nearest wall and leaves through it, if the foes buy it.",
  "Chameleon Tongue": "Lets you talk to foes in their own tongue, which improves the odds of a polite exit.",
  "Size of the Behemoth": "Makes you loom enormously, so lesser foes flee unless they know better, and the rest lose heart.",
});

// Phase 95 (FLAVOR-01; CONTEXT 'Tone'): one shared line for every scroll. A
// scroll is a counter that casts a random spell, so no scroll has a per-spell
// description; the line hints that the choice of spell is not the reader's.
export const SCROLL_FLAVOR = "The scroll picks the spell and you do the reading, which seems about fair.";
