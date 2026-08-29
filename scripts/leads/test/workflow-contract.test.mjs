import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workflow = readFileSync(path.join(ROOT, ".github/workflows/leads.yml"), "utf8");
const functionsIndex = readFileSync(path.join(ROOT, "firebase-leads/functions/src/index.ts"), "utf8");
const schedulerIam = readFileSync(path.join(ROOT, "scripts/leads/configure-scheduler-invoker.mjs"), "utf8");
const productionE2E = readFileSync(path.join(ROOT, "scripts/leads/production-e2e.mjs"), "utf8");

test("CI actions are immutable and use Node 24-capable major versions", () => {
  const uses = [...workflow.matchAll(/uses:\s*(actions\/(?:checkout|setup-node))@([^\s#]+)\s*#\s*(v[^\s]+)/g)];
  assert.ok(uses.length >= 2, "workflow contains the expected official actions");
  for (const [, action, revision, version] of uses) {
    assert.match(revision, /^[0-9a-f]{40}$/, `${action} must use a full immutable commit SHA`);
    assert.match(version, /^v7\./, `${action} must use its Node 24-capable v7 release`);
  }
  assert.doesNotMatch(workflow, /uses:\s*actions\/(?:checkout|setup-node)@v\d/i);
  assert.match(workflow, /pull_request:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/);
  assert.doesNotMatch(workflow, /^\s+paths:/m, "required CI must run for every PR and main push");
});

test("production write E2E remains explicit and separately guarded", () => {
  assert.match(workflow, /production_e2e:\s*[\s\S]*?type:\s*boolean/);
  assert.match(workflow, /production-write-e2e:[\s\S]*?inputs\.production_e2e\s*==\s*true/);
  assert.match(workflow, /ALLOW_PRODUCTION_E2E:\s*watchlist-v2-controlled-write/);
  assert.match(productionE2E, /const CANARY_PHONE = "[1-9][0-9 ]{7,}"/,
    "the production canary must satisfy the live required-phone contract");
  assert.equal((productionE2E.match(/phone: CANARY_PHONE/g) || []).length, 2,
    "the canary keeps one stable phone through create and update");
});

test("scheduled deploys preserve the narrow Firebase Scheduler invoker", () => {
  assert.equal((functionsIndex.match(/serviceAccount:\s*WORKER_SERVICE_ACCOUNT/g) || []).length, 3,
    "all three scheduled Functions still run as the dedicated worker identity");
  assert.match(functionsIndex, /secrets:\s*\[telegramBotToken,\s*telegramChatId\]/,
    "only the outbox worker binds Telegram secrets");
  assert.match(schedulerIam, /roles\/run\.invoker/);
  assert.match(schedulerIam, /828546154700-compute@developer\.gserviceaccount\.com/);
  for (const service of ["outboxworker", "operationalhealth", "morningreminder"]) {
    assert.match(schedulerIam, new RegExp(`"${service}"`));
  }
  assert.match(schedulerIam, /run", "services", "add-iam-policy-binding/);
  assert.match(schedulerIam, /run", "services", "get-iam-policy/);
  assert.match(schedulerIam, /TELEGRAM_BOT_TOKEN/);
  assert.match(schedulerIam, /TELEGRAM_CHAT_ID/);
  assert.match(schedulerIam, /must not have Telegram secret access/);
});
