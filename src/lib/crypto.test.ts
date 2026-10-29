import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "./crypto";

describe("crypto (AES-256-GCM)", () => {
  it("verschlüsselt und entschlüsselt verlustfrei", () => {
    const value = { apiKey: "sk_test_123", nested: { n: 1, ok: true }, umlaut: "Grüezi «Zäme»" };
    const enc = encryptJson(value);
    expect(enc.split(".")).toHaveLength(3);
    expect(enc).not.toContain("sk_test_123");
    expect(decryptJson(enc)).toEqual(value);
  });

  it("nutzt jedes Mal einen neuen IV", () => {
    expect(encryptJson({ a: 1 })).not.toBe(encryptJson({ a: 1 }));
  });

  it("erkennt manipulierte Daten", () => {
    const [iv, tag, data] = encryptJson({ a: "geheim" }).split(".");
    const flipped = data!.slice(0, -2) + (data!.slice(-2) === "AA" ? "AB" : "AA");
    expect(() => decryptJson(`${iv}.${tag}.${flipped}`)).toThrow();
    expect(() => decryptJson("kaputt")).toThrow();
  });

  it("verweigert einen fehlenden oder zu kurzen Schlüssel", () => {
    const prev = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "kurz";
    try {
      expect(() => encryptJson({ a: 1 })).toThrow(/AUTH_SECRET/);
    } finally {
      process.env.AUTH_SECRET = prev;
    }
  });

  it("entschlüsselt nicht mit einem anderen Schlüssel", () => {
    const enc = encryptJson({ a: 1 });
    const prev = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "ein-ganz-anderer-schluessel-1234567890";
    try {
      expect(() => decryptJson(enc)).toThrow();
    } finally {
      process.env.AUTH_SECRET = prev;
    }
  });
});
