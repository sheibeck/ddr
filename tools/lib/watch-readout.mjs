// tools/lib/watch-readout.mjs
//
// Phase 92 plan 04 (TUNE-10) — the watch-list tally and readout, a PURE helper
// for tools/tune-difficulty.mjs. Zero dependencies beyond band-readout.mjs, no
// engine mutation, no rng, no fs.
//
// A report, never a gate or a fit objective. It adds no bot behavior and moves
// no number the fit reads; it counts events the engine already emits so the one
// milestone-end bot pass can say, from the same 1,000 runs, how the watch-list
// items behaved (92-CONTEXT ruled sequence 5): starvation after the d10 rations,
// the Magic User pools (the Illusionist's Door Illusion, the Cleric), the
// Fridgian frenzy, the 91.1 cooldown abilities, and the Joiners.
//
// Shape: `makeWatchTally()` is one run's counters; `tallyWatch(tally, events,
// before, after, action)` is called once per bot step (`before` is the state
// the action was dispatched on, null on the first step; `after` the state it
// produced); `watchReadout(results)` pools the per-run tallies (each result's
// `watch`) by class, Magic User sub-class and race; `formatWatchReadout(r)`
// renders the block (byte-stable for the same input).

import { STARVATION_CAUSES, interpolatedMedian } from "./band-readout.mjs";

/** The 91.1 value-review cooldown abilities (docs/VALUE-LEDGER.md V1 to V5): ready again after a cooldown. */
export const COOLDOWN_91_1 = ["kata", "feint", "overheadBlow", "lastStand", "secondWind", "hamstring", "mark"];

/** The ruled Fridgian frenzy odds on each swing (a 4, 5 or 6 on a d6): context for the readout, never a target. */
export const FRENZY_RULED_ODDS = 0.5;

/** The Magic User sub-classes this readout names; every other sub-class is pooled as "other Magic User". */
export const WATCH_SUBS = ["Illusionist", "Cleric", "Wizard", "Summoner"];

export function makeWatchTally() {
  return {
    fights: 0, // encounterStarted
    attacks: 0, // "attack" actions dispatched in a fight (melee strikes)
    strikes: 0, // steps with a hero strike swing (a `struck`, `strikeMissed` or `frenzy` event): the frenzy check runs once per such step
    healCasts: 0, // the hero's own healing spells (a `healed` event carrying a spell), any time
    healCastsInFight: 0,
    doorSeen: 0, // Door Illusion resisted: the cleverest foe saw through it
    doorEscapes: 0, // Door Illusion landed: the fight ended through the door
    frenzies: 0,
    abilityUses: {}, // key -> uses
    abilityFights: {}, // key -> fights with at least one use
    abilitySecond: {}, // key -> fights with a second (or later) use
    allyCasts: 0,
    partyFights: 0, // fights that began with a Joiner in the party
    joinerDowns: 0, // memberDowned
    joinerParleys: 0, // parley successes with a Joiner present
    parleySuccesses: 0,
    campFailed: 0,
    rations: 0, // rationsBought amount
    cur: {}, // the fight's own ability counts, reset on encounterStarted
  };
}

function bump(map, key, by = 1) {
  map[key] = (map[key] || 0) + by;
}

export function tallyWatch(tally, events, before, after, action) {
  const inFight = !!((before && before.combat) || (after && after.combat));
  const party = after && Array.isArray(after.party) ? after.party.length : 0;
  const partyBefore = before && Array.isArray(before.party) ? before.party.length : party;
  if (action && action.type === "attack" && inFight) tally.attacks++;
  if ((events || []).some((e) => e.type === "struck" || e.type === "strikeMissed" || e.type === "frenzy")) tally.strikes++;
  for (const e of events || []) {
    switch (e.type) {
      case "encounterStarted":
        tally.fights++;
        tally.cur = {};
        if (party > 0) tally.partyFights++;
        break;
      case "frenzy":
        tally.frenzies++;
        break;
      case "doorIllusionSeen":
        tally.doorSeen++;
        break;
      case "fled":
        if (e.reason === "door") tally.doorEscapes++;
        break;
      case "healed":
        if (e.spell !== undefined && e.member === undefined) {
          tally.healCasts++;
          if (inFight) tally.healCastsInFight++;
        }
        break;
      case "abilityUsed": {
        const k = e.key;
        bump(tally.abilityUses, k);
        bump(tally.cur, k);
        if (tally.cur[k] === 1) bump(tally.abilityFights, k);
        if (tally.cur[k] === 2) bump(tally.abilitySecond, k);
        break;
      }
      case "allyCast":
        tally.allyCasts++;
        break;
      case "memberDowned":
        tally.joinerDowns++;
        break;
      case "spGained":
        if (e.reason === "parley") {
          tally.parleySuccesses++;
          if (partyBefore > 0 || party > 0) tally.joinerParleys++;
        }
        break;
      case "campFailed":
        tally.campFailed++;
        break;
      case "rationsBought":
        tally.rations += e.amount || 0;
        break;
      default:
        break;
    }
  }
}

