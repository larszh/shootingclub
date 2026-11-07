import { describe, expect, it } from "vitest";
import { MAX_TOKEN_LIMIT, clubEnableBlocker, parseBudget, parsePlatformSettings, parseTenantSettings, pickFeatures, settingsAuditDetail } from "./validation";
import { TENANT_FEATURES } from "@/lib/ai/types";
import { tokensForChf } from "../usage/logic";

describe("parseBudget", () => {
  it("leer = kein Limit", () => {
    expect(parseBudget("", "tokens", "claude-opus-5-5")).toEqual({ ok: true, value: null });
    expect(parseBudget("   ", "chf", "claude-opus-5-5")).toEqual({ ok: true, value: null });
    expect(parseBudget(null, "tokens", "claude-opus-5-5")).toEqual({ ok: true, value: null });
  });
  it("Tokens mit Tausendertrennzeichen", () => {
    expect(parseBudget("1'000'000", "tokens", "claude-opus-5-5")).toEqual({ ok: true, value: 1_000_000 });
    expect(parseBudget("2 500 000", "tokens", "claude-opus-5-5")).toEqual({ ok: true, value: 2_500_000 });
  });
  it("ungültige Tokens", () => {
    for (const v of ["0", "-5", "1.5", "abc", String(MAX_TOKEN_LIMIT + 1)]) {
      expect(parseBudget(v, "tokens", "claude-opus-5-5")).toMatchObject({ ok: false, error: "aiSet.budget.invalid", field: "budget" });
    }
  });
  it("CHF wird über das Modell umgerechnet", () => {
    expect(parseBudget("20", "chf", "claude-opus-5-5")).toEqual({ ok: true, value: tokensForChf(20, "claude-opus-5-5") });
    expect(parseBudget("12,50", "chf", "claude-haiku-5-5")).toEqual({ ok: true, value: tokensForChf(12.5, "claude-haiku-5-5") });
    // günstigeres Modell → mehr Tokens fürs gleiche Geld
    const opus = parseBudget("10", "chf", "claude-opus-5-5");
    const haiku = parseBudget("10", "chf", "claude-haiku-5-5");
    expect(opus.ok && haiku.ok && (haiku.value ?? 0) > (opus.value ?? 0)).toBe(true);
  });
  it("ungültige CHF-Beträge", () => {
    expect(parseBudget("1.234", "chf", "claude-opus-5-5").ok).toBe(false);
    expect(parseBudget("0", "chf", "claude-opus-5-5").ok).toBe(false);
    expect(parseBudget("99999999", "chf", "claude-haiku-5-5").ok).toBe(false);
  });
});

describe("pickFeatures", () => {
  it("nur bekannte, in fester Reihenfolge, ohne Duplikate", () => {
    expect(pickFeatures(TENANT_FEATURES, ["coach", "x", "help", "help", 3])).toEqual(["help", "coach"]);
  });
});

describe("parsePlatformSettings", () => {
  it("gültige Eingabe", () => {
    expect(parsePlatformSettings({ model: "claude-sonnet-5-5", features: ["support", "help"], budget: "500000", budgetUnit: "tokens" })).toEqual({
      ok: true, value: { model: "claude-sonnet-5-5", features: ["support"], monthlyTokenLimit: 500_000 },
    });
  });
  it("unbekanntes Modell", () => {
    expect(parsePlatformSettings({ model: "gpt-4", features: [], budget: "", budgetUnit: "tokens" })).toMatchObject({ ok: false, field: "model" });
    expect(parsePlatformSettings({ model: undefined, features: [], budget: "", budgetUnit: "tokens" })).toMatchObject({ ok: false, field: "model" });
  });
  it("ungültiges Budget", () => {
    expect(parsePlatformSettings({ model: "claude-opus-5-5", features: [], budget: "x", budgetUnit: "tokens" })).toMatchObject({ ok: false, field: "budget" });
  });
});

describe("parseTenantSettings", () => {
  it("gültige Eingabe", () => {
    expect(parseTenantSettings({ model: "claude-opus-5-5", features: ["reports", "help", "translations"], memberAccess: "STAFF", budget: "", budgetUnit: "tokens" })).toEqual({
      ok: true, value: { model: "claude-opus-5-5", features: ["help", "reports"], memberAccess: "STAFF", monthlyTokenLimit: null },
    });
  });
  it("Zugang muss ALL oder STAFF sein", () => {
    expect(parseTenantSettings({ model: "claude-opus-5-5", features: [], memberAccess: "ADMIN", budget: "", budgetUnit: "tokens" })).toMatchObject({ ok: false, field: "memberAccess" });
  });
});

describe("clubEnableBlocker", () => {
  const base = { allowClubs: true, hasKey: true, consentGiven: false, consentChecked: true };
  it("alles erfüllt", () => expect(clubEnableBlocker(base)).toBeNull());
  it("Plattform erlaubt keine Vereine (zuerst geprüft)", () => {
    expect(clubEnableBlocker({ ...base, allowClubs: false, hasKey: false, consentChecked: false })).toBe("aiSet.club.notAllowed");
  });
  it("Zustimmung nötig", () => {
    expect(clubEnableBlocker({ ...base, consentChecked: false })).toBe("aiSet.club.needsConsent");
    expect(clubEnableBlocker({ ...base, consentChecked: false, consentGiven: true })).toBeNull();
  });
  it("Schlüssel nötig", () => expect(clubEnableBlocker({ ...base, hasKey: false })).toBe("aiSet.club.needsKey"));
});

describe("settingsAuditDetail", () => {
  it("ohne Schlüssel, kompakt", () => {
    expect(settingsAuditDetail({ model: "claude-opus-5-5", features: ["help"], monthlyTokenLimit: null, memberAccess: "ALL" })).toBe("model=claude-opus-5-5 features=help limit=- access=ALL");
    expect(settingsAuditDetail({ model: "claude-opus-5-5", features: [], monthlyTokenLimit: 5 })).toBe("model=claude-opus-5-5 features=- limit=5");
  });
});
