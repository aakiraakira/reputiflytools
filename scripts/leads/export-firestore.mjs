#!/usr/bin/env node
import path from "node:path";
import {
  PROJECT_ID,
  REPO_ROOT,
  atomicWrite,
  decodeFirestoreFields,
  documentIdFromName,
  firestoreToken,
  listFirestoreCollection,
  parseCli,
  publicError,
  sha256,
  stableJson,
} from "./ops-lib.mjs";

const DEFAULT_COLLECTIONS = [
  "members",
  "leads",
  "leadFollowUps",
  "digests",
  "notificationOutbox",
  "auditEvents",
  "system",
];
const DEFAULT_OUTPUT = path.join(REPO_ROOT, "scripts/leads/output/firestore-logical-backup.json");

function help() {
  console.log(`Usage:
  node scripts/leads/export-firestore.mjs [--out FILE] [--manifest FILE]
      [--collections members,leads,...] [--manifest-only]

Requires FIRESTORE_ACCESS_TOKEN (or FIRESTORE_EMULATOR_HOST). The logical
backup contains PII, is written mode 0600, and belongs only in an ignored
location. Console output and the separate manifest contain counts/hashes only.`);
}

async function main() {
  const args = parseCli(process.argv.slice(2), {
    out: "string",
    manifest: "string",
    collections: "string",
    project: "string",
    "manifest-only": "boolean",
    help: "boolean",
  });
  if (args.help) return help();
  if (args._.length) throw new Error("Unexpected positional arguments");
  const project = args.project || process.env.FIREBASE_PROJECT_ID || PROJECT_ID;
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error("Invalid Firebase project id");
  const collections = (args.collections ? args.collections.split(",") : DEFAULT_COLLECTIONS)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!collections.length || collections.some((item) => !/^[A-Za-z0-9_-]+$/.test(item))) {
    throw new Error("--collections must be a comma-separated list of root collection IDs");
  }
  if (new Set(collections).size !== collections.length) throw new Error("--collections contains duplicates");
  const token = firestoreToken();

  const exported = {};
  const collectionManifest = {};
  for (const collection of collections) {
    const documents = await listFirestoreCollection(collection, { project, token });
    documents.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const canonicalFields = documents.map((document) => ({
      id: documentIdFromName(document.name),
      fields: decodeFirestoreFields(document.fields ?? {}),
    }));
    const canonicalFieldsSha256 = sha256(stableJson(canonicalFields));
    exported[collection] = documents;
    collectionManifest[collection] = {
      documentCount: documents.length,
      canonicalFieldsSha256,
      // Kept as an alias for older operational tooling. It intentionally
      // excludes server createTime/updateTime so a restore can match.
      canonicalSha256: canonicalFieldsSha256,
      rawEnvelopeSha256: sha256(stableJson(documents)),
    };
    console.log(`[READ] ${collection}: ${documents.length} document(s), canonical fields sha256=${canonicalFieldsSha256}`);
  }

  const backup = {
    schemaVersion: 1,
    kind: "firestore-rest-logical-backup",
    projectId: project,
    databaseId: "(default)",
    exportedAt: new Date().toISOString(),
    collections: exported,
  };
  const backupText = `${stableJson(backup, 2)}\n`;
  const outputPath = path.resolve(args.out || DEFAULT_OUTPUT);
  const manifestPath = path.resolve(args.manifest || `${outputPath}.manifest.json`);
  const manifest = {
    schemaVersion: 1,
    kind: "firestore-rest-logical-backup-manifest",
    projectId: project,
    databaseId: "(default)",
    exportedAt: backup.exportedAt,
    collections: collectionManifest,
    totalDocumentCount: Object.values(collectionManifest).reduce((sum, item) => sum + item.documentCount, 0),
    backupSha256: args["manifest-only"] ? null : sha256(backupText),
    containsPii: false,
  };

  if (!args["manifest-only"]) await atomicWrite(outputPath, backupText, 0o600);
  await atomicWrite(manifestPath, `${stableJson(manifest, 2)}\n`, 0o600);
  if (!args["manifest-only"]) console.log(`PII backup (mode 0600): ${path.relative(REPO_ROOT, outputPath)}`);
  console.log(`PII-free reconciliation manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
