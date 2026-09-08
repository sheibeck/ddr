// content/names.js
//
// Pure-data port of mazeworld.html's NAMES table (~line 1156-1163),
// race -> pool of candidate character names. No closures in the prototype
// (nameFor(r) = pick(NAMES[r] || NAMES.Human) is logic and moves to the
// engine's character-gen module in plan 01-05) — ported verbatim.

export const NAMES = {
  Human: ["Aldric Vane", "Sera Coll", "Bertram Hask", "Ivy Corrin", "Owen Trask"],
  Elven: ["Faelin Shear", "Ysolde Nim", "Aeryth Vale"],
  Dwarven: ["Borin Stonecut", "Hilda Ferrow", "Durn Blackkettle"],
  Wilmsry: ["Pell of Ninth Row", "Marta Quen", "Osk the Patient"],
  Fridgian: ["Skalgrim", "Hrafn the Loud", "Vott Icebound"],
  Troll: ["Grommash Nine-Teeth", "Ulba the Wide", "Skeg"],
};
