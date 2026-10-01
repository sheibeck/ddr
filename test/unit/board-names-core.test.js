// test/unit/board-names-core.test.js
//
// Phase 91.2-02 Task 1 (BOARD-31, BOARD-32, D-01, D-04, D-06). Drives
// functions/board-names/core.js with an injected fetch over an in-memory
// upstream stub (test/unit/harness/boardNameStub.js): claim, adopt, stamp,
// release, the NAME_SOURCE=games fallback, the sanitizing rule and the
// metadata token getter. No network, no real clock.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  createBoardNameCore,
  sanitizeName,
  metadataTokenGetter,
  BOARD_NAME_MAX_CHARS,
  deepKeyOf,
} from "../../functions/board-names/core.js";
import { deepKeyOf as clientDeepKeyOf } from "../../src/browser/runDoc.js";
import { createUpstreamStub, field } from "./harness/boardNameStub.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CORE_PATH = path.resolve(__dirname, "..", "..", "functions", "board-names", "core.js");
const NOW = Date.parse("2026-10-01T09:30:00.000Z");
const PG = "playgames.google.com";

function makeCore(stub, over = {}) {
  return createBoardNameCore({
    fetchFn: stub.fetchFn,
    getAdminToken: async () => "admin-token",
    adminHeaders: { "X-Goog-User-Project": "proj" },
    projectId: "proj",
    apiKey: "KEY",
    now: () => NOW,
    ...over,
  });
}

function linkedStub({ displayName = "Moss Knuckle", localId = "uA", idToken = "tokA" } = {}) {
  const stub = createUpstreamStub({ projectId: "proj" });
  stub.seedUser(idToken, { localId, providers: [{ providerId: PG, rawId: "player-1", displayName }] });
  return stub;
}

function mutations(stub) {
  return stub.writes;
}

// --- sanitizeName ------------------------------------------------------------

test("sanitizeName: NFC, control and format characters dropped, whitespace collapsed, trimmed", () => {
  assert.equal(sanitizeName("  Moss   Knuckle  "), "Moss Knuckle");
  assert.equal(sanitizeName("Mo\u0007ss\u200B Knuckle"), "Moss Knuckle");
  assert.equal(sanitizeName("A\u00A0\u2003B"), "A B");
  assert.equal(sanitizeName("é"), "é"); // NFC composes
  assert.equal(sanitizeName("\u202Egnirts"), "gnirts"); // bidi override is a format char
});

test("sanitizeName: null for non-strings and empty results", () => {
  for (const bad of [null, undefined, 42, {}, [], true]) assert.equal(sanitizeName(bad), null);
  assert.equal(sanitizeName(""), null);
  assert.equal(sanitizeName("   "), null);
  assert.equal(sanitizeName("\u200B\u0007"), null);
});

test("sanitizeName: cut at 64 UTF-16 units without splitting a surrogate pair", () => {
  assert.equal(BOARD_NAME_MAX_CHARS, 64);
  assert.equal(sanitizeName("x".repeat(70)), "x".repeat(64));
  const pair = "\u{1F600}"; // two UTF-16 units
  const cutInsidePair = "x".repeat(63) + pair + "tail";
  assert.equal(sanitizeName(cutInsidePair), "x".repeat(63));
  const fits = "x".repeat(62) + pair;
  assert.equal(sanitizeName(fits), fits);
  assert.equal(sanitizeName("x".repeat(63) + " " + "yy"), "x".repeat(63));
});

// --- deepKeyOf ---------------------------------------------------------------

test("deepKeyOf equals the client's src/browser/runDoc.js#deepKeyOf", () => {
  for (const run of [
    { floor: 1, steps: 0 },
    { floor: 3, steps: 120 },
    { floor: 12, steps: 999999 },
    { floor: 200, steps: 5 },
    { floor: "7", steps: "31" },
  ]) {
    assert.equal(deepKeyOf(run), clientDeepKeyOf(run));
  }
});

// --- claim -------------------------------------------------------------------

