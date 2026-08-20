import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateCommittedActions,
  assertDigestTimelineTransition,
  singaporeBusinessDate,
  validateDailyStatusEnvelope,
  validateDigestAcceptance,
  validateDigestReadEnvelope,
  validateFollowUpReceipt,
  validateLeadListEnvelope,
  validateSessionEnvelope,
  validateSuccessMeta,
} from "../contracts-lib.mjs";

const SERVER_TIME = "2026-08-13T16:00:00.000Z";
const BUSINESS_DATE = "2026-08-14";
const META = Object.freeze({
  serverTime: SERVER_TIME,
  requestId: "request.contract-1",
  businessDate: BUSINESS_DATE,
});

function lead(overrides = {}) {
  return {
    id: "lead_contract_1",
    name: "Example lead",
    phone: "",
    note: "Synthetic contract fixture",
    followUp: "2026-08-15",
    status: "active",
    revision: 2,
    createdAt: "2026-08-13T10:00:00.000Z",
    createdBy: "uid-member",
    updatedAt: SERVER_TIME,
    updatedBy: "uid-member",
    ...overrides,
  };
}

function payload() {
  return {
    date: "Today",
    newLeads: 1,
    samplesSent: 0,
    followUps: [{ phone: "9000 0000", round: "2nd", sample: "Not yet" }],
    dumped: [{ reason: "Not interested" }],
    notes: "Synthetic contract fixture",
  };
}

test("Singapore business date rolls at midnight across day, month, and year boundaries", () => {
  assert.equal(singaporeBusinessDate("2030-04-10T15:59:59.999Z"), "2030-04-10");
  assert.equal(singaporeBusinessDate("2030-04-10T16:00:00.000Z"), "2030-04-11");
  assert.equal(singaporeBusinessDate("2030-04-30T15:59:59.999Z"), "2030-04-30");
  assert.equal(singaporeBusinessDate("2030-04-30T16:00:00.000Z"), "2030-05-01");
  assert.equal(singaporeBusinessDate("2030-12-31T15:59:59.999Z"), "2030-12-31");
  assert.equal(singaporeBusinessDate("2030-12-31T16:00:00.000Z"), "2031-01-01");
});

test("success metadata is server-canonical and read dataAsOf cannot drift", () => {
  assert.equal(validateSuccessMeta({ ...META }).businessDate, BUSINESS_DATE);
  assert.throws(
    () => validateSuccessMeta({ ...META, businessDate: "2026-08-13" }),
    /Singapore date derived from serverTime/,
  );
  assert.throws(
    () => validateLeadListEnvelope({ leads: [], actors: {}, meta: META, dataAsOf: "2026-08-13T16:00:01.000Z" }),
    /exactly equal/,
  );
});

test("a mutation accepted just before midnight keeps its resource business date", () => {
  const afterMidnightMeta = {
    serverTime: "2026-08-14T16:00:00.001Z",
    requestId: "request.midnight-1",
    businessDate: "2026-08-15",
  };
  assert.doesNotThrow(() => validateDigestAcceptance({
    accepted: true,
    digestId: "digest_midnight_1",
    businessDate: "2026-08-14",
    deliveryStatus: "pending",
    acceptedAt: "2026-08-14T15:59:59.999Z",
    acceptedBy: "uid-member",
    replayed: false,
    actors: { "uid-member": { label: "Employee" } },
    meta: afterMidnightMeta,
  }));
});

