import { createHash, randomUUID } from "node:crypto";
import type {
  Actor,
  Digest,
  DigestDeliveryStatus,
  DigestPayload,
  FollowUpOutcome,
  Lead,
  LeadInput,
  NotificationOutbox,
} from "./domain";
import { AppError } from "./errors";
import type { Repository } from "./repository";
import { businessDate } from "./time";

export function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function deterministicId(prefix: string, uid: string, key: string): string {
  const digest = createHash("sha256").update(`${uid}:${key}`).digest("hex");
  return `${prefix}_${digest}`;
}

export function publicLead(lead: Lead) {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    note: lead.note,
    followUp: lead.followUp,
    status: lead.status,
    revision: lead.revision,
    createdAt: lead.createdAt,
    createdBy: lead.createdBy,
    updatedAt: lead.updatedAt,
    updatedBy: lead.updatedBy,
    ...(lead.archivedAt ? { archivedAt: lead.archivedAt } : {}),
    ...(lead.archivedBy ? { archivedBy: lead.archivedBy } : {}),
  };
}

export function publicFollowUp(followUp: import("./domain").LeadFollowUp) {
  return {
    id: followUp.id,
    leadId: followUp.leadId,
    outcome: followUp.outcome,
    ...(followUp.nextFollowUp ? { nextFollowUp: followUp.nextFollowUp } : {}),
    occurredAt: followUp.occurredAt,
    businessDate: followUp.businessDate,
    actorUid: followUp.actorUid,
    resultingRevision: followUp.resultingRevision,
  };
}

export function publicDeliveryStatus(
  digest: Pick<Digest, "deliveryStatus" | "deliveredAt" | "telegramMessageId">,
): DigestDeliveryStatus {
  const allowed = new Set<DigestDeliveryStatus>([
    "pending",
    "retrying",
    "delivered",
    "failed",
    "legacy_unknown",
  ]);
  if (!allowed.has(digest.deliveryStatus)) return "legacy_unknown";
  const hasProof =
    typeof digest.deliveredAt === "string" &&
    digest.deliveredAt.length > 0 &&
    typeof digest.telegramMessageId === "number" &&
    Number.isInteger(digest.telegramMessageId) &&
    digest.telegramMessageId > 0;
  return digest.deliveryStatus === "delivered" && !hasProof
    ? "legacy_unknown"
    : digest.deliveryStatus;
}

export class LeadService {
  constructor(
    private readonly repository: Repository,
    private readonly now: () => Date = () => new Date(),
    private readonly randomId: () => string = randomUUID,
  ) {}

  async create(actor: Actor, lead: LeadInput, idempotencyKey?: string) {
    const createdAt = this.now();
    const id = idempotencyKey
      ? deterministicId("lead", actor.uid, idempotencyKey)
      : `lead_${this.randomId().replaceAll("-", "")}`;
    const result = await this.repository.createLead({
      actor,
      lead,
      id,
      now: createdAt.toISOString(),
      businessDate: businessDate(createdAt),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      payloadHash: hashValue(lead),
    });
    return { lead: publicLead(result.lead), replayed: result.replayed };
  }

  async put(actor: Actor, id: string, lead: LeadInput, expectedRevision: number) {
    const updatedAt = this.now();
    const result = await this.repository.putLead({
      actor,
      id,
      lead,
      expectedRevision,
      now: updatedAt.toISOString(),
      businessDate: businessDate(updatedAt),
    });
    return { lead: publicLead(result.lead), created: result.created };
  }

  async archive(actor: Actor, id: string, expectedRevision: number) {
    const archivedAt = this.now();
    return publicLead(
      await this.repository.archiveLead({
        actor,
        id,
        expectedRevision,
        now: archivedAt.toISOString(),
        businessDate: businessDate(archivedAt),
      }),
    );
  }
}

function countLabel(value: number): string {
  return value === 10 ? "10+" : String(value);
}

