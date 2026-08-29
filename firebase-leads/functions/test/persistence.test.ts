import { describe, expect, it } from "vitest";
import {
  PersistedDataError,
  digestFromPersisted,
  followUpFromPersisted,
  leadFromPersisted,
  memberFromPersisted,
  outboxFromPersisted,
} from "../src/persistence";

const now = "2026-08-14T00:00:00.000Z";
const validLead = {
  name: "Alex",
  phone: "",
  note: "Requested a sample",
  followUp: "2026-08-15",
  status: "active",
  revision: 1,
  createdAt: now,
  createdBy: "uid-1",
  updatedAt: now,
  updatedBy: "uid-1",
};
const validPayload = {
  date: "Fri, 14 Aug",
  newLeads: 1,
  samplesSent: 1,
  followUps: [],
  dumped: [],
  notes: "",
};

describe("persisted Firestore decoding", () => {
  it("strictly validates leads and strips unlisted stored fields", () => {
    expect(leadFromPersisted("lead-1", { ...validLead, privateInjection: "never public" }))
      .toEqual({ id: "lead-1", ...validLead });
    for (const malformed of [
      { ...validLead, status: "deleted" },
      { ...validLead, revision: 0 },
      { ...validLead, updatedAt: "yesterday" },
      { ...validLead, createdBy: undefined },
    ]) {
      expect(() => leadFromPersisted("lead-1", malformed)).toThrow(PersistedDataError);
    }
  });

  it("rejects malformed digest enums, arrays, timestamps, and required fields", () => {
    const valid = {
      idempotencyKey: "digest:key:001",
      payloadHash: "hash",
      payload: validPayload,
      createdAt: now,
      createdBy: "uid-1",
      businessDate: "2026-08-14",
      deliveryStatus: "pending",
      migrationSource: "retained only in Firestore",
    };
    expect(digestFromPersisted("digest-1", valid)).not.toHaveProperty("migrationSource");
    for (const malformed of [
      { ...valid, deliveryStatus: "sent" },
      { ...valid, payload: { ...validPayload, followUps: null } },
      { ...valid, payload: { ...validPayload, dumped: [null] } },
      { ...valid, createdAt: "invalid" },
      { ...valid, payloadHash: undefined },
    ]) {
      expect(() => digestFromPersisted("digest-1", malformed)).toThrow(PersistedDataError);
    }
  });

  it("rejects malformed outbox and follow-up state", () => {
    const outbox = {
      type: "digest",
      digestId: "digest-1",
      status: "processing",
      text: "Send",
      attempts: 1,
      availableAt: now,
      createdAt: now,
      updatedAt: now,
      leaseOwner: "worker-1",
      leaseExpiresAt: "2026-08-14T00:01:05.000Z",
    };
    expect(outboxFromPersisted("outbox-1", outbox)).toMatchObject({ status: "processing" });
    expect(() => outboxFromPersisted("outbox-1", { ...outbox, status: "unknown" }))
      .toThrow(PersistedDataError);
    expect(() => outboxFromPersisted("outbox-1", { ...outbox, leaseOwner: undefined }))
      .toThrow(PersistedDataError);
    expect(() => outboxFromPersisted("outbox-1", { ...outbox, attempts: "1" }))
      .toThrow(PersistedDataError);

    const followUp = {
      leadId: "lead-1",
      outcome: "spoke",
      nextFollowUp: "2026-08-15",
      occurredAt: now,
      businessDate: "2026-08-14",
      actorUid: "uid-1",
      resultingRevision: 2,
      idempotencyKey: "followup:key:001",
      payloadHash: "hash",
      resultingLead: { id: "lead-1", ...validLead, revision: 2 },
    };
    expect(followUpFromPersisted("followup-1", followUp)).toMatchObject({ outcome: "spoke" });
    expect(() => followUpFromPersisted("followup-1", { ...followUp, outcome: "maybe" }))
      .toThrow(PersistedDataError);
    expect(() => followUpFromPersisted("followup-1", { ...followUp, resultingRevision: 0 }))
      .toThrow(PersistedDataError);
    expect(() => followUpFromPersisted("followup-1", { ...followUp, occurredAt: undefined }))
      .toThrow(PersistedDataError);
  });

  it("fails closed on malformed membership", () => {
    expect(memberFromPersisted({ active: true, role: "owner", displayName: "Julian" }))
      .toEqual({ active: true, role: "owner", displayName: "Julian" });
    expect(memberFromPersisted({ active: "true", role: "owner" })).toBeNull();
    expect(memberFromPersisted({ active: true, role: "admin" })).toBeNull();
  });
});
