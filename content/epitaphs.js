// content/epitaphs.js
//
// Pure-data port of mazeworld.html's EPITAPHS bank (~line 916-1029) and the
// CAUSE_TEXT death-note templates (~line 2898-2912).
//
// EPITAPHS entries already use plain {placeholder} string tokens the
// prototype's own epitaphFor() fills via a regex replace — ported verbatim,
// no conversion needed there.
//
// CAUSE_TEXT was the one place with real closures: `combat: f => \`cut down
// by a ${f}\`` and eleven parameterless `() => "..."` templates. All twelve
// are converted to plain string data with {placeholder} tokens (only
// `combat` has one, `{foe}`) — the engine does the substitution instead of
// calling a function. CAUSE_TEXT_TOKENS records, per cause, which token
// names (if any) the engine must supply when formatting the string.

export const EPITAPHS = {
  combat: [
    "Killed by a {foe}. The {foe} has since been promoted.",
    "Died as {name} lived: needing a 5 and rolling whatever that was.",
    "The {foe} was not the strongest thing in the room. It is now.",
    "Fought to the last breath, which arrived punctually in round four.",
    "A {sub} of skill level {lvl}, undone by something called a {foe}. Put it on the stone. All of it.",
    "{name} had {gold} wilmst and no plan. The {foe} had a plan.",
    "Last recorded thought: “it’s nearly dead.” True of someone in the room, just not the {foe}.",
    "Died on floor {floor} doing what {name} loved, which was evidently standing very still.",
    "The Game Master notes that running was, throughout, an option.",
    "Survived {day} days and spent the final nine seconds of them badly.",
    "Came in for {motive}. The {foe} came in for lunch.",
    "It took {sp} experience points to get here and one honest d20 to leave.",
    "Not the worst delver on floor {floor}. Merely the most finished.",
    "The {foe} would like to thank the dice, the Game Master, and above all {name}.",
    "Cause of death: a {foe}, some arithmetic, and a firm refusal to withdraw.",
    "Went toe to toe with a {foe} and lost by roughly one toe.",
  ],
  starve: [
    "Packed a grimoire, three potions and a good cloak. Packed no lunch.",
    "Cost of living: 4 hp a day. {name} fell behind on the payments.",
    "The dungeon did not kill {name}. The dungeon simply outlasted a stomach.",
    "Died on day {day} holding {gold} wilmst and absolutely nothing to spend it on.",
    "There was food two corridors away. There is always food two corridors away.",
    "Starved to death carrying a weapon worth more than most farms.",
    "Final act: counting the rations. The count was zero. It had been for some time.",
    "A troll’s appetite in a dungeon with no kitchen. This was always the ending.",
    "Not eaten — merely unfed. {name} learned the difference slowly.",
    "Death by budgeting.",
  ],
  trap: [
    "Stepped on the one flagstone in the corridor with an opinion.",
    "The trap had waited four hundred years for precisely this level of confidence.",
    "1–5 on a d20 avoids it. {name} rolled the way {name} always rolled.",
    "A {sub} with no eye for traps, in a dungeon assembled chiefly out of traps.",
    "Located the trap using the traditional method.",
    "The Game Master did not even look up.",
    "Whoever built this floor was clearly paid by the corpse.",
    "It was well marked. In a language. Somewhere. Probably.",
  ],
  fall: [
    "Climbing was there to be learned. {name} spent the points on Cooking.",
    "Went up the wall beautifully. Came down it considerably faster.",
    "Gravity remains undefeated on floor {floor}.",
    "Needed a 6 on a d10, three separate times. Managed two.",
    "The wall is still standing. {name} is being scraped off it.",
    "A short climb and an even shorter career.",
  ],
  gorge: [
    "Cleared eleven feet of a twelve-foot gap. So very nearly.",
    "Leaping is a d10 roll. {name} treated it as a formality.",
    "The crevice is not deep. It is simply deeper than {name} was tall.",
    "Jumped on day {day}. Landed shortly afterwards, and at length.",
    "The gap did not move. This was checked. Twice.",
  ],
  teleport: [
    "Teleported d20 squares. Required d20 minus four.",
    "Arrived somewhere. Arrived inside it.",
    "The dungeon does not check its destinations, and neither did {name}.",
  ],
  maze: [
    "Table four giveth. Table four overwhelmingly taketh.",
    "No monster, no trap, no fall. A red dot and a bad attitude.",
    "The dungeon deducted {name} the way a bank deducts a service charge.",
    "Killed by a d8, a d10, and an indifferent universe.",
    "Some floors have creatures. This one had paperwork.",
    "{name} walked onto a dot, and the dot walked back.",
  ],
  quake: [
    "Cast an earthquake indoors. Reader, the ceiling was also indoors.",
    "3d10+8 does not stop to ask whose side anyone is on.",
    "The rules say cast it from behind a shield. The rules are right there.",
    "Brought the house down, and then the house returned the favour.",
  ],
  potion: [
    "The colour was listed as “??”. {name} was thirsty.",
    "Fifty wilmst — the cheapest item on the table and the priciest decision on it.",
    "One bottle in ten is Death. {name} tested this thoroughly. Once.",
    "Drank an unlabelled potion on floor {floor}. The reviews are in.",
  ],
  insanity: [
    "Rolled a 1 on the madness table and won the argument with themselves.",
    "The corridor whispered something. {name} took it entirely on board.",
    "Nothing attacked {name}. Nothing needed to.",
    "Cause of death: one d6, honestly interpreted.",
  ],
  poison: [
    "Poison is patient. {name} was merely available.",
    "There was a cure. It cost 100 wilmst. {name} had {gold} and no store in sight.",
    "Died on an instalment plan, two hp per square.",
    "Not a dramatic death — but a beautifully documented one.",
  ],
  backfire: [
    "One spell in eight goes wrong for an Apprentice. This was the eighth.",
    "Held the incantation slightly wrong, and then very briefly.",
    "The grimoire is fine. The grimoire is always fine.",
    "Killed by their own homework.",
  ],
  summon: [
    "Called something up. It arrived. It had questions.",
    "One time in eight the summoning turns around. {name} beat the odds in the wrong direction.",
    "Read the opening paragraph of the ritual with tremendous conviction.",
    "The Summoner’s own notes cover this outcome. On the following page.",
  ],
  won: [
    "Walked out through the Gate on day {day}. The Game Master has requested a recount.",
    "Reached the Gate with {sp} experience points and a limp, and retired to lie about both.",
    "Went in for {motive}. Came out with {motive} and a permanent flinch.",
    "Survived all five floors and will now be insufferable at parties for life.",
    "Escaped. Statistically speaking, this did not occur.",
  ],
  // Device-review Pass B1 item 3: a DISTINCT, non-combat cause for a
  // voluntary "ABANDON THIS CHARACTER" — sarcastic and family-friendly per
  // the design brief ("what kind of monster abandons them down here"), never
  // implying real violence (no trap, no monster, no fall — just a decision).
  abandon: [
    "Not slain by the dungeon. Simply left here, on floor {floor}, by someone who kept walking.",
    "Still breathing when last seen. That was, apparently, the problem.",
    "{name} did not die down here. {name} was abandoned down here. There is a difference, and the difference is you.",
    "The dungeon offers no shortage of ways to end a delver. {name} is the rare case where a person chose one.",
    "Filed under: abandoned, not deceased. Even the paperwork thinks this is a bit much.",
    "Walked in on day {day} with {sp} experience points and a future. Walked out alone, without {name}.",
    "No trap. No monster. No fall. Just a decision, made on floor {floor}.",
    "The Game Master would like it on record that {name} was still perfectly capable of dying properly.",
  ],
  // 260919-00d (user ruling 2026-09-19: "if your movement ends when you are
  // in a wall, you die"): the Cloak of Ether's wall-walk window closing
  // while the party stands inside solid rock — a distinct, non-combat,
  // family-friendly cause (engine/movement.js#resolveEtherEnd).
  entombed: [
    "Became a permanent architectural feature.",
    "The cloak wore off. The wall did not.",
    "Walked through walls for a living. Retired inside one, on floor {floor}.",
    "{name} is now load-bearing. The dungeon thanks {name} for the support.",
  ],
  // RULES-09 (Phase 75.1, user 2026-09-24/25): a Pilfer's use-activated
  // magic-item fumble — the item explodes for a d10 in the Pilfer's own
  // hands and turns to dust. Deadpan, family-friendly, never a diagnosis:
  // the fidgeting is voice, not a label.
  pilferFumble: [
    "Took a {foe} apart to see how it worked. It did not want to be seen how it worked.",
    "One use in twenty, a {foe} comes apart in your hands. This was the twentieth-ish.",
    "The {foe} came with a lifetime warranty. This voided it.",
    "Curiosity, a {foe}, and an unforgiving d10.",
  ],
  // RULES-10 (Phase 75.1, user rulings 2026-09-25): a fumbled scroll's harm
  // landing on the READER instead of its target — never an automatic death
  // (the heavy blow and the burn are both ordinary hp loss through this same
  // death path), so these read as an honest mishap, not a killing blow.
  // Deadpan, family-friendly: the reading went wrong, not the reader.
  scrollFumble: [
    "Read a {foe} scroll aloud. The scroll listened to itself and did not like what it heard.",
    "Held the wrong end of a {foe} scroll. There is, it turns out, a wrong end.",
    "A {foe} scroll, read with tremendous confidence and a middling grasp of the runes.",
    "The scroll said {foe}. It meant it about the reader.",
  ],
};

