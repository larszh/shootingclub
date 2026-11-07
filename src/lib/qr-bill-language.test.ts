import { describe, expect, it } from "vitest";
import { qrBillLanguage } from "./qr-bill";

describe("qrBillLanguage", () => {
  it("wählt die Sprache des Zahlteils, Standard Deutsch", () => {
    expect(qrBillLanguage("de")).toBe("DE");
    expect(qrBillLanguage("fr-CH")).toBe("FR");
    expect(qrBillLanguage("it")).toBe("IT");
    expect(qrBillLanguage("en")).toBe("EN");
    expect(qrBillLanguage("rm")).toBe("DE");
    expect(qrBillLanguage(null)).toBe("DE");
  });
});