test("claim: a linked caller gets the Play Games name written to names/{uid} and stamped onto their runs", async () => {
  const stub = linkedStub();
  stub.seedRun("uA", "aaaa0001");
  stub.seedRun("uA", "aaaa0002", { handle: "@old two" });
  stub.seedRun("uA", "aaaa0003", { handle: "Moss Knuckle" }); // already right
  stub.seedRun("uB", "bbbb0001");
  const core = makeCore(stub);

  const r = await core.claim({ idToken: "tokA" });

  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, name: "Moss Knuckle", overridden: false, stamped: 2, adopted: 0 });
  const names = stub.getDoc("names/uA");
  assert.equal(field(names, "name"), "Moss Knuckle");
  assert.equal(field(names, "updatedAt"), new Date(NOW).toISOString());
  assert.deepEqual(Object.keys(names).sort(), ["name", "updatedAt"]);
  const nameWrites = mutations(stub).filter((w) => w.path === "names/uA");
  assert.equal(nameWrites.length, 1);
  assert.equal(nameWrites[0].kind, "patch");
  assert.equal(nameWrites[0].query, "", "no update mask: the document is replaced");

  assert.equal(field(stub.getDoc("runs/uA_aaaa0001"), "handle"), "Moss Knuckle");
  assert.equal(field(stub.getDoc("runs/uA_aaaa0002"), "handle"), "Moss Knuckle");
  assert.equal(field(stub.getDoc("runs/uB_bbbb0001"), "handle"), "@old handle", "another uid is never touched");

  const stampWrites = mutations(stub).filter((w) => w.kind === "commit-patch");
  assert.equal(stampWrites.length, 2, "the run whose handle already matched is skipped");
  for (const w of stampWrites) {
    assert.deepEqual(w.mask, ["handle"]);
    assert.deepEqual(w.fields, ["handle"]);
    assert.deepEqual(w.precondition, { exists: true });
  }
});

test("claim: every Firestore call carries the admin bearer token and the admin headers; lookup carries the API key", async () => {
  const stub = linkedStub();
  stub.seedRun("uA", "aaaa0001");
  await makeCore(stub).claim({ idToken: "tokA" });
  const fs_calls = stub.calls.filter((c) => c.url.startsWith("https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents"));
  assert.ok(fs_calls.length >= 3);
  for (const c of fs_calls) {
    assert.equal(c.headers.Authorization, "Bearer admin-token");
    assert.equal(c.headers["X-Goog-User-Project"], "proj");
  }
  const lookups = stub.calls.filter((c) => c.url.startsWith("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=KEY"));
  assert.equal(lookups.length, 1);
  assert.deepEqual(lookups[0].body, { idToken: "tokA" });
});

test("claim: names/{uid} already holding the same name is not rewritten, the stamp pass still runs", async () => {
  const stub = linkedStub();
  stub.seedDoc("names/uA", { name: "Moss Knuckle", updatedAt: "ignored" });
  stub.seedRun("uA", "aaaa0001", { handle: "@legacy pair" });
  const r = await makeCore(stub).claim({ idToken: "tokA" });
  assert.equal(r.status, 200);
  assert.equal(r.body.stamped, 1);
  assert.equal(mutations(stub).filter((w) => w.path === "names/uA").length, 0);
  assert.equal(field(stub.getDoc("runs/uA_aaaa0001"), "handle"), "Moss Knuckle");
});

test("claim: stamping pages through more than one page of runs and commits at most 500 writes at a time", async () => {
  const stub = linkedStub();
  for (let i = 0; i < 650; i++) stub.seedRun("uA", String(10000000 + i));
  const r = await makeCore(stub).claim({ idToken: "tokA" });
  assert.equal(r.status, 200);
  assert.equal(r.body.stamped, 650);
  const queries = stub.calls.filter((c) => c.url.endsWith(":runQuery"));
  assert.equal(queries.length, 3, "300 + 300 + 50");
  assert.equal(queries[0].body.structuredQuery.limit, 300);
  assert.equal(queries[0].body.structuredQuery.startAt, undefined);
  assert.ok(queries[1].body.structuredQuery.startAt.values[0].referenceValue.includes("runs/uA_"));
  assert.deepEqual(queries[0].body.structuredQuery.orderBy, [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }]);
  assert.deepEqual(queries[0].body.structuredQuery.where.fieldFilter, {
    field: { fieldPath: "uid" },
    op: "EQUAL",
    value: { stringValue: "uA" },
  });
  const commits = stub.calls.filter((c) => c.url.endsWith(":commit"));
  assert.deepEqual(commits.map((c) => c.body.writes.length), [500, 150]);
  for (let i = 0; i < 650; i++) assert.equal(field(stub.getDoc(`runs/uA_${10000000 + i}`), "handle"), "Moss Knuckle");
});

