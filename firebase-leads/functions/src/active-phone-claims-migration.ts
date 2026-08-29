import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { PersistedDataError, leadFromPersisted } from "./persistence";
import { activePhoneClaimId, canonicalPhoneDigits } from "./phone";

const MAX_ATOMIC_WRITES = 450;
const claimDocumentId = /^v1_[a-f0-9]{64}$/;
const leadDocumentId = /^[A-Za-z0-9_-]{1,128}$/;

export interface ActiveLeadClaimInput {
  id: string;
  phone: string;
  followUp: string;
}

export interface ExistingPhoneClaimInput {
  id: string;
  leadId: string;
}

export interface ActivePhoneClaimsMigrationReport {
  applied: boolean;
  safeToApply: boolean;
  activeLeadCount: number;
  desiredClaimCount: number;
  existingClaimCount: number;
  createCount: number;
  updateCount: number;
  deleteCount: number;
  writeCount: number;
  legacyInvalidPhoneLeadIds: string[];
  legacyMissingFollowUpLeadIds: string[];
  duplicatePhones: Array<{ claimId: string; leadIds: string[] }>;
}

interface ClaimMigrationPlan {
  report: ActivePhoneClaimsMigrationReport;
  creates: Array<{ claimId: string; leadId: string }>;
  updates: Array<{ claimId: string; leadId: string }>;
  deletes: string[];
}

/** Builds an exact claim-index plan without selecting a winner for duplicate leads. */
export function planActivePhoneClaims(
  leads: ActiveLeadClaimInput[],
  existingClaims: ExistingPhoneClaimInput[],
): ClaimMigrationPlan {
  const ownersByClaim = new Map<string, string[]>();
  const legacyInvalidPhoneLeadIds: string[] = [];
  const legacyMissingFollowUpLeadIds: string[] = [];

  for (const lead of leads) {
    if (!lead.followUp) legacyMissingFollowUpLeadIds.push(lead.id);
    if (!canonicalPhoneDigits(lead.phone)) {
      legacyInvalidPhoneLeadIds.push(lead.id);
      continue;
    }
    const claimId = activePhoneClaimId(lead.phone);
    const owners = ownersByClaim.get(claimId) ?? [];
    owners.push(lead.id);
    ownersByClaim.set(claimId, owners);
  }

  const duplicatePhones = [...ownersByClaim]
    .filter(([, leadIds]) => leadIds.length > 1)
    .map(([claimId, leadIds]) => ({ claimId, leadIds: [...leadIds].sort() }))
    .sort((left, right) => left.claimId.localeCompare(right.claimId));
  const existingByClaim = new Map(existingClaims.map((claim) => [claim.id, claim.leadId]));

  if (duplicatePhones.length) {
    return {
      report: migrationReport({
        applied: false,
        safeToApply: false,
        leads,
        ownersByClaim,
        existingClaims,
        legacyInvalidPhoneLeadIds,
        legacyMissingFollowUpLeadIds,
        duplicatePhones,
        creates: [],
        updates: [],
        deletes: [],
      }),
      creates: [],
      updates: [],
      deletes: [],
    };
  }

  const desiredByClaim = new Map(
    [...ownersByClaim].map(([claimId, leadIds]) => [claimId, leadIds[0] as string]),
  );
  const creates: Array<{ claimId: string; leadId: string }> = [];
  const updates: Array<{ claimId: string; leadId: string }> = [];
  const deletes: string[] = [];
  desiredByClaim.forEach((leadId, claimId) => {
    const existingOwner = existingByClaim.get(claimId);
    if (!existingOwner) creates.push({ claimId, leadId });
    else if (existingOwner !== leadId) updates.push({ claimId, leadId });
  });
  existingByClaim.forEach((_leadId, claimId) => {
    if (!desiredByClaim.has(claimId)) deletes.push(claimId);
  });
  creates.sort(byClaimId);
  updates.sort(byClaimId);
  deletes.sort();
  const writeCount = creates.length + updates.length + deletes.length;
  const safeToApply =
    writeCount <= MAX_ATOMIC_WRITES &&
    legacyInvalidPhoneLeadIds.length === 0 &&
    legacyMissingFollowUpLeadIds.length === 0;

  return {
    report: migrationReport({
      applied: false,
      safeToApply,
      leads,
      ownersByClaim,
      existingClaims,
      legacyInvalidPhoneLeadIds,
      legacyMissingFollowUpLeadIds,
      duplicatePhones,
      creates,
      updates,
      deletes,
    }),
    creates,
    updates,
    deletes,
  };
}

