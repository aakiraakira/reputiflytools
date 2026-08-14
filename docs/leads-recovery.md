# Watchlist and Daily Digest recovery runbook

Last reviewed: 2026-08-14 (Asia/Singapore)

This runbook covers the new `reputifly-leads-2` Firebase backend, the primary
`watchlist-v2.web.app` Watchlist, and the primary `daily-digest-v2.web.app`
Daily Digest. The earlier `reputifly-leads-2.web.app` and
`daily-digest-2.web.app` sites remain compatible aliases. “Never breaks”
cannot be guaranteed. The operating target is instead:
fail closed on authorization, never turn a failed read into an empty list,
never claim an unconfirmed write succeeded, preserve a recoverable copy of the
data, and detect drift before a user does.

## Architecture and authority

- The two tracked source pages are `watchlist/index.html` and
  `daily-digest/index.html`.
- `scripts/leads/generate-hosting.mjs` performs the only allowed hosting
  transformation: it copies those pages into ignored
  `firebase-leads/hosting/*` artifacts and canonicalizes their cross-links.
  The manifest records source/output byte counts and SHA-256 values.
- The API is
  `https://asia-southeast1-reputifly-leads-2.cloudfunctions.net/api`.
- Browser users authenticate with the existing Reputifly Firebase identity.
  The API verifies that token and separately requires an active `members`
  document. A successful Firebase login alone does not grant app access.
- Browser Firestore access is denied by rules. Only the API/Admin identity may
  read or write `members`, `leads`, `leadFollowUps`, `digests`,
  `notificationOutbox`, `auditEvents`, or `system`.
- Firestore is authoritative after cutover. A Google Sheet remains a rollback
  source only until the legacy-retention window ends.

## First five minutes of an incident

1. Announce a write freeze. Do not ask users to “try Save again”; retries can
   make later reconciliation ambiguous.
2. Record the start time, affected URL, visible message, browser/network state,
   last known successful read/write, and whether both accounts are affected.
   Do not paste ID tokens, Authorization headers, exported leads, or Telegram
   secrets into an issue or chat.
3. Run the non-mutating boundary and deployment checks from repository root:

   ```bash
   node scripts/leads/generate-hosting.mjs
   node scripts/leads/validate-hosting.mjs
   node scripts/leads/security-smoke.mjs
   node scripts/leads/verify-deployment.mjs
   ```

4. For an authenticated read check, enter a fresh Firebase ID token without
   putting it in shell history:

   ```bash
   read -rsp "Fresh Firebase ID token: " LEADS_ID_TOKEN
   export LEADS_ID_TOKEN
   node scripts/leads/smoke-api.mjs
   unset LEADS_ID_TOKEN
   ```

   The tool prints counts and contract results, never response bodies, lead
   identifiers, PII, or the token.
5. If reads fail, keep the freeze and inspect Cloud Functions logs, Firestore
   availability/quota, member state, Identity Toolkit verification, and the
   most recent deploy. If reads pass but the browser fails, inspect hosting SHA,
   browser console/network errors, authorized domains, and cached service-worker
   state. If writes fail, inspect API request IDs, revision conflicts, audit
   events, and notification-outbox state before retrying.

## Build and pre-deploy gates

From repository root:

```bash
node --test scripts/leads/test/*.test.mjs
node scripts/leads/generate-hosting.mjs
node scripts/leads/generate-hosting.mjs --check
node scripts/leads/validate-hosting.mjs
node scripts/leads/static-frontend-test.mjs
npm ci --prefix firebase-leads/functions --ignore-scripts
npm run typecheck --prefix firebase-leads/functions
npm test --prefix firebase-leads/functions
npm run build --prefix firebase-leads/functions
node scripts/leads/backend-contract-gate.mjs
```

