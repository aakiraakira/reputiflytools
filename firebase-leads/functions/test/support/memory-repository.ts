import type {
  Actor,
  Digest,
  DigestAcceptance,
  DigestPayload,
  DailyStatus,
  FollowUpOutcome,
  FollowUpReceipt,
  LeadFollowUp,
  Lead,
  LeadCreation,
  LeadInput,
  Member,
  NotificationOutbox,
} from "../../src/domain";
import { AppError } from "../../src/errors";
import type { Repository } from "../../src/repository";
import { outboxReady, publicDeliveryStatus } from "../../src/services";

export class MemoryRepository implements Repository {
  readonly members = new Map<string, Member>();
  readonly leads = new Map<string, Lead>();
  readonly digests = new Map<string, Digest>();
  readonly outbox = new Map<string, NotificationOutbox>();
  readonly followUps = new Map<string, LeadFollowUp>();
  readonly audits: Array<{ actorUid: string; action: string; at: string; businessDate: string }> = [];
  readonly heartbeats = new Map<string, Record<string, unknown>>();

  async getMember(uid: string): Promise<Member | null> {
    return clone(this.members.get(uid) ?? null);
  }

  async resolveActorLabels(uids: string[]): Promise<Record<string, { label: string }>> {
    const result: Record<string, { label: string }> = {};
    for (const uid of new Set(uids)) {
      if (uid === "migration") {
        result.migration = { label: "Imported" };
        continue;
      }
      const member = this.members.get(uid);
      if (member?.active === false) {
        result[uid] = { label: "Former/unknown member" };
        continue;
      }
      const name = member?.displayName
        ?.replace(/[\u0000-\u001F\u007F]/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);
      if (name && !name.includes("@")) result[uid] = { label: name };
    }
    return clone(result);
  }

  async getExpectedDigestMembers(): Promise<Array<{ uid: string; member: Member }>> {
    return [...this.members.entries()]
      .filter(([, member]) => member.active && member.role === "member" && member.dailyDigestExpected === true)
      .slice(0, 2)
      .map(([uid, member]) => ({ uid, member: clone(member) }));
  }

  async listActiveLeads(): Promise<Lead[]> {
    return [...this.leads.values()]
      .filter((lead) => lead.status === "active")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(clone);
  }

  async countDueLeads(localDate: string): Promise<number> {
    return [...this.leads.values()].filter(
      (lead) => lead.status === "active" && lead.followUp !== "" && lead.followUp <= localDate,
    ).length;
  }

  async createLead(input: {
    actor: Actor;
    lead: LeadInput;
    id: string;
    now: string;
    idempotencyKey?: string;
    payloadHash: string;
    businessDate: string;
  }): Promise<LeadCreation> {
    const existing = this.leads.get(input.id);
    if (existing) {
      if (
        input.idempotencyKey &&
        existing.createdBy === input.actor.uid &&
        existing.createIdempotencyKey === input.idempotencyKey &&
        existing.createPayloadHash === input.payloadHash
      ) {
        return { lead: clone(existing), replayed: true };
      }
      throw new AppError(409, "conflict", "This lead create request conflicts with an existing lead.");
    }
    const lead: Lead = {
      id: input.id,
      ...input.lead,
      status: "active",
      revision: 1,
      createdAt: input.now,
      createdBy: input.actor.uid,
      updatedAt: input.now,
      updatedBy: input.actor.uid,
      ...(input.idempotencyKey ? { createIdempotencyKey: input.idempotencyKey } : {}),
      createPayloadHash: input.payloadHash,
    };
    this.leads.set(lead.id, clone(lead));
    this.audits.push({ actorUid: input.actor.uid, action: "lead.created", at: input.now, businessDate: input.businessDate });
    return { lead: clone(lead), replayed: false };
  }

