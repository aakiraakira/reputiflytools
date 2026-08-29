#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiRequest,
  assertErrorEnvelope,
  assertJson,
  assertNoStore,
  assertStatus,
} from "./api-lib.mjs";
import {
  validateDailyStatusEnvelope,
  validateDigestReadEnvelope,
  validateFollowUpReceipt,
  validateLeadListEnvelope,
  validateSessionEnvelope,
} from "./contracts-lib.mjs";
import { publicError } from "./ops-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
let createApi;
let AppError;
let FirestoreRepository;
try {
  ({ createApi } = require(path.join(root, "firebase-leads/functions/lib/api.js")));
  ({ AppError } = require(path.join(root, "firebase-leads/functions/lib/errors.js")));
  ({ FirestoreRepository } = require(path.join(root, "firebase-leads/functions/lib/firestore-repository.js")));
} catch {
  throw new Error("Compiled backend was not found; run npm run build --prefix firebase-leads/functions first");
}

const NOW = new Date("2026-08-13T16:00:00.000Z");
const BUSINESS_DATE = "2026-08-14";
const TOKENS = new Map([
  ["owner-token", { uid: "uid-owner", email: "owner@example.invalid", emailVerified: true }],
  ["member-token", { uid: "uid-member", email: "member@example.invalid", emailVerified: true }],
  ["viewer-token", { uid: "uid-viewer", email: "viewer@example.invalid", emailVerified: true }],
]);

class ContractRepository {
  constructor() {
    this.members = new Map([
      ["uid-owner", { active: true, role: "owner", displayName: "Owner" }],
      ["uid-member", { active: true, role: "member", displayName: "Employee", dailyDigestExpected: true }],
      ["uid-viewer", { active: true, role: "viewer", displayName: "Read-only canary" }],
    ]);
    this.leads = new Map([["lead_contract_1", {
      id: "lead_contract_1",
      name: "Synthetic lead",
      phone: "",
      note: "Local contract fixture",
      followUp: "2026-08-15",
      status: "active",
      revision: 1,
      createdAt: "2026-08-13T10:00:00.000Z",
      createdBy: "migration",
      updatedAt: "2026-08-13T10:00:00.000Z",
      updatedBy: "migration",
      createIdempotencyKey: "internal-key",
      createPayloadHash: "internal-hash",
    }]]);
    this.followUps = new Map();
    this.successfulFollowUpCommits = 0;
    this.digest = {
      id: "digest_contract_1",
      idempotencyKey: "internal-digest-key",
      payloadHash: "internal-digest-hash",
      payload: {
        date: "Today",
        newLeads: 1,
        samplesSent: 0,
        followUps: [],
        dumped: [],
        notes: "Local contract fixture",
      },
      createdAt: NOW.toISOString(),
      createdBy: "uid-member",
      businessDate: BUSINESS_DATE,
      deliveryStatus: "retrying",
      lastDeliveryError: "internal delivery detail",
    };
  }

  async getMember(uid) {
    return structuredClone(this.members.get(uid) ?? null);
  }

  async listActiveLeads() {
    return [...this.leads.values()]
      .filter((lead) => lead.status === "active")
      .map((lead) => structuredClone(lead));
  }

  async resolveActorLabels(uids) {
    const labels = {
      migration: "Imported",
      "uid-owner": "Owner",
      "uid-member": "Employee",
      "uid-viewer": "Read-only canary",
    };
    return Object.fromEntries([...new Set(uids)].filter((uid) => labels[uid]).map((uid) => [uid, { label: labels[uid] }]));
  }

  async getExpectedDigestMembers() {
    return [{ uid: "uid-member", member: structuredClone(this.members.get("uid-member")) }];
  }

  async getDailyStatus(uid, businessDate) {
    return {
      businessDate,
      timeZone: "Asia/Singapore",
      subject: { uid },
      recordedToday: {
        total: 1,
        byKind: {
          leadCreated: 0,
          leadUpdated: 0,
          leadArchived: 0,
          followUpLogged: 1,
          digestAccepted: 0,
        },
        lastSuccessfulAction: { kind: "followUpLogged", at: NOW.toISOString() },
      },
      digest: { state: "not_submitted" },
    };
  }

  async getDigest(id) {
    return id === this.digest.id ? structuredClone(this.digest) : null;
  }

