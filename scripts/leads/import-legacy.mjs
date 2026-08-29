#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  PROJECT_ID,
  REPO_ROOT,
  atomicWrite,
  batchWriteFirestore,
  canonicalHash,
  canonicalLeadFromFirestore,
  commitFirestoreWrites,
  decodeFirestoreFields,
  decodeUtf8,
  documentIdFromName,
  encodeFirestoreFields,
  firestoreToken,
  listFirestoreCollection,
  normalizeLeadRows,
  parseCli,
  parseDelimited,
  publicError,
  sha256,
  stableJson,
} from "./ops-lib.mjs";

const DEFAULT_MANIFEST = path.join(REPO_ROOT, "scripts/leads/output/import-manifest.json");

function help() {
  console.log(`Usage:
  node scripts/leads/import-legacy.mjs --input FILE [--manifest FILE]
  node scripts/leads/import-legacy.mjs --input FILE --apply [--batch-size 400]
  node scripts/leads/import-legacy.mjs --input FILE --reconcile-only
  node scripts/leads/import-legacy.mjs --input FILE --sync-active-set [--apply]

Defaults to a no-write dry run. Production writes require --apply and an OAuth
token in FIRESTORE_ACCESS_TOKEN. Use --overwrite only after investigating a
hashed conflict reported by the dry run. --sync-active-set is the guarded,
atomic one-time cutover mode: it creates missing source leads, refreshes only
untouched migration-owned conflicts, and archives only untouched migration-owned
active leads absent from the source. Tokens are never accepted as flags.`);
}

function delimiterFor(input, format) {
  const selected = (format || path.extname(input).slice(1)).toLowerCase();
  if (selected === "csv") return ",";
  if (selected === "tsv" || selected === "tab") return "\t";
  throw new Error("Input format must be .csv/.tsv or supplied as --format csv|tsv");
}

function safeName(project, id) {
  return `projects/${project}/databases/(default)/documents/leads/${id}`;
}

function compareExpected(expected, targetDocuments) {
  const targetById = new Map(targetDocuments.map((document) => [documentIdFromName(document.name), document]));
  const matched = [];
  const missing = [];
  const conflicting = [];
  for (const lead of expected) {
    const target = targetById.get(lead.id);
    if (!target) {
      missing.push(lead);
      continue;
    }
    const actual = canonicalLeadFromFirestore(target);
    if (stableJson(actual) === stableJson(lead)) matched.push(actual);
    else conflicting.push({ lead, actual, target });
  }
  const actualForExpectedIds = expected
    .map((lead) => targetById.get(lead.id))
    .filter(Boolean)
    .map(canonicalLeadFromFirestore)
    .sort((a, b) => a.id.localeCompare(b.id));
  return { targetById, matched, missing, conflicting, actualForExpectedIds };
}

function hashedIds(records) {
  return records.map((record) => sha256(record.pathId ?? record.lead?.id ?? record.id).slice(0, 16)).sort();
}

function idSetHash(ids) {
  return sha256(stableJson([...ids].sort()));
}

