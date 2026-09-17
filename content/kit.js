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

// Phase 38 (ABIL-02, post-research ruling "FREE_SKILL same-position rule"):
// Climbing/Leaping/Silence were dropped/converted by content/skills.js's
// table reshape, so each sub's free grant is repointed to the key sitting
// at the SAME object-literal position in THIEF_SKILLS the old key occupied
// (position 7/8/9: Object.keys(THIEF_SKILLS)[6..8]). This is load-bearing,
// not cosmetic: engine/character.js#rollSkills builds
// `pool = Object.keys(table).filter((k) => !c.skills[k])` and shuffles it
// with Fisher-Yates, which permutes INDICES — excluding a DIFFERENT
// position with the same draw count would permute a different element set
// and silently shift every Cat Burglar/Acrobat/Ninja seed's rolled skills.
export const FREE_SKILL = { "Cat Burglar": "Dirty Trick", "Acrobat": "Smoke", "Ninja": "Silent Step" };
