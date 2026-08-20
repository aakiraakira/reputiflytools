import assert from "node:assert/strict";
import test from "node:test";
import {
  API_BASE,
  DIGEST_URL,
  WATCHLIST_URL,
  canonicalHash,
  decodeUtf8,
  decodeFirestoreFields,
  encodeFirestoreFields,
  normalizeLeadRows,
  normalizeLegacyDate,
  parseDelimited,
  sha256,
  stableJson,
} from "../ops-lib.mjs";
import {
  REQUIRED_HOSTING_HEADERS,
  renderHostingHtml,
  validateFirebaseHostingConfig,
  validateHostingHeaders,
} from "../hosting-lib.mjs";
import {
  normalizeDigestRows,
  parseLegacyDigestDate,
  parseLegacyDumped,
  parseLegacyFollowUps,
} from "../digest-lib.mjs";

test("CSV parser preserves quoted commas, quotes, and newlines", () => {
  const csv = 'ID,Name,Phone,Note,Follow Up,Created At\r\nlead_1,"Tan, Lee",91234567,"Said ""yes""\nCall back",2026-08-14,2026-08-13T01:02:03.000Z\r\n';
  const rows = parseDelimited(csv, ",");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Name, "Tan, Lee");
  assert.equal(rows[0].Note, 'Said "yes"\nCall back');
});

test("TSV parser strips BOM and maps missing trailing values to empty strings", () => {
  const rows = parseDelimited("\uFEFFid\tname\tphone\tnote\nlead_1\tAlex\t\tRemember this\n", "\t");
  assert.deepEqual(rows, [{ id: "lead_1", name: "Alex", phone: "", note: "Remember this" }]);
});

test("migration input rejects malformed UTF-8 instead of changing bytes", () => {
  assert.equal(decodeUtf8(Buffer.from("valid")), "valid");
  assert.throws(() => decodeUtf8(Buffer.from([0xc3, 0x28])), /not valid UTF-8/);
});

test("legacy normalization preserves business fields and creates backend schema", () => {
  const [lead] = normalizeLeadRows([{
    ID: "legacyA_1",
    Name: "Alex",
    Phone: "9123 4567",
    Note: "Asked for a revised sample",
    "Follow Up": "2026-08-15",
    "Created At": "2026-08-12T10:00:00.000Z",
    "Updated At": "2026-08-13T11:00:00.000Z",
  }]);
  assert.deepEqual(lead, {
    id: "legacyA_1",
    name: "Alex",
    phone: "9123 4567",
    note: "Asked for a revised sample",
    followUp: "2026-08-15",
    status: "active",
    revision: 1,
    createdAt: "2026-08-12T10:00:00.000Z",
    createdBy: "migration",
    updatedAt: "2026-08-13T11:00:00.000Z",
    updatedBy: "migration",
  });
});

test("missing legacy IDs become deterministic non-PII IDs", () => {
  const row = {
    name: "Alex",
    phone: "91234567",
    note: "Call again",
    followUp: "",
    createdAt: "2026-08-13T01:00:00.000Z",
  };
  const first = normalizeLeadRows([row])[0];
  const second = normalizeLeadRows([row])[0];
  assert.equal(first.id, second.id);
  assert.match(first.id, /^legacy_[a-f0-9]{40}$/);
  assert.equal(first.id.includes("Alex"), false);
});

test("archived legacy rows map removal metadata", () => {
  const [lead] = normalizeLeadRows([{
    id: "lead_archived",
    name: "Alex",
    phone: "",
    note: "Finished",
    createdAt: "2026-08-10T01:00:00Z",
    updatedAt: "2026-08-11T01:00:00Z",
    removedAt: "2026-08-12T01:00:00Z",
  }]);
  assert.equal(lead.status, "archived");
  assert.equal(lead.archivedAt, "2026-08-12T01:00:00Z");
  assert.equal(lead.archivedBy, "migration");
});

test("legacy removed/deleted status alone is archived deterministically", () => {
  for (const status of ["removed", "deleted"]) {
    const [lead] = normalizeLeadRows([{
      id: `lead_${status}`,
      name: "Alex",
      phone: "",
      note: "Finished",
      status,
      createdAt: "2026-08-10T01:00:00Z",
      updatedAt: "2026-08-11T01:00:00Z",
    }]);
    assert.equal(lead.status, "archived");
    assert.equal(lead.archivedAt, "2026-08-11T01:00:00Z");
    assert.equal(lead.archivedBy, "migration");
  }
});

test("legacy Singapore calendar dates normalize M/D/YYYY deterministically", () => {
  assert.equal(normalizeLegacyDate("8/1/2026"), "2026-08-01");
  assert.equal(normalizeLegacyDate("12/31/2026"), "2026-12-31");
  assert.equal(normalizeLegacyDate("2026-08-01"), "2026-08-01");
  assert.throws(() => normalizeLegacyDate("2/29/2026"), /not a real calendar date/);

  const [lead] = normalizeLeadRows([{
    id: "archived_mdy",
    name: "Alex",
    phone: "",
    note: "Legacy archive date",
    "Follow-Up": "8/1/2026",
    Created: "2026-07-30T01:00:00Z",
    Updated: "2026-07-31T01:00:00Z",
    "Removed At": "2026-08-02T01:00:00Z",
  }]);
  assert.equal(lead.followUp, "2026-08-01");
});