function collectionSnapshot(documents) {
  const canonical = documents
    .map((document) => ({
      id: documentIdFromName(document.name),
      fields: decodeFirestoreFields(document.fields ?? {}),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { documentCount: canonical.length, canonicalSha256: sha256(stableJson(canonical)) };
}

function isUntouchedMigrationDocument(document, lead) {
  return Boolean(
    document.updateTime
    && lead.createdBy === "migration"
    && lead.updatedBy === "migration"
    && lead.revision === 1,
  );
}

const LEAD_FIELD_NAMES = new Set([
  "id", "name", "phone", "note", "followUp", "status", "revision",
  "createdAt", "createdBy", "updatedAt", "updatedBy", "archivedAt", "archivedBy",
]);

function validIso(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function targetShapeIssues(document, lead) {
  const pathId = documentIdFromName(document.name);
  const fieldNames = Object.keys(document.fields ?? {});
  const issues = [];
  if (lead.id !== pathId) issues.push("embedded-id-mismatch");
  if (fieldNames.some((field) => !LEAD_FIELD_NAMES.has(field))) issues.push("unexpected-fields");
  for (const field of ["id", "name", "phone", "note", "followUp", "status", "createdAt", "createdBy", "updatedAt", "updatedBy"]) {
    if (typeof lead[field] !== "string") issues.push(`invalid-${field}`);
  }
  if (!Number.isInteger(lead.revision) || lead.revision < 1) issues.push("invalid-revision");
  if (!validIso(lead.createdAt) || !validIso(lead.updatedAt)) issues.push("invalid-timestamp");
  if (lead.status !== "active" && lead.status !== "archived") issues.push("invalid-status");
  const hasArchiveFields = fieldNames.includes("archivedAt") || fieldNames.includes("archivedBy");
  if (lead.status === "active" && hasArchiveFields) issues.push("active-has-archive-fields");
  if (lead.status === "archived" && (!validIso(lead.archivedAt) || typeof lead.archivedBy !== "string")) {
    issues.push("archived-missing-valid-metadata");
  }
  return issues;
}

function assessActiveSet(expected, targetDocuments) {
  const comparison = compareExpected(expected, targetDocuments);
  const expectedIds = new Set(expected.map((lead) => lead.id));
  const decodedTargets = targetDocuments.map((document) => ({
    document,
    pathId: documentIdFromName(document.name),
    lead: canonicalLeadFromFirestore(document),
  })).map((record) => ({ ...record, shapeIssues: targetShapeIssues(record.document, record.lead) }));
  const activeTargets = decodedTargets.filter(({ lead }) => lead.status === "active");
  const staleActive = activeTargets
    .filter(({ pathId }) => !expectedIds.has(pathId))
    .map((record) => ({
      ...record,
      safe: record.shapeIssues.length === 0 && isUntouchedMigrationDocument(record.document, record.lead),
    }));
  const conflicts = comparison.conflicting.map((record) => ({
    ...record,
    pathId: documentIdFromName(record.target.name),
    shapeIssues: targetShapeIssues(record.target, record.actual),
    safe: targetShapeIssues(record.target, record.actual).length === 0
      && isUntouchedMigrationDocument(record.target, record.actual),
  }));
  const relevantTargets = decodedTargets.filter(({ pathId, lead }) => expectedIds.has(pathId) || lead.status === "active");
  const unsafeTargetShapes = relevantTargets.filter(({ shapeIssues }) => shapeIssues.length > 0);
  const unsafeConflicts = conflicts.filter((record) => !record.safe);
  const unsafeStaleActive = staleActive.filter((record) => !record.safe);
  const activeIds = activeTargets.map(({ pathId }) => pathId);
  const reconciled = comparison.missing.length === 0
    && comparison.conflicting.length === 0
    && unsafeTargetShapes.length === 0
    && activeIds.length === expectedIds.size
    && activeIds.every((id) => expectedIds.has(id))
    && canonicalHash(comparison.actualForExpectedIds) === canonicalHash(expected);
  return {
    comparison,
    staleActive,
    conflicts,
    unsafeConflicts,
    unsafeStaleActive,
    unsafeTargetShapes,
    activeIds,
    reconciled,
    safeToApply: unsafeConflicts.length === 0
      && unsafeStaleActive.length === 0
      && unsafeTargetShapes.length === 0,
  };
}

function activeSetEvidence(assessment, expectedCount) {
  return {
    totalDocumentCount: assessment.comparison.targetById.size,
    expectedIdCount: expectedCount,
    activeDocumentCount: assessment.activeIds.length,
    activeIdsCanonicalSha256: idSetHash(assessment.activeIds),
    matchedCount: assessment.comparison.matched.length,
    missingCount: assessment.comparison.missing.length,
    conflictCount: assessment.conflicts.length,
    staleActiveCount: assessment.staleActive.length,
    unsafeConflictCount: assessment.unsafeConflicts.length,
    unsafeStaleActiveCount: assessment.unsafeStaleActive.length,
    unsafeTargetShapeCount: assessment.unsafeTargetShapes.length,
    conflictIdHashes: hashedIds(assessment.conflicts),
    missingIdHashes: hashedIds(assessment.comparison.missing),
    staleActiveIdHashes: hashedIds(assessment.staleActive),
    unsafeTargetShapeIdHashes: hashedIds(assessment.unsafeTargetShapes),
    safeToApply: assessment.safeToApply,
  };
}

async function writeManifest(file, manifest) {
  await atomicWrite(file, `${stableJson(manifest, 2)}\n`, 0o600);
}

async function main() {
  const args = parseCli(process.argv.slice(2), {
    input: "string",
    format: "string",
    manifest: "string",
    project: "string",
    "batch-size": "string",
    apply: "boolean",
    overwrite: "boolean",
    "sync-active-set": "boolean",
    "reconcile-only": "boolean",
    help: "boolean",
  });
  if (args.help) return help();
  if (args._.length) throw new Error("Unexpected positional arguments");
  if (!args.input) throw new Error("--input is required");
  if (args.apply && args["reconcile-only"]) throw new Error("--apply and --reconcile-only are mutually exclusive");
  if (args.overwrite && !args.apply) throw new Error("--overwrite is only valid with --apply");
  if (args.overwrite && args["sync-active-set"]) throw new Error("--overwrite and --sync-active-set are mutually exclusive");

  const project = args.project || process.env.FIREBASE_PROJECT_ID || PROJECT_ID;
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error("Invalid Firebase project id");
  const batchSize = Number(args["batch-size"] ?? 400);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("--batch-size must be an integer from 1 to 500");
  const inputPath = path.resolve(args.input);
  const inputStat = await stat(inputPath);
  if (!inputStat.isFile()) throw new Error("--input must point to a regular file");
  if (inputStat.size > 50 * 1024 * 1024) throw new Error("Input exceeds the 50 MiB safety limit");
  const inputBytes = await readFile(inputPath);
  const rows = parseDelimited(decodeUtf8(inputBytes), delimiterFor(inputPath, args.format));
  const leads = normalizeLeadRows(rows);
  if (!leads.length) throw new Error("Input contains no lead records");
  if (args["sync-active-set"]) {
    const nonActiveCount = leads.filter((lead) => lead.status !== "active").length;
    if (nonActiveCount) {
      throw new Error(`--sync-active-set requires an active-only source; found ${nonActiveCount} non-active record(s); zero writes attempted`);
    }
  }

  const manifestPath = path.resolve(args.manifest || DEFAULT_MANIFEST);
  const sourceCanonicalSha256 = canonicalHash(leads);
  const baseManifest = {
    schemaVersion: 1,
    operation: args.apply ? "apply" : args["reconcile-only"] ? "reconcile-only" : "dry-run",
    projectId: project,
    input: {
      format: path.extname(inputPath).slice(1).toLowerCase() || args.format,
      bytes: inputBytes.length,
      sha256: sha256(inputBytes),
      rowCount: rows.length,
      documentCount: leads.length,
      canonicalSha256: sourceCanonicalSha256,
    },
    safety: {
      explicitApply: Boolean(args.apply),
      overwriteConflicts: Boolean(args.overwrite),
      syncActiveSet: Boolean(args["sync-active-set"]),
      batchSize,
      piiExcludedFromManifest: true,
    },
  };

  const hasFirestoreAuth = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIRESTORE_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN,
  );
  if (!hasFirestoreAuth) {
    if (args.apply || args["reconcile-only"]) firestoreToken();
    const manifest = { ...baseManifest, target: { checked: false }, result: { writesAttempted: 0, reconciled: null } };
    await writeManifest(manifestPath, manifest);
    console.log(`DRY RUN: validated ${leads.length} source document(s); canonical sha256=${sourceCanonicalSha256}`);
    console.log("Target not checked (no FIRESTORE_ACCESS_TOKEN); zero writes attempted.");
    console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
    return;
  }

  const token = firestoreToken();
  let targetDocuments = await listFirestoreCollection("leads", { project, token });
  let comparison = compareExpected(leads, targetDocuments);
  const before = {
    checked: true,
    totalDocumentCount: targetDocuments.length,
    expectedIdCount: leads.length,
    matchedCount: comparison.matched.length,
    missingCount: comparison.missing.length,
    conflictCount: comparison.conflicting.length,
    expectedIdsCanonicalSha256: comparison.actualForExpectedIds.length
      ? canonicalHash(comparison.actualForExpectedIds)
      : sha256("[]"),
    conflictIdHashes: hashedIds(comparison.conflicting),
    missingIdHashes: hashedIds(comparison.missing),
  };

  if (args["sync-active-set"]) {
    let assessment = assessActiveSet(leads, targetDocuments);
    const activeBefore = activeSetEvidence(assessment, leads.length);
    if (!args.apply) {
      const manifest = {
        ...baseManifest,
        target: { before: activeBefore, after: activeBefore },
        result: {
          writesAttempted: 0,
          reconciled: assessment.reconciled,
          safeToApply: assessment.safeToApply,
        },
      };
      await writeManifest(manifestPath, manifest);
      console.log(`${args["reconcile-only"] ? "RECONCILE" : "SYNC DRY RUN"}: source=${leads.length}, target-total=${targetDocuments.length}, active=${assessment.activeIds.length}, matched=${assessment.comparison.matched.length}, missing=${assessment.comparison.missing.length}, conflicts=${assessment.conflicts.length}, stale-active=${assessment.staleActive.length}`);
      console.log(`safeToApply=${assessment.safeToApply}; reconciled=${assessment.reconciled}; zero writes attempted`);
      console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
      if (args["reconcile-only"] && !assessment.reconciled) process.exitCode = 2;
      return;
    }

    if (!assessment.safeToApply) {
      const manifest = {
        ...baseManifest,
        target: { before: activeBefore },
        result: {
          writesAttempted: 0,
          reconciled: false,
          safeToApply: false,
          blockedReason: "non-migration-or-modified-target",
        },
      };
      await writeManifest(manifestPath, manifest);
      throw new Error(`Guarded active-set sync blocked by ${assessment.unsafeConflicts.length} unsafe conflict(s), ${assessment.unsafeStaleActive.length} unsafe stale active document(s), and ${assessment.unsafeTargetShapes.length} malformed target document(s); zero writes attempted`);
    }

    const operationAt = new Date().toISOString();
    const writes = [
      ...assessment.comparison.missing.map((lead) => ({
        update: { name: safeName(project, lead.id), fields: encodeFirestoreFields(lead) },
        currentDocument: { exists: false },
      })),
      ...assessment.conflicts.map(({ lead, target }) => ({
        update: { name: safeName(project, lead.id), fields: encodeFirestoreFields(lead) },
        currentDocument: { updateTime: target.updateTime },
      })),
      ...assessment.staleActive.map(({ lead, document, pathId }) => {
        const archived = {
          ...lead,
          status: "archived",
          revision: lead.revision + 1,
          updatedAt: operationAt,
          updatedBy: "migration",
          archivedAt: operationAt,
          archivedBy: "migration",
        };
        return {
          update: { name: safeName(project, pathId), fields: encodeFirestoreFields(archived) },
          currentDocument: { updateTime: document.updateTime },
        };
      }),
    ];
    if (writes.length > 500) {
      throw new Error(`Guarded active-set sync requires ${writes.length} writes; the atomic safety limit is 500`);
    }

    const [auditBeforeDocuments, outboxBeforeDocuments] = await Promise.all([
      listFirestoreCollection("auditEvents", { project, token }),
      listFirestoreCollection("notificationOutbox", { project, token }),
    ]);
    const sideEffectsBefore = {
      auditEvents: collectionSnapshot(auditBeforeDocuments),
      notificationOutbox: collectionSnapshot(outboxBeforeDocuments),
    };
    await commitFirestoreWrites(writes, { project, token });

    const [afterDocuments, auditAfterDocuments, outboxAfterDocuments] = await Promise.all([
      listFirestoreCollection("leads", { project, token }),
      listFirestoreCollection("auditEvents", { project, token }),
      listFirestoreCollection("notificationOutbox", { project, token }),
    ]);
    assessment = assessActiveSet(leads, afterDocuments);
    const activeAfter = activeSetEvidence(assessment, leads.length);
    const sideEffectsAfter = {
      auditEvents: collectionSnapshot(auditAfterDocuments),
      notificationOutbox: collectionSnapshot(outboxAfterDocuments),
    };
    const sideEffectsUnchanged = stableJson(sideEffectsBefore) === stableJson(sideEffectsAfter);
    const reconciled = assessment.reconciled && sideEffectsUnchanged;
    const manifest = {
      ...baseManifest,
      target: { before: activeBefore, after: activeAfter },
      sideEffects: { before: sideEffectsBefore, after: sideEffectsAfter, unchanged: sideEffectsUnchanged },
      result: {
        writesAttempted: writes.length,
        created: activeBefore.missingCount,
        refreshed: activeBefore.conflictCount,
        archived: activeBefore.staleActiveCount,
        reconciled,
        safeToApply: true,
        atomicCommit: true,
      },
    };
    await writeManifest(manifestPath, manifest);
    console.log(`SYNC RECONCILE: source=${leads.length}, target-total=${afterDocuments.length}, active=${assessment.activeIds.length}, created=${activeBefore.missingCount}, refreshed=${activeBefore.conflictCount}, archived=${activeBefore.staleActiveCount}`);
    console.log(`audit/outbox unchanged=${sideEffectsUnchanged}; reconciled=${reconciled}`);
    console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
    if (!reconciled) throw new Error("Post-sync active-set reconciliation failed; freeze writes and follow docs/leads-recovery.md");
    return;
  }

  if (!args.apply) {
    const reconciled = comparison.missing.length === 0
      && comparison.conflicting.length === 0
      && canonicalHash(comparison.actualForExpectedIds) === sourceCanonicalSha256;
    const manifest = { ...baseManifest, target: { before, after: before }, result: { writesAttempted: 0, reconciled } };
    await writeManifest(manifestPath, manifest);
    console.log(`${args["reconcile-only"] ? "RECONCILE" : "DRY RUN"}: source=${leads.length}, target-total=${targetDocuments.length}, matched=${comparison.matched.length}, missing=${comparison.missing.length}, conflicts=${comparison.conflicting.length}`);
    console.log(`source canonical sha256=${sourceCanonicalSha256}`);
    console.log(`target canonical sha256=${before.expectedIdsCanonicalSha256}`);
    console.log(`reconciled=${reconciled}; zero writes attempted`);
    console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
    if (args["reconcile-only"] && !reconciled) process.exitCode = 2;
    return;
  }

  if (comparison.conflicting.length && !args.overwrite) {
    const manifest = {
      ...baseManifest,
      target: { before },
      result: { writesAttempted: 0, reconciled: false, blockedReason: "target-conflicts" },
    };
    await writeManifest(manifestPath, manifest);
    throw new Error(`${comparison.conflicting.length} target conflict(s) detected; zero writes attempted. Investigate hashed IDs in the manifest, then rerun with --overwrite only if approved`);
  }

  const candidates = [
    ...comparison.missing.map((lead) => ({ lead, createOnly: true })),
    ...(args.overwrite ? comparison.conflicting.map(({ lead }) => ({ lead, createOnly: false })) : []),
  ];
  let writesAttempted = 0;
  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const batch = candidates.slice(offset, offset + batchSize);
    const writes = batch.map(({ lead, createOnly }) => ({
      update: { name: safeName(project, lead.id), fields: encodeFirestoreFields(lead) },
      ...(createOnly ? { currentDocument: { exists: false } } : {}),
    }));
    await batchWriteFirestore(writes, { project, token });
    writesAttempted += writes.length;
    console.log(`Applied batch ${Math.floor(offset / batchSize) + 1}: ${writes.length} write(s); cumulative=${writesAttempted}/${candidates.length}`);
  }

  targetDocuments = await listFirestoreCollection("leads", { project, token });
  comparison = compareExpected(leads, targetDocuments);
  const targetCanonicalSha256 = comparison.actualForExpectedIds.length
    ? canonicalHash(comparison.actualForExpectedIds)
    : sha256("[]");
  const reconciled = comparison.missing.length === 0
    && comparison.conflicting.length === 0
    && targetCanonicalSha256 === sourceCanonicalSha256;
  const after = {
    checked: true,
    totalDocumentCount: targetDocuments.length,
    expectedIdCount: leads.length,
    matchedCount: comparison.matched.length,
    missingCount: comparison.missing.length,
    conflictCount: comparison.conflicting.length,
    expectedIdsCanonicalSha256: targetCanonicalSha256,
    conflictIdHashes: hashedIds(comparison.conflicting),
    missingIdHashes: hashedIds(comparison.missing),
  };
  const manifest = {
    ...baseManifest,
    target: { before, after },
    result: { writesAttempted, skippedIdentical: leads.length - candidates.length, reconciled },
  };
  await writeManifest(manifestPath, manifest);
  console.log(`RECONCILE: source=${leads.length}, target-total=${targetDocuments.length}, matched=${comparison.matched.length}`);
  console.log(`source canonical sha256=${sourceCanonicalSha256}`);
  console.log(`target canonical sha256=${targetCanonicalSha256}`);
  console.log(`reconciled=${reconciled}`);
  console.log(`PII-free manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
  if (!reconciled) throw new Error("Post-write reconciliation failed; freeze writes and follow docs/leads-recovery.md");
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
