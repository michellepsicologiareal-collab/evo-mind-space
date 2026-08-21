import { describe, it, expect } from "vitest";
import { normalizePhoneForWhatsApp } from "./phoneNormalize";

describe("normalizePhoneForWhatsApp", () => {
  it("returns null for empty/null input", () => {
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
    expect(normalizePhoneForWhatsApp(undefined)).toBeNull();
    expect(normalizePhoneForWhatsApp("")).toBeNull();
    expect(normalizePhoneForWhatsApp("   ")).toBeNull();
  });

  it("handles number already in full international format (5511999887766)", () => {
    expect(normalizePhoneForWhatsApp("5511999887766")).toBe("5511999887766");
  });

  it("strips +55 prefix and keeps digits", () => {
    expect(normalizePhoneForWhatsApp("+55 11 99988-7766")).toBe("5511999887766");
  });

  it("adds DDI 55 when missing (11999887766)", () => {
    expect(normalizePhoneForWhatsApp("11999887766")).toBe("5511999887766");
  });

  it("removes leading zeros from local format (011999887766)", () => {
    expect(normalizePhoneForWhatsApp("011999887766")).toBe("5511999887766");
  });

  it("inserts 9th digit for 8-digit mobile numbers (1198765432 → 55 11 9 98765432)", () => {
    expect(normalizePhoneForWhatsApp("1198765432")).toBe("5511998765432");
  });

  it("inserts 9th digit for 8-digit number with leading zero (01198765432)", () => {
    expect(normalizePhoneForWhatsApp("01198765432")).toBe("5511998765432");
  });

  it("handles formatted number with parentheses and dashes", () => {
    expect(normalizePhoneForWhatsApp("(11) 99988-7766")).toBe("5511999887766");
  });

  it("handles formatted 8-digit number with parentheses", () => {
    expect(normalizePhoneForWhatsApp("(21) 9876-5432")).toBe("5521998765432");
  });

  it("does not double-add 55 when already present with +", () => {
    expect(normalizePhoneForWhatsApp("+5521999887766")).toBe("5521999887766");
  });

  it("keeps foreign numbers written with + and does not force Brazilian DDI", () => {
    expect(normalizePhoneForWhatsApp("+351 912 345 678")).toBe("351912345678");
    expect(normalizePhoneForWhatsApp("+1 (415) 555-2671")).toBe("14155552671");
    expect(normalizePhoneForWhatsApp("+44 7700 900123")).toBe("447700900123");
  });

  it("handles international 00 prefix", () => {
    expect(normalizePhoneForWhatsApp("00351912345678")).toBe("351912345678");
  });

  it("still fixes the 9th digit for Brazilian numbers typed internationally", () => {
    expect(normalizePhoneForWhatsApp("+55 11 9876-5432")).toBe("5511998765432");
  });

  it("handles number with only zeros", () => {
    expect(normalizePhoneForWhatsApp("0000")).toBeNull();
  });
});
