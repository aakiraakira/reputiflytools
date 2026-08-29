import { sha256, stableJson } from "./ops-lib.mjs";

const MONTHS = new Map([
  ["jan", 1], ["feb", 2], ["mar", 3], ["apr", 4], ["may", 5], ["jun", 6],
  ["jul", 7], ["aug", 8], ["sep", 9], ["oct", 10], ["nov", 11], ["dec", 12],
]);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

function normalizedEntries(record) {
  return new Map(Object.entries(record).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), String(value ?? "")]));
}

function field(record, aliases) {
  const entries = normalizedEntries(record);
  for (const alias of aliases) if (entries.has(alias)) return entries.get(alias);
  return "";
}

function integerCount(value, label, rowNumber) {
  if (!/^\d+$/.test(value.trim())) throw new Error(`Row ${rowNumber}: ${label} must be an integer`);
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0 || count > 10) throw new Error(`Row ${rowNumber}: ${label} must be 0..10`);
  return count;
}

function cleanText(value) {
  return value.replace(BIDI_CONTROLS, "").replace(/\u00a0/g, " ").trim();
}

export function parseLegacyBulletLines(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => cleanText(line).replace(/^[•*-]\s*/, "").trim())
    .filter(Boolean);
}

export function parseLegacyFollowUps(value, rowNumber) {
  return parseLegacyBulletLines(value).map((line, index) => {
    const match = line.match(/^(.*?)\s+[—–-]\s+(1st|2nd|3rd)\s*,\s*sample\s+(.+)$/i);
    if (!match) throw new Error(`Row ${rowNumber}: follow-up bullet ${index + 1} has an unsupported format`);
    const phone = cleanText(match[1]);
    const round = match[2].toLowerCase().replace(/^1st$/, "1st").replace(/^2nd$/, "2nd").replace(/^3rd$/, "3rd");
    const sampleRaw = cleanText(match[3]).toLowerCase();
    const sample = sampleRaw === "deployed" ? "Deployed" : sampleRaw === "not yet" ? "Not yet" : cleanText(match[3]);
    if (!phone || phone.length > 40) throw new Error(`Row ${rowNumber}: follow-up bullet ${index + 1} has an invalid phone`);
    if (round.length > 40 || !sample || sample.length > 80) throw new Error(`Row ${rowNumber}: follow-up bullet ${index + 1} exceeds schema limits`);
    return { phone, round, sample };
  });
}

export function parseLegacyDumped(value, rowNumber) {
  return parseLegacyBulletLines(value).map((reason, index) => {
    if (reason.length > 500) throw new Error(`Row ${rowNumber}: dumped bullet ${index + 1} exceeds 500 characters`);
    return { reason };
  });
}

