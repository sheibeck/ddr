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

const API_KEY_RE = /^AIza[0-9A-Za-z_-]{35}$/;
const PROJECT_ID_RE = /^[a-z0-9-]{6,30}$/;

/** firebaseConfigured(config) — a restricted-looking key and a plausible project id, both present. */
export function firebaseConfigured(config) {
  if (typeof config !== "object" || config === null) return false;
  const keyOk = typeof config.apiKey === "string" && API_KEY_RE.test(config.apiKey);
  const idOk = typeof config.projectId === "string" && PROJECT_ID_RE.test(config.projectId);
  return keyOk && idOk;
}
