// content/flavor.js
//
// Pure-data port of mazeworld.html's voice/flavor tables: TEMPERAMENTS,
// MOTIVES, PHOBIAS (~line 738-745), and the Maze Master's per-race/class/
// subclass commentary RACE_NOTE, CLASS_NOTE, SUB_NOTE (~line 1114-1154).
// No closures in the prototype — ported verbatim (sarcastic tone preserved
// unchanged, per the project's voice constraint).

export const TEMPERAMENTS = [
  "Lazy", "Patient", "Joyous", "Angry", "Wary", "Leader", "Edgy", "Zealous", "Greedy", "Thoughtful", "Reckless", "Sensitive",
];

export const MOTIVES = [
  "Adventure", "Status", "Love", "Blood", "Power", "Money", "Fame", "A grudge", "Experience", "Skill", "Knowledge", "Adventure",
];

export const PHOBIAS = [
  { n: "Darkness", t: null }, { n: "Death", t: null }, { n: "Being trapped", t: null },
  { n: "Bodies of water", t: null }, { n: "Bats and rats", t: "Beasts" },
  { n: "Vampires and the undead", t: "Walking Dead" }, { n: "Heights", t: null },
  { n: "Fire", t: "Demons" }, { n: "Sorcery", t: "Magical" }, { n: "Crowds", t: "Humans" },
];

// RULES-11 (Phase 75.2, Plan 04, user ruling 2026-09-25): the Elven,
// Dwarven and Troll entries below are extended to state the net truth
// under the size rule and the user's race-signature ruling (a race's own
// defining trait always survives its own base size step; only an axis the
// trait does not already claim can move). Every existing claim that is
// still true is kept unchanged; only the size clause is new.
export const RACE_NOTE = {
  "Human": "No advantages, no penalties, no excuses. The dungeon keeps humans around the way a kitchen keeps salt — everything else is measured against them. You will die in a manner the Game Master considers statistically unremarkable.",
  // Small's face axis is masked (thin-boned/easy-to-hit already claims it),
  // so being small costs a fixed 2 damage and touches nothing else.
  "Elven": "Thin-boned and carrying not much more than half a person's Hit Points (60%, at every level), so foes get +1 to hit you — but you strike on a die one size smaller than anyone has a right to, and you hit on at least the top five numbers of it whatever the class (16–20 on a d20). Small costs you two points of damage and nothing else; the size rule has nothing left to add to how thin-boned or easy to hit you already were. Shops halve their prices for you (torches, rope and ladders aside), and you can always parley with Humans, which is talking a fight down, at +3 on the roll: most humans treasure the sighting of an elf as a good omen. The elven plan is to kill it before it notices how little you can take. The plan holds until it doesn't.",
  // Small's damage axis is masked (the +2 already claims it), so being
  // small only makes the Dwarf one face harder to hit — the +2 is untouched.
  "Dwarven": "Three extra damage, a single Hit Point a night when the rations run out, and every creature down here swings at you like it has been practising (a die one size smaller, so a level 1 foe rolls a d12) — but your armour shrugs off wear at half the rate everyone else's does, and being small means foes get −1 to hit you besides. Shops halve their prices for you (torches, rope and ladders aside). Built low, built cheap, built to be hit, built to keep the dents. Dwarves call this a fair trade. Dwarves are rarely asked.",
  "Wilmsry": "You heal twice as fast (rest, potions and your own healing spells) and learn half as quickly, so you will survive a great deal and understand almost none of it. You can always parley, which is talking a fight down, with anything but Magical foes and the Walking Dead, at +4 on every parley roll, and shops take 30% off for you: everyone wants to bargain with a Wilmsry. Magic Users despise you on sight, and you return the favour: you will not take a Magic User on as a Joiner, which most Wilmsry take as proof they are doing something right.",
  "Fridgian": "You will not wear armour — which is why there are no Fridgian Samurai — though your hide alone soaks three points off every blow that lands. You will not strike first. Half the time (a 4, 5 or 6 on a d6) you lose the plot entirely and swing twice, the second one wilder (−1 to hit) — and if the first swing finishes the job, the second is simply lost with it. The Game Master has notes about you.",
  // Large points the same way as the Troll's own +9 (dmg+wpnBonus), so
  // nothing is masked: both axes stack in full (+11 damage, foes +1 to hit
  // you). Phase 91 plan 10 (IDENT-21, TEXT-01): 75 starting hit points, the
  // Large +2 inside the 11, the 15 HP unfed night and the +1 to hit are stated.
  "Troll": "75 starting hit points whatever the class, and +11 damage per swing (nine for being a Troll, the Large +2 inside the 11), and an appetite that goes through two rations a night: a night without them costs you 15 HP. The strongest thing on most floors, +1 to hit you for anything down here because you are large, and the first to starve on all of them. Shops charge you double for everything but the tools.",
};

