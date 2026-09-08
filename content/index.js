// content/index.js
//
// Barrel re-export of every content module, so the engine (and its tests)
// import game content from one place: `import { WEAPONS, SPELLS } from
// "../content/index.js"`. Every symbol re-exported here is pure,
// JSON-serializable data — no functions (see
// test/determinism/content-is-pure-data.test.js).

export * from "./classes.js";
export * from "./races.js";
export * from "./weapons.js";
export * from "./armors.js";
export * from "./kit.js";
export * from "./skills.js";
export * from "./bestiary.js";
export * from "./encounters.js";
export * from "./spells.js";
export * from "./mu-chart.js";
export * from "./potions.js";
export * from "./foods.js";
export * from "./traps.js";
export * from "./afflictions.js";
export * from "./treasure-tables.js";
export * from "./misc-tables.js";
export * from "./flavor.js";
export * from "./epitaphs.js";
export * from "./names.js";