Do not deploy if a generated artifact contains an Apps Script endpoint, an old
app cross-link, a missing `reputifly-leads-2` API marker, changed bytes outside
the deterministic link transform, duplicate HTML IDs, or invalid JavaScript.
The Hosting config gate also requires non-cacheable HTML plus both
`X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`; this prevents a hostile
site from framing the authenticated apps and clickjacking write actions. CI
repeats these gates and fails if a discovered package is missing a lockfile.
The independent backend gate starts the compiled API on localhost with a
synthetic in-memory repository. It verifies response allowlists, server
metadata, role boundaries, and follow-up idempotency without touching
Firestore or production.

After an authorized deployment, compare the actual decoded bytes with the local
artifacts. The verifier also rejects missing or changed cache, content-type,
referrer, and anti-framing response headers:

```bash
node scripts/leads/verify-deployment.mjs
node scripts/leads/security-smoke.mjs
```

Then use a fresh ID token for `smoke-api.mjs`. Production smoke is deliberately
read-only. Mutation contracts belong in emulator/backend tests because a
production “test lead” cannot be deleted without leaving audit history.

### No-downtime release and cutover order

1. Keep the legacy pages available and freeze only legacy writes. Complete the
   managed backup and isolated restore drill first.
2. Deploy Firestore indexes/rules and the API before either Hosting site. Do not
   point users at the new pages yet. Verify `/healthz`, unauthenticated
   fail-closed checks, and the fresh-token read-only canary against the API.
3. Import/reconcile frozen legacy data. Provision the owner, employee, and
   read-only canary member documents; configure exactly one employee with
   `dailyDigestExpected: true`. Repeat hashes and the canary.
4. Publish both Hosting sites as paired versioned releases without changing the
   legacy links. Run served-SHA verification against each exact `-2` URL and
   exercise a real owner/member canary with one approved synthetic record.
5. Cut over the navigation/link entry point only after both sites, API, auth,
   and returned receipts are green. Watch 4xx/5xx, latency, revision conflicts,
   and outbox age during the observation window. Keep the prior Hosting release
   and frozen Sheet intact for rollback.
6. If any gate fails, leave or return the entry point to the previous paired
   release; do not roll Firestore data backward. Freeze writes, export the
   failure state, repair/redeploy, and reconcile every accepted audit event
   before retrying cutover.

This order prevents a Hosting page from depending on an API that is not ready,
keeps the old read surface available through the observation window, and makes
the entry-point switch the only user-visible cutover. It does not authorize an
unreviewed production deployment.

## Backups before migration or repair

### Managed backup (primary recovery mechanism)

Enable Firestore point-in-time recovery and scheduled backups in Google Cloud.
Before a migration, create an on-demand managed export to a versioned,
retention-locked bucket in the same region, including `leadFollowUps` as well as
the original collections. Record the operation ID, bucket object generation,
project, database, commit SHA, and UTC time in the incident record. Restore that
export into a separate recovery database, run collection count/canonical-hash
reconciliation, and record the restore operation ID and results. Do not call a
backup proven until this isolated restore drill succeeds.

### Local logical evidence copy

Use a short-lived Google OAuth access token with datastore read permission:

```bash
set +x
read -rsp "Short-lived Google OAuth access token: " FIRESTORE_ACCESS_TOKEN
export FIRESTORE_ACCESS_TOKEN
node scripts/leads/export-firestore.mjs
unset FIRESTORE_ACCESS_TOKEN
```

The backup defaults to
`scripts/leads/output/firestore-logical-backup.json`, is mode `0600`, contains
PII, and is ignored by Git. Its companion manifest contains only collection
counts and canonical hashes. A collection's recovery hash is computed over the
document ID plus recursively decoded Firestore fields, sorted by document ID;
server-assigned `createTime` and `updateTime` envelope metadata are deliberately
excluded because they change on restore. The manifest also keeps a separate raw
envelope hash for evidence. Move the backup to encrypted incident storage and
delete the local copy according to the retention policy. This REST logical copy
is for evidence and targeted recovery; use a managed Firestore export for full
database restoration and type-preserving disaster recovery.

Never commit Sheet CSV/TSV files, Firestore exports, manifests containing raw
records, `.env` files, tokens, or Firebase debug logs. The normal local input
folder is the ignored `scripts/leads/input/` directory.

