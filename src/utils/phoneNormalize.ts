/**
 * Normalizes a Brazilian phone number for use in wa.me links.
 * - Strips non-digit characters
 * - Removes leading zeros
 * - Prepends country code 55 if missing
 * - Inserts 9th digit for 8-digit mobile numbers
 * Returns null if the input has no usable digits.
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;

  // Remove leading zeros (e.g. 011999...)
  digits = digits.replace(/^0+/, "");
  if (!digits) return null;

  // Add country code if not present
  if (!digits.startsWith("55")) digits = "55" + digits;

  // 55 + 2-digit DDD + 8-digit number = 12 digits → insert 9th digit
  if (digits.length === 12) {
    digits = digits.slice(0, 4) + "9" + digits.slice(4);
  }

  return digits;
}
