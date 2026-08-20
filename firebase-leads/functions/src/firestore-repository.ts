import { randomUUID } from "node:crypto";
import type {
  DocumentData,
  DocumentReference,
  Firestore,
  QueryDocumentSnapshot,
  Transaction,
} from "firebase-admin/firestore";
import type {
  Actor,
  AuditEvent,
  DailyStatus,
  Digest,
  DigestAcceptance,
  DigestPayload,
  Lead,
  LeadCreation,
  FollowUpOutcome,
  FollowUpReceipt,
  LeadFollowUp,
  LeadInput,
  Member,
  NotificationOutbox,
} from "./domain";
import { AppError } from "./errors";
import {
  PersistedDataError,
  digestFromPersisted,
  followUpFromPersisted,
  leadFromPersisted,
  memberFromPersisted,
  outboxFromPersisted,
} from "./persistence";
import type { Repository } from "./repository";
import { outboxReady, publicDeliveryStatus } from "./services";

export class FirestoreRepository implements Repository {
  constructor(private readonly db: Firestore) {}

  async getMember(uid: string): Promise<Member | null> {
    const snapshot = await this.db.collection("members").doc(uid).get();
    if (!snapshot.exists) return null;
    return memberFromPersisted(snapshot.data());
  }

  async resolveActorLabels(uids: string[]): Promise<Record<string, { label: string }>> {
    const unique = [...new Set(uids.filter((uid) => typeof uid === "string" && uid.length > 0))];
    const result: Record<string, { label: string }> = {};
    if (unique.includes("migration")) result.migration = { label: "Imported" };
    const memberUids = unique.filter((uid) => uid !== "migration").slice(0, 1_000);
    if (!memberUids.length) return result;

    const snapshots = await this.db.getAll(
      ...memberUids.map((uid) => this.db.collection("members").doc(uid)),
    );
    snapshots.forEach((snapshot) => {
      if (!snapshot.exists) return;
      const member = memberFromPersisted(snapshot.data());
      if (!member) return;
      if (member.active === false) {
        result[snapshot.id] = { label: "Former/unknown member" };
        return;
      }
      const displayName = member.displayName;
      if (typeof displayName !== "string") return;
      const label = sanitizeActorLabel(displayName);
      if (label) result[snapshot.id] = { label };
    });
    return result;
  }

  async getExpectedDigestMembers(): Promise<Array<{ uid: string; member: Member }>> {
    const snapshot = await this.db
      .collection("members")
      .where("active", "==", true)
      .where("dailyDigestExpected", "==", true)
      .where("role", "==", "member")
      .limit(2)
      .get();
    const result: Array<{ uid: string; member: Member }> = [];
    for (const doc of snapshot.docs) {
      const member = memberFromPersisted(doc.data());
      if (
        !member ||
        !member.active ||
        member.role !== "member" ||
        member.dailyDigestExpected !== true
      ) continue;
      result.push({
        uid: doc.id,
        member: {
          active: true,
          role: "member",
          dailyDigestExpected: true,
          ...(member.displayName ? { displayName: member.displayName } : {}),
        },
      });
    }
    return result;
  }

  async listActiveLeads(): Promise<Lead[]> {
    const snapshot = await this.db
      .collection("leads")
      .where("status", "==", "active")
      .orderBy("updatedAt", "desc")
      .limit(500)
      .get();
    return snapshot.docs.map((doc) => leadFromSnapshot(doc));
  }

  async countDueLeads(localDate: string): Promise<number> {
    const snapshot = await this.db
      .collection("leads")
      .where("status", "==", "active")
      .where("followUp", ">", "")
      .where("followUp", "<=", localDate)
      .count()
      .get();
    return snapshot.data().count;
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
    const leadRef = this.db.collection("leads").doc(input.id);
    const auditRef = this.db.collection("auditEvents").doc(randomUUID());

    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(leadRef);
      if (existing.exists) {
        const lead = leadFromSnapshot(existing as QueryDocumentSnapshot);
        if (
          input.idempotencyKey &&
          lead.createdBy === input.actor.uid &&
          lead.createIdempotencyKey === input.idempotencyKey &&
          lead.createPayloadHash === input.payloadHash
        ) {
          return { lead, replayed: true };
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
      transaction.create(leadRef, lead);
      transaction.create(
        auditRef,
        audit(
          input.actor,
          "lead.created",
          "lead",
          input.id,
          input.now,
          input.businessDate,
          { revision: 1 },
        ),
      );
      return { lead, replayed: false };
    });
  }

