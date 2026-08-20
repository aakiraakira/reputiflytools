#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  PROJECT_ID,
  REPO_ROOT,
  atomicWrite,
  batchWriteFirestore,
  canonicalHash,
  decodeFirestoreFields,
  decodeUtf8,
  documentIdFromName,
  encodeFirestoreFields,
  firestoreToken,
  listFirestoreCollection,
  parseCli,
  parseDelimited,
  publicError,
  sha256,
  stableJson,
} from "./ops-lib.mjs";
import { normalizeDigestRows } from "./digest-lib.mjs";

const DEFAULT_MANIFEST = path.join(REPO_ROOT, "scripts/leads/output/digest-import-manifest.json");

function help() {
  console.log(`Usage:
  node scripts/leads/import-digests.mjs --input FILE --year 2026
  node scripts/leads/import-digests.mjs --input FILE --year 2026 --apply
  node scripts/leads/import-digests.mjs --input FILE --year 2026 --reconcile-only
  node scripts/leads/import-digests.mjs --input FILE --year 2026 --backfill-business-date
  node scripts/leads/import-digests.mjs --input FILE --year 2026 --backfill-business-date --apply

Dry-run by default. The legacy file omits its year, so --year is mandatory and
every claimed weekday must match that year's calendar. Apply writes only the
digests collection; it intentionally creates no notificationOutbox documents.`);
}

function businessDateBackfillAnalysis(expected, targetDocuments) {
  const targetById = new Map(targetDocuments.map((document) => [
    documentIdFromName(document.name),
    { document, actual: decodeFirestoreFields(document.fields ?? {}) },
  ]));
  const completed = [];
  const eligible = [];
  const missing = [];
  const blocked = [];
  const actualExpected = [];
  for (const digest of expected) {
    const target = targetById.get(digest.id);
    if (!target) {
      missing.push(digest);
      continue;
    }
    actualExpected.push(target.actual);
    if (stableJson(target.actual) === stableJson(digest)) {
      completed.push(digest);
      continue;
    }
    const withExpectedDate = { ...target.actual, businessDate: digest.businessDate };
    if (!Object.hasOwn(target.actual, "businessDate") && stableJson(withExpectedDate) === stableJson(digest)) {
      eligible.push({ digest, document: target.document });
    } else {
      blocked.push(digest);
    }
  }
  actualExpected.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return { completed, eligible, missing, blocked, actualExpected };
}

function backfillEvidence(expected, targetDocuments, analysis) {
  return {
    totalDocumentCount: targetDocuments.length,
    expectedIdCount: expected.length,
    completedCount: analysis.completed.length,
    eligibleMissingBusinessDateCount: analysis.eligible.length,
    missingCount: analysis.missing.length,
    blockedDifferenceCount: analysis.blocked.length,
    expectedIdsCanonicalSha256: analysis.actualExpected.length
      ? canonicalHash(analysis.actualExpected)
      : sha256("[]"),
    missingIdHashes: hashes(analysis.missing),
    blockedIdHashes: hashes(analysis.blocked),
    safeToApply: analysis.missing.length === 0
      && analysis.blocked.length === 0
      && analysis.completed.length + analysis.eligible.length === expected.length,
  };
}

function collectionEvidence(documents) {
  return {
    documentCount: documents.length,
    canonicalSha256: canonicalHash(documents),
  };
}

