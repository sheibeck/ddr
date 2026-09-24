// content/boards.js
//
// Phase 65 (RUN-04; the shared board table's voice half, per CONTEXT). The
// orderings and values live in engine/records.js; this file holds only
// player-facing copy. Phase 66 (BOARD-02/03/07/08) adds each board's `mark`,
// `col` and `unitLabel` from the imported mock (D-11) and adopts the mock's
// rule lines verbatim (LEANEST re-voiced for its Phase 66 squares-per-floor
// re-rank, D-09 — engine/records.js owns the comparator change). The
// lowercase `unit`/`unitOne` fields stay exactly as Phase 65 left them: they
// feed the death-panel's NEW PERSONAL BEST announcement (src/browser/
// newBest.js), which is untouched by this phase. `content/` holds no
// functions — the `{token}` placeholders below (n, name, floor, steps,
// epitaph) are filled by the view model (66-04), never here.

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
  lean: {
    tab: "LEANEST",
    title: "DEEPEST, FEWEST STEPS",
    mark: "▪",
    col: "#e8c97a",
    unitLabel: "FLOOR · SQ",
    rule: "Squares walked per floor descended. Efficiency, of a sort.",
    unit: "sq",
  },
  combo: {
    tab: "LINEAGE",
    title: "BY RACE & CLASS",
    mark: "◆",
    col: "#b9a4ef",
    unitLabel: "FLOOR",
    rule: "Every race and class combination rolled so far, ranked by the deepest floor any of them managed.",
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
// fallback name for a player with no display name; `note.live` is the ALL /
// FRIENDS tap note while signed in — the global boards are coming online,
// and it claims no rank or count (Phase 68 brings the real rows).
// Phase 68 (D-05..D-09): `global` holds the ALL / FRIENDS board copy — the
// scope lines, the SEASON {n} label, the loading / unreachable / closed /
// empty notes, the friends consent note and button, the YOU / FRIEND row
// tags, the standing lines (worldwide / among friends / the sampled LINEAGE
// count) and the honest LINEAGE sample footnote. No line names or singles
// out another player; the joke stays on the player's own dead.
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
    all: "ALL",
    friends: "FRIENDS",
  }),
  note: Object.freeze({
    all: "Nobody out there can see you yet.",
    friends: "Your friends have not been told you exist. It may be kinder that way.",
    live: Object.freeze({
      all: "The world's ledger is still being bound. Your own dead will have to do.",
      friends: "Your friends' ledger is still at the bindery. Your own dead will have to do for now.",
    }),
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
    leanRateUnit: "SQ / FLOOR",
    noEntry: "Nothing of yours on this board yet this season.",
    ofWorld: "of {n} interred worldwide.",
    ofFriends: "of {n} among friends.",
    ofSampled: "of {n} lineages in the sample.",
    sampledFoot: "Sampled from the top {n} deepest corpses in the world. Rare lineages may be buried further down.",
  }),
  empty: "Nobody of yours has qualified for this board yet.",
  divider: "NOT IN THE TOP TEN · YOUR BEST RUN",
  standing: Object.freeze({
    noEntry: "NO ENTRY",
    noPlace: "—",
    noNote: "The ledger opens at your first funeral.",
    ofYours: "of {n} of yours.",
    ofCombos: "of {n} combinations.",
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
    one: "{n} INTERRED",
    many: "{n} INTERRED, NO SURVIVORS",
    detail: "{n} rolled, {n} dead. Deepest was {name}, floor {floor} in {steps} squares. {epitaph}",
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
