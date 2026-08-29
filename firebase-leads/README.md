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
  sends at most four per bounded run. It delivers de-duplicated Daily Digest,
  due-lead reminder, and member-created lead notifications.
- `morningReminder`: 09:00 every day in `Asia/Singapore`; creates one neutral
  Watchlist reminder only when at least one lead is due or overdue. Empty days
  record a skipped heartbeat and send nothing.
- `operationalHealth`: every five minutes; persists a synthetic health result
  and emits an ERROR log if delivery is stale for 15 minutes or any item is dead.
- Firestore rules: deny every client read and write. Functions use Admin SDK.
- Firestore indexes for active leads, due leads, ready outbox work, and expired
  worker leases.

Collections are `members`, `leads`, `activePhoneClaims`, `leadFollowUps`,
`digests`, `notificationOutbox`, `auditEvents`, and `system`.

`activePhoneClaims/v1_<sha256(canonicalDigits)>` contains only `{leadId}` and is
the atomic uniqueness index for usable phone numbers on active leads. The phone
itself is not stored in the claim document ID or fields. Eight-digit local
numbers canonicalize with Singapore country code `65`; explicit `+` and `00`
international prefixes canonicalize to the same digits.

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
create idempotency, revision conflicts, canonical-phone uniqueness and claim
migration, all four transactional follow-up outcomes and concurrency,
Singapore midnight/month/year rollover, self/team
permissions, privacy-safe actor labels, digest public allowlists and replayed
timestamps, one digest per actor/business date, strict persisted-document
decoding, deterministic reminder skips, sequential bounded claims, expired
leases, Telegram failures, backoff, dead-lettering, corrupt-row quarantine, and
successful `message_id` persistence. Message-boundary tests prove that digests
are never silently truncated and member lead alerts are concise and
deterministic. External HTTP is mocked.

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

   The source binds the API runtime to the first identity and all three
   scheduled runtimes to the second. Do not grant either identity project
   Editor/Owner.

   Firebase-created Cloud Scheduler jobs use the project's default Compute
   service account only as their OIDC caller. It must have **no project-level
   Editor/Owner role**. Grant it `roles/run.invoker` on exactly
   `outboxworker`, `operationalhealth`, and `morningreminder`, then force-run
   all three jobs and verify fresh `system/*` heartbeats. A Functions deploy
   can recreate scheduler plumbing, so repeat this IAM check after every
   scheduled-Function deployment.
   It must not have Secret Manager access; OIDC invocation does not require
   reading any runtime secret.
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

6. Deploy rules/indexes first. When a release adds an outbox type, deploy and
   verify the new worker before the API that can enqueue that type:

   ```sh
   firebase deploy --only firestore:rules,firestore:indexes
   firebase deploy --only functions:outboxWorker
   # Verify the new worker revision and a fresh system/outboxWorker heartbeat.
   firebase deploy --only functions:api
   ```

   This order matters: an older strict worker would quarantine a newer outbox
   document it does not understand. For rollback, stop the newer API from
   enqueueing first, drain or repair every newer pending/retry/processing/dead
   row, and only then roll the worker back. Deploy the other schedulers only
   when their source or configuration changed.

   The scheduled provider ignores a source-level `invoker` option and replaces
   service-level IAM on deploy. Run
   `scripts/leads/configure-scheduler-invoker.mjs` immediately after every
   scheduled deploy; it restores and verifies `run.invoker` on only the three
   scheduled services and confirms the Scheduler identity has no Telegram
   secret access. Always prove a normal HTTP 200 Scheduler completion afterward.

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
- `https://watchlist-v2.web.app`
- `https://watchlist-v2.firebaseapp.com`
- `https://daily-digest-v2.web.app`
- `https://daily-digest-v2.firebaseapp.com`
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

### Watchlist admission contract

The shipped Watchlist rules admit a row when at least one of these six events
has happened:

- They name someone else who decides. Team, management, boss, partner, spouse.
- They give a date. For payment or for anything.
- They say they like it, then delay.
- They go quiet after seeing the price.
- Any complaint, or any mention of stopping or refunding.
- They ask for something we do not sell.