  async putLead(input: {
    actor: Actor;
    id: string;
    lead: LeadInput;
    expectedRevision: number;
    now: string;
    businessDate: string;
  }): Promise<{ lead: Lead; created: boolean }> {
    const current = this.leads.get(input.id);
    if (!current) {
      if (input.expectedRevision !== 0) throw revisionConflict(input.expectedRevision, null);
      const lead: Lead = {
        id: input.id,
        ...input.lead,
        status: "active",
        revision: 1,
        createdAt: input.now,
        createdBy: input.actor.uid,
        updatedAt: input.now,
        updatedBy: input.actor.uid,
      };
      this.leads.set(input.id, clone(lead));
      this.audits.push({ actorUid: input.actor.uid, action: "lead.upserted", at: input.now, businessDate: input.businessDate });
      return { lead: clone(lead), created: true };
    }
    if (current.revision !== input.expectedRevision) {
      throw revisionConflict(input.expectedRevision, current.revision);
    }
    if (current.status !== "active") throw new AppError(409, "conflict", "Archived leads cannot be updated.");
    const lead: Lead = {
      ...current,
      ...input.lead,
      revision: current.revision + 1,
      updatedAt: input.now,
      updatedBy: input.actor.uid,
    };
    this.leads.set(input.id, clone(lead));
    this.audits.push({ actorUid: input.actor.uid, action: "lead.updated", at: input.now, businessDate: input.businessDate });
    return { lead: clone(lead), created: false };
  }

  async archiveLead(input: {
    actor: Actor;
    id: string;
    expectedRevision: number;
    now: string;
    businessDate: string;
  }): Promise<Lead> {
    const current = this.leads.get(input.id);
    if (!current) throw new AppError(404, "not_found", "Lead not found.");
    if (current.revision !== input.expectedRevision) {
      throw revisionConflict(input.expectedRevision, current.revision);
    }
    if (current.status !== "active") throw new AppError(409, "conflict", "Lead is already archived.");
    const lead: Lead = {
      ...current,
      status: "archived",
      revision: current.revision + 1,
      updatedAt: input.now,
      updatedBy: input.actor.uid,
      archivedAt: input.now,
      archivedBy: input.actor.uid,
    };
    this.leads.set(input.id, clone(lead));
    this.audits.push({ actorUid: input.actor.uid, action: "lead.archived", at: input.now, businessDate: input.businessDate });
    return clone(lead);
  }

  async logFollowUp(input: {
    actor: Actor;
    leadId: string;
    eventId: string;
    idempotencyKey: string;
    payloadHash: string;
    expectedRevision: number;
    outcome: FollowUpOutcome;
    nextFollowUp?: string;
    now: string;
    businessDate: string;
  }): Promise<FollowUpReceipt> {
    const existing = this.followUps.get(input.eventId);
    if (existing) {
      if (
        existing.actorUid !== input.actor.uid ||
        existing.idempotencyKey !== input.idempotencyKey ||
        existing.payloadHash !== input.payloadHash
      ) {
        throw new AppError(409, "conflict", "Idempotency key was already used with different data.");
      }
      const lead = existing.resultingLead ?? this.leads.get(input.leadId);
      if (!lead) throw new AppError(409, "conflict", "Follow-up receipt has no lead.");
      return { lead: clone(lead), followUp: clone(existing), replayed: true };
    }
    const current = this.leads.get(input.leadId);
    if (!current) throw new AppError(404, "not_found", "Lead not found.");
    if (current.revision !== input.expectedRevision) {
      throw revisionConflict(input.expectedRevision, current.revision);
    }
    if (current.status !== "active") {
      throw new AppError(409, "conflict", "Archived leads cannot receive follow-ups.");
    }
    const terminal = input.outcome === "won" || input.outcome === "lost";
    const lead: Lead = {
      ...current,
      followUp: terminal ? "" : (input.nextFollowUp as string),
      status: terminal ? "archived" : "active",
      revision: current.revision + 1,
      updatedAt: input.now,
      updatedBy: input.actor.uid,
      ...(terminal ? { archivedAt: input.now, archivedBy: input.actor.uid } : {}),
    };
    const followUp: LeadFollowUp = {
      id: input.eventId,
      leadId: input.leadId,
      outcome: input.outcome,
      ...(input.nextFollowUp ? { nextFollowUp: input.nextFollowUp } : {}),
      occurredAt: input.now,
      businessDate: input.businessDate,
      actorUid: input.actor.uid,
      resultingRevision: lead.revision,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      resultingLead: clone(lead),
    };
    this.leads.set(input.leadId, clone(lead));
    this.followUps.set(input.eventId, clone(followUp));
    this.audits.push({ actorUid: input.actor.uid, action: "lead.followup_logged", at: input.now, businessDate: input.businessDate });
    return { lead: clone(lead), followUp: clone(followUp), replayed: false };
  }

