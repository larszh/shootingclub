"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { buildProvider, PaymentError } from "./index";
import { isProviderKey, PROVIDER_FIELDS, providerLabel, TESTABLE_PROVIDERS, type PaymentProviderKey } from "./catalog";
import { isValidPayrexxInstance, normalizePayrexxInstance, parsePaymentMethods } from "./payrexx";

/** Zahlungsanbieter verwalten: Verwaltungsrecht und Modul Reservationen oder Mitgliederbeiträge. */
async function requirePaymentsAdmin() {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings") && !ctx.hasModule("billing")) redirect("/?module=billing");
  return ctx;
}

const MAX_FIELD = 500;

/** Formularwerte mit gespeicherten Zugangsdaten zusammenführen (geheime Felder leer = behalten). */
function mergeCredentials(provider: PaymentProviderKey, formData: FormData, current: Record<string, string>) {
  const next: Record<string, string> = { ...current };
  for (const f of PROVIDER_FIELDS[provider]) {
    let v = String(formData.get(f.key) ?? "").trim().slice(0, MAX_FIELD);
    if (f.options && v && !f.options.includes(v)) v = f.options[0]!;
    if (v === "" && f.secret && current[f.key]) continue;
    if (v !== "") next[f.key] = v;
    else delete next[f.key];
  }
  if (provider === "PAYREXX") {
    if (next.instance) next.instance = normalizePayrexxInstance(next.instance);
    if (next.paymentMethods !== undefined) {
      const pm = parsePaymentMethods(next.paymentMethods);
      if (pm.length) next.paymentMethods = pm.join(",");
      else delete next.paymentMethods;
    }
  }
  return next;
}

function validate(provider: PaymentProviderKey, creds: Record<string, string>): string | null {
  const missing = PROVIDER_FIELDS[provider].filter((f) => !f.options && !f.optional && !creds[f.key]);
  if (missing.length) return `Fehlende Angaben: ${missing.map((m) => m.label).join(", ")}`;
  if (provider === "PAYREXX" && !isValidPayrexxInstance(creds.instance ?? "")) return "Payrexx: Instanzname ungültig (nur Kleinbuchstaben, Ziffern, Bindestrich).";
  return null;
}

async function currentCredentials(tenantId: string, provider: string) {
  const existing = await db.paymentProviderConfig.findUnique({ where: { tenantId_provider: { tenantId, provider } } });
  return { existing, creds: existing ? decryptJson<Record<string, string>>(existing.credentialsEnc) : {} };
}

export async function savePaymentProviderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePaymentsAdmin();
  const provider = String(formData.get("provider") ?? "");
  if (!isProviderKey(provider)) return fail("Unbekannter Anbieter");
  const { creds } = await currentCredentials(ctx.tenant.id, provider);
  const next = mergeCredentials(provider, formData, creds);
  const enabled = formData.get("enabled") === "on";
  if (enabled) {
    const err = validate(provider, next);
    if (err) return fail(err);
  }
  await db.paymentProviderConfig.upsert({
    where: { tenantId_provider: { tenantId: ctx.tenant.id, provider } },
    create: { tenantId: ctx.tenant.id, provider, enabled, credentialsEnc: encryptJson(next) },
    update: { enabled, credentialsEnc: encryptJson(next) },
  });
  if (!enabled) {
    // Deaktivierter Anbieter darf nirgends mehr gewählt sein.
    await db.bookingSettings.updateMany({ where: { tenantId: ctx.tenant.id, onlineProvider: provider }, data: { onlineProvider: "NONE", allowOnline: false } });
    await db.billingProfile.updateMany({ where: { tenantId: ctx.tenant.id, onlineFeeProvider: provider }, data: { onlineFeeProvider: "NONE" } });
  }
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "payment.provider.save", entity: "PaymentProviderConfig", entityId: provider, detail: `${providerLabel(provider)} ${enabled ? "aktiviert" : "deaktiviert"}` });
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/billing/settings");
  return ok(undefined, "Gespeichert.");
}

/** Verbindung mit den eingegebenen (oder gespeicherten) Zugangsdaten testen, ohne zu speichern. */
export async function testPaymentProviderAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requirePaymentsAdmin();
  const provider = String(formData.get("provider") ?? "");
  if (!isProviderKey(provider)) return fail("Unbekannter Anbieter");
  if (!TESTABLE_PROVIDERS.has(provider)) return fail("Für diesen Anbieter gibt es keinen Verbindungstest.");
  const { creds } = await currentCredentials(ctx.tenant.id, provider);
  const next = mergeCredentials(provider, formData, creds);
  const err = validate(provider, next);
  if (err) return fail(err);
  try {
    const p = buildProvider(provider, next);
    if (!p.testConnection) return fail("Für diesen Anbieter gibt es keinen Verbindungstest.");
    await p.testConnection();
    return ok(undefined, `Verbindung zu ${providerLabel(provider)} erfolgreich.`);
  } catch (e) {
    return fail(e instanceof PaymentError ? `Verbindung fehlgeschlagen: ${e.message}` : "Zahlungsanbieter nicht erreichbar.");
  }
}
