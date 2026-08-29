#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const PROJECT = "reputifly-leads-2";
const REGION = "asia-southeast1";
const SCHEDULER_IDENTITY = "828546154700-compute@developer.gserviceaccount.com";
const SCHEDULER_MEMBER = `serviceAccount:${SCHEDULER_IDENTITY}`;
const WORKER_MEMBER = "serviceAccount:reputifly-leads-worker@reputifly-leads-2.iam.gserviceaccount.com";
const SERVICES = ["outboxworker", "operationalhealth", "morningreminder"];
const APPLY_GUARD = "reputifly-scheduler-invoker";

function run(args) {
  const result = spawnSync("gcloud", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    const reason = String(result.stderr || result.error?.message || "gcloud failed")
      .replace(/[\r\n]+/g, " ")
      .slice(0, 500);
    throw new Error(reason);
  }
  return String(result.stdout || "");
}

function readJson(args) {
  return JSON.parse(run([...args, "--format=json"]));
}

function verify() {
  for (const service of SERVICES) {
    const policy = readJson([
      "run", "services", "get-iam-policy", service,
      `--project=${PROJECT}`, `--region=${REGION}`,
    ]);
    const binding = (policy.bindings || []).find((item) =>
      item.role === "roles/run.invoker" && (item.members || []).includes(SCHEDULER_MEMBER));
    if (!binding) throw new Error(`The Scheduler invoker is missing from ${service}.`);
  }

  for (const secret of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]) {
    const secretPolicy = readJson(["secrets", "get-iam-policy", secret, `--project=${PROJECT}`]);
    const accessors = (secretPolicy.bindings || [])
      .filter((item) => item.role === "roles/secretmanager.secretAccessor")
      .flatMap((item) => item.members || []);
    if (accessors.includes(SCHEDULER_MEMBER)) {
      throw new Error("The Scheduler identity must not have Telegram secret access.");
    }
    if (!accessors.includes(WORKER_MEMBER)) {
      throw new Error("The dedicated worker is missing Telegram secret access.");
    }
  }
  console.log("[PASS] exact scheduled-service invokers and Telegram secret separation verified");
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(`Usage:\n  node scripts/leads/configure-scheduler-invoker.mjs --check\n  ALLOW_SCHEDULER_IAM_CONFIG=${APPLY_GUARD} node scripts/leads/configure-scheduler-invoker.mjs`);
  process.exit(0);
}
if (args.some((arg) => arg !== "--check")) throw new Error("Unknown argument");
const checkOnly = args.includes("--check");
if (!checkOnly) {
  if (process.env.ALLOW_SCHEDULER_IAM_CONFIG !== APPLY_GUARD) {
    throw new Error(`Refusing IAM mutation without ALLOW_SCHEDULER_IAM_CONFIG=${APPLY_GUARD}`);
  }
  for (const service of SERVICES) {
    run([
      "run", "services", "add-iam-policy-binding", service,
      `--project=${PROJECT}`, `--region=${REGION}`,
      `--member=${SCHEDULER_MEMBER}`,
      "--role=roles/run.invoker", "--quiet",
    ]);
  }
}
verify();