const round2 = (x) => Math.round(x * 100) / 100;
const per = (a, b) => (b ? round2(a / b) : null);
const W = (r) => r.watch || makeWatchTally();

function isStarved(r) {
  return !!r.dead && !r.stuck && STARVATION_CAUSES.includes(r.cause);
}

/** poolRow(label, runs) — one pooled row. Stuck runs are excluded from the depth median, as every depth stat. */
function poolRow(label, runs) {
  const completed = runs.filter((r) => !r.stuck);
  const depths = completed.map((r) => r.deathDepth).sort((a, b) => a - b);
  const n = runs.length;
  const sum = (f) => runs.reduce((s, r) => s + f(r), 0);
  const fights = sum((r) => W(r).fights);
  const dead = completed.filter((r) => r.dead).length;
  const starved = completed.filter(isStarved).length;
  return {
    label,
    n,
    stuck: n - completed.length,
    p50: interpolatedMedian(depths),
    starved,
    starvedShare: dead ? round2((starved / dead) * 100) : null,
    fleesPerRun: n ? round2(sum((r) => (r.identity && r.identity.flees) || 0) / n) : null,
    doorSeenPerRun: n ? round2(sum((r) => W(r).doorSeen) / n) : null,
    doorEscapesPerRun: n ? round2(sum((r) => W(r).doorEscapes) / n) : null,
    healCastsPerFight: per(sum((r) => W(r).healCastsInFight), fights),
    attacksPerFight: per(sum((r) => W(r).attacks), fights),
    fights,
  };
}

/**
 * watchReadout(results) — `{ pools, starvation, campFailedPerRun, rationsPerRun, fridgian, abilities, joiners, stuck }`.
 * `pools` is ALL, then the class pools, the Magic User sub-class pools, then every race (sorted).
 */
export function watchReadout(results) {
  const pools = [poolRow("ALL", results)];
  for (const cls of ["Fighter", "Thief", "Magic User"]) pools.push(poolRow(`class ${cls}`, results.filter((r) => r.cls === cls)));
  const mu = results.filter((r) => r.cls === "Magic User");
  for (const s of WATCH_SUBS) pools.push(poolRow(`MU ${s}`, mu.filter((r) => r.sub === s)));
  pools.push(poolRow("MU other", mu.filter((r) => !WATCH_SUBS.includes(r.sub))));
  const races = [...new Set(results.map((r) => r.race).filter(Boolean))].sort();
  for (const race of races) pools.push(poolRow(`race ${race}`, results.filter((r) => r.race === race)));

  // Starvation by floor and as a share of all deaths (completed, dead runs).
  const deadRuns = results.filter((r) => r.dead && !r.stuck);
  const byFloor = new Map();
  for (const r of deadRuns) {
    const f = Math.min(r.deathDepth, 13);
    const row = byFloor.get(f) || { floor: f, deaths: 0, starved: 0 };
    row.deaths++;
    if (isStarved(r)) row.starved++;
    byFloor.set(f, row);
  }
  const floors = [...byFloor.values()]
    .sort((a, b) => a.floor - b.floor)
    .map((row) => ({ ...row, share: row.deaths ? round2((row.starved / row.deaths) * 100) : null }));
  const starvedAll = deadRuns.filter(isStarved).length;
  const n = results.length;
  const sumW = (f) => results.reduce((s, r) => s + f(W(r)), 0);

  // Fridgian frenzy.
  const frid = results.filter((r) => r.race === "Fridgian");
  const fridFights = frid.reduce((s, r) => s + W(r).fights, 0);
  const fridFrenzies = frid.reduce((s, r) => s + W(r).frenzies, 0);
  const fridStrikes = frid.reduce((s, r) => s + W(r).strikes, 0);

  // Abilities: every key that was ever used.
  const keys = [...new Set(results.flatMap((r) => Object.keys(W(r).abilityUses)))].sort();
  const abilities = keys.map((key) => {
    const uses = sumW((w) => w.abilityUses[key] || 0);
    const fightsUsed = sumW((w) => w.abilityFights[key] || 0);
    const second = sumW((w) => w.abilitySecond[key] || 0);
    const runs = results.filter((r) => (W(r).abilityUses[key] || 0) > 0).length;
    return { key, v911: COOLDOWN_91_1.includes(key), runs, uses, fightsUsed, secondUses: second, secondPerFight: per(second, fightsUsed) };
  });

  // Joiners.
  const joinerRuns = results.filter((r) => W(r).partyFights > 0 || (r.memberAtStart || 0) > 0);
  const partyFights = sumW((w) => w.partyFights);
  const joiners = {
    runsWithJoiner: joinerRuns.length,
    fights: partyFights,
    allyCasts: sumW((w) => w.allyCasts),
    castsPerJoinerFight: per(sumW((w) => w.allyCasts), partyFights),
    downs: sumW((w) => w.joinerDowns),
    parleysWithJoiner: sumW((w) => w.joinerParleys),
    parleySuccesses: sumW((w) => w.parleySuccesses),
    p50WithJoiner: interpolatedMedian(joinerRuns.filter((r) => !r.stuck).map((r) => r.deathDepth).sort((a, b) => a - b)),
  };

  return {
    n,
    pools,
    starvation: { deaths: deadRuns.length, starved: starvedAll, share: deadRuns.length ? round2((starvedAll / deadRuns.length) * 100) : null, floors },
    campFailedPerRun: n ? round2(sumW((w) => w.campFailed) / n) : null,
    rationsPerRun: n ? round2(sumW((w) => w.rations) / n) : null,
    fridgian: {
      runs: frid.length,
      fights: fridFights,
      frenzies: fridFrenzies,
      frenziesPerFight: per(fridFrenzies, fridFights),
      strikes: fridStrikes,
      frenziesPerStrike: per(fridFrenzies, fridStrikes),
      ruledOdds: FRENZY_RULED_ODDS,
    },
    abilities,
    joiners,
    stuck: results.filter((r) => r.stuck).length,
  };
}

