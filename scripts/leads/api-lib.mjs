import { API_BASE, DEFAULT_TIMEOUT_MS, requestJson } from "./ops-lib.mjs";
import {
  validateDailyStatusEnvelope,
  validateLeadListEnvelope,
  validatePublicLead,
  validateSessionEnvelope,
} from "./contracts-lib.mjs";

export function apiToken({ required = true } = {}) {
  const token = (process.env.LEADS_ID_TOKEN || process.env.FIREBASE_ID_TOKEN || "").trim();
  if (required && !token) {
    throw new Error("Set LEADS_ID_TOKEN in the environment; Firebase ID tokens are never accepted as arguments");
  }
  return token;
}

export function normalizeApiBase(value = API_BASE) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("API base must use HTTPS except on localhost");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function apiRequest(route, {
  apiBase = API_BASE,
  method = "GET",
  token = "",
  body,
  headers = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!route.startsWith("/")) throw new Error("API route must begin with /");
  return requestJson(`${normalizeApiBase(apiBase)}${route}`, { method, token, body, headers, timeoutMs });
}

export function assertStatus(result, expected, label) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(result.response.status)) {
    throw new Error(`${label}: expected HTTP ${accepted.join("/")}, received ${result.response.status}`);
  }
}

export function assertJson(result, label) {
  const type = result.response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) throw new Error(`${label}: response is not application/json`);
  if (!result.json || typeof result.json !== "object" || Array.isArray(result.json)) throw new Error(`${label}: response is not a JSON object`);
  return result.json;
}

export function assertNoStore(result, label) {
  const value = result.response.headers.get("cache-control") || "";
  if (!/(?:^|,)\s*(?:no-store|private)\b/i.test(value)) throw new Error(`${label}: sensitive response lacks Cache-Control: no-store/private`);
}

export function assertErrorEnvelope(result, label) {
  const json = assertJson(result, label);
  if (!json.error || typeof json.error !== "object") throw new Error(`${label}: missing error envelope`);
  if (typeof json.error.code !== "string" || !json.error.code) throw new Error(`${label}: missing error.code`);
  if (typeof json.error.message !== "string" || !json.error.message) throw new Error(`${label}: missing error.message`);
  if (typeof json.error.requestId !== "string" || !json.error.requestId) throw new Error(`${label}: missing error.requestId`);
  return json.error;
}

export function validateLead(lead, label = "lead") {
  return validatePublicLead(lead, label);
}

export async function runAuthenticatedReadSmoke({ apiBase = API_BASE, token, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!token) throw new Error("Authenticated read smoke requires an in-memory ID token");
  const sessionResult = await apiRequest("/v1/session", { apiBase, token, timeoutMs });
  assertStatus(sessionResult, 200, "GET /v1/session");
  assertNoStore(sessionResult, "GET /v1/session");
  const session = validateSessionEnvelope(assertJson(sessionResult, "GET /v1/session"));
  console.log(`[PASS] GET /v1/session: canonical read metadata, safe actor map, ${session.leads.length} lead(s)`);

  const listResult = await apiRequest("/v1/leads", { apiBase, token, timeoutMs });
  assertStatus(listResult, 200, "GET /v1/leads");
  assertNoStore(listResult, "GET /v1/leads");
  const list = validateLeadListEnvelope(assertJson(listResult, "GET /v1/leads"));
  console.log(`[PASS] GET /v1/leads: public allowlist, canonical as-of, ${list.leads.length} lead(s)`);

  const dailyResult = await apiRequest("/v1/daily-status", { apiBase, token, timeoutMs });
  assertStatus(dailyResult, 200, "GET /v1/daily-status");
  assertNoStore(dailyResult, "GET /v1/daily-status");
  const daily = validateDailyStatusEnvelope(assertJson(dailyResult, "GET /v1/daily-status"));
  if (daily.status.subject.uid !== session.identity.uid) {
    throw new Error("GET /v1/daily-status: self route returned another subject");
  }
  console.log(`[PASS] GET /v1/daily-status: self-only, canonical Singapore business date, committed-action contract`);
  console.log(`Read-only API smoke passed against ${new URL(normalizeApiBase(apiBase)).host}; zero mutations attempted.`);
  return {
    sessionLeadCount: session.leads.length,
    listLeadCount: list.leads.length,
    memberRole: session.member.role,
    uid: session.identity.uid,
    businessDate: daily.meta.businessDate,
  };
}
