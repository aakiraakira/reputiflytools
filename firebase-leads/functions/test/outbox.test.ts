import { describe, expect, it, vi } from "vitest";
import type { Actor, DigestPayload, Lead, NotificationOutbox } from "../src/domain";
import {
  DigestService,
  TelegramHttpClient,
  buildMorningReminder,
  enqueueMorningReminder,
  formatDigest,
  formatLeadCreated,
  leadCreatedOutboxId,
  nextCalendarDate,
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

function leadFixture(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    id,
    name: `Lead ${id}`,
    phone: "+65 9123 4567",
    note: "Follow up directly",
    followUp: "2026-08-13",
    status: "active",
    revision: 1,
    createdAt: "2026-08-12T00:00:00.000Z",
    createdBy: "migration",
    updatedAt: "2026-08-12T00:00:00.000Z",
    updatedBy: "migration",
    ...overrides,
  };
}

describe("notification outbox", () => {
  it("formats complete, concise Telegram messages without hidden truncation", () => {
    const digest = formatDigest({
      ...payload,
      date: "2026-08-13",
      followUps: [{ phone: "9123 4567", round: "2nd", sample: "Sent" }],
      dumped: [{ reason: "No budget" }],
      notes: "Confirm the revised quote tomorrow.",
    }, "Farhan");
    expect(digest).toContain("📋 Reputifly Daily Digest");
    expect(digest).toContain("📅 2026-08-13 · Singapore");
    expect(digest).toContain("👤 Submitted by Farhan");
    expect(digest).toContain("FOLLOW-UPS");
    expect(digest).toContain("DUMPED LEADS");
    expect(digest).toContain("QUESTIONS / NOTES");
    expect(digest.length).toBeLessThanOrEqual(4_096);

    const lead = formatLeadCreated({
      name: "Acme\nMovers\u0000",
      phone: "9123 4567",
      note: `Call\nabout\tthe quote ${"x".repeat(1_000)}`,
      followUp: "2026-08-15",
    }, "Farhan\nTan");
    expect(lead).toContain("🆕 New Watchlist lead · Acme Movers");
    expect(lead).toContain("Next chase: 2026-08-15");
    expect(lead).toContain("Note: Call about the quote");
    expect(lead).toContain("…");
    expect(lead).toContain("Added by Farhan");
    expect(lead).toContain("https://wa.me/6591234567");
    expect(lead).not.toContain("?");
    expect(lead).not.toContain("\u0000");
    expect(lead.length).toBeLessThanOrEqual(4_096);

    const reminder = buildMorningReminder("2026-08-13", [
      leadFixture("overdue", { followUp: "2026-08-12" }),
      leadFixture("today", { phone: "+65 9234 5678" }),
    ]);
    expect(reminder).toMatchObject({
      leadCount: 2,
      bucketCounts: { overdue: 1, today: 1, tomorrow: 0 },
    });
    expect(reminder.messages).toHaveLength(1);
    expect(reminder.messages[0]).toContain("Overdue (1)");
    expect(reminder.messages[0]).toContain("Today (1)");
    expect(reminder.messages[0]).toContain("https://wa.me/6591234567");
    expect(reminder.messages[0]).not.toContain("watchlist-v2");

    const longestLegalLeadId = "x".repeat(128);
    expect(leadCreatedOutboxId(longestLegalLeadId)).toHaveLength(75);
    expect(leadCreatedOutboxId(longestLegalLeadId)).toBe(leadCreatedOutboxId(longestLegalLeadId));
  });

  it.each([
    ["9123 4567", "https://wa.me/6591234567"],
    ["+65 9123 4567", "https://wa.me/6591234567"],
    ["0065 9123 4567", "https://wa.me/6591234567"],
  ])("uses one canonical direct WhatsApp link for %s", (phone, expected) => {
    const text = formatLeadCreated({
      name: "Acme",
      phone,
      note: "Call back",
      followUp: "2026-08-15",
    }, "Farhan");
    expect(text.match(/https:\/\/wa\.me\/\d+/g)).toEqual([expected]);
    expect(text).not.toMatch(/wa\.me\/[^\s?]+\?/);
  });

  it("refuses to format an unusable member lead phone", () => {
    expect(() => formatLeadCreated({
      name: "Acme",
      phone: "not a phone",
      note: "Call back",
      followUp: "2026-08-15",
    }, "Farhan")).toThrow("A usable WhatsApp number is required");
  });

  it("computes tomorrow across month, year, common-year, and leap-year boundaries", () => {
    expect(nextCalendarDate("2026-01-31")).toBe("2026-02-01");
    expect(nextCalendarDate("2026-12-31")).toBe("2027-01-01");
    expect(nextCalendarDate("2026-02-28")).toBe("2026-03-01");
    expect(nextCalendarDate("2028-02-28")).toBe("2028-02-29");
    expect(nextCalendarDate("2028-02-29")).toBe("2028-03-01");
  });

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
    expect(JSON.parse(String(init?.body))).toMatchObject({
      chat_id: "chat-id",
      link_preview_options: { is_disabled: true },
    });
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("disable_web_page_preview");
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
    repository.leads.set("due", leadFixture("due"));
    const now = () => new Date("2026-08-13T01:00:00.000Z");

    const first = await enqueueMorningReminder({ repository, localDate: "2026-08-13", now });
    const replay = await enqueueMorningReminder({ repository, localDate: "2026-08-13", now });

    expect(first).toMatchObject({
      created: true,
      outboxIds: ["reminder_2026-08-13"],
      leadCount: 1,
      bucketCounts: { overdue: 0, today: 1, tomorrow: 0 },
      messageCount: 1,
    });
    expect(replay).toMatchObject({
      created: false,
      outboxIds: ["reminder_2026-08-13"],
      leadCount: 1,
      messageCount: 1,
    });
    expect(repository.outbox.size).toBe(1);
    const text = repository.outbox.get(first.outboxIds[0])?.text ?? "";
    expect(text).toContain("Today (1)");
    expect(text).toContain("https://wa.me/6591234567");
    expect(text).not.toContain("watchlist-v2");
  });

  it("includes overdue, today, and Singapore tomorrow exactly once and excludes the rest", async () => {
    const repository = new MemoryRepository();
    repository.leads.set("overdue", leadFixture("overdue", {
      phone: "+65 8111 1111",
      followUp: "2026-01-30",
    }));
    repository.leads.set("today", leadFixture("today", {
      phone: "+65 8222 2222",
      followUp: "2026-01-31",
    }));
    repository.leads.set("tomorrow", leadFixture("tomorrow", {
      phone: "+65 8333 3333",
      followUp: "2026-02-01",
    }));
    repository.leads.set("day-two", leadFixture("day-two", {
      phone: "+65 8444 4444",
      followUp: "2026-02-02",
    }));
    repository.leads.set("undated", leadFixture("undated", {
      phone: "+65 8555 5555",
      followUp: "",
    }));
    repository.leads.set("archived", leadFixture("archived", {
      phone: "+65 8666 6666",
      followUp: "2026-01-30",
      status: "archived",
    }));

    const result = await enqueueMorningReminder({
      repository,
      localDate: "2026-01-31",
      now: () => new Date("2026-01-31T01:00:00.000Z"),
    });
    expect(result).toMatchObject({
      leadCount: 3,
      bucketCounts: { overdue: 1, today: 1, tomorrow: 1 },
      messageCount: 1,
    });
    const text = repository.outbox.get("reminder_2026-01-31")?.text ?? "";
    ["6581111111", "6582222222", "6583333333"].forEach((digits) => {
      expect(text.match(new RegExp(`https://wa.me/${digits}`, "g"))).toHaveLength(1);
    });
    expect(text).not.toMatch(/6584444444|6585555555|6586666666/);
    expect(text).toContain("Overdue (1)");
    expect(text).toContain("Today (1)");
    expect(text).toContain("Tomorrow (1)");
  });

  it("fails before enqueue when an included persisted lead has no usable WhatsApp number", async () => {
    const repository = new MemoryRepository();
    repository.leads.set("bad-phone", leadFixture("bad-phone", { phone: "not a phone" }));
    await expect(enqueueMorningReminder({
      repository,
      localDate: "2026-08-13",
      now: () => new Date("2026-08-13T01:00:00.000Z"),
    })).rejects.toThrow("Stored data could not be safely read");
    expect(repository.outbox.size).toBe(0);
    expect(repository.heartbeats.has("morningReminder")).toBe(false);
  });

  it("chunks deterministically at Telegram limits and replays without duplicates", async () => {
    const repository = new MemoryRepository();
    for (let index = 0; index < 180; index += 1) {
      const id = `lead-${String(index).padStart(3, "0")}`;
      repository.leads.set(id, leadFixture(id, {
        phone: `+1 202 555 ${String(index).padStart(4, "0")}`,
        name: `Prospect ${String(index).padStart(3, "0")} ${"N".repeat(70)}`,
        note: `Recorded context ${"x".repeat(220)}`,
      }));
    }
    const now = () => new Date("2026-08-13T01:00:00.000Z");
    const first = await enqueueMorningReminder({ repository, localDate: "2026-08-13", now });
    const originalTexts = first.outboxIds.map((id) => repository.outbox.get(id)?.text ?? "");
    const replay = await enqueueMorningReminder({ repository, localDate: "2026-08-13", now });

    expect(first.created).toBe(true);
    expect(first.messageCount).toBeGreaterThan(1);
    expect(first.outboxIds[0]).toBe("reminder_2026-08-13");
    expect(first.outboxIds[1]).toBe("reminder_2026-08-13_2");
    expect(replay).toMatchObject({ created: false, outboxIds: first.outboxIds });
    expect(repository.outbox.size).toBe(first.messageCount);
    expect(first.outboxIds.map((id) => repository.outbox.get(id)?.text ?? "")).toEqual(originalTexts);
    originalTexts.forEach((text, index) => {
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(4_096);
      expect(text).toContain(`${index + 1}/${first.messageCount}`);
      expect(repository.outbox.get(first.outboxIds[index]!)?.availableAt)
        .toBe(new Date(Date.parse("2026-08-13T01:00:00.000Z") + index).toISOString());
    });
    const combined = originalTexts.join("\n");
    for (let index = 0; index < 180; index += 1) {
      const digits = `1202555${String(index).padStart(4, "0")}`;
      expect(combined.match(new RegExp(`https://wa.me/${digits}`, "g"))).toHaveLength(1);
    }
    expect(repository.heartbeats.get("morningReminder")).toMatchObject({
      leadCount: 180,
      bucketCounts: { overdue: 0, today: 180, tomorrow: 0 },
      messageCount: first.messageCount,
    });

    repository.outbox.delete(first.outboxIds.at(-1)!);
    await expect(enqueueMorningReminder({ repository, localDate: "2026-08-13", now }))
      .rejects.toThrow("Stored data could not be safely read");
  });

  it("records a skipped heartbeat and sends no reminder when no lead is due", async () => {
    const repository = new MemoryRepository();
    const result = await enqueueMorningReminder({
      repository,
      localDate: "2026-08-13",
      now: () => new Date("2026-08-13T01:00:00.000Z"),
    });

    expect(result).toEqual({
      created: false,
      skipped: true,
      outboxIds: [],
      leadCount: 0,
      bucketCounts: { overdue: 0, today: 0, tomorrow: 0 },
      messageCount: 0,
    });
    expect(repository.outbox.size).toBe(0);
    expect(repository.heartbeats.get("morningReminder")).toEqual({
      at: "2026-08-13T01:00:00.000Z",
      localDate: "2026-08-13",
      created: false,
      skipped: true,
      outboxIds: [],
      leadCount: 0,
      bucketCounts: { overdue: 0, today: 0, tomorrow: 0 },
      messageCount: 0,
    });
  });

  it("appends only nonzero server-recorded outcomes to the nightly digest", async () => {
    const repository = new MemoryRepository();
    repository.audits.push(
      {
        actorUid: actor.uid,
        action: "lead.followup_logged",
        at: "2026-08-13T00:10:00.000Z",
        businessDate: "2026-08-13",
        metadata: { outcome: "no_reply" },
      },
      {
        actorUid: actor.uid,
        action: "lead.followup_logged",
        at: "2026-08-13T00:20:00.000Z",
        businessDate: "2026-08-13",
        metadata: { outcome: "no_reply" },
      },
      {
        actorUid: actor.uid,
        action: "lead.followup_logged",
        at: "2026-08-13T00:30:00.000Z",
        businessDate: "2026-08-13",
        metadata: { outcome: "won" },
      },
      {
        actorUid: actor.uid,
        action: "lead.followup_logged",
        at: "2026-08-13T00:40:00.000Z",
        businessDate: "2026-08-13",
        metadata: { outcome: "spoke" },
      },
      {
        actorUid: actor.uid,
        action: "lead.followup_logged",
        at: "2026-08-13T00:50:00.000Z",
        businessDate: "2026-08-13",
        metadata: { outcome: "lost" },
      },
    );
    expect(repository.outbox.size).toBe(0);
    const service = new DigestService(repository, () => new Date("2026-08-13T10:00:00.000Z"));
    const first = await service.create(actor, "digest:2026-08-13:uid-1", payload);
    const replay = await service.create(actor, "digest:2026-08-13:uid-1", payload);
    const text = repository.outbox.get(`digest_${first.digestId}`)?.text ?? "";

    expect(text).toContain("RECORDED OUTCOMES");
    expect(text).toContain("No reply: 2 recorded");
    expect(text).toContain("Spoke: 1 recorded");
    expect(text).toContain("Won: 1 recorded");
    expect(text).toContain("Lost: 1 recorded");
    expect(repository.outbox.get(`digest_${first.digestId}`)?.type).toBe("digest");
    expect(replay.replayed).toBe(true);
    expect(repository.outbox.size).toBe(1);

    const zeroText = formatDigest(payload, "Farhan", {
      no_reply: 0,
      spoke: 0,
      won: 0,
      lost: 0,
    });
    expect(zeroText).not.toContain("RECORDED OUTCOMES");
    expect(zeroText).not.toMatch(/\brecorded\b/i);
  });

  it("rejects a digest when the recorded outcome suffix would cross 4096", async () => {
    const repository = new MemoryRepository();
    repository.audits.push({
      actorUid: actor.uid,
      action: "lead.followup_logged",
      at: "2026-08-13T00:10:00.000Z",
      businessDate: "2026-08-13",
      metadata: { outcome: "won" },
    });
    const submittedBy = actor.email;
    const empty = formatDigest({ ...payload, date: "2026-08-13" }, submittedBy);
    const notesHeading = "\n\nQUESTIONS / NOTES\n";
    const boundaryPayload: DigestPayload = {
      ...payload,
      notes: "x".repeat(4_096 - empty.length - notesHeading.length),
    };
    expect(formatDigest({ ...boundaryPayload, date: "2026-08-13" }, submittedBy)).toHaveLength(4_096);

    await expect(new DigestService(
      repository,
      () => new Date("2026-08-13T10:00:00.000Z"),
    ).create(actor, "digest:overflow:uid-1", boundaryPayload)).rejects.toThrow(
      "This digest is too long for one complete Telegram message",
    );
    expect(repository.digests.size).toBe(0);
    expect(repository.outbox.size).toBe(0);
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
      /* A long retry backoff must not hide that delivery has been outstanding
         for more than 15 minutes. */
      availableAt: "2026-08-13T02:00:00.000Z",
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