// RULES-10 (Phase 75.1, plan 75.1-07): each note gains one short clause
// stating the new scroll-reading rule (ROADMAP criterion 4). Fighter and
// Thief never mentioned scrolls before this phase; a Magic User's clause
// names the free ride they already had under the old rule too.
//
// ROLL-04 / VOX-04 (Phase 79, Plan 03): the to-hit numbers name the level-1
// d20 range. Phase 91 plan 10 (TEXT-01, user 2026-09-30) drops the "faces"
// wording: a class hits "on 16–20 on the d20 at skill level I", and a
// sub-class or race shift reads "+N to hit" or "foes −N to hit you";
// test/unit/identity-text.test.js pins every number to the engine. The
// mechanics footer under each sub-class and race blurb is generated by
// src/browser/identityFooter.js, never written here.
export const CLASS_NOTE = {
  "Fighter": "The best Hit Points in the book, any armour you can lift, and a hit on 16–20 on the d20 at skill level I, which still means three swings in four hit nothing but corridor. Fighters are the only delvers who die of something other than a mistake. A scroll, for you, is an intelligence roll that can backfire — unless you paid for Runes/Signs.",
  "Thief": "Fifty Hit Points, studded leather at the very best (mail, if you learn Heft), and an opening strike that lands twice as hard as it ought to. Twelve value points of special skills, more than anyone else gets. A thief's plan is to be elsewhere by round three, and thieves are excellent at plans. A scroll is still an intelligence roll that can backfire, no matter how many locks you've picked.",
  "Magic User": "Thirty-six to forty-nine Hit Points, depending on what the d10 pities you with, a staff you cannot really use, and a hit only on 18–20 on the d20 at skill level I, so seventeen swings in twenty are decorative. Everything you are is in the grimoire. No special skills: the book's position is that spells ought to be enough. Every scroll reads for you without fail — the one roll in the whole dungeon you never have to make.",
};