test("claim: no playgames provider is 403 NOT_LINKED with zero writes", async () => {
  const stub = createUpstreamStub({ projectId: "proj" });
  stub.seedUser("tokA", { localId: "uA", providers: [{ providerId: "password", rawId: "x@y" }] });
  stub.seedRun("uA", "aaaa0001");
  const r = await makeCore(stub).claim({ idToken: "tokA" });
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { ok: false, error: "NOT_LINKED" });
  assert.equal(mutations(stub).length, 0);
});

test("claim: an anonymous caller (no providers) is NOT_LINKED too", async () => {
  const stub = createUpstreamStub({ projectId: "proj" });
  stub.seedUser("tokA", { localId: "uA", providers: [] });
  const r = await makeCore(stub).claim({ idToken: "tokA" });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "NOT_LINKED");
});

test("claim: INVALID_ID_TOKEN, TOKEN_EXPIRED, USER_NOT_FOUND and USER_DISABLED are 401 UNAUTHENTICATED", async () => {
  for (const code of ["INVALID_ID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND", "USER_DISABLED"]) {
    const stub = createUpstreamStub({ projectId: "proj" });
    stub.seedUser("tokX", { error: code });
    const r = await makeCore(stub).claim({ idToken: "tokX" });
    assert.equal(r.status, 401, code);
    assert.deepEqual(r.body, { ok: false, error: "UNAUTHENTICATED" }, code);
    assert.equal(mutations(stub).length, 0);
  }
  const stub = createUpstreamStub({ projectId: "proj" });
  const r = await makeCore(stub).claim({ idToken: "never-seen" });
  assert.equal(r.status, 401);
  const empty = await makeCore(stub).claim({ idToken: "" });
  assert.equal(empty.status, 401);
});

test("claim: a 5xx or a network failure from accounts:lookup is 502 UPSTREAM", async () => {
  const stub = linkedStub();
  stub.failNext(/accounts:lookup/, () => new Response("{}", { status: 503 }));
  const r1 = await makeCore(stub).claim({ idToken: "tokA" });
  assert.equal(r1.status, 502);
  assert.deepEqual(r1.body, { ok: false, error: "UPSTREAM" });
  stub.failNext(/accounts:lookup/, new Error("socket hang up"));
  const r2 = await makeCore(stub).claim({ idToken: "tokA" });
  assert.equal(r2.status, 502);
  assert.equal(mutations(stub).length, 0);
});

test("claim: a failing admin token (metadata server down) is 502 UPSTREAM, never a throw", async () => {
  const stub = linkedStub();
  const core = makeCore(stub, { getAdminToken: async () => { throw new Error("no metadata"); } });
  const r = await core.claim({ idToken: "tokA" });
  assert.equal(r.status, 502);
});

test("claim: nameOverrides/{uid} wins over the Play Games name and is reported as overridden", async () => {
  const stub = linkedStub();
  stub.seedDoc("nameOverrides/uA", { name: "  The   Overlord ", at: "2026-09-30T00:00:00Z" });
  stub.seedRun("uA", "aaaa0001");
  const r = await makeCore(stub).claim({ idToken: "tokA" });
  assert.deepEqual(r.body, { ok: true, name: "The Overlord", overridden: true, stamped: 1, adopted: 0 });
  assert.equal(field(stub.getDoc("names/uA"), "name"), "The Overlord");
  assert.equal(field(stub.getDoc("runs/uA_aaaa0001"), "handle"), "The Overlord");
});

test("claim: a provider displayName that sanitizes to nothing is 422 NO_NAME, with zero writes", async () => {
  for (const displayName of ["\u200B\u0007", "   ", null]) {
    const stub = linkedStub({ displayName });
    const r = await makeCore(stub).claim({ idToken: "tokA" });
    assert.equal(r.status, 422);
    assert.deepEqual(r.body, { ok: false, error: "NO_NAME" });
    assert.equal(mutations(stub).length, 0);
  }
});

test("claim: a name sent by the client is never read (only idToken, adoptIdToken and gamesAuthCode are)", async () => {
  const stub = linkedStub();
  const r = await makeCore(stub).claim({ idToken: "tokA", name: "Evil Name", handle: "Evil" });
  assert.equal(r.body.name, "Moss Knuckle");
});

// --- NAME_SOURCE=games -------------------------------------------------------

function gamesCore(stub, over = {}) {
  return makeCore(stub, { nameSource: "games", pgsClientId: "web-id.apps.googleusercontent.com", pgsClientSecret: "SECRET-VALUE", ...over });
}