  async logFollowUp(input) {
    const existingEvent = this.followUps.get(input.eventId);
    if (existingEvent) {
      if (
        existingEvent.actorUid !== input.actor.uid ||
        existingEvent.idempotencyKey !== input.idempotencyKey ||
        existingEvent.payloadHash !== input.payloadHash
      ) {
        throw new AppError(409, "conflict", "Idempotency key was already used with different data.");
      }
      return {
        lead: structuredClone(this.leads.get(input.leadId)),
        followUp: structuredClone(existingEvent),
        replayed: true,
      };
    }
    const current = this.leads.get(input.leadId);
    if (!current) throw new AppError(404, "not_found", "Lead not found.");
    if (current.revision !== input.expectedRevision) {
      throw new AppError(409, "conflict", "Lead revision conflict.");
    }
    const terminal = input.outcome === "won" || input.outcome === "lost";
    const next = {
      ...current,
      followUp: terminal ? "" : input.nextFollowUp,
      status: terminal ? "archived" : "active",
      revision: current.revision + 1,
      updatedAt: input.now,
      updatedBy: input.actor.uid,
      ...(terminal ? { archivedAt: input.now, archivedBy: input.actor.uid } : {}),
    };
    const event = {
      id: input.eventId,
      leadId: input.leadId,
      outcome: input.outcome,
      ...(input.nextFollowUp ? { nextFollowUp: input.nextFollowUp } : {}),
      occurredAt: input.now,
      businessDate: input.businessDate,
      actorUid: input.actor.uid,
      resultingRevision: next.revision,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
    };
    this.leads.set(input.leadId, structuredClone(next));
    this.followUps.set(input.eventId, structuredClone(event));
    this.successfulFollowUpCommits += 1;
    return { lead: structuredClone(next), followUp: structuredClone(event), replayed: false };
  }
}

async function expectError(result, status, code, label) {
  assertStatus(result, status, label);
  assertNoStore(result, label);
  const error = assertErrorEnvelope(result, label);
  if (error.code !== code) throw new Error(`${label}: expected ${code}, received ${error.code}`);
}

async function assertDigestReplayProofAllowlist() {
  const corruptDigest = {
    id: "digest_contract_replay",
    idempotencyKey: "digest.contract-replay",
    payloadHash: "matching-payload-hash",
    payload: {
      date: "Today",
      newLeads: 0,
      samplesSent: 0,
      followUps: [],
      dumped: [],
      notes: "",
    },
    createdAt: NOW.toISOString(),
    createdBy: "uid-member",
    businessDate: BUSINESS_DATE,
    deliveryStatus: "pending",
    // Synthetic corrupt/stale fields: public status must stay pending and the
    // receipt must not leak delivery proof under that non-delivered status.
    deliveredAt: "2026-08-13T16:01:00.000Z",
    telegramMessageId: 42,
  };
  const fakeDb = {
    collection(collectionName) {
      return { doc: (id) => ({ collectionName, id }) };
    },
    async runTransaction(callback) {
      return callback({
        async get(reference) {
          if (reference.collectionName !== "digests" || reference.id !== corruptDigest.id) {
            throw new Error("Unexpected synthetic Firestore read");
          }
          return { exists: true, id: corruptDigest.id, data: () => structuredClone(corruptDigest) };
        },
      });
    },
  };
  const repository = new FirestoreRepository(fakeDb);
  const replay = await repository.createDigest({
    actor: { uid: "uid-member", email: "member@example.invalid", emailVerified: true, role: "member" },
    digestId: corruptDigest.id,
    idempotencyKey: corruptDigest.idempotencyKey,
    payloadHash: corruptDigest.payloadHash,
    payload: corruptDigest.payload,
    text: "Synthetic",
    now: NOW.toISOString(),
    businessDate: BUSINESS_DATE,
  });
  if (replay.deliveryStatus !== "pending") throw new Error("digest replay status changed unexpectedly");
  if (Object.hasOwn(replay, "deliveredAt") || Object.hasOwn(replay, "telegramMessageId")) {
    throw new Error("digest replay exposed Telegram proof fields under a non-delivered public status");
  }
  console.log("[PASS] Firestore digest replay omits stale delivery proof under non-delivered public status");
}

