// content/boards.js
//
// Phase 65 (RUN-04; the shared board table's voice half, per CONTEXT). The
// orderings and values live in engine/records.js; this file holds only
// player-facing copy. Phase 84 (BOARD-18..25, BOARD-20) retired the old
// board rail, LEANEST/LINEAGE/GRAVEYARD and the third-party global strip
// (84-09) — LEADERBOARD_COPY is the only panel copy left; `BOARD_COPY` now
// names only the four NEW PERSONAL BEST rows the death panel still shows
// (src/browser/newBest.js reads its `title`, `unit` and, where present,
// `unitOne`). `content/` holds no functions — the `{token}` placeholders in
// LEADERBOARD_COPY are filled by the view model (84-05), never here.

export const BOARD_COPY = {
  deep: {
    title: "DEEPEST DESCENT",
    unit: "floor",
  },
  days: {
    title: "LONGEST HELD OUT",
    unit: "days",
    unitOne: "day",
  },
  kills: {
    title: "MOST KILLS",
    unit: "kills",
    unitOne: "kill",
  },
  purse: {
    title: "RICHEST CORPSE",
    unit: "wilmst",
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

// LEADERBOARD_COPY (Phase 84, BOARD-18, BOARD-24, BOARD-25, BOARD-27) —
// every word the Leaderboards panel v3 shows (the pure view of 84-05, the
// renderer of 84-06), deep-frozen with every leaf a non-empty string. Most
// strings are the v3 mock's own copy verbatim (design/Mazeworld Boards
// Panel v3.dc.html), pinned by test/unit/leaderboard-copy.test.js; the mock
// has no loading/stale/unreachable state and no explicit "all this season"
// empty line, so `state.loading`/`state.unreachable`/`state.seeMine`/
// `state.stale`/`state.ageMoment..ageHours` and `empty.boardAll`/
// `empty.mineAll` are Claude's Discretion (CONTEXT area 1 "LEADERBOARD
// states are in-voice notes") in the house voice, proved against the same
// voice-corpus/safety-scan/hp-not-wp tests as every other bank here.
//
// This is now the only Leaderboards panel copy bank: Phase 84 (84-09)
// retired the old panel's BOARDS_PANEL_COPY, BOARD_FOOTNOTES,
// STANDING_LINES and GLOBAL_STANDING_LINES exports (they kept the old panel
// working only until the shell switched to v3, 84-08) and trimmed
// BOARD_COPY above to the four NEW PERSONAL BEST rows.
//
// `stats` keys are deep/days/kills/purse in that exact order, matching
// src/browser/runDoc.js#BOARD_STATS (engine/records.js#RANKED_BOARDS) — the
// same four ranked board stats both Leaderboards views (the board and YOUR
// DEAD) rank by via runDoc.js#rankKeyOf. `{token}` placeholders (line, n,
// handle, race, sub, cls, age, date, cause: sic — no "cause" token exists;
// see the token list in the test) are filled by the view model (84-05),
// never here — content/ holds no functions
// (test/determinism/content-is-pure-data.test.js).
export const LEADERBOARD_COPY = Object.freeze({
  title: Object.freeze({
    board: "LEADERBOARD",
    mine: "YOUR DEAD",
  }),
  scope: Object.freeze({
    board: "Everyone’s dead. Top ten shown.",
    mine: "Only your heroes. Nobody else’s business.",
    off: "Compete is off. Only your heroes.",
  }),
  box: Object.freeze({
    yours: "YOURS ›",
    everyone: "EVERYONE ›",
    interred: "INTERRED",
    unknown: "—",
  }),
  back: "Back",
  seasonFallback: "Season {n}",
  pick: Object.freeze({
    stat: "RANK BY",
    race: "RACE",
    sub: "SUB-CLASS",
    any: "ANY",
  }),
  stats: Object.freeze({
    deep: Object.freeze({
      label: "DEPTH",
      unit: "FLOOR · SQ",
      col: "#d3c49f",
      rule: "Lowest floor reached. Ties go to fewer squares walked.",
    }),
    days: Object.freeze({
      label: "DAYS",
      unit: "DAYS",
      col: "#8fb08a",
      rule: "Days survived underground.",
    }),
    kills: Object.freeze({
      label: "KILLS",
      unit: "KILLS",
      col: "#e07260",
      rule: "Things killed before being killed.",
    }),
    purse: Object.freeze({
      label: "WILMST",
      unit: "WILMST",
      col: "#e8c97a",
      rule: "Carried at the moment of death. All of it still down there.",
    }),
  }),
  sheet: Object.freeze({
    done: "DONE",
    anyRace: "ANY RACE",
    everyRace: "Every race",
    anySub: "ANY SUB-CLASS",
    everySub: "Every sub-class",
    anySubLine: "Any sub-class",
    asSub: "as {sub}",
    classRace: "{cls} · {race}",
  }),
  line: Object.freeze({
    anyRace: "any race",
    anySub: "any sub-class",
    both: "{race}, {sub}",
  }),
  empty: Object.freeze({
    title: "NOBODY YET",
    board: "Nobody has died as {line}.",
    mine: "You haven’t lost a hero as {line}.",
    boardAll: "Nobody has died yet this season. Somebody has to go first.",
    mineAll: "You haven’t lost a hero yet. Give it time.",
    clear: "CLEAR FILTERS",
  }),
  divider: "NOT IN THE TOP TEN · YOUR BEST",
  you: "YOU",
  standing: Object.freeze({
    best: "{handle}’s best, of {n} interred as {line}.",
    none: "None of yours on this board yet.",
    noPlace: "—",
  }),
  state: Object.freeze({
    loading: "Counting the dead. They are in no hurry.",
    unreachable: "The board isn’t answering. Your own dead never leave.",
    seeMine: "SEE YOUR DEAD",
    stale: "Counted {age} ago. The board has stopped answering.",
    ageMoment: "moments",
    ageMinute: "a minute",
    ageMinutes: "{n} minutes",
    ageHour: "an hour",
    ageHours: "{n} hours",
  }),
  chips: Object.freeze({
    floor: "FLOOR",
    days: "DAYS",
    squares: "SQUARES",
    kills: "KILLS",
    exp: "EXP",
    wilmst: "WILMST",
  }),
  died: "Died {date}",
  months: Object.freeze([
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]),
  foe: "foe",
  sep: " · ",
  dock: Object.freeze({
    title: "BACK TO TITLE",
    roll: "ROLL A NEW HERO",
    dungeon: "BACK TO THE DUNGEON",
    finalSheet: "FINAL SHEET",
    bury: "BURY THEM",
  }),
});