export function parseLegacyDigestDate(dateLabel, timeLabel, explicitYear, rowNumber) {
  if (!Number.isInteger(explicitYear) || explicitYear < 2000 || explicitYear > 2100) {
    throw new Error("--year must be an integer from 2000 to 2100");
  }
  const dateMatch = cleanText(dateLabel).match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2})\s+([A-Za-z]{3})$/i);
  if (!dateMatch) throw new Error(`Row ${rowNumber}: Date must look like 'Mon 28 Jul'`);
  const claimedWeekday = `${dateMatch[1][0].toUpperCase()}${dateMatch[1].slice(1).toLowerCase()}`;
  const day = Number(dateMatch[2]);
  const month = MONTHS.get(dateMatch[3].toLowerCase());
  if (!month) throw new Error(`Row ${rowNumber}: Date has an unknown month`);
  const timeMatch = cleanText(timeLabel).match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) throw new Error(`Row ${rowNumber}: Sent At must be H:MM or HH:MM`);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) throw new Error(`Row ${rowNumber}: Sent At is not a real Singapore time`);
  const localCalendar = new Date(Date.UTC(explicitYear, month - 1, day));
  if (localCalendar.getUTCFullYear() !== explicitYear || localCalendar.getUTCMonth() !== month - 1 || localCalendar.getUTCDate() !== day) {
    throw new Error(`Row ${rowNumber}: Date is not a real calendar date`);
  }
  const actualWeekday = WEEKDAYS[localCalendar.getUTCDay()];
  if (actualWeekday !== claimedWeekday) {
    throw new Error(`Row ${rowNumber}: claimed weekday ${claimedWeekday} does not match ${explicitYear} calendar (${actualWeekday}); verify --year`);
  }
  // Singapore has been UTC+08 with no daylight-saving changes throughout the
  // migration period, so subtracting eight hours is deterministic.
  const instant = new Date(Date.UTC(explicitYear, month - 1, day, hour - 8, minute));
  return {
    createdAt: instant.toISOString(),
    localDate: `${explicitYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    weekdayClaim: claimedWeekday,
    weekdayActual: actualWeekday,
  };
}

export function normalizeDigestRecord(record, rowIndex, explicitYear) {
  const rowNumber = rowIndex + 2;
  const date = cleanText(field(record, ["date"]));
  const newLeads = integerCount(field(record, ["newleads"]), "New Leads", rowNumber);
  const samplesSent = integerCount(field(record, ["samples", "samplessent"]), "Samples", rowNumber);
  const followUps = parseLegacyFollowUps(field(record, ["followups"]), rowNumber);
  const dumped = parseLegacyDumped(field(record, ["dumped"]), rowNumber);
  const notes = cleanText(field(record, ["questionsnotes", "notes"]));
  if (notes.length > 10_000) throw new Error(`Row ${rowNumber}: notes exceed 10000 characters`);
  if (followUps.length > 100 || dumped.length > 100) throw new Error(`Row ${rowNumber}: digest list exceeds 100 items`);
  const sentAt = field(record, ["sentat"]);
  const legacyFiledBy = cleanText(field(record, ["filedby", "submittedby"]));
  if (!legacyFiledBy) throw new Error(`Row ${rowNumber}: Filed By is required to preserve provenance`);
  const calendar = parseLegacyDigestDate(date, sentAt, explicitYear, rowNumber);
  const payload = { date, newLeads, samplesSent, followUps, dumped, notes };
  // The source contains two intentionally distinct rows whose visible payload
  // and submit time are identical. Include the stable source row ordinal so
  // neither historical record collapses into the other.
  const legacySourceRow = rowNumber;
  const sourceFingerprint = stableJson({ ...payload, createdAt: calendar.createdAt, legacyFiledBy, legacySourceRow });
  const idempotencyKey = `legacy-digest:${calendar.localDate}:${sha256(sourceFingerprint).slice(0, 24)}`;
  const id = `digest_${sha256(`migration:${idempotencyKey}`)}`;
  return {
    id,
    idempotencyKey,
    payloadHash: sha256(JSON.stringify(payload)),
    payload,
    createdAt: calendar.createdAt,
    createdBy: "migration",
    businessDate: calendar.localDate,
    deliveryStatus: "legacy_unknown",
    legacyFiledBy,
    migrationSource: "legacy-digest-tsv",
    legacySourceRow,
    migrationCalendar: {
      timeZone: "Asia/Singapore",
      localDate: calendar.localDate,
      claimedWeekday: calendar.weekdayClaim,
      verifiedWeekday: calendar.weekdayActual,
    },
  };
}

export function normalizeDigestRows(rows, explicitYear) {
  const digests = rows.map((record, index) => normalizeDigestRecord(record, index, explicitYear));
  const ids = new Set();
  for (const digest of digests) {
    if (ids.has(digest.id)) throw new Error(`Duplicate digest source row resolves to ID hash ${sha256(digest.id).slice(0, 12)}`);
    ids.add(digest.id);
  }
  return digests.sort((a, b) => a.id.localeCompare(b.id));
}
