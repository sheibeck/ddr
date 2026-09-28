// src/browser/bugReportConfig.js
//
// Phase 79.3 (D-03). This is the one place the Firebase project id and the
// Firestore-restricted API key live. The key is a public identifier
// restricted to the Cloud Firestore API, not a secret. 79.3-08 fills it in.
// An empty key means reporting is unavailable.

export const BUG_REPORT_CONFIG = Object.freeze({
  projectId: "delve-die-repeat-6ba5f",
  apiKey: "",
  collection: "bugReports",
});