export const SUB_NOTE = {
  "Knight": "Nothing under 5 hp will come near you, and anything with 20 hit points or more comes straight at you — and gets there first. You have been made important by the only creatures whose vote counts: the large ones.",
  "Guard": "No critical strike, ever, and three damage off every blow at level one, one less each level until it is gone at four — but foes get −1 to hit you, every creature down here included. You are a professional. The profession is standing there.",
  "Woodsman": "No mail, no plate — the store won't offer it and your own hands won't take it — and a quarter staff you are genuinely superb with. You can always parley with every beast in here, the Drake included, which is talking a fight down, and every parley you try gets +3 on the roll; whether the Drake listens is the Drake's business.",
  "Soldier": "Foes crit you on 19–20 on a d20 instead of just 20, and you deal criticals never. Camp heals you twice as much. Serve to skill level III and they knight you, swapping your weapon for an Awl Pike, which is the army conceding that the first three levels were a waste of you.",
  "Barbarian": "Two attacks a round and half the experience points, on the sound principle that a man swinging twice is learning nothing either time.",
  "Master of Arms": "Plus two with every weapon ever forged, and every night in camp you hammer the dents out of your own armour. You cannot parley — you attack creatures without question, literally — and you never leave a fight once it starts: no running, no sneaking out, no clever exits. Every battle is fought to the end, yours or theirs. The book files this under abilities.",
  "Samurai": "A magical katana, armour like plate, and enough clatter that you never win the first roll of anything. You never run. The book uses the word suicidal and does not soften it.",
  "Bard": "You sing a random offense or defense spell up to your level, at full strength, no charges spent, and a long fight gets a second song 5 rounds after the first: you pick the moment and the song picks the spell. And you can always parley with Humans, which is talking a fight down: every Human in here will at least hear you out before swinging. Camp for the night and creatures too stupid to know better come looking twice as often, and when a Joiner is along, every foe whose intelligence is no higher than 3 comes for you first, always — which, down here, is most of them.",

  "Pickpocket": "Whenever a chest or a monster hands over an item, you somehow walk away with one extra item as well: a talent, not a miracle. You have never been caught, but every shopkeeper in the maze remembers you all the same — a quarter more to buy from them (torches, rope and ladders cost the same for everyone), a quarter less when you sell. You have never been thanked either.",
  // RULES-09 (Phase 75.1, user 2026-09-24/25): superseded — the heal-only
  // refusal is gone. A Pilfer now uses rings, amulets, cloaks and staves
  // like anyone, but can't quite leave them alone: about one use in twenty,
  // whatever it was comes apart in your hands for a d10 of your own hp and
  // is dust. Potions and scrolls you handle exactly like everyone else.
  "Pilfer": "Traps disarm themselves in your presence and no sealed room has ever held you. Your hands, though, can't leave a magic ring, amulet, cloak or staff alone — use one and, about one time in twenty, it comes apart right there for a d10 of your own hp and is dust. Potions and scrolls you handle like anyone else.",
  "Cat Burglar": "Your first strike of any fight always lands. You also go through every door first and take the full weight of whatever waits behind it: every trap that catches you deals double damage. These two facts are related. You start knowing Dirty Trick for free, which is the only perk anyone has ever mentioned.",
  "Cutthroat": "Double damage on your first landed blow, even in heavy armour and even in the dark, and Joiners will walk beside you all the same — word travels, but so do they. One descent in ten, the one beside you does not reach the next floor, and everyone knows why. Nobody has ever asked you to explain. You have never offered.",
  "Cloaker": "You can vanish for free, right up until you land your first blow, and not even a pursuing Spectre gets a parting swing at your back — after that you flee like everyone else, and you earn precisely nothing from the fight you vanish out of. A Cloaker's career is a long list of encounters that never technically happened.",
  "Ninja": "You never speak — literally; no parley, no fluency, no encounter, ever talks you out of a fight. Your opening strike lands for maximum damage (the Thief's backstab doubles it, unless you are in heavy armour or the dark), and after that you crit on the top two numbers of your strike die (19–20 on a d20), even in the dark. You start knowing Silent Step for free. The silence isn't a vow, it's a tactic.",
  "Con Artist": "You talk first: you can always parley, which is talking a fight down, with anything but Magical foes and the Walking Dead, at +4 on every parley roll, and any level-one foe declines to fight you two times in three, and any level-two foe one time in three. Your first landed blow does no damage at all, because part of you is still hoping to sell them something.",
  "Acrobat": "Foes hit you only on a high roll (17–20 on a d20), you dodge traps on 13–20 on a d20 instead of 16–20, and you may carry nothing but a knife. You hit on 16–20 on a d20 at level 1 like a Fighter (15–20 with the dagger) — nobody armours against a dagger held by someone who will not stand still. You start knowing Smoke for free.",

  "Wizard": "Offense, protection, healing, divination and special, and never Illusion, which the Illusionist keeps for itself like a family recipe. Your thrown offense spells land at +3 to hit. Your book always opens with something that hurts, and you will not raise a hand while an attack spell is left in it; once the book cannot hurt anything, the staff will do. There is only one of you, which the other wizards consider a mercy.",
  "Warlock": "Evil, and productive with it — a potion copied every night it has one, +4 to hit with thrown offense spells, and a standing bonus to every walking dead thing in the room (hit points equal to your level). The dead don't know you're helping. You haven't told them. Evil keeps the books closed on Special and Illusion, and holds protection back until level 4 and healing until level 3.",
  "Sorcerer": "Freeze and Fireball in the book from day one and two more spells each level, with a one-in-eight chance per level of simply forgetting one that isn't fire, frost or lightning. Your thrown offense spells land at +4 to hit, and your Special spells run long: Open/Lock, Fly, Enchant Character and Speed of Sound last 10 squares longer, Stop Time 1 round longer. Your Shield soaks 5 more HP and your Bubble's film holds 5 more. Healing waits until level 4, Illusion is closed to you for good, and your arm caps out at 9 damage. Nobody hired the arm.",
  "Court Mage": "You talk. Through encounters, through corridors, through other people's turns — you can always parley with Humans, which is talking a fight down, and when a fight actually starts, everyone else gets there first. One creature in six dies of boredom before it comes to that, and the book counts that as a kill. Your thrown offense spells land at +2 to hit, your healing spells heal 1 more, your Shield soaks 10 more HP and your Bubble's film holds 10 more, divination waits until level 4, and Special and Illusion are closed to you for good.",
  "Illusionist": "Step on a teleport square and you choose where it puts you: any explored floor square up to 12 squares away in the eight directions, or let it choose, which in a dungeon is very close to owning the floor. Three illusions from day one (Mirror Self, Door Illusion and one more), and a d20 to strike until level three — let the mirror do the hitting. Your Special spells run very long (40 squares longer, Stop Time 4 rounds longer), your Senseless and Duplicate Foe last 1 round longer, protection waits until level 3, and healing is closed to you for good: the mirror can't bandage anyone.",
  "Cleric": "Healing, chain mail and a better aim than the rest of the book: your healing spells heal 4 more and you get +1 to hit over other Magic Users (17–20 on a d20 at level 1). You start in chain mail, with Heal always on the first page, and your Shield soaks 15 more HP and your Bubble's film holds 15 more. The gods approve of mending and have ruled out fireballs: you can never learn offense (except Strength), special or illusion spells, so no offense spell but Strength ever lands in your book (the gods count being stronger as a blessing, not an attack) — though a scroll will still fire one, because the gods do not proofread scrolls. Divination waits until level 3. The gods have rounded up.",
  // VOX-04 (Phase 79, Plan 03): the user's Pixel 7 report ("summoner
  // description doesn't mention...") — the 2026-09-25 healing weakness is in the
  // prose too. Phase 90 plan 06 (SPELL-12): the small Lesser Summon is gone; the
  // full Summon answers from the very first day.
  "Summoner": "A Summon is always in your book, and you can call it from your very first day (everyone else waits for level 2) — a full Summon, a level stronger and longer-lived than anyone else's, and one time in eight it arrives on the wrong side. Your Special spells run long (10 squares longer, Stop Time 1 round longer), your Shield soaks 10 more HP and your Bubble's film holds 10 more, your own healing spells heal at half strength, and Illusion is closed to you for good. The book declines to say whose fault any of that is.",
  "Apprentice": "Double experience points until level three, one of your spells in eight goes off in your hands, and at level three you finally roll to discover what you actually are. You may learn Illusion spells, which no other Magic User but the Illusionist can, and divination waits until level 3. Assuming you get there.",
};