test("schema rejects invalid document IDs and whitespace drift", () => {
  const base = { name: "Alex", phone: "", note: "Call", createdAt: "2026-08-13T01:00:00Z" };
  assert.throws(() => normalizeLeadRows([{ ...base, id: "bad/id" }]), /id must match/);
  assert.throws(() => normalizeLeadRows([{ ...base, id: "good_id", note: " Call" }]), /leading or trailing/);
});

test("Firestore encoder and decoder round-trip nested supported values", () => {
  const value = { text: "x", count: 3, ratio: 1.5, active: true, nullable: null, list: ["a", 2], map: { ok: false } };
  assert.deepEqual(decodeFirestoreFields(encodeFirestoreFields(value)), value);
});

test("canonical hash is stable across record and key ordering", () => {
  const left = [{ id: "b", z: 1, a: 2 }, { id: "a", value: true }];
  const right = [{ value: true, id: "a" }, { a: 2, id: "b", z: 1 }];
  assert.equal(canonicalHash(left), canonicalHash(right));
  assert.equal(sha256(stableJson(left)), sha256(stableJson(left)));
});

test("hosting transform changes only legacy cross-links", () => {
  const source = `<a href="https://reputifly.org/watchlist/">W</a><a href="https://reputifly.org/daily-digest/">D</a><script>const API="${API_BASE}"</script>`;
  const result = renderHostingHtml(source);
  assert.equal(result, `<a href="${WATCHLIST_URL}">W</a><a href="${DIGEST_URL}">D</a><script>const API="${API_BASE}"</script>`);
});

test("all primary and compatibility Hosting targets require exact security headers", () => {
  const headers = Object.entries(REQUIRED_HOSTING_HEADERS).map(([key, value]) => ({ key, value }));
  const config = {
    hosting: [
      { target: "watchlist", public: "hosting/watchlist", headers: [{ source: "**", headers }] },
      { target: "watchlist-legacy", public: "hosting/watchlist", headers: [{ source: "**", headers }] },
      { target: "digest", public: "hosting/daily-digest", headers: [{ source: "**", headers }] },
      { target: "digest-legacy", public: "hosting/daily-digest", headers: [{ source: "**", headers }] },
    ],
  };
  assert.equal(validateFirebaseHostingConfig(config), true);
  assert.equal(validateHostingHeaders((name) => REQUIRED_HOSTING_HEADERS[name], "fixture"), undefined);

  const frameable = structuredClone(config);
  frameable.hosting[0].headers[0].headers = frameable.hosting[0].headers[0].headers.filter(
    ({ key }) => key !== "x-frame-options",
  );
  assert.throws(() => validateFirebaseHostingConfig(frameable), /x-frame-options.*missing/);
  assert.throws(
    () => validateHostingHeaders((name) => name === "content-security-policy" ? "default-src 'self'" : REQUIRED_HOSTING_HEADERS[name]),
    /content-security-policy/,
  );
});

test("legacy digest bullets map to strict API payload items", () => {
  assert.deepEqual(
    parseLegacyFollowUps("• 9123 4567 — 2nd, sample deployed\n• +65 8877 6655 — 3rd, sample not yet", 2),
    [
      { phone: "9123 4567", round: "2nd", sample: "Deployed" },
      { phone: "+65 8877 6655", round: "3rd", sample: "Not yet" },
    ],
  );
  assert.deepEqual(parseLegacyDumped("• Not interested\n• Other — timing", 2), [
    { reason: "Not interested" },
    { reason: "Other — timing" },
  ]);
});

test("legacy digest year is explicit and claimed weekday is proven", () => {
  const parsed = parseLegacyDigestDate("Mon 20 Jul", "9:05", 2026, 2);
  assert.equal(parsed.localDate, "2026-07-20");
  assert.equal(parsed.createdAt, "2026-07-20T01:05:00.000Z");
  assert.equal(parsed.weekdayClaim, parsed.weekdayActual);
  assert.throws(() => parseLegacyDigestDate("Mon 20 Jul", "9:05", 2027, 2), /does not match 2027 calendar/);
});

test("legacy digests receive deterministic IDs and never imply delivery", () => {
  const rows = [{
    Date: "Mon 20 Jul",
    "New Leads": "3",
    Samples: "2",
    "Follow-Ups": "• 9123 4567 — 2nd, sample deployed",
    Dumped: "• Not interested",
    "Questions / Notes": "Review pricing",
    "Sent At": "9:05",
    "Filed By": "Legacy User",
  }];
  const first = normalizeDigestRows(rows, 2026)[0];
  const second = normalizeDigestRows(rows, 2026)[0];
  assert.equal(first.id, second.id);
  assert.match(first.id, /^digest_[a-f0-9]{64}$/);
  assert.equal(first.deliveryStatus, "legacy_unknown");
  assert.equal(first.createdBy, "migration");
  assert.equal(first.businessDate, "2026-07-20");
  assert.equal(first.legacyFiledBy, "Legacy User");
  assert.equal(first.payloadHash, sha256(JSON.stringify(first.payload)));
});