test("session and lead-list allowlists expose only referenced safe actor labels", () => {
  const current = lead();
  const session = {
    identity: { uid: "uid-member", email: "member@example.invalid", emailVerified: true },
    member: { role: "member", displayName: "Employee" },
    leads: [current],
    actors: { "uid-member": { label: "Employee" } },
    meta: META,
    dataAsOf: SERVER_TIME,
  };
  assert.equal(validateSessionEnvelope(structuredClone(session)).leads.length, 1);
  assert.equal(validateLeadListEnvelope({
    leads: [current],
    actors: { "uid-member": { label: "Employee" } },
    meta: META,
    dataAsOf: SERVER_TIME,
  }).leads.length, 1);

  assert.throws(
    () => validateLeadListEnvelope({
      leads: [current],
      actors: { "unreferenced-uid": { label: "Not relevant" } },
      meta: META,
      dataAsOf: SERVER_TIME,
    }),
    /unreferenced actor/,
  );
  assert.throws(
    () => validateLeadListEnvelope({
      leads: [current],
      actors: { "uid-member": { label: "member@example.invalid" } },
      meta: META,
      dataAsOf: SERVER_TIME,
    }),
    /email address/,
  );
  assert.throws(
    () => validateLeadListEnvelope({
      leads: [{ ...current, createPayloadHash: "must-never-be-public" }],
      actors: {},
      meta: META,
      dataAsOf: SERVER_TIME,
    }),
    /unexpected public field/,
  );
});

test("migration provenance uses one canonical non-PII label", () => {
  const imported = lead({ createdBy: "migration", updatedBy: "migration" });
  assert.doesNotThrow(() => validateLeadListEnvelope({
    leads: [imported],
    actors: { migration: { label: "Imported" } },
    meta: META,
    dataAsOf: SERVER_TIME,
  }));
  assert.throws(() => validateLeadListEnvelope({
    leads: [imported],
    actors: { migration: { label: "Legacy User" } },
    meta: META,
    dataAsOf: SERVER_TIME,
  }), /canonical Imported label/);
});

test("follow-up receipts prove one canonical active or terminal transition", () => {
  const active = {
    lead: lead({ followUp: "2026-08-20", revision: 3 }),
    followUp: {
      id: "followup_contract_1",
      leadId: "lead_contract_1",
      outcome: "spoke",
      nextFollowUp: "2026-08-20",
      occurredAt: SERVER_TIME,
      businessDate: BUSINESS_DATE,
      actorUid: "uid-member",
      resultingRevision: 3,
    },
    replayed: false,
    actors: { "uid-member": { label: "Employee" } },
    meta: META,
  };
  assert.equal(validateFollowUpReceipt(structuredClone(active)).lead.followUp, "2026-08-20");

  const terminal = structuredClone(active);
  terminal.lead = lead({
    followUp: "",
    status: "archived",
    revision: 3,
    archivedAt: SERVER_TIME,
    archivedBy: "uid-member",
  });
  terminal.followUp.outcome = "won";
  delete terminal.followUp.nextFollowUp;
  assert.equal(validateFollowUpReceipt(terminal).lead.status, "archived");

  const leaked = structuredClone(active);
  leaked.followUp.idempotencyKey = "internal-key";
  assert.throws(() => validateFollowUpReceipt(leaked), /unexpected public field/);
});

test("digest public view is an explicit allowlist with truthful proof fields", () => {
  const accepted = {
    accepted: true,
    digestId: "digest_contract_1",
    businessDate: BUSINESS_DATE,
    deliveryStatus: "pending",
    acceptedAt: SERVER_TIME,
    acceptedBy: "uid-member",
    replayed: false,
    actors: { "uid-member": { label: "Employee" } },
    meta: META,
  };
  assert.equal(validateDigestAcceptance(structuredClone(accepted)).deliveryStatus, "pending");

  const digest = {
    id: "digest_contract_1",
    businessDate: BUSINESS_DATE,
    payload: payload(),
    acceptedAt: SERVER_TIME,
    acceptedBy: "uid-member",
    deliveryStatus: "delivered",
    deliveredAt: "2026-08-13T16:01:00.000Z",
    telegramMessageId: 42,
  };
  assert.equal(validateDigestReadEnvelope({
    digest,
    actors: { "uid-member": { label: "Employee" } },
    meta: { ...META, serverTime: "2026-08-13T16:02:00.000Z" },
    dataAsOf: "2026-08-13T16:02:00.000Z",
  }).digest.deliveryStatus, "delivered");

  assert.throws(() => validateDigestReadEnvelope({
    digest: { ...digest, payloadHash: "internal" },
    actors: {},
    meta: META,
    dataAsOf: SERVER_TIME,
  }), /unexpected public field/);
  assert.throws(() => validateDigestReadEnvelope({
    digest: { ...digest, deliveryStatus: "pending" },
    actors: {},
    meta: META,
    dataAsOf: SERVER_TIME,
  }), /non-delivered state/);
});

