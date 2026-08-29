import { describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { FirestoreRepository } from "../src/firestore-repository";
import { activePhoneClaimId } from "../src/phone";

describe("FirestoreRepository corrupt outbox isolation", () => {
  it("paginates the active Watchlist instead of silently dropping lead 501", async () => {
    const at = "2026-08-14T00:00:00.000Z";
    let readCount = 0;
    const documents = Array.from({ length: 501 }, (_, index) => ({
      id: `lead-${String(index).padStart(4, "0")}`,
      data: () => ({
        id: `lead-${String(index).padStart(4, "0")}`,
        name: `Lead ${index}`,
        phone: "",
        note: "Safe pagination fixture",
        followUp: "",
        status: "active",
        revision: 1,
        createdAt: at,
        createdBy: "migration",
        updatedAt: at,
        updatedBy: "migration",
      }),
    }));
    const makeQuery = (start: number) => ({
      where() { return this; },
      orderBy() { return this; },
      startAfter(snapshot: { id: string }) {
        const next = documents.findIndex((doc) => doc.id === snapshot.id) + 1;
        return makeQuery(next);
      },
      limit(size: number) {
        return {
          async get() {
            readCount += 1;
            const docs = documents.slice(start, start + size);
            return { docs, size: docs.length };
          },
        };
      },
    });
    const fakeDb = { collection: () => makeQuery(0) };
    const repository = new FirestoreRepository(fakeDb as never);

    const leads = await repository.listActiveLeads();

    expect(leads).toHaveLength(501);
    expect(leads.at(-1)?.id).toBe("lead-0500");
    expect(readCount).toBe(2);
  });

  it("quarantines a malformed candidate and still claims the healthy row behind it", async () => {
    const at = "2026-08-14T00:00:00.000Z";
    const documents = new Map<string, Record<string, unknown>>([
      ["bad", {
        type: "morning_reminder",
        status: "pending",
        text: "Bad",
        attempts: "zero",
        availableAt: at,
        createdAt: at,
        updatedAt: at,
      }],
      ["good", {
        type: "morning_reminder",
        status: "pending",
        text: "Good",
        attempts: 0,
        availableAt: at,
        createdAt: at,
        updatedAt: at,
      }],
    ]);
    type Ref = { id: string };
    const snapshots = (ids: string[]) => ids.map((id) => ({
      id,
      ref: { id },
      exists: documents.has(id),
      data: () => structuredClone(documents.get(id)),
    }));
    const query = (kind: "available" | "expired" | null = null) => ({
      where(field: string, operator: string) {
        const next = field === "status" && operator === "in"
          ? "available"
          : field === "status" && operator === "=="
            ? "expired"
            : kind;
        return query(next);
      },
      orderBy() { return this; },
      limit() { return this; },
      async get() {
        return { docs: kind === "available" ? snapshots(["bad", "good"]) : [] };
      },
    });
    const fakeDb = {
      collection(name: string) {
        if (name !== "notificationOutbox") throw new Error(`unexpected collection ${name}`);
        return query();
      },
      async runTransaction<T>(callback: (transaction: {
        get(ref: Ref): Promise<ReturnType<typeof snapshots>[number]>;
        update(ref: Ref, patch: Record<string, unknown>): void;
        set(ref: Ref, value: Record<string, unknown>): void;
      }) => Promise<T>): Promise<T> {
        return callback({
          async get(ref) {
            const [snapshot] = snapshots([ref.id]);
            if (!snapshot) throw new Error("missing synthetic snapshot");
            return snapshot;
          },
          update(ref, patch) {
            documents.set(ref.id, { ...(documents.get(ref.id) ?? {}), ...structuredClone(patch) });
          },
          set(ref, value) {
            documents.set(ref.id, structuredClone(value));
          },
        });
      },
    };
    const repository = new FirestoreRepository(fakeDb as never);

    const claimed = await repository.claimOutbox({
      now: at,
      leaseOwner: "worker-1",
      leaseExpiresAt: "2026-08-14T00:01:05.000Z",
      limit: 1,
    });

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id: "good", status: "processing", attempts: 1 });
    expect(documents.get("bad")).toMatchObject({
      status: "dead",
      lastFailure: {
        at,
        message: "Stored notification was invalid and was quarantined.",
      },
    });
    expect(JSON.stringify(documents.get("bad"))).not.toContain("PersistedDataError");
  });

  it("deletes transient lease and error fields instead of persisting null", async () => {
    const at = "2026-08-14T00:00:00.000Z";
    const outbox = {
      type: "digest",
      digestId: "digest-1",
      status: "processing",
      text: "Send",
      attempts: 1,
      availableAt: at,
      createdAt: at,
      updatedAt: at,
      leaseOwner: "worker-1",
      leaseExpiresAt: "2026-08-14T00:01:05.000Z",
    };
    type Ref = { id: string; path: string };
    const updates: Array<{ ref: Ref; patch: Record<string, unknown> }> = [];
    const fakeDb = {
      collection(name: string) {
        return {
          doc(id: string): Ref {
            return { id, path: `${name}/${id}` };
          },
        };
      },
      async runTransaction<T>(callback: (transaction: {
        get(ref: Ref): Promise<{ exists: boolean; id: string; data(): Record<string, unknown> }>;
        update(ref: Ref, patch: Record<string, unknown>): void;
      }) => Promise<T>): Promise<T> {
        return callback({
          async get(ref) {
            return { exists: true, id: ref.id, data: () => structuredClone(outbox) };
          },
          update(ref, patch) {
            updates.push({ ref, patch });
          },
        });
      },
    };
    const repository = new FirestoreRepository(fakeDb as never);

    await repository.markOutboxDelivered({
      id: "outbox-1",
      leaseOwner: "worker-1",
      now: at,
      telegramMessageId: 112,
      responseStatus: 200,
    });

    expect(updates).toHaveLength(2);
    expect(updates[0]?.ref.path).toBe("notificationOutbox/outbox-1");
    expect(updates[0]?.patch.leaseOwner).toEqual(FieldValue.delete());
    expect(updates[0]?.patch.leaseExpiresAt).toEqual(FieldValue.delete());
    expect(updates[1]?.ref.path).toBe("digests/digest-1");
    expect(updates[1]?.patch.lastDeliveryError).toEqual(FieldValue.delete());
    expect(updates.flatMap(({ patch }) => Object.values(patch)).includes(null)).toBe(false);

    updates.length = 0;
    await expect(repository.markOutboxFailed({
      id: "outbox-1",
      leaseOwner: "worker-1",
      now: at,
      message: "Temporary Telegram error",
      maxAttempts: 8,
      nextAvailableAt: "2026-08-14T00:01:00.000Z",
    })).resolves.toBe("retry");
    expect(updates[0]?.patch.leaseOwner).toEqual(FieldValue.delete());
    expect(updates[0]?.patch.leaseExpiresAt).toEqual(FieldValue.delete());
    expect(updates.flatMap(({ patch }) => Object.values(patch)).includes(null)).toBe(false);
  });
});

