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

Defaults to a no-write dry run. Production writes require --apply and an OAuth
token in FIRESTORE_ACCESS_TOKEN. Use --overwrite only after investigating a
hashed conflict reported by the dry run. Tokens are never accepted as flags.`);
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
    else conflicting.push({ lead, actual });
  }
  const actualForExpectedIds = expected
    .map((lead) => targetById.get(lead.id))
    .filter(Boolean)
    .map(canonicalLeadFromFirestore)
    .sort((a, b) => a.id.localeCompare(b.id));
  return { targetById, matched, missing, conflicting, actualForExpectedIds };
}

function hashedIds(records) {
  return records.map((record) => sha256(record.lead?.id ?? record.id).slice(0, 16)).sort();
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
    "reconcile-only": "boolean",
    help: "boolean",
  });
  if (args.help) return help();
  if (args._.length) throw new Error("Unexpected positional arguments");
  if (!args.input) throw new Error("--input is required");
  if (args.apply && args["reconcile-only"]) throw new Error("--apply and --reconcile-only are mutually exclusive");
  if (args.overwrite && !args.apply) throw new Error("--overwrite is only valid with --apply");

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
