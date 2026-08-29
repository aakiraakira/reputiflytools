import type {
  Actor,
  Digest,
  DigestAcceptance,
  DigestPayload,
  DailyStatus,
  FollowUpOutcome,
  FollowUpReceipt,
  Lead,
  LeadCreation,
  LeadInput,
  Member,
  NotificationOutbox,
} from "./domain";

export interface Repository {
  getMember(uid: string): Promise<Member | null>;
  resolveActorLabels(uids: string[]): Promise<Record<string, { label: string }>>;
  getExpectedDigestMembers(): Promise<Array<{ uid: string; member: Member }>>;
  listActiveLeads(): Promise<Lead[]>;
  countDueLeads(localDate: string): Promise<number>;
  createLead(input: {
    actor: Actor;
    lead: LeadInput;
    id: string;
    now: string;
    idempotencyKey?: string;
    payloadHash: string;
    businessDate: string;
  }): Promise<LeadCreation>;
  putLead(input: {
    actor: Actor;
    id: string;
    lead: LeadInput;
    expectedRevision: number;
    now: string;
    businessDate: string;
  }): Promise<{ lead: Lead; created: boolean }>;
  archiveLead(input: {
    actor: Actor;
    id: string;
    expectedRevision: number;
    now: string;
    businessDate: string;
  }): Promise<Lead>;
  logFollowUp(input: {
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
  }): Promise<FollowUpReceipt>;
  createDigest(input: {
    actor: Actor;
    digestId: string;
    idempotencyKey: string;
    payloadHash: string;
    payload: DigestPayload;
    text: string;
    now: string;
    businessDate: string;
  }): Promise<DigestAcceptance>;
  getDigest(id: string): Promise<Digest | null>;
  getDailyStatus(uid: string, businessDate: string): Promise<DailyStatus>;
  claimOutbox(input: {
    now: string;
    leaseOwner: string;
    leaseExpiresAt: string;
    limit: number;
  }): Promise<NotificationOutbox[]>;
  markOutboxDelivered(input: {
    id: string;
    leaseOwner: string;
    now: string;
    telegramMessageId: number;
    responseStatus: number;
  }): Promise<void>;
  markOutboxFailed(input: {
    id: string;
    leaseOwner: string;
    now: string;
    message: string;
    responseStatus?: number;
    maxAttempts: number;
    nextAvailableAt: string;
  }): Promise<"retry" | "dead" | "ignored">;
  enqueueMorningReminder(input: {
    localDate: string;
    text: string;
    now: string;
  }): Promise<{ created: boolean; outboxId: string }>;
  checkOperationalHealth(input: {
    now: string;
    staleBefore: string;
  }): Promise<{
    staleOutboxCount: number;
    deadOutboxCount: number;
    oldestOutstandingAt?: string;
  }>;
  recordSystemHeartbeat(id: string, data: Record<string, unknown>): Promise<void>;
}