/**
 * COMPASS_WORD — Phase 91 (IDENT-14): the words for the eight rays an
 * Illusionist's teleport pick runs along (engine/movement.js#TELEPORT_DIRS),
 * for the Oracle and the rail. One table so both surfaces say the same word.
 */
export const COMPASS_WORD = Object.freeze({
  N: "north",
  NE: "north-east",
  E: "east",
  SE: "south-east",
  S: "south",
  SW: "south-west",
  W: "west",
  NW: "north-west",
});

/**
 * JOINER_EXIT_LINES — Phase 25.1 DFB-04: the snark exit lines for a
 * departing party member when a full roster accepts a new Joiner
 * (engine/state.js#swapPartyMember). `{name}` is the member who leaves,
 * `{new}` is the newcomer arriving; picked by src/browser/eventNarration.js
 * WITHOUT rng (an index derived from both names' lengths — deterministic,
 * zero engine draw). Family-friendly sarcasm, scanned by
 * test/voice/safety-scan.test.js.
 */
export const JOINER_EXIT_LINES = [
  "{name} has heard how this ends and would rather it end for someone else.",
  "{name} takes one look at {new}, does the arithmetic, and walks.",
  "{name} wishes {new} the very best, from a safe and steadily increasing distance.",
  "{name} has seen how this goes and would rather not be the one it goes to.",
  "{name} leaves without a fuss. Somewhere out there is a longer life expectancy, and {name} intends to find it.",
];

/**
 * JOINER_MURDER_LINES — Phase 36 CUT-02: the Cutthroat's per-descent Joiner
 * risk (a natural 1 on a d10, one descent in ten since Phase 91 plan 08,
 * IDENT-19; it was a d20). `{name}` is the
 * victim, `{depth}` the floor arrived on; picked by
 * src/browser/eventNarration.js WITHOUT rng, from name length + depth.
 * Family-friendly sarcasm — the joke is the Cutthroat's reputation, never
 * the body; scanned by test/voice/safety-scan.test.js.
 */
export const JOINER_MURDER_LINES = [
  "Somewhere between floors, {name} had an accident. You were the accident.",
  "{name} did not make it down the stairs. The stairs were not the problem.",
  "You arrive on floor {depth} one companion lighter. {name} would have objected, given the chance.",
  "{name} stopped to admire the stonework on the way down. That is the official version, and you are sticking to it.",
  "Old habits. {name} stayed behind on the stairs, and will be staying.",
  "Travelling beside a Cutthroat is mostly arithmetic, and {name} has just been subtracted.",
];

/**
 * JOINER_PARTING_LINES — Phase 36 JOIN-01: the sarcastic parting line for a
 * Joiner sent away from the Hero tab's Company panel. `{name}` is the
 * member dismissed; picked by src/browser/eventNarration.js WITHOUT rng,
 * from the name length. The Joiner gets the last word. Family-friendly
 * sarcasm, scanned by test/voice/safety-scan.test.js.
 */
