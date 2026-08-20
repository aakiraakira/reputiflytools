export type MemberRole = "owner" | "member" | "viewer";

export interface Member {
  active: boolean;
  role: MemberRole;
  displayName?: string;
  email?: string;
  dailyDigestExpected?: boolean;
}

export interface LegacyIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
}

export interface Actor extends LegacyIdentity {
  role: MemberRole;
  memberDisplayName?: string;
}

export interface LeadInput {
  name: string;
  phone: string;
  note: string;
  followUp: string;
}

export interface Lead extends LeadInput {
  id: string;
  status: "active" | "archived";
  revision: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  archivedAt?: string;
  archivedBy?: string;
  createIdempotencyKey?: string;
  createPayloadHash?: string;
}

export interface PublicLead {
  id: string;
  name: string;
  phone: string;
  note: string;
  followUp: string;
  status: "active" | "archived";
  revision: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  archivedAt?: string;
  archivedBy?: string;
}

export interface ActorLabel {
  label: string;
}

export type ActorLabels = Record<string, ActorLabel>;

export interface DigestFollowUp {
  phone: string;
  round: string;
  sample: string;
}

export interface DigestDumpedLead {
  reason: string;
}

export interface DigestPayload {
  date: string;
  newLeads: number;
  samplesSent: number;
  followUps: DigestFollowUp[];
  dumped: DigestDumpedLead[];
  notes: string;
}

export type DigestDeliveryStatus =
  | "pending"
  | "retrying"
  | "delivered"
  | "failed"
  | "legacy_unknown";

export interface Digest {
  id: string;
  idempotencyKey: string;
  payloadHash: string;
  payload: DigestPayload;
  createdAt: string;
  createdBy: string;
  businessDate?: string;
  deliveryStatus: DigestDeliveryStatus;
  deliveredAt?: string;
  telegramMessageId?: number;
  lastDeliveryError?: string;
}

export type OutboxStatus = "pending" | "retry" | "processing" | "delivered" | "dead";

export interface NotificationOutbox {
  id: string;
  type: "digest" | "morning_reminder";
  digestId?: string;
  status: OutboxStatus;
  text: string;
  attempts: number;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  deliveredAt?: string;
  telegramMessageId?: number;
  lastFailure?: {
    at: string;
    message: string;
    responseStatus?: number;
  };
}

export interface DigestAcceptance {
  accepted: true;
  digestId: string;
  businessDate: string;
  deliveryStatus: DigestDeliveryStatus;
  acceptedAt: string;
  acceptedBy: string;
  deliveredAt?: string;
  telegramMessageId?: number;
  replayed: boolean;
}

export interface LeadCreation {
  lead: Lead;
  replayed: boolean;
}

export interface DeliveryReceipt {
  messageId: number;
  responseStatus: number;
}

export interface AuditEvent {
  action: string;
  actorUid: string;
  actorEmail?: string;
  targetType: "lead" | "digest" | "outbox" | "system";
  targetId: string;
  at: string;
  businessDate: string;
  metadata?: Record<string, unknown>;
}

export type FollowUpOutcome = "no_reply" | "spoke" | "won" | "lost";

export interface LeadFollowUp {
  id: string;
  leadId: string;
  outcome: FollowUpOutcome;
  nextFollowUp?: string;
  occurredAt: string;
  businessDate: string;
  actorUid: string;
  resultingRevision: number;
  idempotencyKey?: string;
  payloadHash?: string;
  resultingLead?: Lead;
}

export interface PublicLeadFollowUp {
  id: string;
  leadId: string;
  outcome: FollowUpOutcome;
  nextFollowUp?: string;
  occurredAt: string;
  businessDate: string;
  actorUid: string;
  resultingRevision: number;
}

export interface FollowUpReceipt {
  lead: Lead;
  followUp: LeadFollowUp;
  replayed: boolean;
}

export type RecordedActionKind =
  | "leadCreated"
  | "leadUpdated"
  | "leadArchived"
  | "followUpLogged"
  | "digestAccepted";

export interface RecordedToday {
  total: number;
  byKind: Record<RecordedActionKind, number>;
  lastSuccessfulAction?: {
    kind: RecordedActionKind;
    at: string;
  };
}

export interface DailyDigestStatus {
  state: "not_submitted" | DigestDeliveryStatus;
  digestId?: string;
  acceptedAt?: string;
  deliveredAt?: string;
  telegramMessageId?: number;
}

export interface DailyStatus {
  businessDate: string;
  timeZone: "Asia/Singapore";
  subject: { uid: string };
  recordedToday: RecordedToday;
  digest: DailyDigestStatus;
}
