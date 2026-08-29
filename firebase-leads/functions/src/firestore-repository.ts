import { randomUUID } from "node:crypto";
import type {
  DocumentData,
  DocumentReference,
  Firestore,
  QueryDocumentSnapshot,
  Transaction,
} from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
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
import {
  leadCreatedOutboxId,
  morningReminderOutboxIds,
  outboxReady,
  publicDeliveryStatus,
} from "./services";
import { activePhoneClaimId, canonicalPhoneDigits } from "./phone";

function leadCreatedOutbox(id: string, leadId: string, text: string, now: string): NotificationOutbox {
  return {
    id,
    type: "lead_created",
    leadId,
    status: "pending",
    text,
    attempts: 0,
    availableAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

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
    const pageSize = 500;
    const safeResponseLimit = 5_000;
    const leads: Lead[] = [];
    let lastDocument: QueryDocumentSnapshot<DocumentData> | undefined;

    for (;;) {
      let query = this.db
        .collection("leads")
        .where("status", "==", "active")
        .orderBy("updatedAt", "desc");
      if (lastDocument) query = query.startAfter(lastDocument);
      const snapshot = await query.limit(pageSize).get();
      leads.push(...snapshot.docs.map((doc) => leadFromSnapshot(doc)));
      if (leads.length > safeResponseLimit) {
        throw new AppError(
          503,
          "internal_error",
          "The Watchlist is above its safe response capacity. Support has been alerted.",
        );
      }
      if (snapshot.size < pageSize) return leads;
      lastDocument = snapshot.docs[snapshot.docs.length - 1];
    }
  }

  async listMorningReminderLeads(maxFollowUp: string): Promise<Lead[]> {
    const snapshot = await this.db
      .collection("leads")
      .where("status", "==", "active")
      .where("followUp", ">", "")
      .where("followUp", "<=", maxFollowUp)
      .orderBy("followUp", "asc")
      .get();
    if (snapshot.size > 5_000) {
      throw new AppError(
        503,
        "internal_error",
        "The Watchlist is above its safe reminder capacity. Support has been alerted.",
      );
    }
    return snapshot.docs.map((doc) => leadFromSnapshot(doc));
  }

  async getLeadNotification(leadId: string): Promise<NotificationOutbox | null> {
    const outboxId = leadCreatedOutboxId(leadId);
    const snapshot = await this.db.collection("notificationOutbox").doc(outboxId).get();
    if (!snapshot.exists) return null;
    const outbox = outboxFromPersisted(snapshot.id, snapshot.data() ?? {});
    if (outbox.type !== "lead_created" || outbox.leadId !== leadId) {
      throw new PersistedDataError();
    }
    return outbox;
  }

  async createLead(input: {
    actor: Actor;
    lead: LeadInput;
    id: string;
    now: string;
    idempotencyKey?: string;
    payloadHash: string;
    businessDate: string;
    notificationText?: string;
  }): Promise<LeadCreation> {
    const leadRef = this.db.collection("leads").doc(input.id);
    const auditRef = this.db.collection("auditEvents").doc(randomUUID());
    const outboxId = leadCreatedOutboxId(input.id);
    const outboxRef = this.db.collection("notificationOutbox").doc(outboxId);
    const inputClaimRef = this.db.collection("activePhoneClaims").doc(activePhoneClaimId(input.lead.phone));

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
          const currentClaimRef = activePhoneClaimReference(this.db, lead.phone);
          if (currentClaimRef) {
            const currentClaim = await transaction.get(currentClaimRef);
            const owner = activePhoneClaimOwner(currentClaim.exists ? currentClaim.data() : undefined);
            if (
              (lead.status === "active" && owner !== lead.id) ||
              (lead.status === "archived" && owner === lead.id)
            ) {
              throw new PersistedDataError();
            }
          } else if (lead.status === "active") {
            throw new PersistedDataError();
          }
          return { lead, replayed: true };
        }
        throw new AppError(409, "conflict", "This lead create request conflicts with an existing lead.");
      }
      const claim = await transaction.get(inputClaimRef);
      const claimedLeadId = activePhoneClaimOwner(claim.exists ? claim.data() : undefined);
      if (claimedLeadId) throw duplicatePhoneConflict();

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
      transaction.create(inputClaimRef, { leadId: lead.id });
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
      if (input.notificationText) {
        transaction.create(outboxRef, leadCreatedOutbox(outboxId, input.id, input.notificationText, input.now));
      }
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
    notificationText?: string;
  }): Promise<{ lead: Lead; created: boolean }> {
    const leadRef = this.db.collection("leads").doc(input.id);
    const auditRef = this.db.collection("auditEvents").doc(randomUUID());
    const outboxId = leadCreatedOutboxId(input.id);
    const outboxRef = this.db.collection("notificationOutbox").doc(outboxId);
    const newClaimRef = this.db.collection("activePhoneClaims").doc(activePhoneClaimId(input.lead.phone));

    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(leadRef);
      if (!existing.exists) {
        if (input.expectedRevision !== 0) {
          throw revisionConflict(input.expectedRevision, null);
        }
        const newClaim = await transaction.get(newClaimRef);
        const newClaimOwner = activePhoneClaimOwner(newClaim.exists ? newClaim.data() : undefined);
        if (newClaimOwner) throw duplicatePhoneConflict();
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
        transaction.create(newClaimRef, { leadId: lead.id });
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
        if (input.notificationText) {
          transaction.create(outboxRef, leadCreatedOutbox(outboxId, input.id, input.notificationText, input.now));
        }
        return { lead, created: true };
      }

      const current = leadFromSnapshot(existing as QueryDocumentSnapshot);
      if (current.revision !== input.expectedRevision) {
        throw revisionConflict(input.expectedRevision, current.revision);
      }
      if (current.status !== "active") {
        throw new AppError(409, "conflict", "Archived leads cannot be updated.");
      }
      const oldClaimRef = activePhoneClaimReference(this.db, current.phone);
      const sameClaim = oldClaimRef?.path === newClaimRef.path;
      const newClaim = await transaction.get(newClaimRef);
      const oldClaim = sameClaim || !oldClaimRef ? newClaim : await transaction.get(oldClaimRef);
      const newClaimOwner = activePhoneClaimOwner(newClaim.exists ? newClaim.data() : undefined);
      const oldClaimOwner = oldClaimRef
        ? activePhoneClaimOwner(oldClaim.exists ? oldClaim.data() : undefined)
        : null;
      if (sameClaim && newClaimOwner !== current.id) {
        if (newClaimOwner) throw duplicatePhoneConflict();
        throw new PersistedDataError();
      }
      if (!sameClaim && newClaimOwner && newClaimOwner !== current.id) throw duplicatePhoneConflict();

      const lead: Lead = {
        ...current,
        ...input.lead,
        revision: current.revision + 1,
        updatedAt: input.now,
        updatedBy: input.actor.uid,
      };
      transaction.set(leadRef, lead);
      if (!sameClaim) {
        if (oldClaimRef && oldClaimOwner === current.id) transaction.delete(oldClaimRef);
        if (!newClaimOwner) transaction.create(newClaimRef, { leadId: lead.id });
      }
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
      const claimRef = activePhoneClaimReference(this.db, current.phone);
      const claim = claimRef ? await transaction.get(claimRef) : null;
      const claimOwner = activePhoneClaimOwner(claim?.exists ? claim.data() : undefined);

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
      if (claimRef && claimOwner === current.id) transaction.delete(claimRef);
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
      const claimRef = activePhoneClaimReference(this.db, current.phone);
      const claim = claimRef ? await transaction.get(claimRef) : null;
      const claimOwner = activePhoneClaimOwner(claim?.exists ? claim.data() : undefined);
      if (!terminal) {
        if (!claimRef) {
          throw new AppError(
            409,
            "conflict",
            "Add a usable WhatsApp number before keeping this lead active.",
          );
        }
        if (claimOwner !== current.id) {
          if (claimOwner) throw duplicatePhoneConflict();
          throw new PersistedDataError();
        }
      }
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
      if (terminal && claimRef && claimOwner === current.id) transaction.delete(claimRef);
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
    const followUpsByOutcome = emptyFollowUpsByOutcome();
    let lastSuccessfulAction: DailyStatus["recordedToday"]["lastSuccessfulAction"];
    for (const snapshot of audits.docs) {
      const data = snapshot.data();
      const kind = recordedKind(data.action);
      if (!kind || typeof data.at !== "string") continue;
      byKind[kind] += 1;
      if (kind === "followUpLogged") {
        const outcome = recordedFollowUpOutcome(data.metadata);
        if (outcome) followUpsByOutcome[outcome] += 1;
      }
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
        followUpsByOutcome,
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
            leaseOwner: FieldValue.delete(),
            leaseExpiresAt: FieldValue.delete(),
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
        leaseOwner: FieldValue.delete(),
        leaseExpiresAt: FieldValue.delete(),
      });
      if (current.digestId) {
        transaction.update(this.db.collection("digests").doc(current.digestId), {
          deliveryStatus: "delivered",
          deliveredAt: input.now,
          telegramMessageId: input.telegramMessageId,
          lastDeliveryError: FieldValue.delete(),
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
        leaseOwner: FieldValue.delete(),
        leaseExpiresAt: FieldValue.delete(),
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
    messages: string[];
    now: string;
  }): Promise<{ created: boolean; outboxIds: string[] }> {
    if (
      !input.messages.length ||
      input.messages.length > 450 ||
      input.messages.some((text) => text.length < 1 || text.length > 4_096)
    ) {
      throw new AppError(500, "internal_error", "Morning reminder messages are invalid.");
    }
    const outboxIds = morningReminderOutboxIds(input.localDate, input.messages.length);
    const outboxRefs = outboxIds.map((id) => this.db.collection("notificationOutbox").doc(id));
    const manifestRef = this.db.collection("notificationBatchManifests").doc(outboxIds[0]!);
    return this.db.runTransaction(async (transaction) => {
      const [manifest, existing] = await Promise.all([
        transaction.get(manifestRef),
        transaction.get(outboxRefs[0]!),
      ]);
      if (manifest.exists) {
        const storedCount = manifest.data()?.messageCount;
        if (!Number.isInteger(storedCount) || storedCount < 1 || storedCount > 450) {
          throw new PersistedDataError();
        }
        const originalCount = storedCount as number;
        const originalIds = morningReminderOutboxIds(input.localDate, originalCount);
        const originalRows = await Promise.all(
          originalIds.map((id) => transaction.get(this.db.collection("notificationOutbox").doc(id))),
        );
        if (originalRows.some((snapshot) => !snapshot.exists)) throw new PersistedDataError();
        return { created: false, outboxIds: originalIds };
      }
      // A single reminder created before batch manifests existed remains
      // first-run-wins and is never duplicated by a replay.
      if (existing.exists) return { created: false, outboxIds: [outboxIds[0]!] };
      transaction.create(manifestRef, {
        localDate: input.localDate,
        messageCount: input.messages.length,
        createdAt: input.now,
      });
      outboxRefs.forEach((outboxRef, index) => {
        const availableAt = new Date(Date.parse(input.now) + index).toISOString();
        const outbox: NotificationOutbox = {
          id: outboxIds[index]!,
          type: "morning_reminder",
          status: "pending",
          text: input.messages[index]!,
          attempts: 0,
          availableAt,
          createdAt: input.now,
          updatedAt: input.now,
        };
        transaction.create(outboxRef, outbox);
      });
      return { created: true, outboxIds };
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
    const [staleByAge, staleLeases, dead, oldest] = await Promise.all([
      collection
        .where("status", "in", ["pending", "retry", "processing"])
        .where("createdAt", "<=", input.staleBefore)
        .get(),
      collection
        .where("status", "==", "processing")
        .where("leaseExpiresAt", "<=", input.now)
        .get(),
      collection.where("status", "==", "dead").count().get(),
      collection
        .where("status", "in", ["pending", "retry", "processing"])
        .orderBy("createdAt", "asc")
        .limit(1)
        .get(),
    ]);
    const staleIds = new Set([
      ...staleByAge.docs.map((doc) => doc.id),
      ...staleLeases.docs.map((doc) => doc.id),
    ]);
    const oldestOutstandingAt = oldest.docs[0]?.data().createdAt;
    return {
      staleOutboxCount: staleIds.size,
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

function duplicatePhoneConflict(): AppError {
  return new AppError(
    409,
    "duplicate_phone",
    "That WhatsApp number is already on the active Watchlist.",
  );
}

function activePhoneClaimReference(db: Firestore, phone: string): DocumentReference | null {
  return canonicalPhoneDigits(phone)
    ? db.collection("activePhoneClaims").doc(activePhoneClaimId(phone))
    : null;
}

function activePhoneClaimOwner(data: unknown): string | null {
  if (data === undefined) return null;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new PersistedDataError();
  const leadId = (data as Record<string, unknown>).leadId;
  if (typeof leadId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(leadId)) {
    throw new PersistedDataError();
  }
  return leadId;
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

function emptyFollowUpsByOutcome(): DailyStatus["recordedToday"]["followUpsByOutcome"] {
  return { no_reply: 0, spoke: 0, won: 0, lost: 0 };
}

function recordedFollowUpOutcome(value: unknown): FollowUpOutcome | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const outcome = (value as Record<string, unknown>).outcome;
  switch (outcome) {
    case "no_reply":
    case "spoke":
    case "won":
    case "lost":
      return outcome;
    default:
      return null;
  }
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
