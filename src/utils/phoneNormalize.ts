/**
 * Normalizes a phone number for use in wa.me links.
 *
 * International numbers (written with a leading "+" or "00") are respected as-is:
 * the country code the user typed is kept and no Brazilian rule is applied.
 *
 * Numbers typed without any country prefix are treated as Brazilian:
 * - Strips non-digit characters
 * - Removes leading zeros
 * - Prepends country code 55
 * - Inserts the 9th digit for 8-digit mobile numbers
 *
 * Returns null if the input has no usable digits.
 */
/**
 * Inserts the Brazilian 9th digit only for MOBILE numbers.
 * Mobile local numbers (8 digits, after 55+DDD) start with 6–9.
 * Landlines start with 2–5 and must NOT receive the 9th digit —
 * WhatsApp Business numbers registered on a landline keep the 8-digit form.
 */
function withNinthDigitIfMobile(digitsWith55: string): string {
  if (digitsWith55.length !== 12) return digitsWith55;
  const local = digitsWith55.slice(4); // after "55" + 2-digit DDD
  if (!/^[6-9]/.test(local)) return digitsWith55;
  return digitsWith55.slice(0, 4) + "9" + local;
}

export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly || /^0+$/.test(digitsOnly)) return null;

  // Explicit international notation: "+<DDI>..." or "00<DDI>..."
  const hasPlus = trimmed.startsWith("+");
  const hasIddPrefix = /^00\d/.test(digitsOnly);

  if (hasPlus || hasIddPrefix) {
    const intl = hasPlus ? digitsOnly : digitsOnly.replace(/^00/, "");
    if (!intl) return null;
    // Brazilian numbers written internationally still get the 9th-digit fix
    if (intl.startsWith("55") && intl.length === 12) {
      return intl.slice(0, 4) + "9" + intl.slice(4);
    }
    return intl;
  }

  // No country prefix → assume Brazil
  let digits = digitsOnly.replace(/^0+/, "");
  if (!digits) return null;

  if (!digits.startsWith("55")) digits = "55" + digits;

  // 55 + 2-digit DDD + 8-digit number = 12 digits → insert 9th digit
  if (digits.length === 12) {
    digits = digits.slice(0, 4) + "9" + digits.slice(4);
  }

  return digits;
}
