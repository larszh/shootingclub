import { describe, expect, it } from "vitest";
import { computeAvailability, type PlatformAiState, type TenantAiState } from "./availability";

const platform: PlatformAiState = { enabled: true, allowClubs: true, hasKey: true, features: ["translations", "support"], monthlyTokenLimit: null };
const tenant: TenantAiState = {
  moduleEnabled: true, enabled: true, hasKey: true, features: ["help", "writing", "importHelper"],
  memberAccess: "ALL", monthlyTokenLimit: null, consentAt: new Date("2026-11-01"),
};
const member = { isSuperAdmin: false, role: "MEMBER" };
const trainer = { isSuperAdmin: false, role: "TRAINER" };
const admin = { isSuperAdmin: false, role: "ADMIN" };
const superAdmin = { isSuperAdmin: true, role: null };

describe("computeAvailability – Plattform", () => {
  it("ok für Super-Admin mit Schlüssel und Funktion", () => {
    expect(computeAvailability({ scope: "platform", platform, feature: "translations", actor: superAdmin })).toEqual({ ok: true });
  });
  it.each([
    [{ ...platform, enabled: false }, "translations", "platformOff"],
    [{ ...platform, hasKey: false }, "translations", "noKey"],
    [{ ...platform, features: ["support"] }, "translations", "featureOff"],
    [platform, "help", "featureOff"],
  ] as const)("%o / %s → %s", (p, feature, reason) => {
    expect(computeAvailability({ scope: "platform", platform: p, feature, actor: superAdmin })).toEqual({ ok: false, reason });
  });
  it("nur Super-Admins", () => {
    expect(computeAvailability({ scope: "platform", platform, feature: "support", actor: admin })).toEqual({ ok: false, reason: "noAccess" });
  });
  it("Monatslimit", () => {
    const p = { ...platform, monthlyTokenLimit: 1000 };
    expect(computeAvailability({ scope: "platform", platform: p, feature: "support", usedTokens: 999 })).toEqual({ ok: true });
    expect(computeAvailability({ scope: "platform", platform: p, feature: "support", usedTokens: 1000 })).toEqual({ ok: false, reason: "limitReached" });
  });
  it("feature null prüft nur die Grundvoraussetzungen", () => {
    expect(computeAvailability({ scope: "platform", platform: { ...platform, features: [] }, feature: null })).toEqual({ ok: true });
  });
});

describe("computeAvailability – Verein", () => {
  const base = { scope: "tenant" as const, platform, tenant };
  it("Mitglied darf Hilfe nutzen", () => {
    expect(computeAvailability({ ...base, feature: "help", actor: member })).toEqual({ ok: true });
  });
  it("Plattform-KI aus blockiert Vereine nicht, allowClubs schon", () => {
    expect(computeAvailability({ ...base, platform: { ...platform, enabled: false }, feature: "help", actor: member })).toEqual({ ok: true });
    expect(computeAvailability({ ...base, platform: { ...platform, allowClubs: false }, feature: "help", actor: member })).toEqual({ ok: false, reason: "clubsNotAllowed" });
  });
  it.each([
    [{ ...tenant, moduleEnabled: false }, "clubOff"],
    [{ ...tenant, enabled: false }, "clubOff"],
    [{ ...tenant, consentAt: null }, "noConsent"],
    [{ ...tenant, hasKey: false }, "noKey"],
    [{ ...tenant, features: ["writing"] }, "featureOff"],
  ] as const)("%o → %s", (t, reason) => {
    expect(computeAvailability({ ...base, tenant: t, feature: "help", actor: member })).toEqual({ ok: false, reason });
  });
  it("ohne Einstellungen → clubOff", () => {
    expect(computeAvailability({ ...base, tenant: null, feature: "help" })).toEqual({ ok: false, reason: "clubOff" });
  });
  it("Plattform-Funktion im Verein → featureOff", () => {
    expect(computeAvailability({ ...base, feature: "translations", actor: admin })).toEqual({ ok: false, reason: "featureOff" });
  });
  it("Mindestrolle pro Funktion", () => {
    expect(computeAvailability({ ...base, feature: "writing", actor: member })).toEqual({ ok: false, reason: "noAccess" });
    expect(computeAvailability({ ...base, feature: "writing", actor: trainer })).toEqual({ ok: true });
    expect(computeAvailability({ ...base, feature: "importHelper", actor: trainer })).toEqual({ ok: false, reason: "noAccess" });
    expect(computeAvailability({ ...base, feature: "importHelper", actor: admin })).toEqual({ ok: true });
    expect(computeAvailability({ ...base, feature: "importHelper", actor: superAdmin })).toEqual({ ok: true });
  });
  it("memberAccess STAFF schliesst Mitglieder aus", () => {
    const t = { ...tenant, memberAccess: "STAFF" };
    expect(computeAvailability({ ...base, tenant: t, feature: "help", actor: member })).toEqual({ ok: false, reason: "noAccess" });
    expect(computeAvailability({ ...base, tenant: t, feature: "help", actor: trainer })).toEqual({ ok: true });
  });
  it("ohne Mitgliedschaft kein Zugang", () => {
    expect(computeAvailability({ ...base, feature: "help", actor: { isSuperAdmin: false, role: null } })).toEqual({ ok: false, reason: "noAccess" });
  });
  it("ohne actor keine Rollenprüfung", () => {
    expect(computeAvailability({ ...base, feature: "importHelper" })).toEqual({ ok: true });
  });
  it("Monatslimit des Vereins", () => {
    const t = { ...tenant, monthlyTokenLimit: 500 };
    expect(computeAvailability({ ...base, tenant: t, feature: "help", usedTokens: 500 })).toEqual({ ok: false, reason: "limitReached" });
    expect(computeAvailability({ ...base, tenant: { ...tenant, monthlyTokenLimit: 0 }, feature: "help", usedTokens: 10 })).toEqual({ ok: true });
  });
});