export const JOINER_PARTING_LINES = [
  "{name} takes the news well, by which we mean they were already walking away.",
  "{name} thanks you for the opportunity and means none of it.",
  "{name} leaves at once, which is the first quick decision anyone has made down here.",
  "{name} wishes you the best. {name} has met the best. The two are not expected to overlap.",
  "{name} goes without a word, having saved several for the tavern.",
];

/**
 * RACE_FLAVOR and CLASS_FLAVOR — Phase 96 (FLAVOR-03; CONTEXT 'Race, sub-class
 * and class blurbs'): the player line for each race and class.
 *
 * The exact RACE_NOTE, CLASS_NOTE and the mechanical footer stay where they
 * are, pinned byte for byte by the identity guards, and show under RULES. These
 * maps are keyed by name beside the content and never put on a row or in a
 * save. Every line is up to two sentences and at most 200 characters, with no
 * number, die or percentage. Each race entry is `{ line, good, bad }`: the ids
 * are identityEntries ids from src/browser/identityFooter.js that the wording
 * hints at (Human is the neutral yardstick and carries `neutral` alone).
 * test/unit/identity-flavor.test.js checks every tag is a real id of the right
 * side. Reviewed on docs/narrative-pass/review.html.
 */
export const RACE_FLAVOR = Object.freeze({
  "Human": Object.freeze({
    line: "No perks, no penalties and no excuses: the yardstick every other race is measured against, and the one the dungeon forgets first.",
    good: Object.freeze([]),
    bad: Object.freeze([]),
    neutral: "human-neutral",
  }),
  "Elven": Object.freeze({
    line: "Shopkeepers adore you, Humans hear you out and your aim is rude. Then anything lands a blow and you remember how little of you there is, and how easy to hit.",
    good: Object.freeze(["elven-prices", "elven-humans", "race-to-hit"]),
    bad: Object.freeze(["race-hp-mul", "race-foe-to-hit"]),
  }),
  "Dwarven": Object.freeze({
    line: "Cheap in the shops, slow to starve, heavy of hand and kind to your armour. Everything in here swings at you as if it had been practising, which the dwarves call a fair trade.",
    good: Object.freeze(["dwarven-prices", "race-upkeep", "race-dmg", "race-armor-wear"]),
    bad: Object.freeze(["race-foe-strike-step"]),
  }),
  "Wilmsry": Object.freeze({
    line: "Everyone wants to haggle with you, you mend like a lizard and you can talk down nearly anything. You will not take a Magic User along, and you learn so slowly that survival teaches you nothing.",
    good: Object.freeze(["wilmsry-talk", "wilmsry-haggle", "race-heal2x"]),
    bad: Object.freeze(["wilmsry-joiners", "race-sp-mul"]),
  }),
  "Fridgian": Object.freeze({
    line: "No armour, no Samurai career and no say in who strikes first, but a hide like a boot and a habit of losing the plot and swinging again. The Game Master has notes.",
    good: Object.freeze(["race-frenzy", "race-hide"]),
    bad: Object.freeze(["race-no-armor", "race-no-samurai", "race-slow"]),
  }),
  "Troll": Object.freeze({
    line: "Sturdy from the first step and brutal with every swing. Shops overcharge you, foes find you easy to hit and your appetite is a municipal problem.",
    good: Object.freeze(["race-flat-hp", "race-dmg"]),
    bad: Object.freeze(["troll-prices", "race-size-face", "race-eats"]),
  }),
});

export const CLASS_FLAVOR = Object.freeze({
  "Magic User": "Fragile, unarmoured by temperament and entirely in the grimoire's hands: the spells are the class, and everything else is decoration.",
  "Fighter": "Hit points, heavy armour and a poor opinion of spellbooks: the Fighter stands in the doorway and takes it, which is the whole job description.",
  "Thief": "Light on hit points and lighter on armour, but the only class with a full toolbox of skills. The plan is to be somewhere else when it matters, and the toolbox is how.",
});

/**
 * SUB_FLAVOR — Phase 96 (FLAVOR-03; CONTEXT 'Race, sub-class and class
 * blurbs'): the player line for each of the 24 sub-classes, in CLASSES order.
 *
 * Same contract as RACE_FLAVOR: the exact SUB_NOTE and the mechanical footer
 * stay where they are, pinned byte for byte by the identity guards, and show
 * under RULES. This map is keyed by sub-class name beside the content and never
 * put on a row or in a save. Every line is up to two sentences and at most 200
 * characters, with no number, die or percentage. Each entry is
 * `{ line, good, bad }`: the ids are identityEntries ids (authored traits, the
 * generated Magic User chart lines and the free skill) that the wording hints
 * at. test/unit/identity-flavor.test.js checks every tag is a real id of the
 * right side. Reviewed on docs/narrative-pass/review.html.
 */