async function runBusinessDateBackfill({
  args,
  base,
  batchSize,
  digests,
  manifestPath,
  project,
  sourceCanonicalSha256,
  token,
}) {
  let target = await listFirestoreCollection("digests", { project, token });
  const outboxBeforeDocuments = await listFirestoreCollection("notificationOutbox", { project, token });
  const outboxBefore = collectionEvidence(outboxBeforeDocuments);
  let analysis = businessDateBackfillAnalysis(digests, target);
  const before = backfillEvidence(digests, target, analysis);
  const reconciledBefore = analysis.eligible.length === 0
    && before.safeToApply
    && before.expectedIdsCanonicalSha256 === sourceCanonicalSha256;

  if (!args.apply) {
    const manifest = {
      ...base,
      target: { before, after: before },
      notificationOutbox: { before: outboxBefore, after: outboxBefore, unchanged: true },
      result: {
        writesAttempted: 0,
        reconciled: reconciledBefore,
        safeToApply: before.safeToApply,
      },
    };
    await saveManifest(manifestPath, manifest);
    console.log(`${args["reconcile-only"] ? "RECONCILE" : "DRY RUN"} BUSINESS-DATE BACKFILL: source=${digests.length}, completed=${analysis.completed.length}, eligible=${analysis.eligible.length}, missing=${analysis.missing.length}, blocked=${analysis.blocked.length}`);
    console.log(`safeToApply=${before.safeToApply}; reconciled=${reconciledBefore}; zero writes and zero outbox documents attempted`);
    console.log(`notificationOutbox count/hash unchanged=${outboxBefore.documentCount}/${outboxBefore.canonicalSha256}`);
    console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
    if (args["reconcile-only"] && !reconciledBefore) process.exitCode = 2;
    return;
  }

  if (!before.safeToApply) {
    const manifest = {
      ...base,
      target: { before },
      notificationOutbox: { before: outboxBefore },
      result: {
        writesAttempted: 0,
        reconciled: false,
        safeToApply: false,
        blockedReason: "missing-or-non-businessDate-differences",
      },
    };
    await saveManifest(manifestPath, manifest);
    throw new Error("Business-date backfill is not safe: one or more deterministic documents are missing or differ beyond the absent businessDate; zero writes attempted");
  }
  if (analysis.eligible.some(({ document }) => typeof document.updateTime !== "string" || !document.updateTime)) {
    throw new Error("Business-date backfill requires Firestore updateTime preconditions for every eligible document; zero writes attempted");
  }

  let writesAttempted = 0;
  for (let offset = 0; offset < analysis.eligible.length; offset += batchSize) {
    const batch = analysis.eligible.slice(offset, offset + batchSize);
    const writes = batch.map(({ digest, document }) => ({
      update: {
        name: document.name,
        fields: { businessDate: encodeFirestoreFields({ businessDate: digest.businessDate }).businessDate },
      },
      updateMask: { fieldPaths: ["businessDate"] },
      currentDocument: { updateTime: document.updateTime },
    }));
    await batchWriteFirestore(writes, { project, token });
    writesAttempted += writes.length;
    console.log(`Applied guarded businessDate batch ${Math.floor(offset / batchSize) + 1}: ${writes.length}; cumulative=${writesAttempted}/${analysis.eligible.length}`);
  }

  target = await listFirestoreCollection("digests", { project, token });
  const outboxAfterDocuments = await listFirestoreCollection("notificationOutbox", { project, token });
  analysis = businessDateBackfillAnalysis(digests, target);
  const after = backfillEvidence(digests, target, analysis);
  const outboxAfter = collectionEvidence(outboxAfterDocuments);
  const outboxUnchanged = stableJson(outboxAfter) === stableJson(outboxBefore);
  const reconciled = analysis.eligible.length === 0
    && after.safeToApply
    && after.expectedIdsCanonicalSha256 === sourceCanonicalSha256
    && outboxUnchanged;
  const manifest = {
    ...base,
    target: { before, after },
    notificationOutbox: { before: outboxBefore, after: outboxAfter, unchanged: outboxUnchanged },
    result: { writesAttempted, reconciled, safeToApply: before.safeToApply },
  };
  await saveManifest(manifestPath, manifest);
  console.log(`RECONCILE BUSINESS-DATE BACKFILL: source=${digests.length}, completed=${analysis.completed.length}, remainingEligible=${analysis.eligible.length}, missing=${analysis.missing.length}, blocked=${analysis.blocked.length}`);
  console.log(`source canonical sha256=${sourceCanonicalSha256}`);
  console.log(`target canonical sha256=${after.expectedIdsCanonicalSha256}`);
  console.log(`notificationOutbox unchanged=${outboxUnchanged}; count=${outboxAfter.documentCount}; reconciled=${reconciled}`);
  console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
  if (!reconciled) throw new Error("Post-write business-date/outbox reconciliation failed; keep writes frozen");
}

