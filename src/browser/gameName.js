// src/browser/gameName.js
//
// Single source of truth for the product's display name (04-CONTEXT.md
// "Game name (branding) — UPDATED 2026-09-08"). The product name is LOCKED
// to "Delve, Die, Repeat", matching the native manifest (capacitor.config.json
// appName / appId com.darktierstudios.delvedierepeat, already renamed in
// f81942f). Every UI surface that displays the product name (document title,
// the masthead heading, any future splash-adjacent text) must import
// GAME_NAME from here rather than hardcoding a duplicated literal, so a
// future rename is a one-line change here instead of a repo-wide hunt.
//
// "Mazeworld" is NOT routed through this constant — it survives ONLY as the
// in-fiction world/setting name (the Maze Master, Wilmsry, wilmst currency,
// the lore), which this constant has nothing to do with.

export const GAME_NAME = "Delve, Die, Repeat";
