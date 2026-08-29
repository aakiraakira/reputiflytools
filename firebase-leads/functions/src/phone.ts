import { createHash } from "node:crypto";

const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

/** Canonical digits used for WhatsApp and internal active-phone uniqueness. */
export function canonicalPhoneDigits(value: string): string | null {
  const explicitPlus = /^\s*\+/.test(value);
  let digits = value.replace(/\D/g, "");
  const explicitDoubleZero = digits.startsWith("00");
  if (explicitPlus && explicitDoubleZero) return null;
  if (explicitDoubleZero) digits = digits.slice(2);
  if (!explicitPlus && !explicitDoubleZero && digits.length === 8) {
    if (digits.startsWith("0")) return null;
    digits = `65${digits}`;
  }
  if (
    digits.length < MIN_E164_DIGITS ||
    digits.length > MAX_E164_DIGITS ||
    digits.startsWith("0")
  ) return null;
  return digits;
}

export function whatsappUrl(value: string): string | null {
  const digits = canonicalPhoneDigits(value);
  return digits ? `https://wa.me/${digits}` : null;
}

/** The phone itself is never stored in the claim document ID. */
export function activePhoneClaimId(value: string): string {
  const digits = canonicalPhoneDigits(value);
  if (!digits) throw new Error("Phone is not usable for WhatsApp");
  const digest = createHash("sha256").update(digits).digest("hex");
  return `v1_${digest}`;
}