## Legacy Sheet migration

Accepted input is UTF-8 CSV or TSV with a header. Canonical headers are `id`,
`name`, `phone`, `note`, `followUp`, `status`, `createdAt`, `updatedAt`, and
`removedAt`; common Google Sheet spellings such as `Phone Number`, `Follow Up`,
and `Archived At` are accepted. Required invariants are:

- `id` matches `[A-Za-z0-9_-]{1,128}`. If absent, a deterministic, non-PII
  `legacy_<sha256>` ID is derived. Duplicate derived IDs stop the migration.
- Name is at most 120 characters, phone 40, note 5,000; name or phone and a
  non-empty note are required. Leading/trailing whitespace is rejected rather
  than silently changing the legacy value.
- `followUp` is empty or `YYYY-MM-DD`; timestamps are ISO-8601 with timezone.
- Missing timestamps deterministically become the other timestamp, or the Unix
  epoch when both are absent. Review this fallback count in the source before
  applying if historical ordering matters.
- Active rows get revision `1` and migration actor fields. `removedAt` maps to
  `archivedAt`, with archived status and migration actor metadata.

### Recommended freeze-and-cutover procedure

1. Pick a quiet window. Disable legacy writes or announce the exact freeze time.
2. Export the legacy Sheet after the freeze into
   `scripts/leads/input/legacy-leads.local.csv`. Record the Sheet revision and
   file SHA outside Git.
3. Make the logical and managed Firestore backups described above.
4. Dry-run locally. This is the default and attempts zero writes:

   ```bash
   node scripts/leads/import-legacy.mjs \
     --input scripts/leads/input/legacy-leads.local.csv
   ```

5. Set a short-lived OAuth access token and repeat the dry run. It reports
   source count/SHA, total target count, matched/missing/conflict counts, and a
   canonical target SHA without printing rows or IDs:

   ```bash
   set +x
   read -rsp "Short-lived Google OAuth access token: " FIRESTORE_ACCESS_TOKEN
   export FIRESTORE_ACCESS_TOKEN
   node scripts/leads/import-legacy.mjs \
     --input scripts/leads/input/legacy-leads.local.csv
   ```

6. Investigate every conflict. The tool refuses to overwrite a different target
   by default and emits only a truncated hash of the conflicting ID. `--overwrite`
   is a separate destructive authorization; use it only with an approved record
   comparison and a fresh backup.
7. Apply in Firestore-safe batches (default 400, hard maximum 500):

   ```bash
   node scripts/leads/import-legacy.mjs \
     --input scripts/leads/input/legacy-leads.local.csv \
     --apply
   ```

8. The apply is successful only when the post-write matched count equals the
   source document count and both canonical SHA-256 values are identical. Run a
   second independent reconciliation:

   ```bash
   node scripts/leads/import-legacy.mjs \
     --input scripts/leads/input/legacy-leads.local.csv \
     --reconcile-only
   unset FIRESTORE_ACCESS_TOKEN
   ```

9. Deploy/canary the backend and hosting through the approved release process,
   run all smoke checks, then let one owner account read, create, edit, archive,
   and submit a digest. Verify the returned state, audit event, digest record,
   and Telegram delivery/outbox state before opening access to the second user.
10. End the freeze only after the canary and hashes pass. Mark Firestore
    authoritative, preserve the frozen Sheet read-only, and record the cutover
    timestamp.

### Historical Daily Digest migration

The frozen `digest.tsv` contains 14 historical rows with date labels and
Singapore send times, but no year. Its actual sequence starts `Mon 20 Jul`,
`Wed 22 Jul`, `Thu 23 Jul` and continues through `Thu 6 Aug`. Every one of the
14 weekday claims matches the 2026 Gregorian calendar; 2025 is rejected at the
first row because 20 July was a Sunday. The importer never guesses: the operator
must still pass `--year 2026`, and it validates all 14 claims before any target
read or write. The PII-free manifest records the explicit year, time zone,
claimed/matched counts, and validation method.

