/**
 * Formats a normalized wa.me phone (digits only, with country code)
 * for display, e.g. "554333754505" → "+55 (43) 3375-4505".
 * Falls back to grouping digits when the pattern is unknown.
 */
export function formatWhatsAppDisplay(digits: string | null | undefined): string {
  const d = (digits ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const local = d.slice(4);
    const localFmt =
      local.length === 9
        ? `${local.slice(0, 5)}-${local.slice(5)}`
        : `${local.slice(0, 4)}-${local.slice(4)}`;
    return `+55 (${ddd}) ${localFmt}`;
  }
  return `+${d}`;
}
