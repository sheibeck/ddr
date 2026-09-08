// content/kit.js
//
// Pure-data port of mazeworld.html's KIT / FREE_SKILL tables (~line 571-610).
// Maps subclass -> starting weapon + proficiency bonus, and subclass -> a
// free special skill. No closures in the prototype — ported verbatim.

export const KIT = {
  "Knight": ["Awl Pike", 2], "Guard": ["Spear", 2], "Woodsman": ["Quarter Staff", 3],
  "Soldier": ["Long Sword", 1], "Barbarian": ["Battle Axe", 2], "Master of Arms": ["Broadsword", 2],
  "Samurai": ["Katana", 3], "Bard": ["Short Sword", 1],
  "Pickpocket": ["Dagger", 0], "Pilfer": ["Dagger", 0], "Cat Burglar": ["Dagger", 0],
  "Cutthroat": ["Short Sword", 0], "Cloaker": ["Dagger", 0], "Ninja": ["Wakazashi", 1],
  "Con Artist": ["Dagger", 0], "Acrobat": ["Dagger", 1],
  "Wizard": ["Quarter Staff", 0], "Warlock": ["Quarter Staff", 0], "Sorcerer": ["Quarter Staff", 0],
  "Summoner": ["Quarter Staff", 0], "Cleric": ["Club", 1], "Illusionist": ["Quarter Staff", 0],
  "Court Mage": ["Quarter Staff", 0], "Apprentice": ["Quarter Staff", 0],
};

export const FREE_SKILL = { "Cat Burglar": "Climbing", "Acrobat": "Leaping", "Ninja": "Silence" };