describe("FirestoreRepository active phone claims", () => {
  const actor = {
    uid: "uid-1",
    email: "owner@example.com",
    emailVerified: true,
    role: "owner" as const,
  };
  const now = "2026-08-14T00:00:00.000Z";

  it("claims canonical phones atomically and maintains them across replay, move, and outcomes", async () => {
    const harness = transactionalDb();
    const repository = new FirestoreRepository(harness.db as never);
    const initialLead = {
      name: "Alex",
      phone: "9123 4567",
      note: "Needs a quote",
      followUp: "2026-08-15",
    };
    const create = {
      actor,
      lead: initialLead,
      id: "lead_one",
      now,
      idempotencyKey: "create:lead-one",
      payloadHash: "lead-one-hash",
      businessDate: "2026-08-14",
    };

    await expect(repository.createLead(create)).resolves.toMatchObject({ replayed: false });
    await expect(repository.createLead(create)).resolves.toMatchObject({ replayed: true });
    const firstClaimPath = `activePhoneClaims/${activePhoneClaimId(initialLead.phone)}`;
    expect(harness.documents.get(firstClaimPath)).toEqual({ leadId: "lead_one" });
    expect(firstClaimPath).not.toContain("6591234567");
    expect([...harness.documents.keys()].filter((path) => path.startsWith("auditEvents/")))
      .toHaveLength(1);

    await expect(repository.createLead({
      ...create,
      id: "lead_two",
      idempotencyKey: "create:lead-two",
      payloadHash: "lead-two-hash",
      lead: { ...initialLead, phone: "+65 9123-4567" },
    })).rejects.toMatchObject({ status: 409, code: "duplicate_phone" });
    expect(harness.documents.has("leads/lead_two")).toBe(false);

    const movedPhone = "9234 5678";
    await repository.putLead({
      actor,
      id: "lead_one",
      lead: { ...initialLead, phone: movedPhone },
      expectedRevision: 1,
      now,
      businessDate: "2026-08-14",
    });
    const movedClaimPath = `activePhoneClaims/${activePhoneClaimId(movedPhone)}`;
    expect(harness.documents.has(firstClaimPath)).toBe(false);
    expect(harness.documents.get(movedClaimPath)).toEqual({ leadId: "lead_one" });

    await repository.logFollowUp({
      actor,
      leadId: "lead_one",
      eventId: "event_spoke",
      idempotencyKey: "followup:spoke",
      payloadHash: "followup-spoke-hash",
      expectedRevision: 2,
      outcome: "spoke",
      nextFollowUp: "2026-08-16",
      now,
      businessDate: "2026-08-14",
    });
    expect(harness.documents.get(movedClaimPath)).toEqual({ leadId: "lead_one" });

    await repository.logFollowUp({
      actor,
      leadId: "lead_one",
      eventId: "event_won",
      idempotencyKey: "followup:won",
      payloadHash: "followup-won-hash",
      expectedRevision: 3,
      outcome: "won",
      now,
      businessDate: "2026-08-14",
    });
    expect(harness.documents.has(movedClaimPath)).toBe(false);
  });

  it("archives a known duplicate without deleting the other active lead's claim", async () => {
    const phone = "6583005988";
    const claimPath = `activePhoneClaims/${activePhoneClaimId(phone)}`;
    const harness = transactionalDb({
      "leads/claim_owner": persistedLead("claim_owner", phone),
      "leads/duplicate_to_archive": persistedLead("duplicate_to_archive", phone),
      [claimPath]: { leadId: "claim_owner" },
    });
    const repository = new FirestoreRepository(harness.db as never);

    await expect(repository.archiveLead({
      actor,
      id: "duplicate_to_archive",
      expectedRevision: 1,
      now,
      businessDate: "2026-08-14",
    })).resolves.toMatchObject({ status: "archived", revision: 2 });

    expect(harness.documents.get(claimPath)).toEqual({ leadId: "claim_owner" });
    expect(harness.documents.get("leads/duplicate_to_archive"))
      .toMatchObject({ status: "archived", revision: 2 });
  });
});