export const SUB_FLAVOR = Object.freeze({
  "Wizard": Object.freeze({
    line: "Your book opens with something that hurts, and your aim is good, but you refuse to lift a weapon while a spell remains. Illusion, meanwhile, is the Illusionist's, like a family recipe.",
    good: Object.freeze(["wizard-day-one","chart-bonus-offense"]),
    bad: Object.freeze(["wizard-melee","chart-never"]),
  }),
  "Warlock": Object.freeze({
    line: "Evil, and productive with it: a potion copied by night and a thrown spell that lands. The walking dead in the room grow sturdier on your account, and healing and warding come late.",
    good: Object.freeze(["warlock-potion","chart-bonus-offense"]),
    bad: Object.freeze(["warlock-undead","chart-gate-protection","chart-gate-healing"]),
  }),
  "Sorcerer": Object.freeze({
    line: "Freeze and Fireball from day one, spells by the handful and a very sure aim, but now and then one simply falls out of your head. The arm is decorative, and Illusion is none of your business.",
    good: Object.freeze(["sorcerer-book","sorcerer-levels","chart-bonus-offense"]),
    bad: Object.freeze(["sorcerer-forgets","sorcerer-arm","chart-never"]),
  }),
  "Summoner": Object.freeze({
    line: "Your Summon is in the book from the first day, and it arrives bigger and longer-lived than anyone else's. Now and then it turns up on the wrong side, and your own healing is feeble.",
    good: Object.freeze(["summoner-summon","summoner-doubled","chart-override-Summon"]),
    bad: Object.freeze(["summoner-backfire","chart-healmul"]),
  }),
  "Cleric": Object.freeze({
    line: "Chain mail, a better aim than the rest of the book and healing that actually heals. The gods have ruled out fireballs, illusions and anything else fun, and the foresight comes late.",
    good: Object.freeze(["cleric-mail","cleric-hit","chart-bonus-healing"]),
    bad: Object.freeze(["chart-never","chart-gate-divination"]),
  }),
  "Illusionist": Object.freeze({
    line: "Teleport squares go where you point them and the mirrors are in the book from day one. Your own swing is a rumour, warding comes late and the mirror cannot bandage anyone.",
    good: Object.freeze(["illusionist-teleport","illusionist-book"]),
    bad: Object.freeze(["illusionist-d20","chart-gate-protection","chart-never"]),
  }),
  "Court Mage": Object.freeze({
    line: "You talk Humans down, bore the occasional foe to death and shield and mend a little better than most. When a fight does start, everyone else gets there first, and special and illusion are closed.",
    good: Object.freeze(["court-mage-boredom","court-mage-humans","chart-bonus-protection","chart-bonus-healing"]),
    bad: Object.freeze(["court-mage-first","chart-never"]),
  }),
  "Apprentice": Object.freeze({
    line: "You gain experience at a ferocious rate and may even dabble in Illusion. Now and then a spell goes off in your own hands, and foresight comes late, assuming you get that far.",
    good: Object.freeze(["apprentice-xp","apprentice-illusion"]),
    bad: Object.freeze(["apprentice-backfire","chart-gate-divination"]),
  }),
  "Knight": Object.freeze({
    line: "Anything small runs before it can try, and anything large gets there first. You have been made important by the only creatures whose vote counts.",
    good: Object.freeze(["knight-small"]),
    bad: Object.freeze(["knight-big"]),
  }),
  "Guard": Object.freeze({
    line: "Foes miss you more often, which is as well, because your blows are feeble and never land a lucky one. You are a professional, and the profession is standing there.",
    good: Object.freeze(["guard-hard"]),
    bad: Object.freeze(["guard-weak","guard-nocrit"]),
  }),
  "Woodsman": Object.freeze({
    line: "Every beast in here will at least hear you out, with a bonus, and you carry a staff like an old friend. Mail and plate are out: the store won't offer it and your hands won't take it.",
    good: Object.freeze(["woodsman-talk"]),
    bad: Object.freeze(["woodsman-armor"]),
  }),
  "Soldier": Object.freeze({
    line: "Camp mends you generously and the army eventually knights you, trading your weapon for the privilege. Foes find your weak spots easily, and you never find theirs.",
    good: Object.freeze(["soldier-camp","soldier-knighted"]),
    bad: Object.freeze(["soldier-crit","soldier-nocrit"]),
  }),
  "Barbarian": Object.freeze({
    line: "You swing and swing again every round, on the sound principle that a man swinging this much is learning nothing. The experience points agree, and are docked accordingly.",
    good: Object.freeze(["barbarian-two"]),
    bad: Object.freeze(["barbarian-xp"]),
  }),
  "Master of Arms": Object.freeze({
    line: "Every weapon hits harder in your hands and you hammer your own dents out each night. You never talk anyone down and you never leave a fight after it starts: no running, no clever exits.",
    good: Object.freeze(["moa-damage","moa-patch"]),
    bad: Object.freeze(["moa-parley","moa-never-leaves"]),
  }),
  "Samurai": Object.freeze({
    line: "Plate and a magical katana, and enough clatter that you never act first. You never run either: the book uses the word suicidal and does not soften it.",
    good: Object.freeze(["samurai-kit"]),
    bad: Object.freeze(["samurai-never"]),
  }),
  "Bard": Object.freeze({
    line: "You sing a different spell every time, free, and any Human will at least hear you out. Camp draws crowds, and with a Joiner along the dim ones all come for you first.",
    good: Object.freeze(["bard-song","bard-humans"]),
    bad: Object.freeze(["bard-camp","bard-target"]),
  }),
  "Pickpocket": Object.freeze({
    line: "Chests and monsters somehow hand over a little extra. Shopkeepers remember you all the same, charging more and paying less, and you have never been thanked.",
    good: Object.freeze(["pickpocket-item"]),
    bad: Object.freeze(["pickpocket-shops"]),
  }),
  "Pilfer": Object.freeze({
    line: "Traps give up and chests fall open at your approach. Your hands, however, cannot leave a magic ring or staff alone, and now and then it comes apart and takes some of you with it.",
    good: Object.freeze(["pilfer-traps"]),
    bad: Object.freeze(["pilfer-fumble"]),
  }),
  "Cat Burglar": Object.freeze({
    line: "Your first strike always lands and you start knowing Dirty Trick. You also go through every door first, and every trap that catches you hurts far worse than it should.",
    good: Object.freeze(["cat-burglar-first","free-skill"]),
    bad: Object.freeze(["cat-burglar-traps"]),
  }),
  "Cutthroat": Object.freeze({
    line: "Your first blow always lands hard, armour or no armour, lamp or no lamp. Joiners still walk beside you, but now and then one does not reach the next floor, and nobody asks.",
    good: Object.freeze(["cutthroat-crit"]),
    bad: Object.freeze(["cutthroat-joiner"]),
  }),
  "Cloaker": Object.freeze({
    line: "You vanish from any fight for free, right up until you land a blow, Spectres included. After that you run like everyone else, so the career is mostly encounters that never technically happened.",
    good: Object.freeze(["cloaker-vanish"]),
    bad: Object.freeze(["cloaker-seen"]),
  }),
  "Ninja": Object.freeze({
    line: "Your opening strike lands for the maximum, later ones find the weak spots, and you start with Silent Step. The silence is a tactic, but it means no fight is ever talked down.",
    good: Object.freeze(["ninja-opener","ninja-crit","free-skill"]),
    bad: Object.freeze(["ninja-silent"]),
  }),
  "Con Artist": Object.freeze({
    line: "You talk first, and most small foes decline to fight you at all. Your opening blow does nothing, since part of you is still hoping to sell them something.",
    good: Object.freeze(["con-artist-talk","con-artist-leave"]),
    bad: Object.freeze(["con-artist-opener"]),
  }),
  "Acrobat": Object.freeze({
    line: "Foes rarely land a hit, traps rarely land either, and you strike like a Fighter. You may carry nothing but a knife, and you start knowing Smoke.",
    good: Object.freeze(["acrobat-dodge","acrobat-traps","acrobat-hit","free-skill"]),
    bad: Object.freeze(["acrobat-dagger"]),
  }),
});

