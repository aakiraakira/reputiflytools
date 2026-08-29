import { describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { FirestoreRepository } from "../src/firestore-repository";

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
