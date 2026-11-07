/**
 * KI-Einstellungen: Eingaben prüfen und Regeln fürs Einschalten (rein, ohne DB).
 * Fehler werden als i18n-Schlüssel (aiT) zurückgegeben.
 */
import * as z from "zod/v4";
import {
  PLATFORM_FEATURES, TENANT_FEATURES, isAiModel, normalizeMemberAccess,
  type AiModel, type MemberAccess, type PlatformFeature, type TenantFeature,
} from "@/lib/ai/types";
import { tokensForChf } from "../usage/logic";

/** Obergrenze für Token-Limiten (passt in eine INT-Spalte). */
export const MAX_TOKEN_LIMIT = 2_000_000_000;

export type BudgetUnit = "tokens" | "chf";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; field?: string };

/** Formularwert → Zeichenkette (FormData liefert File|string|null). */
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Budget aus dem Formular → Token-Limit. Leer = kein Limit (null).
 * Einheit «chf»: Umrechnung über den Mischpreis des Modells (Schätzung).
 * Erlaubt «'» und Leerzeichen als Tausendertrennzeichen, bei CHF auch Dezimalstellen.
 */
export function parseBudget(raw: unknown, unit: unknown, model: string): Parsed<number | null> {
  const s = str(raw).replace(/['’\s]/g, "");
  if (!s) return { ok: true, value: null };
  const u: BudgetUnit = unit === "chf" ? "chf" : "tokens";
  if (u === "tokens") {
    if (!/^\d+$/.test(s)) return { ok: false, error: "aiSet.budget.invalid", field: "budget" };
    const n = Number(s);
    if (!Number.isSafeInteger(n) || n <= 0 || n > MAX_TOKEN_LIMIT) return { ok: false, error: "aiSet.budget.invalid", field: "budget" };
    return { ok: true, value: n };
  }
  const normalized = s.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { ok: false, error: "aiSet.budget.invalid", field: "budget" };
  const tokens = tokensForChf(Number(normalized), model);
  if (tokens <= 0 || tokens > MAX_TOKEN_LIMIT) return { ok: false, error: "aiSet.budget.invalid", field: "budget" };
  return { ok: true, value: tokens };
}

const modelSchema = z.string().refine(isAiModel);

/** Ausgewählte Funktionen (Mehrfachauswahl) → bekannte Funktionen in fester Reihenfolge. */
export function pickFeatures<F extends string>(allowed: readonly F[], raw: readonly unknown[]): F[] {
  const wanted = new Set(raw.filter((v): v is string => typeof v === "string"));
  return allowed.filter((f) => wanted.has(f));
}

export type PlatformSettingsInput = { model: AiModel; features: PlatformFeature[]; monthlyTokenLimit: number | null };

/** Plattform-Einstellungen (Modell, Funktionen, Budget) prüfen. */
export function parsePlatformSettings(input: { model: unknown; features: readonly unknown[]; budget: unknown; budgetUnit: unknown }): Parsed<PlatformSettingsInput> {
  const m = modelSchema.safeParse(input.model);
  if (!m.success) return { ok: false, error: "aiSet.invalid", field: "model" };
  const model = m.data as AiModel;
  const budget = parseBudget(input.budget, input.budgetUnit, model);
  if (!budget.ok) return budget;
  return { ok: true, value: { model, features: pickFeatures(PLATFORM_FEATURES, input.features), monthlyTokenLimit: budget.value } };
}

export type TenantSettingsInput = { model: AiModel; features: TenantFeature[]; memberAccess: MemberAccess; monthlyTokenLimit: number | null };

/** Vereins-Einstellungen (Modell, Funktionen, Zugang, Limit) prüfen. */
export function parseTenantSettings(input: { model: unknown; features: readonly unknown[]; memberAccess: unknown; budget: unknown; budgetUnit: unknown }): Parsed<TenantSettingsInput> {
  const m = modelSchema.safeParse(input.model);
  if (!m.success) return { ok: false, error: "aiSet.invalid", field: "model" };
  const model = m.data as AiModel;
  const access = input.memberAccess;
  if (access !== "ALL" && access !== "STAFF") return { ok: false, error: "aiSet.invalid", field: "memberAccess" };
  const budget = parseBudget(input.budget, input.budgetUnit, model);
  if (!budget.ok) return budget;
  return {
    ok: true,
    value: { model, features: pickFeatures(TENANT_FEATURES, input.features), memberAccess: normalizeMemberAccess(access), monthlyTokenLimit: budget.value },
  };
}

/**
 * Darf ein Verein KI einschalten? Reihenfolge: Plattform erlaubt Vereine → Zustimmung
 * (bestehend oder jetzt angekreuzt) → Schlüssel gespeichert. Ergebnis: null = ja, sonst i18n-Schlüssel.
 */
export function clubEnableBlocker(s: { allowClubs: boolean; hasKey: boolean; consentGiven: boolean; consentChecked: boolean }): string | null {
  if (!s.allowClubs) return "aiSet.club.notAllowed";
  if (!s.consentGiven && !s.consentChecked) return "aiSet.club.needsConsent";
  if (!s.hasKey) return "aiSet.club.needsKey";
  return null;
}

/** Kurzer Audit-Text einer Einstellungsänderung (ohne Schlüssel). */
export function settingsAuditDetail(s: { model: string; features: readonly string[]; monthlyTokenLimit: number | null; memberAccess?: string }): string {
  const parts = [`model=${s.model}`, `features=${s.features.join(",") || "-"}`, `limit=${s.monthlyTokenLimit ?? "-"}`];
  if (s.memberAccess) parts.push(`access=${s.memberAccess}`);
  return parts.join(" ").slice(0, 500);
}