export function formatDigest(payload: DigestPayload, submittedBy: string): string {
  const lines = [
    "Reputifly Daily Digest",
    payload.date,
    "",
    `New leads: ${countLabel(payload.newLeads)}`,
    `Samples sent: ${countLabel(payload.samplesSent)}`,
  ];

  if (payload.followUps.length) {
    lines.push("", "Follow-ups:");
    payload.followUps.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.phone} — ${item.round}; sample: ${item.sample}`);
    });
  }
  if (payload.dumped.length) {
    lines.push("", "Dumped leads:");
    payload.dumped.forEach((item, index) => lines.push(`${index + 1}. ${item.reason}`));
  }
  if (payload.notes) lines.push("", "Questions / notes:", payload.notes);
  lines.push("", `Submitted by ${submittedBy}`);

  return lines.join("\n").slice(0, 4_096);
}

export class DigestService {
  constructor(
    private readonly repository: Repository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(actor: Actor, idempotencyKey: string, payload: DigestPayload) {
    const acceptedAt = this.now();
    const localDate = businessDate(acceptedAt);
    // The server business day, not a browser/tab key, owns the digest slot.
    // This makes concurrent submissions across tabs and devices converge on
    // one Firestore transaction and one notification outbox document.
    const digestId = deterministicId("digest", actor.uid, `business-date:${localDate}`);
    return this.repository.createDigest({
      actor,
      digestId,
      idempotencyKey,
      payloadHash: hashValue(payload),
      payload,
      text: formatDigest(
        { ...payload, date: localDate },
        actor.memberDisplayName || actor.displayName || actor.email,
      ),
      now: acceptedAt.toISOString(),
      businessDate: localDate,
    });
  }
}

export class FollowUpService {
  constructor(
    private readonly repository: Repository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async log(input: {
    actor: Actor;
    leadId: string;
    idempotencyKey: string;
    expectedRevision: number;
    outcome: FollowUpOutcome;
    nextFollowUp?: string;
  }) {
    const occurredAt = this.now();
    const localDate = businessDate(occurredAt);
    const active = input.outcome === "no_reply" || input.outcome === "spoke";
    if (active && !input.nextFollowUp) {
      throw new AppError(400, "bad_request", "A next follow-up date is required for an active outcome.");
    }
    if (!active && input.nextFollowUp) {
      throw new AppError(400, "bad_request", "Terminal outcomes cannot have a next follow-up date.");
    }
    if (input.nextFollowUp && input.nextFollowUp < localDate) {
      throw new AppError(400, "bad_request", "Next follow-up cannot be before today.", {
        businessDate: localDate,
      });
    }
    const payload = {
      leadId: input.leadId,
      expectedRevision: input.expectedRevision,
      outcome: input.outcome,
      ...(input.nextFollowUp ? { nextFollowUp: input.nextFollowUp } : {}),
    };
    return this.repository.logFollowUp({
      actor: input.actor,
      leadId: input.leadId,
      eventId: deterministicId("followup", input.actor.uid, input.idempotencyKey),
      idempotencyKey: input.idempotencyKey,
      payloadHash: hashValue(payload),
      expectedRevision: input.expectedRevision,
      outcome: input.outcome,
      ...(input.nextFollowUp ? { nextFollowUp: input.nextFollowUp } : {}),
      now: occurredAt.toISOString(),
      businessDate: localDate,
    });
  }
}

export interface TelegramSender {
  send(text: string): Promise<{ messageId: number; responseStatus: number }>;
}

export const TELEGRAM_SEND_TIMEOUT_MS = 10_000;
export const OUTBOX_MAX_ITEMS_PER_RUN = 4;
export const OUTBOX_PROCESSING_BUDGET_MS = 48_000;
export const OUTBOX_ITEM_RESERVE_MS = 11_000;
// A lease outlives the declared 55-second Function timeout. If the runtime is
// terminated, the next minute's invocation waits for expiry instead of
// overlapping a send that may still be unwinding.
export const OUTBOX_LEASE_MS = 65_000;

export class TelegramDeliveryError extends Error {
  constructor(
    message: string,
    public readonly responseStatus?: number,
  ) {
    super(message);
    this.name = "TelegramDeliveryError";
  }
}

type FetchLike = typeof fetch;

export class TelegramHttpClient implements TelegramSender {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = TELEGRAM_SEND_TIMEOUT_MS,
  ) {
    if (!botToken || !chatId) throw new Error("Telegram secrets are not configured");
  }

  async send(text: string): Promise<{ messageId: number; responseStatus: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "Telegram request timed out"
        : "Telegram request failed";
      throw new TelegramDeliveryError(message);
    } finally {
      clearTimeout(timeout);
    }

    let body: { ok?: boolean; description?: string; result?: { message_id?: number } } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new TelegramDeliveryError("Telegram returned an invalid response", response.status);
    }

    const messageId = body.result?.message_id;
    if (!response.ok || body.ok !== true || !Number.isInteger(messageId)) {
      throw new TelegramDeliveryError(
        (body.description || `Telegram returned HTTP ${response.status}`).slice(0, 500),
        response.status,
      );
    }
    return { messageId: messageId as number, responseStatus: response.status };
  }
}

export interface ProcessOutboxResult {
  claimed: number;
  delivered: number;
  retrying: number;
  dead: number;
  ignored: number;
}

export async function processOutboxBatch(input: {
  repository: Repository;
  telegram: TelegramSender;
  now?: () => Date;
  leaseOwner?: string;
  limit?: number;
  maxAttempts?: number;
  processingBudgetMs?: number;
  perItemReserveMs?: number;
  leaseMs?: number;
}): Promise<ProcessOutboxResult> {
  const now = input.now ?? (() => new Date());
  const leaseOwner = input.leaseOwner ?? randomUUID();
  const maxAttempts = input.maxAttempts ?? 8;
  const startedAt = now();
  const processingDeadline = startedAt.getTime()
    + Math.max(1, input.processingBudgetMs ?? OUTBOX_PROCESSING_BUDGET_MS);
  const perItemReserveMs = Math.max(1, input.perItemReserveMs ?? OUTBOX_ITEM_RESERVE_MS);
  const leaseMs = Math.max(
    input.leaseMs ?? OUTBOX_LEASE_MS,
    (input.processingBudgetMs ?? OUTBOX_PROCESSING_BUDGET_MS) + 5_000,
  );
  const leaseExpiresAt = new Date(startedAt.getTime() + leaseMs).toISOString();
  const itemLimit = Math.min(Math.max(input.limit ?? OUTBOX_MAX_ITEMS_PER_RUN, 1), OUTBOX_MAX_ITEMS_PER_RUN);
  const result: ProcessOutboxResult = {
    claimed: 0,
    delivered: 0,
    retrying: 0,
    dead: 0,
    ignored: 0,
  };

  // Claim exactly one row immediately before its send. A slow first send can
  // therefore consume the budget without incrementing attempts on later rows.
  while (result.claimed < itemLimit) {
    const claimAt = now();
    if (processingDeadline - claimAt.getTime() < perItemReserveMs) break;
    const [item] = await input.repository.claimOutbox({
      now: claimAt.toISOString(),
      leaseOwner,
      leaseExpiresAt,
      limit: 1,
    });
    if (!item) break;
    result.claimed += 1;
    try {
      const receipt = await input.telegram.send(item.text);
      await input.repository.markOutboxDelivered({
        id: item.id,
        leaseOwner,
        now: now().toISOString(),
        telegramMessageId: receipt.messageId,
        responseStatus: receipt.responseStatus,
      });
      result.delivered += 1;
    } catch (error) {
      const failedAt = now();
      const delayMs = retryDelayMs(item.attempts);
      const state = await input.repository.markOutboxFailed({
        id: item.id,
        leaseOwner,
        now: failedAt.toISOString(),
        message: deliveryErrorMessage(error),
        ...(error instanceof TelegramDeliveryError && error.responseStatus !== undefined
          ? { responseStatus: error.responseStatus }
          : {}),
        maxAttempts,
        nextAvailableAt: new Date(failedAt.getTime() + delayMs).toISOString(),
      });
      if (state === "retry") result.retrying += 1;
      else if (state === "dead") result.dead += 1;
      else result.ignored += 1;
    }
  }

  await input.repository.recordSystemHeartbeat("outboxWorker", {
    at: now().toISOString(),
    ...result,
  });
  return result;
}

function retryDelayMs(attempt: number): number {
  return Math.min(60_000 * 2 ** Math.max(attempt - 1, 0), 6 * 60 * 60_000);
}

function deliveryErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Unknown Telegram delivery error";
}

export function buildMorningReminder(localDate: string, dueCount: number): string {
  const due = `${dueCount} lead${dueCount === 1 ? " is" : "s are"} due or overdue.`;
  return `Reputifly Watchlist — ${localDate}\n${due}\nReview the Watchlist.`;
}

export async function enqueueMorningReminder(input: {
  repository: Repository;
  localDate: string;
  now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());
  const dueCount = await input.repository.countDueLeads(input.localDate);
  const recordedAt = now().toISOString();
  if (dueCount === 0) {
    const result = { created: false, skipped: true, dueCount } as const;
    await input.repository.recordSystemHeartbeat("morningReminder", {
      at: recordedAt,
      localDate: input.localDate,
      ...result,
    });
    return result;
  }
  const result = await input.repository.enqueueMorningReminder({
    localDate: input.localDate,
    text: buildMorningReminder(input.localDate, dueCount),
    now: recordedAt,
  });
  await input.repository.recordSystemHeartbeat("morningReminder", {
    at: recordedAt,
    localDate: input.localDate,
    skipped: false,
    dueCount,
    ...result,
  });
  return { ...result, skipped: false, dueCount } as const;
}

export function assertIdempotencyKey(value: string | undefined, required = false): string | undefined {
  if (value === undefined) {
    if (required) throw new AppError(400, "bad_request", "Idempotency-Key is required.");
    return undefined;
  }
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(value)) {
    throw new AppError(400, "bad_request", "Idempotency-Key is invalid.");
  }
  return value;
}

export function outboxReady(item: NotificationOutbox, now: string): boolean {
  return (
    ((item.status === "pending" || item.status === "retry") && item.availableAt <= now) ||
    (item.status === "processing" && !!item.leaseExpiresAt && item.leaseExpiresAt <= now)
  );
}
