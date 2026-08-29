#!/usr/bin/env node
import { API_BASE, PROJECT_ID, parseCli, publicError, requestJson } from "./ops-lib.mjs";
import {
  apiRequest,
  assertErrorEnvelope,
  assertNoStore,
  assertStatus,
  normalizeApiBase,
} from "./api-lib.mjs";

function help() {
  console.log(`Usage: node scripts/leads/security-smoke.mjs [--api-base URL]

Non-mutating negative tests. No credential is used: every protected API route
must reject missing/invalid/query/cookie auth, and direct Firestore reads must
be denied. Synthetic payloads contain no real lead data.`);
}

async function assertDenied(test, apiBase, timeoutMs) {
  const result = await apiRequest(test.route, {
    apiBase,
    method: test.method,
    token: test.token || "",
    body: test.body,
    headers: test.headers,
    timeoutMs,
  });
  assertStatus(result, test.expectedStatus || 401, test.label);
  assertNoStore(result, test.label);
  assertErrorEnvelope(result, test.label);
  const allowOrigin = result.response.headers.get("access-control-allow-origin");
  if (allowOrigin === "*" || allowOrigin === "https://attacker.invalid") {
    throw new Error(`${test.label}: untrusted Origin was allowed`);
  }
  console.log(`[PASS] ${test.label}: HTTP ${result.response.status}, JSON error envelope, non-cacheable`);
}

async function main() {
  const args = parseCli(process.argv.slice(2), {
    "api-base": "string",
    "timeout-ms": "string",
    project: "string",
    help: "boolean",
  });
  if (args.help) return help();
  if (args._.length) throw new Error("Unexpected positional arguments");
  const apiBase = normalizeApiBase(args["api-base"] || API_BASE);
  const project = args.project || PROJECT_ID;
  const timeoutMs = Number(args["timeout-ms"] || 15_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error("--timeout-ms must be 1000..60000");
  const fakeLead = { name: "Security probe", phone: "", note: "Synthetic unauthenticated request", followUp: "" };
  const fakeDigest = {
    idempotencyKey: "security-probe-0001",
    payload: { date: "Today", newLeads: 0, samplesSent: 0, followUps: [], dumped: [], notes: "" },
  };
  const tests = [
    { label: "unauth session", route: "/v1/session" },
    { label: "unauth lead list", route: "/v1/leads" },
    { label: "unauth self daily status", route: "/v1/daily-status" },
    { label: "unauth team daily status", route: "/v1/team/daily-status" },
    { label: "unauth lead create", route: "/v1/leads", method: "POST", body: fakeLead },
    { label: "unauth lead update", route: "/v1/leads/security_probe", method: "PUT", body: { ...fakeLead, expectedRevision: 1 } },
    { label: "unauth lead archive", route: "/v1/leads/security_probe/archive", method: "POST", body: { expectedRevision: 1 } },
    {
      label: "unauth follow-up",
      route: "/v1/leads/security_probe/follow-ups",
      method: "POST",
      body: { expectedRevision: 1, outcome: "spoke", nextFollowUp: "2099-01-01" },
      headers: { "Idempotency-Key": "security-followup-probe" },
    },
    { label: "unauth digest submit", route: "/v1/digests", method: "POST", body: fakeDigest },
    { label: "unauth digest read", route: "/v1/digests/security_probe" },
    { label: "invalid bearer", route: "/v1/session", token: "synthetic.invalid.credential" },
    { label: "query token rejected", route: "/v1/session?t=synthetic.invalid.credential" },
    { label: "cookie token rejected", route: "/v1/session", headers: { Cookie: "idToken=synthetic.invalid.credential" } },
    { label: "untrusted Origin rejected", route: "/v1/session", headers: { Origin: "https://attacker.invalid" }, expectedStatus: 403 },
  ];
  for (const test of tests) await assertDenied(test, apiBase, timeoutMs);

  const collections = ["members", "leads", "leadFollowUps", "digests", "notificationOutbox", "auditEvents", "system"];
  for (const collection of collections) {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${collection}?pageSize=1`;
    const direct = await requestJson(firestoreUrl, { timeoutMs });
    assertStatus(direct, [401, 403], `direct Firestore ${collection} read`);
    console.log(`[PASS] direct Firestore ${collection} read: HTTP ${direct.response.status}`);
  }
  const total = tests.length + collections.length;
  console.log(`Security smoke passed (${total}/${total}); zero authenticated requests and zero mutations.`);
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