The import preserves the digest payload, Singapore send instant, canonical
Singapore `businessDate`, original filer provenance, and duplicate historical
rows. It assigns deterministic digest IDs, `createdBy: "migration"`, and
`deliveryStatus: "legacy_unknown"`. It writes only `digests`; it never creates
`notificationOutbox` entries, so historical records cannot accidentally send
Telegram messages.

Dry-run first (zero writes):

```bash
node scripts/leads/import-digests.mjs \
  --input scripts/leads/input/digest.local.tsv \
  --year 2026
```

Then set the short-lived `FIRESTORE_ACCESS_TOKEN` as in the lead migration,
repeat the dry run, inspect every count/conflict, and apply:

```bash
node scripts/leads/import-digests.mjs \
  --input scripts/leads/input/digest.local.tsv \
  --year 2026 \
  --apply
```

Success requires source count `14`, matched target count `14`, no missing or
conflicting expected IDs, and identical canonical source/target SHA-256 values.
Run the independent read-only reconciliation afterward:

```bash
node scripts/leads/import-digests.mjs \
  --input scripts/leads/input/digest.local.tsv \
  --year 2026 \
  --reconcile-only
unset FIRESTORE_ACCESS_TOKEN
```

As with leads, `--overwrite` is blocked unless explicitly combined with
`--apply`. A normal migration must never need it. Preserve the ignored source
TSV and logical backup in encrypted incident storage for the retention window.

#### Guarded `businessDate` backfill for the original 14-document import

If the 14 legacy digests were imported before canonical `businessDate` was
added, do not use the generic `--overwrite` path. Keep writes frozen, make the
managed/logical backups, set a short-lived OAuth token, and run the dedicated
dry run:

```bash
node scripts/leads/import-digests.mjs \
  --input .private-migration/digest.tsv \
  --year 2026 \
  --backfill-business-date \
  --manifest scripts/leads/output/digest-business-date-dry-run.json
```

It is safe to continue only when source/expected count is `14`, completed plus
eligible is `14`, missing and blocked differences are both `0`, and
`safeToApply=true`. For the reviewed frozen file, the raw input SHA-256 is
`7e2ef60c1d2d11f7a08c2169c2abe8330878c55afce5e752a48285c262f60594`
and the 14-document canonical SHA-256 including `businessDate` is
`ad171c3cff567185281d8b59bc8f4f2ee143b0615303970262160b78851d45f6`.
Stop if either value differs unless a new source review deliberately approves
the change. The tool treats a document as eligible only when its full canonical
content matches the deterministic source after adding that one missing field.
It records only counts/hashes in the manifest.

After explicit authorization, apply exactly that one-field patch:

```bash
node scripts/leads/import-digests.mjs \
  --input .private-migration/digest.tsv \
  --year 2026 \
  --backfill-business-date \
  --apply \
  --manifest scripts/leads/output/digest-business-date-apply.json
```

Each write uses the document's just-read Firestore `updateTime` as a
precondition and an update mask containing only `businessDate`. A concurrent
change therefore fails instead of being overwritten. Apply success requires a
post-write re-read with all `14` canonical documents/hash reconciled and the
`notificationOutbox` count/hash exactly unchanged. Finally run the independent
read-only proof:

```bash
node scripts/leads/import-digests.mjs \
  --input .private-migration/digest.tsv \
  --year 2026 \
  --backfill-business-date \
  --reconcile-only \
  --manifest scripts/leads/output/digest-business-date-reconcile.json
unset FIRESTORE_ACCESS_TOKEN
```

Any missing document, difference beyond absent `businessDate`, update-time
conflict, canonical-hash mismatch, or outbox drift is a stop condition. The
backfill mode never accepts `--overwrite` and never creates outbox documents.

### Dual-write alternative

