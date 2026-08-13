import { z } from "zod";
import { AppError } from "./errors";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const documentId = /^[A-Za-z0-9_-]{1,128}$/;
const calendarDateSchema = z
  .string()
  .regex(isoDate, "Must be YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Must be a real calendar date");

const leadShape = {
  name: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  note: z.string().trim().min(1).max(5_000),
  followUp: z.union([z.literal(""), calendarDateSchema]).default(""),
};

function requireLeadIdentity(
  lead: { name: string; phone: string },
  context: z.RefinementCtx,
): void {
    if (!lead.name && !lead.phone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A name or phone number is required.",
        path: ["name"],
      });
    }
}

export const leadInputSchema = z.object(leadShape).strict().superRefine(requireLeadIdentity);

export const updateLeadSchema = z
  .object({
    ...leadShape,
    expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .superRefine(requireLeadIdentity);

export const archiveLeadSchema = z
  .object({ expectedRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) })
  .strict();

const digestFollowUpSchema = z
  .object({
    phone: z.string().trim().min(1).max(40),
    round: z.string().trim().min(1).max(40),
    sample: z.string().trim().min(1).max(80),
  })
  .strict();

const dumpedSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export const digestPayloadSchema = z
  .object({
    date: z.string().trim().min(1).max(80),
    newLeads: z.number().int().min(0).max(10),
    samplesSent: z.number().int().min(0).max(10),
    followUps: z.array(digestFollowUpSchema).max(100).default([]),
    dumped: z.array(dumpedSchema).max(100).default([]),
    notes: z.string().trim().max(10_000).default(""),
  })
  .strict();

export const createDigestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
    payload: digestPayloadSchema,
  })
  .strict();

export const followUpSchema = z
  .object({
    expectedRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    outcome: z.enum(["no_reply", "spoke", "won", "lost"]),
    nextFollowUp: calendarDateSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const active = value.outcome === "no_reply" || value.outcome === "spoke";
    if (active && !value.nextFollowUp) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nextFollowUp"],
        message: "A next follow-up date is required for an active outcome.",
      });
    }
    if (!active && value.nextFollowUp !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nextFollowUp"],
        message: "Terminal outcomes cannot have a next follow-up date.",
      });
    }
  });

export function parseBody<Schema extends z.ZodTypeAny>(
  schema: Schema,
  body: unknown,
): z.output<Schema> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  throw new AppError(400, "bad_request", "Request validation failed.", {
    fields: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export function parseDocumentId(value: string, label = "id"): string {
  if (!documentId.test(value)) {
    throw new AppError(400, "bad_request", `Invalid ${label}.`);
  }
  return value;
}
