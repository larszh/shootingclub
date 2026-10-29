import { describe, expect, it } from "vitest";
import { isBase64Url, isPrivateAddress, safeAppPath, truncateText, validateEndpoint } from "./endpoint";
import { defaultPreference, preferenceMatrix, resolvePreference } from "./topics";

describe("validateEndpoint", () => {
  it("akzeptiert bekannte Push-Dienste", () => {
    expect(validateEndpoint("https://fcm.googleapis.com/fcm/send/abc:def")).toBeNull();
    expect(validateEndpoint("https://web.push.apple.com/QGx")).toBeNull();
    expect(validateEndpoint("https://updates.push.services.mozilla.com/wpush/v2/gAAA")).toBeNull();
  });
  it("lehnt unsichere oder interne Adressen ab", () => {
    expect(validateEndpoint("http://fcm.googleapis.com/x")).not.toBeNull();
    expect(validateEndpoint("https://127.0.0.1/x")).not.toBeNull();
    expect(validateEndpoint("https://[::1]/x")).not.toBeNull();
    expect(validateEndpoint("https://localhost/x")).not.toBeNull();
    expect(validateEndpoint("https://db.internal/x")).not.toBeNull();
    expect(validateEndpoint("https://intranet/x")).not.toBeNull();
    expect(validateEndpoint("https://user:pw@fcm.googleapis.com/x")).not.toBeNull();
    expect(validateEndpoint("https://fcm.googleapis.com:8443/x")).not.toBeNull();
    expect(validateEndpoint("kein url")).not.toBeNull();
  });
});

describe("isPrivateAddress", () => {
  it("erkennt private Bereiche", () => {
    for (const ip of ["10.1.2.3", "172.16.0.1", "192.168.1.1", "127.0.0.1", "169.254.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("lässt öffentliche Adressen zu", () => {
    for (const ip of ["142.250.74.10", "17.253.144.10", "2a00:1450:4001:80b::200a"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("Hilfsfunktionen", () => {
  it("kürzt an Wortgrenzen", () => {
    expect(truncateText("kurz", 80)).toBe("kurz");
    const t = truncateText("Das ist ein ziemlich langer Satz, der gekürzt werden muss", 30);
    expect(t.length).toBeLessThanOrEqual(30);
    expect(t.endsWith("…")).toBe(true);
  });
  it("erlaubt nur relative App-Pfade", () => {
    expect(safeAppPath("/chat/1")).toBe("/chat/1");
    expect(safeAppPath("https://evil.example")).toBe("/");
    expect(safeAppPath("//evil.example")).toBe("/");
    expect(safeAppPath(undefined)).toBe("/");
  });
  it("prüft base64url", () => {
    expect(isBase64Url("abc_-", 1, 10)).toBe(true);
    expect(isBase64Url("a+b", 1, 10)).toBe(false);
  });
});

describe("Einstellungen", () => {
  it("Standardwerte", () => {
    expect(defaultPreference("PUSH", "chat")).toBe(true);
    expect(defaultPreference("EMAIL", "chat")).toBe(false);
    expect(defaultPreference("EMAIL", "invoices")).toBe(true);
  });
  it("gespeicherte Werte überschreiben, Konto-Mails bleiben an", () => {
    const rows = [
      { channel: "PUSH", topic: "chat", enabled: false },
      { channel: "EMAIL", topic: "system", enabled: false },
    ];
    expect(resolvePreference(rows, "PUSH", "chat")).toBe(false);
    expect(resolvePreference(rows, "EMAIL", "system")).toBe(true);
    expect(preferenceMatrix(rows).invoices).toEqual({ push: true, email: true });
  });
});
