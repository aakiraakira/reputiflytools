# Reputifly Leads Firebase backend

Production backend for Watchlist and Daily Digest. It targets Firebase project
`reputifly-leads-2` in `asia-southeast1` and deliberately keeps authentication
in the existing `reputifly-automation` Identity Platform project.

The browser sends its legacy Firebase ID token in `Authorization: Bearer ...`.
The API verifies that opaque token with Identity Toolkit `accounts:lookup`, then
requires `members/{legacyUid}.active == true` in the new Firestore database.
No user is imported and no browser receives Firestore credentials.

## What is deployed

- `api`: public HTTPS Function, Node.js 22, one warm instance, explicit CORS.
- `outboxWorker`: every minute; claims one queued notification at a time and
  sends at most four per bounded run.
- `morningReminder`: 09:00 every day in `Asia/Singapore`; creates one neutral
  Watchlist reminder only when at least one lead is due or overdue. Empty days
  record a skipped heartbeat and send nothing.
- `operationalHealth`: every five minutes; persists a synthetic health result
  and emits an ERROR log if delivery is stale for 15 minutes or any item is dead.
- Firestore rules: deny every client read and write. Functions use Admin SDK.
- Firestore indexes for active leads, due leads, ready outbox work, and expired
  worker leases.

Collections are `members`, `leads`, `leadFollowUps`, `digests`,
`notificationOutbox`, `auditEvents`, and `system`.

## Local verification

Use Node 22 for parity with production.

