import { describe, expect, it } from "vitest";
import { compactCode, createQrReference, formatIban, formatQrReference, isQrIban, isValidQrReference, mod10RecursiveCheckDigit, numericPrefixFrom } from "./qr-reference";

describe("qr-reference", () => {
  it("prüft das offizielle Beispiel aus den Swiss Payment Standards", () => {
    expect(isValidQrReference("210000000003139471430009017")).toBe(true);
    expect(isValidQrReference("21 00000 00003 13947 14300 09017")).toBe(true);
    expect(mod10RecursiveCheckDigit("21000000000313947143000901")).toBe(7);
  });

  it("erkennt falsche Prüfziffer, Länge und Nullreferenz", () => {
    expect(isValidQrReference("210000000003139471430009018")).toBe(false);
    expect(isValidQrReference("21000000000313947143000901")).toBe(false);
    expect(isValidQrReference("000000000000000000000000000")).toBe(false);
    expect(isValidQrReference("21000000000313947143000901A")).toBe(false);
    expect(isValidQrReference(null)).toBe(false);
  });

  it("erstellt Referenzen mit Auffüllung und gültiger Prüfziffer", () => {
    const ref = createQrReference("1234");
    expect(ref).toHaveLength(27);
    expect(ref.startsWith("0000000000000000000000")).toBe(true);
    expect(isValidQrReference(ref)).toBe(true);
    expect(createQrReference(21000000000313947143000901n)).toBe("210000000003139471430009017");
    expect(() => createQrReference("")).toThrow();
    expect(() => createQrReference("1".repeat(27))).toThrow();
    expect(() => createQrReference("12a")).toThrow();
    expect(() => mod10RecursiveCheckDigit("1x")).toThrow();
  });

  it("formatiert in Gruppen von rechts", () => {
    expect(formatQrReference("210000000003139471430009017")).toBe("21 00000 00003 13947 14300 09017");
    expect(formatQrReference("")).toBe("");
    expect(formatIban("ch4431999123000889012")).toBe("CH44 3199 9123 0008 8901 2");
    expect(compactCode(" ch44 3199 ")).toBe("CH443199");
  });

  it("erkennt QR-IBAN über die IID 30000–31999", () => {
    expect(isQrIban("CH44 3199 9123 0008 8901 2")).toBe(true);
    expect(isQrIban("CH93 0076 2011 6238 5295 7")).toBe(false);
    expect(isQrIban("DE89370400440532013000")).toBe(false);
    expect(isQrIban(undefined)).toBe(false);
  });

  it("leitet stabile numerische Präfixe ab", () => {
    const a = numericPrefixFrom("tenant-a");
    expect(a).toMatch(/^\d{6}$/);
    expect(numericPrefixFrom("tenant-a")).toBe(a);
    expect(numericPrefixFrom("tenant-b")).not.toBe(a);
    expect(numericPrefixFrom("x", 3)).toMatch(/^\d{3}$/);
  });
});
