import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";

const SRC = resolve(__dirname, "..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full)) acc.push(full);
  }
  return acc;
}

const files = walk(SRC);

describe("wa.me links respect international country codes", () => {
  it("never hardcodes the Brazilian DDI inside a wa.me URL", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      content.split("\n").forEach((line, i) => {
        // Allow fully-literal support numbers (e.g. wa.me/5511947388423),
        // but forbid concatenating "55" with a dynamic phone value.
        if (/wa\.me\/55\$\{/.test(line) || /wa\.me\/\$\{["'`]?55["'`]?\s*\+/.test(line)) {
          offenders.push(`${file.replace(SRC, "src")}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("never builds a wa.me link from a raw digit-strip of a user phone", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      // Static support numbers stored in SCREAMING_CASE constants are fine.
      const dynamic = content.match(/wa\.me\/\$\{[^}]+\}/g) ?? [];
      const usesPatientPhone = dynamic.some((m) => !/^wa\.me\/\$\{[A-Z0-9_]+\}$/.test(m));
      if (!usesPatientPhone) continue;
      // Files that build dynamic links must import the normalizer.
      if (!content.includes("normalizePhoneForWhatsApp")) {
        offenders.push(file.replace(SRC, "src"));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("normalizePhoneForWhatsApp produces valid wa.me targets", () => {
  const link = (raw: string) => `https://wa.me/${normalizePhoneForWhatsApp(raw)}`;

  const cases: Array<[string, string]> = [
    ["+351 912 345 678", "https://wa.me/351912345678"],
    ["+1 (415) 555-2671", "https://wa.me/14155552671"],
    ["+44 7700 900123", "https://wa.me/447700900123"],
    ["+34 612 34 56 78", "https://wa.me/34612345678"],
    ["+81 90-1234-5678", "https://wa.me/819012345678"],
    ["+61 412 345 678", "https://wa.me/61412345678"],
    ["00351912345678", "https://wa.me/351912345678"],
    ["0014155552671", "https://wa.me/14155552671"],
    ["+55 11 99988-7766", "https://wa.me/5511999887766"],
    ["(11) 99988-7766", "https://wa.me/5511999887766"],
  ];

  it.each(cases)("builds the right link for %s", (input, expected) => {
    expect(link(input)).toBe(expected);
  });

  it("never prefixes 55 to an explicit foreign country code", () => {
    for (const [input] of cases) {
      const digits = normalizePhoneForWhatsApp(input)!;
      if (input.trim().startsWith("+55") || !/^[+]|^00/.test(input.trim())) continue;
      expect(digits.startsWith("55")).toBe(false);
    }
  });

  it("output contains digits only (safe for URL interpolation)", () => {
    for (const [input] of cases) {
      expect(normalizePhoneForWhatsApp(input)).toMatch(/^\d+$/);
    }
  });

  it("returns null for unusable input so callers can fall back", () => {
    expect(normalizePhoneForWhatsApp("abc")).toBeNull();
    expect(normalizePhoneForWhatsApp("+")).toBeNull();
    expect(normalizePhoneForWhatsApp("00")).toBeNull();
  });
});
