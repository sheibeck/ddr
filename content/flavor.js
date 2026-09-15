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
  "Dwarven": "Two extra damage, a wilmst a day to feed, and every creature down here swings at you like it has been practising — but your armour shrugs off wear at half the rate everyone else's does. Built low, built cheap, built to be hit, built to keep the dents. Dwarves call this a fair trade. Dwarves are rarely asked.",
  "Wilmsry": "You heal twice as fast and learn half as quickly, so you will survive a great deal and understand almost none of it. Magic Users despise you on sight — not one of them will so much as travel with you — which most Wilmsry take as proof they are doing something right.",
  "Fridgian": "You will not wear armour, though your hide alone soaks two points off every blow that lands. You will not strike first. Five times in eight you lose the plot entirely and swing twice at whatever is nearest — and unlike the stories, neither swing is ever wasted on something already dead. The Game Master has notes about you.",
  "Troll": "Seventy-five Hit Points, nine extra damage, and an appetite that goes through two rations a night. The strongest thing on most floors and the first to starve on all of them. Everything you own cost triple.",
};

export const CLASS_NOTE = {
  "Fighter": "The best Hit Points in the book, any armour you can lift, and a 5 to hit — which at skill level I still means three swings in four hit nothing but corridor. Fighters are the only delvers who die of something other than a mistake.",
  "Thief": "Forty Hit Points, leather at the very best, and an opening strike that lands twice as hard as it ought to. Twelve value points of special skills, more than anyone else gets. A thief's plan is to be elsewhere by round three, and thieves are excellent at plans.",
  "Magic User": "Twenty-five Hit Points plus whatever the d10 pities you with, a staff you cannot really use, and a 3 to hit — six swings in seven are decorative. Everything you are is in the grimoire. No special skills: the book's position is that spells ought to be enough.",
};

export const SUB_NOTE = {
  "Knight": "Nothing under 5 hp will come near you, and anything with 20 hit points or more comes straight at you — and gets there first. You have been made important by the only creatures whose vote counts: the large ones.",
  "Guard": "No critical strike, ever, and three damage off the top until level four — but every creature down here needs one better than usual to land a blow on you. You are a professional. The profession is standing there.",
  "Woodsman": "No mail, no plate — the store won't offer it and your own hands won't take it — no shield, and a quarter staff you are genuinely superb with. You speak to every animal in here except dragons — a pity, as it is mostly dragons that want a word.",
  "Soldier": "You take criticals on a 2 and deal them never. Serve to skill level III and they knight you, which is the army conceding that the first three levels were a waste of you.",
  "Barbarian": "Two attacks a round and half the experience points, on the sound principle that a man swinging twice is learning nothing either time.",
  "Master of Arms": "Plus two with every weapon ever forged, plus three with anything you have repaired yourself. You cannot parley — you attack creatures without question, literally — and once a fight has your scent there is no clean exit in round one either. The book files this under abilities.",
  "Samurai": "A magical katana, armour like plate, and enough clatter that you never win the first roll of anything. You never run. The book uses the word suicidal and does not soften it.",
  "Bard": "Five songs, one every hundred squares, and dragons hand over gifts to hear them. Camp for the night and creatures too stupid to know better come looking twice as often, and once the fighting starts they come for you first — which, down here, is most of them.",

  "Pickpocket": "You take a percentage of everything: purses, shop stock, treasure nobody has opened yet. You have never been caught, but every shopkeeper in the maze remembers your face all the same — a quarter more to buy from them, a quarter less when you sell. You have never been thanked either.",
  "Pilfer": "Traps disarm themselves in your presence and no sealed room has ever held you. Try to use anything that doesn't heal, though, and your own hands simply refuse — which the dungeon finds hilarious and stocks accordingly.",
  "Cat Burglar": "Your first strike of any fight always lands. You also go through every door first and take the full weight of whatever waits behind it. These two facts are related.",
  "Cutthroat": "Double damage on your first landed blow, and word travels fast: no Joiner will ever agree to walk beside you. Delving alone was already the plan; now it's the only option.",
  "Cloaker": "You can vanish for free, right up until you land your first blow — after that you flee like everyone else, and you earn precisely nothing from the fight you vanish out of. A Cloaker's career is a long list of encounters that never technically happened.",
  "Ninja": "You never speak — literally; no fluency, no encounter, ever talks you out of a fight. Your opening strike lands for maximum damage and after that a 1 or a 2 opens something up. The silence isn't a vow, it's a tactic.",
  "Con Artist": "You talk first, and anything with wit of 6 or under simply declines to fight you. Your first landed blow does no damage at all, because part of you is still hoping to sell them something.",
  "Acrobat": "Everything needs a 3 to lay a hand on you and you may carry nothing but a knife. You strike with it like a fighter — nobody armours against a dagger held by someone who will not stand still.",

  "Wizard": "Every school of magic, and a flat refusal to teach anybody who isn't an Apprentice. You will not raise a hand while an attack spell is left in the book; once the book cannot hurt anything, the staff will do. Two wizards in a party fight each other; there is only one of you, which helps.",
  "Warlock": "Evil, and productive with it — a potion copied every day and a standing bonus to every walking dead thing in the room. The dead don't know you're helping. You haven't told them.",
  "Sorcerer": "Two dozen spells to start and two more each level, nearly all of it fire, with a one-in-eight chance per level of simply forgetting the ones that aren't. Your arm caps out at 9 damage. Nobody hired the arm.",
  "Court Mage": "You talk. Through encounters, through corridors, through other people's turns — which means that when a fight actually starts, everyone else gets there first. One creature in six dies of boredom before it comes to that, and the book counts that as a kill.",
  "Illusionist": "You choose where the teleport squares put you, which in a dungeon is very close to owning the floor. A Phantom Host from day one, three illusions, and a d20 to strike until level three — let the host do the hitting.",
  "Cleric": "Healing, turning the dead, chain mail and a shield: the one Magic User the dungeon cannot simply push over. A 4 to hit instead of a 3. The gods have rounded up.",
  "Summoner": "You can call something up from your very first day. Everything you call arrives twice as strong and twice as long-lived, and one time in eight it arrives on the wrong side. The book declines to say whose fault that is.",
  "Apprentice": "Double experience points until level three, one spell in eight goes off in your hands, and at level three you finally roll to discover what you actually are. Assuming you get there.",
};
