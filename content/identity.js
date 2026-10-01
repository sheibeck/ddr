// content/identity.js
//
// VOX-04 (Phase 79, Plan 03): IDENTITY_TRAITS — the advantages and
// disadvantages of each sub-class and race that NO rules table holds.
//
// CONTEXT decision (user accepted 2026-09-25): "keep each SUB_NOTE/
// RACE_NOTE's sarcastic prose, and add a compact MECHANICAL FOOTER under
// each blurb, generated FROM the rules tables so prose and rules can never
// drift." src/browser/identityFooter.js builds that footer: it reads
// MU_CHART (school bonuses, gates, never-learned schools, healMul),
// SPELL_LEVEL_OVERRIDES and the RACES fields itself, and merges in the rows
// below for every rule that lives in engine code keyed on a sub-class or
// race name (a Wizard's melee refusal, a Knight's big-foe rule, a Troll's
// store prices).
//
// Every trait names its proof: `proof.file` is a repo-relative test file and
// `proof.contains` a string that file holds (an identity-contract half's
// `name`, or another test's title). test/unit/identity-footer.test.js fails
// when a proof is missing, so a trait cannot outlive the rule it states.
//
// Plain player language: HP (never WP), the U+2212 minus for any negative,
// and a die that scales with level speaks in faces ("your top four faces"),
// never in a single low face (ROLL-04). Pure, frozen, JSON-serializable data.

const trait = (id, text, file, contains) => Object.freeze({ id, text, proof: Object.freeze({ file, contains }) });
const side = (good, bad) => Object.freeze({ good: Object.freeze(good), bad: Object.freeze(bad) });

const CONTRACT = "test/unit/identity-contract.test.js";
const FOOTER = "test/unit/identity-footer.test.js";