function compare(expected, targetDocuments) {
  const targetById = new Map(targetDocuments.map((document) => [documentIdFromName(document.name), decodeFirestoreFields(document.fields ?? {})]));
  const matched = [];
  const missing = [];
  const conflicts = [];
  for (const digest of expected) {
    const actual = targetById.get(digest.id);
    if (!actual) missing.push(digest);
    else if (stableJson(actual) === stableJson(digest)) matched.push(digest);
    else conflicts.push(digest);
  }
  const actualExpected = expected.map((digest) => targetById.get(digest.id)).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
  return { matched, missing, conflicts, actualExpected };
}

function hashes(records) {
  return records.map((record) => sha256(record.id).slice(0, 16)).sort();
}

async function saveManifest(file, manifest) {
  await atomicWrite(file, `${stableJson(manifest, 2)}\n`, 0o600);
}

async function main() {
  const args = parseCli(process.argv.slice(2), {
    input: "string",
    year: "string",
    format: "string",
    manifest: "string",
    project: "string",
    "batch-size": "string",
    apply: "boolean",
    overwrite: "boolean",
    "backfill-business-date": "boolean",
    "reconcile-only": "boolean",
    help: "boolean",
  });
  if (args.help) return help();
  if (args._.length) throw new Error("Unexpected positional arguments");
  if (!args.input || !args.year) throw new Error("--input and explicit --year are required");
  if (args.apply && args["reconcile-only"]) throw new Error("--apply and --reconcile-only are mutually exclusive");
  if (args.overwrite && !args.apply) throw new Error("--overwrite is only valid with --apply");
  if (args["backfill-business-date"] && args.overwrite) throw new Error("--backfill-business-date never accepts --overwrite");
  const explicitYear = Number(args.year);
  if (!Number.isInteger(explicitYear) || explicitYear < 2000 || explicitYear > 2100) throw new Error("--year must be an integer from 2000 to 2100");
  const project = args.project || process.env.FIREBASE_PROJECT_ID || PROJECT_ID;
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error("Invalid Firebase project id");
  const batchSize = Number(args["batch-size"] ?? 400);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("--batch-size must be 1..500");
  const inputPath = path.resolve(args.input);
  const inputStat = await stat(inputPath);
  if (!inputStat.isFile() || inputStat.size > 50 * 1024 * 1024) throw new Error("Input must be a regular file no larger than 50 MiB");
  const inputBytes = await readFile(inputPath);
  const selectedFormat = (args.format || path.extname(inputPath).slice(1)).toLowerCase();
  const delimiter = selectedFormat === "tsv" || selectedFormat === "tab" ? "\t" : selectedFormat === "csv" ? "," : null;
  if (!delimiter) throw new Error("Input format must be CSV or TSV");
  const rows = parseDelimited(decodeUtf8(inputBytes), delimiter);
  const digests = normalizeDigestRows(rows, explicitYear);
  if (!digests.length) throw new Error("Input contains no digest records");
  const sourceCanonicalSha256 = canonicalHash(digests);
  const manifestPath = path.resolve(args.manifest || DEFAULT_MANIFEST);
  const base = {
    schemaVersion: 1,
    operation: args.apply ? "apply" : args["reconcile-only"] ? "reconcile-only" : "dry-run",
    mode: args["backfill-business-date"] ? "businessDate-backfill" : "full-import",
    projectId: project,
    input: {
      format: selectedFormat,
      bytes: inputBytes.length,
      sha256: sha256(inputBytes),
      rowCount: rows.length,
      documentCount: digests.length,
      canonicalSha256: sourceCanonicalSha256,
    },
    calendarProof: {
      explicitYear,
      timeZone: "Asia/Singapore",
      claimedWeekdayCount: digests.length,
      matchedWeekdayCount: digests.length,
      allMatched: true,
      method: "claimed weekday compared with proleptic Gregorian calendar before UTC+08 conversion",
    },
    safety: {
      explicitApply: Boolean(args.apply),
      overwriteConflicts: Boolean(args.overwrite),
      createsOutboxDocuments: false,
      historicalDeliveryStatus: "legacy_unknown",
      piiExcludedFromManifest: true,
      batchSize,
    },
  };
  const hasAuth = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIRESTORE_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN);
  if (!hasAuth) {
    if (args.apply || args["reconcile-only"]) firestoreToken();
    await saveManifest(manifestPath, { ...base, target: { checked: false }, result: { writesAttempted: 0, reconciled: null } });
    console.log(`DRY RUN: validated ${digests.length} historical digest(s); year=${explicitYear}, weekday matches=${digests.length}/${digests.length}`);
    console.log(`canonical sha256=${sourceCanonicalSha256}; zero writes and zero outbox documents attempted`);
    console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
    return;
  }

  const token = firestoreToken();
  if (args["backfill-business-date"]) {
    await runBusinessDateBackfill({
      args,
      base,
      batchSize,
      digests,
      manifestPath,
      project,
      sourceCanonicalSha256,
      token,
    });
    return;
  }
  let target = await listFirestoreCollection("digests", { project, token });
  let result = compare(digests, target);
  const before = {
    totalDocumentCount: target.length,
    expectedIdCount: digests.length,
    matchedCount: result.matched.length,
    missingCount: result.missing.length,
    conflictCount: result.conflicts.length,
    expectedIdsCanonicalSha256: result.actualExpected.length ? canonicalHash(result.actualExpected) : sha256("[]"),
    missingIdHashes: hashes(result.missing),
    conflictIdHashes: hashes(result.conflicts),
  };
  if (!args.apply) {
    const reconciled = result.missing.length === 0 && result.conflicts.length === 0 && canonicalHash(result.actualExpected) === sourceCanonicalSha256;
    await saveManifest(manifestPath, { ...base, target: { before, after: before }, result: { writesAttempted: 0, reconciled } });
    console.log(`${args["reconcile-only"] ? "RECONCILE" : "DRY RUN"}: source=${digests.length}, target-total=${target.length}, matched=${result.matched.length}, missing=${result.missing.length}, conflicts=${result.conflicts.length}`);
    console.log(`source canonical sha256=${sourceCanonicalSha256}`);
    console.log(`target canonical sha256=${before.expectedIdsCanonicalSha256}`);
    console.log(`reconciled=${reconciled}; zero writes and zero outbox documents attempted`);
    console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
    if (args["reconcile-only"] && !reconciled) process.exitCode = 2;
    return;
  }
  if (result.conflicts.length && !args.overwrite) {
    await saveManifest(manifestPath, { ...base, target: { before }, result: { writesAttempted: 0, reconciled: false, blockedReason: "target-conflicts" } });
    throw new Error(`${result.conflicts.length} digest conflict(s) detected; zero writes attempted. Investigate hashed IDs before authorizing --overwrite`);
  }
  const candidates = [...result.missing, ...(args.overwrite ? result.conflicts : [])];
  let writesAttempted = 0;
  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const batch = candidates.slice(offset, offset + batchSize);
    await batchWriteFirestore(batch.map((digest) => ({
      update: { name: `projects/${project}/databases/(default)/documents/digests/${digest.id}`, fields: encodeFirestoreFields(digest) },
      ...(!result.conflicts.some((conflict) => conflict.id === digest.id) ? { currentDocument: { exists: false } } : {}),
    })), { project, token });
    writesAttempted += batch.length;
    console.log(`Applied digest batch ${Math.floor(offset / batchSize) + 1}: ${batch.length}; cumulative=${writesAttempted}/${candidates.length}`);
  }
  target = await listFirestoreCollection("digests", { project, token });
  result = compare(digests, target);
  const targetSha = result.actualExpected.length ? canonicalHash(result.actualExpected) : sha256("[]");
  const reconciled = result.missing.length === 0 && result.conflicts.length === 0 && targetSha === sourceCanonicalSha256;
  const after = {
    totalDocumentCount: target.length,
    expectedIdCount: digests.length,
    matchedCount: result.matched.length,
    missingCount: result.missing.length,
    conflictCount: result.conflicts.length,
    expectedIdsCanonicalSha256: targetSha,
    missingIdHashes: hashes(result.missing),
    conflictIdHashes: hashes(result.conflicts),
  };
  await saveManifest(manifestPath, { ...base, target: { before, after }, result: { writesAttempted, skippedIdentical: digests.length - candidates.length, reconciled } });
  console.log(`RECONCILE: source=${digests.length}, target-total=${target.length}, matched=${result.matched.length}`);
  console.log(`source canonical sha256=${sourceCanonicalSha256}`);
  console.log(`target canonical sha256=${targetSha}`);
  console.log(`reconciled=${reconciled}; zero outbox documents created`);
  console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
  if (!reconciled) throw new Error("Post-write digest reconciliation failed; keep writes frozen");
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
