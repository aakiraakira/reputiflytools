import { z } from "zod";
import type {
  Digest,
  Lead,
  LeadFollowUp,
  Member,
  NotificationOutbox,
} from "./domain";
import { AppError } from "./errors";

const documentIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const actorUidSchema = z.string().min(1).max(128);
const businessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
const timestampSchema = z
  .string()
  .min(20)
  .max(40)
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/)
  .refine((value) => !Number.isNaN(Date.parse(value)));

const leadSchema: z.ZodType<Lead> = z
  .object({
    id: documentIdSchema,
    name: z.string().max(120),
    phone: z.string().max(40),
    note: z.string().min(1).max(5_000),
    followUp: z.union([z.literal(""), businessDateSchema]),
    status: z.enum(["active", "archived"]),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    createdAt: timestampSchema,
    createdBy: actorUidSchema,
    updatedAt: timestampSchema,
    updatedBy: actorUidSchema,
    archivedAt: timestampSchema.optional(),
    archivedBy: actorUidSchema.optional(),
    createIdempotencyKey: z.string().min(8).max(200).optional(),
    createPayloadHash: z.string().min(1).max(200).optional(),
  })
  .strip()
  .superRefine((lead, context) => {
    if (!lead.name.trim() && !lead.phone.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: "missing lead identity" });
    }
    if (lead.status === "archived" && (!lead.archivedAt || !lead.archivedBy)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["archivedAt"], message: "missing archive proof" });
    }
    if (lead.status === "active" && (lead.archivedAt || lead.archivedBy)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "active lead has archive proof" });
    }
  });

const digestPayloadSchema = z
  .object({
    date: z.string().min(1).max(80),
    newLeads: z.number().int().min(0).max(10),
    samplesSent: z.number().int().min(0).max(10),
    followUps: z
      .array(
        z
          .object({
            phone: z.string().min(1).max(40),
            round: z.string().min(1).max(40),
            sample: z.string().min(1).max(80),
          })
          .strict(),
      )
      .max(100),
    dumped: z.array(z.object({ reason: z.string().min(1).max(500) }).strict()).max(100),
    notes: z.string().max(10_000),
  })
  .strict();

const digestSchema: z.ZodType<Digest> = z
  .object({
    id: documentIdSchema,
    idempotencyKey: z.string().min(1).max(200),
    payloadHash: z.string().min(1).max(200),
    payload: digestPayloadSchema,
    createdAt: timestampSchema,
    createdBy: actorUidSchema,
    businessDate: businessDateSchema.optional(),
    deliveryStatus: z.enum(["pending", "retrying", "delivered", "failed", "legacy_unknown"]),
    deliveredAt: timestampSchema.optional(),
    telegramMessageId: z.number().int().positive().optional(),
    lastDeliveryError: z.string().max(500).optional(),
  })
  // Historical migration provenance remains stored, but no unlisted field can
  // enter the application domain or a public response.
  .strip();

const outboxSchema: z.ZodType<NotificationOutbox> = z
  .object({
    id: documentIdSchema,
    type: z.enum(["digest", "morning_reminder"]),
    digestId: documentIdSchema.optional(),
    status: z.enum(["pending", "retry", "processing", "delivered", "dead"]),
    text: z.string().min(1).max(4_096),
    attempts: z.number().int().min(0).max(1_000),
    availableAt: timestampSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    leaseOwner: z.string().min(1).max(128).optional(),
    leaseExpiresAt: timestampSchema.optional(),
    deliveredAt: timestampSchema.optional(),
    telegramMessageId: z.number().int().positive().optional(),
    lastFailure: z
      .object({
        at: timestampSchema,
        message: z.string().min(1).max(500),
        responseStatus: z.number().int().min(100).max(599).optional(),
      })
      .strict()
      .optional(),
  })
  .strip()
  .superRefine((item, context) => {
    if (item.type === "digest" && !item.digestId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["digestId"], message: "missing digest id" });
    }
    if (item.status === "processing" && (!item.leaseOwner || !item.leaseExpiresAt)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["leaseOwner"], message: "missing processing lease" });
    }
  });

const followUpSchema: z.ZodType<LeadFollowUp> = z
  .object({
    id: documentIdSchema,
    leadId: documentIdSchema,
    outcome: z.enum(["no_reply", "spoke", "won", "lost"]),
    nextFollowUp: businessDateSchema.optional(),
    occurredAt: timestampSchema,
    businessDate: businessDateSchema,
    actorUid: actorUidSchema,
    resultingRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    idempotencyKey: z.string().min(8).max(200).optional(),
    payloadHash: z.string().min(1).max(200).optional(),
    resultingLead: leadSchema.optional(),
  })
  .strip()
  .superRefine((followUp, context) => {
    const active = followUp.outcome === "no_reply" || followUp.outcome === "spoke";
    if (active && !followUp.nextFollowUp) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextFollowUp"], message: "missing next date" });
    }
    if (!active && followUp.nextFollowUp) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextFollowUp"], message: "terminal next date" });
    }
    if (followUp.resultingLead && followUp.resultingLead.revision !== followUp.resultingRevision) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["resultingLead"], message: "revision mismatch" });
    }
  });

const memberSchema: z.ZodType<Member> = z
  .object({
    active: z.boolean(),
    role: z.enum(["owner", "member", "viewer"]),
    displayName: z.string().max(200).optional(),
    email: z.string().max(320).optional(),
    dailyDigestExpected: z.boolean().optional(),
  })
  .strip();

export class PersistedDataError extends AppError {
  constructor() {
    super(500, "internal_error", "Stored data could not be safely read.");
    this.name = "PersistedDataError";
  }
}

export function leadFromPersisted(id: string, data: unknown): Lead {
  return decode(leadSchema, id, data);
}

export function digestFromPersisted(id: string, data: unknown): Digest {
  return decode(digestSchema, id, data);
}

export function outboxFromPersisted(id: string, data: unknown): NotificationOutbox {
  return decode(outboxSchema, id, data);
}

export function followUpFromPersisted(id: string, data: unknown): LeadFollowUp {
  return decode(followUpSchema, id, data);
}

export function memberFromPersisted(data: unknown): Member | null {
  const result = memberSchema.safeParse(data);
  return result.success ? result.data : null;
}

function decode<T>(schema: z.ZodType<T>, id: string, data: unknown): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new PersistedDataError();
  const result = schema.safeParse({ ...(data as Record<string, unknown>), id });
  if (!result.success) throw new PersistedDataError();
  return result.data;
}