```sh
cd functions
npm ci
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

The tests exercise legacy auth and membership, strict validation, CORS, lead
create idempotency, revision conflicts, all four transactional follow-up
outcomes and concurrency, Singapore midnight/month/year rollover, self/team
permissions, privacy-safe actor labels, digest public allowlists and replayed
timestamps, one digest per actor/business date, strict persisted-document
decoding, deterministic reminder skips, sequential bounded claims, expired
leases, Telegram failures, backoff, dead-lettering, corrupt-row quarantine, and
successful `message_id` persistence. External HTTP is mocked.

## Deployment configuration

Do not put the legacy server API key or either Telegram value in source,
`.env`, shell history, logs, or the Firestore database.

1. Select the project already declared in `.firebaserc` and confirm billing is
   enabled.
2. Create the `(default)` Firestore database in `asia-southeast1`.
3. Confirm these dedicated runtime identities exist and have only the listed
   project roles:

   ```text
   reputifly-leads-api@reputifly-leads-2.iam.gserviceaccount.com
     roles/datastore.user
     roles/logging.logWriter

   reputifly-leads-worker@reputifly-leads-2.iam.gserviceaccount.com
     roles/datastore.user
     roles/logging.logWriter
   ```

   The source binds the API to the first identity and all three schedulers to
   the second. Do not grant either identity project Editor/Owner.
4. Create all three Secret Manager values through non-echoing prompts:

   ```sh
   firebase functions:secrets:set LEGACY_FIREBASE_API_KEY
   firebase functions:secrets:set TELEGRAM_BOT_TOKEN
   firebase functions:secrets:set TELEGRAM_CHAT_ID
   ```

   `LEGACY_FIREBASE_API_KEY` is the server key for Identity Toolkit
   `accounts:lookup` in `reputifly-automation`; restrict that key to the Identity
   Toolkit API. Grant secret-version access for this one secret only to the API
   service account. Grant access to the two Telegram secrets only to the worker
   service account. The API does not receive Telegram secrets, and schedulers
   other than `outboxWorker` do not bind them.

5. Before exposing the API, create one member document per allowed legacy UID:

   ```text
   members/{legacyFirebaseUid}
     active: true
     role: "owner" | "member" | "viewer"
     displayName: optional string
     email: optional administrative reference
     dailyDigestExpected: optional boolean; true for exactly one active member
   ```

6. Deploy rules/indexes first, then Functions:

   ```sh
   firebase deploy --only firestore:rules,firestore:indexes
   firebase deploy --only functions
   ```

The API base URL is the deployed `api` Function URL. Do not guess or hardcode a
URL until Firebase prints the actual deployment result.

`api.minInstances` is intentionally `1` in `asia-southeast1` to remove the cold
start that broke the legacy login path. A warm instance incurs ongoing Cloud
Run/Firebase cost even at zero traffic; monitor billing and keep it unless a
measured latency test proves the user-facing timeout can tolerate scale-to-zero.

## HTTP contract

All `/v1/*` calls require `Authorization: Bearer <legacy Firebase ID token>`.
Writes require `Content-Type: application/json`. Responses, including errors,
set `Cache-Control: no-store` and `X-Request-Id`. Every authenticated success
contains `meta:{serverTime,requestId,businessDate}`. Read responses also contain
top-level `dataAsOf`, equal to the server timestamp after the authoritative
read. `businessDate` is always computed by the server in `Asia/Singapore`.

Allowed browser origins:

- `https://reputifly.org`
- `https://www.reputifly.org`
- `https://reputifly-leads-2.web.app`
- `https://reputifly-leads-2.firebaseapp.com`
- `https://daily-digest-2.web.app`
- `https://daily-digest-2.firebaseapp.com`
- HTTP/HTTPS localhost, `127.0.0.1`, and `[::1]`, with any development port

### Session and leads

`GET /v1/session` returns:

```json
{
  "identity": { "uid": "...", "email": "...", "emailVerified": true },
  "member": { "role": "owner", "displayName": "..." },
  "leads": [],
  "actors": {},
  "dataAsOf": "2026-08-14T01:00:00.000Z",
  "meta": {
    "serverTime": "2026-08-14T01:00:00.000Z",
    "requestId": "...",
    "businessDate": "2026-08-14"
  }
}
```

`GET /v1/leads` returns active leads, a referenced-only actor label map,
`dataAsOf`, and `meta`. Public leads are explicitly allowlisted. Actor labels
never contain emails or member metadata: migration maps to `Imported`, inactive
members map to `Former/unknown member`, and missing/unsafe labels are omitted so
the UI can say `Team member` without displaying a raw UID.

`POST /v1/leads` accepts a flat lead. Frontends should send a stable
`Idempotency-Key` header until the response is received; omitted keys remain
supported for simple clients but cannot make a lost response replay-safe.

```json
{
  "name": "Alex",
  "phone": "9123 4567",
  "note": "Asked for pricing",
  "followUp": "2026-08-14"
}
```

It returns `201 { "lead": {...}, "replayed": false }`, or `200` with
`replayed: true` when the same key and body are retried. Reusing a key with a
different body returns `409`.

`PUT /v1/leads/:id` performs a revision-checked update or upsert:

```json
{
  "name": "Alex",
  "phone": "9123 4567",
  "note": "Updated note",
  "followUp": "2026-08-15",
  "expectedRevision": 2
}
```

Use `expectedRevision: 0` only when creating a missing ID. A stale revision
returns `409` with both expected and actual revisions.

`POST /v1/leads/:id/archive` accepts `{ "expectedRevision": 3 }`. Archive is a
soft delete and increments the revision.

All lead mutations return a canonical public lead, referenced `actors`, and
`meta`. Internal payload hashes and idempotency keys are never public.

### Follow-up outcomes

`POST /v1/leads/:id/follow-ups` requires a stable `Idempotency-Key` header and:

```json
{
  "expectedRevision": 3,
  "outcome": "no_reply",
  "nextFollowUp": "2026-08-15"
}
```

Outcomes `no_reply` and `spoke` keep the lead active and require
`nextFollowUp >=` the server's Singapore business date. `won` and `lost` are
terminal, forbid `nextFollowUp`, and archive the lead. One Firestore transaction
checks the revision, changes the lead, and creates one immutable
`leadFollowUps/{deterministicId}` plus one committed audit event. New requests
return 201; exact lost-response replays return the original lead/event receipt
with 200 and `replayed:true`, including after a terminal archive. A changed
payload under the same key or a stale revision returns 409 without mutation.

### Recorded today

`GET /v1/daily-status` returns only the signed-in member's committed activity.
`GET /v1/team/daily-status` is owner-only and returns the one active member with
`dailyDigestExpected:true`; zero or multiple configured members return 409.

```json
{
  "status": {
    "businessDate": "2026-08-14",
    "timeZone": "Asia/Singapore",
    "subject": { "uid": "...", "label": "Farhan" },
    "recordedToday": {
      "total": 2,
      "byKind": {
        "leadCreated": 0,
        "leadUpdated": 0,
        "leadArchived": 0,
        "followUpLogged": 1,
        "digestAccepted": 1
      },
      "lastSuccessfulAction": { "kind": "digestAccepted", "at": "..." }
    },
    "digest": { "state": "pending", "digestId": "...", "acceptedAt": "..." }
  },
  "actors": { "...": { "label": "Farhan" } },
  "dataAsOf": "...",
  "meta": { "serverTime": "...", "requestId": "...", "businessDate": "2026-08-14" }
}
```

Only committed audit/digest records count. Drafts, clicks, sign-ins, failed
requests, replayed requests, presence, and time-on-page are not recorded.

### Daily Digest

`POST /v1/digests` accepts:

```json
{
  "idempotencyKey": "digest:2026-08-14:legacyUid",
  "payload": {
    "date": "Thu, 13 Aug",
    "newLeads": 3,
    "samplesSent": 2,
    "followUps": [{ "phone": "9123 4567", "round": "1st", "sample": "Sent" }],
    "dumped": [{ "reason": "No budget" }],
    "notes": "One pricing question"
  }
}
```

It atomically creates the digest and deterministic outbox record, then returns
the server `businessDate`, original `acceptedAt`/`acceptedBy`, referenced
`actors`, and `meta` with 202. An exact retry returns the original acceptance
receipt with 200 and never enqueues another Telegram message. If delivery has
already completed, replay also includes `deliveredAt` and `telegramMessageId`.
The server owns one immutable digest slot per actor UID and Singapore business
date, so tabs/devices with different retry keys cannot double-send. A second key
with the same payload returns the original receipt; a different payload returns
409 with only `existingDigestId` and `businessDate` so the client can recover
the accepted receipt. A new business date creates a new slot.

`GET /v1/digests/:id` returns only the explicit public allowlist:
`id,businessDate,payload,acceptedAt,acceptedBy,deliveryStatus,deliveredAt?,telegramMessageId?`,
plus `actors,dataAsOf,meta`. It never exposes hashes, idempotency keys, raw
provider errors, migration metadata, outbox fields, or unknown Firestore data.
The browser must display delivered only when status is `delivered` and both
proof fields exist; an unproven stored delivered state is returned as
`legacy_unknown`.

Possible delivery states are `pending`, `retrying`, `delivered`, `failed`, and
`legacy_unknown`. The last value is only for migrated historical digests whose
Telegram result cannot be proven; those records have no outbox document, so old
history is never accidentally sent during migration.

Persisted Firestore documents are decoded through explicit runtime schemas
before entering the API or worker domain. Unknown fields are stripped. Invalid
enums, arrays, timestamps, revisions, or required fields fail closed with a
generic `internal_error`; malformed outbox candidates are marked `dead` with a
sanitized quarantine reason so valid work behind them can continue.

### Validation limits

- Lead: name 120, phone 40, note 1–5,000, and `followUp` empty or `YYYY-MM-DD`.
  At least name or phone is required.
- IDs: `[A-Za-z0-9_-]{1,128}`.
- Idempotency keys: `[A-Za-z0-9._:-]{8,200}`.
- Digest: date 1–80; counts are integers 0–10; at most 100 follow-ups and 100
  dumped leads; notes at most 10,000.
- JSON bodies are limited to 64 KiB and reject unknown fields.

Errors use one stable envelope:

```json
{
  "error": {
    "code": "conflict",
    "message": "Lead revision conflict.",
    "requestId": "...",
    "details": { "expectedRevision": 1, "actualRevision": 2 }
  }
}
```

See [RUNBOOK.md](RUNBOOK.md) for monitoring, recovery, secret rotation, and the
small unavoidable Telegram at-least-once delivery window.