  async putLead(input: {
    actor: Actor;
    id: string;
    lead: LeadInput;
    expectedRevision: number;
    now: string;
    businessDate: string;
  }): Promise<{ lead: Lead; created: boolean }> {
    const leadRef = this.db.collection("leads").doc(input.id);
    const auditRef = this.db.collection("auditEvents").doc(randomUUID());

    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(leadRef);
      if (!existing.exists) {
        if (input.expectedRevision !== 0) {
          throw revisionConflict(input.expectedRevision, null);
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
        };
        transaction.create(leadRef, lead);
        transaction.create(
          auditRef,
          audit(
            input.actor,
            "lead.upserted",
            "lead",
            input.id,
            input.now,
            input.businessDate,
            { revision: 1 },
          ),
        );
        return { lead, created: true };
      }

      const current = leadFromSnapshot(existing as QueryDocumentSnapshot);
      if (current.revision !== input.expectedRevision) {
        throw revisionConflict(input.expectedRevision, current.revision);
      }
      if (current.status !== "active") {
        throw new AppError(409, "conflict", "Archived leads cannot be updated.");
      }

      const lead: Lead = {
        ...current,
        ...input.lead,
        revision: current.revision + 1,
        updatedAt: input.now,
        updatedBy: input.actor.uid,
      };
      transaction.set(leadRef, lead);
      transaction.create(
        auditRef,
        audit(input.actor, "lead.updated", "lead", input.id, input.now, input.businessDate, {
          fromRevision: current.revision,
          toRevision: lead.revision,
        }),
      );
      return { lead, created: false };
    });
  }

  async archiveLead(input: {
    actor: Actor;
    id: string;
    expectedRevision: number;
    now: string;
    businessDate: string;
  }): Promise<Lead> {
    const leadRef = this.db.collection("leads").doc(input.id);
    const auditRef = this.db.collection("auditEvents").doc(randomUUID());

    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(leadRef);
      if (!existing.exists) throw new AppError(404, "not_found", "Lead not found.");
      const current = leadFromSnapshot(existing as QueryDocumentSnapshot);
      if (current.revision !== input.expectedRevision) {
        throw revisionConflict(input.expectedRevision, current.revision);
      }
      if (current.status !== "active") {
        throw new AppError(409, "conflict", "Lead is already archived.");
      }

      const lead: Lead = {
        ...current,
        status: "archived",
        revision: current.revision + 1,
        updatedAt: input.now,
        updatedBy: input.actor.uid,
        archivedAt: input.now,
        archivedBy: input.actor.uid,
      };
      transaction.set(leadRef, lead);
      transaction.create(
        auditRef,
        audit(input.actor, "lead.archived", "lead", input.id, input.now, input.businessDate, {
          fromRevision: current.revision,
          toRevision: lead.revision,
        }),
      );
      return lead;
    });
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
    const eventRef = this.db.collection("leadFollowUps").doc(input.eventId);
    const leadRef = this.db.collection("leads").doc(input.leadId);
    const auditRef = this.db.collection("auditEvents").doc(`followup_${input.eventId}`);

    return this.db.runTransaction(async (transaction) => {
      // Idempotency must be read first: a terminal result archives the lead, but
      // a lost-response replay must still succeed against the original receipt.
      const existingEvent = await transaction.get(eventRef);
      if (existingEvent.exists) {
        const followUp = followUpFromData(existingEvent.id, existingEvent.data() ?? {});
        if (
          followUp.actorUid !== input.actor.uid ||
          followUp.idempotencyKey !== input.idempotencyKey ||
          followUp.payloadHash !== input.payloadHash
        ) {
          throw new AppError(409, "conflict", "Idempotency key was already used with different data.");
        }
        let replayLead = followUp.resultingLead;
        if (!replayLead) {
          const replayLeadSnapshot = await transaction.get(leadRef);
          if (!replayLeadSnapshot.exists) {
            throw new AppError(409, "conflict", "Follow-up receipt has no lead.");
          }
          replayLead = leadFromSnapshot(replayLeadSnapshot as QueryDocumentSnapshot);
        }
        return {
          lead: replayLead,
          followUp,
          replayed: true,
        };
      }

      const leadSnapshot = await transaction.get(leadRef);
      if (!leadSnapshot.exists) throw new AppError(404, "not_found", "Lead not found.");
      const current = leadFromSnapshot(leadSnapshot as QueryDocumentSnapshot);
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
        resultingLead: lead,
      };

      transaction.set(leadRef, lead);
      transaction.create(eventRef, followUp);
      transaction.create(
        auditRef,
        audit(input.actor, "lead.followup_logged", "lead", input.leadId, input.now, input.businessDate, {
          outcome: input.outcome,
          resultingRevision: lead.revision,
        }),
      );
      return { lead, followUp, replayed: false };
    });
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
    const digestRef = this.db.collection("digests").doc(input.digestId);
    const outboxRef = this.db.collection("notificationOutbox").doc(`digest_${input.digestId}`);
    const auditRef = this.db.collection("auditEvents").doc(randomUUID());

    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(digestRef);
      if (existing.exists) {
        const digest = digestFromPersisted(existing.id, existing.data());
        const existingBusinessDate = digest.businessDate ?? requireBusinessDate(undefined, digest.createdAt);
        if (digest.createdBy !== input.actor.uid || existingBusinessDate !== input.businessDate) {
          throw new AppError(409, "conflict", "The daily digest slot conflicts with existing data.");
        }
        if (digest.payloadHash !== input.payloadHash) {
          throw new AppError(409, "conflict", "A different digest was already accepted for this business date.", {
            existingDigestId: digest.id,
            businessDate: existingBusinessDate,
          });
        }
        const deliveryStatus = publicDeliveryStatus(digest);
        const hasDeliveryProof = deliveryStatus === "delivered";
        return {
          accepted: true,
          digestId: digest.id,
          businessDate: existingBusinessDate,
          deliveryStatus,
          acceptedAt: digest.createdAt,
          acceptedBy: digest.createdBy,
          ...(hasDeliveryProof
            ? {
                deliveredAt: digest.deliveredAt,
                telegramMessageId: digest.telegramMessageId,
              }
            : {}),
          replayed: true,
        };
      }

      const digest: Digest = {
        id: input.digestId,
        idempotencyKey: input.idempotencyKey,
        payloadHash: input.payloadHash,
        payload: input.payload,
        createdAt: input.now,
        createdBy: input.actor.uid,
        businessDate: input.businessDate,
        deliveryStatus: "pending",
      };
      const outbox: NotificationOutbox = {
        id: outboxRef.id,
        type: "digest",
        digestId: input.digestId,
        status: "pending",
        text: input.text,
        attempts: 0,
        availableAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      };
      transaction.create(digestRef, digest);
      transaction.create(outboxRef, outbox);
      transaction.create(
        auditRef,
        audit(input.actor, "digest.accepted", "digest", input.digestId, input.now, input.businessDate, {
          outboxId: outbox.id,
        }),
      );
      return {
        accepted: true,
        digestId: input.digestId,
        businessDate: input.businessDate,
        deliveryStatus: "pending",
        acceptedAt: input.now,
        acceptedBy: input.actor.uid,
        replayed: false,
      };
    });
  }

  async getDigest(id: string): Promise<Digest | null> {
    const snapshot = await this.db.collection("digests").doc(id).get();
    return snapshot.exists ? digestFromPersisted(snapshot.id, snapshot.data()) : null;
  }

  async getDailyStatus(uid: string, businessDate: string): Promise<DailyStatus> {
    const [audits, digests] = await Promise.all([
      this.db
        .collection("auditEvents")
        .where("actorUid", "==", uid)
        .where("businessDate", "==", businessDate)
        .orderBy("at", "desc")
        .get(),
      this.db
        .collection("digests")
        .where("createdBy", "==", uid)
        .where("businessDate", "==", businessDate)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get(),
    ]);
    const byKind = emptyRecordedByKind();
    let lastSuccessfulAction: DailyStatus["recordedToday"]["lastSuccessfulAction"];
    for (const snapshot of audits.docs) {
      const data = snapshot.data();
      const kind = recordedKind(data.action);
      if (!kind || typeof data.at !== "string") continue;
      byKind[kind] += 1;
      if (!lastSuccessfulAction) lastSuccessfulAction = { kind, at: data.at };
    }
    const digestSnapshot = digests.docs[0];
    const digest = digestSnapshot
      ? digestFromPersisted(digestSnapshot.id, digestSnapshot.data())
      : null;
    const digestState = digest ? publicDeliveryStatus(digest) : "not_submitted";
    const hasDeliveryProof = digestState === "delivered";
    return {
      businessDate,
      timeZone: "Asia/Singapore",
      subject: { uid },
      recordedToday: {
        total: Object.values(byKind).reduce((sum, count) => sum + count, 0),
        byKind,
        ...(lastSuccessfulAction ? { lastSuccessfulAction } : {}),
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
    const collection = this.db.collection("notificationOutbox");
    // Scan past a small number of malformed candidates so quarantining one row
    // cannot prevent a valid notification behind it from being claimed.
    const scanLimit = Math.min(Math.max(input.limit * 10, 10), 50);
    const [available, expired] = await Promise.all([
      collection
        .where("status", "in", ["pending", "retry"])
        .where("availableAt", "<=", input.now)
        .orderBy("availableAt", "asc")
        .limit(scanLimit)
        .get(),
      collection
        .where("status", "==", "processing")
        .where("leaseExpiresAt", "<=", input.now)
        .orderBy("leaseExpiresAt", "asc")
        .limit(scanLimit)
        .get(),
    ]);

    const candidates = new Map<string, DocumentReference>();
    [...available.docs, ...expired.docs].forEach((doc) => candidates.set(doc.id, doc.ref));
    const claimed: NotificationOutbox[] = [];

    for (const ref of candidates.values()) {
      if (claimed.length >= input.limit) break;
      const item = await this.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return null;
        let current: NotificationOutbox;
        try {
          current = outboxFromPersisted(snapshot.id, snapshot.data());
        } catch (error) {
          if (!(error instanceof PersistedDataError)) throw error;
          transaction.update(ref, {
            status: "dead",
            updatedAt: input.now,
            leaseOwner: null,
            leaseExpiresAt: null,
            lastFailure: {
              at: input.now,
              message: "Stored notification was invalid and was quarantined.",
            },
          });
          return null;
        }
        if (!outboxReady(current, input.now)) return null;
        const next: NotificationOutbox = {
          ...current,
          status: "processing",
          attempts: current.attempts + 1,
          leaseOwner: input.leaseOwner,
          leaseExpiresAt: input.leaseExpiresAt,
          updatedAt: input.now,
        };
        transaction.set(ref, next);
        return next;
      });
      if (item) claimed.push(item);
    }
    return claimed;
  }

  async markOutboxDelivered(input: {
    id: string;
    leaseOwner: string;
    now: string;
    telegramMessageId: number;
    responseStatus: number;
  }): Promise<void> {
    const outboxRef = this.db.collection("notificationOutbox").doc(input.id);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(outboxRef);
      if (!snapshot.exists) return;
      const current = outboxFromData(snapshot.id, snapshot.data() ?? {});
      if (current.status !== "processing" || current.leaseOwner !== input.leaseOwner) return;
      transaction.update(outboxRef, {
        status: "delivered",
        deliveredAt: input.now,
        updatedAt: input.now,
        telegramMessageId: input.telegramMessageId,
        telegramResponseStatus: input.responseStatus,
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      if (current.digestId) {
        transaction.update(this.db.collection("digests").doc(current.digestId), {
          deliveryStatus: "delivered",
          deliveredAt: input.now,
          telegramMessageId: input.telegramMessageId,
          lastDeliveryError: null,
        });
      }
    });
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
    const outboxRef = this.db.collection("notificationOutbox").doc(input.id);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(outboxRef);
      if (!snapshot.exists) return "ignored";
      const current = outboxFromData(snapshot.id, snapshot.data() ?? {});
      if (current.status !== "processing" || current.leaseOwner !== input.leaseOwner) return "ignored";

      const state = current.attempts >= input.maxAttempts ? "dead" : "retry";
      transaction.update(outboxRef, {
        status: state,
        availableAt: state === "retry" ? input.nextAvailableAt : current.availableAt,
        updatedAt: input.now,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastFailure: {
          at: input.now,
          message: input.message.slice(0, 500),
          ...(input.responseStatus !== undefined ? { responseStatus: input.responseStatus } : {}),
        },
      });
      if (current.digestId) {
        transaction.update(this.db.collection("digests").doc(current.digestId), {
          deliveryStatus: state === "dead" ? "failed" : "retrying",
          lastDeliveryError: input.message.slice(0, 500),
        });
      }
      return state;
    });
  }

  async enqueueMorningReminder(input: {
    localDate: string;
    text: string;
    now: string;
  }): Promise<{ created: boolean; outboxId: string }> {
    const outboxId = `reminder_${input.localDate}`;
    const outboxRef = this.db.collection("notificationOutbox").doc(outboxId);
    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(outboxRef);
      if (existing.exists) return { created: false, outboxId };
      const outbox: NotificationOutbox = {
        id: outboxId,
        type: "morning_reminder",
        status: "pending",
        text: input.text,
        attempts: 0,
        availableAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      };
      transaction.create(outboxRef, outbox);
      return { created: true, outboxId };
    });
  }

  async checkOperationalHealth(input: {
    now: string;
    staleBefore: string;
  }): Promise<{
    staleOutboxCount: number;
    deadOutboxCount: number;
    oldestOutstandingAt?: string;
  }> {
    const collection = this.db.collection("notificationOutbox");
    const [staleAvailable, staleLeases, dead, oldest] = await Promise.all([
      collection
        .where("status", "in", ["pending", "retry"])
        .where("availableAt", "<=", input.staleBefore)
        .count()
        .get(),
      collection
        .where("status", "==", "processing")
        .where("leaseExpiresAt", "<=", input.now)
        .count()
        .get(),
      collection.where("status", "==", "dead").count().get(),
      collection
        .where("status", "in", ["pending", "retry"])
        .orderBy("availableAt", "asc")
        .limit(1)
        .get(),
    ]);
    const oldestOutstandingAt = oldest.docs[0]?.data().availableAt;
    return {
      staleOutboxCount: staleAvailable.data().count + staleLeases.data().count,
      deadOutboxCount: dead.data().count,
      ...(typeof oldestOutstandingAt === "string" ? { oldestOutstandingAt } : {}),
    };
  }

  async recordSystemHeartbeat(id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection("system").doc(id).set(data, { merge: true });
  }
}

