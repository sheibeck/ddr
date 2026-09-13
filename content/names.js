// content/names.js
//
// GENERATIVE name banks (DR-name-generator, 2026-09-09). The prototype shipped
// a flat pool of ~3 fixed names per race, so a run's characters collided almost
// immediately and the recent-name dedup (audit-batch E12) exhausted the pool in
// a handful of rolls — the "lots of duplicate names" device-review complaint.
//
// This restructures each race into a { first, sur } pair of authored pools that
// the engine COMBINES (first × surname) into hundreds of distinct names per
// race (see engine/character.js nameFor). It stays PURE DATA — plain string
// arrays only, no closures — so the content-purity tripwire
// (test/determinism/content-is-pure-data.test.js) and the VOX-02 family-friendly
// safety scan (test/voice/safety-scan.test.js, which flattens first+sur) both
// keep covering it automatically.
//
// A surname may be a family name ("Vane"), an epithet ("the Patient"), or a
// place tag ("of Ninth Row"). An empty-string surname entry ("") yields a bare
// mononym (e.g. "Skalgrim", "Skeg") — the Fridgian/Troll flavor — which nameFor
// renders as just the first name. Every original prototype name is folded back
// into these pools so nothing was lost, only multiplied.
//
// Combo counts (first.length × sur.length): Human 320, Elven 320, Dwarven 320,
// Wilmsry 320, Fridgian 320, Troll 288 — all far past the old 3-per-race.

export const NAMES = {
  // Human — grounded medieval given names + family surnames.
  // ("Aldric Vane", "Sera Coll", …)
  Human: {
    first: [
      "Aldric", "Sera", "Bertram", "Ivy", "Owen", "Corwin", "Mira", "Halden",
      "Rosa", "Emeric", "Cedric", "Wilma", "Garrick", "Nell", "Tobin", "Edmund",
      "Alys", "Roderic", "Petra", "Hew",
    ],
    sur: [
      "Vane", "Coll", "Hask", "Corrin", "Trask", "Marsh", "Fenn", "Holloway",
      "Bracken", "Ashford", "Dunmore", "Redding", "Crane", "Larkin", "Whitlock",
      "Thorne",
    ],
  },

  // Elven — flowing given names + nature/celestial compound surnames.
  // ("Faelin Shear", "Ysolde Nim", …)
  Elven: {
    first: [
      "Faelin", "Ysolde", "Aeryth", "Caelan", "Nimwen", "Thalorin", "Elenya",
      "Sylwen", "Aerion", "Lithariel", "Faenor", "Yssira", "Aelric", "Nuriel",
      "Caelith", "Mirwen", "Elandor", "Saelis", "Yrliss", "Aelwyn",
    ],
    sur: [
      "Shear", "Nim", "Vale", "Silverbough", "Moonwhisper", "Nightbreeze",
      "Starfall", "Dawnstrider", "Frostleaf", "Windrider", "Ambermere",
      "Duskwood", "Fairwater", "Greenmantle", "Lightfoot", "Willowshade",
    ],
  },

  // Dwarven — hard consonant given names + stone/forge trade surnames.
  // ("Borin Stonecut", "Durn Blackkettle", …)
  Dwarven: {
    first: [
      "Borin", "Hilda", "Durn", "Thrain", "Brunna", "Kazrek", "Morek", "Dagna",
      "Torvig", "Grenda", "Hodrin", "Bruni", "Vola", "Darrun", "Signy", "Orin",
      "Haldra", "Grimbeld", "Runa", "Fenna",
    ],
    sur: [
      "Stonecut", "Ferrow", "Blackkettle", "Ironbeard", "Deepdelver", "Coalfist",
      "Anvilborn", "Stoneheart", "Copperbraid", "Hammerfell", "Oreseeker",
      "Granitejaw", "Emberforge", "Flintback", "Steelbrow", "Goldvein",
    ],
  },

  // Wilmsry — humble, working-class given names + wry epithets / place tags.
  // ("Pell of Ninth Row", "Osk the Patient", …)
  Wilmsry: {
    first: [
      "Pell", "Marta", "Osk", "Denn", "Bwitt", "Corl", "Sabel", "Grull", "Wenna",
      "Tamsin", "Rook", "Juna", "Del", "Mabb", "Orrin", "Sten", "Vell", "Hesper",
      "Cobb", "Nix",
    ],
    sur: [
      "of Ninth Row", "Quen", "the Patient", "the Thrifty", "of Low Ward",
      "Tallow", "the Quiet", "of Gutter Lane", "Sootheart", "the Mild",
      "of Tenth Row", "Cobbleknee", "the Frugal", "of Ash Alley", "Pennyworth",
      "the Steady",
    ],
  },

  // Fridgian — icy Norse given names + cold epithets; "" gives bare mononyms.
  // ("Skalgrim", "Hrafn the Loud", "Vott Icebound", …)
  Fridgian: {
    first: [
      "Skalgrim", "Hrafn", "Vott", "Bjorlan", "Sigrun", "Ketill", "Ingra",
      "Torvald", "Gunnvor", "Halgrim", "Esk", "Ranveig", "Snorri", "Vigdis",
      "Ormar", "Frida", "Steinar", "Yrsa", "Ulfar", "Gerd",
    ],
    sur: [
      "the Loud", "Icebound", "Frostborn", "the Grim", "Snowfell", "the Cold",
      "Winterborn", "the Pale", "Rimeheart", "the Bold", "Hailstrider",
      "Frostbeard", "the Silent", "Icevein", "Stormcaller", "",
    ],
  },

  // Troll — brutish given names + blunt epithets; "" gives bare mononyms.
  // ("Grommash Nine-Teeth", "Ulba the Wide", "Skeg", …)
  Troll: {
    first: [
      "Grommash", "Ulba", "Skeg", "Brakka", "Grull", "Mogg", "Vazka", "Drok",
      "Gnarl", "Rukh", "Thugra", "Hagra", "Bront", "Snork", "Muzga", "Orba",
      "Krung", "Zell",
    ],
    sur: [
      "Nine-Teeth", "the Wide", "Bonecrack", "the Slow", "Rockjaw", "the Hungry",
      "Mudfoot", "Stumpfist", "the Heavy", "Gutrumble", "the Lumpy", "Threefinger",
      "the Mossy", "Boulderback", "Nose-Gone", "",
    ],
  },
};
