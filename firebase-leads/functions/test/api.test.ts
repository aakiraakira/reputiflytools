import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api";
import type { IdentityClient } from "../src/auth";
import { PersistedDataError } from "../src/persistence";
import { MemoryRepository } from "./support/memory-repository";

const AUTHORIZATION = "Bearer valid-token";
const ORIGIN = "https://reputifly.org";
const NOW = new Date("2026-08-13T16:00:01.000Z"); // 14 Aug in Singapore

describe("HTTP API", () => {
  let repository: MemoryRepository;
  let identityClient: IdentityClient;
  let app: ReturnType<typeof createApi>;

  beforeEach(() => {
    repository = new MemoryRepository();
    repository.members.set("uid-1", { active: true, role: "owner", displayName: "Julian" });
    identityClient = {
      lookup: vi.fn(async (token: string) => {
        if (token !== "valid-token") throw new Error("test rejected token");
        return {
          uid: "uid-1",
          email: "owner@example.com",
          emailVerified: true,
        };
      }),
    };
    app = createApi({
      repository,
      identityClient,
      now: () => NOW,
      randomId: () => "fixed-random-id",
    });
  });

  it("serves a session with identity and active leads", async () => {
    repository.leads.set("lead_existing", {
      id: "lead_existing",
      name: "Alex",
      phone: "",
      note: "Asked for a sample",
      followUp: "2026-08-14",
      status: "active",
      revision: 2,
      createdAt: NOW.toISOString(),
      createdBy: "uid-1",
      updatedAt: NOW.toISOString(),
      updatedBy: "uid-1",
      createPayloadHash: "internal",
    });

    const response = await request(app)
      .get("/v1/session")
      .set("authorization", AUTHORIZATION)
      .set("origin", ORIGIN)
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect(response.headers["access-control-expose-headers"]).toContain("X-Request-Id");
    expect(response.body.identity).toEqual({
      uid: "uid-1",
      email: "owner@example.com",
      emailVerified: true,
    });
    expect(response.body.member).toEqual({ role: "owner", displayName: "Julian" });
    expect(response.body.leads).toHaveLength(1);
    expect(response.body.leads[0]).not.toHaveProperty("createPayloadHash");
    expect(response.body).toMatchObject({
      actors: { "uid-1": { label: "Julian" } },
      dataAsOf: NOW.toISOString(),
      meta: {
        serverTime: NOW.toISOString(),
        requestId: response.headers["x-request-id"],
        businessDate: "2026-08-14",
      },
    });
  });

  it("rejects absent auth and disallowed browser origins", async () => {
    await request(app).get("/v1/leads").set("origin", ORIGIN).expect(401);

    const unauthenticatedMalformed = await request(app)
      .post("/v1/leads")
      .set("content-type", "application/json")
      .send("{not-json")
      .expect(401);
    expect(unauthenticatedMalformed.body.error.code).toBe("unauthorized");

    const response = await request(app)
      .get("/v1/leads")
      .set("authorization", AUTHORIZATION)
      .set("origin", "https://attacker.example")
      .expect(403);
    expect(response.body.error.code).toBe("origin_not_allowed");
    expect(identityClient.lookup).not.toHaveBeenCalled();
  });

  it("allows default Firebase sites and localhost preflights", async () => {
    await request(app)
      .options("/v1/leads")
      .set("origin", "http://localhost:5173")
      .set("access-control-request-method", "POST")
      .expect(204)
      .expect("access-control-allow-origin", "http://localhost:5173");

    await request(app)
      .get("/healthz")
      .set("origin", "https://daily-digest-v2.web.app")
      .expect(200);
  });

  it("validates create input and replays an idempotent lead create", async () => {
    const invalid = await request(app)
      .post("/v1/leads")
      .set("authorization", AUTHORIZATION)
      .set("content-type", "application/json")
      .send({ name: "", phone: "", note: "", followUp: "tomorrow" })
      .expect(400);
    expect(invalid.body.error.code).toBe("bad_request");
    expect(invalid.body.error.details.fields.length).toBeGreaterThan(1);

    const body = { name: "Alex", phone: "", note: "Asked for pricing", followUp: "2026-08-14" };
    const first = await request(app)
      .post("/v1/leads")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "create:browser-123")
      .send(body)
      .expect(201);
    const replay = await request(app)
      .post("/v1/leads")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "create:browser-123")
      .send(body)
      .expect(200);

    expect(first.body.lead.id).toBe(replay.body.lead.id);
    expect(first.body.replayed).toBe(false);
    expect(replay.body.replayed).toBe(true);
    expect(repository.leads.size).toBe(1);
    expect(first.body).toMatchObject({
      actors: { "uid-1": { label: "Julian" } },
      meta: { businessDate: "2026-08-14" },
    });

    await request(app)
      .post("/v1/leads")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "create:browser-123")
      .send({ ...body, note: "Changed request" })
      .expect(409);
  });

  it("enforces optimistic revisions for update, upsert, and archive", async () => {
    const created = await request(app)
      .put("/v1/leads/client_defined")
      .set("authorization", AUTHORIZATION)
      .send({
        name: "Alex",
        phone: "",
        note: "Initial note",
        followUp: "",
        expectedRevision: 0,
      })
      .expect(201);
    expect(created.body.lead.revision).toBe(1);
    expect(created.body.created).toBe(true);

    const updated = await request(app)
      .put("/v1/leads/client_defined")
      .set("authorization", AUTHORIZATION)
      .send({
        name: "Alex",
        phone: "9123 4567",
        note: "Updated note",
        followUp: "2026-08-15",
        expectedRevision: 1,
      })
      .expect(200);
    expect(updated.body.lead.revision).toBe(2);

    const stale = await request(app)
      .put("/v1/leads/client_defined")
      .set("authorization", AUTHORIZATION)
      .send({
        name: "Alex",
        phone: "",
        note: "Stale overwrite",
        followUp: "",
        expectedRevision: 1,
      })
      .expect(409);
    expect(stale.body.error.details).toEqual({ expectedRevision: 1, actualRevision: 2 });

    const archived = await request(app)
      .post("/v1/leads/client_defined/archive")
      .set("authorization", AUTHORIZATION)
      .send({ expectedRevision: 2 })
      .expect(200);
    expect(archived.body.lead).toMatchObject({ status: "archived", revision: 3 });
    expect((await repository.listActiveLeads())).toHaveLength(0);
  });

  it("accepts one deterministic digest and returns its delivery state", async () => {
    const body = {
      idempotencyKey: "digest:2026-08-14:uid-1",
      payload: {
        date: "stale browser display label",
        newLeads: 3,
        samplesSent: 2,
        followUps: [{ phone: "9123 4567", round: "1st", sample: "Sent" }],
        dumped: [{ reason: "No budget" }],
        notes: "One pricing question",
      },
    };

    const first = await request(app)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send(body)
      .expect(202);
    const replay = await request(app)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send(body)
      .expect(200);

    expect(first.body).toMatchObject({
      accepted: true,
      businessDate: "2026-08-14",
      deliveryStatus: "pending",
      acceptedAt: NOW.toISOString(),
      acceptedBy: "uid-1",
      replayed: false,
      actors: { "uid-1": { label: "Julian" } },
    });
    expect(replay.body).toMatchObject({
      accepted: true,
      digestId: first.body.digestId,
      deliveryStatus: "pending",
      replayed: true,
    });
    expect(repository.digests.size).toBe(1);
    expect(repository.outbox.size).toBe(1);

    const receipt = await request(app)
      .get(`/v1/digests/${first.body.digestId}`)
      .set("authorization", AUTHORIZATION)
      .expect(200);
    expect(receipt.body.digest).not.toHaveProperty("payloadHash");
    expect(receipt.body.digest).not.toHaveProperty("idempotencyKey");
    expect(receipt.body.digest).not.toHaveProperty("lastDeliveryError");
    expect(receipt.body.digest.deliveryStatus).toBe("pending");

    await request(app)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send({ ...body, payload: { ...body.payload, notes: "Different" } })
      .expect(409);
  });

  it("allows only one digest per actor and Singapore business date across keys", async () => {
    const payload = {
      date: "Fri, 14 Aug",
      newLeads: 1,
      samplesSent: 0,
      followUps: [],
      dumped: [],
      notes: "First accepted payload wins",
    };
    const submit = (idempotencyKey: string) => request(app)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send({ idempotencyKey, payload });

    const concurrent = await Promise.all([
      submit("digest:device-a:001"),
      submit("digest:device-b:001"),
    ]);
    expect(concurrent.map((response) => response.status).sort()).toEqual([200, 202]);
    expect(concurrent[0]?.body.digestId).toBe(concurrent[1]?.body.digestId);
    expect(concurrent.filter((response) => response.body.replayed === false)).toHaveLength(1);
    expect(repository.digests.size).toBe(1);
    expect(repository.outbox.size).toBe(1);
    expect(repository.audits.filter((event) => event.action === "digest.accepted")).toHaveLength(1);

    const conflict = await request(app)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send({
        idempotencyKey: "digest:device-c:001",
        payload: { ...payload, notes: "A different second submission" },
      })
      .expect(409);
    expect(conflict.body.error.details).toEqual({
      existingDigestId: concurrent[0]?.body.digestId,
      businessDate: "2026-08-14",
    });

    const nextDayApp = createApi({
      repository,
      identityClient,
      now: () => new Date("2026-08-14T16:00:01.000Z"),
    });
    const nextDay = await request(nextDayApp)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send({ idempotencyKey: "digest:next-day:001", payload })
      .expect(202);
    expect(nextDay.body.businessDate).toBe("2026-08-15");
    expect(nextDay.body.digestId).not.toBe(concurrent[0]?.body.digestId);
    expect(repository.digests.size).toBe(2);
    expect(repository.outbox.size).toBe(2);
  });

  it("digest replay preserves original acceptance time and returns later delivery proof", async () => {
    let now = new Date("2026-08-13T16:00:01.000Z");
    const changingClockApp = createApi({
      repository,
      identityClient,
      now: () => now,
      randomId: () => "fixed",
    });
    const body = {
      idempotencyKey: "digest:original-time:001",
      payload: {
        date: "Browser label",
        newLeads: 0,
        samplesSent: 0,
        followUps: [],
        dumped: [],
        notes: "",
      },
    };
    const first = await request(changingClockApp)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send(body)
      .expect(202);
    const stored = repository.digests.get(first.body.digestId);
    if (!stored) throw new Error("test digest missing");
    repository.digests.set(stored.id, {
      ...stored,
      deliveryStatus: "delivered",
      deliveredAt: "2026-08-13T16:00:03.000Z",
      telegramMessageId: 9911,
    });
    now = new Date("2026-08-13T17:30:00.000Z");
    const replay = await request(changingClockApp)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send(body)
      .expect(200);
    expect(replay.body).toMatchObject({
      acceptedAt: "2026-08-13T16:00:01.000Z",
      acceptedBy: "uid-1",
      businessDate: "2026-08-14",
      deliveryStatus: "delivered",
      deliveredAt: "2026-08-13T16:00:03.000Z",
      telegramMessageId: 9911,
      replayed: true,
      meta: { serverTime: "2026-08-13T17:30:00.000Z", businessDate: "2026-08-14" },
    });
  });

  it("omits stale Telegram proof from digest replay and daily status unless delivery is proven", async () => {
    const body = {
      idempotencyKey: "digest:stale-proof:001",
      payload: {
        date: "Browser label",
        newLeads: 0,
        samplesSent: 0,
        followUps: [],
        dumped: [],
        notes: "",
      },
    };
    const first = await request(app)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send(body)
      .expect(202);
    const stored = repository.digests.get(first.body.digestId);
    if (!stored) throw new Error("test digest missing");
    repository.digests.set(stored.id, {
      ...stored,
      deliveryStatus: "retrying",
      deliveredAt: "2026-08-13T16:00:03.000Z",
      telegramMessageId: 9911,
    });

    const replay = await request(app)
      .post("/v1/digests")
      .set("authorization", AUTHORIZATION)
      .send(body)
      .expect(200);
    expect(replay.body.deliveryStatus).toBe("retrying");
    expect(replay.body).not.toHaveProperty("deliveredAt");
    expect(replay.body).not.toHaveProperty("telegramMessageId");

    const daily = await request(app)
      .get("/v1/daily-status")
      .set("authorization", AUTHORIZATION)
      .expect(200);
    expect(daily.body.status.digest.state).toBe("retrying");
    expect(daily.body.status.digest).not.toHaveProperty("deliveredAt");
    expect(daily.body.status.digest).not.toHaveProperty("telegramMessageId");
  });

  it("keeps viewer members read-only", async () => {
    repository.members.set("uid-1", { active: true, role: "viewer" });
    await request(app).get("/v1/leads").set("authorization", AUTHORIZATION).expect(200);
    await request(app)
      .post("/v1/leads")
      .set("authorization", AUTHORIZATION)
      .send({ name: "Alex", phone: "", note: "Should not write", followUp: "" })
      .expect(403);
  });

  it("returns referenced actor labels only and never leaks email-like display names", async () => {
    repository.members.set("uid-2", {
      active: false,
      role: "member",
      displayName: "former@example.com",
      email: "private@example.com",
    });
    repository.members.set("unrelated", { active: true, role: "owner", displayName: "Not Referenced" });
    repository.members.set("uid-email", {
      active: true,
      role: "member",
      displayName: "active@example.com",
    });
    repository.leads.set("migrated", {
      id: "migrated",
      name: "Imported lead",
      phone: "",
      note: "Legacy",
      followUp: "",
      status: "active",
      revision: 1,
      createdAt: NOW.toISOString(),
      createdBy: "migration",
      updatedAt: NOW.toISOString(),
      updatedBy: "uid-2",
    });
    repository.leads.set("email-label", {
      id: "email-label",
      name: "Email-like actor",
      phone: "",
      note: "Privacy fallback",
      followUp: "",
      status: "active",
      revision: 1,
      createdAt: NOW.toISOString(),
      createdBy: "uid-email",
      updatedAt: NOW.toISOString(),
      updatedBy: "migration",
    });
    const response = await request(app)
      .get("/v1/leads")
      .set("authorization", AUTHORIZATION)
      .expect(200);
    expect(response.body.actors).toEqual({
      migration: { label: "Imported" },
      "uid-2": { label: "Former/unknown member" },
    });
    expect(JSON.stringify(response.body.actors)).not.toContain("@");
    expect(response.body.actors).not.toHaveProperty("unrelated");
    expect(response.body.actors).not.toHaveProperty("uid-email");
  });

  it.each([
    ["no_reply", "2026-08-14", "active"],
    ["spoke", "2026-08-20", "active"],
    ["won", undefined, "archived"],
    ["lost", undefined, "archived"],
  ] as const)("logs %s follow-up atomically and replays once", async (outcome, nextFollowUp, status) => {
    const id = `lead_${outcome}`;
    repository.leads.set(id, {
      id,
      name: "Alex",
      phone: "9123 4567",
      note: "Follow up",
      followUp: "2026-08-14",
      status: "active",
      revision: 3,
      createdAt: NOW.toISOString(),
      createdBy: "uid-1",
      updatedAt: NOW.toISOString(),
      updatedBy: "uid-1",
    });
    const body = {
      expectedRevision: 3,
      outcome,
      ...(nextFollowUp ? { nextFollowUp } : {}),
    };
    const first = await request(app)
      .post(`/v1/leads/${id}/follow-ups`)
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", `followup:${outcome}:001`)
      .send(body)
      .expect(201);
    if (status === "active") {
      const later = repository.leads.get(id);
      if (later) repository.leads.set(id, { ...later, revision: 5, note: "A later independent edit" });
    }
    const replay = await request(app)
      .post(`/v1/leads/${id}/follow-ups`)
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", `followup:${outcome}:001`)
      .send(body)
      .expect(200);

    expect(first.body).toMatchObject({
      lead: { id, status, revision: 4 },
      followUp: {
        leadId: id,
        outcome,
        occurredAt: NOW.toISOString(),
        businessDate: "2026-08-14",
        actorUid: "uid-1",
        resultingRevision: 4,
      },
      replayed: false,
      actors: { "uid-1": { label: "Julian" } },
    });
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.lead.revision).toBe(4);
    expect(replay.body.lead.note).toBe("Follow up");
    expect(replay.body.followUp.id).toBe(first.body.followUp.id);
    expect(repository.followUps.size).toBe(1);
    expect(repository.audits.filter((event) => event.action === "lead.followup_logged")).toHaveLength(1);
  });

  it("validates follow-up dates, revisions, required key, and changed replays", async () => {
    repository.leads.set("lead_test", {
      id: "lead_test",
      name: "Alex",
      phone: "",
      note: "Follow up",
      followUp: "",
      status: "active",
      revision: 2,
      createdAt: NOW.toISOString(),
      createdBy: "uid-1",
      updatedAt: NOW.toISOString(),
      updatedBy: "uid-1",
    });
    await request(app)
      .post("/v1/leads/lead_test/follow-ups")
      .set("authorization", AUTHORIZATION)
      .send({ expectedRevision: 2, outcome: "no_reply", nextFollowUp: "2026-08-14" })
      .expect(400);
    await request(app)
      .post("/v1/leads/lead_test/follow-ups")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "followup:bad-date")
      .send({ expectedRevision: 2, outcome: "no_reply", nextFollowUp: "2026-08-13" })
      .expect(400);
    await request(app)
      .post("/v1/leads/lead_test/follow-ups")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "followup:invalid-calendar")
      .send({ expectedRevision: 2, outcome: "no_reply", nextFollowUp: "2026-02-30" })
      .expect(400);
    await request(app)
      .post("/v1/leads/lead_test/follow-ups")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "followup:terminal-date")
      .send({ expectedRevision: 2, outcome: "won", nextFollowUp: "2026-08-20" })
      .expect(400);
    await request(app)
      .post("/v1/leads/lead_test/follow-ups")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "followup:stale-rev")
      .send({ expectedRevision: 1, outcome: "spoke", nextFollowUp: "2026-08-20" })
      .expect(409);
    expect(repository.followUps.size).toBe(0);
    expect(repository.leads.get("lead_test")?.revision).toBe(2);

    const body = { expectedRevision: 2, outcome: "spoke", nextFollowUp: "2026-08-20" };
    await request(app)
      .post("/v1/leads/lead_test/follow-ups")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "followup:stable-key")
      .send(body)
      .expect(201);
    await request(app)
      .post("/v1/leads/lead_test/follow-ups")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "followup:stable-key")
      .send({ ...body, outcome: "no_reply" })
      .expect(409);
    expect(repository.followUps.size).toBe(1);
  });

  it("serializes concurrent follow-up submissions to one event and revision change", async () => {
    repository.leads.set("lead_concurrent", {
      id: "lead_concurrent",
      name: "Concurrent",
      phone: "",
      note: "Only once",
      followUp: "",
      status: "active",
      revision: 5,
      createdAt: NOW.toISOString(),
      createdBy: "uid-1",
      updatedAt: NOW.toISOString(),
      updatedBy: "uid-1",
    });
    const makeRequest = (outcome: "spoke" | "no_reply") => request(app)
      .post("/v1/leads/lead_concurrent/follow-ups")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "followup:concurrent-001")
      .send({ expectedRevision: 5, outcome, nextFollowUp: "2026-08-20" });

    const exact = await Promise.all([makeRequest("spoke"), makeRequest("spoke")]);
    expect(exact.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(exact.map((response) => response.body.followUp.id).every(
      (id) => id === exact[0]?.body.followUp.id,
    )).toBe(true);
    expect(repository.leads.get("lead_concurrent")?.revision).toBe(6);
    expect(repository.followUps.size).toBe(1);
    expect(repository.audits.filter((event) => event.action === "lead.followup_logged")).toHaveLength(1);

    repository.leads.set("lead_conflicting", {
      id: "lead_conflicting",
      name: "Conflicting",
      phone: "",
      note: "One wins",
      followUp: "",
      status: "active",
      revision: 1,
      createdAt: NOW.toISOString(),
      createdBy: "uid-1",
      updatedAt: NOW.toISOString(),
      updatedBy: "uid-1",
    });
    const conflicting = (outcome: "spoke" | "no_reply") => request(app)
      .post("/v1/leads/lead_conflicting/follow-ups")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "followup:concurrent-002")
      .send({ expectedRevision: 1, outcome, nextFollowUp: "2026-08-20" });
    const different = await Promise.all([conflicting("spoke"), conflicting("no_reply")]);
    expect(different.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(repository.leads.get("lead_conflicting")?.revision).toBe(2);
    expect(repository.followUps.size).toBe(2);
  });

  it("returns neutral committed-only self daily status and owner-scoped employee status", async () => {
    const empty = await request(app)
      .get("/v1/daily-status")
      .set("authorization", AUTHORIZATION)
      .expect(200);
    expect(empty.body.status).toEqual({
      businessDate: "2026-08-14",
      timeZone: "Asia/Singapore",
      subject: { uid: "uid-1", label: "Julian" },
      recordedToday: {
        total: 0,
        byKind: {
          leadCreated: 0,
          leadUpdated: 0,
          leadArchived: 0,
          followUpLogged: 0,
          digestAccepted: 0,
        },
      },
      digest: { state: "not_submitted" },
    });

    repository.members.set("employee", {
      active: true,
      role: "member",
      displayName: "Farhan",
      dailyDigestExpected: true,
    });
    repository.audits.push({
      actorUid: "employee",
      action: "lead.followup_logged",
      at: NOW.toISOString(),
      businessDate: "2026-08-14",
    });
    const team = await request(app)
      .get("/v1/team/daily-status")
      .set("authorization", AUTHORIZATION)
      .expect(200);
    expect(team.body.status).toMatchObject({
      subject: { uid: "employee", label: "Farhan" },
      recordedToday: {
        total: 1,
        byKind: { followUpLogged: 1 },
        lastSuccessfulAction: { kind: "followUpLogged", at: NOW.toISOString() },
      },
    });
    expect(team.body.actors).toEqual({ employee: { label: "Farhan" } });
  });

  it("re-reads daily status if Singapore midnight passes during the request", async () => {
    const times = [
      new Date("2026-08-13T15:59:59.999Z"),
      new Date("2026-08-13T16:00:00.000Z"),
      new Date("2026-08-13T16:00:00.001Z"),
    ];
    let index = 0;
    repository.audits.push({
      actorUid: "uid-1",
      action: "lead.created",
      at: "2026-08-13T16:00:00.000Z",
      businessDate: "2026-08-14",
    });
    const midnightApp = createApi({
      repository,
      identityClient,
      now: () => times[Math.min(index++, times.length - 1)] as Date,
    });
    const response = await request(midnightApp)
      .get("/v1/daily-status")
      .set("authorization", AUTHORIZATION)
      .expect(200);
    expect(response.body.status).toMatchObject({
      businessDate: "2026-08-14",
      recordedToday: { total: 1, byKind: { leadCreated: 1 } },
    });
    expect(response.body.meta).toMatchObject({
      businessDate: "2026-08-14",
      serverTime: "2026-08-13T16:00:00.001Z",
    });
  });

  it("enforces owner-only and exact-one employee daily status configuration", async () => {
    let response = await request(app)
      .get("/v1/team/daily-status")
      .set("authorization", AUTHORIZATION)
      .expect(409);
    expect(response.body.error.details.configuredMemberCount).toBe(0);

    repository.members.set("employee-1", { active: true, role: "member", dailyDigestExpected: true });
    repository.members.set("employee-2", { active: true, role: "member", dailyDigestExpected: true });
    response = await request(app)
      .get("/v1/team/daily-status")
      .set("authorization", AUTHORIZATION)
      .expect(409);
    expect(response.body.error.details.configuredMemberCount).toBe(2);

    repository.members.set("uid-1", { active: true, role: "member", displayName: "Julian" });
    await request(app)
      .get("/v1/team/daily-status")
      .set("authorization", AUTHORIZATION)
      .expect(403);
  });

  it("explicitly allowlists digest fields even when storage contains injected private extras", async () => {
    repository.digests.set("digest_injected", {
      id: "digest_injected",
      idempotencyKey: "private-key",
      payloadHash: "private-hash",
      payload: {
        date: "Fri, 14 Aug",
        newLeads: 1,
        samplesSent: 1,
        followUps: [],
        dumped: [],
        notes: "Public note",
      },
      createdAt: NOW.toISOString(),
      createdBy: "uid-1",
      businessDate: "2026-08-14",
      deliveryStatus: "failed",
      lastDeliveryError: "secret provider response",
      migrationSource: "private sheet",
    } as never);
    const response = await request(app)
      .get("/v1/digests/digest_injected")
      .set("authorization", AUTHORIZATION)
      .expect(200);
    expect(response.body.digest).toEqual({
      id: "digest_injected",
      businessDate: "2026-08-14",
      payload: {
        date: "Fri, 14 Aug",
        newLeads: 1,
        samplesSent: 1,
        followUps: [],
        dumped: [],
        notes: "Public note",
      },
      acceptedAt: NOW.toISOString(),
      acceptedBy: "uid-1",
      deliveryStatus: "failed",
    });
  });

  it("never exposes delivered without both persisted Telegram proof fields", async () => {
    repository.digests.set("digest_unproven", {
      id: "digest_unproven",
      idempotencyKey: "private-key",
      payloadHash: "private-hash",
      payload: {
        date: "Fri, 14 Aug",
        newLeads: 0,
        samplesSent: 0,
        followUps: [],
        dumped: [],
        notes: "",
      },
      createdAt: NOW.toISOString(),
      createdBy: "uid-1",
      businessDate: "2026-08-14",
      deliveryStatus: "delivered",
      deliveredAt: NOW.toISOString(),
    });
    const response = await request(app)
      .get("/v1/digests/digest_unproven")
      .set("authorization", AUTHORIZATION)
      .expect(200);
    expect(response.body.digest.deliveryStatus).toBe("legacy_unknown");
    expect(response.body.digest).not.toHaveProperty("deliveredAt");
    expect(response.body.digest).not.toHaveProperty("telegramMessageId");
  });

  it("returns and logs a generic 500 when persisted data fails strict decoding", async () => {
    const logError = vi.fn();
    vi.spyOn(repository, "getDigest").mockRejectedValue(new PersistedDataError());
    const guardedApp = createApi({
      repository,
      identityClient,
      now: () => NOW,
      logError,
    });
    const response = await request(guardedApp)
      .get("/v1/digests/digest_corrupt")
      .set("authorization", AUTHORIZATION)
      .expect(500);
    expect(response.body).toEqual({
      error: {
        code: "internal_error",
        message: "Stored data could not be safely read.",
        requestId: response.headers["x-request-id"],
      },
    });
    expect(logError).toHaveBeenCalledWith("API request failed", expect.objectContaining({
      code: "internal_error",
      errorName: "PersistedDataError",
    }));
  });

  it("keeps canonical responses available when optional actor label lookup fails", async () => {
    const logError = vi.fn();
    vi.spyOn(repository, "resolveActorLabels").mockRejectedValue(new Error("labels unavailable"));
    const resilientApp = createApi({
      repository,
      identityClient,
      now: () => NOW,
      randomId: () => "actor-fallback",
      logError,
    });
    const response = await request(resilientApp)
      .post("/v1/leads")
      .set("authorization", AUTHORIZATION)
      .set("idempotency-key", "create:actor-fallback")
      .send({ name: "Alex", phone: "", note: "Still committed", followUp: "" })
      .expect(201);
    expect(response.body.lead).toMatchObject({ name: "Alex", revision: 1 });
    expect(response.body.actors).toEqual({});
    expect(logError).toHaveBeenCalledWith("Actor label resolution failed", expect.objectContaining({
      referencedActorCount: 1,
    }));
  });
});