async function main() {
  const repository = new ContractRepository();
  const identityClient = {
    async lookup(token) {
      const identity = TOKENS.get(token);
      if (!identity) throw new Error("Synthetic token rejected");
      return structuredClone(identity);
    },
  };
  const app = createApi({ repository, identityClient, now: () => NOW, randomId: () => "fixed" });
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    listening.on("error", reject);
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Local contract server has no TCP address");
    const apiBase = `http://127.0.0.1:${address.port}`;

    const sessionResult = await apiRequest("/v1/session", { apiBase, token: "viewer-token" });
    assertStatus(sessionResult, 200, "viewer session");
    assertNoStore(sessionResult, "viewer session");
    validateSessionEnvelope(assertJson(sessionResult, "viewer session"), "viewer session");

    const listResult = await apiRequest("/v1/leads", { apiBase, token: "viewer-token" });
    assertStatus(listResult, 200, "viewer lead list");
    const list = validateLeadListEnvelope(assertJson(listResult, "viewer lead list"), "viewer lead list");
    if (Object.hasOwn(list.leads[0], "createPayloadHash")) throw new Error("lead internal hash leaked");

    const selfResult = await apiRequest("/v1/daily-status", { apiBase, token: "viewer-token" });
    assertStatus(selfResult, 200, "viewer self daily status");
    const self = validateDailyStatusEnvelope(assertJson(selfResult, "viewer self daily status"), "viewer self daily status");
    if (self.status.subject.uid !== "uid-viewer") throw new Error("self daily status crossed subject boundary");

    await expectError(
      await apiRequest("/v1/team/daily-status", { apiBase, token: "viewer-token" }),
      403,
      "forbidden",
      "viewer team daily status",
    );
    await expectError(
      await apiRequest("/v1/team/daily-status", { apiBase, token: "member-token" }),
      403,
      "forbidden",
      "member team daily status",
    );
    const teamResult = await apiRequest("/v1/team/daily-status", { apiBase, token: "owner-token" });
    assertStatus(teamResult, 200, "owner team daily status");
    const team = validateDailyStatusEnvelope(assertJson(teamResult, "owner team daily status"), "owner team daily status");
    if (team.status.subject.uid !== "uid-member") throw new Error("owner team status did not select the one configured employee");

    const digestResult = await apiRequest("/v1/digests/digest_contract_1", { apiBase, token: "viewer-token" });
    assertStatus(digestResult, 200, "digest public view");
    validateDigestReadEnvelope(assertJson(digestResult, "digest public view"), "digest public view");

    const followUpBody = { expectedRevision: 1, outcome: "spoke", nextFollowUp: "2026-08-15" };
    await expectError(
      await apiRequest("/v1/leads/lead_contract_1/follow-ups", {
        apiBase,
        method: "POST",
        body: followUpBody,
        headers: { "Idempotency-Key": "followup.contract-1" },
      }),
      401,
      "unauthorized",
      "unauthenticated follow-up",
    );
    await expectError(
      await apiRequest("/v1/leads/lead_contract_1/follow-ups", {
        apiBase,
        token: "viewer-token",
        method: "POST",
        body: followUpBody,
        headers: { "Idempotency-Key": "followup.contract-1" },
      }),
      403,
      "forbidden",
      "viewer follow-up",
    );
    if (repository.successfulFollowUpCommits !== 0) throw new Error("denied follow-up changed local state");

    const firstResult = await apiRequest("/v1/leads/lead_contract_1/follow-ups", {
      apiBase,
      token: "member-token",
      method: "POST",
      body: followUpBody,
      headers: { "Idempotency-Key": "followup.contract-1" },
    });
    assertStatus(firstResult, 201, "new follow-up");
    const first = validateFollowUpReceipt(assertJson(firstResult, "new follow-up"), "new follow-up");
    if (first.replayed) throw new Error("new follow-up was incorrectly marked replayed");

    const replayResult = await apiRequest("/v1/leads/lead_contract_1/follow-ups", {
      apiBase,
      token: "member-token",
      method: "POST",
      body: followUpBody,
      headers: { "Idempotency-Key": "followup.contract-1" },
    });
    assertStatus(replayResult, 200, "follow-up replay");
    const replay = validateFollowUpReceipt(assertJson(replayResult, "follow-up replay"), "follow-up replay");
    if (!replay.replayed) throw new Error("exact follow-up replay lacks replayed proof");

    await expectError(
      await apiRequest("/v1/leads/lead_contract_1/follow-ups", {
        apiBase,
        token: "member-token",
        method: "POST",
        body: { ...followUpBody, outcome: "no_reply" },
        headers: { "Idempotency-Key": "followup.contract-1" },
      }),
      409,
      "conflict",
      "changed-payload idempotency replay",
    );
    await expectError(
      await apiRequest("/v1/leads/lead_contract_1/follow-ups", {
        apiBase,
        token: "member-token",
        method: "POST",
        body: followUpBody,
        headers: { "Idempotency-Key": "followup.contract-2" },
      }),
      409,
      "conflict",
      "stale follow-up revision",
    );
    if (repository.successfulFollowUpCommits !== 1) throw new Error("replay or conflict duplicated a committed follow-up");

    await assertDigestReplayProofAllowlist();

    console.log("[PASS] compiled backend metadata/dataAsOf and explicit public allowlists");
    console.log("[PASS] self/team role boundaries and one configured employee subject");
    console.log("[PASS] follow-up unauth/viewer denial, exact replay, changed-payload conflict, stale-revision conflict");
    console.log("Backend independent contract gate passed; one synthetic in-memory commit, zero cloud mutations.");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