Use dual-write only when a freeze is impossible. It is not provided by the
browser pages. Add it at one trusted server boundary with one idempotency key per
operation, durable retry/outbox state, and per-record reconciliation. Never let
two browsers independently write the Sheet and Firestore: that creates two
authorities and no reliable ordering. Run dual-write for an agreed observation
window (at least one full daily-digest cycle), compare counts and canonical
hashes repeatedly, stop on the first divergence, then disable legacy writes and
perform the final delta reconciliation before cutover.

## Rollback

Rollback is a decision, not merely a redeploy. Freeze writes first and preserve
the failing state before changing anything.

### Hosting-only regression

1. Confirm `verify-deployment.mjs` shows a SHA mismatch or a reproducible UI
   regression with healthy API reads.
2. In Firebase Hosting release history, roll each affected site back to the
   last SHA-verified release (or clone that exact prior version to `live`). Keep
   Watchlist and Daily Digest versions paired so cross-links do not split them.
3. Rerun deployment SHA, security, and authenticated read smoke checks.

### Functions/API regression

1. Export current Firestore evidence and record request IDs/log timestamps.
2. Redeploy the last tested backend artifact from its pinned Git commit and
   lockfile; do not rebuild an unpinned dependency graph.
3. Do not roll back Firestore data merely because code rolled back. Confirm the
   previous code understands the current document schema and revisions first.
4. Run backend contract tests, unauthenticated security smoke, then authenticated
   read smoke before reopening writes.

### Data corruption or bad migration

1. Keep writes frozen. Export the current bad state so no post-backup legitimate
   changes disappear without review.
2. Compare the pre-change manifest, current manifest, audit events, and source
   export. Identify the exact affected IDs without publishing them.
3. Prefer targeted, reviewed repairs when only a few documents are affected.
   For broad corruption, restore the managed export into a recovery database,
   verify counts/hashes there, and plan a controlled restore. Do not blindly
   replay the local JSON logical copy over live data.
4. If reverting users to the legacy Sheet, first replay every legitimate
   post-cutover Firestore change in revision order, reconcile, then release the
   paired legacy hosting version. Otherwise “rollback” silently loses leads.

Rollback triggers include any unauthorized successful request, Firestore public
read, serving-SHA mismatch, source/target hash mismatch, unexplained empty list,
confirmed write not readable afterward, elevated 5xx, sustained outbox failures,
or a digest marked delivered without the expected Telegram receipt.

## Secret and access rotation

On suspected disclosure, freeze privileged operations and rotate in this order:

1. Revoke exposed short-lived ID/OAuth tokens and all affected browser sessions.
   Remove saved tokens from CI logs/artifacts and local shell history if one was
   ever entered incorrectly.
2. Disable or rotate leaked service-account keys. Prefer keyless workload
   identity for CI and scheduled jobs; review IAM bindings and Cloud audit logs.
3. Revoke the Telegram bot token with BotFather, set the replacement through
   the deployed secret/config mechanism, deploy only the affected function, and
   send a synthetic non-PII delivery. Treat chat IDs as sensitive configuration
   even though they are not authentication secrets.
4. Rotate any legacy Identity Toolkit server credential used for cross-project
   verification. The Firebase browser API key is public configuration, not a
   password; restrict it to the intended APIs and domains rather than hiding it.
5. Review and, if necessary, disable `members` entries. Test owner and member
   roles separately; a valid identity without an active member record must get
   `401/403` and no data.
6. Rerun security smoke, authenticated read smoke, a controlled canary write,
   and Telegram delivery verification. Record who rotated what and when; never
   record the new secret value.

## Scheduled monitoring and maintenance

`.github/workflows/leads.yml` runs source/backend tests on changes and, every six
hours, runs unauthenticated boundary checks, exact served-SHA verification, and
an authenticated read contract check. Create a dedicated legacy Firebase canary
account and `members/{canaryUid}` with `active: true` and role `viewer`. It must
have no owner/member authority and must never be used interactively. Store its
email and strong unique password as encrypted GitHub Actions secrets
`LEADS_CANARY_EMAIL` and `LEADS_CANARY_PASSWORD`. Store the dedicated,
Identity-Toolkit-only server key as the encrypted Actions secret
`LEGACY_FIREBASE_API_KEY`; never use the browser key for the canary or expose
the server key as a repository variable.

