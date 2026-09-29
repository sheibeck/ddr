// src/browser/bugReportConfig.js
//
// Phase 79.3 (D-03) / Phase 83 (SRV-04): the project id and API key now come
// from the one shared src/browser/firebaseConfig.js — this module just adds
// the bugReports collection name on top. The key is a public identifier
// restricted to the Cloud Firestore API, not a secret.

import { FIREBASE_CONFIG } from "./firebaseConfig.js";

export const BUG_REPORT_CONFIG = Object.freeze({
  projectId: FIREBASE_CONFIG.projectId,
  apiKey: FIREBASE_CONFIG.apiKey,
  collection: "bugReports",
});
