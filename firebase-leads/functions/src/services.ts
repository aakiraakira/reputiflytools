import { createHash, randomUUID } from "node:crypto";
import type {
  Actor,
  DailyStatus,
  Digest,
  DigestDeliveryStatus,
  DigestPayload,
  FollowUpOutcome,
  Lead,
  LeadInput,
  NotificationOutbox,
} from "./domain";
import { AppError } from "./errors";
import { PersistedDataError } from "./persistence";
import { canonicalPhoneDigits } from "./phone";
import type { Repository } from "./repository";
import { businessDate } from "./time";

export function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function deterministicId(prefix: string, uid: string, key: string): string {
  const digest = createHash("sha256").update(`${uid}:${key}`).digest("hex");
  return `${prefix}_${digest}`;
}

export function leadCreatedOutboxId(leadId: string): string {
  return deterministicId("leadnotice", "system", leadId);
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
      ...(actor.role === "member" ? {
        notificationText: formatLeadCreated(lead, actorDisplayLabel(actor)),
      } : {}),
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
      ...(actor.role === "member" ? {
        notificationText: formatLeadCreated(lead, actorDisplayLabel(actor)),
      } : {}),
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

function oneLine(value: string, fallback: string, maximum = 120): string {
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, maximum);
}

function compactExcerpt(value: string, fallback: string, maximum: number): string {
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  const visible = cleaned || fallback;
  return visible.length <= maximum
    ? visible
    : `${visible.slice(0, maximum - 1).trimEnd()}…`;
}

function actorDisplayLabel(actor: Actor): string {
  return oneLine(actor.memberDisplayName || actor.displayName || "Team member", "Team member", 80);
}

export function formatLeadCreated(lead: LeadInput, addedBy: string): string {
  const digits = canonicalPhoneDigits(lead.phone);
  if (!digits) {
    throw new AppError(400, "bad_request", "A usable WhatsApp number is required.");
  }
  const lines = [
    `🆕 New Watchlist lead · ${oneLine(lead.name, "No name")}`,
    `Next chase: ${lead.followUp || "Not set"}`,
    `Note: ${compactExcerpt(lead.note, "No note", 240)}`,
    `Added by ${oneLine(addedBy, "Team member", 80)}`,
    `https://wa.me/${digits}`,
    "https://watchlist-v2.web.app/",
  ];
  const text = lines.join("\n");
  if (text.length > 4_096) {
    throw new AppError(500, "internal_error", "The lead notification is too long.");
  }
  return text;
}

