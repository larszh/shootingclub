/**
 * Verfügbarkeits-Matrix aus Sicht der Einstellungen: welche Kombination von Plattform- und
 * Vereins-Schaltern ergibt welchen Status (Badge-Text), inkl. Limite.
 */
import { describe, expect, it } from "vitest";
import { computeAvailability, type PlatformAiState, type TenantAiState } from "@/lib/ai/availability";
import { aiStatusInfo } from "./status-info";
import { AI_SETTINGS_TEXTS, aiT } from "./i18n";
import { AI_ERROR_CODES, AI_UNAVAILABLE_REASONS } from "@/lib/ai/types";
import { LOCALES } from "@/lib/i18n/core";

const platform = (over: Partial<PlatformAiState> = {}): PlatformAiState => ({
  enabled: true, allowClubs: true, hasKey: true, features: ["translations", "support"], monthlyTokenLimit: null, ...over,
});
const tenant = (over: Partial<TenantAiState> = {}): TenantAiState => ({
  moduleEnabled: true, enabled: true, hasKey: true, features: ["help", "coach", "writing"], memberAccess: "ALL",
  monthlyTokenLimit: null, consentAt: new Date("2026-11-01T10:00:00Z"), ...over,
});
const admin = { id: "u1", isSuperAdmin: false, role: "ADMIN" };
const member = { id: "u2", isSuperAdmin: false, role: "MEMBER" };

describe("Plattform", () => {
  it("Plattform aus → nichts geht (auch mit Schlüssel und Funktion)", () => {
    for (const feature of [null, "translations", "support"] as const) {
      expect(computeAvailability({ scope: "platform", platform: platform({ enabled: false }), feature })).toEqual({ ok: false, reason: "platformOff" });
    }
  });
  it("Funktion aus", () => {
    expect(computeAvailability({ scope: "platform", platform: platform({ features: ["support"] }), feature: "translations" })).toEqual({ ok: false, reason: "featureOff" });
  });
  it("Limit erreicht", () => {
    expect(computeAvailability({ scope: "platform", platform: platform({ monthlyTokenLimit: 1000 }), feature: "support", usedTokens: 1000 })).toEqual({ ok: false, reason: "limitReached" });
    expect(computeAvailability({ scope: "platform", platform: platform({ monthlyTokenLimit: 1000 }), feature: "support", usedTokens: 999 })).toEqual({ ok: true });
  });
  it("Plattform-Schalter beeinflusst Vereine nicht", () => {
    expect(computeAvailability({ scope: "tenant", platform: platform({ enabled: false, hasKey: false }), tenant: tenant(), feature: "help" })).toEqual({ ok: true });
  });
});

describe("Verein", () => {
  it("Vereine nicht erlaubt → Verein aus, egal was der Verein einstellt", () => {
    expect(computeAvailability({ scope: "tenant", platform: platform({ allowClubs: false }), tenant: tenant(), feature: "help", actor: admin })).toEqual({ ok: false, reason: "clubsNotAllowed" });
  });
  it("Modul oder Schalter aus → clubOff", () => {
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant({ enabled: false }), feature: null })).toEqual({ ok: false, reason: "clubOff" });
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant({ moduleEnabled: false }), feature: null })).toEqual({ ok: false, reason: "clubOff" });
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: null, feature: null })).toEqual({ ok: false, reason: "clubOff" });
  });
  it("ohne Zustimmung → noConsent", () => {
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant({ consentAt: null }), feature: "help" })).toEqual({ ok: false, reason: "noConsent" });
  });
  it("Funktion aus", () => {
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant(), feature: "reports" })).toEqual({ ok: false, reason: "featureOff" });
  });
  it("Rollen: Schreibhilfe ab Trainer, memberAccess STAFF", () => {
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant(), feature: "writing", actor: member })).toEqual({ ok: false, reason: "noAccess" });
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant(), feature: "help", actor: member })).toEqual({ ok: true });
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant({ memberAccess: "STAFF" }), feature: "help", actor: member })).toEqual({ ok: false, reason: "noAccess" });
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant({ memberAccess: "STAFF" }), feature: "help", actor: admin })).toEqual({ ok: true });
  });
  it("Limit erreicht", () => {
    expect(computeAvailability({ scope: "tenant", platform: platform(), tenant: tenant({ monthlyTokenLimit: 50 }), feature: "help", usedTokens: 60 })).toEqual({ ok: false, reason: "limitReached" });
  });
});

describe("Status-Text", () => {
  it("bereit / aus mit Grund", () => {
    expect(aiStatusInfo({ ok: true }, "de")).toEqual({ ready: true, label: "KI bereit", reason: null, tone: "ok" });
    expect(aiStatusInfo({ ok: false, reason: "limitReached" }, "de")).toMatchObject({ ready: false, label: "KI aus", tone: "warn", reason: aiT("de")("ai.unavailable.limitReached") });
    expect(aiStatusInfo({ ok: false, reason: "platformOff" }, "fr").tone).toBe("neutral");
    expect(aiStatusInfo({ ok: true }, "en").label).toBe("AI ready");
  });
});

describe("Texte", () => {
  it("alle Sprachen haben dieselben Schlüssel", () => {
    const keys = Object.keys(AI_SETTINGS_TEXTS.de).sort();
    for (const l of LOCALES) expect(Object.keys(AI_SETTINGS_TEXTS[l]).sort()).toEqual(keys);
  });
  it("Gründe und Fehlercodes haben Texte", () => {
    for (const r of AI_UNAVAILABLE_REASONS) expect(AI_SETTINGS_TEXTS.de[`ai.unavailable.${r}`]).toBeTruthy();
    for (const c of AI_ERROR_CODES) expect(AI_SETTINGS_TEXTS.de[`ai.error.${c}`]).toBeTruthy();
  });
  it("Platzhalter in allen Sprachen gleich", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const [k, v] of Object.entries(AI_SETTINGS_TEXTS.de)) for (const l of LOCALES) expect(ph(AI_SETTINGS_TEXTS[l][k]!), `${l}:${k}`).toBe(ph(v));
  });
});
