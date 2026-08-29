import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { decodeFirestoreFields, encodeFirestoreFields, REPO_ROOT, sha256 } from "../ops-lib.mjs";

function runNode(arguments_, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, arguments_, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function startFirestoreStub() {
  const collections = new Map();
  const commits = [];
  let updateSequence = 0;
  const nextUpdateTime = () => new Date(Date.UTC(2030, 0, 1, 0, 0, 0, updateSequence++)).toISOString();
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://stub.invalid");
    const listMatch = decodeURIComponent(url.pathname).match(/\/documents\/([A-Za-z0-9_-]+)$/);
    if (request.method === "GET" && listMatch) {
      const collection = collections.get(listMatch[1]) ?? new Map();
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ documents: [...collection.values()] }));
      return;
    }
    if (request.method === "POST" && decodeURIComponent(url.pathname).endsWith("/documents:batchWrite")) {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body);
      const statuses = [];
      for (const write of parsed.writes ?? []) {
        const match = String(write.update?.name ?? "").match(/\/documents\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/);
        if (!match) {
          statuses.push({ code: 3 });
          continue;
        }
        const [, collectionName, id] = match;
        if (!collections.has(collectionName)) collections.set(collectionName, new Map());
        const collection = collections.get(collectionName);
        const previous = collection.get(id);
        if (write.currentDocument?.exists === false && previous) {
          statuses.push({ code: 6 });
          continue;
        }
        if (write.currentDocument?.updateTime && previous?.updateTime !== write.currentDocument.updateTime) {
          statuses.push({ code: 9 });
          continue;
        }
        const fieldPaths = write.updateMask?.fieldPaths;
        const fields = Array.isArray(fieldPaths)
          ? {
              ...(previous?.fields ?? {}),
              ...Object.fromEntries(fieldPaths.map((field) => [field, write.update.fields[field]])),
            }
          : write.update.fields;
        collection.set(id, {
          name: `projects/reputifly-leads-2/databases/(default)/documents/${collectionName}/${id}`,
          fields,
          updateTime: nextUpdateTime(),
        });
        statuses.push({ code: 0 });
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: statuses, writeResults: statuses.map(() => ({})) }));
      return;
    }
    if (request.method === "POST" && decodeURIComponent(url.pathname).endsWith("/documents:commit")) {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body);
      const pending = [];
      for (const write of parsed.writes ?? []) {
        const match = String(write.update?.name ?? "").match(/\/documents\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/);
        if (!match) {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: { code: 400 } }));
          return;
        }
        const [, collectionName, id] = match;
        const collection = collections.get(collectionName) ?? new Map();
        const previous = collection.get(id);
        if ((write.currentDocument?.exists === false && previous)
          || (write.currentDocument?.updateTime && previous?.updateTime !== write.currentDocument.updateTime)) {
          response.writeHead(409, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: { code: 409 } }));
          return;
        }
        pending.push({ write, collectionName, id, previous });
      }
      for (const { write, collectionName, id, previous } of pending) {
        if (!collections.has(collectionName)) collections.set(collectionName, new Map());
        const fieldPaths = write.updateMask?.fieldPaths;
        const fields = Array.isArray(fieldPaths)
          ? {
              ...(previous?.fields ?? {}),
              ...Object.fromEntries(fieldPaths.map((field) => [field, write.update.fields[field]])),
            }
          : write.update.fields;
        collections.get(collectionName).set(id, {
          name: `projects/reputifly-leads-2/databases/(default)/documents/${collectionName}/${id}`,
          fields,
          updateTime: nextUpdateTime(),
        });
      }
      commits.push(parsed.writes ?? []);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ commitTime: nextUpdateTime(), writeResults: pending.map(() => ({})) }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: 404 } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    collections,
    commits,
    host: `127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("lead and digest importers apply, re-read, and reconcile without an outbox", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "rfly-migration-integration-"));
  const firestore = await startFirestoreStub();
  try {
    const leadInput = path.join(temporaryDirectory, "leads.csv");
    const digestInput = path.join(temporaryDirectory, "digests.tsv");
    const leadManifest = path.join(temporaryDirectory, "lead-manifest.json");
    const digestManifest = path.join(temporaryDirectory, "digest-manifest.json");
    const backupPath = path.join(temporaryDirectory, "logical-backup.json");
    const backupManifest = path.join(temporaryDirectory, "logical-backup.manifest.json");
    await writeFile(
      leadInput,
      "id,name,phone,note,followUp,createdAt,updatedAt\nlegacy_one,Alex,91234567,Call again,8/1/2026,2026-07-20T01:00:00Z,2026-07-21T01:00:00Z\n",
    );
    await writeFile(
      digestInput,
      "Date\tNew Leads\tSamples\tFollow-Ups\tDumped\tQuestions / Notes\tSent At\tFiled By\nMon 20 Jul\t2\t1\t• 91234567 — 2nd, sample deployed\t• Not interested\tReview quote\t9:05\tLegacy User\n",
    );
    const environment = { FIRESTORE_EMULATOR_HOST: firestore.host };
    const lead = await runNode([
      "scripts/leads/import-legacy.mjs", "--input", leadInput, "--apply", "--manifest", leadManifest,
    ], environment);
    assert.equal(lead.code, 0, lead.stderr);
    assert.match(lead.stdout, /reconciled=true/);
    const digest = await runNode([
      "scripts/leads/import-digests.mjs", "--input", digestInput, "--year", "2026", "--apply", "--manifest", digestManifest,
    ], environment);
    assert.equal(digest.code, 0, digest.stderr);
    assert.match(digest.stdout, /reconciled=true; zero outbox documents created/);

    assert.equal(firestore.collections.get("leads")?.size, 1);
    assert.equal(firestore.collections.get("digests")?.size, 1);
    assert.equal(firestore.collections.has("notificationOutbox"), false);
    const leadFields = [...firestore.collections.get("leads").values()][0].fields;
    assert.equal(leadFields.followUp.stringValue, "2026-08-01");
    const digestFields = [...firestore.collections.get("digests").values()][0].fields;
    assert.equal(digestFields.deliveryStatus.stringValue, "legacy_unknown");
    assert.equal(digestFields.createdBy.stringValue, "migration");
    assert.equal(digestFields.businessDate.stringValue, "2026-07-20");
    const phoneClaimId = `v1_${sha256("6591234567")}`;
    firestore.collections.set("activePhoneClaims", new Map([
      [phoneClaimId, firestoreDocument(
        "activePhoneClaims",
        phoneClaimId,
        { leadId: "legacy_one" },
        "2029-01-07T00:00:00.000Z",
      )],
    ]));

    const backup = await runNode([
      "scripts/leads/export-firestore.mjs", "--out", backupPath, "--manifest", backupManifest,
    ], environment);
    assert.equal(backup.code, 0, backup.stderr);
    const backupRecord = JSON.parse(await readFile(backupPath, "utf8"));
    const backupEvidence = JSON.parse(await readFile(backupManifest, "utf8"));
    assert.equal(backupRecord.collections.leads.length, 1);
    assert.equal(backupRecord.collections.digests.length, 1);
    assert.ok(Object.hasOwn(backupRecord.collections, "leadFollowUps"));
    assert.equal(backupRecord.collections.activePhoneClaims.length, 1);
    assert.deepEqual(
      decodeFirestoreFields(backupRecord.collections.activePhoneClaims[0].fields),
      { leadId: "legacy_one" },
    );
    assert.equal(backupEvidence.collections.leads.documentCount, 1);
    assert.equal(backupEvidence.collections.digests.documentCount, 1);
    assert.ok(Object.hasOwn(backupEvidence.collections, "leadFollowUps"));
    assert.equal(backupEvidence.collections.activePhoneClaims.documentCount, 1);
    assert.match(backupEvidence.collections.activePhoneClaims.canonicalFieldsSha256, /^[a-f0-9]{64}$/);
    assert.match(backupEvidence.collections.leads.canonicalFieldsSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      backupEvidence.collections.leads.canonicalSha256,
      backupEvidence.collections.leads.canonicalFieldsSha256,
    );
    assert.match(backupEvidence.collections.leads.rawEnvelopeSha256, /^[a-f0-9]{64}$/);
    assert.equal(backupEvidence.containsPii, false);
    assert.doesNotMatch(JSON.stringify(backupEvidence), /Alex|91234567|Legacy User|Review quote/);

    // Firestore assigns new server metadata during restore. Recovery hashes
    // must still match when document IDs and decoded fields are identical.
    const originalCanonical = backupEvidence.collections.leads.canonicalFieldsSha256;
    const originalRaw = backupEvidence.collections.leads.rawEnvelopeSha256;
    const originalClaimCanonical = backupEvidence.collections.activePhoneClaims.canonicalFieldsSha256;
    const originalClaimRaw = backupEvidence.collections.activePhoneClaims.rawEnvelopeSha256;
    [...firestore.collections.get("leads").values()][0].updateTime = "2040-01-01T00:00:00.000Z";
    [...firestore.collections.get("activePhoneClaims").values()][0].updateTime = "2040-01-02T00:00:00.000Z";
    const metadataOnlyManifest = path.join(temporaryDirectory, "logical-backup.metadata-only.manifest.json");
    const metadataOnly = await runNode([
      "scripts/leads/export-firestore.mjs", "--manifest-only", "--manifest", metadataOnlyManifest,
    ], environment);
    assert.equal(metadataOnly.code, 0, metadataOnly.stderr);
    const metadataEvidence = JSON.parse(await readFile(metadataOnlyManifest, "utf8"));
    assert.equal(metadataEvidence.collections.leads.canonicalFieldsSha256, originalCanonical);
    assert.notEqual(metadataEvidence.collections.leads.rawEnvelopeSha256, originalRaw);
    assert.equal(
      metadataEvidence.collections.activePhoneClaims.canonicalFieldsSha256,
      originalClaimCanonical,
    );
    assert.notEqual(metadataEvidence.collections.activePhoneClaims.rawEnvelopeSha256, originalClaimRaw);

    const importedDigest = [...firestore.collections.get("digests").values()][0];
    delete importedDigest.fields.businessDate;
    const backfillDryRunManifest = path.join(temporaryDirectory, "digest-backfill-dry-run.json");
    const backfillDryRun = await runNode([
      "scripts/leads/import-digests.mjs", "--input", digestInput, "--year", "2026",
      "--backfill-business-date", "--manifest", backfillDryRunManifest,
    ], environment);
    assert.equal(backfillDryRun.code, 0, backfillDryRun.stderr);
    assert.match(backfillDryRun.stdout, /eligible=1/);
    assert.match(backfillDryRun.stdout, /safeToApply=true/);
    assert.equal(Object.hasOwn(importedDigest.fields, "businessDate"), false, "dry run attempts zero writes");

    const backfillApplyManifest = path.join(temporaryDirectory, "digest-backfill-apply.json");
    const backfillApply = await runNode([
      "scripts/leads/import-digests.mjs", "--input", digestInput, "--year", "2026",
      "--backfill-business-date", "--apply", "--manifest", backfillApplyManifest,
    ], environment);
    assert.equal(backfillApply.code, 0, backfillApply.stderr);
    assert.match(backfillApply.stdout, /notificationOutbox unchanged=true/);
    assert.match(backfillApply.stdout, /reconciled=true/);
    const afterBackfill = [...firestore.collections.get("digests").values()][0];
    assert.equal(afterBackfill.fields.businessDate.stringValue, "2026-07-20");
    assert.equal(afterBackfill.fields.payloadHash.stringValue, digestFields.payloadHash.stringValue, "masked patch preserves all other digest fields");
    const backfillEvidence = JSON.parse(await readFile(backfillApplyManifest, "utf8"));
    assert.equal(backfillEvidence.result.writesAttempted, 1);
    assert.equal(backfillEvidence.result.reconciled, true);
    assert.equal(backfillEvidence.notificationOutbox.unchanged, true);
    assert.doesNotMatch(JSON.stringify(backfillEvidence), /91234567|Legacy User|Review quote/);

    // A document that differs beyond the absent businessDate must never be
    // coerced through this narrow repair path.
    delete afterBackfill.fields.businessDate;
    afterBackfill.fields.notes = { stringValue: "Concurrent synthetic change" };
    const beforeBlockedUpdateTime = afterBackfill.updateTime;
    const blockedManifest = path.join(temporaryDirectory, "digest-backfill-blocked.json");
    const blocked = await runNode([
      "scripts/leads/import-digests.mjs", "--input", digestInput, "--year", "2026",
      "--backfill-business-date", "--apply", "--manifest", blockedManifest,
    ], environment);
    assert.equal(blocked.code, 1);
    assert.match(blocked.stderr, /differ beyond the absent businessDate/);
    assert.equal(afterBackfill.updateTime, beforeBlockedUpdateTime, "blocked backfill performs zero writes");
    assert.equal(Object.hasOwn(afterBackfill.fields, "businessDate"), false);
    const blockedEvidence = JSON.parse(await readFile(blockedManifest, "utf8"));
    assert.equal(blockedEvidence.result.writesAttempted, 0);
    assert.equal(blockedEvidence.result.safeToApply, false);

    for (const manifestFile of [leadManifest, digestManifest]) {
      const manifest = await readFile(manifestFile, "utf8");
      assert.doesNotMatch(manifest, /Alex|91234567|Legacy User|Review quote/);
      assert.equal(JSON.parse(manifest).result.reconciled, true);
    }
  } finally {
    await firestore.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

function firestoreDocument(collection, id, fields, updateTime) {
  return {
    name: `projects/reputifly-leads-2/databases/(default)/documents/${collection}/${id}`,
    fields: encodeFirestoreFields(fields),
    updateTime,
  };
}

function migrationLead(id, overrides = {}) {
  return {
    id,
    name: "Synthetic lead",
    phone: "90000000",
    note: "Current note",
    followUp: "2026-08-01",
    status: "active",
    revision: 1,
    createdAt: "2026-07-20T01:00:00.000Z",
    createdBy: "migration",
    updatedAt: "2026-07-21T01:00:00.000Z",
    updatedBy: "migration",
    ...overrides,
  };
}

test("guarded active-set sync is atomic, archives only untouched migration rows, and leaves audit/outbox unchanged", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "rfly-active-set-sync-"));
  const firestore = await startFirestoreStub();
  try {
    const input = path.join(temporaryDirectory, "current.csv");
    const dryManifest = path.join(temporaryDirectory, "dry.json");
    const applyManifest = path.join(temporaryDirectory, "apply.json");
    await writeFile(input, [
      "id,name,phone,note,followUp,createdAt,updatedAt",
      "legacy_match,Synthetic lead,90000000,Current note,8/1/2026,2026-07-20T01:00:00.000Z,2026-07-21T01:00:00.000Z",
      "legacy_refresh,Synthetic lead,90000000,Current note,8/1/2026,2026-07-20T01:00:00.000Z,2026-07-21T01:00:00.000Z",
      "legacy_new,Synthetic lead,90000000,Current note,8/1/2026,2026-07-20T01:00:00.000Z,2026-07-21T01:00:00.000Z",
      "",
    ].join("\n"));
    const leads = new Map([
      ["legacy_match", firestoreDocument("leads", "legacy_match", migrationLead("legacy_match"), "2029-01-01T00:00:00.000Z")],
      ["legacy_refresh", firestoreDocument("leads", "legacy_refresh", migrationLead("legacy_refresh", { note: "Outdated note" }), "2029-01-02T00:00:00.000Z")],
      ["legacy_stale", firestoreDocument("leads", "legacy_stale", migrationLead("legacy_stale", {
        createdAt: "2026-07-20T01:00:00Z",
        updatedAt: "2026-07-21T09:00:00+08:00",
      }), "2029-01-03T00:00:00.000Z")],
      ["legacy_old_archive", firestoreDocument("leads", "legacy_old_archive", migrationLead("legacy_old_archive", {
        status: "archived",
        archivedAt: "2026-07-22T01:00:00.000Z",
        archivedBy: "migration",
      }), "2029-01-04T00:00:00.000Z")],
    ]);
    firestore.collections.set("leads", leads);
    firestore.collections.set("auditEvents", new Map([
      ["sentinel", firestoreDocument("auditEvents", "sentinel", { kind: "sentinel" }, "2029-01-05T00:00:00.000Z")],
    ]));
    firestore.collections.set("notificationOutbox", new Map([
      ["sentinel", firestoreDocument("notificationOutbox", "sentinel", { status: "delivered" }, "2029-01-06T00:00:00.000Z")],
    ]));
    const environment = { FIRESTORE_EMULATOR_HOST: firestore.host };

    const dry = await runNode([
      "scripts/leads/import-legacy.mjs", "--input", input, "--sync-active-set", "--manifest", dryManifest,
    ], environment);
    assert.equal(dry.code, 0, dry.stderr);
    assert.match(dry.stdout, /missing=1, conflicts=1, stale-active=1/);
    assert.match(dry.stdout, /safeToApply=true/);
    assert.equal(firestore.commits.length, 0, "dry run performs no writes");
    const dryEvidence = JSON.parse(await readFile(dryManifest, "utf8"));
    assert.equal(dryEvidence.result.writesAttempted, 0);
    assert.equal(dryEvidence.result.safeToApply, true);

    const apply = await runNode([
      "scripts/leads/import-legacy.mjs", "--input", input, "--sync-active-set", "--apply", "--manifest", applyManifest,
    ], environment);
    assert.equal(apply.code, 0, apply.stderr);
    assert.match(apply.stdout, /active=3, created=1, refreshed=1, archived=1/);
    assert.match(apply.stdout, /audit\/outbox unchanged=true; reconciled=true/);
    assert.equal(firestore.commits.length, 1, "all mutations use one atomic commit");
    assert.equal(firestore.commits[0].length, 3);
    assert.equal(firestore.commits[0].filter((write) => write.currentDocument?.exists === false).length, 1);
    assert.equal(firestore.commits[0].filter((write) => write.currentDocument?.updateTime).length, 2);

    const active = [...leads.values()]
      .map((document) => decodeFirestoreFields(document.fields))
      .filter((lead) => lead.status === "active")
      .map((lead) => lead.id)
      .sort();
    assert.deepEqual(active, ["legacy_match", "legacy_new", "legacy_refresh"]);
    const stale = decodeFirestoreFields(leads.get("legacy_stale").fields);
    assert.equal(stale.status, "archived");
    assert.equal(stale.revision, 2);
    assert.equal(stale.archivedBy, "migration");
    assert.equal(firestore.collections.get("auditEvents").size, 1);
    assert.equal(firestore.collections.get("notificationOutbox").size, 1);

    const evidence = JSON.parse(await readFile(applyManifest, "utf8"));
    assert.deepEqual(evidence.result, {
      archived: 1,
      atomicCommit: true,
      created: 1,
      reconciled: true,
      refreshed: 1,
      safeToApply: true,
      writesAttempted: 3,
    });
    assert.equal(evidence.sideEffects.unchanged, true);
    assert.doesNotMatch(JSON.stringify(evidence), /Synthetic lead|90000000|Current note|Outdated note/);

    const reconcile = await runNode([
      "scripts/leads/import-legacy.mjs", "--input", input, "--sync-active-set", "--reconcile-only",
      "--manifest", path.join(temporaryDirectory, "reconcile.json"),
    ], environment);
    assert.equal(reconcile.code, 0, reconcile.stderr);
    assert.match(reconcile.stdout, /reconciled=true; zero writes attempted/);
    assert.equal(firestore.commits.length, 1);
  } finally {
    await firestore.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("guarded active-set sync blocks every write when a real or modified V2 row would be replaced", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "rfly-active-set-block-"));
  const firestore = await startFirestoreStub();
  try {
    const input = path.join(temporaryDirectory, "current.csv");
    const manifest = path.join(temporaryDirectory, "blocked.json");
    await writeFile(input, [
      "id,name,phone,note,followUp,createdAt,updatedAt",
      "legacy_changed,Synthetic lead,90000000,Current note,8/1/2026,2026-07-20T01:00:00.000Z,2026-07-21T01:00:00.000Z",
      "legacy_missing,Synthetic lead,90000000,Current note,8/1/2026,2026-07-20T01:00:00.000Z,2026-07-21T01:00:00.000Z",
      "",
    ].join("\n"));
    firestore.collections.set("leads", new Map([
      ["legacy_changed", firestoreDocument("leads", "legacy_changed", migrationLead("legacy_changed", {
        note: "User edit",
        revision: 2,
        updatedBy: "real-user-uid",
      }), "2029-01-01T00:00:00.000Z")],
      ["legacy_stale", firestoreDocument("leads", "legacy_stale", migrationLead("legacy_stale", {
        revision: 3,
        updatedBy: "real-user-uid",
      }), "2029-01-02T00:00:00.000Z")],
    ]));
    const blocked = await runNode([
      "scripts/leads/import-legacy.mjs", "--input", input, "--sync-active-set", "--apply", "--manifest", manifest,
    ], { FIRESTORE_EMULATOR_HOST: firestore.host });
    assert.equal(blocked.code, 1);
    assert.match(blocked.stderr, /blocked by 1 unsafe conflict\(s\), 1 unsafe stale active document\(s\), and 0 malformed target document\(s\); zero writes attempted/);
    assert.equal(firestore.commits.length, 0);
    assert.equal(firestore.collections.get("leads").size, 2, "missing source row was not partially created");
    const evidence = JSON.parse(await readFile(manifest, "utf8"));
    assert.equal(evidence.result.writesAttempted, 0);
    assert.equal(evidence.result.safeToApply, false);
    assert.equal(evidence.result.blockedReason, "non-migration-or-modified-target");
    assert.doesNotMatch(JSON.stringify(evidence), /Synthetic lead|90000000|Current note|User edit/);

    const archivedInput = path.join(temporaryDirectory, "archived.csv");
    await writeFile(archivedInput, [
      "id,name,phone,note,followUp,status,removedAt,createdAt,updatedAt",
      "legacy_archived,Synthetic lead,90000000,Current note,8/1/2026,archived,2026-07-22T01:00:00.000Z,2026-07-20T01:00:00.000Z,2026-07-21T01:00:00.000Z",
      "",
    ].join("\n"));
    const archivedSource = await runNode([
      "scripts/leads/import-legacy.mjs", "--input", archivedInput, "--sync-active-set", "--apply",
      "--manifest", path.join(temporaryDirectory, "archived-source.json"),
    ], { FIRESTORE_EMULATOR_HOST: firestore.host });
    assert.equal(archivedSource.code, 1);
    assert.match(archivedSource.stderr, /requires an active-only source; found 1 non-active record\(s\); zero writes attempted/);
    assert.equal(firestore.commits.length, 0);

    firestore.collections.get("leads").get("legacy_changed").fields.id = { stringValue: "wrong_embedded_id" };
    const malformedManifest = path.join(temporaryDirectory, "malformed-target.json");
    const malformed = await runNode([
      "scripts/leads/import-legacy.mjs", "--input", input, "--sync-active-set", "--apply", "--manifest", malformedManifest,
    ], { FIRESTORE_EMULATOR_HOST: firestore.host });
    assert.equal(malformed.code, 1);
    assert.match(malformed.stderr, /and 1 malformed target document\(s\); zero writes attempted/);
    assert.equal(firestore.commits.length, 0);
    const malformedEvidence = JSON.parse(await readFile(malformedManifest, "utf8"));
    assert.equal(malformedEvidence.target.before.unsafeTargetShapeCount, 1);
    assert.equal(malformedEvidence.target.before.unsafeTargetShapeIdHashes.length, 1);
  } finally {
    await firestore.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