const f = (x, d = 2) => (x === null || x === undefined ? "n/a" : typeof x === "number" ? (Number.isInteger(x) && d === 2 ? String(x) : x.toFixed(d)) : String(x));

export function formatWatchReadout(r) {
  const lines = [];
  lines.push("Watch list (Phase 92 — TUNE-10, report only; a report, never a gate or a fit objective):");
  lines.push("  Pools (p50 = interpolated median death depth over completed runs):");
  for (const p of r.pools) {
    lines.push(
      `    ${p.label.padEnd(20)} n=${p.n}  stuck=${p.stuck}  p50=${f(p.p50)}  starved=${p.starved} (${f(p.starvedShare, 1)}% of deaths)  flees/run=${f(p.fleesPerRun)}  doorSeen/run=${f(p.doorSeenPerRun)}  doorEscape/run=${f(p.doorEscapesPerRun)}  heals/fight=${f(p.healCastsPerFight)}  attacks/fight=${f(p.attacksPerFight)}`,
    );
  }
  lines.push(`  Starvation: ${r.starvation.starved} of ${r.starvation.deaths} deaths (${f(r.starvation.share, 1)}%); campFailed/run=${f(r.campFailedPerRun)}  rations bought/run=${f(r.rationsPerRun)}`);
  lines.push("  Starvation by floor (deaths on the floor; 13 = 13 and deeper):");
  for (const row of r.starvation.floors) {
    lines.push(`    floor ${String(row.floor).padStart(2)}  deaths=${row.deaths}  starved=${row.starved}  share=${f(row.share, 1)}%`);
  }
  const fr = r.fridgian;
  lines.push(
    `  Fridgian frenzy: runs=${fr.runs}  fights=${fr.fights}  frenzies=${fr.frenzies}  per fight=${f(fr.frenziesPerFight)}  strikes=${fr.strikes}  per strike=${f(fr.frenziesPerStrike)}  (ruled: ${f(fr.ruledOdds)} on each strike action)`,
  );
  lines.push("  Abilities (uses, fights with a use, fights with a second use; 91.1 = a 91.1 cooldown ability):");
  for (const a of r.abilities) {
    lines.push(
      `    ${a.key.padEnd(14)} ${a.v911 ? "91.1" : "    "}  runs=${a.runs}  uses=${a.uses}  fights=${a.fightsUsed}  second=${a.secondUses}  second/fight=${f(a.secondPerFight)}`,
    );
  }
  const j = r.joiners;
  lines.push(
    `  Joiners: runs=${j.runsWithJoiner}  fights=${j.fights}  casts=${j.allyCasts}  casts/fight=${f(j.castsPerJoinerFight)}  downs=${j.downs}  parley successes with a Joiner=${j.parleysWithJoiner} of ${j.parleySuccesses}  p50 with a Joiner=${f(j.p50WithJoiner)}`,
  );
  lines.push(`  Stuck runs: ${r.stuck} of ${r.n}`);
  return lines;
}