// Death-note templates (mazeworld.html's CAUSE_TEXT, formerly functions).
// `{foe}` is the only token in use; the engine fills it from the death
// event's detail (e.g. the killing creature's name) the same way
// epitaphFor() already fills EPITAPHS tokens.
export const CAUSE_TEXT = {
  combat: "cut down by a {foe}",
  starve: "starved in the dark",
  trap: "undone by a trap",
  teleport: "materialised inside a wall",
  fall: "fell off a wall",
  gorge: "came up short on a leap",
  backfire: "killed by their own spell",
  summon: "eaten by their own summoning",
  maze: "spent by the dungeon itself",
  quake: "buried by their own earthquake",
  potion: "poisoned by an unlabelled bottle",
  insanity: "dead by their own hand",
  poison: "carried off by poison",
  // Device-review Pass B1 item 3: voluntary abandonment, distinct from every
  // combat/hazard cause above — nobody and nothing killed them.
  abandon: "abandoned mid-delve by their own player",
  // 260919-00d: the Cloak of Ether's window ending inside solid rock.
  entombed: "became a permanent architectural feature",
  // RULES-09 (Phase 75.1): a Pilfer's magic-item fumble blast.
  pilferFumble: "fiddled with a {foe} until it came apart",
  // RULES-10 (Phase 75.1): a fumbled scroll's harm landing on the reader —
  // the heavy blow (every instant-kill fumble) or the burn running them out
  // of hp, either way real hp loss through this one death path.
  scrollFumble: "undone by their own {foe} scroll",
};

// Per-cause list of {placeholder} token names CAUSE_TEXT[cause] requires.
export const CAUSE_TEXT_TOKENS = {
  combat: ["foe"],
  starve: [],
  trap: [],
  teleport: [],
  fall: [],
  gorge: [],
  backfire: [],
  summon: [],
  maze: [],
  quake: [],
  potion: [],
  insanity: [],
  poison: [],
  abandon: [],
  entombed: [],
  pilferFumble: ["foe"],
  scrollFumble: ["foe"],
};