test("games source: no gamesAuthCode is 409 NEEDS_GAMES_CODE", async () => {
  const stub = linkedStub({ displayName: "Real Name Leak" });
  const r = await gamesCore(stub).claim({ idToken: "tokA" });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { ok: false, error: "NEEDS_GAMES_CODE" });
  assert.equal(mutations(stub).length, 0);
});

test("games source: the code is exchanged, players/me must match the linked rawId, and its displayName is the name", async () => {
  const stub = linkedStub({ displayName: "Real Name Leak" });
  stub.setOauth("fresh-code", "games-access");
  stub.setPlayer("games-access", { playerId: "player-1", displayName: "GamerTagOnly" });
  stub.seedRun("uA", "aaaa0001");
  const r = await gamesCore(stub).claim({ idToken: "tokA", gamesAuthCode: "fresh-code" });
  assert.equal(r.status, 200);
  assert.equal(r.body.name, "GamerTagOnly");
  assert.equal(field(stub.getDoc("runs/uA_aaaa0001"), "handle"), "GamerTagOnly");

  const tok = stub.calls.find((c) => c.url.startsWith("https://oauth2.googleapis.com/token"));
  assert.match(tok.headers["Content-Type"], /application\/x-www-form-urlencoded/);
  const form = new URLSearchParams(tok.rawBody);
  assert.equal(form.get("code"), "fresh-code");
  assert.equal(form.get("client_id"), "web-id.apps.googleusercontent.com");
  assert.equal(form.get("client_secret"), "SECRET-VALUE");
  assert.equal(form.get("redirect_uri"), "");
  assert.equal(form.get("grant_type"), "authorization_code");
  const me = stub.calls.find((c) => c.url.startsWith("https://games.googleapis.com/games/v1/players/me"));
  assert.equal(me.headers.Authorization, "Bearer games-access");
  assert.equal(JSON.stringify(r).includes("SECRET-VALUE"), false);
});

test("games source: a different playerId is 403 GAMES_MISMATCH and nothing is written", async () => {
  const stub = linkedStub();
  stub.setOauth("c", "acc");
  stub.setPlayer("acc", { playerId: "somebody-else", displayName: "Not You" });
  const r = await gamesCore(stub).claim({ idToken: "tokA", gamesAuthCode: "c" });
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { ok: false, error: "GAMES_MISMATCH" });
  assert.equal(mutations(stub).length, 0);
  assert.equal(JSON.stringify(r).includes("SECRET-VALUE"), false);
});

test("games source: a spent or invalid code asks for a fresh one; a Games API outage is 502", async () => {
  const stub = linkedStub();
  const bad = await gamesCore(stub).claim({ idToken: "tokA", gamesAuthCode: "spent" });
  assert.equal(bad.status, 409);
  assert.equal(bad.body.error, "NEEDS_GAMES_CODE");

  stub.setOauth("c", "acc");
  stub.setPlayer("acc", { playerId: "player-1", displayName: "G" });
  stub.failNext(/players\/me/, () => new Response("{}", { status: 503 }));
  const down = await gamesCore(stub).claim({ idToken: "tokA", gamesAuthCode: "c" });
  assert.equal(down.status, 502);
  assert.equal(down.body.error, "UPSTREAM");
});

test("games source: an override still wins without a code", async () => {
  const stub = linkedStub();
  stub.seedDoc("nameOverrides/uA", { name: "Overridden", at: "x" });
  const r = await gamesCore(stub).claim({ idToken: "tokA" });
  assert.equal(r.status, 200);
  assert.equal(r.body.overridden, true);
});

test("games source without a configured client id or secret is 500 INTERNAL, never a leak", async () => {
  const stub = linkedStub();
  const r = await makeCore(stub, { nameSource: "games" }).claim({ idToken: "tokA", gamesAuthCode: "c" });
  assert.equal(r.status, 500);
  assert.deepEqual(r.body, { ok: false, error: "INTERNAL" });
});

// --- adopt -------------------------------------------------------------------

