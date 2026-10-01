// test/unit/board-names-deploy.test.js
//
// Phase 91.2-02 Task 2 (D-01, D-14). tools/board-names/deploy.mjs: the one
// reviewed gcloud command that deploys the boardName function, dry-run by
// default. The live deploy is 91.2-10's user-gated step; nothing here runs
// gcloud.

import test from "node:test";
import assert from "node:assert/strict";

import { buildDeployArgs, setupCommands, functionUrl, secretInstructions, runDeploy } from "../../tools/board-names/deploy.mjs";
import { BOARD_NAME_FN, FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";

const PROJECT = "delve-die-repeat-6ba5f";

test("buildDeployArgs() is the exact 2nd-gen deploy of boardName, provider source", () => {
  const args = buildDeployArgs();
  assert.deepEqual(args.slice(0, 3), ["functions", "deploy", "boardName"]);
  for (const flag of [
    "--gen2",
    "--runtime=nodejs22",
    "--region=us-central1",
    "--source=functions/board-names",
    "--entry-point=boardName",
    "--trigger-http",
    "--allow-unauthenticated",
    `--service-account=board-names@${PROJECT}.iam.gserviceaccount.com`,
    "--max-instances=3",
    "--memory=256Mi",
    "--timeout=60s",
    "--set-env-vars=NAME_SOURCE=provider",
    `--project=${PROJECT}`,
  ]) {
    assert.ok(args.includes(flag), `missing ${flag}`);
  }
  assert.equal(args.some((a) => a.startsWith("--set-secrets")), false);
});

test("buildDeployArgs for the games source adds the client id env var and the secret binding, never a secret value", () => {
  const args = buildDeployArgs({ nameSource: "games", pgsClientId: "123-abc.apps.googleusercontent.com" });
  const env = args.find((a) => a.startsWith("--set-env-vars="));
  assert.equal(env, "--set-env-vars=NAME_SOURCE=games,PGS_WEB_CLIENT_ID=123-abc.apps.googleusercontent.com");
  assert.ok(args.includes("--set-secrets=PGS_WEB_CLIENT_SECRET=pgs-web-client-secret:latest"));
  assert.equal(args.filter((a) => a.startsWith("--set-env-vars")).length, 1);
});

test("games without a client id, or an unknown source, throws a usage error", () => {
  assert.throws(() => buildDeployArgs({ nameSource: "games" }), (e) => e.code === "USAGE");
  assert.throws(() => buildDeployArgs({ nameSource: "bogus" }), (e) => e.code === "USAGE");
  assert.throws(() => buildDeployArgs({ nameSource: "games", pgsClientId: "not an id" }), (e) => e.code === "USAGE");
});

test("setupCommands() lists the API enables, the service account and the datastore.user binding", () => {
  const cmds = setupCommands();
  const text = cmds.map((c) => c.join(" ")).join("\n");
  for (const api of ["cloudfunctions", "cloudbuild", "artifactregistry", "run"]) {
    assert.match(text, new RegExp(`${api}\\.googleapis\\.com`));
  }
  assert.match(text, /services enable/);
  assert.match(text, /iam service-accounts create board-names/);
  assert.match(text, new RegExp(`projects add-iam-policy-binding ${PROJECT} --member=serviceAccount:board-names@${PROJECT}\\.iam\\.gserviceaccount\\.com --role=roles/datastore\\.user`));
  for (const c of cmds) assert.ok(c.every((a) => typeof a === "string"));
  assert.match(text, new RegExp(`--project=${PROJECT}`));
});

test("setupCommands for games also enables secretmanager; secretInstructions explains the secret without a value", () => {
  const text = setupCommands({ nameSource: "games", pgsClientId: "1-a.apps.googleusercontent.com" }).map((c) => c.join(" ")).join("\n");
  assert.match(text, /secretmanager\.googleapis\.com/);
  const lines = secretInstructions({ nameSource: "games" }).join("\n");
  assert.match(lines, /gcloud secrets create pgs-web-client-secret/);
  assert.match(lines, /--data-file=/);
  assert.match(lines, /outside the repo/i);
  assert.match(lines, /roles\/secretmanager\.secretAccessor/);
  assert.deepEqual(secretInstructions({ nameSource: "provider" }), []);
});

test("the expected function URL from the deploy defaults equals BOARD_NAME_FN.url", () => {
  assert.equal(functionUrl(), BOARD_NAME_FN.url);
  assert.equal(functionUrl({ project: "p1", region: "europe-west1" }), "https://europe-west1-p1.cloudfunctions.net/boardName");
  assert.equal(FIREBASE_CONFIG.projectId, PROJECT);
});

function harness(argv) {
  const ran = [];
  const out = [];
  const err = [];
  return {
    ran,
    out,
    err,
    run: async () => runDeploy({ argv, run: (cmd) => { ran.push(cmd); return ""; }, out: (l) => out.push(l), err: (l) => err.push(l) }),
  };
}

test("the CLI without --yes prints the deploy command and runs nothing", async () => {
  const h = harness([]);
  assert.equal(await h.run(), 0);
  assert.equal(h.ran.length, 0);
  assert.ok(h.out.some((l) => l.includes("functions deploy boardName")));
  assert.ok(h.out.some((l) => /dry run/i.test(l)));
});

test("--setup prints the setup commands before the deploy; still nothing runs without --yes", async () => {
  const h = harness(["--setup"]);
  assert.equal(await h.run(), 0);
  assert.equal(h.ran.length, 0);
  const text = h.out.join("\n");
  assert.ok(text.indexOf("services enable") < text.indexOf("functions deploy boardName"));
  assert.match(text, /datastore\.user/);
});

test("--setup --name-source games prints how to create the secret and never asks for its value", async () => {
  const h = harness(["--setup", "--name-source", "games", "--pgs-client-id", "1-a.apps.googleusercontent.com"]);
  assert.equal(await h.run(), 0);
  const text = h.out.join("\n");
  assert.match(text, /gcloud secrets create pgs-web-client-secret/);
  assert.match(text, /--set-secrets=PGS_WEB_CLIENT_SECRET=pgs-web-client-secret:latest/);
});

test("--yes runs every printed command in order through the injected runner; a failure is exit 1", async () => {
  const h = harness(["--yes"]);
  assert.equal(await h.run(), 0);
  assert.equal(h.ran.length, 1);
  assert.match(h.ran[0], /^gcloud functions deploy boardName /);

  const s = harness(["--setup", "--yes"]);
  assert.equal(await s.run(), 0);
  assert.equal(s.ran.length, 4);
  assert.match(s.ran[s.ran.length - 1], /functions deploy boardName/);

  const failing = { ran: [], out: [], err: [] };
  const code = await runDeploy({ argv: ["--setup", "--yes"], run: (cmd) => { failing.ran.push(cmd); if (failing.ran.length === 2) throw new Error("denied"); return ""; }, out: (l) => failing.out.push(l), err: (l) => failing.err.push(l) });
  assert.equal(code, 1);
  assert.equal(failing.ran.length, 2, "stops at the first failure");
});

test("usage errors are exit 2: games without a client id, an unknown source, an unknown flag, a secret on the command line", async () => {
  for (const argv of [["--name-source", "games"], ["--name-source", "bogus"], ["--frobnicate"], ["--pgs-client-secret", "hunter2"]]) {
    const h = harness(argv);
    assert.equal(await h.run(), 2, argv.join(" "));
    assert.equal(h.ran.length, 0);
    assert.equal(h.out.concat(h.err).join("\n").includes("hunter2"), false, "a secret is never echoed");
  }
});

test("importing the module runs no command (main is guarded)", async () => {
  const mod = await import("../../tools/board-names/deploy.mjs");
  assert.equal(typeof mod.runDeploy, "function");
});
