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
// Plain player language: HP (never WP), the U+2212 minus for any negative.
// Phase 91 plan 10 (TEXT-01, user 2026-09-30) supersedes ROLL-04's "faces"
// wording: a shift reads "+N to hit" or "foes −N to hit you", a hard cap or a
// crit range names its range on a d20 as the example ("foes hit you only on a
// high roll (17–20 on a d20)"), and "can talk to X" is "can always parley
// with X". Every range typed below is read back through the engine by
// test/unit/identity-text.test.js (classNeed, foeToHitVs, the crit checks), so
// a number cannot drift. Pure, frozen, JSON-serializable data.
//
// BLURB_ANCHORS (bottom of the file) is the IDENT-12 guard's table: for every
// entry id identityEntries lists (these traits and the generated lines), the
// phrase that identity's blurb must state, so a trait cannot land without a
// line in the blurb.

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
        // Phase 91.1 plan 03 (V18 B, user 2026-10-01): the Cleric's separate "heals 3 more" trait (cleric-heal) is retired:
        // the chart's healing bonus (4) is the Cleric's heal bonus now, a generated footer line (chart-bonus-healing).
        trait("cleric-hit", "+1 to hit over other Magic Users (17–20 on a d20 at level 1)", CONTRACT, "heals 4 more than anyone else, rolls 4 to hit"),
        trait("cleric-heal-start", "always starts with Heal in the book", "test/unit/cleric-offense-ban.test.js", "IDENT-15: every new Cleric holds Heal and can cast it on day one, seeds 1 to 1000"),
        // Phase 91 plan 10 (Q2 A, user 2026-09-30): the real trade the "more hit points" ruling asked the text to state.
        trait("cleric-mail", "starts in chain mail, where every other Magic User starts in cloth", "test/unit/identity-text.test.js", "91-10 pin: a Cleric starts in chain mail and every other Magic User in cloth (cleric-mail, Q2 A)"),
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
      [
        trait("apprentice-xp", "double experience from kills until level 3", CONTRACT, "double skill points off a kill at level one"),
        // Phase 91 plan 10: the audit's unstated Illusion rule (rulebook p.17, "even Illusionist spells"; the Wizard lost the school in Phase 90).
        trait("apprentice-illusion", "may learn Illusion spells, which no other Magic User but the Illusionist can", "test/unit/identity-text.test.js", "91-10 pin: only the Apprentice and the Illusionist learn Illusion; the Wizard never does (apprentice-illusion)"),
      ],
      // "your" spells: a Joiner Apprentice never backfires (engine/combat.js#allyCast draws no backfire die).
      [trait("apprentice-backfire", "one of your own spells in eight backfires", CONTRACT, "one spell in eight backfires")],
    ),

    // ---------------- Fighter ----------------
    "Knight": side(
      [trait("knight-small", "any foe under 5 HP flees before it can act", CONTRACT, "beneath the notice of small things — a foe under 5 maxWP flees before it can act")],
      [trait("knight-big", "never wins initiative against a foe with 20 HP or more", CONTRACT, "everything over 20 comes straight at you — never wins initiative vs a live maxWP >= 20 foe")],
    ),
    "Guard": side(
      [trait("guard-hard", "foes −1 to hit you", CONTRACT, "the profession is standing there — every foe needs one better to land a blow")],
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
        trait("soldier-knighted", "knighted at level 3: you become a Knight and swap your weapon for an Awl Pike", "test/unit/character.test.js", "checkLevel: a Soldier is knighted at level 3"),
      ],
      [
        trait("soldier-crit", "foes crit you on 19–20 on a d20, not just 20", CONTRACT, "a foe's roll of 2 crits a Soldier, doubling the dice"),
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
        trait("bard-song", "sings a random offense or defense spell up to your level, at full strength, no charges spent, and a second song 5 rounds after the first", "test/unit/value-identity.test.js", "V7 Sing sing-once: a Bard sings a second song 5 rounds after the first (round 1 to round 6), and never a third"),
      ],
      [
        trait("bard-camp", "camp wakes wandering monsters twice as often", CONTRACT, "camp wakes wandering monsters twice as often; dumb foes come for the Bard"),
        // Phase 91 plan 06 (IDENT-17): the ruling's own words, said plainly (pickFoeTarget: intelligence 3 or less).
        trait("bard-target", "foes with intelligence no higher than 3 always attack you when a Joiner is in the fight", CONTRACT, "camp wakes wandering monsters twice as often; dumb foes come for the Bard"),
      ],
    ),

    // ---------------- Thief ----------------
    "Pickpocket": side(
      [trait("pickpocket-item", "whenever you gain an item from a chest or a monster, you gain one extra item as well", CONTRACT, "an extra item from every kill drop and chest")],
      [trait("pickpocket-shops", "shops charge you a quarter more (torches, rope and ladders aside) and pay a quarter less", CONTRACT, "shopkeepers know your face — buys x1.25, sells x0.75")],
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
      [trait("cutthroat-joiner", "whenever you descend with a Joiner, roll a d10: a 1 kills that Joiner", CONTRACT, "whenever you descend with a Joiner, a d10 of 1 and that Joiner does not reach the next floor")],
    ),
    "Cloaker": side(
      [trait("cloaker-vanish", "vanishes from any fight for free until you land a blow, even from a pursuing Spectre", CONTRACT, "a free vanish while nobody has seen your face")],
      [trait("cloaker-seen", "once you've struck, you flee on the ordinary roll like everyone else", CONTRACT, "once seen, the vanish is denied — a distinct scenario from the good's")],
    ),
    "Ninja": side(
      [
        // The opener is a Thief's opening blow, so the backstab doubles it (engine/combat.js#playerStrike; pinned in
        // the Ninja half of test/unit/identity-contract.test.js) unless heavy armour or the dark denies the backstab.
        trait("ninja-opener", "your opening strike always lands for maximum damage, doubled by the backstab unless you are in heavy armour or the dark", CONTRACT, "the opener always lands for max weapon damage; a later roll of 2 crits"),
        trait("ninja-crit", "after that, you crit on the top two numbers of your strike die (19–20 on a d20)", CONTRACT, "the opener always lands for max weapon damage; a later roll of 2 crits"),
      ],
      [trait("ninja-silent", "can never talk a fight down", CONTRACT, "you never speak — canParley is false unconditionally")],
    ),
    "Con Artist": side(
      [
        trait("con-artist-talk", "can always parley with anything but Magical foes and the Walking Dead; +4 on every parley roll", CONTRACT, "can talk anyone down except Magical/Walking Dead, and a weak foe leaves before the fight starts"),
        trait("con-artist-leave", "a level 1 foe leaves before the fight two times in three, and a level 2 foe one time in three", CONTRACT, "can talk anyone down except Magical/Walking Dead, and a weak foe leaves before the fight starts"),
      ],
      [trait("con-artist-opener", "your opening blow deals no damage", CONTRACT, "the opening blow is a warning, not an injury")],
    ),
    "Acrobat": side(
      [
        trait("acrobat-dodge", "foes hit you only on a high roll (17–20 on a d20)", CONTRACT, "harder to land a blow on, easier to land one"),
        trait("acrobat-hit", "you hit on 16–20 on a d20 at level 1, like a Fighter (15–20 with the dagger)", CONTRACT, "harder to land a blow on, easier to land one"),
        // Phase 91 plan 10: the audit's unstated trap dodge (engine/encounters.js#springTrap, `nimble = 5 + 3`).
        trait("acrobat-traps", "dodges traps on 13–20 on a d20, not 16–20", "test/unit/identity-text.test.js", "91-10 pin: an Acrobat dodges a trap on a wider range than anyone else (acrobat-traps)"),
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
        trait("elven-prices", "store prices halved (torches, rope and ladders aside)", "test/unit/economy.test.js", "priceFor: doubles for a Troll, halves (rounded) for Elven/Dwarven, unchanged otherwise"),
        trait("elven-humans", "can always parley with Humans, +3 on that parley roll", "test/unit/rollDirection-checks.test.js", "[parley:elven-humans]"),
      ],
      [],
    ),
    "Dwarven": side(
      [trait("dwarven-prices", "store prices halved (torches, rope and ladders aside)", "test/unit/economy.test.js", "priceFor: doubles for a Troll, halves (rounded) for Elven/Dwarven, unchanged otherwise")],
      [],
    ),
    "Wilmsry": side(
      [
        trait("wilmsry-talk", "can always parley with anything but Magical foes and the Walking Dead; +4 on every parley roll", CONTRACT, "camp heals twice as fast; parleys Beasts at fluency 0"),
        trait("wilmsry-haggle", "store prices 30% off", "test/unit/tools.test.js", "openStore: a Wilmsry's haggle (x0.7) applies to the tool lines like every other line"),
      ],
      [trait("wilmsry-joiners", "you refuse to take Magic User Joiners on", CONTRACT, "half skill points; you refuse to take Magic User Joiners on")],
    ),
    "Fridgian": side([], []),
    "Troll": side(
      [],
      [
        trait("troll-prices", "store prices doubled (torches, rope and ladders aside)", CONTRACT, "prices double, eats two rations a night"),
      ],
    ),
  }),
});

