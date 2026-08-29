import { describe, expect, it, vi } from "vitest";
import type { Actor, DigestPayload, NotificationOutbox } from "../src/domain";
import {
  DigestService,
  TelegramHttpClient,
  enqueueMorningReminder,
  processOutboxBatch,
} from "../src/services";
import { MemoryRepository } from "./support/memory-repository";

const actor: Actor = {
  uid: "uid-1",
  email: "owner@example.com",
  emailVerified: true,
  role: "owner",
};

const payload: DigestPayload = {
  date: "Thu, 13 Aug",
  newLeads: 2,
  samplesSent: 1,
  followUps: [],
  dumped: [],
  notes: "",
};

describe("notification outbox", () => {
  it("persists Telegram failure, retries later, and stores message_id on success", async () => {
    const repository = new MemoryRepository();
    let clock = new Date("2026-08-13T01:00:00.000Z");
    const digest = await new DigestService(repository, () => clock).create(
      actor,
      "digest:2026-08-13:uid-1",
      payload,
    );
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, description: "Too Many Requests" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { message_id: 7788 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const telegram = new TelegramHttpClient("bot-token", "chat-id", fetchMock);

    const first = await processOutboxBatch({
      repository,
      telegram,
      now: () => clock,
      leaseOwner: "worker-1",
    });
    expect(first).toEqual({ claimed: 1, delivered: 0, retrying: 1, dead: 0, ignored: 0 });
    const outboxId = `digest_${digest.digestId}`;
    expect(repository.outbox.get(outboxId)).toMatchObject({
      status: "retry",
      attempts: 1,
      lastFailure: { message: "Too Many Requests", responseStatus: 429 },
    });
    expect(repository.digests.get(digest.digestId)).toMatchObject({
      deliveryStatus: "retrying",
      lastDeliveryError: "Too Many Requests",
    });

    clock = new Date("2026-08-13T01:00:30.000Z");
    const tooSoon = await processOutboxBatch({
      repository,
      telegram,
      now: () => clock,
      leaseOwner: "worker-2",
    });
    expect(tooSoon.claimed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock = new Date("2026-08-13T01:01:01.000Z");
    const second = await processOutboxBatch({
      repository,
      telegram,
      now: () => clock,
      leaseOwner: "worker-3",
    });
    expect(second).toEqual({ claimed: 1, delivered: 1, retrying: 0, dead: 0, ignored: 0 });
    expect(repository.outbox.get(outboxId)).toMatchObject({
      status: "delivered",
      attempts: 2,
      telegramMessageId: 7788,
    });
    expect(repository.digests.get(digest.digestId)).toMatchObject({
      deliveryStatus: "delivered",
      telegramMessageId: 7788,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1] ?? [];
    expect(url).toContain("/botbot-token/sendMessage");
    expect(JSON.parse(String(init?.body))).toMatchObject({ chat_id: "chat-id" });
  });

  it("recovers an expired lease and dead-letters after the attempt ceiling", async () => {
    const repository = new MemoryRepository();
    const now = new Date("2026-08-13T01:00:00.000Z");
    const item: NotificationOutbox = {
      id: "reminder_2026-08-13",
      type: "morning_reminder",
      status: "processing",
      text: "Reminder",
      attempts: 7,
      availableAt: "2026-08-13T00:00:00.000Z",
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
      leaseOwner: "crashed-worker",
      leaseExpiresAt: "2026-08-13T00:59:00.000Z",
    };
    repository.outbox.set(item.id, item);

    const result = await processOutboxBatch({
      repository,
      telegram: { send: vi.fn().mockRejectedValue(new Error("network down")) },
      now: () => now,
      leaseOwner: "recovery-worker",
      maxAttempts: 8,
    });

    expect(result).toEqual({ claimed: 1, delivered: 0, retrying: 0, dead: 1, ignored: 0 });
    expect(repository.outbox.get(item.id)).toMatchObject({
      status: "dead",
      attempts: 8,
      lastFailure: { message: "network down" },
    });
  });

  it("creates only one deterministic 9am reminder per Singapore date", async () => {
    const repository = new MemoryRepository();
    repository.leads.set("due", {
      id: "due",
      name: "Due lead",
      phone: "",
      note: "Follow up",
      followUp: "2026-08-13",
      status: "active",
      revision: 1,
      createdAt: "2026-08-12T00:00:00.000Z",
      createdBy: "migration",
      updatedAt: "2026-08-12T00:00:00.000Z",
      updatedBy: "migration",
    });
    const now = () => new Date("2026-08-13T01:00:00.000Z");

    const first = await enqueueMorningReminder({ repository, localDate: "2026-08-13", now });
    const replay = await enqueueMorningReminder({ repository, localDate: "2026-08-13", now });

    expect(first).toMatchObject({ created: true, outboxId: "reminder_2026-08-13", dueCount: 1 });
    expect(replay).toMatchObject({ created: false, outboxId: "reminder_2026-08-13", dueCount: 1 });
    expect(repository.outbox.size).toBe(1);
    expect(repository.outbox.get(first.outboxId)?.text).toContain("1 lead is due or overdue");
    expect(repository.outbox.get(first.outboxId)?.text).toContain("Review the Watchlist");
    expect(repository.outbox.get(first.outboxId)?.text).not.toMatch(/digest|deadline|late|missed/i);
  });

  it("records a skipped heartbeat and sends no reminder when no lead is due", async () => {
    const repository = new MemoryRepository();
    const result = await enqueueMorningReminder({
      repository,
      localDate: "2026-08-13",
      now: () => new Date("2026-08-13T01:00:00.000Z"),
    });

    expect(result).toEqual({ created: false, skipped: true, dueCount: 0 });
    expect(repository.outbox.size).toBe(0);
    expect(repository.heartbeats.get("morningReminder")).toEqual({
      at: "2026-08-13T01:00:00.000Z",
      localDate: "2026-08-13",
      created: false,
      skipped: true,
      dueCount: 0,
    });
  });

  it("claims one item at a time and leaves later attempts untouched when the run budget is used", async () => {
    const repository = new MemoryRepository();
    let clockMs = Date.parse("2026-08-13T01:00:00.000Z");
    for (let index = 0; index < 6; index += 1) {
      repository.outbox.set(`item-${index}`, {
        id: `item-${index}`,
        type: "morning_reminder",
        status: "pending",
        text: `Reminder ${index}`,
        attempts: 0,
        availableAt: new Date(clockMs).toISOString(),
        createdAt: new Date(clockMs).toISOString(),
        updatedAt: new Date(clockMs).toISOString(),
      });
    }
    const originalClaim = repository.claimOutbox.bind(repository);
    const originalDelivered = repository.markOutboxDelivered.bind(repository);
    const claim = vi.spyOn(repository, "claimOutbox").mockImplementation(async (input) => {
      expect(input.limit).toBe(1);
      const result = await originalClaim(input);
      clockMs += 500;
      return result;
    });
    vi.spyOn(repository, "markOutboxDelivered").mockImplementation(async (input) => {
      await originalDelivered(input);
      clockMs += 500;
    });
    let sentCount = 0;
    const telegram = {
      send: vi.fn(async () => {
        clockMs += 10_000;
        sentCount += 1;
        return { messageId: 100 + sentCount, responseStatus: 200 };
      }),
    };

    const result = await processOutboxBatch({
      repository,
      telegram,
      now: () => new Date(clockMs),
      leaseOwner: "bounded-worker",
    });

    expect(result).toEqual({ claimed: 4, delivered: 4, retrying: 0, dead: 0, ignored: 0 });
    expect(claim).toHaveBeenCalledTimes(4);
    expect(clockMs - Date.parse("2026-08-13T01:00:00.000Z")).toBe(44_000);
    expect([...repository.outbox.values()].filter((item) => item.status === "delivered")).toHaveLength(4);
    const untouched = [...repository.outbox.values()].filter((item) => item.status === "pending");
    expect(untouched).toHaveLength(2);
    expect(untouched.every((item) => item.attempts === 0)).toBe(true);
  });

  it("does not allow another worker to reclaim an in-flight item within the Function timeout", async () => {
    const repository = new MemoryRepository();
    let clockMs = Date.parse("2026-08-13T01:00:00.000Z");
    repository.outbox.set("in-flight", {
      id: "in-flight",
      type: "morning_reminder",
      status: "pending",
      text: "Review",
      attempts: 0,
      availableAt: new Date(clockMs).toISOString(),
      createdAt: new Date(clockMs).toISOString(),
      updatedAt: new Date(clockMs).toISOString(),
    });
    let releaseSend: ((receipt: { messageId: number; responseStatus: number }) => void) | undefined;
    const telegram = {
      send: vi.fn(() => new Promise<{ messageId: number; responseStatus: number }>((resolve) => {
        releaseSend = resolve;
      })),
    };
    const running = processOutboxBatch({
      repository,
      telegram,
      now: () => new Date(clockMs),
      leaseOwner: "first-worker",
      limit: 1,
    });
    await vi.waitFor(() => expect(telegram.send).toHaveBeenCalledOnce());

    clockMs += 55_000;
    await expect(repository.claimOutbox({
      now: new Date(clockMs).toISOString(),
      leaseOwner: "overlapping-worker",
      leaseExpiresAt: new Date(clockMs + 65_000).toISOString(),
      limit: 1,
    })).resolves.toEqual([]);
    expect(repository.outbox.get("in-flight")).toMatchObject({
      status: "processing",
      attempts: 1,
      leaseOwner: "first-worker",
      leaseExpiresAt: "2026-08-13T01:01:05.000Z",
    });

    releaseSend?.({ messageId: 123, responseStatus: 200 });
    await expect(running).resolves.toMatchObject({ claimed: 1, delivered: 1 });
  });

  it("reports stale and dead work for the scheduled synthetic health check", async () => {
    const repository = new MemoryRepository();
    repository.outbox.set("stale", {
      id: "stale",
      type: "morning_reminder",
      status: "retry",
      text: "stale",
      attempts: 1,
      availableAt: "2026-08-13T00:00:00.000Z",
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });
    repository.outbox.set("dead", {
      id: "dead",
      type: "morning_reminder",
      status: "dead",
      text: "dead",
      attempts: 8,
      availableAt: "2026-08-13T00:00:00.000Z",
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    await expect(repository.checkOperationalHealth({
      now: "2026-08-13T01:00:00.000Z",
      staleBefore: "2026-08-13T00:45:00.000Z",
    })).resolves.toEqual({
      staleOutboxCount: 1,
      deadOutboxCount: 1,
      oldestOutstandingAt: "2026-08-13T00:00:00.000Z",
    });
  });
});
