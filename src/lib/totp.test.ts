import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateRecoveryCode, generateTotpSecret, hotp, normalizeRecoveryCode, otpauthUrl, totpAt, verifyTotp } from "./totp";

// RFC 6238 Anhang B: Schlüssel "12345678901234567890" (ASCII), SHA1, 8 Ziffern.
const RFC_KEY = Buffer.from("12345678901234567890", "ascii");

describe("totp", () => {
  it("base32 round trip", () => {
    const buf = Buffer.from("hello world, standchef");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });

  it("RFC 6238 test vectors (8 digits)", () => {
    expect(hotp(RFC_KEY, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(hotp(RFC_KEY, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(hotp(RFC_KEY, Math.floor(1234567890 / 30), 8)).toBe("89005924");
    expect(hotp(RFC_KEY, Math.floor(2000000000 / 30), 8)).toBe("69279037");
  });

  it("verifies with window and replay protection", () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(32);
    const now = 1_700_000_000_000;
    const code = totpAt(secret, now);
    const step = verifyTotp(secret, code, now);
    expect(step).not.toBeNull();
    expect(verifyTotp(secret, code, now + 30_000)).toBe(step);
    expect(verifyTotp(secret, code, now + 90_000)).toBeNull();
    expect(verifyTotp(secret, code, now, { lastUsedStep: step })).toBeNull();
    expect(verifyTotp(secret, "12ab56", now)).toBeNull();
    expect(verifyTotp(secret, code.slice(0, 3) + " " + code.slice(3), now)).toBe(step);
  });

  it("otpauth url", () => {
    const url = otpauthUrl({ secret: "ABC", account: "anna@example.ch" });
    expect(url.startsWith("otpauth://totp/Standchef%3Aanna%40example.ch?")).toBe(true);
    expect(url).toContain("secret=ABC");
  });

  it("recovery codes", () => {
    const c = generateRecoveryCode();
    expect(c).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
    expect(normalizeRecoveryCode(c.toUpperCase())).toBe(c.replace("-", ""));
  });
});