/**
 * BLURB_ANCHORS — Phase 91 plan 10 (IDENT-12: "each blurb and each race/sub-class note states every advantage
 * and drawback the engine applies; a guard test fails when a trait has no blurb line"). For every identity, one
 * entry per id `src/browser/identityFooter.js#identityEntries` lists (the authored traits above AND the generated
 * chart, free-skill and race-field lines): the case-insensitive regex SOURCE the identity's blurb (`SUB_NOTE` /
 * `RACE_NOTE`) must match and, for a race, also `note` (the phrase `RACES[race].note` must match).
 * test/unit/identity-text.test.js fails when an id has no anchor, when a blurb (or race note) does not match
 * its anchor, when an anchor names an id that is not live, and when a blurb is empty. A phrase that must hold
 * two facts uses lookaheads, `(?=.*a)(?=.*b)`.
 * Pure, frozen, JSON-serializable data.
 */
const A = (blurb, note) => Object.freeze(note === undefined ? { blurb } : { blurb, note });
const R = String.raw;
const table = (rows) => Object.freeze(Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, Object.freeze(v)])));

export const BLURB_ANCHORS = Object.freeze({
  sub: table({
    // ---------------- Magic User ----------------
    "Wizard": {
      "wizard-day-one": A(R`always opens with something that hurts`),
      "wizard-melee": A(R`will not raise a hand while an attack spell`),
      "chart-bonus-offense": A(R`\+3 to hit`),
      "chart-never": A(R`never Illusion`),
    },
    "Warlock": {
      "warlock-potion": A(R`potion copied every night`),
      "warlock-undead": A(R`every walking dead thing in the room`),
      "chart-bonus-offense": A(R`\+4 to hit`),
      "chart-gate-protection": A(R`protection back until level 4`),
      "chart-gate-healing": A(R`healing until level 3`),
      "chart-never": A(R`closed on Special and Illusion`),
    },
    "Sorcerer": {
      "sorcerer-book": A(R`Freeze and Fireball in the book from day one`),
      "sorcerer-levels": A(R`two more spells each level`),
      "sorcerer-arm": A(R`arm caps out at 9 damage`),
      "sorcerer-forgets": A(R`one-in-eight chance per level of simply forgetting`),
      "chart-bonus-offense": A(R`\+4 to hit`),
      "chart-bonus-protection": A(R`Shield soaks 5 more HP and your Bubble's film holds 5 more`),
      "chart-gate-healing": A(R`healing waits until level 4`),
      "chart-stretch-special": A(R`10 squares longer, Stop Time 1 round longer`),
      "chart-never": A(R`Illusion is closed to you for good`),
    },
    "Summoner": {
      "summoner-summon": A(R`Summon is always in your book`),
      "summoner-doubled": A(R`a level stronger and longer-lived`),
      "summoner-backfire": A(R`one time in eight it arrives on the wrong side`),
      "chart-bonus-protection": A(R`Shield soaks 10 more HP and your Bubble's film holds 10 more`),
      "chart-stretch-special": A(R`10 squares longer, Stop Time 1 round longer`),
      "chart-never": A(R`Illusion is closed to you for good`),
      "chart-healmul": A(R`heal at half strength`),
      "chart-override-Summon": A(R`from your very first day \(everyone else waits for level 2\)`),
    },
    "Cleric": {
      "cleric-hit": A(R`\+1 to hit over other Magic Users`),
      "cleric-heal-start": A(R`Heal always on the first page`),
      "cleric-mail": A(R`chain mail`),
      "chart-bonus-protection": A(R`Shield soaks 15 more HP and your Bubble's film holds 15 more`),
      "chart-bonus-healing": A(R`healing spells heal 4 more`),
      "chart-never": A(R`never learn offense \(except Strength\), special or illusion spells`),
      "chart-gate-divination": A(R`Divination waits until level 3`),
    },
    "Illusionist": {
      "illusionist-teleport": A(R`you choose where it puts you`),
      "illusionist-book": A(R`three illusions from day one`),
      "illusionist-d20": A(R`a d20 to strike until level three`),
      "chart-gate-protection": A(R`protection waits until level 3`),
      "chart-never": A(R`healing is closed to you for good`),
      "chart-stretch-special": A(R`40 squares longer, Stop Time 4 rounds longer`),
      "chart-stretch-illusion": A(R`Senseless and Duplicate Foe last 1 round longer`),
    },
    "Court Mage": {
      "court-mage-boredom": A(R`one creature in six dies of boredom`),
      "court-mage-humans": A(R`can always parley with Humans`),
      "court-mage-first": A(R`everyone else gets there first`),
      "chart-bonus-offense": A(R`\+2 to hit`),
      "chart-bonus-protection": A(R`Shield soaks 10 more HP and your Bubble's film holds 10 more`),
      "chart-bonus-healing": A(R`healing spells heal 1 more`),
      "chart-gate-divination": A(R`divination waits until level 4`),
      "chart-never": A(R`Special and Illusion are closed to you for good`),
    },
    "Apprentice": {
      "apprentice-xp": A(R`double experience points until level three`),
      "apprentice-illusion": A(R`may learn Illusion spells`),
      "apprentice-backfire": A(R`one of your spells in eight goes off in your hands`),
      "chart-gate-divination": A(R`divination waits until level 3`),
    },

    // ---------------- Fighter ----------------
    "Knight": {
      "knight-small": A(R`nothing under 5 hp will come near you`),
      "knight-big": A(R`20 hit points or more comes straight at you`),
    },
    "Guard": {
      "guard-hard": A(R`foes get −1 to hit you`),
      "guard-weak": A(R`three damage off every blow at level one, one less each level until it is gone at four`),
      "guard-nocrit": A(R`no critical strike, ever`),
    },
    "Woodsman": {
      "woodsman-talk": A(R`(?=.*can always parley with every beast)(?=.*\+3 on the roll)`),
      "woodsman-armor": A(R`no mail, no plate`),
    },
    "Soldier": {
      "soldier-camp": A(R`camp heals you twice as much`),
      "soldier-knighted": A(R`knight you, swapping your weapon for an Awl Pike`),
      "soldier-crit": A(R`foes crit you on 19–20 on a d20`),
      "soldier-nocrit": A(R`you deal criticals never`),
    },
    "Barbarian": {
      "barbarian-two": A(R`two attacks a round`),
      "barbarian-xp": A(R`half the experience points`),
    },
    "Master of Arms": {
      "moa-damage": A(R`plus two with every weapon`),
      "moa-patch": A(R`hammer the dents out of your own armour`),
      "moa-parley": A(R`you cannot parley`),
      "moa-never-leaves": A(R`never leave a fight once it starts`),
    },
    "Samurai": {
      "samurai-kit": A(R`a magical katana, armour like plate`),
      "samurai-never": A(R`never win the first roll of anything\. You never run`),
    },
    "Bard": {
      "bard-humans": A(R`can always parley with Humans`),
      "bard-song": A(R`you sing a random offense or defense spell up to your level.*a second song 5 rounds after the first`),
      "bard-camp": A(R`come looking twice as often`),
      "bard-target": A(R`intelligence is no higher than 3 comes for you first`),
    },

    // ---------------- Thief ----------------
    "Pickpocket": {
      "pickpocket-item": A(R`one extra item as well`),
      "pickpocket-shops": A(R`a quarter more to buy from them.*a quarter less when you sell`),
    },
    "Pilfer": {
      "pilfer-traps": A(R`traps disarm themselves in your presence and no sealed room has ever held you`),
      "pilfer-fumble": A(R`(?=.*one time in twenty)(?=.*d10 of your own hp)`),
    },
    "Cat Burglar": {
      "cat-burglar-first": A(R`first strike of any fight always lands`),
      "cat-burglar-traps": A(R`every trap that catches you deals double damage`),
      "free-skill": A(R`Dirty Trick`),
    },
    "Cutthroat": {
      "cutthroat-crit": A(R`double damage on your first landed blow, even in heavy armour`),
      "cutthroat-joiner": A(R`one descent in ten`),
    },
    "Cloaker": {
      "cloaker-vanish": A(R`vanish for free, right up until you land your first blow.*pursuing Spectre`),
      "cloaker-seen": A(R`after that you flee like everyone else`),
    },
    "Ninja": {
      "ninja-opener": A(R`(?=.*opening strike lands for maximum damage)(?=.*backstab doubles it)`),
      "ninja-crit": A(R`top two numbers of your strike die \(19–20 on a d20\)`),
      "ninja-silent": A(R`you never speak`),
      "free-skill": A(R`Silent Step`),
    },
    "Con Artist": {
      "con-artist-talk": A(R`can always parley.*\+4 on every parley roll`),
      "con-artist-leave": A(R`any level-one foe declines to fight you two times in three, and any level-two foe one time in three`),
      "con-artist-opener": A(R`does no damage at all`),
    },
    "Acrobat": {
      "acrobat-dodge": A(R`foes hit you only on a high roll \(17–20 on a d20\)`),
      "acrobat-hit": A(R`15–20 with the dagger`),
      "acrobat-traps": A(R`dodge traps on 13–20 on a d20`),
      "acrobat-dagger": A(R`nothing but a knife`),
      "free-skill": A(R`Smoke`),
    },
  }),

  race: table({
    "Human": {
      "human-neutral": A(R`no advantages`, R`no advantages`),
    },
    "Elven": {
      "elven-prices": A(R`halve their prices`, R`prices halved`),
      "elven-humans": A(R`can always parley with Humans`, R`can always parley with Humans`),
      "race-size-dmg": A(R`costs you two points of damage`, R`costs it 2 damage`),
      "race-hp-mul": A(R`half a person's Hit Points`, R`60% of the usual HP`),
      "race-strike-step": A(R`die one size smaller`, R`smaller die`),
      "race-foe-to-hit": A(R`foes get \+1 to hit you`, R`foes get \+1 to hit it`),
      "race-to-hit": A(R`top five numbers of it whatever the class \(16–20 on a d20\)`, R`top five numbers of it \(16–20 on a d20\)`),
    },
    "Dwarven": {
      "dwarven-prices": A(R`halve their prices`, R`prices halved`),
      "race-size-face": A(R`foes get −1 to hit you`, R`foes get −1 to hit it`),
      "race-upkeep": A(R`single Hit Point a night`, R`1 HP/night`),
      "race-dmg": A(R`three extra damage`, R`\+3 damage`),
      "race-foe-strike-step": A(R`a die one size smaller, so a level 1 foe rolls a d12`, R`foes strike on a smaller die`),
      "race-armor-wear": A(R`wear at half the rate`, R`wears at half the rate`),
    },
    "Wilmsry": {
      "wilmsry-talk": A(R`can always parley.*\+4 on every parley roll`, R`can always parley.*\+4 on every parley roll`),
      "wilmsry-haggle": A(R`shops take 30% off`, R`prices 30% off`),
      "wilmsry-joiners": A(R`will not take a Magic User on as a Joiner`, R`refuses to take Magic Users on as Joiners`),
      "race-heal2x": A(R`heal twice as fast \(rest, potions and your own healing spells\)`, R`heals twice as much \(rest, potions, own healing spells\)`),
      "race-sp-mul": A(R`learn half as quickly`, R`half the experience`),
    },
    "Fridgian": {
      "race-no-armor": A(R`will not wear armour`, R`never wears armour`),
      "race-no-samurai": A(R`no Fridgian Samurai`, R`never a Samurai`),
      "race-frenzy": A(R`a 4, 5 or 6 on a d6.*−1 to hit.*second is simply lost with it`, R`a 4, 5 or 6 on a d6.*−1 to hit.*lost if the first one fells its target`),
      "race-slow": A(R`will not strike first`, R`never strikes first`),
      "race-hide": A(R`soaks three points off every blow`, R`soaks 3 from every blow`),
    },
    "Troll": {
      "troll-prices": A(R`charge you double`, R`prices doubled`),
      "race-size-face": A(R`\+1 to hit you for anything`, R`foes get \+1 to hit it`),
      "race-upkeep": A(R`a night without them costs you 15 HP`, R`loses 15 HP`),
      "race-flat-hp": A(R`75 starting hit points whatever the class`, R`75 hp regardless of class`),
      "race-dmg": A(R`\+11 damage per swing .*the Large \+2 inside the 11`, R`\+11 damage \(being large adds 2\)`),
      "race-eats": A(R`two rations a night`, R`two rations a night`),
    },
  }),
});