test("adopt: every run of a provider-less uid moves to the caller under the verified name, then the source is deleted", async () => {
  const stub = linkedStub();
  stub.seedUser("tokAnon", { localId: "uAnon", providers: [] });
  for (let i = 0; i < 450; i++) stub.seedRun("uAnon", String(20000000 + i), { floor: 4, steps: 200 + i });
  stub.seedRun("uA", "aaaa0001"); // the caller's own run, stamped not adopted
  const r = await makeCore(stub).claim({ idToken: "tokA", adoptIdToken: "tokAnon" });

  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, name: "Moss Knuckle", overridden: false, stamped: 1, adopted: 450 });
  for (const i of [0, 1, 199, 200, 449]) {
    const hash = String(20000000 + i);
    const moved = stub.getDoc(`runs/uA_${hash}`);
    assert.ok(moved, `moved run ${hash}`);
    assert.equal(field(moved, "uid"), "uA");
    assert.equal(field(moved, "handle"), "Moss Knuckle");
    assert.equal(field(moved, "deepKey"), 4 * 1000000 + (200 + i), "deepKey recomputed with the current formula");
    assert.equal(field(moved, "createdAt"), "2026-09-20T10:00:00.000Z", "createdAt copied");
    assert.equal(field(moved, "hash"), hash);
    assert.equal(field(moved, "version"), "2.2.0 (12)");
    assert.equal(field(moved, "name"), "Aldric Vane");
    assert.equal(field(moved, "epitaph"), "");
    assert.equal(stub.getDoc(`runs/uAnon_${hash}`), null, "source deleted");
  }
  for (const w of stub.calls.filter((c) => c.url.endsWith(":commit"))) assert.ok(w.body.writes.length <= 400);
  const adoptCommits = stub.calls.filter((c) => c.url.endsWith(":commit") && c.body.writes.some((x) => x.delete));
  assert.equal(adoptCommits.length, 3, "200 + 200 + 50 runs");
  // adopt happens before the stamp pass
  const firstAdopt = stub.calls.findIndex((c) => c.url.endsWith(":commit") && c.body.writes.some((x) => x.delete));
  const firstStamp = stub.calls.findIndex((c) => c.url.endsWith(":commit") && c.body.writes.some((x) => x.updateMask));
  assert.ok(firstAdopt < firstStamp);
  for (const c of adoptCommits) {
    for (const w of c.body.writes.filter((x) => x.update)) assert.equal(w.currentDocument, undefined, "a plain idempotent update");
  }
});

test("adopt: refused for an invalid token, the caller's own uid, or an account that has a provider; nothing moves", async () => {
  for (const [label, setup, adoptIdToken] of [
    ["invalid token", () => {}, "garbage"],
    ["same uid", (s) => s.seedUser("tokSame", { localId: "uA", providers: [] }), "tokSame"],
    ["caller's own token", () => {}, "tokA"],
    ["has a provider", (s) => s.seedUser("tokOther", { localId: "uOther", providers: [{ providerId: PG, rawId: "p2", displayName: "Other" }] }), "tokOther"],
    ["has a password provider", (s) => s.seedUser("tokPw", { localId: "uPw", providers: [{ providerId: "password", rawId: "a@b" }] }), "tokPw"],
  ]) {
    const stub = linkedStub();
    setup(stub);
    stub.seedRun("uOther", "ccccc001");
    stub.seedRun("uPw", "ccccc002");
    stub.seedRun("uAnon", "ccccc003");
    const r = await makeCore(stub).claim({ idToken: "tokA", adoptIdToken });
    assert.equal(r.status, 403, label);
    assert.deepEqual(r.body, { ok: false, error: "ADOPT_REFUSED" }, label);
    assert.equal(mutations(stub).length, 0, label);
  }
});

test("adopt: an upstream failure while verifying the adopt token is 502, with zero writes", async () => {
  const stub = linkedStub();
  stub.seedUser("tokAnon", { localId: "uAnon", providers: [] });
  let n = 0;
  const orig = stub.fetchFn;
  const flaky = async (u, init) => {
    if (String(u).includes("accounts:lookup") && JSON.parse(init.body).idToken === "tokAnon") {
      n += 1;
      return new Response("{}", { status: 500 });
    }
    return orig(u, init);
  };
  const r = await makeCore(stub, { fetchFn: flaky }).claim({ idToken: "tokA", adoptIdToken: "tokAnon" });
  assert.equal(n, 1);
  assert.equal(r.status, 502);
  assert.equal(mutations(stub).length, 0);
});

// --- stamp -------------------------------------------------------------------

test("stamp(uid, name): rewrites only handle, only where it differs, and reports ok and the count", async () => {
  const stub = linkedStub();
  stub.seedRun("uA", "aaaa0001", { handle: "@legacy one" });
  stub.seedRun("uA", "aaaa0002", { handle: "Fine Name" });
  const r = await makeCore(stub).stamp("uA", "Fine Name");
  assert.deepEqual(r, { ok: true, stamped: 1 });
  assert.equal(field(stub.getDoc("runs/uA_aaaa0001"), "handle"), "Fine Name");
  assert.deepEqual(await makeCore(stub).stamp("uNobody", "X"), { ok: true, stamped: 0 });
});

