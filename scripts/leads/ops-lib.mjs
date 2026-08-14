import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PROJECT_ID = "reputifly-leads-2";
export const API_BASE = `https://asia-southeast1-${PROJECT_ID}.cloudfunctions.net/api`;
export const WATCHLIST_URL = "https://watchlist-v2.web.app/";
export const DIGEST_URL = "https://daily-digest-v2.web.app/";
export const DEFAULT_TIMEOUT_MS = 15_000;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableJson(value, spacing = 0) {
  return JSON.stringify(stableValue(value), null, spacing);
}

export function canonicalHash(records) {
  return sha256(stableJson([...records].sort((a, b) => String(a.id ?? a.name).localeCompare(String(b.id ?? b.name)))));
}

export async function atomicWrite(file, contents, mode = 0o600) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, contents, { mode });
  await rename(temporary, file);
}

export function parseCli(argv, specification) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      result._.push(argument);
      continue;
    }
    const [rawName, inlineValue] = argument.slice(2).split(/=(.*)/s, 2);
    const definition = specification[rawName];
    if (!definition) throw new Error(`Unknown option --${rawName}`);
    if (definition === "boolean") {
      if (inlineValue !== undefined) throw new Error(`--${rawName} does not take a value`);
      result[rawName] = true;
      continue;
    }
    const value = inlineValue ?? argv[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`--${rawName} requires a value`);
    result[rawName] = value;
  }
  return result;
}

export function parseDelimited(text, delimiter) {
  if (delimiter !== "," && delimiter !== "\t") throw new Error("Delimiter must be comma or tab");
  const input = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Unclosed quoted field in delimited input");
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length && rows.at(-1).every((value) => value === "")) rows.pop();
  if (!rows.length) throw new Error("Input has no rows");

  const headers = rows.shift().map((header) => header.trim());
  if (!headers.length || headers.some((header) => !header)) throw new Error("Every input column needs a header");
  const normalized = headers.map(normalizeHeader);
  if (new Set(normalized).size !== normalized.length) throw new Error("Input has duplicate normalized headers");

  return rows.map((values, rowIndex) => {
    if (values.length > headers.length) throw new Error(`Row ${rowIndex + 2} has more fields than the header`);
    const record = {};
    headers.forEach((header, columnIndex) => {
      record[header] = values[columnIndex] ?? "";
    });
    return record;
  });
}

export function decodeUtf8(bytes, label = "input") {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

export function normalizeHeader(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const LEAD_ALIASES = {
  id: ["id", "leadid", "recordid", "uid"],
  name: ["name", "leadname", "contactname"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contact"],
  note: ["note", "notes", "details", "whatyouneedtoremember"],
  followUp: ["followup", "followupdate", "nextfollowup", "chasethemagainon"],
  status: ["status", "state"],
  createdAt: ["createdat", "created", "creationtime", "timestamp"],
  updatedAt: ["updatedat", "updated", "lastupdated", "modifiedat"],
  removedAt: ["removedat", "archivedat", "deletedat"],
  archived: ["archived", "removed", "deleted"],
};

function aliasedValue(record, field) {
  const entries = new Map(Object.entries(record).map(([key, value]) => [normalizeHeader(key), value]));
  for (const alias of LEAD_ALIASES[field]) {
    if (entries.has(alias)) return String(entries.get(alias) ?? "");
  }
  return "";
}

function isTruthy(value) {
  return ["1", "true", "yes", "y", "archived", "removed", "deleted"].includes(value.trim().toLowerCase());
}

function validateIso(value, field, rowNumber) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`Row ${rowNumber}: ${field} must be an ISO-8601 timestamp with a timezone`);
  }
  normalizeLegacyDate(value.slice(0, 10), field, rowNumber);
}

function validateString(value, field, maximum, rowNumber) {
  if (typeof value !== "string") throw new Error(`Row ${rowNumber}: ${field} must be a string`);
  if (value.length > maximum) throw new Error(`Row ${rowNumber}: ${field} exceeds ${maximum} characters`);
  if (/\u0000/.test(value)) throw new Error(`Row ${rowNumber}: ${field} contains a NUL character`);
}

export function normalizeLegacyDate(value, field = "date", rowNumber = 0) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  let year;
  let month;
  let day;
  let match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) {
      const prefix = rowNumber ? `Row ${rowNumber}: ` : "";
      throw new Error(`${prefix}${field} must be empty, YYYY-MM-DD, or M/D/YYYY`);
    }
    month = Number(match[1]);
    day = Number(match[2]);
    year = Number(match[3]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    const prefix = rowNumber ? `Row ${rowNumber}: ` : "";
    throw new Error(`${prefix}${field} is not a real calendar date`);
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeLeadRecord(record, rowIndex) {
  const rowNumber = rowIndex + 2;
  const name = aliasedValue(record, "name");
  const phone = aliasedValue(record, "phone");
  const note = aliasedValue(record, "note");
  const followUp = normalizeLegacyDate(aliasedValue(record, "followUp"), "followUp", rowNumber);
  const removedAt = aliasedValue(record, "removedAt").trim();
  const rawStatus = aliasedValue(record, "status").trim().toLowerCase();
  const archived = ["archived", "removed", "deleted"].includes(rawStatus)
    || Boolean(removedAt)
    || isTruthy(aliasedValue(record, "archived"));
  if (rawStatus && !["active", "archived", "removed", "deleted"].includes(rawStatus)) {
    throw new Error(`Row ${rowNumber}: status is not active or archived`);
  }

  const rawCreatedAt = aliasedValue(record, "createdAt").trim();
  const rawUpdatedAt = aliasedValue(record, "updatedAt").trim();
  const createdAt = rawCreatedAt || rawUpdatedAt || "1970-01-01T00:00:00.000Z";
  const updatedAt = rawUpdatedAt || rawCreatedAt || createdAt;
  const suppliedId = aliasedValue(record, "id").trim();
  const identity = stableJson({ name, phone, note, followUp, createdAt });
  const id = suppliedId || `legacy_${sha256(identity).slice(0, 40)}`;

  validateString(id, "id", 128, rowNumber);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new Error(`Row ${rowNumber}: id must match [A-Za-z0-9_-]{1,128}`);
  }
  validateString(name, "name", 120, rowNumber);
  validateString(phone, "phone", 40, rowNumber);
  validateString(note, "note", 5_000, rowNumber);
  if (name !== name.trim() || phone !== phone.trim() || note !== note.trim()) {
    throw new Error(`Row ${rowNumber}: name, phone, and note must not have leading or trailing whitespace`);
  }
  if (!name.trim() && !phone.trim()) throw new Error(`Row ${rowNumber}: either name or phone is required`);
  if (!note.trim()) throw new Error(`Row ${rowNumber}: note is required`);
  validateIso(createdAt, "createdAt", rowNumber);
  validateIso(updatedAt, "updatedAt", rowNumber);
  if (removedAt) validateIso(removedAt, "removedAt", rowNumber);

  const lead = {
    id,
    name,
    phone,
    note,
    followUp,
    status: archived ? "archived" : "active",
    revision: 1,
    createdAt,
    createdBy: "migration",
    updatedAt,
    updatedBy: "migration",
  };
  if (archived) {
    lead.archivedAt = removedAt || updatedAt;
    lead.archivedBy = "migration";
  }
  return lead;
}

