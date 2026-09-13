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

export const RACE_NOTE = {
  "Human": "No advantages, no penalties, no excuses. The dungeon keeps humans around the way a kitchen keeps salt — everything else is measured against them. You will die in a manner the Game Master considers statistically unremarkable.",
  "Elven": "Thin-boned, easy to hit, and carrying not much more than half a person's Hit Points — but you strike a die better than anyone has a right to. The elven plan is to kill it before it notices how little you can take. The plan holds until it doesn't.",
  "Dwarven": "Two extra damage, a wilmst a day to feed, and every creature down here swings at you like it has been practising. Built low, built cheap, built to be hit. Dwarves call this a fair trade. Dwarves are rarely asked.",
  "Wilmsry": "You heal twice as fast and learn half as quickly, so you will survive a great deal and understand almost none of it. Magic Users despise you on sight, which most Wilmsry take as proof they are doing something right.",
  "Fridgian": "You will not wear armour. You will not strike first. Five times in eight you lose the plot entirely and swing twice at whatever is nearest, occasionally something already dead. The Game Master has notes about you.",
  "Troll": "Seventy-five Hit Points, nine extra damage, and an appetite that goes through two rations a night. The strongest thing on most floors and the first to starve on all of them. Everything you own cost triple.",
};

export const CLASS_NOTE = {
  "Fighter": "The best Hit Points in the book, any armour you can lift, and a 5 to hit — which at skill level I still means three swings in four hit nothing but corridor. Fighters are the only delvers who die of something other than a mistake.",
  "Thief": "Forty Hit Points, leather at the very best, and an opening strike that lands twice as hard as it ought to. Twelve value points of special skills, more than anyone else gets. A thief's plan is to be elsewhere by round three, and thieves are excellent at plans.",
  "Magic User": "Twenty-five Hit Points plus whatever the d10 pities you with, a staff you cannot really use, and a 3 to hit — six swings in seven are decorative. Everything you are is in the grimoire. No special skills: the book's position is that spells ought to be enough.",
};

export const SUB_NOTE = {
  "Knight": "Nothing under 5 hp will come near you and everything over 20 comes straight at you. You have been made important by the only creatures whose vote counts: the large ones.",
  "Guard": "No critical strike, ever, and three damage off the top until level four. You are a professional. The profession is standing there.",
  "Woodsman": "No mail, no plate, no shield, and a quarter staff you are genuinely superb with. You speak to every animal in here except dragons — a pity, as it is mostly dragons that want a word.",
  "Soldier": "You take criticals on a 2 and deal them never. Serve to skill level III and they knight you, which is the army conceding that the first three levels were a waste of you.",
  "Barbarian": "Two attacks a round and half the experience points, on the sound principle that a man swinging twice is learning nothing either time.",
  "Master of Arms": "Plus two with every weapon ever forged, plus three with anything you have repaired yourself. You attack creatures without question. The book files this under abilities.",
  "Samurai": "A magical katana, armour like plate, and enough clatter that you never win the first roll of anything. You never run. The book uses the word suicidal and does not soften it.",
  "Bard": "Five songs, one every hundred squares, and dragons hand over gifts to hear them. Creatures too stupid to know better come for you first — which, down here, is most of them.",

  "Pickpocket": "You take a percentage of everything: purses, shop stock, treasure nobody has opened yet. You have never been caught. You have never been thanked either.",
  "Pilfer": "Traps disarm themselves in your presence and no sealed room has ever held you. You cannot use a single magic item that doesn't heal, which the dungeon finds hilarious and stocks accordingly.",
  "Cat Burglar": "Your first strike of any fight always lands. You also go through every door first and take the full weight of whatever waits behind it. These two facts are related.",
  "Cutthroat": "Double damage on your first landed blow, and one member of every party dies by your hand before the dungeon is done. Delving alone has simplified this enormously.",
  "Cloaker": "You can always vanish, and you earn precisely nothing from the fight you vanish out of. A Cloaker's career is a long list of encounters that never technically happened.",
  "Ninja": "You never speak. Your opening strike lands for maximum damage and after that a 1 or a 2 opens something up. The silence isn't a vow, it's a tactic.",
  "Con Artist": "You talk first, and anything with wit of 6 or under simply declines to fight you. Your first landed blow does no damage at all, because part of you is still hoping to sell them something.",
  "Acrobat": "Everything needs a 3 to lay a hand on you and you may carry nothing but a knife. You strike with it like a fighter — nobody armours against a dagger held by someone who will not stand still.",

  "Wizard": "Every school of magic, and a flat refusal to teach anybody who isn't an Apprentice. You will not raise a hand until the last spell is spent. Two wizards in a party fight each other; there is only one of you, which helps.",
  "Warlock": "Evil, and productive with it — a potion copied every day and a standing bonus to every walking dead thing in the room. The dead don't know you're helping. You haven't told them.",
  "Sorcerer": "Two dozen spells to start and two more each level, nearly all of it fire, with a one-in-eight chance per level of simply forgetting the ones that aren't. Your arm caps out at 9 damage. Nobody hired the arm.",
  "Court Mage": "You talk. Through encounters, through corridors, through other people's turns. One creature in twelve dies of boredom before the fighting starts, and the book counts that as a kill.",
  "Illusionist": "You choose where the teleport squares put you, which in a dungeon is very close to owning the floor. Three illusions and a d20 to strike until level three — so pick the corridor, not the fight.",
  "Cleric": "Healing, turning the dead, chain mail and a shield: the one Magic User the dungeon cannot simply push over. A 4 to hit instead of a 3. The gods have rounded up.",
  "Summoner": "Everything you call arrives twice as strong and twice as long-lived, and one time in eight it arrives on the wrong side. The book declines to say whose fault that is.",
  "Apprentice": "Double experience points until level three, one spell in eight goes off in your hands, and at level three you finally roll to discover what you actually are. Assuming you get there.",
};
