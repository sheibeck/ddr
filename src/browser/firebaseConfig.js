// src/browser/firebaseConfig.js
//
// Phase 83 (SRV-04..SRV-08). The ONE shared source of the Firebase project
// id and the public API key — CONTEXT "Queue, backfill & live setup" asks
// for one shared config module reused by bug reports (retiring the
// duplicate that used to live in bugReportConfig.js). The key is a public
// identifier restricted by API (Firestore + Identity Toolkit + Secure
// Token, 83-08), not a secret; it is safe to ship inside www/.

export const FIREBASE_CONFIG = Object.freeze({
  projectId: "delve-die-repeat-6ba5f",
  apiKey: "AIzaSyBMevk4MUgW7enDgE9NR96ItJcaiDV-SaI",
});

// Phase 91.2 (BOARD-31/33). Play Games sign-in configuration.
//  - appId is the REUSED Play Games configuration (D-09). It lives in exactly
//    two places: android/app/src/main/res/values/games-ids.xml and here, and
//    a test keeps them equal. If spike gate G4 fails, runbook path B changes
//    both.
//  - webClientId is the "Game server" OAuth client the user creates at the
//    milestone-close console step (91.2-10 writes it). It is a public id (it
//    ships in the app), not a secret; the client SECRET never enters the repo.
//    Empty until then, so playGamesConfigured() is false and Compete's
//    sign-in path stays dormant.
export const PLAY_GAMES_CONFIG = Object.freeze({
  appId: "517177834262",
  webClientId: "",
});

// The 2nd-gen `boardName` Cloud Function (D-01), us-central1 in the same
// Firebase project as FIREBASE_CONFIG.
export const BOARD_NAME_FN = Object.freeze({
  url: "https://us-central1-delve-die-repeat-6ba5f.cloudfunctions.net/boardName",
});

const WEB_CLIENT_ID_RE = /^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/;
const APP_ID_RE = /^[0-9]{6,}$/;

/** playGamesConfigured(cfg) — a well-formed web client id and app id, both present. */
export function playGamesConfigured(cfg) {
  if (typeof cfg !== "object" || cfg === null) return false;
  return (
    typeof cfg.webClientId === "string" &&
    WEB_CLIENT_ID_RE.test(cfg.webClientId) &&
    typeof cfg.appId === "string" &&
    APP_ID_RE.test(cfg.appId)
  );
}

const API_KEY_RE =/^AIza[0-9A-Za-z_-]{35}$/;
const PROJECT_ID_RE = /^[a-z0-9-]{6,30}$/;

/** firebaseConfigured(config) — a restricted-looking key and a plausible project id, both present. */
export function firebaseConfigured(config) {
  if (typeof config !== "object" || config === null) return false;
  const keyOk = typeof config.apiKey === "string" && API_KEY_RE.test(config.apiKey);
  const idOk = typeof config.projectId === "string" && PROJECT_ID_RE.test(config.projectId);
  return keyOk && idOk;
}