test("digest delivery timeline is monotonic and acceptance identity is immutable", () => {
  const pending = {
    id: "digest_contract_1",
    businessDate: BUSINESS_DATE,
    acceptedAt: SERVER_TIME,
    acceptedBy: "uid-member",
    deliveryStatus: "pending",
  };
  const retrying = { ...pending, deliveryStatus: "retrying" };
  const delivered = {
    ...pending,
    deliveryStatus: "delivered",
    deliveredAt: "2026-08-13T16:01:00.000Z",
    telegramMessageId: 42,
  };
  assert.equal(assertDigestTimelineTransition(pending, retrying), true);
  assert.equal(assertDigestTimelineTransition(retrying, delivered), true);
  assert.throws(() => assertDigestTimelineTransition(delivered, retrying), /non-monotonic/);
  assert.throws(() => assertDigestTimelineTransition(pending, { ...retrying, acceptedBy: "someone-else" }), /immutable/);
  assert.throws(() => assertDigestTimelineTransition(pending, { ...pending, deliveryStatus: "delivered" }), /deliveredAt/);
  assert.throws(() => assertDigestTimelineTransition({ ...pending, deliveryStatus: "failed" }, delivered), /non-monotonic/);
});

test("Recorded today aggregates committed successful events only", () => {
  const events = [
    { committed: true, actorUid: "uid-member", businessDate: BUSINESS_DATE, kind: "leadCreated", at: "2026-08-13T16:01:00.000Z" },
    { committed: true, actorUid: "uid-member", businessDate: BUSINESS_DATE, kind: "followUpLogged", at: "2026-08-13T16:03:00.000Z" },
    { committed: false, actorUid: "uid-member", businessDate: BUSINESS_DATE, kind: "leadUpdated", at: "2026-08-13T16:04:00.000Z" },
    { committed: true, replayed: true, actorUid: "uid-member", businessDate: BUSINESS_DATE, kind: "followUpLogged", at: "2026-08-13T16:05:00.000Z" },
    { committed: true, actorUid: "another-uid", businessDate: BUSINESS_DATE, kind: "leadArchived", at: "2026-08-13T16:06:00.000Z" },
    { committed: true, actorUid: "uid-member", businessDate: "2026-08-13", kind: "digestAccepted", at: "2026-08-13T15:59:00.000Z" },
    { committed: true, actorUid: "uid-member", businessDate: BUSINESS_DATE, kind: "failedAttempt", at: "2026-08-13T16:07:00.000Z" },
  ];
  const recordedToday = aggregateCommittedActions(events, { actorUid: "uid-member", businessDate: BUSINESS_DATE });
  assert.equal(recordedToday.total, 2);
  assert.equal(recordedToday.byKind.leadCreated, 1);
  assert.equal(recordedToday.byKind.followUpLogged, 1);
  assert.equal(recordedToday.byKind.leadUpdated, 0);
  assert.deepEqual(recordedToday.lastSuccessfulAction, {
    kind: "followUpLogged",
    at: "2026-08-13T16:03:00.000Z",
  });

  assert.doesNotThrow(() => validateDailyStatusEnvelope({
    status: {
      businessDate: BUSINESS_DATE,
      timeZone: "Asia/Singapore",
      subject: { uid: "uid-member", label: "Employee" },
      recordedToday,
      digest: { state: "not_submitted" },
    },
    actors: { "uid-member": { label: "Employee" } },
    meta: META,
    dataAsOf: SERVER_TIME,
  }));
});
