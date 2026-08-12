/**
 * main の最新 Production READY デプロイを Current にし、PWA 本番 URL へ付け替える。
 *
 * 背景: autoAssignCustomDomains=false だと Production が STAGED のまま残り、
 * app-nine-phi-bomgfkrycz.vercel.app が古いデプロイを指し続ける。
 *
 * 必要 env: VERCEL_ORG_ID, VERCEL_PROJECT_ID
 * 任意: VERCEL_TOKEN（CI 用）, PRODUCTION_ALIAS, GITHUB_SHA
 */
import { spawnSync } from "node:child_process";

const ORG = process.env.VERCEL_ORG_ID;
const PROJECT = process.env.VERCEL_PROJECT_ID;
const TOKEN = process.env.VERCEL_TOKEN?.trim() || "";
const ALIAS = process.env.PRODUCTION_ALIAS || "app-nine-phi-bomgfkrycz.vercel.app";
const WANT_SHA = (process.env.GITHUB_SHA || "").trim();
const TEAM_Q = `teamId=${encodeURIComponent(ORG || "")}`;

if (!ORG || !PROJECT) {
  console.error("VERCEL_ORG_ID / VERCEL_PROJECT_ID が必要です");
  process.exit(1);
}

function runVercel(args, { input, allowFail = false } = {}) {
  const full = ["vercel", ...args, "--scope", ORG];
  // promote だけ確認スキップが必要。alias は --yes 非対応。
  if (args[0] === "promote") full.push("--yes");
  if (TOKEN) full.push("--token", TOKEN);
  const res = spawnSync("npx", full, {
    encoding: "utf8",
    input,
    maxBuffer: 10 * 1024 * 1024,
    shell: true,
  });
  const stdout = res.stdout || "";
  const stderr = res.stderr || "";
  if (res.status !== 0 && !allowFail) {
    throw new Error(`vercel ${args[0]} failed (${res.status}): ${stderr || stdout}`);
  }
  return { stdout, stderr, status: res.status };
}

function vercelApi(path, { method = "GET", body } = {}) {
  // Windows shell で & が切られないようパス全体を引用符で囲む
  const quotedPath = `"${path}"`;
  const args = ["api", quotedPath];
  if (method !== "GET") args.push("-X", method);
  if (body) args.push("--input", "-");
  const { stdout } = runVercel(args, { input: body ? JSON.stringify(body) : undefined });
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error(`vercel api の応答が JSON ではありません: ${stdout.slice(0, 240)}`);
  }
  return JSON.parse(stdout.slice(start, end + 1));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureAutoAssign() {
  const project = vercelApi(`/v9/projects/${PROJECT}?${TEAM_Q}`);
  if (project.autoAssignCustomDomains === true) {
    console.log("autoAssignCustomDomains: already true");
    return;
  }
  console.log("autoAssignCustomDomains: enabling...");
  vercelApi(`/v9/projects/${PROJECT}?${TEAM_Q}`, {
    method: "PATCH",
    body: { autoAssignCustomDomains: true },
  });
  console.log("autoAssignCustomDomains: enabled");
}

function listProductionDeployments() {
  const data = vercelApi(
    `/v6/deployments?projectId=${encodeURIComponent(PROJECT)}&${TEAM_Q}&target=production&limit=20`,
  );
  return data.deployments || [];
}

async function findReadyProduction(deadlineMs) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    const deployments = listProductionDeployments();
    const ready = deployments.filter((d) => (d.state || d.readyState) === "READY");
    if (WANT_SHA) {
      const pick = ready.find((d) => d.meta?.githubCommitSha === WANT_SHA);
      if (pick) return pick;
      const pending = deployments.find(
        (d) =>
          d.meta?.githubCommitSha === WANT_SHA &&
          ["BUILDING", "QUEUED", "INITIALIZING"].includes(d.state || d.readyState),
      );
      if (pending) {
        console.log(`waiting for ${WANT_SHA.slice(0, 7)} (${pending.state || pending.readyState})...`);
        await sleep(8000);
        continue;
      }
      const errored = deployments.find(
        (d) =>
          d.meta?.githubCommitSha === WANT_SHA &&
          ["ERROR", "CANCELED"].includes(d.state || d.readyState),
      );
      if (errored) {
        throw new Error(
          `commit ${WANT_SHA.slice(0, 7)} の Production が ${errored.state || errored.readyState} のため promote しません`,
        );
      }
      console.log(`waiting for deployment of ${WANT_SHA.slice(0, 7)}...`);
      await sleep(8000);
      continue;
    }
    if (ready[0]) return ready[0];
    console.log("no READY production yet, waiting...");
    await sleep(8000);
  }
  throw new Error("timeout: READY な Production デプロイが見つかりません");
}

function promoteAndAlias(deployment) {
  const host = String(deployment.url).replace(/^https?:\/\//, "");
  const url = `https://${host}`;
  console.log(
    `promoting ${deployment.uid || deployment.id} (${url}) sha=${deployment.meta?.githubCommitSha || "?"} substate=${deployment.readySubstate || "?"}`,
  );

  const promoted = runVercel(["promote", url], { allowFail: true });
  const promoteMsg = `${promoted.stdout}${promoted.stderr}`;
  if (promoted.status === 0) {
    console.log("promote: ok");
  } else if (/already the current production/i.test(promoteMsg)) {
    console.log("promote: already current");
  } else {
    console.warn(`promote warning: ${promoteMsg.slice(0, 400)}`);
  }

  const aliased = runVercel(["alias", "set", url, ALIAS]);
  console.log((aliased.stdout || aliased.stderr || "").trim() || `alias: ${ALIAS} -> ${url}`);
}

async function main() {
  if (!TOKEN) console.log("VERCEL_TOKEN unset: using local vercel login session");
  ensureAutoAssign();
  const deployment = await findReadyProduction(10 * 60 * 1000);
  promoteAndAlias(deployment);
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