test("stamp: a failed commit reports ok false and never throws", async () => {
  const stub = linkedStub();
  stub.seedRun("uA", "aaaa0001");
  stub.failNext(/:commit/, () => new Response("{}", { status: 500 }));
  const r = await makeCore(stub).stamp("uA", "Name");
  assert.equal(r.ok, false);
});

// --- release -----------------------------------------------------------------

test("release: deletes names/{uid} for a valid token, with or without a Play Games provider", async () => {
  const stub = linkedStub();
  stub.seedDoc("names/uA", { name: "Moss Knuckle", updatedAt: "x" });
  stub.seedUser("tokNoPg", { localId: "uC", providers: [] });
  stub.seedDoc("names/uC", { name: "Orphan", updatedAt: "x" });
  const core = makeCore(stub);
  const a = await core.release({ idToken: "tokA" });
  assert.deepEqual(a, { status: 200, body: { ok: true, released: true } });
  assert.equal(stub.getDoc("names/uA"), null);
  const c = await core.release({ idToken: "tokNoPg" });
  assert.equal(c.status, 200);
  assert.equal(stub.getDoc("names/uC"), null);
});

test("release: an invalid token is 401 and deletes nothing; nameOverrides survives a release", async () => {
  const stub = linkedStub();
  stub.seedDoc("names/uA", { name: "Moss Knuckle", updatedAt: "x" });
  stub.seedDoc("nameOverrides/uA", { name: "Held", at: "x" });
  const bad = await makeCore(stub).release({ idToken: "nope" });
  assert.equal(bad.status, 401);
  assert.ok(stub.getDoc("names/uA"));
  await makeCore(stub).release({ idToken: "tokA" });
  assert.ok(stub.getDoc("nameOverrides/uA"), "moderation state is not the player's to erase");
});

// --- lookup ------------------------------------------------------------------

test("lookup(idToken): the caller's uid and Play Games entry, or the failure status", async () => {
  const stub = linkedStub();
  const core = makeCore(stub);
  const ok = await core.lookup("tokA");
  assert.equal(ok.ok, true);
  assert.equal(ok.uid, "uA");
  assert.equal(ok.playGames.rawId, "player-1");
  const bad = await core.lookup("nope");
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 401);
});

// --- metadataTokenGetter -----------------------------------------------------

test("metadataTokenGetter: fetches once with the Metadata-Flavor header and reuses the token until 60 s before expiry", async () => {
  let t = 1_000_000;
  const seen = [];
  const fetchFn = async (u, init) => {
    seen.push({ u, init });
    return new Response(JSON.stringify({ access_token: `tok-${seen.length}`, expires_in: 300, token_type: "Bearer" }), { status: 200 });
  };
  const get = metadataTokenGetter({ fetchFn, now: () => t });
  assert.equal(await get(), "tok-1");
  assert.equal(await get(), "tok-1");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].u, "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token");
  assert.equal(seen[0].init.headers["Metadata-Flavor"], "Google");
  t += 239_000; // 1 s before the 60 s guard
  assert.equal(await get(), "tok-1");
  t += 2_000; // inside the 60 s guard
  assert.equal(await get(), "tok-2");
  assert.equal(seen.length, 2);
});

test("metadataTokenGetter: a failed fetch rejects (the core turns it into 502) and is retried next call", async () => {
  let n = 0;
  const fetchFn = async () => {
    n += 1;
    if (n === 1) return new Response("{}", { status: 500 });
    return new Response(JSON.stringify({ access_token: "ok", expires_in: 3600 }), { status: 200 });
  };
  const get = metadataTokenGetter({ fetchFn, now: () => 0 });
  await assert.rejects(get());
  assert.equal(await get(), "ok");
});

// --- module hygiene ----------------------------------------------------------

test("core.js imports nothing outside node built-ins and its own directory", () => {
  const src = fs.readFileSync(CORE_PATH, "utf8").replace(/\r\n/g, "\n");
  const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l));
  for (const line of imports) assert.match(line, /from\s+["'](node:[a-z/:_-]+|\.\/[^"']+)["']/, line);
  assert.equal(/\brequire\(/.test(src), false);
  assert.ok((src.match(/accounts:lookup/g) ?? []).length >= 1);
});