function leadFromSnapshot(snapshot: QueryDocumentSnapshot): Lead {
  return leadFromPersisted(snapshot.id, snapshot.data());
}

function digestFromData(id: string, data: DocumentData): Digest {
  return digestFromPersisted(id, data);
}

function outboxFromData(id: string, data: DocumentData): NotificationOutbox {
  return outboxFromPersisted(id, data);
}

function followUpFromData(id: string, data: DocumentData): LeadFollowUp {
  return followUpFromPersisted(id, data);
}

function revisionConflict(expected: number, actual: number | null): AppError {
  return new AppError(409, "conflict", "Lead revision conflict.", {
    expectedRevision: expected,
    actualRevision: actual,
  });
}

function audit(
  actor: Actor,
  action: string,
  targetType: AuditEvent["targetType"],
  targetId: string,
  at: string,
  businessDate: string,
  metadata?: Record<string, unknown>,
): AuditEvent {
  return {
    action,
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetType,
    targetId,
    at,
    businessDate,
    ...(metadata ? { metadata } : {}),
  };
}

function sanitizeActorLabel(value: string): string {
  const label = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().replace(/\s+/g, " ").slice(0, 80);
  return label.includes("@") ? "" : label;
}

function requireBusinessDate(value: string | undefined, at: string): string {
  if (value) return value;
  return businessDateFromIso(at);
}

function businessDateFromIso(at: string): string {
  const date = new Date(at);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function emptyRecordedByKind(): DailyStatus["recordedToday"]["byKind"] {
  return {
    leadCreated: 0,
    leadUpdated: 0,
    leadArchived: 0,
    followUpLogged: 0,
    digestAccepted: 0,
  };
}

function recordedKind(value: unknown): keyof ReturnType<typeof emptyRecordedByKind> | null {
  switch (value) {
    case "lead.created":
    case "lead.upserted":
      return "leadCreated";
    case "lead.updated":
      return "leadUpdated";
    case "lead.archived":
      return "leadArchived";
    case "lead.followup_logged":
      return "followUpLogged";
    case "digest.accepted":
      return "digestAccepted";
    default:
      return null;
  }
}

// Kept here so transactions never accidentally perform an extra read after a
// write. Firestore requires all reads to happen before the first transaction write.
export function transactionGet<T extends DocumentData>(
  transaction: Transaction,
  reference: DocumentReference<T>,
) {
  return transaction.get(reference);
}
