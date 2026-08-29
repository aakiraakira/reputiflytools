import { describe, expect, it } from "vitest";
import { activePhoneClaimId, canonicalPhoneDigits, whatsappUrl } from "../src/phone";

describe("phone canonicalization", () => {
  it("maps local, plus-prefixed, and 00-prefixed forms to one E.164 identity", () => {
    const forms = ["9123 4567", "+65 9123-4567", "0065 9123 4567"];
    expect(forms.map(canonicalPhoneDigits)).toEqual([
      "6591234567",
      "6591234567",
      "6591234567",
    ]);
    expect(new Set(forms.map(activePhoneClaimId))).toHaveLength(1);
    expect(whatsappUrl("0065 9123 4567")).toBe("https://wa.me/6591234567");
  });

  it("does not reinterpret explicit eight-digit international numbers as Singapore local numbers", () => {
    expect(canonicalPhoneDigits("+12 345 678")).toBe("12345678");
    expect(canonicalPhoneDigits("0012 345 678")).toBe("12345678");
  });

  it.each(["", "1234567", "0000 0000", "+00 9123 4567", "1234567890123456"])(
    "rejects structurally unusable form %j",
    (phone) => {
      expect(canonicalPhoneDigits(phone)).toBeNull();
      expect(whatsappUrl(phone)).toBeNull();
      expect(() => activePhoneClaimId(phone)).toThrow("Phone is not usable for WhatsApp");
    },
  );
});
