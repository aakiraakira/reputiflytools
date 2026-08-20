# Operations runbook

## Healthy state

The following checks jointly prove the system is healthy; an HTTP 200 alone
does not prove Telegram delivery.

1. `GET /healthz` returns `{ok:true}` without authentication.
2. An authenticated `GET /v1/session` returns the expected legacy UID and active
   leads in well under the browser timeout.
3. `system/outboxWorker.at` advances at least every two minutes.
4. `system/morningReminder.at` advances shortly after 09:00 Singapore time.
   `skipped:true` with `dueCount:0` is healthy and proves no Telegram reminder
   was created on an empty day.
5. `system/operationalHealth.at` advances at least every ten minutes and its
   `healthy` field is true. The scheduled synthetic check writes this result
   every five minutes and emits an ERROR log when stale/dead work exists.
6. `notificationOutbox` has no old `pending`, `retry`, `processing`, or `dead`
   documents.
7. A submitted digest reaches `digests/{id}.deliveryStatus == "delivered"` and
   records both `deliveredAt` and `telegramMessageId`.

Create Cloud Monitoring alerts for `operationalHealth` ERROR log entries,
Function errors, Scheduler job failures, and a missing scheduled invocation for
ten minutes. Firestore heartbeat age is persisted for dashboards/manual probes;
use a Cloud Monitoring log-based metric on `Operational health check failed` as
the immediate stale/dead-outbox paging signal. Route the alert through email or
another independent channel, not through this Telegram outbox.
Never include request Authorization headers, Telegram secrets, or digest bodies
in alert payloads.

## Notification state machine

```text
pending -> processing -> delivered
             | crash       (terminal)
             v
           retry -> processing
             |
             +---- after attempt 8 ----> dead
```

The worker has concurrency 1 and one maximum instance. It claims exactly one
document immediately before sending, processes at most four in a 48-second run,
reserves at least the Telegram timeout plus safety before another claim, and
uses a 65-second lease that outlives the Function's declared 55-second timeout.
Later rows are never preclaimed, so a slow send cannot inflate their attempts.
An expired `processing` lease is recovered by a later worker. Backoff starts at
one minute, doubles per attempt, and caps at six hours. A Telegram HTTP error,
`ok:false`, malformed response, network failure, or timeout is persisted as
`lastFailure`; failed digests expose `lastDeliveryError`.

A candidate whose persisted fields fail strict decoding is quarantined as
`dead` with `Stored notification was invalid and was quarantined.` The worker
continues scanning for valid work. Inspect and repair the stored schema before
any manual redrive; do not copy malformed contents into logs or tickets.

The 09:00 scheduler is a legacy Watchlist reminder, not an employee deadline.
It sends only when `dueCount > 0`, says only how many leads are due/overdue and
asks the user to review the Watchlist. It must never contain Daily Digest
deadline, late, missed, or performance language.

## Telegram duplicate boundary

Telegram Bot API `sendMessage` has no idempotency key. The database guarantees
one outbox document and concurrent workers cannot normally double-send. There
is one irreducible at-least-once window: Telegram can accept the message and the
Function can crash before Firestore stores its `message_id`. Recovering the
expired lease may then send one duplicate. Refusing recovery would instead risk
silently losing a digest, so this implementation chooses reliable delivery.

If an expired lease follows a known incident, check the Telegram chat before
manually changing it. Once the worker persists `telegramMessageId`, ordinary
retries and digest POST replays cannot duplicate the message.

## Recover a failed notification

1. Inspect `notificationOutbox/{id}.lastFailure`, Function logs using the
   request/time correlation, and Telegram service status.
2. Check the chat for an already delivered copy, especially after a Function
   crash or timeout.
3. Fix the root cause (secret, chat permission, network, or payload).
4. To redrive only after the chat check, update the one outbox document:

   ```text
   status = "retry"
   attempts = 0
   availableAt = current UTC ISO timestamp
   leaseOwner = null
   leaseExpiresAt = null
   ```

5. Verify the worker changes it to `delivered`, a `telegramMessageId` appears,
   and the related digest becomes `delivered`.

Do not create a second outbox document. One digest slot exists per actor and
Singapore business date: the same payload under a new key returns the original
receipt, while changed payload returns 409. Recover the `existingDigestId`
instead of trying to create another same-day digest.

## Rotate Telegram credentials

1. Rotate/revoke the token with BotFather when compromise is suspected.
2. Set the new value through the non-echoing Firebase prompt:

   ```sh
   firebase functions:secrets:set TELEGRAM_BOT_TOKEN
   firebase functions:secrets:set TELEGRAM_CHAT_ID
   firebase deploy --only functions:outboxWorker
   ```

3. Submit a controlled test digest with a unique key and confirm its persisted
   `telegramMessageId` before deleting old secret versions.
4. Never copy a secret into a lead, digest, audit event, `.env` file, issue, or
   chat transcript.

## Revoke or grant a member

Authentication and authorization are separate. A valid legacy Firebase login
does not grant access unless `members/{legacyUid}.active` is true.

- Immediate revoke: set `active` to `false`; the next request returns 403.
- Restore: set `active` to `true` after confirming the immutable legacy UID.
- Read-only: set `role` to `viewer`; mutations return 403.
- `owner` and `member` may use all current write endpoints.
- Only `owner` may use `/v1/team/daily-status`. Set
  `dailyDigestExpected:true` on exactly one active `member`; do not set it on an
  owner/viewer or use it as an employment-status signal.

Never authorize by mutable email alone.

## Accountability data boundary

`Recorded today` is a reconciliation of successful, committed audit and digest
records under the server-derived `Asia/Singapore` business date. It is not a
presence or productivity monitor. Never add drafts, keystrokes, page views,
sign-in duration, WhatsApp clicks, inferred working hours, or failed attempts.
Neutral empty-state copy is `No recorded action today`, not `idle`, `offline`,
or `did no work`.

Follow-up audit/event consistency is transactional: each `leadFollowUps` event
must have one matching `lead.followup_logged` audit with the same business date,
actor, outcome, and resulting revision. Monitor revision/idempotency conflict
rates, but do not treat conflicts as employee activity.

## Restore and migration safety

Enable Firestore point-in-time recovery, scheduled backups, and database delete
protection in the Firebase/Google Cloud console. Test a restore into a separate
database/project before relying on it. Export before bulk migration or schema
changes.

Migration-compatible lead fields:

```text
id, name, phone, note, followUp,
status, revision,
createdAt, createdBy, updatedAt, updatedBy,
archivedAt?, archivedBy?
```

All application timestamps are UTC ISO strings. Existing active rows should
preserve their `id`, `name`, `phone`, `note`, `followUp`, `createdAt`, and
`updatedAt`, then add `status:"active"`, `revision:1`, and migration actor
markers. Legacy archive `removedAt` maps to `archivedAt`.

Historical digest imports must use `deliveryStatus:"legacy_unknown"` unless a
Telegram `message_id` proves delivery. Never create `notificationOutbox` rows
for imported historical digests; only new API submissions create outbox work.

Before cutover, compare source and destination counts plus a stable hash of the
six preserved fields. Keep the legacy Apps Script read-only until both new
frontends and Telegram delivery pass end-to-end checks.

## Rollback

Frontend rollback is independent of data rollback: point the static frontend at
the prior endpoint while leaving new Firestore data intact. Do not delete the
new database or Functions during an incident. Pause new writes, export data,
identify the last consistent revision/audit event, and choose a deliberate
forward repair or point-in-time restore.
