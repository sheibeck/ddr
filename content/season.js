// content/season.js
//
// Phase 65 (RUN-01, D-01): the run summary's season tag. `SEASON` is a plain
// integer, bumped BY HAND (no auto-derivation from the app version, no
// `rules` string) whenever a balance change moves the depth curve. Add one
// changelog line here each time it moves.
//
// Season changelog:
// 1: v2.0 Leaderboards (2026-09-23), the ledger opens.

export const SEASON = 1;

// SEASON_NAMES (Phase 84, BOARD-27; user ruling 2026-09-28) — the season-name
// table shown as the small line under the LEADERBOARD title (board view
// only, CONTEXT area 1 "Season line"). The integer `SEASON` above stays the
// key everywhere else (run docs, board queries, content/boards.js's
// `seasonFallback` template for an id this table doesn't name). At go-live
// SEASON bumps to 2, named "Season 1" (docs/LEADERBOARDS.md runbook section
// 10 — the alpha season above does not count toward the public season
// numbering).
export const SEASON_NAMES = Object.freeze({
  1: "Season of the Alpha",
});
