import { describe, expect, it } from "vitest";
import { FirestoreRepository } from "../src/firestore-repository";

describe("FirestoreRepository corrupt outbox isolation", () => {
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
});
