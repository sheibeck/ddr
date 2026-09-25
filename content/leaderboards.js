// content/leaderboards.js
//
// Phase 68 (PGS-06; D-14, D-15): the Play Games leaderboard IDs, one frozen
// entry per season. Rules:
//
// - Each season entry holds the four submitted boards: deep (DEEPEST), days
//   (LONGEST), kills (BUTCHERY) and purse (PURSE). LINEAGE and GRAVEYARD get
//   no Play Games board (67 D-19): LINEAGE is built from a DEEPEST sample and
//   GRAVEYARD stays on the device. The lean (LEANEST) id was removed from
//   season 1 by the user's ruling (Phase 81, BOARD-17) — a 1-step death could
//   top a steps-per-floor board, and "deepest, then fewest steps" is exactly
//   DEEPEST's own ordering. This is the one sanctioned edit to an older
//   season's entry; every season bump after it starts with four boards.
// - Season 1 IDs pasted 2026-09-24 from the user's Play Console setup.
// - The IDs come from the Play Console (docs/PLAY-GAMES-SETUP.md, finished in
//   Phase 69). An ID that starts with LEADERBOARD_PLACEHOLDER_PREFIX is not
//   live: its board is skipped silently (nothing is submitted to it and its
//   global view reads as not opened yet).
// - A season bump ADDS a new entry and bumps SEASON in content/season.js. An
//   older season's entry is never edited or deleted (see the LEANEST
//   exception above): old boards stay readable from the panel's season
//   picker and are never written again. The unit suite fails if SEASON has
//   no entry here.
//
// Pure data, as every content/ module: no functions.

export const LEADERBOARD_PLACEHOLDER_PREFIX = "PLACEHOLDER";

export const LEADERBOARD_IDS = Object.freeze({
  1: Object.freeze({
    deep: "CgkIlvbN0YYPEAIQAg",
    days: "CgkIlvbN0YYPEAIQBA",
    kills: "CgkIlvbN0YYPEAIQBQ",
    purse: "CgkIlvbN0YYPEAIQBg",
  }),
});
