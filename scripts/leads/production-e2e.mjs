#!/usr/bin/env node
import { API_BASE, parseCli, publicError, requestJson } from "./ops-lib.mjs";
import { apiRequest, assertJson, assertNoStore, assertStatus, normalizeApiBase } from "./api-lib.mjs";

const WRITE_GUARD = "watchlist-v2-controlled-write";
const MARKER = "Automated production E2E — safe to delete";

function requiredEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function nextBusinessDate(day) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1, 12));
  return next.toISOString().slice(0, 10);
}

function payloadDate(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date, 12)).toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

async function mintIdToken(timeoutMs) {
  const endpoint = new URL("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword");
  endpoint.searchParams.set("key", requiredEnvironment("LEGACY_FIREBASE_API_KEY"));
  const result = await requestJson(endpoint, {
    method: "POST",
    body: {
      email: requiredEnvironment("LEADS_CANARY_EMAIL"),
      password: requiredEnvironment("LEADS_CANARY_PASSWORD"),
      returnSecureToken: true,
    },
    timeoutMs,
  });
  if (!result.response.ok || typeof result.json?.idToken !== "string" || !result.json.idToken) {
    throw new Error(`Production E2E sign-in failed with HTTP ${result.response.status}; body suppressed`);
  }
  return result.json.idToken;
}

async function checkedApi(route, options, expected, label) {
  const result = await apiRequest(route, options);
  assertStatus(result, expected, label);
  assertNoStore(result, label);
  return assertJson(result, label);
}

