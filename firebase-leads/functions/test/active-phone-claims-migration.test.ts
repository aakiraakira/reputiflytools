import { describe, expect, it } from "vitest";
import { planActivePhoneClaims } from "../src/active-phone-claims-migration";
import { activePhoneClaimId } from "../src/phone";

describe("active phone claim migration planning", () => {
  it("allows an exact, unique, fully actionable active set", () => {
    const claimId = activePhoneClaimId("9123 4567");
    const plan = planActivePhoneClaims(
      [{ id: "lead_ready", phone: "9123 4567", followUp: "2026-08-15" }],
      [],
    );

    expect(plan.report).toMatchObject({
      safeToApply: true,
      activeLeadCount: 1,
      desiredClaimCount: 1,
      createCount: 1,
      writeCount: 1,
      legacyInvalidPhoneLeadIds: [],
      legacyMissingFollowUpLeadIds: [],
    });
    expect(plan.creates).toEqual([{ claimId, leadId: "lead_ready" }]);
  });

  it("plans exact claims but blocks apply until every active legacy row is actionable", () => {
    const firstClaim = activePhoneClaimId("9123 4567");
    const secondClaim = activePhoneClaimId("9234 5678");
    const staleClaim = activePhoneClaimId("9345 6789");
    const plan = planActivePhoneClaims(
      [
        { id: "lead_a", phone: "9123 4567", followUp: "2026-08-15" },
        { id: "lead_b", phone: "+65 9234-5678", followUp: "" },
        { id: "legacy_no_phone", phone: "", followUp: "" },
      ],
      [
        { id: firstClaim, leadId: "lead_a" },
        { id: secondClaim, leadId: "archived_old_owner" },
        { id: staleClaim, leadId: "archived_stale" },
      ],
    );

    expect(plan.report).toMatchObject({
      applied: false,
      safeToApply: false,
      activeLeadCount: 3,
      desiredClaimCount: 2,
      existingClaimCount: 3,
      createCount: 0,
      updateCount: 1,
      deleteCount: 1,
      writeCount: 2,
      legacyInvalidPhoneLeadIds: ["legacy_no_phone"],
      legacyMissingFollowUpLeadIds: ["lead_b", "legacy_no_phone"],
      duplicatePhones: [],
    });
    expect(plan.updates).toEqual([{ claimId: secondClaim, leadId: "lead_b" }]);
    expect(plan.deletes).toEqual([staleClaim]);
  });

  it("blocks canonical duplicates without choosing a winner or planning writes", () => {
    const duplicateClaim = activePhoneClaimId("6583005988");
    const plan = planActivePhoneClaims(
      [
        { id: "live_duplicate_a", phone: "6583005988", followUp: "2026-08-15" },
        { id: "live_duplicate_b", phone: "+65 8300 5988", followUp: "2026-08-16" },
      ],
      [],
    );

    expect(plan.report).toMatchObject({
      safeToApply: false,
      createCount: 0,
      updateCount: 0,
      deleteCount: 0,
      writeCount: 0,
      duplicatePhones: [{
        claimId: duplicateClaim,
        leadIds: ["live_duplicate_a", "live_duplicate_b"],
      }],
    });
    expect(plan.creates).toEqual([]);
  });

  it("refuses a plan that cannot fit in one atomic Firestore transaction", () => {
    const leads = Array.from({ length: 451 }, (_, index) => ({
      id: `lead_${index}`,
      phone: String(6_500_000_000 + index),
      followUp: "2026-08-15",
    }));

    const plan = planActivePhoneClaims(leads, []);

    expect(plan.report).toMatchObject({
      safeToApply: false,
      desiredClaimCount: 451,
      createCount: 451,
      writeCount: 451,
      duplicatePhones: [],
    });
  });
});
