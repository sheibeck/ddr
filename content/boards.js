// content/boards.js
//
// Phase 65 (RUN-04; the shared board table's voice half, per CONTEXT). The
// orderings and values live in engine/records.js; this file holds only
// player-facing copy. Phase 66 (BOARD-02/03/07/08) adds each board's `mark`,
// `col` and `unitLabel` from the imported mock (D-11) and adopts the mock's
// rule lines verbatim. The lowercase `unit`/`unitOne` fields stay exactly as
// Phase 65 left them: they feed the death-panel's NEW PERSONAL BEST
// announcement (src/browser/newBest.js), which is untouched by this phase.
// `content/` holds no functions — the `{token}` placeholders below (n, name,
// floor, steps, epitaph) are filled by the view model (66-04), never here.
//
// Phase 81 (BOARD-17): LEANEST (squares walked per floor) was retired by the
// user's ruling — a 1-step death could top a steps-per-floor board, and
// "deepest, then fewest steps" is exactly DEEPEST's own ordering, leaving no
// honest LEANEST. `BOARD_COPY.lean` and `BOARDS_PANEL_COPY.global.leanRateUnit`
// are gone.
//
// Phase 81 (BOARD-13/BOARD-14): GRAVEYARD and LINEAGE are ME-only boards (the
// engine/records.js ME_ONLY_BOARDS list) — GRAVEYARD's removal was reversed
// by the user's ruling of 2026-09-25, "Let's keep the graveyard then".
// `BOARD_COPY`'s key order now matches BOARD_IDS: deep, days, kills, purse,
// combo, yard.

export const BOARD_COPY = {
  deep: {
    tab: "DEEPEST",
    title: "DEEPEST DESCENT",
    mark: "▼",
    col: "#d3c49f",
    unitLabel: "FLOOR",
    rule: "Lowest floor reached before dying. Ties broken by the fewer squares walked to get there.",
    unit: "floor",
  },
  days: {
    tab: "LONGEST",
    title: "LONGEST HELD OUT",
    mark: "⧗",
    col: "#8fb08a",
    unitLabel: "DAYS",
    rule: "Days survived underground. Rations are the real opponent.",
    unit: "days",
    unitOne: "day",
  },
  kills: {
    tab: "BUTCHERY",
    title: "MOST KILLS",
    mark: "✕",
    col: "#e07260",
    unitLabel: "KILLS",
    rule: "Things killed before being killed. Not correlated with depth, which is the joke.",
    unit: "kills",
    unitOne: "kill",
  },
  purse: {
    tab: "PURSE",
    title: "RICHEST CORPSE",
    mark: "●",
    col: "#e8c97a",
    unitLabel: "WILMST",
    rule: "Wilmst carried at the moment of death. All of it still down there.",
    unit: "wilmst",
  },
  combo: {
    tab: "LINEAGE",
    title: "BY RACE & SUB-CLASS",
    mark: "◆",
    col: "#b9a4ef",
    unitLabel: "FLOOR",
    rule: "One race, one sub-class, the ten deepest of them. Ties go to whoever walked less.",
    unit: "floor",
  },
  yard: {
    tab: "GRAVEYARD",
    title: "YOUR GRAVEYARD",
    mark: "✝",
    col: "#c9bda0",
    unitLabel: "FLOOR · SQ",
    rule: "Everyone you have rolled and lost, deepest first, with what was said over them. Not ranked against anybody.",
    unit: "floor",
  },
};

// BOARD_FOOTNOTES (D-11) — the mock's two footnote lines verbatim. "ranked"
// covers every board except GRAVEYARD, which gets its own line.
export const BOARD_FOOTNOTES = {
  ranked:
    "Top ten only. Boards count the dead — living characters are provisional and the dungeon keeps no provisional records.",
  yard: "Epitaphs are written by the dungeon, not by you. There is no appeal.",
};