  async createDigest(input: {
    actor: Actor;
    digestId: string;
    idempotencyKey: string;
    payloadHash: string;
    payload: DigestPayload;
    text: string;
    now: string;
    businessDate: string;
  }): Promise<DigestAcceptance> {
    const existing = this.digests.get(input.digestId);
    if (existing) {
      const existingBusinessDate = existing.businessDate ?? input.businessDate;
      if (existing.createdBy !== input.actor.uid || existingBusinessDate !== input.businessDate) {
        throw new AppError(409, "conflict", "The daily digest slot conflicts with existing data.");
      }
      if (existing.payloadHash !== input.payloadHash) {
        throw new AppError(409, "conflict", "A different digest was already accepted for this business date.", {
          existingDigestId: existing.id,
          businessDate: existingBusinessDate,
        });
      }
      const deliveryStatus = publicDeliveryStatus(existing);
      const hasDeliveryProof = deliveryStatus === "delivered";
      return {
        accepted: true,
        digestId: existing.id,
        businessDate: existingBusinessDate,
        deliveryStatus,
        acceptedAt: existing.createdAt,
        acceptedBy: existing.createdBy,
        ...(hasDeliveryProof
          ? {
              deliveredAt: existing.deliveredAt,
              telegramMessageId: existing.telegramMessageId,
            }
          : {}),
        replayed: true,
      };
    }
    const digest: Digest = {
      id: input.digestId,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      payload: clone(input.payload),
      createdAt: input.now,
      createdBy: input.actor.uid,
      businessDate: input.businessDate,
      deliveryStatus: "pending",
    };
    const outboxId = `digest_${input.digestId}`;
    const outbox: NotificationOutbox = {
      id: outboxId,
      type: "digest",
      digestId: input.digestId,
      status: "pending",
      text: input.text,
      attempts: 0,
      availableAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.digests.set(digest.id, clone(digest));
    this.outbox.set(outbox.id, clone(outbox));
    this.audits.push({ actorUid: input.actor.uid, action: "digest.accepted", at: input.now, businessDate: input.businessDate });
    return {
      accepted: true,
      digestId: digest.id,
      businessDate: input.businessDate,
      deliveryStatus: "pending",
      acceptedAt: input.now,
      acceptedBy: input.actor.uid,
      replayed: false,
    };
  }

  async getDigest(id: string): Promise<Digest | null> {
    return clone(this.digests.get(id) ?? null);
  }

  async getDailyStatus(uid: string, localDate: string): Promise<DailyStatus> {
    const matching = this.audits
      .filter((event) => event.actorUid === uid && event.businessDate === localDate)
      .sort((left, right) => right.at.localeCompare(left.at));
    const byKind = {
      leadCreated: 0,
      leadUpdated: 0,
      leadArchived: 0,
      followUpLogged: 0,
      digestAccepted: 0,
    };
    const kinds: Record<string, keyof typeof byKind> = {
      "lead.created": "leadCreated",
      "lead.upserted": "leadCreated",
      "lead.updated": "leadUpdated",
      "lead.archived": "leadArchived",
      "lead.followup_logged": "followUpLogged",
      "digest.accepted": "digestAccepted",
    };
    matching.forEach((event) => {
      const kind = kinds[event.action];
      if (kind) byKind[kind] += 1;
    });
    const first = matching.find((event) => kinds[event.action]);
    const digest = [...this.digests.values()]
      .filter((item) => item.createdBy === uid && item.businessDate === localDate)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    const digestState = digest ? publicDeliveryStatus(digest) : "not_submitted";
    const hasDeliveryProof = digestState === "delivered";
    return {
      businessDate: localDate,
      timeZone: "Asia/Singapore",
      subject: { uid },
      recordedToday: {
        total: Object.values(byKind).reduce((sum, count) => sum + count, 0),
        byKind,
        ...(first ? { lastSuccessfulAction: { kind: kinds[first.action] as keyof typeof byKind, at: first.at } } : {}),
      },
      digest: digest
        ? {
            state: digestState,
            digestId: digest.id,
            acceptedAt: digest.createdAt,
            ...(hasDeliveryProof
              ? {
                  deliveredAt: digest.deliveredAt,
                  telegramMessageId: digest.telegramMessageId,
                }
              : {}),
          }
        : { state: "not_submitted" },
    };
  }

  async claimOutbox(input: {
    now: string;
    leaseOwner: string;
    leaseExpiresAt: string;
    limit: number;
  }): Promise<NotificationOutbox[]> {
    const candidates = [...this.outbox.values()]
      .filter((item) => outboxReady(item, input.now))
      .sort((left, right) => left.availableAt.localeCompare(right.availableAt))
      .slice(0, input.limit);
    return candidates.map((item) => {
      const claimed: NotificationOutbox = {
        ...item,
        status: "processing",
        attempts: item.attempts + 1,
        leaseOwner: input.leaseOwner,
        leaseExpiresAt: input.leaseExpiresAt,
        updatedAt: input.now,
      };
      this.outbox.set(item.id, clone(claimed));
      return clone(claimed);
    });
  }

  async markOutboxDelivered(input: {
    id: string;
    leaseOwner: string;
    now: string;
    telegramMessageId: number;
    responseStatus: number;
  }): Promise<void> {
    const current = this.outbox.get(input.id);
    if (!current || current.status !== "processing" || current.leaseOwner !== input.leaseOwner) return;
    const delivered: NotificationOutbox = {
      ...current,
      status: "delivered",
      deliveredAt: input.now,
      telegramMessageId: input.telegramMessageId,
      updatedAt: input.now,
    };
    delete delivered.leaseOwner;
    delete delivered.leaseExpiresAt;
    this.outbox.set(input.id, clone(delivered));
    if (current.digestId) {
      const digest = this.digests.get(current.digestId);
      if (digest) {
        this.digests.set(digest.id, {
          ...digest,
          deliveryStatus: "delivered",
          deliveredAt: input.now,
          telegramMessageId: input.telegramMessageId,
        });
      }
    }
  }

  async markOutboxFailed(input: {
    id: string;
    leaseOwner: string;
    now: string;
    message: string;
    responseStatus?: number;
    maxAttempts: number;
    nextAvailableAt: string;
  }): Promise<"retry" | "dead" | "ignored"> {
    const current = this.outbox.get(input.id);
    if (!current || current.status !== "processing" || current.leaseOwner !== input.leaseOwner) {
      return "ignored";
    }
    const status = current.attempts >= input.maxAttempts ? "dead" : "retry";
    const failed: NotificationOutbox = {
      ...current,
      status,
      updatedAt: input.now,
      availableAt: status === "retry" ? input.nextAvailableAt : current.availableAt,
      lastFailure: {
        at: input.now,
        message: input.message,
        ...(input.responseStatus !== undefined ? { responseStatus: input.responseStatus } : {}),
      },
    };
    delete failed.leaseOwner;
    delete failed.leaseExpiresAt;
    this.outbox.set(input.id, clone(failed));
    if (current.digestId) {
      const digest = this.digests.get(current.digestId);
      if (digest) {
        this.digests.set(digest.id, {
          ...digest,
          deliveryStatus: status === "dead" ? "failed" : "retrying",
          lastDeliveryError: input.message,
        });
      }
    }
    return status;
  }

  async enqueueMorningReminder(input: {
    localDate: string;
    text: string;
    now: string;
  }): Promise<{ created: boolean; outboxId: string }> {
    const outboxId = `reminder_${input.localDate}`;
    if (this.outbox.has(outboxId)) return { created: false, outboxId };
    this.outbox.set(outboxId, {
      id: outboxId,
      type: "morning_reminder",
      status: "pending",
      text: input.text,
      attempts: 0,
      availableAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    });
    return { created: true, outboxId };
  }

  async checkOperationalHealth(input: {
    now: string;
    staleBefore: string;
  }): Promise<{
    staleOutboxCount: number;
    deadOutboxCount: number;
    oldestOutstandingAt?: string;
  }> {
    const outstanding = [...this.outbox.values()].filter(
      (item) => item.status === "pending" || item.status === "retry",
    );
    const staleAvailable = outstanding.filter((item) => item.availableAt <= input.staleBefore).length;
    const staleLeases = [...this.outbox.values()].filter(
      (item) => item.status === "processing" && !!item.leaseExpiresAt && item.leaseExpiresAt <= input.now,
    ).length;
    const oldestOutstandingAt = outstanding
      .map((item) => item.availableAt)
      .sort()[0];
    return {
      staleOutboxCount: staleAvailable + staleLeases,
      deadOutboxCount: [...this.outbox.values()].filter((item) => item.status === "dead").length,
      ...(oldestOutstandingAt ? { oldestOutstandingAt } : {}),
    };
  }

  async recordSystemHeartbeat(id: string, data: Record<string, unknown>): Promise<void> {
    this.heartbeats.set(id, clone(data));
  }
}

function revisionConflict(expected: number, actual: number | null): AppError {
  return new AppError(409, "conflict", "Lead revision conflict.", {
    expectedRevision: expected,
    actualRevision: actual,
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