export class ActivePhoneClaimsMigrationBlockedError extends Error {
  constructor(public readonly report: ActivePhoneClaimsMigrationReport) {
    super(
      report.duplicatePhones.length
        ? "Active phone claim migration is blocked by duplicate active phones."
        : report.legacyInvalidPhoneLeadIds.length || report.legacyMissingFollowUpLeadIds.length
          ? "Active phone claim migration is blocked by active leads without a usable phone or next follow-up date."
        : "Active phone claim migration exceeds the atomic write limit.",
    );
    this.name = "ActivePhoneClaimsMigrationBlockedError";
  }
}

/**
 * Dry-runs by default. Apply mode re-reads leads and claims in one transaction,
 * then atomically makes the claim index exact. Run only while writes are paused.
 */
export async function migrateActivePhoneClaims(
  db: Firestore,
  options: { apply: boolean },
): Promise<ActivePhoneClaimsMigrationReport> {
  if (!options.apply) {
    const [leadSnapshot, claimSnapshot] = await Promise.all([
      db.collection("leads").where("status", "==", "active").get(),
      db.collection("activePhoneClaims").get(),
    ]);
    return planFromSnapshots(leadSnapshot.docs, claimSnapshot.docs).report;
  }

  return db.runTransaction(async (transaction) => {
    const leadQuery = db.collection("leads").where("status", "==", "active");
    const claimQuery = db.collection("activePhoneClaims");
    const leadSnapshot = await transaction.get(leadQuery);
    const claimSnapshot = await transaction.get(claimQuery);
    const plan = planFromSnapshots(leadSnapshot.docs, claimSnapshot.docs);
    if (!plan.report.safeToApply) throw new ActivePhoneClaimsMigrationBlockedError(plan.report);

    for (const claim of plan.creates) {
      transaction.create(db.collection("activePhoneClaims").doc(claim.claimId), {
        leadId: claim.leadId,
      });
    }
    for (const claim of plan.updates) {
      transaction.set(db.collection("activePhoneClaims").doc(claim.claimId), {
        leadId: claim.leadId,
      });
    }
    for (const claimId of plan.deletes) {
      transaction.delete(db.collection("activePhoneClaims").doc(claimId));
    }
    return { ...plan.report, applied: true };
  });
}

function planFromSnapshots(
  leads: QueryDocumentSnapshot<DocumentData>[],
  claims: QueryDocumentSnapshot<DocumentData>[],
): ClaimMigrationPlan {
  return planActivePhoneClaims(
    leads.map((snapshot) => {
      const lead = leadFromPersisted(snapshot.id, snapshot.data());
      if (lead.status !== "active") throw new PersistedDataError();
      return { id: lead.id, phone: lead.phone, followUp: lead.followUp };
    }),
    claims.map((snapshot) => claimFromSnapshot(snapshot)),
  );
}

function claimFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): ExistingPhoneClaimInput {
  const data = snapshot.data();
  const leadId = data.leadId;
  if (
    !claimDocumentId.test(snapshot.id) ||
    typeof leadId !== "string" ||
    !leadDocumentId.test(leadId)
  ) {
    throw new PersistedDataError();
  }
  return { id: snapshot.id, leadId };
}

function byClaimId(
  left: { claimId: string },
  right: { claimId: string },
): number {
  return left.claimId.localeCompare(right.claimId);
}

function migrationReport(input: {
  applied: boolean;
  safeToApply: boolean;
  leads: ActiveLeadClaimInput[];
  ownersByClaim: Map<string, string[]>;
  existingClaims: ExistingPhoneClaimInput[];
  legacyInvalidPhoneLeadIds: string[];
  legacyMissingFollowUpLeadIds: string[];
  duplicatePhones: Array<{ claimId: string; leadIds: string[] }>;
  creates: Array<{ claimId: string; leadId: string }>;
  updates: Array<{ claimId: string; leadId: string }>;
  deletes: string[];
}): ActivePhoneClaimsMigrationReport {
  return {
    applied: input.applied,
    safeToApply: input.safeToApply,
    activeLeadCount: input.leads.length,
    desiredClaimCount: input.ownersByClaim.size,
    existingClaimCount: input.existingClaims.length,
    createCount: input.creates.length,
    updateCount: input.updates.length,
    deleteCount: input.deletes.length,
    writeCount: input.creates.length + input.updates.length + input.deletes.length,
    legacyInvalidPhoneLeadIds: [...input.legacyInvalidPhoneLeadIds].sort(),
    legacyMissingFollowUpLeadIds: [...input.legacyMissingFollowUpLeadIds].sort(),
    duplicatePhones: input.duplicatePhones,
  };
}