// BOARDS_PANEL_COPY (D-01, D-06, D-07, D-12) — every remaining string the
// Leaderboards panel shows, deep-frozen. `{token}` placeholders (n, name,
// floor, steps, epitaph) are filled by the view model (66-04); content/ holds
// no functions (test/determinism/content-is-pure-data.test.js).
// Phase 67 (D-08): `strip.live` is the signed-in strip's source line and the
// fallback name for a player with no display name. `note` holds only the
// Phase 66 signed-out ALL / FRIENDS notes: Phase 68 retired 67-04's
// signed-in "coming online" notes, which the live global views replace.
// Phase 68 (D-05..D-09): `global` holds the ALL / FRIENDS board copy — the
// scope lines, the SEASON {n} label, the loading / unreachable / closed /
// empty notes, the friends consent note and button, the YOU / FRIEND row
// tags, the standing lines (worldwide / among friends / the sampled LINEAGE
// count) and the honest LINEAGE sample footnote. No line names or singles
// out another player; the joke stays on the player's own dead.
// Phase 70 (D-09, D-13): LINEAGE is one race + sub-class at a time. `lineage`
// holds the RACE / SUB-CLASS picker labels and the local empty note; the
// `{lineage}` token (the "Race Sub" display name) joins the token set, filled
// by the view model. `standing.ofLineage` places the player within one
// lineage (local scope only).
//
// Phase 81 (BOARD-13): LINEAGE is ME-only — signed-in filtering of a global
// DEEPEST sample was retired. `global.ofLineage`, `noLineage`, `lineageEmpty`
// and `sampledFoot` are gone; LINEAGE never reads the global scope.
export const BOARDS_PANEL_COPY = Object.freeze({
  head: Object.freeze({
    title: "LEADERBOARDS",
    interred: "INTERRED",
    back: "Back",
  }),
  scope: Object.freeze({
    ranked: "Your dead only. The world has not been told.",
    yard: "Your own dead. Nobody else’s business.",
  }),
  strip: Object.freeze({
    glyph: "?",
    label: "PLAY GAMES · SIGNED OUT",
    source: "Your dead only",
    live: Object.freeze({
      source: "PLAY GAMES · SIGNED IN",
      unnamed: "A player with no name",
    }),
  }),
  chips: Object.freeze({
    me: "ME",
    all: "ALL",
    friends: "FRIENDS",
  }),
  note: Object.freeze({
    all: "Nobody out there can see you yet.",
    friends: "Your friends have not been told you exist. It may be kinder that way.",
  }),
  global: Object.freeze({
    scope: Object.freeze({
      all: "Global. Every delve this season.",
      friends: "Your friends’ dead only. This season.",
    }),
    season: "SEASON {n}",
    loading: "Asking the world who died. It keeps records, slowly.",
    unreachable: "The world is unreachable. Your own dead are still here.",
    closed: "This board has not opened yet. The ledger is still being ruled.",
    empty: "Nobody has died on this board yet this season. Somebody has to go first.",
    consent: "Play Games will not show us your friends until you say so.",
    consentButton: "SHOW MY FRIENDS",
    you: "YOU",
    friend: "FRIEND",
    anon: "A nameless delver",
    foe: "foe",
    noEntry: "Nothing of yours on this board yet this season.",
    ofWorld: "of {n} interred worldwide.",
    ofFriends: "of {n} among friends.",
    hiddenYou: "Play Games won't show your score here — your profile keeps game activity private.",
  }),
  empty: "Nobody of yours has qualified for this board yet.",
  divider: "NOT IN THE TOP TEN · YOUR BEST RUN",
  standing: Object.freeze({
    noEntry: "NO ENTRY",
    noPlace: "—",
    noNote: "The ledger opens at your first funeral.",
    ofYours: "of {n} of yours.",
    ofLineage: "of {n} of this lineage.",
    interred: "INTERRED",
    yardNote: "rolled, delved, and buried. Deepest was {name} on floor {floor}.",
  }),
  stats: Object.freeze({
    floor: "FLOOR",
    days: "DAYS",
    squares: "SQUARES",
    kills: "KILLS",
    exp: "EXP",
    wilmst: "WILMST",
  }),
  lineage: Object.freeze({
    race: "RACE",
    sub: "SUB-CLASS",
    empty: "No {lineage} of yours has died yet. The dungeon is patient.",
  }),
  level: "LVL",
  sep: " · ",
  dock: Object.freeze({
    title: "BACK TO TITLE",
    roll: "ROLL A NEW HERO",
    dungeon: "BACK TO THE DUNGEON",
  }),
});

// STANDING_LINES (D-07) — the standing-card quip bank, deep-frozen. No line
// mentions a pin, "worldwide", friends or another player: it is offline-only
// voice, one bank per rank tier.
export const STANDING_LINES = Object.freeze({
  first: Object.freeze([
    "Enjoy it.",
    "Your best yet. The bar was on the floor, and so are you.",
    "First place among your own dead. It is a small room.",
  ]),
  ten: Object.freeze([
    "Holding the top ten, for now.",
    "Respectable, for a corpse.",
    "In the top ten. The rest of your dead are taking notes.",
  ]),
  rest: Object.freeze([
    "Outside your own top ten. Even your ghosts are unimpressed.",
    "Not your finest hour. Not your worst, either, probably.",
    "Somewhere in the middle of the pile. Literally.",
  ]),
});

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

// GLOBAL_STANDING_LINES (Phase 68, D-05) — the standing-card quip bank for
// the ALL / FRIENDS boards, one bank per worldwide rank tier, deep-frozen and
// token-free. The joke is on the player's corpse, never on another player.
export const GLOBAL_STANDING_LINES = Object.freeze({
  first: Object.freeze([
    "First place. The others have been told, and are not thrilled.",
    "Top of the heap. Mind the drop.",
    "Nobody has done better. Nobody will admit it, either.",
  ]),
  ten: Object.freeze([
    "Top ten. Strangers are studying your corpse.",
    "In the top ten. Your ghost has earned a small nod.",
    "Top ten. The rest are taking notes, grudgingly.",
  ]),
  hundred: Object.freeze([
    "Top hundred. A large room, but a respectable one.",
    "Somewhere in the top hundred. The view is mostly other graves.",
    "Top hundred. Frame it before the season ends.",
  ]),
  rest: Object.freeze([
    "Out in the crowd. Everyone here is dead too, if that helps.",
    "Not near the top. Not near the bottom either, probably.",
    "A face in a very large, very quiet crowd.",
  ]),
});