export function formatDigest(
  payload: DigestPayload,
  submittedBy: string,
  recordedOutcomes?: DailyStatus["recordedToday"]["followUpsByOutcome"],
): string {
  const lines = [
    "📋 Reputifly Daily Digest",
    `📅 ${payload.date} · Singapore`,
    `👤 Submitted by ${oneLine(submittedBy, "Team member", 80)}`,
    "",
    "SUMMARY",
    `• New leads: ${countLabel(payload.newLeads)}`,
    `• Samples sent: ${countLabel(payload.samplesSent)}`,
  ];

  if (payload.followUps.length) {
    lines.push("", "FOLLOW-UPS");
    payload.followUps.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.phone} — ${item.round} · Sample: ${item.sample}`);
    });
  }
  if (payload.dumped.length) {
    lines.push("", "DUMPED LEADS");
    payload.dumped.forEach((item, index) => lines.push(`${index + 1}. ${item.reason}`));
  }
  if (payload.notes) lines.push("", "QUESTIONS / NOTES", payload.notes);
  const outcomeLabels: Array<[FollowUpOutcome, string]> = [
    ["no_reply", "No reply"],
    ["spoke", "Spoke"],
    ["won", "Won"],
    ["lost", "Lost"],
  ];
  const recorded = outcomeLabels
    .filter(([outcome]) => (recordedOutcomes?.[outcome] ?? 0) > 0)
    .map(([outcome, label]) => `${label}: ${recordedOutcomes?.[outcome]} recorded`);
  if (recorded.length) lines.push("", "RECORDED OUTCOMES", recorded.join(" · "));

  const text = lines.join("\n");
  if (text.length > 4_096) {
    throw new AppError(400, "bad_request", "This digest is too long for one complete Telegram message. Shorten the notes or split long entries; nothing was submitted.");
  }
  return text;
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
    const dailyStatus = await this.repository.getDailyStatus(actor.uid, localDate);
    return this.repository.createDigest({
      actor,
      digestId,
      idempotencyKey,
      payloadHash: hashValue(payload),
      payload,
      text: formatDigest(
        { ...payload, date: localDate },
        actor.memberDisplayName || actor.displayName || actor.email,
        dailyStatus.recordedToday.followUpsByOutcome,
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
          link_preview_options: { is_disabled: true },
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

export interface MorningReminderBucketCounts {
  overdue: number;
  today: number;
  tomorrow: number;
}

export interface MorningReminderPlan {
  messages: string[];
  leadCount: number;
  bucketCounts: MorningReminderBucketCounts;
}

const TELEGRAM_MESSAGE_LIMIT = 4_096;
const REMINDER_PART_LABEL_RESERVE = 32;

export function nextCalendarDate(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) throw new AppError(500, "internal_error", "The reminder business date is invalid.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new AppError(500, "internal_error", "The reminder business date is invalid.");
  }
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

export function morningReminderOutboxIds(localDate: string, messageCount: number): string[] {
  if (!Number.isInteger(messageCount) || messageCount < 1 || messageCount > 450) {
    throw new AppError(500, "internal_error", "The reminder message count is invalid.");
  }
  const base = `reminder_${localDate}`;
  return Array.from({ length: messageCount }, (_, index) => index === 0 ? base : `${base}_${index + 1}`);
}

export function buildMorningReminder(localDate: string, queriedLeads: Lead[]): MorningReminderPlan {
  const tomorrow = nextCalendarDate(localDate);
  const included = queriedLeads
    .filter(
      (lead) =>
        lead.status === "active" &&
        lead.followUp.length > 0 &&
        lead.followUp <= tomorrow,
    )
    .sort((left, right) => left.followUp.localeCompare(right.followUp) || left.id.localeCompare(right.id));
  const seen = new Set<string>();
  included.forEach((lead) => {
    if (seen.has(lead.id)) throw new PersistedDataError();
    seen.add(lead.id);
  });

  const buckets: Array<{
    label: string;
    leads: Lead[];
  }> = [
    { label: "Overdue", leads: included.filter((lead) => lead.followUp < localDate) },
    { label: "Today", leads: included.filter((lead) => lead.followUp === localDate) },
    { label: "Tomorrow", leads: included.filter((lead) => lead.followUp === tomorrow) },
  ];
  const bucketCounts: MorningReminderBucketCounts = {
    overdue: buckets[0]!.leads.length,
    today: buckets[1]!.leads.length,
    tomorrow: buckets[2]!.leads.length,
  };
  if (!included.length) return { messages: [], leadCount: 0, bucketCounts };

  const header = `📌 Watchlist · ${localDate} SG`;
  const bodyLimit = TELEGRAM_MESSAGE_LIMIT - header.length - 2 - REMINDER_PART_LABEL_RESERVE;
  const bodies: string[] = [];
  let body = "";

  for (const bucket of buckets) {
    if (!bucket.leads.length) continue;
    let headerInCurrentChunk = false;
    for (const lead of bucket.leads) {
      const digits = canonicalPhoneDigits(lead.phone);
      if (!digits) throw new PersistedDataError();
      const entry = [
        `• ${oneLine(lead.name, "No name", 80)} · ${lead.followUp}`,
        `  https://wa.me/${digits}`,
      ].join("\n");
      const bucketHeader = `${bucket.label} (${bucket.leads.length})`;
      const segment = `${headerInCurrentChunk ? "" : `${bucketHeader}\n`}${entry}`;
      const separator = body ? "\n\n" : "";
      if (body && body.length + separator.length + segment.length > bodyLimit) {
        bodies.push(body);
        body = "";
        headerInCurrentChunk = false;
      }
      const nextSegment = `${headerInCurrentChunk ? "" : `${bucketHeader}\n`}${entry}`;
      if (nextSegment.length > bodyLimit) {
        throw new AppError(500, "internal_error", "A reminder entry is too long.");
      }
      body += `${body ? "\n\n" : ""}${nextSegment}`;
      headerInCurrentChunk = true;
    }
  }
  if (body) bodies.push(body);

  const messages = bodies.map((messageBody, index) => {
    const part = bodies.length > 1 ? ` · ${index + 1}/${bodies.length}` : "";
    const text = `${header}${part}\n\n${messageBody}`;
    if (text.length > TELEGRAM_MESSAGE_LIMIT) {
      throw new AppError(500, "internal_error", "A reminder message is too long.");
    }
    return text;
  });
  morningReminderOutboxIds(localDate, messages.length);
  return { messages, leadCount: included.length, bucketCounts };
}

export async function enqueueMorningReminder(input: {
  repository: Repository;
  localDate: string;
  now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());
  const tomorrow = nextCalendarDate(input.localDate);
  const queriedLeads = await input.repository.listMorningReminderLeads(tomorrow);
  const plan = buildMorningReminder(input.localDate, queriedLeads);
  const recordedAt = now().toISOString();
  if (plan.leadCount === 0) {
    const result = {
      created: false,
      skipped: true,
      outboxIds: [] as string[],
      leadCount: 0,
      bucketCounts: plan.bucketCounts,
      messageCount: 0,
    } as const;
    await input.repository.recordSystemHeartbeat("morningReminder", {
      at: recordedAt,
      localDate: input.localDate,
      ...result,
    });
    return result;
  }
  const result = await input.repository.enqueueMorningReminder({
    localDate: input.localDate,
    messages: plan.messages,
    now: recordedAt,
  });
  const messageCount = result.outboxIds.length;
  await input.repository.recordSystemHeartbeat("morningReminder", {
    at: recordedAt,
    localDate: input.localDate,
    skipped: false,
    leadCount: plan.leadCount,
    bucketCounts: plan.bucketCounts,
    messageCount,
    ...result,
  });
  return {
    ...result,
    skipped: false,
    leadCount: plan.leadCount,
    bucketCounts: plan.bucketCounts,
    messageCount,
  } as const;
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
