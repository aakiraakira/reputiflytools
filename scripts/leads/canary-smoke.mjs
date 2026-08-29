#!/usr/bin/env node
import { API_BASE, parseCli, publicError, requestJson } from "./ops-lib.mjs";
import {
  apiRequest,
  assertErrorEnvelope,
  assertNoStore,
  assertStatus,
  normalizeApiBase,
  runAuthenticatedReadSmoke,
} from "./api-lib.mjs";

function help() {
  console.log(`Usage: node scripts/leads/canary-smoke.mjs [--api-base URL]

Scheduled read-only smoke. Requires LEADS_CANARY_EMAIL,
LEADS_CANARY_PASSWORD, and LEGACY_FIREBASE_API_KEY in the environment. It mints
a fresh legacy Firebase ID token, keeps it in process memory, and never logs
credentials, the token, response bodies, IDs, or lead PII.`);
}

function requiredEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required; scheduled monitoring must not silently skip`);
  return value;
}

async function mintIdToken(timeoutMs) {
  const email = requiredEnvironment("LEADS_CANARY_EMAIL");
  const password = requiredEnvironment("LEADS_CANARY_PASSWORD");
  const apiKey = requiredEnvironment("LEGACY_FIREBASE_API_KEY");
  const endpoint = new URL("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword");
  endpoint.searchParams.set("key", apiKey);
  const result = await requestJson(endpoint, {
    method: "POST",
    body: { email, password, returnSecureToken: true },
    timeoutMs,
  });
  if (!result.response.ok || !result.json || typeof result.json.idToken !== "string" || !result.json.idToken) {
    throw new Error(`Canary Firebase sign-in failed with HTTP ${result.response.status}; response body suppressed`);
  }
  return result.json.idToken;
}

async function assertViewerDenied({ label, route, token, apiBase, timeoutMs, method = "GET", body, headers }) {
  const result = await apiRequest(route, { apiBase, token, timeoutMs, method, body, headers });
  assertStatus(result, 403, label);
  assertNoStore(result, label);
  const error = assertErrorEnvelope(result, label);
  if (error.code !== "forbidden") throw new Error(`${label}: expected forbidden error code`);
  console.log(`[PASS] ${label}: viewer denied before any state-changing operation`);
}

async function main() {
  const args = parseCli(process.argv.slice(2), {
    "api-base": "string",
    "timeout-ms": "string",
    help: "boolean",
  });
  if (args.help) return help();
  if (args._.length) throw new Error("Unexpected positional arguments");
  const apiBase = normalizeApiBase(args["api-base"] || API_BASE);
  const timeoutMs = Number(args["timeout-ms"] || 15_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error("--timeout-ms must be 1000..60000");
  const token = await mintIdToken(timeoutMs);
  try {
    const evidence = await runAuthenticatedReadSmoke({ apiBase, token, timeoutMs });
    if (evidence.memberRole !== "viewer") {
      throw new Error(`Canary member must have viewer role, received ${evidence.memberRole}; remove write authority`);
    }
    await assertViewerDenied({
      label: "viewer team status boundary",
      route: "/v1/team/daily-status",
      token,
      apiBase,
      timeoutMs,
    });
    await assertViewerDenied({
      label: "viewer lead write boundary",
      route: "/v1/leads",
      method: "POST",
      body: { name: "", phone: "", note: "", followUp: "" },
      headers: { "Idempotency-Key": "canary-permission-probe" },
      token,
      apiBase,
      timeoutMs,
    });
    await assertViewerDenied({
      label: "viewer follow-up boundary",
      route: "/v1/leads/!canary_permission_probe/follow-ups",
      method: "POST",
      body: { expectedRevision: 1, outcome: "spoke", nextFollowUp: evidence.businessDate },
      headers: { "Idempotency-Key": "canary-followup-probe" },
      token,
      apiBase,
      timeoutMs,
    });
    console.log("[PASS] canary membership is viewer/read-only; serverTime/businessDate proven; fresh token discarded at process exit");
  } finally {
    // Strings cannot be reliably zeroed in JavaScript, but this releases the
    // only application reference and the value is never exported or printed.
  }
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