Each monitor run signs in through Identity Toolkit, keeps the fresh ID token
only in process memory, verifies the canary still has the `viewer` role, and
discards the token at process exit. It requires `session`, `leads`, and
`daily-status` reads to return a canonical `meta.serverTime`, the Singapore
`meta.businessDate` derived from that instant, and `dataAsOf` equal to the
server time. It also proves that the viewer cannot use team status, lead-write,
or follow-up routes. Those probes are deliberately incapable of a valid write:
if an authorization regression occurred, schema/ID validation would stop them
before a production document could be created or changed.

Missing credentials, failed sign-in, an over-privileged canary, or a role
boundary regression fails the workflow; scheduled monitoring never silently
skips. Rotate the canary password immediately after suspected exposure and on
the normal credential-rotation schedule. Disable the account/member while
investigating unexplained sign-ins, then provision a replacement and confirm one
green manual monitor before restoring the schedule.

Configure independent alerts outside Telegram (email/pager) so a Telegram
failure can still alert someone:

- API 5xx count and latency, auth-denial ratio, function cold-start/timeouts,
  Firestore quota/errors, and Hosting availability.
- `notificationOutbox` pending age, retry count, terminal failures, and digests
  still not delivered after the agreed SLA.
- Failed read-only canary sessions, unexplained empty lead reads relative to the
  last reconciled manifest, revision conflicts, and daily source/target
  count/hash drift during migration retention. Do not alert on an employee's
  login frequency, browser activity, or time online.
- Firebase/Google Cloud budget thresholds, quota headroom, certificate/domain
  status, secret expiry, scheduled backup success, and restore-drill age.

Daily: review failed outbox/audit anomalies. Weekly: run authenticated read smoke
with a fresh token and inspect dependency/security alerts. Monthly: verify a
managed backup and perform a non-production restore/reconciliation drill.
Quarterly: review members/IAM, rotate eligible credentials, rehearse the paired
hosting/API rollback, and update this runbook with measured recovery time.

## Accountability, privacy, and proof semantics

`Recorded today` is a narrow operational receipt, not a productivity,
attendance, or surveillance score. It counts only successfully committed,
audited domain changes for the server-derived Singapore business day:
lead create/update/archive, a logged follow-up, and digest acceptance. Failed
requests, form opens, retries of an idempotent receipt, WhatsApp link clicks,
keystrokes, searches, time online, and page views are never counted. A logged
follow-up proves that the employee recorded an outcome; it does not prove that a
WhatsApp message was sent or read.

The self status route may return only the authenticated member's status. The
team route is owner-only and must resolve exactly one active member explicitly
configured with `dailyDigestExpected: true`; zero or multiple configured
subjects is a conflict, not an employee signal. The UI uses neutral labels and
canonical actor provenance. Public actor maps contain only actors referenced by
that response, with `{label}` only; they never expose email, role, membership
rosters, raw migration filer text, delivery errors, payload hashes, or outbox
internals. A missing actor label falls back to neutral copy and is not an error.

All day boundaries come from API `meta.businessDate`, calculated in
`Asia/Singapore` from `meta.serverTime`. Browser dates are display-only. At
Singapore midnight the client preserves the prior day's draft/receipt and
starts the new canonical day; tests cover ordinary, month, and year rollovers.
Digest acceptance and Telegram delivery are separate facts: accepted time and
actor come from the server receipt, while the UI may say delivered only when a
monotonic public digest response includes both `deliveredAt` and
`telegramMessageId`. `pending`, `retrying`, or `failed` must never be presented
as delivered, and migrated history remains `legacy_unknown` without invented
proof.

Do not add a configurable employee deadline reminder until an explicit work
schedule, time zone policy, recipient, holiday/leave behavior, and escalation
owner are approved. A guessed deadline creates false accountability. If such a
feature is later approved, monitor notification delivery as an operational
event only and never treat an unanswered reminder as evidence of absence or
poor performance.