async function main() {
  const args = parseCli(process.argv.slice(2), {
    "api-base": "string",
    "timeout-ms": "string",
    help: "boolean",
  });
  if (args.help) {
    console.log(`Usage: ALLOW_PRODUCTION_E2E=${WRITE_GUARD} node scripts/leads/production-e2e.mjs [--api-base URL]\n\nCreates one non-PII lead, proves its Telegram alert plus revision/follow-up/archive and Digest delivery, then prints a cleanup manifest. Requires the dedicated canary to be temporarily role=member.`);
    return;
  }
  if (args._.length) throw new Error("Unexpected positional arguments");
  if (process.env.ALLOW_PRODUCTION_E2E !== WRITE_GUARD) {
    throw new Error(`Refusing production writes without ALLOW_PRODUCTION_E2E=${WRITE_GUARD}`);
  }
  const timeoutMs = Number(args["timeout-ms"] || 20_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new Error("--timeout-ms must be 1000..60000");
  }
  const apiBase = normalizeApiBase(args["api-base"] || API_BASE);
  const token = await mintIdToken(timeoutMs);
  const runId = String(process.env.GITHUB_RUN_ID || Date.now());
  if (!/^\d{6,24}$/.test(runId)) throw new Error("GITHUB_RUN_ID must be numeric");
  const leadId = `e2e_${runId}`;
  let currentRevision = 0;
  let archived = false;
  let digestId = "";
  let leadNotificationId = "";
  let leadTelegramMessageId = 0;
  let digestTelegramMessageId = 0;
  let businessDate = "";

  try {
    const session = await checkedApi("/v1/session", { apiBase, token, timeoutMs }, 200, "E2E session");
    if (!session.meta?.businessDate || !["member", "owner"].includes(session.member?.role)) {
      throw new Error("E2E canary must be an active writer and receive a canonical business date");
    }
    businessDate = session.meta.businessDate;
    console.log("[PASS] same-login session authenticated as temporary writer");

    const dailyStatus = await checkedApi("/v1/daily-status", { apiBase, token, timeoutMs }, 200, "E2E daily status preflight");
    if (dailyStatus.status?.businessDate !== businessDate || dailyStatus.status?.digest?.state !== "not_submitted") {
      throw new Error("E2E canary already has a Digest in today's server slot; use a clean canary or reconcile the exact prior test first");
    }
    console.log("[PASS] canary Digest day slot is empty before production writes");

    const created = await checkedApi(`/v1/leads/${leadId}`, {
      apiBase,
      token,
      timeoutMs,
      method: "PUT",
      body: { name: "SYSTEM TEST", phone: "", note: MARKER, followUp: businessDate, expectedRevision: 0 },
    }, [200, 201], "E2E lead create");
    if (created.lead?.id !== leadId || created.lead.status !== "active" || created.lead.revision !== 1) {
      throw new Error("E2E lead create receipt was not canonical");
    }
    currentRevision = 1;
    console.log("[PASS] lead create returned revision 1 canonical receipt");

    const leadNotificationDeadline = Date.now() + 150_000;
    while (Date.now() < leadNotificationDeadline) {
      const proof = await checkedApi(`/v1/leads/${leadId}/notification`, {
        apiBase,
        token,
        timeoutMs,
      }, 200, "E2E lead notification receipt");
      leadNotificationId = proof.notification?.id || leadNotificationId;
      if (proof.notification?.deliveryStatus === "delivered") {
        leadTelegramMessageId = proof.notification.telegramMessageId;
        if (!proof.notification.deliveredAt || !Number.isInteger(leadTelegramMessageId) || leadTelegramMessageId < 1) {
          throw new Error("Delivered lead notification lacked Telegram proof fields");
        }
        break;
      }
      if (["failed", "unknown"].includes(proof.notification?.deliveryStatus)) {
        throw new Error(`Lead notification entered terminal delivery state ${proof.notification.deliveryStatus}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    if (!leadTelegramMessageId || !leadNotificationId) {
      throw new Error("New-lead notification was not Telegram-delivered within 150 seconds");
    }
    console.log("[PASS] new-lead Telegram delivery persisted server proof");

    const updated = await checkedApi(`/v1/leads/${leadId}`, {
      apiBase,
      token,
      timeoutMs,
      method: "PUT",
      body: { name: "SYSTEM TEST", phone: "", note: `${MARKER} (updated)`, followUp: nextBusinessDate(businessDate), expectedRevision: currentRevision },
    }, 200, "E2E lead update");
    if (updated.lead?.revision !== 2 || updated.lead.note !== `${MARKER} (updated)`) {
      throw new Error("E2E lead update receipt was not canonical");
    }
    currentRevision = 2;
    console.log("[PASS] lead update returned revision 2 canonical receipt");

    const followed = await checkedApi(`/v1/leads/${leadId}/follow-ups`, {
      apiBase,
      token,
      timeoutMs,
      method: "POST",
      headers: { "Idempotency-Key": `production-e2e:${runId}:no-reply` },
      body: { expectedRevision: currentRevision, outcome: "no_reply", nextFollowUp: nextBusinessDate(businessDate) },
    }, 201, "E2E follow-up");
    if (followed.lead?.revision !== 3 || followed.followUp?.outcome !== "no_reply") {
      throw new Error("E2E follow-up receipt was not canonical");
    }
    currentRevision = 3;
    console.log("[PASS] transactional follow-up returned revision 3 receipt");

    const terminal = await checkedApi(`/v1/leads/${leadId}/follow-ups`, {
      apiBase,
      token,
      timeoutMs,
      method: "POST",
      headers: { "Idempotency-Key": `production-e2e:${runId}:lost` },
      body: { expectedRevision: currentRevision, outcome: "lost" },
    }, 201, "E2E terminal follow-up");
    if (terminal.lead?.revision !== 4 || terminal.lead.status !== "archived") {
      throw new Error("E2E terminal follow-up did not atomically archive the lead");
    }
    currentRevision = 4;
    archived = true;
    console.log("[PASS] terminal follow-up atomically archived revision 4");

    const digestPayload = {
      date: payloadDate(businessDate),
      newLeads: 0,
      samplesSent: 0,
      followUps: [],
      dumped: [],
      notes: "Automated non-PII delivery canary. Safe to delete.",
    };
    const digestStartedAt = Date.now();
    const accepted = await checkedApi("/v1/digests", {
      apiBase,
      token,
      timeoutMs,
      method: "POST",
      body: { idempotencyKey: `production-e2e:digest:${businessDate}`, payload: digestPayload },
    }, [200, 202], "E2E digest acceptance");
    if (accepted.accepted !== true || typeof accepted.digestId !== "string" || !accepted.digestId) {
      throw new Error("E2E digest did not return an acceptance receipt");
    }
    if (accepted.replayed === true || !accepted.acceptedAt || Date.parse(accepted.acceptedAt) < digestStartedAt - 5_000) {
      throw new Error("E2E Digest receipt was replayed or stale; the deployed enqueue path was not freshly exercised");
    }
    digestId = accepted.digestId;
    console.log("[PASS] Digest accepted exactly once with canonical receipt");

    const deadline = Date.now() + 150_000;
    while (Date.now() < deadline) {
      const receipt = await checkedApi(`/v1/digests/${encodeURIComponent(digestId)}`, {
        apiBase,
        token,
        timeoutMs,
      }, 200, "E2E digest receipt");
      if (receipt.digest?.deliveryStatus === "delivered") {
        digestTelegramMessageId = receipt.digest.telegramMessageId;
        if (!receipt.digest.deliveredAt || !Number.isInteger(digestTelegramMessageId) || digestTelegramMessageId < 1) {
          throw new Error("Delivered Digest lacked Telegram proof fields");
        }
        break;
      }
      if (["failed", "legacy_unknown"].includes(receipt.digest?.deliveryStatus)) {
        throw new Error(`Digest entered terminal delivery state ${receipt.digest.deliveryStatus}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    if (!digestTelegramMessageId) throw new Error("Digest was not Telegram-delivered within 150 seconds");
    console.log("[PASS] Telegram delivery persisted server timestamp and message ID");
    console.log(`E2E_MANIFEST=${JSON.stringify({
      leadId,
      leadNotificationId,
      leadTelegramMessageId,
      digestId,
      digestTelegramMessageId,
      businessDate,
    })}`);
  } finally {
    if (currentRevision > 0 && !archived) {
      try {
        await apiRequest(`/v1/leads/${leadId}/archive`, {
          apiBase,
          token,
          timeoutMs,
          method: "POST",
          body: { expectedRevision: currentRevision },
        });
      } catch {
        // The manifest/reconciliation step detects and removes any exact test row.
      }
    }
  }
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