type FakeRef = { id: string; path: string };

function transactionalDb(seed: Record<string, Record<string, unknown>> = {}) {
  const documents = new Map<string, Record<string, unknown>>(
    Object.entries(seed).map(([path, value]) => [path, structuredClone(value)]),
  );
  const db = {
    collection(name: string) {
      return {
        doc(id: string): FakeRef {
          return { id, path: `${name}/${id}` };
        },
      };
    },
    async runTransaction<T>(callback: (transaction: {
      get(ref: FakeRef): Promise<{
        id: string;
        ref: FakeRef;
        exists: boolean;
        data(): Record<string, unknown> | undefined;
      }>;
      create(ref: FakeRef, value: Record<string, unknown>): void;
      set(ref: FakeRef, value: Record<string, unknown>): void;
      delete(ref: FakeRef): void;
    }) => Promise<T>): Promise<T> {
      const pending = new Map<string, Record<string, unknown>>(
        [...documents].map(([path, value]) => [path, structuredClone(value)]),
      );
      const result = await callback({
        async get(ref) {
          const value = pending.get(ref.path);
          return {
            id: ref.id,
            ref,
            exists: value !== undefined,
            data: () => value === undefined ? undefined : structuredClone(value),
          };
        },
        create(ref, value) {
          if (pending.has(ref.path)) throw new Error(`document already exists: ${ref.path}`);
          pending.set(ref.path, structuredClone(value));
        },
        set(ref, value) {
          pending.set(ref.path, structuredClone(value));
        },
        delete(ref) {
          pending.delete(ref.path);
        },
      });
      documents.clear();
      pending.forEach((value, path) => documents.set(path, value));
      return result;
    },
  };
  return { db, documents };
}

function persistedLead(id: string, phone: string): Record<string, unknown> {
  const at = "2026-08-14T00:00:00.000Z";
  return {
    id,
    name: id,
    phone,
    note: "Known duplicate",
    followUp: "2026-08-15",
    status: "active",
    revision: 1,
    createdAt: at,
    createdBy: "migration",
    updatedAt: at,
    updatedBy: "migration",
  };
}
