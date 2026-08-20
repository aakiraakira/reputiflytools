const BUSINESS_TIME_ZONE = "Asia/Singapore";
const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DOCUMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,100}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const RECORDED_ACTION_KINDS = Object.freeze([
  "leadCreated",
  "leadUpdated",
  "leadArchived",
  "followUpLogged",
  "digestAccepted",
]);

export const DIGEST_DELIVERY_STATES = Object.freeze([
  "pending",
  "retrying",
  "delivered",
  "failed",
  "legacy_unknown",
]);

const LEAD_REQUIRED_KEYS = [
  "id",
  "name",
  "phone",
  "note",
  "followUp",
  "status",
  "revision",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
];
const LEAD_ALLOWED_KEYS = [...LEAD_REQUIRED_KEYS, "archivedAt", "archivedBy"];

export function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: must be an object`);
  }
  return value;
}

export function assertExactKeys(value, { allowed, required = allowed }, label) {
  const object = assertRecord(value, label);
  const allowedSet = new Set(allowed);
  const extra = Object.keys(object).filter((key) => !allowedSet.has(key));
  const missing = required.filter((key) => !Object.hasOwn(object, key));
  if (extra.length) throw new Error(`${label}: unexpected public field(s): ${extra.join(", ")}`);
  if (missing.length) throw new Error(`${label}: missing public field(s): ${missing.join(", ")}`);
  return object;
}

export function singaporeBusinessDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Cannot derive Singapore business date from an invalid instant");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function validateSuccessMeta(meta, label = "meta") {
  assertExactKeys(meta, {
    allowed: ["serverTime", "requestId", "businessDate"],
  }, label);
  assertUtcIso(meta.serverTime, `${label}.serverTime`);
  if (typeof meta.requestId !== "string" || !REQUEST_ID.test(meta.requestId)) {
    throw new Error(`${label}.requestId: invalid support request ID`);
  }
  if (!BUSINESS_DATE.test(meta.businessDate) || meta.businessDate !== singaporeBusinessDate(meta.serverTime)) {
    throw new Error(`${label}.businessDate: must be the Singapore date derived from serverTime`);
  }
  return meta;
}

export function validateReadMeta(envelope, label = "response") {
  const object = assertRecord(envelope, label);
  validateSuccessMeta(object.meta, `${label}.meta`);
  assertUtcIso(object.dataAsOf, `${label}.dataAsOf`);
  if (object.dataAsOf !== object.meta.serverTime) {
    throw new Error(`${label}.dataAsOf: must exactly equal meta.serverTime`);
  }
  return object;
}

export function validatePublicLead(lead, label = "lead") {
  assertExactKeys(lead, {
    allowed: LEAD_ALLOWED_KEYS,
    required: LEAD_REQUIRED_KEYS,
  }, label);
  for (const field of ["id", "name", "phone", "note", "followUp", "status", "createdAt", "createdBy", "updatedAt", "updatedBy"]) {
    if (typeof lead[field] !== "string") throw new Error(`${label}.${field}: must be a string`);
  }
  if (!DOCUMENT_ID.test(lead.id)) throw new Error(`${label}.id: invalid format`);
  if (!lead.name && !lead.phone) throw new Error(`${label}: name or phone is required`);
  if (!lead.note || lead.note.length > 5_000) throw new Error(`${label}.note: invalid value`);
  if (lead.name.length > 120 || lead.phone.length > 40) throw new Error(`${label}: field exceeds schema limit`);
  if (lead.followUp && !BUSINESS_DATE.test(lead.followUp)) throw new Error(`${label}.followUp: invalid format`);
  if (!['active', 'archived'].includes(lead.status)) throw new Error(`${label}.status: invalid value`);
  if (!Number.isInteger(lead.revision) || lead.revision < 1) throw new Error(`${label}.revision: invalid value`);
  assertIsoInstant(lead.createdAt, `${label}.createdAt`);
  assertIsoInstant(lead.updatedAt, `${label}.updatedAt`);
  if (lead.status === "archived") {
    if (typeof lead.archivedAt !== "string" || typeof lead.archivedBy !== "string") {
      throw new Error(`${label}: archived lead lacks archive metadata`);
    }
    assertIsoInstant(lead.archivedAt, `${label}.archivedAt`);
  } else if (Object.hasOwn(lead, "archivedAt") || Object.hasOwn(lead, "archivedBy")) {
    throw new Error(`${label}: active lead must not expose archive metadata`);
  }
  return lead;
}

export function referencedLeadActors(leads) {
  return unique(leads.flatMap((lead) => [lead.createdBy, lead.updatedBy, lead.archivedBy]).filter(Boolean));
}

export function validateActors(actors, referencedActorIds, label = "actors") {
  const object = assertRecord(actors, label);
  const referenced = new Set(referencedActorIds.filter(Boolean));
  for (const [uid, actor] of Object.entries(object)) {
    if (!referenced.has(uid)) throw new Error(`${label}: unreferenced actor was exposed`);
    assertExactKeys(actor, { allowed: ["label"] }, `${label}[referenced actor]`);
    if (typeof actor.label !== "string" || !actor.label.trim() || actor.label.length > 80) {
      throw new Error(`${label}[referenced actor].label: invalid value`);
    }
    if (actor.label.includes("@")) throw new Error(`${label}: actor label must not expose an email address`);
    if (uid === "migration" && actor.label !== "Imported") {
      throw new Error(`${label}: migration actor must use canonical Imported label`);
    }
  }
  return object;
}

export function validateSessionEnvelope(value, label = "GET /v1/session") {
  assertExactKeys(value, {
    allowed: ["identity", "member", "leads", "actors", "meta", "dataAsOf"],
  }, label);
  validateReadMeta(value, label);
  assertExactKeys(value.identity, {
    allowed: ["uid", "email", "emailVerified", "displayName"],
    required: ["uid", "email", "emailVerified"],
  }, `${label}.identity`);
  if (typeof value.identity.uid !== "string" || !value.identity.uid) throw new Error(`${label}.identity.uid: missing`);
  if (typeof value.identity.email !== "string" || typeof value.identity.emailVerified !== "boolean") {
    throw new Error(`${label}.identity: invalid contract`);
  }
  if (Object.hasOwn(value.identity, "displayName") && typeof value.identity.displayName !== "string") {
    throw new Error(`${label}.identity.displayName: invalid contract`);
  }
  assertExactKeys(value.member, {
    allowed: ["role", "displayName"],
    required: ["role"],
  }, `${label}.member`);
  if (!["owner", "member", "viewer"].includes(value.member.role)) throw new Error(`${label}.member.role: invalid`);
  validateLeadList(value.leads, `${label}.leads`);
  validateActors(value.actors, referencedLeadActors(value.leads), `${label}.actors`);
  return value;
}

export function validateLeadListEnvelope(value, label = "GET /v1/leads") {
  assertExactKeys(value, {
    allowed: ["leads", "actors", "meta", "dataAsOf"],
  }, label);
  validateReadMeta(value, label);
  validateLeadList(value.leads, `${label}.leads`);
  validateActors(value.actors, referencedLeadActors(value.leads), `${label}.actors`);
  return value;
}

export function validateFollowUpReceipt(value, label = "POST follow-up") {
  assertExactKeys(value, {
    allowed: ["lead", "followUp", "replayed", "actors", "meta"],
  }, label);
  validateSuccessMeta(value.meta, `${label}.meta`);
  validatePublicLead(value.lead, `${label}.lead`);
  assertExactKeys(value.followUp, {
    allowed: ["id", "leadId", "outcome", "nextFollowUp", "occurredAt", "businessDate", "actorUid", "resultingRevision"],
    required: ["id", "leadId", "outcome", "occurredAt", "businessDate", "actorUid", "resultingRevision"],
  }, `${label}.followUp`);
  const followUp = value.followUp;
  if (!DOCUMENT_ID.test(followUp.id) || followUp.leadId !== value.lead.id) throw new Error(`${label}.followUp: invalid identity`);
  if (!["no_reply", "spoke", "won", "lost"].includes(followUp.outcome)) throw new Error(`${label}.followUp.outcome: invalid`);
  assertIsoInstant(followUp.occurredAt, `${label}.followUp.occurredAt`);
  if (!BUSINESS_DATE.test(followUp.businessDate) || followUp.businessDate !== singaporeBusinessDate(followUp.occurredAt)) {
    throw new Error(`${label}.followUp.businessDate: invalid canonical date`);
  }
  if (!Number.isInteger(followUp.resultingRevision) || followUp.resultingRevision !== value.lead.revision) {
    throw new Error(`${label}.followUp.resultingRevision: must match lead receipt`);
  }
  const active = followUp.outcome === "no_reply" || followUp.outcome === "spoke";
  if (active) {
    if (!BUSINESS_DATE.test(followUp.nextFollowUp) || followUp.nextFollowUp < followUp.businessDate) {
      throw new Error(`${label}.followUp.nextFollowUp: active outcome needs a non-past canonical date`);
    }
    if (value.lead.status !== "active" || value.lead.followUp !== followUp.nextFollowUp) {
      throw new Error(`${label}: active outcome and lead receipt disagree`);
    }
  } else if (Object.hasOwn(followUp, "nextFollowUp") || value.lead.status !== "archived" || value.lead.followUp !== "") {
    throw new Error(`${label}: terminal outcome and lead receipt disagree`);
  }
  if (typeof value.replayed !== "boolean") throw new Error(`${label}.replayed: invalid`);
  validateActors(value.actors, unique([...referencedLeadActors([value.lead]), followUp.actorUid]), `${label}.actors`);
  return value;
}

export function validateDigestAcceptance(value, label = "POST /v1/digests") {
  assertExactKeys(value, {
    allowed: ["accepted", "digestId", "businessDate", "deliveryStatus", "acceptedAt", "acceptedBy", "deliveredAt", "telegramMessageId", "replayed", "actors", "meta"],
    required: ["accepted", "digestId", "businessDate", "deliveryStatus", "acceptedAt", "acceptedBy", "replayed", "actors", "meta"],
  }, label);
  validateSuccessMeta(value.meta, `${label}.meta`);
  if (value.accepted !== true || typeof value.replayed !== "boolean") throw new Error(`${label}: invalid acceptance flags`);
  if (!DOCUMENT_ID.test(value.digestId)) throw new Error(`${label}.digestId: invalid`);
  if (!DIGEST_DELIVERY_STATES.includes(value.deliveryStatus)) throw new Error(`${label}.deliveryStatus: invalid`);
  assertIsoInstant(value.acceptedAt, `${label}.acceptedAt`);
  if (value.businessDate !== singaporeBusinessDate(value.acceptedAt)) {
    throw new Error(`${label}.businessDate: acceptance date must be server canonical`);
  }
  if (typeof value.acceptedBy !== "string" || !value.acceptedBy) throw new Error(`${label}.acceptedBy: invalid`);
  validateDigestDeliveryFields(value, label);
  validateActors(value.actors, [value.acceptedBy], `${label}.actors`);
  return value;
}

export function validateDigestReadEnvelope(value, label = "GET /v1/digests/:id") {
  assertExactKeys(value, {
    allowed: ["digest", "actors", "meta", "dataAsOf"],
  }, label);
  validateReadMeta(value, label);
  const digest = assertExactKeys(value.digest, {
    allowed: ["id", "businessDate", "payload", "acceptedAt", "acceptedBy", "deliveryStatus", "deliveredAt", "telegramMessageId"],
    required: ["id", "businessDate", "payload", "acceptedAt", "acceptedBy", "deliveryStatus"],
  }, `${label}.digest`);
  if (!DOCUMENT_ID.test(digest.id)) throw new Error(`${label}.digest.id: invalid`);
  if (!BUSINESS_DATE.test(digest.businessDate)) throw new Error(`${label}.digest.businessDate: invalid`);
  assertIsoInstant(digest.acceptedAt, `${label}.digest.acceptedAt`);
  if (digest.businessDate !== singaporeBusinessDate(digest.acceptedAt)) throw new Error(`${label}.digest.businessDate: non-canonical`);
  if (typeof digest.acceptedBy !== "string" || !digest.acceptedBy) throw new Error(`${label}.digest.acceptedBy: invalid`);
  if (!DIGEST_DELIVERY_STATES.includes(digest.deliveryStatus)) throw new Error(`${label}.digest.deliveryStatus: invalid`);
  validateDigestPayload(digest.payload, `${label}.digest.payload`);
  validateDigestDeliveryFields(digest, `${label}.digest`);
  validateActors(value.actors, [digest.acceptedBy], `${label}.actors`);
  return value;
}

export function validateDailyStatusEnvelope(value, label = "GET daily status") {
  assertExactKeys(value, {
    allowed: ["status", "actors", "meta", "dataAsOf"],
  }, label);
  validateReadMeta(value, label);
  const status = assertExactKeys(value.status, {
    allowed: ["businessDate", "timeZone", "subject", "recordedToday", "digest"],
  }, `${label}.status`);
  if (status.businessDate !== value.meta.businessDate) throw new Error(`${label}.status.businessDate: must equal canonical meta date`);
  if (status.timeZone !== BUSINESS_TIME_ZONE) throw new Error(`${label}.status.timeZone: invalid`);
  assertExactKeys(status.subject, { allowed: ["uid", "label"] }, `${label}.status.subject`);
  if (typeof status.subject.uid !== "string" || !status.subject.uid) throw new Error(`${label}.status.subject.uid: invalid`);
  if (typeof status.subject.label !== "string" || !status.subject.label || status.subject.label.includes("@")) {
    throw new Error(`${label}.status.subject.label: must be a safe display label`);
  }
  validateRecordedToday(status.recordedToday, `${label}.status.recordedToday`);
  validateDailyDigestStatus(status.digest, `${label}.status.digest`);
  validateActors(value.actors, [status.subject.uid], `${label}.actors`);
  return value;
}

export function validateRecordedToday(value, label = "recordedToday") {
  assertExactKeys(value, {
    allowed: ["total", "byKind", "lastSuccessfulAction"],
    required: ["total", "byKind"],
  }, label);
  assertExactKeys(value.byKind, { allowed: RECORDED_ACTION_KINDS }, `${label}.byKind`);
  let sum = 0;
  for (const kind of RECORDED_ACTION_KINDS) {
    if (!Number.isInteger(value.byKind[kind]) || value.byKind[kind] < 0) throw new Error(`${label}.byKind.${kind}: invalid`);
    sum += value.byKind[kind];
  }
  if (!Number.isInteger(value.total) || value.total !== sum) throw new Error(`${label}.total: must equal committed action sum`);
  if (Object.hasOwn(value, "lastSuccessfulAction")) {
    assertExactKeys(value.lastSuccessfulAction, { allowed: ["kind", "at"] }, `${label}.lastSuccessfulAction`);
    if (!RECORDED_ACTION_KINDS.includes(value.lastSuccessfulAction.kind)) throw new Error(`${label}.lastSuccessfulAction.kind: invalid`);
    assertIsoInstant(value.lastSuccessfulAction.at, `${label}.lastSuccessfulAction.at`);
  } else if (value.total !== 0) {
    throw new Error(`${label}: non-zero total requires lastSuccessfulAction`);
  }
  return value;
}

export function aggregateCommittedActions(events, { actorUid, businessDate }) {
  const byKind = Object.fromEntries(RECORDED_ACTION_KINDS.map((kind) => [kind, 0]));
  const accepted = events
    .filter((event) => event && event.committed === true && event.replayed !== true)
    .filter((event) => event.actorUid === actorUid && event.businessDate === businessDate)
    .filter((event) => RECORDED_ACTION_KINDS.includes(event.kind))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
  for (const event of accepted) byKind[event.kind] += 1;
  return {
    total: accepted.length,
    byKind,
    ...(accepted[0] ? { lastSuccessfulAction: { kind: accepted[0].kind, at: accepted[0].at } } : {}),
  };
}

export function assertDigestTimelineTransition(previous, next, label = "digest timeline") {
  const allowed = {
    pending: new Set(["pending", "retrying", "delivered", "failed"]),
    retrying: new Set(["retrying", "delivered", "failed"]),
    delivered: new Set(["delivered"]),
    failed: new Set(["failed"]),
    legacy_unknown: new Set(["legacy_unknown"]),
  };
  if (!DIGEST_DELIVERY_STATES.includes(previous.deliveryStatus) || !DIGEST_DELIVERY_STATES.includes(next.deliveryStatus)) {
    throw new Error(`${label}: unknown delivery state`);
  }
  if (previous.id !== next.id || previous.acceptedAt !== next.acceptedAt || previous.acceptedBy !== next.acceptedBy || previous.businessDate !== next.businessDate) {
    throw new Error(`${label}: immutable acceptance identity changed`);
  }
  if (!allowed[previous.deliveryStatus].has(next.deliveryStatus)) {
    throw new Error(`${label}: non-monotonic ${previous.deliveryStatus} -> ${next.deliveryStatus}`);
  }
  validateDigestDeliveryFields(next, label);
  return true;
}

function validateLeadList(leads, label) {
  if (!Array.isArray(leads)) throw new Error(`${label}: must be an array`);
  leads.forEach((lead, index) => validatePublicLead(lead, `${label}[${index}]`));
}

function validateDigestPayload(payload, label) {
  assertExactKeys(payload, {
    allowed: ["date", "newLeads", "samplesSent", "followUps", "dumped", "notes"],
  }, label);
  if (typeof payload.date !== "string" || !payload.date.trim() || payload.date.length > 80) throw new Error(`${label}.date: invalid`);
  for (const field of ["newLeads", "samplesSent"]) {
    if (!Number.isInteger(payload[field]) || payload[field] < 0 || payload[field] > 10) throw new Error(`${label}.${field}: invalid`);
  }
  if (!Array.isArray(payload.followUps) || payload.followUps.length > 100) throw new Error(`${label}.followUps: invalid`);
  payload.followUps.forEach((item, index) => {
    assertExactKeys(item, { allowed: ["phone", "round", "sample"] }, `${label}.followUps[${index}]`);
    if (typeof item.phone !== "string" || !item.phone || typeof item.round !== "string" || !item.round || typeof item.sample !== "string" || !item.sample) {
      throw new Error(`${label}.followUps[${index}]: invalid`);
    }
  });
  if (!Array.isArray(payload.dumped) || payload.dumped.length > 100) throw new Error(`${label}.dumped: invalid`);
  payload.dumped.forEach((item, index) => {
    assertExactKeys(item, { allowed: ["reason"] }, `${label}.dumped[${index}]`);
    if (typeof item.reason !== "string" || !item.reason) throw new Error(`${label}.dumped[${index}].reason: invalid`);
  });
  if (typeof payload.notes !== "string" || payload.notes.length > 10_000) throw new Error(`${label}.notes: invalid`);
}

function validateDailyDigestStatus(value, label) {
  assertExactKeys(value, {
    allowed: ["state", "digestId", "acceptedAt", "deliveredAt"],
    required: ["state"],
  }, label);
  if (!["not_submitted", ...DIGEST_DELIVERY_STATES].includes(value.state)) throw new Error(`${label}.state: invalid`);
  if (value.state === "not_submitted") {
    if (Object.keys(value).length !== 1) throw new Error(`${label}: not_submitted must not claim a receipt`);
    return;
  }
  if (!DOCUMENT_ID.test(value.digestId)) throw new Error(`${label}.digestId: invalid`);
  assertIsoInstant(value.acceptedAt, `${label}.acceptedAt`);
  if (value.state === "delivered") {
    assertIsoInstant(value.deliveredAt, `${label}.deliveredAt`);
    if (Date.parse(value.deliveredAt) < Date.parse(value.acceptedAt)) throw new Error(`${label}: delivered before accepted`);
  } else if (Object.hasOwn(value, "deliveredAt")) {
    throw new Error(`${label}: non-delivered state must not claim deliveredAt`);
  }
}

function validateDigestDeliveryFields(digest, label) {
  const hasDeliveredAt = Object.hasOwn(digest, "deliveredAt");
  const hasTelegramId = Object.hasOwn(digest, "telegramMessageId");
  if (digest.deliveryStatus === "delivered") {
    assertIsoInstant(digest.deliveredAt, `${label}.deliveredAt`);
    if (Date.parse(digest.deliveredAt) < Date.parse(digest.acceptedAt)) throw new Error(`${label}: delivered before accepted`);
    if (!Number.isInteger(digest.telegramMessageId) || digest.telegramMessageId < 1) throw new Error(`${label}.telegramMessageId: invalid`);
  } else if (hasDeliveredAt || hasTelegramId) {
    throw new Error(`${label}: non-delivered state must not claim Telegram delivery proof`);
  }
}

function assertUtcIso(value, label) {
  if (typeof value !== "string" || !ISO_UTC.test(value) || new Date(value).toISOString() !== value) {
    throw new Error(`${label}: must be a canonical UTC ISO timestamp`);
  }
}

function assertIsoInstant(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label}: invalid timestamp`);
}

function unique(values) {
  return [...new Set(values)];
}
