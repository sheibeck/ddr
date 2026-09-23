// content/boards.js
//
// Phase 65 (RUN-04; the shared board table's voice half, per CONTEXT). The
// orderings and values live in engine/records.js; this file holds only
// player-facing copy. Phase 66's panel adds each board's `mark` here from
// the imported mock (BOARD-03) and may re-word a `rule` line to the mock's
// exact copy. Boards map to canon fields: squares -> steps, wilmst -> gold,
// EXP -> sp.

export const BOARD_COPY = {
  deep: {
    tab: "DEEPEST",
    title: "DEEPEST DESCENT",
    rule: "Deepest floor reached. Ties go to whoever wasted fewer squares getting there.",
    unit: "floor",
  },
  lean: {
    tab: "LEANEST",
    title: "DEEPEST, FEWEST STEPS",
    rule: "Deepest floor for the fewest squares walked. Efficient, right up to the end.",
    unit: "sq",
  },
  combo: {
    tab: "LINEAGE",
    title: "BY RACE & CLASS",
    rule: "Your best run for each race and class. Every lineage ends; some end lower.",
    unit: "floor",
  },
  days: {
    tab: "LONGEST",
    title: "LONGEST HELD OUT",
    rule: "Most days survived. Endurance is just losing slowly.",
    unit: "days",
    unitOne: "day",
  },
  kills: {
    tab: "BUTCHERY",
    title: "MOST KILLS",
    rule: "Most monsters put down before the dungeon returned the favor.",
    unit: "kills",
    unitOne: "kill",
  },
  purse: {
    tab: "PURSE",
    title: "RICHEST CORPSE",
    rule: "Most wilmst on the body at the end. You cannot take it with you. You tried.",
    unit: "wilmst",
  },
  yard: {
    tab: "GRAVEYARD",
    title: "YOUR GRAVEYARD",
    rule: "Everyone you have rolled and lost, deepest first. Not ranked. Nobody here won.",
    unit: "floor",
  },
};

export const NEW_BEST_HEAD = "NEW PERSONAL BEST";

export const NEW_BEST_LINES = [
  "New personal best. The dungeon has adjusted its expectations of you, slightly.",
  "A record. It goes on the stone, just under the part where you died.",
  "Your finest failure yet. The bar was low, and you cleared it lying down.",
  "Personal best. The previous record holder was also you, and also dead.",
  "Congratulations. You have never lost this well before.",
  "The ledger notes an improvement. It is not impressed, but it notes it.",
  "A new high in a long career of lows. Frame it.",
  "Best run yet. Your next adventurer now has something to fall short of.",
];

export const FIRST_DEATH_LINES = [
  "First corpse on the books. Every record is yours, for now.",
  "The ledger opens with you. Someone had to go first.",
  "One death, one entry, every record. Enjoy the top of a very short list.",
];