/**
 * CHIP_FLAVOR — Phase 96 (FLAVOR-04; CONTEXT 'Abilities and chips: Condition
 * chips'): the player line a condition chip's tap card leads with.
 *
 * The exact CONDITION_EXPLAIN text, the measured effect lead and the "how long,
 * from where" tail stay in the shell (mazeworld.html) and show under RULES; this
 * map is keyed by chip key beside the content and never put on a row or in a
 * save. The first 42 keys are the HERO_CONDITIONS keys in their emit order; the
 * last five are variant keys for the explanations that differ by kind or source
 * (a dazed or weakened foe effect, a stopped heroOut, an armed Bubble mirror, a
 * Speed of Sound haste). An ability chip uses its ability's own line instead
 * (flavorOfChip). Every line is one sentence of at most 100 characters, with no
 * number, die or percentage, and points the way its explanation does: a harmful
 * chip still says something is wrong, a timed buff does not read as lasting.
 * Reviewed on docs/narrative-pass/review.html.
 */
export const CHIP_FLAVOR = Object.freeze({
  "haste": "Quick enough that the rest of the round looks like it is wading through porridge.",
  "invis": "The foes are attacking a spot you just left, and cannot work out why it keeps happening.",
  "acute": "Your aim has sharpened into something faintly unfair, and the maze has noticed.",
  "ether": "Walls are optional for now, so choose where you stand before the rock starts caring again.",
  "enlarge": "Grown well past your size by magic, which is wonderful for swinging and awful for hiding.",
  "giant": "A giant's gauntlet lends you stature: bigger blows, and a bigger thing for the foes to aim at.",
  "glow": "You glow like a nightlight with ambitions, so the dark has no say in how you swing.",
  "unseen": "Foes can only just make you out, which spoils their aim a little and their mood a lot.",
  "tongue": "You speak every tongue the maze has, which helps whenever the foes can be talked to at all.",
  "critWard": "Luck worn like armour: the foe's very best swing lands as merely a rude one.",
  "plate": "Your cloak does a fair impression of plate armour, without the clanking or the repair bills.",
  "power": "A ring's idea of generosity: every swing lands with a little extra on it.",
  "lit": "A lit torch in your fist, so the dark can wait its turn to ruin your aim.",
  "knit": "The cloak is slowly stitching you back together, provided you keep walking and stop dawdling.",
  "flight": "Off the ground and above the problem, for exactly as long as the magic holds up.",
  "strength": "Muscle on loan, and every strike and spell that connects gets to spend it.",
  "unlock": "The next locked chest gives in at a touch, and then the magic is spent.",
  "enchant": "A charm over you: you swing true, they swing wild, and nobody gets a lucky strike.",
  "ability": "One of your tricks is still running, with the particulars on the ability itself.",
  "might": "Strong in a way you did not plan, whether from a potion or a temper, so hit something.",
  "ward": "Borrowed hit points stand between you and the blows, right up until they run dry.",
  "mirror": "A flickering second you, so foes swing at the wrong one and mostly hit the air.",
  "senses": "Every living thing nearby tickles your nerves, so darkness and ambushes matter far less.",
  "regen": "Your body has decided to heal as you go, for this fight at least, and asked no permission.",
  "foresight": "A twinge of warning means you get the first move when trouble next turns up.",
  "reveal": "The whole floor lies open to you, but only while you stand still and keep staring.",
  "braced": "Ready for the next hit and almost looking forward to it, which takes much of the sting out.",
  "halfNext": "Your pendant is lined up to soften the next blow that lands, and fully expects credit.",
  "nightVision": "Born with eyes for it, you treat the dark as scenery and fight in it without complaint.",
  "itemCooldown": "The item is sulking after its last use and will come round if you keep walking.",
  "staffCharges": "The staff is topping up its magic, slowly, and does not care to be hurried.",
  "affliction": "Something nasty in the blood nibbles at you with every step, though never quite finishes the job.",
  "foeEffect": "Something nasty a foe did to you is hanging about, though it will not stay long.",
  "darkness": "The dark has closed in, so you see hardly a thing and swing worse until a light or time ends it.",
  "fearArmed": "Something out there rattled you, and the next fight will open with your knees knocking.",
  "afraid": "Fear has got into your hands: blows go astray and land weakly until your nerve returns.",
  "heroOut": "Out of action, with nothing able to wake you early, and the foes entirely at their leisure.",
  "heroBlind": "Your sight has packed up, and only the luckiest swings find anything to hit.",
  "heroShrunk": "Shrunk by a scroll gone wrong, your blows land with all the force of a stern letter.",
  "fightDark": "Swinging in the gloom is mostly guesswork, so blows land less often and never spectacularly.",
  "insulted": "Rude things were said, and now every foe aims at you with unusual enthusiasm.",
  "selfDot": "A scroll gone wrong is still burning, and it will keep at you each round until it tires.",
  "foeEffect/dazed": "Your head is full of bells, so swings go wide until the ringing stops.",
  "foeEffect/weakened": "Your arms have turned to wet rope, and blows land feebly until it passes.",
  "heroOut/stopped": "Time stopped around you, and you with it, which the foes find very convenient.",
  "ward/mirror": "A polished bubble waits to send the next blow back to its sender, with padding afterwards.",
  "haste/Speed of Sound": "You move ahead of your own sound, swinging first and often, and the din arrives afterwards.",
});