export const IDENTITY_TRAITS = Object.freeze({
  sub: Object.freeze({
    // ---------------- Magic User ----------------
    "Wizard": side(
      [trait("wizard-day-one", "always starts with a level 1 direct-damage spell it can cast on day one", "test/unit/wizard-day-one.test.js", "IDENT-13: every new Wizard holds a castable direct-damage level-1 spell on day one, seeds 1 to 1000")],
      [trait("wizard-melee", "won't swing a weapon while a castable attack spell and a charge remain", CONTRACT, "refuses to melee while a castable attack spell sits unused")],
    ),
    "Warlock": side(
      [trait("warlock-potion", "copies a potion every night it has one", CONTRACT, "a nightly potion duplicates itself")],
      [trait("warlock-undead", "every Walking Dead foe in the fight gains HP equal to your level", CONTRACT, "props up every Walking Dead foe in the room")],
    ),
    "Sorcerer": side(
      [
        trait("sorcerer-book", "starts with Freeze and Fireball in the book", CONTRACT, "a grimoire guaranteed to carry Freeze and Fireball"),
        trait("sorcerer-levels", "learns two new spells at every level", "test/unit/character.test.js", "checkLevel: a Sorcerer gains spells on level up"),
      ],
      [
        trait("sorcerer-arm", "weapon damage never goes above 9", CONTRACT, "a Sorcerer's own arm caps at 9 damage"),
        trait("sorcerer-forgets", "one level-up in eight forgets a spell that isn't Freeze, Fireball or Lightning", FOOTER, "identity-proof: a Sorcerer forgets one spell that isn't Freeze, Fireball or Lightning on a level-up d8 of 1"),
      ],
    ),
    "Summoner": side(
      [
        trait("summoner-summon", "a Summon is always in the book from day one", CONTRACT, "a full Summon on day one — Summon is guaranteed and castable at level 1"),
        trait("summoner-doubled", "a full Summon arrives a level stronger, and its duration die counts double", "test/unit/casters-can-act.test.js", "IDENT-03: a level-2 Summoner summons in combat with the unchanged doubled formula"),
      ],
      [trait("summoner-backfire", "one full Summon in eight turns on you", CONTRACT, "the summon backfire stays")],
    ),
    "Cleric": side(
      [
        trait("cleric-heal", "every healing spell heals 3 more", CONTRACT, "heals 3 more than anyone else, rolls 4 to hit"),
        trait("cleric-hit", "your top four faces hit, not a Magic User's three", CONTRACT, "heals 3 more than anyone else, rolls 4 to hit"),
        trait("cleric-heal-start", "always starts with Heal in the book", "test/unit/cleric-offense-ban.test.js", "IDENT-15: every new Cleric holds Heal and can cast it on day one, seeds 1 to 1000"),
      ],
      [],
    ),
    "Illusionist": side(
      [
        trait("illusionist-teleport", "you choose where every teleport lands: any explored floor square up to 12 away in the 8 directions, or let it choose", "test/unit/teleport-pick.test.js", "Pick: teleportPick on a listed diagonal square lands there through the one landing function"),
        trait("illusionist-book", "starts with Mirror Self, Door Illusion and one random Illusion spell", "test/unit/illusionist-book.test.js", "a new Illusionist's book holds Mirror Self, Door Illusion and at least one other Illusion spell, on every seed 1-500"),
      ],
      [trait("illusionist-d20", "strikes on a d20 until level 3", CONTRACT, "strikes on a d20 until level three")],
    ),
    "Court Mage": side(
      [
        trait("court-mage-boredom", "one foe in six dies of boredom before the fight starts", CONTRACT, "boredom kills 1-in-6 (d12 <= 2); always parleys Humans"),
        trait("court-mage-humans", "can always parley with Humans", CONTRACT, "boredom kills 1-in-6 (d12 <= 2); always parleys Humans"),
      ],
      [trait("court-mage-first", "foes act first in round one", CONTRACT, "you talk first — foes act first in round one only")],
    ),
    "Apprentice": side(
      [trait("apprentice-xp", "double experience from kills until level 3", CONTRACT, "double skill points off a kill at level one")],
      [trait("apprentice-backfire", "one spell in eight backfires", CONTRACT, "one spell in eight backfires")],
    ),

    // ---------------- Fighter ----------------
    "Knight": side(
      [trait("knight-small", "any foe under 5 HP flees before it can act", CONTRACT, "beneath the notice of small things — a foe under 5 maxWP flees before it can act")],
      [trait("knight-big", "never wins initiative against a foe with 20 HP or more", CONTRACT, "everything over 20 comes straight at you — never wins initiative vs a live maxWP >= 20 foe")],
    ),
    "Guard": side(
      [trait("guard-hard", "every foe lands on one face fewer against you", CONTRACT, "the profession is standing there — every foe needs one better to land a blow")],
      [
        trait("guard-weak", "your blows deal 3 less at level 1, one less each level until level 4", CONTRACT, "a Guard's own blow is weaker and never crits"),
        trait("guard-nocrit", "your blows never crit", CONTRACT, "a Guard's own blow is weaker and never crits"),
      ],
    ),
    "Woodsman": side(
      [trait("woodsman-talk", "can always parley with Beasts and Lair Beasts; +3 on every parley roll", CONTRACT, "the professional forester — parleys Beasts and Lair Beasts, refused for Humans")],
      [trait("woodsman-armor", "no armour heavier than Studded", CONTRACT, "no mail, no plate — refused anything heavier than Studded")],
    ),
    "Soldier": side(
      [
        trait("soldier-camp", "camp heals you twice as much", CONTRACT, "camp heals a Soldier twice as fast"),
        trait("soldier-knighted", "knighted at level 3", "test/unit/character.test.js", "checkLevel: a Soldier is knighted at level 3"),
      ],
      [
        trait("soldier-crit", "foes crit you on their top two faces, not just the top one", CONTRACT, "a foe's roll of 2 crits a Soldier, doubling the dice"),
        trait("soldier-nocrit", "your blows never crit", "test/unit/afraid.test.js", "a noCrit Soldier rolling a natural 1 still just halves"),
      ],
    ),
    "Barbarian": side(
      [trait("barbarian-two", "two attacks every strike", CONTRACT, "two attacks every strike")],
      [trait("barbarian-xp", "half the experience from every kill", CONTRACT, "half skill points off a kill")],
    ),
    "Master of Arms": side(
      [
        trait("moa-damage", "+2 damage with every weapon", CONTRACT, "plus two with every weapon ever forged"),
        trait("moa-patch", "patches your own damaged armour every night in camp", "test/unit/movement.test.js", "newDay: a Master of Arms fighter (no Sewing) patches d6+3 armour"),
      ],
      [
        trait("moa-parley", "can never talk a fight down", CONTRACT, "cannot parley, ever; never leaves a fight"),
        // Phase 91 plan 05 (IDENT-16): replaces moa-withdraw (the round-1 withdrawal denial cost nothing: nothing sets C.tracked).
        trait("moa-never-leaves", "never leaves a fight once it starts: no running, no withdrawal, no escape", "test/unit/moa-never-leaves.test.js", "(1) flee: a Master of Arms is refused in a tracked round 1"),
      ],
    ),
    "Samurai": side(
      [trait("samurai-kit", "starts in plate with a magic katana (+2)", CONTRACT, "born in plate, wielding a magic katana — chargen invariants")],
      [trait("samurai-never", "never wins initiative and never flees", CONTRACT, "never wins initiative, never runs")],
    ),
    "Bard": side(
      [
        trait("bard-humans", "can always parley with Humans", CONTRACT, "courtly enough to talk to anyone — parleys Humans at fluency 0"),
        // Phase 91 plan 06 (IDENT-17, user 2026-09-30): replaces "a song every 100 squares".
        trait("bard-song", "sings once per fight: a random offense or defense spell up to your level, at full strength, no charges spent", "test/unit/bard-song.test.js", "IDENT-17 once per fight: songReady is true only for a Bard in a live joined fight that has not sung"),
      ],
      [
        trait("bard-camp", "camp wakes wandering monsters twice as often", CONTRACT, "camp wakes wandering monsters twice as often; dumb foes come for the Bard"),
        // Phase 91 plan 06 (IDENT-17): the ruling's own words, said plainly (pickFoeTarget: intelligence 3 or less).
        trait("bard-target", "foes with intelligence no higher than 3 always attack you when a Joiner is in the fight", CONTRACT, "camp wakes wandering monsters twice as often; dumb foes come for the Bard"),
      ],
    ),

    // ---------------- Thief ----------------
    "Pickpocket": side(
      [trait("pickpocket-take", "an extra take from every kill and chest", CONTRACT, "an extra take off every kill/chest")],
      [trait("pickpocket-shops", "shops charge you a quarter more and pay a quarter less", CONTRACT, "shopkeepers know your face — buys x1.25, sells x0.75")],
    ),
    "Pilfer": side(
      [trait("pilfer-traps", "disarms every trap and opens every chest for free", CONTRACT, "disarms every trap, opens every chest for free")],
      [trait("pilfer-fumble", "about one use in twenty, a magic ring, amulet, cloak or staff blows up in your hands for d10 HP and is gone", CONTRACT, "fumbles a magic item on a 1 in 20: it blows up in their hands and turns to dust")],
    ),
    "Cat Burglar": side(
      [trait("cat-burglar-first", "your first strike of every fight always lands", CONTRACT, "the first strike of any fight always lands")],
      [trait("cat-burglar-traps", "every trap that catches you deals double damage", CONTRACT, "every trap that catches a Cat Burglar deals double damage")],
    ),
    "Cutthroat": side(
      [trait("cutthroat-crit", "your first landed blow always crits, even in heavy armour", CONTRACT, "the first landed blow always crits, even in armor a backstab would refuse")],
      [trait("cutthroat-joiner", "one descent in twenty, the Joiner beside you doesn't reach the next floor", CONTRACT, "one descent in twenty, the Joiner beside you does not reach the next floor")],
    ),
    "Cloaker": side(
      [trait("cloaker-vanish", "vanishes from any fight for free until you land a blow", CONTRACT, "a free vanish while nobody has seen your face")],
      [trait("cloaker-seen", "once you've struck, you flee on the ordinary roll like everyone else", CONTRACT, "once seen, the vanish is denied — a distinct scenario from the good's")],
    ),
    "Ninja": side(
      [
        trait("ninja-opener", "your opening strike always lands for maximum damage", CONTRACT, "the opener always lands for max weapon damage; a later roll of 2 crits"),
        trait("ninja-crit", "after that, your top two faces crit", CONTRACT, "the opener always lands for max weapon damage; a later roll of 2 crits"),
      ],
      [trait("ninja-silent", "can never talk a fight down", CONTRACT, "you never speak — canParley is false unconditionally")],
    ),
    "Con Artist": side(
      [
        trait("con-artist-talk", "can always parley with anything but Magical foes and the Walking Dead; +4 on every parley roll", CONTRACT, "can talk anyone down except Magical/Walking Dead, and a weak foe leaves before the fight starts"),
        trait("con-artist-leave", "a level 1 foe leaves before the fight two times in three", CONTRACT, "can talk anyone down except Magical/Walking Dead, and a weak foe leaves before the fight starts"),
      ],
      [trait("con-artist-opener", "your opening blow deals no damage", CONTRACT, "the opening blow is a warning, not an injury")],
    ),
    "Acrobat": side(
      [
        trait("acrobat-dodge", "foes land only on their top four faces", CONTRACT, "harder to land a blow on, easier to land one"),
        trait("acrobat-hit", "your top five faces hit, like a Fighter's (six with the dagger)", CONTRACT, "harder to land a blow on, easier to land one"),
      ],
      [trait("acrobat-dagger", "a dagger and nothing else", CONTRACT, "a dagger, and only a dagger")],
    ),
  }),

  race: Object.freeze({
    // Human is the yardstick: no good, no bad, one neutral line.
    "Human": Object.freeze({
      good: Object.freeze([]),
      bad: Object.freeze([]),
      neutral: trait("human-neutral", "No advantages and no disadvantages: every other race is measured against this one.", CONTRACT, "the neutral control — no race modifier anywhere"),
    }),
    "Elven": side(
      [
        trait("elven-prices", "store prices halved", "test/unit/economy.test.js", "priceFor: triples for a Troll, halves (rounded) for Elven/Dwarven, unchanged otherwise"),
        trait("elven-humans", "can always parley with Humans, +3 on that parley roll", "test/unit/rollDirection-checks.test.js", "[parley:elven-humans]"),
      ],
      [],
    ),
    "Dwarven": side(
      [trait("dwarven-prices", "store prices halved", "test/unit/economy.test.js", "priceFor: triples for a Troll, halves (rounded) for Elven/Dwarven, unchanged otherwise")],
      [],
    ),
    "Wilmsry": side(
      [
        trait("wilmsry-talk", "can always parley with anything but Magical foes and the Walking Dead; +4 on every parley roll", CONTRACT, "camp heals twice as fast; parleys Beasts at fluency 0"),
        trait("wilmsry-haggle", "store prices 30% off", "test/unit/tools.test.js", "openStore: a Wilmsry's haggle (x0.7) applies to the tool lines like every other line"),
      ],
      [trait("wilmsry-joiners", "Magic User Joiners refuse to travel with you", CONTRACT, "half skill points; Magic User Joiners refuse to travel with you")],
    ),
    "Fridgian": side([], []),
    "Troll": side(
      [],
      [
        trait("troll-prices", "store prices triple", CONTRACT, "prices triple, eats two rations a night"),
        trait("troll-weapons", "weapons cost double on top of that", FOOTER, "identity-proof: a Troll's store weapon line costs six times the base price"),
      ],
    ),
  }),
});