export function normalizeLeadRows(rows) {
  const leads = rows.map(normalizeLeadRecord);
  const seen = new Set();
  for (const lead of leads) {
    if (seen.has(lead.id)) {
      throw new Error(`Two input rows resolve to the same id hash ${sha256(lead.id).slice(0, 12)}; add unique legacy IDs`);
    }
    seen.add(lead.id);
  }
  return leads.sort((a, b) => a.id.localeCompare(b.id));
}

export function toFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot encode a non-finite Firestore number");
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)])) } };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

export function fromFirestoreValue(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue.fields ?? {});
  throw new Error("Unsupported Firestore value in response");
}

export function encodeFirestoreFields(document) {
  return Object.fromEntries(Object.entries(document).map(([key, value]) => [key, toFirestoreValue(value)]));
}

export function decodeFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

export function firestoreBase(project = PROJECT_ID) {
  const databasePath = `projects/${encodeURIComponent(project)}/databases/(default)`;
  const emulator = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  return emulator
    ? `http://${emulator}/v1/${databasePath}`
    : `https://firestore.googleapis.com/v1/${databasePath}`;
}

export function firestoreToken({ required = true } = {}) {
  const token = (process.env.FIRESTORE_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN || "").trim();
  if (required && !token && !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Set FIRESTORE_ACCESS_TOKEN (OAuth access token) in the environment; tokens are never accepted as arguments");
  }
  return token;
}

export async function requestJson(url, { method = "GET", token = "", body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = { Accept: "application/json", ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs} ms`);
    throw new Error(`Network request failed: ${error?.message || "unknown error"}`);
  } finally {
    clearTimeout(timeout);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  let json = null;
  if (bytes.length) {
    try {
      json = JSON.parse(bytes.toString("utf8"));
    } catch {
      // Callers can assert JSON without ever printing a potentially sensitive body.
    }
  }
  return { response, bytes, json };
}

export async function listFirestoreCollection(collection, { project = PROJECT_ID, token = firestoreToken(), pageSize = 300 } = {}) {
  if (!/^[A-Za-z0-9_-]+$/.test(collection)) throw new Error(`Unsafe collection name '${collection}'`);
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(`${firestoreBase(project)}/documents/${collection}`);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const { response, json } = await requestJson(url, { token });
    if (!response.ok || !json) throw new Error(`Firestore list ${collection} failed with HTTP ${response.status}`);
    documents.push(...(json.documents ?? []));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return documents;
}

export async function batchWriteFirestore(writes, { project = PROJECT_ID, token = firestoreToken() } = {}) {
  if (!writes.length) return;
  if (writes.length > 500) throw new Error("Firestore batchWrite cannot exceed 500 writes");
  const { response, json } = await requestJson(`${firestoreBase(project)}/documents:batchWrite`, {
    method: "POST",
    token,
    body: { writes },
    timeoutMs: 60_000,
  });
  if (!response.ok || !json) throw new Error(`Firestore batchWrite failed with HTTP ${response.status}`);
  const failures = (json.status ?? []).filter((status) => Number(status.code ?? 0) !== 0);
  if (failures.length) throw new Error(`Firestore rejected ${failures.length} write(s); no response bodies were logged`);
}

export function documentIdFromName(name) {
  return decodeURIComponent(String(name).split("/").at(-1));
}

export function canonicalLeadFromFirestore(document) {
  const fields = decodeFirestoreFields(document.fields ?? {});
  const lead = {
    id: fields.id,
    name: fields.name,
    phone: fields.phone,
    note: fields.note,
    followUp: fields.followUp,
    status: fields.status,
    revision: fields.revision,
    createdAt: fields.createdAt,
    createdBy: fields.createdBy,
    updatedAt: fields.updatedAt,
    updatedBy: fields.updatedBy,
  };
  if (fields.status === "archived") {
    lead.archivedAt = fields.archivedAt;
    lead.archivedBy = fields.archivedBy;
  }
  return lead;
}

export function publicError(error) {
  // None of our own messages contain credentials or response bodies. This final
  // guard also redacts JWT-shaped strings if a dependency ever includes one.
  return String(error?.message || error || "Unknown error")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_TOKEN]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}
