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
8. A controlled member-created lead reaches its deterministic `lead_created`
   outbox receipt with both proof fields; routine edits create no additional
   notification.
9. Every active lead has a usable canonical phone, a real next-chase date,
   and exactly one matching `activePhoneClaims/v1_<sha256(canonicalDigits)>`
   document containing only its `leadId`. No claim points to an archived or
   missing lead.

Create Cloud Monitoring alerts for `operationalHealth` ERROR log entries,
Function errors, Scheduler job failures, and a missing scheduled invocation for
ten minutes. Firestore heartbeat age is persisted for dashboards/manual probes;
use a Cloud Monitoring log-based metric on `Operational health check failed` as
the immediate stale/dead-outbox paging signal. Route the alert through email or
another independent channel, not through this Telegram outbox.
Never include request Authorization headers, Telegram secrets, or digest bodies
in alert payloads.

Firebase scheduled-Function deploys replace the service-level invoker policy
with the runtime service account, while the generated Scheduler jobs authenticate
as `828546154700-compute@developer.gserviceaccount.com`. A source-level
`invoker` option is ignored by the scheduled provider. Immediately after every
scheduled-Function deploy, restore and verify the three exact service policies with
`ALLOW_SCHEDULER_IAM_CONFIG=reputifly-scheduler-invoker node
../scripts/leads/configure-scheduler-invoker.mjs`; it grants `run.invoker` on
only the three scheduled Reputifly services. The
runtime remains the dedicated worker account and the Scheduler identity must
never receive Telegram secret access. After any scheduled-Function deploy,
wait for a normal Scheduler `AttemptFinished` HTTP 200.

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

The outbox intentionally has only three user-facing message types: a
member-created lead summary, the 09:00 due/overdue Watchlist reminder, and the
Daily Digest. Follow-up outcomes, edits, and archives are recorded
transactionally and summarized in the Digest rather than sent as repetitive
per-action messages.

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
   and the related digest (when the row is a digest) becomes `delivered`.

Do not create a second outbox document. One digest slot exists per actor and
Singapore business date: the same payload under a new key returns the original
receipt, while changed payload returns 409. Recover the `existingDigestId`
instead of trying to create another same-day digest.

When a release introduces a new outbox `type`, deploy `outboxWorker` first and
prove its revision plus heartbeat before deploying the API that can enqueue the
type. An older strict worker can correctly reject—but therefore dead-letter—a
newer type. Roll back in reverse safety order: stop new API enqueues, reconcile
all rows of the newer type, then roll back the worker.

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

New create/update writes require both a usable WhatsApp phone and a real
next-chase date (`followUp`, `YYYY-MM-DD`). Legacy rows with empty values remain readable
only so they can be deliberately corrected or archived; they are not ready for
claim cutover.

An active row must also pass the exact shipped Watchlist admission policy. A
human reviewer must confirm at least one of these six events from the existing
note and source conversation:

- They name someone else who decides. Team, management, boss, partner, spouse.
- They give a date. For payment or for anything.
- They say they like it, then delay.
- They go quiet after seeing the price.
- Any complaint, or any mention of stopping or refunding.
- They ask for something we do not sell.

This manual check is outside the claim-migration tool; do not represent it with
a new trigger, stage, priority, or monetary-value field. Correct or archive a
row that does not belong on the Watchlist.

Historical digest imports must use `deliveryStatus:"legacy_unknown"` unless a
Telegram `message_id` proves delivery. Never create `notificationOutbox` rows
for imported historical digests; only new API submissions create outbox work.

Before cutover, compare source and destination counts plus a stable hash of the
preserved source fields. Keep the legacy Apps Script read-only until both new
frontends and Telegram delivery pass end-to-end checks.

While all writers are frozen, back up `activePhoneClaims` together with every
other canonical root collection. From `firebase-leads/functions`, dry-run the
claim reconciliation with explicit project selection:

```sh
npm run claims:migrate -- --project reputifly-leads-2
```

The apply gate is closed if any active row has a duplicate canonical phone, an
invalid/missing phone, or a missing `followUp`. Correct or archive each row
manually. Never auto-merge duplicates or choose a claim owner based on row
order. When the dry run reports `safeToApply:true`, apply with the project ID
repeated as confirmation:

```sh
npm run claims:migrate -- \
  --project reputifly-leads-2 \
  --apply reputifly-leads-2
```

Rerun the dry run before reopening writes. It must report `safeToApply:true`
with zero creates, updates, deletes, and writes. A restored database is not
release-ready until the `leads` and `activePhoneClaims` collection counts and
canonical hashes match the approved backup and this zero-diff reconciliation
passes in the isolated restore environment.

## Rollback

Frontend rollback is independent of data rollback: point the static frontend at
the prior endpoint while leaving new Firestore data intact. Do not delete the
new database or Functions during an incident. Pause new writes, export data,
identify the last consistent revision/audit event, and choose a deliberate
forward repair or point-in-time restore.

If the rolled-back API predates `activePhoneClaims` and accepts any writes, the
claim index is no longer trusted even when those writes appear unrelated.
Preserve it as evidence, keep writes frozen, and rerun the dry-run/apply/zero-diff
sequence before claim-enforcing code is restored. Never blindly delete the
collection or backfill it while an older writer is active.
