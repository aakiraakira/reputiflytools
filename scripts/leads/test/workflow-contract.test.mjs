import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workflow = readFileSync(path.join(ROOT, ".github/workflows/leads.yml"), "utf8");

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
});