This is a human review of the existing note and source conversation, not a new
API classification. Do not add a trigger enum, pipeline stage, priority, or
monetary-value field. The narrow lead contract remains the existing
name/phone/note/follow-up data plus persistence and audit metadata.

`POST /v1/leads` accepts a flat lead and requires a stable `Idempotency-Key`
header. A create without the header is rejected before mutation so a lost
response can never produce a second lead or Telegram alert.

Every create and revision-checked update requires a usable WhatsApp number and
a real next-chase date (`followUp`, `YYYY-MM-DD`). Legacy stored rows with empty values
remain readable, but they must be updated with both values or archived before
they can remain in the active workflow. A phone already claimed by another
active lead returns `409` with `error.code == "duplicate_phone"`.

```json
{
  "name": "Alex",
  "phone": "9123 4567",
  "note": "Accounts team will make payment Friday",
  "followUp": "2026-08-14"
}
```

It returns `201 { "lead": {...}, "replayed": false }`, or `200` with
`replayed: true` when the same key and body are retried. Reusing a key with a
different body returns `409`.

When a member creates a lead (through POST or a PUT upsert), the same Firestore
transaction creates one deterministic `lead_created` outbox row. Owner-created
leads do not notify the owner about their own action, and routine edits,
follow-ups, and archives do not create Telegram spam. The alert contains a
bounded summary and an explicit V2 Watchlist link; the full lead remains
authoritative in Firestore.

`GET /v1/leads/:id/notification` is writer-only and returns the explicit proof
allowlist `id,leadId,deliveryStatus,deliveredAt?,telegramMessageId?` plus
`dataAsOf,meta`. It never exposes message text or provider errors. `delivered`
is returned only when both server proof fields are present.

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
An active outcome also requires the lead's canonical phone claim to be intact;
terminal outcomes and archive release only the claim owned by that lead.

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
      "followUpsByOutcome": {
        "no_reply": 0,
        "spoke": 1,
        "won": 0,
        "lost": 0
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

The fully formatted Telegram text must fit in one 4,096-character message. An
oversized digest is rejected with 400 before any digest/outbox write, so the
browser can keep and unlock the draft for editing; the server never truncates
the notes or drops the submitter line.

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

### Active-phone claim cutover

Do not expose writer accounts to claim-enforcing code before reconciling every
active lead. Freeze writes, make the managed and logical backups, then run from
`firebase-leads/functions` with Application Default Credentials scoped to the
explicit project:

```sh
npm run claims:migrate -- --project reputifly-leads-2
```

This is a dry run and attempts zero writes. Apply is blocked when any active
lead has a duplicate canonical phone, an unusable/missing phone, or a missing
next-chase date (`followUp`). Resolve each row manually by correcting it or archiving it;
the tool never picks a duplicate winner and never merges leads. Only after the
dry run reports `safeToApply:true` may the operator repeat the project ID as the
destructive confirmation:

```sh
npm run claims:migrate -- \
  --project reputifly-leads-2 \
  --apply reputifly-leads-2
```

The apply re-reads active leads and claims inside one transaction and creates,
repairs, or removes claim documents atomically. It refuses plans above the
450-write safety limit. Afterward, rerun the dry run; success requires
`safeToApply:true` and `createCount`, `updateCount`, `deleteCount`, and
`writeCount` all equal to zero.

Backups and restore drills must include `activePhoneClaims` with its own count
and canonical hash. If an API rollback permits writes through code that does
not maintain claims, freeze again and rerun this reconciliation before bringing
claim-enforcing code back. Do not delete or rebuild claims while writes remain
open.

### Validation limits

- Lead writes: name 120, usable phone 1–40, note 1–5,000, and a real
  `followUp` date in `YYYY-MM-DD`. Legacy persistence decoding still permits an
  empty phone/date so old rows can be read and explicitly repaired or archived.
- IDs: `[A-Za-z0-9_-]{1,128}`.
- Idempotency keys: `[A-Za-z0-9._:-]{8,200}`.
- Digest: date 1–80; counts are integers 0–10; at most 100 follow-ups and 100
  dumped leads; notes at most 10,000; the complete formatted Telegram message
  must also fit within 4,096 characters or the entire request is rejected.
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
