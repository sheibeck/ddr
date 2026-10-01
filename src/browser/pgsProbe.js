// src/browser/pgsProbe.js
//
// Phase 91.2 (BOARD-31), spike gates G1, G3, G4, A3, A4, A6 (91.2-CONTEXT
// "Spike gates"). The device probe behind the hidden dev row (91.2-08 wires
// the button; this module is the harness): one call walks the Play Games
// sign-in through Firebase Identity Toolkit and answers, gate by gate, whether
// the design's assumptions hold on a real device against the LIVE project.
// It runs once 91.2-10's console steps and the provider enable are done; until
// then (and in `node --test`) it runs against the fake board server and the
// fake PlayIdentity, which model every outcome offline.
//
//   init-status   init() and status(); one interactive signIn() when signed out.
//                 A6 (the lazy SDK init works): signed in after init.
//   idp-sign-in   serverAuthCode, then accounts:signInWithIdp WITHOUT an
//                 idToken. G4 (the reused configuration works with Firebase):
//                 the exchange succeeded.
//   claims        the returned ID token's payload decoded, unverified. A3 (the
//                 token lists the Play Games identity); "skip" when the token
//                 is not a JWT. The rules do not depend on A3.
//   lookup        accounts:lookup. G1 (the provider stores the gamer name, not
//                 the real name): "check" when the provider name equals the
//                 local Play Games name (the human confirms it is the gamer
//                 name), "fail" when it is missing or different.
//   tamper        A4 (an end user cannot edit providerUserInfo): rename the
//                 TOP-LEVEL displayName, attempt linkProviderUserInfo (must be
//                 refused), look again (the provider's name must not move),
//                 then restore the top-level displayName.
//   second-link   G3 (a second link answers ALREADY_LINKED): a throwaway
//                 anonymous account tries to link the same player.
//   cleanup       always: delete the throwaway account, and the Play Games
//                 account only when the probe itself created it (isNewUser). A
//                 player's pre-existing account is never deleted.
//
// NON-INVASIVE AND SECRET-FREE. The probe never touches `ddr.identity.*` or
// any storage and never logs. It keeps every token in a local variable and
// reports none: the report carries booleans, error codes, uid prefixes (6
// characters) and the player id only as the boolean rawIdMatchesPlayer. The
// one human-readable value is the provider's display name (it is the public
// gamer name when G1 holds, and the user needs to see it to make the G1 call).
// If the forged-link attempt were ever accepted (A4 failing), the player's own
// provider entry could carry the forged label until their next sign-in
// refreshes it; the probe says so as A4 "fail" and the redeploy fallback
// (NAME_SOURCE=games) does not depend on that entry.
//
// Pure, DOM-free, never throws: every seam (PlayIdentity, fetchFn, clock) is
// injected, and a failing seam is recorded as a failed step. Exports only
// runPgsProbe (no player-facing text lives here).

import { FIREBASE_CONFIG, PLAY_GAMES_CONFIG } from "./firebaseConfig.js";
import { IDENTITY_BASE, timedFetch, readJson, restError } from "./firestoreRest.js";

const PROVIDER_ID = "playgames.google.com";
const TAMPER_NAME = "pgs-probe-tamper";
const FORGED_NAME = "pgs-probe-forged";
const ALREADY_LINKED = "FEDERATED_USER_ID_ALREADY_LINKED";
const CODE_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

const STEP_IDS = Object.freeze(["init-status", "idp-sign-in", "claims", "lookup", "tamper", "second-link", "cleanup"]);

// ---------------------------------------------------------------------------
// small pure helpers
// ---------------------------------------------------------------------------

// An error code safe to put in a report: the server's first token when it
// looks like a code, else a generic word. Never free text.
function safeCode(message) {
  const first = typeof message === "string" ? message.split(/[\s:]/)[0] : "";
  return CODE_RE.test(first) ? first : "unknown";
}

function prefixOf(uid) {
  return typeof uid === "string" ? uid.slice(0, 6) : "";
}

// The JSON payload of a three-part JWT (no verification), or null.
function decodeJwtPayload(token) {
  try {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts[1] === "") return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const binary = globalThis.atob(b64);
    const percent = Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
    const value = JSON.parse(decodeURIComponent(percent));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// ---------------------------------------------------------------------------
// the probe
// ---------------------------------------------------------------------------

/**
 * runPgsProbe({ playIdentity, fetchFn, config, playConfig, now }) — resolves a
 * frozen report { v: 1, at, steps: [{ id, ok, facts }], gates: { G1, G3, G4,
 * A3, A4, A6 } }; each gate is "pass" | "fail" | "check" (needs the human's
 * eye, or could not be evaluated) | "skip". Never throws.
 */
export async function runPgsProbe({
  playIdentity,
  fetchFn,
  config = FIREBASE_CONFIG,
  playConfig = PLAY_GAMES_CONFIG,
  now = Date.now,
} = {}) {
  const steps = new Map();
  const gates = { G1: "skip", G3: "skip", G4: "skip", A3: "skip", A4: "skip", A6: "fail" };

  // What the probe holds between steps. Tokens live only here.
  const held = {
    signedIn: false,
    playerId: "",
    localName: "",
    session: null, // { idToken, uid } of the Play Games account
    probeCreated: false, // the probe made the Play Games account (isNewUser)
    throwaway: null, // { idToken } of the throwaway anonymous account
    provider: null, // the provider entry seen by the lookup step
    topLevelName: undefined, // the top-level displayName before the tamper step
  };

  const record = (id, ok, facts = {}) => {
    steps.set(id, { id, ok: ok === true, facts });
  };
  const skip = (id, reason) => record(id, false, { skipped: true, reason });

  async function seam(method, args) {
    try {
      if (!playIdentity || typeof playIdentity[method] !== "function") return { ok: false, reason: "unavailable" };
      const result = await playIdentity[method](args);
      return result && typeof result === "object" ? result : { ok: false, reason: "error" };
    } catch {
      return { ok: false, reason: "error" };
    }
  }

  // One Identity Toolkit call: { ok, offline, status, json, error }.
  async function idCall(op, body) {
    const apiKey = config && typeof config.apiKey === "string" ? config.apiKey : "";
    const sent = await timedFetch(fetchFn, `${IDENTITY_BASE}/accounts:${op}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!sent.ok) return { ok: false, offline: true, status: 0, json: null, error: "offline" };
    const json = await readJson(sent.res);
    const errorMessage = json && typeof json.errorMessage === "string" ? json.errorMessage : "";
    const ok = sent.res.ok === true && errorMessage === "";
    let error = "";
    if (!ok) error = errorMessage !== "" ? safeCode(errorMessage) : safeCode(restError(json).message);
    return { ok, offline: false, status: sent.res.status, json, error };
  }

  const exchangeBody = (authCode, idToken) => {
    const body = {
      requestUri: "http://localhost",
      postBody: `code=${encodeURIComponent(authCode)}&providerId=${PROVIDER_ID}`,
      returnSecureToken: true,
      returnIdpCredential: true,
    };
    if (idToken) body.idToken = idToken;
    return body;
  };

  const providerOf = (lookupJson) => {
    const user = Array.isArray(lookupJson?.users) ? lookupJson.users[0] : null;
    const list = Array.isArray(user?.providerUserInfo) ? user.providerUserInfo : [];
    return { user, provider: list.find((p) => p && p.providerId === PROVIDER_ID) ?? null };
  };

  // ---- 1. init-status (A6) -----------------------------------------------
  async function stepInitStatus() {
    const facts = {};
    const init = await seam("init");
    facts.initOk = init.ok === true;
    let status = await seam("status");
    facts.statusOk = status.ok === true;
    if (status.ok === true && status.signedIn !== true) {
      facts.askedToSignIn = true;
      const again = await seam("signIn");
      if (again.ok === true && again.signedIn === true) {
        status = again;
        facts.signedInInteractively = true;
      }
    }
    held.signedIn = status.ok === true && status.signedIn === true && typeof status.playerId === "string" && status.playerId !== "";
    facts.signedIn = held.signedIn;
    if (held.signedIn) {
      held.playerId = status.playerId;
      held.localName = typeof status.displayName === "string" ? status.displayName : "";
    }
    if (init.ok === true && held.signedIn) gates.A6 = "pass";
    else if (init.ok === true && status.ok === true) gates.A6 = "check";
    else gates.A6 = "fail";
    record("init-status", held.signedIn, facts);
  }

  // ---- 2. idp-sign-in (G4) ------------------------------------------------
  async function stepSignIn() {
    if (!held.signedIn) return skip("idp-sign-in", "not-signed-in");
    const code = await seam("serverAuthCode", { serverClientId: playConfig && playConfig.webClientId });
    if (code.ok !== true || typeof code.authCode !== "string" || code.authCode === "") {
      gates.G4 = "fail";
      return record("idp-sign-in", false, { error: typeof code.reason === "string" ? code.reason : "error" });
    }
    const r = await idCall("signInWithIdp", exchangeBody(code.authCode));
    if (r.ok && typeof r.json?.idToken === "string" && typeof r.json?.localId === "string") {
      held.session = { idToken: r.json.idToken, uid: r.json.localId };
      held.probeCreated = r.json.isNewUser === true;
      gates.G4 = "pass";
      return record("idp-sign-in", true, { isNewUser: held.probeCreated, uid: prefixOf(r.json.localId) });
    }
    // A network failure proves nothing about the configuration; an answer does.
    gates.G4 = r.offline ? "check" : "fail";
    return record("idp-sign-in", false, { error: r.error || "unknown", status: r.status });
  }

  // ---- 3. claims (A3) -----------------------------------------------------
  function stepClaims() {
    if (!held.session) return skip("claims", "no-session");
    const payload = decodeJwtPayload(held.session.idToken);
    if (!payload) {
      gates.A3 = "skip";
      return record("claims", true, { jwt: false });
    }
    const firebase = payload.firebase && typeof payload.firebase === "object" ? payload.firebase : {};
    const identities = firebase.identities && typeof firebase.identities === "object" ? firebase.identities : {};
    const has = Object.prototype.hasOwnProperty.call(identities, PROVIDER_ID);
    gates.A3 = has ? "pass" : "fail";
    return record("claims", true, {
      jwt: true,
      signInProvider: typeof firebase.sign_in_provider === "string" ? safeText(firebase.sign_in_provider) : null,
      hasPlayGamesIdentity: has,
    });
  }

  // A short plain label (a provider id), never free text.
  function safeText(value) {
    return /^[A-Za-z0-9._-]{1,64}$/.test(value) ? value : "unknown";
  }

  // ---- 4. lookup (G1) -----------------------------------------------------
  async function stepLookup() {
    if (!held.session) return skip("lookup", "no-session");
    const r = await idCall("lookup", { idToken: held.session.idToken });
    const { user, provider } = providerOf(r.json);
    if (!r.ok || !user) {
      gates.G1 = "check";
      return record("lookup", false, { error: r.error || "unknown" });
    }
    held.topLevelName = typeof user.displayName === "string" ? user.displayName : undefined;
    held.provider = provider;
    const providerName = provider && typeof provider.displayName === "string" ? provider.displayName : "";
    const matches = provider !== null && providerName !== "" && providerName === held.localName;
    gates.G1 = matches ? "check" : "fail";
    return record("lookup", provider !== null, {
      hasProvider: provider !== null,
      providerName,
      providerNameMatchesLocal: matches,
      rawIdMatchesPlayer: provider !== null && String(provider.rawId ?? provider.federatedId ?? "") === held.playerId,
      topLevelDisplayNameSet: held.topLevelName !== undefined,
    });
  }

  // ---- 5. tamper (A4) -----------------------------------------------------
  async function stepTamper() {
    if (!held.session || held.provider === null) return skip("tamper", "no-provider");
    const { idToken } = held.session;
    const beforeName = typeof held.provider.displayName === "string" ? held.provider.displayName : "";
    const facts = {};
    let sawOffline = false;
    let afterRename = null;
    let afterForge = null;
    let restore = { ok: false, offline: true };
    try {
      const rename = await idCall("update", { idToken, displayName: TAMPER_NAME, returnSecureToken: false });
      facts.renameAccepted = rename.ok;
      sawOffline = sawOffline || rename.offline;
      const l1 = await idCall("lookup", { idToken });
      sawOffline = sawOffline || l1.offline;
      afterRename = providerOf(l1.json).provider;

      const forge = await idCall("update", {
        idToken,
        linkProviderUserInfo: { providerId: PROVIDER_ID, rawId: held.playerId, displayName: FORGED_NAME },
      });
      sawOffline = sawOffline || forge.offline;
      facts.refusedLink = !forge.ok && !forge.offline;
      if (!forge.ok) facts.refusal = forge.error || "unknown";
      const l2 = await idCall("lookup", { idToken });
      sawOffline = sawOffline || l2.offline;
      afterForge = providerOf(l2.json).provider;
    } finally {
      // Put the top-level displayName back whatever happened above.
      const body = held.topLevelName === undefined ? { idToken, deleteAttribute: ["DISPLAY_NAME"] } : { idToken, displayName: held.topLevelName };
      restore = await idCall("update", body);
    }
    const nameOf = (p) => (p && typeof p.displayName === "string" ? p.displayName : null);
    facts.providerNameUnchanged = nameOf(afterRename) === beforeName && nameOf(afterForge) === beforeName;
    facts.restored = restore.ok;
    if (sawOffline) gates.A4 = "check";
    else gates.A4 = facts.refusedLink === true && facts.providerNameUnchanged ? "pass" : "fail";
    if (facts.refusedLink === undefined) facts.refusedLink = false;
    return record("tamper", facts.refusedLink === true && restore.ok, facts);
  }

  // ---- 6. second-link (G3) ------------------------------------------------
  async function stepSecondLink() {
    if (!held.session) return skip("second-link", "no-session");
    const made = await idCall("signUp", { returnSecureToken: true });
    if (!made.ok || typeof made.json?.idToken !== "string") {
      gates.G3 = "check";
      return record("second-link", false, { error: made.error || "unknown", stage: "signUp" });
    }
    held.throwaway = { idToken: made.json.idToken };
    const code = await seam("serverAuthCode", { serverClientId: playConfig && playConfig.webClientId });
    if (code.ok !== true || typeof code.authCode !== "string" || code.authCode === "") {
      gates.G3 = "check";
      return record("second-link", false, { error: typeof code.reason === "string" ? code.reason : "error", stage: "code" });
    }
    const r = await idCall("signInWithIdp", exchangeBody(code.authCode, held.throwaway.idToken));
    if (r.error === ALREADY_LINKED) {
      gates.G3 = "pass";
      return record("second-link", true, { answer: ALREADY_LINKED });
    }
    if (r.ok) {
      // The same player linked to a second account: uniqueness is not enforced.
      gates.G3 = "fail";
      return record("second-link", false, { answer: "linked-again" });
    }
    gates.G3 = "check";
    return record("second-link", false, { answer: r.error || "unknown" });
  }

  // ---- 7. cleanup ---------------------------------------------------------
  async function stepCleanup() {
    const facts = {};
    let ok = true;
    if (held.throwaway) {
      const d = await idCall("delete", { idToken: held.throwaway.idToken });
      facts.deletedThrowaway = d.ok;
      if (!d.ok) ok = false;
    }
    if (held.session && held.probeCreated) {
      const d = await idCall("delete", { idToken: held.session.idToken });
      facts.deletedProbeAccount = d.ok;
      if (!d.ok) ok = false;
    } else if (held.session) {
      facts.deletedProbeAccount = false;
      facts.keptExistingAccount = true;
    }
    if (!held.throwaway && !held.session) facts.nothingToClean = true;
    record("cleanup", ok, facts);
  }

  async function guarded(id, fn) {
    try {
      await fn();
    } catch {
      // A bug in a step must not escape; it is a failed step.
      record(id, false, { error: "probe-error" });
    }
  }

  await guarded("init-status", stepInitStatus);
  await guarded("idp-sign-in", stepSignIn);
  await guarded("claims", stepClaims);
  await guarded("lookup", stepLookup);
  await guarded("tamper", stepTamper);
  await guarded("second-link", stepSecondLink);
  await guarded("cleanup", stepCleanup);

  let at = "";
  try {
    at = new Date(now()).toISOString();
  } catch {
    at = "";
  }
  const ordered = STEP_IDS.map((id) => steps.get(id) ?? { id, ok: false, facts: { skipped: true, reason: "not-run" } });
  return deepFreeze({ v: 1, at, steps: ordered, gates });
}
